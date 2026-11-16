// #771 P1, the drawn place sheet in the real pane: a phone and the desktop drawer. Local files only; every foreign
// request is aborted. TND_SHOT_DIR keeps map-771-*.png (the screenshots are the visual evidence).
//   node dev/tests-771-place-sheet-browser.js
const fs=require('fs'),os=require('os'),path=require('path'),assert=require('assert/strict');
const {chromium}=require('./cdp-browser.js');
const root=path.resolve(__dirname,'..'),shots=process.env.TND_SHOT_DIR||fs.mkdtempSync(path.join(os.tmpdir(),'tnd-map771-'));
const types={'.html':'text/html','.css':'text/css','.js':'application/javascript','.json':'application/json','.png':'image/png','.mp3':'audio/mpeg','.ttf':'font/ttf','.webmanifest':'application/manifest+json'};
const MIRE='Petrified Mire',CROSS='The Crossroads of Ashenveil';
function fixture(){const e=require('./load-engine.js');e.loadEngine();e.makeTestWorld();worldState.campId='map771-browser';worldState.ver=SAVE_VER;worldState.world.location=CROSS;worldState.world.sublocation=null;worldState.turn=1;worldState.transcript=[{r:'gm',x:'You stand at the crossroads.',t:0}];memory.campId=worldState.campId;memory.map.nodes[CROSS]=newMapNode(0,null,{visits:1,description:'PRIVATE: a buried vault lies under the flagstones.'});return JSON.parse(JSON.stringify({world:worldState,memory}));}
let fail=0,pass=0;
async function check(name,fn){try{await fn();pass++;console.log('PASS #771 browser '+name);}catch(e){fail++;console.error('FAIL #771 browser '+name+' — '+e.stack);}}
(async()=>{const fx=fixture(),browser=await chromium.launch({headless:true});try{
 const ctx=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'});
 await ctx.route('**/*',async r=>{const u=new URL(r.request().url());if(u.hostname!=='map771.test')return r.abort();const f=path.resolve(root,'.'+decodeURIComponent(u.pathname));if(!f.startsWith(root+path.sep))return r.abort();try{return r.fulfill({status:200,contentType:types[path.extname(f)]||'application/octet-stream',body:fs.readFileSync(f)});}catch(e){return r.fulfill({status:404,body:''});}});
 await ctx.addInitScript(()=>{localStorage.setItem('tnd_ambient_enabled_v1','0');window.__mapDrawnText=[];const draw=CanvasRenderingContext2D.prototype.fillText;CanvasRenderingContext2D.prototype.fillText=function(text){window.__mapDrawnText.push(String(text));return draw.apply(this,arguments);};});
 const page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 const settle=()=>page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(()=>r(true)))));
 await page.goto('http://map771.test/index.html');await page.waitForFunction(()=>typeof atlasSheetRecipe==='function'&&typeof syncUI==='function'&&typeof TnDMaps==='object');
 await page.evaluate(f=>{worldState=f.world;memory=f.memory;sessionLog=[];document.getElementById('api-screen').style.display='none';generateActions=function(){};speakNarration=function(){};processPendingCompanionSheets=function(){};if(typeof atlasDirectionsSettle==='function')atlasDirectionsSettle=function(){return Promise.resolve();};window.__mapToasts=[];const toast=showToast;showToast=function(m){__mapToasts.push(String(m));return toast.apply(this,arguments);};
  showGame();atlasCreate('771-browser',{knowledge:true});atlasFollow();
  window.__go=function(world){const from=worldState.world.location;worldState.turn++;worldState.world.location=world;worldState.world.sublocation=null;if(!memory.map.nodes[world])memory.map.nodes[world]=newMapNode(worldState.turn,null);memory.map.nodes[world].visits++;memory.map.edges.push({from:from,to:world,turn:worldState.turn});atlasFollow();syncUI();};
  __go('Petrified Mire');
  commitGmTurn('The mire spreads around you.\n[MAP_REVEAL:new|sunken pool|W|observed]\n[MAP_REVEAL:new|bone cairn|E|observed]\n[MAP_REVEAL:new|frozen trail|S|observed]\n[MAP_REVEAL:new|towers of Ashenveil|S|reported]\n[MAP_REVEAL:new|a secret aqueduct|unknown|reported]',{userMsg:'Look around.',playerTxt:'Look around.'});
  syncUI();showAtlasFull();},fx);
 await settle();await settle();
 const snap=()=>page.evaluate(()=>{const v=_atlasPane.view,d=v.doc(),sc=v.scene(),t=v.transform(),c=document.getElementById('atlas-canvas'),style=TnDMaps.style.get('ink'),labels=[];
  sc.layers.forEach(l=>l.items.forEach(x=>{if(x.t==='text'&&x.meta&&['feature','marker','portal'].includes(x.meta.kind))labels.push({kind:x.meta.kind,id:x.meta.id,text:x.text,size:style.text[x.s].size*t.k,box:x.box&&[x.box[0]*t.k+t.x,x.box[1]*t.k+t.y,x.box[2]*t.k+t.x,x.box[3]*t.k+t.y]});}));
  const pp=atlasPartyIn(_atlasPane.zone);return {party:pp?[pp.x*t.k+t.x,pp.y*t.k+t.y]:null,gen:d.generator.name,ground:d.kind,zone:_atlasPane.zone,w:c.clientWidth,h:c.clientHeight,k:t.k,labels,dropped:sc.dropped.length,exits:d.portals.map(p=>[p.id,p.name,p.bearing,p.sure]),names:d.features.map(f=>f.name),rows:Array.from(document.querySelectorAll('button[data-tnd-unplaced-id]')).map(b=>({id:b.getAttribute('data-tnd-unplaced-id'),text:b.textContent,size:parseFloat(getComputedStyle(b).fontSize)})),keys:atlasPaneKeyList(_atlasPane.zone).map(x=>x.name),painted:__mapDrawnText.join('\n'),card:(document.getElementById('atlas-card')||{}).textContent||'',public:JSON.stringify({d,svg:TnDMaps.renderSVG(sc),digest:TnDMaps.digest(d),where:atlasWhere(),prompt:atlasMapBlock()})};});
 const inView=r=>!!r.party&&r.party[0]>=20&&r.party[1]>=20&&r.party[0]<=r.w-20&&r.party[1]<=r.h-20;
 await check('a phone opens the drawn sheet on the party with every label it shows readable',async()=>{
   const r=await snap();assert.equal(r.gen,'wild');assert.equal(r.ground,'marsh');assert.equal(r.dropped,0);
   assert.deepEqual(r.names,['sunken pool','bone cairn','frozen trail','towers of Ashenveil']);assert.deepEqual(r.exits,[['way-1','The Crossroads of Ashenveil','N',false]]);
   const party=r.labels.filter(l=>l.kind==='marker');assert.equal(party.length,1);assert.equal(party[0].text,'Petrified Mire');assert.ok(inView(r),'the party is on screen: '+JSON.stringify(r.party)+' in '+r.w+'x'+r.h);
   for(const l of r.labels)assert.ok(l.size>=13.99,l.text+' renders at '+l.size+' px');
   assert.ok(r.labels.filter(l=>l.kind==='feature').length>=4,'each drawn thing has its label');
   await page.screenshot({path:path.join(shots,'map-771-phone-390x844.png')});
 });
 await check('the sheet states no distance and reads no private fact',async()=>{
   const r=await snap();assert.doesNotMatch(r.painted+r.public,/\d+ m\b|kmPerUnit|on foot|\bkm\b/);assert.doesNotMatch(r.painted+r.public,/PRIVATE|buried vault/);assert.match(r.painted,/Not to scale/);
 });
 await check('what has no direction is a readable row that opens its card without moving the map',async()=>{
   const r=await snap();assert.equal(r.rows.length,1);assert.match(r.rows[0].text,/a secret aqueduct.*Reported/);assert.ok(r.rows[0].size>=14);
   const got=await page.evaluate(id=>{const v=_atlasPane.view,before=JSON.stringify(v.transform());document.querySelector('button[data-tnd-unplaced-id="'+id+'"]').click();return {same:JSON.stringify(v.transform())===before,card:document.getElementById('atlas-card').textContent};},r.rows[0].id);
   assert.equal(got.same,true);assert.match(got.card,/a secret aqueduct/);assert.match(got.card,/Position not established/);
 });
 await check('the arrow keys reach every thing: the exit, each drawn thing and the listed one',async()=>{
   const r=await snap();assert.deepEqual(r.keys.slice().sort(),['The Crossroads of Ashenveil','a secret aqueduct','bone cairn','frozen trail','sunken pool','towers of Ashenveil']);
 });
 await check('the exit opens the place it leads to, whose own exit leads back; the party button returns',async()=>{
   const got=await page.evaluate(()=>{atlasPaneTap({id:'way-1'});const card=document.getElementById('atlas-card'),btn=card.querySelector('[data-act="open"]');const text=card.textContent;if(btn)btn.click();return {text:text,had:!!btn};});await settle();await settle();
   assert.equal(got.had,true);assert.match(got.text,/The way to The Crossroads of Ashenveil/);assert.match(got.text,/never stated/);
   const r=await snap();assert.equal(r.gen,'wild');assert.equal(r.ground,'heath');assert.deepEqual(r.exits,[['way-1','Petrified Mire','S',false]]);assert.equal(r.labels.filter(l=>l.kind==='marker').length,0,'the party is not on this sheet');
   await page.screenshot({path:path.join(shots,'map-771-crossroads-390x844.png')});
   await page.locator('#atlas-party').click();await settle();await settle();const back=await snap();assert.equal(back.ground,'marsh');assert.equal(back.labels.filter(l=>l.kind==='marker').length,1);
 });
 await check('a new discovery and a new way land on the open sheet without moving what stood',async()=>{
   const before=await page.evaluate(()=>_atlasPane.view.doc().features.map(f=>[f.id,f.x,f.y]));
   await page.evaluate(()=>{commitGmTurn('A grove of stone trees.\n[MAP_REVEAL:new|calcified grove|NE|observed]',{userMsg:'Look north-east.',playerTxt:'Look north-east.'});__go('Shattered Hills');__go('Petrified Mire');});await settle();await settle();
   const r=await page.evaluate(()=>({feats:_atlasPane.view.doc().features.map(f=>[f.id,f.x,f.y]),exits:_atlasPane.view.doc().portals.map(p=>p.name)}));
   assert.deepEqual(r.feats.slice(0,before.length),before);assert.equal(r.feats.length,before.length+1);assert.deepEqual(r.exits,['The Crossroads of Ashenveil','Shattered Hills']);
 });
 await page.setViewportSize({width:1280,height:840});
 await check('the desktop drawer shows the same sheet, readable, with the party in view',async()=>{
   await page.evaluate(()=>{atlasPaneClose();showAtlas();});await settle();await settle();await settle();
   const r=await snap();assert.equal(r.gen,'wild');assert.equal(r.dropped,0);for(const l of r.labels)assert.ok(l.size>=13.99,l.text+' renders at '+l.size+' px');
   assert.ok(inView(r),'party on screen in the drawer: '+JSON.stringify(r.party)+' in '+r.w+'x'+r.h);
   await page.screenshot({path:path.join(shots,'map-771-drawer-1280x840.png')});
 });
 await check('no unexpected browser exceptions or map warnings',async()=>{assert.deepEqual(errors,[]);assert.deepEqual(await page.evaluate(()=>__mapToasts.filter(t=>/fail|could not|overlap/i.test(t))),[]);});
 console.log('Screenshots: '+shots);
 }finally{await browser.close();}
 console.log((fail?'FAILED':'ALL GREEN')+' — '+pass+' #771 browser groups, '+fail+' failures');if(fail)process.exitCode=1;
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
