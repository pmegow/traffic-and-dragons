/* ══════════════════════════════════════════════════════════════════════════════════════════════
   wasm-probe.js — WebAssembly linear-memory probe (v1.418, B9)

   Loaded by BOTH the app (index.html, before tts.js) and the Piper synthesis iframe
   (piper-host.html). It must run before any wasm is instantiated, so it goes early in the
   document and does its work at load.

   WHY IT EXISTS. The B9 ratchet lives in ORT's wasm linear memory. ORT hands out no reference to
   its Emscripten Module, and iOS Safari exposes no memory API at all, so the only way to see that
   memory is to catch the WebAssembly.Instance on its way out and keep its exported Memory. Linear
   memory grows and never shrinks, so every megabyte reported here is retained by definition — no
   GC timing, no settle window, and it reads identically on iOS and on desktop.

   WHY IT HOOKS FIVE ENTRY POINTS. Two earlier attempts caught nothing:
     · hooking WebAssembly.Memory alone fails — these builds DECLARE memory internally and export
       it rather than importing it, so that constructor is never called (kept for the threaded
       build, where it is);
     · hooking only instantiate/instantiateStreaming misses the synchronous
       `new WebAssembly.Instance(module, imports)` path.
   It also records WHAT it caught, so "no number" stays distinguishable from "the hook never
   fired" — the ambiguity that stalled this diagnosis twice.

   NAMED BY BINARY URL, NOT BY EXPORTS. Both builds ship minified export names (the first run of
   this saw `w,x,y,z`), so there is no _OrtRun or _main to match on. "ort" is tested first because
   the ORT binary lives UNDER /vendor/piper/ and a naive "piper" test would claim it.

   ⚠ AT MOST ONE Memory RETAINED PER KIND, always the newest. An instrument must not change what
   it measures, and the first draft did: holding every Memory it saw pinned the linear memory of
   modules the app had discarded — the probe becoming the very leak class it exists to watch. The
   per-kind INSTANCE COUNT costs no retention and is strictly more informative; it is what
   surfaced the phonemizer-latch finding (TODO #87), 27 instantiations where the design allows one.

   Self-validating: it catches the phonemizer too, whose memory the vendored runtime's tndDiag()
   reports independently via the Module's own HEAPU8. The two agree at 16MB.
   ══════════════════════════════════════════════════════════════════════════════════════════════ */
(function () {
  if (typeof WebAssembly === "undefined" || WebAssembly.__tndProbe) return;
  var seen = {};   // kind -> {mem, src, n}
  var anon = 0;

  function kindOf(src) {
    var f = String(src || "").split("?")[0].split("/").pop().toLowerCase(), m;
    if (f.indexOf("ort") !== -1) return "ort";
    if (f.indexOf("phonem") !== -1) return "phon";
    // No URL (a raw-bytes instantiate): fall back to the binary's own size. ort-wasm-simd.wasm is
    // ~10.6MB, piper_phonemize.wasm ~0.6MB — an order of magnitude apart, so 4MB is a safe split.
    m = /^bytes:(\d+)$/.exec(String(src || ""));
    if (m) return (+m[1] > 4194304) ? "ort" : "phon";
    return "wasm" + (++anon);
  }
  // What the caller handed WebAssembly — a Response (URL) or a buffer (size). Used only to NAME
  // the module; a miss degrades to an indexed label, never to a wrong number.
  function srcOf(a) {
    try {
      if (!a) return "";
      if (typeof a.url === "string" && a.url) return a.url;
      if (typeof a.byteLength === "number") return "bytes:" + a.byteLength;
      if (a.buffer && typeof a.buffer.byteLength === "number") return "bytes:" + a.buffer.byteLength;
    } catch (e) {}
    return "";
  }
  function keep(kind, mem, src) {
    var e = seen[kind];
    if (e && e.mem === mem) return;            // one instance reaching us through two hooks
    if (e) { e.mem = mem; e.src = src; e.n++; }
    else seen[kind] = { mem: mem, src: src, n: 1 };
  }
  function note(inst, src) {
    try {
      var exp = inst && inst.exports;
      if (!exp) return;
      var keys = Object.keys(exp), mem = null, i;
      for (i = 0; i < keys.length; i++) {
        if (exp[keys[i]] instanceof WebAssembly.Memory) { mem = exp[keys[i]]; break; }
      }
      if (!mem) return;
      keep(kindOf(src), mem, String(src || "(no source)"));
    } catch (e) {}
  }
  function noteMem(mem) {
    try { keep("imported", mem, "(constructed)"); } catch (e) {}
  }
  function wrapAsync(orig, streaming) {
    return function (src, imports) {
      var hint = "", first = src;
      // instantiateStreaming takes a Response OR a Promise<Response>. Resolving it ourselves (and
      // passing the derived promise through, which the spec accepts) reads the URL without racing
      // the instantiation that consumes it.
      if (streaming && src && typeof src.then === "function") {
        first = src.then(function (r) { hint = srcOf(r); return r; });
      } else {
        hint = srcOf(src);
      }
      var p = orig.call(WebAssembly, first, imports);
      if (!p || typeof p.then !== "function") return p;
      return p.then(function (r) {
        note(r && r.instance ? r.instance : r, hint);   // {module,instance}, or a bare Instance
        return r;
      });
    };
  }
  function wrapCtor(Orig, after) {
    function Wrapped() {
      var o = new (Function.prototype.bind.apply(Orig, [null].concat([].slice.call(arguments))))();
      after(o);
      return o;
    }
    Wrapped.prototype = Orig.prototype;   // keeps `x instanceof WebAssembly.Instance` true
    return Wrapped;
  }

  try { if (WebAssembly.instantiate) WebAssembly.instantiate = wrapAsync(WebAssembly.instantiate, false); } catch (e) {}
  try { if (WebAssembly.instantiateStreaming) WebAssembly.instantiateStreaming = wrapAsync(WebAssembly.instantiateStreaming, true); } catch (e) {}
  try { WebAssembly.Instance = wrapCtor(WebAssembly.Instance, function (o) { note(o, ""); }); } catch (e) {}
  try { WebAssembly.Memory   = wrapCtor(WebAssembly.Memory, noteMem); } catch (e) {}

  function bytes(kind) {
    try { return seen[kind] ? seen[kind].mem.buffer.byteLength : 0; } catch (e) { return 0; }
  }
  WebAssembly.__tndProbe = {
    mb:     function (kind) { return bytes(kind) / 1048576; },         // the LIVE module's size
    count:  function (kind) { return seen[kind] ? seen[kind].n : 0; }, // instantiations ever
    caught: function () { return Object.keys(seen).length; },
    list:   function () {
      var out = [], ks = Object.keys(seen), i;
      for (i = 0; i < ks.length; i++) {
        out.push({ kind: ks[i], mb: bytes(ks[i]) / 1048576, n: seen[ks[i]].n, src: seen[ks[i]].src });
      }
      return out;
    }
  };
})();
