// repair-t2032-third-watcher.js — the Third Watcher deadlock repair, through the SHIPPING executors.
//
// Owner ruling 2026-08-20 ("just have the GM emit the tag"): Golvak Stonegall's death was
// narrated at t2013 and refused FOUR times (golvak_death_001/002/003, txn-golvak-death-01) on a
// one-character handle-spelling drift — the ledger held "bronze-masked runner", every claim cited
// "bronze_masked_runner" (TODO #201; the #193 field proof). Every substantive requirement was
// met: registered scene referent bound to his own name (t2010), tagged SPEAKER t2011+t2012 (the
// #194 witnessed limb, inside SPEECH_EVIDENCE_TURNS), on-screen kill. The own-name path
// authorizes TODAY, so this re-emits the same death under a NEW stable id exactly as the Caul
// repair did — an eyewitness envelope, not the [NPC_DEATH_REPORTED:] hedge.
//
// Credited ONCE across the five withheld attempts (the Caul one-death-one-credit precedent):
//   kill XP 400 (t2013, re-tried t2018/t2022 — one kill) + completion XP 800 (t2020) = 1200
//   loot coin 15 (t2019, rode the war-pick looting) + completion gold 200 (t2020)     = 215
//
// Usage: node dev/repair-t2032-third-watcher.js <path-to-t2032.tnd> [--write]
var fs=require("fs"),path=require("path"),engine=require("./load-engine.js");
engine.loadEngine();

var elStub={appendChild:function(){},remove:function(){},style:{},textContent:"",innerHTML:""};
addMsg=function(){return elStub;};showToast=function(){};syncUI=function(){};
saveAll=function(){};saveCore=function(){};saveMem=function(){};updateCampMeta=function(){};
bondToast=function(){};showArchetypeModal=function(){};showStatBumpModal=function(){};
showSpellUnlockModal=function(){};updateAbPanel=function(){};updateSpPanel=function(){};
updateInvPanel=function(){};checkLegacyCharacter=function(){};
if(typeof storageAdapter==="undefined")storageAdapter={syncToServer:function(){},syncNow:function(){}};

function fail(msg){throw new Error("THIRD WATCHER REPAIR FAILED: "+msg);}
var savePath=process.argv[2];if(!savePath)fail("pass the t2032 .tnd path");
var write=process.argv.indexOf("--write")>=0;
savePath=path.resolve(savePath);
var raw=JSON.parse(fs.readFileSync(savePath,"utf8"));
if(!raw.worldState||!raw.memory||!raw.sessionLog)fail("export lacks worldState, memory, or sessionLog");
worldState=raw.worldState;memory=raw.memory;sessionLog=raw.sessionLog;
migrateWorldState();healMemory();

var QUEST="The Third Watcher",NAME="Golvak Stonegall";
// ---- pre-state assertions (refuse to run against a save this repair does not recognise)
var gol=wsNpcByName(NAME);
if(!gol)fail(NAME+" is not on the roster");
if(npcIsDead(gol))fail(NAME+" is already dead — this save is already repaired");
var conflicts=(worldState.identityConflicts||[]).filter(function(c){return c.subject===NAME&&!c.resolved;});
if(conflicts.length!==3)fail("expected 3 unresolved "+NAME+" conflicts, found "+conflicts.length);
var quest=null,i;
for(i=0;i<(worldState.questLog||[]).length;i++)if(worldState.questLog[i].title===QUEST)quest=worldState.questLog[i];
if(!quest)fail("'"+QUEST+"' is not in the live quest log");
if(quest.status!=="active")fail("'"+QUEST+"' is "+quest.status+", expected active");
var objectives=(quest.objectives||[]).map(function(o){return o.text;});
if(objectives.length!==3)fail("expected the three Watcher objectives, found "+objectives.length);
if(quest.objectives.filter(function(o){return o.done;}).length)fail("some objectives already done — not the save this was written against");
var xp0=worldState.character.xp,gold0=worldState.character.gold,lvl0=worldState.character.level;

