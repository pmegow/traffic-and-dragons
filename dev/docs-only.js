// dev/docs-only.js — is this commit DOCUMENTATION ONLY? (owner ruling 2026-11-18, plan 5(c) of the commit-time plans)
// One job: answer for the staged set, so the pre-commit can skip the engine suite (about 45 s) for a commit no test reads.
// The hook's TODO checks, identity, ES5 and shell-marker checks run either way, and so does the doc link check; CI runs
// the whole suite on every push regardless (owner ruling: only the local hook skips).
//
// A commit is documentation only when EVERY staged file:
//   · is added or modified — a deletion or a rename can break a link or a reader, so it takes the full run;
//   · is on the NARROW list: TODO.md, anything under DOC/ except DOC/contracts/, anything under audits/.
//     CLAUDE.md and DOC/contracts/ are NOT on it: tests check their facts against the code;
//   · is read by no test. DERIVED, never a list: a file whose path or file name appears in any dev/*.js (this file
//     aside) is treated as a test input — the bug feed, the QA log and the beta guide are, today — and takes the full
//     run. A mention in a comment counts too: that errs toward running the suite. The game's own root files are not
//     readers: a page cannot read the repository's documents.
//     TODO.md and DOC/TODO_ARCHIVE.md are the two stated exceptions: what reads them is lint-todo, check-todo-columns and
//     tests-todo-hygiene, which the hook runs on every commit before it asks this question.
// An empty staged set, or anything this cannot read, is NOT documentation only: the full run is the answer to doubt.
//
//   node dev/docs-only.js [--root DIR]     exit 0 documentation only (one line says so) · 1 not (one line says why)
"use strict";
var fs = require("fs"), path = require("path"), cp = require("child_process");

var COVERED_BY_THE_HOOK = { "TODO.md": true, "DOC/TODO_ARCHIVE.md": true };

function onNarrowList(file) {
  if (file === "TODO.md") return true;
  if (/^DOC\/contracts\//.test(file)) return false;
  return /^(DOC|audits)\/.+/.test(file);
}

// readers — the sources that could read a doc: every dev/*.js but this one, as { name: text }.
function readers(root) {
  var out = {};
  fs.readdirSync(path.join(root, "dev")).filter(function (f) { return /\.js$/.test(f) && f !== "docs-only.js"; })
    .forEach(function (f) { out["dev/" + f] = fs.readFileSync(path.join(root, "dev", f), "utf8"); });
  return out;
}

// readBy — the first source that names the file (its path, or its file name as a whole word), or null.
function readBy(file, sources) {
  var base = file.split("/").pop(), names = Object.keys(sources).sort(), i, text, at, before, after;
  for (i = 0; i < names.length; i++) {
    text = sources[names[i]];
    if (text.indexOf(file) >= 0) return names[i];
    for (at = text.indexOf(base); at >= 0; at = text.indexOf(base, at + 1)) {
      before = at ? text.charAt(at - 1) : ""; after = text.charAt(at + base.length);
      if (!/[A-Za-z0-9_.-]/.test(before) && !/[A-Za-z0-9_-]/.test(after)) return names[i];
    }
  }
  return null;
}

// judge — pure: staged [{ status, file }] and the reader sources to { docsOnly, why }.
function judge(staged, sources) {
  if (!staged.length) return { docsOnly: false, why: "nothing is staged" };
  for (var i = 0; i < staged.length; i++) {
    var s = staged[i], by;
    if (s.status !== "A" && s.status !== "M") return { docsOnly: false, why: s.file + " is " + (s.status === "D" ? "deleted" : "staged as " + s.status) + " — only an added or modified file can skip" };
    if (!onNarrowList(s.file)) return { docsOnly: false, why: s.file + " is not documentation (TODO.md, DOC/ outside contracts/, audits/)" };
    if (COVERED_BY_THE_HOOK[s.file]) continue;
    by = readBy(s.file, sources);
    if (by) return { docsOnly: false, why: s.file + " is named in " + by + " — a test may read it" };
  }
  return { docsOnly: true, why: staged.length + " file(s): " + staged.map(function (s) { return s.file; }).join(", ") };
}

function stagedFiles(root) {
  var r = cp.spawnSync("git", ["diff", "--cached", "--name-status", "--no-renames", "-z"], { cwd: root, encoding: "utf8" });
  if (r.status !== 0) throw new Error(String(r.stderr || r.error || "git diff --cached failed").trim());
  var parts = r.stdout.split("\0").filter(function (p) { return p !== ""; }), out = [];
  for (var i = 0; i + 1 < parts.length; i += 2) out.push({ status: parts[i].charAt(0), file: parts[i + 1].replace(/\\/g, "/") });
  return out;
}

function main() {
  var root = path.join(__dirname, ".."), i = process.argv.indexOf("--root"), verdict;
  if (i > 0 && process.argv[i + 1]) root = path.resolve(process.argv[i + 1]);
  try { verdict = judge(stagedFiles(root), readers(root)); }
  catch (e) { verdict = { docsOnly: false, why: "the staged set could not be read (" + e.message + ")" }; }
  if (verdict.docsOnly) console.log("DOCS ONLY — the engine suite is skipped for this commit (" + verdict.why + "). CI runs it on the push.");
  else console.log("docs-only: no — " + verdict.why + "; the engine suite runs.");
  process.exit(verdict.docsOnly ? 0 : 1);
}

if (require.main === module) main();
module.exports = { judge: judge, onNarrowList: onNarrowList, readBy: readBy, readers: readers, stagedFiles: stagedFiles };
