// The summary-extraction path (applySummaryExtract, memory.js) with every spelling of the player identity.
require("./common.js");
P("version", ver());
function spellings(h, ep) { return [["sheet", h], ["UPPER", h.toUpperCase()], ["padded", "  " + h + " "], ["player", "player"], ["Player", "Player"], ["epithet", ep], ["EPITHET", ep.toUpperCase()]]; }
function snap(h, ep) {
  var out = [];
  var mk = Object.keys(memory.npcs).filter(function (k) { return memoryNpcIsPlayer(k); }); if (mk.length) out.push("memory record " + JSON.stringify(mk) + " " + JSON.stringify(memory.npcs[mk[0]]).slice(0, 160));
  var rk = worldState.npcs.filter(function (n) { return n && memoryNpcIsPlayer(n.name); }).map(function (n) { return n.name; }); if (rk.length) out.push("roster row " + JSON.stringify(rk));
  if (!memory.npcs.Bram || !wsNpcByName("Bram")) out.push("Bram gone");
  if (wsNpcByName("Bram") && wsNpcByName("Bram").dead) out.push("Bram dead");
  if ((worldState.pendingMergeHints || []).length) out.push("merge hint " + JSON.stringify(worldState.pendingMergeHints));
  return out;
}
var SHAPES = [
  ["npcUpdates durable", function (n) { return { npcUpdates: [{ name: n, attitude: "wary", knowledgeGained: "carries a debt" }] }; }],
  ["npcUpdates scene", function (n) { return { npcUpdates: [{ name: n, knowledgeGained: { fact: "stood at the gate", kind: "scene" } }] }; }],
  ["npcDeaths", function (n) { return { npcDeaths: [n] }; }],
  ["supersededFacts", function (n) { return { supersededFacts: [{ name: n, old: "x", "new": "y" }] }; }],
  ["sameNpc canon", function (n) { return { sameNpc: [{ canonical: n, duplicate: "Bram" }] }; }],
  ["sameNpc dupe", function (n) { return { sameNpc: [{ canonical: "Bram", duplicate: n }] }; }],
  ["motivationChanges", function (n) { return { motivationChanges: [{ name: n, now: "find the forge" }] }; }]
];
var total = 0, bad = 0;
SHAPES.forEach(function (sh) {
  spellings("Tess", "the Butcher").forEach(function (sp) {
    var h = world(); worldState.character.aliases = ["the Butcher"]; if (!memory.map) memory.map = { nodes: {}, edges: [], lastArrivalFrom: null };
    var err = "", q;
    try { q = quiet(function () { return applySummaryExtract(sh[1](sp[1]), null); }); } catch (e) { err = " THROW " + e.message; }
    total++; var s = snap(h, "the Butcher");
    if (s.length || err) { bad++; console.log("!! " + sh[0] + " [" + sp[0] + "='" + sp[1] + "'] -> " + s.join("; ") + err); }
  });
});
console.log(total + " runs; " + bad + " left damage");
