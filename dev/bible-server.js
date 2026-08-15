// bible-server.js — the one-command companion that makes "Add staged to bible" a single click.
//
// Why this exists: a file:// page cannot run install-bible.js itself, and FSA WRITES are refused
// on this machine (the v1.512-516 saga) — so the page's save flow ended in "download this, then
// run a command", which the user rightly called abysmal. This server closes the loop: the page
// GETs the current bible text and POSTs the composed result; the install still goes through
// dev/install-bible.js — the SAME validation gate (parse, entry count, lowercase keys, refuses
// empties) that has been the reliable path all along. Node writes the file; no browser file API
// is involved anywhere.
//
// Normal use: double-click `Bible Editor.cmd` in the project root. It starts this helper hidden
// and opens the editor FROM this server, so same-origin saves need no token or file-picker dance.
// Direct use remains available: node dev/bible-server.js
//
// Security posture: binds 127.0.0.1 only, writes only via install-bible.js (which decides the
// target from the file's own content). WRITE AUTH (#72 workflow overhaul, 2026-08-14): an
// ORIGIN allow-list replaces the token-paste for the standard flows — a request with no Origin
// header (curl/node: a local process, and loopback binding already restricts to this machine)
// or an Origin on http://localhost / http://127.0.0.1 (any port — the editor served locally;
// a drive-by webpage cannot forge these, the browser sets Origin) writes without ceremony.
// The per-run token SURVIVES as the fallback for Origin:null (file:// pages — but also
// sandboxed drive-by iframes, which is exactly why null cannot join the allow-list) and any
// foreign origin. Net: the token paste disappears from the recommended workflow entirely.
var http = require("http");
var fs = require("fs");
var path = require("path");
var os = require("os");
var crypto = require("crypto");
var execFile = require("child_process").execFile;

var ROOT = path.join(__dirname, "..");
var PORT = process.env.BIBLE_PORT === undefined ? 7373 : Number(process.env.BIBLE_PORT);
var TARGET = path.join(ROOT, "capability_bible.js");
var TOKEN = crypto.randomBytes(16).toString("hex");   // per-run write token — never persisted
var EDITOR_ASSETS = {
  "/": "bible_editor.html",
  "/bible_editor.html": "bible_editor.html",
  "/data.js": "data.js",
  "/capability_bible.js": "capability_bible.js",
  "/item_bible.js": "item_bible.js",
  "/helpers.js": "helpers.js",
  "/class_bible.js": "class_bible.js"
};
var MIME = { ".html": "text/html", ".js": "text/javascript" };
var CORS = {
  "Access-Control-Allow-Origin": "*",          // the pages run from file:// (Origin: null)
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-Bible-Token"
};

function serveEditorAsset(req, res) {
  var urlPath = decodeURIComponent(String(req.url || "/").split("?")[0]);
  var rel = EDITOR_ASSETS[urlPath];
  if (!rel) return false;
  fs.readFile(path.join(ROOT, rel), function (err, data) {
    if (err) { res.writeHead(404, { "Content-Type": "text/plain" }); res.end("not found"); return; }
    res.writeHead(200, {
      "Content-Type": MIME[path.extname(rel).toLowerCase()] || "application/octet-stream",
      "Cache-Control": "no-store"
    });
    res.end(data);
  });
  return true;
}

var server = http.createServer(function (req, res) {
  function send(code, obj) {
    var h = { "Content-Type": "application/json" }, k;
    for (k in CORS) h[k] = CORS[k];
    res.writeHead(code, h);
    res.end(JSON.stringify(obj));
  }
  if (req.method === "OPTIONS") { res.writeHead(204, CORS); res.end(); return; }

  if (req.method === "GET" && req.url === "/health") {
    // cheap liveness probe for the editor's status pill — never reads a file
    send(200, { ok: true, server: "bible-server", auth: "origin-allowlist (token only for file://)" });
    return;
  }

  if (req.method === "GET" && req.url === "/bible") {
    try { send(200, { ok: true, text: fs.readFileSync(TARGET, "utf8") }); }
    catch (e) { send(500, { ok: false, output: "could not read capability_bible.js: " + e.message }); }
    return;
  }

  if (req.method === "POST" && req.url === "/install") {
    // Write auth (refuse before reading the body): local-origin requests pass; everything else
    // needs this run's token. See the security-posture comment up top for the threat model.
    var origin = req.headers["origin"];
    var localOrigin = !origin || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
    if (!localOrigin && req.headers["x-bible-token"] !== TOKEN) {
      console.warn("[install] " + new Date().toLocaleTimeString() + " REFUSED — origin " + JSON.stringify(origin || null) + " is not local and no valid X-Bible-Token was sent");
      send(403, { ok: false, output: "write refused: this page's origin (" + (origin || "null") + ") is not localhost.\nOpen the project-root Bible Editor.cmd for direct saves. Legacy file:// tools may use the server token, but the Bible Editor never asks for one." });
      return;
    }
    var body = "";
    req.on("data", function (c) { body += c; if (body.length > 5e6) { req.destroy(); } });
    req.on("end", function () {
      var tmp = path.join(os.tmpdir(), "capability_bible_upload.js");
      try { fs.writeFileSync(tmp, body); }
      catch (e) { send(500, { ok: false, output: "could not stage the upload: " + e.message }); return; }
      // install-bible.js is THE gate: it validates (and refuses) before touching the tracked file
      execFile(process.execPath, [path.join(__dirname, "install-bible.js"), tmp], { timeout: 30000 },
        function (err, stdout, stderr) {
          var out = String(stdout || "") + String(stderr || "");
          console.log("[install] " + new Date().toLocaleTimeString() + (err ? " REFUSED" : " ok") + "\n" + out.trim() + "\n");
          send(err ? 422 : 200, { ok: !err, output: out });
        });
    });
    return;
  }

  if (req.method === "GET" && serveEditorAsset(req, res)) return;

  send(404, { ok: false, output: "unknown route (this server serves the Bible editor plus /bible and /install)" });
}).on("error", function (e) {
  // Loud, named failure instead of a raw stack (2026-08-02 field confusion): the common case is
  // a still-running older instance — which after the token change is ALSO a security problem,
  // because a pre-token server accepts unauthenticated writes.
  if (e.code === "EADDRINUSE") {
    console.error("");
    console.error("✗ port " + PORT + " is already in use — an older bible-server is still running.");
    console.error("  Find its terminal window and Ctrl+C it, or kill it by PID:");
    console.error("    netstat -ano | findstr :" + PORT + "     (PID is the last column)");
    console.error("    taskkill /F /PID <pid>");
    console.error("  Then run this again. (If the old instance predates the write token, closing it");
    console.error("  matters doubly — it accepts unauthenticated writes.)");
    process.exit(1);
  }
  console.error("✗ bible-server could not start: " + e.message);
  process.exit(1);
});

server.listen(PORT, "127.0.0.1", function () {
  var actualPort = server.address().port;
  console.log("bible-server listening on http://127.0.0.1:" + actualPort);
  console.log("");
  console.log("  Editor: http://127.0.0.1:" + actualPort + "/bible_editor.html");
  console.log("  Server-hosted editor writes with NO token — just save.");
  console.log("  WRITE TOKEN — only needed by file:// pages (new one every server start):");
  console.log("  " + TOKEN);
  console.log("");
  console.log("Leave this window open while you triage — the pages' save buttons talk to it.");
  console.log("Every install is validated by dev/install-bible.js before the file is touched. Ctrl+C to stop.");
});
