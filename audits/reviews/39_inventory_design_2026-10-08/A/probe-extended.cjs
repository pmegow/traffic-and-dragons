const fs=require('fs'),path=require('path'),crypto=require('crypto'),cp=require('child_process');
const root='C:/Projects/traffic-and-dragons',out=__dirname;const hash=x=>crypto.createHash('sha256').update(x).digest('hex');
const files=cp.execFileSync('git',['ls-files'],{cwd:root,encoding:'utf8'}).trim().split('\n').filter(f=>/\.(js|html|md)$/.test(f));
const hashes=Object.fromEntries(files.map(f=>[f,hash(fs.readFileSync(path.join(root,f)))]));fs.writeFileSync(path.join(out,'source-hashes-before.json'),JSON.stringify(hashes,null,2));
const log=console.log.bind(console);let writes=[],events=[],sync=0,db={};global.localStorage={getItem:k=>db[k]??null,setItem:(k,v)=>{db[k]=String(v);writes.push(['set',k]);},removeItem:k=>{delete db[k];writes.push(['del',k]);},key:i=>Object.keys(db)[i],get length(){return Object.keys(db).length}};global.fetch=()=>{throw Error('NETWORK FORBIDDEN')};
const e=require(root+'/dev/load-engine.js');e.loadEngine();(0,eval)(fs.readFileSync(root+'/ui-browsers.js','utf8'));(0,eval)(fs.readFileSync(root+'/ui-campaigns.js','utf8'));
global.document={getElementById:id=>id==='char-screen'?{style:{display:'none'}}:null};global.showToast=s=>events.push(['toast',s]);console.warn=(...x)=>events.push(['warn',...x.map(String)]);console.error=(...x)=>events.push(['error',...x.map(String)]);console.info=(...x)=>events.push(['info',...x.map(String)]);
for(const k of ['syncUI','restoreCheckpointHolder','_applyLoadedCampaign','audioScenePublish'])global[k]=()=>{};
const sa={syncToServer:()=>sync++,resetSyncState:()=>{},clearFlushDirty:()=>{},adoptServerTurn:()=>{},isServerMode:()=>false};global.storageAdapter=sa;
function reset(){db={};writes=[];events=[];sync=0;e.makeTestWorld({campId:'old'});setActiveCampId('old');saveCore();saveMem();setCampMeta([{id:'old',name:'Old'}]);writes=[];events=[];sync=0;}
function state(){return {ws:hash(JSON.stringify(worldState)),mem:hash(JSON.stringify(memory)),sl:hash(JSON.stringify(sessionLog)),id:getActiveCampId(),live:db[WSK]?hash(db[WSK]):null,keys:Object.keys(db).sort()};}
const cases=[];
function run(name,make,fn){reset();let input=make(),src=hash(JSON.stringify(input)),before=state(),ret,err;try{ret=fn(input);}catch(x){err=x.message;}cases.push({name,return:ret,error:err,before,after:state(),sourceUnchanged:src===hash(JSON.stringify(input)),ver:worldState&&worldState.ver,sheetVer:worldState&&worldState.character&&worldState.character.sheetVer,writes:JSON.parse(JSON.stringify(writes)),syncAttempts:sync,events:JSON.parse(JSON.stringify(events))});}
const versions=[10,11,undefined,'future',null];
function candidate(v){let w=JSON.parse(JSON.stringify(worldState));if(v===undefined)delete w.ver;else w.ver=v;w.character.name='Incoming';return w;}
for(const v of versions){let label=String(v);
run('loadState '+label,()=>candidate(v),w=>{db[WSK]=JSON.stringify(w);return loadState();});
run('importSaveData '+label,()=>({worldState:candidate(v),memory:blankMemory(),sessionLog:[]}),x=>importSaveData(x));
run('checkpointRestore world '+label,()=>({v:CHECKPOINT_VER,ws:JSON.stringify(candidate(v)),sl:'[]',mem:JSON.stringify(blankMemory()),campId:'old',turn:2}),x=>({held:checkpointHold(x),restored:checkpointRestore(x)}));
run('cloud apply '+label,()=>({worldState:candidate(v),memory:blankMemory(),sessionLog:[]}),x=>_applyPulledCampaign('old',x,{}));
run('library hero sheet '+label,()=>{let c=JSON.parse(JSON.stringify(worldState.character));if(v!==undefined)c.sheetVer=v;return c;},c=>!!adoptLibraryHero(c,10));
run('char envelope '+label,()=>({ver:v,type:'character',character:JSON.parse(JSON.stringify(worldState.character))}),x=>{let preview;global.showCharImportPreview=c=>preview=c;global.FileReader=class{readAsText(){this.onload({target:{result:JSON.stringify(x)}})}};importCharacterFile({target:{files:[{}],value:'x'}});return {preview:!!preview,sheetVer:preview&&preview.sheetVer};});
}
run('checkpoint future outer v',()=>({v:CHECKPOINT_VER+1,ws:JSON.stringify(candidate(10)),sl:'[]',mem:'{}',campId:'old'}),x=>({held:checkpointHold(x),restored:checkpointRestore(x)}));
run('nested future hero old world',()=>{let w=candidate(10);w.character.sheetVer=11;return w;},w=>{db[WSK]=JSON.stringify(w);return loadState();});
run('library companion future',()=>{let c=JSON.parse(JSON.stringify(worldState.character));c.name='Bram';c.sheetVer=11;return c;},c=>{let n={name:'Bram',charSheet:JSON.parse(JSON.stringify(c))};worldState.npcs.push(n);return !!adoptLibraryCompanion(n,c,10);});
run('Village future',()=>{let c=JSON.parse(JSON.stringify(worldState.character));c.name='Bram';c.sheetVer=11;return c;},c=>importVillageResidents([c]));
run('fallen future',()=>{let c=JSON.parse(JSON.stringify(worldState.character));c.name='Bram';c.sheetVer=11;return c;},c=>{worldState.npcs.push({name:'Bram',dead:true});worldState.mpFallen=[{name:'Bram',sheet:c}];return mpRejoinFallen();});
run('portable future',()=>{let c=JSON.parse(JSON.stringify(worldState.character));c.sheetVer=11;return c;},c=>({sheetVer:portableSheet(c).sheetVer,unstamped:portableSheet(worldState.character).sheetVer}));

