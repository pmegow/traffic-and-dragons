// dev/tests-684-atlas-browser.js — #684: the atlas PANE in the real page (ui-atlas.js over atlas.js and TnDMaps.view).
// Owner rulings 2026-11-04: the door is the location name; new campaigns opt in; exact names. The player's hand tie (We are
// here, then Current location) was RETIRED 2026-11-08 (#711 round 4): party movement is the narrative's; a card offers Add note
// instead, and the plaque's subtitle is the party's location trail (a click on a tier shows that sheet). #711: the pane lives in the side drawer's Map tab (the DOCK) and an enlarge button
// lifts it to full screen; the view draws the library's HUD (title, compass, a scale bar re-measured at the zoom) screen-fixed.
//   ① without an atlas the location name is plain text and opens nothing, and the Map tab is hidden (every existing campaign);
//   ② with one it is a button (role, keyboard) and opens the DOCK on the region — the drawer opens on the Map tab, the HUD is
//     on, the dock is the map alone (no head, no status; the party's dagger and the enlarge button float over the sheet in
//     circles bottom right, the dagger left of the enlarge, the card above both; a card there offers a note, never a tie);
//     the enlarge button opens the FULL pane: ink on the canvas, a head of the select and close alone, no status line;
//   ③ a real click on a town on the canvas shows its card: named, NOT openable (never visited); Add note opens a modal
//     prefilled with the thing's word, the note shows on the card and in the save, an emptied note is removed;
//   ④ the GM's [MAP_PLACE:|at] ties the story's place: the open pane repaints with the party on the town, the trail names
//     realm and town, a click on the town's tier shows its sheet;
//   ⑤ the realm's tier leads back up; the trail stays the party's; the town's card opens its sheet and offers a note;
//   ⑥ a sewer is fogged: only its ways up are drawn, and the pane hands the library the engine's reveal list;
//   ⑦ open water says why it cannot be stood on and offers nothing;
//   ⑧ Escape closes the full pane, the view lets go of the window, and the dock takes the map back;
//   ⑨ a phone (375×667): the place label is the door, the dock fits beside the tabs, the full pane fits, the card sits inside it;
//   ⑩ the opt-in: off by default at both Begin doors, each driven for real and handing startGame its own switch; the
//     next campaign is not mapped; a village and a failed realm begin without a map, loudly;
//   ⑪ a turn sent after the pointer moved outside a turn (a Sync edit) is played on the followed map: the prompt the
//     model is sent carries the MAP block for the NEW place, right after GEOGRAPHY;
//   ⑫ a turn landing under an open pane repaints it; a party off the map is drawn as its last mapped place, and that
//     place's card offers a note, never a tie;
//   ⑭ the framing (owner 2026-11-08, round 3): a sheet opens on the party at ATLAS_HOME_ZOOM times its fit with the sheet
//     FILLING the stage (TnD Maps 0.16.0 bounds); the scale bar's label follows a wheel zoom while the bar keeps its width; a
//     drag past the edge is clamped; a wider drawer reveals the map (no zoom, no move); full screen carries the dock's point
//     and zoom and the dock takes its view back; a campaign that loses its atlas loses the Map tab and is moved off it.
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

 await check('② with an atlas the name is a button and opens the DOCK on the region (the drawer on its Map tab, the HUD on); the enlarge button opens the full pane: ink on the canvas, a head of the select and close, no status line',async()=>{
   const d=await page.evaluate(()=>{atlasCreate('campaign-1');worldState.atlas.adopt=false;/* ②–⑨ probe the player's correction (We are here) and the off-map states: You are here (#702) is switched off for them; ⑬ switches it on */atlasFollow();syncUI();const el=document.getElementById('hud-loc');return {role:el.getAttribute('role'),tab:el.getAttribute('tabindex'),label:el.getAttribute('aria-label'),cursor:getComputedStyle(el).cursor};});
   assert.equal(d.role,'button');assert.equal(d.tab,'0');assert.match(d.label,/^Open the map — The Crossroads of Ashenveil$/);assert.equal(d.cursor,'pointer');
   await page.evaluate(()=>{const el=document.getElementById('hud-loc');el.focus();el.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));});await settle();
   const k=await page.evaluate(()=>{const p=__atlasTest.pane(),dock=document.getElementById('atlas-dock'),c=dock.querySelector('#atlas-canvas'),st=document.getElementById('atlas-stage');return {modal:!!document.getElementById('atlas-modal'),host:p&&p.host,hud:p&&p.hud,open:document.getElementById('rpanel').classList.contains('mobile-open'),width:mobileUI.width,tab:document.getElementById('mobile-tab-map').getAttribute('aria-selected'),mapTab:getComputedStyle(document.getElementById('mobile-tab-map')).display,head:!!document.getElementById('atlas-head'),status:!!document.getElementById('atlas-status'),cw:c?c.width:0,ch:c?c.height:0,stage:[st.clientWidth,st.clientHeight],trail:!!document.getElementById('atlas-trail'),fabs:['atlas-full','atlas-party'].map(id=>{const b=document.getElementById(id);if(!b)return null;const s=getComputedStyle(b),r=b.getBoundingClientRect(),sr=st.getBoundingClientRect();return {pos:s.position,radius:s.borderRadius,w:Math.round(r.width),inside:r.left>=sr.left&&r.top>=sr.top&&r.right<=sr.right&&r.bottom<=sr.bottom,label:b.getAttribute('aria-label'),box:[r.left,r.right,r.bottom],z:parseInt(s.zIndex,10)||0};}),cardZ:parseInt(getComputedStyle(document.getElementById('atlas-card')).zIndex,10)||0,name:worldState.atlas.zones['campaign-1'].name};});
   assert.equal(k.modal,false,'Enter on the name opens the dock, not the modal');assert.equal(k.host,'dock');assert.equal(k.hud,true,'the HUD is on in the dock');assert.equal(k.open,true,'the drawer opened');assert.ok(k.width>=300&&k.width<=460,'the drawer opened at the map width: '+k.width);assert.equal(k.tab,'true','the Map tab is selected');assert.equal(k.mapTab,'block');
   assert.equal(k.head,false,'the dock has no head: the HUD names the sheet');assert.equal(k.status,false,'the dock has no status line');assert.ok(k.cw>200&&k.ch>200&&Math.abs(k.cw-k.stage[0]*devicePixelRatioOf(1))<4,'the dock canvas fills the stage: '+JSON.stringify(k));assert.equal(k.trail,false,'no trail in the dock');
   assert.ok(k.fabs.every(f=>f&&f.pos==='absolute'&&f.radius==='50%'&&f.w>=28&&f.w<=34&&f.inside),'the enlarge button and the party\'s dagger float over the sheet in small circles: '+JSON.stringify(k.fabs));assert.deepEqual(k.fabs.map(f=>f.label),['Open the map full screen','Go to where the party is']);assert.ok(k.fabs[1].box[1]<=k.fabs[0].box[0]&&Math.abs(k.fabs[1].box[2]-k.fabs[0].box[2])<1,'the dagger sits just left of the enlarge button, on the same line: '+JSON.stringify(k.fabs.map(f=>f.box)));assert.ok(k.cardZ>k.fabs[0].z&&k.cardZ>k.fabs[1].z,'the card is above the buttons: '+JSON.stringify([k.cardZ,k.fabs.map(f=>f.z)]));
   const dc=await page.evaluate(()=>{const p=atlasDoc('campaign-1').places[3];__atlasTest.tap({id:p.id});const el=document.getElementById('atlas-card'),r={shown:el.style.display,text:el.textContent,buttons:[].map.call(el.querySelectorAll('button[data-act]'),b=>b.getAttribute('data-act')),name:p.name};__atlasTest.tap(null);return r;});
   assert.equal(dc.shown,'block');assert.ok(dc.text.indexOf(dc.name)>=0,'a dock card names the town');assert.deepEqual(dc.buttons,['dismiss','note'],'a dock card offers a note and no Current location: the party moves through the narrative');assert.doesNotMatch(dc.text,/Current location/);
   await page.screenshot({path:path.join(SHOTS,'atlas-dock.png')});
   await page.evaluate(()=>{document.getElementById('atlas-full').click();});await settle();
   assert.deepEqual(await page.evaluate(()=>({modal:!!document.getElementById('atlas-modal'),host:__atlasTest.pane().host,dock:document.getElementById('atlas-dock').children.length})),{modal:true,host:'full',dock:0},'the enlarge button lifts the one pane to full screen; the dock is emptied');
   const r=await page.evaluate(()=>{const c=document.getElementById('atlas-canvas'),g=c.getContext('2d'),d=g.getImageData(0,0,c.width,c.height).data;let dark=0,i;for(i=0;i<d.length;i+=16)if(d[i]+d[i+1]+d[i+2]<300)dark++;const p=__atlasTest.pane();
     return {modal:!!document.getElementById('atlas-modal'),w:c.width,h:c.height,dark:dark,head:[].map.call(document.querySelectorAll('#atlas-head > *'),e=>e.id),status:!!document.getElementById('atlas-status'),party:!!document.getElementById('atlas-party'),full:!!document.getElementById('atlas-full'),zone:p.zone,doc:p.doc,hud:p.hud,markers:p.markers.length,reveal:p.reveal,card:document.getElementById('atlas-card').style.display,zones:document.getElementById('atlas-zones').options.length,name:worldState.atlas.zones['campaign-1'].name,focusInside:document.getElementById('atlas-modal').contains(document.activeElement)};});
   assert.equal(r.modal,true);assert.ok(r.w>600&&r.h>400,'the canvas fills the pane: '+r.w+'×'+r.h);assert.ok(r.dark>300,'ink was drawn ('+r.dark+' dark samples; the realm carried from the dock at its relative zoom)');
   assert.deepEqual(r.head,['atlas-zones','atlas-close'],'the full pane\'s head is the select and close: no trail, no title, no Party button');assert.equal(r.status,false,'no status line anywhere');assert.equal(r.party,true,'the dagger floats over the full pane too');assert.equal(r.full,false,'no enlarge button in the full pane');assert.equal(r.zone,'campaign-1');assert.equal(r.doc,'campaign-1');assert.equal(r.hud,true,'the HUD is on in the full pane');assert.equal(r.markers,0,'the party is not on the map yet');assert.equal(r.reveal,null);
   assert.equal(r.card,'none');assert.equal(r.zones,2,'the select lists the one mapped place under its heading');assert.equal(r.focusInside,true,'the keyboard is inside the pane');
   await page.screenshot({path:path.join(SHOTS,'atlas-region.png')});
 });

 let p3=null;
 await check('③ a real click on a town shows its card: named, not openable (never visited), no Current location; Add note opens a modal prefilled with the thing\'s word, the saved note shows on the card and in the save, reopens prefilled, and an emptied note is removed',async()=>{
   p3=await page.evaluate(()=>{window.__atlasView=function(){return _atlasPane.view;};const p=atlasDoc('campaign-1').places[3];return {id:p.id,name:p.name,x:p.x,y:p.y,word:atlasCard('campaign-1',{id:p.id}).word};});/* the word the card shows is what the note opens with */
   const c=await clickMap(p3.x,p3.y);assert.equal(c.inside,true,'the town is inside the canvas');await settle();
   const r=await page.evaluate(()=>{const el=document.getElementById('atlas-card');return {shown:el.style.display,text:el.textContent,buttons:[].map.call(el.querySelectorAll('button[data-act]'),b=>b.getAttribute('data-act')),target:__atlasTest.pane().target,zones:Object.keys(worldState.atlas.zones).length};});
   assert.equal(r.shown,'block');assert.ok(r.text.indexOf(p3.name)>=0,'the card names the town: '+r.text);assert.deepEqual(r.target,{id:p3.id});
   assert.deepEqual(r.buttons,['dismiss','note'],'no "Open its sheet" for a town the party has not entered; Add note in place of Current location');
   assert.match(r.text,/Not yet visited/);assert.doesNotMatch(r.text,/Current location|We are here/,'round 4: the hand tie is gone');assert.equal(r.zones,1,'a card draws nothing');
   const n1=await page.evaluate(()=>{document.querySelector('#atlas-card button[data-act="note"]').click();const m=document.getElementById('atlas-note-modal'),t=document.getElementById('atlas-note-text');return {modal:!!m,value:t&&t.value,focused:document.activeElement===t,z:m&&parseInt(getComputedStyle(m).zIndex,10)};});
   assert.equal(n1.modal,true,'Add note opens its modal');assert.equal(n1.value,p3.word,'the modal opens with the thing\'s word');assert.equal(n1.focused,true,'the note box has the keyboard');assert.ok(n1.z>300,'the note modal is above the full pane: '+n1.z);
   const n2=await page.evaluate(()=>{const t=document.getElementById('atlas-note-text');t.value='I owe Henthein 5gp';document.getElementById('atlas-note-save').click();const el=document.getElementById('atlas-card'),saved=parseWorldState(store.get(WSK));return {modal:!!document.getElementById('atlas-note-modal'),notes:Object.assign({},worldState.atlas.notes),text:el.textContent,buttons:[].map.call(el.querySelectorAll('button[data-act]'),b=>b.textContent),savedNotes:saved&&saved.atlas?Object.assign({},saved.atlas.notes):null,toast:__toasts[__toasts.length-1]};});
   assert.equal(n2.modal,false,'Save closes the modal');assert.deepEqual(n2.notes,{['campaign-1|'+p3.id]:'I owe Henthein 5gp'},'the note is on the campaign, keyed zone|thing');assert.ok(n2.text.indexOf('I owe Henthein 5gp')>=0,'the card shows the note');assert.ok(n2.buttons.indexOf('Edit note')>=0,'the button is now Edit note: '+JSON.stringify(n2.buttons));
   assert.deepEqual(n2.savedNotes,n2.notes,'the note is saved at once');assert.equal(n2.toast,'Note saved.');
   const n3=await page.evaluate(()=>{document.querySelector('#atlas-card button[data-act="note"]').click();const t=document.getElementById('atlas-note-text'),v=t.value;document.getElementById('atlas-note-cancel').click();const cancelled={modal:!!document.getElementById('atlas-note-modal'),note:atlasNote('campaign-1',__atlasTest.pane().target.id)};document.querySelector('#atlas-card button[data-act="note"]').click();document.getElementById('atlas-note-text').value='   ';document.getElementById('atlas-note-save').click();return {reopened:v,cancelled,notes:Object.keys(worldState.atlas.notes),toast:__toasts[__toasts.length-1],buttons:[].map.call(document.querySelectorAll('#atlas-card button[data-act]'),b=>b.textContent)};});
   assert.equal(n3.reopened,'I owe Henthein 5gp','the modal reopens with the note in place');assert.deepEqual(n3.cancelled,{modal:false,note:'I owe Henthein 5gp'},'Cancel keeps the note');
   assert.deepEqual(n3.notes,[],'an emptied note is removed');assert.equal(n3.toast,'Note removed.');assert.ok(n3.buttons.indexOf('Add note')>=0,'the button is Add note again');
 });

 await check('④ the GM\'s [MAP_PLACE:|at] ties the story place (the only hand on the map besides the engine): the open pane repaints with the party on the town, the tie is saved, the plaque\'s trail names realm and town, and a click on the town\'s tier shows its sheet with the party',async()=>{
   const r=await page.evaluate(()=>{const A=worldState.atlas;A.adopt=true;A.ptr=null;/* the follow runs again for the same pointer */worldState.placeDecls=[{name:'The Crossroads of Ashenveil',where:'at '+atlasDoc('campaign-1').places[3].name,turn:atlasTurn()}];atlasFollow();saveAll();syncUI();
     const p=__atlasTest.pane(),saved=parseWorldState(store.get(WSK));return {at:A.at,tie:A.names['The Crossroads of Ashenveil'],off:A.off,zone:p.zone,markers:p.markers,trail:p.trail,savedAt:saved&&saved.atlas?saved.atlas.at:null,savedZones:saved&&saved.atlas?Object.keys(saved.atlas.zones).length:0};});
   const town='campaign-1/'+p3.id;
   assert.equal(r.at,town);assert.deepEqual(r.tie,{zone:'campaign-1',id:p3.id,by:'gm'},'the tie is the GM\'s');assert.equal(r.off,null);
   assert.equal(r.zone,'campaign-1','the open pane stays on its sheet');assert.equal(r.markers.length,1);assert.equal(r.markers[0].kind,'party');assert.deepEqual([r.markers[0].x,r.markers[0].y],[p3.x,p3.y],'the party marker sits on the town');
   assert.deepEqual(r.trail.map(t=>[t.text,t.current]),[[r.trail[0].text,true],[p3.name,false]],'the trail: the realm (current), then the town');assert.equal(r.savedAt,town,'the tie is saved');assert.equal(r.savedZones,2);
   /* a real click on the town's tier of the plaque */
   const k=await page.evaluate(()=>{const v=_atlasPane.view,c=document.getElementById('atlas-canvas'),r=c.getBoundingClientRect(),tier=v.hudScene().find(x=>x.meta&&x.meta.hud==='trail'&&!x.meta.current),at={clientX:r.left+(tier.box[0]+tier.box[2])/2,clientY:r.top+(tier.box[1]+tier.box[3])/2,bubbles:true,button:0};c.dispatchEvent(new MouseEvent('mousedown',at));window.dispatchEvent(new MouseEvent('mouseup',at));const p=__atlasTest.pane();return {text:tier.text,zone:p.zone,markers:p.markers.length,trail:p.trail.map(t=>[t.text,t.current]),card:document.getElementById('atlas-card').style.display};});
   assert.equal(k.text,p3.name);assert.equal(k.zone,town,'the tier opens the town sheet');assert.equal(k.markers,1,'the party is drawn on it');assert.deepEqual(k.trail.map(t=>t[1]),[false,true],'the town is now the current tier');assert.equal(k.card,'none','the tier click opened no card');
   await page.screenshot({path:path.join(SHOTS,'atlas-town.png')});
 });

 await check('⑤ the realm\'s tier leads back up: the trail stays the party\'s (realm, then town — the town no longer current), the party stands at the town, whose card now opens its sheet and offers a note',async()=>{
   const a=await page.evaluate(()=>{const v=_atlasPane.view,c=document.getElementById('atlas-canvas'),r=c.getBoundingClientRect(),tier=v.hudScene().find(x=>x.meta&&x.meta.hud==='trail'&&!x.meta.current),at={clientX:r.left+(tier.box[0]+tier.box[2])/2,clientY:r.top+(tier.box[1]+tier.box[3])/2,bubbles:true,button:0};c.dispatchEvent(new MouseEvent('mousedown',at));window.dispatchEvent(new MouseEvent('mouseup',at));const p=__atlasTest.pane();return {tier:tier.text,zone:p.zone,m:p.markers,trail:p.trail.map(t=>[t.text,t.current])};});await settle();
   assert.equal(a.zone,'campaign-1','the realm\'s tier shows the region');assert.equal(a.m.length,1);assert.deepEqual([a.m[0].x,a.m[0].y],[p3.x,p3.y],'the party marker sits on the town');
   assert.deepEqual(a.trail,[[a.tier,true],[p3.name,false]],'going up leaves the trail as the party\'s: realm (shown), town');
   await clickMap(p3.x,p3.y);await settle();
   const r=await page.evaluate(()=>{const el=document.getElementById('atlas-card');return {text:el.textContent,buttons:[].map.call(el.querySelectorAll('button[data-act]'),b=>b.getAttribute('data-act'))};});
   assert.match(r.text,/The party is here\./);assert.deepEqual(r.buttons,['dismiss','open','note'],'the town opens and can be noted');
   await page.evaluate(()=>{document.querySelector('#atlas-card button[data-act="open"]').click();});await settle();
   assert.equal(await page.evaluate(()=>__atlasTest.pane().zone),'campaign-1/'+p3.id);
 });

 await check('⑥ a sewer is fogged: only its ways up are drawn, and the pane hands the library the engine\'s reveal list',async()=>{
   const r=await page.evaluate(()=>{const reg=atlasDoc('campaign-1'),p0=reg.places[0];worldState.world.location=p0.name;atlasFollow();const town=atlasDoc(worldState.atlas.at),g=town.portals.filter(p=>p.kind==='grate')[0];worldState.world.sublocation=g.name;atlasFollow();syncUI();
     const z=worldState.atlas.at;showAtlas();const p=__atlasTest.pane(),doc=atlasDoc(z);return {z:z,kind:worldState.atlas.zones[z].kind,zone:p.zone,reveal:p.reveal,expect:atlasReveal(z),rooms:doc.rooms.length,ups:doc.portals.filter(q=>q.way==='up').length,markers:p.markers.length};});
   assert.equal(r.kind,'dungeon');assert.equal(r.zone,r.z,'the pane opens where the party is');assert.deepEqual(r.reveal,r.expect);assert.equal(r.reveal.length,r.ups,'the ways up only');assert.ok(r.reveal.length<r.rooms,'the rest of the sewer is hidden');
   assert.equal(r.markers,1,'the party is drawn in the sewer');
 });

 await check('⑦ open water says why it cannot be stood on and offers nothing (a point has no note)',async()=>{
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

 await check('⑫ a turn landing under an open pane repaints it (the party marker moves); a party off the map is drawn as its last mapped place, and that place\'s card offers no Current location',async()=>{
   const r=await page.evaluate(()=>{atlasPaneClose();mobileDrawerWidth(0);atlasForget();delete worldState.atlas;atlasCreate('campaign-1');worldState.atlas.adopt=false;const reg=atlasDoc('campaign-1'),p0=reg.places[0],p2=reg.places[2];
     worldState.world.location=p0.name;worldState.world.sublocation=null;atlasFollow();syncUI();showAtlasFull('campaign-1');const m1=__atlasTest.pane().markers;
     /* a committed turn repaints the open pane through syncUI */
     worldState.world.location=p2.name;atlasFollow();syncUI();const m2=__atlasTest.pane().markers;
     /* the story leaves the mapped places */
     worldState.world.location='Sandpoint';atlasFollow();syncUI();const m3=__atlasTest.pane().markers;__atlasTest.tap({id:p2.id});
     const btn3=[].map.call(document.querySelectorAll('#atlas-card button[data-act]'),b=>b.getAttribute('data-act')),text3=document.getElementById('atlas-card').textContent;atlasPaneClose();
     return {m1,m2,m3,btn3,text3,p0:[p0.x,p0.y],p2:[p2.x,p2.y]};});
   assert.equal(r.m1.length,1);assert.deepEqual([r.m1[0].x,r.m1[0].y],r.p0,'the party is drawn at the first town');
   assert.equal(r.m2.length,1,'a turn that lands repaints the open pane');assert.equal(r.m2[0].label,'The party');assert.deepEqual([r.m2[0].x,r.m2[0].y],r.p2,'the marker moved to the second town');
   assert.equal(r.m3[0].label,'Last mapped place','off the map: the marker is where the party WAS');
   assert.deepEqual(r.btn3,['dismiss','open','note'],'the town the party left opens and can be noted, nothing more: '+JSON.stringify(r.btn3));assert.doesNotMatch(r.text3,/The party is here|Current location/);
 });

 await check('⑬ You are here (#702): with adoption on, a start the map does not know is ADDED as a village beside the capital — the pane opens on the party inside it, and the realm shows the new place',async()=>{
   const r=await page.evaluate(()=>{delete worldState.atlas;atlasForget();atlasCreate('campaign-1');worldState.world.location='The Crossroads of Ashenveil';worldState.world.sublocation=null;atlasFollow();syncUI();showAtlasFull();
     const A=worldState.atlas,p=__atlasTest.pane(),reg=atlasDoc(A.seed),added=reg.places.filter(x=>x.authored);
     return {markers:p.markers.map(m=>m.label),zoneKind:A.zones[A.at]&&A.zones[A.at].kind,paneZone:p.zone,at:A.at,added:added.map(x=>x.name),adds:Object.keys(A.adds),edits:(A.zones[A.seed].params.edits||[]).length,told:(A.told||[]).map(t=>t.text),redrawn:!!A.zones[A.seed].redrawn,trail:p.trail||null};});
   assert.ok(r.markers.length===1&&/^The party/.test(r.markers[0]),'the pane opens with the party on the added village\'s own sheet ("somewhere here": the town is known, not the spot): '+JSON.stringify(r.markers));
   assert.equal(r.zoneKind,'town');assert.equal(r.paneZone,r.at,'the pane opens on the added village\'s own sheet');
   assert.deepEqual(r.added,['The Crossroads of Ashenveil']);assert.deepEqual(r.adds,['The Crossroads of Ashenveil']);assert.equal(r.edits,1,'one edit in the region\'s recipe');
   assert.ok(r.told.some(t=>/was added to the map of .* as a village/.test(t)),'the GM is told: '+JSON.stringify(r.told));assert.equal(r.redrawn,false,'the game\'s own edit is not drift');
 });

 await check('⑭ the framing (owner 2026-11-08): a sheet opens on the party at four times its fit with the sheet FILLING the stage; the HUD\'s scale bar follows a wheel zoom (its label changes, its width holds); a drag past the edge is clamped; a wider drawer reveals the map without moving or zooming it; full screen carries the dock\'s point and zoom; back from it the dock shows what the player left; a campaign that loses its atlas loses the Map tab and is moved off it',async()=>{
   await page.evaluate(()=>{atlasPaneClose();mobileDrawerWidth(0);showAtlas();});await settle();await page.waitForTimeout(150);
   const edges=()=>page.evaluate(()=>{const v=_atlasPane.view,sc=v.scene(),st=document.getElementById('atlas-stage'),T=v.transform(),X=sc.x0||0,Y=sc.y0||0,w=st.clientWidth,h=st.clientHeight,fitK=Math.min((w-32)/sc.width,(h-32)/sc.height),p=atlasPartyIn(_atlasPane.zone);return {host:_atlasPane.host,zone:_atlasPane.zone,bounds:v.bounds(),k:T.k,fitK,w,h,left:T.x+X*T.k,top:T.y+Y*T.k,right:T.x+(X+sc.width)*T.k,bottom:T.y+(Y+sc.height)*T.k,party:p?{sx:T.x+p.x*T.k,sy:T.y+p.y*T.k}:null,cx:(w/2-T.x)/T.k,cy:(h/2-T.y)/T.k};});
   const e0=await edges();
   assert.equal(e0.host,'dock');assert.equal(e0.bounds,true,'the view keeps the sheet filling the stage');assert.ok(Math.abs(e0.k/e0.fitK-4)<0.05,'the sheet opens at four times its fit: '+e0.k+' vs fit '+e0.fitK);
   assert.ok(e0.left<=0.5&&e0.top<=0.5&&e0.right>=e0.w-0.5&&e0.bottom>=e0.h-0.5,'no paper edge inside the stage: '+JSON.stringify(e0));
   assert.ok(e0.party&&e0.party.sx>0&&e0.party.sx<e0.w&&e0.party.sy>0&&e0.party.sy<e0.h,'the party is on screen: '+JSON.stringify(e0.party));
   const fill=await page.evaluate(()=>{const c=document.getElementById('atlas-canvas'),g=c.getContext('2d'),d=g.getImageData(0,0,c.width,c.height).data;let bg=0,n=0;for(let i=0;i<d.length;i+=64){n++;if(d[i]===0xd9&&d[i+1]===0xd0&&d[i+2]===0xbd)bg++;}return bg/n;});
   assert.ok(fill<0.02,'the stage is sheet, not the background colour: '+(fill*100).toFixed(1)+'% background');
   /* the wheel: the scale bar follows the zoom */
   const r=await page.evaluate(()=>{const v=_atlasPane.view,st=document.getElementById('atlas-stage'),c=document.getElementById('atlas-canvas'),bar=s=>{const z=s.find(x=>x.t==='text'&&x.text==='0'),l=s.find(x=>x.t==='text'&&/^\d+ (km|m)$/.test(x.text));return z&&l?{w:Math.round(l.x-z.x),label:l.text}:null;};
     const out={hud:v.hud(),title:v.hudScene().some(x=>x.t==='text'&&x.text===atlasDoc(_atlasPane.zone).title.name),a:bar(v.hudScene()),k0:v.transform().k,w0:st.clientWidth};
     const rct=c.getBoundingClientRect();c.dispatchEvent(new WheelEvent('wheel',{deltaY:-600,clientX:rct.left+rct.width/2,clientY:rct.top+rct.height/2,bubbles:true,cancelable:true}));
     out.k1=v.transform().k;out.b=bar(v.hudScene());return out;});
   assert.equal(r.hud,true);assert.equal(r.title,true,'the HUD carries the sheet\'s title');assert.ok(r.a&&r.b,'a scale bar at both zooms: '+JSON.stringify([r.a,r.b]));
   assert.ok(r.k1>r.k0*1.5,'the wheel zoomed in: '+r.k0+' → '+r.k1);assert.ok(r.a.w>=r.w0*0.12&&r.a.w<=r.w0*0.32&&r.b.w>=r.w0*0.12&&r.b.w<=r.w0*0.32,'the bar keeps about a fifth of the view at both zooms: '+JSON.stringify([r.w0,r.a,r.b]));
   assert.ok(r.a.label!==r.b.label||Math.abs(r.a.w*r.k1/r.k0-r.b.w)<=2,'the label followed the zoom (or a kept label\'s bar grew with it): '+JSON.stringify([r.a,r.b]));
   /* a drag far past the edge is clamped: the sheet's top-left corner never comes inside the stage */
   await page.evaluate(()=>{const c=document.getElementById('atlas-canvas'),r=c.getBoundingClientRect(),o={bubbles:true,cancelable:true,button:0};c.dispatchEvent(new MouseEvent('mousedown',Object.assign({clientX:r.left+20,clientY:r.top+20},o)));window.dispatchEvent(new MouseEvent('mousemove',Object.assign({clientX:r.left+6000,clientY:r.top+4000},o)));window.dispatchEvent(new MouseEvent('mouseup',Object.assign({clientX:r.left+6000,clientY:r.top+4000},o)));});/* a drag of thousands of px: past the sheet's corner at any zoom */
   const e1=await edges();assert.ok(Math.abs(e1.left)<0.5&&Math.abs(e1.top)<0.5,'the drag stopped at the sheet\'s corner: '+JSON.stringify(e1));
   /* the drawer pulled wider: the zoom holds and the map point under the stage's right edge (the screen's) is the same — from a
      view away from the sheet's edges (the dagger button: the party at four times the fit); at an edge the bounds win and the
      sheet's edge keeps to the stage's */
   await page.evaluate(()=>{document.getElementById('atlas-party').click();});await page.waitForTimeout(100);
   const eP=await edges();assert.ok(Math.abs(eP.k/eP.fitK-4)<0.05&&eP.left<-100&&eP.right>eP.w+100,'the dagger button frames the party at four times the fit, away from the edges: '+JSON.stringify(eP));
   const d0=await page.evaluate(()=>{const v=_atlasPane.view,st=document.getElementById('atlas-stage'),T=v.transform();return {w:st.clientWidth,k:T.k,rightX:(st.clientWidth-T.x)/T.k};});
   await page.evaluate(()=>{mobileDrawerWidth(mobileUI.width+160);});await page.waitForTimeout(150);
   const d1=await page.evaluate(()=>{const v=_atlasPane.view,st=document.getElementById('atlas-stage'),T=v.transform(),c=document.getElementById('atlas-canvas');return {w:st.clientWidth,k:T.k,rightX:(st.clientWidth-T.x)/T.k,cw:c.width};});
   assert.ok(d1.w>d0.w+100,'the drawer grew: '+d0.w+' → '+d1.w);assert.ok(Math.abs(d1.cw-d1.w)<4,'the canvas follows the stage: '+d1.cw+' vs '+d1.w);
   assert.ok(Math.abs(d1.k-d0.k)<1e-9,'the pull did not zoom: '+d0.k+' → '+d1.k);assert.ok(Math.abs(d1.rightX-d0.rightX)*d0.k<1.5,'the map stayed where it was on screen (revealed, not moved): '+JSON.stringify([d0,d1]));
   /* full screen carries the dock's point and zoom; back, the dock shows what the player left */
   const m0=await edges();
   await page.evaluate(()=>{document.getElementById('atlas-full').click();});await settle();
   const m1=await edges(),sc=Math.min(m1.w/m0.w,m1.h/m0.h);assert.equal(m1.host,'full');assert.ok(Math.abs(m1.k-m0.k*sc)<1e-6,'full screen keeps the dock\'s RELATIVE zoom (scaled by the room gained, '+sc.toFixed(3)+'): '+m0.k+' → '+m1.k);
   assert.ok(Math.abs(m1.cx-m0.cx)*m1.k<=Math.max(1.5,(m1.w-m0.w*sc)/2+1.5)&&Math.abs(m1.cy-m0.cy)*m1.k<=Math.max(1.5,(m1.h-m0.h*sc)/2+1.5),'full screen looks at the dock\'s point (the bounds may shift it by no more than the room gained): '+JSON.stringify([m0,m1]));
   await page.evaluate(()=>{document.getElementById('atlas-modal').dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));});await settle();await page.waitForTimeout(150);
   const m2=await edges();
   assert.equal(m2.host,'dock');assert.equal(m2.zone,m0.zone);assert.ok(Math.abs(m2.k-m0.k)<1e-6&&Math.abs(m2.cx-m0.cx)*m0.k<1.5&&Math.abs(m2.cy-m0.cy)*m0.k<1.5,'back from full screen the dock shows what the player left (zoom and pan): '+JSON.stringify([m0,m2]));
   const after=await page.evaluate(()=>{delete worldState.atlas;atlasForget();syncUI();return {tab:getComputedStyle(document.getElementById('mobile-tab-map')).display,selected:mobileUI.selected,pane:__atlasTest.pane(),dock:document.getElementById('atlas-dock').children.length,body:document.body.classList.contains('atlas-on')};});
   assert.deepEqual(after,{tab:'none',selected:'party',pane:null,dock:0,body:false},'without an atlas the Map tab goes and the drawer is moved off it');
 });

 assert.deepEqual(errors,[],'page errors: '+errors.join(' | '));
 console.log('screenshots: '+SHOTS+' (atlas-dock.png, atlas-region.png, atlas-town.png, atlas-phone-dock.png, atlas-phone.png)');
}finally{await browser.close();}
console.log(failed?'FAILED — '+failed:'ALL GREEN — the atlas pane (#684)');process.exit(failed?1:0);
})().catch(e=>{console.error(e);process.exit(1);});
