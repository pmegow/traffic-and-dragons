// Is the documented SOURCE ORDER of the merge fill ("its own row when this merge just gave it the duplicate's sheet, then the
// duplicate's sheet, then the duplicate's row") pinned by the three "#532" tests? This probe loads the AFTER engine with the
// order REVERSED in memory only (fs.readFileSync is wrapped for tag_table.js; no file is touched), runs copies of the three
// test bodies from dev/engine-tests.js section "#532", then runs cells where two sources disagree.
//   node p10_source_order.js after          -> the shipped order
//   node p10_source_order.js after reversed -> the reversed order
var fs = require("fs");
var REV = process.argv[3] === "reversed";
var FIND = "[_mgCanN.charSheet&&_mgCanN.charSheet===_mgDupN.charSheet?_mgCanN:null,_mgDupN.charSheet,_mgDupN]";
var REPL = "[_mgDupN,_mgDupN.charSheet,_mgCanN.charSheet&&_mgCanN.charSheet===_mgDupN.charSheet?_mgCanN:null]";
var real = fs.readFileSync, hits = 0;
if (REV) fs.readFileSync = function (p) {
  var t = real.apply(fs, arguments);
  if (/wt-rev[\\/]tag_table\.js$/.test(String(p)) && typeof t === "string") { if (t.split(FIND).length !== 2) throw new Error("anchor must match exactly once"); hits++; return t.replace(FIND, REPL); }
  return t;
};
require("./h.js");
fs.readFileSync = real;
out("engine", REV ? "source order REVERSED in memory (" + hits + " substitution)" : "as shipped");

