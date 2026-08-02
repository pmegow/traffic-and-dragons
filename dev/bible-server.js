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
// Usage:  node dev/bible-server.js     (leave it running while you triage; Ctrl+C when done)
//
// Security posture: binds 127.0.0.1 only, serves exactly two routes, writes only via
// install-bible.js (which decides the target from the file's own content). WRITES additionally
// require a per-run random token (ChatGPT review 2026-08-01): loopback binding blocks remote
// hosts, but any webpage open in any browser can still POST to localhost while this runs —
// and install-bible validates SHAPE, not author intent. The token is printed at startup and
// entered once in the page; CORS stays "*" because the pages run from file:// (Origin: null),
// which no origin allowlist can express.
var http = require("http");
var fs = require("fs");
var path = require("path");
var os = require("os");
var crypto = require("crypto");
var execFile = require("child_process").execFile;

var ROOT = path.join(__dirname, "..");
var PORT = 7373;
var TARGET = path.join(ROOT, "capability_bible.js");
var TOKEN = crypto.randomBytes(16).toString("hex");   // per-run write token — never persisted
var CORS = {
  "Access-Control-Allow-Origin": "*",          // the pages run from file:// (Origin: null)
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-Bible-Token"
};

http.createServer(function (req, res) {
  function send(code, obj) {
    var h = { "Content-Type": "application/json" }, k;
    for (k in CORS) h[k] = CORS[k];
    res.writeHead(code, h);
    res.end(JSON.stringify(obj));
  }
  if (req.method === "OPTIONS") { res.writeHead(204, CORS); res.end(); return; }

  if (req.method === "GET" && req.url === "/bible") {
    try { send(200, { ok: true, text: fs.readFileSync(TARGET, "utf8") }); }
    catch (e) { send(500, { ok: false, output: "could not read capability_bible.js: " + e.message }); }
    return;
  }

  if (req.method === "POST" && req.url === "/install") {
    // Write auth: refuse before reading the body. A drive-by page can reach this port; only a
    // page the user pasted this run's token into may write.
    if (req.headers["x-bible-token"] !== TOKEN) {
      console.warn("[install] " + new Date().toLocaleTimeString() + " REFUSED — missing/wrong X-Bible-Token (the page needs the token printed when this server started)");
      send(403, { ok: false, output: "write refused: missing or wrong X-Bible-Token.\nCopy the token from the bible-server terminal into the page's token prompt (it changes on every server start)." });
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

  send(404, { ok: false, output: "unknown route (this server has /bible and /install only)" });
}).listen(PORT, "127.0.0.1", function () {
  console.log("bible-server listening on http://127.0.0.1:" + PORT);
  console.log("");
  console.log("  WRITE TOKEN (paste into the page when it asks — new token every server start):");
  console.log("  " + TOKEN);
  console.log("");
  console.log("Leave this window open while you triage — the pages' save buttons talk to it.");
  console.log("Every install is validated by dev/install-bible.js before the file is touched. Ctrl+C to stop.");
});
