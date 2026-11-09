/* ui-atlas.js — #684 THE ATLAS PANE: the campaign's drawn maps on a canvas (TnDMaps.view), opened by the location name.
   A thin DOM shell over atlas.js: every decision (where the party is, what a tap would tie, what a sheet may show,
   what a card says) is a pure atlas.js read; the one write is the player's "Current location" (atlasPlace), saved at once.
   Only ENTERED zones can be opened — the pane never draws a place the party has not been (no peeking into a dungeon).
   #711 (owner 2026-11-08): the pane lives in the side drawer's Map tab (the DOCK) — the location name opens it there —
   and an enlarge button lifts the same pane to FULL SCREEN (the modal), where the mapped-places select and Current
   location join it. The DOCK is the map alone (owner notes 2026-11-08: optimise the space for the map): no head, no
   status, no Current location (party movement is the narrative's), two round buttons floating over the sheet bottom
   right — the party's dagger that recentres, then enlarge. ROUND 3 (owner notes 2026-11-08): a sheet opens on the party
   at ATLAS_HOME_ZOOM times its fit and the library's BOUNDS keep the sheet FILLING the stage (a party at the edge puts
   the sheet's edge at the stage's edge; the player's own drag and zoom keep the rule too — TnD Maps 0.16.0); a drawer
   pull reveals or covers the map without moving it; full screen carries the dock's point and zoom, and the dock takes
   its own view back when the full pane closes; the full pane's head is the select and the close button, no status line
   anywhere (a failure or a refusal is toasted; the tie a tap made is toasted in the words the GM is told, #692).
   ONE pane at a time, in one host or the other; the view draws the library's HUD (title, compass, a scale bar re-measured
   at every zoom) screen-fixed, so a pan or a wheel zoom leaves the legend where it is.
   Design: DOC/DESIGN_684_atlas.md. Seam: window.__atlasTest. */
var _atlasPane=null;/* while a pane is open: {view, zone, target, host:"dock"|"full", size, frame, restore} — target is the tapped thing or point the card shows; frame is a framing the dock owes its first sizing; restore the dock's view coming back from full screen */
var _atlasDockMemo=null;/* the dock's view when the enlarge button lifted it — {zone, cx, cy, k}, the map point at the stage's centre and the zoom — carried into the full pane and restored when it closes on the same zone */
var ATLAS_DOCK_WIDTH=460;/* the drawer's width when the door opens it closed: this many px or half the story's width, whichever is less */
var ATLAS_HOME_ZOOM=4;/* owner 2026-11-08: a sheet opens on the party at four times its fit (the player zooms out if need be) */

/* THE DOOR: the location name opens the pane — only in a campaign that has an atlas; elsewhere the name is plain text
   exactly as before. Painted by syncUI; one delegated listener (atlasDoorWire) serves the HUD name, the ways row's
   "here" label and the phone's place label, which is created after boot. The Map tab follows the same switch
   (body.atlas-on; mobile.css hides it otherwise) — a campaign that loses its atlas is moved off the tab. */
var ATLAS_DOOR_IDS=["hud-loc","mobile-place"];
function atlasDoorPaint(){
  var on=typeof atlasHas==="function"&&atlasHas(),i,el;
  if(typeof document==="undefined"||!document.body)return;
  document.body.classList.toggle("atlas-on",on);
  for(i=0;i<ATLAS_DOOR_IDS.length;i++){
    el=document.getElementById(ATLAS_DOOR_IDS[i]);if(!el)continue;
    if(on){el.classList.add("atlas-door");el.setAttribute("role","button");el.setAttribute("tabindex","0");el.setAttribute("aria-label","Open the map — "+el.textContent);}
    else{el.classList.remove("atlas-door");el.removeAttribute("role");el.removeAttribute("tabindex");el.removeAttribute("aria-label");}
  }
  if(!on&&typeof mobileUI!=="undefined"&&mobileUI.selected==="map"){if(_atlasPane)atlasPaneClose();if(typeof mobileSelectPanel==="function")mobileSelectPanel("party");}
  else if(on)atlasDockSync();
  atlasPaneRefresh();/* syncUI runs after every committed turn: an open pane follows the story */
}
/* what the open pane last painted from: the party's place and the pointer the atlas followed */
function atlasPaneSig(){var A=(typeof atlasLive==="function")?atlasLive():null;return A?JSON.stringify([A.at,A.spot,A.off,A.ptr]):"";}
/* a turn landed (or a Sync edit) while the pane is open: its marker and card were painted for another place. A sheet the
   story left is swapped for the party's, framed on the party; the same sheet keeps the player's view */
