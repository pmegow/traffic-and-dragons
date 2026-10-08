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

(async()=>{const results=[];for(const version of [10,11]){reset();let requests=[];let incoming=JSON.parse(JSON.stringify(worldState));incoming.ver=version;incoming.turn=6;let packet={campaignId:'old',worldState:incoming,sessionLog:[],memory:blankMemory()};
// Scratch interception: private connection configuration is synthetic; fetch never reaches the network.
global.fetch=async(url,opt={})=>{requests.push({url,method:opt.method||'GET',body:opt.body?JSON.parse(opt.body):null});return {ok:true,status:200,json:async()=>url.endsWith('/api/campaigns')?[]:packet};};
let adapter=fs.readFileSync(root+'/storage-adapter.js','utf8').replace('var _serverUrl           = null;','var _serverUrl           = "https://fixture.invalid";').replace('var _token               = null;','var _token               = "synthetic-fixture";');
document.addEventListener=()=>{};(0,eval)(adapter);let done;const adopted=new Promise(r=>done=r);global.syncUI=()=>done();global.initReplaySession=()=>{};global.rebuildNarrativeFromTranscript=()=>true;
let sourceHash=hash(JSON.stringify(packet));storageAdapter.load(ok=>events.push(['load callback',ok]));await Promise.race([adopted,new Promise((_,reject)=>setTimeout(()=>reject(Error('adopt timeout')),1000))]);await new Promise(r=>setImmediate(r));
results.push({version,worldVersion:worldState.ver,turn:worldState.turn,writes,events,requests,sourceUnchanged:sourceHash===hash(JSON.stringify(packet))});}
fs.writeFileSync(path.join(out,'adapter-probes.json'),JSON.stringify(results,null,2));log(results.map(r=>({version:r.version,worldVersion:r.worldVersion,turn:r.turn,writes:r.writes.length,requests:r.requests.map(q=>q.method+' '+q.url)})));})().catch(e=>{log(e.stack);process.exitCode=1;});
