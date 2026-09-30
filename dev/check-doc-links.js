// dev/check-doc-links.js — #481 G8 (audit 2026-09-29): every relative link in the LIVE contract docs (CLAUDE.md and
// DOC/contracts/*.md) must land — the file must exist and a #fragment must name a real heading or id. The #310 split moved
// the contracts into DOC/contracts/ and 34 of their history/audit links kept resolving from the repo root (dead from where
// they now live); 13 of CLAUDE.md's anchors named sections that don't exist (GitHub keeps "_" in a heading's slug, and the
// links spelled it "-"). Nothing checked, so nothing noticed.
//
//   brokenLinks(root, files?)  → [{file, line, target, why}]   (files: repo-relative; default the live contract docs)
//   node dev/check-doc-links.js [files…]                        (prints each; exit 1 when any)
var fs = require("fs"), path = require("path");

function liveDocs(root) {
  var dir = path.join(root, "DOC", "contracts");
  return ["CLAUDE.md"].concat(fs.readdirSync(dir).filter(function (f) { return /\.md$/.test(f); }).sort().map(function (f) { return "DOC/contracts/" + f; }));
}

// GitHub's heading slug: the rendered text, lower-cased, every character that is not a letter, mark, number, connector
// punctuation ("_") space or hyphen dropped, spaces → hyphens. A repeated slug gets -1, -2, … in document order.
function slugText(md) {
  return String(md)
    .replace(/<[^>]+>/g, "")                          // inline HTML
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")        // [text](url) → text
    .replace(/`/g, "").replace(/\*+/g, "")             // code ticks, bold/italic stars
    .trim().toLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}\p{Pc} -]/gu, "")
    .replace(/ /g, "-");
}
function stripCode(text) {
  // fenced blocks and inline code hold examples, not links
  return text.replace(/```[\s\S]*?```/g, function (m) { return m.replace(/[^\n]/g, " "); })
    .replace(/`[^`\n]*`/g, function (m) { return m.replace(/./g, " "); });
}
var _anchorCache = {};
function anchorsOf(file) {
  if (_anchorCache[file]) return _anchorCache[file];
  var text = fs.readFileSync(file, "utf8"), set = {}, seen = {}, m;
  var idRe = /\b(?:id|name)\s*=\s*["']([^"']+)["']/g;
  while ((m = idRe.exec(text))) set[m[1]] = true;
  if (/\.md$/i.test(file)) {
    stripCode(text).split("\n").forEach(function (line) {
      var h = /^\s{0,3}#{1,6}\s+(.+?)\s*#*\s*$/.exec(line); if (!h) return;
      var s = slugText(h[1]), n = seen[s] || 0;
      set[n ? s + "-" + n : s] = true; seen[s] = n + 1;
    });
  }
  return (_anchorCache[file] = set);
}

function brokenLinks(root, files) {
  var out = [];
  (files || liveDocs(root)).forEach(function (rel) {
    var abs = path.join(root, rel), text = fs.readFileSync(abs, "utf8"), code = stripCode(text);
    var re = /!?\[[^\]\n]*\]\(\s*<?([^)\s>]+)>?(?:\s+"[^"]*")?\s*\)/g, m;
    while ((m = re.exec(code))) {
      var target = m[1], line = code.slice(0, m.index).split("\n").length;
      if (/^[a-z][a-z0-9+.-]*:/i.test(target)) continue;            // http:, https:, mailto:, …
      var hash = target.indexOf("#"), p = hash >= 0 ? target.slice(0, hash) : target, frag = hash >= 0 ? target.slice(hash + 1) : "";
      var dest = p ? path.resolve(path.dirname(abs), decodeURIComponent(p)) : abs;
      if (!fs.existsSync(dest)) { out.push({ file: rel, line: line, target: target, why: "no such file" + (fs.existsSync(path.join(root, decodeURIComponent(p))) ? " here (it resolves from the repo root — rebase the link to this file's folder)" : "") }); continue; }
      if (!frag || fs.statSync(dest).isDirectory() || !/\.(md|html?)$/i.test(dest)) continue;
      if (!anchorsOf(dest)[decodeURIComponent(frag)]) out.push({ file: rel, line: line, target: target, why: "no heading or id \"#" + frag + "\" in " + path.relative(root, dest).replace(/\\/g, "/") });
    }
  });
  return out;
}

module.exports = { liveDocs: liveDocs, slugText: slugText, anchorsOf: anchorsOf, brokenLinks: brokenLinks };

if (require.main === module) {
  var root = path.join(__dirname, ".."), args = process.argv.slice(2);
  var bad = brokenLinks(root, args.length ? args : null);
  bad.forEach(function (b) { console.error("BROKEN LINK " + b.file + ":" + b.line + " → " + b.target + " — " + b.why); });
  console.log(bad.length ? "DOC LINKS: " + bad.length + " broken" : "DOC LINKS OK — every relative link in the live contract docs lands");
  process.exit(bad.length ? 1 : 0);
}
