// Per-sequence differential: which violations does HEAD show that BEFORE does not (regressions), and the reverse (fixed)?
// usage: node f04_compare.js <label>      (no engine needed)
var fs = require("fs"), label = process.argv[2] || "run";
var seqs = JSON.parse(fs.readFileSync(__dirname + "/seqs_" + label + ".json", "utf8"));
var H = JSON.parse(fs.readFileSync(__dirname + "/sigs_" + label + "_head.json", "utf8")), B = JSON.parse(fs.readFileSync(__dirname + "/sigs_" + label + "_before.json", "utf8"));
var tab = {}, i;
function row(s) { return tab[s] || (tab[s] = { headOnly: 0, beforeOnly: 0, both: 0, ex: null, exB: null }); }
for (i = 0; i < seqs.length; i++) {
  var h = {}, b = {}; H[i].forEach(function (s) { h[s] = 1; }); B[i].forEach(function (s) { b[s] = 1; });
  Object.keys(h).forEach(function (s) { var r = row(s); if (b[s]) r.both++; else { r.headOnly++; if (r.ex === null || seqs[r.ex].steps.length > seqs[i].steps.length) r.ex = i; } });
  Object.keys(b).forEach(function (s) { if (h[s]) return; var r = row(s); r.beforeOnly++; if (r.exB === null || seqs[r.exB].steps.length > seqs[i].steps.length) r.exB = i; });
}
function fmt(i) { var q = seqs[i]; return "   #" + i + " refs=" + q.cfg.refs + " open=" + q.cfg.open + "\n" + q.steps.map(function (x, j) { return "      t" + (86 + j) + (x.swap ? " (hero swap -> " + x.swap + ")" : "") + ": " + x.reply; }).join("\n"); }
console.log(seqs.length + " sequences\n");
Object.keys(tab).sort().forEach(function (s) { var r = tab[s];
  console.log((r.headOnly ? "** " : "   ") + s + "\n      head-only " + r.headOnly + " | before-only " + r.beforeOnly + " | both " + r.both);
  if (r.headOnly) console.log("   shortest HEAD-ONLY example:\n" + fmt(r.ex));
});
var out = {}; Object.keys(tab).forEach(function (s) { if (tab[s].ex !== null) out[s] = tab[s].ex; });
fs.writeFileSync(__dirname + "/headonly_" + label + ".json", JSON.stringify(out));
