/* ui-atlas.js — #684 THE ATLAS PANE: the campaign's drawn maps on a canvas (TnDMaps.view), opened by the location name.
   A thin DOM shell over atlas.js: every decision (where the party is, what a tap would tie, what a sheet may show,
   what a card says) is a pure atlas.js read; the one write is the player's "We are here" (atlasPlace), saved at once.
   Only ENTERED zones can be opened — the pane never draws a place the party has not been (no peeking into a dungeon).
   Design: DOC/DESIGN_684_atlas.md. Seam: window.__atlasTest. */
var _atlasPane=null;/* while the pane is open: {view, zone, target} — target is the tapped thing or point the card shows */

/* THE DOOR: the location name opens the pane — only in a campaign that has an atlas; elsewhere the name is plain text
   exactly as before. Painted by syncUI; one delegated listener (atlasDoorWire) serves the HUD name, the ways row's
   "here" label and the phone's place label, which is created after boot. */
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

function atlasPaneClose(){
  var m=document.getElementById("atlas-modal");
  if(_atlasPane&&_atlasPane.view){try{_atlasPane.view.destroy();}catch(e){if(typeof console!=="undefined")console.warn("[atlas pane] the view did not close cleanly: "+(e&&e.message?e.message:e));}}
  _atlasPane=null;
  if(m)m.remove();
}
/* open the pane on a zone (default: where the party is, else the region) */
function showAtlas(zoneId){
  var A=(typeof atlasLive==="function")?atlasLive():null,modal,canvas;
  if(!A){showToast("This campaign has no drawn map.");return false;}
  atlasFollow();/* the pane shows the story's CURRENT place — a Sync edit or a restore may have moved the pointer since the last turn */
  if(_atlasPane)atlasPaneClose();
  modal=modalShell("atlas-modal",
    "<div id='atlas-head' style='display:flex;align-items:center;gap:8px;padding:max(8px,var(--top-inset)) 12px 8px;border-bottom:1px solid var(--brd);'>"
    +"<div id='atlas-trail' style='flex:1;min-width:0;display:flex;flex-wrap:wrap;gap:4px;align-items:center;font-size:13px;'></div>"
    +"<select id='atlas-zones' aria-label='Mapped places' style='max-width:40%;background:var(--bg2);color:var(--t0);border:1px solid var(--brd2);border-radius:var(--r);padding:4px 6px;font-family:var(--font);font-size:12px;'></select>"
    +"<button class='ib' id='atlas-party' title='Go to where the party is'>Party</button>"
    +"<button class='ib' id='atlas-close' aria-label='Close the map'>&#10005;</button></div>"
    +"<div id='atlas-status' style='padding:6px 12px;font-size:12px;line-height:1.45;color:var(--t1);min-height:18px;'></div>"
    +"<div id='atlas-stage' style='position:relative;flex:1;min-height:0;'>"
    +"<canvas id='atlas-canvas' style='position:absolute;inset:0;width:100%;height:100%;display:block;'></canvas>"
    +"<div id='atlas-card' style='display:none;position:absolute;left:12px;bottom:12px;width:calc(100% - 24px);max-width:380px;box-sizing:border-box;background:var(--modal-bg);border:1px solid var(--acc);border-radius:12px;padding:12px;'></div>"
    +"</div>",
    {closeId:"atlas-close",onClose:atlasPaneClose,overlayCss:"position:fixed;inset:0;background:var(--modal-bg);z-index:300;display:flex;",boxCss:"display:flex;flex-direction:column;width:100%;height:100%;background:var(--modal-bg);"});
  canvas=document.getElementById("atlas-canvas");
  try{
    _atlasPane={view:TnDMaps.view(canvas,atlasDoc((zoneId&&A.zones[zoneId])?zoneId:(A.at||A.seed)),{style:"ink"}),zone:null,target:null};
  }catch(e){atlasPaneClose();atlasProblem("opening the map",e);return false;}
  _atlasPane.view.on("mapclick",function(pt,hit){atlasPaneTap(atlasPaneTargetOf(pt,hit));});
  document.getElementById("atlas-party").addEventListener("click",function(){var B=atlasLive();if(B&&B.at)atlasPaneShow(B.at,true);else atlasPaneStatus("The party is not on the map yet.",true);});
  document.getElementById("atlas-zones").addEventListener("change",function(){if(this.value)atlasPaneShow(this.value);});
  document.getElementById("atlas-trail").addEventListener("click",function(e){var z=e.target&&e.target.getAttribute&&e.target.getAttribute("data-zone");if(z)atlasPaneShow(z);});
  document.getElementById("atlas-card").addEventListener("click",function(e){
    var act=e.target&&e.target.getAttribute&&e.target.getAttribute("data-act");
    if(act==="here")atlasPaneWeAreHere();
    else if(act==="open"&&e.target.getAttribute("data-zone"))atlasPaneShow(e.target.getAttribute("data-zone"));
    else if(act==="dismiss")atlasPaneTap(null);
  });
  atlasPaneShow((zoneId&&A.zones[zoneId])?zoneId:(A.at||A.seed),true);
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
/* show one entered zone's sheet: the document, the party marker, the fog, the trail, the status */
function atlasPaneShow(zoneId,toParty){
  var A=atlasLive(),P=_atlasPane,doc,reveal,trail,zones,h="",i,sel,where,p;
  if(!A||!P||!A.zones[zoneId])return false;
  try{
    doc=atlasDoc(zoneId);
    if(P.zone!==zoneId)P.view.setDoc(doc);
    reveal=atlasReveal(zoneId);if(reveal)P.view.setReveal(reveal);
    P.view.setMarkers(atlasMarkers(zoneId));
  }catch(e){atlasPaneStatus("That sheet could not be drawn: "+atlasProblem("drawing a sheet",e),true);return false;}
  P.zone=zoneId;P.target=null;P.view.select(null);
  trail=atlasTrail(zoneId);
  for(i=0;i<trail.length;i++){
    if(i)h+="<span style='color:var(--t2);'>&rsaquo;</span>";
    h+=(i===trail.length-1)?"<span style='color:var(--t0);font-weight:bold;'>"+escHtml(A.zones[trail[i]].name||trail[i])+"</span>"
      :"<button type='button' class='hw-chip' data-zone='"+escHtml(trail[i])+"'>"+escHtml(A.zones[trail[i]].name||trail[i])+"</button>";
  }
  document.getElementById("atlas-trail").innerHTML=h;
  zones=atlasZones();sel=document.getElementById("atlas-zones");sel.innerHTML="";
  sel.appendChild(new Option("Mapped places ("+zones.length+")",""));
  zones.forEach(function(z){var o=new Option(z.name+" — "+z.kind,z.id);if(z.id===zoneId)o.disabled=true;sel.appendChild(o);});
  where=atlasWhere();atlasPaneStatus(where?where.text+((where.off||!where.placed)?" Tap the place where the party is, then We are here.":""):"",!!(where&&(where.off||!where.placed)));
  atlasPaneCard(null);
  if(toParty){p=atlasPartyIn(zoneId);if(p)P.view.center(p.x,p.y);}
  return true;
}
/* a tap on the sheet: a named thing, or a point (open ground on the region); null puts the card away */
function atlasPaneTap(target){
  var P=_atlasPane,card;
  if(!P)return null;
  card=target?atlasCard(P.zone,target):null;
  P.target=card?target:null;
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
  else if(card.unvisited)h+="<div style='font-size:12px;color:var(--t2);margin-top:8px;'>Not yet visited &mdash; its sheet is drawn when the party goes in.</div>";
  h+="<div style='display:flex;gap:8px;flex-wrap:wrap;margin-top:10px;'>";
  if(card.opens)h+="<button type='button' class='qa' data-act='open' data-zone='"+escHtml(card.opens)+"'>Open its sheet</button>";
  if(card.place&&!card.partyHere&&!card.refused)h+="<button type='button' class='qa' data-act='here' style='background:var(--acc);color:var(--on-acc);border:none;font-weight:bold;'>We are here &mdash; "+escHtml(card.place.name)+"</button>";
  h+="</div>";
  el.innerHTML=h;el.style.display="block";
}
/* "We are here": tie the story's current place to the tapped thing or point, save, and show where that put the party */
function atlasPaneWeAreHere(){
  var P=_atlasPane,r;
  if(!P||!P.target)return null;
  if(typeof busy!=="undefined"&&busy){atlasPaneStatus("Finish the current turn first.",true);return {ok:false,reason:"a turn is in flight"};}
  r=atlasPlace(P.zone,P.target);
  if(!r.ok){atlasPaneStatus("Not placed: "+r.reason+".",true);return r;}
  if(typeof saveAll==="function")saveAll();
  if(typeof syncUI==="function")syncUI();
  showToast("\""+r.bound+"\" is on the map.");
  atlasPaneShow(r.at||P.zone,true);
  return r;
}
if(typeof window!=="undefined")window.__atlasTest={
  pane:function(){var P=_atlasPane;return P?{zone:P.zone,target:P.target,markers:P.view.markers(),reveal:P.view.reveal(),doc:P.view.doc().seed}:null;},
  tap:atlasPaneTap,here:atlasPaneWeAreHere,show:atlasPaneShow,open:showAtlas,close:atlasPaneClose,doorPaint:atlasDoorPaint
};
