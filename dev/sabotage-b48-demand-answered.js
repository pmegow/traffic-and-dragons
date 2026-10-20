// dev/sabotage-b48-demand-answered.js — proves B48's guards (a demand made of the player is the player's to answer): the money
// note's stop at the demand, the rule's mirror clause and its carve-out for a payment the player typed must each turn the B48
// section red.
//   node dev/sabotage-b48-demand-answered.js
var sabotage = require("./sabotage.js");
var CMD = ["node", ["dev/run-tests.js", "B48"]];
var code = 0;
function prove(file, cases) { if (!code) code = sabotage.prove({ file: file, command: CMD, cases: cases }); }
prove("api.js", [
  { label: "the money note no longer stops at the demand (the GM settles it again)",
    find: "Stage the demand and END the response at the demand: put pay / refuse / fight among the [SUGGEST:] buttons, never narrate the hero's answer, their words of acceptance, or coin leaving the purse \\u2014 the player decides. ", replace: "",
    mustFail: "the note must end the response at the demand" }
]);
prove("data.js", [
  { label: "the rule's mirror clause loses its force — a demand is no longer the player's to answer",
    find: "is ANSWERED BY THE PLAYER, never by you.", replace: "is answered by the player.",
    mustFail: "nothing says a demand is the player's to answer" },
  { label: "the carve-out for a payment the player typed is gone (the Currency rule's meals and alms become hard stops)",
    find: "; a payment the player themselves typed is theirs to make.", replace: ".",
    mustFail: "a spend the player typed must stay legal" }
]);
process.exit(code);