function atlasPaneRefresh(){
  var P=_atlasPane,A,z;
  if(!P||P.sig===atlasPaneSig())return false;
  A=atlasLive();
  if(!A){atlasPaneClose();return true;}
  z=A.zones[P.zone]?P.zone:(A.at||A.seed);
  atlasPaneShow(z,z!==P.zone);
  return true;
}
function atlasDoorHit(e){
  var t=e&&e.target;
  if(!t||typeof t.closest!=="function"||!document.body.classList.contains("atlas-on"))return false;
  return !!t.closest(".atlas-door, .hw-here");
}
function atlasDoorWire(){
  document.addEventListener("click",function(e){if(atlasDoorHit(e))showAtlas();});
  document.addEventListener("keydown",function(e){if((e.key==="Enter"||e.key===" ")&&atlasDoorHit(e)){e.preventDefault();showAtlas();}});
}

/* close whichever pane is open: the view lets go of the window, the modal goes, the dock is emptied. A closed FULL pane
   hands the map back to the dock when the Map tab is showing. */
function atlasPaneClose(){
  var P=_atlasPane,m=document.getElementById("atlas-modal"),d=document.getElementById("atlas-dock");
  if(P&&P.view){try{P.view.destroy();}catch(e){if(typeof console!=="undefined")console.warn("[atlas pane] the view did not close cleanly: "+(e&&e.message?e.message:e));}}
  if(P&&P.ro){try{P.ro.disconnect();}catch(e2){}}
  _atlasPane=null;
  if(m)m.remove();
  if(d)d.innerHTML="";
  if(P&&P.host==="full")atlasDockSync();
}
/* the drawer's Map tab is showing and holds no pane: mount one (a closed full pane, a tab selected, a drawer opened) */
function atlasDockSync(){
  if(_atlasPane||typeof mobileUI==="undefined"||mobileUI.selected!=="map"||!mobileUI.width)return false;
  if(!(typeof atlasHas==="function"&&atlasHas()))return false;
  return atlasDockMount();
}
/* THE DOOR's body: open the pane in the drawer's Map tab on a zone (default: where the party is, else the region).
   A full pane already up is moved to the zone instead — it covers the drawer. */
