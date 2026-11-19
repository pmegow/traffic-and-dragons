// Probe 3: do DISTINCT facts about one NPC fold because both repeat the NPC's own name (feNearDup counts name tokens)?
var L = require('C:/Projects/traffic-and-dragons/dev/load-engine.js');
L.loadEngine();
addMsg = function () { return {}; }; showToast = function () {};
var _i = console.info; console.info = function () {}; console.warn = function () {};
function out(l, v) { _i.call(console, l, JSON.stringify(v, null, 0)); }
L.makeTestWorld({ turn: 50 });
var facts = [
  "Mara Voss is the harbor master of Ashfen.",
  "Mara Voss distrusts the Thieves Guild.",
  "Mara Voss has a daughter named Elin.",
  "Mara Voss lost her left eye in the war.",
  "Mara Voss secretly smuggles black lotus.",
  "Mara Voss owes Korrag a life debt."
];
facts.forEach(function (f, i) { fileNpcKnowledge("Mara Voss", f, 50 + i, false); });
out("kept knowledge (" + memory.npcs["Mara Voss"].knowledge.length + " of " + facts.length + ")", memory.npcs["Mara Voss"].knowledge);
out("archived as folds", memArchive().npcKnowledge.map(function (a) { return a.fact + "  =>  " + a.foldedInto; }));
out("memoryNpcDetail", memoryNpcDetail("Mara Voss"));
out("feNearDup pair 1/2", feNearDup(facts[0], facts[1]));
out("feTokens 1", feTokens(facts[0])); out("feTokens 2", feTokens(facts[1]));
// same for lore lines about one named place
L.makeTestWorld({ turn: 50 });
["The Glass Spire was built by the elves.", "The Glass Spire hums at midnight.", "The Glass Spire is guarded by golems."].forEach(fileLore);
out("lore kept", memory.lore);
// one-word name control
L.makeTestWorld({ turn: 50 });
["Hemlock is the sheriff of Sandpoint.", "Hemlock distrusts the Thieves Guild.", "Hemlock has a daughter named Elin."].forEach(function (f) { fileNpcKnowledge("Hemlock", f, 50, false); });
out("one-word name kept", memory.npcs["Hemlock"].knowledge);
