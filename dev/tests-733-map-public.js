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
if(!seen){console.error('matched 0 tests');process.exit(1);}console.log((fail?'RED':'ALL GREEN')+' — '+pass+' public map groups, '+fail+' failures');process.exit(fail?1:0);
