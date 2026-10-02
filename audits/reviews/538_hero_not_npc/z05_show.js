// show fuzz scenarios matching a filter. argv: left right filter-substring (matched against "swap/no swap | what | operand")
var fs = require("fs");
function load(f) { return fs.readFileSync(f, "utf8").split("\n").filter(Boolean).map(function (l) { return JSON.parse(l); }); }
var L = load(process.argv[2]), R = load(process.argv[3]), F = process.argv[4], MAX = parseInt(process.argv[5] || "10", 10), n = 0, i;
for (i = 0; i < R.length && n < MAX; i++) {
  var r = R[i], l = L[i], hit = false;
  r.viaResolve.forEach(function (m) { var mm = /^⚠ (.*) refused \(player\): (.*)$/.exec(m); var key = (r.swap ? "swap" : "no swap") + " | " + (mm ? mm[1] : "?") + " | " + (mm ? mm[2] : "?"); if (key.indexOf(F) === 0) hit = true; });
  if (!hit) continue; n++;
  console.log("\n#" + r.i + " hero=" + r.heroNow + " eps=" + JSON.stringify(r.eps) + "->" + JSON.stringify(r.epsNow) + " swap=" + r.swap + " refs=" + r.refs + " seed=" + JSON.stringify(r.seed) + " start=" + JSON.stringify(r.start));
  r.replies.forEach(function (rep, k) { console.log("   reply " + k + ": " + rep + "\n      L " + JSON.stringify(l.muts[k]) + "\n      R " + JSON.stringify(r.muts[k])); });
  console.log("   L viol " + JSON.stringify(l.viol) + "\n   R viol " + JSON.stringify(r.viol));
}
