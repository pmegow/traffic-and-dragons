// dev/tests-standalone-runner.js — the runner of the standalone suites runs them SEVERAL AT A TIME (2026-11-18) and
// loses nothing by it: a failing suite fails the run and is named, every suite's output is printed whole and in list
// order, a suite's failure starts no further suite, and the width is a number the caller can set. Driven over fixture
// suites through the runner's own main(), in a child process (main ends the process).
//   node dev/tests-standalone-runner.js
var assert = require("assert");
var fs = require("fs");
var os = require("os");
var path = require("path");
var cp = require("child_process");

var RUNNER = path.join(__dirname, "run-standalone-suites.js");
var runner = require("./run-standalone-suites.js");
var passed = 0;
function test(name, fn) { try { fn(); passed++; console.log("PASS standalone-runner " + name); } catch (e) { process.exitCode = 1; console.error("FAIL standalone-runner " + name + " — " + e.stack); } }
function text(r) { return String(r.stdout || "") + String(r.stderr || ""); }

var tmp = fs.mkdtempSync(path.join(os.tmpdir(), "tnd-standalone-runner-"));
var LOG = path.join(tmp, "events.txt");
var DRIVER = path.join(tmp, "driver.js");
fs.writeFileSync(DRIVER, "var r = require(" + JSON.stringify(RUNNER) + ");\nvar a = JSON.parse(process.argv[2]);\nr.main(a.suites, a.first || [], a.argv || [], process.env);\n");

// a fixture suite: says when it starts and ends (the shared log), prints its own lines, waits, exits with a code
function suite(name, waitMs, code) {
  var f = path.join(tmp, name + ".js");
  fs.writeFileSync(f, [
    "var fs = require('fs'), LOG = " + JSON.stringify(LOG) + ";",
    "fs.appendFileSync(LOG, 'start " + name + "\\n');",
    "console.log('" + name + " line 1');",
    "setTimeout(function () {",
    "  console.log('" + name + " line 2');",
    "  if (" + code + ") console.error('" + name + " is red');",
    "  fs.appendFileSync(LOG, 'end " + name + "\\n');",
    "  process.exit(" + code + ");",
    "}, " + waitMs + ");"
  ].join("\n") + "\n");
  return f;
}
function drive(suites, argv, first, env) {
  try { fs.unlinkSync(LOG); } catch (e) { /* no run before this one */ }
  var r = cp.spawnSync(process.execPath, [DRIVER, JSON.stringify({ suites: suites, argv: argv || [], first: first || [] })], { encoding: "utf8", env: Object.assign({}, process.env, { STANDALONE_JOBS: "", STANDALONE_TIMES: "" }, env || {}) });
  var events = []; try { events = fs.readFileSync(LOG, "utf8").split(/\r?\n/).filter(Boolean); } catch (e) { /* nothing ran */ }
  return { status: r.status, stdout: String(r.stdout || ""), stderr: String(r.stderr || ""), events: events };
}

test("two at a time: the second suite starts before the first has ended; one at a time it does not", function () {
  var a = suite("wide-a", 700, 0), b = suite("wide-b", 700, 0);
  var two = drive([a, b], ["--jobs=2"]);
  assert.equal(two.status, 0, text(two));
  assert.deepEqual(two.events.slice(0, 2).sort(), ["start wide-a", "start wide-b"], "both started before either ended: " + two.events.join(" | "));
  var one = drive([a, b], ["--jobs=1"]);
  assert.equal(one.status, 0, text(one));
  assert.deepEqual(one.events, ["start wide-a", "end wide-a", "start wide-b", "end wide-b"]);
});

test("a suite's output is printed whole and in list order, whichever ended first", function () {
  var slow = suite("order-slow", 900, 0), quick = suite("order-quick", 50, 0);
  var r = drive([slow, quick], ["--jobs=2"]);
  assert.equal(r.status, 0, text(r));
  assert.ok(r.events.indexOf("end order-quick") < r.events.indexOf("end order-slow"), "the quick one ended first: " + r.events.join(" | "));
  assert.equal(r.stdout, "order-slow line 1\norder-slow line 2\norder-quick line 1\norder-quick line 2\nALL GREEN — 2 standalone verifier suites\n");
});

