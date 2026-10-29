/* ui-dice.js — THE LIVE DICE (#669, owner 2026-10-25: "roll it into TnD"; rulings: the Blender roll clips are retired,
   the dice start as the Bone preset with a Dice appearance setting under File ▸ Settings, the damage dice still roll after
   the settled d20 is dismissed (#654), and the sound is dice-sim's recorded impact clicks).
   When the player clicks a pending check, rollPendingCheck (game.js) decides the d20 — and, on a hit, the damage faces —
   sends the turn, and THEN calls showDiceRoll(face,{onClose}) (#650's door, unchanged): the dice are thrown live over the
   story by dice-sim (C:\Projects\dice-sim, published to roller/ by its dev/publish-to-tnd.js; its embed API is
   roller/embed/), landing on exactly the faces the engine rolled — the dice decide nothing and never delay the turn. With no
   tray drawn the screen's edges are the dice's walls. The settled dice stay until the player clicks or taps them (owner
   2026-10-20); that click runs opts.onClose, which plays the damage dice (#654) through showDamageRoll(sides,faces).
   A thin DOM shell over a module: this file is ES5, the module (roller/embed/global.js, ES2020) is loaded by a script tag
   and sets window.DiceSim; index.html's import map points "three" at roller/vendor/three/. ONE overlay — one WebGL context,
   one sound engine — for the whole session (the monotonic-resources rule), made as soon as the module is there:
   diceLivePreload() (showGame) fetches the module early and diceLiveWarm() then makes the overlay, which readies its
   look's pipeline and the exit's shaders while the player reads (dice-sim 0.60.0: the first die drawn before they were
   built stalled 0.6 s in the air after a reload and popped onto the floor — owner 2026-10-28, dice-sim TODO row 47).
   Skipped (returns false, nothing shown): headless, no story area, Car Mode (its own screen covers the page), a reduced-
   motion preference, a face outside its die. A module that fails to load, or a device that cannot start the dice (no
   WebGL), says so on the console and through reportError once per session (the phone's console is invisible) — the card
   already holds the number. Sound: the clicks share Sound's AudioContext and fall silent with the master mute (#657) or
   the UI-sounds switch. #670 (owner 2026-10-26): a dismissed roll leaves by the player's exit (Smoke puff until they pick
   one under Dice appearance), with dice-sim's sounds; the damage dice roll as the d20 leaves. */
var DICE_LIVE_SRC="roller/embed/global.js";
var DICE_LOOK_KEY="tnd_dice_look_v1";   /* {name, style}: the player's dice look on this device */
var DICE_LOOK_DEFAULT="Bone";           /* owner 2026-10-25 */
var DICE_ROLL_FADE_MS=250;              /* matches #dice-layer.out in index.html */
var DICE_EXIT_KEY="tnd_dice_exit_v1";   /* #670: how dismissed dice leave on this device — a dice-sim exit name */
var DICE_EXIT_DEFAULT="smoke";          /* #670, owner 2026-10-26: Smoke puff until the player picks one */
var _diceLive={state:"idle",overlay:null,layer:null,waiting:[],reported:false,muteHooked:false,token:0,last:null};

/* Says why the live dice did not show, on the console every time and through reportError once per session. */
function diceLiveFail(why,detail){
  var msg="live dice: "+why;
  console.warn(msg);
  if(!_diceLive.reported&&typeof reportError==="function"){_diceLive.reported=true;reportError("dice-live",msg,detail||{});}
}

/* Fetches the dice module (once). Its 'dicesim-ready' event runs whatever waited for it. */
function diceLivePreload(){
  if(_diceLive.state!=="idle"||typeof document==="undefined"||typeof window==="undefined")return;
  if(window.DiceSim){_diceLive.state="ready";diceLiveWarm();return;}
  _diceLive.state="loading";
  window.addEventListener("dicesim-ready",function(){
    _diceLive.state="ready";
    diceLiveWarm();
    var waiting=_diceLive.waiting;_diceLive.waiting=[];
    waiting.forEach(function(f){f();});
  });
  var s=document.createElement("script");s.type="module";s.src=DICE_LIVE_SRC;
  s.onerror=function(){_diceLive.state="failed";_diceLive.waiting=[];diceLiveFail("the dice module did not load ("+DICE_LIVE_SRC+")");};
  document.head.appendChild(s);
}
/* Makes the overlay as soon as the module is there, so its look's pipeline and the exit's shaders are built while the
   player reads, not at the first click (dice-sim 0.60.0 readies them as the overlay is made and its roll() waits for
   them up to 1.5 s). Never where the dice would not show (diceRollEnv): a roll there makes it later, if ever. */
