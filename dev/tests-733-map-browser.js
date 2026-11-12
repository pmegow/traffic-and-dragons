// #733 public atlas integration: real committed narration, drawer and phone rendering.
// Local files only; every foreign request is aborted and narration/action calls are stubbed.
// TND_SHOT_DIR preserves map-733-*.png; screenshots are required visual review evidence.
const fs=require('fs'),os=require('os'),path=require('path'),assert=require('assert/strict');
const {chromium}=require('./cdp-browser.js');
const root=path.resolve(__dirname,'..'),shots=process.env.TND_SHOT_DIR||fs.mkdtempSync(path.join(os.tmpdir(),'tnd-map733-'));
const types={'.html':'text/html','.css':'text/css','.js':'application/javascript','.json':'application/json','.png':'image/png','.mp3':'audio/mpeg','.ttf':'font/ttf','.webmanifest':'application/manifest+json'};
function fixture(){const e=require('./load-engine.js');e.loadEngine();e.makeTestWorld();worldState.world.location='The Boundary Clearing';worldState.world.sublocation=null;worldState.transcript=[{r:'gm',x:'You stand beside the First Pact stones.',t:0}];memory.map.nodes['The Boundary Clearing']=newMapNode(0,null,{description:'PRIVATE: Stalgind\'s Hut has a secret cellar.'});return JSON.parse(JSON.stringify({world:worldState,memory}));}
let fail=0,pass=0;
async function check(name,fn){try{await fn();pass++;console.log('PASS #733 browser '+name);}catch(e){fail++;console.error('FAIL #733 browser '+name+' — '+e.stack);}}
(async()=>{const fx=fixture(),browser=await chromium.launch({headless:true});try{
 const ctx=await browser.newContext({viewport:{width:1280,height:840},serviceWorkers:'block'});
 await ctx.route('**/*',async r=>{const u=new URL(r.request().url());if(u.hostname!=='map733.test')return r.abort();const f=path.resolve(root,'.'+decodeURIComponent(u.pathname));if(!f.startsWith(root+path.sep))return r.abort();try{return r.fulfill({status:200,contentType:types[path.extname(f)]||'application/octet-stream',body:fs.readFileSync(f)});}catch(e){return r.fulfill({status:404,body:''});}});
 await ctx.addInitScript(()=>{localStorage.setItem('tnd_ambient_enabled_v1','0');window.__mapDrawnText=[];const draw=CanvasRenderingContext2D.prototype.fillText;CanvasRenderingContext2D.prototype.fillText=function(text){window.__mapDrawnText.push(String(text));return draw.apply(this,arguments);};});
 const page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 const settle=()=>page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(()=>r(true)))));
 await page.goto('http://map733.test/index.html');await page.waitForFunction(()=>typeof atlasPublicEnable==='function'&&typeof syncUI==='function'&&typeof TnDMaps==='object');
 await check('vendored library exposes the required public boundary',async()=>{assert.equal(await page.evaluate(()=>typeof TnDMaps.schematic),'function','TnDMaps.schematic must be vendored before activation');});
 if(fail)throw new Error('Public library boundary unavailable');
 await page.evaluate(f=>{worldState=f.world;memory=f.memory;sessionLog=[];document.getElementById('api-screen').style.display='none';generateActions=function(){};speakNarration=function(){};processPendingCompanionSheets=function(){};window.__mapToasts=[];const toast=showToast;showToast=function(m){__mapToasts.push(String(m));return toast.apply(this,arguments);};showGame();atlasCreate('733-browser');atlasFollow();syncUI();showAtlas();},fx);
 await settle();
 await check('activation clears an open private pane even when public drawing fails',async()=>{
   const before=await page.evaluate(()=>!!_atlasPane&&_atlasPane.view.doc().generator.name);assert.notEqual(before,'schematic');assert.ok(before);
   await page.evaluate(()=>{window.__realSchematic=TnDMaps.schematic;TnDMaps.schematic=function(){throw new Error('injected public drawing failure');};window.__activation=atlasPublicEnable();syncUI();});await settle();
   const got=await page.evaluate(()=>({enabled:__activation.ok,privatePane:!!_atlasPane&&_atlasPane.view.doc().generator.name!=='schematic',canvases:document.querySelectorAll('#atlas-canvas').length,toasts:__mapToasts.slice()}));
   assert.equal(got.enabled,true);assert.equal(got.privatePane,false,'the previously private drawing must not survive the knowledge-mode switch');assert.equal(got.canvases,0,'a failed first public draw must leave no old canvas');assert.ok(got.toasts.some(x=>/injected public drawing failure/.test(x)));
   await page.screenshot({path:path.join(shots,'map-733-activation-refused.png')});
   await page.evaluate(()=>{TnDMaps.schematic=__realSchematic;document.querySelectorAll(".tnd-toast").forEach(e=>e.remove());atlasForget();showAtlas();});await settle();
 });
 // Exercise the real pane at exact narrow/tall dimensions without replacing its markup or drawing code.
 const sizeStage=async(width,height)=>{await page.evaluate(s=>{let st=document.getElementById('map733-stage-size');if(!st){st=document.createElement('style');st.id='map733-stage-size';document.head.appendChild(st);}st.textContent='#atlas-dock{position:fixed!important;right:0!important;top:48px!important;width:'+s.width+'px!important;height:'+s.height+'px!important;z-index:80!important;display:flex!important;flex-direction:column!important;background:var(--bg1)} #atlas-stage{width:'+s.width+'px!important;height:'+s.height+'px!important;flex:none!important}';_atlasPane.size=null;atlasDockResized();atlasPaneFrame({party:atlasPartyIn(worldState.atlas.seed)});}, {width,height});await settle();};
 await sizeStage(460,740);
 await check('empty player map withholds private names from every public reader',async()=>{
   const r=await page.evaluate(()=>{const id=worldState.atlas.seed,d=atlasDoc(id),sc=TnDMaps.scene.build(d,'ink'),svg=TnDMaps.renderSVG(sc);return {features:d.features.length,keys:atlasPaneKeyList(id),card:atlasCard(id,{id:'hut-1'}),readers:JSON.stringify({d,svg,digest:TnDMaps.digest(d),where:atlasWhere(),trail:atlasTrailItems(id),zones:atlasZones(),prompt:atlasMapBlock(),tableTalk:buildGeoBlock('player')}),geometry:sc.layers.filter(l=>l.name==='features').map(l=>l.items).flat().length};});
   assert.equal(r.features,0);assert.equal(r.geometry,0);assert.deepEqual(r.keys,[]);assert.equal(r.card,null);assert.doesNotMatch(r.readers,/Stalgind|secret cellar|PRIVATE/);assert.doesNotMatch(r.readers,/\d+ m\b|on foot|kmPerUnit/);
 });
 await check('three stationary narrated landmarks update the open drawer immediately',async()=>{
   const r=await page.evaluate(()=>{const before=JSON.stringify(worldState.world),id=worldState.atlas.seed,doc=atlasDoc(id);window.__mapDrawnText=[];commitGmTurn('You remain beside the First Pact stones.\n[MAP_REVEAL:new|Bear Spring|spring|SW|observed]\n[MAP_REVEAL:new|The Boar Tree|tree|N|observed]\n[MAP_REVEAL:new|The Waystone Arch|arch|S|observed]',{userMsg:'Look around without moving.',playerTxt:'Look around without moving.'});syncUI();return {before,after:JSON.stringify(worldState.world),replaced:doc!==atlasDoc(id),shown:_atlasPane.view.doc().features.map(f=>f.name),keys:atlasPaneKeyList(id).map(f=>f.name),transcript:worldState.transcript[worldState.transcript.length-1].x};});await settle();
   assert.equal(r.after,r.before);assert.equal(r.replaced,true);assert.deepEqual(r.shown,['Bear Spring','The Boar Tree','The Waystone Arch']);assert.equal(r.keys.length,3);assert.match(r.transcript,/You see Bear Spring/);
   const drawn=await page.evaluate(()=>__mapDrawnText.join('\n'));for(const name of r.shown)assert.ok(drawn.includes(name),'Canvas actually drew '+name);assert.doesNotMatch(drawn,/Stalgind|secret cellar/);
   await page.screenshot({path:path.join(shots,'map-733-stationary-460x740.png')});
 });
 async function visibleLabels(){return page.evaluate(()=>{const v=_atlasPane.view,d=v.doc(),sc=TnDMaps.scene.build(d,'ink'),t=v.transform(),c=document.getElementById('atlas-canvas'),cs=[];sc.layers.forEach(l=>l.items.forEach(x=>{if(x.t==='text'&&x.meta&&x.meta.kind==='feature')cs.push({name:x.text,box:x.box&&[x.box[0]*t.k+t.x,x.box[1]*t.k+t.y,x.box[2]*t.k+t.x,x.box[3]*t.k+t.y],size:(x.size||0)*t.k});}));return {w:c.clientWidth,h:c.clientHeight,labels:cs,dropped:sc.dropped,transform:t};});}
 await check('the tall drawer keeps all three labels on screen',async()=>{const r=await visibleLabels();assert.equal(r.w,460);assert.equal(r.h,740);assert.equal(r.dropped.length,0);assert.equal(r.labels.length,3);for(const x of r.labels){assert.ok(x.box&&x.box[0]>=0&&x.box[1]>=0&&x.box[2]<=r.w&&x.box[3]<=r.h,'visible label '+JSON.stringify(x));}});
 await check('a generic hut does not reveal its owner until a public name update',async()=>{
   await page.evaluate(()=>{commitGmTurn('[MAP_REVEAL:new|a hut|hut|unknown|observed]',{userMsg:'Look across the clearing.',playerTxt:'Look across the clearing.'});syncUI();});await settle();
   const r=await page.evaluate(()=>{const id=worldState.atlas.seed,d=atlasDoc(id),f=d.features.find(f=>f.name==='a hut');atlasPaneTap({id:f.id});return {id:f.id,unplaced:f.unplaced,card:document.getElementById('atlas-card').textContent,export:TnDMaps.renderSVG(TnDMaps.scene.build(d,'ink')),prompt:atlasMapBlock()};});assert.equal(r.unplaced,true);assert.doesNotMatch(r.card+r.export+r.prompt,/Stalgind|secret cellar/);assert.match(r.card,/Position not established/);
   await page.evaluate(id=>{atlasPaneTap(null);commitGmTurn('[MAP_REVEAL:'+id+'|Reedkeeper\'s Hut|hut|unknown|observed]',{userMsg:'Ask the guide whose hut it is.',playerTxt:'Ask the guide whose hut it is.'});syncUI();},r.id);
   const renamed=await page.evaluate(id=>atlasDoc(worldState.atlas.seed).features.filter(f=>f.id===id).map(f=>f.name),r.id);assert.deepEqual(renamed,["Reedkeeper's Hut"]);
 });
 await check('notes and exports retain stable feature identity after a place alias',async()=>{
   const r=await page.evaluate(()=>{const id=worldState.atlas.seed,f=atlasDoc(id).features[0];atlasNoteSet(id,f.id,'Return here with the guide.');memory.map.nodes['The Pact Clearing']=newMapNode(worldState.turn,null);locMerge('The Pact Clearing','The Boundary Clearing',{muts:[],turn:worldState.turn});atlasFollow();syncUI();return {features:atlasDoc(id).features.map(f=>f.name),note:atlasCard(id,{id:f.id}).note,svg:TnDMaps.renderSVG(TnDMaps.scene.build(atlasDoc(id),'ink')),keys:atlasPaneKeyList(id).length};});assert.equal(r.features.length,4);assert.equal(r.keys,4);assert.equal(r.note,'Return here with the guide.');assert.match(r.svg,/Bear Spring/);assert.doesNotMatch(r.svg,/Stalgind|secret cellar/);
 });
 await page.setViewportSize({width:390,height:844});await sizeStage(390,740);
 await check('the phone keeps the public drawing, unknown-position list and cards usable',async()=>{
   const r=await visibleLabels();assert.equal(r.w,390);assert.equal(r.h,740);assert.equal(r.labels.length,4);assert.equal(r.dropped.length,0);for(const x of r.labels)assert.ok(x.box&&x.box[0]>=0&&x.box[2]<=r.w&&x.box[1]>=0&&x.box[3]<=r.h,'phone visible label '+JSON.stringify(x));
   await page.screenshot({path:path.join(shots,'map-733-phone-390x740.png')});
   const c=await page.evaluate(()=>{atlasPaneKeyStep(1);const r=document.getElementById('atlas-card').getBoundingClientRect(),s=document.getElementById('atlas-stage').getBoundingClientRect();return {text:document.getElementById('atlas-card').textContent,inside:r.left>=s.left&&r.right<=s.right&&r.top>=s.top&&r.bottom<=s.bottom};});assert.equal(c.inside,true);assert.doesNotMatch(c.text,/Stalgind|secret cellar/);
 });
 await check('crowded public labels produce one actionable warning per unchanged drawing',async()=>{
   const r=await page.evaluate(()=>{window.__mapToasts=[];for(let batch=0;batch<2;batch++){const lines=[];for(let i=0;i<12;i++)lines.push('[MAP_REVEAL:new|Northern landmark '+(batch*12+i)+'|tree|N|observed]');commitGmTurn(lines.join('\n'),{userMsg:'Study the northern ridge.',playerTxt:'Study the northern ridge.'});syncUI();}const id=worldState.atlas.seed,scene=TnDMaps.scene.build(atlasDoc(id),'ink'),first=__mapToasts.slice();atlasPaneShow(id,false);atlasPaneShow(id,false);syncUI();return {dropped:scene.dropped.length,first,after:__mapToasts.slice(),keys:atlasPaneKeyList(id).length,features:atlasDoc(id).features.length};});
   await settle();await page.screenshot({path:path.join(shots,'map-733-dense-labels.png')});
   assert.ok(r.dropped>1,'the failure fixture must actually lose several colliding labels');assert.equal(r.keys,r.features,'every dropped label remains reachable by keyboard');assert.ok(r.first.some(t=>t.includes(String(r.dropped))&&/Arrow keys|select a symbol/i.test(t)),'warning names the dropped count and how to read all features: '+JSON.stringify(r.first));assert.deepEqual(r.after,r.first,'redrawing the same pane signature must not flood warnings');
 });
 await check('proposed landmark kinds never become public glyphs or receipt assertions',async()=>{
   const r=await page.evaluate(()=>{atlasPaneTap(null);memory.map.geography=MapKnowledge.create();atlasForget();document.querySelectorAll('.tnd-toast').forEach(e=>e.remove());commitGmTurn('[MAP_REVEAL:new|High canopy stairs|arch|N|observed]\n[MAP_REVEAL:new|Crossing shallows|spring|SW|observed]\n[MAP_REVEAL:new|Ventilation stair|ruin|E|reported]',{userMsg:'Inspect the named landmarks.',playerTxt:'Inspect the named landmarks.'});syncUI();const id=worldState.atlas.seed,d=atlasDoc(id);return {kinds:d.features.map(f=>f.kind),names:d.features.map(f=>f.name),publicText:JSON.stringify({d,digest:TnDMaps.digest(d),svg:TnDMaps.renderSVG(TnDMaps.scene.build(d,'ink')),cards:d.features.map(f=>atlasCard(id,{id:f.id})),projection:atlasKnowledgeProjection(),narration:worldState.transcript[worldState.transcript.length-1].x})};});await settle();
   assert.deepEqual(r.kinds,['landmark','landmark','landmark']);assert.doesNotMatch(r.publicText,/\b(?:arch|spring|ruin)\b/i);const v=await visibleLabels();assert.equal(v.labels.length,3);assert.equal(v.dropped.length,0);for(const x of v.labels)assert.ok(x.box&&x.box[0]>=0&&x.box[2]<=v.w&&x.box[1]>=0&&x.box[3]<=v.h,'neutral phone label '+JSON.stringify(x));await page.screenshot({path:path.join(shots,'map-733-neutral-points-390x740.png')});
 });
 await check('no unexpected browser exceptions',async()=>assert.deepEqual(errors,[]));
 console.log('Screenshots: '+shots);
 }finally{await browser.close();}
 console.log((fail?'FAILED':'ALL GREEN')+' — '+pass+' #733 browser groups, '+fail+' failures');if(fail)process.exitCode=1;
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
