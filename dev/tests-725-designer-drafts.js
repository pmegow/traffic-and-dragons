const assert=require('assert/strict'),Drafts=require('../blueprint-designer-drafts.js');
const realTimeout=setTimeout;global.setTimeout=(...args)=>{const t=realTimeout(...args);t.unref();return t;};
let passed=0;async function test(name,fn){try{await fn();console.log('PASS '+name);passed++;}catch(e){console.error('FAIL '+name);throw e;}}
const tick=()=>new Promise(r=>setImmediate(r));
(async()=>{
await test('pending begins before debounce and clears only after the latest transaction',async()=>{
 let value=1,release,writes=[],states=[];const adapter={write:payload=>new Promise(r=>{writes.push(payload);release=r;})};const writer=Drafts.writer(adapter,()=>({value}),s=>states.push(s),100000);
 writer.schedule();assert(writer.unsettled());const first=writer.flush();await tick();assert.equal(writes[0].value,1);value=2;writer.schedule();writer.flush();await tick();assert.equal(writes.length,1);release();await tick();assert(writer.unsettled());assert.equal(writes[1].value,2);assert.equal(states.at(-1).kind,'pending');release();await first;assert(!writer.unsettled());assert.equal(states.at(-1).kind,'saved');writer.close();
});
await test('failed writes retain pending edits and report the reason until explicit retry',async()=>{
 let fail=true,states=[],saved;const writer=Drafts.writer({write:async p=>{if(fail)throw Error('Quota exceeded');saved=p;}},()=>({value:42}),s=>states.push(s),100000);
 writer.schedule();await assert.rejects(writer.flush(),/Quota exceeded/);assert(writer.unsettled());writer.schedule();assert.equal(states.at(-1).kind,'error');assert.match(states.at(-1).error.message,/Quota exceeded/);fail=false;await writer.retry();assert.equal(saved.value,42);assert(!writer.unsettled());writer.close();
});
await test('a replacement queued during a write is persisted last without deleting the prior draft',async()=>{
 let current={name:'Old'},release,writes=[];const writer=Drafts.writer({write:p=>new Promise(r=>{writes.push(p);release=r;})},()=>current,()=>{},100000);writer.schedule();const p=writer.flush();await tick();current={name:'New'};writer.schedule();release();await tick();assert.equal(writes[1].name,'New');release();await p;assert.equal(writes.at(-1).name,'New');writer.close();
});
await test('conflicts cannot be retried into an overwrite',async()=>{
 const e=Error('Another Designer tab saved a newer draft');e.code='conflict';let calls=0;const writer=Drafts.writer({write:async()=>{calls++;throw e;}},()=>({}),()=>{},100000);writer.schedule();await assert.rejects(writer.flush(),/newer draft/);await assert.rejects(writer.retry(),/newer draft/);assert.equal(calls,1);assert(writer.unsettled());writer.close();
});
await test('closed writers cannot repaint a replacement session',async()=>{
 let release,states=[];const writer=Drafts.writer({write:()=>new Promise(r=>release=r)},()=>({}),s=>states.push(s),100000);writer.schedule();const p=writer.flush();await tick();writer.close();const count=states.length;release();await p;assert.equal(states.length,count);
});
await test('blocked opens reject visibly and close late connections',async()=>{
 let request={},closed=false;const store=Drafts.create({indexedDB:{open:()=>request},readLegacy:()=>null});const p=store.load();request.onblocked();await assert.rejects(p,/blocking draft storage/);request.result={close(){closed=true;}};request.onsuccess();assert(closed);store.close();
});
console.log('DESIGNER DRAFTS: '+passed+' passed');
})().catch(e=>{console.error(e);process.exitCode=1;});
