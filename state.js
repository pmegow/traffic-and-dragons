var WSK="tnd_core_v10";var SLK="tnd_sess_v10";var MEM_KEY="tnd_mem_v10";var AKK="tnd_ak_v1";var RLK="tnd_rules_v9";var ADK="tnd_adult_v1";var PROSE_K="tnd_prose_v1";var FAL_KEY_K="tnd_fal_k_v1";var RENDER_MDL_K="tnd_render_mdl_v1";var RENDER_STR_K="tnd_render_str_v1";var TRANSCRIPT_RESCUE_K="tnd_transcript_rescue_v1_";/* + campId (UA3) */var STORE_RESCUE_K="tnd_store_rescue_v1_";/* + tier + "_" + campId (JP0-4) — see rescueCorruptStore */var CLOCK_RESCUE_K="tnd_clock_rescue_v1_";/* + campId (#274) — see clockRescueCorrupt (clock.js) */var PROV_K="tnd_provider_v1";var PKEYS_K="tnd_provider_keys_v1";var PMDL_K="tnd_provider_models_v1";var GMROUTE_K="tnd_gmroute_v1";/* "auto"|"byok" — account-mode GM routing (§3 gateway) */var UPGRADE_K="tnd_model_upgrade_v1";var PENDING_ACT_K="tnd_pending_act_v1";/* #14: the failed-turn action, campaign-stamped — its OWN key so the failure path never runs saveAll */
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
/* attitudeSpec:2 at birth (v1.439, F7 — brief D): a memory born WITHOUT the marker re-fires the
   v1.383 one-time clear on its first loadState and wipes CORRECT new-spec dispositions. New
   campaigns are born ON the current spec — there is nothing to heal. */
/* JP0-5 (joint review 2026-08-27, Sol P0-03) — THE memory.archive category registry.
   FOUR separate hand-copied allowlists used to enumerate these categories (blankMemory and
   healMemory here, memArchive in memory.js, the .tnd import rebuild in ui-files.js), and the
   import one has now silently DESTROYED a category four times: attitudeSpec, eras, the #144A trio
   (superseded/coreMemories/expiredSchedules), and npcDeathCorrections — the death-retraction
   pre-images written at tag_table.js. Measured at the fix: it was also dropping relDowngrades,
   and healMemory/memArchive had each drifted their own way. The second-instance rule says
   enumerate the class, so: ONE list, four derived consumers.
   The list is NOT the class-closer, though — `archiveRebuild` CARRYING UNKNOWN CATEGORIES
   THROUGH VERBATIM is. A category this build has never heard of (a future engine key, or one of
   the dev repair tools' own: retconRepairs, repairBundles) survives a .tnd round-trip with zero
   edits here. Registering a category only buys the empty-array default and the array type-guard;
   forgetting to register one can no longer destroy anyone's data.
   archive contents are storage-only — never prompt-injected (P12 eviction compaction; the
   consumers are the story compiler #5 + future RAG phases, NOT the live tiers). */
var MEMORY_ARCHIVE_KEYS=["lore","decisions","chapters","superseded","coreMemories","expiredSchedules","npcKnowledge","npcEvents","retconPins","locationStates","futureEvents","npcForgotten","identityMerges","identityQuarantines","relDowngrades","npcDeathCorrections","quarantinedReceipts"];/* #262: retired quarantined canon receipts (f56) — the registry makes this one line, everywhere */
function blankArchive(){var a={},i;for(i=0;i<MEMORY_ARCHIVE_KEYS.length;i++)a[MEMORY_ARCHIVE_KEYS[i]]=[];return a;}
/* Rebuild memory.archive from an UNTRUSTED source blob (the .tnd import). Registered categories
   default to [] and are array-guarded (a junk value must never become canon); unregistered ones
   are carried VERBATIM — dropping a category because this build does not know it IS the defect. */
function archiveRebuild(src){
  var out=blankArchive(),known={},k,i;
  for(i=0;i<MEMORY_ARCHIVE_KEYS.length;i++)known[MEMORY_ARCHIVE_KEYS[i]]=1;
  if(src&&typeof src==="object"&&!(src instanceof Array)){
    for(k in src){
      if(!Object.prototype.hasOwnProperty.call(src,k))continue;
      if(known[k]){if(Array.isArray(src[k]))out[k]=src[k];}
      else out[k]=src[k];/* unknown category: carry, never guess, never drop */
    }
  }
  return out;
}
/* Fill any missing registered category IN PLACE (the heal/lazy-init path). Adds only — it never
   drops or reshapes what is already there, registered or not. */
