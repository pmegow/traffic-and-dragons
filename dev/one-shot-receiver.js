// one-shot-receiver.js — tiny localhost harvest endpoint for headless playtest runs.
//   node dev/one-shot-receiver.js [port]
// The browser-side harness POSTs run artifacts here (corpus JSON, .tnd save, endstate) so a
// harvest never has to flow through the agent transcript. POST /save?dir=<dev|testRuns>&name=<file>
// with the body as the file content. Filenames are sanitized to a single path segment and dirs
// are whitelisted — this can only ever write inside dev/ or testRuns/. CORS is open because the
// only client is the same machine's browser pane; the server binds 127.0.0.1 only.
var http = require("http");
var fs = require("fs");
var path = require("path");
var root = path.join(__dirname, "..");
var DIRS = { dev: path.join(root, "dev"), testRuns: path.join(root, "testRuns") };
var port = parseInt(process.argv[2], 10) || 8124;

http.createServer(function (req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "content-type");
  if (req.method === "OPTIONS") { res.writeHead(204); return res.end(); }
  var u = new URL(req.url, "http://x");
  if (req.method !== "POST" || u.pathname !== "/save") { res.writeHead(404); return res.end("nope"); }
  var dir = DIRS[u.searchParams.get("dir")];
  var name = String(u.searchParams.get("name") || "");
  if (!dir || !/^[A-Za-z0-9._-]+$/.test(name)) { res.writeHead(400); return res.end("bad dir/name"); }
  var chunks = [];
  req.on("data", function (c) { chunks.push(c); });
  req.on("end", function () {
    var body = Buffer.concat(chunks);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, name), body);
    console.log("saved " + u.searchParams.get("dir") + "/" + name + " (" + body.length + " bytes)");
    res.writeHead(200); res.end("ok " + body.length);
  });
}).listen(port, "127.0.0.1", function () { console.log("receiver on 127.0.0.1:" + port); });
