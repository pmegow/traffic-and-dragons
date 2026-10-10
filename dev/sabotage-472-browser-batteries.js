// sabotage-472-browser-batteries.js — retained proof for #472: the SKIP verdict both runners share, the diff runner's
// target detection, and the class contract that keeps browser batteries off Playwright and loud when Chrome is absent.
// Every clause must redden a NAMED probe in dev/tests-252-retained-proof-wiring.js. No label may contain the runners'
// misfire words (battery-verdict.js scans a battery's whole output, labels included) — a passing run would read as failed.
var sabotage = require("./sabotage.js");
var command = ["node", ["dev/tests-252-retained-proof-wiring.js"]];
// The probes read these by path inside the scratch clone, so their working bytes ride in (pre-commit they are new or changed).
var also = ["dev/battery-verdict.js", "dev/battery-targets.js", "dev/run-sabotage-diff.js", "dev/run-sabotage-all.js", "dev/cdp-browser.js",
  "dev/sabotage-blueprint-publish.js", "dev/sabotage-blueprint-catalog.js",
  "dev/tests-blueprint-publish-browser.js", "dev/tests-blueprint-catalog-browser.js", "dev/tests-blueprint-editions-browser.js"];
var failed = 0;
/* #599 (d2), review 4: the target pattern lives in dev/battery-targets.js now (the ONE reader; the prove("file") wrapper counts too) */
failed += sabotage.prove({ file: "dev/battery-targets.js", also: also, command: command, cases: [
  { label: "a quoted \"file\" key is invisible to the diff runner again",
    find: "var keyed = /(^|[^\\w$])[\"']?file[\"']?\\s*:\\s*[\"']([^\"']+)[\"']/g;",
    replace: "var keyed = /(^|[^\\w$])file\\s*:\\s*[\"']([^\"']+)[\"']/g;",
    mustFail: "the quoted-key battery was not scheduled" },
  { label: "the target pattern loses its word boundary (profile: reads as file:)",
    find: "var keyed = /(^|[^\\w$])[\"']?file", replace: "var keyed = /()[\"']?file",
    mustFail: "a profile: key was read as a target" }
]});
failed += sabotage.prove({ file: "dev/run-sabotage-diff.js", also: also, command: command, cases: [
  { label: "the commit gate prints a skip as ok",
    find: "(v.verdict===\"fail\"?\"FAIL \":v.verdict===\"skip\"?\"SKIP \":\"ok   \")", replace: "(v.verdict===\"fail\"?\"FAIL \":\"ok   \")",
    mustFail: "the skip was not printed with its announcement" }
] });
failed += sabotage.prove({ file: "dev/battery-verdict.js", also: also, command: command, cases: [
  { label: "a wrong-test red under exit 78 reads as a skip",
    find: "  if (MISFIRE.test(out)) return { verdict: \"fail\", skipLines: [] };\n", replace: "",
    mustFail: "verdict for a wrong-test red under an announced skip is skip, want fail" },
  { label: "an unannounced exit 78 counts as a skip",
    find: "    if (said.some(function (l) { return /SABOTAGE SKIPPED/.test(l); })) return { verdict: \"skip\", skipLines: said };\n    return { verdict: \"fail\", skipLines: [] };",
    replace: "    return { verdict: \"skip\", skipLines: said };",
    mustFail: "verdict for an unannounced 78 is skip, want fail" },
  { label: "an announced skip is reported as a pass",
    find: "return { verdict: \"skip\", skipLines: said };", replace: "return { verdict: \"ok\", skipLines: said };",
    mustFail: "verdict for an announced skip is ok, want skip" }
] });
failed += sabotage.prove({ file: "dev/run-sabotage-all.js", also: also, command: command, cases: [
  { label: "the weekly summary folds skips into green",
    find: "+skipNote+\" (\"", replace: "+\" (\"",
    mustFail: "the weekly summary folded the skip into green" }
] });
failed += sabotage.prove({ file: "dev/sabotage-blueprint-publish.js", also: also, command: command, cases: [
  { label: "a Chrome-driven battery loses its loud skip",
    find: "if(!chrome.path&&!failed){verdict.reportSkip('sabotage-blueprint-publish.js',3,chrome.why);process.exit(verdict.SKIP_EXIT);}", replace: "",
    mustFail: "sabotage-blueprint-publish.js drives Chrome but lacks" }
] });
failed += sabotage.prove({ file: "dev/tests-blueprint-catalog-browser.js", also: also, command: command, cases: [
  { label: "a battery command goes back to the playwright module",
    find: "const {chromium}=require('./cdp-browser.js');", replace: "const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');",
    mustFail: "which requires playwright" }
] });
process.exit(failed ? 1 : 0);
