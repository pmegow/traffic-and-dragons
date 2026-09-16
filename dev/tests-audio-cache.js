const assert=require('assert/strict'),fs=require('fs'),vm=require('vm'),crypto=require('crypto');
const scope={console,Promise,URL,Headers,Response,Uint8Array,crypto:crypto.webcrypto};vm.createContext(scope);
for(const f of ['audio-loader.js','audio-cache.js'])vm.runInContext(fs.readFileSync(f,'utf8'),scope);
async function exercise(bytes,count){
 const payload=new Uint8Array(bytes),sha=crypto.createHash('sha256').update(payload).digest('hex'),map=new Map();let fetches=0;
 const assets=Array.from({length:count+3},(_,i)=>({bed:{url:'sfx/'+i+'.mp3',maxBytes:bytes},sha256:sha}));
 const key=r=>typeof r==='string'?r:r.url;
 const cache={keys:async()=>[...map.keys()].map(url=>({url})),match:async r=>map.has(key(r))?new Response(new Uint8Array(map.get(key(r))),{headers:{'Content-Length':map.get(key(r))}}):undefined,delete:async r=>map.delete(key(r)),put:async(r,v)=>{map.set(key(r),(await v.arrayBuffer()).byteLength)}};
 const api=scope.createAudioCache({name:'fixture',catalog:{assets},caches:{open:async()=>cache},fetch:async()=>{fetches++;return new Response(payload)}});
 const req=i=>({url:'https://game.test/sfx/'+i+'.mp3',headers:new Headers()});
 for(let i=0;i<count;i++)await api.fetch(req(i));
 assert(map.size<=32);assert([...map.values()].reduce((a,b)=>a+b,0)<=32*1024*1024);assert(!map.has(req(0).url),'oldest evicted');
 const keep=[...map.keys()][0];await api.fetch({url:keep,headers:new Headers()});const before=fetches;await api.fetch({url:keep,headers:new Headers()});assert.equal(fetches,before,'cache hit stays offline');
 await api.fetch(req(count));assert(map.has(keep),'recent hit survives eviction');assert.equal(api.inspect().queued,0);
}
(async()=>{
 await exercise(2*1024*1024,18);await exercise(1,34);
 let warned=false;const api=scope.createAudioCache({name:'fixture',catalog:{assets:[{bed:{url:'sfx/x.mp3'}}]},caches:{open:async()=>{throw Error('cache blocked')}},fetch:async()=>new Response('audio'),warn:()=>warned=true});
 assert.equal(await (await api.fetch({url:'https://game.test/sfx/x.mp3',headers:new Headers()})).text(),'audio');assert(warned,'cache failure visible');
 console.log('AUDIO CACHE GREEN: byte cap, entry cap, LRU, offline hits and unavailable-cache playback');
})().catch(e=>{console.error(e);process.exitCode=1});
