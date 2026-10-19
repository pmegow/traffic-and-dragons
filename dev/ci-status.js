// dev/ci-status.js — THE CI verdict for a session's start (#646, 2026-10-19). Reads the "Engine tests"
// workflow's recent runs on master through the GitHub CLI and says, in one line, whether the gate is
// green, how long it has been red and where the red began. Deploys never wait on CI here (Cloudflare
// Pages is deliberately independent), so a red gate is invisible unless something says it out loud:
// 69 consecutive red runs went unseen between 2026-10-13 and 2026-10-19 — the origin of this file.
//
//   node dev/ci-status.js                 one line and an exit code: 0 green, 1 red, 2 unknown
//   node dev/ci-status.js --json          the summary object
//   node dev/ci-status.js --fixture F     read {runs, steps} from a JSON file instead of gh (tests)
//
// session-check.js relays inspect() at every session start (warn-only; a red or an unreadable CI is a
// finding there). TND_CI_STATUS=off skips the probe entirely (the hygiene fixtures run session-check
// many times and must not hit the network); TND_CI_STATUS_FIXTURE=<file> is the env form of --fixture.
// summarize(runs) is pure and is what the tests and the sabotage battery exercise.
var fs = require("fs");
var cp = require("child_process");

var WORKFLOW = "Engine tests";
var BRANCH = "master";
var LIMIT = 100;
var FIELDS = "conclusion,headSha,createdAt,databaseId,displayTitle";
var TIMEOUT_MS = 20000;

function brief(r) {
  return { sha: String(r.headSha || "").slice(0, 8), date: r.createdAt || "", title: String(r.displayTitle || ""), id: r.databaseId };
}

// summarize — runs newest first, as `gh run list` prints them. Only a run that reached a verdict
// (success / failure) counts; in-progress, cancelled and skipped runs are not a verdict either way.
function summarize(runs) {
  if (!(runs instanceof Array)) return { status: "unknown", reason: "the run list is not an array" };
  var done = runs.filter(function (r) { return r && (r.conclusion === "success" || r.conclusion === "failure"); });
  if (!done.length) return { status: "unknown", reason: runs.length ? "none of the " + runs.length + " listed runs has a verdict yet" : "no runs listed" };
  var latest = brief(done[0]);
  if (done[0].conclusion === "success") return { status: "green", latest: latest, streak: 0, firstRed: null, lastGreen: latest, exhausted: false, window: done.length };
  var i = 0;
  while (i < done.length && done[i].conclusion === "failure") i++;
  return { status: "red", latest: latest, streak: i, firstRed: brief(done[i - 1]), lastGreen: i < done.length ? brief(done[i]) : null, exhausted: i >= done.length, window: done.length };
}

function failingSteps(view) {
  var out = [];
  (((view || {}).jobs) || []).forEach(function (job) {
    (job.steps || []).forEach(function (step) { if (step.conclusion === "failure") out.push(step.name); });
  });
  return out;
}

function gh(args) {
  var r = cp.spawnSync("gh", args, { encoding: "utf8", timeout: TIMEOUT_MS, windowsHide: true });
  if (r.error) throw new Error("gh could not run (" + (r.error.code || r.error.message) + ") — install the GitHub CLI and run `gh auth login`");
  if (r.status !== 0) throw new Error("gh " + args.slice(0, 2).join(" ") + " failed: " + (String(r.stderr || r.stdout || "").trim().split(/\r?\n/)[0] || "exit " + r.status));
  try { return JSON.parse(r.stdout); } catch (e) { throw new Error("gh " + args.slice(0, 2).join(" ") + " returned no JSON"); }
}

// inspect — never throws: every failure to read CI is an "unknown" with its reason, because a blind
// signal that looks green is the exact failure this file exists to end.
function inspect(opts) {
  opts = opts || {};
  if (process.env.TND_CI_STATUS === "off" && !opts.force) return { status: "off" };
  var fixture = opts.fixture || process.env.TND_CI_STATUS_FIXTURE || null;
  var run = opts.run || gh;
  var runs, steps = [], s;
  try {
    if (fixture) {
      var fx = JSON.parse(fs.readFileSync(fixture, "utf8"));
      runs = fx.runs; steps = fx.steps || [];
    } else {
      runs = run(["run", "list", "--workflow", WORKFLOW, "--branch", BRANCH, "--limit", String(opts.limit || LIMIT), "--json", FIELDS]);
    }
  } catch (e) { return { status: "unknown", reason: e.message, workflow: WORKFLOW, branch: BRANCH }; }
  s = summarize(runs);
  if (s.status === "red" && !fixture && s.latest.id != null) {
    try { steps = failingSteps(run(["run", "view", String(s.latest.id), "--json", "jobs"])); }
    catch (e2) { s.stepsError = e2.message; }
  }
  s.steps = steps; s.workflow = WORKFLOW; s.branch = BRANCH;
  return s;
}

function when(iso) {
  var m = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/.exec(iso || "");
  return m ? m[1] + " " + m[2] + " UTC" : "(no date)";
}

function describe(s) {
  if (!s || s.status === "off") return null;
  if (s.status === "unknown") return "CI UNKNOWN — " + WORKFLOW + " on " + BRANCH + " could not be read: " + s.reason;
  if (s.status === "green") return "CI GREEN — " + WORKFLOW + " passed on " + BRANCH + " at " + s.latest.sha + " (" + when(s.latest.date) + ")";
  var line = "CI RED — " + WORKFLOW + " on " + BRANCH + " has failed " + s.streak + " run" + (s.streak === 1 ? "" : "s") + " in a row since " + when(s.firstRed.date) + " (" + s.firstRed.sha + " " + s.firstRed.title + ")";
  line += s.lastGreen ? "; last green " + s.lastGreen.sha : "; no green run among the " + s.window + " listed";
  if (s.steps && s.steps.length) line += "; newest red " + s.latest.sha + " failed at: " + s.steps.join(", ");
  else if (s.stepsError) line += "; the failing step could not be read (" + s.stepsError + ")";
  return line + ". Deploys do not wait on CI — the gate is blind until this is fixed.";
}

function main(argv) {
  var opts = {}, json = false;
  for (var i = 0; i < argv.length; i++) {
    if (argv[i] === "--json") json = true;
    else if (argv[i] === "--fixture" && argv[i + 1]) opts.fixture = argv[++i];
    else if (argv[i] === "--limit" && argv[i + 1]) opts.limit = Number(argv[++i]);
    else { console.error("unknown argument: " + argv[i]); process.exit(2); }
  }
  opts.force = true;
  var s = inspect(opts);
  if (json) console.log(JSON.stringify(s, null, 2)); else console.log(describe(s));
  process.exit(s.status === "green" ? 0 : s.status === "red" ? 1 : 2);
}

if (require.main === module) main(process.argv.slice(2));
module.exports = { summarize: summarize, failingSteps: failingSteps, inspect: inspect, describe: describe, when: when, WORKFLOW: WORKFLOW, BRANCH: BRANCH };
