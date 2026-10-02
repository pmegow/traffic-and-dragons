require("./h.js");
// READ-ONLY: which voice does each owner campaign carry, and does the ending prompt get a VOICE line when the campaign's own
// proseAuthor is unset but the device default (global proseAuthor) is what gameplay uses?
var fs = require("fs"), path = require("path");
var CR = "C:/Projects/traffic-and-dragons/Campaigns";
fs.readdirSync(CR).forEach(function (camp) {
  var sd = path.join(CR, camp, "saves"); if (!fs.existsSync(sd)) return;
  var files = fs.readdirSync(sd).filter(function (f) { return /\.tnd$/i.test(f); }).map(function (f) { return { f: f, m: fs.statSync(path.join(sd, f)).mtimeMs }; }).sort(function (a, b) { return b.m - a.m; });
  if (!files.length) return;
  var save = JSON.parse(fs.readFileSync(path.join(sd, files[0].f), "utf8"));
  var ws = save.worldState || {};
  console.log(camp + " :: " + files[0].f + " :: proseAuthor=" + JSON.stringify(ws.proseAuthor) + " kind=" + (ws.kind || "adventure") + " ended=" + !!ws.ended);
});
// Engine check: campaign voice unset, device default set.
makeWorld(); delete worldState.proseAuthor; proseAuthor = "dinniman"; memory.chapters = [];
var sys = buildSysPrompt(), full = (typeof sys === "string") ? sys : (sys.stable + sys.volatile);
console.log("\ncampaign proseAuthor unset, device default 'dinniman':");
console.log("  gameplay prompt carries the Dinniman voice: " + /Dinniman/.test(full));
console.log("  ending prompt carries a VOICE line        : " + /\nVOICE: /.test("\n" + buildDenouementPrompt()));
worldState.proseAuthor = "dinniman";
console.log("campaign proseAuthor 'dinniman':\n  ending prompt carries a VOICE line        : " + /\nVOICE: /.test("\n" + buildDenouementPrompt()));
