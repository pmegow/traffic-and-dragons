// Probe: index.html's classic <script src> order vs dev/engine-manifest.js. Reports every file the game loads that the
// engine (node tests, test.html) never loads, and checks the order of the shared ones.
var fs = require("fs");
var R = "C:/Projects/traffic-and-dragons";
var html = fs.readFileSync(R + "/index.html", "utf8");
var tags = [], re = /<script\b([^>]*)\bsrc\s*=\s*["']([^"'?#]+)[^"']*["']([^>]*)>/gi, m;
while ((m = re.exec(html))) tags.push({ src: m[2], attrs: m[1] + m[3] });
var man = require(R + "/dev/engine-manifest.js").map(function (e) { return e.file; });
var notEngine = tags.filter(function (t) { return man.indexOf(t.src) < 0; });
console.log("index.html script tags: " + tags.length + "; manifest: " + man.length);
console.log("loaded by the game, never by the engine tests: " + notEngine.map(function (t) { return t.src + (/module|defer|async/.test(t.attrs) ? " [" + t.attrs.trim() + "]" : ""); }).join(", "));
console.log("in the manifest but not in index.html: " + man.filter(function (f) { return !tags.some(function (t) { return t.src === f; }); }).join(", ") || "(none)");
var shared = tags.map(function (t) { return t.src; }).filter(function (s) { return man.indexOf(s) >= 0; });
var orderOk = shared.every(function (s, i) { return man.indexOf(s) === i; });
console.log("shared files in the same order: " + orderOk + " (" + shared.length + " shared)");
