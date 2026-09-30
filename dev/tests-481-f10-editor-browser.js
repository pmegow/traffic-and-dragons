// tests-481-f10-editor-browser.js — #481 F10 (audit 2026-09-29, Fable-approved), the editor half: signed out, the character
// editor's library buttons were grey with no reason — its "Not signed in" hint sat behind a condition (a server URL with no
// token) that can never hold, since the adapter restores a URL only together with a token. The real character_editor.html in a
// system Chrome (dev/cdp-browser.js), a fresh profile, no network. (The village half is dev/tests-481-f10-signed-out.js.)
//   node dev/tests-481-f10-editor-browser.js
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const {chromium}=require('./cdp-browser.js');
const root=path.resolve(__dirname,'..');
(async()=>{const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||(process.platform==='win32'?'C:/Program Files/Google/Chrome/Application/chrome.exe':undefined),headless:true});let failed=0;try{
 const ctx=await browser.newContext({viewport:{width:900,height:700},serviceWorkers:'block'}),errors=[];
 await ctx.route('**/*',async route=>{const u=new URL(route.request().url());if(u.hostname!=='editor.test')return route.abort();
  const f=path.resolve(root,'.'+decodeURIComponent(u.pathname));if(!f.startsWith(root+path.sep))return route.abort();
  try{return route.fulfill({status:200,contentType:f.endsWith('.html')?'text/html':f.endsWith('.js')?'application/javascript':f.endsWith('.css')?'text/css':'application/json',body:fs.readFileSync(f)});}catch(e){return route.fulfill({status:404,body:'Not found'});}});
 const page=await ctx.newPage();page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://editor.test/character_editor.html');await page.waitForFunction(()=>window.__ceTest);
 const st=await page.evaluate(()=>({who:document.getElementById('who').textContent,lib:document.getElementById('b-lib').disabled,save:document.getElementById('b-libsave').disabled}));
 try{
  assert.equal(st.lib,true,'fixture: signed out, Load from library is disabled');assert.equal(st.save,true,'fixture: Save to library is disabled');
  assert.match(st.who,/Not signed in/,'the disabled library buttons must say why: #who reads '+JSON.stringify(st.who));
  assert.deepEqual(errors,[]);console.log('PASS #481 F10 signed out, the editor says why its library buttons are off');
 }catch(e){failed++;console.error('FAIL #481 F10 signed out, the editor says why its library buttons are off — '+e.message);}
}finally{await browser.close();}
 process.exitCode=failed?1:0;})().catch(e=>{console.error(e);process.exitCode=1;});
