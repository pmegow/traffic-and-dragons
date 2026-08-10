// static-server.js — DEV ONLY: a zero-dependency static file server over the repo root, for
// driving the real app in the Browser pane (visual verification against http:// instead of
// file://, so localStorage/SW behave like the deployed site). Never shipped; not in the shell.
var http = require("http"), fs = require("fs"), path = require("path");
var ROOT = path.join(__dirname, "..");
var MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json",
  ".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml", ".wasm": "application/wasm",
  ".onnx": "application/octet-stream", ".tnd": "application/json", ".md": "text/plain", ".txt": "text/plain" };
http.createServer(function (req, res) {
  var p = decodeURIComponent(String(req.url || "/").split("?")[0]);
  if (p === "/") p = "/index.html";
  var file = path.normalize(path.join(ROOT, p));
  if (file.indexOf(ROOT) !== 0) { res.writeHead(403); res.end("forbidden"); return; }
  fs.readFile(file, function (err, data) {
    if (err) { res.writeHead(404); res.end("not found: " + p); return; }
    res.writeHead(200, { "Content-Type": MIME[path.extname(file).toLowerCase()] || "application/octet-stream", "Cache-Control": "no-store" });
    res.end(data);
  });
}).listen(8123, function () { console.log("static server on http://localhost:8123 (repo root, no-store)"); });
