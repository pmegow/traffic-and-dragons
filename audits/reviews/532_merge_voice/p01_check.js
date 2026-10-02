// Reads the two matrix outputs (p01_before.txt / p01_after.txt) and checks, cell by cell, that AFTER only ADDS:
// every voice field BEFORE's survivor held on its row or sheet is still there with the same value, and every value the
// speaker map served from a pin in BEFORE is still served. Also lists the cells where no speaker resolves at all.
var fs = require("fs");
function load(f) { var o = {}; fs.readFileSync(f, "utf8").split(/\r?\n/).forEach(function (l) { var m = l.match(/^\[(?:BEFORE|AFTER)\] (.*?): (\{.*\})$/); if (m) o[m[1]] = JSON.parse(m[2]); }); return o; }
var B = load(__dirname + "/p01_before.txt"), A = load(__dirname + "/p01_after.txt"), cells = Object.keys(A), lost = [], added = 0, same = 0, nul = [];
cells.forEach(function (k) {
  var b = B[k], a = A[k], changed = false;
  ["row", "sheet"].forEach(function (side) {
    var x = b[side] || {}, y = a[side] || {};
    Object.keys(x).forEach(function (f) { if (x[f] !== y[f]) lost.push(k + " " + side + "." + f + " before=" + JSON.stringify(x[f]) + " after=" + JSON.stringify(y[f])); });
    Object.keys(y).forEach(function (f) { if (!(f in x)) changed = true; });
  });
  if (changed) added++; else same++;
  if (!a.sayCanon) nul.push(k + (b.sayCanon ? " (BEFORE resolved)" : " (null in BEFORE too)"));
});
console.log("cells " + cells.length + " | AFTER added fields in " + added + " | unchanged " + same + " | a field BEFORE held that AFTER lost or changed: " + lost.length);
lost.forEach(function (l) { console.log("  LOST " + l); });
console.log("cells where the survivor resolves to NO speaker (narrator voice): " + nul.length);
nul.forEach(function (l) { console.log("  " + l); });
