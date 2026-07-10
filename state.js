var WSK="tnd_core_v10";var SLK="tnd_sess_v10";var MEM_KEY="tnd_mem_v10";var AKK="tnd_ak_v1";var RLK="tnd_rules_v9";var ADK="tnd_adult_v1";var PROSE_K="tnd_prose_v1";var FAL_KEY_K="tnd_fal_k_v1";var RENDER_MDL_K="tnd_render_mdl_v1";var RENDER_STR_K="tnd_render_str_v1";var TRANSCRIPT_RESCUE_K="tnd_transcript_rescue_v1_";/* + campId (UA3) */var PROV_K="tnd_provider_v1";var PKEYS_K="tnd_provider_keys_v1";var PMDL_K="tnd_provider_models_v1";var UPGRADE_K="tnd_model_upgrade_v1";
var _m={};      // in-memory fallback for keys localStorage can't persist (privacy mode OR quota)
var _mKeys={};  // keys whose authoritative value lives in _m — get() must prefer it over a stale disk copy
var store={
  get:function(k){if(_mKeys[k])return (k in _m)?_m[k]:null;try{return localStorage.getItem(k);}catch(e){return (k in _m)?_m[k]:null;}},
  set:function(k,v){try{localStorage.setItem(k,v);if(_mKeys[k]){delete _mKeys[k];delete _m[k];}}catch(e){
    // Keep the value in memory so this session doesn't lose data, and mark the key so get() serves it
    // instead of the STALE on-disk copy (audit E6 — a failed set no longer silently returns old data).
    // A quota overflow is RETHROWN so saveCore/saveMem can surface it to the user (audit E5 — the
    // "storage full" toast was previously unreachable); a privacy-mode denial stays a silent fallback.
    _m[k]=v;_mKeys[k]=1;
    if(e&&(e.name==="QuotaExceededError"||e.name==="NS_ERROR_DOM_QUOTA_REACHED"||e.code===22||e.code===1014))throw e;
  }},
  del:function(k){try{localStorage.removeItem(k);}catch(e){}delete _m[k];delete _mKeys[k];}
};
var worldState=null;
var sessionLog=[];
// Single source of truth for the empty-memory shape (audit #22). Every reset path
// (new game, new campaign, import) must use this — the old inline literals drifted
// (most omitted map/npcGraph/nameIdx and leaned on lazy guards to self-heal).
function blankMemory(){return {npcs:{},locations:{},quests:{},lore:[],keyDecisions:[],futureEvents:[],chapters:[],usedNames:[],nameIdx:0,map:{nodes:{},edges:[],lastArrivalFrom:null},npcGraph:{edges:[],factions:{},factionEdges:[],npcFactions:{}},archive:{lore:[],decisions:[],chapters:[],coreMemories:[]}};}/* archive: P12 eviction compaction — storage-only, never injected. coreMemories: #40 over-cap evictions (UA14: archive's consumers are the story compiler #5 + future RAG phases, NOT Core Memory itself) */
var memory=blankMemory();
// Usage/cost telemetry (TODO #21) — per-campaign accumulator on worldState.usage.
// byKind buckets: turn / actions / summarize / skeleton / sync / other. costUSD is an
// estimate priced at record time from MODEL_PRICING (unknown models contribute $0).
function blankUsage(){return {in:0,out:0,cacheRead:0,cacheWrite:0,calls:0,costUSD:0,byKind:{},since:Date.now()};}
// Provider settings loader — moved here from ui.js (v1.180): pure data logic over store +
// globals, needed by every page that calls the API (game AND the Blueprint Designer's
// generate/review features, which load the engine chain without ui.js).
function loadProviderSettings(){
  var p=store.get(PROV_K);if(p&&PROVIDERS[p])activeProvider=p;
  try{var pk=store.get(PKEYS_K);if(pk)providerKeys=JSON.parse(pk)||{};}catch(e){providerKeys={};}
  try{var pm=store.get(PMDL_K);if(pm)providerModels=JSON.parse(pm)||{};}catch(e2){providerModels={};}
  // Migrate the legacy single Anthropic key (AKK) into the provider map
  var legacy=store.get(AKK);if(legacy&&!providerKeys.anthropic)providerKeys.anthropic=legacy;
  if(providerKeys[activeProvider])apiKey=providerKeys[activeProvider];
  var upg=store.get(UPGRADE_K);allowModelUpgrade=(upg===null||upg===undefined)?true:upg==="true";
}
// Transcript compression (Known issue #3, v1.227): the append-only transcript is the dominant,
// ever-growing part of a mature save (54% of a t308 blob). We store it LZ-compressed INSIDE the
// localStorage blob — worldState.transcript -> {__lz:"..."} — halving the on-disk core (626K->283K chars
// on t308). The in-memory state, .tnd exports, and the server sync all keep the plain array; only the
// localStorage boundary compresses. parseWorldState is TOLERANT: it inflates a compressed transcript OR
// passes a plain array straight through (server blob / .tnd import / legacy pre-v1.227 saves). Degrades
// safely to plain JSON if compress.js (LZ) didn't load.
function serializeWorldState(ws){
  ws=(ws===undefined)?worldState:ws;
  if(ws&&ws.transcript&&ws.transcript.length&&typeof LZ!=="undefined"&&LZ.compressToUTF16){
    var snap={},k;for(k in ws){if(Object.prototype.hasOwnProperty.call(ws,k))snap[k]=ws[k];}
    snap.transcript={__lz:LZ.compressToUTF16(JSON.stringify(ws.transcript))};
    return JSON.stringify(snap);
  }
  return JSON.stringify(ws);
}
function parseWorldState(str){
  var o=JSON.parse(str);
  if(o&&o.transcript&&!(o.transcript instanceof Array)&&o.transcript.__lz){
    var _lzBlob=o.transcript.__lz,_ok=false;
    if(typeof LZ!=="undefined"&&LZ.decompressFromUTF16){
      try{var _inf=JSON.parse(LZ.decompressFromUTF16(_lzBlob));if(_inf instanceof Array){o.transcript=_inf;_ok=true;}}catch(e){}
    }
    if(!_ok){
      // NO-SILENT-FAILURES (UA3): the verbatim story record could not be read — compress.js absent
      // (script-order/SW-cache skew) or a corrupt blob. Two hazards: an un-inflated {__lz} object
      // poisons every transcript consumer (push throws mid-turn), and an empty [] gets PERSISTED
      // over the stored blob by the next saveCore (incl. the migrate-save right after load) —
      // permanent loss. So: preserve the compressed original under a per-campaign rescue key
      // (restoreTranscriptRescue re-inflates + prepends on a later healthy load), start empty,
      // and shout. Keep the OLDEST rescue if one already exists — it holds the longest record.
      var _rk=TRANSCRIPT_RESCUE_K+(o.campId||"default");
      try{if(!store.get(_rk))store.set(_rk,_lzBlob);}catch(e2){}
      o.transcript=[];
      console.error("[save] transcript inflate FAILED — compressed original preserved under "+_rk);
      if(typeof showToast==="function")showToast("⚠ Story record could not be read — a backup was preserved and will auto-recover on a healthy reload.");
    }
  }
  return o;
}
// UA3 recovery: re-inflate a rescued transcript once LZ is healthy again and PREPEND it (rescued
// entries strictly predate the loss). Overlap-guard: if the current transcript's first entry
// appears inside the rescue (the stored blob was never overwritten — e.g. the failed session
// closed without saving), only the part BEFORE the overlap is prepended (full-duplicate → nothing).
// Runs in loadState BEFORE the migrate-save so a healthy load persists the RESTORED record.
function restoreTranscriptRescue(){
  if(!worldState)return false;
  var _rk=TRANSCRIPT_RESCUE_K+(worldState.campId||"default");
  var lz=store.get(_rk);
  if(!lz)return false;
  if(typeof LZ==="undefined"||!LZ.decompressFromUTF16)return false; // still unhealthy — keep the rescue
  try{
    var old=JSON.parse(LZ.decompressFromUTF16(lz));
    if(!(old instanceof Array))throw new Error("rescue is not an array");
    if(!worldState.transcript)worldState.transcript=[];
    var cur=worldState.transcript,cut=old.length,i;
    if(cur.length){for(i=0;i<old.length;i++){if(old[i].t===cur[0].t&&old[i].r===cur[0].r&&old[i].x===cur[0].x){cut=i;break;}}}
    worldState.transcript=old.slice(0,cut).concat(cur);
    store.del(_rk);
    console.log("[save] transcript rescue restored — "+cut+" entries prepended");
    if(typeof showToast==="function"&&cut>0)showToast("✓ Story record recovered ("+cut+" entries).");
    return true;
  }catch(e){console.error("[save] transcript rescue re-inflate failed — keeping the rescue blob",e);return false;}
}
function saveCore(){try{store.set(WSK,serializeWorldState());store.set(SLK,JSON.stringify(sessionLog));}catch(e){if(typeof showToast==="function")showToast("⚠ Save failed — storage full. Export your save now.");console.error("[save] saveCore failed:",e);}}
function saveMem(){try{store.set(MEM_KEY,JSON.stringify(memory));}catch(e){if(typeof showToast==="function")showToast("⚠ Memory save failed — storage full.");console.error("[save] saveMem failed:",e);}}
// #2 (quota): snapshotActiveCamp() removed from saveAll — it duplicated the ENTIRE active state (incl. portraits)
// into tnd_camp_<id>_* on every turn, redundant with tnd_core_v10. The active campaign is still snapshotted on
// switch-away, beforeunload, and campaign ops — the moments the snapshot is actually read. ~halves the per-turn write.
function saveAll(){saveCore();saveMem();updateCampMeta();if(typeof storageAdapter!=="undefined")storageAdapter.syncToServer();}
// #12 — append-only campaign transcript: the verbatim prose record for the story compiler (#11) + cross-device
// completeness. Lives in worldState (rides in the sync blob). Written from the turn sources (sendAction/beginAdventure),
// NOT addMsg — addMsg re-fires when the last turns are re-rendered on reload, which would double-count.
// GM entries also get a write-time entity index (.e) from the RAW response — #27 Phase 1
// retrieval keys on it. Indexed regardless of the rag flag so the index is ready whenever
// the flag flips on; callers pass the pre-cleanTxt response as `raw` (falls back to the
// cleaned text, which still supports the known-NPC name scan).
// [RETCON:] de-index (RAG_MEMORY §5): a prose correction leaves BOTH versions of a scene in the
// transcript. When the GM emits the tag, mark the correcting entry AND the immediately preceding
// GM entry (the likely superseded narration) so ragRetrieve never serves either as episodic
// truth. `rc` rides at the top level of the entry — additive, invisible to everything but retrieval.
function logTranscript(role,text,raw){if(!worldState||!text)return;if(!worldState.transcript)worldState.transcript=[];var _e={t:worldState.turn,r:role,x:String(text).trim()};if(role==="gm"&&typeof ragEntitiesFromRaw==="function")_e.e=ragEntitiesFromRaw(raw||text);
  if(role==="gm"&&/\[RETCON:/i.test(String(raw||""))){_e.rc=1;var _tr=worldState.transcript,_bi;for(_bi=_tr.length-1;_bi>=0;_bi--){if(_tr[_bi].r==="gm"){_tr[_bi].rc=1;break;}}}
  worldState.transcript.push(_e);}
// Schema migrations for worldState — fills fields added by later versions. Runs on every
// load AND on save import (importSave previously skipped these — audit #15). Operates on
// the global worldState; returns true if anything was modified.
function migrateWorldState(){
  if(!worldState||!worldState.character)return false;
  var c=worldState.character,_mig=false;
  if(typeof c.level!=="number"||isNaN(c.level)){c.level=1;_mig=true;}if(typeof c.xp!=="number"||isNaN(c.xp)){c.xp=0;_mig=true;}
  if(typeof c.maxHp!=="number"||isNaN(c.maxHp)){c.maxHp=(typeof c.hp==="number"&&!isNaN(c.hp)&&c.hp>0)?c.hp:8;_mig=true;}// heal maxHp FIRST (audit E71) — else a NaN maxHp drives hp to NaN on the next [HP:] tag, every load
  if(typeof c.hp!=="number"||isNaN(c.hp)){c.hp=c.maxHp||8;_mig=true;}if(typeof c.gold!=="number"||isNaN(c.gold)){c.gold=0;_mig=true;}
  if(!c.abilities){c.abilities=[];_mig=true;}if(!c.spells){c.spells=[];_mig=true;}
  for(var si=0;si<c.spells.length;si++){if(c.spells[si].lvl===0&&c.spells[si].used){c.spells[si].used=false;_mig=true;}}// cantrips never expend
  if(!worldState.npcs){worldState.npcs=[];_mig=true;}if(!worldState.questLog){worldState.questLog=[];_mig=true;}if(!worldState.eventHistory){worldState.eventHistory=[];_mig=true;}if(worldState.world&&!('sublocation' in worldState.world)){worldState.world.sublocation=null;_mig=true;}if(!worldState.campName){worldState.campName=worldState.character.name;_mig=true;}if(!worldState.character.portraitOffset){worldState.character.portraitOffset={x:50,y:50};_mig=true;}if(!worldState.campId){var _aid=getActiveCampId();if(_aid){worldState.campId=_aid;_mig=true;}}if(!worldState.legacyCharsUsed){worldState.legacyCharsUsed=[];_mig=true;}if(!worldState.transcript){worldState.transcript=[];_mig=true;}if(worldState.actStartTurn===undefined){worldState.actStartTurn=0;_mig=true;}if(worldState.pendingLegacy===undefined){worldState.pendingLegacy=null;_mig=true;}if(worldState.questLog){var _ql;for(_ql=0;_ql<worldState.questLog.length;_ql++){if(!worldState.questLog[_ql].objectives){worldState.questLog[_ql].objectives=[];_mig=true;}if(worldState.questLog[_ql].desc===undefined){worldState.questLog[_ql].desc="";_mig=true;}}}
  if(!worldState.usage){worldState.usage=blankUsage();_mig=true;}
  if(!worldState.coreMemories){worldState.coreMemories=[];_mig=true;}/* #40 Core Memory — party-shared defining moments */
  // Known issue #3 dedupe: companion portraits were stored 2× (npc.portrait + charSheet.portrait,
  // ~22-52KB each). charSheet.portrait is now the single home for any NPC with a sheet — move a
  // lone npc.portrait in, then drop the duplicate. Display reads go through npcPortrait() (helpers).
  var _pn;for(_pn=0;_pn<worldState.npcs.length;_pn++){var _pnp=worldState.npcs[_pn];
    if(_pnp&&_pnp.charSheet&&_pnp.portrait){
      if(!_pnp.charSheet.portrait)_pnp.charSheet.portrait=_pnp.portrait;
      _pnp.portrait=null;_mig=true;
    }}
  // XP floor invariant: xp must be ≥ the current level's threshold. Player creation enforces
  // this (char-creation floors starting XP) but companion sheets never did — an imported Lv7
  // sheet with xp below XP_LEVELS[6] rendered a negative→full XP bar (the Morwen lie) and
  // implied more progress than existed. Floor, don't relevel: the character KEEPS the level
  // they've been played at; progress toward the next one restarts from the floor.
  function _xpFloor(ch){if(!ch||typeof ch.level!=="number")return;var fl=XP_LEVELS[ch.level-1]||0;if(typeof ch.xp!=="number"||ch.xp<fl){ch.xp=fl;_mig=true;}}
  _xpFloor(worldState.character);
  for(_pn=0;_pn<worldState.npcs.length;_pn++){if(worldState.npcs[_pn]&&worldState.npcs[_pn].charSheet)_xpFloor(worldState.npcs[_pn].charSheet);}
  // P6 retro-clamp: pre-v1.211 saves carry sentence-length NPC statuses that ride the roster every
  // turn until the GM next re-emits the tag. clampNpcMood lives in memory.js (loaded after state.js
  // but present by the time this runs on load); guard for the edge where it isn't.
  if(typeof clampNpcMood==="function"){for(_pn=0;_pn<worldState.npcs.length;_pn++){var _cn=worldState.npcs[_pn];if(_cn&&_cn.status){var _cs=clampNpcMood(_cn.status);if(_cs!==_cn.status){_cn.status=_cs;_mig=true;}}}}
  return _mig;
}
function loadState(){
  var ws,sl,mm;try{ws=store.get(WSK);sl=store.get(SLK);mm=store.get(MEM_KEY);}catch(e){return false;}
  // Reset the per-campaign sync bookkeeping (audit E32) — loadState runs on init AND on every
  // campaign switch, so the ACK baseline / failure count don't carry across campaigns.
  if(typeof storageAdapter!=="undefined"&&storageAdapter.resetSyncState)storageAdapter.resetSyncState();
  if(typeof _sumFails!=="undefined")_sumFails=0; // don't carry a summarize failure streak across campaigns (audit E49)
  // Parse each key in its OWN try/catch (audit E73): a corrupt memory/session key must NOT discard a
  // good worldState (the old single try returned false with worldState still assigned, so the wizard
  // then overwrote the intact campaign). SLK is parsed BEFORE the migrate/saveCore (audit E36) so a
  // migrate-save persists the loaded log, not the stale global.
  try{sessionLog=sl?JSON.parse(sl):[];}catch(e){sessionLog=[];}
  try{if(ws){worldState=parseWorldState(ws);restoreTranscriptRescue();/* UA3: BEFORE the migrate-save — a healthy load must persist the restored record, and a migrate-save must never persist a just-emptied one over a recoverable blob */if(migrateWorldState())saveCore();}}catch(e){worldState=null;return false;}
  try{if(mm){memory=JSON.parse(mm);healMemory();}else memory=blankMemory();}catch(e){memory=blankMemory();}
  return !!ws&&!!worldState;
}
// Fill the shape defaults an older/foreign memory blob may be missing. Extracted from loadState so
// the server-adopt path can run the same heals (audit E14) — importSave already got migrateWorldState
// (audit #15), but the server reconcile adopted un-migrated, un-healed blobs. Operates on the global.
function healMemory(){
  if(!memory)memory=blankMemory();
  if(!memory.futureEvents)memory.futureEvents=[];
  if(!memory.usedNames)memory.usedNames=[];
  if(!memory.map)memory.map={nodes:{},edges:[],lastArrivalFrom:null};
  if(!memory.map.edges)memory.map.edges=[];
  if(!memory.map.nodes)memory.map.nodes={};
  if(!memory.npcGraph)memory.npcGraph={edges:[],factions:{},factionEdges:[],npcFactions:{}};
  if(typeof memory.nameIdx!=="number")memory.nameIdx=0;
  if(!memory.npcGraph.factions)memory.npcGraph.factions={};
  if(!memory.npcGraph.factionEdges)memory.npcGraph.factionEdges=[];
  if(!memory.npcGraph.npcFactions)memory.npcGraph.npcFactions={};
  if(!memory.archive)memory.archive={lore:[],decisions:[],chapters:[]};/* P12: pre-archive saves */
  if(!memory.archive.lore)memory.archive.lore=[];
  if(!memory.archive.decisions)memory.archive.decisions=[];
  if(!memory.archive.chapters)memory.archive.chapters=[];
  if(!memory.archive.coreMemories)memory.archive.coreMemories=[];/* #40 */
  // P6 retro-clamp: sentence-length attitudes from pre-v1.211 extractor runs (memoryNpcDetail injects them).
  if(typeof clampNpcMood==="function"&&memory.npcs){var _ank=Object.keys(memory.npcs),_ai2;for(_ai2=0;_ai2<_ank.length;_ai2++){var _an=memory.npcs[_ank[_ai2]];if(_an&&_an.attitude)_an.attitude=clampNpcMood(_an.attitude);}}
  // P7 cleanup: blueprint import (pre-fix) stored each location description TWICE —
  // memory.locations[k].notes AND memory.map.nodes[k].description, byte-identical
  // (~43KB duplicated per ToA campaign, riding every sync POST). The node description
  // is the single home now; drop any note identical to it so existing saves shed the
  // dead weight on load. Runtime event notes (never equal to the canonical text) survive.
  if(memory.locations){
    var _hk=Object.keys(memory.locations),_hi;
    for(_hi=0;_hi<_hk.length;_hi++){
      var _he=memory.locations[_hk[_hi]],_hn=memory.map.nodes[_hk[_hi]];
      if(_he&&_he.notes&&_he.notes.length&&_hn&&_hn.description){
        var _hj;for(_hj=_he.notes.length-1;_hj>=0;_hj--){if(_he.notes[_hj]===_hn.description)_he.notes.splice(_hj,1);}
      }
    }
  }
}
// ── Campaign management ───────────────────────────────────────────────────────
var CAMP_META_K="tnd_camps_v1";var ACTIVE_CAMP_K="tnd_active_v1";var LEGACY_ON_K="tnd_legacy_on_v1";var LEGACY_PCT_K="tnd_legacy_pct_v1";
function getCampMeta(){var r=store.get(CAMP_META_K);if(!r)return[];try{return JSON.parse(r);}catch(e){
  // Back up the corrupt list before callers overwrite it (audit E72) — the next updateCampMeta would
  // persist a [] wipe, unlisting every other campaign; the raw copy keeps them recoverable.
  try{store.set("tnd_camps_v1_corrupt",r);}catch(x){}if(typeof console!=="undefined")console.warn("[camps] campaign list corrupt — backed up to tnd_camps_v1_corrupt");return[];}}
function setCampMeta(arr){store.set(CAMP_META_K,JSON.stringify(arr));}
function getActiveCampId(){return store.get(ACTIVE_CAMP_K)||null;}
function setActiveCampId(id){if(id)store.set(ACTIVE_CAMP_K,id);else store.del(ACTIVE_CAMP_K);}
function newCampaignId(){return"camp_"+Date.now()+"_"+Math.floor(Math.random()*9000+1000);}
function updateCampMeta(){
  var id=getActiveCampId();if(!id||!worldState)return;
  var c=worldState.character,w=worldState.world;
  var entry={id:id,campName:worldState.campName||c.name,charName:c.name,charClass:c.cls,charAncestry:c.subraceNm||c.ancestry||"",level:c.level,location:w.location,savedAt:Date.now()};
  var meta=getCampMeta(),found=false,i;
  for(i=0;i<meta.length;i++){if(meta[i].id===id){meta[i]=Object.assign({},meta[i],entry);found=true;break;}}
  if(!found)meta.push(entry);
  setCampMeta(meta);
}
function snapshotActiveCamp(){
  var id=getActiveCampId();if(!id)return;
  var ws=store.get(WSK),sl=store.get(SLK),mem=store.get(MEM_KEY);
  if(ws)store.set("tnd_camp_"+id+"_ws",ws);
  if(sl)store.set("tnd_camp_"+id+"_sl",sl);
  if(mem)store.set("tnd_camp_"+id+"_mem",mem);
  updateCampMeta();
  // Flush the debounced server sync before leaving this campaign (audit E74): snapshotActiveCamp is
  // the "about to switch/wipe" signal, and switchToCampaign/campNew/newGame/import never flushed —
  // so the outgoing campaign's final turn(s) could sit unsent in the 1.5s debounce window.
  if(typeof storageAdapter!=="undefined"&&storageAdapter.syncNow)storageAdapter.syncNow();
}
function switchToCampaign(id){
  snapshotActiveCamp();
  // Capture the live keys + active id so a failed load can roll back (audit E35). Without this,
  // when loadState() fails on a corrupt target slot, the active id and live keys are already
  // repointed while the worldState/memory globals still hold the OLD campaign — the next saveAll
  // then writes campaign A's state under campaign B's id, locally AND on the server.
  var prevWs=store.get(WSK),prevSl=store.get(SLK),prevMem=store.get(MEM_KEY),prevId=getActiveCampId();
  var ws=store.get("tnd_camp_"+id+"_ws"),sl=store.get("tnd_camp_"+id+"_sl"),mem=store.get("tnd_camp_"+id+"_mem");
  if(ws)store.set(WSK,ws);else store.del(WSK);
  if(sl)store.set(SLK,sl);else store.del(SLK);
  if(mem)store.set(MEM_KEY,mem);else store.del(MEM_KEY);
  setActiveCampId(id);
  var ok=loadState();
  if(!ok){
    if(prevWs)store.set(WSK,prevWs);else store.del(WSK);
    if(prevSl)store.set(SLK,prevSl);else store.del(SLK);
    if(prevMem)store.set(MEM_KEY,prevMem);else store.del(MEM_KEY);
    setActiveCampId(prevId);
    loadState(); // restore the previous campaign into the globals
    if(typeof showToast==="function")showToast("Couldn't load that campaign — its save looks corrupted.");
  }
  return ok;
}
function deleteCampaign(id){
  store.del("tnd_camp_"+id+"_ws");store.del("tnd_camp_"+id+"_sl");store.del("tnd_camp_"+id+"_mem");
  setCampMeta(getCampMeta().filter(function(c){return c.id!==id;}));
}
function migrateToCampaigns(){
  if(getActiveCampId())return;
  var id=newCampaignId();setActiveCampId(id);
  if(worldState)worldState.campId=id;
  snapshotActiveCamp();
}
