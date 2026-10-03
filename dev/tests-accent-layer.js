// The accent layer (Proposal_general_audio.html §21): the controller over a fake clock/driver, the catalog builder's
// refusals, and the loader + service-worker cache serving a real sprite. Node-only (async), registered as a standalone suite.
const assert=require('assert/strict'),fs=require('fs'),vm=require('vm'),path=require('path'),crypto=require('crypto');
const root=path.resolve(__dirname,'..');process.chdir(root);
const scope={console,Promise,Uint8Array,AbortController,setTimeout,clearTimeout,URL,Headers,Response,ReadableStream,crypto:crypto.webcrypto,Object,JSON,Math,Number,String,Array,Error,isFinite,parseInt};
vm.createContext(scope);
for(const f of ['audio-catalog.js','audio-profile.js','audio-scenes.js','ambient.js','audio-accents.js','audio-loader.js','audio-cache.js'])vm.runInContext(fs.readFileSync(f,'utf8'),scope,{filename:f});
const {build}=require('./build-audio-catalog.js');
function catalog(mix){const c=JSON.parse(JSON.stringify(scope.AUDIO_CATALOG));c.assets.forEach(a=>{if(a.role==='accent')a.approval.mix=mix!==false});return c;}
function rng(seed){let x=seed;return()=>{x=(x*1103515245+12345)%2147483648;return x/2147483648;};}
const flush=()=>new Promise(r=>setTimeout(r,0));

async function controller(){
 let now=0,bedPending=true;const timers=[],loads=[],plays=[],stops=[],released=[],errors=[],warns=[];
 const driver={now:()=>now,later:(fn,ms)=>{const h={at:now+ms,fn};timers.push(h);return h;},cancel:h=>{h.cancelled=true;},
  abort:()=>new AbortController(),idle:()=>true,bedPending:()=>bedPending,
  load:set=>{const j={set};j.p=new Promise((ok,no)=>{j.ok=ok;j.no=no;});loads.push(j);return j.p;},
  release:b=>released.push(b),rng:rng(5),error:e=>errors.push(e),warn:m=>warns.push(m),
  play:(buffer,set,steps,gain)=>{const v={buffer,steps,gain,done:false};plays.push(v);return v;},stop:(v,sec)=>{stops.push(sec);v.done=true;}};
 function advance(ms){const end=now+ms;for(;;){const due=timers.filter(h=>!h.cancelled&&!h.fired&&h.at<=end).sort((a,b)=>a.at-b.at)[0];if(!due)break;now=due.at;due.fired=true;due.fn();}now=end;}
 const c=scope.createAccentController(driver,catalog(),scope.AUDIO_SCENES);
 const tavern={enabled:true,unlocked:true,visible:true,volume:0.8,campaignKind:'village',campaignId:'one',generation:1,nodeKey:'The Village|the tavern',common:'the tavern',open:true,minuteOfDay:1200};
 c.update(tavern);await flush();assert.equal(loads.length,0,'accents never load while the bed is still decoding');
 /* no second update: in the real page nothing calls sync() when the bed's decode settles, so the layer must retry by itself */
 bedPending=false;advance(1000);await flush();assert.equal(loads.length,1,'a deferred accent load retries once the bed settles, without waiting for an unrelated update');assert.equal(loads[0].set.id,'footsteps-wood');
 const buf={id:'sprite'};loads[0].ok(buf);await flush();await flush();
 assert.equal(c.inspect().buffers,1);assert(c.inspect().scheduled,'a loaded set is scheduled');
 advance(scope.ACCENT_ARRIVAL_QUIET_MS-1);assert.equal(plays.length,0,'arrival stays quiet for 20 s');
 advance(300000);assert(plays.length>=1,'footsteps within five minutes of quiet');
 const p=plays[0];assert.equal(p.buffer,buf);assert(p.steps.length>=3&&p.steps.length<=7);assert(p.gain>=0.35*0.8-1e-9&&p.gain<=0.7*0.8+1e-9,'gain = a level from the set range (35–70%) × volume');
 p.done=false;let before=plays.length;c.update({...tavern,speaking:true});assert.equal(stops.at(-1),0.15,'narration fades a burst in progress in 0.15 s');
 advance(600000);assert.equal(plays.length,before,'never over narration');
 c.update(tavern);advance(scope.ACCENT_SETTLE_MS-1);assert.equal(plays.length,before,'nothing inside the 3 s settle');
 advance(600000);assert(plays.length>before,'accents resume after narration');plays.at(-1).done=false;before=plays.length;
 c.update({...tavern,capturing:true});assert(!c.inspect().scheduled,'the mic cancels the schedule');assert.equal(stops.at(-1),0,'the mic cuts at once');
 advance(900000);assert.equal(plays.length,before,'silent while the mic is open');
 c.update(tavern);advance(scope.ACCENT_ARRIVAL_QUIET_MS-1);assert.equal(plays.length,before,'no backlog released after capture');
 assert.equal(c.inspect().buffers,1,'a mic toggle keeps the loaded set');
 c.update({...tavern,nodeKey:'The Village',common:null,open:null});
 assert(released.includes(buf),'leaving releases the buffer');assert.equal(c.inspect().buffers,0);assert.equal(c.inspect().key,'');
 c.update(tavern);await flush();loads.at(-1).no(new Error('Ambience decoded-memory budget exhausted'));await flush();await flush();
 assert.equal(warns.length,1,'a memory refusal is logged');assert.equal(errors.length,0,'…and quiets the optional layer without a failure toast');
 c.update({...tavern,generation:2});await flush();loads.at(-1).no(new Error('Ambience asset checksum does not match the catalog'));await flush();await flush();
 assert.equal(errors.length,1,'a real load failure is reported');
 c.update({...tavern,generation:3});await flush();const j=loads.at(-1),b2={id:'b2'};j.ok(b2);await flush();await flush();
 c.shed();assert(released.includes(b2),'shed frees accent memory for the bed');assert.equal(c.inspect().buffers,0);
 c.update({...tavern,generation:3});await flush();assert.notEqual(loads.at(-1),j,'a shed set reloads once there is room');
 c.dispose();assert.equal(c.inspect().key,'');
 const late={id:'late'};c.update(tavern);loads.at(-1).ok(late);await flush();assert.equal(c.inspect().buffers,0,'a disposed layer ignores updates');
}