test("a failing suite fails the run: exit 1, named with its exit code, its own output kept", function () {
  var ok = suite("red-ok", 20, 0), bad = suite("red-bad", 20, 3);
  var r = drive([ok, bad], ["--jobs=2"]);
  assert.equal(r.status, 1, text(r));
  assert.match(r.stderr, /red-bad is red/);
  assert.ok(r.stderr.indexOf("STANDALONE SUITE FAILED: " + bad + " (exit 3)") >= 0, r.stderr);
  assert.ok(r.stderr.indexOf("STANDALONE SUITES RED — 1 failed: " + bad) >= 0, r.stderr);
  assert.doesNotMatch(r.stdout, /ALL GREEN/);
});

test("a suite that cannot be started is a failure, never a pass", function () {
  var r = drive([path.join(tmp, "no-such-suite.js")], ["--jobs=2"]);
  assert.equal(r.status, 1, text(r));
  assert.match(r.stderr, /STANDALONE SUITES RED — 1 failed/);
});

test("after a failure no further suite starts; the ones not run are counted", function () {
  var bad = suite("stop-bad", 20, 1), never = suite("stop-never", 20, 0), never2 = suite("stop-never2", 20, 0);
  var r = drive([bad, never, never2], ["--jobs=1"]);
  assert.equal(r.status, 1, text(r));
  assert.deepEqual(r.events, ["start stop-bad", "end stop-bad"]);
  assert.match(r.stderr, /\(2 not run\)/);
});

test("a suite that ran beside the failure is still printed, though one before it never started", function () {
  var bad = suite("gap-bad", 300, 1), skipped = suite("gap-skipped", 20, 0), late = suite("gap-late", 600, 4);
  // start order: bad and late first (two at a time); skipped would be third and never starts
  var r = drive([bad, skipped, late], ["--jobs=2"], [bad, late]);
  assert.equal(r.status, 1, text(r));
  assert.equal(r.events.indexOf("start gap-skipped"), -1, r.events.join(" | "));
  assert.match(r.stdout, /gap-late line 2/, "the late suite's output is printed");
  assert.ok(r.stderr.indexOf("STANDALONE SUITES RED — 2 failed: " + bad + ", " + late + " (1 not run)") >= 0, r.stderr);
});

test("the start order puts the named suites first and keeps every suite once; an unknown name is refused", function () {
  assert.deepEqual(runner.startOrder(["a", "b", "c", "d"], ["c", "a"]), [2, 0, 1, 3]);
  assert.throws(function () { runner.startOrder(["a", "b"], ["z"]); }, /START_FIRST names a suite that is not in the list: z/);
  var order = runner.startOrder(runner.SUITES, runner.START_FIRST);
  assert.equal(order.length, runner.SUITES.length);
  assert.equal(order.slice().sort(function (x, y) { return x - y; }).join(","), runner.SUITES.map(function (n, i) { return i; }).join(","), "every suite once");
  assert.equal(runner.SUITES[order[0]], runner.START_FIRST[0]);
});

test("the width: the argument wins over the environment, the default is at most 8, a bad value is refused", function () {
  assert.equal(runner.jobCount(["--jobs=3"], { STANDALONE_JOBS: "5" }), 3);
  assert.equal(runner.jobCount([], { STANDALONE_JOBS: "5" }), 5);
  var d = runner.jobCount([], {});
  assert.ok(d >= 1 && d <= 8, "default " + d);
  assert.throws(function () { runner.jobCount(["--jobs=0"], {}); }, /at least 1/);
  assert.throws(function () { runner.jobCount(["--wide"], {}); }, /unknown argument/);
  assert.throws(function () { runner.jobCount([], { STANDALONE_JOBS: "many" }); }, /not a number/);
  var r = drive([suite("arg-a", 10, 0)], ["--jobs=lots"]);
  assert.equal(r.status, 2, text(r));
  assert.deepEqual(r.events, [], "nothing ran on a bad argument");
});

test("the real list is run by this runner and holds this suite", function () {
  assert.ok(runner.SUITES.indexOf("dev/tests-standalone-runner.js") >= 0);
  runner.SUITES.forEach(function (n) { assert.ok(fs.existsSync(path.join(__dirname, "..", n)), n + " exists"); });
  assert.equal(runner.SUITES.filter(function (n, i) { return runner.SUITES.indexOf(n) !== i; }).join(","), "", "no suite listed twice");
});

fs.rmSync(tmp, { recursive: true, force: true });
if (!process.exitCode) console.log("ALL GREEN — " + passed + " standalone-runner assertions");
