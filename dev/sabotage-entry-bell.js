const sabotage=require('./sabotage.js');let rc=0;
const also=['audio-scenes.js','audio-catalog.js','dev/audio-delivery.json','sfx/alchemist-entry-bell-v2.mp3'];
rc|=sabotage.prove({also,file:'audio-accents.js',command:['node',['dev/run-tests.js','Alchemist entry bell']],cases:[
 {label:'every repeated turn rings the bell',mustFail:'Entry bell follows committed entrances',find:'before.nodeKey === s.nodeKey ||',replace:''},
 {label:'reload counts as entering',mustFail:'Entry bell follows committed entrances',find:'reason !== "turn" ||',replace:''},
 {label:'profile bell prohibition ignored',mustFail:'Entry bell honors blocked playback',find:'if (s.profile && (a.contains || []).some',replace:'if (false && (a.contains || []).some'}
]});
rc|=sabotage.prove({also,file:'audio-accents.js',command:['node',['dev/tests-accent-layer.js']],cases:[
 {label:'late cue rings after download',mustFail:'ENTRY late download never rings',find:'now > entry.deadline ||',replace:''},
 {label:'profile veto ignores active bell',mustFail:'ENTRY changing the profile',find:'if ((entry || entryVoice) && !audioEntryFor(snapshot, catalog, registry))',replace:'if (false)'},
 {label:'bell does not duck under narration',mustFail:'ENTRY bell gain ducks under narration',find:'(s.speaking ? AMBIENT_DUCK : 1)',replace:'1'}
]});
process.exit(rc);
