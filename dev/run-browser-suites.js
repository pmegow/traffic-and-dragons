// dev/run-browser-suites.js — THE local run of every Chrome-driven suite (#652, 2026-10-20). One job: the suites CI
// runs in its browser steps, run here several at a time, each verdict and its time on one line, a red one's tail printed, one
// summary, exit 1 if any failed. The pre-push hook (dev/pre-push) runs it so a red browser suite never reaches master:
// the pre-commit never runs a Chrome suite (the #481 G6 class puts them in CI only), which is how 45f0d189 landed with
// dev/tests-501-shop-button-browser.js red and the gate stayed red 2.6 days until an unrelated commit fixed it in passing.
//
//   node dev/run-browser-suites.js            run them all, JOBS_DEFAULT at a time
//   node dev/run-browser-suites.js --jobs=1   one after another (or BROWSER_SUITE_JOBS=1) — how it ran until 2026-11-18:
//                                             325 s for 40 suites. Three Chromes at once once made the #615 signup
//                                             suite fail 4 of 9; #647 found and fixed that cause (a click measured
//                                             before the stylesheet applied), which is what made a width possible.
//   node dev/run-browser-suites.js --list     print the derived list and exit
//   node dev/run-browser-suites.js --only 501 run the suites whose file name contains the text
//
// The list is DERIVED, never written down: every dev/tests-*.js with a real require of ./cdp-browser.js, the same
// derivation check-enforcement.js uses to demand a CI step for each (browserSuiteNames). A machine without Chrome
// cannot run them: it says so on one loud line and exits 0 — CI runs them on every push regardless (#472: a missing
// browser is a loud SKIP, never a pass, and never a block on a push from a machine that cannot verify).
var fs = require("fs");
var path = require("path");
var cp = require("child_process");
var enforcement = require("./check-enforcement.js");
var driver = require("./cdp-browser.js");

function parseArgs(argv) {
  var out = { root: path.join(__dirname, ".."), list: false, only: null, jobs: null };
  for (var i = 0; i < argv.length; i++) {
    if (argv[i] === "--root" && argv[i + 1]) out.root = path.resolve(argv[++i]);
    else if (argv[i] === "--list") out.list = true;
    else if (argv[i] === "--only" && argv[i + 1]) out.only = argv[++i];
    else if (/^--jobs=\d+$/.test(argv[i])) out.jobs = Number(argv[i].slice(7));
    else throw new Error("unknown or incomplete argument: " + argv[i]);
  }
  return out;
}

function suites(root, only) {
  return enforcement.browserSuiteNames(root).filter(function (n) { return !only || n.indexOf(only) >= 0; });
}

function tail(text, n) {
  var lines = String(text || "").split(/\r?\n/).filter(function (l) { return l.trim(); });
  return lines.slice(-n).join("\n");
}

// How many suites run at once. Each suite is its own node process and its own headless Chrome on its own profile and
// port, so they share nothing but the machine. --jobs=N, else BROWSER_SUITE_JOBS, else JOBS_DEFAULT.
var JOBS_DEFAULT = 4;
function jobCount(opts, env) {
  var n = opts.jobs;
  if (n === null || n === undefined) {
    if (env.BROWSER_SUITE_JOBS && !/^\d+$/.test(env.BROWSER_SUITE_JOBS)) throw new Error("BROWSER_SUITE_JOBS is not a number: " + env.BROWSER_SUITE_JOBS);
    n = env.BROWSER_SUITE_JOBS ? Number(env.BROWSER_SUITE_JOBS) : JOBS_DEFAULT;
  }
  if (n < 1) throw new Error("jobs must be at least 1");
  return n;
}

// run — hands done({ ran, failed: [names], skipped: reason|null, seconds, jobs }). Never throws for a suite's own
// failure. Every suite runs whatever the others did; a verdict is printed when its suite ends, the summary last.
function run(opts, log, done) {
  log = log || function (s) { console.log(s); };
  var names = suites(opts.root, opts.only);
  var chrome = driver.locateChrome();
  if (!chrome.path) {
    console.error("BROWSER SUITES NOT RUN — no Chrome on this machine (" + chrome.why + "); the " + names.length + " suites were not verified here. CI runs them on every push.");
    return done({ ran: [], failed: [], skipped: chrome.why, seconds: 0, jobs: 0 });
  }
  var jobs = jobCount(opts, process.env);
  var t0 = Date.now(), failed = [], next = 0, running = 0;
  function ended(name, s, r) {
    var secs = ((Date.now() - s) / 1000).toFixed(1);
    var ok = r.status === 0;
    log((ok ? "PASS " : "FAIL ") + name + "  " + secs + "s");
    if (!ok) {
      failed.push(name);
      log("  ---- " + name + " (exit " + r.status + (r.error ? ", " + r.error.message : "") + "), last lines:");
      log(tail(r.stdout + "\n" + r.stderr, 25).replace(/^/gm, "  | "));
    }
    running--;
    pump();
  }
  function start(name) {
    var s = Date.now(), out = [], err = [], over = false;
    function end(status, error) { if (over) return; over = true; ended(name, s, { status: status, error: error, stdout: out.join(""), stderr: err.join("") }); }
    var child = cp.spawn(process.execPath, [path.join("dev", name)], { cwd: opts.root, env: process.env });
    child.stdout.setEncoding("utf8"); child.stderr.setEncoding("utf8");
    child.stdout.on("data", function (d) { out.push(d); });
    child.stderr.on("data", function (d) { err.push(d); });
    child.on("error", function (e) { end(null, e); });
    child.on("close", function (code, signal) { end(code, code === null ? new Error("killed by " + signal) : null); });
  }
  function pump() {
    while (running < jobs && next < names.length) { running++; start(names[next++]); }
    if (running) return;
    failed.sort(function (x, y) { return names.indexOf(x) - names.indexOf(y); });
    var seconds = ((Date.now() - t0) / 1000).toFixed(0);
    if (failed.length) log("BROWSER SUITES RED — " + failed.length + " of " + names.length + " failed in " + seconds + "s: " + failed.join(", "));
    else log("BROWSER SUITES GREEN — " + names.length + " suites in " + seconds + "s");
    done({ ran: names, failed: failed, skipped: null, seconds: Number(seconds), jobs: jobs });
  }
  pump();
}

function main() {
  var opts;
  try { opts = parseArgs(process.argv.slice(2)); }
  catch (e) { console.error("run-browser-suites: " + e.message); process.exit(2); }
  if (opts.list) { suites(opts.root, opts.only).forEach(function (n) { console.log(n); }); return; }
  try { jobCount(opts, process.env); }
  catch (e) { console.error("run-browser-suites: " + e.message); process.exit(2); }
  run(opts, null, function (result) { process.exit(result.failed.length ? 1 : 0); });
}

if (require.main === module) main();
module.exports = { run: run, suites: suites, parseArgs: parseArgs, jobCount: jobCount, JOBS_DEFAULT: JOBS_DEFAULT };
