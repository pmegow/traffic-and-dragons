// dev/sabotage-481-g2-ci-range.js — proves the #481 G2 guards are guarded: CI computes ONE range per run (a PR's base, a
// push's event.before via merge-base, never an empty range), runs the per-commit gates over every commit of it (a failing
// commit stops the run), and the enforcement pins catch the range step's removal. Each mutation runs in a disposable clone.
//   node dev/sabotage-481-g2-ci-range.js
var sabotage = require("./sabotage.js"), code = 0;
var CMD = ["node", ["dev/tests-481-g2-ci-range.js"]];
function prove(file, cases) { if (!code) code = sabotage.prove({ file: file, command: CMD, cases: cases }); }
prove("dev/ci-range.js", [
  { label: "a pull request ignores its base.sha",
    find: "  if (name === \"pull_request\" && p.pull_request && p.pull_request.base) {", replace: "  if (false) {",
    mustFail: "ci-range picks ONE base" },
  { label: "an empty range (base = HEAD) counts",
    find: "  function usable(rev) { return rev && rev !== head ? rev : null; }", replace: "  function usable(rev) { return rev || null; }",
    mustFail: "ci-range picks ONE base" }
]);
prove("dev/ci-per-commit.js", [
  { label: "a failing commit does not stop the run",
    find: "    if (r.status !== 0) {", replace: "    if (false) {",
    mustFail: "the repro" }
]);
prove("dev/check-enforcement.js", [
  { label: "the range step is not pinned",
    find: "    { label: \"node dev/ci-range.js --github-env (#481 G2: one range per run)\", pattern: /run:\\s*node dev\\/ci-range\\.js\\s+--github-env(?:\\s|$)/ },\n", replace: "",
    mustFail: "the workflow feeds ONE range" }
]);
process.exit(code);
