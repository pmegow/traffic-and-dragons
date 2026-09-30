// dev/sabotage-481-g4-row-ids.js — proves the #481 G4 guards are guarded: a TODO row id is used once across TODO.md and
// DOC/TODO_ARCHIVE.md, the grandfather list holds duplicates at their EXACT counts, the hook's staged mode reads the index's
// archive, and CI hands the lint each commit's archive. Each mutation runs in a disposable clone.
//   node dev/sabotage-481-g4-row-ids.js
var sabotage = require("./sabotage.js"), code = 0;
var CMD = ["node", ["dev/tests-481-g4-row-ids.js"]];
function prove(file, cases) { if (!code) code = sabotage.prove({ file: file, command: CMD, cases: cases }); }
prove("dev/lint-todo.js", [
  { label: "the id pass never runs (two | 463 | rows pass again)",
    find: "  var idErrs = idPass ? rowIdErrors(candidateText, archiveText) : [];", replace: "  var idErrs = [];",
    mustFail: "the repro" },
  { label: "the archive is ignored (an archived id can be claimed again)",
    find: "[[\"TODO.md\", todoText || \"\"], [\"DOC/TODO_ARCHIVE.md\", archiveText || \"\"]]", replace: "[[\"TODO.md\", todoText || \"\"]]",
    mustFail: "an open row that reuses an ARCHIVED id" },
  { label: "a grandfathered id may be copied without limit",
    find: "var g = ROW_ID_GRANDFATHER[k], allowed = g ? g.count : 1;", replace: "var g = ROW_ID_GRANDFATHER[k], allowed = g ? Infinity : 1;",
    mustFail: "the grandfather list is explicit" },
  { label: "the hook's staged mode does not read the index's archive",
    find: "    else if (opts.staged) { try { archiveText = readGit(\":DOC/TODO_ARCHIVE.md\"); }", replace: "    else if (false) { try { archiveText = readGit(\":DOC/TODO_ARCHIVE.md\"); }",
    mustFail: "the hook's path" }
]);
prove(".github/workflows/engine-tests.yml", [
  { label: "CI lints each commit without its archive",
    find: " --archive-file {file:DOC/TODO_ARCHIVE.md}", replace: "",
    mustFail: "the real TODO.md and archive pass" }
]);
process.exit(code);
