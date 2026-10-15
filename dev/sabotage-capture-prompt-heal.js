// dev/sabotage-capture-prompt-heal.js — proves the capture tool's load heal is guarded (Thursday review 2026-10-15, rung 3):
// with the heal mutated out, a save whose current world is stored unvisited captures as KNOWN OF, and the suite must say so.
//   node dev/sabotage-capture-prompt-heal.js
var sabotage = require("./sabotage.js");
var CMD = ["node", ["dev/tests-capture-prompt-heal.js"]];
process.exit(sabotage.prove({ file: "dev/capture-prompt.js", command: CMD, cases: [
  { label: "the capture skips the game's load heal again (a healed-at-load save captures as the game never serves it)",
    find: "if(typeof healMemory===\"function\")healMemory();/* the memory heal first, as loadState runs it */\n", replace: "",
    mustFail: "the load heal did not run" }
] }));
