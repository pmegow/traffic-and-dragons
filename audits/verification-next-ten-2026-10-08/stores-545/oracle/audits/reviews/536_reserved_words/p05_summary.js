// REVIEW PROBE p05: the summary's extraction (applySummaryExtract) with shapes summaryDropReserved does not walk:
// a name that is a one-element LIST (String() of it is the word), a nested {fact,kind}, keys of the JSON itself; and entries
// that are dropped although nothing in them is a name. argv: <tree>
var L = require("./lib.js");
function fresh(mode) { L.world(mode || "plain"); worldState.npcs.push({ name: "Old Ned", status: "", rel: "neutral", met: 2, partyMember: false, aliases: [] }); memory.npcs["Old Ned"] = { attitude: "", knowledge: ["mends nets"], events: [], aliases: [] }; }
function attempt(label, ex, mode) {
  fresh(mode);
  var before = JSON.stringify(ex), thrown = "", q;
  try { q = quiet(function () { return applySummaryExtract(ex, null); }); } catch (e) { thrown = String(e && e.message || e); }
  var p = L.poison(), dead = [];
  var promptThrow = ""; try { quiet(function () { buildSysPrompt(); }); } catch (e2) { promptThrow = String(e2 && e2.message || e2); }
  var p2 = L.poison(), sc = L.scanState();
  var dropped = q ? q.warns.filter(function (w) { return /#540/.test(w); }).length : 0;
  var flags = [];
  if (thrown) flags.push("applySummaryExtract THREW: " + thrown.slice(0, 160));
  if (p.length) flags.push("WROTE ON BUILT-INS: " + p.join(", ").slice(0, 260));
  if (promptThrow) flags.push("next buildSysPrompt THROWS: " + promptThrow.slice(0, 120));
  if (p2.length) flags.push("prompt build wrote on built-ins: " + p2.join(", ").slice(0, 200));
  if (sc.length) flags.push("state: " + sc.slice(0, 3).join(" | "));
  console.log((flags.length ? "!! " : "   ") + label + "\n      in : " + before.slice(0, 210) + "\n      #540 drops said on the console: " + dropped + " | Bram knows: " + JSON.stringify((memory.npcs.Bram || {}).knowledge) + " | Bram attitude: " + JSON.stringify((memory.npcs.Bram || {}).attitude) + " | lore: " + JSON.stringify(memory.lore) + " | npc keys: " + JSON.stringify(Object.keys(memory.npcs)) + (flags.length ? "\n      " + flags.join("\n      ") : ""));
}
console.log("tree: " + L.TREE);
console.log("--- A. a name written as a one-element list (not a string, so not checked; String([w]) is w)");
["__proto__", "constructor"].forEach(function (w) {
  attempt("npcUpdates name=[" + w + "]", { chapterSummary: "A day passes.", npcUpdates: [{ name: [w], attitude: "wary", knowledgeGained: "a fact" }] });
  attempt("npcDeaths name=[" + w + "]", { chapterSummary: "A day passes.", npcDeaths: [{ name: [w], handle: "h1", sourceTurn: 5 }] });
  attempt("npcDeaths entry=[[" + w + "]] (a list inside the list)", { chapterSummary: "A day passes.", npcDeaths: [[w]] });
  attempt("supersededFacts name=[" + w + "]", { chapterSummary: "A day passes.", supersededFacts: [{ name: [w], old: "keeps the forge", "new": "sold the forge" }] });
  attempt("sameNpc canonical=[" + w + "]", { chapterSummary: "A day passes.", sameNpc: [{ canonical: [w], duplicate: "Bram" }] });
  attempt("attire name=[" + w + "]", { chapterSummary: "A day passes.", attire: [{ name: [w], outfit: "a grey cloak" }] });
  attempt("motivationChanges name=[" + w + "]", { chapterSummary: "A day passes.", motivationChanges: [{ name: [w], now: "to find the bell" }] });
});
console.log("--- B. nested shapes");
attempt("knowledgeGained {fact:'__proto__'} on Bram", { chapterSummary: "A day passes.", npcUpdates: [{ name: "Bram", knowledgeGained: { fact: "__proto__", kind: "durable" } }] });
attempt("knowledgeGained {fact:'constructor', kind:'scene'} on Bram", { chapterSummary: "A day passes.", npcUpdates: [{ name: "Bram", knowledgeGained: { fact: "constructor", kind: "scene" } }] });
attempt("attire donned ['constructor'] for Kira", { chapterSummary: "A day passes.", attire: [{ name: "Kira", donned: ["constructor"], doffed: ["__proto__"] }] });
console.log("--- C. keys of the extraction JSON itself");
attempt("top-level key __proto__ (JSON.parse makes it an own key)", JSON.parse('{"chapterSummary":"A day passes.","__proto__":{"npcUpdates":[{"name":"Bram","attitude":"dead"}]},"npcUpdates":[{"name":"Bram","knowledgeGained":"shod the grey mare"}]}'));
attempt("entry key __proto__ inside an npcUpdates entry", JSON.parse('{"chapterSummary":"A day passes.","npcUpdates":[{"name":"Bram","knowledgeGained":"shod the grey mare","__proto__":{"name":"Old Ned"}}]}'));
attempt("top-level key constructor holding a list", JSON.parse('{"chapterSummary":"A day passes.","constructor":[{"name":"Bram"}],"npcUpdates":[{"name":"Bram","knowledgeGained":"shod the grey mare"}]}'));
console.log("--- D. dropped although nothing in the entry is a name (collateral)");
attempt("Bram's update dropped for an attitude word", { chapterSummary: "A day passes.", npcUpdates: [{ name: "Bram", attitude: "constructor", knowledgeGained: "shod the grey mare" }] });
attempt("Bram's death citation dropped for its handle", { chapterSummary: "A day passes.", npcDeaths: [{ name: "Bram", handle: "constructor", sourceTurn: 5 }] });
attempt("a lore line that is one capitalised word", { chapterSummary: "A day passes.", loreDiscovered: ["Constructor", "The bridge is older than the town."] });
attempt("future event whose 'when' is the word", { chapterSummary: "A day passes.", futureEvents: [{ what: "The guild votes on the new bridge", when: "constructor" }] });
console.log("--- E. prose tiers and sentences (must stay)");
attempt("chapterSummary and sentences that use the words", { chapterSummary: "The constructor of the bridge spoke of __proto__ and toString.", loreDiscovered: ["The constructor of the bridge was a dwarf."], decisionsMade: ["Hired the constructor."], npcUpdates: [{ name: "Bram", knowledgeGained: "knew the constructor, toString, of old" }] });
