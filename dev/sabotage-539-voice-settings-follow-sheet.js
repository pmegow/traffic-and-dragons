var sabotage=require('./sabotage.js'),code=0;
function prove(file,command,cases){if(!code)code=sabotage.prove({file:file,command:['node',command],cases:cases});}
prove('game.js',['dev/run-tests.js','#539'],[
{label:'direction and rate omitted',find:'voicePinFields([sheet,wsNpc,prior]).forEach(function(f){',replace:'voicePinFields([sheet,wsNpc,prior]).filter(function(f){return f!=="voiceDirection"&&f!=="voiceRate";}).forEach(function(f){',mustFail:'#539 the repro'},
{label:'model fields retained',find:'    delete sheet[f];',replace:'',mustFail:'#539 a new sheet'},
{label:'prior clear resurrects row',find:'var pinned=prior?prior[f]:(wsNpc&&wsNpc[f]);',replace:'var pinned=(prior&&prior[f])||(wsNpc&&wsNpc[f]);',mustFail:'#539 a new sheet'},
{label:'offline inheritance skipped',find:'function inheritVoicePins(sheet,wsNpc,prior){\n  if(!sheet)return sheet;',replace:'function inheritVoicePins(sheet,wsNpc,prior){\n  if(!sheet||typeof TTS==="undefined")return sheet;',mustFail:'#539 inheritance without TTS'},
{label:'automatic attach retains stale row',find:'  releaseRowVoicePins(npc);',replace:'',mustFail:'#539 the repro'}
]);
prove('ui-sheets.js',['dev/tests-402-character-voices.js'],[
{label:'manual handoff skipped',find:'    inheritVoicePins(sheet,wsNpc,_prior);',replace:'',mustFail:'#539 NPC sheet generation'},
{label:'manual attach retains stale row',find:'wsNpc.charSheet=sheet;releaseRowVoicePins(wsNpc);',replace:'wsNpc.charSheet=sheet;',mustFail:'#539 NPC sheet generation'},
{label:'manual handoff requires TTS',find:'    inheritVoicePins(sheet,wsNpc,_prior);',replace:'    if(typeof TTS!=="undefined")inheritVoicePins(sheet,wsNpc,_prior);',mustFail:'#539 NPC sheet generation'}
]);
process.exit(code?1:0);
