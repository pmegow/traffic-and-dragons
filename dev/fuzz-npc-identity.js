// dev/fuzz-npc-identity.js — the NPC identity sequence fuzzer (#504 / #534, rule 6: a fuzzer with a sound generator).
// Random tag sequences over a world with established people and open name questions (the #504 title question, the #156
// introduction), an "obedient GM" that answers the notes about half the time, case/spacing/near-miss spellings, hero names
// and a hero swap. Every reply is checked against invariants that hold whatever the GM writes: no throw, no handler error,
// no record vanishes without a merge receipt, no established record merges away under scene refs without a confirmed pair,
// no alias on two records, no record its own alias, no stale ° key, every provisional has a roster row, live keys resolve
// to themselves, a note written to the provisional never sits on the person it was split from (or any other established
// person) unless a confirmed merge put it there, a note written to an established person by her exact name stays with her,
// and every open question can still be answered. The SHORTEST sequence per distinct violation is printed.
// Derived from the second #504 reviewer's fuzzer (audits/reviews/504_titled_relative/review2 on branch claude/504-titled-relative).
//   node dev/fuzz-npc-identity.js [N=2000] [seed=4242] [swap]
var L = require("./load-engine.js"); L.loadEngine();
global.showToast = function () {}; global.syncUI = function () {}; global.saveAll = function () {};
var N = parseInt(process.argv[2] || "2000", 10), seed = parseInt(process.argv[3] || "4242", 10), SWAP = process.argv[4] === "swap";
var D = "°";
function rnd() { seed = (seed + 0x6D2B79F5) | 0; var t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }
function pick(a) { return a[Math.floor(rnd() * a.length)]; }
function quiet(fn) { var oc = console.warn, oi = console.info, ol = console.log; console.warn = console.info = console.log = function () {}; try { return fn(); } finally { console.warn = oc; console.info = oi; console.log = ol; } }
var ESTAB = ["Wilhelmina Underbough", "Isolde Marsh", "Savah", "Bram"];
function person(n, pron) {
  worldState.npcs.push({ name: n, status: "present", rel: "ally", pronouns: pron || null, met: 1, partyMember: false, portrait: null, aliases: [] });
  memory.npcs[n] = { attitude: "", knowledge: ["k1", "k2"], events: [], aliases: [], pronouns: pron || undefined };
}
function setupWorld(cfg) {
  L.makeTestWorld(); worldState.npcs = []; memory.npcs = {}; delete worldState.kind;
  if (cfg.refs) sceneRefsEnsure();
  ESTAB.forEach(function (n) { person(n, n === "Bram" ? "he/him" : "she/her"); });
  memory.npcs["Isolde Marsh"].aliases = ["The Ferrywoman"]; wsNpcByName("Isolde Marsh").aliases = ["The Ferrywoman"];
  worldState.turn = 85;
  if (cfg.open === "title") quiet(function () { applyMuts("[NPC:Queen Underbough|furious|hostile]"); });
  else if (cfg.open === "156") quiet(function () { applyMuts("[NPC:Savah|counting vials|unknown, not yet met]"); });
  else if (cfg.open === "both") quiet(function () { applyMuts("[NPC:Queen Underbough|furious|hostile] [NPC:Savah|counting vials|unknown, not yet met]"); });
}
function heroSwap(name) { var old = worldState.character.name; worldState.npcs = worldState.npcs.filter(function (n) { return n.name !== name; }); worldState.character.name = name; worldState.npcs.push({ name: old, status: "ally", rel: "companion", met: worldState.turn, partyMember: true, pronouns: "she/her", portrait: null, aliases: [] }); if (!memory.npcs[old]) memory.npcs[old] = { attitude: "", knowledge: [], events: [], aliases: [] }; }
function provKeys() { return Object.keys(memory.npcs).filter(function (k) { return memory.npcs[k].provisional; }); }
var everKeys, provOf;
function vary(n) { var r = rnd(); if (r < 0.78) return n; if (r < 0.84) return n.toLowerCase(); if (r < 0.88) return "The " + n; if (r < 0.91) return "Old " + n; if (r < 0.94) return n + " (her mother)"; if (r < 0.97) return n.replace(/ /, "_"); return n.replace(D + "t", D + "T"); }
function names() {
  var base = ["Wilhelmina Underbough", "Isolde Marsh", "Savah", "Bram", "Queen Underbough", "Lady Marsh", "Lady Underbough", "Princess Underbough", "King Underbough", "Mother Underbough",
    "Wilhelmina", "Underbough", "Isolde", "Marsh", "The Ferrywoman", "Queen Isolde Underbough", "Vessa Thorn", "Hilda Underbough", "Savah Dunmere", "Tess", "Player", worldState.character.name];
  return base.concat(Object.keys(everKeys)).concat(Object.keys(everKeys));
}
function nm() { return vary(pick(names())); }
var noteN = 0;
function stamp(n) { if (everKeys[n]) return "P:" + provOf[n] + ":" + n; if (ESTAB.indexOf(n) >= 0) return "E:" + n; return "x"; }
function mergeTag(c, d) { var r = rnd(); if (r < 0.45) return "[NPC_MERGE:" + c + "|" + d + "]"; if (r < 0.80) return "[MERGE:npc|" + c + "|" + d + "]"; if (r < 0.87) return "[MERGE:NPC|" + c + "|" + d + "]"; if (r < 0.93) return "[MERGE: npc |" + c + "|" + d + "]"; return "[MERGE:Npc| " + c + " | " + d + " ]"; }
function genTag(notes) {
  var r = rnd(), n = nm(), ek = Object.keys(everKeys);
  if (r < 0.20) return "[NPC:" + n + "|" + pick(["furious", "calm", "pacing"]) + "|" + pick(["hostile", "ally", "unknown, not yet met", ""]) + "]";
  if (r < 0.36) { var raw = pick(names()); if (memoryNpcIsPlayer(raw)) raw = "Bram"; return "[NPC_NOTE:" + raw + "|" + stamp(raw) + "#" + (++noteN) + "]"; }/* the hero as a NOTE/PRONOUN subject is #538, not this fuzzer's question */
  if (r < 0.40) return "[NPC_PRONOUN:" + (memoryNpcIsPlayer(n) ? "Bram" : n) + "|" + pick(["she/her", "he/him"]) + "]";
  if (r < 0.48) return (rnd() < 0.7 ? "[NPC_ALIAS:" : "[ALIAS:npc|") + nm() + "|" + pick(names().concat(["Her Majesty", "The Dowager", "Mina"])) + "]";
  if (r < 0.84) {
    if (notes.length && rnd() < 0.5) return pick(notes);
    var c = nm(), d = (ek.length && rnd() < 0.55) ? vary(pick(ek)) : nm();
    var t = mergeTag(c, d); return rnd() < 0.12 ? t + " " + t : t;
  }
  if (r < 0.91) return "[NPC_DEATH_REPORTED:" + n + "|a rider]";
  if (r < 0.95) return "[SCENE_REF:" + pick(["queen", "the rider", "hooded one"]) + "|" + n + "]";
  return "[SAY:" + n + "|Hm.]";
}
function noteTags(txt) { return (String(txt || "").match(/\[(?:NPC_MERGE|MERGE):[^\]<]+\]/g) || []); }
function snap() {
  var mem = {}, rows = {}, k;
  for (k in memory.npcs) { var m = memory.npcs[k]; mem[k] = { prov: !!m.provisional, of: m.provisional ? m.provisional.of : null, al: (m.aliases || []).slice(), dead: m.dead || null }; }
  worldState.npcs.forEach(function (n) { rows[n.name] = { dead: n.dead || null }; });
  var a = worldState.mergeConfirmArmed;
  return { mem: mem, rows: rows, armed: (a && a.turn === worldState.turn) ? a.canonical + "|" + a.duplicate : "", refs: !!worldState.sceneRefs, hero: worldState.character.name };
}
function isDeg(k) { return / °t\d+$/.test(k); }
function checkReply(pre, res) {
  var v = [], k, i, owners = {}, made = {};
  for (k in memory.npcs) { if (["events", "knowledge", "aliases"].some(function (f) { return (memory.npcs[k][f] || []).length > 50000; })) v.push("BLOWUP: a record list grew past 50,000 entries in one reply"); }
  if (res && res.errors && res.errors.length) v.push("HANDLER-ERROR " + String(res.errors[0]).replace(/'[^']*'/g, "'…'"));
  var merged = [], seenDup = {};
  (res.muts || []).forEach(function (mu) { var mm = String(mu).match(/^Merged: (.+) -> (.+)$/); if (mm) merged.push({ d: mm[1], c: mm[2] }); var am = String(mu).match(/^Alias: (.+) -> (.+)$/); if (am) made[am[2]] = 1; });
  for (k in memory.npcs) {
    var m = memory.npcs[k], al = m.aliases || [];
    if (al.indexOf(k) >= 0 && !(pre.mem[k] && pre.mem[k].al.indexOf(k) >= 0)) v.push("OWN-ALIAS: a record became its own alias");
    for (i = 0; i < al.length; i++) {
      if (owners[al[i]] && owners[al[i]] !== k) { var wasBoth = pre.mem[k] && pre.mem[owners[al[i]]] && pre.mem[k].al.indexOf(al[i]) >= 0 && pre.mem[owners[al[i]]].al.indexOf(al[i]) >= 0; if (!wasBoth) v.push("ALIAS-ON-TWO: one alias now sits on two records"); }
      owners[al[i]] = k;
      if (memory.npcs[al[i]] && al[i] !== k && !(pre.mem[al[i]] && pre.mem[k] && pre.mem[k].al.indexOf(al[i]) >= 0)) v.push("ALIAS-SHADOW: an alias is also another record's key");
    }
    if (!m.provisional && isDeg(k) && !(pre.mem[k] && !pre.mem[k].prov)) v.push("ZOMBIE: a ° key on file with no provisional stamp");
    if (m.provisional && !wsNpcByName(k)) v.push("PROV-NO-ROW: a provisional with no roster row");
    if (memoryNpcIsPlayer(k) && !pre.mem[k]) v.push("HERO-MEM: a memory record was made under the hero's name");
  }
  worldState.npcs.forEach(function (n) {
    if (memoryNpcIsPlayer(n.name) && !pre.rows[n.name]) v.push("HERO-ROW: a roster row was made under the hero's name");
    if (isDeg(n.name) && !(memory.npcs[n.name] && memory.npcs[n.name].provisional) && !pre.rows[n.name]) v.push("ZOMBIE-ROW: a ° roster row with no provisional behind it");
  });
  for (k in pre.mem) {
    if (memory.npcs[k]) continue;
    var rc = merged.filter(function (x) { return x.d === k; });
    if (!rc.length) v.push((pre.mem[k].prov ? "LOST-PROV" : "LOST-ESTABLISHED") + ": a memory record vanished with no merge receipt");
    else if (!pre.mem[k].prov && pre.refs && pre.armed !== rc[0].c + "|" + k) v.push("UNCONFIRMED: an established record was merged away with scene refs on and no confirmed pair");
  }
  for (k in pre.rows) { if (!wsNpcByName(k) && !merged.some(function (x) { return x.d === k; })) v.push("LOST-ROW: a roster row vanished with no merge receipt"); }
  merged.forEach(function (x) {
    if (!pre.mem[x.d] && !pre.rows[x.d] && !made[x.d]) v.push("FALSE-RECEIPT: 'Merged: X -> Y' for an X that was no record");
    if (seenDup[x.d]) v.push("DOUBLE-RECEIPT: the same duplicate merged twice in one reply");
    seenDup[x.d] = 1; made[x.c] = 1;
    if ((memory.npcs[x.d] || wsNpcByName(x.d)) && x.d !== x.c) v.push("STILL-THERE: a receipt names a duplicate that is still on file");
    if (!memory.npcs[x.c] && !wsNpcByName(x.c) && !merged.some(function (y) { return y.d === x.c; })) v.push("RECEIPT-TO-NOBODY: a receipt names a canonical that is on no record");
  });
  for (k in memory.npcs) { if (resolveNpcName(k) !== k) v.push("KEY-NOT-FIXED: a live key does not resolve to itself"); }
  return v;
}
function checkNotes(renamed, confirmedInto) {
  var v = [], k;
  for (k in memory.npcs) {
    var m = memory.npcs[k];
    (m.events || []).forEach(function (e) {
      var t = String((e && e.note) || ""), mm = t.match(/^P:([^:]+):([^#]+)#/), me = t.match(/^E:([^#]+)#/);
      if (mm) { var of = mm[1], key = mm[2];
        if (k === of && memory.npcs[key] && memory.npcs[key].provisional) v.push("P-ON-OF-WHILE-OPEN: a note written to an OPEN provisional sits on the person it was split from");
        if (ESTAB.indexOf(k) >= 0 && k !== of && !confirmedInto[k]) v.push("CROSS: a note written to a provisional sits on an established person it was never split from");
        if (k === of && renamed[key] && !confirmedInto[k]) v.push("STALE: after a landed DIFFERENT answer, a note written to the provisional's key sits on the person it was split from");/* a later GM-confirmed merge may fold the renamed person into them */
      }
      if (me) { var who = me[1]; if (who !== k && memory.npcs[who] && !confirmedInto[k]) v.push(m.provisional ? "E-ON-PROV: a note written to an established person by her exact name sits on a provisional" : "E-FORK: a note written to an established person by her exact name sits on another record while hers exists"); }
    });
  }
  return v;
}
function checkStranded() {
  var v = [], provs = provKeys(), ws0 = worldState, mem0 = memory, i;
  for (i = 0; i < provs.length; i++) {
    var P = provs[i], of = mem0.npcs[P].provisional.of;
    worldState = JSON.parse(JSON.stringify(ws0)); memory = JSON.parse(JSON.stringify(mem0));
    worldState.turn += 7; delete worldState.mergeConfirmArmed;
    try { quiet(function () { applyMuts("[MERGE:npc|Zzyzx Qwerty|" + P + "]"); }); } catch (e) { v.push("STRANDED-THROW " + e.message); }
    if (memory.npcs[P] || !memory.npcs["Zzyzx Qwerty"]) v.push("STRANDED-DIFFERENT: [MERGE:npc|<a brand-new name>|<provisional>] does not land");
    worldState = JSON.parse(JSON.stringify(ws0)); memory = JSON.parse(JSON.stringify(mem0));
    worldState.turn += 7; delete worldState.mergeConfirmArmed;
    if (!memoryNpcIsPlayer(of) && memory.npcs[of] && of !== P) {
      try { quiet(function () { applyMuts("[NPC_MERGE:" + of + "|" + P + "]"); }); } catch (e2) { v.push("STRANDED-THROW " + e2.message); }
      if (memory.npcs[P]) v.push("STRANDED-SAME: the note's own [NPC_MERGE:<of>|<provisional>] does not land");
    }
  }
  worldState = ws0; memory = mem0;
  return v;
}
var found = {}, counts = {}, replies = 0, s, t;
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
    var notes = [], n1 = quiet(function () { return buildMergeConfirmNudge(); }), n2 = quiet(function () { return buildProvisionalNudge(); });
    notes = noteTags(n1).concat(noteTags(n2)).map(function (x) { return x.replace("<Their Proper Name>", pick(["Vessa Thorn", "Hilda Underbough", "Queen Underbough", "Wilhelmina", "Savah Dunmere"])); });
    worldState.turn++;
    var reply = "", nt = 1 + Math.floor(rnd() * 3), j; for (j = 0; j < nt; j++) reply += genTag(notes) + " ";
    step.reply = reply.trim(); seqObj.steps.push(step); replies++;
    var pre = snap(), before = {}; provKeys().forEach(function (k) { before[k] = memory.npcs[k].provisional.of; });
    var res; try { res = quiet(function () { return applyMuts(reply); }); } catch (e) { note("THROW " + e.message, seqObj, hit); break; }
    provKeys().forEach(function (k) { everKeys[k] = 1; provOf[k] = memory.npcs[k].provisional.of; });
    (res.muts || []).forEach(function (mu) { var mm = String(mu).match(/^Merged: (.+) -> (.+)$/); if (!mm) return;
      if (before[mm[1]] && !memory.npcs[mm[1]] && resolveNpcName(mm[2]) !== resolveNpcName(before[mm[1]])) renamed[mm[1]] = mm[2];
      if (pre.armed === mm[2] + "|" + mm[1] || !pre.refs) confirmedInto[mm[2]] = 1; });
    var vs = checkReply(pre, res).concat(checkNotes(renamed, confirmedInto)), a;
    for (a = 0; a < vs.length; a++) note(vs[a], seqObj, hit);
  }
  var st = checkStranded(); for (t = 0; t < st.length; t++) note(st[t], seqObj, hit);
}
var out = Object.keys(found).sort().map(function (k) { return { sig: k, count: counts[k], seq: found[k] }; });
out.forEach(function (o) { console.log("\n### " + o.sig + "  [" + o.count + " of " + N + "]  refs=" + o.seq.cfg.refs + " open=" + o.seq.cfg.open + "\n   " + o.seq.steps.map(function (x, i) { return "t" + (86 + i) + (x.swap ? " (hero swap -> " + x.swap + ")" : "") + ": " + x.reply; }).join("\n   ")); });
console.log("\n" + N + " sequences, " + replies + " replies; " + out.length + " distinct violation(s)");
process.exit(out.length ? 1 : 0);
