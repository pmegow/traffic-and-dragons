require("./b.js");
var D = "\u00b0";
function w(i) { var s = "", n = i + 1; while (n > 0) { s = String.fromCharCode(97 + (n % 26)) + s; n = Math.floor(n / 26); } return s; }
function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
fresh(); var i, j, fams = [];
for (i = 0; i < 800; i++) { var g = "G" + w(i) + "ivenq", f = "F" + w(i) + "amilyq"; fams.push(f); var nm = g + " " + f; person(nm, "she/her"); memory.npcs[nm].aliases = ["Alias" + w(i) + " One", "Alias" + w(i) + " Two"]; }
for (i = 0; i < 4; i++) quiet(function () { applyMuts("[NPC:Lady " + fams[i] + "|calm|ally]"); });
for (i = 0; i < 400; i++) memArchive().identityMerges.push({ domain: "npc", canonical: Object.keys(memory.npcs)[i], duplicate: "Old" + w(i) + " " + D + "t" + i, turn: i });
console.log("provisionals open: " + Object.keys(memory.npcs).filter(function (k) { return memory.npcs[k].provisional; }).length + " of " + Object.keys(memory.npcs).length + " records");
function bench(label, names) { var r, n = 0; for (r = 0; r < 3; r++) for (j = 0; j < names.length; j++) resolveNpcName(names[j]); var t0 = process.hrtime.bigint(); for (r = 0; r < 30; r++) for (j = 0; j < names.length; j++) { resolveNpcName(names[j]); n++; } var dt = Number(process.hrtime.bigint() - t0) / 1e3; console.log("  " + label + ": " + (dt / n).toFixed(1) + " \u00b5s per resolve"); }
var miss = [], exact = [], stale = [], called = [], shortf = [];
for (i = 0; i < 200; i++) { miss.push("Nobody" + w(i) + " Unknown" + w(i)); exact.push(Object.keys(memory.npcs)[i]); stale.push("Old" + w(i) + " " + D + "t" + i); called.push("the lady " + fams[i % 4].toLowerCase()); shortf.push(fams[100 + i]); }
bench("exact keys         ", exact); bench("names on no record ", miss); bench("bare surnames      ", shortf); bench("stale " + D + " keys       ", stale); bench("called names       ", called);
