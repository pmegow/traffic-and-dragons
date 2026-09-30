#!/usr/bin/env node
// check-identity.js — the git identity tripwire (2026-08-16; #481 G6 moved it out of the hook's inline shell so CI runs it too).
// A leaked fixture `git config user.*` once misattributed 39 real commits to 'Forensics Fixture <forensics@example.invalid>'.
//   node dev/check-identity.js                the committer about to commit (git config user.name / user.email) — the hook
//   node dev/check-identity.js --ci RANGE     every commit's AUTHOR and COMMITTER in BASE..HEAD — CI, which also sees commits
//                                             made with no hook at all (cloud sessions); an empty RANGE checks nothing, and says so
// A fixture-looking identity: "Fixture" / "fixture" anywhere, or an address ending in .invalid (example.invalid included).
"use strict";
var cp = require("child_process");
function looksLikeFixture(name, email) { var s = String(name || "") + "|" + String(email || ""); return /[Ff]ixture/.test(s) || /\.invalid$/.test(s) || /example\.invalid/.test(s); }
function git(args) { try { return cp.execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim(); } catch (e) { return null; } }
function restoreHint() { return "Restore it:  git config user.name pmegow ; git config user.email pmegow@gmail.com"; }
if (require.main === module) {
  var argv = process.argv.slice(2), ci = argv.indexOf("--ci");
  if (ci < 0) {
    var name = git(["config", "user.name"]) || "", email = git(["config", "user.email"]) || "";
    if (looksLikeFixture(name, email)) {
      console.error("Commit blocked: git identity looks like a TEST FIXTURE (" + name + " <" + email + ">).");
      console.error("A fixture config write leaked into the real repo (the #27 env-leak class).");
      console.error(restoreHint());
      process.exit(1);
    }
    process.exit(0);
  }
  var range = argv[ci + 1] || "";
  if (!range) { console.log("[check-identity] no range (ci-range found no base) — nothing to check"); process.exit(0); }
  var log = git(["log", "--format=%H%x09%an%x09%ae%x09%cn%x09%ce", range]);
  if (log === null) { console.error("[check-identity] the range " + range + " is not readable here — nothing was checked"); process.exit(1); }
  var bad = log.split(/\r?\n/).filter(Boolean).map(function (l) { return l.split("\t"); }).filter(function (f) { return looksLikeFixture(f[1], f[2]) || looksLikeFixture(f[3], f[4]); });
  if (bad.length) {
    bad.forEach(function (f) { console.error("✗ " + f[0].slice(0, 7) + " was made by a TEST FIXTURE identity — author " + f[1] + " <" + f[2] + ">, committer " + f[3] + " <" + f[4] + ">"); });
    console.error("A fixture config write leaked into a real commit (the #27 env-leak class). Re-author those commits. " + restoreHint());
    process.exit(1);
  }
  console.log("✓ check-identity: no test-fixture identity in " + range);
}
module.exports = { looksLikeFixture: looksLikeFixture };
