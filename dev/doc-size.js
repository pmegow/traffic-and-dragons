// doc-size.js — #16④: CLAUDE.md size tracked per release, the way cache health is tracked.
// The 2026-08-14 performance review (P1) found accumulated doc mass raises cognitive load;
// the same-day editorial pass cut CLAUDE.md 137KB → 121KB → 112KB. This tool makes
// re-accumulation visible BEFORE it needs another heroic pass:
//   node dev/doc-size.js          — current size + per-release history for each watched doc
//   require(...).inspect(root)    — cheap threshold check consumed by session-check.js
// Observation-only by construction: nothing here blocks a commit. The CLI exits 1 only when
// a watched doc cannot be measured at all (a readout that cannot read is a real failure).
var fs = require("fs");
var path = require("path");
var cp = require("child_process");

// The watch registry — adding a doc is one entry. baselineBytes is a RATIFIED floor, not a
// running measurement: raising it is a deliberate re-ratchet recorded in the TODO/tracker
// (same discipline as a frozen hash), never a drive-by edit to quiet a warning.
var DOCS = [
  {
    file: "CLAUDE.md",
    baselineBytes: 112346,  // the 2026-08-14 editorial floor (commit d98ca4a, v1.619)
    watchBytes: 120210,     // baseline +7% ≈ the 121KB mass the same-day pass was still cutting
    problemBytes: 134815,   // baseline +20% ≈ the 137KB mass that drew the review's P1 finding
    hint: "run an editorial pass (contracts stay, narrative compresses) or deliberately re-ratchet the baseline in dev/doc-size.js"
  }
];

// Fixture-lesson insurance (the 2026-08-14 GIT_DIR incident): every git spawned here resolves
// its repo from -C alone, never from caller-exported repo-location env.
function gitEnv() {
  var env = Object.assign({}, process.env);
  ["GIT_DIR", "GIT_WORK_TREE", "GIT_INDEX_FILE", "GIT_COMMON_DIR", "GIT_OBJECT_DIRECTORY",
   "GIT_ALTERNATE_OBJECT_DIRECTORIES", "GIT_PREFIX"].forEach(function (k) { delete env[k]; });
  return env;
}

function git(root, args) {
  return cp.spawnSync("git", ["-C", root].concat(args), { encoding: "utf8", env: gitEnv() });
}

// The cheap check session-check.js consults every session start. Returns
// { warnings: [line, ...], errors: [line, ...] } — silent (empty) while every doc is under
// its watch threshold; a doc that cannot be measured is a loud error, never a silent skip.
function inspect(root) {
  var warnings = [];
  var errors = [];
  DOCS.forEach(function (doc) {
    var size;
    try { size = fs.statSync(path.join(root, doc.file)).size; }
    catch (e) { errors.push(doc.file + " could not be measured: " + e.message); return; }
    if (size >= doc.problemBytes)
      warnings.push("DOC SIZE PROBLEM: " + doc.file + " is " + size + " bytes (baseline " + doc.baselineBytes + ", problem at " + doc.problemBytes + ") — " + doc.hint);
    else if (size >= doc.watchBytes)
      warnings.push("DOC SIZE WATCH: " + doc.file + " is " + size + " bytes (baseline " + doc.baselineBytes + ", watch at " + doc.watchBytes + ") — " + doc.hint);
  });
  return { warnings: warnings, errors: errors };
}

// Per-release history for one doc: every commit that changed it (newest first, capped),
// with the blob size and the APP_VERSION that commit shipped. Sizes come from git blobs,
// so the trend is exact regardless of what the working tree currently holds.
function history(root, file, cap) {
  var log = git(root, ["log", "--format=%h%x09%ad", "--date=short", "-" + cap, "--", file]);
  if (log.status !== 0) throw new Error("git log failed for " + file + ": " + String(log.stderr || "").trim());
  var rows = [];
  String(log.stdout || "").trim().split(/\r?\n/).forEach(function (line) {
    if (!line.trim()) return;
    var parts = line.split("\t");
    var sha = parts[0], date = parts[1] || "";
    var sz = git(root, ["cat-file", "-s", sha + ":" + file]);
    if (sz.status !== 0) return; // the commit removed the file — nothing to measure there
    var version = "";
    var globals = git(root, ["show", sha + ":globals.js"]);
    if (globals.status === 0) {
      var m = /APP_VERSION\s*=\s*"([^"]+)"/.exec(String(globals.stdout || ""));
      if (m) version = m[1];
    }
    rows.push({ sha: sha, date: date, bytes: parseInt(String(sz.stdout).trim(), 10), version: version });
  });
  return rows;
}

function statusLabel(doc, size) {
  if (size >= doc.problemBytes) return "PROBLEM";
  if (size >= doc.watchBytes) return "WATCH";
  return "OK";
}

function main() {
  var root = path.join(__dirname, "..");
  var hadErrors = false;
  DOCS.forEach(function (doc) {
    var size;
    try { size = fs.statSync(path.join(root, doc.file)).size; }
    catch (e) {
      hadErrors = true;
      console.error(doc.file + " could not be measured: " + e.message);
      return;
    }
    var label = statusLabel(doc, size);
    console.log(doc.file + " — " + size + " bytes — " + label +
      " (baseline " + doc.baselineBytes + " · watch " + doc.watchBytes + " · problem " + doc.problemBytes + ")");
    if (label !== "OK") console.log("  → " + doc.hint);
    var rows;
    try { rows = history(root, doc.file, 15); }
    catch (e2) {
      console.error("  history unavailable: " + e2.message);
      return; // the current-size readout above already did the load-bearing half
    }
    console.log("  Per-release history (last " + rows.length + " changes, newest first):");
    rows.forEach(function (row, i) {
      var older = rows[i + 1];
      var delta = older ? row.bytes - older.bytes : null;
      console.log("    " + (row.version || "(no version)") + "  " + row.date + "  " + row.bytes +
        (delta === null ? "" : "  " + (delta >= 0 ? "+" : "") + delta));
    });
  });
  process.exit(hadErrors ? 1 : 0);
}

module.exports = { inspect: inspect, DOCS: DOCS };
if (require.main === module) main();
