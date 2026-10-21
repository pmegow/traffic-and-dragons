// dev/tests-651-qa-activity.js — #651: the QA Agent Activity section of bug_tracker.html. The pure parser
// (parseActivity / activityValue / activityKind / activityHeadline) is lifted out of the satellite's inline
// script by its two markers and run here in node, against the REAL DOC/QA_ACTIVITY.md (the cloud routine's
// log) and against hostile shapes. The DOM half rides the browser seam (window.__bugTrackerTest) and the
// run-tests source contract pins its inert sink and its loud catch path.
//   node dev/tests-651-qa-activity.js
var assert = require("assert/strict"), fs = require("fs"), path = require("path");
var ROOT = path.join(__dirname, "..");
var passed = 0;
function test(name, fn) { try { fn(); passed++; console.log("PASS #651 " + name); } catch (e) { process.exitCode = 1; console.error("FAIL #651 " + name + "\n  " + (e && e.message)); } }

var PURE_START = "// ── QA activity (pure)", PURE_END = "// ── QA activity (DOM)";
function liftPure() {
  var html = fs.readFileSync(path.join(ROOT, "bug_tracker.html"), "utf8");
  var a = html.indexOf(PURE_START), b = html.indexOf(PURE_END);
  if (a < 0 || b < 0 || b < a) throw new Error("the QA activity markers are missing or out of order in bug_tracker.html");
  var block = html.slice(a, b);
  if (/document\.|window\.|el\(/.test(block)) throw new Error("the pure block reaches for the DOM — it must stay node-runnable");
  return new Function(block + "\nreturn {parseActivity:parseActivity,activityValue:activityValue,activityKind:activityKind,activityHeadline:activityHeadline};")();
}
var A = liftPure();
var REAL = fs.readFileSync(path.join(ROOT, "DOC", "QA_ACTIVITY.md"), "utf8");

test("the real log parses: entries newest first, each with a UTC time, a run id and its bullets", function () {
  var es = A.parseActivity(REAL);
  assert.ok(es.length >= 2, "at least the two runs of 2026-10-21 are logged");
  es.forEach(function (e) {
    assert.match(e.when, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}Z$/, "when: " + e.when);
    assert.match(e.run, /^(cse_[A-Za-z0-9]+|manual)$/, "run: " + e.run);
    assert.ok(A.activityValue(e, "summary"), e.run + " carries a summary line");
    assert.ok(A.activityValue(e, "master"), e.run + " says what master got");
  });
  for (var i = 1; i < es.length; i++) assert.ok(es[i - 1].when >= es[i].when, "newest first: " + es[i - 1].when + " before " + es[i].when);
  var first = es.filter(function (e) { return e.run === "cse_018erYSzQqW4Pmjz3yJ8fM75"; })[0];
  assert.ok(first, "the first real run is logged");
  assert.equal(A.activityValue(first, "master"), "9f61d15c");
  assert.match(A.activityValue(first, "filed"), /^B49 — /);
  assert.equal(A.activityKind(first), "fail", "it reported failures (gh, the shallow clone), so it is marked");
});

test("the contract prose above the rule is not an entry — only '## <time> · <run>' headings count", function () {
  var es = A.parseActivity(REAL);
  es.forEach(function (e) { assert.notEqual(e.when, "Traffic", "the title line leaked in as an entry"); });
  var junk = "# Title\n\n## Not an entry\n- summary: x\n\n## 2026-10-21T00:00Z · manual\n- summary: y\n- master: unchanged\n";
  var j = A.parseActivity(junk);
  assert.equal(j.length, 1);
  assert.equal(j[0].run, "manual");
});

test("a run's kind: failures → fail; nothing changed → noop; work without failures → work", function () {
  var md = "## 2026-10-21T16:31Z · cse_a\n- summary: feed 373 · nothing new\n- master: unchanged\n\n"
         + "## 2026-10-21T08:31Z · cse_b\n- summary: feed 374 · new 1 · filed 1\n- filed: B50 — a thing\n- master: abc1234\n\n"
         + "## 2026-10-21T00:31Z · cse_c\n- summary: stopped\n- failures: feed refused: forbidden\n- master: unchanged\n";
  var es = A.parseActivity(md);
  assert.deepEqual(es.map(A.activityKind), ["noop", "work", "fail"]);
  var noMaster = A.parseActivity("## 2026-10-21T00:00Z · cse_d\n- summary: s\n")[0];
  assert.equal(A.activityKind(noMaster), "noop", "no master line reads as unchanged");
});

test("bullets that are not 'key: value' and lines outside bullets are ignored; values keep their text verbatim", function () {
  var e = A.parseActivity("## 2026-10-21T00:00Z · cse_e\nprose line\n- not a keyed line\n- filed: B51 — <script>alert(1)</script> · a: b: c\n-badly: formed\n")[0];
  assert.equal(e.lines.length, 1);
  assert.equal(e.lines[0].key, "filed");
  assert.equal(e.lines[0].value, "B51 — <script>alert(1)</script> · a: b: c", "the parser never interprets the value — the renderer keeps it inert");
});

test("the headline counts runs and names the newest time, and says how many reported failures", function () {
  assert.equal(A.activityHeadline([]), "QA Agent Activity (no runs logged yet)");
  var es = A.parseActivity("## 2026-10-21T08:31Z · cse_b\n- summary: s\n- filed: B50 — x\n- master: abc\n\n## 2026-10-21T00:31Z · cse_c\n- summary: s\n- failures: f\n- master: unchanged\n");
  assert.equal(A.activityHeadline(es), "QA Agent Activity (2 runs · last 2026-10-21T08:31Z · 1 with failures)");
  assert.equal(A.activityHeadline(es.slice(0, 1)), "QA Agent Activity (1 run · last 2026-10-21T08:31Z)");
});

test("the real log's header states the format contract the parser relies on", function () {
  assert.match(REAL, /^# Traffic and Dragons — QA Agent Activity/);
  assert.match(REAL, /Format contract/);
  assert.match(REAL, /`·`/, "the separator the parser keys on is named");
  assert.ok(REAL.indexOf("\n---\n") > 0 && REAL.indexOf("\n---\n") < REAL.indexOf("\n## 20"), "the rule separates the contract from the entries");
});

if (!process.exitCode) console.log("ALL GREEN — " + passed + " #651 QA activity assertions");
