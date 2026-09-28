// MANUAL QA — not run by CI; requires PLAYWRIGHT_PATH and Chrome. Isolated copy of a local save; external requests blocked, original save verified byte-identical.
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert/strict'),crypto=require('crypto');
const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
const root=path.resolve(__dirname,'..');
const savePath=process.env.HEARTH_SAVE||path.join(root,'Campaigns/The_Village__Ammut_/saves/The_Village__Ammut__Ammut_t205.tnd');
const savedBytes=fs.readFileSync(savePath);
const saved=savedBytes?JSON.parse(savedBytes):null;
const fixture=JSON.parse(JSON.stringify({world:saved.worldState,memory:saved.memory}));
const server=http.createServer((req,res)=>{const p=path.resolve(root,'.'+new URL(req.url,'http://localhost').pathname);if(!p.startsWith(root+path.sep)){res.writeHead(403);return res.end()};fs.readFile(p,(e,b)=>{res.writeHead(e?404:200,{'Content-Type':({'.js':'application/javascript','.html':'text/html','.css':'text/css','.mp3':'audio/mpeg'})[path.extname(p)]||'application/octet-stream'});res.end(e?'missing':b)})});
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));const url=process.env.HEARTH_QA_URL||'http://127.0.0.1:'+server.address().port;let browser;
try{
 browser=await chromium.launch({channel:'chrome',headless:true,args:['--autoplay-policy=no-user-gesture-required']});const context=await browser.newContext({serviceWorkers:'block'}),page=await context.newPage(),errors=[],requests=[];
 await context.route('**/*',r=>r.request().url().startsWith(url)?r.continue():r.abort());page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(r.url().includes('/sfx/'))requests.push(r.url())});
 await page.addInitScript(()=>{localStorage.setItem('tnd_ambient_enabled_v1','1');window.__loops=[];const create=AudioContext.prototype.createBufferSource;AudioContext.prototype.createBufferSource=function(){const s=create.call(this),start=s.start.bind(s),connect=s.connect.bind(s);s.connect=function(n){s.__gain=n;return connect(n)};s.start=function(...a){if(s.loop)__loops.push(s);return start(...a)};return s};});
 await page.goto(url+'/index.html');await page.waitForFunction(()=>typeof Ambient!=='undefined');
 await page.evaluate(f=>{worldState=f.world;memory=f.memory;sessionLog=[];storageAdapter.syncToServer=function(){};generateActions=function(){};speakNarration=function(){};processPendingCompanionSheets=function(){};showGame();saveLocal();syncUI();},fixture);

 async function bed(id){await page.waitForFunction(id=>Ambient.inspect().key.endsWith('|'+id)&&Ambient.inspect().sources===1&&!Ambient.inspect().pending,id,{timeout:15000});}
 async function quiet(){await page.waitForFunction(()=>Ambient.inspect().sources===0&&!Ambient.inspect().pending,null,{timeout:8000});}
 async function move(name){await page.evaluate(name=>{worldState.world.sublocation=name;saveLocal();syncUI()},name);}
 await bed('tavern');
 assert(requests.some(u=>u.endsWith('/sfx/tavern-hearth-v1.mp3')),'turn-205 tavern requests chatter and hearth');
 const receipt=await page.evaluate(()=>({version:APP_VERSION,snapshot:Ambient.snapshot(),resources:Ambient.inspect(),duration:__loops.at(-1).buffer.duration,loopEnd:__loops.at(-1).loopEnd,channels:__loops.at(-1).buffer.numberOfChannels}));
 assert(Math.abs(receipt.duration-35.485714)<.02);assert.equal(receipt.loopEnd,35.485);assert.equal(receipt.channels,1);assert(receipt.resources.decodedBytes<24000000);
 await page.waitForTimeout(200);const full=await page.evaluate(()=>__loops.at(-1).__gain.gain.value);
 await page.evaluate(()=>{window.__ttsPlaying=TTS.isPlaying;TTS.isPlaying=()=>true;Ambient.sync()});await page.waitForTimeout(500);const duck=await page.evaluate(()=>__loops.at(-1).__gain.gain.value);assert(duck<full*.65,'narration ducks actual voice gain');await page.evaluate(()=>{TTS.isPlaying=__ttsPlaying;Ambient.sync()});
 await page.evaluate(()=>document.dispatchEvent(new CustomEvent('tnd:car-intent',{detail:{kind:'pause'}})));assert.equal(await page.evaluate(()=>Ambient.inspect().sources),0);
 await page.evaluate(()=>document.dispatchEvent(new CustomEvent('tnd:car-intent',{detail:{kind:'resume'}})));await bed('tavern');
 await page.evaluate(()=>{worldState.clock.min+=(60-clockMinuteOfDay()+1440)%1440;saveLocal();syncUI()});await bed('interior-hearth');
 await move("Ammut's house");await bed('interior-hearth');
 assert.equal(await page.evaluate(()=>Ambient.snapshot().habitable),true);
 await page.evaluate(()=>{var n=memory.map.nodes[audioCurrentScene().nodeKey];n.soundscape.allows=['wind'];n.soundscape.quiet='hushed';saveLocal();syncUI()});await bed('interior-hearth');
 assert.equal(await page.evaluate(()=>ambientPlan(Ambient.snapshot(),AUDIO_SCENES).gain),0.12375000000000001);
 await page.evaluate(()=>{delete memory.map.nodes[audioCurrentScene().nodeKey].soundscape;saveLocal();syncUI()});await bed('interior-hearth');
 await page.evaluate(()=>{var n=memory.map.nodes[audioCurrentScene().nodeKey];n.soundscape={enclosure:'covered',setting:'interior',biome:'temperate',quiet:'normal',allows:['wind'],forbid:['fire'],stamp:audioNodeStamp(n)};saveLocal();syncUI()});await quiet();
 await page.evaluate(()=>{var n=memory.map.nodes[audioCurrentScene().nodeKey];n.soundscape.forbid=[];n.soundscape.quiet='silent';saveLocal();syncUI()});await quiet();
 await page.evaluate(()=>{worldState.clock.min+=(1195-clockMinuteOfDay()+1440)%1440;worldState.world.sublocation=null;saveLocal();syncUI()});await bed('village-dusk-noctina');
 await page.evaluate(()=>{worldState.world.sublocation='unrecorded room';memory.map.nodes['The Village|unrecorded room']={parent:'The Village'};saveLocal();syncUI()});await quiet();
 assert.equal(await page.evaluate(()=>Ambient.inspect().decodedBytes),0);await page.evaluate(()=>Ambient.dispose());assert(await page.evaluate(()=>__loops.every(s=>s.buffer===null)),'disposed bed sources release buffers');
 assert.deepEqual(errors,[]);assert(savedBytes.equals(fs.readFileSync(savePath)),'original save must remain byte-identical');
 const result={pass:true,sourceSaveSha256:crypto.createHash('sha256').update(savedBytes).digest('hex'),...receipt,checks:['exact t205 tavern MP3 request and decode','mono loop bounds and memory budget','narration duck','pause/resume','closed tavern fire only','home with observed wind only','unclassified owner home','explicit no fire and silence','outdoor Noctina preserved','unknown room silent','dispose releases buffers'],errors};
 fs.writeFileSync(path.join(root,'Audio/Prepared/browser-hearth-check.json'),JSON.stringify(result,null,2));console.log('HEARTH BROWSER GREEN',JSON.stringify(result));
}finally{if(browser)await browser.close();await new Promise(r=>server.close(r))}})().catch(e=>{console.error(e);process.exitCode=1});
