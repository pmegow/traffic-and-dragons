// Differential fuzz (reviewer). Seeded scenarios (mulberry32), the same list for every tree; one JSON line per scenario.
// argv: <tree> <count> <seed> <outfile>
require("./common.js");
var fs = require("fs");
var COUNT = parseInt(process.argv[3] || "400", 10), SEED = parseInt(process.argv[4] || "538", 10), OUT = process.argv[5];
function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
var rnd = mulberry32(SEED);
function pick(a) { return a[Math.floor(rnd() * a.length)]; }
function chance(p) { return rnd() < p; }
var HEROES = ["Tess", "Silas Morne", "Bram Stoneheart", "Wren"];
var EPITHETS = ["the Butcher", "Stormborn", "the Stranger", "Red Hand", "Old Morne"];
function pool(h, eps) {
  var first = h.split(" ")[0], last = h.split(" ").slice(-1)[0];
  var p = ["Bram", "Mara", "Old Maren", "Garrick", "Frizwick", "the Butcher", "Butcher", "the Stranger", "Red Hand", "Stormborn", "Aldus Morne", "Old Morne", "Lady Morne", "Morne", "Lord Stoneheart", "Stoneheart",
    h, h.toUpperCase(), " " + h + " ", "player", "Player", "The Player", first, last, first + "'s mother", h + "'s brother", "Old " + last, "Father " + last, h + " (the hero)"];
  eps.forEach(function (e) { p.push(e); p.push(e.toUpperCase()); });
  p.push("Old Frizwick"); p.push("Frizwick's sister"); p.push("Frizwick the Bold");
  return p;
}
var TEMPL = ["[NPC:{A}|grim|ally]", "[NPC:{A}|dead|enemy]", "[NPC:{A}|wary|he/him]", "[NPC_NOTE:{A}|a fact]", "[NPC_SUPERSEDE:{A}|fact|new truth]", "[NPC_PRONOUN:{A}|she/her]", "[NPC_PRONOUN:{A}|he/him]", "[NPC_ALIAS:{A}|{B}]", "[NPC_MERGE:{A}|{B}]", "[MERGE:npc|{A}|{B}]", "[ALIAS:npc|{A}|{B}]",
  "[PARTY_MEMBER:{A}|true]", "[PARTY_MEMBER:{A}|false]", "[NPC_DEATH_REPORTED:{A}|a rider]", "[NPC_FORGET:{A}|fact]", "[NPC_LINK:{A}|{B}|kin]", "[NPC_FACTION:{A}|The Guild|member]", "[COMPANION_RELATIONSHIP:Frizwick|{A}|ally|trusted]", "[RELATIONSHIP:{A}|ally|trusted]"];
