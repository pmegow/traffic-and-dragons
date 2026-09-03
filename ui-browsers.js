// ui-browsers.js — blueprint/character/companion browsers, character export/import flows
// (.char files + cloud library), imported-campaign setup, wizard companion slots.
// Split from ui.js at v1.324 per UI_SEAM_MAP.md (TODO #54 / UA17).
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
/* #290: consume the home page's handoff (HOME_PENDING_BP_K) — called when the wizard is about to
   show (initState with no save; newGame after the reset). Stale (>1h) or malformed payloads are
   dropped LOUDLY; a valid one goes through _applyBlueprint like every other path. One-shot. */
function consumeHomeBlueprint(){
  var raw=null;try{raw=localStorage.getItem(HOME_PENDING_BP_K);}catch(e){}
  if(!raw)return false;
  try{localStorage.removeItem(HOME_PENDING_BP_K);}catch(e){}
  var rec=null;try{rec=JSON.parse(raw);}catch(e){}
  if(!rec||!rec.bp||typeof rec.bp!=="object"){console.warn("[home] pending blueprint payload unreadable — dropped");showToast("The blueprint from the home page could not be read.");return false;}
  if(rec.at&&Date.now()-rec.at>3600*1000){console.warn("[home] pending blueprint is stale (>1h) — dropped");return false;}
  var err=validateBlueprint(rec.bp);
  if(err){console.warn("[home] pending blueprint refused: "+err);showToast("Blueprint refused: "+err);return false;}
  _applyBlueprint(rec.bp);
  return true;
}
/* #307: the QUICK START handoff — a pre-made hero + a curated blueprint from the home page. Validated by the
   pure quickStartPayloadValid, then started DIRECTLY (the import flow's own start sequence, no setup modal:
   the blueprint supplies tone, starting location and voice). One-shot; stale or malformed payloads drop LOUDLY. */
function consumeHomeQuickStart(){
  var raw=null;try{raw=localStorage.getItem(HOME_PENDING_QS_K);}catch(e){}
  if(!raw)return false;
  try{localStorage.removeItem(HOME_PENDING_QS_K);}catch(e){}
  var rec=null;try{rec=JSON.parse(raw);}catch(e){}
  var bad=quickStartPayloadValid(rec);
  if(bad){console.warn("[home] quick start dropped — "+bad);showToast("Quick start could not begin: "+bad);return false;}
  var bp=normalizeBlueprint(rec.bp),char=rec.char,tone=null,ti;
  for(ti=0;ti<TONES.length;ti++)if(TONES[ti].id===bp.tone)tone=TONES[ti];
  tone=tone||TONES.filter(function(t){return t.id==="swords";})[0]||TONES[0];
  if(typeof busy!=="undefined"&&busy){showToast("Finish the current turn first.");return false;}
  if(worldState&&!snapshotActiveCamp())return false;/* B4: never wipe the only local copy of a live campaign */
  store.del(WSK);store.del(SLK);store.del(MEM_KEY);
  var nid=newCampaignId();setActiveCampId(nid);
  worldState=null;sessionLog=[];memory=blankMemory();
  var sn=document.getElementById("story-narrative"),st=document.getElementById("story-tabletalk");if(sn)sn.innerHTML="";if(st)st.innerHTML="";
  pendingBlueprint=bp;/* startGame applies it — skeleton, seeded NPCs and places, rules */
  char._campName=bp.name||char.name;char._startLoc=bp.startingLocation||"The Crossroads of Ashenveil";
  if(bp.proseAuthor)startGame(char,tone.nm,tone.vc,bp.proseAuthor);else startGame(char,tone.nm,tone.vc);
  showToast("Quick start: "+char.name+" in "+(bp.name||"the story"));
  return true;
}
function clearBlueprint(){
  pendingBlueprint=null;
  var banner=document.getElementById("blueprint-banner");if(banner)banner.style.display="none";
  showToast("Blueprint cleared.");
}
// ── UA21 ① — the ONE segmented-control scaffold for the three browser modals ──────────────
// (blueprint / character / companion) — each used to re-declare its own segBtn/render/wireSegs
// copy. Paints the button pair for the current mode into the container and wires the clicks;
// a caller repaints by calling it again from its render() (onSwitch sets the caller's own
// mode var and re-renders — callers keep their own same-mode guard where they had one).
// container: element or id. modes: [{lbl,val,pos}]. current: the selected val.
// btnHtml(lbl,val,selected,pos): one button's markup — the two visual variants that existed
// before the dedup are preserved as renderers (cbrSegBtnStd below for blueprint/companion;
// cbrSegBtnWide for the character browser's full-width look). attr: the data attribute
// carrying the mode value ("data-seg" for std, "data-mode" for wide).
function cbrSegControl(container,modes,current,btnHtml,attr,onSwitch){
  var el=(typeof container==="string")?document.getElementById(container):container;
  if(!el)return;
  var h="",i;for(i=0;i<modes.length;i++){h+=btnHtml(modes[i].lbl,modes[i].val,current===modes[i].val,modes[i].pos);}
  el.innerHTML=h;
  Array.prototype.forEach.call(el.querySelectorAll("button"),function(sb){
    sb.addEventListener("click",function(){onSwitch(sb.getAttribute(attr));});
  });
}
// Standard segmented-button markup — byte-identical to the former segBtn copies in the
// blueprint and companion browsers.
function cbrSegBtnStd(lbl,val,sel,pos){
  var segS="padding:7px 16px;font-size:12px;font-family:var(--font);cursor:pointer;border:1px solid var(--brd2);";
  return "<button data-seg='"+val+"' style='"+segS+"background:"+(sel?"var(--acc)":"var(--bg2)")+";color:"+(sel?"var(--on-acc)":"var(--t1)")+";border-radius:"+(pos==="left"?"var(--r) 0 0 var(--r)":"0 var(--r) var(--r) 0")+";font-weight:"+(sel?"bold":"normal")+";border-"+(pos==="left"?"right":"left")+":none;'>"+lbl+"</button>";}
