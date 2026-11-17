// #771 P3, the region in the real pane: three world places set on the generated ground under the fog of war, on a phone
// and in the desktop drawer. Local files only; every foreign request is aborted. TND_SHOT_DIR keeps map-771-region-*.png.
//   node dev/tests-771-region-browser.js
const fs=require('fs'),os=require('os'),path=require('path'),assert=require('assert/strict');
const {chromium}=require('./cdp-browser.js');
const root=path.resolve(__dirname,'..'),shots=process.env.TND_SHOT_DIR||fs.mkdtempSync(path.join(os.tmpdir(),'tnd-map771r-'));
const types={'.html':'text/html','.css':'text/css','.js':'application/javascript','.json':'application/json','.png':'image/png','.mp3':'audio/mpeg','.ttf':'font/ttf','.webmanifest':'application/manifest+json'};
const MIRE='Petrified Mire',RIDGE='Shattered Ridge',HEART='The Ironwood Heart',REGION='The region';
function fixture(){const e=require('./load-engine.js');e.loadEngine();e.makeTestWorld();worldState.campId='map771r-browser';worldState.ver=SAVE_VER;worldState.world.location=MIRE;worldState.world.sublocation=null;worldState.turn=1;worldState.transcript=[{r:'gm',x:'You stand in the mire.',t:0}];memory.campId=worldState.campId;memory.map.nodes[MIRE]=newMapNode(0,null,{visits:1,description:'PRIVATE: a buried vault lies under the reeds.'});return JSON.parse(JSON.stringify({world:worldState,memory}));}
let fail=0,pass=0;
async function check(name,fn){try{await fn();pass++;console.log('PASS #771 region browser '+name);}catch(e){fail++;console.error('FAIL #771 region browser '+name+' — '+e.stack);}}
(async()=>{const fx=fixture(),browser=await chromium.launch({headless:true});try{
 const ctx=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'});
 await ctx.route('**/*',async r=>{const u=new URL(r.request().url());if(u.hostname!=='map771r.test')return r.abort();const f=path.resolve(root,'.'+decodeURIComponent(u.pathname));if(!f.startsWith(root+path.sep))return r.abort();try{return r.fulfill({status:200,contentType:types[path.extname(f)]||'application/octet-stream',body:fs.readFileSync(f)});}catch(e){return r.fulfill({status:404,body:''});}});
 await ctx.addInitScript(()=>{localStorage.setItem('tnd_ambient_enabled_v1','0');window.__mapDrawnText=[];const draw=CanvasRenderingContext2D.prototype.fillText;CanvasRenderingContext2D.prototype.fillText=function(text){window.__mapDrawnText.push(String(text));return draw.apply(this,arguments);};});
 const page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 const settle=()=>page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(()=>r(true)))));
 await page.goto('http://map771r.test/index.html');await page.waitForFunction(()=>typeof atlasRegionSettle==='function'&&typeof syncUI==='function'&&typeof TnDMaps==='object');
 await page.evaluate(f=>{worldState=f.world;memory=f.memory;sessionLog=[];document.getElementById('api-screen').style.display='none';generateActions=function(){};speakNarration=function(){};processPendingCompanionSheets=function(){};
  window.__mapToasts=[];const toast=showToast;showToast=function(m){__mapToasts.push(String(m));return toast.apply(this,arguments);};
  showGame();atlasCreate('771r-browser',{knowledge:true});atlasFollow();
  window.__gm=function(text){commitGmTurn(text,{userMsg:'Go on.',playerTxt:'Go on.'});atlasRegionSettle();syncUI();};
  __gm('The mire stretches away.\n[MAP_REVEAL:new|Shattered Ridge|N|observed]');
  __gm('You climb out of the reeds onto the ridge.\n[LOCATION:Shattered Ridge]');
  __gm('You come down among iron-barked trunks.\n[LOCATION:The Ironwood Heart]');
  showAtlasFull();atlasPaneShow(atlasRegionId(worldState.atlas),true);},fx);
 await settle();await settle();
 const snap=()=>page.evaluate(()=>{const v=_atlasPane.view,d=v.doc(),sc=v.scene(),t=v.transform(),c=document.getElementById('atlas-canvas'),rc=c.getBoundingClientRect(),style=TnDMaps.style.get('ink'),labels=[],names=[];
  sc.layers.forEach(l=>l.items.forEach(x=>{if(x.t==='text'&&(l.name==='labels'||l.name==='featureLabels'))names.push(x.text);if(x.t==='text'&&x.meta&&['place','marker'].includes(x.meta.kind))labels.push({kind:x.meta.kind,id:x.meta.id,text:x.text,size:style.text[x.s].size*t.k,at:[x.x*t.k+t.x+rc.left,x.y*t.k+t.y+rc.top]});}));
  const pp=atlasPartyIn(_atlasPane.zone),sel=document.getElementById('atlas-zones');
  return {party:pp?[pp.x*t.k+t.x,pp.y*t.k+t.y]:null,partyAt:pp?((d.places||[]).filter(p=>p.x===pp.x&&p.y===pp.y)[0]||{}).name:null,gen:d.generator.name,story:!!d.story,zone:_atlasPane.zone,region:atlasRegionId(worldState.atlas),at:worldState.atlas.at,w:c.clientWidth,h:c.clientHeight,k:t.k,labels,names,dropped:sc.dropped.length,
   places:(d.places||[]).map(p=>[p.name,p.site.biome]),ways:(d.ways||[]).map(w=>w.sure),fog:sc.layers.some(l=>l.name==='fog'),reveal:v.reveal(),spots:JSON.parse(JSON.stringify(worldState.atlas.spots||{})),waiting:atlasRegionSpots(worldState.atlas).waiting,
   painted:window.__mapDrawnText.join('\n'),trail:atlasTrailItems(_atlasPane.zone).map(x=>[x.text,x.current]),options:sel?Array.from(sel.options).map(o=>o.text):null,card:document.getElementById('atlas-card').textContent,list:document.querySelectorAll('[data-tnd-unplaced]').length};});
 const inView=r=>!!r.party&&r.party[0]>=20&&r.party[1]>=20&&r.party[0]<=r.w-20&&r.party[1]<=r.h-20;
 await check('a phone opens the region on fogged ground: the two places whose ground is known, the stated way a track; the third waits',async()=>{
   const r=await snap();assert.equal(r.zone,r.region);assert.equal(r.gen,'region');assert.equal(r.story,true);assert.equal(r.dropped,0);
   assert.deepEqual(r.places.map(p=>p[0]),[MIRE,RIDGE]);assert.equal(r.places[0][1],'marsh','the mire stands on marsh');assert.deepEqual(r.ways,[true],'the ridge was said to lie north');
   assert.deepEqual(r.waiting,[HEART],'its ground is still to be asked');assert.equal(r.party,null,'no spot yet: no party on the region');
   assert.deepEqual(Object.keys(r.spots).sort(),[MIRE,RIDGE].sort(),'the two spots are kept');assert.ok(r.spots[RIDGE].at[1]<r.spots[MIRE].at[1],'north is up the sheet');
   assert.equal(r.fog,true);assert.equal(r.reveal.radius,70);assert.equal(r.reveal.points.length,2);assert.equal(r.reveal.paths.length,1);
   assert.deepEqual(r.names.slice().sort(),[MIRE,RIDGE].sort(),'the only names on the sheet are the story\'s');
   for(const l of r.labels)assert.ok(l.size>=13.99,l.text+' renders at '+l.size+' px');
 });
 await check('answered, the third place is set on its ground beside the last, its way dotted, and the party stands on it',async()=>{
   await page.evaluate(()=>{atlasGroundFile(worldState.atlas,'The Ironwood Heart','forest');atlasRegionSettle();});await settle();await settle();
   const r=await snap();assert.deepEqual(r.places,[[MIRE,'marsh'],[RIDGE,r.places[1][1]],[HEART,'forest']]);assert.deepEqual(r.ways,[true,false]);assert.deepEqual(r.waiting,[]);
   assert.ok(inView(r),'the party is on screen: '+JSON.stringify(r.party)+' in '+r.w+'x'+r.h);
   assert.equal(r.labels.filter(l=>l.kind==='marker').length,0,'the dagger alone: the place bears its own name');assert.equal(r.partyAt,HEART,'the party stands on the Heart');
   assert.equal(r.labels.filter(l=>l.kind==='place').length,3);for(const l of r.labels)assert.ok(l.size>=13.99,l.text+' renders at '+l.size+' px');
   assert.equal(r.reveal.points.length,3);assert.equal(r.reveal.paths.length,2);
   await page.screenshot({path:path.join(shots,'map-771-region-phone-390x844.png')});
 });
 await check('the region states no distance, names nothing of its own and reads no private fact',async()=>{
   const r=await snap();assert.doesNotMatch(r.painted,/\d+ ?(m|km)\b|on foot|days/);assert.doesNotMatch(r.painted,/PRIVATE|buried vault/);assert.match(r.painted,/Not to scale/);
   assert.deepEqual(r.names.slice().sort(),[HEART,MIRE,RIDGE].sort());assert.equal(r.list,0,'a region lists nothing');
 });
 await check('the plaque leads with the region and the list offers it first',async()=>{
   const r=await snap();assert.deepEqual(r.trail,[[REGION,true],[HEART,false]]);assert.equal(r.options[1],REGION);assert.ok(r.painted.indexOf(REGION)>=0);
   assert.ok(r.options.indexOf('The journey so far')<0,'the journey sheet has retired into it');
 });
 await check('a real tap on a place opens its card, and the card opens the place\'s own sheet',async()=>{
   const r=await snap(),mire=r.labels.filter(l=>l.text===MIRE&&l.kind==='place')[0];assert.ok(mire);
   await page.evaluate(p=>{const c=document.getElementById('atlas-canvas');atlasPaneTap(null);['mousedown','mouseup'].forEach(t=>c.dispatchEvent(new MouseEvent(t,{bubbles:true,cancelable:true,clientX:p[0],clientY:p[1],button:0})));},[mire.at[0],mire.at[1]-3]);await settle();
   const after=await snap();assert.match(after.card,/Petrified Mire/);assert.match(after.card,/First visited on turn/);
   const opened=await page.evaluate(()=>{const btn=document.getElementById('atlas-card').querySelector('[data-act="open"]');if(!btn)return null;btn.click();return true;});await settle();await settle();
   assert.equal(opened,true,'the card offers the place\'s sheet');const sheet=await snap();assert.equal(sheet.gen,'wild','the mire\'s own sheet, on its ground');assert.notEqual(sheet.zone,sheet.region);
   assert.equal(sheet.reveal,null,'a place sheet is whole');
   await page.evaluate(()=>{atlasPaneShow(atlasRegionId(worldState.atlas),true);});await settle();await settle();
 });
 await check('a later place leaves the kept spots where they are',async()=>{
   const before=(await snap()).spots;
   await page.evaluate(()=>{__gm('The trees thin to open moor.\n[LOCATION:Gallows Moor]');});await settle();await settle();
   const r=await snap();for(const k of Object.keys(before))assert.deepEqual(r.spots[k].at,before[k].at,k+' did not move');assert.equal(Object.keys(r.spots).length,4,'the moor is kept too');
   assert.equal(r.zone,r.at,'a turn that moved the party shows the party\'s sheet');
   await page.evaluate(()=>{atlasPaneShow(atlasRegionId(worldState.atlas),true);});await settle();await settle();
   const back=await snap();assert.equal(back.places.length,4);assert.ok(inView(back),'the region opens on the party');assert.equal(back.partyAt,'Gallows Moor');
 });
 await page.setViewportSize({width:1280,height:840});
 await check('the desktop drawer shows the same region, readable, with the party in view',async()=>{
   await page.evaluate(()=>{atlasPaneClose();showAtlas();atlasPaneShow(atlasRegionId(worldState.atlas),true);});await settle();await settle();await settle();
   const r=await snap();assert.equal(r.gen,'region');assert.equal(r.dropped,0);assert.equal(r.fog,true);for(const l of r.labels)assert.ok(l.size>=13.99,l.text+' renders at '+l.size+' px');
   assert.ok(inView(r),'party on screen in the drawer: '+JSON.stringify(r.party)+' in '+r.w+'x'+r.h);
   await page.screenshot({path:path.join(shots,'map-771-region-drawer-1280x840.png')});
 });
 await check('with the campaign\'s fog off the region is whole; with pin sheets there is no sheet above the places',async()=>{
   const whole=await page.evaluate(()=>{worldState.atlas.fog=false;atlasPaneRefresh();return {reveal:_atlasPane.view.reveal(),fog:_atlasPane.view.scene().layers.some(l=>l.name==='fog')};});
   assert.equal(whole.reveal,null);assert.equal(whole.fog,false);
   const pins=await page.evaluate(()=>{delete worldState.atlas.fog;worldState.atlas.drawn=false;atlasPaneRefresh();return {trail:atlasTrailItems(_atlasPane.zone).map(x=>x.text),zone:_atlasPane.zone,region:atlasRegionId(worldState.atlas)};});
   assert.ok(pins.trail.indexOf('The region')<0&&pins.trail.indexOf('The journey so far')<0,'no tier above the places: '+pins.trail.join(' : '));assert.notEqual(pins.zone,pins.region,'the pane left a sheet that is no longer one');
   await page.evaluate(()=>{delete worldState.atlas.drawn;atlasPaneRefresh();});
 });
 await check('no unexpected browser exceptions or map warnings',async()=>{assert.deepEqual(errors,[]);assert.deepEqual(await page.evaluate(()=>__mapToasts.filter(t=>/fail|could not|overlap/i.test(t))),[]);});
 console.log('Screenshots: '+shots);
 }finally{await browser.close();}
 console.log((fail?'FAILED':'ALL GREEN')+' — '+pass+' #771 region browser groups, '+fail+' failures');if(fail)process.exitCode=1;
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
