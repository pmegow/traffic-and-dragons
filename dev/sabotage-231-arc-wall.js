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

    { label: "walled threads archive as declined, not abandoned — the #229 reopen guard stops protecting them",
      mustFail: "cannot be force-reactivated",
      find: 'status:"abandoned",turn:R.turn};\n          worldState.questLog.splice(_wk,1);',
      replace: 'status:"declined",turn:R.turn};\n          worldState.questLog.splice(_wk,1);' },

    { label: "the emergent test is dropped at stamp time — a SPINE quest gets stamped and its own arc sweeps it",
      mustFail: "an emergent quest is stamped",
      find: 'if(typeof questIsEmergent==="function"&&questIsEmergent(qTitle)&&typeof currentArcTitle==="function")',
      replace: 'if(typeof currentArcTitle==="function")' }
  ]
});

rc |= sabotage.prove({
  file: "helpers.js",
  command: ["node", ["dev/run-tests.js"]],
  cases: [
    { label: "currentArcTitle guesses under ambiguity — a parallel act's quests get a fabricated parent",
      mustFail: "a parallel act guessed a parent",
      find: "  return live.length===1?live[0].title:null;",
      replace: "  return live.length?live[0].title:null;" }
  ]
});

rc |= sabotage.prove({
  file: "api.js",
  command: ["node", ["dev/run-tests.js"]],
  cases: [
    { label: "the pre-wall warning never fires — threads die with no notice to land them",
      mustFail: "warns BEFORE the wall",
      find: "  if(!doomed.length)return\"\";",
      replace: "  if(true)return\"\";" },

    { label: "the warning's cooldown is removed — it nags every single turn",
      mustFail: "no cooldown",
      find: "  if(last!=null&&(worldState.turn-last)<ARC_WALL_WARN_LEAD)return\"\";",
      replace: "" }
  ]
});

process.exit(rc ? 1 : 0);
