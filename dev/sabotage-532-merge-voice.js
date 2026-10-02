// dev/sabotage-532-merge-voice.js — proves the #532 guards are guarded. A sheetless speaker's voice is pinned on the roster
// row at first speech; the NPC_MERGE fold never carried it, so "the hooded man", named by the GM as Aldern Foxglove, was
// re-cast on his next line. The survivor's pin owner (its sheet, else its row) now takes each voice field it lacks; its own
// pin always wins. Each mutation runs in a disposable clone.
//   node dev/sabotage-532-merge-voice.js
var sabotage = require("./sabotage.js");
var CMD = ["node", ["dev/run-tests.js", "#532"]];
var code = 0;
function prove(file, cases) { if (!code) code = sabotage.prove({ file: file, command: CMD, cases: cases }); }
var REPRO = "#532 the repro", OWN = "#532 the survivor's own pin always wins", SHEET = "#532 a sheet owns its character's pins";
prove("tag_table.js", [
  { label: "the fold drops the voice again (the reported re-cast)",
    find: 'var _mgVn=voicePinsFill(_mgCanN.charSheet||_mgCanN,[_mgCanN.charSheet&&_mgCanN.charSheet===_mgDupN.charSheet?_mgCanN:null,_mgDupN.charSheet,_mgDupN]);', replace: 'var _mgVn=0;',
    mustFail: REPRO },
  { label: "a sheeted survivor's row takes the pins (a stale copy beside the sheet)",
    find: 'voicePinsFill(_mgCanN.charSheet||_mgCanN,', replace: 'voicePinsFill(_mgCanN,',
    mustFail: SHEET },
  { label: "an adopted sheet ignores the survivor's own row pin",
    find: '_mgCanN.charSheet&&_mgCanN.charSheet===_mgDupN.charSheet?_mgCanN:null', replace: 'null',
    mustFail: SHEET },
  { label: "the duplicate's sheet is not a source",
    find: '?_mgCanN:null,_mgDupN.charSheet,_mgDupN]);', replace: '?_mgCanN:null,null,_mgDupN]);',
    mustFail: SHEET },
  { label: "the duplicate's row is not a source",
    find: ',_mgDupN.charSheet,_mgDupN]);', replace: ',_mgDupN.charSheet,null]);',
    mustFail: REPRO }
]);
prove("helpers.js", [
  { label: "the cloud slots are not carried (a hand list instead of the one table)",
    find: 's=(typeof TTS!=="undefined"&&TTS.characterVoiceSlots)?TTS.characterVoiceSlots():[{field:"voiceId"}],i;', replace: 's=[{field:"voiceId"}],i;',
    mustFail: REPRO },
  { label: "the direction and the speed are not carried",
    find: 'var f=["voiceDirection","voiceRate"],s=', replace: 'var f=[],s=',
    mustFail: REPRO },
  { label: "the duplicate's pin overwrites the survivor's own",
    find: '    if(owner[f[i]])continue;\n', replace: '',
    mustFail: OWN },
  { label: "an unpinned merge writes empty voice fields",
    find: 'if(src&&src[f[i]]){owner[f[i]]=src[f[i]];n++;break;}', replace: 'if(src){owner[f[i]]=src[f[i]];n++;break;}',
    mustFail: OWN }
]);
process.exit(code ? 1 : 0);
