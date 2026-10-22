/* ui-dice.js — THE ROLL OVERLAY (#650, owner rulings 2026-10-19/20): when the player clicks a pending check, the rolled
   d20 plays as a rendered clip over the story area — the die thrown onto the felt, tumbling, settling with the result
   face up, right side up, the other faces dimmed as it comes to rest. A thin DOM shell: the clip choice is the pure
   diceClipSrc (helpers.js), the roll itself is rollPendingCheck (game.js), which calls showDiceRoll(face) AFTER the result
   card and the GM call are on their way — the clip never delays the turn, and dismissing it changes nothing.
   Two players behind one door: a <video> for the VP9 WebM with alpha, and for WebKit (no VP9 alpha, no HEVC-alpha
   encoder on this side) the STACKED-ALPHA canvas — the H.264 clip is twice as wide, colour | matte, played hidden and
   recombined per frame: the left half's pixels with the right half's grey as their alpha (the colour is premultiplied
   over black, so a partial pixel is divided back out). ~320k pixels a frame for three seconds, fine on a phone.
   The settled die stays until the player clicks or taps the overlay (owner 2026-10-20) — no timer takes it away.
   #653 — THE DAMAGE DICE (owner rulings 2026-10-21): showDamageRoll(sides,faces) plays d4/d6/d8/d10/d12 clips the same way,
   one clip per die COMPOSITED — two to four tiles in a row (two-by-two when narrow), each a square window onto its clip's
   frame cropped around the landing spot (the pure diceTileLayout, helpers.js), the starts staggered a beat so a double is
   two dice, not one clip twice. One die plays full-frame, exactly like the d20. The same overlay, the same door out.
   Skipped (returns false, nothing shown): headless, no story area, Car Mode (its own screen covers the page), a reduced-
   motion preference, a face outside the die, more than DICE_TILE_MAX dice. A clip that fails to load or play says so on the
   console and through reportError once per session (the phone's console is invisible) and closes at once — the card already
   holds the number; a play() the device itself refused (NotAllowedError, an autoplay policy) is not our bug and is not reported.
   Assets: dice/dN_FF.webm | dice/dN_FF-stacked.mp4 (dev/blender/dice-clips.js), served cache-first from the SW's DICE_CACHE. */
var DICE_ROLL_FADE_MS=250;      /* matches .dice-roll.out in index.html */
var DICE_TILE_STAGGER_MS=90;    /* #653: each further die starts this much later — a handful lands a beat apart */
/* Owner 2026-10-20: the settled die STAYS until the player clicks or taps it — no timer takes the number away. */
var _diceClipReported=false;
/* The skips every roll shares; returns the environment diceClipFormat reads, or false when nothing may show. */
function diceRollEnv(){
  if(typeof document==="undefined"||typeof diceClipSrc!=="function")return false;
  if(!document.getElementById("story-area"))return false;
  if(typeof carMode!=="undefined"&&carMode)return false;
  if(typeof window!=="undefined"&&window.matchMedia&&window.matchMedia("(prefers-reduced-motion: reduce)").matches)return false;
  var nav=typeof navigator!=="undefined"?navigator:{};
  var env={ua:nav.userAgent,platform:nav.platform,maxTouchPoints:nav.maxTouchPoints};
  return env;
}
function showDiceRoll(face,opts){
  var env=diceRollEnv();if(!env)return false;
  var src=diceClipSrc(face,env);
  if(!src)return false;
  return diceOverlay([src],env,face,opts,[{sides:20,face:face}]);
}
/* #653: faces is the array of rolled faces (one per die), sides the die; every face must name a clip or nothing shows. */
function showDamageRoll(sides,faces,opts){
  var env=diceRollEnv();if(!env)return false;
  var list=Array.isArray(faces)?faces:[faces],srcs=[],dice=[],i,s;
  if(!list.length||list.length>DICE_TILE_MAX)return false;
  for(i=0;i<list.length;i++){s=diceClipSrc(list[i],env,sides);if(!s)return false;srcs.push(s);dice.push({sides:sides,face:list[i]});}
  return diceOverlay(srcs,env,"d"+sides+":"+list.join("+"),opts,dice);
}
/* The overlay itself: one clip full-frame, several as tiles. `face` labels the roll in a failure report; `dice` names
   each clip's die and face so its sound (#659, dice-sound.js) can start the moment that clip's playback does. */
