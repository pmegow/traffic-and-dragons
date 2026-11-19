// run-standalone-suites.js — the standalone verifier fragments that do not fit inside
// engine-tests.js's shared global fixture. Kept as child processes so their fetch/storage
// stubs cannot contaminate each other or the main engine suite.
var cp = require("child_process");
var path = require("path");

var ROOT = path.join(__dirname, "..");
var SUITES = [
  "dev/tests-733-map-legacy-copy.js",
  "dev/tests-733-map-migration.js",
  "dev/tests-733-map-public.js",
  "dev/tests-744-map-public.js",
  "dev/tests-733-map-protocol.js",
  "dev/tests-733-map-exits.js",
  "dev/tests-733-map-extract.js",
  "dev/tests-733-map-discovery.js",
  "dev/tests-733-map-usage.js",
  "dev/tests-733-map-source.js",/* Public discovery receipts, commit-only authority, scoped locations, and checkpoint/reroll lifecycle. */
  "dev/tests-727-sunburst-portraits.js",
  "dev/tests-725-designer-drafts.js",
  "dev/tests-723-designer-acts.js",
  "dev/tests-724-designer-assistant.js",
  "dev/tests-730-designer-abilities.js",
  "dev/tests-722-silence-opening.js",
  "dev/tests-718-enemy-card.js",
  "dev/tests-769-site-sheets.js",/* #769: a site the party goes inside has its own sheet; #770: plain scenery is not a map feature */
  "dev/tests-771-ground.js",/* #771 P1: a place whose name does not say its ground is asked of the story, once, and drawn */
  "dev/tests-771-place-sheet.js",/* #771 P1: a place whose name says its ground is drawn, with its exits and features, from public facts */
  "dev/tests-771-region.js",/* #771 P3: the region — the ground alone from the seed, every visited world place set on it once, under fog */
  "dev/tests-771-sites.js",/* #771 P2: a cave is drawn as a site — nameless rock, the mouth back out, the story's things on its chambers; nesting and the trail */
  "dev/tests-768-receipt-written.js",/* #768: a receipt the reply wrote itself beside its map tag is not printed again */
  "dev/tests-777-campaign.js",/* audit 2026-11-19 (#777) section X: a model call that outlives its campaign writes nothing */
  "dev/tests-777-sync.js",/* audit 2026-11-19 (#777) section S: a sync answer belongs to the campaign posted; the cloud ahead mid-turn is a pause */
  "dev/tests-777-prompt.js",/* audit 2026-11-19 (#777) batch 4: what the prompt carries (P6-P12, K1, K2, H3) and what a campaign is built from (C1, C2, C13-C15) */
  "dev/tests-777-tags.js",/* audit 2026-11-19 (#777) sections T and P: the tag parser, durations, schedule bounds and the applyMuts boundary */
  "dev/tests-777-gates.js",/* audit 2026-11-19 (#777): the dev servers, the tracker gates over TODO_Atlas.md and the storage-key census */
  "dev/tests-776-item-kinds.js",/* #776: the story files a carried item under its obvious inventory section, once, by name */
  "dev/tests-772-console.js",/* #772: the console collects the popups; only an inventory change still pops */
  "dev/tests-767-no-narration-before-roll.js",/* #767: a roll the player's own action needs carries no narration; prose beside it waits for the dice */
  "dev/tests-766-directions.js",/* #766: the map asks for the directions it is owed; the GM is the author of a seen feature's bearing */
  "dev/tests-762-map-and-import.js",/* #762: the wizard's import skips the chooser; #763: one receipt per disclosure; #764: the marker's name; #765: ground by head noun */
  "dev/tests-760-creature-names.js",/* #760: the GM starts a listed creature under its bestiary name; #761: the wizard's Import character button */
  "dev/tests-759-dice-reveal.js",/* #759: the dice reveal the roll — no number before its die lands; the reply waits on the dice */
  "dev/tests-757-journey.js",/* #757: the journey — visited places and travelled ways from public facts; its sheet retired into the region (#771 P4) */
  "dev/tests-756-map-directions.js",/* #756: a place is not a feature of itself; the GM is asked for the directions the map owes */
  "dev/tests-754-damage-only.js",/* #754: the damage-only roll — a breath weapon has no d20 of the hero's */
  "dev/tests-752-field-fixes.js",/* #752: a plural foe name finds its bestiary entry; #753: the fallback suggestion knows a fight is open */
  "dev/tests-751-ability-uses.js",/* #751: limited ability uses — the recharge table, the two tags, rests and fights, the roll, the prompt, the panel */
  "dev/tests-743-forms.js",/* #743: two forms — the starting form, what each form shows, the label, the card, the blueprint doors */
  "dev/tests-684-atlas-engine.js",/* #684: the atlas engine — recipes, entry by exact name, the never-guess rule, We are here, drift, the fixture gate */
  "dev/tests-684-atlas.js",/* #684: the atlas — the TnD Maps pin, the one global, one seed one document, the load order */
  "dev/tests-678-reporter.js",
  "dev/tests-b56-report-isolation.js",
  "dev/tests-615-signup.js",
  "dev/tests-599-legacy-census.js",
  "dev/tests-542-admission-doors.js",
  "dev/tests-545-boundaries.js",
  "dev/tests-525-ending-pipeline.js",
  "dev/tests-525-adversarial.js",
  "dev/tests-581-stash-persistence.js",
  "dev/tests-603-capability-redraft.js",
  "dev/tests-609-contract-harness.js",
  "dev/tests-603-capability-review.js",
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
  "dev/tests-631-car-seam.js",
  "dev/tests-capture-prompt-heal.js",/* Thursday 2026-10-15: the prompt capture runs the game's load heal before it renders */
  "dev/tests-faq.js",/* #642: the player FAQ page renders TABLE_TALK_FAQ, escaped, with its two doors and the SW line */
  "dev/tests-633-companion-talk.js",/* #633: talk to your character — read-only, in their own voice, through the hear row; the engine pin *//* #631: the Car Mode seam — car-commands/car-session/audio-session name nothing outside themselves; CAR_HOST matches CAR_HOST_ROWS */
  "dev/tests-652-pre-push.js",/* #652: the pre-push runs every Chrome-driven suite — the derived list, red on one failure, loud without Chrome, parity requires the installed hook */
  "dev/tests-646-ci-status.js",/* #646: the CI verdict at session start — the real six-day red, unknown never green, session-check relays it */
  "dev/tests-651-qa-activity.js",/* #651: the QA Agent Activity section — the parser lifted out of bug_tracker.html by its markers, run over the real DOC/QA_ACTIVITY.md and hostile shapes */
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
  "dev/tests-674-release-notes.js",
  "dev/tests-675-invitations.js",
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
  "dev/tests-621-portrait-vision.js",
  "dev/tests-622-tts-gateway.js",/* #622: a keyless signed-in player's Speechify rides the T&D server; own keys win; the picker lists reachable readers */
  "dev/tests-625-stt-gateway.js",/* #625: a keyless signed-in player's dictation rides the T&D server; an own key wins; account refusals end the attempt */
  "dev/tests-418-schedule-retire.js",/* #418: ONE schedule-and-retire for every decoded buffer — the three read loops share it */
  "dev/tests-419-vad-context.js",/* #419: the STT analyser rides sound.js's one AudioContext; the fallback is one lazy context per page */
  "dev/tests-41f-gemini-model-ladder.js",
  "dev/tests-233-tts-body-deadlines.js",
  "dev/tests-401-voice-settings.js",
  "dev/tests-404-voice-registry.js",
  "dev/tests-404-voice-catalog.js",
  "dev/tests-404-voice-resources.js",
  "dev/tests-402-character-voices.js",
  "dev/tests-467-openai-voice-retired.js",
  "dev/tests-234-stt-upload-generation.js",
  "dev/tests-287-stt-autosend.js",
  "dev/tests-603-capability-renames.js",
  "dev/tests-603-capability-application.js",
  "dev/tests-221-rename-capability.js",
  "dev/tests-221-capability-names.js",
  "dev/tests-221-names-store.js",
  "dev/tests-306-harness-picker.js",
  "dev/tests-playtest-server-mode.js",/* a signed-in playtest never wipes storage, starts only a harness-named campaign, and deletes only that one (owner 2026-09-30) */
  "dev/tests-250-browser-io.js",
  "dev/tests-437-summary.js",
  "dev/tests-438-folder-rename.js",
  "dev/tests-481-f1-campaign-folders.js",
  "dev/tests-439-designer-incoming.js",
  "dev/tests-440-render-job.js",
  "dev/tests-528-portrait-boundaries.js",
  "dev/tests-528-levelup-integration.js",
  "dev/tests-443-campaign-delete.js",
  "dev/tests-449-boot-reconcile-row.js",
  "dev/tests-453-npc-portrait.js",
  "dev/tests-456-inworld-character.js",
  "dev/tests-459-register-gate.js",
  "dev/tests-481-c7-record-names.js",
  "dev/tests-481-e4-campaign-switch.js",/* #481 E4: a campaign switch stops the read; the replay is keyed by campaign *//* #481 C7: canonical names are not the register; deferral past the cap */
  "dev/tests-481-e6-voice-caps.js",/* #481 E6: a voice control shows, splits and rides only where the reader honours it */
  "dev/tests-629-character-voice.js",/* #629: ONE character voice control (ui-character-voice.js) hosted by the sheet and the wizard */
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
  "dev/tests-modal-shell.js",
  "dev/tests-docs-only.js",/* a documentation-only commit skips the engine suite in the hook, and only such a commit; any doubt runs it */
  "dev/tests-prove-before-push.js",/* the local proof before a push: the scan, the replays, the range's own batteries; the sweep is CI's and cannot be hidden */
  "dev/tests-suite-shards.js",/* one long suite split across processes runs every group once; a split that ran less is red with the reason */
  "dev/tests-standalone-runner.js"/* this runner itself: several at a time, output whole and in list order, one failure fails the run */
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

// SEVERAL AT A TIME (2026-11-18). Run one after another the 167 suites cost 129 s of every commit's 139 s; each is its
// own process with its own fixtures, so they run side by side. What stays as it was: every suite runs to its own exit
// code, a suite's output is printed whole and in LIST order (never interleaved), and one failure fails the run. What
// changed: after a failure no new suite starts, the ones already running finish, and every failure is named.
//   --jobs=N or STANDALONE_JOBS=N   how many at once (default: half the cores, at most 8; 1 = one after another)
//   STANDALONE_TIMES=1              print each suite's seconds, slowest first, after the verdict
function jobCount(argv, env) {
  var asked = null;
  argv.forEach(function (a) { var m = /^--jobs=(\d+)$/.exec(a); if (m) asked = Number(m[1]); else throw new Error("unknown argument: " + a); });
  if (asked === null && env.STANDALONE_JOBS) {
    if (!/^\d+$/.test(env.STANDALONE_JOBS)) throw new Error("STANDALONE_JOBS is not a number: " + env.STANDALONE_JOBS);
    asked = Number(env.STANDALONE_JOBS);
  }
  if (asked === null) asked = Math.min(8, Math.max(1, Math.floor(require("os").cpus().length / 2)));
  if (asked < 1) throw new Error("jobs must be at least 1");
  return asked;
}

// The suites that take longest START first (the order of the PRINT stays the list's): the run can be no shorter than
// its longest suite, so that one must not wait behind the others. A name here that is not in the list is refused.
var START_FIRST = ["dev/tests-754-damage-only.js", "dev/tests-684-atlas-engine.js", "dev/tests-633-companion-talk.js",
  "dev/tests-sabotage-meta.js", "dev/tests-252-retained-proof-wiring.js", "dev/tests-jp011-flush-dirty.js"];
function startOrder(suites, first) {
  var order = first.map(function (n) { var i = suites.indexOf(n); if (i < 0) throw new Error("START_FIRST names a suite that is not in the list: " + n); return i; });
  suites.forEach(function (n, i) { if (order.indexOf(i) < 0) order.push(i); });
  return order;
}

function runAll(suites, jobs, done, first) {
  var order = startOrder(suites, first || []);
  var results = new Array(suites.length), next = 0, running = 0, printed = 0, failed = [];
  // flush — print what has ended, in list order, stopping at a suite still to end. At the END (all) a suite that
  // never started is stepped over, so one that ran after it is still printed.
  function flush(all) {
    for (; printed < suites.length && (results[printed] || all); printed++) {
      if (!results[printed]) continue;
      process.stdout.write(results[printed].out);
      process.stderr.write(results[printed].err);
      if (results[printed].status !== 0) console.error("STANDALONE SUITE FAILED: " + suites[printed] + " (exit " + results[printed].status + ")");
    }
  }
  function finish(i, r) {
    results[i] = r;
    if (r.status !== 0) failed.push(suites[i]);
    running--;
    flush();
    pump();
  }
  function start(i) {
    var t0 = Date.now(), out = [], err = [], over = false;
    function end(status) { if (over) return; over = true; finish(i, { out: out.join(""), err: err.join(""), status: status, ms: Date.now() - t0 }); }
    var child = cp.spawn(process.execPath, [suites[i]], { cwd: ROOT, env: childEnv });
    child.stdout.setEncoding("utf8"); child.stderr.setEncoding("utf8");
    child.stdout.on("data", function (d) { out.push(d); });
    child.stderr.on("data", function (d) { err.push(d); });
    child.on("error", function (e) { err.push("could not start " + suites[i] + ": " + e.message + "\n"); end(-1); });
    child.on("close", function (code, signal) { end(code === null ? "signal " + signal : code); });
  }
  function pump() {
    while (running < jobs && next < order.length && !failed.length) { running++; start(order[next++]); }
    if (running) return;
    flush(true);
    failed.sort(function (x, y) { return suites.indexOf(x) - suites.indexOf(y); });
    done(results, failed);
  }
  pump();
}

// main — the command line over a list: exit 0 all green, 1 on any failure (each named), 2 on a bad argument.
function main(suites, first, argv, env) {
  var jobs;
  try { jobs = jobCount(argv, env); }
  catch (e) { console.error("run-standalone-suites: " + e.message); process.exit(2); }
  runAll(suites, jobs, function (results, failed) {
    if (env.STANDALONE_TIMES) {
      results.map(function (r, i) { return { name: suites[i], ms: r ? r.ms : -1 }; }).filter(function (r) { return r.ms >= 0; })
        .sort(function (x, y) { return y.ms - x.ms; })
        .forEach(function (r) { console.log((r.ms / 1000).toFixed(1) + "s  " + r.name); });
    }
    if (failed.length) {
      var notRun = 0;
      for (var i = 0; i < suites.length; i++) if (!results[i]) notRun++;   /* a loop: filter() steps over a slot never filled */
      console.error("STANDALONE SUITES RED — " + failed.length + " failed: " + failed.join(", ") + (notRun ? " (" + notRun + " not run)" : ""));
      process.exit(1);
    }
    console.log("ALL GREEN — " + suites.length + " standalone verifier suites");
  }, first);
}

if (require.main === module) main(SUITES, START_FIRST, process.argv.slice(2), process.env);
module.exports = { SUITES: SUITES, START_FIRST: START_FIRST, jobCount: jobCount, runAll: runAll, startOrder: startOrder, main: main };
