var WSK="ashen_core_v9";var SLK="ashen_sess_v9";var MEM_KEY="ashen_mem_v9";var AKK="ashen_ak_v1";var RLK="ashen_rules_v9";var ADK="ashen_adult_v1";
var _m={};
var store={
  get:function(k){try{return localStorage.getItem(k);}catch(e){return _m[k]||null;}},
  set:function(k,v){try{localStorage.setItem(k,v);}catch(e){_m[k]=v;}},
  del:function(k){try{localStorage.removeItem(k);}catch(e){delete _m[k];}}
};
var worldState=null;
var sessionLog=[];
var memory={npcs:{},locations:{},quests:{},lore:[],keyDecisions:[],futureEvents:[],chapters:[],usedNames:[]};
function saveCore(){try{store.set(WSK,JSON.stringify(worldState));store.set(SLK,JSON.stringify(sessionLog));}catch(e){}}
function saveMem(){try{store.set(MEM_KEY,JSON.stringify(memory));}catch(e){}}
function saveAll(){saveCore();saveMem();if(typeof storageAdapter!=="undefined")storageAdapter.syncToServer();}
function loadState(){
  try{var ws=store.get(WSK),sl=store.get(SLK),mm=store.get(MEM_KEY);
    if(ws){worldState=JSON.parse(ws);var c=worldState.character;
      if(typeof c.level!=="number"||isNaN(c.level))c.level=1;if(typeof c.xp!=="number"||isNaN(c.xp))c.xp=0;
      if(typeof c.hp!=="number"||isNaN(c.hp))c.hp=c.maxHp||8;if(typeof c.gold!=="number"||isNaN(c.gold))c.gold=0;
      if(!c.abilities)c.abilities=[];if(!c.spells)c.spells=[];
      if(!worldState.npcs)worldState.npcs=[];if(!worldState.questLog)worldState.questLog=[];if(!worldState.eventHistory)worldState.eventHistory=[];}
    if(sl)sessionLog=JSON.parse(sl);
    if(mm){memory=JSON.parse(mm);if(!memory.futureEvents)memory.futureEvents=[];if(!memory.usedNames)memory.usedNames=[];}
    else memory={npcs:{},locations:{},quests:{},lore:[],keyDecisions:[],futureEvents:[],chapters:[],usedNames:[]};
    return !!ws;}catch(e){return false;}
}
