// Probe 24 (read-only): how often the hero's own actions hold the exact word "ending" (the token pastRaisedByHero would count), across the owner's saves.
require("./h.js");
var fs = require("fs"), path = require("path"), ROOT = "C:/Projects/traffic-and-dragons/Campaigns";
var users = 0, hits = [], roles = {};
fs.readdirSync(ROOT).forEach(function (camp) {
  var sd = path.join(ROOT, camp, "saves"); if (!fs.existsSync(sd)) return;
  var files = fs.readdirSync(sd).filter(function (f) { return /\.tnd$/i.test(f); }).map(function (f) { return { f: f, m: fs.statSync(path.join(sd, f)).mtimeMs }; }).sort(function (a, b) { return b.m - a.m; });
  if (!files.length) return;
  var save = JSON.parse(fs.readFileSync(path.join(sd, files[0].f), "utf8")), ws; quiet(function () { ws = inflateWorldStateSnapshot(save.worldState); });
  (ws.transcript || []).forEach(function (e) {
    if (!e) return; roles[e.r] = (roles[e.r] || 0) + 1; if (e.r === "gm" || e.bk || !e.x) return; users++;
    var toks = String(e.x).toLowerCase().replace(/[\u2019']s\b/g, "").split(/[^a-z]+/);
    if (toks.indexOf("ending") >= 0) hits.push((ws.kind || "adventure") + " " + files[0].f + " t" + e.t + ": " + String(e.x).slice(0, 160));
  });
});
console.log("roles: " + JSON.stringify(roles) + " | player entries: " + users + " | holding the word 'ending': " + hits.length);
hits.slice(0, 12).forEach(function (h) { console.log("   " + h); });
