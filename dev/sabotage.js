// sabotage.js — prove a guard actually guards, and refuse to be fooled by a mutation that
// silently did nothing.
//
// WHY THIS EXISTS (2026-07-29): three contract clauses shipped that session as FAKE COVERAGE.
// Each looked green because the sabotage meant to break it never applied:
//   • indexOf("function _idbDel")  still matched after renaming to _idbDelUNUSED
//   • /requestPermission/          still matched the existence-check after the CALL was deleted
// A clause whose sabotage does not apply is untested, and untested-but-green is worse than
// absent — it is a guard you trust that is holding nothing. So this harness treats
// "the mutation changed no bytes" as a HARD FAILURE, exactly like "the guard didn't catch it".
//
// Usage:
//   var sabotage = require("./sabotage.js");
//   process.exit(sabotage.prove({
//     file: "bible_editor.html",
//     command: ["node", ["dev/run-tests.js"]],     // expected to FAIL on a sabotaged file
//     cases: [
//       { label: "remove the debounce cancel", find: "if (_saveT) { clearTimeout(_saveT); ... }", replace: "" },
//       { label: "swap !== back to >",         find: /diskMtime !== loadedMtime/, replace: "diskMtime > loadedMtime" }
//     ]
//   }));
//
// SAFETY: the original bytes are held in memory AND written to a side file before the first
// mutation, and restored on normal exit, on a throw, and on Ctrl-C. The last thing prove() does
// is assert the file is byte-identical to how it started — if it is not, that is a loud failure,
// because leaving a source file sabotaged is the worst outcome this tool could produce.

var fs = require("fs");
var path = require("path");
var cp = require("child_process");
var capture = require("./capture-run.js");
var os = require("os");
var ROOT = path.join(__dirname, "..");

/* Repo-relative contracts run against an exact working-byte copy in a disposable clone.
   This prevents a concurrent test process from loading the deliberate regression between
   mutation and restore — the mechanism behind the one-off E136 "flake" in TODO #25. Absolute
   paths remain in-place so the synthetic meta-suite can prove crash/interrupt restoration.

   #475 (2026-09-27) — THE WORKING SET RIDES IN, WHOLE. The clone is HEAD; mirrorWorkingSet() then
   makes it the working tree — every tracked file modified, added or deleted against HEAD, and every
   untracked file git does not ignore — so the clone differs from the working tree only by the
   mutation. It used to copy a curated list, and each skew the list missed reddened the clone's
   baseline and poisoned every clause's attribution until one more entry was added: #196
   engine-tests.js, #194L6 the engine manifest, #197 also:, JP0-5 ui-files.js, #256 ui-modals.js,
   #6 D4 village-measure.js, #423 run-standalone-suites.js. The last straw: an uncommitted
   audio-catalog.js regeneration (a manifest file, so it rode in) whose source dev/audio-delivery.json
   stayed at HEAD — the accent-layer suite's "catalog is current" check failed in every clone and
   stopped the standalone runner before later catchers ran. `also:` still works; it is now redundant.
   Untracked personal run logs (testRuns/) and Python caches are never test inputs: skipped, and
   the skip is said once per process. */
