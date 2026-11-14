// #744: accumulated public sheets and landscape descriptions have only disclosed sources.
'use strict';
const assert=require('assert/strict'),cp=require('child_process'),path=require('path'),vm=require('vm'),engine=require('./load-engine.js');engine.loadEngine();
const onlyAt=process.argv.indexOf('--only'),only=onlyAt<0?null:process.argv[onlyAt+1];let pass=0,fail=0,seen=0,notes=[];
function test(name,fn){if(only&&only!==name)return;seen++;try{fn();pass++;console.log('PASS #744 public '+name);}catch(e){fail++;console.error('FAIL #744 public '+name+'\n'+e.stack);}}
function setup(place='Origin'){engine.makeTestWorld();worldState.campId='public-744';memory.campId=worldState.campId;worldState.world.location=place;worldState.world.sublocation=null;memory.map.nodes={};memory.map.edges=[];atlasForget();notes=[];global.showToast=x=>notes.push(String(x));return atlasCreate('public-744',{knowledge:true});}
function disclose(label,bearing='unknown',mode='observed'){return atlasKnowledgeCommit('[MAP_REVEAL:new|'+label+'|'+bearing+'|'+mode+']');}
function travel(place){worldState.world.location=place;worldState.world.sublocation=null;assert(atlasFollow(),'public follow must succeed');return worldState.atlas.at;}
function bytes(){return JSON.stringify({worldState,memory,sessionLog});}
function feature(id,label,bearing='unknown',mode='observed'){return {id,label,bearing,mode};}

test('recovery retains current visited and receipted scopes while withholding seeded nodes',()=>{
 const A=setup('Current');delete A.publicPlaces;
 memory.map.nodes.Visited=newMapNode(1,null,{visits:2,firstVisit:1});
 memory.map.nodes.Seeded=newMapNode(0,null,{visits:0,description:'PRIVATE tower and road to Hidden Keep.'});
 memory.map.nodes['Hidden Keep']=newMapNode(0,null,{visits:0});
 worldState.world.location='Receipt only';disclose('Standing stones','N');worldState.world.location='Current';
 const before=bytes(),rows=atlasPublicPlacesList(A);
 assert.deepEqual(rows.map(r=>r.container),['Current','Visited','Receipt only']);
 assert.equal(rows[0].id,A.seed);assert.equal(bytes(),before,'recovery reads cannot write a registry or geography');
 assert(!JSON.stringify(rows).includes('PRIVATE'));assert(!JSON.stringify(rows).includes('Hidden Keep'));
 for(let i=0;i<20;i++)assert.deepEqual(atlasPublicPlacesList(A),rows);
 assert.equal(bytes(),before);
});

test('travel returns to stable sheets and notes without moving the party during selection',()=>{
 const A=setup('Boundary Post'),origin=A.at;disclose('First Pact stones','S');
 assert.equal(atlasNoteSet(origin,'f1','A promise at the stones.').ok,true);
 const destination=travel('Riverford');disclose('Stone bridge','W');
 assert.notEqual(destination,origin);assert.equal(atlasZones().length,2);
 const before=bytes(),oldDoc=atlasDoc(origin),newDoc=atlasDoc(destination);
 assert.deepEqual(oldDoc.features.map(f=>f.name),['First Pact stones']);assert.deepEqual(newDoc.features.map(f=>f.name),['Stone bridge']);
 assert.equal(atlasCard(origin,{id:'f1'}).note,'A promise at the stones.');assert.equal(atlasCard(origin,{id:'f2'}),null);
 assert.equal(atlasCard(destination,{id:'f1'}),null);assert.equal(atlasPartyIn(origin),null);assert(atlasPartyIn(destination));
 assert.equal(atlasPublicTitle(origin),'Boundary Post');assert.equal(atlasPublicTitle(destination),'Riverford');
 assert.equal(bytes(),before,'reading a former sheet cannot follow or modify the party');
 assert.equal(travel('Boundary Post'),origin);assert.equal(atlasNote(origin,'f1'),'A promise at the stones.');
 assert.equal(travel('Riverford'),destination);assert.equal(atlasZones().length,2);
 const saved=JSON.parse(bytes());global.worldState=saved.worldState;global.memory=saved.memory;global.sessionLog=saved.sessionLog;atlasForget();
 assert.equal(atlasDoc(origin).features[0].name,'First Pact stones');assert.equal(atlasDoc(destination).features[0].name,'Stone bridge');assert.equal(atlasNote(origin,'f1'),'A promise at the stones.');
});

