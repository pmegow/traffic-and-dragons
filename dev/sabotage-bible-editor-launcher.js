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
  "dev/bible-editor-version.js",
  "dev/launch-bible-editor.js",
  "dev/tests-bible-editor-launcher.js"
];
const cases = [
  {
    label: "capability download fallback is reintroduced",
    file: "bible_editor.html",
    mustFail: "Add/Update Bible can never download a recovery copy",
    find: "  function updateShippedCapability(key, obj, onDone, allowCreate) {",
    replace: "  function updateShippedCapability(key, obj, onDone, allowCreate) {\n    function legacyDownloadFlow() { var a = document.createElement(\"a\"); a.download = \"capability_bible.js\"; a.click(); }"
  },
  {
    label: "local writer failure becomes silent",
    file: "bible_editor.html",
    mustFail: "local writer failure stays loud and preserves the capability form",
    find: 'm = "local project writer is unavailable — reopen this editor with Bible Editor.cmd";\n      note("✗ Update Bible failed:',
    replace: 'm = "save failed";\n      note("✗ Update Bible failed:'
  },
  {
    label: "write-token prompt returns to the Bible editor",
    file: "bible_editor.html",
    mustFail: "Bible editor never asks the user for a write token",
    find: "  function srvInstall(body) {",
    replace: "  function srvToken() { return prompt(\"bible-server write token\"); }\n  function srvInstall(body) {"
  },
  {
    label: "shared version loses its visible semver shape",
    file: "dev/bible-editor-version.js",
    mustFail: "Bible Editor version has a visible semver shape",
    find: 'var BIBLE_EDITOR_VERSION = "1.1.0";',
    replace: 'var BIBLE_EDITOR_VERSION = "unknown";'
  },
  {
    label: "version label disappears from the editor header",
    file: "bible_editor.html",
    mustFail: "Bible Editor renders the shared version in its header",
    find: ' <span class="editor-version" id="editor-version"></span>',
    replace: ""
  },
  {
    label: "editor stops identifying its version on writes",
    file: "bible_editor.html",
    mustFail: "Bible Editor sends its version on every install request",
    find: '"X-Bible-Editor-Version": BIBLE_EDITOR_VERSION',
    replace: '"X-Removed-Version": BIBLE_EDITOR_VERSION'
  },
  {
    label: "helper stops reporting its version",
    file: "dev/bible-server.js",
    mustFail: "helper reports the shared Bible Editor version",
    find: 'version: EDITOR_VERSION,',
    replace: 'version: "unknown",'
  },
  {
    label: "helper accepts a stale served editor",
    file: "dev/bible-server.js",
    mustFail: "helper refuses a stale served editor before reading its upload",
    find: 'if (servedOrigin && req.headers["x-bible-editor-version"] !== EDITOR_VERSION) {',
    replace: 'if (false) {'
  },
  {
    label: "launcher reuses a stale helper",
    file: "dev/launch-bible-editor.js",
    mustFail: "launcher refuses a stale helper version",
    find: 'j.version === EDITOR_VERSION',
    replace: 'true'
  },
  {
    label: "online/offline mode language returns",
    file: "bible_editor.html",
    mustFail: "editor describes one local project-file workflow, not online and offline modes",
    find: "● local project writer ready — saves update this checkout",
    replace: "● online save mode ready"
  },
  {
    label: "Save as alternate workflow returns",
    file: "bible_editor.html",
    mustFail: "toolbar exposes no alternate Save as workflow",
    find: '  <button id="reload">',
    replace: '  <button id="saveas">Save as</button>\n  <button id="reload">'
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
    find: '"http://127.0.0.1:" + PORT + "/bible_editor.html"',
    replace: "file:///bible_editor.html"
  },
  {
    label: "launcher health check ignores its configured port",
    file: "dev/launch-bible-editor.js",
    mustFail: "real launcher starts the local writer and exits cleanly",
    find: 'port: PORT, path: "/health"',
    replace: 'port: 7373, path: "/health"'
  },
  {
    label: "launcher lifecycle fixture loses the helper PID receipt",
    file: "dev/launch-bible-editor.js",
    mustFail: "launcher exposes its helper PID to the lifecycle fixture only",
    find: 'fs.writeFileSync(process.env.BIBLE_LAUNCH_PID_FILE, String(helper.pid))',
    replace: 'void helper.pid'
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
