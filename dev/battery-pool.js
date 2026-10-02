// battery-pool.js — runs sabotage batteries several at a time, for both runners: run-sabotage-diff.js (the commit gate)
// and run-sabotage-all.js (the weekly job). DEV TOOL, node-only. (2026-10-02: a 72-battery sweep took ~55 min on one core
// of 32. Every battery already mutates only its own scratch clone, so the serial loop was the only thing holding it.)
//
//   jobsFrom(argv, env, cpus) → { jobs, rest }   --jobs=N on the command line, else SABOTAGE_JOBS, else half the cores
//                                                (at most 8). rest is argv without the flag. A malformed count THROWS:
//                                                it must never be read as a commit range or a filter word.
//   run(files, opts, onResult, onDone)           opts: { cwd, jobs, log }. onResult(r) once per battery, when its FINAL
//                                                verdict lands (completion order); onDone(results) in the input order.
//                                                r = { file, status, out, verdict, skipLines, secs, flake }
//
// Isolation: each battery is its own process with its own TEMP/TMP/TMPDIR, a fresh directory removed after it, so a fixed
// temp name (a browser suite's artifact folder, a pid file) can never collide between two batteries running at once.
// Load: with more than one job, a battery that fails is re-run ALONE after the rest finish, and only that verdict counts.
// A real failure fails twice. One that passes alone comes back with flake:true, and the runners name it; it is never
// folded silently into green. With one job nothing is re-run: the first verdict is final, as in the old serial loop.
"use strict";
var fs = require("fs"), os = require("os"), path = require("path"), cp = require("child_process");
var verdict = require("./battery-verdict.js");
var MAX_DEFAULT_JOBS = 8, TAIL_LINES = 15;

function jobsFrom(argv, env, cpus) {
  var rest = [], jobs = null, i, m;
  for (i = 0; i < argv.length; i++) {
    if (!/^--jobs/.test(argv[i])) { rest.push(argv[i]); continue; }
    m = /^--jobs=([1-9]\d*)$/.exec(argv[i]);
    if (!m) throw new Error("battery-pool: " + JSON.stringify(argv[i]) + " is not a job count — write --jobs=N with N a whole number of at least 1");
    jobs = Number(m[1]);
  }
  if (jobs === null && env.SABOTAGE_JOBS !== undefined && env.SABOTAGE_JOBS !== "") {
    if (!/^[1-9]\d*$/.test(String(env.SABOTAGE_JOBS))) throw new Error("battery-pool: SABOTAGE_JOBS=" + JSON.stringify(env.SABOTAGE_JOBS) + " is not a job count — a whole number of at least 1");
    jobs = Number(env.SABOTAGE_JOBS);
  }
  if (jobs === null) jobs = Math.max(1, Math.min(MAX_DEFAULT_JOBS, Math.floor(cpus / 2)));
  return { jobs: jobs, rest: rest };
}

// One battery, its own process and temp dir. done(raw) exactly once: { file, status (null when killed or never
// started), out (stdout and stderr in arrival order), secs, cleanup (a note when the temp dir would not go) }.
function runOne(file, cwd, done) {
  var start = Date.now(), tmp = fs.mkdtempSync(path.join(os.tmpdir(), "tnd-battery-")), env = {}, chunks = [], finished = false, child;
  Object.keys(process.env).forEach(function (k) { if (["TEMP", "TMP", "TMPDIR"].indexOf(k.toUpperCase()) < 0) env[k] = process.env[k]; });
  env.TEMP = tmp; env.TMP = tmp; env.TMPDIR = tmp;
  function finish(status, extra) {
    if (finished) return;
    finished = true;
    var note = "";
    try { fs.rmSync(tmp, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }); }
    catch (e) { note = "battery-pool: could not remove " + tmp + " after " + file + " — " + e.message + " (left on disk)"; }
    done({ file: file, status: status, out: Buffer.concat(chunks).toString("utf8") + (extra || ""), secs: Math.round((Date.now() - start) / 1000), cleanup: note });
  }
  try { child = cp.spawn(process.execPath, ["dev/" + file], { cwd: cwd, env: env, stdio: ["ignore", "pipe", "pipe"] }); }
  catch (e) { finish(null, "\nbattery-pool: could not start " + file + " — " + e.message); return; }
  child.stdout.on("data", function (b) { chunks.push(b); });
  child.stderr.on("data", function (b) { chunks.push(b); });
  child.on("error", function (e) { finish(null, "\nbattery-pool: " + file + " — " + e.message); });
  child.on("close", function (code) { finish(code, ""); });
}

function run(files, opts, onResult, onDone) {
  var jobs = Math.max(1, Math.min(opts.jobs || 1, files.length)), log = opts.log || console.log;
  var queue = files.slice(), running = 0, retry = [], results = {}, drained = false;
  function settle(raw, lone) {
    var v = verdict.classify(raw.status, raw.out);
    if (raw.cleanup) log(raw.cleanup);
    if (v.verdict === "fail" && jobs > 1 && !lone) {
      retry.push(raw.file);
      log("…    " + raw.file + " failed beside other batteries (" + raw.secs + "s) — re-running it alone once the rest finish. Its output:");
      log(raw.out.split("\n").slice(-TAIL_LINES).map(function (l) { return "       " + l; }).join("\n"));
      return;
    }
    var r = { file: raw.file, status: raw.status, out: raw.out, verdict: v.verdict, skipLines: v.skipLines, secs: raw.secs, flake: lone && v.verdict !== "fail" };
    results[raw.file] = r;
    onResult(r);
  }
  function loneRuns() {
    if (!retry.length) { onDone(files.map(function (f) { return results[f]; })); return; }
    runOne(retry.shift(), opts.cwd, function (raw) { settle(raw, true); loneRuns(); });
  }
  function pump() {
    while (running < jobs && queue.length) {
      running++;
      runOne(queue.shift(), opts.cwd, function (raw) { running--; settle(raw, false); pump(); });
    }
    if (!running && !queue.length && !drained) { drained = true; loneRuns(); }   /* once: a battery that never started settles synchronously, inside this loop */
  }
  pump();
}

module.exports = { jobsFrom: jobsFrom, run: run, MAX_DEFAULT_JOBS: MAX_DEFAULT_JOBS };
