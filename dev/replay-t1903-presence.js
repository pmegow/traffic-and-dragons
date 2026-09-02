// replay-t1903-presence.js — the #194 acceptance replay against the real t1903 export.
// Read-only (loads the save into process memory; writes nothing back). Proves, on the save the
// incident actually happened in:
//   ① the killable-by-bare-name census under WITNESSED grading drops 37 → ~9 (the panel's
//     measured figure: the party, Caul, and the characters actually in the scene);
//   ② Caul authorizes on his SPEECH record (the evidence the t1903 tag stream held all along);
//   ③ the remote-mention attack — mention a far-away NPC, kill them next turn — REFUSES in the
//     SHIPPING config (a fresh mood write re-stamps statusTurn post-epoch);
//   ④ the shipping config is FAIL-CLOSED (ruling ③ flipped v1.760): zero legacy-grade citations;
//   ⑤ dev/repair-t1903-caul.js's authorization precondition still holds.
// Usage: node dev/replay-t1903-presence.js testRuns/Rise_of_the_Runelords__t1903.tnd
var fs=require("fs"),path=require("path"),engine=require("./load-engine.js");
engine.loadEngine();

var elStub={appendChild:function(){},remove:function(){},style:{},textContent:"",innerHTML:""};
addMsg=function(){return elStub;};showToast=function(){};syncUI=function(){};
saveAll=function(){};saveCore=function(){};saveMem=function(){};updateCampMeta=function(){};
checkLegacyCharacter=function(){};
if(typeof storageAdapter==="undefined")storageAdapter={syncToServer:function(){},syncNow:function(){}};

function fail(msg){throw new Error("#194 ACCEPTANCE REPLAY FAILED: "+msg);}
var savePath=process.argv[2];if(!savePath)fail("pass the t1903 .tnd path");
var raw=JSON.parse(fs.readFileSync(path.resolve(savePath),"utf8"));
if(!raw.worldState||!raw.memory)fail("export lacks worldState or memory");
worldState=raw.worldState;memory=raw.memory;sessionLog=raw.sessionLog||[];
migrateWorldState();healMemory();
if(typeof worldState.presenceEpoch!=="number")fail("migration did not stamp presenceEpoch");
if(!worldState.sceneRefs)fail("this save has no active W2 ledger — the census would be vacuous");
console.log("epoch: t"+worldState.presenceEpoch+" (turn "+worldState.turn+")");

function census(){
  var out=[],i;
  for(i=0;i<(worldState.npcs||[]).length;i++){var n=worldState.npcs[i];
    if(!n||npcIsDead(n))continue;
    if(w2DeathAuthorized(n.name,null))out.push(n.name+" — "+(w2NamedPresenceEvidence(n.name)||"(frame/actor evidence)"));
  }
  return out;
}
var living=(worldState.npcs||[]).filter(function(n){return n&&!npcIsDead(n);}).length;

// ① witnessed-only census: epoch 0 = nothing is pre-epoch, so the legacy clauses cannot fire and
// only witnessed limbs (speech / observed / party / truthful post-epoch records) authorize.
var shipEpoch=worldState.presenceEpoch;
worldState.presenceEpoch=0;
var witnessed=census();
console.log("\nWITNESSED census: "+witnessed.length+" of "+living+" living rostered NPCs killable by bare name:");
witnessed.forEach(function(l){console.log("  • "+l);});
if(witnessed.length>12)fail("witnessed census is "+witnessed.length+" — expected ~9 (the regrade is not holding)");
var caulW=witnessed.filter(function(l){return l.indexOf("Caul —")===0;});
if(!caulW.length)fail("Caul is not in the witnessed census");
if(caulW[0].indexOf("speech")<0)fail("Caul's citation is not his speech record: "+caulW[0]);

// ② shipping census: FAIL-CLOSED since v1.760 (ruling ③ flipped) — pre-epoch stamps authorize nothing,
//    so the shipping census must equal the witnessed census and carry zero legacy-grade citations.
worldState.presenceEpoch=shipEpoch;
var shipping=census(),legacy=shipping.filter(function(l){return /legacy/i.test(l);});
console.log("\nSHIPPING census (fail-closed): "+shipping.length+" killable, "+legacy.length+" legacy-grade");
if(legacy.length)fail("legacy-grade citations survived the fail-closed flip: "+legacy.join(" | "));
if(shipping.length!==witnessed.length)fail("shipping census ("+shipping.length+") != witnessed census ("+witnessed.length+") — something authorizes on pre-epoch evidence");

// ③ the remote-mention attack, in the shipping config: pick a living non-party NPC with NO
//    authorization at all (the pre-epoch-only population) and prove a fresh mention cannot buy one.
var target=null,i;
for(i=0;i<worldState.npcs.length;i++){var n=worldState.npcs[i];
  if(n&&!npcIsDead(n)&&!n.partyMember&&!w2NamedPresenceEvidence(n.name)&&n.statusTurn>0&&n.statusTurn<shipEpoch){target=n;break;}
}
if(!target)fail("no pre-epoch-only remote NPC to attack with");
console.log("\nremote-mention attack target: "+target.name+" (currently authorized: "+w2NamedPresenceEvidence(target.name)+")");
worldState.turn++;applyMuts("[NPC:"+target.name+"|scheming|enemy]");
worldState.turn++;
if(w2DeathAuthorized(target.name,null))fail("the mention-then-kill attack still authorizes: "+w2NamedPresenceEvidence(target.name));
var xp0=worldState.character.xp;
applyMuts("[NPC:"+target.name+"|dead|enemy][XP:500][QUEST_STEP:A Debt Settled|Confirm the death|true]");
if(npcIsDead(wsNpcByName(target.name)))fail("the remote-mention kill landed");
if(worldState.character.xp!==xp0)fail("the refused death's co-emitted quest consequence still paid XP (the R1 strip)");
if(!worldState.deathEvidencePing||worldState.deathEvidencePing.name!==resolveNpcName(target.name))fail("the refusal did not arm the valve");
console.log("attack REFUSED — mention re-stamped statusTurn post-epoch; valve armed for "+target.name);

// ⑤ the Caul repair's own gate precondition (dev/repair-t1903-caul.js line 50)
var ev=w2NamedPresenceEvidence("Caul",1902);
if(!ev)fail("repair-t1903-caul's precondition broke: w2NamedPresenceEvidence('Caul',1902) is null");
console.log("\nrepair precondition: w2NamedPresenceEvidence('Caul',1902) = \""+ev+"\"");
console.log("\n#194 ACCEPTANCE REPLAY GREEN — witnessed "+witnessed.length+"/"+living+" (was 37/"+living+" on the statusTurn limb), Caul on speech, remote-mention refused, legacy window CLOSED (0 legacy-grade citations under fail-closed)");
