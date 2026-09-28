// sabotage-475-scratch-mirror.js — retained proof for #475: proveScratch's clone mirrors the working set (modified,
// added and deleted tracked files, untracked non-ignored files) and skips testRuns/ run logs out loud. Every clause must
// redden a NAMED line of the fixture-repo case in dev/tests-sabotage-meta.js, which drives a copy of sabotage.js.
var sabotage = require("./sabotage.js");
process.exit(sabotage.prove({
  file: "dev/sabotage.js",
  command: ["node", ["dev/tests-sabotage-meta.js"]],
  cases: [
    { label: "the clone stops mirroring the working set (HEAD plus a hand-kept list again)",
      find: "    try { mirrorWorkingSet(scratch); }", replace: "    try { }",
      mustFail: "the scratch clone did not mirror the working set: a modified tracked file" },
    { label: "a file deleted in the working tree survives in the clone",
      find: "    if (changed[i] === \"D\") fs.rmSync(path.join(scratch, changed[i + 1]), { force: true });\n    else copyIn(changed[i + 1]);",
      replace: "    copyIn(changed[i + 1]);",
      mustFail: "the scratch clone did not mirror the working set: a deleted tracked file" },
    { label: "untracked files stay out of the clone",
      find: "git([\"ls-files\", \"--others\", \"--exclude-standard\", \"-z\"]).split(\"\\0\").filter(Boolean)",
      replace: "git([\"ls-files\", \"--others\", \"--exclude-standard\", \"-z\"]).split(\"\\0\").filter(function () { return false; })",
      mustFail: "the scratch clone did not mirror the working set: an untracked file" },
    { label: "the testRuns/ skip is lost (every run log rides into every clone)",
      find: "  { re: /^testRuns\\//, what: \"personal run log(s) under testRuns/\" },\n", replace: "",
      mustFail: "the scratch clone did not mirror the working set: a testRuns/ log" },
    { label: "the mirror's skip goes silent",
      find: "  if (said.length && !_mirrorSkipSaid) {", replace: "  if (false) {",
      mustFail: "the testRuns/ skip was silent" }
  ]
}));
