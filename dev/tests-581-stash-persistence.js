// In-memory storage only; real save/import/load functions and no network or provider calls.
const assert=require('assert/strict'),engine=require('./load-engine.js');engine.loadEngine();
const values=Object.create(null);global.store={get:k=>Object.prototype.hasOwnProperty.call(values,k)?values[k]:null,set:(k,v)=>{values[k]=String(v);},del:k=>{delete values[k];}};
global.showToast=()=>{};global.syncUI=()=>{};global.addMsg=()=>{};global.storageAdapter={syncToServer:()=>{},resetSyncState:()=>{}};
engine.makeTestWorld();worldState.kind='village';worldState.campId='stash-persistence-original';worldState.character.name='Silas';worldState.character.inventory=['Blasting charge x5'];worldState.heroLibraryAt=1000;worldState.world.location='The Village';worldState.world.sublocation="Silas's house";
memory.map={nodes:{'The Village':{parent:null,items:[],npcs:[],size:'small'}},edges:[],lastArrivalFrom:null};villageHouseEnsure('Silas',null);setActiveCampId(worldState.campId);
assert.equal(stashTradeApply({stow:{'blasting charge':1}}).ok,true);const lib=portableSheet(worldState.character),key=stashMarkKey();assert.equal(lib.inventory.join(),'Blasting charge x4');assert.equal(saveAll(),true);
const persisted=parseWorldState(store.get(WSK));assert.equal(persisted.stashJournal.id,key);assert.equal(persisted.character.stashMarks[key],lib.stashMarks[key]);
const exported={worldState:persisted,memory:JSON.parse(store.get(MEM_KEY)),sessionLog:[]};for(const k of Object.keys(values))delete values[k];engine.makeTestWorld();setActiveCampId(null);
const plan=importSaveData(exported);assert.equal(plan.reminted,true);assert.equal(JSON.parse(store.get(WSK)).stashJournal.id,key);worldState=null;assert.equal(loadState(),true);assert.equal(stashMarkKey(),key);
villageRefreshFromLibrary([{character:lib,updatedAt:Date.now()+10000}]);assert.equal(worldState.character.inventory.join(),'Blasting charge x4');saveAll();const nid=rehomeCampaign('fixture');saveAll();worldState=null;assert.equal(loadState(),true);assert.equal(worldState.campId,nid);assert.equal(stashMarkKey(),key);assert.equal(worldState.character.inventory.join(),'Blasting charge x4');
const original=JSON.stringify(lib);adoptLibraryHero(lib,Date.now()+20000);assert.equal(JSON.stringify(lib),original,'external library copy remains untouched');assert.equal(worldState.character.inventory.join(),'Blasting charge x4');
console.log('PASS #581 real save/import/rehome/load persists journal and never replays reflected move');
