// #733: migration must preserve legacy evidence and keep every public read behind the knowledge boundary.
// Uses real save/load/import/identity functions; only platform storage, UI and network are replaced.
"use strict";
const assert=require("assert/strict"),engine=require("./load-engine.js");
engine.loadEngine();
const tests=[],onlyAt=process.argv.indexOf("--only"),only=onlyAt<0?null:process.argv[onlyAt+1];
function test(name,fn){if(!only||only===name)tests.push({name,fn});}
const copy=o=>JSON.parse(JSON.stringify(o)),bytes=()=>JSON.stringify({worldState,memory,sessionLog});
const oldConsole={warn:console.warn,info:console.info,error:console.error};
let notices=[],platform=Object.create(null);
console.warn=(...v)=>notices.push(v.join(" "));console.info=(...v)=>notices.push(v.join(" "));console.error=(...v)=>notices.push(v.join(" "));
global.localStorage={getItem:k=>Object.prototype.hasOwnProperty.call(platform,k)?platform[k]:null,setItem:(k,v)=>{platform[k]=String(v);},removeItem:k=>{delete platform[k];}};
global.showToast=m=>notices.push(String(m));global.audioScenePublish=()=>{};
global.storageAdapter={syncToServer:()=>{},resetSyncState:()=>{},flushDirtyTurn:()=>null,markFlushDirty:()=>{},clearFlushDirty:()=>{}};
const PRIVATE="UNINTRODUCED_STALGIND_CELLAR_733";
function setup(){
  engine.makeTestWorld();notices=[];platform=Object.create(null);global._m={};global._mKeys={};
  worldState.world.location="The Boundary Clearing";worldState.world.sublocation=null;
  memory.map.nodes[worldState.world.location]=newMapNode(0,null,{description:PRIVATE});
  const seed="migration-733",zones=Object.create(null);
  zones[seed]={kind:"region",parent:null,via:null,params:{seed},name:PRIVATE+" region",lib:TnDMaps.VERSION,fp:"untrusted-private-fingerprint",turn:0};
  [{id:"private-town",kind:"town",parent:seed},{id:"private-wild",kind:"wild",parent:seed},{id:"private-interior",kind:"interior",parent:"private-town"},{id:"private-dungeon",kind:"dungeon",parent:"private-town"}].forEach(z=>{zones[z.id]={kind:z.kind,parent:z.parent,via:{id:PRIVATE},params:{seed:z.id,title:PRIVATE+" "+z.kind},name:PRIVATE+" "+z.kind,lib:TnDMaps.VERSION,fp:"private",turn:0};});
  worldState.atlas={v:ATLAS_VER,seed,at:"private-interior",spot:{id:"secret-room"},off:{reason:PRIVATE},ptr:"legacy",zones,names:{"Private Room":{zone:"private-interior",id:"secret-room"}},adds:{private:{zone:"private-town",id:"private-building"}},kinds:{},notes:{"private-interior|secret-room":PRIVATE},seen:{"private-interior":{ids:["secret-room"]}},told:[PRIVATE],adopt:true};
  atlasForget();assert.equal(atlasShapeProblem(worldState.atlas),null);return worldState.atlas;
}
function enable(){const r=atlasPublicEnable();assert(r.ok,r.reason);return r;}
function disclose(raw,token="migration-public"){const out=atlasKnowledgeCommit(raw,atlasKnowledgeRead(raw),{commit:token});assert(!notices.some(n=>n.includes("no new map discoveries")),notices.join("\n"));return out;}
const hut="[MAP_REVEAL:new|a hut|hut|W|observed]";
function publish(){setup();enable();disclose(hut);return worldState.atlas;}
function publicBytes(){const A=worldState.atlas,d=atlasDoc(A.seed);return JSON.stringify({doc:d,scene:TnDMaps.scene.build(d,"ink"),digest:TnDMaps.digest(d),zones:atlasZones(),trail:atlasTrailItems(A.seed),where:atlasWhere(),prompt:atlasMapBlock()});}