function showAtlas(zoneId){
  var A=(typeof atlasLive==="function")?atlasLive():null,story;
  if(!A){showToast("This campaign has no drawn map.");return false;}
  atlasFollow();/* the pane shows the story's CURRENT place — a Sync edit or a restore may have moved the pointer since the last turn */
  if(_atlasPane&&_atlasPane.host==="full")return atlasPaneShow((zoneId&&A.zones[zoneId])?zoneId:(A.at||A.seed),true);
  if(typeof mobileSelectPanel!=="function"||!document.getElementById("atlas-dock"))return showAtlasFull(zoneId);/* no drawer (a host without ui-mobile): full screen as before */
  mobileSelectPanel("map");
  if(!mobileUI.width){story=document.getElementById("story-area");mobileDrawerWidth(Math.min(ATLAS_DOCK_WIDTH,Math.round((story?story.clientWidth:800)*0.5)));}
  return atlasDockMount(zoneId);
}
/* the pane in the dock: built once, moved to a zone when asked again; never while a full pane is up (it mounts when that closes) */
function atlasDockMount(zoneId){
  var A=(typeof atlasLive==="function")?atlasLive():null,dock=document.getElementById("atlas-dock"),z,stage;
  if(!A||!dock)return false;
  z=(zoneId&&A.zones[zoneId])?zoneId:(A.at||A.seed);
  if(_atlasPane){
    if(_atlasPane.host==="full")return false;
    return zoneId?atlasPaneShow(z,true):true;
  }
  if(!atlasPaneBuild(dock,"dock"))return false;
  stage=document.getElementById("atlas-stage");
  if(_atlasDockMemo&&_atlasDockMemo.zone===z)_atlasPane.restore=_atlasDockMemo;/* back from full screen: where the player left the dock's view */
  _atlasDockMemo=null;
  /* the drawer is resized by a drag (no window resize): the stage's own size drives the view — the first sizing frames it, a later one reveals or covers */
  if(typeof ResizeObserver==="function"&&stage){_atlasPane.ro=new ResizeObserver(function(){atlasDockResized();});_atlasPane.ro.observe(stage);}
  atlasPaneShow(z,!_atlasPane.restore);
  if(!_atlasPane.ro)atlasDockResized();/* no observer: size the view now */
  return true;
}
/* what the dock's view shows now: the map point under the stage's centre, the zoom and the stage's size (null when no dock is sized) */
function atlasDockMemo(){
  var P=_atlasPane,st=document.getElementById("atlas-stage"),T;
  if(!P||P.host!=="dock"||!st||!st.clientWidth||!st.clientHeight)return null;
  T=P.view.transform();
  return {zone:P.zone,cx:(st.clientWidth/2-T.x)/T.k,cy:(st.clientHeight/2-T.y)/T.k,k:T.k,w:st.clientWidth,h:st.clientHeight};
}
function atlasDockRestore(){
  var P=_atlasPane,r=P&&P.restore;
  if(!r)return false;
  P.restore=null;P.frame=null;P.view.center(r.cx,r.cy,r.k);
  return true;
}
/* the stage's size changed. The FIRST sizing frames the view (the memo coming back from full screen, else the framing the
   show owes — a dock the observer has not sized yet would have its centring undone by the fit). A LATER one is the drawer
   pulled (owner 2026-11-08: no zoom on the drawer pull — reveal or cover): the drawer's right edge is the screen's, so the
   map is moved by the width the stage gained and stays where it was on screen; the bounds keep the sheet filling the stage. */
function atlasDockResized(){
  var P=_atlasPane,st=document.getElementById("atlas-stage"),w,h;
  if(!P||P.host!=="dock"||!P.view||!st)return;
  w=st.clientWidth;h=st.clientHeight;
  if(!w||!h)return;/* hidden (another tab): nothing to draw; shown again, the map is where it was */
  if(P.size&&P.size[0]===w&&P.size[1]===h)return;
  if(P.size){P.view.pan(w-P.size[0],(h-P.size[1])/2);P.size=[w,h];return;}
  P.size=[w,h];
  if(P.restore)atlasDockRestore();else if(!atlasPaneFrame(P.frame))P.view.fit();/* no framing owed (no party on the sheet): the sheet fitted to the stage's first real size */
  P.frame=null;
}
/* FULL SCREEN: the same pane as a modal, with the mapped-places select; the dock's pane goes while it is up, its point and
   zoom carried (owner 2026-11-08: keep the relative position and zoom of the drawer) and kept for the way back */
function showAtlasFull(zoneId){
  var A=(typeof atlasLive==="function")?atlasLive():null,modal,z,memo;
  if(!A){showToast("This campaign has no drawn map.");return false;}
  atlasFollow();
  z=(zoneId&&A.zones[zoneId])?zoneId:(A.at||A.seed);
  memo=atlasDockMemo();/* the dock's view, carried up and to come back to */
  _atlasDockMemo=memo;
  if(_atlasPane)atlasPaneClose();
  modal=modalShell("atlas-modal",atlasPaneHtml("full"),
    {closeId:"atlas-close",onClose:atlasPaneClose,overlayCss:"position:fixed;inset:0;background:var(--modal-bg);z-index:300;display:flex;",boxCss:"display:flex;flex-direction:column;width:100%;height:100%;background:var(--modal-bg);"});
  if(!atlasPaneWire("full")){atlasPaneClose();return false;}
  atlasPaneShow(z,true,(memo&&memo.zone===z)?memo:null);
  return true;
}
/* the pane's markup: one shape, two hosts — the full pane has a head (the select, close); both are the stage with the
   party's dagger floating over the sheet bottom right (.atlas-fab; the top is the HUD's title and compass, which a
   phone-wide plaque fills), the dock with the enlarge button at the corner and the dagger just left of it. The card
   sits above the buttons (z-index) so neither covers it. */
