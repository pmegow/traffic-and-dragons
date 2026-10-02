// summarise a p02 results file: argv <file> [class filter] [word filter]
var fs = require("fs"), j = JSON.parse(fs.readFileSync(process.argv[2], "utf8")), cf = process.argv[3] || "", wf = process.argv[4] || "";
var rs = j.results.filter(function (r) { return (!cf || r.cls.indexOf(cf) === 0) && (!wf || r.word === wf); });
var groups = {};
rs.forEach(function (r) { var k = r.cls + " | " + r.tpl + " | " + r.mode; (groups[k] = groups[k] || []).push(r); });
Object.keys(groups).sort().forEach(function (k) {
  var g = groups[k];
  console.log(k + "  [" + g.map(function (r) { return r.word.slice(0, 3) + ":" + r.deco; }).join(", ") + "]");
  var r = g[0];
  var bits = [];
  if (r.errors && r.errors.length) bits.push("err=" + r.errors.join("; ").slice(0, 160));
  if (r.thrown) bits.push("THROWN=" + r.thrown.slice(0, 160));
  if (r.poison && r.poison.length) bits.push("poison=" + r.poison.join(", ").slice(0, 300));
  if (r.promptThrow) bits.push("promptThrow=" + r.promptThrow.slice(0, 120));
  if (r.scan && r.scan.length) bits.push("scan=" + r.scan.join(" ; ").slice(0, 300));
  if (r.diffs && r.diffs.length) r.diffs.slice(0, 3).forEach(function (d) { bits.push("diff[" + d.facet + "@" + d.at + "] word: " + JSON.stringify(d.word).slice(0, 220) + " <> control: " + JSON.stringify(d.control).slice(0, 220)); });
  console.log("     e.g. " + JSON.stringify(r.text).slice(0, 200) + "\n     muts=" + JSON.stringify(r.muts).slice(0, 240) + "\n     " + bits.join("\n     "));
});
console.log(rs.length + " results in " + Object.keys(groups).length + " groups");