test("activation retains an exact detached backup of recipes notes visits and identities",()=>{const A=setup(),before=JSON.stringify(A),worldPointer=JSON.stringify(worldState.world);enable();assert.equal(JSON.stringify(A.legacyAtlas),before);assert.notEqual(A.legacyAtlas,A);assert.equal(JSON.stringify(worldState.world),worldPointer);assert.equal(A.knowledge,1);assert.equal(A.v,ATLAS_VER);assert.equal(worldState.ver,SAVE_VER);assert.equal(Object.keys(memory.map.geography.features).length,0);A.zones[A.seed].name="changed private name";assert.equal(JSON.stringify(A.legacyAtlas),before);});
test("repeated activation is byte identical and never nests or replaces the backup",()=>{publish();const before=bytes(),r=atlasPublicEnable();assert(r.ok&&r.already);assert(bytes()===before,"refusal must preserve the world-memory pair byte for byte");assert.equal(worldState.atlas.legacyAtlas.legacyAtlas,undefined);});
test("all five legacy scale recipes remain withheld from every public map surface",()=>{const A=setup();enable();const d=atlasDoc(A.seed);assert.equal(d.generator.name,"schematic");assert.equal(d.features.length,0);assert.equal(TnDMaps.scene.build(d,"ink").layers.find(l=>l.name==="hits").items.length,0);assert(!publicBytes().includes(PRIVATE));for(const id of Object.keys(A.zones).filter(id=>id!==A.seed))assert.throws(()=>atlasDoc(id),/not available/);assert.equal(atlasCard(A.seed,{id:"secret-room"}),null);});
test("legacy note keys cannot attach old notes to unrelated new public identities",()=>{const A=setup(),old=A.seed;A.seed="knowledge";A.zones.knowledge=A.zones[old];A.zones.knowledge.params.seed="knowledge";delete A.zones[old];Object.values(A.zones).forEach(z=>{if(z.parent===old)z.parent="knowledge";});A.notes["knowledge|f1"]=PRIVATE;const backup=JSON.stringify(A);enable();disclose(hut);assert.equal(JSON.stringify(A.legacyAtlas),backup);assert.equal(atlasPublicCard(A.seed,{id:"f1"}).note,"","a new public f1 must not inherit a legacy region f1's note");});
test("private-only edits leave the exact public scene and all labels unchanged",()=>{const A=publish(),before=publicBytes();for(const z of Object.values(A.zones)){z.name=PRIVATE+" changed";z.params.secret=PRIVATE;z.fp="different-private-geometry";}A.told.push(PRIVATE);A.notes["private-interior|secret-room"]=PRIVATE+" changed";A.legacyAtlas.zones[A.seed].name=PRIVATE+" backup";atlasForget();assert.equal(publicBytes(),before);});
test("private generated room names cannot establish public canonical room identity",()=>{setup();enable();assert.equal(atlasPlaceCanon("Private Room","The Boundary Clearing","Old Inn",false),null);assert.equal(atlasPublicCanon("Common Room","The Boundary Clearing","Unestablished Inn"),null);});
test("known scoped room identities survive without exposing a sibling room",()=>{setup();enable();const parent="The Boundary Clearing",first=parent+"|Old Inn — Common Room",second=parent+"|New Inn — Common Room";memory.map.nodes[first]=newMapNode(0,parent);memory.map.nodes[second]=newMapNode(0,parent);assert.equal(atlasPublicCanon("Common Room",parent,"Old Inn — Kitchen").key,first);worldState.world.sublocation="Old Inn — Common Room";disclose("[MAP_REVEAL:new|a hearth|landmark|N|observed]","room");worldState.world.sublocation="New Inn — Common Room";assert.equal(atlasKnowledgeProjection().features.length,0);worldState.world.sublocation="Old Inn — Common Room";assert.equal(atlasKnowledgeProjection().features.length,1);});

