// Provisional records (key contains " °t<turn>"): how the voice behaves through both decisions of the collision note.
//  SAME person:      [NPC_MERGE:Savah|Savah °tN]     (allowed at once by the gate)
//  DIFFERENT person: [MERGE:npc|Marta Vell|Savah °tN] (the note's own instruction)
require("./h.js");
global.generateActions = function () {}; global.processPendingCompanionSheets = function () {};
function turn(resp) { return quiet(function () { return commitGmTurn(resp, { userMsg: "x", playerTxt: "go on", logPlayer: true }); }); }
function voiceOf(name) { var m = quiet(function () { return speakerVoiceMap({ n: 1, s: { 0: name } }, '"Hold there."'); }).r; return m ? m[0] : null; }
function rows() { return worldState.npcs.map(function (n) { return n.name + " " + JSON.stringify(pins(n)); }); }
function start() {
  makeWorld(); quiet(function () { sceneRefsEnsure(); });
  turn('The armorer looks up. [NPC:Savah|gruff|she/her] [NPC_NOTE:Savah|Runs the armory in Ashfen] [NPC_NOTE:Savah|Owes the party a favour] [SAY:Savah] "What do you want?" she asks.');
  turn('Savah wipes her hands. [NPC_NOTE:Savah|Lost a brother at the ford] [SAY:Savah] "Come back tomorrow."');
  var r = turn('A stranger at the gate gives her name as Savah. [NPC:Savah|nervous|unknown, not yet met] [SAY:Savah] "I am looking for work," she says.');
  var prov = Object.keys(memory.npcs).filter(function (k) { return npcIsProvisional(k); })[0] || null;
  return { prov: prov, muts: (worldState.tagLog[worldState.tagLog.length - 1] || {}).m };
}
var s = start();
out("provisional key", s.prov); out("that turn's summary", s.muts); out("rows", rows());
out("established Savah's voice", voiceOf("Savah"));
if (s.prov) {
  // the player gives the newcomer her own voice on her card (the card is given the roster row when there is no sheet)
  var p = wsNpcByName(s.prov); if (p) { p.voiceId = "en_US-libritts_r-medium#9"; p.voiceDirection = "quick, nervous"; }
  out("provisional row exists / pins set on her card", [!!p, pins(p)]);
  var keep = JSON.stringify([JSON.parse(JSON.stringify(worldState)), JSON.parse(JSON.stringify(memory))]);
  var r1 = turn('It is the armorer after all. [NPC_MERGE:Savah|' + s.prov + '] [SAY:Savah] "You again."');
  out("SAME person: summary", (worldState.tagLog[worldState.tagLog.length - 1] || {}).m);
  out("SAME person: rows", rows());
  var st = JSON.parse(keep); worldState = st[0]; memory = st[1];
  var r2 = turn('She is someone else entirely: Marta Vell. [MERGE:npc|Marta Vell|' + s.prov + '] [SAY:Marta Vell] "I only want work."');
  out("DIFFERENT person: summary", (worldState.tagLog[worldState.tagLog.length - 1] || {}).m);
  out("DIFFERENT person: console", r2.warns.filter(function (w) { return /merge|identity/i.test(w); }));
  out("DIFFERENT person: rows", rows());
  var note = quiet(function () { return buildMergeConfirmNudge(); }).r;
  out("DIFFERENT person: confirm note next turn", note ? "fired" : "(none: the proposed pair was discarded, 'Marta Vell' has no record)");
  out("DIFFERENT person: Marta's line is read in", voiceOf("Marta Vell") || "(no speaker record -> narrator voice)");
}
