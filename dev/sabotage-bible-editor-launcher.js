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
  "dev/bible-helper-version.js",
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
    find: 'var BIBLE_EDITOR_VERSION = "1.1.6";',
    replace: 'var BIBLE_EDITOR_VERSION = "unknown";'
  },
  {
    label: "helper protocol version loses its visible semver shape",
    file: "dev/bible-helper-version.js",
    mustFail: "Bible helper protocol version has a visible semver shape",
    find: 'var BIBLE_HELPER_VERSION = "1.0.1";',
    replace: 'var BIBLE_HELPER_VERSION = "unknown";'
  },
  {
    label: "file pages trust a healthy helper as write authority",
    file: "bible_editor.html",
    mustFail: "file pages stay read-only even while the helper is healthy",
    find: '    return p === "http:" && (h === "127.0.0.1" || h === "localhost");',
    replace: "    return true;"
  },
  {
    label: "version label disappears from the editor header",
    file: "bible_editor.html",
    mustFail: "Bible Editor renders the shared version in its header",
    find: ' <span class="editor-version" id="editor-version"></span>',
    replace: ""
  },
  {
    label: "editor stops identifying its helper protocol on writes",
    file: "bible_editor.html",
    mustFail: "Bible Editor sends the independent helper protocol version on every install request",
    find: '"X-Bible-Helper-Version": BIBLE_HELPER_VERSION',
    replace: '"X-Removed-Version": BIBLE_HELPER_VERSION'
  },
  {
    label: "helper stops reporting its protocol version",
    file: "dev/bible-server.js",
    mustFail: "helper reports its independent protocol version",
    find: 'helperVersion: HELPER_VERSION,',
    replace: 'helperVersion: "unknown",'
  },
  {
    label: "helper accepts a stale served editor",
    file: "dev/bible-server.js",
    mustFail: "helper refuses a stale served editor before reading its upload",
    find: 'if (servedOrigin && req.headers["x-bible-helper-version"] !== HELPER_VERSION) {',
    replace: 'if (false) {'
  },
  {
    label: "launcher reuses a stale helper",
    file: "dev/launch-bible-editor.js",
    mustFail: "launcher replaces a verified stale helper by protocol version, not UI version",
    find: 'j.helperVersion === HELPER_VERSION',
    replace: 'true'
  },
  {
    label: "launcher ties compatibility back to the UI version",
    file: "dev/launch-bible-editor.js",
    mustFail: "launcher replaces a verified stale helper by protocol version, not UI version",
    find: 'var HELPER_VERSION = require("./bible-helper-version.js");',
    replace: 'var HELPER_VERSION = require("./bible-editor-version.js");'
  },
  {
    label: "launcher loses checkout-root ownership verification",
    file: "dev/launch-bible-editor.js",
    mustFail: "launcher verifies port PID, checkout ownership, and Node executable before termination",
    find: "!found.root || path.resolve(found.root)",
    replace: "!found.checkout || path.resolve(found.checkout)"
  },
  {
    label: "launcher loses legacy checkout ownership verification",
    file: "dev/launch-bible-editor.js",
    mustFail: "launcher verifies port PID, checkout ownership, and Node executable before termination",
    find: "function verifyLegacyCheckout(done) {",
    replace: "function removedLegacyCheckoutVerification(done) {"
  },
  {
    label: "online/offline mode language returns",
    file: "bible_editor.html",
    mustFail: "editor describes one local project-file workflow, not online and offline modes",
    find: "● local project writer ready — saves update this checkout",
    replace: "● online save mode ready"
  },
  {
    label: "read-only launch instruction disappears",
    file: "bible_editor.html",
    mustFail: "unavailable writer shows the exact read-only launch instruction",
    find: "    if (_srvUp === false) return \" · <span style='color:var(--bad);font-weight:700' title='local project writer unavailable'>Editor in READ ONLY MODE. Launch via Bible Editor.cmd to edit.</span>\";",
    replace: "    if (_srvUp === false) return \" · <span style='color:var(--bad)'>Save unavailable</span>\";"
  },
  {
    label: "capability write reaches fetch from a read-only page",
    file: "bible_editor.html",
    mustFail: "capability writes refuse read-only pages before the first fetch",
    find: "    if (!projectWriteReady()) {\n      note(\"Editor in READ ONLY MODE. Launch via Bible Editor.cmd to edit. — nothing was written; your values are still in the form\");",
    replace: "    if (false) {\n      note(\"Editor in READ ONLY MODE. Launch via Bible Editor.cmd to edit. — nothing was written; your values are still in the form\");"
  },
  {
    label: "capability form leaves its write button enabled in read-only mode",
    file: "bible_editor.html",
    mustFail: "read-only mode disables capability form write controls",
    find: '    $("modal").style.display = "flex";\n    syncWriterControls();\n    $("cap-cost").onchange',
    replace: '    $("modal").style.display = "flex";\n    $("cap-cost").onchange'
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
  },
  {
    label: "server drops the helper protocol registry",
    file: "dev/bible-server.js",
    mustFail: "launcher server serves the helper protocol version registry",
    find: '  "/dev/bible-helper-version.js": "dev/bible-helper-version.js",\n',
    replace: ""
  }
];

