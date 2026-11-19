// static-server.js — DEV ONLY: a zero-dependency static file server over the repo root, for
// driving the real app in the Browser pane (visual verification against http:// instead of
// file://, so localStorage/SW behave like the deployed site). Never shipped; not in the shell.
//
// Audit 2026-11-19, G5 — three holes, closed here:
//   • it listened on EVERY interface, so the whole repository (.git and the gitignored saves included) was readable from
//     the local network: it now binds the loopback addresses only (LOOPBACK);
//   • containment was a string prefix, so /..%2f<repo-name>-server%2f… reached a sibling folder: located() judges the path
//     by path.relative, which a sibling's name cannot satisfy;
//   • a malformed escape (/%) threw out of the handler and killed the process: it is answered 400.
var http = require("http"), fs = require("fs"), path = require("path");
var ROOT = path.join(__dirname, "..");
var PORT = 8123;
var LOOPBACK = ["127.0.0.1", "::1"];
var MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json",
  ".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml", ".wasm": "application/wasm",
  ".onnx": "application/octet-stream", ".tnd": "application/json", ".md": "text/plain", ".txt": "text/plain" };

// located(root, url) → { status: 200, file, path } for a path inside root; { status: 400 | 403, why } otherwise. Pure.
function located(root, url) {
  var p, file, rel;
  try { p = decodeURIComponent(String(url || "/").split("?")[0]); }
  catch (e) { return { status: 400, why: "malformed URL" }; }
  if (p.indexOf("\u0000") >= 0) return { status: 400, why: "malformed URL" };
  if (p === "/") p = "/index.html";
  file = path.resolve(root, "." + path.sep + p);
  rel = path.relative(path.resolve(root), file);
  if (!rel || path.isAbsolute(rel) || rel.split(/[\\\/]/)[0] === "..") return { status: 403, why: "forbidden" };
  return { status: 200, file: file, path: p };
}

function handler(root) {
  return function (req, res) {
    var at = located(root, req.url);
    if (at.status !== 200) { res.writeHead(at.status); res.end(at.why); return; }
    fs.readFile(at.file, function (err, data) {
      if (err) { res.writeHead(404); res.end("not found: " + at.path); return; }
      res.writeHead(200, { "Content-Type": MIME[path.extname(at.file).toLowerCase()] || "application/octet-stream", "Cache-Control": "no-store" });
      res.end(data);
    });
  };
}

if (require.main === module) {
  LOOPBACK.forEach(function (host, i) {
    var server = http.createServer(handler(ROOT));
    server.on("error", function (e) {
      /* the IPv4 loopback is the address the docs name; a machine without IPv6 simply has no second listener */
      if (i === 0) { console.error("static server could not listen on " + host + ":" + PORT + " — " + e.message); process.exit(1); }
      else console.log("static server: no listener on [" + host + "]:" + PORT + " (" + (e.code || e.message) + ") — http://127.0.0.1:" + PORT + " serves");
    });
    server.listen(PORT, host, function () { if (i === 0) console.log("static server on http://localhost:" + PORT + " (repo root, no-store, this machine only)"); });
  });
}
module.exports = { located: located, handler: handler, LOOPBACK: LOOPBACK, PORT: PORT };
