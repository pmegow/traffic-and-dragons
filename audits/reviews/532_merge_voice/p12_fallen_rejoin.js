// A third sheet-replace path with no voice handoff: mpFallPC parks a COPY of the sheet, mpRejoinFallen puts that copy back
// (game.js). Whatever was set on the live sheet in between (a voice picked on the card, a direction, a speed) is gone.
//   node p12_fallen_rejoin.js <before|after>
require("./h.js");
function vmap(name) { return quiet(function () { return speakerVoiceMap({ n: 1, s: { 0: name } }, "\"Hold there.\""); }).r; }
makeWorld();
addComp("Bram", [], { gender: "M", hp: 10, maxHp: 10, voiceId: "en_US-libritts_r-medium#7" });
out("mpFallPC", quiet(function () { return mpFallPC("Bram", "a fall"); }).r);
var s = wsNpcByName("Bram").charSheet;
s.speechifyVoiceId = "picked-while-fallen"; s.voiceDirection = "hoarse, tired"; s.voiceRate = 0.9;   // what the card writes (sheet||row)
out("set on his card while fallen", pins(s));
out("mpRejoinFallen", quiet(function () { return mpRejoinFallen(); }).r);
out("his sheet after he rejoins", pins(wsNpcByName("Bram").charSheet));
out("his next line is read with", vmap("Bram"));
