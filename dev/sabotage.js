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

function prove(opts) {
  var file = path.resolve(opts.file);
  if (!fs.existsSync(file)) { console.error("sabotage: no such file: " + file); return 1; }

  var original = fs.readFileSync(file);
  var rescue = path.join(os.tmpdir(), "sabotage-rescue-" + path.basename(file) + "-" + original.length);
  fs.writeFileSync(rescue, original);

  var restored = false;
  function restore(why) {
    if (restored) return;
    try {
      fs.writeFileSync(file, original);
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

      fs.writeFileSync(file, after);
      var run = cp.spawnSync(cmd[0], cmd[1], { cwd: path.join(__dirname, ".."), encoding: "utf8" });
      fs.writeFileSync(file, original);

      var caught = run.status !== 0;
      results.push({
        label: c.label,
        verdict: caught ? "caught" : "MISSED",
        detail: caught ? "" : "the sabotaged file still passed — nothing is guarding this"
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
