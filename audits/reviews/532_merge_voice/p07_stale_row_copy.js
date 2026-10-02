// The merge is a THIRD path that hands a row a sheet (besides attachCompanionSheet and generateNpcSheet), and it does not
// call releaseRowVoicePins: the canonical row keeps its copies beside the adopted sheet. #539's handoff then reads the row
// for any field the earlier sheet lacks, so a direction the player CLEARED on the card comes back when the sheet is regenerated.
require("./h.js"); require("./ui.js");
function row(name, pron) { memory.npcs[name] = { attitude: "", knowledge: [], events: [], aliases: [], pronouns: pron }; var r = { name: name, status: "present", rel: "neutral", pronouns: pron, met: 1, partyMember: false, portrait: null, aliases: [] }; worldState.npcs.push(r); return r; }
makeWorld(); worldState.npcs = []; memory.npcs = {};
var c = row("Aldern Foxglove", "he/him");
c.voiceId = "en_US-libritts_r-medium#3"; c.voiceDirection = "gruff and impatient"; c.voiceRate = 0.9;      // set on the sheetless card
var d = row("the hooded man", "he/him");
d.charSheet = { name: "the hooded man", gender: "M", inventory: [], abilities: [], relationships: [], voiceId: "en_US-libritts_r-medium#7" };
run("He lowers the hood. [NPC_MERGE:Aldern Foxglove|the hooded man]");
var a = wsNpcByName("Aldern Foxglove");
out("after the merge: row copies", pins(a));
out("after the merge: sheet", pins(a.charSheet));
out("row still holds a copy beside the sheet", ("voiceDirection" in a) || ("voiceRate" in a) || ("voiceId" in a));

// the player clears the direction and the speed on the card (the REAL csWireVoice handlers; the card is given sheet||row)
quiet(function () { csWireVoice(a.charSheet || a); });
elOf("cs-voice-direction").value = ""; fire("cs-voice-direction", "change");
fire("cs-voice-rate-reset", "click");
out("after the player clears them on the card: sheet", pins(a.charSheet));

// the player regenerates the sheet (the REAL generateNpcSheet, model stubbed)
global.callGM = function () { return Promise.resolve(JSON.stringify({ gender: "M", stats: {} })); };
generateNpcSheet("Aldern Foxglove").then(function () {
  a = wsNpcByName("Aldern Foxglove");
  out("after regenerate: sheet", pins(a.charSheet));
  out("after regenerate: row", pins(a));
  out("VERDICT: the direction and speed the player cleared came back", (a.charSheet.voiceDirection || a.charSheet.voiceRate) ? "YES: " + JSON.stringify([a.charSheet.voiceDirection, a.charSheet.voiceRate]) : "no");
});
