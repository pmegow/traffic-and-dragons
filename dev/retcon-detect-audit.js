// retcon-detect-audit.js — #187 ④b: the corpus precision audit that gates the un-tagged
// retraction detector. The design (DOC/Research/DOC_retcon_detection.html) ships the detector
// DISABLED until a full-transcript audit shows its alerts dominated by true positives (the
// #158 bar: the phase detector cleared enable at 1 alert / 328 turns, the true positive).
//
// What it measures: for every GM transcript entry with a preceding GM entry, scan the CLEAN
// prose (what commitGmTurn sees) for retraction-shaped cues, under the design's REQUIRED
// overlap condition — the firing sentence must name an entity present in the PREVIOUS GM
// entry's .e.n index (retractions are about something; free-floating "actually" is speech).
// Every fire prints with its turn, cue family, overlapped entity, the sentence, and the tail
// of the previous entry, for human TP/FP judgment. Fires that would happen WITHOUT the
// overlap condition are counted separately so the condition's value is itself measured.
//
// Usage: node dev/retcon-detect-audit.js <save.tnd> [more saves…]     READ-ONLY.
var fs = require("fs"), path = require("path");

var CUES = [
  { id: "C1 correction-label", re: /\bcorrection\s*[:,—-]/i },
  { id: "C2 in-truth+neg", re: /\bin truth\b[^.!?]*\b(?:never|not|no longer|wasn'?t|was not|weren'?t|isn'?t|is not|didn'?t|did not)\b/i },
  { id: "C3 actually+neg", re: /\bactually\b[^.!?]*\b(?:never|not|wasn'?t|was not|weren'?t|isn'?t|is not|didn'?t|did not)\b/i },
  { id: "C4 after-all+neg", re: /\b(?:never|not|wasn'?t|was not|weren'?t|isn'?t|is not|didn'?t|did not)\b[^.!?]*\bafter all\b/i },
  { id: "C5 turns-out+neg", re: /\b(?:as )?it turns? out\b[^.!?]*\b(?:never|not|wasn'?t|was not|weren'?t|isn'?t|is not|didn'?t|did not)\b/i },
  { id: "C6 never-actually", re: /\bnever (?:actually|really|truly)\b/i },
  { id: "C7 that-was-not", re: /\bthat (?:was|were) (?:not|never)\b[^.!?]*/i }
];

function sentences(s) { return String(s || "").match(/[^.!?]+[.!?]+["”]*|[^.!?]+$/g) || []; }
function hasEntity(sentLow, names) {
  var i, n;
  for (i = 0; i < names.length; i++) {
    n = String(names[i] || "").toLowerCase();
    if (!n) continue;
    var at = sentLow.indexOf(n);
    while (at >= 0) {
      var before = at === 0 ? "" : sentLow.charAt(at - 1), after = sentLow.charAt(at + n.length);
      if (!/[a-z0-9]/.test(before) && !/[a-z0-9]/.test(after)) return names[i];
      at = sentLow.indexOf(n, at + 1);
    }
  }
  return null;
}

var saves = process.argv.slice(2);
if (!saves.length) { console.error("usage: node dev/retcon-detect-audit.js <save.tnd> [more…]"); process.exit(1); }

var totals = { gmTurns: 0, withPrev: 0, fires: 0, noOverlapFires: 0, quoted: 0, perCue: {} };
CUES.forEach(function (c) { totals.perCue[c.id] = { overlap: 0, noOverlap: 0 }; });

saves.forEach(function (p) {
  var save = JSON.parse(fs.readFileSync(path.resolve(p), "utf8"));
  var tr = (save.worldState && save.worldState.transcript) || [];
  console.log("== " + path.basename(p) + " — " + tr.length + " entries ==");
  var prevGm = null;
  tr.forEach(function (e) {
    if (e.r !== "gm" || e.bk) return;
    totals.gmTurns++;
    var prev = prevGm; prevGm = e;
    if (!prev) return;
    totals.withPrev++;
    var prevNames = (prev.e && prev.e.n) || [];
    sentences(e.x).forEach(function (sent) {
      var low = sent.toLowerCase();
      CUES.forEach(function (c) {
        if (!c.re.test(sent)) return;
        var inQuote = /["“”]/.test(sent);  // speech territory — report, never count as a live fire
        var ent = prevNames.length ? hasEntity(low, prevNames) : null;
        if (inQuote) { totals.quoted++; return; }
        if (ent) {
          totals.fires++; totals.perCue[c.id].overlap++;
          console.log("  [FIRE " + c.id + "] t" + e.t + " entity=" + ent);
          console.log("      sent: \"" + sent.trim().slice(0, 170) + "\"");
          console.log("      prev(t" + prev.t + " tail): \"…" + String(prev.x).slice(-110).replace(/\n/g, " ") + "\"");
        } else {
          totals.noOverlapFires++; totals.perCue[c.id].noOverlap++;
          console.log("  [no-overlap " + c.id + "] t" + e.t + ": \"" + sent.trim().slice(0, 120) + "\"");
        }
      });
    });
  });
});

console.log("\n== totals ==");
console.log("GM turns: " + totals.gmTurns + " (" + totals.withPrev + " with a preceding GM turn)");
console.log("LIVE fires (cue + previous-turn entity overlap): " + totals.fires);
console.log("suppressed by the overlap condition: " + totals.noOverlapFires + " | suppressed as quoted speech: " + totals.quoted);
Object.keys(totals.perCue).forEach(function (k) {
  var c = totals.perCue[k];
  if (c.overlap || c.noOverlap) console.log("  " + k + ": " + c.overlap + " live, " + c.noOverlap + " overlap-suppressed");
});
console.log("\nJudge every LIVE fire above (TP = the narration genuinely retracts the prior turn's");
console.log("content). The #158 enable bar: alerts dominated by true positives on a full transcript.");
