// dev/prove-before-push.js — THE local proof before a push (owner ruling 2026-11-18, "plan 1": push first, prove in CI).
// One job: run what is quick and what is this change's OWN, and say what is left to CI.
//
//   1. the applicability scan (dev/check-sabotage-applicability.js, seconds): every retained sabotage clause still
//      finds its anchor, once — an edit that moved another battery's anchor is caught here, not two hours later
//   2. the replay baselines CI checks (derived from the workflow's own `diff-replay … --check` steps, a second in all)
//   3. the batteries this range ADDED or EDITED (dev/sabotage-*.js itself changed) — a guard is proven the day it is written
//
// NOT run here any more: the RANGE SWEEP, every battery whose target file the range touched. It took 4 to 40 minutes at
// the desk and CI runs the identical sweep on every push (`node dev/run-sabotage-diff.js "$CI_RANGE"`, a step that runs
// even when an earlier step is red). The last line says how many batteries that is, so nobody takes this for it. A red
// CI run reaches the next session through dev/ci-status.js. To run the sweep at the desk anyway:
//   node dev/run-sabotage-diff.js origin/master..HEAD
//
//   node dev/prove-before-push.js [range] [--jobs=N] [--root DIR]      range defaults to origin/master..HEAD
// Exit 0 green, 1 a step is red, 2 the range could not be read (never a green over nothing).
"use strict";
var fs = require("fs"), os = require("os"), path = require("path"), cp = require("child_process");
var pool = require("./battery-pool.js"), targets = require("./battery-targets.js");

/* git exports its repo location into a hook's environment; a battery's scratch clone must never inherit it (TODO #27 class) */
var GIT_LOCATION = ["GIT_DIR", "GIT_WORK_TREE", "GIT_INDEX_FILE", "GIT_COMMON_DIR", "GIT_OBJECT_DIRECTORY", "GIT_ALTERNATE_OBJECT_DIRECTORIES", "GIT_PREFIX"];

function isBattery(file) { return /^dev\/sabotage-[^\/]*\.js$/.test(file) && file !== "dev/sabotage.js"; }

// ownBatteries — of the files a range added or modified, the batteries (by file name, as the pool takes them).
function ownBatteries(addedOrModified) {
  return addedOrModified.filter(isBattery).map(function (f) { return f.slice(4); }).sort();
}

// replayCommands — the corpus files CI replays with --check, read from the workflow so the two never drift apart.
function replayCommands(workflow) {
  var out = [], re = /^\s*run:\s*node (dev\/diff-replay\.js) (\S+) --check\s*$/gm, m;
  while ((m = re.exec(String(workflow)))) out.push([m[1], m[2], "--check"]);
  return out;
}

// sweepSize — how many batteries the range sweep would run (run-sabotage-diff.js's own rule): CI's job, counted here.
function sweepSize(changed, batterySources) {
  return Object.keys(batterySources).filter(function (f) {
    return changed.indexOf("dev/" + f) >= 0 || targets.targetsOf(batterySources[f]).some(function (t) { return changed.indexOf(t) >= 0; });
  }).length;
}

function parseArgs(argv) {
  var j = pool.jobsFrom(argv, process.env, os.cpus().length), out = { jobs: j.jobs, root: path.join(__dirname, ".."), range: null };
  for (var i = 0; i < j.rest.length; i++) {
    if (j.rest[i] === "--root" && j.rest[i + 1]) out.root = path.resolve(j.rest[++i]);
    else if (/^--/.test(j.rest[i])) throw new Error("unknown or incomplete argument: " + j.rest[i]);
    else if (out.range === null) out.range = j.rest[i];
    else throw new Error("one range, got a second: " + j.rest[i]);
  }
  if (out.range === null) out.range = "origin/master..HEAD";
  return out;
}

function gitNames(root, args) {
  var r = cp.spawnSync("git", ["diff", "--name-only"].concat(args), { cwd: root, encoding: "utf8" });
  if (r.status !== 0) throw new Error(String(r.stderr || r.error || "git diff failed").trim());
  return r.stdout.split(/\r?\n/).map(function (s) { return s.trim().replace(/\\/g, "/"); }).filter(Boolean);
}