var ATLAS_DAGGER_SVG="<svg viewBox='0 0 24 24' fill='currentColor' aria-hidden='true'><path d='M12 23 9.8 19.4 10.3 11h3.4l.5 8.4z'/><rect x='6.8' y='9.4' width='10.4' height='1.8'/><rect x='10.7' y='4' width='2.6' height='5.4'/><circle cx='12' cy='2.6' r='1.9'/></svg>";/* the map's own party marker, solid: blade tip down, the guard, the grip, the pommel */
var ATLAS_ENLARGE_SVG="<svg viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2.2' stroke-linecap='round' stroke-linejoin='round' aria-hidden='true'><path d='M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5'/></svg>";
function atlasPaneHtml(host){
  var full=host==="full";
  return (full?"<div id='atlas-head' style='display:flex;align-items:center;justify-content:flex-end;gap:6px;padding:max(8px,var(--top-inset)) 12px 8px;border-bottom:1px solid var(--brd);'>"
      +"<select id='atlas-zones' aria-label='Mapped places' style='max-width:70%;background:var(--bg2);color:var(--t0);border:1px solid var(--brd2);border-radius:var(--r);padding:4px 6px;font-family:var(--font);font-size:12px;'></select>"
      +"<button type='button' class='ib' id='atlas-close' aria-label='Close the map'>&#10005;</button>"
      +"</div>":"")
    +"<div id='atlas-stage' style='position:relative;flex:1;min-height:0;'>"
    +"<canvas id='atlas-canvas' style='position:absolute;inset:0;width:100%;height:100%;display:block;'></canvas>"
    +(full?"":"<button type='button' class='atlas-fab' id='atlas-full' title='Open the map full screen' aria-label='Open the map full screen' style='bottom:8px;right:8px;'>"+ATLAS_ENLARGE_SVG+"</button>")
    +"<button type='button' class='atlas-fab' id='atlas-party' title='Go to where the party is' aria-label='Go to where the party is' style='bottom:8px;right:"+(full?8:46)+"px;'>"+ATLAS_DAGGER_SVG+"</button>"
    +"<div id='atlas-card' style='display:none;position:absolute;z-index:3;left:12px;bottom:12px;width:calc(100% - 24px);max-width:380px;box-sizing:border-box;background:var(--modal-bg);border:1px solid var(--acc);border-radius:12px;padding:12px;'></div>"
    +"</div>";
}
/* build the pane's markup into a host element (the dock) and wire it */
function atlasPaneBuild(container,host){
  container.innerHTML=atlasPaneHtml(host);
  if(!atlasPaneWire(host)){container.innerHTML="";return false;}
  return true;
}
/* the view and the listeners, the same in both hosts */
function atlasPaneWire(host){
  var A=atlasLive(),canvas=document.getElementById("atlas-canvas"),el;
  try{
    _atlasPane={view:TnDMaps.view(canvas,atlasDoc(A.at||A.seed),{style:"ink",hud:true,bounds:true}),zone:null,target:null,host:host,size:null,frame:null};
  }catch(e){_atlasPane=null;atlasProblem("opening the map",e);return false;}
  _atlasPane.view.on("mapclick",function(pt,hit){atlasPaneTap(atlasPaneTargetOf(pt,hit));});
  document.getElementById("atlas-party").addEventListener("click",function(){var B=atlasLive();if(B&&B.at)atlasPaneShow(B.at,true);else atlasPaneSay("The party is not on the map yet.");});
  if((el=document.getElementById("atlas-full")))el.addEventListener("click",function(){var P=_atlasPane;showAtlasFull(P?P.zone:undefined);});
  if((el=document.getElementById("atlas-zones")))el.addEventListener("change",function(){if(this.value)atlasPaneShow(this.value);});
  document.getElementById("atlas-card").addEventListener("click",function(e){
    var act=e.target&&e.target.getAttribute&&e.target.getAttribute("data-act");
    if(act==="here")atlasPaneWeAreHere();
    else if(act==="open"&&e.target.getAttribute("data-zone"))atlasPaneShow(e.target.getAttribute("data-zone"));
    else if(act==="dismiss")atlasPaneTap(null);
  });
  return true;
}
/* what a click on the sheet means: a named thing; the thing a marker stands on (the party's dagger covers the town it
   is in, and a marker wins the click); else the point itself */
