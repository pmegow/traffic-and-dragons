// REVIEW PROBE (read-only, no engine): how often do the reserved words occur AT ALL as whole words in real text
// (corpora, owner saves, testRuns)? argv: <tree>
var fs = require("fs"), path = require("path");
var MAIN = "C:/Projects/traffic-and-dragons";
function walkDir(dir, exts, out, depth) { if (depth > 7) return out; var es; try { es = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return out; } es.forEach(function (e) { var p = path.join(dir, e.name); if (e.isDirectory()) { if (e.name !== "node_modules" && e.name !== ".git") walkDir(p, exts, out, depth + 1); } else if (exts.some(function (x) { return e.name.toLowerCase().slice(-x.length) === x; })) out.push(p); }); return out; }
var files = [];
fs.readdirSync(process.argv[2] + "/dev").forEach(function (f) { if (/^corpus_.*\.json$/.test(f)) files.push(path.join(process.argv[2], "dev", f)); });
walkDir(MAIN + "/Campaigns", [".tnd", ".blueprint", ".char"], files, 0);
walkDir(MAIN + "/testRuns", [".tnd", ".json", ".html"], files, 0);
walkDir(MAIN + "/samples", [".blueprint", ".json", ".char"], files, 0);
walkDir(MAIN + "/momentos", [".html", ".md", ".txt"], files, 0);
var words = Object.getOwnPropertyNames(Object.prototype), re = new RegExp("(^|[^A-Za-z_])(" + words.map(function (w) { return w.replace(/[_$]/g, "\\$&"); }).join("|") + ")(?![A-Za-z_])", "gi");
var total = 0, bytes = 0, hits = {}, samples = [];
files.forEach(function (f) {
  var s; try { s = fs.readFileSync(f, "utf8"); } catch (e) { return; }
  total++; bytes += s.length;
  // drop base64 portrait payloads: they are not text
  s = s.replace(/data:image\/[a-z]+;base64,[A-Za-z0-9+\/=]+/g, "");
  var m; re.lastIndex = 0;
  while ((m = re.exec(s))) { var w = m[2]; hits[w.toLowerCase()] = (hits[w.toLowerCase()] || 0) + 1; if (samples.length < 25) samples.push(path.basename(f) + ": …" + s.slice(Math.max(0, m.index - 60), m.index + 80).replace(/\s+/g, " ") + "…"); }
});
console.log(total + " files, " + Math.round(bytes / 1e6) + " MB of real text scanned (portraits removed)");
console.log("whole-word hits (any case): " + JSON.stringify(hits));
samples.forEach(function (x) { console.log("  " + x); });
