// Read-only owner-save differential. All load/save operations use detached in-memory storage.
const fs=require('fs'),cp=require('child_process'),assert=require('assert/strict'),crypto=require('crypto'),e=require('./load-engine.js');
const dir=process.argv[2],ref=process.argv[3]||'65fbf748';if(!dir)throw Error('Pass the read-only Campaigns directory');
const files=cp.execFileSync('rg',['--files',dir,'-g','*.tnd'],{encoding:'utf8'}).trim().split(/\r?\n/).sort();
if(process.argv[4]==='worker'){
 const mode=process.argv[5];Date.now=()=>1791450000000;for(const k of ['log','info','warn','error'])console[k]=()=>{};
 if(mode==='baseline'){for(const f of e.FILES)(0,eval)(cp.execFileSync('git',['show',ref+':'+f],{encoding:'utf8',maxBuffer:20e6}));}else e.loadEngine();
 global.showToast=()=>{};global.storageAdapter={resetSyncState:()=>{},syncToServer:()=>{}};
 function snapshot(){return crypto.createHash('sha256').update(JSON.stringify({worldState,memory,sessionLog})).digest('hex');}
 const results=[];for(const file of files){const input=JSON.parse(fs.readFileSync(file,'utf8')),values=Object.create(null);global.store={get:k=>values[k]||null,set:(k,v)=>{values[k]=String(v);},del:k=>{delete values[k];}};
 e.makeTestWorld();setActiveCampId(input.worldState.campId||null);values[WSK]=JSON.stringify(input.worldState);values[SLK]=JSON.stringify(input.sessionLog||[]);values[MEM_KEY]=JSON.stringify(input.memory||blankMemory());
 assert.equal(loadState(),true,'real load failed');lastAction='Look around.';const prompt=buildSysPrompt();buildEngineNotes();buildDenouementPrompt();
 const initial=snapshot();saveAll();assert.equal(loadState(),true);const reloaded=snapshot();
 results.push({initial,reloaded,prompt});}
 process.stdout.write(JSON.stringify(results));process.exit(0);
}
const hashes=files.map(f=>crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex'));
function run(mode){return JSON.parse(cp.execFileSync(process.execPath,[__filename,dir,ref,'worker',mode],{encoding:'utf8',maxBuffer:160e6}));}
const before=run('baseline'),after=run('current');
for(let i=0;i<files.length;i++){
 assert.deepEqual(after[i],before[i],'state/load/prompt delta at save index '+i);
 assert.equal(hashes[i],crypto.createHash('sha256').update(fs.readFileSync(files[i])).digest('hex'),'owner file changed');
}
console.log(JSON.stringify({saves:files.length,changedSaves:0,promptsChanged:0,sourceHashesUnchanged:true,actualLoadSaveReload:true}));
