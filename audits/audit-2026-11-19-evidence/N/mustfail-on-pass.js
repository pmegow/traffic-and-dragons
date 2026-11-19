// Census: battery clauses whose mustFail is a test name that the guarded suite ALSO prints when the test PASSES.
// sabotage.js attributes with out.indexOf(mustFail) over the whole output, so for these clauses an unrelated red
// (any other test failing, a crash after the named test passed) still reads "caught", never MISATTRIBUTED.
var fs = require("fs"), path = require("path");
var D = "C:/Projects/traffic-and-dragons/dev";
var suites = fs.readdirSync(D).filter(function (f) { return /^tests-.*\.js$/.test(f); });
var passPrinters = {};
suites.forEach(function (f) {
  var s = fs.readFileSync(path.join(D, f), "utf8");
  // a pass line that prints the test's name: console.log('PASS '+name) / ("✓ " + name) / ('ok ' + name) / (`  ✓ ${name}`)
  if (/console\.log\(\s*(['"`])\s*(PASS|✓|ok|OK|pass)[^'"`]*\1\s*\+\s*(name|n|label|title|t)\b/.test(s) ||
      /console\.log\(`[^`]*(PASS|✓|ok)[^`]*\$\{(name|n|label|title)\}/.test(s)) passPrinters[f] = s;
});
var hits = [], total = 0;
fs.readdirSync(D).filter(function (f) { return /^sabotage-.*\.js$/.test(f); }).forEach(function (b) {
  var src = fs.readFileSync(path.join(D, b), "utf8"), m, re = /mustFail\s*:\s*(['"])((?:\\.|(?!\1).)*)\1/g;
  while ((m = re.exec(src))) {
    total++;
    var mf = m[2].replace(/\\(['"\\])/g, "$1");
    if (/^(FAIL|✗|not ok)/.test(mf)) continue;
    for (var f in passPrinters) {
      if (src.indexOf(f) < 0) continue;            // the battery must run that suite
      if (passPrinters[f].indexOf(mf) >= 0) { hits.push(b + " → " + f + " :: " + mf.slice(0, 90)); break; }
    }
  }
});
console.log("suites that print a passing test's name: " + Object.keys(passPrinters).length + " of " + suites.length);
console.log("mustFail strings scanned: " + total + "; found verbatim in a pass-printing suite the battery runs: " + hits.length);
hits.slice(0, 15).forEach(function (h) { console.log("  " + h); });
