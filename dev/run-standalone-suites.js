// run-standalone-suites.js — the standalone verifier fragments that do not fit inside
// engine-tests.js's shared global fixture. Kept as child processes so their fetch/storage
// stubs cannot contaminate each other or the main engine suite.
var cp = require("child_process");
var path = require("path");

var ROOT = path.join(__dirname, "..");
var SUITES = [
  "dev/tests-designer-prose.js",
  "dev/tests-designer-creatures.js",
  "dev/tests-blueprint-models.js",
  "dev/tests-todo-columns.js",
  "dev/tests-es5-check.js",
  "dev/tests-blueprint-editions.js",
  "dev/tests-blueprint-catalog-cache.js",
  "dev/tests-19-audio-session.js",
  "dev/tests-19b-carmode-transport.js",
  "dev/tests-19c-car-scene-brief.js",
  "dev/tests-general-audio.js",
  "dev/tests-audio-cache.js",
  "dev/tests-accent-layer.js",
  "dev/tests-audio-envelope.js",
  "dev/tests-502-ambience-insecure-page.js",
  "dev/tests-516-deferred-queue.js",
  "dev/tests-l7-ambient.js",
  "dev/tests-l7-transitions.js",
  "dev/tests-23-onboarding.js",
  "dev/tests-23-ui.js",
  "dev/tests-291-mementos.js",
  "dev/tests-292-admin-console.js",
  "dev/tests-b9-transport.js",
  "dev/tests-jp011-flush-dirty.js",
  "dev/tests-423-import-ownership.js",
  "dev/tests-429-inventory-drop.js",
  "dev/tests-430-ledger-rows-live.js",
  "dev/tests-435-item-card-define.js",
  "dev/tests-372-register-reach.js",
  "dev/tests-b38-extractor-refusal.js",
  "dev/tests-b39-resume-observed.js",
  "dev/tests-c13-adapter.js",
  "dev/tests-29-callgm-transport.js",
  "dev/tests-41f-gemini-model-ladder.js",
  "dev/tests-233-tts-body-deadlines.js",
  "dev/tests-401-voice-settings.js",
  "dev/tests-402-character-voices.js",
  "dev/tests-467-openai-voice-retired.js",
  "dev/tests-234-stt-upload-generation.js",
  "dev/tests-287-stt-autosend.js",
  "dev/tests-221-rename-capability.js",
  "dev/tests-221-capability-names.js",
  "dev/tests-306-harness-picker.js",
  "dev/tests-playtest-server-mode.js",/* a signed-in playtest never wipes storage, starts only a harness-named campaign, and deletes only that one (owner 2026-09-30) */
  "dev/tests-250-browser-io.js",
  "dev/tests-438-folder-rename.js",
  "dev/tests-481-f1-campaign-folders.js",
  "dev/tests-439-designer-incoming.js",
  "dev/tests-440-render-job.js",
  "dev/tests-443-campaign-delete.js",
  "dev/tests-449-boot-reconcile-row.js",
  "dev/tests-453-npc-portrait.js",
  "dev/tests-456-inworld-character.js",
  "dev/tests-459-register-gate.js",
  "dev/tests-481-c7-record-names.js",
  "dev/tests-481-e4-campaign-switch.js",/* #481 E4: a campaign switch stops the read; the replay is keyed by campaign *//* #481 C7: canonical names are not the register; deferral past the cap */
  "dev/tests-481-e6-voice-caps.js",/* #481 E6: a voice control shows, splits and rides only where the reader honours it */
  "dev/tests-484-earcon-pause.js",/* #484: an earcon never resumes a paused read's context */
  "dev/tests-489-ability-sections.js",/* #489: the sheet's ability list is grouped under Racial / Class / Archetype / Story */
  "dev/tests-481-f3-focus-behind-dialog.js",/* #481 F3: focus never lands on the story box behind an open dialog (microtask observer model) */
  "dev/tests-481-f10-signed-out.js",/* #481 F10: a signed-out village entry says the library refresh was skipped, once per load */
  "dev/tests-481-f11-start-refused.js",/* #481 F11: a refused reset never consumes the Home pick */
  "dev/tests-481-f9-deleted-elsewhere.js",/* #481 F9: a campaign deleted on another device asks before it is uploaded again */
  "dev/tests-481-f5-library-slug.js",/* #481 F5: one library slug with the server (vendored; hash-pinned) */
  "dev/tests-481-g2-ci-range.js",/* #481 G2: CI checks every commit of a push, over ONE range */
  "dev/tests-481-g6-ci-topology.js",/* #481 G6: the newer CI steps, the weekly job and the identity tripwire are pinned */
  "dev/tests-481-g4-row-ids.js",/* #481 G4: a TODO row id is used once across TODO.md and the archive (explicit grandfather list) */
  "dev/tests-481-g7-archive-moves.js",/* #481 G7: an archive move is byte-identical; letter ids meet the row cap */
  "dev/tests-481-g3-todo-viewer.js",/* #481 G3: the TODO viewer is truly read-only (the browser half: tests-481-g3-todo-viewer-browser.js) */
  "dev/tests-481-g8-doc-links.js",/* #481 G8: every relative link in the live contract docs lands */
  "dev/tests-481-g9-doc-facts.js",/* #481 G9: CLAUDE.md's load order is index.html's; its prose facts stay corrected */
  "dev/tests-481-g5-class-guards.js",/* #481 G5: waits tick, pages share the palette and are network-first — derived from the source (browser half: tests-481-g5-waits-browser.js) */
  "dev/tests-481-g5-helper-waits.js",/* #481 G5 follow-up (owner ruling 2026-09-30): the story's thinking markers and Car Mode's waiting statuses count seconds */
  "dev/tests-441-home-handoff.js",
  "dev/tests-442-modal-focus.js",
  "dev/tests-336-campaign-root.js",
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
  "dev/tests-bible-editor-launcher.js",
  "dev/tests-audit-sync.js",
  "dev/tests-audit-ui.js",
  "dev/tests-audit-voice.js",
  "dev/tests-dedup-b.js",
  "dev/tests-modal-shell.js"
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
