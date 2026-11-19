// Census: dev/tests-*.js that no gate runs. The standalone list (run-standalone-suites.js SUITES) is hand-written; the
// browser list is derived (a real require of ./cdp-browser.js) and pinned to CI steps. A suite in neither, and not
// invoked by the workflow, the hook or run-tests.js itself, is run only by hand or by a sabotage battery.
var fs = require("fs"), path = require("path");
var R = "C:/Projects/traffic-and-dragons", D = R + "/dev";
var SUITES = require(D + "/run-standalone-suites.js").SUITES;
var browser = require(D + "/check-enforcement.js").browserSuiteNames(R);
var wf = fs.readFileSync(R + "/.github/workflows/engine-tests.yml", "utf8") + fs.readFileSync(R + "/dev/pre-commit", "utf8") + fs.readFileSync(R + "/dev/pre-push", "utf8");
var rt = fs.readFileSync(D + "/run-tests.js", "utf8");
var batteries = fs.readdirSync(D).filter(function (f) { return /^sabotage-.*\.js$/.test(f); }).map(function (f) { return fs.readFileSync(path.join(D, f), "utf8"); }).join("\n");
var orphans = [], batteryOnly = [];
fs.readdirSync(D).filter(function (f) { return /^tests-.*\.js$/.test(f); }).sort().forEach(function (f) {
  var rel = "dev/" + f;
  if (SUITES.indexOf(rel) >= 0 || browser.indexOf(f) >= 0 || wf.indexOf(rel) >= 0) return;
  // run-tests may spawn it itself (spawnSync of the file) — a bare mention in a contract string is not a run
  var spawnedByRunTests = new RegExp("(spawnSync|execFileSync|fork|require)\\([^)]*" + f.replace(/[.\-]/g, "\\$&")).test(rt);
  if (spawnedByRunTests) return;
  if (batteries.indexOf(f) >= 0) batteryOnly.push(f); else orphans.push(f);
});
console.log("tests-*.js: " + fs.readdirSync(D).filter(function (f) { return /^tests-.*\.js$/.test(f); }).length + "; standalone list " + SUITES.length + "; browser " + browser.length);
console.log("run by NO gate, named only by a sabotage battery (" + batteryOnly.length + "): " + batteryOnly.join(", "));
console.log("run by NO gate and no battery (" + orphans.length + "): " + orphans.join(", "));
