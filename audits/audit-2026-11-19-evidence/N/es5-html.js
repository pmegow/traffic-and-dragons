// Probe: dev/check-es5.js scans only root *.js. Run its own lexer over the inline <script> blocks of the root *.html
// pages (index.html and the satellites), which no gate scans. Module scripts (type="module") are excluded as ES2020 by design.
var fs = require("fs"), path = require("path");
var R = "C:/Projects/traffic-and-dragons";
var es5 = require(R + "/dev/check-es5.js");
var pages = fs.readdirSync(R).filter(function (f) { return /\.html$/i.test(f); }).sort();
var total = 0;
pages.forEach(function (p) {
  var html = fs.readFileSync(path.join(R, p), "utf8"), re = /<script(\s[^>]*)?>([\s\S]*?)<\/script>/gi, m, hits = [];
  while ((m = re.exec(html))) {
    var attrs = m[1] || "";
    if (/type\s*=\s*["']?(module|importmap|application\/json|text\/plain)/i.test(attrs) || /\bsrc\s*=/.test(attrs)) continue;
    var lineBase = html.slice(0, m.index).split("\n").length;
    es5.scanEs5(m[2]).forEach(function (h) { hits.push((lineBase + h.line - 1) + " " + h.kind + ": " + h.text.slice(0, 70)); });
  }
  if (hits.length) { total += hits.length; console.log(p + " — " + hits.length + " hit(s); first: " + hits[0]); }
});
console.log("pages " + pages.length + "; ES5 violations in inline classic scripts no gate scans: " + total);