function archiveHeal(arc){
  var i,k;
  if(!arc||typeof arc!=="object"||arc instanceof Array){
    if(arc!==undefined&&arc!==null&&typeof console!=="undefined")console.warn("[memory] archive was not an object ("+((arc instanceof Array)?"array":typeof arc)+") — replaced with an empty archive (JP0-5)");
    arc=blankArchive();
  }
  for(i=0;i<MEMORY_ARCHIVE_KEYS.length;i++){k=MEMORY_ARCHIVE_KEYS[i];if(!arc[k])arc[k]=[];}
  return arc;
}
function blankMemory(){return {npcs:{},locations:{},quests:{},lore:[],keyDecisions:[],futureEvents:[],chapters:[],eras:[],nameIdx:0,attitudeSpec:2,map:{nodes:{},edges:[],lastArrivalFrom:null},npcGraph:{edges:[],factions:{},factionEdges:[],npcFactions:{}},archive:blankArchive()};}/* eras: #148 Phase 2 — compiled era summaries above chapters; legacy saves self-heal via memEras() */
var memory=blankMemory();
// Usage/cost telemetry (TODO #21) — per-campaign accumulator on worldState.usage.
// byKind buckets: turn / actions / summarize / skeleton / sync / other. costUSD is an
// estimate priced at record time from MODEL_PRICING (unknown models contribute $0).
function blankUsage(){return {in:0,out:0,cacheRead:0,cacheWrite:0,calls:0,costUSD:0,unpriced:0,byKind:{},since:Date.now()};}/* unpriced (#30, v1.280): calls whose model id missed MODEL_PRICING — counted, $0 priced */
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
  var gr=store.get(GMROUTE_K);if(gr==="byok"||gr==="auto")gmRouting=gr;
}
// Transcript compression (Known issue #3, v1.227): the append-only transcript is the dominant,
// ever-growing part of a mature save (54% of a t308 blob). We store it LZ-compressed INSIDE the
// localStorage blob — worldState.transcript -> {__lz:"..."} — halving the on-disk core (626K->283K chars
// on t308). In-memory state and .tnd exports keep the plain array; localStorage and cloud-sync snapshots
// both store transcript as {__lz:"..."}. parseWorldState is TOLERANT: it inflates that form OR passes a
// plain array straight through (.tnd import / legacy pre-v1.227 saves). Degrades
// safely to plain JSON if compress.js (LZ) didn't load.
// Audit 07-16 #1: memoize the compressed-transcript blob. saveAll() runs 3+×/turn (end of
// applyMutsTable, sendAction, generateActions) and each call re-LZ'd the WHOLE append-only
// transcript (hundreds of KB on a mature save) on the UI thread. The memo sits STRICTLY above
// LZ.compressToUTF16 — a hit returns the byte-identical string a fresh compression would produce.
// Keyed by the transcript ARRAY OBJECT via WeakMap (the one sanctioned WeakMap use): ui.js also
// calls serializeWorldState with server-pulled worldState objects, and object keying means those
// can never cross-contaminate the live campaign's memo; entries GC with their arrays.
// Validity = same array ref + same .length + same last-entry OBJECT ref + same last-entry .x:
//   • append (logTranscript) → length changes → miss.
//   • [RETCON:] rc-marks the PRECEDING gm entry, but only inside the same logTranscript call
//     that appends (state.js below) → covered by the length check.
//   • rerollLast (game.js) mutates the last entry IN PLACE (.x/.e on the SAME object — it does
//     NOT swap it), so lastRef alone would serve a stale blob: the .x check catches it, and
//     rerollLast also calls serializeWorldState.invalidateTranscriptMemo() explicitly
//     (belt and suspenders — .e alone could change while .x stays equal).
//   • ragRetrieve's lazy .e backfill (memory.js) mutates OLD entries idempotently; a memoized
//     blob missing backfilled .e fields is ACCEPTED — the backfill recomputes lazily after any
//     reload, so nothing is lost (audit-row ruling).
// The LZ-absent degrade path (plain JSON) never touches the memo.
var _trLzMemo=(typeof WeakMap!=="undefined")?new WeakMap():null;
// #92: the compressed SNAPSHOT builder — ONE producer for the localStorage boundary
// (serializeWorldState below) AND the cloud-sync POST paths (storage-adapter), so the wire
// format and the disk format can never diverge. Returns a NEW top-level object with
// transcript → {__lz:…}; the live ws and its transcript array are NEVER mutated. Returns ws
// UNCHANGED (same reference) when there is nothing to compress or LZ is absent — the degrade
// is today's plain payload, and the memo (shared) means a saveCore-then-sync turn pays for
// exactly ONE compression.
function compressWorldStateSnapshot(ws){
  if(!(ws&&ws.transcript&&ws.transcript.length&&typeof LZ!=="undefined"&&LZ.compressToUTF16))return ws;
  var snap={},k;for(k in ws){if(Object.prototype.hasOwnProperty.call(ws,k))snap[k]=ws[k];}
  var tr=ws.transcript,len=tr.length,last=tr[len-1],lz=null;
  var hit=_trLzMemo?_trLzMemo.get(tr):null;
  if(hit&&hit.len===len&&hit.lastRef===last&&hit.lastX===last.x){lz=hit.lz;}
  else{
    lz=LZ.compressToUTF16(JSON.stringify(tr));
    serializeWorldState._compressions++;
    if(_trLzMemo)_trLzMemo.set(tr,{len:len,lastRef:last,lastX:last.x,lz:lz});
  }
  snap.transcript={__lz:lz};
  return snap;
}
// #272 D2 Phase B (f70 lever b, ruling R1): the DISK boundary chunks a mature transcript —
// frozen segments of TRANSCRIPT_SEG entries, each compressed ONCE and cached, plus a live tail
// recompressed per save. Per-save cost becomes O(segment) instead of O(campaign) — the
// whole-transcript form doubled its cost every ~2000 turns, forever. The four transcript
// mutation classes each have an invalidation story: appends land in the tail; the .sp stamp /
// rerollLast touch the LAST entry (tail); a turn-addressed [RETCON:] routes through
// mutateTranscriptEntry, which passes the index so exactly ONE segment rebuilds; ragRetrieve's
// lazy .e backfill is ACCEPTED stale per the standing audit ruling (recomputes after any
// reload). A transcript under one segment keeps the plain {__lz} form byte-identically — and so
// does the WIRE at every size until the Phase-C flip (wireWorldStateSnapshot above the memo).
var TRANSCRIPT_SEG=256;
var _trSegMemo=(typeof WeakMap!=="undefined")?new WeakMap():null;
function compressWorldStateSnapshotChunked(ws){
  if(!(ws&&ws.transcript&&ws.transcript.length>=TRANSCRIPT_SEG&&_trSegMemo&&typeof LZ!=="undefined"&&LZ.compressToUTF16))return compressWorldStateSnapshot(ws);
  var tr=ws.transcript,len=tr.length,segCount=Math.floor(len/TRANSCRIPT_SEG),i;
  var cache=_trSegMemo.get(tr);
  if(!cache){cache={blobs:[],tail:null};_trSegMemo.set(tr,cache);}
  var segs=[];
  for(i=0;i<segCount;i++){
    if(cache.blobs[i]==null){
      cache.blobs[i]=LZ.compressToUTF16(JSON.stringify(tr.slice(i*TRANSCRIPT_SEG,(i+1)*TRANSCRIPT_SEG)));
      serializeWorldState._compressions++;
    }
    segs.push(cache.blobs[i]);
  }
  var last=tr[len-1],tailLz;
  if(cache.tail&&cache.tail.len===len&&cache.tail.lastRef===last&&cache.tail.lastX===last.x){tailLz=cache.tail.lz;}
  else{
    tailLz=LZ.compressToUTF16(JSON.stringify(tr.slice(segCount*TRANSCRIPT_SEG)));
    serializeWorldState._compressions++;
    cache.tail={len:len,lastRef:last,lastX:last.x,lz:tailLz};
  }
  var snap={},k;for(k in ws){if(Object.prototype.hasOwnProperty.call(ws,k))snap[k]=ws[k];}
  snap.transcript={__lzc:{v:1,seg:TRANSCRIPT_SEG,segs:segs,tail:tailLz}};
  return snap;
}
function serializeWorldState(ws){
  ws=(ws===undefined)?worldState:ws;
  return JSON.stringify(compressWorldStateSnapshotChunked(ws));
}
serializeWorldState._compressions=0; // test/diagnostic hook: counts ACTUAL LZ passes (memo hits don't increment)
// #272 D2: the optional index makes invalidation SEGMENT-PRECISE — mutateTranscriptEntry passes
// it, so a turn-addressed RETCON rebuilds one segment, not the whole frozen past. No index =
// full clear (rerollLast's belt-and-suspenders call, the stamp fallback) — correctness first:
// a tail-only clear on an unknown-index mutation would persist a stale segment (the entry-4 ★
// class this seam exists to kill).
serializeWorldState.invalidateTranscriptMemo=function(tr,i){
  if(!tr)return;
  if(_trLzMemo)_trLzMemo["delete"](tr);
  if(_trSegMemo){
    var c=_trSegMemo.get(tr);
    if(c){
      if(typeof i==="number"&&i>=0){
        if(i<c.blobs.length*TRANSCRIPT_SEG)c.blobs[Math.floor(i/TRANSCRIPT_SEG)]=null;
        else c.tail=null;
      }else _trSegMemo["delete"](tr);
    }
  }
};
// #272 D3 / #280: THE one wire-form producer for BOTH POST /api/state paths (_syncNow and
// pushCampaignState — the B9 one-map rule). WIRE_TRANSCRIPT_FORM gates each release-gated flip
// under the inflater-first rule (every deployed client carries a form's inflater for a full
// cycle before any producer emits it — a stale device pulling a form it cannot read would
// rescue-and-empty its story view):
//   "lz"    — the original whole-transcript {__lz} (v1.742 and earlier);
//   "lzb64" — the whole stream repacked 6-bit ASCII (inflater shipped v1.742; never produced —
//             superseded by the chunked flip below, kept as a valid selectable form);
//   "lzc"   — THE SHIPPED FORM (#280, owner-confirmed fleet on v1.744): the SAME chunked
//             snapshot the disk stores, sharing the segment cache — the POST build pays ZERO
//             LZ passes, retiring the last O(campaign) compression per turn (~1.1s at t2097).
//             Young transcripts fall back to plain {__lz} inside the chunked producer.
// Remainder: v2/enc:"b64" PACKED segments (−15% wire bytes, measured 1571→1336KB at t2097) —
// its inflater ships with this flip; producing it is the next cycle's one-line flag change.
var WIRE_TRANSCRIPT_FORM="lzc";
function wireWorldStateSnapshot(ws){
  if(WIRE_TRANSCRIPT_FORM==="lzc")return compressWorldStateSnapshotChunked(ws);
  var snap=compressWorldStateSnapshot(ws);
  if(WIRE_TRANSCRIPT_FORM==="lzb64"&&snap.transcript&&typeof snap.transcript.__lz==="string"&&typeof LZ!=="undefined"&&LZ.packWire){
    var _packed=null;try{_packed=LZ.packWire(snap.transcript.__lz);}catch(e){_packed=null;}
    if(_packed){var w={},k;for(k in snap){if(Object.prototype.hasOwnProperty.call(snap,k))w[k]=snap[k];}w.transcript={__lzb64:_packed};return w;}
    if(typeof console!=="undefined")console.warn("[save] wire repack failed — shipping the {__lz} form for this POST");
  }
  return snap;
}
// #272 D3: pure inflate ATTEMPT for every transcript form ever shipped — plain array, {__lz}
// (#92), {__lzb64} (wire repack), {__lzc} (chunked segments, produced from Phase B). Returns the
// plain array or null; NO side effects, NO rescue writes — the reconcile uses it to REFUSE
// adopting a blob this build cannot read (the server copy stays where it is), and
// inflateWorldStateSnapshot routes its rescue path through the same attempt.
function _lzToArray(blob){
  if(typeof LZ==="undefined"||!LZ.decompressFromUTF16)return null;
  try{var a=JSON.parse(LZ.decompressFromUTF16(blob));return (a instanceof Array)?a:null;}catch(e){return null;}
}
function inflateTranscriptField(t){
  if(t instanceof Array)return t;
  if(!t||typeof t!=="object")return null;
  try{
    if(typeof t.__lz==="string")return _lzToArray(t.__lz);
    if(typeof t.__lzb64==="string"){
      var _u=(typeof LZ!=="undefined"&&LZ.unpackWire)?LZ.unpackWire(t.__lzb64):null;
      return _u?_lzToArray(_u):null;
    }
    if(t.__lzc&&typeof t.__lzc==="object"){
      var c=t.__lzc,parts=[],i,arr,blob;
      if(!Array.isArray(c.segs))return null;
      /* #280: v2/enc:"b64" carries each segment packWire'd (6-bit ASCII — the wire-bytes
         remainder); unpack per blob before the LZ inflate. v1 blobs are raw compressToUTF16. */
      var _packed=(c.v===2&&c.enc==="b64");
      if(_packed&&(typeof LZ==="undefined"||!LZ.unpackWire))return null;
      var _blobArr=function(b){if(_packed){b=LZ.unpackWire(b);if(b==null)return null;}return _lzToArray(b);};
      for(i=0;i<c.segs.length;i++){arr=_blobArr(c.segs[i]);if(!arr)return null;parts=parts.concat(arr);}
      if(c.tail){arr=_blobArr(c.tail);if(!arr)return null;parts=parts.concat(arr);}
      return parts;
    }
  }catch(e){}
  return null;
}
// #92: the object-form inflater — the SAME tolerance parseWorldState has always applied to
// strings, exposed for consumers that receive an already-PARSED blob. The one that matters:
// the server reconcile ADOPT (storage-adapter), which consumed the pulled blob raw and would
// otherwise poison live state with a {__lz} transcript ({__lz}.push throws mid-turn). A plain
// array passes through untouched; inflate failure takes the UA3 rescue path below.
function inflateWorldStateSnapshot(o){
  if(o&&o.transcript&&!(o.transcript instanceof Array)){
    /* #272 D3: one tolerant attempt for EVERY shipped form ({__lz}/{__lzb64}/{__lzc}); an
       UNRECOGNIZED object form now takes the same loud rescue path instead of passing through
       poisoned ({__lzfuture}.push would have thrown mid-turn — the exact hazard UA3 names). */
    var _lzBlob=(typeof o.transcript.__lz==="string")?o.transcript.__lz:JSON.stringify(o.transcript),_ok=false;
    var _inf=inflateTranscriptField(o.transcript);
    if(_inf){o.transcript=_inf;_ok=true;}
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
function parseWorldState(str){return inflateWorldStateSnapshot(JSON.parse(str));}
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
    /* #272 D3: a rescue may now hold a JSON object form ({__lzb64}/{__lzc}/unknown-at-rescue-time)
       beside the legacy bare {__lz} blob. Blob-first (most rescues are legacy; a blob that
       coincidentally parses as JSON is effectively impossible), then the object route. */
    var old=null;
    try{old=JSON.parse(LZ.decompressFromUTF16(lz));}catch(eB){old=null;}
    if(!(old instanceof Array)&&typeof inflateTranscriptField==="function"){
      try{var _ro=JSON.parse(lz);old=inflateTranscriptField(_ro);}catch(eJ){}
    }
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
function saveCore(){try{store.set(WSK,serializeWorldState());store.set(SLK,JSON.stringify(sessionLog));}catch(e){if(typeof showToast==="function")showToast("⚠ Save failed — storage full. Free space: Campaigns → \"Remove local\" on old campaigns.");console.error("[save] saveCore failed:",e);}}
function saveMem(){try{store.set(MEM_KEY,JSON.stringify(memory));}catch(e){if(typeof showToast==="function")showToast("⚠ Memory save failed — storage full.");console.error("[save] saveMem failed:",e);}}
// #2 (quota): snapshotActiveCamp() removed from saveAll — it duplicated the ENTIRE active state (incl. portraits)
// into tnd_camp_<id>_* on every turn, redundant with tnd_core_v10. The active campaign is still snapshotted on
// switch-away, beforeunload, and campaign ops — the moments the snapshot is actually read. ~halves the per-turn write.
/* #272 D1 (R4): everything but the cloud arm. generateActions' late save lands seconds after the
   turn's debounced POST fired, and re-arming the debounce shipped a SECOND full-state POST per
   turn for three suggestion strings. It saves locally now; the suggestions reach the server on
   the next turn's POST or any page-hide flush (syncNow on beforeunload/visibilitychange — the
   device-handoff case). A second device pulling MID-session may show the previous turn's
   suggestion buttons: cosmetic, accepted by ruling. */
function saveLocal(){saveCore();saveMem();updateCampMeta();}
function saveAll(){saveLocal();if(typeof storageAdapter!=="undefined")storageAdapter.syncToServer();}
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
function logTranscript(role,text,raw,taMin,meta){var _bk=!!(meta&&meta.bookkeeping);if(!worldState||(!text&&!_bk))return;if(!worldState.transcript)worldState.transcript=[];var _e={t:worldState.turn,r:role,x:String(text||"").trim()};if(_bk)_e.bk=1;if(meta&&meta.refusal)_e.rf=1;/* #197: an in-band model refusal — non-canon; ragRetrieve never serves rf entries */if(role==="gm"&&!_bk&&typeof ragEntitiesFromRaw==="function")_e.e=ragEntitiesFromRaw(raw||text);
  if(role==="gm"&&typeof _lastTurnModel!=="undefined"&&_lastTurnModel)_e.m=_lastTurnModel;/* #45: attribute the narration to the model that wrote it (additive, like .e) */
  /* #105b: minutes the campaign clock actually moved on this turn. Stamped even when ZERO — a
     no-[TIME_ADVANCE:] turn is the silent-failure class this field exists to expose, so absence
     of movement must be RECORDED, not inferred from a missing key (a missing key can't be told
     apart from a pre-feature entry). Measured as a clock delta by the caller rather than parsed
     from the tag, so a [REST:long] dawn roll is captured too. Additive, like .e/.m/.v/.sp —
     and because it lands at PUSH time, transcript.length changes and the compression memo
     misses on its own (no invalidateTranscriptMemo needed; that trap is post-stamp only). */
  if(role==="gm"&&typeof taMin==="number"&&isFinite(taMin))_e.ta=Math.max(0,Math.round(taMin));
  /* #106b: the ABSOLUTE clock when this turn was narrated, so a transcript rebuilt on reload can
     caption each past turn with the time it actually happened. Distinct from .ta on purpose:
     .ta is what the turn CHARGED (the diagnostic, and not derivable across gaps or imports),
     .ck is WHEN it was (the display anchor). Entries older than this field simply render with
     no timestamp — the caption degrades to the bare turn number rather than guessing. */
  if(role==="gm"&&typeof clockNow==="function")_e.ck=clockNow();
  if(role==="gm"&&typeof APP_VERSION!=="undefined")_e.v=APP_VERSION;/* #45b: engine version per turn — "what version was the phone on?" is now answerable from any export */
  if(role==="gm"&&/\[RETCON:/i.test(String(raw||""))){_e.rc=1;
    /* #187④a (v1.618): the tag is TURN-ADDRESSED when its payload ends in |<number> —
       [RETCON:the vault was never opened|1612] rc-marks every GM entry of turn 1612 instead of
       the immediately preceding one, so a LATE correction de-indexes the right scene (Sol's
       objection to delayed tags was an artifact of adjacency addressing — the medicine landed
       on the wrong patient). The bare one-field form keeps its exact adjacency behavior. A
       parsed turn NEVER falls back to adjacency: if the named turn has no GM entry, warn loudly
       and mark only the correcting response (eating turns the GM did not name is the exact
       class the extension exists to kill). All marks route through the #177 seam. */
    var _tr=worldState.transcript,_bi;
    var _rpM=String(raw).match(/\[RETCON:([^\]]*)\]/i),_rpWhat=_rpM&&_rpM[1]?_rpM[1].trim():"",_rpTm=_rpWhat.match(/^(.*\S)\s*\|\s*(\d{1,6})\s*$/);
    if(_rpTm){
      var _rpTurn=parseInt(_rpTm[2],10),_rpHits=0;_rpWhat=_rpTm[1].trim();
      for(_bi=_tr.length-1;_bi>=0;_bi--){
        if(_tr[_bi].t<_rpTurn)break;
        if(_tr[_bi].r==="gm"&&_tr[_bi].t===_rpTurn){(function(ix){if(typeof mutateTranscriptEntry==="function")mutateTranscriptEntry(_tr,ix,function(pe){pe.rc=1;});else _tr[ix].rc=1;})(_bi);_rpHits++;}
      }
      if(!_rpHits&&typeof console!=="undefined")console.warn("[retcon] turn-addressed [RETCON:…|"+_rpTurn+"] names a turn with no GM entry (range 1.."+worldState.turn+") — only the correcting response was de-indexed; NO adjacency fallback");
    }else{
      for(_bi=_tr.length-1;_bi>=0;_bi--){if(_tr[_bi].r==="gm"){if(typeof mutateTranscriptEntry==="function")mutateTranscriptEntry(_tr,_bi,function(pe){pe.rc=1;});else _tr[_bi].rc=1;break;}}/* #177: routed through the seam — the rc-mark was memo-safe only by ADJACENCY to this call's own append (length changes → miss); the accessor makes it safe by construction */
    }
    /* #147: the de-index above removes the false scene from retrieval — correct, but it leaves
       the corrected truth riding only the rolling session tail + one unverified extraction.
       Pin it: the tag's what-half injects as CORRECTION IN FORCE (buildRetconPinBlock, api.js)
       until a summarize files it or the RETCON_PIN_SHELF expires — every exit archives to
       memory.archive.retconPins. Single slot: a newer retcon rotates the prior into the archive. */
    if(_rpWhat){if(worldState.retconPin&&typeof memArchive==="function")memArchive().retconPins.push(worldState.retconPin);worldState.retconPin={what:_rpWhat,turn:worldState.turn};}}
  worldState.transcript.push(_e);}
/* #177: THE sanctioned mutator for an EXISTING transcript entry. The compression memo keys on
   (array ref, length, last-entry ref, last-entry .x), so an in-place field edit on an OLD entry
   is invisible to it — every such write routes HERE so invalidation is owned by this seam, not
   by call-site discipline (entry-4 ★: the failure class is a stale compressed blob silently
   persisting AND syncing — compressWorldStateSnapshot serves both exits). `tr` is the entry's
   OWNING array, passed by the caller who captured the entry — never assumed from the global
   (a campaign switch between capture and mutation would invalidate the wrong memo).
   ONE documented exception bypasses this seam: ragRetrieve's lazy .e backfill (memory.js) —
   idempotent, and a memoized blob missing backfilled .e is ACCEPTED by the audit ruling. */
function mutateTranscriptEntry(tr,i,fn){
  if(!tr||!tr.length||i<0||i>=tr.length||typeof fn!=="function")return false;
  fn(tr[i]);
  if(typeof serializeWorldState!=="undefined"&&serializeWorldState.invalidateTranscriptMemo)serializeWorldState.invalidateTranscriptMemo(tr,i);/* #272 D2: the index makes the invalidation segment-precise */
  return true;
}
// #9: stamp the speaker map onto a GM entry AFTER logTranscript wrote it. Additive field,
// exactly like .e/.m/.v above. The invalidate is LOAD-BEARING, not housekeeping: without it the
// next saveCore re-serves the stale compressed blob and every speaker map is silently lost at
// the localStorage boundary (engine-tested). #177: `tr` = the entry's OWNING array, captured
// with the entry — the old form invalidated whatever the GLOBAL pointed at during the stamp,
// which desyncs under any capture-to-stamp gap (the derive is synchronous today; structural
// beats latent). Falls back to the global for legacy callers, loudly when the entry isn't in it.
function stampTranscriptSpeakers(entry,sp,tr){
  tr=tr||(typeof worldState!=="undefined"&&worldState?worldState.transcript:null);
  if(!entry||!sp||!tr||!tr.length)return false;
  var i=tr.indexOf(entry);
  if(i<0){
    if(typeof console!=="undefined")console.warn("[transcript] speaker stamp: entry is not in the given array — stamping in place; memo for that array invalidated defensively");
    entry.sp=sp;
    if(typeof serializeWorldState!=="undefined"&&serializeWorldState.invalidateTranscriptMemo)serializeWorldState.invalidateTranscriptMemo(tr);
    return true;
  }
  return mutateTranscriptEntry(tr,i,function(e){e.sp=sp;});
}
// Schema migrations for worldState — fills fields added by later versions. Runs on every
// load AND on save import (importSave previously skipped these — audit #15). Operates on
// the global worldState; returns true if anything was modified.
/* #100 (v1.473): the Berserker CLASS was renamed Primal (the class spans rage/beast/weather;
   "Berserker" survives as its rage archetype). Display nms tightened: Totem Warrior→Totemborn,
   Storm Herald→Stormcaller; Trickery Domain→Subjugation Domain (#72, 2026-07-31).
   ARCHETYPE IDS RENAME WITH THEIR NMS (law changed v1.506, user decree — "I don't like the
   archetype id and name not matching. Let's fix that everywhere."): the id must be a word of
   its display nm (engine-test-pinned), so a display rename now renames the id too, and
   ARCHETYPE_ID_RENAMES below is what keeps old saves from orphaning — character.archetype
   carries the id, and every load/import funnel heals it here. This is THE rename function:
   migrateWorldState (saves / .tnd imports / server pulls) applies it to the player + every
   companion sheet; showCharImportPreview (the .char file + library import funnel) and
   checkLegacyCharacter (the legacy-pool draw) call it directly. Returns true if anything moved. */
var CLASS_RENAMES={"Berserker":"Primal"};
var ARCHETYPE_NM_RENAMES={"Totem Warrior":"Totemborn","Storm Herald":"Stormcaller","Trickery Domain":"Subjugation Domain","Shadow Weaver":"Entropist"};
var ARCHETYPE_ID_RENAMES={"totem":"totemborn","frenzy":"berserker","stormherald":"stormcaller","trickery":"subjugation","shadowweaver":"entropist"};
/* #101 (v1.479, generalizing the v1.478 Fire Bolt point-fix): spell display labels used to embed
   mechanics in a parenthetical — "Fire Bolt (d10 fire, 120ft)" — a second copy of dice/range that
   could drift from the capability_bible canon (the only thing the GM's canon block ever reads;
   capBaseName strips the parenthetical on lookup, so an un-migrated save always PLAYED right —
   it just displayed wrong). Now: any stored label whose base name RESOLVES in the bible strips to
   the bare name, and every display derives from the bible at render time. A label that does NOT
   resolve keeps its parenthetical untouched — for a GM-granted custom spell that text is the only
   mechanics anywhere, and destroying it would be silent data loss. */
function migrateSpellDisplayNames(c){
  if(!c||!c.spells)return false;var hit=false,i;
  for(i=0;i<c.spells.length;i++){
    var sp=c.spells[i];if(!sp||!sp.nm)continue;
    var idx=sp.nm.indexOf("(");if(idx<1)continue;
    if(typeof capabilityLookup==="function"&&capabilityLookup(sp.nm)){
      var bare=sp.nm.slice(0,idx).trim();
      if(bare&&bare!==sp.nm){sp.nm=bare;hit=true;}
    }
  }
  if(hit)console.info("[migrate] #101: spell labels stripped to bible bare names on "+(c.name||"character"));
  return hit;
}
function migrateCharClassNames(c){
  if(!c)return false;var hit=false;
  if(CLASS_RENAMES[c.cls]){console.info("[migrate] #100 class rename: "+(c.name||"character")+" "+c.cls+" → "+CLASS_RENAMES[c.cls]);c.cls=CLASS_RENAMES[c.cls];hit=true;}
  if(c.archetypeNm&&ARCHETYPE_NM_RENAMES[c.archetypeNm]){c.archetypeNm=ARCHETYPE_NM_RENAMES[c.archetypeNm];hit=true;}
  if(c.archetype&&ARCHETYPE_ID_RENAMES[c.archetype]){console.info("[migrate] archetype id "+(c.name||"character")+" "+c.archetype+" → "+ARCHETYPE_ID_RENAMES[c.archetype]+" (id↔nm alignment, v1.506)");c.archetype=ARCHETYPE_ID_RENAMES[c.archetype];hit=true;}
  return hit;
}
function migrateWorldState(){
  if(!worldState||!worldState.character)return false;
  var c=worldState.character,_mig=false;
  /* #100: class rename + spell-label re-sync — player and every NPC sheet (companions AND former
     companions keep working). Both are display-half heals; the injected canon was never wrong. */
  if(migrateCharClassNames(c))_mig=true;
  if(migrateSpellDisplayNames(c))_mig=true;
  if(worldState.npcs){var _cri,_crs;for(_cri=0;_cri<worldState.npcs.length;_cri++){_crs=worldState.npcs[_cri]&&worldState.npcs[_cri].charSheet;if(!_crs)continue;if(migrateCharClassNames(_crs))_mig=true;if(migrateSpellDisplayNames(_crs))_mig=true;}}
  /* #139: alignment axes must AGREE with the displayed label. Creation used to seed 0,0 under a
     non-neutral label, and model-generated companion sheets carry labels with NO axes at all —
     either way the first [ALIGNMENT:] shift recomputed the label from coordinates that never
     produced it (the True-Neutral snap). Reseed ONLY when the axes' own label disagrees with the
     displayed one — a consistent state (Ammut's earned law −3) and an earned return to True
     Neutral both pass through untouched. */
  function _alignHeal(sheet,who){
    if(!sheet)return;
    var lbl=sheet.actualAlignment||sheet.statedAlignment;
    if(!lbl||typeof alignSeedAxes!=="function"||typeof alignLabel!=="function")return;
    var curLaw=(typeof sheet.alignLaw==="number"&&!isNaN(sheet.alignLaw))?sheet.alignLaw:0;
    var curGood=(typeof sheet.alignGood==="number"&&!isNaN(sheet.alignGood))?sheet.alignGood:0;
    if(alignLabel(curLaw,curGood)===lbl){if(sheet.alignLaw!==curLaw||sheet.alignGood!==curGood){sheet.alignLaw=curLaw;sheet.alignGood=curGood;_mig=true;}return;}
    var seed=alignSeedAxes(lbl);
    /* off-grid labels ("Neutral") can never equal alignLabel output — if the seed IS the current
       coordinates, this is as healed as it gets; bail or we reseed-and-log on every load */
    if(seed.law===curLaw&&seed.good===curGood){if(sheet.alignLaw!==curLaw||sheet.alignGood!==curGood){sheet.alignLaw=curLaw;sheet.alignGood=curGood;_mig=true;}return;}
    sheet.alignLaw=seed.law;sheet.alignGood=seed.good;_mig=true;
    console.info("[migrate] #139 alignment axes seeded from label for "+who+": '"+lbl+"' → law "+seed.law+", good "+seed.good);
  }
  _alignHeal(c,c.name||"player");
  if(worldState.npcs){for(var _ali=0;_ali<worldState.npcs.length;_ali++){var _aln=worldState.npcs[_ali];if(_aln&&_aln.charSheet)_alignHeal(_aln.charSheet,_aln.name);}}
  if(typeof c.level!=="number"||isNaN(c.level)){c.level=1;_mig=true;}if(typeof c.xp!=="number"||isNaN(c.xp)){c.xp=0;_mig=true;}
  if(typeof c.maxHp!=="number"||isNaN(c.maxHp)){c.maxHp=(typeof c.hp==="number"&&!isNaN(c.hp)&&c.hp>0)?c.hp:8;_mig=true;}// heal maxHp FIRST (audit E71) — else a NaN maxHp drives hp to NaN on the next [HP:] tag, every load
  if(typeof c.hp!=="number"||isNaN(c.hp)){c.hp=c.maxHp||8;_mig=true;}if(typeof c.gold!=="number"||isNaN(c.gold)){c.gold=0;_mig=true;}
  if(!c.abilities){c.abilities=[];_mig=true;}if(!c.spells){c.spells=[];_mig=true;}
  for(var si=0;si<c.spells.length;si++){if(c.spells[si].lvl===0&&c.spells[si].used){c.spells[si].used=false;_mig=true;}}// cantrips never expend
  if(!worldState.npcs){worldState.npcs=[];_mig=true;}if(!worldState.questLog){worldState.questLog=[];_mig=true;}if(!worldState.eventHistory){worldState.eventHistory=[];_mig=true;}if(worldState.world&&!('sublocation' in worldState.world)){worldState.world.sublocation=null;_mig=true;}if(!worldState.campName){worldState.campName=worldState.character.name;_mig=true;}if(!worldState.character.portraitOffset){worldState.character.portraitOffset={x:50,y:50};_mig=true;}if(!worldState.campId){var _aid=getActiveCampId();if(_aid){worldState.campId=_aid;_mig=true;}}if(!worldState.legacyCharsUsed){worldState.legacyCharsUsed=[];_mig=true;}if(!worldState.transcript){worldState.transcript=[];_mig=true;}if(!worldState.renders){worldState.renders=[];_mig=true;}/* #30: saved-render POINTERS ({f,t,k}) — never image bytes; capped at RENDER_PTR_CAP */if(worldState.actStartTurn===undefined){worldState.actStartTurn=0;_mig=true;}if(worldState.pendingLegacy===undefined){worldState.pendingLegacy=null;_mig=true;}if(worldState.questLog){var _ql;for(_ql=0;_ql<worldState.questLog.length;_ql++){if(!worldState.questLog[_ql].objectives){worldState.questLog[_ql].objectives=[];_mig=true;}if(worldState.questLog[_ql].desc===undefined){worldState.questLog[_ql].desc="";_mig=true;}}}
  if(!worldState.usage){worldState.usage=blankUsage();_mig=true;}
  if(!worldState.sceneRefs&&typeof sceneRefsEnsure==="function"){sceneRefsEnsure();_mig=true;}/* #168: loaded campaigns enter referential protection before their first GM response */
  // v1.349 (user call 2026-07-17, after closing #55): episodic memory (RAG) is standard behavior —
  // the toggle UI is gone, so a legacy explicit-OFF would be permanent and invisible. Clear it.
  // ragEnabled()'s default-ON semantics are untouched; `worldState.ragMemory=false` from the console
  // remains a diagnosis-only escape hatch (cleared again on next load by this line).
  if(worldState.ragMemory===false){delete worldState.ragMemory;console.info("[migrate] legacy episodic-memory OFF flag cleared — RAG is standard behavior (v1.349)");_mig=true;}
  /* #63 (v1.304): core memories moved OFF worldState onto the character schema — witnessed-by-all
     (see fileCoreMemory, game.js). The legacy party-shared list is copied to the player and every
     party member's sheet (v1 was shared, so that's the faithful reading), stamped with this
     campaign's name (an import into a FUTURE campaign renders them attributed, not as bogus turn
     numbers), then DELETED — single source; dual-homing is the portrait-lesson drift class.
     Idempotent: the worldState field is gone after the first run. */
  if(!c.coreMemories){c.coreMemories=[];_mig=true;}
  if(worldState.coreMemories){
    var _cmLegacy=worldState.coreMemories,_cmi;
    var _cmCopy=function(owner){if(!owner)return;if(!owner.coreMemories)owner.coreMemories=[];
      var a,b;for(a=0;a<_cmLegacy.length;a++){var _cmM=_cmLegacy[a],_cmDup=false;
        for(b=0;b<owner.coreMemories.length;b++){if(owner.coreMemories[b].turn===_cmM.turn&&owner.coreMemories[b].text===_cmM.text){_cmDup=true;break;}}
        if(!_cmDup)owner.coreMemories.push({text:_cmM.text,turn:_cmM.turn,kind:_cmM.kind,who:_cmM.who,camp:_cmM.camp||worldState.campName||""});}};
    _cmCopy(c);
    var _cmParty=partyCompanionsWithSheets(true);/* dead-check divergence preserved — legacy shared moments copy to dead companions' sheets too (they witnessed them); AUDIT_FABLE_07_16 #6 */
    for(_cmi=0;_cmi<_cmParty.length;_cmi++)_cmCopy(_cmParty[_cmi].charSheet);
    delete worldState.coreMemories;_mig=true;
  }
  /* #23 (v1.296) per-arc pacing clock: backfill startTurn for arcs already active in an existing save.
     Stamp at the CURRENT turn (not a guessed origin) — the true start of a long-running arc is unknowable
     and any earlier guess would false-fire the nudge on a legitimately-young later arc. So existing saves
     start their arc clock at load: the nudge kicks in ARC_TURN_BUDGET turns on. The per-act nudge (already
     firing on any over-budget act) covers the interim. New/transitioned arcs get an accurate stamp. */
  if(worldState.skeleton&&worldState.skeleton.acts){var _sa,_sr;for(_sa=0;_sa<worldState.skeleton.acts.length;_sa++){var _arcs=worldState.skeleton.acts[_sa].arcs||[];for(_sr=0;_sr<_arcs.length;_sr++){if(_arcs[_sr].status==="active"&&_arcs[_sr].startTurn===undefined){_arcs[_sr].startTurn=worldState.turn;_mig=true;}}}}
  if(!c.aliases){c.aliases=[];_mig=true;}/* #47 epithets — schema field so titles survive PC↔NPC swaps */
  /* #73 campaign clock: the elapsed-time counter + scheduler. min=0 = campaign start. Additive —
     an old save simply starts its clock at load (min 0, labelled Day 1 since the v1.498 1-based
     relabel), and buildClockBlock renders nothing until
     time is advanced or something is scheduled, so the prompt stays byte-clean for untouched saves. */
  /* #274 (Fable f63): ABSENT is not CORRUPT. A save with no clock mints one silently as before;
     a clock that is PRESENT but whose scalar is unreadable goes through clockRescueCorrupt —
     preserved, shouted, and rebuilt carrying whatever schedule/repairs survived. Wiping the
     receipts also disarmed #146's own double-fire protection, so the silent reset was the worse
     failure of the two. typeof-guarded because clock.js loads after state.js; if it is somehow
     absent the reset still shouts rather than going quiet again. */
  if(!worldState.clock){worldState.clock={min:0,schedule:[]};_mig=true;}
  else if(typeof worldState.clock.min!=="number"||isNaN(worldState.clock.min)){
    if(typeof clockRescueCorrupt==="function")worldState.clock=clockRescueCorrupt(worldState.clock);
    else{if(typeof console!=="undefined")console.error("[clock] clockRescueCorrupt unavailable — a corrupt campaign clock was reset WITHOUT preserving its deadlines or #146 receipts (#274)");worldState.clock={min:0,schedule:[]};}
    _mig=true;
  }
  if(!worldState.clock.schedule){worldState.clock.schedule=[];_mig=true;}
  /* #146: timeline invariant diagnostics — WARN on every load while an impossible chronology
     stands (schedule born after now / due before born — the double-repair class the t1549 save
     carried). NEVER auto-heal: the scalar and the anchors are adjudication evidence; the ONE
     sanctioned fix is an idempotent clockRepair() transaction. typeof-guarded because clock.js
     loads after state.js, but migrate runs at init — long after every script is in. */
  if(typeof clockTimelineAnomalies==="function"){var _caL=clockTimelineAnomalies(worldState.clock),_caI;for(_caI=0;_caI<_caL.length;_caI++){console.warn("[clock] TIMELINE ANOMALY (#146, not auto-healed): "+_caL[_caI]+" — repair/migration defect; adjudicate from the transcript ck stamps, then apply ONE clockRepair()");}if(_caL.length&&typeof showToast==="function")showToast("⏱ Campaign-clock anomaly detected — see console (#146)");}
  /* #217: collapse near-duplicate schedule entries a pre-fold save carries (rows only, pre-images
     archived — the #146 rule protects the scalar/anchors and this touches neither). */
  if(typeof scheduleDedupSweep==="function"&&scheduleDedupSweep()>0)_mig=true;
  // UA26 multi-foe combat (v1.264): wrap a flat legacy in-flight combat object into the foes[]
  // shape. Idempotent — .foes presence short-circuits, so a re-run can never double-wrap.
  if(worldState.combat&&!worldState.combat.foes){var _oc=worldState.combat;worldState.combat={round:_oc.round||1,engaged:null,foes:[_oc]};_mig=true;}
  // Known issue #3 dedupe: companion portraits were stored 2× (npc.portrait + charSheet.portrait,
  // ~22-52KB each). charSheet.portrait is now the single home for any NPC with a sheet — move a
  // lone npc.portrait in, then drop the duplicate. Display reads go through npcPortrait() (helpers).
  var _pn;for(_pn=0;_pn<worldState.npcs.length;_pn++){var _pnp=worldState.npcs[_pn];
    if(_pnp&&_pnp.charSheet&&!_pnp.charSheet.aliases){_pnp.charSheet.aliases=[];_mig=true;}/* #47 — sheets stay sympatico across swaps */
    if(_pnp&&_pnp.charSheet&&!_pnp.charSheet.coreMemories){_pnp.charSheet.coreMemories=[];_mig=true;}/* #63 — same sympatico rule */
    if(_pnp&&_pnp.charSheet&&_pnp.portrait){
      if(!_pnp.charSheet.portrait)_pnp.charSheet.portrait=_pnp.portrait;
      _pnp.portrait=null;_mig=true;
    }}
  // XP floor invariant: xp must be ≥ the current level's threshold. Player creation enforces
  // this (char-creation floors starting XP) but companion sheets never did — an imported Lv7
  // sheet with xp below XP_LEVELS[6] rendered a negative→full XP bar (the Morwen lie) and
  // implied more progress than existed. Floor, don't relevel: the character KEEPS the level
  // they've been played at; progress toward the next one restarts from the floor.
  function _xpFloor(ch){if(!ch||typeof ch.level!=="number")return;var fl=classXpLevels()[ch.level-1]||0;if(typeof ch.xp!=="number"||ch.xp<fl){ch.xp=fl;_mig=true;}}/* C6 ② */
  _xpFloor(worldState.character);
  for(_pn=0;_pn<worldState.npcs.length;_pn++){if(worldState.npcs[_pn]&&worldState.npcs[_pn].charSheet)_xpFloor(worldState.npcs[_pn].charSheet);}
  // P6 retro-clamp: pre-v1.211 saves carry sentence-length NPC statuses that ride the roster every
  // turn until the GM next re-emits the tag. clampNpcMood lives in memory.js (loaded after state.js
  // but present by the time this runs on load); guard for the edge where it isn't.
  if(typeof clampNpcMood==="function"){for(_pn=0;_pn<worldState.npcs.length;_pn++){var _cn=worldState.npcs[_pn];if(_cn&&_cn.status){var _cs=clampNpcMood(_cn.status);if(_cs!==_cn.status){_cn.status=_cs;_mig=true;}}}}
  // #50(d) heal: fold byte-identical duplicate inventory entries into proper " xN" stacks. Only
  // pre-v1.291 sheet generation could mint them (model arrays copied verbatim — the Frizwick t455
  // adjacent-pairs shape); play-time writes always stacked. foldDuplicateInventory lives in api.js
  // (loaded after state.js but present by the time this runs on load) — same guard as clampNpcMood.
  if(typeof foldDuplicateInventory==="function"){
    var _fdp=c.inventory?foldDuplicateInventory(c.inventory):0;
    if(_fdp){_mig=true;if(typeof console!=="undefined")console.warn("[migrate] #50d: folded "+_fdp+" duplicate inventory entr"+(_fdp===1?"y":"ies")+" on "+(c.name||"the player"));}
    for(_pn=0;_pn<worldState.npcs.length;_pn++){var _fdn=worldState.npcs[_pn];
      if(_fdn&&_fdn.charSheet&&_fdn.charSheet.inventory){
        var _fdc=foldDuplicateInventory(_fdn.charSheet.inventory);
        if(_fdc){_mig=true;if(typeof console!=="undefined")console.warn("[migrate] #50d: folded "+_fdc+" duplicate inventory entr"+(_fdc===1?"y":"ies")+" on "+_fdn.name);}
      }}
  }
  // B3 (v1.361): NPC death became a first-class flag — stamp it from legacy death statuses so old
  // saves' dead NPCs join the DECEASED canon (they were roster-hidden by a status regex before).
  // dead=true means "died before the flag existed" (turn unknown). Statuses the new detection
  // EXCLUDES ("half-dead, bleeding out", "wants you dead") deliberately REGAIN the living roster —
  // the old regex was wrongly hiding living NPCs. Memory-side mirror lives in healMemory()
  // (memory parses AFTER this runs in loadState).
  if(worldState.npcs&&typeof npcDeadStatus==="function"){var _bdi;for(_bdi=0;_bdi<worldState.npcs.length;_bdi++){var _bdn=worldState.npcs[_bdi];
    if(_bdn&&!_bdn.dead&&npcDeadStatus(_bdn.status)){_bdn.dead=true;_mig=true;if(typeof console!=="undefined")console.warn("[migrate] B3: legacy dead status on "+_bdn.name+" — DECEASED flag stamped");}}}
  // v1.379 (mood/relation separation): repair MOOD fields that accumulated RELATION vocabulary
  // while the format forced a value into every slot. Runs AFTER the B3 death scan on purpose —
  // npcDeadStatus must see the original string, since a death word could sit beside a relation
  // word ("slain, enemy") and stripping first would not change that outcome but ordering it this
  // way keeps the death detection reading exactly what the GM wrote. Repairs to EMPTY are the
  // intended result for a character whose whole "mood" was a relation word; empty is legal now
  // (render guards skip it) and the mood audit refills party members.
  if(worldState.npcs&&typeof stripRelWordsFromMood==="function"){var _mri;for(_mri=0;_mri<worldState.npcs.length;_mri++){var _mrn=worldState.npcs[_mri];
    if(!_mrn||!_mrn.status)continue;
    var _mrClean=stripRelWordsFromMood(_mrn.status);
    if(_mrClean!==_mrn.status){if(typeof console!=="undefined")console.warn("[migrate] mood/relation: "+_mrn.name+" mood \""+_mrn.status+"\" → "+(_mrClean?"\""+_mrClean+"\"":"(empty — the whole field was a relation word)"));_mrn.status=_mrClean;_mig=true;}}}
  // v1.381: backfill the mood-age stamp. Set at the CURRENT turn, not 0 — a long-standing mood's
  // true origin is unknowable, and the #23 arc-clock precedent chose the same tradeoff ("fails
  // late, not early"): a stale mood waits one audit window rather than every party member being
  // flagged at once on the upgrade turn. Characters repaired to an EMPTY mood are unaffected by
  // this choice — the audit treats empty as due immediately, so they refresh in the first window.
  if(worldState.npcs){var _msi;for(_msi=0;_msi<worldState.npcs.length;_msi++){var _msn=worldState.npcs[_msi];
    if(_msn&&_msn.statusTurn===undefined){_msn.statusTurn=_msn.status?(worldState.turn||0):0;_mig=true;}}}
  /* #194: the presence epoch — the WHOLE migration is one scalar. NOTE the contrast with the
     v1.381 backfill above: that stamp FABRICATED a per-record turn (12 of 49 NPCs collide at
     t867 on the live save); presence records nothing per-record — it records where the old
     world ended. Evidence grade is DERIVED from turn-vs-epoch at read time (identity.js), so
     zero records are rewritten, the migration is idempotent and fold-safe, and flipping legacy
     fail-open (ruling ③, TENTATIVE) to fail-closed later is a one-clause change at the gate. */
  if(typeof worldState.presenceEpoch!=="number"){
    worldState.presenceEpoch=(typeof worldState.turn==="number")?worldState.turn:0;
    worldState.presenceVer=1;_mig=true;
    if(typeof console!=="undefined")console.info("[presence] #194 epoch set at t"+worldState.presenceEpoch+" — every earlier statusTurn/lastSeen/guestbook stamp is legacy-grade (fail-open, receipt-stamped, monotonically shrinking)");
  }else if(worldState.presenceVer===undefined&&(worldState.turn||0)>worldState.presenceEpoch){
    /* Old-client tripwire: a blob that lost its version marker while play advanced may carry
       mention-grade stamps at turns > epoch, which turn-derived grading would mis-label
       witnessed. Advancing the epoch re-labels that whole stretch legacy — the conservative
       (fail-open) direction. This re-labels; it cannot repair. Honest limit. */
    if(typeof console!=="undefined")console.warn("[presence] #194 epoch advanced t"+worldState.presenceEpoch+" → t"+worldState.turn+" — presenceVer was missing with play beyond the epoch (old-client writes presumed; the stretch is re-graded legacy)");
    worldState.presenceEpoch=worldState.turn;worldState.presenceVer=1;_mig=true;
  }
  if(typeof worldState.presenceEpoch==="number"&&(worldState.turn||0)<worldState.presenceEpoch&&typeof console!=="undefined")
    console.warn("[presence] #194 worldState.turn ("+worldState.turn+") is BEHIND the presence epoch ("+worldState.presenceEpoch+") — a rolled-back or hand-edited turn counter silently promotes legacy records to witnessed grade; verify this save");
  /* #168 W7: descriptor → {bond,dynamic} is a lossless schema migration owned by the one
     relationship adapter. identity.js loads after this file but before loadState runs. */
  if(typeof relationshipMigrateWorld==="function"){
    var _relBefore=JSON.stringify([c.relationships,worldState.pendingLegacy&&worldState.pendingLegacy.relationships,worldState.npcs.map(function(n){return n&&n.charSheet?n.charSheet.relationships:null;})]);
    relationshipMigrateWorld();
    var _relAfter=JSON.stringify([c.relationships,worldState.pendingLegacy&&worldState.pendingLegacy.relationships,worldState.npcs.map(function(n){return n&&n.charSheet?n.charSheet.relationships:null;})]);
    if(_relBefore!==_relAfter)_mig=true;
  }
  return _mig;
}
/* JP0-4 (joint review 2026-08-27, Sol P0-02) — NO SILENT FAILURES at the recall-store boundary.
   loadState parses each side key in its OWN try/catch (E73: a corrupt memory/session key must
   never discard a good worldState — that isolation is right and is untouched here), but both
   catch arms were SILENT and destroyed the evidence: sessionLog became [], memory became
   blankMemory(), the player saw a healthy-looking campaign, and the very next save persisted the
   blank over whatever was recoverable. This mirrors the UA3 transcript rescue above: stash the
   original bytes under a bounded per-campaign key, shout on BOTH channels, THEN degrade so the
   campaign still loads.
   ONE slot per tier per campaign, and a newer corruption OVERWRITES — the opposite of UA3 on
   purpose: a rescued transcript is PREPENDED to whatever survived, so there the oldest blob holds
   the longest record, whereas these two stores are replaced wholesale, so the newest corrupt bytes
   are the most complete picture of what was lost.
   Deliberately NO recovery UI in this pass (that flow is Fable's design): rescue + loud degrade is
   the whole deliverable, and nothing in the app ever deletes these keys — a later recovery flow
   is the only thing that should. */
function rescueCorruptStore(tier,raw,err){
  var label=(tier==="sess")?"session log":(tier==="mem")?"long-term memory":tier;
  var rk=STORE_RESCUE_K+tier+"_"+((typeof getActiveCampId==="function"&&getActiveCampId())||"default");
  var kept=false;
  if(typeof raw==="string"&&raw.length){try{store.set(rk,raw);kept=store.get(rk)===raw;}catch(e2){kept=false;}}
  if(typeof console!=="undefined")console.error("[save] the "+label+" store could not be parsed — "+(kept?("the unreadable original is preserved under "+rk):"the unreadable original could NOT be preserved")+"; this campaign loads with an EMPTY "+label,err);
  if(typeof showToast==="function")showToast("⚠ Your "+label+" could not be read"+(kept?" — a backup of the unreadable data was kept.":" and could NOT be backed up.")+" The campaign is loading without it.");
  return kept;
}
function loadState(){
  var ws,sl,mm;try{ws=store.get(WSK);sl=store.get(SLK);mm=store.get(MEM_KEY);}catch(e){return false;}
  // Reset the per-campaign sync bookkeeping (audit E32) — loadState runs on init AND on every
  // campaign switch, so the ACK baseline / failure count don't carry across campaigns.
  if(typeof storageAdapter!=="undefined"&&storageAdapter.resetSyncState)storageAdapter.resetSyncState();
  // Parse each key in its OWN try/catch (audit E73): a corrupt memory/session key must NOT discard a
  // good worldState (the old single try returned false with worldState still assigned, so the wizard
  // then overwrote the intact campaign). SLK is parsed BEFORE the migrate/saveCore (audit E36) so a
  // migrate-save persists the loaded log, not the stale global.
  try{sessionLog=sl?JSON.parse(sl):[];}catch(e){rescueCorruptStore("sess",sl,e);sessionLog=[];}/* JP0-4: preserve + shout before degrading */
  try{if(ws){worldState=parseWorldState(ws);restoreTranscriptRescue();/* UA3: BEFORE any migrate-save — preserve the rescued transcript. */if(typeof _sumFails!=="undefined")_sumFails=worldState.summaryFailure&&typeof worldState.summaryFailure.count==="number"?worldState.summaryFailure.count:0;}}catch(e){worldState=null;return false;}
  try{if(mm){memory=JSON.parse(mm);healMemory();}else memory=blankMemory();}catch(e){rescueCorruptStore("mem",mm,e);memory=blankMemory();}/* JP0-4: covers a heal throw on VALID json too — the bytes are still the only copy */
  /* #168 W7: relationship entity migration needs THIS campaign's alias table. Parsing/healing
     memory first prevents the previously active campaign from re-keying the incoming save. */
  try{if(worldState&&migrateWorldState())saveCore();}catch(e){worldState=null;return false;}
  return !!ws&&!!worldState;
}
// Fill the shape defaults an older/foreign memory blob may be missing. Extracted from loadState so
// the server-adopt path can run the same heals (audit E14) — importSave already got migrateWorldState
// (audit #15), but the server reconcile adopted un-migrated, un-healed blobs. Operates on the global.
function healMemory(){
  if(!memory)memory=blankMemory();
  if(!memory.futureEvents)memory.futureEvents=[];
  if(memory.usedNames!==undefined)delete memory.usedNames;/* AUDIT_FABLE_07_16 #12: dead field — nothing ever read or wrote it (name uniqueness moved to nameIdx rotation); heal converges old saves to the canonical shape by removing it */
  if(!memory.map)memory.map={nodes:{},edges:[],lastArrivalFrom:null};
  if(!memory.map.edges)memory.map.edges=[];
  if(!memory.map.nodes)memory.map.nodes={};
  if(!memory.npcGraph)memory.npcGraph={edges:[],factions:{},factionEdges:[],npcFactions:{}};
  if(typeof memory.nameIdx!=="number")memory.nameIdx=0;
  if(!memory.npcGraph.factions)memory.npcGraph.factions={};
  if(!memory.npcGraph.factionEdges)memory.npcGraph.factionEdges=[];
  if(!memory.npcGraph.npcFactions)memory.npcGraph.npcFactions={};
  memory.archive=archiveHeal(memory.archive);/* JP0-5: was eleven hand-copied lines that had drifted five categories behind the registry (P12 pre-archive saves still heal here) */
  // #149: junk-note sweep — the live save carried a literal "none" stateNote on Sandpoint (a
  // no-op that occupies a capped slot and reads as canon). Idempotent; each drop logs.
  if(memory.map&&memory.map.nodes){var _jnk=Object.keys(memory.map.nodes),_jni;for(_jni=0;_jni<_jnk.length;_jni++){var _jnn=memory.map.nodes[_jnk[_jni]];if(_jnn&&Array.isArray(_jnn.stateNotes)&&_jnn.stateNotes.length){var _jnb=_jnn.stateNotes.length;_jnn.stateNotes=_jnn.stateNotes.filter(function(sn){return sn&&String(sn.n||"").trim()&&!/^none[.!]?$/i.test(String(sn.n).trim());});if(_jnn.stateNotes.length<_jnb)console.info("[map] #149: dropped "+(_jnb-_jnn.stateNotes.length)+" junk stateNote(s) on "+_jnk[_jni]);}}}
  // #173: guestbook shape heal + cap enforcement — imports, server blobs and old saves converge
  // to the canonical {turns:[...],resident:bool,agg?:{first,last,count}} record shape. Junk
  // records drop LOUDLY (a silent drop would be this feature failing its own defect class);
  // over-cap turn lists fold their overflow into the aggregate exactly like the write path.
  if(memory.map&&memory.map.nodes){var _gbk=Object.keys(memory.map.nodes),_gbi,_gbj;
    for(_gbi=0;_gbi<_gbk.length;_gbi++){var _gbn=memory.map.nodes[_gbk[_gbi]];
      if(!_gbn||!_gbn.guestbook||typeof _gbn.guestbook!=="object"){if(_gbn&&_gbn.guestbook!==undefined&&(typeof _gbn.guestbook!=="object"||_gbn.guestbook===null)){console.warn("[guestbook] heal: non-object guestbook on "+_gbk[_gbi]+" dropped");delete _gbn.guestbook;}continue;}
      var _gbNs=Object.keys(_gbn.guestbook);
      for(_gbj=0;_gbj<_gbNs.length;_gbj++){var _gbNm=_gbNs[_gbj],_gbR=_gbn.guestbook[_gbNm];
        if(!_gbR||typeof _gbR!=="object"){console.warn("[guestbook] heal: malformed record for '"+_gbNm+"' at "+_gbk[_gbi]+" dropped");delete _gbn.guestbook[_gbNm];continue;}
        var _gbT=[],_gbSeen={},_gbx;
        if(Array.isArray(_gbR.turns)){for(_gbx=0;_gbx<_gbR.turns.length;_gbx++){var _gbV=_gbR.turns[_gbx];if(typeof _gbV==="number"&&isFinite(_gbV)&&!_gbSeen[_gbV]){_gbSeen[_gbV]=1;_gbT.push(_gbV);}}}
        _gbT.sort(function(a,b){return a-b;});
        _gbR.turns=_gbT;_gbR.resident=!!_gbR.resident;
        /* #194: source-provenance heal — rec.by must be an object of turn→string where every
           turn is actually on record; anything else drops (a junk by-map would poison the
           gate's source checks). Bounded by GB_TURN_CAP via the same cap fold below. */
        if(_gbR.by!==undefined){
          if(!_gbR.by||typeof _gbR.by!=="object"||Array.isArray(_gbR.by)){console.warn("[guestbook] heal: junk source map for '"+_gbNm+"' at "+_gbk[_gbi]+" dropped");delete _gbR.by;}
          else{var _gbBk=Object.keys(_gbR.by),_gbbi;for(_gbbi=0;_gbbi<_gbBk.length;_gbbi++){var _gbBt=Number(_gbBk[_gbbi]);
            if(typeof _gbR.by[_gbBk[_gbbi]]!=="string"||!isFinite(_gbBt)||_gbT.indexOf(_gbBt)<0)delete _gbR.by[_gbBk[_gbbi]];}
            if(!Object.keys(_gbR.by).length)delete _gbR.by;}
        }
        if(_gbR.agg&&!(typeof _gbR.agg.first==="number"&&typeof _gbR.agg.last==="number"&&typeof _gbR.agg.count==="number"&&_gbR.agg.count>0)){console.warn("[guestbook] heal: malformed/degenerate aggregate for '"+_gbNm+"' at "+_gbk[_gbi]+" dropped (exact turns kept)");delete _gbR.agg;}
        if(typeof _gbCapFold==="function")_gbCapFold(_gbR);
        if(!_gbR.turns.length&&!_gbR.agg&&!_gbR.resident){console.warn("[guestbook] heal: empty record for '"+_gbNm+"' at "+_gbk[_gbi]+" dropped");delete _gbn.guestbook[_gbNm];}
      }
    }
  }
  // #144A: converge over-cap knowledge lists. Import/blueprint seeding could exceed the cap-12
  // (the live t1549 save carries Frizwick at 18), and the write-site shift sheds only 1/write —
  // an overfilled list stays overfilled forever, shedding one real-play fact per new fact.
  // Oldest overflow → archive (never destroyed), newest 12 stay. Idempotent: converged lists
  // are ≤12, so a second pass churns nothing.
  if(memory.npcs){var _ckk=Object.keys(memory.npcs),_cki;for(_cki=0;_cki<_ckk.length;_cki++){var _ckn=memory.npcs[_ckk[_cki]];if(_ckn&&Array.isArray(_ckn.knowledge)&&_ckn.knowledge.length>12){var _ckOver=_ckn.knowledge.length,_ckd=_ckn.knowledge.splice(0,_ckn.knowledge.length-12),_ckj;for(_ckj=0;_ckj<_ckd.length;_ckj++)memory.archive.npcKnowledge.push({npc:_ckk[_cki],fact:_ckd[_ckj],turn:(typeof worldState!=="undefined"&&worldState&&worldState.turn)||0});if(typeof console!=="undefined")console.info("[memory] #144A: "+_ckk[_cki]+" knowledge over cap ("+_ckOver+") — "+_ckd.length+" oldest archived, newest 12 kept");}}}
  // P6 retro-clamp: sentence-length attitudes from pre-v1.211 extractor runs (memoryNpcDetail injects them).
  if(typeof clampNpcMood==="function"&&memory.npcs){var _ank=Object.keys(memory.npcs),_ai2;for(_ai2=0;_ai2<_ank.length;_ai2++){var _an=memory.npcs[_ank[_ai2]];if(_an&&_an.attitude)_an.attitude=clampNpcMood(_an.attitude);}}
  // B3: mirror worldState DECEASED stamps onto memory.npcs — geography/TOC/detail/graph read the
  // memory-side flag. Runs here (not migrateWorldState) because loadState parses memory AFTER the
  // worldState migrate; idempotent, converges legacy saves in one load.
  if(memory.npcs&&typeof worldState!=="undefined"&&worldState&&worldState.npcs){var _hdi;for(_hdi=0;_hdi<worldState.npcs.length;_hdi++){var _hdn=worldState.npcs[_hdi];if(_hdn&&_hdn.dead&&memory.npcs[_hdn.name]&&!memory.npcs[_hdn.name].dead)memory.npcs[_hdn.name].dead=_hdn.dead;}}
  // v1.379: the memory-side twin of the mood repair above. `attitude` is spec'd as a mood but was
  // OVERWRITTEN with the relation by every [NPC:] tag until v1.379 (and seeded from it), so old
  // saves carry bare relation words there — "enemy" for every villain the party never re-met.
  // Same conservative typed strip; also clears the legacy "unknown" placeholder, which is not a
  // mood. Lands in healMemory because memory parses AFTER migrateWorldState in loadState.
  if(memory.npcs&&typeof stripRelWordsFromMood==="function"){var _mak=Object.keys(memory.npcs),_mai;
    for(_mai=0;_mai<_mak.length;_mai++){var _man=memory.npcs[_mak[_mai]];if(!_man||!_man.attitude)continue;
      var _maClean=(_man.attitude==="unknown")?"":stripRelWordsFromMood(_man.attitude);
      if(_maClean!==_man.attitude){if(typeof console!=="undefined")console.warn("[heal] mood/relation: "+_mak[_mai]+" attitude \""+_man.attitude+"\" → "+(_maClean?"\""+_maClean+"\"":"(empty — awaiting the next summarize)"));_man.attitude=_maClean;}}}
  // v1.383 — ONE-TIME clear on the attitude spec change. Until now the extractor was told to write
  // a "2-4 word mood" into `attitude`, but v1.382 began rendering that field as "toward you:" —
  // a DISPOSITION. Those are different measurements, so every stored value is mislabelled by the
  // new render: Morwen's "cataloguing, wary" described her nature (it echoes her sheet trait almost
  // verbatim), not her opinion of the player, and rendering it as "toward you" quietly turned a
  // character note into an accusation. The extractor spec is corrected in summarize(); these values
  // predate it. Cleared once so nothing lies while the next summarize refills them under the new
  // meaning. MUST stay marker-guarded — an unguarded clear would wipe correct values every load.
  if(memory.npcs&&memory.attitudeSpec!==2){
    var _asK=Object.keys(memory.npcs),_asI,_asN=0;
    for(_asI=0;_asI<_asK.length;_asI++){var _asE=memory.npcs[_asK[_asI]];if(_asE&&_asE.attitude){_asE.attitude="";_asN++;}}
    memory.attitudeSpec=2;
    if(_asN&&typeof console!=="undefined")console.warn("[heal] attitude spec v2 (disposition toward the player, was mood): cleared "+_asN+" value(s) written under the old spec — the next summarize refills them");
  }
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
// #15②/#54 lane B: THE builder for the per-campaign slot keys ("tnd_camp_<id>_ws|_sl|_mem").
// Was hand-concatenated ~23× across state/ui-campaigns/ui-browsers — one typo forks a campaign
// silently. state.js owns storage keys, so the builder lives here. part: "ws" | "sl" | "mem".
function campSlotKey(id,part){return "tnd_camp_"+id+"_"+part;}
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
  // B4: never let a quota throw escape — updateCampMeta runs OUTSIDE saveCore's try in saveAll,
  // so an uncaught throw here killed the storageAdapter.syncToServer() call that follows, i.e.
  // the server sync stopped being scheduled at exactly the moment the server copy was the only
  // safe one. The list itself self-heals from the server merge (syncCampaignList).
  try{setCampMeta(meta);}catch(e){console.error("[camps] campaign-list update failed — storage full? (list self-heals from the server merge):",e);}
}
function snapshotActiveCamp(){
  var id=getActiveCampId();if(!id)return true;
  var ws=store.get(WSK),sl=store.get(SLK),mem=store.get(MEM_KEY);
  // B4: a quota throw here used to abort the CALLER unhandled — killing the beforeunload server
  // flush below (exactly when the server copy is the only safe one) and leaving switch/new-game
  // half-done with no toast. Now: fail LOUDLY, still flush, and return false so destructive
  // callers (which wipe the live keys next) can abort instead of losing the un-snapshotted turns.
  // One try for all three writes — the first failure stops the rest (consistent-stale together).
  var ok=true;
  try{
    if(ws)store.set(campSlotKey(id,"ws"),ws);
    if(sl)store.set(campSlotKey(id,"sl"),sl);
    if(mem)store.set(campSlotKey(id,"mem"),mem);
  }catch(e){
    ok=false;
    console.error("[camps] snapshot failed — storage full:",e);
    if(typeof showToast==="function")showToast("⚠ Storage full — couldn't back up the current campaign. Free space: Campaigns → \"Remove local\" on old campaigns.");
  }
  updateCampMeta();
  // Flush the debounced server sync before leaving this campaign (audit E74): snapshotActiveCamp is
  // the "about to switch/wipe" signal, and switchToCampaign/campNew/newGame/import never flushed —
  // so the outgoing campaign's final turn(s) could sit unsent in the 1.5s debounce window.
  if(typeof storageAdapter!=="undefined"&&storageAdapter.syncNow)storageAdapter.syncNow();
  return ok;
}
function switchToCampaign(id){
  // B4: abort BEFORE touching the live keys if the outgoing snapshot couldn't be written (storage
  // full) — proceeding would overwrite the only local copy of the outgoing campaign's newest turns.
  if(!snapshotActiveCamp())return false;
  // Capture the live keys + active id so a failed load can roll back (audit E35). Without this,
  // when loadState() fails on a corrupt target slot, the active id and live keys are already
  // repointed while the worldState/memory globals still hold the OLD campaign — the next saveAll
  // then writes campaign A's state under campaign B's id, locally AND on the server.
  var prevWs=store.get(WSK),prevSl=store.get(SLK),prevMem=store.get(MEM_KEY),prevId=getActiveCampId();
  var ws=store.get(campSlotKey(id,"ws")),sl=store.get(campSlotKey(id,"sl")),mem=store.get(campSlotKey(id,"mem"));
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
  }else{
    // B4 de-dup: the slot copy just BECAME the live keys — the standing duplicate was ~590K of
    // dead weight on a quota-pinned save. The next switch-away/unload snapshot recreates it.
    // Only on success: the failed-load rollback must keep the target slots untouched (E35).
    store.del(campSlotKey(id,"ws"));store.del(campSlotKey(id,"sl"));store.del(campSlotKey(id,"mem"));
  }
  return ok;
}
// B4: drop the ACTIVE campaign's standing slot duplicate (~590K on a mature save). The live keys
// ARE the campaign while it's active; the slot copy is only ever read after a switch-away, and
// every switch path re-snapshots first (switchToCampaign/campNew/newGame/import). Runs at boot and
// after an active-campaign cloud pull. Guarded: never deletes when the live core is missing —
// then the slot IS the only copy.
function dedupeActiveCampSlots(){
  var id=getActiveCampId();if(!id||!store.get(WSK))return;
  store.del(campSlotKey(id,"ws"));store.del(campSlotKey(id,"sl"));store.del(campSlotKey(id,"mem"));
}
// B4: remove a campaign's local snapshot but KEEP its picker row (unlike deleteCampaign) — the
// row degrades to the existing cloud-only tier ("click Load to download"). The caller owns the
// safety gate (planRemoveLocalCopy + a freshly confirmed cloud copy); this is just the storage op.
function removeCampaignLocalCopy(id){
  store.del(campSlotKey(id,"ws"));store.del(campSlotKey(id,"sl"));store.del(campSlotKey(id,"mem"));
}
// B4: policy for the picker's "Remove local" flow — pure so the engine tests can pin every branch;
// ui-campaigns owns the dialogs and transport. cloudErr/cloudWs come from a FRESH server GET of
// this campaign (never the stale onServer flag — an offline-played local copy can be AHEAD of the
// cloud). localTurn = the local snapshot's turn, -1 when unreadable. Kinds:
//   "offer-add"    — no cloud copy (404, or a row whose blob the server can't read): push first,
//                    then remove; declining ABORTS (removal without a cloud copy = deletion).
//   "offer-remove" — cloud is at/ahead of this device: plain removal, cloud kept as-is.
//   "offer-update" — this device is AHEAD (or its turn is unreadable): push first, then remove;
//                    declining ABORTS — removing without the push would destroy the newest turns.
//   "no-server"    — the probe failed (offline/timeout/HTTP error): abort, keep the local copy.
function planRemoveLocalCopy(cloudErr,cloudWs,localTurn){
  if(cloudErr==="HTTP 404")return {kind:"offer-add"};
  if(cloudErr)return {kind:"no-server",err:cloudErr};
  if(!cloudWs)return {kind:"offer-add"};
  var ct=typeof cloudWs.turn==="number"?cloudWs.turn:0;
  var lt=typeof localTurn==="number"?localTurn:-1;
  if(lt>=0&&ct>=lt)return {kind:"offer-remove",cloudTurn:ct,localTurn:lt};
  return {kind:"offer-update",cloudTurn:ct,localTurn:lt};
}
function deleteCampaign(id){
  store.del(campSlotKey(id,"ws"));store.del(campSlotKey(id,"sl"));store.del(campSlotKey(id,"mem"));
  setCampMeta(getCampMeta().filter(function(c){return c.id!==id;}));
}
function migrateToCampaigns(){
  if(getActiveCampId())return;
  var id=newCampaignId();setActiveCampId(id);
  if(worldState)worldState.campId=id;
  snapshotActiveCamp();
}
