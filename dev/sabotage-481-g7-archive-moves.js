// dev/sabotage-481-g7-archive-moves.js — proves the #481 G7 guards are guarded: a row that leaves TODO.md for the archive must
// arrive byte-identical (the hook compares HEAD's archive with the index's; CI hands the parent's archive via --head-archive), a
// letter-prefixed id (L7) meets the row-size cap, and CI's per-commit cap covers only the rows each commit adds or edits.
// Each mutation runs in a disposable clone.
//   node dev/sabotage-481-g7-archive-moves.js
var sabotage = require("./sabotage.js"), code = 0;
var CMD = ["node", ["dev/tests-481-g7-archive-moves.js"]];
function prove(file, cases) { if (!code) code = sabotage.prove({ file: file, command: CMD, cases: cases }); }
prove("dev/lint-todo.js", [
  { label: "the move check never runs (a row changes on its way to the archive)",
    find: "  var archErrs = (opts.gitAware && headArchiveText !== null && headText !== undefined) ? archiveMoveErrors(headText, candidateText, headArchiveText, archiveText) : [];", replace: "  var archErrs = [];",
    mustFail: "the repro" },
  { label: "a letter id is not a row id (L7 escapes the cap again)",
    find: "var ROW_ID_RE = /^\\|\\s*([A-Za-z]*\\d+)\\s*\\|/;", replace: "var ROW_ID_RE = /^\\|\\s*(\\d+)\\s*\\|/;",
    mustFail: "a letter id (L7) is a row id" },
  { label: "CI's per-commit cap checks every row (an old branch fails for rows it never touched)",
    find: "rowSizeErrors(candidateText, 0, opts.capChanged ? headText : null)", replace: "rowSizeErrors(candidateText, 0, null)",
    mustFail: "CI caps only the rows a commit adds or edits" },
  { label: "the hook's staged mode does not read HEAD's archive",
    find: "    else if (opts.staged || opts.file === DEFAULT_FILE) { try { headArchiveText = readGit(\"HEAD:DOC/TODO_ARCHIVE.md\"); }", replace: "    else if (false) { try { headArchiveText = readGit(\"HEAD:DOC/TODO_ARCHIVE.md\"); }",
    mustFail: "the hook's path" }
]);
prove(".github/workflows/engine-tests.yml", [
  { label: "CI lints each commit without the parent's archive",
    find: " --head-archive {parentFile:DOC/TODO_ARCHIVE.md}", replace: "",
    mustFail: "the live files pass" }
]);
process.exit(code);
