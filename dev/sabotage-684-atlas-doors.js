// New-campaign map defaults (#735) supersede the former #684 opt-in guards.
var sabotage=require('./sabotage.js'),browser=['node',['dev/tests-684-atlas-browser.js']],must='FAIL ⑩ new campaigns always begin with public maps',rc=0;
rc|=sabotage.prove({file:'game.js',command:browser,cases:[
 {label:'new campaign uses the private generator',find:'atlasCreate(null,{knowledge:true});atlasFollow();',replace:'atlasCreate();atlasFollow();',mustFail:must},
 {label:'village skips the map',find:'try{atlasCreate(null,{knowledge:true});atlasFollow();}',replace:'try{if(campaignKind()!=="village"){atlasCreate(null,{knowledge:true});atlasFollow();}}',mustFail:must},
 {label:'map failure is swallowed',find:'catch(_ae){delete worldState.atlas;atlasProblem("starting the public map",_ae);}',replace:'catch(_ae){delete worldState.atlas;}',mustFail:must}
]});
rc|=sabotage.prove({file:'index.html',command:browser,cases:[
 {label:'wizard map checkbox returns',find:'<select id="rv-start-level"',replace:'<input type="checkbox" id="rv-atlas"/><select id="rv-start-level"',mustFail:must}
]});
rc|=sabotage.prove({file:'ui-browsers.js',command:browser,cases:[
 {label:'import setup map checkbox returns',find:"<input id='is-camp-name'",replace:"<input type='checkbox' id='is-atlas'/><input id='is-camp-name'",mustFail:must}
]});
process.exit(rc?1:0);
