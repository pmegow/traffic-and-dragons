// dev/sabotage-539-voice-settings-follow-sheet.js — proves the #539 guards are guarded. The sheet-attach handoff
// (inheritVoicePins, game.js) walked the slot table only, so a delivery direction or a speed set on a sheetless character's
// card stayed behind on the row when the sheet was made, a regenerated sheet dropped the ones on the earlier sheet, and a
// model-authored one reached the sheet. The handoff and the row release now walk voicePinFields(). Each mutation runs in a
// disposable clone.
//   node dev/sabotage-539-voice-settings-follow-sheet.js
var sabotage = require("./sabotage.js");
var code = 0;
function prove(file, command, cases) { if (!code) code = sabotage.prove({ file: file, command: ["node", command], cases: cases }); }
var REPRO = "#539 the repro", MODEL = "#539 a new sheet's own direction and speed", MANUAL = "#539 NPC sheet generation keeps";
prove("game.js", ["dev/run-tests.js", "#539"], [
  { label: "the handoff walks the slot table only again (the reported loss)",
    find: '  voicePinFields().forEach(function(f){\n    delete sheet[f];', replace: '  TTS.characterVoiceSlots().map(function(s){return s.field;}).forEach(function(f){\n    delete sheet[f];',
    mustFail: REPRO },
  { label: "a model-authored direction or speed reaches the sheet",
    find: '    delete sheet[f];\n', replace: '',
    mustFail: MODEL },
  { label: "the row outranks an earlier sheet",
    find: 'var pinned=(prior&&prior[f])||(wsNpc&&wsNpc[f]);', replace: 'var pinned=(wsNpc&&wsNpc[f])||(prior&&prior[f]);',
    mustFail: MODEL },
  { label: "the automatic attach skips the release",
    find: '  if(typeof TTS!=="undefined"&&TTS.characterVoiceSlots)releaseRowVoicePins(npc);/* the sheet owns the pins now', replace: '  /* the sheet owns the pins now',
    mustFail: REPRO }
]);
prove("game.js", ["dev/tests-402-character-voices.js"], [
  { label: "a regenerated sheet drops the direction and the speed of the earlier sheet",
    find: 'var pinned=(prior&&prior[f])||(wsNpc&&wsNpc[f]);', replace: 'var pinned=(wsNpc&&wsNpc[f]);',
    mustFail: MANUAL }
]);
prove("helpers.js", ["dev/run-tests.js", "#539"], [
  { label: "the release walks the slot table only (a stale direction and speed stay on the row)",
    find: 'if(row)voicePinFields([row]).forEach(function(f){delete row[f];});', replace: 'if(row)TTS.characterVoiceSlots().forEach(function(s){delete row[s.field];});',
    mustFail: REPRO }
]);
prove("ui-sheets.js", ["dev/tests-402-character-voices.js"], [
  { label: "the manual sheet keeps the row's copies",
    find: 'if(typeof TTS!=="undefined"&&TTS.characterVoiceSlots)releaseRowVoicePins(wsNpc);', replace: '',
    mustFail: MANUAL }
]);
process.exit(code ? 1 : 0);
