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
// TND_SHOT_DIR=<dir> keeps the screenshots (atlas-region.png, atlas-town.png, atlas-up.png, atlas-phone.png); the OS temp dir otherwise.
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
   const d=await page.evaluate(()=>{atlasCreate('campaign-1');worldState.atlas.fog=false;/* #717: ②–⑤ read cards and clicks on a WHOLE sheet (an unvisited town, a far click); the fog is switched on from ⑥ and is ⑮'s subject */worldState.atlas.adopt=false;/* ②–⑨ probe the player's correction (We are here) and the off-map states: You are here (#702) is switched off for them; ⑬ switches it on */atlasFollow();syncUI();const el=document.getElementById('hud-loc');return {role:el.getAttribute('role'),tab:el.getAttribute('tabindex'),label:el.getAttribute('aria-label'),cursor:getComputedStyle(el).cursor};});
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
   /* a real click on the town's tier of the plaque — after a frame: the view hit-tests the tiers' boxes AS LAST DRAWN, and setHudTrail (the repaint above) clears them until the next draw. The click used to be sent in the same breath as the repaint. It was red 6 runs of 6 at an intermediate state of the #717 work (2026-11-09); the independent review could not reproduce that at the committed state (6 of 6 green without this wait), so WHY it flipped is unproven — the wait follows from the library's contract and costs a frame */
   await settle();
   const k=await page.evaluate(()=>{const v=_atlasPane.view,c=document.getElementById('atlas-canvas'),r=c.getBoundingClientRect(),tier=v.hudScene().find(x=>x.meta&&x.meta.hud==='trail'&&!x.meta.current),at={clientX:r.left+(tier.box[0]+tier.box[2])/2,clientY:r.top+(tier.box[1]+tier.box[3])/2,bubbles:true,button:0};c.dispatchEvent(new MouseEvent('mousedown',at));window.dispatchEvent(new MouseEvent('mouseup',at));const p=__atlasTest.pane();return {text:tier.text,zone:p.zone,markers:p.markers.length,trail:p.trail.map(t=>[t.text,t.current]),card:document.getElementById('atlas-card').style.display};});
   assert.equal(k.text,p3.name);assert.equal(k.zone,town,'the tier opens the town sheet');assert.equal(k.markers,1,'the party is drawn on it');assert.deepEqual(k.trail.map(t=>t[1]),[false,true],'the town is now the current tier');assert.equal(k.card,'none','the tier click opened no card');
   await page.screenshot({path:path.join(SHOTS,'atlas-town.png')});
 });

 await check('⑤ the realm\'s tier leads back up: the trail stays the party\'s (realm, then town — the town no longer current), the party stands at the town, whose card now opens its sheet and offers a note',async()=>{
   await settle();/* the tiers are clickable once drawn (see ④) */
   const a=await page.evaluate(()=>{const v=_atlasPane.view,c=document.getElementById('atlas-canvas'),r=c.getBoundingClientRect(),tier=v.hudScene().find(x=>x.meta&&x.meta.hud==='trail'&&!x.meta.current),at={clientX:r.left+(tier.box[0]+tier.box[2])/2,clientY:r.top+(tier.box[1]+tier.box[3])/2,bubbles:true,button:0};c.dispatchEvent(new MouseEvent('mousedown',at));window.dispatchEvent(new MouseEvent('mouseup',at));const p=__atlasTest.pane();return {tier:tier.text,zone:p.zone,m:p.markers,trail:p.trail.map(t=>[t.text,t.current])};});await settle();
   assert.equal(a.zone,'campaign-1','the realm\'s tier shows the region');assert.equal(a.m.length,1);assert.deepEqual([a.m[0].x,a.m[0].y],[p3.x,p3.y],'the party marker sits on the town');
   assert.deepEqual(a.trail,[[a.tier,true],[p3.name,false]],'going up leaves the trail as the party\'s: realm (shown), town');
   /* going up obeys the home zoom (owner 2026-11-09): the realm opens on the party at ATLAS_HOME_ZOOM times its fit, never the whole sheet */
   const zm=await page.evaluate(()=>{const v=_atlasPane.view,sc=v.scene(),st=document.getElementById('atlas-stage'),T=v.transform(),w=st.clientWidth,h=st.clientHeight,fitK=Math.min((w-32)/sc.width,(h-32)/sc.height),p=atlasPartyIn(_atlasPane.zone);return {k:T.k,fitK,w,h,home:ATLAS_HOME_ZOOM,party:p?{sx:T.x+p.x*T.k,sy:T.y+p.y*T.k}:null};});
   assert.ok(Math.abs(zm.k/zm.fitK-zm.home)<0.05,'the realm\'s tier opens at '+zm.home+' times its fit, not the whole sheet: '+zm.k+' vs fit '+zm.fitK);
   assert.ok(zm.party&&zm.party.sx>0&&zm.party.sx<zm.w&&zm.party.sy>0&&zm.party.sy<zm.h,'the party is on screen after going up: '+JSON.stringify(zm));
   await page.screenshot({path:path.join(SHOTS,'atlas-up.png')});
   await clickMap(p3.x,p3.y);await settle();
   const r=await page.evaluate(()=>{const el=document.getElementById('atlas-card');return {text:el.textContent,buttons:[].map.call(el.querySelectorAll('button[data-act]'),b=>b.getAttribute('data-act'))};});
   assert.match(r.text,/The party is here\./);assert.deepEqual(r.buttons,['dismiss','open','note'],'the town opens and can be noted');
   await page.evaluate(()=>{document.querySelector('#atlas-card button[data-act="open"]').click();});await settle();
   assert.equal(await page.evaluate(()=>__atlasTest.pane().zone),'campaign-1/'+p3.id);
 });

 await check('⑥ a sewer is fogged: only the ways up the town\'s sheet shows are drawn (#717 review, finding 2: never one the town\'s fog hides), and the pane hands the library the engine\'s reveal list',async()=>{
   const r=await page.evaluate(()=>{delete worldState.atlas.fog;/* #717: the campaign's default from here on — the fog is on */const reg=atlasDoc('campaign-1'),p0=reg.places[0];worldState.world.location=p0.name;atlasFollow();const town=atlasDoc(worldState.atlas.at),g=town.portals.filter(p=>p.kind==='grate')[0];worldState.world.sublocation=g.name;atlasFollow();syncUI();
     const z=worldState.atlas.at;showAtlas();const p=__atlasTest.pane(),doc=atlasDoc(z),tz=worldState.atlas.zones[z].parent,ups=doc.portals.filter(q=>q.way==='up'),shows=q=>{const t=atlasThingById(town,q.to.id);return !!t&&atlasFogShows(tz,t.x,t.y);};return {z:z,kind:worldState.atlas.zones[z].kind,zone:p.zone,reveal:p.reveal,expect:atlasReveal(z),rooms:doc.rooms.length,ups:ups.length,shown:ups.filter(shows).map(q=>q.id),hidden:ups.filter(q=>!shows(q)).map(q=>q.id),spot:worldState.atlas.spot,markers:p.markers.length};});
   assert.equal(r.kind,'dungeon');assert.equal(r.zone,r.z,'the pane opens where the party is');assert.deepEqual(r.reveal,r.expect);assert.deepEqual(r.reveal.slice().sort(),r.shown.slice().sort(),'the ways up the town\'s sheet shows, and nothing else');assert.ok(r.shown.indexOf(r.spot)>=0,'the way the party came down is one of them');assert.ok(r.hidden.length>=1&&r.hidden.every(id=>r.reveal.indexOf(id)<0),'fixture: a way up the town\'s fog hides ('+r.hidden.join(',')+') is not drawn below');assert.ok(r.reveal.length<r.rooms,'the rest of the sewer is hidden');
   assert.equal(r.markers,1,'the party is drawn in the sewer');
 });

 await check('⑦ open water says why it cannot be stood on and offers nothing (a point has no note) — and through the fog a tap on it says nothing at all (#717)',async()=>{
   const fogged=await page.evaluate(()=>{__atlasTest.show('campaign-1');const sea=atlasDoc('campaign-1').features.filter(f=>f.kind==='sea')[0];const card=__atlasTest.tap({x:sea.x,y:sea.y});const shown=document.getElementById('atlas-card').style.display;worldState.atlas.fog=false;return {card:card,shown:shown,far:!atlasFogShows('campaign-1',sea.x,sea.y)};});
   assert.equal(fogged.card,null,'unexplored water has no card');assert.equal(fogged.shown,'none');
   const r=await page.evaluate(()=>{__atlasTest.show('campaign-1');const sea=atlasDoc('campaign-1').features.filter(f=>f.kind==='sea')[0];const before=JSON.stringify(worldState.atlas);__atlasTest.tap({x:sea.x,y:sea.y});const el=document.getElementById('atlas-card');return {text:el.textContent,buttons:[].map.call(el.querySelectorAll('button[data-act]'),b=>b.getAttribute('data-act')),same:JSON.stringify(worldState.atlas)===before};});
   assert.match(r.text,/Open country/);assert.match(r.text,/sea/);assert.deepEqual(r.buttons,['dismiss']);assert.equal(r.same,true);
   await page.evaluate(()=>{delete worldState.atlas.fog;__atlasTest.tap(null);__atlasTest.show('campaign-1');});/* the fog back on for what follows */
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
   /* the DOCK's trail (owner 2026-11-09, the drawer map): a real click on the realm's tier goes up a level at four times the fit on the party, and the party's own tier comes back the same */
   const tierClick=up=>page.evaluate(u=>{const v=_atlasPane.view,c=document.getElementById('atlas-canvas'),r=c.getBoundingClientRect(),tiers=v.hudScene().filter(x=>x.meta&&x.meta.hud==='trail'&&!x.meta.current),tier=u?tiers[0]:tiers[tiers.length-1],at={clientX:r.left+(tier.box[0]+tier.box[2])/2,clientY:r.top+(tier.box[1]+tier.box[3])/2,bubbles:true,button:0};c.dispatchEvent(new MouseEvent('mousedown',at));window.dispatchEvent(new MouseEvent('mouseup',at));return tier.meta.key;},up);
   const upKey=await tierClick(true),eU=await edges();
   assert.equal(eU.host,'dock');assert.equal(eU.zone,upKey,'the realm\'s tier showed its sheet in the dock');assert.notEqual(eU.zone,e0.zone,'the dock went up a level');
   assert.ok(Math.abs(eU.k/eU.fitK-4)<0.05,'going up in the dock keeps four times the fit, not the whole sheet: '+eU.k+' vs fit '+eU.fitK);
   assert.ok(eU.party&&eU.party.sx>0&&eU.party.sx<eU.w&&eU.party.sy>0&&eU.party.sy<eU.h,'the party is on screen after going up in the dock: '+JSON.stringify(eU.party));
   await tierClick(false);const eB=await edges();assert.equal(eB.zone,e0.zone,'the party\'s tier came back down');assert.ok(Math.abs(eB.k/eB.fitK-4)<0.05,'and at four times its fit: '+eB.k+' vs '+eB.fitK);
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

 await check('⑮ the fog of war (#717, owner 2026-11-09): the pane hands the view the engine\'s reveal; on the canvas the ground the party walked is drawn and a far quarter is blank paper, which a click cannot read; a move under the open pane widens it; the realm shows the town and nothing else; full screen carries it; with the campaign\'s fog off the sheet is whole again',async()=>{
   await page.setViewportSize({width:1280,height:800});
   const s=await page.evaluate(()=>{window.dispatchEvent(new Event('resize'));if(typeof mobileInit==='function')mobileInit();
     atlasPaneClose();mobileDrawerWidth(0);atlasForget();delete worldState.atlas;atlasCreate('campaign-1');worldState.atlas.adopt=false;
     const reg=atlasDoc('campaign-1'),p0=reg.places[0];worldState.world.location=p0.name;worldState.world.sublocation=null;atlasFollow();
     const zone=worldState.atlas.at,town=atlasDoc(zone),inn=town.establishments.filter(e=>e.kind==='inn')[0],market=town.landmarks.filter(l=>l.kind==='market')[0];
     worldState.world.sublocation=inn.name;atlasFollow();worldState.world.sublocation=market.name;atlasFollow();syncUI();showAtlas();
     /* the ink under a map point: dark pixels in a box of `half` CSS px round where the view draws it */
     window.__inkAt=function(x,y,half){const v=_atlasPane.view,c=document.getElementById('atlas-canvas'),T=v.transform(),dpr=c.width/c.clientWidth,g=c.getContext('2d'),w=Math.round(half*2*dpr),d=g.getImageData(Math.round((T.x+x*T.k-half)*dpr),Math.round((T.y+y*T.k-half)*dpr),w,w).data;let dark=0;for(let i=0;i<d.length;i+=4)if(d[i]+d[i+1]+d[i+2]<300)dark++;return dark;};
     const spec=atlasReveal(zone),near=(q)=>{let m=1e9;spec.points.forEach(p=>{m=Math.min(m,Math.hypot(p[0]-q.x,p[1]-q.y));});spec.paths.forEach(pa=>pa.forEach(p=>{m=Math.min(m,Math.hypot(p[0]-q.x,p[1]-q.y));}));return m;};
     const far=town.establishments.filter(e=>e.id!==inn.id).map(e=>({id:e.id,name:e.name,x:e.x,y:e.y,d:near(e)})).sort((a,b)=>b.d-a.d)[0];
     /* a third place to walk to, on the other side of the town from the far quarter (so the far quarter stays unexplored) and not yet shown */
     const third=town.establishments.filter(e=>e.id!==inn.id&&e.id!==far.id&&near(e)*town.frame.kmPerUnit*1000>100&&town.establishments.filter(q=>q.name===e.name).length===1).map(e=>({id:e.id,name:e.name,x:e.x,y:e.y,d:Math.hypot(e.x-far.x,e.y-far.y)})).sort((a,b)=>b.d-a.d)[0];
     return {zone,p0:{id:p0.id,name:p0.name,x:p0.x,y:p0.y},inn:{x:inn.x,y:inn.y,name:inn.name},market:{x:market.x,y:market.y},far,third,unit:town.frame.kmPerUnit*1000,farTown:reg.places.map(p=>({id:p.id,x:p.x,y:p.y,d:Math.hypot(p.x-p0.x,p.y-p0.y)})).sort((a,b)=>b.d-a.d)[0]};});
   await settle();await page.waitForTimeout(200);
   const r1=await page.evaluate(()=>{const p=__atlasTest.pane();return {host:p.host,zone:p.zone,reveal:p.reveal,expect:atlasReveal(p.zone)};});
   assert.equal(r1.host,'dock');assert.equal(r1.zone,s.zone,'the dock opens on the town the party is in');assert.deepEqual(r1.reveal,r1.expect,'the view wears the engine\'s reveal');
   assert.equal(r1.reveal.radiusM,100);assert.equal(r1.reveal.points.length,2,'the inn and the market');assert.ok(r1.reveal.paths.length>=1,'and the way between them');
   assert.ok(s.far.d*s.unit>180,'the fixture town has a house well beyond the 100 m radius from the walk: '+Math.round(s.far.d*s.unit)+' m');
   await page.evaluate(()=>{[].forEach.call(document.querySelectorAll('.tnd-toast'),t=>t.remove());});/* the suite's toasts would cover the map in the pictures */
   await page.screenshot({path:path.join(SHOTS,'atlas-fog-dock.png')});
   /* the render is ground truth: ink where the party walked, blank paper far from it */
   const look=async(q)=>{await page.evaluate(q=>{const v=_atlasPane.view;v.center(q.x,q.y,v.transform().k);},q);await settle();await page.waitForTimeout(120);return page.evaluate(q=>__inkAt(q.x,q.y,36),q);};
   const inkWalked=await look(s.market),inkFar=await look(s.far);
   assert.ok(inkWalked>60,'the market the party stands at is drawn: '+inkWalked+' dark pixels');assert.equal(inkFar,0,'a quarter the party never walked is blank paper: '+inkFar+' dark pixels round '+s.far.name);
   const c1=await clickMap(s.far.x,s.far.y);assert.equal(c1.inside,true);await settle();
   assert.equal(await page.evaluate(()=>document.getElementById('atlas-card').style.display),'none','a click on unexplored ground reads nothing');
   /* a move under the open pane widens the fog */
   const r2=await page.evaluate(q=>{worldState.world.sublocation=q.name;atlasFollow();syncUI();const p=__atlasTest.pane();return {reveal:p.reveal,expect:atlasReveal(p.zone),zone:p.zone,at:worldState.atlas.at,farShown:atlasFogShows(p.zone,q.far.x,q.far.y)};},{name:s.third.name,far:s.far});
   assert.equal(r2.farShown,false,'the walk to '+s.third.name+' leaves the far quarter unexplored (the fixture)');
   assert.equal(r2.zone,s.zone,'the pane stays on the town\'s sheet');assert.deepEqual(r2.reveal,r2.expect,'the repaint wears the new reveal');
   assert.equal(r2.reveal.points.length,3,'a third stand');assert.ok(r2.reveal.paths.length>r1.reveal.paths.length,'and the way to it');
   await settle();await page.waitForTimeout(120);assert.ok(await look(s.third)>20,'the place the party just reached is drawn');
   /* the campaign's switch: the same far quarter, whole */
   await page.evaluate(()=>{worldState.atlas.fog=false;__atlasTest.show(_atlasPane.zone);});await settle();
   assert.equal(await page.evaluate(()=>__atlasTest.pane().reveal),null,'fog off: the view is handed null, and the fog it wore is lifted');
   const inkFarOff=await look(s.far);assert.ok(inkFarOff>60,'with the fog off the far quarter is drawn: '+inkFarOff);
   await clickMap(s.far.x,s.far.y);await settle();
   assert.match(await page.evaluate(()=>document.getElementById('atlas-card').textContent),new RegExp(s.far.name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')),'and its card can be read');
   await page.evaluate(()=>{delete worldState.atlas.fog;__atlasTest.tap(null);__atlasTest.show(_atlasPane.zone,true);});await settle();await page.waitForTimeout(120);
   assert.equal(await page.evaluate(q=>{const v=_atlasPane.view;v.center(q.x,q.y,v.transform().k);return true;},s.far),true);await settle();await page.waitForTimeout(120);
   assert.equal(await page.evaluate(q=>__inkAt(q.x,q.y,36),s.far),0,'the fog is back with the switch');
   /* full screen carries the fog; the realm shows the town the party is in, and a far town is paper */
   await page.evaluate(()=>{__atlasTest.show(_atlasPane.zone,true);document.getElementById('atlas-full').click();});await settle();await page.waitForTimeout(200);
   const f=await page.evaluate(()=>{const p=__atlasTest.pane();return {host:p.host,reveal:p.reveal,expect:atlasReveal(p.zone)};});
   assert.equal(f.host,'full');assert.deepEqual(f.reveal,f.expect,'the full pane wears the same reveal');
   await page.evaluate(()=>{[].forEach.call(document.querySelectorAll('.tnd-toast'),t=>t.remove());});
   await page.screenshot({path:path.join(SHOTS,'atlas-fog-town.png')});
   const g=await page.evaluate(()=>{__atlasTest.show('campaign-1',true);const p=__atlasTest.pane();return {zone:p.zone,reveal:p.reveal,expect:atlasReveal('campaign-1'),radius:ATLAS_FOG.region.radiusM};});await settle();await page.waitForTimeout(200);
   assert.equal(g.zone,'campaign-1');assert.deepEqual(g.reveal,g.expect);assert.deepEqual(g.reveal,{points:[[s.p0.x,s.p0.y]],paths:[],radiusM:g.radius},'the realm: the town the party is in, and nothing else');
   await page.evaluate(()=>{[].forEach.call(document.querySelectorAll('.tnd-toast'),t=>t.remove());});
   await page.screenshot({path:path.join(SHOTS,'atlas-fog-realm.png')});
   assert.ok(await look(s.p0)>20,'the party\'s town is drawn on the realm');assert.equal(await look(s.farTown),0,'a town the party never reached is blank paper');
   await clickMap(s.farTown.x,s.farTown.y);await settle();
   assert.equal(await page.evaluate(()=>document.getElementById('atlas-card').style.display),'none','and cannot be read by a click');
   await page.evaluate(()=>atlasPaneClose());
 });

 await check('⑯ the independent review of the fog (#717, 2026-11-09): a place a turn adds to the sheet the pane shows is drawn there; a noted place far from the party can be opened through the fog; a failure reading a sheet leaves the one that was shown, and a reveal the view refuses leaves the new sheet ALL fog — never whole; a fogged sewer does not draw the town\'s walls above it',async()=>{
   const s=await page.evaluate(()=>{atlasPaneClose();mobileDrawerWidth(0);atlasForget();delete worldState.atlas;atlasCreate('campaign-1');/* adoption on: the campaign's default */
     const reg=atlasDoc('campaign-1'),p0=reg.places[0];worldState.world.location=p0.name;worldState.world.sublocation=null;atlasFollow();
     const zone=worldState.atlas.at,town=atlasDoc(zone),market=town.landmarks.filter(l=>l.kind==='market')[0],grate=town.portals.filter(p=>p.kind==='grate')[0];
     worldState.world.sublocation=market.name;atlasFollow();syncUI();showAtlasFull(zone);
     const far=town.establishments.map(e=>({id:e.id,name:e.name,x:e.x,y:e.y,d:Math.hypot(e.x-market.x,e.y-market.y)})).sort((a,b)=>b.d-a.d)[0];
     /* everything that is not paper in a box round a map point: pixels away from the box's commonest colour */
     window.__notPaper=function(x,y,half){const v=_atlasPane.view,c=document.getElementById('atlas-canvas'),T=v.transform(),dpr=c.width/c.clientWidth,g=c.getContext('2d'),w=Math.round(half*2*dpr),d=g.getImageData(Math.round((T.x+x*T.k-half)*dpr),Math.round((T.y+y*T.k-half)*dpr),w,w).data,seen={};let best=null,n=0;
       for(let i=0;i<d.length;i+=4){const k=(d[i]>>3)+','+(d[i+1]>>3)+','+(d[i+2]>>3);seen[k]=(seen[k]||0)+1;if(!best||seen[k]>seen[best])best=k;}const m=best.split(',').map(q=>(+q<<3)+4);
       for(let i=0;i<d.length;i+=4)if(Math.abs(d[i]-m[0])>8||Math.abs(d[i+1]-m[1])>8||Math.abs(d[i+2]-m[2])>8)n++;return n;};
     return {zone,p0:p0.name,market:{id:market.id,name:market.name},grate:grate.name,far};});
   await settle();await page.waitForTimeout(150);
   /* a turn adds a place to the very sheet the pane shows (outside the fog commit, since #702: the view kept its old drawing) */
   const a=await page.evaluate(()=>{const before=_atlasPane.view.doc();worldState.world.sublocation='The Gilded Spur';atlasFollow();syncUI();const p=__atlasTest.pane(),v=_atlasPane.view,has=d=>(d.establishments||[]).some(e=>e.name==='The Gilded Spur');
     return {zone:p.zone,engineHas:has(atlasDoc(p.zone)),viewHas:has(v.doc()),sameObject:v.doc()===atlasDoc(p.zone),redrawn:v.doc()!==before,reveal:p.reveal,expect:atlasReveal(p.zone),markers:p.markers.length};});
   assert.equal(a.zone,s.zone,'the pane stays on the town');assert.equal(a.engineHas,true,'fixture: the tavern was added to the town');assert.equal(a.viewHas,true,'the view draws the sheet the engine has: the added tavern is on it');assert.equal(a.sameObject,true);assert.equal(a.redrawn,true);
   assert.deepEqual(a.reveal,a.expect,'and wears its fog');assert.equal(a.markers,1);
   /* a noted place far from the party: shown, and its card opens */
   assert.equal(await page.evaluate(q=>atlasFogShows(q.zone,q.far.x,q.far.y),s),false,'fixture: a house far from the party is under the fog');
   await page.evaluate(q=>{atlasNoteSet(q.zone,q.far.id,'Ask here about the ledger.');__atlasTest.show(q.zone);const v=_atlasPane.view;v.center(q.far.x,q.far.y,v.transform().k);},s);await settle();await page.waitForTimeout(150);
   await clickMap(s.far.x,s.far.y);await settle();
   const n=await page.evaluate(()=>{const el=document.getElementById('atlas-card');return {shown:el.style.display,text:el.textContent};});
   assert.equal(n.shown,'block','a noted place can be clicked through the fog');assert.ok(n.text.indexOf('Ask here about the ledger.')>=0,'and its note read: '+n.text);
   await page.evaluate(q=>{__atlasTest.tap(null);atlasNoteSet(q.zone,q.far.id,'');__atlasTest.show(q.zone,true);},s);await settle();
   /* a failure READING the next sheet: the pane keeps the sheet it showed, fog and all */
   const f1=await page.evaluate(()=>{const real=atlasPartyIn,v=_atlasPane.view,was={doc:v.doc().seed,reveal:JSON.stringify(v.reveal()),zone:_atlasPane.zone};__toasts.length=0;
     atlasPartyIn=function(z){if(z==='campaign-1')throw new Error('injected: the party could not be read');return real.apply(this,arguments);};let ok;try{ok=__atlasTest.show('campaign-1',true);}finally{atlasPartyIn=real;}
     return {ok,was,doc:v.doc().seed,zone:_atlasPane.zone,same:JSON.stringify(v.reveal())===was.reveal,fogged:v.reveal()!==null,toast:__toasts.join(' | ')};});
   assert.equal(f1.ok,false);assert.equal(f1.doc,f1.was.doc,'the view still holds the sheet that was shown');assert.equal(f1.zone,f1.was.zone,'and the pane names it');assert.equal(f1.same,true,'with the fog it wore');assert.equal(f1.fogged,true);assert.match(f1.toast,/could not be drawn/,'said: '+f1.toast);
   /* a reveal the VIEW refuses: the new sheet is all fog, never whole, and the pane names the sheet the view holds */
   const f2=await page.evaluate(()=>{const v=_atlasPane.view,sr=v.setReveal;let thrown=0;__toasts.length=0;
     v.setReveal=function(r){if(r&&!Array.isArray(r)&&r.points&&r.points.length&&!thrown){thrown++;throw new Error('TnDMaps: a refused reveal (injected)');}return sr.apply(v,arguments);};let ok;try{ok=__atlasTest.show('campaign-1',true);}finally{v.setReveal=sr;}
     return {ok,thrown,doc:v.doc().seed,zone:_atlasPane.zone,reveal:v.reveal(),none:atlasRevealNone('campaign-1'),toast:__toasts.join(' | ')};});
   assert.equal(f2.thrown,1,'fixture: the view refused the realm\'s reveal');assert.equal(f2.ok,false);assert.equal(f2.doc,'campaign-1','the view holds the realm');assert.equal(f2.zone,'campaign-1','and the pane says so (it used to name the sheet before)');
   assert.deepEqual(f2.reveal,f2.none,'all fog, never the whole realm');assert.deepEqual(f2.reveal.points,[]);assert.match(f2.toast,/could not be drawn/);
   await settle();await page.waitForTimeout(150);
   assert.equal(await page.evaluate(()=>{const c=document.getElementById('atlas-canvas'),v=_atlasPane.view,sc=v.scene(),T=v.transform(),g=c.getContext('2d'),d=g.getImageData(Math.round(c.width*0.25),Math.round(c.height*0.25),Math.round(c.width*0.5),Math.round(c.height*0.5)).data;let dark=0;for(let i=0;i<d.length;i+=16)if(d[i]+d[i+1]+d[i+2]<300)dark++;return dark;}),0,'the refused sheet is blank paper: no ink in the middle half of the canvas (the frame and the HUD at its edges stay)');
   const f3=await page.evaluate(()=>{const ok=__atlasTest.show('campaign-1',true);return {ok,reveal:__atlasTest.pane().reveal,expect:atlasReveal('campaign-1')};});assert.equal(f3.ok,true);assert.deepEqual(f3.reveal,f3.expect,'the next show mends it');
   /* under the ground: the town's walls and river are not drawn above a fogged sewer */
   const u=await page.evaluate(q=>{worldState.world.sublocation=q.market.name;atlasFollow();worldState.world.sublocation=q.grate;atlasFollow();syncUI();const z=worldState.atlas.at;__atlasTest.show(z,true);const v=_atlasPane.view,doc=atlasDoc(z),ab=v.scene().layers.filter(l=>l.name==='above')[0],wall=ab&&ab.items.filter(i=>i.s==='above'&&i.pts)[0],land=doc.rooms.filter(r=>r.id===worldState.atlas.spot)[0];
     if(!wall||!land)return {kind:worldState.atlas.zones[z].kind,wall:!!wall,land:!!land};const sc=v.scene(),bx=sc.x0||0,by=sc.y0||0,pt=wall.pts.filter(p=>p[0]>bx+sc.width*0.1&&p[0]<bx+sc.width*0.9&&p[1]>by+sc.height*0.15&&p[1]<by+sc.height*0.85).map(p=>({x:p[0],y:p[1],d:Math.hypot(p[0]-land.x,p[1]-land.y)})).sort((a,b)=>b.d-a.d)[0];/* a point of the wall well inside the SHEET (the scene's own box: the wall runs off its edge, and the document's frame is far larger), the farthest from the party */return {kind:worldState.atlas.zones[z].kind,zone:z,wall:true,land:true,pt,rooms:Array.isArray(v.reveal())};},s);
   assert.equal(u.kind,'dungeon');assert.ok(u.wall&&u.land,'fixture: the sewer\'s scene has the town\'s wall in its above layer');assert.equal(u.rooms,true,'the sewer is fogged room by room');
   const lookAt=async(q)=>{await page.evaluate(q=>{const v=_atlasPane.view;v.center(q.x,q.y,v.transform().k);},q);await settle();await page.waitForTimeout(150);return page.evaluate(q=>__notPaper(q.x,q.y,70),q);};
   const hiddenInk=await lookAt(u.pt);
   await page.evaluate(()=>{_atlasPane.view.setLayerVisible('above',true);});const shownInk=await lookAt(u.pt);await page.evaluate(()=>{_atlasPane.view.setLayerVisible('above',false);});
   assert.ok(shownInk>20,'fixture: with the layer forced on, the town\'s wall is drawn at that point ('+shownInk+' pixels off the paper)');assert.equal(hiddenInk,0,'as the pane shows it, the wall is not drawn: '+hiddenInk+' pixels off the paper');
   await page.evaluate(()=>{[].forEach.call(document.querySelectorAll('.tnd-toast'),t=>t.remove());__atlasTest.show(_atlasPane.zone,true);});await settle();await page.waitForTimeout(150);await page.screenshot({path:path.join(SHOTS,'atlas-fog-sewer.png')});
   /* with the campaign's fog off the layer is back */
   await page.evaluate(()=>{worldState.atlas.fog=false;__atlasTest.show(_atlasPane.zone);});assert.ok(await lookAt(u.pt)>20,'fog off: the town\'s outline is drawn above the sewer again');
   await page.evaluate(()=>{delete worldState.atlas.fog;atlasPaneClose();});
 });

 await check('⑰ the keyboard picks a place (#696): the sheet takes focus and says how; the arrow keys step through the places the sheet SHOWS (the fog applies), each with the card a tap opens and the view moved to it; Escape puts the card away before it closes the pane',async()=>{
   const s=await page.evaluate(()=>{__atlasTest.open('campaign-1');const c=document.getElementById('atlas-canvas'),all=atlasThings(atlasDoc('campaign-1')).filter(t=>t.id!=null&&t.name),list=__atlasTest.keyList('campaign-1');
     return {host:__atlasTest.pane().host,tab:c.getAttribute('tabindex'),label:c.getAttribute('aria-label'),live:document.getElementById('atlas-card').getAttribute('aria-live'),all:all.length,list:list,shown:list.every(t=>atlasThingShown('campaign-1',atlasThingById(atlasDoc('campaign-1'),t.id))),fogged:atlasReveal('campaign-1')!==null};});
   assert.equal(s.host,'dock');assert.equal(s.tab,'0','the sheet takes the keyboard');assert.match(s.label,/arrow keys/i,'and says how: '+s.label);assert.equal(s.live,'polite','a card that appears is announced');
   assert.equal(s.fogged,true,'fixture: the realm is fogged');assert.ok(s.list.length>=1&&s.list.length<s.all,'the list is what the fog shows ('+s.list.length+' of '+s.all+')');assert.equal(s.shown,true,'every listed place is one the sheet shows');
   /* real keys through the browser's own input pipeline (CDP), on the focused sheet */
   const VK={ArrowRight:39,ArrowDown:40,ArrowLeft:37,ArrowUp:38,Escape:27},press=async key=>{for(const type of ['rawKeyDown','keyUp'])await page._send('Input.dispatchKeyEvent',{type,key,code:key,windowsVirtualKeyCode:VK[key],nativeVirtualKeyCode:VK[key]});},focusMap=()=>page.evaluate(()=>{document.getElementById('atlas-canvas').focus();});
   const step=async key=>{await press(key);await settle();return page.evaluate(()=>{const p=__atlasTest.pane(),el=document.getElementById('atlas-card'),st=document.getElementById('atlas-stage'),T=_atlasPane.view.transform(),t=p.target&&p.target.id!=null?atlasThingById(atlasDoc(p.zone),p.target.id):null;
     return {id:p.target?p.target.id:null,card:el.style.display,text:el.textContent,focus:document.activeElement&&document.activeElement.id,off:t?[Math.abs(t.x*T.k+T.x-st.clientWidth/2),Math.abs(t.y*T.k+T.y-st.clientHeight/2)]:null,k:T.k,w:st.clientWidth,h:st.clientHeight};});};
   await focusMap();
   /* the view is first taken as far from the first place as the sheet allows, zoomed in: the step must bring the place on screen */
   const k0=await page.evaluate(first=>{const v=_atlasPane.view,sc=v.scene(),x0=sc.x0||0,y0=sc.y0||0,far=[first.x<x0+sc.width/2?x0+sc.width:x0,first.y<y0+sc.height/2?y0+sc.height:y0];v.center(far[0],far[1],v.transform().k*3);return v.transform().k;},s.list[0]);
   const before=await page.evaluate(first=>{const T=_atlasPane.view.transform(),st=document.getElementById('atlas-stage'),px=first.x*T.k+T.x,py=first.y*T.k+T.y;return px>=0&&px<=st.clientWidth&&py>=0&&py<=st.clientHeight;},s.list[0]);assert.equal(before,false,'fixture: the first place starts off screen');
   const a=await step('ArrowRight');assert.equal(a.id,s.list[0].id,'the first key picks the first place');assert.equal(a.card,'block');assert.ok(a.text.indexOf(s.list[0].name)>=0,'its card names it: '+a.text);assert.equal(a.focus,'atlas-canvas','the keyboard stays on the sheet');await page.screenshot({path:path.join(SHOTS,'atlas-keyboard.png')});
   assert.ok(a.off[0]<=a.w/2+1&&a.off[1]<=a.h/2+1,'the place is brought on screen: '+JSON.stringify(a.off));assert.ok(Math.abs(a.k-k0)<1e-9,'the zoom is the player\'s');
   if(s.list.length>1){const b=await step('ArrowDown');assert.equal(b.id,s.list[1].id,'the next key picks the next');const c=await step('ArrowLeft');assert.equal(c.id,s.list[0].id,'and back');}
   const z=await step('ArrowUp');assert.equal(z.id,s.list[s.list.length-1].id,'before the first is the last');
   /* the whole sheet, the fog off */
   assert.equal(await page.evaluate(()=>{worldState.atlas.fog=false;const n=__atlasTest.keyList('campaign-1').length;delete worldState.atlas.fog;return n;}),s.all,'with the fog off every named place is listed');
   /* Escape: the card first, the pane after (the full pane is a dialog) */
   await page.evaluate(()=>{__atlasTest.openFull('campaign-1');});await settle();await focusMap();
   const f=await step('ArrowRight');assert.equal(f.card,'block');assert.equal(f.id,s.list[0].id);
   await press('Escape');await settle();
   assert.deepEqual(await page.evaluate(()=>({card:document.getElementById('atlas-card').style.display,modal:!!document.getElementById('atlas-modal')})),{card:'none',modal:true},'Escape put the card away and left the pane');
   await press('Escape');await settle();
   assert.equal(await page.evaluate(()=>!!document.getElementById('atlas-modal')),false,'a second Escape closes the pane');
   await page.evaluate(()=>{atlasPaneClose();});
 });

 assert.deepEqual(errors,[],'page errors: '+errors.join(' | '));
 console.log('screenshots: '+SHOTS+' (atlas-dock.png, atlas-region.png, atlas-town.png, atlas-phone-dock.png, atlas-phone.png, atlas-fog-dock.png, atlas-fog-town.png, atlas-fog-realm.png, atlas-fog-sewer.png, atlas-keyboard.png)');
}finally{await browser.close();}
console.log(failed?'FAILED — '+failed:'ALL GREEN — the atlas pane (#684)');process.exit(failed?1:0);
})().catch(e=>{console.error(e);process.exit(1);});
