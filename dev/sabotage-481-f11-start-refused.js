// dev/sabotage-481-f11-start-refused.js — proves the #481 F11 guards are guarded: campNew says whether it reset, the Home
// chooser stops on a refused reset before it consumes the pick, and the quick start runs its transient refusals (a turn in
// flight, storage full) before it consumes its payload. Each mutation runs in a disposable clone.
//   node dev/sabotage-481-f11-start-refused.js
var sabotage = require("./sabotage.js"), code = 0;
var CMD = ["node", ["dev/tests-481-f11-start-refused.js"]];
function prove(file, cases) { if (!code) code = sabotage.prove({ file: file, command: CMD, cases: cases }); }
prove("ui-campaigns.js", [
  { label: "a storage refusal returns nothing",
    find: "  if(!snapshotActiveCamp())return false;/* B4: storage full", replace: "  if(!snapshotActiveCamp())return;/* B4: storage full",
    mustFail: "campNew says whether it reset" },
  { label: "a reset returns nothing (the chooser would then refuse every Start)",
    find: "  showChar();\n  return true;\n}", replace: "  showChar();\n}",
    mustFail: "campNew says whether it reset" }
]);
prove("ui-browsers.js", [
  { label: "the chooser ignores a refused reset and consumes the pick",
    find: "  if(typeof campNew===\"function\"&&!campNew())return \"failed\";", replace: "  if(typeof campNew===\"function\")campNew();",
    mustFail: "the repro" },
  { label: "the quick start consumes its payload before its busy / storage guards",
    find: "  if(typeof busy!==\"undefined\"&&busy){showToast(\"Finish the current turn first.\");return false;}\n  if(worldState&&!snapshotActiveCamp())return false;/* B4: never wipe", replace: "  consume();\n  if(typeof busy!==\"undefined\"&&busy){showToast(\"Finish the current turn first.\");return false;}\n  if(worldState&&!snapshotActiveCamp())return false;/* B4: never wipe",
    mustFail: "a quick start refused" }
]);
process.exit(code);
