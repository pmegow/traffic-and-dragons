// dev/sabotage-481-g10-es5-check.js — proves the #481 G10 guards are guarded: the ES5 lexer must keep catching arrows
// and must keep skipping string literals (else every "=>" in prose becomes a false positive and the rule gets
// switched off); and CI must keep running dev/check-es5.js, which the pre-commit hook runs (the #G1 coverage rule
// in dev/check-enforcement.js, enforced by run-tests.js). Each mutation runs in a disposable clone.
//   node dev/sabotage-481-g10-es5-check.js
var sabotage = require("./sabotage.js"), code = 0;
function prove(file, command, cases) { if (!code) code = sabotage.prove({ file: file, command: command, cases: cases }); }
var SUITE = ["node", ["dev/tests-es5-check.js"]];
prove("dev/check-es5.js", SUITE, [
  { label: "arrow functions are no longer detected",
    find: 'if (c === "=" && d === ">") { hit("arrow function", line);', replace: 'if (false) { hit("arrow function", line);',
    mustFail: "each forbidden form is caught" },
  { label: "string literals are no longer skipped (every \"=>\" in prose would fire)",
    find: "    if (c === \"'\" || c === '\"') {\n", replace: "    if (false) {\n",
    mustFail: "the same characters inside strings" }
]);
prove(".github/workflows/engine-tests.yml", ["node", ["dev/run-tests.js", "#431 here"]], [
  { label: "CI stops running the ES5 check the hook runs",
    find: "      - name: ES5 check for the game client\n        run: node dev/check-es5.js\n", replace: "",
    mustFail: "never runs dev/check-es5.js" }
]);
process.exit(code);
