// Character settings, routing and fallback contracts; each mutation runs in a disposable clone.
var sabotage=require('./sabotage.js'),code=0;
function prove(file,command,cases){if(!code)code=sabotage.prove({file:file,command:['node',command],also:['ui-sheets.js'],cases:cases});}
prove('tts.js',['dev/run-tests.js','Character primary and backup voices'],[
 {label:'re-roll already assigned actors',find:'      if (typeof char[slot.field] === "string" && char[slot.field]) return;',replace:'',mustFail:'#402 creation draws gender-matched voices once and preserves existing pins'}
]);
prove('tts.js',['dev/tests-402-character-voices.js'],[
 {label:'ignore sheet primary during actual synthesis',find:'if (pins && typeof pins[ix] === "string" && pins[ix]) return pins[ix];',replace:'',mustFail:'#402 actual Speechify requests honor sheet actors independently of shared backups and cast overrides'},
 {label:'drop per-speaker backup map on cloud failure',find:'voiceId: voiceId, voices: hasVoices ? mapped : null',replace:'voiceId: voiceId, voices: null',mustFail:'#402 real later cloud failure queues only unread text with each full backup id'}
]);
prove('game.js',['dev/run-tests.js','Character primary and backup voices'],[
 {label:'drop primary pin from resolved NPC',find:'speechifyVoiceId:owner.speechifyVoiceId||""',replace:'speechifyVoiceId:""',mustFail:'#402 replay keeps distinct primary actors even when characters share a backup'}
]);
prove('game.js',['dev/tests-402-character-voices.js'],[
 {label:'skip player creation assignment',find:'  if(typeof TTS!=="undefined"&&TTS.assignCharacterVoices)TTS.assignCharacterVoices(char);',replace:'',mustFail:'#402 campaign creation assigns player and companion voices before saving and preserves imported pins'}
]);
prove('ui-sheets.js',['dev/tests-402-character-voices.js'],[
 {label:'discard inherited voice settings during generation',find:'var pinned=(_prior&&_prior[slot.field])||wsNpc[slot.field];',replace:'var pinned="";',mustFail:'#402 NPC sheet generation inherits both pins and ignores model-authored voice settings'}
]);
process.exit(code);