test('canonical aliases coalesce sheets without losing either source feature or note',()=>{
 const A=setup('Old Post'),old=A.at;memory.map.nodes['Old Post']=newMapNode(0,null,{visits:1});disclose('Old milepost','N');
 assert.equal(atlasNoteSet(old,'f1','Weathered mark.').ok,true);
 const current=travel('King Post');memory.map.nodes['King Post']=newMapNode(1,null,{visits:1});disclose('Gatehouse','S');
 assert.equal(atlasNoteSet(current,'f2','Ask for shelter.').ok,true);
 assert(locMerge('King Post','Old Post',{muts:[],turn:worldState.turn}));const before=bytes(),rows=atlasZones();
 assert.equal(rows.length,1);assert.equal(rows[0].container,'King Post');assert.equal(rows[0].name,'King Post');
 for(const id of [old,current]){assert.equal(atlasPublicPlace(A,id).id,rows[0].id);assert.deepEqual(atlasDoc(id).features.map(f=>f.name),['Old milepost','Gatehouse']);assert.equal(atlasCard(id,{id:'f1'}).note,'Weathered mark.');assert.equal(atlasCard(id,{id:'f2'}).note,'Ask for shelter.');}
 assert.equal(bytes(),before);assert(atlasPublicFollow());assert.equal(A.at,rows[0].id);assert.equal(Object.keys(A.publicPlaces.places).length,2,'alias reads preserve old sheet identity evidence');
});

test('the 1024 place boundary preserves all sheets and refuses overflow atomically',()=>{
 const A=setup();for(let i=1;i<1024;i++)memory.map.nodes['Place '+i]=newMapNode(i,null,{visits:1,firstVisit:i});
 assert(atlasPublicPlacesFollow(A));assert.equal(atlasPublicPlacesList(A).length,1024);assert.equal(atlasPublicPlacesProblem(A,A.publicPlaces),'');
 const store=JSON.stringify(A.publicPlaces),origin=A.at;worldState.world.location='Overflow';
 assert.throws(()=>atlasPublicPlacesFollow(A),/1024.*limit/i);assert.equal(JSON.stringify(A.publicPlaces),store);assert.equal(A.at,origin);
 const where=atlasWhere();assert.equal(where.placed,false,'an unmapped arrival cannot report the party on the prior sheet');assert(!where.text.includes('party is in Origin'),'the refused follow cannot move the world pointer back in its description');
 const before=bytes();for(let i=0;i<5;i++)assert.equal(atlasPublicPlacesList(A).length,1024);assert.equal(bytes(),before);
});

test('damaged registries fail closed without silently rebuilding from private recipes',()=>{
 const A=setup(),good=JSON.parse(JSON.stringify(A.publicPlaces));
 const bad=[null,{},Object.assign({},good,{next:0}),Object.assign({},good,{secret:'PRIVATE'}),Object.assign({},good,{places:{}})];
 const wrongId=JSON.parse(JSON.stringify(good));wrongId.places['private-zone']={container:'Private Keep',name:'Private Keep',turn:0};bad.push(wrongId);
 const duplicate=JSON.parse(JSON.stringify(good));duplicate.next=2;duplicate.places[A.seed+'/public/1']=Object.assign({},duplicate.places[A.seed]);bad.push(duplicate);
 const badTurn=JSON.parse(JSON.stringify(good));badTurn.places[A.seed].turn=-1;bad.push(badTurn);
 for(const broken of bad){A.publicPlaces=broken;const before=bytes();assert.throws(()=>atlasPublicPlacesList(A),/public|invalid|malformed/i);assert.throws(()=>atlasDoc(A.seed),/public|invalid|malformed/i);assert.equal(bytes(),before);}
});

