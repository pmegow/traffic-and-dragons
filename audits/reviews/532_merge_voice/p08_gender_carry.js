// Wrong-winner check: a stranger whose sex is not yet known is auto-cast from the WHOLE bank (gender "ANY"). When the
// merge names him as a man, AFTER carries that pin onto the survivor. The owner's rule in tts.js (castGenderMatches:
// "M and F match exactly") is what BEFORE's re-cast followed.
require("./h.js"); require("./ui.js");
global.generateActions = function () {}; global.processPendingCompanionSheets = function () {};
function turn(resp) { return quiet(function () { return commitGmTurn(resp, { userMsg: "x", playerTxt: "go on", logPlayer: true }); }); }
function voiceOf(name) { var m = quiet(function () { return speakerVoiceMap({ n: 1, s: { 0: name } }, '"Hold there."'); }).r; return m ? m[0] : null; }
function gOf(id) { var st = TTS.starsList(), i; for (i = 0; i < st.length; i++) if (st[i].id === id) return st[i].g; return "?"; }
var names = ["the hooded figure", "the cloaked figure", "the masked stranger", "the veiled stranger", "a shadowed figure", "the grey pilgrim", "the stranger in the doorway", "the ferryman", "the masked rider", "the figure in the cowl"];
var tally = { M: 0, F: 0, other: 0 }, pick = null;
names.forEach(function (nm) { var v = TTS.autoCastVoiceId({ name: nm, gender: "ANY", pronouns: "" }), g = gOf(v); if (g === "M") tally.M++; else if (g === "F") tally.F++; else tally.other++; if (!pick && g === "F") pick = nm; });
out("10 sexless working names auto-cast from the whole bank: voice sex tally", tally);
out("working name used", pick);

makeWorld(); quiet(function () { sceneRefsEnsure(); });
turn('A figure steps out of the alley mouth. [NPC:' + pick + '|wary|unknown] [SAY:' + pick + '] "Hold there," the figure says. "Not another step."');
turn('The figure tilts its head. [SAY:' + pick + '] "You are a long way from home."');
var d = wsNpcByName(pick);
out("the stranger's record: pronouns / pinned voice / that voice's sex", [d.pronouns || null, d.voiceId, gOf(d.voiceId)]);
turn('He lowers the hood: Aldern Foxglove, the missing heir. [NPC:Aldern Foxglove|friendly|he/him] [NPC_MERGE:Aldern Foxglove|' + pick + ']');
quiet(function () { return buildMergeConfirmNudge(); });
turn('He smiles. [NPC_MERGE:Aldern Foxglove|' + pick + '] [SAY:Aldern Foxglove] "Now, shall we talk?"');
var a = wsNpcByName("Aldern Foxglove"), v = voiceOf("Aldern Foxglove");
out("rows", worldState.npcs.map(function (n) { return n.name + " " + n.pronouns + " " + JSON.stringify(pins(n)); }));
out("Aldern (he/him) now speaks in", v + " (sex of that voice: " + gOf(v) + ")");
out("TTS.castGenderMatches('M', that voice)", TTS.castGenderMatches("M", gOf(v)));
var sub = quiet(function () { return _speakerVoiceSubject("Aldern Foxglove"); }).r;
out("his card's backup picker lists the pin as", /Saved voice \(not listed\)/.test(csBackupVoiceOptions(sub.char)) ? "'Saved voice (not listed)' (outside his own filtered list)" : "a listed actor");
