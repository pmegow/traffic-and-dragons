// #535: can any spelling the PARSER reads as an npc merge still pass the GATE unseen? Two established people, scene refs on, nothing armed.
require("./b.js");
var WS = ["", " ", "  ", "\t", "\n", "\r\n", "\u00a0", "\u2003", "\ufeff", "\u200b", "\u3000", "\u1680", "\u2028", "\u2029", "\u180e", "\u0085", "\u202f", "\u205f", "\u000b", "\u000c"];
var DOM = ["npc", "NPC", "Npc", "nPc", "npC", "NPc", "nPC", "NpC", "\uff2e\uff30\uff23", "n\u0307pc", "\u0274pc", "npc\u0301", "npcs", "np c", "n.p.c", "Non-player", "character", "person", "people", "npc:", "npc|"];
var TAGS = ["MERGE", "merge", "Merge", "MERGE ", " MERGE", "NPC_MERGE", "npc_merge", "Npc_Merge", "NPC_MERGE ", "NPC MERGE", "NPCMERGE", "MERGE_NPC"];
var fused = [], seen = 0, parserSawGateMissed = 0;
function trial(tag) {
  fresh(); person("Wilhelmina Underbough", "she/her"); person("Isolde Marsh", "she/her"); worldState.turn = 86;
  var r; try { r = run(tag); } catch (e) { fused.push("THROW " + JSON.stringify(tag) + " " + e.message); return; }
  seen++;
  if (!memory.npcs["Wilhelmina Underbough"] || !memory.npcs["Isolde Marsh"]) fused.push(JSON.stringify(tag) + " muts=" + JSON.stringify(r.muts));
}
TAGS.forEach(function (T) {
  if (/MERGE/i.test(T) && /NPC/i.test(T)) { WS.forEach(function (a) { WS.forEach(function (b) { trial("[" + T + ":" + a + "Isolde Marsh" + b + "|" + a + "Wilhelmina Underbough" + b + "]"); }); }); return; }
  DOM.forEach(function (d) { WS.forEach(function (a) { WS.forEach(function (b) { trial("[" + T + ":" + a + d + b + "|Isolde Marsh|Wilhelmina Underbough]"); trial("[" + T + ":" + a + d + b + "|" + a + "Isolde Marsh" + b + "|" + b + "Wilhelmina Underbough" + a + "]"); }); }); });
});
console.log(seen + " tag spellings applied with scene refs on and nothing armed; fused two established people: " + fused.length);
fused.slice(0, 20).forEach(function (f) { console.log("   " + f); });
