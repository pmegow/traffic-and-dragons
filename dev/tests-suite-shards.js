// dev/tests-suite-shards.js — a long suite split across processes (dev/suite-shards.js, 2026-11-18) runs every group
// exactly once, and a split that ran less is RED with the reason: a failing shard, a shard that died before its end,
// shards that disagree on the file's size, counts that do not add up. Driven over fixture suites that use the helper
// the way dev/tests-684-atlas-engine.js does, and over that file's own wiring.
//   node dev/tests-suite-shards.js
var assert = require("assert");
var fs = require("fs");
var os = require("os");
var path = require("path");
var cp = require("child_process");

var HELPER = path.join(__dirname, "suite-shards.js");
var shards = require("./suite-shards.js");
var passed = 0;
function test(name, fn) { try { fn(); passed++; console.log("PASS suite-shards " + name); } catch (e) { process.exitCode = 1; console.error("FAIL suite-shards " + name + " — " + e.stack); } }
function text(r) { return String(r.stdout || "") + String(r.stderr || ""); }

var tmp = fs.mkdtempSync(path.join(os.tmpdir(), "tnd-suite-shards-"));

// a fixture suite of `groups` groups. `fault` plants what a broken split looks like, in shard 1 only:
//   "red" a group fails · "dies" the process ends before its last line · "drops" a group is skipped and not counted
//   as run · "short" the shard sees one group fewer in the file
function suite(name, groups, fault) {
  var f = path.join(tmp, name + ".js");
  fs.writeFileSync(f, [
    "var shards = require(" + JSON.stringify(HELPER) + ");",
    "var SHARD = shards.arg(process.argv), seen = 0, ran = 0, FAULT = " + JSON.stringify(fault || "") + ";",
    "var faulty = SHARD && SHARD.k === 1;",
    "if (!SHARD) { shards.runParent(__filename, Number(process.env.FIXTURE_SHARDS), function (v) { console.log('VERDICT ' + JSON.stringify(v)); process.exit(v.ok ? 0 : 1); }); return; }",
    "function group(i) {",
    "  if (!shards.mine(SHARD, seen++)) return;",
    "  if (faulty && FAULT === 'drops' && i === 4) return;",
    "  ran++; console.log('RAN ' + i);",
    "  if (faulty && FAULT === 'red') process.exitCode = 1;",
    "  if (faulty && FAULT === 'dies') process.exit(0);",
    "}",
    "for (var i = 0; i < " + groups + "; i++) group(i);",
    "if (faulty && FAULT === 'short') seen--;",
    "console.log(shards.line(SHARD, ran, seen));"
  ].join("\n") + "\n");
  return f;
}
function drive(file, n) {
  var r = cp.spawnSync(process.execPath, [file], { encoding: "utf8", env: Object.assign({}, process.env, { FIXTURE_SHARDS: String(n) }) });
  var m = /^VERDICT (.*)$/m.exec(String(r.stdout || ""));
  return { status: r.status, stdout: String(r.stdout || ""), stderr: String(r.stderr || ""), verdict: m ? JSON.parse(m[1]) : null,
    ran: (String(r.stdout || "").match(/^RAN \d+$/gm) || []).map(function (l) { return Number(l.slice(4)); }) };
}

test("every group runs exactly once across the shards, whatever the number of shards", function () {
  [1, 2, 3, 4, 7, 12].forEach(function (n) {
    var r = drive(suite("whole-" + n, 10), n);
    assert.equal(r.status, 0, text(r));
    assert.deepEqual(r.ran.slice().sort(function (a, b) { return a - b; }), [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], n + " shards");
    assert.equal(r.verdict.total, 10); assert.equal(r.verdict.ran, 10); assert.equal(r.verdict.ok, true);
  });
});

test("the shards' output is printed whole and in shard order", function () {
  var r = drive(suite("order", 6), 3);
  assert.deepEqual(r.ran, [0, 3, 1, 4, 2, 5]);
});

test("a failing group in one shard turns the whole run red, and the shard is named", function () {
  var r = drive(suite("red", 6, "red"), 3);
  assert.equal(r.status, 1, text(r));
  assert.match(r.stderr, /SHARDS RED — shard 1\/3 failed \(exit 1\)/);
});

test("a shard that ends before its last line is red, though it exited 0", function () {
  var r = drive(suite("dies", 6, "dies"), 3);
  assert.equal(r.status, 1, text(r));
  assert.match(r.stderr, /SHARDS RED — shard 1\/3 never said its count — it ended before its last line/);
});

