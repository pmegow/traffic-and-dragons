// Local fixture only: no campaign writes, paid calls, or installed app/browser state.
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_PATH || 'playwright');
const root=path.join(__dirname,'..'),out=process.env.AUDIO_QA_OUT || path.join(root,'Audio','Prepared');
const engine=require('./load-engine.js');engine.loadEngine();engine.makeTestWorld({kind:'village',clock:{min:240}});
worldState.world.location='The Village';worldState.world.sublocation=null;
memory.map.nodes['The Village']={name:'The Village',type:'world'};
memory.map.nodes['The Village|the smithy']={name:'the smithy',parent:'The Village',hours:{open:8,close:18}};
const fixture=JSON.parse(JSON.stringify({world:worldState,memory}));
const types={'.js':'application/javascript','.html':'text/html','.css':'text/css','.mp3':'audio/mpeg','.json':'application/json','.svg':'image/svg+xml'};
const server=http.createServer((req,res)=>{const p=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname==='/'?'/index.html':new URL(req.url,'http://localhost').pathname));if(!p.startsWith(root+path.sep)){res.writeHead(403);return res.end()};fs.readFile(p,(e,b)=>{res.writeHead(e?404:200,{'Content-Type':types[path.extname(p)]||'application/octet-stream'});res.end(e?'missing':b)})});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const url=process.env.AMBIENT_QA_URL || 'http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try{
  const context=await browser.newContext({serviceWorkers:'block'}),page=await context.newPage(),errors=[];
  await context.route('**/*',route=>route.request().url().startsWith(url)||route.request().url().startsWith('file:')?route.continue():route.abort());
  page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{
   window.__loops=[];const proto=AudioContext.prototype,create=proto.createBufferSource;
   proto.createBufferSource=function(){const s=create.call(this),start=s.start.bind(s),stop=s.stop.bind(s);s.start=function(...a){if(s.loop && s.buffer && s.buffer.duration>=17)window.__loops.push(s);return start(...a)};s.stop=function(...a){s.__stopped=true;return stop(...a)};const connect=s.connect.bind(s);s.connect=function(node){s.__gain=node;return connect(node)};return s};
  });
  await page.goto(url+'/index.html');await page.waitForFunction(()=>typeof Ambient!=='undefined');
  await page.evaluate(f=>{worldState=f.world;memory=f.memory;sessionLog=[{role:'user',content:'head in to the smithy'},{role:'assistant',content:'You step back through the smithy door, the heat rolling out again to meet you. [TIME_CHECK:mid-morning] [SCENE_CAST:none]'}];document.getElementById('api-screen').style.display='none';showGame();syncUI();},fixture);
  assert.equal(await page.evaluate(()=>Ambient.inspect().sources),0,'default off');
  await page.evaluate(()=>Sound.setEnabled(false));
  await page.locator('#file-btn').click();await page.locator('#fm-devmode').click();await page.locator('#fm-ambient-cb').check();
  await page.locator('#file-btn').click();
  assert.equal(await page.evaluate(()=>Ambient.inspect().sources),0,'untagged smithy narration must not start fire');
  assert.match(await page.locator('#fm-ambient-status').textContent(),/Waiting for an open smithy/);
  assert.match(await page.evaluate(()=>buildEngineNotes()),/\[SUBLOCATION:the smithy\]/,'loaded-save repair must ask for the missing tag');
  assert.equal(await page.evaluate(()=>worldState.world.sublocation),null,'reminder must not move the party');
  // The real parser receives the GM's explicit filing; no paid model request or live save.
  await page.evaluate(()=>{applyMuts('[SUBLOCATION:the smithy]',{deferSave:true});syncUI()});
  await page.waitForFunction(()=>Ambient.inspect().sources===1);
  const decoded=await page.evaluate(()=>{const s=__loops[0],b=s.buffer,x=b.getChannelData(0);let peak=0;for(let i=0;i<x.length;i++)peak=Math.max(peak,Math.abs(x[i]));return {duration:b.duration,sampleRate:b.sampleRate,channels:b.numberOfChannels,bytes:b.length*4,loopStart:s.loopStart,loopEnd:s.loopEnd,boundaryStep:Math.abs(x[0]-x[Math.round(18*b.sampleRate)-1]),peak}});
  assert(decoded.duration>=18&&decoded.duration<=20);assert.equal(decoded.channels,1);assert(decoded.bytes<=4000000);
  await page.evaluate(()=>{for(let i=0;i<100;i++)syncUI()});assert.equal(await page.evaluate(()=>__loops.length),1);
  await page.evaluate(()=>{document.dispatchEvent(new CustomEvent('tnd:car-intent',{detail:{kind:'pause'}}))});assert.equal(await page.evaluate(()=>Ambient.inspect().sources),0);
  await page.evaluate(()=>{document.dispatchEvent(new CustomEvent('tnd:car-intent',{detail:{kind:'resume'}}))});await page.waitForFunction(()=>Ambient.inspect().sources===1);
  await page.evaluate(()=>{worldState.clock.min=12*60;syncUI()});assert.equal(await page.evaluate(()=>Ambient.inspect().sources),0,'closed at 18:00');
  await page.evaluate(()=>{worldState.clock.min=2*60;syncUI()});await page.waitForFunction(()=>Ambient.inspect().sources===1);
  await page.evaluate(()=>{worldState.world.sublocation='the tavern';syncUI()});assert.equal(await page.evaluate(()=>Ambient.inspect().sources),0);
  await page.evaluate(()=>{worldState.world.sublocation='the smithy';syncUI()});await page.waitForFunction(()=>Ambient.inspect().sources===1);

  await page.waitForTimeout(350);
  assert.equal(await page.evaluate(()=>Sound.enabled()),false,'ambience must work with UI sounds off');
  const normal=await page.evaluate(()=>__loops.at(-1).__gain.gain.value);
  await page.route('https://api.openai.com/v1/audio/speech',route=>route.fulfill({status:200,contentType:'application/octet-stream',body:Buffer.alloc(24000*2*2)}));
  await page.evaluate(()=>{providerKeys.openai='fixture-key';TTS._openai.select(true);window.__voiceDone=0;window.__voiceStates=0;TTS.setOnDone(()=>__voiceDone++);TTS.on('state',()=>__voiceStates++);TTS.speak('The forge warms the room.');});
  await page.waitForTimeout(350);
  const ducked=await page.evaluate(()=>__loops.at(-1).__gain.gain.value);assert(ducked<normal*0.4,'narration did not duck the real fire gain');
  await page.waitForFunction(()=>!TTS.isPlaying());await page.waitForTimeout(350);
  assert(await page.evaluate(()=>__voiceDone>=1&&__voiceStates>=2),'legacy done and additive state must coexist');
  assert((await page.evaluate(()=>__loops.at(-1).__gain.gain.value))>normal*0.95,'narration completion did not restore fire');
  // Advance multiple real loop boundaries without waiting a minute per run.
  await page.evaluate(()=>{__loops.at(-1).playbackRate.value=12});await page.waitForTimeout(4700);
  assert.equal(await page.evaluate(()=>Ambient.inspect().sources),1);assert.equal(await page.evaluate(()=>__loops.filter(s=>!s.__stopped).length),1);
  await page.evaluate(()=>{__loops.at(-1).playbackRate.value=1;document.getElementById('file-btn').click();document.getElementById('fm-devmode').click()});
  await page.screenshot({path:path.join(out,'smithy-desktop.png'),fullPage:true});
  await page.setViewportSize({width:390,height:844});await page.screenshot({path:path.join(out,'smithy-mobile.png'),fullPage:true});
  await page.evaluate(()=>showChar());assert.equal(await page.evaluate(()=>Ambient.inspect().sources),0);
  const filePage=await context.newPage();await filePage.goto('file:///'+path.join(root,'index.html').replace(/\\/g,'/'));
  await filePage.evaluate(()=>{const el=document.getElementById('api-fm-ambient-cb');el.checked=true;el.dispatchEvent(new Event('change'))});
  assert.equal(await filePage.evaluate(()=>Ambient.inspect().sources),0);
  assert.match(await filePage.locator('#api-fm-ambient-status').textContent(),/hosted game or localhost/);
  assert.deepEqual(errors,[]);fs.writeFileSync(path.join(out,'browser-audio-receipt.json'),JSON.stringify({decoded,errors,checks:['untagged saved smithy stays silent','loaded-save location reminder','explicit GM tag starts fire','default off','real enabling gesture','independent UI-sounds preference','real MP3 decode','idempotent UI','car pause/resume','8am open/6pm closed','leave/reenter','three loop boundaries','real TTS duck and restore','legacy plus additive callbacks','showChar release','file origin unavailable']},null,2));
  console.log(JSON.stringify({decoded,errors,result:'BROWSER GREEN'}));
 }finally{await browser.close();server.close()}
})().catch(e=>{console.error(e);server.close();process.exitCode=1});
