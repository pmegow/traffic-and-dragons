// dev/sabotage-481-b5-left-side.js — proves the #481 B5 guards are guarded: a bare "left" is a side, not a departure. Two
// independent guards, each with its own negative: the departure COMPLEMENT ("left the", "left for", "has left" — not
// "left-handedly") and the aux-only GAP (a noun before "left" is that noun's verb — "the mule left the yard"). Each mutation
// runs in a disposable clone.
//   node dev/sabotage-481-b5-left-side.js
var sabotage = require("./sabotage.js"), code = 0;
var CMD = ["node", ["dev/run-tests.js", "#481 B5"]];
function prove(file, cases) { if (!code) code = sabotage.prove({ file: file, command: CMD, cases: cases }); }
prove("helpers.js", [
  { label: "a bare left is a departure again (no complement needed)",
    find: "|leaves|left(?=\\s+(?:the|for)\\b)|(?:has|had)\\s+left\\b|", replace: "|leaves|left|(?:has|had)\\s+left\\b|",
    mustFail: "the six field lines are no separation" },
  { label: "a noun's own left counts for the name before it (the gap check is gone)",
    find: "    if(vm&&/\\bleft\\b/i.test(vm[0].slice(vm[1].length))&&!/^\\s*(?:(?:has|had|just|already|quietly|finally|then|now|silently|abruptly|simply|soon|,)\\s*)*$/i.test(vm[1]))vm=null;\n", replace: "",
    mustFail: "the six field lines are no separation" },
  { label: "a real departure with a complement is missed",
    find: "|leaves|left(?=\\s+(?:the|for)\\b)|(?:has|had)\\s+left\\b|", replace: "|leaves|",
    mustFail: "a real departure still counts" }
]);
process.exit(code);
