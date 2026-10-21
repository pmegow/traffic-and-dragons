/* ui-dice.js — THE ROLL OVERLAY (#650, owner rulings 2026-10-19/20): when the player clicks a pending check, the rolled
   d20 plays as a rendered clip over the story area — the die thrown onto the felt, tumbling, settling with the result
   face up, right side up, the other faces dimmed as it comes to rest. A thin DOM shell: the clip choice is the pure
   diceClipSrc (helpers.js), the roll itself is rollPendingCheck (game.js), which calls showDiceRoll(face) AFTER the result
   card and the GM call are on their way — the clip never delays the turn, and dismissing it changes nothing.
   Two players behind one door: a <video> for the VP9 WebM with alpha, and for WebKit (no VP9 alpha, no HEVC-alpha
   encoder on this side) the STACKED-ALPHA canvas — the H.264 clip is twice as wide, colour | matte, played hidden and
   recombined per frame: the left half's pixels with the right half's grey as their alpha (the colour is premultiplied
   over black, so a partial pixel is divided back out). ~320k pixels a frame for three seconds, fine on a phone.
   Skipped (returns false, nothing shown): headless, no story area, Car Mode (its own screen covers the page), a reduced-
   motion preference, a face outside 1..20. A clip that fails to load or play says so on the console and through
   reportError once per session (the phone's console is invisible) and closes at once — the card already holds the
   number; a play() the device itself refused (NotAllowedError, an autoplay policy) is not our bug and is not reported.
   Assets: dice/d20_NN.webm | dice/d20_NN-stacked.mp4 (dev/blender/dice-clips.js), served cache-first from the SW's DICE_CACHE. */
var DICE_ROLL_HOLD_MS=700;      /* the settled die stays up this long after the clip ends, then fades */
var DICE_ROLL_FADE_MS=250;      /* matches .dice-roll.out in index.html */
var _diceClipReported=false;
function showDiceRoll(face,opts){
  if(typeof document==="undefined"||typeof diceClipSrc!=="function")return false;
  var area=document.getElementById("story-area");if(!area)return false;
  if(typeof carMode!=="undefined"&&carMode)return false;
  if(typeof window!=="undefined"&&window.matchMedia&&window.matchMedia("(prefers-reduced-motion: reduce)").matches)return false;
  var nav=typeof navigator!=="undefined"?navigator:{};
  var env={ua:nav.userAgent,platform:nav.platform,maxTouchPoints:nav.maxTouchPoints};
  var src=diceClipSrc(face,env);
  if(!src)return false;
  var stacked=diceClipFormat(env)==="stacked";
  var old=document.getElementById("dice-roll");if(old&&old.parentNode)old.parentNode.removeChild(old);
  var wrap=document.createElement("div");wrap.id="dice-roll";wrap.className="dice-roll";wrap.title="Click to dismiss";
  var v=document.createElement("video");v.muted=true;v.playsInline=true;v.setAttribute("playsinline","");v.setAttribute("muted","");v.preload="auto";v.src=src;
  var canvas=null;
  if(stacked){v.className="dice-stacked-src";canvas=document.createElement("canvas");wrap.appendChild(canvas);}
  wrap.appendChild(v);area.appendChild(wrap);
  var closed=false;
  function close(){
    if(closed)return;closed=true;wrap.classList.add("out");
    setTimeout(function(){if(wrap.parentNode)wrap.parentNode.removeChild(wrap);if(opts&&typeof opts.onClose==="function")opts.onClose();},DICE_ROLL_FADE_MS);
  }
  function fail(why,quiet){
    var msg="dice clip "+src+": "+why;
    console.warn(msg);
    if(!quiet&&!_diceClipReported&&typeof reportError==="function"){_diceClipReported=true;reportError("dice-clip",msg,{face:face,src:src});}
    close();
  }
  wrap.onclick=close;
  v.onended=function(){setTimeout(close,DICE_ROLL_HOLD_MS);};
  v.onerror=function(){fail("failed to load"+(v.error&&v.error.message?" ("+v.error.message+")":""));};
  if(stacked)diceStackedPlayer(v,canvas,function(){return closed;});
  var p=v.play();
  if(p&&typeof p.catch==="function")p.catch(function(e){fail("would not play ("+(e&&e.message||e)+")",!!(e&&e.name==="NotAllowedError"));});
  return true;
}
/* #650 TEMPORARY (owner 2026-10-20): File ▸ Dev tools ▸ 🎲 Test roll — a random face played as the clip, no check, no
   state, so the owner can look at the roll without finding a fight. Remove with the menu row once signed off. */
function testDiceRoll(){
  if(!worldState||!worldState.character){showToast("Start a game first.");return;}
  var face=rollD20();
  if(showDiceRoll(face))showToast("Test roll: "+face);
  else showToast("The roll clip did not open here (Car Mode, reduced motion, or no story area).");
}
/* The stacked-alpha recombiner: draws each video frame to a work canvas, reads the two halves, runs the pure
   diceStackedRecombine (helpers.js) and paints the result. Frames arrive through
   requestVideoFrameCallback where the browser has it (Safari 15.4+), else requestAnimationFrame. The last frame stays
   painted after the clip ends. Never throws: a canvas the browser refuses (no 2d context) closes nothing and says why. */
function diceStackedPlayer(v,canvas,isClosed){
  var ctx=canvas.getContext("2d"),work=document.createElement("canvas"),wctx=work.getContext("2d"),W=0,H=0,ready=false;
  if(!ctx||!wctx){console.warn("dice clip: no 2d canvas for the stacked player");return;}
  function size(){W=Math.floor(v.videoWidth/2);H=v.videoHeight;if(!W||!H)return false;canvas.width=W;canvas.height=H;work.width=W*2;work.height=H;ready=true;return true;}
  function draw(){
    if(isClosed())return;
    if(!ready&&!size()){schedule();return;}
    wctx.drawImage(v,0,0);
    var c=wctx.getImageData(0,0,W,H),m=wctx.getImageData(W,0,W,H);
    diceStackedRecombine(c.data,m.data);
    ctx.putImageData(c,0,0);
    if(!v.ended)schedule();
  }
  function schedule(){
    if(typeof v.requestVideoFrameCallback==="function")v.requestVideoFrameCallback(draw);
    else requestAnimationFrame(draw);
  }
  schedule();
}
