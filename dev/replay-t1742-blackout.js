// replay-t1742-blackout.js — roll the campaign back to the t1728 export and replay the player's
// own decisions through t1782, watching for the #175 error class at every step.
//
//   node dev/replay-t1742-blackout.js <t1728.tnd> <t1782.tnd> [--expect-broken]
//
// The incident (#175, DOC/Research/mature game drift.html): at t1742 the GM wrapped Mokmurian's death,
// [COMBAT_END:victory], 2200 XP, 1500 gp and the quest completion in one CANON_TXN envelope;
// COMBAT_END was outside the allow-list, the WHOLE envelope quarantined, and the resulting
// unresolvable conflict then stripped quest/reward tags from every later response that said
// "Mokmurian" — t1760 (the payoff) and t1782 (which also destroyed the UNRELATED
// [QUEST:Whispers of Jorgenfist|completed]).
//
// Reconstruction sources, in order of exactness:
//   t1742  — EXACT: the quarantined receipt's own operation list (subject/evidence/quest/id too).
//   t1782  — EXACT: the raw response survives in the t1782 export's sessionLog.
//   t1743+ — tag names from worldState.tagLog + payloads rebuilt from the mutation labels;
//            t1760's amounts are NOT recoverable (the strip destroyed them before logging) and are
//            replayed as SYNTHETIC [XP:750][GOLD:750] — flagged, never asserted as owed values.
//   t1729-1741 — prose-only (outside every tagLog window); a [COMBAT_START:Mokmurian] is
//            reconstructed at t1741 so the ejected COMBAT_END has the fight it actually closed.
//   Player turns — verbatim from the t1782 transcript; they are the "same decisions".
//
// With --expect-broken (run it against a PRE-fix tree) the assertions invert: the run passes only
// if the incident REPRODUCES (envelope quarantined, payoff stripped, Whispers destroyed). Without
// it, the run passes only if the whole error class is absent end to end.
var fs=require("fs"),path=require("path"),engine=require("./load-engine.js");
engine.loadEngine();

var elStub={appendChild:function(){},remove:function(){},style:{},textContent:"",innerHTML:""};
addMsg=function(){return elStub;};showToast=function(){};syncUI=function(){};
saveAll=function(){};saveCore=function(){};saveMem=function(){};updateCampMeta=function(){};
bondToast=function(){};showArchetypeModal=function(){};showStatBumpModal=function(){};
updateAbPanel=function(){};updateSpPanel=function(){};updateInvPanel=function(){};
checkLegacyCharacter=function(){};
if(typeof storageAdapter==="undefined")storageAdapter={syncToServer:function(){},syncNow:function(){}};

var args=process.argv.slice(2),expectBroken=args.indexOf("--expect-broken")>=0;
var files=args.filter(function(a){return a.charAt(0)!=="-";});
if(files.length<2){console.error("usage: node dev/replay-t1742-blackout.js <t1728.tnd> <t1782.tnd> [--expect-broken]");process.exit(1);}
function fail(msg){console.error("REPLAY "+(expectBroken?"(control) ":"")+"FAILED: "+msg);process.exit(1);}

var base=JSON.parse(fs.readFileSync(path.resolve(files[0]),"utf8"));
var target=JSON.parse(fs.readFileSync(path.resolve(files[1]),"utf8"));
worldState=base.worldState;memory=base.memory;sessionLog=base.sessionLog||[];
migrateWorldState();if(typeof healMemory==="function")healMemory();
if(worldState.turn!==1728)fail("base export is not t1728 (turn "+worldState.turn+")");

var tws=target.worldState;
var ttr=(tws.transcript&&tws.transcript.__lz)?parseWorldState(JSON.stringify(tws)).transcript:tws.transcript;
var byTurn={};(ttr||[]).forEach(function(e){if(!e||!e.t)return;if(!byTurn[e.t])byTurn[e.t]={};byTurn[e.t][e.r]=e.x||"";});
var tagsByTurn={};(tws.tagLog||[]).forEach(function(e){tagsByTurn[e.t]={tags:e.tags||[],m:e.m||[]};});

