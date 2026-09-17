// sabotage-audit-core.js — mutation proof for the 2026-09-18 audit's core lane (tags, prompt assembly, memory/identity).
//
// Each clause below re-opens one hole the audit closed and must make the "audit 2026-09-18" section of
// dev/run-tests.js FAIL on the named assertion; a mutation that changes no bytes is a hard failure.
// Usage: node dev/sabotage-audit-core.js
var sabotage = require("./sabotage.js");
var CMD = ["node", ["dev/run-tests.js", "audit 2026-09-18"]];
/* the scratch clone (sabotage.js proveScratch) carries the engine manifest + the two suites; every other file this lane
   co-changed must ride along or the clone's baseline is red and every clause misattributes (#194L6/#197) */
var ALSO = ["dev/latch-census.js", "dev/golden/tag-table-strip.golden"];
var rc = 0;

rc |= sabotage.prove({
  file: "tag_table.js",
  command: CMD,
  also: ALSO,
  cases: [
    { label: "A1 — the milestone paymaster forgets the kind: the village pays quest XP again",
      mustFail: "milestone paid in the village",
      find: '  if(typeof kindDef==="function"&&kindDef().xp==="none"){if(R&&R.muts)R.muts.push("XP refused — the village pays nothing ("+kind+" milestone: "+label+")");',
      replace: '  if(false){if(R&&R.muts)R.muts.push("XP refused — the village pays nothing ("+kind+" milestone: "+label+")");' },
    { label: "A4 — the Pax gate loses the bare [NPC:name|dead|…]: a resident dies in the village",
      mustFail: "a resident died in the village",
      find: 'if(npStatus&&!_npN.dead&&npcDeadStatus(npStatus)&&__villageHarmRefused(R,"NPC death",npName+"|"+npStatus)){',
      replace: 'if(false&&npStatus&&!_npN.dead&&npcDeadStatus(npStatus)&&__villageHarmRefused(R,"NPC death",npName+"|"+npStatus)){' },
    { label: "A5 — companion items ride through a refused village trade again",
      mustFail: "the companion gained through the refused trade",
      find: '  if(R.villageTradeRefused&&cIgTags.length){R.muts.push("Trade refused — nothing gained by companions (',
      replace: '  if(false&&R.villageTradeRefused&&cIgTags.length){R.muts.push("Trade refused — nothing gained by companions (' },
    { label: "A3 — the SUBLOCATION handler takes the FIRST arrival again (the trade gate reads the last)",
      mustFail: "position:",
      find: 'var sloctag=_slAll.length?_slAll[_slAll.length-1].match(/\\[SUBLOCATION:([^\\]]+)\\]/):null;',
      replace: 'var sloctag=_slAll.length?_slAll[0].match(/\\[SUBLOCATION:([^\\]]+)\\]/):null;' },
    { label: "A6 — COMBAT_START leaves the near-miss tripwire: a malformed start vanishes in silence",
      mustFail: "COMBAT_START:",
      find: '  __tagNearMiss(text,R,"COMBAT_START",',
      replace: '  if(false)__tagNearMiss(text,R,"COMBAT_START",' }
  ]
});

rc |= sabotage.prove({
  file: "memory.js",
  command: CMD,
  also: ALSO,
  cases: [
    { label: "C5 — the sameNpc hint path forgets the provisional guard (dueling nudges return)",
      mustFail: "a provisional pair was queued",
      find: 'if(typeof npcIsProvisional==="function"&&(npcIsProvisional(snC)||npcIsProvisional(snD))){',
      replace: 'if(false){' },
    { label: "C4 — the visited[] cap stops being applied (the write-only list grows forever again)",
      mustFail: "unbounded",
      find: '  if(memory.locations[loc].visited.length>VISITED_CAP)memory.locations[loc].visited.splice(0,memory.locations[loc].visited.length-VISITED_CAP);/* audit C4: bounded */\n',
      replace: '' }
  ]
});

rc |= sabotage.prove({
  file: "identity.js",
  command: CMD,
  also: ALSO,
  cases: [
    { label: "C1 — the merge fold stops reading the carry registry (floor plans and markets die with the duplicate again)",
      mustFail: "fold dropped",
      find: '  for(_ci=0;_ci<_cf.length;_ci++){var _f=_cf[_ci],_k=_f.k,_dv=dupNode[_k],_cv=canonNode[_k];',
      replace: '  for(_ci=0;_ci<0;_ci++){var _f=_cf[_ci],_k=_f.k,_dv=dupNode[_k],_cv=canonNode[_k];' }
  ]
});

rc |= sabotage.prove({
  file: "api.js",
  command: CMD,
  also: ALSO,
  cases: [
    { label: "B5 — the registry's combat axis goes back to being documentation",
      mustFail: "a silent-in-combat builder ran in combat",
      find: '    if(worldState.combat&&row.combat==="silent")continue;',
      replace: '' },
    { label: "B2 — the roster stops folding stale NPCs (every name ever met rides every turn again)",
      mustFail: "a stale NPC seen elsewhere must leave the line",
      find: 'if(!_rosterKeep(npc)){_rosterFold++;continue;}',
      replace: '' },
    { label: "B1 — the quest escalation forgets its latch and fires every turn",
      mustFail: "must not fire the very next turn",
      find: '    if(q.escalateNudged!=null&&worldState.turn-q.escalateNudged<QUEST_NUDGE_REFIRE_TURNS)continue;',
      replace: '' }
  ]
});

process.exit(rc);
