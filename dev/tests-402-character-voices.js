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
   char.gender='';assert.deepEqual(visible(csPrimaryVoiceOptions(char,primary)),[]);assert.deepEqual(visible(csBackupVoiceOptions(char)),[]);
   store.set(key,JSON.stringify([{id:'en_US-ryan-high',label:'Owner-assigned actor',g:'F'}]));char.gender='F';assert(visible(csBackupVoiceOptions(char)).includes('en_US-ryan-high'));char.gender='M';assert(!visible(csBackupVoiceOptions(char)).includes('en_US-ryan-high'));

  }finally{if(old===null)store.del(key);else store.set(key,old);}
 });
 console.log((process.exitCode?'FAILED':'ALL GREEN')+' — '+passed+' character-voice integration groups');
})().catch(e=>{console.error(e);process.exitCode=1});
