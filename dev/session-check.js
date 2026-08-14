// session-check.js — #20 warn-only session-start hygiene advisory.
// Reports shared-tree tracker edits, untracked/ignored testRuns artifacts, lane declarations,
// and due entries in the read-only dev/schedule.json registry.
// It is intentionally incapable of blocking: every path exits 0 after reporting what it could see.
var fs = require("fs");
var path = require("path");
var cp = require("child_process");
var hookParity = require("./check-hook-parity.js");

function parseArgs(argv) {
  var out = { root: path.join(__dirname, ".."), laneFiles: [] };
  for (var i = 0; i < argv.length; i++) {
    if (argv[i] === "--root" && argv[i + 1]) out.root = path.resolve(argv[++i]);
    else if (argv[i] === "--lane-file" && argv[i + 1]) out.laneFiles.push(path.resolve(argv[++i]));
    else throw new Error("unknown or incomplete argument: " + argv[i]);
  }
  return out;
}

function git(root, args) {
  var r = cp.spawnSync("git", ["-C", root].concat(args), { encoding: "utf8" });
  if (r.status !== 0) throw new Error("git " + args.join(" ") + " failed: " + String(r.stderr || r.stdout || "").trim());
  return String(r.stdout || "");
}

function slash(root, file) { return path.relative(root, file).replace(/\\/g, "/"); }

function laneCandidates(root, explicit) {
  if (explicit.length) return explicit;
  var dirs = [root, path.join(root, "dev"), path.join(root, ".claude", "hooks")];
  var names = ["lane-declaration.json", "lane-declaration.md", "lane-declaration.txt"];
  var out = [];
  for (var d = 0; d < dirs.length; d++) for (var n = 0; n < names.length; n++) out.push(path.join(dirs[d], names[n]));
  return out;
}

function uniqueLines(texts) {
  var seen = {};
  var out = [];
  texts.join("\n").split(/\r?\n/).forEach(function (line) {
    line = line.trim();
    if (line && !seen[line]) { seen[line] = true; out.push(line); }
  });
  return out.sort();
}

function localDateString(now) {
  function two(n) { return n < 10 ? "0" + n : String(n); }
  return now.getFullYear() + "-" + two(now.getMonth() + 1) + "-" + two(now.getDate());
}

function validDateString(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  var p = value.split("-");
  var d = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2]));
  return d.getUTCFullYear() === +p[0] && d.getUTCMonth() === +p[1] - 1 && d.getUTCDate() === +p[2];
}

function inspectSchedule(root) {
  var file = path.join(root, "dev", "schedule.json");
  var entries;
  try { entries = JSON.parse(fs.readFileSync(file, "utf8")); }
  catch (e) { return { due: [], errors: ["dev/schedule.json is malformed or unreadable: " + e.message] }; }
  if (!(entries instanceof Array)) return { due: [], errors: ["dev/schedule.json is malformed: top level must be an array"] };
  var due = [];
  var errors = [];
  var today = localDateString(new Date());
  for (var i = 0; i < entries.length; i++) {
    var entry = entries[i];
    var label = "dev/schedule.json entry " + i;
    if (!entry || typeof entry !== "object" || entry instanceof Array) { errors.push(label + " is malformed: expected an object"); continue; }
    if (typeof entry.id !== "string" || !entry.id.trim()) { errors.push(label + " is malformed: id must be a non-empty string"); continue; }
    if (typeof entry.due !== "string" || !validDateString(entry.due)) { errors.push(label + " (" + entry.id + ") is malformed: due must be YYYY-MM-DD"); continue; }
    if (typeof entry.every_days !== "number" || entry.every_days <= 0 || entry.every_days % 1 !== 0) { errors.push(label + " (" + entry.id + ") is malformed: every_days must be a positive integer"); continue; }
    if (typeof entry.note !== "string" || !entry.note.trim()) { errors.push(label + " (" + entry.id + ") is malformed: note must be a non-empty string"); continue; }
    // Calendar strings are the contract: no time zone, clock, or time-of-day participates.
    if (entry.due <= today) due.push(entry);
  }
  return { due: due, errors: errors };
}

