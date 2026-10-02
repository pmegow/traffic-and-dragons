// #536 other entrances (read-only probe): reserved words arriving NOT as tags. argv: <tree>
process.env.ENGINE_ROOT = process.argv[2];
require("../thu/vtags/harness.js");
var BASE = { proto: Object.getOwnPropertyNames(Object.prototype), obj: Object.getOwnPropertyNames(Object) };
function poison() {
  var out = [], n, i;
  n = Object.getOwnPropertyNames(Object.prototype); for (i = 0; i < n.length; i++) if (BASE.proto.indexOf(n[i]) < 0) { out.push("Object.prototype." + n[i]); delete Object.prototype[n[i]]; }
  n = Object.getOwnPropertyNames(Object); for (i = 0; i < n.length; i++) if (BASE.obj.indexOf(n[i]) < 0) { out.push("Object." + n[i]); delete Object[n[i]]; }
  ["toString", "valueOf", "hasOwnProperty", "isPrototypeOf"].forEach(function (k) { var fn = Object.prototype[k], names = Object.getOwnPropertyNames(fn); names.forEach(function (x) { if (["length", "name", "prototype", "arguments", "caller"].indexOf(x) < 0) { out.push(k + "." + x); delete fn[x]; } }); });
  return out;
}
function world() { makeWorld(); delete worldState.kind; worldState.turn = 9; worldState.npcs = [{ name: "Bram", status: "", rel: "ally", met: 1, partyMember: false, aliases: [] }]; memory.npcs = { Bram: { attitude: "", knowledge: [], events: [], aliases: [] } }; }
function attempt(label, fn) {
  var err = "", q;
  try { q = quiet(fn); } catch (e) { err = "THROW " + e.message; }
  var p = poison(), after = "";
  try { quiet(function () { buildSysPrompt(); }); } catch (e2) { after = " | then buildSysPrompt THROWS: " + e2.message; }
  poison();
  console.log((p.length || err || after ? "!! " : "   ") + label + " -> " + (p.length ? "wrote on built-ins: " + p.join(", ") : "no write on a built-in") + (err ? " | " + err : "") + after);
}
["__proto__", "constructor", "toString"].forEach(function (w) {
  world(); attempt("summary extraction npcUpdates name=" + w, function () { applySummaryExtract({ chapterSummary: "A day passes.", npcUpdates: [{ name: w, knowledge: ["a fact"], attitude: "wary" }] }, null); });
  world(); attempt("summary extraction npcDeaths name=" + w, function () { applySummaryExtract({ chapterSummary: "A day passes.", npcDeaths: [{ name: w, cause: "a fall" }] }, null); });
  world(); attempt("summary extraction sameNpc " + w, function () { applySummaryExtract({ chapterSummary: "A day passes.", sameNpc: [{ canonical: "Bram", duplicate: w }, { canonical: w, duplicate: "Bram" }] }, null); });
  world(); attempt("summary extraction supersededFacts npc=" + w, function () { applySummaryExtract({ chapterSummary: "A day passes.", supersededFacts: [{ npc: w, outdated: "old", truth: "new" }] }, null); });
  world(); attempt("fileLocation " + w, function () { if (typeof fileLocation === "function") fileLocation(w, 9); });
  world(); attempt("fileLore " + w, function () { fileLore(w); fileLore({ topic: w, text: "a thing" }); });
  world(); attempt("village resident named " + w, function () { worldState.kind = "village"; worldState.world.location = "The Village"; if (!memory.map) memory.map = { nodes: {}, edges: [] }; memory.map.nodes["The Village"] = { firstVisit: 1, visits: 1, parent: null, npcs: [], items: [] }; importVillageResidents([{ name: w, gender: "F", cls: "Rogue" }]); });
  world(); attempt("hero named " + w + " then a turn of tags", function () { worldState.character.name = w; applyMuts("x [NPC:Bram|calm|ally] [GOLD:1] [CORE_MEMORY:" + w + "|a vow]"); });
});
