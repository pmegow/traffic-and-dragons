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

// #310: a TODO row is a pointer, not a record — over TODO_ROW_MAX bytes the record belongs in
// DOC/todos_completed (or audits/) and the row keeps title + TLDR + verdict + link (the #22/#41 precedent).
var TODO_ROW_MAX = 6144;
var ROW_ID_RE = /^\|\s*([A-Za-z]*\d+)\s*\|/;   /* #481 G7: numeric ids and letter-prefixed ones (L7) */
// #481 G7 (audit 2026-09-29): a row that LEAVES TODO.md while its id ENTERS the archive in the same change must arrive
// byte-identical — "byte-identical move" was written in every archive commit and never checked (5 of 486 moves changed on the
// way; #44 grew 5,965 → 6,182 bytes and kept an unbalanced **). A row written straight into the archive is not a move. Per
// Fable, archive entries carry no size cap. Duplicate legacy ids: the entering copy must equal one of the leaving copies.
function archiveMoveErrors(headTodo, candTodo, headArch, candArch) {
  function rows(text) { var out = []; String(text || "").split(/\r?\n/).forEach(function (l) { var m = ROW_ID_RE.exec(l); if (m) out.push({ id: m[1], raw: l }); }); return out; }
  function counts(list) { var c = {}; list.forEach(function (r) { c[r.raw] = (c[r.raw] || 0) + 1; }); return c; }
  var ht = rows(headTodo), ct = counts(rows(candTodo)), ha = counts(rows(headArch)), errs = [], left = {}, seen = {};
  ht.forEach(function (r) { if (ct[r.raw]) { ct[r.raw]--; return; } (left[r.id] = left[r.id] || []).push(r.raw); });   /* rows gone from TODO.md */
  rows(candArch).forEach(function (r) {
    if (ha[r.raw]) { ha[r.raw]--; return; }                                        /* already in the archive at HEAD */
    if (!left[r.id]) return;                                                        /* entered with no TODO origin: not a move */
    if (left[r.id].indexOf(r.raw) >= 0 || seen[r.id]) return;
    seen[r.id] = true;
    errs.push("row #" + r.id + " changed on its way to the archive — " + differenceSummary(left[r.id][0], r.raw) + ". Move the row unchanged in its own commit; edit it before or after.");
  });
  return errs;
}
function rowSizeErrors(text, max, unchangedAgainst) {
  var lim = max || TODO_ROW_MAX, errs = [], lines = text.split("\n"), i, before = {};
  /* #481 G7: with a HEAD text (--cap-changed, CI per commit) a row that is byte-identical there is not this change's doing */
  if (typeof unchangedAgainst === "string") unchangedAgainst.split(/\r?\n/).forEach(function (l) { before[l.replace(/\r$/, "")] = true; });
  for (i = 0; i < lines.length; i++) {
    var m = ROW_ID_RE.exec(lines[i]);   /* #481 G7: a letter-prefixed id (L7) is a row id too — L7 escaped the cap at 7,201 bytes */
    if (!m) continue;
    if (before[lines[i].replace(/\r$/, "")]) continue;
    var bytes = Buffer.byteLength(lines[i], "utf8");
    if (bytes > lim) errs.push("row #" + m[1] + " (line " + (i + 1) + ") is " + bytes + " bytes — over the " + lim + "-byte cap; move the record to DOC/todos_completed and keep title + TLDR + verdict + link");
  }
  return errs;
}
// #481 G4 (audit 2026-09-29): a row id is used ONCE across TODO.md and DOC/TODO_ARCHIVE.md — the numbers are global across both
// files (the 2026-09-01 archive rule). The grandfather list is EXPLICIT and pinned at today's counts, so a new copy of any of
// these ids still fails: the legacy #1–#30 numbering predates the global rule, and #264 is two archived rows.
var LEGACY_ID = "legacy numbering, before the global row-number rule";
var ROW_ID_GRANDFATHER = {
  1: { count: 2, why: LEGACY_ID }, 2: { count: 2, why: LEGACY_ID }, 3: { count: 3, why: LEGACY_ID }, 4: { count: 2, why: LEGACY_ID },
  5: { count: 2, why: LEGACY_ID }, 6: { count: 3, why: LEGACY_ID }, 7: { count: 4, why: LEGACY_ID }, 8: { count: 2, why: LEGACY_ID },
  9: { count: 2, why: LEGACY_ID }, 10: { count: 2, why: LEGACY_ID }, 11: { count: 2, why: LEGACY_ID }, 12: { count: 3, why: LEGACY_ID },
  14: { count: 3, why: LEGACY_ID }, 15: { count: 2, why: LEGACY_ID }, 16: { count: 3, why: LEGACY_ID }, 17: { count: 3, why: LEGACY_ID },
  18: { count: 2, why: LEGACY_ID }, 19: { count: 4, why: LEGACY_ID }, 20: { count: 4, why: LEGACY_ID }, 21: { count: 4, why: LEGACY_ID },
  22: { count: 3, why: LEGACY_ID }, 23: { count: 5, why: LEGACY_ID }, 24: { count: 3, why: LEGACY_ID }, 25: { count: 6, why: LEGACY_ID },
  26: { count: 4, why: LEGACY_ID }, 27: { count: 5, why: LEGACY_ID }, 28: { count: 4, why: LEGACY_ID }, 29: { count: 2, why: LEGACY_ID },
  30: { count: 2, why: LEGACY_ID },
  264: { count: 2, why: "two archived rows (quest-journal actions; the review-call tag whitelist, which api.js and engine-tests.js cite) — the owner's renumber ruling is pending: renumber the quest-journal one (the b4d034d way) and drop this entry" }
};
function rowIdErrors(todoText, archiveText) {
  var n = {}, where = {}, max = 0, errs = [];
  [["TODO.md", todoText || ""], ["DOC/TODO_ARCHIVE.md", archiveText || ""]].forEach(function (f) {
    f[1].split("\n").forEach(function (l, i) {
      var m = /^\|\s*(\d+)\s*\|/.exec(l); if (!m) return;
      var id = Number(m[1]); n[id] = (n[id] || 0) + 1; (where[id] = where[id] || []).push(f[0] + ":" + (i + 1)); if (id > max) max = id;
    });
  });
  Object.keys(n).forEach(function (k) {
    var g = ROW_ID_GRANDFATHER[k], allowed = g ? g.count : 1;
    if (n[k] > allowed) errs.push("row #" + k + " is used " + n[k] + " times" + (g ? " (grandfathered at " + allowed + ": " + g.why + ")" : "") + " — " + where[k].join(", ") + "; claim the next free number instead (#" + (max + 1) + ")");
  });
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
  var opts = { gitAware: true, staged: false, file: DEFAULT_FILE, headFile: "", archiveFile: "", cap: false };
  for (var i = 0; i < argv.length; i++) {
    if (argv[i] === "--git-aware") opts.gitAware = true;
    else if (argv[i] === "--shape-only") opts.gitAware = false;
    else if (argv[i] === "--staged") opts.staged = true;
    else if (argv[i] === "--cap") opts.cap = true; /* #310: enforce TODO_ROW_MAX (the hook passes it; fixture-driven suites do not) */
    else if (argv[i] === "--cap-changed") { opts.cap = true; opts.capChanged = true; } /* #481 G7: CI per commit — only the rows this change adds or edits (an old branch's untouched rows are not its commit's doing) */
    else if (argv[i] === "--file" && argv[i + 1]) opts.file = path.resolve(argv[++i]);
    else if (argv[i] === "--head-file" && argv[i + 1]) opts.headFile = path.resolve(argv[++i]);
    else if (argv[i] === "--archive-file" && argv[i + 1]) opts.archiveFile = path.resolve(argv[++i]); /* #481 G4: the archive the id pass reads */
    else if (argv[i] === "--head-archive" && argv[i + 1]) opts.headArchive = path.resolve(argv[++i]); /* #481 G7: the archive before this change (CI: the parent's) */
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
  var archiveText = "";
  var headArchiveText = null;
  try {
    opts = parseArgs(process.argv.slice(2));
    candidateText = opts.staged ? readGit(":TODO.md") : fs.readFileSync(opts.file, "utf8");
    if (opts.gitAware) headText = opts.headFile ? fs.readFileSync(opts.headFile, "utf8") : readGit("HEAD:TODO.md");
    /* #481 G4: the archive for the id pass — the index's in the hook, the given file in CI / fixtures, the working copy by
       default; a bare --file fixture (no --archive-file) has no id pass */
    var ARCHIVE = path.join(ROOT, "DOC", "TODO_ARCHIVE.md");
    if (opts.archiveFile) archiveText = fs.readFileSync(opts.archiveFile, "utf8");
    else if (opts.staged) { try { archiveText = readGit(":DOC/TODO_ARCHIVE.md"); } catch (e2) { archiveText = ""; } }
    else if (opts.file === DEFAULT_FILE && fs.existsSync(ARCHIVE)) archiveText = fs.readFileSync(ARCHIVE, "utf8");
    else archiveText = "";
    /* #481 G7: the archive BEFORE this change, for the move check — the given file (CI), else HEAD's in the hook and the working
       tree; a bare --file fixture without --head-archive has no move check */
    if (opts.headArchive) headArchiveText = fs.readFileSync(opts.headArchive, "utf8");
    else if (opts.staged || opts.file === DEFAULT_FILE) { try { headArchiveText = readGit("HEAD:DOC/TODO_ARCHIVE.md"); } catch (e3) { headArchiveText = null; } }
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

  var sizeErrs = opts.cap ? rowSizeErrors(candidateText, 0, opts.capChanged ? headText : null) : [];
  if (sizeErrs.length) {
    console.error("TODO.md ROW SIZE CAP FAILED (" + sizeErrs.length + " row" + (sizeErrs.length > 1 ? "s" : "") + "):");
    for (var r = 0; r < sizeErrs.length; r++) console.error("  ✗ " + sizeErrs[r]);
    process.exit(1);
  }

  /* #481 G4: the id pass runs where the archive is part of the input — the hook (the index), CI (--archive-file per commit), the
     working tree — never on a bare --file fixture (the moved-row fixtures are historical TODO.md files with pre-archive twins) */
  var idPass = opts.gitAware && (!!opts.archiveFile || opts.staged || opts.file === DEFAULT_FILE);
  var idErrs = idPass ? rowIdErrors(candidateText, archiveText) : [];
  if (idErrs.length) {
    console.error("TODO.md ROW ID CHECK FAILED (" + idErrs.length + " id" + (idErrs.length > 1 ? "s" : "") + " used more than once):");
    for (var d = 0; d < idErrs.length; d++) console.error("  ✗ " + idErrs[d]);
    console.error("Row numbers are global across TODO.md and DOC/TODO_ARCHIVE.md — fetch origin before claiming one (a parallel session may hold it).");
    process.exit(1);
  }

  var archErrs = (opts.gitAware && headArchiveText !== null && headText !== undefined) ? archiveMoveErrors(headText, candidateText, headArchiveText, archiveText) : [];   /* #481 G7 */
  if (archErrs.length) {
    console.error("TODO.md → ARCHIVE MOVE CHECK FAILED (" + archErrs.length + " row" + (archErrs.length > 1 ? "s" : "") + " changed on the way):");
    for (var am = 0; am < archErrs.length; am++) console.error("  ✗ " + archErrs[am]);
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
module.exports = { archiveMoveErrors: archiveMoveErrors, rowIdErrors: rowIdErrors, ROW_ID_GRANDFATHER: ROW_ID_GRANDFATHER, rowSizeErrors: rowSizeErrors, TODO_ROW_MAX: TODO_ROW_MAX, shapeErrors: shapeErrors, parseTables: parseTables, movedRowErrors: movedRowErrors, differenceSummary: differenceSummary };
