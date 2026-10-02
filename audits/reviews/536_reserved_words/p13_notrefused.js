// REVIEW PROBE p13: which shapes carry __proto__ (or the exact word) in the reply and are NOT taken out by tagStripReserved?
// Uses the template list of p02 (read from its source) so the two cannot drift. argv: <tree>
process.env.ENGINE_ROOT = process.argv[2];
require("../../thu/vtags/harness.js");
var fs = require("fs"), src = fs.readFileSync(__dirname + "/p02_fuzz.js", "utf8");
var tpls = [], re = /"((?:[^"\\]|\\.)*)"/g, m;
while ((m = re.exec(src))) { var t; try { t = JSON.parse('"' + m[1] + '"'); } catch (e) { continue; } if (t.charAt(0) === "[" && t.indexOf("§") >= 0) tpls.push(t); }
var seen = {}, list = tpls.filter(function (t) { if (Object.prototype.hasOwnProperty.call(seen, t)) return false; seen[t] = 1; return true; });
if (typeof tagStripReserved !== "function") { console.log("tree " + process.argv[2].split("/").pop() + ": no tagStripReserved (nothing is refused here)"); process.exit(0); }
["__proto__", "constructor"].forEach(function (w) {
  var kept = [];
  list.forEach(function (t) { var text = "x " + t.split("§").join(w), r = tagStripReserved(text); if (r.text.indexOf(w) >= 0) kept.push(t + "   => left in the reply: " + JSON.stringify(r.text.slice(2)).slice(0, 110)); });
  console.log(w + ": " + list.length + " shapes; the word survives the strip in " + kept.length);
  kept.forEach(function (k) { console.log("   " + k); });
});
