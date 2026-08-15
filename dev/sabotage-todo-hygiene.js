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
      replace: "  console.warn(\"shared-tree state\");" },
    { label: "overdue schedule entries are swallowed",
      mustFail: "overdue schedule entry surfaces loudly and exits zero",
      find: "    if (entry.due <= today) due.push(entry);",
      replace: "    if (false) due.push(entry);" },
    { label: "future schedule entries fire early",
      mustFail: "future schedule entry stays silent",
      find: "    if (entry.due <= today) due.push(entry);",
      replace: "    if (entry.due >= today) due.push(entry);" },
    { label: "corrupt schedule JSON is swallowed",
      mustFail: "corrupt schedule warns loudly and exits zero",
      find: "  catch (e) { return { due: [], errors: [\"dev/schedule.json is malformed or unreadable: \" + e.message] }; }",
      replace: "  catch (e) { return { due: [], errors: [] }; }" },
    { label: "doc-size inspection is no longer consulted",
      mustFail: "doc over its watch threshold surfaces loudly and exits zero",
      find: "  try { docs = docSize.inspect(opts.root); }\n  catch (e4) { inspectionErrors.push(\"doc-size inspection failed: \" + e4.message); }",
      replace: "" }
  ]
});

rc |= sabotage.prove({
  file: "dev/tests-todo-hygiene.js",
  command: ["node", ["dev/tests-todo-hygiene.js"]],
  cases: [
    { label: "fixture git env scrub is dropped — inherited GIT_DIR/GIT_WORK_TREE reach fixture repos again",
      mustFail: "fixture git calls ignore inherited repo-location env (GIT_DIR/GIT_WORK_TREE)",
      find: "  [\"GIT_DIR\", \"GIT_WORK_TREE\", \"GIT_INDEX_FILE\", \"GIT_COMMON_DIR\", \"GIT_OBJECT_DIRECTORY\",\n   \"GIT_ALTERNATE_OBJECT_DIRECTORIES\", \"GIT_PREFIX\"].forEach(function (k) { delete env[k]; });",
      replace: "" }
  ]
});

rc |= sabotage.prove({
  file: "dev/doc-size.js",
  command: ["node", ["dev/tests-todo-hygiene.js"]],
  cases: [
    { label: "watch threshold stops firing",
      mustFail: "doc over its watch threshold surfaces loudly and exits zero",
      find: "    else if (size >= doc.watchBytes)\n      warnings.push(\"DOC SIZE WATCH: \"",
      replace: "    else if (false)\n      warnings.push(\"DOC SIZE WATCH: \"" },
    { label: "problem threshold never escalates",
      mustFail: "doc over its problem threshold escalates past WATCH",
      find: "    if (size >= doc.problemBytes)\n      warnings.push(\"DOC SIZE PROBLEM: \"",
      replace: "    if (false)\n      warnings.push(\"DOC SIZE PROBLEM: \"" },
    { label: "missing watched doc is silently skipped",
      mustFail: "missing watched doc warns loudly and exits zero",
      find: "    catch (e) { errors.push(doc.file + \" could not be measured: \" + e.message); return; }",
      replace: "    catch (e) { return; }" },
    { label: "registry watch threshold is inflated to infinity",
      mustFail: "doc over its watch threshold surfaces loudly and exits zero",
      find: "    watchBytes: 120210,",
      replace: "    watchBytes: 999999999," }
  ]
});

process.exit(rc ? 1 : 0);
