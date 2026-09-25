// ui-shell.js — toasts, loading modal, screen switching (showGame/showChar incl. wizard reset),
// chat tabs + addMsg message log (Car Mode hook inside), closeAllMenus, eachMenuEl.
// Split from ui.js at v1.324 per UI_SEAM_MAP.md (TODO #54 / UA17).
// ── #15⑤/UA21⑤: ONE walk for the three File-menu surfaces ─────────────────────
// The triple-id enumeration (["fm-…","cs-fm-…","api-fm-…"] / ["","cs-","api-"] loops) was
// hand-pasted across ui-modals/ui-boot/ui-campaigns/ui-files/stt — every consumer now routes
// through this. TWO id conventions exist and they share one id space:
//   • menu ITEMS:      "fm-"+suffix / "cs-fm-"+suffix / "api-fm-"+suffix   (FM_ID_PREFIXES, default)
//   • menu CONTAINERS + import inputs: ""+suffix / "cs-"+suffix / "api-"+suffix (MENU_ID_PREFIXES)
// (they are the same space because ""+"fm-x" === "fm-"+"x" — pass MENU_ID_PREFIXES only for
// ids with no fm- segment, e.g. closeAllMenus' "file-menu" containers.)
// Calls fn(el) only for elements that exist — every routed walk already tolerated gaps.
var FM_ID_PREFIXES=["fm-","cs-fm-","api-fm-"];
var MENU_ID_PREFIXES=["","cs-","api-"];
/* #289: Dev-vs-Beta menu tier. ONE stylesheet rule hides every `.fm-dev-only` row for a signed-in
   non-admin — a rule with !important wins over the inline display:block/none the spec and
   updateServerUI write, so the folder/connect toggles keep their own logic underneath. The
   decision is the pure menuTierHidesDev (helpers.js); local/unsigned dev hides nothing. */
