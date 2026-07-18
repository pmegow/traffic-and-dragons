// ui-campaigns.js — campaign picker + camp CRUD (load/rename/delete/new), cloud push/pull,
// server connect/disconnect, cache clear.
// Split from ui.js at v1.324 per UI_SEAM_MAP.md (TODO #54 / UA17).

// ── Server connect / disconnect ──────────────────────────────────────────────
var TND_SERVER_URL = "https://traffic-and-dragons-server.fly.dev";

function updateServerUI(){
  var connected=storageAdapter.isServerMode();
  eachMenuEl("server-connect",function(el){el.style.display=connected?"none":"block";});/* #15⑤ */
  eachMenuEl("server-disconnect",function(el){el.style.display=connected?"block":"none";});
  if(connected){
    // Fetch username from server to show in button label — via the adapter (audit B9):
    // timed, and the label just stays generic on any failure (silent, as before).
    storageAdapter.whoAmI(function(err,d){
      if(err)return;
      eachMenuEl("server-user",function(span){if(d&&d.username)span.textContent=d.username;});
    });
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
  var ws=isActive?store.get(WSK):store.get(campSlotKey(id,"ws"));
  var sl=isActive?store.get(SLK):store.get(campSlotKey(id,"sl"))||"[]";
  var mem=isActive?store.get(MEM_KEY):store.get(campSlotKey(id,"mem"))||"{}";
  if(!ws){if(cb)cb(false);return;}
  // v1.240: parseWorldState, NOT bare JSON.parse — since v1.227 the stored save carries the
  // transcript LZ-compressed ({__lz:…}). Shipping that raw poisoned the server blob: every
  // device that adopted it silently failed the story rebuild until UA3's tolerant inflate
  // self-healed it on the NEXT load (observed live 2026-07-10, the Ammut F5 incident).
  var wsObj;try{wsObj=parseWorldState(ws);}catch(e){if(cb)cb(false);return;}
  // Transport via the adapter (audit B9): pushCampaignState ships EXACTLY this blob (no
  // live-state contamination) and applies the shared NPC-portrait strip — the PC portrait
  // stays inline (audit E27), the same single map _syncNow uses, so the copies can't fork
  // again. narrativeHtml no longer shipped (audit #18) — replay rebuilds from the transcript.
  storageAdapter.pushCampaignState(id,{worldState:wsObj,sessionLog:JSON.parse(sl),memory:JSON.parse(mem)},function(err){
    if(err){if(cb)cb(false);return;}
    var meta=getCampMeta(),i;for(i=0;i<meta.length;i++){if(meta[i].id===id){meta[i].onServer=true;break;}}setCampMeta(meta);
    // Also push portrait if this campaign has one — fire-and-forget, silent on failure (as before)
    var portrait=wsObj.character&&wsObj.character.portrait;
    var npcPortraits={};(wsObj.npcs||[]).forEach(function(n){var p=npcPortrait(n);if(p)npcPortraits[n.name]=p;});
    if(portrait||Object.keys(npcPortraits).length){storageAdapter.putCampaignPortrait(id,{portrait:portrait||null,npcPortraits:npcPortraits},null);}
    if(cb)cb(true);
  });
}

function disconnectFromServer(){
  storageAdapter.logoutFromServer(function(){
    updateServerUI();closeAllMenus();
    showToast("☁ Disconnected from server.");
  });
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
  var svrConnected=storageAdapter.isServerMode();
  var svrBtnStyle="padding:3px 10px;font-family:var(--font);font-size:11px;background:none;border:1px solid "+(svrConnected?"var(--acc)":"var(--brd2)")+";border-radius:var(--r);cursor:pointer;color:"+(svrConnected?"var(--acc)":"var(--t2)")+";";
  var modal=modalShell("camp-modal",/* #14 */
    "<div style='display:flex;justify-content:space-between;align-items:center;margin-bottom:18px;'>"
    +"<span style='font-size:16px;color:var(--t0);font-weight:bold;'>Campaigns</span>"
    +"<div style='display:flex;align-items:center;gap:8px;'>"
    +"<button id='camp-svr-btn' style='"+svrBtnStyle+"'>&#9729; "+(svrConnected?"Disconnect":"Connect")+"</button>"
    +"<button id='camp-x' style='background:none;border:none;color:var(--t2);font-size:20px;cursor:pointer;'>&#215;</button>"
    +"</div></div>"
    +"<div id='camp-sync-status' style='display:none;font-size:11px;color:var(--t2);margin-bottom:10px;text-align:center;'></div>"
    +"<div id='camp-list'></div>"
    +"<button onclick='campNew()' style='width:100%;margin-top:14px;padding:12px;font-size:13px;font-family:var(--font);background:var(--bg3);border:1px solid var(--brd2);border-radius:var(--r);color:var(--t0);cursor:pointer;'>&#10022; New Campaign</button>",
    {align:"flex-start",overlayExtra:"overflow-y:auto;",maxWidth:500,boxExtra:"margin-top:40px;",closeId:"camp-x"});
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
    // B4: the active campaign lives in the LIVE keys — its slot duplicate is deduped away at
    // boot (dedupeActiveCampSlots), so "has a local copy" must read WSK for the active row.
    var hasLocal=isActive?!!store.get(WSK):!!store.get(campSlotKey(cm.id,"ws"));
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
        :"<div style='display:flex;flex-direction:column;gap:4px;flex-shrink:0;'>"
        +"<button onclick='campLoad(\""+cm.id+"\")' style='padding:6px 14px;font-size:12px;font-family:var(--font);background:var(--acc);color:var(--on-acc);border:none;border-radius:var(--r);cursor:pointer;'>Load</button>"
        /* B4: per-campaign local-copy eviction — the campaign stays in the picker as cloud-only */
        +(hasLocal?"<button onclick='campRemoveLocal(\""+cm.id+"\")' title='Remove the local copy from this device (kept in your cloud library)' style='padding:3px 6px;font-size:10px;font-family:var(--font);background:none;border:1px solid var(--brd2);color:var(--t2);border-radius:var(--r);cursor:pointer;'>Remove local</button>":"")
        +"</div>"
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
  var hasLocal=!!(store.get(campSlotKey(id,"ws")));
  if(hasLocal){
    var ok=switchToCampaign(id);
    if(!ok){showToast("Failed to load campaign.");return;}
    _applyLoadedCampaign();
    return;
  }
  // No local data — fetch from server if connected. Adapter transport (audit B9): a
  // sleeping Fly host now times out in 20s instead of hanging this toast forever.
  if(!storageAdapter.isServerMode()){showToast("Campaign data not found locally. Connect to server to load it.");return;}
  showToast("☁ Fetching campaign from server…");
  storageAdapter.getCampaignState(id,function(err,data){
    if(err){showToast("Failed to fetch campaign: "+err);return;}
    if(!data||!data.worldState){showToast("Campaign not found on server.");return;}
    // Write into the campaign slot then switch to it
    store.set(campSlotKey(id,"ws"),serializeWorldState(data.worldState));
    store.set(campSlotKey(id,"sl"),JSON.stringify(data.sessionLog||[]));
    store.set(campSlotKey(id,"mem"),JSON.stringify(data.memory||{}));
    var ok=switchToCampaign(id);
    if(!ok){showToast("Failed to load campaign.");return;}
    _applyLoadedCampaign();
  });
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
  showToast("☁ Pulling from server…");
  // Adapter transport (audit B9): timed — a dead host fails this toast in 20s, not never.
  storageAdapter.getCampaignState(id,function(err,data){
    if(err){showToast("Pull failed: "+err);return;}
    if(!data||!data.worldState){showToast("Not found on server.");return;}
    data.worldState.campId=id;
    store.set(campSlotKey(id,"ws"),serializeWorldState(data.worldState));
    store.set(campSlotKey(id,"sl"),JSON.stringify(data.sessionLog||[]));
    store.set(campSlotKey(id,"mem"),JSON.stringify(data.memory||{}));
    // Update meta savedAt
    var meta=getCampMeta();for(var i=0;i<meta.length;i++){if(meta[i].id===id){meta[i].savedAt=Date.now();meta[i].onServer=true;break;}}setCampMeta(meta);
    showToast("☁ Pulled from server.");
    // If active campaign, reload and restore narrative. Write the pulled blob straight into the
    // LIVE keys and loadState — NOT switchToCampaign, whose snapshotActiveCamp would overwrite the
    // just-pulled slot with the STALE live state before reading it back, silently discarding the
    // pull while the toast claimed success (audit E3).
    if(id===getActiveCampId()){
      store.set(WSK,serializeWorldState(data.worldState));
      store.set(SLK,JSON.stringify(data.sessionLog||[]));
      store.set(MEM_KEY,JSON.stringify(data.memory||{}));
      var ok=loadState();
      if(ok){
        _applyLoadedCampaign(); // replays from the transcript via initReplaySession
        // Legacy fallback: pre-transcript blobs (no worldState.transcript) still carry narrativeHtml.
        if(data.narrativeHtml&&!(worldState&&worldState.transcript&&worldState.transcript.length)){try{var _ne=document.getElementById("story-narrative");if(_ne){_ne.innerHTML=data.narrativeHtml;_ne.scrollTop=_ne.scrollHeight;}}catch(x){}}
        dedupeActiveCampSlots();/* B4: the slot copy written above duplicates the live keys just written */
      }
    }
    var ex=document.getElementById("camp-modal");if(ex)ex.remove();showCampaignPicker();
  });
}
// B4: "Remove local" — evict this campaign's local snapshot behind a PROVEN cloud copy.
// The decision policy is planRemoveLocalCopy (state.js, engine-tested); this function owns the
// dialogs and transport. The cloud probe is a FRESH GET (existence + turn in one authoritative
// answer) — never the stale onServer flag, because an offline-played local copy can be AHEAD of
// the server and eviction on a stale flag would delete the only copy of those turns.
function campRemoveLocal(id){
  if(id===getActiveCampId()){showToast("Can't remove the campaign you're playing.");return;}
  if(!storageAdapter.isServerMode()){showToast("Connect to the server first — the cloud copy is what makes local removal safe.");return;}
  var raw=store.get(campSlotKey(id,"ws"));
  if(!raw){showToast("No local copy on this device.");return;}
  var localTurn=-1;try{var lw=JSON.parse(raw);if(typeof lw.turn==="number")localTurn=lw.turn;}catch(e){}
  showToast("☁ Checking the cloud copy…");
  storageAdapter.getCampaignState(id,function(err,data){
    var plan=planRemoveLocalCopy(err,data&&data.worldState,localTurn);
    function evict(msg){
      removeCampaignLocalCopy(id);
      var meta=getCampMeta(),i;for(i=0;i<meta.length;i++){if(meta[i].id===id){meta[i].onServer=true;break;}}setCampMeta(meta);
      showToast(msg);_renderCampList();
    }
    function pushThenEvict(){
      campCloudPushSilent(id,function(ok){
        if(!ok){showToast("⚠ Cloud update failed — local copy kept.");return;}
        evict("☁ Cloud updated — local copy removed.");
      });
    }
    if(plan.kind==="no-server"){showToast("⚠ Couldn't reach the server ("+plan.err+") — local copy kept.");return;}
    if(plan.kind==="offer-add"){
      if(!confirm("This campaign isn't in your cloud library.\n\nAdd it to the cloud, then remove the local copy?\n\n(Cancel keeps the local copy.)"))return;
      pushThenEvict();return;
    }
    if(plan.kind==="offer-remove"){
      if(!confirm("Remove the local copy?\n\nCloud copy: turn "+plan.cloudTurn+" · this device: turn "+plan.localTurn+"\n\nThe cloud copy is current — Load re-downloads it anytime.\n(Cancel keeps the local copy.)"))return;
      evict("Local copy removed — cloud copy kept (turn "+plan.cloudTurn+").");return;
    }
    // offer-update: this device is ahead (or its turn is unreadable) — removing without a fresh
    // push would destroy the newest turns, so declining ABORTS. (To deliberately discard
    // local-ahead turns: Pull from cloud first, then Remove local.)
    var lbl=plan.localTurn>=0
      ?"Cloud copy: turn "+plan.cloudTurn+" · this device: turn "+plan.localTurn+" (this device is ahead)"
      :"This device's copy couldn't be read for comparison.";
    if(!confirm("This device has the newest copy.\n\n"+lbl+"\n\nUpdate the cloud copy, then remove the local one?\n\n(Cancel keeps the local copy.)"))return;
    pushThenEvict();
  });
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
    var raw=store.get(campSlotKey(id,"ws"));
    if(raw){try{var ws=JSON.parse(raw);ws.campName=name;store.set(campSlotKey(id,"ws"),JSON.stringify(ws));}catch(e){}}
    // Push the rename to the server (audit E80) — otherwise the next syncCampaignList merge (server
    // wins on conflict) reverts the local name back to the server's old one.
    if(storageAdapter.isServerMode()&&typeof campCloudPushSilent==="function")campCloudPushSilent(id,null);
  }
  showCampaignPicker();
}
function campNew(){
  if(typeof busy!=="undefined"&&busy){showToast("Finish the current turn first.");return;}// audit E23
  var modal=document.getElementById("camp-modal");if(modal)modal.remove();
  if(!snapshotActiveCamp())return;/* B4: storage full — don't wipe the only local copy of the current campaign */
  store.del(WSK);store.del(SLK);store.del(MEM_KEY);
  var nid=newCampaignId();setActiveCampId(nid);
  worldState=null;sessionLog=[];memory=blankMemory();
  document.getElementById("story-narrative").innerHTML="";document.getElementById("story-tabletalk").innerHTML="";
  showChar();
}
