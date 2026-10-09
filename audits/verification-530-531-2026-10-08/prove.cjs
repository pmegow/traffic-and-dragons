// Attributed failure-condition proof. All mutations execute in dev/sabotage.js scratch clones.
const path=require('path'),S=require(path.resolve(__dirname,'../../dev/sabotage.js'));
const command=['node',['audits/verification-530-531-2026-10-08/acceptance.cjs']];
let code=0;function prove(file,cases){if(!code)code=S.prove({file,command,cases});}
prove('identity.js',[
 {label:'#530 ANOTHER blocked again under active scene refs',find:'if(ans.kind!=="plain"&&ans.kind!=="other")return true;',replace:'if(ans.kind==="same")return true;',mustFail:'FAIL #530 ANOTHER lands and stays settled; refs=true'},
 {label:'#530 OTHER skips its required proposal',find:'  if(O)return {kind:"other",canon:O,dupe:P};',replace:'  if(O)return {kind:"same",canon:O,dupe:P};',mustFail:'FAIL #530 OTHER uses known-key confirmation; refs=true'},
 {label:'#531 scene binding points the queen handle at the princess',find:'var a=_sceneRefActor(h),canon=(raw==="?"||raw==="-"||!raw)?null:resolveNpcName(raw);',replace:'var a=_sceneRefActor(h),canon=(raw==="?"||raw==="-"||!raw)?null:resolveNpcName(raw==="Queen Underbough"?"Wilhelmina Underbough":raw);',mustFail:'FAIL #531 valid scene death with binding'},
 {label:'#531 combat presence goes to the princess',find:'while((m=re.exec(text)))take(m[1],"combat",fightAt(m.index));\n  re=/\\[ENEMY_HP:',replace:'while((m=re.exec(text)))take("Wilhelmina Underbough","combat",fightAt(m.index));\n  re=/\\[ENEMY_HP:',mustFail:'FAIL #531 combat presence belongs to title, never relative'}
]);
prove('memory.js',[{label:'#531 titled death consolidates onto the princess',find:'  if(c.ask)return name;\n',replace:'',mustFail:'FAIL #531 reported death actually kills the titled queen'}]);
process.exitCode=code;
