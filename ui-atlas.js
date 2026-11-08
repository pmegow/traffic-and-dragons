/* ui-atlas.js — #684 THE ATLAS PANE: the campaign's drawn maps on a canvas (TnDMaps.view), opened by the location name.
   A thin DOM shell over atlas.js: every decision (where the party is, what a tap would tie, what a sheet may show,
   what a card says) is a pure atlas.js read; the one write is the player's "Current location" (atlasPlace), saved at once.
   Only ENTERED zones can be opened — the pane never draws a place the party has not been (no peeking into a dungeon).
   #711 (owner 2026-11-08): the pane lives in the side drawer's Map tab (the DOCK) — the location name opens it there —
   and an enlarge button lifts the same pane to FULL SCREEN (the modal), where the trail and the mapped-places select
   join it. ONE pane at a time, in one host or the other; the view draws the library's HUD (title, compass, a scale bar
   re-measured at every zoom) screen-fixed, so a pan or a wheel zoom leaves the legend where it is.
   Design: DOC/DESIGN_684_atlas.md. Seam: window.__atlasTest. */
var _atlasPane=null;/* while a pane is open: {view, zone, target, host:"dock"|"full", size, centerOn} — target is the tapped thing or point the card shows */
var ATLAS_DOCK_WIDTH=460;/* the drawer's width when the door opens it closed: this many px or half the story's width, whichever is less */

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
/* a turn landed (or a Sync edit) while the pane is open: its status, marker and card were painted for another place */
function atlasPaneRefresh(){
  var P=_atlasPane,A;
  if(!P||P.sig===atlasPaneSig())return false;
  A=atlasLive();
  if(!A){atlasPaneClose();return true;}
  atlasPaneShow(A.zones[P.zone]?P.zone:(A.at||A.seed));
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
  /* the drawer is resized by a drag (no window resize): the stage's own size drives the view — a size it has not had re-fits */
  if(typeof ResizeObserver==="function"&&stage){_atlasPane.ro=new ResizeObserver(function(){atlasDockResized();});_atlasPane.ro.observe(stage);}
  atlasPaneShow(z,true);
  return true;
}
function atlasDockResized(){
  var P=_atlasPane,st=document.getElementById("atlas-stage"),w,h,p;
  if(!P||P.host!=="dock"||!P.view||!st)return;
  w=st.clientWidth;h=st.clientHeight;
  if(!w||!h){P.size=null;return;}/* hidden (another tab): nothing to draw; the next showing re-fits */
  if(P.size&&P.size[0]===w&&P.size[1]===h)return;
  P.size=[w,h];P.view.fit();
  if(P.centerOn){p=P.centerOn;P.centerOn=null;P.view.center(p.x,p.y);}
}
/* FULL SCREEN: the same pane as a modal, with the trail and the mapped-places select; the dock's pane goes while it is up */
function showAtlasFull(zoneId){
  var A=(typeof atlasLive==="function")?atlasLive():null,modal,z;
  if(!A){showToast("This campaign has no drawn map.");return false;}
  atlasFollow();
  z=(zoneId&&A.zones[zoneId])?zoneId:(A.at||A.seed);
  if(_atlasPane)atlasPaneClose();
  modal=modalShell("atlas-modal",atlasPaneHtml("full"),
    {closeId:"atlas-close",onClose:atlasPaneClose,overlayCss:"position:fixed;inset:0;background:var(--modal-bg);z-index:300;display:flex;",boxCss:"display:flex;flex-direction:column;width:100%;height:100%;background:var(--modal-bg);"});
  if(!atlasPaneWire("full")){atlasPaneClose();return false;}
  atlasPaneShow(z,true);
  return true;
}
/* the pane's markup: one shape, two hosts — the full pane adds the trail and the select and closes; the dock enlarges */
function atlasPaneHtml(host){
  var full=host==="full";
  return "<div id='atlas-head' style='display:flex;align-items:center;gap:6px;padding:"+(full?"max(8px,var(--top-inset)) 12px 8px":"6px 8px")+";border-bottom:1px solid var(--brd);'>"
    +(full?"<div id='atlas-trail' style='flex:1;min-width:0;display:flex;flex-wrap:wrap;gap:4px;align-items:center;font-size:13px;'></div>"
      +"<select id='atlas-zones' aria-label='Mapped places' style='max-width:40%;background:var(--bg2);color:var(--t0);border:1px solid var(--brd2);border-radius:var(--r);padding:4px 6px;font-family:var(--font);font-size:12px;'></select>"
      :"<div id='atlas-title' style='flex:1;min-width:0;font-size:13px;font-weight:bold;color:var(--t0);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;'></div>")
    +"<button type='button' class='ib' id='atlas-party' title='Go to where the party is'>Party</button>"
    +(full?"<button type='button' class='ib' id='atlas-close' aria-label='Close the map'>&#10005;</button>"
      :"<button type='button' class='ib' id='atlas-full' title='Open the map full screen' aria-label='Open the map full screen' style='padding:4px 7px;line-height:0;'><svg viewBox='0 0 24 24' width='14' height='14' fill='none' stroke='currentColor' stroke-width='2.2' stroke-linecap='round' stroke-linejoin='round' aria-hidden='true'><path d='M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5'/></svg></button>")
    +"</div>"
    +"<div id='atlas-status' style='padding:"+(full?"6px 12px":"4px 8px")+";font-size:12px;line-height:1.45;color:var(--t1);min-height:18px;'></div>"
    +"<div id='atlas-stage' style='position:relative;flex:1;min-height:0;'>"
    +"<canvas id='atlas-canvas' style='position:absolute;inset:0;width:100%;height:100%;display:block;'></canvas>"
    +"<div id='atlas-card' style='display:none;position:absolute;left:12px;bottom:12px;width:calc(100% - 24px);max-width:380px;box-sizing:border-box;background:var(--modal-bg);border:1px solid var(--acc);border-radius:12px;padding:12px;'></div>"
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
    _atlasPane={view:TnDMaps.view(canvas,atlasDoc(A.at||A.seed),{style:"ink",hud:true}),zone:null,target:null,host:host,size:null,centerOn:null};
  }catch(e){_atlasPane=null;atlasProblem("opening the map",e);return false;}
  _atlasPane.view.on("mapclick",function(pt,hit){atlasPaneTap(atlasPaneTargetOf(pt,hit));});
  document.getElementById("atlas-party").addEventListener("click",function(){var B=atlasLive();if(B&&B.at)atlasPaneShow(B.at,true);else atlasPaneStatus("The party is not on the map yet.",true);});
  if((el=document.getElementById("atlas-full")))el.addEventListener("click",function(){var P=_atlasPane;showAtlasFull(P?P.zone:undefined);});
  if((el=document.getElementById("atlas-zones")))el.addEventListener("change",function(){if(this.value)atlasPaneShow(this.value);});
  if((el=document.getElementById("atlas-trail")))el.addEventListener("click",function(e){var z=e.target&&e.target.getAttribute&&e.target.getAttribute("data-zone");if(z)atlasPaneShow(z);});
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
function atlasPaneStatus(text,warn){
  var el=document.getElementById("atlas-status");if(!el)return;
  el.textContent=text;el.style.color=warn?"var(--warn)":"var(--t1)";
}
/* show one entered zone's sheet: the document, the party marker, the fog, the trail (full) or the title (dock), the status */
function atlasPaneShow(zoneId,toParty){
  var A=atlasLive(),P=_atlasPane,doc,reveal,trail,zones,h="",i,sel,where,p,el,stage;
  if(!A||!P||!A.zones[zoneId])return false;
  try{
    doc=atlasDoc(zoneId);
    if(P.zone!==zoneId)P.view.setDoc(doc);
    reveal=atlasReveal(zoneId);if(reveal)P.view.setReveal(reveal);
    P.view.setMarkers(atlasMarkers(zoneId));
  }catch(e){atlasPaneStatus("That sheet could not be drawn: "+atlasProblem("drawing a sheet",e),true);return false;}
  P.zone=zoneId;P.target=null;P.view.select(null);
  trail=atlasTrail(zoneId);
  if((el=document.getElementById("atlas-trail"))){
    for(i=0;i<trail.length;i++){
      if(i)h+="<span style='color:var(--t2);'>&rsaquo;</span>";
      h+=(i===trail.length-1)?"<span style='color:var(--t0);font-weight:bold;'>"+escHtml(A.zones[trail[i]].name||trail[i])+"</span>"
        :"<button type='button' class='hw-chip' data-zone='"+escHtml(trail[i])+"'>"+escHtml(A.zones[trail[i]].name||trail[i])+"</button>";
    }
    el.innerHTML=h;
  }
  if((el=document.getElementById("atlas-title"))){el.textContent=A.zones[zoneId].name||zoneId;el.title=trail.map(function(z){return A.zones[z].name||z;}).join(" › ");}
  if((sel=document.getElementById("atlas-zones"))){
    zones=atlasZones();sel.innerHTML="";
    sel.appendChild(new Option("Mapped places ("+zones.length+")",""));
    zones.forEach(function(z){var o=new Option(z.name+" — "+z.kind,z.id);if(z.id===zoneId)o.disabled=true;sel.appendChild(o);});
  }
  try{where=atlasWhere();}catch(e2){where=null;atlasPaneStatus("The party's place could not be read: "+atlasProblem("reading the party's place",e2),true);}
  if(where)atlasPaneStatus(where.text+((where.off||!where.placed)?" Tap the place where the party is, then Current location.":""),!!(where.off||!where.placed));
  P.sig=atlasPaneSig();P.place=null;
  atlasPaneCard(null);
  if(toParty){p=atlasPartyIn(zoneId);if(p){stage=document.getElementById("atlas-stage");if(stage&&(!stage.clientWidth||!stage.clientHeight))P.centerOn=p;/* a dock not yet sized (the drawer opening): centred once it is */else P.view.center(p.x,p.y);}}
  return true;
}
/* a tap on the sheet: a named thing, or a point (open ground on the region); null puts the card away */
function atlasPaneTap(target){
  var P=_atlasPane,card;
  if(!P)return null;
  try{card=target?atlasCard(P.zone,target):null;}
  catch(e){atlasPaneStatus("That place could not be read: "+atlasProblem("reading a place",e),true);card=null;}
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
  if(card.place&&!card.partyHere&&!card.refused&&!card.added)h+="<button type='button' class='qa' data-act='here' style='background:var(--acc);color:var(--on-acc);border:none;font-weight:bold;'>Current location &mdash; "+escHtml(card.place.name)+"</button>";
  h+="</div>";
  el.innerHTML=h;el.style.display="block";
}
/* "Current location" (owner 2026-11-08, was "We are here"): tie the story's current place to the tapped thing or point,
   save, and show where that put the party */