test('whole place phrases supply scenery without extracting nouns from building names',()=>{
 assert.deepEqual(atlasPublicLandscape('The Forest Road',[]),{terrain:['forest'],routes:[{id:'here',kind:'road',bearing:'unknown'}]});
 assert.deepEqual(atlasPublicLandscape('The Boundary Clearing',[]),{terrain:['clearing'],routes:[]});
 for(const title of ["River King's Inn",'Forest Gate Tavern','Marsh Warden Tower','The Woodland House'])assert.deepEqual(atlasPublicLandscape(title,[]),{terrain:[],routes:[]},title);
 const observed=atlasPublicLandscape('Boundary Post',[feature('f1','deep timber'),feature('f2','southern marsh','S')]);assert.deepEqual(observed.terrain,['forest','marsh']);
 for(const [label,kind] of [['Old Mine Track','path'],['old cart track','path'],['stone road','road'],['dirt path','path'],['gravel trail','path'],['trade road','road'],['farm road','road']])assert.deepEqual(atlasPublicLandscape('Boundary Post',[feature('route',label,'N')]),{terrain:[],routes:[{id:'route',kind,bearing:'N',feature:'route'}]},label);
 for(const title of ['Old Mine Track Tavern','Cart Road Inn','Gravel Trail House'])assert.deepEqual(atlasPublicLandscape(title,[]),{terrain:[],routes:[]},title);

});

test('reported landscapes and unknown-position routes cannot add physical geometry',()=>{
 const reported=atlasPublicLandscape('Boundary Post',[feature('f1','deep timber','N','reported'),feature('f2','river','E','reported'),feature('f3','Forest Road','W','reported')]);
 assert.deepEqual(reported,{terrain:[],routes:[]});
 const unknown=atlasPublicLandscape('Boundary Post',[feature('f1','river'),feature('f2','old path'),feature('f3','Forest Road')]);assert.deepEqual(unknown.routes,[]);
 const located=atlasPublicLandscape('Boundary Post',[feature('f1','river','E'),feature('f2','old path','N')]);
 assert.deepEqual(located.routes,[{id:'f1',kind:'river',bearing:'E',feature:'f1'},{id:'f2',kind:'path',bearing:'N',feature:'f2'}]);
});

test('landscape derivation is deterministic bounded and leaves evidence unchanged',()=>{
 const features=[];for(let i=0;i<45;i++)features.push(feature('f'+i,i%2?'river':'forest path',i%2?'E':'W'));
 features.push(feature('marsh','marsh'));features.push(feature('grass','meadow'));features.push(feature('hills','hills'));features.push(feature('water','lake'));
 const before=JSON.stringify(features),first=atlasPublicLandscape('Boundary Post',features);
 assert.equal(first.routes.length,32);assert.equal(first.terrain.length,4);
 for(let i=0;i<20;i++)assert.deepEqual(atlasPublicLandscape('Boundary Post',features),first);
 assert.equal(JSON.stringify(features),before);assert(!Object.keys(first).some(k=>/distance|coordinate|identity|edge/i.test(k)));
});


test('atlas v2 recovery retains earlier visited sheets current scope and feature notes',()=>{
 const A=setup('Boundary Post');disclose('First Pact stones','N');assert.equal(atlasNoteSet(A.at,'f1','Keep the oath.').ok,true);
 memory.map.nodes['Boundary Post']=newMapNode(0,null,{visits:1,firstVisit:0});
 memory.map.nodes['Earlier Camp']=newMapNode(2,null,{visits:3,firstVisit:2});
 memory.map.nodes['Private Keep']=newMapNode(0,null,{visits:0,description:'PRIVATE fallback map.'});
 worldState.world.location='Riverford';disclose('Stone bridge','W');A.v=2;delete A.publicPlaces;A.at=A.seed;
 const knowledge=JSON.stringify(memory.map.geography),notes=JSON.stringify(A.publicNotes);
 assert.equal(atlasHeal(),true);assert.equal(A.v,ATLAS_VER);assert(atlasPublicFollow());
 assert.deepEqual(new Set(atlasZones().map(p=>p.container)),new Set(['Riverford','Boundary Post','Earlier Camp']));
 assert.equal(atlasPublicPlace(A,A.at).container,'Riverford');assert.equal(JSON.stringify(memory.map.geography),knowledge);assert.equal(JSON.stringify(A.publicNotes),notes);
 const origin=atlasZones().find(p=>p.container==='Boundary Post');assert.equal(atlasCard(origin.id,{id:'f1'}).note,'Keep the oath.');
 const before=bytes();assert.equal(atlasHeal(),false);assert.equal(bytes(),before);assert(!JSON.stringify(atlasZones()).includes('Private Keep'));
});

