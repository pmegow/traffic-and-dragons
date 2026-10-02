// p14 — a seeded sequence fuzzer through the real engine. Random GM replies over a small family of names; after every reply a
// set of structural invariants is checked. Each distinct violation is printed once, with the SHORTEST sequence that produced it
// and the number of sequences that hit it. PROBE_TREE=pre|mid|head ; argv[2] = number of sequences (default 3000) ;
// argv[3] = "alias" to let the fuzzer emit NPC_ALIAS tags (off by default: NPC_ALIAS has old defects of its own that drown the rest).
require("./base.js");
var N = parseInt(process.argv[2] || "3000", 10), WITH_ALIAS = process.argv[3] === "alias";
var seed = 12345; function rnd() { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; }
function pick(a) { return a[Math.floor(rnd() * a.length)]; }
function provKeys() { return Object.keys(memory.npcs).filter(function (k) { return memory.npcs[k].provisional; }); }
function names() {
  var base = ["Wilhelmina Underbough", "Isolde Marsh", "Queen Underbough", "Lady Underbough", "Underbough", "Wilhelmina", "Queen Isolde Underbough", "Lady Marsh", "Isolde", "The Queen Underbough"];
  return base.concat(provKeys());
}
// who the GM MEANS by a name: only the unambiguous forms carry an intent
function owner(nm) { return (nm === "Wilhelmina Underbough" || nm === "Wilhelmina") ? "W" : (nm === "Isolde Marsh" || nm === "Isolde") ? "I" : null; }
var noteN = 0;
function genTag() {
  var r = rnd(), nm = pick(names()), o;
  if (r < 0.24) return "[NPC:" + nm + "|" + pick(["furious", "calm", "pacing", "dead"]) + "|" + pick(["hostile", "ally", "unknown, not yet met", ""]) + "]";
  if (r < 0.38) { o = owner(nm); return "[NPC_NOTE:" + nm + "|" + (o ? o : "x") + "#" + (++noteN) + "]"; }
  if (r < 0.44) return "[NPC_PRONOUN:" + nm + "|" + pick(["she/her", "he/him"]) + "]";
  if (r < 0.50) return WITH_ALIAS ? "[NPC_ALIAS:" + pick(names()) + "|" + pick(names().concat(["Her Majesty", "The Ferrywoman"])) + "]" : "[SAY:" + nm + "|Hm.]";
  if (r < 0.68) return "[NPC_MERGE:" + pick(names().concat(["Tess"])) + "|" + pick(names()) + "]";
  if (r < 0.86) return "[MERGE:npc|" + pick(names().concat(["Tess", "Vessa Thorn"])) + "|" + pick(names()) + "]";
  if (r < 0.92) return "[NPC_DEATH_REPORTED:" + nm + "|a rider]";
  if (r < 0.96) return "[SAY:" + nm + "|Hm.]";
  return "[SCENE_CAST:" + nm + "]";
}
function check() {
  var v = [], k, i, owners = {};
  for (k in memory.npcs) { var m = memory.npcs[k], al = m.aliases || [];
    if (al.indexOf(k) >= 0) v.push("a record is its own alias");
    for (i = 0; i < al.length; i++) { if (owners[al[i]] && owners[al[i]] !== k) v.push("one alias on two records"); owners[al[i]] = k; if (memory.npcs[al[i]] && al[i] !== k) v.push("an alias that is also another record's key"); }
    if (m.provisional) { var of = resolveNpcName(m.provisional.of); if (memory.npcs[of] && memory.npcs[of].provisional) v.push("a provisional of a provisional (or of itself)"); if (!wsNpcByName(k)) v.push("a provisional with no roster row"); }
    else if (/ °t\d+$/.test(k)) v.push("a ° key with no provisional stamp (never asked about again)");
    var letters = {}; (m.events || []).forEach(function (e) { var t = String((e && e.note) || ""), mm = t.match(/^([WI])#/); if (mm) letters[mm[1]] = 1; });
    if (letters.W && letters.I) v.push("FUSION: one record holds notes written to both established people");
    if (letters.W && k !== "Wilhelmina Underbough" && memory.npcs["Wilhelmina Underbough"]) v.push("FORK: notes written to Wilhelmina sit on " + (m.provisional ? "a provisional" : "a second established record") + " while her own record exists");
    if (letters.I && k !== "Isolde Marsh" && memory.npcs["Isolde Marsh"]) v.push("FORK: notes written to Isolde sit on " + (m.provisional ? "a provisional" : "a second established record") + " while her own record exists");
    if (memoryNpcIsPlayer(k)) v.push("a memory record with the hero's name");
  }
  for (i = 0; i < worldState.npcs.length; i++) { var n = worldState.npcs[i]; if (memoryNpcIsPlayer(n.name)) v.push("a roster row with the hero's name"); if (/ °t\d+$/.test(n.name) && !memory.npcs[n.name]) v.push("a ° roster row with no memory record"); }
  return v;
}
var found = {}, counts = {}, replies = 0, s, t;
function note(sig, seq, hit) { if (!hit[sig]) { hit[sig] = 1; counts[sig] = (counts[sig] || 0) + 1; } if (!found[sig] || found[sig].length > seq.length) found[sig] = seq.slice(); }
for (s = 0; s < N; s++) {
  fresh(); person("Wilhelmina Underbough", "she/her"); person("Isolde Marsh", "she/her");
  var seq = [], len = 2 + Math.floor(rnd() * 6), hit = {};
  for (t = 0; t < len; t++) {
    worldState.turn = 85 + t;
    quiet(function () { buildMergeConfirmNudge(); buildProvisionalNudge(); });
    var armed = worldState.mergeConfirmArmed ? worldState.mergeConfirmArmed.canonical + "|" + worldState.mergeConfirmArmed.duplicate : "";
    var reply = "", nt = 1 + Math.floor(rnd() * 2), j; for (j = 0; j < nt; j++) reply += genTag() + " ";
    seq.push("t" + worldState.turn + (armed ? " (armed " + armed + ")" : "") + ": " + reply.trim());
    replies++;
    var res; try { res = run(reply); } catch (e) { note("THROW " + e.message, seq, hit); break; }
    if (res.r && res.r.errors && res.r.errors.length) note("HANDLER ERROR " + res.r.errors[0], seq, hit);
    var vs = check(), a;
    for (a = 0; a < vs.length; a++) { if (/FUSION/.test(vs[a]) && armed && reply.indexOf(armed) >= 0) continue; note(vs[a], seq, hit); }
  }
}
Object.keys(found).sort().forEach(function (k) { console.log("\n### " + k + "  [" + counts[k] + " of " + N + " sequences]\n   " + found[k].join("\n   ")); });
console.log("\n" + N + " sequences, " + replies + " replies applied; " + Object.keys(found).length + " distinct violation(s)");
