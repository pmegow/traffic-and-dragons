// dev/check-es5.js — THE ES5 check for the game client (#481 G10, 2026-09-29). The project is ES5-only (CLAUDE.md ▸
// Conventions): no const/let, no arrow functions, no template literals, no class declarations. Before this file the
// rule was enforced only by the editor hooks (.claude/.codex hooks/es5-check.js), so a shell edit, a cloud session or a
// hand edit shipped unchecked, and the hooks' line regexes misfired on an arrow inside a string or a regex. ONE rule
// set, ONE lexer, three callers: the pre-commit hook, CI (engine-tests.yml) and both editor hooks (which require()
// scanEs5 from here).
//
// The lexer strips comments, string literals and regex literals before looking, so "=>" in a string, `const` in a
// comment or a backtick inside a regex never count. A template literal is itself the violation (reported once, then
// skipped to its closing backtick). async/await is out of scope (convention drift, not a runtime break).
//
// Usage:
//   node dev/check-es5.js                 every root *.js (the game client; dev/, vendor/ and the server are not client code)
//   node dev/check-es5.js <file> [...]     just these files
// Exit 0 clean, 1 on any violation (each named with file:line and the offending line).
var fs = require("fs"), path = require("path");
var ROOT = path.join(__dirname, "..");

// Tokens after which a "/" starts a regex literal rather than a division.
var REGEX_PREV_PUNCT = "(,=:[!&|?{};+-*%<>~^";
var REGEX_PREV_WORDS = { "return": 1, "typeof": 1, "instanceof": 1, "in": 1, "of": 1, "new": 1, "delete": 1, "void": 1, "throw": 1, "case": 1, "do": 1, "else": 1 };

function scanEs5(src) {
  var s = String(src == null ? "" : src), n = s.length, i = 0, line = 1, hits = [];
  var prevSig = "", prevWord = "";/* the previous significant character / identifier, for the regex-vs-division call */
  var lines = null;
  function lineText(ln) { if (!lines) lines = s.split(/\r?\n/); return String(lines[ln - 1] || "").trim().slice(0, 140); }
  function hit(kind, ln) { hits.push({ line: ln, kind: kind, text: lineText(ln) }); }
  function isIdStart(c) { return /[A-Za-z_$]/.test(c); }
  function isIdPart(c) { return /[A-Za-z0-9_$]/.test(c); }
  function nextSig(k) { while (k < n && /\s/.test(s[k])) k++; return k; }
  while (i < n) {
    var c = s[i], d = s[i + 1];
    if (c === "\n") { line++; i++; continue; }
    if (/\s/.test(c)) { i++; continue; }
    if (c === "/" && d === "/") { while (i < n && s[i] !== "\n") i++; continue; }
    if (c === "/" && d === "*") { i += 2; while (i < n && !(s[i] === "*" && s[i + 1] === "/")) { if (s[i] === "\n") line++; i++; } i += 2; continue; }
    if (c === "'" || c === '"') {
      var q = c; i++;
      while (i < n && s[i] !== q) { if (s[i] === "\\") { i++; if (s[i] === "\n") line++; i++; continue; } if (s[i] === "\n") line++; i++; }
      i++; prevSig = q; prevWord = ""; continue;
    }
    if (c === "`") {
      hit("template literal", line); i++;
      while (i < n && s[i] !== "`") { if (s[i] === "\\") { i++; if (s[i] === "\n") line++; i++; continue; } if (s[i] === "\n") line++; i++; }
      i++; prevSig = "`"; prevWord = ""; continue;
    }
    if (c === "/") {
      var regexCtx = prevSig === "" || REGEX_PREV_PUNCT.indexOf(prevSig) >= 0 || (prevWord && REGEX_PREV_WORDS[prevWord]);
      if (regexCtx) {
        i++; var inClass = false;
        while (i < n) {
          var r = s[i];
          if (r === "\\") { i += 2; continue; }
          if (r === "\n") break;/* not a regex after all (a lone slash); resume lexing on the next line */
          if (r === "[") inClass = true; else if (r === "]") inClass = false; else if (r === "/" && !inClass) break;
          i++;
        }
        i++; while (i < n && /[a-z]/i.test(s[i])) i++;
        prevSig = "/"; prevWord = ""; continue;
      }
    }
    if (c === "=" && d === ">") { hit("arrow function", line); i += 2; prevSig = ">"; prevWord = ""; continue; }
    if (isIdStart(c)) {
      var j = i; while (j < n && isIdPart(s[j])) j++;
      var w = s.slice(i, j), after = nextSig(j), nc = s[after] || "";
      var dotBefore = prevSig === ".";
      if (!dotBefore) {
        if (w === "const" && (isIdStart(nc) || nc === "[" || nc === "{")) hit("const declaration", line);
        else if (w === "let" && (isIdStart(nc) || nc === "[" || nc === "{")) hit("let declaration", line);
        else if (w === "class" && isIdStart(nc)) {
          var k = after; while (k < n && isIdPart(s[k])) k++;
          var k2 = nextSig(k);
          if (s[k2] === "{" || s.slice(k2, k2 + 7) === "extends") hit("class declaration", line);
        }
      }
      prevWord = w; prevSig = w[w.length - 1]; i = j; continue;
    }
    prevSig = c; prevWord = ""; i++;
  }
  return hits;
}

function clientFiles() {
  return fs.readdirSync(ROOT).filter(function (f) { return /\.js$/i.test(f); }).sort().map(function (f) { return path.join(ROOT, f); });
}

function checkFiles(files) {
  var bad = [];
  files.forEach(function (f) {
    var src; try { src = fs.readFileSync(f, "utf8"); } catch (e) { bad.push({ file: f, line: 0, kind: "unreadable", text: e.message }); return; }
    scanEs5(src).forEach(function (h) { bad.push({ file: f, line: h.line, kind: h.kind, text: h.text }); });
  });
  return bad;
}

if (require.main === module) {
  var args = process.argv.slice(2);
  var files = args.length ? args.map(function (a) { return path.resolve(a); }) : clientFiles();
  var bad = checkFiles(files);
  if (bad.length) {
    console.error("ES5 CHECK FAILED — the game client is ES5-only (CLAUDE.md ▸ Conventions: var, no const/let, no arrow functions, no template literals, no class):");
    bad.slice(0, 40).forEach(function (b) { console.error("  " + path.relative(ROOT, b.file) + ":" + b.line + " (" + b.kind + "): " + b.text); });
    if (bad.length > 40) console.error("  … and " + (bad.length - 40) + " more");
    process.exit(1);
  }
  console.log("[#481 G10] ES5 check OK — " + files.length + " file(s), no const/let, arrow, template or class");
}

module.exports = { scanEs5: scanEs5, checkFiles: checkFiles, clientFiles: clientFiles, ROOT: ROOT };
