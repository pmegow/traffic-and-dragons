// dev/run-browser-suites.js — THE local run of every Chrome-driven suite (#652, 2026-10-20). One job: the suites CI
// runs in its browser steps, run here in sequence, each verdict and its time on one line, a red one's tail printed, one
// summary, exit 1 if any failed. The pre-push hook (dev/pre-push) runs it so a red browser suite never reaches master:
// the pre-commit never runs a Chrome suite (the #481 G6 class puts them in CI only), which is how 45f0d189 landed with
// dev/tests-501-shop-button-browser.js red and the gate stayed red 2.6 days until an unrelated commit fixed it in passing.
//
//   node dev/run-browser-suites.js            run them all (about two minutes here; sequential — three Chromes at
//                                             once made the #615 signup suite fail 4 of 9, see #647)
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
  var out = { root: path.join(__dirname, ".."), list: false, only: null };
  for (var i = 0; i < argv.length; i++) {
    if (argv[i] === "--root" && argv[i + 1]) out.root = path.resolve(argv[++i]);
    else if (argv[i] === "--list") out.list = true;
    else if (argv[i] === "--only" && argv[i + 1]) out.only = argv[++i];
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

// run — returns { ran, failed: [names], skipped: reason|null, seconds }. Never throws for a suite's own failure.
function run(opts, log) {
  log = log || function (s) { console.log(s); };
  var names = suites(opts.root, opts.only);
  var chrome = driver.locateChrome();
  if (!chrome.path) {
    console.error("BROWSER SUITES NOT RUN — no Chrome on this machine (" + chrome.why + "); the " + names.length + " suites were not verified here. CI runs them on every push.");
    return { ran: [], failed: [], skipped: chrome.why, seconds: 0 };
  }
  var t0 = Date.now(), failed = [];
  names.forEach(function (name) {
    var s = Date.now();
    var r = cp.spawnSync(process.execPath, [path.join("dev", name)], { cwd: opts.root, encoding: "utf8", maxBuffer: 64 * 1024 * 1024, env: process.env });
    var secs = ((Date.now() - s) / 1000).toFixed(1);
    var ok = r.status === 0;
    log((ok ? "PASS " : "FAIL ") + name + "  " + secs + "s");
    if (!ok) {
      failed.push(name);
      log("  ---- " + name + " (exit " + r.status + (r.error ? ", " + r.error.message : "") + "), last lines:");
      log(tail(String(r.stdout || "") + "\n" + String(r.stderr || ""), 25).replace(/^/gm, "  | "));
    }
  });
  var seconds = ((Date.now() - t0) / 1000).toFixed(0);
  if (failed.length) log("BROWSER SUITES RED — " + failed.length + " of " + names.length + " failed in " + seconds + "s: " + failed.join(", "));
  else log("BROWSER SUITES GREEN — " + names.length + " suites in " + seconds + "s");
  return { ran: names, failed: failed, skipped: null, seconds: Number(seconds) };
}

function main() {
  var opts;
  try { opts = parseArgs(process.argv.slice(2)); }
  catch (e) { console.error("run-browser-suites: " + e.message); process.exit(2); }
  if (opts.list) { suites(opts.root, opts.only).forEach(function (n) { console.log(n); }); return; }
  var result = run(opts);
  process.exit(result.failed.length ? 1 : 0);
}

if (require.main === module) main();
module.exports = { run: run, suites: suites, parseArgs: parseArgs };
