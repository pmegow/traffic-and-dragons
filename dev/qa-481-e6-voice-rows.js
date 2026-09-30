// MANUAL QA — not run by dev/run-tests.js or CI. #481 E6 on the real character sheet, in a system Chrome driven by
// dev/cdp-browser.js (no Playwright, no server: the repo is served from disk on a fake origin; a fresh profile, so no
// signed-in state and no campaign writes). The hero has a saved delivery direction and speed:
//   Gemini primary — both rows hidden, two one-line hints, each saying the saved value is kept.
//   Inworld primary — both rows shown with the saved values, no hint.
// Writes screenshots and a receipt to QA_OUT (default: the OS temp dir).
//   node dev/qa-481-e6-voice-rows.js
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const {chromium}=require('./cdp-browser.js');
const root=path.resolve(__dirname,'..'),out=process.env.QA_OUT||path.join(require('os').tmpdir(),'tnd-qa-481-e6');fs.mkdirSync(out,{recursive:true});
const engine=require(root+'/dev/load-engine.js');engine.loadEngine();engine.makeTestWorld({kind:'adventure'});
worldState.character.name='Daeris';worldState.character.voiceDirection='gruff and unhurried';worldState.character.voiceRate=1.2;
const fixture=JSON.parse(JSON.stringify({world:worldState,memory}));
(async()=>{const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||(process.platform==='win32'?'C:/Program Files/Google/Chrome/Application/chrome.exe':undefined),headless:true});try{
 const context=await browser.newContext({viewport:{width:420,height:900},serviceWorkers:'block'}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',async route=>{const u=new URL(route.request().url());if(u.hostname!=='qa.test')return route.abort();
  const f=path.resolve(root,'.'+decodeURIComponent(u.pathname));if(!f.startsWith(path.resolve(root)+path.sep))return route.abort();
  try{const body=fs.readFileSync(f);await route.fulfill({status:200,contentType:f.endsWith('.html')?'text/html':f.endsWith('.js')?'application/javascript':f.endsWith('.css')?'text/css':'application/json',body});}catch(e){await route.fulfill({status:404,body:'Not found'});}});
 await page.goto('http://qa.test/index.html');await page.waitForFunction(()=>typeof showCharSheet==='function'&&typeof TTS!=='undefined');
 const shots=[],seen={};
 for(const primary of ['gemini','inworld']){
  await page.evaluate(a=>{worldState=a.f.world;memory=a.f.memory;sessionLog=[];store.set('tnd_voice_settings_v1',JSON.stringify({primary:a.p}));
   document.getElementById('api-screen').style.display='none';showGame();syncUI();showCharSheet();},{f:fixture,p:primary});
  await page.waitForSelector('#cs-modal');
  seen[primary]=await page.evaluate(()=>{var r=document.querySelector('#cs-modal .cs-voice-row')||document.querySelector('#cs-modal .cs-voice-hint');if(r)r.scrollIntoView({block:'start'});
   return {direction:!!document.getElementById('cs-voice-direction'),speed:!!document.getElementById('cs-voice-rate'),
    directionValue:(document.getElementById('cs-voice-direction')||{}).value||'',speedLabel:((document.getElementById('cs-voice-rate-value')||{}).textContent)||'',
    hints:Array.prototype.map.call(document.querySelectorAll('#cs-modal .cs-voice-hint'),function(h){return h.textContent;})};});
  const shot=path.join(out,'e6-'+primary+'.png');await page.screenshot({path:shot});shots.push(shot);
 }
 assert.equal(seen.gemini.direction,false,'Gemini: the direction row is hidden');assert.equal(seen.gemini.speed,false,'Gemini: the Speed row is hidden');
 assert.equal(seen.gemini.hints.length,2,'Gemini: one hint per hidden row');assert.ok(seen.gemini.hints.every(h=>/kept/.test(h)),'Gemini: each hint says the saved value is kept');
 assert.equal(seen.inworld.direction,true,'Inworld: the direction row shows');assert.equal(seen.inworld.speed,true,'Inworld: the Speed row shows');
 assert.equal(seen.inworld.directionValue,'gruff and unhurried','Inworld: the saved direction is back');assert.match(seen.inworld.speedLabel,/1\.20/,'Inworld: the saved speed is back');
 assert.equal(seen.inworld.hints.length,0,'Inworld: no hint');
 assert.deepEqual(errors,[]);
 const receipt={result:'VOICE ROWS QA GREEN (#481 E6)',seen,shots};
 fs.writeFileSync(path.join(out,'receipt.json'),JSON.stringify(receipt,null,2));console.log(JSON.stringify(receipt,null,2));
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1);});