function atlasPaneTargetOf(pt,hit){
  var P=_atlasPane,t;
  if(hit&&hit.kind!=="marker"&&hit.id!=null)return {id:hit.id};
  if(hit&&P){t=atlasThingAt(P.zone,hit.x,hit.y);return t?{id:t.id}:{x:hit.x,y:hit.y};}
  return {x:pt.x,y:pt.y};
}
/* the pane has no status line (owner 2026-11-08): what it must say — a failure, a refusal, the tie a tap made — is a toast */
function atlasPaneSay(text){
  if(typeof showToast==="function")showToast(text);
  else if(typeof console!=="undefined")console.warn("[atlas pane] "+text);
}
/* how a shown sheet is framed: a CARRIED view (the dock's, lifted to full screen) at its own point, its zoom scaled by the
   room gained (owner: "keep the RELATIVE position/zoom of the drawer" — what the dock showed stays in view, larger, with
   more map on the wider axis); else the party at ATLAS_HOME_ZOOM times the sheet's fit; the bounds keep the sheet filling
   the stage either way */
function atlasPaneFrame(how){
  var P=_atlasPane,T,c,st,s;
  if(!P||!how)return false;
  if(how.carry){c=how.carry;st=document.getElementById("atlas-stage");s=(c.w&&c.h&&st&&st.clientWidth&&st.clientHeight)?Math.min(st.clientWidth/c.w,st.clientHeight/c.h):1;P.view.center(c.cx,c.cy,c.k*s);return true;}
  P.view.fit();
  if(how.party){T=P.view.transform();P.view.center(how.party.x,how.party.y,T.k*ATLAS_HOME_ZOOM);}
  return true;
}
/* show one entered zone's sheet: the document, the party marker, the fog, the select (full); framed on the party when
   asked (toParty) or on a carried view; a dock not yet sized owes the framing to its first sizing */
