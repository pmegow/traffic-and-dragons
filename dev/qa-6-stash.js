// #6 E11 browser QA: the chest in a real Chrome — the hero in their own house, the inventory panel's "Stow and take" row,
// the ledger modal, two stowed and one taken, Move, the log line, inventory and stash moved. Local fixture only.
// Serve the repo (AMBIENT_QA_URL, default 127.0.0.1:8124), set PLAYWRIGHT_PATH and QA_OUT.
const {chromium}=require(process.env.PLAYWRIGHT_PATH || 'playwright');
const assert=require('assert/strict'),fs=require('fs'),path=require('path'),root=path.join(__dirname,'..');
const engine=require(root+'/dev/load-engine.js');engine.loadEngine();engine.makeTestWorld({kind:'village',clock:{min:12*1440+10*60}});
worldState.world.location='The Village';worldState.character.name='Silas';worldState.character.gold=60;worldState.character.inventory=['Rope x3','Bone-handled knife'];
memory.map={nodes:{},edges:[],lastArrivalFrom:null};
memory.map.nodes['The Village']={firstVisit:1,visits:3,description:null,parent:null,npcs:[],items:[],size:'small'};
memory.map.nodes[villageHouseKey('Silas')]={firstVisit:1,visits:1,description:null,parent:'The Village',npcs:[],items:[],size:'small',owner:'Silas'};
memory.map.nodes[villageHouseKey('Silas')].items=[{name:'Old boots',placed:1,taken:false,qty:2,by:'Silas',min:clockNow()},{name:'Lantern',placed:1,taken:false,qty:1,by:'Silas',min:clockNow(),room:'main room'}];
worldState.world.sublocation="Silas's house";
const fixture=JSON.parse(JSON.stringify({world:worldState,memory})),url=process.env.AMBIENT_QA_URL||'http://127.0.0.1:8124',out=process.env.QA_OUT||root;
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});try{
 const context=await browser.newContext({serviceWorkers:'block'}),page=await context.newPage(),errors=[];
 await context.route('**/*',r=>r.request().url().startsWith(url)?r.continue():r.abort());page.on('pageerror',e=>errors.push(e.message));
 await page.goto(url+'/index.html');await page.waitForFunction(()=>typeof showStashModal==='function');
 await page.evaluate(f=>{worldState=f.world;memory=f.memory;sessionLog=[];document.getElementById('api-screen').style.display='none';showGame();syncUI()},fixture);
 const door=await page.evaluate(()=>[...document.querySelectorAll('#inv-list .ii')].map(e=>e.textContent).filter(t=>/Stow and take/.test(t)));
 assert.equal(door.length,1,'the inventory panel offers the chest in the hero\'s own house');
 await page.evaluate(()=>showStashModal());await page.waitForSelector('#stash-modal');
 const head=await page.evaluate(()=>document.querySelector('#stash-modal').innerText);
 assert.match(head,/Silas/);assert.match(head,/Silas's house/);assert.match(head,/STOW/i);assert.match(head,/TAKE/i);assert.match(head,/main room/);
 await page.click('#stash-modal .shop-row[data-side="left"][data-key="rope"]');await page.click('#stash-modal .shop-row[data-side="left"][data-key="rope"]');
 await page.click('#stash-modal .shop-row[data-side="right"][data-key="old boots"]');
 const marked=await page.evaluate(()=>({sell:[...document.querySelectorAll('#stash-modal .sel-sell')].map(e=>e.textContent.trim()),buy:[...document.querySelectorAll('#stash-modal .sel-buy')].map(e=>e.textContent.trim()),total:document.querySelector('#stash-modal .shop-total').innerText,go:document.querySelector('#ledger-go').disabled}));
 assert.equal(marked.sell.length,1);assert.match(marked.sell[0],/Rope.*2\/3.*→ house ×2/s);assert.equal(marked.buy.length,1);assert.match(marked.buy[0],/Old boots.*→ you/s);assert.match(marked.total,/2 in, 1 out/);assert.equal(marked.go,false);
 await page.screenshot({path:path.join(out,'stash-desktop.png')});
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:path.join(out,'stash-mobile.png')});await page.setViewportSize({width:1280,height:900});
 await page.click('#ledger-go');await page.waitForFunction(()=>!document.querySelector('#stash-modal'));
 const after=await page.evaluate(()=>({inv:worldState.character.inventory.slice().sort(),stash:villageStash(villageHouseKey('Silas')).map(r=>r.name+':'+r.qty).sort(),log:[...document.querySelectorAll('#story-narrative div')].map(e=>e.textContent).filter(t=>/stowed Rope x2/.test(t)).length}));
 assert.deepEqual(after.inv,['Bone-handled knife','Old boots','Rope']);assert.deepEqual(after.stash,['Lantern:1','Old boots:1','Rope:2']);assert.equal(after.log,1,'one system line');
 assert.deepEqual(errors,[]);
 const receipt={result:'STASH BROWSER GREEN',url,door,marked,after:{inv:after.inv,stash:after.stash}};fs.writeFileSync(path.join(out,'stash-browser-receipt.json'),JSON.stringify(receipt,null,2));console.log(JSON.stringify(receipt));
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exit(1)});