// Full-width variant — byte-identical to the character browser's former inner segBtn
// (class .cbr-seg + data-mode attr; flex:1 buttons, transparent unselected background).
function cbrSegBtnWide(lbl,val,sel,pos){
  var side=pos==="left"?"border-radius:var(--r) 0 0 var(--r);border-right:none;":"border-radius:0 var(--r) var(--r) 0;";
  return "<button class='cbr-seg' data-mode='"+val+"' style='flex:1;font-size:12px;font-family:var(--font);padding:7px 0;border:1px solid "+(sel?"var(--acc)":"var(--brd2)")+";background:"+(sel?"var(--acc)":"transparent")+";color:"+(sel?"var(--on-acc)":"var(--t2)")+";font-weight:"+(sel?"bold":"normal")+";cursor:pointer;"+side+"'>"+lbl+"</button>";}
// ── #15 ② — the ONE campaign-character loader ─────────────────────────────────────────────
// (was byte-duplicated as showCharacterBrowser's getCharFromCampaign and showCompanionBrowser's
// inner getChar). Fallback chain preserved byte-for-byte: active campaign → live WSK state
// (snapshot may be stale — e.g. portrait set after last snapshot) → the campaign's local
// snapshot → server via the adapter (audit B9: timed, token stays adapter-private).
// msgs carries the two caller-specific error strings, byte-preserved:
//   {offline: no local copy and no server connection, missing: server blob has no character}.
function loadCampaignCharacter(id,cb,msgs){
  if(id===getActiveCampId()){var live=store.get(WSK);if(live){try{var lws=JSON.parse(live);if(lws&&lws.character)return cb(null,lws.character);}catch(e){}}}
  var raw=store.get(campSlotKey(id,"ws"));/* #15: shared key builder (state.js) */
  if(raw){try{var ws=JSON.parse(raw);if(ws&&ws.character)return cb(null,ws.character);}catch(e){}}
  if(!storageAdapter.isServerMode()||!storageAdapter.hasToken()){return cb(msgs.offline);}
  storageAdapter.getCampaignState(id,function(err,d){
    if(err)return cb(err);
    if(d&&d.worldState&&d.worldState.character)cb(null,d.worldState.character);else cb(msgs.missing);
  });
}
function showBlueprintBrowser(){
  var connected=storageAdapter.isServerMode();
  var mode=connected?"library":"local";
  var modal=modalShell("bp-browser-modal",/* #14 */
    "<div style='display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;'>"
    +"<span style='font-size:16px;color:var(--t0);font-weight:bold;'>Campaign Blueprints</span>"
    +"<button id='bp-x' style='background:none;border:none;color:var(--t2);font-size:20px;cursor:pointer;'>&#215;</button></div>"
    +"<div style='font-size:11px;color:var(--t2);margin-bottom:12px;'>Pre-built campaign skeletons with NPCs, locations, and story arcs.</div>"
    +"<div id='bp-seg' style='display:flex;margin-bottom:16px;'></div>"
    +"<div id='bp-body'></div>",
    {z:400,align:"flex-start",overlayExtra:"overflow-y:auto;",maxWidth:500,boxExtra:"margin-top:40px;",closeId:"bp-x",outside:true});
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
    cbrSegControl("bp-seg",[{lbl:"&#9729; Blueprint Library",val:"library",pos:"left"},{lbl:"Local",val:"local",pos:"right"}],mode,cbrSegBtnStd,"data-seg",function(v){mode=v;render();});/* UA21 ① */
    if(mode==="library")renderLibrary();else renderLocal();
  }
  render();
}
// ── Character browser modal ───────────────────────────────────────────────────
function showCharacterBrowser(initialMode){
  ["file-menu","cs-file-menu","api-file-menu"].forEach(function(id){var el=document.getElementById(id);if(el)el.style.display="none";});
  // Explicit arg wins; otherwise land on Library when connected, fall back to Local when offline.
  var mode=(initialMode==="local"||initialMode==="library")?initialMode:(storageAdapter.isServerMode()?"library":"local");
  /* #14: re-rendering modal — shell() below repaints the box (modal.firstChild) per mode
     switch and re-wires its own ×, so only the outside-closer rides the scaffold. */
  var modal=modalShell("char-browser-modal","",{z:400,align:"flex-start",overlayExtra:"overflow-y:auto;",maxWidth:500,boxExtra:"margin-top:40px;",outside:true});
  var boxEl=modal.firstChild;

  // Campaign-character loads route through the shared loadCampaignCharacter (#15 ②) — this
  // browser's error strings ride in as the msgs arg (see _cbPickLocal below).

  // Pull a campaign's PC portrait straight from its saved worldState (the portrait rides inline
  // in the blob; meta deliberately doesn't carry it to avoid bloat). Active campaign prefers live
  // WSK; others read their snapshot. Returns null gracefully if absent (→ initials avatar).
  function campPortrait(id){
    try{
      var raw=(id===getActiveCampId())?store.get(WSK):store.get(campSlotKey(id,"ws"));/* #15 */
      if(!raw)return null;
      var ws=JSON.parse(raw);
      return(ws&&ws.character&&ws.character.portrait)?ws.character.portrait:null;
    }catch(e){return null;}
  }

  // small round avatar — portrait if present, otherwise initials (matches the Library look)
  function avatarHtml(name,portrait){
    var ini=csInitials(name);/* #15③: canonical (helpers.js) */
    return portrait?"<img src='"+portrait+"' style='width:40px;height:40px;border-radius:50%;object-fit:cover;flex-shrink:0;'>"
      :"<div style='width:40px;height:40px;border-radius:50%;background:var(--bg3);border:1px solid var(--acc);display:flex;align-items:center;justify-content:center;font-size:12px;color:var(--acc);font-weight:bold;flex-shrink:0;'>"+ini+"</div>";
  }
  // a clickable, gently-highlighting row (click anywhere = inspect)
  function rowHtml(clickAttr,inner){
    return "<div class='cbr-row' "+clickAttr+" style='display:flex;align-items:center;gap:12px;padding:12px 14px;background:var(--bg2);border:1px solid var(--brd);border-radius:8px;margin-bottom:8px;cursor:pointer;'>"+inner+"</div>";
  }
  function shell(bodyHtml){
    boxEl.innerHTML="<div style='display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;'>"
      +"<span style='font-size:16px;color:var(--t0);font-weight:bold;'>Import Character</span>"
      +"<button id='cbr-x' style='background:none;border:none;color:var(--t2);font-size:20px;cursor:pointer;'>&#215;</button></div>"
      +"<div style='font-size:11px;color:var(--t2);margin-bottom:14px;'>"+(mode==="library"?"Campaign-agnostic character snapshots. Click to inspect, then import.":"Characters from your saved campaigns. Click to inspect, then import.")+"</div>"
      +"<div id='cbr-seg' style='display:flex;margin-bottom:16px;'></div>"
      +"<div id='cbr-body'>"+bodyHtml+"</div>"
      +"<div style='border-top:1px solid var(--brd);margin-top:14px;padding-top:14px;text-align:center;'>"
      +"<label style='display:inline-block;padding:8px 20px;font-size:12px;font-family:var(--font);border:1px solid var(--brd2);border-radius:var(--r);color:var(--t2);cursor:pointer;' onmouseover='this.style.borderColor=\"var(--acc)\";this.style.color=\"var(--acc)\"' onmouseout='this.style.borderColor=\"var(--brd2)\";this.style.color=\"var(--t2)\"'>"
      +"<input type='file' id='cbr-file-inp' accept='.char' style='display:none;'/> Import from file (.char)&hellip;</label></div>";
    document.getElementById("cbr-x").addEventListener("click",function(){modal.remove();});
    // UA21 ①: shared scaffold; the same-mode guard this browser always had stays in onSwitch.
    cbrSegControl("cbr-seg",[{lbl:"&#9729; Character Library",val:"library",pos:"left"},{lbl:"<svg viewBox='0 0 24 24' width='12' height='12' style='vertical-align:-2px;fill:currentColor;'><path d='M12 3 3 11 5 11 5 21 10 21 10 15 14 15 14 21 19 21 19 11 21 11Z'/></svg> Local",val:"local",pos:"right"}],mode,cbrSegBtnWide,"data-mode",function(m){if(m!==mode){mode=m;render();}});
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
    loadCampaignCharacter(id,function(err,char){
      if(err){showToast("Could not load character: "+err);return;}
      inspectAndImport(char);
    },{offline:"Not available locally and not connected to server.",missing:"No character data on server."});
  };
  window._cbPickLib=function(slug){
    storageAdapter.listCharacterLibrary(function(err,list){
      if(err){showToast("Error: "+err);return;}
      var entry=null;for(var i=0;i<list.length;i++){if(list[i].slug===slug){entry=list[i];break;}}
      if(!entry){showToast("Character not found.");return;}
      var char=entry.character;
      if(!char.skills)char.skills=initSkills();
      if(!char.conditions)char.conditions=[];if(!char.relationships)char.relationships=[];relationshipMigrateSheet(char,"@import:"+(char.name||"character"),{portable:true});
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

  render();
}
// ── Character import preview modal ───────────────────────────────────────────
function showCharImportPreview(char, onAccept, onCancel){
  migrateCharClassNames(char);/* #100: .char files + library entries may predate the Berserker→Primal rename; every import path funnels through this preview, so heal here once */
  if(typeof migrateCapabilityRenames==="function")migrateCapabilityRenames(char);/* #221: a portable sheet may carry a renamed capability's old name */
  migrateSpellDisplayNames(char);/* same funnel: spell labels that drifted from the capability-bible canon (v1.478 Fire Bolt d10→d8) */
  var initials=csInitials(char.name);/* #15③: canonical — this copy lacked the w[0] guard and rendered "undefined" on double-space names (sanctioned fix) */
  var portrait=char.portrait?"<img src='"+char.portrait+"' alt='"+escHtml(char.name)+"' style='width:100%;height:100%;object-fit:cover;display:block;border-radius:50%;'>":initials;
  var stats=char.stats||{};
  var statRow=["STR","DEX","CON","INT","WIS","CHA"].map(function(s){
    return "<div style='text-align:center;'><div style='font-size:10px;color:var(--t2);'>"+s+"</div><div style='font-size:14px;color:var(--t0);font-weight:bold;'>"+(stats[s]||"—")+"</div></div>";
  }).join("");
  var abilities=(char.abilities||[]).slice(0,4).map(function(a){return "<div style='font-size:11px;color:var(--t1);margin-bottom:3px;'><span style='color:var(--acc);'>"+escHtml(a.nm)+"</span> — "+escHtml(a.ds)+"</div>";}).join("");
  var spells=(char.spells||[]).filter(function(s){return!s.used;}).slice(0,6).map(function(s){return escHtml(s.nm);}).join(", ");
  var inv=escHtml((char.inventory||[]).join(", ")||"Nothing");
  var langs=(char.languages||[]).map(function(l){return escHtml(l.name)+(l.broken?" (broken)":"");}).join(", ")||"Common";
  /* #14: wireClose:false — × and Cancel share the custom doCancel (fires onCancel) */
  var modal=modalShell("char-import-preview",
    "<div style='display:flex;justify-content:space-between;align-items:center;margin-bottom:18px;'>"
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
    +"</div>",
    {z:400,align:"flex-start",overlayExtra:"overflow-y:auto;",maxWidth:520,boxExtra:"margin-top:40px;",wireClose:false});
  function doCancel(){modal.remove();if(typeof onCancel==="function")onCancel();}
  document.getElementById("cip-x").addEventListener("click",doCancel);
  document.getElementById("cip-cancel").addEventListener("click",doCancel);
  document.getElementById("cip-accept").addEventListener("click",function(){modal.remove();onAccept();});
  if(document.getElementById("cip-companion")){document.getElementById("cip-companion").addEventListener("click",function(){modal.remove();_addImportedCompanion(char);});}
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
  modalShell("char-export-modal",/* #14 */
    "<div style='display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;'><span style='font-size:15px;color:var(--t0);font-weight:bold;'>Export Character</span><button id='cep-x' style='background:none;border:none;color:var(--t2);font-size:20px;cursor:pointer;'>&#215;</button></div>"
    +rows,
    {maxWidth:420,closeId:"cep-x",outside:true});
  window._charExportList=chars;
}
function _charExportPick(idx){
  var modal=document.getElementById("char-export-modal");if(modal)modal.remove();
  var c=window._charExportList&&window._charExportList[idx];if(c)_doExportChar(c.name,c.sheet);
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
  // Clone starting-location options from the wizard's Review-step select so the lists never drift.
  var locSel=document.getElementById("rv-start-loc"),locOpts="",li;
  if(locSel&&locSel.options.length){for(li=0;li<locSel.options.length;li++){var lo=locSel.options[li];locOpts+='<option value="'+escHtml(lo.value)+'">'+escHtml(lo.textContent)+'</option>';}}
  else locOpts='<option value="The Crossroads of Ashenveil">The Crossroads of Ashenveil</option><option value="custom">Custom…</option>';
  var toneOpts="",ti;for(ti=0;ti<TONES.length;ti++){if(TONES[ti].id==="custom")continue;toneOpts+='<option value="'+ti+'"'+(TONES[ti].id==="swords"?" selected":"")+'>'+escHtml(TONES[ti].nm)+'</option>';}
  var lblCss="display:block;font-size:11px;color:var(--t2);margin-bottom:4px;";
  var inpCss="width:100%;padding:8px;background:var(--bg2);border:1px solid var(--brd2);border-radius:var(--r);color:var(--t0);font-family:var(--font);font-size:13px;";
  /* #14: wireClose:false — forced-choice setup; Cancel button is the only way out */
  var modal=modalShell("import-setup",
    "<div style='font-size:15px;color:var(--t0);font-weight:bold;margin-bottom:4px;'>New campaign for "+escHtml(char.name)+"</div>"
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
    +"</div>",
    {z:410,maxWidth:420,wireClose:false});
  document.getElementById("is-cancel").addEventListener("click",function(){modal.remove();});
  document.getElementById("is-loc").addEventListener("change",function(){document.getElementById("is-loc-text").style.display=this.value==="custom"?"block":"none";});
  document.getElementById("is-go").addEventListener("click",function(){
    var cn=document.getElementById("is-camp-name").value.trim()||char.name;
    var tone=TONES[parseInt(document.getElementById("is-tone").value)||0]||TONES[2];
    var loc=document.getElementById("is-loc").value;
    if(loc==="custom"){var lt=document.getElementById("is-loc-text").value.trim();loc=lt||"A place of your choosing";}
    modal.remove();
    if(!snapshotActiveCamp())return;/* B4: storage full — don't wipe the only local copy of the current campaign */
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
  if(wsNpcByName(char.name)){showToast(char.name+" is already in this campaign.");return;}/* #7: shared lookup */
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
      if(!char.skills)char.skills=initSkills();if(!char.conditions)char.conditions=[];if(!char.relationships)char.relationships=[];relationshipMigrateSheet(char,"@import:"+(char.name||"character"),{portable:true});
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
  var connected=storageAdapter.isServerMode();
  var modal=modalShell("char-export-opts",/* #14 */
    "<div style='font-size:15px;color:var(--t0);font-weight:bold;margin-bottom:4px;'>Export "+escHtml(char.name)+"</div>"
    +"<div style='font-size:11px;color:var(--t2);margin-bottom:20px;'>Lv"+char.level+" "+escHtml((char.subraceNm||char.ancestry||"")+" "+(char.cls||"")).trim()+"</div>"
    +"<div style='display:flex;flex-direction:column;gap:8px;'>"
    +"<button id='ceo-character-library' style='padding:11px;font-size:13px;font-family:var(--font);background:"+(connected?"var(--acc)":"var(--bg3)")+";color:"+(connected?"var(--on-acc)":"var(--t2)")+";border:none;border-radius:var(--r);cursor:"+(connected?"pointer":"default")+";font-weight:bold;"+(connected?"":"")+";'>&#9729; Save to character library"+(connected?"":" <span style='font-size:10px;font-weight:normal;'>(not connected)</span>")+"</button>"
    +"<button id='ceo-file' style='padding:10px;font-size:13px;font-family:var(--font);background:var(--bg2);border:1px solid var(--brd2);color:var(--t1);border-radius:var(--r);cursor:pointer;'>&#8595; Download .char file</button>"
    +"<button id='ceo-cancel' style='padding:8px;font-size:12px;font-family:var(--font);background:none;border:none;color:var(--t2);cursor:pointer;'>Cancel</button>"
    +"</div>",
    {z:400,maxWidth:380,outside:true});
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
  /* #14: wireClose:false — explicit Overwrite/Cancel choice only */
  var modal=modalShell("char-overwrite-modal",
    "<div style='font-size:15px;color:var(--t0);font-weight:bold;margin-bottom:8px;'>Overwrite character library entry?</div>"
    +"<div style='font-size:13px;color:var(--t2);margin-bottom:20px;'>Character library has <span style='color:var(--t1);'>"+escHtml(existing.name)+" Lv"+existing.level+"</span>. Replace with <span style='color:var(--acc);'>Lv"+char.level+"</span>?</div>"
    +"<div style='display:flex;gap:10px;'>"
    +"<button id='cow-ok' style='flex:1;padding:10px;font-family:var(--font);background:var(--acc);color:var(--on-acc);border:none;border-radius:var(--r);cursor:pointer;font-weight:bold;'>Overwrite</button>"
    +"<button id='cow-cancel' style='flex:1;padding:10px;font-family:var(--font);background:none;border:1px solid var(--brd2);color:var(--t2);border-radius:var(--r);cursor:pointer;'>Cancel</button>"
    +"</div>",
    {z:400,maxWidth:360,wireClose:false});
  document.getElementById("cow-cancel").addEventListener("click",function(){modal.remove();});
  document.getElementById("cow-ok").addEventListener("click",function(){
    var btn=document.getElementById("cow-ok");btn.textContent="Saving…";btn.disabled=true;
    storageAdapter.saveCharacterToLibrary(char,function(err){modal.remove();if(err)showToast("Save failed: "+err);else showToast("&#9729; "+char.name+" updated in the character library.");});
  });
}

// ── #161: ⟳ Update from library — pull the library copy's IDENTITY fields into a live sheet ──
// The semantics live in helpers.js (LIB_UPDATE_FIELDS whitelist + libUpdateDiff/libUpdateApply —
// progression is never touched); this is the preview-confirm shell. onApplied(appliedRows) runs
// after a successful apply — callers re-render their sheet, and the companion caller mirrors
// portraitOffset onto wsNpc (its §19 canonical home).
function _libDiffCell(kind,v){
  if(kind==="image")return v?"<img src='"+escHtml(v)+"' style='width:44px;height:66px;object-fit:cover;border-radius:6px;border:1px solid var(--brd);display:block;'>":"<span style='color:var(--t2);font-style:italic;'>none</span>";
  if(kind==="json")return "<span style='color:var(--t2);font-style:italic;'>"+(v?"custom framing":"default framing")+"</span>";
  var s=(v==null||v==="")?"—":String(v);
  if(s.length>140)s=s.slice(0,140)+"…";
  return escHtml(s);
}
function showLibraryUpdateModal(char,onApplied){
  if(!storageAdapter.isServerMode()){showToast("Connect to server to use the character library.");return;}
  storageAdapter.listCharacterLibrary(function(err,list){
    if(err){showToast("Character library error: "+err);return;}
    var slug=_charLibSlug(char.name),entry=null,i;
    for(i=0;i<(list||[]).length;i++){if(list[i].slug===slug){entry=list[i];break;}}
    if(!entry||!entry.character){showToast(char.name+" is not in the character library yet — Export Character ▸ Save to library first.");return;}
    var lib=entry.character;
    var diff=libUpdateDiff(char,lib);
    if(!diff.length){showToast("✓ "+char.name+" already matches the library copy — nothing to update.");return;}
    var rowsHtml="";
    for(i=0;i<diff.length;i++){
      var r=diff[i];
      rowsHtml+="<div style='padding:8px 0;border-bottom:1px solid var(--brd);'>"
        +"<div style='font-size:10px;text-transform:uppercase;letter-spacing:.07em;color:var(--t2);margin-bottom:4px;'>"+escHtml(r.label)+"</div>"
        +"<div style='display:flex;align-items:center;gap:10px;font-size:12px;'>"
        +"<div style='flex:1;min-width:0;color:var(--t2);overflow-wrap:break-word;'>"+_libDiffCell(r.kind,r.from)+"</div>"
        +"<div style='color:var(--acc);flex-shrink:0;'>&#8594;</div>"
        +"<div style='flex:1;min-width:0;color:var(--t0);overflow-wrap:break-word;'>"+_libDiffCell(r.kind,r.to)+"</div>"
        +"</div></div>";
    }
    var modal=modalShell("lib-update-modal",
      "<div style='font-size:15px;color:var(--t0);font-weight:bold;margin-bottom:4px;'>&#8635; Update "+escHtml(char.name)+" from library</div>"
      +"<div style='font-size:11px;color:var(--t2);margin-bottom:14px;'>Library copy: Lv"+(lib.level||"?")+" "+escHtml(((lib.subraceNm||lib.ancestry||"")+" "+(lib.cls||"")).trim())+" &middot; identity fields only &mdash; level, inventory, spells and progression are never touched.</div>"
      +rowsHtml
      +"<div style='display:flex;gap:10px;margin-top:16px;'>"
      +"<button id='lu-apply' style='flex:1;padding:10px;font-family:var(--font);background:var(--acc);color:var(--on-acc);border:none;border-radius:var(--r);cursor:pointer;font-weight:bold;'>Apply "+diff.length+" change"+(diff.length===1?"":"s")+"</button>"
      +"<button id='lu-cancel' style='flex:1;padding:10px;font-family:var(--font);background:none;border:1px solid var(--brd2);color:var(--t2);border-radius:var(--r);cursor:pointer;'>Cancel</button>"
      +"</div>",
      {z:400,maxWidth:460,wireClose:false,align:"flex-start",overlayExtra:"overflow-y:auto;-webkit-overflow-scrolling:touch;",boxExtra:"margin:20px 0 40px;"});
    document.getElementById("lu-cancel").addEventListener("click",function(){modal.remove();});
    document.getElementById("lu-apply").addEventListener("click",function(){
      var applied=libUpdateApply(char,lib);
      saveAll();
      modal.remove();
      showToast("&#8635; "+char.name+": "+applied.length+" field"+(applied.length===1?"":"s")+" updated from the library.");
      if(onApplied)onApplied(applied);
    });
  });
}
// The standalone Character Library is now the Library tab of the unified Import Character browser.
function showCharacterLibrary(){showCharacterBrowser("library");}
// ── Campaign-start companion selection ────────────────────────────────────────
function _renderCompanionSlots(){
  var sec=document.getElementById("companion-section");if(!sec)return;
  var max=3;
  var h="<div style='font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:var(--t2);margin-bottom:8px;'>Companions <span style='font-size:10px;color:var(--brd2);text-transform:none;letter-spacing:0;'>(optional, max 3)</span></div>";
  if(pendingCompanions.length){
    h+="<div style='display:flex;flex-direction:column;gap:6px;margin-bottom:8px;'>";
    for(var i=0;i<pendingCompanions.length;i++){
      var comp=pendingCompanions[i];
      var ini=csInitials(comp.name);/* #15③: canonical (helpers.js) */
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
  var connected=storageAdapter.isServerMode()&&storageAdapter.hasToken(); // adapter owns the token (audit B9)
  var mode=connected?"library":"local";
  // Campaign-character loads route through the shared loadCampaignCharacter (#15 ②) with this
  // browser's shorter error strings (see wirePicks). Note: the old inner getChar tested the
  // `connected` flag captured at modal open; the shared loader re-reads the same
  // isServerMode()+hasToken() pair live — identical except across a mid-modal connect change.
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
            loadCampaignCharacter(id,function(err,char){
              if(err){showToast("Could not load: "+err);btn.textContent="Select";btn.disabled=false;return;}
              modal.remove();_addPendingCompanion(char);
            },{offline:"Not available locally.",missing:"No character data."});
          }
        });
      })(btns[bi]);
    }
  }
  function render(){
    cbrSegControl("comp-seg",[{lbl:"&#9729; Character Library",val:"library",pos:"left"},{lbl:"Local",val:"local",pos:"right"}],mode,cbrSegBtnStd,"data-seg",function(v){mode=v;render();});/* UA21 ① */
    if(mode==="library")renderLibrary();else renderLocal();
  }
  var modal=modalShell("char-browser-modal",/* #14 */
    "<div style='display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;'>"
    +"<span style='font-size:16px;color:var(--t0);font-weight:bold;'>Add Companion</span>"
    +"<button id='cbr-x' style='background:none;border:none;color:var(--t2);font-size:20px;cursor:pointer;'>&#215;</button></div>"
    +"<div style='font-size:11px;color:var(--t2);margin-bottom:12px;'>"+pendingCompanions.length+" / 3 selected</div>"
    +"<div id='comp-seg' style='display:flex;margin-bottom:16px;'></div>"
    +"<div id='comp-list'></div>",
    {z:500,align:"flex-start",overlayExtra:"overflow-y:auto;",maxWidth:500,boxExtra:"margin-top:40px;",closeId:"cbr-x",outside:true});
  render();
}
