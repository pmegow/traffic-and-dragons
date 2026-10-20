/* ui-dice.js — THE ROLL OVERLAY (#650, owner rulings 2026-10-19/20): when the player clicks a pending check, the rolled
   d20 plays as a rendered clip over the story area — the die thrown onto the felt, tumbling, settling with the result
   face up, right side up, the other faces dimmed as it comes to rest. A thin DOM shell: the clip choice is the pure
   diceClipSrc (helpers.js), the roll itself is rollPendingCheck (game.js), which calls showDiceRoll(face) AFTER the result
   card and the GM call are on their way — the clip never delays the turn, and dismissing it changes nothing.
   Skipped (returns false, nothing shown): headless, no story area, Car Mode (its own screen covers the page), a reduced-
   motion preference, a face outside 1..20. A clip that fails to load or play says so on the console and through
   reportError once per session (the phone's console is invisible) and closes at once — the card already holds the number.
   Assets: dice/d20_NN.webm|mp4 (dev/blender/dice-clips.js), served cache-first from the SW's DICE_CACHE. */
var DICE_ROLL_HOLD_MS=700;      /* the settled die stays up this long after the clip ends, then fades */
var DICE_ROLL_FADE_MS=250;      /* matches .dice-roll.out in index.html */
var _diceClipReported=false;
function showDiceRoll(face,opts){
  if(typeof document==="undefined"||typeof diceClipSrc!=="function")return false;
  var area=document.getElementById("story-area");if(!area)return false;
  if(typeof carMode!=="undefined"&&carMode)return false;
  if(typeof window!=="undefined"&&window.matchMedia&&window.matchMedia("(prefers-reduced-motion: reduce)").matches)return false;
  var nav=typeof navigator!=="undefined"?navigator:{};
  var src=diceClipSrc(face,{ua:nav.userAgent,platform:nav.platform,maxTouchPoints:nav.maxTouchPoints});
  if(!src)return false;
  var old=document.getElementById("dice-roll");if(old&&old.parentNode)old.parentNode.removeChild(old);
  var wrap=document.createElement("div");wrap.id="dice-roll";wrap.className="dice-roll";wrap.title="Click to dismiss";
  var v=document.createElement("video");v.muted=true;v.playsInline=true;v.setAttribute("playsinline","");v.setAttribute("muted","");v.preload="auto";v.src=src;
  wrap.appendChild(v);area.appendChild(wrap);
  var closed=false;
  function close(){
    if(closed)return;closed=true;wrap.classList.add("out");
    setTimeout(function(){if(wrap.parentNode)wrap.parentNode.removeChild(wrap);if(opts&&typeof opts.onClose==="function")opts.onClose();},DICE_ROLL_FADE_MS);
  }
  function fail(why){
    var msg="dice clip "+src+": "+why;
    console.warn(msg);
    if(!_diceClipReported&&typeof reportError==="function"){_diceClipReported=true;reportError("dice-clip",msg,{face:face,src:src});}
    close();
  }
  wrap.onclick=close;
  v.onended=function(){setTimeout(close,DICE_ROLL_HOLD_MS);};
  v.onerror=function(){fail("failed to load"+(v.error&&v.error.message?" ("+v.error.message+")":""));};
  var p=v.play();
  if(p&&typeof p.catch==="function")p.catch(function(e){fail("would not play ("+(e&&e.message||e)+")");});
  return true;
}
