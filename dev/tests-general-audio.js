const assert=require('assert/strict'),fs=require('fs'),vm=require('vm'),crypto=require('crypto').webcrypto;
const scope={console,Promise,Uint8Array,AbortController,setTimeout,clearTimeout,crypto};vm.createContext(scope);
for(const f of ['audio-catalog.js','audio-scenes.js','ambient.js','audio-loader.js'])vm.runInContext(fs.readFileSync(f,'utf8'),scope);
function stream(chunks){let reads=0,cancelled=false;return {ok:true,headers:{get:()=>null},body:{getReader:()=>({read:()=>Promise.resolve(reads<chunks.length?{value:new Uint8Array(chunks[reads++])}:{done:true}),cancel:()=>{cancelled=true;return Promise.resolve()}})},inspect:()=>({reads,cancelled})};}
(async()=>{
 const r=stream([4,4,4,4]);await assert.rejects(scope.audioReadBytes(r,10),/size limit/);assert.equal(r.inspect().reads,3);assert(r.inspect().cancelled);
 assert.equal((await scope.audioReadBytes(stream([3,4]),7)).byteLength,7);
 const scene=scope.AUDIO_CATALOG.assets[0],data=fs.readFileSync(scene.bed.url);let decoded=0,finish;
 scope.fetch=async()=>({ok:true,headers:{get:()=>String(data.length)},body:new ReadableStream({start(c){c.enqueue(data);c.close()}})});
 const loader=scope.createAudioLoader({decodeAudioData:(b,ok)=>{decoded++;finish=ok}},scope.AUDIO_CATALOG),abort=new AbortController();
 const job=loader.load(scene,abort.signal);while(!finish)await new Promise(r=>setTimeout(r,1));abort.abort();assert.equal(loader.inspect().reservedDecodes,1,'cancelled native decode still owns its reservation');
 await assert.rejects(loader.load(scene,new AbortController().signal),/still settling/);finish({duration:scene.bed.loopEnd,length:432240,numberOfChannels:1});await assert.rejects(job,/cancelled/);assert.equal(loader.inspect().decodedBytes,0);assert.equal(decoded,1);
 let load=loader.load(scene,new AbortController().signal);finish=null;while(!finish)await new Promise(r=>setTimeout(r,1));const buffer={duration:scene.bed.loopEnd,length:432240,numberOfChannels:1};finish(buffer);assert.equal(await load,buffer);assert.equal(loader.inspect().decodedBytes,1728960);loader.release(buffer);assert.equal(loader.inspect().decodedBytes,0);
 const roomy=scope.AUDIO_CATALOG.assets[2],roomyData=fs.readFileSync(roomy.bed.url);
 scope.fetch=async()=>({ok:true,headers:{get:()=>String(roomyData.length)},body:new ReadableStream({start(c){c.enqueue(roomyData);c.close()}})});
 const capacity=scope.createAudioLoader({decodeAudioData:(b,ok)=>ok({duration:roomy.bed.loopEnd,length:5000000,numberOfChannels:1})},scope.AUDIO_CATALOG);
 const held1=await capacity.load(roomy,new AbortController().signal),held2=await capacity.load(roomy,new AbortController().signal);
 assert.equal(capacity.inspect().decodedBytes,40000000);await assert.rejects(capacity.load(roomy,new AbortController().signal),/budget exhausted/);
 capacity.release(held1);capacity.release(held2);assert.equal(capacity.inspect().decodedBytes,0);
 scope.fetch=async()=>({ok:true,headers:{get:()=>null},body:new ReadableStream({start(c){c.enqueue(new Uint8Array([1,2,3]));c.close()}})});await assert.rejects(loader.load(scene,new AbortController().signal),/checksum/);assert.equal(loader.inspect().decodedBytes,0);assert.equal(decoded,2);
 console.log('GENERAL AUDIO: streamed overflow, boundary, cancellation reservation, release, aggregate capacity and checksum checks passed');
})().catch(e=>{console.error(e);process.exitCode=1});
