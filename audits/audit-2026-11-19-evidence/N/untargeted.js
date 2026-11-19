// Census: target files the batteries really mutate (collected through the applicability gate's own stub harness) that
// battery-targets.js's literal-string reader does NOT see. run-sabotage-diff.js (the CI range sweep) schedules a battery
// only when a changed file is in targetsOf(src) or the battery itself changed, so a change to an unseen target runs nothing.
var fs = require("fs"), path = require("path");
var R = "C:/Projects/traffic-and-dragons";
var chk = require(R + "/dev/check-sabotage-applicability.js");
var targets = require(R + "/dev/battery-targets.js");
var inv = chk.collect(R);
var real = {};
inv.clauses.forEach(function (c) { if (!c.file) return; var rel = path.relative(R, path.resolve(R, c.file)).replace(/\\/g, "/"); (real[c.battery] = real[c.battery] || {})[rel] = (real[c.battery][rel] || 0) + 1; });
var unseen = [], clauses = 0;
Object.keys(real).forEach(function (b) {
  var seen = targets.targetsOf(fs.readFileSync(path.join(R, "dev", b), "utf8"));
  Object.keys(real[b]).forEach(function (t) { if (seen.indexOf(t) < 0) { unseen.push(b + " mutates " + t + " (" + real[b][t] + " clause(s)) — not in targetsOf"); clauses += real[b][t]; } });
});
console.log("\n=== batteries " + Object.keys(real).length + "; (battery, target) pairs invisible to the range sweep: " + unseen.length + " covering " + clauses + " clauses");
unseen.slice(0, 25).forEach(function (u) { console.log("  " + u); });
