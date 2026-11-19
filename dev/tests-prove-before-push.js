// dev/tests-prove-before-push.js — the local proof before a push (dev/prove-before-push.js, owner ruling 2026-11-18):
// the applicability scan, the replay baselines the workflow names, and ONLY the batteries the range added or edited.
// The range sweep is CI's, and CI's sweep step runs even when an earlier step is red. Driven over a fixture repository.
//   node dev/tests-prove-before-push.js
var assert = require("assert");
var fs = require("fs");
var os = require("os");
var path = require("path");
var cp = require("child_process");

var ROOT = path.join(__dirname, "..");
var TOOL = path.join(__dirname, "prove-before-push.js");
var tool = require("./prove-before-push.js");
var enforcement = require("./check-enforcement.js");
var passed = 0;
function test(name, fn) { try { fn(); passed++; console.log("PASS prove-before-push " + name); } catch (e) { process.exitCode = 1; console.error("FAIL prove-before-push " + name + " — " + e.stack); } }
function text(r) { return String(r.stdout || "") + String(r.stderr || ""); }

var tmp = fs.mkdtempSync(path.join(os.tmpdir(), "tnd-prove-"));
function git(root, args) {
  var r = cp.spawnSync("git", ["-C", root, "-c", "user.name=fixture", "-c", "user.email=fixture@example.invalid", "-c", "commit.gpgsign=false", "-c", "core.hooksPath=" + path.join(tmp, "no-hooks")].concat(args), { encoding: "utf8" });
  assert.equal(r.status, 0, "git " + args.join(" ") + ": " + text(r));
}
function write(root, rel, body) { var f = path.join(root, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, body); }
// a stub that records its run in ran.txt and exits with the number in <name>.exit (0 when the file is absent)
function stub(root, rel) {
  write(root, rel, "var fs = require('fs'), path = require('path'), top = path.join(__dirname, '..');\n" +
    "fs.appendFileSync(path.join(top, 'ran.txt'), path.basename(__filename) + ' ' + process.argv.slice(2).join(' ') + '\\n');\n" +
    "var code = 0; try { code = Number(fs.readFileSync(__filename + '.exit', 'utf8')); } catch (e) { /* green */ }\n" +
    "if (code) console.error(path.basename(__filename) + ' says: the anchor moved');\nprocess.exit(code);\n");
}
// the fixture: a base commit (tag base) with the scan, the replay tool, a workflow naming two corpora, a target file and
// three batteries; then one commit that edits battery a, adds battery d, edits the target, and edits dev/sabotage.js
function fixture(name) {
  var root = path.join(tmp, name); fs.mkdirSync(root, { recursive: true });
  git(root, ["init", "-q"]);
  stub(root, "dev/check-sabotage-applicability.js"); stub(root, "dev/diff-replay.js");
  write(root, ".github/workflows/engine-tests.yml", "steps:\n      - name: one\n        run: node dev/diff-replay.js dev/corpus_a.json --check\n      - name: two\n        run: node dev/diff-replay.js dev/corpus_b.json --check\n      - name: not a replay\n        run: node dev/other.js dev/corpus_c.json --check\n");
  write(root, "engine.js", "var x = 1;\n");
  ["a", "b", "c"].forEach(function (k) { stub(root, "dev/sabotage-" + k + ".js"); fs.appendFileSync(path.join(root, "dev", "sabotage-" + k + ".js"), "/* { file: \"" + (k === "c" ? "other.js" : "engine.js") + "\", find: \"x\" } */\n"); });
  write(root, "dev/sabotage.js", "/* the harness, not a battery */\nprocess.exit(1);\n");
  write(root, ".gitignore", "ran.txt\n*.exit\n");
  git(root, ["add", "-A"]); git(root, ["commit", "-q", "-m", "base"]); git(root, ["tag", "base"]);
  fs.appendFileSync(path.join(root, "dev", "sabotage-a.js"), "/* edited */\n");
  stub(root, "dev/sabotage-d.js");
  fs.appendFileSync(path.join(root, "engine.js"), "var y = 2;\n");
  fs.appendFileSync(path.join(root, "dev", "sabotage.js"), "/* edited */\n");
  git(root, ["add", "-A"]); git(root, ["commit", "-q", "-m", "change"]);
  return root;
}
function drive(root, args, env) {
  try { fs.unlinkSync(path.join(root, "ran.txt")); } catch (e) { /* first run */ }
  var r = cp.spawnSync(process.execPath, [TOOL, "--root", root].concat(args || ["base..HEAD"]), { encoding: "utf8", env: Object.assign({}, process.env, env || {}) });
  var ran = []; try { ran = fs.readFileSync(path.join(root, "ran.txt"), "utf8").split(/\r?\n/).filter(Boolean).map(function (l) { return l.trim(); }); } catch (e) { /* nothing ran */ }
  return { status: r.status, stdout: String(r.stdout || ""), stderr: String(r.stderr || ""), ran: ran };
}

