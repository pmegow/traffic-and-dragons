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
function showToast(msg){
  // Decode the HTML entities several call sites pass (audit E40) — showToast renders via textContent,
  // so "&#9729;"/"&mdash;" would show literally. Numeric refs + a couple of named ones; toast strings
  // are developer constants, so this is a safe decode (not model/user input).
  msg=String(msg==null?"":msg).replace(/&#(\d+);/g,function(_,n){return String.fromCharCode(parseInt(n,10));}).replace(/&mdash;/g,"—").replace(/&ndash;/g,"–").replace(/&amp;/g,"&");
  var live=document.querySelectorAll(".tnd-toast").length;
  var t=document.createElement("div");t.className="tnd-toast";
  t.style.cssText="position:fixed;bottom:"+(80+live*42)+"px;left:50%;transform:translateX(-50%);background:var(--modal-bg);border:1px solid var(--acc);color:var(--acc);padding:10px 20px;border-radius:20px;font-size:13px;font-family:var(--font);z-index:400;cursor:pointer;pointer-events:auto;transition:opacity .25s;";
  t.title="Tap to dismiss";
  t.textContent=msg;
  var x=document.createElement("span");x.textContent="✕";x.style.cssText="margin-left:10px;opacity:.45;font-size:11px;";t.appendChild(x);
  t.addEventListener("click",function(){t.style.opacity="0";setTimeout(function(){t.remove();_reflowToasts();},250);});
  document.body.appendChild(t);
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
function switchTab(tab){activeChatTab=tab;var sn=document.getElementById("story-narrative"),st=document.getElementById("story-tabletalk");var tn=document.getElementById("tab-narrative"),tt=document.getElementById("tab-tabletalk"),badge=document.getElementById("tab-tt-badge");sn.style.display=tab==="narrative"?"flex":"none";st.style.display=tab==="tabletalk"?"flex":"none";tn.className="chat-tab"+(tab==="narrative"?" active":"");tt.className="chat-tab"+(tab==="tabletalk"?" active":"");if(tab==="tabletalk"&&badge)badge.className="tab-badge";if(tab==="narrative"){var _nnb=tn.querySelector(".tab-narr-badge");if(_nnb)_nnb.className="tab-badge tab-narr-badge";}/* clear the story badge on switch-in (E68) */}
function addMsg(type,html,opts){var isTTMsg=(type==="tabletalk");var story=document.getElementById(isTTMsg?"story-tabletalk":"story-narrative");var div=document.createElement("div");div.className="msg "+type;
if(type==="narrator"&&opts&&opts.turn!=null)html="<div class='msg-turn'>Turn "+opts.turn+"</div>"+html;// #23: subtle turn marker above narrative frames — helps backtracking
div.innerHTML=html;
if(opts&&opts.replayText&&typeof TTS!=="undefined"){(function(text){var rb=document.createElement("button");rb.className="tts-replay";rb.title="Replay";rb.innerHTML="&#128266;";rb.onclick=function(){TTS.speak(text);};div.appendChild(rb);})(opts.replayText);}
story.appendChild(div);story.scrollTop=story.scrollHeight;if(isTTMsg&&activeChatTab!=="tabletalk"){var badge=document.getElementById("tab-tt-badge");if(badge)badge.className="tab-badge on";}
// Bidirectional badge (audit E68 / CLAUDE.md §14): flag the STORY tab when narration arrives while
// the player is on Table Talk. The narrative tab has no static badge element, so create one lazily.
if(type==="narrator"&&activeChatTab==="tabletalk"){var tnb=document.getElementById("tab-narrative");if(tnb){var _nb=tnb.querySelector(".tab-narr-badge");if(!_nb){_nb=document.createElement("span");tnb.appendChild(_nb);}_nb.className="tab-badge on tab-narr-badge";}}
if(typeof carMode!=="undefined"&&carMode){if(type==="thinking"){_carSetStatus("Thinking…");_carSyncBtn();}else if(type==="narrator"){_carSetStatus("Narrator speaking…");setTimeout(function(){if(carMode)_carSyncBtn();},100);}}
return div;}
function closeAllMenus(){eachMenuEl("file-menu",function(el){el.style.display="none";},MENU_ID_PREFIXES);}
