// dev/sabotage-481-g1-testruns-ignore.js — proves the #481 G1 guard is guarded: deleting the testRuns/ rule from
// .gitignore must fail the TESTRUNS IGNORE CONTRACT in dev/run-tests.js (the owner's own play would be one
// `git add` from the repo and the Pages deploy). Each mutation runs in a disposable clone (sabotage.js proveScratch,
// a real git clone, so check-ignore reads the mutated .gitignore); nothing here touches the working tree.
//   node dev/sabotage-481-g1-testruns-ignore.js
var sabotage = require("./sabotage.js"), code = 0;
var CMD = ["node", ["dev/run-tests.js", "#431 here"]];
function prove(file, cases) { if (!code) code = sabotage.prove({ file: file, command: CMD, cases: cases }); }
prove(".gitignore", [
  { label: "testRuns/ is no longer ignored",
    find: "# in dev/run-tests.js.\ntestRuns/\n", replace: "# in dev/run-tests.js.\n",
    mustFail: "TESTRUNS IGNORE CONTRACT BROKEN" }
]);
process.exit(code);
