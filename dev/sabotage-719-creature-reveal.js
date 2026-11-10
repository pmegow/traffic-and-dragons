var sabotage=require('./sabotage.js'),rc=0;
var cmd=['node',['dev/run-tests.js','#719 creature reveal boundaries']];
rc|=sabotage.prove({file:'api.js',command:cmd,cases:[
 {label:'closed creature reenters stable bestiary',find:'if(!creatureAvailable(_bc))continue;',replace:'if(false)continue;',mustFail:'#719 pending creature is wholly withheld until its exact act opens'},
 {label:'private notes swallow the appearance split',find:'if(_bc.desc)_detail+=" | Appearance: "+_bc.desc;',replace:'if(false)_detail+=" | Appearance: "+_bc.desc;',mustFail:'#719 public appearance and GM truth travel separately'},
 {label:'GM combat state loses canonical routing',find:'"Enemy: "+foeLabel(cf,true)',replace:'"Enemy: "+foeLabel(cf)',mustFail:'#719 public labels never replace canonical combat identity'}
]});
rc|=sabotage.prove({file:'memory.js',command:cmd,cases:[
 {label:'completed act hides its creature again',find:'return !!act&&(act.status==="active"||act.status==="completed");',replace:'return !!act&&act.status==="active";',mustFail:'#719 pending creature is wholly withheld until its exact act opens'},
 {label:'turn count controls creature visibility',find:'if(!c||c.revealAct===undefined)return true;',replace:'if(!c||c.revealAct===undefined||worldState.turn>500)return true;',mustFail:'#719 ordinary turns cannot open a creature'},
 {label:'invalid act gate fails open',find:'console.warn("[bestiary] "+c.name+": withheld — revealAct does not name a valid skeleton act");return false;',replace:'return true;',mustFail:'#719 invalid supplied gates fail closed'}
]});
rc|=sabotage.prove({file:'helpers.js',command:cmd,cases:[
 {label:'public name replaced by hidden identity',find:'c.displayName.trim():String(name||"")',replace:'String(name||""):String(name||"")',mustFail:'#719 public labels never replace canonical combat identity'},
 {label:'alias lookup takes an ambiguous first match',find:'if(match){console.warn("[bestiary] ambiguous public name: "+name);return null;}',replace:'if(match)return match;',mustFail:'#719 exact lookup refuses ambiguous public names'}
]});
rc|=sabotage.prove({file:'tag_table.js',command:cmd,cases:[
 {label:'automatic close exposes hidden names',find:'names.push(creaturePublicName(f[i].name));',replace:'names.push(f[i].name);',mustFail:'#719 public labels never replace canonical combat identity'}
]});
rc|=sabotage.prove({file:'game.js',command:cmd,cases:[
 {label:'near-death memory exposes hidden name',find:'foe=" fighting "+creaturePublicName(worldState.combat.engaged||worldState.combat.foes[0].name);',replace:'foe=" fighting "+(worldState.combat.engaged||worldState.combat.foes[0].name);',mustFail:'#719 slain and core-moment prose use public names'}
]});
rc|=sabotage.prove({file:'ui-mobile.js',command:['node',['dev/tests-718-enemy-card.js']],cases:[
 {label:'disguise card exposes its true type',find:'if(!record.displayName)[{key:"kind",label:"Type"}',replace:'if(true)[{key:"kind",label:"Type"}',mustFail:'#719 disguised card omits canonical identity and private classification'}
]});
rc|=sabotage.prove({file:'identity.js',command:cmd,cases:[
 {label:'armored refusal reveals canonical name',find:'var line=creaturePublicName(canon)+": death refused',replace:'var line=canon+": death refused',mustFail:'#719 armored refusal and missing-target errors use public names'}
]});
rc|=sabotage.prove({file:'tag_table.js',command:cmd,cases:[
 {label:'explicit victory reveals standing foe',find:'R.muts.push(creaturePublicName(_ceLive[_cl].name)+" slain',replace:'R.muts.push(_ceLive[_cl].name+" slain',mustFail:'#719 explicit combat outcomes never print concealed identities'},
 {label:'unknown outcome reveals discarded foe',find:'_ceUn.push(creaturePublicName(_ceRest[_cu].name));',replace:'_ceUn.push(_ceRest[_cu].name);',mustFail:'#719 explicit combat outcomes never print concealed identities'}
]});
rc|=sabotage.prove({file:'designer-creatures.js',command:['node',['dev/tests-designer-creatures.js']],cases:[
 {label:'generated gate names a nonexistent act',find:'||(Array.isArray(acts)&&raw.revealAct>acts.length)',replace:'',mustFail:'#719 generated gate outside the actual acts refuses the whole batch'}
]});
process.exit(rc?1:0);
