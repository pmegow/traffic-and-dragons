#!/usr/bin/env node
"use strict";

// Starts the validated local writer when needed, then opens the editor from that same origin.
// The browser cannot launch Node or safely overwrite a OneDrive file itself; this is the narrow
// desktop boundary that turns every editor Save/Add/Update action into the direct server path.
var cp = require("child_process");
var crypto = require("crypto");
var fs = require("fs");
var http = require("http");
var path = require("path");
var HELPER_VERSION = require("./bible-helper-version.js");

var ROOT = path.join(__dirname, "..");
var PORT = process.env.BIBLE_PORT === undefined ? 7373 : Number(process.env.BIBLE_PORT);
var EDITOR_URL = "http://127.0.0.1:" + PORT + "/bible_editor.html";
var HEALTH = { host: "127.0.0.1", port: PORT, path: "/health", timeout: 500 };
var SERVER_SCRIPT = path.join(__dirname, "bible-server.js");

function isHealthy(done) {
  var settled = false;
  var req = http.get(HEALTH, function (res) {
    var body = "";
    res.setEncoding("utf8");
    res.on("data", function (c) { body += c; });
    res.on("end", function () {
      if (settled) return;
      settled = true;
      var j = null;
      try { j = JSON.parse(body); } catch (ignore) {}
      var ours = !!(j && j.server === "bible-server");
      done(res.statusCode === 200 && ours && j.helperVersion === HELPER_VERSION,
        ours ? { helperVersion: j.helperVersion || "legacy", editorVersion: j.version || "unversioned",
          pid: Number(j.pid) || null, root: j.root || null } : null);
    });
  });
  req.on("timeout", function () { req.destroy(); });
  req.on("error", function () { if (!settled) { settled = true; done(false, null); } });
}

function openEditor() {
  if (process.env.BIBLE_LAUNCH_NO_OPEN === "1") {
    console.log("Bible Editor ready: " + EDITOR_URL);
    return;
  }
  var opener = cp.spawn(process.env.ComSpec || "cmd.exe",
    ["/d", "/s", "/c", "start", "", EDITOR_URL],
    { cwd: ROOT, detached: true, stdio: "ignore", windowsHide: true });
  opener.on("error", function (e) {
    console.error("Could not open the Bible Editor: " + e.message + "\nOpen " + EDITOR_URL + " manually.");
    process.exitCode = 1;
  });
  opener.unref();
}

function listeningPid(done) {
  if (process.platform !== "win32") { done(new Error("automatic helper replacement is currently Windows-only")); return; }
  cp.execFile("netstat", ["-ano"], { windowsHide: true }, function (err, stdout) {
    if (err) { done(new Error("could not inspect port " + PORT + ": " + err.message)); return; }
    var lines = String(stdout || "").split(/\r?\n/), i, m;
    var re = new RegExp("^\\s*TCP\\s+127\\.0\\.0\\.1:" + PORT + "\\s+[^\\s]+\\s+LISTENING\\s+(\\d+)\\s*$", "i");
    for (i = 0; i < lines.length; i++) {
      m = lines[i].match(re);
      if (m) { done(null, Number(m[1])); return; }
    }
    done(new Error("could not identify the process listening on 127.0.0.1:" + PORT));
  });
}

function processExecutable(pid, done) {
  var winRoot = process.env.SystemRoot || "C:\\Windows";
  var ps = path.join(winRoot, "System32", "WindowsPowerShell", "v1.0", "powershell.exe");
  var query = "(Get-Process -Id " + pid + " -ErrorAction Stop).Path";
  cp.execFile(ps, ["-NoProfile", "-NonInteractive", "-Command", query], { windowsHide: true }, function (err, stdout) {
    if (err) { done(new Error("could not verify helper process " + pid + ": " + err.message)); return; }
    var executable = String(stdout || "").trim();
    if (!executable) { done(new Error("helper process " + pid + " exposed no executable path")); return; }
    done(null, executable);
  });
}

