// Column validation for TODO.md; kept separate from historical moved-row byte checks.
var fs = require("fs"), path = require("path"), cp = require("child_process");
var ROOT = path.join(__dirname, "..");
function measureRow(line) {
  var separators = 0, inCode = false, i, ch;
  // Match todo-viewer.html's splitCells boundary rules; the parity test pins both.
  for (i = 0; i < line.length; i++) {
    ch = line.charAt(i);
    if (ch === "\\" && line.charAt(i + 1) === "|") { i++; continue; }
    if (ch.charCodeAt(0) === 96) { inCode = !inCode; continue; }
    if (ch === "|" && !inCode) separators++;
  }
  return { columns: separators - 1, unclosed: inCode };
}
function columnErrors(text) {
  var lines = String(text).split(/\r?\n/), expected = null, errors = [];
  for (var i = 0; i < lines.length; i++) {
    var line = lines[i].trim();
    if (/^<!--\s*\/?completed\s*-->$/.test(line)) continue;
    if (!/^\|/.test(line)) { expected = null; continue; }
    var measured = measureRow(line);
    if (i + 1 < lines.length && /^\s*\|[\s:|-]+\|\s*$/.test(lines[i + 1])) expected = measured.columns;
    if (expected === null) continue;
    var id = /^\|\s*([A-Za-z]*\d+)\s*\|/.exec(line);
    var where = "line " + (i + 1) + (id ? ", row #" + id[1] : "");
    if (measured.unclosed) errors.push(where + ": unclosed code span; close the backtick before the next column.");
    if (measured.columns !== expected) errors.push(where + ": " + measured.columns + " columns; expected " + expected + ". Escape prose pipes as \\|; keep every cell on the same line.");
  }
  return errors;
}
function main(args) {
  var staged = false, tracker = "TODO.md", file = null, supplied = false;   /* audit 2026-11-19, G7: --tracker checks TODO_Atlas.md the same way */
  try {
    for (var i = 0; i < args.length; i++) {
      if (args[i] === "--staged") staged = true;
      else if (args[i] === "--file" && args[i + 1]) { file = path.resolve(args[++i]); supplied = true; }
      else if (args[i] === "--tracker" && args[i + 1]) tracker = args[++i];
      else throw new Error("Usage: node dev/check-todo-columns.js [--tracker TODO.md|TODO_Atlas.md] [--staged | --file path]");
    }
    if (staged && supplied) throw new Error("--staged and --file cannot be combined");
    if (tracker !== "TODO.md" && tracker !== "TODO_Atlas.md") throw new Error("--tracker names " + JSON.stringify(tracker) + "; the tracker files are TODO.md and TODO_Atlas.md");
    if (!supplied) file = path.join(ROOT, tracker);
    var text = staged ? cp.execFileSync("git", ["show", ":" + tracker], { cwd: ROOT, encoding: "utf8" }) : fs.readFileSync(file, "utf8");
    var errors = columnErrors(text);
    if (errors.length) {
      console.error("TODO COLUMN CHECK FAILED (" + (staged ? "staged " + tracker : file) + "):\n  " + errors.join("\n  "));
      return 1;
    }
    console.log("TODO columns OK (" + (staged ? "staged " + tracker : file) + ")");
    return 0;
  } catch (e) { console.error("TODO COLUMN CHECK FAILED: " + e.message); return 1; }
}
if (require.main === module) process.exitCode = main(process.argv.slice(2));
module.exports = { measureRow: measureRow, columnErrors: columnErrors, main: main };
