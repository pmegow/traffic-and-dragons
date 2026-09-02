// run-standalone-suites.js — the standalone verifier fragments that do not fit inside
// engine-tests.js's shared global fixture. Kept as child processes so their fetch/storage
// stubs cannot contaminate each other or the main engine suite.
var cp = require("child_process");
var path = require("path");

var ROOT = path.join(__dirname, "..");
var SUITES = [
  "dev/tests-b9-transport.js",
  "dev/tests-jp011-flush-dirty.js",
  "dev/tests-c13-adapter.js",
  "dev/tests-29-callgm-transport.js",
  "dev/tests-41f-gemini-model-ladder.js",
  "dev/tests-233-tts-body-deadlines.js",
  "dev/tests-234-stt-upload-generation.js",
  "dev/tests-287-stt-autosend.js",
  "dev/tests-221-rename-capability.js",
  "dev/tests-250-browser-io.js",
  "dev/tests-dedup-a.js",
  "dev/tests-160-portrait-builder.js",
  "dev/tests-5-story-compiler.js",
  "dev/tests-195-server-probe.js",
  "dev/tests-280b-actions-sync.js",
  "dev/tests-252-retained-proof-wiring.js",
  "dev/tests-latch-census.js",
  "dev/tests-frozen-golden.js",
  "dev/tests-226-fixture.js",
  "dev/tests-verification-enforcement.js",
  "dev/tests-sabotage-meta.js",
  "dev/tests-file-forensics.js",
  "dev/tests-install-bible.js",
  "dev/tests-bible-editor-launcher.js"
];

// TODO #27 class, second instance (2026-08-15): git exports repo-location env (GIT_DIR,
// GIT_INDEX_FILE, ...) into pre-commit hook environments — pathspec commits export an
// absolute GIT_DIR + temp GIT_INDEX_FILE, which redirected tests-file-forensics' fixture
// git calls into the MAIN repo and killed the suite deterministically (green in isolation,
// red under the gate). Standalone suites are self-contained verifiers with their own
// fixture repos; none may inherit the caller's repo location. Scrubbing here covers all
// suites AND their child processes (env inherits down).
var SCRUB = ["GIT_DIR", "GIT_WORK_TREE", "GIT_INDEX_FILE", "GIT_COMMON_DIR",
  "GIT_OBJECT_DIRECTORY", "GIT_ALTERNATE_OBJECT_DIRECTORIES", "GIT_PREFIX"];
var childEnv = Object.assign({}, process.env);
SCRUB.forEach(function (k) { delete childEnv[k]; });

for (var i = 0; i < SUITES.length; i++) {
  var run = cp.spawnSync(process.execPath, [SUITES[i]], { cwd: ROOT, encoding: "utf8", env: childEnv });
  process.stdout.write(String(run.stdout || ""));
  process.stderr.write(String(run.stderr || ""));
  if (run.status !== 0) {
    console.error("STANDALONE SUITE FAILED: " + SUITES[i] + " (exit " + run.status + ")");
    process.exit(1);
  }
}

console.log("ALL GREEN — " + SUITES.length + " standalone verifier suites");
