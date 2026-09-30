// dev/sabotage-481-d10-replace-owed.js — proves the #481 D10 guards are guarded: replacing the hero from the library clears
// the OLD sheet's owed level-up choices and its pending delete-marks. Each mutation runs in a disposable clone.
//   node dev/sabotage-481-d10-replace-owed.js
var sabotage = require("./sabotage.js"), code = 0;
var CMD = ["node", ["dev/run-tests.js", "#428"]];
function prove(file, cases) { if (!code) code = sabotage.prove({ file: file, command: CMD, cases: cases }); }
prove("game.js", [
  { label: "the old sheet's owed choices ride into the copy",
    find: "  if(worldState.levelUpOwed)delete worldState.levelUpOwed[hero.name];\n", replace: "",
    mustFail: "#481 D10 replacing the hero" },
  { label: "the old pack's delete-marks survive the replace",
    find: "  if(typeof invDropMarksForget===\"function\")invDropMarksForget(\"\");\n", replace: "",
    mustFail: "#481 D10 replacing the hero" }
]);
prove("ui-sheets.js", [
  { label: "forgetting the marks forgets nothing",
    find: "function invDropMarksForget(owner){if(_invDropMarks&&_invDropMarks.by)delete _invDropMarks.by[owner];}", replace: "function invDropMarksForget(owner){}",
    mustFail: "#481 D10 replacing the hero" }
]);
process.exit(code);
