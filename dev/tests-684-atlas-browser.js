// dev/tests-684-atlas-browser.js — #684: the atlas PANE in the real page (ui-atlas.js over atlas.js and TnDMaps.view).
// Owner rulings 2026-11-04: the door is the location name; new campaigns opt in; exact names plus We are here.
//   ① without an atlas the location name is plain text and opens nothing (every existing campaign);
//   ② with one it is a button (role, keyboard) and opens the pane on the region: ink on the canvas, the realm's name,
//     the status says the story's place is not on the map and what to do;
//   ③ a real click on a town on the canvas shows its card: named, NOT openable (never visited), "We are here — <story place>";
//   ④ We are here ties the story's place, moves the pane to the town's sheet with the party on it, saves the campaign;
//   ⑤ the trail leads back to the region: the party stands at the town, whose card now opens its sheet;
//   ⑥ a sewer is fogged: only its ways up are drawn, and the pane hands the library the engine's reveal list;
//   ⑦ open water says why it cannot be stood on and offers nothing;
//   ⑧ Escape closes the pane and the view lets go of the window;
//   ⑨ a phone (375×667): the place label is the door, the pane fits, the card sits inside it;
//   ⑩ the opt-in: both Begin doors carry the switch, off by default, and Begin with it on draws the realm.
// A browser suite (dev/cdp-browser.js): a CI step after the Chrome check, and the pre-push gate (#652).
// TND_SHOT_DIR=<dir> keeps the screenshots (atlas-region.png, atlas-town.png, atlas-phone.png); the OS temp dir otherwise.
const fs=require('fs'),os=require('os'),path=require('path'),assert=require('assert/strict');
const {chromium}=require('./cdp-browser.js');
const root=path.resolve(__dirname,'..');
const SHOTS=process.env.TND_SHOT_DIR||fs.mkdtempSync(path.join(os.tmpdir(),'tnd-atlas-'));
const TYPES={'.html':'text/html','.css':'text/css','.js':'application/javascript','.json':'application/json','.mp3':'audio/mpeg','.ttf':'font/ttf','.png':'image/png','.webmanifest':'application/manifest+json'};
function fixture(){const e=require('./load-engine.js');e.loadEngine();e.makeTestWorld();worldState.world.location='The Crossroads of Ashenveil';worldState.transcript=[{r:'gm',x:'The road forks under a grey sky.',t:1}];return JSON.parse(JSON.stringify({world:worldState,memory}));}
let failed=0;
async function check(name,fn){try{await fn();console.log('PASS '+name);}catch(e){failed++;console.error('FAIL '+name+' — '+e.message);}}
(async()=>{const fx=fixture(),browser=await chromium.launch({headless:true});try{
 const ctx=await browser.newContext({viewport:{width:1280,height:800},serviceWorkers:'block'});
 await ctx.route('**/*',async r=>{const u=new URL(r.request().url());if(u.hostname!=='atlas.test')return r.abort();const f=path.resolve(root,'.'+decodeURIComponent(u.pathname));if(!f.startsWith(root+path.sep))return r.abort();try{return r.fulfill({status:200,contentType:TYPES[path.extname(f)]||'application/octet-stream',body:fs.readFileSync(f)});}catch(e){return r.fulfill({status:404,body:''});}});
 await ctx.addInitScript(()=>localStorage.setItem('tnd_ambient_enabled_v1','0'));
 const page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://atlas.test/index.html');await page.waitForFunction(()=>typeof showAtlas==='function'&&typeof atlasCreate==='function'&&typeof syncUI==='function'&&typeof TnDMaps==='object');
 await page.evaluate(f=>{worldState=f.world;memory=f.memory;sessionLog=[];document.getElementById('api-screen').style.display='none';showGame();syncUI();window.__toasts=[];const _t=showToast;showToast=function(m,ms){__toasts.push(String(m));return _t.apply(this,arguments);};},fx);
 /* a real pointer click on the canvas at a map point (the view listens for mousedown on the canvas and mouseup on the window) */
 const clickMap=(x,y)=>page.evaluate(p=>{const c=document.getElementById('atlas-canvas'),r=c.getBoundingClientRect(),T=window.__atlasView().transform(),cx=r.left+p.x*T.k+T.x,cy=r.top+p.y*T.k+T.y;const o={bubbles:true,cancelable:true,clientX:cx,clientY:cy,button:0};c.dispatchEvent(new MouseEvent('mousedown',o));window.dispatchEvent(new MouseEvent('mouseup',o));return {cx,cy,inside:cx>=r.left&&cx<=r.right&&cy>=r.top&&cy<=r.bottom};},{x,y});
 const settle=()=>page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(()=>r(true)))));

 await check('① without an atlas the location name is plain text and opens nothing',async()=>{
   const r=await page.evaluate(()=>{const el=document.getElementById('hud-loc');el.click();return {role:el.getAttribute('role'),tab:el.getAttribute('tabindex'),door:el.classList.contains('atlas-door'),body:document.body.classList.contains('atlas-on'),modal:!!document.getElementById('atlas-modal'),opened:showAtlas(),toasts:__toasts.slice()};});
   assert.equal(r.role,null);assert.equal(r.tab,null);assert.equal(r.door,false);assert.equal(r.body,false);assert.equal(r.modal,false,'a click on the name must open nothing');
   assert.equal(r.opened,false);assert.ok(r.toasts.some(t=>/no drawn map/.test(t)),'showAtlas says why: '+JSON.stringify(r.toasts));
 });

 await check('② with an atlas the name is a button and opens the pane on the region: ink on the canvas, the realm named, the status says what to do',async()=>{
   const d=await page.evaluate(()=>{atlasCreate('campaign-1');atlasFollow();syncUI();const el=document.getElementById('hud-loc');return {role:el.getAttribute('role'),tab:el.getAttribute('tabindex'),label:el.getAttribute('aria-label'),cursor:getComputedStyle(el).cursor};});
   assert.equal(d.role,'button');assert.equal(d.tab,'0');assert.match(d.label,/^Open the map — The Crossroads of Ashenveil$/);assert.equal(d.cursor,'pointer');
   await page.evaluate(()=>{const el=document.getElementById('hud-loc');el.focus();el.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));});
   assert.equal(await page.evaluate(()=>!!document.getElementById('atlas-modal')),true,'Enter on the name opens the pane');
   await page.evaluate(()=>{atlasPaneClose();document.getElementById('hud-loc').click();});await settle();
   const r=await page.evaluate(()=>{const c=document.getElementById('atlas-canvas'),g=c.getContext('2d'),d=g.getImageData(0,0,c.width,c.height).data;let dark=0,i;for(i=0;i<d.length;i+=16)if(d[i]+d[i+1]+d[i+2]<300)dark++;const p=__atlasTest.pane();
     return {modal:!!document.getElementById('atlas-modal'),w:c.width,h:c.height,dark:dark,trail:document.getElementById('atlas-trail').textContent,status:document.getElementById('atlas-status').textContent,zone:p.zone,doc:p.doc,markers:p.markers.length,reveal:p.reveal,card:document.getElementById('atlas-card').style.display,zones:document.getElementById('atlas-zones').options.length,name:worldState.atlas.zones['campaign-1'].name,focusInside:document.getElementById('atlas-modal').contains(document.activeElement)};});
   assert.equal(r.modal,true);assert.ok(r.w>600&&r.h>400,'the canvas fills the pane: '+r.w+'×'+r.h);assert.ok(r.dark>500,'ink was drawn ('+r.dark+' dark samples)');
   assert.equal(r.trail,r.name);assert.equal(r.zone,'campaign-1');assert.equal(r.doc,'campaign-1');assert.equal(r.markers,0,'the party is not on the map yet');assert.equal(r.reveal,null);
   assert.match(r.status,/^The party is not on the map yet\. "The Crossroads of Ashenveil" is not on the map \(no place on the map has that name\)\. Tap the place where the party is, then We are here\.$/);
   assert.equal(r.card,'none');assert.equal(r.zones,2,'the select lists the one mapped place under its heading');assert.equal(r.focusInside,true,'the keyboard is inside the pane');
   await page.screenshot({path:path.join(SHOTS,'atlas-region.png')});
 });

 let p3=null;
 await check('③ a real click on a town shows its card: named, not openable (never visited), "We are here" naming the story place',async()=>{
   p3=await page.evaluate(()=>{window.__atlasView=function(){return _atlasPane.view;};const p=atlasDoc('campaign-1').places[3];return {id:p.id,name:p.name,x:p.x,y:p.y};});
   const c=await clickMap(p3.x,p3.y);assert.equal(c.inside,true,'the town is inside the canvas at fit');await settle();
   const r=await page.evaluate(()=>{const el=document.getElementById('atlas-card');return {shown:el.style.display,text:el.textContent,buttons:[].map.call(el.querySelectorAll('button[data-act]'),b=>b.getAttribute('data-act')),target:__atlasTest.pane().target,zones:Object.keys(worldState.atlas.zones).length};});
   assert.equal(r.shown,'block');assert.ok(r.text.indexOf(p3.name)>=0,'the card names the town: '+r.text);assert.deepEqual(r.target,{id:p3.id});
   assert.deepEqual(r.buttons,['dismiss','here'],'no "Open its sheet" for a town the party has not entered');
   assert.match(r.text,/Not yet visited/);assert.match(r.text,/We are here — The Crossroads of Ashenveil/);assert.equal(r.zones,1,'a card draws nothing');
 });

 await check('④ We are here ties the story place, shows the town sheet with the party on it, and saves the campaign',async()=>{
   await page.evaluate(()=>{document.querySelector('#atlas-card button[data-act="here"]').click();});await settle();
   const r=await page.evaluate(()=>{const A=worldState.atlas,p=__atlasTest.pane(),saved=parseWorldState(store.get(WSK));return {at:A.at,tie:A.names['The Crossroads of Ashenveil'],off:A.off,zone:p.zone,doc:p.doc,markers:p.markers,status:document.getElementById('atlas-status').textContent,trail:document.getElementById('atlas-trail').textContent,toasts:__toasts.slice(),savedAt:saved&&saved.atlas?saved.atlas.at:null,savedZones:saved&&saved.atlas?Object.keys(saved.atlas.zones).length:0,trailBtn:document.querySelectorAll('#atlas-trail button[data-zone]').length};});
   const town='campaign-1/'+p3.id;
   assert.equal(r.at,town);assert.deepEqual(r.tie,{zone:'campaign-1',id:p3.id});assert.equal(r.off,null);
   assert.equal(r.zone,town,'the pane moved to the town sheet');assert.equal(r.doc,town);assert.equal(r.markers.length,1);assert.equal(r.markers[0].kind,'party');
   assert.equal(r.status,'The party is in '+p3.name+'.');assert.ok(r.trail.indexOf(p3.name)>=0&&r.trailBtn===1,'the trail: region button, then the town');
   assert.ok(r.toasts.some(t=>t==='"The Crossroads of Ashenveil" is on the map.'),'toasted: '+JSON.stringify(r.toasts));
   assert.equal(r.savedAt,town,'the tie is saved at once');assert.equal(r.savedZones,2);
   await page.screenshot({path:path.join(SHOTS,'atlas-town.png')});
 });

 await check('⑤ the trail leads back to the region: the party stands at the town, whose card now opens its sheet',async()=>{
   await page.evaluate(()=>{document.querySelector('#atlas-trail button[data-zone]').click();});await settle();
   const a=await page.evaluate(()=>{const p=__atlasTest.pane();return {zone:p.zone,m:p.markers};});
   assert.equal(a.zone,'campaign-1');assert.equal(a.m.length,1);assert.deepEqual([a.m[0].x,a.m[0].y],[p3.x,p3.y],'the party marker sits on the town');
   await clickMap(p3.x,p3.y);await settle();
   const r=await page.evaluate(()=>{const el=document.getElementById('atlas-card');return {text:el.textContent,buttons:[].map.call(el.querySelectorAll('button[data-act]'),b=>b.getAttribute('data-act'))};});
   assert.match(r.text,/The party is here\./);assert.deepEqual(r.buttons,['dismiss','open'],'the town opens; We are here is not offered where the party already is');
   await page.evaluate(()=>{document.querySelector('#atlas-card button[data-act="open"]').click();});await settle();
   assert.equal(await page.evaluate(()=>__atlasTest.pane().zone),'campaign-1/'+p3.id);
 });

 await check('⑥ a sewer is fogged: only its ways up are drawn, and the pane hands the library the engine\'s reveal list',async()=>{
   const r=await page.evaluate(()=>{const reg=atlasDoc('campaign-1'),p0=reg.places[0];worldState.world.location=p0.name;atlasFollow();const town=atlasDoc(worldState.atlas.at),g=town.portals.filter(p=>p.kind==='grate')[0];worldState.world.sublocation=g.name;atlasFollow();syncUI();
     const z=worldState.atlas.at;showAtlas();const p=__atlasTest.pane(),doc=atlasDoc(z);return {z:z,kind:worldState.atlas.zones[z].kind,zone:p.zone,reveal:p.reveal,expect:atlasReveal(z),rooms:doc.rooms.length,ups:doc.portals.filter(q=>q.way==='up').length,status:document.getElementById('atlas-status').textContent,markers:p.markers.length};});
   assert.equal(r.kind,'dungeon');assert.equal(r.zone,r.z,'the pane opens where the party is');assert.deepEqual(r.reveal,r.expect);assert.equal(r.reveal.length,r.ups,'the ways up only');assert.ok(r.reveal.length<r.rooms,'the rest of the sewer is hidden');
   assert.equal(r.markers,1);assert.match(r.status,/^The party is in The Sewers of /);
 });

 await check('⑦ open water says why it cannot be stood on and offers no We are here',async()=>{
   const r=await page.evaluate(()=>{__atlasTest.show('campaign-1');const sea=atlasDoc('campaign-1').features.filter(f=>f.kind==='sea')[0];const before=JSON.stringify(worldState.atlas);__atlasTest.tap({x:sea.x,y:sea.y});const el=document.getElementById('atlas-card');return {text:el.textContent,buttons:[].map.call(el.querySelectorAll('button[data-act]'),b=>b.getAttribute('data-act')),same:JSON.stringify(worldState.atlas)===before};});
   assert.match(r.text,/Open country/);assert.match(r.text,/sea/);assert.deepEqual(r.buttons,['dismiss']);assert.equal(r.same,true);
 });

 await check('⑧ Escape closes the pane; the view is destroyed and the opener gets the keyboard back',async()=>{
   const r=await page.evaluate(()=>{const v=_atlasPane.view;let destroyed=false;const d=v.destroy;v.destroy=function(){destroyed=true;return d.apply(v,arguments);};document.getElementById('atlas-modal').dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));return {modal:!!document.getElementById('atlas-modal'),pane:__atlasTest.pane(),destroyed:destroyed};});
   assert.equal(r.modal,false);assert.equal(r.pane,null);assert.equal(r.destroyed,true);
 });

 await check('⑨ a phone (375×667): the place label is the door, the pane fits, the card sits inside it',async()=>{
   await page.setViewportSize({width:375,height:667});await page.evaluate(()=>{window.dispatchEvent(new Event('resize'));if(typeof mobileInit==='function')mobileInit();syncUI();});await settle();
   const d=await page.evaluate(()=>{const el=document.getElementById('mobile-place');return el?{role:el.getAttribute('role'),shown:getComputedStyle(el).display!=='none',text:el.textContent}:null;});
   assert.ok(d,'the phone has a place label');assert.equal(d.role,'button');assert.equal(d.shown,true,'the place label is visible at 375 px');
   await page.evaluate(()=>{document.getElementById('mobile-place').click();});await settle();
   const r=await page.evaluate(()=>{__atlasTest.show('campaign-1');const p=atlasDoc('campaign-1').places[5];__atlasTest.tap({id:p.id});const box=id=>{const b=document.getElementById(id).getBoundingClientRect();return {l:b.left,r:b.right,t:b.top,b:b.bottom,w:b.width,h:b.height};};return {modal:!!document.getElementById('atlas-modal'),canvas:box('atlas-canvas'),card:box('atlas-card'),head:box('atlas-head'),close:box('atlas-close'),scrollW:document.documentElement.scrollWidth};});
   assert.equal(r.modal,true,'a tap on the place label opens the pane');
   assert.ok(r.canvas.w<=375&&r.canvas.w>=300&&r.canvas.h>=300,'the canvas fits the phone: '+JSON.stringify(r.canvas));
   assert.ok(r.card.l>=0&&r.card.r<=375&&r.card.b<=667,'the card is inside the screen: '+JSON.stringify(r.card));
   assert.ok(r.close.r<=375&&r.close.w>=24&&r.close.h>=24,'the close button is on screen and finger-sized: '+JSON.stringify(r.close));assert.ok(r.scrollW<=375,'no sideways scroll: '+r.scrollW);
   await page.screenshot({path:path.join(SHOTS,'atlas-phone.png')});
   await page.evaluate(()=>atlasPaneClose());await page.setViewportSize({width:1280,height:800});
 });

 await check('⑩ the opt-in: both Begin doors carry the switch, off by default; Begin with it on draws the realm, without it draws nothing',async()=>{
   const r=await page.evaluate(()=>{const rv=document.getElementById('rv-atlas');const out={rv:rv?{type:rv.type,checked:rv.checked}:null,pending:pendingAtlas};
     const boot=function(want){const e=JSON.parse(JSON.stringify(worldState.character));pendingAtlas=want;const gs=generateSkeleton,ba=beginAdventure;generateSkeleton=function(){return new Promise(function(){});};beginAdventure=function(){};try{startGame(e,'Sword and Sorcery','');}finally{generateSkeleton=gs;beginAdventure=ba;busy=false;}return {atlas:worldState.atlas?{seed:worldState.atlas.seed,zones:Object.keys(worldState.atlas.zones).length,off:worldState.atlas.off&&worldState.atlas.off.name}:null,pending:pendingAtlas,door:document.getElementById('hud-loc').getAttribute('role')};};
     out.on=boot(true);out.off=boot(false);return out;});
   assert.deepEqual(r.rv,{type:'checkbox',checked:false},'the Review step carries the switch, off');assert.equal(r.pending,false);
   assert.ok(r.on.atlas&&/^[a-z0-9]{12}$/.test(r.on.atlas.seed)&&r.on.atlas.zones===1,'Begin with the switch on mints a seed and draws the region: '+JSON.stringify(r.on));
   assert.equal(r.on.pending,false,'the switch is consumed by the campaign it started');assert.equal(r.on.door,'button');
   assert.equal(r.off.atlas,null,'Begin without it draws nothing');assert.equal(r.off.door,null);
   const src=fs.readFileSync(path.join(root,'ui-browsers.js'),'utf8');assert.ok(/id='is-atlas'/.test(src)&&/pendingAtlas=/.test(src),'the library-hero setup modal carries the switch too');
 });

 assert.deepEqual(errors,[],'page errors: '+errors.join(' | '));
 console.log('screenshots: '+SHOTS);
}finally{await browser.close();}
console.log(failed?'FAILED — '+failed:'ALL GREEN — the atlas pane (#684)');process.exit(failed?1:0);
})().catch(e=>{console.error(e);process.exit(1);});
