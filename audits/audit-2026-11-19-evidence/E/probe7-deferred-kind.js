// Probe 7: a SCENE-kind knowledge line deferred past the re-ask cap comes back as DURABLE Knows.
var L = require('C:/Projects/traffic-and-dragons/dev/load-engine.js');
L.loadEngine();
addMsg = function () { return {}; }; showToast = function () {};
console.info = function () {}; var _w = console.warn; console.warn = function () {};
L.makeTestWorld({ turn: 80 });
memory.npcs["Mara Voss"] = { attitude: "", knowledge: [], events: [], aliases: [] };
console.log("registerScan('kept a ledger'):", JSON.stringify(registerScan("she kept a ledger")));
var ups = [];
for (var i = 0; i < 7; i++) ups.push({ name: "Mara Voss", knowledgeGained: { fact: "Mara Voss stood by the ledger desk " + i + " at the moment", kind: "scene" } });
var ex1 = { npcUpdates: ups };
var dirtyEcho = function (p) { return Promise.resolve("still the ledger"); }; // every rewrite stays dirty -> dropped
(async function () {
  await recordRegisterGuard(ex1, 80, dirtyEcho);
  console.log("deferred queue:", JSON.stringify(worldState.recordDeferred));
  var clean = function () { return Promise.resolve("Mara Voss stood by the counting desk at the moment"); };
  var ex2 = { npcUpdates: [] };
  await recordRegisterGuard(ex2, 81, clean);
  console.log("next window's npcUpdates after the deferred line was cleaned:", JSON.stringify(ex2.npcUpdates));
  applySummaryExtract(ex2);
  console.log("Mara knowledge (durable):", JSON.stringify(memory.npcs["Mara Voss"].knowledge));
  console.log("Mara events (scene history):", JSON.stringify(memory.npcs["Mara Voss"].events));
})().catch(function (e) { console.log("threw", e && e.stack); });
