require("./h.js");
// Census (READ-ONLY): every [NPC:name|mood|rel] the GM really wrote, in the playtest corpora and the owner's saves; which mood PARTS
// hit MOOD_CONDITION_RE, and whether moodDoingOnly keeps them only because of #506 (kept with conditions, dropped without).
var fs = require("fs"), path = require("path");
var files = [];
var DEV = process.env.ENGINE_ROOT + "/dev";
fs.readdirSync(DEV).forEach(function (f) { if (/^corpus_playtest.*\.json$/.test(f) && !/endstate/.test(f)) files.push(path.join(DEV, f)); });
var CR = "C:/Projects/traffic-and-dragons/Campaigns";
fs.readdirSync(CR).forEach(function (c) { var sd = path.join(CR, c, "saves"); if (!fs.existsSync(sd)) return; fs.readdirSync(sd).forEach(function (f) { if (/\.tnd$/.test(f)) files.push(path.join(sd, f)); }); });
var re = /\[NPC:([^|\]]+)\|([^|\]]*)(?:\|([^|\]]*))?\]/g, seen = {}, total = 0, hits = {}, nfiles = 0;
files.forEach(function (f) {
  var s; try { s = fs.readFileSync(f, "utf8"); } catch (e) { return; }
  nfiles++;
  // the tags sit inside JSON strings; unescape the common escapes so quotes/newlines do not break the scan
  s = s.replace(/\\n/g, "\n").replace(/\\"/g, "\"");
  var m; re.lastIndex = 0;
  while ((m = re.exec(s))) {
    var mood = m[2].trim(); if (!mood) continue;
    var key = m[1].trim() + "|" + mood; if (seen[key]) { seen[key]++; continue; } seen[key] = 1; total++;
    var parts = mood.split(/[,;]/);
    parts.forEach(function (p) { p = p.trim(); if (!p) return;
      if (MOOD_CONDITION_RE.test(p) && moodDoingOnly(p, true) && !moodDoingOnly(p, false)) { (hits[p.toLowerCase()] = hits[p.toLowerCase()] || []).push(m[1].trim() + " @ " + path.basename(f).slice(0, 44)); }
    });
  }
});
console.log("files " + nfiles + ", distinct (name|mood) pairs " + total);
var ks = Object.keys(hits).sort();
console.log("mood parts kept ONLY because of the condition list (" + ks.length + " distinct):");
ks.forEach(function (k) { console.log("  " + J(k) + "  x" + hits[k].length + "  e.g. " + hits[k].slice(0, 2).join(" ; ")); });
