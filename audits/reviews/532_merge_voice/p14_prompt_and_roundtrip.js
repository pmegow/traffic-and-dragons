// Two "found clean" checks on the state the fixes create.
//  (a) the commit says the fill "writes nothing to memory, the transcript or any prompt": build the REAL system prompt for a
//      post-merge world, strip every voice field from every row and sheet, build it again, compare the bytes; and compare
//      memory before/after the voice-only part of a merge (a merge of the same world with the pins removed first).
//  (b) save/load: serializeWorldState -> parseWorldState, and the .tnd shape (JSON of {worldState,sessionLog,memory}).
//   node p14_prompt_and_roundtrip.js <before|after>
require("./h.js");
var F = ["voiceId", "speechifyVoiceId", "inworldVoiceId", "voiceDirection", "voiceRate"];
function row(name, pron) { memory.npcs[name] = { attitude: "wary", knowledge: ["Wears a grey hood."], events: [{ turn: 3, note: "Stopped the party." }], aliases: [], pronouns: pron }; var r = { name: name, status: "present", rel: "neutral", pronouns: pron, met: 1, partyMember: false, portrait: null, aliases: [] }; worldState.npcs.push(r); return r; }
function build(strip) {
  makeWorld(); worldState.npcs = []; memory.npcs = {};
  var d = row("the hooded man", "he/him"), c = row("Aldern Foxglove", "he/him");
  addComp("Bram", ["Shortsword"], { gender: "M", cls: "Warrior", level: 2, hp: 12, maxHp: 12, abilities: [], spells: [], relationships: [], stats: { STR: 12, DEX: 10, CON: 10, INT: 10, WIS: 10, CHA: 10 }, voiceId: "en_US-libritts_r-medium#7", speechifyVoiceId: "bram-actor", voiceDirection: "gruff", voiceRate: 0.9 });
  d.voiceId = "en_US-libritts_r-medium#123"; d.speechifyVoiceId = "heard-actor"; d.inworldVoiceId = "heard-inworld"; d.voiceDirection = "low, unhurried"; d.voiceRate = 0.9;
  if (strip === "pre") worldState.npcs.forEach(function (n) { F.forEach(function (f) { delete n[f]; if (n.charSheet) delete n.charSheet[f]; }); });
  var r = run("He lowers the hood. [NPC_MERGE:Aldern Foxglove|the hooded man]");
  if (strip === "post") worldState.npcs.forEach(function (n) { F.forEach(function (f) { delete n[f]; if (n.charSheet) delete n.charSheet[f]; }); });
  return r;
}
function prompt() { return quiet(function () { return buildSysPrompt(); }).r; }
function sysText(p) { return typeof p === "string" ? p : JSON.stringify(p); }

var r1 = build(null); var pins1 = pins(wsNpcByName("Aldern Foxglove")), mem1 = JSON.stringify(memory), muts1 = JSON.stringify(r1.muts), p1 = sysText(prompt());
build("post"); var p2 = sysText(prompt());
var r3 = build("pre"); var mem3 = JSON.stringify(memory), muts3 = JSON.stringify(r3.muts);
out("survivor row after the merge", pins1);
out("(a) system prompt with the carried voice fields vs with every voice field stripped", p1 === p2 ? "byte-identical (" + p1.length + " chars)" : "DIFFERENT");
// the merge's archived PRE-IMAGE (memory.archive.identityMerges[].records.ws, both trees) is a copy of the duplicate's row and
// so holds its pins; everything else in memory must be the same. Compare with the voice keys dropped from the JSON.
function noVoice(s) { return JSON.stringify(JSON.parse(s), function (k, v) { return F.indexOf(k) >= 0 ? undefined : v; }); }
out("(a) memory after a pinned merge vs the same merge with no pins anywhere", mem1 === mem3 ? "byte-identical" : (noVoice(mem1) === noVoice(mem3) ? "identical apart from the pins inside the archived pre-image of the duplicate's row" : "DIFFERENT beyond the pre-image"));
out("(a) the turn's summary lines, pinned vs unpinned", muts1 === muts3 ? "identical " + muts1 : "DIFFERENT " + muts1 + " vs " + muts3);

build(null);
var before = JSON.stringify(worldState.npcs);
worldState = parseWorldState(serializeWorldState());
out("(b) roster after serializeWorldState -> parseWorldState", JSON.stringify(worldState.npcs) === before ? "identical" : "DIFFERENT");
var tnd = JSON.parse(JSON.stringify({ worldState: worldState, sessionLog: sessionLog, memory: memory }));
out("(b) survivor row in the .tnd shape", pins(tnd.worldState.npcs.filter(function (n) { return n.name === "Aldern Foxglove"; })[0]));
var vm = quiet(function () { return speakerVoiceMap({ n: 1, s: { 0: "the hooded man" } }, "\"Hold there.\""); }).r;
out("(b) after the round trip an old line under 'the hooded man' is read with", vm);
