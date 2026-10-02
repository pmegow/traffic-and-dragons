// sabotage-551-scratch-reuse.js — retained proof for #551: a battery proves in ONE scratch clone reused by every prove()
// group; before each group the clone is reset to HEAD (checkout, then clean) and the working set mirrored as it is then;
// a moved HEAD gets a new clone; the clone is removed when the battery exits. Every clause must redden a NAMED line of the
// clone-reuse fixture case in dev/tests-sabotage-meta.js, which drives a copy of sabotage.js in its own git repo.
var sabotage = require("./sabotage.js");
process.exit(sabotage.prove({
  file: "dev/sabotage.js",
  command: ["node", ["dev/tests-sabotage-meta.js"]],
  cases: [
    { label: "every group clones afresh again",
      find: "if (_scratch && _scratch.head === head) {", replace: "if (false) {",
      mustFail: "the second group cloned again instead of reusing the battery's clone" },
    { label: "a reused clone keeps a tracked file a run changed",
      find: "reset = gitIn(_scratch.dir, [\"checkout\", \"--quiet\", \"--\", \".\"]);", replace: "reset = { status: 0 };",
      mustFail: "a reused clone was not reset to HEAD before the next group" },
    { label: "a reused clone keeps a file a run left behind",
      find: "if (reset.status === 0) reset = gitIn(_scratch.dir, [\"clean\", \"-fdxq\"]);", replace: "",
      mustFail: "a reused clone was not reset to HEAD before the next group" },
    { label: "a reused clone is mirrored only when first cloned",
      find: "    try { mirrorWorkingSet(scratch); }", replace: "    try { if (!_scratch.mirrored) { mirrorWorkingSet(scratch); _scratch.mirrored = true; } }",
      mustFail: "a reused clone was not re-mirrored at the group's start" },
    { label: "a moved HEAD keeps proving in the old commit's clone",
      find: "if (_scratch && _scratch.head === head) {", replace: "if (_scratch) {",
      mustFail: "a moved HEAD did not give the next group a clone of the new commit" },
    { label: "the clone outlives the battery",
      find: "process.on(\"exit\", dropScratch);", replace: "",
      mustFail: "a scratch clone was left on disk after the battery exited" }
  ]
}));
