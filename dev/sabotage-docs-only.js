// dev/sabotage-docs-only.js — proves the guards on the documentation-only skip (dev/docs-only.js, owner ruling 2026-11-18):
// only the narrow list skips; a deletion, a test input, an empty or unreadable staged set runs the suite; the hook runs
// the link check on a yes and the suite on a no. Each clause plants the regression; dev/tests-docs-only.js must then FAIL
// by name. A mutation that changes no bytes is a hard failure.
//   node dev/sabotage-docs-only.js
var sabotage = require("./sabotage.js");
var SUITE = ["node", ["dev/tests-docs-only.js"]];
var rc = 0;

rc |= sabotage.prove({ file: "dev/docs-only.js", command: SUITE, cases: [
  { label: "the contract docs are on the list (a contract edit skips the tests that check it against the code)",
    find: "  if (/^DOC\\/contracts\\//.test(file)) return false;\n",
    replace: "",
    mustFail: "the narrow list" },
  { label: "any file under any folder named DOC or audits is on the list (the anchor dropped)",
    find: "  return /^(DOC|audits)\\/.+/.test(file);",
    replace: "  return /(DOC|audits)\\/.+/.test(file);",
    mustFail: "the narrow list" },
  { label: "one documentation file in the set is enough (the first file decides)",
    find: "    if (!onNarrowList(s.file)) return { docsOnly: false, why: s.file + \" is not documentation",
    replace: "    if (!onNarrowList(s.file) && i === 0) return { docsOnly: false, why: s.file + \" is not documentation",
    mustFail: "one file off the list makes it a full run" },
  { label: "a deleted doc skips the suite",
    find: "    if (s.status !== \"A\" && s.status !== \"M\") return {",
    replace: "    if (s.status !== \"A\" && s.status !== \"M\" && s.status !== \"D\") return {",
    mustFail: "a deletion or a rename is a full run" },
  { label: "a doc a test reads skips the suite (the reader check dropped)",
    find: "    if (by) return { docsOnly: false, why: s.file + \" is named in \" + by + \" — a test may read it\" };\n",
    replace: "",
    mustFail: "a doc a dev script names is a test input" },
  { label: "a doc named only by its file name (a path.join) is not seen as a test input",
    find: "      if (!/[A-Za-z0-9_.-]/.test(before) && !/[A-Za-z0-9_-]/.test(after)) return names[i];",
    replace: "      if (false) return names[i];",
    mustFail: "a doc a dev script names is a test input" },
  { label: "nothing staged counts as documentation only",
    find: "  if (!staged.length) return { docsOnly: false, why: \"nothing is staged\" };\n",
    replace: "",
    mustFail: "nothing staged is not documentation only" },
  { label: "a staged set that cannot be read counts as documentation only",
    find: "  catch (e) { verdict = { docsOnly: false, why: \"the staged set could not be read (\"",
    replace: "  catch (e) { verdict = { docsOnly: true, why: \"the staged set could not be read (\"",
    mustFail: "what cannot be read is a no" },
  { label: "the working tree is judged, not the staged set (an unstaged engine edit decides)",
    find: "[\"diff\", \"--cached\", \"--name-status\", \"--no-renames\", \"-z\"]",
    replace: "[\"diff\", \"HEAD\", \"--name-status\", \"--no-renames\", \"-z\"]",
    mustFail: "docs staged is a yes" },
  { label: "a rename is read as a rename and slips past as neither added nor deleted... or as an added file",
    find: "[\"diff\", \"--cached\", \"--name-status\", \"--no-renames\", \"-z\"]",
    replace: "[\"diff\", \"--cached\", \"--name-status\", \"--diff-filter=AM\", \"--no-renames\", \"-z\"]",
    mustFail: "an engine file, a deletion, a rename" },
  { label: "the judge reads itself (its own header would make every doc it names a full run, and hide a real reader's name)",
    find: "return /\\.js$/.test(f) && f !== \"docs-only.js\"; })",
    replace: "return /\\.js$/.test(f); })",
    mustFail: "the real tree" }
] });

rc |= sabotage.prove({ file: "dev/pre-commit", command: SUITE, cases: [
  { label: "a documentation-only commit skips the doc link check too",
    find: "  node \"$(git rev-parse --show-toplevel)/dev/check-doc-links.js\" || {",
    replace: "  true || {",
    mustFail: "the hook: a yes runs the doc link check" },
  { label: "every commit is treated as documentation only (the engine suite never runs)",
    find: "if node \"$(git rev-parse --show-toplevel)/dev/docs-only.js\"; then",
    replace: "if true; then",
    mustFail: "the hook: a yes runs the doc link check" },
  { label: "the TODO lint moves after the question (a documentation-only commit skips it)",
    find: "node \"$(git rev-parse --show-toplevel)/dev/lint-todo.js\" --git-aware --staged --cap || {",
    replace: "true || {",
    mustFail: "TODO.md and its archive skip" }
] });

process.exit(rc);
