// dev/sabotage-532-merge-voice.js — proves the #532 guards are guarded. A sheetless speaker's voice is pinned on the roster
// row at first speech; the NPC_MERGE fold never carried it, so "the hooded man", named by the GM as Aldern Foxglove, was
// re-cast on his next line. The survivor's pin owner (its sheet, else its row) now takes each voice field it lacks. After
// the first independent review: a pending merge lends the voice on the reveal turn (with scene refs the merge is only
// proposed there), a voice of the other sex is not carried, a sheeted survivor's row keeps no copy, and a host without
// the voice module finds the fields by their names. Each mutation runs in a disposable clone.
//   node dev/sabotage-532-merge-voice.js
var sabotage = require("./sabotage.js");
var CMD = ["node", ["dev/run-tests.js", "#532"]];
var code = 0;
function prove(file, cases) { if (!code) code = sabotage.prove({ file: file, command: CMD, cases: cases }); }
var REPRO = "#532 the repro", OWN = "#532 the survivor's own pin always wins", SHEET = "#532 a sheet owns its character's pins",
  REVEAL = "#532 the reveal as play runs it", PENDING = "#532 a pending merge lends the voice", FIT = "#532 a voice that does not fit the person",
  STALE = "#532 a survivor that has a sheet keeps no voice setting on its row", ORDER = "#532 the order of the sources", TOOL = "#532 a host without the voice module", RENAMED = "#532 a companion with a sheet is merged under a new name";
