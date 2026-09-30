// dev/class-guards.js — #481 G5 (audit 2026-09-29, Fable-approved): three guards that CLAIMED to cover a class but checked a
// hand-written list. The #356 scan counted tickers in six named files while four model/image waits painted a frozen status
// elsewhere; the palette contract checked pages that link satellite.css, never the pages that don't; the SW allowlist
// contracts named three satellites while a fourth page was served cache-first. Each class is DERIVED from the source here,
// with ONE reasoned exemption registry (EXEMPT) — adding a page or a wait means adding code the guard already sees, and a
// deliberate exception means adding an entry that says why.
//
//   frozenWaitPaints(root)   — every ellipsis status ("Generating…") painted in a function that waits on a model or an image
//                              must ride elapsedTicker (owner rule #356). A function waits when its own body calls a wait
//                              primitive (callGM, falFetch, falQueueRender) or, transitively, a named function that does.
//   paletteProblems(root)    — every tracked root page links satellite.css, or has a reasoned palette exemption.
//   networkFirstProblems(root) — every tracked root page outside APP_SHELL matches sw.js's network-first regex.
//
// BOUNDARY (known, deliberate): a status painted by a HELPER called before the wait — addMsg("thinking","The world turns...")
// in the GM turn, Car Mode's "Thinking…" — is outside this scan: the paint is not in the waiting function's own flow. The
// story's thinking marker pulses (CSS animation) rather than freezing; whether it should also count seconds is an owner call
// (audit G5 annotation), not something this guard decides.
//
//   node dev/class-guards.js        (prints every problem; exit 1 when any)
var fs = require("fs"), path = require("path"), cp = require("child_process");

var WAIT_PRIMITIVES = ["callGM", "falFetch", "falQueueRender"];

// ONE registry. Every entry says why; an entry the source no longer needs is itself a problem (staleExemptions).
var EXEMPT = {
  paints: [
    { file: "game.js", literal: "…", why: "the three placeholder suggestion buttons while the fallback suggestion call runs — placeholders under narration that has already landed, not a status line; they are replaced or removed on every outcome (audit E25), and the in-band buttons (#328) skip this call by default" },
    { file: "game.js", literal: "Sign in (File → Account…) or set a fal.ai key (File → Render Options…) to generate images.", why: "not a status: a refusal naming two File-menu items whose labels end in an ellipsis" }
  ],
  palette: {
    "index.html": "the game itself — its :root is the palette's source; satellite.css mirrors it",
    "piper-host.html": "the invisible synthesis iframe (B9) — no UI to colour",
    "test.html": "the engine test runner — plain result output, no themed UI",
    "timeline_day1.html": "a one-off generated play artifact, not a tool"
  },
  networkFirst: {
    /* none — index.html and piper-host.html are APP_SHELL; every other tracked page must be network-first */
  }
};

function trackedRootFiles(root, exts) {
  var out = cp.execFileSync("git", ["ls-files", "--", "*"], { cwd: root, encoding: "utf8" }).split("\n");
  return out.filter(function (f) { return f && f.indexOf("/") < 0 && exts.test(f); }).sort();
}

// The executable text of a file: a .js file as-is; an .html page's INLINE scripts with everything else blanked to spaces
// (newlines kept, so offsets and line numbers stay the file's own). Prose apostrophes in markup never reach the tokenizer.
function scriptText(file, text) {
  if (!/\.html$/.test(file)) return text;
  var out = text.replace(/[^\n]/g, " "), re = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi, m;
  while ((m = re.exec(text))) {
    if (/\bsrc\s*=/.test(m[1])) continue;
    var at = m.index + m[0].indexOf(">") + 1;
    out = out.slice(0, at) + m[2] + out.slice(at + m[2].length);
  }
  return out;
}

