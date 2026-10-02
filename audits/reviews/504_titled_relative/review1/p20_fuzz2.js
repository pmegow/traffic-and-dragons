// p20 — fuzzer, second pass: follow WRITES ADDRESSED TO A PROVISIONAL. Every note written to a ° key (or to the name a title
// provisional was called by, while it is open) is stamped "P:<its of>:<key>#n". After each reply:
//   CROSS  — such a note sits on an established person who is NOT the record it was split from (two people fused);
//   STALE  — such a note sits on the record it was split from although the GM answered DIFFERENT (a rename landed);
//   ZOMBIE — a ° key on file with no provisional stamp;
//   LOST   — a merge receipt was printed for a provisional that is still on file.
// The GM here may re-use a ° key after its answer landed (stale context). PROBE_TREE=pre|mid|head ; argv[2] = sequences.
require("./base.js");
var N = parseInt(process.argv[2] || "20000", 10);
var seed = 777; function rnd() { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; }
function pick(a) { return a[Math.floor(rnd() * a.length)]; }
var ESTAB = ["Wilhelmina Underbough", "Isolde Marsh", "Savah"];
var everKeys, provOf, renamed, noteN = 0;
function names() { return ["Wilhelmina Underbough", "Isolde Marsh", "Savah", "Queen Underbough", "Lady Marsh", "Wilhelmina", "Underbough", "Queen Isolde Underbough", "Vessa Thorn"].concat(Object.keys(everKeys)); }
function genTag() {
  var r = rnd(), nm = pick(names());
  if (r < 0.26) return "[NPC:" + nm + "|" + pick(["furious", "calm", "pacing"]) + "|" + pick(["hostile", "ally", "unknown, not yet met"]) + "]";
  if (r < 0.46) { var tag = everKeys[nm] ? "P:" + provOf[nm] + ":" + nm : (ESTAB.indexOf(nm) >= 0 ? "E:" + nm : "x"); return "[NPC_NOTE:" + nm + "|" + tag + "#" + (++noteN) + "]"; }
  if (r < 0.64) return "[NPC_MERGE:" + pick(names()) + "|" + pick(names()) + "]";
  if (r < 0.84) return "[MERGE:npc|" + pick(names()) + "|" + pick(names()) + "]";
  if (r < 0.92) return "[NPC_DEATH_REPORTED:" + nm + "|a rider]";
  return "[SAY:" + nm + "|Hm.]";
}
function check(res) {
  var v = [], k;
  for (k in memory.npcs) { var m = memory.npcs[k];
    if (!m.provisional && / °t\d+$/.test(k)) v.push("ZOMBIE: a ° key on file with no provisional stamp");
    (m.events || []).forEach(function (e) { var mm = String((e && e.note) || "").match(/^P:([^:]+):([^#]+)#/); if (!mm) return; var of = mm[1], key = mm[2];
      if (ESTAB.indexOf(k) >= 0 && k !== of) v.push("CROSS: a note written to a provisional sits on an established person it was never split from");
      if (k === of && renamed[key]) v.push("STALE: after a landed DIFFERENT answer, a note written to the ° key sits on the person it was split from");
    });
  }
  (res.muts || []).forEach(function (mu) { var mm = String(mu).match(/^Merged: (.+) -> (.+)$/); if (!mm) return; var d = mm[1];
    var stillProv = Object.keys(memory.npcs).some(function (k2) { return memory.npcs[k2].provisional && (k2 === d || (memory.npcs[k2].aliases || []).indexOf(d) >= 0); });
    if (stillProv) v.push("LOST: 'Merged' was printed for a provisional that is still on file"); });
  return v;
}
var found = {}, counts = {}, replies = 0, s, t;
function note(sig, seq, hit) { if (!hit[sig]) { hit[sig] = 1; counts[sig] = (counts[sig] || 0) + 1; } if (!found[sig] || found[sig].length > seq.length) found[sig] = seq.slice(); }
for (s = 0; s < N; s++) {
  fresh(); person("Wilhelmina Underbough", "she/her"); person("Isolde Marsh", "she/her"); person("Savah", "she/her");
  everKeys = {}; provOf = {}; renamed = {};
  var seq = [], len = 3 + Math.floor(rnd() * 5), hit = {};
  for (t = 0; t < len; t++) {
    worldState.turn = 85 + t;
    quiet(function () { buildMergeConfirmNudge(); buildProvisionalNudge(); });
    var reply = "", nt = 1 + Math.floor(rnd() * 3), j; for (j = 0; j < nt; j++) reply += genTag() + " ";
    seq.push("t" + worldState.turn + ": " + reply.trim()); replies++;
    var before = {}; Object.keys(memory.npcs).forEach(function (k) { if (memory.npcs[k].provisional) before[k] = memory.npcs[k].provisional.of; });
    var res; try { res = run(reply); } catch (e) { note("THROW " + e.message, seq, hit); break; }
    Object.keys(memory.npcs).forEach(function (k) { if (memory.npcs[k].provisional) { everKeys[k] = 1; provOf[k] = memory.npcs[k].provisional.of; } });
    (res.muts || []).forEach(function (mu) { var mm = String(mu).match(/^Merged: (.+) -> (.+)$/); if (mm && before[mm[1]] && !memory.npcs[mm[1]] && mm[2] !== before[mm[1]]) renamed[mm[1]] = mm[2]; });
    var vs = check(res), a; for (a = 0; a < vs.length; a++) note(vs[a], seq, hit);
  }
}
Object.keys(found).sort().forEach(function (k) { console.log("\n### " + k + "  [" + counts[k] + " of " + N + " sequences]\n   " + found[k].join("\n   ")); });
console.log("\n" + N + " sequences, " + replies + " replies applied; " + Object.keys(found).length + " distinct violation(s)");
