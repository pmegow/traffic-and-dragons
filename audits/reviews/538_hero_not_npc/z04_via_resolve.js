// Fuzz analysis 3: refusals in the RIGHT tree whose operand is not exactly a player name; what the LEFT tree did with the same tag.
var fs = require("fs");
function load(f) { return fs.readFileSync(f, "utf8").split("\n").filter(Boolean).map(function (l) { return JSON.parse(l); }); }
var L = load(process.argv[2]), R = load(process.argv[3]), SHOW = parseInt(process.argv[4] || "3", 10);
var groups = {}, shown = {}, i;
for (i = 0; i < R.length; i++) {
  var r = R[i], l = L[i]; if (!r.viaResolve.length) continue;
  r.viaResolve.forEach(function (m) {
    var mm = /^⚠ (.*) refused \(player\): (.*)$/.exec(m), what = mm ? mm[1] : "?", x = mm ? mm[2] : "?";
    var why = r.swap ? "swap" : "no swap"; var key = why + " | " + what + " | " + x;
    groups[key] = (groups[key] || 0) + 1;
    var g = why + " | " + what;
    if ((shown[g] || 0) < SHOW) { shown[g] = (shown[g] || 0) + 1; console.log("\n#" + r.i + " [" + key + "] hero=" + r.heroNow + " eps=" + JSON.stringify(r.eps) + "->" + JSON.stringify(r.epsNow) + " seed=" + JSON.stringify(r.seed) + " start=" + JSON.stringify(r.start)); r.replies.forEach(function (rep, k) { console.log("   reply " + k + ": " + rep + "\n      L " + JSON.stringify(l.muts[k]) + "\n      R " + JSON.stringify(r.muts[k])); }); }
  });
}
var ks = Object.keys(groups).sort(); console.log("\n" + ks.length + " groups"); ks.forEach(function (k) { console.log("  " + groups[k] + "  " + k); });
