// Probe 7: #533 differential — the word tables/sets before (282a45ef) and after (6d9642ff). Prints one line per case; diff the two outputs.
// usage: ER=<tree> node p7_533diff.js > out.txt
require("./h.js");
function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
var rnd = mulberry32(0xC0FFEE);
function ri(n) { return Math.floor(rnd() * n); }
function pick(a) { return a[ri(a.length)]; }
var TITLES = ["Sheriff", "Father", "Mother", "Lord", "Lady", "Ser", "Sir", "Captain", "Master", "Mistress", "Brother", "Sister", "Saint", "St", "King", "Queen", "Prince", "Princess", "Dame", "Elder", "Dr", "Doctor", "Professor", "The", "Old", "Young", "A", "An", "Man", "Woman", "Girl", "Boy", "Stranger", "Guard", "Barkeep", "Keeper", "Innkeeper", "Merchant", "Wife", "Husband", "Soldier", "Priest", "Priestess", "Mage", "Wizard", "Knight", "Thief", "Beggar", "Drunk", "Unnamed", "Duke", "Baron", "Count", "Emperor", "Uncle", "Aunt", "Widow", "Son", "Daughter", "Junior", "Jr", "Sr", "Senior", "Older", "Younger", "of", "and", "or", "the"];
var NAMESV = ["Belor", "Hemlock", "Morwen", "Zethran", "Ameiko", "Kaijitsu", "Tam", "Bram", "Isolde", "Marsh", "Wilhelmina", "Underbough", "Malrik", "Savah", "Frizwick", "Daeris", "Nyla", "Lorrath", "Victor", "Marlow", "Shalelu", "Ammut", "Silas", "Morne", "King", "Young", "Rose", "Hope", "Vex", "Al", "Bo", "Xi"];
var ODD = ["prototype", "toString", "tostring", "valueOf", "valueof", "hasOwnProperty", "hasownproperty", "__proto__", "isPrototypeOf", "toLocaleString", "watch", "length", "name", "caller", "arguments", "(Rusty Dragon)", "(the elder)", "O'Brien", "d'Arc", "Jean-Luc", "N'kosi", "III", "2nd", "x9"];
var WORDS = ["find", "finding", "finds", "the", "pin", "clasp", "retrieve", "about", "after", "again", "glassworks", "merchant's", "wine", "cellar", "ask", "tell", "where", "would", "your", "sword", "dragon", "village", "tavern", "letters", "letter", "stolen", "stole", "steal", "bridge", "bridges", "crossing", "crossed", "running", "runs", "ran", "happily", "storm", "storms", "with", "into", "want", "wanted", "debts", "debt", "paid", "paying"];
function name(withCtor) {
  var n = 1 + ri(4), parts = [], i;
  for (i = 0; i < n; i++) { var r = rnd(); parts.push(r < 0.35 ? pick(TITLES) : r < 0.85 ? pick(NAMESV) : pick(ODD)); }
  if (withCtor) parts.splice(ri(parts.length + 1), 0, pick(["Constructor", "constructor", "the Constructor", "CONSTRUCTOR"]));
  if (rnd() < 0.2) parts = parts.map(function (p) { return rnd() < 0.5 ? p.toLowerCase() : p; });
  return parts.join(" ");
}
function text(withCtor) {
  var n = 3 + ri(14), parts = [], i;
  for (i = 0; i < n; i++) { var r = rnd(); parts.push(r < 0.6 ? pick(WORDS) : r < 0.8 ? pick(NAMESV) : r < 0.9 ? pick(TITLES) : pick(ODD)); }
  if (withCtor) parts.splice(ri(parts.length + 1), 0, "constructor");
  return parts.join(rnd() < 0.1 ? ", " : " ");
}
function safe(fn) { try { return fn(); } catch (e) { return "THROW " + e.message; } }
function J(v) { return JSON.stringify(v, function (k, x) { return (x && typeof x === "object" && !Array.isArray(x) && Object.getPrototypeOf(x) === null) ? Object.assign({}, x) : x; }); }
var CASES = 6000, c;
for (c = 0; c < CASES; c++) {
  var ctor = c % 6 === 5;
  makeWorld();
  // a roster of 6 names on file (both stores), with pronouns and aliases
  var roster = [], i;
  for (i = 0; i < 6; i++) { var nm = name(ctor && i === 0); if (roster.indexOf(nm) >= 0 || !nm.trim()) continue; roster.push(nm); }
  roster.forEach(function (nm, ix) {
    memory.npcs[nm] = { attitude: "friendly", knowledge: ["k" + ix], events: [{ turn: 1, note: "met" }], aliases: ix === 1 ? [name(false)] : [], pronouns: ix % 3 === 0 ? "he/him" : ix % 3 === 1 ? "she/her" : "" };
    worldState.npcs.push({ name: nm, status: "calm", rel: "ally", met: 1, pronouns: memory.npcs[nm].pronouns });
  });
  var probeName = name(ctor), txt = text(ctor), txt2 = text(false);
  var out = { c: c, ctor: ctor, input: [roster, probeName, txt, txt2] };
  out.core = roster.map(function (n) { return safe(function () { return npcCoreTokens(n); }); });
  out.says = roster.map(function (n) { return safe(function () { return npcNameSays(n); }); });
  out.vt = roster.map(function (n) { return safe(function () { return npcVariantTokens(n); }); });
  out.vp = safe(function () { return quiet(function () { return npcVariantPairs(roster.concat([probeName])); }).r; });
  out.res = safe(function () { return resolveNpcName(probeName); });
  out.cons = safe(function () { return typeof npcConsolidation === "function" ? npcConsolidation(probeName) : null; });
  out.fe = safe(function () { return feTokens(txt); });
  out.qt = safe(function () { return ragQueryTerms(txt); });
  out.qb = safe(function () { return ragQueryBigrams(txt); });
  out.qe = safe(function () { return ragQueryEntities(txt + " " + roster.join(" and ")); });
  out.er = safe(function () { return ragEntitiesFromRaw("Prose. [NPC:" + probeName + "|calm|ally] [NPC_NOTE:" + roster[0] + "|note] " + txt2); });
  out.w2 = safe(function () { return w2SelfNamingCanon(probeName); });
  out.sa = safe(function () { return suggestionNameAlt(probeName); });
  out.sug = safe(function () { return getNameSuggestions(5, true); });
  // a full tag pass: NPC upsert + note + death report (resolver + death gate) on a world with scene refs off and on
  out.muts = safe(function () { var r = run("She nods. [NPC:" + probeName + "|wary|acquaintance] [NPC_NOTE:" + probeName + "|" + txt2 + "] [FUTURE_EVENT:" + txt + "|soon]"); return { m: r.muts, e: (r.r && r.r.errors) || [], w: r.warns.length }; });
  out.npcsAfter = Object.keys(memory.npcs).sort();
  console.log(J(out));
}
