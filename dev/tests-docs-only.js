// dev/tests-docs-only.js — a documentation-only commit skips the engine suite in the pre-commit (dev/docs-only.js, owner
// ruling 2026-11-18), and ONLY such a commit: the narrow list, added or modified, named by no dev script. Any doubt runs
// the suite. The pure judgment over made-up sets, the real staged set of a fixture repository, the real tree, the hook.
//   node dev/tests-docs-only.js
var assert = require("assert");
var fs = require("fs");
var os = require("os");
var path = require("path");
var cp = require("child_process");

var ROOT = path.join(__dirname, "..");
var TOOL = path.join(__dirname, "docs-only.js");
var tool = require("./docs-only.js");
var enforcement = require("./check-enforcement.js");
var passed = 0;
function test(name, fn) { try { fn(); passed++; console.log("PASS docs-only " + name); } catch (e) { process.exitCode = 1; console.error("FAIL docs-only " + name + " — " + e.stack); } }
function text(r) { return String(r.stdout || "") + String(r.stderr || ""); }
function M(f) { return { status: "M", file: f }; }

/* the made-up reader sources: one names a doc by its path, one by its file name alone (a path.join) */
var SOURCES = { "dev/tests-a.js": "var f = \"DOC/feed.md\";", "dev/tests-b.js": "path.join(root, 'audits', 'store.json')", "dev/tests-c.js": "// see mystore.json and feed.mdx" };

test("the narrow list: TODO.md, DOC/ outside contracts/, audits/ — and nothing else", function () {
  ["TODO.md", "DOC/notes.md", "DOC/Research/deep/a.html", "audits/x.md", "DOC/TODO_ARCHIVE.md"].forEach(function (f) { assert.equal(tool.onNarrowList(f), true, f); });
  ["CLAUDE.md", "DOC/contracts/tags.md", "globals.js", "dev/run-tests.js", "index.html", "todo_checkWithFable.md", "DOC", "audits/", "samples/a.blueprint", "website/DOC/a.md", "release-next.json", "sw.js"].forEach(function (f) { assert.equal(tool.onNarrowList(f), false, f); });
});

test("documentation only: every staged file is on the list, added or modified, and named by no dev script", function () {
  var v = tool.judge([M("DOC/notes.md"), { status: "A", file: "audits/new.md" }, M("TODO.md")], SOURCES);
  assert.equal(v.docsOnly, true, v.why); assert.match(v.why, /^3 file\(s\): DOC\/notes\.md, audits\/new\.md, TODO\.md$/);
});

test("one file off the list makes it a full run, wherever it is in the set, and the file is named", function () {
  [["globals.js"], ["DOC/notes.md", "CLAUDE.md"], ["DOC/contracts/tags.md", "DOC/notes.md"], ["TODO.md", "dev/lint-todo.js"]].forEach(function (set) {
    var v = tool.judge(set.map(M), SOURCES);
    assert.equal(v.docsOnly, false, set.join());
    assert.match(v.why, /is not documentation/);
  });
});

test("a deletion or a rename is a full run: it can break a link or a reader", function () {
  var v = tool.judge([M("DOC/notes.md"), { status: "D", file: "DOC/old.md" }], SOURCES);
  assert.equal(v.docsOnly, false); assert.match(v.why, /DOC\/old\.md is deleted/);
  ["R", "C", "T", "U"].forEach(function (s) { assert.equal(tool.judge([{ status: s, file: "DOC/notes.md" }], SOURCES).docsOnly, false, s); });
});

test("a doc a dev script names is a test input: by its path, or by its file name alone — and a longer name is not it", function () {
  var byPath = tool.judge([M("DOC/feed.md")], SOURCES), byName = tool.judge([M("audits/store.json")], SOURCES);
  assert.equal(byPath.docsOnly, false); assert.match(byPath.why, /DOC\/feed\.md is named in dev\/tests-a\.js/);
  assert.equal(byName.docsOnly, false); assert.match(byName.why, /audits\/store\.json is named in dev\/tests-b\.js/);
  assert.equal(tool.readBy("audits/deep/store.json", SOURCES), "dev/tests-b.js", "the same file name elsewhere errs toward the full run");
  assert.equal(tool.readBy("DOC/ore.json", SOURCES), null, "ore.json is not store.json");
  assert.equal(tool.readBy("DOC/feed.md", { "dev/x.js": "feed.mdx and myfeed.md" }), null, "neither a longer name nor a suffix of one");
});

