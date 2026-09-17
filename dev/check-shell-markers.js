#!/usr/bin/env node
// check-shell-markers.js — the APP_VERSION/CACHE freshness gate: if a staged (or pushed) change
// touches sw.js or any file in its APP_SHELL, globals.js APP_VERSION and sw.js CACHE must both
// differ from the baseline. That is the "bump on every code change" hard rule, mechanised.
//
// TWO MODES (the second added at audit G1, 2026-09-18 — this gate ran ONLY in the local hook,
// which --no-verify and any other machine bypass, so the hard rule had no unbypassable check):
//
//   node dev/check-shell-markers.js            STAGING AREA (pre-commit): the index vs HEAD.
//   node dev/check-shell-markers.js --ci       COMMIT RANGE: HEAD~1..HEAD, for the CI runner,
//                                              which has no index. Pass --range A..B (or
//                                              --range A B) to compare any two revisions.
//
// Range mode exits 0 and says so when the base revision does not exist (initial commit, or a
// checkout shallower than two commits) — there is nothing to compare, and a gate that cannot
// run must say it did not run rather than invent a verdict. On a merge commit HEAD~1 is the
// first parent, so `--ci` on a PR merge compares the whole PR against its base.
"use strict";

var childProcess = require("child_process");

function git(cwd, args) {
  return childProcess.execFileSync("git", args, {
    cwd: cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  });
}

function repoRoot() {
  return git(process.cwd(), ["rev-parse", "--show-toplevel"]).trim();
}

function hasHead(root) {
  try {
    git(root, ["rev-parse", "--verify", "HEAD"]);
    return true;
  } catch (err) {
    return false;
  }
}

function revText(root, rev, file) {
  return git(root, ["show", rev + ":" + file]);
}

function hasRev(root, rev) {
  try {
    git(root, ["rev-parse", "--verify", "--quiet", rev + "^{commit}"]);
    return true;
  } catch (err) {
    return false;
  }
}

// parseArgs — {mode:"staged"} by default; --ci/--range pick the commit-range mode.
function parseArgs(argv) {
  var opts = {mode: "staged", base: "HEAD~1", head: "HEAD"};
  for (var i = 0; i < argv.length; i++) {
    if (argv[i] === "--ci") opts.mode = "range";
    else if (argv[i] === "--range" && argv[i + 1]) {
      opts.mode = "range";
      var spec = argv[++i];
      if (spec.indexOf("..") > 0) { opts.base = spec.split("..")[0]; opts.head = spec.split("..")[1] || "HEAD"; }
      else { opts.base = spec; if (argv[i + 1] && String(argv[i + 1]).indexOf("--") !== 0) opts.head = argv[++i]; }
    } else throw new Error("unknown or incomplete argument: " + argv[i]);
  }
  if (!opts.base) throw new Error("--range needs a base revision");
  return opts;
}

function parseShellAssets(source) {
  var match = source.match(/\bvar\s+APP_SHELL\s*=\s*(\[[\s\S]*?\])\s*;/);
  var list;
  if (!match) throw new Error("could not find var APP_SHELL = [...] in staged sw.js");
  try {
    list = JSON.parse(match[1]);
  } catch (err) {
    throw new Error("could not parse staged sw.js APP_SHELL: " + err.message);
  }
  if (!Array.isArray(list) || list.some(function (item) { return typeof item !== "string"; })) {
    throw new Error("staged sw.js APP_SHELL must be an array of strings");
  }
  return list.map(function (asset) {
    var path = asset.split(/[?#]/)[0].replace(/^\.\//, "").replace(/^\/+/, "");
    if (!path) return "index.html";
    if (/\/$/.test(path)) return path + "index.html";
    return path.replace(/\\/g, "/");
  });
}

function marker(source, name, file) {
  var re = new RegExp("\\bvar\\s+" + name + "\\s*=\\s*[\\\"']([^\\\"']+)[\\\"']");
  var match = source.match(re);
  if (!match) throw new Error("could not find " + name + " in " + file);
  return match[1];
}

function changedFiles(root, opts) {
  var args = opts.mode === "range"
    ? ["diff", "--name-only", "-z", opts.base, opts.head]
    : ["diff", "--cached", "--name-only", "-z"];
  return git(root, args).split("\0").filter(Boolean).map(function (file) {
    return file.replace(/\\/g, "/");
  });
}

function fail(changed, missing, opts) {
  var side = opts.mode === "range" ? opts.head : "staged";
  var base = opts.mode === "range" ? opts.base : "HEAD";
  console.error("Shell marker guard: " + side + " shell assets changed:");
  changed.forEach(function (file) { console.error("  - " + file); });
  console.error("");
  console.error((opts.mode === "range" ? "Push rejected" : "Commit blocked") + ". Bump the following " + side + " marker" + (missing.length === 1 ? "" : "s") + " from " + base + ":");
  missing.forEach(function (item) {
    console.error("  - " + item.file + ": " + item.name + " (" + base + " and " + side + " are both " + item.value + ")");
  });
  console.error("Both globals.js APP_VERSION and sw.js CACHE must change whenever a shell asset changes.");
  process.exit(1);
}

function main() {
  var opts = parseArgs(process.argv.slice(2));
  var root = repoRoot();
  var files;
  var shell;
  var changed;
  var headRev;
  var baseRev;
  var headGlobals;
  var headSw;
  var markers;
  var missing;

  if (!hasHead(root)) return;
  if (opts.mode === "range") {
    // A gate that cannot run says so; it never invents a verdict (the vacuous-clause class).
    if (!hasRev(root, opts.base)) {
      console.log("Shell marker guard: base revision " + opts.base + " is not available (initial commit, or a shallow checkout) — nothing to compare.");
      return;
    }
    if (!hasRev(root, opts.head)) throw new Error("head revision " + opts.head + " does not exist");
  }
  headRev = opts.mode === "range" ? opts.head : ":";      // ":" = the index
  baseRev = opts.mode === "range" ? opts.base : "HEAD";

  files = changedFiles(root, opts);
  if (!files.length) return;

  headSw = headRev === ":" ? git(root, ["show", ":sw.js"]) : revText(root, headRev, "sw.js");
  shell = new Set(parseShellAssets(headSw));
  changed = files.filter(function (file) { return file === "sw.js" || shell.has(file); });
  if (!changed.length) return;

  headGlobals = headRev === ":" ? git(root, ["show", ":globals.js"]) : revText(root, headRev, "globals.js");
  markers = [
    {file: "globals.js", name: "APP_VERSION", head: marker(headGlobals, "APP_VERSION", headRev + " globals.js"), base: marker(revText(root, baseRev, "globals.js"), "APP_VERSION", baseRev + " globals.js")},
    {file: "sw.js", name: "CACHE", head: marker(headSw, "CACHE", headRev + " sw.js"), base: marker(revText(root, baseRev, "sw.js"), "CACHE", baseRev + " sw.js")}
  ];
  missing = markers.filter(function (item) { return item.head === item.base; }).map(function (item) {
    return {file: item.file, name: item.name, value: item.head};
  });
  if (missing.length) fail(changed, missing, opts);
}

try {
  main();
} catch (err) {
  console.error("Shell marker guard failed: " + err.message);
  process.exit(1);
}
