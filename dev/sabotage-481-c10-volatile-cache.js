// dev/sabotage-481-c10-volatile-cache.js — proves the #481 C10 gate is guarded both ways: the per-turn (volatile) block
// carries a cache breakpoint only when the separate suggestion call will read it (in-band buttons OFF). Each mutation runs
// in a disposable clone.
//   node dev/sabotage-481-c10-volatile-cache.js
var sabotage = require("./sabotage.js");
process.exit(sabotage.prove({ file: "globals.js", command: ["node", ["dev/run-tests.js", "prompt caching split"]], cases: [
  { label: "every turn writes the volatile again (the gate is gone)",
    find: "var _volC=(typeof suggestInband===\"undefined\"||!suggestInband);", replace: "var _volC=true;",
    mustFail: "#481 C10 anthropic buildBody with in-band buttons ON" },
  { label: "the volatile is never cached, even when the suggestion call reads it every turn",
    find: "var _volC=(typeof suggestInband===\"undefined\"||!suggestInband);", replace: "var _volC=false;",
    mustFail: "amended by #481 C10" }
]}));
