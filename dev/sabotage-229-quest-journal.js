// sabotage-229-quest-journal.js — mutation proof for the #229 quest-journal teeth.
//
// The journal guards each have a dedicated failing-first engine/source test; each clause below must make
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
  file: "ui-modals.js",
  command: ["node", ["dev/run-tests.js", "quest journal busy gate"]],
  cases: [
    { label: "joint f19: the shared journal gate stops checking the in-flight turn latch",
      mustFail: "shared gate or quiet toast missing",
      find: 'function _questJournalBusy(){if(typeof busy!=="undefined"&&busy){',
      replace: 'function _questJournalBusy(){if(false){' },
    { label: "joint f19: Accept bypasses the journal gate and can race the committing response",
      mustFail: "acceptQuest can still mutate while busy",
      find: 'function acceptQuest(title){\n  if(_questJournalBusy())return;',
      replace: 'function acceptQuest(title){' },
    { label: "joint f19: Decline bypasses the journal gate and can race the committing response",
      mustFail: "declineQuest can still mutate while busy",
      find: 'function declineQuest(title){\n  if(_questJournalBusy())return;',
      replace: 'function declineQuest(title){' },
    { label: "joint f19: Abandon opens its mutation confirmation during an in-flight turn",
      mustFail: "_confirmAbandonQuest can still mutate while busy",
      find: 'function _confirmAbandonQuest(title){\n  if(_questJournalBusy())return;',
      replace: 'function _confirmAbandonQuest(title){' },
    { label: "joint f19: Suggest completion drifts back to a separate authorization path",
      mustFail: "Suggest completion does not share the journal gate",
      find: '    if(_questJournalBusy())return;\n    modal.remove();suggestQuestCompletion',
      replace: '    modal.remove();suggestQuestCompletion' }
  ]
});

rc |= sabotage.prove({
  file: "tag_table.js",
  command: ["node", ["dev/run-tests.js"]],
  cases: [
    { label: "abandoned reopen clause removed — the GM can force-reactivate a player-dropped quest",
      mustFail: "abandoned title cannot be re-created",
      find: 'if(_arch&&(_arch.status==="abandoned"||_arch.status==="declined")&&qStat!=="offered"){',/* #259 widened the clause to declined (ruling 2026-08-28) */
      replace: 'if(false){' },
    { label: "the offered exemption widened away — an abandoned goal could never legally return",
      mustFail: "|offered may return",
      find: 'if(_arch&&(_arch.status==="abandoned"||_arch.status==="declined")&&qStat!=="offered"){',
      replace: 'if(_arch&&(_arch.status==="abandoned"||_arch.status==="declined")){' },

    // ── #259 — the quest state machine (JP0-3b, rulings 2026-08-28) ──────────────
    { label: "#259: the status whitelist dies — improvised statuses mint zombie rows again",
      mustFail: "creates NO zombie row",
      find: '  if(qStat!=="offered"&&qStat!=="active"&&qStat!=="completed"&&qStat!=="failed"){',
      replace: '  if(false){' },

    { label: "#259: |declined quietly becomes FAILED again — the GM closes a quest the player never touched",
      mustFail: "no longer silently becomes FAILED",
      find: '  if(qStat==="declined"){',
      replace: '  if(qStat==="declined"){qStat="failed";}if(false){' },

    { label: "#259: the guard narrows back to abandoned-only — a DECLINED title force-reactivates",
      mustFail: "DECLINED title cannot return as active",
      find: 'if(_arch&&(_arch.status==="abandoned"||_arch.status==="declined")&&qStat!=="offered"){',
      replace: 'if(_arch&&_arch.status==="abandoned"&&qStat!=="offered"){' },

    { label: "#259: the reoffer teeth are pulled — a same-response offered+active pair defeats the player gate",
      mustFail: "NOT player consent",
      find: '    if(qStat==="active"&&worldState.questLog[qIdx].reofferedTurn===R.turn){',
      replace: '    if(false){' }
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
