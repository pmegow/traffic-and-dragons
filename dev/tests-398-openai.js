// Isolated transport and scheduler fixtures: no paid requests or real audio.
const assert=require('assert/strict'),engine=require('./load-engine.js');engine.loadEngine();
const realTimer=global.setTimeout,realFetch=global.fetch;
const sleep=ms=>new Promise(r=>realTimer(r,ms));
const calls=[],sources=[],toasts=[];
global.document={getElementById:()=>null,addEventListener:()=>{},removeEventListener:()=>{}};
global.window={AudioContext:function(){this.state='running';this.currentTime=0;this.sampleRate=24000;this.destination={};this.createGain=()=>({gain:{},connect(){}});this.createBuffer=(c,n,r)=>({duration:n/r,getChannelData:()=>new Float32Array(n)});this.createBufferSource=()=>{const src={context:this,connect(){},disconnect(){},start(){if(!this.loop)sources.push(this)},stop(){},buffer:null};return src;};}};
global.showToast=m=>toasts.push(m);providerKeys.openai='synthetic-test-key';
let passed=0;async function test(name,fn){try{TTS.stop();TTS._openai.reset();calls.length=0;sources.length=0;await fn();passed++;console.log('PASS '+name)}catch(e){console.error('FAIL '+name+' — '+e.message);process.exitCode=1}finally{TTS.stop();global.setTimeout=realTimer;global.fetch=realFetch;}}
async function settled(p){let timer;try{return await Promise.race([p,new Promise((r,j)=>{timer=realTimer(()=>j(Error('operation stayed pending')),250)})])}finally{clearTimeout(timer)}}
const pcm=()=>({ok:true,status:200,arrayBuffer:async()=>new Uint8Array([0,0,255,127]).buffer});
(async()=>{
 await test('#398 request uses speech model, PCM, direction, speed and bearer key',async()=>{
  global.fetch=async(url,opts)=>{calls.push({url,opts});return pcm()};store.set('tnd_tts_rate_v1','1.1');
  const r=await TTS._openai.fetchGroup({text:'A quiet road.',voice:'cedar'},true,'synthetic-test-key','Read quietly.');
  assert.equal(calls.length,1);assert.equal(calls[0].url,'https://api.openai.com/v1/audio/speech');assert.equal(calls[0].opts.headers.Authorization,'Bearer synthetic-test-key');
  const b=JSON.parse(calls[0].opts.body);assert.equal(b.model,'gpt-4o-mini-tts');assert.equal(b.voice,'cedar');assert.equal(b.input,'A quiet road.');assert.equal(b.instructions,'Read quietly.');assert.equal(b.response_format,'pcm');assert.equal(b.speed,1.1);assert.equal(r.rate,24000);assert.equal(r.bytes.length,4);
 });
 for(const phase of ['headers','body'])await test('#398 deadline aborts stalled '+phase+' even if transport ignores abort',async()=>{
  let signal;global.setTimeout=(fn,ms)=>realTimer(fn,Math.min(ms,15));
  global.fetch=async(url,opts)=>{signal=opts.signal;return phase==='headers'?new Promise(()=>{}):{ok:true,arrayBuffer:()=>new Promise(()=>{})}};
  const r=await settled(TTS._openai.fetchGroup({text:'Wait.',voice:'marin'},false,'fixture',''));
  assert.match(r.fail,/timeout/);assert.equal(signal.aborted,true);
 });
 await test('#398 explicit cancellation settles without retries or stale PCM',async()=>{
  let ctrl;global.fetch=()=>new Promise(()=>{});
  const p=TTS._openai.fetchGroup({text:'Wait.',voice:'marin'},false,'fixture','',c=>ctrl=c);ctrl.abort();
  assert.match((await settled(p)).fail,/cancelled/);
 });
 await test('#398 rejected or malformed audio never schedules and never retries',async()=>{
  for(const status of [401,429,500]){let n=0;global.fetch=async()=>{n++;return{ok:false,status}};const r=await TTS._openai.fetchGroup({text:'Wait.',voice:'marin'},false,'fixture','');assert.match(r.fail,new RegExp(String(status)));assert.equal(n,1)}
  for(const bytes of [new Uint8Array(0),new Uint8Array(3)]){global.fetch=async()=>({ok:true,arrayBuffer:async()=>bytes.buffer});assert.match((await TTS._openai.fetchGroup({text:'Wait.',voice:'marin'},false,'fixture','')).fail,/invalid PCM/)}
 });
 await test('#398 Stop aborts every prefetched request immediately and late audio stays silent',async()=>{
  const pending=[];global.fetch=(url,opts)=>{pending.push({signal:opts.signal});return new Promise(resolve=>pending[pending.length-1].resolve=resolve)};
  TTS._openai.select(true);TTS.speak('First line. Second line. Third line.',null,{1:'cast-a',2:'cast-b'});await sleep(10);
  assert.equal(pending.length,2,'prefetch must be bounded at two');TTS.stop();assert(pending.every(p=>p.signal.aborted),'stop left paid fetch alive');
  pending.forEach(p=>p.resolve(pcm()));await sleep(10);assert.equal(sources.length,0,'cancelled audio played');assert.equal(TTS.isPlaying(),false);
 });
 await test('#398 Skip releases audition status and aborts its request',async()=>{
  let signal;const phases=[];global.fetch=(url,opts)=>{signal=opts.signal;return new Promise(()=>{})};TTS.testOpenaiVoice('cedar','Whisper.',p=>phases.push(p));await sleep(10);TTS.skip();assert(signal.aborted);assert.equal(phases.at(-1),'idle');assert.equal(TTS.isPlaying(),false);
 });
 await test('#398 out-of-order synthesis plays in order and releases audio nodes',async()=>{
  const pending=[];global.fetch=(url,opts)=>new Promise(resolve=>pending.push({resolve,body:JSON.parse(opts.body)}));TTS._openai.select(true);TTS.speak('First line. Second line.',null,{1:'cast-a'});await sleep(10);assert.equal(pending.length,2);
  pending[1].resolve(pcm());await sleep(5);assert.equal(sources.length,0,'second voice jumped ahead');pending[0].resolve(pcm());await sleep(10);assert.equal(sources.length,2);assert.equal(sources[0].buffer.duration,2/24000);assert(TTS.isPlaying());sources.slice().forEach(s=>s.onended());assert.equal(TTS.isPlaying(),false);assert(sources.every(s=>s.buffer===null));
 });
 await test('#398 a later group failure hands off only unread text and drains the queue',async()=>{
  const spoken=[];global.SpeechSynthesisUtterance=function(text){this.text=text};
  global.speechSynthesis=window.speechSynthesis={cancel(){},resume(){},getVoices(){return[]},speak(u){spoken.push(u.text);realTimer(()=>{if(u.onend)u.onend()},1)}};
  let n=0;global.fetch=async()=>++n===1?pcm():{ok:false,status:429};
  TTS._openai.select(true);TTS.speak('First line. Second line.',null,{1:'cast-a'});await sleep(10);
  assert.equal(sources.length,1);sources[0].onended();await sleep(50);
  assert.equal(spoken.join(' '),'Second line.','fallback replayed or dropped words');assert.equal(TTS.isPlaying(),false);assert(toasts.some(t=>t.includes('HTTP 429')));
 });
 await test('#398 repeated auditions cancel old callbacks before starting the new one',async()=>{
  const pending=[],old=[],fresh=[];global.fetch=(u,o)=>{pending.push(o.signal);return new Promise(()=>{})};TTS.testOpenaiVoice('marin','',p=>old.push(p));await sleep(5);TTS.testOpenaiVoice('cedar','',p=>fresh.push(p));await sleep(5);assert(pending[0].aborted);assert.equal(old.at(-1),'idle');assert.equal(fresh.at(-1),'loading');TTS.stop();assert.equal(fresh.at(-1),'idle');
 });
 console.log((process.exitCode?'FAILED':'ALL GREEN')+' — '+passed+' OpenAI transport/playback groups');
})().catch(e=>{console.error(e);process.exitCode=1});
