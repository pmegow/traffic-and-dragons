// run-standalone-suites.js — the standalone verifier fragments that do not fit inside
// engine-tests.js's shared global fixture. Kept as child processes so their fetch/storage
// stubs cannot contaminate each other or the main engine suite.
var cp = require("child_process");
var path = require("path");

var ROOT = path.join(__dirname, "..");
var SUITES = [
  "dev/tests-b9-transport.js",
  "dev/tests-c13-adapter.js",
  "dev/tests-dedup-a.js",
  "dev/tests-verification-enforcement.js"
];

for (var i = 0; i < SUITES.length; i++) {
  var run = cp.spawnSync(process.execPath, [SUITES[i]], { cwd: ROOT, encoding: "utf8" });
  process.stdout.write(String(run.stdout || ""));
  process.stderr.write(String(run.stderr || ""));
  if (run.status !== 0) {
    console.error("STANDALONE SUITE FAILED: " + SUITES[i] + " (exit " + run.status + ")");
    process.exit(1);
  }
}

console.log("ALL GREEN — " + SUITES.length + " standalone verifier suites");
