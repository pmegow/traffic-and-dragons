require("./h.js");
var fs = require("fs"), path = require("path"), CR = "C:/Projects/traffic-and-dragons/Campaigns", names = {};
fs.readdirSync(CR).forEach(function (camp) {
  var sd = path.join(CR, camp, "saves"); if (!fs.existsSync(sd)) return;
  var files = fs.readdirSync(sd).filter(function (f) { return /\.tnd$/i.test(f); }).map(function (f) { return { f: f, m: fs.statSync(path.join(sd, f)).mtimeMs }; }).sort(function (a, b) { return b.m - a.m; });
  if (!files.length) return;
  var save = JSON.parse(fs.readFileSync(path.join(sd, files[0].f), "utf8")), ws = save.worldState || {};
  var ch = ws.character; if (ch && ch.name) names[ch.name] = (names[ch.name] || "") + " hero@" + camp.slice(0, 18);
  (ws.npcs || []).forEach(function (n) { if (n && n.charSheet) names[n.name] = (names[n.name] || "") + (n.resident ? " resident" : n.partyMember ? " party" : " npc") + "@" + camp.slice(0, 14); });
});
Object.keys(names).sort().forEach(function (nm) {
  var first = nm.split(/\s+/)[0], edge = !/^\w/.test(first) || !/\w$/.test(first), common = /^(The|A|An|I|My|No|One|Old|Big|Little)$/.test(first);
  var a = endingMomentText(nm, first + " learned to stay."), b = endingMomentText(nm, a);
  console.log((edge || a !== b ? "GROWS  " : common ? "COMMON " : "ok     ") + JSON.stringify(nm) + "  ::" + names[nm].slice(0, 110));
});