function verifyLegacyCheckout(done) {
  var localHash;
  try { localHash = crypto.createHash("sha256").update(fs.readFileSync(path.join(ROOT, "capability_bible.js"))).digest("hex"); }
  catch (e) { done(new Error("could not hash this checkout's capability_bible.js: " + e.message)); return; }
  var settled = false, chunks = [], size = 0;
  var req = http.get({ host: "127.0.0.1", port: PORT,
    path: "/capability_bible.js?ownership=" + Date.now(), timeout: 500 }, function (res) {
    res.on("data", function (chunk) {
      size += chunk.length;
      if (size > 5e6) { req.destroy(new Error("legacy ownership asset exceeded 5 MB")); return; }
      chunks.push(chunk);
    });
    res.on("end", function () {
      if (settled) return;
      settled = true;
      var servedHash = crypto.createHash("sha256").update(Buffer.concat(chunks)).digest("hex");
      if (res.statusCode !== 200 || servedHash !== localHash) {
        done(new Error("refused to stop the legacy helper because its served capability bible does not match this checkout"));
        return;
      }
      done();
    });
  });
  req.on("timeout", function () { req.destroy(new Error("legacy ownership check timed out")); });
  req.on("error", function (e) { if (!settled) { settled = true; done(e); } });
}

function waitForStopped(attempt, done) {
  isHealthy(function (ok, found) {
    if (found === null) { done(); return; }
    if (attempt >= 30) { done(new Error("stale helper did not release port " + PORT)); return; }
    setTimeout(function () { waitForStopped(attempt + 1, done); }, 100);
  });
}

function stopVerifiedStaleHelper(found, done) {
  listeningPid(function (pidErr, pid) {
    if (pidErr) { done(pidErr); return; }
    processExecutable(pid, function (exeErr, executable) {
      if (exeErr) { done(exeErr); return; }
      if (path.resolve(executable).toLowerCase() !== path.resolve(process.execPath).toLowerCase()) {
        done(new Error("refused to stop PID " + pid + " on port " + PORT +
          " because it is not running this launcher's Node executable"));
        return;
      }
      var verifyOwnership = function (next) {
        if (found.pid || found.root) {
          if (found.pid !== pid || !found.root || path.resolve(found.root).toLowerCase() !== path.resolve(ROOT).toLowerCase()) {
            next(new Error("refused to stop PID " + pid + " on port " + PORT +
              " because its health receipt does not identify this checkout"));
            return;
          }
          next();
          return;
        }
        verifyLegacyCheckout(next);
      };
      verifyOwnership(function (ownershipErr) {
        if (ownershipErr) { done(ownershipErr); return; }
        try { process.kill(pid); }
        catch (e) { done(new Error("could not stop verified stale helper PID " + pid + ": " + e.message)); return; }
        console.log("Retired stale helper protocol v" + found.helperVersion + " (PID " + pid +
          "); starting v" + HELPER_VERSION + ".");
        waitForStopped(0, done);
      });
    });
  });
}

function staleHelper(found, reason) {
  console.error("Bible Editor found helper protocol v" + found.helperVersion + " but needs v" +
    HELPER_VERSION + ". " + reason);
  process.exitCode = 1;
}

function waitForServer(attempt) {
  isHealthy(function (ok, found) {
    if (ok) { openEditor(); return; }
    if (found !== null) { staleHelper(found, "The replacement helper did not start cleanly."); return; }
    if (attempt >= 30) {
      console.error("Bible Editor helper did not start. Port " + PORT + " may belong to another program.");
      process.exitCode = 1;
      return;
    }
    setTimeout(function () { waitForServer(attempt + 1); }, 100);
  });
}

function startHelper() {
  var helper = cp.spawn(process.execPath, [SERVER_SCRIPT], {
    cwd: ROOT,
    detached: true,
    stdio: "ignore",
    windowsHide: true
  });
  helper.on("error", function (e) {
    console.error("Could not start the Bible Editor helper: " + e.message);
    process.exitCode = 1;
  });
  // Test-only lifecycle receipt. Production launchers never set this variable; it lets the
  // disposable fixture stop the detached helper after proving it survives this process.
  if (process.env.BIBLE_LAUNCH_PID_FILE) {
    try { fs.writeFileSync(process.env.BIBLE_LAUNCH_PID_FILE, String(helper.pid)); }
    catch (e) {
      console.error("Could not record the Bible Editor helper PID: " + e.message);
      try { helper.kill(); } catch (ignore) {}
      process.exitCode = 1;
      return;
    }
  }
  helper.unref();
  waitForServer(0);
}

isHealthy(function (ok, found) {
  if (ok) { openEditor(); return; }
  if (found !== null) {
    stopVerifiedStaleHelper(found, function (err) {
      if (err) { staleHelper(found, err.message); return; }
      startHelper();
    });
    return;
  }
  startHelper();
});
