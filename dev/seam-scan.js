// dev/seam-scan.js — #631: the names a file reaches for that it does not define.
//
// The Car Mode seam is a promise about three files (car-commands.js, car-session.js, audio-session.js): each names only what
// it declares itself and what the platform provides. This is the ONE reader that checks the promise — dev/tests-631-car-seam.js
// runs it over the portable files and fails on the first game name that leaks in (worldState, busy, TTS, store, erCrumb, …).
//
// One pass over the source: strings, regex literals and comments are skipped; a name after "." is a property; a name before ":"
// that follows "{" or "," is an object key; `var` lists (comma-separated, at bracket depth 0), function names, function
// parameters and catch parameters are declarations. Everything else that is not a keyword is a use.
//
//   var seam = require("./seam-scan.js");
//   seam.outsideNames(source, allowedList)  → [{ name, line }] sorted by first use — empty when the file keeps the promise
//   seam.scan(source)                      → { declared: {name: true}, used: [{ name, line }] }
var KEYWORDS = {};
("var function return if else for while do break continue new delete typeof instanceof in of void this null true false " +
 "undefined try catch finally throw switch case default with debugger").split(" ").forEach(function (k) { KEYWORDS[k] = true; });

function tokens(src) {
  var out = [], i = 0, n = src.length, c, prev = null, s, v, q, cls, d;
  function regexAllowed() {
    if (!prev) return true;
    if (prev.t === "num" || prev.t === "str" || prev.t === "regex") return false;
    if (prev.t === "id") return /^(return|typeof|instanceof|in|of|new|delete|void|throw|case|do|else)$/.test(prev.v);
    return !(prev.v === ")" || prev.v === "]" || prev.v === "}");
  }
  while (i < n) {
    c = src.charAt(i);
    if (/\s/.test(c)) { i++; continue; }
    if (c === "/" && src.charAt(i + 1) === "/") { i = src.indexOf("\n", i); if (i < 0) i = n; continue; }
    if (c === "/" && src.charAt(i + 1) === "*") { i = src.indexOf("*/", i + 2); i = i < 0 ? n : i + 2; continue; }
    if (c === "\"" || c === "'") {
      q = c; i++;
      while (i < n && src.charAt(i) !== q) { if (src.charAt(i) === "\\") i++; i++; }
      i++; prev = { t: "str", v: "" }; continue;
    }
    if (c === "/" && regexAllowed()) {
      i++; cls = false;
      while (i < n) {
        d = src.charAt(i);
        if (d === "\\") { i += 2; continue; }
        if (cls) { if (d === "]") cls = false; }
        else if (d === "[") cls = true;
        else if (d === "/" || d === "\n") break;
        i++;
      }
      i++;
      while (i < n && /[a-z]/i.test(src.charAt(i))) i++;
      prev = { t: "regex", v: "" }; continue;
    }
    if (/[A-Za-z_$]/.test(c)) {
      s = i; while (i < n && /[\w$]/.test(src.charAt(i))) i++;
      v = src.slice(s, i);
      out.push(prev = { t: "id", v: v, at: s }); continue;
    }
    if (/[0-9]/.test(c)) { s = i; while (i < n && /[\w.]/.test(src.charAt(i))) i++; out.push(prev = { t: "num", v: src.slice(s, i), at: s }); continue; }
    out.push(prev = { t: "p", v: c, at: i }); i++;
  }
  return out;
}

function lineOf(src, at) { return src.slice(0, at).split("\n").length; }

function scan(src) {
  var ts = tokens(src), declared = {}, used = [], i, t, p, nx, depth, j;
  for (i = 0; i < ts.length; i++) {
    t = ts[i];
    if (t.t !== "id") continue;
    p = ts[i - 1]; nx = ts[i + 1];
    if (t.v === "function") {
      j = i + 1;
      if (ts[j] && ts[j].t === "id") { declared[ts[j].v] = true; j++; }
      if (ts[j] && ts[j].v === "(") { j++; while (ts[j] && ts[j].v !== ")") { if (ts[j].t === "id") declared[ts[j].v] = true; j++; } }
      continue;
    }
    if (t.v === "catch") {
      j = i + 1;
      if (ts[j] && ts[j].v === "(" && ts[j + 1] && ts[j + 1].t === "id") declared[ts[j + 1].v] = true;
      continue;
    }
    if (t.v === "var") {
      j = i + 1; depth = 0;
      if (ts[j] && ts[j].t === "id") declared[ts[j].v] = true;
      while (ts[j]) {
        if (ts[j].t === "p") {
          if (ts[j].v === "(" || ts[j].v === "[" || ts[j].v === "{") depth++;
          else if (ts[j].v === ")" || ts[j].v === "]" || ts[j].v === "}") { depth--; if (depth < 0) break; }
          else if (ts[j].v === ";" && depth === 0) break;
          else if (ts[j].v === "," && depth === 0 && ts[j + 1] && ts[j + 1].t === "id") { declared[ts[j + 1].v] = true; j++; }
        } else if (ts[j].t === "id" && depth === 0 && (ts[j].v === "in" || ts[j].v === "of")) break;
        j++;
      }
      continue;
    }
    if (KEYWORDS[t.v]) continue;
    if (p && p.t === "p" && p.v === ".") continue;                                   // a property
    if (nx && nx.t === "p" && nx.v === ":" && p && p.t === "p" && (p.v === "{" || p.v === ",")) continue;   // an object key
    used.push({ name: t.v, line: lineOf(src, t.at) });
  }
  return { declared: declared, used: used };
}

function outsideNames(src, allowed) {
  var r = scan(src), ok = {}, seen = {}, out = [];
  (allowed || []).forEach(function (a) { ok[a] = true; });
  r.used.forEach(function (u) {
    if (r.declared[u.name] || ok[u.name] || seen[u.name]) return;
    seen[u.name] = true; out.push(u);
  });
  return out;
}

module.exports = { scan: scan, outsideNames: outsideNames, tokens: tokens };
