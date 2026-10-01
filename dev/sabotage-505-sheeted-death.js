// dev/sabotage-505-sheeted-death.js — proves the #505 guard is guarded. The #460 mood trim (a sheeted non-party NPC's
// mood is kept to what they are doing) ran BEFORE the death stamp, so [NPC:Bram|dead|…] on a former companion or any NPC
// with a generated sheet was trimmed to an empty mood and the death never landed — the standing death tag could not kill
// them. A death status now skips the trim. Each mutation runs in a disposable clone.
//   node dev/sabotage-505-sheeted-death.js
var sabotage = require("./sabotage.js");
var CMD = ["node", ["dev/run-tests.js", "#505"]];
process.exit(sabotage.prove({ file: "tag_table.js", command: CMD, cases: [
  { label: "the trim runs on a death again (the reported bug)",
    find: "if(!npcDeadStatus(npStatus)&&!_npN.partyMember&&_npN.charSheet&&", replace: "if(!_npN.partyMember&&_npN.charSheet&&",
    mustFail: "the repro" },
  { label: "the trim never runs (a death guard that also stops #460)",
    find: "if(!npcDeadStatus(npStatus)&&!_npN.partyMember&&_npN.charSheet&&", replace: "if(false&&!_npN.partyMember&&_npN.charSheet&&",
    mustFail: "disposition words are still dropped" },
  { label: "every NPC_DEAD_RE word skips the trim, so a mood such as 'dead tired' is no longer trimmed",
    find: "if(!npcDeadStatus(npStatus)&&!_npN.partyMember&&_npN.charSheet&&", replace: "if(!NPC_DEAD_RE.test(npStatus)&&!_npN.partyMember&&_npN.charSheet&&",
    mustFail: "disposition words are still dropped" }
]}) ? 1 : 0);
