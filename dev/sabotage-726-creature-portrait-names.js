// Portrait request guards, with zero paid calls. Browser driver: dev/cdp-browser.js.
var sabotage=require('./sabotage.js'),verdict=require('./battery-verdict.js'),chrome=require('./cdp-browser.js').locateChrome(),failed=0;
failed+=sabotage.prove({file:'designer-creatures.js',command:['node',['dev/tests-designer-creatures.js']],cases:[
 {label:'public creature name injected into appearance prompt',find:'"Bestiary illustration. Visible appearance: "+c.desc',replace:'"Bestiary illustration of "+(c.displayName||c.name)+". Visible appearance: "+c.desc',mustFail:'#726 creature portrait prompts omit both name fields and preserve authored appearance'},
 {label:'canonical creature name injected into legacy prompt',find:'"Bestiary illustration. Kind: "+(c.kind||"creature")',replace:'"Bestiary illustration of "+c.name+". Kind: "+(c.kind||"creature")',mustFail:'#726 creature portrait prompts omit both name fields and preserve authored appearance'}
]});
failed+=sabotage.prove({file:'designer-creatures.js',skip:!chrome.path,command:['node',['dev/tests-designer-creatures-browser.js']],cases:[
 {label:'actual creature request leaks its canonical name',find:'"Bestiary illustration. Visible appearance: "+c.desc',replace:'"Bestiary illustration of "+c.name+". Visible appearance: "+c.desc',mustFail:'#726 outgoing creature request preserves appearance and omits names'}
]});
failed+=sabotage.prove({file:'blueprint-designer.html',skip:!chrome.path,command:['node',['dev/tests-designer-creatures-browser.js']],cases:[
 {label:'NPC character name removed with creature names',find:'"Character portrait of "+c.name+". Role: "',replace:'"Character portrait. Role: "',mustFail:'#726 NPC character portrait requests retain their names'}
]});
if(!chrome.path&&!failed){verdict.reportSkip('sabotage-726-creature-portrait-names.js',2,chrome.why);process.exit(verdict.SKIP_EXIT);}
process.exit(failed?1:0);
