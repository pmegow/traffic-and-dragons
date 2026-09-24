// MANUAL QA — not run by dev/run-tests.js or CI (needs a local Chrome: PLAYWRIGHT_PATH, or the Chrome path in dev/browser-voice-qa.js); run by hand, and its receipt is the audit that cites it (#405).
const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
const assert=require('assert/strict'),fs=require('fs');const engine=require('./load-engine');engine.loadEngine();engine.makeTestWorld({kind:'adventure',clock:{min:340}});
worldState.world.location='Ashfen';worldState.world.sublocation=null;memory.map.nodes.Ashfen={parent:null,visits:1};
const fixture=JSON.parse(JSON.stringify({world:worldState,memory})),url=process.env.AMBIENT_QA_URL||'http://127.0.0.1:8124';
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true,args:['--autoplay-policy=no-user-gesture-required']});try{
const context=await browser.newContext({serviceWorkers:'block'}),page=await context.newPage(),errors=[];
await context.route('**/*',r=>r.request().url().startsWith(url)?r.continue():r.abort());page.on('pageerror',e=>errors.push(e.message));
await page.addInitScript(()=>{localStorage.setItem('tnd_ambient_enabled_v1','1');localStorage.setItem('tnd_ak_v1','fixture-never-sent');window.__voices=[];const create=AudioContext.prototype.createBufferSource;AudioContext.prototype.createBufferSource=function(){const v=create.call(this),start=v.start.bind(v),stop=v.stop.bind(v);v.start=function(...args){if(v.loop)__voices.push(v);return start(...args)};v.stop=function(...args){v.__stopped=true;return stop(...args)};return v};});
await page.goto(url+'/index.html');await page.waitForFunction(()=>typeof Ambient!=='undefined');
await page.evaluate(f=>{worldState=f.world;memory=f.memory;sessionLog=[];storageAdapter.syncToServer=function(){};generateActions=function(){};speakNarration=function(){};processPendingCompanionSheets=function(){};showGame();saveLocal();},fixture);
assert.equal(await page.evaluate(()=>Ambient.inspect().sources),0,'unknown place stays silent');
const tag='[SOUNDSCAPE:Ashfen|enclosure=open;setting=wilderness;biome=temperate;quiet=normal;allows=birds,insects,wind;forbid=none]';
await page.evaluate(tag=>{applyMuts(tag,{deferSave:true});syncUI()},tag);assert.equal(await page.evaluate(()=>Ambient.inspect().sources),0,'staged tag must not play');
await page.evaluate(async tag=>{const actual=callGM;callGM=async()=> 'You stand in the sunlit clearing. '+tag;try{await sendAction('look')}finally{callGM=actual}},tag);
await page.waitForFunction(()=>Ambient.inspect().sources===1&&!Ambient.inspect().pending,{},{timeout:10000});
assert.equal(await page.evaluate(()=>Ambient.snapshot().campaignKind),'adventure');assert((await page.evaluate(()=>Ambient.inspect().key)).endsWith('|village-day'));
const count=await page.evaluate(()=>__voices.length);
await page.evaluate(()=>{memory.map.nodes.Second={parent:null,soundscape:JSON.parse(JSON.stringify(memory.map.nodes.Ashfen.soundscape))};worldState.world.location='Second';saveLocal()});
assert.equal(await page.evaluate(()=>__voices.length),count,'equal bed must keep playing across adjacent places');
await page.evaluate(()=>{worldState.world.location='Ashfen';saveLocal();commitGmTurn('All is still. [SOUNDSCAPE:Ashfen|enclosure=open;setting=wilderness;biome=temperate;quiet=silent;allows=none;forbid=birds,insects,wind]',{userMsg:'listen',playerTxt:'listen'})});
await page.waitForFunction(()=>Ambient.inspect().sources===0,{},{timeout:5000});
await page.evaluate(tag=>commitGmTurn('The ordinary sounds return. '+tag,{userMsg:'listen',playerTxt:'listen'}),tag);await page.waitForFunction(()=>Ambient.inspect().sources===1,{},{timeout:10000});
await page.evaluate(()=>document.dispatchEvent(new CustomEvent('tnd:car-intent',{detail:{kind:'pause'}})));assert.equal(await page.evaluate(()=>Ambient.inspect().sources),0);
await page.evaluate(()=>document.dispatchEvent(new CustomEvent('tnd:car-intent',{detail:{kind:'resume'}})));await page.waitForFunction(()=>Ambient.inspect().sources===1,{},{timeout:10000});
await page.reload();await page.waitForFunction(()=>Ambient.inspect().sources===1,{},{timeout:10000}).catch(async e=>{console.error(JSON.stringify(await page.evaluate(()=>({snapshot:Ambient.snapshot(),controller:Ambient.inspect(),profile:memory.map.nodes.Ashfen&&memory.map.nodes.Ashfen.soundscape,stamp:memory.map.nodes.Ashfen&&audioNodeStamp(memory.map.nodes.Ashfen),worldId:worldState&&worldState.campId,memId:memory.campId,status:document.getElementById("fm-ambient-status").textContent})),null,2));throw e;});assert.equal(await page.evaluate(()=>Ambient.snapshot().campaignKind),'adventure');
assert((await page.evaluate(()=>Ambient.inspect().decodedBytes))<=48*1024*1024);assert.deepEqual(errors,[]);
await page.screenshot({path:'testRuns/general-audio-browser.png'});console.log('GENERAL AUDIO BROWSER GREEN: staged/committed classification, adventure bed, adjacency reuse, silence, pause/resume, actual reload and bounded buffers');
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
