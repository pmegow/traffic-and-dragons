// The #532 repro as REAL PLAY runs it: worldState.sceneRefs exists (every owner campaign has it), so a merge is
// first PROPOSED (w2MergeAllowed false), then confirmed on a later turn through buildMergeConfirmNudge.
// Driven through the real commitGmTurn (applyMuts -> deriveAndStampSpeakers -> pinAutoCastVoices) in turn order.
require("./h.js");
function turn(resp) { return quiet(function () { return commitGmTurn(resp, { userMsg: "x", playerTxt: "go on", logPlayer: true }); }); }
function voiceOf(name) { var m = quiet(function () { return speakerVoiceMap({ n: 1, s: { 0: name } }, '"Hold there."'); }).r; return m ? m[0] : null; }
function lastSp() { var t = worldState.transcript, i; for (i = t.length - 1; i >= 0; i--) if (t[i].sp) return t[i].sp; return null; }
global.generateActions = function () {}; global.processPendingCompanionSheets = function () {};
makeWorld(); quiet(function () { sceneRefsEnsure(); });
out("W2 gate live (worldState.sceneRefs)", !!worldState.sceneRefs);

// Turns 1-3: the stranger speaks under his working name. His voice is pinned on the roster row at first speech.
turn('A hooded man steps out of the alley mouth. [NPC:the hooded man|wary|he/him] [SAY:the hooded man] "Hold there," he says. "Not another step."');
turn('He does not move. [SAY:the hooded man] "I said hold."');
turn('The hooded man tilts his head. [SAY:the hooded man] "You are a long way from home."');
var hooded = wsNpcByName("the hooded man");
out("after 3 turns: 'the hooded man' row pins", pins(hooded));
var heard = voiceOf("the hooded man");
out("the voice the player has heard for 3 turns", heard);

// Turn 4: the reveal. The GM files the real name, speaks under it, and emits the merge.
var r4 = turn('He lowers the hood. [NPC:Aldern Foxglove|friendly|he/him] [NPC_MERGE:Aldern Foxglove|the hooded man] [SAY:Aldern Foxglove] "Aldern Foxglove, at your service," he says.');
out("turn 4 console (merge gate)", r4.warns.filter(function (w) { return /merge/i.test(w); }));
out("turn 4: rows", worldState.npcs.map(function (n) { return n.name + " " + JSON.stringify(pins(n)); }));
out("turn 4: speaker stamped", lastSp());
out("turn 4: pendingMergeHints", worldState.pendingMergeHints || null);
out("turn 4: Aldern's line was read in", voiceOf("Aldern Foxglove"));

// The next prompt build arms the confirmation (buildSysPrompt calls this builder); the GM confirms on turn 5.
var note = quiet(function () { return buildMergeConfirmNudge(); }).r;
out("engine note fired", note ? note.slice(0, 120) + "..." : "(none)");
out("mergeConfirmArmed", worldState.mergeConfirmArmed || null);
var r5 = turn('He smiles. [NPC_MERGE:Aldern Foxglove|the hooded man] [SAY:Aldern Foxglove] "Now, shall we talk?"');
out("turn 5 console (speakers/merge)", r5.warns.filter(function (w) { return /merge|speakers/i.test(w); }));
out("turn 5: rows", worldState.npcs.map(function (n) { return n.name + " " + JSON.stringify(pins(n)); }));
var now = voiceOf("Aldern Foxglove");
out("turn 5: Aldern's line is read in", now);
out("an old line stored under 'the hooded man' now replays in", voiceOf("the hooded man"));
out("VERDICT: the survivor speaks in the voice heard for three turns as 'the hooded man'", now === heard ? "YES" : "NO (heard " + heard + ", now " + now + ")");
