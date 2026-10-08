// Read-only owner-save differential. All load/save operations use detached in-memory storage.
const fs=require('fs'),cp=require('child_process'),assert=require('assert/strict'),crypto=require('crypto'),e=require('./load-engine.js');
const dir=process.argv[2],ref=process.argv[3]||'5751f292';if(!dir)throw Error('Pass the read-only Campaigns directory');
const files=cp.execFileSync('rg',['--files',dir,'-g','*.tnd'],{encoding:'utf8'}).trim().split(/\r?\n/).sort();
if(process.argv[4]==='worker'){
 const mode=process.argv[5];Date.now=()=>1791450000000;for(const k of ['log','info','warn','error'])console[k]=()=>{};
 if(mode==='baseline'){for(const f of e.FILES)(0,eval)(cp.execFileSync('git',['show',ref+':'+f],{encoding:'utf8',maxBuffer:20e6}));}else e.loadEngine();
 global.showToast=()=>{};global.storageAdapter={resetSyncState:()=>{},syncToServer:()=>{}};
 function snapshot(){const moments=[];function walk(v,p){if(!v||typeof v!=='object')return;for(const k of Object.keys(v)){if(k==='coreMemories'&&Array.isArray(v[k])){for(let j=0;j<v[k].length;j++){const m=v[k][j];if(m&&m.kind==='ending'){moments.push({path:p+'.'+k+'.'+j,who:m.who,text:m.text});m.text='<ending text>';}}}walk(v[k],p+'.'+k);}}const obj=JSON.parse(JSON.stringify({worldState,memory,sessionLog}));walk(obj,'');return {otherHash:crypto.createHash('sha256').update(JSON.stringify(obj)).digest('hex'),moments};}
 const results=[];for(const file of files){const input=JSON.parse(fs.readFileSync(file,'utf8')),values=Object.create(null);global.store={get:k=>values[k]||null,set:(k,v)=>{values[k]=String(v);},del:k=>{delete values[k];}};
 e.makeTestWorld();setActiveCampId(input.worldState.campId||null);values[WSK]=JSON.stringify(input.worldState);values[SLK]=JSON.stringify(input.sessionLog||[]);values[MEM_KEY]=JSON.stringify(input.memory||blankMemory());
 assert.equal(loadState(),true,'real load failed');lastAction='Look around.';const prompt=buildSysPrompt();buildEngineNotes();buildDenouementPrompt();
 const initial=snapshot();saveAll();assert.equal(loadState(),true);const reloaded=snapshot();
 results.push({initial,reloaded,prompt});}
 process.stdout.write(JSON.stringify(results));process.exit(0);
}
const hashes=files.map(f=>crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex'));
function run(mode){return JSON.parse(cp.execFileSync(process.execPath,[__filename,dir,ref,'worker',mode],{encoding:'utf8',maxBuffer:160e6}));}
const before=run('baseline'),after=run('current');let changedSaves=0,changes=0,promptChanges=0;
for(let i=0;i<files.length;i++){
 assert.equal(before[i].initial.otherHash,after[i].initial.otherHash,'unrelated state delta at save index '+i);const a=before[i].initial.moments,b=after[i].initial.moments;assert.equal(a.length,b.length);let changed=false;
 for(let j=0;j<a.length;j++){assert.equal(a[j].path,b[j].path);assert.equal(a[j].who,b[j].who);if(a[j].text!==b[j].text){assert.equal(b[j].text,b[j].who+"'s ending: "+a[j].text);changes++;changed=true;}}
 if(changed)changedSaves++;assert.deepEqual(after[i].reloaded.moments,b,'reload record churn');assert.equal(before[i].reloaded.otherHash,after[i].reloaded.otherHash,'unrelated reload delta');assert.equal(before[i].prompt.stable,after[i].prompt.stable,'stable prompt changed');
 if(JSON.stringify(before[i].prompt)!==JSON.stringify(after[i].prompt)){promptChanges++;const oldLines=before[i].prompt.volatile.split('\n'),newLines=after[i].prompt.volatile.split('\n');assert.equal(oldLines.length,newLines.length,'prompt layout changed');for(let k=0;k<oldLines.length;k++)if(oldLines[k]!==newLines[k]){let restored=newLines[k];for(const m of b)restored=restored.split(m.who+"'s ending: ").join('');assert(oldLines[k]===restored||oldLines[k].startsWith(restored),'prompt delta exceeds attribution/truncation at save '+i+' line '+k);}}

 assert.equal(hashes[i],crypto.createHash('sha256').update(fs.readFileSync(files[i])).digest('hex'),'owner file changed');
}
console.log(JSON.stringify({saves:files.length,changedSaves,endingTextRepairs:changes,promptsChanged:promptChanges,sourceHashesUnchanged:true,reloadAddsNoNewChurn:true}));
