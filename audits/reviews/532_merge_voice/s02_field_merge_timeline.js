// READ-ONLY: for each real npc merge on record in the owner's saves, when did each NAME speak (transcript .sp maps) relative
// to the turn the merge landed? This is the field check for finding 1 (does the new name speak before the merge lands?).
// Prints turn numbers and names only, no prose.
var fs = require("fs"), path = require("path");
var ROOT = "C:/Projects/traffic-and-dragons/Campaigns";
fs.readdirSync(ROOT).forEach(function (camp) {
  var dir = path.join(ROOT, camp, "saves"); if (!fs.existsSync(dir)) return;
  var files = fs.readdirSync(dir).filter(function (f) { return /\.tnd$/.test(f); }).map(function (f) { return { f: f, t: fs.statSync(path.join(dir, f)).mtimeMs }; }).sort(function (a, b) { return b.t - a.t; });
  if (!files.length) return;
  var j; try { j = JSON.parse(fs.readFileSync(path.join(dir, files[0].f), "utf8")); } catch (e) { return; }
  var ws = j.worldState || {}, mem = j.memory || {}, im = ((mem.archive && mem.archive.identityMerges) || []).filter(function (m) { return m.domain === "npc"; });
  if (!im.length) return;
  var tr = ws.transcript || [];
  if (tr && tr.__lz) { console.log(camp + ": transcript compressed in this export, skipped"); return; }
  console.log(camp + " | " + files[0].f + " | transcript entries " + tr.length + " | keys of an entry: " + (tr.length ? Object.keys(tr[tr.length - 1]).join(",") : "-"));
  im.forEach(function (m) {
    var spoke = {}; spoke[m.canonical] = []; spoke[m.duplicate] = [];
    tr.forEach(function (e) {
      if (!e || !e.sp || !e.sp.s) return;
      var turn = (typeof e.t === "number") ? e.t : (typeof e.turn === "number" ? e.turn : null), seen = {};
      Object.keys(e.sp.s).forEach(function (k) { var nm = e.sp.s[k]; if ((nm === m.canonical || nm === m.duplicate) && !seen[nm]) { seen[nm] = 1; spoke[nm].push(turn); } });
    });
    function fmt(a) { return a.length ? a.length + " turn(s): " + a.slice(0, 12).join(",") + (a.length > 12 ? ",…" : "") : "never"; }
    console.log("   merge landed t" + m.turn + ": " + JSON.stringify(m.duplicate) + " -> " + JSON.stringify(m.canonical));
    console.log("      lines stamped under the duplicate's name: " + fmt(spoke[m.duplicate]));
    console.log("      lines stamped under the canonical name:   " + fmt(spoke[m.canonical]) + " | before the merge landed: " + spoke[m.canonical].filter(function (t) { return t !== null && t < m.turn; }).length);
  });
});
