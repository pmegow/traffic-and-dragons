#!/usr/bin/env node
"use strict";

// Retained anomaly fixtures for file-forensics.js. Everything lives in a
// disposable repository; the real project and its tracked files are read-only.
const fs = require("fs");
const os = require("os");
const path = require("path");
const cp = require("child_process");

const source = path.join(__dirname, "file-forensics.js");
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "tnd-forensics-"));
const dev = path.join(scratch, "dev");
fs.mkdirSync(dev);
fs.copyFileSync(source, path.join(dev, "file-forensics.js"));

function git(args) {
  const r = cp.spawnSync("git", args, { cwd: scratch, encoding: "utf8" });
  if (r.status !== 0) throw new Error((r.stderr || r.stdout || "git failed").trim());
}

git(["init", "--quiet"]);
git(["config", "user.name", "Forensics Fixture"]);
git(["config", "user.email", "forensics@example.invalid"]);

function run(name, options) {
  const target = path.join(scratch, name);
  const env = Object.assign({}, process.env, options && options.env);
  return cp.spawnSync(process.execPath, [path.join(dev, "file-forensics.js"), target], {
    cwd: scratch,
    env: env,
    encoding: "utf8"
  });
}

function old(name, bytes) {
  const target = path.join(scratch, name);
  fs.writeFileSync(target, bytes);
  const prior = new Date(Date.now() - 180000);
  fs.utimesSync(target, prior, prior);
  return target;
}

let passed = 0;
function expect(label, result, status, phrase) {
  const output = (result.stdout || "") + (result.stderr || "");
  if (result.status !== status || output.indexOf(phrase) < 0) {
    throw new Error(label + " — status " + result.status + ", expected " + status +
      "; missing " + JSON.stringify(phrase) + "\n" + output);
  }
  console.log("PASS " + label);
  passed++;
}

try {
  expect("missing file", run("missing.txt"), 1, "file does not exist");

  old("zero.txt", Buffer.alloc(0));
  expect("zero-byte file", run("zero.txt"), 1, "ZERO BYTES");

  old("bom.txt", Buffer.from([0xef, 0xbb, 0xbf, 0x6f, 0x6b, 0x0a]));
  expect("UTF-8 BOM", run("bom.txt"), 1, "UTF-8 BOM");

  old("mixed.txt", "one\r\ntwo\n");
  expect("mixed line endings", run("mixed.txt"), 1, "mixed line endings");

  old("invalid.js", "var broken = ;\n");
  expect("invalid JavaScript", run("invalid.js"), 1, "not valid JavaScript");

  old("untracked.txt", "not recoverable\n");
  expect("untracked file", run("untracked.txt"), 1, "NOT tracked by git");

  old("swap.txt", "tracked content\n");
  fs.writeFileSync(path.join(scratch, "swap.txt.crswap"), "interrupted");
  git(["add", "swap.txt"]);
  git(["commit", "--quiet", "-m", "track swap target"]);
  old("swap.txt", "tracked content\n");
  expect("Chrome swap sibling", run("swap.txt"), 1, "in-place write was interrupted");
  fs.unlinkSync(path.join(scratch, "swap.txt.crswap"));

  old("locked.txt", "tracked content\n");
  git(["add", "locked.txt"]);
  git(["commit", "--quiet", "-m", "track lock target"]);
  old("locked.txt", "tracked content\n");
  expect("write lock", run("locked.txt", { env: { TND_FORENSICS_OPEN_ERROR: "EBUSY" } }), 1,
    "cannot be opened for writing right now: EBUSY");

  old("clean.txt", "healthy tracked file\n");
  git(["add", "clean.txt"]);
  git(["commit", "--quiet", "-m", "track clean target"]);
  old("clean.txt", "healthy tracked file\n");
  expect("controlled clean file", run("clean.txt"), 0, "nothing anomalous");

  console.log("ALL GREEN — " + passed + " file-forensics fixtures");
} finally {
  fs.rmSync(scratch, { recursive: true, force: true });
}
