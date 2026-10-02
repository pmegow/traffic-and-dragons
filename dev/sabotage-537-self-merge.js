// dev/sabotage-537-self-merge.js — proves the #537 guard is guarded. [NPC_MERGE:Bram|Bram] without scene refs ran the fold on
// one record: it iterated the duplicate's events while pushing onto the same array ("Invalid array length" after a hundred
// million entries) and its tail deleted the record. A self-merge is now ignored, loudly. The mutation runs in a disposable
// clone; it reproduces the runaway, so the run takes a few seconds and a lot of memory.
//   node dev/sabotage-537-self-merge.js
var sabotage = require("./sabotage.js");
var CMD = ["node", ["dev/run-tests.js", "#537"]];
process.exit(sabotage.prove({ file: "tag_table.js", command: CMD, cases: [
  { label: "a self-merge runs the fold again (the runaway and the deletion)",
    find: 'if(mgCanon===mgDupe){/* #537', replace: 'if(false){/* #537',
    mustFail: "#537 the repro" },
  { label: "a self-merge is ignored without a word",
    find: "R.muts.push(\"⚠ NPC merge ignored: '\"+mgDupe+\"' into itself\");continue;}", replace: "continue;}",
    mustFail: "#537 the repro" }
] }) ? 1 : 0);
