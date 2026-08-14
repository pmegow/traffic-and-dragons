// repair-t1782-blackout.js — one-shot surgical repair of the #175 quest-credit blackout on the
// owner's live t1782 export. Produces <input>_REPAIRED.tnd beside the input; the original is never
// touched. Every change is receipted to console and into worldState.repairLog.
//
//   node dev/repair-t1782-blackout.js testRuns/Rise_of_the_Runelords__Ammut__Ammut_t1782.tnd
//
// What it repairs (evidence: DOC/mature game drift.html; amounts are the EXACT recorded emissions):
//   1. +2200 XP and +1500 gp — the t1742 envelope the engine refused (from its quarantined receipt).
//   2. +400 XP and +200 gp — the t1782 rewards the blackout stripped (from the sessionLog raw).
//   3. "Mokmurian's Army" completed + archived (was falsely active 40 turns after the kill).
//   4. "Whispers of Jorgenfist" completed + archived (its completion was destroyed at t1782).
//   5. The unresolvable identityConflicts row resolved; the quarantined receipt annotated repaired.
//   6. The contradictory Mokmurian canon healed: the "survived as proxy" knowledge line (true of the
//      FIRST kill, false since t1742) retires to memory.archive.superseded (#57 machinery) and the
//      matching lore line is corrected to record both kills.
//   NOT credited: the t1760 payout — its amounts were destroyed before any log recorded them and
//   inventing a number would be its own drift. Recorded honestly in the receipt instead.
var fs=require("fs"),path=require("path"),engine=require("./load-engine.js");
engine.loadEngine();
var p=process.argv[2];if(!p){console.error("usage: node dev/repair-t1782-blackout.js <t1782.tnd>");process.exit(1);}
p=path.resolve(p);
var save=JSON.parse(fs.readFileSync(p,"utf8"));
var ws=save.worldState,mem=save.memory;
if(ws.turn!==1782){console.error("expected the t1782 export, got turn "+ws.turn);process.exit(1);}
var log=[];
function rec(s){log.push(s);console.log("  ✔ "+s);}

// 1+2 — the owed credit, exact recorded amounts only
ws.character.xp+=2600;rec("XP +2600 (2200 refused at t1742 + 400 stripped at t1782) -> "+ws.character.xp);
ws.character.gold+=1700;rec("gold +1700 (1500 refused at t1742 + 200 stripped at t1782) -> "+ws.character.gold);
if(ws.character.xp>=85000)console.warn("  ⚠ XP crossed the L11 gate — level-up owed on next load");

// 3+4 — the two falsely-active quests complete and archive with their true turns
["Mokmurian's Army","Whispers of Jorgenfist"].forEach(function(title,ix){
  var turn=ix===0?1742:1782,i,q=null;
  for(i=0;i<ws.questLog.length;i++)if(ws.questLog[i].title===title){q=ws.questLog[i];ws.questLog.splice(i,1);break;}
  if(!q){console.error("  ✗ "+title+" not in the live log — aborting");process.exit(1);}
  q.status="completed";q.completedAt=turn;
  if(!mem.quests)mem.quests={};mem.quests[title]=q;
  rec(title+" completed and archived @t"+turn);
});

// 5 — the deadlocked conflict + the poisoned receipt
(ws.identityConflicts||[]).forEach(function(c){if(c.subject==="Mokmurian"&&!c.resolved){c.resolved=true;c.resolvedBy="repair-t1782-blackout (#175)";rec("identity conflict for Mokmurian resolved (fired "+c.attempts+" times unanswerable)");}});
ws.identityConflicts=(ws.identityConflicts||[]).filter(function(c){return !c.resolved;});
if(!ws.identityConflicts.length)delete ws.identityConflicts;
(ws.canonTxns||[]).forEach(function(r){if(r.id==="mokmurian_true_death"){r.repaired="#175 2026-08-13: envelope ops credited by hand; t1760 payout unrecoverable (amounts destroyed before logging) and NOT invented";rec("receipt mokmurian_true_death annotated repaired");}});

