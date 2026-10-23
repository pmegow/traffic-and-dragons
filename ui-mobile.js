// Responsive layout over the existing renderers: the shared side drawer and the phone chrome. No saved game writes.
var mobileUI={ready:false,width:0,selected:"party",phone:false};
var MOBILE_PANELS=[{key:"party",label:"Pty",name:"Party"},{key:"quest",label:"Qst",name:"Quests"},{key:"inv",label:"Inv",name:"Inventory"},{key:"ab",label:"Ab",name:"Abilities"},{key:"sp",label:"Sp",name:"Spells"}];
function mobilePhone(){return window.matchMedia("(max-width:600px)").matches;}
function mobileEl(id){return document.getElementById(id);}
function mobileDrawerWidth(width){
  var max=Math.max(0,mobileEl("story-area").clientWidth-8-120);
  mobileUI.width=Math.max(0,Math.min(max,width));
  stickStoryBottomAfterPanel(function(){
    mobileEl("rpanel").style.setProperty("--mobile-drawer",mobileUI.width+"px");
    mobileEl("rpanel").classList.toggle("mobile-open",mobileUI.width>0);
  });
  var g=mobileEl("mobile-grab");g.setAttribute("aria-valuenow",Math.round(mobileUI.width));g.setAttribute("aria-valuemax",max);
}
function mobileToggleDrawer(){mobileDrawerWidth(mobileUI.width>0?0:Math.min(360,Math.round(mobileEl("story-area").clientWidth*0.43)));}
function mobileSelectPanel(key){
  mobileUI.selected=key;
  MOBILE_PANELS.forEach(function(x){var selected=key===x.key,b=mobileEl("mobile-tab-"+x.key);mobileEl("pss-"+x.key).classList.toggle("mobile-selected",selected);b.setAttribute("aria-selected",selected?"true":"false");b.tabIndex=selected?0:-1;});
}
function mobileLayout(){
  if(!mobileUI.ready)return;
  var phone=mobilePhone(),tts=mobileEl("tts-btn");
  if(phone!==mobileUI.phone){
    if(phone)mobileEl("mobile-panel-tabs").appendChild(tts);
    else mobileEl("hud-btns").insertBefore(tts,mobileEl("hud-btns").lastElementChild);
    mobileUI.phone=phone;
  }
  mobileDrawerWidth(mobileUI.width);
  if(worldState&&worldState.combat)updateCombat();
}
function mobileRenderWays(w){
  if(!mobileUI.ready)return;
  var place=mobileEl("mobile-place"),sel=mobileEl("mobile-ways");
  place.textContent=w?w.here.world+(w.here.sub?" › "+w.here.sub:""):"";place.title=place.textContent;
  sel.innerHTML="";sel.appendChild(new Option("Connected locations ("+(w?w.ways.length:0)+")",""));
  (w?w.ways:[]).forEach(function(x,i){var o=new Option(x.label+(x.unexplored?" ?":""),String(i));o.title=x.note||x.action;sel.appendChild(o);});
  sel.disabled=!w||!w.ways.length;
  sel.onchange=function(){if(sel.value===""||!w)return;var x=w.ways[Number(sel.value)],inp=mobileEl("action-input");inp.value=x.action;inp.dispatchEvent(new Event("input"));sel.value="";focusStoryBox();};
}
function mobileRenderStatus(act,day){
  if(!mobileUI.ready)return;
  mobileEl("mobile-act").textContent=act?(act.done?"Act Complete":act.text):"Act —";
  mobileEl("mobile-act").title=act?act.text:"No active act recorded";
  mobileEl("mobile-clock").textContent=day.replace(/^\s*\|\s*/,"");mobileEl("mobile-version").textContent=APP_VERSION;
  mobileEl("hud-cls").title=mobileEl("hud-cls").textContent;
}
function mobileInit(){
  if(mobileUI.ready)return;mobileUI.ready=true;
  var top=mobileEl("topbar"),place=document.createElement("div"),ways=document.createElement("select"),status=document.createElement("span");
  place.id="mobile-place";place.className="mobile-only";ways.id="mobile-ways";ways.className="mobile-only mobile-select";ways.setAttribute("aria-label","Connected locations");top.appendChild(place);
  /* #657 (owner 2026-10-22): the master mute at the right end of the Connected locations row. AudioMaster is the state
     (every audio source multiplies by its gain); this button is only its door and its paint. */
  var waysRow=document.createElement("div"),mute=document.createElement("button");waysRow.id="mobile-ways-row";waysRow.className="mobile-only";
  mute.id="mobile-mute";mute.type="button";mute.className="mobile-select";
  mute.innerHTML="<svg class='ico-on' viewBox='0 0 24 24' aria-hidden='true' fill='currentColor' stroke='currentColor' stroke-width='1.8' stroke-linecap='round'><path d='M3 9v6h4l5 4V5L7 9H3z' stroke='none'/><path d='M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13' fill='none'/></svg>"
    +"<svg class='ico-off' viewBox='0 0 24 24' aria-hidden='true' fill='currentColor' stroke='currentColor' stroke-width='1.8' stroke-linecap='round'><path d='M3 9v6h4l5 4V5L7 9H3z' stroke='none'/><path d='M16 9l5 6M21 9l-5 6' fill='none'/></svg>";
  waysRow.appendChild(ways);waysRow.appendChild(mute);top.appendChild(waysRow);
  function paintMute(){var m=AudioMaster.muted();mute.classList.toggle("muted",m);mute.setAttribute("aria-pressed",m?"true":"false");mute.setAttribute("aria-label",m?"Unmute all sound":"Mute all sound");mute.title=m?"Sound is muted — tap to unmute":"Mute all sound and narration";}
  mute.addEventListener("click",function(){AudioMaster.toggle();});AudioMaster.onChange(paintMute);paintMute();
  status.id="mobile-status";status.className="mobile-only";status.innerHTML="<span id='mobile-act'></span><span id='mobile-clock'></span><span id='mobile-version'></span>";mobileEl("membar").insertBefore(status,mobileEl("healthdot"));
  var grip=document.createElement("div");grip.id="mobile-grip";
  grip.innerHTML="<button id='mobile-grab' type='button' role='separator' aria-label='Resize side panel' aria-orientation='vertical' aria-valuemin='0' aria-valuenow='0' title='Drag to resize; double tap to open or close; arrow keys also resize'></button>";
  mobileEl("story-area").insertBefore(grip,mobileEl("rpanel"));
  var tabs=document.createElement("div");tabs.id="mobile-panel-tabs";tabs.setAttribute("role","tablist");tabs.setAttribute("aria-orientation","vertical");tabs.setAttribute("aria-label","Side panel");
  MOBILE_PANELS.forEach(function(x,i){var b=document.createElement("button");b.id="mobile-tab-"+x.key;b.textContent=x.label;b.title=x.name;b.setAttribute("aria-label",x.name);b.setAttribute("role","tab");b.setAttribute("aria-controls","pss-"+x.key);b.addEventListener("click",function(){mobileSelectPanel(x.key);if(!mobileUI.width)mobileToggleDrawer();});b.addEventListener("keydown",function(e){var step={ArrowDown:1,ArrowUp:-1},at=i;if(step[e.key])at=(i+step[e.key]+MOBILE_PANELS.length)%MOBILE_PANELS.length;else if(e.key==="Home")at=0;else if(e.key==="End")at=MOBILE_PANELS.length-1;else return;e.preventDefault();var key=MOBILE_PANELS[at].key;mobileSelectPanel(key);mobileEl("mobile-tab-"+key).focus();});tabs.appendChild(b);});mobileEl("rpanel").appendChild(tabs);
  var grab=mobileEl("mobile-grab"),drag=null,lastTap=null;
  // Measure travel over the whole gesture, so dragging out and back is never a double tap.
  function move(e){if(!drag||drag.id!==e.pointerId)return;var dx=drag.x-e.clientX,dy=drag.y-e.clientY;
    if(Math.abs(dx)>6||Math.abs(dy)>6){drag.moved=true;lastTap=null;}
    if(drag.moved)mobileDrawerWidth(drag.width+dx);
  }
  grab.addEventListener("pointerdown",function(e){if(e.isPrimary===false||e.button!==0)return;drag={id:e.pointerId,x:e.clientX,y:e.clientY,width:mobileUI.width,moved:false};grab.setPointerCapture(e.pointerId);e.preventDefault();});
  grab.addEventListener("pointermove",move);
  grab.addEventListener("pointerup",function(e){if(!drag||drag.id!==e.pointerId)return;move(e);
    if(!drag.moved){var now=Date.now();if(lastTap&&now-lastTap.time<=350&&Math.abs(e.clientX-lastTap.x)<=24&&Math.abs(e.clientY-lastTap.y)<=24){lastTap=null;mobileToggleDrawer();}
      else lastTap={time:now,x:e.clientX,y:e.clientY};}
    drag=null;if(grab.hasPointerCapture(e.pointerId))grab.releasePointerCapture(e.pointerId);
  });
  grab.addEventListener("pointercancel",function(){drag=null;lastTap=null;});grab.addEventListener("lostpointercapture",function(){if(drag)lastTap=null;drag=null;});
  grab.addEventListener("keydown",function(e){var delta={ArrowLeft:10,ArrowRight:-10};lastTap=null;if(delta[e.key]){mobileDrawerWidth(mobileUI.width+delta[e.key]);e.preventDefault();}else if(e.key==="Home"){mobileDrawerWidth(0);e.preventDefault();}else if(e.key==="End"){mobileDrawerWidth(Infinity);e.preventDefault();}else if(e.key==="Enter"||e.key===" "){mobileToggleDrawer();e.preventDefault();}});
  // #643 (owner 2026-10-18): the EDGE SWIPE — a leftward swipe that begins within EDGE_ZONE of the right screen edge, at ANY height
  // of the story area, opens the drawer and follows the finger. The 44×96 grab stays the visible handle (and the double tap): the
  // owner's sweep from the bezel landed above or below that 96px band three times in four. mobile.css gives #story-area
  // touch-action:pan-y pinch-zoom, so a vertical swipe there still scrolls the story (the browser claims it and we see
  // pointercancel) while a horizontal one keeps reaching us. The grab's own drag is untouched — its pointerdown is skipped here.
  var area=mobileEl("story-area"),EDGE_ZONE=24,EDGE_MIN_OPEN=40,edge=null;
  function edgeReset(){if(edge&&edge.captured){try{area.releasePointerCapture(edge.id);}catch(err){}}edge=null;}
  area.addEventListener("pointerdown",function(e){
    if(e.isPrimary===false||e.button!==0||!mobilePhone()||mobileUI.width>0)return;/* opening only: an open drawer's right edge is its tab column */
    if(e.target&&e.target.closest&&e.target.closest("#mobile-grab"))return;/* the handle has its own drag */
    if(window.innerWidth-e.clientX>EDGE_ZONE)return;
    edge={id:e.pointerId,x:e.clientX,y:e.clientY,moving:false,captured:false};
  });
  area.addEventListener("pointermove",function(e){
    if(!edge||edge.id!==e.pointerId)return;
    var dx=edge.x-e.clientX,dy=Math.abs(e.clientY-edge.y);
    if(!edge.moving){if(dy>8&&dy>=dx){edge=null;return;}/* a scroll — the browser's */if(dx<=8)return;edge.moving=true;try{area.setPointerCapture(e.pointerId);edge.captured=true;}catch(err){}}
    mobileDrawerWidth(dx);
  });
  area.addEventListener("pointerup",function(e){if(!edge||edge.id!==e.pointerId)return;if(edge.moving&&mobileUI.width<EDGE_MIN_OPEN)mobileDrawerWidth(0);/* a flick that barely opened closes again */edgeReset();});
  area.addEventListener("pointercancel",function(e){if(edge&&edge.id===e.pointerId)edgeReset();});
  area.addEventListener("lostpointercapture",function(e){if(e.target===area&&edge&&edge.id===e.pointerId)edge=null;});/* OURS only: a touch's implicit capture moving from the narrative to the area bubbles a lostpointercapture through here too, and that one must not end the swipe */
  mobileSelectPanel("party");mobileLayout();window.addEventListener("resize",mobileLayout);
}
// Enemy cards read the live foe and exact-name bestiary entry. No fuzzy identity joins and no
// headcounts guessed from aggregate HP. Counts explicitly authored in a name stay intact.
function wireEnemyDetails(ordered){
  var rows=mobileEl("en-rows");if(!rows)return;
  Array.prototype.forEach.call(rows.querySelectorAll(".cname.en"),function(el,i){var foe=ordered[i];el.setAttribute("role","button");el.tabIndex=0;el.setAttribute("aria-label","Details for "+foe.name);el.onclick=function(){showEnemyDetails(foe);};el.onkeydown=function(e){if(e.key==="Enter"||e.key===" "){e.preventDefault();showEnemyDetails(foe);}};});
}
function showEnemyDetails(foe){
  var h="<h2 style='font-size:18px;color:var(--acc)'>"+escHtml(foeLabel(foe))+"</h2><dl class='enemy-facts'>";
  function row(label,v){if(v!==undefined&&v!==null&&v!=="")h+="<dt>"+escHtml(label)+"</dt><dd>"+escHtml(Array.isArray(v)?v.join(", "):String(v))+"</dd>";}
  row("HP",foe.hp+" / "+foe.maxHp);
  [{key:"ac",label:"Armor class"},{key:"atk",label:"Attack"},{key:"dmg",label:"Damage"},{key:"morale",label:"Morale"},{key:"down",label:"State"},{key:"immune",label:"Immune"},{key:"resist",label:"Resistant"},{key:"vuln",label:"Vulnerable"}].forEach(function(x){row(x.label,foe[x.key]);});
  if(foe.stats)Object.keys(foe.stats).forEach(function(k){row(k,foe.stats[k]);});
  var record=null;(worldState.bestiary||[]).some(function(b){if(String(b.name).toLowerCase()===String(foe.name).toLowerCase()){record=b;return true;}return false;});
  if(record)[{key:"kind",label:"Type"},{key:"threat",label:"Threat"},{key:"desc",label:"Description"},{key:"notes",label:"Creature notes"}].forEach(function(x){row(x.label,record[x.key]);});
  if(typeof foe.count==="number")row("Group size",foe.count);/* #612: the authored headcount */
  else if(foeGroupUnrecorded(foe))row("Group size","Not recorded");/* #612: the one predicate the prompt's ask reads */
  h+="</dl><button class='ib' id='enemy-close'>Close</button>";modalShell("enemy-modal",h,{closeId:"enemy-close",outside:true,maxWidth:420});
}
