// w6-reach-audit.js — #182: the corpus-measured REACH pass for the W6 identity validator.
// #169 (P4) closed as a PRECISION fix and deferred three recall expansions with the reason
// "recall work must not ride a precision fix; wants its own measured pass". This is that pass.
//
// Candidates (from the deferral):
//   A. semicolon joins       — "Ammut falls; she rises" is ONE sentence to the current splitter,
//                              so the post-semicolon pronoun is never checked.
//   B. clause-anchored       — "Ammut falls, and she rises" — a coordinate-clause pronoun inside
//                              the anchored sentence itself is never checked.
//   C. fronted possessives   — "Ammut's blade rings. She steps back." — P4b made possessives a
//                              NON-anchor (precision fix); as a RECALL candidate the owner of a
//                              fronted possessive may still be the salient antecedent.
//
// Method: harvest every prose tier from the real save exports (chapters, eras, archived
// chapters, eventHistory, lore, decisions), build each save's own identity table, run the
// CURRENT validator (baseline) and each candidate variant, and print every NEW flag with its
// source so a human judges TP/FP. Historical canon is presumed mostly-valid: a flood of new
// flags = false positives = the candidate dies with numbers attached (the P4 discipline).
//
// Usage: node dev/w6-reach-audit.js <save.tnd> [more saves…]
// READ-ONLY: no file is written, no save is mutated.
var fs = require("fs"), path = require("path");
var eng = require("./load-engine.js");
eng.loadEngine();
global.addMsg = function () {}; global.showToast = function () {}; global.syncUI = function () {};
global.updateMemStatus = function () {}; global.saveAll = function () {}; global.carNotify = function () {};

/* ── the three candidate variants, forked from identity.js _w6TextConflict (v1.615) ────────
   Forked ON PURPOSE for measurement only: the winning behavior gets ported into identity.js
   with failing-first tests; the losers die here with their numbers. */
