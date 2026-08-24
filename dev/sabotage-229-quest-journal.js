// sabotage-229-quest-journal.js — mutation proof for the #229 quest-journal teeth.
//
// Three guards, each with a dedicated failing-first engine test; each clause below must make
// dev/run-tests.js FAIL, and a mutation that changes no bytes is itself a hard failure.
// ① the reopen guard's abandoned clause (tag_table.js) — without it the "active crises ARE
//    quests" channel force-reactivates the very goal the player just dropped;
// ② the volatile QUEST ABANDONED block (api.js) — without it the GM re-raises the goal
//    immediately and the disappearance is unexplained;
// ③ the 2-turn shelf clear (game.js) — without it the note injects forever.
// Usage: node dev/sabotage-229-quest-journal.js
var sabotage = require("./sabotage.js");
var rc = 0;

rc |= sabotage.prove({
  file: "tag_table.js",
  command: ["node", ["dev/run-tests.js"]],
  cases: [
    { label: "abandoned reopen clause removed — the GM can force-reactivate a player-dropped quest",
      mustFail: "abandoned title cannot be re-created",
      find: 'if(_arch&&_arch.status==="abandoned"&&qStat!=="offered"){',
      replace: 'if(false){' },
    { label: "the offered exemption widened away — an abandoned goal could never legally return",
      mustFail: "|offered may return",
      find: 'if(_arch&&_arch.status==="abandoned"&&qStat!=="offered"){',
      replace: 'if(_arch&&_arch.status==="abandoned"){' }
  ]
});

rc |= sabotage.prove({
  file: "api.js",
  command: ["node", ["dev/run-tests.js"]],
  cases: [
    { label: "the QUEST ABANDONED volatile block never renders",
      mustFail: "QUEST ABANDONED block renders",
      find: 'if(worldState.recentAbandon&&worldState.recentAbandon.length){var _abn=',
      replace: 'if(false){var _abn=' },
    { label: "abandonQuestState stops arming the note — the GM is never told the drop was deliberate",
      mustFail: "arms the 2-turn note",
      find: '      if(!worldState.recentAbandon)worldState.recentAbandon=[];\n      worldState.recentAbandon.push({title:q.title,turn:worldState.turn||0});',
      replace: '' }
  ]
});

rc |= sabotage.prove({
  file: "game.js",
  command: ["node", ["dev/run-tests.js"]],
  cases: [
    { label: "the 2-turn shelf clear removed — the abandoned note injects forever",
      mustFail: "expires the note on the 2-turn shelf",
      find: '    if(worldState.recentAbandon){worldState.recentAbandon=worldState.recentAbandon.filter(function(x){return (worldState.turn-x.turn)<2;});if(!worldState.recentAbandon.length)worldState.recentAbandon=null;}/* #229: same 2-turn shelf as recentlyLeft */',
      replace: '' }
  ]
});

process.exit(rc ? 1 : 0);
