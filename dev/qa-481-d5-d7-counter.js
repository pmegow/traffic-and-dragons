// MANUAL QA — not run by dev/run-tests.js or CI. #481 D5 + D7 at the real counter, in a system Chrome driven by
// dev/cdp-browser.js (no Playwright, no server: the repo is served from disk on a fake origin; a fresh profile, so no
// signed-in state and no campaign writes). The village fixture at the trading post with the keeper present:
//   D5 — travel rations (canon 5 sp) sell by the unit; a 25 cp honey cake and a bundle of arrows ("1 gp per 20") are priced.
//   D7 → #598 — a wanted 3 sp whistle sells for 3 sp (no floor in copper) and the want buys ONE: the second tap on the row
//   clears the mark (#481 D4 / #497 wrap), so Complete locks again on "nothing marked". (#592: the old script expected two
//   taps to select two whistles and a 1 gp floor; both rules are gone.)
// Writes screenshots and a receipt to QA_OUT (default: the OS temp dir).
//   node dev/qa-481-d5-d7-counter.js
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const {chromium}=require('./cdp-browser.js');
const root=path.resolve(__dirname,'..'),out=process.env.QA_OUT||path.join(require('os').tmpdir(),'tnd-qa-481-counter');fs.mkdirSync(out,{recursive:true});
const engine=require(root+'/dev/load-engine.js');engine.loadEngine();engine.makeTestWorld({kind:'village',clock:{min:12*1440+10*60}});
worldState.world.location='The Village';worldState.world.sublocation='the trading post';worldState.character.name='Silas';worldState.character.coin=6000;
worldState.character.inventory=['Rope x3','Travel rations x4','Carved whistle x2'];
memory.map={nodes:{},edges:[],lastArrivalFrom:null};
memory.map.nodes['The Village']={firstVisit:1,visits:3,description:null,parent:null,npcs:[],items:[],size:'small'};
memory.map.nodes['The Village|the trading post']={firstVisit:1,visits:1,description:null,parent:'The Village',npcs:[],items:[],size:'small',shop:true,
  wares:[{item:'Honey cake',price:'25 cp',note:'',t:1,min:clockNow(),at:'the trading post'},{item:'Arrows',price:'1 gp per 20',note:'',t:1,min:clockNow(),at:'the trading post'}],
  wanted:[{item:'Carved whistle',offer:'3 sp',by:'Frizwick',t:1,min:clockNow()}]};
importVillageResidents([{name:'Frizwick',gender:'F',cls:'Rogue',inventory:[],coreMemories:[]}]);memory.npcs['Frizwick'].lastSeenAt='The Village|the trading post';
const fixture=JSON.parse(JSON.stringify({world:worldState,memory}));
(async()=>{const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||(process.platform==='win32'?'C:/Program Files/Google/Chrome/Application/chrome.exe':undefined),headless:true});try{
 const context=await browser.newContext({viewport:{width:900,height:760},serviceWorkers:'block'}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',async route=>{const u=new URL(route.request().url());if(u.hostname!=='qa.test')return route.abort();
  const f=path.resolve(root,'.'+decodeURIComponent(u.pathname));if(!f.startsWith(path.resolve(root)+path.sep))return route.abort();
  try{const body=fs.readFileSync(f);await route.fulfill({status:200,contentType:f.endsWith('.html')?'text/html':f.endsWith('.js')?'application/javascript':f.endsWith('.css')?'text/css':'application/json',body});}catch(e){await route.fulfill({status:404,body:'Not found'});}});
 await page.goto('http://qa.test/index.html');await page.waitForFunction(()=>typeof showShopModal==='function');
 await page.evaluate(f=>{worldState=f.world;memory=f.memory;sessionLog=[];document.getElementById('api-screen').style.display='none';showGame();syncUI();showShopModal();},fixture);
 await page.waitForSelector('#shop-modal');
 const rows=await page.evaluate(()=>[...document.querySelectorAll('#shop-modal .shop-row')].map(e=>e.getAttribute('data-side')+':'+e.textContent.trim()));
 const rations=rows.filter(r=>/Travel rations/.test(r))[0]||'',cake=rows.filter(r=>/Honey cake/.test(r))[0]||'',arrows=rows.filter(r=>/Arrows/.test(r))[0]||'';
 assert.match(rations,/2 sp 5 cp/,'D5: rations sell at half of 5 sp, shown in silver and copper (#598)');assert.match(cake,/25 cp/,'D5: the cake is priced');assert.match(arrows,/20/,'D5: the arrow bundle row offers twenty');
 await page.locator('#shop-modal .shop-row[data-side="left"][data-key="carved whistle"]').click();
 const lone=await page.evaluate(()=>({total:document.querySelector('#shop-modal .shop-total').innerText,go:document.querySelector('#ledger-go').disabled}));
 assert.match(lone.total,/\+3 sp/,'D7→#598: one wanted whistle sells for 3 sp');assert.equal(lone.go,false,'D7→#598: Complete unlocks — no floor');
 await page.screenshot({path:path.join(out,'d7-lone-whistle.png')});
 await page.locator('#shop-modal .shop-row[data-side="left"][data-key="carved whistle"]').click();
 const pair=await page.evaluate(()=>({total:document.querySelector('#shop-modal .shop-total').innerText,go:document.querySelector('#ledger-go').disabled}));
 assert.doesNotMatch(pair.total,/sp|gp/,'D4/#497: the want buys ONE — the second tap clears the mark');assert.equal(pair.go,true,'#592: Complete locks again on nothing marked');
 await page.screenshot({path:path.join(out,'d7-pair.png')});
 assert.deepEqual(errors,[]);
 const receipt={result:'COUNTER QA GREEN (#481 D5 + D7→#598 + #592)',rows,lone,pair,shots:[path.join(out,'d7-lone-whistle.png'),path.join(out,'d7-pair.png')]};
 fs.writeFileSync(path.join(out,'receipt.json'),JSON.stringify(receipt,null,2));console.log(JSON.stringify(receipt,null,2));
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1);});
