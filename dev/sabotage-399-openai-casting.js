var sabotage=require('./sabotage.js');
process.exit(sabotage.prove({file:'tts.js',command:['node',['dev/run-tests.js','#399']],cases:[
 {label:'Alloy is assigned female',find:'{ id: "alloy", g: "M", note: "Neutral" }',replace:'{ id: "alloy", g: "F", note: "Neutral" }',mustFail:'#399 all thirteen actors carry casting gender'},
 {label:'OpenAI ignores cast gender',find:'(!gender || v.g === gender) && v.id !== narrator',replace:'v.id !== narrator',mustFail:'#399 every default cast voice retains gender'},
 {label:'OpenAI reuses the narrator for an NPC',find:'(!gender || v.g === gender) && v.id !== narrator',replace:'(!gender || v.g === gender)',mustFail:'#399 every default cast voice retains gender'},
 {label:'user-edited cast metadata is ignored',find:'list = starsList();',replace:'list = [];',mustFail:'#399 edited star gender wins'},
 {label:'old default cast pins lose their gender after unstar',find:'if (DEFAULT_SPEAKER_STARS[i].id === voiceId)',replace:'if (false)',mustFail:'#399 edited star gender wins'},
 {label:'voice options conceal their gender',find:'(v.g === "M" ? "Male" : "Female")',replace:'"Voice"',mustFail:'#399 actor labels show gender and description'}
]}));