function canonState() {
  var mem = {}, ks = Object.keys(memory.npcs).sort();
  ks.forEach(function (k) { var m = memory.npcs[k]; mem[k] = { ev: (m.events || []).map(function (e) { return e.note; }), kn: (m.knowledge || []).slice(), al: (m.aliases || []).slice().sort(), pr: m.pronouns || null, dead: m.dead ? 1 : 0, pm: !!m.partyMember }; });
  var rows = worldState.npcs.map(function (n) { return { n: n.name, st: n.status, rel: n.rel, pm: !!n.partyMember, pr: n.pronouns || null, al: (n.aliases || []).slice().sort(), dead: n.dead ? 1 : 0, sheet: !!n.charSheet, bonds: n.charSheet ? (n.charSheet.relationships || []).map(function (r) { return r.entity + ":" + (r.bond || ""); }).sort() : null, sal: n.charSheet ? (n.charSheet.aliases || []).slice() : null }; }).sort(function (a, b) { return a.n < b.n ? -1 : a.n > b.n ? 1 : 0; });
  return { hero: worldState.character.name, ep: (worldState.character.aliases || []).slice(), hb: (worldState.character.relationships || []).map(function (r) { return r.entity + ":" + (r.bond || ""); }).sort(), mem: mem, rows: rows, graph: ((memory.npcGraph || {}).edges || []).map(function (e) { return e.a + "~" + e.b; }).sort(), fac: Object.keys((memory.npcGraph || {}).npcFactions || {}).sort() };
}
function violations() {
  var v = [], h = worldState.character.name;
  Object.keys(memory.npcs).forEach(function (k) { if (memoryNpcIsPlayer(k)) v.push("memkey:" + k); (memory.npcs[k].aliases || []).forEach(function (a) { if (memoryNpcIsPlayer(a)) v.push("memalias:" + k + ">" + a); }); });
  worldState.npcs.forEach(function (n) { if (memoryNpcIsPlayer(n.name)) v.push("row:" + n.name); (n.aliases || []).forEach(function (a) { if (memoryNpcIsPlayer(a)) v.push("rowalias:" + n.name + ">" + a); }); });
  [h].concat(worldState.character.aliases || []).forEach(function (n) { var r = resolveNpcName(n); if (r !== n) v.push("resolves:" + n + ">" + r); });
  return v;
}
var out = [], i;
for (i = 0; i < COUNT; i++) {
  var hero = pick(HEROES), eps = chance(0.5) ? [pick(EPITHETS)] : [], swap = chance(0.25), refs = chance(0.3), nReplies = 1 + Math.floor(rnd() * 4), replies = [], r, t, P0 = pool(hero, eps), seedNpcs = [];
  var nSeed = Math.floor(rnd() * 3); for (r = 0; r < nSeed; r++) seedNpcs.push(pick(["Aldus Morne", "Old Maren", "Garrick", "Mara", "the Stranger", "Lord Stoneheart", hero.split(" ")[0] + "'s mother"]));
  for (r = 0; r < nReplies; r++) { var n = 1 + Math.floor(rnd() * 3), tags = []; for (t = 0; t < n; t++) tags.push(pick(TEMPL).split("{A}").join(pick(P0)).split("{B}").join(pick(P0))); replies.push(tags.join(" ")); }
  // build
  world({ hero: hero, refs: refs }); worldState.character.aliases = eps.slice(); if (!memory.map) memory.map = { nodes: {}, edges: [], lastArrivalFrom: null };
  seedNpcs.forEach(function (nm) { if (memoryNpcIsPlayer(nm) || wsNpcByName(nm)) return; worldState.npcs.push({ name: nm, status: "present", rel: "neutral", met: 1, partyMember: false, pronouns: null, portrait: null, aliases: [] }); memory.npcs[nm] = { attitude: "", knowledge: ["fact one"], events: [], aliases: [] }; });
  var sw = null;
  if (swap) { var fz = wsNpcByName("Frizwick"); fz.charSheet.gender = "F"; fz.charSheet.skills = initSkills(); sw = quiet(function () { return swapPlayerCharacter("Frizwick"); }).r; }
  var rec = { i: i, hero: hero, eps: eps, swap: swap && sw && sw.ok, refs: refs, seed: seedNpcs, replies: replies, muts: [], err: null, start: violations() };
  try { for (r = 0; r < replies.length; r++) { worldState.turn++; var rr = run("It happens. " + replies[r]); rec.muts.push(rr.muts); rr.warns.forEach(function (w) { if (w.indexOf("[memory] a note for the player identity") >= 0) rec.writerRefusals = (rec.writerRefusals || 0) + 1; if (w.indexOf("NPC_DEATH_REPORTED for the PLAYER") >= 0) rec.reportedDeathRefusals = (rec.reportedDeathRefusals || 0) + 1; }); } } catch (e) { rec.err = String(e && e.message); }
  rec.state = canonState(); rec.viol = violations(); rec.heroNow = worldState.character.name; rec.epsNow = (worldState.character.aliases || []).slice();
  // refusals whose operand is NOT exactly a player name (refused through resolution only)
  rec.viaResolve = [];
  rec.muts.forEach(function (ms) { ms.forEach(function (m) { var mm = /refused \(player\): (.*)$/.exec(m); if (mm && !memoryNpcIsPlayer(mm[1])) rec.viaResolve.push(m); }); });
  out.push(JSON.stringify(rec));
}
fs.writeFileSync(OUT, out.join("\n") + "\n");
console.log(ver() + " wrote " + out.length + " scenarios to " + OUT);