run('switch future slot',()=>candidate(11),w=>{w.campId='next';db[campSlotKey('next','ws')]=JSON.stringify(w);db[campSlotKey('next','sl')]='[]';db[campSlotKey('next','mem')]=JSON.stringify(blankMemory());return switchToCampaign('next');});
run('char future nested',()=>({ver:10,character:Object.assign(JSON.parse(JSON.stringify(worldState.character)),{sheetVer:11})}),x=>{let preview;global.showCharImportPreview=c=>preview=c;global.FileReader=class{readAsText(){this.onload({target:{result:JSON.stringify(x)}})}};importCharacterFile({target:{files:[{}],value:'x'}});return {preview:!!preview,sheetVer:preview&&preview.sheetVer};});
run('pending future',()=>Object.assign(JSON.parse(JSON.stringify(worldState.character)),{name:'Bram',sheetVer:11}),c=>{pendingCompanions=[];global._renderCompanionSlots=()=>{};_addPendingCompanion(c);return {count:pendingCompanions.length,sheetVer:pendingCompanions[0]&&pendingCompanions[0].sheetVer};});
run('import companion future',()=>Object.assign(JSON.parse(JSON.stringify(worldState.character)),{name:'Bram',sheetVer:11}),c=>{global.sendAction=()=>events.push(['sendAction intercepted']);_addImportedCompanion(c);return {count:worldState.npcs.length,sheetVer:worldState.npcs[0]&&worldState.npcs[0].charSheet.sheetVer};});
// NONPRODUCTION: hypothetical early world/sheet gate only. Missing/malformed is deliberately recorded as unspecified, not assigned policy.
for(const profile of ['pre-gate','gate-only','future-row'])for(const v of [10,11])run('SIM '+profile+' import '+v,()=>({worldState:candidate(v),memory:blankMemory(),sessionLog:[]}),x=>{let max=profile==='future-row'?11:10;if(profile!=='pre-gate'&&x.worldState.ver>max){events.push(['simulated refusal','newer world']);return false;}return importSaveData(x);});
run('SIM late gate inside loadState cloud future',()=>({worldState:candidate(11),memory:blankMemory(),sessionLog:[]}),x=>{let old=global.loadState;global.loadState=()=>{events.push(['simulated refusal','newer world']);return false;};try{return _applyPulledCampaign('old',x,{});}finally{global.loadState=old;}});
run('SIM world-only gate nested future',()=>({worldState:candidate(10),memory:blankMemory(),sessionLog:[]}),x=>{x.worldState.character.sheetVer=11;if(x.worldState.ver>10)return false;return importSaveData(x);});
run('SIM early gate source retry',()=>({worldState:candidate(11),memory:blankMemory(),sessionLog:[]}),x=>{let original=JSON.stringify(x);let rejected=x.worldState.ver>10;let unchanged=JSON.stringify(x)===original;let acceptedAfterUpdate=x.worldState.ver<=11;return {rejected,unchanged,acceptedAfterUpdate};});
fs.writeFileSync(path.join(out,'extended-probes.json'),JSON.stringify(cases,null,2));log(cases.map(x=>({name:x.name,ret:x.return,error:x.error,writes:x.writes.length,sync:x.syncAttempts,sourceUnchanged:x.sourceUnchanged,ver:x.ver,sheetVer:x.sheetVer})));
const after=Object.fromEntries(files.map(f=>[f,hash(fs.readFileSync(path.join(root,f)))]));fs.writeFileSync(path.join(out,'source-hashes-after.json'),JSON.stringify(after,null,2));log('SOURCE HASHES UNCHANGED',JSON.stringify(hashes)===JSON.stringify(after));
