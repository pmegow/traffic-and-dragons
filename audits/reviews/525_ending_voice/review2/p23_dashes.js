// Probe 23 (read-only): how the owner's GM models write dashes and quotes, and how often a paragraph opens with "Record"/"The record".
require("./h.js");
var fs = require("fs"), path = require("path"), ROOT = "C:/Projects/traffic-and-dragons/Campaigns";
var tot = { entries: 0, spaced: 0, unspaced: 0, curlyClose: 0, straightQ: 0, parasRecord: 0, paras: 0, endQuote: 0, sentences: 0, recordWord: 0 }, ex = [];
fs.readdirSync(ROOT).forEach(function (camp) {
  var sd = path.join(ROOT, camp, "saves"); if (!fs.existsSync(sd)) return;
  var files = fs.readdirSync(sd).filter(function (f) { return /\.tnd$/i.test(f); }).map(function (f) { return { f: f, m: fs.statSync(path.join(sd, f)).mtimeMs }; }).sort(function (a, b) { return b.m - a.m; });
  if (!files.length) return;
  var save = JSON.parse(fs.readFileSync(path.join(sd, files[0].f), "utf8")), ws; quiet(function () { ws = inflateWorldStateSnapshot(save.worldState); });
  (ws.transcript || []).forEach(function (e) {
    if (!e || e.r !== "gm" || !e.x) return; var x = String(e.x); tot.entries++;
    tot.spaced += (x.match(/\s[\u2014\u2013]\s/g) || []).length; tot.unspaced += (x.match(/\S[\u2014\u2013]\S/g) || []).length;
    tot.curlyClose += (x.match(/\u201d/g) || []).length; tot.straightQ += (x.match(/"/g) || []).length;
    tot.recordWord += (x.match(/\brecord\b/gi) || []).length;
    x.split(/\n+/).forEach(function (p) { if (!p.trim()) return; tot.paras++; if (DENOUEMENT_RECORD_RE.test(p)) { tot.parasRecord++; if (ex.length < 8) ex.push(files[0].f + " t" + e.t + ": " + p.slice(0, 140)); } });
    tot.endQuote += (x.match(/[.!?]["\u201d]\s*(\n|$)/g) || []).length;
  });
});
console.log(JSON.stringify(tot)); ex.forEach(function (l) { console.log("  line the RECORD pattern matches: " + l); });
