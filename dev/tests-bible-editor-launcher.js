#!/usr/bin/env node
"use strict";

// The supported authoring route is one launcher -> one localhost server -> the real editor.
// These fixtures never POST and never touch either live bible; they only prove the launcher
// exists and the helper serves the editor's allow-listed assets from a disposable port.
const cp = require("child_process");
const fs = require("fs");
const http = require("http");
const net = require("net");
const os = require("os");
const path = require("path");

const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
function verdict(ok, name, detail) {
  if (ok) { pass++; console.log("PASS " + name); }
  else { fail++; console.error("FAIL " + name + (detail ? " — " + detail : "")); }
}
function get(port, pathname) {
  return new Promise((resolve, reject) => {
    const req = http.get({ host: "127.0.0.1", port: port, path: pathname }, res => {
      let body = "";
      res.setEncoding("utf8");
      res.on("data", chunk => { body += chunk; });
      res.on("end", () => resolve({ status: res.statusCode, body: body, headers: res.headers }));
    });
    req.on("error", reject);
  });
}
function post(port, pathname, headers, body) {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: "127.0.0.1", port: port, path: pathname,
      method: "POST", headers: headers }, res => {
      let responseBody = "";
      res.setEncoding("utf8");
      res.on("data", chunk => { responseBody += chunk; });
      res.on("end", () => resolve({ status: res.statusCode, body: responseBody }));
    });
    req.on("error", reject);
    req.end(body || "");
  });
}
function waitForPort(child) {
  return new Promise((resolve, reject) => {
    let out = "", done = false;
    const timer = setTimeout(() => { if (!done) reject(new Error("server did not announce its port\n" + out)); }, 10000);
    child.stdout.setEncoding("utf8");
    child.stdout.on("data", chunk => {
      out += chunk;
      const m = out.match(/listening on http:\/\/127\.0\.0\.1:(\d+)/);
      if (m && !done) { done = true; clearTimeout(timer); resolve(+m[1]); }
    });
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", chunk => { out += chunk; });
    child.on("exit", code => { if (!done) { done = true; clearTimeout(timer); reject(new Error("server exited " + code + "\n" + out)); } });
  });
}
function freePort() {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.on("error", reject);
    probe.listen(0, "127.0.0.1", () => {
      const port = probe.address().port;
      probe.close(err => err ? reject(err) : resolve(port));
    });
  });
}
function runLauncher(port, pidFile) {
  return new Promise((resolve, reject) => {
    const child = cp.spawn(process.execPath, [path.join(__dirname, "launch-bible-editor.js")], {
      cwd: ROOT,
      env: Object.assign({}, process.env, {
        BIBLE_PORT: String(port), BIBLE_LAUNCH_NO_OPEN: "1", BIBLE_LAUNCH_PID_FILE: pidFile
      }),
      stdio: ["ignore", "pipe", "pipe"], windowsHide: true
    });
    let out = "";
    child.stdout.on("data", chunk => { out += chunk; });
    child.stderr.on("data", chunk => { out += chunk; });
    const timer = setTimeout(() => { child.kill(); reject(new Error("launcher did not exit\n" + out)); }, 10000);
    child.on("error", reject);
    child.on("exit", code => { clearTimeout(timer); resolve({ code: code, output: out }); });
  });
}
function listeningPid(port) {
  if (process.platform !== "win32") return null;
  const netstat = cp.spawnSync("netstat", ["-ano"], { encoding: "utf8" });
  const re = new RegExp("127\\.0\\.0\\.1:" + port + "\\s+0\\.0\\.0\\.0:0\\s+LISTENING\\s+(\\d+)", "i");
  const m = String(netstat.stdout || "").match(re);
  return m ? Number(m[1]) : null;
}

