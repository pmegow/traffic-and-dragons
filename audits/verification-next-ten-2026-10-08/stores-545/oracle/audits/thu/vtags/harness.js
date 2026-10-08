const loader=require(process.env.ENGINE_ROOT+'/dev/load-engine.js');loader.loadEngine();
const geval=eval;
geval('var __toasts=[];function __stubEl(){return {appendChild:function(){},style:{},remove:function(){},textContent:"",innerHTML:"",className:""};}');
for(const k of ['saveAll','saveCore','saveMem','saveLocal','syncUI','updateAbPanel','updateSpPanel','updateInvPanel','generateActions','processPendingCompanionSheets','speakNarration','checkLegacyCharacter','showArchetypeModal','showStatBumpModal','showItemDefConfirmModal','showRewardClaimModal','audioScenePublish','audioFileCandidates','takeCheckpoint','updateCampMeta','bondToast'])global[k]=function(){};
global.addMsg=function(){return __stubEl();};global.showToast=function(m){__toasts.push(String(m));};
global.makeWorld=function(){return loader.makeTestWorld();};
global.addComp=function(name,inv,extra){var cs=Object.assign({name:name,inventory:inv||[]},extra||{});worldState.npcs.push({name:name,status:'ally',rel:'companion',partyMember:true,charSheet:cs});return cs;};
global.quiet=function(fn){const out=[],keys=['warn','info','debug','log','error'],old=keys.map(k=>console[k]);keys.forEach(k=>console[k]=function(m){out.push(String(m));});try{return {r:fn(),warns:out};}finally{keys.forEach((k,i)=>console[k]=old[i]);}};
global.run=function(text,opts){var q=quiet(function(){return applyMuts(text,opts);});return {r:q.r,muts:q.r.muts||[],warns:q.warns};};
global.villageEF=function(){
    makeWorld();worldState.kind="village";worldState.world.location="The Village";worldState.world.sublocation=null;worldState.character.name="Silas";worldState.character.coin=2500;
    if(!memory.map)memory.map={nodes:{},edges:[],lastArrivalFrom:null};
    memory.map.nodes["The Village"]={firstVisit:1,visits:3,description:null,parent:null,npcs:[],items:[],size:"small",travelMins:null};
    importVillageResidents([{name:"Frizwick",gender:"F",cls:"Rogue"},{name:"Daeris",gender:"F",cls:"Cleric"}]);
    memory.map.nodes["The Village|the tavern"]={firstVisit:1,visits:2,description:null,parent:"The Village",npcs:[],items:[],size:"small",travelMins:null};
    memory.map.nodes["The Village|the Village Hall"]={firstVisit:1,visits:1,description:null,parent:"The Village",npcs:[],items:[],size:"small",travelMins:null};
    memory.npcs["Frizwick"].lastSeenAt="The Village|the tavern";memory.npcs["Daeris"].lastSeenAt="The Village|Daeris's house";
    worldState.world.sublocation="the tavern";
  };
