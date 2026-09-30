// dev/sabotage-481-g9-doc-facts.js — proves the #481 G9 guards are guarded: CLAUDE.md's load order is derived from
// index.html, a script-tag count in the index.html row must be true, the corrected prose stays corrected, and run-tests runs
// the check. Each mutation runs in a disposable clone.
//   node dev/sabotage-481-g9-doc-facts.js
var sabotage = require("./sabotage.js"), failed = 0;
var CMD = ["node", ["dev/tests-481-g9-doc-facts.js"]];
failed += sabotage.prove({ file: "dev/check-doc-facts.js", command: CMD, cases: [
  { label: "the load order is never compared",
    find: "  if (real.join(\"|\") === doc.join(\"|\")) return [];", replace: "  return [];",
    mustFail: "a drifted load order is named" },
  { label: "a written script count is never checked",
    find: "return m && +m[1] !== real ?", replace: "return false ?",
    mustFail: "a script-tag count in the index.html row must be true" }
]});
failed += sabotage.prove({ file: "CLAUDE.md", command: CMD, cases: [
  { label: "the documented load order drifts (two entries swapped)",
    find: "blueprint-edition.js → library-slug.js → ", replace: "library-slug.js → blueprint-edition.js → ",
    mustFail: "the live CLAUDE.md" },
  { label: "applyMuts is \"a thin veneer\" again",
    find: "`applyMuts` (THE tag-application boundary:", replace: "`applyMuts` (a thin veneer — THE tag-application boundary:",
    mustFail: "the corrected prose" }
]});
failed += sabotage.prove({ file: "dev/run-tests.js", command: CMD, cases: [
  { label: "run-tests stops calling the check",
    find: "  var _docFacts = require(\"./check-doc-facts.js\").allProblems(require(\"path\").join(__dirname, \"..\"));", replace: "  var _docFacts = [];",
    mustFail: "run-tests runs the check" }
]});
process.exit(failed ? 1 : 0);