function builder(){
 const text=build();assert.equal(fs.readFileSync('audio-catalog.js','utf8'),text,'audio-catalog.js is current');
 const input=JSON.parse(fs.readFileSync('dev/audio-delivery.json','utf8')),acc=input.assets.find(a=>a.role==='accent');
 assert(acc&&acc.approval.mix===true,'the owner approved the footsteps mix by listening in the audition page (2026-09-23)');
 const breaks={
  'bed and sprite':a=>{a.bed={url:a.sprite.url,maxBytes:1e6};},
  'cuts':a=>{a.sprite.cuts=[[0.5,0.5]];},
  'cut past the sprite':a=>{a.sprite.cuts=[[0.25,99]];},
  'pattern kind':a=>{a.pattern={kind:'loop'};},
  'burst count/cadence':a=>{a.pattern={kind:'burst',count:[5,3],cadence:[0.45,0.6]};},
  'gap':a=>{a.gap=[0,10];},
  'trigger':a=>{a.trigger='always';},
  'rain rule':a=>{delete a.rain;},
  'loop approval':a=>{a.approval.loop=true;},
  'gain range':a=>{a.sprite.gain=[0.7,0.35];},
  'single gain':a=>{a.sprite.gain=0.5;},
  'untaught content word':a=>{a.contains=['gongs'];},
  'untaught needsAny word':a=>{a.needsAny=['footfalls'];}
 };
 for(const [why,mutate] of Object.entries(breaks)){
  const bad=JSON.parse(JSON.stringify(input)),a=bad.assets.find(x=>x.role==='accent');mutate(a);
  assert.throws(()=>build(bad),Error,'builder accepted a broken accent set: '+why);
 }
 const mislabeled=JSON.parse(JSON.stringify(input));mislabeled.assets.find(x=>x.role==='accent').role='feature';
 assert.throws(()=>build(mislabeled),/only they/,'a sprite must be an accent');
 /* #481 E10 (audit 2026-09-29): a typo in an asset's place types or time window made it silently unmatchable — every asset,
    bed or accent, is checked against the ONE profile vocabulary (audio-profile.js), each refusal naming its field */
 const placement={
  'enclosure typo':[a=>{a.enclosures=['opne'];},/enclosures/],
  'no enclosures':[a=>{a.enclosures=[];},/enclosures/],
  'setting typo':[a=>{a.settings=['settlement','interor'];},/settings/],
  'biome typo':[a=>{a.biomes=['temprate'];},/biomes/],
  'from past the day':[a=>{a.from=1500;},/from\/to/],
  'to before the day':[a=>{a.to=-5;},/from\/to/],
  'a clock string':[a=>{a.from='06:00';},/from\/to/],
  'a fractional minute':[a=>{a.to=1080.5;},/from\/to/],
  'an empty window':[a=>{a.from=600;a.to=600;},/from\/to/],
  'defaultFor typo':[a=>{a.defaultFor='habitable_interior';},/defaultFor/]
 };
 for(const [why,[mutate,field]] of Object.entries(placement)){
  for(const pick of [x=>x.id==='village-day',x=>x.role==='accent']){
   const bad=JSON.parse(JSON.stringify(input)),a=bad.assets.find(pick);mutate(a);
   assert.throws(()=>build(bad),field,'builder accepted a broken placement on '+a.id+': '+why);
  }
 }
}

