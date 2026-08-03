#!/usr/bin/env node
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

function stagedText(root, file) {
  return git(root, ["show", ":" + file]);
}

function headText(root, file) {
  return git(root, ["show", "HEAD:" + file]);
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

function stagedFiles(root) {
  return git(root, ["diff", "--cached", "--name-only", "-z"]).split("\0").filter(Boolean).map(function (file) {
    return file.replace(/\\/g, "/");
  });
}

function fail(changed, missing) {
  console.error("Shell marker guard: staged shell assets changed:");
  changed.forEach(function (file) { console.error("  - " + file); });
  console.error("");
  console.error("Commit blocked. Bump the following staged marker" + (missing.length === 1 ? "" : "s") + " from HEAD:");
  missing.forEach(function (item) {
    console.error("  - " + item.file + ": " + item.name + " (HEAD and staged are both " + item.value + ")");
  });
  console.error("Both globals.js APP_VERSION and sw.js CACHE must change whenever a shell asset changes.");
  process.exit(1);
}

function main() {
  var root = repoRoot();
  var files;
  var shell;
  var changed;
  var stagedGlobals;
  var stagedSw;
  var markers;
  var missing;

  if (!hasHead(root)) return;
  files = stagedFiles(root);
  if (!files.length) return;

  stagedSw = stagedText(root, "sw.js");
  shell = new Set(parseShellAssets(stagedSw));
  changed = files.filter(function (file) { return file === "sw.js" || shell.has(file); });
  if (!changed.length) return;

  stagedGlobals = stagedText(root, "globals.js");
  markers = [
    {file: "globals.js", name: "APP_VERSION", staged: marker(stagedGlobals, "APP_VERSION", "staged globals.js"), head: marker(headText(root, "globals.js"), "APP_VERSION", "HEAD globals.js")},
    {file: "sw.js", name: "CACHE", staged: marker(stagedSw, "CACHE", "staged sw.js"), head: marker(headText(root, "sw.js"), "CACHE", "HEAD sw.js")}
  ];
  missing = markers.filter(function (item) { return item.staged === item.head; }).map(function (item) {
    return {file: item.file, name: item.name, value: item.staged};
  });
  if (missing.length) fail(changed, missing);
}

try {
  main();
} catch (err) {
  console.error("Shell marker guard failed: " + err.message);
  process.exit(1);
}
