// #413 browser QA: the ways row paints from the real map in a real Chrome, and a chip tap PREFILLS the input.
// Local fixture only — no campaign writes, no paid calls. Serve the repo on 127.0.0.1:8124 (or set AMBIENT_QA_URL),
// set PLAYWRIGHT_PATH to an installed Playwright module, and QA_OUT to a folder for the screenshots + receipt.
const {chromium}=require(process.env.PLAYWRIGHT_PATH || 'playwright');
const assert=require('assert/strict'),fs=require('fs'),path=require('path'),root=path.join(__dirname,'..');
const engine=require(root+'/dev/load-engine.js');engine.loadEngine();engine.makeTestWorld({kind:'village',clock:{min:625}});
worldState.world.location='The Village';worldState.world.sublocation='the tavern';
memory.map={nodes:{},edges:[],lastArrivalFrom:null};
memory.map.nodes['The Village']={firstVisit:1,visits:3,description:null,parent:null,npcs:[],items:[],size:'small',travelMins:null};
memory.map.nodes['The Village|the tavern']={firstVisit:1,visits:2,description:null,parent:'The Village',npcs:[],items:[],size:'small',travelMins:null,hours:{open:10,close:24}};
memory.map.nodes['The Village|the smithy']={firstVisit:1,visits:1,description:null,parent:'The Village',npcs:[],items:[],size:'small',travelMins:null,hours:{open:8,close:18}};
memory.map.nodes["The Village|Healer's Garden"]={firstVisit:1,visits:0,description:null,parent:'The Village',npcs:[],items:[],size:'small',travelMins:null};
memory.map.nodes['Marrowgate']={firstVisit:4,visits:1,description:null,parent:null,npcs:[],items:[],size:'large',travelMins:null};
memory.map.edges=[{from:'The Village',to:'Marrowgate',turn:4}];
const fixture=JSON.parse(JSON.stringify({world:worldState,memory})),url=process.env.AMBIENT_QA_URL||'http://127.0.0.1:8124',out=process.env.QA_OUT||root;
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});try{
 const context=await browser.newContext({serviceWorkers:'block'}),page=await context.newPage(),errors=[];
 await context.route('**/*',r=>r.request().url().startsWith(url)?r.continue():r.abort());page.on('pageerror',e=>errors.push(e.message));
 await page.goto(url+'/index.html');await page.waitForFunction(()=>typeof waysFromHere==='function');
 await page.evaluate(f=>{worldState=f.world;memory=f.memory;sessionLog=[];document.getElementById('api-screen').style.display='none';showGame();syncUI()},fixture);
 const inside=await page.evaluate(()=>({shown:getComputedStyle(document.getElementById('hud-ways')).display,text:document.getElementById('hud-ways').innerText,chips:[...document.querySelectorAll('#hud-ways .hw-chip')].map(b=>({label:b.textContent.trim(),unexplored:b.classList.contains('hw-unexplored'),action:b.title}))}));
 assert.equal(inside.shown,'flex');assert.match(inside.text,/The Village/);assert.match(inside.text,/the tavern/);
 assert.deepEqual(inside.chips.map(c=>c.label),['out to The Village','the smithy',"Healer's Garden ?"],'inside: out, entered sibling, unexplored sibling; no road');
 assert.equal(inside.chips[2].unexplored,true);
 await page.locator('#hud-ways .hw-chip').nth(1).click();
 assert.equal(await page.evaluate(()=>document.getElementById('action-input').value),'Head to the smithy.','tap prefills');
 assert.equal(await page.evaluate(()=>document.activeElement&&document.activeElement.id),'action-input','tap focuses the input');
 assert.equal(await page.evaluate(()=>sessionLog.length),0,'tap never sends');
 await page.screenshot({path:path.join(out,'ways-tavern-desktop.png'),clip:{x:0,y:0,width:1280,height:150}});
 await page.evaluate(()=>{worldState.world.sublocation=null;document.getElementById('action-input').value='';syncUI()});
 const outside=await page.evaluate(()=>[...document.querySelectorAll('#hud-ways .hw-chip')].map(b=>b.textContent.trim()));
 assert.deepEqual(outside,['the smithy','the tavern',"Healer's Garden ?",'Marrowgate'],'outside: sub-locations then the road');
 await page.evaluate(()=>{worldState.combat={round:1,enemies:[]};syncUI()});
 assert.deepEqual(await page.evaluate(()=>[...document.querySelectorAll('#hud-ways .hw-chip')].map(b=>b.textContent.trim())),['the smithy','the tavern',"Healer's Garden ?"],'combat hides the road');
 await page.evaluate(()=>{worldState.combat=null;syncUI()});
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:path.join(out,'ways-village-mobile.png'),clip:{x:0,y:0,width:390,height:260}});
 assert.deepEqual(errors,[]);
 const receipt={result:'WAYS BROWSER GREEN',url,inside:inside.chips,outside};fs.writeFileSync(path.join(out,'ways-browser-receipt.json'),JSON.stringify(receipt,null,2));console.log(JSON.stringify(receipt));
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exit(1)});