function step(root, label, args) {
  var t = Date.now(), r = cp.spawnSync(process.execPath, args, { cwd: root, encoding: "utf8", maxBuffer: 256 * 1024 * 1024 });
  var ok = r.status === 0;
  console.log((ok ? "ok   " : "FAIL ") + label + " (" + Math.round((Date.now() - t) / 1000) + "s)");
  if (!ok) console.log((String(r.stdout || "") + "\n" + String(r.stderr || "") + (r.error ? "\n" + r.error.message : "")).split(/\r?\n/).filter(function (l) { return l.trim(); }).slice(-25).join("\n"));
  return ok;
}

function main() {
  var opts;
  try { opts = parseArgs(process.argv.slice(2)); }
  catch (e) { console.error("prove-before-push: " + e.message); process.exit(2); }
  GIT_LOCATION.forEach(function (k) { delete process.env[k]; });
  var root = opts.root, changed, own, replays, sources = {};
  try {
    changed = gitNames(root, [opts.range]);
    own = ownBatteries(gitNames(root, ["--diff-filter=AM", opts.range])).filter(function (f) { return fs.existsSync(path.join(root, "dev", f)); });
    replays = replayCommands(fs.readFileSync(path.join(root, ".github", "workflows", "engine-tests.yml"), "utf8"));
    fs.readdirSync(path.join(root, "dev")).filter(function (f) { return isBattery("dev/" + f); })
      .forEach(function (f) { sources[f] = fs.readFileSync(path.join(root, "dev", f), "utf8"); });
  } catch (e) {
    console.error("PROVE BEFORE PUSH NOT RUN — the range " + opts.range + " could not be read (" + e.message + "). Nothing was proven here; pass a range that exists.");
    process.exit(2);
  }
  var red = [];
  if (!step(root, "applicability scan (every retained clause finds its anchor once)", ["dev/check-sabotage-applicability.js"])) red.push("the applicability scan");
  replays.forEach(function (c) { if (!step(root, "replay " + c[1], c)) red.push("replay " + c[1]); });
  if (!replays.length) { console.log("FAIL the workflow names no replay baseline (diff-replay … --check) — the list is derived from it"); red.push("no replay baselines found"); }
  var left = sweepSize(changed, sources);
  function verdict(skipped) {
    var ciLine = "The range sweep is CI's: " + left + " battery(ies) target " + opts.range + " and run there on the push" + (left ? "; a red one reaches the next session through dev/ci-status.js." : ".");
    if (red.length) { console.error("PROVE BEFORE PUSH RED — " + red.join(", ") + ". " + ciLine); process.exit(1); }
    console.log("PROVE BEFORE PUSH GREEN — the scan, " + replays.length + " replay(s), " + own.length + " battery(ies) this range added or edited" + (skipped.length ? " (" + skipped.length + " SKIPPED, not proven here: " + skipped.join(", ") + ")" : "") + ". " + ciLine);
    process.exit(0);
  }
  if (!own.length) return verdict([]);
  console.log("prove-before-push: " + own.length + " battery(ies) added or edited in " + opts.range + " — " + own.join(", "));
  var skipped = [];
  pool.run(own, { cwd: root, jobs: opts.jobs }, function (v) {
    console.log((v.verdict === "fail" ? "FAIL " : v.verdict === "skip" ? "SKIP " : "ok   ") + v.file + " (" + v.secs + "s" + (v.flake ? ", passed only when re-run alone — flaky under load, look into it" : "") + ")");
    if (v.verdict === "fail") { red.push(v.file); console.log(String(v.out || "").split("\n").slice(-25).join("\n")); }
    if (v.verdict === "skip") { skipped.push(v.file); v.skipLines.forEach(function (l) { console.log(l); }); }
  }, function () { verdict(skipped); });
}

if (require.main === module) main();
module.exports = { ownBatteries: ownBatteries, replayCommands: replayCommands, sweepSize: sweepSize, parseArgs: parseArgs, isBattery: isBattery };
