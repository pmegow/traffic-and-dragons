var WSK="ashen_core_v10";var SLK="ashen_sess_v10";var MEM_KEY="ashen_mem_v10";var AKK="ashen_ak_v1";var RLK="ashen_rules_v9";var ADK="ashen_adult_v1";var FAL_KEY_K="ashen_fal_k_v1";var RENDER_MDL_K="ashen_render_mdl_v1";
var _m={};
var store={
  get:function(k){try{return localStorage.getItem(k);}catch(e){return _m[k]||null;}},
  set:function(k,v){try{localStorage.setItem(k,v);}catch(e){_m[k]=v;}},
  del:function(k){try{localStorage.removeItem(k);}catch(e){delete _m[k];}}
};
var worldState=null;
var sessionLog=[];
var memory={npcs:{},locations:{},quests:{},lore:[],keyDecisions:[],futureEvents:[],chapters:[],usedNames:[],map:{nodes:{},edges:[],lastArrivalFrom:null},npcGraph:{edges:[]}};
function saveCore(){try{store.set(WSK,JSON.stringify(worldState));store.set(SLK,JSON.stringify(sessionLog));}catch(e){if(typeof showToast==="function")showToast("⚠ Save failed — storage full. Export your save now.");console.error("[save] saveCore failed:",e);}}
function saveMem(){try{store.set(MEM_KEY,JSON.stringify(memory));}catch(e){if(typeof showToast==="function")showToast("⚠ Memory save failed — storage full.");console.error("[save] saveMem failed:",e);}}
function saveAll(){saveCore();saveMem();updateCampMeta();if(typeof storageAdapter!=="undefined")storageAdapter.syncToServer();}
function loadState(){
  try{var ws=store.get(WSK),sl=store.get(SLK),mm=store.get(MEM_KEY);
    if(ws){worldState=JSON.parse(ws);var c=worldState.character;
      if(typeof c.level!=="number"||isNaN(c.level))c.level=1;if(typeof c.xp!=="number"||isNaN(c.xp))c.xp=0;
      if(typeof c.hp!=="number"||isNaN(c.hp))c.hp=c.maxHp||8;if(typeof c.gold!=="number"||isNaN(c.gold))c.gold=0;
      if(!c.abilities)c.abilities=[];if(!c.spells)c.spells=[];
      for(var si=0;si<c.spells.length;si++){if(c.spells[si].lvl===0)c.spells[si].used=false;}// cantrips never expend
      var _m=false;if(!worldState.npcs){worldState.npcs=[];_m=true;}if(!worldState.questLog){worldState.questLog=[];_m=true;}if(!worldState.eventHistory){worldState.eventHistory=[];_m=true;}if(worldState.world&&!('sublocation' in worldState.world)){worldState.world.sublocation=null;_m=true;}if(!worldState.campName){worldState.campName=worldState.character.name;_m=true;}if(!worldState.character.portraitOffset){worldState.character.portraitOffset={x:50,y:50};_m=true;}if(_m)saveCore();}
    if(sl)sessionLog=JSON.parse(sl);
    if(mm){memory=JSON.parse(mm);if(!memory.futureEvents)memory.futureEvents=[];if(!memory.usedNames)memory.usedNames=[];if(!memory.map)memory.map={nodes:{},edges:[],lastArrivalFrom:null};if(!memory.map.edges)memory.map.edges=[];if(!memory.map.nodes)memory.map.nodes={};if(!memory.npcGraph)memory.npcGraph={edges:[],factions:{},factionEdges:[],npcFactions:{}};
    if(typeof memory.nameIdx!=="number")memory.nameIdx=0;
    if(!memory.npcGraph.factions)memory.npcGraph.factions={};
    if(!memory.npcGraph.factionEdges)memory.npcGraph.factionEdges=[];
    if(!memory.npcGraph.npcFactions)memory.npcGraph.npcFactions={};}
    else memory={npcs:{},locations:{},quests:{},lore:[],keyDecisions:[],futureEvents:[],chapters:[],usedNames:[],map:{nodes:{},edges:[],lastArrivalFrom:null},npcGraph:{edges:[],factions:{},factionEdges:[],npcFactions:{}}};
    return !!ws;}catch(e){return false;}
}
// ── Campaign management ───────────────────────────────────────────────────────
var CAMP_META_K="ashen_camps_v1";var ACTIVE_CAMP_K="ashen_active_v1";
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
  for(i=0;i<meta.length;i++){if(meta[i].id===id){meta[i]=entry;found=true;break;}}
  if(!found)meta.push(entry);
  setCampMeta(meta);
}
function snapshotActiveCamp(){
  var id=getActiveCampId();if(!id)return;
  var ws=store.get(WSK),sl=store.get(SLK),mem=store.get(MEM_KEY);
  if(ws)store.set("ashen_camp_"+id+"_ws",ws);
  if(sl)store.set("ashen_camp_"+id+"_sl",sl);
  if(mem)store.set("ashen_camp_"+id+"_mem",mem);
  updateCampMeta();
}
function switchToCampaign(id){
  snapshotActiveCamp();
  var ws=store.get("ashen_camp_"+id+"_ws"),sl=store.get("ashen_camp_"+id+"_sl"),mem=store.get("ashen_camp_"+id+"_mem");
  if(ws)store.set(WSK,ws);else store.del(WSK);
  if(sl)store.set(SLK,sl);else store.del(SLK);
  if(mem)store.set(MEM_KEY,mem);else store.del(MEM_KEY);
  setActiveCampId(id);
  return loadState();
}
function deleteCampaign(id){
  store.del("ashen_camp_"+id+"_ws");store.del("ashen_camp_"+id+"_sl");store.del("ashen_camp_"+id+"_mem");
  setCampMeta(getCampMeta().filter(function(c){return c.id!==id;}));
}
function migrateToCampaigns(){
  if(getActiveCampId())return;
  var id=newCampaignId();setActiveCampId(id);snapshotActiveCamp();
}
