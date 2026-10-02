// dev/sabotage-506-mood-conditions.js — proves the #506 guards are guarded (owner ruling 2026-10-01: keep conditions, but
// not in the Village). The #460 trim keeps a sheeted non-party character's status to what they are doing; it also dropped
// CONDITIONS ("unconscious", "captured"), so the roster never told the GM and it could play them free the next turn. In a
// kind with moodConditions (the adventure) a part naming a condition now survives; the Village stays doing-only.
// Each mutation runs in a disposable clone.
//   node dev/sabotage-506-mood-conditions.js
var sabotage = require("./sabotage.js");
var CMD = ["node", ["dev/run-tests.js", "#506"]];
var code = 0;
function prove(file, cases) { if (!code) code = sabotage.prove({ file: file, command: CMD, cases: cases }); }
var REPRO = "the repro", LIST = "every condition on the ruled list", VILLAGE = "the Village stays doing-only";
prove("helpers.js", [
  { label: "conditions are dropped again (the reported gap)",
    find: "||(keepConditions&&MOOD_CONDITION_RE.test(p)))out.push(p);}", replace: ")out.push(p);}",
    mustFail: REPRO },
  { label: "the trim keeps conditions whatever the caller says",
    find: "||(keepConditions&&MOOD_CONDITION_RE.test(p)))out.push(p);}", replace: "||MOOD_CONDITION_RE.test(p))out.push(p);}",
    mustFail: VILLAGE },
  { label: "'sick of your excuses' counts as a condition",
    find: "\"sick(?!\\\\s+of\\\\b)\",", replace: "\"sick\",",
    mustFail: LIST },
  { label: "a ruled condition leaves the list",
    find: "\"asleep\",\"captured\",\"captive\",", replace: "\"asleep\",\"captive\",",
    mustFail: LIST }
]);
prove("tag_table.js", [
  { label: "the [NPC:] handler never asks for conditions",
    find: "var _mdo=moodDoingOnly(npStatus,!!(typeof kindDef===\"function\"&&kindDef().moodConditions));", replace: "var _mdo=moodDoingOnly(npStatus);",
    mustFail: REPRO },
  { label: "the [NPC:] handler keeps conditions in every kind, the Village too",
    find: "var _mdo=moodDoingOnly(npStatus,!!(typeof kindDef===\"function\"&&kindDef().moodConditions));", replace: "var _mdo=moodDoingOnly(npStatus,true);",
    mustFail: VILLAGE }
]);
prove("data.js", [
  { label: "the Village keeps conditions (against the ruling)",
    find: "    moodConditions:false,/* #506", replace: "    moodConditions:true,/* #506",
    mustFail: VILLAGE },
  { label: "the adventure drops them",
    find: "smallTalk:false,moodConditions:true,/* #506", replace: "smallTalk:false,moodConditions:false,/* #506",
    mustFail: REPRO }
]);
process.exit(code ? 1 : 0);