function diceLiveWarm(){
  if(_diceLive.overlay||!diceRollEnv())return;
  try{diceLiveOverlay();}
  catch(e){_diceLive.state="failed";diceLiveFail("the dice could not start ("+(e&&e.message||e)+")",{at:"preload"});}
}
/* Runs f once the module is there; never, if it failed to load (that was already said). */
function diceLiveWhenReady(f){
  if(typeof window!=="undefined"&&window.DiceSim){f();return;}
  if(_diceLive.state==="failed")return;
  _diceLive.waiting.push(f);
  diceLivePreload();
}

/* The skips every roll shares: true when dice may show. */
function diceRollEnv(){
  if(typeof document==="undefined"||typeof window==="undefined")return false;
  if(!document.getElementById("story-area"))return false;
  if(typeof carMode!=="undefined"&&carMode)return false;
  if(window.matchMedia&&window.matchMedia("(prefers-reduced-motion: reduce)").matches)return false;
  return true;
}

/* The player's dice look: the saved one, else the Bone preset. */
function diceLookSaved(){try{var v=JSON.parse(localStorage.getItem(DICE_LOOK_KEY)||"null");return v&&v.name&&v.style?v:null;}catch(e){return null;}}
function diceLookPreset(name){var list=window.DiceSim?window.DiceSim.presets():[],i;for(i=0;i<list.length;i++)if(list[i].name===name)return list[i];return null;}
function diceLookStyle(){
  var saved=diceLookSaved();if(saved)return saved.style;
  var p=diceLookPreset(DICE_LOOK_DEFAULT);return p?window.DiceSim.presetStyle(p):undefined;
}
function diceLookName(){var saved=diceLookSaved();return saved?saved.name:DICE_LOOK_DEFAULT;}
function diceLookChoose(p){
  var style=window.DiceSim.presetStyle(p);
  try{localStorage.setItem(DICE_LOOK_KEY,JSON.stringify({name:p.name,style:style}));}
  catch(e){if(typeof showToast==="function")showToast("Dice appearance could not be saved on this device ("+(e&&e.message||e)+")");console.warn("dice look not saved",e);}
  if(_diceLive.overlay)_diceLive.overlay.setLook(style).catch(function(e){diceLiveFail("the dice look did not change ("+(e&&e.message||e)+")",{look:p.name});});
}

/* #670: how dismissed dice leave — the saved exit, else Smoke puff. One the dice no longer have (a later dice release
   dropped it) is said on the console and replaced by the default. */
function diceExitName(){
  var saved=null,list,i;
  try{saved=localStorage.getItem(DICE_EXIT_KEY);}catch(e){saved=null;}
  if(!saved)return DICE_EXIT_DEFAULT;
  if(typeof window==="undefined"||!window.DiceSim)return saved;
  list=window.DiceSim.exits();
  for(i=0;i<list.length;i++)if(list[i].name===saved)return saved;
  console.warn("live dice: the saved exit \""+saved+"\" is not one the dice have; using "+DICE_EXIT_DEFAULT);return DICE_EXIT_DEFAULT;
}
function diceExitChoose(name){
  try{localStorage.setItem(DICE_EXIT_KEY,name);}
  catch(e){if(typeof showToast==="function")showToast("The dice exit could not be saved on this device ("+(e&&e.message||e)+")");console.warn("dice exit not saved",e);}
  if(_diceLive.overlay){try{_diceLive.overlay.setExit(name);}catch(e){diceLiveFail("the dice exit did not change ("+(e&&e.message||e)+")",{exit:name});}}
}

/* The one layer over the story, made once; put back if the story area was rebuilt. */
function diceLiveLayer(){
  var area=document.getElementById("story-area"),el=_diceLive.layer;
  if(!el){el=document.createElement("div");el.id="dice-layer";el.title="Click to dismiss";_diceLive.layer=el;}
  if(el.parentNode!==area)area.appendChild(el);
  return el;
}
/* The one overlay for the session (one WebGL context, one sound engine): made by diceLiveWarm once the module is there,
   or by the first roll where that did not happen. */