test("damaged and newer existing knowledge is refused without replacing any evidence",()=>{for(const bad of [null,false,0,"",[],{v:99},Object.assign(MapKnowledge.create(),{next:0})]){setup();memory.map.geography=copy(bad);const before=bytes(),r=atlasPublicEnable();assert.equal(r.ok,false,"damaged knowledge value must be refused: "+JSON.stringify(bad));assert(r.reason);assert(bytes()===before,"refusal must preserve the world-memory pair byte for byte");}});
test("active campaigns missing knowledge are refused without silently recreating it",()=>{setup();worldState.atlas.knowledge=1;const before=bytes(),r=atlasPublicEnable();assert.equal(r.ok,false);assert(r.reason);assert(bytes()===before,"refusal must preserve the world-memory pair byte for byte");assert.throws(()=>atlasDoc(worldState.atlas.seed),/knowledge version/);assert(!atlasMapBlock().includes(PRIVATE));});
test("failed candidate construction leaves the complete world-memory pair byte identical",()=>{setup();const before=bytes(),create=MapKnowledge.create;let reason="";MapKnowledge.create=()=>{throw new Error("injected knowledge allocation failure");};try{const r=atlasPublicEnable();reason=r&&r.reason||"";}catch(e){reason=e.message;}finally{MapKnowledge.create=create;}assert(reason.includes("injected knowledge allocation failure"));assert(bytes()===before,"a rejected migration must not stamp or mutate the legacy atlas first");});
test("missing narrative location refuses activation before any write",()=>{setup();worldState.world.location=null;const before=bytes(),r=atlasPublicEnable();assert.equal(r.ok,false);assert.match(r.reason,/location/);assert(bytes()===before,"refusal must preserve the world-memory pair byte for byte");});
test("the legacy atlas shape migration does not opt a campaign into public knowledge",()=>{setup();worldState.atlas.v=1;atlasHeal();assert.equal(worldState.atlas.v,ATLAS_VER);assert.equal(worldState.atlas.knowledge,undefined);assert.equal(memory.map.geography,undefined);});
test("newer atlas data is left untouched and cannot be activated by this client",()=>{setup();worldState.atlas.v=ATLAS_VER+1;const before=bytes(),r=atlasPublicEnable();assert.equal(r.ok,false);assert(r.reason);assert(bytes()===before,"refusal must preserve the world-memory pair byte for byte");});

test("real local save and load preserve every disclosure receipt and the full legacy backup",()=>{const A=publish(),knowledge=JSON.stringify(memory.map.geography),backup=JSON.stringify(A.legacyAtlas);assert(saveLocal());const storedWorld=store.get(WSK),storedMemory=store.get(MEM_KEY);assert(storedWorld&&storedMemory);worldState=null;memory=blankMemory();sessionLog=[];assert(loadState());assert.equal(JSON.stringify(memory.map.geography),knowledge);assert.equal(JSON.stringify(worldState.atlas.legacyAtlas),backup);assert.equal(atlasKnowledgeProjection().features[0].label,"a hut");assert(!publicBytes().includes(PRIVATE));});
test("actual tnd import preserves disclosure identity source and legacy evidence",()=>{const A=publish(),knowledge=JSON.stringify(memory.map.geography),backup=JSON.stringify(A.legacyAtlas);inventoryStampWorld(worldState);const payload=JSON.parse(JSON.stringify({worldState,sessionLog,memory}));setup();const plan=importSaveData(payload);assert(plan.id);assert.equal(JSON.stringify(memory.map.geography),knowledge);assert.equal(JSON.stringify(worldState.atlas.legacyAtlas),backup);assert.equal(atlasKnowledgeProjection().features[0].source.commit,"migration-public:0");assert(!publicBytes().includes(PRIVATE));assert(loadState());assert.equal(JSON.stringify(memory.map.geography),knowledge);});
test("old client refuses activated saves at local and import doors before any write",()=>{publish();const exported=JSON.stringify({worldState,sessionLog,memory}),world=serializeWorldState(),oldVer=SAVE_VER;setup();const live=bytes(),disk=JSON.stringify(platform);try{for(const obsolete of [11,12]){global.SAVE_VER=obsolete;assert.throws(()=>parseWorldState(world),/newer version/);assert.throws(()=>importSaveData(JSON.parse(exported)),/newer version/);assert.equal(bytes(),live);assert.equal(JSON.stringify(platform),disk);}}finally{global.SAVE_VER=oldVer;}});
test("unknown knowledge version survives load and fails closed on public reads and writes",()=>{publish();memory.map.geography.v=99;const knowledge=JSON.stringify(memory.map.geography);assert(saveLocal());assert(loadState());assert.equal(JSON.stringify(memory.map.geography),knowledge);assert.throws(()=>atlasDoc(worldState.atlas.seed),/knowledge version/);atlasKnowledgeCommit(hut,atlasKnowledgeRead(hut),{commit:"future"});assert.equal(JSON.stringify(memory.map.geography),knowledge);assert(notices.some(n=>n.includes("knowledge version")));assert(!atlasMapBlock().includes(PRIVATE));});
test("an imported newer knowledge store is preserved and never converted into procedural fallback",()=>{publish();memory.map.geography.v=99;const payload=copy({worldState,sessionLog,memory}),knowledge=JSON.stringify(memory.map.geography);setup();importSaveData(payload);assert.equal(JSON.stringify(memory.map.geography),knowledge);assert.throws(()=>atlasDoc(worldState.atlas.seed),/knowledge version/);assert.equal(atlasPublicEnable().ok,false);assert(!atlasMapBlock().includes(PRIVATE));});
test("public notes follow stable feature handles through rename merge save and import",()=>{const A=publish();assert(atlasNoteSet(A.seed,"f1","We left a blue ribbon here.").ok);memory.map.nodes["New Clearing"]=newMapNode(0,null);assert(locMerge("New Clearing","The Boundary Clearing",{muts:[],turn:worldState.turn}));disclose("[MAP_REVEAL:f1|The Abandoned Hut|hut|W|observed]","rename-note");assert.equal(atlasCard(A.seed,{id:"f1"}).note,"We left a blue ribbon here.");assert(saveLocal());assert(loadState());assert.equal(atlasCard(A.seed,{id:"f1"}).note,"We left a blue ribbon here.");const payload=copy({worldState,sessionLog,memory});setup();importSaveData(payload);assert.equal(atlasCard(worldState.atlas.seed,{id:"f1"}).note,"We left a blue ribbon here.");});
test("identity merge conserves handles receipts and both distinct public facts",()=>{publish();const first="The Boundary Clearing",second="The New Clearing";worldState.world.location=second;memory.map.nodes[second]=newMapNode(0,null);disclose("[MAP_REVEAL:new|Bear Spring|spring|SW|reported]","second");const before=JSON.stringify(memory.map.geography);assert(locMerge(second,first,{muts:[],turn:worldState.turn}));assert.equal(JSON.stringify(memory.map.geography),before);assert.deepEqual(atlasKnowledgeProjection().features.map(f=>f.id),["f1","f2"]);assert.deepEqual(atlasKnowledgeProjection().features.map(f=>f.label),["a hut","Bear Spring"]);assert(saveLocal());assert(loadState());assert.equal(JSON.stringify(memory.map.geography),before);assert.equal(atlasKnowledgeProjection().features.length,2);});