test('the actual SAVE13 client refuses SAVE14 maps before parse load or import writes',()=>{
 setup('Boundary Post');disclose('First Pact stones','N');const payload=JSON.stringify({worldState,memory,sessionLog}),world=serializeWorldState();assert.equal(JSON.parse(world).ver,14);
 const ref='56b6f036cb195a330d75c40c14bfdc0ba67af3a1',root=path.join(__dirname,'..'),env=Object.fromEntries(Object.entries(process.env).filter(([k])=>!k.startsWith('GIT_'))),warnings=[],disk=Object.create(null);
 const old=vm.createContext({console:{log(){},info(){},warn(...v){warnings.push(v.join(' '));},error(...v){warnings.push(v.join(' '));}},localStorage:{getItem:k=>Object.prototype.hasOwnProperty.call(disk,k)?disk[k]:null,setItem:(k,v)=>{disk[k]=String(v);},removeItem:k=>{delete disk[k];}}});
 for(const file of ['globals.js','helpers.js','state.js']){const source=cp.execFileSync('git',['-c','safe.directory='+root,'show',ref+':'+file],{cwd:root,env,encoding:'utf8',maxBuffer:8*1024*1024});vm.runInContext(source,old,{filename:ref.slice(0,8)+'/'+file});}
 assert.equal(old.SAVE_VER,13,'the compatibility check must execute actual older source');old.incomingWorld=world;old.incomingPayload=payload;
 let before=JSON.stringify(disk);assert.throws(()=>vm.runInContext('parseWorldState(incomingWorld)',old),e=>e.incompatible===true&&/save v14/.test(e.message)&&/reads v13/.test(e.message));assert.equal(JSON.stringify(disk),before);
 disk[old.WSK]=world;disk[old.SLK]='[]';disk[old.MEM_KEY]=JSON.stringify(memory);before=JSON.stringify(disk);
 assert.equal(vm.runInContext('loadState()',old),false);assert.match(old.versionRefusedLoad(),/save v14/);assert.equal(JSON.stringify(disk),before);
 old.worldState={sentinel:'outgoing world'};old.memory={sentinel:'outgoing memory'};old.sessionLog=[{sentinel:'outgoing log'}];const live=vm.runInContext('JSON.stringify([worldState,memory,sessionLog])',old);
 assert.throws(()=>vm.runInContext('importSaveData(JSON.parse(incomingPayload))',old),/save v14/);assert.equal(vm.runInContext('JSON.stringify([worldState,memory,sessionLog])',old),live);assert.equal(JSON.stringify(disk),before);
 assert(warnings.some(w=>w.includes('local load REFUSED')));assert(warnings.some(w=>w.includes('.tnd import REFUSED')));
});


test('foreign campaign memory cannot supply public sheets features or recovered names',()=>{
 for(const missing of [false,true]){
  const A=setup('Boundary Post'),candidate=JSON.parse(JSON.stringify(A.publicPlaces));disclose('Foreign sentinel','N');memory.campId='other-campaign';memory.map.nodes['Other campaign shrine']=newMapNode(1,null,{visits:5,firstVisit:1});
  if(missing)delete A.publicPlaces;const before=bytes(),draft=JSON.stringify(candidate);
  assert.throws(()=>atlasPublicPlacesRead(A),/campaign|owner|belongs/i,'persisted or recovered public sheets must refuse foreign memory');
  assert.throws(()=>atlasPublicPlacesRecover(A,candidate),/campaign|owner|belongs/i,'direct recovery cannot gather foreign visit names');
  assert.throws(()=>atlasDoc(A.seed),/campaign|owner|belongs/i);assert.equal(bytes(),before);assert.equal(JSON.stringify(candidate),draft);
 }
});


test('a late recovery overflow cannot install a partially extended public registry',()=>{
 const A=setup();for(let i=1;i<1023;i++)memory.map.nodes['Known '+i]=newMapNode(i,null,{visits:1,firstVisit:i});
 assert(atlasPublicPlacesFollow(A));assert.equal(atlasPublicPlacesList(A).length,1023);
 memory.map.nodes['Earlier unregistered camp']=newMapNode(1,null,{visits:1,firstVisit:1});worldState.world.location='New arrival';
 const before=bytes(),store=JSON.stringify(A.publicPlaces);
 assert.throws(()=>atlasPublicPlacesFollow(A),/1024.*limit/i);assert.equal(JSON.stringify(A.publicPlaces),store);assert.equal(bytes(),before,'preparing the arrival cannot publish it before later recovery succeeds');
});

if(!seen)throw Error('matched 0 tests');console.log(pass+' passed, '+fail+' failed');process.exitCode=fail?1:0;
