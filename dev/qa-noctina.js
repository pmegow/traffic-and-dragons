// MANUAL QA — not run by CI; requires PLAYWRIGHT_PATH and Chrome. Isolated local fixture, no remote requests or saved-campaign access.
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
const root=path.resolve(__dirname,'..');
const engine=require('./load-engine');engine.loadEngine();engine.makeTestWorld({kind:'village',clock:{min:0}});
worldState.world.location='The Village';worldState.world.sublocation=null;
memory.map.nodes['The Village']={name:'The Village',parent:null,type:'world'};
const fixture=JSON.parse(JSON.stringify({world:worldState,memory}));
const server=http.createServer((req,res)=>{const p=path.resolve(root,'.'+new URL(req.url,'http://localhost').pathname);if(!p.startsWith(root+path.sep)){res.writeHead(403);return res.end()};fs.readFile(p,(e,b)=>{res.writeHead(e?404:200,{'Content-Type':({'.js':'application/javascript','.html':'text/html','.css':'text/css','.mp3':'audio/mpeg'})[path.extname(p)]||'application/octet-stream'});res.end(e?'missing':b)})});
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+server.address().port;let browser;
try{
 browser=await chromium.launch({channel:'chrome',headless:true,args:['--autoplay-policy=no-user-gesture-required']});const context=await browser.newContext({serviceWorkers:'block'}),page=await context.newPage(),errors=[],requests=[];
 await context.route('**/*',r=>r.request().url().startsWith(url)?r.continue():r.abort());page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(r.url().includes('/sfx/'))requests.push(r.url())});
 await page.addInitScript(()=>{localStorage.setItem('tnd_ambient_enabled_v1','1');window.__loops=[];const create=AudioContext.prototype.createBufferSource;AudioContext.prototype.createBufferSource=function(){const s=create.call(this),start=s.start.bind(s),connect=s.connect.bind(s);s.connect=function(n){s.__gain=n;return connect(n)};s.start=function(...a){if(s.loop)__loops.push(s);return start(...a)};return s};});
 await page.goto(url+'/index.html');await page.waitForFunction(()=>typeof Ambient!=='undefined');
 await page.evaluate(f=>{worldState=f.world;memory=f.memory;sessionLog=[];storageAdapter.syncToServer=function(){};generateActions=function(){};speakNarration=function(){};processPendingCompanionSheets=function(){};showGame();worldState.clock.min=900;saveLocal();syncUI();},fixture);
 await page.waitForFunction(()=>Ambient.inspect().key.endsWith('|village-night')&&Ambient.inspect().sources===1&&!Ambient.inspect().pending,null,{timeout:15000});
 assert(requests.some(u=>u.endsWith('/sfx/village-night-noctina-v1.mp3')),'actual Noctina delivery requested');
 const receipt=await page.evaluate(()=>({version:APP_VERSION,snapshot:Ambient.snapshot(),resources:Ambient.inspect(),duration:__loops.at(-1).buffer.duration,loopEnd:__loops.at(-1).loopEnd,channels:__loops.at(-1).buffer.numberOfChannels}));
 assert(Math.abs(receipt.duration-84.15)<.02);assert.equal(receipt.loopEnd,84.15);assert.equal(receipt.channels,1);assert(receipt.resources.decodedBytes<24000000);
 await page.waitForTimeout(200);const full=await page.evaluate(()=>__loops.at(-1).__gain.gain.value);
 await page.evaluate(()=>{window.__ttsPlaying=TTS.isPlaying;TTS.isPlaying=()=>true;Ambient.sync()});await page.waitForTimeout(500);const duck=await page.evaluate(()=>__loops.at(-1).__gain.gain.value);assert(duck<full*.65,'narration ducks actual voice gain');await page.evaluate(()=>{TTS.isPlaying=__ttsPlaying;Ambient.sync()});
 await page.evaluate(()=>document.dispatchEvent(new CustomEvent('tnd:car-intent',{detail:{kind:'pause'}})));assert.equal(await page.evaluate(()=>Ambient.inspect().sources),0);
 await page.evaluate(()=>document.dispatchEvent(new CustomEvent('tnd:car-intent',{detail:{kind:'resume'}})));await page.waitForFunction(()=>Ambient.inspect().sources===1&&!Ambient.inspect().pending);
 await page.evaluate(()=>{worldState.world.sublocation='unrecorded room';memory.map.nodes['The Village|unrecorded room']={parent:'The Village'};saveLocal();syncUI()});await page.waitForFunction(()=>Ambient.inspect().sources===0,null,{timeout:6000});assert.equal(await page.evaluate(()=>Ambient.inspect().decodedBytes),0);
 await page.evaluate(()=>{worldState.world.sublocation=null;worldState.clock.min=23*60;saveLocal();syncUI()});await page.waitForFunction(()=>Ambient.inspect().key.endsWith('|village-morning')&&Ambient.inspect().sources===1&&!Ambient.inspect().pending,null,{timeout:10000});
 assert.deepEqual(errors,[]);fs.writeFileSync(path.join(root,'Audio/Music/Village-Night/browser-check.json'),JSON.stringify({pass:true,...receipt,checks:['real MP3 request and decode','night loop bounds','mono memory budget','narration duck','pause/resume','indoor silence and buffer release','05:00 morning transition'],errors},null,2));console.log('NOCTINA BROWSER GREEN: actual game playback, decoded bounds, duck, pause/resume, indoor release, morning transition.');
}finally{if(browser)await browser.close();await new Promise(r=>server.close(r))}})().catch(e=>{console.error(e);process.exitCode=1});