test("a shard that ran fewer groups than are its own is red: the counts do not add up", function () {
  var r = drive(suite("drops", 9, "drops"), 3);
  assert.equal(r.status, 1, text(r));
  assert.match(r.stderr, /SHARDS RED — the shards ran 8 of the file's 9 groups/);
});

test("shards that disagree on how many groups the file has are red", function () {
  var r = drive(suite("short", 9, "short"), 3);
  assert.equal(r.status, 1, text(r));
  assert.match(r.stderr, /SHARDS RED — the shards disagree on how many groups the file has: 9, 8, 9/);
});

test("a file with no groups is red, never a green that ran nothing", function () {
  var r = drive(suite("empty", 0), 2);
  assert.equal(r.status, 1, text(r));
  assert.match(r.stderr, /SHARDS RED — the file has no groups — nothing ran/);
});

test("judge: a shard answering under another shard's number is refused", function () {
  var v = shards.judge([{ status: 0, out: "SHARD 0/2 ran 2 of 4\n" }, { status: 0, out: "SHARD 0/2 ran 2 of 4\n" }]);
  assert.equal(v.ok, false); assert.match(v.why.join(" | "), /shard 1\/2 answered as shard 0\/2/);
  assert.equal(shards.judge([{ status: 0, out: "x\nSHARD 0/2 ran 2 of 4\n" }, { status: 0, out: "SHARD 1/2 ran 2 of 4\n" }]).ok, true);
});

test("the argument and the count: k/n is read, a bad one refused; the count is the variable, else half the cores up to the cap", function () {
  assert.equal(shards.arg(["a.js"]), null);
  assert.deepEqual(shards.arg(["--shard", "2/6"]), { k: 2, n: 6 });
  ["6/6", "x", "1", "-1/3", undefined].forEach(function (bad) { assert.throws(function () { shards.arg(["--shard", bad]); }, /--shard wants k\/n/, String(bad)); });
  assert.equal(shards.mine(null, 5), true);
  assert.equal(shards.mine({ k: 1, n: 3 }, 4), true); assert.equal(shards.mine({ k: 1, n: 3 }, 5), false);
  assert.equal(shards.count({ X: "3" }, "X", 6, 32), 3);
  assert.equal(shards.count({}, "X", 6, 32), 6);
  assert.equal(shards.count({}, "X", 6, 4), 2);
  assert.equal(shards.count({}, "X", 6, 2), 1, "a two-core machine does not split");
  assert.equal(shards.count({}, "X", 6, 1), 1);
  assert.throws(function () { shards.count({ X: "many" }, "X", 6, 8); }, /X is not a number of at least 1/);
  assert.throws(function () { shards.count({ X: "0" }, "X", 6, 8); }, /X is not a number of at least 1/);
});

test("the atlas engine suite is wired to it: both group doors count before they filter, the last line says the count, --only stays whole", function () {
  var src = fs.readFileSync(path.join(__dirname, "tests-684-atlas-engine.js"), "utf8");
  assert.equal(src.split("  if (!shards.mine(SHARD, seen++)) return;\n  if (ONLY !== null && name.indexOf(ONLY) < 0) return;").length, 3, "test() and atest() both count every group, then filter");
  assert.ok(src.indexOf("  if (SHARD) console.log(shards.line(SHARD, matched, seen));") > 0);
  assert.ok(src.indexOf("SHARD_COUNT = SHARD || process.argv.indexOf(\"--only\") > 0 ? 1 :") > 0, "a shard and an --only run never split again");
  var ATLAS = path.join(__dirname, "tests-684-atlas-engine.js");
  var bad = cp.spawnSync(process.execPath, [ATLAS, "--shard", "9/3"], { encoding: "utf8" });
  assert.equal(bad.status, 2, text(bad));
  var both = cp.spawnSync(process.execPath, [ATLAS, "--shard", "0/3", "--only", "x"], { encoding: "utf8" });
  assert.equal(both.status, 2, text(both)); assert.match(both.stderr, /--shard and --only do not go together/);
  var only = cp.spawnSync(process.execPath, [ATLAS, "--only", "#697 a zone of a kind no builder"], { encoding: "utf8" });
  assert.equal(only.status, 0, text(only));
  assert.match(only.stdout, /ALL GREEN — 1 atlas engine groups \(#684\) \(--only: 1 of the file's groups ran\)/);
  assert.doesNotMatch(only.stdout, /SHARD|processes/);
});

fs.rmSync(tmp, { recursive: true, force: true });
if (!process.exitCode) console.log("ALL GREEN — " + passed + " suite-shards assertions");
