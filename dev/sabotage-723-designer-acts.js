var sabotage=require('./sabotage.js'),rc=0;
var engine=['node',['dev/run-tests.js','#723 creature environments and selected acts']],unit=['node',['dev/tests-723-designer-acts.js']],creatures=['node',['dev/tests-designer-creatures.js']];
rc|=sabotage.prove({file:'memory.js',command:engine,cases:[
 {label:'selection bypassed',find:'if(c&&c.availableActs!==undefined)',replace:'if(false)',mustFail:'#723 a noncontiguous whitelist admits only its selected acts'},
 {label:'completed acts remain eligible during another active act',find:'if(phases[i].status==="active"){active=true;',replace:'if(phases[i].status==="active"||phases[i].status==="completed"){active=true;',mustFail:'#723 all active acts count and actual completion removes only the ended selection'},
 {label:'invalid whitelist fails open',find:'availableActs is invalid or conflicts with revealAct");return false;',replace:'availableActs is invalid or conflicts with revealAct");return true;',mustFail:'#723 empty closed and invalid selections never become unrestricted'},
 {label:'turn leaks into whitelist',find:'if(c&&c.availableActs!==undefined){',replace:'if(c&&c.availableActs!==undefined){if(worldState.turn>500)return true;',mustFail:'#723 ordinary turns location and combat do not change the stable bestiary'}
]});
rc|=sabotage.prove({file:'api.js',command:engine,cases:[{label:'whitelist notes lose private boundary',find:'||_bc.availableActs!==undefined),_detail',replace:'),_detail',mustFail:'#723 whitelist-only private notes stay explicitly private'},{label:'habitat dropped from canon',find:'if(_bc.environment)_bm.push("Environment: "+_bc.environment);',replace:'',mustFail:'#723 environment and selections survive import without changing legacy gates'}]});
rc|=sabotage.prove({file:'designer-acts.js',command:unit,cases:[
 {label:'structural edits widen future eligibility',find:'delete c.revealAct;c.availableActs=mapped.sort(function(a,b){return a-b;});',replace:'choose(c,mapped,next);',mustFail:'structural edits preserve explicit restrictions across deletion and later insertion'},
 {label:'legacy gates default to all acts',find:'return n>=c.revealAct;',replace:'return true;',mustFail:'checkbox views preserve absent and legacy fields'},
 {label:'act moves retain old numbers',find:'map[i+1]=next.indexOf(old[i])+1;',replace:'map[i+1]=i+1;',mustFail:'reorder follows act identity for creatures secrets and armor'},
 {label:'referenced act deletion silently retargets secret',find:'if(!moved)throw',replace:'if(false)throw',mustFail:'deletion never retargets a secret and refusal is atomic'}
]});
rc|=sabotage.prove({file:'designer-creatures.js',command:creatures,cases:[
 {label:'author environment ignored',find:'result.environment=choice.environment;',replace:'result.environment=raw.environment;',mustFail:'#723 environment dropdown choices drive prompt and stored entries'},
 {label:'unselected acts silently widened',find:'Acts.choose(result,choice.availableActs,acts);',replace:'Acts.choose(result,Acts.all(acts),acts);',mustFail:'#723 environment dropdown choices drive prompt and stored entries'},
 {label:'text edits drop optional encounter fields',find:'if(next[k]===undefined&&previous[k]!==undefined)',replace:'if(false)',mustFail:'#723 text patches preserve habitat act choices and public details'}
]});
rc|=sabotage.prove({file:'blueprint-designer.html',command:creatures,cases:[{label:'generation ignores context changes',find:'if(bp!==target||JSON.stringify(DesignerCreatures.textBlueprint(target))!==original)',replace:'if(bp!==target)',mustFail:'#723 act and context changes discard pending generations'}]});
process.exit(rc?1:0);
