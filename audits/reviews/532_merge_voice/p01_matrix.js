// Matrix: every sheet/no-sheet/pin combination of canonical (C) x duplicate (D), merged through the REAL NPC_MERGE handler.
// Prints, per cell, the survivor's pin owner fields, its row fields, and the voice the speaker map resolves for both names.
require("./h.js");
var CAN = "Aldern Foxglove", DUP = "the hooded man";
function row(name, pron) { memory.npcs[name] = { attitude: "", knowledge: [], events: [], aliases: [], pronouns: pron }; var r = { name: name, status: "present", rel: "neutral", pronouns: pron, met: 1, partyMember: false, portrait: null, aliases: [] }; worldState.npcs.push(r); return r; }
function sheet(name, p) { var s = { name: name, gender: "M", inventory: [], abilities: [], relationships: [] }, k; for (k in p) s[k] = p[k]; return s; }
function put(o, p) { var k; for (k in p) o[k] = p[k]; return o; }
var PC = { voiceId: "en_US-libritts_r-medium#3", speechifyVoiceId: "C-cloud", inworldVoiceId: "C-inworld", voiceDirection: "C-direction", voiceRate: 0.9 };
var PD = { voiceId: "en_US-libritts_r-medium#7", speechifyVoiceId: "D-cloud", inworldVoiceId: "D-inworld", voiceDirection: "D-direction", voiceRate: 1.2 };
var C = {
  "C0 no row": function () { },
  "C1 sheetless unpinned": function () { row(CAN, "he/him"); },
  "C2 sheetless pinned row": function () { put(row(CAN, "he/him"), PC); },
  "C3 sheeted, sheet pinned": function () { row(CAN, "he/him").charSheet = sheet(CAN, PC); },
  "C4 sheeted, unpinned": function () { row(CAN, "he/him").charSheet = sheet(CAN, {}); },
  "C5 sheeted(voiceId only)+stale row pins": function () { var r = put(row(CAN, "he/him"), { voiceId: "stale-row-voice", speechifyVoiceId: "stale-row-cloud", voiceDirection: "stale-row-direction", voiceRate: 1.3 }); r.charSheet = sheet(CAN, { voiceId: PC.voiceId }); }
};
var D = {
  "D1 sheetless unpinned": function () { row(DUP, "he/him"); },
  "D2 sheetless pinned row": function () { put(row(DUP, "he/him"), PD); },
  "D3 sheeted, sheet pinned": function () { row(DUP, "he/him").charSheet = sheet(DUP, PD); },
  "D4 sheeted unpinned + row pins": function () { var r = put(row(DUP, "he/him"), PD); r.charSheet = sheet(DUP, {}); },
  "D5 PARTY sheeted, sheet pinned": function () { var r = row(DUP, "he/him"); r.partyMember = true; r.charSheet = sheet(DUP, PD); },
  "D6 sheetless, only direction+rate on row": function () { put(row(DUP, "he/him"), { voiceDirection: "D-direction", voiceRate: 1.2 }); }
};
function vm(name) { var m = quiet(function () { return speakerVoiceMap({ n: 1, s: { 0: name } }, '"Hold there."'); }).r; return m; }
Object.keys(C).forEach(function (ck) {
  Object.keys(D).forEach(function (dk) {
    makeWorld(); worldState.npcs = []; memory.npcs = {};
    C[ck](); D[dk]();
    var r = run("He lowers the hood. [NPC_MERGE:" + CAN + "|" + DUP + "]");
    var s = wsNpcByName(CAN), gone = !wsNpcByName(DUP);
    var res = { merged: r.muts.join(" ; "), dupGone: gone, rows: worldState.npcs.length, row: pins(s), sheet: s && s.charSheet ? pins(s.charSheet) : null, sheetName: s && s.charSheet ? s.charSheet.name : null, party: s && !!s.partyMember,
      sayCanon: vm(CAN), sayDup: vm(DUP) };
    out(ck + " x " + dk, res);
  });
});