async function delivery(){
 const set=scope.AUDIO_CATALOG.assets.find(a=>a.role==='accent'),bytes=fs.readFileSync(set.sprite.url);
 assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),set.sha256,'the sprite on disk matches the catalog');
 scope.fetch=async()=>({ok:true,headers:{get:()=>String(bytes.length)},body:new ReadableStream({start(c){c.enqueue(new Uint8Array(bytes));c.close()}})});
 const good={numberOfChannels:1,duration:3.7787,length:181378};
 let loader=scope.createAudioLoader({decodeAudioData:(b,ok)=>ok(good)},scope.AUDIO_CATALOG);
 assert.equal(await loader.load(set,new AbortController().signal),good,'the loader decodes a sprite through its checksum');
 assert.equal(loader.inspect().decodedBytes,181378*4);
 loader=scope.createAudioLoader({decodeAudioData:(b,ok)=>ok({numberOfChannels:1,duration:1,length:48000})},scope.AUDIO_CATALOG);
 await assert.rejects(loader.load(set,new AbortController().signal),/cut-boundary/,'a decode shorter than the cut list is refused');
 assert.equal(loader.inspect().decodedBytes,0,'…and its reservation released');
 const map=new Map();let fetches=0;
 const cache={keys:async()=>[...map.keys()].map(url=>({url})),match:async r=>map.has(r.url||r)?new Response(new Uint8Array(map.get(r.url||r)),{headers:{'Content-Length':String(map.get(r.url||r).byteLength)}}):undefined,delete:async r=>map.delete(r.url||r),put:async(r,v)=>{map.set(r.url||r,new Uint8Array(await v.arrayBuffer()))}};
 const api=scope.createAudioCache({name:'fixture',catalog:scope.AUDIO_CATALOG,caches:{open:async()=>cache},fetch:async()=>{fetches++;return new Response(bytes)}});
 const req={url:'https://game.test/'+set.sprite.url,headers:new Headers()};
 await api.fetch(req);await api.fetch(req);assert.equal(fetches,1,'the service-worker audio cache serves a sprite offline after one fetch');
}

/* #481 E3 (audit 2026-09-29): an accent that finished loading while the layer was BLOCKED (ambience off, page hidden, mic open,
   narration paused, held) played anyway — footsteps about 20 s later, repeating; and a 1 s mic capture reset the 30 s spacing
   (plays 22 s apart). plan() returns early while blocked; the block aborts the in-flight load (an aborted set is not marked
   failed, so it reloads once unblocked); a blocked reset clears only the due times and keeps lastPlay. */
