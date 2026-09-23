const sabotage=require('./sabotage.js');
process.exit(sabotage.prove({file:'ui-sheets.js',command:['node',['dev/tests-435-item-card-define.js']],cases:[
 {label:'story review action missing',find:'var action=canDefine?',replace:'var action=false?',mustFail:'canon-less card offers story review'},
 {label:'raw instance lost',find:'    defineItemFromStory(raw,ev);',replace:'    defineItemFromStory("wrong item",ev);',mustFail:'canon-less card offers story review'},
 {label:'stale card remains over confirmation',find:'    modal.remove();\n    defineItemFromStory(raw,ev);',replace:'    defineItemFromStory(raw,ev);',mustFail:'canon-less card offers story review'},
 {label:'busy click reaches review',find:'    if(busy){showToast("Wait for the turn to finish",3000);return;}\n',replace:'',mustFail:'busy click refuses loudly'},
 {label:'canon eligibility bypassed',find:'&&itemDefEligible(raw));',replace:');',mustFail:'canon and non-campaign cards have no definition action'},
 {label:'missing review function fails silently',find:'showToast("Story review is unavailable. Reload and try again.",4000);',replace:'',mustFail:'missing review function reports failure'}
]}));
