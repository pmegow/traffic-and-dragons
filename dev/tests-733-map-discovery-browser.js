'use strict';
// Real story/opening entry points; only transport and unrelated background calls are stubbed.
const fs=require('fs'),path=require('path'),os=require('os'),assert=require('assert/strict');
const {chromium}=require('./cdp-browser.js');
const root=path.resolve(__dirname,'..'),shots=process.env.TND_SHOT_DIR||fs.mkdtempSync(path.join(os.tmpdir(),'tnd-733-discovery-'));
const filterAt=process.argv.indexOf('--only'),filter=filterAt<0?null:process.argv[filterAt+1];
const raw='Three birch stakes mark the split.';
function fixture(){
 const e=require('./load-engine.js');e.loadEngine();e.makeTestWorld();
 worldState.campId='discovery-browser-fixture';worldState.campName='Discovery browser';worldState.ver=SAVE_VER;
 worldState.world.location='The Clearing';worldState.world.sublocation=null;worldState.turn=7;
 worldState.transcript=[{r:'gm',t:7,l:'The Clearing',x:'HISTORY_ONLY The guide greets you.'}];
 worldState.blueprintPrivate='BLUEPRINT_ONLY Stalgind owns a hidden hut.';
 memory.campId=worldState.campId;memory.summary='MEMORY_ONLY a hidden pass';
 memory.map.nodes['The Clearing']=newMapNode(0,null,{visits:1,description:'NODE_ONLY secret cellar'});
 sessionLog=[{role:'user',content:'Say hello.'},{role:'assistant',content:'HISTORY_ONLY The guide greets you.'}];
 return JSON.parse(JSON.stringify({worldState,memory,sessionLog}));
}
let pass=0,fail=0;
(async()=>{
 fs.mkdirSync(shots,{recursive:true});const fx=fixture();
 {
  async function fresh(){
   const browser=await chromium.launch({headless:true}),ctx=await browser.newContext({viewport:{width:1280,height:900},serviceWorkers:'block'}),foreign=[];
   await ctx.route('**/*',r=>{const u=new URL(r.request().url());if(u.hostname!=='discovery733.test'){foreign.push(u.pathname);return r.abort();}const p=path.resolve(root,'.'+decodeURIComponent(u.pathname));if(!p.startsWith(root+path.sep))return r.abort();try{return r.fulfill({status:200,contentType:({'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.ttf':'font/ttf'})[path.extname(p)]||'application/octet-stream',body:fs.readFileSync(p)});}catch(e){return r.fulfill({status:404,body:''});}});
   await ctx.addInitScript(()=>{localStorage.setItem('tnd_ambient_enabled_v1','0');localStorage.setItem('tnd_folder_declined_v1','1');});
   const page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.goto('http://discovery733.test/index.html');await page.waitForFunction(()=>typeof sendAction==='function'&&typeof atlasPublicEnable==='function');
   await page.evaluate(f=>{
    worldState=f.worldState;memory=f.memory;sessionLog=f.sessionLog;busy=false;activeChatTab='story';
    document.getElementById('api-screen').style.display='none';
    generateActions=function(){};speakNarration=function(){};processPendingCompanionSheets=function(){};maybeRefreshSynopsis=function(){};showFirstTurnOverlay=function(){};_promptCampaignFolder=function(){};
    if(typeof TTS==='object'){TTS.prewarmServer=function(){};TTS.recoverAudio=function(){};}
    window.__notices=[];const toast=showToast;showToast=function(m){__notices.push(String(m));return toast.apply(this,arguments);};
    window.__calls=[];window.__response='Three birch stakes mark the split.';window.__extractMode='valid';
    window.__storageSnapshot=function(){return JSON.stringify(Object.keys(localStorage).sort().map(k=>[k,localStorage.getItem(k)]));};
    window.__replaceCampaign=function(identical){worldState=JSON.parse(JSON.stringify(worldState));memory=JSON.parse(JSON.stringify(memory));sessionLog=JSON.parse(JSON.stringify(sessionLog));if(!identical){sessionLog=[];worldState.campId='replacement-campaign';worldState.campName='Replacement';worldState.turn=99;memory.campId=worldState.campId;}window.__replacementBefore=JSON.stringify({worldState,memory,sessionLog});window.__replacementStorage=__storageSnapshot();};
    callGM=async function(msg,sys,max,model,opts){
     __calls.push({msg,sys,max,model,opts:opts?JSON.parse(JSON.stringify(opts)):null});
     if(opts&&opts.kind==='atlas'&&opts.noHistory){
      if(__extractMode==='error')throw Error('injected discovery timeout');
      if(__extractMode==='malformed')return '{"discoveries":[';
      if(__extractMode==='cut')opts.finish={cut:true,cap:true,reason:'MAX_TOKENS'};
      const payload=JSON.parse(msg),segment=payload.segments.find(s=>s.text.includes('Three birch stakes mark the split.'));
      const answer=JSON.stringify({discoveries:segment?[{source:segment.id,label:'birch stakes',quote:'Three birch stakes mark the split.',mode:'observed',bearing:'unknown',bearingQuote:''}]:[],overflow:false});
      if(__extractMode==='stale'||__extractMode==='identical')__replaceCampaign(__extractMode==='identical');
      return answer;
     }
     if(__extractMode==='first-stale')__replaceCampaign(false);
     return __response;
    };
    showGame();if(typeof initReplaySession==='function')initReplaySession();atlasCreate('discovery-browser');const enabled=atlasPublicEnable();if(!enabled.ok)throw Error(enabled.reason);atlasFollow();syncUI();showAtlas();
   },fx);
   return {browser,ctx,page,foreign,errors};
  }
  async function test(name,fn){
   if(filter&&filter!==name)return;
   let b;try{b=await fresh();await fn(b.page);assert.deepEqual(b.errors,[],'unexpected page exception');assert(!b.foreign.some(x=>/\/api\/(llm|tts|render)/.test(x)),'no paid endpoint may be attempted');pass++;console.log('PASS #733 discovery browser '+name);}catch(e){fail++;console.error('FAIL #733 discovery browser '+name+' — '+e.stack);if(b)await b.page.screenshot({path:path.join(shots,'failure-'+name.replace(/[^a-z0-9]+/gi,'-')+'.png')});}finally{if(b)await b.browser.close();}
  }
  await test('normal stationary action extracts a quoted landmark and saves one story turn',async page=>{
   const r=await page.evaluate(async()=>{
    const before=JSON.stringify(worldState.world),turn=worldState.turn,n=worldState.transcript.length,sl=sessionLog.length;
    await sendAction('Study the split without moving.');
    const saved={geo:JSON.stringify(memory.map.geography),transcript:JSON.stringify(worldState.transcript),session:JSON.stringify(sessionLog)};
    const out={before,after:JSON.stringify(worldState.world),turn,now:worldState.turn,added:worldState.transcript.slice(n),sessionAdded:sessionLog.length-sl,calls:__calls,features:atlasKnowledgeProjection().features,shown:_atlasPane.view.doc().features.map(f=>f.name),geo:memory.map.geography};
    if(!loadState())throw Error('saved story did not reload');out.reloaded={geo:JSON.stringify(memory.map.geography),transcript:JSON.stringify(worldState.transcript),session:JSON.stringify(sessionLog)};out.saved=saved;return out;
   });
   assert.equal(r.after,r.before);assert.equal(r.now,r.turn+1);assert.equal(r.calls.length,2);assert.equal(r.calls[1].opts.noHistory,true);assert.equal(r.calls[1].opts.noRetry,true);assert.equal(r.calls[1].opts.kind,'atlas');
   assert.equal(r.added.filter(x=>x.r==='gm').length,1);assert.equal(r.added.find(x=>x.r==='gm').x,raw);assert.equal(r.added.filter(x=>x.r==='player').length,1);assert.equal(r.sessionAdded,2);
   assert.deepEqual(r.features.map(f=>f.label),['birch stakes']);assert.deepEqual(r.shown,['birch stakes']);assert.equal(Object.values(r.geo.receipts)[0].events[0].quote,raw);assert.deepEqual(r.reloaded,r.saved);
   await page.screenshot({path:path.join(shots,'discovery-stationary.png')});
  });
  await test('opening uses the same extraction seam without advancing the starting turn',async page=>{
   const r=await page.evaluate(async()=>{worldState.turn=0;worldState.transcript=[];sessionLog=[];await beginAdventure();return {turn:worldState.turn,transcript:worldState.transcript,session:sessionLog,calls:__calls,features:atlasKnowledgeProjection().features};});
   assert.equal(r.calls.length,2);assert.equal(r.turn,0);assert.equal(r.transcript.filter(x=>x.r==='gm').length,1);assert.equal(r.transcript[0].x,raw);assert.equal(r.session.length,2);assert.deepEqual(r.features.map(f=>f.label),['birch stakes']);
  });
  for(const mode of ['error','malformed','cut'])await test(mode+' extraction preserves original narration and explicit declarations',async page=>{
   const r=await page.evaluate(async mode=>{__extractMode=mode;__response+='\n[MAP_REVEAL:new|Stone arch|S|observed]';const turn=worldState.turn;await sendAction('Inspect the arch.');return {turn,now:worldState.turn,calls:__calls,notices:__notices,text:worldState.transcript.at(-1).x,features:atlasKnowledgeProjection().features};},mode);
   assert.equal(r.calls.length,2);assert.equal(r.now,r.turn+1);assert(r.text.includes(raw));assert(r.text.includes('You see Stone arch'));assert.deepEqual(r.features.map(f=>f.label),['Stone arch']);assert(r.notices.some(x=>/landmarks could not be checked/i.test(x)),'failure must name its discovery cause');
  });
  await test('help reroll and sheet sync never launch geographic extraction',async page=>{
   const r=await page.evaluate(async()=>{activeChatTab='tabletalk';await sendAction('Explain the map.');activeChatTab='story';await rerollLast();__response='[MAP_REVEAL:new|Sync hut|unknown|observed]';await syncCharSheet();return {calls:__calls,features:atlasKnowledgeProjection().features};});
   assert.equal(r.calls.length,3);assert.equal(r.calls[0].opts.kind,'tabletalk');assert.equal(r.calls[2].opts.kind,'sync');assert(!r.calls.some(c=>c.opts&&c.opts.kind==='atlas'));assert.deepEqual(r.features,[]);
  });
  await test('replacement campaign survives an obsolete extraction with no catch-side writes',async page=>{
   const r=await page.evaluate(async()=>{__extractMode='stale';await sendAction('Study the split.');return {before:__replacementBefore,after:JSON.stringify({worldState,memory,sessionLog}),storageBefore:__replacementStorage,storageAfter:__storageSnapshot(),notices:__notices,text:document.getElementById('story-narrative').textContent,calls:__calls};});
   assert.equal(r.calls.length,2);assert(r.before,'fixture must replace the campaign while extraction awaits');assert.equal(r.after,r.before);assert.equal(r.storageAfter,r.storageBefore);assert(/obsolete|campaign.*changed|changed.*campaign/i.test(r.notices.join(' ')+r.text),'stale turn refusal must be visible');
  });
  for(const mode of ['first-stale','identical'])await test((mode==='first-stale'?'campaign switch during the first GM call':'identical-valued world replacement during extraction')+' aborts obsolete narration',async page=>{
   const r=await page.evaluate(async mode=>{__extractMode=mode;await sendAction('Study the split.');return {before:__replacementBefore,after:JSON.stringify({worldState,memory,sessionLog}),storageBefore:__replacementStorage,storageAfter:__storageSnapshot(),notices:__notices,text:document.getElementById('story-narrative').textContent,calls:__calls};},mode);
   assert.equal(r.calls.length,mode==='first-stale'?1:2);assert(r.before,'fixture must replace active references during an awaited request');assert.equal(r.after,r.before);assert.equal(r.storageAfter,r.storageBefore);assert(/obsolete|campaign.*changed|changed.*campaign/i.test(r.notices.join(' ')+r.text));
  });
  await test('extractor receives only public current source and scoped known knowledge',async page=>{
   const r=await page.evaluate(async()=>{commitGmTurn('[MAP_REVEAL:new|Known arch|W|reported]',{userMsg:'Ask about the arch.'});const known=atlasKnowledgeProjection().features[0];atlasNoteSet(worldState.atlas.seed,known.id,'PLAYER_NOTE_ONLY private plan');__response+='\n[WHISPER:HIDDEN_ONLY secret cellar]\n[CORE_MEMORY:PRIVATE_CORE_ONLY]';await sendAction('Read the waymarkers.');const c=__calls.find(x=>x.opts&&x.opts.kind==='atlas');return {call:c,features:atlasKnowledgeProjection().features};});
   assert(r.call);assert.doesNotMatch(r.call.msg,/HIDDEN_ONLY|PRIVATE_CORE_ONLY|BLUEPRINT_ONLY|MEMORY_ONLY|NODE_ONLY|HISTORY_ONLY|PLAYER_NOTE_ONLY|Stalgind/);assert(r.call.msg.includes(raw));assert(r.call.msg.includes('Known arch'));assert.equal(r.call.opts.noHistory,true);assert.deepEqual(r.features.map(f=>f.label),['Known arch','birch stakes']);
  });
 }
 if(!pass&&!fail)throw Error('No matching discovery browser tests');console.log((fail?'FAILED':'ALL GREEN')+' — '+pass+' #733 discovery-browser groups; screenshots '+shots);if(fail)process.exitCode=1;
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
