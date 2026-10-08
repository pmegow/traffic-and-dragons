// #528: prove the production caller boundaries, not a standalone helper or source spelling.
const sabotage=require('./sabotage.js');
process.exitCode=sabotage.prove({file:'game.js',command:['node',['dev/tests-528-levelup-integration.js']],cases:[
 {label:'hero level-up bypasses name-aware grant',find:'if(!abilityGrant(c,_lvFeats[_lf],worldState.turn))continue;',replace:'c.abilities.push({nm:_lvFeats[_lf].nm,ds:_lvFeats[_lf].ds,gained:worldState.turn});',mustFail:'hero level-up duplicated the held class ability'},
 {label:'archetype catch-up also auto-picks class unlocks',find:'var unl=spellUnlocksCrossed(cs.cls,rep.archetype.id,2,cs.level||1).filter(function(u){return u.source==="arch";});',replace:'var unl=spellUnlocksCrossed(cs.cls,rep.archetype.id,2,cs.level||1);',mustFail:'class spell unlocks leaked into archetype catch-up'},
 {label:'auto-picked tiers arrive without funding their mana',find:'      manaGrowWithMax(cs,mxB);',replace:'',mustFail:'auto-picked spells lost their mana growth'},
 {label:'pre-grant baseline counts archetype mana growth twice',find:/var mxB,rep=abilitySheetHeal[\s\S]*?mxB=manaMax\(cs\);/,replace:function(span){return span.replace('var mxB,','var mxB=manaMax(cs),').replace('      mxB=manaMax(cs);','');},mustFail:'archetype catch-up refilled previously spent mana'},
 {label:'auto-pick growth compares to its own final max',find:'      manaGrowWithMax(cs,mxB);',replace:'      manaGrowWithMax(cs,manaMax(cs));',mustFail:'auto-picked spells lost their mana growth'}]});
