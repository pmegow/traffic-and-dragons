const sabotage=require('./sabotage.js');let rc=0;
const also=['index.html','sw.js','audio-cache.js','ui-ambient.js','ui-boot.js','ui-shell.js','dev/engine-manifest.js','dev/golden/tag-table-strip.golden'];
const command=['node',['dev/run-tests.js','L7 general audio']];
rc|=sabotage.prove({also,file:'audio-profile.js',command,cases:[
 {label:'mixed recording ignores its inseparable contents',mustFail:'L7 general audio rejects unknown fields and incompatible mixed recordings',find:'return p.allows.indexOf(c)>=0&&p.forbid.indexOf(c)<0;',replace:'return true;'},
 {label:'explicit silence is ignored',mustFail:'L7 general audio rejects unknown fields and incompatible mixed recordings',find:'v.profile.quiet==="silent"',replace:'false'},
 {label:'future cohorts reroll saved selections',mustFail:'L7 general audio seed and general selector share assets without rerolling adjacent nodes',find:'a.cohort===(p.cohort||catalog.cohort)',replace:'true'},
 {label:'nested saves publish intermediate scenes',mustFail:'L7 audio is staged until final commit',find:'if(audioCommitDepth&&!force)return;',replace:''},
 {label:'physical changes keep stale audio',mustFail:'L7 material change and ambiguous location merge',find:'v.profile.stamp===audioNodeStamp(node)',replace:'true'}
]});
rc|=sabotage.prove({also,file:'memory.js',command,cases:[
 {label:'stale response changes a replacement campaign',mustFail:'L7 audio rejects stale request scope',find:'scope&&!audioRequestCurrent(scope)',replace:'false'},
 {label:'rejected destination classification writes at origin',mustFail:'L7 general audio refuses destination metadata after an unaccepted move',find:'if(target!==key&&child!==key)',replace:'if(false)'}
]});
process.exit(rc);
