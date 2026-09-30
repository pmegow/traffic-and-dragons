// dev/check-doc-facts.js — #481 G9 (audit 2026-09-29, Fable-approved): CLAUDE.md copies facts from the code by hand, and
// nothing checked them — the load order had lost a file, the index.html row claimed "42 <script src> tags, no inline JS"
// (there were 44 and an inline service-worker registration). The ENGINE MANIFEST CONTRACT already derives the engine list
// from index.html; this derives CLAUDE.md's copy the same way.
//
//   loadOrderProblems(root, opts?)   — the "### Script load order" block equals index.html's <script src> order, exactly
//   scriptCountProblems(root, opts?) — a script-tag COUNT written in the index.html row, if any, equals the real count
//   node dev/check-doc-facts.js      (prints each; exit 1 when any)
var fs = require("fs"), path = require("path");

function indexScripts(indexHtml) {
  var out = [], re = /<script\b[^>]*\bsrc="([^"]+)"[^>]*>/g, m;
  while ((m = re.exec(indexHtml))) out.push(m[1]);
  return out;
}
function documentedOrder(claudeMd) {
  var at = claudeMd.indexOf("### Script load order");
  if (at < 0) return null;
  var rest = claudeMd.slice(at), a = rest.indexOf("```"), b = rest.indexOf("```", a + 3);
  if (a < 0 || b < 0) return null;
  return rest.slice(a + 3, b).trim().split(/\s*→\s*/).map(function (s) { return s.trim(); }).filter(Boolean);
}
function read(root, rel, opts, key) { return (opts && opts[key] != null) ? opts[key] : fs.readFileSync(path.join(root, rel), "utf8"); }

function loadOrderProblems(root, opts) {
  var real = indexScripts(read(root, "index.html", opts, "index")), doc = documentedOrder(read(root, "CLAUDE.md", opts, "claude"));
  if (!doc) return ["CLAUDE.md lost its \"### Script load order\" code block — the load order must stay documented (and derived)"];
  if (real.join("|") === doc.join("|")) return [];
  var missing = real.filter(function (f) { return doc.indexOf(f) < 0; }), extra = doc.filter(function (f) { return real.indexOf(f) < 0; }), first = -1;
  for (var i = 0; i < Math.max(real.length, doc.length); i++) if (real[i] !== doc[i]) { first = i; break; }
  return ["CLAUDE.md's script load order no longer matches index.html's <script src> order"
    + (missing.length ? " — missing: " + missing.join(", ") : "") + (extra.length ? " — not in index.html: " + extra.join(", ") : "")
    + (!missing.length && !extra.length ? " — out of order from entry " + (first + 1) + " (" + doc[first] + " where index.html has " + real[first] + ")" : "")
    + ". Copy the order from index.html in the same commit that changes it."];
}
function scriptCountProblems(root, opts) {
  var md = read(root, "CLAUDE.md", opts, "claude"), real = indexScripts(read(root, "index.html", opts, "index")).length;
  var row = md.split("\n").filter(function (l) { return /^\|\s*`index\.html`\s*\|/.test(l); })[0] || "";
  var m = /(\d+)\s*`?<script src>`?\s*tags/.exec(row);
  return m && +m[1] !== real ? ["CLAUDE.md's index.html row says " + m[1] + " <script src> tags; index.html has " + real + " — drop the number or fix it"] : [];
}
function allProblems(root, opts) { return loadOrderProblems(root, opts).concat(scriptCountProblems(root, opts)); }

module.exports = { indexScripts: indexScripts, documentedOrder: documentedOrder, loadOrderProblems: loadOrderProblems, scriptCountProblems: scriptCountProblems, allProblems: allProblems };

if (require.main === module) {
  var probs = allProblems(path.join(__dirname, ".."));
  probs.forEach(function (p) { console.error("DOC FACT: " + p); });
  console.log(probs.length ? "DOC FACTS: " + probs.length + " problem(s)" : "DOC FACTS OK — CLAUDE.md's load order is index.html's");
  process.exit(probs.length ? 1 : 0);
}