if (process.env.TND_SABOTAGE_APPLICABILITY_ONLY === "1") {
  module.exports = cases;
} else {

function combined(run) { return String(run.stdout || "") + String(run.stderr || ""); }
function copyWorking(scratch) {
  WORKING_FILES.forEach(function (rel) {
    var to = path.join(scratch, rel);
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.copyFileSync(path.join(ROOT, rel), to);
  });
}

// Mutating lifecycle receipts can intentionally strand a disposable helper. Before deleting the
// clone, stop only listeners whose signed health response names this exact scratch root.
function stopScratchHelpers(scratchRoot) {
  if (process.platform !== "win32") return;
  const ps = path.join(process.env.SystemRoot || "C:\\Windows", "System32", "WindowsPowerShell", "v1.0", "powershell.exe");
  const quotedRoot = scratchRoot.replace(/'/g, "''");
  const script = "$target=[IO.Path]::GetFullPath('" + quotedRoot + "');" +
    "$listeners=netstat -ano | Select-String '^\\s*TCP\\s+127\\.0\\.0\\.1:(\\d+)\\s+0\\.0\\.0\\.0:0\\s+LISTENING\\s+(\\d+)\\s*$';" +
    "foreach($line in $listeners){$port=[int]$line.Matches[0].Groups[1].Value;$pidValue=[int]$line.Matches[0].Groups[2].Value;" +
    "try{$health=Invoke-RestMethod -Uri ('http://127.0.0.1:'+$port+'/health') -TimeoutSec 1;" +
    "if($health.server -eq 'bible-server' -and -not [string]::IsNullOrWhiteSpace([string]$health.root) -and " +
    "[IO.Path]::GetFullPath([string]$health.root).Equals($target,[StringComparison]::OrdinalIgnoreCase)){Stop-Process -Id $pidValue -Force}}catch{}};exit 0";
  const stopped = cp.spawnSync(ps, ["-NoProfile", "-NonInteractive", "-Command", script], { encoding: "utf8" });
  if (stopped.status !== 0) throw new Error("could not stop disposable scratch helpers: " + combined(stopped));
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
  stopScratchHelpers(scratch);
  fs.rmSync(scratch, { recursive: true, force: true, maxRetries: 20, retryDelay: 100 });
}

if (failed) {
  console.error("BIBLE EDITOR LAUNCHER SABOTAGE: " + failed + " failure(s), " +
    (cases.length - failed) + "/" + cases.length + " proven");
  process.exit(1);
}
console.log("ALL GREEN — " + cases.length + "/" + cases.length +
  " Bible editor launcher clauses mutation-proven");
}
