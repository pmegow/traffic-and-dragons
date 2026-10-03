// Verification receipt script, 2026-10-02. Adapted from qa-481-d5-d7-counter.js.
// Uses ordinary Travel rations (25 cp sale value), not a one-item wanted offer.
// Also captures the malicious-portrait and Hall-item render at desktop/phone widths.
// Run: node audits/VERIFY_known_issues_2026-10-02/browser.cjs; optional QA_OUT.
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const {chromium}=require('../../dev/cdp-browser.js');
const root=path.resolve(__dirname,'../..'),out=process.env.QA_OUT||path.join(require('os').tmpdir(),'tnd-qa-481-counter');fs.mkdirSync(out,{recursive:true});
const engine=require(root+'/dev/load-engine.js');engine.loadEngine();engine.makeTestWorld({kind:'village',clock:{min:12*1440+10*60}});
worldState.world.location='The Village';worldState.world.sublocation='the trading post';worldState.character.name='Silas';worldState.character.gold=60;
worldState.character.inventory=['Rope x3','Travel rations x4','Travel rations x2'];
memory.map={nodes:{},edges:[],lastArrivalFrom:null};
memory.map.nodes['The Village']={firstVisit:1,visits:3,description:null,parent:null,npcs:[],items:[],size:'small'};
memory.map.nodes['The Village|the trading post']={firstVisit:1,visits:1,description:null,parent:'The Village',npcs:[],items:[],size:'small',shop:true,
  wares:[{item:'Honey cake',price:'25 cp',note:'',t:1,min:clockNow(),at:'the trading post'},{item:'Arrows',price:'1 gp per 20',note:'',t:1,min:clockNow(),at:'the trading post'}],
  wanted:[]};
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
 assert.match(rations,/25 cp/,'D5: rations sell at half of 5 sp, shown in copper');assert.match(cake,/25 cp/,'D5: the cake is priced');assert.match(arrows,/20/,'D5: the arrow bundle row offers twenty');
 await page.locator('#shop-modal .shop-row[data-side="left"][data-key="travel rations"]').click();
 const lone=await page.evaluate(()=>({status:document.querySelector('#shop-modal').innerText.split('\n').filter(l=>/half a gold/.test(l))[0]||'',go:document.querySelector('#ledger-go').disabled}));
 assert.match(lone.status,/rations/i,'D7: the reason names the item');assert.equal(lone.go,true,'D7: Complete is locked');
 await page.screenshot({path:path.join(out,'d7-lone-whistle.png')});
 await page.locator('#shop-modal .shop-row[data-side="left"][data-key="travel rations"]').click();
 const pair=await page.evaluate(()=>({total:document.querySelector('#shop-modal .shop-total').innerText,go:document.querySelector('#ledger-go').disabled}));
 assert.match(pair.total,/\+1 gp/,'D7: two whistles sell for 1 gp');assert.equal(pair.go,false,'D7: Complete unlocks');
 await page.screenshot({path:path.join(out,'d7-pair.png')});
 assert.deepEqual(errors,[]);
 await page.setViewportSize({width:390,height:844}); await page.screenshot({path:path.join(out,'counter-phone.png')});
 await page.evaluate(()=>{document.getElementById('shop-modal').remove();worldState.npcs.push({name:'Portrait probe',status:'present',rel:'neutral',portrait:"x' onerror='window.__portraitInjected=1",charSheet:{name:'Portrait probe',stats:{STR:10},inventory:[],portrait:"x' onerror='window.__portraitInjected=1"}});memory.npcs['Portrait probe']={knowledge:[],events:[],aliases:[]};showNpcSheet('Portrait probe');});
 const portrait=await page.evaluate(()=>({injected:!!window.__portraitInjected,handlers:document.querySelectorAll('[onerror]').length}));assert.equal(portrait.injected,false);assert.equal(portrait.handlers,0);await page.screenshot({path:path.join(out,'portrait-phone.png')});
 await page.setViewportSize({width:1280,height:900});await page.screenshot({path:path.join(out,'portrait-desktop.png')});
 console.log('PORTRAIT BROWSER PASS '+JSON.stringify(portrait));
 await page.evaluate(()=>{document.getElementById('npc-modal').remove();const k='The Village|the Village Hall';memory.map.nodes[k]={firstVisit:1,visits:1,parent:'The Village',items:[{name:'Brass lantern',placed:3,taken:false,qty:1,by:'Silas',min:0}],npcs:[]};worldState.world.sublocation='the Village Hall';syncUI();mutsSummaryEmit({muts:[]});});
 const hall=await page.evaluate(()=>hereItemsLine());assert.equal(hall,'Here: Brass lantern');await page.screenshot({path:path.join(out,'hall-desktop.png')});await page.setViewportSize({width:390,height:844});await page.screenshot({path:path.join(out,'hall-phone.png')});console.log('HERE BROWSER PASS '+hall);
 const receipt={result:'COUNTER QA GREEN (#481 D5+D7)',rows,lone,pair,shots:[path.join(out,'d7-lone-whistle.png'),path.join(out,'d7-pair.png')]};
 fs.writeFileSync(path.join(out,'receipt.json'),JSON.stringify(receipt,null,2));console.log(JSON.stringify(receipt,null,2));
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1);});
