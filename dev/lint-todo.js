// lint-todo.js — TODO.md table-integrity gate (DEV TOOL, runs before engine tests).
//
// Shape lint catches physical-line/table-boundary damage. Git-aware mode additionally catches
// the 2026-08-14 hand-move incident: a row was reordered and truncated at a raw pipe inside its
// status prose, leaving a shorter line that still looked like a complete GFM row.
//
//   node dev/lint-todo.js                         shape + moved-row verify the working file
//   node dev/lint-todo.js --shape-only            physical table shape only
//   node dev/lint-todo.js --git-aware --staged    verify the exact index blob (pre-commit)
//   node dev/lint-todo.js --git-aware --file X --head-file Y   synthetic fixture seam
var fs = require("fs");
var path = require("path");
var cp = require("child_process");

var ROOT = path.join(__dirname, "..");
var DEFAULT_FILE = path.join(ROOT, "TODO.md");

function isRow(s) { return /^\s*\|/.test(s); }
function endsRow(s) { return /\|\s*$/.test(s); }
function isDelim(s) { return /^\s*\|[\s:|-]+\|\s*$/.test(s); }

function shapeErrors(text) {
  var lines = text.split("\n");
  var errs = [];
  for (var i = 0; i < lines.length; i++) {
    var ln = lines[i], t = ln.trim();
    if (!t) continue;
    if (!isRow(t)) {
      if (endsRow(t)) errs.push((i + 1) + ": orphaned row tail (cell text spilled out of its table row): " + t.slice(0, 80));
      continue;
    }
    if (!endsRow(t)) {
      errs.push((i + 1) + ": wrapped row (starts with | but does not end with |): " + t.slice(0, 80));
      continue;
    }
    var prevRow = i > 0 && isRow(lines[i - 1].trim()) && lines[i - 1].trim();
    if (!prevRow && !isDelim(t)) {
      var next = i + 1 < lines.length ? lines[i + 1].trim() : "";
      if (!isDelim(next)) errs.push((i + 1) + ": stranded row (table row with no header/delimiter above it): " + t.slice(0, 80));
    }
  }
  return errs;
}

function headingKey(stack) {
  var out = [];
  for (var i = 1; i < stack.length; i++) if (stack[i]) out.push(stack[i]);
  return out.join(" > ");
}

