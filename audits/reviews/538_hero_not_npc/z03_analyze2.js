// Fuzz analysis 2: NEW violations (not in the start state), and what the right tree changes. argv: <left.jsonl> <right.jsonl> [show]
var fs = require("fs");
function load(f) { return fs.readFileSync(f, "utf8").split("\n").filter(Boolean).map(function (l) { return JSON.parse(l); }); }
var L = load(process.argv[2]), R = load(process.argv[3]), SHOW = parseInt(process.argv[4] || "6", 10);
function fresh(rec) { return rec.viol.filter(function (v) { return rec.start.indexOf(v) < 0; }); }
var nL = 0, nR = 0, kinds = {}, shown = {}, i, diffNoHero = 0, shownDiff = 0, viaRes = 0;
for (i = 0; i < L.length; i++) {
  var l = L[i], r = R[i], fl = fresh(l), fr = fresh(r);
  if (fl.length) nL++;
  if (fr.length) { nR++;
    // which tag made it? find the reply after which... (cheap: classify by violation kind + the tags present)
    var kind = fr.map(function (v) { return v.split(":")[0]; }).filter(function (x, k, a) { return a.indexOf(x) === k; }).sort().join("+");
    kinds[kind] = (kinds[kind] || 0) + 1;
    if ((shown[kind] || 0) < SHOW) { shown[kind] = (shown[kind] || 0) + 1; console.log("\n#" + r.i + " RIGHT new violation [" + fr.join(", ") + "] hero=" + r.hero + " eps=" + JSON.stringify(r.eps) + " -> epsNow=" + JSON.stringify(r.epsNow) + " swap=" + r.swap + " refs=" + r.refs + " seed=" + JSON.stringify(r.seed) + " start=" + JSON.stringify(r.start)); r.replies.forEach(function (rep, k) { console.log("   reply " + k + ": " + rep + "\n      R " + JSON.stringify(r.muts[k])); }); }
  }
  if (r.viaResolve.length) viaRes++;
}
console.log("\nscenarios with a NEW hero-named record/alias/resolution: left " + nL + ", right " + nR + "; right refusals by resolution only: " + viaRes);
console.log("right kinds " + JSON.stringify(kinds));
