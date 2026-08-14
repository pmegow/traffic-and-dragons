// sabotage-todo-hygiene.js — #20: prove every blocking/advisory acceptance clause can fail.
// The acceptance command uses only the 809c9fa git-history copy and a synthetic temporary repo.
var sabotage = require("./sabotage.js");
var rc = 0;

rc |= sabotage.prove({
  file: "dev/lint-todo.js",
  command: ["node", ["dev/tests-todo-hygiene.js"]],
  cases: [
    { label: "changed moved rows are ignored — the #175 truncation passes again",
      mustFail: "moved #175 truncation is blocked and names the row",
      find: "      if (oldRow.raw === newRow.raw) return;",
      replace: "      return;" },
    { label: "byte-identical moved rows are rejected — legitimate reorder blocks",
      mustFail: "byte-identical row reorder passes",
      find: "      if (oldRow.raw === newRow.raw) return;",
      replace: "      if (oldRow.raw !== newRow.raw) return;" },
    { label: "every shared row is treated as moved — an in-place edit blocks",
      mustFail: "in-place status edit passes",
      find: "    var moved = {};",
      replace: "    var moved = {}; for (var sabotageI = 0; sabotageI < common.length; sabotageI++) moved[common[sabotageI]] = true;" },
    { label: "new-row classification is lost",
      mustFail: "new row passes",
      find: "    Object.keys(after).forEach(function (token) { if (!before[token]) added++; });",
      replace: "    Object.keys(after).forEach(function (token) { if (!before[token]) return; });" },
    { label: "deleted-row classification is lost",
      mustFail: "deleted row passes",
      find: "    Object.keys(before).forEach(function (token) { if (!after[token]) deleted++; });",
      replace: "    Object.keys(before).forEach(function (token) { if (!after[token]) return; });" }
  ]
});

rc |= sabotage.prove({
  file: "dev/session-check.js",
  command: ["node", ["dev/tests-todo-hygiene.js"]],
  cases: [
    { label: "dirty tracker status is swallowed",
      mustFail: "dirty-tree session advisory is loud and exits zero",
      find: "    status.split(/\\r?\\n/).forEach(function (line) { if (line.trim()) trackers.push(line); });",
      replace: "    status.split(/\\r?\\n/).forEach(function () {});" },
    { label: "ignored untracked testRuns files are omitted",
      mustFail: "dirty-tree session advisory is loud and exits zero",
      find: "      git(opts.root, [\"ls-files\", \"--others\", \"--ignored\", \"--exclude-standard\", \"--\", \"testRuns\"])",
      replace: "      \"\"" },
    { label: "lane declarations are not inspected",
      mustFail: "dirty-tree session advisory is loud and exits zero",
      find: "function laneCandidates(root, explicit) {\n  if (explicit.length) return explicit;",
      replace: "function laneCandidates(root, explicit) {\n  return [];" },
    { label: "advisory becomes a blocking exit",
      mustFail: "dirty-tree session advisory is loud and exits zero",
      find: "  if (inspectionErrors.length) {\n    console.warn(\"  Inspection errors (advisory could not verify these surfaces):\");\n    inspectionErrors.forEach(function (msg) { console.warn(\"    \" + msg); });\n  }\n  process.exit(0);",
      replace: "  if (inspectionErrors.length) {\n    console.warn(\"  Inspection errors (advisory could not verify these surfaces):\");\n    inspectionErrors.forEach(function (msg) { console.warn(\"    \" + msg); });\n  }\n  process.exit(1);" },
    { label: "dirty state is no longer labeled as an advisory",
      mustFail: "dirty-tree session advisory is loud and exits zero",
      find: "  console.warn(\"SESSION CHECK ADVISORY — shared-tree state needs attention (warn-only; exit 0)\");",
      replace: "  console.warn(\"shared-tree state\");" }
  ]
});

process.exit(rc ? 1 : 0);
