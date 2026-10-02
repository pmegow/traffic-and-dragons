// agent2 sequence fuzzer. Extends the first reviewer's p22 idea: NPC_ALIAS / ALIAS:npc, repeated tags, case and spacing
// variants of the tag and of the names, the hero's names, mangled ° keys, an "obedient GM" that answers the notes, and a hero swap.
// Every distinct violation is kept with the SHORTEST literal sequence that produced it, written to out_<label>.json for replay
// on the other tree (f02_replay.js).  usage: TREE=head node f01_fuzz.js <N> <seed> <label> [swap]
require("./b.js"); require("./inv.js");
var fs = require("fs");
var N = parseInt(process.argv[2] || "3000", 10), seed = parseInt(process.argv[3] || "4242", 10), label = process.argv[4] || "run", SWAP = process.argv[5] === "swap";
var D = "°";
// mulberry32 (Math.imul keeps the state exact; the LCG the first fuzzers used loses its low bits above 2^53 and falls into a 10,466-draw cycle)
function rnd() { seed = (seed + 0x6D2B79F5) | 0; var t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }
function pick(a) { return a[Math.floor(rnd() * a.length)]; }
function provKeys() { return Object.keys(memory.npcs).filter(function (k) { return memory.npcs[k].provisional; }); }
var everKeys;
function vary(n) { var r = rnd(); if (r < 0.80) return n; if (r < 0.86) return n.toLowerCase(); if (r < 0.90) return "The " + n; if (r < 0.94) return n + " (her mother)"; if (r < 0.97) return n.replace(" " + D, " "); return n.replace(D + "t", D + "T"); }
function names() {
  var base = ["Wilhelmina Underbough", "Isolde Marsh", "Savah", "Bram", "Queen Underbough", "Lady Marsh", "Lady Underbough", "Princess Underbough", "King Underbough",
    "Wilhelmina", "Underbough", "Isolde", "Marsh", "The Ferrywoman", "Queen Isolde Underbough", "Vessa Thorn", "Hilda Underbough", "Tess", "Player", worldState.character.name];
  return base.concat(Object.keys(everKeys)).concat(Object.keys(everKeys));
}
// near-misses of a name: what a GM writes when it copies a key or a called name almost right
var NEAR = process.argv[6] === "near";
function near(n) { var r = rnd(); if (r < 0.55) return n; if (r < 0.65) return n.replace(" " + D, " "); if (r < 0.72) return n.replace(D + "t", D + "T"); if (r < 0.80) return n.toLowerCase(); if (r < 0.90) return n.replace(/ (?!°)/, "_"); return n.replace(/ (?!°)/, "-"); }
function nm() { return vary(pick(names())); }
var noteN = 0, provOf;
function stamp(n) { if (everKeys[n]) return "P:" + provOf[n] + ":" + n; if (ESTAB.indexOf(n) >= 0) return "E:" + n; return "x"; }
function mergeTag(c, d) {
  var r = rnd();
  if (r < 0.45) return "[NPC_MERGE:" + c + "|" + d + "]";
  if (r < 0.80) return "[MERGE:npc|" + c + "|" + d + "]";
  if (r < 0.87) return "[MERGE:NPC|" + c + "|" + d + "]";
  if (r < 0.93) return "[MERGE: npc |" + c + "|" + d + "]";
  return "[MERGE:Npc| " + c + " | " + d + " ]";
}
function genTag(notes) {
  var r = rnd(), n = nm(), ek = Object.keys(everKeys);
  if (r < 0.20) return "[NPC:" + n + "|" + pick(["furious", "calm", "pacing"]) + "|" + pick(["hostile", "ally", "unknown, not yet met", ""]) + "]";
  if (r < 0.36) { var raw = pick(names()); return "[NPC_NOTE:" + (NEAR ? near(raw) : raw) + "|" + stamp(raw) + "#" + (++noteN) + "]"; }
  if (r < 0.40) return "[NPC_PRONOUN:" + n + "|" + pick(["she/her", "he/him"]) + "]";
  if (r < 0.50) return (rnd() < 0.7 ? "[NPC_ALIAS:" : "[ALIAS:npc|") + nm() + "|" + pick(names().concat(["Her Majesty", "The Dowager", "Mina"])) + "]";
  if (r < 0.86) {
    // an obedient GM answers a note about half the time it is there
    if (notes.length && rnd() < 0.5) return pick(notes);
    var c = nm(), d = (ek.length && rnd() < 0.55) ? vary(pick(ek)) : nm();
    var t = mergeTag(c, d); return rnd() < 0.12 ? t + " " + t : t;
  }
  if (r < 0.93) return "[NPC_DEATH_REPORTED:" + n + "|a rider]";
  return "[SAY:" + n + "|Hm.]";
}
function noteTags(txt) { return (String(txt || "").match(/\[(?:NPC_MERGE|MERGE):[^\]<]+\]/g) || []); }
var found = {}, counts = {}, replies = 0, s, t, ALL = [];
function note(sig, seqObj, hit) { if (!hit[sig]) { hit[sig] = 1; counts[sig] = (counts[sig] || 0) + 1; } if (!found[sig] || found[sig].steps.length > seqObj.steps.length) found[sig] = JSON.parse(JSON.stringify(seqObj)); }
for (s = 0; s < N; s++) {
  var cfg = { refs: rnd() < 0.7, open: pick(["title", "title", "156", "both", "none"]) };
  setupWorld(cfg);
  everKeys = {}; provOf = {}; var renamed = {}, confirmedInto = {};
  provKeys().forEach(function (k) { everKeys[k] = 1; provOf[k] = memory.npcs[k].provisional.of; });
  var seqObj = { cfg: cfg, steps: [] }, len = 2 + Math.floor(rnd() * 6), hit = {};
  for (t = 0; t < len; t++) {
    var step = {};
    if (SWAP && rnd() < 0.12) { var to = pick(["Wilhelmina Underbough", "Savah", "Isolde Marsh"]); if (wsNpcByName(to) && !memoryNpcIsPlayer(to)) { heroSwap(to); step.swap = to; } }
    var notes = [], n1 = quiet(function () { return buildMergeConfirmNudge(); }).r, n2 = quiet(function () { return buildProvisionalNudge(); }).r;
    notes = noteTags(n1).concat(noteTags(n2)).map(function (x) { return x.replace("<Their Proper Name>", pick(["Vessa Thorn", "Hilda Underbough", "Queen Underbough"])); });
    (String(n2 || "").match(/\[MERGE:npc\|<Their Proper Name>\|[^\]]+\]/g) || []).forEach(function (x) { notes.push(x.replace("<Their Proper Name>", pick(["Vessa Thorn", "Hilda Underbough", "Queen Underbough", "Marigold"]))); });
    worldState.turn++;
    var reply = "", nt = 1 + Math.floor(rnd() * 3), j; for (j = 0; j < nt; j++) reply += genTag(notes) + " ";
    step.reply = reply.trim(); seqObj.steps.push(step); replies++;
    var pre = snap(), before = {}; provKeys().forEach(function (k) { before[k] = memory.npcs[k].provisional.of; });
    var res; try { res = run(reply); } catch (e) { note("THROW " + e.message, seqObj, hit); break; }
    provKeys().forEach(function (k) { everKeys[k] = 1; provOf[k] = memory.npcs[k].provisional.of; });
    (res.muts || []).forEach(function (mu) { var mm = String(mu).match(/^Merged: (.+) -> (.+)$/); if (!mm) return;
      if (before[mm[1]] && !memory.npcs[mm[1]] && resolveNpcName(mm[2]) !== resolveNpcName(before[mm[1]])) renamed[mm[1]] = mm[2];
      if (pre.armed === mm[2] + "|" + mm[1] || !pre.refs) confirmedInto[mm[2]] = 1; });
    var vs = checkReply(pre, res, reply).concat(checkNotes(renamed, confirmedInto)), a;
    for (a = 0; a < vs.length; a++) note(vs[a], seqObj, hit);
  }
  var st = checkStranded(); for (t = 0; t < st.length; t++) note(st[t], seqObj, hit);
  ALL.push(seqObj);
}
var out = Object.keys(found).sort().map(function (k) { return { sig: k, count: counts[k], seq: found[k] }; });
fs.writeFileSync(__dirname + "/out_" + label + ".json", JSON.stringify(out, null, 1));
fs.writeFileSync(__dirname + "/seqs_" + label + ".json", JSON.stringify(ALL));
out.forEach(function (o) { console.log("\n### " + o.sig + "  [" + o.count + " of " + N + "]  refs=" + o.seq.cfg.refs + " open=" + o.seq.cfg.open + "\n   " + o.seq.steps.map(function (x, i) { return "t" + (86 + i) + (x.swap ? " (hero swap -> " + x.swap + ")" : "") + ": " + x.reply; }).join("\n   ")); });
console.log("\n" + N + " sequences, " + replies + " replies; " + out.length + " distinct violation(s) on tree " + TREE);
