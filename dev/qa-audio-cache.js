// MANUAL QA — not run by dev/run-tests.js or CI (needs a local Chrome: PLAYWRIGHT_PATH, or the Chrome path in dev/browser-voice-qa.js); run by hand, and its receipt is the audit that cites it (#405).
const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright'),assert=require('assert/strict');const engine=require('./load-engine');engine.loadEngine();engine.makeTestWorld({kind:'village',clock:{min:205}});worldState.world.location='The Village';memory.map.nodes['The Village']={parent:null};const fixture=JSON.parse(JSON.stringify({world:worldState,memory})),url=process.env.AMBIENT_QA_URL||'http://127.0.0.1:8124';
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true,args:['--autoplay-policy=no-user-gesture-required']});try{
const context=await browser.newContext(),page=await context.newPage();await page.addInitScript(()=>localStorage.setItem('tnd_ak_v1','fixture-never-sent'));
await page.goto(url+'/');await page.evaluate(()=>navigator.serviceWorker.ready);await page.reload();await page.waitForFunction(()=>navigator.serviceWorker.controller);
await page.evaluate(f=>{worldState=f.world;memory=f.memory;sessionLog=[];storageAdapter.syncToServer=function(){};showGame();saveLocal()},fixture);
await page.waitForFunction(()=>Ambient.inspect().sources===1&&!Ambient.inspect().pending,{},{timeout:10000});
const result=await page.evaluate(async()=>{const keys=await caches.keys(),audio=keys.filter(k=>k.startsWith('tnd-audio-'));let others=[];for(const key of keys.filter(k=>!k.startsWith('tnd-audio-'))){const c=await caches.open(key);others.push(...(await c.keys()).filter(r=>new URL(r.url).pathname.startsWith('/sfx/')).map(r=>r.url))}return {audio,others,count:(await (await caches.open(audio[0])).keys()).length}});
assert.equal(result.audio.length,1);assert.equal(result.count,1);assert.deepEqual(result.others,[]);
await context.setOffline(true);await page.reload();await page.waitForFunction(()=>Ambient.inspect().sources===1&&!Ambient.inspect().pending,{},{timeout:10000});
console.log('REAL AUDIO CACHE GREEN: one owner, no shell duplicates, cached bed plays after offline reload');
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
