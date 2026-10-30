const assert=require('assert/strict'),fs=require('fs'),{validate,append,releaseIdentity,hasRelease}=require('./record-release.js');
let passed=0;
function test(name,fn){try{fn();passed++;console.log('PASS #674 releases '+name);}catch(e){console.error('FAIL #674 releases '+name+': '+e.message);process.exitCode=1;}}
test('action limit rejects 25 words and malformed data',()=>{
 const valid={version:'v1.1',actions:[Array(24).fill('word').join(' ')]};validate(valid);
 for(const x of [null,{}, {...valid,actions:[]},{...valid,actions:[' ']},{...valid,actions:[Array(25).fill('word').join(' ')]}])assert.throws(()=>validate(x));
});
test('only a confirmed production receipt supplies a release date',()=>{
 const entry={version:'v1.1',actions:['Example action.']},ledger={schemaVersion:1,releases:[]},sha='a'.repeat(40);
 const good={app:{slug:'cloudflare-workers-and-pages'},name:'Cloudflare Pages: traffic-and-dragons',status:'completed',conclusion:'success',completed_at:'2026-10-30T19:00:00Z'};
 for(const x of [{...good,app:{slug:'other'}},{...good,name:'Engine tests'},{...good,conclusion:'failure'},{...good,status:'in_progress'},{...good,completed_at:null}])assert.throws(()=>append(ledger,entry,sha,[x]));
 assert.equal(append(ledger,entry,sha,[good]),true);assert.equal(ledger.releases[0].releasedAt,good.completed_at);
 assert.equal(append(ledger,entry,sha,[good]),false);assert.equal(ledger.releases.length,1);
});
test('release ledger and next version remain valid',()=>{
 const data=JSON.parse(fs.readFileSync('release-notes.json'));assert.equal(data.schemaVersion,1);const ids=new Set();
 data.releases.forEach(r=>{validate(r);assert(/^[a-f0-9]{40}$/.test(r.commit));assert(!ids.has(r.commit));ids.add(r.commit);assert(isFinite(Date.parse(r.releasedAt)));});
 const next=validate(JSON.parse(fs.readFileSync('release-next.json')));
 assert.equal(next.version,fs.readFileSync('globals.js','utf8').match(/var APP_VERSION="([^"]+)"/)[1],'update release-next.json with every version bump');
});

test('merge releases use the production head while metadata commits only deduplicate entries',()=>{
 const head='b'.repeat(40),source='a'.repeat(40);
 const identity=releaseIdentity('production',args=>args[0]==='rev-parse'?head:source);
 assert.deepEqual(identity,{commit:head,sourceCommit:source});
 assert.equal(hasRelease({releases:[{commit:head,sourceCommit:source}]},source),true);
 assert.equal(hasRelease({releases:[{commit:source}]},source),true);
 assert.equal(hasRelease({releases:[{commit:head,sourceCommit:'c'.repeat(40)}]},source),false);
});

console.log('#674 release notes: '+passed+' passed');

(async()=>{
 try{
  const vm=require('vm'),handlers={},fresh={ok:true,status:200,type:'basic',redirected:false,clone(){return this;}},stale={version:'old'},writes=[];
  const box={URL,console,Promise,importScripts(){},AUDIO_CATALOG:{version:'fixture'},createAudioCache(){return {};},
   self:{location:{origin:'https://console.test'},addEventListener(type,fn){handlers[type]=fn;}},
   caches:{match:async()=>stale,open:async()=>({put:async(req,r)=>writes.push(r)})},fetch:async()=>fresh};
  vm.createContext(box);vm.runInContext(fs.readFileSync('sw.js','utf8'),box);
  const html=fs.readFileSync('admin_console.html','utf8'),scripts=[...html.matchAll(/<script src="([^"]+)"/g)].map(m=>m[1]).filter(f=>/^(storage-adapter|admin-mail|admin-release-notes)\.js/.test(f));
  scripts.push(fs.readFileSync('admin-release-notes.js','utf8').match(/fetch\("([^"]+)"/)[1]);
  for(const file of scripts){
   let response;const pending=[];handlers.fetch({request:{url:'https://console.test/'+file,method:'GET'},respondWith(p){response=p;},waitUntil(p){pending.push(p);}});
   assert.equal(await response,fresh,'cached '+file+' must not hide a deployed update');await Promise.all(pending);
  }
  console.log('PASS #674 releases service worker refreshes an already-cached release ledger and console scripts');
 }catch(e){console.error('FAIL #674 releases service worker refreshes an already-cached release ledger and console scripts: '+e.message);process.exitCode=1;}
})();
