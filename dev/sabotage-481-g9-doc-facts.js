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
// #334 (2026-09-30): the docs said the Gemini cache was off after the owner enabled it, and a deploy believed them.
var T334 = "#334: the prompt contract and the design doc";
failed += sabotage.prove({ file: "DOC/contracts/prompt.md", command: CMD, cases: [
  { label: "the prompt contract says the cache is off and pending again (the sentence the 2026-09-10 deployer read)",
    find: "**The switch is ON in production, by owner ruling.**", replace: "**the flag is off and live enablement is pending**.",
    mustFail: T334 },
  { label: "the contract no longer names the server's pin",
    find: "  `test-deploy-config.mjs`. Read the state there.", replace: "  tests. Read the state there.",
    mustFail: T334 }
]});
failed += sabotage.prove({ file: "DOC/DESIGN_334_gemini_explicit_cache.md", command: CMD, cases: [
  { label: "the design doc loses its Live state line (its body still says flag 0)",
    find: "**Live state (2026-09-30): the cache is ON in production, by owner ruling.**", replace: "**Live state:** see the server.",
    mustFail: T334 }
]});
failed += sabotage.prove({ file: "dev/check-doc-facts.js", command: CMD, cases: [
  { label: "the state sentence is never checked",
    find: "    if (sec.indexOf(\"**The switch is \" + CACHE_STATE + \".**\") < 0) out.push(", replace: "    if (false) out.push(",
    mustFail: T334 },
  { label: "the source-of-truth pointer is never checked",
    find: "    if (sec.indexOf(\"test-deploy-config.mjs\") < 0) out.push(", replace: "    if (false) out.push(",
    mustFail: T334 },
  { label: "the cache check never reaches allProblems (run-tests would not see it)",
    find: ".concat(scriptCountProblems(root, opts)).concat(cacheSwitchProblems(root, opts)); }", replace: ".concat(scriptCountProblems(root, opts)); }",
    mustFail: T334 }
]});
failed += sabotage.prove({ file: "dev/run-tests.js", command: CMD, cases: [
  { label: "run-tests stops calling the check",
    find: "  var _docFacts = require(\"./check-doc-facts.js\").allProblems(require(\"path\").join(__dirname, \"..\"));", replace: "  var _docFacts = [];",
    mustFail: "run-tests runs the check" }
]});
process.exit(failed ? 1 : 0);