// 6 — the contradictory canon
var mok=mem.npcs&&mem.npcs.Mokmurian;
if(mok&&mok.knowledge){
  var idx=-1,i;for(i=0;i<mok.knowledge.length;i++)if(/^Survived the party's assault/.test(mok.knowledge[i]))idx=i;
  if(idx>=0){
    var line=mok.knowledge.splice(idx,1)[0];
    if(!mem.archive)mem.archive={};if(!mem.archive.superseded)mem.archive.superseded=[];
    mem.archive.superseded.push({npc:"Mokmurian",fact:line,supersededBy:"the true Mokmurian was killed at t1742; head delivered to Ironbriar at t1760",turn:1782,via:"repair-t1782-blackout (#175)"});
    mok.knowledge.push("The giant slain at Jorgenfist (t1648) was a scholar-proxy; the TRUE Mokmurian was later hunted down and killed in his study (t1742), his severed head delivered to Justice Ironbriar as proof (t1760).");
    rec("superseded the stale 'survived as proxy' knowledge line (#57 machinery); truth line filed");
  }
}
if(mem.lore){
  for(var li=0;li<mem.lore.length;li++){
    var lv=typeof mem.lore[li]==="string"?mem.lore[li]:(mem.lore[li]&&mem.lore[li].fact);
    if(lv&&/scholar-proxy, not Mokmurian; the true Runelord-servant wizard survives/.test(lv)){
      var fixed=lv.replace(/the true Runelord-servant wizard survives and commands the stone giant army from within Jorgenfist/,"the true Mokmurian was later killed in his study (t1742) and his head delivered to Ironbriar");
      if(typeof mem.lore[li]==="string")mem.lore[li]=fixed;else mem.lore[li].fact=fixed;
      rec("lore line corrected: the survival claim no longer outlives the true death");
    }
  }
}

// 7 — the runeblade identity tangle (owner report 2026-08-13). Blade 1 was NAMED Cleaver in
//     fiction and the GM added "Cleaver (…)" to the sheet WITHOUT removing the old generic string
//     (present since ≤t1593); blade 2 — "a blade unlike Cleaver, thinner, wickedly curved" (t1754)
//     — was then granted under that same OLD generic name and stacked onto the stale duplicate,
//     even though the W5 duplicate warning said "verify acquisition/rename". Net: Cleaver double-
//     counted, the companion piece nameless. One replacement fixes both: the x2 stack becomes the
//     companion piece's own entry (one copy was Cleaver's stale pre-name residue, the other IS the
//     companion piece). Cleaver's entry stays untouched.
var GENERIC="Short blade — Thassilonian script along the fuller, three characters, origin unknown x2";
var COMPANION="Curved runeblade — Cleaver's companion piece from the Runeforge chamber, wickedly curved, three Thassilonian characters along the fuller, meant to bind rather than cut";
var gi=ws.character.inventory.indexOf(GENERIC);
if(gi<0){console.error("  ✗ the x2 generic blade stack is not on the sheet — aborting");process.exit(1);}
ws.character.inventory[gi]=COMPANION;
rec("runeblade tangle: the stale 'Short blade …' x2 stack replaced by the companion piece's own entry (Cleaver keeps its slot)");

// 8 — The Sealed Laboratory (owner ruling 2026-08-13, revised: "just mark it done"). The objective
//     was doubly met in fiction — ritual components t1748, the second runeforged weapon t1754 —
//     and never ticked. It stays LIVE with the objective done, so the #20 lifecycle instruction
//     ("⚑ ALL OBJECTIVES COMPLETE — emit [QUEST:title|completed] with rewards, or add the next
//     objective") fires every turn until the GM closes it and pays out. The engine never invents
//     the rewards; the GM does, in-fiction, exactly as designed.
(function(){
  var i,q=null;
  for(i=0;i<ws.questLog.length;i++)if(ws.questLog[i].title==="The Sealed Laboratory"){q=ws.questLog[i];break;}
  if(!q){console.error("  ✗ The Sealed Laboratory not in the live log — aborting");process.exit(1);}
  (q.objectives||[]).forEach(function(o){o.done=true;});
  rec("The Sealed Laboratory objective marked DONE, quest left active — the #20 nudge now demands completion-with-rewards from the GM");
})();

if(!ws.repairLog)ws.repairLog=[];
ws.repairLog.push({at:"t1782",via:"repair-t1782-blackout (#175)",changes:log});
var out=p.replace(/\.tnd$/,"_REPAIRED.tnd");
fs.writeFileSync(out,JSON.stringify(save));
console.log("\nwrote "+out);
console.log("live quests now: "+ws.questLog.map(function(q){return q.title+"("+q.status+")";}).join(", "));
