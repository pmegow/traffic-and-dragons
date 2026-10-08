const fs=require('fs'),path=require('path'),vm=require('vm'),cp=require('child_process'),root='C:/Projects/traffic-and-dragons';
const L=require(root+'/dev/load-engine.js');L.loadEngine();
global.showToast=function(){};global.syncUI=function(){};global.saveAll=function(){};global.checkLevelUp=function(){};global.checkCompanionLevelUp=function(){};
let warnings=[];const warn=console.warn;console.warn=(...s)=>warnings.push(s.join(' '));
function units(inv){const o=Object.create(null);for(const s of inv||[]){let n=_invBase(s);o[n]=(o[n]||0)+_invCount(s);}return o;}
function seed(hero,comp,chest){L.makeTestWorld();worldState.character.inventory=hero.slice();let h=null;
if(chest){worldState.kind='village';worldState.character.name='Silas';worldState.world.location='The Village';memory.map={nodes:{'The Village':{firstVisit:1,visits:1,parent:null,npcs:[],items:[]}},edges:[],lastArrivalFrom:null};villageHouseEnsure('Silas',null);worldState.world.sublocation="Silas's house";worldState.stashMoves=[];h=memory.map.nodes[villageHouseKey('Silas')];h.items=[{name:'Healing potion',placed:1,taken:false,qty:1,by:'Silas',min:0}];}
worldState.npcs.push({name:'Bram',status:'ally',rel:'companion',partyMember:true,charSheet:{name:'Bram',inventory:comp.slice()}});memory.npcs.Bram={knowledge:[],events:[],aliases:[],partyMember:true};return h;}
function run(id,hero,comp,text,chest){warnings=[];const house=seed(hero,comp,chest),before={hero:units(hero),companion:units(comp),chest:house?JSON.parse(JSON.stringify(house.items)):[]};let R=null,error=null;try{R=applyMuts(text);}catch(e){error=e.stack;}return {id,input:text,prose:cleanTxt(text),before,after:{hero:units(worldState.character.inventory),companion:units(findCompanionChar('Bram').inventory),chest:house?house.items:[]},R,warnings:warnings.slice(),error};}
const cases=[
run('518-exact-independent-loot-untracked-throw',[],[],'You loot a dagger. [ITEM_GAINED:Dagger] Bram throws his dagger. [COMPANION_ITEM_LOST:Bram|Dagger]'),
run('negative-unrelated-item-name',[],[],'You loot a dagger. [ITEM_GAINED:Dagger] Bram throws his spear. [COMPANION_ITEM_LOST:Bram|Spear]'),
run('control-genuine-take-missing',[],[],'Bram gives you his dagger. [ITEM_GAINED:Dagger] [COMPANION_ITEM_LOST:Bram|Dagger]'),
run('control-gift-cap',['Torch'],[],'You give Bram your torches. [ITEM_LOST:Torch x3][COMPANION_ITEM_GAINED:Bram|Torch x3]'),
run('control-gift-full',['Torch x3'],[],'You give Bram three torches. [ITEM_LOST:Torch x3][COMPANION_ITEM_GAINED:Bram|Torch x3]'),
run('control-unpaired-gain',[],[],'Bram finds two torches. [COMPANION_ITEM_GAINED:Bram|Torch x2]'),
run('control-take-cap',[],['Torch'],'Bram gives you his torches. [COMPANION_ITEM_LOST:Bram|Torch x3][ITEM_GAINED:Torch x3]'),
run('control-take-empty',[],[],'Bram gives you his torches. [COMPANION_ITEM_LOST:Bram|Torch x3][ITEM_GAINED:Torch x3]'),
run('control-gift-at-home',['Healing potion'],[],'You give Bram your potion. [ITEM_LOST:Healing potion][COMPANION_ITEM_GAINED:Bram|Healing potion]',true)
];
fs.writeFileSync(path.join(__dirname,'518-controls.json'),JSON.stringify(cases,null,2));
const src=fs.readFileSync(root+'/dev/census-inventory-rows.js','utf8');const ref=src.slice(src.indexOf('function parseStored'),src.indexOf('// ---- which saves'));
vm.runInThisContext(ref,{filename:'census-reference-extracted.js'});
const original=['Axe','Shield','Torch x3'],worn=['Shield','Axe'];let base=invRows(original,worn).rows;
const eq=(a,b)=>JSON.stringify(a)===JSON.stringify(b),texts=r=>r.map(invText),eqnames=r=>r.filter(x=>x.equipped).map(x=>x.name);
const mutations=[['baseline',base],['drop-equipped-only',base.map(r=>({...r,equipped:false}))],['reorder-inventory',base.slice().reverse()],['equipped-output-pack-order',base],['unknown-field-drop',invRows([{name:'Axe',qty:1,equipped:true,slot:'hand',future:{v:7}}],[]).rows]];
const sensitivity=mutations.map(([id,r])=>({id,observed:r,existingCensusUnitTextWouldAccept:id==='unknown-field-drop'?null:eq(texts(r),original),proposedEquippedSetWouldAccept:id==='unknown-field-drop'?null:eq(eqnames(r).slice().sort(),worn.slice().sort()),referenceIdempotent:eq(invRows(r,[]).rows,r),referenceUnknownFieldPreserved:id==='unknown-field-drop'?r[0].slot==='hand'&&r[0].future?.v===7:null,approvedEquippedOutput:eqnames(r).join(', ')}));
let rowFixture=base.map(x=>({...x}));seed([],[]);worldState.character.inventory=rowFixture;const snapshot=inventorySnapshot();
sensitivity.push({id:'typeof-string-reader',observedSnapshot:snapshot,expectedRows:rowFixture.length,observedEntries:Object.keys(snapshot).length,existingBehavior:'skips all rows',proposedStaticGate:'not implemented'});
seed(original,[]);relationshipMigrateSheet(worldState.character);sensitivity.push({id:'skip-admission-heal',observedInventory:worldState.character.inventory,inventoryHealExists:typeof global.invHealSheet,existingBehavior:'current relationship adapter retains strings; row heal is proposed only'});
fs.writeFileSync(path.join(__dirname,'sensitivity-reference.json'),JSON.stringify(sensitivity,null,2));
const fixtureDir=path.join(__dirname,'fixtures');fs.mkdirSync(fixtureDir,{recursive:true});fs.writeFileSync(path.join(fixtureDir,'synthetic.tnd'),JSON.stringify({worldState:{character:{name:'Synthetic',inventory:original,worn},npcs:[]}}));
let actual=[];for(const [id,patch] of [['baseline',null],['drop-equipped-only','m.rows.forEach(function(r){r.equipped=false;});'],['reorder-inventory','m.rows.reverse();']]){
let body=src.replace('require("./load-engine.js")','require('+JSON.stringify(root+'/dev/load-engine.js')+')');if(patch)body=body.replace('var m = invRows(inv, s.worn);','var m = invRows(inv, s.worn);'+patch);
const f=path.join(__dirname,'census-'+id+'.cjs');fs.writeFileSync(f,body);const r=cp.spawnSync(process.execPath,[f,fixtureDir],{encoding:'utf8'});actual.push({id,status:r.status,stdout:r.stdout,stderr:r.stderr});}
fs.writeFileSync(path.join(__dirname,'sensitivity-actual-census.json'),JSON.stringify(actual,null,2));
let rows=invRows(original,worn).rows,first=JSON.stringify(rows),newRefs=0,bytesMin=Infinity,bytesMax=0;const started=process.hrtime.bigint();for(let n=0;n<1000;n++){let next=invRows(rows,[]).rows;if(next!==rows)newRefs++;rows=next;const len=Buffer.byteLength(JSON.stringify(rows));bytesMin=Math.min(bytesMin,len);bytesMax=Math.max(bytesMax,len);texts(rows);}
const resources={iterations:1000,milliseconds:Number(process.hrtime.bigint()-started)/1e6,initialRows:base.length,finalRows:rows.length,bytesMin,bytesMax,arrayReferenceReplacements:newRefs,rowDeepEquality:eq(rows,base),oldReferencesRetainedByProbe:0,kind:'reference-model-only; not shipping invHealSheet'};
fs.writeFileSync(path.join(__dirname,'resources.json'),JSON.stringify(resources,null,2));console.warn=warn;
console.log(JSON.stringify({cases:cases.map(c=>({id:c.id,after:c.after,muts:c.R&&c.R.muts,error:c.error})),actual,sensitivity,resources},null,2));
