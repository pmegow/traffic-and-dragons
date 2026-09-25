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

const S=TTS.settings;
function draft(id){const d=S.draft();d.primary=id;d.keys[id]='fixture';d.models[id].voices=[{id:'a',label:'Actor A',g:'F',note:'Warm'},{id:'b',label:'Actor B',g:'M',note:'Deep'},{id:'c',label:'Actor C',g:'F',note:'Clear'}];d.models[id].narrator='a';return d;}

(async()=>{
 await test('#402 actual Speechify requests honor sheet actors independently of shared backups and cast overrides',async()=>{
  const d=draft('speechify');d.models.speechify.cast.a='b';S.save(d);
  let bodies=[];global.fetch=async(u,o)=>{bodies.push(JSON.parse(o.body));return pcm()};
  TTS.speak('First line. Second line.',null,{0:'en_GB-alba-medium',1:'en_GB-alba-medium',providers:{speechify:{0:'a',1:'c'}}});await sleep(30);
  assert.deepEqual(bodies.map(b=>b.voice_id),['a','c']);assert.equal(sources.length,2);
 });
 await test('#402 real later cloud failure queues only unread text with each full backup id',async()=>{
  const d=draft('speechify');S.save(d);let n=0;global.fetch=async()=>++n===1?pcm():{ok:false,status:429};
  const map={0:'en_US-libritts_r-medium#3',1:'en_US-libritts_r-medium#8',2:'en_US-libritts_r-medium#9',providers:{speechify:{0:'a',1:'b',2:'c'}}};
  TTS.speak('First line. Second line. Third line.',null,map);await sleep(30);
  const q=TTS._speakerTest.queued();assert.equal(q.length,1);assert.equal(q[0].piper,true);assert.equal(q[0].text,'Second line. Third line.');assert.deepEqual(q[0].voices,{0:map[1],1:map[2]});assert.equal(sources.length,1);
 });
 await test('#402 NPC sheet generation inherits both pins and ignores model-authored voice settings',async()=>{
  require('vm').runInThisContext(require('fs').readFileSync(require('path').join(__dirname,'../ui-sheets.js'),'utf8'));
  const d=draft('speechify');S.save(d);global.showLoadingModal=()=>()=>{};global.saveAll=()=>{};global.relationshipMigrateSheet=()=>{};global.busy=false;
  worldState={character:{name:'Hero'},npcs:[{name:'Lysa',pronouns:'she/her',speechifyVoiceId:'c',voiceId:'en_GB-alba-medium'}]};memory={npcs:{}};
  global.callGM=async()=>JSON.stringify({gender:'F',stats:{},speechifyVoiceId:'model-invented',voiceId:'model-invented'});
  await generateNpcSheet('Lysa');const npc=worldState.npcs[0];assert.equal(npc.charSheet.speechifyVoiceId,'c');assert.equal(npc.charSheet.voiceId,'en_GB-alba-medium');assert.equal(npc.speechifyVoiceId,undefined);assert.equal(npc.voiceId,undefined);
  npc.charSheet.speechifyVoiceId='a';await generateNpcSheet('Lysa');assert.equal(npc.charSheet.speechifyVoiceId,'a');assert.equal(npc.charSheet.voiceId,'en_GB-alba-medium');
  worldState.npcs.push({name:'Bera',pronouns:'she/her'});await generateNpcSheet('Bera');assert(['a','c'].includes(worldState.npcs[1].charSheet.speechifyVoiceId));assert(TTS.voiceKnown(worldState.npcs[1].charSheet.voiceId));
 });

 await test('#402 campaign creation assigns player and companion voices before saving and preserves imported pins',async()=>{
  const d=draft('speechify');S.save(d);engine.makeTestWorld();const hero=JSON.parse(JSON.stringify(worldState.character));const comp=Object.assign({},hero,{name:'Bram',gender:'M'});
  let snapshots=[];const names=['saveAll','showGame','syncUI','initAbilities','initSpells','takeCheckpoint','addMsg','initCampaignFolderForGame','generateSkeleton','beginAdventure','guestbookSeedStart','npcLinkUpsert','relationshipMigrateWorld'];
  const old={};names.forEach(k=>{old[k]=global[k];global[k]=()=>{}});
  global.saveAll=()=>snapshots.push(JSON.parse(JSON.stringify(worldState)));global.addMsg=()=>({remove(){}});global.generateSkeleton=async()=>{};
  try{
   pendingBlueprint=null;pendingCompanions=[comp];startGame(hero,'Fantasy','','');await sleep(10);
   assert(['a','c'].includes(hero.speechifyVoiceId));assert.equal(comp.speechifyVoiceId,'b');assert(TTS.voiceKnown(hero.voiceId));assert(TTS.voiceKnown(comp.voiceId));
   assert.equal(snapshots[0].character.speechifyVoiceId,hero.speechifyVoiceId);assert.equal(snapshots[0].npcs[0].charSheet.speechifyVoiceId,'b');
   const saved=JSON.stringify([hero.voiceId,hero.speechifyVoiceId]);pendingCompanions=[];startGame(hero,'Fantasy','','');await sleep(10);assert.equal(JSON.stringify([hero.voiceId,hero.speechifyVoiceId]),saved);
  }finally{names.forEach(k=>{global[k]=old[k]});busy=false;}
 });

 await test('#402 sheet renderers filter both actor lists without changing saved pins',async()=>{
  const d=draft('speechify');S.save(d);const key='tnd_speaker_stars_v1',old=store.get(key);
  try{
   store.set(key,JSON.stringify([{id:'en_US-libritts_r-medium#9',label:'Female',g:'F'},{id:'en_US-libritts_r-medium#3',label:'Male',g:'M'}]));
   const visible=html=>Array.from(html.matchAll(/<option\b([^>]*)>/g)).filter(m=>!(/\b(disabled|hidden)\b/.test(m[1]))).map(m=>(m[1].match(/value='([^']*)'/)||[])[1]).filter(Boolean);
   const primary=TTS.characterVoiceSlots()[0],char={gender:'F',speechifyVoiceId:'b',voiceId:'en_US-libritts_r-medium#3'},saved=JSON.stringify(char);
   assert.deepEqual(visible(csPrimaryVoiceOptions(char,primary)),['a','c']);const backup=visible(csBackupVoiceOptions(char));assert(backup.includes('en_US-libritts_r-medium#9'));assert(backup.includes('en_GB-alba-medium'));assert(!backup.includes('en_US-libritts_r-medium#3'));assert(!backup.includes('en_US-ryan-high'));
   assert(csPrimaryVoiceOptions(char,primary).includes("value='b' selected disabled hidden"));assert(csBackupVoiceOptions(char).includes("value='en_US-libritts_r-medium#3' selected disabled hidden"));assert.equal(JSON.stringify(char),saved);
   char.gender='NB';assert.deepEqual(visible(csPrimaryVoiceOptions(char,primary)),['a','b','c']);assert(visible(csBackupVoiceOptions(char)).includes('en_US-libritts_r-medium#3'));
   char.gender='M';assert.deepEqual(visible(csPrimaryVoiceOptions(char,primary)),['b']);assert(!visible(csBackupVoiceOptions(char)).includes('en_GB-alba-medium'));
   /* Fable review 2026-09-11 (Brief C): unknown gender sees the FULL bank, like NB — re-baselined from [] (an empty picker beside an unfiltered auto-cast was a silent failure). */
   char.gender='';assert.deepEqual(visible(csPrimaryVoiceOptions(char,primary)),['a','b','c']);assert(visible(csBackupVoiceOptions(char)).includes('en_US-libritts_r-medium#3'));
   /* Brief C: the backup list names its empty state like the primary does. */
   {const realVoices=TTS.voices,realStars=TTS.starsList,realStarOpts=TTS.starOptionsHtml;try{TTS.voices=()=>[{id:'en_GB-alba-medium',label:'Alba',g:'F'}];TTS.starsList=()=>[];TTS.starOptionsHtml=()=>'';char.gender='M';const html=csBackupVoiceOptions(char);assert.deepEqual(visible(html),[]);assert(html.includes('No matching actors'),'backup empty state is unlabelled: '+html);}finally{TTS.voices=realVoices;TTS.starsList=realStars;TTS.starOptionsHtml=realStarOpts;}}
   store.set(key,JSON.stringify([{id:'en_US-ryan-high',label:'Owner-assigned actor',g:'F'}]));char.gender='F';assert(visible(csBackupVoiceOptions(char)).includes('en_US-ryan-high'));char.gender='M';assert(!visible(csBackupVoiceOptions(char)).includes('en_US-ryan-high'));

  }finally{if(old===null)store.del(key);else store.set(key,old);}
 });
 /* Fable review 2026-09-11 (Brief F): the `!cloud.audition` guard on the remainder hand-off shipped unpinned — deleting it
    passed the whole tree. A failed AUDITION must fail visibly and never hand a fallback item to the read queue. */
 await test('#402 a failed cloud audition never hands a fallback item to the read queue',async()=>{
  /* Two groups: the first sentence overflows the 220-char fast-start cap, so it lands and is scheduled (its stub source
     never ends, which keeps the queue observable), and the SECOND group fails — the exact branch the guard sits on. */
  const d=draft('speechify');S.save(d);let n=0;global.fetch=async()=>++n===1?pcm():{ok:false,status:503,json:async()=>{throw Error('no body')}};
  const opener='The lamps gutter along the quay while the tide drags at the pilings and the harbour bell tolls the hour for nobody in particular, and still the ferryman waits with his hand out and his eyes on the fog that will not lift tonight.';
  assert(opener.length>220,'fixture: the opener must overflow the fast-start cap');
  S.test(d,opener+' Then it fails.','a',()=>{});await sleep(60);
  assert.equal(n,2,'fixture: the second group was never requested');
  assert.equal(TTS._speakerTest.queued().length,0,'audition failure queued a fallback read: '+JSON.stringify(TTS._speakerTest.queued()));
 });
 /* Brief F coverage gap: Stop empties the queued-but-unsent items, not only the in-flight group. */
 await test('#402 Stop drops queued-but-unsent items',async()=>{
  const d=draft('speechify');S.save(d);global.fetch=()=>new Promise(()=>{});
  TTS.speak('First line. Second line.',null,{0:'en_US-libritts_r-medium#3',1:'en_US-libritts_r-medium#8'});TTS.speak('A second passage waits.');await sleep(20);
  assert(TTS._speakerTest.queued().length>=1,'fixture: nothing was queued behind the in-flight read');
  TTS.stop();assert.equal(TTS._speakerTest.queued().length,0,'Stop left items in the queue');
 });
 /* #405 (Fable review 2026-09-11, Briefs C/F residues): behaviours the handoff named that no node battery exercised. */
 await test('#405 a catalog that arrives AFTER automatic casting: an empty Speechify catalog leaves the primary unset (the backup fills from the shipped bench); once actors load, a second assignment fills the still-empty primary on the SAME sheet and never touches a pin already set',async()=>{
  const d=draft('speechify');d.models.speechify.voices=[];d.primary='native';S.save(d);/* actors not loaded yet — the save rule needs a narrator only for the PRIMARY */
  const c={name:'Rhea',gender:'F'};var backup;
  store.set('tnd_speaker_stars_v1','[]');/* a written-but-EMPTY star bench: the backup slot must fall back to the shipped bench */
  try{
   assert.equal(TTS.starsList().length,0,'fixture: the star bench must read empty');
   TTS.assignCharacterVoices(c,()=>0);
   assert.equal(c.speechifyVoiceId,undefined,'an empty catalog must not invent a primary actor');
   assert(c.voiceId&&TTS.voiceKnown(c.voiceId),'with no stars the backup slot must fill from the shipped bench: '+c.voiceId);
   backup=c.voiceId;
  }finally{store.del('tnd_speaker_stars_v1');}
  S.save(draft('speechify'));
  assert.equal(TTS.assignCharacterVoices(c,()=>0),true,'a populated catalog must fill the empty primary on the same sheet');
  assert.equal(c.speechifyVoiceId,'a','gender-matched first actor (random()=0 → Actor A, F)');
  assert.equal(c.voiceId,backup,'the backup pin already set was reassigned');
  c.speechifyVoiceId='c';assert.equal(TTS.assignCharacterVoices(c,()=>0),false,'nothing left to assign');assert.equal(c.speechifyVoiceId,'c','a set pin is never overwritten');
 });
 await test('#405 an out-of-list pin survives a sheet reopen: both renderers keep the saved id selected through the hidden "Saved voice (not listed)" option, render identically twice, and never touch the sheet',async()=>{
  require('vm').runInThisContext(require('fs').readFileSync(require('path').join(__dirname,'../ui-sheets.js'),'utf8'));
  if(typeof global.escHtml!=='function')global.escHtml=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/'/g,'&#39;');
  S.save(draft('speechify'));
  const c={name:'Rhea',gender:'F',speechifyVoiceId:'retired-actor',voiceId:'en_XX-nowhere-medium#9'};
  const slot=TTS.characterVoiceSlots()[0];
  const p1=csPrimaryVoiceOptions(c,slot),p2=csPrimaryVoiceOptions(c,slot);
  assert.equal(p1,p2,'the primary renderer is not idempotent');
  assert.match(p1,/value='retired-actor' selected disabled hidden>Saved voice \(not listed\)/,'the out-of-list primary pin lost its selection: '+p1);
  assert.doesNotMatch(p1,/value='a' selected/,'a listed actor must not steal the selection');
  const b1=csBackupVoiceOptions(c),b2=csBackupVoiceOptions(c);
  assert.equal(b1,b2,'the backup renderer is not idempotent');
  assert.match(b1,/value='en_XX-nowhere-medium#9' selected disabled hidden>Saved voice \(not listed\)/,'the out-of-list backup pin lost its selection: '+b1);
  assert.equal(c.speechifyVoiceId,'retired-actor');assert.equal(c.voiceId,'en_XX-nowhere-medium#9');
 });
 await test('#455 automatic casting draws a Speechify actor from the curated bench when the loaded catalog holds a gender match there — never from the long tail — and falls back to the whole catalog only when the bench has no match (owner 2026-09-24: auto-cast handed Daeris a bored audiobook reader)',async function(){
  var d=draft('speechify');d.models.speechify.voices=[{id:'slow_f',label:'Slow F',g:'F',note:'Audiobook'},{id:'imogen_32',label:'Imogen',g:'F',note:''},{id:'slow_m',label:'Slow M',g:'M',note:'Audiobook'},{id:'geffen_32',label:'Geffen',g:'M',note:''}];d.models.speechify.narrator='imogen_32';S.save(d);
  var draws=[0,0.3,0.6,0.99],i;for(i=0;i<draws.length;i++){var c={name:'Daeris',gender:'F'};TTS.assignCharacterVoices(c,function(){return draws[i];},'speechify');assert.equal(c.speechifyVoiceId,'imogen_32','random()='+draws[i]+' must land on the bench, got '+c.speechifyVoiceId);}
  var m={name:'Halvard',gender:'M'};TTS.assignCharacterVoices(m,function(){return 0.99;},'speechify');assert.equal(m.speechifyVoiceId,'geffen_32','a male character must land on the male bench voice');
  d.models.speechify.voices=[{id:'slow_f',label:'Slow F',g:'F',note:''},{id:'geffen_32',label:'Geffen',g:'M',note:''}];d.models.speechify.narrator='geffen_32';S.save(d);
  var f={name:'Nyla',gender:'F'};TTS.assignCharacterVoices(f,function(){return 0;},'speechify');assert.equal(f.speechifyVoiceId,'slow_f','with no bench voice of her gender the whole catalog is the pool');
 });
 await test('#456 Inworld reads honour per-unit sheet pins and per-character delivery directions: each unit goes to its pinned voice, a directed unit carries its own instruction, an undirected one the model direction',async function(){
  var d=draft('inworld');d.models.inworld.direction='Speak naturally.';d.models.inworld.voices=[{id:'a',label:'A',g:'F'},{id:'b',label:'B',g:'M'},{id:'c',label:'C',g:'F'}];d.models.inworld.narrator='a';S.save(d);
  var bodies=[];global.fetch=async function(u,o){bodies.push(JSON.parse(o.body));return {ok:true,json:async function(){return {audioContent:Buffer.from([0,0,255,127]).toString('base64')};}};};
  TTS.speak('First line. Second line.',null,{0:'en_GB-alba-medium',1:'en_GB-alba-medium',providers:{inworld:{0:'b',1:'c'}},directions:{1:'gruff and unhurried'}});await sleep(40);
  assert.deepEqual(bodies.map(function(b){return b.voiceId;}),['b','c']);
  assert.deepEqual(bodies.map(function(b){return b.instruction;}),['Speak naturally.','gruff and unhurried']);
 });
 await test('#456 automatic casting fills the Inworld slot from the loaded Inworld catalog, gender matched, without touching the other slots',async function(){
  var d=draft('inworld');d.models.inworld.voices=[{id:'iw_f',label:'F',g:'F'},{id:'iw_m',label:'M',g:'M'}];d.models.inworld.narrator='iw_f';S.save(d);
  var c={name:'Nyla',gender:'F',speechifyVoiceId:'keep'};assert.equal(TTS.assignCharacterVoices(c,function(){return 0;},'inworld'),true);
  assert.equal(c.inworldVoiceId,'iw_f');assert.equal(c.speechifyVoiceId,'keep');assert.equal(c.voiceId,undefined,'the provider filter must leave the Piper slot alone');
 });
 await test('#457 a character\'s speed scales that character\'s groups on a real Inworld read (speakingRate) while the narrator keeps the provider rate; every provider defaults to 1.1× until saved',async function(){
  assert.equal(TTS.settings.draft().models.inworld.rate,1.1,'the unsaved Inworld rate must default to 1.1×');
  /* the Speechify builder's scaling is pinned string-for-string in the engine test; an earlier group in this file leaves Speechify degraded, so the live read here is Inworld's */
  var e=draft('inworld');e.models.inworld.rate=1;S.save(e);var bodies=[];
  global.fetch=async function(u,o){bodies.push(JSON.parse(o.body));return {ok:true,json:async function(){return {audioContent:Buffer.from([0,0,255,127]).toString('base64')};}};};
  TTS.speak('First line. Second line.',null,{0:'en_GB-alba-medium',1:'en_GB-alba-medium',providers:{inworld:{0:'a',1:'c'}},rates:{1:1.2}});await sleep(40);
  assert.deepEqual(bodies.map(function(b){return b.audioConfig.speakingRate;}),[1,1.2]);
 });
 console.log((process.exitCode?'FAILED':'ALL GREEN')+' — '+passed+' character-voice integration groups');
})().catch(e=>{console.error(e);process.exitCode=1});
