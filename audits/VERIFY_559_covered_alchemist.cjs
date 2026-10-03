const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..'),{chromium}=require(root+'/dev/cdp-browser.js');
const save=path.join(root,'Campaigns/The_Village__Ammut_/saves/The_Village__Ammut__Ammut_t279.tnd');
const raw=JSON.parse(fs.readFileSync(save,'utf8'));
(async()=>{const browser=await chromium.launch({headless:true});try{
const context=await browser.newContext({serviceWorkers:'block'}),page=await context.newPage();
const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.route('**/*',async route=>{const u=new URL(route.request().url());if(u.hostname!=='qa.test')return route.abort();const f=path.resolve(root,'.'+decodeURIComponent(u.pathname));if(!f.startsWith(root+path.sep))return route.abort();try{await route.fulfill({status:200,contentType:f.endsWith('.html')?'text/html':f.endsWith('.js')?'application/javascript':f.endsWith('.css')?'text/css':f.endsWith('.mp3')?'audio/mpeg':'application/json',body:fs.readFileSync(f)});}catch(e){await route.fulfill({status:404,body:'Not found'});}});
await page.goto('https://qa.test/index.html');await page.waitForFunction(()=>typeof Ambient==='object');
await page.evaluate(r=>{worldState=inflateWorldStateSnapshot(r.worldState);memory=r.memory;sessionLog=r.sessionLog||[];document.getElementById('api-screen').style.display='none';document.getElementById('game-screen').style.display='flex';audioScenePublish('load',true);document.dispatchEvent(new Event('pointerdown'));},raw);
await page.evaluate(()=>{const b=document.createElement('button');b.id='qa-audio-unlock';b.textContent='Unlock audio';b.style='position:fixed;top:0;left:0;z-index:999999';document.body.appendChild(b);});
await page._send('Input.dispatchMouseEvent',{type:'mousePressed',x:20,y:10,button:'left',clickCount:1});
await page._send('Input.dispatchMouseEvent',{type:'mouseReleased',x:20,y:10,button:'left',clickCount:1});
try{await page.waitForFunction(()=>Ambient.inspect().sources===1&&Ambient.inspect().accents&&Ambient.inspect().accents.buffers===1);}catch(e){console.log('FAILED STATE',JSON.stringify(await page.evaluate(()=>({snapshot:Ambient.snapshot(),playback:Ambient.inspect(),state:Sound.context().state,status:document.querySelector('#ambient-status')?.textContent}))));throw e;}
const result=await page.evaluate(()=>({version:APP_VERSION,scene:audioCurrentScene(),playback:Ambient.inspect()}));
assert.equal(result.scene.profile.enclosure,'covered');assert.equal(result.scene.open,true);assert.match(result.playback.key,/alchemist/);assert.deepEqual(result.playback.accents.sets,['alchemist-glass']);assert.deepEqual(errors,[]);
console.log(JSON.stringify({result:'PASS',...result},null,2));
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
