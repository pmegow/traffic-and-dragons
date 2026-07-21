// load-engine.js — THE canonical ordered engine-file list, the global-scope loader, and the
// shared v10 test fixture (AUDIT_FABLE_07_16_2026 #18/#19/#21). DEV TOOL, node-only.
//
// Single source for the four node dev tools — run-tests.js, diff-replay.js, capture-stable.js,
// npc-merge-tool.js all require() this file instead of hand-copying the list (the #17 rot
// class: test.html's copy silently dropped 3 files and showed 55 false-red assertions).
//
// TWO DELIBERATE MANUAL COPIES REMAIN (browser pages can't require this file) — keep in step:
//   • test.html <script> tags — guarded there by a per-file typeof banner that names any
//     missing file loudly.
//   • dev/engine-tests.js makeWorld() — the browser-hosted twin of makeTestWorld() below.
//     ⚠ Known gap at time of writing (#19): engine-tests.js makeWorld is MISSING
//     character.coreMemories:[] (schema field since v1.304) — integrator should add it there.
//
// FILES is index.html's load order minus the DOM-wiring files (char-creation.js, ui.js,
// stt.js). Each engine file depends only on files earlier in the list.
var fs = require("fs"), path = require("path");
var ROOT = path.join(__dirname, "..");
var FILES = ["globals.js", "error-report.js", "compress.js", "data.js", "capability_bible.js", "helpers.js",
  "state.js", "storage-adapter.js", "memory.js", "clock.js", "tag_table.js", "api.js",
  "table-talk.js", "campaign_generator.js", "game.js", "tts.js", "sound.js"];

var geval = eval; // indirect eval → runs in global scope, so the engine's `var`s become node globals

// loadEngine([upTo]) — geval the canonical list in order. With no arg, loads all 13.
// upTo = a filename from FILES → loads up to AND INCLUDING it (e.g. "tag_table.js" for
// tools that don't need the api/game layer). Throws LOUDLY on a missing/unparseable file
// or an unknown upTo name — a silently shorter engine is exactly the failure class this
// file exists to kill (#21: capture-stable's old `if exists push tag_table` conditional).
function loadEngine(upTo) {
  var end = FILES.length;
  if (upTo) {
    end = FILES.indexOf(upTo);
    if (end < 0) throw new Error("loadEngine: '" + upTo + "' is not in the canonical engine list: " + FILES.join(", "));
    end += 1;
  }
  for (var i = 0; i < end; i++) {
    try { geval(fs.readFileSync(path.join(ROOT, FILES[i]), "utf8")); }
    catch (e) { throw new Error("ENGINE LOAD FAILED in " + FILES[i] + ": " + e.message); }
  }
  return FILES.slice(0, end);
}

// makeTestWorld([overrides]) — the shared v10 fixture (#19). Builds the engine-tests
// makeWorld/Tess shape (INCLUDING character.coreMemories:[], which the hand-copies had all
// dropped — schema field since v1.304), assigns the engine globals (memory, sessionLog,
// worldState), and returns worldState. Call loadEngine() first (needs blankMemory/initSkills).
//
// Merge semantics — SHALLOW, top-level only, kept simple and explicit: an overridden key
// replaces the base value WHOLESALE, `character` included. diff-replay.js relies on the
// wholesale character replace: its Vex fixture is the corpus campaign's FROZEN turn-0 shape
// (deliberately WITHOUT coreMemories — it must serialize byte-identically to the committed
// *.endstate.json files, which is the tool's entire cross-version evidence contract).
function makeTestWorld(overrides) {
  overrides = overrides || {};
  memory = blankMemory(); sessionLog = [];
  var ws = { ver: 10, campId: null, campName: "Test", legacyCharsUsed: [], pendingLegacy: null,
    character: { name: "Tess", gender: "F", age: "30", appear: "", mark: "", backstory: "", ancestry: "Human", subrace: "northlander", subraceNm: "Northlander", heritageVariant: "",
      cls: "Warrior", stats: { STR: 15, DEX: 12, CON: 14, INT: 10, WIS: 10, CHA: 10 }, hp: 14, maxHp: 14, gold: 25,
      inventory: ["Longsword", "Travel ration"], level: 1, xp: 0, abilities: [], spells: [{ nm: "Faerie Fire (racial, 1/day)", lvl: 1, used: false }],
      archetype: "", archetypeNm: "", statedAlignment: "True Neutral", actualAlignment: "True Neutral", alignLaw: 0, alignGood: 0, deity: "",
      trait: "", flaw: "", motivation: "", languages: [{ name: "Common", broken: false }], skills: initSkills(),
      conditions: [], relationships: [], saveModifiers: [], portrait: null, storyBeats: [], coreMemories: [], partyMember: true },
    world: { location: "Ashfen", region: "The Reach", time: "dusk", weather: "rain", threat: "low", sublocation: null },
    npcs: [], questLog: [], eventHistory: [], combat: null, turn: 5, transcript: [], ragMemory: false };
  Object.keys(overrides).forEach(function (k) { ws[k] = overrides[k]; });
  worldState = ws;
  return ws;
}

module.exports = { FILES: FILES, ROOT: ROOT, loadEngine: loadEngine, makeTestWorld: makeTestWorld };
