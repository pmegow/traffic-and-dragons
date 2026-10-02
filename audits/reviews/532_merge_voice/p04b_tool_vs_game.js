// Same synthetic save, same merge, two hosts:
//   (1) the game's engine (tts.js loaded)                    -> applyMuts("[NPC_MERGE:...]") on p04_synthetic.tnd
//   (2) the offline tool's output (dev/npc-merge-tool.js)    -> p04_out_<tree>.tnd, written by p04 with the REAL tool
// then the survivor's next line with a Speechify catalog loaded (what pinAutoCastVoices does at speech time).
//   node p04b_tool_vs_game.js <before|after>
require("./h.js");
var fs = require("fs"), path = require("path");
var S = TTS.settings;
function catalog() { var d = S.draft(); d.primary = "speechify"; d.keys.speechify = "fixture"; d.models.speechify.voices = [{ id: "actor-m1", label: "Actor M1", g: "M" }, { id: "actor-m2", label: "Actor M2", g: "M" }, { id: "actor-f1", label: "Actor F1", g: "F" }]; d.models.speechify.narrator = "actor-f1"; S.save(d); }
function load(file) { var j = JSON.parse(fs.readFileSync(path.join(__dirname, file), "utf8")); worldState = j.worldState; memory = j.memory; sessionLog = j.sessionLog || []; }
function speakAs(name) { quiet(function () { pinAutoCastVoices({ n: 1, s: { 0: name } }); }); return quiet(function () { return speakerVoiceMap({ n: 1, s: { 0: name } }, "\"Hold there.\""); }).r; }
catalog();

load("p04_synthetic.tnd");
out("the duplicate was heard with", quiet(function () { return speakerVoiceMap({ n: 1, s: { 0: "the hooded man" } }, "\"Hold there.\""); }).r);

run("He lowers the hood. [NPC_MERGE:Aldern Foxglove|the hooded man]");
out("(1) merged IN THE GAME: survivor row", pins(wsNpcByName("Aldern Foxglove")));
out("(1) his next line is read with", speakAs("Aldern Foxglove"));

load("p04_out_" + WHICH + ".tnd");
out("(2) merged BY THE OFFLINE TOOL: survivor row", pins(wsNpcByName("Aldern Foxglove")));
out("(2) his next line is read with", speakAs("Aldern Foxglove"));
out("(2) survivor row after that line", pins(wsNpcByName("Aldern Foxglove")));