prove("tag_table.js", [
  { label: "the fold drops the voice again (the reported re-cast)",
    find: '_mgVn=voicePinsFill(_mgVo,[_mgCanN.charSheet?_mgCanN:null,_mgDupN.charSheet,_mgDupN],voicePinFitsGender(speakerSubjectOfRow(_mgCanN,mgCanon).char.gender));', replace: '_mgVn=0;',
    mustFail: REPRO },
  { label: "a sheeted survivor's row takes the pins instead of its sheet",
    find: 'var _mgVo=_mgCanN.charSheet||_mgCanN,', replace: 'var _mgVo=_mgCanN,',
    mustFail: SHEET },
  { label: "a sheeted survivor's own row is not a source",
    find: '[_mgCanN.charSheet?_mgCanN:null,_mgDupN.charSheet,_mgDupN]', replace: '[null,_mgDupN.charSheet,_mgDupN]',
    mustFail: STALE },
  { label: "the duplicate's sheet is not a source",
    find: '_mgCanN:null,_mgDupN.charSheet,_mgDupN],voicePinFitsGender', replace: '_mgCanN:null,null,_mgDupN],voicePinFitsGender',
    mustFail: SHEET },
  { label: "the duplicate's row is not a source",
    find: ',_mgDupN.charSheet,_mgDupN],voicePinFitsGender', replace: ',_mgDupN.charSheet,null],voicePinFitsGender',
    mustFail: REPRO },
  { label: "the sources are asked in the reverse order",
    find: '[_mgCanN.charSheet?_mgCanN:null,_mgDupN.charSheet,_mgDupN]', replace: '[_mgDupN,_mgDupN.charSheet,_mgCanN.charSheet?_mgCanN:null]',
    mustFail: ORDER },
  { label: "the merge carries a voice of the other sex",
    find: ',voicePinFitsGender(speakerSubjectOfRow(_mgCanN,mgCanon).char.gender));', replace: ');',
    mustFail: FIT },
  { label: "a sheeted survivor's row keeps its copies",
    find: '    if(_mgCanN.charSheet)releaseRowVoicePins(_mgCanN);\n', replace: '',
    mustFail: STALE }
]);
prove("helpers.js", [
  { label: "the cloud slots are not carried (a hand list instead of the one table)",
    find: '{s=TTS.characterVoiceSlots();for(i=0;i<s.length;i++)f.push(s[i].field);return f;}', replace: '{f.push("voiceId");return f;}',
    mustFail: REPRO },
  { label: "the direction and the speed are not carried",
    find: 'var f=["voiceDirection","voiceRate"],s,i,k;', replace: 'var f=[],s,i,k;',
    mustFail: REPRO },
  { label: "a host without the voice module knows the Piper field only",
    find: '  for(i=0;i<(objs||[]).length;i++)for(k in (objs[i]||{}))if(k.length>7&&k.slice(-7)==="VoiceId"&&f.indexOf(k)<0)f.push(k);\n', replace: '',
    mustFail: TOOL },
  { label: "the duplicate's pin overwrites the survivor's own",
    find: '    if(owner[f[i]])continue;\n', replace: '',
    mustFail: OWN },
  { label: "an unpinned merge writes empty voice fields",
    find: 'if(src&&src[f[i]]&&(!fits||fits(f[i],src[f[i]]))){', replace: 'if(src&&(!fits||fits(f[i],src[f[i]]))){',
    mustFail: OWN },
  { label: "a voice of the other sex fits",
    find: '    return !vg||vg===gender;', replace: '    return true;',
    mustFail: FIT },
  { label: "a voice the catalog does not list is refused",
    find: '    return !vg||vg===gender;', replace: '    return vg===gender;',
    mustFail: FIT },
  { label: "a person of unknown sex refuses a voice",
    find: 'if((gender!=="M"&&gender!=="F")||typeof TTS==="undefined"||!TTS||!TTS.pinnedVoiceGender)return true;', replace: 'if(typeof TTS==="undefined"||!TTS||!TTS.pinnedVoiceGender)return true;',
    mustFail: FIT },
  { label: "a pending merge lends nothing (the reveal turn casts afresh)",
    find: '    if(row)n+=voicePinsFill(owner,[row.charSheet,row],voicePinFitsGender(gender));\n', replace: '',
    mustFail: REVEAL },
  { label: "only the name that is to survive borrows",
    find: 'other=hints[i].canonical===name?hints[i].duplicate:(hints[i].duplicate===name?hints[i].canonical:"");', replace: 'other=hints[i].canonical===name?hints[i].duplicate:"";',
    mustFail: PENDING },
  { label: "an armed confirmation is not a pending merge",
    find: '  if(a&&a.turn>=ws.turn)hints.push(a);\n', replace: '',
    mustFail: PENDING },
  { label: "a lapsed confirmation still lends",
    find: '  if(a&&a.turn>=ws.turn)hints.push(a);', replace: '  if(a)hints.push(a);',
    mustFail: PENDING },
  { label: "a pending merge lends a voice of the other sex",
    find: 'n+=voicePinsFill(owner,[row.charSheet,row],voicePinFitsGender(gender));', replace: 'n+=voicePinsFill(owner,[row.charSheet,row]);',
    mustFail: FIT },
  { label: "the voice subject does not say which row it read",
    find: '  return {char:_sc,owner:owner,row:row};', replace: '  return {char:_sc,owner:owner};',
    mustFail: REVEAL }
]);
prove("game.js", [
  { label: "casting does not ask the pending merge",
    find: '    if(sub.row&&voicePinsFromPendingMerge(sub.owner,sub.row.name,ch.gender))pinned=true;\n', replace: '',
    mustFail: REVEAL },
  { label: "a companion merged under a new name is looked up by the sheet's old name only (the narrator reads the lines)",
    find: '(ns[i].name===nm||(_spc&&ns[i].charSheet===_spc))', replace: '(ns[i].name===nm)',
    mustFail: RENAMED },
  { label: "a loan is not reported as a change to save",
    find: 'if(sub.row&&voicePinsFromPendingMerge(sub.owner,sub.row.name,ch.gender))pinned=true;', replace: 'if(sub.row)voicePinsFromPendingMerge(sub.owner,sub.row.name,ch.gender);',
    mustFail: PENDING }
]);
prove("tts.js", [
  { label: "the sex of a pinned voice is never known",
    find: 'if (v && v.id === id && (v.g === "M" || v.g === "F")) gender = v.g;', replace: '',
    mustFail: FIT },
  { label: "any field reads as a voice slot",
    find: '      if (slot.field !== field) return;\n', replace: '',
    mustFail: FIT }
]);
process.exit(code ? 1 : 0);
