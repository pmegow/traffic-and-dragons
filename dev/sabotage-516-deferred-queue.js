// dev/sabotage-516-deferred-queue.js — proves the #516 guard is guarded. recordRegisterGuard empties the deferred record
// queue (#481 C7) into the extraction before the extraction is validated; when validation then failed (a W6 identity
// failure), the extraction was discarded and the queued line was neither filed nor queued — lost. And lines the FAILED
// attempt deferred stayed queued, so a quarantined extraction leaked them into the next window. summarize() now restores
// the queue to its pre-attempt state on failure. Each mutation runs in a disposable clone.
//   node dev/sabotage-516-deferred-queue.js
var sabotage = require("./sabotage.js");
var CMD = ["node", ["dev/tests-516-deferred-queue.js"]];
process.exit(sabotage.prove({ file: "memory.js", command: CMD, cases: [
  { label: "a failed extraction no longer restores the queue (the reported loss)",
    find: "    if(_deferSnap){if(_deferSnap.length)worldState.recordDeferred=_deferSnap;else delete worldState.recordDeferred;}\n", replace: "",
    mustFail: "the repro" },
  { label: "a failed attempt's deferrals are kept when the queue was empty before it",
    find: "    if(_deferSnap){if(_deferSnap.length)worldState.recordDeferred=_deferSnap;else delete worldState.recordDeferred;}\n", replace: "    if(_deferSnap&&_deferSnap.length)worldState.recordDeferred=_deferSnap;\n",
    mustFail: "own deferrals are not kept" },
  { label: "the snapshot is taken after the guard, so it holds what the guard left",
    find: "    _deferSnap=(worldState&&Array.isArray(worldState.recordDeferred))?worldState.recordDeferred.slice():[];\n    await recordRegisterGuard(extracted,worldState.turn);",
    replace: "    await recordRegisterGuard(extracted,worldState.turn);_deferSnap=(worldState&&Array.isArray(worldState.recordDeferred))?worldState.recordDeferred.slice():[];",
    mustFail: "the repro" }
]}) ? 1 : 0);
