// dev/sabotage-660-dice-record.js — proves the #660 guards on the dice record's FILING: the DICE handler reads a stated
// form's total after its last "=" (never the digits mashed together), and the record the continuation carries — applied
// one turn after the click filed it — is the player's own roll, skipped with one turn's tolerance and the label's case,
// never a second faceless GM entry. Each reversal must turn the #660 section red.
//   node dev/sabotage-660-dice-record.js
var sabotage = require("./sabotage.js");
var CMD = ["node", ["dev/run-tests.js", "#660"]];
var code = 0;
function prove(file, cases) { if (!code) code = sabotage.prove({ file: file, command: CMD, cases: cases }); }
prove("helpers.js", [
  { label: "the total is the digits mashed together again (a stated form files 201922112)",
    find: 'm=(eq>=0?s.slice(eq+1):s).match(/-?\\d+/)', replace: 'm=s.replace(/[^-\\d]/g,"").match(/-?\\d+/)' }
]);
prove("tag_table.js", [
  { label: "the echo skip demands the same turn again (the continuation's record files as a GM roll)",
    find: "R.turn-last.t>=0&&R.turn-last.t<=1", replace: "last.t===R.turn" },
  { label: "the echo skip is case-exact again",
    find: "String(last.label).toLowerCase()===label.toLowerCase()", replace: "last.label===label" }
]);
process.exit(code);