function diceLiveOverlay(){
  if(_diceLive.overlay)return _diceLive.overlay;
  var ctx=null;
  try{if(typeof Sound!=="undefined"&&typeof Sound.context==="function")ctx=Sound.context();}catch(e){ctx=null;}
  _diceLive.overlay=window.DiceSim.createDiceOverlay({container:diceLiveLayer(),look:diceLookStyle(),context:ctx||null,exit:diceExitName()});
  if(!_diceLive.muteHooked&&typeof AudioMaster!=="undefined"&&typeof AudioMaster.onChange==="function"){_diceLive.muteHooked=true;AudioMaster.onChange(function(){diceLiveMute();});}
  return _diceLive.overlay;
}
/* Silent while the master mute (#657) is on or the UI sounds are switched off. */
function diceLiveMute(){
  if(!_diceLive.overlay)return;
  var muted=(typeof AudioMaster!=="undefined"&&AudioMaster.muted())||(typeof Sound!=="undefined"&&typeof Sound.enabled==="function"&&!Sound.enabled());
  _diceLive.overlay.setMuted(!!muted);
}

/* Throws `dice` ([{type,value}]) over the story; the click that dismisses them runs opts.onClose. */
function diceLiveRoll(dice,label,opts){
  if(!diceRollEnv())return false;
  if(_diceLive.state==="failed")return false;
  diceLiveWhenReady(function(){
    var overlay;
    try{overlay=diceLiveOverlay();}
    catch(e){_diceLive.state="failed";diceLiveFail("the dice could not start ("+(e&&e.message||e)+")",{roll:label});return;}
    var layer=diceLiveLayer(),token=++_diceLive.token;
    layer.classList.remove("out");layer.classList.remove("leaving");layer.classList.add("on");
    layer.onclick=function(){diceLiveClose(token,opts);};/* the only way out: the settled dice stay until the player clicks (owner 2026-10-20) */
    diceLiveMute();
    overlay.roll(dice).then(function(r){if(r)_diceLive.last=r.dice.map(function(d){return d.type+":"+d.value;});}).catch(function(e){diceLiveFail("the roll did not play ("+(e&&e.message||e)+")",{roll:label});diceLiveClose(token,null);});
  });
  return true;
}
function diceLiveClose(token,opts){
  if(token!==_diceLive.token)return;/* a newer roll took the layer */
  var layer=_diceLive.layer,overlay=_diceLive.overlay;
  layer.onclick=null;var mine=++_diceLive.token;
  /* #670 (owner 2026-10-26): the dice leave by the player's exit, heard (dice-sim's dismiss). The layer lets the story be
     clicked while they go and hides once they have gone — unless a newer roll took it: the damage dice roll as the d20
     leaves (owner ruling), coming in as it goes. */
  if(overlay&&overlay.exit!=="none"){
    layer.classList.add("leaving");
    overlay.dismiss().then(function(){
      if(mine!==_diceLive.token)return;
      layer.classList.remove("on");layer.classList.remove("leaving");
    }).catch(function(e){
      diceLiveFail("the dice did not leave by their exit ("+(e&&e.message||e)+")",{exit:overlay.exit});
      if(mine===_diceLive.token){layer.classList.remove("on");layer.classList.remove("leaving");}
    });
    if(opts&&typeof opts.onClose==="function"){var rollDamage=opts.onClose;rollDamage();}/* the damage dice roll as the d20 leaves (owner 2026-10-26) */
    return;
  }
  layer.classList.add("out");
  setTimeout(function(){
    layer.classList.remove("on");layer.classList.remove("out");
    if(_diceLive.overlay)_diceLive.overlay.clear();
    if(opts&&typeof opts.onClose==="function")opts.onClose();
  },DICE_ROLL_FADE_MS);
}

/* #650's door: the check's d20, landing on `face`. */
function showDiceRoll(face,opts){
  if(!(face>=1&&face<=20&&Math.floor(face)===face))return false;
  return diceLiveRoll([{type:"d20",value:face}],"d20:"+face,opts);
}
/* #653/#654's door: the damage dice — `faces`, one per die, each a d`sides` — after the d20 is dismissed. */
function showDamageRoll(sides,faces,opts){
  var list=Array.isArray(faces)?faces:[faces],dice=[],i;
  if(typeof DAMAGE_DICE_SIDES!=="undefined"&&DAMAGE_DICE_SIDES.indexOf(sides)<0)return false;
  if(!list.length||(typeof DAMAGE_DICE_MAX!=="undefined"&&list.length>DAMAGE_DICE_MAX))return false;
  for(i=0;i<list.length;i++){if(!(list[i]>=1&&list[i]<=sides&&Math.floor(list[i])===list[i]))return false;dice.push({type:"d"+sides,value:list[i]});}
  return diceLiveRoll(dice,"d"+sides+":"+list.join("+"),opts);
}

/* File ▸ Settings ▸ 🎲 Dice appearance: the presets (the built-ins, and any saved in the dice roller on this site); a
   choice is kept on this device and the next roll wears it. "Roll a test d20" shows it over the story. #670: and how the
   dice leave when dismissed — dice-sim's exits, Smoke puff until the player picks. */
