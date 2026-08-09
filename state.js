var WSK="tnd_core_v10";var SLK="tnd_sess_v10";var MEM_KEY="tnd_mem_v10";var AKK="tnd_ak_v1";var RLK="tnd_rules_v9";var ADK="tnd_adult_v1";var PROSE_K="tnd_prose_v1";var FAL_KEY_K="tnd_fal_k_v1";var RENDER_MDL_K="tnd_render_mdl_v1";var RENDER_STR_K="tnd_render_str_v1";var TRANSCRIPT_RESCUE_K="tnd_transcript_rescue_v1_";/* + campId (UA3) */var PROV_K="tnd_provider_v1";var PKEYS_K="tnd_provider_keys_v1";var PMDL_K="tnd_provider_models_v1";var UPGRADE_K="tnd_model_upgrade_v1";var PENDING_ACT_K="tnd_pending_act_v1";/* #14: the failed-turn action, campaign-stamped — its OWN key so the failure path never runs saveAll */
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
function blankMemory(){return {npcs:{},locations:{},quests:{},lore:[],keyDecisions:[],futureEvents:[],chapters:[],nameIdx:0,attitudeSpec:2,map:{nodes:{},edges:[],lastArrivalFrom:null},npcGraph:{edges:[],factions:{},factionEdges:[],npcFactions:{}},archive:{lore:[],decisions:[],chapters:[],coreMemories:[]}};}/* archive: P12 eviction compaction — storage-only, never injected. coreMemories: #40 over-cap evictions (UA14: archive's consumers are the story compiler #5 + future RAG phases, NOT Core Memory itself) */
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
}
// Transcript compression (Known issue #3, v1.227): the append-only transcript is the dominant,
// ever-growing part of a mature save (54% of a t308 blob). We store it LZ-compressed INSIDE the
// localStorage blob — worldState.transcript -> {__lz:"..."} — halving the on-disk core (626K->283K chars
// on t308). The in-memory state, .tnd exports, and the server sync all keep the plain array; only the
// localStorage boundary compresses. parseWorldState is TOLERANT: it inflates a compressed transcript OR
// passes a plain array straight through (server blob / .tnd import / legacy pre-v1.227 saves). Degrades
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
function serializeWorldState(ws){
  ws=(ws===undefined)?worldState:ws;
  return JSON.stringify(compressWorldStateSnapshot(ws));
}
serializeWorldState._compressions=0; // test/diagnostic hook: counts ACTUAL LZ passes (memo hits don't increment)
serializeWorldState.invalidateTranscriptMemo=function(tr){if(_trLzMemo&&tr)_trLzMemo["delete"](tr);};
// #92: the object-form inflater — the SAME tolerance parseWorldState has always applied to
// strings, exposed for consumers that receive an already-PARSED blob. The one that matters:
// the server reconcile ADOPT (storage-adapter), which consumed the pulled blob raw and would
// otherwise poison live state with a {__lz} transcript ({__lz}.push throws mid-turn). A plain
// array passes through untouched; inflate failure takes the UA3 rescue path below.
function inflateWorldStateSnapshot(o){
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
function saveCore(){try{store.set(WSK,serializeWorldState());store.set(SLK,JSON.stringify(sessionLog));}catch(e){if(typeof showToast==="function")showToast("⚠ Save failed — storage full. Free space: Campaigns → \"Remove local\" on old campaigns.");console.error("[save] saveCore failed:",e);}}
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
function logTranscript(role,text,raw,taMin){if(!worldState||!text)return;if(!worldState.transcript)worldState.transcript=[];var _e={t:worldState.turn,r:role,x:String(text).trim()};if(role==="gm"&&typeof ragEntitiesFromRaw==="function")_e.e=ragEntitiesFromRaw(raw||text);
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
  if(role==="gm"&&/\[RETCON:/i.test(String(raw||""))){_e.rc=1;var _tr=worldState.transcript,_bi;for(_bi=_tr.length-1;_bi>=0;_bi--){if(_tr[_bi].r==="gm"){_tr[_bi].rc=1;break;}}}
  worldState.transcript.push(_e);}
// #9: stamp the speaker map onto a GM entry AFTER the fact — the post-pass resolves 1-4s after
// logTranscript already wrote the entry. Additive field, exactly like .e/.m/.v above.
// The invalidate is LOAD-BEARING, not housekeeping: the transcript compression memo keys on
// (length, last-entry ref, last-entry .x), and adding a field changes none of them — so without it
// the next saveCore re-serves the stale compressed blob and every speaker map is silently lost at
// the localStorage boundary (engine-tested).
function stampTranscriptSpeakers(entry,sp){
  if(!entry||!sp||!worldState||!worldState.transcript)return false;
  entry.sp=sp;
  if(typeof serializeWorldState!=="undefined"&&serializeWorldState.invalidateTranscriptMemo)serializeWorldState.invalidateTranscriptMemo(worldState.transcript);
  return true;
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
  if(!worldState.clock||typeof worldState.clock.min!=="number"||isNaN(worldState.clock.min)){worldState.clock={min:0,schedule:[]};_mig=true;}
  if(!worldState.clock.schedule){worldState.clock.schedule=[];_mig=true;}
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
  if(memory.usedNames!==undefined)delete memory.usedNames;/* AUDIT_FABLE_07_16 #12: dead field — nothing ever read or wrote it (name uniqueness moved to nameIdx rotation); heal converges old saves to the canonical shape by removing it */
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
  if(!memory.archive.npcKnowledge)memory.archive.npcKnowledge=[];/* #144A */
  if(!memory.archive.npcEvents)memory.archive.npcEvents=[];/* #144A */
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
