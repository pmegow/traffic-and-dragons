// A PARTY companion known under a working name ("the hooded man"), with a real attached sheet and a pinned voice,
// is revealed as "Aldern Foxglove" and merged (gated flow: proposed, armed, confirmed). The merge hands the sheet to
// the new row but leaves charSheet.name as the old name; _speakerVoiceSubject (game.js) then renames the lookup to the
// sheet's name and finds no row.
require("./h.js");
global.generateActions = function () {}; global.processPendingCompanionSheets = function () {};
function turn(resp) { return quiet(function () { return commitGmTurn(resp, { userMsg: "x", playerTxt: "go on", logPlayer: true }); }); }
function vmap(name) { return quiet(function () { return speakerVoiceMap({ n: 1, s: { 0: name } }, '"Hold there."'); }).r; }
makeWorld(); quiet(function () { sceneRefsEnsure(); });
turn('A hooded man falls in beside you. [NPC:the hooded man|wary|he/him] [PARTY_MEMBER:the hooded man|true] [SAY:the hooded man] "I walk with you," he says.');
var att = quiet(function () { return attachCompanionSheet("the hooded man", buildCompanionSheetStub("the hooded man")); }).r;
out("companion sheet attached (real attachCompanionSheet + stub)", !!att);
turn('He keeps pace. [SAY:the hooded man] "Keep your eyes on the ridge."');
var d = wsNpcByName("the hooded man");
out("before the merge: row pins / sheet pins", [pins(d), pins(d.charSheet)]);
out("before the merge: his line is read in", vmap("the hooded man"));
turn('He lowers the hood: Aldern Foxglove. [NPC:Aldern Foxglove|friendly|he/him] [NPC_MERGE:Aldern Foxglove|the hooded man]');
quiet(function () { return buildMergeConfirmNudge(); });
var r = turn('He smiles. [NPC_MERGE:Aldern Foxglove|the hooded man] [SAY:Aldern Foxglove] "Now, shall we talk?"');
var a = wsNpcByName("Aldern Foxglove");
out("after the merge: rows", worldState.npcs.map(function (n) { return n.name + (n.partyMember ? " (party)" : "") + " sheet.name=" + (n.charSheet ? JSON.stringify(n.charSheet.name) : "-"); }));
out("after the merge: row pins / sheet pins", [pins(a), a && pins(a.charSheet)]);
out("after the merge: _speakerVoiceSubject('Aldern Foxglove')", quiet(function () { return _speakerVoiceSubject("Aldern Foxglove"); }).r ? "resolved" : "null");
out("after the merge: Aldern's line is read in", vmap("Aldern Foxglove") || "(no speaker map -> the NARRATOR's voice)");
out("after the merge: an old line under 'the hooded man' replays in", vmap("the hooded man") || "(no speaker map -> the NARRATOR's voice)");
out("turn console", r.warns.filter(function (w) { return /speakers|merge/i.test(w); }));
