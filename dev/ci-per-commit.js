#!/usr/bin/env node
// ci-per-commit.js — #481 G2: run ONE gate once per commit of a range (oldest first, merges skipped), so a code commit pushed
// under a docs commit is checked on its own. The gate stays named in the workflow line (check-enforcement's coverage pin reads
// the tool names there); this only walks the commits.
//   node dev/ci-per-commit.js BASE..HEAD -- <command> [args...]
// Placeholders in the args, per commit:
//   {commit} {parent}          the commit and its first parent
//   {file:PATH}                PATH as it is AT the commit, written to a temp file
//   {parentFile:PATH}          PATH as it is at the parent
// A commit where a needed file is absent (or the root commit, for {parent}) is SKIPPED, out loud. The first failing commit
// stops the run and is named. An EMPTY range (ci-range found no base: the initial commit) checks nothing, and says so.
"use strict";
var cp = require("child_process"), fs = require("fs"), os = require("os"), path = require("path");
function git(args) { return cp.execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }); }
function tryGit(args) { try { return git(args); } catch (e) { return null; } }
var argv = process.argv.slice(2), sep = argv.indexOf("--");
if (sep !== 1 || sep + 1 >= argv.length) { console.error("usage: node dev/ci-per-commit.js BASE..HEAD -- <command> [args...]   (the range may be \"\")"); process.exit(2); }
var range = argv[0];
if (!range) { console.log("[ci-per-commit] no range (ci-range found no base — the initial commit?) — nothing to check"); process.exit(0); }
var cmd = argv[sep + 1], args = argv.slice(sep + 2), label = path.basename(String(args[0] || cmd));
var list = tryGit(["rev-list", "--reverse", "--no-merges", range]);
if (list === null) { console.error("[ci-per-commit] the range " + range + " is not readable here — nothing was checked"); process.exit(1); }
var commits = list.split(/\r?\n/).filter(Boolean);
if (!commits.length) { console.log("[ci-per-commit] " + label + ": no commits in " + range + " — nothing to check"); process.exit(0); }
var tmp = fs.mkdtempSync(path.join(os.tmpdir(), "tnd-per-commit-")), checked = 0, skipped = 0;
function subject(c) { return (tryGit(["log", "-1", "--format=%s", c]) || "").trim(); }
try {
  for (var i = 0; i < commits.length; i++) {
    var c = commits[i], short = c.slice(0, 7), parent = (tryGit(["rev-parse", "--verify", "--quiet", c + "^"]) || "").trim(), missing = null, n = 0;
    var real = args.map(function (a) {
      return String(a).replace(/\{(commit|parent|file:[^}]+|parentFile:[^}]+)\}/g, function (all, key) {
        if (key === "commit") return c;
        if (key === "parent") { if (!parent) missing = "no parent (the root commit)"; return parent; }
        var at = key.indexOf("file:") === 0 ? c : parent, p = key.slice(key.indexOf(":") + 1);
        if (!at) { missing = "no parent for " + p; return ""; }
        var text = tryGit(["show", at + ":" + p]);
        if (text === null) { missing = p + " absent at " + (at === c ? short : at.slice(0, 7)); return ""; }
        var f = path.join(tmp, short + "-" + (n++) + "-" + path.basename(p)); fs.writeFileSync(f, text); return f;
      });
    });
    if (missing) { skipped++; console.log("[ci-per-commit] skip " + label + " @ " + short + ": " + missing); continue; }
    console.log("[ci-per-commit] " + label + " @ " + short + " " + subject(c));
    var r = cp.spawnSync(cmd, real, { stdio: "inherit" });
    if (r.status !== 0) { console.error("✗ " + label + " failed at " + short + " \"" + subject(c) + "\" (" + range + ")"); process.exit(1); }
    checked++;
  }
} finally { try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (e) { console.warn("[ci-per-commit] could not remove " + tmp + ": " + e.message); } }
console.log("✓ " + label + ": " + checked + " commit(s) checked" + (skipped ? ", " + skipped + " skipped" : "") + " in " + range);