// the EXACT t1742 envelope, rebuilt from its quarantined receipt
var receipt=null;(tws.canonTxns||[]).forEach(function(r){if(r.id==="mokmurian_true_death")receipt=r;});
if(!receipt)fail("the t1782 export no longer carries the mokmurian_true_death receipt");
var T1742="[CANON_TXN_BEGIN:mokmurian_true_death|npc-death|Mokmurian|-|Mokmurian's Army]"
  +"[NPC:Mokmurian|dead|enemy][COMBAT_END:victory][XP:2200][QUEST:Mokmurian's Army|completed][GOLD:1500]"
  +"[CANON_TXN_END:mokmurian_true_death]";
// the EXACT t1782 raw, recovered from the target's sessionLog
var T1782=null;(target.sessionLog||[]).forEach(function(m){if(m.role==="assistant"&&/\[ARC_COMPLETE:Mokmurian's Army\]/.test(m.content||""))T1782=m.content;});
if(!T1782)fail("the t1782 raw response is no longer in the target sessionLog");

// payload reconstruction for t1743..t1781 from the tagLog mutation labels
function tagsFor(t){
  var e=tagsByTurn[t];if(!e)return"";
  var out=[],i,m;
  for(i=0;i<e.m.length;i++){
    var lab=e.m[i];
    if((m=lab.match(/^([+-]\d+) gp$/)))out.push("[GOLD:"+m[1]+"]");
    else if((m=lab.match(/^\+(.+)$/))&&e.tags.indexOf("ITEM_GAINED")>=0)out.push("[ITEM_GAINED:"+m[1]+"]");
    else if((m=lab.match(/^(.+?): \+(.+)$/))&&e.tags.indexOf("ITEM_GAINED")>=0)out.push("[COMPANION_ITEM_GAINED:"+m[1]+"|"+m[2]+"]");
    else if((m=lab.match(/^Sub: (.+)$/)))out.push("[SUBLOCATION:"+m[1]+"]");
    else if(lab==="Left sub-location")out.push("[SUBLOCATION_LEAVE]");
    else if((m=lab.match(/^Time \+(\d+)m/)))out.push("[TIME_ADVANCE:"+m[1]+"m]");
    else if((m=lab.match(/^Time: (.+)$/)))out.push("[TIME:"+m[1]+"]");
    else if((m=lab.match(/^Rest: spell slots restored/)))out.push("[REST:long]");
    else if((m=lab.match(/^Quest offered: (.+)$/)))out.push("[QUEST:"+m[1]+"|offered]");
    else if((m=lab.match(/^(.+?) \+ (.+)$/))&&e.tags.indexOf("QUEST_STEP")>=0)out.push("[QUEST_STEP:"+m[1]+"|"+m[2]+"]");
    else if((m=lab.match(/^NPC: (.+)$/)))out.push("[NPC:"+m[1]+"||]");
  }
  return out.join("");
}

var stripWarns=[],conflictWarns=[],origWarn=console.warn;
console.warn=function(){var s=Array.prototype.join.call(arguments," ");
  if(/quest\/reward consequence refused|completion .*withheld|Completion withheld/i.test(s))stripWarns.push("t"+worldState.turn+": "+s.slice(0,120));
  if(/QUARANTINED|unsupported operation/.test(s))conflictWarns.push("t"+worldState.turn+": "+s.slice(0,120));
  return origWarn.apply(console,arguments);};

var nudgeFirings=0;
var checkpoints={};
function snap(label){checkpoints[label]={xp:worldState.character.xp,gold:worldState.character.gold,
  mokArmy:questState("Mokmurian's Army"),whispers:questState("Whispers of Jorgenfist"),
  conflicts:(worldState.identityConflicts||[]).filter(function(c){return !c.resolved;}).length};}
function questState(title){
  var i;for(i=0;i<(worldState.questLog||[]).length;i++)if(worldState.questLog[i].title===title)return "live:"+worldState.questLog[i].status;
  if(memory.quests&&memory.quests[title])return "archived:"+memory.quests[title].status;
  return "absent";
}

for(var T=1729;T<=1782;T++){
  var rec=byTurn[T]||{};
  worldState.turn=T;
  var raw;
  if(T===1742)raw=(rec.gm||"")+"\n"+T1742;
  else if(T===1782)raw=T1782;
  else if(T===1741)raw=(rec.gm||"")+"\n[COMBAT_START:Mokmurian|60|17|+9|2d8|high]";/* reconstructed: the fight the envelope's COMBAT_END closed */
  else if(T===1760)raw=(rec.gm||"")+"\n[QUEST_STEP:Mokmurian's Army|Confirm Mokmurian's current strength and whether he is splitting his forces or holding at Jorgenfist|true][XP:750][GOLD:750]";/* SYNTHETIC amounts — the real ones were destroyed before logging */
  else raw=(rec.gm||"")+tagsFor(T);
  applyMuts(raw);
  if(typeof buildEngineNotes==="function"){var notes=buildEngineNotes();if(notes.indexOf("IDENTITY CONSEQUENCE QUARANTINED")>=0)nudgeFirings++;}
  if(T===1742)snap("t1742");
  if(T===1760)snap("t1760");
}
snap("end");
console.warn=origWarn;

var r42=null;(worldState.canonTxns||[]).forEach(function(r){if(r.id==="mokmurian_true_death")r42=r;});
var out={
  receipt:r42?(r42.status+(r42.ejected?" ejected:["+r42.ejected.join(",")+"]":"")):"missing",
  t1742:checkpoints["t1742"],t1760:checkpoints["t1760"],end:checkpoints.end,
  stripWarns:stripWarns.length,quarantineWarns:conflictWarns.length,nudgeFirings:nudgeFirings
};
console.log(JSON.stringify(out,null,1));

if(expectBroken){
  if(!r42||r42.status!=="quarantined")fail("control did not reproduce the envelope quarantine");
  if(!stripWarns.length)fail("control did not reproduce the blackout strips");
  if(checkpoints.end.whispers.indexOf("archived:completed")===0)fail("control let Whispers of Jorgenfist complete — the blackout did not reproduce");
  console.log("CONTROL GREEN — the incident reproduces on this tree exactly as it did in the field");
  console.log("  strips: "+stripWarns.join(" | "));
}else{
  if(!r42)fail("the t1742 envelope left no receipt");
  if(r42.status!=="committed")fail("the t1742 envelope was refused again: "+r42.reason);
  if(!(r42.ejected&&r42.ejected.indexOf("COMBAT_END")>=0))fail("COMBAT_END was not ejected: "+JSON.stringify(r42.ejected));
  if(checkpoints.t1742.xp!==(base.worldState.character.xp+2200))fail("the 2200 XP did not land at t1742: "+checkpoints.t1742.xp);
  if(checkpoints.t1742.gold<base.worldState.character.gold+1500-100)fail("the 1500 gp did not land at t1742");
  if(checkpoints.t1742.mokArmy!=="archived:completed")fail("Mokmurian's Army did not complete at t1742: "+checkpoints.t1742.mokArmy);
  if(checkpoints.t1742.conflicts)fail("the committed envelope minted a conflict");
  if(worldState.combat)fail("the ejected COMBAT_END did not close the reconstructed fight");
  if(checkpoints.t1760.xp!==checkpoints.t1742.xp+750)fail("the t1760 payoff was stripped again (synthetic XP missing)");
  if(checkpoints.end.whispers!=="archived:completed")fail("Whispers of Jorgenfist did not complete at t1782: "+checkpoints.end.whispers);
  if(checkpoints.end.conflicts)fail("unresolved conflicts at end: "+checkpoints.end.conflicts);
  if(stripWarns.length)fail("blackout strips fired during the replay: "+stripWarns.join(" | "));
  if(nudgeFirings)fail("the identity-conflict nudge fired "+nudgeFirings+" times — the unanswerable-note class is back");
  console.log("REPLAY GREEN — t1728 rolled forward through t1782 with the player's decisions; the error class is absent end to end");
  console.log("  XP "+base.worldState.character.xp+" -> "+checkpoints.end.xp+" | gold "+base.worldState.character.gold+" -> "+checkpoints.end.gold);
  console.log("  Mokmurian's Army: "+checkpoints.end.mokArmy+" | Whispers of Jorgenfist: "+checkpoints.end.whispers);
}