(async function () {
  const cmdPath = path.join(ROOT, "Bible Editor.cmd");
  const launchPath = path.join(__dirname, "launch-bible-editor.js");
  const editorPath = path.join(ROOT, "bible_editor.html");
  const versionPath = path.join(__dirname, "bible-editor-version.js");
  let editorVersion = null;
  verdict(fs.existsSync(cmdPath), "project-root Bible Editor.cmd exists");
  verdict(fs.existsSync(launchPath), "launcher implementation exists in dev/");
  verdict(fs.existsSync(versionPath), "shared Bible Editor version registry exists");
  if (fs.existsSync(versionPath)) {
    delete require.cache[require.resolve(versionPath)];
    editorVersion = require(versionPath);
    verdict(/^\d+\.\d+\.\d+$/.test(editorVersion), "Bible Editor version has a visible semver shape");
  }
  if (fs.existsSync(editorPath)) {
    const editorSrc = fs.readFileSync(editorPath, "utf8");
    const writerGateMatch = editorSrc.match(/\/\/ >>> WRITER GATE([\s\S]*?)\/\/ <<< WRITER GATE/);
    let writerOriginOK = null;
    if (writerGateMatch) {
      try { writerOriginOK = new Function(writerGateMatch[1] + "\nreturn writerOriginOK;")(); }
      catch (ignore) {}
    }
    verdict(typeof writerOriginOK === "function" &&
        writerOriginOK({ protocol: "file:", hostname: "" }) === false &&
        writerOriginOK({ protocol: "http:", hostname: "127.0.0.1" }) === true &&
        writerOriginOK({ protocol: "http:", hostname: "localhost" }) === true &&
        writerOriginOK({ protocol: "https:", hostname: "example.com" }) === false,
      "file pages stay read-only even while the helper is healthy");
    const capabilitySave = editorSrc.slice(editorSrc.indexOf("function updateShippedCapability"),
      editorSrc.indexOf("// ── toolbar"));
    verdict(capabilitySave.indexOf("legacyDownloadFlow") < 0 &&
        capabilitySave.indexOf("URL.createObjectURL") < 0 &&
        !/a\.download\s*=/.test(capabilitySave),
      "Add/Update Bible can never download a recovery copy");
    verdict(capabilitySave.indexOf("local project writer is unavailable") >= 0 &&
        capabilitySave.indexOf("nothing was written; your values are still in the form") >= 0,
      "local writer failure stays loud and preserves the capability form");
    verdict(capabilitySave.indexOf("if (!projectWriteReady())") >= 0 &&
        capabilitySave.indexOf("if (!projectWriteReady())") < capabilitySave.indexOf('fetch(BSRV + "/bible")'),
      "capability writes refuse read-only pages before the first fetch");
    const capabilityForm = editorSrc.slice(editorSrc.indexOf("function capForm"),
      editorSrc.indexOf("function closeModal"));
    verdict(capabilityForm.indexOf("syncWriterControls();") >= 0,
      "read-only mode disables capability form write controls");
    verdict(editorSrc.indexOf("function srvToken") < 0 &&
        editorSrc.indexOf("X-Bible-Token") < 0 &&
        editorSrc.indexOf("bible-server write token") < 0,
      "Bible editor never asks the user for a write token");
    verdict(editorSrc.indexOf('id="editor-version"') >= 0 &&
        editorSrc.indexOf('dev/bible-editor-version.js') >= 0,
      "Bible Editor renders the shared version in its header");
    verdict(editorSrc.indexOf('X-Bible-Editor-Version') >= 0,
      "Bible Editor sends its version on every install request");
    const writerStatus = editorSrc.slice(editorSrc.indexOf("function srvPill"),
      editorSrc.indexOf("function fileLine"));
    verdict(writerStatus.indexOf("online") < 0 && writerStatus.indexOf("offline") < 0 &&
        writerStatus.indexOf("local project writer ready") >= 0 &&
        writerStatus.indexOf("local project writer unavailable") >= 0,
      "editor describes one local project-file workflow, not online and offline modes");
    verdict(writerStatus.indexOf("Editor in READ ONLY MODE. Launch via Bible Editor.cmd to edit") >= 0,
      "unavailable writer shows the exact read-only launch instruction");
    verdict(editorSrc.indexOf('id="saveas"') < 0 && editorSrc.indexOf('$("saveas")') < 0,
      "toolbar exposes no alternate Save as workflow");
  }
  if (fs.existsSync(cmdPath)) {
    verdict(/dev\\launch-bible-editor\.js/i.test(fs.readFileSync(cmdPath, "utf8")),
      "cmd routes through the launcher", "expected dev\\launch-bible-editor.js");
  }
  if (fs.existsSync(launchPath)) {
    const src = fs.readFileSync(launchPath, "utf8");
    verdict(src.indexOf('var PORT = process.env.BIBLE_PORT') >= 0 &&
        src.indexOf('"http://127.0.0.1:" + PORT + "/bible_editor.html"') >= 0,
      "launcher opens the server-hosted editor");
    verdict(src.indexOf('require("./bible-editor-version.js")') >= 0 &&
        src.indexOf("j.version === EDITOR_VERSION") >= 0,
      "launcher refuses a stale helper version");
  }

  const child = cp.spawn(process.execPath, [path.join(__dirname, "bible-server.js")], {
    cwd: ROOT,
    env: Object.assign({}, process.env, { BIBLE_PORT: "0" }),
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true
  });
  try {
    const port = await waitForPort(child);
    const health = await get(port, "/health");
    verdict(health.status === 200 && /\"ok\":true/.test(health.body), "launcher server health route is live");
    let healthJson = {};
    try { healthJson = JSON.parse(health.body); } catch (ignore) {}
    verdict(healthJson.version === editorVersion, "helper reports the shared Bible Editor version");
    const editor = await get(port, "/bible_editor.html");
    verdict(editor.status === 200 && /<title>Bible Editor/.test(editor.body),
      "launcher server serves bible_editor.html", "status=" + editor.status);
    const cap = await get(port, "/capability_bible.js?fresh=fixture");
    verdict(cap.status === 200 && /var CAPABILITY_BIBLE\s*=/.test(cap.body),
      "launcher server serves editor dependencies", "status=" + cap.status);
    const versionAsset = await get(port, "/dev/bible-editor-version.js?fresh=fixture");
    verdict(versionAsset.status === 200 && /module\.exports/.test(versionAsset.body),
      "launcher server serves the shared version registry", "status=" + versionAsset.status);
    const mismatch = await post(port, "/install", {
      "Content-Type": "text/plain",
      "Origin": "http://127.0.0.1:" + port,
      "X-Bible-Editor-Version": "0.0.0"
    }, "synthetic mismatch — must be refused before parsing");
    verdict(mismatch.status === 409 && /version/i.test(mismatch.body),
      "helper refuses a stale served editor before reading its upload", "status=" + mismatch.status);
    const refused = await get(port, "/../CLAUDE.md");
    verdict(refused.status === 404, "launcher server refuses non-editor files", "status=" + refused.status);
  } catch (e) {
    verdict(false, "launcher server starts on a disposable port", e.message);
  } finally {
    child.kill();
  }

  const launchPort = await freePort();
  const pidFile = path.join(os.tmpdir(), "tnd-bible-launcher-fixture-" + process.pid + ".pid");
  let helperPid = null;
  try {
    try { fs.unlinkSync(pidFile); } catch (ignore) {}
    const launched = await runLauncher(launchPort, pidFile);
    verdict(launched.code === 0 && launched.output.indexOf("Bible Editor ready:") >= 0,
      "real launcher starts the local writer and exits cleanly", launched.output.trim());
    const launchedHealth = await get(launchPort, "/health");
    verdict(launchedHealth.status === 200 && /\"ok\":true/.test(launchedHealth.body),
      "launcher-started writer survives after the launcher exits");
    helperPid = fs.existsSync(pidFile) ? Number(fs.readFileSync(pidFile, "utf8")) : null;
    verdict(Number.isInteger(helperPid) && helperPid > 0,
      "launcher exposes its helper PID to the lifecycle fixture only");
  } catch (e) {
    verdict(false, "real launcher lifecycle fixture completes", e.message);
  } finally {
    if (!helperPid) helperPid = listeningPid(launchPort);
    if (helperPid) { try { process.kill(helperPid); } catch (ignore) {} }
    try { fs.unlinkSync(pidFile); } catch (ignore) {}
  }

  if (fail) {
    console.error("BIBLE EDITOR LAUNCHER: " + fail + " failed, " + pass + " passed");
    process.exit(1);
  }
  console.log("ALL GREEN — " + pass + " Bible editor launcher fixtures");
})().catch(e => { console.error("BIBLE EDITOR LAUNCHER CRASH: " + e.stack); process.exit(1); });
