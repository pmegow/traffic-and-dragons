// #771 P2, a site in the real pane: the lair inside the ridge inside the mire, drawn as a cave, on a phone and in the desktop
// drawer; then a bothy in the mire, drawn as a building. Local files only; every foreign request is aborted. TND_SHOT_DIR keeps map-771-site-*.png (the visual evidence).
//   node dev/tests-771-sites-browser.js
const fs=require('fs'),os=require('os'),path=require('path'),assert=require('assert/strict');
const {chromium}=require('./cdp-browser.js');
const root=path.resolve(__dirname,'..'),shots=process.env.TND_SHOT_DIR||fs.mkdtempSync(path.join(os.tmpdir(),'tnd-map771s-'));
const types={'.html':'text/html','.css':'text/css','.js':'application/javascript','.json':'application/json','.png':'image/png','.mp3':'audio/mpeg','.ttf':'font/ttf','.webmanifest':'application/manifest+json'};
const MIRE='Petrified Mire',RIDGE='Shattered Ridge',LAIR='Wyrm Lair',BOTHY='The Reed Bothy';
function fixture(){const e=require('./load-engine.js');e.loadEngine();e.makeTestWorld();worldState.campId='map771s-browser';worldState.ver=SAVE_VER;worldState.world.location=MIRE;worldState.world.sublocation=null;worldState.turn=1;worldState.transcript=[{r:'gm',x:'You stand in the mire.',t:0}];memory.campId=worldState.campId;memory.map.nodes[MIRE]=newMapNode(0,null,{visits:1,description:'PRIVATE: a buried vault lies under the reeds.'});return JSON.parse(JSON.stringify({world:worldState,memory}));}
let fail=0,pass=0;
async function check(name,fn){try{await fn();pass++;console.log('PASS #771 sites browser '+name);}catch(e){fail++;console.error('FAIL #771 sites browser '+name+' — '+e.stack);}}
(async()=>{const fx=fixture(),browser=await chromium.launch({headless:true});try{
 const ctx=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'});
 await ctx.route('**/*',async r=>{const u=new URL(r.request().url());if(u.hostname!=='map771s.test')return r.abort();const f=path.resolve(root,'.'+decodeURIComponent(u.pathname));if(!f.startsWith(root+path.sep))return r.abort();try{return r.fulfill({status:200,contentType:types[path.extname(f)]||'application/octet-stream',body:fs.readFileSync(f)});}catch(e){return r.fulfill({status:404,body:''});}});
 await ctx.addInitScript(()=>{localStorage.setItem('tnd_ambient_enabled_v1','0');window.__mapDrawnText=[];const draw=CanvasRenderingContext2D.prototype.fillText;CanvasRenderingContext2D.prototype.fillText=function(text){window.__mapDrawnText.push(String(text));return draw.apply(this,arguments);};});
 const page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 const settle=()=>page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(()=>r(true)))));
 await page.goto('http://map771s.test/index.html');await page.waitForFunction(()=>typeof atlasSheetCaveParams==='function'&&typeof syncUI==='function'&&typeof TnDMaps==='object');
 await page.evaluate(f=>{worldState=f.world;memory=f.memory;sessionLog=[];document.getElementById('api-screen').style.display='none';generateActions=function(){};speakNarration=function(){};processPendingCompanionSheets=function(){};
  window.__mapToasts=[];const toast=showToast;showToast=function(m){__mapToasts.push(String(m));return toast.apply(this,arguments);};
  showGame();atlasCreate('771s-browser',{knowledge:true});atlasFollow();
  window.__gm=function(text){commitGmTurn(text,{userMsg:'Go on.',playerTxt:'Go on.'});syncUI();};
  __gm('You climb onto the ridge.\n[SUBLOCATION:Shattered Ridge]\n[MAP_REVEAL:new|Wyrm Lair|N|observed]\n[MAP_REVEAL:new|goat track|E|observed]');
  __gm('You squeeze into the dark.\n[SUBLOCATION:Wyrm Lair]\n[MAP_REVEAL:new|the great nest|N|observed]\n[MAP_REVEAL:new|a heap of bones|E|observed]\n[MAP_REVEAL:new|the far tunnel|W|reported]\n[MAP_REVEAL:new|a hidden hoard|unknown|reported]');
  showAtlasFull();},fx);
 await settle();await settle();
 const snap=()=>page.evaluate(()=>{const v=_atlasPane.view,d=v.doc(),sc=v.scene(),t=v.transform(),c=document.getElementById('atlas-canvas'),rc=c.getBoundingClientRect(),style=TnDMaps.style.get('ink'),labels=[];
  sc.layers.forEach(l=>l.items.forEach(x=>{if(x.t==='text'&&x.meta&&['feature','marker','portal'].includes(x.meta.kind))labels.push({kind:x.meta.kind,id:x.meta.id,text:x.text,size:style.text[x.s].size*t.k,at:[x.x*t.k+t.x+rc.left,x.y*t.k+t.y+rc.top]});}));
  const pp=atlasPartyIn(_atlasPane.zone);return {party:pp?[pp.x*t.k+t.x,pp.y*t.k+t.y]:null,gen:d.generator.name,kind:d.kind,story:!!d.story,zone:_atlasPane.zone,sub:worldState.world.sublocation,w:c.clientWidth,h:c.clientHeight,k:t.k,labels,dropped:sc.dropped.length,portals:d.portals.map(p=>[p.id,p.name]),names:(d.features||[]).map(f=>f.name),
   rows:Array.from(document.querySelectorAll('button[data-tnd-unplaced-id]')).map(b=>({id:b.getAttribute('data-tnd-unplaced-id'),text:b.textContent,size:parseFloat(getComputedStyle(b).fontSize)})),painted:window.__mapDrawnText.join('\n'),keys:atlasPaneKeyList(_atlasPane.zone).map(k=>k.name),trail:atlasTrailItems(_atlasPane.zone).map(x=>x.text),card:document.getElementById('atlas-card')?document.getElementById('atlas-card').textContent:''};});
 const inView=r=>!!r.party&&r.party[0]>=20&&r.party[1]>=20&&r.party[0]<=r.w-20&&r.party[1]<=r.h-20;
 await check('a phone opens the lair as a cave, on the party, every name readable',async()=>{
   const r=await snap();assert.equal(r.sub,RIDGE+' — '+LAIR,'the lair pinned on the ridge was filed inside it');
   assert.equal(r.gen,'dungeon');assert.equal(r.kind,'cave');assert.equal(r.story,true);assert.equal(r.dropped,0);
   assert.deepEqual(r.names,['the great nest','a heap of bones','the far tunnel']);assert.deepEqual(r.portals,[['way-1','to '+RIDGE]]);
   const party=r.labels.filter(l=>l.kind==='marker');assert.equal(party.length,1);assert.equal(party[0].text,LAIR);assert.ok(inView(r),'the party is on screen: '+JSON.stringify(r.party)+' in '+r.w+'x'+r.h);
   for(const l of r.labels)assert.ok(l.size>=13.99,l.text+' renders at '+l.size+' px');
   assert.equal(r.labels.filter(l=>l.kind==='feature').length,3,'each thing the story placed has its label');assert.equal(r.labels.filter(l=>l.kind==='portal').length,1);
   await page.screenshot({path:path.join(shots,'map-771-site-phone-390x844.png')});
 });
 await check('the cave states no distance and no level, and reads no private fact',async()=>{
   const r=await snap();assert.doesNotMatch(r.painted,/\d+ m\b|on foot|\bkm\b|level/);assert.doesNotMatch(r.painted,/PRIVATE|buried vault/);assert.match(r.painted,/Not to scale/);
 });
 await check('the plaque is the hierarchy: the mire, the ridge in it, the lair in the ridge',async()=>{
   const r=await snap();assert.deepEqual(r.trail.slice(1),[MIRE,RIDGE,LAIR]);for(const n of [MIRE,RIDGE])assert.ok(r.painted.indexOf(n)>=0,n+' is drawn on the plaque');
 });
 await check('what has no direction is a readable row that opens its card',async()=>{
   const r=await snap();assert.equal(r.rows.length,1);assert.match(r.rows[0].text,/a hidden hoard.*Reported/);assert.ok(r.rows[0].size>=14);
   const lay=await page.evaluate(()=>{const p=document.querySelector('[data-tnd-unplaced]'),s=document.getElementById('atlas-stage').getBoundingClientRect(),r=p.getBoundingClientRect(),c=document.getElementById('atlas-canvas');return {host:p.parentNode.id,top:r.top,bottom:r.bottom,stageBottom:s.bottom,stageH:s.height,canvasH:c.clientHeight,vh:innerHeight,over:!!document.getElementById('atlas-stage').querySelector('[data-tnd-unplaced]')};});assert.equal(lay.host,'atlas-list');assert.equal(lay.over,false);assert.ok(lay.top>=lay.stageBottom-0.5,'the list lies under the map, not over it: '+JSON.stringify(lay));assert.ok(lay.bottom<=lay.vh+0.5,'and on screen');assert.ok(Math.abs(lay.canvasH-lay.stageH)<1&&lay.stageH>200,'the map keeps the rest of the pane');
   const card=await page.evaluate(id=>{document.querySelector('button[data-tnd-unplaced-id="'+id+'"]').click();return document.getElementById('atlas-card').textContent;},r.rows[0].id);
   assert.match(card,/a hidden hoard/);assert.match(card,/Position not established/);
 });
 await check('a real tap on a named chamber opens the thing\'s card; the arrow keys reach every thing',async()=>{
   const r=await snap(),nest=r.labels.filter(l=>l.text==='the great nest')[0];assert.ok(nest);
   await page.evaluate(p=>{const c=document.getElementById('atlas-canvas');atlasPaneTap(null);['mousedown','mouseup'].forEach(t=>c.dispatchEvent(new MouseEvent(t,{bubbles:true,cancelable:true,clientX:p[0],clientY:p[1],button:0})));},[nest.at[0],nest.at[1]-3]);await settle();
   const after=await snap();assert.match(after.card,/the great nest/);assert.match(after.card,/Observed/);
   assert.deepEqual(after.keys.slice().sort(),['a heap of bones','a hidden hoard','the far tunnel','the great nest','to '+RIDGE].sort());
 });
 await check('the mouth opens the ridge; the ridge\'s pin for the lair opens the lair again',async()=>{
   const got=await page.evaluate(()=>{atlasPaneTap({id:'way-1'});const card=document.getElementById('atlas-card'),btn=card.querySelector('[data-act="open"]'),text=card.textContent;if(btn)btn.click();return {text:text,had:!!btn};});await settle();await settle();
   assert.equal(got.had,true);assert.match(got.text,/The way to Shattered Ridge/);
   let r=await snap();assert.equal(r.gen,'wild');assert.equal(r.kind,'mountain');assert.ok(r.names.indexOf(LAIR)>=0,'the lair is a thing on the ridge');assert.equal(r.labels.filter(l=>l.kind==='marker').length,0,'the party is not on the ridge');for(const l of r.labels)assert.ok(l.size>=13.99,'opened from a card, '+l.text+' renders at '+l.size+' px');
   await page.screenshot({path:path.join(shots,'map-771-site-ridge-390x844.png')});
   const back=await page.evaluate(()=>{const d=_atlasPane.view.doc(),pin=d.features.filter(f=>f.name==='Wyrm Lair')[0];atlasPaneTap({id:pin.id});const btn=document.getElementById('atlas-card').querySelector('[data-act="open"]');if(btn)btn.click();return !!btn;});await settle();await settle();
   assert.equal(back,true);r=await snap();assert.equal(r.kind,'cave');assert.equal(r.labels.filter(l=>l.kind==='marker').length,1);
 });
 await check('leaving steps out one place: the lair to the ridge, the ridge to the mire',async()=>{
   let sub=await page.evaluate(()=>{__gm('You climb back out.\n[SUBLOCATION_LEAVE]');return worldState.world.sublocation;});assert.equal(sub,RIDGE);
   sub=await page.evaluate(()=>{__gm('You climb back in.\n[SUBLOCATION:Wyrm Lair]');return worldState.world.sublocation;});assert.equal(sub,RIDGE+' — '+LAIR);
   await page.evaluate(()=>{atlasPaneShow(worldState.atlas.at,true);});await settle();await settle();const r=await snap();assert.equal(r.kind,'cave');assert.deepEqual(r.names,['the great nest','a heap of bones','the far tunnel'],'nothing moved while the party was out');
 });
 await check('a phone opens the bothy as a building: nameless rooms, the things the story named, the door back to the mire',async()=>{
   await page.evaluate(()=>{__gm('You climb out of the dark.\n[SUBLOCATION_LEAVE]');__gm('Down to the reeds.\n[SUBLOCATION_LEAVE]');__gm('A roof shows through the reeds.\n[MAP_REVEAL:new|The Reed Bothy|E|observed]');
    __gm('You duck inside.\n[SUBLOCATION:The Reed Bothy]\n[MAP_REVEAL:new|a cold hearth|N|observed]\n[MAP_REVEAL:new|a narrow cot|E|observed]\n[MAP_REVEAL:new|a root cellar|unknown|reported]');atlasPaneShow(worldState.atlas.at,true);});
   await settle();await settle();await settle();
   const r=await snap();assert.equal(r.sub,BOTHY);assert.equal(r.gen,'interior');assert.equal(r.kind,'house');assert.equal(r.story,true);assert.equal(r.dropped,0);
   assert.deepEqual(r.names,['a cold hearth','a narrow cot']);assert.deepEqual(r.portals,[['way-1','to '+MIRE]]);
   const party=r.labels.filter(l=>l.kind==='marker');assert.equal(party.length,1);assert.equal(party[0].text,BOTHY);assert.ok(inView(r),'the party is on screen: '+JSON.stringify(r.party)+' in '+r.w+'x'+r.h);
   for(const l of r.labels)assert.ok(l.size>=13.99,l.text+' renders at '+l.size+' px');
   assert.equal(r.labels.filter(l=>l.kind==='feature').length,2);assert.equal(r.labels.filter(l=>l.kind==='portal').length,1);
   assert.doesNotMatch(r.painted,/Ground floor|m²|\bKitchen\b|\bStoreroom\b/);assert.equal(r.rows.length,1);assert.match(r.rows[0].text,/a root cellar/);
   assert.deepEqual(r.trail.slice(1),[MIRE,BOTHY]);
   await page.screenshot({path:path.join(shots,'map-771-building-phone-390x844.png')});
   const got=await page.evaluate(()=>{atlasPaneTap({id:'way-1'});const card=document.getElementById('atlas-card'),btn=card.querySelector('[data-act="open"]');return {text:card.textContent,had:!!btn};});
   assert.match(got.text,/The way to Petrified Mire/);assert.equal(got.had,true,'the door opens the mire');
   const sub=await page.evaluate(()=>{__gm('Out into the reeds.\n[SUBLOCATION_LEAVE]');__gm('Up the ridge.\n[SUBLOCATION:Shattered Ridge]');__gm('Into the dark again.\n[SUBLOCATION:Wyrm Lair]');atlasPaneShow(worldState.atlas.at,true);return worldState.world.sublocation;});await settle();await settle();assert.equal(sub,RIDGE+' — '+LAIR,'back in the lair for the checks that follow');
 });
 await page.setViewportSize({width:1280,height:840});
 await check('the desktop drawer shows the same cave, readable, with the party in view',async()=>{
   await page.evaluate(()=>{atlasPaneClose();showAtlas();});await settle();await settle();await settle();
   const r=await snap();assert.equal(r.kind,'cave');assert.equal(r.dropped,0);for(const l of r.labels)assert.ok(l.size>=13.99,l.text+' renders at '+l.size+' px');
   assert.ok(inView(r),'party on screen in the drawer: '+JSON.stringify(r.party)+' in '+r.w+'x'+r.h);
   const lay=await page.evaluate(()=>{const p=document.querySelector('[data-tnd-unplaced]'),s=document.getElementById('atlas-stage').getBoundingClientRect(),r=p.getBoundingClientRect(),c=document.getElementById('atlas-canvas');return {host:p.parentNode.id,top:r.top,bottom:r.bottom,stageBottom:s.bottom,stageH:s.height,canvasH:c.clientHeight,vh:innerHeight,over:!!document.getElementById('atlas-stage').querySelector('[data-tnd-unplaced]')};});assert.equal(lay.host,'atlas-list');assert.equal(lay.over,false);assert.ok(lay.top>=lay.stageBottom-0.5,'the list lies under the map, not over it: '+JSON.stringify(lay));assert.ok(lay.bottom<=lay.vh+0.5,'and on screen');assert.ok(Math.abs(lay.canvasH-lay.stageH)<1&&lay.stageH>200,'the map keeps the rest of the pane');
   await page.screenshot({path:path.join(shots,'map-771-site-drawer-1280x840.png')});
 });
 await check('no unexpected browser exceptions or map warnings',async()=>{assert.deepEqual(errors,[]);assert.deepEqual(await page.evaluate(()=>__mapToasts.filter(t=>/fail|could not|overlap/i.test(t))),[]);});
 console.log('Screenshots: '+shots);
 }finally{await browser.close();}
 console.log((fail?'FAILED':'ALL GREEN')+' — '+pass+' #771 sites browser groups, '+fail+' failures');if(fail)process.exitCode=1;
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
