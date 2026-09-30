#!/usr/bin/env node
// ci-range.js — #481 G2 (audit 2026-09-29, Fable-approved with changes): the ONE range a CI run checks, computed at one
// boundary. Every range gate used to diff HEAD~1..HEAD, so a code commit pushed under a docs commit skipped the version-bump
// check, the tracker check and the mutation proofs. The base, in Fable's order:
//   a pull request   → its base.sha (when reachable)
//   a push           → the merge-base of event.before and HEAD, when before is non-zero and reachable (a force push is fine)
//   otherwise        → the merge-base with origin/master
//   otherwise        → HEAD~1
// A base equal to HEAD (an empty range) never counts; the ladder goes on. No base at all = the initial commit.
//   node dev/ci-range.js                 print "CI range: BASE..HEAD (why, N commits)"
//   node dev/ci-range.js --github-env    also append CI_RANGE=BASE..HEAD to $GITHUB_ENV (the workflow's one range)
//   node dev/ci-range.js --print-base    print only the base sha (the test seam)
// Reads GITHUB_EVENT_NAME and the event payload at GITHUB_EVENT_PATH.
"use strict";
var cp = require("child_process"), fs = require("fs");
var ZERO = /^0+$/;
function makeGit(cwd) {
  return function (args) {
    try { return cp.execFileSync("git", args, { cwd: cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim(); }
    catch (e) { return null; }
  };
}
function commitOf(git, rev) { return rev ? git(["rev-parse", "--verify", "--quiet", rev + "^{commit}"]) : null; }
// ciBase(ev, git) → {base, head, why}. Pure over the git reader (the tests drive it through the CLI on fixture repos).
function ciBase(ev, git) {
  var head = commitOf(git, "HEAD"), p = (ev && ev.payload) || {}, name = ev && ev.name;
  if (!head) return { base: null, head: null, why: "no HEAD" };
  function usable(rev) { return rev && rev !== head ? rev : null; }
  if (name === "pull_request" && p.pull_request && p.pull_request.base) {
    var pb = usable(commitOf(git, p.pull_request.base.sha));
    if (pb) return { base: pb, head: head, why: "pull request base.sha" };
  }
  if (name === "push" && p.before && !ZERO.test(String(p.before))) {
    var before = commitOf(git, p.before), mb = before ? usable(git(["merge-base", before, head])) : null;
    if (mb) return { base: mb, head: head, why: "push: merge-base with event.before" };
  }
  var om = commitOf(git, "origin/master"), omb = om ? usable(git(["merge-base", om, head])) : null;
  if (omb) return { base: omb, head: head, why: "merge-base with origin/master" };
  var p1 = commitOf(git, "HEAD~1");
  if (p1) return { base: p1, head: head, why: "HEAD~1" };
  return { base: null, head: head, why: "the initial commit — no parent to compare" };
}
function readEvent() {
  var name = process.env.GITHUB_EVENT_NAME || "", payload = {}, file = process.env.GITHUB_EVENT_PATH;
  if (file) {
    try { payload = JSON.parse(fs.readFileSync(file, "utf8")); }
    catch (e) { console.warn("[ci-range] the event payload at " + file + " is unreadable (" + ((e && e.message) || e) + ") — using the fallbacks"); }
  }
  return { name: name, payload: payload };
}
if (require.main === module) {
  var git = makeGit(process.cwd()), r = ciBase(readEvent(), git), argv = process.argv.slice(2);
  if (argv.indexOf("--print-base") >= 0) { console.log(r.base || ""); process.exit(0); }
  var range = r.base ? r.base + ".." + r.head : "";
  var n = r.base ? (git(["rev-list", "--count", range]) || "?") : "0";
  console.log("CI range: " + (range || "(none)") + " — " + r.why + ", " + n + " commit(s)");
  if (argv.indexOf("--github-env") >= 0) {
    if (!process.env.GITHUB_ENV) { console.error("[ci-range] --github-env needs $GITHUB_ENV (this is a CI step)"); process.exit(1); }
    fs.appendFileSync(process.env.GITHUB_ENV, "CI_RANGE=" + range + "\n");
  }
}
module.exports = { ciBase: ciBase };
