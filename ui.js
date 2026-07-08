var _campFolderHandle=null;
// ── Portrait pan + zoom ───────────────────────────────────────────────────────
// Offset model: {x, y, zoom}. x,y are 0..1 = fraction of the pannable overflow
// (0 shows the left/top edge, 1 the right/bottom); zoom >= 1 (1 = cover-fit). Two-axis
// pan only has slack once zoomed in (a landscape image cover-fit to a portrait oval
// overflows horizontally only — zooming creates vertical slack too). Legacy saves stored
// object-position percentages (0..100); normPortraitOff() upconverts them.
function normPortraitOff(off){
  off=off||{};
  var x=(typeof off.x==="number")?off.x:0.5, y=(typeof off.y==="number")?off.y:0.5;
  if(x>1||y>1){x=x/100;y=y/100;}
  return {x:Math.min(1,Math.max(0,x)),y:Math.min(1,Math.max(0,y)),zoom:Math.max(1,(off&&off.zoom)||1)};
}
// Apply the pan+zoom transform to a cover-style portrait <img>. Needs the image's natural
// dimensions, so call after it has loaded. The parent is the clipping oval.
function applyPortraitTransform(img,off){
  var c=img.parentNode;if(!c)return;
  var o=normPortraitOff(off);
  var natW=img.naturalWidth||400,natH=img.naturalHeight||600;
  var cW=c.offsetWidth||90,cH=c.offsetHeight||135;
  var s=Math.max(cW/natW,cH/natH)*o.zoom; // cover scale x user zoom
  var ovX=natW*s-cW,ovY=natH*s-cH; if(ovX<0)ovX=0; if(ovY<0)ovY=0;
  img.style.position="absolute";img.style.top="0";img.style.left="0";
  img.style.width=natW+"px";img.style.height=natH+"px";img.style.maxWidth="none";
  img.style.objectFit="";img.style.objectPosition="";img.style.transformOrigin="0 0";
  img.style.transform="translate("+(-ovX*o.x)+"px,"+(-ovY*o.y)+"px) scale("+s+")";
}
// Wires drag-to-pan + wheel/pinch-to-zoom on a portrait <img>.
// getOff() -> {x,y,zoom}; setOff(x,y,zoom) persists on change. Exposes img._zoomBy(factor).
// Shared document-level drag dispatch (audit E61): wirePortraitDrag used to add a NEW mousemove +
// mouseup listener to `document` on every call — and it's called on every sheet open AND every
// drag-end/zoom refresh, so the listeners accumulated unbounded. Wire the pair ONCE and route to
// whichever image is currently being dragged.
var _pdActive=null,_pdDocWired=false;
function _pdEnsureDoc(){
  if(_pdDocWired)return;_pdDocWired=true;
  document.addEventListener("mousemove",function(e){if(_pdActive)_pdActive.m(e.clientX,e.clientY);});
  document.addEventListener("mouseup",function(){if(_pdActive){var a=_pdActive;_pdActive=null;a.u();}});
}
function wirePortraitDrag(img,getOff,setOff){
  _pdEnsureDoc();
  var dragging=false,sx,sy,sox,soy,moved,liveX,liveY,pinchStart=0,pinchZoom=1;
  var p=img.parentNode;if(p){if(!p.style.position)p.style.position="relative";p.style.overflow="hidden";}
  img.style.cursor="grab";img.style.touchAction="none";
  function reapply(){applyPortraitTransform(img,getOff());}
  if(img.complete&&img.naturalWidth)reapply(); else img.addEventListener("load",reapply);
  function overflow(){var o=normPortraitOff(getOff()),natW=img.naturalWidth||400,natH=img.naturalHeight||600,cW=p.offsetWidth||90,cH=p.offsetHeight||135;var s=Math.max(cW/natW,cH/natH)*o.zoom;return {x:Math.max(1,natW*s-cW),y:Math.max(1,natH*s-cH)};}
  function onDown(cx,cy){dragging=true;moved=false;sx=cx;sy=cy;var o=normPortraitOff(getOff());sox=o.x;soy=o.y;liveX=o.x;liveY=o.y;img.style.cursor="grabbing";_pdActive={m:onMove,u:onUp};/* this image is now the active drag (E61) */}
  function onMove(cx,cy){if(!dragging)return;moved=true;var ov=overflow(),o=normPortraitOff(getOff());
    // An axis with no real pannable overflow (~1px, floored by overflow()) divides pixel jitter by ~1
    // and slams the offset to an extreme (audit E87) — only pan an axis that actually has slack.
    liveX=ov.x>2?Math.min(1,Math.max(0,sox-(cx-sx)/ov.x)):o.x;
    liveY=ov.y>2?Math.min(1,Math.max(0,soy-(cy-sy)/ov.y)):o.y;
    applyPortraitTransform(img,{x:liveX,y:liveY,zoom:o.zoom});}
  function onUp(){if(!dragging)return;dragging=false;img.style.cursor="grab";if(moved)setOff(liveX,liveY,normPortraitOff(getOff()).zoom);}
  function applyZoom(factor){var o=normPortraitOff(getOff());var z=Math.min(4,Math.max(1,o.zoom*factor));applyPortraitTransform(img,{x:o.x,y:o.y,zoom:z});setOff(o.x,o.y,z);}
  function tdist(e){var a=e.touches[0],b=e.touches[1],dx=a.clientX-b.clientX,dy=a.clientY-b.clientY;return Math.sqrt(dx*dx+dy*dy);}
  img.addEventListener("mousedown",function(e){e.preventDefault();e.stopPropagation();onDown(e.clientX,e.clientY);});
  // (document mousemove/mouseup are wired once by _pdEnsureDoc and dispatched via _pdActive — audit E61)
  img.addEventListener("wheel",function(e){e.preventDefault();applyZoom(e.deltaY<0?1.1:0.9);},{passive:false});
  img.addEventListener("touchstart",function(e){if(e.touches.length===2){pinchStart=tdist(e);pinchZoom=normPortraitOff(getOff()).zoom;dragging=false;}else{var t=e.touches[0];onDown(t.clientX,t.clientY);}},{passive:true});
  img.addEventListener("touchmove",function(e){e.preventDefault();if(e.touches.length===2&&pinchStart){var z=Math.min(4,Math.max(1,pinchZoom*tdist(e)/pinchStart)),o=normPortraitOff(getOff());applyPortraitTransform(img,{x:o.x,y:o.y,zoom:z});setOff(o.x,o.y,z);}else if(e.touches.length===1){var t=e.touches[0];onMove(t.clientX,t.clientY);}},{passive:false});
  img.addEventListener("touchend",function(e){if(pinchStart&&e.touches.length<2)pinchStart=0;onUp();});
  img._wasDragged=function(){return moved;};
  img._zoomBy=applyZoom;
}
// Portraits should be portrait-oriented (3:4), not the landscape aspect the render models
// bake in for scene renders. Override the aspect field on the built request body.
function portraitRenderBody(cfg,prompt){var b=cfg.body(prompt);if(b.image_size)b.image_size="portrait_4_3";if(b.aspect_ratio)b.aspect_ratio="3:4";return b;}

