// p10 — READ-ONLY anchor census for the batteries the commits cite. Nothing is mutated: the battery file is evaluated with a
// stub in place of ./sabotage.js that only records the cases, and each `find` is counted in the head file.
var fs = require("fs"), path = require("path"), vm = require("vm");
var WT = "C:/Users/hannu/AppData/Local/Temp/claude/C--Projects-traffic-and-dragons/0b524b92-af76-49d1-b6c9-f6ca4673077c/scratchpad/wt-rul";
function census(battery) {
  var src = fs.readFileSync(path.join(WT, "dev", battery), "utf8"), groups = [];
  var sandbox = { require: function (m) { if (/sabotage\.js$/.test(m)) return { prove: function (o) { groups.push(o); return 0; } }; return require(m); }, process: { exit: function () {}, argv: process.argv, env: {} }, console: console, __dirname: path.join(WT, "dev"), module: {}, exports: {} };
  try { vm.runInNewContext(src, sandbox, { filename: battery }); } catch (e) { console.log(battery + ": could not evaluate (" + e.message + ")"); return; }
  var total = 0, bad = 0;
  groups.forEach(function (g) {
    var file = fs.readFileSync(path.join(WT, g.file), "utf8");
    (g.cases || []).forEach(function (c) {
      total++;
      var n = file.split(c.find).length - 1, same = c.find === c.replace;
      if (n !== 1 || same) { bad++; console.log("  " + battery + " [" + g.file + "] \"" + c.label + "\": find occurs " + n + " time(s)" + (same ? " AND replace is identical" : "")); }
    });
  });
  console.log(battery + ": " + total + " clause(s), " + bad + " with a missing or ambiguous anchor");
}
fs.readdirSync(path.join(WT, "dev")).filter(function (f) { return /^sabotage-(503|504|530|identity|audit-core)/.test(f); }).forEach(census);