// ---- the gate itself: prove structured presence authorizes THIS claim before mutating anything
var ev=w2NamedPresenceEvidence(NAME,2032);
if(!ev)fail("structured presence did not authorize the named death — do not force it; investigate instead");
console.log("structured presence evidence: "+ev);
if(!w2DeathAuthorized(NAME,null))fail("w2DeathAuthorized still refuses the named death");

// ---- the repair, through applyMuts: ONE eyewitness envelope, a NEW stable id, own-name handle
var ops="[SCENE_DEATH:"+NAME+"][NPC:"+NAME+"|dead|enemy]"
  +"[QUEST_STEP:"+QUEST+"|"+objectives[0]+"|true]"
  +"[QUEST_STEP:"+QUEST+"|"+objectives[1]+"|true]"
  +"[QUEST_STEP:"+QUEST+"|"+objectives[2]+"|true]"
  +"[QUEST:"+QUEST+"|completed|]"
  +"[XP:1200][GOLD:215]";
applyMuts("[CANON_TXN_BEGIN:golvak-death-004|npc-death|"+NAME+"|"+NAME+"|"+QUEST+"]"+ops+"[CANON_TXN_END:golvak-death-004]");

// ---- post-state assertions
if(!npcIsDead(wsNpcByName(NAME)))fail(NAME+" was not stamped dead");
if(!memory.npcs[NAME]||!memory.npcs[NAME].dead)fail("the memory tier did not record the death");
var left=(worldState.identityConflicts||[]).filter(function(c){return c.subject===NAME&&!c.resolved;});
if(left.length)fail(left.length+" "+NAME+" conflicts survived the authorized death");
for(i=0;i<(worldState.questLog||[]).length;i++)if(worldState.questLog[i].title===QUEST)fail("the quest is still live — it should have archived");
if(!memory.quests||!memory.quests[QUEST])fail("the quest did not archive to memory.quests");
if(memory.quests[QUEST].status!=="completed")fail("archived as "+memory.quests[QUEST].status+", expected completed");
if(worldState.character.xp!==xp0+1200)fail("XP is "+worldState.character.xp+", expected "+(xp0+1200));
if(worldState.character.gold!==gold0+215)fail("gold is "+worldState.character.gold+", expected "+(gold0+215));
var receipt=null;
for(i=0;i<(worldState.canonTxns||[]).length;i++)if(worldState.canonTxns[i].id==="golvak-death-004")receipt=worldState.canonTxns[i];
if(!receipt||receipt.status!=="committed")fail("no committed receipt for golvak-death-004");

// ---- annotate the four superseded receipts (the honest record, the Caul/#175 precedent)
var NOTE="#201 2026-08-20: same death re-emitted and COMMITTED as golvak-death-004 under the own-name "
  +"path (speech evidence t2011/t2012); the four refused attempts were one kill cited under a "
  +"misspelled handle (bronze_masked_runner vs the registered bronze-masked runner). Credited once: "
  +"XP 400+800, gold 15+200.";
for(i=0;i<(worldState.canonTxns||[]).length;i++){
  var r=worldState.canonTxns[i];
  if(/^golvak_death_00[123]$/.test(String(r.id))||r.id==="txn-golvak-death-01")r.repaired=NOTE;
}

console.log(NAME+": "+wsNpcByName(NAME).status+" (dead)");
console.log("conflicts cleared: 3 -> "+(worldState.identityConflicts||[]).filter(function(c){return c.subject===NAME&&!c.resolved;}).length);
console.log("quest '"+QUEST+"': archived as "+memory.quests[QUEST].status+" | paid "+JSON.stringify(memory.quests[QUEST].paid||null));
console.log("XP "+xp0+" -> "+worldState.character.xp+" | gold "+gold0+" -> "+worldState.character.gold+" | level "+lvl0+" -> "+worldState.character.level);
console.log("receipt golvak-death-004: "+receipt.status);

if(write){
  var out=savePath.replace(/\.tnd$/,"_REPAIRED.tnd");
  fs.writeFileSync(out,JSON.stringify({worldState:worldState,sessionLog:sessionLog,memory:memory}));
  console.log("WROTE "+out);
}else{
  console.log("DRY RUN — pass --write to emit the repaired .tnd");
}
