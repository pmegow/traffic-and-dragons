// Character settings, routing and fallback contracts; each mutation runs in a disposable clone.
var sabotage=require('./sabotage.js'),code=0;
function prove(file,command,cases){if(!code)code=sabotage.prove({file:file,command:['node',Array.isArray(command)?command:[command]],also:['ui-sheets.js'],cases:cases});}/* command: a script path, or [script, ...args] — sabotage.js spawns cmd[0] with cmd[1] as the argv array */
prove('tts.js',['dev/run-tests.js','Character primary and backup voices'],[
 {label:'re-roll already assigned actors',find:'      if (typeof char[slot.field] === "string" && char[slot.field]) return;',replace:'',mustFail:'#402 creation draws gender-matched voices once and preserves existing pins'}
]);
prove('tts.js',['dev/tests-402-character-voices.js'],[
 {label:'ignore sheet primary during actual synthesis',find:'if (pins && typeof pins[ix] === "string" && pins[ix]) return pins[ix];',replace:'',mustFail:'#402 actual Speechify requests honor sheet actors independently of shared backups and cast overrides'},
 {label:'drop per-speaker backup map on cloud failure',find:'voiceId: voiceId, voices: hasVoices ? mapped : null',replace:'voiceId: voiceId, voices: null',mustFail:'#402 real later cloud failure queues only unread text with each full backup id'},
 /* Fable review 2026-09-11 (Brief F, mutation IX1 survived the tree): the audition guard on the remainder hand-off */
 {label:'a failed audition hands its remainder to the read queue',find:'if (rem && !cloud.audition) _queue.unshift(_cloudFallbackItem(units, groups, i, voiceId, voices));',replace:'if (rem) _queue.unshift(_cloudFallbackItem(units, groups, i, voiceId, voices));',mustFail:'#402 a failed cloud audition never hands a fallback item to the read queue'}
]);
prove('game.js',['dev/run-tests.js','Character primary and backup voices'],[
 {label:'drop primary pin from resolved NPC',find:'speechifyVoiceId:owner.speechifyVoiceId||""',replace:'speechifyVoiceId:""',mustFail:'#402 replay keeps distinct primary actors even when characters share a backup'}
]);
prove('game.js',['dev/tests-402-character-voices.js'],[
 {label:'skip player creation assignment',find:'  if(typeof TTS!=="undefined"&&TTS.assignCharacterVoices)TTS.assignCharacterVoices(char);',replace:'',mustFail:'#402 campaign creation assigns player and companion voices before saving and preserves imported pins'}
]);
/* Fable review 2026-09-11 (Brief D hop 19): the inheritance step moved to ONE helper in game.js (inheritVoicePins),
   shared by generateNpcSheet (ui-sheets.js) and attachCompanionSheet (game.js) — both batteries below target it. */
prove('game.js',['dev/tests-402-character-voices.js'],[
 {label:'discard inherited voice settings during generation',find:'var pinned=(prior&&prior[slot.field])||(wsNpc&&wsNpc[slot.field]);',replace:'var pinned="";',mustFail:'#402 NPC sheet generation inherits both pins and ignores model-authored voice settings'}
]);
prove('game.js',['dev/run-tests.js','companion sheets (audit P2)'],[
 {label:'auto companion sheet skips the inheritance step',find:'  inheritVoicePins(sheet,npc,null);',replace:'  /* inheritance skipped */',mustFail:'attachCompanionSheet inherits the roster'}
]);
prove('ui-sheets.js',['dev/tests-402-character-voices.js'],[
 {label:'manual NPC sheet routes around the shared inheritance helper',find:'      inheritVoicePins(sheet,wsNpc,_prior);',replace:'      TTS.characterVoiceSlots().forEach(function(slot){delete sheet[slot.field];});',mustFail:'#402 NPC sheet generation inherits both pins and ignores model-authored voice settings'}
]);
process.exit(code);
