const assert=require('assert/strict'),fs=require('fs'),vm=require('vm');
const scope={console,Promise,AbortController,setTimeout,clearTimeout};vm.createContext(scope);
['audio-catalog.js','audio-scenes.js','ambient.js'].forEach(f=>vm.runInContext(fs.readFileSync(f,'utf8'),scope));
const smith={enabled:true,unlocked:true,visible:true,volume:.5,campaignKind:'village',campaignId:'one',nodeKey:'Village|the smithy',common:'the smithy',open:true};
const outside={...smith,nodeKey:'Village',common:null,open:null,exterior:true,minuteOfDay:600};
const flush=async()=>{for(let i=0;i<10;i++)await Promise.resolve()};
function fixture(){let now=0;const requests=[],voices=[],errors=[],timers=[];
const driver={abort:()=>new AbortController(),load:(scene,signal)=>new Promise((resolve,reject)=>requests.push({scene,signal,resolve,reject})),start:(buffer,scene,gain)=>{const v={buffer,scene,gain,stopped:false};voices.push(v);return v},gain:(v,g)=>v.gain=g,fade:(v,to,seconds)=>{v.fade={to,seconds}},stop:v=>v.stopped=true,error:e=>errors.push(e.message),later:(fn,ms)=>{const t={fn,at:now+ms};timers.push(t);return t},cancel:t=>t.cancelled=true};
return {c:scope.createAmbientController(driver,scope.AUDIO_SCENES),requests,voices,errors,tick(ms){now+=ms;for(const t of timers)if(!t.cancelled&&!t.fired&&t.at<=now){t.fired=true;t.fn()}}};}
let passed=0;async function test(name,fn){try{await fn();passed++;console.log('PASS exterior '+name)}catch(e){console.error('FAIL exterior '+name+' — '+e.stack);process.exitCode=1}}
(async()=>{
await test('clock bands cover midnight and exact boundaries without using interior hours',()=>{
for(const [minute,id] of [[0,'village-night'],[299,'village-night'],[300,'village-morning'],[599,'village-morning'],[600,'village-day'],[1079,'village-day'],[1080,'village-evening'],[1259,'village-evening'],[1260,'village-night'],[1439,'village-night']])assert.equal(scope.ambientPlan({...outside,minuteOfDay:minute},scope.AUDIO_SCENES).scene?.id,id);
for(const bad of [{exterior:false},{minuteOfDay:null},{minuteOfDay:NaN},{campaignKind:'adventure'},{nodeKey:null}])assert.equal(scope.ambientPlan({...outside,...bad},scope.AUDIO_SCENES).scene,null);
assert.equal(scope.ambientPlan({...smith,open:null},scope.AUDIO_SCENES).scene,null);
});
await test('forge exit overlaps two voices then releases the old buffer',async()=>{
const f=fixture();f.c.update(smith);await flush();f.requests[0].resolve({});await flush();f.c.update(outside);assert(!f.voices[0].stopped,'forge cut immediately');assert.equal(f.voices[0].fade.to,0);await flush();f.requests[1].resolve({});await flush();assert.equal(f.c.inspect().sources,2);assert.equal(f.voices[1].fade.to,1);assert.equal(f.voices[1].fade.seconds,3);f.tick(3000);assert(f.voices[0].stopped);assert.equal(f.c.inspect().sources,1);assert.equal(f.c.inspect().buffers,1);f.c.dispose();
});
await test('microphone silences BOTH fading voices synchronously; narration ducks both',async()=>{
const f=fixture();f.c.update(smith);await flush();f.requests[0].resolve({});await flush();f.c.update(outside);await flush();f.requests[1].resolve({});await flush();f.c.update({...outside,capturing:true});assert.equal(f.voices.filter(v=>!v.stopped).length,2);assert(f.voices.every(v=>v.gain===0));f.c.update({...outside,speaking:true});for(const v of f.voices)assert(Math.abs(v.gain-v.scene.bed.gain*.5*scope.AMBIENT_DUCK)<1e-9);/* v1.940: depth is the engine constant, not a literal */f.c.dispose();
});
await test('rapid reentry reverses an existing voice and never leaves a stale retirement',async()=>{
const f=fixture();f.c.update(smith);await flush();f.requests[0].resolve({});await flush();f.c.update(outside);await flush();f.requests[1].resolve({});await flush();f.c.update(smith);assert.equal(f.requests.length,2);assert.equal(f.c.inspect().sources,2);assert.equal(f.voices[0].fade.to,1);f.tick(3000);assert(!f.voices[0].stopped);assert(f.voices[1].stopped);f.c.dispose();
});
await test('late downloads cannot restart a departed scene and third transitions stay bounded',async()=>{
const f=fixture();f.c.update(smith);await flush();f.requests[0].resolve({});await flush();f.c.update(outside);await flush();f.c.update({...outside,minuteOfDay:1300});assert(f.requests[1].signal.aborted);assert.equal(f.requests.length,2);f.requests[1].resolve({stale:true});await flush();assert.equal(f.requests.length,3);assert.equal(f.voices.length,1);f.requests[2].resolve({});await flush();assert.equal(f.c.inspect().sources,2);f.c.update({...outside,minuteOfDay:1100});await flush();f.requests[3].resolve({});await flush();assert.equal(f.c.inspect().sources,2);assert(f.voices[0].stopped);f.c.dispose();
});
await test('pause disable campaign change hidden idle and disposal cut both voices immediately',async()=>{
for(const change of [{held:true},{enabled:false},{hidden:true},{visible:false},{paused:true},{campaignId:'two'}]){const f=fixture();f.c.update(smith);await flush();f.requests[0].resolve({});await flush();f.c.update(outside);await flush();f.requests[1].resolve({});await flush();f.c.update({...outside,...change});assert(f.voices.every(v=>v.stopped),JSON.stringify(change));assert.equal(f.c.inspect().buffers,0);f.c.dispose();f.tick(4000);}
});
await test('failed destination is visible and old scene still fades; retry remains explicit',async()=>{
const f=fixture();f.c.update(smith);await flush();f.requests[0].resolve({});await flush();f.c.update(outside);await flush();f.requests[1].reject(Error('HTTP 404'));await flush();f.tick(3000);assert.equal(f.c.inspect().sources,0);assert.deepEqual(f.errors,['HTTP 404']);for(let i=0;i<100;i++)f.c.update(outside);await flush();assert.equal(f.requests.length,2);f.c.retry();await flush();assert.equal(f.requests.length,3);f.c.dispose();
});
console.log('Exterior transitions: '+passed+' passed');
})().catch(e=>{console.error(e);process.exitCode=1});
