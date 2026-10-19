// dev/tests-646-ci-status.js — #646: a red master reaches the owner. The verdict reader (dev/ci-status.js)
// over the REAL run history of the six-day red (dev/fixtures/ci-runs-646.json: 69 consecutive failures from
// 4ee2aab5, 2026-10-13 21:16 UTC, after the last green d48e605b), its unknown-never-green rule, and
// session-check.js relaying the line at session start.
//   node dev/tests-646-ci-status.js
var assert = require("assert/strict"), fs = require("fs"), path = require("path"), cp = require("child_process");
var ROOT = path.join(__dirname, "..");
var ci = require("./ci-status.js");
var FIXTURE = path.join(__dirname, "fixtures", "ci-runs-646.json");
var fx = JSON.parse(fs.readFileSync(FIXTURE, "utf8"));
var passed = 0;
function test(name, fn) { try { fn(); passed++; console.log("PASS #646 " + name); } catch (e) { process.exitCode = 1; console.error("FAIL #646 " + name + " — " + e.stack); } }

test("the real six-day red: a streak of 69, the first red is 4ee2aab5 at 2026-10-13 21:16 UTC, the last green d48e605b", function () {
  var s = ci.summarize(fx.runs);
  assert.equal(s.status, "red");
  assert.equal(s.streak, 69);
  assert.equal(s.firstRed.sha, "4ee2aab5");
  assert.equal(ci.when(s.firstRed.date), "2026-10-13 21:16 UTC");
  assert.match(s.firstRed.title, /Riverlight/);
  assert.equal(s.lastGreen.sha, "d48e605b");
  assert.equal(s.latest.sha, "be620e1a");
  assert.equal(s.exhausted, false);
});

test("a green newest run is GREEN with no streak, whatever lies behind it", function () {
  var s = ci.summarize([{ conclusion: "success", headSha: "47b8d5bdxxxx", createdAt: "2026-10-19T17:27:09Z", displayTitle: "fix", databaseId: 1 }].concat(fx.runs));
  assert.equal(s.status, "green");
  assert.equal(s.streak, 0);
  assert.equal(s.latest.sha, "47b8d5bd");
  assert.equal(s.firstRed, null);
});

test("a run without a verdict (in progress, cancelled, skipped) is not a verdict either way", function () {
  var noise = [{ status: "in_progress", conclusion: "", headSha: "ffffffff", createdAt: "2026-10-19T18:00:00Z" }, { conclusion: "cancelled", headSha: "eeeeeeee" }, { conclusion: "skipped", headSha: "dddddddd" }];
  var s = ci.summarize(noise.concat(fx.runs));
  assert.equal(s.status, "red");
  assert.equal(s.streak, 69);
  assert.equal(s.latest.sha, "be620e1a");
  assert.equal(ci.summarize(noise).status, "unknown");
});

test("a window with no green at all says so (the streak is at least the window), never a made-up last green", function () {
  var s = ci.summarize(fx.runs.slice(0, 20));
  assert.equal(s.status, "red");
  assert.equal(s.streak, 20);
  assert.equal(s.exhausted, true);
  assert.equal(s.lastGreen, null);
  assert.match(ci.describe(s), /no green run among the 20 listed/);
});

test("nothing to read is UNKNOWN with a reason, and a non-array is refused the same way", function () {
  assert.equal(ci.summarize([]).status, "unknown");
  assert.match(ci.summarize([]).reason, /no runs/);
  assert.equal(ci.summarize(null).status, "unknown");
});

test("gh failure is UNKNOWN, never green — a blind signal must not look like a passing one", function () {
  var s = ci.inspect({ force: true, run: function () { var e = new Error("spawn gh ENOENT"); e.code = "ENOENT"; throw e; } });
  assert.equal(s.status, "unknown");
  assert.match(s.reason, /ENOENT/);
  assert.match(ci.describe(s), /^CI UNKNOWN — Engine tests on master could not be read: /);
  var bad = ci.inspect({ force: true, run: function () { return "not a list"; } });
  assert.equal(bad.status, "unknown");
});

