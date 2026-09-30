// dev/sabotage-481-c11-prompt-text.js — proves the #481 C11 guards are guarded. Part 1 (stable text and notes): the village
// substitutes the crisis rule in its slot, the kind's tag-doc note ends its own line, and the presence/separation notes
// answer with [NO_CHANGE]. Each mutation runs in a disposable clone.
//   node dev/sabotage-481-c11-prompt-text.js
var sabotage = require("./sabotage.js"), code = 0;
var CMD = ["node", ["dev/run-tests.js", "#481 C11"]];
function prove(file, cases) { if (!code) code = sabotage.prove({ file: file, command: CMD, cases: cases }); }
prove("data.js", [
  { label: "the village serves the adventure's crisis rule again",
    find: "    ruleOverrides:{\"ACTIVE CRISES ARE QUESTS TOO\":\"GOALS THE PLAYER TAKES ON ARE QUESTS", replace: "    ruleOverrides:{\"ACTIVE CRISES ARE QUESTS TOO (unmatched)\":\"GOALS THE PLAYER TAKES ON ARE QUESTS",
    mustFail: "the village's stable half" }
]);
prove("tag_table.js", [
  { label: "the kind's tag-doc note glues onto the next section again",
    find: "return out.join(\"\")+(_tdn&&!/\\n$/.test(_tdn)?_tdn+\"\\n\":_tdn);", replace: "return out.join(\"\")+_tdn;",
    mustFail: "the village's stable half" }
]);
prove("api.js", [
  { label: "the presence check says 'emit nothing' again",
    find: "If everyone listed is genuinely present, emit [NO_CHANGE].]\";", replace: "If everyone listed is genuinely present, emit nothing.]\";",
    mustFail: "answer with [NO_CHANGE]" },
  { label: "the separation note's [NO_CHANGE] is no registered ack",
    find: "ack:[\"PARTY_SPLIT\",\"NO_CHANGE\"]},/* #481 C11 */\n  buildPlayerSplitNudge", replace: "ack:[\"PARTY_SPLIT\"]},/* #481 C11 */\n  buildPlayerSplitNudge",
    mustFail: "answer with [NO_CHANGE]" }
]);
process.exit(code);
