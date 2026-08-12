// replay-w2-incident.js — read-only replay of the t1667 Mokmurian referent failure.
// Loads an exported campaign into process memory, applies the already-ratified death correction
// to that clone, then proves the old scholar→Mokmurian death/objective/XP bundle quarantines.
// Usage: node dev/replay-w2-incident.js <path-to-t1667.tnd>
var fs=require("fs"),path=require("path"),engine=require("./load-engine.js");
engine.loadEngine();

var elStub={appendChild:function(){},remove:function(){},style:{},textContent:"",innerHTML:""};
addMsg=function(){return elStub;};showToast=function(){};syncUI=function(){};
saveAll=function(){};saveCore=function(){};saveMem=function(){};updateCampMeta=function(){};
bondToast=function(){};showArchetypeModal=function(){};showStatBumpModal=function(){};
updateAbPanel=function(){};updateSpPanel=function(){};updateInvPanel=function(){};
checkLegacyCharacter=function(){};
if(typeof storageAdapter==="undefined")storageAdapter={syncToServer:function(){},syncNow:function(){}};

function fail(msg){throw new Error("W2 REPLAY FAILED: "+msg);}
function transcriptHas(turn,role,needle){
  var rows=worldState.transcript||[],i,low=String(needle).toLowerCase();
  for(i=0;i<rows.length;i++)if(rows[i]&&rows[i].t===turn&&rows[i].r===role&&String(rows[i].x||"").toLowerCase().indexOf(low)>=0)return true;
  return false;
}
function txn(id,subject,handle,quest,body){return"[CANON_TXN_BEGIN:"+id+"|npc-death|"+subject+"|"+handle+"|"+quest+"]"+body+"[CANON_TXN_END:"+id+"]";}

var savePath=process.argv[2];
if(!savePath)fail("pass the t1667 .tnd path");
savePath=path.resolve(savePath);
var raw=JSON.parse(fs.readFileSync(savePath,"utf8"));
if(!raw.worldState||!raw.memory||!raw.sessionLog)fail("export lacks worldState, memory, or sessionLog");
worldState=raw.worldState;memory=raw.memory;sessionLog=raw.sessionLog;
migrateWorldState();healMemory();

if(!transcriptHas(1638,"gm","not mokmurian himself"))fail("t1638 explicit disidentification is absent");
if(!transcriptHas(1647,"player","scholar-giant"))fail("t1647 player target does not name the scholar");
if(!transcriptHas(1648,"gm","old scholar-giant"))fail("t1648 death does not retain the scholar referent");

var mok=wsNpcByName("Mokmurian"),quest=null,objective=null,i,j;
if(!mok||!memory.npcs.Mokmurian)fail("Mokmurian is not present in both NPC stores");
for(i=0;i<(worldState.questLog||[]).length;i++)if(worldState.questLog[i].title==="The Giants of Jorgenfist"){quest=worldState.questLog[i];break;}
if(!quest)fail("The Giants of Jorgenfist is not active in the export");
for(j=0;j<(quest.objectives||[]).length;j++)if(/mokmurian/i.test(quest.objectives[j].text||"")){objective=quest.objectives[j];break;}
if(!objective)fail("no Mokmurian objective is present");

worldState.turn++;
applyMuts("[NPC_DEATH_RETRACTED:Mokmurian|the slain scholar was a deception and not Mokmurian|Jorgenfist][QUEST_STEP:"+quest.title+"|"+objective.text+"|false]");
if(npcIsDead(wsNpcByName("Mokmurian"))||memory.npcs.Mokmurian.dead)fail("in-memory correction did not restore Mokmurian alive");
if(objective.done)fail("in-memory correction did not reopen the identity-dependent objective");

worldState.turn++;
applyMuts("[SCENE_REF:scholar|?][SCENE_NOT:scholar|Mokmurian|explicit]");
worldState.turn++;
var xpBefore=worldState.character.xp;
var hostile=txn("replay-mok-1648","Mokmurian","scholar",quest.title,"[SCENE_DEATH:scholar][NPC:Mokmurian|dead|enemy][QUEST_STEP:"+quest.title+"|"+objective.text+"|true][XP:600]");
applyMuts(hostile);applyMuts(hostile);
if(npcIsDead(wsNpcByName("Mokmurian"))||memory.npcs.Mokmurian.dead)fail("hostile replay stamped the wrong corpse");
if(objective.done)fail("hostile replay completed the identity-dependent objective");
if(worldState.character.xp!==xpBefore)fail("hostile replay changed XP");
var receipt=null;for(i=0;i<(worldState.canonTxns||[]).length;i++)if(worldState.canonTxns[i].id==="replay-mok-1648")receipt=worldState.canonTxns[i];
if(!receipt||receipt.status!=="quarantined")fail("no durable quarantined receipt was written");

var promptA=buildSysPrompt(),promptB=buildSysPrompt();
if(promptA.stable!==promptB.stable)fail("stable prompt half changed between identical renders");
if(promptB.volatile.indexOf("SCENE REFERENTS")<0||promptB.volatile.indexOf("scholar IS NOT Mokmurian")<0)fail("volatile prompt omits the accepted scene exclusion");
var round=JSON.parse(JSON.stringify(worldState));
if(!round.sceneRefs||!round.canonTxns||!round.identityConflicts)fail("scene evidence, receipt, or conflict failed JSON round-trip");

console.log("W2 EXACT SAVE REPLAY GREEN");
console.log("source: "+savePath);
console.log("Mokmurian: alive | objective: open | replay XP delta: 0");
console.log("receipt: "+receipt.id+" / "+receipt.status+" / "+receipt.reason);
console.log("prompt: stable repeat-byte-identical; scene exclusion present in volatile half");
