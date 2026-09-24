// MANUAL QA — not run by dev/run-tests.js or CI (needs a local Chrome: PLAYWRIGHT_PATH, or the Chrome path in dev/browser-voice-qa.js); run by hand, and its receipt is the audit that cites it (#405).
// Isolated browser fixture: saved audio preferences persist across real reloads.
const assert=require('assert/strict'), fs=require('fs'), path=require('path');
const {chromium}=require(process.env.PLAYWRIGHT_PATH || 'playwright');
const root=path.join(__dirname,'..'),url=process.env.AMBIENT_QA_URL||'http://127.0.0.1:8124';
const engine=require('./load-engine.js');engine.loadEngine();engine.makeTestWorld({kind:'village',clock:{min:205}});
worldState.world.location='The Village';worldState.world.sublocation='the square';
memory.map.nodes['The Village']={parent:null};memory.map.nodes['The Village|the square']={parent:'The Village'};
const fixture=JSON.parse(JSON.stringify({world:worldState,memory}));
(async()=>{
for(const [allowed,touch] of [[true,false],[false,false],[false,true]]){
 const browser=await chromium.launch({channel:'chrome',headless:true,args:[allowed?'--autoplay-policy=no-user-gesture-required':'--autoplay-policy=document-user-activation-required']});
 try {
  const context=await browser.newContext({serviceWorkers:'block',hasTouch:touch}),page=await context.newPage(),errors=[];
  await context.route('**/*',r=>r.request().url().startsWith(url)?r.continue():r.abort());page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(f=>{
   window.__loops=[];const create=AudioContext.prototype.createBufferSource;
   AudioContext.prototype.createBufferSource=function(){const s=create.call(this),start=s.start.bind(s);s.start=function(...a){if(s.loop&&s.loopEnd>0)__loops.push(s);return start(...a)};return s};
   if(localStorage.getItem('tnd_ambient_enabled_v1')===null){localStorage.setItem('tnd_ambient_enabled_v1','1');localStorage.setItem('tnd_ambient_volume_v1','0.32')}
   window.addEventListener('load',()=>{worldState=f.world;memory=f.memory;sessionLog=[];document.getElementById('api-screen').style.display='none';showGame();syncUI()});
  },fixture);
  await page.goto(url+'/index.html');await page.reload();await page.waitForFunction(()=>typeof Ambient!=='undefined');
  if(!allowed){
   await page.waitForTimeout(350);
   assert.equal(await page.evaluate(()=>Ambient.inspect().sources),0,'blocked autoplay must wait');
   if(touch)await page.locator('#action-input').tap();else await page.locator('#action-input').click();
  }
  await page.waitForFunction(()=>Ambient.inspect().sources===1,{},{timeout:4000}).catch(async e=>{console.error(JSON.stringify(await page.evaluate(()=>({snapshot:Ambient.snapshot(),controller:Ambient.inspect(),context:Sound.context().state,status:document.getElementById('fm-ambient-status').textContent}))), 'allowed='+allowed);throw e});
  assert.equal(await page.evaluate(()=>Ambient.snapshot().volume),0.32);
  assert.equal(await page.evaluate(()=>__loops.length),1,'startup events must not duplicate the loop');
  await page.evaluate(()=>window.dispatchEvent(new PageTransitionEvent('pagehide',{persisted:true})));
  assert.equal(await page.evaluate(()=>Ambient.inspect().sources),0);
  await page.evaluate(()=>window.dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true})));
  await page.waitForFunction(()=>Ambient.inspect().sources===1,{},{timeout:4000});
  await page.evaluate(()=>localStorage.setItem('tnd_ambient_enabled_v1','0'));await page.reload();await page.waitForTimeout(350);
  assert.equal(await page.evaluate(()=>Ambient.snapshot().enabled),false);
  assert.equal(await page.evaluate(()=>__loops.length),0,'disabled preference must stay silent');
  assert.deepEqual(errors,[]);console.log('PASS reload '+(allowed?'autoplay allowed':touch?'tap required':'click required')+'; restore; disabled; saved volume; no duplicate loop');
 } finally {await browser.close()}
}
console.log('RELOAD BROWSER GREEN '+url);
})().catch(e=>{console.error(e);process.exitCode=1});
