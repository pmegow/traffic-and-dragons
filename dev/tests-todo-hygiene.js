// tests-todo-hygiene.js — #20 failing-first acceptance fixtures for tracker hygiene.
// Uses the pre-move TODO.md blob from 93c182f^ (809c9fa) and a synthetic git repo only.
var fs = require("fs");
var os = require("os");
var path = require("path");
var cp = require("child_process");

var ROOT = path.join(__dirname, "..");
var LINT = path.join(__dirname, "lint-todo.js");
var SESSION = path.join(__dirname, "session-check.js");
var pass = 0;
var fail = 0;

function run(cmd, args, opts) {
  return cp.spawnSync(cmd, args, Object.assign({ encoding: "utf8" }, opts || {}));
}
function resultText(r) { return String(r.stdout || "") + String(r.stderr || ""); }
function test(name, fn) {
  try {
    var why = fn();
    if (why) { fail++; console.error("FAIL " + name + " — " + why); }
    else { pass++; console.log("PASS " + name); }
  } catch (e) {
    fail++;
    console.error("FAIL " + name + " — " + (e && e.stack || e));
  }
}
function rowLine(text, id) {
  var re = new RegExp("^\\|\\s*" + id + "\\s*\\|", "m");
  var lines = text.split(/\r?\n/);
  for (var i = 0; i < lines.length; i++) if (re.test(lines[i])) return lines[i];
  throw new Error("fixture row #" + id + " not found");
}
function reorderBlock(text, ids, beforeId) {
  var lines = text.split(/\r?\n/);
  var block = [];
  for (var n = 0; n < ids.length; n++) {
    var re = new RegExp("^\\|\\s*" + ids[n] + "\\s*\\|");
    var at = -1;
    for (var i = 0; i < lines.length; i++) if (re.test(lines[i])) { at = i; break; }
    if (at < 0) throw new Error("fixture row #" + ids[n] + " not found for reorder");
    block.push(lines.splice(at, 1)[0]);
  }
  var beforeRe = new RegExp("^\\|\\s*" + beforeId + "\\s*\\|");
  var before = -1;
  for (var j = 0; j < lines.length; j++) if (beforeRe.test(lines[j])) { before = j; break; }
  if (before < 0) throw new Error("fixture insertion row #" + beforeId + " not found");
  lines.splice.apply(lines, [before, 0].concat(block));
  return lines.join("\n");
}
function replaceRow(text, id, replacement) {
  var original = rowLine(text, id);
  if (text.indexOf(original) < 0) throw new Error("fixture replacement target missing");
  return text.replace(original, replacement);
}
function lintFixture(dir, name, headText, currentText) {
  var headFile = path.join(dir, name + "-head.md");
  var currentFile = path.join(dir, name + "-current.md");
  fs.writeFileSync(headFile, headText, "utf8");
  fs.writeFileSync(currentFile, currentText, "utf8");
  return run(process.execPath, [LINT, "--git-aware", "--file", currentFile, "--head-file", headFile], { cwd: ROOT });
}
function git(dir, args) {
  var env = Object.assign({}, process.env, { GIT_CONFIG_NOSYSTEM: "1", GIT_CONFIG_GLOBAL: "NUL" });
  // Repo-location vars inherited from a caller (git exports them into hook environments)
  // must never reach a fixture git call: on 2026-08-14 an inherited GIT_DIR+GIT_WORK_TREE
  // made `git -C <fixture> init` re-initialize the MAIN repo — core.worktree ended up
  // pointing at a deleted temp dir and fixture stubs were staged over the real trackers.
  ["GIT_DIR", "GIT_WORK_TREE", "GIT_INDEX_FILE", "GIT_COMMON_DIR", "GIT_OBJECT_DIRECTORY",
   "GIT_ALTERNATE_OBJECT_DIRECTORIES", "GIT_PREFIX"].forEach(function (k) { delete env[k]; });
  var r = run("git", ["-C", dir].concat(args), { env: env });
  if (r.status !== 0) throw new Error("git " + args.join(" ") + " failed: " + resultText(r));
  return r;
}
function scheduleRepo(parent, name, scheduleText, claudeMdBytes) {
  var repo = path.join(parent, name);
  fs.mkdirSync(repo);
  fs.mkdirSync(path.join(repo, "DOC"));
  fs.mkdirSync(path.join(repo, "dev"));
  fs.writeFileSync(path.join(repo, "TODO.md"), "baseline\n", "utf8");
  fs.writeFileSync(path.join(repo, "DOC", "BUGS.md"), "bugs\n", "utf8");
  fs.writeFileSync(path.join(repo, "todo_checkWithFable.md"), "reviews\n", "utf8");
  fs.writeFileSync(path.join(repo, "dev", "schedule.json"), scheduleText, "utf8");
  // A synthetic CLAUDE.md sized on demand — the doc-size advisory (#16④) measures the real
  // registry thresholds against it. Default is tiny, i.e. comfortably under every threshold.
  fs.writeFileSync(path.join(repo, "CLAUDE.md"), new Array((claudeMdBytes || 20) + 1).join("x"), "utf8");
  git(repo, ["init", "-q"]);
  git(repo, ["add", "TODO.md", "DOC/BUGS.md", "todo_checkWithFable.md", "dev/schedule.json", "CLAUDE.md"]);
  git(repo, ["-c", "user.name=Schedule Fixture", "-c", "user.email=fixture@example.invalid", "commit", "-qm", "fixture baseline"]);
  return repo;
}

