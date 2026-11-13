// #733 public sheet contract, including the seed behind the reported hidden-hut failure.
const assert=require('assert/strict'),engine=require('./load-engine.js');
engine.loadEngine();
let pass=0,fail=0,seen=0;
const onlyAt=process.argv.indexOf('--only'),only=onlyAt<0?null:process.argv[onlyAt+1];
function test(name,fn){if(only&&name!==only)return;seen++;try{fn();pass++;console.log('PASS #733 public '+name);}catch(e){fail++;console.error('FAIL #733 public '+name+' — '+e.stack);}}
global.showToast=function(){};
function setup(){engine.makeTestWorld();atlasForget();atlasCreate('19z1c5t2dzq6');worldState.world.location='The Boundary Clearing';worldState.world.sublocation=null;assert.equal(atlasPublicEnable().ok,true);}
test('the original seed generates the undisclosed hut inside the old visibility radius',()=>{
 const region=TnDMaps.generate('region',{seed:'19z1c5t2dzq6',edits:[{op:'add',id:'a1',name:'The Ironwood Heart',kind:'village',at:[1204,956]}]});
 const wild=TnDMaps.generate('wild',TnDMaps.wild.fromRegion(region,'z451_548'));
 const hut=wild.features.find(f=>f.id==='hut-1');
 assert.ok(hut);assert.equal(hut.name,"Stalgind's Hut");
 assert.ok(Math.hypot(hut.x-400,hut.y-275)*1.25<100,'reported hut is inside the legacy 100 m visibility radius');
 setup();const A=worldState.atlas,doc=atlasDoc(A.seed);
 assert.equal(doc.generator.name,'schematic');assert.equal(doc.features.length,0);
 const outputs=[doc,TnDMaps.scene.build(doc,'ink'),TnDMaps.digest(doc),atlasZones(),atlasMapBlock(),buildGeoBlock('player')];
 assert.ok(!JSON.stringify(outputs).includes('Stalgind'));assert.equal(atlasCard(A.seed,{id:'hut-1'}),null);
});
test('a missing party pointer leaves the last public position untouched and never escapes',()=>{
 setup();const A=worldState.atlas,before=JSON.stringify(A),report=atlasProblem,calls=[];worldState.world.location=null;
 atlasProblem=function(where,e){calls.push(where+': '+e.message);return e.message;};
 try{assert.doesNotThrow(()=>assert.equal(atlasFollow(),null));assert.equal(JSON.stringify(A),before);assert.deepEqual(calls,[],'an ordinary absent pointer is not an unexpected map error');}finally{atlasProblem=report;}
});
test('an unexpected public follow error reports its reason without escaping or advancing',()=>{
 setup();const A=worldState.atlas,before=JSON.stringify(A),real=atlasPointer,report=atlasProblem,calls=[];
 atlasPointer=function(){throw new Error('injected public pointer failure');};atlasProblem=function(where,e){calls.push(where+': '+e.message);return e.message;};
 try{assert.doesNotThrow(()=>atlasFollow());assert.equal(JSON.stringify(A),before);assert.ok(calls.some(x=>x.includes('injected public pointer failure')));}finally{atlasPointer=real;atlasProblem=report;}
});
test('three stationary discoveries change only knowledge and every public surface agrees',()=>{
 setup();const A=worldState.atlas,before=JSON.stringify(worldState.world),old=atlasDoc(A.seed);
 const raw=atlasKnowledgeCommit('[MAP_REVEAL:new|Bear Spring|spring|SW|observed] [MAP_REVEAL:new|The Boar Tree|tree|N|observed] [MAP_REVEAL:new|The Waystone Arch|arch|S|observed]');
 const doc=atlasDoc(A.seed);assert.notEqual(doc,old);assert.equal(doc.features.length,3);assert.equal(JSON.stringify(worldState.world),before);
 doc.features.forEach(f=>{assert.ok(cleanTxt(raw).includes(f.name));assert.equal(atlasCard(A.seed,{id:f.id}).title,f.name);assert.equal(atlasThingShown(A.seed,f),true);});
 assert.equal(atlasReveal(A.seed),null);assert.equal(atlasPartyIn(A.seed).exact,false);assert.ok(!/map is right|Stalgind/.test(atlasMapBlock()));
 assert.equal(atlasDoc(A.seed),doc,'repeat read reuses one document');
});
test('changing place cannot carry discoveries into another container',()=>{
 setup();const A=worldState.atlas;atlasKnowledgeCommit('[MAP_REVEAL:new|Bear Spring|spring|SW|observed]');
 worldState.world.location='Elsewhere';atlasFollow();assert.equal(atlasDoc(A.seed).features.length,0);
 worldState.world.location='The Boundary Clearing';atlasFollow();assert.equal(atlasDoc(A.seed).features.length,1);
});
test('private place classification cannot label a public sheet or change its scene',()=>{
 setup();const A=worldState.atlas,first=JSON.stringify(atlasDoc(A.seed));
 A.kinds['The Boundary Clearing']={kind:'settlement',size:'city',by:'model'};atlasForget();
 assert.equal(JSON.stringify(atlasDoc(A.seed)),first,'private start classification is not public scene input');
 worldState.world.sublocation='Western Trail';atlasFollow();
 assert.equal(atlasZones()[0].kind,'schematic','an outdoor sublocation must not be called an interior');
 assert.equal(atlasWhere().zoneKind,'schematic');
});
test('classifier proposals cannot create public types glyphs or spoken assertions',()=>{
 setup();const A=worldState.atlas;
 const raw=atlasKnowledgeCommit('[MAP_REVEAL:new|High canopy stairs|arch|N|observed] [MAP_REVEAL:new|Crossing shallows|spring|E|observed] [MAP_REVEAL:new|Ventilation stair|ruin|W|reported]');
 const doc=atlasDoc(A.seed),scene=TnDMaps.scene.build(doc,'ink'),cards=doc.features.map(f=>atlasCard(A.seed,{id:f.id}));
 assert.deepEqual(doc.features.map(f=>f.name),['High canopy stairs','Crossing shallows','Ventilation stair']);
 assert(doc.features.every(f=>f.kind==='landmark'),'all public glyphs use the neutral landmark contract');
 const marks=scene.layers.find(l=>l.name==='features').items;assert.equal(marks.length,3);assert(marks.every(c=>c.t==='circle'),'no classifier-specific icon geometry');
 const surfaces=[cleanTxt(raw),doc,scene,TnDMaps.digest(doc),cards,atlasKnowledgePlayerBlock(),buildGeoBlock('player')];
 assert(!/\b(?:arch|spring|ruin)\b/i.test(JSON.stringify(surfaces)),'raw classifier proposals cannot be asserted by a public surface');
 const proposals=Object.values(memory.map.geography.receipts).flatMap(r=>r.events).map(e=>e.proposalKind);
 assert.deepEqual(proposals,['arch','spring','ruin'],'proposal evidence is retained privately');
 assert(Object.values(memory.map.geography.features).every(f=>!Object.prototype.hasOwnProperty.call(f,'kind')),'classification is not an accepted feature attribute');
});
test('public adapter ignores upstream classification and archival quote fields',()=>{
 setup();const real=atlasKnowledgeProjection,A=worldState.atlas;
 atlasKnowledgeProjection=()=>({container:'The Boundary Clearing',revision:99,features:[{id:'f1',label:'High canopy stairs',kind:'arch',bearing:'N',mode:'observed',source:{commit:'archive',turn:0,quote:'A PRIVATE ruin, a spring, and an arch.'}}]});
 try{
  atlasForget();const doc=atlasDoc(A.seed),card=atlasCard(A.seed,{id:'f1'});
  assert.equal(doc.features[0].kind,'landmark');assert.equal(card.title,'High canopy stairs');
  assert.equal(card.word,'Observed · N. Disclosed on turn 0.');
  assert(!/PRIVATE|\b(?:arch|spring|ruin)\b/.test(JSON.stringify([doc,card])));
 }finally{atlasKnowledgeProjection=real;atlasForget();}
});
test('literal public labels remain intact without inferring a type from their nouns',()=>{
 setup();const A=worldState.atlas,raw=atlasKnowledgeCommit('[MAP_REVEAL:new|The Waystone Arch|S|observed]');
 const doc=atlasDoc(A.seed);assert.equal(doc.features.length,1);assert.equal(doc.features[0].name,'The Waystone Arch');assert.equal(doc.features[0].kind,'landmark');
 assert(cleanTxt(raw).includes('The Waystone Arch'));assert(!cleanTxt(raw).includes(', an arch'));
 assert.equal(atlasCard(A.seed,{id:'f1'}).title,'The Waystone Arch');
});
test('reported unknown-position cards cite a turn without echoing the stored proposal',()=>{
 setup();worldState.turn=8;atlasKnowledgeCommit('[MAP_REVEAL:new|Ventilation stair|ruin|unknown|reported]');
 const card=atlasCard(worldState.atlas.seed,{id:'f1'});
 assert.equal(card.word,'Reported · Position not established. Disclosed on turn 8.');
 assert(!Object.prototype.hasOwnProperty.call(atlasKnowledgeProjection().features[0].source,'quote'));
});

test('normalized map things preserve unknown-position metadata for camera decisions',()=>{
 setup();atlasKnowledgeCommit('[MAP_REVEAL:new|A northern stone|N|observed] [MAP_REVEAL:new|The distant cairn|unknown|reported]');
 const doc=atlasDoc(worldState.atlas.seed),before=JSON.stringify(doc),things=atlasThings(doc);
 assert.equal(things.find(f=>f.name==='A northern stone').unplaced,false);
 assert.equal(things.find(f=>f.name==='The distant cairn').unplaced,true,'a ledger coordinate must never become a camera target');
 assert.equal(JSON.stringify(doc),before,'the normalization is read-only');
});

if(!seen){console.error('matched 0 tests');process.exit(1);}console.log((fail?'RED':'ALL GREEN')+' — '+pass+' public map groups, '+fail+' failures');process.exit(fail?1:0);
