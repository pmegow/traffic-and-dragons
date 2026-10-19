// dev/sabotage-649-companion-self-spells.js — proves #649's guards (the companion half of #644): a companion's lasting
// self-targeted cast files itself on THEIR sheet, only THAT companion's own [COMPANION_CONDITION:] suppresses it, a later GM
// entry merges through the one shared merge, and the long rest sweeps every LIVING party member — each must turn the
// mana-pool section red.
//   node dev/sabotage-649-companion-self-spells.js
var sabotage = require("./sabotage.js");
var CMD = ["node", ["dev/run-tests.js", "mana pool"]];
var code = 0;
function prove(file, cases) { if (!code) code = sabotage.prove({ file: file, command: CMD, cases: cases }); }
prove("tag_table.js", [
  { label: "the companion's cast no longer files its own condition",
    find: "spellSelfConditionFile(csuCs,csp,text,R,csum[1].trim());/* #649: their lasting self-spell lands on their sheet, as the hero's does */", replace: "",
    mustFail: "files itself on THEIR sheet" },
  { label: "the same-response skip reads every companion's tag — another companion's entry suppresses this one's filing",
    find: "if(_tw&&findCompanionChar(_tw[1])===sheet)tags.push(all[i]);", replace: "if(_tw)tags.push(all[i]);",
    mustFail: "are not hers" },
  { label: "a later GM entry naming the companion's engine-filed spell no longer merges (two entries again)",
    find: "var _cwas=conditionOwnSpellMerge(cCondCs.conditions,cCnm,cCdur,cCcause);if(_cwas!==null){", replace: "var _cwas=null;if(false){",
    mustFail: "the companion's effect on a LATER turn merges" }
]);
prove("helpers.js", [
  { label: "the rest sweep loops the hero only — companions keep their engine-filed entries through the night",
    find: "var p=(typeof livingPartyCompanions===\"function\")?livingPartyCompanions():[];for(i=0;i<p.length;i++){var f=restClearOwnSpellConditions(p[i].charSheet);", replace: "var p=[];for(i=0;i<p.length;i++){var f=restClearOwnSpellConditions(p[i].charSheet);",
    mustFail: "a long rest sweeps every party member's" },
  { label: "the dead are swept too — a fallen companion's sheet is touched by a rest",
    find: "livingPartyCompanions():[];for(i=0;i<p.length;i++){var f=restClearOwnSpellConditions(p[i].charSheet);", replace: "partyCompanionsWithSheets(true):[];for(i=0;i<p.length;i++){var f=restClearOwnSpellConditions(p[i].charSheet);",
    mustFail: "a dead companion gets nothing from a rest" }
]);
process.exit(code);
