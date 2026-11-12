// Outgoing request proof uses dev/cdp-browser.js; no paid generation in this gate.
var sabotage=require('./sabotage.js'),verdict=require('./battery-verdict.js'),chrome=require('./cdp-browser.js').locateChrome(),rc=0;
rc+=sabotage.prove({file:'helpers.js',command:['node',['dev/run-tests.js','#731 image style respects authored materials']],cases:[
 {label:'shared style imposes human material textures again',find:'warm firelight and cool shadow contrast, rich atmospheric depth',replace:'warm firelight and cool shadow contrast, ultra-detailed leather and cloth textures, realistic skin pores and fabric weave, rich atmospheric depth',mustFail:'#731 generated image style does not impose skin leather or fabric'}
]});
rc+=sabotage.prove({file:'blueprint-designer.html',command:['node',['dev/tests-designer-creatures.js']],cases:[
 {label:'NPC prompt loses the shared lens clause',find:'+DesignerCreatures.portraitFocus("character")',replace:'',mustFail:'#731 NPC portraits add 55mm f/1.8 while preserving public identity'}
]});
rc+=sabotage.prove({file:'designer-creatures.js',command:['node',['dev/tests-designer-creatures.js']],cases:[
 {label:'NPC aperture becomes deep focus',find:'55mm lens at f/1.8 with shallow depth of field',replace:'55mm lens at f/16 with deep depth of field',mustFail:'#731 NPC portraits add 55mm f/1.8 while preserving public identity'}
]});
rc+=sabotage.prove({file:'blueprint-designer.html',skip:!chrome.path,command:['node',['dev/tests-designer-creatures-browser.js']],cases:[
 {label:'outgoing NPC request misses optics',find:'+DesignerCreatures.portraitFocus("character")',replace:'',mustFail:'#731 NPC outgoing requests include one lens clause and a blurred background'}
]});
rc+=sabotage.prove({file:'helpers.js',skip:!chrome.path,command:['node',['dev/tests-designer-creatures-browser.js']],cases:[
 {label:'outgoing images regain forced material cues',find:'warm firelight and cool shadow contrast, rich atmospheric depth',replace:'warm firelight and cool shadow contrast, ultra-detailed leather and cloth textures, realistic skin pores and fabric weave, rich atmospheric depth',mustFail:'#731 all outgoing portraits omit forced material textures'}
]});
if(!chrome.path&&!rc){verdict.reportSkip('sabotage-731-npc-focus.js',2,chrome.why);process.exit(verdict.SKIP_EXIT);}process.exit(rc?1:0);