function conflictVariant(text, table, opts) {
  var s = String(text || ""), sq = (s.match(/"/g) || []).length;
  if (sq % 2 || (s.match(/“/g) || []).length !== (s.match(/”/g) || []).length) return null;
  var re = opts.semicolon ? /[^.!?;]+(?:[.!?;]+["”]*|$)/g : /[^.!?]+(?:[.!?]+["”]*|$)/g;
  var m, prior = null;
  while ((m = re.exec(s))) {
    var sent = m[0], low = sent.toLowerCase(), named = [], i, f;
    if (/["“”]/.test(sent)) { prior = null; continue; }
    for (i = 0; i < table.rows.length; i++) if (_w6TextHasName(low, table.rows[i])) named.push(table.rows[i]);
    if (named.length === 0 && prior) {
      f = _w6SubjectFamily(sent);
      if ((prior.family === "M" || prior.family === "F") && f && f !== prior.family) return { row: prior, sentence: sent.trim(), found: _w6Pronouns(f) };
    }
    var anchor = named.length === 1 && _w6StartsWithName(sent, named[0]) ? named[0] : null;
    if (!anchor && opts.possessive && named.length === 1) {
      // fronted possessive: the sentence starts with "Name's …"
      var lowTrim = low.replace(/^\s+/, ""), a = [named[0].name].concat(named[0].aliases || []), j, n;
      for (j = 0; j < a.length; j++) { n = String(a[j]).toLowerCase(); if (lowTrim.indexOf(n) === 0 && /^['’]s\b/.test(lowTrim.slice(n.length))) { anchor = named[0]; break; } }
    }
    if (opts.clause && named.length === 1 && anchor) {
      // clause-anchored: inside the anchored sentence, a post-name coordinate clause whose
      // subject pronoun contradicts the anchor ("Ammut falls, and she rises")
      var tail = low.split(/,\s*(?:and|but|then|so)\s+|;\s*/).slice(1), k;
      for (k = 0; k < tail.length; k++) {
        f = _w6SubjectFamily(tail[k]);
        if ((anchor.family === "M" || anchor.family === "F") && f && f !== anchor.family) return { row: anchor, sentence: sent.trim(), found: _w6Pronouns(f) };
      }
    }
    prior = anchor;
  }
  return null;
}

/* ── corpus harvest ─────────────────────────────────────────────────────────────────────── */
var saves = process.argv.slice(2);
if (!saves.length) { console.error("usage: node dev/w6-reach-audit.js <save.tnd> [more…]"); process.exit(1); }
var VARIANTS = [
  { key: "A semicolon", opts: { semicolon: true } },
  { key: "B clause", opts: { clause: true } },
  { key: "C possessive", opts: { possessive: true } },
  { key: "A+B+C", opts: { semicolon: true, clause: true, possessive: true } }
];
var totals = { pieces: 0, baseline: 0 };
VARIANTS.forEach(function (v) { totals[v.key] = 0; });

saves.forEach(function (p) {
  var save = JSON.parse(fs.readFileSync(path.resolve(p), "utf8"));
  global.worldState = save.worldState; global.memory = save.memory; global.sessionLog = save.sessionLog || [];
  var pieces = [];
  function add(src, txt) { if (typeof txt === "string" && txt.trim()) pieces.push({ src: src, text: txt }); }
  (memory.chapters || []).forEach(function (c, i) { add("chapters[" + i + "] t" + c.turn, c.summary); });
  (memory.eras || []).forEach(function (e, i) { add("eras[" + i + "]", e.summary); });
  ((memory.archive && memory.archive.chapters) || []).forEach(function (c, i) { add("archive.chapters[" + i + "]", c.summary || c.text || ""); });
  (worldState.eventHistory || []).forEach(function (e, i) { add("eventHistory[" + i + "]", e.summary || e.text || ""); });
  (memory.lore || []).forEach(function (l, i) { add("lore[" + i + "]", typeof l === "string" ? l : (l && l.text) || ""); });
  (memory.keyDecisions || []).forEach(function (d, i) { add("decisions[" + i + "]", typeof d === "string" ? d : (d && d.desc) || ""); });
  var table = summaryIdentityTable(pieces.map(function (x) { return x.text; }).join("\n"));
  var name = path.basename(p);
  console.log("== " + name + " — " + pieces.length + " prose pieces, " + table.rows.length + " identity rows ==");
  totals.pieces += pieces.length;
  pieces.forEach(function (pc) {
    var base = _w6TextConflict(pc.text, table);
    if (base) { totals.baseline++; console.log("  [BASELINE FLAG] " + pc.src + ": " + base.row.name + " vs " + base.found + " — \"" + base.sentence.slice(0, 120) + "\""); }
    VARIANTS.forEach(function (v) {
      var hit = conflictVariant(pc.text, table, v.opts);
      if (hit && !base) { totals[v.key]++; console.log("  [" + v.key + " NEW FLAG] " + pc.src + ": " + hit.row.name + " (" + hit.row.pronouns + ") vs " + hit.found + "\n      \"" + hit.sentence.slice(0, 160) + "\""); }
    });
  });
});

/* ── recall set: the true-positive fixtures every variant must still (or newly) catch ────── */
console.log("\n== recall fixtures ==");
global.worldState = { character: { name: "Ammut", gender: "M", aliases: [] }, npcs: [], turn: 1 };
global.memory = { npcs: {} };
var rt = summaryIdentityTable("Ammut is present.");
var RECALL = [
  { name: "t1644 class (adjacent sentence — baseline must catch)", text: "Ammut spins, sword coming up. Invisible, boots silent, she crosses the chamber.", want: ["baseline", "A semicolon", "B clause", "C possessive", "A+B+C"] },
  { name: "semicolon join", text: "Ammut takes the west stair; she bars the door behind her.", want: ["A semicolon", "A+B+C"] },
  { name: "coordinate clause", text: "Ammut falls hard, and she rises slowly.", want: ["B clause", "A+B+C"] },
  { name: "fronted possessive", text: "Ammut's hand trembles on the hilt. She steadies it.", want: ["C possessive", "A+B+C"] }
];
RECALL.forEach(function (r) {
  var got = [];
  if (_w6TextConflict(r.text, rt)) got.push("baseline");
  VARIANTS.forEach(function (v) { if (conflictVariant(r.text, rt, v.opts)) got.push(v.key); });
  console.log("  " + r.name + ": caught by [" + got.join(", ") + "] — wanted at least [" + r.want.join(", ") + "]");
});

console.log("\n== totals ==");
console.log("prose pieces: " + totals.pieces + " | baseline flags: " + totals.baseline);
VARIANTS.forEach(function (v) { console.log("  " + v.key + ": +" + totals[v.key] + " new flag(s)"); });
console.log("\nJudge every NEW flag above: on presumed-valid historical canon, a new flag is a\nfalse positive unless the source text is a genuine latent misgendering. Ship only\nvariants whose additions are zero or true-positive (the P4 discipline).");
