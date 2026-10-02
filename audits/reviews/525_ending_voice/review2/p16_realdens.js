// Probe 16 (read-only): the real ending replies on the owner's saves — their shape (first/last lines, tags, headings), the model that wrote them,
// and what denouementSplit does to each (a real reply written before the RECORD rule must come back whole, with no record).
require("./h.js");
var fs = require("fs"), path = require("path");
var ROOT = "C:/Projects/traffic-and-dragons/Campaigns", seen = {};
fs.readdirSync(ROOT).forEach(function (camp) {
  var sd = path.join(ROOT, camp, "saves"); if (!fs.existsSync(sd)) return;
  fs.readdirSync(sd).filter(function (f) { return /\.tnd$/i.test(f); }).forEach(function (f) {
    var save = JSON.parse(fs.readFileSync(path.join(sd, f), "utf8")); if (!save.worldState) return;
    var ws; quiet(function () { ws = inflateWorldStateSnapshot(save.worldState); });
    (ws.transcript || []).forEach(function (e) {
      if (!e || !e.den) return; var key = String(e.x).slice(0, 80); if (seen[key]) return; seen[key] = 1;
      var x = String(e.x), lines = x.split("\n"), r = denouementSplit(x);
      console.log("##### " + f + " t" + e.t + " model=" + (e.m || "?") + " chars=" + x.length + " lines=" + lines.length + " CRLF=" + /\r/.test(x) + " tags=" + JSON.stringify((x.match(/\[[A-Z_]+:[^\]]*\]/g) || []).slice(0, 5)) + " md=" + /[*_#`>]/.test(x));
      console.log("   first line: " + JSON.stringify(lines[0].slice(0, 160)));
      console.log("   last 2 lines: " + JSON.stringify(lines.slice(-2).map(function (l) { return l.slice(0, 200); })));
      console.log("   split: prose unchanged=" + (r.prose === x.trim()) + " record=" + JSON.stringify(r.record) + (r.prose !== x.trim() ? " REMOVED: " + JSON.stringify(x.trim().slice(r.prose.length)) : ""));
      var paras = x.split(/\n\s*\n/); console.log("   paragraphs: " + paras.length + "; any paragraph starting with record/the record: " + paras.some(function (p) { return /^\W*(the\s+)?record/i.test(p); }) + "; 'record' occurrences: " + (x.match(/record/gi) || []).length);
    });
  });
});