function atlasPaneWeAreHere(){
  var P=_atlasPane,r;
  if(!P||!P.target)return null;
  if(typeof busy!=="undefined"&&busy){atlasPaneStatus("Finish the current turn first.",true);return {ok:false,reason:"a turn is in flight"};}
  r=atlasPlace(P.zone,P.target,P.place);/* P.place is what the card's button NAMED — a turn that landed since must not spend the tap on another place */
  if(!r.ok){if(r.moved)atlasPaneShow(P.zone);atlasPaneStatus("Not placed: "+r.reason+".",true);return r;}
  if(typeof saveAll==="function")saveAll();
  if(typeof syncUI==="function")syncUI();
  showToast("\""+r.bound+"\" is on the map.");
  atlasPaneShow(r.at||P.zone,true);
  return r;
}
if(typeof window!=="undefined")window.__atlasTest={
  pane:function(){var P=_atlasPane;return P?{zone:P.zone,target:P.target,host:P.host,hud:P.view.hud(),markers:P.view.markers(),reveal:P.view.reveal(),doc:P.view.doc().seed}:null;},
  tap:atlasPaneTap,here:atlasPaneWeAreHere,show:atlasPaneShow,open:showAtlas,openFull:showAtlasFull,dock:atlasDockMount,close:atlasPaneClose,doorPaint:atlasDoorPaint,refresh:atlasPaneRefresh
};
