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
function eachMenuEl(idSuffix,fn,prefixes){
  (prefixes||FM_ID_PREFIXES).forEach(function(p){var el=document.getElementById(p+idSuffix);if(el)fn(el);});
}
function _reflowToasts(){var ts=document.querySelectorAll(".tnd-toast"),i;for(i=0;i<ts.length;i++)ts[i].style.bottom=(80+i*42)+"px";}
// Toasts stay until acknowledged (tap to dismiss) — important "cheers" (quest opportunity, legacy
// arrival, level-up) shouldn't vanish before they're seen.
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
    +"<div style='font-size:13px;color:var(--t1);font-family:var(--font);'>"+msg+"</div>"
    +"</div>";
  document.body.appendChild(modal);
  return function(){var m=document.getElementById("loading-modal");if(m)m.remove();};
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
  var modal=document.createElement("div");modal.id=id;
  var overlayHead=opts.bg?("position:fixed;inset:0;background:rgba(0,0,0,"+opts.bg+");"):"position:fixed;inset:0;background:rgba(0,0,0,.88);";
  modal.style.cssText=opts.overlayCss||(overlayHead+"z-index:"+(opts.z||300)+";display:flex;align-items:"+(opts.align||"center")+";justify-content:center;padding:20px;"+(opts.overlayExtra||""));
  var boxCss=opts.boxCss||("background:"+(opts.boxBg||"var(--modal-bg)")+";border:1px solid var(--acc);border-radius:12px;padding:"+(opts.boxPad||"24px")+";max-width:"+(opts.maxWidth||480)+"px;width:100%;"+(opts.boxExtra||""));
  modal.innerHTML="<div style='"+boxCss+"'>"+(innerHtml||"")+"</div>";
  document.body.appendChild(modal);
  if(opts.wireClose!==false){
    var close=opts.onClose||function(){modal.remove();};
    if(opts.closeId){var xb=document.getElementById(opts.closeId);if(xb)xb.addEventListener("click",close);}
    if(opts.outside)modal.addEventListener("click",function(e){if(e.target===modal)close();});
  }
  return modal;
}
function showGame(){
  document.getElementById("char-screen").style.display="none";
  document.getElementById("game-screen").style.display="flex";
  var ca=document.getElementById("creation-arch");if(ca)ca.remove();
  var cb=document.getElementById("creation-bump");if(cb)cb.remove();
  var cs3=document.getElementById("creation-spells");if(cs3)cs3.remove();
}
function showChar(){
  document.getElementById("char-screen").style.display="block";
  document.getElementById("game-screen").style.display="none";
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
function trimStoryDom(story){
  var msgs=story.querySelectorAll(".msg");
  if(msgs.length<=STORY_DOM_CAP)return;
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
  while(story.querySelectorAll(".msg").length>STORY_DOM_CAP){
    var oldest=story.querySelector(".msg");
    if(!oldest)break;
    story.removeChild(oldest);
  }
}
function switchTab(tab){activeChatTab=tab;var sn=document.getElementById("story-narrative"),st=document.getElementById("story-tabletalk");var tn=document.getElementById("tab-narrative"),tt=document.getElementById("tab-tabletalk"),badge=document.getElementById("tab-tt-badge");sn.style.display=tab==="narrative"?"flex":"none";st.style.display=tab==="tabletalk"?"flex":"none";tn.className="chat-tab"+(tab==="narrative"?" active":"");tt.className="chat-tab"+(tab==="tabletalk"?" active":"");if(tab==="tabletalk"&&badge)badge.className="tab-badge";if(tab==="narrative"){var _nnb=tn.querySelector(".tab-narr-badge");if(_nnb)_nnb.className="tab-badge tab-narr-badge";}/* clear the story badge on switch-in (E68) */}
function addMsg(type,html,opts){var isTTMsg=(type==="tabletalk");var story=document.getElementById(isTTMsg?"story-tabletalk":"story-narrative");var div=document.createElement("div");div.className="msg "+type;
if(type==="narrator"&&opts&&opts.turn!=null)html="<div class='msg-turn'>Turn "+opts.turn+"</div>"+html;// #23: subtle turn marker above narrative frames — helps backtracking
div.innerHTML=html;
if(opts&&opts.replayText&&typeof TTS!=="undefined"){(function(text){var rb=document.createElement("button");rb.className="tts-replay";rb.title="Replay";rb.innerHTML="&#128266;";rb.onclick=function(){TTS.speak(text);};div.appendChild(rb);})(opts.replayText);}
story.appendChild(div);story.scrollTop=story.scrollHeight;trimStoryDom(story);if(isTTMsg&&activeChatTab!=="tabletalk"){var badge=document.getElementById("tab-tt-badge");if(badge)badge.className="tab-badge on";}
// Bidirectional badge (audit E68 / CLAUDE.md §14): flag the STORY tab when narration arrives while
// the player is on Table Talk. The narrative tab has no static badge element, so create one lazily.
if(type==="narrator"&&activeChatTab==="tabletalk"){var tnb=document.getElementById("tab-narrative");if(tnb){var _nb=tnb.querySelector(".tab-narr-badge");if(!_nb){_nb=document.createElement("span");tnb.appendChild(_nb);}_nb.className="tab-badge on tab-narr-badge";}}
if(typeof carMode!=="undefined"&&carMode){if(type==="thinking"){_carSetStatus("Thinking…");_carSyncBtn();}else if(type==="narrator"){if(typeof carNotify==="function")carNotify("response");/* round-2 #26: clears the tap-to-retry arm on ANY successful narration (a stale arm re-fired retryLast = duplicate GM turn) + plays the ready earcon */_carSetStatus("Narrator speaking…");setTimeout(function(){if(carMode)_carSyncBtn();},100);}}
return div;}
function closeAllMenus(){eachMenuEl("file-menu",function(el){el.style.display="none";},MENU_ID_PREFIXES);}