test("TODO.md and its archive skip though dev scripts name them: the hook's own TODO checks read them on every commit", function () {
  var sources = { "dev/lint-todo.js": "TODO.md DOC/TODO_ARCHIVE.md" };
  assert.equal(tool.judge([M("TODO.md"), M("DOC/TODO_ARCHIVE.md")], sources).docsOnly, true);
  var hook = fs.readFileSync(path.join(ROOT, "dev", "pre-commit"), "utf8"), ask = hook.indexOf("dev/docs-only.js\"; then");
  assert.ok(ask > 0);
  /* each gate by the WHOLE of its invocation: since audit G7 (2026-11-19) the hook runs the lint and the column check a
     second time for TODO_Atlas.md, and a prefix match was satisfied by that second line when the first was taken away */
  ["dev/lint-todo.js\" --git-aware --staged --cap || {", "dev/check-todo-columns.js\" --staged || {",
    "dev/lint-todo.js\" --git-aware --staged --cap --tracker TODO_Atlas.md || {", "dev/check-todo-columns.js\" --staged --tracker TODO_Atlas.md || {",
    "dev/tests-todo-hygiene.js\"", "dev/check-identity.js\"", "dev/check-es5.js\"", "dev/check-shell-markers.js\""].forEach(function (gate) {
    var at = hook.indexOf(gate); assert.ok(at > 0 && at < ask, gate + " runs before the question is asked");
  });
});

test("nothing staged is not documentation only", function () {
  var v = tool.judge([], SOURCES); assert.equal(v.docsOnly, false); assert.match(v.why, /nothing is staged/);
});

var tmp = fs.mkdtempSync(path.join(os.tmpdir(), "tnd-docs-only-"));
function git(root, args) {
  var r = cp.spawnSync("git", ["-C", root, "-c", "user.name=fixture", "-c", "user.email=fixture@example.invalid", "-c", "commit.gpgsign=false", "-c", "core.hooksPath=" + path.join(tmp, "no-hooks")].concat(args), { encoding: "utf8" });
  assert.equal(r.status, 0, "git " + args.join(" ") + ": " + text(r));
}
function write(root, rel, body) { var f = path.join(root, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, body); }
function fixture(name) {
  var root = path.join(tmp, name); fs.mkdirSync(root, { recursive: true });
  git(root, ["init", "-q"]);
  write(root, "DOC/notes.md", "one\n"); write(root, "DOC/old.md", "old\n"); write(root, "DOC/feed.md", "feed\n"); write(root, "TODO.md", "todo\n");
  write(root, "engine.js", "var x = 1;\n"); write(root, "dev/tests-a.js", "var f = \"DOC/feed.md\";\n");
  git(root, ["add", "-A"]); git(root, ["commit", "-q", "-m", "base"]);
  return root;
}
function ask(root) { return cp.spawnSync(process.execPath, [TOOL, "--root", root], { encoding: "utf8" }); }

test("the staged set of a real repository: docs staged is a yes; an unstaged engine edit beside it does not count", function () {
  var root = fixture("staged");
  fs.appendFileSync(path.join(root, "DOC", "notes.md"), "two\n"); fs.appendFileSync(path.join(root, "TODO.md"), "row\n"); write(root, "audits/new.md", "new\n");
  git(root, ["add", "DOC/notes.md", "TODO.md", "audits/new.md"]);
  fs.appendFileSync(path.join(root, "engine.js"), "var y = 2;\n");   /* edited, NOT staged: not in this commit */
  var r = ask(root);
  assert.equal(r.status, 0, text(r));
  assert.match(r.stdout, /^DOCS ONLY — the engine suite is skipped for this commit \(3 file\(s\): [^)]*\)\. CI runs it on the push\.$/m);
});