// Every function body in a script: {name (null when anonymous), open, close}. A string/comment/regex/template-aware brace
// walk — a brace inside a literal never opens a body. The header before a "{" decides whether it is a function.
var HEADER_RE = /(?:\bfunction\s*\*?\s*([A-Za-z_$][\w$]*)?\s*\([^()]*(?:\([^()]*\)[^()]*)*\)\s*|=>\s*)$/;
var NAME_BEFORE_RE = /([A-Za-z_$][\w$.]*)\s*[=:]\s*(?:async\s+)?$/;
// A DEFERRED callback runs later, not as part of the call that creates it: an event handler, a timer. Its waits are its own —
// a function that wires a click handler which waits is not itself waiting. (A .then/.map/Promise callback IS the flow.)
var DEFERRED_RE = /(?:\.on[a-z]+\s*=|addEventListener\s*\(\s*[^,()]*,|setTimeout\s*\(|setInterval\s*\(|requestAnimationFrame\s*\()\s*$/;
function functionsOf(src) {
  var out = [], stack = [], i, n = src.length, ch, mode = null, q, lastSig = "";
  for (i = 0; i < n; i++) {
    ch = src[i];
    if (mode === "line") { if (ch === "\n") mode = null; continue; }
    if (mode === "block") { if (ch === "*" && src[i + 1] === "/") { mode = null; i++; } continue; }
    if (mode === "str") { if (ch === "\\") { i++; continue; } if (ch === q || (ch === "\n" && q !== "`")) mode = null; continue; }
    if (mode === "re") { if (ch === "\\") { i++; continue; } if (ch === "[") mode = "reclass"; else if (ch === "/" || ch === "\n") mode = null; continue; }
    if (mode === "reclass") { if (ch === "\\") { i++; continue; } if (ch === "]") mode = "re"; continue; }
    if (ch === "/" && src[i + 1] === "/") { mode = "line"; continue; }
    if (ch === "/" && src[i + 1] === "*") { mode = "block"; i++; continue; }
    if (ch === "\"" || ch === "'" || ch === "`") { mode = "str"; q = ch; lastSig = ch; continue; }
    if (ch === "/") {
      var before = src.slice(Math.max(0, i - 12), i).replace(/\s+$/, "");
      if (!before || /[(,=:\[!&|?{};+\-*%<>~^]$/.test(before) || /\b(return|typeof|case|in|of|void|delete|throw|new)$/.test(before)) { mode = "re"; continue; }
    }
    if (ch === "{") {
      var head = src.slice(Math.max(0, i - 400), i), h = HEADER_RE.exec(head);
      if (h) {
        var name = h[1] || null;
        if (!name) { var nb = NAME_BEFORE_RE.exec(head.slice(0, head.length - h[0].length).replace(/\s+$/, "")); if (nb) name = nb[1].split(".").pop(); }
        var nested = stack.some(function (f) { return f !== null; });   // inside another function: a local name, never a global one
        var pre = head.slice(0, head.length - h[0].length).replace(/\s*(?:async\s*)?$/, "");
        stack.push({ name: name, open: i, topLevel: !nested, deferred: DEFERRED_RE.test(pre) });
      } else stack.push(null);
    } else if (ch === "}") {
      var top = stack.pop();
      if (top) { top.close = i; out.push(top); }
    }
    if (!/\s/.test(ch)) lastSig = ch;
  }
  return out;
}

// The code of a script with every string, template, regex and comment blanked — "campLoad(" inside an onclick attribute
// string is markup, not a call this function makes.
function codeOnly(src) {
  var out = src.split(""), i, n = src.length, ch, mode = null, q;
  for (i = 0; i < n; i++) {
    ch = src[i];
    if (mode === "line") { if (ch === "\n") mode = null; else out[i] = " "; continue; }
    if (mode === "block") { if (ch === "*" && src[i + 1] === "/") { mode = null; out[i] = out[i + 1] = " "; i++; } else if (ch !== "\n") out[i] = " "; continue; }
    if (mode === "str") { if (ch === "\\") { out[i] = " "; if (src[i + 1] !== "\n") out[i + 1] = " "; i++; continue; } if (ch === q || (ch === "\n" && q !== "`")) { mode = null; continue; } if (ch !== "\n") out[i] = " "; continue; }
    if (mode === "re") { if (ch === "\\") { out[i] = out[i + 1] = " "; i++; continue; } if (ch === "[") mode = "reclass"; else if (ch === "/" || ch === "\n") { mode = null; continue; } out[i] = " "; continue; }
    if (mode === "reclass") { if (ch === "\\") { out[i] = out[i + 1] = " "; i++; continue; } if (ch === "]") mode = "re"; out[i] = " "; continue; }
    if (ch === "/" && src[i + 1] === "/") { mode = "line"; out[i] = " "; continue; }
    if (ch === "/" && src[i + 1] === "*") { mode = "block"; out[i] = out[i + 1] = " "; i++; continue; }
    if (ch === "\"" || ch === "'" || ch === "`") { mode = "str"; q = ch; continue; }
    if (ch === "/") {
      var before = src.slice(Math.max(0, i - 12), i).replace(/\s+$/, "");
      if (!before || /[(,=:\[!&|?{};+\-*%<>~^]$/.test(before) || /\b(return|typeof|case|in|of|void|delete|throw|new)$/.test(before)) { mode = "re"; continue; }
    }
  }
  return out.join("");
}
// A function's FLOW: its code (literals and comments blanked) with every nested DEFERRED callback blanked — the handlers and
// timers it only wires. Callbacks that run as part of the call (.then, .map, a Promise executor) stay: they are its wait.
function ownBody(code, fn, all) {
  var body = code.slice(fn.open, fn.close + 1);
  all.forEach(function (g) {
    if (g !== fn && g.deferred && g.open > fn.open && g.close < fn.close) {
      var a = g.open - fn.open, b = g.close - fn.open + 1;
      body = body.slice(0, a) + body.slice(a, b).replace(/[^\n]/g, " ") + body.slice(b);
    }
  });
  return body;
}
function callsAny(text, names) {
  for (var k = 0; k < names.length; k++) if (new RegExp("(?:^|[^.\\w$])" + names[k].replace(/\$/g, "\\$") + "\\s*\\(").test(text)) return true;
  return false;
}

// Load every tracked root .js/.html as {file, src, fns}. A TOP-LEVEL name in a .js file is global (index.html and the pages
// that load the engine share it); a top-level name inline in a page is that page's own; a nested name is nobody's (a module's
// private render() or run() must not make every render( call in the project a wait).
function loadSources(root) {
  return trackedRootFiles(root, /\.(js|html)$/).map(function (f) {
    var src = scriptText(f, fs.readFileSync(path.join(root, f), "utf8"));
    return { file: f, src: src, fns: functionsOf(src) };
  });
}
// A function waits when its OWN body (callbacks excluded) calls a primitive or a waiting name — a function that merely wires a
// click handler which waits is not itself waiting. Fixpoint over top-level names.
function waitingNames(sources) {
  var global = {}, local = {};
  sources.forEach(function (s) { if (!s.own) { var code = codeOnly(s.src); s.own = s.fns.map(function (fn) { return ownBody(code, fn, s.fns); }); } });
  var changed = true;
  while (changed) {
    changed = false;
    sources.forEach(function (s) {
      var isJs = /\.js$/.test(s.file), loc = local[s.file] || (local[s.file] = {});
      s.fns.forEach(function (fn, k) {
        if (!fn.name || !fn.topLevel || (isJs ? global[fn.name] : loc[fn.name])) return;
        var names = WAIT_PRIMITIVES.concat(Object.keys(global)).concat(isJs ? [] : Object.keys(loc));
        if (callsAny(s.own[k], names)) { (isJs ? global : loc)[fn.name] = true; changed = true; }
      });
    });
  }
  return { global: global, local: local };
}

// An in-flight status paint: an assignment to textContent/innerHTML/innerText, or a call to a *Status helper, whose
// statement carries a literal with an ellipsis (the character, its … escape, or three dots).
var PAINT_RE = /(\.(?:textContent|innerHTML|innerText)\s*=|\b[A-Za-z_$]*[Ss]tatus\s*\()([^;\n]*)/g;
var ELLIPSIS_LIT_RE = /(["'])((?:(?!\1)[^\\\n]|\\.)*?(?:…|\\u2026|\.\.\.)(?:(?!\1)[^\\\n]|\\.)*?)\1/;
// opts.sources: in-memory sources (sourcesOf) instead of the tracked tree; opts.exempt: a paints registry instead of EXEMPT's.
function frozenWaitPaints(root, opts) {
  var sources = (opts && opts.sources) || loadSources(root), exempt = (opts && opts.exempt) || EXEMPT.paints;
  var waits = waitingNames(sources), found = [];
  sources.forEach(function (s) {
    var isJs = /\.js$/.test(s.file), names = WAIT_PRIMITIVES.concat(Object.keys(waits.global)).concat(isJs ? [] : Object.keys(waits.local[s.file] || {}));
    var m; PAINT_RE.lastIndex = 0;
    while ((m = PAINT_RE.exec(s.src))) {
      if (/function\s+[A-Za-z_$]*[Ss]tatus\s*\($/.test(s.src.slice(Math.max(0, m.index - 40), m.index + m[1].length))) continue; // a definition, not a call
      var lit = ELLIPSIS_LIT_RE.exec(m[2]); if (!lit) continue;
      var at = m.index, inner = -1;
      s.fns.forEach(function (fn, k) { if (fn.open < at && fn.close > at && (inner < 0 || fn.open > s.fns[inner].open)) inner = k; });
      if (inner < 0 || !callsAny(s.own[inner], names)) continue;
      found.push({ file: s.file, line: s.src.slice(0, at).split("\n").length, literal: lit[2], fn: s.fns[inner].name || "(anonymous)" });
    }
  });
  return found.filter(function (p) { return !exempt.some(function (e) { return e.file === p.file && e.literal === p.literal; }); });
}
// In-memory sources for fixtures: [{file, text}] → the same shape loadSources returns.
function sourcesOf(list) {
  return list.map(function (x) { var src = scriptText(x.file, x.text); return { file: x.file, src: src, fns: functionsOf(src) }; });
}

function swShellAndRegex(swText) {
  var a = swText.indexOf("var APP_SHELL = ["), b = swText.indexOf("];", a);
  if (a < 0) throw new Error("sw.js: var APP_SHELL = [ was not found — the service worker changed shape");
  var shell = (swText.slice(a, b).match(/["']([^"']+)["']/g) || []).map(function (s) { return s.slice(1, -1).replace(/^\.?\//, "") || "index.html"; });
  var line = swText.split("\n").filter(function (l) { return /^\s*if\(\/blueprint-designer\|/.test(l); })[0];
  if (!line) throw new Error("sw.js: the network-first regex line (if(/blueprint-designer|…/.test(e.request.url))) was not found — the fetch handler changed shape");
  return { shell: shell, regex: new RegExp(line.slice(line.indexOf("if(/") + 4, line.indexOf("/.test(e.request.url)"))) };
}
function trackedPages(root) {
  return trackedRootFiles(root, /\.html$/).map(function (f) { return { file: f, text: fs.readFileSync(path.join(root, f), "utf8") }; });
}
function linksPalette(text) { return text.indexOf('href="satellite.css"') >= 0; }
// opts.pages: [{file, text}] instead of the tracked root pages; opts.exempt / opts.sw: a registry / sw.js text for fixtures.
function paletteProblems(root, opts) {
  var pages = (opts && opts.pages) || trackedPages(root), exempt = (opts && opts.exempt) || EXEMPT.palette;
  return pages.filter(function (p) { return !exempt[p.file] && !linksPalette(p.text); })
    .map(function (p) { return p.file + " does not link satellite.css and has no palette exemption — one palette across every page (#312); link it, or add a reasoned EXEMPT.palette entry in dev/class-guards.js"; });
}
function networkFirstProblems(root, opts) {
  var pages = (opts && opts.pages) || trackedPages(root), exempt = (opts && opts.exempt) || EXEMPT.networkFirst;
  var sw = swShellAndRegex((opts && opts.sw) || fs.readFileSync(path.join(root, "sw.js"), "utf8"));
  return pages.filter(function (p) { return sw.shell.indexOf(p.file) < 0 && !exempt[p.file] && !sw.regex.test("https://tnd.example/" + p.file); })
    .map(function (p) { return p.file + " is outside APP_SHELL and not in sw.js's network-first regex — the service worker serves it cache-first, stale until the next CACHE bump (the v1.360 bug_tracker lesson)"; });
}
// An exemption the source no longer needs is a problem too: the registry must stay the truth.
function staleExemptions(root, opts) {
  var pages = (opts && opts.pages) || trackedPages(root), reg = (opts && opts.registry) || EXEMPT, out = [];
  var byName = {}; pages.forEach(function (p) { byName[p.file] = p; });
  Object.keys(reg.palette).forEach(function (f) {
    if (!byName[f]) out.push("EXEMPT.palette names " + f + ", which is not a tracked root page");
    else if (linksPalette(byName[f].text)) out.push("EXEMPT.palette names " + f + ", which links satellite.css — drop the exemption");
  });
  Object.keys(reg.networkFirst).forEach(function (f) { if (!byName[f]) out.push("EXEMPT.networkFirst names " + f + ", which is not a tracked root page"); });
  if (!(opts && opts.sources) && !(opts && opts.registry)) {
    var live = frozenWaitPaints(root, { exempt: [] });
    reg.paints.forEach(function (e) { if (!live.some(function (p) { return p.file === e.file && p.literal === e.literal; })) out.push("EXEMPT.paints names \"" + e.literal + "\" in " + e.file + ", which no waiting function paints any more — drop the exemption"); });
  }
  return out;
}
function allProblems(root) {
  return frozenWaitPaints(root).map(function (p) { return p.file + ":" + p.line + " paints \"" + p.literal + "\" in " + p.fn + ", which waits on a model or an image — ride elapsedTicker (#356), or add a reasoned EXEMPT.paints entry"; })
    .concat(paletteProblems(root)).concat(networkFirstProblems(root)).concat(staleExemptions(root));
}

module.exports = { WAIT_PRIMITIVES: WAIT_PRIMITIVES, EXEMPT: EXEMPT, scriptText: scriptText, functionsOf: functionsOf, codeOnly: codeOnly, loadSources: loadSources, sourcesOf: sourcesOf,
  waitingNames: waitingNames, frozenWaitPaints: frozenWaitPaints, paletteProblems: paletteProblems, networkFirstProblems: networkFirstProblems, staleExemptions: staleExemptions, allProblems: allProblems };

if (require.main === module) {
  var probs = allProblems(path.join(__dirname, ".."));
  probs.forEach(function (p) { console.error("CLASS GUARD: " + p); });
  console.log(probs.length ? "CLASS GUARDS: " + probs.length + " problem(s)" : "CLASS GUARDS OK — waits tick, every page is on the palette and network-first (derived from the source)");
  process.exit(probs.length ? 1 : 0);
}
