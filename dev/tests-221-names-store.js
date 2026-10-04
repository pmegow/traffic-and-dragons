// #221: write only the named project list, atomically; partial drafts are valid, stale saves are not.
const fs=require('fs'),path=require('path'),os=require('os'),assert=require('assert/strict'),cp=require('child_process'),http=require('http');
const root=path.resolve(__dirname,'..'),scratch=fs.mkdtempSync(path.join(os.tmpdir(),'tnd-names-store-'));
const files=['capability-names.html','capability_bible.js','class_bible.js','data.js','helpers.js','ui-shell.js','satellite.css','dev/bible-server.js','dev/bible-editor-version.js','dev/bible-helper-version.js','dev/capability-names-store.js','dev/launch-bible-editor.js'];
let failed=0,child;
async function check(name,fn){try{await fn();console.log('PASS #221 '+name);}catch(e){failed++;console.error('FAIL #221 '+name+' — '+e.message);}}
function request(port,method,body,origin,version){return new Promise((resolve,reject)=>{const headers={'Content-Type':'application/json','X-Bible-Helper-Version':version};if(origin!==undefined)headers.Origin=origin;
const req=http.request({host:'127.0.0.1',port,path:'/capability-names',method,headers},res=>{let text='';res.on('data',c=>text+=c);res.on('end',()=>resolve({status:res.statusCode,data:JSON.parse(text)}));});req.on('error',reject);req.end(body?JSON.stringify(body):undefined);});}
(async()=>{try{
for(const file of files){fs.mkdirSync(path.dirname(path.join(scratch,file)),{recursive:true});fs.copyFileSync(path.join(root,file),path.join(scratch,file));}
const store=require('./capability-names-store.js').createStore(scratch),initial=store.read();
const vm=require('vm'),box={};vm.runInNewContext(fs.readFileSync(path.join(root,'capability_bible.js'),'utf8'),box);
const names=Object.keys(box.CAPABILITY_BIBLE).sort().map(from=>({from,to:''}));names[0].to='Quiet Ember';
const text=JSON.stringify({format:'traffic-and-dragons/capability-names/v1',readyToApply:true,names});
let saved;
await check('repeated saves replace one project file and recompute readiness',()=>{
assert.equal(initial.revision,null);saved=store.write({text,revision:null});assert.equal(saved.ok,true);
let file=JSON.parse(fs.readFileSync(path.join(scratch,'capability-names.json'),'utf8'));assert.equal(file.readyToApply,false);assert.equal(file.names[0].to,'Quiet Ember');
names[0].to='A second choice';saved=store.write({text:JSON.stringify({...file,names}),revision:saved.revision});
file=JSON.parse(store.read().text);assert.equal(file.names[0].to,'A second choice');assert.equal(fs.readdirSync(scratch).filter(f=>f.startsWith('capability-names.')&&!f.endsWith('.html')).length,1);
});
await check('invalid and stale writes leave the current file byte-identical',()=>{
const before=fs.readFileSync(path.join(scratch,'capability-names.json'),'utf8');
assert.throws(()=>store.write({text:'{}',revision:saved.revision}));assert.throws(()=>store.write({text,revision:null}),/changed|stale/i);
assert.equal(fs.readFileSync(path.join(scratch,'capability-names.json'),'utf8'),before);
});
await check('failed atomic replacement preserves the previous list',()=>{
const before=fs.readFileSync(path.join(scratch,'capability-names.json'),'utf8'),rename=fs.renameSync;
try{fs.renameSync=()=>{throw new Error('simulated replace failure');};assert.throws(()=>store.write({text,revision:saved.revision}),/replace failure/);}finally{fs.renameSync=rename;}
assert.equal(fs.readFileSync(path.join(scratch,'capability-names.json'),'utf8'),before);
assert.equal(fs.readdirSync(scratch).filter(f=>f.endsWith('.tmp')).length,0);
});
child=cp.spawn(process.execPath,[path.join(scratch,'dev/bible-server.js')],{env:{...process.env,BIBLE_PORT:'0'},stdio:['ignore','pipe','pipe'],windowsHide:true});
const port=await new Promise((resolve,reject)=>{let out='';const timer=setTimeout(()=>reject(Error('server startup timed out')),10000);child.stdout.on('data',c=>{out+=c;const m=out.match(/listening on http:\/\/127\.0\.0\.1:(\d+)/);if(m){clearTimeout(timer);resolve(+m[1]);}});child.on('exit',()=>{clearTimeout(timer);reject(Error('server exited before listening'));});});
const version=require('./bible-helper-version.js'),origin='http://127.0.0.1:'+port;
await check('project save endpoint refuses foreign origins and stale protocols',async()=>{
const before=store.read();
for(const from of ['https://example.com','null'])assert.equal((await request(port,'POST',{text,revision:before.revision},from,version)).status,403);
assert.equal((await request(port,'POST',{text,revision:before.revision},origin,'old')).status,409);
assert.equal(store.read().text,before.text);
});
await check('local endpoint saves partial drafts and reloads the same list',async()=>{
const before=await request(port,'GET',null,origin,version),result=await request(port,'POST',{text,revision:before.data.revision},origin,version);
assert.equal(result.status,200);assert.equal((await request(port,'GET',null,origin,version)).data.text,store.read().text);
assert.equal((await request(port,'POST',{text,revision:before.data.revision},origin,version)).status,409);
});
await check('names launcher reuses the helper and selects the worksheet',async()=>{
const run=cp.spawnSync(process.execPath,[path.join(scratch,'dev/launch-bible-editor.js'),'--names'],{env:{...process.env,BIBLE_PORT:String(port),BIBLE_LAUNCH_NO_OPEN:'1'},encoding:'utf8',windowsHide:true});
assert.equal(run.status,0,run.stderr);assert.ok(run.stdout.includes('/capability-names.html'),run.stdout);
});
}finally{if(child){child.kill();await new Promise(r=>child.exitCode!==null?r():child.once('exit',r));}fs.rmSync(scratch,{recursive:true,force:true});}process.exitCode=failed?1:0;})().catch(e=>{console.error(e.message);process.exitCode=1;});
