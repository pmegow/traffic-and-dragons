// dev/sabotage-371-stake.js — proves the #371 stake clause and the rolled-outcome ratio are guarded.
//   node dev/sabotage-371-stake.js
var sabotage = require("./sabotage.js");
var rc1 = sabotage.prove({
  file: "api.js",
  command: ["node", ["dev/run-tests.js", "#371"]],
  cases: [
    { label: "the switch is ignored — the clause rides even when it is off (no rollback)",
      find: 'return (typeof diceStakeClause!=="undefined"&&diceStakeClause)?" Before any roll,', replace: 'return (true)?" Before any roll,' },
    { label: "the clause is dropped from the GM-rolls contract",
      find: '[DICE:Dexterity check|8|failed]"+diceStakeText()+diceFloorText(false)+"', replace: '[DICE:Dexterity check|8|failed]"+""+diceFloorText(false)+"' }/* B45: the floor now rides behind the clause at this splice */
  ]
});
var rc2 = sabotage.prove({
  file: "helpers.js",
  command: ["node", ["dev/run-tests.js", "#371"]],
  cases: [
    { label: "failures stop counting — the ratio can never warn",
      find: 'else if(/fail|miss/.test(o)){filed++;f++;}', replace: '' },
    { label: "the warn threshold is dropped — ten straight successes read ok",
      find: '(dr.failures===0&&dr.filed>=8)?"warn":"ok"', replace: '"ok"' }
  ]
});
process.exit(rc1 || rc2);