function main() {
  var opts;
  try { opts = parseArgs(process.argv.slice(2)); }
  catch (e) {
    console.warn("SESSION CHECK ADVISORY — argument error: " + e.message + " (warn-only; exit 0)");
    process.exit(0);
  }

  var trackers = [];
  var artifacts = [];
  var lanes = [];
  var inspectionErrors = [];
  var parity = null;
  var schedule = { due: [], errors: [] };
  try {
    var status = git(opts.root, ["status", "--porcelain=v1", "--untracked-files=all", "--", "TODO.md", "DOC/BUGS.md", "todo_checkWithFable.md"]);
    status.split(/\r?\n/).forEach(function (line) { if (line.trim()) trackers.push(line); });
  } catch (e1) { inspectionErrors.push(e1.message); }
  try {
    artifacts = uniqueLines([
      git(opts.root, ["ls-files", "--others", "--exclude-standard", "--", "testRuns"]),
      git(opts.root, ["ls-files", "--others", "--ignored", "--exclude-standard", "--", "testRuns"])
    ]);
  } catch (e2) { inspectionErrors.push(e2.message); }
  try { parity = hookParity.inspect(opts.root); }
  catch (e3) { inspectionErrors.push("hook parity inspection failed: " + e3.message); }
  schedule = inspectSchedule(opts.root);

  laneCandidates(opts.root, opts.laneFiles).forEach(function (file) {
    if (!fs.existsSync(file) || !fs.statSync(file).isFile()) return;
    var body = fs.readFileSync(file, "utf8").trim().replace(/\s+/g, " ");
    if (body.length > 300) body = body.slice(0, 297) + "...";
    lanes.push({ file: slash(opts.root, file), body: body || "(empty declaration)" });
  });

  var findings = trackers.length + artifacts.length + lanes.length + inspectionErrors.length + schedule.due.length + schedule.errors.length + (parity && !parity.ok ? 1 : 0);
  if (!findings) {
    console.log("SESSION CHECK OK — no tracker edits, no untracked testRuns files, no lane declaration, and no schedule due (advisory; exit 0)");
    process.exit(0);
  }

  console.warn("SESSION CHECK ADVISORY — shared-tree state needs attention (warn-only; exit 0)");
  if (trackers.length) {
    console.warn("  Uncommitted tracker edits:");
    trackers.forEach(function (line) { console.warn("    " + line); });
  }
  if (artifacts.length) {
    console.warn("  Untracked testRuns files (" + artifacts.length + "):");
    var cap = 20;
    artifacts.slice(0, cap).forEach(function (file) { console.warn("    " + file); });
    if (artifacts.length > cap) console.warn("    ... and " + (artifacts.length - cap) + " more");
  }
  if (lanes.length) {
    console.warn("  Lane declaration" + (lanes.length === 1 ? "" : "s") + ":");
    lanes.forEach(function (lane) { console.warn("    " + lane.file + " — " + lane.body); });
  }
  schedule.due.forEach(function (entry) {
    console.warn("  SCHEDULE DUE: " + entry.id + " (due " + entry.due + "; every " + entry.every_days + " days) — " + entry.note);
  });
  if (schedule.errors.length) {
    console.warn("  Schedule registry advisory:");
    schedule.errors.forEach(function (msg) { console.warn("    " + msg); });
  }
  if (parity && !parity.ok) console.warn("  Pre-commit hook parity: " + parity.message);
  if (inspectionErrors.length) {
    console.warn("  Inspection errors (advisory could not verify these surfaces):");
    inspectionErrors.forEach(function (msg) { console.warn("    " + msg); });
  }
  process.exit(0);
}

main();
