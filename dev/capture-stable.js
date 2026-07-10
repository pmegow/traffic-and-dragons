// capture-stable.js — DEV TOOL (UA1): render buildSysPrompt's STABLE half with a fixed world
// and write it to a file. Run BEFORE and AFTER the tag-table refactor; the two outputs must be
// byte-identical (the derived STATE TAGS block may not change the money-tested prompt by even
// one character at cutover). Usage: node dev/capture-stable.js <outfile>
var fs = require("fs"), path = require("path"), vm = require("vm");
var root = path.join(__dirname, "..");
var files = ["globals.js", "compress.js", "data.js", "capability_bible.js", "helpers.js", "state.js", "storage-adapter.js", "memory.js"];
// tag_table.js loads between memory.js and api.js once it exists (mirrors index.html / run-tests order)
if (fs.existsSync(path.join(root, "tag_table.js"))) files.push("tag_table.js");
files.push("api.js", "game.js");
var geval = eval;
files.forEach(function (f) { geval(fs.readFileSync(path.join(root, f), "utf8")); });

// Fixed world — mirrors the engine-tests makeWorld shape so both captures see identical inputs.
memory = blankMemory(); sessionLog = [];
worldState = { ver: 10, campId: "golden", campName: "Golden", legacyCharsUsed: [], pendingLegacy: null,
  character: { name: "Tess", gender: "F", age: "30", appear: "", mark: "", backstory: "", ancestry: "Human", subrace: "northlander", subraceNm: "Northlander", heritageVariant: "",
    cls: "Warrior", stats: { STR: 15, DEX: 12, CON: 14, INT: 10, WIS: 10, CHA: 10 }, hp: 14, maxHp: 14, gold: 25,
    inventory: ["Longsword", "Travel ration"], level: 1, xp: 0, abilities: [], spells: [{ nm: "Faerie Fire (racial, 1/day)", lvl: 1, used: false }],
    archetype: "", archetypeNm: "", statedAlignment: "True Neutral", actualAlignment: "True Neutral", alignLaw: 0, alignGood: 0, deity: "",
    trait: "", flaw: "", motivation: "", languages: [{ name: "Common", broken: false }], skills: initSkills(),
    conditions: [], relationships: [], saveModifiers: [], portrait: null, storyBeats: [], partyMember: true },
  world: { location: "Ashfen", region: "The Reach", time: "dusk", weather: "rain", threat: "low", sublocation: null },
  npcs: [], questLog: [], eventHistory: [], combat: null, turn: 5, transcript: [], ragMemory: false };

var s = buildSysPrompt();
var out = process.argv[2] || "dev/golden_stable.txt";
fs.writeFileSync(path.join(root, out), s.stable, "utf8");
console.log("stable half: " + s.stable.length + " chars -> " + out);
