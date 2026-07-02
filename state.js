var WSK="tnd_core_v10";var SLK="tnd_sess_v10";var MEM_KEY="tnd_mem_v10";var AKK="tnd_ak_v1";var RLK="tnd_rules_v9";var ADK="tnd_adult_v1";var PROSE_K="tnd_prose_v1";var FAL_KEY_K="tnd_fal_k_v1";var RENDER_MDL_K="tnd_render_mdl_v1";var PROV_K="tnd_provider_v1";var PKEYS_K="tnd_provider_keys_v1";var PMDL_K="tnd_provider_models_v1";var UPGRADE_K="tnd_model_upgrade_v1";
var _m={};
var store={
  get:function(k){try{return localStorage.getItem(k);}catch(e){return _m[k]||null;}},
  set:function(k,v){try{localStorage.setItem(k,v);}catch(e){_m[k]=v;}},
  del:function(k){try{localStorage.removeItem(k);}catch(e){delete _m[k];}}
};
var worldState=null;
var sessionLog=[];
// Single source of truth for the empty-memory shape (audit #22). Every reset path
// (new game, new campaign, import) must use this — the old inline literals drifted
// (most omitted map/npcGraph/nameIdx and leaned on lazy guards to self-heal).
function blankMemory(){return {npcs:{},locations:{},quests:{},lore:[],keyDecisions:[],futureEvents:[],chapters:[],usedNames:[],nameIdx:0,map:{nodes:{},edges:[],lastArrivalFrom:null},npcGraph:{edges:[],factions:{},factionEdges:[],npcFactions:{}}};}
var memory=blankMemory();
function saveCore(){try{store.set(WSK,JSON.stringify(worldState));store.set(SLK,JSON.stringify(sessionLog));}catch(e){if(typeof showToast==="function")showToast("⚠ Save failed — storage full. Export your save now.");console.error("[save] saveCore failed:",e);}}
function saveMem(){try{store.set(MEM_KEY,JSON.stringify(memory));}catch(e){if(typeof showToast==="function")showToast("⚠ Memory save failed — storage full.");console.error("[save] saveMem failed:",e);}}
// #2 (quota): snapshotActiveCamp() removed from saveAll — it duplicated the ENTIRE active state (incl. portraits)
// into tnd_camp_<id>_* on every turn, redundant with tnd_core_v10. The active campaign is still snapshotted on
// switch-away, beforeunload, and campaign ops — the moments the snapshot is actually read. ~halves the per-turn write.
function saveAll(){saveCore();saveMem();updateCampMeta();if(typeof storageAdapter!=="undefined")storageAdapter.syncToServer();}
// #12 — append-only campaign transcript: the verbatim prose record for the story compiler (#11) + cross-device
// completeness. Lives in worldState (rides in the sync blob). Written from the turn sources (sendAction/beginAdventure),
// NOT addMsg — addMsg re-fires when the last turns are re-rendered on reload, which would double-count.
function logTranscript(role,text){if(!worldState||!text)return;if(!worldState.transcript)worldState.transcript=[];worldState.transcript.push({t:worldState.turn,r:role,x:String(text).trim()});}
// Schema migrations for worldState — fills fields added by later versions. Runs on every
// load AND on save import (importSave previously skipped these — audit #15). Operates on
// the global worldState; returns true if anything was modified.
function migrateWorldState(){
  if(!worldState||!worldState.character)return false;
  var c=worldState.character,_mig=false;
  if(typeof c.level!=="number"||isNaN(c.level)){c.level=1;_mig=true;}if(typeof c.xp!=="number"||isNaN(c.xp)){c.xp=0;_mig=true;}
  if(typeof c.hp!=="number"||isNaN(c.hp)){c.hp=c.maxHp||8;_mig=true;}if(typeof c.gold!=="number"||isNaN(c.gold)){c.gold=0;_mig=true;}
  if(!c.abilities){c.abilities=[];_mig=true;}if(!c.spells){c.spells=[];_mig=true;}
  for(var si=0;si<c.spells.length;si++){if(c.spells[si].lvl===0&&c.spells[si].used){c.spells[si].used=false;_mig=true;}}// cantrips never expend
  if(!worldState.npcs){worldState.npcs=[];_mig=true;}if(!worldState.questLog){worldState.questLog=[];_mig=true;}if(!worldState.eventHistory){worldState.eventHistory=[];_mig=true;}if(worldState.world&&!('sublocation' in worldState.world)){worldState.world.sublocation=null;_mig=true;}if(!worldState.campName){worldState.campName=worldState.character.name;_mig=true;}if(!worldState.character.portraitOffset){worldState.character.portraitOffset={x:50,y:50};_mig=true;}if(!worldState.campId){var _aid=getActiveCampId();if(_aid){worldState.campId=_aid;_mig=true;}}if(!worldState.legacyCharsUsed){worldState.legacyCharsUsed=[];_mig=true;}if(!worldState.transcript){worldState.transcript=[];_mig=true;}if(worldState.pendingLegacy===undefined){worldState.pendingLegacy=null;_mig=true;}if(worldState.questLog){var _ql;for(_ql=0;_ql<worldState.questLog.length;_ql++){if(!worldState.questLog[_ql].objectives){worldState.questLog[_ql].objectives=[];_mig=true;}if(worldState.questLog[_ql].desc===undefined){worldState.questLog[_ql].desc="";_mig=true;}}}
  return _mig;
}
function loadState(){
  try{var ws=store.get(WSK),sl=store.get(SLK),mm=store.get(MEM_KEY);
    if(ws){worldState=JSON.parse(ws);if(migrateWorldState())saveCore();}
    if(sl)sessionLog=JSON.parse(sl);
    if(mm){memory=JSON.parse(mm);if(!memory.futureEvents)memory.futureEvents=[];if(!memory.usedNames)memory.usedNames=[];if(!memory.map)memory.map={nodes:{},edges:[],lastArrivalFrom:null};if(!memory.map.edges)memory.map.edges=[];if(!memory.map.nodes)memory.map.nodes={};if(!memory.npcGraph)memory.npcGraph={edges:[],factions:{},factionEdges:[],npcFactions:{}};
    if(typeof memory.nameIdx!=="number")memory.nameIdx=0;
    if(!memory.npcGraph.factions)memory.npcGraph.factions={};
    if(!memory.npcGraph.factionEdges)memory.npcGraph.factionEdges=[];
    if(!memory.npcGraph.npcFactions)memory.npcGraph.npcFactions={};}
    else memory=blankMemory();
    return !!ws;}catch(e){return false;}
}
// ── Campaign management ───────────────────────────────────────────────────────
var CAMP_META_K="tnd_camps_v1";var ACTIVE_CAMP_K="tnd_active_v1";var LEGACY_ON_K="tnd_legacy_on_v1";var LEGACY_PCT_K="tnd_legacy_pct_v1";
function getCampMeta(){try{var r=store.get(CAMP_META_K);return r?JSON.parse(r):[]}catch(e){return[];}}
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
}
function switchToCampaign(id){
  snapshotActiveCamp();
  var ws=store.get("tnd_camp_"+id+"_ws"),sl=store.get("tnd_camp_"+id+"_sl"),mem=store.get("tnd_camp_"+id+"_mem");
  if(ws)store.set(WSK,ws);else store.del(WSK);
  if(sl)store.set(SLK,sl);else store.del(SLK);
  if(mem)store.set(MEM_KEY,mem);else store.del(MEM_KEY);
  setActiveCampId(id);
  return loadState();
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