function parseTables(text) {
  var lines = text.split(/\r?\n/);
  var headings = [];
  var seenTables = {};
  var tables = [];
  for (var i = 0; i < lines.length; i++) {
    var hm = lines[i].match(/^(#{1,6})\s+(.+?)\s*$/);
    if (hm) {
      var level = hm[1].length;
      headings[level] = hm[2];
      headings.length = level + 1;
      continue;
    }
    if (!isRow(lines[i]) || i + 1 >= lines.length || !isDelim(lines[i + 1])) continue;
    var base = headingKey(headings) + " :: " + lines[i].trim();
    var occurrence = seenTables[base] || 0;
    seenTables[base] = occurrence + 1;
    var table = { key: base + " :: table " + occurrence, groupKey: base, rows: [] };
    i += 2;
    var ids = {};
    while (i < lines.length && isRow(lines[i])) {
      var raw = lines[i].replace(/\r$/, "");
      var firstPipe = raw.indexOf("|");
      var secondPipe = raw.indexOf("|", firstPipe + 1);
      var id = secondPipe < 0 ? "" : raw.slice(firstPipe + 1, secondPipe).trim();
      var nth = ids[id] || 0;
      ids[id] = nth + 1;
      table.rows.push({ id: id, token: id + "\u0000" + nth, raw: raw, line: i + 1 });
      i++;
    }
    i--;
    tables.push(table);
  }
  return tables;
}

function tableMap(tables) {
  var out = {};
  for (var i = 0; i < tables.length; i++) {
    var key = tables[i].groupKey;
    if (!out[key]) out[key] = { key: key, rows: [] };
    out[key].rows = out[key].rows.concat(tables[i].rows);
  }
  return out;
}

function shortExcerpt(s) {
  var clean = String(s || "").replace(/\s+/g, " ").trim();
  if (clean.length > 100) clean = clean.slice(0, 97) + "...";
  return JSON.stringify(clean);
}

function differenceSummary(before, after) {
  var beforeBytes = Buffer.byteLength(before, "utf8");
  var afterBytes = Buffer.byteLength(after, "utf8");
  var at = 0;
  while (at < before.length && at < after.length && before.charAt(at) === after.charAt(at)) at++;
  var parts = ["HEAD " + beforeBytes + " bytes; candidate " + afterBytes + " bytes"];
  if (afterBytes < beforeBytes) parts.push((beforeBytes - afterBytes) + " bytes shorter");
  else if (afterBytes > beforeBytes) parts.push((afterBytes - beforeBytes) + " bytes longer");
  if (at === after.length && at < before.length) parts.push("missing HEAD text begins " + shortExcerpt(before.slice(at, at + 140)));
  else parts.push("first difference near HEAD " + shortExcerpt(before.slice(at, at + 90)) + " vs candidate " + shortExcerpt(after.slice(at, at + 90)));
  return parts.join("; ");
}

function movedRowErrors(headText, candidateText) {
  var headTables = tableMap(parseTables(headText));
  var candidateTables = tableMap(parseTables(candidateText));
  var errs = [];
  var reordered = 0;
  var added = 0;
  var deleted = 0;
  Object.keys(headTables).forEach(function (key) {
    var beforeTable = headTables[key];
    var afterTable = candidateTables[key];
    if (!afterTable) return;
    var i, j;
    // Pair rows by EXACT BYTES first. Two unrelated rows can share an id (an open row and a
    // closed twin under the same section — #6, #19); the nth-occurrence token then shifts when
    // one copy leaves for the archive, and a token-only pairing reports the survivor as "moved
    // and changed" (the 2026-09-01 archive-move false positive). A byte-identical row is the
    // same row wherever it sits; only rows with no byte twin fall back to the id token.
    var afterTaken = [];
    for (i = 0; i < afterTable.rows.length; i++) afterTaken.push(false);
    var pairs = [];
    for (i = 0; i < beforeTable.rows.length; i++) {
      var b = beforeTable.rows[i], hit = -1;
      for (j = 0; j < afterTable.rows.length; j++) { if (!afterTaken[j] && afterTable.rows[j].raw === b.raw) { hit = j; break; } }
      pairs.push({ before: b, beforeOrder: i, after: hit >= 0 ? afterTable.rows[hit] : null, afterOrder: hit });
      if (hit >= 0) afterTaken[hit] = true;
    }
    for (i = 0; i < pairs.length; i++) {
      if (pairs[i].after) continue;
      for (j = 0; j < afterTable.rows.length; j++) {
        if (!afterTaken[j] && afterTable.rows[j].token === pairs[i].before.token) { pairs[i].after = afterTable.rows[j]; pairs[i].afterOrder = j; afterTaken[j] = true; break; }
      }
    }
    for (i = 0; i < pairs.length; i++) if (!pairs[i].after) deleted++;
    for (j = 0; j < afterTable.rows.length; j++) if (!afterTaken[j]) added++;
    var common = [];
    for (i = 0; i < pairs.length; i++) if (pairs[i].after) common.push(pairs[i]);
    var moved = {};
    for (i = 0; i < common.length; i++) {
      for (j = i + 1; j < common.length; j++) {
        var headSign = common[i].beforeOrder < common[j].beforeOrder;
        var candidateSign = common[i].afterOrder < common[j].afterOrder;
        if (headSign !== candidateSign) { moved[i] = true; moved[j] = true; }
      }
    }
    Object.keys(moved).forEach(function (k) {
      reordered++;
      var oldRow = common[k].before;
      var newRow = common[k].after;
      if (oldRow.raw === newRow.raw) return;
      errs.push("row #" + oldRow.id + " moved from HEAD line " + oldRow.line + " to candidate line " + newRow.line + " but its bytes changed (" + differenceSummary(oldRow.raw, newRow.raw) + "). A moved row must be byte-identical; edit it in place in its own commit.");
    });
  });
  return { errors: errs, reordered: reordered, added: added, deleted: deleted };
}

function readGit(spec) {
  return cp.execFileSync("git", ["-C", ROOT, "show", spec], { encoding: "utf8" });
}

function parseArgs(argv) {
  var opts = { gitAware: true, staged: false, file: DEFAULT_FILE, headFile: "" };
  for (var i = 0; i < argv.length; i++) {
    if (argv[i] === "--git-aware") opts.gitAware = true;
    else if (argv[i] === "--shape-only") opts.gitAware = false;
    else if (argv[i] === "--staged") opts.staged = true;
    else if (argv[i] === "--file" && argv[i + 1]) opts.file = path.resolve(argv[++i]);
    else if (argv[i] === "--head-file" && argv[i + 1]) opts.headFile = path.resolve(argv[++i]);
    else throw new Error("unknown or incomplete argument: " + argv[i]);
  }
  if (opts.staged && opts.file !== DEFAULT_FILE) throw new Error("--staged cannot be combined with --file");
  if (opts.headFile && !opts.gitAware) throw new Error("--head-file requires git-aware mode");
  return opts;
}

function main() {
  var opts;
  var candidateText;
  var headText;
  try {
    opts = parseArgs(process.argv.slice(2));
    candidateText = opts.staged ? readGit(":TODO.md") : fs.readFileSync(opts.file, "utf8");
    if (opts.gitAware) headText = opts.headFile ? fs.readFileSync(opts.headFile, "utf8") : readGit("HEAD:TODO.md");
  } catch (e) {
    console.error("TODO.md TABLE INTEGRITY FAILED: could not load verification inputs — " + (e && e.message));
    process.exit(1);
  }

  var lines = candidateText.split("\n");
  var errs = shapeErrors(candidateText);
  if (errs.length) {
    console.error("TODO.md TABLE INTEGRITY FAILED (" + errs.length + " finding" + (errs.length > 1 ? "s" : "") + "):");
    for (var e = 0; e < errs.length; e++) console.error("  ✗ line " + errs[e]);
    console.error("A table cell must not contain raw newlines — use <br>. Rows must be one physical line each.");
    process.exit(1);
  }

  var moves = { errors: [], reordered: 0, added: 0, deleted: 0 };
  if (opts.gitAware) moves = movedRowErrors(headText, candidateText);
  if (moves.errors.length) {
    console.error("TODO.md MOVED-ROW BYTE VERIFICATION FAILED (" + moves.errors.length + " changed moved row" + (moves.errors.length > 1 ? "s" : "") + "):");
    for (var m = 0; m < moves.errors.length; m++) console.error("  ✗ " + moves.errors[m]);
    console.error("This is the 2026-08-14 truncation class: reordering is allowed, but every moved existing row must remain byte-identical to HEAD.");
    process.exit(1);
  }

  var suffix = opts.gitAware ? "; git-aware moved-row verification OK (" + moves.reordered + " reordered row reference" + (moves.reordered === 1 ? "" : "s") + ", " + moves.added + " added, " + moves.deleted + " deleted)" : "";
  console.log("TODO.md tables OK (" + lines.length + " lines)" + suffix);
  process.exit(0);
}

if (require.main === module) main();
module.exports = { shapeErrors: shapeErrors, parseTables: parseTables, movedRowErrors: movedRowErrors, differenceSummary: differenceSummary };