function applyMenuTier(){
  var acct=(typeof serverAccount!=="undefined")?serverAccount:null;
  var signed=(typeof storageAdapter!=="undefined")&&storageAdapter.isServerMode();
  var hide=signed&&typeof menuTierHidesDev==="function"&&menuTierHidesDev(acct);
  var el=document.getElementById("fm-tier-css");
  if(hide&&!el){el=document.createElement("style");el.id="fm-tier-css";el.textContent=".fm-dev-only{display:none!important}";document.head.appendChild(el);}
  else if(!hide&&el)el.parentNode.removeChild(el);
}
function eachMenuEl(idSuffix,fn,prefixes){
  (prefixes||FM_ID_PREFIXES).forEach(function(p){var el=document.getElementById(p+idSuffix);if(el)fn(el);});
}
function _reflowToasts(){var ts=document.querySelectorAll(".tnd-toast"),i;for(i=0;i<ts.length;i++)ts[i].style.bottom=(80+i*42)+"px";}
// Toasts stay until acknowledged (tap to dismiss) — important "cheers" (quest opportunity, legacy
// arrival, level-up) shouldn't vanish before they're seen.
// THE entry point for a USER-INITIATED play request (the per-message 🔊 replay button).
// Root cause it fixes (user report 2026-07-18): speakResponse() — the auto-narration path — is
// gated on isOn(), but speak() is not, so tapping replay with voice OFF ran the whole synthesis
// pipeline into a closed AudioContext. It "played for no-one": no sound, no explanation, nothing
// to distinguish it from a broken button. A deliberate tap deserves an answer, so ask instead:
// confirm → unmute and play; decline → play nothing (the user said no, honor it).
// Car Mode is exempt — the overlay IS an audio intent, and its own paths already speak with the
// global toggle off (see speakResponse's carMode clause); asking there would be nagging.
function requestSpeak(text,voices){
  if(typeof TTS==="undefined"||!text)return;
  if(TTS.isOn()||(typeof carMode!=="undefined"&&carMode)){TTS.speak(text,null,voices);return;}
  var m=modalShell("audio-muted-confirm",
    "<div style='font-size:16px;color:var(--t0);margin-bottom:8px;font-weight:bold;'>Game audio is muted. Unmute?</div>"
    +"<div style='font-size:13px;color:var(--t2);margin-bottom:24px;'>Voice narration is switched off, so this line would play silently. Unmuting turns narration back on for the rest of the session.</div>"
    +"<div style='display:flex;gap:10px;justify-content:center;'>"
    +"<button id='am-ok' style='padding:10px 24px;font-size:13px;font-family:var(--font);background:var(--acc);color:var(--on-acc);border:none;border-radius:var(--r);cursor:pointer;font-weight:bold;'>&#128266; Unmute and play</button>"
    +"<button id='am-cancel' style='padding:10px 20px;font-size:13px;font-family:var(--font);background:none;border:1px solid var(--brd2);color:var(--t2);border-radius:var(--r);cursor:pointer;'>Stay muted</button>"
    +"</div>",
    {z:500,maxWidth:380,boxPad:"28px 24px",boxExtra:"text-align:center;",wireClose:false});
  document.getElementById("am-ok").addEventListener("click",function(){
    m.remove();
    // toggle() must run inside this click gesture — it creates/resumes the AudioContext and primes
    // the iOS playback session, both of which browsers only permit from a real user gesture.
    TTS.toggle();
    TTS.speak(text,null,voices);
  });
  document.getElementById("am-cancel").addEventListener("click",function(){m.remove();});
}
function showToast(msg,ms){
  // Decode the HTML entities several call sites pass (audit E40) — showToast renders via textContent,
  // so "&#9729;"/"&mdash;" would show literally. Numeric refs + a couple of named ones; toast strings
  // are developer constants, so this is a safe decode (not model/user input).
  msg=String(msg==null?"":msg).replace(/&#(\d+);/g,function(_,n){return String.fromCharCode(parseInt(n,10));}).replace(/&mdash;/g,"—").replace(/&ndash;/g,"–").replace(/&amp;/g,"&");
  // TODO #7 (user pick 2026-07-18): a toast IS the "general poke at the user", so bone rides this
  // one choke point instead of dozens of call sites. playIfQuiet keeps it from doubling up on an
  // attention event (quests/level-ups/defining moments play glass just BEFORE their toast).
  if(typeof Sound!=="undefined"&&Sound.playIfQuiet)Sound.playIfQuiet("click_bone",300);
  var live=document.querySelectorAll(".tnd-toast").length;
  var t=document.createElement("div");t.className="tnd-toast";
  // Car Mode audit rank 1 (todo_carplay.html): toasts at z-index:400 rendered UNDER #car-overlay
  // (z-index:500) — every failure/progress signal was invisible in the one mode where the screen
  // is the only channel. Codebase max is #lineage-popup at 9999 (index.html); 10000 clears that
  // too so a toast is never buried behind ANY overlay/modal (acceptable — transient, tap-dismiss).
  t.style.cssText="position:fixed;bottom:"+(80+live*42)+"px;left:50%;transform:translateX(-50%);background:var(--modal-bg);border:1px solid var(--acc);color:var(--acc);padding:10px 20px;border-radius:20px;font-size:13px;font-family:var(--font);z-index:10000;cursor:pointer;pointer-events:auto;transition:opacity .25s;";
  t.title="Tap to dismiss";
  t.textContent=msg;
  var x=document.createElement("span");x.textContent="✕";x.style.cssText="margin-left:10px;opacity:.45;font-size:11px;";t.appendChild(x);
  // #68: click and the auto-dismiss timer (when ms is passed) share this one removal path — a
  // "removed" guard stops the timer firing t.remove() a second time after a tap already did.
  var removed=false;
  var dismiss=function(){if(removed)return;removed=true;t.style.opacity="0";setTimeout(function(){t.remove();_reflowToasts();},250);};
  t.addEventListener("click",dismiss);
  document.body.appendChild(t);
  // No ms = sticky tap-to-dismiss (default "cheers" design, unchanged). ms>0 auto-dismisses on top
  // of that — callers (e.g. tts.js) already pass 6000/8000 and start working the moment this ships.
  if(typeof ms==="number"&&ms>0)setTimeout(dismiss,ms);
}
function showLoadingModal(msg){
  var ex=document.getElementById("loading-modal");if(ex)ex.remove();
  if(!document.getElementById("lm-kf")){var s=document.createElement("style");s.id="lm-kf";s.textContent="@keyframes lm-spin{to{transform:rotate(360deg)}}";document.head.appendChild(s);}
  var modal=document.createElement("div");modal.id="loading-modal";
  modal.style.cssText="position:fixed;inset:0;background:rgba(0,0,0,.82);z-index:500;display:flex;align-items:center;justify-content:center;";
  modal.innerHTML="<div style='background:var(--modal-bg);border:1px solid var(--acc);border-radius:12px;padding:36px 48px;text-align:center;min-width:220px;'>"
    +"<div style='width:44px;height:44px;border:3px solid var(--bg3);border-top-color:var(--acc);border-radius:50%;animation:lm-spin .75s linear infinite;margin:0 auto 18px;'></div>"
    +"<div style='font-size:13px;color:var(--t1);font-family:var(--font);'><span>"+msg+"</span> <span id='lm-secs' style='color:var(--t2);'></span></div>"/* #356: the counter rides every loading modal */
    +"</div>";
  document.body.appendChild(modal);
  var _lmT=elapsedTicker(document.getElementById("lm-secs"),"",{text:true});/* #356 */
  return function(){_lmT.stop();var m=document.getElementById("loading-modal");if(m)m.remove();};
}
// ── #14: THE modal scaffold (AUDIT_FABLE_07_16_2026 #14) ──────────────────────
// Every standard modal (dim overlay + amber box) routes through this — the ~28 hand-rolled
// copies of remove-prior / overlay div / inner box / ×-wiring / click-outside are gone.
// Opts pass each modal's CURRENT values through verbatim (drift-FREEZING, not drift-fixing:
// the ad-hoc z 300/400/410/420/500 and margin spread stay as they were; harmonizing them is
// a separate deliberate commit). Opts:
//   z:300            overlay z-index
//   bg:".88"         overlay black alpha (cap-card uses .9)
//   align:"center"   overlay align-items ("flex-start" for tall scrolling modals)
//   overlayExtra:""  appended after padding — e.g. "overflow-y:auto;" (sheets add the
//                    -webkit-overflow-scrolling:touch variant)
//   overlayCss       FULL overlay cssText override (escape hatch; none needed today)
//   maxWidth:480     box max-width in px
//   boxBg            box background (default var(--modal-bg); game/tts legacy boxes #181818)
//   boxPad:"24px"    box padding (confirm dialogs use "28px 24px")
//   boxExtra:""      appended after width:100%; — "margin-top:40px;", "margin:20px 0 40px;",
//                    "text-align:center;" …
//   boxCss           FULL box style override (cap-card's padless position:relative box)
//   closeId          id of an × button INSIDE innerHtml — wired to close
//   outside:true     clicking the overlay itself closes
//   onClose          replaces the default close action (modal.remove())
//   wireClose:false  skip ALL close wiring (caller owns the close flow, e.g. re-rendering
//                    modals that wire their × per render, or forced-choice modals)
// Remove-prior-by-id is built in. Returns the overlay element; the box is .firstChild
// (re-rendering callers set .firstChild.innerHTML).
function modalShell(id,innerHtml,opts){
  opts=opts||{};
  var ex=document.getElementById(id);if(ex)ex.remove();
  var modal=document.createElement("div");modal.id=id;modal.setAttribute("role","dialog");modal.setAttribute("aria-modal","true");modal.setAttribute("aria-label",id.replace(/-modal$/,"").replace(/-/g," "));/* #312 ③ */
  var overlayHead=opts.bg?("position:fixed;inset:0;background:rgba(0,0,0,"+opts.bg+");"):"position:fixed;inset:0;background:rgba(0,0,0,.88);";
  modal.style.cssText=opts.overlayCss||(overlayHead+"z-index:"+(opts.z||300)+";display:flex;align-items:"+(opts.align||"center")+";justify-content:center;padding:20px;"+(opts.overlayExtra||""));
  var boxCss=opts.boxCss||("background:"+(opts.boxBg||"var(--modal-bg)")+";border:1px solid var(--acc);border-radius:12px;padding:"+(opts.boxPad||"24px")+";max-width:"+(opts.maxWidth||480)+"px;width:100%;"+(opts.boxExtra||""));
  modal.innerHTML="<div style='"+boxCss+"'>"+(innerHtml||"")+"</div>";
  document.body.appendChild(modal);
  /* #442 (Astra review R5): keyboard containment for EVERY modal on this shell — focus moves INTO the dialog (so Enter
     can never reach the story box behind it), Tab and Shift+Tab stay inside the topmost dialog, Escape closes a
     dismissible dialog (never a forced choice: wireClose:false, or noEscape:true), and the opener gets focus back when
     the dialog goes — through our close, or through any caller's modal.remove() (the observer). */
  var opener=(typeof document!=="undefined"&&document.activeElement)||null;
  var baseClose=opts.onClose||function(){modal.remove();};
  var close=function(){baseClose();if(modal._restoreFocus)modal._restoreFocus();};/* every close the shell wires restores the opener's focus */
  modalFocusContain(modal,{escape:opts.wireClose!==false&&!opts.noEscape,close:close,opener:opener});
  if(opts.wireClose!==false){
    if(opts.closeId){var xb=document.getElementById(opts.closeId);if(xb)xb.addEventListener("click",close);}
    if(opts.outside)modal.addEventListener("click",function(e){if(e.target===modal)close();});
  }
  return modal;
}
var MODAL_FOCUSABLE="button:not([disabled]),[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex='-1'])";
function modalFocusables(modal){return Array.prototype.slice.call(modal.querySelectorAll(MODAL_FOCUSABLE));}
function modalFocusContain(modal,o){
  o=o||{};if(!modal||typeof modal.querySelectorAll!=="function"||typeof modal.addEventListener!=="function")return;/* a scaffold stub without a DOM (the #14 parity suite) — nothing to contain */
  var box=modal.firstChild;
  if(box&&box.setAttribute)box.setAttribute("tabindex","-1");
  var first=modalFocusables(modal)[0];
  if(first&&first.focus)first.focus();else if(box&&box.focus)box.focus();
  modal.addEventListener("keydown",function(e){
    if(e.key==="Tab"){
      var f=modalFocusables(modal);if(!f.length){e.preventDefault();return;}
      var i=f.indexOf(document.activeElement);
      if(e.shiftKey){if(i<=0){e.preventDefault();f[f.length-1].focus();}}
      else if(i===-1||i>=f.length-1){e.preventDefault();f[0].focus();}
    }else if(e.key==="Escape"&&o.escape){e.preventDefault();if(e.stopPropagation)e.stopPropagation();o.close();}
  });
  var restored=false;
  function restore(){if(restored)return;restored=true;var op=o.opener;if(op&&op.focus&&(!document.body||!document.body.contains||document.body.contains(op)))op.focus();}
  modal._restoreFocus=restore;
  if(typeof MutationObserver==="function"&&document.body){
    var mo=new MutationObserver(function(){if(!document.body.contains(modal)){mo.disconnect();restore();}});
    mo.observe(document.body,{childList:true});
  }
}
function showGame(){
  document.getElementById("char-screen").style.display="none";
  document.getElementById("game-screen").style.display="flex";
  if(typeof audioScenePublish==="function")audioScenePublish("load");
  if(typeof Ambient!=="undefined")Ambient.sync();
  var ca=document.getElementById("creation-arch");if(ca)ca.remove();
  var cb=document.getElementById("creation-bump");if(cb)cb.remove();
  var cs3=document.getElementById("creation-spells");if(cs3)cs3.remove();
}
function showChar(){
  document.getElementById("char-screen").style.display="block";
  document.getElementById("game-screen").style.display="none";
  if(typeof Ambient!=="undefined")Ambient.sync();
  cs=blankWizardState();rvGoldRolled=false;pendingImportChar=null;/* audit #16: single-source blank wizard state (globals.js) */
  // Known issue #2: resetting cs alone left the OLD wizard in the DOM — the previous campaign's
  // Review step kept .active (so New Game landed on it), and stale input/select values leaked
  // into the next character (anc-next reads char-gender/char-age straight from the DOM).
  var _steps=document.querySelectorAll("#char-screen .step"),_si2;
  for(_si2=0;_si2<_steps.length;_si2++)_steps[_si2].classList.remove("active");
  var _s1=document.getElementById("step1");if(_s1)_s1.classList.add("active");
  var _gw=document.getElementById("anc-grid-wrap"),_det=document.getElementById("anc-detail"),_fw=document.getElementById("flex-wrap");
  if(_gw)_gw.style.display="block";if(_det)_det.style.display="none";if(_fw)_fw.style.display="none";
  ["char-name","char-appear","char-backstory","char-deity","rv-camp-name"].forEach(function(id){var el=document.getElementById(id);if(el)el.value="";});
  var _ge=document.getElementById("char-gender");if(_ge)_ge.value="M";
  var _ae=document.getElementById("char-age");if(_ae)_ae.value="early twenties";
  var _lv=document.getElementById("rv-start-level");if(_lv)_lv.value="1";
  var _xe=document.getElementById("rv-start-xp");if(_xe)_xe.value="0";
  var _ftp=document.getElementById("ft-portrait-preview");if(_ftp)_ftp.innerHTML="<span style='font-size:11px;color:var(--t2);'>No portrait</span>";
  pendingBlueprint=null;var _bb=document.getElementById("blueprint-banner");if(_bb)_bb.style.display="none";
  pendingCompanions=[];
  buildDots();buildDnaStep();
}
// #64 (monores #1): cap on rendered .msg divs per story container — a live session appends per turn
// with no other trim, and a marathon Car Mode sitting shares the iOS tab-memory ceiling with the
// Piper wasm heap. Display-only: worldState.transcript / rebuildNarrativeFromTranscript untouched,
// so reload/memento fidelity can't regress from this.
var STORY_DOM_CAP=30;
/* #206b: the reader may load earlier frames on purpose (Show earlier turns) — the allowance lifts the cap to what
   they asked for; a LIVE player action drops it back to the base cap, so a marathon session still trims. */
var _storyDomAllow=0;
var STORY_DOM_HEADROOM=10;/* #206c: markers and images appended under a loaded frame must not evict the frames above it */
function storyDomCap(story){return (story&&story.id==="story-narrative")?Math.max(STORY_DOM_CAP,_storyDomAllow+STORY_DOM_HEADROOM):STORY_DOM_CAP;}
/* #206b: the story's ONE "earlier" note — the count of transcript entries not in the page and the control that loads
   them. Not class "msg" (immune to the cap). Owned here so the trimmer and the rebuild paint the same line. */
function storyEarlierNote(){
  var story=document.getElementById("story-narrative");if(!story||typeof worldState==="undefined"||!worldState||!(worldState.transcript instanceof Array))return null;
  var total=0,i,tr=worldState.transcript;for(i=0;i<tr.length;i++)if(tr[i]&&!tr[i].bk)total++;
  var shown=story.querySelectorAll(".msg.narrator[data-turn],.msg.player").length,hidden=Math.max(0,total-shown);
  var note=document.getElementById("story-earlier-note");
  if(hidden<=0){if(note)note.remove();return null;}
  if(!note){note=document.createElement("div");note.id="story-earlier-note";note.style.cssText="align-self:center;font-size:11px;color:var(--t2);opacity:.8;padding:4px 0;text-transform:uppercase;letter-spacing:.04em;width:auto;text-align:center;";}
  note.innerHTML="";note.appendChild(document.createTextNode("\u2026 "+hidden+" earlier entr"+(hidden===1?"y":"ies")+" not shown "));
  var b=document.createElement("button");b.className="ib show-earlier";b.textContent="Show earlier turns";b.title="Load earlier entries into the story";b.onclick=function(){if(typeof showEarlierTurns==="function")showEarlierTurns();};note.appendChild(b);
  if(story.firstChild!==note)story.insertBefore(note,story.firstChild);
  return note;
}
function trimStoryDom(story){
  var msgs=story.querySelectorAll(".msg"),cap=storyDomCap(story);
  if(msgs.length<=cap)return;
  if(story.id==="story-narrative"){while(story.querySelectorAll(".msg").length>cap){var _o=story.querySelector(".msg");if(!_o)break;story.removeChild(_o);}storyEarlierNote();return;}/* #206b: the story keeps its one note */
  var noteId=(story.id==="story-tabletalk"?"tt-trim-note":"story-trim-note");
  var note=document.getElementById(noteId);
  if(!note){
    // Deliberately NOT class "msg" — querySelectorAll(".msg") below must never see it, so it's
    // immune to both the cap count and the eviction loop.
    note=document.createElement("div");note.id=noteId;
    note.style.cssText="align-self:center;font-size:11px;color:var(--t2);opacity:.7;padding:4px 0;text-transform:uppercase;letter-spacing:.04em;width:auto;text-align:center;";
    note.textContent="— earlier messages trimmed from view; the full story lives in the transcript —";
    story.insertBefore(note,story.firstChild);
  }
  // Eviction happens at append-time, when normal play has the view pinned to scrollTop=story.scrollHeight
  // (set just before this runs), so the jump is invisible in practice; a mid-scroll reader could see
  // the viewport shift — accepted.
  while(story.querySelectorAll(".msg").length>cap){
    var oldest=story.querySelector(".msg");
    if(!oldest)break;
    story.removeChild(oldest);
  }
}
function switchTab(tab){activeChatTab=tab;var sn=document.getElementById("story-narrative"),st=document.getElementById("story-tabletalk");var tn=document.getElementById("tab-narrative"),tt=document.getElementById("tab-tabletalk"),badge=document.getElementById("tab-tt-badge");sn.style.display=tab==="narrative"?"flex":"none";st.style.display=tab==="tabletalk"?"flex":"none";tn.className="chat-tab"+(tab==="narrative"?" active":"");tt.className="chat-tab"+(tab==="tabletalk"?" active":"");if(tab==="tabletalk"&&badge)badge.className="tab-badge";if(tab==="narrative"){var _nnb=tn.querySelector(".tab-narr-badge");if(_nnb)_nnb.className="tab-badge tab-narr-badge";}/* clear the story badge on switch-in (E68) */}
// Collapsing/expanding the right panel changes the story frame's WIDTH, which re-wraps every
// paragraph and therefore changes its height — so the reader silently drifts away from the live
// end of the narrative (a narrower frame wraps TALLER, pushing the bottom down past the viewport).
// Re-pin the bottom across a panel toggle, with two things that make it behave:
//   ① Only if they were ALREADY at the bottom. Someone who scrolled up to re-read an earlier turn
//     and then collapsed the panel for more reading width must not be yanked back to the newest
//     text. "At the bottom" gets a slack margin — a partly-visible last message still counts.
//   ② Measure BEFORE the reflow, apply AFTER the CSS width transition finishes. Reading
//     scrollHeight mid-animation targets a height that is still changing, so the scroll lands
//     short. transitionend is the real signal; the timer is a fallback for when no transition
//     runs at all (reduced-motion, a display:none pane, a browser that skips it).
var PANEL_BOTTOM_SLACK=120;   // px of "close enough to the end" to count as pinned
var STORY_PANES=["story-narrative","story-tabletalk"];
function storyAtBottom(el){
  if(!el)return false;
  return (el.scrollHeight-el.scrollTop-el.clientHeight)<=PANEL_BOTTOM_SLACK;
}
function stickStoryBottomAfterPanel(){
  var pre={},i,el;
  for(i=0;i<STORY_PANES.length;i++){
    el=document.getElementById(STORY_PANES[i]);
    // a hidden pane measures 0/0/0 and reads as "at bottom" — which is what we want: the inactive
    // tab should be sitting at its newest message when the player switches to it
    pre[STORY_PANES[i]]=storyAtBottom(el);
  }
  var rp=document.getElementById("rpanel"),done=false;
  function apply(){
    if(done)return; done=true;
    if(rp)rp.removeEventListener("transitionend",onEnd);
    var j,e2;
    for(j=0;j<STORY_PANES.length;j++){
      e2=document.getElementById(STORY_PANES[j]);
      if(e2&&pre[STORY_PANES[j]])e2.scrollTop=e2.scrollHeight;
    }
  }
  function onEnd(ev){ if(ev&&ev.target!==rp)return; if(!ev||ev.propertyName==="width")apply(); }
  if(rp)rp.addEventListener("transitionend",onEnd);
  setTimeout(apply,300);   // > the .2s width transition; harmless if transitionend already fired
}
/* #452: ONE delegated click for the summary line's Present names (the data-npc spans summaryLineHTML writes, helpers.js). */
function wireSummaryNpcLinks(){
  var story=document.getElementById("story-narrative");if(!story||story._sumNpcWired)return;story._sumNpcWired=true;
  story.addEventListener("click",function(e){
    var t=e.target;while(t&&t!==story&&!(t.getAttribute&&t.className==="sum-npc"&&t.getAttribute("data-npc")))t=t.parentNode;
    if(!t||t===story)return;if(typeof showNpcSheet==="function")showNpcSheet(t.getAttribute("data-npc"));
  });
}
function addMsg(type,html,opts){var isTTMsg=(type==="tabletalk");if(type==="player"&&!(opts&&opts.rebuild))_storyDomAllow=0;/* #206b: live play resumes the base cap */var story=document.getElementById(isTTMsg?"story-tabletalk":"story-narrative");var div=document.createElement("div");div.className="msg "+type;
if(type==="narrator"&&opts&&opts.turn!=null){
  /* #106b: pair the turn marker with the in-world moment — "Turn 1204 | Day 1, 4:15 pm". Reads
     as orientation, not bookkeeping. Sourced from opts.ck (the absolute clock stamped on the
     transcript entry) so a LIVE turn and the same turn REBUILT after reload show the identical
     stamp; an entry from before .ck existed renders the bare turn number rather than a guess. */
  var _stamp=(opts.ck!=null&&typeof clockStamp==="function")?" | "+clockStamp(opts.ck):"";
  html="<div class='msg-turn'>Turn "+opts.turn+_stamp+"</div>"+html;// #23: subtle turn marker above narrative frames — helps backtracking
  div.setAttribute("data-turn",opts.turn);}/* #30: machine-readable twin of the marker above — restoreSavedRenders finds a turn's frame by attribute instead of parsing "Turn N" out of display text */
div.innerHTML=html;
if(opts&&opts.sp)div._sp=opts.sp;/* #9: speaker map for this passage; also assignable later, once the post-pass resolves */
if(opts&&opts.replayText&&typeof TTS!=="undefined"){(function(text){var rb=document.createElement("button");rb.className="tts-replay";rb.title="Replay";rb.innerHTML="&#128266;";rb.onclick=function(){
  /* resolved HERE, not at render: names -> voices at click time means rebinding a character's voice re-voices every past turn they speak in. */
  var vm=(div._sp&&typeof speakerVoiceMap==="function")?speakerVoiceMap(div._sp,text):null;
  requestSpeak(text,vm);
};div.appendChild(rb);})(opts.replayText);}
/* #206: every GM frame can be painted — a small Render in the frame's corner (about 90% of the topbar button, owner
   sizing). Passes the frame's turn; doRender decides live vs historical. Skipped where the topbar button is hidden. */
if(type==="narrator"&&opts&&opts.turn!=null&&typeof doRender==="function"){(function(turn){var fb=document.createElement("button");fb.className="ib frame-render";fb.title="Paint this scene";fb.textContent="Render";fb.onclick=function(ev){ev.stopPropagation();doRender({turn:turn});};div.appendChild(fb);})(opts.turn);}
/* #312 ③: a reader scrolled back up keeps their place when narration lands (the panel-collapse path already had this guard); the player's own line and the thinking marker always pin to the end */
var _wasBottom=!(opts&&opts.keepPlace)&&(storyAtBottom(story)||type==="player"||type==="thinking"||type==="tabletalk");/* #206c: a historical render's marker and image land under THEIR frame — never yank the reader to the end */story.appendChild(div);if(_wasBottom)story.scrollTop=story.scrollHeight;trimStoryDom(story);if(isTTMsg&&activeChatTab!=="tabletalk"){var badge=document.getElementById("tab-tt-badge");if(badge)badge.className="tab-badge on";}
// Bidirectional badge (audit E68 / CLAUDE.md §14): flag the STORY tab when narration arrives while
// the player is on Table Talk. The narrative tab has no static badge element, so create one lazily.
if(type==="narrator"&&activeChatTab==="tabletalk"){var tnb=document.getElementById("tab-narrative");if(tnb){var _nb=tnb.querySelector(".tab-narr-badge");if(!_nb){_nb=document.createElement("span");tnb.appendChild(_nb);}_nb.className="tab-badge on tab-narr-badge";}}
if(typeof carMode!=="undefined"&&carMode){if(type==="thinking"){_carSetStatus("Thinking…");_carSyncBtn();}else if(type==="narrator"){if(typeof carNotify==="function")carNotify("response");/* round-2 #26: clears the tap-to-retry arm on ANY successful narration (a stale arm re-fired retryLast = duplicate GM turn) + plays the ready earcon */_carSetStatus("Narrator speaking…");setTimeout(function(){if(carMode)_carSyncBtn();},100);}}
return div;}
function closeAllMenus(){eachMenuEl("file-menu",function(el){el.style.display="none";},MENU_ID_PREFIXES);}
