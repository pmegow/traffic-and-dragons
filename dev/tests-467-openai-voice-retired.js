// tests-467-openai-voice-retired.js — #467 (owner ruling 2026-09-26; shared-name protection 2026-09-27).
// The OpenAI VOICE tier is retired; the OpenAI LANGUAGE MODEL is not. Two groups:
//   ① a device that still holds the retired voice keys — the legacy toggle tnd_tts_openai_v1 with its
//      narrator/direction siblings, or a Voice Settings save that named "openai" as primary — reads on the
//      local ladder: no request, no warning, no toast, a draft the Voice Settings modal can open and save,
//      and that save hands the OpenAI key (the GM's key) through untouched.
//   ② PROVIDERS.openai still exists and the Language Model modal still lists it.
// Isolated fixtures: no paid requests, no real audio. Wired into dev/run-standalone-suites.js; the
// retained proof is dev/sabotage-467-openai-voice-retired.js.
const assert=require('assert/strict'),fs=require('fs'),path=require('path'),engine=require('./load-engine.js');
engine.loadEngine();
const geval=eval;/* the two ui files are function declarations at top level — nothing touches the DOM at load */
['ui-shell.js','ui-modals.js'].forEach(f=>geval(fs.readFileSync(path.join(engine.ROOT,f),'utf8')));

const S=TTS.settings,spoken=[],toasts=[],warned=[],requests=[];
global.document={getElementById:()=>null,addEventListener(){},removeEventListener(){}};
global.window={speechSynthesis:{speak(u){spoken.push(u.text);},cancel(){},resume(){},pause(){},getVoices(){return [];}}};
global.speechSynthesis=window.speechSynthesis;global.SpeechSynthesisUtterance=function(text){this.text=text;};
global.fetch=url=>{requests.push(String(url));return new Promise(()=>{});};
global.showToast=m=>toasts.push(String(m));
const realWarn=console.warn;console.warn=function(){warned.push(Array.prototype.join.call(arguments,' '));};

let passed=0;
function test(name,fn){try{fn();passed++;console.log('PASS '+name);}catch(e){console.error('FAIL '+name+' — '+e.message);process.exitCode=1;}finally{TTS.stop();}}

// The three keys the retired tier wrote, spelled out here because tts.js no longer names them.
const RETIRED={on:'tnd_tts_openai_v1',narr:'tnd_tts_openai_narr_v1',dir:'tnd_tts_openai_dir_v1'};
const LLM_KEY='fixture-gm-key';

test('#467 stale OpenAI voice keys fall through to the local ladder cleanly',()=>{
 providerKeys.openai=LLM_KEY;/* the key the retired tier read — it belongs to the GM now, and only to the GM */
 store.set(RETIRED.on,'1');store.set(RETIRED.narr,'cedar');store.set(RETIRED.dir,'Read quietly.');
 store.del(TTS._gemini.keys.on);
 const variants={
  'the legacy toggle alone':()=>store.del(S._keys.settings),
  'a Voice Settings save naming openai as primary':()=>store.set(S._keys.settings,JSON.stringify({primary:'openai',models:{openai:{narrator:'cedar',direction:'Read quietly.',rate:1.2,cast:{},voices:[]}}}))
 };
 Object.keys(variants).forEach(v=>{
  variants[v]();warned.length=0;toasts.length=0;requests.length=0;spoken.length=0;
  assert.ok(['server','piper'].includes(TTS.getEngine()),v+': the engine resolved to "'+TTS.getEngine()+'", not a local rung');
  const d=S.draft();
  assert.equal(d.primary,'local',v+': stale saved primary escaped into the Voice Settings draft');
  assert.equal(S._validate(d),'',v+': the fallen-through draft cannot be saved as it opens');
  assert.ok(!Object.prototype.hasOwnProperty.call(S.models,'openai')&&!Object.prototype.hasOwnProperty.call(d.models,'openai'),v+': an openai voice model is still offered');
  assert.ok(TTS._gemini.ladder().indexOf('openai')<0,v+': the ladder still has an openai rung');
  // A read in flight holds the queue, so the next speak() is observable before it drains.
  const native=S.draft();native.primary='native';S.test(native,'Hold the lantern.');
  TTS.speak('The road bends east.');
  const q=TTS._speakerTest.queued();
  assert.equal(q.length,1,v+': speak() queued '+q.length+' items');
  assert.equal(q[0].piper,true,v+': speak() queued a non-local item: '+JSON.stringify(q[0]));
  assert.deepEqual(requests,[],v+': a request left the device');
  assert.deepEqual(warned,[],v+': the fall-through warned');
  assert.deepEqual(toasts,[],v+': the fall-through toasted');
  TTS.stop();
 });
 // Saving what the modal opened on keeps the GM's OpenAI key and drops the stale model entry.
 const gm=activeProvider;S.save(S.draft());
 assert.equal(providerKeys.openai,LLM_KEY,'the voice save changed the OpenAI language-model key');
 assert.equal(activeProvider,gm,'the voice save changed the GM provider');
 const saved=JSON.parse(store.get(S._keys.settings));
 assert.equal(saved.primary,'local');assert.ok(!saved.models.openai,'the stale openai model entry survived a save');
 [RETIRED.on,RETIRED.narr,RETIRED.dir,S._keys.settings,S._keys.credentials].forEach(k=>store.del(k));
});

test('#467 the OpenAI language model survives the voice-tier cut',()=>{
 const p=PROVIDERS.openai;
 assert.ok(p,'PROVIDERS.openai is gone');
 assert.equal(p.id,'openai');assert.equal(p.label,'ChatGPT (OpenAI)');assert.equal(p.keyHint,'sk-...');
 assert.equal(p.endpoint,'https://api.openai.com/v1/chat/completions');
 assert.equal(typeof p.buildBody,'function','the provider lost its request builder');
 // Render the real Language Model modal up to its shell and read what it would show.
 const realShell=modalShell,realClose=closeAllMenus;let html=null;
 global.closeAllMenus=function(){};
 global.modalShell=function(id,inner){html=inner;throw new Error('__captured__');};
 try{showProviderModal();}catch(e){if(e.message!=='__captured__')throw e;}
 finally{global.modalShell=realShell;global.closeAllMenus=realClose;}
 assert.ok(html,'the Language Model modal never reached its shell');
 assert.match(html,/<div class='pv-row' data-id='openai'[^>]*>(?:(?!<div class='pv-row').)*ChatGPT \(OpenAI\)/,'the Language Model modal no longer lists ChatGPT (OpenAI)');
});

console.warn=realWarn;
console.log((process.exitCode?'FAILED':'ALL GREEN')+' — '+passed+' #467 groups');
