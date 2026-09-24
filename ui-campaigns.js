// ui-campaigns.js — campaign picker + camp CRUD (load/rename/delete/new), cloud push/pull,
// server connect/disconnect, cache clear.
// Split from ui.js at v1.324 per UI_SEAM_MAP.md (TODO #54 / UA17).

// ── Server connect / disconnect ──────────────────────────────────────────────
var TND_SERVER_URL = "https://traffic-and-dragons-server.fly.dev";

function updateServerUI(){
  var connected=storageAdapter.isServerMode();
  if(typeof applyMenuTier==="function")applyMenuTier();/* #289: a disconnect restores the operator rows for local play */
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

function connectToServer(provider){
  storageAdapter.loginWithServer(TND_SERVER_URL,function(err,info){
    if(err){showToast(typeof err==="string"?err:"Server login failed.");return;}// surface the real reason (audit E75)
    updateServerUI();
    storageAdapter.fetchAccount(null);/* §3 gateway: refresh entitlement so gmViaServer routes correctly */
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
  },provider);
}

// §3 accounts: the first-run screen's sign-in path. Unlike connectToServer (an in-game menu
// action), this transitions the boot screen: on success the api-screen hides and the app
// boots; the campaign picker opens only when the account actually has campaigns to pick.
// An unentitled sign-in is honest, not blocking — the account works for sync/libraries,
// and the first GM turn explains the subscription state loudly (the §4.3 402 message).
function signInFromApiScreen(provider){
  storageAdapter.loginWithServer(TND_SERVER_URL,function(err,info){
    if(err){var w=document.getElementById("api-warn");if(w)w.textContent=typeof err==="string"?err:"Sign-in failed.";return;}
    updateServerUI();
    storageAdapter.fetchAccount(function(aerr,acct){
      if(!aerr&&acct&&acct.entitled===false)showToast("Signed in as "+info.username+" — no subscription on this account yet.");
      else showToast("&#9729; Signed in as "+info.username);
    });
    var scr=document.getElementById("api-screen");if(scr)scr.style.display="none";
    init();
    storageAdapter.syncCampaignList(function(result){
      if(result&&getCampMeta().length)showCampaignPicker();
    });
  },provider);
}
function campCloudPushSilent(id,cb){
  if(!storageAdapter.isServerMode()){if(cb)cb(false);return;}
  // For the active campaign use live keys, not the snapshot (snapshot is only
  // written on campaign switch and may be many turns stale).
  var isActive=id===getActiveCampId();
  var name=campDisplayName(id);
  var ws=isActive?store.get(WSK):store.get(campSlotKey(id,"ws"));
  var sl=isActive?store.get(SLK):store.get(campSlotKey(id,"sl"));
  var mem=isActive?store.get(MEM_KEY):store.get(campSlotKey(id,"mem"));
  if(!ws){if(cb)cb(false);return;}
  // Audit D5: `||"{}"` was a LIE about the most valuable tier in the app. A slot whose memory key is
  // missing (the D3 half-written slot, a storage eviction, an interrupted download) pushed
  // memory:{} to the server WITH a real turn number, and the next reconcile on any device adopted
  // that empty memory over a healthy local one and saveAll persisted the wipe. A missing memory slot
  // is UNKNOWN, not empty — refuse, say so, and let Pull or a re-save fix it. Same for an
  // unparseable one: JSON.parse used to throw out of this callback with nothing shown at all.
  function _refuse(what,detail){
    console.warn("[camps] cloud push REFUSED for "+name+" — "+what+" (audit D5)"+(detail?": "+detail:""));
    if(typeof showToast==="function")showToast("⚠ "+name+" wasn't pushed — "+what+". Load or re-save it first.");
    if(cb)cb(false);
  }
  var memObj,slObj;
  if(mem==null){_refuse("its memory slot is missing — push refused rather than uploading empty memory");return;}
  try{memObj=JSON.parse(mem);}catch(e){_refuse("its memory slot could not be read","unparseable: "+(e&&e.message));return;}
  if(!memObj||typeof memObj!=="object"||Array.isArray(memObj)){_refuse("its memory slot is not a memory — push refused");return;}
  try{slObj=JSON.parse(sl==null?"[]":sl);}catch(e){_refuse("its session log could not be read","unparseable: "+(e&&e.message));return;}
  if(!Array.isArray(slObj)){_refuse("its session log is not a session log — push refused");return;}
  // v1.240: parseWorldState, NOT bare JSON.parse — since v1.227 the stored save carries the
  // transcript LZ-compressed ({__lz:…}). Shipping that raw poisoned the server blob: every
  // device that adopted it silently failed the story rebuild until UA3's tolerant inflate
  // self-healed it on the NEXT load (observed live 2026-07-10, the Ammut F5 incident).
  var wsObj;try{wsObj=parseWorldState(ws);}catch(e){if(cb)cb(false);return;}
  // #7③ (#23① sweep): this push must not clobber a NEWER server copy silently. Probe the server's
  // turn first and confirm; null (offline / no server row / the turn route not deployed) means
  // "cannot judge" and proceeds exactly as before, so the connect-time bulk push of local-only
  // campaigns is untouched.
  // Audit D4: the probe reads the STATE row (getServerStateTurn), not the campaign LIST — #377
  // measured in the field that the list turn LAGS the state row the CAS guard compares, so the old
  // gate could pass while the server was in fact ahead. And a probe alone was never enough: between
  // it and the POST another device can write. The probed turn now rides along as baseTurn, so the
  // server's own CAS guard decides and a rename can no longer overwrite a newer cloud copy.
  storageAdapter.getServerStateTurn(id,function(serverTurn){
  var localTurn=(wsObj&&wsObj.turn)||0;
  if(serverTurn!=null&&serverTurn>localTurn){
    if(!confirm("The server holds NEWER state for this campaign (turn "+serverTurn+" vs local turn "+localTurn+").\n\nOverwrite the server copy with this device's older save?")){if(cb)cb(false);return;}
  }
  // Transport via the adapter (audit B9): pushCampaignState ships EXACTLY this blob (no
  // live-state contamination) and applies the shared NPC-portrait strip — the PC portrait
  // stays inline (audit E27), the same single map _syncNow uses, so the copies can't fork
  // again. narrativeHtml no longer shipped (audit #18) — replay rebuilds from the transcript.
  storageAdapter.pushCampaignState(id,{worldState:wsObj,sessionLog:slObj,memory:memObj,baseTurn:(typeof serverTurn==="number"?serverTurn:undefined)},function(err){
    if(err){
      /* D4: a refused push is the CAS guard doing its job — the loudest possible outcome, never a
         shrug. campSaveRename pushes with a NULL cb, so the announcement has to live here. */
      if(String(err).indexOf("409")>=0){
        console.warn("[camps] cloud push REFUSED for "+name+" — the server moved ahead between the check and the upload (CAS 409); nothing was overwritten");
        if(typeof showToast==="function")showToast("⚠ "+name+" wasn't pushed — another device has newer state in the cloud. Pull it first, then push.");
      }
      else console.warn("[camps] cloud push failed for "+name+": "+err);
      if(cb)cb(false);return;
    }
    var meta=getCampMeta(),i;for(i=0;i<meta.length;i++){if(meta[i].id===id){meta[i].onServer=true;break;}}setCampMeta(meta);
    // Also push portrait if this campaign has one — fire-and-forget, silent on failure (as before)
    var portrait=wsObj.character&&wsObj.character.portrait;
    var npcPortraits={};(wsObj.npcs||[]).forEach(function(n){var p=npcPortrait(n);if(p)npcPortraits[n.name]=p;});
    if(portrait||Object.keys(npcPortraits).length){storageAdapter.putCampaignPortrait(id,{portrait:portrait||null,npcPortraits:npcPortraits},null);}
    if(cb)cb(true);
  });
  });/* closes the #7③ getServerCampaignTurn probe */
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
  syncUI();showGame();initAbilities();initSpells();if(typeof villageRefreshOnEntry==="function")villageRefreshOnEntry();/* #6 E13 */
  addMsg("system","Campaign loaded: "+worldState.character.name+".");
  addMsg("system",worldState.world.location+" | Turn "+worldState.turn+" | "+Object.keys(memory.npcs).length+" NPCs in memory");
  initReplaySession(); // shared with init() — was a near-identical inline copy (audit #26)
  if(worldState.combat){document.getElementById("cpanel").classList.add("active");updateCombat();}
  if(typeof migratePendingCompanionSheets==="function")migratePendingCompanionSheets();// backfill sheet-less party members in existing saves (audit P2)
}
/* Audit D5, the download half: `JSON.stringify(data.memory||{})` wrote the STRING "{}" into the
   campaign's memory slot when a server blob carried no memory — and `{}` is not an empty memory, it
   is a BROKEN one: loadState parses it as truthy and heals only the lazily-initialised fields, so
   memory.npcs/locations/lore stay undefined and the first reader (_applyLoadedCampaign's NPC count)
   throws. blankMemory() is the one legitimate empty shape, and a blob with no memory is worth saying
   out loud — it means the cloud copy of this campaign has no long-term memory to give back. */
function _pulledMemory(data,id){
  var m=data&&data.memory;
  if(m&&typeof m==="object"&&!Array.isArray(m))return m;
  console.warn("[camps] the server copy of "+campDisplayName(id)+" carries no long-term memory ("+(m===undefined?"absent":(m===null?"null":(Array.isArray(m)?"array":typeof m)))+") — this campaign downloads with an EMPTY memory (audit D5)");
  if(typeof showToast==="function")showToast("⚠ "+campDisplayName(id)+"'s cloud copy has no long-term memory — it downloads without NPC/lore recall.");
  return blankMemory();
}
function campLoad(id){
  if(typeof busy!=="undefined"&&busy){showToast("Finish the current turn first.");return;}// audit E23
  var modal=document.getElementById("camp-modal");if(modal)modal.remove();
  // Check if local data exists for this campaign
  var hasLocal=!!(store.get(campSlotKey(id,"ws")));
  if(hasLocal){
    /* #424 (owner ask 2026-09-18): Load used to take the local slot without asking the server, so a device that was
       AHEAD of (or behind) the cloud played its own copy in silence. Unconnected, that is still the only possible
       answer. Connected, the authoritative turn probe decides through planCloudAdopt: a newer cloud copy is adopted,
       a level one stays local, an unknown one stays local and says so, and a REWIND is confirmed — with an export
       escape — never silent. */
    if(!storageAdapter.isServerMode()){_campLoadLocal(id);return;}
    showToast("☁ Checking the cloud copy…");
    storageAdapter.getServerStateTurn(id,function(st){
      var plan=planCloudAdopt("load",st,campLocalTurn(id),true);
      if(plan.kind==="keep-local"){
        if(plan.reason==="unknown")console.warn("[camps] the cloud turn of "+campDisplayName(id)+" could not be checked (offline, no cloud row, or the turn route is unavailable) — loading this device's copy (turn "+plan.localTurn+")");
        _campLoadLocal(id);return;
      }
      if(plan.kind==="adopt"){_campPullAndLoad(id,"☁ The cloud copy is newer (turn "+plan.serverTurn+", this device had "+plan.localTurn+") — loaded it.");return;}
      _cloudRewindModal({id:id,mode:"load",plan:plan,
        onAdopt:function(){_campPullAndLoad(id,null);},
        onCancel:function(){_campLoadLocal(id);}});
    });
    return;
  }
  // No local data — fetch from server if connected. Adapter transport (audit B9): a
  // sleeping Fly host now times out in 20s instead of hanging this toast forever.
  if(!storageAdapter.isServerMode()){showToast("Campaign data not found locally. Connect to server to load it.");return;}
  showToast("☁ Fetching campaign from server…");
  _campPullAndLoad(id,null);
}
// #424: the pre-#424 Load — switch to this device's copy of the campaign.
function _campLoadLocal(id){
  var ok=switchToCampaign(id);
  if(!ok)return;/* #337: switchToCampaign toasts the specific reason (quota / corrupt) and restored the start layout */
  _applyLoadedCampaign();
}
// #424: fetch the cloud copy, write it into the slot, switch to it — the no-local Load, the newer-cloud Load and the
// confirmed Load rewind all land here. `note` is an extra toast for the newer-cloud case (null = the plain path).
function _campPullAndLoad(id,note){
  storageAdapter.getCampaignState(id,function(err,data){
    if(err){showToast("Failed to fetch campaign: "+err);return;}
    if(!data||!data.worldState){showToast("Campaign not found on server.");return;}
    if(_applyPulledCampaign(id,data,{switchTo:true})&&note)showToast(note);
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
// #424: apply a fetched cloud copy to this device — ONE landing site for ☁↓ Pull and every Load that downloads.
//   active campaign → the LIVE keys and loadState — NOT switchToCampaign, whose snapshotActiveCamp would overwrite the
//                     just-pulled slot with the STALE live state before reading it back, silently discarding the pull
//                     while the toast claimed success (audit E3). #337: live keys ONLY (the old code wrote the slot too
//                     and then de-duped it — a doubled footprint on the one device already quota-pinned); guarded writes.
//   other campaign  → its slot through THE slot writer; opts.switchTo then makes it the active campaign.
// Afterwards the campaign's unsynced-flush marker is cleared (the turns it marked were discarded by decision or
// superseded by a newer cloud copy — a dead marker evicts a live one from the capped map, D10), and when the campaign
// is active the adapter is re-based on the adopted turn (adoptServerTurn) so the next save neither 409s on a stale
// higher base nor counts the discarded turns as unsynced. Returns true when the copy landed.
function _applyPulledCampaign(id,data,opts){
  opts=opts||{};
  if(typeof busy!=="undefined"&&busy){showToast("Finish the current turn first.");return false;}
  data.worldState.campId=id;
  var wsS=serializeWorldState(data.worldState),slS=JSON.stringify(data.sessionLog||[]),memS=JSON.stringify(_pulledMemory(data,id));
  if(id===getActiveCampId()){
    if(!writeLiveKeys(wsS,slS,memS)){showToast("⚠ Not enough local storage to apply the pulled copy (~"+_kb(wsS.length+slS.length+memS.length)+" KB) — nothing changed. Free space: Campaigns → \"Remove local\" on old campaigns.");return false;}
    var ok=loadState();
    if(ok){
      _applyLoadedCampaign(); // replays from the transcript via initReplaySession
      // Legacy fallback: pre-transcript blobs (no worldState.transcript) still carry narrativeHtml.
      if(data.narrativeHtml&&!(worldState&&worldState.transcript&&worldState.transcript.length)){try{var _ne=document.getElementById("story-narrative");if(_ne){_ne.innerHTML=data.narrativeHtml;_ne.scrollTop=_ne.scrollHeight;}}catch(x){console.warn("[camps] the legacy narrativeHtml replay failed ("+(x&&x.message)+") — this pre-transcript campaign loads with an empty story pane (audit E15)");}}
    }
  }else{
      if(!writeCampaignSlot(id,wsS,slS,memS))return false;/* #337: toasted; no partial slot left behind */
    if(opts.switchTo){
      if(!switchToCampaign(id))return false;/* #337: the reason was toasted */
      _applyLoadedCampaign();
    }
  }
  storageAdapter.clearFlushDirty(id);
  if(id===getActiveCampId())storageAdapter.adoptServerTurn(typeof data.worldState.turn==="number"?data.worldState.turn:0);
  // Update meta savedAt (small write; guarded so a quota edge can't kill the picker refresh below)
  try{var meta=getCampMeta();for(var i=0;i<meta.length;i++){if(meta[i].id===id){meta[i].savedAt=Date.now();meta[i].onServer=true;break;}}setCampMeta(meta);}catch(e){console.error("[camps] campaign-list update failed after pull:",e);}
  if(opts.toast)showToast(opts.toast);
  return true;
}
// #424: the rewind confirmation — an APP modal (modalShell), never a native confirm(): it carries the export escape.
// opts: {id, mode:"load"|"pull", plan (a confirm-rewind plan), onAdopt(), onCancel()}. Cancel on a Load plays this
// device's copy (the caller's onCancel); Cancel on a Pull changes nothing. "Export, then use the cloud copy" writes
// this device's copy through exportCampaignCopy FIRST and applies the cloud copy only when that file exists — a
// failed safety copy aborts the rewind, loudly, because discarding turns that could not be kept is the one outcome
// this modal exists to prevent.
function _cloudRewindModal(opts){
  var plan=opts.plan,name=campDisplayName(opts.id);
  var turnsLine=plan.localTurn>=0
    ?"Cloud copy: turn "+(plan.serverTurn===null?"unknown":plan.serverTurn)+" &nbsp;&middot;&nbsp; this device: turn "+plan.localTurn
    :"This device's copy couldn't be read for comparison — it may be ahead of the cloud.";
  var lossLine=plan.lost!==null
    ?"Using the cloud copy discards "+(plan.lost===1?"turn "+plan.localTurn:"turns "+(plan.serverTurn+1)+"–"+plan.localTurn)+" on this device ("+plan.lost+" turn"+(plan.lost===1?"":"s")+")."
    :"Using the cloud copy discards whatever this device holds beyond it.";
  var cancelLabel=opts.mode==="load"?"Keep this device's copy":"Cancel";
  var modal=modalShell("cloud-rewind-modal",
    "<div style='font-size:15px;color:var(--t0);font-weight:bold;margin-bottom:6px;'>This device is ahead of the cloud</div>"
    +"<div style='font-size:12px;color:var(--t1);margin-bottom:6px;'>"+escHtml(name)+"</div>"
    +"<div style='font-size:12px;font-family:var(--font-mono);color:var(--acc);margin-bottom:10px;'>"+turnsLine+"</div>"
    +"<div style='font-size:12px;color:var(--t1);margin-bottom:16px;'>"+lossLine+" Export them first to keep a file you can import later.</div>"
    +"<div style='display:flex;flex-direction:column;gap:8px;'>"
    +"<button id='cr-export' style='padding:10px;font-family:var(--font);background:var(--acc);border:none;border-radius:var(--r);color:var(--on-acc);font-weight:bold;cursor:pointer;'>Export this device's copy, then use the cloud copy</button>"
    +"<button id='cr-pull' style='padding:10px;font-family:var(--font);background:var(--bg2);border:1px solid var(--brd);border-radius:var(--r);color:var(--t1);cursor:pointer;'>Use the cloud copy anyway</button>"
    +"<button id='cr-cancel' style='padding:10px;font-family:var(--font);background:none;border:1px solid var(--brd2);border-radius:var(--r);color:var(--t2);cursor:pointer;'>"+cancelLabel+"</button>"
    +"</div>",
    {maxWidth:420,z:320});
  document.getElementById("cr-cancel").addEventListener("click",function(){modal.remove();if(opts.onCancel)opts.onCancel();});
  document.getElementById("cr-pull").addEventListener("click",function(){modal.remove();opts.onAdopt();});
  document.getElementById("cr-export").addEventListener("click",function(){
    var b=document.getElementById("cr-export");if(b){b.disabled=true;b.textContent="Exporting…";}
    exportCampaignCopy(opts.id).then(function(){modal.remove();opts.onAdopt();},function(e){
      console.error("[camps] the pre-rewind export of "+name+" failed — the cloud copy was NOT applied:",e);
      showToast("⚠ Couldn't export this device's copy ("+((e&&e.message)||e)+") — nothing changed.");
      modal.remove();if(opts.onCancel)opts.onCancel();
    });
  });
}
function campCloudPull(id){
  // Audit E3: the same gate campLoad and campNew carry. A pull REPLACES the live worldState/memory
  // objects; with a turn in flight the GM response's closure then writes into the objects that were
  // just discarded, or saveAll persists a hybrid of the pulled campaign and the answering turn.
  if(typeof busy!=="undefined"&&busy){showToast("Finish the current turn first.");return;}
  if(!storageAdapter.isServerMode()){showToast("Not connected to server.");return;}
  showToast("☁ Pulling from server…");
  // Adapter transport (audit B9): timed — a dead host fails this toast in 20s, not never.
  storageAdapter.getCampaignState(id,function(err,data){
    if(err){showToast("Pull failed: "+err);return;}
    if(!data||!data.worldState){showToast("Not found on server.");return;}
    /* #424 (owner ask 2026-09-18): the fetched copy IS the probe — compare turns BEFORE applying. The old pull wrote a
       local-ahead copy over in silence; a rewind is now confirmed through _cloudRewindModal (with an export escape). */
    var localTurn=campLocalTurn(id);
    var plan=planCloudAdopt("pull",typeof data.worldState.turn==="number"?data.worldState.turn:null,localTurn===null?-1:localTurn,localTurn!==null);
    function apply(){
      if(!_applyPulledCampaign(id,data,{toast:"☁ Pulled from server."}))return;
      var ex=document.getElementById("camp-modal");if(ex)ex.remove();showCampaignPicker();
    }
    if(plan.kind==="adopt"){apply();return;}
    _cloudRewindModal({id:id,mode:"pull",plan:plan,onAdopt:apply,
      onCancel:function(){showToast("Pull cancelled — this device's copy kept"+(plan.localTurn>=0?" (turn "+plan.localTurn+")":"")+".");}});
  });
}
// B4: "Remove local" — evict this campaign's local snapshot behind a PROVEN cloud copy.
// The decision policy is planRemoveLocalCopy (state.js, engine-tested); this function owns the
// dialogs and transport. The cloud probe is a FRESH GET (existence + turn in one authoritative
// answer) — never the stale onServer flag, because an offline-played local copy can be AHEAD of
// the server and eviction on a stale flag would delete the only copy of those turns.
function campRemoveLocal(id){
  // Audit E3: eviction pushes first (planRemoveLocalCopy's offer-update/offer-add arms), and that
  // push reads the store while an in-flight turn is still writing to it — gate it like campLoad.
  if(typeof busy!=="undefined"&&busy){showToast("Finish the current turn first.");return;}
  if(id===getActiveCampId()){showToast("Can't remove the campaign you're playing.");return;}
  if(!storageAdapter.isServerMode()){showToast("Connect to the server first — the cloud copy is what makes local removal safe.");return;}
  var raw=store.get(campSlotKey(id,"ws"));
  if(!raw){showToast("No local copy on this device.");return;}
  var localTurn=-1;try{var lw=JSON.parse(raw);if(typeof lw.turn==="number")localTurn=lw.turn;}catch(e){console.warn("[camps] the local copy of "+campDisplayName(id)+" could not be read for the turn comparison ("+(e&&e.message)+") — treating this device as possibly AHEAD, so removal will require a cloud update first (audit E15)");}
  showToast("☁ Checking the cloud copy…");
  storageAdapter.getCampaignState(id,function(err,data){
    var plan=planRemoveLocalCopy(err,data&&data.worldState,localTurn);
    function evict(msg){
      removeCampaignLocalCopy(id,{teardown:true});/* D10: the campaign is leaving this device — its unsynced-flush marker and payload-size latch go with it (a dead marker evicts a LIVE one from the capped map) */
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
/* #443 (Astra review R6): ONE operation owns the delete. Connected, the cloud delete is AWAITED and reported — the local
   copy goes only once the server agreed (or says it never had the campaign), so a failed cloud delete never leaves a
   row that vanishes locally and comes back on the next list sync; the reason reaches the player and deleting again is
   the retry. Unconnected, the local delete is the whole operation, as before. */
function campDeleteRemoteOutcome(err){
  if(!err)return "deleted";
  if(/\b404\b|not found/i.test(String(err)))return "absent";/* nothing to delete on the server — a local-only campaign */
  return "failed";
}
function campDelete(id){
  if(!confirm("Delete this campaign? This cannot be undone."))return;
  var name=(typeof campDisplayName==="function")?campDisplayName(id):id;
  var ex=document.getElementById("camp-modal");if(ex)ex.remove();
  if(!storageAdapter.isServerMode()){deleteCampaign(id);showCampaignPicker();return;}
  showToast("Deleting "+name+"…");
  storageAdapter.deleteCampaignFromServer(id,function(err){
    var outcome=campDeleteRemoteOutcome(err);
    if(outcome==="failed"){
      console.warn("[camps] #443 cloud delete of "+name+" failed: "+err+" — the local copy is kept; delete again to retry");
      showToast("⚠ Cloud delete failed ("+err+") — "+name+" is still here. Delete it again to retry.",8000);
      showCampaignPicker();return;
    }
    deleteCampaign(id);
    showToast(outcome==="absent"?"Deleted "+name+" (it was only on this device)":"Deleted "+name);
    showCampaignPicker();
  });
}
function campStartRename(id){
  var span=document.getElementById("camp-name-"+id);if(!span)return;
  var cur=span.textContent;
  var inp=document.createElement("input");
  inp.id="camp-rename-"+id;inp.value=cur;
  inp.style.cssText="font-size:14px;font-family:var(--font);background:var(--bg3);border:1px solid var(--acc);border-radius:4px;color:var(--t0);padding:2px 6px;width:140px;";
  /* B40 (2026-09-21): ONE latched commit owns the input's fate. Enter used to save and re-render the picker; modalShell's
     removal of the old modal dispatched blur to the still-focused input BEFORE detaching (Blink), the blur listener saved
     and re-rendered AGAIN inside the removal, and the outer remove() threw NotFoundError ("moved in a 'blur' event
     handler"). Escape took the same path and SAVED. Now the second event no-ops, and Escape cancels. */
  var done=false;
  function commit(save){if(done)return;done=true;if(save)campSaveRename(id);else showCampaignPicker();}
  inp.addEventListener("blur",function(){commit(true);});
  inp.addEventListener("keydown",function(e){if(e.key==="Enter")commit(true);if(e.key==="Escape")commit(false);});
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
    if(raw){try{var ws=JSON.parse(raw);ws.campName=name;store.set(campSlotKey(id,"ws"),JSON.stringify(ws));}catch(e){console.warn("[camps] the rename could not be written into "+campDisplayName(id)+"'s stored save ("+(e&&e.message)+") — the picker row is renamed but the save still carries the old name; it reverts on the next list merge (audit E15)");}}
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
