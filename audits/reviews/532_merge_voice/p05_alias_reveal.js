// The reveal written with NPC_ALIAS instead of NPC_MERGE: [NPC_ALIAS:Aldern Foxglove|the hooded man] when
// "the hooded man" already has a record and a pinned voice. The alias is shadowed by the exact key (resolveNpcName
// answers an exact key first), nothing folds, and the two names keep two voices.
require("./h.js");
global.generateActions = function () {}; global.processPendingCompanionSheets = function () {};
function turn(resp) { return quiet(function () { return commitGmTurn(resp, { userMsg: "x", playerTxt: "go on", logPlayer: true }); }); }
function voiceOf(name) { var m = quiet(function () { return speakerVoiceMap({ n: 1, s: { 0: name } }, '"Hold there."'); }).r; return m ? m[0] : null; }
function rows() { return worldState.npcs.map(function (n) { return n.name + " " + JSON.stringify(pins(n)); }); }
makeWorld(); quiet(function () { sceneRefsEnsure(); });
turn('A hooded man steps out of the alley mouth. [NPC:the hooded man|wary|he/him] [SAY:the hooded man] "Hold there," he says. "Not another step."');
turn('The hooded man tilts his head. [SAY:the hooded man] "You are a long way from home."');
var heard = voiceOf("the hooded man");
var r = turn('He lowers the hood. [NPC:Aldern Foxglove|friendly|he/him] [NPC_ALIAS:Aldern Foxglove|the hooded man] [SAY:Aldern Foxglove] "Aldern Foxglove, at your service," he says.');
out("alias turn: muts", (worldState.tagLog && worldState.tagLog.length) ? worldState.tagLog[worldState.tagLog.length - 1].muts || worldState.tagLog[worldState.tagLog.length - 1] : "(no tagLog)");
out("rows after the alias", rows());
out("resolveNpcName('the hooded man')", resolveNpcName("the hooded man"));
out("memory keys", Object.keys(memory.npcs));
out("Aldern's alias list", memory.npcs["Aldern Foxglove"] && memory.npcs["Aldern Foxglove"].aliases);
turn('He folds his arms. [SAY:Aldern Foxglove] "Well?"');
var now = voiceOf("Aldern Foxglove");
out("heard as the hooded man " + heard + "; Aldern now speaks in " + now, now === heard ? "CARRIED" : "LOST (two records, two voices)");
out("pendingMergeHints", worldState.pendingMergeHints || null);
