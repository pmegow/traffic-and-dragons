#!/usr/bin/env node
"use strict";

// The supported authoring route is one launcher -> one localhost server -> the real editor.
// These fixtures never POST and never touch either live bible; they only prove the launcher
// exists and the helper serves the editor's allow-listed assets from a disposable port.
const cp = require("child_process");
const fs = require("fs");
const http = require("http");
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

(async function () {
  const cmdPath = path.join(ROOT, "Bible Editor.cmd");
  const launchPath = path.join(__dirname, "launch-bible-editor.js");
  const editorPath = path.join(ROOT, "bible_editor.html");
  verdict(fs.existsSync(cmdPath), "project-root Bible Editor.cmd exists");
  verdict(fs.existsSync(launchPath), "launcher implementation exists in dev/");
  if (fs.existsSync(editorPath)) {
    const editorSrc = fs.readFileSync(editorPath, "utf8");
    verdict(!/alert\("Downloaded capability_bible\.js/.test(editorSrc),
      "offline recovery does not block on a redundant install alert");
    verdict(/if \(_srvUp !== true\) \{\s*h \+= CUR\.handle/.test(editorSrc),
      "online status does not contradict itself with a download warning");
  }
  if (fs.existsSync(cmdPath)) {
    verdict(/dev\\launch-bible-editor\.js/i.test(fs.readFileSync(cmdPath, "utf8")),
      "cmd routes through the launcher", "expected dev\\launch-bible-editor.js");
  }
  if (fs.existsSync(launchPath)) {
    const src = fs.readFileSync(launchPath, "utf8");
    verdict(src.indexOf("http://127.0.0.1:7373/bible_editor.html") >= 0,
      "launcher opens the server-hosted editor");
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
    const editor = await get(port, "/bible_editor.html");
    verdict(editor.status === 200 && /<title>Bible Editor/.test(editor.body),
      "launcher server serves bible_editor.html", "status=" + editor.status);
    const cap = await get(port, "/capability_bible.js?fresh=fixture");
    verdict(cap.status === 200 && /var CAPABILITY_BIBLE\s*=/.test(cap.body),
      "launcher server serves editor dependencies", "status=" + cap.status);
    const refused = await get(port, "/../CLAUDE.md");
    verdict(refused.status === 404, "launcher server refuses non-editor files", "status=" + refused.status);
  } catch (e) {
    verdict(false, "launcher server starts on a disposable port", e.message);
  } finally {
    child.kill();
  }

  if (fail) {
    console.error("BIBLE EDITOR LAUNCHER: " + fail + " failed, " + pass + " passed");
    process.exit(1);
  }
  console.log("ALL GREEN — " + pass + " Bible editor launcher fixtures");
})().catch(e => { console.error("BIBLE EDITOR LAUNCHER CRASH: " + e.stack); process.exit(1); });