function typedLegacyKnowledge(){
 const s={v:1,revision:3,next:4,features:{},receipts:{}},labels=['High canopy stairs','Crossing shallows','Ventilation stair'],kinds=['arch','spring','ruin'];
 labels.forEach((label,i)=>{const id='f'+(i+1),receipt='legacy-kind-'+i,event={op:'disclose',id:'new',label,kind:kinds[i],bearing:['N','E','W'][i],mode:i===2?'reported':'observed',quote:'Legacy narration: '+label+', a '+kinds[i]+'.'};
  s.receipts[receipt]={turn:i+3,container:'The Boundary Clearing',events:[event]};s.features[id]={id,container:'The Boundary Clearing',label,kind:event.kind,bearing:event.bearing,mode:event.mode,receipt,event:0};});return s;
}
function assertNeutralLegacyMap(){
 const A=worldState.atlas,doc=atlasDoc(A.seed),cards=doc.features.map(f=>atlasCard(A.seed,{id:f.id}));
 assert.deepEqual(doc.features.map(f=>f.name),['High canopy stairs','Crossing shallows','Ventilation stair']);assert(doc.features.every(f=>f.kind==='landmark'));
 assert(!/\b(?:arch|spring|ruin)\b/i.test(JSON.stringify([doc,TnDMaps.scene.build(doc,'ink'),TnDMaps.digest(doc),cards,atlasKnowledgePlayerBlock(),buildGeoBlock('player')])),'legacy proposals and incorrect old quote expansions are not public facts');
 assert(cards.every(c=>/Disclosed on turn [345]\./.test(c.word)));
}
test('typed legacy knowledge upgrades once with an exact detached provenance backup',()=>{
 publish();const legacy=typedLegacyKnowledge(),before=JSON.stringify(legacy);worldState.ver=12;memory.map.geography=legacy;
 assert.equal(typeof atlasKnowledgeMigrate,'function');const r=atlasKnowledgeMigrate();assert(r.ok,r.reason);assert.equal(r.changed,true);assert.equal(memory.map.geography.v,2);
 assert.equal(JSON.stringify(legacy),before);assert.equal(JSON.stringify(worldState.atlas.legacyKnowledge),before);assert.notEqual(worldState.atlas.legacyKnowledge,legacy);
 assertNeutralLegacyMap();const complete=bytes(),again=atlasKnowledgeMigrate();assert(again.ok);assert.equal(again.changed,false);assert.equal(bytes(),complete);
});
test('typed legacy import and local reload retain backup without reasserting old classifications',()=>{
 publish();worldState.ver=12;memory.map.geography=typedLegacyKnowledge();const before=JSON.stringify(memory.map.geography),payload=copy({worldState,sessionLog,memory});
 setup();importSaveData(payload);assert.equal(memory.map.geography.v,2);assert.equal(JSON.stringify(worldState.atlas.legacyKnowledge),before);assertNeutralLegacyMap();
 assert.equal(worldState.ver,13);assert(saveLocal());assert(loadState());assert.equal(JSON.stringify(worldState.atlas.legacyKnowledge),before);assertNeutralLegacyMap();
});
test('damaged typed legacy upgrades refuse before replacing current evidence or backup',()=>{
 publish();const legacy=typedLegacyKnowledge();legacy.features.f1.kind='tree';worldState.ver=12;memory.map.geography=legacy;const before=bytes();
 const r=atlasKnowledgeMigrate();assert.equal(r.ok,false);assert(r.reason);assert(bytes()===before,'failed upgrade preserves the whole candidate and creates no backup');
});
test('public activation requires the neutral save version before any write',()=>{
 setup();const before=bytes(),original=SAVE_VER;global.SAVE_VER=12;
 try{const r=atlasPublicEnable();assert.equal(r.ok,false);assert.match(r.reason,/safely save/);assert.equal(bytes(),before);}finally{global.SAVE_VER=original;}
});

