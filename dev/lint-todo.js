// lint-todo.js — TODO.md table-integrity gate (DEV TOOL, runs in pre-commit before the engine tests).
// Guards against the recurring "backlog rows escape the table" corruption: a cell containing a raw
// newline splits its row across physical lines (invalid GFM), and every row below the break falls
// out of the table. Writers that have caused it: todo-viewer.html exports (escCell didn't escape
// newlines — fixed 2026-07-09) and hand/model edits that complete the first line of a wrapped row,
// stranding its tail. This lint fails LOUDLY on any shape of the break, whatever wrote it.
//   node dev/lint-todo.js          — exit 0 clean, exit 1 with line-numbered findings
//
// Rules (deterministic, no heuristics):
//   1. ORPHAN TAIL — a line that does NOT start with "|" but ENDS with "|" is the spilled tail of
//      a split row (prose never ends with a pipe in this file).
//   2. WRAPPED ROW — a line that starts with "|" but does NOT end with "|" is a row whose cell
//      newline pushed the rest onto later lines.
//   3. STRANDED ROW — a "|" line whose previous line is not a "|" line must be a table HEADER,
//      i.e. immediately followed by a |---| delimiter row; otherwise it's a row cut off from its
//      table (renders as a loose paragraph).
var fs = require("fs");
var path = require("path");
var file = path.join(__dirname, "..", "TODO.md");
var lines = fs.readFileSync(file, "utf8").split("\n");
var errs = [];
function isRow(s) { return /^\s*\|/.test(s); }
function endsRow(s) { return /\|\s*$/.test(s); }
function isDelim(s) { return /^\s*\|[\s:|-]+\|\s*$/.test(s); }
for (var i = 0; i < lines.length; i++) {
  var ln = lines[i], t = ln.trim();
  if (!t) continue;
  if (!isRow(t)) {
    if (endsRow(t)) errs.push((i + 1) + ": orphaned row tail (cell text spilled out of its table row): " + t.slice(0, 80));
    continue;
  }
  if (!endsRow(t)) { errs.push((i + 1) + ": wrapped row (starts with | but does not end with |): " + t.slice(0, 80)); continue; }
  var prevRow = i > 0 && isRow(lines[i - 1].trim()) && lines[i - 1].trim();
  if (!prevRow && !isDelim(t)) {
    var next = i + 1 < lines.length ? lines[i + 1].trim() : "";
    if (!isDelim(next)) errs.push((i + 1) + ": stranded row (table row with no header/delimiter above it): " + t.slice(0, 80));
  }
}
if (errs.length) {
  console.error("TODO.md TABLE INTEGRITY FAILED (" + errs.length + " finding" + (errs.length > 1 ? "s" : "") + "):");
  for (var e = 0; e < errs.length; e++) console.error("  ✗ line " + errs[e]);
  console.error("A table cell must not contain raw newlines — use <br>. Rows must be one physical line each.");
  process.exit(1);
}
console.log("TODO.md tables OK (" + lines.length + " lines)");
process.exit(0);
