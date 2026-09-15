const assert = require('assert/strict'), fs = require('fs'), vm = require('vm'), path = require('path');
const root = path.join(__dirname, '..');
const source = f => fs.readFileSync(path.join(root, f), 'utf8');
const sandbox = {console, Promise, AbortController}; vm.createContext(sandbox);
['audio-events.js','audio-scenes.js','ambient.js'].forEach(f=>vm.runInContext(source(f), sandbox));
const base = {enabled:true,unlocked:true,visible:true,volume:0.5,campaignKind:'village',campaignId:'one',nodeKey:'Village|the smithy',common:'the smithy',open:true};
const flush = async()=>{for(let i=0;i<8;i++)await Promise.resolve()};
let passed = 0;
async function test(name,fn){try{await fn();passed++;console.log('PASS L7 '+name)}catch(e){console.error('FAIL L7 '+name+' — '+e.stack);process.exitCode=1}}
function fixture(){
 const requests=[], voices=[], errors=[];
 const driver={abort:()=>new AbortController(),load:(scene,signal)=>new Promise((resolve,reject)=>requests.push({scene,signal,resolve,reject})),
 start:(buffer,scene,gain)=>{const v={buffer,scene,gain,stopped:false};voices.push(v);return v},gain:(v,g)=>v.gain=g,fade:(v,to,seconds)=>v.fade={to,seconds},later:()=>({}),cancel:()=>{},stop:v=>{v.stopped=true},error:e=>errors.push(e.message)};
 return {c:sandbox.createAmbientController(driver,sandbox.AUDIO_SCENES),requests,voices,errors};
}
(async()=>{
 await test('same scene reuses one source; microphone silences synchronously',async()=>{
  const f=fixture();f.c.update(base);await flush();f.requests[0].resolve({});await flush();
  for(let i=0;i<1000;i++)f.c.update(base);await flush();
  assert.equal(f.voices.length,1);assert.equal(f.requests.length,1);
  f.c.update({...base,capturing:true});assert.equal(f.voices[0].gain,0);
  f.c.update({...base,speaking:true});assert(f.voices[0].gain<0.275);
  f.c.update(base);assert.equal(f.voices[0].gain,0.275);f.c.dispose();assert(f.voices[0].stopped);
 });
 await test('leave during load discards stale audio; rapid reentry never overlaps decodes',async()=>{
  const f=fixture();f.c.update(base);await flush();f.c.update({...base,open:false});assert(f.requests[0].signal.aborted);
  f.c.update({...base,campaignId:'two'});await flush();assert.equal(f.requests.length,1);
  f.requests[0].resolve({stale:true});await flush();assert.equal(f.voices.length,0);assert.equal(f.requests.length,2);
  f.requests[1].resolve({fresh:true});await flush();assert.equal(f.voices.length,1);assert(f.voices[0].buffer.fresh);
  f.c.update({...base,campaignId:'three'});assert(f.voices[0].stopped);f.c.dispose();
 });
 await test('failure is visible once and does not retry per UI refresh',async()=>{
  const f=fixture();f.c.update(base);await flush();f.requests[0].reject(Error('HTTP 404'));await flush();
  for(let i=0;i<100;i++)f.c.update(base);await flush();assert.equal(f.requests.length,1);assert.deepEqual(f.errors,['HTTP 404']);
  f.c.retry();await flush();assert.equal(f.requests.length,2);f.c.dispose();f.requests[1].resolve({});await flush();assert.equal(f.voices.length,0);
 });
 await test('pause and hidden-idle release sources and buffers; speech may continue hidden',async()=>{
  const f=fixture();f.c.update(base);await flush();f.requests[0].resolve({});await flush();
  f.c.update({...base,hidden:true,speaking:true});assert.equal(f.c.inspect().sources,1);
  f.c.update({...base,held:true});assert.equal(f.c.inspect().sources,0);assert.equal(f.c.inspect().buffers,0);
  f.c.update({...base,hidden:true});await flush();assert.equal(f.requests.length,1);
 });
 await test('buffer admission enforces memory channels duration and loop bounds',()=>{
  const b={duration:18,length:864000,numberOfChannels:1},bed=sandbox.AUDIO_SCENES[0].bed;
  assert.equal(sandbox.ambientValidateBuffer(b,bed),b);
  for(const change of [{duration:21},{numberOfChannels:2},{length:1000001},{duration:17}])assert.throws(()=>sandbox.ambientValidateBuffer({...b,...change},bed));
  assert.throws(()=>sandbox.ambientValidateBuffer(b,{...bed,loopStart:19}));
 });
 await test('event subscribers coexist and unsubscribe without replacing another listener',()=>{
  const ev=sandbox.createAudioEvents(),seen=[];const a=x=>seen.push('a'+x),b=x=>seen.push('b'+x);
  ev.on('state',a);ev.on('state',a);const off=ev.on('state',b);ev.emit('state',1);off();ev.emit('state',2);assert.deepEqual(seen,['a1','b1','a2']);
 });
 await test('native microphone is silenced before start and released on failure/end',()=>{
  const seen=[], input={value:'',focus(){},blur(){}};let rec;
  function Rec(){rec=this;this.start=()=>{seen.push('start');if(this.fail)throw Error('no mic')};this.stop=()=>{};this.abort=()=>{this.onend()}}
  const c={console,window:{SpeechRecognition:Rec},document:{getElementById:id=>id==='action-input'?input:null},store:{get:()=>null,set(){}},eachMenuEl(){},setTimeout,clearTimeout,carMode:false,busy:false};
  vm.createContext(c);vm.runInContext(source('audio-events.js')+'\n'+source('stt.js'),c);
  c.STT.on('capture',v=>seen.push(v));let legacy=0;c.STT.setOnState(()=>legacy++);
  c.STT.start();assert.deepEqual(seen,[true,'start']);c.STT.stop();assert.equal(seen.at(-1),'start','stop must wait for actual capture end');rec.onend();assert.equal(seen.at(-1),false);assert(legacy>=2);
 });
 await test('cloud microphone gate precedes getUserMedia and recovers on denied permission',async()=>{
  const seen=[],input={value:''};
  const c={console,window:{},document:{getElementById:id=>id==='action-input'?input:null},navigator:{mediaDevices:{getUserMedia:()=>{seen.push('getUserMedia');return Promise.reject(Error('denied'))}}},MediaRecorder:function(){},providerKeys:{openai:'fixture'},store:{get:()=>null},eachMenuEl(){},setTimeout,clearTimeout};
  vm.createContext(c);vm.runInContext(source('audio-events.js')+'\n'+source('stt.js'),c);c.STT.on('capture',v=>seen.push(v));c.STT.start();assert.deepEqual(seen,[true,'getUserMedia']);await flush();assert.equal(seen.at(-1),false);
 });
 await test('delivery and voice seams are loaded and player pause uses the existing document intent',()=>{
  const ui=source('ui-ambient.js');assert(ui.includes('document.addEventListener("tnd:car-intent"'));assert(ui.includes('e.detail.kind === "pause"'));assert(ui.includes('STT.on("capture"'));assert(ui.includes('TTS.on("state"'));
  assert(source('index.html').indexOf('src="audio-events.js"')<source('index.html').indexOf('src="tts.js"'));
  assert(source('sw.js').includes('/sfx\\/'));assert(fs.statSync(path.join(root,sandbox.AUDIO_SCENES[0].bed.url)).size<sandbox.AUDIO_SCENES[0].bed.maxBytes);
 });
 console.log('L7 ambient: '+passed+' passed');
})().catch(e=>{console.error(e);process.exitCode=1});
