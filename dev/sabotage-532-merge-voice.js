// dev/sabotage-532-merge-voice.js — proves the #532 guards are guarded. A sheetless speaker's voice is pinned on the roster
// row at first speech; the NPC_MERGE fold never carried it, so a provisional who turned out to be another person (#504) was
// re-cast on her next line. The fold now fills each voice field the canonical lacks; its own pin always wins.
// Each mutation runs in a disposable clone.
//   node dev/sabotage-532-merge-voice.js
var sabotage = require("./sabotage.js");
var CMD = ["node", ["dev/run-tests.js", "#532"]];
var code = 0;
function prove(file, cases) { if (!code) code = sabotage.prove({ file: file, command: CMD, cases: cases }); }
var REPRO = "#532 the repro", OWN = "#532 the canonical's own pin always wins";
prove("tag_table.js", [
  { label: "the fold drops the voice again (the reported re-cast)",
    find: 'if(!_mgCanN.charSheet)for(_mgVi=0;_mgVi<_mgVf.length;_mgVi++)if(_mgDupN[_mgVf[_mgVi]]&&!_mgCanN[_mgVf[_mgVi]])_mgCanN[_mgVf[_mgVi]]=_mgDupN[_mgVf[_mgVi]];', replace: '',
    mustFail: REPRO },
  { label: "the cloud slots are not carried",
    find: '_mgVs=(typeof TTS!=="undefined"&&TTS.characterVoiceSlots)?TTS.characterVoiceSlots():[{field:"voiceId"}]', replace: '_mgVs=[{field:"voiceId"}]',
    mustFail: REPRO },
  { label: "the direction and the speed are not carried",
    find: 'var _mgVf=["voiceDirection","voiceRate"],', replace: 'var _mgVf=[],',
    mustFail: REPRO },
  { label: "the duplicate's pin overwrites the canonical's own",
    find: 'if(_mgDupN[_mgVf[_mgVi]]&&!_mgCanN[_mgVf[_mgVi]])_mgCanN[_mgVf[_mgVi]]=', replace: 'if(_mgDupN[_mgVf[_mgVi]])_mgCanN[_mgVf[_mgVi]]=',
    mustFail: OWN },
  { label: "a sheeted canonical's row takes the duplicate's pins (a stale copy beside the sheet)",
    find: 'if(!_mgCanN.charSheet)for(_mgVi=0;_mgVi<_mgVf.length;_mgVi++)', replace: 'for(_mgVi=0;_mgVi<_mgVf.length;_mgVi++)',
    mustFail: OWN },
  { label: "an unpinned merge writes empty voice fields",
    find: 'if(_mgDupN[_mgVf[_mgVi]]&&!_mgCanN[_mgVf[_mgVi]])_mgCanN[_mgVf[_mgVi]]=', replace: 'if(!_mgCanN[_mgVf[_mgVi]])_mgCanN[_mgVf[_mgVi]]=',
    mustFail: OWN }
]);
process.exit(code ? 1 : 0);