function diceOverlay(srcs,env,face,opts,dice){
  var area=document.getElementById("story-area");
  var stacked=diceClipFormat(env)==="stacked";
  var old=document.getElementById("dice-roll");if(old&&old.parentNode)old.parentNode.removeChild(old);
  var wrap=document.createElement("div");wrap.id="dice-roll";wrap.className="dice-roll";wrap.title="Click to dismiss";
  var layout=null,grid=null;
  if(srcs.length>1){
    layout=diceTileLayout(srcs.length,area.clientWidth-32,area.clientHeight-32);
    grid=document.createElement("div");grid.className="dice-grid";
    grid.style.gridTemplateColumns="repeat("+layout.cols+","+layout.tile+"px)";grid.style.gap=layout.gap+"px";
    wrap.appendChild(grid);
  }
  var closed=false,videos=[];
  function close(){
    if(closed)return;closed=true;wrap.classList.add("out");
    setTimeout(function(){if(wrap.parentNode)wrap.parentNode.removeChild(wrap);if(opts&&typeof opts.onClose==="function")opts.onClose();},DICE_ROLL_FADE_MS);
  }
  function fail(src,why,quiet){
    var msg="dice clip "+src+": "+why;
    console.warn(msg);
    if(!quiet&&!_diceClipReported&&typeof reportError==="function"){_diceClipReported=true;reportError("dice-clip",msg,{face:face,src:src});}
    close();
  }
  wrap.onclick=close;/* the only way out: the settled die stays until the player clicks (owner 2026-10-20) */
  srcs.forEach(function(src,i){
    var v=document.createElement("video");v.muted=true;v.playsInline=true;v.setAttribute("playsinline","");v.setAttribute("muted","");v.preload="auto";v.src=src;
    var canvas=null,host=wrap;
    if(layout){host=document.createElement("div");host.className="dice-tile";host.style.width=layout.tile+"px";host.style.height=layout.tile+"px";grid.appendChild(host);}
    if(stacked){v.className="dice-stacked-src";canvas=document.createElement("canvas");host.appendChild(canvas);}
    host.appendChild(v);
    if(layout){var shown=canvas||v;shown.style.width=layout.frameW+"px";shown.style.height=layout.frameH+"px";shown.style.left=layout.left+"px";shown.style.top=layout.top+"px";}
    v.onerror=function(){fail(src,"failed to load"+(v.error&&v.error.message?" ("+v.error.message+")":""));};
    if(stacked)diceStackedPlayer(v,canvas,function(){return closed;});
    videos.push({v:v,src:src,die:dice&&dice[i]});
  });
  area.appendChild(wrap);
  videos.forEach(function(it,i){
    function start(){
      if(closed)return;
      var p=it.v.play();
      /* #659: the sound starts when THIS clip's playback does (the promise resolves at the first frame), so the ticks land
         where the die lands; a tile's stagger is already in its start, so the recipe's offset is 0 */
      if(p&&typeof p.then==="function")p.then(function(){if(!closed&&it.die&&typeof DiceSound!=="undefined")DiceSound.play(it.die.sides,it.die.face,0);},function(e){fail(it.src,"would not play ("+(e&&e.message||e)+")",!!(e&&e.name==="NotAllowedError"));});
    }
    if(i===0)start();else setTimeout(start,i*DICE_TILE_STAGGER_MS);/* a double is two dice landing a beat apart, not one clip twice */
  });
  return true;
}
/* The stacked-alpha recombiner: draws each video frame to a work canvas, reads the two halves, runs the pure
   diceStackedRecombine (helpers.js) and paints the result. Frames arrive through
   requestVideoFrameCallback where the browser has it (Safari 15.4+), else requestAnimationFrame. The last frame stays
   painted after the clip ends. Never throws: a canvas the browser refuses (no 2d context) closes nothing and says why. */
function diceStackedPlayer(v,canvas,isClosed){
  var ctx=canvas.getContext("2d"),work=document.createElement("canvas"),wctx=work.getContext("2d"),W=0,H=0,ready=false;
  if(!ctx||!wctx){console.warn("dice clip: no 2d canvas for the stacked player");return;}
  function size(){W=Math.floor(v.videoWidth/2);H=v.videoHeight;if(!W||!H)return false;canvas.width=W;canvas.height=H;work.width=W*2;work.height=H;ready=true;return true;}
  var seenDie=false,skipped=0;
  function draw(){
    if(isClosed())return;
    if(!ready&&!size()){schedule();return;}
    /* The settled die must STAY (owner 2026-10-20; it vanished on the phone before the tap): an ended video is never
       drawn from — iOS hands back an empty frame once playback is over — and once the die has been seen, a frame whose
       matte holds no die (a decoder blank) is skipped, so the last good frame stays painted. */
    if(v.ended)return;
    wctx.drawImage(v,0,0);
    var c=wctx.getImageData(0,0,W,H),m=wctx.getImageData(W,0,W,H),white=diceStackedWhite(m.data);
    if(white>128)seenDie=true;
    else if(seenDie){skipped++;if(skipped===1)console.warn("dice clip: a blank frame after the die was seen — kept the last good frame");schedule();return;}
    diceStackedRecombine(c.data,m.data);
    ctx.putImageData(c,0,0);
    schedule();
  }
  function schedule(){
    if(typeof v.requestVideoFrameCallback==="function")v.requestVideoFrameCallback(draw);
    else requestAnimationFrame(draw);
  }
  schedule();
}