var _campRootHandle=null;
var _SUBFOLDERS={save:"saves",narrative:"logs",character:"characters",render:"renders",portrait:"characters"};
function buildFilename(type){
  var c=worldState&&worldState.character?worldState.character:{name:"unknown"};
  var turn=worldState?worldState.turn:0;
  var slug=function(s){return(s||"unknown").replace(/[^a-zA-Z0-9_\-]/g,"_");};
  var camp=slug(worldState&&worldState.campName||c.name);
  var char=slug(c.name);
  var base=camp+"_"+char;
  if(type==="save")     return base+"_t"+turn+".tnd";
  if(type==="narrative")return base+"_t"+turn+".txt";
  if(type==="character")return base+"_character.char";
  if(type==="render")   return base+"_t"+turn+".jpg";
  if(type==="portrait") return base+"_portrait.png";
  return base+"_t"+turn;
}
function exportToFolder(type,blob,filename){
  if(!_campFolderHandle){
    var url=URL.createObjectURL(blob);var a=document.createElement("a");a.href=url;a.download=filename;a.click();URL.revokeObjectURL(url);
    return;
  }
  var sub=_SUBFOLDERS[type]||"misc";
  _campFolderHandle.getDirectoryHandle(sub,{create:true}).then(function(dir){
    return dir.getFileHandle(filename,{create:true});
  }).then(function(fh){
    return fh.createWritable();
  }).then(function(w){
    return w.write(blob).then(function(){return w.close();});
  }).then(function(){
    showToast("Saved to "+sub+"/"+filename);
  }).catch(function(e){
    showToast("Folder write failed: "+e.message);
    var url=URL.createObjectURL(blob);var a=document.createElement("a");a.href=url;a.download=filename;a.click();URL.revokeObjectURL(url);
  });
}
function _slugFolderName(s){return(s||"Campaign").replace(/[^a-zA-Z0-9_\-]/g,"_");}
function _openCampaignSubfolder(rootHandle,campName){
  var slug=_slugFolderName(campName);
  return rootHandle.getDirectoryHandle(slug,{create:true}).then(function(sub){
    _campRootHandle=rootHandle;
    _campFolderHandle=sub;
    updateCampFolderUI();
    return sub;
  });
}
function setCampaignFolder(){
  if(!window.showDirectoryPicker){showToast("Folder picker not supported in this browser.");return;}
  var campName=(worldState&&worldState.campName)||"Campaign";
  window.showDirectoryPicker({mode:"readwrite"}).then(function(root){
    return _openCampaignSubfolder(root,campName);
  }).then(function(sub){
    showToast("📁 Folder ready: "+sub.name+"/");
  }).catch(function(){});
}
function initCampaignFolderForGame(){
  if(!window.showDirectoryPicker)return;
  var campName=(worldState&&worldState.campName)||"Campaign";
  window.showDirectoryPicker({mode:"readwrite"}).then(function(root){
    return _openCampaignSubfolder(root,campName);
  }).then(function(sub){
    showToast("📁 Saving to "+sub.name+"/");
  }).catch(function(){});
}
function _collectDirEntries(dirHandle){
  var entries=[];var iter=dirHandle.values();
  function step(){return iter.next().then(function(r){if(r.done)return entries;entries.push(r.value);return step();});}
  return step();
}
function _copyDir(srcDir,destDir){
  return _collectDirEntries(srcDir).then(function(entries){
    var chain=Promise.resolve();
    entries.forEach(function(entry){
      chain=chain.then(function(){
        if(entry.kind==="file"){
          return entry.getFile().then(function(file){
            return destDir.getFileHandle(entry.name,{create:true}).then(function(fh){
              return fh.createWritable().then(function(w){return w.write(file).then(function(){return w.close();});});
            });
          });
        } else {
          return destDir.getDirectoryHandle(entry.name,{create:true}).then(function(sub){return _copyDir(entry,sub);});
        }
      });
    });
    return chain;
  });
}
function renameCampaignFolder(newName){
  if(!_campRootHandle||!_campFolderHandle)return;
  var oldHandle=_campFolderHandle;
  var oldName=oldHandle.name;
  var newSlug=_slugFolderName(newName);
  if(oldName===newSlug)return;
  _campRootHandle.getDirectoryHandle(newSlug,{create:true}).then(function(newDir){
    return _copyDir(oldHandle,newDir).then(function(){
      return _campRootHandle.removeEntry(oldName,{recursive:true});
    }).then(function(){
      _campFolderHandle=newDir;
      updateCampFolderUI();
      showToast("📁 Renamed to "+newSlug+"/");
    });
  }).catch(function(e){showToast("Folder rename failed: "+e.message);});
}
function clearCampaignFolder(){
  _campFolderHandle=null;_campRootHandle=null;
  updateCampFolderUI();
  showToast("Campaign folder cleared.");
}
function updateCampFolderUI(){
  ["","cs-","api-"].forEach(function(p){
    var btn=document.getElementById(p+"fm-set-folder");
    var clr=document.getElementById(p+"fm-clear-folder");
    if(btn)btn.style.display=_campFolderHandle?"none":"block";
    if(clr){clr.style.display=_campFolderHandle?"block":"none";if(_campFolderHandle)clr.textContent="📁 "+_campFolderHandle.name+" ×";}
  });
}
function compressPortrait(dataUrl,cb){
  var img=new Image();
  img.onload=function(){
    var maxW=400,maxH=600,scale=Math.min(1,maxW/img.width,maxH/img.height);
    var cw=Math.round(img.width*scale),ch=Math.round(img.height*scale);
    var canvas=document.createElement("canvas");canvas.width=cw;canvas.height=ch;
    canvas.getContext("2d").drawImage(img,0,0,cw,ch);
    cb(canvas.toDataURL("image/jpeg",0.8));
  };
  img.onerror=function(){cb(dataUrl);}; // fallback: store as-is if canvas fails
  img.src=dataUrl;
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
  cs={tone:null,author:"",name:"",gender:"M",age:"early twenties",appear:"",mark:"",backstory:"",ancestry:null,fp:[],subrace:null,heritageVariant:null,cls:null,statMode:"roll",bs:{STR:8,DEX:8,CON:8,INT:8,WIS:8,CHA:8},rolled:false,deityEdited:false,portrait:null,portraitOffset:null,step:1};rvGoldRolled=false;pendingImportChar=null;
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
function syncUI(){if(!worldState)return;updateHUD();updatePartyPanel();updateQuestPanel();updateInvPanel();updateAbPanel(false);updateSpPanel();updateMemStatus();if(worldState.combat){document.getElementById("cpanel").classList.add("active");updateCombat();}else{document.getElementById("cpanel").classList.remove("active");}}
function updateQuestPanel(){
  if(!worldState)return;var ql=worldState.questLog||[];
  var live=[];for(var li=0;li<ql.length;li++){if(ql[li].status==="offered"||ql[li].status==="active")live.push(ql[li]);}
  var cntEl=document.getElementById("quest-cnt");if(cntEl)cntEl.textContent=live.length;
  var h="",i;
  for(i=0;i<live.length;i++){
    var q=live[i],offered=q.status==="offered",prog="";
    if(!offered&&q.objectives&&q.objectives.length){var done=0,oj;for(oj=0;oj<q.objectives.length;oj++)if(q.objectives[oj].done)done++;prog=" "+done+"/"+q.objectives.length;}
    h+="<div class='qp-item"+(offered?" off":"")+"' onclick='showQuestModal()' title='"+escHtml(q.desc||q.title)+"'>"
      +"<span class='qp-nm'>"+(offered?"⚑ ":"")+escHtml(q.title)+"</span>"
      +"<span class='qp-st'>"+(offered?"opportunity":("active"+prog))+"</span>"
      +"</div>";
  }
  var listEl=document.getElementById("quest-list");
  if(listEl)listEl.innerHTML=h||"<div style='font-size:11px;color:var(--t2);font-style:italic;padding:4px 0;'>No active quests</div>";
}
function updateHUD(){
  if(!worldState)return;var c=worldState.character,w=worldState.world;
  document.getElementById("hud-name").textContent=c.name;
  document.getElementById("hud-cls").textContent=(c.subraceNm?c.subraceNm+" ":"")+c.ancestry+" "+c.cls+(c.archetypeNm?" ["+c.archetypeNm+"]":"")+" Lv"+c.level;
  document.getElementById("hud-hp").textContent=c.hp+"/"+c.maxHp+" HP";
  document.getElementById("hud-gold").textContent=c.gold+" gp";
  document.getElementById("hud-align").textContent=c.actualAlignment||c.statedAlignment||"Neutral";
  document.getElementById("hud-loc").textContent=w.location;
  var xpEl=document.getElementById("hud-xp");if(xpEl){var nxp=XP_LEVELS[c.level];var xpTxt=nxp!==undefined?c.xp+" / "+nxp+" xp":c.xp+" xp (max)";var prevXp=xpEl.getAttribute("data-xp");if(prevXp!==null&&prevXp!==String(c.xp)){xpEl.className="";void xpEl.offsetWidth;/* force reflow so the animation retriggers on rapid gains */xpEl.className="xp-pulse";setTimeout(function(){xpEl.className="";},900);}xpEl.setAttribute("data-xp",String(c.xp));xpEl.textContent=xpTxt;}
  // ── Party HUD (compact cards — second topbar row) ─────────────────────────
  var hudParty=document.getElementById("hud-party");
  if(hudParty){
    var partyNpcs=(worldState.npcs||[]).filter(function(n){return n.partyMember;});
    if(partyNpcs.length){
      hudParty.style.display="flex";hudParty.innerHTML="";
      for(var pi=0;pi<partyNpcs.length;pi++){
        var pm=partyNpcs[pi],pmSheet=pm.charSheet;
        var card=document.createElement("div");
        card.style.cssText="display:flex;align-items:center;gap:6px;font-size:11px;color:var(--t1);cursor:pointer;padding:2px 8px 2px 6px;border-radius:var(--r);background:var(--bg2);border:1px solid var(--brd);";
        (function(nm){card.addEventListener("click",function(){showNpcSheet(nm);});})(pm.name);
        var nameSpan="<span style='color:var(--t0);font-weight:bold;max-width:80px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;display:inline-block;'>"+escHtml(pm.name)+"</span>";
        if(pmSheet&&pmSheet.maxHp){
          var pct=Math.max(0,Math.min(100,Math.round((pmSheet.hp||0)/pmSheet.maxHp*100)));
          var hpClr=pct>50?"var(--grn)":pct>25?"var(--acc)":"var(--red)";
          var pmXpHtml="";if(pmSheet.xp!==undefined&&pmSheet.level!==undefined){var pmNextXp=XP_LEVELS[pmSheet.level];pmXpHtml="<span style='color:var(--t2);font-size:10px;flex-shrink:0;margin-left:2px;'>"+pmSheet.xp+"/"+(pmNextXp!==undefined?pmNextXp:"max")+" xp</span>";}
          card.innerHTML=nameSpan
            +"<div style='width:48px;height:5px;background:var(--bg3);border-radius:3px;overflow:hidden;flex-shrink:0;'>"
            +"<div style='width:"+pct+"%;height:100%;background:"+hpClr+";border-radius:3px;'></div></div>"
            +"<span style='color:var(--hp);flex-shrink:0;'>"+(pmSheet.hp||0)+"/"+pmSheet.maxHp+"</span>"
            +pmXpHtml;
        }else{
          card.innerHTML=nameSpan+"<span style='color:var(--t2);'>"+escHtml(pm.status||"ally")+"</span>";
        }
        hudParty.appendChild(card);
      }
    }else{
      hudParty.style.display="none";
    }
  }
  function sr(k,v){return'<div class="sb-row"><span class="sb-k">'+k+'</span><span class="sb-v">'+v+'</span></div>';}
  var sb=document.getElementById("sb-content");if(!sb)return;
  var i;
  // ── NPCs (non-party) ─────────────────────────────────────────────────────
  var npcR="";for(i=0;i<worldState.npcs.length;i++){if(!worldState.npcs[i].partyMember)npcR+=sr(escHtml(worldState.npcs[i].name),escHtml(worldState.npcs[i].status+" / "+worldState.npcs[i].rel));}
  var qR="",qOffered=0;for(i=0;i<worldState.questLog.length;i++){var _q=worldState.questLog[i];if(_q.status==="offered")qOffered++;qR+="<div class='sb-row' style='cursor:pointer;' onclick='showQuestModal()'><span class='sb-k'>"+escHtml(_q.title)+"</span><span class='sb-v'>"+escHtml(_q.status)+"</span></div>";}
  var questSec=worldState.questLog.length?'<div class="sb-sec"><div style="font-size:10px;text-transform:uppercase;color:var(--acc);margin-bottom:6px;letter-spacing:.5px;cursor:pointer;" onclick="showQuestModal()">Quests'+(qOffered?' &middot; <span style="color:var(--warn);">⚑ '+qOffered+' opportunit'+(qOffered>1?'ies':'y')+'</span>':'')+'</div>'+qR+'</div>':"";
  // Factions
  var facR="";if(memory&&memory.npcGraph&&memory.npcGraph.factions){var facNames=Object.keys(memory.npcGraph.factions);if(facNames.length){for(var fi=0;fi<facNames.length;fi++){var fn=facNames[fi],fd=memory.npcGraph.factions[fn];facR+=sr(escHtml(fn),escHtml(fd.desc||"faction"));}}}
  sb.innerHTML='<div class="sb-sec" id="sb-party-sec" style="border-top:1px solid var(--brd);padding-top:14px;"></div>'
    +'<div class="sb-sec">'+sr(escHtml("Location"),escHtml(w.location))+sr(escHtml("Time"),escHtml(w.time))+sr(escHtml("Weather"),escHtml(w.weather))+'</div>'
    +(npcR?'<div class="sb-sec">'+npcR+'</div>':"")
    +(facR?'<div class="sb-sec"><div style="font-size:10px;text-transform:uppercase;color:var(--acc);margin-bottom:6px;letter-spacing:.5px;">Factions</div>'+facR+'</div>':"")
    +questSec;
  // ── Party section — built programmatically to avoid onclick string escaping ──
  var partySec=document.getElementById("sb-party-sec");
  var playerBtn=document.createElement("button");playerBtn.className="sb-party-btn sb-pb-player";playerBtn.textContent=c.name;playerBtn.addEventListener("click",showCharSheet);partySec.appendChild(playerBtn);
  for(i=0;i<worldState.npcs.length;i++){if(worldState.npcs[i].partyMember){(function(nm){var btn=document.createElement("button");btn.className="sb-party-btn";btn.textContent=nm;btn.addEventListener("click",function(){showNpcSheet(nm);});partySec.appendChild(btn);})(worldState.npcs[i].name);}}
}
function updatePartyPanel(){
  if(!worldState)return;
  var c=worldState.character;
  var npcs=(worldState.npcs||[]).filter(function(n){return n.partyMember&&n.name!==c.name;});
  var pss=document.getElementById("pss-party");if(!pss)return;
  pss.style.display="";
  document.getElementById("party-cnt").textContent=1+npcs.length;
  var h="",i,m,sheet,hp,maxHp,cls;
  // Player always first
  h+="<div onclick='showCharSheet()' style='padding:5px 4px;border-bottom:1px solid var(--brd);cursor:pointer;' onmouseover='this.style.background=\"var(--bg2)\"' onmouseout='this.style.background=\"\"'>"
    +"<div style='font-size:11px;color:var(--acc);font-weight:bold;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;'>"+escHtml(c.name)+" <span style='color:var(--t2);font-weight:normal;font-size:9px;'>YOU</span></div>"
    +"<div style='font-size:10px;color:var(--t2);'>"+escHtml(c.cls)+"</div>"
    +"<div style='font-size:10px;color:var(--hp);'>HP "+c.hp+"/"+c.maxHp+"</div>"
    +"</div>";
  for(i=0;i<npcs.length;i++){
    m=npcs[i];sheet=m.charSheet||null;
    hp=sheet?sheet.hp:null;maxHp=sheet?sheet.maxHp:null;
    cls=sheet?(sheet.cls||""):(m.role||"");
    // data-npc + delegated wiring below (audit E69) — an inline onclick with the name in a JS string
    // literal breaks when the name contains a double quote (escHtml's &quot; decodes back to ").
    h+="<div class='party-row' data-npc='"+escHtml(m.name)+"' style='padding:5px 4px;border-bottom:1px solid var(--brd);cursor:pointer;' onmouseover='this.style.background=\"var(--bg2)\"' onmouseout='this.style.background=\"\"'>"
      +"<div style='font-size:11px;color:var(--acc);font-weight:bold;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;'>"+escHtml(m.name)+"</div>"
      +(cls?"<div style='font-size:10px;color:var(--t2);'>"+escHtml(cls)+"</div>":"")
      +(hp!==null?"<div style='font-size:10px;color:var(--hp);'>HP "+hp+(maxHp?"/"+maxHp:"")+"</div>":"")
      +"</div>";
  }
  var _pl=document.getElementById("party-list");_pl.innerHTML=h;
  Array.prototype.forEach.call(_pl.querySelectorAll(".party-row[data-npc]"),function(r){r.addEventListener("click",function(){showNpcSheet(r.getAttribute("data-npc"));});});
}
// #32: inventory entries are plain strings, often "Name — description" or "Name (description)".
// Bold the NAME segment only (split at the first spaced dash or opening paren) so lists scan;
// the description stays regular. No separator = the whole entry is the name.
function invItemHtml(s){
  s=String(s);
  // Name/description split at the EARLIEST of: spaced dash, opening paren, comma, or a
  // clause lead-in word — GM-written entries carry free-prose descriptions with no dash
  // ("Small river stone, smooth…", "Folded camp kit including a second ground cloth…",
  // "Letter of introduction written in a dead contractual script"). The lead-in list is
  // whack-a-mole by design (2026-07-04 user call: report new escapes as they show up).
  var m=s.match(/^(.*?)(\s+[—–-]\s+|\s*\(|,\s+|\s+(?:with|including|containing|written|engraved|carved|marked|labeled|labelled|covered|wrapped|bearing|holding|filled|etched|inscribed|stamped)\s+)/);
  if(!m)return "<b>"+escHtml(s)+"</b>";
  return "<b>"+escHtml(m[1])+"</b><span style='opacity:.8'>"+escHtml(s.slice(m[1].length))+"</span>";
}
function updateInvPanel(){
  if(!worldState)return;var inv=worldState.character.inventory,gold=worldState.character.gold;
  var weps=["sword","blade","axe","bow","staff","crossbow","knife","dagger","spear","mace","hammer","blades"];
  var arm=["armor","chainmail","leather","hide","shield","helm","cloak","mail","scale"];
  document.getElementById("inv-cnt").textContent=inv.length;document.getElementById("inv-gold").textContent=gold+" gp";
  var h="",i;for(i=0;i<inv.length;i++){var lc=inv[i].toLowerCase(),eq=false,j;for(j=0;j<weps.length;j++){if(lc.indexOf(weps[j])>=0){eq=true;break;}}if(!eq)for(j=0;j<arm.length;j++){if(lc.indexOf(arm[j])>=0){eq=true;break;}}h+='<div class="ii'+(eq?' eq':'')+'" title="'+escHtml(inv[i])+'">'+invItemHtml(inv[i])+'</div>';}
  document.getElementById("inv-list").innerHTML=h||'<div style="font-size:11px;color:var(--t2);font-style:italic;padding:4px 0;">Empty</div>';
}
function updateAbPanel(hl){
  if(!worldState)return;var abs=worldState.character.abilities||[];document.getElementById("ab-cnt").textContent=abs.length;
  var h="",i;for(i=0;i<abs.length;i++){h+='<div class="ai'+(hl&&i===abs.length-1?" nw":"")+'"><span class="an">'+escHtml(abs[i].nm)+'</span><span class="ad">'+escHtml(abs[i].ds)+'</span></div>';}/* GM-authored ability text (audit E11) */
  document.getElementById("ab-list").innerHTML=h||'<div style="font-size:11px;color:var(--t2);font-style:italic;padding:4px 0;">None yet</div>';
}
function updateSpPanel(){
  if(!worldState)return;
  var spells=worldState.character.spells||[];
  var avail=spells.filter(function(s){return !s.used;}).length;
  document.getElementById("sp-cnt").textContent=avail+"/"+spells.length;
  var h="",i,sp,tag,nm,ds;
  for(i=0;i<spells.length;i++){
    sp=spells[i];
    tag=sp.lvl===0?"C":String(sp.lvl);
    nm=sp.nm.indexOf("(")>=0?sp.nm.slice(0,sp.nm.indexOf("(")).trim():sp.nm;
    ds=sp.nm.indexOf("(")>=0?sp.nm.slice(sp.nm.indexOf("(")+1).replace(")",""):"";
    h+="<div class='sp-item"+(sp.used?" used":"")+"'>";
    h+="<span class='sp-nm'>["+tag+"] "+nm+"</span>";
    if(ds||sp.used)h+="<span class='sp-ds'>"+(ds||"")+(sp.used?" -- expended":"")+"</span>";
    h+="</div>";
  }
  if(!h)h="<div style='font-size:11px;color:var(--t2);font-style:italic;padding:4px 0;'>No spells</div>";
  else h+="<button onclick='restSpells()' style='width:100%;margin-top:6px;padding:5px;font-size:10px;font-family:var(--font);background:var(--bg3);border:1px solid var(--brd2);border-radius:var(--r);color:var(--t2);cursor:pointer;'>Rest (restore spells)</button>";
  document.getElementById("sp-list").innerHTML=h;
}
function updateCombat(){
  if(!worldState||!worldState.combat)return;
  var cm=worldState.combat,pc=worldState.character;
  document.getElementById("ct-round").textContent="Round "+cm.round;
  document.getElementById("en-name").textContent=cm.name;
  document.getElementById("en-hpt").textContent=cm.hp+"/"+cm.maxHp;
  document.getElementById("en-hpbar").style.width=Math.max(0,Math.round((cm.hp/cm.maxHp)*100))+"%";
  document.getElementById("en-morale").textContent=cm.morale;
  document.getElementById("pl-name").textContent=pc.name;
  document.getElementById("pl-hpt").textContent=pc.hp+"/"+pc.maxHp;
  document.getElementById("pl-hpbar").style.width=Math.max(0,Math.round((pc.hp/pc.maxHp)*100))+"%";
  var sb2=document.getElementById("en-statblock");
  if(sb2){
    var sbh="";
    if(cm.stats){
      var sm2=function(v){var m=Math.floor((v-10)/2);return(m>=0?"+":"")+m;};
      sbh+="STR "+cm.stats.STR+"("+sm2(cm.stats.STR)+") "
          +"DEX "+cm.stats.DEX+"("+sm2(cm.stats.DEX)+") "
          +"CON "+cm.stats.CON+"("+sm2(cm.stats.CON)+") "
          +"INT "+cm.stats.INT+"("+sm2(cm.stats.INT)+") "
          +"WIS "+cm.stats.WIS+"("+sm2(cm.stats.WIS)+") "
          +"CHA "+cm.stats.CHA+"("+sm2(cm.stats.CHA)+") "
          +"<span style='color:var(--acc);'>CR "+cm.stats.CR+"</span>";
    }
    if(cm.immune&&cm.immune.length)sbh+="<span style='color:var(--hp);margin-left:8px;'>Immune: "+cm.immune.join(", ")+"</span>";
    if(cm.resist&&cm.resist.length)sbh+="<span style='color:var(--t2);margin-left:8px;'>Resist: "+cm.resist.join(", ")+"</span>";
    if(cm.vuln&&cm.vuln.length)sbh+="<span style='color:var(--acc);margin-left:8px;'>Vuln: "+cm.vuln.join(", ")+"</span>";
    sb2.innerHTML=sbh;
    sb2.style.display=sbh?"block":"none";
  }
}
function updateMemStatus(){if(!worldState)return;var dot=document.getElementById("memdot"),txt=document.getElementById("memstatus");var t=sessionTokens();dot.className=t>=SUMMARIZE_AT?"mdot c":t>=SUMMARIZE_AT*0.8?"mdot w":"mdot";var actPart="",sk=worldState.skeleton,i;if(sk&&sk.acts){for(i=0;i<sk.acts.length;i++){if(sk.acts[i].status==="active"){var at=sk.acts[i].title;actPart=" | "+(/^act\s/i.test(at)?at:"Act "+(i+1)+": "+at);break;}}}txt.textContent="Session: ~"+t+"tk"+actPart+" | Chapters: "+memory.chapters.length+" | NPCs: "+Object.keys(memory.npcs).length+" | Turn "+worldState.turn+" | "+APP_VERSION;updateSyncBadge();}
// Sync failure badge (TODO #24) — red ☁ in the membar whenever the server-ACKed turn lags
// the local turn or syncs are failing. Called from updateMemStatus (every turn) AND directly
// by the storage adapter on every sync success/failure, so it never waits for a turn to refresh.
function updateSyncBadge(){
  var mb=document.getElementById("membar");if(!mb)return;
  var el=document.getElementById("syncbadge");
  var st=(typeof storageAdapter!=="undefined"&&storageAdapter.syncStatus)?storageAdapter.syncStatus():null;
  var show=st&&st.serverMode&&(st.failing||st.unsynced>0);
  if(!show){if(el)el.style.display="none";return;}
  if(!el){el=document.createElement("span");el.id="syncbadge";el.style.cssText="margin-left:10px;font-size:11px;color:var(--dng);font-weight:bold;";mb.appendChild(el);}
  el.style.display="inline";
  el.textContent="☁ "+(st.unsynced>0?st.unsynced+" turn"+(st.unsynced===1?"":"s")+" unsynced":"sync failing");
  el.title=st.failing?"Cloud sync is failing ("+st.failCount+" consecutive). Progress is saved on this device and uploads automatically when the server is reachable.":"Turns not yet uploaded to the server.";
}
function showRulesModal(){
  var ex=document.getElementById("rules-modal");if(ex)ex.remove();
  var modal=document.createElement("div");modal.id="rules-modal";modal.style.cssText="position:fixed;inset:0;background:rgba(0,0,0,.88);z-index:300;display:flex;align-items:flex-start;justify-content:center;padding:20px;overflow-y:auto;";
  var inner=document.createElement("div");inner.style.cssText="background:var(--modal-bg);border:1px solid var(--acc);border-radius:12px;padding:24px;max-width:520px;width:100%;margin-top:40px;";
  modal.appendChild(inner);document.body.appendChild(modal);
  function renderRules(){
    var h="<div style='display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;'><span style='font-size:16px;color:var(--t0);font-weight:bold;'>Narrative Rules</span><button id='rules-x' style='background:none;border:none;color:var(--t2);font-size:20px;cursor:pointer;'>&#215;</button></div><div style='font-size:11px;color:var(--t2);margin-bottom:14px;'>Strictly enforced on every GM response.</div>",i;
    for(i=0;i<DEFAULT_RULES.length;i++){h+="<div style='padding:8px 10px;background:var(--bg2);border:1px solid var(--brd);border-radius:var(--r);margin-bottom:6px;font-size:12px;display:flex;gap:8px;'><span style='color:var(--t2);font-size:10px;flex-shrink:0;margin-top:1px;'>DEFAULT</span><span style='color:var(--t1);'>"+DEFAULT_RULES[i]+"</span></div>";}
    for(i=0;i<customRules.length;i++){h+="<div style='padding:8px 10px;background:var(--bg2);border:1px solid var(--acc);border-radius:var(--r);margin-bottom:6px;font-size:12px;color:var(--t0);display:flex;justify-content:space-between;align-items:flex-start;gap:8px;'><span>"+customRules[i]+"</span><button onclick='removeRule("+i+")' style='background:none;border:none;color:var(--dng);cursor:pointer;font-size:16px;flex-shrink:0;line-height:1;'>&#215;</button></div>";}
    h+="<div style='display:flex;gap:6px;margin-top:14px;'><input id='rules-new' type='text' placeholder='Add a custom rule...' class='sc-inp' style='flex:1;'/><button id='rules-add' style='padding:7px 14px;font-size:12px;font-family:var(--font);background:var(--bg3);border:1px solid var(--brd2);border-radius:var(--r);color:var(--t0);cursor:pointer;'>Add</button></div>";
    inner.innerHTML=h;
    document.getElementById("rules-x").addEventListener("click",function(){modal.remove();});
    document.getElementById("rules-add").addEventListener("click",function(){var v=document.getElementById("rules-new").value.trim();if(!v)return;customRules.push(v);saveRules();renderRules();});
  }
  renderRules();
}
function removeRule(idx){customRules.splice(idx,1);saveRules();showRulesModal();}
var FONT_KEY="tnd_font_v1";
function loadFontSize(){
  var saved=store.get(FONT_KEY);
  // Default to large on iOS if no preference saved
  var isIOS=/iPhone|iPad|iPod/i.test(navigator.userAgent);
  var large=saved!==null?(saved==="1"):(isIOS?true:false);
  if(large)document.body.classList.add("font-large");
  else document.body.classList.remove("font-large");
  ["fm-font-lg","cs-fm-font-lg","api-fm-font-lg"].forEach(function(id){var el=document.getElementById(id);if(el)el.checked=large;});
}
function toggleFontSize(){
  var large=document.body.classList.toggle("font-large");
  store.set(FONT_KEY,large?"1":"0");
  ["fm-font-lg","cs-fm-font-lg","api-fm-font-lg"].forEach(function(id){var el=document.getElementById(id);if(el)el.checked=large;});
}
function toggleAdultMode(){adultMode=!adultMode;store.set(ADK,adultMode?"1":"");["fm-adult-cb","cs-fm-adult-cb","api-fm-adult-cb"].forEach(function(id){var cb=document.getElementById(id);if(cb)cb.checked=adultMode;});showToast(adultMode?"18+ content enabled":"18+ content disabled");}
function loadAdultMode(){var v=store.get(ADK);adultMode=!!(v&&v==="1");["fm-adult-cb","cs-fm-adult-cb","api-fm-adult-cb"].forEach(function(id){var cb=document.getElementById(id);if(cb)cb.checked=adultMode;});}
function loadLegacySettings(){legacyCharsOn=store.get(LEGACY_ON_K)==="1";var pv=parseInt(store.get(LEGACY_PCT_K)||"5",10);legacyChancePct=(isNaN(pv)||pv<1)?5:Math.min(100,pv);["fm-legacy-cb","cs-fm-legacy-cb","api-fm-legacy-cb"].forEach(function(id){var el=document.getElementById(id);if(el)el.checked=legacyCharsOn;});["fm-legacy-pct","cs-fm-legacy-pct","api-fm-legacy-pct"].forEach(function(id){var el=document.getElementById(id);if(el)el.value=legacyChancePct;});}
function saveLegacySettings(){store.set(LEGACY_ON_K,legacyCharsOn?"1":"");store.set(LEGACY_PCT_K,String(legacyChancePct));}

// ── Server connect / disconnect ──────────────────────────────────────────────
var TND_SERVER_URL = "https://traffic-and-dragons-server.fly.dev";

function updateServerUI(){
  var connected=storageAdapter.isServerMode();
  ["","cs-","api-"].forEach(function(p){
    var btnConn=document.getElementById(p+"fm-server-connect");
    var btnDisc=document.getElementById(p+"fm-server-disconnect");
    if(btnConn) btnConn.style.display=connected?"none":"block";
    if(btnDisc) btnDisc.style.display=connected?"block":"none";
  });
  if(connected){
    // Fetch username from server to show in button label
    fetch(TND_SERVER_URL+"/auth/me",{headers:{"Authorization":"Bearer "+(localStorage.getItem("tnd_server_tok_v1")||"")}})
      .then(function(r){return r.ok?r.json():null;})
      .then(function(d){
        ["fm-server-user","cs-fm-server-user","api-fm-server-user"].forEach(function(id){var span=document.getElementById(id);if(span&&d&&d.username)span.textContent=d.username;});
      }).catch(function(){});
  }
}

function clearCacheAndReload(){
  closeAllMenus();
  if("serviceWorker" in navigator){
    navigator.serviceWorker.getRegistrations()
      .then(function(regs){
        var i=0;function next(){if(i<regs.length){regs[i++].unregister().then(next);}else{location.reload(true);}}
        next();
      })
      .catch(function(){location.reload(true);}); // file:// origin throws SecurityError — just reload
  }else{location.reload(true);}
}
function closeAllMenus(){["file-menu","cs-file-menu","api-file-menu"].forEach(function(id){var el=document.getElementById(id);if(el)el.style.display="none";});}

function connectToServer(){
  storageAdapter.loginWithServer(TND_SERVER_URL,function(err,info){
    if(err){showToast(typeof err==="string"?err:"Server login failed.");return;}// surface the real reason (audit E75)
    updateServerUI();
    showToast("&#9729; Connected as "+info.username);
    snapshotActiveCamp();
    // Fetch the server list FIRST, then push only LOCAL-ONLY campaigns (audit E33). The old blind
    // push of every local campaign could overwrite a NEWER server copy with a stale local snapshot;
    // campaigns already on the server are left for the normal per-campaign reconcile (which pulls
    // the newer side). On a failed list fetch, skip the push — we can't tell what's fresh.
    storageAdapter.syncCampaignList(function(result){
      if(!result){showCampaignPicker();return;}
      var meta=getCampMeta().filter(function(c){return !c.onServer;});
      if(!meta.length){showCampaignPicker();return;}
      var remaining=meta.length;
      function onPushed(){if(--remaining<=0)showCampaignPicker();}
      for(var i=0;i<meta.length;i++){campCloudPushSilent(meta[i].id,onPushed);}
    });
  });
}
function campCloudPushSilent(id,cb){
  if(!storageAdapter.isServerMode()){if(cb)cb(false);return;}
  // For the active campaign use live keys, not the snapshot (snapshot is only
  // written on campaign switch and may be many turns stale).
  var isActive=id===getActiveCampId();
  var ws=isActive?store.get(WSK):store.get("tnd_camp_"+id+"_ws");
  var sl=isActive?store.get(SLK):store.get("tnd_camp_"+id+"_sl")||"[]";
  var mem=isActive?store.get(MEM_KEY):store.get("tnd_camp_"+id+"_mem")||"{}";
  if(!ws){if(cb)cb(false);return;}
  var tok=localStorage.getItem("tnd_server_tok_v1")||"";
  var serverUrl=storageAdapter.getServerUrl();
  var wsObj;try{wsObj=JSON.parse(ws);}catch(e){if(cb)cb(false);return;}
  // Keep the PC portrait INLINE (audit E27 — matches the v1.45 fix / the main _syncNow path): it must
  // ride atomic with the state so a device pulling this campaign doesn't get a portrait-less PC. Only
  // NPC avatar portraits are stripped to the separate /portrait store.
  var wsStripped=Object.assign({},wsObj,{npcs:(wsObj.npcs||[]).map(function(n){return n.portrait?Object.assign({},n,{portrait:null}):n;})});
  // narrativeHtml no longer shipped (audit #18) — replay rebuilds from worldState.transcript.
  fetch(serverUrl+"/api/state",{method:"POST",headers:{"Content-Type":"application/json","Authorization":"Bearer "+tok},body:JSON.stringify({worldState:wsStripped,sessionLog:JSON.parse(sl),memory:JSON.parse(mem),campaignId:id,narrativeHtml:""})})
    .then(function(r){if(!r.ok)throw new Error(r.status);return r.json();})
    .then(function(){
      var meta=getCampMeta(),i;for(i=0;i<meta.length;i++){if(meta[i].id===id){meta[i].onServer=true;break;}}setCampMeta(meta);
      // Also push portrait if this campaign has one
      var portrait=wsObj.character&&wsObj.character.portrait;
      var npcPortraits={};(wsObj.npcs||[]).forEach(function(n){var p=npcPortrait(n);if(p)npcPortraits[n.name]=p;});
      if(portrait||Object.keys(npcPortraits).length){fetch(serverUrl+"/api/campaigns/"+encodeURIComponent(id)+"/portrait",{method:"PUT",headers:{"Content-Type":"application/json","Authorization":"Bearer "+tok},body:JSON.stringify({portrait:portrait||null,npcPortraits:npcPortraits})}).catch(function(){});}
      if(cb)cb(true);
    })
    .catch(function(){if(cb)cb(false);});
}

function disconnectFromServer(){
  storageAdapter.logoutFromServer(function(){
    updateServerUI();closeAllMenus();
    showToast("☁ Disconnected from server.");
  });
}

function showSyncModal(){
  var ex=document.getElementById("sync-modal");if(ex)ex.remove();if(!worldState){showToast("No active game.");return;}
  var dir="ui";var modalDiv=document.createElement("div");modalDiv.id="sync-modal";modalDiv.style.cssText="position:fixed;inset:0;background:rgba(0,0,0,.88);z-index:300;display:flex;align-items:flex-start;justify-content:center;padding:20px;overflow-y:auto;";
  var inner=document.createElement("div");inner.style.cssText="background:var(--modal-bg);border:1px solid var(--acc);border-radius:12px;padding:24px;max-width:520px;width:100%;margin-top:40px;";
  modalDiv.appendChild(inner);document.body.appendChild(modalDiv);
  function renderSync(){
    var c=worldState.character,w=worldState.world,isUI=(dir==="ui"),ro=isUI?"":"readonly";
    inner.innerHTML="<div style='display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;'><span style='font-size:16px;color:var(--t0);font-weight:bold;'>Sync World State</span><button id='sc-x' style='background:none;border:none;color:var(--t2);font-size:20px;cursor:pointer;'>&#215;</button></div>"
      +"<div style='font-size:11px;color:var(--t2);font-family:var(--font-mono);background:var(--bg2);padding:6px 10px;border-radius:4px;margin-bottom:14px;'>Lv "+c.level+" | XP "+c.xp+" | HP "+c.hp+"/"+c.maxHp+" | Gold "+c.gold+" | Turn "+worldState.turn+"</div>"
      +"<div style='display:flex;gap:8px;margin-bottom:16px;'><button id='sc-ui' class='sc-dir"+(isUI?" active":"")+"'>UI -> Game</button><button id='sc-gm' class='sc-dir"+(!isUI?" active":"")+"'>Game -> UI</button></div>"
      +"<div style='display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px;'>"
      +"<div><label class='sc-lbl'>HP</label><input id='sc-hp' type='number' class='sc-inp' value='"+c.hp+"' "+ro+"/></div>"
      +"<div><label class='sc-lbl'>Max HP</label><input id='sc-maxhp' type='number' class='sc-inp' value='"+c.maxHp+"' "+ro+"/></div>"
      +"<div><label class='sc-lbl'>Gold</label><input id='sc-gold' type='number' class='sc-inp' value='"+c.gold+"' "+ro+"/></div>"
      +"<div><label class='sc-lbl'>XP</label><input id='sc-xp' type='number' class='sc-inp' value='"+c.xp+"' "+ro+"/></div>"
      +"<div><label class='sc-lbl'>Level</label><input id='sc-level' type='number' min='1' max='10' class='sc-inp' value='"+c.level+"' "+ro+"/></div>"
      +"<div><label class='sc-lbl'>Location</label><input id='sc-loc' type='text' class='sc-inp' value='"+escHtml(w.location)+"' "+ro+"/></div>"
      +"<div><label class='sc-lbl'>Time</label><input id='sc-time' type='text' class='sc-inp' value='"+escHtml(w.time)+"' "+ro+"/></div>"
      +"<div><label class='sc-lbl'>Weather</label><input id='sc-weather' type='text' class='sc-inp' value='"+escHtml(w.weather)+"' "+ro+"/></div></div>"
      +"<div style='margin-bottom:12px;'><label class='sc-lbl'>Inventory (one per line)</label><textarea id='sc-inv' class='sc-inp' style='height:80px;resize:vertical;' "+ro+">"+escHtml(c.inventory.join("\n"))+"</textarea></div>"
      +(isUI?"<button id='sc-apply' style='width:100%;padding:13px;font-size:15px;font-family:var(--font);background:var(--acc);color:var(--on-acc);border:none;border-radius:var(--r);cursor:pointer;font-weight:bold;'>APPLY</button>":"<div style='text-align:center;font-size:12px;color:var(--t2);padding:8px;'>Showing live game state. Switch to UI -> Game to edit.</div>")
      +"<p id='sc-msg' style='font-size:12px;min-height:16px;margin-top:8px;text-align:center;'></p>";
    document.getElementById("sc-x").addEventListener("click",function(){modalDiv.remove();});
    document.getElementById("sc-ui").addEventListener("click",function(){dir="ui";renderSync();});
    document.getElementById("sc-gm").addEventListener("click",function(){dir="game";syncUI();renderSync();});
    if(isUI){document.getElementById("sc-apply").addEventListener("click",function(){
      var c2=worldState.character,w2=worldState.world;
      var hp2=parseInt(document.getElementById("sc-hp").value),mhp2=parseInt(document.getElementById("sc-maxhp").value);
      var gld2=parseInt(document.getElementById("sc-gold").value),xp2=parseInt(document.getElementById("sc-xp").value),lvl2=parseInt(document.getElementById("sc-level").value);
      var loc2=document.getElementById("sc-loc").value.trim(),tm2=document.getElementById("sc-time").value.trim(),wx2=document.getElementById("sc-weather").value.trim();
      var rawInv=document.getElementById("sc-inv").value.trim();
      var inv2=rawInv?rawInv.split("\n").map(function(x){return x.trim();}).filter(function(x){return x.length>0;}):[];
      if(!isNaN(mhp2)&&mhp2>0)c2.maxHp=mhp2;if(!isNaN(hp2))c2.hp=Math.min(c2.maxHp,Math.max(0,hp2));
      if(!isNaN(gld2))c2.gold=Math.max(0,gld2);if(!isNaN(xp2))c2.xp=Math.max(0,xp2);
      if(!isNaN(lvl2)&&lvl2>=1&&lvl2<=10)c2.level=lvl2;if(loc2)w2.location=loc2;if(tm2)w2.time=tm2;if(wx2)w2.weather=wx2;
      c2.inventory=inv2;/* always assign so emptying the textarea actually clears inventory (audit E63) */syncUI();saveAll();renderSync();
      var msg=document.getElementById("sc-msg");if(msg){msg.textContent="Applied.";msg.style.color="var(--grn)";}
    });}
  }
  renderSync();
}
function exportNarrative(){
  if(!worldState)return;var lines=["TRAFFIC AND DRAGONS -- SESSION LOG","Character: "+worldState.character.name+" | "+worldState.character.cls+" Lv"+worldState.character.level,"Turn: "+worldState.turn,"","===="];
  var story=document.getElementById("story-narrative"),msgs=story.querySelectorAll(".msg"),i;
  // Extract prose only — strip the suggested-action buttons (.qa) and the 🔊 replay button
  // (.tts-replay). They're UI affordances, not narrative; the chosen action already appears as
  // the next "> player" line. Render the cleaned clone offscreen so innerText keeps line breaks.
  var holder=document.createElement("div");holder.style.cssText="position:absolute;left:-9999px;top:0;width:600px;";document.body.appendChild(holder);
  function msgText(m){holder.innerHTML=m.innerHTML;var rm=holder.querySelectorAll(".qa,.tts-replay"),k;for(k=0;k<rm.length;k++)rm[k].parentNode.removeChild(rm[k]);return (holder.innerText||holder.textContent||"").trim();}
  for(i=0;i<msgs.length;i++){var m=msgs[i];if(m.classList.contains("narrator")){lines.push(msgText(m));lines.push("");}else if(m.classList.contains("player")){lines.push("> "+msgText(m));lines.push("");}else if(m.classList.contains("system")){lines.push("[ "+msgText(m)+" ]");}}
  document.body.removeChild(holder);
  var fname=buildFilename("narrative");var blob=new Blob([lines.join("\n")],{type:"text/plain"});exportToFolder("narrative",blob,fname);
}
function exportSave(){
  if(!worldState)return;
  document.getElementById("file-menu").style.display="none";
  var fname=buildFilename("save");
  // Check if we've saved this filename before (same turn = likely overwrite)
  var saved=[];try{var sr=localStorage.getItem("tnd_saved_files_v1");if(sr)saved=JSON.parse(sr);}catch(e){}
  var alreadySaved=saved.indexOf(fname)>=0;
  var ex=document.getElementById("save-confirm-modal");if(ex)ex.remove();
  var modal=document.createElement("div");modal.id="save-confirm-modal";
  modal.style.cssText="position:fixed;inset:0;background:rgba(0,0,0,.88);z-index:300;display:flex;align-items:center;justify-content:center;padding:20px;";
  modal.innerHTML="<div style='background:var(--modal-bg);border:1px solid var(--acc);border-radius:12px;padding:24px;max-width:400px;width:100%;'>"
    +"<div style='font-size:15px;color:var(--t0);font-weight:bold;margin-bottom:6px;'>Save Game (local)</div>"
    +"<div style='font-size:11px;color:var(--t2);margin-bottom:16px;'>Turn "+worldState.turn+" &nbsp;·&nbsp; "+worldState.world.location+"</div>"
    +"<div style='font-size:11px;color:var(--t2);margin-bottom:4px;'>File</div>"
    +"<input id='sc-fname' type='text' value='"+fname+"' style='width:100%;font-size:12px;font-family:var(--font-mono);background:var(--bg2);border:1px solid var(--brd);border-radius:var(--r);padding:8px 10px;color:var(--t1);box-sizing:border-box;margin-bottom:"+(alreadySaved?"12":"20")+"px;'/>"
    +(alreadySaved?"<div style='font-size:12px;color:var(--acc);margin-bottom:16px;'>&#9888; A file with this name may already exist in your downloads folder.</div>":"")
    +"<div style='display:flex;gap:10px;'><button id='sc-cancel' style='flex:1;padding:10px;font-family:var(--font);background:var(--bg2);border:1px solid var(--brd);border-radius:var(--r);color:var(--t1);cursor:pointer;'>Cancel</button>"
    +"<button id='sc-save' style='flex:1;padding:10px;font-family:var(--font);background:var(--acc);border:none;border-radius:var(--r);color:var(--on-acc);font-weight:bold;cursor:pointer;'>Save</button></div>"
    +"</div>";
  document.body.appendChild(modal);
  function getFname(){var el=document.getElementById("sc-fname");return(el&&el.value.trim())||fname;}
  function doSave(){
    var actualFname=getFname();
    // The async server reconcile can REPLACE worldState between modal-open and this click
    // (stale local state adopted the server blob mid-dialog) — the payload below serializes
    // the LIVE state, so a prefilled (unedited) filename must be recomputed from it too, or
    // the file gets the pre-reconcile turn stamp (the t4-name-on-t139-data bug, 2026-07-03).
    if(actualFname===fname)actualFname=buildFilename("save");
    modal.remove();
    var data=JSON.stringify({worldState:worldState,sessionLog:sessionLog,memory:memory},null,2);
    var blob=new Blob([data],{type:"application/json"});exportToFolder("save",blob,actualFname);
    if(saved.indexOf(actualFname)<0)saved.push(actualFname);
    if(saved.length>100)saved=saved.slice(-100);
    try{localStorage.setItem("tnd_saved_files_v1",JSON.stringify(saved));}catch(e){}
  }
  document.getElementById("sc-cancel").addEventListener("click",function(){modal.remove();});
  document.getElementById("sc-save").addEventListener("click",doSave);
  document.getElementById("sc-fname").addEventListener("keydown",function(e){if(e.key==="Enter")doSave();});
  modal.addEventListener("click",function(e){if(e.target===modal)modal.remove();});
}
// buildBlueprintFromGame moved to game.js (v1.156) — pure data logic, now headless-testable.
// The Blueprint Designer is a fully EXTERNAL page (blueprint-designer.html, D5 revised
// 2026-07-03) with NO File-menu entry by user preference — open it directly.
function exportBlueprint(){
  if(!worldState||!worldState.character)return;
  document.getElementById("file-menu").style.display="none";
  var bp=buildBlueprintFromGame();
  var ex=document.getElementById("bp-export-modal");if(ex)ex.remove();
  var connected=storageAdapter.isServerMode();
  var modal=document.createElement("div");modal.id="bp-export-modal";
  modal.style.cssText="position:fixed;inset:0;background:rgba(0,0,0,.88);z-index:300;display:flex;align-items:center;justify-content:center;padding:20px;";
  var voiceOpts="",vCur=bp.proseAuthor||"",vi;
  for(vi=0;vi<AUTHORS.length;vi++){voiceOpts+="<option value='"+AUTHORS[vi].id+"'"+(AUTHORS[vi].id===vCur?" selected":"")+">"+escHtml(AUTHORS[vi].nm)+(AUTHORS[vi].blurb?" — "+escHtml(AUTHORS[vi].blurb):"")+"</option>";}
  modal.innerHTML="<div style='background:var(--modal-bg);border:1px solid var(--acc);border-radius:12px;padding:24px;max-width:420px;width:100%;'>"
    +"<div style='font-size:15px;color:var(--t0);font-weight:bold;margin-bottom:16px;'>Export as Blueprint</div>"
    +"<div style='font-size:11px;color:var(--t2);margin-bottom:4px;'>Blueprint name</div>"
    +"<input id='bp-export-name' type='text' value='"+bp.name.replace(/'/g,"&#39;")+"' style='width:100%;padding:9px 12px;font-size:14px;font-family:var(--font);background:var(--bg2);border:1px solid var(--brd);border-radius:var(--r);color:var(--t0);box-sizing:border-box;margin-bottom:12px;'/>"
    +"<div style='font-size:11px;color:var(--t2);margin-bottom:4px;'>Prose voice <span style='opacity:0.6;'>(player can override)</span></div>"
    +"<select id='bp-export-voice' style='width:100%;padding:9px 12px;font-size:12px;font-family:var(--font);background:var(--bg2);border:1px solid var(--brd);border-radius:var(--r);color:var(--t0);box-sizing:border-box;margin-bottom:12px;'>"+voiceOpts+"</select>"
    +"<div style='font-size:11px;color:var(--t2);margin-bottom:16px;'>Acts: "+(bp.acts.length)+" &nbsp;·&nbsp; NPCs: "+bp.npcs.length+" &nbsp;·&nbsp; Locations: "+bp.locations.length+"</div>"
    +"<div style='display:flex;gap:10px;flex-wrap:wrap;'>"
    +"<button id='bp-export-cancel' style='flex:1;min-width:80px;padding:10px;font-family:var(--font);background:var(--bg2);border:1px solid var(--brd);border-radius:var(--r);color:var(--t1);cursor:pointer;'>Cancel</button>"
    +"<button id='bp-export-dl' style='flex:1;min-width:80px;padding:10px;font-family:var(--font);background:var(--bg2);border:1px solid var(--brd);border-radius:var(--r);color:var(--t0);cursor:pointer;'>&#8595; Download</button>"
    +(connected?"<button id='bp-export-cloud' style='flex:1;min-width:80px;padding:10px;font-family:var(--font);background:var(--acc);border:none;border-radius:var(--r);color:var(--on-acc);font-weight:bold;cursor:pointer;'>&#9729; Save to blueprint library</button>":"<button disabled style='flex:1;min-width:80px;padding:10px;font-family:var(--font);background:var(--bg2);border:1px solid var(--brd);border-radius:var(--r);color:var(--t2);cursor:default;opacity:0.5;'>&#9729; Save to blueprint library</button>")
    +"</div></div>";
  document.body.appendChild(modal);
  function getName(){return (document.getElementById("bp-export-name").value||bp.name).trim();}
  function getVoice(){var s=document.getElementById("bp-export-voice");return s?s.value:"";}
  document.getElementById("bp-export-cancel").addEventListener("click",function(){modal.remove();});
  document.getElementById("bp-export-dl").addEventListener("click",function(){
    bp.name=getName();bp.proseAuthor=getVoice();
    var data=JSON.stringify(bp,null,2);
    var blob=new Blob([data],{type:"application/json"});
    var fname=(bp.name||"blueprint").replace(/[^a-z0-9_\-\s]/gi,"").replace(/\s+/g,"_").toLowerCase()+".blueprint";
    exportToFolder("save",blob,fname);
    modal.remove();
  });
  if(connected){
    document.getElementById("bp-export-cloud").addEventListener("click",function(){
      bp.name=getName();bp.proseAuthor=getVoice();
      var btn=document.getElementById("bp-export-cloud");btn.disabled=true;btn.textContent="Saving…";
      storageAdapter.saveBlueprintToLibrary(bp,function(err){
        if(err){showToast("Blueprint save failed: "+err);btn.disabled=false;btn.textContent="☁ Save to blueprint library";}
        else{modal.remove();showToast("Blueprint saved to the blueprint library.");}
      });
    });
  }
  modal.addEventListener("click",function(e){if(e.target===modal)modal.remove();});
}
function importSave(event){
  var file=event.target.files[0];if(!file)return;var reader=new FileReader();
  reader.onload=function(e){try{var data=JSON.parse(e.target.result);
    if(!data.worldState||!data.worldState.character)throw new Error("Invalid save.");
    var ws=data.worldState,ch=ws.character;
    if(typeof ch.name!=="string")throw new Error("Invalid character data.");
    if(!Array.isArray(ch.inventory))ch.inventory=[];
    if(!Array.isArray(ch.abilities))ch.abilities=[];
    if(!Array.isArray(ch.spells))ch.spells=[];
    if(!Array.isArray(ws.npcs))ws.npcs=[];
    if(!Array.isArray(ws.questLog))ws.questLog=[];
    if(!Array.isArray(ws.eventHistory))ws.eventHistory=[];
    if(!ws.world||typeof ws.world!=="object")throw new Error("Invalid world data.");
    // Snapshot (and flush, via E74) the OUTGOING campaign before repointing (audit E12) — importSave
    // used to overwrite worldState + the active campaign id without preserving the current campaign,
    // silently destroying its in-session progress since the last snapshot.
    snapshotActiveCamp();
    worldState=ws;
    // Resolve campaign slot: reuse the file's own campId if present, else current active, else mint new
    var _cid=ws.campId;
    if(_cid){setActiveCampId(_cid);}
    else{var _aid=getActiveCampId();if(!_aid){_aid=newCampaignId();setActiveCampId(_aid);}worldState.campId=_aid;}
    migrateWorldState(); // older exports miss v10 fields (objectives/transcript/etc) — same battery loadState runs (audit #15)
    sessionLog=Array.isArray(data.sessionLog)?data.sessionLog:[];
    var mm=data.memory||{};
    memory={npcs:mm.npcs||{},locations:mm.locations||{},quests:mm.quests||{},lore:Array.isArray(mm.lore)?mm.lore:[],keyDecisions:Array.isArray(mm.keyDecisions)?mm.keyDecisions:[],futureEvents:Array.isArray(mm.futureEvents)?mm.futureEvents:[],chapters:Array.isArray(mm.chapters)?mm.chapters:[],usedNames:Array.isArray(mm.usedNames)?mm.usedNames:[],map:mm.map||{nodes:{},edges:[],lastArrivalFrom:null},npcGraph:mm.npcGraph?{edges:mm.npcGraph.edges||[],factions:mm.npcGraph.factions||{},factionEdges:mm.npcGraph.factionEdges||[],npcFactions:mm.npcGraph.npcFactions||{}}:{edges:[],factions:{},factionEdges:[],npcFactions:{}},archive:mm.archive?{lore:mm.archive.lore||[],decisions:mm.archive.decisions||[],chapters:mm.archive.chapters||[]}:{lore:[],decisions:[],chapters:[]}};/* archive survives export/import (P12) */
    saveAll();document.getElementById("story-narrative").innerHTML="";document.getElementById("story-tabletalk").innerHTML="";showGame();syncUI();initAbilities();initSpells();addMsg("system","Loaded: "+worldState.character.name+" Turn "+worldState.turn);if(typeof initReplaySession==="function")initReplaySession();/* replay the story pane like init()/campLoad do — importSave left it empty (audit E65) */if(worldState.combat){document.getElementById("cpanel").classList.add("active");updateCombat();}}catch(err){showToast("Import failed: "+err.message);}};
  reader.readAsText(file);event.target.value="";
}
function _applyBlueprint(bp){
  bp=normalizeBlueprint(bp); // choke point — every path into the wizard passes here (§5.1)
  pendingBlueprint=bp;
  // §5.2 fix: the tone UI is the #tone-sel dropdown since v1.133 — the old #tone-grid .card
  // selector matched nothing, so blueprint tone silently never applied. cs.tone is the
  // load-bearing part; the select + custom-textarea + blurb are the visible echo.
  if(bp.tone){var ti;for(ti=0;ti<TONES.length;ti++){if(TONES[ti].id===bp.tone){cs.tone=TONES[ti].id;var _ts=document.getElementById("tone-sel");if(_ts){_ts.value=bp.tone;var _cw=document.getElementById("tone-cw");if(_cw)_cw.style.display=bp.tone==="custom"?"block":"none";if(typeof _syncDnaBlurb==="function")_syncDnaBlurb();}break;}}}
  var banner=document.getElementById("blueprint-banner"),nm=document.getElementById("blueprint-name");
  if(banner){banner.style.display="block";nm.textContent=bp.name;}
  showToast("Blueprint loaded: "+bp.name);
  goStep(2);
}
function clearBlueprint(){
  pendingBlueprint=null;
  var banner=document.getElementById("blueprint-banner");if(banner)banner.style.display="none";
  showToast("Blueprint cleared.");
}
function showBlueprintBrowser(){
  var ex=document.getElementById("bp-browser-modal");if(ex)ex.remove();
  var modal=document.createElement("div");modal.id="bp-browser-modal";
  modal.style.cssText="position:fixed;inset:0;background:rgba(0,0,0,.88);z-index:400;display:flex;align-items:flex-start;justify-content:center;padding:20px;overflow-y:auto;";
  var connected=storageAdapter.isServerMode();
  var mode=connected?"library":"local";
  var segS="padding:7px 16px;font-size:12px;font-family:var(--font);cursor:pointer;border:1px solid var(--brd2);";
  function segBtn(lbl,val,pos){var sel=mode===val;return "<button data-seg='"+val+"' style='"+segS+"background:"+(sel?"var(--acc)":"var(--bg2)")+";color:"+(sel?"var(--on-acc)":"var(--t1)")+";border-radius:"+(pos==="left"?"var(--r) 0 0 var(--r)":"0 var(--r) var(--r) 0")+";font-weight:"+(sel?"bold":"normal")+";border-"+(pos==="left"?"right":"left")+":none;'>"+lbl+"</button>";}
  modal.innerHTML="<div style='background:var(--modal-bg);border:1px solid var(--acc);border-radius:12px;padding:24px;max-width:500px;width:100%;margin-top:40px;'>"
    +"<div style='display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;'>"
    +"<span style='font-size:16px;color:var(--t0);font-weight:bold;'>Campaign Blueprints</span>"
    +"<button id='bp-x' style='background:none;border:none;color:var(--t2);font-size:20px;cursor:pointer;'>&#215;</button></div>"
    +"<div style='font-size:11px;color:var(--t2);margin-bottom:12px;'>Pre-built campaign skeletons with NPCs, locations, and story arcs.</div>"
    +"<div id='bp-seg' style='display:flex;margin-bottom:16px;'>"+segBtn("&#9729; Blueprint Library","library","left")+segBtn("Local","local","right")+"</div>"
    +"<div id='bp-body'></div>"
    +"</div>";
  document.body.appendChild(modal);
  document.getElementById("bp-x").addEventListener("click",function(){modal.remove();});
  modal.addEventListener("click",function(e){if(e.target===modal)modal.remove();});
  function showPreview(bp){
    var body=document.getElementById("bp-body");if(!body)return;
    var actCount=bp.acts?bp.acts.length:0;
    var arcCount=0;if(bp.acts){var ai;for(ai=0;ai<bp.acts.length;ai++)arcCount+=(bp.acts[ai].arcs?bp.acts[ai].arcs.length:0);}
    var npcCount=bp.npcs?bp.npcs.length:0;
    var locCount=bp.locations?bp.locations.length:0;
    var voiceNm="";
    if(bp.proseAuthor&&typeof AUTHORS!=="undefined"){var vai;for(vai=0;vai<AUTHORS.length;vai++){if(AUTHORS[vai].id===bp.proseAuthor){voiceNm=AUTHORS[vai].nm;break;}}}
    var actsHtml="",ai2,aj;
    if(bp.acts){for(ai2=0;ai2<bp.acts.length;ai2++){
      var act=bp.acts[ai2];
      actsHtml+="<div style='margin-bottom:10px;'><div style='font-size:12px;color:var(--acc);font-weight:bold;'>Act "+(ai2+1)+": "+escHtml(act.title)+"</div>"
        +"<div style='font-size:11px;color:var(--t2);margin:2px 0 4px;'>"+escHtml(act.goal)+"</div>";
      if(act.arcs){for(aj=0;aj<act.arcs.length;aj++){
        var arc=act.arcs[aj],typeTag=arc.type?" <span style='font-size:10px;color:var(--t2);'>("+escHtml(arc.type)+")</span>":"";
        actsHtml+="<div style='font-size:11px;color:var(--t1);padding-left:12px;'>"+escHtml(arc.title)+typeTag+"</div>";
      }}
      actsHtml+="</div>";
    }}
    var npcHtml="";
    if(bp.npcs){var ni;for(ni=0;ni<bp.npcs.length;ni++){
      var n=bp.npcs[ni],roleCol=n.role==="enemy"?"#c04040":n.role==="ally"?"var(--grn)":"var(--t2)";
      npcHtml+="<div style='display:flex;gap:6px;align-items:baseline;margin-bottom:3px;'><span style='font-size:11px;color:var(--t0);'>"+escHtml(n.name)+"</span><span style='font-size:10px;color:"+roleCol+";'>"+escHtml(n.role||"neutral")+"</span></div>";
    }}
    body.innerHTML="<div style='font-size:15px;color:var(--t0);font-weight:bold;margin-bottom:4px;'>"+escHtml(bp.name)+"</div>"
      +(bp.author?"<div style='font-size:11px;color:var(--t2);margin-bottom:12px;'>by "+escHtml(bp.author)+"</div>":"")
      +"<div style='font-size:12px;color:var(--t1);margin-bottom:16px;line-height:1.6;'>"+escHtml(bp.premise||"")+"</div>"
      +"<div style='display:flex;gap:16px;margin-bottom:16px;flex-wrap:wrap;align-items:baseline;'>"
      +"<div style='font-size:11px;color:var(--t2);'>"+actCount+" acts</div>"
      +"<div style='font-size:11px;color:var(--t2);'>"+arcCount+" arcs</div>"
      +"<div style='font-size:11px;color:var(--t2);'>"+npcCount+" NPCs</div>"
      +"<div style='font-size:11px;color:var(--t2);'>"+locCount+" locations</div>"
      +(voiceNm?"<div style='font-size:11px;color:var(--acc);'>&#9997; "+escHtml(voiceNm)+"</div>":"")
      +"</div>"
      +(actsHtml?"<div style='margin-bottom:14px;border:1px solid var(--brd);border-radius:var(--r);padding:12px;background:var(--bg2);'><div id='bp-acts-toggle' style='font-size:10px;text-transform:uppercase;letter-spacing:.07em;color:var(--t2);cursor:pointer;user-select:none;'><span id='bp-acts-arrow' style='display:inline-block;transition:transform .2s;transform:rotate(-90deg);'>&#9662;</span> Story arcs <span style='font-size:10px;color:var(--t2);font-style:italic;'>(contains spoilers)</span></div><div id='bp-acts-body' style='display:none;margin-top:8px;'>"+actsHtml+"</div></div>":"")
      +(npcHtml?"<div style='margin-bottom:14px;border:1px solid var(--brd);border-radius:var(--r);padding:12px;background:var(--bg2);'><div id='bp-npc-toggle' style='font-size:10px;text-transform:uppercase;letter-spacing:.07em;color:var(--t2);cursor:pointer;user-select:none;'><span id='bp-npc-arrow' style='display:inline-block;transition:transform .2s;transform:rotate(-90deg);'>&#9662;</span> Key NPCs <span style='font-size:10px;color:var(--t2);font-style:italic;'>(contains spoilers)</span></div><div id='bp-npc-body' style='display:none;margin-top:8px;'>"+npcHtml+"</div></div>":"")
      +"<div style='display:flex;gap:10px;'>"
      +"<button id='bp-use' style='flex:1;padding:11px;font-size:13px;font-family:var(--font);background:var(--acc);color:var(--on-acc);border:none;border-radius:var(--r);cursor:pointer;font-weight:bold;'>Use this blueprint</button>"
      +"<button id='bp-back' style='padding:11px 18px;font-size:13px;font-family:var(--font);background:none;border:1px solid var(--brd2);color:var(--t2);border-radius:var(--r);cursor:pointer;'>Back</button>"
      +"</div>";
    document.getElementById("bp-back").addEventListener("click",render);
    document.getElementById("bp-use").addEventListener("click",function(){modal.remove();_applyBlueprint(bp);});
    var actsToggle=document.getElementById("bp-acts-toggle"),npcToggle=document.getElementById("bp-npc-toggle");
    if(actsToggle)actsToggle.addEventListener("click",function(){var b=document.getElementById("bp-acts-body"),a=document.getElementById("bp-acts-arrow");var open=b.style.display==="none";b.style.display=open?"block":"none";a.style.transform=open?"rotate(0deg)":"rotate(-90deg)";});
    if(npcToggle)npcToggle.addEventListener("click",function(){var b=document.getElementById("bp-npc-body"),a=document.getElementById("bp-npc-arrow");var open=b.style.display==="none";b.style.display=open?"block":"none";a.style.transform=open?"rotate(0deg)":"rotate(-90deg)";});
  }
  function renderLocal(){
    var body=document.getElementById("bp-body");if(!body)return;
    body.innerHTML="<div style='text-align:center;padding:16px 0;'>"
      +"<div style='font-size:12px;color:var(--t2);margin-bottom:16px;'>Import a .blueprint file from your device.</div>"
      +"<label style='display:inline-block;padding:9px 22px;font-size:13px;font-family:var(--font);border:1px solid var(--brd2);border-radius:var(--r);color:var(--t1);cursor:pointer;background:var(--bg2);' onmouseover='this.style.borderColor=\"var(--acc)\";this.style.color=\"var(--acc)\"' onmouseout='this.style.borderColor=\"var(--brd2)\";this.style.color=\"var(--t1)\"'>"
      +"<input type='file' id='bp-file-inp' accept='.blueprint,.campaign' style='display:none;'/> Import from file (.blueprint)&hellip;</label>"
      +"</div>";
    document.getElementById("bp-file-inp").addEventListener("change",function(ev){
      var file=ev.target.files[0];if(!file)return;
      var reader=new FileReader();
      reader.onload=function(re){
        try{
          var bp=normalizeBlueprint(JSON.parse(re.target.result)); // §5.1 — legacy format/tone repaired before validate/preview
          var err=validateBlueprint(bp);
          if(err){showToast("Invalid blueprint: "+err);return;}
          if(storageAdapter.isServerMode()){
            storageAdapter.saveBlueprintToLibrary(bp,function(saveErr){if(!saveErr)showToast("Blueprint saved to your blueprint library.");});
          }
          showPreview(bp);
        }catch(err2){showToast("Failed to read blueprint: "+err2.message);}
      };
      reader.readAsText(file);ev.target.value="";
    });
  }
  function renderLibrary(){
    var body=document.getElementById("bp-body");if(!body)return;
    if(!connected){body.innerHTML="<div style='font-size:11px;color:var(--t2);font-style:italic;padding:16px 0;text-align:center;'>Connect to server (File &#9656; Admin &#9656; Connect) to browse your blueprint library.</div>";return;}
    body.innerHTML="<div style='font-size:11px;color:var(--t2);padding:16px 0;text-align:center;'>Loading…</div>";
    storageAdapter.listBlueprintLibrary(function(err,list){
      var body2=document.getElementById("bp-body");if(!body2)return;
      if(err||!list){body2.innerHTML="<div style='font-size:11px;color:var(--t2);font-style:italic;padding:16px 0;text-align:center;'>Could not load blueprint library.</div>";return;}
      if(!list.length){body2.innerHTML="<div style='font-size:11px;color:var(--t2);font-style:italic;padding:16px 0;text-align:center;'>No blueprints saved yet. Export one from an active game or use the Local tab to import a .blueprint file.</div>";return;}
      var html="<div style='display:flex;flex-direction:column;gap:8px;'>",bi;
      for(bi=0;bi<list.length;bi++){
        var item=list[bi],bp2=item.blueprint||{};
        var actCount2=bp2.acts?bp2.acts.length:0,npcCount2=bp2.npcs?bp2.npcs.length:0;
        html+="<div style='display:flex;align-items:center;border:1px solid var(--brd);border-radius:var(--r);background:var(--bg2);' onmouseover='this.style.borderColor=\"var(--acc)\"' onmouseout='this.style.borderColor=\"var(--brd)\"'>"
          +"<div data-bpidx='"+bi+"' style='flex:1;padding:10px 12px;cursor:pointer;'>"
          +"<div style='font-size:13px;color:var(--t0);font-weight:bold;margin-bottom:2px;'>"+escHtml(item.name)+"</div>"
          +"<div style='font-size:11px;color:var(--t2);'>"+actCount2+" acts &nbsp;·&nbsp; "+npcCount2+" NPCs &nbsp;·&nbsp; saved "+(item.updatedAt?new Date(item.updatedAt).toLocaleDateString():"")+"</div>"
          +"</div>"
          +"<button data-bpdel='"+escHtml(item.slug)+"' data-bpname='"+escHtml(item.name)+"' title='Delete blueprint' style='flex-shrink:0;padding:10px 14px;background:none;border:none;border-left:1px solid var(--brd);color:var(--t2);cursor:pointer;font-size:16px;border-radius:0 var(--r) var(--r) 0;' onmouseover='this.style.color=\"var(--dng)\";this.style.background=\"var(--dng-faint)\"' onmouseout='this.style.color=\"var(--t2)\";this.style.background=\"none\"'>&#215;</button>"
          +"</div>";
      }
      html+="</div>";
      body2.innerHTML=html;
      Array.prototype.forEach.call(body2.querySelectorAll("[data-bpidx]"),function(el){
        el.addEventListener("click",function(){
          var idx=parseInt(el.getAttribute("data-bpidx"),10);
          showPreview(normalizeBlueprint(list[idx].blueprint)); // §5.1 — cloud blobs may predate the canonical schema
        });
      });
      Array.prototype.forEach.call(body2.querySelectorAll("[data-bpdel]"),function(btn){
        btn.addEventListener("click",function(e){
          e.stopPropagation();
          var slug=btn.getAttribute("data-bpdel"),name=btn.getAttribute("data-bpname");
          if(!confirm("Delete \""+name+"\" from your blueprint library?"))return;
          storageAdapter.deleteBlueprintFromLibrary(slug,function(err){
            if(err){showToast("Delete failed: "+err);return;}
            showToast("Blueprint deleted.");
            renderLibrary();
          });
        });
      });
    });
  }
  function render(){
    var seg=document.getElementById("bp-seg");
    if(seg){seg.innerHTML=segBtn("&#9729; Blueprint Library","library","left")+segBtn("Local","local","right");wireSegs();}
    if(mode==="library")renderLibrary();else renderLocal();
  }
  function wireSegs(){
    var seg=document.getElementById("bp-seg");if(!seg)return;
    Array.prototype.forEach.call(seg.querySelectorAll("button"),function(sb){
      sb.addEventListener("click",function(){mode=sb.getAttribute("data-seg");render();});
    });
  }
  wireSegs();
  render();
}
// ── Shared character-sheet helpers ────────────────────────────────────────────
function csSec(title,body){return'<div class="cs-sec"><div class="cs-sec-hd cs-sec-tog" style="cursor:pointer;display:flex;justify-content:space-between;align-items:center;">'+title+'<span class="cs-tog-arr" style="font-size:10px;color:var(--t2);flex-shrink:0;margin-left:8px;">&#9654;</span></div><div class="cs-sec-body" style="display:none;">'+body+'</div></div>';}
function csKv(k,v){return'<div class="cs-kv"><span class="cs-k">'+k+'</span><span class="cs-v">'+v+'</span></div>';}
function csInitials(name){return(name||"?").split(" ").map(function(w){return w[0]||"";}).join("").toUpperCase().slice(0,2)||"?";}
function csHeroHeader(c){
  var genderLbl=c.gender==="F"?"Female":c.gender==="NB"?"Non-binary":"Male";
  var subnm=c.subraceNm?c.subraceNm+" ":"";
  var clsLine=subnm+(c.ancestry||"")+" "+(c.cls||"")+(c.archetypeNm?" ["+c.archetypeNm+"]":"");
  var lvl=c.level||1,nextXP=lvl<10?XP_LEVELS[lvl]:"max",prevXP=XP_LEVELS[lvl-1]||0;
  var xpPct=lvl>=10?100:Math.max(0,Math.min(100,Math.round((((c.xp||0)-prevXP)/Math.max(1,nextXP-prevXP))*100)));// low clamp: xp below the level floor rendered width:-N% — invalid CSS, dropped, div defaulted to FULL (the Morwen full-bar lie)
  return {genderLbl:genderLbl,clsLine:clsLine,lvl:lvl,nextXP:nextXP,xpPct:xpPct};
}
function csSheetSections(c){
  var i;
  var statHtml="<div class='cs-stat-grid'>";
  for(i=0;i<STATS.length;i++){var s=STATS[i],v=(c.stats&&c.stats[s])||"—";statHtml+="<div class='cs-stat'><div class='cs-sn'>"+s+"</div><div class='cs-sv'>"+v+"</div><div class='cs-sm'>"+(c.stats&&c.stats[s]?smod(c.stats[s]):"")+"</div></div>";}
  statHtml+="</div>";
  var earnedSkills=[],si2;
  if(c.skills){for(si2=0;si2<SKILLS.length;si2++){var skl=SKILLS[si2],succ=(typeof c.skills[skl.id]==="number")?c.skills[skl.id]:0;if(succ>0)earnedSkills.push(skl.label+" ("+SKILL_LEVELS[skillLevel(succ)]+")");}  }
  var skillHtml=earnedSkills.length?'<div class="cs-v">'+earnedSkills.join(", ")+"</div>":'<span class="cs-none">None yet</span>';
  var condHtml;
  if(c.conditions&&c.conditions.length){condHtml="<div class='cs-list'>";for(i=0;i<c.conditions.length;i++)condHtml+='<div class="cs-list-row"><span style="color:var(--hp)">'+c.conditions[i].name+'</span><span class="cs-dim"> — '+c.conditions[i].duration+'</span></div>';condHtml+="</div>";}else condHtml='<span class="cs-none">None</span>';
  var relHtml;
  if(c.relationships&&c.relationships.length){relHtml="<div class='cs-list'>";for(i=0;i<c.relationships.length;i++)relHtml+='<div class="cs-list-row"><span style="color:var(--acc)">'+c.relationships[i].entity+'</span><span class="cs-dim"> — '+c.relationships[i].descriptor+'</span></div>';relHtml+="</div>";}else relHtml='<span class="cs-none">None</span>';
  var langHtml,langParts=[];
  if(c.languages&&c.languages.length){for(i=0;i<c.languages.length;i++){var lang=c.languages[i];langParts.push(lang.broken?'<span style="color:var(--warn)">'+lang.name+' (broken)</span>':lang.name);}langHtml='<div class="cs-v">'+langParts.join(", ")+"</div>";}else langHtml='<span class="cs-none">Common</span>';
  var saveHtml="";
  if(c.saveModifiers&&c.saveModifiers.length){saveHtml="<div class='cs-list'>";for(i=0;i<c.saveModifiers.length;i++){var sm=c.saveModifiers[i],sv=sm.amount>=0?"+"+sm.amount:""+sm.amount;saveHtml+='<div class="cs-list-row"><span>'+sv+' vs '+sm.type+'</span><span class="cs-dim"> ['+sm.source+']</span></div>';}saveHtml+="</div>";}
  var beatsHtml="";
  if(c.storyBeats&&c.storyBeats.length){for(i=c.storyBeats.length-1;i>=0;i--)beatsHtml+='<div class="cs-beat"><span class="cs-beat-turn">Turn '+c.storyBeats[i].turn+'</span>'+c.storyBeats[i].text+'</div>';}
  var abilHtml="";
  if(c.abilities&&c.abilities.length){for(i=0;i<c.abilities.length;i++){abilHtml+='<div class="cs-abil"><span class="cs-abil-nm">'+c.abilities[i].nm+'</span><span class="cs-abil-ds">'+c.abilities[i].ds+'</span></div>';}}else abilHtml='<span class="cs-none">None yet</span>';
  var spellHtml="";
  if(c.spells&&c.spells.length){var spParts=[];for(i=0;i<c.spells.length;i++){var sp2=c.spells[i],stag=sp2.lvl===0?"C":String(sp2.lvl);var nm2=sp2.nm.indexOf("(")>=0?sp2.nm.slice(0,sp2.nm.indexOf("(")).trim():sp2.nm;var spTxt="["+stag+"] "+nm2;spParts.push(sp2.used?'<span style="color:var(--t2);text-decoration:line-through">'+spTxt+'</span>':spTxt);}spellHtml='<div class="cs-v" style="line-height:1.9">'+spParts.join(", ")+"</div>";}
  var invHtml;
  if(c.inventory&&c.inventory.length){var invParts=[],ivi;for(ivi=0;ivi<c.inventory.length;ivi++)invParts.push(invItemHtml(c.inventory[ivi]));invHtml='<div class="cs-v" style="line-height:1.9">'+invParts.join(", ")+"</div>";}
  else invHtml='<span class="cs-none">Empty</span>';
  var charKv=(c.appear?csKv("Appearance",c.appear):"")+(c.mark?csKv("Distinguishing Mark",c.mark):"")+(c.trait?csKv("Trait",c.trait):"")+(c.flaw?csKv("Flaw",c.flaw):"")+(c.motivation?csKv("Motivation",c.motivation):"")+(c.backstory?csKv("Backstory",c.backstory):"");
  return csSec("Attributes",statHtml)+csSec("Character",charKv)+csSec("Conditions",condHtml)+csSec("Relationships",relHtml)+csSec("Languages",langHtml)+(c.saveModifiers&&c.saveModifiers.length?csSec("Save Modifiers",saveHtml):"")+csSec("Skills",skillHtml)+(c.storyBeats&&c.storyBeats.length?csSec("Story Beats",beatsHtml):"")+csSec("Abilities",abilHtml)+(c.spells&&c.spells.length?csSec("Spells",spellHtml):"")+csSec("Inventory",invHtml);
}
function csWireToggles(modal){var hdrs=modal.querySelectorAll(".cs-sec-tog"),hi;for(hi=0;hi<hdrs.length;hi++){hdrs[hi].addEventListener("click",function(){var body=this.parentNode.querySelector(".cs-sec-body"),arr=this.querySelector(".cs-tog-arr"),open=body.style.display!=="none";body.style.display=open?"none":"block";arr.style.transform=open?"":"rotate(90deg)";});}}

function showCharSheet(){
  if(!worldState)return;
  var ex=document.getElementById("cs-modal");if(ex)ex.remove();
  var c=worldState.character;

  var initials=csInitials(c.name);
  var hdr=csHeroHeader(c);

  // ── compose ───────────────────────────────────────────────────────────────
  var modal=document.createElement("div");modal.id="cs-modal";
  modal.style.cssText="position:fixed;inset:0;background:rgba(0,0,0,.88);z-index:300;display:flex;align-items:flex-start;justify-content:center;padding:20px;overflow-y:auto;-webkit-overflow-scrolling:touch;";

  modal.innerHTML="<div style='background:var(--modal-bg);border:1px solid var(--acc);border-radius:12px;padding:24px;max-width:560px;width:100%;margin:20px 0 40px;'>"
    +"<div style='display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;'><button id='cs-export-btn' style='font-size:11px;font-family:var(--font);padding:4px 10px;border:1px solid var(--brd);border-radius:var(--r);background:var(--bg2);color:var(--t1);cursor:pointer;'>Export Character</button><div style='display:flex;gap:6px;align-items:center;'><button id='cs-sync-btn' title='Ask GM to update relationships, conditions and quests' style='font-size:11px;font-family:var(--font);padding:4px 10px;border:1px solid var(--brd);border-radius:var(--r);background:var(--bg2);color:var(--t1);cursor:pointer;'>&#8635; Sync</button><button id='cs-x' style='background:none;border:none;color:var(--t2);font-size:24px;cursor:pointer;padding:0 4px;line-height:1;'>&#215;</button></div></div>"

    +"<div class='cs-hero'>"
    +"<div style='position:relative;flex-shrink:0;'>"
    +"<div class='cs-avatar' id='cs-avatar-btn' title='Drag to reframe · Click to edit'>"+(c.portrait?"<img id='cs-portrait-img' src='"+c.portrait+"' alt='"+c.name+"' style='width:100%;height:100%;object-fit:cover;display:block;'>":initials)+"<div class='cs-avatar-overlay'>&#129718;</div></div>"
    +"</div>"
    +"<div class='cs-hero-info'>"
    +"<div class='cs-hero-name'>"+c.name+"</div>"
    +"<div class='cs-hero-cls'>"+hdr.clsLine+"</div>"
    +"<div class='cs-hero-sub'>"+hdr.genderLbl+" · "+c.age+(c.deity?" · "+c.deity:"")+"</div>"
    +"<div style='margin-top:8px;font-size:13px;'>"
    +"<span style='color:var(--acc)'>Lv "+hdr.lvl+"</span>"
    +" &nbsp;·&nbsp; <span style='color:var(--hp)'>"+c.hp+"/"+c.maxHp+" HP</span>"
    +" &nbsp;·&nbsp; <span style='color:var(--gold)'>"+c.gold+" gp</span>"
    +" &nbsp;·&nbsp; <span style='color:var(--t2)'>"+(c.actualAlignment||c.statedAlignment||"Neutral")+"</span>"
    +"</div>"
    +"<div class='cs-xp-wrap'>"
    +"<div class='cs-xp-lbl'><span>"+c.xp+" XP</span><span>"+(hdr.lvl<10?"Next: "+hdr.nextXP+" XP":"Max level")+"</span></div>"
    +"<div class='cs-xp-bar'><div class='cs-xp-fill' style='width:"+hdr.xpPct+"%;'></div></div>"
    +"</div>"
    +"</div></div>"

    +csSheetSections(c)

    +"</div>";

  document.body.appendChild(modal);
  document.getElementById("cs-x").addEventListener("click",function(){modal.remove();});
  document.getElementById("cs-export-btn").addEventListener("click",function(){_showCharExportOptions(c);});
  document.getElementById("cs-sync-btn").addEventListener("click",function(){if(typeof syncCharSheet==="function")syncCharSheet();});
  modal.addEventListener("click",function(e){if(e.target===modal)modal.remove();});
  csWireToggles(modal);

  // ── portrait handlers ─────────────────────────────────────────────────────
  function refreshAvatar(){
    var av=document.getElementById("cs-avatar-btn");if(!av)return;
    var c2=worldState.character;
    av.innerHTML=(c2.portrait?"<img id='cs-portrait-img' src='"+c2.portrait+"' alt='"+c2.name+"' style='width:100%;height:100%;object-fit:cover;display:block;'>":initials)+"<div class='cs-avatar-overlay'>&#129718;</div>";
    wireAvatarDrag();
  }
  function wireAvatarDrag(){
    var img=document.getElementById("cs-portrait-img");if(!img)return;
    wirePortraitDrag(img,
      function(){return worldState.character.portraitOffset||{x:0.5,y:0.5,zoom:1};},
      function(x,y,zoom){worldState.character.portraitOffset={x:x,y:y,zoom:zoom};saveAll();});
  }
  wireAvatarDrag();
  document.getElementById("cs-avatar-btn").addEventListener("click",function(){
    var img=document.getElementById("cs-portrait-img");
    if(img&&img._wasDragged&&img._wasDragged())return;
    showPortraitModal(refreshAvatar);
  });
}
async function showPortraitModal(refreshFn,opts){
  var ex=document.getElementById("portrait-modal");if(ex)ex.remove();
  // opts = {getPortrait, setPortrait, getOffset, setOffset, subject} — defaults to player character
  var getPort=opts&&opts.getPortrait?opts.getPortrait:function(){return worldState.character.portrait;};
  var setPort=opts&&opts.setPortrait?opts.setPortrait:function(url){worldState.character.portrait=url;storageAdapter.markPortraitDirty();saveAll();};/* mark dirty on removal too so it propagates (E28) */
  var getOff=opts&&opts.getOffset?opts.getOffset:function(){return worldState.character.portraitOffset||{x:0.5,y:0.5,zoom:1};};
  var setOff=opts&&opts.setOffset?opts.setOffset:function(x,y,zoom){worldState.character.portraitOffset={x:x,y:y,zoom:zoom};saveAll();};
  var c=opts&&opts.subject?opts.subject:worldState.character;
  var genderWord=!c.gender||c.gender==="NB"?"androgynous":c.gender==="F"?"female":"male";
  var pmRefSrc=getPort()||null;
  var hasPortrait=!!(getPort());

  function buildCharDesc(){
    var d=c.name;
    if(c.age||c.ancestry||c.cls)d+=", a "+genderWord+(c.age?" "+c.age:"")+(c.ancestry?" "+c.ancestry:"")+(c.cls?" "+c.cls:"")+(c.archetypeNm?" ["+c.archetypeNm+"]":"");
    if(c.appear)d+=", "+c.appear;
    if(c.mark)d+=", "+c.mark;
    if(c.inventory&&c.inventory.length)d+=". Visible wardrobe/gear: "+c.inventory.join(", ");
    return d;
  }

  var modal=document.createElement("div");modal.id="portrait-modal";
  modal.style.cssText="position:fixed;inset:0;background:rgba(0,0,0,.88);z-index:400;overflow-y:auto;display:flex;align-items:flex-start;justify-content:center;padding:20px;";
  var IS="width:100%;padding:9px 12px;font-size:13px;font-family:var(--font);background:var(--bg2);border:1px solid var(--brd2);border-radius:var(--r);color:var(--t0);margin-bottom:10px;box-sizing:border-box;";
  var BA="display:block;width:100%;padding:10px 14px;font-size:13px;font-family:var(--font);border-radius:var(--r);cursor:pointer;text-align:left;box-sizing:border-box;background:var(--acc);border:none;color:var(--on-acc);font-weight:bold;";
  function div(lbl){return "<div style='display:flex;align-items:center;gap:8px;margin:14px 0;'><div style='flex:1;height:1px;background:var(--brd);'></div><span style='font-size:11px;color:var(--t2);'>"+lbl+"</span><div style='flex:1;height:1px;background:var(--brd);'></div></div>";}
  function lbl(t){return "<div style='font-size:10px;text-transform:uppercase;letter-spacing:.07em;color:var(--t2);margin-bottom:6px;'>"+t+"</div>";}


  modal.innerHTML="<div style='background:var(--modal-bg);border:1px solid var(--acc);border-radius:12px;padding:24px;max-width:420px;width:100%;margin:20px 0 40px;'>"
    // Header
    +"<div style='display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;'>"
    +"<span style='font-size:15px;color:var(--t0);font-weight:bold;'>&#129718; Edit Portrait</span>"
    +"<button id='pm-x' style='background:none;border:none;color:var(--t2);font-size:20px;cursor:pointer;line-height:1;'>&#215;</button>"
    +"</div>"
    // ── Current portrait preview ───────────────────────────────────────────
    +(hasPortrait?"<div style='text-align:center;margin-bottom:8px;'><div style='width:90px;height:135px;border-radius:50%;border:2px solid var(--acc);display:inline-block;overflow:hidden;position:relative;'><img id='pm-preview-img' src='"+getPort()+"' style='width:100%;height:100%;object-fit:cover;display:block;cursor:grab;'></div></div>"
    +"<div style='text-align:center;margin-bottom:18px;font-size:11px;color:var(--t2);'>drag to reframe &middot; scroll / pinch to zoom &nbsp; <button id='pm-zoom-out' style='font-family:var(--font);font-size:14px;line-height:1;padding:2px 10px;background:var(--bg3);border:1px solid var(--brd2);border-radius:4px;color:var(--t0);cursor:pointer;'>&minus;</button> <button id='pm-zoom-in' style='font-family:var(--font);font-size:14px;line-height:1;padding:2px 9px;background:var(--bg3);border:1px solid var(--brd2);border-radius:4px;color:var(--t0);cursor:pointer;'>+</button></div>":"")
    // ── 1. Upload / Save / Remove (same row) ──────────────────────────────
    +"<div style='display:flex;gap:6px;margin-bottom:4px;'>"
    +"<button id='pm-upload' style='flex:1;padding:10px 4px;font-size:12px;font-family:var(--font);border-radius:var(--r);cursor:pointer;text-align:center;box-sizing:border-box;background:var(--acc);border:none;color:var(--on-acc);font-weight:bold;'>&#8593; Upload</button>"
    +(hasPortrait?"<button id='pm-save-portrait' style='flex:1;padding:10px 4px;font-size:12px;font-family:var(--font);border-radius:var(--r);cursor:pointer;text-align:center;box-sizing:border-box;background:var(--bg2);border:1px solid var(--brd);color:var(--t1);' title='Download a copy of this image to a file'>&#8595; Download</button>":"")
    +(hasPortrait?"<button id='pm-remove-portrait' style='flex:1;padding:10px 4px;font-size:12px;font-family:var(--font);border-radius:var(--r);cursor:pointer;text-align:center;box-sizing:border-box;background:var(--bg2);border:1px solid var(--brd);color:var(--t1);'>&#10005; Remove</button>":"")
    +"</div>"
    +"<input type='file' id='pm-file' accept='image/*' style='display:none;'>"
    // ── Describe appearance from the image (vision; reverse of Generate) ────
    +(hasPortrait?"<button id='pm-describe' style='display:block;width:100%;margin-top:6px;padding:9px;font-size:12px;font-family:var(--font);border-radius:var(--r);cursor:pointer;text-align:center;box-sizing:border-box;background:var(--bg2);border:1px solid var(--brd);color:var(--t1);' title='Use Claude vision to read this image into the appearance field'>&#128269; Describe appearance from image</button>":"")
    // ── 2. Generate from scratch ───────────────────────────────────────────
    +div("or generate from scratch")
    +lbl("Additional details (optional):")
    +"<input type='text' id='pm-details-gen' placeholder='e.g. wearing a hood, battle-scarred, torch light' style='"+IS+"'/>"
    +"<button id='pm-gen' style='"+BA+"'>&#129718; Generate from Character Sheet</button>"
    // ── 3. Update current portrait (only when one exists) ─────────────────
    +(hasPortrait?div("update current portrait"):"")
    +(hasPortrait?lbl("Additional details (optional):"):"")
    +(hasPortrait?"<input type='text' id='pm-details-upd' placeholder='e.g. now wearing plate armour, older, battle-worn' style='"+IS+"'/>":"")
    +(hasPortrait?"<button id='pm-upd' style='"+BA+"'>&#10024; Update from Character Sheet</button>":"")
    // ── Result ─────────────────────────────────────────────────────────────
    +"<div id='pm-status' style='margin-top:14px;'></div>"
    +"</div>";

  document.body.appendChild(modal);

  function pmClose(){modal.remove();}
  document.getElementById("pm-x").addEventListener("click",pmClose);
  modal.addEventListener("click",function(e){if(e.target===modal)pmClose();});
  var pmImg=document.getElementById("pm-preview-img");
  if(pmImg)wirePortraitDrag(pmImg,getOff,function(x,y,zoom){setOff(x,y,zoom);if(refreshFn)refreshFn();});
  if(document.getElementById("pm-zoom-in"))document.getElementById("pm-zoom-in").addEventListener("click",function(){if(pmImg&&pmImg._zoomBy)pmImg._zoomBy(1.2);});
  if(document.getElementById("pm-zoom-out"))document.getElementById("pm-zoom-out").addEventListener("click",function(){if(pmImg&&pmImg._zoomBy)pmImg._zoomBy(0.83);});
  if(document.getElementById("pm-save-portrait")){
    document.getElementById("pm-save-portrait").addEventListener("click",function(){
      var purl=getPort();if(!purl)return;
      var fname=buildFilename("portrait");
      fetch(purl).then(function(r){return r.blob();}).then(function(blob){exportToFolder("portrait",blob,fname);}).catch(function(){var a=document.createElement("a");a.href=purl;a.download=fname;a.click();});
    });
  }
  if(document.getElementById("pm-remove-portrait")){
    document.getElementById("pm-remove-portrait").addEventListener("click",function(){
      setPort(null);if(refreshFn)refreshFn();pmClose();
    });
  }

  // ── Shared: show image result ────────────────────────────────────────────
  function showResult(imgUrl,isImg2Img,genPrompt){
    var status=document.getElementById("pm-status");
    status.innerHTML="";
    var prev=document.createElement("div");
    prev.style.cssText="border:1px solid var(--acc);border-radius:var(--r);padding:12px;margin-top:8px;background:var(--bg2);";
    var hd=document.createElement("div");hd.textContent="New image — tap Apply to set it";hd.style.cssText="font-size:11px;color:var(--acc);text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px;text-align:center;";
    var img=document.createElement("img");img.src=imgUrl;img.style.cssText="width:100%;max-height:280px;object-fit:contain;border-radius:var(--r);display:block;margin-bottom:10px;";
    var BS2="padding:8px 12px;font-family:var(--font);font-size:12px;background:var(--bg3);border:1px solid var(--brd2);color:var(--t1);border-radius:var(--r);cursor:pointer;margin-right:5px;margin-bottom:6px;";
    var useBtn=document.createElement("button");useBtn.textContent="✓ Apply";useBtn.style.cssText="display:block;width:100%;padding:12px;font-family:var(--font);font-size:15px;font-weight:bold;background:var(--acc);border:none;color:var(--on-acc);border-radius:var(--r);cursor:pointer;margin-bottom:8px;";
    var editBtn=document.createElement("button");editBtn.textContent="Edit Prompt";editBtn.style.cssText=BS2;
    var discardBtn=document.createElement("button");discardBtn.textContent="Discard";discardBtn.style.cssText=BS2;
    var btnRow=document.createElement("div");if(genPrompt)btnRow.appendChild(editBtn);btnRow.appendChild(discardBtn);
    var editArea=document.createElement("div");editArea.style.cssText="margin-top:8px;display:none;";
    var promptTA=document.createElement("textarea");promptTA.value=genPrompt||"";
    promptTA.style.cssText="width:100%;height:80px;padding:8px;font-size:12px;font-family:var(--font-mono);background:var(--bg2);border:1px solid var(--brd2);border-radius:var(--r);color:var(--t0);box-sizing:border-box;resize:vertical;margin-bottom:6px;";
    var regenBtn=document.createElement("button");regenBtn.textContent="Regenerate with this prompt";regenBtn.style.cssText="display:block;width:100%;padding:8px 12px;font-family:var(--font);font-size:12px;background:var(--acc);border:none;color:var(--on-acc);border-radius:var(--r);cursor:pointer;font-weight:bold;";
    editArea.appendChild(promptTA);editArea.appendChild(regenBtn);
    prev.appendChild(hd);prev.appendChild(img);prev.appendChild(useBtn);prev.appendChild(btnRow);prev.appendChild(editArea);
    status.appendChild(prev);
    try{status.scrollIntoView({behavior:"smooth",block:"center"});}catch(e){}
    useBtn.addEventListener("click",function(){
      useBtn.disabled=true;useBtn.textContent="Applying…";
      // Uploaded images are already a compressed data: URL — commit directly (no double-compress).
      // fal.ai results are http(s) URLs — fetch, then compress before storing.
      if(imgUrl.indexOf("data:")===0){setPort(imgUrl);if(refreshFn)refreshFn();pmClose();return;}
      fetch(imgUrl).then(function(r){return r.blob();}).then(function(blob){
        var fr=new FileReader();
        fr.onload=function(e2){compressPortrait(e2.target.result,function(compressed){setPort(compressed);if(refreshFn)refreshFn();pmClose();});};
        fr.readAsDataURL(blob);
      }).catch(function(){useBtn.disabled=false;useBtn.textContent="Apply";});
    });
    editBtn.addEventListener("click",function(){
      var open=editArea.style.display!=="none";
      editArea.style.display=open?"none":"block";
    });
    regenBtn.addEventListener("click",function(){runGenerateWithPrompt(isImg2Img,promptTA.value.trim());});
    discardBtn.addEventListener("click",function(){status.innerHTML="";});
  }

  // ── Describe appearance FROM the image (Claude vision; reverse of Generate) ──
  async function runDescribe(){
    var status=document.getElementById("pm-status");
    var src=getPort();if(!src)return;
    if(busy){status.innerHTML="<span style='font-size:12px;color:var(--t2);'>Game is busy — try again in a moment.</span>";return;}
    status.innerHTML="<span style='font-size:12px;color:var(--t2);font-style:italic;'>Reading the portrait&hellip;</span>";
    busy=true;
    try{
      var desc=await describePortraitImage(src,c.name);
      showDescribeResult(desc);
    }catch(err){status.innerHTML="<span style='font-size:12px;color:var(--red);'>"+(err.message||"Failed")+"</span>";}
    busy=false;
  }
  function showDescribeResult(desc){
    var status=document.getElementById("pm-status");status.innerHTML="";
    if(!desc){status.innerHTML="<span style='font-size:12px;color:var(--red);'>Empty description.</span>";return;}
    var box=document.createElement("div");box.style.cssText="border:1px solid var(--acc);border-radius:var(--r);padding:12px;margin-top:8px;background:var(--bg2);";
    var hd=document.createElement("div");hd.textContent="Appearance read from the portrait";hd.style.cssText="font-size:11px;color:var(--acc);text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px;";
    var p=document.createElement("div");p.textContent=desc;p.style.cssText="font-size:13px;color:var(--t0);line-height:1.5;margin-bottom:10px;font-family:var(--font);";
    var sec="padding:8px 12px;font-family:var(--font);font-size:12px;background:var(--bg3);border:1px solid var(--brd2);color:var(--t1);border-radius:var(--r);cursor:pointer;margin-right:6px;";
    var repl=document.createElement("button");repl.textContent=c.appear?"Replace appearance":"Use as appearance";repl.style.cssText="padding:9px 12px;font-family:var(--font);font-size:12px;font-weight:bold;background:var(--acc);border:none;color:var(--on-acc);border-radius:var(--r);cursor:pointer;margin-right:6px;";
    var app=document.createElement("button");app.textContent="Append";app.style.cssText=sec;
    var disc=document.createElement("button");disc.textContent="Discard";disc.style.cssText=sec;
    box.appendChild(hd);box.appendChild(p);box.appendChild(repl);if(c.appear)box.appendChild(app);box.appendChild(disc);
    status.appendChild(box);
    repl.addEventListener("click",function(){c.appear=desc;saveAll();status.innerHTML="";if(typeof showToast==="function")showToast("Appearance updated from portrait.");});
    app.addEventListener("click",function(){c.appear=(c.appear?c.appear+" ":"")+desc;saveAll();status.innerHTML="";if(typeof showToast==="function")showToast("Appended to appearance.");});
    disc.addEventListener("click",function(){status.innerHTML="";});
  }
  // ── Shared: generate / img2img ───────────────────────────────────────────
  async function runGenerate(isImg2Img,details){
    var status=document.getElementById("pm-status");
    if(!falKey){status.innerHTML="<span style='font-size:12px;color:var(--red);'>No fal.ai key — add one via File → fal.ai image key…</span>";return;}
    if(isImg2Img&&!pmRefSrc){status.innerHTML="<span style='font-size:12px;color:var(--red);'>Select a reference image first.</span>";return;}
    if(busy){status.innerHTML="<span style='font-size:12px;color:var(--t2);'>Game is busy — try again in a moment.</span>";return;}
    var charDesc=buildCharDesc();
    var promptReq=isImg2Img
      ?"Write an image generation prompt to update a fantasy character portrait using a reference photo. "
        +"Maintain the person's likeness from the reference but render them as: "+charDesc+". "
        +(details?"Player overrides — apply these exactly and let them supersede any conflicting character description: "+details+". ":"")
        +"Dark fantasy painterly style, dramatic lighting, upper body portrait. 2-3 sentences. Output ONLY the prompt."
      :"Write a detailed image generation prompt for a fantasy character portrait. "
        +(details?"Player overrides — apply these exactly and let them supersede any conflicting character description: "+details+". ":"")
        +"Base character description (use where not overridden): "+charDesc+". "
        +"Spell out hair, eyes, skin tone, clothing, and visible gear explicitly. "
        +"Style: dark fantasy portrait, upper body, detailed face, dramatic chiaroscuro lighting, painterly. 2-3 sentences. Output ONLY the prompt, no commentary, no tags.";
    status.innerHTML="<span style='font-size:12px;color:var(--t2);font-style:italic;'>Writing portrait prompt…</span>";
    busy=true;
    try{
      var prompt=await callGM(promptReq,"You are a portrait image prompt writer for a dark fantasy RPG. Output ONLY the image prompt. No narration, no game tags.",600);
      status.innerHTML="<span style='font-size:12px;color:var(--t2);font-style:italic;'>Generating portrait…</span>";
      var falRes,mdlCfg=RENDER_MODELS[0],mi;
      if(isImg2Img){
        falRes=await fetch("https://fal.run/fal-ai/flux/dev/image-to-image",{method:"POST",
          headers:{"Authorization":"Key "+falKey,"Content-Type":"application/json"},
          body:JSON.stringify({image_url:pmRefSrc,prompt:prompt,strength:0.75,num_inference_steps:28,num_images:1})});
      }else{
        for(mi=0;mi<RENDER_MODELS.length;mi++){if(RENDER_MODELS[mi].id===renderModel){mdlCfg=RENDER_MODELS[mi];break;}}
        falRes=await fetch("https://fal.run/"+mdlCfg.id,{method:"POST",
          headers:{"Authorization":"Key "+falKey,"Content-Type":"application/json"},
          body:JSON.stringify(portraitRenderBody(mdlCfg,prompt))});
      }
      if(!falRes.ok)throw new Error("fal.ai HTTP "+falRes.status);
      var falData=await falRes.json();
      if(!falData.images||!falData.images[0]||!falData.images[0].url)throw new Error("No image returned.");
      showResult(falData.images[0].url,isImg2Img,prompt);
    }catch(err){
      status.innerHTML="<span style='font-size:12px;color:var(--red);'>"+err.message+"</span>";
    }
    busy=false;
  }

  // ── Shared: regenerate with edited prompt (skips Claude step) ───────────
  async function runGenerateWithPrompt(isImg2Img,prompt){
    var status=document.getElementById("pm-status");
    if(!falKey||!prompt)return;
    if(isImg2Img&&!pmRefSrc){status.innerHTML="<span style='font-size:12px;color:var(--red);'>Select a reference image first.</span>";return;}
    if(busy){status.innerHTML="<span style='font-size:12px;color:var(--t2);'>Game is busy — try again in a moment.</span>";return;}
    status.innerHTML="<span style='font-size:12px;color:var(--t2);font-style:italic;'>Generating portrait…</span>";
    busy=true;
    try{
      var falRes,mdlCfg=RENDER_MODELS[0],mi;
      if(isImg2Img){
        falRes=await fetch("https://fal.run/fal-ai/flux/dev/image-to-image",{method:"POST",
          headers:{"Authorization":"Key "+falKey,"Content-Type":"application/json"},
          body:JSON.stringify({image_url:pmRefSrc,prompt:prompt,strength:0.75,num_inference_steps:28,num_images:1})});
      }else{
        for(mi=0;mi<RENDER_MODELS.length;mi++){if(RENDER_MODELS[mi].id===renderModel){mdlCfg=RENDER_MODELS[mi];break;}}
        falRes=await fetch("https://fal.run/"+mdlCfg.id,{method:"POST",
          headers:{"Authorization":"Key "+falKey,"Content-Type":"application/json"},
          body:JSON.stringify(portraitRenderBody(mdlCfg,prompt))});
      }
      if(!falRes.ok)throw new Error("fal.ai HTTP "+falRes.status);
      var falData=await falRes.json();
      if(!falData.images||!falData.images[0]||!falData.images[0].url)throw new Error("No image returned.");
      showResult(falData.images[0].url,isImg2Img,prompt);
    }catch(err){
      status.innerHTML="<span style='font-size:12px;color:var(--red);'>"+err.message+"</span>";
    }
    busy=false;
  }

  // ── 1. Upload ────────────────────────────────────────────────────────────
  document.getElementById("pm-upload").addEventListener("click",function(){document.getElementById("pm-file").click();});
  document.getElementById("pm-file").addEventListener("change",function(){
    var file=this.files[0];if(!file)return;
    var reader=new FileReader();
    // Preview the chosen image with an explicit Apply (no genPrompt → no "Edit Prompt"); nothing is
    // saved until Apply, so picking a file can't silently set or fail to set the portrait.
    reader.onload=function(e){compressPortrait(e.target.result,function(compressed){showResult(compressed,false,null);});};
    reader.readAsDataURL(file);this.value="";
  });

  // ── Describe appearance from image ───────────────────────────────────────
  if(document.getElementById("pm-describe"))document.getElementById("pm-describe").addEventListener("click",runDescribe);
  // ── 2. Generate ──────────────────────────────────────────────────────────
  document.getElementById("pm-gen").addEventListener("click",function(){
    runGenerate(false,document.getElementById("pm-details-gen").value.trim());
  });

  // ── 3. Update ────────────────────────────────────────────────────────────
  if(document.getElementById("pm-upd")){
    document.getElementById("pm-upd").addEventListener("click",function(){
      runGenerate(true,document.getElementById("pm-details-upd").value.trim());
    });
  }
}
async function generateNpcSheet(name,doneCb){
  if(!worldState)return;
  if(busy){showToast("Game is busy — try again in a moment.");return;}
  var wsNpc=null,i;for(i=0;i<worldState.npcs.length;i++){if(worldState.npcs[i].name===name){wsNpc=worldState.npcs[i];break;}}
  var memNpc=memory&&memory.npcs?memory.npcs[name]:null;
  if(!wsNpc){showToast("NPC not found.");return;}
  // Build context from all known data
  var ctx="NPC name: "+name+"\nStatus: "+(wsNpc.status||"unknown")+"\nRelation to player: "+(wsNpc.rel||"unknown")+"\n";
  if(wsNpc.pronouns)ctx+="Pronouns: "+wsNpc.pronouns+"\n";
  if(memNpc){
    if(memNpc.attitude)ctx+="Attitude/personality: "+memNpc.attitude+"\n";
    if(memNpc.knowledge&&memNpc.knowledge.length)ctx+="Known facts: "+memNpc.knowledge.join("; ")+"\n";
    if(memNpc.events&&memNpc.events.length){ctx+="Event log:\n";for(i=0;i<memNpc.events.length;i++)ctx+="  Turn "+memNpc.events[i].turn+": "+memNpc.events[i].note+"\n";}
  }
  var prompt="Generate a full D&D-style character sheet for a party member NPC. Use the game world, tone, and lore you already know. "
    +"Be creative but strictly consistent with all known facts listed below.\n\nKnown information:\n"+ctx+"\n"
    +"Output ONLY a single valid JSON object — no markdown, no code fences, no commentary:\n"
    +'{"gender":"M/F/NB","age":"age as string","appear":"full physical description","mark":"distinguishing mark or empty string","backstory":"2-3 sentence backstory consistent with known events",'
    +'"ancestry":"Human/Elf/Dwarf/Gnome/Tiefling/Hollow-Born/Half-Blood","subraceNm":"specific subrace name",'
    +'"cls":"Warrior/Rogue/Sorcerer/Ranger/Berserker/Paladin/Cleric/Druid","archetypeNm":"archetype or empty string",'
    +'"stats":{"STR":10,"DEX":10,"CON":10,"INT":10,"WIS":10,"CHA":10},'
    +'"hp":20,"maxHp":20,"gold":10,"level":1,"xp":0,'
    +'"trait":"personality trait","flaw":"character flaw","motivation":"core motivation",'
    +'"statedAlignment":"alignment string","actualAlignment":"alignment string","deity":"deity name or empty string",'
    +'"abilities":[{"nm":"ability name","ds":"description"}],'
    +'"spells":[{"nm":"spell name","lvl":1,"used":false}],'
    +'"inventory":["item1","item2"],'
    +'"languages":[{"name":"Common","broken":false}]}';
  busy=true;
  var removeLoader=showLoadingModal("Generating character sheet…");
  try{
    var resp=await callGM(prompt,"You are a D&D character sheet generator for a fantasy RPG. Output ONLY a single valid JSON object. No markdown fences, no extra text.",2000);
    var json=resp.trim().replace(/^```[a-z]*\n?/,"").replace(/\n?```$/,"").trim();
    var sheet=JSON.parse(json);
    sheet.name=name;
    if(!sheet.stats||typeof sheet.stats!=="object")sheet.stats={STR:10,DEX:10,CON:10,INT:10,WIS:10,CHA:10};
    ["STR","DEX","CON","INT","WIS","CHA"].forEach(function(s){sheet.stats[s]=parseInt(sheet.stats[s])||10;});
    sheet.hp=parseInt(sheet.hp)||8;sheet.maxHp=parseInt(sheet.maxHp)||8;
    sheet.level=parseInt(sheet.level)||1;sheet.gold=parseInt(sheet.gold)||0;sheet.xp=parseInt(sheet.xp)||0;
    if(!sheet.abilities)sheet.abilities=[];
    if(!sheet.spells)sheet.spells=[];
    if(!sheet.inventory)sheet.inventory=[];
    if(!sheet.languages)sheet.languages=[{name:"Common",broken:false}];
    if(!sheet.conditions)sheet.conditions=[];
    if(!sheet.relationships)sheet.relationships=[];
    if(!sheet.saveModifiers)sheet.saveModifiers=[];
    if(!sheet.storyBeats)sheet.storyBeats=[];
    if(!sheet.skills){sheet.skills={};var sk2;for(sk2=0;sk2<SKILLS.length;sk2++)sheet.skills[SKILLS[sk2].id]=0;}
    sheet.portrait=npcPortrait(wsNpc);wsNpc.portrait=null; // #3 dedupe: the sheet is the portrait's single home now
    sheet.partyMember=true;
    // Preserve earned progression on a REGENERATE (audit E59): the generation prompt uses a
    // level-1/xp-0/hp-20 template, so regenerating an advanced companion would silently reset them.
    // Carry the existing sheet's level/xp/hp/maxHp over the freshly-generated (default) values.
    var _prior=wsNpc.charSheet;
    if(_prior){if(typeof _prior.level==="number")sheet.level=_prior.level;if(typeof _prior.xp==="number")sheet.xp=_prior.xp;if(typeof _prior.hp==="number")sheet.hp=_prior.hp;if(typeof _prior.maxHp==="number")sheet.maxHp=_prior.maxHp;}
    // Seed the player↔NPC relationship from live tracking data
    if(!sheet.relationships)sheet.relationships=[];
    if(worldState&&worldState.character){
      var pcn=worldState.character.name,hasPC=false,rki;
      for(rki=0;rki<sheet.relationships.length;rki++){if(sheet.relationships[rki].entity===pcn){hasPC=true;break;}}
      if(!hasPC&&wsNpc.rel&&wsNpc.rel!=="unknown")sheet.relationships.push({entity:pcn,descriptor:wsNpc.rel});
    }
    wsNpc.charSheet=sheet;
    saveAll();removeLoader();showToast("Character sheet ready!");
    if(doneCb)doneCb();
  }catch(err){removeLoader();showToast("Sheet generation failed: "+err.message);}
  busy=false;
}
// Remove a companion from the party (manual "part ways"). Flips partyMember off and sets a
// transient worldState.recentlyLeft marker so buildSysPrompt tells the GM they've left — without
// it the GM keeps narrating them as present. Auto-cleared in sendAction after ~2 turns.
function partWaysWithCompanion(name){
  if(typeof busy!=="undefined"&&busy){showToast("Finish the current turn first.");return;}// audit E23
  if(!worldState||!worldState.npcs)return;
  var n=(typeof resolveNpcName==="function")?resolveNpcName(name):name,idx=-1,i;
  for(i=0;i<worldState.npcs.length;i++){if(worldState.npcs[i].name===n){idx=i;break;}}
  if(idx<0||!worldState.npcs[idx].partyMember)return;
  worldState.npcs[idx].partyMember=false;
  if(memory.npcs[n])memory.npcs[n].partyMember=false;
  if(!worldState.recentlyLeft)worldState.recentlyLeft=[];
  worldState.recentlyLeft.push({name:n,turn:worldState.turn||0});
  saveAll();syncUI();
  if(typeof showToast==="function")showToast(n+" has left the party.");
}
function showNpcSheet(name){
  if(!worldState)return;
  var ex=document.getElementById("npc-modal");if(ex)ex.remove();
  var wsNpc=null,i;for(i=0;i<worldState.npcs.length;i++){if(worldState.npcs[i].name===name){wsNpc=worldState.npcs[i];break;}}
  var memNpc=memory&&memory.npcs?memory.npcs[name]:null;
  if(!wsNpc&&!memNpc)return;
  var isParty=!!(wsNpc&&wsNpc.partyMember);
  var sheet=isParty&&wsNpc&&wsNpc.charSheet?wsNpc.charSheet:null;

  var initials=csInitials(name);
  var portrait=npcPortrait(wsNpc); // charSheet-first (#3 dedupe) — also fixes companions whose portrait arrived in the blob but not the separate store (known issue #6)

  // ── Avatar ────────────────────────────────────────────────────────────────
  var avatarHtml=isParty
    ?"<div class='cs-avatar' id='npc-avatar-btn' title='Drag to reframe · Click to edit'>"+(portrait?"<img id='npc-portrait-img' src='"+portrait+"' alt='"+name+"' style='width:100%;height:100%;object-fit:cover;display:block;'>":initials)+"<div class='cs-avatar-overlay'>&#129718;</div></div>"
    :"<div class='cs-avatar' style='font-size:16px;cursor:default;'>"+initials+"</div>";

  // ── Hero info block ───────────────────────────────────────────────────────
  var heroInfo;
  if(sheet){
    var gLbl=sheet.gender==="F"?"Female":sheet.gender==="NB"?"Non-binary":"Male";
    var clsLine=(sheet.subraceNm?sheet.subraceNm+" ":"")+(sheet.ancestry||"")+" "+(sheet.cls||"")+(sheet.archetypeNm?" ["+sheet.archetypeNm+"]":"");
    var lvl=sheet.level||1,nextXP=lvl<10?XP_LEVELS[lvl]:"max",prevXP=XP_LEVELS[lvl-1]||0;
    var xpPct=lvl>=10?100:Math.max(0,Math.min(100,Math.round((((sheet.xp||0)-prevXP)/Math.max(1,nextXP-prevXP))*100)));// (sheet.xp||0) guard so a missing xp doesn't render NaN → full bar (audit E62)
    var playBtn=isParty?"<button id='npc-play-btn' title='Switch to playing as "+escHtml(name)+"' style='background:none;border:none;color:var(--acc);cursor:pointer;font-size:16px;padding:0 4px;margin-left:6px;vertical-align:middle;line-height:1;opacity:0.8;' onmouseover='this.style.opacity=1' onmouseout='this.style.opacity=0.8'>▶</button>":"";
    heroInfo="<div style='display:flex;align-items:center;flex-wrap:wrap;gap:4px;'><span class='cs-hero-name'>"+name+"</span>"+playBtn+"</div>"
      +"<div class='cs-hero-cls'>"+clsLine+"</div>"
      +"<div class='cs-hero-sub'>"+gLbl+" · "+(sheet.age||"?")+(sheet.deity?" · "+sheet.deity:"")+"</div>"
      +"<div style='margin-top:8px;font-size:13px;'>"
      +"<span style='color:var(--acc)'>Lv "+lvl+"</span>"
      +" &nbsp;·&nbsp; <span style='color:var(--hp)'>"+(sheet.hp||0)+"/"+(sheet.maxHp||0)+" HP</span>"
      +" &nbsp;·&nbsp; <span style='color:var(--gold)'>"+(sheet.gold||0)+" gp</span>"
      +" &nbsp;·&nbsp; <span style='color:var(--t2)'>"+(sheet.actualAlignment||sheet.statedAlignment||"Neutral")+"</span></div>"
      +"<div class='cs-xp-wrap'><div class='cs-xp-lbl'><span>"+(sheet.xp||0)+" XP</span>"
      +"<span>"+(lvl<10?"Next: "+nextXP+" XP":"Max level")+"</span></div>"
      +"<div class='cs-xp-bar'><div class='cs-xp-fill' style='width:"+xpPct+"%;'></div></div></div>";
  }else{
    heroInfo="<div class='cs-hero-name'>"+name+"</div>"
      +(isParty?"<div class='cs-hero-cls'>Party Member</div>":"<div class='cs-hero-cls'>NPC</div>")
      +(wsNpc&&wsNpc.met?"<div class='cs-hero-sub'>First met: turn "+wsNpc.met+"</div>":"");
  }

  // ── Full character sheet sections (when charSheet exists) ─────────────────
  var sheetSections="";
  if(sheet){
    // Merge live player relationship in case sheet was generated before this fix
    var origRels=sheet.relationships;
    var sheetRels=sheet.relationships?sheet.relationships.slice():[];
    if(worldState&&worldState.character){var pcn2=worldState.character.name,hasPC2=false,rki2;for(rki2=0;rki2<sheetRels.length;rki2++){if(sheetRels[rki2].entity===pcn2){hasPC2=true;break;}}if(!hasPC2&&wsNpc&&wsNpc.rel&&wsNpc.rel!=="unknown")sheetRels.push({entity:pcn2,descriptor:wsNpc.rel});}
    sheet.relationships=sheetRels;
    sheetSections=csSheetSections(sheet);
    sheet.relationships=origRels;
  }

  // ── NPC sections (always shown) ───────────────────────────────────────────
  var statusBlock="";
  if(wsNpc){statusBlock+=csKv("Status",wsNpc.status||"—");if(wsNpc.pronouns)statusBlock+=csKv("Pronouns",wsNpc.pronouns);}
  var pcRel=null;var pcRels=worldState&&worldState.character&&worldState.character.relationships?worldState.character.relationships:[];
  for(var pri=0;pri<pcRels.length;pri++){if(pcRels[pri].entity===name){pcRel=pcRels[pri].descriptor;break;}}
  var relDisplay=pcRel||(wsNpc&&wsNpc.rel&&wsNpc.rel!=="unknown"?wsNpc.rel:null);
  if(relDisplay)statusBlock+=csKv("Relationship",relDisplay);
  var nfEntries=memory&&memory.npcGraph&&memory.npcGraph.npcFactions?memory.npcGraph.npcFactions[name]||[]:[];
  if(nfEntries.length)statusBlock+=csKv("Factions",nfEntries.map(function(e){return e.faction+(e.role?" ["+e.role+"]":"");}).join(", "));
  var npcLinks2="";if(memory&&memory.npcGraph&&memory.npcGraph.edges){var nlEdges=memory.npcGraph.edges;for(var nle=0;nle<nlEdges.length;nle++){var e2=nlEdges[nle];if(e2.a===name)npcLinks2+=(npcLinks2?", ":"")+e2.b+" ("+e2.rel+")";else if(e2.b===name)npcLinks2+=(npcLinks2?", ":"")+e2.a+" ("+e2.rel+")";}}
  if(npcLinks2)statusBlock+=csKv("Links",npcLinks2);
  var memBlock="";
  if(memNpc){if(memNpc.attitude)memBlock+=csKv("Attitude",memNpc.attitude);if(memNpc.knowledge&&memNpc.knowledge.length)memBlock+=csKv("Knows",memNpc.knowledge.join("; "));}
  var evHtml="";
  if(memNpc&&memNpc.events&&memNpc.events.length){for(i=memNpc.events.length-1;i>=0;i--)evHtml+='<div class="cs-beat"><span class="cs-beat-turn">Turn '+memNpc.events[i].turn+'</span>'+memNpc.events[i].note+'</div>';}
  var npcSections=csSec("Status",statusBlock||'<span class="cs-none">No data</span>')+(memBlock?csSec("Profile",memBlock):"")+(evHtml?csSec("History",evHtml):"");

  // ── Generate / Regenerate button ──────────────────────────────────────────
  var genBtnHtml=isParty?"<div style='margin-top:16px;'><button id='npc-gen-sheet' style='display:block;width:100%;padding:11px 14px;font-size:13px;font-family:var(--font);border-radius:var(--r);cursor:pointer;text-align:center;background:var(--acc);border:none;color:var(--on-acc);font-weight:bold;'>"+(sheet?"&#8635; Regenerate Sheet":"&#10022; Generate Character Sheet")+"</button></div>":"";
  var partWaysHtml=isParty?"<div style='margin-top:10px;'><button id='npc-part-btn' style='display:block;width:100%;padding:9px 14px;font-size:12px;font-family:var(--font);border-radius:var(--r);cursor:pointer;text-align:center;background:none;border:1px solid var(--brd2);color:var(--t2);' onmouseover=\"this.style.borderColor='#c04040';this.style.color='#c04040'\" onmouseout=\"this.style.borderColor='var(--brd2)';this.style.color='var(--t2)'\">Part ways with "+escHtml(name)+"</button></div>":"";

  var modal=document.createElement("div");modal.id="npc-modal";
  modal.style.cssText="position:fixed;inset:0;background:rgba(0,0,0,.88);z-index:300;display:flex;align-items:flex-start;justify-content:center;padding:20px;overflow-y:auto;-webkit-overflow-scrolling:touch;";
  modal.innerHTML="<div style='background:var(--modal-bg);border:1px solid var(--acc);border-radius:12px;padding:24px;max-width:560px;width:100%;margin:20px 0 40px;'>"
    +"<div style='display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;'>"+(isParty&&sheet?"<button id='npc-export-btn' style='font-size:11px;font-family:var(--font);padding:4px 10px;border:1px solid var(--brd);border-radius:var(--r);background:var(--bg2);color:var(--t1);cursor:pointer;'>Export Character</button>":"<span></span>")+"<button id='npc-x' style='background:none;border:none;color:var(--t2);font-size:24px;cursor:pointer;padding:0 4px;line-height:1;'>&#215;</button></div>"
    +"<div class='cs-hero'><div style='position:relative;flex-shrink:0;'>"+avatarHtml+"</div>"
    +"<div class='cs-hero-info'>"+heroInfo+"</div></div>"
    +sheetSections
    +(sheetSections?"<div style='height:1px;background:var(--brd);margin:18px 0;'></div>":"")
    +npcSections
    +genBtnHtml
    +partWaysHtml
    +"</div>";

  document.body.appendChild(modal);
  document.getElementById("npc-x").addEventListener("click",function(){modal.remove();});
  if(document.getElementById("npc-export-btn")){document.getElementById("npc-export-btn").addEventListener("click",function(){_showCharExportOptions(sheet);});}
  modal.addEventListener("click",function(e){if(e.target===modal)modal.remove();});
  csWireToggles(modal);

  // ── Play as this character ────────────────────────────────────────────────
  if(document.getElementById("npc-play-btn")){
    document.getElementById("npc-play-btn").addEventListener("click",function(){
      var confirm=document.createElement("div");
      confirm.style.cssText="position:fixed;inset:0;background:rgba(0,0,0,.88);z-index:500;display:flex;align-items:center;justify-content:center;padding:20px;";
      confirm.innerHTML="<div style='background:var(--modal-bg);border:1px solid var(--acc);border-radius:12px;padding:28px 24px;max-width:360px;width:100%;text-align:center;'>"
        +"<div style='font-size:16px;color:var(--t0);margin-bottom:8px;font-weight:bold;'>Switch character?</div>"
        +"<div style='font-size:13px;color:var(--t2);margin-bottom:24px;'>"+escHtml(name)+" will take the lead. "+escHtml(worldState.character.name)+" becomes a companion.</div>"
        +"<div style='display:flex;gap:10px;justify-content:center;'>"
        +"<button id='sw-ok' style='padding:10px 28px;font-size:13px;font-family:var(--font);background:var(--acc);color:var(--on-acc);border:none;border-radius:var(--r);cursor:pointer;font-weight:bold;'>Switch</button>"
        +"<button id='sw-cancel' style='padding:10px 20px;font-size:13px;font-family:var(--font);background:none;border:1px solid var(--brd2);color:var(--t2);border-radius:var(--r);cursor:pointer;'>Cancel</button>"
        +"</div></div>";
      document.body.appendChild(confirm);
      document.getElementById("sw-ok").addEventListener("click",function(){confirm.remove();modal.remove();_switchPlayerCharacter(name);});
      document.getElementById("sw-cancel").addEventListener("click",function(){confirm.remove();});
    });
  }
  // ── Generate / Regenerate ─────────────────────────────────────────────────
  if(document.getElementById("npc-gen-sheet")){
    document.getElementById("npc-gen-sheet").addEventListener("click",function(){
      modal.remove();generateNpcSheet(name,function(){showNpcSheet(name);});
    });
  }
  // ── Part ways (remove from party) ─────────────────────────────────────────
  if(document.getElementById("npc-part-btn")){
    document.getElementById("npc-part-btn").addEventListener("click",function(){
      var pc=document.createElement("div");
      pc.style.cssText="position:fixed;inset:0;background:rgba(0,0,0,.88);z-index:500;display:flex;align-items:center;justify-content:center;padding:20px;";
      pc.innerHTML="<div style='background:var(--modal-bg);border:1px solid var(--acc);border-radius:12px;padding:28px 24px;max-width:360px;width:100%;text-align:center;'>"
        +"<div style='font-size:16px;color:var(--t0);margin-bottom:8px;font-weight:bold;'>Part ways with "+escHtml(name)+"?</div>"
        +"<div style='font-size:13px;color:var(--t2);margin-bottom:24px;'>They leave the party and become an ordinary NPC. You can recruit them again later, and a party slot frees up.</div>"
        +"<div style='display:flex;gap:10px;justify-content:center;'>"
        +"<button id='pw-ok' style='padding:10px 24px;font-size:13px;font-family:var(--font);background:var(--dng);color:var(--on-dng);border:none;border-radius:var(--r);cursor:pointer;font-weight:bold;'>Part ways</button>"
        +"<button id='pw-cancel' style='padding:10px 20px;font-size:13px;font-family:var(--font);background:none;border:1px solid var(--brd2);color:var(--t2);border-radius:var(--r);cursor:pointer;'>Cancel</button>"
        +"</div></div>";
      document.body.appendChild(pc);
      document.getElementById("pw-ok").addEventListener("click",function(){pc.remove();modal.remove();partWaysWithCompanion(name);});
      document.getElementById("pw-cancel").addEventListener("click",function(){pc.remove();});
    });
  }

  // ── Portrait (party members only) ─────────────────────────────────────────
  if(isParty&&document.getElementById("npc-avatar-btn")){
    // Offset is stored per-companion (mirrored onto charSheet so it survives a swap-to-PC).
    // Without dedicated get/setOffset the portrait modal would fall back to the PLAYER's
    // offset — editing a companion's framing would silently rewrite the player's.
    function npcGetOff(){return wsNpc.portraitOffset||(wsNpc.charSheet&&wsNpc.charSheet.portraitOffset)||{x:0.5,y:0.5,zoom:1};}/* fall back to the sheet's framing so a swapped-out PC keeps it (audit E60) */
    function npcSetOff(x,y,zoom){wsNpc.portraitOffset={x:x,y:y,zoom:zoom};if(wsNpc.charSheet)wsNpc.charSheet.portraitOffset=wsNpc.portraitOffset;saveAll();}
    function wireNpcAvatarDrag(){var img=document.getElementById("npc-portrait-img");if(img)wirePortraitDrag(img,npcGetOff,npcSetOff);}
    function refreshNpcAvatar(){
      var av=document.getElementById("npc-avatar-btn");if(!av)return;
      var port=npcPortrait(wsNpc);
      av.innerHTML=(port?"<img id='npc-portrait-img' src='"+port+"' alt='"+name+"' style='width:100%;height:100%;object-fit:cover;display:block;'>":initials)+"<div class='cs-avatar-overlay'>&#129718;</div>";
      wireNpcAvatarDrag();
    }
    wireNpcAvatarDrag(); // apply saved offset on initial render
    // Use charSheet as portrait subject if available — richer prompt
    var npcSubject=sheet||{name:name,gender:"NB",age:"",ancestry:"",cls:"",archetypeNm:null,appear:"",mark:"",inventory:[]};
    var npcPortOpts={
      getPortrait:function(){return npcPortrait(wsNpc);},
      setPortrait:function(url){if(wsNpc.charSheet){wsNpc.charSheet.portrait=url;wsNpc.portrait=null;}else wsNpc.portrait=url;storageAdapter.markPortraitDirty();saveAll();},/* mark dirty on removal too (E28) */
      getOffset:npcGetOff,
      setOffset:npcSetOff,
      subject:npcSubject
    };
    document.getElementById("npc-avatar-btn").addEventListener("click",function(){var img=document.getElementById("npc-portrait-img");if(img&&img._wasDragged&&img._wasDragged())return;showPortraitModal(refreshNpcAvatar,npcPortOpts);});
  }
}
// ── Character browser modal ───────────────────────────────────────────────────
function showCharacterBrowser(initialMode){
  var ex=document.getElementById("char-browser-modal");if(ex)ex.remove();
  ["file-menu","cs-file-menu","api-file-menu"].forEach(function(id){var el=document.getElementById(id);if(el)el.style.display="none";});
  // Explicit arg wins; otherwise land on Library when connected, fall back to Local when offline.
  var mode=(initialMode==="local"||initialMode==="library")?initialMode:(storageAdapter.isServerMode()?"library":"local");
  var modal=document.createElement("div");modal.id="char-browser-modal";
  modal.style.cssText="position:fixed;inset:0;background:rgba(0,0,0,.88);z-index:400;display:flex;align-items:flex-start;justify-content:center;padding:20px;overflow-y:auto;";

  function getCharFromCampaign(id,cb){
    // Active campaign: prefer live WSK state (snapshot may be stale — e.g. portrait set after last snapshot)
    if(id===getActiveCampId()){var live=store.get(WSK);if(live){try{var lws=JSON.parse(live);if(lws&&lws.character)return cb(null,lws.character);}catch(e){}}}
    var raw=store.get("tnd_camp_"+id+"_ws");
    if(raw){try{var ws=JSON.parse(raw);if(ws&&ws.character)return cb(null,ws.character);}catch(e){}}
    // Fall back to server
    var tok=localStorage.getItem("tnd_server_tok_v1")||"";
    var url=(localStorage.getItem("tnd_server_url_v1")||"").replace(/\/$/,"");
    if(!url||!tok){return cb("Not available locally and not connected to server.");}
    fetch(url+"/api/campaigns/"+id,{headers:{"Authorization":"Bearer "+tok}})
      .then(function(r){if(!r.ok)throw new Error("HTTP "+r.status);return r.json();})
      .then(function(d){if(d&&d.worldState&&d.worldState.character)cb(null,d.worldState.character);else cb("No character data on server.");})
      .catch(function(e){cb(e.message);});
  }

  // Pull a campaign's PC portrait straight from its saved worldState (the portrait rides inline
  // in the blob; meta deliberately doesn't carry it to avoid bloat). Active campaign prefers live
  // WSK; others read their snapshot. Returns null gracefully if absent (→ initials avatar).
  function campPortrait(id){
    try{
      var raw=(id===getActiveCampId())?store.get(WSK):store.get("tnd_camp_"+id+"_ws");
      if(!raw)return null;
      var ws=JSON.parse(raw);
      return(ws&&ws.character&&ws.character.portrait)?ws.character.portrait:null;
    }catch(e){return null;}
  }

  // small round avatar — portrait if present, otherwise initials (matches the Library look)
  function avatarHtml(name,portrait){
    var ini=(name||"?").split(" ").map(function(w){return w[0]||"";}).join("").toUpperCase().slice(0,2);
    return portrait?"<img src='"+portrait+"' style='width:40px;height:40px;border-radius:50%;object-fit:cover;flex-shrink:0;'>"
      :"<div style='width:40px;height:40px;border-radius:50%;background:var(--bg3);border:1px solid var(--acc);display:flex;align-items:center;justify-content:center;font-size:12px;color:var(--acc);font-weight:bold;flex-shrink:0;'>"+ini+"</div>";
  }
  // a clickable, gently-highlighting row (click anywhere = inspect)
  function rowHtml(clickAttr,inner){
    return "<div class='cbr-row' "+clickAttr+" style='display:flex;align-items:center;gap:12px;padding:12px 14px;background:var(--bg2);border:1px solid var(--brd);border-radius:8px;margin-bottom:8px;cursor:pointer;'>"+inner+"</div>";
  }
  function segBtn(label,m,pos){
    var on=mode===m;
    var side=pos==="left"?"border-radius:var(--r) 0 0 var(--r);border-right:none;":"border-radius:0 var(--r) var(--r) 0;";
    return "<button class='cbr-seg' data-mode='"+m+"' style='flex:1;font-size:12px;font-family:var(--font);padding:7px 0;border:1px solid "+(on?"var(--acc)":"var(--brd2)")+";background:"+(on?"var(--acc)":"transparent")+";color:"+(on?"var(--on-acc)":"var(--t2)")+";font-weight:"+(on?"bold":"normal")+";cursor:pointer;"+side+"'>"+label+"</button>";
  }

  function shell(bodyHtml){
    modal.innerHTML="<div style='background:var(--modal-bg);border:1px solid var(--acc);border-radius:12px;padding:24px;max-width:500px;width:100%;margin-top:40px;'>"
      +"<div style='display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;'>"
      +"<span style='font-size:16px;color:var(--t0);font-weight:bold;'>Import Character</span>"
      +"<button id='cbr-x' style='background:none;border:none;color:var(--t2);font-size:20px;cursor:pointer;'>&#215;</button></div>"
      +"<div style='font-size:11px;color:var(--t2);margin-bottom:14px;'>"+(mode==="library"?"Campaign-agnostic character snapshots. Click to inspect, then import.":"Characters from your saved campaigns. Click to inspect, then import.")+"</div>"
      +"<div style='display:flex;margin-bottom:16px;'>"+segBtn("&#9729; Character Library","library","left")+segBtn("<svg viewBox='0 0 24 24' width='12' height='12' style='vertical-align:-2px;fill:currentColor;'><path d='M12 3 3 11 5 11 5 21 10 21 10 15 14 15 14 21 19 21 19 11 21 11Z'/></svg> Local","local","right")+"</div>"
      +"<div id='cbr-body'>"+bodyHtml+"</div>"
      +"<div style='border-top:1px solid var(--brd);margin-top:14px;padding-top:14px;text-align:center;'>"
      +"<label style='display:inline-block;padding:8px 20px;font-size:12px;font-family:var(--font);border:1px solid var(--brd2);border-radius:var(--r);color:var(--t2);cursor:pointer;' onmouseover='this.style.borderColor=\"var(--acc)\";this.style.color=\"var(--acc)\"' onmouseout='this.style.borderColor=\"var(--brd2)\";this.style.color=\"var(--t2)\"'>"
      +"<input type='file' id='cbr-file-inp' accept='.char' style='display:none;'/> Import from file (.char)&hellip;</label></div>"
      +"</div>";
    document.getElementById("cbr-x").addEventListener("click",function(){modal.remove();});
    var segs=modal.querySelectorAll(".cbr-seg"),si;
    for(si=0;si<segs.length;si++){segs[si].addEventListener("click",function(){var m=this.getAttribute("data-mode");if(m!==mode){mode=m;render();}});}
    document.getElementById("cbr-file-inp").addEventListener("change",function(e){modal.remove();importCharacterFile(e);});
  }

  // click a row → full read-only sheet; its Import button drops into the Play-as / companion chooser
  function inspectAndImport(char){
    showReadOnlyCharSheet(char,{onImport:function(){
      var inCreation=document.getElementById("char-screen").style.display!=="none";
      showCharImportPreview(char,function(){if(inCreation)_importCharToReview(char);else _startImportedCampaign(char);},function(){showCharacterBrowser(mode);});
    }});
  }

  function renderLocal(){
    var meta=getCampMeta().slice().sort(function(a,b){return b.savedAt-a.savedAt;});
    var rows="";
    if(!meta.length){rows="<div style='padding:24px;text-align:center;color:var(--t2);font-size:12px;font-style:italic;'>No saved campaigns on this device.</div>";}
    else{
      for(var i=0;i<meta.length;i++){
        var cm=meta[i];
        var inner=avatarHtml(cm.charName,campPortrait(cm.id))
          +"<div class='cbr-txt' style='flex:1;min-width:0;'>"
          +"<div class='cbr-name'>"+escHtml(cm.charName)+"</div>"
          +"<div class='cbr-sub'>Lv"+cm.level+" "+escHtml(cm.charAncestry)+" "+escHtml(cm.charClass)+"&ensp;&mdash;&ensp;"+escHtml(cm.location)+"</div>"
          +"</div>";
        rows+=rowHtml("onclick='_cbPickLocal(\""+escHtml(cm.id)+"\")'",inner);
      }
    }
    shell(rows);
  }

  function renderLibrary(){
    shell("<div style='padding:24px;text-align:center;color:var(--t2);font-size:12px;font-style:italic;'>Loading character library&hellip;</div>");
    if(!storageAdapter.isServerMode()){
      var b0=document.getElementById("cbr-body");if(b0)b0.innerHTML="<div style='padding:24px;text-align:center;color:var(--t2);font-size:12px;font-style:italic;'>Connect to the server to access the character library.</div>";
      return;
    }
    storageAdapter.listCharacterLibrary(function(err,list){
      if(document.getElementById("char-browser-modal")!==modal||mode!=="library")return; // stale callback
      var body=document.getElementById("cbr-body");if(!body)return;
      if(err){body.innerHTML="<div style='padding:24px;text-align:center;color:var(--hp);font-size:12px;'>Could not load character library: "+escHtml(String(err))+"</div>";return;}
      if(!list||!list.length){body.innerHTML="<div style='padding:24px;text-align:center;color:var(--t2);font-size:12px;font-style:italic;'>No characters in the character library yet.<br>Export a character from the character sheet to add one.</div>";return;}
      var rows="";
      for(var i=0;i<list.length;i++){
        var entry=list[i],ch=entry.character||{};
        var inner=avatarHtml(ch.name,ch.portrait)
          +"<div class='cbr-txt' style='flex:1;min-width:0;'>"
          +"<div class='cbr-name'>"+escHtml(entry.name)+"</div>"
          +"<div class='cbr-sub'>Lv"+entry.level+" "+escHtml(entry.ancestry)+" "+escHtml(entry.cls)+"</div>"
          +"</div>"
          +"<button onclick='event.stopPropagation();_cbDelLib(\""+escHtml(entry.slug)+"\",\""+escHtml(entry.name).replace(/"/g,"&quot;")+"\")' style='padding:6px 8px;font-size:12px;background:none;border:1px solid var(--brd2);color:var(--t2);border-radius:var(--r);cursor:pointer;flex-shrink:0;' title='Remove from the character library'>&#215;</button>";
        rows+=rowHtml("onclick='_cbPickLib(\""+escHtml(entry.slug)+"\")'",inner);
      }
      body.innerHTML=rows;
    });
  }

  function render(){if(mode==="library")renderLibrary();else renderLocal();}

  window._cbPickLocal=function(id){
    getCharFromCampaign(id,function(err,char){
      if(err){showToast("Could not load character: "+err);return;}
      inspectAndImport(char);
    });
  };
  window._cbPickLib=function(slug){
    storageAdapter.listCharacterLibrary(function(err,list){
      if(err){showToast("Error: "+err);return;}
      var entry=null;for(var i=0;i<list.length;i++){if(list[i].slug===slug){entry=list[i];break;}}
      if(!entry){showToast("Character not found.");return;}
      var char=entry.character;
      if(!char.skills)char.skills=initSkills();
      if(!char.conditions)char.conditions=[];if(!char.relationships)char.relationships=[];
      if(!char.saveModifiers)char.saveModifiers=[];if(!char.languages)char.languages=[];
      if(!char.storyBeats)char.storyBeats=[];if(!char.abilities)char.abilities=[];if(!char.spells)char.spells=[];
      if(char.portrait===undefined)char.portrait=null;
      inspectAndImport(char);
    });
  };
  window._cbDelLib=function(slug,name){
    if(!confirm("Remove "+name+" from the character library?"))return;
    storageAdapter.deleteCharacterFromLibrary(slug,function(err){
      if(err){showToast("Delete failed: "+err);return;}
      showToast(name+" removed from the character library.");
      if(mode==="library")render();
    });
  };

  document.body.appendChild(modal);
  modal.addEventListener("click",function(e){if(e.target===modal)modal.remove();});
  render();
}
// ── Character import preview modal ───────────────────────────────────────────
function showCharImportPreview(char, onAccept, onCancel){
  var ex=document.getElementById("char-import-preview");if(ex)ex.remove();
  var modal=document.createElement("div");modal.id="char-import-preview";
  modal.style.cssText="position:fixed;inset:0;background:rgba(0,0,0,.88);z-index:400;display:flex;align-items:flex-start;justify-content:center;padding:20px;overflow-y:auto;";
  var initials=(char.name||"?").split(" ").map(function(w){return w[0];}).join("").slice(0,2).toUpperCase();
  var portrait=char.portrait?"<img src='"+char.portrait+"' alt='"+escHtml(char.name)+"' style='width:100%;height:100%;object-fit:cover;display:block;border-radius:50%;'>":initials;
  var stats=char.stats||{};
  var statRow=["STR","DEX","CON","INT","WIS","CHA"].map(function(s){
    return "<div style='text-align:center;'><div style='font-size:10px;color:var(--t2);'>"+s+"</div><div style='font-size:14px;color:var(--t0);font-weight:bold;'>"+(stats[s]||"—")+"</div></div>";
  }).join("");
  var abilities=(char.abilities||[]).slice(0,4).map(function(a){return "<div style='font-size:11px;color:var(--t1);margin-bottom:3px;'><span style='color:var(--acc);'>"+escHtml(a.nm)+"</span> — "+escHtml(a.ds)+"</div>";}).join("");
  var spells=(char.spells||[]).filter(function(s){return!s.used;}).slice(0,6).map(function(s){return escHtml(s.nm);}).join(", ");
  var inv=escHtml((char.inventory||[]).join(", ")||"Nothing");
  var langs=(char.languages||[]).map(function(l){return escHtml(l.name)+(l.broken?" (broken)":"");}).join(", ")||"Common";
  modal.innerHTML="<div style='background:var(--modal-bg);border:1px solid var(--acc);border-radius:12px;padding:24px;max-width:520px;width:100%;margin-top:40px;'>"
    +"<div style='display:flex;justify-content:space-between;align-items:center;margin-bottom:18px;'>"
    +"<span style='font-size:15px;color:var(--t0);font-weight:bold;'>Import Character</span>"
    +"<button id='cip-x' style='background:none;border:none;color:var(--t2);font-size:20px;cursor:pointer;'>&#215;</button></div>"
    +"<div style='display:flex;gap:16px;align-items:center;margin-bottom:18px;'>"
    +"<div style='width:64px;height:64px;border-radius:50%;background:var(--bg3);border:2px solid var(--acc);display:flex;align-items:center;justify-content:center;font-size:22px;color:var(--acc);font-weight:bold;flex-shrink:0;overflow:hidden;'>"+portrait+"</div>"
    +"<div><div style='font-size:18px;color:var(--acc);font-weight:bold;'>"+escHtml(char.name)+"</div>"
    +"<div style='font-size:12px;color:var(--t1);margin-top:2px;'>Lv"+(char.level||1)+" · "+escHtml(char.subraceNm||char.ancestry||"")+" "+escHtml(char.cls||"")+(char.archetypeNm?" ("+escHtml(char.archetypeNm)+")":"")+"</div>"
    +"<div style='font-size:11px;color:var(--t2);margin-top:2px;'>"+escHtml(char.gender||"")+" · "+escHtml(char.age||"")+(char.deity?" · "+escHtml(char.deity):"")+"</div>"
    +"</div></div>"
    +"<div style='display:grid;grid-template-columns:repeat(6,1fr);gap:6px;background:var(--bg2);border-radius:8px;padding:10px;margin-bottom:14px;'>"+statRow+"</div>"
    +"<div style='display:flex;gap:16px;margin-bottom:14px;font-size:12px;'>"
    +"<span style='color:var(--hp);'>HP "+char.hp+"/"+char.maxHp+"</span>"
    +"<span style='color:var(--gold);'>"+char.gold+"gp</span>"
    +"<span style='color:var(--t1);'>"+escHtml(alignLabel(char.alignLaw||0,char.alignGood||0))+"</span>"
    +"</div>"
    +(char.appear?"<div style='font-size:11px;color:var(--t2);margin-bottom:10px;font-style:italic;'>"+escHtml(char.appear)+(char.mark?" — "+escHtml(char.mark):"")+"</div>":"")
    +(char.backstory?"<div style='font-size:11px;color:var(--t2);margin-bottom:10px;'>"+escHtml(char.backstory)+"</div>":"")
    +(abilities?"<div style='margin-bottom:10px;border-top:1px solid var(--brd);padding-top:10px;'>"+abilities+"</div>":"")
    +"<div style='font-size:11px;color:var(--t2);margin-bottom:6px;'><span style='color:var(--t1);'>Languages:</span> "+langs+"</div>"
    +(spells?"<div style='font-size:11px;color:var(--t2);margin-bottom:6px;'><span style='color:var(--t1);'>Spells:</span> "+spells+"</div>":"")
    +"<div style='font-size:11px;color:var(--t2);margin-bottom:16px;'><span style='color:var(--t1);'>Inventory:</span> "+inv+"</div>"
    +"<div style='display:flex;flex-direction:column;gap:8px;'>"
    +"<div style='display:flex;gap:10px;'>"
    +"<button id='cip-accept' style='flex:1;padding:11px;font-size:13px;font-family:var(--font);background:var(--acc);color:var(--on-acc);border:none;border-radius:var(--r);cursor:pointer;font-weight:bold;'>Play as "+escHtml(char.name)+"</button>"
    +"<button id='cip-cancel' style='padding:11px 18px;font-size:13px;font-family:var(--font);background:none;border:1px solid var(--brd2);color:var(--t2);border-radius:var(--r);cursor:pointer;'>Cancel</button>"
    +"</div>"
    +(worldState?"<button id='cip-companion' style='width:100%;padding:10px;font-size:12px;font-family:var(--font);background:var(--bg2);border:1px solid var(--brd2);color:var(--t1);border-radius:var(--r);cursor:pointer;'>+ Add "+escHtml(char.name)+" as companion to current campaign</button>":"")
    +"</div></div>";
  document.body.appendChild(modal);
  function doCancel(){modal.remove();if(typeof onCancel==="function")onCancel();}
  document.getElementById("cip-x").addEventListener("click",doCancel);
  document.getElementById("cip-cancel").addEventListener("click",doCancel);
  document.getElementById("cip-accept").addEventListener("click",function(){modal.remove();onAccept();});
  if(document.getElementById("cip-companion")){document.getElementById("cip-companion").addEventListener("click",function(){modal.remove();_addImportedCompanion(char);});}
}
// ── Campaign management UI ────────────────────────────────────────────────────
function showCampaignPicker(){
  closeAllMenus();
  _showCampaignPickerModal();
  if(storageAdapter.isServerMode()){
    var st=document.getElementById("camp-sync-status");
    if(st){st.textContent="☁ Connecting to server…";st.style.display="block";st.style.animation="pulse-opacity 1.2s ease-in-out infinite";}
    var _wakeTimer=setTimeout(function(){var s=document.getElementById("camp-sync-status");if(s&&s.style.display!=="none")s.textContent="☁ Waking server up, hang tight…";},8000);
    storageAdapter.syncCampaignList(function(result){
      clearTimeout(_wakeTimer);
      _renderCampList();
      var s=document.getElementById("camp-sync-status");if(!s)return;
      s.style.animation="";
      if(result){s.style.display="none";}
      else{s.textContent="⚠ Couldn't reach server — showing local data";setTimeout(function(){var el=document.getElementById("camp-sync-status");if(el)el.style.display="none";},3000);}
    });
  }
}
function _showCampaignPickerModal(){
  var ex=document.getElementById("camp-modal");if(ex)ex.remove();
  var modal=document.createElement("div");modal.id="camp-modal";
  modal.style.cssText="position:fixed;inset:0;background:rgba(0,0,0,.88);z-index:300;display:flex;align-items:flex-start;justify-content:center;padding:20px;overflow-y:auto;";
  var svrConnected=storageAdapter.isServerMode();
  var svrBtnStyle="padding:3px 10px;font-family:var(--font);font-size:11px;background:none;border:1px solid "+(svrConnected?"var(--acc)":"var(--brd2)")+";border-radius:var(--r);cursor:pointer;color:"+(svrConnected?"var(--acc)":"var(--t2)")+";";
  modal.innerHTML="<div style='background:var(--modal-bg);border:1px solid var(--acc);border-radius:12px;padding:24px;max-width:500px;width:100%;margin-top:40px;'>"
    +"<div style='display:flex;justify-content:space-between;align-items:center;margin-bottom:18px;'>"
    +"<span style='font-size:16px;color:var(--t0);font-weight:bold;'>Campaigns</span>"
    +"<div style='display:flex;align-items:center;gap:8px;'>"
    +"<button id='camp-svr-btn' style='"+svrBtnStyle+"'>&#9729; "+(svrConnected?"Disconnect":"Connect")+"</button>"
    +"<button id='camp-x' style='background:none;border:none;color:var(--t2);font-size:20px;cursor:pointer;'>&#215;</button>"
    +"</div></div>"
    +"<div id='camp-sync-status' style='display:none;font-size:11px;color:var(--t2);margin-bottom:10px;text-align:center;'></div>"
    +"<div id='camp-list'></div>"
    +"<button onclick='campNew()' style='width:100%;margin-top:14px;padding:12px;font-size:13px;font-family:var(--font);background:var(--bg3);border:1px solid var(--brd2);border-radius:var(--r);color:var(--t0);cursor:pointer;'>&#10022; New Campaign</button>"
    +"</div>";
  document.body.appendChild(modal);
  document.getElementById("camp-x").addEventListener("click",function(){modal.remove();});
  document.getElementById("camp-svr-btn").addEventListener("click",function(){
    modal.remove();
    if(storageAdapter.isServerMode()){
      storageAdapter.logoutFromServer(function(){updateServerUI();showToast("&#9729; Disconnected.");showCampaignPicker();});
    }else{
      connectToServer();
    }
  });
  _renderCampList();
}
function _renderCampList(){
  var listEl=document.getElementById("camp-list");if(!listEl)return;
  function timeAgo(ts){var d=Math.floor((Date.now()-ts)/1000);if(d<60)return"just now";if(d<3600)return Math.floor(d/60)+"m ago";if(d<86400)return Math.floor(d/3600)+"h ago";return Math.floor(d/86400)+"d ago";}
  var meta=getCampMeta(),activeId=getActiveCampId();
  var sorted=meta.slice().sort(function(a,b){return b.savedAt-a.savedAt;});
  var rows="";
  if(!sorted.length){rows="<div style='padding:20px;text-align:center;color:var(--t2);font-size:12px;font-style:italic;'>No saved campaigns yet.</div>";}
  else{var i;for(i=0;i<sorted.length;i++){var cm=sorted[i],isActive=cm.id===activeId;
    var dispName=cm.campName||cm.charName;
    var hasLocal=!!store.get("tnd_camp_"+cm.id+"_ws");
    var cloudOnly=cm.onServer&&!hasLocal&&!isActive;
    var cloudBtns=storageAdapter.isServerMode()
      ?"<div style='display:flex;flex-direction:column;gap:4px;flex-shrink:0;'>"
        +"<button id='camp-push-"+cm.id+"' onclick='campCloudPush(\""+cm.id+"\")' title='Push to cloud' style='background:none;border:none;cursor:pointer;font-size:14px;line-height:1;padding:2px;"+(hasLocal?"color:var(--t1);":"color:var(--t2);opacity:0.25;pointer-events:none;")+"' "+(hasLocal?"onmouseover='this.style.color=\"var(--acc)\"' onmouseout='this.style.color=\"var(--t1)\"'":"")+">&#9729;&#8593;</button>"
        +"<button onclick='campCloudPull(\""+cm.id+"\")' title='Pull from cloud' style='background:none;border:none;cursor:pointer;font-size:14px;line-height:1;padding:2px;"+(cm.onServer?"color:var(--t1);":"color:var(--t2);opacity:0.35;pointer-events:none;")+"' "+(cm.onServer?"onmouseover='this.style.color=\"var(--acc)\"' onmouseout='this.style.color=\"var(--t1)\"'":"")+">&#9729;&#8595;</button>"
        +"</div>"
      :"";
    var savedLine=isActive?"<span style='color:var(--acc);'>&#9679; Playing now</span>"
      :cloudOnly?"<span style='color:var(--t2);'>&#9729; Cloud only &mdash; click Load to download</span>"
      :"Last saved "+timeAgo(cm.savedAt);
    rows+="<div style='display:flex;align-items:center;gap:12px;padding:12px 14px;background:"+(isActive?"rgba(184,147,90,.08)":cloudOnly?"rgba(74,112,165,.05)":"var(--bg2)")+";border:1px solid "+(isActive?"var(--acc)":cloudOnly?"rgba(74,112,165,.3)":"var(--brd)")+";border-radius:8px;margin-bottom:8px;"+(cloudOnly?"opacity:0.8;":"")+";'>"
      +cloudBtns
      +"<div style='flex:1;min-width:0;'>"
      +"<div style='display:flex;align-items:center;gap:6px;'>"
      +"<span id='camp-name-"+cm.id+"' style='font-size:14px;color:"+(isActive?"var(--acc)":"var(--t0)")+";font-weight:bold;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;'>"+escHtml(dispName)+"</span>"
      +(!cloudOnly?"<button onclick='campStartRename(\""+escHtml(cm.id)+"\")' title='Rename' style='background:none;border:none;color:var(--t2);cursor:pointer;font-size:11px;padding:0 2px;flex-shrink:0;' onmouseover='this.style.color=\"var(--acc)\"' onmouseout='this.style.color=\"var(--t2)\"'>&#129718;</button>":"")
      +"</div>"
      +"<div style='font-size:11px;color:var(--t2);margin-top:2px;'>"+escHtml(cm.charName)+" &mdash; Lv"+cm.level+" "+escHtml(cm.charAncestry)+" "+escHtml(cm.charClass)+"&ensp;&mdash;&ensp;"+escHtml(cm.location)+"</div>"
      +"<div style='font-size:10px;color:var(--t2);margin-top:2px;'>"+savedLine+"</div>"
      +"</div>"
      +(isActive?"<span style='font-size:10px;color:var(--acc);flex-shrink:0;'>ACTIVE</span>"
        :"<button onclick='campLoad(\""+cm.id+"\")' style='padding:6px 14px;font-size:12px;font-family:var(--font);background:var(--acc);color:var(--on-acc);border:none;border-radius:var(--r);cursor:pointer;flex-shrink:0;'>Load</button>"
        +"<button onclick='campDelete(\""+cm.id+"\")' style='padding:6px 10px;font-size:14px;font-family:var(--font);background:none;border:1px solid var(--brd2);color:var(--t2);border-radius:var(--r);cursor:pointer;flex-shrink:0;margin-left:6px;'>&#215;</button>")
      +"</div>";}}
  listEl.innerHTML=rows;
}
function _applyLoadedCampaign(){
  document.getElementById("story-narrative").innerHTML="";document.getElementById("story-tabletalk").innerHTML="";
  syncUI();showGame();initAbilities();initSpells();
  addMsg("system","Campaign loaded: "+worldState.character.name+".");
  addMsg("system",worldState.world.location+" | Turn "+worldState.turn+" | "+Object.keys(memory.npcs).length+" NPCs in memory");
  initReplaySession(); // shared with init() — was a near-identical inline copy (audit #26)
  if(worldState.combat){document.getElementById("cpanel").classList.add("active");updateCombat();}
  if(typeof migratePendingCompanionSheets==="function")migratePendingCompanionSheets();// backfill sheet-less party members in existing saves (audit P2)
}
function campLoad(id){
  if(typeof busy!=="undefined"&&busy){showToast("Finish the current turn first.");return;}// audit E23
  var modal=document.getElementById("camp-modal");if(modal)modal.remove();
  // Check if local data exists for this campaign
  var hasLocal=!!(store.get("tnd_camp_"+id+"_ws"));
  if(hasLocal){
    var ok=switchToCampaign(id);
    if(!ok){showToast("Failed to load campaign.");return;}
    _applyLoadedCampaign();
    return;
  }
  // No local data — fetch from server if connected
  if(!storageAdapter.isServerMode()){showToast("Campaign data not found locally. Connect to server to load it.");return;}
  var serverUrl=storageAdapter.getServerUrl();
  var tok=localStorage.getItem("tnd_server_tok_v1")||"";
  showToast("☁ Fetching campaign from server…");
  fetch(serverUrl+"/api/campaigns/"+encodeURIComponent(id),{headers:{"Authorization":"Bearer "+tok}})
    .then(function(r){if(!r.ok)throw new Error("HTTP "+r.status);return r.json();})
    .then(function(data){
      if(!data||!data.worldState){showToast("Campaign not found on server.");return;}
      // Write into the campaign slot then switch to it
      store.set("tnd_camp_"+id+"_ws",JSON.stringify(data.worldState));
      store.set("tnd_camp_"+id+"_sl",JSON.stringify(data.sessionLog||[]));
      store.set("tnd_camp_"+id+"_mem",JSON.stringify(data.memory||{}));
      var ok=switchToCampaign(id);
      if(!ok){showToast("Failed to load campaign.");return;}
      _applyLoadedCampaign();
    })
    .catch(function(e){showToast("Failed to fetch campaign: "+e.message);});
}
function campCloudPush(id){
  if(!storageAdapter.isServerMode()){showToast("Not connected to server.");return;}
  var pushBtn=document.getElementById("camp-push-"+id);if(pushBtn)pushBtn.style.animation="pulse 1s ease-in-out infinite";
  campCloudPushSilent(id,function(ok){
    var b=document.getElementById("camp-push-"+id);if(b)b.style.animation="";
    if(ok){showToast("☁ Pushed to server.");var ex=document.getElementById("camp-modal");if(ex)ex.remove();showCampaignPicker();}
    else{showToast("Push failed.");}
  });
}
function campCloudPull(id){
  if(!storageAdapter.isServerMode()){showToast("Not connected to server.");return;}
  var tok=localStorage.getItem("tnd_server_tok_v1")||"";
  var serverUrl=storageAdapter.getServerUrl();
  showToast("☁ Pulling from server…");
  fetch(serverUrl+"/api/campaigns/"+encodeURIComponent(id),{headers:{"Authorization":"Bearer "+tok}})
    .then(function(r){if(!r.ok)throw new Error("HTTP "+r.status);return r.json();})
    .then(function(data){
      if(!data||!data.worldState){showToast("Not found on server.");return;}
      data.worldState.campId=id;
      store.set("tnd_camp_"+id+"_ws",JSON.stringify(data.worldState));
      store.set("tnd_camp_"+id+"_sl",JSON.stringify(data.sessionLog||[]));
      store.set("tnd_camp_"+id+"_mem",JSON.stringify(data.memory||{}));
      // Update meta savedAt
      var meta=getCampMeta();for(var i=0;i<meta.length;i++){if(meta[i].id===id){meta[i].savedAt=Date.now();meta[i].onServer=true;break;}}setCampMeta(meta);
      showToast("☁ Pulled from server.");
      // If active campaign, reload and restore narrative. Write the pulled blob straight into the
      // LIVE keys and loadState — NOT switchToCampaign, whose snapshotActiveCamp would overwrite the
      // just-pulled slot with the STALE live state before reading it back, silently discarding the
      // pull while the toast claimed success (audit E3).
      if(id===getActiveCampId()){
        store.set(WSK,JSON.stringify(data.worldState));
        store.set(SLK,JSON.stringify(data.sessionLog||[]));
        store.set(MEM_KEY,JSON.stringify(data.memory||{}));
        var ok=loadState();
        if(ok){
          _applyLoadedCampaign(); // replays from the transcript via initReplaySession
          // Legacy fallback: pre-transcript blobs (no worldState.transcript) still carry narrativeHtml.
          if(data.narrativeHtml&&!(worldState&&worldState.transcript&&worldState.transcript.length)){try{var _ne=document.getElementById("story-narrative");if(_ne){_ne.innerHTML=data.narrativeHtml;_ne.scrollTop=_ne.scrollHeight;}}catch(x){}}
        }
      }
      var ex=document.getElementById("camp-modal");if(ex)ex.remove();showCampaignPicker();
    })
    .catch(function(e){showToast("Pull failed: "+e.message);});
}
function campDelete(id){
  if(!confirm("Delete this campaign? This cannot be undone."))return;
  deleteCampaign(id);
  // Also delete from server so syncCampaignList can't resurrect it
  if(storageAdapter.isServerMode())storageAdapter.deleteCampaignFromServer(id,null);
  var ex=document.getElementById("camp-modal");if(ex)ex.remove();
  showCampaignPicker();
}
function campStartRename(id){
  var span=document.getElementById("camp-name-"+id);if(!span)return;
  var cur=span.textContent;
  var inp=document.createElement("input");
  inp.id="camp-rename-"+id;inp.value=cur;
  inp.style.cssText="font-size:14px;font-family:var(--font);background:var(--bg3);border:1px solid var(--acc);border-radius:4px;color:var(--t0);padding:2px 6px;width:140px;";
  inp.addEventListener("blur",function(){campSaveRename(id);});
  inp.addEventListener("keydown",function(e){if(e.key==="Enter")campSaveRename(id);if(e.key==="Escape")showCampaignPicker();});
  span.parentNode.replaceChild(inp,span);inp.focus();inp.select();
}
function campSaveRename(id){
  var inp=document.getElementById("camp-rename-"+id);if(!inp)return;
  var name=inp.value.trim();if(!name)return showCampaignPicker();
  var meta=getCampMeta();
  for(var i=0;i<meta.length;i++){if(meta[i].id===id){meta[i].campName=name;break;}}
  setCampMeta(meta);
  // Also update worldState.campName if this is the active campaign
  if(id===getActiveCampId()&&worldState){worldState.campName=name;saveAll();renameCampaignFolder(name);}
  else {
    // Patch the stored worldState for this campaign
    var raw=store.get("tnd_camp_"+id+"_ws");
    if(raw){try{var ws=JSON.parse(raw);ws.campName=name;store.set("tnd_camp_"+id+"_ws",JSON.stringify(ws));}catch(e){}}
    // Push the rename to the server (audit E80) — otherwise the next syncCampaignList merge (server
    // wins on conflict) reverts the local name back to the server's old one.
    if(storageAdapter.isServerMode()&&typeof campCloudPushSilent==="function")campCloudPushSilent(id,null);
  }
  showCampaignPicker();
}
function campNew(){
  if(typeof busy!=="undefined"&&busy){showToast("Finish the current turn first.");return;}// audit E23
  var modal=document.getElementById("camp-modal");if(modal)modal.remove();
  snapshotActiveCamp();
  store.del(WSK);store.del(SLK);store.del(MEM_KEY);
  var nid=newCampaignId();setActiveCampId(nid);
  worldState=null;sessionLog=[];memory=blankMemory();
  document.getElementById("story-narrative").innerHTML="";document.getElementById("story-tabletalk").innerHTML="";
  showChar();
}
// ── Character I/O ─────────────────────────────────────────────────────────────
function _doExportChar(name, sheet){
  var data=JSON.stringify({ver:10,type:"character",character:sheet},null,2);
  var blob=new Blob([data],{type:"application/json"});
  var slug=function(s){return(s||"unknown").replace(/[^a-zA-Z0-9_\-]/g,"_");};
  var camp=slug(worldState.campName||worldState.character.name);
  var fname=camp+"_"+slug(name)+"_character.char";
  exportToFolder("character",blob,fname);
}
function exportCharacter(){
  document.getElementById("file-menu").style.display="none";
  if(!worldState){showToast("No active game.");return;}
  // Build list: player + any NPC with a full character sheet
  var chars=[{name:worldState.character.name,sheet:worldState.character,label:"Player character"}];
  var i,npc;for(i=0;i<worldState.npcs.length;i++){npc=worldState.npcs[i];if(npc.charSheet){var sub="Party member";if(npc.charSheet.cls)sub+=" · "+npc.charSheet.cls+(npc.charSheet.level?" Lv"+npc.charSheet.level:"");chars.push({name:npc.name,sheet:npc.charSheet,label:sub});}}
  // Always show picker — never silently download
  var ex=document.getElementById("char-export-modal");if(ex)ex.remove();
  var modal=document.createElement("div");modal.id="char-export-modal";
  modal.style.cssText="position:fixed;inset:0;background:rgba(0,0,0,.88);z-index:300;display:flex;align-items:center;justify-content:center;padding:20px;";
  // Same slug as _doExportChar so the previewed filename matches what's actually written, and
  // escHtml the names/labels which are model-derived (audit E70).
  var slug=function(s){return(s||"unknown").replace(/[^a-zA-Z0-9_\-]/g,"_");};
  var rows="",ci;for(ci=0;ci<chars.length;ci++){
    var camp=slug(worldState.campName||worldState.character.name);
    var fname=camp+"_"+slug(chars[ci].name)+"_character.char";
    rows+="<div onclick='_charExportPick("+ci+")' style='display:flex;align-items:center;gap:12px;padding:12px 14px;background:var(--bg2);border:1px solid var(--brd);border-radius:8px;margin-bottom:8px;cursor:pointer;' onmouseover='this.style.borderColor=\"var(--acc)\"' onmouseout='this.style.borderColor=\"var(--brd)\"'>"
      +"<div style='flex:1;min-width:0;'><div style='font-size:14px;color:var(--t0);font-weight:bold;'>"+escHtml(chars[ci].name)+"</div>"
      +"<div style='font-size:11px;color:var(--t2);margin-top:2px;'>"+escHtml(chars[ci].label)+"</div>"
      +"<div style='font-size:10px;color:var(--t2);margin-top:3px;font-family:var(--font-mono);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;'>"+escHtml(fname)+"</div></div>"
      +"<span style='font-size:18px;color:var(--t2);flex-shrink:0;'>&#8595;</span></div>";
  }
  modal.innerHTML="<div style='background:var(--modal-bg);border:1px solid var(--acc);border-radius:12px;padding:24px;max-width:420px;width:100%;'>"
    +"<div style='display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;'><span style='font-size:15px;color:var(--t0);font-weight:bold;'>Export Character</span><button id='cep-x' style='background:none;border:none;color:var(--t2);font-size:20px;cursor:pointer;'>&#215;</button></div>"
    +rows+"</div>";
  document.body.appendChild(modal);
  document.getElementById("cep-x").addEventListener("click",function(){modal.remove();});
  modal.addEventListener("click",function(e){if(e.target===modal)modal.remove();});
  window._charExportList=chars;
}
function _charExportPick(idx){
  var modal=document.getElementById("char-export-modal");if(modal)modal.remove();
  var c=window._charExportList&&window._charExportList[idx];if(c)_doExportChar(c.name,c.sheet);
}
function _switchPlayerCharacter(name){
  if(typeof busy!=="undefined"&&busy){showToast("Finish the current turn first.");return;}// audit E23 — a mid-flight swap mis-targets the response's tags and drops the handoff message
  // Find the NPC and their charSheet
  var npcIdx=-1,i;for(i=0;i<worldState.npcs.length;i++){if(worldState.npcs[i].name===name){npcIdx=i;break;}}
  if(npcIdx<0){showToast("Companion not found.");return;}
  var npc=worldState.npcs[npcIdx];
  var newChar=npc.charSheet;
  if(!newChar){showToast(name+" has no character sheet. Generate one first.");return;}
  // Demote current player character to companion NPC
  var oldChar=worldState.character;
  var oldNpc={name:oldChar.name,status:"ally",rel:"companion",met:worldState.turn,partyMember:true,pronouns:pronounsForGender(oldChar.gender),portrait:null,portraitOffset:oldChar.portraitOffset||null,charSheet:oldChar}; // portrait rides on charSheet only (#3 dedupe); carry the framing (audit E60)
  // Swap
  worldState.npcs.splice(npcIdx,1);         // remove new char from npcs
  worldState.npcs.push(oldNpc);             // add old char as npc
  newChar.portraitOffset=newChar.portraitOffset||{x:0.5,y:0.5,zoom:1};
  worldState.character=newChar;
  // Mark the switch so buildSysPrompt re-injects a forceful POV-reassignment block for
  // the next couple of turns — the sessionLog is full of the OLD character as "you", and a
  // single handoff line can't overpower that momentum. Cleared in sendAction after ~2 turns.
  worldState.recentSwitch={to:newChar.name,from:oldChar.name,turn:worldState.turn};
  // Update knowledge graph link
  npcLinkUpsert(newChar.name,oldChar.name,"companions");
  // The swap re-homes portraits (PC<->companion) WITHOUT calling a portrait setter, so
  // the dirty flag stays false and the separate /portrait upload would be skipped mid-session
  // (_portraitSyncedOnce). Result: the server's portrait store keeps the pre-swap mapping and a
  // second device loads cross-wired portraits (new PC shows old PC's image). Mark dirty so the
  // next sync re-uploads {portrait: new PC, npcPortraits: {old PC: ...}}.
  if(typeof storageAdapter!=="undefined"&&storageAdapter.markPortraitDirty)storageAdapter.markPortraitDirty();
  saveAll();syncUI();initAbilities();initSpells();
  showToast("Now playing as "+name+".");
  // Forceful, explicit control-reassignment directive — sent silently (it's out-of-character,
  // not a player action). The old handoff ("steps into the lead") read as narrative flavor and
  // never told the GM that the second-person referent had changed.
  var handoff="[CONTROL SWITCH — out-of-character instruction, NOT a player action] The player now controls "+newChar.name+". From this moment on, the player character IS "+newChar.name+": every second-person reference ('you', 'your') means "+newChar.name+", a "+(newChar.subraceNm?newChar.subraceNm+" ":"")+(newChar.ancestry||"")+" "+(newChar.cls||"")+". "+oldChar.name+" is now a non-player companion travelling with the party — refer to "+oldChar.name+" in the THIRD person by name, never as 'you'. The earlier story was told with "+oldChar.name+" as the player; that has changed. Give ONE brief in-world beat acknowledging "+newChar.name+" taking the lead, then continue the scene from "+newChar.name+"'s eyes.";
  sendAction(handoff,{silent:true});
}
// Campaign setup for an imported character — replaces the old direct startGame() jump
// that skipped tone, campaign name, and starting location entirely. The character is
// played as-is (level, gear, abilities untouched); only world choices are asked here.
function _importCharToReview(char){
  if(!cs.tone){showToast("Pick a world tone first (Step 1).");return;}
  var bm=document.getElementById("char-browser-modal");if(bm)bm.remove();
  var pr=document.getElementById("char-import-preview");if(pr)pr.remove();
  pendingImportChar=char;
  cs.name=char.name||"";cs.gender=char.gender||"M";cs.age=char.age||"early twenties";
  cs.portrait=char.portrait||null;cs.portraitOffset=char.portraitOffset||null;
  cs.ancestry=char.ancestry||null;cs.cls=char.cls||null;
  goStep(6);
  var nm=document.getElementById("char-name");if(nm)nm.value=char.name||"";
  var cn=document.getElementById("rv-camp-name");if(cn&&!cn.value)cn.value=char.name||"";
  var lvlSel=document.getElementById("rv-start-level");if(lvlSel&&char.level)lvlSel.value=char.level;
  if(typeof rvSyncXp==="function")rvSyncXp();
  var xpInp=document.getElementById("rv-start-xp");if(xpInp&&char.xp!==undefined)xpInp.value=char.xp;
}
function _startImportedCampaign(char){
  if(typeof busy!=="undefined"&&busy){showToast("Finish the current turn first.");return;}// audit E23
  pendingBlueprint=null; // a stale wizard blueprint would otherwise apply to this import + override its location (audit E86)
  var ex=document.getElementById("import-setup");if(ex)ex.remove();
  // Clone starting-location options from the wizard's Review-step select so the lists never drift.
  var locSel=document.getElementById("rv-start-loc"),locOpts="",li;
  if(locSel&&locSel.options.length){for(li=0;li<locSel.options.length;li++){var lo=locSel.options[li];locOpts+='<option value="'+escHtml(lo.value)+'">'+escHtml(lo.textContent)+'</option>';}}
  else locOpts='<option value="The Crossroads of Ashenveil">The Crossroads of Ashenveil</option><option value="custom">Custom…</option>';
  var toneOpts="",ti;for(ti=0;ti<TONES.length;ti++){if(TONES[ti].id==="custom")continue;toneOpts+='<option value="'+ti+'"'+(TONES[ti].id==="swords"?" selected":"")+'>'+escHtml(TONES[ti].nm)+'</option>';}
  var modal=document.createElement("div");modal.id="import-setup";
  modal.style.cssText="position:fixed;inset:0;background:rgba(0,0,0,.88);z-index:410;display:flex;align-items:center;justify-content:center;padding:20px;";
  var lblCss="display:block;font-size:11px;color:var(--t2);margin-bottom:4px;";
  var inpCss="width:100%;padding:8px;background:var(--bg2);border:1px solid var(--brd2);border-radius:var(--r);color:var(--t0);font-family:var(--font);font-size:13px;";
  modal.innerHTML="<div style='background:var(--modal-bg);border:1px solid var(--acc);border-radius:12px;padding:24px;max-width:420px;width:100%;'>"
    +"<div style='font-size:15px;color:var(--t0);font-weight:bold;margin-bottom:4px;'>New campaign for "+escHtml(char.name)+"</div>"
    +"<div style='font-size:11px;color:var(--t2);margin-bottom:18px;'>Lv"+(char.level||1)+" "+escHtml(((char.subraceNm||char.ancestry||"")+" "+(char.cls||"")).trim())+" — imported as-is</div>"
    +"<label style='"+lblCss+"'>Campaign name</label>"
    +"<input id='is-camp-name' type='text' value='"+escHtml(char.name)+"' style='"+inpCss+"margin-bottom:12px;'/>"
    +"<label style='"+lblCss+"'>World tone</label>"
    +"<select id='is-tone' style='"+inpCss+"margin-bottom:12px;'>"+toneOpts+"</select>"
    +"<label style='"+lblCss+"'>Starting location</label>"
    +"<select id='is-loc' style='"+inpCss+"'>"+locOpts+"</select>"
    +"<input id='is-loc-text' type='text' placeholder='Describe your starting place…' style='display:none;"+inpCss+"margin-top:6px;'/>"
    +"<div style='font-size:10px;color:var(--t2);margin:12px 0 16px;'>Companions can be added once in-game: File &gt; Import Character &gt; Add as companion.</div>"
    +"<div style='display:flex;gap:10px;'>"
    +"<button id='is-go' style='flex:1;padding:11px;font-size:13px;font-family:var(--font);background:var(--acc);color:var(--on-acc);border:none;border-radius:var(--r);cursor:pointer;font-weight:bold;'>Begin your journey</button>"
    +"<button id='is-cancel' style='padding:11px 18px;font-size:13px;font-family:var(--font);background:none;border:1px solid var(--brd2);color:var(--t2);border-radius:var(--r);cursor:pointer;'>Cancel</button>"
    +"</div></div>";
  document.body.appendChild(modal);
  document.getElementById("is-cancel").addEventListener("click",function(){modal.remove();});
  document.getElementById("is-loc").addEventListener("change",function(){document.getElementById("is-loc-text").style.display=this.value==="custom"?"block":"none";});
  document.getElementById("is-go").addEventListener("click",function(){
    var cn=document.getElementById("is-camp-name").value.trim()||char.name;
    var tone=TONES[parseInt(document.getElementById("is-tone").value)||0]||TONES[2];
    var loc=document.getElementById("is-loc").value;
    if(loc==="custom"){var lt=document.getElementById("is-loc-text").value.trim();loc=lt||"A place of your choosing";}
    modal.remove();
    snapshotActiveCamp();
    store.del(WSK);store.del(SLK);store.del(MEM_KEY);
    var nid=newCampaignId();setActiveCampId(nid);
    worldState=null;sessionLog=[];memory=blankMemory();
    document.getElementById("story-narrative").innerHTML="";document.getElementById("story-tabletalk").innerHTML="";
    char._campName=cn;char._startLoc=loc;
    startGame(char,tone.nm,tone.vc); // 3-arg on purpose: import flow has no author picker — campaign inherits the device default voice
  });
}
function _addImportedCompanion(char){
  if(!worldState){showToast("No active campaign to add companion to.");return;}
  // Check if already in party
  for(var i=0;i<worldState.npcs.length;i++){if(worldState.npcs[i].name===char.name){showToast(char.name+" is already in this campaign.");return;}}
  if(partyCompanionCount()>=partyCompanionCap()){showToast("Party full (max "+PARTY_MAX+", incl. you). Remove a companion before adding "+char.name+".");return;}
  // Add as party member NPC with full charSheet
  var npc={name:char.name,status:"ally",rel:"companion",met:worldState.turn,partyMember:true,pronouns:pronounsForGender(char.gender),portrait:null,charSheet:char}; // portrait rides on charSheet only (#3 dedupe)
  worldState.npcs.push(npc);
  if(!memory.npcs[char.name])memory.npcs[char.name]={attitude:"ally",knowledge:[],events:[]};
  memory.npcs[char.name].partyMember=true;
  npcLinkUpsert(worldState.character.name,char.name,"companions");
  saveAll();syncUI();
  showToast(char.name+" added as companion.");
  // Introduce companion into the current scene
  var intro="[Internal — not a player action] "+char.name+" joins the scene. They are a "+(char.subraceNm?char.subraceNm+" ":"")+char.ancestry+" "+char.cls+(char.archetypeNm?" ["+char.archetypeNm+"]":"")+", Level "+char.level+". "+(char.appear?'Appearance: "'+char.appear+(char.mark?" — "+char.mark:"")+'".':"")+(char.trait?" Trait: "+char.trait+".":"")+(char.flaw?" Flaw: "+char.flaw+".":"")+" Weave their arrival naturally into the current scene.";
  sendAction(intro,{silent:true});
}
function importCharacterFile(e){
  var file=e.target.files&&e.target.files[0];if(!file)return;
  var reader=new FileReader();
  reader.onload=function(ev){
    try{
      var data=JSON.parse(ev.target.result);
      if(!data.character||!data.character.name){showToast("Invalid character file.");return;}
      var char=data.character;
      if(!char.skills)char.skills=initSkills();if(!char.conditions)char.conditions=[];if(!char.relationships)char.relationships=[];
      if(!char.saveModifiers)char.saveModifiers=[];if(!char.languages)char.languages=[];if(char.portrait===undefined)char.portrait=null;
      if(!char.storyBeats)char.storyBeats=[];if(!char.abilities)char.abilities=[];if(!char.spells)char.spells=[];
      var inCreation2=document.getElementById("char-screen").style.display!=="none";
      showCharImportPreview(char, function(){
        if(inCreation2)_importCharToReview(char);else _startImportedCampaign(char);
      },showCharacterBrowser);
    }catch(err){showToast("Failed to import: "+err.message);}
  };
  reader.readAsText(file);e.target.value="";
}
// ── Character library ─────────────────────────────────────────────────────────
function _charLibSlug(name){return(name||"").toLowerCase().replace(/[^a-z0-9]+/g,"_").replace(/^_|_$/g,"");}

function _showCharExportOptions(char){
  var ex=document.getElementById("char-export-opts");if(ex)ex.remove();
  var modal=document.createElement("div");modal.id="char-export-opts";
  modal.style.cssText="position:fixed;inset:0;background:rgba(0,0,0,.88);z-index:400;display:flex;align-items:center;justify-content:center;padding:20px;";
  var connected=storageAdapter.isServerMode();
  modal.innerHTML="<div style='background:var(--modal-bg);border:1px solid var(--acc);border-radius:12px;padding:24px;max-width:380px;width:100%;'>"
    +"<div style='font-size:15px;color:var(--t0);font-weight:bold;margin-bottom:4px;'>Export "+escHtml(char.name)+"</div>"
    +"<div style='font-size:11px;color:var(--t2);margin-bottom:20px;'>Lv"+char.level+" "+escHtml((char.subraceNm||char.ancestry||"")+" "+(char.cls||"")).trim()+"</div>"
    +"<div style='display:flex;flex-direction:column;gap:8px;'>"
    +"<button id='ceo-character-library' style='padding:11px;font-size:13px;font-family:var(--font);background:"+(connected?"var(--acc)":"var(--bg3)")+";color:"+(connected?"var(--on-acc)":"var(--t2)")+";border:none;border-radius:var(--r);cursor:"+(connected?"pointer":"default")+";font-weight:bold;"+(connected?"":"")+";'>&#9729; Save to character library"+(connected?"":" <span style='font-size:10px;font-weight:normal;'>(not connected)</span>")+"</button>"
    +"<button id='ceo-file' style='padding:10px;font-size:13px;font-family:var(--font);background:var(--bg2);border:1px solid var(--brd2);color:var(--t1);border-radius:var(--r);cursor:pointer;'>&#8595; Download .char file</button>"
    +"<button id='ceo-cancel' style='padding:8px;font-size:12px;font-family:var(--font);background:none;border:none;color:var(--t2);cursor:pointer;'>Cancel</button>"
    +"</div></div>";
  document.body.appendChild(modal);
  modal.addEventListener("click",function(e){if(e.target===modal)modal.remove();});
  document.getElementById("ceo-cancel").addEventListener("click",function(){modal.remove();});
  document.getElementById("ceo-file").addEventListener("click",function(){modal.remove();_doExportChar(char.name,char);showToast("Character downloaded.");});
  var libBtn=document.getElementById("ceo-character-library");
  if(!connected){libBtn.addEventListener("click",function(){showToast("Connect to server to use the character library.");});return;}
  libBtn.addEventListener("click",function(){
    libBtn.textContent="Checking…";libBtn.disabled=true;
    storageAdapter.listCharacterLibrary(function(err,list){
      if(err){modal.remove();showToast("Character library error: "+err);return;}
      var slug=_charLibSlug(char.name),existing=null;
      for(var i=0;i<list.length;i++){if(list[i].slug===slug){existing=list[i];break;}}
      if(existing){modal.remove();_showCharOverwriteConfirm(char,existing);}
      else{storageAdapter.saveCharacterToLibrary(char,function(err2){modal.remove();if(err2)showToast("Save failed: "+err2);else showToast("&#9729; "+char.name+" saved to the character library.");});}
    });
  });
}

function _showCharOverwriteConfirm(char,existing){
  var ex=document.getElementById("char-overwrite-modal");if(ex)ex.remove();
  var modal=document.createElement("div");modal.id="char-overwrite-modal";
  modal.style.cssText="position:fixed;inset:0;background:rgba(0,0,0,.88);z-index:400;display:flex;align-items:center;justify-content:center;padding:20px;";
  modal.innerHTML="<div style='background:var(--modal-bg);border:1px solid var(--acc);border-radius:12px;padding:24px;max-width:360px;width:100%;'>"
    +"<div style='font-size:15px;color:var(--t0);font-weight:bold;margin-bottom:8px;'>Overwrite character library entry?</div>"
    +"<div style='font-size:13px;color:var(--t2);margin-bottom:20px;'>Character library has <span style='color:var(--t1);'>"+escHtml(existing.name)+" Lv"+existing.level+"</span>. Replace with <span style='color:var(--acc);'>Lv"+char.level+"</span>?</div>"
    +"<div style='display:flex;gap:10px;'>"
    +"<button id='cow-ok' style='flex:1;padding:10px;font-family:var(--font);background:var(--acc);color:var(--on-acc);border:none;border-radius:var(--r);cursor:pointer;font-weight:bold;'>Overwrite</button>"
    +"<button id='cow-cancel' style='flex:1;padding:10px;font-family:var(--font);background:none;border:1px solid var(--brd2);color:var(--t2);border-radius:var(--r);cursor:pointer;'>Cancel</button>"
    +"</div></div>";
  document.body.appendChild(modal);
  document.getElementById("cow-cancel").addEventListener("click",function(){modal.remove();});
  document.getElementById("cow-ok").addEventListener("click",function(){
    var btn=document.getElementById("cow-ok");btn.textContent="Saving…";btn.disabled=true;
    storageAdapter.saveCharacterToLibrary(char,function(err){modal.remove();if(err)showToast("Save failed: "+err);else showToast("&#9729; "+char.name+" updated in the character library.");});
  });
}

// The standalone Character Library is now the Library tab of the unified Import Character browser.
function showCharacterLibrary(){showCharacterBrowser("library");}
// Read-only character-sheet viewer — renders any character object (e.g. a library snapshot)
// using the same cs-* styling as showCharSheet, with none of the live-game editing wiring.
// opts.onImport, if supplied, adds an Import button to the header.
function showReadOnlyCharSheet(c,opts){
  if(!c)return;
  var ex=document.getElementById("ro-cs-modal");if(ex)ex.remove();
  opts=opts||{};
  var initials=csInitials(c.name||"?");
  var hdr=csHeroHeader(c);
  var modal=document.createElement("div");modal.id="ro-cs-modal";
  modal.style.cssText="position:fixed;inset:0;background:rgba(0,0,0,.88);z-index:420;display:flex;align-items:flex-start;justify-content:center;padding:20px;overflow-y:auto;-webkit-overflow-scrolling:touch;";
  var importBtn=opts.onImport?"<button id='ro-cs-import' style='font-size:11px;font-family:var(--font);padding:4px 12px;border:none;border-radius:var(--r);background:var(--acc);color:var(--on-acc);font-weight:bold;cursor:pointer;'>Import</button>":"";
  modal.innerHTML="<div style='background:var(--modal-bg);border:1px solid var(--acc);border-radius:12px;padding:24px;max-width:560px;width:100%;margin:20px 0 40px;'>"
    +"<div style='display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;'><span style='font-size:11px;color:var(--t2);font-style:italic;'>Character library snapshot &middot; read-only</span><div style='display:flex;gap:8px;align-items:center;'>"+importBtn+"<button id='ro-cs-x' style='background:none;border:none;color:var(--t2);font-size:24px;cursor:pointer;padding:0 4px;line-height:1;'>&#215;</button></div></div>"
    +"<div class='cs-hero'>"
    +"<div style='position:relative;flex-shrink:0;'>"
    +"<div class='cs-avatar'>"+(c.portrait?"<img src='"+c.portrait+"' alt='"+(c.name||"")+"' style='width:100%;height:100%;object-fit:cover;display:block;'>":initials)+"</div>"
    +"</div>"
    +"<div class='cs-hero-info'>"
    +"<div class='cs-hero-name'>"+(c.name||"—")+"</div>"
    +"<div class='cs-hero-cls'>"+hdr.clsLine+"</div>"
    +"<div class='cs-hero-sub'>"+hdr.genderLbl+(c.age?" · "+c.age:"")+(c.deity?" · "+c.deity:"")+"</div>"
    +"<div style='margin-top:8px;font-size:13px;'>"
    +"<span style='color:var(--acc)'>Lv "+hdr.lvl+"</span>"
    +" &nbsp;·&nbsp; <span style='color:var(--hp)'>"+(c.hp!=null?c.hp:"—")+"/"+(c.maxHp!=null?c.maxHp:"—")+" HP</span>"
    +" &nbsp;·&nbsp; <span style='color:var(--gold)'>"+(c.gold!=null?c.gold:0)+" gp</span>"
    +" &nbsp;·&nbsp; <span style='color:var(--t2)'>"+(c.actualAlignment||c.statedAlignment||"Neutral")+"</span>"
    +"</div>"
    +"<div class='cs-xp-wrap'>"
    +"<div class='cs-xp-lbl'><span>"+(c.xp||0)+" XP</span><span>"+(hdr.lvl<10?"Next: "+hdr.nextXP+" XP":"Max level")+"</span></div>"
    +"<div class='cs-xp-bar'><div class='cs-xp-fill' style='width:"+hdr.xpPct+"%;'></div></div>"
    +"</div>"
    +"</div></div>"
    +csSheetSections(c)
    +"</div>";
  document.body.appendChild(modal);
  document.getElementById("ro-cs-x").addEventListener("click",function(){modal.remove();});
  modal.addEventListener("click",function(e){if(e.target===modal)modal.remove();});
  if(opts.onImport){document.getElementById("ro-cs-import").addEventListener("click",function(){modal.remove();opts.onImport();});}
  csWireToggles(modal);
}
// ── Campaign-start companion selection ────────────────────────────────────────
function _renderCompanionSlots(){
  var sec=document.getElementById("companion-section");if(!sec)return;
  var max=3;
  var h="<div style='font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:var(--t2);margin-bottom:8px;'>Companions <span style='font-size:10px;color:var(--brd2);text-transform:none;letter-spacing:0;'>(optional, max 3)</span></div>";
  if(pendingCompanions.length){
    h+="<div style='display:flex;flex-direction:column;gap:6px;margin-bottom:8px;'>";
    for(var i=0;i<pendingCompanions.length;i++){
      var comp=pendingCompanions[i];
      var ini=(comp.name||"?").split(" ").map(function(w){return w[0]||"";}).join("").toUpperCase().slice(0,2);
      var av=comp.portrait?"<img src='"+comp.portrait+"' style='width:32px;height:32px;border-radius:50%;object-fit:cover;flex-shrink:0;'>"
        :"<div style='width:32px;height:32px;border-radius:50%;background:var(--bg3);border:1px solid var(--acc);display:flex;align-items:center;justify-content:center;font-size:11px;color:var(--acc);font-weight:bold;flex-shrink:0;'>"+ini+"</div>";
      h+="<div style='display:flex;align-items:center;gap:10px;padding:8px 10px;background:var(--bg2);border-radius:var(--r);'>"+av
        +"<div style='flex:1;min-width:0;'><div style='font-size:13px;color:var(--t0);font-weight:bold;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;'>"+escHtml(comp.name)+"</div>"
        +"<div style='font-size:10px;color:var(--t2);'>Lv"+comp.level+" "+escHtml((comp.subraceNm||comp.ancestry||"")+" "+comp.cls).trim()+"</div></div>"
        +"<button onclick='_removePendingCompanion("+i+")' style='background:none;border:none;color:var(--t2);cursor:pointer;font-size:18px;padding:2px 8px;line-height:1;' title='Remove'>&#215;</button>"
        +"</div>";
    }
    h+="</div>";
  }
  if(pendingCompanions.length<max){
    h+="<button onclick='showCompanionBrowser()' style='font-size:12px;font-family:var(--font);padding:8px 14px;background:var(--bg2);border:1px solid var(--brd2);border-radius:var(--r);color:var(--t1);cursor:pointer;width:100%;text-align:center;'>+ Add companion…</button>";
  }
  sec.innerHTML=h;
}
function _addPendingCompanion(char){
  if(pendingCompanions.length>=3){showToast("Max 3 companions.");return;}
  for(var i=0;i<pendingCompanions.length;i++){if(pendingCompanions[i].name===char.name){showToast(char.name+" already added.");return;}}
  if(cs&&cs.name&&cs.name===char.name){showToast("That's your own character.");return;}
  pendingCompanions.push(char);
  _renderCompanionSlots();
  showToast(char.name+" added as companion.");
}
function _removePendingCompanion(idx){
  pendingCompanions.splice(idx,1);
  _renderCompanionSlots();
}
function showCompanionBrowser(){
  var ex=document.getElementById("char-browser-modal");if(ex)ex.remove();
  var modal=document.createElement("div");modal.id="char-browser-modal";
  modal.style.cssText="position:fixed;inset:0;background:rgba(0,0,0,.88);z-index:500;display:flex;align-items:flex-start;justify-content:center;padding:20px;overflow-y:auto;";
  var tok=localStorage.getItem("tnd_server_tok_v1")||"";
  var url=(localStorage.getItem("tnd_server_url_v1")||"").replace(/\/$/,"");
  var connected=!!(tok&&url);
  var mode=connected?"library":"local";
  function getChar(id,cb){
    if(id===getActiveCampId()){var live=store.get(WSK);if(live){try{var lws=JSON.parse(live);if(lws&&lws.character)return cb(null,lws.character);}catch(e){}}}
    var raw=store.get("tnd_camp_"+id+"_ws");
    if(raw){try{var ws=JSON.parse(raw);if(ws&&ws.character)return cb(null,ws.character);}catch(e){}}
    if(!url||!tok){return cb("Not available locally.");}
    fetch(url+"/api/campaigns/"+id,{headers:{"Authorization":"Bearer "+tok}})
      .then(function(r){if(!r.ok)throw new Error("HTTP "+r.status);return r.json();})
      .then(function(d){if(d&&d.worldState&&d.worldState.character)cb(null,d.worldState.character);else cb("No character data.");})
      .catch(function(e){cb(e.message);});
  }
  function isAlreadyAdded(name){for(var j=0;j<pendingCompanions.length;j++){if(pendingCompanions[j].name===name)return true;}return false;}
  function compRow(name,sub,pickId,pickType){
    var added=isAlreadyAdded(name);
    var isPlayer=(cs&&cs.name&&cs.name===name);
    var full=(pendingCompanions.length>=3&&!added);
    var dis=added||isPlayer||full;
    var btnLbl=isPlayer?"You":added?"Added":"Select";
    return "<div class='cbr-row' style='display:flex;align-items:center;gap:12px;padding:12px 14px;background:var(--bg2);border:1px solid var(--brd);border-radius:8px;margin-bottom:8px;"+(dis?"opacity:.45;":"")+"'>"
      +"<div class='cbr-txt' style='flex:1;min-width:0;'>"
      +"<div class='cbr-name'>"+escHtml(name)+"</div>"
      +"<div class='cbr-sub'>"+sub+"</div>"
      +"</div>"
      +"<button data-pick-id='"+escHtml(pickId)+"' data-pick-type='"+pickType+"' "+(dis?"disabled":"")+
      " style='padding:6px 14px;font-size:12px;font-family:var(--font);background:"+(dis?"var(--bg3)":"var(--acc)")+";color:"+(dis?"var(--t2)":"#000")+";border:none;border-radius:var(--r);cursor:"+(dis?"default":"pointer")+";flex-shrink:0;'>"+btnLbl+"</button>"
      +"</div>";
  }
  function renderLocal(){
    var list=document.getElementById("comp-list");if(!list)return;
    var meta=getCampMeta().slice().sort(function(a,b){return b.savedAt-a.savedAt;});
    if(!meta.length){list.innerHTML="<div style='padding:20px;text-align:center;color:var(--t2);font-size:12px;font-style:italic;'>No saved campaigns found.</div>";return;}
    var h="",i;for(i=0;i<meta.length;i++){
      var cm=meta[i];
      h+=compRow(cm.charName,"Lv"+cm.level+" "+escHtml(cm.charAncestry)+" "+escHtml(cm.charClass)+"&ensp;&mdash;&ensp;"+escHtml(cm.location),cm.id,"local");
    }
    list.innerHTML=h;
    wirePicks();
  }
  function renderLibrary(){
    var list=document.getElementById("comp-list");if(!list)return;
    if(!connected){list.innerHTML="<div style='padding:20px;text-align:center;color:var(--t2);font-size:12px;font-style:italic;'>Not connected to server. Use File &#9656; Dev Mode &#9656; Connect server.</div>";return;}
    list.innerHTML="<div style='padding:20px;text-align:center;color:var(--t2);font-size:12px;font-style:italic;'>Loading character library…</div>";
    storageAdapter.listCharacterLibrary(function(err,entries){
      if(err){list.innerHTML="<div style='padding:20px;text-align:center;color:var(--t2);font-size:12px;font-style:italic;'>"+escHtml(String(err))+"</div>";return;}
      if(!entries||!entries.length){list.innerHTML="<div style='padding:20px;text-align:center;color:var(--t2);font-size:12px;font-style:italic;'>No characters in the character library.</div>";return;}
      var h="",i;for(i=0;i<entries.length;i++){
        var entry=entries[i];
        h+=compRow(entry.name,"Lv"+(entry.level||1)+" "+escHtml(entry.ancestry||"")+" "+escHtml(entry.cls||""),entry.slug,"library");
      }
      list.innerHTML=h;
      wirePicks();
    });
  }
  function wirePicks(){
    var btns=modal.querySelectorAll("[data-pick-id]"),bi;
    for(bi=0;bi<btns.length;bi++){
      (function(btn){
        btn.addEventListener("click",function(){
          var id=btn.getAttribute("data-pick-id");
          var type=btn.getAttribute("data-pick-type");
          btn.textContent="Loading…";btn.disabled=true;
          if(type==="library"){
            storageAdapter.listCharacterLibrary(function(err,entries){
              if(err){showToast("Could not load: "+err);btn.textContent="Select";btn.disabled=false;return;}
              var found=null,ci;for(ci=0;ci<entries.length;ci++){if(entries[ci].slug===id){found=entries[ci];break;}}
              if(!found||!found.character){showToast("Character data missing.");btn.textContent="Select";btn.disabled=false;return;}
              modal.remove();_addPendingCompanion(found.character);
            });
          }else{
            getChar(id,function(err,char){
              if(err){showToast("Could not load: "+err);btn.textContent="Select";btn.disabled=false;return;}
              modal.remove();_addPendingCompanion(char);
            });
          }
        });
      })(btns[bi]);
    }
  }
  function render(){if(mode==="library")renderLibrary();else renderLocal();}
  var segS="padding:7px 16px;font-size:12px;font-family:var(--font);cursor:pointer;border:1px solid var(--brd2);";
  function segBtn(lbl,val,pos){var sel=mode===val;return "<button data-seg='"+val+"' style='"+segS+"background:"+(sel?"var(--acc)":"var(--bg2)")+";color:"+(sel?"var(--on-acc)":"var(--t1)")+";border-radius:"+(pos==="left"?"var(--r) 0 0 var(--r)":"0 var(--r) var(--r) 0")+";font-weight:"+(sel?"bold":"normal")+";border-"+(pos==="left"?"right":"left")+":none;'>"+lbl+"</button>";}
  modal.innerHTML="<div style='background:var(--modal-bg);border:1px solid var(--acc);border-radius:12px;padding:24px;max-width:500px;width:100%;margin-top:40px;'>"
    +"<div style='display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;'>"
    +"<span style='font-size:16px;color:var(--t0);font-weight:bold;'>Add Companion</span>"
    +"<button id='cbr-x' style='background:none;border:none;color:var(--t2);font-size:20px;cursor:pointer;'>&#215;</button></div>"
    +"<div style='font-size:11px;color:var(--t2);margin-bottom:12px;'>"+pendingCompanions.length+" / 3 selected</div>"
    +"<div id='comp-seg' style='display:flex;margin-bottom:16px;'>"+segBtn("&#9729; Character Library","library","left")+segBtn("Local","local","right")+"</div>"
    +"<div id='comp-list'></div>"
    +"</div>";
  document.body.appendChild(modal);
  document.getElementById("cbr-x").addEventListener("click",function(){modal.remove();});
  modal.addEventListener("click",function(e){if(e.target===modal)modal.remove();});
  function wireSegs(){
    var segBtns=document.getElementById("comp-seg").querySelectorAll("button"),sbi;
    for(sbi=0;sbi<segBtns.length;sbi++){
      (function(sb){sb.addEventListener("click",function(){
        mode=sb.getAttribute("data-seg");
        document.getElementById("comp-seg").innerHTML=segBtn("&#9729; Character Library","library","left")+segBtn("Local","local","right");
        wireSegs();
        render();
      });})(segBtns[sbi]);
    }
  }
  wireSegs();
  render();
}
// ── Car Mode ──────────────────────────────────────────────────────────────────
var _carKbHandler = null;

function showCarMode() {
  if (!worldState || !worldState.character) { showToast("Start a game first."); return; }
  var ov = document.getElementById("car-overlay");
  if (!ov) return;
  carMode = true;
  ov.style.display = "flex";
  closeAllMenus();
  if (typeof TTS !== "undefined") TTS.primeAudioSession();
  _carUpdate();
  _carMediaSession();
  if (typeof TTS !== "undefined") TTS.setOnDone(function() { if (carMode) _carAutoMic(); });
  _carKbHandler = function(e) {
    if (e.key === " ")           { e.preventDefault(); _carTap(); }
    else if (e.key === "ArrowRight") { e.preventDefault(); _carNext(); }
    else if (e.key === "ArrowLeft")  { e.preventDefault(); _carPrev(); }
    else if (e.key === "Escape")     { e.preventDefault(); hideCarMode(); }
  };
  document.addEventListener("keydown", _carKbHandler);
  _carSetStatus("Ready");
  _carSyncBtn();
}

function hideCarMode() {
  carMode = false;
  var ov = document.getElementById("car-overlay");
  if (ov) ov.style.display = "none";
  if (_carKbHandler) { document.removeEventListener("keydown", _carKbHandler); _carKbHandler = null; }
  if (typeof TTS !== "undefined") { TTS.setOnDone(null); TTS.stopAudioSessionPrimer(); }
  if (typeof STT !== "undefined") STT.stop();
  if ("mediaSession" in navigator) {
    try {
      navigator.mediaSession.setActionHandler("play", null);
      navigator.mediaSession.setActionHandler("pause", null);
      navigator.mediaSession.setActionHandler("nexttrack", null);
      navigator.mediaSession.setActionHandler("previoustrack", null);
    } catch(e) {}
  }
}

function _carUpdate() {
  var c = worldState && worldState.character;
  if (!c) return;
  var nameEl = document.getElementById("car-name");
  if (nameEl) nameEl.textContent = c.name || "";
  var img = document.getElementById("car-portrait-img");
  var init = document.getElementById("car-portrait-init");
  if (img && init) {
    if (c.portrait) { img.src = c.portrait; img.style.display = ""; init.style.display = "none"; }
    else { img.style.display = "none"; init.style.display = ""; }
  }
  _carUpdateParty();
  _carMediaSession();
}

function _carUpdateParty() {
  var el = document.getElementById("car-party");
  if (!el || !worldState) return;
  var members = (worldState.npcs || []).filter(function(n) { return n.partyMember && n.charSheet; });
  if (!members.length) { el.innerHTML = ""; return; }
  var html = "", i, n, cs, ratio, col;
  for (i = 0; i < members.length; i++) {
    n = members[i]; cs = n.charSheet;
    ratio = cs.maxHp ? cs.hp / cs.maxHp : 1;
    col = ratio > 0.5 ? "var(--grn)" : ratio > 0.25 ? "var(--warn)" : "var(--dng)";
    html += "<div style='width:36px;height:36px;border-radius:50%;background:"+col+";display:flex;align-items:center;justify-content:center;font-size:11px;color:#fff;font-family:var(--font);font-weight:bold;border:2px solid var(--bg0);' title='"
      +escHtml(n.name)+" ("+cs.hp+"/"+cs.maxHp+" HP)'>"+escHtml((n.name||"?").slice(0,2))+"</div>";
  }
  el.innerHTML = html;
}

function _carSetStatus(text) {
  var el = document.getElementById("car-status");
  if (el) el.textContent = text;
}

function _carSyncBtn() {
  var btn = document.getElementById("car-tap-btn");
  if (!btn) return;
  if (typeof busy !== "undefined" && busy) {
    btn.innerHTML = "&#8943;"; btn.disabled = true;
    if ("mediaSession" in navigator) try { navigator.mediaSession.playbackState = "paused"; } catch(e) {}
    return;
  }
  btn.disabled = false;
  var ttsPlaying = typeof TTS !== "undefined" && TTS.isPlaying();
  var ttsPaused  = typeof TTS !== "undefined" && TTS.isPaused();
  var sttOn      = typeof STT !== "undefined" && STT.isListening();
  if (ttsPlaying)      { btn.innerHTML = "&#9208;"; if ("mediaSession" in navigator) try { navigator.mediaSession.playbackState = "playing"; } catch(e) {} }
  else if (ttsPaused)  { btn.innerHTML = "&#9654;"; if ("mediaSession" in navigator) try { navigator.mediaSession.playbackState = "paused"; } catch(e) {} }
  else if (sttOn)      { btn.innerHTML = "&#9209;"; if ("mediaSession" in navigator) try { navigator.mediaSession.playbackState = "paused"; } catch(e) {} }
  else                 { btn.innerHTML = "&#127908;"; if ("mediaSession" in navigator) try { navigator.mediaSession.playbackState = "paused"; } catch(e) {} }
}

function _carPulse(id) {
  var el = document.getElementById(id);
  if (!el) return;
  el.classList.remove("car-pulse");
  void el.offsetWidth;
  el.classList.add("car-pulse");
}

function _carTap() {
  if (typeof busy !== "undefined" && busy) return;
  _carPulse("car-tap-btn");
  var ttsPlaying = typeof TTS !== "undefined" && TTS.isPlaying();
  var ttsPaused  = typeof TTS !== "undefined" && TTS.isPaused();
  var sttOn      = typeof STT !== "undefined" && STT.isListening();
  if (ttsPlaying || ttsPaused) {
    if (typeof TTS !== "undefined") TTS.pause();
    _carSetStatus(ttsPlaying ? "Paused" : "Narrator speaking…");
    _carSyncBtn();
  } else if (sttOn) {
    if (typeof STT !== "undefined") STT.stop();
    _carSetStatus("Ready");
    _carSyncBtn();
  } else {
    _carStartMic();
  }
}

function _carNext() {
  if (typeof busy !== "undefined" && busy) return;
  _carPulse("car-next-btn");
  var ttsPlaying = typeof TTS !== "undefined" && TTS.isPlaying();
  if (ttsPlaying) {
    if (typeof TTS !== "undefined") TTS.skip();
    // onDone fires → _carAutoMic() handles the rest
  } else {
    _carStartMic();
  }
}

function _carPrev() {
  if (typeof busy !== "undefined" && busy) return;
  _carPulse("car-prev-btn");
  var last = typeof TTS !== "undefined" ? TTS.getLastText() : "";
  if (!last) return;
  if (typeof STT !== "undefined") STT.stop();
  if (typeof TTS !== "undefined") { TTS.stop(); TTS.speak(last); }
  _carSetStatus("Narrator speaking…");
  setTimeout(function() { if (carMode) _carSyncBtn(); }, 100);
}

function _carStartMic() {
  if (typeof STT === "undefined" || !STT.isSupported()) { _carSetStatus("Voice input not available in this browser"); return; }
  var inp = document.getElementById("userinput");
  if (inp) inp.value = "";
  _carSetStatus("Listening…");
  _carSyncBtn();
  STT.start();
}

function _carAutoMic() {
  if (!carMode) return;
  _carSetStatus("Tap to speak");
  _carSyncBtn();
  setTimeout(function() {
    if (!carMode || (typeof busy !== "undefined" && busy) || (typeof STT !== "undefined" && STT.isListening())) return;
    _carStartMic();
  }, 800);
}

function _carMediaSession() {
  if (!("mediaSession" in navigator)) return;
  var c = worldState && worldState.character;
  var artwork = (c && c.portrait) ? [{ src: c.portrait, sizes: "512x512", type: "image/jpeg" }] : [];
  try {
    navigator.mediaSession.metadata = new MediaMetadata({
      title:  (c && c.name)               || "Traffic and Dragons",
      artist: "Traffic and Dragons",
      album:  (worldState && worldState.campName) || "",
      artwork: artwork
    });
    navigator.mediaSession.setActionHandler("play",          function() { if (carMode) _carTap(); });
    navigator.mediaSession.setActionHandler("pause",         function() { if (carMode) _carTap(); });
    navigator.mediaSession.setActionHandler("nexttrack",     function() { if (carMode) _carNext(); });
    navigator.mediaSession.setActionHandler("previoustrack", function() { if (carMode) _carPrev(); });
  } catch(e) {}
}

// ── File-menu generator (v1.159) ────────────────────────────────────────────
// ONE spec renders all three File menus (#file-menu / #cs-file-menu / #api-file-menu)
// at boot. Replaces the hand-synced triplicate HTML — the old "three menus must stay
// in sync" convention is dead: edit this spec and all three surfaces change together.
// Emits the EXACT ids the rest of wireButtons has always bound to (fm-/cs-fm-/api-fm-
// prefixes; import inputs use their own ""/"cs-"/"api-" prefix), so no other wiring
// changes. Per-surface differences: the char/API screens grey out game-dependent items
// (no active game yet) and swap the game menu's mobile-only quick actions for
// always-visible disabled placeholders.
function buildFileMenus(){
  function hov(bg){return " onmouseover=\"this.style.background='"+(bg||"var(--bg2)")+"'\" onmouseout=\"this.style.background='none'\"";}
  function padFor(depth){return depth===2?"7px 30px":depth===1?"7px 22px":"8px 14px";}
  function baseStyle(depth,color,extra){return "width:100%;padding:"+padFor(depth)+";font-size:12px;font-family:var(--font);background:none;border:none;color:"+(color||"var(--t1)")+";text-align:left;"+(extra||"");}
  // opts: {color, extra, cls, hidden, dim, hovBg}
  function btn(id,label,depth,opts){
    opts=opts||{};
    if(opts.dim)return "<button style='display:block;"+baseStyle(depth,opts.color)+"opacity:0.4;cursor:default;pointer-events:none;'>"+label+"</button>";
    return "<button id='"+id+"'"+(opts.cls?" class='"+opts.cls+"'":"")+" style='display:"+(opts.hidden?"none":"block")+";"+baseStyle(depth,opts.color,opts.extra)+"cursor:pointer;'"+hov(opts.hovBg)+">"+label+"</button>";
  }
  function fileLbl(inpId,label,depth){return "<label style='display:block;padding:"+padFor(depth)+";font-size:12px;font-family:var(--font);color:var(--t1);cursor:pointer;'"+hov()+"><input type='file' id='"+inpId+"' accept='.tnd,.json' style='display:none;'/>"+label+"</label>";}
  function chk(cbId,label,depth,lblId){return "<label"+(lblId?" id='"+lblId+"'":"")+" style='display:flex;align-items:center;gap:8px;padding:"+padFor(depth)+";font-size:12px;font-family:var(--font);color:var(--t1);cursor:pointer;'"+hov()+"><input type='checkbox' id='"+cbId+"' style='accent-color:var(--acc);cursor:pointer;width:13px;height:13px;'/> "+label+"</label>";}
  function sep(inner){return "<div style='border-top:1px solid var(--brd"+(inner?"2":"")+");margin:4px 0;'></div>";}
  // Drawers render as SIDE FLYOUTS on desktop and inline accordions ≤768px — the
  // positioning/skin lives on the fm-subwrap/fm-sub CSS classes (index.html), only
  // the open/closed display state is inline (the JS toggle flips it).
  function drawerBtn(id,label,depth,color){return "<button id='"+id+"' style='display:flex;width:100%;padding:"+padFor(depth)+";font-size:12px;font-family:var(--font);background:none;border:none;color:"+(color||"var(--t1)")+";cursor:pointer;text-align:left;justify-content:space-between;align-items:center;box-sizing:border-box;'"+hov()+"><span>"+label+"</span><span id='"+id+"-arrow' style='font-size:10px;transition:transform .15s;'>▶</span></button>";}
  function drawer(btnId,boxId,label,depth,color,inner){return "<div class='fm-subwrap'>"+drawerBtn(btnId,label,depth,color)+"<div id='"+boxId+"' class='fm-sub' style='display:none;'>"+inner+"</div></div>";}
  [{mount:"file-menu",p:"fm-",imp:"",game:true},
   {mount:"cs-file-menu",p:"cs-fm-",imp:"cs-",game:false},
   {mount:"api-file-menu",p:"api-fm-",imp:"api-",game:false}].forEach(function(sf){
    var el=document.getElementById(sf.mount);if(!el)return;
    var p=sf.p,g=sf.game,h="";
    h+="<div id='"+p+"version' style='padding:6px 14px;font-size:10px;color:var(--t2);letter-spacing:.05em;user-select:none;border-bottom:1px solid var(--brd);'></div>";
    if(g){
      h+=btn("fm-sync-mob","Sync state",0,{cls:"fm-mobile-only",hidden:true})
        +btn("fm-state-mob","World state",0,{cls:"fm-mobile-only",hidden:true})
        +btn("fm-render-mob","Render prompt",0,{cls:"fm-mobile-only",hidden:true})
        +"<div class='fm-mobile-only' style='display:none;border-top:1px solid var(--brd);margin:4px 0;'></div>";
    }else{
      h+=btn(null,"Sync state",0,{dim:true})+btn(null,"World state",0,{dim:true})+btn(null,"Render prompt",0,{dim:true})+sep();
    }
    h+=btn(p+"campaigns","&#128193; Campaigns&hellip;",0,{color:"var(--acc)",extra:"font-weight:bold;"});
    h+=g?btn(p+"carmode","&#128663; Car Mode",0):btn(null,"&#128663; Car Mode",0,{dim:true});
    h+=sep();
    var sl=(g?btn(p+"export","Save Game (local)",0):btn(null,"Save Game (local)",0,{dim:true}))
      +fileLbl(sf.imp+"import-inp","Load Game (local)",0)
      +(g?btn(p+"export-char","Export Character",0):btn(null,"Export Character",0,{dim:true}))
      +btn(sf.imp+"import-char-btn","Import Character",0)
      +(g?btn(p+"export-bp","Export as Blueprint",0):btn(null,"Export as Blueprint",0,{dim:true}));
    h+=drawer(p+"saveload",p+"saveloadmenu","&#128190; Save / Load",0,null,sl);
    h+=btn(p+"blueprints","&#9729; Blueprint Library&hellip;",0);
    h+=sep();
    var narr=btn(p+"rules","Narrative rules",0)
      +btn(p+"prose","✍ Prose inspiration&hellip;",0)
      +chk(p+"adult-cb","18+ Adult content",0,p+"adult-label");
    var dm=btn(p+"tts-settings","🔊 Voice Settings&hellip;",0)
      +drawer(p+"narropts",p+"narroptsmenu","&#128214; Narrative options",0,null,narr)
      +btn(p+"llm","🧠 Language Model&hellip;",0)
      +btn(p+"usage","📊 Usage &amp; cost&hellip;",0)
      +btn(p+"rag","🗂 Episodic memory&hellip;",0)
      +btn(p+"fal-key","🖼 Render Options&hellip;",0)
      +chk(p+"font-lg","Large text",0)
      +chk(p+"autosend","&#127908; Auto-send voice input",0)
      +chk(p+"legacy-cb","&#9760; Legacy characters as NPCs",0)
      +"<div style='display:flex;align-items:center;gap:6px;padding:2px 14px 7px;'><span style='font-size:11px;color:var(--t2);'>Chance per session:</span><input type='number' id='"+p+"legacy-pct' min='1' max='100' value='5' style='width:44px;padding:3px 5px;background:var(--bg2);border:1px solid var(--brd2);border-radius:4px;color:var(--t0);font-size:12px;font-family:var(--font);'/><span style='font-size:11px;color:var(--t2);'>%</span></div>"
      +sep(true)
      +btn(p+"set-folder","📁 Set campaign folder&hellip;",0)
      +btn(p+"clear-folder","📁 &times;",0,{hidden:true,color:"var(--acc)",extra:"overflow:hidden;text-overflow:ellipsis;white-space:nowrap;"})
      +btn(p+"server-connect","☁ Connect to server",0)
      +btn(p+"server-disconnect","☁ Disconnect (<span id='"+p+"server-user'></span>)",0,{hidden:true})
      +btn(p+"clearcache","⟳ Clear cache &amp; reload",0,{color:"var(--t2)"});
    h+=drawer(p+"devmode",p+"devmenu","⚙ Admin",0,"var(--t2)",dm);
    h+=btn(p+"clearcache-top","⟳ Clear cache &amp; reload",0,{color:"var(--t2)"});
    h+=sep();
    h+=g?btn(p+"newgame","New Game",0,{color:"var(--dng)",hovBg:"var(--dng-faint)"}):btn(null,"New Game",0,{dim:true,color:"var(--dng)"});
    el.innerHTML=h;
  });
}
// Close every flyout/drawer in a menu and reset its arrows — called when a File menu
// OPENS, so a flyout left open last time doesn't pop back as a floating panel.
function resetFileSubmenus(menuEl){
  if(!menuEl)return;
  Array.prototype.forEach.call(menuEl.querySelectorAll(".fm-sub"),function(s){s.style.display="none";s.style.left="";s.style.right="";});
  Array.prototype.forEach.call(menuEl.querySelectorAll("[id$='-arrow']"),function(a){a.style.transform="";});
}
function wireButtons(){
  buildFileMenus(); // all three File menus render from ONE spec before any wiring binds to them
  document.getElementById("api-btn").addEventListener("click",submitKey);
  document.getElementById("api-input").addEventListener("keydown",function(e){if(e.key==="Enter")submitKey();});
  document.getElementById("tone-next").addEventListener("click",function(){if(cs.tone==="custom"){var t=document.getElementById("tone-ct");if(!t||!t.value.trim()){document.getElementById("s1-warn").textContent="Describe your custom tone.";return;}}document.getElementById("s1-warn").textContent="";goStep(2);});
  document.getElementById("id-back").addEventListener("click",function(){goStep(1);});
  document.getElementById("anc-back-detail").addEventListener("click",hideAncDetail);
  document.getElementById("anc-next").addEventListener("click",function(){cs.gender=document.getElementById("char-gender").value;cs.age=document.getElementById("char-age").value;if(!cs.ancestry){document.getElementById("s2-warn").textContent="Choose an ancestry.";return;}if(!cs.subrace){document.getElementById("s2-warn").textContent="Choose a subrace.";return;}var i,a=null;for(i=0;i<ANCS.length;i++){if(ANCS[i].id===cs.ancestry){a=ANCS[i];break;}}if(cs.ancestry==="halfblood"&&cs.subrace&&a&&a.subraces){var selH=null,hk2;for(hk2=0;hk2<a.subraces.length;hk2++){if(a.subraces[hk2].id===cs.subrace){selH=a.subraces[hk2];break;}}if(selH&&selH.lineages&&selH.lineages.length&&!cs.heritageVariant){document.getElementById("s2-warn").textContent="Choose a "+selH.nm+" lineage.";return;}}if(a&&a.fc>0&&cs.fp.length<a.fc){document.getElementById("s2-warn").textContent="Choose "+a.fc+" stat bonuses.";return;}document.getElementById("s2-warn").textContent="";goStep(3);});
  document.getElementById("cls-back").addEventListener("click",function(){goStep(2);});
  document.getElementById("cls-next").addEventListener("click",function(){if(!cs.cls){document.getElementById("s3-warn").textContent="Choose a class.";return;}document.getElementById("s3-warn").textContent="";goStep(4);});
  document.getElementById("sts-back").addEventListener("click",function(){goStep(3);});
  document.getElementById("sts-next").addEventListener("click",function(){if(!cs.rolled&&cs.statMode==="roll"){document.getElementById("s4-warn").textContent="Roll your stats first.";return;}document.getElementById("s4-warn").textContent="";goStep(5);});
  document.getElementById("roll-btn").addEventListener("click",rollAllStats);
  document.getElementById("char-alignment").addEventListener("change",function(){if(!cs.deityEdited)buildStep6Deity();});
  document.getElementById("char-deity").addEventListener("input",function(){cs.deityEdited=this.value!==getDefaultDeity();});
  document.getElementById("ft-back").addEventListener("click",function(){goStep(4);});
  document.getElementById("ft-next").addEventListener("click",function(){cs.appear=document.getElementById("char-appear").value.trim();cs.backstory=document.getElementById("char-backstory").value.trim();goStep(6);});
  document.getElementById("ft-upload").addEventListener("click",function(){document.getElementById("ft-portrait-file").click();});
  document.getElementById("ft-portrait-file").addEventListener("change",function(){var file=this.files[0];if(!file)return;var reader=new FileReader();reader.onload=function(e){compressPortrait(e.target.result,function(compressed){cs.portrait=compressed;refreshFtPortrait();});};reader.readAsDataURL(file);this.value="";});
  document.getElementById("ft-render").addEventListener("click",function(){ftRenderPortrait();});
  document.getElementById("ft-derive").addEventListener("click",function(){ftDeriveAppearance();});
  document.getElementById("rv-back").addEventListener("click",function(){pendingImportChar=null;goStep(5);});
  document.getElementById("rv-go").addEventListener("click",confirmChar);
  document.getElementById("rv-randomise").addEventListener("click",function(){aiRandomiseAll(this);});
  injectSparkleButtons();
  document.getElementById("rv-start-loc").addEventListener("change",function(){document.getElementById("rv-start-loc-custom").style.display=this.value==="custom"?"block":"none";});
  document.getElementById("rv-start-level").addEventListener("change",function(){var b=document.getElementById("rv-go");if(b)b.textContent=parseInt(this.value)>=3?"Assign level perks":"Begin your journey";buildDots();});
  document.getElementById("char-name").addEventListener("input",function(){cs.name=this.value.trim();buildReview();});
  document.getElementById("state-btn").addEventListener("click",function(){document.getElementById("sidebar").classList.toggle("open");});
  document.getElementById("sb-close").addEventListener("click",function(){document.getElementById("sidebar").classList.remove("open");});
  document.getElementById("sendbtn").addEventListener("click",function(){sendAction(null);});
  document.getElementById("userinput").addEventListener("keydown",function(e){if(e.key==="Enter"&&!e.shiftKey)sendAction(null);});
  document.getElementById("sync-btn").addEventListener("click",showSyncModal);
  document.getElementById("render-btn").addEventListener("click",doRender);
  var _rrb=document.getElementById("reroll-btn");if(_rrb)_rrb.addEventListener("click",rerollLast);
  document.getElementById("file-btn").addEventListener("click",function(e){e.stopPropagation();var fm=document.getElementById("file-menu");var opening=fm.style.display!=="block";if(opening)resetFileSubmenus(fm);fm.style.display=opening?"block":"none";});
  document.addEventListener("click",function(){var fm=document.getElementById("file-menu");if(fm)fm.style.display="none";var cfm=document.getElementById("cs-file-menu");if(cfm)cfm.style.display="none";var afm=document.getElementById("api-file-menu");if(afm)afm.style.display="none";});
  // ── Shared menu wiring across all three File menus (fm-, cs-fm-, api-fm-) ──
  var _menus=[{pfx:"fm-",menu:"file-menu",imp:""},{pfx:"cs-fm-",menu:"cs-file-menu",imp:"cs-"},{pfx:"api-fm-",menu:"api-file-menu",imp:"api-"}];
  _menus.forEach(function(m){
    var close=function(){document.getElementById(m.menu).style.display="none";};
    var vd=document.getElementById(m.pfx+"version");if(vd)vd.textContent=APP_VERSION;
    // Toggle button
    if(m.pfx!=="fm-"){var tb=document.getElementById(m.imp+"file-btn");if(tb)tb.addEventListener("click",function(e){e.stopPropagation();var mu=document.getElementById(m.menu);var opening=mu.style.display!=="block";if(opening)resetFileSubmenus(mu);mu.style.display=opening?"block":"none";});}
    // Items that close the menu then call a function
    [["campaigns",showCampaignPicker],["blueprints",showBlueprintBrowser],["rules",showRulesModal],["llm",showProviderModal],["prose",showProseModal],["usage",showUsageModal],["rag",showRagModal],["fal-key",showRenderOptionsModal],["server-connect",connectToServer],["server-disconnect",disconnectFromServer],["set-folder",setCampaignFolder],["clear-folder",clearCampaignFolder]].forEach(function(it){
      var el=document.getElementById(m.pfx+it[0]);if(el)el.addEventListener("click",function(){close();it[1]();});
    });
    // Direct click handlers (no close needed)
    [["clearcache",clearCacheAndReload],["clearcache-top",clearCacheAndReload]].forEach(function(it){
      var el=document.getElementById(m.pfx+it[0]);if(el)el.addEventListener("click",it[1]);
    });
    // Change handlers
    [["adult-cb",toggleAdultMode],["font-lg",toggleFontSize]].forEach(function(it){
      var el=document.getElementById(m.pfx+it[0]);if(el)el.addEventListener("change",it[1]);
    });
    // Cascading submenu toggles: Admin, Save/Load, Narrative options (nested in Admin).
    // Desktop flyouts pick their side from the PARENT ITEM's position before opening:
    // whichever side of the screen has more room gets the panel (away from the closest
    // edge). CSS default is leftward (right:100%); rightward is the inline override.
    [["devmode","devmenu"],["saveload","saveloadmenu"],["narropts","narroptsmenu"]].forEach(function(sm){
      var tg=document.getElementById(m.pfx+sm[0]);
      if(tg)tg.addEventListener("click",function(e){
        e.stopPropagation();
        var sub=document.getElementById(m.pfx+sm[1]),arrow=document.getElementById(m.pfx+sm[0]+"-arrow");
        var open=sub.style.display!=="none";
        if(open){sub.style.display="none";}
        else{
          sub.style.left="";sub.style.right="";
          var a=tg.getBoundingClientRect();
          if(window.innerWidth-a.right>a.left){sub.style.right="auto";sub.style.left="100%";}
          sub.style.display="block";
        }
        if(arrow)arrow.style.transform=open?"":"rotate(90deg)";
      });
    });
    // Import inputs (different prefix pattern: "", "cs-", "api-")
    var ii=document.getElementById(m.imp+"import-inp");if(ii)ii.addEventListener("change",importSave);
    var ic=document.getElementById(m.imp+"import-char-btn");if(ic)ic.addEventListener("click",showCharacterBrowser);
  });
  // Stop checkbox label clicks from bubbling to the document close-menu handler
  ["fm-adult-cb","cs-fm-adult-cb","api-fm-adult-cb","fm-font-lg","cs-fm-font-lg","api-fm-font-lg","fm-legacy-cb","cs-fm-legacy-cb","api-fm-legacy-cb","fm-autosend","cs-fm-autosend","api-fm-autosend"].forEach(function(id){/* autosend added so toggling it doesn't close the File menu (audit E67) */
    var el=document.getElementById(id);if(!el)return;
    var lbl=el.closest("label")||el.parentElement;
    if(lbl)lbl.addEventListener("click",function(e){e.stopPropagation();});
  });
  // Legacy characters checkbox + chance input (synced across all three menus)
  ["fm-legacy-cb","cs-fm-legacy-cb","api-fm-legacy-cb"].forEach(function(id){
    var el=document.getElementById(id);if(!el)return;
    el.addEventListener("change",function(){
      legacyCharsOn=el.checked;saveLegacySettings();
      if(el.checked&&typeof loadLegacyLibrary==="function")loadLegacyLibrary();
      ["fm-legacy-cb","cs-fm-legacy-cb","api-fm-legacy-cb"].forEach(function(oid){var o=document.getElementById(oid);if(o&&o!==el)o.checked=el.checked;});
    });
  });
  ["fm-legacy-pct","cs-fm-legacy-pct","api-fm-legacy-pct"].forEach(function(id){
    var el=document.getElementById(id);if(!el)return;
    el.addEventListener("change",function(){
      var v=parseInt(el.value,10);if(isNaN(v)||v<1)v=1;if(v>100)v=100;
      el.value=v;legacyChancePct=v;saveLegacySettings();
      ["fm-legacy-pct","cs-fm-legacy-pct","api-fm-legacy-pct"].forEach(function(oid){var o=document.getElementById(oid);if(o&&o!==el)o.value=v;});
    });
    el.addEventListener("click",function(e){e.stopPropagation();});
  });
  // ── Game-screen-only menu items ──
  document.getElementById("fm-export").addEventListener("click",exportSave);
  document.getElementById("import-step1").addEventListener("change",importSave);
  document.getElementById("open-blueprint-browser").addEventListener("click",showBlueprintBrowser);
  document.getElementById("blueprint-clear").addEventListener("click",clearBlueprint);
  document.getElementById("fm-sync-mob").addEventListener("click",function(){document.getElementById("file-menu").style.display="none";showSyncModal();});
  document.getElementById("fm-state-mob").addEventListener("click",function(){document.getElementById("file-menu").style.display="none";document.getElementById("sidebar").classList.toggle("open");});
  document.getElementById("fm-render-mob").addEventListener("click",function(){document.getElementById("file-menu").style.display="none";doRender();});
  document.getElementById("fm-export-char").addEventListener("click",exportCharacter);
  document.getElementById("fm-export-bp").addEventListener("click",exportBlueprint);
  // (import-char-btn is already wired in the shared _menus loop above — audit E66 removed the duplicate here)
  document.getElementById("fm-newgame").addEventListener("click",newGame);
  document.getElementById("fm-carmode").addEventListener("click",function(){closeAllMenus();showCarMode();});
  document.getElementById("car-close-btn").addEventListener("click",hideCarMode);
  document.getElementById("car-tap-btn").addEventListener("click",_carTap);
  document.getElementById("car-prev-btn").addEventListener("click",_carPrev);
  document.getElementById("car-next-btn").addEventListener("click",_carNext);
  // TTS
  document.getElementById("tts-btn").addEventListener("click",function(){if(typeof TTS!=="undefined")TTS.toggle();});
  ["fm-tts-settings","cs-fm-tts-settings","api-fm-tts-settings"].forEach(function(id){
    var el=document.getElementById(id);
    if(el)el.addEventListener("click",function(){closeAllMenus();if(typeof TTS!=="undefined")TTS.showSettingsModal();});
  });
  if(typeof TTS!=="undefined")TTS.loadSettings();
  // STT (speech-to-text dictation) — Car Mode foundation
  document.getElementById("mic-btn").addEventListener("click",function(){if(typeof STT!=="undefined")STT.toggle();});
  ["fm-autosend","cs-fm-autosend","api-fm-autosend"].forEach(function(id){
    var el=document.getElementById(id);
    if(el)el.addEventListener("change",function(){if(typeof STT!=="undefined")STT.setAutoSend(el.checked);});
  });
  if(typeof STT!=="undefined")STT.loadSettings();
  // Suggested-action buttons: plain tap = fill input (editable); long-press (~500ms) = execute the turn.
  // (Ctrl/Cmd-click is handled in sendSuggestedAction.) Delegated so it covers dynamically-added buttons.
  (function(){
    var area=document.getElementById("story-narrative");if(!area)return;
    var timer=null,sx=0,sy=0,armed=null;
    function clear(){if(timer){clearTimeout(timer);timer=null;}if(armed){armed.classList.remove("qa-hold");armed=null;}}
    area.addEventListener("pointerdown",function(e){
      var btn=e.target&&e.target.closest?e.target.closest(".qa"):null;if(!btn)return;
      sx=e.clientX;sy=e.clientY;armed=btn;btn.classList.add("qa-hold");
      timer=setTimeout(function(){
        timer=null;if(!armed)return;var b=armed;armed=null;b.classList.remove("qa-hold");
        _qaSuppressUntil=Date.now()+900;          // swallow the trailing click
        var a=b.getAttribute("data-action");if(a&&!busy)sendAction(toFirstPerson(a));
      },500);
    });
    area.addEventListener("pointermove",function(e){if(timer&&(Math.abs(e.clientX-sx)>10||Math.abs(e.clientY-sy)>10))clear();});
    area.addEventListener("pointerup",clear);
    area.addEventListener("pointercancel",clear);
    area.addEventListener("pointerleave",clear);
    area.addEventListener("contextmenu",function(e){if(e.target&&e.target.closest&&e.target.closest(".qa"))e.preventDefault();});
  })();
  // Flush the debounced server sync on exit/background so the 1.5s window can't drop the last
  // turn (best-effort — same fetch guarantees as before, minus the window).
  window.addEventListener("beforeunload",function(){snapshotActiveCamp();if(typeof storageAdapter!=="undefined"&&storageAdapter.syncNow)storageAdapter.syncNow(true);/* keepalive flush — plain fetch is abandoned on unload (E34) */});
  document.addEventListener("visibilitychange",function(){if(document.visibilityState==="hidden"&&typeof storageAdapter!=="undefined"&&storageAdapter.syncNow)storageAdapter.syncNow(true);/* page-hide can precede unload on mobile — keepalive (E34) */});
  // Start panel collapsed on mobile so first tap expands (not collapses)
  if(window.innerWidth<=600){panelCol=true;var rp=document.getElementById("rpanel");if(rp)rp.classList.add("col");}
  document.getElementById("panel-tog").addEventListener("click",function(){panelCol=!panelCol;document.getElementById("rpanel").classList.toggle("col",panelCol);});
  // Swipe right to collapse, swipe left to expand
  (function(){
    var rp=document.getElementById("rpanel"),tx=0;
    rp.addEventListener("touchstart",function(e){tx=e.touches[0].clientX;},{passive:true});
    rp.addEventListener("touchend",function(e){
      var dx=e.changedTouches[0].clientX-tx;
      if(Math.abs(dx)<30)return;
      panelCol=dx>0;  // swipe right → collapse, swipe left → expand
      rp.classList.toggle("col",panelCol);
    },{passive:true});
  })();
  document.getElementById("psh-party").addEventListener("click",function(){secCol.party=!secCol.party;document.getElementById("pss-party").classList.toggle("col",secCol.party);});
  document.getElementById("psh-quest").addEventListener("click",function(){secCol.quest=!secCol.quest;document.getElementById("pss-quest").classList.toggle("col",secCol.quest);});
  document.getElementById("psh-inv").addEventListener("click",function(){secCol.inv=!secCol.inv;document.getElementById("pss-inv").classList.toggle("col",secCol.inv);});
  document.getElementById("psh-ab").addEventListener("click",function(){secCol.ab=!secCol.ab;document.getElementById("pss-ab").classList.toggle("col",secCol.ab);});
  document.getElementById("psh-sp").addEventListener("click",function(){secCol.sp=!secCol.sp;document.getElementById("pss-sp").classList.toggle("col",secCol.sp);});
}
function loadFalKey(){var fk=store.get(FAL_KEY_K);if(fk){falKey=fk;var fi=document.getElementById("fal-input");if(fi)fi.value=fk;}}
function loadRenderModel(){var m=store.get(RENDER_MDL_K);if(m)renderModel=m;}
function showRenderOptionsModal(){
  document.getElementById("file-menu").style.display="none";
  var ex=document.getElementById("render-opts-modal");if(ex)ex.remove();
  var modal=document.createElement("div");modal.id="render-opts-modal";modal.style.cssText="position:fixed;inset:0;background:rgba(0,0,0,.88);z-index:300;display:flex;align-items:center;justify-content:center;padding:20px;";
  // Build model rows
  var mhtml="",mi;
  for(mi=0;mi<RENDER_MODELS.length;mi++){
    var m=RENDER_MODELS[mi],sel=(m.id===renderModel);
    mhtml+="<div class='ro-row' data-id='"+m.id+"' style='display:flex;align-items:center;gap:10px;padding:9px 12px;border-radius:var(--r);cursor:pointer;border:1px solid "+(sel?"var(--acc)":"var(--brd)")+";background:"+(sel?"rgba(184,147,90,.08)":"var(--bg2)")+";margin-bottom:6px;'>"
      +"<div style='width:13px;height:13px;border-radius:50%;border:2px solid "+(sel?"var(--acc)":"var(--brd2)")+";background:"+(sel?"var(--acc)":"transparent")+";flex-shrink:0;'></div>"
      +"<span style='font-size:13px;color:"+(sel?"var(--acc)":"var(--t1)")+"'>"+m.label+"</span>"
      +"</div>";
  }
  modal.innerHTML="<div style='background:var(--modal-bg);border:1px solid var(--acc);border-radius:12px;padding:24px;max-width:400px;width:100%;'>"
    +"<div style='display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;'><span style='font-size:15px;color:var(--t0);font-weight:bold;'>🖼 Render Options</span><button id='ro-x' style='background:none;border:none;color:var(--t2);font-size:20px;cursor:pointer;'>&#215;</button></div>"
    +"<div style='font-size:10px;text-transform:uppercase;letter-spacing:.07em;color:var(--t2);margin-bottom:6px;'>fal.ai API Key</div>"
    +"<input type='password' id='ro-fal-inp' placeholder='fal_key_...' style='width:100%;padding:9px 12px;font-size:13px;font-family:var(--font-mono);background:var(--bg2);border:1px solid var(--brd2);border-radius:var(--r);color:var(--t0);margin-bottom:8px;box-sizing:border-box;'/>"
    +"<div style='display:flex;gap:6px;margin-bottom:22px;'><button id='ro-fal-clear' style='padding:7px 13px;font-family:var(--font);font-size:12px;background:var(--bg3);border:1px solid var(--brd);border-radius:var(--r);color:var(--t2);cursor:pointer;'>Clear</button><button id='ro-fal-save' style='flex:1;padding:8px;font-size:13px;font-family:var(--font);background:var(--acc);color:var(--on-acc);border:none;border-radius:var(--r);cursor:pointer;font-weight:bold;'>Save Key</button></div>"
    +"<div style='font-size:10px;text-transform:uppercase;letter-spacing:.07em;color:var(--t2);margin-bottom:8px;'>Image Model</div>"
    +mhtml
    +"<p id='ro-msg' style='font-size:12px;min-height:16px;margin-top:10px;text-align:center;'></p>"
    +"</div>";
  document.body.appendChild(modal);
  var inp=document.getElementById("ro-fal-inp");if(falKey)inp.value=falKey;
  document.getElementById("ro-x").addEventListener("click",function(){modal.remove();});
  document.getElementById("ro-fal-save").addEventListener("click",function(){var v=inp.value.trim();if(v){falKey=v;store.set(FAL_KEY_K,v);var msg=document.getElementById("ro-msg");msg.textContent="Key saved.";msg.style.color="var(--grn)";}else{document.getElementById("ro-msg").textContent="Enter a key.";}});
  document.getElementById("ro-fal-clear").addEventListener("click",function(){falKey="";store.del(FAL_KEY_K);inp.value="";var msg=document.getElementById("ro-msg");msg.textContent="Key cleared.";msg.style.color="var(--t2)";});
  // Model rows — update in place on click
  var rows=modal.querySelectorAll(".ro-row");
  Array.prototype.forEach.call(rows,function(row){
    row.addEventListener("click",function(){
      renderModel=this.getAttribute("data-id");store.set(RENDER_MDL_K,renderModel);
      Array.prototype.forEach.call(rows,function(r){
        var s=(r.getAttribute("data-id")===renderModel);
        r.style.borderColor=s?"var(--acc)":"var(--brd)";r.style.background=s?"rgba(184,147,90,.08)":"var(--bg2)";
        var dot=r.querySelector("div");if(dot){dot.style.borderColor=s?"var(--acc)":"var(--brd2)";dot.style.background=s?"var(--acc)":"transparent";}
        var lbl=r.querySelector("span");if(lbl)lbl.style.color=s?"var(--acc)":"var(--t1)";
      });
      var mdlName=renderModel.split("/").pop();var msg=document.getElementById("ro-msg");if(msg){msg.textContent="Model: "+mdlName;msg.style.color="var(--grn)";}
    });
  });
}
// loadProviderSettings moved to state.js (v1.180) — pure data logic the Blueprint Designer
// also needs (its LLM features call callGM without loading ui.js). CLAUDE.md already
// documented it as state-side; the code now matches.
function saveProviderSettings(){
  store.set(PROV_K,activeProvider);
  store.set(PKEYS_K,JSON.stringify(providerKeys));
  store.set(PMDL_K,JSON.stringify(providerModels));
  store.set(UPGRADE_K,allowModelUpgrade?"true":"false");
}
function showProviderModal(){
  ["file-menu","cs-file-menu","api-file-menu"].forEach(function(id){var el=document.getElementById(id);if(el)el.style.display="none";});
  var ex=document.getElementById("provider-modal");if(ex)ex.remove();
  var selProv=PROVIDERS[activeProvider]?activeProvider:"anthropic";
  // Stage key edits locally and commit only on Save (audit E88) — the old row-click wrote the typed
  // key straight into the LIVE providerKeys, so editing one provider's key then switching + cancelling
  // left the change applied for the rest of the session.
  var _pvStaged={};(function(){var _k=Object.keys(providerKeys),_i;for(_i=0;_i<_k.length;_i++)_pvStaged[_k[_i]]=providerKeys[_k[_i]];})();
  var modal=document.createElement("div");modal.id="provider-modal";modal.style.cssText="position:fixed;inset:0;background:rgba(0,0,0,.88);z-index:300;display:flex;align-items:center;justify-content:center;padding:20px;";
  function provRows(){var ids=Object.keys(PROVIDERS),h="",i;for(i=0;i<ids.length;i++){var p=PROVIDERS[ids[i]],sel=(ids[i]===selProv);h+="<div class='pv-row' data-id='"+ids[i]+"' style='display:flex;align-items:center;gap:10px;padding:9px 12px;border-radius:var(--r);cursor:pointer;border:1px solid "+(sel?"var(--acc)":"var(--brd)")+";background:"+(sel?"rgba(184,147,90,.08)":"var(--bg2)")+";margin-bottom:6px;'>"+"<div style='width:13px;height:13px;border-radius:50%;border:2px solid "+(sel?"var(--acc)":"var(--brd2)")+";background:"+(sel?"var(--acc)":"transparent")+";flex-shrink:0;'></div>"+"<span style='font-size:13px;color:"+(sel?"var(--acc)":"var(--t1)")+"'>"+p.label+"</span></div>";}return h;}
  function modelOpts(){var p=PROVIDERS[selProv],cur=providerModels[selProv]||p.defaultModel,o="",i;for(i=0;i<p.models.length;i++){o+="<option value='"+p.models[i]+"'"+(p.models[i]===cur?" selected":"")+">"+p.models[i]+"</option>";}return o;}
  modal.innerHTML="<div style='background:var(--modal-bg);border:1px solid var(--acc);border-radius:12px;padding:24px;max-width:420px;width:100%;'>"
    +"<div style='display:flex;justify-content:space-between;align-items:center;margin-bottom:18px;'><span style='font-size:15px;color:var(--t0);font-weight:bold;'>🧠 Language Model</span><button id='pv-x' style='background:none;border:none;color:var(--t2);font-size:20px;cursor:pointer;'>&#215;</button></div>"
    +"<div style='font-size:10px;text-transform:uppercase;letter-spacing:.07em;color:var(--t2);margin-bottom:8px;'>Provider</div>"
    +"<div id='pv-rows'>"+provRows()+"</div>"
    +"<div style='font-size:10px;text-transform:uppercase;letter-spacing:.07em;color:var(--t2);margin:16px 0 6px;'>API Key</div>"
    +"<input type='password' id='pv-key' style='width:100%;padding:9px 12px;font-size:13px;font-family:var(--font-mono);background:var(--bg2);border:1px solid var(--brd2);border-radius:var(--r);color:var(--t0);box-sizing:border-box;'/>"
    +"<div style='font-size:10px;text-transform:uppercase;letter-spacing:.07em;color:var(--t2);margin:16px 0 6px;'>Model</div>"
    +"<select id='pv-model' style='width:100%;padding:9px 12px;font-size:13px;font-family:var(--font);background:var(--bg2);border:1px solid var(--brd2);border-radius:var(--r);color:var(--t0);box-sizing:border-box;'>"+modelOpts()+"</select>"
    +"<label style='display:flex;align-items:center;gap:8px;margin-top:14px;cursor:pointer;'><input type='checkbox' id='pv-upgrade'"+(allowModelUpgrade?" checked":"")+"><span style='font-size:12px;color:var(--t2);'>Allow model upgrade for complex tasks</span></label>"
    +"<p id='pv-msg' style='font-size:12px;min-height:16px;margin:12px 0;text-align:center;'></p>"
    +"<button id='pv-save' style='width:100%;padding:10px;font-size:13px;font-family:var(--font);background:var(--acc);color:var(--on-acc);border:none;border-radius:var(--r);cursor:pointer;font-weight:bold;'>Save &amp; Use</button>"
    +"</div>";
  document.body.appendChild(modal);
  var keyInp=document.getElementById("pv-key"),modelSel=document.getElementById("pv-model");
  function refreshSel(){
    keyInp.value=_pvStaged[selProv]||"";keyInp.placeholder=PROVIDERS[selProv].keyHint;modelSel.innerHTML=modelOpts();
    var rows=modal.querySelectorAll(".pv-row");Array.prototype.forEach.call(rows,function(r){var s=(r.getAttribute("data-id")===selProv);r.style.borderColor=s?"var(--acc)":"var(--brd)";r.style.background=s?"rgba(184,147,90,.08)":"var(--bg2)";var dot=r.querySelector("div");if(dot){dot.style.borderColor=s?"var(--acc)":"var(--brd2)";dot.style.background=s?"var(--acc)":"transparent";}var lbl=r.querySelector("span");if(lbl)lbl.style.color=s?"var(--acc)":"var(--t1)";});
  }
  Array.prototype.forEach.call(modal.querySelectorAll(".pv-row"),function(row){row.addEventListener("click",function(){_pvStaged[selProv]=keyInp.value.trim();selProv=this.getAttribute("data-id");refreshSel();});});
  refreshSel();
  document.getElementById("pv-x").addEventListener("click",function(){modal.remove();});
  document.getElementById("pv-save").addEventListener("click",function(){
    _pvStaged[selProv]=keyInp.value.trim();
    // Commit the staged keys into the live map now (E88) — this is the only place providerKeys is mutated.
    Object.keys(_pvStaged).forEach(function(pid){if(_pvStaged[pid])providerKeys[pid]=_pvStaged[pid];else delete providerKeys[pid];});
    providerModels[selProv]=modelSel.value;activeProvider=selProv;apiKey=providerKeys[activeProvider]||"";
    allowModelUpgrade=document.getElementById("pv-upgrade").checked;
    if(activeProvider==="anthropic"&&apiKey)store.set(AKK,apiKey);
    saveProviderSettings();
    var msg=document.getElementById("pv-msg");
    if(!apiKey){msg.textContent="No key set for "+PROVIDERS[activeProvider].label+".";msg.style.color="var(--red)";return;}
    msg.textContent="Using "+PROVIDERS[activeProvider].label+" · "+modelSel.value;msg.style.color="var(--grn)";
    setTimeout(function(){var m=document.getElementById("provider-modal");if(m)m.remove();},900);
  });
}
// ── Usage & cost telemetry (TODO #21) ─────────────────────────────────────────
// Read-only view of worldState.usage (accumulated per campaign by recordUsage in
// api.js). "turn" is the bucket that prompt caching (#11) will move — compare its
// avg input/call before and after. Cost is an estimate priced from MODEL_PRICING.
function showUsageModal(){
  ["file-menu","cs-file-menu","api-file-menu"].forEach(function(id){var el=document.getElementById(id);if(el)el.style.display="none";});
  var ex=document.getElementById("usage-modal");if(ex)ex.remove();
  var u=(worldState&&worldState.usage)||blankUsage();
  function n(v){return (v||0).toLocaleString();}
  function row(label,b,bold){
    var avg=b.calls?Math.round(b.in/b.calls):0;
    var st="padding:5px 8px;font-size:12px;font-family:var(--font-mono);text-align:right;white-space:nowrap;color:"+(bold?"var(--t0)":"var(--t1)")+";"+(bold?"border-top:1px solid var(--brd2);font-weight:bold;":"");
    return "<tr><td style='"+st+"text-align:left;font-family:var(--font);'>"+label+"</td>"
      +"<td style='"+st+"'>"+n(b.calls)+"</td><td style='"+st+"'>"+n(b.in)+"</td><td style='"+st+"'>"+n(avg)+"</td>"
      +"<td style='"+st+"'>"+n(b.cacheRead)+"</td><td style='"+st+"'>"+n(b.cacheWrite)+"</td><td style='"+st+"'>"+n(b.out)+"</td>"
      +"<td style='"+st+"'>$"+(b.costUSD||0).toFixed(4)+"</td></tr>";
  }
  var order=["turn","actions","summarize","skeleton","sync","other"],rows="",i;
  var kinds=order.filter(function(k){return u.byKind[k];}).concat(Object.keys(u.byKind).filter(function(k){return order.indexOf(k)<0;}));
  for(i=0;i<kinds.length;i++)rows+=row(kinds[i],u.byKind[kinds[i]]);
  if(!kinds.length)rows="<tr><td colspan='8' style='padding:14px;text-align:center;font-size:12px;color:var(--t2);font-style:italic;'>No API calls recorded yet — play a turn.</td></tr>";
  rows+=row("total",u,true);
  var hd="padding:5px 8px;font-size:10px;text-transform:uppercase;letter-spacing:.05em;color:var(--t2);text-align:right;white-space:nowrap;";
  var modal=document.createElement("div");modal.id="usage-modal";modal.style.cssText="position:fixed;inset:0;background:rgba(0,0,0,.88);z-index:300;display:flex;align-items:center;justify-content:center;padding:20px;";
  modal.innerHTML="<div style='background:var(--modal-bg);border:1px solid var(--acc);border-radius:12px;padding:24px;max-width:560px;width:100%;'>"
    +"<div style='display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;'><span style='font-size:15px;color:var(--t0);font-weight:bold;'>📊 Usage &amp; Cost</span><button id='us-x' style='background:none;border:none;color:var(--t2);font-size:20px;cursor:pointer;'>&#215;</button></div>"
    +"<div style='overflow-x:auto;-webkit-overflow-scrolling:touch;margin:0 -4px;'>"
    +"<table style='width:100%;min-width:500px;border-collapse:collapse;'>"
    +"<tr><th style='"+hd+"text-align:left;'>Kind</th><th style='"+hd+"'>Calls</th><th style='"+hd+"'>Input</th><th style='"+hd+"'>In/call</th><th style='"+hd+"'>Cache rd</th><th style='"+hd+"'>Cache wr</th><th style='"+hd+"'>Output</th><th style='"+hd+"'>~Cost</th></tr>"
    +rows+"</table></div>"
    +"<p style='font-size:11px;color:var(--t2);margin:12px 0 0;'>Token counts are exact (API-reported). Cost is an estimate for known Anthropic models; other providers count tokens but contribute $0. Cache columns stay 0 until prompt caching ships."+(u.since?" Collecting since "+new Date(u.since).toLocaleDateString()+".":"")+"</p>"
    +"<button id='us-reset' style='width:100%;margin-top:14px;padding:9px;font-size:12px;font-family:var(--font);background:var(--bg2);color:var(--t1);border:1px solid var(--brd2);border-radius:var(--r);cursor:pointer;'>Reset counters (start a fresh measurement window)</button>"
    +"</div>";
  document.body.appendChild(modal);
  modal.addEventListener("click",function(e){if(e.target===modal)modal.remove();});
  document.getElementById("us-x").addEventListener("click",function(){modal.remove();});
  document.getElementById("us-reset").addEventListener("click",function(){
    if(worldState){worldState.usage=blankUsage();saveCore();}
    modal.remove();showUsageModal();
  });
}
// ── RAG episodic memory toggle (#27 Phase 1 — RAG_MEMORY.md) ───────────────────
// Per-campaign flag on worldState.ragMemory (rides the sync blob, read live each turn —
// the proseAuthor pattern). Modal is built fresh on open so it always reads live state.
function showRagModal(){
  ["file-menu","cs-file-menu","api-file-menu"].forEach(function(id){var el=document.getElementById(id);if(el)el.style.display="none";});
  var ex=document.getElementById("rag-modal");if(ex)ex.remove();
  var hasGame=!!(worldState&&worldState.character);
  var on=!!(worldState&&worldState.ragMemory);
  var modal=document.createElement("div");modal.id="rag-modal";modal.style.cssText="position:fixed;inset:0;background:rgba(0,0,0,.88);z-index:300;display:flex;align-items:center;justify-content:center;padding:20px;";
  modal.innerHTML="<div style='background:var(--modal-bg);border:1px solid var(--acc);border-radius:12px;padding:24px;max-width:440px;width:100%;'>"
    +"<div style='display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;'><span style='font-size:15px;color:var(--t0);font-weight:bold;'>🗂 Episodic Memory (RAG)</span><button id='rag-x' style='background:none;border:none;color:var(--t2);font-size:20px;cursor:pointer;'>&#215;</button></div>"
    +"<p style='font-size:11px;color:var(--t2);margin:0 0 10px;'>The GM recalls verbatim moments from earlier in this campaign when the people, places, or quests involved come up again — exact promises, shared history, callbacks. Also trims long-tail lore from the prompt in mature campaigns.</p>"
    +"<p style='font-size:11px;color:var(--t2);margin:0 0 14px;'>Per-campaign and fully reversible — switching it off restores the standard prompt exactly. Takes effect next turn. Young campaigns won't notice it (there is no history to recall yet).</p>"
    +(hasGame
      ?"<label style='display:flex;align-items:center;gap:10px;padding:10px 12px;border:1px solid var(--brd);border-radius:var(--r);background:var(--bg2);cursor:pointer;font-size:13px;color:var(--t1);'><input type='checkbox' id='rag-cb' style='accent-color:var(--acc);cursor:pointer;width:14px;height:14px;'"+(on?" checked":"")+"/> Enable for this campaign</label>"
      :"<p style='font-size:12px;color:var(--t2);font-style:italic;padding:10px 12px;border:1px solid var(--brd);border-radius:var(--r);background:var(--bg2);margin:0;'>Start or load a campaign first — the setting lives on the campaign.</p>")
    +"</div>";
  document.body.appendChild(modal);
  modal.addEventListener("click",function(e){if(e.target===modal)modal.remove();});
  document.getElementById("rag-x").addEventListener("click",function(){modal.remove();});
  var cb=document.getElementById("rag-cb");
  if(cb)cb.addEventListener("change",function(){
    if(cb.checked)worldState.ragMemory=true;
    else delete worldState.ragMemory; // keep flag-off saves byte-clean of the field
    if(typeof saveAll==="function")saveAll();
    showToast(cb.checked?"Episodic memory ON — this campaign":"Episodic memory OFF");
  });
}
// ── Prose inspiration (TODO #23) ───────────────────────────────────────────────
function loadProseAuthor(){var v=store.get(PROSE_K);proseAuthor=(typeof v==="string")?v:"";}
function showProseModal(){
  ["file-menu","cs-file-menu","api-file-menu"].forEach(function(id){var el=document.getElementById(id);if(el)el.style.display="none";});
  var ex=document.getElementById("prose-modal");if(ex)ex.remove();
  var sel=(worldState&&worldState.proseAuthor!=null)?worldState.proseAuthor:(proseAuthor||"");
  function rows(){var h="",i;for(i=0;i<AUTHORS.length;i++){var a=AUTHORS[i],s=(a.id===sel);
    h+="<div class='pr-row' data-id='"+a.id+"' style='display:flex;align-items:flex-start;gap:10px;padding:9px 12px;border-radius:var(--r);cursor:pointer;border:1px solid "+(s?"var(--acc)":"var(--brd)")+";background:"+(s?"rgba(184,147,90,.08)":"var(--bg2)")+";margin-bottom:6px;'>"
      +"<div style='width:13px;height:13px;border-radius:50%;border:2px solid "+(s?"var(--acc)":"var(--brd2)")+";background:"+(s?"var(--acc)":"transparent")+";flex-shrink:0;margin-top:2px;'></div>"
      +"<div><div style='font-size:13px;color:"+(s?"var(--acc)":"var(--t1)")+";'>"+escHtml(a.nm)+(a.profane?" <span style=\"font-size:10px;color:var(--t2);\">· 18+ for full voice</span>":"")+"</div>"
      +(a.blurb?"<div style='font-size:11px;color:var(--t2);margin-top:2px;'>"+escHtml(a.blurb)+"</div>":"")+"</div></div>";}return h;}
  var modal=document.createElement("div");modal.id="prose-modal";modal.style.cssText="position:fixed;inset:0;background:rgba(0,0,0,.88);z-index:300;display:flex;align-items:flex-start;justify-content:center;padding:20px;overflow-y:auto;";
  modal.innerHTML="<div style='background:var(--modal-bg);border:1px solid var(--acc);border-radius:12px;padding:24px;max-width:440px;width:100%;margin-top:40px;'>"
    +"<div style='display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;'><span style='font-size:15px;color:var(--t0);font-weight:bold;'>✍ Prose Inspiration</span><button id='pr-x' style='background:none;border:none;color:var(--t2);font-size:20px;cursor:pointer;'>&#215;</button></div>"
    +"<p style='font-size:11px;color:var(--t2);margin:0 0 14px;'>The GM imitates this author's voice. Takes effect on the next turn — switch any time.</p>"
    +"<div id='pr-rows'>"+rows()+"</div>"
    +"<button id='pr-save' style='width:100%;padding:10px;font-size:13px;font-family:var(--font);background:var(--acc);color:var(--on-acc);border:none;border-radius:var(--r);cursor:pointer;font-weight:bold;margin-top:8px;'>Save</button>"
    +"</div>";
  document.body.appendChild(modal);
  function refresh(){Array.prototype.forEach.call(modal.querySelectorAll(".pr-row"),function(r){var s=(r.getAttribute("data-id")===sel);r.style.borderColor=s?"var(--acc)":"var(--brd)";r.style.background=s?"rgba(184,147,90,.08)":"var(--bg2)";var dot=r.querySelector("div");if(dot){dot.style.borderColor=s?"var(--acc)":"var(--brd2)";dot.style.background=s?"var(--acc)":"transparent";}var nm=r.querySelector("div>div");if(nm)nm.style.color=s?"var(--acc)":"var(--t1)";});}
  Array.prototype.forEach.call(modal.querySelectorAll(".pr-row"),function(row){row.addEventListener("click",function(){sel=this.getAttribute("data-id");refresh();});});
  modal.addEventListener("click",function(e){if(e.target===modal)modal.remove();});
  document.getElementById("pr-x").addEventListener("click",function(){modal.remove();});
  document.getElementById("pr-save").addEventListener("click",function(){
    proseAuthor=sel;store.set(PROSE_K,sel);   // device default for new/unset campaigns
    if(worldState){worldState.proseAuthor=sel;if(typeof saveAll==="function")saveAll();} // pin to THIS campaign; rides the sync blob across devices
    var a=null,i;for(i=0;i<AUTHORS.length;i++){if(AUTHORS[i].id===sel){a=AUTHORS[i];break;}}
    showToast(sel?("Prose voice: "+(a?a.nm:sel)+(worldState?" · this campaign":"")):"Prose voice: house default");
    modal.remove();
  });
}
// ── Quest journal ─────────────────────────────────────────────────────────────
function showQuestModal(){
  var ex=document.getElementById("quest-modal");if(ex)ex.remove();
  var ql=(worldState&&worldState.questLog)||[];
  function objList(q){if(!q.objectives||!q.objectives.length)return"";var h="<div style='margin-top:6px;'>",oj;for(oj=0;oj<q.objectives.length;oj++){var o=q.objectives[oj];h+="<div style='font-size:12px;color:"+(o.done?"var(--t2)":"var(--t1)")+";margin:2px 0;'>"+(o.done?"☑":"☐")+" "+escHtml(o.text)+"</div>";}return h+"</div>";}
  var offeredHtml="",activeHtml="",i;
  for(i=0;i<ql.length;i++){var q=ql[i];
    if(q.status==="offered"){
      offeredHtml+="<div style='border:1px solid var(--brd2);border-radius:var(--r);padding:12px;margin-bottom:10px;background:var(--bg2);'>"
        +"<div style='font-size:14px;color:var(--t0);font-weight:bold;'>"+escHtml(q.title)+"</div>"
        +(q.desc?"<div style='font-size:12px;color:var(--t2);margin-top:3px;'>"+escHtml(q.desc)+"</div>":"")+objList(q)
        +"<div style='display:flex;gap:8px;margin-top:10px;'>"
        +"<button class='qa' data-qacc='"+escHtml(q.title)+"' style='background:var(--acc);color:var(--on-acc);border:none;font-weight:bold;'>Accept</button>"
        +"<button class='qa' data-qdec='"+escHtml(q.title)+"'>Decline</button></div></div>";
    }else if(q.status==="active"){
      activeHtml+="<div style='border-bottom:1px solid var(--brd);padding:10px 0;'>"
        +"<div style='font-size:14px;color:var(--t0);'>"+escHtml(q.title)+"</div>"
        +(q.desc?"<div style='font-size:12px;color:var(--t2);margin-top:3px;'>"+escHtml(q.desc)+"</div>":"")+objList(q)+"</div>";
    }
  }
  var arch=(memory&&memory.quests)?Object.keys(memory.quests).map(function(k){return memory.quests[k];}):[];
  var histHtml="";for(i=0;i<arch.length;i++){var aq=arch[i];var clr=aq.status==="completed"?"var(--grn)":aq.status==="failed"?"var(--red)":"var(--t2)";var sym=aq.status==="completed"?"✓":aq.status==="failed"?"✗":"—";histHtml+="<div style='font-size:12px;color:var(--t2);padding:3px 0;'><span style='color:"+clr+";'>"+sym+"</span> "+escHtml(aq.title)+" <span style='font-size:10px;'>("+escHtml(aq.status)+")</span></div>";}
  var body="";
  if(offeredHtml)body+="<div style='font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:var(--warn);margin:2px 0 8px;'>⚑ Opportunities</div>"+offeredHtml;
  body+="<div style='font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:var(--acc);margin:14px 0 8px;'>Active</div>"+(activeHtml||"<div style='font-size:12px;color:var(--t2);font-style:italic;'>No active quests.</div>");
  if(histHtml)body+="<div style='font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:var(--t2);margin:14px 0 8px;'>History</div>"+histHtml;
  var modal=document.createElement("div");modal.id="quest-modal";modal.style.cssText="position:fixed;inset:0;background:rgba(0,0,0,.88);z-index:300;display:flex;align-items:flex-start;justify-content:center;padding:20px;overflow-y:auto;";
  modal.innerHTML="<div style='background:var(--modal-bg);border:1px solid var(--acc);border-radius:12px;padding:24px;max-width:480px;width:100%;margin-top:40px;'>"
    +"<div style='display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;'><span style='font-size:16px;color:var(--t0);font-weight:bold;'>Quest Journal</span><button id='qm-x' style='background:none;border:none;color:var(--t2);font-size:22px;cursor:pointer;'>&#215;</button></div>"+body+"</div>";
  document.body.appendChild(modal);
  modal.addEventListener("click",function(e){if(e.target===modal)modal.remove();});
  document.getElementById("qm-x").addEventListener("click",function(){modal.remove();});
  // Wire by TITLE, not render-time index (audit E24): applyMuts can splice the questLog while the
  // modal is open (a completed quest archives), and an index baked into onclick would then hit the
  // wrong quest — declineQuest could even archive a still-active quest.
  Array.prototype.forEach.call(modal.querySelectorAll("[data-qacc]"),function(b){b.addEventListener("click",function(){acceptQuest(b.getAttribute("data-qacc"));});});
  Array.prototype.forEach.call(modal.querySelectorAll("[data-qdec]"),function(b){b.addEventListener("click",function(){declineQuest(b.getAttribute("data-qdec"));});});
}
// Resolve by title + offered status (audit E24) so a shifted index can't accept/decline the wrong quest.
function acceptQuest(title){
  if(!worldState||!worldState.questLog)return;
  var i;for(i=0;i<worldState.questLog.length;i++){if(worldState.questLog[i].title===title&&worldState.questLog[i].status==="offered"){worldState.questLog[i].status="active";saveAll();syncUI();if(typeof showToast==="function")showToast("Quest accepted: "+title);break;}}
  showQuestModal();
}
function declineQuest(title){
  if(!worldState||!worldState.questLog)return;
  var i;for(i=0;i<worldState.questLog.length;i++){var q=worldState.questLog[i];if(q.title===title&&q.status==="offered"){if(!memory.quests)memory.quests={};memory.quests[q.title]={title:q.title,desc:q.desc||"",objectives:q.objectives||[],status:"declined",turn:worldState.turn||0};worldState.questLog.splice(i,1);saveAll();syncUI();if(typeof showToast==="function")showToast("Quest declined: "+title);break;}}
  showQuestModal();
}
function submitKey(){var k=document.getElementById("api-input").value.trim();if(!k){document.getElementById("api-warn").textContent="Enter an API key.";return;}apiKey=k;providerKeys[activeProvider]=k;store.set(AKK,k);saveProviderSettings();var falEl=document.getElementById("fal-input");var fk=falEl?falEl.value.trim():"";if(fk){falKey=fk;store.set(FAL_KEY_K,fk);}document.getElementById("api-screen").style.display="none";init();}
function initSettings(){
  loadRules();loadAdultMode();loadProseAuthor();loadLegacySettings();
  if(typeof loadLegacyLibrary==="function")loadLegacyLibrary();
  loadFontSize();updateServerUI();
}
// Rebuild the story pane from worldState.transcript — the canonical narrative record (audit #18).
// Replaces the old narrativeHtml DOM-snapshot round-trip: the transcript survives reloads and
// device hops complete and ordered, where the DOM copy was truncated and UI-polluted. Renders the
// last `maxEntries` entries (default 20) with an "earlier turns omitted" note when trimmed.
// Dice blocks and system messages are not in the transcript by design (story prose only).
// Returns true if it painted anything. clearFirst wipes the pane before painting (server
// reconcile, where stale content must be replaced); without it, entries append after whatever
// header lines the caller already wrote (init/campaign-load "Welcome back" messages).
function rebuildNarrativeFromTranscript(maxEntries,clearFirst){
  if(!worldState||!worldState.transcript||!worldState.transcript.length)return false;
  var story=document.getElementById("story-narrative");if(!story)return false;
  if(clearFirst)story.innerHTML="";
  var tr=worldState.transcript,n=maxEntries||20,start=Math.max(0,tr.length-n),i,lastNar=null;
  if(start>0)addMsg("system","… "+start+" earlier entr"+(start===1?"y":"ies")+" omitted — the full story lives in the transcript.");
  for(i=start;i<tr.length;i++){var e=tr[i];
    if(e.r==="player")addMsg("player",escHtml(e.x));
    else lastNar=addMsg("narrator","<p>"+escProse(e.x)+"</p>",{replayText:e.x,turn:e.t});/* transcript is model/user text — escape on replay (audit E11) */
  }
  if(lastNar&&worldState.lastActions){var bd=document.createElement("div");bd.innerHTML=buildActionButtons(worldState.lastActions);if(bd.firstChild)lastNar.appendChild(bd.firstChild);}
  story.scrollTop=story.scrollHeight;
  return true;
}
function initReplaySession(){
  if(rebuildNarrativeFromTranscript())return; // transcript-based replay (v1.146)
  // Fallbacks for saves without a transcript (pre-v1.62): last sessionLog exchange, else recap.
  var sll=sessionLog.length;
  if(sll>=2){
    var slu=sessionLog[sll-2],sla=sessionLog[sll-1];
    if(slu&&slu.role==="user")addMsg("player",escHtml(slu.content));
    if(sla&&sla.role==="assistant"){
      var slc=cleanTxt(sla.content),sld=diceTxt(sla.content);
      var _rab=worldState.lastActions?buildActionButtons(worldState.lastActions):parseActions(slc,sla.content).btns||"";
      addMsg("narrator",(sld||"")+"<p>"+escProse(slc)+"</p>"+_rab);/* escape on replay (audit E11) */
    }
  }else{
    var wbSrc=memory&&memory.chapters&&memory.chapters.length?memory.chapters[memory.chapters.length-1].summary:null;
    if(!wbSrc&&worldState.eventHistory&&worldState.eventHistory.length){
      var wbE=worldState.eventHistory[worldState.eventHistory.length-1];
      wbSrc=typeof wbE==="string"?wbE:(wbE&&wbE.summary)||null;
    }
    if(wbSrc)addMsg("narrator","<p><em>Previously:</em> "+escHtml(wbSrc)+"</p>");
  }
}
function initState(saved){
  if(saved&&worldState){
    if(!getActiveCampId())migrateToCampaigns();
    checkLegacyCharacter();showGame();syncUI();initAbilities();initSpells();
    addMsg("system","Welcome back, "+worldState.character.name+".");
    addMsg("system",worldState.world.location+" | Turn "+worldState.turn+" | "+Object.keys(memory.npcs).length+" NPCs in memory");
    initReplaySession();
    if(worldState.combat){document.getElementById("cpanel").classList.add("active");updateCombat();}
    if(typeof migratePendingCompanionSheets==="function")migratePendingCompanionSheets();// backfill sheet-less party members in existing saves (audit P2)
  }else{
    showChar();
  }
}
function init(){initSettings();storageAdapter.load(initState);}
window.addEventListener("load",function(){wireButtons();loadFalKey();loadRenderModel();loadProviderSettings();var k=providerKeys[activeProvider];if(k){apiKey=k;document.getElementById("api-screen").style.display="none";init();}});
