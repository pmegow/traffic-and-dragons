// sabotage-777-harness-truth.js — retained proof for audit 2026-11-19 rows G1, G3 and G4 (TODO #777): three ways a sabotage
// clause read "caught" with nothing guarding it, closed in dev/sabotage.js, dev/scratch-contract-sabotage.js and the anchor
// scan (dev/check-sabotage-applicability.js).
//   G1  a scan that fails by construction in a mutated tree is told which file is under mutation, and leaves that ONE out
//   G3  a catcher named only on a line that reports a PASS is no attribution
//   G4  the guarded command runs on the unmutated file first; a red clean run proves nothing
// Every clause reddens a NAMED case of the harness's own suites.
var sabotage = require("./sabotage.js");
var META = ["node", ["dev/tests-sabotage-meta.js"]];
var SCAN = ["node", ["dev/tests-252-retained-proof-wiring.js", "leaves out the ONE file"]];
var CONTRACT = ["node", ["dev/tests-609-contract-harness.js"]];
var failed = 0;

failed += sabotage.prove({ file: "dev/sabotage.js", command: META, cases: [
  { label: "G3: a line that reports a PASS attributes again",
    find: "if (lines[i].indexOf(mustFail) >= 0 && !PASS_LINE.test(lines[i])) return true;",
    replace: "if (lines[i].indexOf(mustFail) >= 0) return true;",
    mustFail: "FAIL G3: a mustFail found only on a PASS" },
  { label: "G3: a SKIP line attributes again",
    find: "PASS\\b|SKIP\\b|ok\\b", replace: "PASS\\b|ok\\b",
    mustFail: "FAIL G3: a mustFail found only on a PASS" },
  { label: "G4: a red clean run is ignored",
    find: "      if (clean.red) {", replace: "      if (false) {",
    mustFail: "FAIL G4: a guarded command that is red on the UNMUTATED file" },
  { label: "G4: the clean run's exit status is not read",
    find: "  else if (run.status !== 0) {", replace: "  else if (false) {",
    mustFail: "FAIL G4: a guarded command that is red on the UNMUTATED file" },
  { label: "G4: the clean run is repeated for every clause (the remembered verdict is gone)",
    find: "  if (_baselines[key]) return _baselines[key];\n", replace: "",
    mustFail: "FAIL one scratch clone serves every prove group" },
  { label: "G1: the mutated run is not told the file",
    find: "{ cwd: cwd, env: env });   /* #473", replace: "{ cwd: cwd });   /* #473",
    mustFail: "FAIL G1: the guarded command is told which file is under mutation" },
  { label: "G1: the clean run is not told the file",
    find: "capture.runCaptured(cmd[0], cmd[1], { cwd: cwd, env: env }), why = \"\";",
    replace: "capture.runCaptured(cmd[0], cmd[1], { cwd: cwd }), why = \"\";",
    mustFail: "FAIL G1: the guarded command is told which file is under mutation" }
] });

failed += sabotage.prove({ file: "dev/check-sabotage-applicability.js", command: SCAN, cases: [
  { label: "G1: the scan never leaves a file out (the clause under proof fails it by construction again)",
    find: "problems(rootArg, process.env[PROVING_FILE_ENV])", replace: "problems(rootArg)",
    mustFail: "FAIL applicability scan leaves out the ONE file" },
  { label: "G1: a proof on one file hides every file's anchors",
    find: "slashed(clause.file) === proving", replace: "true",
    mustFail: "FAIL applicability scan leaves out the ONE file" },
  { label: "G1: the scan leaves a file out without a word",
    find: "  if (result.leftOut) console.log(", replace: "  if (false) console.log(",
    mustFail: "FAIL applicability scan leaves out the ONE file" },
  { label: "G1: a backslash path names a different file",
    find: ".split(\"\\\\\").join(\"/\")", replace: "",
    mustFail: "FAIL applicability scan leaves out the ONE file" }
] });

failed += sabotage.prove({ file: "dev/scratch-contract-sabotage.js", command: CONTRACT, cases: [
  { label: "G4 (contract harness): a red clean run is ignored",
    find: "      if (cleanRed[c.file]) { failed++;", replace: "      if (false) { failed++;",
    mustFail: "FAIL G4: a guard that is red on the unmutated clone" },
  { label: "G3 (contract harness): the catcher is searched for in the whole output again",
    find: "!sab.attributedOn(out, c.mustFail)", replace: "out.indexOf(c.mustFail) < 0",
    mustFail: "FAIL G3: a catcher named only on a PASS line" },
  { label: "G1 (contract harness): the mutated run is not told the file",
    find: "{ cwd: scratch, env: env });   /* #473: the whole output */", replace: "{ cwd: scratch });",
    mustFail: "FAIL G1: the guarded command is told which file is under mutation" }
] });

process.exit(failed ? 1 : 0);
