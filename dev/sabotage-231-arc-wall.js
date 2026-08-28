// sabotage-231-arc-wall.js — mutation proof for the #231 arc wall.
//
// The guard: an emergent thread dies with the arc that bore it. Field evidence (Runelords,
// t2324 save): the closed-eye thread reached 18 quests — 1.8x the ENTIRE 10-arc authored spine —
// and spanned 1,458 of 2,324 turns (63% of the campaign), because it outlived its parent arc by
// ~1000 turns across ~8 arc boundaries with nothing ever asking whether it should still exist.
// Owner ruling 2026-08-24: HARD WALL, no promotion path.
//
// The wall is deliberately NARROW, and most clauses below prove the narrowness rather than the
// sweep: a wall that eats spine quests or unstamped legacy quests would be far worse than no wall.
// Each clause must make dev/run-tests.js FAIL; a mutation changing no bytes is a hard failure.
// Usage: node dev/sabotage-231-arc-wall.js
var sabotage = require("./sabotage.js");
var rc = 0;

rc |= sabotage.prove({
  file: "tag_table.js",
  command: ["node", ["dev/run-tests.js"]],
  also: ["ui-modals.js"], /* #256: the History-label contract reads this ui shard; it is not in the engine manifest, so the working copy must ride into the clone or every clause misattributes */
  cases: [
    { label: "the sweep never runs — threads outlive their arc again (the 18-quest hydra returns)",
      mustFail: "THE WALL",
      find: '          if(!_wq.bornArc||String(_wq.bornArc).toLowerCase()!==String(_wallArc).toLowerCase())continue;',
      replace: '          if(true)continue;' },

    { label: "the bornArc match is dropped — the wall sweeps EVERY live quest, including other arcs' and legacy ones",
      mustFail: "the wall is NARROW",
      find: '          if(!_wq.bornArc||String(_wq.bornArc).toLowerCase()!==String(_wallArc).toLowerCase())continue;',
      replace: '          if(false)continue;' },

    { label: "offered progeny spared — an untaken hook survives its arc (the purest sprawl)",
      mustFail: "the offered hook outlived its arc",
      find: '          if(_wq.status!=="active"&&_wq.status!=="offered")continue;',
      replace: '          if(_wq.status!=="active")continue;' },

    { label: "walled threads archive as declined, not abandoned — the wrong archive class",
      /* #265 re-point: since #259 a DECLINED title also blocks |active, so the old force-reactivation
         test survives this mutation — the honest pin is the archive-status assertion itself. */
      mustFail: "archives its live emergent progeny as abandoned",
      find: 'status:"abandoned",turn:R.turn,by:"wall"',
      replace: 'status:"declined",turn:R.turn,by:"wall"' },

    // ── #256 — WHO abandoned it (JP0-3 part A) ────────────────────────────────────────
    { label: "#256: the wall stops signing its own sweeps — a wall-closed thread is indistinguishable from a player drop again",
      mustFail: "claims no author",
      find: 'turn:R.turn,by:"wall",wasOffered:_wq.status==="offered"',
      replace: 'turn:R.turn' },

    { label: "#256: the never-accepted hook loses wasOffered — a lapsed opportunity reads as a thread the player took and quit",
      mustFail: "indistinguishable from an accepted thread",
      find: 'wasOffered:_wq.status==="offered"',
      replace: 'wasOffered:false' },

    { label: "#256: the reopen guard goes back to hardcoding player agency for BOTH authors",
      mustFail: "calls a wall sweep the player's drop",
      find: 'R.muts.push("Quest \'"+qTitle+"\' "+_aw.phrase+" — not re-registered',
      replace: 'R.muts.push("Quest \'"+qTitle+"\' was abandoned by the player — not re-registered' },

    { label: "the emergent test is dropped at stamp time — a SPINE quest gets stamped and its own arc sweeps it",
      /* #265 re-point: stamping moved to the post-handler seam (deferred past arc transitions);
         the emergent test now lives there — dropping it stamps a spine quest exactly as before. */
      mustFail: "an emergent quest is stamped",
      find: 'if(typeof questIsEmergent==="function"&&questIsEmergent(qTitle)){if(!R._newQuests)R._newQuests=[];R._newQuests.push(qTitle);}',
      replace: 'if(typeof questIsEmergent==="function"){if(!R._newQuests)R._newQuests=[];R._newQuests.push(qTitle);}' },

    { label: "#265: the deferred stamp regresses to the dying arc — the seam reads the pre-close arc again",
      mustFail: "SAME response as the arc close survives",
      find: '  if(R._newQuests&&R._newQuests.length&&typeof questIsEmergent==="function"&&typeof currentArcTitle==="function"){',
      replace: '  if(false){' },

    // ── #233 — the act door (JP0-1, joint review 2026-08-27) ──────────────────────────
    { label: "#233: ACT_COMPLETE stops validating its operand — a hallucinated act name closes the running act again",
      mustFail: "a wrong act title mutates NOTHING",
      find: '      if(_cAct.title&&_cAct.title.toLowerCase()!==_at.toLowerCase()){',
      replace: '      if(false){' },

    { label: "#233: the live-arc refusal is dropped — an act closes over an active arc, orphaning its stamped progeny forever",
      mustFail: "REFUSED",
      find: '      if(_live.length){',
      replace: '      if(false){' },

    { label: "#233: the chain-close guard is dropped — tag 2 closes the arc tag 1 just activated, same response",
      mustFail: "chain-close",
      find: '    if(!_pre[_adk]){',
      replace: '    if(false){' },

    { label: "#233: the g-loop degrades to first-match — a parallel act closing two arcs sweeps only one",
      mustFail: "PARALLEL act closing two arcs",
      find: '    for(_ti=0;_ti<arcTags.length;_ti++){',
      replace: '    for(_ti=0;_ti<Math.min(1,arcTags.length);_ti++){' },

    { label: "#233: sequential advancement resurrects completed arcs again (the unconditional _sj+1 write)",
      mustFail: "RESURRECTS",
      find: '        if(!_act.parallel){for(var _nk=_sj+1;_nk<_act.arcs.length;_nk++){if(_act.arcs[_nk].status!=="pending")continue;',
      replace: '        if(!_act.parallel){for(var _nk=_sj+1;_nk<_act.arcs.length;_nk++){' },

    { label: "#234: the sweep stops arming the post-sweep note — the GM is never told the threads closed",
      mustFail: "sweep armed nothing",
      find: '          worldState.recentWallSweep.push({arc:_wallArc,titles:_walled.slice(0,8),turn:R.turn});',
      replace: '' }
  ]
});

