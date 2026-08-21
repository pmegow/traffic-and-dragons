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
var os = require("os");
var ROOT = path.join(__dirname, "..");

/* Repo-relative contracts run against an exact working-byte copy in a disposable clone.
   This prevents a concurrent test process from loading the deliberate regression between
   mutation and restore — the mechanism behind the one-off E136 "flake" in TODO #25. Absolute
   paths remain in-place so the synthetic meta-suite can prove crash/interrupt restoration. */
function proveScratch(opts) {
  var scratch = fs.mkdtempSync(path.join(os.tmpdir(), "tnd-sabotage-proof-"));
  try {
    var clone = cp.spawnSync("git", ["-c", "safe.directory=" + ROOT,
      "-c", "safe.directory=" + path.join(ROOT, ".git"), "clone", "--quiet", "--no-hardlinks", ROOT, scratch],
      { encoding: "utf8" });
    if (clone.status !== 0) {
      console.error("sabotage: scratch clone failed: " + String(clone.stderr || clone.stdout || "unknown git error"));
      return 1;
    }
    function copyWorking(rel) {
      if (!rel || path.isAbsolute(rel)) return;
      var src = path.join(ROOT, rel), dst = path.join(scratch, rel);
      if (!fs.existsSync(src)) return;
      fs.mkdirSync(path.dirname(dst), { recursive: true });
      fs.copyFileSync(src, dst);
    }
    copyWorking(opts.file);
    copyWorking("dev/run-tests.js");
    copyWorking("dev/engine-tests.js"); /* #196 find: the clone held the COMMITTED suite, so a clause whose catching test was authored in the same (uncommitted) change was structurally unprovable pre-commit — every new #196 mutation reported MISSED against the old tests. The working suite must ride with the working runner. */
    /* #194L6 (the class fix; #196/#197 were slices of it): the suite loads EVERY engine-manifest
       file, so ANY working-vs-HEAD skew in ANY of them reds a clone's baseline and poisons every
       clause's attribution (the #28 battery: 0/9 on a block whose clone mixed working tests with
       pre-commit game.js). The whole manifest's working set rides in; `also:` survives for
       non-manifest co-changes (satellites, ui shards). */
    try{require("./engine-manifest.js").forEach(function(en){copyWorking(en.file);});}catch(eM){}
    (opts.also || []).forEach(copyWorking); /* #197: the #196 fix's multi-FILE sibling — a feature spanning several engine files is only provable pre-commit if the WORKING copy of every co-changed file rides into the clone, else each clause "fails" on the absent feature and misattributes as caught */
    if (opts.command && opts.command[1] && opts.command[1][0]) copyWorking(opts.command[1][0]);
    return prove({
      file: path.join(scratch, opts.file),
      command: opts.command,
      cases: opts.cases,
      cwd: scratch,
      inPlace: true
    });
  } finally {
    fs.rmSync(scratch, { recursive: true, force: true });
  }
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
        var at = before.indexOf(c.find);
        after = at < 0 ? before : before.slice(0, at) + c.replace + before.slice(at + c.find.length);
      }

      // ── the load-bearing check ──────────────────────────────────────────────
      if (after === before) {
        results.push({ label: c.label, verdict: "NOT APPLIED", detail: "the find target was absent or the replacement was identical — this clause is UNTESTED" });
        continue;
      }

      writeRetry(file, after);
      var run = cp.spawnSync(cmd[0], cmd[1], { cwd: opts.cwd || ROOT, encoding: "utf8" });
      writeRetry(file, original);

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
