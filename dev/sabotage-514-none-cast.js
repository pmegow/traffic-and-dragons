// dev/sabotage-514-none-cast.js — proves the #514 guards are guarded (owner ruling 2026-10-01: "none" clears the room).
// [SCENE_CAST:none] used to change nothing, so someone named in an earlier cast stayed "in the scene" for as long as the
// party stayed put, though the doc tells the GM that none means "the whole party is here and no one else". A none-only
// cast is now recorded as the party alone, and scenePresentNow leaves out everyone last seen before it. A speaker of
// that same reply is still placed (every real none sits in the reply's header, before the prose where they speak).
// Each mutation runs in a disposable clone.
//   node dev/sabotage-514-none-cast.js
var sabotage = require("./sabotage.js");
var CMD = ["node", ["dev/run-tests.js", "#514"]];
process.exit(sabotage.prove({ file: "identity.js", command: CMD, cases: [
  { label: "none changes nothing again (the reported bug)",
    find: "  else if(/\\[SCENE_CAST:\\s*none\\s*\\]/i.test(text)){", replace: "  else if(false){",
    mustFail: "the repro" },
  { label: "the none cast is recorded without the party",
    find: "node:locResolve(currentNodeKey()),names:_nn,none:true};}", replace: "node:locResolve(currentNodeKey()),names:[],none:true};}",
    mustFail: "the repro" },
  { label: "the none cast is not marked as one",
    find: "node:locResolve(currentNodeKey()),names:_nn,none:true};}", replace: "node:locResolve(currentNodeKey()),names:_nn};}",
    mustFail: "the repro" },
  { label: "the none cast is recorded at no place, so it clears nobody",
    find: "node:locResolve(currentNodeKey()),names:_nn,none:true};}", replace: "node:null,names:_nn,none:true};}",
    mustFail: "the repro" },
  { label: "the none cast is stamped at turn 0, so it clears nobody",
    find: "    worldState.castLast={turn:(R&&R.turn!=null)?R.turn:worldState.turn,node:locResolve(currentNodeKey()),names:_nn,", replace: "    worldState.castLast={turn:0,node:locResolve(currentNodeKey()),names:_nn,",
    mustFail: "the repro" },
  { label: "a speaker of the none reply itself is withheld (the header-cast case)",
    find: "    worldState.castLast={turn:(R&&R.turn!=null)?R.turn:worldState.turn,node:locResolve(currentNodeKey()),names:_nn,", replace: "    castCanon={};worldState.castLast={turn:(R&&R.turn!=null)?R.turn:worldState.turn,node:locResolve(currentNodeKey()),names:_nn,",
    mustFail: "speaks in the none reply itself is placed" }
]}) ? 1 : 0);