function atlasPaneShow(zoneId,toParty,carry){
  var A=atlasLive(),P=_atlasPane,doc,reveal,zones,sel,how;
  if(!A||!P||!A.zones[zoneId])return false;
  try{
    doc=atlasDoc(zoneId);
    if(P.zone!==zoneId)P.view.setDoc(doc);
    reveal=atlasReveal(zoneId);if(reveal)P.view.setReveal(reveal);
    P.view.setMarkers(atlasMarkers(zoneId));
  }catch(e){atlasPaneSay("That sheet could not be drawn: "+atlasProblem("drawing a sheet",e));return false;}
  P.zone=zoneId;P.target=null;P.view.select(null);
  if((sel=document.getElementById("atlas-zones"))){
    zones=atlasZones();sel.innerHTML="";
    sel.appendChild(new Option("Mapped places ("+zones.length+")",""));
    zones.forEach(function(z){var o=new Option(z.name+" — "+z.kind,z.id);if(z.id===zoneId)o.disabled=true;sel.appendChild(o);});
  }
  P.sig=atlasPaneSig();P.place=null;
  atlasPaneCard(null);
  how=carry?{carry:carry}:(toParty?{party:atlasPartyIn(zoneId)}:null);
  if(how&&!how.carry&&!how.party)how=null;/* the party is not on this sheet: the fit the document came with */
  if(how){if(P.host==="dock"&&!P.size)P.frame=how;else atlasPaneFrame(how);}
  return true;
}
/* a tap on the sheet: a named thing, or a point (open ground on the region); null puts the card away */
function atlasPaneTap(target){
  var P=_atlasPane,card;
  if(!P)return null;
  try{card=target?atlasCard(P.zone,target):null;}
  catch(e){atlasPaneSay("That place could not be read: "+atlasProblem("reading a place",e));card=null;}
  P.target=card?target:null;P.place=card?card.place:null;
  P.view.select(null);
  atlasPaneCard(card);
  return card;
}
function atlasPaneCard(card){
  var el=document.getElementById("atlas-card"),h;
  if(!el)return;
  if(!card){el.style.display="none";el.innerHTML="";return;}
  h="<div style='display:flex;align-items:baseline;gap:8px;'><div style='flex:1;font-size:15px;font-weight:bold;color:var(--t0);'>"+escHtml(card.title)+"</div>"
    +"<button type='button' class='ib' data-act='dismiss' aria-label='Put the card away'>&#10005;</button></div>"
    +(card.word?"<div style='font-size:12px;color:var(--t2);margin-top:2px;'>"+escHtml(card.word)+"</div>":"");
  if(card.refused)h+="<div style='font-size:12px;color:var(--warn);margin-top:8px;'>"+escHtml(card.refused)+"</div>";
  else if(card.partyHere)h+="<div style='font-size:12px;color:var(--acc);margin-top:8px;'>The party is here.</div>";
  else if(card.added)h+="<div style='font-size:12px;color:var(--t2);margin-top:8px;'>"+escHtml(card.added)+"</div>";/* review 3, finding 2a: the thing the engine added for the story's name, or a room inside it — Current location would place nothing */
  else if(card.unvisited)h+="<div style='font-size:12px;color:var(--t2);margin-top:8px;'>Not yet visited &mdash; its sheet is drawn when the party goes in.</div>";
  h+="<div style='display:flex;gap:8px;flex-wrap:wrap;margin-top:10px;'>";
  if(card.opens)h+="<button type='button' class='qa' data-act='open' data-zone='"+escHtml(card.opens)+"'>Open its sheet</button>";
  if(card.place&&!card.partyHere&&!card.refused&&!card.added&&_atlasPane&&_atlasPane.host==="full")h+="<button type='button' class='qa' data-act='here' style='background:var(--acc);color:var(--on-acc);border:none;font-weight:bold;'>Current location &mdash; "+escHtml(card.place.name)+"</button>";
  h+="</div>";
  el.innerHTML=h;el.style.display="block";
}
/* "Current location" (owner 2026-11-08, was "We are here"; offered in the full pane only — in the dock the party moves
   through the narrative): tie the story's current place to the tapped thing or point, save, show where that put the
   party, and SAY the tie in the words the GM is told (#692) — the pane has no status line, so the toast carries it */
function atlasPaneWeAreHere(){
  var P=_atlasPane,r,where;
  if(!P||!P.target)return null;
  if(typeof busy!=="undefined"&&busy){atlasPaneSay("Finish the current turn first.");return {ok:false,reason:"a turn is in flight"};}
  r=atlasPlace(P.zone,P.target,P.place);/* P.place is what the card's button NAMED — a turn that landed since must not spend the tap on another place */
  if(!r.ok){if(r.moved)atlasPaneShow(P.zone);atlasPaneSay("Not placed: "+r.reason+".");return r;}
  if(typeof saveAll==="function")saveAll();
  if(typeof syncUI==="function")syncUI();
  try{where=atlasWhere();}catch(e){where=null;atlasProblem("reading the party's place",e);}
  atlasPaneSay(where&&where.text?where.text:"\""+r.bound+"\" is on the map.");
  atlasPaneShow(r.at||P.zone,true);
  return r;
}
if(typeof window!=="undefined")window.__atlasTest={
  pane:function(){var P=_atlasPane;return P?{zone:P.zone,target:P.target,host:P.host,hud:P.view.hud(),bounds:P.view.bounds(),markers:P.view.markers(),reveal:P.view.reveal(),doc:P.view.doc().seed}:null;},
  tap:atlasPaneTap,here:atlasPaneWeAreHere,show:atlasPaneShow,open:showAtlas,openFull:showAtlasFull,dock:atlasDockMount,close:atlasPaneClose,doorPaint:atlasDoorPaint,refresh:atlasPaneRefresh
};
