// dev/sabotage-481-e1-mood-label.js — proves the #481 E1 guards are guarded: a labelled mood ("mood:bright, giggle", the form
// the GM has written since t202) keeps its words — the label is stripped at the ONE gate (sayMoodShape) before the cap and the
// shape test — and a dropped mood is SAID once per session with the count. Fable's named clause: "sabotage on the strip line".
// Each mutation runs in a disposable clone.
//   node dev/sabotage-481-e1-mood-label.js
var sabotage = require("./sabotage.js"), code = 0;
var CMD = ["node", ["dev/run-tests.js", "#96 [SAY:]"]];
function prove(file, cases) { if (!code) code = sabotage.prove({ file: file, command: CMD, cases: cases }); }
prove("helpers.js", [
  { label: "the strip line is gone (Fable's named clause: every labelled mood is dropped again)",
    find: "  s=s.replace(/^(?:mood|emotion|tone)\\s*[:=]\\s*/i,\"\");\n", replace: "",
    mustFail: "a labelled mood keeps its words" }
]);
prove("game.js", [
  { label: "a dropped mood is silent again (console only)",
    find: "  if(moodDrops&&!_sayMoodToasted&&typeof showToast===\"function\"){", replace: "  if(false){",
    mustFail: "a dropped mood is said once per session" },
  { label: "the toast repeats every narration",
    find: "{_sayMoodToasted=true;showToast(", replace: "{showToast(",
    mustFail: "a dropped mood is said once per session" }
]);
process.exit(code);
