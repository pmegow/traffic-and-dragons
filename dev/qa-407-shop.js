// #407 browser QA: the counter in a real Chrome — the village fixture at the trading post with the keeper present, the
// inventory panel's "Trade with" row, the modal, two sales and a purchase, Complete, the ledger line, gold moved.
// Local fixture only — no campaign writes, no paid calls. Serve the repo on 127.0.0.1:8124 (or AMBIENT_QA_URL), set
// PLAYWRIGHT_PATH, and QA_OUT for the screenshots + receipt.
const {chromium}=require(process.env.PLAYWRIGHT_PATH || 'playwright');
const assert=require('assert/strict'),fs=require('fs'),path=require('path'),root=path.join(__dirname,'..');
const engine=require(root+'/dev/load-engine.js');engine.loadEngine();engine.makeTestWorld({kind:'village',clock:{min:12*1440+10*60}});
worldState.world.location='The Village';worldState.world.sublocation='the trading post';worldState.character.name='Silas';worldState.character.gold=60;
worldState.character.inventory=['Rope x3','Bone-handled knife','Healing potion'];
memory.map={nodes:{},edges:[],lastArrivalFrom:null};
memory.map.nodes['The Village']={firstVisit:1,visits:3,description:null,parent:null,npcs:[],items:[],size:'small'};
memory.map.nodes['The Village|the trading post']={firstVisit:1,visits:1,description:null,parent:'The Village',npcs:[],items:[],size:'small',
  wares:[{item:'Rope',price:'1 gp',note:'',t:1,min:clockNow(),at:'the trading post'},{item:'Healing potion',price:'50 gp',note:'',t:1,min:clockNow(),at:'the trading post'}],
  wanted:[{item:'Bone-handled knife',offer:'3 gp',by:'Frizwick',t:1,min:clockNow()}]};
importVillageResidents([{name:'Frizwick',gender:'F',cls:'Rogue',inventory:[],coreMemories:[]}]);memory.npcs['Frizwick'].lastSeenAt='The Village|the trading post';
const fixture=JSON.parse(JSON.stringify({world:worldState,memory})),url=process.env.AMBIENT_QA_URL||'http://127.0.0.1:8124',out=process.env.QA_OUT||root;
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});try{
 const context=await browser.newContext({serviceWorkers:'block'}),page=await context.newPage(),errors=[];
 await context.route('**/*',r=>r.request().url().startsWith(url)?r.continue():r.abort());page.on('pageerror',e=>errors.push(e.message));
 await page.goto(url+'/index.html');await page.waitForFunction(()=>typeof showShopModal==='function');
 await page.evaluate(f=>{worldState=f.world;memory=f.memory;sessionLog=[];document.getElementById('api-screen').style.display='none';showGame();syncUI()},fixture);
 const door=await page.evaluate(()=>[...document.querySelectorAll('#inv-list .ii')].map(e=>e.textContent).filter(t=>/Trade with/.test(t)));
 assert.deepEqual(door,['⇆ Trade with Frizwick'],'the inventory panel offers the counter with the keeper named');
 await page.evaluate(()=>showShopModal());await page.waitForSelector('#shop-modal');
 const head=await page.evaluate(()=>document.querySelector('#shop-modal').innerText);
 assert.match(head,/Silas/);assert.match(head,/60 gp/);assert.match(head,/Frizwick/);assert.match(head,/the trading post/);
 assert.equal(await page.evaluate(()=>document.querySelector('#ledger-go').disabled),true,'Complete is locked with nothing marked');
 await page.click('#shop-modal .shop-row[data-side="left"][data-key="rope"]');await page.click('#shop-modal .shop-row[data-side="left"][data-key="rope"]');
 await page.click('#shop-modal .shop-row[data-side="left"][data-key="bone-handled knife"]');await page.click('#shop-modal .shop-row[data-side="right"][data-key="healing potion"]');
 const marked=await page.evaluate(()=>({sell:[...document.querySelectorAll('#shop-modal .sel-sell')].map(e=>e.textContent.trim()),buy:[...document.querySelectorAll('#shop-modal .sel-buy')].map(e=>e.textContent.trim()),total:document.querySelector('#shop-modal .shop-total').innerText,go:document.querySelector('#ledger-go').disabled}));
 assert.equal(marked.sell.length,2);assert.match(marked.sell[0],/Rope.*2\/3.*\+1 gp/s);assert.match(marked.sell[1],/knife.*wanted.*\+2 gp/s);
 assert.equal(marked.buy.length,1);assert.match(marked.buy[0],/Healing potion.*−50 gp/s);assert.match(marked.total,/−47 gp/);assert.equal(marked.go,false);
 await page.screenshot({path:path.join(out,'shop-desktop.png')});
 await page.click('#shop-modal .shop-row[data-side="left"][data-key="rope"] .shop-qty');assert.match(await page.evaluate(()=>document.querySelector('#shop-modal .shop-total').innerText),/−48 gp/,'clicking the count clears the stack');
 await page.click('#shop-modal .shop-row[data-side="left"][data-key="rope"]');await page.click('#shop-modal .shop-row[data-side="left"][data-key="rope"]');
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:path.join(out,'shop-mobile.png')});await page.setViewportSize({width:1280,height:900});
 await page.click('#ledger-go');await page.waitForFunction(()=>!document.querySelector('#shop-modal'));
 const after=await page.evaluate(()=>({gold:worldState.character.gold,inv:worldState.character.inventory.slice(),wares:memory.map.nodes['The Village|the trading post'].wares.map(w=>w.item+'@'+w.price),ping:worldState.tradePing,log:[...document.querySelectorAll('#story-narrative .msg, #story-narrative div')].map(e=>e.textContent).filter(t=>/sold Rope/.test(t)).slice(-1)}));
 assert.equal(after.gold,13,'60 − 47');assert.deepEqual(after.inv.sort(),['Healing potion x2','Rope']);
 assert.deepEqual(after.wares,['Rope@1 gp','Bone-handled knife@2 gp'],'the potion left the shelf; the sold items joined it at canon');
 assert.equal(after.ping&&after.ping.keeper,'Frizwick');assert.equal(after.log.length,1,'one system line in the log');
 assert.deepEqual(errors,[]);
 const receipt={result:'SHOP BROWSER GREEN',url,door,marked,after:{gold:after.gold,inv:after.inv,wares:after.wares}};fs.writeFileSync(path.join(out,'shop-browser-receipt.json'),JSON.stringify(receipt,null,2));console.log(JSON.stringify(receipt));
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exit(1)});