rc |= sabotage.prove({
  file: "api.js",
  command: ["node", ["dev/run-tests.js"]],
  also: ["ui-modals.js"], /* #256: the History-label contract reads this ui shard; it is not in the engine manifest, so the working copy must ride into the clone or every clause misattributes */
  cases: [
    { label: "#234: the volatile CLOSED WITH THEIR ARC block never renders — the armed note reaches no prompt",
      mustFail: "armed sweep did not render",
      find: '  if(worldState.recentWallSweep&&worldState.recentWallSweep.length){',
      replace: '  if(false){' }
  ]
});

rc |= sabotage.prove({
  file: "game.js",
  command: ["node", ["dev/run-tests.js"]],
  also: ["ui-modals.js"], /* #256: the History-label contract reads this ui shard; it is not in the engine manifest, so the working copy must ride into the clone or every clause misattributes */
  cases: [
    { label: "#234: the 2-turn shelf never clears — the wall note nags forever",
      mustFail: "note survived past its shelf",
      find: '    if(worldState.recentWallSweep){worldState.recentWallSweep=worldState.recentWallSweep.filter(function(x){return (worldState.turn-x.turn)<2;});if(!worldState.recentWallSweep.length)worldState.recentWallSweep=null;}/* #234: the wall\'s post-sweep note rides the same shelf */',
      replace: '' }
  ]
});

rc |= sabotage.prove({
  file: "helpers.js",
  command: ["node", ["dev/run-tests.js"]],
  also: ["ui-modals.js"], /* #256: the History-label contract reads this ui shard; it is not in the engine manifest, so the working copy must ride into the clone or every clause misattributes */
  cases: [
    { label: "currentArcTitle guesses under ambiguity — a parallel act's quests get a fabricated parent",
      mustFail: "a parallel act guessed a parent",
      find: "  return live.length===1?live[0].title:null;",
      replace: "  return live.length?live[0].title:null;" },

    { label: "#256: a LEGACY record (no by) is reported as a player drop — the exact lie the field can never correct",
      mustFail: "given an author it never had",
      find: '  return {origin:"unknown",label:"abandoned",phrase:"was abandoned"};',
      replace: '  return {origin:"player",label:"abandoned by you",phrase:"was abandoned by you"};' },

    { label: "#256: the lapsed-offer reading collapses into the wall reading — a third semantic hides under one label again",
      mustFail: "lapsed-offer label wrong",
      find: '{origin:"lapsed",label:"opportunity lapsed",phrase:"lapsed with the arc that raised it"}',
      replace: '{origin:"wall",label:"closed with the arc",phrase:"closed with the arc that began it"}' }
  ]
});

rc |= sabotage.prove({
  file: "api.js",
  command: ["node", ["dev/run-tests.js"]],
  also: ["ui-modals.js"], /* #256: the History-label contract reads this ui shard; it is not in the engine manifest, so the working copy must ride into the clone or every clause misattributes */
  cases: [
    { label: "the pre-wall warning never fires — threads die with no notice to land them",
      mustFail: "warns BEFORE the wall",
      find: "  if(!doomed.length)return\"\";",
      replace: "  if(true)return\"\";" },

    { label: "the warning's cooldown is removed — it nags every single turn",
      mustFail: "no cooldown",
      find: "  if(last!=null&&(worldState.turn-last)<ARC_WALL_WARN_LEAD)return\"\";",
      replace: "" },

    { label: "#256: the player's own Abandon stops signing its record — the deliberate drop becomes anonymous",
      mustFail: "player abandon left no author stamp",
      find: 'status:"abandoned",turn:worldState.turn||0,by:"player"',
      replace: 'status:"abandoned",turn:worldState.turn||0' }
  ]
});

process.exit(rc ? 1 : 0);
