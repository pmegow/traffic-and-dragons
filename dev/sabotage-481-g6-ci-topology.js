// dev/sabotage-481-g6-ci-topology.js — proves the #481 G6 guards are guarded: the Chrome check and the three blueprint browser
// suites are pinned CI steps, the weekly job's pins are folded into the real check, and the identity tripwire (shared by the
// hook and CI) blocks a fixture identity. Each mutation runs in a disposable clone.
//   node dev/sabotage-481-g6-ci-topology.js
var sabotage = require("./sabotage.js"), code = 0;
var CMD = ["node", ["dev/tests-481-g6-ci-topology.js"]];
function prove(file, cases) { if (!code) code = sabotage.prove({ file: file, command: CMD, cases: cases }); }
prove("dev/check-enforcement.js", [
  { label: "the Chrome check is not pinned",
    find: "    { label: \"node dev/cdp-browser.js --check (#481 G6)\", pattern: /run:\\s*node dev\\/cdp-browser\\.js\\s+--check(?:\\s|$)/ },\n", replace: "",
    mustFail: "the Chrome check and the three blueprint browser suites" },
  { label: "the weekly job may drop bash (tee hides a red battery)",
    find: "    { label: \"shell: bash (pipefail: tee must not hide a red battery)\", pattern: /shell:\\s*bash(?:\\s|$)/ },\n", replace: "",
    mustFail: "weeklyProblems pins the weekly job" },
  { label: "the real check ignores the weekly job",
    find: ".concat(coverageProblems(workflow, hook)).concat(weekly);", replace: ".concat(coverageProblems(workflow, hook));",
    mustFail: "weeklyProblems pins the weekly job" }
]);
prove("dev/check-identity.js", [
  { label: "a fixture identity passes",
    find: "function looksLikeFixture(name, email) { var s = ", replace: "function looksLikeFixture(name, email) { return false; var s = ",
    mustFail: "check-identity.js: a fixture-looking committer is blocked" }
]);
prove("dev/pre-commit", [
  { label: "the hook stops calling the identity tripwire",
    find: "node \"$(git rev-parse --show-toplevel)/dev/check-identity.js\" || {", replace: "true || {",
    mustFail: "the hook and CI both call dev/check-identity.js" }
]);
process.exit(code);