test('public readers refuse typed legacy knowledge without silently upgrading it',()=>{
 publish();worldState.ver=12;memory.map.geography=typedLegacyKnowledge();const before=bytes();atlasForget();
 assert.throws(()=>atlasDoc(worldState.atlas.seed),/knowledge version/);
 assert.throws(()=>atlasKnowledgeProjection(),/knowledge version/);
 assert(!/\b(?:arch|spring|ruin)\b/i.test(atlasMapBlock()));
 assert.equal(bytes(),before,'only an admission migration may install a new schema or backup');
});

test('typed legacy local load persists the full backup before transformed memory',()=>{
 publish();migrateWorldState();assert.equal(migrateWorldState(),false,'the fixture needs no unrelated world migration');worldState.ver=12;memory.map.geography=typedLegacyKnowledge();
 const original=JSON.stringify(memory.map.geography);
 store.set(WSK,serializeWorldState());store.set(SLK,JSON.stringify(sessionLog));store.set(MEM_KEY,JSON.stringify(memory));
 worldState=null;memory=blankMemory();sessionLog=[];atlasForget();
 const set=store.set,writes=[];store.set=function(k,v){writes.push({key:k,value:String(v)});return set.apply(this,arguments);};
 try{assert(loadState());}finally{store.set=set;}
 assertNeutralLegacyMap();assert.equal(memory.map.geography.v,2);assert.equal(worldState.ver,13);
 const backup=writes.findIndex(w=>w.key===WSK&&JSON.parse(w.value).atlas&&JSON.parse(w.value).atlas.legacyKnowledge);
 const current=writes.findIndex(w=>w.key===MEM_KEY&&JSON.parse(w.value).map.geography.v===2);
 assert(backup>=0,'legacy load writes its detached provenance backup to disk');
 assert(current>backup,'the recoverable world backup must precede converted memory');
 assert.equal(JSON.stringify(JSON.parse(store.get(WSK)).atlas.legacyKnowledge),original);
 assert.equal(JSON.parse(store.get(MEM_KEY)).map.geography.v,2);
});
test('a conflicting prior legacy knowledge backup prevents replacement of either store',()=>{
 publish();worldState.ver=12;memory.map.geography=typedLegacyKnowledge();worldState.atlas.legacyKnowledge={sentinel:'Earlier irreplaceable evidence'};
 const before=bytes(),r=atlasKnowledgeMigrate();assert.equal(r.ok,false);assert(r.reason);assert.equal(bytes(),before);
});