test("a red verdict reads the newest red run's jobs and names the failing steps", function () {
  var calls = [];
  var s = ci.inspect({ force: true, run: function (args) {
    calls.push(args.slice(0, 2).join(" "));
    if (args[1] === "list") return fx.runs;
    assert.equal(args[2], String(fx.runs[0].databaseId), "the newest red run is the one viewed");
    return { jobs: [{ name: "test", steps: [{ name: "Chrome check", conclusion: "success" }, { name: "Blueprint editions in a real browser", conclusion: "failure" }] }] };
  } });
  assert.deepEqual(calls, ["run list", "run view"]);
  assert.deepEqual(s.steps, ["Blueprint editions in a real browser"]);
  var line = ci.describe(s);
  assert.match(line, /^CI RED — Engine tests on master has failed 69 runs in a row since 2026-10-13 21:16 UTC \(4ee2aab5 /);
  assert.match(line, /last green d48e605b/);
  assert.match(line, /newest red be620e1a failed at: Blueprint editions in a real browser/);
  assert.match(line, /Deploys do not wait on CI/);
});

test("a green verdict asks nothing more of gh and says where it is green", function () {
  var calls = 0;
  var s = ci.inspect({ force: true, run: function () { calls++; return [{ conclusion: "success", headSha: "d2d341b4abcd", createdAt: "2026-10-19T17:29:35Z", displayTitle: "docs", databaseId: 9 }]; } });
  assert.equal(calls, 1);
  assert.equal(ci.describe(s), "CI GREEN — Engine tests passed on master at d2d341b4 (2026-10-19 17:29 UTC)");
});

test("TND_CI_STATUS=off skips the probe and prints nothing; the CLI's --fixture ignores it", function () {
  var env = Object.assign({}, process.env, { TND_CI_STATUS: "off" });
  var r = cp.spawnSync(process.execPath, [path.join(__dirname, "ci-status.js"), "--fixture", FIXTURE], { cwd: ROOT, encoding: "utf8", env: env });
  assert.equal(r.status, 1, "red exits 1: " + r.stdout + r.stderr);
  assert.match(r.stdout, /^CI RED — Engine tests on master has failed 69 runs/);
  delete process.env.TND_CI_STATUS_FIXTURE;
  process.env.TND_CI_STATUS = "off";
  try { assert.equal(ci.inspect({}).status, "off"); assert.equal(ci.describe(ci.inspect({})), null); }
  finally { delete process.env.TND_CI_STATUS; }
});

test("session-check relays a red CI as a finding at session start, and says nothing about CI when the probe is off", function () {
  var session = path.join(__dirname, "session-check.js");
  var red = cp.spawnSync(process.execPath, [session, "--root", ROOT], { cwd: ROOT, encoding: "utf8", env: Object.assign({}, process.env, { TND_CI_STATUS_FIXTURE: FIXTURE, TND_CI_STATUS: "" }) });
  assert.equal(red.status, 0, "warn-only: exit 0");
  assert.match(red.stderr, /SESSION CHECK ADVISORY/);
  assert.match(red.stderr, /CI RED — Engine tests on master has failed 69 runs in a row since 2026-10-13 21:16 UTC \(4ee2aab5 /);
  assert.match(red.stderr, /failed at: Blueprint editions in a real browser/, "the fixture's steps ride the line");
  var off = cp.spawnSync(process.execPath, [session, "--root", ROOT], { cwd: ROOT, encoding: "utf8", env: Object.assign({}, process.env, { TND_CI_STATUS: "off", TND_CI_STATUS_FIXTURE: "" }) });
  assert.equal(off.status, 0);
  assert.doesNotMatch(off.stdout + off.stderr, /CI (RED|GREEN|UNKNOWN)/);
});

test("the fixture is the real history: 80 runs, newest first, the dates descend", function () {
  assert.equal(fx.runs.length, 80);
  for (var i = 1; i < fx.runs.length; i++) assert.ok(fx.runs[i - 1].createdAt > fx.runs[i].createdAt, "run " + i + " is older than the one before it");
  assert.deepEqual(fx.steps, ["Blueprint editions in a real browser"]);
});

if (!process.exitCode) console.log("ALL GREEN — " + passed + " #646 CI status assertions");
