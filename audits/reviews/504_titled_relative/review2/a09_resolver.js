// resolveNpcName: odd inputs (throws? loops?), junk archive entries, chains, and cost on a mature roster. Head and before.
require("./b.js");
var D = "°";
function safe(n) { try { var t0 = Date.now(), r = resolveNpcName(n), dt = Date.now() - t0; return JSON.stringify(r) + (dt > 50 ? "  (" + dt + " ms!)" : ""); } catch (e) { return "THROW " + e.message; } }
hdr("odd strings, with a title question and a #156 question open");
q(); person("Savah", "she/her"); quiet(function () { applyMuts("[NPC:Savah|counting vials|unknown, not yet met]"); });
["", " ", D, " " + D + "t", " " + D + "t5", D + "t5", "X " + D + "t5 " + D + "t6", "Queen Underbough " + D + "t", "Queen Underbough " + D + "t85 ", " Queen Underbough", "QUEEN UNDERBOUGH", "queen  underbough", "Queen Underbough!!!", "Queen Underbough 2",
  "Queen-Underbough", "Queen Underbough's", "the a an", "(Queen Underbough)", "Queen (the) Underbough", "The", "Tess", "Player", "tess " + D + "t1", "constructor", "__proto__", "toString", "hasOwnProperty " + D + "t3",
  new Array(20001).join("("), new Array(5001).join("Queen Underbough "), "Queen Underbough " + D + "t" + new Array(400).join("9")].forEach(function (n) {
  console.log("  " + JSON.stringify(n.length > 60 ? n.slice(0, 30) + "…(" + n.length + " chars)" : n) + " -> " + safe(n).slice(0, 120));
});
[undefined, null, 0, 85, true, {}, [], ["Queen Underbough"], { toString: function () { return "Savah " + D + "t9"; } }].forEach(function (n) { var s; try { s = JSON.stringify(n); } catch (e) { s = String(n); } console.log("  (non-string) " + s + " -> " + safe(n).slice(0, 120)); });

hdr("the archive: ordinary merges, location merges, junk, chains, cycles");
fresh(); person("Wilhelmina Underbough", "she/her"); person("Isolde Marsh", "she/her"); person("Vessa Thorn", "she/her");
var A = memArchive().identityMerges, P = "Queen Underbough " + D + "t85";
A.push({ domain: "location", op: "merge", canonical: "Isolde Marsh", duplicate: P, turn: 1 });
console.log("  a LOCATION merge whose duplicate is spelled like the key -> " + safe(P));
A.push(null); A.push("junk"); A.push({ domain: "npc" }); A.push({ domain: "npc", duplicate: P, canonical: 7 });
console.log("  junk entries (canonical: 7) -> " + safe(P));
A.length = 0; A.push({ domain: "npc", canonical: "Vessa Thorn", duplicate: P, turn: 86 });
console.log("  folded into Vessa Thorn -> " + safe(P));
A.push({ domain: "npc", canonical: "Isolde Marsh", duplicate: "Vessa Thorn", turn: 90 }); delete memory.npcs["Vessa Thorn"]; memory.npcs["Isolde Marsh"].aliases = ["Vessa Thorn"];
console.log("  …and Vessa Thorn later merged into Isolde Marsh -> " + safe(P));
A.length = 0; A.push({ domain: "npc", canonical: "B " + D + "t2", duplicate: "A " + D + "t1", turn: 1 }); A.push({ domain: "npc", canonical: "A " + D + "t1", duplicate: "B " + D + "t2", turn: 2 });
console.log("  a cycle A->B->A (neither live) -> " + safe("A " + D + "t1"));
A.length = 0; var i; for (i = 0; i < 9; i++) A.push({ domain: "npc", canonical: "H" + (i + 1) + " " + D + "t1", duplicate: "H" + i + " " + D + "t1", turn: i }); memory.npcs["H9 " + D + "t1"] = { aliases: [], events: [], knowledge: [] };
console.log("  a chain of 9 hops to a live record -> " + safe("H0 " + D + "t1") + "   (5 hops from the end: " + safe("H4 " + D + "t1") + ")");
A.length = 0; A.push({ domain: "npc", canonical: "Gone Person", duplicate: P, turn: 86 });
console.log("  folded into a record that no longer exists -> " + safe(P));
A.length = 0; A.push({ domain: "npc", canonical: "Tess", duplicate: P, turn: 86 });
console.log("  folded into the hero (pre-#534 archive entry) -> " + safe(P) + "  isPlayer=" + memoryNpcIsPlayer(resolveNpcName(P)));

hdr("cost on a mature roster: 800 records, 4 open title questions, 400 archive entries");
fresh(); var fam = [], j;
for (i = 0; i < 800; i++) { var nm = "Given" + i + " Family" + i; person(nm, "she/her"); memory.npcs[nm].aliases = ["Alias" + i + " One", "Alias" + i + " Two"]; }
for (i = 0; i < 4; i++) quiet(function () { applyMuts("[NPC:Lady Family" + i + "|calm|ally]"); });
for (i = 0; i < 400; i++) memArchive().identityMerges.push({ domain: "npc", canonical: "Given" + i + " Family" + i, duplicate: "Old" + i + " " + D + "t" + i, turn: i });
console.log("  provisionals open: " + Object.keys(memory.npcs).filter(function (k) { return memory.npcs[k].provisional; }).length + " of " + Object.keys(memory.npcs).length + " records");
function bench(label, names) { var t0 = Date.now(), n = 0, r; for (r = 0; r < 20; r++) for (j = 0; j < names.length; j++) { resolveNpcName(names[j]); n++; } var dt = Date.now() - t0; console.log("  " + label + ": " + n + " resolves in " + dt + " ms (" + (dt / n * 1000).toFixed(1) + " µs each)"); }
var miss = [], exact = [], stale = [], called = [];
for (i = 0; i < 200; i++) { miss.push("Nobody" + i + " Unknown" + i); exact.push("Given" + i + " Family" + i); stale.push("Old" + i + " " + D + "t" + i); called.push("the lady family" + (i % 4)); }
bench("exact keys        ", exact); bench("names on no record", miss); bench("stale " + D + " keys      ", stale); bench("called names      ", called);
