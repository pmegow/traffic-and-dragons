// dev/sabotage-481-g6-browser-suites.js — proves the G6-class guard is guarded: every dev/tests-*.js that really requires the
// CDP driver must be a CI step after the Chrome check (derived from dev/, not a hand list), and the driver's --check proves a
// page closed mid-request stays quiet. The --check clause needs Chrome; without it it is SKIPPED out loud (exit 78 + one
// SABOTAGE SKIPPED line) — never passed. Each mutation runs in a disposable clone.
//   node dev/sabotage-481-g6-browser-suites.js
var sabotage = require("./sabotage.js"), verdict = require("./battery-verdict.js");
var chrome = require("./cdp-browser.js").locateChrome();
var TOPOLOGY = ["node", ["dev/tests-481-g6-ci-topology.js"]], failed = 0;
failed += sabotage.prove({ file: "dev/check-enforcement.js", command: TOPOLOGY, cases: [
  { label: "the real check never derives the browser suites",
    find: "  return problems.concat(browserSuiteProblems(workflow, browserSuiteNames(root)));", replace: "  return problems;",
    mustFail: "every real-browser suite is a CI step" },
  { label: "a mention of the driver counts as a browser suite",
    find: "var DRIVER_REQUIRE_RE = /require\\(\\s*[\"']\\.\\/cdp-browser\\.js[\"']\\s*\\)/;", replace: "var DRIVER_REQUIRE_RE = /cdp-browser\\.js/;",
    mustFail: "every real-browser suite is a CI step" },
  { label: "a browser suite may run before the Chrome check",
    find: "    else if (check < 0 || at < check) problems.push(", replace: "    else if (false) problems.push(",
    mustFail: "every real-browser suite is a CI step" }
]});
failed += sabotage.prove({ file: ".github/workflows/engine-tests.yml", command: TOPOLOGY, cases: [
  { label: "the G3 browser half drops out of CI",
    find: "        run: node dev/tests-481-g3-todo-viewer-browser.js", replace: "        run: echo gone",
    mustFail: "every real-browser suite is a CI step" }
]});
failed += sabotage.prove({ file: "dev/cdp-browser.js", skip: !chrome.path, command: ["node", ["dev/cdp-browser.js", "--check"]], cases: [
  { label: "a page closed mid-request prints a route error again",
    find: "|closed|Session with given id not found/i.test(e.message)", replace: "|closed/i.test(e.message)",
    mustFail: "a page closed mid-request printed a route error" }
]});
if (!chrome.path && !failed) { verdict.reportSkip("sabotage-481-g6-browser-suites.js", 1, chrome.why); process.exit(verdict.SKIP_EXIT); }
process.exit(failed ? 1 : 0);
