// repair-t1903-caul.js — the t1903 Caul repair, through the SHIPPING executors.
//
// Owner ruling 2026-08-17: honour the quest completion. Caul's death was narrated and refused
// twice; both transactions quarantined. `caul-gutterlane-001` (t1889, XP 1400 + 600 gold) and
// `caul-death-001` (t1902, XP 1200 + two objectives + quest completion) are the SAME death, so
// crediting both would double-pay. This credits caul-death-001's operations ONLY — the 600 gold
// from the superseded first attempt is deliberately NOT invented (the #175 Mokmurian precedent).
//
// A quarantined id stays poisoned by contract, so the repair re-emits under a NEW stable id and
// rides the #175b structured-presence binding: Caul is introduced (t1852) with an earlier roster
// write (t1878), which is exactly the evidence the fix admits. If the fix regressed, this script
// fails LOUDLY instead of writing a half-repaired save.
//
// Usage: node dev/repair-t1903-caul.js <path-to-t1903.tnd> [--write]
var fs=require("fs"),path=require("path"),engine=require("./load-engine.js");
engine.loadEngine();

var elStub={appendChild:function(){},remove:function(){},style:{},textContent:"",innerHTML:""};
addMsg=function(){return elStub;};showToast=function(){};syncUI=function(){};
saveAll=function(){};saveCore=function(){};saveMem=function(){};updateCampMeta=function(){};
bondToast=function(){};showArchetypeModal=function(){};showStatBumpModal=function(){};
showSpellUnlockModal=function(){};updateAbPanel=function(){};updateSpPanel=function(){};
updateInvPanel=function(){};checkLegacyCharacter=function(){};
if(typeof storageAdapter==="undefined")storageAdapter={syncToServer:function(){},syncNow:function(){}};

function fail(msg){throw new Error("CAUL REPAIR FAILED: "+msg);}
var savePath=process.argv[2];if(!savePath)fail("pass the t1903 .tnd path");
var write=process.argv.indexOf("--write")>=0;
savePath=path.resolve(savePath);
var raw=JSON.parse(fs.readFileSync(savePath,"utf8"));
if(!raw.worldState||!raw.memory||!raw.sessionLog)fail("export lacks worldState, memory, or sessionLog");
worldState=raw.worldState;memory=raw.memory;sessionLog=raw.sessionLog;
migrateWorldState();healMemory();

var QUEST="The Shore District Caul";
// ---- pre-state assertions (the repair must refuse to run against a save it does not recognise)
var caul=wsNpcByName("Caul");
if(!caul)fail("Caul is not on the roster");
if(npcIsDead(caul))fail("Caul is already dead — this save is already repaired");
var conflicts=(worldState.identityConflicts||[]).filter(function(c){return c.subject==="Caul"&&!c.resolved;});
if(conflicts.length!==4)fail("expected 4 unresolved Caul conflicts, found "+conflicts.length);
var quest=null,i;
for(i=0;i<(worldState.questLog||[]).length;i++)if(worldState.questLog[i].title===QUEST)quest=worldState.questLog[i];
if(!quest)fail("'"+QUEST+"' is not in the live quest log");
var objectives=(quest.objectives||[]).map(function(o){return o.text;});
if(objectives.length<2)fail("expected the two Caul objectives, found "+objectives.length);
var xp0=worldState.character.xp,gold0=worldState.character.gold,lvl0=worldState.character.level;

// ---- the gate itself: prove #175b authorizes THIS claim before mutating anything
var ev=w2NamedPresenceEvidence("Caul",1902);
if(!ev)fail("structured presence did not authorize the named death — the fix does not cover this save");
console.log("structured presence evidence: "+ev);
if(!w2DeathAuthorized("Caul",null))fail("w2DeathAuthorized still refuses the named death");

// ---- the repair, through applyMuts (one envelope, a NEW stable id, no gold)
var ops="[SCENE_DEATH:caul][NPC:Caul|dead|enemy]"
  +"[QUEST_STEP:"+QUEST+"|"+objectives[0]+"|true]"
  +"[QUEST_STEP:"+QUEST+"|"+objectives[1]+"|true]"
  +"[QUEST:"+QUEST+"|completed|]"
  +"[XP:1200]";
applyMuts("[CANON_TXN_BEGIN:caul-death-002|npc-death|Caul|caul|"+QUEST+"]"+ops+"[CANON_TXN_END:caul-death-002]");

// ---- post-state assertions
if(!npcIsDead(wsNpcByName("Caul")))fail("Caul was not stamped dead");
if(!memory.npcs.Caul||!memory.npcs.Caul.dead)fail("the memory tier did not record the death");
var left=(worldState.identityConflicts||[]).filter(function(c){return c.subject==="Caul"&&!c.resolved;});
if(left.length)fail(left.length+" Caul conflicts survived the death stamp");
for(i=0;i<(worldState.questLog||[]).length;i++)if(worldState.questLog[i].title===QUEST)fail("the quest is still live — it should have archived");
if(!memory.quests||!memory.quests[QUEST])fail("the quest did not archive to memory.quests");
if(worldState.character.xp!==xp0+1200)fail("XP is "+worldState.character.xp+", expected "+(xp0+1200));
if(worldState.character.gold!==gold0)fail("gold changed — the superseded 600 must not be credited");
var receipt=null;
for(i=0;i<(worldState.canonTxns||[]).length;i++)if(worldState.canonTxns[i].id==="caul-death-002")receipt=worldState.canonTxns[i];
if(!receipt||receipt.status!=="committed")fail("no committed receipt for caul-death-002");

// ---- annotate the two superseded receipts (the honest record, the #175 precedent)
var NOTE="#175b 2026-08-17: same death re-emitted and COMMITTED as caul-death-002 under structured "
  +"presence; quest completion + XP 1200 credited. The 600 gold from caul-gutterlane-001 was NOT "
  +"credited (owner ruling: honour the quest completion; the two attempts are one death).";
for(i=0;i<(worldState.canonTxns||[]).length;i++){
  var r=worldState.canonTxns[i];
  if(r.id==="caul-gutterlane-001"||r.id==="caul-death-001")r.repaired=NOTE;
}

console.log("Caul: "+wsNpcByName("Caul").status+" (dead t"+wsNpcByName("Caul").dead+")");
console.log("conflicts cleared: 4 -> "+((worldState.identityConflicts||[]).length));
console.log("quest '"+QUEST+"': archived as "+memory.quests[QUEST].status);
console.log("XP "+xp0+" -> "+worldState.character.xp+" | gold "+gold0+" (unchanged) | level "+lvl0+" -> "+worldState.character.level);
console.log("receipt caul-death-002: "+receipt.status);

if(write){
  var out=savePath.replace(/\.tnd$/,"_REPAIRED.tnd");
  fs.writeFileSync(out,JSON.stringify({worldState:worldState,sessionLog:sessionLog,memory:memory}));
  console.log("WROTE "+out);
}else{
  console.log("DRY RUN — pass --write to emit the repaired .tnd");
}
