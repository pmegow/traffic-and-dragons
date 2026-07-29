// file-forensics.js — dump EVERYTHING observable about a file, in one shot.
//
// WHY THIS EXISTS (2026-07-29): the bible-editor save bug cost ~3 hours because I checked one
// property per iteration. Chrome kept saying "the state had changed since it was read from disk";
// I checked the file's MTIME four separate times across three theories and never once checked its
// SIZE. The file was ZERO BYTES the whole time — the error was literally true and I kept
// reinterpreting it. One command that prints every observable fact at once ends that class of
// spiral, because the anomaly is right there in the output instead of behind the next hypothesis.
//
// Usage:  node dev/file-forensics.js class_bible.js
//         node dev/file-forensics.js path/to/anything.js

var fs = require("fs");
var path = require("path");
var cp = require("child_process");

var target = process.argv[2];
if (!target) { console.error("usage: node dev/file-forensics.js <file>"); process.exit(1); }

var ROOT = path.join(__dirname, "..");
var abs = path.resolve(target);
var rel = path.relative(ROOT, abs).replace(/\\/g, "/");
var flags = [];   // anything that looks wrong, collected and shouted at the end

function line(k, v) { console.log("  " + String(k).padEnd(22) + v); }
function head(t) { console.log("\n── " + t + " " + "─".repeat(Math.max(0, 56 - t.length))); }

console.log("\nFORENSICS: " + abs);

// ── existence & size ────────────────────────────────────────────────────────
head("existence & size");
if (!fs.existsSync(abs)) {
  line("exists", "NO — the file is not there at all");
  flags.push("the file does not exist");
  console.log("\n⚠  " + flags.join("\n⚠  ") + "\n");
  process.exit(1);
}
var st = fs.statSync(abs);
line("exists", "yes");
line("size", st.size + " bytes" + (st.size === 0 ? "   ← EMPTY" : ""));
if (st.size === 0) flags.push("THE FILE IS ZERO BYTES — this is the failure that cost 3 hours on 2026-07-29");
line("mode", "0" + (st.mode & 0o777).toString(8) + (st.mode & 0o200 ? "" : "   ← not writable by owner"));
if (!(st.mode & 0o200)) flags.push("the file is not writable by its owner");
line("modified", st.mtime.toISOString());
line("changed", st.ctime.toISOString());
line("created", st.birthtime.toISOString());
var ageS = Math.round((Date.now() - st.mtimeMs) / 1000);
line("last write", ageS < 90 ? ageS + "s ago   ← something touched it JUST NOW" : Math.round(ageS / 60) + " min ago");
if (ageS < 90) flags.push("the file was written less than 90s ago — check whether something else is editing it");

// ── content shape ───────────────────────────────────────────────────────────
head("content shape");
var buf = fs.readFileSync(abs);
var bom = buf.length >= 3 && buf[0] === 0xEF && buf[1] === 0xBB && buf[2] === 0xBF;
line("BOM", bom ? "YES (UTF-8 BOM)   ← can break naive parsers" : "none");
if (bom) flags.push("the file carries a UTF-8 BOM");
var txt = buf.toString("utf8");
var crlf = (txt.match(/\r\n/g) || []).length, lf = (txt.match(/(^|[^\r])\n/g) || []).length;
line("line endings", "CRLF " + crlf + " · bare LF " + lf + (crlf && lf ? "   ← MIXED" : ""));
if (crlf && lf) flags.push("mixed line endings");
line("first 60 chars", JSON.stringify(txt.slice(0, 60)));
line("last 60 chars", JSON.stringify(txt.slice(-60)));
if (txt.length && !txt.trim().length) flags.push("the file is whitespace only");

// ── parses? ─────────────────────────────────────────────────────────────────
if (/\.js$/i.test(abs)) {
  head("javascript");
  try {
    var vm = require("vm");
    var ctx = {}; vm.createContext(ctx); vm.runInContext(txt, ctx);
    var globals = Object.keys(ctx);
    line("parses", "yes");
    line("defines", globals.length ? globals.slice(0, 8).join(", ") + (globals.length > 8 ? " …" : "") : "NOTHING   ← empty or wrapped");
    if (!globals.length) flags.push("the file parses but defines no globals — likely empty or truncated");
  } catch (e) {
    line("parses", "NO — " + e.message.split("\n")[0]);
    flags.push("the file is not valid JavaScript");
  }
}

// ── git ─────────────────────────────────────────────────────────────────────
head("git");
function git(args) {
  var r = cp.spawnSync("git", args, { cwd: ROOT, encoding: "utf8" });
  return r.status === 0 ? r.stdout : null;
}
var tracked = git(["ls-files", "--error-unmatch", rel]) !== null;
line("tracked", tracked ? "yes" : "NO — there is no undo for this file");
if (!tracked) flags.push("the file is NOT tracked by git — no recovery if it is destroyed");
if (tracked) {
  var headBlob = cp.spawnSync("git", ["show", "HEAD:" + rel], { cwd: ROOT, encoding: "buffer" });
  if (headBlob.status === 0) {
    var hs = headBlob.stdout.length;
    line("size at HEAD", hs + " bytes");
    var delta = st.size - hs;
    line("vs working tree", delta === 0 ? "identical size" : (delta > 0 ? "+" : "") + delta + " bytes");
    if (st.size === 0 && hs > 0) flags.push("the working file is EMPTY but HEAD has " + hs + " bytes — recover with: git checkout -- " + rel);
  }
  var status = git(["status", "--short", "--", rel]);
  line("status", status && status.trim() ? status.trim() : "clean");
  var last = git(["log", "-1", "--format=%h %ad %s", "--date=short", "--", rel]);
  if (last) line("last commit", last.trim().slice(0, 72));
}

// ── siblings that hint at an interrupted write ──────────────────────────────
head("sibling temp files");
var dir = path.dirname(abs), base = path.basename(abs);
var temps = fs.readdirSync(dir).filter(function (f) {
  return f !== base && (f.indexOf(base) === 0 || /\.(crswap|swp|tmp|bak|part)$/i.test(f) || /~$/.test(f));
});
if (!temps.length) line("none found", "(clean)");
temps.forEach(function (f) {
  var ts = fs.statSync(path.join(dir, f));
  line(f, ts.size + " bytes · " + ts.mtime.toISOString());
  if (/\.crswap$/i.test(f)) flags.push(f + " is a Chrome File System Access swap file — an in-place write was interrupted");
});

// ── write lock ──────────────────────────────────────────────────────────────
head("writability right now");
try {
  var fd = fs.openSync(abs, "r+");
  fs.closeSync(fd);
  line("open r+", "OK — nothing is holding a lock");
} catch (e) {
  line("open r+", "FAILED — " + e.code + " (something has it locked)");
  flags.push("the file cannot be opened for writing right now: " + e.code);
}

// ── verdict ─────────────────────────────────────────────────────────────────
console.log("");
if (flags.length) {
  console.log("⚠  " + flags.length + " ANOMALY(IES):");
  flags.forEach(function (f) { console.log("   • " + f); });
  console.log("");
  process.exit(1);
}
console.log("✓  nothing anomalous — size, encoding, git state, siblings and write access all look normal.\n");
