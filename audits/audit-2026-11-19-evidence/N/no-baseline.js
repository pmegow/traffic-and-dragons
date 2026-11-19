// Probe: sabotage.prove() never runs the guarded command on the UNMUTATED file. A command that is red regardless of the
// mutation (a broken section, a missing untracked input in the clone, a load timeout) proves every clause without
// mustFail "caught". And mustFail is a plain substring of the WHOLE output, so a name printed on a passing line counts.
var fs = require("fs"), path = require("path");
var sabotage = require("C:/Projects/traffic-and-dragons/dev/sabotage.js");
var target = path.join(__dirname, "target.js");
fs.writeFileSync(target, "function guarded(x){ return x > 0; }\n");
var alwaysRed = path.join(__dirname, "always-red.js");
fs.writeFileSync(alwaysRed, "console.log('PASS guarded rejects zero'); console.log('FAIL something unrelated'); process.exit(1);\n");
var rc = sabotage.prove({
  file: target,   // absolute: in-place mode (the meta-suite seam), so no clone of the repo is made
  command: [process.execPath, [alwaysRed]],
  cases: [
    { label: "no mustFail: the guard is deleted", find: "x > 0", replace: "true" },
    { label: "mustFail that appears on a PASSING line", find: "x > 0", replace: "x >= 0", mustFail: "guarded rejects zero" }
  ]
});
console.log("prove() returned", rc, "(0 = every clause proven)");
