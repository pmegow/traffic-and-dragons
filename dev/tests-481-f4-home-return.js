// tests-481-f4-home-return.js — #481 F4 (audit 2026-09-29, Fable-approved): coming back to the home page's tab reset the Quick
// Start story pick to the taster, the catalog loaded TWICE per return (two visibilitychange listeners, commit 76e67c5), and one
// failed re-read emptied the shelf. Real home.html in a system Chrome (dev/cdp-browser.js) against a fixture HTTP catalog
// (the eight curated samples); no live reads. Driven through the page and window.__homeTest.
//   node dev/tests-481-f4-home-return.js
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const {chromium}=require('./cdp-browser.js');
const root=path.resolve(__dirname,'..');
const rows=JSON.parse(fs.readFileSync(path.join(root,'samples/catalog.json'))).map(e=>({...e,id:e.file.replace(/\.blueprint$/,''),revision:1,blueprint:JSON.parse(fs.readFileSync(path.join(root,'samples',e.file)))}));
let passed=0,failed=0;
async function test(name,fn){try{await fn();passed++;console.log('PASS #481 F4 '+name);}catch(e){failed++;console.error('FAIL #481 F4 '+name+' — '+(e&&e.message||e));}}
(async()=>{const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||(process.platform==='win32'?'C:/Program Files/Google/Chrome/Application/chrome.exe':undefined),headless:true});try{
 const ctx=await browser.newContext({viewport:{width:1000,height:900},serviceWorkers:'block'});let reads=0,fail=false;const errors=[];
 await ctx.addInitScript(()=>{localStorage.setItem('tnd_server_url_v1','http://catalog.test');localStorage.setItem('tnd_server_tok_v1','fixture');});/* the adapter restores the URL only with a token */
 await ctx.route('**/*',async route=>{const u=new URL(route.request().url());if(u.hostname!=='catalog.test')return route.abort();
  if(u.pathname==='/catalog/blueprints'){reads++;if(fail)return route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'fixture outage'})});return route.fulfill({status:200,contentType:'application/json',headers:{'Cache-Control':'no-store'},body:JSON.stringify(rows)});}
  const f=path.resolve(root,'.'+decodeURIComponent(u.pathname));if(!f.startsWith(root+path.sep))return route.abort();
  try{return route.fulfill({status:200,contentType:f.endsWith('.html')?'text/html':f.endsWith('.js')?'application/javascript':f.endsWith('.css')?'text/css':'application/json',body:fs.readFileSync(f)});}catch(e){return route.fulfill({status:404,body:'Not found'});}});
 const home=await ctx.newPage();home.on('pageerror',e=>errors.push(e.message));
 await home.goto('http://catalog.test/home.html');await home.waitForFunction(()=>window.__homeTest&&__homeTest.catalog().length===8);
 const iron=rows.find(r=>/Iron Meridian/.test(r.name));assert.ok(iron,'fixture: The Iron Meridian is on the curated shelf');
 const picked=()=>home.evaluate(()=>{const s=document.getElementById('qs-story');return s.selectedIndex>=0?s.options[s.selectedIndex].textContent:'';});
 const back=async()=>{await home.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')));await home.waitForTimeout(400);};
 await test('the repro: a story picked before switching tabs is still picked on return',async()=>{
  assert.match(await picked(),/taster/i,'fixture: the taster is the default pick');
  await home.evaluate(name=>{const s=document.getElementById('qs-story');for(const o of s.options)if(o.textContent===name){s.value=o.value;s.dispatchEvent(new Event('change'));}},iron.name);
  assert.equal(await picked(),iron.name,'fixture: the pick took');
  await back();
  assert.equal(await picked(),iron.name,'the pick reverted on return');
 });
 await test('one return reads the catalog once (one visibilitychange listener)',async()=>{
  const before=reads;await back();
  assert.equal(reads-before,1,'the catalog was read '+(reads-before)+' times for one return');
 });
 await test('a failed re-read keeps the last good shelf and says so',async()=>{
  fail=true;await back();fail=false;
  assert.equal(await home.evaluate(()=>__homeTest.catalog().length),8,'the failed read emptied the catalog');
  const shelf=await home.locator('#shelf-grid').innerText();
  assert.ok(!/Catalog unavailable/.test(shelf)&&shelf.includes(iron.name),'the shelf was wiped: '+shelf.slice(0,120));
  assert.match(await home.evaluate(()=>document.getElementById('status').textContent),/refresh|last/i,'the failed refresh must be said');
  assert.equal(await picked(),iron.name,'the pick survives a failed refresh too');
 });
 await test('a FIRST load that fails still says the catalog is unavailable',async()=>{
  const p=await ctx.newPage();p.on('pageerror',e=>errors.push(e.message));fail=true;
  await p.goto('http://catalog.test/home.html');await p.waitForFunction(()=>/Catalog unavailable/.test(document.getElementById('shelf-grid').textContent));fail=false;
 });
 assert.deepEqual(errors,[],'page errors');
}finally{await browser.close();}
 console.log('#481 F4 HOME: '+failed+' failed, '+passed+' passed');process.exitCode=failed?1:0;})().catch(e=>{console.error(e);process.exitCode=1;});
