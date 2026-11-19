// Probe: dev/static-server.js's containment test is `file.indexOf(ROOT) !== 0` — a string prefix, not a path boundary.
// A sibling directory whose name STARTS with the repo's name (C:\Projects\traffic-and-dragons-server exists on this
// machine) passes it. The handler below is copied verbatim from dev/static-server.js with ROOT pointed at a scratch
// fixture; the listen address of the real file's `.listen(8123, cb)` (no host) is shown with an ephemeral port.
var http = require("http"), fs = require("fs"), path = require("path");
var ROOT = path.join(__dirname, "fixture", "repo");
fs.mkdirSync(ROOT, { recursive: true });
fs.mkdirSync(ROOT + "-server", { recursive: true });
fs.writeFileSync(path.join(ROOT, "index.html"), "inside");
fs.writeFileSync(path.join(ROOT + "-server", "secret.txt"), "OUTSIDE THE REPO");
var MIME = {};
var server = http.createServer(function (req, res) {
  var p = decodeURIComponent(String(req.url || "/").split("?")[0]);
  if (p === "/") p = "/index.html";
  var file = path.normalize(path.join(ROOT, p));
  if (file.indexOf(ROOT) !== 0) { res.writeHead(403); res.end("forbidden"); return; }
  fs.readFile(file, function (err, data) {
    if (err) { res.writeHead(404); res.end("not found: " + p); return; }
    res.writeHead(200, { "Content-Type": MIME[path.extname(file).toLowerCase()] || "application/octet-stream", "Cache-Control": "no-store" });
    res.end(data);
  });
}).listen(0, function () {   // same call shape as the real file: no host argument
  var a = server.address();
  console.log("listen() with no host binds address " + JSON.stringify(a.address) + " (family " + a.family + ") — all interfaces, not loopback");
  var paths = ["/..%2frepo-server%2fsecret.txt", "/..%2f..%2frepo-other", "/%2e%2e%2frepo%2findex.html"];
  var left = paths.length;
  paths.forEach(function (u) {
    http.get({ host: "127.0.0.1", port: a.port, path: u }, function (res) {
      var b = ""; res.on("data", function (c) { b += c; }); res.on("end", function () {
        console.log("GET " + u + " -> " + res.statusCode + " " + JSON.stringify(b));
        if (!--left) server.close();
      });
    });
  });
});
