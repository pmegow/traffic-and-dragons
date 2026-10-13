// Home focus and catalog refresh: owner removed Quick Start; retained shelf failure/refresh guards.
// Real home.html in isolated Chrome; no live reads or account writes.
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict');
const {chromium}=require('./cdp-browser.js');
const root=path.resolve(__dirname,'..');
const rows=JSON.parse(fs.readFileSync(path.join(root,'samples/catalog.json'))).map(e=>({...e,id:e.file.replace(/\.blueprint$/,''),revision:1,blueprint:JSON.parse(fs.readFileSync(path.join(root,'samples',e.file)))}));
let passed=0,failed=0;
async function test(name,fn){try{await fn();passed++;console.log('PASS #481 F4 '+name);}catch(e){failed++;console.error('FAIL #481 F4 '+name+' — '+(e&&e.message||e));}}
(async()=>{const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||(process.platform==='win32'?'C:/Program Files/Google/Chrome/Application/chrome.exe':undefined),headless:true});try{
 const ctx=await browser.newContext({viewport:{width:1000,height:900},serviceWorkers:'block'});let reads=0,fail=false,themeEdit=false;const errors=[];
 await ctx.addInitScript(()=>{localStorage.setItem('tnd_server_url_v1','http://catalog.test');localStorage.setItem('tnd_server_tok_v1','fixture');});/* the adapter restores the URL only with a token */
 await ctx.route('**/*',async route=>{const u=new URL(route.request().url());if(!['catalog.test','landing.test'].includes(u.hostname))return route.abort();
  if(u.hostname==='landing.test'){const f=path.resolve(root,'website','.'+(u.pathname==='/'?'/index.html':decodeURIComponent(u.pathname)));if(!f.startsWith(path.join(root,'website')+path.sep))return route.abort();try{return route.fulfill({status:200,contentType:f.endsWith('.html')?'text/html':f.endsWith('.css')?'text/css':f.endsWith('.jpeg')?'image/jpeg':'image/svg+xml',body:f.endsWith('.css')&&themeEdit?fs.readFileSync(f,'utf8').replace('#883c2d','#123456'):fs.readFileSync(f)});}catch(e){return route.fulfill({status:404,body:'Not found'});}}
  if(u.pathname==='/api/blueprints')return route.fulfill({status:200,contentType:'application/json',body:'[]'});
  if(u.pathname==='/api/account')return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({username:'Adventurer',entitled:true,tierLabel:'Tester',turnsUsed:12,turnsCap:300})});
  if(u.pathname==='/index.html')return route.fulfill({status:200,contentType:'text/html',body:'<p>Game destination fixture</p>'});
  if(u.pathname==='/catalog/blueprints'){reads++;if(fail)return route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'fixture outage'})});return route.fulfill({status:200,contentType:'application/json',headers:{'Cache-Control':'no-store'},body:JSON.stringify(rows)});}
  const f=path.resolve(root,'.'+decodeURIComponent(u.pathname));if(!f.startsWith(root+path.sep))return route.abort();
  try{return route.fulfill({status:200,contentType:f.endsWith('.html')?'text/html':f.endsWith('.js')?'application/javascript':f.endsWith('.css')?'text/css':'application/json',body:f.endsWith('themes.css')&&themeEdit?fs.readFileSync(f,'utf8').replace('#883c2d','#123456'):fs.readFileSync(f)});}catch(e){return route.fulfill({status:404,body:'Not found'});}});
 const home=await ctx.newPage();home.on('pageerror',e=>errors.push(e.message));
 await home.goto('http://catalog.test/home.html');await home.waitForFunction(()=>window.__homeTest&&__homeTest.catalog().length===8);
 const iron=rows.find(r=>/Iron Meridian/.test(r.name));assert.ok(iron,'fixture: The Iron Meridian is on the curated shelf');
 const back=async()=>{await home.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')));await home.waitForTimeout(400);};
 if(process.env.HOME_CAPTURE){for(const width of [1200,390]){await home.setViewportSize({width,height:950});await home.screenshot({path:process.env.HOME_CAPTURE+'-'+width+'.png',fullPage:true});}await home.setViewportSize({width:1200,height:950});}
 if(process.env.HOME_CAPTURE){const landing=await ctx.newPage();await landing.goto('http://landing.test/');for(const width of [1200,390]){await landing.setViewportSize({width,height:950});await landing.screenshot({path:process.env.HOME_CAPTURE+'-landing-'+width+'.png',fullPage:true});}}
 await test('home focuses on campaigns with the landing palette and Extras',async()=>{
  const view=await home.evaluate(()=>({quick:!!document.querySelector('#quick'),title:document.querySelector('#play h3').textContent,continueLabel:document.querySelector('#go-play').textContent,newLabel:document.querySelector('#go-new')?.textContent,extras:[...document.querySelectorAll('#extras .card h3')].map(x=>x.textContent),ink:getComputedStyle(document.documentElement).getPropertyValue('--t0').trim(),paper:getComputedStyle(document.documentElement).getPropertyValue('--bg1').trim(),accent:getComputedStyle(document.documentElement).getPropertyValue('--acc').trim()}));
  assert.equal(view.quick,false,'Quick Start pane removed');assert.equal(view.continueLabel,'Continue');assert.equal(view.newLabel,'New Campaign');assert.deepEqual(view.extras,['Blueprint Designer','Character Editor','Reference','Mementos']);assert.equal(view.ink,'#302a20');assert.equal(view.paper,'#eaddb9');assert.equal(view.accent,'#883c2d');
 });
 await test('both deployments share named light and dark themes and one palette edit',async()=>{
  for(const changed of [false,true]){
   themeEdit=changed;
   for(const [url,selector] of [['http://catalog.test/home.html','#play h3'],['http://landing.test/','.module-title']]){
    const page=await ctx.newPage();await page.goto(url);
    assert.equal(await page.evaluate(()=>document.documentElement.dataset.theme),'light','both pages select light');
    assert.equal(await page.evaluate(sel=>getComputedStyle(document.querySelector(sel)).color,selector),changed?'rgb(18, 52, 86)':'rgb(136, 60, 45)','one shared accent edit reaches the rendered heading');
    await page.evaluate(()=>document.documentElement.dataset.theme='dark');
    assert.equal(await page.evaluate(()=>getComputedStyle(document.documentElement).getPropertyValue('--bg0').trim()),'#0c0d11','dark remains selectable');
   }
  }
  themeEdit=false;
 });
 await test('campaign panel is double wide and mobile has no overflow',async()=>{
  await home.setViewportSize({width:1200,height:950});
  const widths=await home.evaluate(()=>({hero:document.querySelector('#play .card').getBoundingClientRect().width,extra:document.querySelector('#extras .card').getBoundingClientRect().width}));assert(Math.abs(widths.hero-(2*widths.extra+16))<2,'campaign panel spans two cards');
  for(const width of [390,320]){await home.setViewportSize({width,height:950});assert(await home.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'mobile overflow at '+width);}
  await home.setViewportSize({width:1200,height:950});
 });
 await test('New Campaign intent uses the existing saved-campaign confirmation once',async()=>{
  function fixture(search){let count=0;const location={href:'https://game.test/index.html'+search},history={state:null,replaceState:(state,title,url)=>{location.href=new URL(url,location.href).href;}};const box={window:{addEventListener(){}},URL,location,history,newGame:()=>count++};vm.createContext(box);vm.runInContext(fs.readFileSync(path.join(root,'ui-boot.js'),'utf8'),box);return {box,count:()=>count};}
  let f=fixture('?campaign=new&keep=1#panel');assert.equal(typeof f.box.consumeHomeCampaignAction,'function','home campaign action handler exists');assert.equal(f.box.consumeHomeCampaignAction(true),true);assert.equal(f.count(),1);assert.equal(f.box.location.href,'https://game.test/index.html?keep=1#panel');assert.equal(f.box.consumeHomeCampaignAction(true),false);assert.equal(f.count(),1);
  f=fixture('?campaign=new');assert.equal(f.box.consumeHomeCampaignAction(false),true);assert.equal(f.count(),0,'first campaign needs no saved-game confirmation');
  f=fixture('?campaign=continue');assert.equal(f.box.consumeHomeCampaignAction(true),false);assert.equal(f.count(),0);
 });
 await test('boot applies New Campaign only after a readable save loads',async()=>{
  let newCalls=0,offers=0,chars=0,refusals=0;
  const location={href:'https://game.test/index.html?campaign=new'};
  const box={window:{addEventListener(){}},URL,location,history:{state:null,replaceState:(s,t,u)=>{location.href=new URL(u,location.href).href;}},newGame:()=>newCalls++,showChar:()=>chars++,showVersionRefusedScreen:()=>refusals++,offerHomeHandoff:()=>offers++,worldState:{character:{name:'Existing hero'},world:{location:'Existing place'},turn:8},memory:{npcs:{}},getActiveCampId:()=>true,campaignEnded:()=>false,dedupeActiveCampSlots(){},checkLegacyCharacter(){},showGame(){},syncUI(){},initAbilities(){},initSpells(){},addMsg(){},store:{get:()=>null}};
  vm.createContext(box);vm.runInContext(fs.readFileSync(path.join(root,'ui-boot.js'),'utf8'),box);box.initReplaySession=function(){};
  const saved=box.worldState;box.initState(true);assert.equal(newCalls,1);assert.equal(offers,0);assert.equal(box.worldState,saved,'route never replaces the save itself');
  box.initState(true);assert.equal(newCalls,1);assert.equal(offers,1,'ordinary Continue retains blueprint offer');
  location.href='https://game.test/index.html?campaign=new';box.worldState=null;box.initState(false);assert.equal(chars,1);assert.equal(newCalls,1);assert.equal(new URL(location.href).search,'');
  location.href='https://game.test/index.html?campaign=new';box.versionRefusedLoad=()=>({});box.initState(false);assert.equal(refusals,1);assert.equal(chars,1);assert.match(location.href,/campaign=new/,'refused load retains intent for reload');
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
 });
 await test('a FIRST load that fails still says the catalog is unavailable',async()=>{
  const p=await ctx.newPage();p.on('pageerror',e=>errors.push(e.message));fail=true;
  await p.goto('http://catalog.test/home.html');await p.waitForFunction(()=>/Catalog unavailable/.test(document.getElementById('shelf-grid').textContent));fail=false;
 });
 await test('Continue and New Campaign lead to distinct game paths',async()=>{
  for(const [id,expected] of [['go-play',''],['go-new','?campaign=new']]){const p=await ctx.newPage();await p.goto('http://catalog.test/home.html');await p.waitForFunction(()=>window.__homeTest);await p.locator('#'+id).click();await p.waitForFunction(()=>location.pathname==='/index.html');assert.equal(await p.evaluate(()=>location.search),expected);}
 });
 assert.deepEqual(errors,[],'page errors');
}finally{await browser.close();}
 console.log('#481 F4 HOME: '+failed+' failed, '+passed+' passed');process.exitCode=failed?1:0;})().catch(e=>{console.error(e);process.exitCode=1;});