var fixture = run("git", ["show", "93c182f^:TODO.md"], { cwd: ROOT });
if (fixture.status !== 0) {
  console.error("FAIL fixture setup — cannot read 93c182f^:TODO.md: " + resultText(fixture));
  process.exit(1);
}
var head = fixture.stdout;
var blob = run("git", ["rev-parse", "93c182f^:TODO.md"], { cwd: ROOT });
if (blob.status !== 0 || String(blob.stdout).trim().indexOf("809c9fa") !== 0) {
  console.error("FAIL fixture setup — expected pre-move TODO blob 809c9fa, got " + String(blob.stdout || "").trim());
  process.exit(1);
}

var tmp = fs.mkdtempSync(path.join(os.tmpdir(), "tnd-todo-hygiene-"));
try {
  var original175 = rowLine(head, "175");
  var statusStart = original175.indexOf(" | ", original175.indexOf(" | ", original175.indexOf(" | ", original175.indexOf(" | ") + 3) + 3) + 3) + 3;
  var rawPipe = original175.indexOf("|", statusStart);
  if (statusStart < 3 || rawPipe < 0 || original175.slice(rawPipe - 12, rawPipe) !== "[QUEST:title") {
    throw new Error("#175 fixture no longer reaches the incident pipe: " + original175.slice(rawPipe - 30, rawPipe + 20));
  }
  var truncated175 = original175.slice(0, rawPipe + 1);
  var reordered = reorderBlock(head, ["176", "175"], "177");
  var corrupted = replaceRow(reordered, "175", truncated175);

  test("moved #175 truncation is blocked and names the row", function () {
    var r = lintFixture(tmp, "corrupt-move", head, corrupted);
    var out = resultText(r);
    if (r.status === 0) return "corrupted moved row passed";
    if (!/row #175/i.test(out)) return "failure did not name row #175: " + out;
    if (!/missing|truncat|bytes? shorter/i.test(out)) return "failure did not summarize the missing bytes: " + out;
    return "";
  });

  test("byte-identical row reorder passes", function () {
    var r = lintFixture(tmp, "pure-reorder", head, reordered);
    return r.status === 0 ? "" : resultText(r);
  });

  test("in-place status edit passes", function () {
    var edited = replaceRow(head, "175", original175.replace("Filed 2026-08-12 analysis-first", "Filed 2026-08-12 analysis-first (fixture edit)"));
    var r = lintFixture(tmp, "in-place-edit", head, edited);
    return r.status === 0 ? "" : resultText(r);
  });

  test("new row passes", function () {
    var marker = rowLine(head, "174");
    var added = head.replace(marker, "| 999 | Synthetic new row | S | Any | Open |\n" + marker);
    var r = lintFixture(tmp, "new-row", head, added);
    if (r.status !== 0) return resultText(r);
    return /1 added/.test(resultText(r)) ? "" : "new row was not classified as added: " + resultText(r);
  });

  test("deleted row passes", function () {
    var deleted = head.replace(original175 + "\n", "");
    var r = lintFixture(tmp, "delete-row", head, deleted);
    if (r.status !== 0) return resultText(r);
    return /1 deleted/.test(resultText(r)) ? "" : "old row was not classified as deleted: " + resultText(r);
  });

  test("dirty-tree session advisory is loud and exits zero", function () {
    var repo = path.join(tmp, "dirty-repo");
    fs.mkdirSync(repo);
    fs.mkdirSync(path.join(repo, "DOC"));
    fs.mkdirSync(path.join(repo, "dev"));
    fs.mkdirSync(path.join(repo, "testRuns"));
    fs.writeFileSync(path.join(repo, "TODO.md"), "baseline\n", "utf8");
    fs.writeFileSync(path.join(repo, "DOC", "BUGS.md"), "bugs\n", "utf8");
    fs.writeFileSync(path.join(repo, "todo_checkWithFable.md"), "reviews\n", "utf8");
    fs.writeFileSync(path.join(repo, ".gitignore"), "testRuns/\n", "utf8");
    fs.writeFileSync(path.join(repo, "CLAUDE.md"), "tiny fixture doc\n", "utf8");
    fs.writeFileSync(path.join(repo, "dev", "schedule.json"), JSON.stringify([{ id: "future", due: "2999-12-31", every_days: 14, note: "Synthetic future schedule" }]), "utf8");
    git(repo, ["init", "-q"]);
    git(repo, ["add", "TODO.md", "DOC/BUGS.md", "todo_checkWithFable.md", ".gitignore", "CLAUDE.md", "dev/schedule.json"]);
    git(repo, ["-c", "user.name=Hygiene Fixture", "-c", "user.email=fixture@example.invalid", "commit", "-qm", "fixture baseline"]);
    fs.appendFileSync(path.join(repo, "TODO.md"), "dirty\n", "utf8");
    fs.writeFileSync(path.join(repo, "testRuns", "unregistered.tnd"), "synthetic\n", "utf8");
    fs.writeFileSync(path.join(repo, "dev", "lane-declaration.json"), JSON.stringify({ lane: "fixture", owns: ["dev/"] }), "utf8");
    var r = run(process.execPath, [SESSION, "--root", repo], { cwd: ROOT });
    var out = resultText(r);
    if (r.status !== 0) return "advisory blocked with exit " + r.status + ": " + out;
    if (out.indexOf("TODO.md") < 0) return "tracker edit not reported: " + out;
    if (out.indexOf("testRuns/unregistered.tnd") < 0) return "untracked testRuns file not reported: " + out;
    if (out.indexOf("dev/lane-declaration.json") < 0 || out.indexOf("fixture") < 0) return "lane declaration not reported: " + out;
    if (!/WARN|ADVIS/i.test(out)) return "output was not visibly advisory: " + out;
    return "";
  });

  test("overdue schedule entry surfaces loudly and exits zero", function () {
    var repo = scheduleRepo(tmp, "schedule-overdue", JSON.stringify([{ id: "playtest-overdue", due: "2000-01-01", every_days: 14, note: "Synthetic overdue playtest" }]));
    var r = run(process.execPath, [SESSION, "--root", repo], { cwd: ROOT });
    var out = resultText(r);
    if (r.status !== 0) return "schedule advisory blocked with exit " + r.status + ": " + out;
    if (out.indexOf("playtest-overdue") < 0 || out.indexOf("2000-01-01") < 0 || out.indexOf("Synthetic overdue playtest") < 0)
      return "overdue schedule entry was not reported completely: " + out;
    return /SCHEDULE.*DUE|DUE.*SCHEDULE/i.test(out) ? "" : "overdue line was not loud/attributable: " + out;
  });

  test("future schedule entry stays silent", function () {
    var repo = scheduleRepo(tmp, "schedule-future", JSON.stringify([{ id: "playtest-future", due: "2999-12-31", every_days: 14, note: "Synthetic future playtest" }]));
    var r = run(process.execPath, [SESSION, "--root", repo], { cwd: ROOT });
    var out = resultText(r);
    if (r.status !== 0) return "future schedule blocked with exit " + r.status + ": " + out;
    return out.indexOf("playtest-future") < 0 && out.indexOf("Synthetic future playtest") < 0 ? "" : "future schedule surfaced early: " + out;
  });

  test("corrupt schedule warns loudly and exits zero", function () {
    var repo = scheduleRepo(tmp, "schedule-corrupt", "{ definitely not json");
    var r = run(process.execPath, [SESSION, "--root", repo], { cwd: ROOT });
    var out = resultText(r);
    if (r.status !== 0) return "corrupt-schedule advisory blocked with exit " + r.status + ": " + out;
    if (out.indexOf("schedule.json") < 0 || !/malformed|parse|invalid|unreadable/i.test(out))
      return "corrupt schedule was not loudly attributable: " + out;
    return /WARN|ADVIS/i.test(out) ? "" : "corrupt schedule output was not advisory: " + out;
  });

  test("fixture git calls ignore inherited repo-location env (GIT_DIR/GIT_WORK_TREE)", function () {
    // 2026-08-14 incident: a caller-exported GIT_DIR + GIT_WORK_TREE reached the fixture
    // git() calls, so `git -C <tmp fixture> init` re-initialized the MAIN repo instead —
    // core.worktree was pointed at the temp fixture (deleted minutes later, bricking every
    // worktree-needing git command) and fixture stub files were staged over the real trackers.
    var decoy = path.join(tmp, "env-decoy");
    var fixture = path.join(tmp, "env-fixture");
    fs.mkdirSync(decoy);
    fs.mkdirSync(fixture);
    git(decoy, ["init", "-q"]);
    fs.writeFileSync(path.join(decoy, "real.txt"), "decoy repo\n", "utf8");
    git(decoy, ["add", "real.txt"]);
    git(decoy, ["-c", "user.name=Env Fixture", "-c", "user.email=fixture@example.invalid", "commit", "-qm", "decoy baseline"]);
    fs.writeFileSync(path.join(fixture, "stub.txt"), "fixture stub\n", "utf8");
    var savedDir = process.env.GIT_DIR, savedTree = process.env.GIT_WORK_TREE;
    process.env.GIT_DIR = path.join(decoy, ".git");
    process.env.GIT_WORK_TREE = ".";
    try {
      git(fixture, ["init", "-q"]);
      git(fixture, ["add", "stub.txt"]);
    } finally {
      if (savedDir === undefined) delete process.env.GIT_DIR; else process.env.GIT_DIR = savedDir;
      if (savedTree === undefined) delete process.env.GIT_WORK_TREE; else process.env.GIT_WORK_TREE = savedTree;
    }
    var decoyConfig = fs.readFileSync(path.join(decoy, ".git", "config"), "utf8");
    if (/^\s*worktree\s*=/mi.test(decoyConfig)) return "inherited env re-pointed the decoy repo's worktree:\n" + decoyConfig;
    var decoyStaged = String(run("git", ["-C", decoy, "diff", "--cached", "--name-only"]).stdout || "");
    if (decoyStaged.indexOf("stub.txt") >= 0) return "fixture add leaked into the decoy repo's index";
    if (!fs.existsSync(path.join(fixture, ".git"))) return "fixture repo was never initialized in place";
    return "";
  });

  // ---- #16④ doc-size advisory (dev/doc-size.js thresholds measured through session-check) ----

  test("doc under its watch threshold stays silent", function () {
    var repo = scheduleRepo(tmp, "docsize-ok", JSON.stringify([{ id: "future", due: "2999-12-31", every_days: 14, note: "Synthetic future schedule" }]));
    var r = run(process.execPath, [SESSION, "--root", repo], { cwd: ROOT });
    var out = resultText(r);
    if (r.status !== 0) return "under-threshold doc blocked with exit " + r.status + ": " + out;
    return out.indexOf("DOC SIZE") < 0 ? "" : "an under-threshold doc surfaced a size warning: " + out;
  });

  test("doc over its watch threshold surfaces loudly and exits zero", function () {
    var repo = scheduleRepo(tmp, "docsize-watch", JSON.stringify([{ id: "future", due: "2999-12-31", every_days: 14, note: "Synthetic future schedule" }]), 125000);
    var r = run(process.execPath, [SESSION, "--root", repo], { cwd: ROOT });
    var out = resultText(r);
    if (r.status !== 0) return "watch-level doc blocked with exit " + r.status + ": " + out;
    if (out.indexOf("DOC SIZE WATCH") < 0 || out.indexOf("CLAUDE.md") < 0 || out.indexOf("125000") < 0)
      return "watch-level doc was not reported with file and size: " + out;
    return /baseline/.test(out) ? "" : "watch line does not name the baseline it measures against: " + out;
  });

  test("doc over its problem threshold escalates past WATCH", function () {
    var repo = scheduleRepo(tmp, "docsize-problem", JSON.stringify([{ id: "future", due: "2999-12-31", every_days: 14, note: "Synthetic future schedule" }]), 140000);
    var r = run(process.execPath, [SESSION, "--root", repo], { cwd: ROOT });
    var out = resultText(r);
    if (r.status !== 0) return "problem-level doc blocked with exit " + r.status + ": " + out;
    return out.indexOf("DOC SIZE PROBLEM") >= 0 && out.indexOf("140000") >= 0 ? "" : "problem-level doc did not escalate: " + out;
  });

  test("missing watched doc warns loudly and exits zero", function () {
    var repo = scheduleRepo(tmp, "docsize-missing", JSON.stringify([{ id: "future", due: "2999-12-31", every_days: 14, note: "Synthetic future schedule" }]));
    fs.rmSync(path.join(repo, "CLAUDE.md"));
    var r = run(process.execPath, [SESSION, "--root", repo], { cwd: ROOT });
    var out = resultText(r);
    if (r.status !== 0) return "missing-doc advisory blocked with exit " + r.status + ": " + out;
    if (out.indexOf("CLAUDE.md") < 0 || !/could not be measured|no such file|ENOENT/i.test(out))
      return "missing watched doc was not loudly attributable: " + out;
    return /WARN|ADVIS/i.test(out) ? "" : "missing-doc output was not advisory: " + out;
  });

  test("doc-size CLI prints the current size and a per-release history", function () {
    var realSize = fs.statSync(path.join(ROOT, "CLAUDE.md")).size;
    var r = run(process.execPath, [path.join(__dirname, "doc-size.js")], { cwd: ROOT });
    var out = resultText(r);
    if (r.status !== 0) return "doc-size CLI failed with exit " + r.status + ": " + out;
    if (out.indexOf("CLAUDE.md — " + realSize + " bytes") < 0) return "CLI did not report the actual on-disk size (" + realSize + "): " + out;
    if (out.indexOf("Per-release history") < 0) return "CLI printed no history section: " + out;
    if (!/v1\.\d+\s+\d{4}-\d{2}-\d{2}\s+\d+/.test(out)) return "history rows carry no version/date/size triple: " + out;
    return "";
  });
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}

if (fail) {
  console.error("TODO/session hygiene: " + fail + " failed, " + pass + " passed");
  process.exit(1);
}
console.log("ALL GREEN — " + pass + " TODO/session hygiene acceptance tests");
