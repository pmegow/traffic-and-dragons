#!/usr/bin/env node
"use strict";

// Starts the validated local writer when needed, then opens the editor from that same origin.
// The browser cannot launch Node or safely overwrite a OneDrive file itself; this is the narrow
// desktop boundary that turns every editor Save/Add/Update action into the direct server path.
var cp = require("child_process");
var http = require("http");
var path = require("path");
var EDITOR_VERSION = require("./bible-editor-version.js");

var ROOT = path.join(__dirname, "..");
var EDITOR_URL = "http://127.0.0.1:7373/bible_editor.html";
var HEALTH = { host: "127.0.0.1", port: 7373, path: "/health", timeout: 500 };

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
      done(res.statusCode === 200 && ours && j.version === EDITOR_VERSION,
        ours ? (j.version || "unversioned") : null);
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

function staleHelper(foundVersion) {
  console.error("Bible Editor helper is v" + foundVersion + ", but this launcher is v" +
    EDITOR_VERSION + ". Close the old helper, then run Bible Editor.cmd again.");
  process.exitCode = 1;
}

function waitForServer(attempt) {
  isHealthy(function (ok, foundVersion) {
    if (ok) { openEditor(); return; }
    if (foundVersion !== null) { staleHelper(foundVersion); return; }
    if (attempt >= 30) {
      console.error("Bible Editor helper did not start. Port 7373 may belong to another program.");
      process.exitCode = 1;
      return;
    }
    setTimeout(function () { waitForServer(attempt + 1); }, 100);
  });
}

isHealthy(function (ok, foundVersion) {
  if (ok) { openEditor(); return; }
  if (foundVersion !== null) { staleHelper(foundVersion); return; }
  var helper = cp.spawn(process.execPath, [path.join(__dirname, "bible-server.js")], {
    cwd: ROOT,
    detached: true,
    stdio: "ignore",
    windowsHide: true
  });
  helper.on("error", function (e) {
    console.error("Could not start the Bible Editor helper: " + e.message);
    process.exitCode = 1;
  });
  helper.unref();
  waitForServer(0);
});