test("green: the scan, the workflow's replays and ONLY the batteries the range added or edited run — the sweep is counted and left to CI", function () {
  var root = fixture("green"), r = drive(root);
  assert.equal(r.status, 0, text(r));
  assert.deepEqual(r.ran.slice().sort(), ["check-sabotage-applicability.js", "diff-replay.js dev/corpus_a.json --check", "diff-replay.js dev/corpus_b.json --check", "sabotage-a.js", "sabotage-d.js"]);
  assert.equal(r.ran.indexOf("sabotage-b.js"), -1, "a battery that only TARGETS a changed file is the sweep's, not run here");
  assert.match(r.stdout, /PROVE BEFORE PUSH GREEN — the scan, 2 replay\(s\), 2 battery\(ies\) this range added or edited\. The range sweep is CI's: 3 battery\(ies\) target base\.\.HEAD/);
});

test("a red applicability scan is red, and its own words are printed", function () {
  var root = fixture("scan");
  fs.writeFileSync(path.join(root, "dev", "check-sabotage-applicability.js.exit"), "1");
  var r = drive(root);
  assert.equal(r.status, 1, text(r));
  assert.match(text(r), /check-sabotage-applicability\.js says: the anchor moved/);
  assert.match(r.stderr, /PROVE BEFORE PUSH RED — the applicability scan/);
});

test("a drifted replay baseline is red and named", function () {
  var root = fixture("replay");
  fs.writeFileSync(path.join(root, "dev", "diff-replay.js.exit"), "1");
  var r = drive(root);
  assert.equal(r.status, 1, text(r));
  assert.match(r.stderr, /PROVE BEFORE PUSH RED — replay dev\/corpus_a\.json, replay dev\/corpus_b\.json/);
});

test("a red battery of the range's own is red and named; a red battery outside the range is not run", function () {
  var root = fixture("battery");
  fs.writeFileSync(path.join(root, "dev", "sabotage-d.js.exit"), "1");
  fs.writeFileSync(path.join(root, "dev", "sabotage-b.js.exit"), "1");
  var r = drive(root, ["base..HEAD", "--jobs=1"]);
  assert.equal(r.status, 1, text(r));
  assert.match(r.stdout, /^FAIL sabotage-d\.js/m);
  assert.match(r.stderr, /PROVE BEFORE PUSH RED — sabotage-d\.js\./);
  assert.equal(r.ran.indexOf("sabotage-b.js"), -1);
});

test("a range that cannot be read proves nothing and says so: exit 2, nothing run", function () {
  var root = fixture("norange"), r = drive(root, ["no-such-ref..HEAD"]);
  assert.equal(r.status, 2, text(r));
  assert.match(r.stderr, /PROVE BEFORE PUSH NOT RUN — the range no-such-ref\.\.HEAD could not be read/);
  assert.deepEqual(r.ran, []);
});

test("a workflow that names no replay is red, never zero replays passed", function () {
  var root = fixture("noreplay");
  write(root, ".github/workflows/engine-tests.yml", "steps:\n      - run: node dev/run-tests.js\n");
  var r = drive(root);
  assert.equal(r.status, 1, text(r));
  assert.match(r.stderr, /no replay baselines found/);
});

test("git's hook environment does not reach the steps (a GIT_DIR pointing elsewhere changes nothing)", function () {
  var root = fixture("hookenv"), r = drive(root, null, { GIT_DIR: path.join(tmp, "elsewhere", ".git"), GIT_INDEX_FILE: path.join(tmp, "elsewhere", "index") });
  assert.equal(r.status, 0, text(r));
  assert.equal(r.ran.length, 5);
});

test("the pure parts: which files are batteries, the replays read from the real workflow, the sweep's count", function () {
  assert.deepEqual(tool.ownBatteries(["dev/sabotage-z.js", "dev/sabotage.js", "dev/sabotage-a.js", "dev/tests-a.js", "sabotage-x.js", "dev/sub/sabotage-y.js"]), ["sabotage-a.js", "sabotage-z.js"]);
  var wf = fs.readFileSync(path.join(ROOT, ".github", "workflows", "engine-tests.yml"), "utf8"), replays = tool.replayCommands(wf);
  assert.ok(replays.length >= 4, "the real workflow's replays: " + replays.length);
  replays.forEach(function (c) { assert.ok(fs.existsSync(path.join(ROOT, c[1])), c[1] + " exists"); assert.equal(c[0], "dev/diff-replay.js"); assert.equal(c[2], "--check"); });
  assert.equal(tool.sweepSize(["engine.js"], { "sabotage-a.js": "prove({ file: \"engine.js\", cases: [] })", "sabotage-b.js": "prove({ file: \"other.js\", cases: [] })" }), 1);
  assert.equal(tool.sweepSize(["dev/sabotage-b.js"], { "sabotage-a.js": "prove({ file: \"engine.js\" })", "sabotage-b.js": "prove({ file: \"other.js\" })" }), 1);
  assert.equal(tool.parseArgs([]).range, "origin/master..HEAD");
  assert.throws(function () { tool.parseArgs(["a..b", "c..d"]); }, /one range/);
  assert.throws(function () { tool.parseArgs(["--sweep"]); }, /unknown or incomplete argument/);
});

test("the tracked pre-push runs it after the browser suites and blocks the push when it is red", function () {
  var hook = fs.readFileSync(path.join(ROOT, "dev", "pre-push"), "utf8");
  var suites = hook.indexOf("node \"$TOP/dev/run-browser-suites.js\" || {"), proof = hook.indexOf("node \"$TOP/dev/prove-before-push.js\" || {");
  assert.ok(suites > 0 && proof > suites, "the proof runs, after the browser suites");
  assert.match(hook.slice(proof), /Push blocked: the local proof is red[^\n]*\n\s*exit 1/);
  assert.match(hook, /if \[ -f "\$TOP\/dev\/prove-before-push\.js" \]; then/, "a checkout from before it is let through by the guard");
});

test("CI's sweep runs even when an earlier step is red, and the pin catches its removal", function () {
  var wf = fs.readFileSync(path.join(ROOT, ".github", "workflows", "engine-tests.yml"), "utf8");
  assert.match(wf, /- name: Run the sabotage batteries whose targets this change touched\n\s+if: \$\{\{ !cancelled\(\) \}\}\n\s+run: node dev\/run-sabotage-diff\.js "\$CI_RANGE"/);
  assert.deepEqual(enforcement.workflowProblems(wf), [], "the real workflow has no problems");
  var hidden = wf.replace("        if: ${{ !cancelled() }}\n        run: node dev/run-sabotage-diff.js \"$CI_RANGE\"", "        run: node dev/run-sabotage-diff.js \"$CI_RANGE\"");
  assert.notEqual(hidden, wf);
  assert.ok(enforcement.workflowProblems(hidden).some(function (p) { return /even when an earlier step is red/.test(p); }), "a sweep an earlier red step can hide must trip a pin: " + enforcement.workflowProblems(hidden).join(" | "));
});

fs.rmSync(tmp, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
if (!process.exitCode) console.log("ALL GREEN — " + passed + " prove-before-push assertions");
