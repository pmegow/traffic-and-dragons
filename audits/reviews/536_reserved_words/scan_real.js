// REVIEW PROBE (read-only): run every string of real GM text through tagStripReserved and report refusals + byte-identity.
// argv: <tree>   Sources: <tree>/dev/corpus_*.json (+endstates), the owner's Campaigns/**.tnd, the main repo's testRuns/**.
process.env.ENGINE_ROOT = process.argv[2];
require("../../thu/vtags/harness.js");
var fs = require("fs"), path = require("path");
var MAIN = "C:/Projects/traffic-and-dragons";
function walkDir(dir, exts, out, depth) {
  if (depth > 7) return out; var es;
  try { es = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return out; }
  es.forEach(function (e) {
    var p = path.join(dir, e.name);
    if (e.isDirectory()) { if (e.name !== "node_modules" && e.name !== ".git") walkDir(p, exts, out, depth + 1); }
    else if (exts.some(function (x) { return e.name.toLowerCase().slice(-x.length) === x; })) out.push(p);
  });
  return out;
}
var files = [];
fs.readdirSync(process.argv[2] + "/dev").forEach(function (f) { if (/^corpus_.*\.json$/.test(f)) files.push(path.join(process.argv[2], "dev", f)); });
walkDir(MAIN + "/dev", [".json"], [], 0).forEach(function (f) { if (/corpus_/.test(path.basename(f))) files.push(f); });
walkDir(MAIN + "/Campaigns", [".tnd"], files, 0);
walkDir(MAIN + "/testRuns", [".tnd", ".json"], files, 0);
function fnv(s) { var h = 0x811c9dc5, i; for (i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = (h * 0x01000193) >>> 0; } return h; }
var seen = Object.create(null), stats = { files: 0, unreadable: 0, strings: 0, uniqueBracket: 0, tags: 0, refusedStrings: 0, refusedTags: 0, notIdentical: 0, rawResponses: 0 };
var haveStrip = typeof tagStripReserved === "function";
var TAGRE = /\[([A-Z][A-Z_]{1,}):([^\]]*)\]/g;
var tagNames = Object.create(null);
function check(s, where) {
  stats.strings++;
  if (s.indexOf("[") < 0) return;
  var key = s.length + ":" + fnv(s);
  if (seen[key]) return; seen[key] = 1; stats.uniqueBracket++;
  var m, n = 0; TAGRE.lastIndex = 0; while ((m = TAGRE.exec(s))) { n++; tagNames[m[1]] = (tagNames[m[1]] || 0) + 1; }
  stats.tags += n;
  if (!haveStrip) return;
  var r = tagStripReserved(s);
  if (r.refused.length) {
    stats.refusedStrings++; stats.refusedTags += r.refused.length;
    // show the exact tags
    var shown = []; TAGRE.lastIndex = 0;
    while ((m = TAGRE.exec(s))) { if (tagReservedWord(m[2])) shown.push(m[0].slice(0, 200)); }
    console.log("REFUSED in " + where + ": " + JSON.stringify(r.refused) + " :: " + shown.join(" ; "));
  } else if (r.text !== s) { stats.notIdentical++; console.log("NOT BYTE-IDENTICAL (nothing refused) in " + where); }
}
function walk(v, where, depth) {
  if (typeof v === "string") { check(v, where); return; }
  if (!v || typeof v !== "object" || depth > 40) return;
  if (Array.isArray(v)) { for (var i = 0; i < v.length; i++) walk(v[i], where + "[" + i + "]", depth + 1); return; }
  Object.keys(v).forEach(function (k) { check(k, where + ".(key)"); walk(v[k], where + "." + k, depth + 1); });
}
files.forEach(function (f) {
  var j; try { j = JSON.parse(fs.readFileSync(f, "utf8")); } catch (e) { stats.unreadable++; return; }
  stats.files++;
  if (j && j.worldState && typeof inflateWorldStateSnapshot === "function") { try { j.worldState = inflateWorldStateSnapshot(j.worldState); } catch (e2) { } }
  if (j && Array.isArray(j.raw)) stats.rawResponses += j.raw.length;
  walk(j, path.basename(f), 0);
});
console.log("tree: " + process.argv[2].split("/").pop() + " | tagStripReserved present: " + haveStrip);
console.log(JSON.stringify(stats));
var names = Object.keys(tagNames).sort(function (a, b) { return tagNames[b] - tagNames[a]; });
console.log("distinct tag names seen: " + names.length + " | top: " + names.slice(0, 30).map(function (n) { return n + ":" + tagNames[n]; }).join(", "));