test('a failed world backup write cannot persist converted legacy memory',()=>{
 publish();migrateWorldState();assert.equal(migrateWorldState(),false,'the fixture needs no unrelated world migration');worldState.ver=12;memory.map.geography=typedLegacyKnowledge();
 store.set(WSK,serializeWorldState());store.set(SLK,JSON.stringify(sessionLog));store.set(MEM_KEY,JSON.stringify(memory));
 const beforeWorld=store.get(WSK),beforeMemory=store.get(MEM_KEY),set=store.set;let convertedWrites=0;
 worldState=null;memory=blankMemory();sessionLog=[];atlasForget();notices=[];
 store.set=function(k,v){if(k===WSK)throw new Error('injected backup storage failure');if(k===MEM_KEY&&JSON.parse(v).map.geography.v===2)convertedWrites++;return set.apply(this,arguments);};
 try{
  assert(loadState());assert.equal(memory.map.geography.v,2,'runtime conversion is prepared even while the disk refuses the backup');
  assert.equal(convertedWrites,0);assert.equal(store.get(WSK),beforeWorld);assert.equal(store.get(MEM_KEY),beforeMemory);
  assert.equal(saveMem(),false,'a later memory-only save must refuse until its provenance backup is durable');
  assert.equal(convertedWrites,0);assert.equal(store.get(WSK),beforeWorld);assert.equal(store.get(MEM_KEY),beforeMemory);
 }finally{store.set=set;}
 assert(notices.some(n=>n.includes('injected backup storage failure')),'the refusal has an attributable storage diagnostic');
 const recovered=[];store.set=function(k,v){recovered.push(k);return set.apply(this,arguments);};
 try{assert.equal(saveMem(),true,'retry after core storage recovers can persist the converted map');}finally{store.set=set;}
 assert(recovered.indexOf(WSK)>=0&&recovered.indexOf(WSK)<recovered.indexOf(MEM_KEY),'recovery writes the backup before converted memory');
 assert.equal(JSON.stringify(JSON.parse(store.get(WSK)).atlas.legacyKnowledge),JSON.stringify(JSON.parse(beforeMemory).map.geography));
 assert.equal(JSON.parse(store.get(MEM_KEY)).map.geography.v,2);
});

test('memory-only saves cannot persist fresh activation without its public world and legacy atlas backup',()=>{
 const A=setup(),originalAtlas=JSON.stringify(A);worldState.ver=12;
 store.set(WSK,serializeWorldState());store.set(SLK,JSON.stringify(sessionLog));store.set(MEM_KEY,JSON.stringify(memory));
 const beforeWorld=store.get(WSK),beforeMemory=store.get(MEM_KEY),set=store.set;enable();
 store.set=function(k,v){if(k===WSK)throw new Error('injected activation backup failure');return set.apply(this,arguments);};
 try{assert.equal(saveMem(),false,'new public knowledge must not outlive its activation record and backup');assert.equal(store.get(WSK),beforeWorld);assert.equal(store.get(MEM_KEY),beforeMemory);}finally{store.set=set;}
 assert.equal(saveMem(),true);const saved=JSON.parse(store.get(WSK));assert.equal(saved.ver,13);assert.equal(saved.atlas.knowledge,1);assert.equal(JSON.stringify(saved.atlas.legacyAtlas),originalAtlas);assert.equal(JSON.parse(store.get(MEM_KEY)).map.geography.v,2);
});

(async()=>{let pass=0,fail=0;for(const t of tests){try{await t.fn();pass++;console.log("PASS #733 migration "+t.name);}catch(e){fail++;oldConsole.error("FAIL #733 migration "+t.name+" — "+e.stack);}}Object.assign(console,oldConsole);if(!tests.length){console.error("matched 0 migration tests");process.exitCode=1;return;}console.log((fail?"FAILED":"ALL GREEN")+" — "+pass+" passed, "+fail+" failed #733 migration groups");if(fail)process.exitCode=1;})().catch(e=>{Object.assign(console,oldConsole);console.error(e);process.exitCode=1;});
