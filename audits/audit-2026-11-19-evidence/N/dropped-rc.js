// Heuristic scan: batteries whose sabotage.prove(...) return code may not reach the process exit status.
// battery-verdict.js MISFIRE only greps MISATTRIBUT / "no bytes changed" / "NOT on mustFail"; a MISSED, NOT APPLIED or
// UNOBSERVED clause is failed ONLY by the exit status the battery script chooses.
var fs = require("fs"), path = require("path");
var D = "C:/Projects/traffic-and-dragons/dev";
var files = fs.readdirSync(D).filter(function (f) { return /^sabotage-.*\.js$/.test(f); });
var report = [];
files.forEach(function (f) {
  var src = fs.readFileSync(path.join(D, f), "utf8");
  var noComments = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'\\])\/\/[^\n]*/g, "$1");
  var assigned = [], m, re = /(?:var\s+|[,;]\s*|^\s*)([A-Za-z_$][\w$]*)\s*=\s*(?:sabotage|S|sab)\.prove\(/gm;
  while ((m = re.exec(noComments))) assigned.push(m[1]);
  var bare = (noComments.match(/(^|[;{}\n])\s*(?:sabotage|S|sab)\.prove\(/g) || []).length;
  var exits = noComments.match(/process\.exit(Code)?\s*[(=][^\n;]*/g) || [];
  var exitText = exits.join(" ");
  var missing = assigned.filter(function (v) { return exitText.indexOf(v) < 0 && !new RegExp("\\b" + v + "\\b[^\\n]*\\|\\|").test(noComments.split("process.exit")[0] ? "" : ""); });
  // accept accumulator patterns like rc = rc || x, fail |= x, codes.push(x)
  missing = missing.filter(function (v) {
    var uses = noComments.split(new RegExp("\\b" + v.replace(/\$/g, "\\$") + "\\b")).length - 1;
    return uses <= 1 && exitText.indexOf(v) < 0;
  });
  if (missing.length || (bare && !/process\.exit\(\s*(sabotage|S|sab)\.prove/.test(noComments))) {
    report.push(f + " : assigned-but-unused=" + JSON.stringify(missing) + " bareCalls=" + bare + " exits=" + JSON.stringify(exits.slice(0, 3)));
  }
});
console.log(report.length + " suspicious of " + files.length + " batteries");
report.forEach(function (l) { console.log("  " + l); });