async function blockedRace(){
 const kinds=[['enabled',false],['hidden',true],['capturing',true],['paused',true],['held',true]];
 for(const [k,v] of kinds){
  let now=0;const timers=[],loads=[],plays=[],released=[];
  const driver={now:()=>now,later:(fn,ms)=>{const h={at:now+ms,fn};timers.push(h);return h;},cancel:h=>{h.cancelled=true;},abort:()=>new AbortController(),idle:()=>true,bedPending:()=>false,
   load:(set,signal)=>{const j={set,signal};j.p=new Promise((ok,no)=>{j.ok=ok;j.no=no;});loads.push(j);return j.p;},release:b=>released.push(b),rng:rng(7),error:()=>{},warn:()=>{},
   play:(buffer,set,steps,gain)=>{const pv={buffer,steps,gain};plays.push({at:now,...pv});return pv;},stop:()=>{}};
  function advance(ms){const end=now+ms;for(;;){const due=timers.filter(h=>!h.cancelled&&!h.fired&&h.at<=end).sort((a,b)=>a.at-b.at)[0];if(!due)break;now=due.at;due.fired=true;due.fn();}now=end;}
  const c=scope.createAccentController(driver,catalog(),scope.AUDIO_SCENES);
  const tavern={enabled:true,unlocked:true,visible:true,volume:0.8,campaignKind:'village',campaignId:'one',generation:1,nodeKey:'The Village|the tavern',common:'the tavern',open:true,minuteOfDay:1200};
  c.update(tavern);await flush();assert.equal(loads.length,1,k+': the load is in flight');
  c.update({...tavern,[k]:v});assert(loads[0].signal.aborted,k+': the block aborts the in-flight load');
  if(k==='enabled'||k==='paused'||k==='held')loads[0].no(Object.assign(new Error('The operation was aborted.'),{name:'AbortError'}));else loads[0].ok({id:'late-'+k});await flush();await flush();/* a real abort REJECTS; a load that raced it may still resolve */
  advance(15*60000);assert.equal(plays.length,0,k+': nothing plays while blocked (the audit: 4 plays in 15 minutes, the first at +42 s)');
  c.update(tavern);await flush();assert.equal(loads.length,2,k+': unblocked, the aborted set reloads (it was never marked failed)');
  loads[1].ok({id:'fresh-'+k});await flush();await flush();advance(10*60000);assert(plays.length>=1,k+': accents resume once unblocked');
 }
 /* the spacing rule survives a short capture */
 let now2=0;const timers2=[],loads2=[],plays2=[];
 const driver2={now:()=>now2,later:(fn,ms)=>{const h={at:now2+ms,fn};timers2.push(h);return h;},cancel:h=>{h.cancelled=true;},abort:()=>new AbortController(),idle:()=>true,bedPending:()=>false,
  load:(set,signal)=>{const j={set,signal};j.p=new Promise((ok,no)=>{j.ok=ok;j.no=no;});loads2.push(j);return j.p;},release:()=>{},rng:()=>0,/* the shortest gaps: the audit's 21 s case, deterministically */error:()=>{},warn:()=>{},
  play:(buffer,set,steps,gain)=>{plays2.push(now2);return {};},stop:()=>{}};
 const advance2=(ms)=>{const end=now2+ms;for(;;){const due=timers2.filter(h=>!h.cancelled&&!h.fired&&h.at<=end).sort((a,b)=>a.at-b.at)[0];if(!due)break;now2=due.at;due.fired=true;due.fn();}now2=end;}
 const c2=scope.createAccentController(driver2,catalog(),scope.AUDIO_SCENES);
 const tavern2={enabled:true,unlocked:true,visible:true,volume:0.8,campaignKind:'village',campaignId:'one',generation:1,nodeKey:'The Village|the tavern',common:'the tavern',open:true,minuteOfDay:1200};
 c2.update(tavern2);await flush();loads2[0].ok({id:'sp'});await flush();await flush();
 for(let i=0;i<120&&!plays2.length;i++)advance2(5000);assert(plays2.length===1,'fixture: one play');const first=plays2[0];
 c2.update({...tavern2,capturing:true});advance2(1000);c2.update(tavern2);
 advance2(10*60000);assert(plays2.length>=2,'a second play after the capture');
 assert(plays2[1]-first>=scope.ACCENT_SPACING_MS,'the 30 s spacing survives a 1 s capture: '+(plays2[1]-first)+' ms');
}