// ---- fixtures and the three test bodies, copied from dev/engine-tests.js section "#532" (w503/on503 inlined) ----
function w503() { makeWorld(); worldState.turn = 78; worldState.npcs = []; memory.npcs = {}; }
function on503(key, pron) { memory.npcs[key] = { attitude: "", knowledge: [], events: [], aliases: [] }; worldState.npcs.push({ name: key, status: "present", rel: "neutral", pronouns: pron || null, met: 1, partyMember: false, portrait: null, aliases: [] }); if (pron) memory.npcs[key].pronouns = pron; }
function v532(name, p) { on503(name, "he/him"); var r = wsNpcByName(name), k; for (k in p) r[k] = p[k]; return r; }
function sheet532(name, p) { var s = { name: name, inventory: [], abilities: [] }, k; for (k in p) s[k] = p[k]; return s; }
function m532() { quiet(function () { applyMuts("He lowers the hood: Aldern Foxglove. [NPC_MERGE:Aldern Foxglove|the hooded man]"); }); var a = wsNpcByName("Aldern Foxglove"); return worldState.npcs.length === 1 && a ? a : null; }
var T = [
  ["#532 the repro", function () {
    w503(); on503("Aldern Foxglove", "he/him"); on503("the hooded man", "he/him");
    var oldAuto = TTS.autoCastVoiceId;
    try {
      TTS.autoCastVoiceId = function (ch) { return ch && ch.name === "the hooded man" ? "en_US-ryan-high" : "en_GB-alba-medium"; };
      if (!quiet(function () { return pinAutoCastVoices({ n: 1, s: { 0: "the hooded man" } }); }).r) return "fixture: his first line pins a voice";
      var row = wsNpcByName("the hooded man"), slots = TTS.characterVoiceSlots(), i;
      if (row.voiceId !== "en_US-ryan-high") return "fixture";
      for (i = 0; i < slots.length; i++) if (!row[slots[i].field]) row[slots[i].field] = "heard-" + slots[i].provider;
      row.voiceDirection = "low, unhurried"; row.voiceRate = 0.9;
      var a = m532(); if (!a) return "fixture: the merge must land";
      quiet(function () { pinAutoCastVoices({ n: 1, s: { 0: "Aldern Foxglove" } }); });
      if (a.voiceId !== "en_US-ryan-high") return "voice dropped";
      for (i = 0; i < slots.length; i++) if (slots[i].provider !== "piper" && a[slots[i].field] !== "heard-" + slots[i].provider) return "slot not carried";
      var vm = quiet(function () { return speakerVoiceMap({ n: 1, s: { 0: "the hooded man" } }, '"Hold there."'); }).r;
      if (!vm || vm[0] !== "en_US-ryan-high") return "replay";
      return a.voiceDirection === "low, unhurried" && a.voiceRate === 0.9 ? true : "direction/speed";
    } finally { TTS.autoCastVoiceId = oldAuto; }
  }],
  ["#532 the survivor's own pin always wins", function () {
    w503(); v532("Aldern Foxglove", { voiceId: "keep-me", voiceRate: 0.9 }); v532("the hooded man", { voiceId: "dupe-voice", speechifyVoiceId: "dupe-cloud", voiceRate: 1.3, voiceDirection: "dupe-direction" });
    var c = m532(); if (!c) return "fixture";
    if (c.voiceId !== "keep-me" || c.voiceRate !== 0.9) return "own overwritten";
    if (c.speechifyVoiceId !== "dupe-cloud" || c.voiceDirection !== "dupe-direction") return "blank not filled";
    w503(); v532("Aldern Foxglove", {}); v532("the hooded man", {});
    c = m532(); if (!c) return "fixture";
    var f = voicePinFields(), i;
    if (f.indexOf("voiceId") < 0 || f.indexOf("voiceDirection") < 0 || f.indexOf("voiceRate") < 0 || f.length !== TTS.characterVoiceSlots().length + 2) return "field list";
    for (i = 0; i < f.length; i++) if (f[i] in c) return "empty field written";
    return true;
  }],
  ["#532 a sheet owns its character's pins", function () {
    w503(); var s = v532("Aldern Foxglove", {}); s.charSheet = sheet532("Aldern Foxglove", { voiceId: "sheet-voice" }); v532("the hooded man", { voiceId: "dupe-voice", speechifyVoiceId: "dupe-cloud" });
    var c = m532(); if (!c) return "fixture";
    if (c.charSheet.voiceId !== "sheet-voice") return "sheet overwritten";
    if (c.charSheet.speechifyVoiceId !== "dupe-cloud") return "sheet blank not filled";
    if (c.voiceId || c.speechifyVoiceId) return "row took a pin";
    w503(); v532("Aldern Foxglove", { voiceId: "row-voice", inworldVoiceId: "row-inworld" }); var d = v532("the hooded man", {}); d.charSheet = sheet532("the hooded man", { voiceId: "companion-voice" });
    c = m532(); if (!c) return "fixture";
    if (!c.charSheet || c.charSheet.voiceId !== "companion-voice") return "adopted sheet lost its voice";
    if (c.charSheet.inworldVoiceId !== "row-inworld") return "own row pin did not fill";
    w503(); s = v532("Aldern Foxglove", {}); s.charSheet = sheet532("Aldern Foxglove", { voiceId: "sheet-voice" }); d = v532("the hooded man", {}); d.charSheet = sheet532("the hooded man", { voiceId: "other-sheet-voice", speechifyVoiceId: "other-sheet-cloud" });
    c = m532(); if (!c) return "fixture";
    return c.charSheet.voiceId === "sheet-voice" && c.charSheet.speechifyVoiceId === "other-sheet-cloud" ? true : "two sheets";
  }]
];
T.forEach(function (t) { var r; try { r = t[1](); } catch (e) { r = "THREW " + e.message; } out("test \"" + t[0] + "\"", r === true ? "PASS" : "FAIL: " + r); });

// ---- cells where two sources disagree (not in the suite) ----
w503(); v532("Aldern Foxglove", { voiceDirection: "from the survivor's own row" }); var d2 = v532("the hooded man", { voiceDirection: "from the duplicate's row" }); d2.charSheet = sheet532("the hooded man", { voiceId: "companion-voice" });
var c2 = m532();
out("own row vs duplicate's row (adopted sheet lacks the field): the sheet took", c2 && c2.charSheet.voiceDirection);
w503(); var s3 = v532("Aldern Foxglove", {}); s3.charSheet = sheet532("Aldern Foxglove", { voiceId: "sheet-voice" }); var d3 = v532("the hooded man", { speechifyVoiceId: "from the duplicate's row" }); d3.charSheet = sheet532("the hooded man", { speechifyVoiceId: "from the duplicate's sheet" });
var c3 = m532();
out("duplicate's sheet vs duplicate's row (two sheets): the survivor's sheet took", c3 && c3.charSheet.speechifyVoiceId);
