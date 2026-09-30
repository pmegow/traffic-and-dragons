// dev/sabotage-481-b7-hero-roster.js — proves the #481 B7 guard: the player check runs BEFORE the roster check in
// presenceObserve, so the hero named in every cast never prints the per-turn "not on the roster" line that buried the
// [motif] line #469 reads. The mutation runs in a disposable clone.
//   node dev/sabotage-481-b7-hero-roster.js
var sabotage = require("./sabotage.js");
process.exit(sabotage.prove({ file: "identity.js", command: ["node", ["dev/run-tests.js", "#481 B7"]], cases: [
  { label: "the roster check runs first again (the hero is 'not on the roster' every turn)",
    find: "  if(typeof memoryNpcIsPlayer===\"function\"&&memoryNpcIsPlayer(canon))return false;/* the PC is not an NPC — checked FIRST",
    replace: "  if(false)return false;/* the PC is not an NPC — checked FIRST",
    mustFail: "the hero named in a cast is refused quietly" }
]}));
