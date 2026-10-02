// Variants of the gated reveal (worldState.sceneRefs live), to bound finding 1.
//  B: the new name does NOT speak before the confirmed merge lands  -> the fix should carry the voice.
//  C: the GM never files [NPC:Aldern Foxglove] (no memory record)    -> does the merge ever land?
//  D: the confirmation arrives two turns late (armed turn missed)    -> does it land at all?
require("./h.js");
global.generateActions = function () {}; global.processPendingCompanionSheets = function () {};
function turn(resp) { return quiet(function () { return commitGmTurn(resp, { userMsg: "x", playerTxt: "go on", logPlayer: true }); }); }
function voiceOf(name) { var m = quiet(function () { return speakerVoiceMap({ n: 1, s: { 0: name } }, '"Hold there."'); }).r; return m ? m[0] : null; }
function rows() { return worldState.npcs.map(function (n) { return n.name + " " + JSON.stringify(pins(n)); }); }
function start() {
  makeWorld(); quiet(function () { sceneRefsEnsure(); });
  turn('A hooded man steps out of the alley mouth. [NPC:the hooded man|wary|he/him] [SAY:the hooded man] "Hold there," he says. "Not another step."');
  turn('The hooded man tilts his head. [SAY:the hooded man] "You are a long way from home."');
  return voiceOf("the hooded man");
}
var heard, note, now;

heard = start();
turn('He lowers the hood: Aldern Foxglove, the missing heir. [NPC:Aldern Foxglove|friendly|he/him] [NPC_MERGE:Aldern Foxglove|the hooded man]');
note = quiet(function () { return buildMergeConfirmNudge(); }).r;
turn('He smiles. [NPC_MERGE:Aldern Foxglove|the hooded man] [SAY:Aldern Foxglove] "Now, shall we talk?"');
now = voiceOf("Aldern Foxglove");
out("B (new name silent until the merge lands): rows", rows());
out("B: heard " + heard + ", now " + now, now === heard ? "CARRIED" : "LOST");

heard = start();
turn('He lowers the hood. [NPC_MERGE:Aldern Foxglove|the hooded man] [SAY:Aldern Foxglove] "Aldern Foxglove, at your service," he says.');
out("C turn 3: Aldern's line read in", voiceOf("Aldern Foxglove") || "(no speaker record -> narrator voice)");
note = quiet(function () { return buildMergeConfirmNudge(); }).r;
out("C: confirm note", note ? "fired" : "(none: the queued pair was discarded)");
turn('He smiles. [NPC_MERGE:Aldern Foxglove|the hooded man] [SAY:Aldern Foxglove] "Now, shall we talk?"');
out("C (no [NPC:] for the new name): rows", rows());
out("C: pendingMergeHints / mergeHintNudged", [worldState.pendingMergeHints || null, worldState.mergeHintNudged || null]);
now = voiceOf("Aldern Foxglove");
out("C: heard " + heard + ", now " + now, now === heard ? "CARRIED" : "LOST");

heard = start();
turn('He lowers the hood: Aldern Foxglove. [NPC:Aldern Foxglove|friendly|he/him] [NPC_MERGE:Aldern Foxglove|the hooded man]');
note = quiet(function () { return buildMergeConfirmNudge(); }).r;
turn('He waits for your answer.');
quiet(function () { return buildMergeConfirmNudge(); });
turn('He smiles. [NPC_MERGE:Aldern Foxglove|the hooded man] [SAY:Aldern Foxglove] "Now, shall we talk?"');
out("D (confirmation one turn late): rows", rows());
now = voiceOf("Aldern Foxglove");
out("D: heard " + heard + ", now " + now, now === heard ? "CARRIED" : "LOST");
