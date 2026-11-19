// dev/suite-shards.js — ONE long suite run as several processes at once (2026-11-18). One job: a suite whose groups
// each build their own state hands every n-th group to its own process, and the parent proves nothing was dropped.
// The atlas engine suite took 42 s alone and was the floor of every commit's test run once the suites ran side by side.
//
// The suite's side (three lines; dev/tests-684-atlas-engine.js is the first user):
//   var SHARD = shards.arg(process.argv);                 null, or { k, n } from `--shard k/n`
//   count every group as it is met (seen++), and skip it unless shards.mine(SHARD, seen - 1)
//   at the end: if (SHARD) console.log(shards.line(SHARD, ran, seen));
// The parent's side: shards.runParent(file, n, done) starts `node file --shard k/n` for k = 0..n-1, prints each one's
// output whole and in shard order, and hands done({ ok, total, why: [reasons] }).
//
// WHAT THE PARENT REFUSES (each is red, with the reason — a split that quietly ran less would be a gate that lies):
//   a shard that exits non-zero or cannot be started · a shard that never says its count (it died before its end) ·
//   shards that disagree on how many groups the file has · counts that do not add up to that number.
var cp = require("child_process");
var os = require("os");

var LINE = /^SHARD (\d+)\/(\d+) ran (\d+) of (\d+)$/m;

function arg(argv) {
  var i = argv.indexOf("--shard");
  if (i < 0) return null;
  var m = /^(\d+)\/(\d+)$/.exec(String(argv[i + 1] || ""));
  if (!m || Number(m[2]) < 1 || Number(m[1]) >= Number(m[2])) throw new Error("--shard wants k/n with 0 <= k < n, got: " + argv[i + 1]);
  return { k: Number(m[1]), n: Number(m[2]) };
}

// mine — does the group at this ordinal (0-based, in file order) belong to the shard? No shard: every group does.
function mine(shard, ordinal) { return !shard || ordinal % shard.n === shard.k; }

function line(shard, ran, seen) { return "SHARD " + shard.k + "/" + shard.n + " ran " + ran + " of " + seen; }

// count — how many processes: the environment variable named, else half the cores, at most `most`. 1 = no split.
function count(env, name, most, cores) {
  if (env[name]) {
    if (!/^\d+$/.test(env[name]) || Number(env[name]) < 1) throw new Error(name + " is not a number of at least 1: " + env[name]);
    return Number(env[name]);
  }
  return Math.min(most, Math.max(1, Math.floor((cores || os.cpus().length) / 2)));
}

// judge — pure: the shards' results ({ status, out }) to { ok, total, why }.
function judge(results) {
  var why = [], totals = [], ran = 0;
  results.forEach(function (r, k) {
    var name = "shard " + k + "/" + results.length;
    if (r.status !== 0) why.push(name + " failed (exit " + r.status + ")");
    var m = LINE.exec(r.out);
    if (!m) { why.push(name + " never said its count — it ended before its last line"); return; }
    if (Number(m[1]) !== k || Number(m[2]) !== results.length) why.push(name + " answered as shard " + m[1] + "/" + m[2]);
    ran += Number(m[3]);
    totals.push(Number(m[4]));
  });
  var total = totals.length ? totals[0] : 0;
  if (totals.some(function (t) { return t !== total; })) why.push("the shards disagree on how many groups the file has: " + totals.join(", "));
  else if (totals.length === results.length && ran !== total) why.push("the shards ran " + ran + " of the file's " + total + " groups");
  if (totals.length === results.length && total === 0) why.push("the file has no groups — nothing ran");
  return { ok: !why.length, total: total, ran: ran, why: why };
}

function runParent(file, n, done, extraArgs) {
  var results = new Array(n), left = n;
  function start(k) {
    var out = [], err = [], over = false;
    function end(status) {
      if (over) return; over = true;
      results[k] = { status: status, out: out.join(""), err: err.join("") };
      if (--left) return;
      results.forEach(function (r) { process.stdout.write(r.out); process.stderr.write(r.err); });
      var verdict = judge(results);
      verdict.why.forEach(function (w) { console.error("SHARDS RED — " + w); });
      done(verdict);
    }
    var child = cp.spawn(process.execPath, [file, "--shard", k + "/" + n].concat(extraArgs || []), { env: process.env });
    child.stdout.setEncoding("utf8"); child.stderr.setEncoding("utf8");
    child.stdout.on("data", function (d) { out.push(d); });
    child.stderr.on("data", function (d) { err.push(d); });
    child.on("error", function (e) { err.push("could not start shard " + k + ": " + e.message + "\n"); end(-1); });
    child.on("close", function (code, signal) { end(code === null ? "signal " + signal : code); });
  }
  for (var k = 0; k < n; k++) start(k);
}

module.exports = { arg: arg, mine: mine, line: line, count: count, judge: judge, runParent: runParent };
