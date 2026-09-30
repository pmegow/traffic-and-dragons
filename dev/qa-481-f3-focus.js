// MANUAL QA — not run by dev/run-tests.js or CI. #481 F3 in a real Chrome (dev/cdp-browser.js; the repo served from disk on a
// fake origin, a fresh profile): the story box has focus, the character sheet opens, and an in-place re-render runs (what
// every sheet action does). Real microtask timing, a real Enter key (Input.dispatchKeyEvent) at whatever holds focus:
//   pass = focus stays inside the sheet and Enter sends no story turn.
// Writes a receipt to QA_OUT (default: the OS temp dir).
//   node dev/qa-481-f3-focus.js
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const {chromium}=require('./cdp-browser.js');
const root=path.resolve(__dirname,'..'),out=process.env.QA_OUT||path.join(require('os').tmpdir(),'tnd-qa-481-f3');fs.mkdirSync(out,{recursive:true});
const engine=require(root+'/dev/load-engine.js');engine.loadEngine();engine.makeTestWorld({kind:'adventure'});
const fixture=JSON.parse(JSON.stringify({world:worldState,memory}));
(async()=>{const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||(process.platform==='win32'?'C:/Program Files/Google/Chrome/Application/chrome.exe':undefined),headless:true});try{
 const context=await browser.newContext({viewport:{width:900,height:800},serviceWorkers:'block'}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',async route=>{const u=new URL(route.request().url());if(u.hostname!=='qa.test')return route.abort();
  const f=path.resolve(root,'.'+decodeURIComponent(u.pathname));if(!f.startsWith(path.resolve(root)+path.sep))return route.abort();
  try{const body=fs.readFileSync(f);await route.fulfill({status:200,contentType:f.endsWith('.html')?'text/html':f.endsWith('.js')?'application/javascript':f.endsWith('.css')?'text/css':'application/json',body});}catch(e){await route.fulfill({status:404,body:'Not found'});}});
 await page.goto('http://qa.test/index.html');await page.waitForFunction(()=>typeof showCharSheet==='function'&&typeof refreshCharSheetInPlace==='function');
 await page.evaluate(f=>{worldState=f.world;memory=f.memory;sessionLog=[];document.getElementById('api-screen').style.display='none';showGame();syncUI();
  window.__sends=0;sendAction=function(){window.__sends++;};document.getElementById('action-input').focus();},fixture);
 const where=()=>page._eval("(function(){var a=document.activeElement,m=document.getElementById('cs-modal');return JSON.stringify({active:a?(a.id||a.tagName):null,inSheet:!!(m&&m.contains(a)),sheetOpen:!!m});})()").then(JSON.parse);
 const enter=async()=>{for(const type of ['keyDown','char','keyUp'])await page._send('Input.dispatchKeyEvent',{type,key:'Enter',code:'Enter',windowsVirtualKeyCode:13,nativeVirtualKeyCode:13,text:type==='keyUp'?undefined:'\r'});};
 await page._eval('showCharSheet()',true);await page.waitForTimeout(150);const opened=await where();
 await page._eval('refreshCharSheetInPlace()',true);await page.waitForTimeout(150);const rerendered=await where();
 await enter();await page.waitForTimeout(150);const sends=await page._eval('window.__sends');const after=await where();
 const receipt={opened,rerendered,enterSends:sends,after,errors};
 fs.writeFileSync(path.join(out,'receipt.json'),JSON.stringify(receipt,null,2));console.log(JSON.stringify(receipt,null,2));
 assert.equal(opened.inSheet,true,'opening the sheet moves focus into it');
 assert.equal(rerendered.inSheet,true,'after the in-place re-render focus is still inside the sheet (not '+rerendered.active+')');
 assert.equal(sends,0,'Enter behind the open sheet sent a story turn');
 assert.deepEqual(errors,[]);console.log('F3 FOCUS QA GREEN');
}finally{await browser.close();}})().catch(e=>{console.error(e.message||e);process.exit(1);});
