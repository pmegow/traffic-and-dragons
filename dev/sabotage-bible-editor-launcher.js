#!/usr/bin/env node
"use strict";

// Proves the supported editor entrypoint stays one click, server-backed, and non-blocking.
// Every mutation runs in a disposable clone; neither live bible is read through the API or written.
const cp = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const WORKING_FILES = [
  "Bible Editor.cmd",
  "bible_editor.html",
  "dev/bible-server.js",
  "dev/launch-bible-editor.js",
  "dev/tests-bible-editor-launcher.js"
];
const cases = [
  {
    label: "offline recovery alert is reintroduced",
    file: "bible_editor.html",
    mustFail: "offline recovery does not block on a redundant install alert",
    find: "        if (onDone) onDone();",
    replace: "        alert(\"Downloaded capability_bible.js; install it manually.\");\n        if (onDone) onDone();"
  },
  {
    label: "write-token prompt returns to the Bible editor",
    file: "bible_editor.html",
    mustFail: "Bible editor never asks the user for a write token",
    find: "  function srvInstall(body) {",
    replace: "  function srvToken() { return prompt(\"bible-server write token\"); }\n  function srvInstall(body) {"
  },
  {
    label: "online status claims Save will download",
    file: "bible_editor.html",
    mustFail: "online status does not contradict itself with a download warning",
    find: "    if (_srvUp !== true) {\n      h += CUR.handle",
    replace: "    if (true) {\n      h += CUR.handle"
  },
  {
    label: "root shortcut bypasses the launcher",
    file: "Bible Editor.cmd",
    mustFail: "cmd routes through the launcher",
    find: "node dev\\launch-bible-editor.js",
    replace: "node dev\\bible-server.js"
  },
  {
    label: "launcher returns to a file URL",
    file: "dev/launch-bible-editor.js",
    mustFail: "launcher opens the server-hosted editor",
    find: "http://127.0.0.1:7373/bible_editor.html",
    replace: "file:///bible_editor.html"
  },
  {
    label: "server stops serving the editor",
    file: "dev/bible-server.js",
    mustFail: "launcher server serves bible_editor.html",
    find: '  "/bible_editor.html": "bible_editor.html",\n',
    replace: ""
  },
  {
    label: "server drops a required editor dependency",
    file: "dev/bible-server.js",
    mustFail: "launcher server serves editor dependencies",
    find: '  "/capability_bible.js": "capability_bible.js",\n',
    replace: ""
  }
];

function combined(run) { return String(run.stdout || "") + String(run.stderr || ""); }
function copyWorking(scratch) {
  WORKING_FILES.forEach(function (rel) {
    var to = path.join(scratch, rel);
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.copyFileSync(path.join(ROOT, rel), to);
  });
}

var scratch = fs.mkdtempSync(path.join(os.tmpdir(), "tnd-bible-launcher-sabotage-"));
var failed = 0;
try {
  var clone = cp.spawnSync("git", ["-c", "safe.directory=" + ROOT,
    "-c", "safe.directory=" + path.join(ROOT, ".git"),
    "clone", "--quiet", "--no-hardlinks", ROOT, scratch], { encoding: "utf8" });
  if (clone.status !== 0) throw new Error("scratch clone failed: " + combined(clone));
  copyWorking(scratch);

  cases.forEach(function (c) {
    var target = path.join(scratch, c.file);
    var original = fs.readFileSync(target, "utf8");
    var changed = original.replace(c.find, c.replace);
    if (changed === original) {
      failed++;
      console.error("FAIL NOT-APPLIED " + c.label);
      return;
    }
    fs.writeFileSync(target, changed, "utf8");
    var run = cp.spawnSync(process.execPath, ["dev/tests-bible-editor-launcher.js"], {
      cwd: scratch, encoding: "utf8"
    });
    fs.writeFileSync(target, original, "utf8");
    var intact = fs.readFileSync(target, "utf8") === original;
    var out = combined(run);
    if (run.status === 0 || out.indexOf(c.mustFail) < 0 || !intact) {
      failed++;
      console.error("FAIL " + (run.status === 0 ? "MISSED" : "MISATTRIBUTED") + " " + c.label +
        " — expected " + JSON.stringify(c.mustFail) + "; restored=" + intact);
    } else {
      console.log("PASS caught " + c.label + " — " + c.mustFail + "; restored byte-identical");
    }
  });
} finally {
  fs.rmSync(scratch, { recursive: true, force: true });
}

if (failed) {
  console.error("BIBLE EDITOR LAUNCHER SABOTAGE: " + failed + " failure(s), " +
    (cases.length - failed) + "/" + cases.length + " proven");
  process.exit(1);
}
console.log("ALL GREEN — " + cases.length + "/" + cases.length +
  " Bible editor launcher clauses mutation-proven");
