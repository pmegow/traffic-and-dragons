// dev/tests-684-atlas-browser.js — #684: the atlas PANE in the real page (ui-atlas.js over atlas.js and TnDMaps.view).
// Owner rulings 2026-11-04: the door is the location name; new campaigns opt in; exact names plus Current location ("We are
// here" until #711, owner 2026-11-08). #711: the pane lives in the side drawer's Map tab (the DOCK) and an enlarge button
// lifts it to full screen; the view draws the library's HUD (title, compass, a scale bar re-measured at the zoom) screen-fixed.
//   ① without an atlas the location name is plain text and opens nothing, and the Map tab is hidden (every existing campaign);
//   ② with one it is a button (role, keyboard) and opens the DOCK on the region — the drawer opens on the Map tab, the HUD is
//     on, the title names the realm; the enlarge button opens the FULL pane: ink on the canvas, the trail, the select, the
//     status says the story's place is not on the map and what to do;
//   ③ a real click on a town on the canvas shows its card: named, NOT openable (never visited), "Current location — <story place>";
//   ④ Current location ties the story's place, moves the pane to the town's sheet with the party on it, saves the campaign;
//   ⑤ the trail leads back to the region: the party stands at the town, whose card now opens its sheet;
//   ⑥ a sewer is fogged: only its ways up are drawn, and the pane hands the library the engine's reveal list;
//   ⑦ open water says why it cannot be stood on and offers nothing;
//   ⑧ Escape closes the full pane, the view lets go of the window, and the dock takes the map back;
//   ⑨ a phone (375×667): the place label is the door, the dock fits beside the tabs, the full pane fits, the card sits inside it;
//   ⑩ the opt-in: off by default at both Begin doors, each driven for real and handing startGame its own switch; the
//     next campaign is not mapped; a village and a failed realm begin without a map, loudly;
//   ⑪ a turn sent after the pointer moved outside a turn (a Sync edit) is played on the followed map: the prompt the
//     model is sent carries the MAP block for the NEW place, right after GEOGRAPHY;
//   ⑫ a card painted before the story moved is refused; a turn landing under an open pane repaints it; a party off the
//     map is drawn as its last mapped place, and that place's card offers Current location;
//   ⑭ the HUD and the drawer: the scale bar's label follows a wheel zoom while the bar keeps its width, a wider drawer re-fits
//     the dock's view, and a campaign that loses its atlas loses the Map tab and is moved off it.
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
 const devicePixelRatioOf=d=>d;/* the headless context runs at 1 */

 await check('① without an atlas the location name is plain text and opens nothing, and the Map tab is hidden',async()=>{
   const r=await page.evaluate(()=>{const el=document.getElementById('hud-loc');el.click();return {role:el.getAttribute('role'),tab:el.getAttribute('tabindex'),door:el.classList.contains('atlas-door'),body:document.body.classList.contains('atlas-on'),modal:!!document.getElementById('atlas-modal'),dock:document.getElementById('atlas-dock').children.length,mapTab:getComputedStyle(document.getElementById('mobile-tab-map')).display,opened:showAtlas(),toasts:__toasts.slice()};});
   assert.equal(r.role,null);assert.equal(r.tab,null);assert.equal(r.door,false);assert.equal(r.body,false);assert.equal(r.modal,false,'a click on the name must open nothing');assert.equal(r.dock,0,'the dock stays empty');assert.equal(r.mapTab,'none','#711: no Map tab without an atlas');
   assert.equal(r.opened,false);assert.ok(r.toasts.some(t=>/no drawn map/.test(t)),'showAtlas says why: '+JSON.stringify(r.toasts));
 });

 await check('② with an atlas the name is a button and opens the DOCK on the region (the drawer on its Map tab, the HUD on); the enlarge button opens the full pane: ink on the canvas, the realm named, the status says what to do',async()=>{
   const d=await page.evaluate(()=>{atlasCreate('campaign-1');worldState.atlas.adopt=false;/* ②–⑨ probe the player's correction (We are here) and the off-map states: You are here (#702) is switched off for them; ⑬ switches it on */atlasFollow();syncUI();const el=document.getElementById('hud-loc');return {role:el.getAttribute('role'),tab:el.getAttribute('tabindex'),label:el.getAttribute('aria-label'),cursor:getComputedStyle(el).cursor};});
   assert.equal(d.role,'button');assert.equal(d.tab,'0');assert.match(d.label,/^Open the map — The Crossroads of Ashenveil$/);assert.equal(d.cursor,'pointer');
   await page.evaluate(()=>{const el=document.getElementById('hud-loc');el.focus();el.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));});await settle();
   const k=await page.evaluate(()=>{const p=__atlasTest.pane(),dock=document.getElementById('atlas-dock'),c=dock.querySelector('#atlas-canvas'),st=document.getElementById('atlas-stage');return {modal:!!document.getElementById('atlas-modal'),host:p&&p.host,hud:p&&p.hud,open:document.getElementById('rpanel').classList.contains('mobile-open'),width:mobileUI.width,tab:document.getElementById('mobile-tab-map').getAttribute('aria-selected'),mapTab:getComputedStyle(document.getElementById('mobile-tab-map')).display,title:document.getElementById('atlas-title').textContent,cw:c?c.width:0,ch:c?c.height:0,stage:[st.clientWidth,st.clientHeight],trail:!!document.getElementById('atlas-trail'),full:!!document.getElementById('atlas-full'),name:worldState.atlas.zones['campaign-1'].name};});
   assert.equal(k.modal,false,'Enter on the name opens the dock, not the modal');assert.equal(k.host,'dock');assert.equal(k.hud,true,'the HUD is on in the dock');assert.equal(k.open,true,'the drawer opened');assert.ok(k.width>=300&&k.width<=460,'the drawer opened at the map width: '+k.width);assert.equal(k.tab,'true','the Map tab is selected');assert.equal(k.mapTab,'block');
   assert.equal(k.title,k.name,'the dock names the sheet');assert.ok(k.cw>200&&k.ch>200&&Math.abs(k.cw-k.stage[0]*devicePixelRatioOf(1))<4,'the dock canvas fills the stage: '+JSON.stringify(k));assert.equal(k.trail,false,'no trail in the dock');assert.equal(k.full,true,'the enlarge button is there');
   await page.screenshot({path:path.join(SHOTS,'atlas-dock.png')});
   await page.evaluate(()=>{document.getElementById('atlas-full').click();});await settle();
   assert.deepEqual(await page.evaluate(()=>({modal:!!document.getElementById('atlas-modal'),host:__atlasTest.pane().host,dock:document.getElementById('atlas-dock').children.length})),{modal:true,host:'full',dock:0},'the enlarge button lifts the one pane to full screen; the dock is emptied');
   const r=await page.evaluate(()=>{const c=document.getElementById('atlas-canvas'),g=c.getContext('2d'),d=g.getImageData(0,0,c.width,c.height).data;let dark=0,i;for(i=0;i<d.length;i+=16)if(d[i]+d[i+1]+d[i+2]<300)dark++;const p=__atlasTest.pane();
     return {modal:!!document.getElementById('atlas-modal'),w:c.width,h:c.height,dark:dark,trail:document.getElementById('atlas-trail').textContent,status:document.getElementById('atlas-status').textContent,zone:p.zone,doc:p.doc,hud:p.hud,markers:p.markers.length,reveal:p.reveal,card:document.getElementById('atlas-card').style.display,zones:document.getElementById('atlas-zones').options.length,name:worldState.atlas.zones['campaign-1'].name,focusInside:document.getElementById('atlas-modal').contains(document.activeElement)};});
   assert.equal(r.modal,true);assert.ok(r.w>600&&r.h>400,'the canvas fills the pane: '+r.w+'×'+r.h);assert.ok(r.dark>500,'ink was drawn ('+r.dark+' dark samples)');
   assert.equal(r.trail,r.name);assert.equal(r.zone,'campaign-1');assert.equal(r.doc,'campaign-1');assert.equal(r.hud,true,'the HUD is on in the full pane');assert.equal(r.markers,0,'the party is not on the map yet');assert.equal(r.reveal,null);
   assert.match(r.status,/^The party is not on the map yet\. "The Crossroads of Ashenveil" is not on the map \(no place on the map has that name\)\. Tap the place where the party is, then Current location\.$/);
   assert.equal(r.card,'none');assert.equal(r.zones,2,'the select lists the one mapped place under its heading');assert.equal(r.focusInside,true,'the keyboard is inside the pane');
   await page.screenshot({path:path.join(SHOTS,'atlas-region.png')});
 });

 let p3=null;
 await check('③ a real click on a town shows its card: named, not openable (never visited), "Current location" naming the story place',async()=>{
   p3=await page.evaluate(()=>{window.__atlasView=function(){return _atlasPane.view;};const p=atlasDoc('campaign-1').places[3];return {id:p.id,name:p.name,x:p.x,y:p.y};});
   const c=await clickMap(p3.x,p3.y);assert.equal(c.inside,true,'the town is inside the canvas at fit');await settle();
   const r=await page.evaluate(()=>{const el=document.getElementById('atlas-card');return {shown:el.style.display,text:el.textContent,buttons:[].map.call(el.querySelectorAll('button[data-act]'),b=>b.getAttribute('data-act')),target:__atlasTest.pane().target,zones:Object.keys(worldState.atlas.zones).length};});
   assert.equal(r.shown,'block');assert.ok(r.text.indexOf(p3.name)>=0,'the card names the town: '+r.text);assert.deepEqual(r.target,{id:p3.id});
   assert.deepEqual(r.buttons,['dismiss','here'],'no "Open its sheet" for a town the party has not entered');
   assert.match(r.text,/Not yet visited/);assert.match(r.text,/Current location — The Crossroads of Ashenveil/);assert.doesNotMatch(r.text,/We are here/,'#711: the button is Current location');assert.equal(r.zones,1,'a card draws nothing');
 });

 await check('④ Current location ties the story place, shows the town sheet with the party on it, and saves the campaign',async()=>{
   await page.evaluate(()=>{document.querySelector('#atlas-card button[data-act="here"]').click();});await settle();
   const r=await page.evaluate(()=>{const A=worldState.atlas,p=__atlasTest.pane(),saved=parseWorldState(store.get(WSK));return {at:A.at,tie:A.names['The Crossroads of Ashenveil'],off:A.off,zone:p.zone,doc:p.doc,markers:p.markers,status:document.getElementById('atlas-status').textContent,trail:document.getElementById('atlas-trail').textContent,toasts:__toasts.slice(),savedAt:saved&&saved.atlas?saved.atlas.at:null,savedZones:saved&&saved.atlas?Object.keys(saved.atlas.zones).length:0,trailBtn:document.querySelectorAll('#atlas-trail button[data-zone]').length};});
   const town='campaign-1/'+p3.id;
   assert.equal(r.at,town);assert.deepEqual(r.tie,{zone:'campaign-1',id:p3.id});assert.equal(r.off,null);
   assert.equal(r.zone,town,'the pane moved to the town sheet');assert.equal(r.doc,town);assert.equal(r.markers.length,1);assert.equal(r.markers[0].kind,'party');
   assert.equal(r.status,'The party is in '+p3.name+'. The story\'s "The Crossroads of Ashenveil" is at '+p3.name+' on this map: the player placed it there.','#692: the pane says the tie the tap made, in the words the GM is told');assert.ok(r.trail.indexOf(p3.name)>=0&&r.trailBtn===1,'the trail: region button, then the town');
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
   assert.match(r.text,/The party is here\./);assert.deepEqual(r.buttons,['dismiss','open'],'the town opens; Current location is not offered where the party already is');
   await page.evaluate(()=>{document.querySelector('#atlas-card button[data-act="open"]').click();});await settle();
   assert.equal(await page.evaluate(()=>__atlasTest.pane().zone),'campaign-1/'+p3.id);
 });

 await check('⑥ a sewer is fogged: only its ways up are drawn, and the pane hands the library the engine\'s reveal list',async()=>{
   const r=await page.evaluate(()=>{const reg=atlasDoc('campaign-1'),p0=reg.places[0];worldState.world.location=p0.name;atlasFollow();const town=atlasDoc(worldState.atlas.at),g=town.portals.filter(p=>p.kind==='grate')[0];worldState.world.sublocation=g.name;atlasFollow();syncUI();
     const z=worldState.atlas.at;showAtlas();const p=__atlasTest.pane(),doc=atlasDoc(z);return {z:z,kind:worldState.atlas.zones[z].kind,zone:p.zone,reveal:p.reveal,expect:atlasReveal(z),rooms:doc.rooms.length,ups:doc.portals.filter(q=>q.way==='up').length,status:document.getElementById('atlas-status').textContent,markers:p.markers.length};});
   assert.equal(r.kind,'dungeon');assert.equal(r.zone,r.z,'the pane opens where the party is');assert.deepEqual(r.reveal,r.expect);assert.equal(r.reveal.length,r.ups,'the ways up only');assert.ok(r.reveal.length<r.rooms,'the rest of the sewer is hidden');
   assert.equal(r.markers,1);assert.match(r.status,/^The party is in The Sewers of /);
 });

 await check('⑦ open water says why it cannot be stood on and offers no Current location',async()=>{
   const r=await page.evaluate(()=>{__atlasTest.show('campaign-1');const sea=atlasDoc('campaign-1').features.filter(f=>f.kind==='sea')[0];const before=JSON.stringify(worldState.atlas);__atlasTest.tap({x:sea.x,y:sea.y});const el=document.getElementById('atlas-card');return {text:el.textContent,buttons:[].map.call(el.querySelectorAll('button[data-act]'),b=>b.getAttribute('data-act')),same:JSON.stringify(worldState.atlas)===before};});
   assert.match(r.text,/Open country/);assert.match(r.text,/sea/);assert.deepEqual(r.buttons,['dismiss']);assert.equal(r.same,true);
 });

 await check('⑧ Escape closes the full pane; its view is destroyed, and the dock (the Map tab still showing) takes the map back on the same zone; the Map tab, clicked, mounts the pane',async()=>{
   const worldAt=await page.evaluate(()=>worldState.atlas.at);
   const r=await page.evaluate(()=>{const v=_atlasPane.view,zone=_atlasPane.zone;let destroyed=false;const d=v.destroy;v.destroy=function(){destroyed=true;return d.apply(v,arguments);};document.getElementById('atlas-modal').dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));const p=__atlasTest.pane();return {modal:!!document.getElementById('atlas-modal'),host:p&&p.host,same:p&&p.view!==v,zone:p&&p.zone,was:zone,dock:document.getElementById('atlas-dock').children.length,destroyed:destroyed};});
   assert.equal(r.modal,false);assert.equal(r.destroyed,true,'the full pane\'s view let go of the window');assert.equal(r.host,'dock','the dock took the map back');assert.ok(r.dock>0);
   await page.evaluate(()=>atlasPaneClose());assert.equal(await page.evaluate(()=>__atlasTest.pane()),null,'a closed dock pane is gone too');
   await page.evaluate(()=>{mobileSelectPanel('party');document.getElementById('mobile-tab-map').click();});await settle();
   const m=await page.evaluate(()=>{const p=__atlasTest.pane();return {host:p&&p.host,zone:p&&p.zone,selected:mobileUI.selected};});assert.deepEqual(m,{host:'dock',zone:worldAt,selected:'map'},'the Map tab, clicked by the player, mounts the pane on where the party is');
 });

 await check('⑨ a phone (375×667): the place label is the door, the dock fits beside the tabs, the full pane fits, the card sits inside it',async()=>{
   await page.setViewportSize({width:375,height:667});await page.evaluate(()=>{window.dispatchEvent(new Event('resize'));if(typeof mobileInit==='function')mobileInit();syncUI();});await settle();
   const d=await page.evaluate(()=>{const el=document.getElementById('mobile-place');return el?{role:el.getAttribute('role'),shown:getComputedStyle(el).display!=='none',text:el.textContent}:null;});
   assert.ok(d,'the phone has a place label');assert.equal(d.role,'button');assert.equal(d.shown,true,'the place label is visible at 375 px');
   await page.evaluate(()=>{mobileDrawerWidth(0);document.getElementById('mobile-place').click();});await settle();
   const dk=await page.evaluate(()=>{const p=__atlasTest.pane(),b=document.getElementById('atlas-canvas').getBoundingClientRect(),t=document.getElementById('mobile-panel-tabs').getBoundingClientRect();return {host:p&&p.host,canvas:[b.left,b.right,b.width,b.height],tabs:[t.left,t.right],scrollW:document.documentElement.scrollWidth,width:mobileUI.width};});
   assert.equal(dk.host,'dock','a tap on the place label opens the dock');assert.ok(dk.canvas[2]>=120&&dk.canvas[1]<=dk.tabs[0]+1&&dk.tabs[1]<=375&&dk.scrollW<=375,'the dock fits beside the tab column on the phone: '+JSON.stringify(dk));
   await page.screenshot({path:path.join(SHOTS,'atlas-phone-dock.png')});
   await page.evaluate(()=>{document.getElementById('atlas-full').click();});await settle();
   const r=await page.evaluate(()=>{__atlasTest.show('campaign-1');const p=atlasDoc('campaign-1').places[5];__atlasTest.tap({id:p.id});const box=id=>{const b=document.getElementById(id).getBoundingClientRect();return {l:b.left,r:b.right,t:b.top,b:b.bottom,w:b.width,h:b.height};};return {modal:!!document.getElementById('atlas-modal'),canvas:box('atlas-canvas'),card:box('atlas-card'),head:box('atlas-head'),close:box('atlas-close'),scrollW:document.documentElement.scrollWidth};});
   assert.equal(r.modal,true,'the enlarge button opens the full pane');
   assert.ok(r.canvas.w<=375&&r.canvas.w>=300&&r.canvas.h>=300,'the canvas fits the phone: '+JSON.stringify(r.canvas));
   assert.ok(r.card.l>=0&&r.card.r<=375&&r.card.b<=667,'the card is inside the screen: '+JSON.stringify(r.card));
   assert.ok(r.close.r<=375&&r.close.w>=24&&r.close.h>=24,'the close button is on screen and finger-sized: '+JSON.stringify(r.close));assert.ok(r.scrollW<=375,'no sideways scroll: '+r.scrollW);
   await page.screenshot({path:path.join(SHOTS,'atlas-phone.png')});
   await page.evaluate(()=>{atlasPaneClose();atlasPaneClose();mobileDrawerWidth(0);});await page.setViewportSize({width:1280,height:800});
 });

 await check('⑩ the opt-in: off by default at both Begin doors; each door hands startGame its OWN switch; Begin draws the realm once, only for an adventure, and starts the campaign even when the realm fails',async()=>{
   const r=await page.evaluate(()=>{
     const out={},rv=document.getElementById('rv-atlas'),H=JSON.stringify(worldState.character),hero=()=>JSON.parse(H);
     out.rv=rv?{type:rv.type,checked:rv.checked}:null;out.pending0=pendingAtlas;
     /* the two doors, driven for real, with startGame recording the switch it was handed */
     const realStart=startGame,realSnap=snapshotActiveCamp,seen=[];
     startGame=function(){seen.push(pendingAtlas);pendingAtlas=false;};snapshotActiveCamp=function(){return true;};
     try{
       rv.checked=true;pendingImportChar=hero();confirmChar();rv.checked=false;pendingImportChar=hero();confirmChar();
       _startImportedCampaign(hero());out.isDefault=document.getElementById('is-atlas').checked;document.getElementById('is-atlas').checked=true;document.getElementById('is-go').click();
       _startImportedCampaign(hero());document.getElementById('is-go').click();
       out.seen=seen.slice();
     }finally{startGame=realStart;snapshotActiveCamp=realSnap;}
     /* the real startGame */
     const boot=function(set,opts){const gs=generateSkeleton,ba=beginAdventure,sm=showStakeModal,kd=kindDef,ac=atlasCreate;generateSkeleton=function(){return new Promise(function(){});};beginAdventure=function(){};showStakeModal=function(){};
       if(opts&&opts.village)kindDef=function(){const o=Object.assign({},kd());o.atlas=false;return o;};if(opts&&opts.fail)atlasCreate=function(){throw new Error('realm boom');};
       if(set!==undefined)pendingAtlas=set;__toasts.length=0;
       try{startGame(hero(),'Sword and Sorcery','');}finally{generateSkeleton=gs;beginAdventure=ba;showStakeModal=sm;kindDef=kd;atlasCreate=ac;busy=false;}
       return {atlas:worldState.atlas?{seed:worldState.atlas.seed,zones:Object.keys(worldState.atlas.zones).length}:null,pending:pendingAtlas,door:document.getElementById('hud-loc').getAttribute('role'),toasts:__toasts.slice(),started:!!(worldState&&worldState.character&&worldState.world)};};
     out.on=boot(true);out.next=boot(undefined);out.village=boot(true,{village:true});out.fail=boot(true,{fail:true});
     return out;});
   assert.deepEqual(r.rv,{type:'checkbox',checked:false},'the Review step carries the switch, off');assert.equal(r.pending0,false);assert.equal(r.isDefault,false,'the setup modal carries the switch, off');
   assert.deepEqual(r.seen,[true,false,true,false],'each door hands startGame the switch as the player left it: Review on, Review off, setup on, setup off');
   assert.ok(r.on.atlas&&/^[a-z0-9]{12}$/.test(r.on.atlas.seed)&&r.on.atlas.zones>=1&&r.on.atlas.zones<=2,'Begin with the switch on mints a seed and draws the region (and, You are here being on, adds the start place as a village — a second zone): '+JSON.stringify(r.on));
   assert.equal(r.on.pending,false,'the switch is consumed by the campaign it started');assert.equal(r.on.door,'button');
   assert.equal(r.next.atlas,null,'the NEXT campaign, begun with no door touching the switch, is not mapped');assert.equal(r.next.door,null);
   assert.equal(r.village.atlas,null,'a kind without a drawn map begins without one');assert.ok(r.village.toasts.some(t=>/A drawn map is for adventures/.test(t)),'and says so: '+JSON.stringify(r.village.toasts));assert.equal(r.village.started,true);
   assert.equal(r.fail.atlas,null,'a realm that could not be drawn leaves no half atlas');assert.ok(r.fail.toasts.some(t=>/drawing the realm failed — realm boom/.test(t)),'loudly: '+JSON.stringify(r.fail.toasts));assert.equal(r.fail.started,true,'and the campaign still begins');
   /* every door that reaches startGame sets the switch itself: the quick start has none, so it clears it; a NEW door fails here until it is listed */
   const qs=fs.readFileSync(path.join(root,'ui-browsers.js'),'utf8'),q0=qs.indexOf('function consumeHomeQuickStart('),q1=qs.indexOf('\nfunction ',q0+10),quick=qs.slice(q0,q1);
   assert.ok(quick.indexOf('pendingAtlas=false;')>0&&quick.indexOf('pendingAtlas=false;')<quick.indexOf('startGame('),'the quick start clears the switch before it starts the game');
   const calls=['char-creation.js','ui-browsers.js','ui-campaigns.js','ui-files.js','ui-boot.js','ui-modals.js','ui-sheets.js','companion-talk.js','ui-carmode.js','game.js'].map(f=>[f,(fs.readFileSync(path.join(root,f),'utf8').match(/[^A-Za-z_.]startGame\(/g)||[]).length]).filter(x=>x[1]);
   assert.deepEqual(calls,[['char-creation.js',7],['ui-browsers.js',4],['game.js',1]],'the doors into startGame are the known ones (the wizard through confirmChar, the quick start, the setup modal; game.js is its definition) — a new one must set pendingAtlas itself: '+JSON.stringify(calls));
 });
 await check('⑪ a turn sent after the pointer moved outside a turn is played on the followed map: the prompt carries the MAP block for the new place, after GEOGRAPHY',async()=>{
   const r=await page.evaluate(async()=>{atlasForget();atlasCreate('campaign-1');const p1=atlasDoc('campaign-1').places[1];worldState.world.location=p1.name;worldState.world.sublocation=null;
     const stale=atlasMapBlock();window.__sys=null;const real=callGM;callGM=async function(u,s){const o=s||buildSysPrompt();window.__sys=(typeof o==='string')?{stable:'',volatile:o}:{stable:o.stable,volatile:o.volatile};throw new Error('no model in this suite');};busy=false;
     try{await sendAction('I look around.');}catch(e){}finally{callGM=real;busy=false;}
     return {stale:stale,sys:window.__sys,at:worldState.atlas.at,name:p1.name,id:p1.id};});
   assert.match(r.stale,/has not followed the story to its current place yet/,'before the turn the block refuses to describe the old place');
   assert.ok(r.sys,'the turn built a prompt');assert.equal(r.at,'campaign-1/'+r.id,'sendAction followed the pointer before the prompt was built');
   const v=r.sys.volatile,g=v.indexOf('GEOGRAPHY (strict continuity'),m=v.indexOf('MAP (the drawn map of this world');
   assert.ok(g>=0&&m>g,'the MAP block follows GEOGRAPHY in the volatile half: '+g+' / '+m);assert.ok(v.indexOf('The party is in '+r.name+'.')>m,'the block names the place the turn is played in');
   assert.ok(v.indexOf('Names on this map are exact.')>m,'the naming rule is in the prompt');
   assert.equal(r.sys.stable.indexOf('MAP (the drawn map'),-1,'the cached stable half never carries the per-turn block');
 });

 await check('⑫ a card painted before the story moved is refused, never spent on another place; a turn landing under an open pane repaints it; a party off the map is not drawn as there',async()=>{
   const r=await page.evaluate(()=>{atlasPaneClose();mobileDrawerWidth(0);atlasForget();delete worldState.atlas;atlasCreate('campaign-1');worldState.atlas.adopt=false;/* the correction's race, with You are here off */const reg=atlasDoc('campaign-1'),p0=reg.places[0],p2=reg.places[2];
     worldState.world.location='The Salted Wound';worldState.world.sublocation=null;atlasFollow();syncUI();showAtlas();
     __atlasTest.tap({id:p2.id});const label0=document.querySelector('#atlas-card button[data-act="here"]').textContent;
     /* the story moves on under the open card, with no repaint in between (the race itself) */
     worldState.world.location='The Drowned Chapel';const res=__atlasTest.here(),ties=Object.keys(worldState.atlas.names),status1=document.getElementById('atlas-status').textContent,card1=document.getElementById('atlas-card').style.display;
     /* a committed turn repaints the open pane through syncUI */
     worldState.world.location=p0.name;atlasFollow();syncUI();const status2=document.getElementById('atlas-status').textContent,m2=__atlasTest.pane().markers;
     /* the story leaves the mapped places */
     worldState.world.location='Sandpoint';atlasFollow();syncUI();const m3=__atlasTest.pane().markers,status3=document.getElementById('atlas-status').textContent;__atlasTest.tap({id:p0.id});
     const btn3=[].map.call(document.querySelectorAll('#atlas-card button[data-act]'),b=>b.getAttribute('data-act')),text3=document.getElementById('atlas-card').textContent;atlasPaneClose();
     return {label0,res,ties,status1,card1,status2,m2,m3,status3,btn3,text3,p0:p0.name};});
   assert.match(r.label0,/Current location — The Salted Wound/);
   assert.equal(r.res.ok,false);assert.equal(r.res.moved,true);assert.deepEqual(r.ties,[],'the stale tap tied nothing');
   assert.equal(r.status1,'Not placed: the story has moved on — the place to put on the map is now The Drowned Chapel.');assert.equal(r.card1,'none','the stale card is put away');
   assert.equal(r.status2,'The party is in '+r.p0+'.','a turn that lands repaints the open pane');assert.equal(r.m2.length,1);assert.equal(r.m2[0].label,'The party');
   assert.equal(r.m3[0].label,'Last mapped place','off the map: the marker is where the party WAS');assert.match(r.status3,/^"Sandpoint" is not on the map/);
   assert.ok(r.btn3.indexOf('here')>=0,'the town the party left offers Current location: '+JSON.stringify(r.btn3));assert.doesNotMatch(r.text3,/The party is here/);
 });

 await check('⑬ You are here (#702): with adoption on, a start the map does not know is ADDED as a village beside the capital — the pane opens on the party inside it, and the realm shows the new place',async()=>{
   const r=await page.evaluate(()=>{delete worldState.atlas;atlasForget();atlasCreate('campaign-1');worldState.world.location='The Crossroads of Ashenveil';worldState.world.sublocation=null;atlasFollow();syncUI();showAtlas();
     const A=worldState.atlas,p=__atlasTest.pane(),reg=atlasDoc(A.seed),added=reg.places.filter(x=>x.authored);
     return {status:document.getElementById('atlas-status').textContent,zoneKind:A.zones[A.at]&&A.zones[A.at].kind,paneZone:p.zone,at:A.at,added:added.map(x=>x.name),adds:Object.keys(A.adds),edits:(A.zones[A.seed].params.edits||[]).length,told:(A.told||[]).map(t=>t.text),redrawn:!!A.zones[A.seed].redrawn,trail:p.trail||null};});
   assert.equal(r.status,'The party is in The Crossroads of Ashenveil.','the pane says the party is in the story\'s own place, now a place of the map');
   assert.equal(r.zoneKind,'town');assert.equal(r.paneZone,r.at,'the pane opens on the added village\'s own sheet');
   assert.deepEqual(r.added,['The Crossroads of Ashenveil']);assert.deepEqual(r.adds,['The Crossroads of Ashenveil']);assert.equal(r.edits,1,'one edit in the region\'s recipe');
   assert.ok(r.told.some(t=>/was added to the map of .* as a village/.test(t)),'the GM is told: '+JSON.stringify(r.told));assert.equal(r.redrawn,false,'the game\'s own edit is not drift');
 });

 await check('⑭ the HUD and the drawer: the scale bar follows a wheel zoom (its label changes, its width holds), a wider drawer re-fits the dock\'s view, and a campaign that loses its atlas loses the Map tab and is moved off it',async()=>{
   const r=await page.evaluate(()=>new Promise(done=>{const v=_atlasPane.view,st=document.getElementById('atlas-stage'),c=document.getElementById('atlas-canvas'),bar=s=>{const z=s.find(x=>x.t==='text'&&x.text==='0'),l=s.find(x=>x.t==='text'&&/^\d+ (km|m)$/.test(x.text));return z&&l?{w:Math.round(l.x-z.x),label:l.text}:null;};
     const out={host:_atlasPane.host,hud:v.hud(),title:v.hudScene().some(x=>x.t==='text'&&x.text===atlasDoc(_atlasPane.zone).title.name),a:bar(v.hudScene()),k0:v.transform().k,w0:st.clientWidth};
     const rct=c.getBoundingClientRect();c.dispatchEvent(new WheelEvent('wheel',{deltaY:-600,clientX:rct.left+rct.width/2,clientY:rct.top+rct.height/2,bubbles:true,cancelable:true}));
     out.k1=v.transform().k;out.b=bar(v.hudScene());
     mobileDrawerWidth(mobileUI.width+160);
     setTimeout(()=>{out.w1=st.clientWidth;out.k2=v.transform().k;out.cw=c.width;
       delete worldState.atlas;atlasForget();syncUI();out.after={tab:getComputedStyle(document.getElementById('mobile-tab-map')).display,selected:mobileUI.selected,pane:__atlasTest.pane(),dock:document.getElementById('atlas-dock').children.length,body:document.body.classList.contains('atlas-on')};done(out);},120);}));
   assert.equal(r.host,'dock');assert.equal(r.hud,true);assert.equal(r.title,true,'the HUD carries the sheet\'s title');assert.ok(r.a&&r.b,'a scale bar at both zooms: '+JSON.stringify([r.a,r.b]));
   assert.ok(r.k1>r.k0*1.5,'the wheel zoomed in: '+r.k0+' → '+r.k1);assert.ok(r.a.w>=r.w0*0.12&&r.a.w<=r.w0*0.32&&r.b.w>=r.w0*0.12&&r.b.w<=r.w0*0.32,'the bar keeps about a fifth of the view at both zooms: '+JSON.stringify([r.w0,r.a,r.b]));
   assert.ok(r.a.label!==r.b.label||Math.abs(r.a.w*r.k1/r.k0-r.b.w)<=2,'the label followed the zoom (or a kept label\'s bar grew with it): '+JSON.stringify([r.a,r.b]));
   assert.ok(r.w1>r.w0+100,'the drawer grew: '+r.w0+' → '+r.w1);assert.ok(Math.abs(r.cw-r.w1)<4,'the canvas follows the stage: '+r.cw+' vs '+r.w1);assert.ok(r.k2!==r.k1,'a size the dock has not had re-fits the view: '+r.k1+' → '+r.k2);
   assert.deepEqual(r.after,{tab:'none',selected:'party',pane:null,dock:0,body:false},'without an atlas the Map tab goes and the drawer is moved off it');
 });

 assert.deepEqual(errors,[],'page errors: '+errors.join(' | '));
 console.log('screenshots: '+SHOTS+' (atlas-dock.png, atlas-region.png, atlas-town.png, atlas-phone-dock.png, atlas-phone.png)');
}finally{await browser.close();}
console.log(failed?'FAILED — '+failed:'ALL GREEN — the atlas pane (#684)');process.exit(failed?1:0);
})().catch(e=>{console.error(e);process.exit(1);});
