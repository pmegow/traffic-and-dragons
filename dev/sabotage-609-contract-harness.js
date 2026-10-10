// dev/sabotage-609-contract-harness.js — proves #609 is guarded: the contract-sabotage harness mirrors the whole working set
// through sabotage.js's one mirror, and that mirror honours the root a probe hands it.
//   node dev/sabotage-609-contract-harness.js
var sabotage = require("./sabotage.js");
var CMD = ["node", ["dev/tests-609-contract-harness.js"]];
var code = 0;
function prove(file, cases) { if (!code) code = sabotage.prove({ file: file, command: CMD, cases: cases }); }
var RIDE = "the working set rides in";
prove("dev/scratch-contract-sabotage.js", [
  { label: "the harness stops mirroring the working set (the clone is HEAD plus the mutated file again)",
    find: '    require("./sabotage.js").mirrorWorkingSet(scratch, root);   /* the working set, whole — tracked changes, deletions, untracked files */\n', replace: "",
    mustFail: RIDE }
]);
prove("dev/sabotage.js", [
  { label: "the mirror ignores the root it is handed (a probe's fixture gets the repo's working set)",
    find: "  var root = rootArg || ROOT;   /* #609: a probe hands a fixture repo; every battery leaves it to the repo */", replace: "  var root = ROOT;",
    mustFail: RIDE }
]);
process.exit(code);
