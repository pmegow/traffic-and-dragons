// p08 for the PRIMARY (cloud) slot: with a Speechify catalog loaded, a sexless stranger's actor is drawn from the whole
// catalog (pinAutoCastVoices -> TTS.assignCharacterVoices, gender "ANY"). Math.random is fixed so both trees draw alike.
//   node p08b_gender_carry_cloud.js <before|after>
require("./h.js");
global.generateActions = function () {}; global.processPendingCompanionSheets = function () {};
var S = TTS.settings, d = S.draft();
d.primary = "speechify"; d.keys.speechify = "fixture";
d.models.speechify.voices = [{ id: "actor-m1", label: "Actor M1", g: "M" }, { id: "actor-m2", label: "Actor M2", g: "M" }, { id: "actor-f1", label: "Actor F1", g: "F" }, { id: "actor-f2", label: "Actor F2", g: "F" }];
d.models.speechify.narrator = "actor-m1"; S.save(d);
var realRandom = Math.random; Math.random = function () { return 0.6; };
function turn(resp) { return quiet(function () { return commitGmTurn(resp, { userMsg: "x", playerTxt: "go on", logPlayer: true }); }); }
function vm(name) { return quiet(function () { return speakerVoiceMap({ n: 1, s: { 0: name } }, "\"Hold there.\""); }).r; }
function sex(id) { return /-f\d$/.test(id) ? "F" : (/-m\d$/.test(id) ? "M" : "?"); }
makeWorld(); quiet(function () { sceneRefsEnsure(); });
turn("A figure steps out of the alley mouth. [NPC:the hooded figure|wary|unknown] [SAY:the hooded figure] \"Hold there,\" the figure says. \"Not another step.\"");
turn("The figure tilts its head. [SAY:the hooded figure] \"You are a long way from home.\"");
var st = wsNpcByName("the hooded figure");
out("the stranger: pronouns / Speechify actor pinned at first speech", [st.pronouns || null, st.speechifyVoiceId, sex(st.speechifyVoiceId || "")]);
turn("He lowers the hood: Aldern Foxglove, the missing heir. [NPC:Aldern Foxglove|friendly|he/him] [NPC_MERGE:Aldern Foxglove|the hooded figure]");
quiet(function () { return buildMergeConfirmNudge(); });
turn("He smiles. [NPC_MERGE:Aldern Foxglove|the hooded figure] [SAY:Aldern Foxglove] \"Now, shall we talk?\"");
var a = wsNpcByName("Aldern Foxglove"), m = vm("Aldern Foxglove"), actor = m && m.providers && m.providers.speechify ? m.providers.speechify[0] : null;
out("Aldern (he/him): row", pins(a));
out("Aldern's line is sent to Speechify actor", actor + " (sex " + sex(actor || "") + ")");
out("TTS.castGenderMatches('M', that actor's sex)", TTS.castGenderMatches("M", sex(actor || "")));
Math.random = realRandom;
