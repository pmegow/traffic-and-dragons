// dev/sabotage-513-arrival-frame.js — proves the #513 guard is guarded. The scene frame turned over only when someone was
// observed in a reply or the next prompt was built, and the next send builds its engine notes first: after a silent arrival
// "who is here" still read the departed scene, so any old sighting at the new place counted as present (the Village's SMALL
// TALK note asked absent residents to greet the hero; the buttons offered them). derivePresenceFromResponse now turns the
// frame over where the reply ends. Each mutation runs in a disposable clone.
//   node dev/sabotage-513-arrival-frame.js
var sabotage = require("./sabotage.js");
var CMD = ["node", ["dev/run-tests.js", "#513"]];
process.exit(sabotage.prove({ file: "identity.js", command: CMD, cases: [
  { label: "the frame waits for the next prompt again (the reported stale scene)",
    find: '  if(worldState.sceneRefs&&typeof sceneRefsEnsure==="function")sceneRefsEnsure();\n}', replace: "}",
    mustFail: "the repro" },
  { label: "a reply gives scene refs to a world that never had them",
    find: '  if(worldState.sceneRefs&&typeof sceneRefsEnsure==="function")sceneRefsEnsure();\n}', replace: '  if(typeof sceneRefsEnsure==="function")sceneRefsEnsure();\n}',
    mustFail: "a world without scene refs" }
]}) ? 1 : 0);
