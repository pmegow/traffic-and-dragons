// sweep-arm-metrics.js — mechanical scoreboard metrics for ONE model-sweep arm corpus.
//   node dev/sweep-arm-metrics.js <corpus.json> [threadNoun,threadNoun,...]
//
// Recomputes the sweep-report scoreboard numbers (SWEEP_five_arms_v1645.html shape) from a
// playtest corpus so every arm in a comparison is measured by the SAME computation:
//   contract ① — zero-tag turn-calls, distinct/total tags, unknown-tag census (known list
//     derived FROM the loaded engine: TAG_TABLE[].t + TAG_NO_HANDLER + the strip arrays —
//     never a hand list; the 2026-08-15 audit falsely flagged legit tags off a hand census);
//   contract ② — dead-actor CANDIDATES ([NPC:name|death-status] then the name appearing in a
//     LATER narration: mechanical substring flags for a human judge — appearing as a corpse is
//     legal, speaking is not) and death-tag turns; thread-noun retention (turn counts);
//   character — narration chars mean/median, per-turn seconds median (committed-turn driver's
//     t stamps), HP-bounds sanity, errors.
// Output: one JSON object on stdout. Judgment stays with the reader — this file only counts.
var fs = require("fs");
var path = require("path");
var root = path.join(__dirname, "..");
var files = require("./engine-manifest.js").map(function (e) { return e.file; });
var geval = eval;
for (var i = 0; i < files.length; i++) {
  try { geval(fs.readFileSync(path.join(root, files[i]), "utf8")); }
  catch (e) { console.error("ENGINE LOAD FAILED in " + files[i] + ": " + e.message); process.exit(1); }
}

var corpusPath = process.argv[2];
if (!corpusPath) { console.error("usage: node dev/sweep-arm-metrics.js <corpus.json> [noun,noun,...]"); process.exit(1); }
var corpus = JSON.parse(fs.readFileSync(corpusPath, "utf8"));
var threadNouns = (process.argv[3] || "soul-forge,caravan").split(",").map(function (s) { return s.trim().toLowerCase(); }).filter(Boolean);

// Known census from the LOADED engine (tag_table.js is the single authority).
var known = {};
TAG_TABLE.forEach(function (e) { known[e.t] = 1; });
TAG_NO_HANDLER.forEach(function (n) { known[n] = 1; });
TAG_STRIP_NAMES.forEach(function (n) { known[n] = 1; });
TAG_STRIP_BARE.forEach(function (n) { known[n] = 1; });

var TAG_RE = /\[([A-Z][A-Z_0-9]{1,40})(?::|\])/g;
var raw = corpus.raw || [];
var log = corpus.log || [];

var zeroTag = 0, total = 0, distinct = {}, unknown = {};
raw.forEach(function (r) {
  var txt = String(r.raw || ""), m, any = false;
  TAG_RE.lastIndex = 0;
  while ((m = TAG_RE.exec(txt))) {
    any = true; total++;
    distinct[m[1]] = (distinct[m[1]] || 0) + 1;
    if (!known[m[1]]) unknown[m[1]] = (unknown[m[1]] || 0) + 1;
  }
  if (!any) zeroTag++;
});

// Dead-actor candidates: death-status [NPC:] tags, then the name in any LATER narration.
var deaths = [];
raw.forEach(function (r) {
  var m, re = /\[NPC:([^|\]]+)\|([^|\]]+)(?:\|[^\]]*)?\]/g;
  while ((m = re.exec(String(r.raw || "")))) {
    if (/\b(dead|dies|died|slain|killed|deceased|executed)\b/i.test(m[2]))
      deaths.push({ name: m[1].trim(), turn: r.turn });
  }
});
var deadActorCandidates = [];
deaths.forEach(function (d) {
  var token = d.name.split(/\s+/)[0];
  if (token.length < 3) return;
  log.forEach(function (e) {
    if (e.turn > d.turn && e.narration && e.narration.indexOf(token) >= 0)
      deadActorCandidates.push({ name: d.name, deadTurn: d.turn, laterTurn: e.turn });
  });
});

// Thread retention: turns whose narration carries each noun.
var threads = {};
threadNouns.forEach(function (n) {
  threads[n] = log.filter(function (e) { return (e.narration || "").toLowerCase().indexOf(n) >= 0; }).length;
});

function median(a) { if (!a.length) return null; var s = a.slice().sort(function (x, y) { return x - y; }); var h = Math.floor(s.length / 2); return s.length % 2 ? s[h] : (s[h - 1] + s[h]) / 2; }
var narLens = log.map(function (e) { return (e.narration || "").length; });
var turnSecs = [], cleanSecs = [];
var errTurns = (corpus.errors || []).map(function (e) { return e.turn; });
for (var j = 1; j < log.length; j++) if (log[j].t && log[j - 1].t) {
  var dt = (log[j].t - log[j - 1].t) / 1000;
  turnSecs.push(dt);
  // A gap is CLEAN when no error (back-off, rate-limit) landed inside it — the five-arms
  // report's "measured, clean turns" convention, so storm-era arms stay speed-comparable.
  var dirty = errTurns.some(function (t) { return t >= log[j - 1].turn && t <= log[j].turn; });
  if (!dirty) cleanSecs.push(dt);
}
var hpBreaks = log.filter(function (e) { return !(e.hp >= 0 && e.hp <= e.maxHp); }).map(function (e) { return e.turn; });

console.log(JSON.stringify({
  corpus: path.basename(corpusPath),
  turns: log.length, rawResponses: raw.length, errors: (corpus.errors || []).length,
  contract1: {
    zeroTagResponses: zeroTag,
    totalTags: total,
    distinctTags: Object.keys(distinct).length,
    unknownTags: unknown
  },
  contract2: {
    deathTags: deaths,
    deadActorCandidates: deadActorCandidates,
    threadTurnCounts: threads
  },
  character: {
    narrationCharsMedian: median(narLens),
    narrationCharsMean: narLens.length ? Math.round(narLens.reduce(function (a, b) { return a + b; }, 0) / narLens.length) : null,
    secondsPerTurnMedian: turnSecs.length ? Math.round(median(turnSecs) * 10) / 10 : null,
    cleanSecondsPerTurnMedian: cleanSecs.length ? Math.round(median(cleanSecs) * 10) / 10 : null,
    cleanTurnGaps: cleanSecs.length,
    hpBoundsBreaks: hpBreaks
  },
  tagHistogramTop: Object.keys(distinct).sort(function (a, b) { return distinct[b] - distinct[a]; }).slice(0, 12)
    .map(function (k) { return k + ":" + distinct[k]; })
}, null, 2));
