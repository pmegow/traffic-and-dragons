// dev/sabotage-481-e8-held-transport.js — proves the #481 E8 guards are guarded: while a spoken "pause" holds Car Mode, all
// four Media Session commands are no-ops, each landing a "media-action <kind> held" crumb even right after a crumb of the same
// command (the rate window coalesces a repeat, never a state change). Each mutation runs in a disposable clone.
// The real-game check is dev/car-driver.js (manual QA): at the pre-fix code it failed 8 expectations.
//   node dev/sabotage-481-e8-held-transport.js
var sabotage = require("./sabotage.js");
process.exit(sabotage.prove({ file: "ui-carmode.js", command: ["node", ["dev/tests-19b-carmode-transport.js"]], cases: [
  { label: "the transport ignores the hold (a held PLAY replays)",
    find: "  if (state === \"held\") return \"held\";\n", replace: "",
    mustFail: "the repro" },
  { label: "the state reader forgets the hold",
    find: "  if (_carHeld) return \"held\";   /* #481 E8:", replace: "  /* #481 E8:",
    mustFail: "the repro" },
  { label: "the crumb window coalesces a state change (a held PLAY right after a playing one goes unrecorded)",
    find: "var now = Date.now(), key = kind + \" \" + state;", replace: "var now = Date.now(), key = kind;",
    mustFail: "while held, all four commands" }
]}));