var MIRROR_SKIP = [
  { re: /^testRuns\//, what: "personal run log(s) under testRuns/" },
  { re: /(^|\/)__pycache__\//, what: "Python cache file(s)" }
];
var _mirrorSkipSaid = false;
function mirrorWorkingSet(scratch) {
  var env = {};   // a git hook's GIT_DIR / GIT_INDEX_FILE must not steer these reads off ROOT's own index (the TODO #27 class)
  Object.keys(process.env).forEach(function (k) { if (k.indexOf("GIT_") !== 0) env[k] = process.env[k]; });
  function git(args) {
    var r = cp.spawnSync("git", ["-c", "safe.directory=" + ROOT, "-c", "core.quotepath=off"].concat(args), { cwd: ROOT, env: env, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
    if (r.status !== 0) throw new Error("git " + args[0] + " failed: " + String(r.stderr || r.stdout || r.error).trim());
    return r.stdout;
  }
  function copyIn(rel) {
    var src = path.join(ROOT, rel), st;
    try { st = fs.statSync(src); } catch (e) { return; }
    if (!st.isFile()) return;
    fs.mkdirSync(path.dirname(path.join(scratch, rel)), { recursive: true });
    fs.copyFileSync(src, path.join(scratch, rel));
  }
  var changed = git(["diff", "--name-status", "--no-renames", "-z", "HEAD"]).split("\0");
  for (var i = 0; i + 1 < changed.length; i += 2) {
    if (!changed[i] || !changed[i + 1]) continue;
    if (changed[i] === "D") fs.rmSync(path.join(scratch, changed[i + 1]), { force: true });
    else copyIn(changed[i + 1]);
  }
  var skipped = {};
  git(["ls-files", "--others", "--exclude-standard", "-z"]).split("\0").filter(Boolean).forEach(function (rel) {
    for (var j = 0; j < MIRROR_SKIP.length; j++) if (MIRROR_SKIP[j].re.test(rel)) { skipped[MIRROR_SKIP[j].what] = (skipped[MIRROR_SKIP[j].what] || 0) + 1; return; }
    copyIn(rel);
  });
  var said = Object.keys(skipped);
  if (said.length && !_mirrorSkipSaid) {
    _mirrorSkipSaid = true;
    console.log("sabotage: the scratch clone mirrors the working set except " + said.map(function (w) { return skipped[w] + " untracked " + w; }).join(" and ") + " (never test inputs)");
  }
}
/* #551 (2026-10-02) — ONE CLONE PER BATTERY, reused by every prove() group. A fresh clone per group cost ~10 s on
   Windows: the first read of each freshly written file is scanned, so the first test run in a new clone took 10 s and
   the second 0.5 s. A full sweep made 698 clones (sabotage-w2 alone 32, ~5 of its 7 minutes). Reuse keeps the fresh-clone
   guarantee: before each group the clone is reset to HEAD (a tracked file a run changed comes back, a file it left is
   removed) and the working set is mirrored as it is at that moment; a moved HEAD gets a new clone. The clone is removed
   when the battery exits. */
var _scratch = null;   // { dir, head }
function gitIn(cwd, args) {
  var env = {};   // a git hook's GIT_DIR / GIT_INDEX_FILE must never steer these calls (the TODO #27 class)
  Object.keys(process.env).forEach(function (k) { if (k.indexOf("GIT_") !== 0) env[k] = process.env[k]; });
  return cp.spawnSync("git", ["-c", "safe.directory=" + cwd, "-c", "safe.directory=" + ROOT,
    "-c", "safe.directory=" + path.join(ROOT, ".git")].concat(args), { cwd: cwd, env: env, encoding: "utf8" });
}
function dropScratch() {
  if (!_scratch) return;
  var dir = _scratch.dir;
  _scratch = null;
  try { fs.rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }); }
  catch (e) { console.error("sabotage: could not remove the scratch clone " + dir + " — " + e.message + " (left on disk)"); }
}
process.on("exit", dropScratch);
function scratchClone() {
  var head = gitIn(ROOT, ["rev-parse", "HEAD"]), reset;
  if (head.status !== 0) { console.error("sabotage: could not read HEAD — " + String(head.stderr || head.stdout).trim()); return null; }
  head = head.stdout.trim();
  if (_scratch && _scratch.head === head) {
    reset = gitIn(_scratch.dir, ["checkout", "--quiet", "--", "."]);
    if (reset.status === 0) reset = gitIn(_scratch.dir, ["clean", "-fdxq"]);
    if (reset.status === 0) return _scratch.dir;
    console.error("sabotage: could not reset the scratch clone (" + String(reset.stderr || reset.stdout).trim() + ") — cloning afresh");
  }
  dropScratch();
  var scratch = fs.mkdtempSync(path.join(os.tmpdir(), "tnd-sabotage-proof-"));
  var clone = cp.spawnSync("git", ["-c", "safe.directory=" + ROOT,
    "-c", "safe.directory=" + path.join(ROOT, ".git"), "clone", "--quiet", "--no-hardlinks", ROOT, scratch],
    { encoding: "utf8" });
  if (clone.status !== 0) {
    console.error("sabotage: scratch clone failed: " + String(clone.stderr || clone.stdout || "unknown git error"));
    fs.rmSync(scratch, { recursive: true, force: true });
    return null;
  }
  _scratch = { dir: scratch, head: head };
  return scratch;
}
function proveScratch(opts) {
  var scratch = scratchClone();
  if (!scratch) return 1;
  try {   /* a group that throws leaves a clone nobody can vouch for: the next group gets a fresh one */
    function copyWorking(rel) {
      if (!rel || path.isAbsolute(rel)) return;
      var src = path.join(ROOT, rel), dst = path.join(scratch, rel);
      if (!fs.existsSync(src)) return;
      fs.mkdirSync(path.dirname(dst), { recursive: true });
      fs.copyFileSync(src, dst);
    }
    try { mirrorWorkingSet(scratch); }
    catch (eMirror) { console.error("sabotage: could not mirror the working set into the scratch clone — " + eMirror.message); return 1; }
    copyWorking(opts.file);
    (opts.also || []).forEach(copyWorking); /* #197 `also:` — redundant since #475 (the mirror carries every co-changed file), still honoured */
    if (opts.command && opts.command[1] && opts.command[1][0]) copyWorking(opts.command[1][0]);
    return prove({
      file: path.join(scratch, opts.file),
      command: opts.command,
      cases: opts.cases,
      cwd: scratch,
      inPlace: true
    });
  } catch (e) { dropScratch(); throw e; }
}

// OneDrive-resilient write (2026-08-09, #156 Phase B verification): the sync client's filter
// driver transiently locks files (errno -4094 UNKNOWN on open), which killed a run MID-MUTATION
// and left the tree sabotaged — for a harness whose whole job is putting files back, a flaky
// write is a correctness bug, not an inconvenience. Up to 6 attempts, ~200ms busy-wait between.
function writeRetry(file, data) {
  var tries = 6, err;
  while (tries-- > 0) {
    try { fs.writeFileSync(file, data); return; }
    catch (e) {
      err = e;
      var until = Date.now() + 200;
      while (Date.now() < until) { /* busy-wait — sync context, no timers */ }
    }
  }
  throw err;
}

function prove(opts) {
  if (opts.skip) return 0; /* #170: --focused runs section-scoped groups only */
  if (!opts.inPlace && !path.isAbsolute(opts.file)) return proveScratch(opts);
  var file = path.resolve(opts.file);
  if (!fs.existsSync(file)) { console.error("sabotage: no such file: " + file); return 1; }

  var original = fs.readFileSync(file);
  var rescue = path.join(os.tmpdir(), "sabotage-rescue-" + path.basename(file) + "-" + original.length);
  fs.writeFileSync(rescue, original);

  var restored = false;
  function restore(why) {
    if (restored) return;
    try {
      writeRetry(file, original);
      restored = true;
      if (why) console.error("\nsabotage: restored " + path.basename(file) + " after " + why);
    } catch (e) {
      console.error("\nsabotage: COULD NOT RESTORE " + file + " — recover it from " + rescue + " or `git checkout -- " + opts.file + "`");
    }
  }
  process.on("exit", function () { restore(null); });
  process.on("SIGINT", function () { restore("interrupt"); process.exit(130); });
  process.on("uncaughtException", function (e) { restore("a crash"); console.error(e); process.exit(1); });

  var cmd = opts.command || ["node", ["dev/run-tests.js"]];
  var results = [];

  try {
    for (var i = 0; i < opts.cases.length; i++) {
      var c = opts.cases[i];
      var before = fs.readFileSync(file, "utf8");
      var after;

      if (c.find instanceof RegExp) after = before.replace(c.find, c.replace);
      else {
        // Newline-rot fix (2026-08-22): source files are CRLF on disk while clauses are authored
        // with LF escapes -- an exact indexOf could NEVER match a multi-line find (39 clauses
        // across 14 files were candidates; 5 confirmed NOT APPLIED, two on drift-surface guards).
        // Normalize the CLAUSE to the file, never the file: restoration is byte-identity, and the
        // replacement lands in the same convention so a mutation cannot mint bare-LF islands.
        var cFind = String(c.find), cRepl = String(c.replace);
        if (before.indexOf(cFind) < 0 && cFind.indexOf("\n") >= 0) {
          var crlfFile = before.indexOf("\r\n") >= 0;
          var nlNorm = function (x) { return x.replace(/\r\n/g, "\n").replace(/\n/g, crlfFile ? "\r\n" : "\n"); };
          if (before.indexOf(nlNorm(cFind)) >= 0) { cFind = nlNorm(cFind); cRepl = nlNorm(cRepl); }
        }
        var at = before.indexOf(cFind);
        after = at < 0 ? before : before.slice(0, at) + cRepl + before.slice(at + cFind.length);
      }

      // ── the load-bearing check ──────────────────────────────────────────────
      if (after === before) {
        results.push({ label: c.label, verdict: "NOT APPLIED", detail: "the find target was absent or the replacement was identical — this clause is UNTESTED" });
        continue;
      }

      writeRetry(file, after);
      var run = capture.runCaptured(cmd[0], cmd[1], { cwd: opts.cwd || ROOT });   /* #473: the whole output, not Node's 1 MiB default */
      writeRetry(file, original);
      if (run.unobserved) {   /* #473: a run the harness could not fully observe gets no verdict drawn from a fragment */
        results.push({ label: c.label, verdict: "UNOBSERVED", detail: "the guarded command " + run.unobserved + " — this clause is UNTESTED" });
        continue;
      }

      /* #170 (entry-13 brief F): an exit-status-only verdict cannot tell a REAL catch from a
         mutation that tripped some unrelated red — measured: 2 of 25 v1.601 W7 clauses were
         actually caught by pre-#168 sections. A clause may now carry `mustFail`: a substring
         (usually the guarding test's name) that must appear in the failing run's output. Wrong
         red = MISATTRIBUTED, its own loud verdict — the guard exists but is not the one the
         clause claims. */
      var failed = run.status !== 0;
      var out = String(run.stdout || "") + String(run.stderr || "");
      var attributed = !c.mustFail || out.indexOf(c.mustFail) >= 0;
      results.push({
        label: c.label,
        verdict: failed ? (attributed ? "caught" : "MISATTRIBUTED") : "MISSED",
        detail: failed ? (attributed ? "" : "the run failed but NOT on \"" + c.mustFail + "\" — an unrelated red caught this mutation") : "the sabotaged file still passed — nothing is guarding this"
      });
    }
  } finally {
    restore(null);
  }

  // Prove we put it back exactly as we found it.
  var now = fs.readFileSync(file);
  var intact = now.length === original.length && now.equals(original);

  var bad = results.filter(function (r) { return r.verdict !== "caught"; });
  console.log("\n  sabotage — " + path.basename(file));
  results.forEach(function (r) {
    var mark = r.verdict === "caught" ? "✓" : "✗";
    console.log("   " + mark + " " + r.verdict.padEnd(11) + " " + r.label + (r.detail ? "\n        " + r.detail : ""));
  });
  console.log("   " + (intact ? "✓" : "✗") + " file restored byte-identical" + (intact ? "" : " — MANUAL RECOVERY NEEDED: " + rescue));
  console.log("   " + (results.length - bad.length) + "/" + results.length + " clauses proven\n");

  try { fs.unlinkSync(rescue); } catch (e) {}
  return (bad.length || !intact) ? 1 : 0;
}

module.exports = { prove: prove };
