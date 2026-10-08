const assert=require('assert/strict'),e=require('./load-engine.js');e.loadEngine();
assert.equal(endingNameToken('Mr.Fox'),'Fox','dotted title is not identifying word');
assert.equal(textNamesPerson('Tom Jones stayed.','Tom',['Tom','Tom Jones']),false,'short hero must not steal named companion');
for(const [a,b] of [['[',']'],['(',')'],['“','”'],['**','**'],['`','`']]){
 const r='José said “stay.”';assert.equal(denouementSplit('You stayed.\n'+a+'RECORD: '+r+b).record,r,'matched outer '+a);
 assert.equal(denouementSplit('You stayed.\nRECORD: José saw [home].').record,'José saw [home].');
}
console.log('PASS #525 adversarial identity and matched wrappers');

for(const label of ['**RECORD**: ','__RECORD__: ','`RECORD`: ','RECORD. ']){assert.deepEqual(denouementSplit('You return.\n\n'+label+'Tess survived.'),{prose:'You return.',record:'Tess survived.'},'decorated label leaked '+label);}
const names=['José','Mr.Fox','The Gray Fox','Иван','דוד','أموت','रवि','李','Zoë','(Rook)','Tom Smith'];
const scripts=['You came home.','عدت إلى البيت','שבת הביתה','आप लौटे','คุณกลับบ้าน','ተመለስክ','帰った'];
const labels=['RECORD: ','RECORD—','RECORD：','## RECORD\n','1. RECORD: ','**RECORD:** ','RECORD (one sentence): ','[RECORD: '];
let cases=0;
for(const name of names)for(const prose of scripts)for(const label of labels){
 const record=name+' stayed.',raw=prose+'\n\n'+label+record+(label[0]==='['?']':'')+'\n\nTHE END',parts=denouementSplit(raw);
 assert.equal(parts.prose,prose+'\n\nTHE END');assert.equal(parts.record,record);
 const repaired=endingMomentText(name,prose,names);for(let i=0;i<10;i++)assert.equal(endingMomentText(name,repaired,names),repaired);cases++;
}
for(const seam of ['buildSysPrompt','buildEngineNotes','buildDenouementPrompt','migrateWorldState']){
 e.makeTestWorld();worldState.character.name='Current Hero';const source={name:'Resident',gender:'F',hp:10,maxHp:10,coreMemories:[{kind:'ending',who:'José',text:'You kept the lantern.',camp:'Earlier Tale',turn:4}]};
 const before=JSON.stringify(source),row={name:'Resident',status:'ally',partyMember:false};worldState.npcs=[row];adoptLibraryCompanion(row,source,1);
 global[seam]();assert.equal(row.charSheet.coreMemories[0].text,"José's ending: You kept the lantern.",seam+' missed adopted resident');assert.equal(JSON.stringify(source),before,'external library input mutated');
 const after=JSON.stringify(row.charSheet.coreMemories);for(let i=0;i<20;i++)global[seam]();assert.equal(JSON.stringify(row.charSheet.coreMemories),after,seam+' grows records');
}
console.log('PASS #525 '+cases+' script/name/label generated cases and four real adopted-sheet reader seams');

for(const stop of ['。','؟','！','။','።'])assert.deepEqual(denouementSplit('You return.\nRECORD:\nTess survived'+stop+'\nYou walk home.'),{prose:'You return.\nYou walk home.',record:'Tess survived'+stop},'multiline record consumed prose after '+stop);

let seed=525;function rng(n){seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed%n;}
for(let i=0;i<400;i++){const prose=Array.from({length:1+rng(7)},()=>scripts[rng(scripts.length)]).join(rng(2)?' ':'\n\n'),name=names[rng(names.length)],raw=prose+'\n\n**RECORD**: '+name+' stayed.';assert.equal(denouementSplit(raw).prose,prose,'seeded fuzz altered narration');}
console.log('PASS #525 deterministic seed 525: 400 mixed-script narration cases');
const wrapperPairs=[['**','**'],['__','__'],['*','*'],['_','_'],[String.fromCharCode(96),String.fromCharCode(96)],['[',']'],['(',')'],['<','>'],['"','"'],["'","'"],['“','”'],['‘','’']];
for(const [a,b] of wrapperPairs)for(const prefix of ['', '1. ', '## '])for(const shape of ['label','whole']){
 const raw=prefix+(shape==='label'?a+'RECORD'+b+': José stayed.':a+'RECORD: José stayed.'+b);
 assert.deepEqual(denouementSplit('You return.\n'+raw),{prose:'You return.',record:'José stayed.'},'wrapper matrix '+raw);
}
