// dev/dead-symbols.js — the dead-symbol census (#522): every `function NAME(` / `var NAME=` declared at the start of a line
// (column 0, or the two-space indent of a module IIFE such as tts.js) in a tracked root .js file, counted as an IDENTIFIER
// TOKEN across the tree — root .js and .html, dev/, the sw — with COMMENTS stripped and strings KEPT (this app builds its
// HTML by concatenation, so the onclick='pickAnc(…)' inside a string is a real call site). A name that occurs only where it
// is declared is dead. Advisory: prints the list, exits 0 (1 on a scan error). Weekly: file the result as a TODO row.
//   node dev/dead-symbols.js               the census
//   node dev/dead-symbols.js --self-test   the comment stripper's own checks
var fs = require("fs"), path = require("path"), cp = require("child_process"), root = path.resolve(__dirname, "..");
/* Strip block and line comments from JS source, copying string and regex literals verbatim so a "//" inside a URL string or a
   "/*" inside a regex never opens a bogus comment. A regex literal is guessed conservatively: a slash that follows an
   operator, an opener or a keyword. Newlines are kept so line numbers hold. */
function stripComments(s) {
  var out = "", i = 0, n = s.length, c;
  function lastSig() { var k = out.length - 1; while (k >= 0 && /\s/.test(out[k])) k--; return k >= 0 ? out[k] : ""; }
  while (i < n) {
    c = s[i];
    if (c === "/" && s[i + 1] === "*") { var e = s.indexOf("*/", i + 2); if (e < 0) e = n; out += s.slice(i, e + 2).replace(/[^\n]/g, " "); i = e + 2; continue; }
    if (c === "/" && s[i + 1] === "/") { var e2 = s.indexOf("\n", i); if (e2 < 0) e2 = n; out += " ".repeat(e2 - i); i = e2; continue; }
    if (c === '"' || c === "'") { var q = c, j = i + 1; while (j < n && s[j] !== q && s[j] !== "\n") { if (s[j] === "\\") j++; j++; } out += s.slice(i, j + 1); i = j + 1; continue; }
    if (c === "/") {
      var prev = lastSig(), tail = out.replace(/\s+$/, "").slice(-7);
      if (prev === "" || /[(,=:[!&|?{};+\-*%<>~^]/.test(prev) || /\b(?:return|typeof|case|in|of|new|delete|void|throw)$/.test(tail)) {
        var k = i + 1, cls = false; while (k < n) { var ch = s[k]; if (ch === "\\") { k += 2; continue; } if (ch === "[") cls = true; else if (ch === "]") cls = false; else if (ch === "/" && !cls) break; else if (ch === "\n") break; k++; }
        var end = k + 1; while (end < n && /[gimsuy]/.test(s[end])) end++;
        out += s.slice(i, end); i = end; continue;
      }
    }
    out += c; i++;
  }
  return out;
}
/* An HTML file is counted raw but for its <!-- --> comments; its inline scripts' JS comments are rare and harmless here. */
function tokens(src, isHtml) { var s = isHtml ? src.replace(/<!--[\s\S]*?-->/g, " ") : stripComments(src); return s.match(/[A-Za-z_$][\w$]*/g) || []; }
function tracked() { return cp.execSync("git ls-files", { cwd: root }).toString("utf8").split("\n").filter(Boolean); }
function census() {
  var files = tracked(), engine = files.filter(function (f) { return /^[^/]+\.js$/.test(f); }), scan = files.filter(function (f) { return /\.(js|html|cjs|mjs)$/.test(f) && !/^(vendor|node_modules)\//.test(f); });
  var decl = {}, counts = {}, i;
  engine.forEach(function (f) {
    var src = stripComments(fs.readFileSync(path.join(root, f), "utf8")), re = /^(?: {0,2})(?:function\s+([A-Za-z_$][\w$]*)\s*\(|var\s+([A-Za-z_$][\w$]*)\s*=)/gm, m;
    while ((m = re.exec(src))) { var nm = m[1] || m[2]; if (!decl[nm]) decl[nm] = { file: f, line: src.slice(0, m.index).split("\n").length }; }
  });
  scan.forEach(function (f) { var t = tokens(fs.readFileSync(path.join(root, f), "utf8"), /\.html$/.test(f)); for (i = 0; i < t.length; i++) if (decl[t[i]]) counts[t[i]] = (counts[t[i]] || 0) + 1; });
  var dead = Object.keys(decl).filter(function (nm) { return (counts[nm] || 0) <= 1; }).sort();
  return { declared: Object.keys(decl).length, scanned: scan.length, dead: dead.map(function (nm) { return decl[nm].file + ":" + decl[nm].line + " " + nm; }) };
}
if (process.argv.indexOf("--self-test") >= 0) {
  var bad = [];
  function chk(label, src, want) { var got = tokens(src, false).join(","); if (got !== want) bad.push(label + ": " + got + " (want " + want + ")"); }
  chk("comments go, strings and regexes stay", 'var x=1; // y z\n/* q r */ var s="t u"; var re=/v w/g; function foo(){return bar;}', "var,x,var,s,t,u,var,re,v,w,g,function,foo,return,bar");
  chk("a // inside a string is no comment", 'var u="https://a.b/c"; alpha();', "var,u,https,a,b,c,alpha");
  chk("a /* inside a regex is no comment", 'var r=/\\/\\*x/; beta(); /* gone */ gamma();', "var,r,x,beta,gamma");
  chk("a division is not a regex", 'var d=a/b/c; delta();', "var,d,a,b,c,delta");
  if (bad.length) { console.error("dead-symbols self-test FAILED\n  " + bad.join("\n  ")); process.exit(1); }
  console.log("dead-symbols self-test OK (4 checks)"); process.exit(0);
}
try {
  var r = census();
  console.log("dead-symbol census: " + r.declared + " line-start declarations across the engine files, " + r.scanned + " files scanned");
  if (!r.dead.length) console.log("  none dead"); else r.dead.forEach(function (d) { console.log("  " + d); });
} catch (e) { console.error("census failed: " + (e && e.message)); process.exit(1); }
