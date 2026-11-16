'use strict';
// Real committed travel, phone rendering and reload. Only unrelated paid/background work is stubbed.
// TND_MAP_BASELINE=56b6f036 serves a frozen tree without checking out or altering any campaign.
// TND_MAP_LIVE_ORIGIN=https://traffic-and-dragons.pages.dev verifies served release bytes, then runs the same isolated fixture.
const fs=require('fs'),os=require('os'),path=require('path'),assert=require('assert/strict'),crypto=require('crypto');
const {execFileSync}=require('child_process');
const {chromium}=require('./cdp-browser.js');
const root=path.resolve(__dirname,'..'),baseline=process.env.TND_MAP_BASELINE||'',liveOrigin=process.env.TND_MAP_LIVE_ORIGIN||'';
const shots=process.env.TND_SHOT_DIR||fs.mkdtempSync(path.join(os.tmpdir(),'tnd-map744-'));
const types={'.html':'text/html','.css':'text/css','.js':'application/javascript','.json':'application/json','.png':'image/png','.ttf':'font/ttf','.webmanifest':'application/manifest+json'};
const privateName="PRIVATE Stalgind's Hut";
const liveAssets=new Map(),liveErrors=[];
const criticalRuntime=['index.html','globals.js','sw.js','tndmaps.js','map-knowledge.js','atlas-knowledge.js','atlas-knowledge-migrate.js','atlas-knowledge-source.js','atlas-knowledge-exits.js','atlas-knowledge-extract.js','atlas-discovery.js','atlas-public-places.js','atlas-public-landscape.js','atlas-public.js','atlas.js','ui-atlas.js','game.js','tag_table.js','state.js','api.js','helpers.js'];
async function liveAsset(rel){
 if(!liveAssets.has(rel))liveAssets.set(rel,(async()=>{
  const expected=fs.readFileSync(path.join(root,rel)),url=new URL(rel==='index.html'?'/':'/'+rel,liveOrigin);
  const res=await fetch(url,{method:'GET',redirect:'error',cache:'no-store',headers:{'Cache-Control':'no-cache'},signal:AbortSignal.timeout(30000)});
  assert.ok(res.ok,'live static asset '+rel+' HTTP '+res.status);
  const actual=Buffer.from(await res.arrayBuffer()),hash=b=>crypto.createHash('sha256').update(b).digest('hex');
  assert.equal(hash(actual),hash(expected),'live bytes differ from local release candidate: '+rel);
  return actual;
 })());
 return liveAssets.get(rel);
}
function fixture(){
 const e=require('./load-engine.js');e.loadEngine();e.makeTestWorld();
 worldState.campId='map744-browser';worldState.campName='Map travel browser';worldState.ver=SAVE_VER;worldState.turn=0;
 worldState.world.location='The Boundary Clearing';worldState.world.sublocation=null;
 worldState.transcript=[];memory.campId=worldState.campId;
 memory.map.nodes['The Boundary Clearing']=newMapNode(0,null,{visits:1,description:privateName+' has a secret cellar.'});
 memory.map.nodes[privateName]=newMapNode(0,null,{visits:0,description:'UNDISCLOSED basement entrance.'});
 return JSON.parse(JSON.stringify({world:worldState,memory}));
}
let pass=0,fail=0;
(async()=>{
 if(liveOrigin){
  assert.ok(!baseline,'live and baseline modes are mutually exclusive');
  const origin=new URL(liveOrigin);assert.equal(origin.href,'https://traffic-and-dragons.pages.dev/','live mode accepts only the approved Pages origin');
  const checked=await Promise.allSettled(criticalRuntime.map(liveAsset)),refused=checked.map((r,i)=>r.status==='rejected'?criticalRuntime[i]+': '+r.reason.message:null).filter(Boolean);
  assert.deepEqual(refused,[],'live critical-runtime verification must pass before the browser starts');
  console.log('Verified '+criticalRuntime.length+' live runtime assets from '+origin.origin);
 }
 fs.mkdirSync(shots,{recursive:true});const fx=fixture(),browser=await chromium.launch({headless:true});
 try{
  const ctx=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'}),foreign=[],cache=new Map();
  await ctx.route('**/*',async r=>{
   const u=new URL(r.request().url());if(u.hostname!=='map744.test'){foreign.push(u.pathname);return r.abort();}
   const rel=decodeURIComponent(u.pathname).replace(/^\//,''),f=path.resolve(root,rel);
   if(!f.startsWith(root+path.sep))return r.abort();
   if(liveOrigin&&(r.request().method()!=='GET'||!/\.(?:html|css|js|json|png|jpe?g|svg|webp|ico|ttf|woff2?|webmanifest|mp3|wav|ogg)$/i.test(rel)))return r.abort();
   try{
    let body;
    if(liveOrigin){
     if(!fs.existsSync(f)||!fs.statSync(f).isFile())return r.fulfill({status:404,body:''});
     body=await liveAsset(rel);
    }else if(baseline&&/\.(?:html|css|js|json|webmanifest)$/.test(rel)){
     if(!cache.has(rel))cache.set(rel,execFileSync('git',['show',baseline+':'+rel],{cwd:root,maxBuffer:16*1024*1024,stdio:['ignore','pipe','ignore']}));
     body=cache.get(rel);
    }else body=fs.readFileSync(f);
    return r.fulfill({status:200,contentType:types[path.extname(f)]||'application/octet-stream',body});
   }catch(e){if(liveOrigin){liveErrors.push(rel+': '+e.message);console.error('LIVE STATIC REFUSAL '+rel+': '+e.message);}return r.fulfill({status:404,body:''});}
  });
  await ctx.addInitScript(()=>{
   localStorage.setItem('tnd_ambient_enabled_v1','0');localStorage.setItem('tnd_folder_declined_v1','1');
   window.__mapDrawnText=[];
   const fill=CanvasRenderingContext2D.prototype.fillText;
   CanvasRenderingContext2D.prototype.fillText=function(text){window.__mapDrawnText.push(String(text));return fill.apply(this,arguments);};
  });
  const page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  const settle=()=>page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(()=>r(true)))));
  async function capture(name){await page.evaluate(async()=>{await document.fonts.ready;document.querySelectorAll('.tnd-toast').forEach(e=>e.remove());});await settle();await page.screenshot({path:path.join(shots,'map-744-'+name+'.png')});}
  async function check(name,fn){try{await fn();pass++;console.log('PASS #744 browser '+name);}catch(e){fail++;await capture('failure-'+name.replace(/[^a-z0-9]+/gi,'-'));console.error('FAIL #744 browser '+name+' — '+e.stack);if(baseline)throw e;}}
  async function stub(){await page.evaluate(()=>{
   document.getElementById('api-screen').style.display='none';
   generateActions=function(){};speakNarration=function(){};processPendingCompanionSheets=function(){};maybeRefreshSynopsis=function(){};showFirstTurnOverlay=function(){};_promptCampaignFolder=function(){};
   callGM=async function(){throw Error('No model call is authorized in this browser fixture');};
   if(typeof TTS==='object'){TTS.prewarmServer=function(){};TTS.recoverAudio=function(){};}
  });}
  async function commit(raw,opening){await page.evaluate(({raw,opening})=>{commitGmTurn(raw,{userMsg:'Continue exploring.',playerTxt:'Continue exploring.',isOpening:!!opening});syncUI();},{raw,opening});await settle();}
  async function extractStationary(raw,quote){await page.evaluate(async({raw,quote})=>{
   const transport=callGM;window.__beforeDiscoveryPlace=JSON.stringify(worldState.world);window.__beforeForeignFeature=JSON.stringify(memory.map.geography.features.f1);window.__utilityCalls=0;
   callGM=async function(msg,sys,max,model,opts){
    if(!opts||!opts.noHistory||opts.kind!=='atlas')throw Error('Unexpected non-extraction model call');__utilityCalls++;
    const p=JSON.parse(msg),s=p.segments.find(x=>x.text.includes(quote));if(!s)throw Error('Public quote absent from extraction source');
    return JSON.stringify({discoveries:[{source:s.id,label:'sunken posts',quote,mode:'observed',bearing:'N',bearingQuote:quote}],overflow:false});
   };
   try{const offer=await atlasDiscoveryRequest(raw);if(!offer)throw Error('The exact-quote fixture was not accepted');commitGmTurn(raw,{mapExtraction:offer,userMsg:'Look north without moving.',playerTxt:'Look north without moving.'});syncUI();}finally{callGM=transport;}
  },{raw,quote});await settle();}
  async function snapshot(){return page.evaluate(()=>{
   const p=__atlasTest.pane(),v=_atlasPane.view,d=v.doc(),sc=v.scene(),t=v.transform(),style=TnDMaps.style.get(sc.style||'ink');
   const items=sc.layers.flatMap(l=>l.items),c=document.getElementById('atlas-canvas');
   const labels=items.filter(x=>x.t==='text'&&x.meta&&['feature','marker'].includes(x.meta.kind)).map(x=>({name:x.text,size:style.text[x.s].size*t.k,box:x.box&&x.box.map((n,i)=>n*t.k+(i%2?t.y:t.x))}));
   const rows=Array.from(document.querySelectorAll('button[data-tnd-unplaced-id]')).map(b=>{const r=b.getBoundingClientRect();return {text:b.textContent,size:parseFloat(getComputedStyle(b).fontSize),left:r.left,right:r.right,top:r.top,bottom:r.bottom};});
   return {zone:p.zone,current:worldState.atlas.at,seed:worldState.atlas.seed,title:d.title,featureNames:d.features.map(f=>f.name),features:d.features.map(f=>({id:f.id,name:f.name,x:f.x,y:f.y})),zones:atlasZones(),markers:p.markers,trail:p.trail,
    terrain:items.filter(x=>x.meta&&x.meta.terrain).map(x=>x.meta.terrain),routes:items.filter(x=>x.meta&&x.meta.route).map(x=>x.meta.routeKind),labels,rows,width:c.clientWidth,height:c.clientHeight,dropped:sc.dropped,painted:__mapDrawnText.join('\n'),readers:JSON.stringify({d,svg:TnDMaps.renderSVG(sc),digest:TnDMaps.digest(d),zones:atlasZones(),where:atlasWhere(),keys:atlasPaneKeyList(p.zone),prompt:atlasMapBlock(),help:buildGeoBlock('player')})};
  });}
  function visible(r){
   assert.equal(r.labels.length+r.rows.length,r.features.length+r.markers.length,'every public feature and current party has a rendered label or accessible list row');
   for(const l of r.labels){assert.ok(l.size>=14,l.name+' renders at '+l.size+'px');assert.ok(l.box&&l.box[0]>=0&&l.box[1]>=0&&l.box[2]<=r.width&&l.box[3]<=r.height,'label outside canvas: '+JSON.stringify(l));}
   for(let i=0;i<r.labels.length;i++)for(let j=i+1;j<r.labels.length;j++){const a=r.labels[i].box,b=r.labels[j].box;assert.ok(!(a[0]<b[2]&&a[2]>b[0]&&a[1]<b[3]&&a[3]>b[1]),r.labels[i].name+' overlaps '+r.labels[j].name);}
   assert.equal(r.dropped.length,0,'fixture annotations must not be silently dropped');for(const row of r.rows){assert.ok(row.size>=14,'unknown-position row text is readable');assert.ok(row.left>=0&&row.right<=390&&row.top>=0&&row.bottom<=844,'unknown-position row stays on screen');}
  }
  function privateSafe(r){assert.doesNotMatch(r.readers+r.painted,/Stalgind|secret cellar|UNDISCLOSED|PRIVATE/);assert.doesNotMatch(r.readers,/\d+ m\b|kmPerUnit|on foot/);}
  await page.goto('http://map744.test/index.html');await page.waitForFunction(()=>typeof commitGmTurn==='function'&&typeof showAtlasFull==='function');await stub();
  await page.evaluate(f=>{worldState=f.world;worldState.ver=SAVE_VER;memory=f.memory;sessionLog=[];showGame();if(typeof initReplaySession==='function')initReplaySession();atlasCreate('744-browser');worldState.atlas.drawn=false;/* #771: this suite guards the PIN sheets' travel and reload; the drawn sheet has dev/tests-771-place-sheet*.js */const r=atlasPublicEnable();if(!r.ok)throw Error(r.reason);atlasFollow();syncUI();showAtlasFull();},fx);
  await commit('You stand in The Boundary Clearing. Forest Road leads west, Old Mine Track north, Marsh Causeway east, and Waystone Arch Hill southeast.\n[MAP_REVEAL:new|Forest Road|W|observed]\n[MAP_REVEAL:new|Old Mine Track|N|observed]\n[MAP_REVEAL:new|Marsh Causeway|E|observed]\n[MAP_REVEAL:new|Waystone Arch Hill|SE|observed]',true);
  let clearing,forest,marsh,clearingFeatures,noteId;
  await check('opening disclosures show on the current phone sheet without private scenery',async()=>{
   const r=await snapshot();clearing=r.current;clearingFeatures=r.features;noteId=r.features[0].id;
   assert.equal(r.zones.length,1);assert.deepEqual(r.featureNames,['Forest Road','Old Mine Track','Marsh Causeway','Waystone Arch Hill']);assert.equal(r.markers.length,1);privateSafe(r);
   await capture('clearing-'+(baseline?'before':'after'));
   if(!baseline)visible(r);
  });
  await commit("[LOCATION:The Forest Road]\nThe Forest Road threads deep timber. A guide reports the King's halls, without knowing their position.\n[MAP_REVEAL:new|deep timber|unknown|observed]\n[MAP_REVEAL:new|King's halls|unknown|reported]");
  await check('Forest Road actually renders woodland and road rather than an empty pin box',async()=>{
   const r=await snapshot();forest=r.current;await capture('forest-road-'+(baseline?'before':'after'));
   assert.ok(r.terrain.filter(x=>x==='forest').length>=8,'Forest Road must actually paint known woodland');assert.ok(r.routes.includes('road'),'Forest Road must actually paint the known road');
   assert.equal(r.zones.length,2,'the visited clearing remains available');assert.notEqual(forest,clearing);assert.equal(r.markers.length,1);assert.deepEqual(r.featureNames,['deep timber',"King's halls"]);assert.equal(r.rows.length,2);assert.ok(r.rows.some(x=>/King.s halls.*Reported/.test(x.text)));visible(r);privateSafe(r);
  });
  if(baseline)throw Error('The expected failing baseline unexpectedly passed');
  await commit('[SUBLOCATION:The Marsh]\nYou reach The Marsh beside the road. A reed bank lies south.\n[MAP_REVEAL:new|reed bank|S|observed]');
  await check('travel accumulates three stable sheets and scopes the current scenery',async()=>{
   const r=await snapshot();marsh=r.current;assert.equal(r.zones.length,3);assert.equal(new Set(r.zones.map(z=>z.id)).size,3);assert.notEqual(marsh,forest);assert.equal(r.zone,marsh);assert.deepEqual(r.featureNames,['reed bank']);assert.ok(r.terrain.includes('marsh'));assert.equal(r.markers.length,1);privateSafe(r);await capture('marsh-arrival');
  });
  await page.locator('#atlas-zones').selectOption(clearing);await settle();
  await check('browsing a previous sheet restores its disclosures without a false party marker',async()=>{
   const r=await snapshot();assert.equal(r.zone,clearing);assert.equal(r.current,marsh);assert.deepEqual(r.features,clearingFeatures);assert.equal(r.markers.length,0);assert.equal(r.title.name,'The Boundary Clearing');assert.match(JSON.stringify(r.trail),/The Marsh/);visible(r);privateSafe(r);await capture('browse-clearing');
   const card=await page.evaluate(id=>__atlasTest.tap({id}),noteId);assert.equal(card.title,'Forest Road');assert.equal(card.note,'');
   await page.locator('#atlas-card [data-act="note"]').click();await page.locator('#atlas-note-text').fill('Return here for the northern track.');await page.locator('#atlas-note-save').click();
   assert.match(await page.evaluate(()=>document.getElementById('atlas-card').textContent),/Return here for the northern track/);
  });
  await page.evaluate(()=>{__atlasTest.tap(null);_atlasPane.view.zoom(1.1);_atlasPane.view.pan(12,-8);window.__beforeCamera=_atlasPane.view.transform();});
  await extractStationary('The sunken posts emerge from the marsh north of you.\n[MAP_REVEAL:f1|Forest Road|S|observed]\n[MAP_REVEAL:new|sunken posts|N|observed]','The sunken posts emerge from the marsh north of you.');
  await check('a rejected foreign handle leaves quoted discovery and historical browsing intact',async()=>{
   const r=await snapshot();assert.equal(r.zone,clearing);assert.equal(r.current,marsh);assert.deepEqual(r.features,clearingFeatures);assert.equal(r.markers.length,0);
   const got=await page.evaluate(({clearing,marsh,noteId})=>({before:__beforeCamera,after:_atlasPane.view.transform(),current:atlasDoc(marsh).features.map(f=>f.name),note:atlasCard(clearing,{id:noteId}).note,foreign:atlasCard(marsh,{id:noteId}),placeBefore:__beforeDiscoveryPlace,placeAfter:JSON.stringify(worldState.world),originalBefore:__beforeForeignFeature,originalAfter:JSON.stringify(memory.map.geography.features.f1),utilityCalls:__utilityCalls}),{clearing,marsh,noteId});
   assert.deepEqual(got.after,got.before);assert.deepEqual(got.current,['reed bank','sunken posts']);assert.equal(got.note,'Return here for the northern track.');assert.equal(got.foreign,null);assert.equal(got.placeAfter,got.placeBefore);assert.equal(got.originalAfter,got.originalBefore);assert.equal(got.utilityCalls,1);privateSafe(r);await capture('stationary-while-browsing');
  });
  await page.evaluate(()=>{const v=_atlasPane.view;v.zoom(3);v.pan(700,-500);window.__beforeArrivalCamera=v.transform();});
  await commit('[LOCATION:The Boundary Clearing]\nYou return to The Boundary Clearing.');
  await check('backtracking reframes an already browsed sheet and retains its discoveries and notes',async()=>{
   const r=await snapshot();assert.equal(r.current,clearing);assert.equal(r.zone,clearing);assert.equal(r.zones.length,3);assert.deepEqual(r.features,clearingFeatures);assert.equal(r.markers.length,1);assert.equal(await page.evaluate(id=>atlasCard(worldState.atlas.at,{id}).note,noteId),'Return here for the northern track.');privateSafe(r);await capture('return-clearing');
   const camera=await page.evaluate(()=>{const actual=_atlasPane.view.transform();__atlasTest.show(worldState.atlas.at,true);return {before:__beforeArrivalCamera,actual,expected:_atlasPane.view.transform()};});
   assert.notDeepEqual(camera.expected,camera.before,'the fixture must leave the arrival map panned away from its fitted view');assert.deepEqual(camera.actual,camera.expected,'actual travel must reframe even when the player was browsing that arrival sheet');
  });
  const saved=await page.evaluate(()=>{if(!saveLocal())throw Error('saveLocal failed');return JSON.stringify({registry:worldState.atlas.publicPlaces,geo:memory.map.geography,notes:worldState.atlas.publicNotes});});
  await page.reload();await page.waitForFunction(()=>typeof loadState==='function'&&typeof showAtlasFull==='function');await stub();
  await page.evaluate(()=>{if(!loadState())throw Error('fixture did not reload');showGame();atlasFollow();syncUI();showAtlasFull();});await settle();
  await check('real browser reload preserves discoveries visited sheets and notes',async()=>{
   assert.equal(await page.evaluate(()=>JSON.stringify({registry:worldState.atlas.publicPlaces,geo:memory.map.geography,notes:worldState.atlas.publicNotes})),saved);const r=await snapshot();assert.equal(r.current,clearing);assert.equal(r.zones.length,3);assert.deepEqual(r.features,clearingFeatures);assert.equal(r.markers.length,1);
   await page.locator('#atlas-zones').selectOption(forest);await settle();const old=await snapshot();assert.equal(old.zone,forest);assert.equal(old.current,clearing);assert.equal(old.markers.length,0);assert.ok(old.terrain.includes('forest'));assert.ok(old.routes.includes('road'));assert.deepEqual(old.featureNames,['deep timber',"King's halls"]);visible(old);privateSafe(old);await capture('reloaded-forest-road');
  });
  await check('the party button returns from a historical sheet without growing the registry',async()=>{
   await page.locator('#atlas-party').click();await settle();const r=await snapshot();assert.equal(r.zone,clearing);assert.equal(r.current,clearing);assert.equal(r.zones.length,3);assert.equal(r.markers.length,1);privateSafe(r);
  });
  await check('no unexpected page errors or attempted paid requests',async()=>{assert.deepEqual(errors,[]);assert.deepEqual(liveErrors,[],'every served static asset must match the local candidate');assert.ok(!foreign.some(x=>/\/api\/(?:llm|tts|render)/.test(x)),JSON.stringify(foreign));});
  if(liveOrigin)console.log('Verified and used '+liveAssets.size+' matching live static assets; gameplay remained isolated.');
  console.log((fail?'FAILED':'ALL GREEN')+' — '+pass+' #744 browser groups, '+fail+' failures');if(fail)process.exitCode=1;
 }finally{console.log('Screenshots: '+shots);await browser.close();}
})().catch(e=>{console.error('FAIL #744 browser '+e.stack);process.exitCode=1;});
