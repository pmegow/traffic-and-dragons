// dev/sabotage-339-class-coverage.js — proves the #339 class-bible coverage guard bites.
// Deleting a single capability entry that a class-bible feature depends on must turn the suite RED;
// a guard that stays green over a missing entry is the fill-phase-languish class coming back
// (CLAUDE.md guardrail rule 2: a mutation that changes nothing is a FAILURE).
//
//   node dev/sabotage-339-class-coverage.js
var sabotage = require("./sabotage.js");
process.exit(sabotage.prove({
  file: "capability_bible.js",
  command: ["node", ["dev/run-tests.js"]],
  cases: [
    { label: "drop the Cleric's 'the blessing holds' (the owner's field report)",
      find: /\n  "the blessing holds":\{[^\n]*\},?/, replace: "" },
    { label: "drop the shared 'extra attack' (three classes lean on one entry)",
      find: /\n  "extra attack":\{[^\n]*\},?/, replace: "" },
    { label: "rename a Necromancer archetype entry so the base-name lookup misses",
      find: '"soul puppet":{', replace: '"soul puppets":{' }
  ]
}));