async function entryBell(){
 let now=0,blockedBed=false;const timers=[],loads=[],plays=[],stops=[],released=[],levels=[],errors=[];
 const d={now:()=>now,later:(fn,ms)=>{const h={at:now+ms,fn};timers.push(h);return h;},cancel:h=>h.cancelled=true,abort:()=>new AbortController(),idle:()=>true,bedPending:()=>blockedBed,rng:()=>0,
 load:(set,signal)=>new Promise((ok,no)=>loads.push({set,signal,ok,no})),release:b=>released.push(b),play:(b,set,steps,gain)=>{const v={set,steps,gain,done:false};plays.push(v);return v;},stop:(v,sec)=>{v.done=true;stops.push(sec);},gain:(v,n)=>levels.push(n),error:e=>errors.push(e.message),warn:e=>errors.push(e)};
 const inside={enabled:true,unlocked:true,visible:true,volume:0.45,campaignKind:'village',campaignId:'one',generation:1,nodeKey:"The Village|the alchemist's",common:"the alchemist's",open:true,minuteOfDay:835,classified:true,profile:{enclosure:'covered',setting:'interior',biome:'temperate',quiet:'normal',allows:['fire','machinery','voices'],forbid:['rain','thunder']}};
 const outside={...inside,nodeKey:'The Village',common:null,exterior:true,profile:null,classified:false};
 const c=scope.createAccentController(d,catalog(),scope.AUDIO_SCENES);
 function advance(ms){const end=now+ms;for(let i=0;i<10000;i++){const t=timers.filter(x=>!x.cancelled&&!x.fired&&x.at<=end).sort((a,b)=>a.at-b.at)[0];if(!t)break;now=t.at;t.fired=true;t.fn();}now=end;}
 async function enter(){c.update(outside,'turn');c.update(inside,'turn');await flush();return loads.at(-1);}
 c.update(outside,'load');const j=await enter();assert.equal(j.set.id,'alchemist-entry-bell','ENTRY loads the door cue before random glass');j.ok({id:'bell'});await flush();await flush();
 assert.equal(plays.length,1,'ENTRY plays once on entry');assert.equal(c.inspect().entryPlaying,'alchemist-entry-bell');assert.equal(plays[0].gain,0.65*0.45);
 c.update({...inside,speaking:true});assert.equal(stops.length,0,'ENTRY narration ducks rather than cuts the door bell');assert.equal(levels.at(-1),0.65*0.45*scope.AMBIENT_DUCK,'ENTRY bell gain ducks under narration');
 c.update({...inside,profile:{...inside.profile,forbid:['bells']}});assert.equal(c.inspect().entryPlaying,null,'ENTRY changing the profile to forbid bells cuts the current cue');
 c.update(inside,'save');c.update(inside,'turn');assert.equal(plays.length,1,'ENTRY saves and repeated commits never ring again');
 const late=await enter();c.update({...inside,capturing:true});assert(late.signal.aborted,'ENTRY mic aborts its load');late.ok({id:'cancelled'});await flush();c.update(inside);assert.equal(plays.length,1,'ENTRY mic release never replays');assert(released.some(x=>x.id==='cancelled'),'ENTRY late decoded buffer released');
 const slow=await enter();advance(scope.AUDIO_ENTRY_DEADLINE_MS+1);slow.ok({id:'slow'});await flush();assert.equal(plays.length,1,'ENTRY late download never rings');
 blockedBed=true;const count=loads.length;c.update(outside,'turn');c.update(inside,'turn');advance(scope.AUDIO_ENTRY_DEADLINE_MS+1000);blockedBed=false;advance(1000);await flush();assert(!loads.slice(count).some(x=>x.set.id==='alchemist-entry-bell'),'ENTRY no late cue after bed takes too long');
 const end=await enter();end.ok({id:'second-bell'});await flush();assert.equal(plays.length,2,'ENTRY a fresh visit rings again');c.update({...inside,enabled:false});assert.equal(stops.at(-1),0,'ENTRY mute cuts immediately');c.update(inside);assert.equal(plays.length,2,'ENTRY unmute never replays');c.dispose();assert.equal(c.inspect().buffers,0);assert.deepEqual(errors,[]);
 console.log('ENTRY controller checks passed');
}

(async()=>{
 await controller();await blockedRace();builder();await delivery();await entryBell();
 console.log('ACCENT LAYER GREEN: controller (bed first, narration, mic, leaving, memory), catalog refusals, sprite loader and cache');
})().catch(e=>{console.error(e);process.exitCode=1});