function showDiceLookModal(){
  var modal=modalShell("dice-look-modal",
    "<div style='font-family:var(--font);font-size:16px;font-weight:700;color:var(--acc);margin-bottom:4px;'>&#127922; Dice appearance</div>"
    +"<div style='font-size:12px;color:var(--t2);margin-bottom:12px;'>The look of the dice you roll, and how they leave when you dismiss them. Saved on this device.</div>"
    +"<div id='dice-look-list' role='radiogroup' aria-label='Dice presets' style='display:flex;flex-direction:column;gap:6px;max-height:50vh;overflow-y:auto;'>Loading the dice&hellip;</div>"
    +"<label style='display:flex;align-items:center;gap:10px;margin-top:12px;font-size:13px;color:var(--t1);'>When dismissed"
    +"<select id='dice-exit' aria-label='How the dice leave when dismissed' style='flex:1;font:inherit;font-size:13px;background:var(--bg1);color:var(--t1);border:1px solid var(--brd2);border-radius:6px;padding:4px 6px;'></select></label>"
    +"<div style='display:flex;gap:8px;justify-content:flex-end;margin-top:14px;'>"
    +"<button id='dice-look-test' type='button' style='font:inherit;font-size:13px;background:none;border:1px solid var(--brd2);border-radius:6px;color:var(--t1);padding:6px 12px;cursor:pointer;'>Roll a test d20</button>"
    +"<button id='dice-look-done' type='button' style='font:inherit;font-size:13px;background:var(--acc);border:0;border-radius:6px;color:var(--bg0);padding:6px 14px;cursor:pointer;'>Done</button></div>",
    {closeId:"dice-look-done",outside:true,maxWidth:380});
  var test=document.getElementById("dice-look-test"),area=document.getElementById("story-area");
  if(!area||!area.offsetParent)test.style.display="none";/* no story on screen (the wizard's menu): nowhere to roll */
  test.addEventListener("click",function(){
    modal.remove();
    showDiceRoll(1+Math.floor(Math.random()*20));
  });
  diceLiveWhenReady(function(){
    var box=document.getElementById("dice-look-list");if(!box)return;
    var current=diceLookName(),h="";
    window.DiceSim.presets().forEach(function(p,i){
      h+="<label style='display:flex;align-items:center;gap:10px;padding:6px 8px;border:1px solid var(--brd);border-radius:8px;cursor:pointer;'>"
        +"<input type='radio' name='dice-look' value='"+i+"'"+(p.name===current?" checked":"")+" style='accent-color:var(--acc);'/>"
        +"<span style='width:22px;height:22px;border-radius:5px;background:"+escHtml(p.body)+";border:1px solid var(--brd2);display:flex;align-items:center;justify-content:center;font:700 12px var(--font);color:"+escHtml(p.ink)+";'>6</span>"
        +"<span style='flex:1;font-size:13px;color:var(--t1);'>"+escHtml(p.name)+(p.builtIn?"":" <span style='color:var(--t2);font-size:11px;'>(saved)</span>")+"</span>"
        +"<span style='font-size:11px;color:var(--t2);'>"+escHtml(p.finish)+"</span></label>";
    });
    box.innerHTML=h;
    var list=window.DiceSim.presets();
    Array.prototype.forEach.call(box.querySelectorAll("input[name='dice-look']"),function(r){
      r.addEventListener("change",function(){if(r.checked)diceLookChoose(list[Number(r.value)]);});
    });
    var sel=document.getElementById("dice-exit"),chosen=diceExitName(),o="";
    if(sel){
      window.DiceSim.exits().forEach(function(x){o+="<option value='"+escHtml(x.name)+"'"+(x.name===chosen?" selected":"")+">"+escHtml(x.label)+"</option>";});
      sel.innerHTML=o;
      sel.addEventListener("change",function(){diceExitChoose(sel.value);});
    }
  });
  if(_diceLive.state==="failed"){var b=document.getElementById("dice-look-list");if(b)b.textContent="The dice could not load on this device.";}
  return modal;
}

/* The test seam (#669): what the live dice are doing, for dev/tests-669-live-dice-browser.js. */
function diceLiveState(){return {state:_diceLive.state,overlay:!!_diceLive.overlay,showing:!!(_diceLive.layer&&_diceLive.layer.classList.contains("on")),look:diceLookName(),last:_diceLive.last,muted:!!(_diceLive.overlay&&_diceLive.overlay.audio&&_diceLive.overlay.audio.muted),exit:diceExitName(),exiting:_diceLive.overlay?_diceLive.overlay.view.exiting.size:0};}