test("the staged set of a real repository: an engine file, a deletion, a rename, a test input or nothing staged is a no, with the reason", function () {
  var root = fixture("engine");
  fs.appendFileSync(path.join(root, "DOC", "notes.md"), "two\n"); fs.appendFileSync(path.join(root, "engine.js"), "var y = 2;\n"); git(root, ["add", "-A"]);
  var r = ask(root); assert.equal(r.status, 1, text(r)); assert.match(r.stdout, /docs-only: no — engine\.js is not documentation[^\n]*; the engine suite runs\./);
  root = fixture("deleted"); git(root, ["rm", "-q", "DOC/old.md"]);
  r = ask(root); assert.equal(r.status, 1, text(r)); assert.match(r.stdout, /DOC\/old\.md is deleted/);
  root = fixture("renamed"); git(root, ["mv", "DOC/old.md", "DOC/newer.md"]);
  r = ask(root); assert.equal(r.status, 1, text(r)); assert.match(r.stdout, /DOC\/old\.md is deleted/, "a rename is read as the deletion it contains");
  root = fixture("input"); fs.appendFileSync(path.join(root, "DOC", "feed.md"), "more\n"); git(root, ["add", "-A"]);
  r = ask(root); assert.equal(r.status, 1, text(r)); assert.match(r.stdout, /DOC\/feed\.md is named in dev\/tests-a\.js/);
  root = fixture("nothing");
  r = ask(root); assert.equal(r.status, 1, text(r)); assert.match(r.stdout, /nothing is staged/);
});

test("what cannot be read is a no: a folder that is no repository runs the suite", function () {
  var root = path.join(tmp, "norepo"); fs.mkdirSync(path.join(root, "dev"), { recursive: true });
  var r = cp.spawnSync(process.execPath, [TOOL, "--root", root], { encoding: "utf8", env: Object.assign({}, process.env, { GIT_CEILING_DIRECTORIES: tmp }) });
  assert.equal(r.status, 1, text(r)); assert.match(r.stdout, /docs-only: no — the staged set could not be read/);
});

test("the real tree: the docs tests read are full runs, a plain design note skips, and this file's own judge is not a reader", function () {
  var sources = tool.readers(ROOT);
  assert.equal(sources["dev/docs-only.js"], undefined);
  assert.ok(sources["dev/run-tests.js"] && sources["dev/lint-todo.js"]);
  assert.equal(Object.keys(sources).filter(function (n) { return n.indexOf("dev/") !== 0; }).length, 0, "dev scripts only");
  ["DOC/BUGS.md", "DOC/QA_ACTIVITY.md", "DOC/beta-guide.html"].forEach(function (f) { assert.equal(tool.judge([M(f)], sources).docsOnly, false, f + " is read by a test"); });
  ["TODO.md", "DOC/TODO_ARCHIVE.md"].forEach(function (f) { assert.equal(tool.judge([M(f)], sources).docsOnly, true, f); });
  /* found, never named: naming a plain note here would make this file a reader of it */
  var notes = fs.readdirSync(path.join(ROOT, "DOC")).filter(function (f) { return /\.(md|html)$/.test(f); });
  var skipping = notes.filter(function (f) { return tool.judge([M("DOC/" + f)], sources).docsOnly; });
  assert.ok(skipping.length > notes.length / 2, "most plain notes in DOC/ skip: " + skipping.length + " of " + notes.length);
  ["CLAUDE.md", "DOC/contracts/tags.md", "globals.js", "sw.js"].forEach(function (f) { assert.equal(tool.judge([M(f)], sources).docsOnly, false, f); });
});

test("the hook: a yes runs the doc link check and ends; anything else runs the engine suite; CI skips nothing and says why", function () {
  var hook = fs.readFileSync(path.join(ROOT, "dev", "pre-commit"), "utf8");
  assert.match(hook, /\nif node "\$\(git rev-parse --show-toplevel\)\/dev\/docs-only\.js"; then\n  node "\$\(git rev-parse --show-toplevel\)\/dev\/check-doc-links\.js" \|\| \{\n[^}]*exit 1\n  \}\n  exit 0\nfi\nnode "\$\(git rev-parse --show-toplevel\)\/dev\/run-tests\.js" \|\| \{/);
  var wf = fs.readFileSync(path.join(ROOT, ".github", "workflows", "engine-tests.yml"), "utf8");
  assert.equal(wf.indexOf("dev/docs-only.js") < 0 || /^\s*#/.test(wf.split("\n").filter(function (l) { return l.indexOf("dev/docs-only.js") >= 0; })[0]), true, "CI never asks: it runs the whole suite");
  assert.match(wf, /run: node dev\/run-tests\.js/); assert.match(wf, /run: node dev\/check-doc-links\.js/);
  assert.deepEqual(enforcement.coverageProblems(wf, hook), [], "every gate the hook runs is in CI, bar the reasoned exemptions");
  assert.ok(enforcement.coverageProblems(wf.replace("run: node dev/check-doc-links.js", "run: true"), hook.replace(/dev\/run-tests\.js/g, "dev/x.js")).length > 0);
});

fs.rmSync(tmp, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
if (!process.exitCode) console.log("ALL GREEN — " + passed + " docs-only assertions");
