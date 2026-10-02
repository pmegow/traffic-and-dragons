// agent2 — shared world + invariants for the sequence fuzzer and its replayer. Requires ./b.js first.
var D = "°";
global.ESTAB = ["Wilhelmina Underbough", "Isolde Marsh", "Savah", "Bram"];
global.setupWorld = function (cfg) {
  fresh({ refs: cfg.refs });
  person("Wilhelmina Underbough", "she/her"); person("Isolde Marsh", "she/her"); person("Savah", "she/her"); person("Bram", "he/him");
  memory.npcs["Isolde Marsh"].aliases = ["The Ferrywoman"]; wsNpcByName("Isolde Marsh").aliases = ["The Ferrywoman"];
  worldState.turn = 85;
  if (cfg.open === "title") quiet(function () { applyMuts("[NPC:Queen Underbough|furious|hostile]"); });
  else if (cfg.open === "156") quiet(function () { applyMuts("[NPC:Savah|counting vials|unknown, not yet met]"); });
  else if (cfg.open === "both") quiet(function () { applyMuts("[NPC:Queen Underbough|furious|hostile] [NPC:Savah|counting vials|unknown, not yet met]"); });
};
global.heroSwap = function (name) { // what swapPlayerCharacter leaves behind: the new hero's roster row is gone, her memory record stays; the old hero is a companion row
  var old = worldState.character.name;
  worldState.npcs = worldState.npcs.filter(function (n) { return n.name !== name; });
  worldState.character.name = name;
  worldState.npcs.push({ name: old, status: "ally", rel: "companion", met: worldState.turn, partyMember: true, pronouns: "she/her", portrait: null, aliases: [] });
  if (!memory.npcs[old]) memory.npcs[old] = { attitude: "", knowledge: [], events: [], aliases: [] };
};
global.snap = function () {
  var mem = {}, rows = {}, k;
  for (k in memory.npcs) { var m = memory.npcs[k]; mem[k] = { prov: !!m.provisional, of: m.provisional ? m.provisional.of : null, al: (m.aliases || []).slice(), dead: m.dead || null }; }
  worldState.npcs.forEach(function (n) { rows[n.name] = { dead: n.dead || null }; });
  var a = worldState.mergeConfirmArmed;
  return { mem: mem, rows: rows, armed: (a && a.turn === worldState.turn) ? a.canonical + "|" + a.duplicate : "", refs: !!worldState.sceneRefs, hero: worldState.character.name };
};
function isDeg(k) { return / °t\d+$/.test(k); }
// returns an array of violation signatures for ONE applied reply
global.checkReply = function (pre, res, reply) {
  var v = [], k, i, owners = {};
  for (k in memory.npcs) { var big = ["events", "knowledge", "aliases"].some(function (f) { return (memory.npcs[k][f] || []).length > 50000; }); if (big) { ["events", "knowledge", "aliases"].forEach(function (f) { if ((memory.npcs[k][f] || []).length > 50000) memory.npcs[k][f].length = 3; }); v.push("BLOWUP: a record list grew past 50,000 entries in one reply (truncated by the harness to go on)"); } }
  if (res.r && res.r.errors && res.r.errors.length) v.push("HANDLER-ERROR " + String(res.r.errors[0]).replace(/'[^']*'/g, "'…'"));
  var merged = [], seenDup = {};
  (res.muts || []).forEach(function (mu) { var mm = String(mu).match(/^Merged: (.+) -> (.+)$/); if (mm) merged.push({ d: mm[1], c: mm[2] }); });
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
  // records that vanished
  for (k in pre.mem) {
    if (memory.npcs[k]) continue;
    var rc = merged.filter(function (x) { return x.d === k; });
    if (!rc.length) v.push((pre.mem[k].prov ? "LOST-PROV" : "LOST-ESTABLISHED") + ": a memory record vanished with no merge receipt");
    else if (!pre.mem[k].prov && pre.refs && pre.armed !== rc[0].c + "|" + k) v.push("UNCONFIRMED: an established record was merged away with scene refs on and no confirmed pair");
  }
  for (k in pre.rows) { if (!wsNpcByName(k) && !merged.some(function (x) { return x.d === k; })) v.push("LOST-ROW: a roster row vanished with no merge receipt"); }
  // receipts
  var made = {};
  merged.forEach(function (x) {
    if (!pre.mem[x.d] && !pre.rows[x.d] && !made[x.d]) v.push("FALSE-RECEIPT: 'Merged: X -> Y' for an X that was no record");
    if (seenDup[x.d]) v.push("DOUBLE-RECEIPT: the same duplicate merged twice in one reply");
    seenDup[x.d] = 1; made[x.c] = 1;
    if ((memory.npcs[x.d] || wsNpcByName(x.d)) && x.d !== x.c) v.push("STILL-THERE: a receipt names a duplicate that is still on file");
    if (!memory.npcs[x.c] && !wsNpcByName(x.c) && !merged.some(function (y) { return y.d === x.c; })) v.push("RECEIPT-TO-NOBODY: a receipt names a canonical that is on no record");
  });
  // the resolver: live keys are fixed points, and resolution is idempotent over everything on file
  for (k in memory.npcs) { if (resolveNpcName(k) !== k) v.push("KEY-NOT-FIXED: a live key does not resolve to itself"); }
  return v;
};
// notes written to people: "E:<established key>#n" must stay on that person (or on whoever a CONFIRMED merge put them in);
// "P:<of>:<prov key>#n" must never sit on an established person other than <of>
global.checkNotes = function (renamed, confirmedInto) {
  var v = [], k;
  for (k in memory.npcs) {
    var m = memory.npcs[k];
    (m.events || []).forEach(function (e) {
      var t = String((e && e.note) || ""), mm = t.match(/^P:([^:]+):([^#]+)#/), me = t.match(/^E:([^#]+)#/);
      if (mm) { var of = mm[1], key = mm[2];
        if (k === of && memory.npcs[key] && memory.npcs[key].provisional) v.push("P-ON-OF-WHILE-OPEN: a note written to an OPEN provisional (its key, almost right) sits on the person it was split from");
        if (ESTAB.indexOf(k) >= 0 && k !== of && !confirmedInto[k]) v.push("CROSS: a note written to a provisional sits on an established person it was never split from");
        if (k === of && renamed[key]) v.push("STALE: after a landed DIFFERENT answer, a note written to the ° key sits on the person it was split from");
      }
      if (me) { var who = me[1];
        if (who !== k && memory.npcs[who] && !confirmedInto[k]) v.push(m.provisional ? "E-ON-PROV: a note written to an established person by her exact name sits on a provisional" : "E-FORK: a note written to an established person by her exact name sits on another record while hers exists");
      }
    });
  }
  return v;
};
// can the open questions still be answered? (run on a deep copy; state restored)
global.checkStranded = function () {
  var v = [], provs = Object.keys(memory.npcs).filter(function (k) { return memory.npcs[k].provisional; }), ws0 = worldState, mem0 = memory, i;
  for (i = 0; i < provs.length; i++) {
    var P = provs[i], of = mem0.npcs[P].provisional.of;
    worldState = JSON.parse(JSON.stringify(ws0)); memory = JSON.parse(JSON.stringify(mem0)); if (ws0.sceneRefs) worldState.sceneRefs = JSON.parse(JSON.stringify(ws0.sceneRefs));
    worldState.turn += 7; delete worldState.mergeConfirmArmed;
    try { quiet(function () { applyMuts("[MERGE:npc|Zzyzx Qwerty|" + P + "]"); }); } catch (e) { v.push("STRANDED-THROW " + e.message); }
    if (memory.npcs[P] || !memory.npcs["Zzyzx Qwerty"]) v.push("STRANDED-DIFFERENT: [MERGE:npc|<a brand-new name>|<provisional>] does not land");
    worldState = JSON.parse(JSON.stringify(ws0)); memory = JSON.parse(JSON.stringify(mem0));
    worldState.turn += 7; delete worldState.mergeConfirmArmed;
    var ofR = resolveNpcName(of);
    if (!memoryNpcIsPlayer(of) && !memoryNpcIsPlayer(ofR) && memory.npcs[ofR] && ofR !== P) {
      try { quiet(function () { applyMuts("[NPC_MERGE:" + of + "|" + P + "]"); }); } catch (e2) { v.push("STRANDED-THROW " + e2.message); }
      if (memory.npcs[P]) v.push("STRANDED-SAME: the note's own [NPC_MERGE:<of>|<provisional>] does not land");
    }
  }
  worldState = ws0; memory = mem0;
  return v;
};
module.exports = {};
