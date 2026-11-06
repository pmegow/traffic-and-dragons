/* TnD Maps 0.13.0 — assembled from src/ by dev/bundle.js; edit src/, not this file. */
/* ───── 00-core.js ───── */
/* 00-core.js — the TnDMaps namespace, version marker, loud failure, seeded PRNG, hashing, base64 and small utilities.
   Every module attaches to root.TnDMaps; nothing here touches the DOM. ES5.1 only (dev/check-es5.js). */
(function (root) {
  "use strict";
  var NS = root.TnDMaps = root.TnDMaps || {};
  NS.VERSION = "0.13.0";
  NS.DOC_FORMAT = "tndmap";
  NS.DOC_VER = 6;

  var imul = Math.imul || function (a, b) {
    var ah = (a >>> 16) & 0xffff, al = a & 0xffff, bh = (b >>> 16) & 0xffff, bl = b & 0xffff;
    return ((al * bl) + (((ah * bl + al * bh) << 16) >>> 0)) | 0;
  };

  /* ── loud failure ── A refused input or an impossible state throws here, with the reason and the data that caused
     it. Nothing in the library swallows an error and renders something else. */
  function fail(message, info) {
    var e = new Error("TnDMaps: " + message + (info === undefined ? "" : " — " + safeJson(info)));
    e.name = "TnDMapsError"; e.info = info;
    throw e;
  }
  function safeJson(v) { try { var s = JSON.stringify(v); return s.length > 300 ? s.slice(0, 297) + "..." : s; } catch (e) { return String(v); } }
  function assert(cond, message, info) { if (!cond) fail(message, info); }

  /* ── hashing ── murmur3-flavoured 32-bit string hash; the seed of every PRNG and every fork. */
  function hash32(str, salt) {
    var h = ((salt | 0) ^ 0x9747b28c) >>> 0, i, k, s = String(str);
    for (i = 0; i < s.length; i++) { k = s.charCodeAt(i); h = imul(h ^ k, 0x5bd1e995) >>> 0; h ^= h >>> 15; }
    h = imul(h ^ (h >>> 16), 0x85ebca6b) >>> 0; h ^= h >>> 13; h = imul(h, 0xc2b2ae35) >>> 0; h ^= h >>> 16;
    return h >>> 0;
  }

  /* ── PRNG ── sfc32, seeded from a string. fork(label) derives an independent stream from the ORIGINAL seed and the
     label, so a stage's randomness never depends on how much an earlier stage consumed. */
  function Rng(seed) {
    var seedStr = String(seed);
    var a = hash32(seedStr, 1), b = hash32(seedStr, 2), c = hash32(seedStr, 3), d = hash32(seedStr, 4), i;
    function next() {
      var t = (((a + b) | 0) + d) | 0; d = (d + 1) | 0; a = b ^ (b >>> 9); b = (c + (c << 3)) | 0;
      c = (c << 21) | (c >>> 11); c = (c + t) | 0; return (t >>> 0) / 4294967296;
    }
    for (i = 0; i < 12; i++) next();
    return {
      seed: seedStr,
      float: next,
      range: function (lo, hi) { return lo + (hi - lo) * next(); },
      int: function (n) { return Math.floor(next() * n); },
      chance: function (p) { return next() < p; },
      pick: function (arr) { assert(arr && arr.length, "pick from an empty list"); return arr[Math.floor(next() * arr.length)]; },
      shuffle: function (arr) { var out = arr.slice(), j, k, t; for (j = out.length - 1; j > 0; j--) { k = Math.floor(next() * (j + 1)); t = out[j]; out[j] = out[k]; out[k] = t; } return out; },
      gauss: function () { var u = 0, v = 0; while (u === 0) u = next(); while (v === 0) v = next(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); },
      fork: function (label) { return Rng(seedStr + "/" + label); }
    };
  }

  /* ── base64 ── for the byte fields in a map document; environment-independent (no btoa, no Buffer). */
  var B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  function bytesToBase64(bytes) {
    var out = "", i, n = bytes.length, b0, b1, b2;
    for (i = 0; i < n; i += 3) {
      b0 = bytes[i] & 255; b1 = i + 1 < n ? bytes[i + 1] & 255 : 0; b2 = i + 2 < n ? bytes[i + 2] & 255 : 0;
      out += B64[b0 >> 2] + B64[((b0 & 3) << 4) | (b1 >> 4)] + (i + 1 < n ? B64[((b1 & 15) << 2) | (b2 >> 6)] : "=") + (i + 2 < n ? B64[b2 & 63] : "=");
    }
    return out;
  }
  function base64ToBytes(str) {
    var s = String(str).replace(/[^A-Za-z0-9+\/]/g, ""), out = [], i, c0, c1, c2, c3;
    for (i = 0; i < s.length; i += 4) {
      c0 = B64.indexOf(s[i]); c1 = B64.indexOf(s[i + 1]); c2 = i + 2 < s.length ? B64.indexOf(s[i + 2]) : -1; c3 = i + 3 < s.length ? B64.indexOf(s[i + 3]) : -1;
      out.push(((c0 << 2) | (c1 >> 4)) & 255);
      if (c2 >= 0) out.push(((c1 & 15) << 4) | (c2 >> 2));
      if (c3 >= 0) out.push(((c2 & 3) << 6) | c3);
    }
    return out;
  }

  /* ── a document's byte fields, decoded once ── the decoded bytes are the library's own, never a property of the
     caller's document: a read leaves a document as it was, and a frozen one is read all the same. The last few fields
     decoded are kept and found again by the encoded string itself — the same field, in the same document or in a copy
     of it, is the same string. The bytes are shared: read them, never write them. */
  var FIELD_CACHE = [], FIELD_CACHE_MAX = 6;
  function fieldBytes(str) {
    var i, hit;
    assert(typeof str === "string", "a byte field is a base64 string", { got: typeof str });
    for (i = FIELD_CACHE.length - 1; i >= 0; i--) if (FIELD_CACHE[i].str === str) { hit = FIELD_CACHE.splice(i, 1)[0]; FIELD_CACHE.push(hit); return hit.bytes; }
    hit = { str: str, bytes: base64ToBytes(str) }; FIELD_CACHE.push(hit);
    if (FIELD_CACHE.length > FIELD_CACHE_MAX) FIELD_CACHE.shift();
    return hit.bytes;
  }
  /* ── a table's own entry under a caller's name, or undefined ── a table is never answered out of Object.prototype:
     "toString", "constructor" and "__proto__" are unknown names like any other. Every lookup a caller's string picks
     — a generator kind, a document's generator name, a culture, a size, an edit's op or kind — goes through here. */
  function own(table, key) { return (typeof key === "string" || typeof key === "number") && Object.prototype.hasOwnProperty.call(table, key) ? table[key] : undefined; }

  /* ── small utilities ── */
  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function smoothstep(a, b, t) { t = clamp((t - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); }
  function round(v, places) { var m = Math.pow(10, places || 0); return Math.round(v * m) / m; }
  function extend(target) { var i, k, s; for (i = 1; i < arguments.length; i++) { s = arguments[i]; if (!s) continue; for (k in s) if (Object.prototype.hasOwnProperty.call(s, k)) target[k] = s[k]; } return target; }
  function isNum(v) { return typeof v === "number" && isFinite(v); }

  /* ── binary min-heap ── used by priority-flood, Dijkstra and A*. less(a, b) orders the items. */
  function Heap(less) {
    var a = [];
    function swap(i, j) { var t = a[i]; a[i] = a[j]; a[j] = t; }
    function up(i) { var p; while (i > 0) { p = (i - 1) >> 1; if (less(a[i], a[p])) { swap(i, p); i = p; } else break; } }
    function down(i) { var n = a.length, l, r, m; for (;;) { l = 2 * i + 1; r = l + 1; m = i; if (l < n && less(a[l], a[m])) m = l; if (r < n && less(a[r], a[m])) m = r; if (m === i) break; swap(i, m); i = m; } }
    return {
      push: function (x) { a.push(x); up(a.length - 1); },
      pop: function () { var top = a[0], last = a.pop(); if (a.length) { a[0] = last; down(0); } return top; },
      size: function () { return a.length; }
    };
  }

  NS.fail = fail; NS.assert = assert; NS.hash32 = hash32; NS.Rng = Rng;
  NS.bytesToBase64 = bytesToBase64; NS.base64ToBytes = base64ToBytes; NS.fieldBytes = fieldBytes; NS.own = own;
  function titleCase(s) { return String(s).trim().replace(/\s+/g, " ").replace(/(^|\s)(\S)/g, function (m, sp, ch) { return sp + ch.toUpperCase(); }); }
  NS.util = { clamp: clamp, lerp: lerp, smoothstep: smoothstep, round: round, extend: extend, isNum: isNum, Heap: Heap, imul: imul, titleCase: titleCase };
})(typeof self !== "undefined" ? self : typeof global !== "undefined" ? global : this);

/* ───── 10-noise.js ───── */
/* 10-noise.js — seeded 2D simplex noise and fractal sums. Pure functions of (seed, x, y): the same seed gives the same
   field in every environment, which is what makes a map document reproducible. */
(function (root) {
  "use strict";
  var NS = root.TnDMaps;
  var F2 = 0.5 * (Math.sqrt(3) - 1), G2 = (3 - Math.sqrt(3)) / 6;
  var GRAD = [[1, 1], [-1, 1], [1, -1], [-1, -1], [1, 0], [-1, 0], [0, 1], [0, -1]];

  /* Noise(seedLabel) → { noise2, fbm, ridged }. The permutation table is shuffled with the seeded PRNG. */
  function Noise(seed) {
    var rng = NS.Rng(seed), p = [], perm = new Array(512), i;
    for (i = 0; i < 256; i++) p.push(i);
    p = rng.shuffle(p);
    for (i = 0; i < 512; i++) perm[i] = p[i & 255];

    /* classic 2D simplex (Gustavson), output in roughly [-1, 1] */
    function noise2(xin, yin) {
      var s = (xin + yin) * F2, i0 = Math.floor(xin + s), j0 = Math.floor(yin + s), t = (i0 + j0) * G2;
      var x0 = xin - (i0 - t), y0 = yin - (j0 - t), i1, j1;
      if (x0 > y0) { i1 = 1; j1 = 0; } else { i1 = 0; j1 = 1; }
      var x1 = x0 - i1 + G2, y1 = y0 - j1 + G2, x2 = x0 - 1 + 2 * G2, y2 = y0 - 1 + 2 * G2;
      var ii = i0 & 255, jj = j0 & 255, n = 0, tt, g;
      tt = 0.5 - x0 * x0 - y0 * y0; if (tt > 0) { g = GRAD[perm[ii + perm[jj]] & 7]; tt *= tt; n += tt * tt * (g[0] * x0 + g[1] * y0); }
      tt = 0.5 - x1 * x1 - y1 * y1; if (tt > 0) { g = GRAD[perm[ii + i1 + perm[jj + j1]] & 7]; tt *= tt; n += tt * tt * (g[0] * x1 + g[1] * y1); }
      tt = 0.5 - x2 * x2 - y2 * y2; if (tt > 0) { g = GRAD[perm[ii + 1 + perm[jj + 1]] & 7]; tt *= tt; n += tt * tt * (g[0] * x2 + g[1] * y2); }
      return 70 * n;
    }
    /* fractal Brownian motion, normalised to [-1, 1] */
    function fbm(x, y, octaves, lacunarity, gain) {
      var sum = 0, amp = 1, norm = 0, f = 1, o;
      octaves = octaves || 5; lacunarity = lacunarity || 2; gain = gain || 0.5;
      for (o = 0; o < octaves; o++) { sum += amp * noise2(x * f, y * f); norm += amp; amp *= gain; f *= lacunarity; }
      return sum / norm;
    }
    /* ridged multifractal: sharp crests for mountain cores, in [0, 1] */
    function ridged(x, y, octaves) {
      var sum = 0, amp = 0.5, f = 1, o, v;
      octaves = octaves || 4;
      for (o = 0; o < octaves; o++) { v = 1 - Math.abs(noise2(x * f, y * f)); sum += v * v * amp; amp *= 0.5; f *= 2; }
      return sum;
    }
    return { noise2: noise2, fbm: fbm, ridged: ridged };
  }

  NS.Noise = Noise;
})(typeof self !== "undefined" ? self : typeof global !== "undefined" ? global : this);

/* ───── 20-geom.js ───── */
/* 20-geom.js — geometry on grids and polylines: the node grid, bilinear sampling, marching squares with frame
   stitching, simplify/smooth/resample/wobble, connected components, areas, bearings. Screen coordinates: x right,
   y down; "left" of a direction d is [d.y, -d.x]. Contours are oriented with the inside (value >= threshold) on the left. */
(function (root) {
  "use strict";
  var NS = root.TnDMaps, U = NS.util;

  /* ── the node grid ── cols × rows samples spanning a w × h frame; node (c, r) sits at (c·dx, r·dy). */
  function Grid(cols, rows, w, h) {
    NS.assert(cols >= 8 && rows >= 8, "grid needs at least 8×8 nodes", { cols: cols, rows: rows });
    var g = { cols: cols, rows: rows, w: w, h: h, dx: w / (cols - 1), dy: h / (rows - 1), n: cols * rows };
    g.idx = function (c, r) { return r * cols + c; };
    g.col = function (i) { return i % cols; };
    g.row = function (i) { return Math.floor(i / cols); };
    g.x = function (c) { return c * g.dx; };
    g.y = function (r) { return r * g.dy; };
    g.px = function (i) { return (i % cols) * g.dx; };
    g.py = function (i) { return Math.floor(i / cols) * g.dy; };
    g.inside = function (c, r) { return c >= 0 && r >= 0 && c < cols && r < rows; };
    g.onBorder = function (i) { var c = i % cols, r = Math.floor(i / cols); return c === 0 || r === 0 || c === cols - 1 || r === rows - 1; };
    /* 8 neighbours as indices, with the step length factor (1 or √2) */
    g.neighbors8 = function (i, fn) {
      var c = i % cols, r = Math.floor(i / cols), dc, dr, cc, rr;
      for (dr = -1; dr <= 1; dr++) for (dc = -1; dc <= 1; dc++) {
        if (!dc && !dr) continue; cc = c + dc; rr = r + dr;
        if (cc < 0 || rr < 0 || cc >= cols || rr >= rows) continue;
        fn(rr * cols + cc, (dc && dr) ? 1.4142135623730951 : 1);
      }
    };
    g.neighbors4 = function (i, fn) {
      var c = i % cols, r = Math.floor(i / cols);
      if (c > 0) fn(i - 1); if (c < cols - 1) fn(i + 1); if (r > 0) fn(i - cols); if (r < rows - 1) fn(i + cols);
    };
    /* bilinear sample of a node field at map coordinates (clamped to the frame) */
    g.sample = function (field, x, y) {
      var fx = U.clamp(x / g.dx, 0, cols - 1), fy = U.clamp(y / g.dy, 0, rows - 1);
      var c0 = Math.floor(fx), r0 = Math.floor(fy), c1 = Math.min(c0 + 1, cols - 1), r1 = Math.min(r0 + 1, rows - 1);
      var tx = fx - c0, ty = fy - r0;
      var v00 = field[r0 * cols + c0], v10 = field[r0 * cols + c1], v01 = field[r1 * cols + c0], v11 = field[r1 * cols + c1];
      return (v00 * (1 - tx) + v10 * tx) * (1 - ty) + (v01 * (1 - tx) + v11 * tx) * ty;
    };
    /* nearest node index to a map coordinate */
    g.nearest = function (x, y) { return U.clamp(Math.round(y / g.dy), 0, rows - 1) * cols + U.clamp(Math.round(x / g.dx), 0, cols - 1); };
    return g;
  }

  /* ── marching squares ── contoursFromField → { closed: [chain], open: [chain] }, chains are point arrays oriented
     inside-left. Crossing points are identified by the grid EDGE they lie on, so chains join exactly. */
  function contoursFromField(field, g, threshold) {
    var cols = g.cols, rows = g.rows, segs = [], byStart = {}, c, r, i;
    /* a node exactly AT the threshold would put a crossing on the node itself, shared by two edge keys; nudge the
       threshold by a relative hair so "inside" (v > threshold) is never a tie */
    for (i = 0; i < g.n; i++) { if (field[i] === threshold) { threshold += 1e-9 * (Math.abs(threshold) + 1); i = -1; } }
    function edgePoint(c0, r0, c1, r1) {
      var v0 = field[r0 * cols + c0], v1 = field[r1 * cols + c1], t = (threshold - v0) / (v1 - v0);
      if (!(t >= 0 && t <= 1)) t = U.clamp(t, 0, 1);
      return [g.x(c0) + (g.x(c1) - g.x(c0)) * t, g.y(r0) + (g.y(r1) - g.y(r0)) * t];
    }
    function hKey(c0, r0) { return (r0 * cols + c0) * 2; }         /* horizontal edge (c0,r0)-(c0+1,r0) */
    function vKey(c0, r0) { return (r0 * cols + c0) * 2 + 1; }     /* vertical edge (c0,r0)-(c0,r0+1) */
    /* orient so the inside is on the left, EXACTLY from the corner table: the chord between two edge crossings cuts a
       corner off its cell (adjacent edges share that corner) or splits the cell in two (opposite edges: take TL as the
       witness). The witness corner's side is the inside side iff the witness is inside. */
    function addSeg(ea, eb, witness, witnessInside) {
      var pa = ea.p, pb = eb.p, dx = pb[0] - pa[0], dy = pb[1] - pa[1];
      var leftOf = (witness[0] - pa[0]) * dy - (witness[1] - pa[1]) * dx > 0;
      if (leftOf === witnessInside) segs.push({ a: ea.k, b: eb.k, pa: pa, pb: pb });
      else segs.push({ a: eb.k, b: ea.k, pa: pb, pb: pa });
    }
    for (r = 0; r < rows - 1; r++) for (c = 0; c < cols - 1; c++) {
      var tl = field[r * cols + c] > threshold, tr = field[r * cols + c + 1] > threshold;
      var br = field[(r + 1) * cols + c + 1] > threshold, bl = field[(r + 1) * cols + c] > threshold;
      var code = (tl ? 8 : 0) | (tr ? 4 : 0) | (br ? 2 : 0) | (bl ? 1 : 0);
      if (code === 0 || code === 15) continue;
      var x0 = g.x(c), x1 = g.x(c + 1), y0 = g.y(r), y1 = g.y(r + 1);
      var TL = [x0, y0], TR = [x1, y0], BR = [x1, y1], BL = [x0, y1];
      var top = null, right = null, bottom = null, left = null;
      if (tl !== tr) top = { k: hKey(c, r), p: edgePoint(c, r, c + 1, r) };
      if (tr !== br) right = { k: vKey(c + 1, r), p: edgePoint(c + 1, r, c + 1, r + 1) };
      if (bl !== br) bottom = { k: hKey(c, r + 1), p: edgePoint(c, r + 1, c + 1, r + 1) };
      if (tl !== bl) left = { k: vKey(c, r), p: edgePoint(c, r, c, r + 1) };
      if (code === 5 || code === 10) {
        /* saddle: the centre value decides. Centre inside → the two inside corners join across the cell and each
           chord cuts off an OUTSIDE corner; centre outside → each chord cuts off an inside corner. */
        var centre = (field[r * cols + c] + field[r * cols + c + 1] + field[(r + 1) * cols + c + 1] + field[(r + 1) * cols + c]) / 4 > threshold;
        if ((code === 5) !== centre) { addSeg(top, right, TR, tr); addSeg(bottom, left, BL, bl); }
        else { addSeg(top, left, TL, tl); addSeg(right, bottom, BR, br); }
      } else if (top && right) addSeg(top, right, TR, tr);
      else if (right && bottom) addSeg(right, bottom, BR, br);
      else if (bottom && left) addSeg(bottom, left, BL, bl);
      else if (left && top) addSeg(left, top, TL, tl);
      else if (top && bottom) addSeg(top, bottom, TL, tl);
      else addSeg(left, right, TL, tl);
    }
    for (i = 0; i < segs.length; i++) {
      NS.assert(byStart[segs[i].a] === undefined, "two contour segments start on the same grid edge (orientation disagreement)", { edge: segs[i].a, at: segs[i].pa });
      byStart[segs[i].a] = i;
    }
    var used = new Array(segs.length), closed = [], open = [], j, k, chain, s, hasStart;
    /* chains that begin at a border edge (no predecessor) first, then the remaining loops */
    var hasPred = {};
    for (i = 0; i < segs.length; i++) hasPred[segs[i].b] = true;
    for (i = 0; i < segs.length; i++) {
      if (used[i] || hasPred[segs[i].a]) continue;
      chain = [segs[i].pa]; j = i;
      while (j !== undefined && !used[j]) { used[j] = true; s = segs[j]; chain.push(s.pb); j = byStart[s.b]; }
      open.push(chain);
    }
    for (i = 0; i < segs.length; i++) {
      if (used[i]) continue;
      chain = [segs[i].pa]; j = i; hasStart = segs[i].a;
      while (j !== undefined && !used[j]) { used[j] = true; s = segs[j]; chain.push(s.pb); j = byStart[s.b]; if (s.b === hasStart) break; }
      chain.pop(); /* the closing point repeats the first */
      if (chain.length >= 3) closed.push(chain);
    }
    for (k = 0; k < open.length; k++) if (open[k].length < 2) open.splice(k--, 1);
    return { closed: closed, open: open };
  }

  /* ── frame stitching ── open chains are closed along the frame perimeter so every inside region is a polygon.
     Perimeter walk with the frame interior on the left: top edge westward, left edge south, bottom east, right north. */
  function polygonsFromField(field, g, threshold) {
    var raw = contoursFromField(field, g, threshold), W = g.w, H = g.h, P = 2 * (W + H), polys = raw.closed.slice();
    function perimT(p) {
      var x = p[0], y = p[1], e = 1e-6;
      if (Math.abs(y) < e) return W - x;                 /* top: from (W,0) westward */
      if (Math.abs(x) < e) return W + y;                 /* left: southward */
      if (Math.abs(y - H) < e) return W + H + x;         /* bottom: eastward */
      if (Math.abs(x - W) < e) return 2 * W + H + (H - y); /* right: northward */
      NS.fail("open contour end is not on the frame", { x: x, y: y, w: W, h: H });
      return 0;
    }
    var corners = [{ t: W, p: [0, 0] }, { t: W + H, p: [0, H] }, { t: 2 * W + H, p: [W, H] }, { t: 2 * W + 2 * H, p: [W, 0] }];
    var chains = raw.open.map(function (ch) { return { pts: ch, tStart: perimT(ch[0]), tEnd: perimT(ch[ch.length - 1]), used: false }; });
    chains.sort(function (a, b) { return a.tStart - b.tStart; });
    function nextStart(tFrom) {
      var best = null, i, c, d;
      for (i = 0; i < chains.length; i++) {
        c = chains[i]; d = c.tStart - tFrom; if (d < 0) d += P; if (d < 1e-9) d = c.tStart === tFrom ? 0 : P;
        if (!best || d < best.d) best = { d: d, c: c };
      }
      return best.c;
    }
    function cornersBetween(tA, tB) { /* corners passed walking forward from tA to tB */
      var out = [], i, t, d, dAB = tB - tA; if (dAB <= 0) dAB += P;
      for (i = 0; i < 4; i++) { t = corners[i].t % P; d = t - tA; if (d <= 0) d += P; if (d < dAB) out.push({ d: d, p: corners[i].p }); }
      out.sort(function (a, b) { return a.d - b.d; });
      return out.map(function (o) { return o.p; });
    }
    var i, start, cur, poly, guard;
    for (i = 0; i < chains.length; i++) {
      start = chains[i]; if (start.used) continue;
      poly = []; cur = start; guard = 0;
      do {
        cur.used = true; poly = poly.concat(cur.pts);
        var nxt = nextStart(cur.tEnd);
        poly = poly.concat(cornersBetween(cur.tEnd, nxt.tStart));
        cur = nxt; guard++;
        NS.assert(guard <= chains.length + 1, "frame stitching did not return to its start");
      } while (cur !== start);
      polys.push(poly);
    }
    if (!raw.open.length && field[0] > threshold) {
      /* no contour reaches the frame and the frame is inside: the frame itself bounds the region (closed chains
         inside it are then holes, e.g. lakes in a landlocked map) */
      polys.push([[0, 0], [0, H], [W, H], [W, 0]]);
    }
    return polys;
  }

  /* ── frame-aware polishing ── a polygon that may run along the frame (a region cut by the map edge): the frame runs
     stay exactly on the frame and only the real boundary between them goes through polishRun(points, closed) — which
     simplifies, smooths, wobbles — with its end points pinned back to the frame. Points are clamped into the frame and
     rounded to `places` decimals. null when fewer than 3 points remain. */
  function polishFramePolygon(poly, W, H, polishRun, places) {
    var n = poly.length, i, k, start = -1, out = [], run, p, sm;
    function onFrame(q) { return q[0] <= 1e-6 || q[1] <= 1e-6 || q[0] >= W - 1e-6 || q[1] >= H - 1e-6; }
    function fix(q) { return [U.round(U.clamp(q[0], 0, W), places), U.round(U.clamp(q[1], 0, H), places)]; }
    for (i = 0; i < n; i++) if (onFrame(poly[i])) { start = i; break; }
    if (start < 0) { sm = polishRun(poly, true); return sm && sm.length >= 3 ? sm.map(fix) : null; }
    for (k = 0; k < n; k++) {
      p = poly[(start + k) % n];
      if (onFrame(p)) { out.push(fix(p)); continue; }
      run = [poly[(start + k - 1 + n) % n]];
      while (k < n && !onFrame(poly[(start + k) % n])) { run.push(poly[(start + k) % n]); k++; }
      run.push(poly[(start + k) % n]); k--;
      sm = polishRun(run, false); if (!sm || sm.length < 2) continue;
      for (i = 1; i < sm.length - 1; i++) out.push(fix(sm[i]));
    }
    return out.length >= 3 ? out : null;
  }

  /* ── polylines ── */
  function dist(a, b) { var dx = a[0] - b[0], dy = a[1] - b[1]; return Math.sqrt(dx * dx + dy * dy); }
  function length(pts, closed) { var L = 0, i; for (i = 1; i < pts.length; i++) L += dist(pts[i - 1], pts[i]); if (closed && pts.length > 1) L += dist(pts[pts.length - 1], pts[0]); return L; }
  /* Ramer–Douglas–Peucker */
  function simplify(pts, tol) {
    if (pts.length < 3) return pts.slice();
    var keep = new Array(pts.length), stack = [[0, pts.length - 1]], i, seg, a, b, maxD, idx, d;
    keep[0] = keep[pts.length - 1] = true;
    while (stack.length) {
      seg = stack.pop(); a = pts[seg[0]]; b = pts[seg[1]]; maxD = -1; idx = -1;
      for (i = seg[0] + 1; i < seg[1]; i++) { d = pointSegDist(pts[i], a, b); if (d > maxD) { maxD = d; idx = i; } }
      if (maxD > tol) { keep[idx] = true; stack.push([seg[0], idx]); stack.push([idx, seg[1]]); }
    }
    var out = []; for (i = 0; i < pts.length; i++) if (keep[i]) out.push(pts[i]);
    return out;
  }
  function pointSegDist(p, a, b) {
    var dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy, t = l2 ? U.clamp(((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2, 0, 1) : 0;
    return dist(p, [a[0] + t * dx, a[1] + t * dy]);
  }
  /* Chaikin corner cutting; an open polyline keeps its end points */
  function smooth(pts, iterations, closed) {
    var out = pts, it, i, n, a, b, next;
    for (it = 0; it < (iterations || 1); it++) {
      n = out.length; next = [];
      if (closed) {
        for (i = 0; i < n; i++) { a = out[i]; b = out[(i + 1) % n]; next.push([0.75 * a[0] + 0.25 * b[0], 0.75 * a[1] + 0.25 * b[1]]); next.push([0.25 * a[0] + 0.75 * b[0], 0.25 * a[1] + 0.75 * b[1]]); }
      } else {
        if (n < 3) return out.slice();
        next.push(out[0]);
        for (i = 0; i < n - 1; i++) { a = out[i]; b = out[i + 1]; next.push([0.75 * a[0] + 0.25 * b[0], 0.75 * a[1] + 0.25 * b[1]]); next.push([0.25 * a[0] + 0.75 * b[0], 0.25 * a[1] + 0.75 * b[1]]); }
        next.push(out[n - 1]);
      }
      out = next;
    }
    return out;
  }
  /* points at equal spacing along a polyline (first point kept; last point kept for open lines) */
  function resample(pts, spacing, closed) {
    var src = closed ? pts.concat([pts[0]]) : pts, out = [src[0]], carry = 0, i, a, b, segLen, t, pos;
    for (i = 1; i < src.length; i++) {
      a = src[i - 1]; b = src[i]; segLen = dist(a, b); pos = spacing - carry;
      while (pos <= segLen) { t = pos / segLen; out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]); pos += spacing; }
      carry = segLen - (pos - spacing);
    }
    if (!closed && dist(out[out.length - 1], src[src.length - 1]) > spacing * 0.25) out.push(src[src.length - 1]);
    return out;
  }
  /* hand-drawn wobble: displace each point along its normal by amp · noise(x·freq, y·freq) */
  function wobble(pts, noiseFn, amp, freq, closed) {
    var n = pts.length, out = new Array(n), i, prev, next, dx, dy, len, v;
    for (i = 0; i < n; i++) {
      prev = pts[closed ? (i + n - 1) % n : Math.max(i - 1, 0)]; next = pts[closed ? (i + 1) % n : Math.min(i + 1, n - 1)];
      dx = next[0] - prev[0]; dy = next[1] - prev[1]; len = Math.sqrt(dx * dx + dy * dy) || 1;
      v = noiseFn(pts[i][0] * freq, pts[i][1] * freq) * amp;
      out[i] = [pts[i][0] + (dy / len) * v, pts[i][1] - (dx / len) * v];
    }
    return out;
  }
  function signedArea(poly) { var a = 0, i, n = poly.length, p, q; for (i = 0; i < n; i++) { p = poly[i]; q = poly[(i + 1) % n]; a += p[0] * q[1] - q[0] * p[1]; } return a / 2; }
  function centroid(pts) { var x = 0, y = 0, i; for (i = 0; i < pts.length; i++) { x += pts[i][0]; y += pts[i][1]; } return [x / pts.length, y / pts.length]; }
  function bbox(pts) { var b = [Infinity, Infinity, -Infinity, -Infinity], i, p; for (i = 0; i < pts.length; i++) { p = pts[i]; if (p[0] < b[0]) b[0] = p[0]; if (p[1] < b[1]) b[1] = p[1]; if (p[0] > b[2]) b[2] = p[0]; if (p[1] > b[3]) b[3] = p[1]; } return b; }
  function pointInPolygon(p, poly) {
    var inside = false, i, j, n = poly.length, xi, yi, xj, yj;
    for (i = 0, j = n - 1; i < n; j = i++) {
      xi = poly[i][0]; yi = poly[i][1]; xj = poly[j][0]; yj = poly[j][1];
      if (((yi > p[1]) !== (yj > p[1])) && (p[0] < (xj - xi) * (p[1] - yi) / (yj - yi) + xi)) inside = !inside;
    }
    return inside;
  }
  /* principal axis angle of a point cloud, radians in (-π/2, π/2]; 0 = horizontal */
  function principalAngle(pts) {
    var c = centroid(pts), sxx = 0, syy = 0, sxy = 0, i, dx, dy;
    for (i = 0; i < pts.length; i++) { dx = pts[i][0] - c[0]; dy = pts[i][1] - c[1]; sxx += dx * dx; syy += dy * dy; sxy += dx * dy; }
    var a = 0.5 * Math.atan2(2 * sxy, sxx - syy);
    if (a > Math.PI / 2) a -= Math.PI; if (a <= -Math.PI / 2) a += Math.PI;
    return a;
  }
  /* compass bearing from a to b: degrees clockwise from north (0 = N, 90 = E) and its 8-point name */
  var COMPASS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  function bearing(a, b) {
    var deg = Math.atan2(b[0] - a[0], -(b[1] - a[1])) * 180 / Math.PI; if (deg < 0) deg += 360;
    return { deg: deg, name: COMPASS[Math.round(deg / 45) % 8] };
  }

  /* ── connected components ── 4-connected regions of nodes where pred(i) holds, largest first. */
  function components(g, pred, minSize) {
    var seen = new Array(g.n), out = [], i, queue, head, comp, j, sx, sy;
    for (i = 0; i < g.n; i++) {
      if (seen[i] || !pred(i)) continue;
      queue = [i]; seen[i] = true; head = 0; comp = [];
      while (head < queue.length) {
        j = queue[head++]; comp.push(j);
        g.neighbors4(j, function (k) { if (!seen[k] && pred(k)) { seen[k] = true; queue.push(k); } });
      }
      if (comp.length < (minSize || 1)) continue;
      sx = 0; sy = 0;
      for (j = 0; j < comp.length; j++) { sx += g.px(comp[j]); sy += g.py(comp[j]); }
      out.push({ cells: comp, size: comp.length, cx: sx / comp.length, cy: sy / comp.length });
    }
    out.sort(function (a, b) { return b.size - a.size; });
    return out;
  }

  /* the convex hull of a point set (monotone chain) */
  function convexHull(pts) {
    var P = pts.slice().sort(function (a, b) { return a[0] - b[0] || a[1] - b[1]; }), lower = [], upper = [], i, p;
    function cross(o, a, b) { return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]); }
    for (i = 0; i < P.length; i++) { p = P[i]; while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop(); lower.push(p); }
    for (i = P.length - 1; i >= 0; i--) { p = P[i]; while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop(); upper.push(p); }
    lower.pop(); upper.pop(); return lower.concat(upper);
  }
  NS.geom = { convexHull: convexHull,
    Grid: Grid, contoursFromField: contoursFromField, polygonsFromField: polygonsFromField,
    dist: dist, length: length, simplify: simplify, smooth: smooth, resample: resample, wobble: wobble,
    signedArea: signedArea, centroid: centroid, bbox: bbox, pointInPolygon: pointInPolygon, principalAngle: principalAngle,
    bearing: bearing, components: components, pointSegDist: pointSegDist, polishFramePolygon: polishFramePolygon
  };
})(typeof self !== "undefined" ? self : typeof global !== "undefined" ? global : this);

/* ───── 21-mesh.js ───── */
/* 21-mesh.js — the planar substrate the town scale is built on: Delaunay triangulation (Bowyer–Watson), the Voronoi
   cells and edges it implies, and convex-polygon tools (clip to a half-plane or a rectangle, cut across the longest
   edge, per-edge inset, hatching, segment intersection, chaining loose segments into polylines). Pure geometry. */
(function (root) {
  "use strict";
  var NS = root.TnDMaps, G = NS.geom;

  function circumcircle(pts, a, b, c) {
    var A = pts[a], B = pts[b], C = pts[c], ax = A[0], ay = A[1], bx = B[0], by = B[1], cx = C[0], cy = C[1];
    var d = 2 * (ax * (by - cy) + bx * (cy - ay) + cx * (ay - by));
    if (Math.abs(d) < 1e-12) return [(ax + bx + cx) / 3, (ay + by + cy) / 3, Infinity]; /* collinear: swallowed by the next insertion */
    var a2 = ax * ax + ay * ay, b2 = bx * bx + by * by, c2 = cx * cx + cy * cy;
    var ux = (a2 * (by - cy) + b2 * (cy - ay) + c2 * (ay - by)) / d, uy = (a2 * (cx - bx) + b2 * (ax - cx) + c2 * (bx - ax)) / d;
    return [ux, uy, (ux - ax) * (ux - ax) + (uy - ay) * (uy - ay)];
  }

  /* ── Delaunay ── points [[x, y], ...] → { tris: [[a, b, c]], circ: [[cx, cy, r²]] } with indices into points.
     Bowyer–Watson behind a super-triangle; O(n²), fine for the thousand points a city needs. */
  function delaunay(points) {
    var n = points.length, i, j, k;
    NS.assert(n >= 3, "delaunay needs at least 3 points", { n: n });
    var bb = G.bbox(points), cx = (bb[0] + bb[2]) / 2, cy = (bb[1] + bb[3]) / 2, span = Math.max(bb[2] - bb[0], bb[3] - bb[1]) * 20 + 10;
    var pts = points.slice(); pts.push([cx - span, cy - span], [cx + span, cy - span], [cx, cy + span]);
    var tris = [[n, n + 1, n + 2]], circ = [circumcircle(pts, n, n + 1, n + 2)];
    for (i = 0; i < n; i++) {
      var p = pts[i], bad = [], edges = {}, edgeList = [], c, dx, dy, t, a, b, key, e;
      for (j = 0; j < tris.length; j++) { c = circ[j]; dx = p[0] - c[0]; dy = p[1] - c[1]; if (dx * dx + dy * dy < c[2]) bad.push(j); }
      for (j = 0; j < bad.length; j++) {
        t = tris[bad[j]];
        for (k = 0; k < 3; k++) {
          a = t[k]; b = t[(k + 1) % 3]; key = a < b ? a + "_" + b : b + "_" + a;
          if (edges[key]) edges[key].n++; else { edges[key] = { a: a, b: b, n: 1 }; edgeList.push(edges[key]); }
        }
      }
      for (j = bad.length - 1; j >= 0; j--) { tris.splice(bad[j], 1); circ.splice(bad[j], 1); }
      for (j = 0; j < edgeList.length; j++) { e = edgeList[j]; if (e.n !== 1) continue; tris.push([e.a, e.b, i]); circ.push(circumcircle(pts, e.a, e.b, i)); }
    }
    var outT = [], outC = [];
    for (j = 0; j < tris.length; j++) { if (tris[j][0] >= n || tris[j][1] >= n || tris[j][2] >= n) continue; outT.push(tris[j]); outC.push(circ[j]); }
    return { tris: outT, circ: outC };
  }

  /* ── Voronoi ── from a Delaunay result: cells[i] = the polygon around point i (its triangles' circumcentres in angular
     order) or null for a hull point (open cell — callers ring the area of interest with far points so every cell that
     matters is closed); edges = [{ a, b, t1, t2, p, q }], the Voronoi edge between neighbouring points a and b running
     from circumcentre p (triangle t1) to q (triangle t2). Vertices are identified by triangle index. */
  function voronoi(points, D) {
    var n = points.length, around = new Array(n), cells = new Array(n), edges = {}, edgeList = [], hull = new Array(n), i, j, t, a, b, key, e;
    for (i = 0; i < n; i++) around[i] = [];
    for (j = 0; j < D.tris.length; j++) {
      t = D.tris[j];
      for (i = 0; i < 3; i++) {
        around[t[i]].push(j);
        a = t[i]; b = t[(i + 1) % 3]; key = a < b ? a + "_" + b : b + "_" + a; e = edges[key];
        if (!e) { edges[key] = { a: Math.min(a, b), b: Math.max(a, b), t1: j, t2: -1 }; edgeList.push(edges[key]); } else e.t2 = j;
      }
    }
    for (j = 0; j < edgeList.length; j++) if (edgeList[j].t2 < 0) { hull[edgeList[j].a] = true; hull[edgeList[j].b] = true; }
    for (i = 0; i < n; i++) {
      if (hull[i] || !around[i].length) { cells[i] = null; continue; }
      var p = points[i], ids = around[i].slice(), poly = [];
      ids.sort(function (x, y) { var cx = D.circ[x], cy = D.circ[y]; return Math.atan2(cx[1] - p[1], cx[0] - p[0]) - Math.atan2(cy[1] - p[1], cy[0] - p[0]); });
      for (j = 0; j < ids.length; j++) poly.push([D.circ[ids[j]][0], D.circ[ids[j]][1]]);
      cells[i] = { poly: poly, verts: ids };
    }
    var out = [];
    for (j = 0; j < edgeList.length; j++) {
      e = edgeList[j]; if (e.t2 < 0) continue;
      out.push({ a: e.a, b: e.b, t1: e.t1, t2: e.t2, p: [D.circ[e.t1][0], D.circ[e.t1][1]], q: [D.circ[e.t2][0], D.circ[e.t2][1]] });
    }
    return { cells: cells, edges: out };
  }

  /* ── convex polygon tools ── */
  /* keep the side of the line nx·x + ny·y >= c (Sutherland–Hodgman against one half-plane) */
  function clipHalf(poly, nx, ny, c) {
    var out = [], n = poly.length, i, a, b, da, db, t;
    for (i = 0; i < n; i++) {
      a = poly[i]; b = poly[(i + 1) % n]; da = nx * a[0] + ny * a[1] - c; db = nx * b[0] + ny * b[1] - c;
      if (da >= 0) out.push(a);
      if ((da >= 0) !== (db >= 0)) { t = da / (da - db); out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]); }
    }
    return out;
  }
  function clipRect(poly, x0, y0, x1, y1) {
    var out = clipHalf(poly, 1, 0, x0); if (out.length < 3) return [];
    out = clipHalf(out, -1, 0, -x1); if (out.length < 3) return [];
    out = clipHalf(out, 0, 1, y0); if (out.length < 3) return [];
    out = clipHalf(out, 0, -1, -y1); return out.length < 3 ? [] : out;
  }
  /* drop repeated points and vertices whose edges are nearly collinear */
  function tidy(poly, minEdge) {
    var out = [], n = poly.length, i, a, b, c, ex, ey, fx, fy, cross, dot;
    minEdge = minEdge || 1e-6;
    for (i = 0; i < n; i++) { a = out.length ? out[out.length - 1] : null; if (!a || G.dist(a, poly[i]) > minEdge) out.push(poly[i]); }
    if (out.length > 1 && G.dist(out[0], out[out.length - 1]) <= minEdge) out.pop();
    n = out.length;
    if (n < 3) return out;
    var kept = [];
    for (i = 0; i < n; i++) {
      a = out[(i + n - 1) % n]; b = out[i]; c = out[(i + 1) % n];
      ex = b[0] - a[0]; ey = b[1] - a[1]; fx = c[0] - b[0]; fy = c[1] - b[1];
      cross = ex * fy - ey * fx; dot = ex * fx + ey * fy;
      if (Math.abs(cross) < 1e-9 && dot > 0) continue; /* straight through */
      kept.push(b);
    }
    return kept;
  }
  /* inset a convex polygon: edge i (from v[i] to v[i+1]) moves inward by d (a number) or d[i]; the result is the
     intersection of the offset half-planes, so an edge that vanishes simply vanishes. null when nothing is left. */
  function insetConvex(poly, d) {
    var n = poly.length, area = G.signedArea(poly), s = area > 0 ? 1 : -1, out = poly, i, a, b, ex, ey, len, nx, ny, di;
    if (Math.abs(area) < 1e-9) return null;
    for (i = 0; i < n; i++) {
      a = poly[i]; b = poly[(i + 1) % n]; ex = b[0] - a[0]; ey = b[1] - a[1]; len = Math.sqrt(ex * ex + ey * ey);
      if (len < 1e-9) continue;
      nx = -ey / len * s; ny = ex / len * s; di = typeof d === "number" ? d : d[i];
      out = clipHalf(out, nx, ny, nx * a[0] + ny * a[1] + di);
      if (out.length < 3) return null;
    }
    out = tidy(out, 1e-6);
    return out.length >= 3 && Math.abs(G.signedArea(out)) > 1e-6 ? out : null;
  }
  /* cut a convex polygon across its longest edge: perpendicular to that edge, through the point at fraction t of it */
  function cutAcross(poly, t) {
    var n = poly.length, i, best = -1, bl = -1, a, b, len, ex, ey, px, py, c;
    for (i = 0; i < n; i++) { a = poly[i]; b = poly[(i + 1) % n]; len = G.dist(a, b); if (len > bl) { bl = len; best = i; } }
    a = poly[best]; b = poly[(best + 1) % n]; ex = (b[0] - a[0]) / bl; ey = (b[1] - a[1]) / bl;
    px = a[0] + (b[0] - a[0]) * t; py = a[1] + (b[1] - a[1]) * t; c = ex * px + ey * py;
    return [tidy(clipHalf(poly, ex, ey, c)), tidy(clipHalf(poly, -ex, -ey, -c))];
  }
  /* the longest and shortest extents of a convex polygon along its principal axis and across it */
  function extents(poly) {
    var ang = G.principalAngle(poly), ca = Math.cos(ang), sa = Math.sin(ang), i, u, v, lo1 = Infinity, hi1 = -Infinity, lo2 = Infinity, hi2 = -Infinity;
    for (i = 0; i < poly.length; i++) { u = poly[i][0] * ca + poly[i][1] * sa; v = -poly[i][0] * sa + poly[i][1] * ca; if (u < lo1) lo1 = u; if (u > hi1) hi1 = u; if (v < lo2) lo2 = v; if (v > hi2) hi2 = v; }
    return { angle: ang, along: hi1 - lo1, across: hi2 - lo2, centre: [(lo1 + hi1) / 2 * ca - (lo2 + hi2) / 2 * sa, (lo1 + hi1) / 2 * sa + (lo2 + hi2) / 2 * ca] };
  }
  /* parallel hatch lines across a convex polygon: direction angle, every `spacing`, phase in [0, 1) → [[a, b], ...] */
  function hatch(poly, angle, spacing, phase) {
    var dx = Math.cos(angle), dy = Math.sin(angle), nx = -dy, ny = dx, i, j, lo = Infinity, hi = -Infinity, v, out = [], hits, a, b, da, db, t;
    for (i = 0; i < poly.length; i++) { v = poly[i][0] * nx + poly[i][1] * ny; if (v < lo) lo = v; if (v > hi) hi = v; }
    for (v = lo + spacing * (0.5 + (phase || 0)); v < hi; v += spacing) {
      hits = [];
      for (j = 0; j < poly.length; j++) {
        a = poly[j]; b = poly[(j + 1) % poly.length]; da = a[0] * nx + a[1] * ny - v; db = b[0] * nx + b[1] * ny - v;
        if ((da >= 0) !== (db >= 0)) { t = da / (da - db); hits.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]); }
      }
      if (hits.length >= 2) out.push([hits[0], hits[1]]);
    }
    return out;
  }
  /* intersection of segments p1-p2 and p3-p4: [x, y, t, u] or null */
  function segIntersect(p1, p2, p3, p4) {
    var d = (p2[0] - p1[0]) * (p4[1] - p3[1]) - (p2[1] - p1[1]) * (p4[0] - p3[0]);
    if (Math.abs(d) < 1e-12) return null;
    var t = ((p3[0] - p1[0]) * (p4[1] - p3[1]) - (p3[1] - p1[1]) * (p4[0] - p3[0])) / d, u = ((p3[0] - p1[0]) * (p2[1] - p1[1]) - (p3[1] - p1[1]) * (p2[0] - p1[0])) / d;
    if (t < 0 || t > 1 || u < 0 || u > 1) return null;
    return [p1[0] + t * (p2[0] - p1[0]), p1[1] + t * (p2[1] - p1[1]), t, u];
  }
  /* first crossing of segment a-b with a polyline, or null */
  function crossPolyline(a, b, pts) {
    var i, hit;
    for (i = 1; i < pts.length; i++) { hit = segIntersect(a, b, pts[i - 1], pts[i]); if (hit) return { x: hit[0], y: hit[1], t: hit[2], seg: i }; }
    return null;
  }
  function distToPolyline(p, pts) {
    var best = Infinity, i, d;
    for (i = 1; i < pts.length; i++) { d = G.pointSegDist(p, pts[i - 1], pts[i]); if (d < best) best = d; }
    return best;
  }
  /* loose segments [{ p, q }] → [{ pts, closed }], joined where ends coincide (to 1e-3) */
  function chainSegments(segs) {
    function key(p) { return Math.round(p[0] * 1000) + "," + Math.round(p[1] * 1000); }
    var adj = {}, used = new Array(segs.length), out = [], i, k;
    for (i = 0; i < segs.length; i++) { (adj[key(segs[i].p)] = adj[key(segs[i].p)] || []).push(i); (adj[key(segs[i].q)] = adj[key(segs[i].q)] || []).push(i); }
    function walk(start, startKey) {
      var pts = [key(segs[start].p) === startKey ? segs[start].p : segs[start].q], cur = start, kk = startKey, p, nexts, j, cand;
      for (;;) {
        used[cur] = true;
        p = key(segs[cur].p) === kk ? segs[cur].q : segs[cur].p; pts.push(p); kk = key(p);
        nexts = adj[kk]; cand = -1;
        for (j = 0; j < nexts.length; j++) if (!used[nexts[j]]) { cand = nexts[j]; break; }
        if (cand < 0) break;
        cur = cand;
      }
      var closed = pts.length > 3 && key(pts[0]) === key(pts[pts.length - 1]);
      if (closed) pts.pop();
      return { pts: pts, closed: closed };
    }
    for (k in adj) if (Object.prototype.hasOwnProperty.call(adj, k) && adj[k].length === 1 && !used[adj[k][0]]) out.push(walk(adj[k][0], k));
    for (i = 0; i < segs.length; i++) if (!used[i]) out.push(walk(i, key(segs[i].p)));
    return out;
  }

  NS.mesh = {
    delaunay: delaunay, voronoi: voronoi, clipHalf: clipHalf, clipRect: clipRect, tidy: tidy, insetConvex: insetConvex,
    cutAcross: cutAcross, extents: extents, hatch: hatch, segIntersect: segIntersect, crossPolyline: crossPolyline,
    distToPolyline: distToPolyline, chainSegments: chainSegments
  };
})(typeof self !== "undefined" ? self : typeof global !== "undefined" ? global : this);

/* ───── 30-names.js ───── */
/* 30-names.js — procedural place names from a CULTURE TABLE. A culture is one table entry: syllable parts, settlement
   endings by site, and feature patterns. Adding a culture is adding an entry. Namer(rng, culture) keeps names unique. */
(function (root) {
  "use strict";
  var NS = root.TnDMaps;

  var CULTURES = {
    common: {
      onsets: ["", "", "b", "br", "c", "cr", "d", "dr", "f", "g", "gr", "h", "k", "l", "m", "n", "p", "r", "s", "st", "t", "th", "w", "wr", "sh", "bl", "gl"],
      vowels: ["a", "e", "i", "o", "u", "a", "e", "o", "ae", "ea", "ou", "ei"],
      codas: ["", "", "l", "n", "r", "s", "th", "rn", "ld", "rd", "st", "m", "ck", "sh", "lm", "nd"],
      syllables: [1, 2, 2],
      endings: {
        mouth: ["mouth", "haven", "port"], coastal: ["haven", "port", "wick", "strand", "sea", "ness"], river: ["ford", "bridge", "bank", "wade", "mill"],
        lake: ["mere", "water", "shore"], hill: ["hill", "tor", "crag", "fell", "down"], forest: ["wood", "holt", "shaw", "hurst", "ley"],
        marsh: ["fen", "moss", "marsh", "carr"], plain: ["ton", "bury", "ham", "stead", "field", "gate", "worth", "by", "march", "dale", "cote"],
        city: ["gate", "burgh", "minster", "chester", "holm", "mouth", "haven"]
      },
      adjectives: ["Grey", "Black", "White", "Red", "Silver", "Hollow", "Broken", "Weeping", "Sunken", "Iron", "Ashen", "Wild", "Old", "Gilded", "Far", "High", "Bitter", "Still"],
      town: {
        temple: ["Temple of {R}", "The {A} Chapel", "{R} Minster", "Church of St {R}", "The {A} Abbey"],
        keep: ["{R} Keep", "Castle {R}", "The {A} Tower", "{N} Castle"],
        market: ["Market Square", "The {A} Market", "{N} Market"],
        green: ["The Green", "{N} Green", "The Common"],
        park: ["The {A} Garden", "{R}'s Orchard", "{N} Pleasance", "The {A} Walk"],
        gate: ["{B} Gate"],
        harbour: ["The Harbour", "{N} Quay", "The {A} Quay"],
        outfall: ["The {A} Outfall", "{N} Culvert", "The {A} Sluice", "Old {R} Drain"],
        inn: ["The {A} {S}", "The {S} and {S}", "The {R} Arms", "The {A} {S}"],
        district: ["{T} Ward", "{T} Quarter", "{R} Ward", "The {A} Quarter", "{T} Row", "{B} Ward"]
      },
      patterns: {
        range: ["The {R} Mountains", "The {R} Peaks", "{R} Range", "The {A} Teeth", "The {A} Spires", "{R} Fells"],
        hills: ["The {R} Hills", "{R} Downs", "The {A} Barrows"],
        forest: ["{R} Forest", "The {R} Wood", "{R}wood", "The {A} Weald", "{R} Wold", "The {A} Wood"],
        river: ["River {R}", "The {R}", "{R} River", "The {A} Water"],
        sea: ["The {R} Sea", "Sea of {R}", "The {A} Sea", "{R} Ocean"],
        lake: ["Lake {R}", "{R} Mere", "The {A} Mere", "{R} Water"],
        marsh: ["The {R} Fens", "{R} Marsh", "The {A} Mire"],
        cave: ["{R}'s Hole", "The {A} Cave", "{R} Hollow", "The {S} Cave", "{R}'s Delve", "The {A} Hollow", "Cave of {R}", "The {S}'s Den"],
        realm: ["The Kingdom of {R}", "{R}", "The {R} Reaches", "The Realm of {R}", "The {A} Marches", "{R}land"]
      }
    },
    norse: {
      onsets: ["", "b", "bj", "d", "f", "fj", "g", "gr", "h", "hj", "k", "kn", "r", "s", "sk", "sn", "st", "t", "th", "v", "hr"],
      vowels: ["a", "e", "i", "o", "u", "ei", "au", "ja", "jo", "y"],
      codas: ["", "l", "r", "n", "nd", "rk", "ld", "gg", "kk", "rn", "lm", "ng", "ft"],
      syllables: [1, 2],
      endings: {
        mouth: ["fjord", "vik", "mund"], coastal: ["vik", "nes", "holm", "havn", "strand"], river: ["fors", "bru", "vad", "aa"],
        lake: ["sjo", "vatn"], hill: ["fell", "haug", "berg"], forest: ["skog", "lund", "mark"],
        marsh: ["myr", "kjarr"], plain: ["heim", "stad", "by", "gard", "dal", "tun", "sted"],
        city: ["borg", "heim", "gard", "stad"]
      },
      adjectives: ["Grey", "Cold", "Iron", "Raven", "Wolf", "Storm", "Frost", "Grim", "Elder", "Hallowed", "Bleak", "Salt"],
      town: {
        temple: ["Hof of {R}", "The {A} Hall", "{R} Kirk"],
        keep: ["{R} Borg", "{N} Hall", "The {A} Holt"],
        market: ["The Thingstead", "{N} Market"],
        green: ["The Thingfield", "{N} Green"],
        park: ["The {A} Garden", "{R}'s Orchard", "{N} Pleasance", "The {A} Walk"],
        gate: ["{B} Gate"],
        harbour: ["{N} Havn", "The Long Quay"],
        outfall: ["The {A} Drain", "{N} Culvert", "{R}'s Mouth"],
        inn: ["The {A} {S}", "{R}'s Hall", "The {S}'s Rest"],
        district: ["{T} Row", "{R} Gard", "{B} Side", "{T} Gard"]
      },
      patterns: {
        range: ["The {R} Fells", "{R}fjell", "The {A} Crags", "{R} Heights"],
        hills: ["{R} Haugar", "The {A} Barrows"],
        forest: ["{R}skog", "The {R} Wold", "{A}wood", "{R} Mark"],
        river: ["The {R}", "{R} Elv", "{R}aa"],
        sea: ["The {R} Sea", "{R}hav", "The {A} Deep"],
        lake: ["{R}vatn", "Lake {R}", "The {A} Tarn"],
        marsh: ["{R} Myr", "The {A} Fen"],
        cave: ["{R}hol", "The {A} Cave", "{R}'s Hellir", "Cave of the {S}", "{R} Gap", "The {S} Hole"],
        realm: ["{R}land", "The Jarldom of {R}", "{R}mark", "The {A} Shores"]
      }
    },
    imperial: {
      onsets: ["", "", "c", "v", "m", "l", "s", "t", "p", "aur", "cl", "tr", "fl", "qu", "br", "pr", "n", "r"],
      vowels: ["a", "e", "i", "o", "u", "ae", "au", "a", "o"],
      codas: ["", "", "n", "r", "s", "l", "nt", "st", "rm", "x", "ct"],
      syllables: [1, 2, 2],
      endings: {
        mouth: ["ostia", "portus"], coastal: ["ia Maris", "portus", "ia"], river: ["ia", "pons", "ium"],
        lake: ["lacus"], hill: ["collis", "mons"], forest: ["silva"],
        marsh: ["palus"], plain: ["ium", "ia", "um", "a", "us", "ora", "ana", "entum"],
        city: ["polis", "ium", "a Magna", "opolis"]
      },
      adjectives: ["Alba", "Nigra", "Aurea", "Vetus", "Nova", "Magna", "Ferrea", "Sacra", "Ultima", "Rubra"],
      town: {
        temple: ["Temple of {R}", "Basilica {R}", "The {A} Temple"],
        keep: ["Castellum {R}", "Arx {R}", "The {A} Citadel"],
        market: ["The Forum", "Forum {R}"],
        green: ["The Campus", "The Forum"],
        park: ["The {A} Garden", "{R}'s Orchard", "{N} Pleasance", "The {A} Walk"],
        gate: ["Porta {R}", "{B} Gate"],
        harbour: ["Portus {R}", "The {A} Harbour"],
        outfall: ["Cloaca {R}", "The {A} Outfall", "{N} Cloaca"],
        inn: ["The {A} {S}", "Taberna {R}", "The {S}"],
        district: ["Vicus {R}", "{T} Quarter", "The {A} Insula", "{B} Quarter"]
      },
      patterns: {
        range: ["Montes {R}", "The {R} Mountains", "Mons {R}", "The {A} Heights"],
        hills: ["Colles {R}", "The {R} Hills"],
        forest: ["Silva {R}", "The {R} Forest", "{R} Silva"],
        river: ["River {R}", "The {R}", "Flumen {R}"],
        sea: ["Mare {R}", "The {R} Sea", "Mare {A}"],
        lake: ["Lacus {R}", "Lake {R}"],
        marsh: ["Palus {R}", "The {R} Marshes"],
        cave: ["Spelunca {R}", "The {A} Cave", "Cave of {R}", "Antrum {R}", "The {S} Grotto"],
        realm: ["The Province of {R}", "{R}ia", "The Empire of {R}", "The {R} Dominion"]
      }
    },
    elvish: {
      onsets: ["", "", "l", "th", "s", "f", "v", "n", "m", "r", "c", "g", "el", "al", "sil", "gal", "lir"],
      vowels: ["a", "e", "i", "ae", "ia", "io", "ie", "a", "e", "u"],
      codas: ["", "", "l", "n", "r", "s", "th", "lh", "nd", "ll", "rn"],
      syllables: [2, 2, 3],
      endings: {
        mouth: ["ond", "lond"], coastal: ["falas", "lond", "rond"], river: ["duin", "sir", "nen"],
        lake: ["nen", "aelin"], hill: ["amon", "dol"], forest: ["dor", "las", "taur"],
        marsh: ["loeg", "nin"], plain: ["ion", "iel", "oth", "ast", "ean", "ari", "ath", "en"],
        city: ["ost", "minas", "ion", "ath"]
      },
      adjectives: ["Silver", "Starlit", "Grey", "Whispering", "Golden", "Twilight", "Pale", "Singing", "Elder", "Moonlit"],
      town: {
        temple: ["Hall of {R}", "The {A} Sanctum", "Shrine of {R}"],
        keep: ["Tower of {R}", "Minas {R}", "The {A} Spire"],
        market: ["The Starlit Court", "Court of {R}"],
        green: ["The Glade", "Court of {R}"],
        park: ["The {A} Garden", "{R}'s Orchard", "{N} Pleasance", "The {A} Walk"],
        gate: ["{B} Gate", "Gate of {R}"],
        harbour: ["Haven of {R}", "The {A} Quay"],
        outfall: ["The {A} Outflow", "Culvert of {R}", "The {A} Spring"],
        inn: ["The {A} {S}", "House of {R}", "The {S}'s Rest"],
        district: ["{R} Court", "The {A} Terraces", "{T} Lane", "{B} Terraces"]
      },
      patterns: {
        range: ["Ered {R}", "The {A} Peaks", "The {R} Mountains", "{R} Heights"],
        hills: ["Emyn {R}", "The {R} Hills"],
        forest: ["Taur {R}", "The {A} Wood", "{R} Forest", "The Wood of {R}"],
        river: ["{R}duin", "The {R}", "River {R}", "The {A} Stream"],
        sea: ["The {R} Sea", "Belegaer {R}", "The {A} Sea"],
        lake: ["Nen {R}", "Lake {R}", "The {A} Mere"],
        marsh: ["The {R} Marshes", "Loeg {R}"],
        cave: ["The {A} Hollow", "Cave of {R}", "{R} Rond", "The {S} Cave", "{R}'s Deep"],
        realm: ["{R}", "The Realm of {R}", "{R}dor", "The {A} Lands"]
      }
    }
  };

  /* trades, beasts and bearing words are concepts, not language: every culture's town patterns draw on them */
  var TRADES = ["Fishers'", "Tanners'", "Weavers'", "Smiths'", "Merchants'", "Potters'", "Dyers'", "Masons'", "Coopers'", "Chandlers'", "Millers'", "Butchers'", "Scriveners'", "Shipwrights'", "Ropers'", "Glovers'"];
  var BEASTS = ["Boar", "Stag", "Hound", "Raven", "Fox", "Swan", "Eel", "Ram", "Wyvern", "Heron", "Hare", "Bear", "Goose", "Lion", "Griffin", "Pike"];
  var BEARING_WORD = { N: "North", NE: "Northeast", E: "East", SE: "Southeast", S: "South", SW: "Southwest", W: "West", NW: "Northwest" };

  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
  /* pronounceable: 3–8 letters, no triple consonant run except the familiar clusters, no triple vowel, no odd doubles */
  var OK_CLUSTERS = /^(str|thr|nth|rth|ndr|ngr|lth|rst|rld|nst|sth|rsk|ldr|rdr|nts|lst|ght|sch|chr|shr|rch|rsh|lch|nch)$/;
  function okRoot(s) {
    if (s.length < 3 || s.length > 8) return false;
    if (/[aeiouy]{3}/.test(s) || /(aa|ii|uu|yy)/.test(s) || /([a-z])\1\1/.test(s)) return false;
    var runs = s.match(/[^aeiouy]{3,}/g), i;
    if (runs) for (i = 0; i < runs.length; i++) if (!OK_CLUSTERS.test(runs[i])) return false;
    return true;
  }
  var MID_CODAS = ["", "", "l", "n", "r", "s", "m"];

  /* Namer(rng, culture, used?) — `used` lets several namers (one random stream per establishment kind) share one
     uniqueness set, so a tavern and an inn never get the same sign */
  function Namer(rng, culture, used) {
    var C = NS.own(CULTURES, culture);
    NS.assert(C, "unknown culture", { culture: culture, known: Object.keys(CULTURES) });
    used = used || {};
    var innerOnsets = C.onsets.filter(function (o) { return o.length === 1 || (o.length === 2 && rng.chance(0.5)); });
    if (innerOnsets.length < 4) innerOnsets = C.onsets.filter(function (o) { return o; });
    function root(syllables) {
      var n = syllables || rng.pick(C.syllables), s = "", i, tries = 0;
      do {
        s = "";
        for (i = 0; i < n; i++) {
          s += (i === 0 ? rng.pick(C.onsets) : rng.pick(innerOnsets)) + rng.pick(C.vowels);
          s += i === n - 1 ? rng.pick(C.codas) : rng.pick(MID_CODAS);
        }
        tries++;
        if (tries === 12 && n > 1) n--; /* a long root that will not come out clean gets shorter */
      } while (!okRoot(s) && tries < 24);
      return cap(s);
    }
    function unique(make) {
      var name, tries = 0;
      do { name = make(); tries++; } while (used[name] && tries < 40);
      if (used[name]) name = name + " " + ["II", "III", "IV", "V", "VI"][Math.min(4, (used[name] || 1) - 1)];
      used[name] = (used[name] || 0) + 1;
      return name;
    }
    /* tokens are expanded only when present, so a pattern without {S} consumes no randomness for a beast */
    function fill(pattern, ctx) {
      ctx = ctx || {};
      var r = root(), adj = rng.pick(C.adjectives), out = pattern.replace("{R}", r).replace("{A}", adj), beastA; /* root and adjective are drawn for every pattern, as before */
      if (out.indexOf("{S}") >= 0) { beastA = rng.pick(BEASTS); out = out.replace("{S}", beastA); }
      if (out.indexOf("{S}") >= 0) out = out.replace("{S}", rng.pick(BEASTS.filter(function (b) { return b !== beastA; })));
      if (out.indexOf("{T}") >= 0) out = out.replace("{T}", ctx.trade || rng.pick(TRADES));
      if (out.indexOf("{B}") >= 0) out = out.replace("{B}", BEARING_WORD[ctx.bearing] || rng.pick(Object.keys(BEARING_WORD).map(function (k) { return BEARING_WORD[k]; })));
      if (out.indexOf("{N}") >= 0) out = out.replace("{N}", ctx.name ? String(ctx.name).split(" ")[0] : root());
      return out;
    }
    function join(r, ending) {
      /* avoid a doubled letter at the seam (Blackk) and a vowel clash (Aroaford → Aroford) */
      if (ending && r.charAt(r.length - 1).toLowerCase() === ending.charAt(0)) r = r.slice(0, -1);
      if (ending && /[aeiou]$/.test(r) && /^[aeiou]/.test(ending)) r = r.slice(0, -1);
      return ending.charAt(0) === " " ? r + ending : r + ending;
    }
    return {
      culture: culture,
      /* settlement(kind, site) — site: { mouth, coastal, river, lake, hill, forest, marsh } booleans */
      settlement: function (kind, site) {
        site = site || {};
        return unique(function () {
          var pool;
          if (kind === "city" && rng.chance(0.5)) pool = C.endings.city;
          else if (site.mouth && rng.chance(0.7)) pool = C.endings.mouth;
          else if (site.coastal && rng.chance(0.7)) pool = C.endings.coastal;
          else if (site.river && rng.chance(0.6)) pool = C.endings.river;
          else if (site.lake && rng.chance(0.6)) pool = C.endings.lake;
          else if (site.hill && rng.chance(0.6)) pool = C.endings.hill;
          else if (site.forest && rng.chance(0.6)) pool = C.endings.forest;
          else if (site.marsh && rng.chance(0.6)) pool = C.endings.marsh;
          else pool = C.endings.plain;
          var r = root(), e = rng.pick(pool);
          if ((r + e).length > 12) r = root(1);
          if (kind === "city" && rng.chance(0.15)) return "Great " + r;
          return rng.chance(0.12) ? r : join(r, e);
        });
      },
      feature: function (kind) { NS.assert(C.patterns[kind], "no name pattern for feature kind", { kind: kind, culture: culture }); return unique(function () { return fill(rng.pick(C.patterns[kind])); }); },
      /* town(kind, ctx, patterns?) — kind: temple|keep|market|green|gate|harbour|inn|district, or any kind with the
         caller's own patterns (the culture's list wins when it has one); ctx: { bearing, trade, name } */
      town: function (kind, ctx, patterns) { var pool = C.town[kind] || patterns; NS.assert(pool && pool.length, "no name pattern for town kind", { kind: kind, culture: culture }); return unique(function () { return fill(rng.pick(pool), ctx); }); },
      root: function () { return unique(root); },
      used: used
    };
  }

  NS.names = { CULTURES: CULTURES, TRADES: TRADES, BEASTS: BEASTS, BEARING_WORD: BEARING_WORD, Namer: Namer, cultures: function () { return Object.keys(CULTURES); } };
})(typeof self !== "undefined" ? self : typeof global !== "undefined" ? global : this);

/* ───── 40-terrain.js ───── */
/* 40-terrain.js — the physical world of a region: elevation, sea level, ocean and lakes, drainage and rivers, moisture,
   biomes. Everything is a node field on the grid; nothing here knows about settlements or drawing.
   Heights are normalised: 0 is sea level, land is (0, 1], sea is [-1, 0). */
(function (root) {
  "use strict";
  var NS = root.TnDMaps, U = NS.util, G = NS.geom;

  var BIOME = { OCEAN: 0, LAKE: 1, PLAIN: 2, FOREST: 3, HILLS: 4, MOUNTAIN: 5, MARSH: 6, SCRUB: 7 };
  var BIOME_NAME = ["ocean", "lake", "plain", "forest", "hills", "mountain", "marsh", "scrub"];
  var SQ2 = Math.SQRT2, MIN_ISLAND = 3, MIN_LAKE = 4, LAKE_EPS = 0.015;

  /* two-pass chamfer distance (node units) to the nearest node where mask[i] is truthy */
  function chamfer(g, mask) {
    var cols = g.cols, rows = g.rows, d = new Float32Array(g.n), INF = 1e9, i, c, r, v;
    for (i = 0; i < g.n; i++) d[i] = mask[i] ? 0 : INF;
    for (r = 0; r < rows; r++) for (c = 0; c < cols; c++) {
      i = r * cols + c; v = d[i];
      if (c > 0 && d[i - 1] + 1 < v) v = d[i - 1] + 1;
      if (r > 0) { if (d[i - cols] + 1 < v) v = d[i - cols] + 1; if (c > 0 && d[i - cols - 1] + SQ2 < v) v = d[i - cols - 1] + SQ2; if (c < cols - 1 && d[i - cols + 1] + SQ2 < v) v = d[i - cols + 1] + SQ2; }
      d[i] = v;
    }
    for (r = rows - 1; r >= 0; r--) for (c = cols - 1; c >= 0; c--) {
      i = r * cols + c; v = d[i];
      if (c < cols - 1 && d[i + 1] + 1 < v) v = d[i + 1] + 1;
      if (r < rows - 1) { if (d[i + cols] + 1 < v) v = d[i + cols] + 1; if (c < cols - 1 && d[i + cols + 1] + SQ2 < v) v = d[i + cols + 1] + SQ2; if (c > 0 && d[i + cols - 1] + SQ2 < v) v = d[i + cols - 1] + SQ2; }
      d[i] = v;
    }
    return d;
  }

  /* ── 1. elevation ── shaped fractal noise, sea level by quantile, ridges on the highlands */
  function elevation(P, g, seed) {
    var noise = NS.Noise(seed + "/elev"), warp = NS.Noise(seed + "/warp"), ridge = NS.Noise(seed + "/ridge"), rng = NS.Rng(seed + "/shape");
    var FREQ = { continent: 1.7, island: 1.5, coast: 1.9, archipelago: 2.9, inland: 1.9 }, f = FREQ[P.landmass];
    var e = new Float32Array(g.n), cx = 0.5, cy = (g.h / g.w) / 2, theta = rng.range(0, Math.PI * 2), i, u, v, wx, wy, d, val;
    var ox = rng.range(-100, 100), oy = rng.range(-100, 100); /* noise-space offset: the seed moves the whole field */
    for (i = 0; i < g.n; i++) {
      u = g.px(i) / g.w; v = g.py(i) / g.w;
      wx = u + 0.12 * warp.fbm(u * 2 + 3.1, v * 2 + 7.7, 3); wy = v + 0.12 * warp.fbm(u * 2 - 4.4, v * 2 + 1.9, 3);
      val = noise.fbm(wx * f + ox, wy * f + oy, 6, 2.05, 0.5);
      d = Math.sqrt(Math.pow((u - cx) / 0.5, 2) + Math.pow((v - cy) / cy, 2));
      if (P.landmass === "continent") val += 0.9 * (0.55 - d);
      else if (P.landmass === "island") val += 1.3 * (0.45 - d);
      else if (P.landmass === "coast") val += -1.1 * (((u - cx) * Math.cos(theta) + (v - cy) * Math.sin(theta)) / 0.5) + 0.1;
      e[i] = val;
    }
    /* sea level: the quantile that yields the requested land fraction */
    var sorted = Array.prototype.slice.call(e).sort(function (a, b) { return a - b; }), sea, min = sorted[0], max = sorted[g.n - 1];
    /* inland: no ocean, but the same height distribution as a continent's land — the lowest third becomes lowland
       plain a hair above "sea level" instead of water */
    var inland = P.landmass === "inland", landFrac = inland ? 0.66 : P.land;
    sea = sorted[Math.min(g.n - 1, Math.floor((1 - landFrac) * g.n))];
    var h = new Float32Array(g.n), r, hmax = 0;
    for (i = 0; i < g.n; i++) h[i] = e[i] > sea ? (e[i] - sea) / (max - sea || 1) : (e[i] - sea) / (sea - min || 1);
    if (inland) for (i = 0; i < g.n; i++) if (h[i] <= 0) h[i] = 0.001 + 0.03 * (1 + h[i]);
    /* ridges: sharp crests where the land is already high; renormalise land to (0, 1] */
    for (i = 0; i < g.n; i++) if (h[i] > 0) {
      u = g.px(i) / g.w; v = g.py(i) / g.w;
      r = ridge.ridged(u * f * 1.7 + ox, v * f * 1.7 + oy, 4);
      h[i] += P.relief * 0.7 * r * U.smoothstep(0.12, 0.7, h[i]);
      if (h[i] > hmax) hmax = h[i];
    }
    if (hmax > 0) for (i = 0; i < g.n; i++) if (h[i] > 0) h[i] = Math.max(1e-4, h[i] / hmax);
    /* one soft pass over the land: fewer noise pits (which would each become a pond) and longer rivers */
    var sm = new Float32Array(h), c, rr, sum, wsum, ww;
    for (rr = 1; rr < g.rows - 1; rr++) for (c = 1; c < g.cols - 1; c++) {
      i = rr * g.cols + c; if (h[i] <= 0) continue; sum = 4 * h[i]; wsum = 4;
      g.neighbors8(i, function (k, len) { if (h[k] > 0) { ww = len > 1 ? 0.5 : 1; sum += ww * h[k]; wsum += ww; } });
      sm[i] = Math.max(1e-4, sum / wsum);
    }
    h = sm;
    /* specks: islands under MIN_ISLAND nodes sink */
    G.components(g, function (k) { return h[k] > 0; }, 1).forEach(function (comp) {
      if (comp.size < MIN_ISLAND) comp.cells.forEach(function (k) { h[k] = -0.02; });
    });
    return h;
  }

  /* ── 2. water bodies ── ocean = sea-level nodes connected to the frame; everything else at or below sea level is a lake */
  function classifyWater(g, h) {
    var water = new Uint8Array(g.n), queue = [], head = 0, i, j;
    for (i = 0; i < g.n; i++) if (h[i] <= 0 && g.onBorder(i)) { water[i] = 1; queue.push(i); }
    while (head < queue.length) { j = queue[head++]; g.neighbors4(j, function (k) { if (!water[k] && h[k] <= 0) { water[k] = 1; queue.push(k); } }); }
    for (i = 0; i < g.n; i++) if (h[i] <= 0 && !water[i]) water[i] = 2;
    return water;
  }

  /* ── 3. drainage ── priority-flood fills depressions so every land node drains to the ocean or off the frame;
     filled − h above LAKE_EPS marks standing water */
  function drainage(P, g, h, water) {
    var filled = new Float32Array(g.n), seen = new Uint8Array(g.n), down = new Int32Array(g.n), i, cur, EPS = 1e-5;
    var heap = U.Heap(function (a, b) { return a.key < b.key; });
    for (i = 0; i < g.n; i++) { filled[i] = h[i]; down[i] = -1; if (water[i] === 1 || g.onBorder(i)) { seen[i] = 1; heap.push({ key: h[i], i: i }); } }
    while (heap.size()) {
      cur = heap.pop();
      g.neighbors8(cur.i, function (k) {
        if (seen[k]) return; seen[k] = 1;
        filled[k] = Math.max(h[k], filled[cur.i] + EPS);
        heap.push({ key: filled[k], i: k });
      });
    }
    /* lakes: every pool (a basin in the filled surface, or a natural sea-level pond cut off from the ocean) is a
       candidate; the region keeps the P.lakes largest by volume. The rest are "carved": land, with rivers running through
       as if a channel had eroded out. */
    var lake = new Uint8Array(g.n), pools = [];
    G.components(g, function (k) { return water[k] !== 1 && filled[k] - h[k] > LAKE_EPS; }, 1).forEach(function (comp) {
      var vol = 0, natural = false, j;
      for (j = 0; j < comp.size; j++) { vol += filled[comp.cells[j]] - h[comp.cells[j]]; if (h[comp.cells[j]] <= 0) natural = true; }
      pools.push({ comp: comp, vol: vol, natural: natural });
    });
    pools.sort(function (a, b) { return b.vol - a.vol; });
    var kept = 0;
    pools.forEach(function (p) {
      var keep = p.comp.size >= MIN_LAKE && kept < P.lakes;
      if (keep) { kept++; p.comp.cells.forEach(function (k) { lake[k] = 1; water[k] = 2; }); }
    });
    for (i = 0; i < g.n; i++) if (water[i] === 2 && !lake[i]) { water[i] = 0; if (h[i] <= 0) h[i] = 0.002; } /* a pond too small to draw is land */
    /* steepest descent on the filled surface */
    for (i = 0; i < g.n; i++) {
      if (water[i] === 1) continue;
      var best = -1, bestDrop = 0;
      g.neighbors8(i, function (k, len) { var drop = (filled[i] - filled[k]) / len; if (drop > bestDrop) { bestDrop = drop; best = k; } });
      down[i] = best; /* -1 only on the frame border (water runs off the map) */
    }
    return { filled: filled, down: down };
  }

  /* ── 4. flow accumulation and river tracing ── */
  function rivers(P, g, h, water, flow, rain) {
    var acc = new Float32Array(g.n), order = [], i, k, landCount = 0;
    for (i = 0; i < g.n; i++) { if (water[i] !== 1) { order.push(i); acc[i] = rain[i]; } if (water[i] === 0) landCount++; }
    order.sort(function (a, b) { return flow.filled[b] - flow.filled[a]; });
    for (k = 0; k < order.length; k++) { i = order[k]; if (flow.down[i] >= 0) acc[flow.down[i]] += acc[i]; }
    var T = Math.max(8, landCount * (0.0075 - 0.0045 * P.moisture)), isRiver = new Uint8Array(g.n), riverAt = new Int32Array(g.n), mainUp = new Int32Array(g.n);
    for (i = 0; i < g.n; i++) { riverAt[i] = -1; mainUp[i] = -1; if (water[i] === 0 && acc[i] >= T) isRiver[i] = 1; }
    for (i = 0; i < g.n; i++) if (isRiver[i] && flow.down[i] >= 0 && isRiver[flow.down[i]]) { k = flow.down[i]; if (mainUp[k] < 0 || acc[i] > acc[mainUp[k]]) mainUp[k] = i; }
    var out = [], claimed = new Uint8Array(g.n);
    function traceUp(from) { var path = [from], cur = from; while (mainUp[cur] >= 0 && !claimed[mainUp[cur]]) { cur = mainUp[cur]; path.unshift(cur); } return path; }
    function endOf(node) {
      var d = flow.down[node];
      if (d < 0) return { kind: "edge", node: node };
      if (water[d] === 1) return { kind: "sea", node: d };
      if (water[d] === 2) return { kind: "lake", node: d };
      return { kind: "river", node: d };
    }
    function claim(path, end) {
      var id = out.length, j;
      for (j = 0; j < path.length; j++) { claimed[path[j]] = 1; riverAt[path[j]] = id; }
      out.push({ id: id, nodes: path, end: end, acc: acc[path[path.length - 1]] });
    }
    var mouths = [];
    for (i = 0; i < g.n; i++) if (isRiver[i] && (flow.down[i] < 0 || !isRiver[flow.down[i]])) mouths.push(i);
    mouths.sort(function (a, b) { return acc[b] - acc[a]; });
    mouths.forEach(function (m) { claim(traceUp(m), endOf(m)); });
    var remaining = [], progress = true, guard = 0;
    for (i = 0; i < g.n; i++) if (isRiver[i] && !claimed[i]) remaining.push(i);
    remaining.sort(function (a, b) { return acc[b] - acc[a]; });
    while (remaining.length && progress) {
      progress = false; guard++;
      NS.assert(guard < 200, "river tracing did not converge", { remaining: remaining.length });
      remaining = remaining.filter(function (n) {
        if (claimed[n]) return false;
        var d = flow.down[n];
        if (d >= 0 && claimed[d]) { claim(traceUp(n), { kind: "river", node: d }); progress = true; return false; }
        return true;
      });
    }
    NS.assert(!remaining.length, "river nodes left unclaimed", { count: remaining.length });
    return { rivers: out, acc: acc, riverAt: riverAt, threshold: T, landCount: landCount };
  }

  /* ── 5. moisture and biomes ── */
  function moisture(P, g, h, water, riverAt, seed) {
    var n = NS.Noise(seed + "/moist"), base = new Float32Array(g.n), wet = new Uint8Array(g.n), i, u, v;
    for (i = 0; i < g.n; i++) { u = g.px(i) / g.w; v = g.py(i) / g.w; base[i] = 0.5 + 0.5 * n.fbm(u * 2.6 + 11, v * 2.6 - 5, 4); wet[i] = water[i] || riverAt[i] >= 0 ? 1 : 0; }
    var dW = chamfer(g, wet), m = new Float32Array(g.n);
    for (i = 0; i < g.n; i++) m[i] = U.clamp(0.55 * base[i] + 0.35 * Math.exp(-dW[i] / 5) + (P.moisture - 0.5) * 0.7 + 0.03, 0, 1);
    return { m: m, base: base, dW: dW };
  }
  function biomes(P, g, h, water, m, dW) {
    var mountainT = 0.72 - 0.25 * P.relief, hillT = mountainT - 0.17, b = new Uint8Array(g.n), i, pass, count, next;
    for (i = 0; i < g.n; i++) {
      if (water[i] === 1) b[i] = BIOME.OCEAN;
      else if (water[i] === 2) b[i] = BIOME.LAKE;
      else if (h[i] > mountainT) b[i] = BIOME.MOUNTAIN;
      else if (h[i] > hillT) b[i] = BIOME.HILLS;
      else if (h[i] < 0.045 && m[i] > 0.72 && dW[i] <= 1.5) b[i] = BIOME.MARSH;
      else if (m[i] > 0.6) b[i] = BIOME.FOREST;
      else if (m[i] < 0.2) b[i] = BIOME.SCRUB;
      else b[i] = BIOME.PLAIN;
    }
    /* de-speckle forest and plain: a lone forest node clears, a plain node ringed by forest fills */
    for (pass = 0; pass < 2; pass++) {
      next = new Uint8Array(b);
      for (i = 0; i < g.n; i++) {
        if (b[i] !== BIOME.FOREST && b[i] !== BIOME.PLAIN) continue;
        count = 0; g.neighbors8(i, function (k) { if (b[k] === BIOME.FOREST) count++; });
        if (b[i] === BIOME.FOREST && count < 2) next[i] = BIOME.PLAIN;
        if (b[i] === BIOME.PLAIN && count >= 6) next[i] = BIOME.FOREST;
      }
      b = next;
    }
    return { biome: b, mountainT: mountainT, hillT: hillT };
  }
  function slopes(g, h) {
    var s = new Float32Array(g.n), i;
    for (i = 0; i < g.n; i++) { var best = 0; g.neighbors8(i, function (k, len) { var d = Math.abs(h[k] - h[i]) / len; if (d > best) best = d; }); s[i] = best; }
    return s;
  }

  /* ── build ── the whole physical world; `seed` is the document seed string */
  function build(P, g, seed) {
    var t0 = now(), stats = {};
    var h = elevation(P, g, seed); stats.elevation = now() - t0; t0 = now();
    var water = classifyWater(g, h);
    var flow = drainage(P, g, h, water); stats.drainage = now() - t0; t0 = now();
    var moistBase = NS.Noise(seed + "/rain"), rain = new Float32Array(g.n), i;
    for (i = 0; i < g.n; i++) rain[i] = 0.6 + 0.8 * (0.5 + 0.5 * moistBase.fbm(g.px(i) / g.w * 2.6 + 11, g.py(i) / g.w * 2.6 - 5, 3));
    var riv = rivers(P, g, h, water, flow, rain); stats.rivers = now() - t0; t0 = now();
    var moist = moisture(P, g, h, water, riv.riverAt, seed);
    var bio = biomes(P, g, h, water, moist.m, moist.dW); stats.biomes = now() - t0;
    var oceanMask = new Uint8Array(g.n), landMask = new Uint8Array(g.n), lakeMask = new Uint8Array(g.n), seaPresent = false;
    for (i = 0; i < g.n; i++) { oceanMask[i] = water[i] === 1 ? 1 : 0; landMask[i] = water[i] === 0 ? 1 : 0; lakeMask[i] = water[i] === 2 ? 1 : 0; if (water[i] === 1) seaPresent = true; }
    return {
      g: g, h: h, water: water, filled: flow.filled, down: flow.down, acc: riv.acc, rivers: riv.rivers, riverAt: riv.riverAt,
      riverThreshold: riv.threshold, landCount: riv.landCount, moisture: moist.m, dWater: moist.dW, biome: bio.biome,
      mountainT: bio.mountainT, hillT: bio.hillT, slope: slopes(g, h), seaPresent: seaPresent,
      dOcean: chamfer(g, oceanMask), dLand: chamfer(g, landMask), dLake: chamfer(g, lakeMask), stats: stats
    };
  }
  function now() { return (typeof performance !== "undefined" && performance.now) ? performance.now() : Date.now(); }

  NS.terrain = { build: build, BIOME: BIOME, BIOME_NAME: BIOME_NAME, chamfer: chamfer, now: now };
})(typeof self !== "undefined" ? self : typeof global !== "undefined" ? global : this);

/* ───── 41-region.js ───── */
/* 41-region.js — the REGION generator: parameters → terrain → settlements, roads, named features, glyphs, coast and
   river geometry → the map document. The document is the truth the game stores; the seed rides along for variants. */
(function (root) {
  "use strict";
  var NS = root.TnDMaps, U = NS.util, G = NS.geom, TR = NS.terrain, B = TR.BIOME;

  var DEFAULTS = {
    seed: null, width: 1600, height: 1100, cells: 160,
    landmass: "continent", land: 0.5, relief: 0.5, moisture: 0.5, lakes: 3,
    settlements: 12, caves: 3, culture: "common", title: null,
    scaleKm: 600, travelKmPerDay: 30,
    pins: [], fields: true
  };
  var LANDMASSES = ["continent", "island", "coast", "archipelago", "inland"];
  var KINDS = ["city", "town", "village"];

  /* ── parameter validation: every refusal names the field and the rule ── */
  function resolveParams(input) {
    var P = U.extend({}, DEFAULTS, input || {}), k;
    for (k in input || {}) if (Object.prototype.hasOwnProperty.call(input, k) && !Object.prototype.hasOwnProperty.call(DEFAULTS, k)) NS.fail("unknown parameter", { param: k, known: Object.keys(DEFAULTS) });
    NS.assert(P.seed !== null && P.seed !== undefined && String(P.seed).length > 0, "seed is required (a string or number)", { seed: P.seed });
    function num(name, lo, hi) { NS.assert(U.isNum(P[name]) && P[name] >= lo && P[name] <= hi, name + " must be a number in [" + lo + ", " + hi + "]", { value: P[name] }); }
    num("width", 200, 6000); num("height", 200, 6000); num("cells", 48, 400);
    num("land", 0.05, 0.95); num("relief", 0, 1); num("moisture", 0, 1); num("lakes", 0, 12);
    num("settlements", 0, 60); num("caves", 0, 12); num("scaleKm", 10, 20000); num("travelKmPerDay", 5, 200);
    NS.assert(LANDMASSES.indexOf(P.landmass) >= 0, "landmass must be one of " + LANDMASSES.join("|"), { landmass: P.landmass });
    NS.assert(NS.own(NS.names.CULTURES, P.culture), "culture must be one of " + NS.names.cultures().join("|"), { culture: P.culture });
    NS.assert(Array.isArray(P.pins), "pins must be an array of {name, kind?}", { pins: P.pins });
    P.pins.forEach(function (pin, i) {
      NS.assert(pin && typeof pin.name === "string" && pin.name.length, "pin " + i + " needs a name", { pin: pin });
      NS.assert(!pin.kind || KINDS.indexOf(pin.kind) >= 0, "pin " + i + " kind must be city|town|village", { pin: pin });
    });
    NS.assert(P.title === null || typeof P.title === "string", "title must be a string or null", { title: P.title });
    P.seed = String(P.seed); P.cells = Math.round(P.cells); P.settlements = Math.round(P.settlements); P.lakes = Math.round(P.lakes); P.caves = Math.round(P.caves);
    return P;
  }

  /* ── settlements ── */
  function siteOf(W, i) {
    var g = W.g, site = { node: i, elevation: U.round(W.h[i], 3), slope: U.round(W.slope[i], 4), biome: TR.BIOME_NAME[W.biome[i]] }, riverId;
    site.coastal = W.dOcean[i] <= 1.5;
    site.lake = W.dLake[i] <= 1.5;
    riverId = W.riverAt[i];
    if (riverId < 0) g.neighbors8(i, function (k) { if (riverId < 0 && W.riverAt[k] >= 0) riverId = W.riverAt[k]; });
    site.river = riverId >= 0 ? riverId : null;
    site.mouth = riverId >= 0 && W.dOcean[i] <= 1.5;
    var forestN = 0, hillN = 0; g.neighbors8(i, function (k) { if (W.biome[k] === B.FOREST) forestN++; if (W.biome[k] === B.HILLS || W.biome[k] === B.MOUNTAIN) hillN++; });
    site.forest = W.biome[i] === B.FOREST || forestN >= 3;
    site.hill = W.biome[i] === B.HILLS || hillN >= 4;
    site.marsh = W.biome[i] === B.MARSH;
    /* bearing to the nearest ocean node within 4 nodes, for "the sea lies to the west" */
    site.coastBearing = null;
    if (W.dOcean[i] <= 4) {
      var best = null, bd = 1e9, c = g.col(i), r = g.row(i), dc, dr, cc, rr, kk, d;
      for (dr = -4; dr <= 4; dr++) for (dc = -4; dc <= 4; dc++) { cc = c + dc; rr = r + dr; if (!g.inside(cc, rr)) continue; kk = g.idx(cc, rr); if (W.water[kk] !== 1) continue; d = dc * dc + dr * dr; if (d < bd) { bd = d; best = kk; } }
      if (best !== null) site.coastBearing = G.bearing([g.px(i), g.py(i)], [g.px(best), g.py(best)]).name;
    }
    return site;
  }

  function settlements(P, W, rng, namer) {
    var g = W.g, scores = [], i, c, r, s, margin = Math.max(4, Math.round(g.cols * 0.045)), landArea = W.landCount * g.dx * g.dy, warnings = [];
    for (i = 0; i < g.n; i++) {
      if (W.water[i] !== 0 || W.biome[i] === B.MOUNTAIN) continue;
      c = g.col(i); r = g.row(i);
      if (c < margin || r < margin || c >= g.cols - margin || r >= g.rows - margin) continue;
      /* a site is water access + farmland − hardship, with enough noise that harbours, river towns and inland market
         towns all appear; the hinterland bonus keeps every settlement from crowding the shore */
      s = 1;
      if (W.dOcean[i] <= 1.5) s += 1.3; else if (W.dOcean[i] <= 2.5) s += 0.5; else if (W.dOcean[i] >= 4 && W.dOcean[i] <= 14) s += 0.7;
      var onRiver = W.riverAt[i] >= 0, nearRiver = onRiver;
      if (!nearRiver) g.neighbors8(i, function (k) { if (W.riverAt[k] >= 0) nearRiver = true; });
      if (onRiver) s += 1.3; else if (nearRiver) s += 1.0;
      if (onRiver && W.dOcean[i] <= 1.5) s += 0.9;
      if (W.dLake[i] <= 1.5) s += 0.9;
      s -= 1.5 * U.clamp(W.slope[i] / 0.05, 0, 1);
      s += [0, 0, 0.5, -0.4, -0.5, -9, -1.5, -0.8][W.biome[i]];
      s += 0.9 * (1 - Math.min(1, Math.abs(W.moisture[i] - 0.55) * 2));
      s += rng.float() * 1.2;
      scores.push({ i: i, s: s });
    }
    scores.sort(function (a, b) { return b.s - a.s; });
    var N = P.settlements, chosen = [], spacing = 0.8 * Math.sqrt(landArea / Math.max(1, N)), attempt, j, ok, p;
    for (attempt = 0; attempt < 4 && chosen.length < N; attempt++) {
      if (attempt) spacing *= 0.75;
      for (j = 0; j < scores.length && chosen.length < N; j++) {
        p = scores[j]; ok = true;
        for (i = 0; i < chosen.length; i++) { if (chosen[i].i === p.i || G.dist([g.px(p.i), g.py(p.i)], [g.px(chosen[i].i), g.py(chosen[i].i)]) < spacing) { ok = false; break; } }
        if (ok) chosen.push(p);
      }
    }
    if (chosen.length < N) warnings.push("only " + chosen.length + " of " + N + " settlements fit on this land; try more land or fewer settlements");
    chosen.sort(function (a, b) { return b.s - a.s; });
    var cities = Math.max(N ? 1 : 0, Math.round(chosen.length * 0.2)), towns = Math.round(chosen.length * 0.3), places = [];
    chosen.forEach(function (ch, idx) {
      var kind = idx < cities ? "city" : idx < cities + towns ? "town" : "village", pin = P.pins[idx] || null;
      if (pin && pin.kind) kind = pin.kind;
      var site = siteOf(W, ch.i);
      places.push({
        id: "p" + idx, name: pin ? pin.name : namer.settlement(kind, site), kind: kind, capital: idx === 0 && kind === "city",
        x: U.round(g.px(ch.i), 1), y: U.round(g.py(ch.i), 1), score: U.round(ch.s, 2), pinned: !!pin, site: site
      });
    });
    if (P.pins.length > places.length) warnings.push((P.pins.length - places.length) + " pin(s) had no settlement to land on");
    return { places: places, warnings: warnings };
  }

  /* ── caves ── the mouths of the caves (TnDMaps.dungeon.fromRegion opens the caves behind one): on the steep ground —
     a hillside, the fringe of a range, a sea cliff —, off the roads and the places, spaced like the settlements. Each
     carries the site the cave generator reads: how steep, whether it is a sea cave or has water near, which way the
     mouth faces (downhill: the cave runs the other way into the rock), how big a system lies behind it, and the
     nearest place with its bearing and distance for the GM. */
  var EXTENTS = ["small", "modest", "great", "vast"];
  function caves(P, W, places, roadAt, rng, namer) {
    var g = W.g, scores = [], i, c, r, s, k, margin = Math.max(3, Math.round(g.cols * 0.04)), landArea = W.landCount * g.dx * g.dy, warnings = [], N = P.caves;
    if (!N) return { caves: [], warnings: warnings };
    for (i = 0; i < g.n; i++) {
      if (W.water[i] !== 0 || roadAt[i]) continue;
      c = g.col(i); r = g.row(i);
      if (c < margin || r < margin || c >= g.cols - margin || r >= g.rows - margin) continue;
      var mountainN = 0, rockN = 0, lower = false;
      g.neighbors8(i, function (k2) { if (W.biome[k2] === B.MOUNTAIN) mountainN++; if (W.biome[k2] === B.MOUNTAIN || W.biome[k2] === B.HILLS) rockN++; if (W.h[k2] < W.h[i]) lower = true; });
      if (W.biome[i] === B.MOUNTAIN && mountainN >= 7) continue;   /* deep in a range: no way to reach it */
      if (!lower) continue;   /* a mouth opens downhill */
      var dPlace = Infinity; for (k = 0; k < places.length; k++) dPlace = Math.min(dPlace, G.dist([g.px(i), g.py(i)], [places[k].x, places[k].y]) / g.dx);
      if (dPlace < 2.5) continue;   /* not at a town's doorstep */
      s = 2.2 * U.clamp(W.slope[i] / 0.04, 0, 1);
      if (W.biome[i] === B.HILLS) s += 1.0; else if (W.biome[i] === B.MOUNTAIN) s += 0.6;
      s += 0.25 * Math.min(rockN, 4);
      if (W.dOcean[i] <= 1.5 && W.slope[i] > 0.01) s += 1.5;   /* a sea cave in the cliffs */
      if (dPlace <= 9) s += 0.9; else if (dPlace > 14) s -= 0.5;   /* a cave the party can reach from somewhere */
      if (W.biome[i] === B.FOREST) s += 0.3;
      if (W.biome[i] === B.MARSH) s -= 1.5;
      s += rng.float() * 0.8;
      if (s < 1.2) continue;   /* flat farmland has no caves */
      scores.push({ i: i, s: s });
    }
    scores.sort(function (a, b) { return b.s - a.s; });
    var chosen = [], spacing = 0.55 * Math.sqrt(landArea / Math.max(1, N)), attempt, j, ok, p;
    for (attempt = 0; attempt < 4 && chosen.length < N; attempt++) {
      if (attempt) spacing *= 0.75;
      for (j = 0; j < scores.length && chosen.length < N; j++) {
        p = scores[j]; ok = true;
        for (i = 0; i < chosen.length; i++) { if (chosen[i].i === p.i || G.dist([g.px(p.i), g.py(p.i)], [g.px(chosen[i].i), g.py(chosen[i].i)]) < spacing) { ok = false; break; } }
        if (ok) chosen.push(p);
      }
    }
    if (chosen.length < N) warnings.push("only " + chosen.length + " of " + N + " caves found steep ground; try more relief or fewer caves");
    var out = [], er = NS.Rng(P.seed + "/caveextent");   /* the extents in order: a fourth cave never resizes the first three */
    chosen.forEach(function (ch, idx) {
      var node = ch.i, site = siteOf(W, node), x = U.round(g.px(node), 1), y = U.round(g.py(node), 1), low = null, lh = W.h[node], near = null, nd = Infinity, kk;
      g.neighbors8(node, function (k2) { if (W.h[k2] < lh) { lh = W.h[k2]; low = k2; } });
      site.facing = low === null ? (site.coastBearing || "S") : G.bearing([x, y], [g.px(low), g.py(low)]).name;   /* downhill: the way the mouth looks */
      site.water = !!(site.coastal || site.river !== null || site.lake);
      site.extent = EXTENTS[er.int(4)];   /* how big a system lies behind it: from the seed, not the score */
      if (site.river !== null) { site.riverId = "w" + site.river; } else site.riverId = null; delete site.river;
      for (kk = 0; kk < places.length; kk++) { var d = G.dist([x, y], [places[kk].x, places[kk].y]); if (d < nd) { nd = d; near = places[kk]; } }
      out.push({ id: "c" + idx, name: namer.feature("cave"), kind: "cave", x: x, y: y, score: U.round(ch.s, 2), site: site,
        near: near ? { id: near.id, name: near.name, km: U.round(nd * P.scaleKm / P.width, 1), bearing: G.bearing([near.x, near.y], [x, y]).name } : null });
    });
    return { caves: out, warnings: warnings };
  }
  /* "a sea cave in the cliffs 12 km NE of Ashford, facing S" — the digest's and the cave's own words for where a mouth lies */
  function caveWhere(c) {
    var what = c.site.coastal ? "a sea cave in the cliffs" : c.site.biome === "mountain" ? "a cave in the mountainside" : c.site.hill ? "a cave in the hillside" : c.site.forest ? "a cave under the wood" : "a cave in the rising ground";
    return what + (c.near ? " " + NS.digest.fmtKm(c.near.km) + " " + c.near.bearing + " of " + c.near.name : "") + ", facing " + c.site.facing;
  }

  /* ── roads ── A* over the grid; existing roads are cheap so the network merges */
  var BIOME_COST = [0, 0, 0, 1.0, 1.2, 5, 2.5, 0.3];
  function roads(P, W, places, rng) {
    var g = W.g, placeAt = new Int32Array(g.n), roadAt = new Uint8Array(g.n), i, j, out = [], edges = {}, list = [];
    for (i = 0; i < g.n; i++) placeAt[i] = -1;
    places.forEach(function (p, idx) { placeAt[p.site.node] = idx; });
    function addEdge(a, b, d) { var k = a < b ? a + "-" + b : b + "-" + a; if (!edges[k]) { edges[k] = true; list.push({ a: a, b: b, d: d }); } }
    /* candidates: 3 nearest neighbours of each place, plus a spanning tree so the network is connected */
    var pairs = [];
    for (i = 0; i < places.length; i++) {
      var near = [];
      for (j = 0; j < places.length; j++) if (j !== i) near.push({ j: j, d: G.dist([places[i].x, places[i].y], [places[j].x, places[j].y]) });
      near.sort(function (a, b) { return a.d - b.d; });
      near.slice(0, 3).forEach(function (nb) { addEdge(i, nb.j, nb.d); });
      for (j = i + 1; j < places.length; j++) pairs.push({ a: i, b: j, d: G.dist([places[i].x, places[i].y], [places[j].x, places[j].y]) });
    }
    pairs.sort(function (a, b) { return a.d - b.d; });
    var parent = []; for (i = 0; i < places.length; i++) parent.push(i);
    function find(x) { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; }
    pairs.forEach(function (pr) { var ra = find(pr.a), rb = find(pr.b); if (ra !== rb) { parent[ra] = rb; addEdge(pr.a, pr.b, pr.d); } });
    list.sort(function (a, b) { return a.d - b.d; });

    function astar(from, to) {
      var open = U.Heap(function (a, b) { return a.f < b.f; }), gScore = new Float32Array(g.n), came = new Int32Array(g.n), closed = new Uint8Array(g.n), k;
      for (k = 0; k < g.n; k++) { gScore[k] = Infinity; came[k] = -1; }
      var tx = g.px(to), ty = g.py(to), unit = Math.min(g.dx, g.dy);
      function hcost(n) { return 0.35 * Math.sqrt(Math.pow(g.px(n) - tx, 2) + Math.pow(g.py(n) - ty, 2)) / unit; }
      gScore[from] = 0; open.push({ i: from, f: hcost(from) });
      var expanded = 0;
      while (open.size()) {
        var cur = open.pop().i;
        if (closed[cur]) continue; closed[cur] = 1;
        if (cur === to) break;
        if (++expanded > g.n) break;
        g.neighbors8(cur, function (nb, len) {
          if (closed[nb] || W.water[nb] !== 0) return;
          var slope = Math.abs(W.h[nb] - W.h[cur]) / len, cost = len * (1 + BIOME_COST[W.biome[nb]] + 12 * slope);
          if (W.riverAt[nb] >= 0 && placeAt[nb] < 0) cost += 4;
          if (roadAt[nb]) cost *= 0.35;
          var ng = gScore[cur] + cost;
          if (ng < gScore[nb]) { gScore[nb] = ng; came[nb] = cur; open.push({ i: nb, f: ng + hcost(nb) }); }
        });
      }
      if (gScore[to] === Infinity) return null;
      var path = [to]; k = to; while (k !== from) { k = came[k]; path.unshift(k); }
      return path;
    }

    var unreachable = [];
    list.forEach(function (e) {
      var A = places[e.a], Bp = places[e.b], path = astar(A.site.node, Bp.site.node);
      if (!path) { unreachable.push({ from: A.id, to: Bp.id }); return; }
      var pts = [], bridges = [], k, n;
      for (k = 0; k < path.length; k++) {
        n = path[k]; pts.push([g.px(n), g.py(n)]);
        if (W.riverAt[n] >= 0 && placeAt[n] < 0 && !roadAt[n]) bridges.push([U.round(g.px(n), 1), U.round(g.py(n), 1)]);
        roadAt[n] = 1;
      }
      var line = G.simplify(G.smooth(pts, 2, false), g.dx * 0.12);
      line[0] = [A.x, A.y]; line[line.length - 1] = [Bp.x, Bp.y];
      var kind = (A.kind !== "village" && Bp.kind !== "village") ? "road" : "track";
      out.push({ id: "r" + out.length, kind: kind, from: A.id, to: Bp.id, pts: roundPts(line), bridges: bridges, lengthUnits: U.round(G.length(line), 1) });
      A.site.roads = A.site.roads || []; Bp.site.roads = Bp.site.roads || [];
      A.site.roads.push({ to: Bp.id, bearing: G.bearing([A.x, A.y], [Bp.x, Bp.y]).name, road: "r" + (out.length - 1) });
      Bp.site.roads.push({ to: A.id, bearing: G.bearing([Bp.x, Bp.y], [A.x, A.y]).name, road: "r" + (out.length - 1) });
    });
    places.forEach(function (p) { p.site.roads = p.site.roads || []; });
    return { roads: out, roadAt: roadAt, unreachable: unreachable };
  }

  /* ── named features ── ranges, forests, lakes, marshes, seas; river names on the rivers themselves */
  function features(P, W, namer) {
    var g = W.g, out = [], lakeIdAt = new Int32Array(g.n), i;
    for (i = 0; i < g.n; i++) lakeIdAt[i] = -1;
    function pts(comp) { return comp.cells.map(function (k) { return [g.px(k), g.py(k)]; }); }
    function add(kind, comp, name, extra) {
      var f = U.extend({ id: "f" + out.length, kind: kind, name: name, x: U.round(comp.cx, 1), y: U.round(comp.cy, 1), size: comp.size, angle: 0 }, extra || {});
      out.push(f); return f;
    }
    G.components(g, function (k) { return W.biome[k] === B.MOUNTAIN; }, 10).slice(0, 6).forEach(function (comp) {
      add("range", comp, namer.feature("range"), { angle: U.round(G.principalAngle(pts(comp)), 3) });
    });
    G.components(g, function (k) { return W.biome[k] === B.FOREST; }, 30).slice(0, 5).forEach(function (comp) {
      add("forest", comp, namer.feature("forest"), { angle: U.round(G.principalAngle(pts(comp)) * 0.5, 3) });
    });
    G.components(g, function (k) { return W.water[k] === 2; }, 4).slice(0, 6).forEach(function (comp) {
      var f = add("lake", comp, comp.size >= 6 ? namer.feature("lake") : null);
      comp.cells.forEach(function (k) { lakeIdAt[k] = out.indexOf(f); });
    });
    G.components(g, function (k) { return W.biome[k] === B.MARSH; }, 20).slice(0, 2).forEach(function (comp) {
      add("marsh", comp, namer.feature("marsh"));
    });
    /* seas: each ocean body of some size gets a name, placed on open water away from land and frame */
    G.components(g, function (k) { return W.water[k] === 1; }, Math.max(20, g.n * 0.04)).slice(0, 3).forEach(function (comp) {
      var best = null, bs = -1, k, c, r, s;
      for (i = 0; i < comp.cells.length; i++) {
        k = comp.cells[i]; c = g.col(k); r = g.row(k);
        s = Math.min(W.dLand[k], 0.7 * Math.min(c, r, g.cols - 1 - c, g.rows - 1 - r) + 0.5);
        if (s > bs) { bs = s; best = k; }
      }
      add("sea", { cx: g.px(best), cy: g.py(best), size: comp.size }, namer.feature("sea"), { open: U.round(bs, 2) });
    });
    return { features: out, lakeIdAt: lakeIdAt };
  }

  /* ── glyphs ── jittered-grid stamps for mountains, hills, trees and reeds; drawn back to front by the scene */
  function glyphs(P, W, placeAt, roadAt, rng) {
    var g = W.g, out = [], dx = g.dx, SPEC = [
      { k: "mtn", biome: B.MOUNTAIN, step: 1.15, size: function (i) { return 0.7 + 0.8 * U.clamp((W.h[i] - W.mountainT) / (1 - W.mountainT), 0, 1) + rng.float() * 0.15; } },
      { k: "hill", biome: B.HILLS, step: 1.55, size: function () { return 0.65 + rng.float() * 0.35; } },
      { k: "tree", biome: B.FOREST, step: 0.95, size: function () { return 0.8 + rng.float() * 0.4; } },
      { k: "reed", biome: B.MARSH, step: 1.9, size: function () { return 0.8 + rng.float() * 0.3; } }
    ];
    SPEC.forEach(function (sp) {
      var step = sp.step * dx, x, y, jx, jy, i;
      for (y = step / 2; y < g.h; y += step) for (x = step / 2; x < g.w; x += step) {
        jx = x + (rng.float() - 0.5) * step * 0.8; jy = y + (rng.float() - 0.5) * step * 0.8;
        i = g.nearest(jx, jy);
        if (W.biome[i] !== sp.biome || roadAt[i] || placeAt[i] >= 0) continue;
        if (jx < dx * 0.6 || jy < dx * 0.6 || jx > g.w - dx * 0.6 || jy > g.h - dx * 0.6) continue;
        out.push({ k: sp.k, x: U.round(jx, 1), y: U.round(jy, 1), s: U.round(sp.size(i), 2) });
      }
    });
    return out;
  }

  /* ── vector geometry ── coast and lake polygons, ripple lines, river polylines with widths */
  function roundPts(pts) { return pts.map(function (p) { return p.length > 2 ? [U.round(p[0], 1), U.round(p[1], 1), U.round(p[2], 2)] : [U.round(p[0], 1), U.round(p[1], 1)]; }); }
  function coastlines(W, seed) {
    var g = W.g, wob = NS.Noise(seed + "/wobble"), dx = g.dx, coast = [], lakes = [], ripples = [], i;
    function finish(poly, closed) {
      var p = G.simplify(poly, dx * 0.2); if (p.length < (closed ? 3 : 2)) return null;
      p = G.smooth(p, 2, closed); p = G.wobble(p, wob.noise2, dx * 0.22, 1 / (2.3 * dx), closed);
      return roundPts(p);
    }
    /* a coast polygon may run along the frame (land cut by the map's edge): those runs stay exactly on the frame and
       only the real shoreline between them is smoothed and wobbled */
    function finishCoast(poly) {
      return G.polishFramePolygon(poly, g.w, g.h, function (pts, closed) {
        var p = G.simplify(pts, dx * 0.2); if (closed && p.length < 3) return null;
        p = G.smooth(p, 2, closed); return G.wobble(p, wob.noise2, dx * 0.22, 1 / (2.3 * dx), closed);
      }, 1);
    }
    if (W.seaPresent) {
      var hField = W.h; /* lakes are land here (positive height) so the coast is the ocean's edge only */
      var hs = new Float32Array(g.n); for (i = 0; i < g.n; i++) hs[i] = W.water[i] === 2 ? 0.01 : W.h[i];
      G.polygonsFromField(hs, g, 0).forEach(function (poly) { if (Math.abs(G.signedArea(poly)) < 0.5 * dx * dx) return; var f = finishCoast(poly); if (f) coast.push(f); });
      void hField;
      /* ripples: offset lines in the sea, parallel to the coast */
      var levels = [1.7, 3.3, 5.3], L;
      for (L = 0; L < levels.length; L++) {
        var raw = G.contoursFromField(W.dLand, g, levels[L]);
        raw.closed.forEach(function (ch) { var f = finish(ch, true); if (f && f.length > 3) ripples.push({ level: L, pts: f, closed: true }); });
        raw.open.forEach(function (ch) { var f = finish(ch, false); if (f && f.length > 2) ripples.push({ level: L, pts: f, closed: false }); });
      }
    }
    /* lakes: a soft mask contoured a little below zero so a three-node lake still draws */
    var lf = new Float32Array(g.n), hasLake = false;
    for (i = 0; i < g.n; i++) { lf[i] = W.water[i] === 2 ? 1 : -1; if (W.water[i] === 2) hasLake = true; }
    if (hasLake) {
      var lb = new Float32Array(g.n);
      for (i = 0; i < g.n; i++) { var sum = 4 * lf[i], w = 4; g.neighbors8(i, function (k, len) { var ww = len > 1 ? 0.5 : 1; sum += ww * lf[k]; w += ww; }); lb[i] = sum / w; }
      G.contoursFromField(lb, g, -0.25).closed.forEach(function (ch) { var f = finish(ch, true); if (f) lakes.push(f); });
    }
    return { coast: coast, lakes: lakes, ripples: ripples };
  }
  function riverLines(W, namer, seed) {
    var g = W.g, wob = NS.Noise(seed + "/riverwobble"), maxAcc = 1, out = [];
    W.rivers.forEach(function (r) { if (r.acc > maxAcc) maxAcc = r.acc; });
    var byAcc = W.rivers.slice().sort(function (a, b) { return b.acc - a.acc; }), named = {};
    byAcc.slice(0, 6).forEach(function (r) { if (r.nodes.length >= 6) named[r.id] = namer.feature("river"); });
    W.rivers.forEach(function (r) {
      var raw = r.nodes.map(function (n) { return [g.px(n), g.py(n), 0.5 + 2.4 * Math.sqrt(W.acc[n] / maxAcc)]; }), endNode = r.end.node, last = r.nodes[r.nodes.length - 1];
      if (r.end.kind === "sea" || r.end.kind === "lake") {
        /* end at the shoreline between the last land node and the water node */
        var hl = W.h[last], hw = W.h[endNode] <= 0 ? W.h[endNode] : -0.01, t = hl / (hl - hw);
        raw.push([g.px(last) + (g.px(endNode) - g.px(last)) * t, g.py(last) + (g.py(endNode) - g.py(last)) * t, raw[raw.length - 1][2]]);
      } else if (r.end.kind === "river") {
        raw.push([g.px(endNode), g.py(endNode), raw[raw.length - 1][2]]);
      }
      if (raw.length < 2) return;
      var xy = raw.map(function (p) { return [p[0], p[1]]; }), sm = G.smooth(xy, 2, false);
      sm = G.wobble(sm, wob.noise2, g.dx * 0.12, 1 / (1.8 * g.dx), false);
      sm[0] = xy[0]; sm[sm.length - 1] = xy[xy.length - 1];
      var pts = sm.map(function (p, idx) { var t = idx / (sm.length - 1) * (raw.length - 1), a = Math.floor(t), b = Math.min(raw.length - 1, a + 1), f = t - a; return [p[0], p[1], raw[a][2] * (1 - f) + raw[b][2] * f]; });
      out.push({ id: "w" + r.id, name: named[r.id] || null, pts: roundPts(pts), endsIn: r.end.kind, length: r.nodes.length, acc: U.round(r.acc, 1) });
    });
    return out;
  }

  /* ── byte fields ── height: land (h > 0) is 129..255, sea is 0..127, 128 is never used so "> 128" means land exactly;
     biome: BIOME codes */
  function encodeFields(W) {
    var g = W.g, hb = new Array(g.n), bb = new Array(g.n), i, v;
    for (i = 0; i < g.n; i++) { v = W.h[i]; hb[i] = v > 0 ? 129 + U.clamp(Math.round(v * 126), 0, 126) : 127 - U.clamp(Math.round(-v * 127), 0, 127); bb[i] = W.biome[i]; }
    return { encoding: "base64-u8", height: NS.bytesToBase64(hb), biome: NS.bytesToBase64(bb) };
  }

  /* ── generate ── */
  function generate(input) {
    var P = resolveParams(input), t0 = TR.now(), stats = {}, seed = P.seed;
    var rows = Math.max(8, Math.round(P.cells * P.height / P.width)), g = G.Grid(P.cells, rows, P.width, P.height);
    var W = TR.build(P, g, seed); stats.terrain = U.round(TR.now() - t0, 1); t0 = TR.now();
    var namer = NS.names.Namer(NS.Rng(seed + "/names"), P.culture);
    var title = P.title || namer.feature("realm");
    var S = settlements(P, W, NS.Rng(seed + "/settle"), namer);
    var placeAt = new Int32Array(g.n), i; for (i = 0; i < g.n; i++) placeAt[i] = -1;
    S.places.forEach(function (p, idx) { placeAt[p.site.node] = idx; });
    var R = roads(P, W, S.places, NS.Rng(seed + "/roads")); stats.settlementsRoads = U.round(TR.now() - t0, 1); t0 = TR.now();
    var F = features(P, W, namer);
    S.places.forEach(function (p) { if (p.site.lake) { var lk = null; g.neighbors8(p.site.node, function (k) { if (lk === null && F.lakeIdAt[k] >= 0) lk = F.features[F.lakeIdAt[k]].id; }); p.site.lakeId = lk; } });
    var rivers = riverLines(W, namer, seed);
    S.places.forEach(function (p) { if (p.site.river !== null) { p.site.riverId = "w" + p.site.river; delete p.site.river; } else { p.site.riverId = null; delete p.site.river; } });
    var CV = caves(P, W, S.places, R.roadAt, NS.Rng(seed + "/caves"), namer);
    var caveAt = new Uint8Array(g.n); CV.caves.forEach(function (cv) { caveAt[cv.site.node] = 1; });
    var gl = glyphs(P, W, placeAt, R.roadAt, NS.Rng(seed + "/glyphs")).filter(function (gy) { return !caveAt[g.nearest(gy.x, gy.y)]; });   /* a glyph never stands on a cave mouth */
    var C = coastlines(W, seed); stats.geometry = U.round(TR.now() - t0, 1);
    var doc = {
      format: NS.DOC_FORMAT, ver: NS.DOC_VER, generator: { name: "region", version: NS.VERSION },
      seed: seed, params: P,
      frame: { width: P.width, height: P.height, cols: g.cols, rows: g.rows, kmPerUnit: U.round(P.scaleKm / P.width, 5), travelKmPerDay: P.travelKmPerDay },
      title: { name: title, kind: "realm" },
      sea: { present: W.seaPresent },
      coast: C.coast, lakes: C.lakes, ripples: C.ripples,
      rivers: rivers, roads: R.roads, places: S.places, caves: CV.caves, features: F.features, glyphs: gl,
      fields: P.fields ? encodeFields(W) : null,
      warnings: S.warnings.concat(R.unreachable.length ? ["" + R.unreachable.length + " settlement pair(s) are separated by water (no road)"] : []).concat(CV.warnings),
      seaLinks: R.unreachable,
      /* portals: the ways into another zone — every place opens its town (no single point of arrival there), every
         cave mouth the caves behind it (the dungeon's way up carries the same id) */
      portals: S.places.map(function (p) { return { id: p.id, kind: "place", name: p.name, x: p.x, y: p.y, to: { generator: "town", id: null } }; })
        .concat(CV.caves.map(function (cv) { return { id: cv.id, kind: "cave", name: cv.name, x: cv.x, y: cv.y, to: { generator: "dungeon", site: "cave", id: cv.id } }; })),
      stats: U.extend({ landFraction: U.round(W.landCount / g.n, 3), riverCount: rivers.length, glyphCount: gl.length, terrainStages: W.stats }, stats)
    };
    doc.stats.total = U.round(stats.terrain + stats.settlementsRoads + stats.geometry, 1);
    return doc;
  }

  /* ── validate ── the region document shape */
  function validate(doc) {
    NS.assert(doc.frame.cols >= 8 && doc.frame.rows >= 8, "region frame needs cols and rows", { frame: doc.frame });
    ["coast", "lakes", "ripples", "rivers", "roads", "places", "caves", "features", "glyphs"].forEach(function (k) { NS.assert(Array.isArray(doc[k]), "document." + k + " must be an array", { key: k }); });
    doc.places.forEach(function (p, i) { NS.assert(p.id && typeof p.name === "string" && KINDS.indexOf(p.kind) >= 0 && isFinite(p.x) && isFinite(p.y) && p.site, "place " + i + " is malformed", { place: p }); });
    doc.caves.forEach(function (c, i) { NS.assert(c.id && typeof c.name === "string" && c.kind === "cave" && isFinite(c.x) && isFinite(c.y) && c.site && typeof c.site.facing === "string" && EXTENTS.indexOf(c.site.extent) >= 0, "cave " + i + " is malformed", { cave: c }); });
    NS.validatePortals(doc);
    return doc;
  }

  NS.region = { generate: generate, DEFAULTS: DEFAULTS, LANDMASSES: LANDMASSES, KINDS: KINDS, EXTENTS: EXTENTS, caveWhere: caveWhere, resolveParams: resolveParams, validate: validate };
})(typeof self !== "undefined" ? self : typeof global !== "undefined" ? global : this);

/* ───── 42-town.js ───── */
/* 42-town.js — the TOWN generator: a settlement's site context → a ringed Voronoi substrate → water, the urban set, the
   market, the main streets from the gates, walls and towers, landmarks, building lots, fields and roads → the town
   document. Nesting contract: NS.town.fromRegion(regionDoc, placeId) → params for TnDMaps.generate("town", params). */
(function (root) {
  "use strict";
  var NS = root.TnDMaps, U = NS.util, G = NS.geom, M = NS.mesh;

  var BEARINGS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  var SIZES = {
    hamlet: { radius: 0.115, spacing: 0.08, walls: false, castle: false, temple: false, yard: 0.5, districts: 0, parks: 0 },
    village: { radius: 0.17, spacing: 0.07, walls: false, castle: false, temple: true, yard: 0.32, districts: 0, parks: 0 },
    town: { radius: 0.26, spacing: 0.058, walls: true, castle: "maybe", temple: true, yard: 0.14, districts: 4, parks: 1 },
    city: { radius: 0.35, spacing: 0.05, walls: true, castle: true, temple: true, yard: 0.08, districts: 7, parks: 2 }
  };
  var M_PER_UNIT = 1.25;
  /* the sheets a town is drawn on, in its own units (a side of 500 m to 7.5 km); what lies beneath takes the same
     ground in ITS units (44's SHEET is derived from this one), so every sheet a town may have has its sewers */
  var SHEET = { min: 400, max: 6000 };
  var WIDTH = { main: 6.4, street: 4, lane: 2.8, road: 5.6 };   /* units of 1.25 m: a main street 8 m, a street 5, a lane 3.5, the road out 7 */
  /* establishments: kind → count, overriding the catalogue's count for the size (43-establishments); edits: the
     author's changes, applied in order — add {id, kind, at|building, name?}, remove {id}, rename {id, name}, move {id, at} */
  var DEFAULTS = { seed: null, width: 800, height: 550, size: "town", culture: "common", title: null, walls: "auto", castle: "auto", density: 0.5, site: {}, establishments: {}, edits: [] };
  var SITE_KEYS = ["coast", "river", "lake", "roads", "hill", "forest", "marsh", "biome", "elevation", "mouth", "riverName", "seaName", "lakeName", "regionName", "regionSeed", "placeId", "placeKind"];
  var RIVER_OPTIONS = { "N-S": ["N", "S"], "S-N": ["S", "N"], "E-W": ["E", "W"], "W-E": ["W", "E"], "NW-SE": ["NW", "SE"], "SE-NW": ["SE", "NW"], "NE-SW": ["NE", "SW"], "SW-NE": ["SW", "NE"] };

  function dirOf(bearing) { var a = BEARINGS.indexOf(bearing) * Math.PI / 4; return [Math.sin(a), -Math.cos(a)]; }
  function isBearing(b) { return BEARINGS.indexOf(b) >= 0; }
  function roundPts(pts) { return pts.map(function (p) { return p.length > 2 ? [U.round(p[0], 1), U.round(p[1], 1), U.round(p[2], 2)] : [U.round(p[0], 1), U.round(p[1], 1)]; }); }
  function key(p) { return Math.round(p[0] * 1000) + "," + Math.round(p[1] * 1000); }

  /* ── parameters ── */
  function resolveParams(input) {
    var P = U.extend({}, DEFAULTS, input || {}), k, S;
    for (k in input || {}) if (Object.prototype.hasOwnProperty.call(input, k) && !Object.prototype.hasOwnProperty.call(DEFAULTS, k)) NS.fail("unknown parameter", { param: k, known: Object.keys(DEFAULTS) });
    NS.assert(P.seed !== null && P.seed !== undefined && String(P.seed).length > 0, "seed is required (a string or number)", { seed: P.seed });
    function num(name, lo, hi) { NS.assert(U.isNum(P[name]) && P[name] >= lo && P[name] <= hi, name + " must be a number in [" + lo + ", " + hi + "]", { value: P[name] }); }
    num("width", SHEET.min, SHEET.max); num("height", SHEET.min, SHEET.max); num("density", 0, 1);
    NS.assert(NS.own(SIZES, P.size), "size must be one of " + Object.keys(SIZES).join("|"), { size: P.size });
    NS.assert(NS.own(NS.names.CULTURES, P.culture), "culture must be one of " + NS.names.cultures().join("|"), { culture: P.culture });
    NS.assert(P.title === null || typeof P.title === "string", "title must be a string or null", { title: P.title });
    NS.assert(P.walls === "auto" || P.walls === true || P.walls === false, "walls must be auto|true|false", { walls: P.walls });
    NS.assert(P.castle === "auto" || P.castle === true || P.castle === false, "castle must be auto|true|false", { castle: P.castle });
    NS.assert(P.site && typeof P.site === "object" && !Array.isArray(P.site), "site must be an object", { site: P.site });
    NS.establishments.validateCounts(P.establishments); NS.establishments.validateEdits(P.edits, { width: P.width, height: P.height });
    S = U.extend({}, P.site);
    for (k in S) if (Object.prototype.hasOwnProperty.call(S, k) && SITE_KEYS.indexOf(k) < 0) NS.fail("unknown site key", { key: k, known: SITE_KEYS });
    S.coast = S.coast || null; S.lake = S.lake || null; S.river = S.river || null; S.roads = S.roads || [];
    NS.assert(S.coast === null || isBearing(S.coast), "site.coast must be a bearing (" + BEARINGS.join("|") + ") or null", { coast: S.coast });
    NS.assert(S.lake === null || isBearing(S.lake), "site.lake must be a bearing or null", { lake: S.lake });
    if (typeof S.river === "string") { NS.assert(NS.own(RIVER_OPTIONS, S.river), "site.river must be {from, to} or one of " + Object.keys(RIVER_OPTIONS).join("|"), { river: S.river }); S.river = { from: RIVER_OPTIONS[S.river][0], to: RIVER_OPTIONS[S.river][1] }; }
    NS.assert(S.river === null || (isBearing(S.river.from) && isBearing(S.river.to) && S.river.from !== S.river.to), "site.river must be null or {from, to} with two different bearings", { river: S.river });
    NS.assert(Array.isArray(S.roads), "site.roads must be an array of {bearing, to?, kind?}", { roads: S.roads });
    S.roads.forEach(function (r, i) { NS.assert(r && isBearing(r.bearing), "site.roads[" + i + "].bearing must be a bearing", { road: r }); });
    NS.assert(S.coast === null || S.lake === null || S.coast !== S.lake, "site.coast and site.lake cannot lie in the same bearing", { coast: S.coast, lake: S.lake });
    P.site = S; P.seed = String(P.seed);
    return P;
  }

  /* ── the substrate ── jittered concentric rings of points, denser toward the centre, out past the frame corners, plus
     a far ring so every cell inside the frame is closed; the cells are clipped to the frame. */
  function substrate(P, R, rng) {
    var W = P.width, H = P.height, s0 = Math.min(W, H) * SIZES[P.size].spacing, cx = W / 2, cy = H / 2, pts = [[cx, cy]], r = 0;
    var far = Math.sqrt(W * W + H * H) / 2 + 2 * s0, k, count, off, a, jr, ja, sp, inner;
    var grow = Math.max(R, Math.min(W, H) * 0.3);
    function spacing(rr) { var t = rr / R; return t <= 1 ? s0 * (0.82 + 0.4 * t) : s0 * (1.22 + 1.1 * (rr - R) / grow); }
    while (r < far) {
      sp = spacing(r); r += sp;
      count = Math.max(6, Math.round(2 * Math.PI * r / spacing(r))); off = rng.float() * Math.PI * 2;
      for (k = 0; k < count; k++) {
        a = off + k / count * Math.PI * 2; jr = (rng.float() - 0.5) * 0.55 * spacing(r); ja = (rng.float() - 0.5) * 0.55 * spacing(r) / r;
        pts.push([cx + Math.cos(a + ja) * (r + jr), cy + Math.sin(a + ja) * (r + jr)]);
      }
    }
    inner = pts.length;
    for (k = 0; k < 16; k++) { a = k / 16 * Math.PI * 2; pts.push([cx + Math.cos(a) * far * 2.5, cy + Math.sin(a) * far * 2.5]); }
    var D = M.delaunay(pts), V = M.voronoi(pts, D), cells = new Array(inner), i, c, clipped;
    for (i = 0; i < inner; i++) {
      c = V.cells[i]; if (!c) { cells[i] = null; continue; }
      clipped = M.clipRect(c.poly, 0, 0, W, H);
      if (clipped.length < 3) { cells[i] = null; continue; }
      cells[i] = { i: i, site: pts[i], raw: c.poly, verts: c.verts, poly: clipped, clipped: clipped.length !== c.poly.length, d: G.dist(pts[i], [cx, cy]), kind: "land", urban: false, nb: [], area: Math.abs(G.signedArea(clipped)) };
    }
    /* neighbours and the edge table (edges between two live cells only) */
    var edges = [], e, j;
    for (j = 0; j < V.edges.length; j++) {
      e = V.edges[j]; if (e.a >= inner || e.b >= inner || !cells[e.a] || !cells[e.b]) continue;
      e.id = edges.length; e.len = G.dist(e.p, e.q); edges.push(e);
      cells[e.a].nb.push(e.b); cells[e.b].nb.push(e.a);
    }
    var byVerts = {}; edges.forEach(function (ed) { byVerts[Math.min(ed.t1, ed.t2) + "_" + Math.max(ed.t1, ed.t2)] = ed; });
    return { pts: pts, cells: cells, edges: edges, byVerts: byVerts, circ: D.circ, s0: s0, spacing: spacing, cx: cx, cy: cy, inner: inner, vpos: function (t) { return [D.circ[t][0], D.circ[t][1]]; } };
  }

  /* ── water ── one signed field (> 0 is water) for the sea and the lake, so cells and the drawn shore agree */
  function waterField(P, R, cx, cy, noise) {
    var coast = P.site.coast ? dirOf(P.site.coast) : null, lake = P.site.lake ? dirOf(P.site.lake) : null, lx, ly;
    if (lake) { lx = cx + lake[0] * 1.45 * R; ly = cy + lake[1] * 1.45 * R; }
    return function (x, y) {
      var v = -1e9, along, proj, ex, ey, e;
      if (coast) {
        proj = (x - cx) * coast[0] + (y - cy) * coast[1]; along = -(x - cx) * coast[1] + (y - cy) * coast[0];
        v = Math.max(v, proj - (0.62 * R + noise.fbm(along / (1.6 * R) + 7.31, 0.5, 3) * 0.3 * R));
      }
      if (lake) {
        ex = ((x - lx) * -lake[1] + (y - ly) * lake[0]) / (1.05 * R); ey = ((x - lx) * lake[0] + (y - ly) * lake[1]) / (0.7 * R);
        e = Math.sqrt(ex * ex + ey * ey);
        v = Math.max(v, (1 - e) * 0.6 * R + noise.fbm(x / (0.9 * R) + 3.1, y / (0.9 * R) + 1.7, 3) * 0.14 * R);
      }
      return v;
    };
  }
  function waterGeometry(P, water, seed) {
    var W = P.width, H = P.height, cols = 96, rows = Math.max(8, Math.round(cols * H / W)), g = G.Grid(cols, rows, W, H), f = new Float32Array(g.n), i, any = false, wob = NS.Noise(seed + "/shore");
    for (i = 0; i < g.n; i++) { f[i] = water(g.px(i), g.py(i)); if (f[i] > 0) any = true; }
    if (!any) return { polys: [], ripples: [] };
    var dx = g.dx;
    function polish(pts, closed) { var p = G.simplify(pts, dx * 0.25); if (closed && p.length < 3) return null; p = G.smooth(p, 2, closed); return G.wobble(p, wob.noise2, dx * 0.3, 1 / (2.5 * dx), closed); }
    var polys = [], ripples = [];
    G.polygonsFromField(f, g, 0).forEach(function (poly) { if (Math.abs(G.signedArea(poly)) < dx * dx) return; var p = G.polishFramePolygon(poly, W, H, polish, 1); if (p) polys.push(p); });
    [16, 34].forEach(function (level, L) {
      var raw = G.contoursFromField(f, g, level);
      raw.closed.concat(raw.open).forEach(function (ch, idx) { var closed = idx < raw.closed.length, p = polish(ch, closed); if (p && p.length > 2) ripples.push({ level: L, pts: roundPts(p), closed: closed }); });
    });
    return { polys: polys, ripples: ripples };
  }

  /* ── river ── a bend through the town, offset from the market so the square stands beside the water */
  function clipSegToRect(a, b, W, H) {
    var t0 = 0, t1 = 1, dx = b[0] - a[0], dy = b[1] - a[1], p, q, r, k;
    var P = [-dx, dx, -dy, dy], Q = [a[0], W - a[0], a[1], H - a[1]];
    for (k = 0; k < 4; k++) {
      p = P[k]; q = Q[k];
      if (p === 0) { if (q < 0) return null; continue; }
      r = q / p;
      if (p < 0) { if (r > t1) return null; if (r > t0) t0 = r; } else { if (r < t0) return null; if (r < t1) t1 = r; }
    }
    return [[a[0] + dx * t0, a[1] + dy * t0], [a[0] + dx * t1, a[1] + dy * t1]];
  }
  function riverLine(P, R, S, rng, noise, water) {
    var W = P.width, H = P.height, cx = S.cx, cy = S.cy, from = dirOf(P.site.river.from), to = dirOf(P.site.river.to), big = W + H;
    var start = [cx + from[0] * big, cy + from[1] * big], end = [cx + to[0] * big, cy + to[1] * big];
    var chx = to[0] - from[0], chy = to[1] - from[1], cl = Math.sqrt(chx * chx + chy * chy) || 1, px = -chy / cl, py = chx / cl;
    var side = rng.chance(0.5) ? 1 : -1, off = (0.24 + rng.float() * 0.12) * R, mid = [cx + px * off * side, cy + py * off * side];
    var ctrl = [2 * mid[0] - (start[0] + end[0]) / 2, 2 * mid[1] - (start[1] + end[1]) / 2], raw = [], k, t, x, y;
    for (k = 0; k <= 140; k++) { t = k / 140; x = (1 - t) * (1 - t) * start[0] + 2 * (1 - t) * t * ctrl[0] + t * t * end[0]; y = (1 - t) * (1 - t) * start[1] + 2 * (1 - t) * t * ctrl[1] + t * t * end[1]; raw.push([x, y]); }
    raw = G.wobble(raw, noise.noise2, 0.055 * R, 1 / (0.38 * R), false);
    /* keep the run inside the frame; stop where it meets the sea */
    var pts = [], i, seg, passedCentre = false;
    for (i = 1; i < raw.length; i++) {
      seg = clipSegToRect(raw[i - 1], raw[i], W, H); if (!seg) { if (pts.length) break; continue; }
      if (!pts.length) pts.push(seg[0]);
      pts.push(seg[1]);
      if (G.dist(seg[1], [cx, cy]) < 0.5 * R) passedCentre = true;
      if (passedCentre && water(seg[1][0], seg[1][1]) > 6) break;
    }
    if (pts.length < 2) return null;
    var baseW = 0.032 * R + 6, out = pts.map(function (p, idx) { var tt = idx / (pts.length - 1); return [p[0], p[1], baseW * (0.85 + 0.3 * tt)]; });
    return { pts: out, xy: pts, width: baseW };
  }

  /* ── Dijkstra over the Voronoi vertex graph ── adjacency from the edge table; passable(e) and cost(e, fromT, toT) shape
     the walk; targets is a function of the vertex. Returns { dist, prev, prevEdge, target }. */
  function dijkstra(S, sources, passable, cost, isTarget) {
    var adj = S.adjV, dist = {}, prev = {}, prevEdge = {}, heap = U.Heap(function (a, b) { return a.d < b.d; }), cur, i, nbs, e, to, nd, target = null;
    sources.forEach(function (s) { dist[s.t] = s.d || 0; prev[s.t] = s.prev === undefined ? null : s.prev; prevEdge[s.t] = null; heap.push({ t: s.t, d: s.d || 0 }); });
    while (heap.size()) {
      cur = heap.pop(); if (cur.d > dist[cur.t]) continue;
      if (isTarget && isTarget(cur.t)) { target = cur.t; break; }
      nbs = adj[cur.t] || [];
      for (i = 0; i < nbs.length; i++) {
        e = S.edges[nbs[i]]; if (!passable(e)) continue;
        to = e.t1 === cur.t ? e.t2 : e.t1; nd = cur.d + cost(e, cur.t, to);
        if (dist[to] === undefined || nd < dist[to]) { dist[to] = nd; prev[to] = cur.t; prevEdge[to] = e.id; heap.push({ t: to, d: nd }); }
      }
    }
    return { dist: dist, prev: prev, prevEdge: prevEdge, target: target };
  }
  function pathBack(res, t) { var vs = [t], es = []; while (res.prev[t] !== null && res.prev[t] !== undefined) { if (res.prevEdge[t] !== null) es.push(res.prevEdge[t]); t = res.prev[t]; vs.unshift(t); } return { verts: vs, edges: es }; }

  /* ── building lots ── a convex ward polygon → lots (recursive cut across the longest edge) → footprints */
  function subdivide(poly, lotArea, rng, out, depth) {
    var area = Math.abs(G.signedArea(poly)), halves;
    if (area < lotArea * (1.45 + rng.float() * 0.9) || depth > 9 || poly.length < 3) { out.push(poly); return; }
    halves = M.cutAcross(poly, 0.36 + rng.float() * 0.28);
    if (halves[0].length < 3 || halves[1].length < 3) { out.push(poly); return; }
    subdivide(halves[0], lotArea, rng, out, depth + 1); subdivide(halves[1], lotArea, rng, out, depth + 1);
  }
  /* ── the waterfront ── a cell is land or water by its SITE, so a waterside cell can straddle the drawn shore (the field's
     contour, smoothed and wobbled). Nothing may stand or be drawn out in the water: the quay follows the DRAWN shore
     through the waterfront cells, a lot with a corner in the water is dropped, a wall segment is cut where it crosses
     the shore, and the scene paints the water over the ward tints. */
  function inWater(polys, p) { var i; for (i = 0; i < polys.length; i++) if (G.pointInPolygon(p, polys[i])) return true; return false; }
  function wetPoly(polys, pts) { var i; for (i = 0; i < pts.length; i++) if (inWater(polys, pts[i])) return true; return false; }
  function lerpPt(p, q, t) { return [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]; }
  /* the pieces of a segment that lie on land (split at every crossing of the shore) */
  function clipToLand(p, q, polys) {
    if (!polys.length) return [{ p: p, q: q }];
    var ts = [0, 1], out = [], i, j, poly, n, hit, m;
    for (i = 0; i < polys.length; i++) { poly = polys[i]; n = poly.length; for (j = 0; j < n; j++) { hit = M.segIntersect(p, q, poly[j], poly[(j + 1) % n]); if (hit) ts.push(hit[2]); } }
    ts.sort(function (x, y) { return x - y; });
    for (i = 1; i < ts.length; i++) {
      if (ts[i] - ts[i - 1] < 1e-6) continue;
      m = lerpPt(p, q, (ts[i - 1] + ts[i]) / 2);
      if (!inWater(polys, m)) out.push({ p: ts[i - 1] === 0 ? p : lerpPt(p, q, ts[i - 1]), q: ts[i] === 1 ? q : lerpPt(p, q, ts[i]) });
    }
    return out;
  }
  /* the drawn shore where it runs through the waterfront cells, as polylines (frame runs left out) */
  function shoreQuays(polys, front, W, H) {
    var segs = [], boxes = front.map(function (cl) { return G.bbox(cl.poly); });
    function inFront(p) { var i, b; for (i = 0; i < front.length; i++) { b = boxes[i]; if (p[0] >= b[0] && p[0] <= b[2] && p[1] >= b[1] && p[1] <= b[3] && G.pointInPolygon(p, front[i].poly)) return true; } return false; }
    function onFrame(p) { return p[0] <= 0.05 || p[1] <= 0.05 || p[0] >= W - 0.05 || p[1] >= H - 0.05; }
    polys.forEach(function (poly) {
      var n = poly.length, i, a, b, steps, k, pts, j;
      for (i = 0; i < n; i++) {
        a = poly[i]; b = poly[(i + 1) % n];
        if (onFrame(a) && onFrame(b)) continue;
        steps = Math.max(1, Math.ceil(G.dist(a, b) / 4)); pts = [a];
        for (k = 1; k < steps; k++) pts.push(lerpPt(a, b, k / steps));
        pts.push(b);
        for (j = 1; j < pts.length; j++) if (inFront(lerpPt(pts[j - 1], pts[j], 0.5))) segs.push({ p: pts[j - 1], q: pts[j] });
      }
    });
    return M.chainSegments(segs).map(function (ch) { var pts = ch.closed ? ch.pts.concat([ch.pts[0]]) : ch.pts; return roundPts(G.simplify(pts, 0.05)); });
  }

  /* ── the outfall ── where the town's drains come out: OUTSIDE the wall (the urban set), on dry ground near the town,
     at the water when there is any — the river's bank where it leaves the town, else the shore just beyond the wall —
     and otherwise a ditch at the field edge, away from the gates. A way out of a town for someone the watch is after.
     Returns [x, y], or null when no such ground exists. */
  function outfallSite(urban, edges, polys, river, plazaC, gates, W, H) {
    var bounds = edges.filter(function (ed) { return ed.cls === "wall" || ed.cls === "quay"; }), cands = [], i;
    function boundaryDist(p) { var d = Infinity, k; for (k = 0; k < bounds.length; k++) d = Math.min(d, G.pointSegDist(p, bounds[k].p, bounds[k].q)); return d; }
    function inUrban(p) { var k; for (k = 0; k < urban.length; k++) if (G.pointInPolygon(p, urban[k].poly)) return true; return false; }
    function ok(p) { var bd = boundaryDist(p); return p[0] > 14 && p[1] > 14 && p[0] < W - 14 && p[1] < H - 14 && !inUrban(p) && bd >= 16 && bd <= 140 && !inWater(polys, p); }
    function gateDist(p) { var d = Infinity, k; for (k = 0; k < gates.length; k++) d = Math.min(d, G.dist(p, [gates[k].x, gates[k].y])); return d; }
    function consider(p, s) { if (ok(p)) cands.push({ p: p, s: s }); }
    if (river) {
      var xy = river.xy, lastIn = -1, a, b, dx, dy, l, nx, ny, off = river.width / 2 + 6;
      for (i = 0; i < xy.length; i++) if (inUrban(xy[i])) lastIn = i;
      for (i = lastIn + 1; i < xy.length && !cands.length; i++) {
        a = xy[Math.max(0, i - 1)]; b = xy[Math.min(xy.length - 1, i + 1)]; dx = b[0] - a[0]; dy = b[1] - a[1]; l = Math.sqrt(dx * dx + dy * dy) || 1; nx = -dy / l; ny = dx / l;
        consider([xy[i][0] + nx * off, xy[i][1] + ny * off], G.dist(xy[i], plazaC)); consider([xy[i][0] - nx * off, xy[i][1] - ny * off], G.dist(xy[i], plazaC));
      }
    }
    if (!cands.length && polys.length) polys.forEach(function (poly) {
      var n = poly.length, j, p, q, steps, k, m, dx, dy, l, nx, ny, c;
      for (j = 0; j < n; j++) {
        p = poly[j]; q = poly[(j + 1) % n]; if (nearFrame(p, W, H) && nearFrame(q, W, H)) continue;
        dx = q[0] - p[0]; dy = q[1] - p[1]; l = Math.sqrt(dx * dx + dy * dy) || 1; nx = -dy / l; ny = dx / l; steps = Math.max(1, Math.ceil(l / 6));
        for (k = 0; k < steps; k++) { m = lerpPt(p, q, (k + 0.5) / steps); c = [m[0] + nx * 4, m[1] + ny * 4]; if (inWater(polys, c)) c = [m[0] - nx * 4, m[1] - ny * 4]; consider(c, G.dist(c, plazaC)); }
      }
    });
    if (!cands.length) edges.forEach(function (ed) { if (ed.cls !== "field") return; var m = [(ed.p[0] + ed.q[0]) / 2, (ed.p[1] + ed.q[1]) / 2]; consider(m, G.dist(m, plazaC) + (gateDist(m) < 70 ? 150 : 0)); });
    if (!cands.length) return null;
    cands.sort(function (u, v) { return u.s - v.s; });
    return cands[0].p;
  }
  function nearFrame(p, W, H) { return p[0] <= 0.05 || p[1] <= 0.05 || p[0] >= W - 0.05 || p[1] >= H - 0.05; }

  /* the footprints of a ward: ONE house to a lot — the biggest rectangle that fits the lot square to its street front
     (`frontOf`: the lot edge nearest and parallel to a street, lane or quay of the ward; a suburb's the road out; a lot
     with no frontage builds square to its longest side), the lot first inset `gap` for the space between neighbours.
     Simple shapes: a mason's rectangle, never the lot's acute corners — the slivers between become yards. */
  function footprints(ward, fronts, opts, rng) {
    var lots = [], out = [], i, lot, f, fp, area, ext;
    subdivide(ward, opts.lotArea, rng, lots, 0);
    for (i = 0; i < lots.length; i++) {
      lot = lots[i]; f = frontOf(lot, fronts) || longestEdge(lot);
      fp = rectIn(M.insetConvex(lot, opts.gap), f);
      if (!fp) continue;
      fp = skew(fp, rng);
      area = Math.abs(G.signedArea(fp)); ext = M.extents(fp);
      if (area < opts.minArea || ext.across < opts.minAcross) continue;
      if (rng.chance(opts.yard)) continue;
      out.push(fp);
    }
    return out;
  }
  /* a mason's corners: every corner pushed a hair off square (each by up to 0.8 % of its shorter side, so no angle is
     more than about 2.5° from a right angle), since no medieval mason hit 90° and a draughtsman's rectangle reads false */
  function skew(fp, rng) {
    var out = [], n = fp.length, i, p, a, b, s;
    for (i = 0; i < n; i++) { p = fp[i]; a = fp[(i + n - 1) % n]; b = fp[(i + 1) % n]; s = Math.min(G.dist(p, a), G.dist(p, b)) * 0.008; out.push([p[0] + (rng.float() * 2 - 1) * s, p[1] + (rng.float() * 2 - 1) * s]); }
    return out;
  }
  /* the lot edge that fronts a street: parallel to a front segment and against it (within its margin and a verge); the longest such */
  function frontOf(lot, fronts) {
    var n = lot.length, i, j, a, b, len, ux, uy, mx, my, d, f, best = null, bl = 0, fl, fx, fy;
    for (i = 0; i < n; i++) {
      a = lot[i]; b = lot[(i + 1) % n]; len = G.dist(a, b); if (len < 2) continue; ux = (b[0] - a[0]) / len; uy = (b[1] - a[1]) / len; mx = (a[0] + b[0]) / 2; my = (a[1] + b[1]) / 2;
      for (j = 0; j < fronts.length; j++) {
        f = fronts[j]; fl = G.dist(f.p, f.q); if (fl < 1e-6) continue; fx = (f.q[0] - f.p[0]) / fl; fy = (f.q[1] - f.p[1]) / fl;
        if (Math.abs(ux * fx + uy * fy) < 0.8) continue;
        d = G.pointSegDist([mx, my], f.p, f.q);
        if (d <= f.margin + 2.5 && len > bl) { bl = len; best = { a: a, b: b }; }
      }
    }
    return best;
  }
  function longestEdge(lot) { var n = lot.length, i, best = 0, bl = -1, l; for (i = 0; i < n; i++) { l = G.dist(lot[i], lot[(i + 1) % n]); if (l > bl) { bl = l; best = i; } } return { a: lot[best], b: lot[(best + 1) % n] }; }
  /* the biggest rectangle inside a convex polygon with a side along the front f, leaning a little toward the street: in
     the front's frame (x along it, y into the lot) the polygon's run at each of KS heights; a rectangle between two
     heights spans what both runs share (the polygon is convex, so the runs between are no narrower); the best by area,
     discounted up to a third for standing back from the front */
  function rectIn(poly, f) {
    if (!poly || poly.length < 3) return null;
    var len = G.dist(f.a, f.b) || 1, ux = (f.b[0] - f.a[0]) / len, uy = (f.b[1] - f.a[1]) / len, nx = -uy, ny = ux, i, j, k, v, lo = Infinity, hi = -Infinity, my = 0, KS = 14, runs = [], best = null, bs = 0, x0, x1, y0, y1, s;
    var pts = poly.map(function (q) { return [(q[0] - f.a[0]) * ux + (q[1] - f.a[1]) * uy, (q[0] - f.a[0]) * nx + (q[1] - f.a[1]) * ny]; });
    for (i = 0; i < pts.length; i++) my += pts[i][1];
    if (my < 0) { nx = -nx; ny = -ny; for (i = 0; i < pts.length; i++) pts[i][1] = -pts[i][1]; }   /* y runs into the lot */
    for (i = 0; i < pts.length; i++) { if (pts[i][1] < lo) lo = pts[i][1]; if (pts[i][1] > hi) hi = pts[i][1]; }
    if (hi - lo < 1) return null;
    for (k = 0; k <= KS; k++) { v = lo + (hi - lo) * k / KS; runs.push(runAt(pts, k === 0 ? v + 1e-4 : k === KS ? v - 1e-4 : v)); }
    for (i = 0; i < KS; i++) for (j = i + 1; j <= KS; j++) {
      if (!runs[i] || !runs[j]) continue;
      x0 = Math.max(runs[i][0], runs[j][0]); x1 = Math.min(runs[i][1], runs[j][1]); if (x1 <= x0) continue;
      y0 = lo + (hi - lo) * i / KS; y1 = lo + (hi - lo) * j / KS; s = (x1 - x0) * (y1 - y0) * (1 - 0.35 * (y0 - lo) / (hi - lo));
      if (s > bs) { bs = s; best = [x0, y0, x1, y1]; }
    }
    if (!best) return null;
    function at(x, y) { return [f.a[0] + ux * x + nx * y, f.a[1] + uy * x + ny * y]; }
    return [at(best[0], best[1]), at(best[2], best[1]), at(best[2], best[3]), at(best[0], best[3])];
  }
  /* the run of a convex polygon (in the front's frame) across the line y = v: [xmin, xmax], or null when it misses */
  function runAt(pts, v) {
    var n = pts.length, i, a, b, t, x, lo = Infinity, hi = -Infinity;
    for (i = 0; i < n; i++) { a = pts[i]; b = pts[(i + 1) % n]; if ((a[1] <= v) === (b[1] <= v)) continue; t = (v - a[1]) / (b[1] - a[1]); x = a[0] + (b[0] - a[0]) * t; if (x < lo) lo = x; if (x > hi) hi = x; }
    return hi > lo ? [lo, hi] : null;
  }
  function rect(c, angle, along, across) {
    var ca = Math.cos(angle), sa = Math.sin(angle), hx = along / 2, hy = across / 2;
    return [[-hx, -hy], [hx, -hy], [hx, hy], [-hx, hy]].map(function (p) { return [c[0] + p[0] * ca - p[1] * sa, c[1] + p[0] * sa + p[1] * ca]; });
  }
  function crossShape(c, angle, L, w, tw, td, at) {
    /* nave L × w along the axis, transept tw wide (across) and td deep, centred at fraction `at` of the nave */
    var ca = Math.cos(angle), sa = Math.sin(angle), h = w / 2, x0 = -L / 2, x1 = L / 2, tx = x0 + L * at, local = [
      [x0, -h], [tx - td / 2, -h], [tx - td / 2, -tw / 2], [tx + td / 2, -tw / 2], [tx + td / 2, -h], [x1, -h],
      [x1, h], [tx + td / 2, h], [tx + td / 2, tw / 2], [tx - td / 2, tw / 2], [tx - td / 2, h], [x0, h]];
    return local.map(function (p) { return [c[0] + p[0] * ca - p[1] * sa, c[1] + p[0] * sa + p[1] * ca]; });
  }
  function allInside(pts, poly) { var i; for (i = 0; i < pts.length; i++) if (!G.pointInPolygon(pts[i], poly)) return false; return true; }

  /* ── generate ── */
  function generate(input) {
    var P = resolveParams(input), t0 = NS.terrain.now(), stats = {}, seed = P.seed, size = SIZES[P.size], W = P.width, H = P.height, warnings = [];
    var R = Math.min(W, H) * size.radius, rng = NS.Rng(seed + "/town"), noise = NS.Noise(seed + "/townnoise");
    var namer = NS.names.Namer(NS.Rng(seed + "/townnames"), P.culture);
    var walled = P.walls === "auto" ? size.walls : P.walls;
    var castle = P.castle === "auto" ? (size.castle === "maybe" ? rng.chance(0.5) : size.castle) : P.castle;
    var S = substrate(P, R, NS.Rng(seed + "/substrate")), cells = S.cells, edges = S.edges, cx = S.cx, cy = S.cy, i, j, k, c, e;
    stats.substrate = U.round(NS.terrain.now() - t0, 1); t0 = NS.terrain.now();

    /* vertex adjacency for the walks */
    S.adjV = {}; edges.forEach(function (ed) { (S.adjV[ed.t1] = S.adjV[ed.t1] || []).push(ed.id); (S.adjV[ed.t2] = S.adjV[ed.t2] || []).push(ed.id); });

    /* water */
    var water = waterField(P, R, cx, cy, noise), WG = waterGeometry(P, water, seed), river = P.site.river ? riverLine(P, R, S, NS.Rng(seed + "/river"), noise, water) : null;
    cells.forEach(function (cl) {
      if (!cl) return;
      if (water(cl.site[0], cl.site[1]) > 0) cl.kind = "water";
      else if (river && M.distToPolyline(cl.site, river.xy) < river.width / 2 + 0.62 * S.spacing(cl.d)) cl.kind = "bank";
    });

    /* the urban set: land and bank cells inside a wobbly radius, cleaned into one solid blob */
    cells.forEach(function (cl) {
      if (!cl || cl.kind === "water") return;
      var th = Math.atan2(cl.site[1] - cy, cl.site[0] - cx), ru = R * (0.9 + 0.17 * noise.noise2(Math.cos(th) * 1.3 + 11.2, Math.sin(th) * 1.3 + 5.7));
      cl.urban = cl.d < ru;
    });
    function urbanCount(cl) { var n = 0; cl.nb.forEach(function (k2) { if (cells[k2] && cells[k2].urban) n++; }); return n; }
    for (k = 0; k < 2; k++) {
      cells.forEach(function (cl) { if (!cl || cl.kind === "water") return; var n = urbanCount(cl); if (!cl.urban && n >= 4 && cl.d < R * 1.25) cl.urban = true; if (cl.urban && n <= 1) cl.urban = false; });
    }
    /* keep the component holding the centre */
    var centreCell = null, bd = Infinity;
    cells.forEach(function (cl) { if (cl && cl.urban && cl.kind === "land" && cl.d < bd) { bd = cl.d; centreCell = cl; } });
    NS.assert(centreCell, "no dry land for the market: the site's water covers the town centre", { site: P.site });
    var seen = {}, queue = [centreCell.i]; seen[centreCell.i] = true;
    while (queue.length) { c = cells[queue.shift()]; c.nb.forEach(function (k2) { if (cells[k2] && cells[k2].urban && !seen[k2]) { seen[k2] = true; queue.push(k2); } }); }
    cells.forEach(function (cl) { if (cl && cl.urban && !seen[cl.i]) cl.urban = false; });
    /* holes: a non-urban cell that cannot reach the frame through non-urban cells is inside the town */
    var outside = {}, oq = [];
    cells.forEach(function (cl) { if (cl && !cl.urban && cl.clipped) { outside[cl.i] = true; oq.push(cl.i); } });
    while (oq.length) { c = cells[oq.shift()]; c.nb.forEach(function (k2) { if (cells[k2] && !cells[k2].urban && !outside[k2]) { outside[k2] = true; oq.push(k2); } }); }
    cells.forEach(function (cl) { if (cl && !cl.urban && !outside[cl.i] && cl.kind !== "water") cl.urban = true; });
    var urban = cells.filter(function (cl) { return cl && cl.urban; });
    NS.assert(urban.length >= 3, "too little land for a settlement here", { urban: urban.length });

    /* roles: plaza, temple, keep */
    centreCell.kind = "plaza";
    var plazaC = G.centroid(centreCell.poly);
    var temple = null, keep = null;
    if (size.temple) {
      var cands = centreCell.nb.map(function (k2) { return cells[k2]; }).filter(function (cl) { return cl && cl.urban && cl.kind === "land" && !cl.clipped; });
      if (cands.length) { cands.sort(function (a, b) { return b.area - a.area; }); temple = cands[rng.int(Math.min(2, cands.length))]; temple.kind = "temple"; }
      /* a town's or a city's temple takes a CLOSE: its cell and the biggest neighbour but the plaza, with no street between —
         one cell of a dense centre is a chapel's plot, not a minster's */
      if (temple && size.districts > 0) {
        var tn = temple.nb.map(function (k2) { return cells[k2]; }).filter(function (c2) { return c2 && c2.urban && c2.kind === "land" && !c2.clipped && c2 !== centreCell; }).sort(function (a, b) { return b.area - a.area; })[0];
        if (tn) { tn.kind = "temple"; tn.close = temple; temple.close = tn; }
      }
    }
    if (castle) {
      var edgeCells = urban.filter(function (cl) { return cl.kind === "land" && !cl.clipped && cl !== temple && cl.nb.some(function (k2) { return cells[k2] && !cells[k2].urban && cells[k2].kind === "land"; }); });
      if (edgeCells.length) {
        edgeCells.forEach(function (cl) { cl.score = cl.d / R + (river ? Math.min(1, M.distToPolyline(cl.site, river.xy) / R) : 0) + rng.float() * 0.6 + (cl.area / (S.s0 * S.s0)) * 0.3; });
        edgeCells.sort(function (a, b) { return b.score - a.score; });
        keep = edgeCells[0]; keep.kind = "keep";
      } else castle = false;
    }
    /* parks: a green kept open inside the town, with trees — one in a town, two in a city — away from the centre, never
       against the temple, never two together; the biggest cells preferred, with a roll. A park is ONE, TWO or THREE
       cells (a third of them one, two fifths two, the rest three), grown into the biggest free neighbours, with no
       street between its cells */
    var parks = [];
    if (size.parks) {
      var pc = urban.filter(function (cl) { return cl.kind === "land" && !cl.clipped && cl !== centreCell && cl.d / R > 0.3 && cl.d / R < 0.95 && !cl.nb.some(function (k2) { return cells[k2] && cells[k2].kind === "temple"; }); });
      pc.forEach(function (cl) { cl.pscore = cl.area / (S.s0 * S.s0) + rng.float() * 0.6; });
      pc.sort(function (a, b) { return b.pscore - a.pscore; });
      pc.forEach(function (cl) {
        if (parks.length >= size.parks || cl.kind !== "land" || cl.nb.some(function (k2) { return cells[k2] && cells[k2].kind === "park"; })) return;
        var park = { cells: [cl] }, want = rng.chance(0.34) ? 1 : rng.chance(0.6) ? 2 : 3, grow;
        cl.kind = "park"; cl.park = park;
        while (park.cells.length < want) {
          grow = [];
          park.cells.forEach(function (m) { m.nb.forEach(function (k2) { var c2 = cells[k2]; if (c2 && c2.urban && c2.kind === "land" && !c2.clipped && c2 !== centreCell && grow.indexOf(c2) < 0 && !c2.nb.some(function (k3) { return cells[k3] && (cells[k3].kind === "temple" || (cells[k3].kind === "park" && cells[k3].park !== park)); })) grow.push(c2); }); });
          if (!grow.length) break;
          grow.sort(function (a, b) { return b.area - a.area; }); grow[0].kind = "park"; grow[0].park = park; park.cells.push(grow[0]);
        }
        parks.push(park);
      });
    }
    urban.forEach(function (cl) { if (cl.kind === "land") cl.kind = "built"; });

    /* edge classes */
    function side(ed) { return [cells[ed.a], cells[ed.b]]; }
    edges.forEach(function (ed) {
      var ab = side(ed), A = ab[0], B = ab[1];
      ed.cls = "none";
      if (river && A.kind !== "water" && B.kind !== "water") { var x = M.crossPolyline(ed.p, ed.q, river.xy); if (x) ed.crossing = [x.x, x.y]; }
      if ((A.kind === "temple" && B.kind === "temple") || (A.kind === "park" && B.kind === "park" && A.park === B.park)) ed.cls = "none";   /* the close, a park: no street between their cells */
      else if (A.urban && B.urban) ed.cls = (A.kind === "bank" && B.kind === "bank") ? (ed.crossing ? "ford" : "none") : (A.kind === "bank" || B.kind === "bank") ? "lane" : "street";
      else if (A.urban !== B.urban) { var outside = A.urban ? B : A; ed.cls = outside.kind === "water" ? "quay" : "wall"; }
      else if (A.kind === "water" || B.kind === "water") ed.cls = A.kind === "water" && B.kind === "water" ? "none" : "shore";
      else ed.cls = "field";
    });
    /* the quay: the drawn shore through the waterfront — the urban cells and the water cells they face */
    var front = urban.slice(), frontSeen = {};
    urban.forEach(function (cl) { frontSeen[cl.i] = true; });
    edges.forEach(function (ed) { if (ed.cls !== "quay") return; var ab = side(ed), o = ab[0].urban ? ab[1] : ab[0]; if (!frontSeen[o.i]) { frontSeen[o.i] = true; front.push(o); } });
    var quays = WG.polys.length ? shoreQuays(WG.polys, front, W, H) : [];

    /* gates: a boundary vertex per road bearing; without a region the roads come from the seed */
    var roadsIn = P.site.roads.slice();
    if (!roadsIn.length) { var nR = P.size === "hamlet" ? 2 : P.size === "city" ? 4 : 3, startB = rng.int(8), sh = rng.shuffle([0, 1, 2, 3, 4, 5, 6, 7]); for (k = 0; k < nR; k++) roadsIn.push({ bearing: BEARINGS[(startB + sh[k]) % 8], to: null, kind: "road" }); }
    var wallVerts = {}, quayVerts = {}, streetAt = {};
    edges.forEach(function (ed) { if (ed.cls === "street" || ed.cls === "lane" || ed.cls === "ford") { streetAt[ed.t1] = true; streetAt[ed.t2] = true; } });
    edges.forEach(function (ed) { if (ed.cls === "wall" && streetAt[ed.t1]) wallVerts[ed.t1] = true; if (ed.cls === "wall" && streetAt[ed.t2]) wallVerts[ed.t2] = true; if (ed.cls === "quay") { quayVerts[ed.t1] = true; quayVerts[ed.t2] = true; } });
    var gates = [], gateByVert = {};
    roadsIn.forEach(function (rd) {
      var dir = dirOf(rd.bearing), best = null, bs = -2, t, v, vx, vy, l, cs;
      for (t in wallVerts) if (Object.prototype.hasOwnProperty.call(wallVerts, t)) {
        v = S.vpos(+t); vx = v[0] - plazaC[0]; vy = v[1] - plazaC[1]; l = Math.sqrt(vx * vx + vy * vy) || 1; cs = (vx * dir[0] + vy * dir[1]) / l;
        if (cs > bs) { bs = cs; best = +t; }
      }
      if (best === null || bs < 0.5) { warnings.push("no landward gate toward the " + rd.bearing + (rd.to ? " (road to " + rd.to + ")" : "") + " — that road is not drawn"); return; }
      if (gateByVert[best]) { gateByVert[best].roads.push(rd); return; }
      var g = { id: "g" + gates.length, vert: best, x: S.vpos(best)[0], y: S.vpos(best)[1], bearing: rd.bearing, roads: [rd] };
      gates.push(g); gateByVert[best] = g;
    });

    /* main streets: from the market to every gate (and the harbour), along the cheapest street edges */
    var plazaVerts = centreCell.verts.map(function (t) { return { t: t, d: 0 }; });
    function jit(ed) { return (NS.hash32(ed.a + "/" + ed.b, 9) % 1000) / 1000; }
    function walkable(ed) { return ed.cls === "street" || ed.cls === "lane" || ed.cls === "ford" || ed.cls === "main"; }
    function walkCost(ed) { return ed.len * (ed.cls === "lane" ? 1.7 : ed.cls === "ford" ? 2.4 : ed.cls === "main" ? 0.8 : 1) * (1 + 0.35 * jit(ed)) * (ed.crossing ? 2.6 : 1); }
    var walk = dijkstra(S, plazaVerts, walkable, walkCost, null);
    gates.forEach(function (g) {
      if (walk.dist[g.vert] === undefined) { warnings.push("the " + g.bearing + " gate cannot be reached from the market by street"); g.unreached = true; return; }
      pathBack(walk, g.vert).edges.forEach(function (eid) { edges[eid].cls = "main"; });
    });
    gates = gates.filter(function (g) { return !g.unreached; });
    /* a built cell none of whose corners the walk reached is cut off (by the river, usually): a main street is forced
       to the largest such cell, which lays a bridge; a few rounds cover several islands */
    function dry(ed) { return ed.cls === "street" || ed.cls === "lane" || ed.cls === "main"; }
    for (k = 0; k < 4; k++) {
      var dryWalk = dijkstra(S, plazaVerts, dry, walkCost, null);
      var cut = urban.filter(function (cl) { return cl.kind === "built" && !cl.verts.some(function (t) { return dryWalk.dist[t] !== undefined; }); });
      if (!cut.length) break;
      cut.sort(function (a, b) { return b.area - a.area; });
      var reach = dijkstra(S, plazaVerts, walkable, walkCost, function (t) { return cut[0].verts.indexOf(t) >= 0; });
      if (reach.target === null) { warnings.push(cut.length + " block(s) across the water have no street to the market"); break; }
      pathBack(reach, reach.target).edges.forEach(function (eid) { edges[eid].cls = "main"; });
    }
    var harbour = null;
    if (P.site.coast) {
      var bq = null, bqd = Infinity, t;
      for (t in quayVerts) if (Object.prototype.hasOwnProperty.call(quayVerts, t) && walk.dist[t] !== undefined && walk.dist[t] < bqd) { bqd = walk.dist[t]; bq = +t; }
      if (bq !== null) {
        pathBack(walk, bq).edges.forEach(function (eid) { edges[eid].cls = "main"; });
        var qv = S.vpos(bq); harbour = { vert: bq, x: qv[0], y: qv[1], dq: Infinity };
        quays.forEach(function (ch) { ch.forEach(function (p) { var dd = G.dist(p, qv); if (dd < harbour.dq) { harbour.dq = dd; harbour.x = p[0]; harbour.y = p[1]; } }); });
      }
    }
    /* a non-main street crossing the river is dropped: bridges carry main streets only; unused fords vanish */
    edges.forEach(function (ed) { if (ed.cls === "ford") ed.cls = "none"; else if (ed.crossing && ed.cls !== "main") ed.cls = ed.cls === "street" || ed.cls === "lane" ? "none" : ed.cls; });
    /* walls crossing the river carry on (the wall breaks at the water in the scene) */

    /* roads out: from each gate along field edges, heading for the frame */
    var roads = [];
    gates.forEach(function (g) {
      var dir = dirOf(g.bearing), sources = [], outsideCells = [];
      edges.forEach(function (ed) { if ((ed.t1 === g.vert || ed.t2 === g.vert) && ed.cls === "wall") { var ab = side(ed); outsideCells.push(ab[0].urban ? ab[1] : ab[0]); } });
      outsideCells.forEach(function (oc) { oc.verts.forEach(function (t) { if (t === g.vert) return; var v = S.vpos(t), dd = G.dist(v, [g.x, g.y]); sources.push({ t: t, d: dd * (1.3 - ((v[0] - g.x) * dir[0] + (v[1] - g.y) * dir[1]) / (dd || 1)), prev: g.vert }); }); });
      if (!sources.length) { warnings.push("the " + g.bearing + " gate opens on nothing (no field cell outside it)"); return; }
      var res = dijkstra(S, sources, function (ed) { var ab = side(ed); return !ab[0].urban && !ab[1].urban && !(ab[0].kind === "water" && ab[1].kind === "water"); },
        function (ed, from, to) { var a = S.vpos(from), b = S.vpos(to), dd = ed.len || 1, cs = ((b[0] - a[0]) * dir[0] + (b[1] - a[1]) * dir[1]) / dd, ab = side(ed), shore = ab[0].kind === "water" || ab[1].kind === "water"; return dd * (1.3 - cs) * (ed.crossing ? 2.5 : 1) * (shore ? 1.6 : 1); },
        function (t) { var v = S.vpos(t); return v[0] <= 0.5 || v[1] <= 0.5 || v[0] >= W - 0.5 || v[1] >= H - 0.5; });
      res.prev[g.vert] = null;
      if (res.target === null) { warnings.push("no road could leave the " + g.bearing + " gate"); return; }
      var vs = pathBack(res, res.target).verts, pts = vs.map(function (t) { return S.vpos(t); }), last = pts[pts.length - 1], cl2;
      /* the last leg is cut at the frame */
      if (pts.length >= 2) { cl2 = clipSegToRect(pts[pts.length - 2], last, W, H); if (cl2) pts[pts.length - 1] = cl2[1]; }
      var sm = G.smooth(pts, 1, false); sm[0] = pts[0]; sm[sm.length - 1] = pts[pts.length - 1];
      var bridges = [];
      pathBack(res, res.target).edges.forEach(function (eid) { if (edges[eid].crossing) bridges.push(edges[eid].crossing); });
      roads.push({ id: "rd" + roads.length, gate: g.id, bearing: g.bearing, to: g.roads.map(function (r) { return r.to; }).filter(function (x) { return x; }), kind: g.roads[0].kind || "road", pts: roundPts(sm), bridges: roundPts(bridges) });
      g.roadId = "rd" + (roads.length - 1);
    });
    stats.layout = U.round(NS.terrain.now() - t0, 1); t0 = NS.terrain.now();

    /* districts: angular sectors of the urban set */
    var nD = size.districts ? U.clamp(Math.round(urban.length / 22), 2, size.districts) : 0, districts = [], sectorOff = rng.float() * Math.PI * 2;
    if (nD) {
      for (k = 0; k < nD; k++) districts.push({ id: "d" + k, cells: [], sx: 0, sy: 0, sa: 0, shore: 0, bank: 0 });
      urban.forEach(function (cl) {
        var th = Math.atan2(cl.site[1] - plazaC[1], cl.site[0] - plazaC[0]) - sectorOff, s = Math.floor(((th / (Math.PI * 2)) % 1 + 1) % 1 * nD) % nD, d = districts[s];
        cl.district = s; d.cells.push(cl); d.sx += cl.site[0] * cl.area; d.sy += cl.site[1] * cl.area; d.sa += cl.area;
        if (cl.nb.some(function (k2) { return cells[k2] && cells[k2].kind === "water"; })) d.shore++;
        if (cl.kind === "bank" || cl.nb.some(function (k2) { return cells[k2] && cells[k2].kind === "bank"; })) d.bank++;
      });
      var tradesLeft = rng.shuffle(NS.names.TRADES), waterTrades = ["Fishers'", "Shipwrights'", "Ropers'"], bankTrades = ["Tanners'", "Dyers'", "Millers'"];
      districts.forEach(function (d) {
        var trade = null, pool;
        if (d.shore >= 2) pool = waterTrades; else if (d.bank >= 2) pool = bankTrades;
        if (pool) trade = pool.filter(function (tname) { return tradesLeft.indexOf(tname) >= 0; })[0] || null;
        if (!trade) trade = tradesLeft.filter(function (tname) { return waterTrades.indexOf(tname) < 0 && bankTrades.indexOf(tname) < 0; })[0];
        tradesLeft = tradesLeft.filter(function (tname) { return tname !== trade; });
        d.x = U.round(d.sa ? d.sx / d.sa : plazaC[0], 1); d.y = U.round(d.sa ? d.sy / d.sa : plazaC[1], 1);
        d.name = namer.town("district", { trade: trade, bearing: G.bearing(plazaC, [d.x, d.y]).name });
        d.houses = 0;
      });
    }

    /* wards and buildings */
    var title = P.title || namer.settlement(P.size === "hamlet" ? "village" : P.size === "city" ? "city" : P.size === "town" ? "town" : "village", { coastal: !!P.site.coast, river: !!P.site.river, lake: !!P.site.lake, hill: !!P.site.hill, forest: !!P.site.forest, marsh: !!P.site.marsh, mouth: !!P.site.mouth });
    var wards = [], buildings = [], landmarks = [], bRng = NS.Rng(seed + "/buildings");
    function marginOf(ed) { return !ed ? 3 : ed.cls === "main" ? WIDTH.main / 2 + 1.3 : ed.cls === "street" ? WIDTH.street / 2 + 1.1 : ed.cls === "lane" ? WIDTH.lane / 2 + 1 : ed.cls === "wall" ? 4.5 : ed.cls === "quay" ? 5 : 2.2; }
    function edgeOf(cl, kk) { var n = cl.raw.length; return S.byVerts[Math.min(cl.verts[kk], cl.verts[(kk + 1) % n]) + "_" + Math.max(cl.verts[kk], cl.verts[(kk + 1) % n])]; }
    function edgeMargins(cl, extra) {
      /* per polygon edge: half the width of what runs along it, plus a verge */
      var n = cl.raw.length, d = [], kk;
      for (kk = 0; kk < n; kk++) d.push(marginOf(edgeOf(cl, kk)) + (extra || 0));
      return d;
    }
    /* the ward's street sides — what its houses front: the raw edges a street, lane or quay runs along, each with the margin the ward is inset by there */
    function wardFronts(cl) {
      var n = cl.raw.length, out = [], kk, ed;
      for (kk = 0; kk < n; kk++) { ed = edgeOf(cl, kk); if (ed && (ed.cls === "main" || ed.cls === "street" || ed.cls === "lane" || ed.cls === "quay")) out.push({ p: cl.raw[kk], q: cl.raw[(kk + 1) % n], margin: marginOf(ed) }); }
      return out;
    }
    urban.forEach(function (cl) {
      var w = { id: "w" + wards.length, kind: cl.kind, district: cl.district === undefined ? null : cl.district, poly: roundPts(cl.poly), x: U.round(cl.site[0], 1), y: U.round(cl.site[1], 1) };
      cl.ward = wards.length; wards.push(w);
      if (cl.kind !== "built" || cl.clipped) return;
      var inner = M.insetConvex(cl.raw, edgeMargins(cl, 0)); if (!inner) return;
      var t = U.clamp(cl.d / R, 0, 1), lotArea = U.lerp(18, 46, t) / (0.55 + P.density * 0.9), yard = (size.yard * (0.5 + t) + 0.04) * 0.6;   /* a lot is a house: 28–72 m² at the default density, smaller toward the centre */
      footprints(inner, wardFronts(cl), { lotArea: lotArea, gap: 0.45, minArea: 12, minAcross: 2.8, yard: yard }, bRng).forEach(function (fp) { if (WG.polys.length && wetPoly(WG.polys, fp)) return; buildings.push({ w: cl.ward, pts: roundPts(fp) }); if (cl.district !== undefined && districts[cl.district]) districts[cl.district].houses++; });
    });

    /* landmarks: market, temple, keep, gates, harbour */
    var marketName = namer.town(P.size === "hamlet" || P.size === "village" ? "green" : "market", { name: title });
    landmarks.push({ id: "L0", kind: P.size === "hamlet" || P.size === "village" ? "green" : "market", name: marketName, x: U.round(plazaC[0], 1), y: U.round(plazaC[1], 1), ward: centreCell.ward, r: U.round(Math.sqrt(centreCell.area / Math.PI) * 0.5, 1) });
    /* a park is a landmark with a name and a footprint — the hull of its cells, each inset from the streets but not from
       one another (a park's cells abut); the pieces are drawn as one green with the fields, the trees scattered in them */
    function parkMargins(cl) { var n = cl.raw.length, d = [], kk, ed, A, B; for (kk = 0; kk < n; kk++) { ed = edgeOf(cl, kk); A = ed ? cells[ed.a] : null; B = ed ? cells[ed.b] : null; d.push(A && B && A.park && A.park === B.park ? 0 : marginOf(ed) + 0.5); } return d; }
    parks.forEach(function (pk) {
      pk.pieces = pk.cells.map(function (cl) { return M.insetConvex(cl.raw, parkMargins(cl)); }).filter(function (p) { return p && p.length >= 3; });
      if (!pk.pieces.length) return;
      var hullPts = []; pk.pieces.forEach(function (p) { hullPts = hullPts.concat(p); });
      var hull = G.convexHull(hullPts), pc2 = G.centroid(hull);
      landmarks.push({ id: "L" + landmarks.length, kind: "park", name: namer.town("park", { name: title }), x: U.round(pc2[0], 1), y: U.round(pc2[1], 1), ward: pk.cells[0].ward, poly: roundPts(hull), cells: pk.cells.length });
    });
    if (temple) {
      var tin = temple.close ? M.insetConvex(G.convexHull(temple.raw.concat(temple.close.raw)), WIDTH.main / 2 + 2) : M.insetConvex(temple.raw, edgeMargins(temple, 1)), ext, shape = null, scale = 1, tries;
      if (tin) {
        ext = M.extents(tin);
        /* a mason's proportions whatever the cell: the nave about three times as long as wide and never under 7 m wide, at most
           55 m long, the transept at most 2.2 naves across; tried at 0.82 of the cell's length and scaled down until it fits;
           a cell too tight for a transept holds a plain hall */
        var L0 = Math.min(ext.along * 0.82, 44), L, nw, tw, td;
        for (tries = 0; tries < 9 && !shape; tries++) {
          L = L0 * scale; nw = U.clamp(L * 0.32, 5.6, Math.min(ext.across * 0.5, 16)); tw = Math.min(ext.across * 0.8, nw * 2.2, 34); td = U.clamp(L * 0.18, 4, 12);
          var cand = tw > nw + 2 && L > nw * 1.8 ? crossShape(ext.centre, ext.angle, L, nw, tw, td, 0.62) : rect(ext.centre, ext.angle, L, nw);
          if (allInside(cand, tin)) shape = cand; else scale *= 0.9;
        }
        if (!shape) shape = rect(ext.centre, ext.angle, ext.along * 0.5, Math.min(ext.across * 0.4, 12));
        landmarks.push({ id: "L" + landmarks.length, kind: "temple", name: namer.town("temple", { name: title }), x: U.round(ext.centre[0], 1), y: U.round(ext.centre[1], 1), ward: temple.ward, poly: roundPts(shape), yard: roundPts(tin) });
      }
    }
    if (keep) {
      var kin = M.insetConvex(keep.raw, edgeMargins(keep, 1.5));
      if (kin) {
        var kext = M.extents(kin), kb = rect(kext.centre, kext.angle, Math.min(kext.along * 0.58, 34), Math.min(kext.across * 0.58, 26)), court = M.insetConvex(kin, 7);
        landmarks.push({ id: "L" + landmarks.length, kind: "keep", name: namer.town("keep", { name: title }), x: U.round(kext.centre[0], 1), y: U.round(kext.centre[1], 1), ward: keep.ward, poly: roundPts(kb), curtain: roundPts(M.tidy(kin, 3)), court: court ? roundPts(court) : null });
      }
    }
    if (walled) gates.forEach(function (g) { landmarks.push({ id: "L" + landmarks.length, kind: "gate", name: namer.town("gate", { bearing: g.bearing, name: title }), x: U.round(g.x, 1), y: U.round(g.y, 1), ward: null, bearing: g.bearing, road: g.roadId || null }); });
    if (harbour) landmarks.push({ id: "L" + landmarks.length, kind: "harbour", name: namer.town("harbour", { name: title }), x: U.round(harbour.x, 1), y: U.round(harbour.y, 1), ward: null });
    /* establishments: the trades and houses, each on a real footprint (43-establishments), then the author's edits */
    var mainEdges = edges.filter(function (ed) { return ed.cls === "main"; });
    var EST = { seed: seed, culture: P.culture, size: P.size, title: title, buildings: buildings, wards: wards, districts: districts, landmarks: landmarks, plazaC: plazaC, R: R,
      gatePts: gates.length ? gates.map(function (g) { return [g.x, g.y]; }) : roads.map(function (r) { return r.pts[0]; }),
      waterPts: cells.filter(function (cl) { return cl && (cl.kind === "water" || cl.kind === "bank"); }).map(function (cl) { return cl.site; }),
      streetPts: mainEdges.map(function (ed) { return [(ed.p[0] + ed.q[0]) / 2, (ed.p[1] + ed.q[1]) / 2]; }),
      streetAll: edges.filter(function (ed) { return ed.cls === "main" || ed.cls === "street" || ed.cls === "lane"; }).map(function (ed) { return [(ed.p[0] + ed.q[0]) / 2, (ed.p[1] + ed.q[1]) / 2]; }),
      hasCoast: !!P.site.coast, hasWater: !!(P.site.coast || P.site.lake || P.site.river), counts: P.establishments, used: namer.used, warnings: warnings };
    var establishments = NS.establishments.place(EST, P.edits);
    /* ── portals: the ways into another zone, one list every document carries. Each road leads back onto the region at
       this town's own place. A thing whose catalogue entry names a `portal` (the sewer entrance) leads down into that
       dungeon, and so does the OUTFALL, laid where the drains leave the town, outside the wall. One dungeon per town
       and site kind, and the dungeon's portals carry these same ids, so a party that goes down one grate may come up
       another, or slip out by the outfall. */
    var portals = roads.map(function (r) { var end = r.pts[r.pts.length - 1]; return { id: r.id, kind: "road", name: r.to.length ? "the road to " + r.to.join(" and ") : "the " + r.bearing + " road", x: end[0], y: end[1], to: { generator: "region", id: P.site.placeId || null } }; });
    var downs = establishments.filter(function (e) { return NS.establishments.CATALOGUE[e.kind] && NS.establishments.CATALOGUE[e.kind].portal; });
    downs.forEach(function (e) { var pt = NS.establishments.CATALOGUE[e.kind].portal; portals.push({ id: e.id, kind: pt.kind, name: e.name, x: e.x, y: e.y, to: { generator: pt.generator, site: pt.site, id: e.id } }); });
    if (downs.length) {
      var out = outfallSite(urban, edges, WG.polys, river, plazaC, gates, W, H);
      if (out) {
        var ofName = namer.town("outfall", { name: title }), ox = U.round(out[0], 1), oy = U.round(out[1], 1), pt0 = NS.establishments.CATALOGUE[downs[0].kind].portal;
        landmarks.push({ id: "L" + landmarks.length, kind: "outfall", name: ofName, x: ox, y: oy, ward: null });
        portals.push({ id: "outfall", kind: "outfall", name: ofName, x: ox, y: oy, to: { generator: pt0.generator, site: pt0.site, id: "outfall" } });
      } else warnings.push("no dry ground outside the wall for the sewers' outfall — the sewers have no way out but their grates");
    }
    /* every trade or house that stands in a building is a door INTO it (an interior, 45): the party steps inside the inn;
       so are the temple and the keep. `to.site` is the kind of building the interior generator lays out, `to.id` what
       the way back out lands on */
    establishments.forEach(function (e) { if (e.building === null || e.building === undefined) return; portals.push({ id: e.id, kind: "door", name: e.name, x: e.x, y: e.y, to: { generator: "interior", site: NS.interior.programOf(e.kind), id: e.id } }); });
    landmarks.forEach(function (l) { if ((l.kind === "temple" || l.kind === "keep") && l.poly) portals.push({ id: l.id, kind: "door", name: l.name, x: l.x, y: l.y, to: { generator: "interior", site: l.kind, id: l.id } }); });

    /* streets, walls, quays, piers */
    var streets = [], wallSegs = [], bridges = [];
    edges.forEach(function (ed) {
      if (ed.cls === "main" || ed.cls === "street" || ed.cls === "lane") {
        var st = { id: "s" + streets.length, kind: ed.cls, pts: roundPts([ed.p, ed.q]) };
        if (ed.crossing) { st.bridge = roundPts([ed.crossing])[0]; bridges.push(st.bridge); }
        streets.push(st);
      } else if (ed.cls === "wall") clipToLand(ed.p, ed.q, WG.polys).forEach(function (sg) { wallSegs.push(sg); });
    });
    var walls = null;
    if (walled) {
      var chains = M.chainSegments(wallSegs).map(function (ch) { return { pts: roundPts(ch.pts), closed: ch.closed }; });
      var towers = [], seenT = {};
      chains.forEach(function (ch) {
        var simp = G.simplify(ch.closed ? ch.pts.concat([ch.pts[0]]) : ch.pts, 2.5); if (ch.closed) simp.pop();
        simp.forEach(function (p) { var kk = key(p); if (!seenT[kk]) { seenT[kk] = true; towers.push(p); } });
      });
      /* a tower every so often along long straight runs too */
      walls = { chains: chains, towers: roundPts(towers), gates: gates.map(function (g) { return { id: g.id, x: U.round(g.x, 1), y: U.round(g.y, 1), bearing: g.bearing }; }) };
    }
    var piers = [];
    if (harbour && quays.length) {
      /* piers: a few spots on the quay nearest the harbour, well apart, each running out over the water */
      var spots = [], chosen = [], want = P.size === "city" ? 4 : P.size === "town" ? 3 : 2;
      quays.forEach(function (ch) { var j, mx, my; for (j = 1; j < ch.length; j++) { mx = (ch[j - 1][0] + ch[j][0]) / 2; my = (ch[j - 1][1] + ch[j][1]) / 2; spots.push({ m: [mx, my], a: ch[j - 1], b: ch[j], d: G.dist([mx, my], [harbour.x, harbour.y]) }); } });
      spots.sort(function (a, b) { return a.d - b.d; });
      spots.forEach(function (sp) { if (chosen.length < want && chosen.every(function (c) { return G.dist(c.m, sp.m) >= 16; })) chosen.push(sp); });
      chosen.forEach(function (sp, idx) {
        var dx = sp.b[0] - sp.a[0], dy = sp.b[1] - sp.a[1], l = Math.sqrt(dx * dx + dy * dy) || 1, ox = -dy / l, oy = dx / l, len = 14 + (idx % 2) * 8, mx = sp.m[0], my = sp.m[1];
        if (!inWater(WG.polys, [mx + ox * 5, my + oy * 5])) { ox = -ox; oy = -oy; }   /* out over the water, whichever side that is */
        piers.push(roundPts([[mx - oy * 2, my + ox * 2], [mx + ox * len - oy * 2, my + oy * len + ox * 2], [mx + ox * len + oy * 2, my + oy * len - ox * 2], [mx + oy * 2, my - ox * 2]]));
      });
    }

    /* outside: fields, orchards, woods, meadows, suburbs */
    var fields = [], trees = [], fRng = NS.Rng(seed + "/fields");
    var roadFronts = []; roads.forEach(function (rd) { var k; for (k = 1; k < rd.pts.length; k++) roadFronts.push({ p: rd.pts[k - 1], q: rd.pts[k], margin: 3.5 }); });   /* a suburb's houses front the road out */
    parks.forEach(function (pk) {   /* the park's green, piece by piece, and its trees, scattered thinner than a wood's */
      (pk.pieces || []).forEach(function (piece) {
        fields.push({ kind: "park", poly: roundPts(piece), angle: 0 });
        var inP = M.insetConvex(piece, 2) || piece, bb3 = G.bbox(inP), x, y, jx, jy;
        for (y = bb3[1] + 5; y < bb3[3]; y += 11) for (x = bb3[0] + 5; x < bb3[2]; x += 11) { jx = x + (fRng.float() - 0.5) * 8; jy = y + (fRng.float() - 0.5) * 8; if (G.pointInPolygon([jx, jy], inP)) trees.push([U.round(jx, 1), U.round(jy, 1), U.round(0.5 + fRng.float() * 0.35, 2), 0]); }
      });
    });
    cells.forEach(function (cl) {
      if (!cl || cl.urban || cl.kind !== "land") return;
      var reach = R + Math.max(1.6 * R, Math.min(W, H) * 0.28);
      if (cl.d > reach) return;
      var t = U.clamp((cl.d - R) / (reach - R), 0, 1), roll = fRng.float(), kind;
      var nearRoad = roads.some(function (rd) { return rd.pts.some(function (p) { return G.dist(p, cl.site) < S.spacing(cl.d) * 0.75; }); });
      var nearTown = cl.nb.some(function (k2) { return cells[k2] && cells[k2].urban; });
      if (nearRoad && nearTown && P.size !== "hamlet" && fRng.chance(0.55)) kind = "suburb";
      else if (roll < 0.78 - 0.45 * t) kind = "field";
      else if (roll < 0.86 - 0.45 * t) kind = "orchard";
      else if (roll < (P.site.forest ? 0.97 : 0.9) - 0.12 * t) kind = "wood";
      else if (P.site.marsh && roll < 0.97) kind = "marsh";
      else kind = "meadow";
      cl.kind = kind;
      var inner = M.insetConvex(cl.poly, kind === "suburb" ? 3.5 : 2.4); if (!inner) return;
      if (kind === "field") fields.push({ kind: kind, poly: roundPts(inner), angle: U.round(fRng.float() * Math.PI, 3) });
      else if (kind === "orchard" || kind === "wood" || kind === "marsh") {
        fields.push({ kind: kind, poly: roundPts(inner), angle: 0 });
        var bb2 = G.bbox(inner), step = kind === "orchard" ? 11 : kind === "wood" ? 10 : 13, x, y, jx, jy;
        for (y = bb2[1] + step / 2; y < bb2[3]; y += step) for (x = bb2[0] + step / 2; x < bb2[2]; x += step) {
          jx = kind === "orchard" ? x : x + (fRng.float() - 0.5) * step * 0.8; jy = kind === "orchard" ? y : y + (fRng.float() - 0.5) * step * 0.8;
          if (!G.pointInPolygon([jx, jy], inner)) continue;
          trees.push([U.round(jx, 1), U.round(jy, 1), U.round(kind === "marsh" ? 0.8 : 0.55 + fRng.float() * 0.35, 2), kind === "marsh" ? 1 : 0]);
        }
      } else if (kind === "suburb") {
        var w2 = { id: "w" + wards.length, kind: "suburb", district: null, poly: roundPts(cl.poly), x: U.round(cl.site[0], 1), y: U.round(cl.site[1], 1) };
        cl.ward = wards.length; wards.push(w2);
        footprints(inner, roadFronts, { lotArea: 48, gap: 0.6, minArea: 12, minAcross: 2.8, yard: 0.45 }, bRng).forEach(function (fp) { if (WG.polys.length && wetPoly(WG.polys, fp)) return; buildings.push({ w: cl.ward, pts: roundPts(fp) }); });
      }
    });
    stats.buildings = U.round(NS.terrain.now() - t0, 1);

    var houses = buildings.length, population = Math.round(houses * (4.2 + rng.float() * 1.6) / 10) * 10;
    var doc = {
      format: NS.DOC_FORMAT, ver: NS.DOC_VER, generator: { name: "town", version: NS.VERSION },
      seed: seed, params: P,
      frame: { width: W, height: H, kmPerUnit: M_PER_UNIT / 1000, mPerUnit: M_PER_UNIT },
      title: { name: title, kind: P.size },
      site: P.site, size: P.size, walled: !!walls, population: population, houses: houses,
      centre: [U.round(plazaC[0], 1), U.round(plazaC[1], 1)], radius: U.round(R, 1),
      water: { polys: WG.polys, ripples: WG.ripples, river: river ? { pts: roundPts(river.pts), name: P.site.riverName || null } : null, seaName: P.site.coast ? (P.site.seaName || null) : null, lakeName: P.site.lake ? (P.site.lakeName || null) : null, coast: P.site.coast, lake: P.site.lake },
      wards: wards, districts: districts.map(function (d) { return { id: d.id, name: d.name, x: d.x, y: d.y, houses: d.houses }; }),
      buildings: buildings, streets: streets, roads: roads, walls: walls, quays: quays, piers: piers, bridges: bridges,
      landmarks: landmarks, establishments: establishments, fields: fields, trees: trees, portals: portals,
      warnings: warnings,
      stats: U.extend({ cells: cells.filter(function (cl) { return !!cl; }).length, urbanCells: urban.length, streets: streets.length, buildings: houses }, stats)
    };
    doc.stats.total = U.round(stats.substrate + stats.layout + stats.buildings, 1);
    return doc;
  }

  /* ── nesting ── the params for the town of a region place: its site, name, culture, roads with their destinations,
     the river's run through the place, and a seed derived from the region's seed and the place id */
  function fromRegion(regionDoc, placeId) {
    NS.assert(regionDoc && regionDoc.format === NS.DOC_FORMAT && regionDoc.generator && regionDoc.generator.name === "region", "fromRegion needs a region document", { format: regionDoc && regionDoc.format });
    var place = null, i; for (i = 0; i < regionDoc.places.length; i++) if (regionDoc.places[i].id === placeId) place = regionDoc.places[i];
    NS.assert(place, "no place with that id in the region document", { placeId: placeId, known: regionDoc.places.map(function (p) { return p.id; }) });
    var s = place.site, site = { hill: !!s.hill, forest: !!s.forest, marsh: !!s.marsh, biome: s.biome, elevation: s.elevation, mouth: !!s.mouth, regionName: regionDoc.title.name, regionSeed: regionDoc.seed, placeId: place.id, placeKind: place.kind };
    site.coast = s.coastal && s.coastBearing ? s.coastBearing : null;
    site.lake = null;
    if (s.lake && s.lakeId) { var lk = null; regionDoc.features.forEach(function (f) { if (f.id === s.lakeId) lk = f; }); if (lk) { var lb = G.bearing([place.x, place.y], [lk.x, lk.y]).name; if (lb !== site.coast) { site.lake = lb; site.lakeName = lk.name || null; } } }
    if (site.coast) { var best = null, bd = Infinity; regionDoc.features.forEach(function (f) { if (f.kind !== "sea") return; var d = G.dist([place.x, place.y], [f.x, f.y]); if (d < bd) { bd = d; best = f; } }); if (best) site.seaName = best.name; }
    site.river = null;
    if (s.riverId) {
      var rv = null; regionDoc.rivers.forEach(function (r) { if (r.id === s.riverId) rv = r; });
      if (rv && rv.pts.length >= 2) {
        var pts = rv.pts, bi = 0, bdd = Infinity, k;
        for (k = 0; k < pts.length; k++) { var dd = G.dist([pts[k][0], pts[k][1]], [place.x, place.y]); if (dd < bdd) { bdd = dd; bi = k; } }
        var up = pts[Math.max(0, bi - 4)], down = pts[Math.min(pts.length - 1, bi + 4)], from, to;
        from = bi > 0 ? G.bearing([place.x, place.y], [up[0], up[1]]).name : null;
        to = bi < pts.length - 1 ? G.bearing([place.x, place.y], [down[0], down[1]]).name : null;
        if (!from && to) from = BEARINGS[(BEARINGS.indexOf(to) + 4) % 8];
        if (!to && from) to = site.coast || BEARINGS[(BEARINGS.indexOf(from) + 4) % 8];
        if (from && to && from === to) to = BEARINGS[(BEARINGS.indexOf(from) + 4) % 8];
        if (from && to) site.river = { from: from, to: to };
        site.riverName = rv.name || null;
      }
    }
    site.roads = (s.roads || []).map(function (r) { var to = null, kind = "road"; regionDoc.places.forEach(function (p) { if (p.id === r.to) to = p.name; }); regionDoc.roads.forEach(function (rd) { if (rd.id === r.road) kind = rd.kind; }); return { bearing: r.bearing, to: to, kind: kind }; });
    var sizeOf = { city: "city", town: "town", village: "village" };
    return { seed: regionDoc.seed + "/" + place.id, size: sizeOf[place.kind] || "village", culture: regionDoc.params.culture, title: place.name, site: site };
  }

  /* ── validate ── the town document shape */
  function validate(doc) {
    ["wards", "districts", "buildings", "streets", "roads", "landmarks", "establishments", "fields", "trees", "quays", "piers", "bridges"].forEach(function (k) { NS.assert(Array.isArray(doc[k]), "document." + k + " must be an array", { key: k }); });
    NS.assert(doc.water && Array.isArray(doc.water.polys), "document.water.polys must be an array", { water: doc.water });
    NS.assert(doc.walls === null || (doc.walls && Array.isArray(doc.walls.chains) && Array.isArray(doc.walls.towers)), "document.walls must be null or {chains, towers, gates}", { walls: doc.walls });
    NS.assert(NS.own(SIZES, doc.size), "document.size must be one of " + Object.keys(SIZES).join("|"), { size: doc.size });
    NS.assert(doc.frame.mPerUnit > 0, "document.frame.mPerUnit must be positive", { frame: doc.frame });
    doc.landmarks.forEach(function (l, i) { NS.assert(l.id && typeof l.name === "string" && isFinite(l.x) && isFinite(l.y) && l.kind, "landmark " + i + " is malformed", { landmark: l }); });
    var ids = {};
    doc.establishments.forEach(function (e, i) {
      NS.assert(e.id && !ids[e.id] && (NS.own(NS.establishments.CATALOGUE, e.kind) || e.kind === NS.establishments.CUSTOM) && typeof e.word === "string" && (e.icon === null || NS.own(NS.icons.ICONS, e.icon)) && typeof e.name === "string" && isFinite(e.x) && isFinite(e.y) && (e.building === null || doc.buildings[e.building]), "establishment " + i + " is malformed or its id is not unique", { establishment: e });
      ids[e.id] = true;
    });
    NS.validatePortals(doc);
    return doc;
  }

  NS.town = { generate: generate, DEFAULTS: DEFAULTS, M_PER_UNIT: M_PER_UNIT, SHEET: SHEET, SIZES: Object.keys(SIZES), SIZE_TABLE: SIZES, BEARINGS: BEARINGS, RIVER_OPTIONS: Object.keys(RIVER_OPTIONS), WIDTH: WIDTH, resolveParams: resolveParams, fromRegion: fromRegion, validate: validate };
})(typeof self !== "undefined" ? self : typeof global !== "undefined" ? global : this);

/* ───── 43-establishments.js ───── */
/* 43-establishments.js — ESTABLISHMENTS: the trades and houses of a town — inn, tavern, smith, apothecary, stable,
   guild hall, thieves' den, a sewer entrance… A CATALOGUE table says how many a place of each size gets, where each
   likes to stand, what it stands ON (`site`: a house, or a point in the street), the icon it wears and how it is named;
   `populate` assigns them from the seed; `applyEdits` lays the author's edits (add, remove, rename, move) over the
   result — including the author's own `custom` features (a wizard's tower: its own word, icon and footprint).
   Establishments are a LIST of objects with stable ids (`tavern-3`, or the author's own `a1`); nothing is keyed by
   name. Adding a kind is adding a catalogue entry.

   Nothing may shuffle when the author changes one count. So the sites are RESERVED first, from the seed alone: every
   applicable kind gets its MAX_COUNT candidates from its pool (houses, or street points), dealt round-robin (every
   kind's first before any kind's second, so the good houses are shared fairly), and its names in the same fixed order.
   The requested count of a kind then simply takes its first n reservations — turning the scriptorium off leaves every
   other trade exactly where it was. Only a slot whose house an authored edit has claimed, or a slot past the
   reservations (a hamlet runs out of houses), is placed dynamically among what is still free; that is the one case
   that can shift. */
(function (root) {
  "use strict";
  var NS = root.TnDMaps, U = NS.util, G = NS.geom;

  var SIZE_INDEX = { hamlet: 0, village: 1, town: 2, city: 3 }, MAX_COUNT = 12, MAX_NAME = 40, MAX_WORD = 30, MAX_NOTE = 400, SNAP = 30, POINT_GAP = 20;
  /* count: per size (hamlet, village, town, city); near: where it likes to stand — market | gate | water | edge |
     street | any; site: house (default) | street (a point in a street, no house); needs: coast | water, else none
     placed unless asked for; minArea: the smallest footprint it takes; patterns: name patterns, or the key of the
     culture's own list (inn); portal: {generator, site, kind} when the thing is a way into another zone (the sewer
     entrance leads down into the town's sewer dungeon — the town lists it in doc.portals and lays the outfall) */
  var CATALOGUE = {
    inn: { word: "inn", icon: "tankard", count: [0, 1, 2, 3], near: "gate", minArea: 30, patterns: "inn" },
    tavern: { word: "tavern", icon: "tankard", count: [0, 1, 2, 4], near: "street", minArea: 20, patterns: ["The {A} {S}", "The {S} and {S}", "{R}'s Cellar", "The {A} Cup"] },
    smith: { word: "blacksmith", icon: "anvil", count: [0, 1, 1, 2], near: "gate", minArea: 24, patterns: ["{R}'s Forge", "The {A} Anvil", "{R}'s Smithy"] },
    apothecary: { word: "apothecary", icon: "flask", count: [0, 0, 1, 2], near: "market", minArea: 16, patterns: ["{R}'s Remedies", "The {A} Flask", "{R} the Apothecary"] },
    stable: { word: "stable", icon: "horseshoe", count: [0, 0, 1, 2], near: "gate", minArea: 36, patterns: ["{R}'s Stables", "The {A} Horse", "{N} Livery"] },
    baker: { word: "bakery", icon: "bread", count: [0, 1, 1, 3], near: "street", minArea: 16, patterns: ["{R}'s Ovens", "The {A} Loaf", "{R} the Baker"] },
    fishmonger: { word: "fishmonger", icon: "fish", count: [0, 1, 1, 2], near: "water", needs: "water", minArea: 16, patterns: ["{R}'s Fish", "The {A} {S}", "{N} Fish Market"] },
    carpenter: { word: "carpenter", icon: "hammer", count: [0, 0, 1, 2], near: "edge", minArea: 28, patterns: ["{R}'s Yard", "{R} and Sons", "The {A} Plane"] },
    moneylender: { word: "moneylender", icon: "coin", count: [0, 0, 1, 2], near: "market", minArea: 20, patterns: ["{R}'s Counting House", "The House of {R}", "{R} and Daughters"] },
    bathhouse: { word: "bathhouse", icon: "well", count: [0, 0, 0, 1], near: "market", minArea: 40, patterns: ["The {A} Baths", "{N} Bathhouse"] },
    shrine: { word: "shrine", icon: "star", count: [0, 1, 1, 2], near: "edge", minArea: 14, patterns: ["Shrine of {R}", "The {A} Shrine", "St {R}'s Well"] },
    townHall: { word: "town hall", icon: "bell", count: [0, 0, 1, 1], near: "market", minArea: 48, patterns: ["{N} Moot Hall", "The Guildhall", "{N} Town Hall"] },
    harbourmaster: { word: "harbourmaster", icon: "anchor", count: [0, 0, 1, 1], near: "water", needs: "coast", minArea: 20, patterns: ["The Harbourmaster's House", "{N} Customs House"] },
    guild: { word: "guild hall", icon: "scales", count: [0, 0, 0, 2], near: "market", minArea: 48, patterns: ["The {T} Hall", "{T} Guildhall", "The {A} Guild"] },
    thievesDen: { word: "thieves' den", icon: "dagger", count: [0, 0, 1, 3], near: "edge", minArea: 18, patterns: ["The {A} {S}", "{R}'s Cellar", "The {S}'s Rest"] },
    watch: { word: "watch house", icon: "shield", count: [0, 0, 1, 2], near: "gate", minArea: 32, patterns: ["{N} Watch House", "The {A} Guard", "{B} Watch"] },
    scribe: { word: "scriptorium", icon: "book", count: [0, 0, 0, 1], near: "market", minArea: 20, patterns: ["{R}'s Scriptorium", "The {A} Quill", "{N} Library"] },
    seer: { word: "seer", icon: "eye", count: [0, 0, 0, 1], near: "any", minArea: 14, patterns: ["The {A} Eye", "{R} the Seer", "The House of {R}"] },
    locksmith: { word: "locksmith", icon: "key", count: [0, 0, 0, 1], near: "street", minArea: 16, patterns: ["{R}'s Locks", "The {A} Key"] },
    gaol: { word: "gaol", icon: "padlock", count: [0, 0, 0, 1], near: "gate", minArea: 40, patterns: ["{N} Gaol", "The {A} Hole", "The {B} Gaol"] },
    /* a way down: a grate in a street toward the edge of town — many an adventure starts beneath the city */
    sewer: { word: "sewer entrance", icon: "grate", count: [0, 0, 1, 2], near: "edge", site: "street", portal: { generator: "dungeon", site: "sewer", kind: "grate" }, patterns: ["The {A} Grate", "{R}'s Drain", "The {S} Hatch", "Old {R} Grate"] }
  };
  var OPS = { add: 1, remove: 1, rename: 1, move: 1 , note: 1 }, GENERATED_ID = /^([a-zA-Z]+)-(\d+)$/, CUSTOM = "custom";
  /* the author's own footprints (width × height in map units) when a custom feature is not to take a house */
  var FOOTPRINTS = { small: [6, 5], medium: [8, 7], large: [12, 10] }, DEFAULT_FOOTPRINT = [7, 6];   /* map units (1.25 m): a cottage of 47 m², a house of 87, a hall of 187 */
  function hasOwn(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }
  function siteOf(kind) { return CATALOGUE[kind] && CATALOGUE[kind].site ? CATALOGUE[kind].site : "house"; }

  /* ── parameter validation (called by town.resolveParams) ── */
  function validateCounts(counts) {
    NS.assert(counts && typeof counts === "object" && !Array.isArray(counts), "establishments must be an object of kind → count", { establishments: counts });
    var k;
    for (k in counts) if (hasOwn(counts, k)) {
      NS.assert(NS.own(CATALOGUE, k), "establishments: unknown kind", { kind: k, known: Object.keys(CATALOGUE) });
      NS.assert(U.isNum(counts[k]) && counts[k] >= 0 && counts[k] <= MAX_COUNT && counts[k] === Math.floor(counts[k]), "establishments." + k + " must be an integer in [0, " + MAX_COUNT + "]", { value: counts[k] });
    }
    return counts;
  }
  function isPoint(at) { return Array.isArray(at) && at.length === 2 && isFinite(at[0]) && isFinite(at[1]); }
  function validateEdits(edits, frame) {
    NS.assert(Array.isArray(edits), "edits must be an array", { edits: edits });
    var ids = {};
    edits.forEach(function (e, i) {
      NS.assert(e && typeof e === "object" && NS.own(OPS, e.op), "edits[" + i + "].op must be one of " + Object.keys(OPS).join("|"), { edit: e });
      NS.assert(typeof e.id === "string" && e.id.length > 0, "edits[" + i + "] needs a string id", { edit: e });
      if (e.op === "add") {
        NS.assert(NS.own(CATALOGUE, e.kind) || e.kind === CUSTOM, "edits[" + i + "]: unknown establishment kind", { kind: e.kind, known: Object.keys(CATALOGUE).concat([CUSTOM]) });
        NS.assert(!ids[e.id], "edits[" + i + "]: an establishment with id " + e.id + " is already added", { id: e.id }); ids[e.id] = true;
        NS.assert(!GENERATED_ID.test(e.id), "edits[" + i + "]: authored ids must not look like generated ones (kind-n)", { id: e.id });
        if (e.kind === CUSTOM) {
          NS.assert(typeof e.word === "string" && e.word.trim().length > 0 && e.word.length <= MAX_WORD, "edits[" + i + "]: a custom feature needs a word of 1–" + MAX_WORD + " characters (what it is)", { edit: e });
          NS.assert(e.icon === undefined || e.icon === null || NS.own(NS.icons.ICONS, e.icon), "edits[" + i + "]: unknown icon", { icon: e.icon, known: NS.icons.names() });
          NS.assert(e.footprint === undefined || NS.own(FOOTPRINTS, e.footprint), "edits[" + i + "]: footprint must be one of " + Object.keys(FOOTPRINTS).join("|") + " (or absent: the nearest house)", { footprint: e.footprint });
          NS.assert(isPoint(e.at), "edits[" + i + "]: a custom feature needs at: [x, y]", { edit: e });
        } else if (siteOf(e.kind) === "street") NS.assert(isPoint(e.at), "edits[" + i + "]: a " + CATALOGUE[e.kind].word + " stands in the street and needs at: [x, y]", { edit: e });
        else NS.assert(isPoint(e.at) || (U.isNum(e.building) && e.building >= 0), "edits[" + i + "]: add needs at: [x, y] or a building index", { edit: e });
      }
      if (e.op === "move") NS.assert(isPoint(e.at), "edits[" + i + "]: move needs at: [x, y]", { edit: e });
      if (e.op === "rename") NS.assert(typeof e.name === "string" && e.name.trim().length > 0 && e.name.length <= MAX_NAME, "edits[" + i + "]: rename needs a name of 1–" + MAX_NAME + " characters", { edit: e });
      if (e.op === "note") NS.assert(typeof e.note === "string" && e.note.length <= MAX_NOTE, "edits[" + i + "]: note needs a string of at most " + MAX_NOTE + " characters (empty clears it)", { edit: e });
      if (e.op === "add") NS.assert(e.name === undefined || e.name === null || (typeof e.name === "string" && e.name.length <= MAX_NAME), "edits[" + i + "]: name must be a string of at most " + MAX_NAME + " characters", { edit: e });
      if (frame && isPoint(e.at)) NS.assert(e.at[0] >= 0 && e.at[1] >= 0 && e.at[0] <= frame.width && e.at[1] <= frame.height, "edits[" + i + "]: at lies outside the map frame", { at: e.at });
    });
    return edits;
  }

  /* ── placement ── T: { seed, culture, size, title, buildings, wards, districts, landmarks, plazaC, R, gatePts,
     waterPts, streetPts (the main streets), streetAll (every street's midpoint: the pool of the street kinds), hasCoast,
     hasWater, counts, used (the shared name set), warnings } → the list; marks building.est */
  function centroidOf(b) { return b.c || (b.c = G.centroid(b.pts)); }
  function nearest(pts, p) { var best = Infinity, i, d; for (i = 0; i < pts.length; i++) { d = G.dist(pts[i], p); if (d < best) best = d; } return best; }
  function wardAt(T, w) { return w === null || w === undefined ? null : T.wards[w] || null; }
  function wardIndexAt(T, p) { var i, w; for (i = 0; i < T.wards.length; i++) { w = T.wards[i]; if (w.poly && G.pointInPolygon(p, w.poly)) return i; } return null; }
  function districtOf(T, w) { return w && w.district !== null && w.district !== undefined && T.districts[w.district] ? T.districts[w.district].id : null; }
  function entry(id, kind, word, icon, name, b, idx, T, authored) {
    var c = centroidOf(b), w = wardAt(T, b.w);
    b.est = id;
    return { id: id, kind: kind, word: word, icon: icon, name: name, x: U.round(c[0], 1), y: U.round(c[1], 1), building: idx, ward: w ? w.id : null, district: districtOf(T, w), authored: !!authored };
  }
  /* a thing that stands in the street, not in a house: building null, the ward it lies in */
  function entryAt(id, kind, word, icon, name, p, T, authored) {
    var w = wardAt(T, wardIndexAt(T, p));
    return { id: id, kind: kind, word: word, icon: icon, name: name, x: U.round(p[0], 1), y: U.round(p[1], 1), building: null, ward: w ? w.id : null, district: districtOf(T, w), authored: !!authored };
  }
  function nameFor(kind, namer, title) {
    var K = CATALOGUE[kind];
    return typeof K.patterns === "string" ? namer.town(K.patterns, { name: title }) : namer.town(kind, { name: title }, K.patterns);
  }
  function namesFor(kind, T, n) {
    var namer = NS.names.Namer(NS.Rng(T.seed + "/estnames/" + kind), T.culture, T.used), out = [], i;
    for (i = 0; i < n; i++) out.push(nameFor(kind, namer, T.title));
    return out;
  }
  function applicable(kind, T) { var K = CATALOGUE[kind]; return !(K.needs === "coast" && !T.hasCoast) && !(K.needs === "water" && !T.hasWater); }
  /* how many of a kind this town gets: the author's count if given, else the catalogue's for the size (none of a kind
     the site cannot hold) */
  function requested(kind, T) {
    if (T.counts && hasOwn(T.counts, kind)) return T.counts[kind];
    return applicable(kind, T) ? CATALOGUE[kind].count[SIZE_INDEX[T.size]] : 0;
  }
  function slotOf(id) { var m = GENERATED_ID.exec(id); return m ? Number(m[2]) : 0; }
  function placeScore(K, c, T) {
    var R = T.R || 1, dMarket = G.dist(c, T.plazaC) / R;
    switch (K.near) {
      case "market": return dMarket;
      case "gate": return T.gatePts.length ? nearest(T.gatePts, c) / R : 1 - dMarket;
      case "water": return T.waterPts.length ? nearest(T.waterPts, c) / R : 1 - dMarket;
      case "edge": return 1 - dMarket;
      case "street": return T.streetPts.length ? Math.min(1, nearest(T.streetPts, c) / (R * 0.3)) : 0;
      default: return 0;
    }
  }
  /* the fixed part of every candidate's score for a kind (lower is better): where it stands, how roomy a house is, and
     the seed's say — noise drawn once per candidate from the kind's own stream, so it never depends on what is taken.
     null = this kind will not take that candidate. Houses for the house kinds; street points for the street kinds. */
  function staticScores(kind, T) {
    var K = CATALOGUE[kind], rng = NS.Rng(T.seed + "/est/" + kind), out = [];
    if (siteOf(kind) === "street") {
      (T.streetAll || []).forEach(function (p, idx) { out[idx] = placeScore(K, p, T) + rng.float() * 0.25; });
      return out;
    }
    T.buildings.forEach(function (b, idx) {
      var noise = rng.float() * 0.25, area;
      if (b.authored || b.w === null || b.w === undefined) { out[idx] = null; return; }
      area = Math.abs(G.signedArea(b.pts)); if (area < K.minArea) { out[idx] = null; return; }
      out[idx] = placeScore(K, centroidOf(b), T) - 0.12 * Math.min(2, area / K.minArea - 1) + noise;   /* a roomier house suits a notable trade */
    });
    return out;
  }
  /* the best free candidate for a kind; perWard spreads the house kinds over the wards */
  function bestOf(kind, scores, T, taken, perWard) {
    var street = siteOf(kind) === "street", best = -1, bestS = Infinity, idx, s;
    for (idx = 0; idx < scores.length; idx++) {
      if (scores[idx] === null || scores[idx] === undefined || taken[idx]) continue;
      if (!street && T.buildings[idx].est) continue;
      s = scores[idx] + (street ? 0 : 0.35 * (perWard[T.buildings[idx].w] || 0));
      if (s < bestS) { bestS = s; best = idx; }
    }
    return best;
  }
  /* a street point taken also takes its neighbours within POINT_GAP, so two grates never share a corner */
  function takePoint(T, idx, taken) { var p = T.streetAll[idx], i; taken[idx] = true; for (i = 0; i < T.streetAll.length; i++) if (!taken[i] && G.dist(T.streetAll[i], p) < POINT_GAP) taken[i] = true; }
  /* the reservation: MAX_COUNT candidates per applicable kind from the seed alone, dealt round-robin */
  function reserve(T, kinds, scores) {
    var reserved = {}, taken = { house: {}, street: {} }, perWard = {}, round, k, kind, idx, pool;
    kinds.forEach(function (kd) { reserved[kd] = []; });
    for (round = 0; round < MAX_COUNT; round++) {
      for (k = 0; k < kinds.length; k++) {
        kind = kinds[k]; pool = taken[siteOf(kind)];
        idx = bestOf(kind, scores[kind], T, pool, perWard);
        if (idx < 0) continue;                                   /* this kind has run out; later slots go dynamic */
        reserved[kind].push(idx);
        if (siteOf(kind) === "street") takePoint(T, idx, pool); else { pool[idx] = true; perWard[T.buildings[idx].w] = (perWard[T.buildings[idx].w] || 0) + 1; }
      }
    }
    return reserved;
  }
  function populate(T) {
    var kinds = Object.keys(CATALOGUE), active = kinds.filter(function (k) { return applicable(k, T); }), scores = {}, names = {}, out = [], perWard = {}, blocked = T.blocked || {}, pointsTaken = {}, pending = [], short = {};
    active.forEach(function (kind) { scores[kind] = staticScores(kind, T); });
    var reserved = reserve(T, active, scores);
    active.forEach(function (kind) { names[kind] = namesFor(kind, T, MAX_COUNT); });
    function take(kind, i, idx) {
      var K = CATALOGUE[kind], id = kind + "-" + (i + 1);
      if (siteOf(kind) === "street") { out.push(entryAt(id, kind, K.word, K.icon, names[kind][i], T.streetAll[idx], T, false)); takePoint(T, idx, pointsTaken); return; }
      out.push(entry(id, kind, K.word, K.icon, names[kind][i], T.buildings[idx], idx, T, false)); perWard[T.buildings[idx].w] = (perWard[T.buildings[idx].w] || 0) + 1;
    }
    /* the requested slots take their reservations */
    kinds.forEach(function (kind) {
      var n = requested(kind, T), street = siteOf(kind) === "street", i, idx;
      if (!n) return;
      if (!names[kind]) names[kind] = namesFor(kind, T, n);       /* a kind the site would not have had: asked for anyway */
      if (!scores[kind]) scores[kind] = staticScores(kind, T);
      for (i = 0; i < n; i++) {
        idx = reserved[kind] && i < reserved[kind].length ? reserved[kind][i] : -1;
        if (idx >= 0 && (street ? !pointsTaken[idx] : (!blocked[idx] && !T.buildings[idx].est))) take(kind, i, idx); else pending.push({ kind: kind, i: i });
      }
    });
    /* the rest find a free candidate, every kind's first before any kind's second */
    pending.sort(function (a, b) { return a.i - b.i || kinds.indexOf(a.kind) - kinds.indexOf(b.kind); });
    pending.forEach(function (p) {
      var idx = bestOf(p.kind, scores[p.kind], T, siteOf(p.kind) === "street" ? pointsTaken : blocked, perWard);
      if (idx < 0) { short[p.kind] = (short[p.kind] || 0) + 1; return; }
      take(p.kind, p.i, idx);
    });
    Object.keys(short).forEach(function (kind) { var n = requested(kind, T); T.warnings.push("only " + (n - short[kind]) + " of " + n + " " + CATALOGUE[kind].word + (n === 1 ? "" : "s") + " found a " + (siteOf(kind) === "street" ? "place" : "house")); });
    out.sort(function (a, b) { return kinds.indexOf(a.kind) - kinds.indexOf(b.kind) || slotOf(a.id) - slotOf(b.id); });
    return out;
  }

  /* ── the author's edits ── An authored house is decided BEFORE the trades are placed (`resolveTargets`), so it never
     moves when a count changes: the nearest house within SNAP of the point — any house; a generated trade standing
     there yields and is placed among the free ones — or, with no house near (or a custom `footprint` asked for), a
     footprint of the author's own. Those houses are `blocked` for `populate`; `applyEdits` then lays the edits over
     the list in order. A thing that stands in the street (a sewer entrance) takes its point as given. */
  function nearestHouse(T, at, claimed) {
    var best = -1, bd = SNAP, i, d;
    for (i = 0; i < T.buildings.length; i++) { if (claimed[i]) continue; d = G.dist(centroidOf(T.buildings[i]), at); if (d < bd) { bd = d; best = i; } }
    return best;
  }
  function footprintAt(T, at, size) {
    /* the author's own footprint, outside any ward */
    var hw = (size || DEFAULT_FOOTPRINT)[0] / 2, hh = (size || DEFAULT_FOOTPRINT)[1] / 2, pts = [[at[0] - hw, at[1] - hh], [at[0] + hw, at[1] - hh], [at[0] + hw, at[1] + hh], [at[0] - hw, at[1] + hh]].map(function (p) { return [U.round(p[0], 1), U.round(p[1], 1)]; });
    T.buildings.push({ w: null, pts: pts, authored: true });
    return T.buildings.length - 1;
  }
  function generatedRequested(id, T) { var m = GENERATED_ID.exec(id); return !!(m && CATALOGUE[m[1]] && Number(m[2]) >= 1 && Number(m[2]) <= requested(m[1], T)); }
  function generatedKind(id) { var m = GENERATED_ID.exec(id); return m && CATALOGUE[m[1]] ? m[1] : null; }
  function resolveTargets(edits, T) {
    var targets = [], claimed = {}, where = {}, blocked = {}, shape = {};
    edits.forEach(function (e, k) {
      var idx = -1, old, fp;
      if (e.op === "add") {
        if (where[e.id] !== undefined) return;                     /* a second add of the id: warned by applyEdits */
        if (siteOf(e.kind) === "street") { where[e.id] = -1; return; }   /* a point: nothing claimed */
        fp = e.kind === CUSTOM && e.footprint ? FOOTPRINTS[e.footprint] : null;
        if (fp) { shape[e.id] = fp; idx = footprintAt(T, e.at, fp); }
        else if (U.isNum(e.building) && T.buildings[e.building] && !claimed[e.building]) idx = e.building;
        else if (isPoint(e.at)) { idx = nearestHouse(T, e.at, claimed); if (idx < 0) idx = footprintAt(T, e.at, null); }
        if (idx < 0) return;
      } else if (e.op === "move") {
        if (where[e.id] === undefined && !generatedRequested(e.id, T)) return;   /* nothing to move: warned by applyEdits */
        if (where[e.id] === -1 || siteOf(generatedKind(e.id)) === "street") return;   /* a point moves without claiming */
        old = where[e.id]; if (old !== undefined) delete claimed[old];
        if (shape[e.id]) idx = footprintAt(T, e.at, shape[e.id]);
        else { idx = nearestHouse(T, e.at, claimed); if (idx < 0) idx = footprintAt(T, e.at, null); }
      } else if (e.op === "remove") {
        old = where[e.id]; if (old !== undefined && old >= 0) delete claimed[old]; delete where[e.id];
        return;
      } else return;
      claimed[idx] = true; blocked[idx] = true; where[e.id] = idx; targets[k] = idx;
    });
    return { targets: targets, blocked: blocked };
  }
  function byId(list, id) { var i; for (i = 0; i < list.length; i++) if (list[i].id === id) return i; return -1; }
  function applyEdits(list, edits, T, targets) {
    var namers = {};
    targets = targets || [];
    function namerFor(kind) { return namers[kind] || (namers[kind] = NS.names.Namer(NS.Rng(T.seed + "/authored/" + kind), T.culture, T.used)); }
    function free(idx) { return U.isNum(idx) && idx >= 0 && T.buildings[idx] && !T.buildings[idx].est; }
    edits.forEach(function (e, k) {
      var i = byId(list, e.id), idx, b, word, icon, name;
      if (e.op === "add") {
        if (i >= 0) { T.warnings.push("edit add " + e.id + ": already on the map"); return; }
        word = e.kind === CUSTOM ? String(e.word).trim() : CATALOGUE[e.kind].word;
        icon = e.kind === CUSTOM ? (e.icon || null) : CATALOGUE[e.kind].icon;
        name = e.name ? String(e.name) : e.kind === CUSTOM ? U.titleCase(word) : nameFor(e.kind, namerFor(e.kind), T.title);
        if (siteOf(e.kind) === "street") { list.push(entryAt(e.id, e.kind, word, icon, name, e.at, T, true)); return; }
        idx = free(targets[k]) ? targets[k] : -1;
        if (idx < 0) { T.warnings.push("edit add " + e.id + ": no such building " + e.building); return; }
        b = T.buildings[idx];
        list.push(entry(e.id, e.kind, word, icon, name, b, idx, T, true));
      } else if (e.op === "remove") {
        if (i < 0) { T.warnings.push("edit remove " + e.id + ": no establishment with that id"); return; }
        b = list[i].building === null ? null : T.buildings[list[i].building]; if (b && b.est === e.id) delete b.est;
        list.splice(i, 1);
      } else if (e.op === "rename" || e.op === "note") {
        /* a trade, a landmark or a district: its name, or the GM's note on it */
        var target = i >= 0 ? list[i] : null, j;
        if (!target) { j = byId(T.landmarks, e.id); if (j >= 0) target = T.landmarks[j]; }
        if (!target) { j = byId(T.districts, e.id); if (j >= 0) target = T.districts[j]; }
        if (!target) { T.warnings.push("edit " + e.op + " " + e.id + ": nothing on the map has that id"); return; }
        if (e.op === "rename") { target.name = String(e.name); target.renamed = true; }
        else if (e.note.trim()) target.note = e.note.trim(); else delete target.note;
      } else if (e.op === "move") {
        if (i < 0) { T.warnings.push("edit move " + e.id + ": no establishment with that id"); return; }
        var cur = list[i], moved;
        if (cur.building === null) moved = entryAt(e.id, cur.kind, cur.word, cur.icon, cur.name, e.at, T, cur.authored);
        else {
          var old = T.buildings[cur.building]; if (old && old.est === e.id) delete old.est;
          idx = free(targets[k]) ? targets[k] : nearestHouse(T, e.at, {}); if (idx < 0 || T.buildings[idx].est) idx = footprintAt(T, e.at, null);
          moved = entry(e.id, cur.kind, cur.word, cur.icon, cur.name, T.buildings[idx], idx, T, cur.authored);
        }
        moved.renamed = cur.renamed;
        list[i] = moved;
      }
    });
    return list;
  }
  /* the whole of it for the town generator: the author's houses first, then the trades around them, then the edits */
  function place(T, edits) {
    var r = resolveTargets(edits || [], T);
    T.blocked = r.blocked;
    return applyEdits(populate(T), edits || [], T, r.targets);
  }

  NS.establishments = { CATALOGUE: CATALOGUE, kinds: function () { return Object.keys(CATALOGUE); }, OPS: Object.keys(OPS), SIZE_INDEX: SIZE_INDEX, MAX_COUNT: MAX_COUNT, MAX_NAME: MAX_NAME, MAX_WORD: MAX_WORD, SNAP: SNAP,
    CUSTOM: CUSTOM, FOOTPRINTS: FOOTPRINTS, MAX_NOTE: MAX_NOTE, siteOf: siteOf, validateCounts: validateCounts, validateEdits: validateEdits, populate: populate, applyEdits: applyEdits, place: place };
})(typeof self !== "undefined" ? self : typeof global !== "undefined" ? global : this);

/* ───── 44-dungeon.js ───── */
/* 44-dungeon.js — the DUNGEON generator: what lies beneath or beyond a settlement. A SITE TABLE says what kind of
   dungeon it is (the sewer beneath a town, the catacombs beneath the sewer, the cave behind a mouth on the region;
   crypt and mine are later entries) and the core knows nothing of sewers: every site hands it the fixed points it must contain and connect — the
   PORTALS (ways in from above: a town's grates, a stair from the level above; a way out: the outfall) —, the lines
   its spine may follow (the streets above, or none: a star of corridors), a room catalogue and an ink. Passages and
   rooms form one graph in which every portal reaches every other (tested). Nesting contract: NS.dungeon.fromTown(
   townDoc, portalId) and NS.dungeon.fromDungeon(parentDoc, portalId) → params for TnDMaps.generate("dungeon", params).
   The dungeon's portals carry the parent's ids and coordinates, so the game puts the party back where it came from.
   One dungeon per parent and site kind (seed = parentSeed + "/" + kind): two grates open into the same sewer, two
   stairs into the same catacombs. The author's say — params `rooms` (kind → count) and `edits` (add | remove |
   rename | move | note | reshape, as for a town's establishments) — goes INTO the generator, so an authored dungeon
   is still {seed, params}. Chambers are RESERVED from the seed alone (round-robin over the kinds), so changing one
   kind's count never moves another's; an authored room claims its spot first and a reserved room standing there
   yields. A room of a kind that is a `portal` (the stairs down) is a way into the level below. */
(function (root) {
  "use strict";
  var NS = root.TnDMaps, U = NS.util, G = NS.geom, M = NS.mesh;

  /* a dungeon's own scale: 0.5 m per unit, so the passage widths below are whole metres — a main tunnel 3 m, a side
     passage 2, the drain 2.5, a door 1 — and a sunken chapel (14 units) is 7 m square; the town's 1.25 m per unit made
     every room and hall twice life size */
  var M_PER_UNIT = 0.5;
  /* the sheets a dungeon is drawn on: the town's (42's SHEET) in the dungeon's own units — the same ground in metres,
     so the sewers of the widest town a caller may ask for still fit (a town of 6000 units is a sewer of 15000) */
  var SHEET = { min: 400, max: NS.town.SHEET.max * NS.town.M_PER_UNIT / M_PER_UNIT };
  var SIZE_INDEX = { hamlet: 0, village: 1, town: 2, city: 3 };
  var WIDTH = { main: 6, side: 4, drain: 5, door: 2 };   /* units: 3 m, 2 m, 2.5 m, 1 m */
  var GAP = 2.4, ANCHOR_STEP = 22, ANCHOR_END = 12, ROOM_MARGIN = 3, FRAME_MARGIN = 10, EXTENT_PAD = 70, WALL = 1.5, ANNEX_REACH = 16;   /* WALL: the shared wall between a chamber and one built onto it; ANNEX_REACH: how far outside a chamber a point still means "build onto it" (8 m — the far side of a chamber is open rock, and a click there is for the chamber, not for a tunnel 20 m off) */
  /* authoring: at most MAX_COUNT chambers of a kind; an edit's point must lie within SNAP units of a passage; a custom
     room (the author's own kind: {kind: "custom", word, size?, shape?, name?, at}) is a 5 × 6 m rectangle unless told
     otherwise; any add may set `size` — METRES, [along, across] for a rectangle, [across] for a round one, each in
     SIZE_M — and `shape` (rectangle|round); `reshape` {id, size?, shape?} changes a dug room; the preset names
     small|medium|large are still taken as `footprint`; `note` {id, note} is the GM's note on it */
  var MAX_COUNT = 8, MAX_NAME = 40, MAX_WORD = 30, MAX_NOTE = 400, SNAP = 45, CUSTOM = "custom", DEFAULT_FOOTPRINT = "medium", SIZE_M = [1, 40];
  var FOOTPRINTS = { small: [4, 4], medium: [5, 6], large: [8, 6] }, SHAPES = { rectangle: 1, round: 1, cavern: 1 };   /* the preset sizes, in metres; a cavern is a natural chamber — a convex, irregular ring of points on an ellipse along × across */
  var OPS = { add: 1, remove: 1, rename: 1, move: 1, note: 1, reshape: 1, door: 1 }, GENERATED_ID = /^([a-z]+)-(\d+)$/;
  /* what stands in a chamber's doorway (`door` {id, state} sets it; the seed deals them by the site's `doors` odds) */
  var DOOR_STATES = { arch: "an open arch", door: "a door", locked: "a locked door", barred: "a barred door", secret: "a secret door" };
  /* portal kinds: a way IN from above (the spine must reach it) or a way OUT (the drain runs to it) */
  var PORTAL_KINDS = { grate: "in", stairs: "in", cave: "in", shaft: "in", outfall: "out" };
  /* a site: how it is titled (the caption under the title is the same for every site: "<town> · level −<depth>"),
     what its spine follows (streets, or nothing: a star of corridors), whether water runs
     down its passages, how many side passages and loops a town of each size gets (hamlet, village, town, city), the
     rooms at its portals (the portal kinds it takes from above) and junctions, its room catalogue (kind → word, count
     per size, shape — a rect `along` × `across` the passage or an octagon of radius `r` —, name patterns filled with
     the town's culture: {N} the town's name, {B} the bearing from the hub; `portal` when a room of the kind is a way
     DOWN into the site `below`) */
  /* the reference point for bearings and distances ("120 m NE of …"): the hub under the market, or, where `reference`
     is "way in", the first way up (a cave's mouth, the shaft down from the level above) with these words */
  var REF_WORDS = { cave: { word: "the mouth", at: "at the mouth" }, shaft: { word: "the shaft up", at: "at the foot of the shaft" }, stairs: { word: "the stair up", at: "at the foot of the stair" } }, REF_DEFAULT = { word: "the market above", at: "under the market" };
  /* what feeds a pool — the GM's fact, dealt from the seed by the chamber's id: a spring that rises in it (the only kind
     a stream runs from), the drip of the roof (every pool's where the site has no water), or — in a sea cave — the
     sea when it storms. A spring runs over only to a sink within STREAM_REACH of passage */
  var POOL_FED = { spring: { word: "a spring pool", text: "fed by a spring that rises in it" }, seep: { word: "a still pool", text: "still water, fed by the drip of the roof" }, brackish: { word: "a brackish pool", text: "brackish, left by the sea when it storms" } };
  var FED_ODDS = { sea: [["brackish", 0.45], ["spring", 0.25], ["seep", 0.3]], land: [["spring", 0.4], ["seep", 0.6]] }, STREAM_REACH = 160;   /* 80 m */
  var SITES = {
    sewer: {
      word: "sewers", follows: "streets", channel: true, sides: [1, 2, 3, 5], loops: [0, 0, 1, 2], below: "catacombs",
      doors: { arch: 0.55, door: 0.25, locked: 0.12, barred: 0.08 },
      title: function (town) { return town ? "The Sewers of " + town : "The Sewers"; },
      portalRooms: { grate: { word: "way up", along: 11, across: 9 }, outfall: { word: "outfall", along: 12, across: 10 } },
      junction: { word: "vault", r: 8, hubR: 10.5, patterns: ["The {B} Vault", "{B} Junction", "The {A} Crossing"] },
      deadEnd: { word: "alcove", along: 9, across: 8, patterns: ["The {A} Alcove", "{R}'s Corner", "The {B} End"] },
      rooms: {
        cistern: { word: "cistern", count: [0, 1, 2, 3], r: 11, patterns: ["The {A} Cistern", "{R}'s Cistern", "Old {N} Cistern"] },
        den: { word: "den", count: [0, 1, 1, 2], along: 15, across: 11, patterns: ["The {A} Warren", "Nest of {R}", "The {S} Den"] },
        cache: { word: "smugglers' cache", count: [0, 1, 1, 2], along: 11, across: 9, patterns: ["{R}'s Hoard", "The {A} Store", "{R}'s Cache"] },
        collapse: { word: "collapsed vault", count: [0, 0, 1, 2], along: 14, across: 10, patterns: ["The {A} Fall", "{R}'s Ruin", "The Fallen Arch"] },
        shrine: { word: "forgotten shrine", count: [0, 0, 1, 1], along: 13, across: 13, patterns: ["Shrine of {R}", "The {A} Altar", "Chapel of St {R}"] },
        cell: { word: "old cell", count: [0, 0, 1, 2], along: 9, across: 8, patterns: ["The {A} Cell", "{R}'s Hole", "The Oubliette"] },
        sluice: { word: "sluice gate", count: [0, 0, 1, 1], along: 11, across: 11, patterns: ["The {A} Sluice", "{N} Sluice", "The Iron Sluice"] },
        stairs: { word: "stairs down", count: [0, 0, 0, 0], along: 10, across: 8, portal: { kind: "stairs" }, patterns: ["The {A} Stair", "{R}'s Descent", "The Deep Stair"] }
      }
    },
    catacombs: {
      word: "catacombs", follows: null, channel: false, sides: [2, 2, 3, 4], loops: [0, 1, 1, 2], below: "catacombs",
      doors: { arch: 0.35, door: 0.3, locked: 0.15, barred: 0.1, secret: 0.1 },
      title: function (town) { return town ? "The Catacombs beneath " + town : "The Catacombs"; },
      portalRooms: { stairs: { word: "foot of the stairs", along: 10, across: 8 } },
      junction: { word: "crossing", r: 7.5, hubR: 10, patterns: ["The {B} Crossing", "{R}'s Cross", "The {A} Round"] },
      deadEnd: { word: "niche", along: 8, across: 7, patterns: ["The {A} Niche", "{R}'s Rest", "The {B} Niche"] },
      rooms: {
        ossuary: { word: "ossuary", count: [1, 1, 2, 2], along: 14, across: 11, patterns: ["The {A} Ossuary", "Bones of {R}", "The {S} Ossuary"] },
        tomb: { word: "tomb", count: [1, 2, 2, 3], along: 11, across: 9, patterns: ["Tomb of {R}", "The {A} Tomb", "{R}'s Rest"] },
        chapel: { word: "sunken chapel", count: [0, 1, 1, 1], along: 14, across: 14, patterns: ["Chapel of St {R}", "The {A} Chapel", "The Drowned Chapel"] },
        pit: { word: "charnel pit", count: [0, 0, 1, 1], r: 7, patterns: ["The {A} Pit", "{R}'s Pit", "The Bone Pit"] },
        hall: { word: "pillared hall", count: [0, 0, 1, 1], along: 18, across: 13, patterns: ["The {A} Hall", "Hall of {R}", "The {S} Hall"] },
        cell: { word: "hermit's cell", count: [0, 1, 1, 2], along: 8, across: 7, patterns: ["{R}'s Cell", "The {A} Cell", "The Anchorite's Cell"] },
        stairs: { word: "stairs down", count: [0, 0, 0, 0], along: 10, across: 8, portal: { kind: "stairs" }, patterns: ["The {A} Stair", "{R}'s Descent", "The Deeper Stair"] }
      }
    },
    /* the caves behind a mouth on the region map (TnDMaps.dungeon.fromRegion): no streets, no star — a CLUSTER of big
       caverns joined by short wide necks, grown inward from the mouth, every node a chamber (a convex irregular blob);
       the necks vary in width; a stream runs out of the mouth where the site has water; a shaft leads to deeper caves;
       bearings and distances are from the mouth. The "town" of a cave is the cave itself: its name and how big a system
       lies behind the mouth (small … vast, as hamlet … city) */
    /* the crypt beneath a temple and the dungeons beneath a keep: a star of short passages from the stair down, chambers
       of their own, the catacombs below; the way in is the building's stair, the reference point its foot */
    crypt: {
      word: "crypt", follows: "axis", bay: 22, entry: 10, gap: 1.5, labels: "numbers", paired: true, schemes: ["axis", "cross", "hall", "wings"], wing: "ossuary", apse: "reliquary", channel: false, sides: [0, 0, 0, 0], loops: [0, 0, 0, 0], below: "catacombs", reference: "way in",
      doors: { arch: 0.4, door: 0.3, locked: 0.15, barred: 0.05, secret: 0.1 },
      title: function (name, depth) { return depth > 1 ? "The Deep Crypt" : "The Crypt"; },   /* short: the caption says whose; the sheet is as wide as the title */
      caption: function (S) { return (S.depth > 1 ? "below " + lower(S.above.name) : S.where || "beneath the temple") + " · level −" + S.depth; },
      intro: function (S) { return S.depth > 1 ? "lies below " + lower(S.above.name) : "lies " + (S.where || "beneath the temple"); },
      portalRooms: { stairs: { word: "foot of the crypt stair", along: 9, across: 7 } },
      junction: { word: "crossing", along: 10, across: 10, r: 6.5, hubR: 10, hub: { along: 24, across: 20 }, hubWord: "pillared hall", hubMark: ["pillars", "loculi"], hubPatterns: ["The Pillared Hall", "Hall of {R}", "The {A} Hall"], patterns: ["The {B} Crossing", "{R}'s Cross", "The {A} Round"] },
      deadEnd: { word: "niche", along: 9, across: 9, patterns: ["The {A} Niche", "{R}'s Rest", "The {B} Niche"] },
      rooms: {
        tomb: { word: "tomb", count: [2, 3, 4, 6], along: 12, across: 10, mark: "sarcophagus", patterns: ["Tomb of {R}", "The {A} Tomb", "{R}'s Rest"] },
        ossuary: { word: "ossuary", count: [0, 1, 1, 2], along: 14, across: 12, mark: "loculi", patterns: ["The {A} Ossuary", "Bones of {R}", "The {S} Ossuary"] },
        chapel: { word: "lower chapel", count: [1, 1, 1, 1], along: 22, across: 16, mark: "pillars", atEnd: true, patterns: ["Chapel of St {R}", "The {A} Chapel", "The Lower Chapel"] },
        reliquary: { word: "reliquary", count: [0, 0, 1, 1], r: 5, patterns: ["The {A} Reliquary", "Shrine of {R}'s Bones", "The {S} Reliquary"] },
        stairs: { word: "stairs down", count: [0, 0, 0, 0], along: 9, across: 7, portal: { kind: "stairs" }, patterns: ["The {A} Stair", "{R}'s Descent", "The Deeper Stair"] }
      }
    },
    dungeons: {
      word: "dungeons", follows: "axis", bay: 22, entry: 22, gap: 1.5, labels: "numbers", paired: true, schemes: ["axis", "wings", "hall"], wing: "gaolers", channel: false, sides: [0, 0, 0, 0], loops: [0, 0, 0, 0], below: "catacombs", reference: "way in",
      doors: { arch: 0.15, door: 0.3, locked: 0.3, barred: 0.2, secret: 0.05 },
      title: function (name, depth) { return depth > 1 ? "The Deep Dungeons" : "The Dungeons"; },
      caption: function (S) { return (S.depth > 1 ? "below " + lower(S.above.name) : S.where || "beneath the keep") + " · level −" + S.depth; },
      intro: function (S) { return S.depth > 1 ? "lie below " + lower(S.above.name) : "lie " + (S.where || "beneath the keep"); },
      portalRooms: { stairs: { word: "foot of the stair", along: 9, across: 7 } },
      junction: { word: "guard post", along: 10, across: 10, r: 6.5, hubR: 8.5, hub: { along: 22, across: 16 }, hubWord: "guard hall", hubMark: "pillars", hubPatterns: ["The Guard Hall", "{R}'s Hall", "The {A} Hall"], patterns: ["The {B} Post", "{R}'s Watch", "The {A} Round"] },
      deadEnd: { word: "cell", along: 8, across: 8, patterns: ["{R}'s Cell", "The {A} Cell", "The {B} Cell"] },
      rooms: {
        cell: { word: "cell", count: [2, 3, 4, 6], along: 8, across: 7, patterns: ["{R}'s Cell", "The {A} Cell", "The Cold Cell"] },
        gaolers: { word: "gaolers' room", count: [1, 1, 1, 1], along: 11, across: 9, patterns: ["The {B} Guardroom", "{R}'s Post", "The Gaolers' Room"] },
        rack: { word: "rack room", count: [1, 1, 1, 1], along: 14, across: 11, atEnd: true, patterns: ["The {A} Room", "The Questioning Room", "{R}'s Rack"] },
        oubliette: { word: "oubliette", count: [0, 1, 1, 1], r: 5, patterns: ["The {A} Hole", "{R}'s Oubliette", "The Forgotten Pit"] },
        strongroom: { word: "strongroom", count: [0, 0, 1, 1], along: 9, across: 8, patterns: ["The {A} Strongroom", "{R}'s Vault", "The Lord's Treasury"] },
        cistern: { word: "cistern", count: [0, 1, 1, 1], r: 6, patterns: ["The {A} Cistern", "{R}'s Well", "The Black Cistern"] },
        stairs: { word: "stairs down", count: [0, 0, 0, 0], along: 9, across: 7, portal: { kind: "stairs" }, patterns: ["The {A} Stair", "{R}'s Descent", "The Deeper Stair"] }
      }
    },
    cave: {
      word: "caves", follows: "cluster", channel: "stream", sides: [2, 3, 4, 5], loops: [1, 2, 3, 4], below: "cave", shape: "cavern", natural: true, reference: "way in",
      doors: { arch: 0.92, secret: 0.08 },
      title: function (name, depth) { return !name ? "The Caves" : depth > 1 ? "The Deeps of " + lower(name) : name; },
      caption: function (S) { return (S.depth > 1 ? "below " + lower(S.above.name) : S.where || "a cave") + " · level −" + S.depth; },
      intro: function (S) { return S.depth > 1 ? "lie below " + lower(S.above.name) : "runs into the rock" + (S.where ? " — " + S.where : ""); },
      words: { main: "main passage", side: "side passage" }, waterLine: "A stream runs down the main passage and out of the mouth.",
      portalRooms: { cave: { word: "cave mouth", r: 12 }, shaft: { word: "foot of the shaft", r: 10 } },
      junction: { word: "chamber", r: 10, hubR: 15, patterns: ["The {B} Chamber", "{R}'s Hollow", "The {A} Chamber"] },
      deadEnd: { word: "cleft", r: 6.5, patterns: ["The {A} Cleft", "{R}'s Crack", "The {B} Cleft"] },
      rooms: {
        cavern: { word: "cavern", count: [1, 1, 2, 3], r: 17, patterns: ["The {A} Cavern", "Hall of {R}", "{R}'s Cavern"] },
        grotto: { word: "grotto", count: [1, 1, 2, 2], r: 9, water: 0.28, patterns: ["The {A} Grotto", "{R}'s Grotto", "The Hidden Grotto"] },
        pool: { word: "cave pool", count: [0, 1, 1, 2], r: 10, water: 0.55, patterns: ["The {A} Pool", "{R}'s Mere", "The Still Pool"] },
        nest: { word: "beast's nest", count: [1, 1, 1, 2], r: 11, patterns: ["Nest of the {S}", "The {S}'s Den", "The {A} Nest"] },
        bones: { word: "bone-strewn chamber", count: [0, 0, 1, 1], r: 8, patterns: ["The {A} Bones", "Pit of {R}", "The Gnawed Hollow"] },
        gallery: { word: "gallery", count: [0, 1, 1, 2], along: 26, across: 10, patterns: ["The {A} Gallery", "{R}'s Gallery", "The Long Gallery"] },
        shaft: { word: "shaft down", count: [0, 0, 0, 0], r: 6.5, portal: { kind: "shaft" }, patterns: ["The {A} Shaft", "{R}'s Drop", "The Black Shaft"] }
      }
    }
  };
  function lower(name) { return String(name || "").replace(/^The /, "the "); }   /* "The Deeps of the Red Hollow" */
  /* the words of a site that has none of its own: how it is captioned and introduced, what its passages are called */
  function captionOf(S) { var SITE = SITES[S.kind]; return SITE.caption ? SITE.caption(S) : (S.town.name || "the town") + " · level −" + S.depth; }
  function introOf(S) { var SITE = SITES[S.kind]; return SITE.intro ? SITE.intro(S) : S.above.generator === "dungeon" ? "lie below " + S.above.name : S.town.name ? "lie beneath " + S.town.name + (SITE.follows === "streets" ? ", following its streets" : "") : "lie beneath the town"; }
  /* the EXTRA kinds on every site's shelf at count 0 — the rooms an author asks for by hand (an antechamber onto a
     chamber, a guardroom by the stair) — rows of the Chambers list like any other kind; dealt AFTER the site's own
     kinds (below), so putting them on the shelf moved no chamber of an existing map */
  var EXTRA_ROOMS = {
    antechamber: { word: "antechamber", count: [0, 0, 0, 0], along: 8, across: 7, extra: true, patterns: ["The {A} Antechamber", "{R}'s Anteroom", "The Outer Room"] },
    prison: { word: "prison cell", count: [0, 0, 0, 0], along: 7, across: 6, extra: true, patterns: ["The {A} Cell", "{R}'s Cage", "The Black Cell"] },
    guardroom: { word: "guardroom", count: [0, 0, 0, 0], along: 10, across: 8, extra: true, patterns: ["The {A} Guardroom", "{R}'s Watch", "The Warders' Room"] },
    treasury: { word: "treasury", count: [0, 0, 0, 0], along: 10, across: 9, extra: true, patterns: ["The {A} Treasury", "{R}'s Strongroom", "The Counting Room"] },
    armoury: { word: "armoury", count: [0, 0, 0, 0], along: 11, across: 8, extra: true, patterns: ["The {A} Armoury", "{R}'s Racks", "The Old Armoury"] },
    barracks: { word: "barracks", count: [0, 0, 0, 0], along: 16, across: 10, extra: true, patterns: ["The {A} Barracks", "{R}'s Billet", "The Long Barracks"] },
    kitchen: { word: "kitchen", count: [0, 0, 0, 0], along: 11, across: 9, extra: true, patterns: ["The {A} Kitchen", "{R}'s Hearth", "The Smoke Kitchen"] },
    well: { word: "well", count: [0, 0, 0, 0], r: 5, extra: true, patterns: ["The {A} Well", "{R}'s Well", "The Deep Well"] },
    lair: { word: "lair", count: [0, 0, 0, 0], r: 12, extra: true, patterns: ["The {S} Lair", "{R}'s Lair", "The {A} Lair"] },
    crypt: { word: "crypt", count: [0, 0, 0, 0], along: 13, across: 10, extra: true, patterns: ["Crypt of {R}", "The {A} Crypt", "The Family Crypt"] }
  };
  Object.keys(SITES).forEach(function (s) { Object.keys(EXTRA_ROOMS).forEach(function (k) { NS.assert(!SITES[s].rooms[k], "the extra room kind " + k + " clashes with the " + s + " catalogue", { site: s, kind: k }); SITES[s].rooms[k] = EXTRA_ROOMS[k]; }); });
  var DEFAULTS = { seed: null, width: 1600, height: 1100, culture: "common", title: null, site: {}, rooms: {}, edits: [] };
  /* site: kind, town {name, size}, portals [{id, kind, name, x, y, way?}] (the ways in from above and out; `way:
     "down"` PINS a stair down at that spot with that id — a fixed point the spine reaches, so the level below keeps
     its way up when this level is rerolled), streets [{kind,
     pts}] to follow, centre, radius, walls (chains to draw faintly above: the town's wall, or the level above's
     tunnels), river ([x, y, w] points), mPerUnit, above {generator: town|dungeon, site?, name} — what the ways up lead
     to —, depth (how many levels below the surface this one lies: the sewers 1, the level beneath them 2, …) */
  var SITE_KEYS = ["kind", "town", "portals", "streets", "centre", "radius", "walls", "river", "mPerUnit", "above", "depth", "where", "water", "heading", "sea"];
  /* where (a cave: "a cave in the hillside 12 km NE of Ashford, facing S", the caption and the digest's words), water (a cave with a stream), heading (a bearing: the way the wandering spine sets off from the first way in — into the rock) */
  var BEARINGS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  function dirOf(bearing) { var a = BEARINGS.indexOf(bearing) * Math.PI / 4; return [Math.sin(a), -Math.cos(a)]; }

  function roundPts(pts) { return pts.map(function (p) { return p.length > 2 ? [U.round(p[0], 1), U.round(p[1], 1), U.round(p[2], 2)] : [U.round(p[0], 1), U.round(p[1], 1)]; }); }
  function key(p) { return Math.round(p[0] * 10) + "," + Math.round(p[1] * 10); }
  function jit(label, salt) { return (NS.hash32(label, salt) % 1000) / 1000; }
  function rect(c, angle, along, across) {
    var ca = Math.cos(angle), sa = Math.sin(angle), hx = along / 2, hy = across / 2;
    return [[-hx, -hy], [hx, -hy], [hx, hy], [-hx, hy]].map(function (p) { return [c[0] + p[0] * ca - p[1] * sa, c[1] + p[0] * sa + p[1] * ca]; });
  }
  function octagon(c, r, angle) { var out = [], k, a; for (k = 0; k < 8; k++) { a = angle + Math.PI / 8 + k * Math.PI / 4; out.push([c[0] + Math.cos(a) * r, c[1] + Math.sin(a) * r]); } return out; }
  /* the convex hull of a few points (Andrew's monotone chain), counter-clockwise in screen coordinates */
  function hull(pts) {
    var P = pts.slice().sort(function (a, b) { return a[0] - b[0] || a[1] - b[1]; }), lower = [], upper = [], i;
    function cross(o, a, b) { return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]); }
    for (i = 0; i < P.length; i++) { while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], P[i]) <= 0) lower.pop(); lower.push(P[i]); }
    for (i = P.length - 1; i >= 0; i--) { while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], P[i]) <= 0) upper.pop(); upper.push(P[i]); }
    lower.pop(); upper.pop(); return lower.concat(upper);
  }
  /* a natural chamber: twelve points around an ellipse along × across, each nudged in angle and radius from the seed by
     the room's id, then their convex hull — so every cavern is its own shape and still convex (the overlap tests, the
     grid and the annex walls all rely on convex floors) */
  function blob(c, angle, along, across, label) {
    var n = 12, pts = [], k, a, f, x, y, ca = Math.cos(angle), sa = Math.sin(angle), rx = along / 2, ry = across / 2;
    for (k = 0; k < n; k++) {
      a = (k + (jit(label + "/b" + k, 31) - 0.5) * 0.7) * 2 * Math.PI / n; f = 0.78 + 0.32 * jit(label + "/c" + k, 37);
      x = Math.cos(a) * rx * f; y = Math.sin(a) * ry * f; pts.push([c[0] + x * ca - y * sa, c[1] + x * sa + y * ca]);
    }
    var h = hull(pts), out = [], i, p, q, r, abx, aby, bcx, bcy, cr;
    for (i = 0; i < h.length; i++) {   /* a turn under some 4° is dropped: rounded to 0.1, it could read as a dent, and a cavern must stay convex */
      p = h[(i + h.length - 1) % h.length]; q = h[i]; r = h[(i + 1) % h.length]; abx = q[0] - p[0]; aby = q[1] - p[1]; bcx = r[0] - q[0]; bcy = r[1] - q[1];
      cr = Math.abs(abx * bcy - aby * bcx) / ((Math.sqrt(abx * abx + aby * aby) || 1) * (Math.sqrt(bcx * bcx + bcy * bcy) || 1));
      if (cr >= 0.07) out.push(q);
    }
    return out.length >= 5 ? out : h;
  }
  /* the polygon of a chamber shape K at c, turned by angle: a rectangle along × across, an octagon of radius r, or a
     cavern (K.blob) along × across seeded by K.sid */
  function polyOf(K, c, angle) { return K.blob ? blob(c, angle, K.along, K.across, K.sid || "") : K.r ? octagon(c, K.r, angle) : rect(c, angle, K.along, K.across); }
  /* two convex polygons closer than `margin` (separating-axis test with a margin) */
  function polyNear(A, B, margin) {
    var polys = [A, B], k, P, i, a, b, nx, ny, l, pa, pb;
    function proj(Q, x, y) { var lo = Infinity, hi = -Infinity, j, v; for (j = 0; j < Q.length; j++) { v = Q[j][0] * x + Q[j][1] * y; if (v < lo) lo = v; if (v > hi) hi = v; } return [lo, hi]; }
    for (k = 0; k < 2; k++) {
      P = polys[k];
      for (i = 0; i < P.length; i++) {
        a = P[i]; b = P[(i + 1) % P.length]; nx = -(b[1] - a[1]); ny = b[0] - a[0]; l = Math.sqrt(nx * nx + ny * ny) || 1; nx /= l; ny /= l;
        pa = proj(A, nx, ny); pb = proj(B, nx, ny);
        if (pa[1] + margin <= pb[0] || pb[1] + margin <= pa[0]) return false;
      }
    }
    return true;
  }
  /* the distance from a segment to a convex polygon (0 when they meet) */
  function segPolyDist(p, q, poly) {
    var n = poly.length, i, d = Infinity, a, b;
    if (G.pointInPolygon(p, poly) || G.pointInPolygon(q, poly)) return 0;
    for (i = 0; i < n; i++) {
      a = poly[i]; b = poly[(i + 1) % n];
      if (M.segIntersect(p, q, a, b)) return 0;
      d = Math.min(d, G.pointSegDist(a, p, q), G.pointSegDist(p, a, b), G.pointSegDist(q, a, b));
    }
    return d;
  }

  /* ── the author's parameters ── */
  function isPoint(at) { return Array.isArray(at) && at.length === 2 && isFinite(at[0]) && isFinite(at[1]); }
  function siteOf(siteKind) { var SITE = NS.own(SITES, siteKind || "sewer"); NS.assert(SITE, "site kind must be one of " + Object.keys(SITES).join("|"), { kind: siteKind }); return SITE; }
  function validateCounts(counts, siteKind) {
    var SITE = siteOf(siteKind), k;
    NS.assert(counts && typeof counts === "object" && !Array.isArray(counts), "rooms must be an object of kind → count", { rooms: counts });
    for (k in counts) if (Object.prototype.hasOwnProperty.call(counts, k)) {
      NS.assert(NS.own(SITE.rooms, k), "rooms: unknown chamber kind", { kind: k, known: Object.keys(SITE.rooms) });
      NS.assert(U.isNum(counts[k]) && counts[k] >= 0 && counts[k] <= MAX_COUNT && counts[k] === Math.floor(counts[k]), "rooms." + k + " must be an integer in [0, " + MAX_COUNT + "]", { value: counts[k] });
    }
    return counts;
  }
  function validateShape(e, i) {
    NS.assert(e.footprint === undefined || NS.own(FOOTPRINTS, e.footprint), "edits[" + i + "]: footprint must be one of " + Object.keys(FOOTPRINTS).join("|"), { footprint: e.footprint });
    NS.assert(e.size === undefined || (Array.isArray(e.size) && (e.size.length === 1 || e.size.length === 2) && e.size.every(function (v) { return U.isNum(v) && v >= SIZE_M[0] && v <= SIZE_M[1]; })), "edits[" + i + "]: size must be metres — [along, across] for a rectangle or [across] for a round chamber, each in [" + SIZE_M[0] + ", " + SIZE_M[1] + "]", { size: e.size });
    NS.assert(e.shape === undefined || NS.own(SHAPES, e.shape), "edits[" + i + "]: shape must be one of " + Object.keys(SHAPES).join("|"), { shape: e.shape });
  }
  function validateEdits(edits, frame, siteKind) {
    var SITE = siteOf(siteKind), ids = {};
    NS.assert(Array.isArray(edits), "edits must be an array", { edits: edits });
    edits.forEach(function (e, i) {
      NS.assert(e && typeof e === "object" && NS.own(OPS, e.op), "edits[" + i + "].op must be one of " + Object.keys(OPS).join("|"), { edit: e });
      NS.assert(typeof e.id === "string" && e.id.length > 0, "edits[" + i + "] needs a string id", { edit: e });
      if (e.op === "add") {
        NS.assert(NS.own(SITE.rooms, e.kind) || e.kind === CUSTOM, "edits[" + i + "]: unknown chamber kind", { kind: e.kind, known: Object.keys(SITE.rooms).concat([CUSTOM]) });
        NS.assert(!ids[e.id], "edits[" + i + "]: a chamber with id " + e.id + " is already added", { id: e.id }); ids[e.id] = true;
        NS.assert(!GENERATED_ID.test(e.id), "edits[" + i + "]: authored ids must not look like generated ones (kind-n)", { id: e.id });
        if (e.kind === CUSTOM) NS.assert(typeof e.word === "string" && e.word.trim().length > 0 && e.word.length <= MAX_WORD, "edits[" + i + "]: a custom chamber needs a word of 1–" + MAX_WORD + " characters (what it is)", { edit: e });
        validateShape(e, i);
        NS.assert(isPoint(e.at), "edits[" + i + "]: add needs at: [x, y] (a point beside a passage, or at a dead end)", { edit: e });
        NS.assert(e.name === undefined || e.name === null || (typeof e.name === "string" && e.name.length <= MAX_NAME), "edits[" + i + "]: name must be a string of at most " + MAX_NAME + " characters", { edit: e });
      }
      if (e.op === "move") NS.assert(isPoint(e.at), "edits[" + i + "]: move needs at: [x, y]", { edit: e });
      if ((e.op === "add" || e.op === "move") && e.onto !== undefined && e.onto !== null) NS.assert(typeof e.onto === "object" && typeof e.onto.id === "string" && e.onto.id.length > 0 && U.isNum(e.onto.wall) && e.onto.wall >= 0 && e.onto.wall === Math.floor(e.onto.wall) && U.isNum(e.onto.t) && e.onto.t >= 0 && e.onto.t <= 1, "edits[" + i + "]: onto must be {id, wall, t} — the chamber it is built onto, the wall counted from that chamber's doorway (a whole number from 0) and how far along it (0 to 1)", { edit: e });
      if (e.op === "rename") NS.assert(typeof e.name === "string" && e.name.trim().length > 0 && e.name.length <= MAX_NAME, "edits[" + i + "]: rename needs a name of 1–" + MAX_NAME + " characters", { edit: e });
      if (e.op === "note") NS.assert(typeof e.note === "string" && e.note.length <= MAX_NOTE, "edits[" + i + "]: note needs a string of at most " + MAX_NOTE + " characters (empty clears it)", { edit: e });
      if (e.op === "reshape") { validateShape(e, i); NS.assert(e.size !== undefined || e.footprint !== undefined || e.shape !== undefined, "edits[" + i + "]: reshape needs a size, a shape or both", { edit: e }); }
      if (e.op === "door") NS.assert(NS.own(DOOR_STATES, e.state), "edits[" + i + "]: door needs a state, one of " + Object.keys(DOOR_STATES).join("|"), { edit: e });
      if (frame && isPoint(e.at)) NS.assert(e.at[0] >= 0 && e.at[1] >= 0 && e.at[0] <= frame.width && e.at[1] <= frame.height, "edits[" + i + "]: at lies outside the map frame", { at: e.at });
    });
    return edits;
  }

  /* ── parameters ── */
  function resolveParams(input) {
    var P = U.extend({}, DEFAULTS, input || {}), k, S, SITE;
    for (k in input || {}) if (Object.prototype.hasOwnProperty.call(input, k) && !Object.prototype.hasOwnProperty.call(DEFAULTS, k)) NS.fail("unknown parameter", { param: k, known: Object.keys(DEFAULTS) });
    NS.assert(P.seed !== null && P.seed !== undefined && String(P.seed).length > 0, "seed is required (a string or number)", { seed: P.seed });
    function num(name, lo, hi) { NS.assert(U.isNum(P[name]) && P[name] >= lo && P[name] <= hi, name + " must be a number in [" + lo + ", " + hi + "]", { value: P[name] }); }
    num("width", SHEET.min, SHEET.max); num("height", SHEET.min, SHEET.max);
    NS.assert(NS.own(NS.names.CULTURES, P.culture), "culture must be one of " + NS.names.cultures().join("|"), { culture: P.culture });
    NS.assert(P.title === null || typeof P.title === "string", "title must be a string or null", { title: P.title });
    NS.assert(P.site && typeof P.site === "object" && !Array.isArray(P.site), "site must be an object", { site: P.site });
    S = U.extend({}, P.site);
    for (k in S) if (Object.prototype.hasOwnProperty.call(S, k) && SITE_KEYS.indexOf(k) < 0) NS.fail("unknown site key", { key: k, known: SITE_KEYS });
    S.kind = S.kind || "sewer";
    NS.assert(NS.own(SITES, S.kind), "site.kind must be one of " + Object.keys(SITES).join("|"), { kind: S.kind });
    SITE = SITES[S.kind];
    S.town = U.extend({ name: null, size: "town" }, S.town || {});
    NS.assert(NS.own(SIZE_INDEX, S.town.size) !== undefined, "site.town.size must be one of " + Object.keys(SIZE_INDEX).join("|"), { size: S.town.size });
    NS.assert(S.town.name === null || typeof S.town.name === "string", "site.town.name must be a string or null", { name: S.town.name });
    NS.assert(Array.isArray(S.portals) && S.portals.length >= 1, "site.portals must list at least one way in ({id, kind: " + Object.keys(SITE.portalRooms).join("|") + ", name, x, y}) — TnDMaps.dungeon.fromTown or fromDungeon builds it from the parent document", { portals: S.portals });
    var ids = {};
    S.portals.forEach(function (p, i) {
      NS.assert(p && typeof p.id === "string" && p.id.length && !ids[p.id], "site.portals[" + i + "] needs a unique string id", { portal: p });
      NS.assert(p.way === undefined || p.way === "up" || p.way === "down", "site.portals[" + i + "].way must be up or down", { portal: p });
      if (p.way === "down") NS.assert(SITE.rooms[p.kind] && SITE.rooms[p.kind].portal, "site.portals[" + i + "]: a way down must be a chamber kind that leads down (" + Object.keys(SITE.rooms).filter(function (k) { return SITE.rooms[k].portal; }).join("|") + ")", { portal: p });
      else NS.assert(SITE.portalRooms[p.kind], "site.portals[" + i + "].kind must be one of " + Object.keys(SITE.portalRooms).join("|") + " (what the " + SITE.word + " take from above)", { portal: p });
      NS.assert(isFinite(p.x) && isFinite(p.y) && p.x >= 0 && p.y >= 0 && p.x <= P.width && p.y <= P.height, "site.portals[" + i + "] lies outside the map frame", { portal: p });
      NS.assert(p.name === undefined || p.name === null || typeof p.name === "string", "site.portals[" + i + "].name must be a string or null", { portal: p });
      ids[p.id] = true;
    });
    S.portals = S.portals.map(function (p) { return { id: p.id, kind: p.kind, name: p.name || null, x: p.x, y: p.y, way: p.way === "down" ? "down" : "up" }; });
    S.streets = S.streets || [];
    NS.assert(Array.isArray(S.streets), "site.streets must be an array of {kind, pts: [[x, y], [x, y]]}", { streets: S.streets });
    S.streets.forEach(function (s, i) { NS.assert(s && Array.isArray(s.pts) && s.pts.length === 2 && s.pts.every(function (q) { return isFinite(q[0]) && isFinite(q[1]); }), "site.streets[" + i + "] must have two points", { street: s }); });
    S.centre = S.centre || [P.width / 2, P.height / 2];
    NS.assert(Array.isArray(S.centre) && isFinite(S.centre[0]) && isFinite(S.centre[1]), "site.centre must be [x, y]", { centre: S.centre });
    S.radius = S.radius || Math.min(P.width, P.height) * 0.26;
    S.walls = S.walls || []; S.river = S.river || null;
    S.mPerUnit = S.mPerUnit || M_PER_UNIT;
    NS.assert(U.isNum(S.mPerUnit) && S.mPerUnit > 0, "site.mPerUnit must be a positive number", { mPerUnit: S.mPerUnit });
    S.above = U.extend({ generator: "town", site: null, name: S.town.name }, S.above || {});
    S.where = S.where === undefined ? null : S.where; S.water = !!S.water; S.sea = !!S.sea; S.heading = S.heading === undefined ? null : S.heading;
    NS.assert(S.where === null || typeof S.where === "string", "site.where must be a string or null", { where: S.where });
    NS.assert(S.heading === null || BEARINGS.indexOf(S.heading) >= 0, "site.heading must be a bearing (" + BEARINGS.join("|") + ") or null", { heading: S.heading });
    S.depth = S.depth === undefined || S.depth === null ? 1 : S.depth;
    NS.assert(U.isNum(S.depth) && S.depth >= 1 && S.depth === Math.floor(S.depth), "site.depth must be a whole number of levels below the surface, 1 or more", { depth: S.depth });
    NS.assert(S.above.generator === "town" || S.above.generator === "dungeon" || S.above.generator === "region" || S.above.generator === "interior", "site.above.generator must be town, dungeon, region or interior", { above: S.above });
    NS.assert(S.above.site === null || NS.own(SITES, S.above.site) || (S.above.generator === "interior" && typeof S.above.site === "string"), "site.above.site must be a dungeon site kind (or, above a building, its kind) or null", { above: S.above });
    validateCounts(P.rooms, S.kind); validateEdits(P.edits, { width: P.width, height: P.height }, S.kind);
    P.site = S; P.seed = String(P.seed);
    return P;
  }

  /* ── the line graph the spine walks: vertices by rounded position, edges with a kind; attach() splits an edge at
     the foot of a point so a grate in the middle of a street becomes a vertex */
  function Graph() {
    var verts = [], byKey = {}, edges = [], adj = [];
    function vertex(p) { var k = key(p); if (byKey[k] === undefined) { byKey[k] = verts.length; verts.push([p[0], p[1]]); adj.push([]); } return byKey[k]; }
    function edge(a, b, kind, w) {
      if (a === b) return null;
      var e = { id: edges.length, a: a, b: b, kind: kind, w: w || null, len: G.dist(verts[a], verts[b]), dead: false };
      edges.push(e); adj[a].push(e.id); adj[b].push(e.id); return e;
    }
    function kill(e) { e.dead = true; adj[e.a] = adj[e.a].filter(function (id) { return id !== e.id; }); adj[e.b] = adj[e.b].filter(function (id) { return id !== e.id; }); }
    function attach(p, tol) {
      var best = null, bd = tol, i, e, a, b, dx, dy, l2, t, q, d;
      for (i = 0; i < edges.length; i++) {
        e = edges[i]; if (e.dead) continue; a = verts[e.a]; b = verts[e.b]; dx = b[0] - a[0]; dy = b[1] - a[1]; l2 = dx * dx + dy * dy || 1;
        t = U.clamp(((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2, 0, 1); q = [a[0] + dx * t, a[1] + dy * t]; d = G.dist(p, q);
        if (d < bd) { bd = d; best = { e: e, q: q }; }
      }
      if (!best) return null;
      if (G.dist(best.q, verts[best.e.a]) < 1.5) return best.e.a;
      if (G.dist(best.q, verts[best.e.b]) < 1.5) return best.e.b;
      var v = vertex(best.q); if (v === best.e.a || v === best.e.b) return v;
      kill(best.e); edge(best.e.a, v, best.e.kind, best.e.w); edge(v, best.e.b, best.e.kind, best.e.w);
      return v;
    }
    function nearest(p, except) { var best = null, bd = Infinity, i, d; for (i = 0; i < verts.length; i++) { if (i === except || !adj[i].length) continue; d = G.dist(verts[i], p); if (d < bd) { bd = d; best = i; } } return best; }
    return { verts: verts, edges: edges, adj: adj, vertex: vertex, edge: edge, attach: attach, nearest: nearest };
  }
  function dijkstra(gr, sources, cost, isTarget) {
    var dist = {}, prev = {}, prevEdge = {}, heap = U.Heap(function (a, b) { return a.d < b.d; }), cur, i, e, to, nd, target = null;
    sources.forEach(function (s) { dist[s] = 0; prev[s] = null; prevEdge[s] = null; heap.push({ v: s, d: 0 }); });
    while (heap.size()) {
      cur = heap.pop(); if (cur.d > dist[cur.v]) continue;
      if (isTarget(cur.v)) { target = cur.v; break; }
      for (i = 0; i < gr.adj[cur.v].length; i++) {
        e = gr.edges[gr.adj[cur.v][i]]; if (e.dead) continue;
        to = e.a === cur.v ? e.b : e.a; nd = cur.d + cost(e);
        if (dist[to] === undefined || nd < dist[to]) { dist[to] = nd; prev[to] = cur.v; prevEdge[to] = e.id; heap.push({ v: to, d: nd }); }
      }
    }
    return { dist: dist, prev: prev, prevEdge: prevEdge, target: target };
  }
  function pathEdges(res, t) { var out = []; while (res.prev[t] !== null && res.prev[t] !== undefined) { out.push(res.prevEdge[t]); t = res.prev[t]; } return out; }

  /* no streets to follow (the catacombs, a dungeon made by hand): a star of bent corridors from the centre to each
     way in — and three or four arms in all, so one stair still opens onto a level with some body: the extra arms' far
     ends are returned as `ends`, and the spine is walked from them too —, each leg split where a lane leaves it so
     the side-passage walk can take the lane; the same walk runs over them */
  function syntheticStreets(S, rng, arms) {
    var c = S.centre, out = [], spokes = [], ends = [], ang = [], k, gap, best, bi, a;
    S.portals.forEach(function (p) { if (PORTAL_KINDS[p.kind] === "in") spokes.push([p.x, p.y]); });
    spokes.forEach(function (p) { ang.push(Math.atan2(p[1] - c[1], p[0] - c[0])); });
    while (spokes.length < arms) {   /* the widest angular gap gets an arm of its own */
      ang.sort(function (x, y) { return x - y; }); best = -1; bi = 0;
      for (k = 0; k < ang.length; k++) { gap = (k + 1 < ang.length ? ang[k + 1] : ang[0] + 2 * Math.PI) - ang[k]; if (gap > best) { best = gap; bi = k; } }
      a = ang[bi] + best / 2;
      var len = S.radius * (0.6 + rng.float() * 0.3), p = [U.clamp(c[0] + Math.cos(a) * len, 40, S.width - 40), U.clamp(c[1] + Math.sin(a) * len, 40, S.height - 40)];
      spokes.push(p); ends.push(p); ang.push(Math.atan2(p[1] - c[1], p[0] - c[0]));
    }
    spokes.forEach(function (p, i) {
      var dx = p[0] - c[0], dy = p[1] - c[1], l = Math.sqrt(dx * dx + dy * dy) || 1, nx = -dy / l, ny = dx / l, side = (i % 2 ? 1 : -1) * (0.12 + rng.float() * 0.1) * l;
      var bend = [c[0] + dx * 0.5 + nx * side, c[1] + dy * 0.5 + ny * side], legs = [[c, bend], [bend, p]];
      legs.forEach(function (leg) {
        var ex = leg[1][0] - leg[0][0], ey = leg[1][1] - leg[0][1], el = Math.sqrt(ex * ex + ey * ey) || 1, sx = -ey / el, sy = ex / el, t = 0.35 + rng.float() * 0.3, m = [leg[0][0] + ex * t, leg[0][1] + ey * t], s = (rng.chance(0.5) ? 1 : -1) * (24 + rng.float() * 16);
        out.push({ kind: "main", pts: [leg[0], m] }); out.push({ kind: "main", pts: [m, leg[1]] });
        out.push({ kind: "lane", pts: [m, [m[0] + sx * s, m[1] + sy * s]] });
      });
    });
    return { lines: out, ends: ends };
  }

  /* a cave: the spine is a CLUSTER of caverns — SCATTERED first, connected after. A field lies ahead of the mouth (an
     ellipse along the heading, longer than it is wide); caverns of varied size are dropped into it from the seed, each
     at least seven tenths of a cavern's width from the next (so two may overlap a little: lobes of one hall), until
     the size's count is met. Then the necks: the Delaunay neighbours of the centres, a spanning tree of the shortest
     gaps so every cavern is reached, every pair that all but touches, and a few more short ones as loops — planar by
     construction, so no neck crosses another. The entrance cavern lies in from the mouth and is one of the field's;
     the hub is the cavern farthest from it by necks; the necks from the entrance to the hub are main passages (5–7 m
     wide), the rest side ones (3.5–5 m). Returns the lines, the hub and the nodes [{c, r, depth}]. */
  var SCATTER = [5, 8, 12, 17], REACH = [80, 115, 150, 185], NECK_MAX = 28, TOUCH = 8, CLUSTER_MARGIN = 80;   /* caverns per size; the field's half-length ahead of the entrance; a neck at most 14 m; a gap under 4 m is as good as touching */
  /* a MAN-MADE plan (`follows: "axis"` — a crypt, the dungeons): the way in at the head of an AXIS that runs straight
     into the rock, snapped to the frame's directions — a crossing one module along, the hall (the hub) two or three
     modules further with a crossing before it, a short run on beyond to a far chamber; the crossings' arms reach a
     module or more each way (every one main) and, from the second size up, an ambulatory joins their ends along the
     axis round the hall; short stubs off the axis between the crossings and beyond the hall are the side passages'
     lines. Everything on the two directions of the stair, so the plan reads as built, not dug */
  /* the plan of a BUILT place (a crypt, the dungeons): straight corridors on the stair's two directions, snapped to the
     frame's, in one of the site's SCHEMES — each a shape from the reference plans, dealt from the seed with a left or
     right hand (`flip`), so no two crypts are the one plan. What the five references share, and the schemes keep:
       — no corridor ever closes a loop round rock: a corridor ends in a chamber, or turns through one (a CORNER
         chamber, the corridors running into it on two walls) and goes on to end in another;
       — corridors are short connectors, a bay or two long, between chambers; the plan is rooms, not passages;
       — nothing mirrors: the two hands differ in kind (a wing on one, a short arm on the other), the arms differ in
         length, the far run JOGS to one hand so the chapel stands off the axis;
       — one or two great rooms and several small ones, of different shapes: the hall, the great chamber, round apses.
       axis   — entry, the antechamber (a square crossing), the HALL with the axis through it, a second crossing, the
                jogged run to the chapel; the antechamber's long arm turns through a corner chamber and runs beside the
                hall to a chamber at its end, its short arm and the second crossing's end in chambers;
       cross  — the hall is a crossing of wide transepts of unequal length, the longer into the apse (`apse`: the
                round reliquary), the other into a chamber, the chapel beyond; an antechamber with chambers off its arms,
                a second crossing when the size has the chambers for it (`need`, the catalogue's count for the size);
       hall   — one long hall from the stair, the loculi down both flanks; out of its near end on one hand a corridor
                turns through a corner chamber and runs along the hall to a chamber at the far end (a second out of
                the far end on the other hand, back, when the size has the chambers), the chapel beyond, jogged;
       wings  — the hall at the crossing; on one hand the antechamber's arm turns and runs beside the hall with the
                chambers in two files, on the other a wide short way into the great chamber (the site's `wing` kind:
                the ossuary); short arms into chambers, the chapel beyond, jogged.
     A scheme draws LINES (corridors, with their width when not the main one), names the corridors' ENDS where a
     chamber stands in line with the corridor that runs into it (`only` reserves an end for a kind), and its CORNERS.
     The chambers stand in BAYS — the free run of a corridor between what stands at its ends, split into as many bays
     of the site's `bay` as it holds, one pair of chambers to a bay. The hub is the hall; a scheme gives its shape. */
  var SCHEMES = {
    axis: function (X) {
      var hub = X.hub, hh = hub.along / 2, aT = X.sh + X.entry + X.jh, hT = aT + X.jh + X.bay + hh, bT = hT + hh + X.bay + X.jh, al = X.jh + 9, s = X.flip;
      X.line(X.P(0, 0), X.P(aT, 0), "main", X.sh, X.jh);   /* the entry */
      X.line(X.P(aT, 0), X.P(hT, 0), "main", X.jh, hh);   /* the antechamber to the hall */
      X.line(X.P(hT, 0), X.P(bT, 0), "main", hh, X.jh);   /* the hall to the far crossing */
      X.jog(bT, -s);   /* the run to the chapel, jogged off the axis */
      X.elbow(aT, s, X.ringArm(hub) + 3, bT - aT - 4, X.jh);   /* the antechamber's long arm: a corner chamber, a bay beside the hall, a chamber at the end */
      X.end(X.line(X.P(aT, 0), X.P(aT, -s * al), "main", X.jh, 99), X.P(aT, -s * al), X.side(-s));   /* its short arm ends in a chamber */
      X.end(X.line(X.P(bT, 0), X.P(bT, -s * al), "main", X.jh, 99), X.P(bT, -s * al), X.side(-s));   /* the far crossing's arm, on the short hand only (the long hand's run ends beside it) */
      if (X.need > 8) X.end(X.line(X.P(bT, 0), X.P(bT, s * al), "main", X.jh, 99), X.P(bT, s * al), X.side(s));
      return { hub: X.P(hT, 0), hubShape: hub };
    },
    cross: function (X) {
      var hub = { along: 18, across: 18 }, hh = 9, aT = X.sh + X.entry + X.jh, hT = aT + X.jh + X.bay + hh, tl = hh + 15, more = X.need > 6, bT = more ? hT + hh + X.bay + X.jh : hT, eT = (more ? bT + X.jh : hT + hh) + 8, al = X.jh + 9, s = X.flip;
      X.line(X.P(0, 0), X.P(aT, 0), "main", X.sh, X.jh);
      X.line(X.P(aT, 0), X.P(hT, 0), "main", X.jh, hh);
      [1, -1].forEach(function (h) { X.end(X.line(X.P(aT, 0), X.P(aT, h * al), "main", X.jh, 99), X.P(aT, h * al), X.side(h)); });   /* the antechamber's arms end in chambers */
      X.end(X.line(X.P(hT, 0), X.P(hT, s * (tl + 8)), "main", hh, 99, 8), X.P(hT, s * (tl + 8)), X.side(s), X.apse);   /* the long transept, 4 m wide, into the apse */
      X.end(X.line(X.P(hT, 0), X.P(hT, -s * tl), "main", hh, 99, 8), X.P(hT, -s * tl), X.side(-s));   /* the short one into a chamber */
      if (more) { X.line(X.P(hT, 0), X.P(bT, 0), "main", hh, X.jh); [1, -1].forEach(function (h) { X.end(X.line(X.P(bT, 0), X.P(bT, h * al), "main", X.jh, 99), X.P(bT, h * al), X.side(h)); }); }
      X.far(X.line(X.P(more ? bT : hT, 0), X.P(eT, 0), "side", 0, 0), X.P(eT, 0));   /* the chapel on the axis: a cross keeps its axis */
      return { hub: X.P(hT, 0), hubShape: hub };
    },
    hall: function (X) {
      var hub = { along: X.si >= 3 ? 56 : 44, across: 20 }, hh = hub.along / 2, hT = X.sh + X.entry + hh, nT = hT - hh + 4, fT = hT + hh - 4, cT = hT + hh + 8 + X.jh, s = X.flip, arm = X.ringArm(hub) + 3, al = X.jh + 9;
      X.line(X.P(0, 0), X.P(nT, 0), "main", X.sh, 99);   /* the entry, straight into the hall */
      X.line(X.P(nT, 0), X.P(hT, 0), "main", 99, 0); X.line(X.P(hT, 0), X.P(fT, 0), "main", 99, 0); X.line(X.P(fT, 0), X.P(cT, 0), "main", 99, X.jh);   /* through the hall and out of its far end */
      X.jog(cT, -s);   /* the chapel beyond, jogged away from the wing */
      X.elbow(nT, s, arm, cT - nT + 2, hub.across / 2);   /* out of the hall's near end: a corner chamber, along the hall, a chamber past its far end */
      if (X.need > 8) X.elbow(fT, -s, arm, -(fT - nT + 2), hub.across / 2);   /* and out of its far end on the other hand, back toward the stair */
      else X.end(X.line(X.P(cT, 0), X.P(cT, -s * al), "main", X.jh, 99), X.P(cT, -s * al), X.side(-s));   /* else a chamber off the far crossing */
      X.end(X.line(X.P(cT, 0), X.P(cT, s * al), "main", X.jh, 99), X.P(cT, s * al), X.side(s));
      return { hub: X.P(hT, 0), hubShape: hub };
    },
    wings: function (X) {
      var hub = { along: 20, across: 20 }, hh = 10, aT = X.sh + X.entry + X.jh, hT = aT + X.jh + X.bay + hh, bT = hT + hh + X.bay + X.jh, s = X.flip, wl = hh + 10, al = X.jh + 9;
      X.line(X.P(0, 0), X.P(aT, 0), "main", X.sh, X.jh);
      X.line(X.P(aT, 0), X.P(hT, 0), "main", X.jh, hh);
      X.line(X.P(hT, 0), X.P(bT, 0), "main", hh, X.jh);
      X.jog(bT, -s);
      X.elbow(aT, s, X.ringArm(hub), bT - aT - 6, X.jh);   /* the one hand: the antechamber's arm turns and runs beside the hall, the chambers in two files */
      X.end(X.line(X.P(hT, 0), X.P(hT, -s * wl), "main", hh, 99, 8), X.P(hT, -s * wl), X.side(-s), X.wing);   /* the other: the wide way into the great chamber */
      X.end(X.line(X.P(aT, 0), X.P(aT, -s * al), "main", X.jh, 99), X.P(aT, -s * al), X.side(-s));
      X.end(X.line(X.P(bT, 0), X.P(bT, -s * al), "main", X.jh, 99), X.P(bT, -s * al), X.side(-s));
      return { hub: X.P(hT, 0), hubShape: hub };
    }
  };
  function axisLines(S, si, SITE, seed) {
    var p0 = [S.portals[0].x, S.portals[0].y], c = S.centre, dx = c[0] - p0[0], dy = c[1] - p0[1], d = Math.abs(dx) > Math.abs(dy) ? [dx > 0 ? 1 : -1, 0] : [0, dy > 0 ? 1 : -1], n = [-d[1], d[0]];
    var J = SITE.junction, bay = SITE.bay, clear = ROOM_MARGIN + 0.5, lines = [], main = [], side = [], endAnchors = [], corners = [], wide = 0, atEnd = null;
    Object.keys(SITE.rooms).forEach(function (k) { var K = SITE.rooms[k]; if (K.atEnd) atEnd = atEnd || k; else if (!K.extra) wide = Math.max(wide, K.r ? K.r * 2.44 : K.across * 1.1); });   /* the widest chamber a run's inner side may hold, as varied; the kind that stands at the far end */
    var prng = NS.Rng(seed + "/plan"), names = SITE.schemes || ["axis"], scheme = names[prng.int(names.length)], flip = prng.chance(0.5) ? 1 : -1, need = 0;
    Object.keys(SITE.rooms).forEach(function (k) { if (!SITE.rooms[k].extra) need += SITE.rooms[k].count[si]; });   /* how many chambers the size digs: a plan grows a second hand or crossing for them */
    function P(t, s) { return [p0[0] + d[0] * t + n[0] * s, p0[1] + d[1] * t + n[1] * s]; }
    /* a line and its bays: c0 and c1 are what stands at its ends (half a vault, the landing; 2 at a corner, for the
       corridor's own band; 99 for no bays); a pair's anchor at each bay's middle, with half the bay less the margin to grow into */
    function line(a, b, kind, c0, c1, width) {
      var len = G.dist(a, b), free = len - c0 - c1, nb = Math.max(0, Math.floor(free / bay)), bl = nb ? free / nb : 0, bays = [], k;
      for (k = 0; k < nb; k++) bays.push({ t: c0 + bl * (k + 0.5), room: bl / 2 - clear });
      lines.push({ pts: [a, b], kind: "street", bays: bays, width: width || null });
      (kind === "side" ? side : main).push(lines.length - 1);
      return lines.length - 1;
    }
    var X = {
      si: si, flip: flip, need: need, d: d, sh: SITE.portalRooms.stairs.along / 2, jh: J.along / 2, bay: bay, entry: SITE.entry, hub: J.hub, wing: SITE.wing || null, apse: SITE.apse || null, P: P, line: line,
      side: function (s) { return [n[0] * s, n[1] * s]; },
      ringArm: function (hub) { return hub.across / 2 + ROOM_MARGIN + wide + SITE.gap + WIDTH.main / 2 + 1; },   /* a run's distance from the axis: the hall's flank, a chamber on the run's inner side, the corridor */
      end: function (li, at, u, only) { endAnchors.push({ line: li, at: at, ux: u[0], uy: u[1], only: only || null }); },
      far: function (li, at) { endAnchors.push({ line: li, at: at, ux: d[0], uy: d[1], only: atEnd }); },
      /* the run to the far chamber, as a side passage: out of the crossing, a jog of 5 m to one hand, on to the chamber — so the chapel stands off the axis */
      jog: function (t0, s) { var j = t0 + J.along / 2 + 6, off = s * 10, eT = j + 8; line(P(t0, 0), P(j, 0), "side", 0, 0); line(P(j, 0), P(j, off), "side", 0, 0); X.far(line(P(j, off), P(eT, off), "side", 0, 0), P(eT, off)); },
      /* an arm out to `dist` on hand s that turns through a CORNER chamber and runs `run` along the axis (back, when
         negative) to a chamber at its end; c0 is what stands where the arm leaves (half a vault, the hall's flank) */
      elbow: function (t0, s, dist, run, c0) {
        var e = P(t0, s * dist), sign = run < 0 ? -1 : 1, far = P(t0 + run, s * dist), li1 = line(P(t0, 0), e, "main", c0, 8), li2 = line(e, far, "main", 8, 0);
        corners.push({ at: e, ang: Math.atan2(d[1] * sign, d[0] * sign), lines: [li1, li2] });
        X.end(li2, far, [d[0] * sign, d[1] * sign]);
      }
    };
    var plan = SCHEMES[scheme](X);
    return { lines: lines, ends: [], main: main, side: side, hub: plan.hub, hubShape: plan.hubShape, scheme: scheme, ang: Math.atan2(d[1], d[0]), endAnchors: endAnchors, corners: corners };
  }
  function clusterLines(S, rng, si, SITE) {
    var W = S.width, H = S.height, M = CLUSTER_MARGIN, ins = S.portals.filter(function (p) { return p.way !== "down" && PORTAL_KINDS[p.kind] === "in"; }), lines = [], nodes = [], links = [];
    NS.assert(ins.length, "a cave needs a way in (its mouth, or a shaft from the level above)", { portals: S.portals });
    var first = [ins[0].x, ins[0].y], h0 = S.heading ? Math.atan2(dirOf(S.heading)[1], dirOf(S.heading)[0]) : Math.atan2(S.centre[1] - first[1], S.centre[0] - first[0]);
    function radius() { var u = rng.float(); return u < 0.3 ? 24 + rng.float() * 10 : u < 0.8 ? 16 + rng.float() * 8 : 10 + rng.float() * 5; }   /* a big cavern 24–34 m across, most 16–24, a few 10–15 */
    function inside(c, r) { return c[0] > M + r && c[1] > M + r && c[0] < W - M - r && c[1] < H - M - r; }
    /* the entrance cavern: in from the mouth along the heading, turned a little when the frame is in the way */
    var r0 = 16 + rng.float() * 10, c0 = [first[0] + Math.cos(h0) * (r0 + 30), first[1] + Math.sin(h0) * (r0 + 30)], tries;
    for (tries = 0; tries < 20 && !inside(c0, r0); tries++) { h0 += (rng.float() - 0.5) * 0.8; c0 = [first[0] + Math.cos(h0) * (r0 + 30), first[1] + Math.sin(h0) * (r0 + 30)]; }
    c0 = [U.clamp(c0[0], M + r0, W - M - r0), U.clamp(c0[1], M + r0, H - M - r0)];
    nodes.push({ c: c0, r: r0 });
    /* the field: an ellipse ahead of the entrance, three quarters of its length past it, seven tenths as wide as long */
    var R = REACH[si], ax = Math.cos(h0), ay = Math.sin(h0), cf = [c0[0] + ax * R * 0.75, c0[1] + ay * R * 0.75], want = SCATTER[si], t, rr, u, v, p, r, k, ok;
    for (tries = 0; tries < 600 && nodes.length < want; tries++) {
      t = rng.float() * Math.PI * 2; rr = Math.sqrt(rng.float()); u = Math.cos(t) * rr * R; v = Math.sin(t) * rr * R * 0.7;
      p = [cf[0] + ax * u - ay * v, cf[1] + ay * u + ax * v]; r = radius();
      if (!inside(p, r) || G.dist(p, first) < r + 16) continue;   /* clear of the frame and of the mouth's landing */
      ok = true; for (k = 0; k < nodes.length; k++) if (G.dist(p, nodes[k].c) < 0.7 * (r + nodes[k].r)) { ok = false; break; }
      if (ok) nodes.push({ c: p, r: r });
    }
    /* the necks: the Delaunay neighbours, by the gap of rock between the two caverns */
    var edges = [], seenE = {}, i, j;
    function edge(a, b) { var lo = Math.min(a, b), hi = Math.max(a, b), key = lo + "-" + hi; if (seenE[key]) return; seenE[key] = true; edges.push({ a: lo, b: hi, gap: G.dist(nodes[lo].c, nodes[hi].c) - nodes[lo].r - nodes[hi].r }); }
    if (nodes.length >= 3) NS.mesh.delaunay(nodes.map(function (n) { return n.c; })).tris.forEach(function (tri) { edge(tri[0], tri[1]); edge(tri[1], tri[2]); edge(tri[2], tri[0]); });
    else for (i = 0; i < nodes.length; i++) for (j = i + 1; j < nodes.length; j++) edge(i, j);
    edges.sort(function (p1, q1) { return p1.gap - q1.gap; });
    /* a spanning tree of the shortest gaps, so every cavern is reached */
    var parent = nodes.map(function (n, idx) { return idx; }), linked = {};
    function find(x) { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; }
    function addLink(e) { links.push([e.a, e.b]); linked[e.a + "-" + e.b] = true; }
    edges.forEach(function (e) { var fa = find(e.a), fb = find(e.b); if (fa !== fb) { parent[fa] = fb; addLink(e); } });
    /* every pair that all but touches, then a few more short necks as loops */
    var extra = 0;
    edges.forEach(function (e) { if (linked[e.a + "-" + e.b]) return; if (e.gap <= TOUCH) { addLink(e); return; } if (e.gap <= NECK_MAX && extra < SITE.loops[si] + 1 && rng.chance(0.6)) { addLink(e); extra++; } });
    /* depth by necks from the entrance; the hub is the farthest cavern (the biggest among the farthest) */
    var prev = {}, depth = { 0: 1 }, queue = [0], vtx, hub = 0;
    while (queue.length) { vtx = queue.shift(); links.forEach(function (L) { var o = L[0] === vtx ? L[1] : L[1] === vtx ? L[0] : -1; if (o >= 0 && depth[o] === undefined) { depth[o] = depth[vtx] + 1; prev[o] = vtx; queue.push(o); } }); }
    nodes.forEach(function (n, idx) { n.depth = depth[idx] || 1; if (n.depth > nodes[hub].depth || (n.depth === nodes[hub].depth && n.r > nodes[hub].r)) hub = idx; });
    var onMain = {}; for (k = hub; k !== undefined; k = prev[k]) onMain[k] = true;
    lines.push({ kind: "main", pts: [first, c0], width: 10 + Math.round(rng.float() * 2) });
    links.forEach(function (L) {
      var main = onMain[L[0]] && onMain[L[1]] && (prev[L[0]] === L[1] || prev[L[1]] === L[0]);
      lines.push({ kind: main ? "main" : "side", pts: [nodes[L[0]].c, nodes[L[1]].c], width: Math.round((main ? 10 + rng.float() * 4 : 7 + rng.float() * 3) * 2) / 2 });
    });
    /* the other ways in (a shaft from the level above): a straight neck to the nearest cavern */
    ins.slice(1).forEach(function (pp) { var start = [pp.x, pp.y], best = 0, bd = Infinity; nodes.forEach(function (q, qi) { var d = G.dist(start, q.c); if (d < bd) { bd = d; best = qi; } }); lines.push({ kind: "main", pts: [start, nodes[best].c], width: 10 }); });
    return { lines: lines, hub: nodes[hub].c, nodes: nodes, ends: [] };
  }

  /* ── generate ── */
  function generate(input) {
    var P = resolveParams(input), S = P.site, SITE = SITES[S.kind], seed = P.seed, W = P.width, H = P.height, warnings = [], t0 = NS.terrain.now(), stats = {};
    var si = SIZE_INDEX[S.town.size], rng = NS.Rng(seed + "/dungeon"), namer = NS.names.Namer(NS.Rng(seed + "/rooms"), P.culture), k;
    S.portals.forEach(function (p) { if (p.name) namer.used[p.name] = 1; });
    var gr = Graph(), cluster = SITE.follows === "cluster" ? clusterLines(U.extend({ width: W, height: H }, S), NS.Rng(seed + "/lines"), si, SITE) : null, axis = SITE.follows === "axis" ? axisLines(S, si, SITE, seed) : null;
    var synth = cluster || axis || S.streets.length ? null : syntheticStreets(U.extend({ width: W, height: H }, S), NS.Rng(seed + "/lines"), 3 + (si >= 2 ? 1 : 0)), lines = cluster ? cluster.lines : axis ? axis.lines : synth ? synth.lines : S.streets, lineEdges = [];
    lines.forEach(function (s, i) { var e = gr.edge(gr.vertex(s.pts[0]), gr.vertex(s.pts[1]), s.kind || "street", s.width); if (e) e.line = i; lineEdges.push(e); });
    NS.assert(gr.edges.length, "no lines for the spine to follow", { streets: S.streets.length });
    var hub = cluster ? gr.vertex(cluster.hub) : axis ? gr.vertex(axis.hub) : gr.nearest(S.centre, -1);
    var ways = S.portals.filter(function (p) { return p.way === "down" || PORTAL_KINDS[p.kind] === "in"; }), outfalls = S.portals.filter(function (p) { return p.kind === "outfall"; });
    NS.assert(ways.length, "a dungeon needs at least one portal that is a way in from above (" + Object.keys(PORTAL_KINDS).filter(function (k) { return PORTAL_KINDS[k] === "in"; }).join("|") + ")", { portals: S.portals });
    /* the fixed points: every way in becomes a vertex of the line graph */
    var pv = {};
    ways.forEach(function (p) {
      var at = [p.x, p.y], v, foot;
      if (p.way === "down") {   /* a pinned stair stands exactly where it was: its own vertex, a short run to the nearest line */
        v = gr.vertex(at); foot = gr.attach(at, 40); if (foot === null) foot = gr.nearest(at, v);
        if (foot !== null && foot !== v) gr.edge(v, foot, "street");
      } else {
        v = gr.attach(at, 40);
        if (v === null) { v = gr.vertex(at); gr.edge(v, gr.nearest(at, v), "street"); }   /* a way in off any line: a straight run to the nearest */
      }
      pv[p.id] = v;
    });
    /* the spine: the cheapest lines from every way in to the hub; main streets are preferred, lanes shunned — or, where
       the spine is a cluster (a cave), every neck as it was drawn */
    var used = {};
    if (cluster) gr.edges.forEach(function (e) { if (!e.dead) used[e.id] = WIDTH[e.kind] ? e.kind : "main"; });
    function cost(e, mult) { return e.len * (e.kind === "main" ? 0.7 : e.kind === "lane" ? 1.5 : 1) * (1 + 0.3 * jit(e.a + "/" + e.b, 7)) * (used[e.id] ? mult : 1); }
    function walk(sources, isTarget, mult) { return dijkstra(gr, sources, function (e) { return cost(e, mult); }, isTarget); }
    if (!cluster) ways.forEach(function (p) {
      var res = walk([pv[p.id]], function (v) { return v === hub; }, 1);
      if (res.target === null) { warnings.push("the way in " + (p.name || p.id) + " has no street to the market above — its tunnel is dug straight"); gr.edge(pv[p.id], hub, "street"); res = walk([pv[p.id]], function (v) { return v === hub; }, 1); }
      pathEdges(res, hub).forEach(function (id) { used[id] = "main"; });
    });
    /* a star's extra arms are main tunnels too: walked from their far ends */
    ((synth || axis) ? (synth || axis).ends : []).forEach(function (q) { var res = walk([gr.vertex(q)], function (v) { return v === hub; }, 1); if (res.target !== null) pathEdges(res, hub).forEach(function (id) { used[id] = "main"; }); });
    if (axis) { axis.main.forEach(function (i) { if (lineEdges[i] && !lineEdges[i].dead) used[lineEdges[i].id] = "main"; }); axis.side.forEach(function (i) { if (lineEdges[i] && !lineEdges[i].dead) used[lineEdges[i].id] = "side"; }); }   /* an axis plan's corridors are its own: the crossings' arms and the ambulatory are main whatever the walk found, the run to the great chamber a side passage */
    /* loops: a second way between neighbouring ways in that prefers lines not yet used */
    var byAngle = ways.slice().sort(function (a, b) { return Math.atan2(a.y - gr.verts[hub][1], a.x - gr.verts[hub][0]) - Math.atan2(b.y - gr.verts[hub][1], b.x - gr.verts[hub][0]); }), loops = 0;
    for (k = 0; !cluster && k < byAngle.length - 1 && loops < SITE.loops[si]; k++) {
      var ga = byAngle[k], gb = byAngle[k + 1], lr = walk([pv[ga.id]], function (v) { return v === pv[gb.id]; }, 4);
      if (lr.target === null) continue;
      var fresh = pathEdges(lr, pv[gb.id]).filter(function (id) { return !used[id]; }), fl = 0;
      fresh.forEach(function (id) { fl += gr.edges[id].len; });
      if (fresh.length >= 2 && fl <= 2.2 * G.dist([ga.x, ga.y], [gb.x, gb.y])) { fresh.forEach(function (id) { used[id] = "main"; }); loops++; }
    }
    /* side passages: short branches off the spine along lines not yet used */
    function spineVertices() { var seen = {}, out = []; Object.keys(used).forEach(function (id) { var e = gr.edges[id]; [e.a, e.b].forEach(function (v) { if (!seen[v]) { seen[v] = true; out.push(v); } }); }); return out; }
    var inV = {}; ways.forEach(function (p) { inV[pv[p.id]] = true; });
    var starts = rng.shuffle(spineVertices().filter(function (v) { return v !== hub && !inV[v]; })), sides = 0, want = cluster ? 0 : SITE.sides[si];
    starts.forEach(function (v) {
      if (sides >= want) return;
      var opts = gr.adj[v].filter(function (id) { return !used[id] && !gr.edges[id].dead; });
      if (!opts.length) return;
      var e = gr.edges[opts[rng.int(opts.length)]], cur = v, steps = 1 + rng.int(2), n = 0, next;
      while (e && n < steps) {
        used[e.id] = "side"; n++; next = e.a === cur ? e.b : e.a;
        var ahead = gr.adj[next].filter(function (id) { return !used[id] && !gr.edges[id].dead; }).map(function (id) { return gr.edges[id]; });
        if (!ahead.length) break;
        /* the straightest continuation */
        var dx = gr.verts[next][0] - gr.verts[cur][0], dy = gr.verts[next][1] - gr.verts[cur][1], bestE = null, bestC = -2;
        ahead.forEach(function (ne) { var to = ne.a === next ? ne.b : ne.a, ex = gr.verts[to][0] - gr.verts[next][0], ey = gr.verts[to][1] - gr.verts[next][1], c = (dx * ex + dy * ey) / ((Math.sqrt(dx * dx + dy * dy) || 1) * (Math.sqrt(ex * ex + ey * ey) || 1)); if (c > bestC) { bestC = c; bestE = ne; } });
        cur = next; e = bestE;
      }
      sides++;
    });
    /* the drain: from the spine along the lines to the vertex nearest the outfall, then straight out to it */
    outfalls.forEach(function (o) {
      var ov = gr.vertex([o.x, o.y]), target = gr.nearest([o.x, o.y], ov), res = target === null ? { target: null } : walk(spineVertices(), function (v) { return v === target; }, 1);
      if (res.target !== null) pathEdges(res, target).forEach(function (id) { if (!used[id]) used[id] = "main"; });
      else { var sv = spineVertices(), bv = sv[0], bd = Infinity; sv.forEach(function (v) { var d = G.dist(gr.verts[v], [o.x, o.y]); if (d < bd) { bd = d; bv = v; } }); target = bv; }
      var de = gr.edge(target, ov, "drain"); if (de) used[de.id] = "drain";
      pv[o.id] = ov;
    });
    stats.spine = U.round(NS.terrain.now() - t0, 1); t0 = NS.terrain.now();

    /* passages from the used edges; the degree of every vertex in the passage graph */
    var passages = [], deg = {}, mainDeg = {};
    gr.edges.forEach(function (e) {
      if (e.dead || !used[e.id]) return;
      passages.push({ id: "p" + passages.length, kind: used[e.id], pts: [gr.verts[e.a], gr.verts[e.b]], width: e.w || WIDTH[used[e.id]], a: e.a, b: e.b, line: e.line });
      deg[e.a] = (deg[e.a] || 0) + 1; deg[e.b] = (deg[e.b] || 0) + 1;
      if (used[e.id] !== "side") { mainDeg[e.a] = (mainDeg[e.a] || 0) + 1; mainDeg[e.b] = (mainDeg[e.b] || 0) + 1; }
    });
    function passageDir(v) { var p = null; passages.some(function (q) { if (q.a === v || q.b === v) { p = q; return true; } return false; }); if (!p) return 0; return Math.atan2(p.pts[1][1] - p.pts[0][1], p.pts[1][0] - p.pts[0][0]); }

    /* rooms: a landing at every way in and the outfall chamber, a vault at the hub and every junction of main
       tunnels, the catalogue chambers beside the passages (each with a door), an alcove at every bare dead end, then
       the author's edits. Ids are stable under a count change: a vault is numbered by its junction, an alcove by its
       dead end, a catalogue chamber by its reservation (below) — so an edit keyed by id keeps pointing at the same
       room. Every room remembers its PLACEMENT (beside a passage, at the end of one, on a junction) so it can be
       reshaped where it stands. */
    var rooms = [], doorOf = {}, placeOf = {}, shapeOf_ = {}, centre = gr.verts[hub], portalIds = {}, J = SITE.junction, DE = SITE.deadEnd;
    S.portals.forEach(function (p) { portalIds[p.id] = p.way; });   /* id → up | down */
    function bearingOf(p) { return G.bearing(centre, p).name; }
    function hitsAny(poly, polys) { var j; for (j = 0; j < polys.length; j++) if (polyNear(poly, polys[j], ROOM_MARGIN)) return true; return false; }
    /* `poly` leaves the frame margin, meets a room (other than `skipRoom`), one of `extra`, or a passage other than `skipPassage` */
    function conflicts(poly, skipPassage, extra, skipRoom, pMargin) {   /* skipPassage: one id, or a list (a cluster's node meets every neck that runs into it) */
      var bb = G.bbox(poly), j, skip = [].concat(skipRoom || []), skipP = [].concat(skipPassage || []), pm = pMargin === undefined ? 2.5 : pMargin;
      if (bb[0] < FRAME_MARGIN || bb[1] < FRAME_MARGIN || bb[2] > W - FRAME_MARGIN || bb[3] > H - FRAME_MARGIN) return true;
      for (j = 0; j < rooms.length; j++) if (skip.indexOf(rooms[j].id) < 0 && polyNear(poly, rooms[j].poly, ROOM_MARGIN)) return true;
      if (extra && hitsAny(poly, extra)) return true;
      for (j = 0; j < passages.length; j++) if (skipP.indexOf(passages[j].id) < 0 && segPolyDist(passages[j].pts[0], passages[j].pts[1], poly) < passages[j].width / 2 + pm) return true;
      return false;
    }
    function setPoly(r, poly, K) { var c = G.centroid(poly); r.poly = roundPts(poly); r.x = U.round(c[0], 1); r.y = U.round(c[1], 1); r.shape = K.blob ? "cavern" : K.r ? "round" : "rectangle"; }
    /* what stands in a chamber's doorway, dealt from the seed by the site's odds — by the room's id, so it never changes under a count */
    function doorStateOf(id) { var u = jit(id + "/door", 13), acc = 0, k; for (k in SITE.doors) if (Object.prototype.hasOwnProperty.call(SITE.doors, k)) { acc += SITE.doors[k]; if (u < acc) return k; } return "arch"; }
    function setDoor(r, dug) { if (dug.door) { doorOf[r.id] = dug.door; if (!r.door) r.door = doorStateOf(r.id); } else { delete doorOf[r.id]; r.door = null; } }
    function addRoom(id, kind, word, name, dug, K, portal, authored) {
      var r = { id: id, kind: kind, word: word, name: name, poly: null, x: 0, y: 0, portal: portal || null, shape: null, door: null }, CK = SITE.rooms[kind];
      if (CK && CK.mark) r.mark = CK.mark;   /* what the ink draws in it: pillars down a hall, a sarcophagus in a tomb */
      setPoly(r, dug.poly, K); if (authored) r.authored = true;
      rooms.push(r); placeOf[id] = dug.place; shapeOf_[id] = K; setDoor(r, dug);
      return r;
    }
    function roomIndex(id) { var j; for (j = 0; j < rooms.length; j++) if (rooms[j].id === id) return j; return -1; }
    var namers = {};
    function namerFor(label) { return namers[label] || (namers[label] = NS.names.Namer(NS.Rng(seed + "/rooms/" + label), P.culture, namer.used)); }
    /* the shape of a chamber of a kind: the catalogue's (a rectangle `along` × `across`, or round of radius `r`) — or
       `base`, the room's own size when it has one —, or the author's footprint and shape over it; a custom chamber has
       no catalogue shape and takes the default footprint */
    function shapeOf(kind, size, shape, base, id) {
      var K = base || SITE.rooms[kind] || (kind === "vault" ? J : kind === "alcove" ? DE : null), F, m = S.mPerUnit;
      if (!K && kind !== CUSTOM) return null;
      if (!K && !size) size = FOOTPRINTS[DEFAULT_FOOTPRINT];
      if (size) F = size.length === 2 ? { along: size[0] / m, across: size[1] / m, r: (size[0] + size[1]) / 4 / m } : { along: size[0] / m, across: size[0] / m, r: size[0] / 2 / m };   /* metres → units */
      else F = K.r ? { r: K.r, along: K.r * 1.85, across: K.r * 1.85 } : { along: K.along, across: K.across, r: (K.along + K.across) / 4 };
      return build(F, shape || defaultShape(K), id);
    }
    /* the shape a catalogue entry (or a base shape) takes when nothing says otherwise: its own, the site's, else round
       for an `r` entry and a rectangle for an along × across one */
    function defaultShape(K) { return (K && K.shape) || (K && K.blob ? "cavern" : null) || SITE.shape || (K && K.r ? "round" : "rectangle"); }
    function build(F, sh, id) { var out = sh === "round" ? { r: F.r } : { along: F.along, across: F.across }; if (sh === "cavern") out.blob = true; if (id) out.sid = id; return out; }
    /* a catalogue entry as dug: exactly (a landing, a vault, an alcove), or varied by the room's id (a chamber) */
    function exact(K, id) { return build(K.r ? { r: K.r, along: K.r * 1.85, across: K.r * 1.85 } : { along: K.along, across: K.across, r: (K.along + K.across) / 4 }, defaultShape(K), id); }
    function kindShape(K, id) { var V = varied(K, id); return build(V.r !== undefined ? { r: V.r, along: V.r * 1.85, across: V.r * 1.85 } : { along: V.along, across: V.across, r: (V.along + V.across) / 4 }, defaultShape(K), id); }
    /* an edit's size in metres: typed, or a preset by name */
    function sizeOf(e) { return e.size || (e.footprint ? FOOTPRINTS[e.footprint] : null); }
    function half(K) { return K.r ? K.r : K.along / 2; }
    function inset(K) { return K.r ? K.r * Math.cos(Math.PI / 8) : K.blob ? K.along * 0.42 : K.along / 2; }
    /* no two chambers of a kind the same size: each is scaled from the seed by its id (a cistern from a well to a hall) */
    function pairOf(id) { var m = /^(.*)-(\d+)$/.exec(id); return m ? m[1] + "-pair" + Math.ceil(+m[2] / 2) : id; }   /* tomb-1 and tomb-2 are a pair, tomb-3 and tomb-4 the next */
    function varied(K, id) { var vr = NS.Rng(seed + "/size/" + (SITE.paired ? pairOf(id) : id)), f = 0.78 + 0.44 * vr.float(), g = 0.9 + 0.2 * vr.float(); return K.r ? { r: K.r * f } : { along: K.along * (0.86 + 0.28 * (f - 0.78) / 0.44), across: K.across * g }; }
    /* a placement: beside a passage (the anchor point on it, its direction, the side; a door joins the room), at the
       END of a dead-end passage (in line with it, no door: the passage runs into it), or on a junction (centred) */
    function dig(K, pl) {
      var ang, c, nrm, w, off;
      if (pl.kind === "beside") {
        nrm = [-pl.uy * pl.side, pl.ux * pl.side]; w = pl.passage.width / 2 + (SITE.gap !== undefined ? SITE.gap : GAP); off = w + (K.r ? K.r : K.across / 2 * (K.blob ? 1.05 : 1));   /* a built site's chamber stands a wall's thickness off the corridor (`gap`), a dug one further back */ c = [pl.p[0] + nrm[0] * off, pl.p[1] + nrm[1] * off]; ang = Math.atan2(pl.uy, pl.ux);
        /* the door runs one unit into the room — past an octagon's flat face, which sits r(1 − cos π/8) inside its radius, or a cavern's uneven wall */
        var reach = w + 1 + (K.r ? K.r * (1 - Math.cos(Math.PI / 8)) : K.blob ? K.across * 0.13 : 0);
        return { poly: polyOf(K, c, ang), c: c, door: { pts: [pl.p, [pl.p[0] + nrm[0] * reach, pl.p[1] + nrm[1] * reach]] }, place: pl, K: K };
      }
      if (pl.kind === "end") { c = [pl.at[0] + pl.ux * (inset(K) - 1), pl.at[1] + pl.uy * (inset(K) - 1)]; ang = Math.atan2(pl.uy, pl.ux); return { poly: polyOf(K, c, ang), c: c, door: { pts: [[pl.at[0] - pl.ux, pl.at[1] - pl.uy], [pl.at[0] + pl.ux, pl.at[1] + pl.uy]], width: pl.passage.width }, place: pl, K: K }; }
      if (pl.kind === "annex") {   /* built onto a chamber's wall: along it, just outside it, a door through the wall */
        var hw = K.r ? K.r * Math.cos(Math.PI / 8) : K.across / 2 * (K.blob ? 0.86 : 1), mid = pl.mid;
        c = [mid[0] + pl.nx * (WALL + hw), mid[1] + pl.ny * (WALL + hw)]; ang = Math.atan2(pl.uy, pl.ux);
        return { poly: polyOf(K, c, ang), c: c, door: { pts: [[mid[0] - pl.nx * 0.8, mid[1] - pl.ny * 0.8], [mid[0] + pl.nx * (WALL + 0.8), mid[1] + pl.ny * (WALL + 0.8)]] }, place: pl, K: K };
      }
      return { poly: polyOf(K, pl.c, pl.ang), c: pl.c, door: null, place: pl, K: K };
    }
    /* the first of the placements where the chamber fits, else null (an annex may touch the chamber it is built onto) */
    function fit(K, places, extra, skipRoom) {
      var i, r, ex, bb;
      for (i = 0; i < places.length; i++) {
        r = dig(K, places[i]);
        if (places[i].loose) { bb = G.bbox(r.poly); if (bb[0] >= FRAME_MARGIN && bb[1] >= FRAME_MARGIN && bb[2] <= W - FRAME_MARGIN && bb[3] <= H - FRAME_MARGIN) return r; continue; }   /* a cluster's cavern: it may overlap its neighbours (they merge into one hall) and its necks; only the frame binds it */
        ex = places[i].kind === "annex" && extra ? extra.filter(function (q) { return q.host !== places[i].room && q.owner !== places[i].room; }) : extra;   /* neither a host's kept-clear reservation nor the host's own claim bars an annex onto that host (they touch by design) */
        if (!conflicts(r.poly, places[i].passages || (places[i].passage ? places[i].passage.id : null), ex, places[i].kind === "annex" ? [skipRoom, places[i].room] : skipRoom, places[i].kind === "annex" ? GAP - 0.1 : undefined)) return r;   /* an annex flush with a host that stands GAP from a passage must pass */
      }
      return null;
    }
    function beside(a, side) { return { kind: "beside", p: a.p, ux: a.ux, uy: a.uy, passage: a.passage, side: side }; }
    /* at an anchor: beside its passage on the given side (then the other); a cluster's node anchor takes the node itself, centred, open on every neck that runs into it */
    function fitAt(K, a, side, extra, skipRoom) { if (a.end) return fit(K, [{ kind: "end", at: a.p, ux: a.ux, uy: a.uy, passage: a.passage }], extra, skipRoom); if (a.corner) return fit(K, [{ kind: "junction", c: a.p, ang: a.ang, passages: a.passages }], extra, skipRoom); if (a.node) return fit(K, [{ kind: "junction", c: a.p, ang: a.ang, passages: a.passages, loose: true }], extra, skipRoom); return fit(K, a.fixedSide ? [beside(a, a.fixedSide)] : [beside(a, side), beside(a, -side)], extra, skipRoom); }
    /* a cavern on a node of the cluster: the node's size, the kind's proportions (a gallery long, a pool round), a little varied by id */
    function nodeShape(K, node, id) { var ratio = K.r ? 1 : K.along / K.across, s = Math.sqrt(ratio), vr = NS.Rng(seed + "/node/" + id), f = 0.92 + 0.16 * vr.float(); return build({ along: 2 * node.r * s * f, across: 2 * node.r / s * f, r: node.r * f }, "cavern", id); }
    function shapeFor(K, a, id, KV) { return a.node ? nodeShape(K, a.node, id) : KV; }
    S.portals.forEach(function (p) {
      var v = pv[p.id], pl = { kind: "junction", c: gr.verts[v], ang: passageDir(v) }, PR, K;
      if (p.way === "down") {   /* a pinned stair down: the catalogue's chamber, centred on its spot */
        PR = SITE.rooms[p.kind]; K = exact(PR, p.id);
        addRoom(p.id, p.kind, PR.word, p.name || namer.town(p.kind, { bearing: bearingOf(gr.verts[v]), name: S.town.name }, PR.patterns), dig(K, pl), K, p.id);
        return;
      }
      PR = SITE.portalRooms[p.kind]; K = exact(PR, p.id);
      addRoom(p.id, PORTAL_KINDS[p.kind] === "in" ? "stair" : "outfall", PR.word, p.name || (PORTAL_KINDS[p.kind] === "in" ? "A way up" : "The outfall"), dig(K, pl), K, p.id);
    });
    var junctions = 0;
    var jOrder = Object.keys(deg).map(function (v) { return +v; });
    if (axis) jOrder.sort(function (a, b) { return (a === hub ? 0 : 1) - (b === hub ? 0 : 1) || a - b; });   /* a built site digs its hall first: a crossing that falls inside it (the corridor out of a long hall's end) yields */
    jOrder.forEach(function (v) {   /* in a cluster every vertex is a node and gets its chamber below: no vaults */
      if (cluster || (v !== hub && ((mainDeg[v] || 0) < 3 || inV[v]))) return;
      junctions++;
      /* a built site's crossings are square and its hub a hall (`junction.along/across`, `junction.hub`), with a word and a mark of its own */
      var isHub = v === hub, K = exact(isHub ? (axis && axis.hubShape ? axis.hubShape : J.hub || { r: J.hubR }) : (J.along ? { along: J.along, across: J.across } : { r: J.r }), "vault-" + junctions), dug = dig(K, { kind: "junction", c: gr.verts[v], ang: axis ? axis.ang : passageDir(v) }), name = namer.town("vault", { bearing: bearingOf(gr.verts[v]), name: S.town.name }, isHub && J.hubPatterns ? J.hubPatterns : J.patterns), j;
      for (j = 0; j < rooms.length; j++) if (polyNear(dug.poly, rooms[j].poly, 1)) return;   /* a landing already stands here */
      var vr = addRoom("vault-" + junctions, "vault", isHub && J.hubWord ? J.hubWord : J.word, name, dug, K, null); if (isHub && J.hubMark) vr.mark = J.hubMark;
    });
    /* anchors along the main and side passages, shuffled from the seed */
    var anchors = [];
    /* a built site's anchors are its BAYS — one pair to a bay, an anchor each side of the corridor (`fixedSide`), the
       twin across the way never taken by a neighbour — and the ends of its corridors, where a chamber stands in line
       with the corridor that runs into it (`end`; the far end of the axis, `far`, is the great chamber's) */
    if (axis) {
      passages.forEach(function (p) {
        var L = p.line !== undefined ? axis.lines[p.line] : null, a = p.pts[0], b = p.pts[1], len = G.dist(a, b), ux = (b[0] - a[0]) / (len || 1), uy = (b[1] - a[1]) / (len || 1);
        if (!L) return;
        L.bays.forEach(function (bay) { [1, -1].forEach(function (fs) { anchors.push({ p: [a[0] + ux * bay.t, a[1] + uy * bay.t], ux: ux, uy: uy, room: bay.room, passage: p, taken: false, fixedSide: fs }); }); });
      });
      axis.endAnchors.forEach(function (ea) { var p = null; passages.forEach(function (q) { if (q.line === ea.line) p = q; }); if (p) anchors.push({ end: true, only: ea.only, p: ea.at, ux: ea.ux, uy: ea.uy, room: Infinity, passage: p, taken: false }); });
      axis.corners.forEach(function (co) { var ps = passages.filter(function (q) { return co.lines.indexOf(q.line) >= 0; }).map(function (q) { return q.id; }); if (ps.length) anchors.push({ corner: true, p: co.at, ang: co.ang, passages: ps, room: Infinity, taken: false }); });   /* a corner: the chamber a corridor turns through, centred on the bend, open to both corridors */
    }
    else passages.forEach(function (p) {
      if (p.kind !== "main" && p.kind !== "side") return;
      var a = p.pts[0], b = p.pts[1], len = G.dist(a, b), dx = (b[0] - a[0]) / (len || 1), dy = (b[1] - a[1]) / (len || 1), t;
      if (len < 2 * ANCHOR_END + 2) return;
      for (t = ANCHOR_END; t <= len - ANCHOR_END; t += ANCHOR_STEP) anchors.push({ p: [a[0] + dx * t, a[1] + dy * t], ux: dx, uy: dy, room: Math.min(t, len - t) - 3, passage: p, taken: false });
    });
    anchors = rng.shuffle(anchors);
    /* a cluster's anchors are its nodes: the catalogue is dealt over the caverns themselves */
    if (cluster) anchors = rng.shuffle(cluster.nodes.map(function (nd, i) { var c = nd.c, touching = passages.filter(function (p) { return p.kind !== "door" && (G.dist(p.pts[0], c) < 0.5 || G.dist(p.pts[1], c) < 0.5); }).map(function (p) { return p.id; }); return { node: nd, index: i, p: c, room: Infinity, passage: null, passages: touching, taken: false, ang: passageDir(gr.vertex(c)) }; }));
    /* the order a kind tries the anchors in: the shuffled deal — or, on a built site, the ends reserved for the kind
       first (`only`: the far end for the kind with `atEnd`, the wing for the site's `wing`; no other kind takes them), and for every kind the
       TWIN of its last chamber first (the anchor facing it across the corridor: chambers come in mirrored pairs), then
       the free anchors nearest its last — so a kind fills a corridor in a row, six cells in two files, tomb facing tomb */
    var lastAt = {};
    function dealOrder(kind, K) {
      if (!axis) return anchors;
      var rest = anchors.filter(function (a) { return !a.only; }), mine = anchors.filter(function (a) { return a.only === kind; }), last = lastAt[kind];
      if (mine.length && reserved[kind].length < mine.length) return mine.concat(rest);   /* the ends reserved for this kind first (the chapel's far end, the ossuary's wing) */
      if (!last) return rest.filter(function (a) { return a.end || a.corner; }).concat(rest.filter(function (a) { return !a.end && !a.corner; }));   /* a kind's first chamber takes a corridor's end or corner before a bay: a corridor leads TO a room */
      return rest.map(function (a, i) { return { a: a, i: i, d: a.fixedSide && last.fixedSide && a.fixedSide !== last.fixedSide && G.dist(a.p, last.p) < 0.5 ? -1 : G.dist(a.p, last.p) }; }).sort(function (x, y) { return x.d - y.d || x.i - y.i; }).map(function (x) { return x.a; });
    }
    function takeAnchor(a, K) { a.taken = true; if (a.node || a.end || a.corner) return; anchors.forEach(function (o) { if (o.taken || (o.fixedSide && a.fixedSide && o.fixedSide !== a.fixedSide)) return; if (G.dist(o.p, a.p) < half(K) + 6) o.taken = true; }); }   /* a paired anchor's twin across the corridor stays free */   /* a node is its own slot: a big cavern beside it is still dug */
    /* RESERVATIONS from the seed alone, independent of the counts: every catalogue kind gets up to MAX_COUNT anchors
       dealt round-robin (each kind's first before any kind's second), each with its chamber and its name; the requested
       count digs the first n — so changing one kind's count never moves or renames another kind's chambers (tested) */
    var kinds = Object.keys(SITE.rooms), reserved = {}, reservedPolys = [], round, more = true;
    kinds.forEach(function (kind) { reserved[kind] = []; });
    /* a slot's id, kind-n: the numbering skips any id a way UP already carries (the level above's count-made stairs-1
       is this level's way up), so a level's own stairs-1 never collides with the landing it came down by */
    function slotId(kind, j) { var n = 0, k = -1; while (k < j) { n++; if (portalIds[kind + "-" + n] !== "up") k++; } return kind + "-" + n; }
    /* two deals: the site's own kinds first, exactly as before the extras came (the same anchors, the same draws), then
       the extra kinds over what is left — so an existing map's chambers stand where they stood */
    /* one reservation for a kind at the first anchor in `order` (the deal's, or a twin) where its chamber fits */
    function reserveOne(kind, K, order) {
      var id = slotId(kind, reserved[kind].length), KV = kindShape(K, id), j, a, r, KA;
      for (j = 0; j < order.length; j++) {
        a = order[j]; if (a.taken || a.room < half(KV)) continue;
        KA = shapeFor(K, a, id, KV); r = fitAt(KA, a, rng.chance(0.5) ? 1 : -1, reservedPolys, null);
        if (!r) continue;
        takeAnchor(a, KA); lastAt[kind] = a; r.anchor = a; r.K = KA; r.name = namerFor(kind).town(kind, { bearing: bearingOf(r.c), name: S.town.name }, K.patterns);
        reservedPolys.push(r.poly); reserved[kind].push(r);
        return a;
      }
      return null;
    }
    /* a built site deals in PAIRS — a chamber's twin across the corridor is reserved at once for the same kind, so
       tomb faces tomb and cell faces cell — and in two phases: first every kind up to its count for this size (the
       undug reservations of a kind past its count would otherwise sit in the twins' bays), then up to MAX_COUNT */
    [false, true].forEach(function (extra) {
    var deal = kinds.filter(function (k) { return !!SITE.rooms[k].extra === extra; });
    (axis && !extra ? [true, false] : [false]).forEach(function (needFirst) {
    for (round = 0, more = true; round < MAX_COUNT && more; round++) {
      more = false;
      deal.forEach(function (kind) {
        var K = SITE.rooms[kind], a, twin;
        if (reserved[kind].length >= MAX_COUNT || (needFirst && reserved[kind].length >= K.count[si])) return;
        a = reserveOne(kind, K, dealOrder(kind, K)); if (!a) return;
        more = true;
        if (axis && a.fixedSide && reserved[kind].length < MAX_COUNT) { twin = anchors.filter(function (o) { return !o.taken && o.fixedSide === -a.fixedSide && G.dist(o.p, a.p) < 0.5; })[0]; if (twin) reserveOne(kind, K, [twin]); }
      });
    }
    });
    });
    /* the author's space FIRST: an add or a move claims its spot before the chambers are dug — at the dead end of the
       nearest passage when the point lies past or in line with that end, else beside it on the point's side —, so a
       reserved chamber that would stand there yields and the authored one never moves. A reshape seen on the way
       changes the shape a later move takes. */
    var edits = P.edits, targets = [], blocked = [], where = {}, added = {}, reshaped = {}, endClaimed = {}, annexOf = {};
    function nearestPassage(at) {
      var best = null, bd = SNAP, j, p, a, b, dx, dy, l2, t, q, d;
      for (j = 0; j < passages.length; j++) {
        p = passages[j]; if (p.kind === "door") continue; a = p.pts[0]; b = p.pts[1]; dx = b[0] - a[0]; dy = b[1] - a[1]; l2 = dx * dx + dy * dy || 1;
        t = U.clamp(((at[0] - a[0]) * dx + (at[1] - a[1]) * dy) / l2, 0, 1); q = [a[0] + dx * t, a[1] + dy * t]; d = G.dist(at, q);
        if (d < bd) { bd = d; best = p; }
      }
      return best;
    }
    /* the placements for the author's point, best first */
    /* the nearest wall of a chamber the point could build onto — a point just outside a wall (within ANNEX_REACH) or
       on the wall line itself (inside, within the wall's thickness; deeper in, the point claims the spot as before):
       a dug chamber, or a reserved one the count will dig (an undug reservation is not on the map, so a point in it
       is beside the passage, as the author sees it) — never a landing */
    function willDig(kind, j) { var n = P.rooms[kind] !== undefined ? P.rooms[kind] : SITE.rooms[kind].count[si]; return j < n && portalIds[slotId(kind, j)] !== "down"; }
    /* the chambers a point may build onto, each where it WILL stand: the dug ones; the author's own claims so far (a
       chamber added or moved stands at its claim, not at its reservation); a reserved chamber the count will dig and
       nothing moves — no add or move of its own, no claim on its spot (one with a claim on it is dug elsewhere). Never a
       landing (portalIds "up", skipped below). */
    function annexedTo(id, hostId) {   /* is id built onto hostId, directly or through a chain? (a host must never attach to its own annex) */
      var cur = id, n = 0, h;
      while (n++ < 32 && where[cur] !== undefined) { h = annexOf[where[cur]]; if (!h) return false; if (h === hostId) return true; cur = h; }
      return false;
    }
    function hostCandidates(forId) {
      var cands = rooms.map(function (r) { return { id: r.id, poly: r.poly }; }), claimed = {}, moving = {};
      edits.forEach(function (e) { if (e.op === "add" || e.op === "move") moving[e.id] = true; });
      Object.keys(where).forEach(function (id) { if (blocked[where[id]] && !annexedTo(id, forId)) { cands.push({ id: id, poly: blocked[where[id]] }); claimed[id] = true; } });
      kinds.forEach(function (kind) { reserved[kind].forEach(function (r, j) { var id = slotId(kind, j); if (willDig(kind, j) && !moving[id] && !claimed[id] && !hitsAny(r.poly, live(-1, id))) cands.push({ id: id, poly: r.poly }); }); });
      return cands;
    }
    function reservedById(id) { var out = null; kinds.forEach(function (kind) { reserved[kind].forEach(function (r, j) { if (slotId(kind, j) === id) out = r; }); }); return out; }
    /* the reservations of chambers that carry an annex, kept clear: a later drop finds room elsewhere rather than
       pushing a host out from under what was built onto it (the polys carry the host's id, so an annex onto that
       host is not barred by it) */
    function hostPolys(exceptId) {
      var out = [], seen = {};
      Object.keys(annexOf).forEach(function (j) { var id = annexOf[j], rr, poly; if (seen[id] || !blocked[j] || id === exceptId) return; seen[id] = true; if (where[id] !== undefined && blocked[where[id]]) return; rr = reservedById(id); if (!rr) return; poly = rr.poly.slice(); poly.host = id; out.push(poly); });
      return out;
    }
    function nearestWall(at, forId) {
      var best = null, bd = ANNEX_REACH;
      hostCandidates(forId).forEach(function (cd) {
        var n = cd.poly.length, i, a, b, d, cx = 0, cy = 0;
        if (portalIds[cd.id] === "up") return;
        var inside = G.pointInPolygon(at, cd.poly), reach = inside ? WALL : ANNEX_REACH;   /* inside, only the wall's own thickness counts: deeper in, the point claims the spot */
        for (i = 0; i < n; i++) { cx += cd.poly[i][0] / n; cy += cd.poly[i][1] / n; }
        for (i = 0; i < n; i++) { a = cd.poly[i]; b = cd.poly[(i + 1) % n]; d = G.pointSegDist(at, a, b); if (d <= reach && d < bd) { bd = d; best = { id: cd.id, i: i, n: n, a: a, b: b, c: [cx, cy], d: d }; } }
      });
      return best;
    }
    /* a host as it stands NOW — the author's claim, a dug chamber, or a reservation — with the points of its doorway, so a
       wall can be counted from the doorway: that count survives the host's turning when it is moved elsewhere */
    function hostRecord(id) {
      var i, rr;
      if (where[id] !== undefined && blocked[where[id]]) return { poly: blocked[where[id]], door: doorPtsOf(claimR[id]) };
      i = roomIndex(id); if (i >= 0) return { poly: rooms[i].poly, door: doorOf[id] ? doorOf[id].pts : placeOf[id] && placeOf[id].at ? [placeOf[id].at] : null };
      rr = reservedById(id); if (rr) return { poly: rr.poly, door: doorPtsOf(rr) };
      return null;
    }
    function doorPtsOf(r) { return !r ? null : r.door ? r.door.pts : r.place && r.place.at ? [r.place.at] : null; }
    function doorWallIndex(poly, pts) {   /* the wall nearest the doorway; 0 for a chamber with none (a vault, which never moves) */
      var best = 0, bd = Infinity, i, j, d, n = poly.length;
      if (!pts) return 0;
      for (i = 0; i < n; i++) for (j = 0; j < pts.length; j++) { d = G.pointSegDist(pts[j], poly[i], poly[(i + 1) % n]); if (d < bd) { bd = d; best = i; } }
      return best;
    }
    function annexPlace(hostId, hr, i, tAlong, K) {   /* onto wall i of the host's poly, tAlong of the way along it (clamped so the chamber stays on the wall) */
      var poly = hr.poly, n = poly.length, a = poly[i], b = poly[(i + 1) % n], wl = G.dist(a, b) || 1, wux = (b[0] - a[0]) / wl, wuy = (b[1] - a[1]) / wl, nx = wuy, ny = -wux, cx = 0, cy = 0, j, hk = half(K), wt;
      for (j = 0; j < n; j++) { cx += poly[j][0] / n; cy += poly[j][1] / n; }
      if ((a[0] - cx) * nx + (a[1] - cy) * ny < 0) { nx = -nx; ny = -ny; }   /* outward */
      wt = U.clamp(tAlong * wl, Math.min(hk, wl / 2), Math.max(wl - hk, wl / 2));
      return { kind: "annex", room: hostId, mid: [a[0] + wux * wt, a[1] + wuy * wt], ux: wux, uy: wuy, nx: nx, ny: ny, rel: { wall: (i - doorWallIndex(poly, hr.door) + n) % n, t: wt / wl } };
    }
    /* the placement an edit's onto {id, wall, t} means against the host as it stands now; null when the host is not there,
       is a landing, is this chamber's own annex, or has a different number of walls than the count was made on */
    function ontoPlace(onto, K, forId) {
      var hr = hostRecord(onto.id), n;
      if (!hr || portalIds[onto.id] === "up" || onto.id === forId || annexedTo(onto.id, forId)) return null;
      n = hr.poly.length; if (onto.wall >= n) return null;
      return annexPlace(onto.id, hr, (doorWallIndex(hr.poly, hr.door) + onto.wall) % n, onto.t, K);
    }
    function placesFor(at, K, forId) {
      var p = nearestPassage(at), wall = nearestWall(at, forId), out = [], dP = p ? G.pointSegDist(at, p.pts[0], p.pts[1]) : Infinity;
      if (wall && wall.d < dP - (p ? p.width / 2 : 0)) {   /* nearer a chamber's wall than the EDGE of any passage's band: an ANNEX, built onto that wall where the point falls along it (a point in the gap beside a passage, next to a chamber, is still beside the passage) */
        var wl = G.dist(wall.a, wall.b) || 1, hr = hostRecord(wall.id);
        out.push(annexPlace(wall.id, hr, wall.i, ((at[0] - wall.a[0]) * (wall.b[0] - wall.a[0]) + (at[1] - wall.a[1]) * (wall.b[1] - wall.a[1])) / (wl * wl), K));
      }
      if (!p) return out;
      var a = p.pts[0], b = p.pts[1], len = G.dist(a, b), ux = (b[0] - a[0]) / (len || 1), uy = (b[1] - a[1]) / (len || 1), h = half(K) + 1;
      var tRaw = (at[0] - a[0]) * ux + (at[1] - a[1]) * uy, lat = ux * (at[1] - a[1]) - uy * (at[0] - a[0]), across = K.r ? K.r : K.across / 2;
      var endA = deg[p.a] === 1 && !inV[p.a], endB = deg[p.b] === 1 && !inV[p.b];
      if (endB && tRaw > len - inset(K) && Math.abs(lat) < across) out.push({ kind: "end", at: b, ux: ux, uy: uy, passage: p });
      else if (endA && tRaw < inset(K) && Math.abs(lat) < across) out.push({ kind: "end", at: a, ux: -ux, uy: -uy, passage: p });
      if (len >= 2 * h) { var t = U.clamp(tRaw, h, len - h), an = { p: [a[0] + ux * t, a[1] + uy * t], ux: ux, uy: uy, passage: p }, side = lat >= 0 ? 1 : -1; out.push(beside(an, side)); out.push(beside(an, -side)); }
      return out;
    }
    /* the author's claims that bind a chamber: not its own, and not an annex built onto it (that one touches it by design) */
    function live(except, forId) { return blocked.filter(function (poly, j) { return poly && j !== except && (forId === undefined || annexOf[j] !== forId); }); }
    function kindOf(id) { var m = GENERATED_ID.exec(id); return added[id] ? added[id].kind : m ? m[1] : null; }
    function baseShapeOf(id) { var kind = kindOf(id); return !added[id] && SITE.rooms[kind] ? kindShape(SITE.rooms[kind], id) : null; }
    function currentShape(id) { var src = added[id] || {}, rs = reshaped[id] || {}; return shapeOf(kindOf(id), rs.size || sizeOf(src), rs.shape || src.shape, baseShapeOf(id), id); }
    var firstAdd = {}, claimR = {}, ontoMissed = {};
    edits.forEach(function (e, k) { if (e.op === "add" && firstAdd[e.id] === undefined) firstAdd[e.id] = k; });
    function claim(e, k) {
      if (e.op === "reshape") { reshaped[e.id] = { size: sizeOf(e) || (reshaped[e.id] || {}).size, shape: e.shape || (reshaped[e.id] || {}).shape }; return; }
      if ((e.op !== "add" && e.op !== "move") || portalIds[e.id]) return;   /* the rest is warned by the edits pass */
      if (e.op === "add") { if (firstAdd[e.id] !== k) return; added[e.id] = e; }   /* a second add of the same id is the edits pass's warning */
      var K = currentShape(e.id); if (!K) return;
      if (where[e.id] !== undefined) { blocked[where[e.id]] = null; delete endClaimed[where[e.id]]; delete annexOf[where[e.id]]; }   /* moved again, or placed again in the second pass: the earlier claim is released */
      /* an edit with onto is built onto that chamber wherever it stands now; only when that fails is the point used */
      var op = e.onto ? ontoPlace(e.onto, K, e.id) : null, r = op ? fit(K, [op], live(-1, e.id).concat(hostPolys(e.id)), e.id) : null;
      if (e.onto && !r) ontoMissed[e.id] = op ? "no room against it there" : "it is not there"; else delete ontoMissed[e.id];
      if (!r) r = fit(K, placesFor(e.at, K, e.id), live(-1, e.id).concat(hostPolys(e.id)), e.id);
      targets[k] = r || null; claimR[e.id] = r || null;
      if (!r) return;
      var cl = r.poly.slice(); cl.owner = e.id;   /* the claim knows whose it is: an annex onto this chamber may touch it */
      where[e.id] = blocked.length; blocked.push(cl);
      if (r.place.kind === "end") endClaimed[blocked.length - 1] = key(r.place.at);
      if (r.place.kind === "annex") annexOf[blocked.length - 1] = r.place.room;
    }
    /* TWO passes over the edits, in order: the second places every chamber again with every claim known, so one dropped
       against a chamber the author moves LATER in the list finds it at its new place, and a drop made before an annex
       existed keeps off that annex's host (a reshape counts from where it stands in the list, in each pass) */
    reshaped = {}; edits.forEach(claim);
    reshaped = {}; edits.forEach(claim);
    var claimedEnds = {}; Object.keys(endClaimed).forEach(function (j) { claimedEnds[endClaimed[j]] = true; });
    /* the chambers: the first n reservations of each kind. One whose spot the author's space has taken, or one asked
       for past the reservations, is dug afterwards at the first free SLOT that fits — the anchor of an undug
       reservation, or an anchor the deal left — and keeps its id and name */
    var displaced = [], slots = [], short = {};
    kinds.forEach(function (kind) {
      var K = SITE.rooms[kind], n = P.rooms[kind] !== undefined ? P.rooms[kind] : K.count[si], j, id, r;
      for (j = 0; j < n || j < reserved[kind].length; j++) {
        id = slotId(kind, j); r = reserved[kind][j] || null;
        if (j >= n || portalIds[id] === "down") { if (r) slots.push(r.anchor); continue; }   /* past the count, or pinned as a way down (the pin IS this slot's chamber): not dug here */
        if (!r || hitsAny(r.poly, live(where[id], id))) { displaced.push({ kind: kind, id: id, name: r ? r.name : null }); continue; }
        addRoom(id, kind, K.word, r.name, r, r.K, null);
      }
    });
    anchors.forEach(function (a) { if (!a.taken) slots.push(a); });
    displaced.forEach(function (d) {
      var K = SITE.rooms[d.kind], KV = kindShape(K, d.id), r = null, i, a, KA;
      for (i = 0; i < slots.length && !r; i++) {
        a = slots[i]; if (a.used || a.room < half(KV)) continue;
        KA = shapeFor(K, a, d.id, KV); r = fitAt(KA, a, jit(d.id, 3) < 0.5 ? 1 : -1, live(where[d.id], d.id), null); if (r) { a.used = true; KV = KA; }
      }
      if (!r) { short[d.kind] = (short[d.kind] || 0) + 1; return; }
      addRoom(d.id, d.kind, K.word, d.name || namerFor(d.kind).town(d.kind, { bearing: bearingOf(r.c), name: S.town.name }, K.patterns), r, KV, null);
    });
    kinds.forEach(function (kind) { var K = SITE.rooms[kind], n = P.rooms[kind] !== undefined ? P.rooms[kind] : K.count[si]; if (short[kind]) warnings.push("only " + (n - short[kind]) + " of " + n + " " + K.word + (n === 1 ? "" : "s") + " found room beside the passages"); });
    /* a cluster's nodes that no catalogue chamber took (the counts being what they are) are plain chambers, numbered by
       node — a cavern is never left as a bare meeting of necks */
    if (cluster) anchors.forEach(function (a) {
      if (!a.node) return;
      var j; for (j = 0; j < rooms.length; j++) if (G.dist([rooms[j].x, rooms[j].y], a.p) < 2) return;   /* its own chamber already stands on it (a neighbour's lobe may reach over it: that is the look) */
      var id = "vault-" + (a.index + 1), K = nodeShape(J, a.node, id), r = fit(K, [{ kind: "junction", c: a.p, ang: a.ang, passages: a.passages, loose: true }], live(-1), null);
      if (!r) return;
      addRoom(id, "vault", J.word, namer.town("vault", { bearing: bearingOf(a.p), name: S.town.name }, J.patterns), r, K, null);
    });
    /* an alcove at every bare dead end (a side passage's, or a star arm's), so no passage ends in nothing; named
       whether or not it fits; an end the author has taken gets none */
    var ends = 0;
    passages.forEach(function (p) {
      if (p.kind === "door") return;
      [[p.a, p.pts[0], p.pts[1]], [p.b, p.pts[1], p.pts[0]]].forEach(function (end) {
        var v = end[0], at = end[1], from = end[2];
        if (deg[v] !== 1 || inV[v]) return;
        ends++;
        var ang = Math.atan2(at[1] - from[1], at[0] - from[0]), K = exact(DE, "alcove-" + ends), dug = dig(K, { kind: "end", at: at, ux: Math.cos(ang), uy: Math.sin(ang), passage: p });
        var name = namerFor("alcove").town("alcove", { bearing: bearingOf(dug.c), name: S.town.name }, DE.patterns);
        if (claimedEnds[key(at)] || conflicts(dug.poly, p.id, live(-1), null)) return;
        addRoom("alcove-" + ends, "alcove", DE.word, name, dug, K, null);
      });
    });
    /* the edits, in order, over the dug chambers; a dangling id or a spot with no room is a warning, never silent */
    function portalWord(id) { var p = null; S.portals.forEach(function (q) { if (q.id === id) p = q; }); return (p.way === "down" ? SITE.rooms[p.kind].word : SITE.portalRooms[p.kind].word) + " at " + (p.name || id); }
    function noRoom(e) { return "edit " + e.op + " " + e.id + ": no room beside a passage, at a dead end or against a chamber within " + Math.round(SNAP * S.mPerUnit) + " m of the point"; }
    /* an annex is dug only onto a host that stands where it was built: the door's inner end must lie in the host (a host
       dug elsewhere would leave the annex floating in the rock, a door into nothing) */
    function hostStands(r) {   /* against the host as it WILL stand: its claim when the author moves it (its move may be applied after this edit), else the dug chamber */
      var hid = r.place.room, i = roomIndex(hid), poly = where[hid] !== undefined && blocked[where[hid]] ? blocked[where[hid]] : i >= 0 ? rooms[i].poly : null;
      return !!poly && G.pointInPolygon(r.door.pts[0], poly);
    }
    function ontoWord(id) { var i = roomIndex(id); return i >= 0 ? rooms[i].name : id; }
    function hostGone(r, id) { var i = roomIndex(r.place.room); return i < 0 ? "the chamber it was to be built onto is not there" : rooms[i].name + " no longer stands where " + id + " was to be built onto it"; }
    edits.forEach(function (e, k) {
      var i = roomIndex(e.id), r = targets[k], K, word, room, rs, cur;
      if (portalIds[e.id] === "up") { warnings.push("edit " + e.op + " " + e.id + ": the " + portalWord(e.id) + " is the level above's — edit it there"); return; }
      if (portalIds[e.id] === "down" && e.op !== "rename" && e.op !== "note") { warnings.push("edit " + e.op + " " + e.id + ": the " + portalWord(e.id) + " is pinned so the level below keeps its way up — it can be renamed and noted, not moved, removed or reshaped"); return; }
      if (e.op === "add") {
        if (i >= 0) { warnings.push("edit add " + e.id + ": already in the dungeon"); return; }
        if (!r) { warnings.push(noRoom(e)); return; }
        if (r.place.kind === "annex" && !hostStands(r)) { warnings.push("edit add " + e.id + ": " + hostGone(r, e.id)); return; }
        K = SITE.rooms[e.kind]; word = e.kind === CUSTOM ? String(e.word).trim() : K.word;
        room = addRoom(e.id, e.kind, word, e.name ? String(e.name) : e.kind === CUSTOM ? U.titleCase(word) : namerFor("authored/" + e.kind).town(e.kind, { bearing: bearingOf(r.c), name: S.town.name }, K.patterns), r, currentShape(e.id), null, true);
        if (r.place.kind === "annex") { room.annex = r.place.room; room.annexAt = r.place.rel; }
        if (ontoMissed[e.id]) warnings.push("edit add " + e.id + ": not built onto " + ontoWord(e.onto.id) + " as before — " + ontoMissed[e.id] + "; placed from its point instead");
      } else if (e.op === "remove") {
        if (i < 0) { warnings.push("edit remove " + e.id + ": no chamber with that id"); return; }
        rooms.splice(i, 1); delete doorOf[e.id]; delete placeOf[e.id];
        rooms.filter(function (x) { return x.annex === e.id; }).forEach(function (x) { rooms.splice(roomIndex(x.id), 1); delete doorOf[x.id]; delete placeOf[x.id]; warnings.push("edit remove " + e.id + ": " + x.name + " was built onto it and goes with it"); });
      } else if (e.op === "rename") {
        if (i < 0) { warnings.push("edit rename " + e.id + ": no chamber with that id"); return; }
        rooms[i].name = String(e.name); rooms[i].renamed = true;
      } else if (e.op === "note") {
        if (i < 0) { warnings.push("edit note " + e.id + ": no chamber with that id"); return; }
        if (e.note.trim()) rooms[i].note = e.note.trim(); else delete rooms[i].note;
      } else if (e.op === "move") {
        if (i < 0) { warnings.push("edit move " + e.id + ": no chamber with that id"); return; }
        if (!r) { warnings.push(noRoom(e) + " — it stays"); return; }
        if (r.place.kind === "annex" && !hostStands(r)) { warnings.push("edit move " + e.id + ": " + hostGone(r, e.id) + " — it stays"); return; }
        setPoly(rooms[i], r.poly, r.K); placeOf[e.id] = r.place; setDoor(rooms[i], r);
        if (r.place.kind === "annex") { rooms[i].annex = r.place.room; rooms[i].annexAt = r.place.rel; } else { delete rooms[i].annex; delete rooms[i].annexAt; }
        if (ontoMissed[e.id]) warnings.push("edit move " + e.id + ": not built onto " + ontoWord(e.onto.id) + " as before — " + ontoMissed[e.id] + "; placed from its point instead");
      } else if (e.op === "door") {
        if (i < 0) { warnings.push("edit door " + e.id + ": no chamber with that id"); return; }
        if (!rooms[i].door) { warnings.push("edit door " + e.id + ": " + rooms[i].name + " has no doorway (it stands open on the passage)"); return; }
        rooms[i].door = e.state;
      } else if (e.op === "reshape") {
        if (i < 0) { warnings.push("edit reshape " + e.id + ": no chamber with that id"); return; }
        room = rooms[i]; cur = shapeOf_[e.id]; rs = { size: sizeOf(e), shape: e.shape || room.shape };
        K = shapeOf(room.kind, rs.size, rs.shape, cur, e.id);
        if (!K) { warnings.push("edit reshape " + e.id + ": a " + room.word + " keeps its shape"); return; }
        r = fit(K, [placeOf[e.id]], live(where[e.id], e.id), e.id);
        if (!r) { warnings.push("edit reshape " + e.id + ": no room for a " + (rs.size ? rs.size.join(" × ") + " m " : "") + rs.shape + " chamber where it stands — it stays as it is"); return; }
        setPoly(room, r.poly, K); shapeOf_[e.id] = K; setDoor(room, r);
      }
    });
    /* the doors: one per chamber that has one, with the chamber's id and what stands in it (a door at a passage mouth is as wide as the passage) */
    Object.keys(doorOf).forEach(function (id) { var j = roomIndex(id); if (j < 0) return; passages.push({ id: "p" + passages.length, kind: "door", pts: doorOf[id].pts, width: doorOf[id].width || WIDTH.door, room: id, state: rooms[j].door }); });
    /* the geology the GM must know: WATER. A chamber whose kind holds water (`water` on the catalogue entry: the share of
       its floor — a cave pool, a grotto) gets a pool: a smaller blob of the chamber's own make, set toward the back of
       the chamber away from the necks that enter it, clipped inside its walls; it rides on the room as `water {kind,
       poly}`, so the digest, the card and the game know where the footing ends */
    var fedOdds = S.water ? FED_ODDS[S.sea ? "sea" : "land"] : null;
    function fedOf(id) { if (!fedOdds) return "seep"; var u = NS.Rng(seed + "/water/" + id).float(), acc = 0, k; for (k = 0; k < fedOdds.length; k++) { acc += fedOdds[k][1]; if (u < acc) return fedOdds[k][0]; } return fedOdds[fedOdds.length - 1][0]; }
    rooms.forEach(function (r) {
      var K = SITE.rooms[r.kind]; if (!K || !K.water) return;
      var c = [r.x, r.y], ins = [], k2, p2, dx = 0, dy = 0;
      for (k2 = 0; k2 < passages.length; k2++) { p2 = passages[k2]; if (p2.kind === "door") continue; [p2.pts[0], p2.pts[1]].forEach(function (q) { if (G.pointInPolygon(q, r.poly)) ins.push(q); }); }
      var ext = M.extents(r.poly), half = Math.min(ext.along, ext.across) / 2;
      ins.forEach(function (q) { var l = G.dist(q, c) || 1; dx += (c[0] - q[0]) / l; dy += (c[1] - q[1]) / l; });
      var l2 = Math.sqrt(dx * dx + dy * dy); if (l2 > 0.1) { dx /= l2; dy /= l2; } else { dx = Math.cos(ext.angle); dy = Math.sin(ext.angle); }
      var rp = half * Math.sqrt(K.water), pc = [c[0] + dx * half * 0.35, c[1] + dy * half * 0.35], poly = blob(pc, ext.angle, rp * 2.2, rp * 1.7, r.id + "/pool"), inner = M.insetConvex(r.poly, 2.5) || r.poly, i2, a2, b2, ex, ey, ln, nx, ny, sgn = G.signedArea(inner) > 0 ? 1 : -1;
      for (i2 = 0; i2 < inner.length && poly.length >= 3; i2++) { a2 = inner[i2]; b2 = inner[(i2 + 1) % inner.length]; ex = b2[0] - a2[0]; ey = b2[1] - a2[1]; ln = Math.sqrt(ex * ex + ey * ey) || 1; nx = -ey / ln * sgn; ny = ex / ln * sgn; poly = M.clipHalf(poly, nx, ny, nx * a2[0] + ny * a2[1]); }
      if (poly.length >= 3 && Math.abs(G.signedArea(poly)) > 4) r.water = { kind: "pool", poly: roundPts(poly), fed: fedOf(r.id) };
    });
    stats.rooms = U.round(NS.terrain.now() - t0, 1);
    /* the extent: the tight box around the plan, inside the frame — what the scene draws and the viewer fits */
    var ext = [Infinity, Infinity, -Infinity, -Infinity];
    function grow(p) { if (p[0] < ext[0]) ext[0] = p[0]; if (p[1] < ext[1]) ext[1] = p[1]; if (p[0] > ext[2]) ext[2] = p[0]; if (p[1] > ext[3]) ext[3] = p[1]; }
    passages.forEach(function (p) { p.pts.forEach(grow); }); rooms.forEach(function (r) { r.poly.forEach(grow); });
    ext = [Math.max(0, ext[0] - EXTENT_PAD), Math.max(0, ext[1] - EXTENT_PAD * 1.6), Math.min(W, ext[2] + EXTENT_PAD), Math.min(H, ext[3] + EXTENT_PAD)];
    if (ext[2] - ext[0] < 420) { var cx = (ext[0] + ext[2]) / 2; ext[0] = Math.max(0, cx - 210); ext[2] = Math.min(W, cx + 210); }
    if (ext[3] - ext[1] < 300) { var cy = (ext[1] + ext[3]) / 2; ext[1] = Math.max(0, cy - 150); ext[3] = Math.min(H, cy + 150); }
    ext = roundPts([[ext[0], ext[1]], [ext[2], ext[3]]]); ext = [ext[0][0], ext[0][1], ext[1][0], ext[1][1]];

    /* the water. A sewer: a channel down every main passage and the drain. A cave with water: at most one short STREAM,
       from a spring pool to the nearest sink (below) */
    var channels = [], streamSource = null, streamSink = null;
    function chan(p) { var w = U.round(p.width * 0.32, 2); return roundPts([[p.pts[0][0], p.pts[0][1], w], [p.pts[1][0], p.pts[1][1], w]]); }
    if (SITE.channel === true) channels = passages.filter(function (p) { return p.kind === "main" || p.kind === "drain"; }).map(chan);
    else if (SITE.channel === "stream" && S.water) {
      /* a SPRING pool's water runs to the lowest point near it — another pool, or the mouth — when one lies within
         STREAM_REACH of passage: Dijkstra by passage length from the spring's vertex, stopped at the first sink. The
         springs farthest from the mouth are tried first; a cave has one stream or none (a spring with no sink in reach
         drains away through the floor). Every reach runs WITH the flow, the first from the middle of the spring's
         pool, the last into the middle of the sink's, so the scene can chain them into one course */
      var mouthV = String(pv[ways[0].id]), mouthP = [ways[0].x, ways[0].y], adjP = {}, vAt = {}, poolV = {}, pools = rooms.filter(function (r) { return r.water; });
      passages.forEach(function (p) { if (p.kind === "door") return; (adjP[p.a] = adjP[p.a] || []).push(p); (adjP[p.b] = adjP[p.b] || []).push(p); vAt[p.a] = p.pts[0]; vAt[p.b] = p.pts[1]; });
      function middle(r) { var cx = 0, cy = 0; r.water.poly.forEach(function (q) { cx += q[0]; cy += q[1]; }); return [cx / r.water.poly.length, cy / r.water.poly.length]; }
      function nearestV(pt) { var best = null, bd = Infinity; Object.keys(vAt).forEach(function (v) { var d = G.dist(vAt[v], pt); if (d < bd) { bd = d; best = v; } }); return best; }
      function reach(a, b, w) { return roundPts([[a[0], a[1], w], [b[0], b[1], w]]); }
      pools.forEach(function (r) { var v = nearestV([r.x, r.y]); if (v !== null && !poolV[v]) poolV[v] = r; });
      var springs = pools.filter(function (r) { return r.water.fed === "spring"; }).sort(function (a, b) { return G.dist([b.x, b.y], mouthP) - G.dist([a.x, a.y], mouthP); }), si, src, srcV, dist, prevP, done, found, cur, cd, at, p2, up, w0, sink;
      for (si = 0; si < springs.length && !streamSource; si++) {
        src = springs[si]; srcV = nearestV([src.x, src.y]); if (srcV === null) continue;
        dist = {}; prevP = {}; done = {}; found = null; dist[srcV] = 0;
        for (;;) {
          cur = null; cd = Infinity; Object.keys(dist).forEach(function (v) { if (!done[v] && dist[v] < cd) { cd = dist[v]; cur = v; } });
          if (cur === null || cd > STREAM_REACH) break;
          done[cur] = true;
          if (cur !== srcV && ((poolV[cur] && poolV[cur] !== src) || cur === mouthV)) { found = cur; break; }
          (adjP[cur] || []).forEach(function (p) { var o = String(p.a) === cur ? String(p.b) : String(p.a), nd = cd + G.dist(p.pts[0], p.pts[1]); if (dist[o] === undefined || nd < dist[o]) { dist[o] = nd; prevP[o] = p; } });
        }
        if (!found) continue;
        at = found;
        while (prevP[at]) { p2 = prevP[at]; up = String(p2.a) === at ? String(p2.b) : String(p2.a); channels.unshift(reach(vAt[up], vAt[at], U.round(p2.width * 0.32, 2))); at = up; }
        w0 = channels.length ? channels[0][0][2] : 3;
        if (G.dist(middle(src), vAt[srcV]) > 2) channels.unshift(reach(middle(src), vAt[srcV], w0));
        streamSource = src.id;
        if (poolV[found] && poolV[found] !== src) { sink = poolV[found]; if (G.dist(vAt[found], middle(sink)) > 2) channels.push(reach(vAt[found], middle(sink), channels[channels.length - 1][1][2])); streamSink = sink.id; }
        else streamSink = ways[0].id;
      }
    }
    var length = 0; passages.forEach(function (p) { if (p.kind !== "door") length += G.dist(p.pts[0], p.pts[1]); });
    /* portals: the ways up (the parent's ids and coordinates, pointing back), then every chamber that is a way down */
    var upTo = { generator: S.above.generator }; if (S.above.site) upTo.site = S.above.site;
    var portals = S.portals.map(function (p) { var room = rooms[roomIndex(p.id)]; return p.way === "down" ? { id: p.id, kind: p.kind, name: room ? room.name : p.name, x: p.x, y: p.y, way: "down", pinned: true, to: { generator: "dungeon", site: SITE.below, id: p.id } } : { id: p.id, kind: p.kind, name: p.name, x: p.x, y: p.y, way: "up", to: U.extend({}, upTo, { id: p.id }) }; });
    rooms.forEach(function (r) { var K = SITE.rooms[r.kind]; if (K && K.portal && !portalIds[r.id]) portals.push({ id: r.id, kind: K.portal.kind, name: r.name, x: r.x, y: r.y, way: "down", to: { generator: "dungeon", site: SITE.below, id: r.id } }); });
    /* a built site NUMBERS its chambers on the plan (`labels: "numbers"`: plaques would cover a plan this dense; the
       name shows on a hover or a press): every room that would carry a plaque — all but a landing — gets `no`, 1-based,
       in walking order from the stair: by station along the axis (within a few units), a pair at one station left to
       right as the walker sees it */
    if (axis && SITE.labels === "numbers") {
      var o0 = [S.portals[0].x, S.portals[0].y], oca = Math.cos(axis.ang), osa = Math.sin(axis.ang);
      rooms.filter(function (r) { return r.kind !== "stair" && r.kind !== "outfall"; })
        .map(function (r) { return { r: r, t: Math.round(((r.x - o0[0]) * oca + (r.y - o0[1]) * osa) / 4), s: (r.x - o0[0]) * osa - (r.y - o0[1]) * oca }; })
        .sort(function (a, b) { return a.t - b.t || b.s - a.s || (a.r.id < b.r.id ? -1 : 1); })
        .forEach(function (o, i) { o.r.no = i + 1; });
    }
    var title = P.title || SITE.title(S.town.name, S.depth);
    var doc = {
      format: NS.DOC_FORMAT, ver: NS.DOC_VER, generator: { name: "dungeon", version: NS.VERSION },
      seed: seed, params: P,
      frame: { width: W, height: H, kmPerUnit: S.mPerUnit / 1000, mPerUnit: S.mPerUnit },
      title: { name: title, kind: S.kind },
      site: S, kind: S.kind, depth: S.depth, plan: axis ? axis.scheme : undefined, centre: roundPts([centre])[0], extent: ext,
      passages: passages.map(function (p) { var o = { id: p.id, kind: p.kind, pts: roundPts(p.pts), width: p.width }; if (p.kind === "door") { o.room = p.room; o.state = p.state; } return o; }),
      rooms: rooms,
      portals: portals,
      water: { channels: channels, source: streamSource, sink: streamSink },
      warnings: warnings,
      stats: U.extend({ passages: passages.length, rooms: rooms.length, lengthM: Math.round(length * S.mPerUnit) }, stats)
    };
    doc.stats.total = U.round(stats.spine + stats.rooms, 1);
    return doc;
  }

  /* ── nesting ── the params for the dungeon behind one of a parent's portals down (null: the first way down): its
     kind from the portal, every portal down of that kind (so all the grates and the outfall open into ONE sewer, all
     the stairs into ONE level below), what to follow and what to draw faintly above, the town's name, size and culture */
  function waysDown(doc, portalId, what) {
    var downs = (doc.portals || []).filter(function (p) { return p.to && p.to.generator === "dungeon" && p.way !== "up"; }), portal = null;
    var downKinds = doc.generator.name === "dungeon" && SITES[doc.kind] ? Object.keys(SITES[doc.kind].rooms).filter(function (k) { return SITES[doc.kind].rooms[k].portal; }) : [];
    NS.assert(downs.length, "no way down: this " + what + " has no " + (doc.generator.name === "town" ? "sewer entrance (add one with an edit of kind sewer)" : doc.generator.name === "interior" ? "stair down (a temple has a crypt stair, a keep a stair to its dungeons)" : "way down (add a chamber of kind " + downKinds.join("|") + ")"), { portals: (doc.portals || []).map(function (p) { return p.id; }) });
    if (portalId === null || portalId === undefined) portal = downs[0];
    else downs.forEach(function (p) { if (p.id === portalId) portal = p; });
    NS.assert(portal, "no portal with that id leads down from this " + what, { portalId: portalId, known: downs.map(function (p) { return p.id; }) });
    var kind = portal.to.site;
    return { kind: kind, portals: downs.filter(function (p) { return p.to.site === kind; }).map(function (p) { return { id: p.id, kind: p.kind, name: p.name, x: p.x, y: p.y }; }) };
  }
  /* the town's inputs scaled into dungeon units: k = the town's metres per unit over the dungeon's (1.25 / 0.5), so a
     grate at town (x, y) is at dungeon (kx, ky) — the same place in metres — and a street of 500 m is 500 m of tunnel */
  function fromTown(townDoc, portalId) {
    NS.assert(townDoc && townDoc.format === NS.DOC_FORMAT && townDoc.generator && townDoc.generator.name === "town", "fromTown needs a town document", { format: townDoc && townDoc.format, generator: townDoc && townDoc.generator });
    var w = waysDown(townDoc, portalId, "town"), k = townDoc.frame.mPerUnit / M_PER_UNIT;
    function pt(p) { return p.length > 2 ? [U.round(p[0] * k, 1), U.round(p[1] * k, 1), U.round(p[2] * k, 2)] : [U.round(p[0] * k, 1), U.round(p[1] * k, 1)]; }
    var site = {
      kind: w.kind, town: { name: townDoc.title.name, size: townDoc.size },
      portals: w.portals.map(function (p) { return { id: p.id, kind: p.kind, name: p.name, x: U.round(p.x * k, 1), y: U.round(p.y * k, 1) }; }),
      streets: townDoc.streets.map(function (s) { return { kind: s.kind, pts: s.pts.map(pt) }; }),
      centre: pt(townDoc.centre), radius: U.round(townDoc.radius * k, 1),
      walls: townDoc.walls ? townDoc.walls.chains.map(function (ch) { return (ch.closed ? ch.pts.concat([ch.pts[0]]) : ch.pts).map(pt); }) : [],
      river: townDoc.water && townDoc.water.river ? townDoc.water.river.pts.map(pt) : null,
      mPerUnit: M_PER_UNIT,
      above: { generator: "town", site: null, name: townDoc.title.name }, depth: 1
    };
    return { seed: townDoc.seed + "/" + w.kind, width: Math.ceil(townDoc.frame.width * k), height: Math.ceil(townDoc.frame.height * k), culture: townDoc.params.culture, title: null, site: site };
  }
  /* the caves behind a region's cave mouth (null: the first): the mouth is the one way in, at the frame's edge on the side
     the mouth faces (the cave runs the other way, into the rock — the spine's heading), the way up leads to the REGION
     at that mouth's id; the "town" is the cave's own name and the extent of the system behind the mouth; the words of
     where it lies (for the caption and the digest) and whether water runs in it come from the region's site */
  var EXTENT_SIZE = { small: "hamlet", modest: "village", great: "town", vast: "city" }, CAVE_W = 1200, CAVE_H = 900, CRYPT_W = 1000, CRYPT_H = 700;
  function fromRegion(regionDoc, caveId) {
    NS.assert(regionDoc && regionDoc.format === NS.DOC_FORMAT && regionDoc.generator && regionDoc.generator.name === "region", "fromRegion needs a region document", { format: regionDoc && regionDoc.format, generator: regionDoc && regionDoc.generator });
    var caves = regionDoc.caves || [], cave = null;
    NS.assert(caves.length, "this region has no caves (the caves parameter is 0, or no ground was steep enough)", { caves: regionDoc.params && regionDoc.params.caves });
    if (caveId === null || caveId === undefined) cave = caves[0]; else caves.forEach(function (c) { if (c.id === caveId) cave = c; });
    NS.assert(cave, "no cave with that id on this region", { caveId: caveId, known: caves.map(function (c) { return c.id; }) });
    var facing = BEARINGS.indexOf(cave.site.facing) >= 0 ? cave.site.facing : "S", u = dirOf(facing), W = CAVE_W, H = CAVE_H;
    var mouth = [U.round(W / 2 + u[0] * (W / 2 - 90), 1), U.round(H / 2 + u[1] * (H / 2 - 90), 1)];
    var site = {
      kind: "cave", town: { name: cave.name, size: EXTENT_SIZE[cave.site.extent] || "village" },
      portals: [{ id: cave.id, kind: "cave", name: "The Mouth", x: mouth[0], y: mouth[1] }],   /* the landing at the mouth; the cave's own name is the title */
      streets: [], centre: [W / 2, H / 2], radius: Math.min(W, H) * 0.4, walls: [], river: null, mPerUnit: M_PER_UNIT,
      above: { generator: "region", site: null, name: regionDoc.title.name }, depth: 1,
      where: NS.region.caveWhere(cave), water: !!cave.site.water, sea: !!cave.site.coastal, heading: BEARINGS[(BEARINGS.indexOf(facing) + 4) % 8]
    };
    return { seed: regionDoc.seed + "/" + cave.id, width: W, height: H, culture: regionDoc.params.culture, title: null, site: site };
  }
  /* the level below a dungeon: its stairs are the ways in, there are no streets to follow (a star of corridors from
     the parent's hub — or, below a cave, a wander of its own), the parent's tunnels show faintly above */
  function fromDungeon(parentDoc, portalId) {
    NS.assert(parentDoc && parentDoc.format === NS.DOC_FORMAT && parentDoc.generator && parentDoc.generator.name === "dungeon", "fromDungeon needs a dungeon document", { format: parentDoc && parentDoc.format, generator: parentDoc && parentDoc.generator });
    var w = waysDown(parentDoc, portalId, "dungeon");
    var site = {
      kind: w.kind, town: parentDoc.site.town, portals: w.portals,
      streets: [], centre: parentDoc.centre, radius: parentDoc.site.radius,
      walls: parentDoc.passages.filter(function (p) { return p.kind !== "door"; }).map(function (p) { return p.pts; }),
      river: null, mPerUnit: parentDoc.frame.mPerUnit,
      above: { generator: "dungeon", site: parentDoc.kind, name: parentDoc.title.name }, depth: (parentDoc.site.depth || 1) + 1,
      where: parentDoc.site.where || null, water: !!parentDoc.site.water, sea: !!parentDoc.site.sea
    };
    return { seed: parentDoc.seed + "/" + w.kind, width: parentDoc.frame.width, height: parentDoc.frame.height, culture: parentDoc.params.culture, title: null, site: site };
  }

  /* the crypt beneath a temple, the dungeons beneath a keep: the building's portal down (a room that is a stair down) is
     the one way in, set near the middle of a frame of the dungeon's own; the floor's outline is scaled from the
     interior's 5 cm units to the dungeon's 0.5 m (× 0.1) and drawn faintly above, the stair room over the stair */
  function fromInterior(interiorDoc, portalId) {
    NS.assert(interiorDoc && interiorDoc.format === NS.DOC_FORMAT && interiorDoc.generator && interiorDoc.generator.name === "interior", "fromInterior needs an interior document", { format: interiorDoc && interiorDoc.format, generator: interiorDoc && interiorDoc.generator });
    var w = waysDown(interiorDoc, portalId, "building"), k = interiorDoc.frame.mPerUnit / M_PER_UNIT, W = CRYPT_W, H = CRYPT_H, p0 = w.portals[0], room = null, floor = null;
    interiorDoc.rooms.forEach(function (r) { if (r.id === p0.id) room = r; });
    interiorDoc.floors.forEach(function (f) { if (room && f.level === room.floor) floor = f; });
    var sx = W / 2 - p0.x * k, sy = H * 0.42 - p0.y * k, place = function (q) { return [U.round(q[0] * k + sx, 1), U.round(q[1] * k + sy, 1)]; };
    var portals = w.portals.map(function (p) { var at = place([p.x, p.y]); return { id: p.id, kind: p.kind, name: p.name, x: at[0], y: at[1] }; });
    var outline = floor ? floor.outline.map(place) : [], town = interiorDoc.site.town || {};
    var site = {
      kind: w.kind, town: { name: interiorDoc.title.name, size: NS.own(SIZE_INDEX, town.size) !== undefined ? town.size : "town" }, portals: portals,
      streets: [], centre: [W / 2, H * 0.58], radius: Math.min(W, H) * 0.22, walls: outline.length ? [outline.concat([outline[0]])] : [], river: null, mPerUnit: M_PER_UNIT,
      above: { generator: "interior", site: interiorDoc.kind, name: interiorDoc.title.name }, depth: 1,
      where: "beneath " + interiorDoc.title.name + (town.name ? " in " + town.name : ""), water: false, sea: false
    };
    return { seed: interiorDoc.seed + "/" + w.kind, width: W, height: H, culture: interiorDoc.params.culture, title: null, site: site };
  }

  /* ── a chamber's size ── `dimensions(room, mPerUnit)` → { along, across, r|null, text } in metres ("7 × 6 m", or
     "11 m across" for a round one) — what the card's Size field shows and the author types over */
  function dimensions(room, mPerUnit) {
    var poly = room.poly, c = [room.x, room.y], m = mPerUnit || 1, along, across, r;
    if (room.shape === "cavern") {   /* its longest span, and the widest span across that: "18 × 9 m", or "11 m across" when they are near */
      var i, j, d, best = 0, bi = 0, bj = 1, ux, uy, lo = Infinity, hi = -Infinity, v;
      for (i = 0; i < poly.length; i++) for (j = i + 1; j < poly.length; j++) { d = G.dist(poly[i], poly[j]); if (d > best) { best = d; bi = i; bj = j; } }
      ux = (poly[bj][0] - poly[bi][0]) / (best || 1); uy = (poly[bj][1] - poly[bi][1]) / (best || 1);
      for (i = 0; i < poly.length; i++) { v = -uy * (poly[i][0] - poly[bi][0]) + ux * (poly[i][1] - poly[bi][1]); if (v < lo) lo = v; if (v > hi) hi = v; }
      along = best; across = hi - lo;
      var near = Math.abs(along - across) < 0.15 * along, txt = near ? Math.round((along + across) / 2 * m) + " m across" : Math.round(along * m) + " × " + Math.round(across * m) + " m";
      return { along: U.round(along * m, 1), across: U.round(across * m, 1), r: null, text: txt };
    }
    if (room.shape === "round") { r = 0; poly.forEach(function (p) { r += G.dist(p, c); }); r /= poly.length; return { along: U.round(2 * r * m, 1), across: U.round(2 * r * m, 1), r: U.round(r * m, 2), text: Math.round(2 * r * m) + " m across" }; }
    along = G.dist(poly[0], poly[1]); across = G.dist(poly[1], poly[2]);   /* as dug: along the passage, then across — the order the author typed */
    return { along: U.round(along * m, 1), across: U.round(across * m, 1), r: null, text: Math.round(along * m) + " × " + Math.round(across * m) + " m" };
  }

  /* ── for the fog of war ── `locate(doc, [x, y])`: the id of the room or passage under a point (null in the rock);
     `graph(doc)`: what adjoins what — {id: [ids]} over rooms and passages (a passage and the room its end lies in,
     two passages that meet, a door and its room and the passage it leaves) — so the game can reveal what the party
     sees from where it stands */
  function inBand(p, pass, slack) { return G.pointSegDist(p, pass.pts[0], pass.pts[1]) <= pass.width / 2 + (slack || 0); }
  function locate(doc, p) {
    var i, q;
    for (i = 0; i < doc.rooms.length; i++) if (G.pointInPolygon(p, doc.rooms[i].poly)) return doc.rooms[i].id;
    for (i = 0; i < doc.passages.length; i++) { q = doc.passages[i]; if (q.kind !== "door" && inBand(p, q, 0.3)) return q.id; }
    for (i = 0; i < doc.passages.length; i++) { q = doc.passages[i]; if (q.kind === "door" && inBand(p, q, 0.3)) return q.room; }
    return null;
  }
  function graph(doc) {
    var adj = {}, i, j, a, b;
    function link(x, y) { if (x === y) return; if (!adj[x]) adj[x] = []; if (!adj[y]) adj[y] = []; if (adj[x].indexOf(y) < 0) adj[x].push(y); if (adj[y].indexOf(x) < 0) adj[y].push(x); }
    doc.rooms.forEach(function (r) { adj[r.id] = adj[r.id] || []; }); doc.passages.forEach(function (p) { adj[p.id] = adj[p.id] || []; });
    for (i = 0; i < doc.passages.length; i++) {
      a = doc.passages[i];
      if (a.kind === "door") { link(a.id, a.room); for (j = 0; j < doc.rooms.length; j++) if (G.pointInPolygon(a.pts[0], doc.rooms[j].poly) || G.pointInPolygon(a.pts[1], doc.rooms[j].poly)) link(a.id, doc.rooms[j].id); for (j = 0; j < doc.passages.length; j++) { b = doc.passages[j]; if (b.kind !== "door" && (inBand(a.pts[0], b, 0.3) || inBand(a.pts[1], b, 0.3))) link(a.id, b.id); } continue; }
      for (j = 0; j < doc.rooms.length; j++) if (G.pointInPolygon(a.pts[0], doc.rooms[j].poly) || G.pointInPolygon(a.pts[1], doc.rooms[j].poly)) link(a.id, doc.rooms[j].id);
      for (j = i + 1; j < doc.passages.length; j++) { b = doc.passages[j]; if (b.kind === "door") continue; if (G.dist(a.pts[0], b.pts[0]) < 0.3 || G.dist(a.pts[0], b.pts[1]) < 0.3 || G.dist(a.pts[1], b.pts[0]) < 0.3 || G.dist(a.pts[1], b.pts[1]) < 0.3) link(a.id, b.id); }
    }
    return adj;
  }

  /* ── the reference point ── bearings and distances ("120 m NE of the market above", "at the mouth") are reckoned from
     the hub under the market, or, where the site says `reference: "way in"`, from the first way up (a cave's mouth, the
     shaft from the level above): { x, y, word, at } */
  function reference(doc) {
    var SITE = SITES[doc.kind], p = null;
    if (SITE && SITE.reference === "way in") (doc.portals || []).forEach(function (q) { if (!p && q.way === "up") p = q; });
    if (p) return U.extend({ x: p.x, y: p.y }, REF_WORDS[p.kind] || { word: "the way in", at: "at the way in" });
    return U.extend({ x: doc.centre[0], y: doc.centre[1] }, REF_DEFAULT);
  }
  function caption(doc) { return captionOf(doc.site); }
  function intro(doc) { return introOf(doc.site); }

  /* ── validate ── the dungeon document shape */
  function validate(doc) {
    ["passages", "rooms", "portals"].forEach(function (k) { NS.assert(Array.isArray(doc[k]), "document." + k + " must be an array", { key: k }); });
    NS.assert(NS.own(SITES, doc.kind), "document.kind must be one of " + Object.keys(SITES).join("|"), { kind: doc.kind });
    NS.assert(doc.frame.mPerUnit > 0, "document.frame.mPerUnit must be positive", { frame: doc.frame });
    NS.assert(U.isNum(doc.depth) && doc.depth >= 1, "document.depth must be a positive number of levels", { depth: doc.depth });
    NS.assert(Array.isArray(doc.extent) && doc.extent.length === 4 && doc.extent[2] > doc.extent[0] && doc.extent[3] > doc.extent[1], "document.extent must be [x0, y0, x1, y1]", { extent: doc.extent });
    NS.assert(doc.water && Array.isArray(doc.water.channels), "document.water.channels must be an array", { water: doc.water });
    doc.rooms.forEach(function (r) { if (r.water) NS.assert(r.water.kind === "pool" && Array.isArray(r.water.poly) && r.water.poly.length >= 3 && POOL_FED[r.water.fed], "a chamber's water must be a pool with a polygon and what feeds it (" + Object.keys(POOL_FED).join("|") + ")", { id: r.id, water: r.water }); });
    doc.passages.forEach(function (p, i) { NS.assert(p.id && NS.own(WIDTH, p.kind) && Array.isArray(p.pts) && p.pts.length === 2 && p.width > 0 && (p.kind !== "door" || (typeof p.room === "string" && NS.own(DOOR_STATES, p.state))), "passage " + i + " is malformed", { passage: p }); });
    var ids = {};
    doc.rooms.forEach(function (r, i) { NS.assert(r.id && !ids[r.id] && r.kind && typeof r.word === "string" && typeof r.name === "string" && Array.isArray(r.poly) && r.poly.length >= 3 && isFinite(r.x) && isFinite(r.y) && SHAPES[r.shape] && (r.door === null || DOOR_STATES[r.door]) && (r.note === undefined || typeof r.note === "string"), "room " + i + " is malformed or its id is not unique", { room: r }); ids[r.id] = true; });
    var pids = {};
    doc.portals.forEach(function (p, i) { NS.assert(p.id && !pids[p.id] && PORTAL_KINDS[p.kind] && (p.way === "up" || p.way === "down") && isFinite(p.x) && isFinite(p.y) && p.to && p.to.generator, "portal " + i + " is malformed or its id is not unique", { portal: p }); pids[p.id] = true; });
    return doc;
  }

  NS.dungeon = { generate: generate, DEFAULTS: DEFAULTS, M_PER_UNIT: M_PER_UNIT, SHEET: SHEET, SITES: SITES, sites: function () { return Object.keys(SITES); }, WIDTH: WIDTH, PORTAL_KINDS: PORTAL_KINDS, SIZE_INDEX: SIZE_INDEX, resolveParams: resolveParams, fromTown: fromTown, fromRegion: fromRegion, fromDungeon: fromDungeon, fromInterior: fromInterior, validate: validate, locate: locate, graph: graph, dimensions: dimensions, reference: reference, caption: caption, intro: intro, POOL_FED: POOL_FED, STREAM_REACH: STREAM_REACH,
    OPS: Object.keys(OPS), MAX_COUNT: MAX_COUNT, MAX_NAME: MAX_NAME, MAX_WORD: MAX_WORD, MAX_NOTE: MAX_NOTE, SNAP: SNAP, CUSTOM: CUSTOM, FOOTPRINTS: FOOTPRINTS, SIZE_M: SIZE_M, SHAPES: Object.keys(SHAPES), DOOR_STATES: DOOR_STATES, DEFAULT_FOOTPRINT: DEFAULT_FOOTPRINT, validateCounts: validateCounts, validateEdits: validateEdits };
})(typeof self !== "undefined" ? self : typeof global !== "undefined" ? global : this);

/* ───── 45-interior.js ───── */
/* 45-interior.js — the INTERIOR generator: the floor plan of ONE building — an inn, a smithy, a temple, a keep, a
   house —, the next scale down from the town. Its site context is the building's footprint (a town building's
   polygon, scaled to the interior's own units) and which side of it faces the street, the way a town's is the
   place's: NS.interior.fromTown(townDoc, portalId) → params for TnDMaps.generate("interior", params). A PROGRAM TABLE
   says what rooms a building of each kind wants (kind → word, target area, front or back, what furnishes it, what
   stands in its doorway) and how many floors it has; the core knows nothing of inns: it cuts the footprint into convex
   BLOCKS (a cross-shaped temple is a nave and two transepts), lays the main block out in BANDS — a front band on the
   street, a back band, a passage between them when the floor has rooms enough —, cuts each band into rooms by their
   target areas (a stair as a fixed slice at one end, the same on every floor so the flights stack), joins the rooms
   with doors along a spanning tree from the entrance (or the stair, above and below), opens the front door onto the
   street and a back door where the program has one, cuts windows in the outer walls and furnishes every room from the
   seed. Floors are drawn side by side on one sheet, like a published inn plan; every room is convex, so the grid, the
   hits and the fog of war work as in a dungeon. Portals: the doors out carry the town's id for the building, so the
   party steps back onto the town at the house it entered. Not in the document: pins, the fog (see 72, 70). */
(function (root) {
  "use strict";
  var NS = root.TnDMaps, U = NS.util, G = NS.geom, M = NS.mesh;

  /* the interior's own scale: 5 cm per unit (K units to the metre), fine enough for a room's name to sit inside it on
     the sheet; every distance below is written in metres × K */
  var M_PER_UNIT = 0.05, K = 1 / M_PER_UNIT, SIZE_INDEX = { hamlet: 0, village: 1, town: 2, city: 3 };
  var WALL = 0.3 * K, OUTER = 0.5 * K, DOOR_W = 1 * K, ENTRY_W = 1.3 * K, STAIR_W = 1.8 * K, MIN_W = 2.2 * K, MIN_D = 3.2 * K, CORRIDOR = 1.5 * K, MIN_SHARED = 1.6 * K;   /* a wall 0.3 m, an outer wall 0.5, a door 1, the front door 1.3, the stair slice 1.8, a room at least 2.2 wide and a band 3.2 deep, a passage 1.5, a shared wall at least 1.6 for a door */
  var WALL_GAP = 0.7 * K, EPS = 0.04 * K, TINY = 0.05 * K * K, SLIVER = 6 * K * K, MAX_DEEP = 5 * K;   /* two cells within WALL_GAP share a wall; a point within EPS of a line lies on it; a block under 6 m² is wall, not a room */
  var MARGIN = 72, TOP = 96, BOTTOM = 56, GAP = 44, MIN_FRAME_W = 520;   /* the sheet: floors side by side under the title, room at the sides for a door's banner */
  var STAIR_LEN = 7 * K;   /* a flight longer than this is a corridor: the stair's slice is cut where it stays shorter */
  var COURT_M2 = 320, COURT_MIN = 16 * K, COURT_SIDE = [6 * K, 12 * K], WALK = 1.8 * K;   /* a courtyard: a main block of 320 m² or more and 16 m each way holds a court of 6–12 m a side, a cloister walk of 1.8 m round it */
  var WINDOW_W = 1 * K, WINDOW_STEP = 4.5 * K, WINDOW_CLEAR = 1.7 * K;   /* a window every 4.5 m of outer wall, 1 m wide, clear of doors and corners */
  var MAX_NOTE = 400, MAX_NAME = 40, MAX_WORD = 40, MAX_COUNT = 8, CUSTOM = "custom", OPS = { add: 1, remove: 1, rename: 1, note: 1, door: 1 }, GENERATED_ID = /^([a-z]+)-(\d+)$/, ADD_M2 = [6, 60];   /* the author's say: counts per kind up to MAX_COUNT, an added room of 6–60 m² */
  var DOOR_STATES = { arch: "an open doorway", door: "a door", locked: "a locked door", barred: "a barred door", secret: "a secret door" };
  var DOOR_ODDS = { arch: 0.3, door: 0.7 };
  var FLOOR_NAMES = { "-1": "Cellar", "0": "Ground floor", "1": "Upper floor", "2": "Second floor", "3": "Third floor" };

  /* ── the program table ── a room spec: kind, word, m2 (its target area; the floor scales them to fit), at (front | back
     | any — which band), entry (the front door opens into it), hub (doors prefer it), fill (as many as the floor has room
     for, each of `m2`, between min and max), door (what stands in its doorway; the seed deals the rest), windows
     (false: none), furnish (the FURNISH recipe, when not its kind), entryW (a wider front door, metres: the stable's). A
     program: word, ground / upper / below (cellar) room lists, floors(areaM2, sizeIndex) → levels above the ground floor,
     cellar(areaM2, rng) → whether it has one, filler {ground, upper, cellar} (the room a floor larger than its program
     gets more of), blocks (a role → the room a side block of a non-convex footprint becomes: a temple's transepts),
     back (a back door from a room of this kind), corridor: false (never a passage), secretStair (the stair's
     ground-floor door is secret) */
  function R(kind, word, m2, at, extra) { return U.extend({ kind: kind, word: word, m2: m2, at: at || "any" }, extra || {}); }
  var CHAMBERS = R("chamber", "chamber", 15, "any", { fill: true, min: 1, max: 6 });
  var STORE = R("store", "storeroom", 8, "back", { door: "door", windows: false });
  function shop(word, work, extra) {
    return U.extend({ word: word, ground: [R("shop", word === "shop" ? "shop" : word, 28, "front", { entry: true, hub: true, furnish: "shop" }), work, R("hall", "hall", 20, "back"), R("chamber", "chamber", 12, "back"), STORE],
      upper: [CHAMBERS], floors: function (a) { return a < 90 ? 0 : 1; }, cellar: function (a, rng) { return rng.chance(0.3); }, back: "hall" }, extra || {});
  }
  var PROGRAMS = {
    house: { word: "house", ground: [R("hall", "hall", 30, "front", { entry: true, hub: true }), R("kitchen", "kitchen", 18, "back"), R("chamber", "chamber", 14, "back"), STORE],
      upper: [CHAMBERS], floors: function (a) { return a < 110 ? 0 : 1; }, cellar: function (a, rng) { return rng.chance(0.3); }, back: "kitchen" },
    inn: { word: "inn", ground: [R("common", "common room", 45, "front", { entry: true, hub: true }), R("kitchen", "kitchen", 20, "back"), R("pantry", "pantry", 9, "back", { door: "door", windows: false }), R("parlour", "parlour", 14, "any")],
      upper: [R("guest", "guest room", 14, "any", { fill: true, min: 2, max: 8, door: "door" }), R("keeper", "innkeeper's chamber", 14, "any", { door: "door" })], below: [R("cellar", "beer cellar", 30, "any", { door: "door" })],
      filler: { ground: R("room", "private room", 16, "back") }, floors: function (a) { return a < 150 ? 2 : 1; }, cellar: function () { return true; }, back: "kitchen" },
    tavern: { word: "tavern", ground: [R("taproom", "taproom", 40, "front", { entry: true, hub: true }), R("kitchen", "kitchen", 16, "back"), STORE],
      upper: [R("keeper", "tapster's chamber", 14, "any", { door: "door" }), R("chamber", "chamber", 13, "any", { fill: true, min: 1, max: 5, door: "door" })], below: [R("cellar", "beer cellar", 30, "any", { door: "door" })],
      filler: { ground: R("room", "back room", 16, "back") }, floors: function () { return 1; }, cellar: function () { return true; }, back: "kitchen" },
    smith: { word: "smithy", ground: [R("forge", "forge", 36, "front", { entry: true, hub: true, entryW: 1.6 }), R("workshop", "workshop", 16, "any"), R("hall", "hall", 20, "back"), R("chamber", "chamber", 12, "back"), STORE],
      filler: { ground: R("workshop", "workshop", 24, "any") }, upper: [CHAMBERS], floors: function (a, si) { return a < 130 || si < 2 ? 0 : 1; }, cellar: function () { return false; }, back: "hall" },
    apothecary: shop("apothecary", R("workshop", "still room", 16, "any", { furnish: "stillroom" })),
    baker: shop("bakery", R("workshop", "bakehouse", 20, "any", { furnish: "bakehouse" })),
    fishmonger: shop("fishmonger", R("workshop", "salting room", 14, "any", { furnish: "salting" })),
    carpenter: shop("carpenter's shop", R("workshop", "workshop", 28, "any", { furnish: "workshop" })),
    locksmith: shop("locksmith", R("workshop", "workshop", 14, "any", { furnish: "workshop" })),
    scribe: shop("scriptorium", null, { ground: [R("shop", "scriptorium", 28, "front", { entry: true, hub: true, furnish: "scriptorium" }), R("library", "library", 18, "any", { furnish: "library" }), R("hall", "hall", 18, "back"), R("chamber", "chamber", 12, "back"), STORE] }),
    seer: shop("seer's house", null, { ground: [R("shop", "consulting room", 24, "front", { entry: true, hub: true, furnish: "consulting" }), R("sanctum", "sanctum", 14, "any", { furnish: "sanctum", door: "door", windows: false }), R("hall", "hall", 18, "back"), R("chamber", "chamber", 12, "back"), STORE] }),
    harbourmaster: shop("harbourmaster's house", null, { ground: [R("shop", "office", 24, "front", { entry: true, hub: true, furnish: "office" }), R("store", "customs store", 24, "any", { furnish: "customs", door: "locked", windows: false }), R("hall", "hall", 18, "back"), R("chamber", "chamber", 12, "back")] }),
    stable: { word: "stable", ground: [R("stalls", "stalls", 50, "front", { entry: true, hub: true, entryW: 1.8 }), R("tack", "tack room", 12, "back", { door: "door" }), R("hay", "hay store", 14, "back", { door: "door", windows: false })],
      upper: [R("loft", "hayloft", 400, "any", { windows: false })], filler: { ground: R("stalls", "stalls", 36, "any") }, floors: function () { return 1; }, cellar: function () { return false; } },
    bathhouse: { word: "bathhouse", ground: [R("hall", "hall", 22, "front", { entry: true, hub: true }), R("bath", "bath hall", 45, "back"), R("furnace", "furnace room", 12, "back", { door: "door", windows: false }), R("changing", "changing room", 14, "any")],
      fill: false, upper: null, floors: function () { return 0; }, cellar: function () { return false; } },
    shrine: { word: "shrine", court: false, ground: [R("shrine", "shrine", 24, "front", { entry: true, hub: true }), R("cell", "priest's cell", 10, "back", { door: "door", furnish: "cell" })],
      fill: false, corridor: false, upper: null, floors: function () { return 0; }, cellar: function () { return false; } },
    temple: { word: "temple", court: false, ground: [R("nave", "nave", 60, "front", { entry: true, hub: true, entryW: 1.6 }), R("chancel", "chancel", 18, "back", { hub: true }), R("vestry", "vestry", 10, "back", { door: "door" }), R("cryptstair", "crypt stair", 6, "back", { door: "locked", windows: false, portal: { site: "crypt" } })],
      blocks: { side: R("transept", "transept", 0, "any", { furnish: "transept" }), end: R("chancel", "chancel", 0, "any", { hub: true }), porch: R("porch", "porch", 0, "any", { entry: true }) },
      fill: false, corridor: false, upper: null, floors: function () { return 0; }, cellar: function () { return false; } },
    keep: { word: "keep", ground: [R("hall", "great hall", 60, "front", { entry: true, hub: true, entryW: 1.6, furnish: "greathall" }), R("kitchen", "kitchen", 20, "back"), R("guardroom", "guardroom", 18, "front"), R("buttery", "buttery", 10, "back", { door: "door", windows: false })],
      upper: [R("solar", "solar", 24, "any", { hub: true }), R("lord", "lord's chamber", 18, "any", { door: "door", furnish: "chamber" }), R("chamber", "chamber", 16, "any", { fill: true, min: 1, max: 4, door: "door" }), R("chapel", "chapel", 12, "any", { door: "door" })],
      below: [R("cell", "cell", 8, "any", { fill: true, min: 2, max: 5, door: "barred", windows: false }), R("store", "store", 14, "any", { door: "door", windows: false }), R("dungeonstair", "dungeon stair", 6, "any", { door: "barred", windows: false, portal: { site: "dungeons" } })],
      floors: function (a) { return a < 500 ? 1 : 2; }, cellar: function () { return true; } },
    townHall: { word: "town hall", ground: [R("hall", "hall", 60, "front", { entry: true, hub: true, entryW: 1.6, furnish: "moothall" }), R("council", "council chamber", 24, "back"), R("clerk", "clerk's room", 12, "back", { door: "door", furnish: "office" })],
      upper: [R("upperhall", "upper hall", 40, "any", { hub: true, furnish: "council" }), R("chamber", "chamber", 16, "any", { fill: true, min: 1, max: 3, door: "door", furnish: "office" })], below: [R("strongroom", "strongroom", 20, "any", { door: "locked", windows: false })],
      floors: function () { return 1; }, cellar: function (a, rng) { return rng.chance(0.5); } },
    guild: { word: "guild hall", ground: [R("hall", "hall", 60, "front", { entry: true, hub: true, entryW: 1.6, furnish: "moothall" }), R("council", "masters' chamber", 24, "back", { furnish: "council" }), R("clerk", "clerk's room", 12, "back", { door: "door", furnish: "office" })],
      upper: [R("upperhall", "upper hall", 40, "any", { hub: true, furnish: "council" }), R("chamber", "chamber", 16, "any", { fill: true, min: 1, max: 3, door: "door", furnish: "office" })], below: [R("strongroom", "strongroom", 20, "any", { door: "locked", windows: false })],
      floors: function () { return 1; }, cellar: function (a, rng) { return rng.chance(0.5); } },
    moneylender: { word: "counting house", ground: [R("counting", "counting room", 24, "front", { entry: true, hub: true, furnish: "office" }), R("strongroom", "strongroom", 10, "back", { door: "locked", windows: false }), R("parlour", "parlour", 16, "back")],
      upper: [CHAMBERS], below: [R("strongroom", "vault", 16, "any", { door: "locked", windows: false })], floors: function () { return 1; }, cellar: function () { return true; } },
    thievesDen: { word: "house", ground: [R("hall", "hall", 26, "front", { entry: true, hub: true }), R("kitchen", "kitchen", 14, "back"), R("chamber", "chamber", 12, "back"), STORE],
      upper: [R("chamber", "chamber", 12, "any", { fill: true, min: 1, max: 4 })], below: [R("den", "den", 20, "any", { hub: true }), R("strongroom", "loot store", 10, "any", { door: "locked", windows: false })],
      floors: function () { return 1; }, cellar: function () { return true; }, back: "kitchen", secretStair: true },
    watch: { word: "watch house", ground: [R("guardroom", "guardroom", 30, "front", { entry: true, hub: true }), R("armoury", "armoury", 12, "back", { door: "locked", windows: false }), R("cell", "cell", 7, "back", { fill: true, min: 2, max: 3, door: "barred", windows: false })],
      upper: [R("barracks", "barracks", 30, "any", { hub: true }), R("captain", "captain's chamber", 14, "any", { door: "door", furnish: "office" })], below: null, floors: function () { return 1; }, cellar: function () { return false; } },
    gaol: { word: "gaol", ground: [R("gaoler", "gaoler's room", 22, "front", { entry: true, hub: true }), R("cell", "cell", 8, "back", { fill: true, min: 3, max: 8, door: "barred", windows: false })],
      upper: [R("cell", "cell", 8, "any", { fill: true, min: 2, max: 6, door: "barred", windows: false })], below: [R("cell", "oubliette", 7, "any", { fill: true, min: 2, max: 4, door: "barred", windows: false, furnish: "oubliette" })],
      filler: { cellar: R("cell", "oubliette", 7, "any", { door: "barred", windows: false, furnish: "oubliette" }) }, floors: function (a) { return a < 200 ? 1 : 0; }, cellar: function () { return true; } }
  };
  var DEFAULT_UPPER = [CHAMBERS], DEFAULT_CELLAR = [R("cellar", "cellar", 30, "any", { door: "door" })];
  /* a band deeper than MAX_DEEP holds two rows: the rooms that are not hubs go two to a column, one toward the passage
     (or the front) and one behind it, reached through it; a hub or the entry room takes the band's full depth */
  var STAIR = R("stair", "stair", 0, "back", { hub: true, fixed: STAIR_W, windows: false }), PASSAGE = R("passage", "passage", 0, "any", { hub: true });
  var COURT = R("court", "courtyard", 0, "any", { hub: true, windows: false, door: "arch", open: true }), WALKS = { ground: R("passage", "cloister", 0, "any", { hub: true }), upper: R("passage", "gallery", 0, "any", { hub: true }) };
  var NO_STAIR_PLAN = { stairCut: null, stairEnd: 1, corridor: true, side: false, two: false, yCut: 0, court: null };   /* a range of a courtyard: cut as a band beside a passage, no stair in it */
  var WING = R("wing", "wing", 0, "any"), CLOSET = R("closet", "closet", 0, "any", { door: "door", windows: false });
  function programOf(kind) { return NS.own(PROGRAMS, kind) ? kind : "house"; }
  /* the room kinds of a building's program the author may count, remove or add — every list's, the fillers' and the
     side blocks' — but never the stair or a passage, which the plan places */
  function roomKinds(kind) {
    var PR = PROGRAMS[programOf(kind)], out = [], seen = {};
    function take(list) { (list || []).forEach(function (s) { if (s && s.kind !== "stair" && s.kind !== "passage" && !seen[s.kind]) { seen[s.kind] = true; out.push(s.kind); } }); }
    take(PR.ground); take(PR.upper || DEFAULT_UPPER); take(PR.below || DEFAULT_CELLAR);
    var F = PR.filler || {}; take([F.ground, F.upper, F.cellar]); var B = PR.blocks || {}; take([B.side, B.end, B.porch]);
    return out;
  }
  /* the spec of a kind in a program (the first list that has it), for an added room of that kind */
  function specOf(PR, kind) {
    var found = null;
    function look(list) { (list || []).forEach(function (s) { if (s && s.kind === kind && !found) found = s; }); }
    look(PR.ground); look(PR.upper || DEFAULT_UPPER); look(PR.below || DEFAULT_CELLAR);
    var F = PR.filler || {}; look([F.ground, F.upper, F.cellar]); var B = PR.blocks || {}; look([B.side, B.end, B.porch]);
    return found;
  }
  function roomWord(kind, roomKind) { var s = specOf(PROGRAMS[programOf(kind)], roomKind); return s ? s.word : roomKind; }
  function validateCounts(counts, kind) {
    NS.assert(counts && typeof counts === "object" && !Array.isArray(counts), "rooms must be an object of kind → count", { rooms: counts });
    var known = roomKinds(kind);
    Object.keys(counts).forEach(function (k) {
      NS.assert(known.indexOf(k) >= 0, "rooms." + k + ": unknown room kind for this building", { kind: k, known: known });
      NS.assert(U.isNum(counts[k]) && counts[k] === Math.floor(counts[k]) && counts[k] >= 0 && counts[k] <= MAX_COUNT, "rooms." + k + " must be an integer in [0, " + MAX_COUNT + "]", { count: counts[k] });
    });
  }
  function validateEdits(edits) {
    var ids = {};
    NS.assert(Array.isArray(edits), "edits must be an array", { edits: edits });
    edits.forEach(function (e, i) {
      NS.assert(e && typeof e === "object" && NS.own(OPS, e.op), "edits[" + i + "].op must be one of " + Object.keys(OPS).join("|"), { edit: e });
      NS.assert(typeof e.id === "string" && e.id.length > 0, "edits[" + i + "] needs a string id", { edit: e });
      if (e.op === "add") {
        NS.assert(typeof e.kind === "string" && e.kind.length > 0, "edits[" + i + "]: add needs a kind (a room kind of the building, or custom)", { edit: e });
        NS.assert(!ids[e.id], "edits[" + i + "]: a room with id " + e.id + " is already added", { id: e.id }); ids[e.id] = true;
        NS.assert(!GENERATED_ID.test(e.id), "edits[" + i + "]: authored ids must not look like generated ones (kind-n)", { id: e.id });
        if (e.kind === CUSTOM) NS.assert(typeof e.word === "string" && e.word.trim().length > 0 && e.word.length <= MAX_WORD, "edits[" + i + "]: a custom room needs a word of 1–" + MAX_WORD + " characters (what it is)", { edit: e });
        NS.assert(e.floor === undefined || e.floor === null || (U.isNum(e.floor) && e.floor === Math.floor(e.floor) && e.floor >= -1 && e.floor <= 3), "edits[" + i + "]: floor must be a level, −1 (the cellar) to 3", { edit: e });
        NS.assert(e.m2 === undefined || e.m2 === null || (U.isNum(e.m2) && e.m2 >= ADD_M2[0] && e.m2 <= ADD_M2[1]), "edits[" + i + "]: m2 must be a floor area of " + ADD_M2[0] + "–" + ADD_M2[1] + " m²", { edit: e });
        NS.assert(e.name === undefined || e.name === null || (typeof e.name === "string" && e.name.length <= MAX_NAME), "edits[" + i + "]: name must be a string of at most " + MAX_NAME + " characters", { edit: e });
      }
      if (e.op === "rename") NS.assert(typeof e.name === "string" && e.name.trim().length > 0 && e.name.length <= MAX_NAME, "edits[" + i + "]: rename needs a name of 1–" + MAX_NAME + " characters", { edit: e });
      if (e.op === "note") NS.assert(typeof e.note === "string" && e.note.length <= MAX_NOTE, "edits[" + i + "]: note needs a string of at most " + MAX_NOTE + " characters (empty clears it)", { edit: e });
      if (e.op === "door") NS.assert(NS.own(DOOR_STATES, e.state), "edits[" + i + "]: door needs a state, one of " + Object.keys(DOOR_STATES).join("|"), { edit: e });
    });
  }

  /* ── furnishing recipes ── FURNISH[key] = ops run in order on a room; each op is [name, args…] and the placer keeps
     every piece inside the room's floor, clear of its doors and of what stands already. Words for the digest in FIXTURES. */
  var FURNISH = {
    hall: [["hearth"], ["table", 1, 0.03], ["bench", 1], ["chest", 1]],
    kitchen: [["hearth"], ["table", 1, 0], ["shelf", 1], ["barrel", 1], ["cauldron"]],
    chamber: [["bed", 1], ["chest", 1], ["table", 0, 0.02]],
    store: [["shelf", 2], ["barrel", 2], ["chest", 1]],
    pantry: [["shelf", 2], ["barrel", 1]],
    common: [["hearth"], ["counter"], ["table", 2, 0.07], ["bench", 1], ["barrel", 1]],
    taproom: [["hearth"], ["counter"], ["table", 2, 0.08], ["barrel", 2]],
    guest: [["bed", 1], ["chest", 1]],
    keeper: [["bed", 1], ["chest", 1], ["desk"]],
    parlour: [["hearth"], ["table", 1, 0], ["bench", 1]],
    room: [["table", 1, 0], ["bench", 1], ["chest", 1]],
    cellar: [["barrel", 6], ["shelf", 1]],
    forge: [["forge"], ["anvil"], ["bench", 1], ["barrel", 1]],
    workshop: [["workbench"], ["shelf", 1], ["table", 0, 0.03]],
    shop: [["counter"], ["shelf", 2], ["table", 0, 0.03], ["chest", 1]],
    stillroom: [["hearth"], ["workbench"], ["shelf", 2], ["cauldron"]],
    bakehouse: [["oven"], ["workbench"], ["table", 1, 0], ["barrel", 1]],
    salting: [["barrel", 4], ["workbench"]],
    scriptorium: [["desk"], ["desk"], ["shelf", 2]],
    library: [["shelf", 3], ["desk"]],
    consulting: [["table", 1, 0], ["hearth"], ["shelf", 1]],
    sanctum: [["altar"], ["shelf", 1], ["chest", 1]],
    office: [["desk"], ["shelf", 1], ["chest", 1]],
    customs: [["barrel", 3], ["chest", 2], ["shelf", 1]],
    stalls: [["stalls"], ["barrel", 1]],
    tack: [["shelf", 2], ["workbench"]],
    hay: [], loft: [],
    bath: [["tub", 3], ["bench", 2]],
    furnace: [["hearth"], ["barrel", 1]],
    changing: [["bench", 2], ["chest", 2]],
    shrine: [["altar"], ["pews"]],
    cell: [["cot", 1]],
    oubliette: [],
    nave: [["pews"]],
    chancel: [["altar"]],
    transept: [["altar"], ["bench", 1]],
    vestry: [["chest", 2], ["shelf", 1]],
    porch: [["bench", 1]],
    greathall: [["hearth"], ["table", 3, 0.05], ["bench", 2]],
    guardroom: [["table", 1, 0], ["bench", 1], ["cot", 2], ["rack"]],
    buttery: [["barrel", 3], ["shelf", 1]],
    solar: [["hearth"], ["table", 1, 0], ["bench", 1]],
    lord: [["bed", 1], ["chest", 2], ["hearth"]],
    chapel: [["altar"], ["pews"]],
    moothall: [["table", 2, 0.03], ["bench", 3]],
    council: [["table", 1, 0], ["bench", 2]],
    counting: [["desk"], ["counter"], ["chest", 1]],
    strongroom: [["chest", 3], ["shelf", 1]],
    den: [["table", 1, 0.04], ["cot", 2], ["chest", 1]],
    armoury: [["rack"], ["rack"], ["chest", 1]],
    barracks: [["cot", 4], ["table", 1, 0], ["chest", 1]],
    captain: [["bed", 1], ["desk"], ["chest", 1]],
    gaoler: [["hearth"], ["table", 1, 0], ["cot", 1]],
    passage: [], stair: [], closet: [["shelf", 1]],
    wing: [["bench", 1]]
  };
  /* a fixture: its word (one, many) and its size along × across the wall, in METRES */
  var FIXTURES = {
    hearth: { one: "a hearth", many: "hearths", w: 1.6, h: 0.7 }, forge: { one: "a forge", many: "forges", w: 2, h: 0.9 }, oven: { one: "an oven", many: "ovens", w: 1.8, h: 0.9 },
    table: { one: "a table", many: "tables", w: 1.6, h: 0.9 }, bench: { one: "a bench", many: "benches", w: 1.8, h: 0.4 }, counter: { one: "a counter", many: "counters", w: 3.5, h: 0.7 },
    bed: { one: "a bed", many: "beds", w: 2, h: 1.2 }, cot: { one: "a cot", many: "cots", w: 1.8, h: 0.75 }, chest: { one: "a chest", many: "chests", w: 0.9, h: 0.55 },
    shelf: { one: "shelves", many: "shelves", w: 2, h: 0.4 }, barrel: { one: "a barrel", many: "barrels", w: 0.9, h: 0.9 }, cauldron: { one: "a cauldron", many: "cauldrons", w: 0.9, h: 0.9 },
    altar: { one: "an altar", many: "altars", w: 1.6, h: 0.8 }, pew: { one: "a pew", many: "pews", w: 2, h: 0.4 }, anvil: { one: "an anvil", many: "anvils", w: 0.9, h: 0.5 },
    workbench: { one: "a workbench", many: "workbenches", w: 2.5, h: 0.7 }, desk: { one: "a desk", many: "desks", w: 1.5, h: 0.8 }, tub: { one: "a bath", many: "baths", w: 2, h: 1.2 },
    stall: { one: "a stall", many: "stalls", w: 1.7, h: 2.2 }, rack: { one: "a weapon rack", many: "weapon racks", w: 1.8, h: 0.4 }
  };
  function fixtureSize(kind) { var F = FIXTURES[kind]; return { w: F.w * K, h: F.h * K }; }

  /* ── params ── */
  var DEFAULTS = { seed: null, culture: "common", title: null, site: {}, floors: null, cellar: null, rooms: {}, edits: [] };
  var SITE_KEYS = ["kind", "name", "word", "footprint", "front", "town", "mPerUnit", "above", "district"];
  function resolveParams(input) {
    var P = U.extend({}, DEFAULTS, input || {}), k, S;
    for (k in input || {}) if (Object.prototype.hasOwnProperty.call(input, k) && !Object.prototype.hasOwnProperty.call(DEFAULTS, k)) NS.fail("unknown parameter", { param: k, known: Object.keys(DEFAULTS) });
    NS.assert(P.seed !== null && P.seed !== undefined && String(P.seed).length > 0, "seed is required (a string or number)", { seed: P.seed });
    NS.assert(NS.own(NS.names.CULTURES, P.culture), "culture must be one of " + NS.names.cultures().join("|"), { culture: P.culture });
    NS.assert(P.title === null || typeof P.title === "string", "title must be a string or null", { title: P.title });
    NS.assert(P.floors === null || (U.isNum(P.floors) && P.floors === Math.floor(P.floors) && P.floors >= 0 && P.floors <= 3), "floors must be null or an integer in [0, 3] (levels above the ground floor)", { floors: P.floors });
    NS.assert(P.cellar === null || typeof P.cellar === "boolean", "cellar must be null or a boolean", { cellar: P.cellar });
    NS.assert(P.site && typeof P.site === "object" && !Array.isArray(P.site), "site must be an object", { site: P.site });
    S = U.extend({}, P.site);
    for (k in S) if (Object.prototype.hasOwnProperty.call(S, k) && SITE_KEYS.indexOf(k) < 0) NS.fail("unknown site key", { key: k, known: SITE_KEYS });
    NS.assert(typeof S.kind === "string" && S.kind, "site.kind is required (the kind of building: " + Object.keys(PROGRAMS).join("|") + ", or any establishment kind)", { kind: S.kind });
    NS.assert(Array.isArray(S.footprint) && S.footprint.length >= 3 && S.footprint.every(function (p) { return Array.isArray(p) && U.isNum(p[0]) && U.isNum(p[1]); }), "site.footprint must be a polygon of at least three [x, y] points (interior units, " + M_PER_UNIT + " m each)", { footprint: S.footprint });
    NS.assert(Math.abs(G.signedArea(S.footprint)) >= 5 * K * K, "site.footprint is too small to hold a room (under 5 m²)", { areaM2: Math.abs(G.signedArea(S.footprint)) * M_PER_UNIT * M_PER_UNIT });
    NS.assert(U.isNum(S.front) && S.front === Math.floor(S.front) && S.front >= 0 && S.front < S.footprint.length, "site.front must be the index of the footprint edge that faces the street", { front: S.front, edges: S.footprint.length });
    S.name = typeof S.name === "string" && S.name ? S.name : null;
    S.word = typeof S.word === "string" && S.word ? S.word : PROGRAMS[programOf(S.kind)].word;
    S.town = U.extend({ name: null, size: "town" }, S.town || {});
    NS.assert(NS.own(SIZE_INDEX, S.town.size) !== undefined, "site.town.size must be hamlet|village|town|city", { size: S.town.size });
    P.rooms = P.rooms || {}; P.edits = P.edits || [];
    validateCounts(P.rooms, S.kind); validateEdits(P.edits);
    S.mPerUnit = M_PER_UNIT;
    S.above = S.above || { generator: "town", site: null, id: null, name: S.town.name };
    S.district = S.district || null;
    P.site = S; P.seed = String(P.seed);
    return P;
  }

  /* ── geometry ── convex cuts in a local frame: x along the front edge, y into the building */
  function roundPts(pts) { return pts.map(function (p) { return [U.round(p[0], 1), U.round(p[1], 1)]; }); }
  function area(poly) { return Math.abs(G.signedArea(poly)); }
  function isConvex(poly) { var s = 0, i, n = poly.length, a, b, c, cr; for (i = 0; i < n; i++) { a = poly[i]; b = poly[(i + 1) % n]; c = poly[(i + 2) % n]; cr = (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]); if (Math.abs(cr) < 1e-7) continue; if (!s) s = cr > 0 ? 1 : -1; else if ((cr > 0 ? 1 : -1) !== s) return false; } return true; }
  /* a polygon without its near-collinear vertices (a turn under about a degree), so a rounded coordinate never reads as a corner */
  function straightenOnce(poly) { var out = [], n = poly.length, i, a, b, c, cr, la, lb; for (i = 0; i < n; i++) { a = poly[(i + n - 1) % n]; b = poly[i]; c = poly[(i + 1) % n]; la = G.dist(a, b) || 1; lb = G.dist(b, c) || 1; cr = ((b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0])) / (la * lb); if (Math.abs(cr) > 0.02) out.push(b); } return out; }
  function straighten(poly) { var out = poly, n; do { n = out.length; out = straightenOnce(out); } while (out.length >= 3 && out.length < n); return out; }   /* until nothing more goes: the outline and the blocks cut from it must agree */
  /* cut a polygon into convex blocks: at a reflex vertex an edge into it is extended across the polygon and both sides
     kept, recursively. Every reflex vertex offers two cuts; the one taken runs most nearly along the polygon's
     principal axis, so a cross is cut along its nave walls into a nave and two transepts, never across. A sliver (a
     wall's thickness left where two walls are not quite in line) is swallowed by the wall. */
  function convexBlocks(poly, depth) {
    poly = straighten(M.tidy(poly, EPS)); depth = depth || 0;
    if (poly.length < 3 || area(poly) < TINY) return [];
    if (isConvex(poly) || depth > 12) return [poly];
    var sgn = G.signedArea(poly) > 0 ? 1 : -1, n = poly.length, i, a, b, c, cr, whole = area(poly), axis = G.principalAngle(poly), ax = Math.cos(axis), ay = Math.sin(axis), best = null;
    for (i = 0; i < n; i++) {
      a = poly[(i + n - 1) % n]; b = poly[i]; c = poly[(i + 1) % n]; cr = ((b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0])) / ((G.dist(a, b) || 1) * (G.dist(b, c) || 1));
      if (cr * sgn >= -0.02) continue;
      [[a, b], [c, b]].forEach(function (e) {
        var ex = e[1][0] - e[0][0], ey = e[1][1] - e[0][1], l = Math.sqrt(ex * ex + ey * ey) || 1, nx = -ey / l, ny = ex / l, cc = nx * b[0] + ny * b[1], along = Math.abs(ex / l * ax + ey / l * ay);
        var A = M.clipHalf(poly, nx, ny, cc), B = M.clipHalf(poly, -nx, -ny, -cc), aA = A.length >= 3 ? area(A) : 0, aB = B.length >= 3 ? area(B) : 0;
        if (aA < TINY || aB < TINY) return;
        if (!best || along > best.along) best = { along: along, A: A, B: B, aA: aA, aB: aB };
      });
    }
    if (!best) return [poly];
    var sliver = Math.max(whole * 0.015, SLIVER);
    if (best.aA < sliver) return convexBlocks(best.B, depth + 1);
    if (best.aB < sliver) return convexBlocks(best.A, depth + 1);
    return convexBlocks(best.A, depth + 1).concat(convexBlocks(best.B, depth + 1));
  }
  /* the position c along the normal (nx, ny) where the low side (n·p ≤ c) holds `frac` of the polygon's area */
  function cutAt(poly, nx, ny, frac) {
    var lo = Infinity, hi = -Infinity, i, v, target = frac * area(poly), mid, k, low;
    for (i = 0; i < poly.length; i++) { v = poly[i][0] * nx + poly[i][1] * ny; if (v < lo) lo = v; if (v > hi) hi = v; }
    for (k = 0; k < 40; k++) { mid = (lo + hi) / 2; low = M.clipHalf(poly, -nx, -ny, -mid); if ((low.length >= 3 ? area(low) : 0) < target) lo = mid; else hi = mid; }
    return (lo + hi) / 2;
  }
  function splitAt(poly, nx, ny, c) { return [M.tidy(M.clipHalf(poly, -nx, -ny, -c), EPS / 2), M.tidy(M.clipHalf(poly, nx, ny, c), EPS / 2)]; }
  function clean(poly) { return poly && poly.length >= 3 && area(poly) > TINY ? poly : null; }
  /* the direction of the band's end wall at `end` (−1: the low-x end, +1: the high-x end): the steepest edge whose
     midpoint lies nearest that end; straight across (0, 1) when the band has no such wall */
  function endDir(band, end) {
    var bb = G.bbox(band), best = null, bs = -Infinity, i, n = band.length, a, b, mx, dx, dy, l, steep, s;
    for (i = 0; i < n; i++) {
      a = band[i]; b = band[(i + 1) % n]; dx = b[0] - a[0]; dy = b[1] - a[1]; l = Math.sqrt(dx * dx + dy * dy) || 1; steep = Math.abs(dy) / l; if (steep < 0.5) continue;
      mx = (a[0] + b[0]) / 2; s = (end < 0 ? bb[2] - mx : mx - bb[0]) / Math.max(1, bb[2] - bb[0]) + steep * 0.2; if (s > bs) { bs = s; best = dy > 0 ? [dx / l, dy / l] : [-dx / l, -dy / l]; }
    }
    return best || [0, 1];
  }

  /* the stair's slice of a band: STAIR_W from one end, cut parallel to the end wall there (a skewed band gives a
     parallelogram, never a corner triangle) or straight across, at the plan's end or the other — whichever gives the
     flight the better shape: floor enough, not longer than STAIR_LEN. The plan keeps the cut, so every floor's flight
     stands over the one below. */
  /* too thin for a flight: inset by a wall's worth, what is left is under 1 m across somewhere along it (a wedge against a
     slanted end wall tapers to nothing though its outer extents look wide enough) */
  function thin(p, nx, ny) {
    /* measured in the cut's own frame — across its normal (nx, ny) and along the cut — since the principal axis of a
       slanted slice runs down its diagonal and reads it narrower than it is: under 0.9 m across, or under 0.85 m wide
       on average along it (a wedge against a slanted end wall is as wide as a stair at its base and nothing at its tip) */
    var q = M.insetConvex(p, 7), lo = Infinity, hi = -Infinity, lt = Infinity, ht = -Infinity, i, v, w;
    if (!q || q.length < 3) return true;
    for (i = 0; i < q.length; i++) { v = q[i][0] * nx + q[i][1] * ny; w = -q[i][0] * ny + q[i][1] * nx; if (v < lo) lo = v; if (v > hi) hi = v; if (w < lt) lt = w; if (w > ht) ht = w; }
    return hi - lo < STAIR_W * 0.5 || area(q) / Math.max(ht - lt, 1) < STAIR_W * 0.47;
  }
  function stairCut(band, prefEnd) {
    var bb = G.bbox(band), depth = bb[3] - bb[1], least = STAIR_W * Math.min(depth, MIN_D) * 0.6, deep = depth > MAX_DEEP, best = null;   /* a deep band's strip is split later (the flight takes its near half), so its length is no fault */
    [prefEnd, -prefEnd].forEach(function (end, pi) {
      [endDir(band, end), [0, 1]].forEach(function (ed, di) {
        var nx = ed[1], ny = -ed[0], lo = Infinity, hi = -Infinity, q, v;
        if (nx < 0) { nx = -nx; ny = -ny; }
        for (q = 0; q < band.length; q++) { v = band[q][0] * nx + band[q][1] * ny; if (v < lo) lo = v; if (v > hi) hi = v; }
        /* the slice STAIR_W wide — and, for a band whose end is a sharp corner, the slice that holds the flight's floor whatever its width */
        var fracA = Math.min(0.45, least * 1.3 / area(band)), cs = [end < 0 ? lo + STAIR_W : hi - STAIR_W, cutAt(band, nx, ny, end < 0 ? fracA : 1 - fracA)];
        cs.forEach(function (c, ci) {
          var pc = splitAt(band, nx, ny, c), st = end < 0 ? pc[0] : pc[1], rest = end < 0 ? pc[1] : pc[0];
          if (!clean(st) || !clean(rest)) return;
          var ext = M.extents(st), len = Math.max(ext.along, ext.across), score = (area(st) < least ? 1000 : 0) + (thin(st, nx, ny) ? 1000 : 0) + (deep ? 0 : Math.max(0, len - STAIR_LEN)) + pi * 5 + di * 2 + ci * 3;   /* a sliver along a skewed band's edge is no flight, whatever its area */
          if (!best || score < best.score) best = { nx: nx, ny: ny, c: c, low: end < 0, score: score };
        });
      });
    });
    return best;
  }
  /* rooms of a band: the stair's slice first (the plan's cut), the rest side by side by their target areas, the biggest
     in the middle; more rooms than the width holds (MIN_W each) are dropped — fill copies first */
  function cutBand(band, specs, plan, dropped, inner, level, noPairs) {
    var bb = G.bbox(band), width = bb[2] - bb[0], depth = bb[3] - bb[1], out = [], stair = null, rest = [], i, s;
    for (i = 0; i < specs.length; i++) if (specs[i].kind === "stair") stair = specs[i]; else rest.push(specs[i]);
    /* two rooms to a column only where the floor has no passage: beside one, the room behind its partner would open only through it */
    var deep = depth > MAX_DEEP && !noPairs && !(plan.corridor || plan.side || plan.court), cols = Math.max(1, Math.floor((width - (stair ? STAIR_W : 0)) / MIN_W)), full = function (q) { return q.hub || q.entry; }, columns;
    rest.sort(function (a, b) { return (b.m2 * (b.jit || 1)) - (a.m2 * (a.jit || 1)); });
    if (!(plan.corridor || plan.side || plan.court)) {   /* no passage on this floor: only the rooms beside the hub or the stair's landing can open off one — stair | hub | room, room | hub | room, or stair | room — the rest are dropped, fill copies first */
      var hubs = rest.filter(full).length, cap = hubs ? (stair ? 1 : 2) : (stair ? 1 : rest.length), j0, k0;
      while (rest.filter(function (q) { return !full(q); }).length > cap) {
        j0 = -1; for (k0 = rest.length - 1; k0 >= 0 && j0 < 0; k0--) if (rest[k0].fill && !full(rest[k0])) j0 = k0;
        if (j0 < 0) for (k0 = 0; k0 < rest.length; k0++) if (!full(rest[k0]) && (j0 < 0 || rest[k0].m2 < rest[j0].m2)) j0 = k0;
        if (j0 < 0) break; dropped.push(rest[j0]); rest.splice(j0, 1);
      }
    }
    var poly = band, pieces;
    if (stair) {   /* the plan's cut when it fits this band, else the best cut for this band alone */
      var sc = plan.stairCut, pc = sc ? splitAt(band, sc.nx, sc.ny, sc.c) : null, st = pc ? (sc.low ? pc[0] : pc[1]) : null, rest2 = pc ? (sc.low ? pc[1] : pc[0]) : null;
      if (!clean(st) || !clean(rest2) || area(st) < STAIR_W * Math.min(depth, MIN_D) * 0.4 || thin(st, sc.nx, sc.ny)) { sc = stairCut(band, plan.stairEnd); if (sc) { pc = splitAt(band, sc.nx, sc.ny, sc.c); st = sc.low ? pc[0] : pc[1]; rest2 = sc.low ? pc[1] : pc[0]; } }
      if (!sc || !clean(st) || !clean(rest2)) { out.push({ spec: stair, poly: band }); dropped.push.apply(dropped, rest); return out; }
      poly = rest2;
      /* in a deep band the flight takes only the near half of its strip (toward the passage, or the front); a room
         that is not a hub stands behind it — so a 9 m deep band gives a 4.5 m stair, not a 9 m one */
      var partner = null, k2;
      if (deep && area(st) >= 2 * STAIR_W * MIN_D) { for (k2 = 0; k2 < rest.length && !partner; k2++) if (!full(rest[k2])) partner = rest.length >= 2 ? rest.splice(k2, 1)[0] : U.extend({}, rest[k2], { fill: true }); }   /* the band's last room is not taken but copied: the rest of the band needs one */
      if (partner) {
        var sbb = G.bbox(st), sdepth = sbb[3] - sbb[1], sd = U.clamp(sdepth * 0.5, MIN_D, STAIR_LEN), fracLow = inner > 0 ? (sdepth - sd) / sdepth : sd / sdepth, hs = splitAt(st, 0, 1, cutAt(st, 0, 1, U.clamp(fracLow, 0.25, 0.75)));
        if (clean(hs[0]) && clean(hs[1]) && !thin(hs[0], sc.nx, sc.ny) && !thin(hs[1], sc.nx, sc.ny)) { out.push({ spec: stair, poly: inner > 0 ? hs[1] : hs[0] }); out.push({ spec: partner, poly: inner > 0 ? hs[0] : hs[1] }); }   /* a skewed strip split across leaves a corner sliver: then the flight keeps the strip */
        else { out.push({ spec: stair, poly: st }); rest.push(partner); }
      } else out.push({ spec: stair, poly: st });
    }
    /* columns across the band: a hub or the entry room alone at full depth; in a deep band the others two to a column
       (the first, the bigger, toward `inner` — +1: high y, the passage side of a front band — the second behind it);
       the biggest column in the middle. More columns than the width holds at MIN_W each: drop a fill copy, else the
       smallest room that is neither the entry nor a hub, and assemble again — never a row of slivers */
    function assemble() {
      var singles = rest.filter(full), others = rest.filter(function (q) { return !full(q); }), list = [], i2, out2 = [];
      singles.forEach(function (q) { list.push({ specs: [q], m2: q.m2 }); });
      for (i2 = 0; i2 < others.length; i2++) { if (deep && i2 + 1 < others.length) { list.push({ specs: [others[i2], others[i2 + 1]], m2: others[i2].m2 + others[i2 + 1].m2 }); i2++; } else list.push({ specs: [others[i2]], m2: others[i2].m2 }); }
      list.sort(function (a, b) { return b.m2 - a.m2; });
      if (stair && !(plan.corridor || plan.side || plan.court)) { out2 = list.slice(); if (!(sc && sc.low)) out2.reverse(); }   /* no passage: the biggest column (the hub) against the stair, so the landing opens into it */
      else for (i2 = 0; i2 < list.length; i2++) { if (i2 % 2 === 0) out2.push(list[i2]); else out2.unshift(list[i2]); }
      return out2;
    }
    columns = assemble();
    while (columns.length > cols && rest.length > 1) {
      var j = -1, k;
      for (k = rest.length - 1; k >= 0 && j < 0; k--) if (rest[k].fill) j = k;
      if (j < 0) for (k = 0; k < rest.length; k++) if (!rest[k].entry && (j < 0 || rest[k].m2 < rest[j].m2) && !(rest[k].hub && rest.some(function (q) { return !q.hub && !q.entry; }))) j = k;
      if (j < 0) j = rest.length - 1;
      dropped.push(rest[j]); rest.splice(j, 1); columns = assemble();
    }
    var total = 0; columns.forEach(function (col) { total += col.m2; });
    var minA = MIN_W * depth;   /* the least floor a column may get (units²): a slice MIN_W wide across the band */
    function layColumn(col, cpoly) {
      if (col.specs.length === 1) { out.push({ spec: col.specs[0], poly: cpoly }); return; }
      var a = col.specs[0], b = col.specs[1], fracLow = inner > 0 ? b.m2 / (a.m2 + b.m2) : a.m2 / (a.m2 + b.m2), cc = cutAt(cpoly, 0, 1, U.clamp(fracLow, 0.3, 0.7)), halves = splitAt(cpoly, 0, 1, cc);
      if (!clean(halves[0]) || !clean(halves[1])) { out.push({ spec: a, poly: cpoly }); dropped.push(b); return; }
      out.push({ spec: a, poly: inner > 0 ? halves[1] : halves[0] }); out.push({ spec: b, poly: inner > 0 ? halves[0] : halves[1] });
    }
    for (i = 0; i < columns.length; i++) {
      s = columns[i];
      if (i === columns.length - 1) { layColumn(s, poly); break; }
      var A = area(poly), left = columns.length - i, frac = total > 0 ? s.m2 / total : 1 / left, minFrac = Math.min(0.45, minA / A), maxFrac = 1 - minFrac * (left - 1);
      frac = minFrac > maxFrac ? 1 / left : U.clamp(frac, minFrac, maxFrac);   /* no room for every column at its least: equal shares */
      var cc = cutAt(poly, 1, 0, frac); pieces = splitAt(poly, 1, 0, cc);
      if (!clean(pieces[0]) || !clean(pieces[1])) { layColumn(s, poly); poly = null; columns.slice(i + 1).forEach(function (c2) { dropped.push.apply(dropped, c2.specs); }); break; }
      layColumn(s, pieces[0]); poly = pieces[1]; total -= s.m2;
    }
    return out.filter(function (o) { return clean(o.poly); });
  }

  /* one floor of the main block: the bands (the plan fixes where they are cut, so every floor's walls line up), the
     passage between them, the rooms of each band; returns {rooms: [{spec, poly}], dropped: [spec]} */
  /* the bands of the main block under the plan: the front band, the passage (or null) and the back band */
  function bandsOf(block, plan) {
    var cut = splitAt(block, 0, 1, plan.yCut), frontPoly = cut[0], backPoly = cut[1], corridorPoly = null;
    if (plan.corridor) { var c2 = splitAt(backPoly, 0, 1, plan.yCut + CORRIDOR); if (clean(c2[0]) && clean(c2[1])) { corridorPoly = c2[0]; backPoly = c2[1]; } }
    return { front: clean(frontPoly), corridor: corridorPoly, back: clean(backPoly) };
  }
  function layoutFloor(block, specs, plan, level) { return plan.court ? layoutCourt(block, specs, plan, level) : layoutPlain(block, specs, plan, level); }
  /* the floor of a block with a courtyard: the court in the middle, open to the sky (on an upper floor the void over it),
     the cloister walk round it in four pieces (passages, so every room opens off one), the rooms in four ranges — the
     front and back bands cut as bands, the side ranges turned a quarter so they are cut the same way */
  function layoutCourt(block, specs, plan, level) {
    var c = plan.court, dropped = [], rooms = [], stair = null, rest = [], i, x0 = c.x0 - WALK, x1 = c.x1 + WALK, y0 = c.y0 - WALK, y1 = c.y1 + WALK, bb = G.bbox(block);
    for (i = 0; i < specs.length; i++) if (specs[i].kind === "stair") stair = specs[i]; else rest.push(specs[i]);
    function box(ax, ay, bx, by) { var p = M.clipRect(block, ax, ay, bx, by); return p && p.length >= 3 ? clean(M.tidy(p, EPS / 2)) : null; }
    /* the front and back walks run the whole width, so every room of the front and back ranges — the corners too — opens
       off one; the side walks run between them, and the side ranges beside those */
    var courtPoly = box(c.x0, c.y0, c.x1, c.y1), walks = [box(bb[0] - 1, y0, bb[2] + 1, c.y0), box(bb[0] - 1, c.y1, bb[2] + 1, y1), box(x0, c.y0, c.x0, c.y1), box(c.x1, c.y0, x1, c.y1)];
    var front = box(bb[0] - 1, bb[1] - 1, bb[2] + 1, y0), back = box(bb[0] - 1, y1, bb[2] + 1, bb[3] + 1), left = box(bb[0] - 1, c.y0, x0, c.y1), right = box(x1, c.y0, bb[2] + 1, c.y1);
    if (!courtPoly || !front || !back || !left || !right || walks.some(function (w) { return !w; })) return layoutPlain(block, specs, plan, level);
    /* the cellar has no court: the middle is an undercroft, a vaulted room the passages round it open into */
    var walkSpec = level > 0 ? WALKS.upper : level < 0 ? PASSAGE : WALKS.ground;
    rooms.push({ spec: level < 0 ? R("undercroft", "undercroft", 0, "any", { hub: true, windows: false, door: "arch" }) : U.extend({}, COURT), poly: courtPoly });
    walks.forEach(function (w) { rooms.push({ spec: U.extend({}, walkSpec), poly: w }); });
    /* the front rooms and the stair to the front range, the back rooms to the back one, the rest to whichever range is emptiest for its floor */
    var F = rest.filter(function (s) { return s.at === "front"; }), B = rest.filter(function (s) { return s.at === "back"; }), any = rest.filter(function (s) { return s.at !== "front" && s.at !== "back"; });
    var ranges = [{ poly: front, list: F, turn: false, inner: 1 }, { poly: back, list: B, turn: false, inner: -1 }, { poly: left, list: [], turn: true, inner: -1 }, { poly: right, list: [], turn: true, inner: 1 }];
    function load(r) { var t = 0; r.list.forEach(function (s) { t += s.m2; }); return t / Math.max(1, area(r.poly)); }
    any.sort(function (a, b) { return b.m2 - a.m2; });
    any.forEach(function (s) { var best = ranges[0]; ranges.forEach(function (r) { if (load(r) < load(best)) best = r; }); best.list.push(s); });
    /* no range stands empty (an empty one would be solid wall): it takes a room from the fullest list, a fill copy first, else a storeroom of its own */
    ranges.forEach(function (r) {
      if (r.list.length) return;
      var donor = null, k = -1; ranges.forEach(function (q) { if (q.list.length >= 2 && (!donor || q.list.length > donor.list.length)) donor = q; });
      if (donor) { donor.list.forEach(function (s, i) { if (s.fill && !s.entry && !s.hub) k = i; }); if (k < 0) donor.list.forEach(function (s, i) { if (!s.entry && !s.hub) k = i; }); }
      r.list.push(k >= 0 ? donor.list.splice(k, 1)[0] : R("store", "storeroom", 10, "any", { fill: true }));
    });
    ranges.forEach(function (r, ri) {
      var list = r.list.concat(ri === 0 && stair ? [stair] : []), out; if (!list.length) return;
      if (!r.turn) { rooms = rooms.concat(cutBand(r.poly, list, ri === 0 ? plan : NO_STAIR_PLAN, dropped, r.inner, level, true)); return; }
      /* a side range turned a quarter (a rotation keeps the winding): its long side becomes the band's width */
      out = cutBand(r.poly.map(function (p) { return [p[1], -p[0]]; }), list, NO_STAIR_PLAN, dropped, r.inner, level, true);
      out.forEach(function (o) { o.poly = o.poly.map(function (p) { return [-p[1], p[0]]; }); });
      rooms = rooms.concat(out);
    });
    return { rooms: rooms, dropped: dropped };
  }
  function layoutPlain(block, specs, plan, level) {
    var dropped = [], rooms = [], stair = null, rest = [], i;
    for (i = 0; i < specs.length; i++) if (specs[i].kind === "stair") stair = specs[i]; else rest.push(specs[i]);
    function oneBand() { return { rooms: cutBand(block, rest.concat(stair ? [stair] : []), plan, dropped, -1, level), dropped: dropped }; }
    if (plan.side) {   /* a side passage along the back wall; the rooms in one band before it, each at full depth — no pairs, since a room behind another would open only through it */
      var sp = splitAt(block, 0, 1, plan.sideY);
      if (clean(sp[0]) && clean(sp[1])) { rooms.push({ spec: PASSAGE, poly: sp[1] }); return { rooms: rooms.concat(cutBand(sp[0], rest.concat(stair ? [stair] : []), plan, dropped, 1, level, true)), dropped: dropped }; }
    }
    if (!(plan.two && (rest.length >= 2 || (stair && rest.length >= 1)))) return oneBand();
    var front = rest.filter(function (s) { return s.at === "front"; }), back = rest.filter(function (s) { return s.at === "back"; }), any = rest.filter(function (s) { return s.at !== "front" && s.at !== "back"; });
    var B = bandsOf(block, plan), frontPoly = B.front, backPoly = B.back;
    if (B.corridor) rooms.push({ spec: PASSAGE, poly: B.corridor });
    if (!frontPoly || !backPoly) { rooms = []; return oneBand(); }
    /* the rooms that may go either way fill the band that is emptier for its floor area, so both bands' rooms come out
       near their targets whatever the floor's mix */
    function sum(list) { var t = 0; list.forEach(function (s) { t += s.m2; }); return t; }
    var fA = area(frontPoly), bA = Math.max(1, area(backPoly) - (stair ? STAIR_W * (G.bbox(backPoly)[3] - G.bbox(backPoly)[1]) : 0));
    any.sort(function (a, b) { return b.m2 - a.m2; });
    any.forEach(function (s) { if (sum(front) / fA <= sum(back) / bA) front.push(s); else back.push(s); });
    if (!front.length) front.push(back.length > 1 ? back.shift() : back.pop());
    if (!back.length && stair && front.length) back.push(U.extend({}, front[0], { fill: true, entry: false, hub: false }));   /* a loft over the whole floor: the back band beside the stair is more of it */
    if (!back.length && !stair) back.push(front.length > 1 ? front.pop() : front.shift());
    if (!front.length || (!back.length && !stair)) { rooms = []; return oneBand(); }
    rooms = rooms.concat(cutBand(frontPoly, front, plan, dropped, 1, level), cutBand(backPoly, back.concat(stair ? [stair] : []), plan, dropped, -1, level));
    return { rooms: rooms, dropped: dropped };
  }

  /* the room list a floor wants: the program's list for the level, fill kinds repeated to the floor's area, fillers
     when the floor is still much larger than its program asks for (more rooms, not rooms twice the size), the stair
     when the building has more than one level */
  function floorSpecs(P, level, areaM2, levels, counts) {
    /* `counts` is the author's say per kind (an integer): that many of the kind on every floor whose list has it — a
       fill kind no longer sized to the floor, a fixed kind kept, doubled or dropped —, copies past the first marked
       fill so they are the first to go when the floor is too small */
    var list = level === 0 ? P.ground : level > 0 ? (P.upper || DEFAULT_UPPER) : (P.below || DEFAULT_CELLAR), out = [], fixed = 0, i, s, n, k, C = counts || {};
    function has(kind) { return Object.prototype.hasOwnProperty.call(C, kind); }
    list.forEach(function (q) { if (has(q.kind)) fixed += q.m2 * C[q.kind]; else if (!q.fill) fixed += q.m2; });
    if (levels > 1) fixed += 7;
    for (i = 0; i < list.length; i++) {
      s = list[i];
      if (has(s.kind)) { n = C[s.kind]; for (k = 0; k < n; k++) out.push(U.extend({}, s, { fill: k > 0 || !!s.fill })); continue; }
      if (!s.fill) { out.push(U.extend({}, s)); continue; }
      n = U.clamp(Math.round((areaM2 - fixed) / s.m2), s.min || 1, s.max || 8);
      for (k = 0; k < n; k++) out.push(U.extend({}, s, { fill: true }));
    }
    var total = 0; out.forEach(function (q) { total += q.m2; }); total += levels > 1 ? 7 : 0;
    var F = P.filler || {}, filler = (level < 0 ? F.cellar : level > 0 ? F.upper : F.ground) || (level < 0 ? R("cellar", "cellar", 18, "any", { door: "door" }) : R("chamber", "chamber", 16, level === 0 ? "back" : "any"));
    var listed = list.some(function (q) { return q.kind === filler.kind; });
    if (has(filler.kind) && !listed) { for (k = 0; k < C[filler.kind]; k++) out.push(U.extend({}, filler, { fill: k > 0 })); }
    else while (P.fill !== false && !has(filler.kind) && total > 0 && areaM2 / total > 2 && out.length < 14) { out.push(U.extend({}, filler, { fill: true })); total += filler.m2; }
    if (levels > 1) out.push(U.extend({}, STAIR));
    return out;
  }

  /* ── the building ── */
  function edgeFrame(fp, front) {
    var a = fp[front], b = fp[(front + 1) % fp.length], dx = b[0] - a[0], dy = b[1] - a[1], l = Math.sqrt(dx * dx + dy * dy) || 1, u = [dx / l, dy / l], n = [-u[1], u[0]], c = G.centroid(fp);
    if ((c[0] - a[0]) * n[0] + (c[1] - a[1]) * n[1] < 0) n = [-n[0], -n[1]];
    return { a: a, u: u, n: n, len: l,
      toLocal: function (p) { return [(p[0] - a[0]) * u[0] + (p[1] - a[1]) * u[1], (p[0] - a[0]) * n[0] + (p[1] - a[1]) * n[1]]; },
      toWorld: function (p) { return [a[0] + p[0] * u[0] + p[1] * n[0], a[1] + p[0] * u[1] + p[1] * n[1]]; } };
  }
  /* which edges of a room's cell lie on the outline (outer walls): both ends and the middle on the outline's boundary */
  function onOutline(p, outline) { var i, n = outline.length; for (i = 0; i < n; i++) if (G.pointSegDist(p, outline[i], outline[(i + 1) % n]) < EPS) return true; return false; }
  function exteriorEdges(poly, outline) { var out = [], i, n = poly.length; for (i = 0; i < n; i++) if (onOutline(poly[i], outline) && onOutline(poly[(i + 1) % n], outline) && onOutline([(poly[i][0] + poly[(i + 1) % n][0]) / 2, (poly[i][1] + poly[(i + 1) % n][1]) / 2], outline)) out.push(i); return out; }
  /* the shared wall of two cells: an edge of each, parallel and within WALL_GAP of one another (cells cut from one
     polygon share their edges exactly; two blocks of a footprint whose walls are not quite in line leave a wall's
     thickness between them), overlapping at least MIN_SHARED → the overlap, on the line midway between the edges */
  function sharedWall(A, B) {
    var i, j, a1, a2, b1, b2, dx, dy, l, ux, uy, t1, t2, lo, hi, o1, o2, off, best = null;
    for (i = 0; i < A.length; i++) {
      a1 = A[i]; a2 = A[(i + 1) % A.length]; dx = a2[0] - a1[0]; dy = a2[1] - a1[1]; l = Math.sqrt(dx * dx + dy * dy); if (l < MIN_SHARED) continue; ux = dx / l; uy = dy / l;
      for (j = 0; j < B.length; j++) {
        b1 = B[j]; b2 = B[(j + 1) % B.length];
        o1 = (b1[0] - a1[0]) * uy - (b1[1] - a1[1]) * ux; o2 = (b2[0] - a1[0]) * uy - (b2[1] - a1[1]) * ux;   /* the offsets of B's edge from A's line */
        if (Math.abs(o1) > WALL_GAP || Math.abs(o2) > WALL_GAP || Math.abs(o1 - o2) > EPS * 4) continue;
        t1 = (b1[0] - a1[0]) * ux + (b1[1] - a1[1]) * uy; t2 = (b2[0] - a1[0]) * ux + (b2[1] - a1[1]) * uy;
        lo = Math.max(0, Math.min(t1, t2)); hi = Math.min(l, Math.max(t1, t2)); off = (o1 + o2) / 4;
        if (hi - lo >= MIN_SHARED && (!best || hi - lo > best.len)) best = { len: hi - lo, p: [a1[0] + ux * lo + uy * off, a1[1] + uy * lo - ux * off], q: [a1[0] + ux * hi + uy * off, a1[1] + uy * hi - ux * off], edge: i };
      }
    }
    return best;
  }

  /* ── furnishing ── the placer works in the room's floor polygon (what you stand on), keeps every piece inside it,
     clear of the doors and of what stands already; wall pieces take the walls, free-standing ones a jittered lattice */
  function furnish(room, floorPoly, doors, frontLine, rng) {
    var items = [], ops = FURNISH[room.furnish || room.kind] || [], edges = [], i, a, b, dx, dy, l, c = G.centroid(floorPoly), n = floorPoly.length, inward, ext;
    if (!ops.length || area(floorPoly) * M_PER_UNIT * M_PER_UNIT < 3) return items;
    var inner = M.insetConvex(floorPoly, 0.25 * K) || floorPoly;
    for (i = 0; i < n; i++) {
      a = floorPoly[i]; b = floorPoly[(i + 1) % n]; dx = b[0] - a[0]; dy = b[1] - a[1]; l = Math.sqrt(dx * dx + dy * dy); if (l < 0.5 * K) continue;
      inward = [-dy / l, dx / l]; if ((c[0] - a[0]) * inward[0] + (c[1] - a[1]) * inward[1] < 0) inward = [-inward[0], -inward[1]];
      var mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      ext = room.exteriorMid.some(function (m) { return G.pointSegDist(mid, m[0], m[1]) < OUTER * 1.6; });
      edges.push({ a: a, b: b, u: [dx / l, dy / l], n: inward, len: l, ext: ext, front: ext && frontLine && G.pointSegDist(mid, frontLine[0], frontLine[1]) < OUTER * 1.6, ang: Math.atan2(dy, dx), used: [] });
    }
    if (!edges.length) return items;
    function clear(x, y, r) {
      var k, it, F;
      if (!G.pointInPolygon([x, y], inner)) return false;
      for (k = 0; k < doors.length; k++) if (G.dist([doors[k].x, doors[k].y], [x, y]) < r + 0.95 * K) return false;
      for (k = 0; k < items.length; k++) { it = items[k]; F = fixtureSize(it.kind); if (G.dist([it.x, it.y], [x, y]) < r + Math.max(F.w, F.h) / 2 * 0.95) return false; }
      return true;
    }
    function fits(x, y, ang, w, h) {   /* the four corners inside the floor */
      var ca = Math.cos(ang), sa = Math.sin(ang), hw = w / 2, hh = h / 2, cs = [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]], k;
      for (k = 0; k < 4; k++) if (!G.pointInPolygon([x + cs[k][0] * ca - cs[k][1] * sa, y + cs[k][0] * sa + cs[k][1] * ca], floorPoly)) return false;
      return clear(x, y, Math.sqrt(hw * hw + hh * hh) * 0.8);
    }
    function put(kind, x, y, ang, extra) { items.push(U.extend({ kind: kind, x: U.round(x, 1), y: U.round(y, 1), a: U.round(ang, 3) }, extra || {})); }
    /* a piece against a wall at fraction t of the edge, its back to the wall */
    function onWall(e, kind, t, pushIn) {
      var F = fixtureSize(kind), d = F.h / 2 + (pushIn || 0), x = e.a[0] + e.u[0] * e.len * t + e.n[0] * d, y = e.a[1] + e.u[1] * e.len * t + e.n[1] * d;
      if (e.len * Math.min(t, 1 - t) < F.w / 2 + 0.15 * K) return false;
      if (!fits(x, y, e.ang, F.w, F.h * 0.98)) return false;
      put(kind, x, y, e.ang, { wall: true }); e.used.push(t); return true;
    }
    function wallSlots(e) { var ts = [0.5, 0.28, 0.72, 0.15, 0.85, 0.4, 0.6], out = []; ts.forEach(function (t) { if (!e.used.some(function (u) { return Math.abs(u - t) * e.len < FIXTURES.bed.w * K; })) out.push(t); }); return out; }
    function alongWalls(kind, count, prefer) {
      var placed = 0, cands = edges.slice(), k, e, slots, s;
      cands.sort(function (p, q) { return (prefer(q) - prefer(p)) || (q.len - p.len); });
      for (k = 0; k < cands.length && placed < count; k++) {
        e = cands[k]; if (prefer(e) < 0) continue; slots = wallSlots(e);
        for (s = 0; s < slots.length && placed < count; s++) if (onWall(e, kind, slots[s])) placed++;
      }
      return placed;
    }
    var exterior = function (e) { return e.front ? -1 : e.ext ? 2 : 1; }, interior = function (e) { return e.ext ? 0 : 2; }, anyWall = function (e) { return e.front ? 0 : 1; };
    function lattice(kind, count, round) {
      var F = fixtureSize(kind), bb = G.bbox(inner), step = Math.max(F.w, F.h) + 1.1 * K, ang = edges[0].ang, placed = 0, x, y, ox = rng.range(0, step), oy = rng.range(0, step), pts = [], j = 0.3 * K;
      for (y = bb[1] + oy; y < bb[3]; y += step) for (x = bb[0] + ox; x < bb[2]; x += step) pts.push([x + rng.range(-j, j), y + rng.range(-j, j)]);
      pts.sort(function (p, q) { return G.dist(p, c) - G.dist(q, c); });
      pts.forEach(function (p) { if (placed < count && fits(p[0], p[1], ang, F.w, F.h)) { put(kind, p[0], p[1], ang, round ? { round: true } : null); placed++; } });
      return placed;
    }
    var OPS = {
      hearth: function (k) { alongWalls(k, 1, exterior) || alongWalls(k, 1, anyWall); },
      forge: function () { alongWalls("forge", 1, exterior) || alongWalls("forge", 1, anyWall); },
      oven: function () { alongWalls("oven", 1, exterior) || alongWalls("oven", 1, anyWall); },
      table: function (k, min, perM2) { var n = U.clamp(Math.round(room.areaM2 * perM2), min, 8); if (n) lattice("table", n, rng.chance(0.3)); },
      bench: function (k, n) { alongWalls("bench", n, anyWall); },
      counter: function () { alongWalls("counter", 1, interior) || alongWalls("counter", 1, anyWall); },
      bed: function (k, n) { alongWalls("bed", n, exterior) || alongWalls("bed", n, anyWall); },
      cot: function (k, n) { alongWalls("cot", n, anyWall); },
      chest: function (k, n) { alongWalls("chest", n, anyWall); },
      shelf: function (k, n) { alongWalls("shelf", n, interior) || alongWalls("shelf", n, anyWall); },
      barrel: function (k, n) { alongWalls("barrel", n, anyWall); },
      cauldron: function () { var h = items.filter(function (it) { return it.kind === "hearth" || it.kind === "forge"; })[0]; if (!h) return; var e = edges[0], F = fixtureSize("cauldron"), x = h.x + Math.cos(h.a) * 1.3 * K, y = h.y + Math.sin(h.a) * 1.3 * K; if (fits(x, y, e.ang, F.w, F.h)) put("cauldron", x, y, e.ang); },
      altar: function () {   /* at the wall farthest from the doors, centred */
        var best = null, bd = -1; edges.forEach(function (e) { var m = [(e.a[0] + e.b[0]) / 2, (e.a[1] + e.b[1]) / 2], d = 1e9; doors.forEach(function (dd) { d = Math.min(d, G.dist(m, [dd.x, dd.y])); }); if (!doors.length) d = e.len; if (d > bd) { bd = d; best = e; } });
        if (best) onWall(best, "altar", 0.5, 0.6 * K) || alongWalls("altar", 1, anyWall);
      },
      pews: function () {   /* rows across the room's long axis with an aisle down the middle, leaving the altar's end clear */
        var ext = M.extents(inner), ca = Math.cos(ext.angle), sa = Math.sin(ext.angle), along = ext.along, across = ext.across, step = 1.3 * K, rows = Math.floor((along - 2.5 * K) / step), k, t, cx, cy, side, F = fixtureSize("pew"), w = Math.min(F.w, across * 0.36);
        if (rows < 1 || across < 2.5 * K) return;
        var altar = items.filter(function (it) { return it.kind === "altar"; })[0], dir = 1;
        if (altar && ((altar.x - ext.centre[0]) * ca + (altar.y - ext.centre[1]) * sa) > 0) dir = -1;
        for (k = 0; k < rows; k++) {
          t = -along / 2 + 1.2 * K + k * step; if (dir < 0) t = -t;
          for (side = -1; side <= 1; side += 2) { cx = ext.centre[0] + ca * t - sa * side * (across * 0.25); cy = ext.centre[1] + sa * t + ca * side * (across * 0.25); if (fits(cx, cy, ext.angle + Math.PI / 2, w, F.h)) put("pew", cx, cy, ext.angle + Math.PI / 2); }
        }
      },
      anvil: function () { var f = items.filter(function (it) { return it.kind === "forge"; })[0], e = edges[0], F = fixtureSize("anvil"), x, y; if (f) { x = f.x - Math.sin(f.a) * 1.6 * K + Math.cos(f.a) * 0.75 * K; y = f.y + Math.cos(f.a) * 1.6 * K + Math.sin(f.a) * 0.75 * K; if (!G.pointInPolygon([x, y], inner)) { x = f.x + Math.sin(f.a) * 1.6 * K + Math.cos(f.a) * 0.75 * K; y = f.y - Math.cos(f.a) * 1.6 * K + Math.sin(f.a) * 0.75 * K; } } else { x = c[0]; y = c[1]; } if (fits(x, y, e.ang, F.w, F.h)) put("anvil", x, y, e.ang); else lattice("anvil", 1); },
      workbench: function () { alongWalls("workbench", 1, anyWall); },
      desk: function () { alongWalls("desk", 1, anyWall) || lattice("desk", 1); },
      tub: function (k, n) { lattice("tub", n); },
      stalls: function () {   /* a row of stalls along the longest wall that is not the front */
        var best = null; edges.forEach(function (e) { if (!e.front && (!best || e.len > best.len)) best = e; });
        if (!best) return; var F = fixtureSize("stall"), pitch = F.w + 0.1 * K, k = Math.floor((best.len - 0.5 * K) / pitch), i2, t;
        for (i2 = 0; i2 < k; i2++) { t = (0.5 + i2) * pitch / best.len + (best.len - k * pitch) / 2 / best.len; onWall(best, "stall", t); }
      },
      rack: function () { alongWalls("rack", 1, anyWall); }
    };
    ops.forEach(function (op) { var f = OPS[op[0]]; NS.assert(f, "unknown furnishing op", { op: op[0] }); f.apply(null, [op[0]].concat(op.slice(1))); });
    return items;
  }

  /* ── generate ── */
  function generate(input) {
    var P = resolveParams(input), S = P.site, key = programOf(S.kind), PR = PROGRAMS[key], seed = P.seed, warnings = [], t0 = NS.terrain.now();
    var rng = NS.Rng(seed + "/interior"), si = SIZE_INDEX[S.town.size], frame = edgeFrame(S.footprint, S.front);
    /* the footprint in the local frame, its near-collinear corners straightened (as the blocks are), so the outline drawn and the cells cut from it agree */
    var local = straighten(M.tidy(S.footprint.map(frame.toLocal), EPS)), areaM2 = area(local) * M_PER_UNIT * M_PER_UNIT;
    NS.assert(local.length >= 3, "the footprint has no usable area", { footprint: S.footprint });
    var blocks = convexBlocks(local); NS.assert(blocks.length, "the footprint has no usable area", { footprint: S.footprint });
    blocks.sort(function (a, b) { return area(b) - area(a); });
    var main = blocks[0], mainBB = G.bbox(main), mainM2 = area(main) * M_PER_UNIT * M_PER_UNIT;
    /* a COURTYARD: a main block of COURT_M2 or more and COURT_MIN each way, square enough for a rectangle to sit in it,
       keeps an open court in its middle, a cloister walk round it and its rooms in four ranges about them — a keep's
       inner ward, a great house's court; a program may forbid it (`court: false`: a temple) */
    var court = null;
    if (PR.court !== false && mainM2 >= COURT_M2 && mainBB[2] - mainBB[0] >= COURT_MIN && mainBB[3] - mainBB[1] >= COURT_MIN && area(main) >= (mainBB[2] - mainBB[0]) * (mainBB[3] - mainBB[1]) * 0.92) {
      var cw = U.clamp((mainBB[2] - mainBB[0]) * 0.3, COURT_SIDE[0], COURT_SIDE[1]), chh = U.clamp((mainBB[3] - mainBB[1]) * 0.3, COURT_SIDE[0], COURT_SIDE[1]), ccx = (mainBB[0] + mainBB[2]) / 2, ccy = mainBB[1] + (mainBB[3] - mainBB[1]) * 0.52;
      court = { x0: ccx - cw / 2, y0: ccy - chh / 2, x1: ccx + cw / 2, y1: ccy + chh / 2 };
    }
    /* how many levels: the program's say over the footprint, the author's over the program */
    var ups = P.floors !== null ? P.floors : PR.floors(areaM2, si), hasCellar = P.cellar !== null ? P.cellar : PR.cellar(areaM2, rng), levelsList = [], L;
    if (hasCellar) levelsList.push(-1); for (L = 0; L <= ups; L++) levelsList.push(L);
    var nLevels = levelsList.length;
    /* the room list of every floor, with the author's say — counts per kind, removes by id, adds — and every spec's id
       settled HERE: kind-n in list order across the floors (the cellar first), so a room keeps its id whatever is
       counted, removed or added beside it (a room the layout drops leaves its number unused) */
    var levelSpecs = {}, idCount = {}, specIds = {}, usedIds = {};
    levelsList.forEach(function (lv) { levelSpecs[lv] = floorSpecs(PR, lv, mainM2, nLevels, P.rooms); });
    levelsList.forEach(function (lv) { levelSpecs[lv].forEach(function (s) { if (s.kind === "stair") return; idCount[s.kind] = (idCount[s.kind] || 0) + 1; s.id = s.kind + "-" + idCount[s.kind]; specIds[s.id] = true; }); });
    P.edits.forEach(function (e) {
      if (e.op === "remove") {
        var hit = false; levelsList.forEach(function (lv) { levelSpecs[lv] = levelSpecs[lv].filter(function (s) { if (s.id === e.id) { hit = true; return false; } return true; }); });
        if (!hit) warnings.push("remove " + e.id + ": no room with that id");
      } else if (e.op === "add") {
        var lv = e.floor === undefined || e.floor === null ? 0 : e.floor, src = e.kind === CUSTOM ? null : specOf(PR, e.kind);
        if (levelsList.indexOf(lv) < 0) { warnings.push("add " + e.id + ": the building has no " + floorName(lv).toLowerCase()); return; }
        if (e.kind !== CUSTOM && !src) { warnings.push("add " + e.id + ": no room of kind " + e.kind + " in a " + PR.word); return; }
        var spec = e.kind === CUSTOM ? R(CUSTOM, e.word, e.m2 || 12, "any", { door: "door" }) : U.extend({}, src, { at: "any", fill: false, entry: false, hub: false }, e.m2 ? { m2: e.m2 } : {});
        spec.id = e.id; spec.authored = true; if (e.name) spec.name = e.name; specIds[e.id] = true;
        levelSpecs[lv].push(spec);
      }
    });
    /* the plan every floor shares: where the bands are cut, whether a passage runs between them, which end the stair takes */
    var groundSpecs = levelSpecs[0], plan = { two: false, yCut: 0, corridor: false, stairEnd: rng.chance(0.5) ? -1 : 1, stairCut: null };
    var D = mainBB[3] - mainBB[1], maxRooms = 0;
    levelsList.forEach(function (lv) { maxRooms = Math.max(maxRooms, levelSpecs[lv].length); });
    (function () {
      if (court) { plan.court = court; if (nLevels > 1) plan.stairCut = stairCut(splitAt(main, 0, 1, court.y0 - WALK)[0], plan.stairEnd); return; }   /* the stair in the front range */
      var rest = groundSpecs.filter(function (s) { return s.kind !== "stair"; }), front = 0, all = 0;
      rest.forEach(function (s) { all += s.m2; if (s.at === "front") front += s.m2; });
      var hasBack = rest.some(function (s) { return s.at !== "front"; }) || nLevels > 1;
      /* every room opens off a hallway or a common room, never through another room: a floor with two or more PRIVATE
         rooms (neither a hub nor a closet nor the stair) gets a passage — between the bands when the block is deep
         enough, else a side passage along the back wall; a program with `corridor: false` (a temple) has its hub for it */
      var maxPrivate = 0; levelsList.forEach(function (lv) { var np = 0; levelSpecs[lv].forEach(function (s) { if (!s.hub && s.kind !== "closet" && s.kind !== "stair") np++; }); maxPrivate = Math.max(maxPrivate, np); });
      var needCorridor = PR.corridor !== false && maxPrivate >= 2;
      plan.corridor = needCorridor && D >= 2 * MIN_D + CORRIDOR;
      plan.side = needCorridor && !plan.corridor && D - CORRIDOR >= MIN_D; plan.sideY = mainBB[3] - CORRIDOR;
      if (!plan.side && D >= 2 * MIN_D && front > 0 && hasBack && rest.length >= 2) {
        plan.two = true;
        var f = U.clamp(front / all, 0.3, 0.68), usable = main;
        if (plan.corridor) usable = splitAt(main, 0, 1, mainBB[3] - CORRIDOR)[0];
        plan.yCut = cutAt(usable, 0, 1, f);
        if (plan.yCut - mainBB[1] < MIN_D) plan.yCut = mainBB[1] + MIN_D;
        if (plan.corridor) plan.yCut = Math.min(plan.yCut, mainBB[3] - CORRIDOR - MIN_D);   /* the passage is kept: the front band gives way, since the block is deep enough for both bands and it */
        else if (mainBB[3] - plan.yCut < MIN_D) plan.yCut = Math.min(plan.yCut, mainBB[3] - MIN_D);
      } else plan.corridor = false;
      if (nLevels > 1) { var sb = plan.two ? bandsOf(main, plan).back : plan.side ? splitAt(main, 0, 1, plan.sideY)[0] : null; plan.stairCut = stairCut(sb || main, plan.stairEnd); }
    })();
    /* side blocks: what they become, by where they lie — beyond the main block's back (end), before its front and on the street (porch), else beside it (side) */
    var sideRooms = blocks.slice(1).filter(function (b) { return area(b) >= SLIVER; }).map(function (b) {
      var bb = G.bbox(b), c = G.centroid(b), role = c[1] > mainBB[3] - EPS * 6 ? "end" : c[1] < mainBB[1] + EPS * 6 && bb[1] < EPS * 6 ? "porch" : "side";
      var spec = (PR.blocks && PR.blocks[role]) || WING; return { spec: U.extend({}, spec), poly: b, role: role };
    });
    var blockKinds = {}; sideRooms.forEach(function (r) { blockKinds[r.spec.kind] = true; });

    /* the sheet: the footprint turned back to the town's orientation, one slot per level, left to right from the cellar up */
    var worldFp = local.map(frame.toWorld), worldBB = G.bbox(worldFp), bw = worldBB[2] - worldBB[0], bh = worldBB[3] - worldBB[1];
    var sheetW = Math.max(MIN_FRAME_W, Math.ceil(nLevels * bw + (nLevels - 1) * GAP + 2 * MARGIN)), sheetH = Math.ceil(bh + TOP + BOTTOM), x0 = (sheetW - (nLevels * bw + (nLevels - 1) * GAP)) / 2;
    function placer(idx) { var ox = x0 + idx * (bw + GAP) - worldBB[0], oy = TOP - worldBB[1]; return function (p) { var w = frame.toWorld(p); return [w[0] + ox, w[1] + oy]; }; }

    /* every floor: lay it out, map it onto the sheet, name its rooms */
    var floors = [], rooms = [], doors = [], windows = [], stairs = [], counts = {}, floorCounts;
    levelsList.forEach(function (level, idx) {
      var lrng = NS.Rng(seed + "/floor/" + level), specs = levelSpecs[level].filter(function (s) { return !blockKinds[s.kind] || level !== 0; }).map(function (s) { return U.extend({}, s, { jit: 0.9 + lrng.float() * 0.2 }); });
      var lay = layoutFloor(main, specs, plan, level), put = placer(idx), fl = { level: level, name: FLOOR_NAMES[String(level)] || "Level " + level, outline: roundPts(local.map(put)), rooms: [] };
      var cells = lay.rooms.slice(); if (level === 0) sideRooms.forEach(function (r) { cells.push({ spec: r.spec, poly: r.poly, block: true }); });
      lay.dropped.forEach(function (s) { if (!s.fill) warnings.push("no room for the " + s.word + " on the " + fl.name.toLowerCase() + " of " + (S.name || "the " + S.word)); });
      /* a cell too small to be the room it was meant to be (under 4 m² of floor: the sliver behind a stair in a narrow
         band) is a closet, whatever the program said */
      cells.forEach(function (c) { c.ext = exteriorEdges(c.poly, local); c.floorPoly = M.insetConvex(c.poly, c.poly.map(function (p, i) { return c.ext.indexOf(i) >= 0 ? OUTER : WALL / 2; })) || M.insetConvex(c.poly, EPS) || c.poly; if (area(c.floorPoly) * M_PER_UNIT * M_PER_UNIT < 4 && c.spec.kind !== "stair" && c.spec.kind !== "passage" && !c.spec.entry && !c.spec.hub && !c.spec.authored) c.spec = CLOSET;   /* an authored room keeps its name however small */ });
      floorCounts = {}; cells.forEach(function (c) { floorCounts[c.spec.word] = (floorCounts[c.spec.word] || 0) + 1; });
      var seen = {};
      cells.forEach(function (c) {
        var k = c.spec.kind, poly = c.poly, ext = c.ext, id, n;
        seen[c.spec.word] = (seen[c.spec.word] || 0) + 1;
        /* the spec's settled id; a copy the layout made (a loft, a partner), a closet or a side room takes the next free kind-n */
        if (c.spec.id && !usedIds[c.spec.id] && specIds[c.spec.id]) id = c.spec.id; else { n = 0; do { n++; } while (specIds[k + "-" + n] || usedIds[k + "-" + n]); id = k + "-" + n; }
        usedIds[id] = true;
        var floorPoly = c.floorPoly;
        var world = roundPts(poly.map(put)), worldFloor = roundPts(floorPoly.map(put)), c0 = G.centroid(worldFloor);
        n = c.spec.name || (U.titleCase(c.spec.word) + (floorCounts[c.spec.word] > 1 ? " " + seen[c.spec.word] : ""));
        var room = { id: id, kind: k, word: c.spec.word, name: n, floor: level, poly: world, floorPoly: worldFloor, x: U.round(c0[0], 1), y: U.round(c0[1], 1), areaM2: Math.round(area(floorPoly) * M_PER_UNIT * M_PER_UNIT), exterior: ext, hub: !!c.spec.hub, entry: !!c.spec.entry, furnish: c.spec.furnish || null, doorState: c.spec.door || null, windows: c.spec.windows !== false, entryW: c.spec.entryW ? c.spec.entryW * K : null, local: poly, furniture: [] };
        room.exteriorMid = ext.map(function (i) { return [world[i], world[(i + 1) % world.length]]; });
        if (c.spec.authored) room.authored = true; if (c.spec.name) room.renamed = true; if (c.spec.open) room.open = true; if (c.spec.portal) room.portal = c.spec.portal.site;
        rooms.push(room); fl.rooms.push(id);
      });
      floors.push(fl);
    });
    NS.assert(rooms.length, "no rooms could be laid out in this footprint", { areaM2: areaM2 });

    /* doors: a spanning tree over the shared walls from the entrance room (the stair above and below), a room on a
       passage that reaches no hub yet opens onto it, the kitchen onto the hall; what stands in each doorway from the
       leaf room's program or the seed */
    var drng = NS.Rng(seed + "/doors"), doorSeq = 0;
    function byFloor(level) { return rooms.filter(function (r) { return r.floor === level; }); }
    function dealState(leaf) { if (leaf.doorState) return leaf.doorState; var v = drng.float(), acc = 0, k; for (k in DOOR_ODDS) if (Object.prototype.hasOwnProperty.call(DOOR_ODDS, k)) { acc += DOOR_ODDS[k]; if (v < acc) return k; } return "door"; }
    function addDoor(A, B, wall, kind, state, t) {
      var dx = wall.q[0] - wall.p[0], dy = wall.q[1] - wall.p[1], l = Math.sqrt(dx * dx + dy * dy) || 1, w = kind === "entrance" ? (A.entryW || ENTRY_W) : kind === "back" ? ENTRY_W : DOOR_W;
      t = t === undefined ? 0.5 : t; var m = w / 2 + 0.3 * K; t = U.clamp(t, m / l, 1 - m / l);
      var x = wall.p[0] + dx * t, y = wall.p[1] + dy * t, d = { id: "d" + (++doorSeq), kind: kind, rooms: [A.id, B ? B.id : null], x: U.round(x, 1), y: U.round(y, 1), a: U.round(Math.atan2(dy, dx), 3), width: w, state: state, floor: A.floor, into: B ? (B.hub && !A.hub ? A.id : B.id) : A.id };
      doors.push(d); return d;
    }
    levelsList.forEach(function (level) {
      var rs = byFloor(level), i, j, adj = [], w;
      for (i = 0; i < rs.length; i++) for (j = i + 1; j < rs.length; j++) { w = sharedWall(rs[i].poly, rs[j].poly); if (w) adj.push({ a: rs[i], b: rs[j], wall: w }); }
      var root = null; rs.forEach(function (r) { if (level === 0 ? r.entry : r.kind === "stair") root = root || r; });
      if (!root) { rs.forEach(function (r) { if (r.hub) root = root || r; }); root = root || rs[0]; }
      var inTree = {}; inTree[root.id] = true; var joined = {}, hubDoor = {};
      function weight(e) { var w0 = 1 + drng.range(0, 0.6); if (e.a.hub || e.b.hub) w0 -= 0.5; if (e.a.kind === "passage" || e.b.kind === "passage") w0 -= 0.3; if ((e.a.kind === "kitchen" && e.b.entry) || (e.b.kind === "kitchen" && e.a.entry)) w0 -= 0.4; if (e.a.kind === "stair" || e.b.kind === "stair") w0 -= 0.2; return w0; }
      adj.forEach(function (e) { e.w = weight(e); });
      /* the tree grows from PUBLIC rooms only — a hub (a common room, the stair's landing) or a passage — so no room is
         reached through another's private room; a closet may open off any room. Only when no room left has a public
         neighbour is one joined through a private room, and the digest's warnings say so */
      function isPublic(r) { return r.hub || r.kind === "passage" || r.kind === "stair"; }
      var relax = false;
      for (;;) {
        var best = null;
        adj.forEach(function (e) {
          if (inTree[e.a.id] === inTree[e.b.id]) return;
          var lf = inTree[e.a.id] ? e.b : e.a, tr = inTree[e.a.id] ? e.a : e.b;
          if (!relax && !isPublic(tr) && lf.kind !== "closet") return;
          if (!best || e.w < best.w) best = e;
        });
        if (!best) { if (!relax && rs.some(function (r) { return !inTree[r.id]; })) { relax = true; continue; } break; }
        var leaf = inTree[best.a.id] ? best.b : best.a, trunk = inTree[best.a.id] ? best.a : best.b;
        if (relax) { if (!isPublic(trunk) && leaf.kind !== "closet") warnings.push(leaf.name + " on the " + FLOOR_NAMES[String(level)].toLowerCase() + " is reached through " + trunk.name); relax = false; }
        inTree[leaf.id] = true; joined[best.a.id + "|" + best.b.id] = true; if (trunk.hub) hubDoor[leaf.id] = true; if (leaf.hub) hubDoor[trunk.id] = true;
        addDoor(trunk, leaf, best.wall, "door", dealState(leaf), best.a.kind === "passage" || best.b.kind === "passage" ? 0.5 : drng.range(0.3, 0.7));
      }
      rs.forEach(function (r) { if (!inTree[r.id]) warnings.push(r.name + " on the " + FLOOR_NAMES[String(level)].toLowerCase() + " shares no wall long enough for a door"); });
      adj.forEach(function (e) {
        if (joined[e.a.id + "|" + e.b.id]) return;
        var passage = e.a.kind === "passage" || e.b.kind === "passage", kh = (e.a.kind === "kitchen" && e.b.entry) || (e.b.kind === "kitchen" && e.a.entry);
        var leaf = e.a.hub && !e.b.hub ? e.b : e.a, trunk = leaf === e.a ? e.b : e.a;
        if ((passage && !hubDoor[leaf.id] && !leaf.hub) || kh) { joined[e.a.id + "|" + e.b.id] = true; hubDoor[leaf.id] = true; addDoor(trunk, leaf, e.wall, "door", dealState(leaf), passage ? 0.5 : drng.range(0.3, 0.7)); }
      });
      /* the stair's ground-floor doorway may be a secret one (a thieves' den) */
      if (level === 0 && PR.secretStair) doors.forEach(function (d) { if (d.floor === 0 && d.rooms.some(function (id) { return /^stair-/.test(id); })) d.state = "secret"; });
    });
    /* the front door: through the entry room's front wall, nearest the middle of the front; a back door from the program's room */
    var ground = byFloor(0), putG = placer(levelsList.indexOf(0));
    function frontWall(r) {   /* the room's cell edge on the front line (local), as a wall in sheet coordinates */
      var i, n = r.local.length, a, b, best = null, need = (r.entryW || ENTRY_W) + 0.6 * K;
      for (i = 0; i < n; i++) { a = r.local[i]; b = r.local[(i + 1) % n]; if (Math.abs(a[1]) < EPS && Math.abs(b[1]) < EPS && Math.abs(a[0] - b[0]) >= need) { var lo = Math.min(a[0], b[0]), hi = Math.max(a[0], b[0]); if (!best || hi - lo > best.hi - best.lo) best = { lo: lo, hi: hi }; } }
      if (!best) return null;
      var tx = U.clamp(frame.len / 2, best.lo + (r.entryW || ENTRY_W) / 2 + 0.3 * K, best.hi - (r.entryW || ENTRY_W) / 2 - 0.3 * K);
      return { p: putG([best.lo, 0]), q: putG([best.hi, 0]), t: (tx - best.lo) / (best.hi - best.lo) };
    }
    var entry = null; ground.forEach(function (r) { if (r.entry && frontWall(r)) entry = entry || r; });
    if (!entry) { var bestLen = 0; ground.forEach(function (r) { var fw = frontWall(r); if (fw) { var l = G.dist(fw.p, fw.q); if (l > bestLen) { bestLen = l; entry = r; } } }); }
    NS.assert(entry, "no room reaches the front of the building for a door", { front: S.front });
    var fw0 = frontWall(entry), front = addDoor(entry, null, fw0, "entrance", "door", fw0.t);
    var portals = [{ id: "door-front", kind: "door", name: "the front door", x: front.x, y: front.y, way: "out", to: { generator: S.above.generator || "town", site: S.above.site || null, id: S.above.id || null } }];
    if (PR.back) {   /* from the program's room when it has an outer wall besides the front; else from the passage, which runs along the back wall when it is a side one */
      var cands2 = []; ground.forEach(function (r) { if (r.kind === PR.back) cands2.push(r); }); ground.forEach(function (r) { if (r.kind === "passage") cands2.push(r); });
      function backWallOf(r) { var bestW = null; r.exterior.forEach(function (i) { var a = r.local[i], b = r.local[(i + 1) % r.local.length]; if (Math.abs(a[1]) < EPS && Math.abs(b[1]) < EPS) return; var l = G.dist(a, b); if (l >= ENTRY_W + 0.8 * K && (!bestW || l > bestW.len)) bestW = { p: putG(a), q: putG(b), len: l }; }); return bestW; }
      for (var bi = 0; bi < cands2.length; bi++) {
        var bw = backWallOf(cands2[bi]); if (!bw) continue;
        var back = addDoor(cands2[bi], null, bw, "back", "door", 0.5); portals.push({ id: "door-back", kind: "door", name: "the back door", x: back.x, y: back.y, way: "out", to: U.extend({}, portals[0].to) }); break;
      }
    }
    /* the ways DOWN: a room whose spec is a portal (a temple's crypt stair, a keep's stair to its dungeons) is a portal
       of kind stairs into that dungeon site; the level beneath (dungeon.fromInterior) carries it as its one way up */
    rooms.forEach(function (r) { if (r.portal) portals.push({ id: r.id, kind: "stairs", name: r.name, x: r.x, y: r.y, way: "down", to: { generator: "dungeon", site: r.portal, id: r.id } }); });
    /* the stairs: one flight joins the stair rooms of neighbouring levels */
    levelsList.forEach(function (level, i) {
      if (i === 0) return; var lo = null, hi = null;
      byFloor(levelsList[i - 1]).forEach(function (r) { if (r.kind === "stair") lo = lo || r; }); byFloor(level).forEach(function (r) { if (r.kind === "stair") hi = hi || r; });
      if (lo && hi) stairs.push({ id: "s" + stairs.length, from: levelsList[i - 1], to: level, rooms: [lo.id, hi.id] });
      else warnings.push("no stair joins the " + FLOOR_NAMES[String(levelsList[i - 1])].toLowerCase() + " and the " + FLOOR_NAMES[String(level)].toLowerCase());
    });
    /* windows in the outer walls above ground, clear of the doors and the corners */
    rooms.forEach(function (r) {
      if (r.floor < 0 || !r.windows) return;
      r.exterior.forEach(function (i) {
        var a = r.poly[i], b = r.poly[(i + 1) % r.poly.length], dx = b[0] - a[0], dy = b[1] - a[1], l = Math.sqrt(dx * dx + dy * dy), n = Math.floor((l - 2 * WINDOW_CLEAR) / WINDOW_STEP) + 1, k, t, x, y;
        if (l < 2 * WINDOW_CLEAR + WINDOW_W) return;
        var step = n > 1 ? (l - 2 * WINDOW_CLEAR) / (n - 1) : 0;
        for (k = 0; k < n; k++) {
          t = n > 1 ? (WINDOW_CLEAR + k * step) / l : 0.5; x = a[0] + dx * t; y = a[1] + dy * t;
          if (doors.some(function (d) { return d.floor === r.floor && G.dist([d.x, d.y], [x, y]) < WINDOW_CLEAR; })) continue;
          windows.push({ room: r.id, floor: r.floor, x: U.round(x, 1), y: U.round(y, 1), a: U.round(Math.atan2(dy, dx), 3), width: WINDOW_W });
        }
      });
    });
    /* the author's say over a room that stands: its name, the GM's note, what stands in its doorway (every door that
       opens into it; `front` and `back` are the doors out); a dangling id is a warning, never silent */
    var roomById = {}; rooms.forEach(function (r) { roomById[r.id] = r; });
    P.edits.forEach(function (e) {
      if (e.op === "add" || e.op === "remove") return;
      if (e.op === "door" && (e.id === "front" || e.id === "back")) { var outs = doors.filter(function (d) { return d.kind === (e.id === "front" ? "entrance" : "back"); }); if (!outs.length) warnings.push("door " + e.id + ": the building has no " + e.id + " door"); outs.forEach(function (d) { d.state = e.state; }); return; }
      var r = roomById[e.id]; if (!r) { warnings.push(e.op + " " + e.id + ": no room with that id"); return; }
      if (e.op === "rename") { r.name = e.name; r.renamed = true; }
      else if (e.op === "note") { if (e.note) r.note = e.note; else delete r.note; }
      else if (e.op === "door") { var ds = doors.filter(function (d) { return d.kind === "door" && d.into === r.id; }); if (!ds.length) ds = doors.filter(function (d) { return d.kind === "door" && d.rooms.indexOf(r.id) >= 0; }); if (!ds.length) warnings.push("door " + e.id + ": " + r.name + " has no doorway"); ds.forEach(function (d) { d.state = e.state; }); }
    });
    /* furnishing, from the seed by room id; every piece carries an id the game can point at (a chest to loot, a bed to search) */
    var frontLine = [putG([0, 0]), putG([frame.len, 0])];
    rooms.forEach(function (r) { r.furniture = furnish(r, r.floorPoly, doors.filter(function (d) { return d.rooms.indexOf(r.id) >= 0; }), r.floor === 0 ? frontLine : null, NS.Rng(seed + "/furnish/" + r.id)); r.furniture.forEach(function (it, i) { it.id = r.id + "-f" + (i + 1); }); });

    /* the document */
    var facing = G.bearing([0, 0], [-frame.n[0], -frame.n[1]]).name, title = P.title || S.name || U.titleCase("the " + S.word);
    var docRooms = rooms.map(function (r) {
      var o = { id: r.id, kind: r.kind, word: r.word, name: r.name, floor: r.floor, poly: r.poly, floorPoly: r.floorPoly, x: r.x, y: r.y, areaM2: r.areaM2, exterior: r.exterior, hub: r.hub, furniture: r.furniture };
      if (r.entry) o.entry = true; if (r.open) o.open = true; if (r.portal) o.portal = r.portal; if (r.authored) o.authored = true; if (r.renamed) o.renamed = true; if (r.note) o.note = r.note;
      return o;
    });
    var stats = { rooms: docRooms.length, doors: doors.length, floors: floors.length, areaM2: Math.round(areaM2), ms: Math.round(NS.terrain.now() - t0) };
    return {
      format: NS.DOC_FORMAT, ver: NS.DOC_VER, generator: { name: "interior", version: NS.VERSION },
      seed: seed, params: input, frame: { width: sheetW, height: sheetH, kmPerUnit: M_PER_UNIT / 1000, mPerUnit: M_PER_UNIT },
      title: { name: title, kind: S.word }, site: S, kind: key, word: S.word, facing: facing, areaM2: Math.round(areaM2), levels: levelsList,
      floors: floors.map(function (f) { return { level: f.level, name: f.name, outline: f.outline, rooms: f.rooms }; }),
      rooms: docRooms, doors: doors.map(function (d) { return { id: d.id, kind: d.kind, rooms: d.rooms, floor: d.floor, x: d.x, y: d.y, a: d.a, width: d.width, state: d.state, into: d.into }; }),
      windows: windows, stairs: stairs, portals: portals, warnings: warnings, stats: stats
    };
  }

  /* ── nesting: the interior of a town's building, by the town's portal into it (null: the first) ── the footprint is
     the building's polygon in interior units, the front the edge nearest a street; the way out leads back onto the
     town at that establishment or landmark */
  function fromTown(townDoc, portalId) {
    NS.assert(townDoc && townDoc.format === NS.DOC_FORMAT && townDoc.generator && townDoc.generator.name === "town", "fromTown needs a town document", { format: townDoc && townDoc.format, generator: townDoc && townDoc.generator });
    var ins = (townDoc.portals || []).filter(function (p) { return p.to && p.to.generator === "interior"; }), portal = null;
    NS.assert(ins.length, "this town has no building to enter (no establishment stands in a house, and it has no temple or keep)", { portals: (townDoc.portals || []).map(function (p) { return p.id; }) });
    if (portalId === null || portalId === undefined) portal = ins[0]; else ins.forEach(function (p) { if (p.id === portalId) portal = p; });
    NS.assert(portal, "no portal with that id leads into a building of this town", { portalId: portalId, known: ins.map(function (p) { return p.id; }) });
    var k = townDoc.frame.mPerUnit / M_PER_UNIT, fp = null, name = portal.name, what = null, landmark = null, district = null, i;
    townDoc.establishments.forEach(function (e) { if (e.id === portal.id) what = e; });
    if (what) { NS.assert(what.building !== null && what.building !== undefined && townDoc.buildings[what.building], "the establishment stands in no house", { id: portal.id }); fp = townDoc.buildings[what.building].pts; district = what.district || null; }
    else { townDoc.landmarks.forEach(function (l) { if (l.id === portal.id) landmark = l; }); NS.assert(landmark && landmark.poly, "the landmark has no footprint to enter", { id: portal.id }); fp = landmark.poly; }
    var pts = fp.map(function (p) { return [U.round(p[0] * k, 1), U.round(p[1] * k, 1)]; }), front = 0, best = Infinity, n = fp.length;
    for (i = 0; i < n; i++) {   /* the edge nearest a street, longer edges preferred when it is close */
      var a = fp[i], b = fp[(i + 1) % n], mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], d = Infinity, len = G.dist(a, b);
      townDoc.streets.forEach(function (s) { d = Math.min(d, M.distToPolyline(mid, s.pts)); });
      (townDoc.roads || []).forEach(function (r) { d = Math.min(d, M.distToPolyline(mid, r.pts)); });
      var score = d - len * 0.12; if (score < best) { best = score; front = i; }
    }
    if (landmark && landmark.kind === "temple") {   /* a temple is entered by its west front: an end of the nave (the edges across the long axis, farthest out), the one nearer a street */
      var ex = M.extents(fp), ca = Math.cos(ex.angle), sa = Math.sin(ex.angle), ends = [];
      for (i = 0; i < n; i++) { var a2 = fp[i], b2 = fp[(i + 1) % n], l2 = G.dist(a2, b2) || 1, m2 = [(a2[0] + b2[0]) / 2, (a2[1] + b2[1]) / 2]; if (Math.abs(((b2[0] - a2[0]) * ca + (b2[1] - a2[1]) * sa) / l2) < 0.3) ends.push({ i: i, proj: Math.abs((m2[0] - ex.centre[0]) * ca + (m2[1] - ex.centre[1]) * sa), mid: m2 }); }
      ends.sort(function (p, q) { return q.proj - p.proj; });
      if (ends.length) { var bd2 = Infinity; ends.slice(0, 2).forEach(function (e2) { var d2 = Infinity; townDoc.streets.forEach(function (s) { d2 = Math.min(d2, M.distToPolyline(e2.mid, s.pts)); }); if (d2 < bd2) { bd2 = d2; front = e2.i; } }); }
    }
    return { seed: townDoc.seed + "/" + portal.id, culture: townDoc.params.culture, title: null,
      site: { kind: what ? what.kind : landmark.kind, name: name, word: what ? what.word : landmark.kind, footprint: pts, front: front, town: { name: townDoc.title.name, size: townDoc.size }, mPerUnit: M_PER_UNIT, above: { generator: "town", site: what ? "establishment" : "landmark", id: portal.id, name: townDoc.title.name }, district: district } };
  }

  /* ── for the game and the UI ── */
  function byId(doc, id) { var i; for (i = 0; i < doc.rooms.length; i++) if (doc.rooms[i].id === id) return doc.rooms[i]; return null; }
  /* the room under a point (null between the floors; a cell includes its walls) */
  function locate(doc, p) { var i; for (i = 0; i < doc.rooms.length; i++) if (G.pointInPolygon(p, doc.rooms[i].poly)) return doc.rooms[i].id; return null; }
  /* what adjoins what: rooms joined by a door, the stair rooms of neighbouring levels */
  function graph(doc) {
    var adj = {}; doc.rooms.forEach(function (r) { adj[r.id] = []; });
    function join(a, b) { if (a && b && adj[a] && adj[b]) { if (adj[a].indexOf(b) < 0) adj[a].push(b); if (adj[b].indexOf(a) < 0) adj[b].push(a); } }
    doc.doors.forEach(function (d) { join(d.rooms[0], d.rooms[1]); });
    doc.stairs.forEach(function (s) { join(s.rooms[0], s.rooms[1]); });
    return adj;
  }
  /* a room's size in metres: the floor polygon's extents, to the half metre */
  function dimensions(room, mPerUnit) {
    var ext = M.extents(room.floorPoly || room.poly), a = Math.round(ext.along * mPerUnit * 2) / 2, b = Math.round(ext.across * mPerUnit * 2) / 2, A = room.areaM2 || Math.round(area(room.floorPoly || room.poly) * mPerUnit * mPerUnit);
    return { along: a, across: b, areaM2: A, text: a + " × " + b + " m" };
  }
  /* the point bearings and distances are reckoned from: the front door */
  function reference(doc) { var p = doc.portals[0]; return { x: p ? p.x : doc.frame.width / 2, y: p ? p.y : doc.frame.height / 2, word: "the front door", at: "by the front door" }; }
  function caption(doc) { var S = doc.site; return doc.word + (S.town && S.town.name ? " in " + S.town.name : "") + " · " + doc.floors.length + (doc.floors.length === 1 ? " floor" : " floors") + ", " + doc.areaM2 + " m² · the door opens to the " + doc.facing; }
  function floorName(level) { return FLOOR_NAMES[String(level)] || "level " + level; }
  /* the words for what furnishes a room: "a hearth, four tables and a counter" */
  var NUMBERS = ["no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve"];
  function furnitureText(items) {
    var counts = {}, order = [], out = [];
    items.forEach(function (it) { if (!counts[it.kind]) { counts[it.kind] = 0; order.push(it.kind); } counts[it.kind]++; });
    order.forEach(function (k) { var F = FIXTURES[k], n = counts[k]; out.push(n === 1 || k === "shelf" ? F.one : (NUMBERS[n] || n) + " " + F.many); });
    if (!out.length) return "";
    return out.length === 1 ? out[0] : out.slice(0, -1).join(", ") + " and " + out[out.length - 1];
  }

  function validate(doc) {
    ["floors", "rooms", "doors", "windows", "stairs", "portals", "levels"].forEach(function (k) { NS.assert(Array.isArray(doc[k]), "document." + k + " must be an array", { key: k }); });
    NS.assert(NS.own(PROGRAMS, doc.kind), "document.kind must be a program: " + Object.keys(PROGRAMS).join("|"), { kind: doc.kind });
    NS.assert(doc.frame.mPerUnit > 0, "document.frame.mPerUnit must be positive", { frame: doc.frame });
    var ids = {}, levels = {};
    doc.floors.forEach(function (f, i) { NS.assert(U.isNum(f.level) && typeof f.name === "string" && Array.isArray(f.outline) && f.outline.length >= 3 && Array.isArray(f.rooms), "floor " + i + " is malformed", { floor: f }); levels[f.level] = true; });
    doc.rooms.forEach(function (r, i) { NS.assert(r.id && !ids[r.id] && r.kind && typeof r.word === "string" && typeof r.name === "string" && Array.isArray(r.poly) && r.poly.length >= 3 && Array.isArray(r.floorPoly) && r.floorPoly.length >= 3 && isFinite(r.x) && isFinite(r.y) && levels[r.floor] && Array.isArray(r.furniture) && r.furniture.every(function (it) { return FIXTURES[it.kind] && isFinite(it.x) && isFinite(it.y); }) && (r.note === undefined || typeof r.note === "string"), "room " + i + " is malformed or its id is not unique", { room: r }); ids[r.id] = true; });
    doc.doors.forEach(function (d, i) { NS.assert(d.id && Array.isArray(d.rooms) && d.rooms.length === 2 && ids[d.rooms[0]] && (d.rooms[1] === null || ids[d.rooms[1]]) && DOOR_STATES[d.state] && isFinite(d.x) && isFinite(d.y) && d.width > 0, "door " + i + " is malformed", { door: d }); });
    doc.stairs.forEach(function (s, i) { NS.assert(s.id && Array.isArray(s.rooms) && ids[s.rooms[0]] && ids[s.rooms[1]] && levels[s.from] && levels[s.to], "stair " + i + " is malformed", { stair: s }); });
    var pids = {};
    doc.portals.forEach(function (p, i) { NS.assert(p.id && !pids[p.id] && ((p.kind === "door" && p.way === "out") || (p.kind === "stairs" && p.way === "down" && p.to && p.to.generator === "dungeon")) && isFinite(p.x) && isFinite(p.y) && p.to && p.to.generator, "portal " + i + " is malformed or its id is not unique", { portal: p }); pids[p.id] = true; });
    return doc;
  }

  NS.interior = { generate: generate, DEFAULTS: DEFAULTS, M_PER_UNIT: M_PER_UNIT, K: K, PROGRAMS: PROGRAMS, programs: function () { return Object.keys(PROGRAMS); }, programOf: programOf, roomKinds: roomKinds, roomWord: roomWord, validateCounts: validateCounts, validateEdits: validateEdits, OPS: Object.keys(OPS), MAX_COUNT: MAX_COUNT, MAX_NAME: MAX_NAME, MAX_NOTE: MAX_NOTE, MAX_WORD: MAX_WORD, CUSTOM: CUSTOM, ADD_M2: ADD_M2, FIXTURES: FIXTURES, fixtureSize: fixtureSize, FURNISH: FURNISH, DOOR_STATES: DOOR_STATES, SIZE_INDEX: SIZE_INDEX, WALL: WALL, OUTER: OUTER,
    resolveParams: resolveParams, fromTown: fromTown, validate: validate, locate: locate, graph: graph, dimensions: dimensions, reference: reference, caption: caption, floorName: floorName, furnitureText: furnitureText, byId: byId, MAX_NOTE: MAX_NOTE, MAX_NAME: MAX_NAME, convexBlocks: convexBlocks, stairCut: stairCut, bandsOf: bandsOf, endDir: endDir };
})(typeof self !== "undefined" ? self : typeof global !== "undefined" ? global : this);

/* ───── 46-wild.js ───── */
/* 46-wild.js — the WILD generator: a zone of open country between the places — a wood, a marsh, a waste, a mountain
   pass, the downs, a heath — at the town's scale (800 × 550 units of 1.25 m: 1 km by 690 m), entered from a POINT on
   the region (TnDMaps.wild.fromRegion(regionDoc, [x, y] | zoneId): the region is tiled into zones of that size, so the
   same ground comes back for any point in it). Like the caves it is grown, not built: noise fields on a grid are
   contoured by marching squares into organic polygons (the region's coast machinery), a river bends across, a stream
   finds its own way downhill, a track picks the cheapest way through, and the points of interest the GM needs are
   dealt from the seed. Every per-terrain concern is a TERRAINS entry; every point of interest a CATALOGUE entry.
   A zone of a region is the region's own ground: its shore is the region's coast and lakes, its rivers and roads the
   region's, cut where they cross the zone's edges — by the same arithmetic from both sides of an edge, so what leaves
   one sheet enters the next at the same point (site.shore, site.rivers, site.roads). Only the ground between is the
   zone's own. A zone that stands alone draws its sea, river and track from the seed along the bearings it is given. */
(function (root) {
  "use strict";
  var NS = root.TnDMaps, U = NS.util, G = NS.geom, M = NS.mesh;
  var M_PER_UNIT = 1.25, ZONE_KM = { w: 800 * M_PER_UNIT / 1000, h: 550 * M_PER_UNIT / 1000 };   /* the sheet: 1 km × 0.6875 km */
  var BEARINGS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"], MAX_COUNT = 4, MAX_NAME = 40, MAX_NOTE = 400, SPACING = 56, MARGIN = 28;
  var EDGES = { N: [0, -1], E: [1, 0], S: [0, 1], W: [-1, 0] };   /* a sheet's four edges and the way out through each */
  /* a zone of a region: the least share of it that must be land (a zone is open country), how far past its edges the
     shore is read (sheet units), how far the shore is let wander from the region's line and at what grain; a region's
     road is cut into steps of ROAD_SUB (region units), stands for a later road within ROAD_TOL of it, and touches it
     within ROAD_TOUCH; two road ends within WAY_GAP (sheet units) on one edge are one way on; a river that ends short of the water or of the river it joins is led on to it within
     MOUTH_REACH (region units) */
  var MIN_LAND = 0.05, LATTICE = [24, 16], SHORE_REACH = 200, SHORE_WOBBLE = 44, SHORE_GRAIN = 300, ROAD_SUB = 0.5, ROAD_TOL = 1.25, ROAD_TOUCH = 0.001, MOUTH_REACH = 3, WAY_GAP = 12;
  function dirOf(b) { var a = BEARINGS.indexOf(b) * Math.PI / 4; return [Math.sin(a), -Math.cos(a)]; }
  function opposite(b) { return BEARINGS[(BEARINGS.indexOf(b) + 4) % 8]; }
  function jit(label, salt) { return (NS.hash32(label, salt) % 10000) / 10000; }

  /* ── the terrains ── each: its words, the local-name patterns (the culture's roots fill them), the lie of the land
     (`relief`: amplitude, noise scale, a ridged share, the height of a full unit in map units so a slope is a tangent, a
     carved VALLEY for a pass), its other fields (cover: where the vegetation stands; wet: where the water lies), the
     COVER layers — each a band of a field contoured into polygons, drawn with a style key, stamped with a glyph —,
     how many form lines to draw, the chance of a brook, what a road becomes here, and the points of interest it deals. */
  var TERRAINS = {
    forest: { word: "forest", a: "a forest", names: ["{R} Wood", "The {A} Wood", "{R} Holt", "{R}shaw", "The {A} Weald", "{R} Hurst", "The {S} Wood"],
      relief: { amp: 0.4, scale: 300, ridged: 0, height: 60 }, fields: { cover: { scale: 150, bias: 0.3, open: { path: 14, water: 11 } }, wet: { scale: 120, bias: -0.35 } },
      cover: [{ kind: "wood", field: "cover", min: 0, glyph: "tree", step: 12.5, size: [0.9, 1.4], draw: "wood" },
        { kind: "thicket", field: "cover", min: 0.5, glyph: "tree", step: 8, size: [0.55, 0.8], draw: "thicket" },
        { kind: "pool", field: "wet", min: 0.5, water: true }],
      contours: 0, stream: 0.8, features: { glade: 2, tree: 1, hut: 1, stones: 1, ruin: 1, spring: 1, camp: 1, den: 1 } },
    marsh: { word: "marsh", a: "a marsh", names: ["{R} Fen", "The {A} Mire", "{R} Moss", "The {R} Carr", "{R} Fenn", "The {S} Marsh"],
      relief: { amp: 0.14, scale: 200, ridged: 0, height: 12 }, fields: { wet: { scale: 110, bias: 0.15 }, cover: { scale: 90, bias: 0.05, open: { path: 8, water: 6 } } },
      cover: [{ kind: "reeds", field: "wet", min: -0.1, glyph: "reed", step: 10, size: [0.8, 1.15] },
        { kind: "bog", field: "wet", min: 0.3, draw: "bog" },
        { kind: "pool", field: "wet", min: 0.58, water: true },
        { kind: "copse", field: "cover", min: 0.55, and: { wet: [-9, 0.1] }, glyph: "tree", step: 9, size: [0.6, 0.9], draw: "wood" }],
      contours: 0, stream: 0.9, path: "causeway", features: { mere: 1, isle: 1, hut: 1, snag: 2, bones: 1, stones: 1 } },
    desert: { word: "waste", a: "a desert", names: ["The {A} Waste", "{R} Sands", "The {R} Flats", "{R} Erg", "The {A} Expanse", "The {S} Sands"],
      relief: { amp: 0.32, scale: 260, ridged: 0, height: 60 }, fields: { cover: { scale: 170, bias: -0.1, open: { path: 0, water: 0 } }, wet: { scale: 160, bias: -0.55 } },
      cover: [{ kind: "dunes", field: "cover", min: 0.05, and: { relief: [-9, 0.68] }, glyph: "dune", step: 13, size: [0.9, 1.4], wind: true },
        { kind: "rock", field: "relief", min: 0.68, draw: "rock", hatch: true, glyph: "rock", step: 17, size: [0.6, 1] },
        { kind: "scrubland", field: "wet", min: 0.05, glyph: "scrub", step: 12, size: [0.7, 1] }],
      contours: 0, stream: 0, features: { oasis: 1, cairn: 1, bones: 1, ruin: 1, well: 1, camp: 1, arch: 1 } },
    mountain: { word: "mountains", a: "a mountain pass", names: ["{R} Pass", "The {A} Gap", "{R} Fell", "The {A} Crags", "{R} Scar", "{R}'s Notch", "The {S} Pass"],
      relief: { amp: 1, scale: 420, ridged: 0.6, ridgedOct: 3, height: 200, valley: { depth: 0.55, width: 60 } }, fields: { cover: { scale: 140, bias: -0.3, open: { path: 10, water: 8 } }, wet: { scale: 120, bias: -0.6 } },
      cover: [{ kind: "crag", field: "slope", min: 2.7, and: { relief: [0.2, 9] }, draw: "crag", hatch: true },
        { kind: "scree", field: "slope", min: 1.9, max: 2.7, and: { relief: [0.12, 0.8] }, glyph: "rock", step: 9, size: [0.3, 0.55] },
        { kind: "snow", field: "relief", min: 0.86, draw: "snow" },
        { kind: "wood", field: "cover", min: 0.15, and: { relief: [-9, 0.45], slope: [-9, 1.3] }, glyph: "tree", step: 11, size: [0.6, 0.9], draw: "wood" }],
      contours: 9, stream: 0.9, features: { pass: 1, tarn: 1, cairn: 1, shieling: 1, shrine: 1, fall: 1, eyrie: 1 } },
    hills: { word: "hills", a: "the hills", names: ["{R} Down", "The {A} Hills", "{R} Rise", "{R} Knoll", "The {A} Downs", "{R} Hill"],
      relief: { amp: 0.65, scale: 240, ridged: 0.15, height: 130 }, fields: { cover: { scale: 140, bias: -0.05, open: { path: 10, water: 8 } }, wet: { scale: 120, bias: -0.5 } },
      cover: [{ kind: "wood", field: "cover", min: 0.28, glyph: "tree", step: 10, size: [0.7, 1.05], draw: "wood" },
        { kind: "gorse", field: "cover", min: -0.05, max: 0.28, glyph: "scrub", step: 15, size: [0.5, 0.8] },
        { kind: "crag", field: "slope", min: 0.95, draw: "crag", hatch: true },
        { kind: "pool", field: "wet", min: 0.5, water: true }],
      contours: 7, stream: 0.7, features: { barrow: 1, stone: 1, fold: 1, spring: 1, fort: 1, copse: 1 } },
    heath: { word: "heath", a: "open heath", names: ["{R} Heath", "The {A} Moor", "{R} Common", "{R} Lea", "The {A} Flats", "{R} Field"],
      relief: { amp: 0.28, scale: 300, ridged: 0, height: 45 }, fields: { cover: { scale: 130, bias: -0.3, open: { path: 10, water: 8 } }, wet: { scale: 120, bias: -0.3 } },
      cover: [{ kind: "wood", field: "cover", min: 0.35, glyph: "tree", step: 10, size: [0.7, 1.05], draw: "wood" },
        { kind: "gorse", field: "cover", min: 0.05, max: 0.35, glyph: "scrub", step: 14, size: [0.5, 0.8] },
        { kind: "pool", field: "wet", min: 0.45, water: true }],
      contours: 0, stream: 0.5, features: { pond: 1, copse: 1, stone: 1, milestone: 1, gallows: 1, barn: 1, shrine: 1 } }
  };
  var TERRAIN_OF_BIOME = { plain: "heath", forest: "forest", hills: "hills", mountain: "mountain", marsh: "marsh", scrub: "desert", ocean: null, lake: null };

  /* ── the points of interest ── kind → its word, the icon on its plaque, WHERE it stands (a WHERE scorer), the
     mark the ink draws for it (75-scene), what it MAKES in the ground (a pool, a copse), its name patterns */
  var CATALOGUE = {
    glade: { word: "a clearing", icon: "tree", where: "open", clear: 30, patterns: ["{R} Glade", "The {A} Clearing", "{S}'s Glade", "The {A} Lawn"] },
    tree: { word: "a great tree", icon: "tree", where: "wood", mark: "greatTree", clear: 16, patterns: ["The {A} Oak", "{R}'s Oak", "The {S} Tree", "The {A} Yew"] },
    hut: { word: "a hut", icon: "door", where: "open", mark: "hut", clear: 12, patterns: ["{R}'s Hut", "The {A} Hut", "{R}'s Bothy"] },
    stones: { word: "a ring of standing stones", icon: "star", where: "open", mark: "stones", clear: 18, patterns: ["The {A} Stones", "{R}'s Ring", "The {S} Stones", "The Nine of {R}"] },
    ruin: { word: "a ruin", icon: "tower", where: "any", mark: "ruin", clear: 16, patterns: ["{R} Ruin", "The {A} Tower", "Old {R}", "{R}'s Fall"] },
    spring: { word: "a spring", icon: "well", where: "spring", mark: "spring", clear: 8, patterns: ["{R} Spring", "The {A} Spring", "{R}'s Well", "The {S} Spring"] },
    camp: { word: "a camp", icon: "tent", where: "path", mark: "camp", clear: 14, patterns: ["{R}'s Camp", "The {A} Camp", "The {S} Camp"] },
    den: { word: "a den", icon: "skull", where: "wood", mark: "den", clear: 10, patterns: ["The {S}'s Den", "{R}'s Hollow", "The {A} Hollow"] },
    mere: { word: "a mere", icon: null, where: "pool", patterns: ["{R} Mere", "The {A} Pool", "{S} Pool", "The {A} Mere"] },
    isle: { word: "an isle of firm ground", icon: null, where: "firm", clear: 0, patterns: ["{R} Isle", "The {A} Hummock", "{R} Holm", "{S} Isle"] },
    snag: { word: "a dead tree", icon: null, where: "any", mark: "snag", clear: 10, patterns: ["The {A} Snag", "The Hanged Tree", "{R}'s Tree", "The {S} Tree"] },
    bones: { word: "bones", icon: "skull", where: "any", mark: "bones", clear: 10, patterns: ["The {S} Bones", "{R}'s Fall", "The {A} Bones"] },
    oasis: { word: "an oasis", icon: "well", where: "low", makes: { pool: 15, trees: 7 }, clear: 0, patterns: ["{R} Oasis", "The {A} Spring", "Wells of {R}", "{S} Oasis"] },
    cairn: { word: "a cairn", icon: null, where: "high", mark: "cairn", clear: 10, patterns: ["{R}'s Cairn", "The {A} Cairn", "The {S} Cairn"] },
    well: { word: "a well", icon: "well", where: "path", mark: "well", clear: 10, patterns: ["{R} Well", "The {A} Well", "{S} Well"] },
    arch: { word: "a rock arch", icon: null, where: "rock", mark: "arch", clear: 14, patterns: ["The {A} Arch", "{R}'s Gate", "The {S} Arch"] },
    pass: { word: "the pass", icon: null, where: "saddle", clear: 0, patterns: ["{R} Pass", "The {A} Gap", "{R}'s Saddle", "The {S} Pass"] },
    tarn: { word: "a tarn", icon: null, where: "high", makes: { pool: 22 }, clear: 0, patterns: ["{R} Tarn", "The {A} Tarn", "{S} Tarn"] },
    shieling: { word: "a shepherd's hut", icon: "door", where: "open", mark: "hut", clear: 12, patterns: ["{R}'s Shieling", "The {A} Hut", "{R}'s Bothy"] },
    shrine: { word: "a wayside shrine", icon: "temple", where: "path", mark: "shrine", clear: 8, patterns: ["Shrine of {R}", "The {A} Shrine", "{R}'s Cross"] },
    fall: { word: "a waterfall", icon: null, where: "fall", mark: "fall", clear: 0, patterns: ["{R} Falls", "The {A} Fall", "{S} Leap"] },
    eyrie: { word: "an eyrie", icon: null, where: "crag", clear: 0, patterns: ["The {S}'s Eyrie", "{R}'s Ledge", "The {A} Eyrie"] },
    barrow: { word: "a barrow", icon: "tombstone", where: "high", mark: "barrow", clear: 18, patterns: ["{R}'s Barrow", "The {A} Howe", "{S} Barrow", "{R} Low"] },
    stone: { word: "a standing stone", icon: null, where: "open", mark: "stone", clear: 8, patterns: ["The {A} Stone", "{R}'s Stone", "The {S} Stone"] },
    fold: { word: "a sheepfold", icon: null, where: "open", mark: "fold", clear: 14, patterns: ["{R}'s Fold", "The {A} Fold"] },
    fort: { word: "a ring fort", icon: "tower", where: "high", mark: "fort", clear: 26, patterns: ["{R} Ring", "The {A} Fort", "{R}'s Dun", "{S} Ring"] },
    copse: { word: "a copse", icon: "tree", where: "open", makes: { wood: 20 }, clear: 0, patterns: ["{R} Copse", "The {A} Spinney", "{S} Copse"] },
    pond: { word: "a pond", icon: null, where: "low", makes: { pool: 14 }, clear: 0, patterns: ["{R} Pond", "The {A} Pond", "{S} Pond"] },
    milestone: { word: "a milestone", icon: null, where: "path", mark: "milestone", clear: 4, patterns: ["The {A} Stone", "{R} Milestone"] },
    gallows: { word: "a gallows", icon: "skull", where: "path", mark: "gallows", clear: 10, patterns: ["{R} Gallows", "The {A} Tree", "{S} Gallows"] },
    barn: { word: "a barn", icon: "door", where: "open", mark: "barn", clear: 14, patterns: ["{R}'s Barn", "The {A} Barn"] },
    custom: { word: "a place", icon: null, where: "any", mark: "stone", clear: 10, patterns: ["{R}'s Place"] }
  };
  /* WHERE a kind stands: a score for a candidate point from its context c — relief (0..1 as the terrain's quantile),
     slope, cover, wet, water (in a pool or the sea), dPath, dWater, wood (inside a wood layer), rock, crag, saddle,
     spring, fall. −Infinity: never there. The best-scoring free candidate takes the anchor. */
  var WHERE = {
    any: function (c) { return c.water ? -Infinity : 1 - c.slope; },
    open: function (c) { return c.water || c.wood || c.crag ? -Infinity : 1 - c.cover - c.slope * 0.5; },
    wood: function (c) { return c.water || !c.wood ? -Infinity : c.cover; },
    high: function (c) { return c.water || c.crag ? -Infinity : c.relief - c.slope * 0.5; },
    low: function (c) { return c.water || c.wood ? -Infinity : 1 - c.relief; },
    path: function (c) { return c.water || c.dPath > 22 || c.dPath < 6 ? -Infinity : 1 - c.dPath / 22; },
    firm: function (c) { return c.water || c.wet > 0 ? -Infinity : c.relief - c.wet; },
    rock: function (c) { return c.rock ? 1 : -Infinity; },
    crag: function (c) { return c.crag ? c.relief : -Infinity; },
    pool: function (c) { return c.poolAt ? 1 : -Infinity; },
    saddle: function (c) { return c.saddle ? 1 : -Infinity; },
    spring: function (c) { return c.spring ? 1 : -Infinity; },
    fall: function (c) { return c.fall ? 1 : -Infinity; }
  };
  var OPS = { add: 1, remove: 1, rename: 1, note: 1, move: 1 };

  var DEFAULTS = { seed: null, width: 800, height: 550, terrain: "forest", culture: "common", title: null, site: {}, features: {}, edits: [] };
  var SITE_KEYS = ["elevation", "slope", "coast", "lake", "river", "road", "caves", "place", "regionName", "regionSeed", "zone", "near", "within", "water", "seaName", "biome", "shore", "rivers", "roads"];
  function validateCounts(counts) {
    NS.assert(counts && typeof counts === "object" && !Array.isArray(counts), "features must be an object of kind → count", { features: counts });
    Object.keys(counts).forEach(function (k) { NS.assert(NS.own(CATALOGUE, k) && k !== "custom", "unknown feature kind", { kind: k, known: Object.keys(CATALOGUE) }); NS.assert(U.isNum(counts[k]) && counts[k] >= 0 && counts[k] <= MAX_COUNT && counts[k] === Math.round(counts[k]), "feature count must be an integer in [0, " + MAX_COUNT + "]", { kind: k, count: counts[k] }); });
    return counts;
  }
  function validateEdits(edits) {
    NS.assert(Array.isArray(edits), "edits must be an array", { edits: edits });
    edits.forEach(function (e, i) {
      NS.assert(e && NS.own(OPS, e.op), "edit " + i + ": op must be " + Object.keys(OPS).join("|"), { edit: e });
      NS.assert(typeof e.id === "string" && e.id.length && e.id.length <= 40, "edit " + i + ": id must be a short string", { edit: e });
      if (e.op === "add") { NS.assert(NS.own(CATALOGUE, e.kind), "edit " + i + ": unknown feature kind", { kind: e.kind, known: Object.keys(CATALOGUE) }); NS.assert(e.icon === undefined || e.icon === null || NS.own(NS.icons.ICONS, e.icon), "edit " + i + ": unknown icon", { icon: e.icon, known: NS.icons.names() }); if (e.kind === "custom") NS.assert(typeof e.word === "string" && e.word.length && e.word.length <= MAX_NAME, "edit " + i + ": a custom feature needs a word", { edit: e }); }
      if (e.op === "add" || e.op === "move") NS.assert(Array.isArray(e.at) && e.at.length === 2 && U.isNum(e.at[0]) && U.isNum(e.at[1]), "edit " + i + ": at must be [x, y]", { edit: e });
      if (e.op === "rename" || (e.op === "add" && e.name !== undefined && e.name !== null)) NS.assert(typeof e.name === "string" && e.name.trim().length && e.name.length <= MAX_NAME, "edit " + i + ": name must be 1–" + MAX_NAME + " characters", { edit: e });
      if (e.op === "note") NS.assert(typeof e.note === "string" && e.note.length <= MAX_NOTE, "edit " + i + ": note must be a string of at most " + MAX_NOTE + " characters", { edit: e });
    });
    return edits;
  }
  function resolveParams(input) {
    var P = U.extend({}, DEFAULTS, input || {}), k;
    for (k in input || {}) if (Object.prototype.hasOwnProperty.call(input, k) && !Object.prototype.hasOwnProperty.call(DEFAULTS, k)) NS.fail("unknown parameter", { param: k, known: Object.keys(DEFAULTS) });
    NS.assert(P.seed !== null && P.seed !== undefined && String(P.seed).length > 0, "seed is required (a string or number)", { seed: P.seed });
    NS.assert(NS.own(TERRAINS, P.terrain), "terrain must be one of " + Object.keys(TERRAINS).join("|"), { terrain: P.terrain });
    NS.assert(U.isNum(P.width) && P.width >= 300 && P.width <= 3000 && U.isNum(P.height) && P.height >= 200 && P.height <= 3000, "width and height must be numbers in [300, 3000] × [200, 3000]", { width: P.width, height: P.height });
    NS.assert(NS.own(NS.names.CULTURES, P.culture), "culture must be one of " + NS.names.cultures().join("|"), { culture: P.culture });
    NS.assert(P.title === null || typeof P.title === "string", "title must be a string or null", { title: P.title });
    NS.assert(P.site && typeof P.site === "object", "site must be an object", { site: P.site });
    for (k in P.site) if (Object.prototype.hasOwnProperty.call(P.site, k)) NS.assert(SITE_KEYS.indexOf(k) >= 0, "unknown site key", { key: k, known: SITE_KEYS });
    var S = P.site = U.extend({ elevation: null, slope: 0, coast: null, lake: null, river: null, road: null, caves: [], place: null, regionName: null, regionSeed: null, zone: null, near: null, within: null, water: false, seaName: null, biome: null }, P.site);
    if (typeof S.coast === "string") S.coast = { bearing: S.coast };
    if (typeof S.lake === "string") S.lake = { bearing: S.lake };
    if (typeof S.river === "string") { var pr = S.river.split("-"); S.river = { from: pr[0], to: pr[1] }; }
    if (typeof S.road === "string") { var rr = S.road.split("-"); S.road = { from: rr[0], to: rr[1] }; }
    [["coast", S.coast && S.coast.bearing], ["lake", S.lake && S.lake.bearing], ["river from", S.river && S.river.from], ["river to", S.river && S.river.to], ["road from", S.road && S.road.from], ["road to", S.road && S.road.to]].forEach(function (b) { if (b[1] !== null && b[1] !== undefined) NS.assert(BEARINGS.indexOf(b[1]) >= 0, "site " + b[0] + " must be a bearing (" + BEARINGS.join("|") + ")", { value: b[1] }); });
    if (S.river) { NS.assert(S.river.from && S.river.to && S.river.from !== S.river.to, "site river needs from and to bearings that differ", { river: S.river }); if (S.river.width === undefined || S.river.width === null) S.river.width = 8; NS.assert(U.isNum(S.river.width) && S.river.width >= 2 && S.river.width <= 60, "river width must be metres in [2, 60]", { width: S.river.width }); }
    if (S.road) { NS.assert(S.road.from && S.road.to && S.road.from !== S.road.to, "site road needs from and to bearings that differ", { road: S.road }); S.road.kind = S.road.kind || "track"; NS.assert(S.road.kind === "road" || S.road.kind === "track", "road kind must be road|track", { road: S.road }); }
    NS.assert(Array.isArray(S.caves), "site caves must be a list of {id, name, x, y}", { caves: S.caves });
    /* a zone of a region: its shore, rivers and roads as wild.fromRegion cut them (absent on a zone that stands alone) */
    function isPt(p) { return Array.isArray(p) && p.length >= 2 && U.isNum(p[0]) && U.isNum(p[1]); }
    function isEdge(e) { return e === null || e === undefined || Object.prototype.hasOwnProperty.call(EDGES, e); }
    function isEnd(e) { return e && typeof e === "object" && U.isNum(e.x) && U.isNum(e.y) && isEdge(e.edge) && (e.towards === undefined || Array.isArray(e.towards)) && (e.roads === undefined || Array.isArray(e.roads)); }
    if (S.shore !== undefined && S.shore !== null) NS.assert(typeof S.shore === "object" && isPt(S.shore.ref) && (S.shore.at === null || S.shore.at === "sea" || S.shore.at === "lake") && Array.isArray(S.shore.lines) && S.shore.lines.every(function (L) { return L && (L.kind === "sea" || L.kind === "lake") && Array.isArray(L.pts) && L.pts.length >= 2 && L.pts.every(isPt); }), "site shore must be {ref: [x, y], at: null|sea|lake, lines: [{kind: sea|lake, pts}]} (wild.fromRegion makes it)", { shore: S.shore });
    if (S.rivers !== undefined) { NS.assert(Array.isArray(S.rivers) && S.rivers.every(function (v) { return v && Array.isArray(v.pts) && v.pts.length >= 2 && v.pts.every(function (p) { return isPt(p) && U.isNum(p[2]) && p[2] >= 1 && p[2] <= 80; }) && isEdge(v.from) && isEdge(v.to); }), "site rivers must be a list of {pts: [[x, y, metres wide], …], from, to: N|E|S|W|null} (wild.fromRegion makes it)", { rivers: S.rivers }); NS.assert(!S.river || !S.rivers.length, "give the river by its bearings (site.river) or by its course (site.rivers), not both", { river: S.river }); }
    if (S.roads !== undefined) { NS.assert(Array.isArray(S.roads) && S.roads.every(function (w) { return w && (w.kind === "road" || w.kind === "track") && isEnd(w.from) && isEnd(w.to); }), "site roads must be a list of {kind: road|track, from: {x, y, edge}, to: {x, y, edge}} (wild.fromRegion makes it)", { roads: S.roads }); NS.assert(!S.road || !S.roads.length, "give the road by its bearings (site.road) or by its ends (site.roads), not both", { road: S.road }); }
    S.water = !!(S.water || S.coast || S.lake || S.river || (S.rivers && S.rivers.length) || P.terrain === "marsh");
    validateCounts(P.features); validateEdits(P.edits);
    P.seed = String(P.seed);
    return P;
  }

  /* ── geometry helpers ── */
  function roundPts(pts) { return pts.map(function (p) { return p.length > 2 ? [U.round(p[0], 1), U.round(p[1], 1), U.round(p[2], 2)] : [U.round(p[0], 1), U.round(p[1], 1)]; }); }
  /* the point where a ray from the frame's middle in a bearing meets the frame, slid along that edge by `slide` (−1..1 of the edge's half length) */
  function edgePoint(W, H, bearing, slide) {
    var d = dirOf(bearing), cx = W / 2, cy = H / 2, tx = d[0] ? (d[0] > 0 ? (W - cx) / d[0] : -cx / d[0]) : Infinity, ty = d[1] ? (d[1] > 0 ? (H - cy) / d[1] : -cy / d[1]) : Infinity, t = Math.min(tx, ty);
    var p = [cx + d[0] * t, cy + d[1] * t], onX = Math.abs(p[0]) < 1e-6 || Math.abs(p[0] - W) < 1e-6;
    if (onX) p[1] = U.clamp(p[1] + slide * H * 0.3, H * 0.08, H * 0.92); else p[0] = U.clamp(p[0] + slide * W * 0.3, W * 0.08, W * 0.92);
    return p;
  }
  function edgeOf(p, W, H) { return Math.abs(p[1]) < 1e-6 ? "N" : Math.abs(p[0] - W) < 1e-6 ? "E" : Math.abs(p[1] - H) < 1e-6 ? "S" : "W"; }
  /* an organic blob of radius r at c: twelve points nudged from the seed, smoothed */
  function blob(c, r, label, squash) {
    var pts = [], k, a, f, sq = squash || 1;
    for (k = 0; k < 12; k++) { a = (k + (jit(label + "/b" + k, 31) - 0.5) * 0.6) * Math.PI / 6; f = 0.72 + 0.4 * jit(label + "/c" + k, 37); pts.push([c[0] + Math.cos(a) * r * f, c[1] + Math.sin(a) * r * f * sq]); }
    return G.smooth(pts, 2, true);
  }
  /* a curve from a to b through two bent control points; across the frame from one edge to another */
  function bendLine(a, b, rng, bend) {
    var dx = b[0] - a[0], dy = b[1] - a[1], l = Math.sqrt(dx * dx + dy * dy) || 1, nx = -dy / l, ny = dx / l;
    var k1 = (rng.float() - 0.5) * 2 * bend * l, k2 = (rng.float() - 0.5) * 2 * bend * l, c1 = [a[0] + dx * 0.33 + nx * k1, a[1] + dy * 0.33 + ny * k1], c2 = [a[0] + dx * 0.66 + nx * k2, a[1] + dy * 0.66 + ny * k2];
    var pts = G.smooth([a, c1, c2, b], 3, false); pts[0] = a; pts[pts.length - 1] = b;
    return pts;
  }
  function acrossLine(W, H, from, to, rng, bend) {
    var a = edgePoint(W, H, from, (rng.float() - 0.5) * 1.2), b = edgePoint(W, H, to, (rng.float() - 0.5) * 1.2);
    return bendLine(a, b, rng, bend);
  }
  function clampPts(pts, W, H) { return pts.map(function (p) { return [U.clamp(p[0], 0, W), U.clamp(p[1], 0, H)].concat(p.slice(2)); }); }
  /* a point moved onto the nearest frame edge (a line's end after the wobble) */
  function snapEdge(p, W, H) { var d = [p[0], W - p[0], p[1], H - p[1]], m = Math.min.apply(null, d), q = p.slice(); if (m === d[0]) q[0] = 0; else if (m === d[1]) q[0] = W; else if (m === d[2]) q[1] = 0; else q[1] = H; return q; }

  /* ── the shore from drawn lines ── a zone of a region takes its sea and its lakes from the region's own outlines,
     handed over in the sheet's coordinates: `ref` is a point whose state is known (`at`), and a point's state is the
     ref's turned over once for every line crossed on the straight way to it. A vertex on that way counts for the side
     `sideOf` puts it on, the same for both segments that meet in it, so a corner is crossed once or not at all. */
  function sideOf(ax, ay, bx, by, px, py) { return (bx - ax) * (py - ay) - (by - ay) * (px - ax) >= 0 ? 1 : -1; }
  var shoreOut = { wet: null, d: 0 };   /* one answer object, written over by every call */
  function shoreState(shore, x, y) {
    var sea = shore.at === "sea", lake = shore.at === "lake", d = Infinity, rx = shore.ref[0], ry = shore.ref[1], pt = [x, y], i, j, L, p, q, dd;
    for (i = 0; i < shore.lines.length; i++) {
      L = shore.lines[i];
      for (j = 1; j < L.pts.length; j++) {
        p = L.pts[j - 1]; q = L.pts[j];
        dd = G.pointSegDist(pt, p, q); if (dd < d) d = dd;
        if (sideOf(rx, ry, x, y, p[0], p[1]) !== sideOf(rx, ry, x, y, q[0], q[1]) && sideOf(p[0], p[1], q[0], q[1], rx, ry) !== sideOf(p[0], p[1], q[0], q[1], x, y)) { if (L.kind === "lake") lake = !lake; else sea = !sea; }
      }
    }
    shoreOut.wet = sea ? "sea" : lake ? "lake" : null; shoreOut.d = d;
    return shoreOut;
  }
  /* the document's rivers: the main one and its branches (a confluence, a river that leaves the zone and comes back) */
  function riversOf(doc) { return doc.water.river ? [doc.water.river].concat(doc.water.branches || []) : []; }
  function say(names) { return names && names.length ? names.slice(0, 2).join(" and ") : null; }

  /* ── generate ── */
  function generate(input) {
    var P = resolveParams(input), S = P.site, T = TERRAINS[P.terrain], seed = P.seed, W = P.width, H = P.height, warnings = [], t0 = NS.terrain.now(), stats = {};
    var rng = NS.Rng(seed + "/wild"), namer = NS.names.Namer(NS.Rng(seed + "/names"), P.culture), i, k;
    var cols = 96, rows = Math.max(8, Math.round(cols * H / W)), g = G.Grid(cols, rows, W, H), dx = g.dx, n = g.n;
    var NR = NS.Noise(seed + "/relief"), NC = NS.Noise(seed + "/cover"), NW = NS.Noise(seed + "/wet"), wob = NS.Noise(seed + "/wobble");
    function polish(pts, closed) { var p = G.simplify(pts, dx * 0.3); if (closed && p.length < 3) return null; if (!closed && p.length < 2) return null; p = G.smooth(p, 2, closed); return G.wobble(p, wob.noise2, dx * 0.35, 1 / (2.2 * dx), closed); }

    /* the sea and the lake: one signed field, positive in the water, contoured into polygons. A zone of a region reads
       it off the region's shore — the distance to the nearest outline, signed by the side — and lets it wander by a
       noise of the REGION's seed over the region's ground, so the shore runs on unbroken into the zone beside it; a
       zone that stands alone has a sea beyond a line on the bearing it was given, a lake as an ellipse (the town's way) */
    var shore = S.shore || null, NSh = shore ? NS.Noise((S.regionSeed || seed) + "/shore") : null, ox = shore && S.zone ? S.zone.col * W : 0, oy = shore && S.zone ? S.zone.row * H : 0;
    var coast = !shore && S.coast ? dirOf(S.coast.bearing) : null, lake = !shore && S.lake ? dirOf(S.lake.bearing) : null, R = H / 2;
    var shoreAt = coast ? U.clamp(S.coast.dist || R * 0.62, R * 0.3, R * 0.95) : 0, lakeAt = lake ? U.clamp(S.lake.dist || R * 1.1, R * 0.7, R * 1.3) : 0;
    function seaF(x, y) {
      var v = -1e9, proj, along, ex, ey, e, lx, ly, st;
      if (shore) { st = shoreState(shore, x, y); return (st.wet ? 1 : -1) * Math.min(st.d, SHORE_REACH) + NSh.fbm((ox + x) / SHORE_GRAIN + 7.31, (oy + y) / SHORE_GRAIN + 1.7, 3) * SHORE_WOBBLE; }
      if (coast) { proj = (x - W / 2) * coast[0] + (y - H / 2) * coast[1]; along = -(x - W / 2) * coast[1] + (y - H / 2) * coast[0]; v = Math.max(v, proj - (shoreAt + NW.fbm(along / (1.3 * R) + 7.31, 0.5, 3) * 0.26 * R)); }
      if (lake) { lx = W / 2 + lake[0] * lakeAt; ly = H / 2 + lake[1] * lakeAt; ex = ((x - lx) * -lake[1] + (y - ly) * lake[0]) / (0.9 * R); ey = ((x - lx) * lake[0] + (y - ly) * lake[1]) / (0.65 * R); e = Math.sqrt(ex * ex + ey * ey); v = Math.max(v, (1 - e) * 0.6 * R + NW.fbm(x / (0.9 * R) + 3.1, y / (0.9 * R) + 1.7, 3) * 0.14 * R); }
      return v;
    }
    var sea = new Float32Array(n), anySea = false;
    for (i = 0; i < n; i++) { sea[i] = seaF(g.px(i), g.py(i)); if (sea[i] > 0) anySea = true; }
    var water = { polys: [], ripples: [], pools: [], river: null, streams: [] };
    if (anySea) {
      G.polygonsFromField(sea, g, 0).forEach(function (poly) { if (Math.abs(G.signedArea(poly)) < dx * dx) return; var p = G.polishFramePolygon(poly, W, H, polish, 1); if (p) water.polys.push(roundPts(p)); });
      [14, 30].forEach(function (level, L) { var raw = G.contoursFromField(sea, g, level); raw.closed.concat(raw.open).forEach(function (ch, idx) { var closed = idx < raw.closed.length, p = polish(ch, closed); if (p && p.length > 2) water.ripples.push({ level: L, pts: roundPts(p), closed: closed }); }); });
    }
    function inSea(x, y, margin) { return anySea && g.sample(sea, x, y) > -(margin || 0); }

    /* the rivers: each a course [x, y] with its width in units. A zone of a region is handed the region's rivers cut
       to it (site.rivers: the points where they cross its edges, their widths there, the bends between): the course
       follows them, smoothed and wobbled — not at an end on an edge, where the next zone's river begins —, and stops
       at the water; one that ends here on dry land joins the river it runs into, or sinks into a pool. A zone that
       stands alone bends one river from edge to edge along its bearings. `nearRiver` answers for all of them: the
       river whose bank is nearest, its distance in riverD and its width in riverW. */
    var rivers = [], riverXY = null, rW = 0, poolMade = [], siteRivers = S.rivers || [];
    function wetAt(x, y) { return shore ? shoreState(shore, x, y).wet || "sea" : lake && !coast ? "lake" : "sea"; }
    siteRivers.forEach(function (rv, ri) {
      var sk = rv.pts.map(function (p) { return [p[0], p[1]]; });
      if (G.length(sk, false) < 2) return;   /* a river that only touches the zone's corner */
      var cl = G.resample(G.smooth(sk, 2, false), dx * 0.8, false), wb = G.wobble(cl, wob.noise2, dx * 0.5, 1 / (3 * dx), false), total = G.length(cl, false) || 1, acc = 0, pts = [], k, tap, w0 = rv.pts[0][2] / M_PER_UNIT, w1 = rv.pts[rv.pts.length - 1][2] / M_PER_UNIT;
      for (k = 0; k < cl.length; k++) {
        if (k) acc += G.dist(cl[k - 1], cl[k]);
        tap = Math.min(1, rv.from ? acc / 60 : 1, rv.to ? (total - acc) / 60 : 1);
        pts.push([cl[k][0] + (wb[k][0] - cl[k][0]) * tap, cl[k][1] + (wb[k][1] - cl[k][1]) * tap, (w0 + (w1 - w0) * acc / total) * (1 + tap * (0.3 * Math.abs(wob.noise2(k * 0.21, 3.3 + ri)) - 0.15))]);
      }
      pts[0] = [sk[0][0], sk[0][1], w0]; pts[pts.length - 1] = [sk[sk.length - 1][0], sk[sk.length - 1][1], w1];
      /* only its run on dry land is a river: what lies in the sea or a lake at either end is the water's */
      var lead = 0, cut = pts.length, from = rv.from || null, to = rv.to || null, endsIn = null;
      if (inSea(pts[0][0], pts[0][1])) { while (lead < pts.length - 1 && inSea(pts[lead + 1][0], pts[lead + 1][1])) lead++; from = null; }
      if (lead >= pts.length - 2) return;   /* all of it lies in the water */
      for (k = lead + 2; k < pts.length; k++) if (inSea(pts[k][0], pts[k][1])) { cut = k + 1; to = null; endsIn = wetAt(pts[k][0], pts[k][1]); break; }
      pts = pts.slice(lead, cut); if (pts.length < 3) return;
      var wMax = 0; pts.forEach(function (p) { if (p[2] > wMax) wMax = p[2]; });
      rivers.push({ xy: clampPts(pts, W, H), w: wMax, rec: { name: rv.name || null, from: from, to: to, id: rv.id, widthM: U.round((w0 + w1) / 2 * M_PER_UNIT, 1), endsIn: endsIn }, joins: !to && !endsIn && rv.ends === "river" });
    });
    /* an end on dry land: into the river it joins when that one runs within reach, else into a pool of its own */
    rivers.forEach(function (rv, ri) {
      if (rv.rec.to || rv.rec.endsIn) return;
      var end = rv.xy[rv.xy.length - 1], near = rv.joins ? nearestOn(end, rivers.filter(function (o) { return o !== rv; }).map(function (o) { return { pts: o.xy }; }), false) : null;
      if (near && near.d < 120) { rv.xy.push([near.at[0], near.at[1], end[2]]); rv.rec.endsIn = "river"; return; }
      var pid = "pool-" + (poolMade.length + 1), pr = Math.max(9, end[2] * 1.3);
      poolMade.push({ id: pid, kind: "pool", poly: roundPts(clampPts(blob([end[0], end[1]], pr, seed + "/" + pid, 0.8), W, H)), x: U.round(end[0], 1), y: U.round(end[1], 1), fed: "river-" + (ri + 1) });
      rv.rec.endsIn = "pool"; rv.rec.pool = pid;
    });
    if (!siteRivers.length && S.river) {
      var rl = acrossLine(W, H, S.river.from, S.river.to, rng, 0.14); rl = G.wobble(G.resample(rl, dx * 0.8, false), wob.noise2, dx * 0.5, 1 / (3 * dx), false); rW = S.river.width / M_PER_UNIT;
      var cut = rl.length; for (i = 2; i < rl.length; i++) if (inSea(rl[i][0], rl[i][1])) { cut = i + 1; break; }
      riverXY = clampPts(rl.slice(0, cut), W, H); riverXY[0] = snapEdge(riverXY[0], W, H); if (cut === rl.length) riverXY[riverXY.length - 1] = snapEdge(riverXY[riverXY.length - 1], W, H);
      water.river = { pts: roundPts(riverXY.map(function (p, idx) { return [p[0], p[1], rW * (0.85 + 0.3 * Math.abs(wob.noise2(idx * 0.21, 3.3)))]; })), name: S.river.name || null, from: S.river.from, to: S.river.to };
      rivers.push({ xy: riverXY, w: rW, rec: water.river });
    } else if (rivers.length) {
      rivers.forEach(function (rv, ri) { var rec = { pts: roundPts(rv.xy), name: rv.rec.name, from: rv.rec.from, to: rv.rec.to, id: rv.rec.id, widthM: rv.rec.widthM, endsIn: rv.rec.endsIn }; if (rv.rec.pool) rec.pool = rv.rec.pool; if (!ri) water.river = rec; else (water.branches = water.branches || []).push(rec); });
      riverXY = rivers[0].xy;
    }
    var riverD = Infinity, riverW = 0;
    function nearRiver(x, y) { var k, d, gap = Infinity, pt = [x, y]; riverD = Infinity; riverW = 0; for (k = 0; k < rivers.length; k++) { d = M.distToPolyline(pt, rivers[k].xy); if (d - rivers[k].w / 2 < gap) { gap = d - rivers[k].w / 2; riverD = d; riverW = rivers[k].w; } } return riverD; }
    function dRiver(x, y) { return nearRiver(x, y); }

    /* the ways a zone of a region is handed: the region's roads cut to it, their ends on its edges fixed (the track
       between them is the zone's own, found further down) */
    var ways = [], siteRoads = S.roads || [];
    siteRoads.forEach(function (rd) { ways.push({ kind: T.path || rd.kind, a: [rd.from.x, rd.from.y], b: [rd.to.x, rd.to.y], from: rd.from.edge || null, to: rd.to.edge || null, joinA: !!rd.from.join, joinB: !!rd.to.join, towards: { from: say(rd.from.towards), to: say(rd.to.towards) }, roadsA: rd.from.roads || null, roadsB: rd.to.roads || null, road: rd.id, fixed: true }); });
    /* the valley line: a pass follows the river, else the road, else a seeded way across */
    var RL = T.relief, valley = null;
    if (RL.valley) { valley = riverXY ? riverXY : S.road ? acrossLine(W, H, S.road.from, S.road.to, rng, 0.12) : ways.length && G.dist(ways[0].a, ways[0].b) > 60 ? bendLine(ways[0].a, ways[0].b, rng, 0.12) : acrossLine(W, H, rng.pick(["W", "N", "SW", "NW"]), rng.pick(["E", "S", "SE", "NE"]), rng, 0.12); }
    /* the relief: a fractal base, a ridged share for rock, a V valley carved whose floor is a saddle; the land falls to the shore */
    var relief = new Float32Array(n), x, y, h, d, t, floor, vl;
    if (valley) { vl = 0; for (i = 1; i < valley.length; i++) vl += G.dist(valley[i - 1], valley[i]); }
    for (i = 0; i < n; i++) {
      x = g.px(i); y = g.py(i);
      h = RL.amp * ((1 - RL.ridged) * (0.5 + 0.5 * NR.fbm(x / RL.scale + 11.3, y / RL.scale + 5.7, 4)) + RL.ridged * Math.min(1, 1.15 * NR.ridged(x / (RL.scale * 0.55) + 2.2, y / (RL.scale * 0.55) + 9.1, RL.ridgedOct || 4)));
      if (valley) {
        var bv = Infinity, bt = 0, acc = 0, j, dd;
        for (j = 1; j < valley.length; j++) { dd = G.pointSegDist([x, y], valley[j - 1], valley[j]); if (dd < bv) { bv = dd; var sx = valley[j][0] - valley[j - 1][0], sy = valley[j][1] - valley[j - 1][1], sl2 = sx * sx + sy * sy || 1; bt = (acc + U.clamp(((x - valley[j - 1][0]) * sx + (y - valley[j - 1][1]) * sy) / sl2, 0, 1) * Math.sqrt(sl2)) / (vl || 1); } acc += G.dist(valley[j - 1], valley[j]); }
        floor = 0.14 + 0.2 * Math.sin(Math.PI * U.clamp(bt, 0, 1)) * (riverXY ? 0.35 : 1);   /* a saddle; a river's valley is low all along */
        h = Math.min(h, floor + Math.pow(bv / RL.valley.width, 1.6) * 0.9);
      }
      if (riverXY) { d = nearRiver(x, y); if (d < riverW / 2 + 24) h -= 0.12 * RL.amp * (1 - (d - riverW / 2) / 24) * (d > riverW / 2 ? 1 : 1.2); }
      if (anySea) h -= 0.3 * RL.amp * U.clamp(1 - Math.max(0, -sea[i]) / 90, 0, 1);
      relief[i] = U.clamp(h, 0, 1);
    }
    /* slope as a tangent: the height of a full unit is the terrain's, in map units */
    var slope = new Float32Array(n);
    for (i = 0; i < n; i++) { var c = g.col(i), r = g.row(i), hx = (relief[g.idx(Math.min(cols - 1, c + 1), r)] - relief[g.idx(Math.max(0, c - 1), r)]) / (2 * dx), hy = (relief[g.idx(c, Math.min(rows - 1, r + 1))] - relief[g.idx(c, Math.max(0, r - 1))]) / (2 * g.dy); slope[i] = Math.sqrt(hx * hx + hy * hy) * RL.height; }
    var sortedS = Array.prototype.slice.call(slope).sort(function (a, b) { return a - b; });
    stats.slope = { q50: U.round(sortedS[Math.floor(n * 0.5)], 2), q80: U.round(sortedS[Math.floor(n * 0.8)], 2), q90: U.round(sortedS[Math.floor(n * 0.9)], 2), q97: U.round(sortedS[Math.floor(n * 0.97)], 2) };
    var sortedH = Array.prototype.slice.call(relief).sort(function (a, b) { return a - b; }), hLo = sortedH[0], hHi = sortedH[sortedH.length - 1], reliefN = new Float32Array(n);
    for (i = 0; i < n; i++) reliefN[i] = hHi > hLo ? (relief[i] - hLo) / (hHi - hLo) : 0;   /* the layers' thresholds are shares of the zone's own range: a desert's outcrops are its top ground, however low */
    function quant(v) { var lo = 0, hi = sortedH.length - 1, mid; while (lo < hi) { mid = (lo + hi) >> 1; if (sortedH[mid] < v) lo = mid + 1; else hi = mid; } return lo / (sortedH.length - 1); }

    /* the streams: a brook rises high and runs downhill node by node until the edge, the sea, the river, or a hollow it fills as a pool */
    var streams = [], heads = [];
    if (T.stream && (rng.chance(T.stream) || T.features.spring || T.features.fall)) {
      var cand = [];
      for (i = 0; i < n; i++) if (relief[i] >= sortedH[Math.floor(sortedH.length * 0.8)] && !g.onBorder(i) && sea[i] <= -20 && dRiver(g.px(i), g.py(i)) > 30 && g.px(i) > MARGIN && g.px(i) < W - MARGIN && g.py(i) > MARGIN && g.py(i) < H - MARGIN) cand.push(i);
      var want = 1 + (rng.chance(0.4) ? 1 : 0), tries = 0;
      while (streams.length < want && cand.length && tries++ < 12) {
        var head = cand[rng.int(cand.length)], cur = head, pts = [], visited = {}, steps = 0, end = null, endsIn = "sinks";
        if (heads.some(function (hh) { return G.dist([g.px(hh), g.py(hh)], [g.px(head), g.py(head)]) < 120; })) continue;
        while (steps++ < 600) {
          pts.push([g.px(cur) + (rng.float() - 0.5) * dx * 0.5, g.py(cur) + (rng.float() - 0.5) * dx * 0.5]); visited[cur] = true;
          if (g.onBorder(cur)) { endsIn = "edge"; break; }
          if (sea[cur] > -dx) { endsIn = "sea"; break; }
          if (riverXY && nearRiver(g.px(cur), g.py(cur)) < riverW / 2 + dx * 0.6) { endsIn = "river"; break; }
          var low = -1, lh = relief[cur]; g.neighbors8(cur, function (nb) { if (!visited[nb] && relief[nb] < lh) { lh = relief[nb]; low = nb; } });
          if (low < 0) { endsIn = "pool"; break; }
          cur = low;
        }
        if (pts.length < 6) continue;
        heads.push(head);
        var sm = G.wobble(G.smooth(pts, 2, false), wob.noise2, dx * 0.2, 1 / (2 * dx), false), L = sm.length, wpts = sm.map(function (p, idx) { return [p[0], p[1], 1.4 + 2.2 * idx / (L - 1)]; });
        wpts[0] = [pts[0][0], pts[0][1], 1.4];
        if (endsIn === "edge") { var lp = wpts[wpts.length - 1]; wpts[wpts.length - 1] = [U.clamp(Math.abs(lp[0] - 0) < dx ? 0 : Math.abs(lp[0] - W) < dx ? W : lp[0], 0, W), U.clamp(Math.abs(lp[1]) < dx ? 0 : Math.abs(lp[1] - H) < dx ? H : lp[1], 0, H), lp[2]]; }
        var sid = "stream-" + (streams.length + 1), poolId = null;
        if (endsIn === "pool") { poolId = "pool-" + (poolMade.length + 1); var pc = pts[pts.length - 1], pr = 9 + rng.float() * 6; poolMade.push({ id: poolId, kind: "pool", poly: roundPts(clampPts(blob(pc, pr, seed + "/" + poolId, 0.8), W, H)), x: U.round(pc[0], 1), y: U.round(pc[1], 1), fed: sid }); }
        streams.push({ id: sid, pts: roundPts(clampPts(wpts, W, H)), head: [U.round(pts[0][0], 1), U.round(pts[0][1], 1)], endsIn: endsIn, to: poolId });
      }
    }
    function dStream(x, y) { var best = Infinity; streams.forEach(function (s) { var d2 = M.distToPolyline([x, y], s.pts); if (d2 < best) best = d2; }); return best; }

    /* the tracks: each way is the cheapest run over the nodes from one of its ends to the other — up the valley floor,
       round the pools and the crags, across a river once —, then smoothed, simplified and wobbled; a marsh raises it
       as a causeway. A zone of a region has the region's roads (their ends fixed, see above): a later one runs along
       an earlier where that is cheap (×0.35, the region's own rule), and one that parts from another road is tied to
       the track already drawn (`join`). A zone that stands alone has its one road from edge to edge along its
       bearings, the ends dealt from the seed. Without a road there may be a trail: from edge to edge on a zone that
       stands alone, between two spots INSIDE on a zone of a region — an edge it reached would lead to nothing on the
       sheet beyond. */
    var paths = [], pathsXY = [], pathXY = null, netNode = new Uint8Array(n), anyNet = false;
    if (!siteRoads.length && (S.road || rng.chance(0.55))) {
      if (S.zone && !S.road) {
        var ta = null, tb = null, tries2 = 0, sp;
        while (tries2++ < 24 && !tb) { sp = [MARGIN + rng.float() * (W - 2 * MARGIN), MARGIN + rng.float() * (H - 2 * MARGIN)]; if (inSea(sp[0], sp[1], 12) || nearRiver(sp[0], sp[1]) < riverW / 2 + 10) continue; if (!ta) ta = sp; else if (G.dist(ta, sp) >= 0.38 * W) tb = sp; }
        if (tb) ways.push({ kind: "trail", a: ta, b: tb, from: null, to: null, towards: { from: null, to: null } });
      } else {
        var fromB = S.road ? S.road.from : rng.pick(BEARINGS), toB = S.road ? S.road.to : null, cand2 = BEARINGS.filter(function (b) { var i1 = BEARINGS.indexOf(b), i0 = BEARINGS.indexOf(fromB), dd = Math.abs(i1 - i0); return Math.min(dd, 8 - dd) >= 3; });
        if (!toB) toB = rng.pick(cand2);
        var a0 = edgePoint(W, H, fromB, (rng.float() - 0.5) * 1.2), b0 = edgePoint(W, H, toB, (rng.float() - 0.5) * 1.2);
        ways.push({ kind: S.road ? T.path || S.road.kind : "trail", a: a0, b: b0, from: fromB, to: toB, towards: S.road ? { from: S.road.fromName || null, to: S.road.toName || null } : { from: null, to: null }, across: true });
      }
    }
    var wetF = fieldOf(T.fields.wet, NW), coverF0 = fieldOf(T.fields.cover, NC);
    ways.forEach(function (w) {
      if (G.dist(w.a, w.b) < 1) return;   /* a road that only touches the zone's corner: its ends stand as the way on, nothing is drawn */
      var rev = !!(w.joinA && !w.joinB && anyNet), src = rev ? w.b : w.a, dst = rev ? w.a : w.b, joining = anyNet && !!(rev ? w.joinA : w.joinB);
      var from = g.nearest(src[0], src[1]), to = g.nearest(dst[0], dst[1]), end = -1;
      var dist = new Float32Array(n), came = new Int32Array(n), heap = U.Heap(function (p, q) { return p.d < q.d; }), done = new Uint8Array(n);
      for (i = 0; i < n; i++) { dist[i] = Infinity; came[i] = -1; }
      dist[from] = 0; heap.push({ i: from, d: 0 });
      while (heap.size()) {
        var cu = heap.pop(); if (done[cu.i]) continue; done[cu.i] = 1; if (cu.i === to || (joining && netNode[cu.i])) { end = cu.i; break; }
        g.neighbors8(cu.i, function (nb, len) {
          if (done[nb] || sea[nb] > -dx * 0.5) return;
          var px = g.px(nb), py = g.py(nb), cost = len * (1 + 7 * Math.pow(slope[nb], 1.5) + (wetF(px, py) > 0.45 ? 10 : 0) + (slope[nb] > 0.75 ? 6 : 0) + (coverF0(px, py) > 0.5 ? 1.2 : 0) + 0.35 * Math.abs(NC.fbm(px / 60 + 4.4, py / 60 + 8.8, 2)) + (g.onBorder(nb) && nb !== to ? 3 : 0));
          if (riverXY) { var dr = nearRiver(px, py); if (dr < riverW / 2 + dx) cost += 5 * (1 + riverW / 10); }
          if (anyNet && netNode[nb]) cost *= 0.35;
          var nd = dist[cu.i] + cost; if (nd < dist[nb]) { dist[nb] = nd; came[nb] = cu.i; heap.push({ i: nb, d: nd }); }
        });
      }
      if (end < 0) { warnings.push("the " + w.kind + " found no way across (water in the way)"); return; }
      var chain = [], kk = end; while (kk !== -1) { chain.unshift([g.px(kk), g.py(kk)]); netNode[kk] = 1; kk = came[kk]; }
      var line = G.simplify(G.smooth(chain, 2, false), dx * 0.3); line = G.wobble(G.resample(line, dx, false), wob.noise2, dx * 0.22, 1 / (3 * dx), false);
      var tail = joining && end !== to ? nearestOn(chain[chain.length - 1], pathsXY.map(function (p) { return { pts: p }; }), false).at : dst;
      if (w.fixed && line.length < 2) line = [src, tail];   /* an end that stands on the track it joins */
      line[0] = src; line[line.length - 1] = tail;
      if (rev) line.reverse();
      var xy = clampPts(line, W, H), crossings = [], k2;
      for (i = 1; i < xy.length; i++) for (k2 = 0; k2 < rivers.length; k2++) { var hit = M.crossPolyline(xy[i - 1], xy[i], rivers[k2].xy); if (hit) crossings.push({ x: U.round(hit.x, 1), y: U.round(hit.y, 1), kind: w.kind === "road" || w.kind === "causeway" ? "bridge" : rivers[k2].w > 10 ? "ford" : "plank" }); }
      w.path = { id: "path-" + (paths.length + 1), kind: w.kind, pts: roundPts(xy), from: w.from, to: w.to, towards: w.towards, crossings: crossings };
      if (w.road) w.path.road = w.road;
      paths.push(w.path); pathsXY.push(xy); anyNet = true;
    });
    pathXY = pathsXY[0] || null;   /* the main way: the pass is its high point */
    function dPath(x, y) { var best = Infinity, k, d2, pt = [x, y]; for (k = 0; k < pathsXY.length; k++) { d2 = M.distToPolyline(pt, pathsXY[k]); if (d2 < best) best = d2; } return best; }
    function dWater(x, y) { return Math.min(dRiver(x, y), dStream(x, y), anySea ? Math.max(0, -g.sample(sea, x, y)) : Infinity); }

    /* the fields the cover layers contour: cover (the vegetation), wet (the standing water), opened round the track and the water */
    function fieldOf(spec, noise) { return function (x, y) { return spec ? noise.fbm(x / spec.scale + 1.7, y / spec.scale + 4.3, 4) + spec.bias : -1; }; }
    var F = { relief: reliefN, slope: slope, sea: sea }, open = T.fields.cover.open || {};
    ["cover", "wet"].forEach(function (name) {
      var spec = T.fields[name], f = fieldOf(spec, name === "cover" ? NC : NW), arr = new Float32Array(n);
      for (i = 0; i < n; i++) {
        x = g.px(i); y = g.py(i); h = f(x, y);
        if (name === "cover") { if (open.path && pathXY) h -= 0.7 * Math.exp(-Math.pow(dPath(x, y) / open.path, 2)); if (open.water) { d = dWater(x, y); h -= 0.6 * Math.exp(-Math.pow(d / open.water, 2)); } }
        if (name === "wet" && riverXY) h -= 0.5 * Math.exp(-Math.pow(nearRiver(x, y) / 22, 2));
        if (sea[i] > -dx) h = -2;
        if (name === "wet" && pathXY && dPath(x, y) < 7) h = Math.min(h, 0.4);
        arr[i] = h;
      }
      F[name] = arr;
    });
    /* a layer's test at a point: its field between min and max, every `and` field in range */
    function passes(L, x, y) {
      var v = g.sample(F[L.field], x, y); if (v < L.min || (L.max !== undefined && v >= L.max)) return false;
      if (L.and) for (var key in L.and) if (Object.prototype.hasOwnProperty.call(L.and, key)) { var w = g.sample(F[key], x, y); if (w < L.and[key][0] || w > L.and[key][1]) return false; }
      return true;
    }
    function layerField(L) {
      var arr = new Float32Array(n), key;
      for (i = 0; i < n; i++) {
        arr[i] = F[L.field][i] - L.min;
        if (L.max !== undefined && F[L.field][i] >= L.max) arr[i] = -1;
        if (L.and) for (key in L.and) if (Object.prototype.hasOwnProperty.call(L.and, key) && (F[key][i] < L.and[key][0] || F[key][i] > L.and[key][1])) arr[i] = -1;
        if (sea[i] > -dx * 0.5) arr[i] = -1;
      }
      return arr;
    }
    /* a layer's polygons; the water layers first (the pools), since the points of interest stand clear of them, the
       others after the points of interest have opened the ground (a glade clears the wood round it) */
    var cover = [], nCover = 0;
    function layerPolys(L) {
      var arr = layerField(L), polys = [];
      G.polygonsFromField(arr, g, 0).forEach(function (poly) { if (Math.abs(G.signedArea(poly)) < 2.5 * dx * dx) return; var p = G.polishFramePolygon(poly, W, H, polish, 1); if (p && p.length >= 3) polys.push(roundPts(p)); });
      return polys;
    }
    T.cover.forEach(function (L) {
      if (!L.water) return;
      var polys = layerPolys(L), outer = [], j, k2, parent;
      polys.forEach(function (p, idx) { parent = -1; var pa = Infinity, c0 = G.centroid(p); for (k2 = 0; k2 < polys.length; k2++) { if (k2 === idx) continue; var a2 = Math.abs(G.signedArea(polys[k2])); if (a2 < pa && G.pointInPolygon(c0, polys[k2])) { pa = a2; parent = k2; } } outer.push(parent); });
      polys.forEach(function (p, idx) { if (outer[idx] >= 0) return; var c0 = G.centroid(p), holes = []; for (j = 0; j < polys.length; j++) if (outer[j] === idx) holes.push(polys[j]); water.pools.push({ id: "pool-" + (poolMade.length + water.pools.length + 1), kind: L.kind, poly: p, holes: holes, x: U.round(c0[0], 1), y: U.round(c0[1], 1), fed: null }); });
    });
    poolMade.forEach(function (p) { water.pools.push(p); });
    water.streams = streams;
    function inPool(x, y) { var j, p, k2, hole; for (j = 0; j < water.pools.length; j++) { p = water.pools[j]; if (!G.pointInPolygon([x, y], p.poly)) continue; hole = false; for (k2 = 0; k2 < (p.holes || []).length; k2++) if (G.pointInPolygon([x, y], p.holes[k2])) hole = true; if (!hole) return p; } return null; }
    function inLayer(kind, x, y) { var j; for (j = 0; j < T.cover.length; j++) if (T.cover[j].kind === kind && passes(T.cover[j], x, y)) return true; return false; }

    /* ── the points of interest ── reserved from the seed alone: every kind of the terrain gets MAX_COUNT anchors dealt
       round-robin over the best-scoring free candidates (so a count never moves another kind's feature), named in the
       same fixed order; the count takes the first n. The author's edits then add, move, rename, note and remove. */
    var cands = [], cstep = 20, saddle = null, fallAt = null, cx2, cy2;
    if (pathXY) { var hb = -1, pl = pathXY.length; pathXY.forEach(function (p, pi) { var hv = g.sample(relief, p[0], p[1]); if (hv > hb && pi > pl * 0.2 && pi < pl * 0.8) { hb = hv; saddle = p; } }); }   /* the pass is the track's high point in its middle three fifths, not where it climbs out at the edge */
    else if (valley) { var hb2 = -1; valley.forEach(function (p) { var hv = g.sample(relief, p[0], p[1]); if (hv > hb2 && p[0] > MARGIN && p[0] < W - MARGIN && p[1] > MARGIN && p[1] < H - MARGIN) { hb2 = hv; saddle = p; } }); }
    streams.forEach(function (s) { var bs = -1, j; for (j = 1; j < s.pts.length - 1; j++) { var sl = g.sample(slope, s.pts[j][0], s.pts[j][1]); if (sl > bs && s.pts[j][0] > MARGIN && s.pts[j][0] < W - MARGIN && s.pts[j][1] > MARGIN && s.pts[j][1] < H - MARGIN) { bs = sl; fallAt = { at: s.pts[j], stream: s.id, slope: sl }; } } });
    function contextAt(x, y) {
      var pool = inPool(x, y);
      return { x: x, y: y, relief: quant(g.sample(relief, x, y)), slope: g.sample(slope, x, y), cover: g.sample(F.cover, x, y), wet: g.sample(F.wet, x, y), water: !!pool || inSea(x, y, 6), wood: inLayer("wood", x, y) || inLayer("copse", x, y) || inLayer("thicket", x, y), rock: inLayer("rock", x, y), crag: inLayer("crag", x, y), dPath: dPath(x, y), dWater: dWater(x, y), poolAt: null, saddle: false, spring: false, fall: false };
    }
    for (cy2 = MARGIN + cstep / 2; cy2 < H - MARGIN; cy2 += cstep) for (cx2 = MARGIN + cstep / 2; cx2 < W - MARGIN; cx2 += cstep) { x = U.round(cx2 + (jit(seed + "/cand/" + cx2 + "," + cy2, 5) - 0.5) * cstep * 0.8, 1); y = U.round(cy2 + (jit(seed + "/cand/" + cx2 + "," + cy2, 6) - 0.5) * cstep * 0.8, 1); cands.push(contextAt(x, y)); }
    /* the special spots: the pools (a mere names one), the saddle (the pass), the springs (a stream's head), the fall */
    water.pools.slice().sort(function (p, q) { return Math.abs(G.signedArea(q.poly)) - Math.abs(G.signedArea(p.poly)); }).forEach(function (p) { var cc = contextAt(p.x, p.y); cc.poolAt = p; cc.water = false; cands.push(cc); });
    if (saddle) { var sc = contextAt(saddle[0], saddle[1]); sc.saddle = true; cands.push(sc); }
    streams.forEach(function (s) { var hc = contextAt(s.head[0], s.head[1]); hc.spring = true; hc.water = false; cands.push(hc); });
    if (fallAt) { var fc = contextAt(fallAt.at[0], fallAt.at[1]); fc.fall = true; fc.water = false; cands.push(fc); }
    var taken = [], features = [], reserved = {}, kinds = Object.keys(T.features), round, kind, K, fRng = NS.Rng(seed + "/features");
    function free(c, clear) { var j; if (c.x < MARGIN || c.x > W - MARGIN || c.y < MARGIN || c.y > H - MARGIN) return false; for (j = 0; j < taken.length; j++) if (G.dist([c.x, c.y], [taken[j].x, taken[j].y]) < Math.max(SPACING, clear + taken[j].clear + 6)) return false; return true; }
    function best(kind) {
      var K2 = CATALOGUE[kind], scorer = WHERE[K2.where], top = null, ts = -Infinity, j, s2;
      for (j = 0; j < cands.length; j++) { if (cands[j].used) continue; s2 = scorer(cands[j]); if (s2 === -Infinity) continue; s2 += 0.08 * jit(seed + "/score/" + kind + "/" + j, 9); if (!free(cands[j], K2.clear || 0)) continue; if (K2.makes && inSea(cands[j].x, cands[j].y, (K2.makes.pool || K2.makes.wood || 0) + 8)) continue; if (K2.where !== "path" && K2.where !== "spring" && K2.where !== "fall" && K2.where !== "pool" && K2.where !== "saddle" && cands[j].dPath < 10) continue; if (s2 > ts) { ts = s2; top = cands[j]; } }
      return top;
    }
    var FIRST = { pool: 1, saddle: 1, spring: 1, fall: 1 };
    kinds.sort(function (a, b) { return (FIRST[CATALOGUE[b].where] ? 1 : 0) - (FIRST[CATALOGUE[a].where] ? 1 : 0); });
    kinds.forEach(function (k2) { reserved[k2] = []; });
    for (round = 0; round < MAX_COUNT; round++) kinds.forEach(function (k2) {
      var c = best(k2), id = k2 + "-" + (round + 1), K2 = CATALOGUE[k2], name = namer.town("wild:" + k2, {}, K2.patterns);   /* the name is drawn whether or not a spot was found: the order never shifts */
      if (!c) return;
      c.used = true; taken.push({ x: c.x, y: c.y, clear: K2.clear || 0 });
      reserved[k2].push({ id: id, kind: k2, word: K2.word, icon: K2.icon, name: name, x: U.round(c.x, 1), y: U.round(c.y, 1), ctx: c });
    });
    var counts = {}; kinds.forEach(function (k2) { counts[k2] = P.features[k2] === undefined ? T.features[k2] : P.features[k2]; });
    Object.keys(P.features).forEach(function (k2) { if (counts[k2] === undefined) { counts[k2] = P.features[k2]; reserved[k2] = []; kinds.push(k2); } });   /* a kind the terrain does not deal: placed dynamically */
    var removed = {}, gone = {}, byId = {};
    P.edits.forEach(function (e) { if (e.op === "remove") removed[e.id] = true; });   /* a reserved feature an edit removes is never put down, so its spot is not held against another's */
    kinds.forEach(function (k2) {
      var want = counts[k2], got = 0, j;
      for (j = 0; j < reserved[k2].length && got < want; j++) { var f = reserved[k2][j]; if (removed[f.id]) { gone[f.id] = 1; got++; continue; } f.authored = false; features.push(f); byId[f.id] = f; got++; }
      for (; got < want; got++) { var c = best(k2); if (!c) { warnings.push("no spot for " + CATALOGUE[k2].word + " " + (got + 1) + " of " + want); continue; } c.used = true; taken.push({ x: c.x, y: c.y, clear: CATALOGUE[k2].clear || 0 }); var id = k2 + "-" + (reserved[k2].length + got + 1), ff = { id: id, kind: k2, word: CATALOGUE[k2].word, icon: CATALOGUE[k2].icon, name: namer.town("wild:" + k2, {}, CATALOGUE[k2].patterns), x: U.round(c.x, 1), y: U.round(c.y, 1), ctx: c, authored: false }; features.push(ff); byId[id] = ff; }
    });
    /* the author's say */
    P.edits.forEach(function (e) {
      var f = byId[e.id], at;
      if (e.op === "add") {
        if (byId[e.id]) { warnings.push("add " + e.id + ": that id is already on the map"); return; }
        at = [U.clamp(e.at[0], 2, W - 2), U.clamp(e.at[1], 2, H - 2)];
        if (inSea(at[0], at[1])) { warnings.push("add " + e.id + ": the point is in the water"); return; }
        K = CATALOGUE[e.kind]; f = { id: e.id, kind: e.kind, word: e.kind === "custom" ? e.word : K.word, icon: e.icon !== undefined ? e.icon : K.icon, name: e.name || namer.town("wild:" + e.kind, {}, K.patterns), x: U.round(at[0], 1), y: U.round(at[1], 1), ctx: contextAt(at[0], at[1]), authored: true };
        if (e.kind === "custom") f.custom = true;
        features.push(f); byId[f.id] = f; taken.push({ x: f.x, y: f.y, clear: K.clear || 0 }); return;
      }
      /* what a removal took off is `gone` (1 until its own edit is passed, 2 after): the edit that did it is silent;
         every other edit to that id — a second removal, a rename — and every edit to an id that never was says so */
      if (!f) { if (e.op === "remove" && gone[e.id] === 1) { gone[e.id] = 2; return; } warnings.push(e.op + " " + e.id + ": no feature with that id" + (gone[e.id] === 2 ? " (removed above)" : gone[e.id] === 1 ? " (an edit further down removes it)" : "")); return; }
      if (e.op === "remove") { features.splice(features.indexOf(f), 1); delete byId[e.id]; gone[e.id] = 2; return; }
      if (e.op === "rename") { f.name = e.name.trim(); f.renamed = true; return; }
      if (e.op === "note") { if (e.note) f.note = e.note; else delete f.note; return; }
      if (e.op === "move") { at = [U.clamp(e.at[0], 2, W - 2), U.clamp(e.at[1], 2, H - 2)]; if (inSea(at[0], at[1])) { warnings.push("move " + e.id + ": the point is in the water"); return; } f.x = U.round(at[0], 1); f.y = U.round(at[1], 1); f.ctx = contextAt(at[0], at[1]); f.authored = true; }
    });
    /* what a feature MAKES in the ground: a pool (a tarn, a pond, an oasis), a copse; a clearing opens the cover round it */
    features.forEach(function (f) {
      var K2 = CATALOGUE[f.kind] || CATALOGUE.custom, mk = K2.makes, j, d2;
      if (f.ctx && f.ctx.poolAt) f.pool = f.ctx.poolAt.id;
      if (K2.clear >= 16) for (j = 0; j < n; j++) { d2 = G.dist([g.px(j), g.py(j)], [f.x, f.y]); if (d2 < K2.clear * 1.6) F.cover[j] -= 1.4 * Math.exp(-Math.pow(d2 / (K2.clear * 0.8), 2)); }
      if (!mk) return;
      if (mk.pool) { var pid = "pool-" + (water.pools.length + 1), pl = roundPts(clampPts(blob([f.x, f.y], mk.pool, seed + "/" + f.id, 0.75), W, H)); water.pools.push({ id: pid, kind: f.kind, poly: pl, x: f.x, y: f.y, fed: null }); f.pool = pid; }
      if (mk.wood) { nCover++; cover.push({ id: "cover-" + nCover, kind: "wood", poly: roundPts(clampPts(blob([f.x, f.y], mk.wood, seed + "/" + f.id, 0.85), W, H)), of: f.id }); }
    });
    features.forEach(function (f) { delete f.ctx; });
    T.cover.forEach(function (L) { if (!L.water && L.draw) layerPolys(L).forEach(function (p) { nCover++; cover.push({ id: "cover-" + nCover, kind: L.kind, poly: p, draw: L.draw, hatch: !!L.hatch }); }); });   /* a glyph-only layer (reeds, scree, dunes) stands as its stamps */

    /* ── the glyph stamps ── jittered grids per layer, kept where the layer's test passes and nothing else stands:
       not in the water, not on the track, not in a feature's clearing; a copse made by a feature gets its trees too */
    var glyphs = [], gRng = NS.Rng(seed + "/glyphs"), wind = rng.float() * Math.PI;
    function clearOf(x, y) { var j, f, K2; for (j = 0; j < features.length; j++) { f = features[j]; K2 = CATALOGUE[f.kind] || CATALOGUE.custom; if (G.dist([x, y], [f.x, f.y]) < (K2.clear || 0) + (K2.makes && K2.makes.pool ? K2.makes.pool + 3 : 0)) return true; } return false; }
    T.cover.forEach(function (L) {
      if (!L.glyph) return;
      var step = L.step, jx, jy;
      for (y = step / 2; y < H; y += step) for (x = step / 2; x < W; x += step) {
        jx = x + (gRng.float() - 0.5) * step * 0.85; jy = y + (gRng.float() - 0.5) * step * 0.85;
        var sz = L.size[0] + gRng.float() * (L.size[1] - L.size[0]);
        jx = U.round(jx, 1); jy = U.round(jy, 1);   /* tested at the coordinates the document carries */
        if (jx < 4 || jy < 4 || jx > W - 4 || jy > H - 4 || !passes(L, jx, jy) || inSea(jx, jy, 9) || inPool(jx, jy) || dPath(jx, jy) < 4.5 || nearRiver(jx, jy) < riverW / 2 + 2.5 || dStream(jx, jy) < 3 || clearOf(jx, jy)) continue;
        var gl = { k: L.glyph, x: U.round(jx, 1), y: U.round(jy, 1), s: U.round(sz, 2) }; if (L.wind) gl.a = U.round(wind + (gRng.float() - 0.5) * 0.5, 2);
        glyphs.push(gl);
      }
    });
    features.forEach(function (f) {
      var K2 = CATALOGUE[f.kind] || CATALOGUE.custom, mk = K2.makes, j, a, rr;
      if (mk && mk.trees) for (j = 0; j < mk.trees; j++) { a = Math.PI * 2 * j / mk.trees + gRng.float() * 0.5; rr = (mk.pool || 10) + 4 + gRng.float() * 6; glyphs.push({ k: "palm", x: U.round(f.x + Math.cos(a) * rr, 1), y: U.round(f.y + Math.sin(a) * rr * 0.8, 1), s: U.round(0.9 + gRng.float() * 0.4, 2) }); }
      if (mk && mk.wood) for (y = f.y - mk.wood; y < f.y + mk.wood; y += 9) for (x = f.x - mk.wood; x < f.x + mk.wood; x += 9) { var jx2 = x + (gRng.float() - 0.5) * 7, jy2 = y + (gRng.float() - 0.5) * 7; jx2 = U.round(jx2, 1); jy2 = U.round(jy2, 1); if (G.dist([jx2, jy2], [f.x, f.y]) < mk.wood * 0.82 && !inPool(jx2, jy2) && !inSea(jx2, jy2, 9) && dPath(jx2, jy2) > 4.5 && nearRiver(jx2, jy2) > riverW / 2 + 2.5 && dStream(jx2, jy2) > 3) glyphs.push({ k: "tree", x: U.round(jx2, 1), y: U.round(jy2, 1), s: U.round(0.7 + gRng.float() * 0.35, 2) }); }
    });

    /* the form lines: the relief contoured at even steps between its lowest and highest, every line polished */
    var contours = [];
    if (T.contours) {
      var lo = sortedH[Math.floor(sortedH.length * 0.03)], hi = sortedH[Math.floor(sortedH.length * 0.985)], L2;
      for (L2 = 0; L2 < T.contours; L2++) {
        var level = lo + (hi - lo) * (L2 + 0.5) / T.contours, raw = G.contoursFromField(relief, g, level);
        raw.closed.forEach(function (ch) { var p = polish(ch, true); if (p && p.length > 4 && G.length(p, true) > 4 * dx) contours.push({ level: U.round(level, 3), pts: roundPts(p), closed: true }); });
        raw.open.forEach(function (ch) { var p = polish(ch, false); if (p && p.length > 2 && G.length(p, false) > 3 * dx) { p[0] = ch[0]; p[p.length - 1] = ch[ch.length - 1]; contours.push({ level: U.round(level, 3), pts: roundPts(p), closed: false }); } });
      }
    }

    /* the title: the author's, else a local name of the terrain's shape, filled from the culture */
    var title = P.title || namer.town("wild:" + P.terrain, {}, T.names);
    /* the portals: the way on at every edge (where the track leaves, else the edge's middle) to the zone beyond, a
       cave mouth that lies here into the caves behind it, a settlement that lies here into its town */
    var portals = [], zone = S.zone;
    function neighbour(dc, dr) { return zone && zone.cols !== undefined ? (zone.col + dc >= 0 && zone.row + dr >= 0 && zone.col + dc < zone.cols && zone.row + dr < zone.rows ? "z" + (zone.col + dc) + "_" + (zone.row + dr) : null) : null; }
    /* a way's ends on the edges: a region's road has them fixed (whether or not the track found its way to them), a
       zone's own road from edge to edge has them where its track came out */
    ways.forEach(function (w) {
      w.ends = [];
      if (w.fixed) { if (w.from) w.ends.push({ edge: w.from, at: w.a, towards: w.towards.from, roads: w.roadsA }); if (w.to) w.ends.push({ edge: w.to, at: w.b, towards: w.towards.to, roads: w.roadsB }); }
      else if (w.across && w.path) { var pa = w.path.pts[0], pb = w.path.pts[w.path.pts.length - 1]; w.ends.push({ edge: edgeOf(pa, W, H), at: pa, towards: w.towards.from, roads: null }); w.ends.push({ edge: edgeOf(pb, W, H), at: pb, towards: w.towards.to, roads: null }); }
    });
    [["N", W / 2, 0, 0, -1], ["E", W, H / 2, 1, 0], ["S", W / 2, H, 0, 1], ["W", 0, H / 2, -1, 0]].forEach(function (E) {
      var at = [E[1], E[2]], way = null, end = null, k, j;
      for (k = 0; k < ways.length && !end; k++) for (j = 0; j < ways[k].ends.length && !end; j++) if (ways[k].ends[j].edge === E[0]) { way = ways[k]; end = ways[k].ends[j]; }
      if (end) at = [end.at[0], end.at[1]];
      var portal = { id: "edge-" + E[0], kind: "edge", name: ({ N: "north", E: "east", S: "south", W: "west" })[E[0]] + (end ? " by the " + way.kind : ""), x: U.round(at[0], 1), y: U.round(at[1], 1), bearing: E[0], way: "on", via: end && way.path ? way.path.id : null, towards: end ? end.towards : null, to: { generator: "wild", id: neighbour(E[3], E[4]) } };
      if (end && end.roads) portal.roads = end.roads;
      portals.push(portal);
    });
    S.caves.forEach(function (cv) { portals.push({ id: cv.id, kind: "cave", name: cv.name, x: cv.x, y: cv.y, way: "down", to: { generator: "dungeon", site: "cave", id: cv.id } }); });
    if (S.place) portals.push({ id: S.place.id, kind: "place", name: S.place.name, x: S.place.x, y: S.place.y, way: "in", to: { generator: "town", id: null } });
    stats.ms = U.round(NS.terrain.now() - t0, 1);
    var doc = {
      format: NS.DOC_FORMAT, ver: NS.DOC_VER, generator: { name: "wild", version: NS.VERSION },
      seed: seed, params: P,
      frame: { width: W, height: H, mPerUnit: M_PER_UNIT, kmPerUnit: M_PER_UNIT / 1000 },
      title: { name: title, kind: P.terrain },
      site: S, kind: P.terrain, word: T.word,
      relief: { contours: contours, low: U.round(sortedH[0], 3), high: U.round(sortedH[sortedH.length - 1], 3), height: RL.height },
      cover: cover, water: water, paths: paths, features: features, glyphs: glyphs, portals: portals,
      warnings: warnings,
      stats: U.extend({ coverCount: cover.length, glyphCount: glyphs.length, featureCount: features.length, streamCount: streams.length, poolCount: water.pools.length }, stats)
    };
    return doc;
  }

  /* ── for the digest, the cards and the pins ── */
  /* the point bearings and distances are reckoned from: the settlement that lies in the zone, else the crossing of the
     track and the river, else the track's middle, else the middle of the zone */
  function reference(doc) {
    var p = doc.paths[0], pl = doc.site.place;
    if (pl) return { x: pl.x, y: pl.y, word: pl.name, at: "at " + pl.name };
    if (p && p.crossings.length) return { x: p.crossings[0].x, y: p.crossings[0].y, word: "the " + p.crossings[0].kind, at: "at the " + p.crossings[0].kind };
    if (p) { var m = p.pts[Math.floor(p.pts.length / 2)]; return { x: m[0], y: m[1], word: "the middle of the " + p.kind, at: "on the " + p.kind }; }
    return { x: doc.frame.width / 2, y: doc.frame.height / 2, word: "the middle of the zone", at: "in the middle" };
  }
  function caption(doc) { var T = TERRAINS[doc.kind], S = doc.site; return T.a + (S.within ? " · " + S.within : "") + (S.regionName ? " · " + S.regionName : ""); }
  function intro(doc) { var T = TERRAINS[doc.kind], S = doc.site, km = doc.frame.width * doc.frame.kmPerUnit; return doc.title.name + " is " + T.a + (S.within ? " in " + S.within : "") + (S.regionName ? ", a zone of " + S.regionName : "") + ", " + Math.round(km * 1000) + " m by " + Math.round(doc.frame.height * doc.frame.kmPerUnit * 1000) + " m" + (S.near ? (S.near.km < 0.7 ? ", at " + S.near.name : ", " + NS.digest.fmtKm(S.near.km) + " " + S.near.bearing + " of " + S.near.name) : "") + "."; }
  /* the id of the thing under a point: a feature within its clearing, a pool, a path's band, a cover polygon; null on open ground */
  function locate(doc, pt) {
    var i, f, K;
    for (i = 0; i < doc.features.length; i++) { f = doc.features[i]; K = CATALOGUE[f.kind] || CATALOGUE.custom; if (G.dist(pt, [f.x, f.y]) <= Math.max(8, K.clear || 0)) return f.id; }
    for (i = 0; i < doc.water.pools.length; i++) if (G.pointInPolygon(pt, doc.water.pools[i].poly)) return doc.water.pools[i].id;
    for (i = 0; i < doc.paths.length; i++) if (M.distToPolyline(pt, doc.paths[i].pts) <= 4) return doc.paths[i].id;
    for (i = 0; i < doc.cover.length; i++) if (G.pointInPolygon(pt, doc.cover[i].poly)) return doc.cover[i].id;
    return null;
  }
  function kinds() { return Object.keys(CATALOGUE).filter(function (k) { return k !== "custom"; }); }

  /* ── the region → zone contract ── the region is tiled into zones the size of the sheet (ZONE_KM); zoneAt gives the
     zone a point lies in, fromRegion reads the ground there: the biome (the terrain), the height and slope, the coast,
     a lake, a river or a road that crosses the zone with the bearings it enters and leaves by, the cave mouths and the
     settlement that fall inside it, the named feature it lies in, the nearest place for the GM. */
  function zoneAt(regionDoc, at) {
    NS.assert(regionDoc && regionDoc.format === NS.DOC_FORMAT && regionDoc.generator && regionDoc.generator.name === "region", "needs a region document", { generator: regionDoc && regionDoc.generator });
    var kpu = regionDoc.frame.kmPerUnit, cw = ZONE_KM.w / kpu, ch = ZONE_KM.h / kpu, cols = Math.ceil(regionDoc.frame.width / cw), rows = Math.ceil(regionDoc.frame.height / ch), col, row, m;
    if (typeof at === "string") { m = /^z(\d+)_(\d+)$/.exec(at); NS.assert(m, "a zone id looks like z12_7", { id: at }); col = Number(m[1]); row = Number(m[2]); NS.assert(col < cols && row < rows, "that zone lies outside the region", { id: at, cols: cols, rows: rows }); }
    else { NS.assert(Array.isArray(at) && at.length === 2 && U.isNum(at[0]) && U.isNum(at[1]), "zoneAt needs [x, y] on the region, or a zone id", { at: at }); NS.assert(at[0] >= 0 && at[1] >= 0 && at[0] <= regionDoc.frame.width && at[1] <= regionDoc.frame.height, "that point lies outside the region's frame", { at: at, frame: regionDoc.frame }); col = Math.min(cols - 1, Math.floor(at[0] / cw)); row = Math.min(rows - 1, Math.floor(at[1] / ch)); }
    return { id: "z" + col + "_" + row, col: col, row: row, cols: cols, rows: rows, x0: col * cw, y0: row * ch, x1: (col + 1) * cw, y1: (row + 1) * ch, cx: (col + 0.5) * cw, cy: (row + 0.5) * ch };
  }
  function nearestOn(pt, polylines, skipFrame, W, H) {
    var best = null, bd = Infinity, i, j, pts, a, b, d;
    for (i = 0; i < polylines.length; i++) {
      pts = polylines[i].pts; for (j = 1; j < (polylines[i].closed ? pts.length + 1 : pts.length); j++) {
        a = pts[j - 1]; b = pts[j % pts.length];
        if (skipFrame && ((Math.abs(a[0]) < 1e-6 && Math.abs(b[0]) < 1e-6) || (Math.abs(a[1]) < 1e-6 && Math.abs(b[1]) < 1e-6) || (Math.abs(a[0] - W) < 1e-6 && Math.abs(b[0] - W) < 1e-6) || (Math.abs(a[1] - H) < 1e-6 && Math.abs(b[1] - H) < 1e-6))) continue;
        d = G.pointSegDist(pt, a, b); if (d < bd) { bd = d; var dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy, t = l2 ? U.clamp(((pt[0] - a[0]) * dx + (pt[1] - a[1]) * dy) / l2, 0, 1) : 0; best = { line: polylines[i], i: j, d: d, at: [a[0] + dx * t, a[1] + dy * t], dir: [dx, dy], w: a[2] }; }
      }
    }
    return best;
  }
  /* the state of a point of the region by its drawn geometry: in the sea (outside the coast, even-odd), in a lake, or null on land */
  function waterAt(regionDoc, p) {
    var inside = 0, i;
    if (regionDoc.sea.present) { for (i = 0; i < regionDoc.coast.length; i++) if (G.pointInPolygon(p, regionDoc.coast[i])) inside++; if (inside % 2 === 0) return "sea"; }
    for (i = 0; i < regionDoc.lakes.length; i++) if (G.pointInPolygon(p, regionDoc.lakes[i])) return "lake";
    return null;
  }
  /* the runs of a closed outline whose segments come within a box */
  function ringRuns(ring, x0, y0, x1, y1) {
    var runs = [], cur = null, n = ring.length, i, a, b;
    for (i = 0; i < n; i++) {
      a = ring[i]; b = ring[(i + 1) % n];
      if (Math.max(a[0], b[0]) < x0 || Math.min(a[0], b[0]) > x1 || Math.max(a[1], b[1]) < y0 || Math.min(a[1], b[1]) > y1) { cur = null; continue; }
      if (!cur) { cur = [a]; runs.push(cur); }
      cur.push(b);
    }
    return runs;
  }
  /* the stretches of a polyline that lie in the zone (col, row) of a tiling of cw × ch. OWNERSHIP decides, never a
     comparison of two computed crossings: a vertex belongs to the zone its coordinates floor to, and a segment changes
     zone once for every grid line between the zones of its ends, at the point where it meets that line — worked out by
     the same arithmetic whichever zone asks, so one zone's way out IS the next one's way in. Each piece: pts (the
     polyline's own coordinates, every further value of a point interpolated — a river's width), from and to = the edge
     it comes in and goes out by (null where it begins or ends inside). */
  function zonePieces(pts, col, row, cw, ch) {
    var pieces = [], cur = null, i, a, b, c, r, c1, r1, k, st, V, Hh, cuts, iv, ih, j, cut, q, bound;
    function at(a, b, t) { var o = [], m; for (m = 0; m < a.length; m++) o.push(a[m] + (b[m] - a[m]) * t); return o; }
    function take(q, entry) { if (!cur) { cur = { pts: [], from: entry, to: null }; pieces.push(cur); } cur.pts.push(q); }
    if (!pts.length) return pieces;
    c = Math.floor(pts[0][0] / cw); r = Math.floor(pts[0][1] / ch);
    if (c === col && r === row) take(pts[0], null);
    for (i = 1; i < pts.length; i++) {
      a = pts[i - 1]; b = pts[i]; c1 = Math.floor(b[0] / cw); r1 = Math.floor(b[1] / ch); V = []; Hh = []; cuts = []; iv = 0; ih = 0;
      st = c1 > c ? 1 : -1; for (k = c; k !== c1; k += st) { bound = (st > 0 ? k + 1 : k) * cw; V.push({ t: U.clamp((bound - a[0]) / (b[0] - a[0]), 0, 1), dc: st, dr: 0, v: bound }); }
      st = r1 > r ? 1 : -1; for (k = r; k !== r1; k += st) { bound = (st > 0 ? k + 1 : k) * ch; Hh.push({ t: U.clamp((bound - a[1]) / (b[1] - a[1]), 0, 1), dc: 0, dr: st, v: bound }); }
      while (iv < V.length || ih < Hh.length) cuts.push(ih >= Hh.length || (iv < V.length && V[iv].t <= Hh[ih].t) ? V[iv++] : Hh[ih++]);
      for (j = 0; j < cuts.length; j++) {
        cut = cuts[j]; q = at(a, b, cut.t); if (cut.dc) q[0] = cut.v; else q[1] = cut.v;
        if (c === col && r === row) { take(q, null); cur.to = cut.dc > 0 ? "E" : cut.dc < 0 ? "W" : cut.dr > 0 ? "S" : "N"; cur = null; }
        c += cut.dc; r += cut.dr;
        if (c === col && r === row) take(q, cut.dc > 0 ? "W" : cut.dc < 0 ? "E" : cut.dr > 0 ? "N" : "S");
      }
      if (c === col && r === row) take(b, null);
    }
    return pieces;
  }
  /* the nearest point of an earlier road (one before index j) within cap of p: {d, at, road}, or null */
  function nearEarlier(roads, j, p, cap) {
    var best = null, bd = cap, e, pts, i, a, b, d, dx, dy, l2, t, ex, ey;
    for (e = 0; e < j; e++) {
      pts = roads[e].pts;
      for (i = 1; i < pts.length; i++) {
        a = pts[i - 1]; b = pts[i];
        if (p[0] < Math.min(a[0], b[0]) - bd || p[0] > Math.max(a[0], b[0]) + bd || p[1] < Math.min(a[1], b[1]) - bd || p[1] > Math.max(a[1], b[1]) + bd) continue;
        dx = b[0] - a[0]; dy = b[1] - a[1]; l2 = dx * dx + dy * dy; t = l2 ? U.clamp(((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2, 0, 1) : 0;
        ex = p[0] - a[0] - dx * t; ey = p[1] - a[1] - dy * t; d = Math.sqrt(ex * ex + ey * ey);
        if (d < bd) { bd = d; best = { d: d, at: [a[0] + dx * t, a[1] + dy * t], road: e }; }
      }
    }
    return best;
  }
  /* a region's road as a zone reads it. The region lays a later road along an earlier one where that is cheap, but
     smooths each on its own: the two lines of one stretch lie up to a unit apart — hundreds of metres on a zone's
     sheet, one road drawn twice. So where road j runs within ROAD_TOL of an earlier road, the earlier one STANDS FOR
     both and j is not drawn; where j parts from it, it is drawn back to where the two lines lie closest and tied to
     the earlier line there. Decided on the road's own sub-points (every segment cut into steps from its own start)
     against the earlier roads' lines, never against a zone: every zone that asks gets the same answer.
     → { subs, n, near(q): the distance to the nearest earlier road within ROAD_TOL (Infinity beyond), from(q): that
     point {d, at, road}, drawn(q), span(p): the step of the road nearest p } */
  function roadModel(roads, j) {
    var pts = roads[j].pts, subs = [], i, a, b, k, s;
    for (i = 1; i < pts.length; i++) { a = pts[i - 1]; b = pts[i]; k = Math.max(1, Math.ceil(G.dist(a, b) / ROAD_SUB)); for (s = 0; s < k; s++) subs.push([a[0] + (b[0] - a[0]) * s / k, a[1] + (b[1] - a[1]) * s / k]); }
    subs.push([pts[pts.length - 1][0], pts[pts.length - 1][1]]);
    var n = subs.length, dMemo = new Array(n), nMemo = new Array(n), sMemo = new Array(n);
    function near(q) { if (dMemo[q] === undefined) { nMemo[q] = j ? nearEarlier(roads, j, subs[q], ROAD_TOL) : null; dMemo[q] = nMemo[q] ? nMemo[q].d : Infinity; } return dMemo[q]; }
    /* does the road draw away from the earlier one from q on, that way: ever further, until it is clear of it? */
    function parts(q, step) { var m = q, dm = near(q), dn; while (m + step >= 0 && m + step < n) { dn = near(m + step); if (!(dn > dm)) return false; if (dn === Infinity) return true; m += step; dm = dn; } return false; }
    function drawn(q) { if (sMemo[q] === undefined) sMemo[q] = near(q) === Infinity || parts(q, 1) || parts(q, -1); return sMemo[q]; }
    /* the step [q, q + 1] of the road nearest a point, and whether the point lies off the road's very end */
    function span(p) {
      var best = 0, bd = Infinity, bt = 0, q, dx, dy, l2, t, ex, ey, d;
      for (q = 0; q + 1 < n; q++) { dx = subs[q + 1][0] - subs[q][0]; dy = subs[q + 1][1] - subs[q][1]; l2 = dx * dx + dy * dy; t = l2 ? U.clamp(((p[0] - subs[q][0]) * dx + (p[1] - subs[q][1]) * dy) / l2, 0, 1) : 0; ex = p[0] - subs[q][0] - dx * t; ey = p[1] - subs[q][1] - dy * t; d = ex * ex + ey * ey; if (d < bd) { bd = d; best = q; bt = t; } }
      return { q: best, end: (best === 0 && bt <= 0) || (best === n - 2 && bt >= 1) };
    }
    return { subs: subs, n: n, near: near, from: function (q) { near(q); return nMemo[q]; }, drawn: drawn, span: span };
  }
  /* does a polyline come within a box? */
  function passes(pts, x0, y0, x1, y1) { var i, a, b; for (i = 1; i < pts.length; i++) { a = pts[i - 1]; b = pts[i]; if (!(Math.max(a[0], b[0]) < x0 || Math.min(a[0], b[0]) > x1 || Math.max(a[1], b[1]) < y0 || Math.min(a[1], b[1]) > y1)) return true; } return false; }
  /* the stretches of a road that are drawn near a box: each {pts, joinA, joinB} — a run that begins or ends where the
     road meets the earlier one it parts from is tied to that road's line (the point on it comes first or last) */
  function roadRuns(model, x0, y0, x1, y1) {
    var subs = model.subs, n = model.n, runs = [], cur = null, q;
    function inBox(p) { return p[0] >= x0 && p[0] <= x1 && p[1] >= y0 && p[1] <= y1; }
    function tie(q) { var d = model.near(q); if (d > ROAD_TOUCH && d !== Infinity) cur.pts.push(model.from(q).at); }
    for (q = 0; q < n; q++) {
      if (!(inBox(subs[q]) || (q > 0 && inBox(subs[q - 1])) || (q + 1 < n && inBox(subs[q + 1]))) || !model.drawn(q)) { cur = null; continue; }
      if (!cur) { cur = { pts: [], joinA: false, joinB: false }; runs.push(cur); if (q > 0 && !model.drawn(q - 1)) { cur.joinA = true; tie(q); } }
      cur.pts.push(subs[q]);
      if (q + 1 < n && !model.drawn(q + 1)) { cur.joinB = true; tie(q); cur = null; }
    }
    return runs;
  }
  function fromRegion(regionDoc, at) {
    var Z = zoneAt(regionDoc, at), fr = regionDoc.frame, kpu = fr.kmPerUnit, W = DEFAULTS.width, H = DEFAULTS.height, cw = ZONE_KM.w / kpu, ch = ZONE_KM.h / kpu, sx = W / (Z.x1 - Z.x0), sy = H / (Z.y1 - Z.y0), i, j;
    NS.assert(regionDoc.fields && regionDoc.fields.height && regionDoc.fields.biome, "the region carries no fields (params.fields is false): the wild needs the height and biome bytes", { fields: !!regionDoc.fields });
    function r1(v) { return U.round(v, 1); }
    function toZ(p) { return [r1((p[0] - Z.x0) * sx), r1((p[1] - Z.y0) * sy)]; }
    function toR(x, y) { return [Z.x0 + x / sx, Z.y0 + y / sy]; }
    /* a point is judged as the point it is */
    if (typeof at !== "string") { var ws = waterAt(regionDoc, at); NS.assert(ws !== "sea", "that point lies in the sea; a zone is open country", { at: at, zone: Z.id }); NS.assert(ws !== "lake", "that point lies in a lake; a zone is open country", { at: at, zone: Z.id }); }
    /* the shore: every coast and lake outline that comes within reach of the zone, in the sheet's coordinates, and a point of known state to count the crossings from */
    var lines = [], rx = SHORE_REACH / sx, ry = SHORE_REACH / sy;
    function outline(ring, kind) { ringRuns(ring, Z.x0 - rx, Z.y0 - ry, Z.x1 + rx, Z.y1 + ry).forEach(function (run) { var pts = [], k, p; for (k = 0; k < run.length; k++) { p = toZ(run[k]); if (!pts.length || pts[pts.length - 1][0] !== p[0] || pts[pts.length - 1][1] !== p[1]) pts.push(p); } if (pts.length >= 2) lines.push({ kind: kind, pts: pts }); }); }
    if (regionDoc.sea.present) regionDoc.coast.forEach(function (ring) { outline(ring, "sea"); });
    regionDoc.lakes.forEach(function (ring) { outline(ring, "lake"); });
    function clear(p) { var d = Infinity, k, m; for (k = 0; k < lines.length; k++) for (m = 1; m < lines[k].pts.length; m++) d = Math.min(d, G.pointSegDist(p, lines[k].pts[m - 1], lines[k].pts[m])); return d; }
    var refs = [[0.5, 0.5], [0.25, 0.25], [0.75, 0.75], [0.75, 0.25], [0.25, 0.75], [0.5, 0.25], [0.5, 0.75], [0.25, 0.5], [0.75, 0.5]].map(function (q) { return [W * q[0], H * q[1]]; }), ref = null, rd = -1;
    for (i = 0; i < refs.length && rd <= 6; i++) { var cd = clear(refs[i]); if (cd > rd) { rd = cd; ref = refs[i]; } }
    var shore = { ref: ref, at: waterAt(regionDoc, toR(ref[0], ref[1])), lines: lines };
    /* the zone is judged by the land it holds: a lattice of its own ground, the middle first */
    var land = 0, lsum = [0, 0], wet = { sea: 0, lake: 0 }, wsum = { sea: [0, 0], lake: [0, 0] }, ground = null, gd = Infinity, lx, ly, st, d, p, total = LATTICE[0] * LATTICE[1];
    function stateAt(x, y) { var pr = toR(x, y); return pr[0] > fr.width || pr[1] > fr.height ? "off" : shoreState(shore, x, y).wet; }
    if (stateAt(W / 2, H / 2) === null) { ground = [W / 2, H / 2]; gd = 0; }
    for (ly = 0; ly < LATTICE[1]; ly++) for (lx = 0; lx < LATTICE[0]; lx++) {
      p = [(lx + 0.5) / LATTICE[0] * W, (ly + 0.5) / LATTICE[1] * H]; st = stateAt(p[0], p[1]);
      if (st === null) { land++; lsum[0] += p[0]; lsum[1] += p[1]; d = G.dist(p, [W / 2, H / 2]); if (d < gd) { gd = d; ground = p; } }
      else if (st !== "off") { wet[st]++; wsum[st][0] += p[0]; wsum[st][1] += p[1]; }
    }
    var share = land / total, pct = Math.round(share * 100);
    NS.assert(share >= MIN_LAND, typeof at === "string" ? "zone " + Z.id + " is open water" + (land ? " (" + pct + "% of it is land)" : "") + "; a zone is open country" : "that point is on land, but its zone " + Z.id + " is all but open water (" + pct + "% of it is land); a zone is open country", { at: at, zone: Z.id, land: U.round(share, 3) });
    /* the ground is read where the zone's land is: its middle, or the land nearest it */
    var c = toR(ground[0], ground[1]), hb = NS.fieldBytes(regionDoc.fields.height), bb = NS.fieldBytes(regionDoc.fields.biome), g = G.Grid(fr.cols, fr.rows, fr.width, fr.height);
    var hf = new Float32Array(g.n); for (i = 0; i < g.n; i++) hf[i] = hb[i] > 128 ? (hb[i] - 129) / 126 : -(127 - hb[i]) / 127;
    var node = g.nearest(c[0], c[1]), biome = NS.terrain.BIOME_NAME[bb[node]], alt = null;
    if (!TERRAIN_OF_BIOME[biome]) { g.neighbors8(node, function (k) { var bn = NS.terrain.BIOME_NAME[bb[k]]; if (!alt && TERRAIN_OF_BIOME[bn]) alt = bn; }); biome = alt || "plain"; }
    var terrain = TERRAIN_OF_BIOME[biome], elevation = Math.max(0, g.sample(hf, c[0], c[1])), cc = g.col(node), cr = g.row(node);
    var hx = (hf[g.idx(Math.min(g.cols - 1, cc + 1), cr)] - hf[g.idx(Math.max(0, cc - 1), cr)]) / 2, hy = (hf[g.idx(cc, Math.min(g.rows - 1, cr + 1))] - hf[g.idx(cc, Math.max(0, cr - 1))]) / 2, slope = U.round(Math.sqrt(hx * hx + hy * hy), 4);
    var site = { elevation: U.round(elevation, 3), slope: slope, biome: biome, coast: null, lake: null, river: null, road: null, caves: [], place: null, regionName: regionDoc.title.name, regionSeed: regionDoc.seed, zone: Z, near: null, within: null, water: false, seaName: null, shore: lines.length ? shore : null, rivers: [], roads: [] };
    /* which side the water lies on: from the middle of the zone's land to the middle of its water */
    function nearestFeature(kind) { var best = null, bd = Infinity; regionDoc.features.forEach(function (f) { if (f.kind !== kind) return; var dd = G.dist(c, [f.x, f.y]); if (dd < bd) { bd = dd; best = f; } }); return best; }
    function sideOfWater(kind) { return G.bearing([lsum[0] / land, lsum[1] / land], [wsum[kind][0] / wet[kind], wsum[kind][1] / wet[kind]]).name; }
    if (wet.sea) { site.coast = { bearing: sideOfWater("sea") }; var sf = nearestFeature("sea"); if (sf) site.seaName = sf.name; }
    if (wet.lake) { var lf = nearestFeature("lake"); site.lake = { bearing: sideOfWater("lake"), name: lf && lf.name ? lf.name : null }; }
    /* the rivers: the region's, led on to the water or the river they run into where the drawn line stops short of it, cut to the zone */
    var mx = (MOUTH_REACH + 1), pieces = [];
    regionDoc.rivers.forEach(function (rv, ri) {
      var pts = rv.pts, n = pts.length, last = pts[n - 1], hit = false, k, best = null, bd = MOUTH_REACH;
      for (k = 1; k < n && !hit; k++) hit = !(Math.max(pts[k - 1][0], pts[k][0]) < Z.x0 - mx || Math.min(pts[k - 1][0], pts[k][0]) > Z.x1 + mx || Math.max(pts[k - 1][1], pts[k][1]) < Z.y0 - mx || Math.min(pts[k - 1][1], pts[k][1]) > Z.y1 + mx);
      if (!hit) return;
      function lead(lineSets) { lineSets.forEach(function (ring) { var m, a, b, dx, dy, l2, t, ex, ey, dd; for (m = 1; m < ring.length; m++) { a = ring[m - 1]; b = ring[m]; dx = b[0] - a[0]; dy = b[1] - a[1]; l2 = dx * dx + dy * dy; t = l2 ? U.clamp(((last[0] - a[0]) * dx + (last[1] - a[1]) * dy) / l2, 0, 1) : 0; ex = last[0] - a[0] - dx * t; ey = last[1] - a[1] - dy * t; dd = Math.sqrt(ex * ex + ey * ey); if (dd < bd) { bd = dd; best = [a[0] + dx * t, a[1] + dy * t, last[2]]; } } }); }
      if (rv.endsIn === "river") lead(regionDoc.rivers.filter(function (o, oi) { return oi !== ri; }).map(function (o) { return o.pts; }));
      else if ((rv.endsIn === "sea" || rv.endsIn === "lake") && waterAt(regionDoc, last) === null) lead((rv.endsIn === "sea" ? regionDoc.coast : regionDoc.lakes).map(function (ring) { return ring.concat([ring[0]]); }));
      if (best && bd > 0.01) pts = pts.concat([best]);
      zonePieces(pts, Z.col, Z.row, cw, ch).forEach(function (pc) {
        var zp = pc.pts.map(function (q) { return [r1((q[0] - Z.x0) * sx), r1((q[1] - Z.y0) * sy), r1(U.clamp(4 + 12 * ((q[2] || 1) - 0.5), 4, 40))]; }), a = zp[0], b = zp[zp.length - 1], wMax = 0;
        if (pc.from) { if (pc.from === "W") a[0] = 0; else if (pc.from === "E") a[0] = W; else if (pc.from === "N") a[1] = 0; else a[1] = H; }
        if (pc.to) { if (pc.to === "W") b[0] = 0; else if (pc.to === "E") b[0] = W; else if (pc.to === "N") b[1] = 0; else b[1] = H; }
        zp.forEach(function (q) { if (q[2] > wMax) wMax = q[2]; });
        pieces.push({ id: rv.id, name: rv.name || null, from: pc.from, to: pc.to, pts: zp, ends: pc.pts[pc.pts.length - 1] === pts[pts.length - 1] ? rv.endsIn : null, w: wMax, order: pieces.length });
      });
    });
    pieces.sort(function (p1, p2) { return p2.w - p1.w || p1.order - p2.order; });   /* the widest is the zone's river, the others its branches */
    site.rivers = pieces.map(function (pc) { var o = { id: pc.id, name: pc.name, from: pc.from, to: pc.to, pts: pc.pts }; if (pc.ends) o.ends = pc.ends; return o; });
    /* the roads: the stretches the region draws, cut to the zone; an end on an edge says which roads cross there and what lies beyond either way */
    var roads = regionDoc.roads, margin = ROAD_TOL + 2 * ROAD_SUB, placeName = {}, models = {};
    function model(k) { return models[k] || (models[k] = roadModel(roads, k)); }
    /* the road that is drawn where road k passes p: k itself (both ends of its step there are drawn), or the earlier
       road that stands for it there (and so on back); none (−1) where k only ENDS near p — it does not pass */
    function owner(k, p) { var m = model(k), sp = m.span(p), q, h; if (sp.end) return -1; if (m.drawn(sp.q) && m.drawn(sp.q + 1)) return k; q = m.drawn(sp.q) ? sp.q + 1 : sp.q; h = m.from(q); return h ? owner(h.road, m.subs[q]) : k; }
    regionDoc.places.forEach(function (pl) { placeName[pl.id] = pl.name; });
    function dirAt(pts, pt) { var best = null, bd = Infinity, k, dd; for (k = 1; k < pts.length; k++) { dd = G.pointSegDist(pt, pts[k - 1], pts[k]); if (dd < bd) { bd = dd; best = [pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1], dd]; } } return best; }
    function endOf(q, edge, j, leaving, join) {
      var z = toZ(q), o = { x: z[0], y: z[1], edge: edge || null };
      if (!edge) { if (join) o.join = true; return o; }
      if (edge === "W") o.x = 0; else if (edge === "E") o.x = W; else if (edge === "N") o.y = 0; else o.y = H;
      /* the roads that cross here: this one and every later road it stands for at this point; for each, the place beyond the edge and the place behind */
      var dj = dirAt(roads[j].pts, q), ids = [], out = [], back = [], kind = "track", k, dk, same, on;
      function add(list, name) { if (name && list.indexOf(name) < 0) list.push(name); }
      for (k = j; k < roads.length; k++) {
        dk = k === j ? dj : dirAt(roads[k].pts, q); if (k !== j && (dk[2] > ROAD_TOL || owner(k, q) !== j)) continue;
        same = k === j || dk[0] * dj[0] + dk[1] * dj[1] >= 0; on = same ? leaving : !leaving;   /* does road k, read from its first place to its last, go out through this edge? */
        ids.push(roads[k].id); if (roads[k].kind === "road") kind = "road";
        add(out, placeName[on ? roads[k].to : roads[k].from]); add(back, placeName[on ? roads[k].from : roads[k].to]);
      }
      o.roads = ids; o.kind = kind; o.towards = out; o.back = back;
      return o;
    }
    roads.forEach(function (rdx, j) {
      if (!passes(rdx.pts, Z.x0 - margin, Z.y0 - margin, Z.x1 + margin, Z.y1 + margin)) return;
      roadRuns(model(j), Z.x0 - margin, Z.y0 - margin, Z.x1 + margin, Z.y1 + margin).forEach(function (run) {
        zonePieces(run.pts, Z.col, Z.row, cw, ch).forEach(function (pc) {
          var a = pc.pts[0], b = pc.pts[pc.pts.length - 1], from = endOf(a, pc.from, j, false, run.joinA && a === run.pts[0]), to = endOf(b, pc.to, j, true, run.joinB && b === run.pts[run.pts.length - 1]);
          site.roads.push({ id: rdx.id, kind: from.kind === "road" || to.kind === "road" ? "road" : rdx.kind, from: from, to: to });
        });
      });
    });
    /* two ends within WAY_GAP of each other on one edge are one way on (a road that meets another just beyond the
       edge): they stand where the earlier road's does, with the roads and the places of both. The ends on an edge are
       the same from both sides of it, so both zones gather them alike. */
    Object.keys(EDGES).forEach(function (edge) {
      var ends = [], along = edge === "N" || edge === "S" ? "x" : "y", group = [], k;
      site.roads.forEach(function (rw, wi) { [rw.from, rw.to].forEach(function (e) { if (e.edge === edge) ends.push({ e: e, order: wi }); }); });
      ends.sort(function (p, q) { return p.e[along] - q.e[along] || p.order - q.order; });
      function gather() {
        if (group.length > 1) {
          var first = group.slice().sort(function (p, q) { return p.order - q.order || p.e[along] - q.e[along]; })[0].e, roads = [], out = [], back = [], kind = "track";
          group.slice().sort(function (p, q) { return p.order - q.order; }).forEach(function (m) { m.e.roads.forEach(function (id) { if (roads.indexOf(id) < 0) roads.push(id); }); m.e.towards.forEach(function (nm) { if (out.indexOf(nm) < 0) out.push(nm); }); m.e.back.forEach(function (nm) { if (back.indexOf(nm) < 0) back.push(nm); }); if (m.e.kind === "road") kind = "road"; });
          var px = first.x, py = first.y;
          group.forEach(function (m) { m.e.x = px; m.e.y = py; m.e.roads = roads; m.e.towards = out; m.e.back = back; m.e.kind = kind; });
        }
        group = [];
      }
      for (k = 0; k < ends.length; k++) { if (group.length && ends[k].e[along] - group[group.length - 1].e[along] >= WAY_GAP) gather(); group.push(ends[k]); }
      gather();
    });
    function inZone(q) { return Math.floor(q.x / cw) === Z.col && Math.floor(q.y / ch) === Z.row; }
    (regionDoc.caves || []).forEach(function (cv) { if (inZone(cv)) { var zp = toZ([cv.x, cv.y]); site.caves.push({ id: cv.id, name: cv.name, x: zp[0], y: zp[1], facing: cv.site.facing }); } });
    var nd = Infinity, np = null;
    regionDoc.places.forEach(function (pl) { var dd = G.dist(c, [pl.x, pl.y]); if (dd < nd) { nd = dd; np = pl; } if (inZone(pl)) { var zp = toZ([pl.x, pl.y]); site.place = { id: pl.id, name: pl.name, kind: pl.kind, x: zp[0], y: zp[1] }; } });
    if (np) site.near = { id: np.id, name: np.name, km: U.round(nd * kpu, 1), bearing: G.bearing([np.x, np.y], c).name };
    var wantKind = { forest: "forest", mountain: "range", marsh: "marsh" }[biome] || null, wd = Infinity;
    if (wantKind) regionDoc.features.forEach(function (f) { if (f.kind !== wantKind || !f.name) return; var dd = G.dist(c, [f.x, f.y]); if (dd < wd && dd < Math.sqrt(f.size) * g.dx * 0.95) { wd = dd; site.within = f.name; } });
    site.water = !!(site.coast || site.lake || site.rivers.length || biome === "marsh");
    return { seed: regionDoc.seed + "/" + Z.id, terrain: terrain, culture: regionDoc.params.culture, title: null, site: site };
  }
  function validate(doc) {
    ["cover", "paths", "features", "glyphs"].forEach(function (k) { NS.assert(Array.isArray(doc[k]), "document." + k + " must be an array", { key: k }); });
    NS.assert(doc.water && Array.isArray(doc.water.polys) && Array.isArray(doc.water.pools) && Array.isArray(doc.water.streams) && (doc.water.branches === undefined || Array.isArray(doc.water.branches)), "document.water is malformed", { water: doc.water });
    NS.assert(NS.own(TERRAINS, doc.kind), "document.kind must be a terrain", { kind: doc.kind, known: Object.keys(TERRAINS) });
    doc.features.forEach(function (f, i) { NS.assert(f.id && typeof f.name === "string" && NS.own(CATALOGUE, f.kind) && isFinite(f.x) && isFinite(f.y), "feature " + i + " is malformed", { feature: f }); });
    NS.validatePortals(doc);
    return doc;
  }

  NS.wild = { generate: generate, DEFAULTS: DEFAULTS, TERRAINS: TERRAINS, CATALOGUE: CATALOGUE, WHERE: WHERE, TERRAIN_OF_BIOME: TERRAIN_OF_BIOME, BEARINGS: BEARINGS, M_PER_UNIT: M_PER_UNIT, ZONE_KM: ZONE_KM, MAX_COUNT: MAX_COUNT, MAX_NAME: MAX_NAME, MAX_NOTE: MAX_NOTE, MAX_WORD: MAX_NAME, CUSTOM: "custom", OPS: OPS,
    terrains: function () { return Object.keys(TERRAINS); }, kinds: kinds, resolveParams: resolveParams, validateCounts: validateCounts, validateEdits: validateEdits, fromRegion: fromRegion, zoneAt: zoneAt, rivers: riversOf, MIN_LAND: MIN_LAND, reference: reference, caption: caption, intro: intro, locate: locate, validate: validate };
})(typeof self !== "undefined" ? self : typeof global !== "undefined" ? global : this);

/* ───── 50-digest.js ───── */
/* 50-digest.js — the GM digest: structured facts and plain prose about a map document's geography, so a game master
   prompt can describe distances, bearings and terrain that agree with the drawn map. Pure function of the document.
   One writer per generator in the DIGESTS table (this file: region; 51-digest-town.js: town). */
(function (root) {
  "use strict";
  var NS = root.TnDMaps, U = NS.util, G = NS.geom;

  function km(doc, units) { return units * doc.frame.kmPerUnit; }
  function days(doc, kmv) { return kmv / doc.frame.travelKmPerDay; }
  function fmtDays(d) { if (d < 0.3) return "a few hours"; if (d < 0.75) return "half a day"; if (d < 1.5) return "a day"; var n = Math.round(d); return n + " days"; }
  function fmtKm(k) { return k < 10 ? Math.round(k) + " km" : Math.round(k / 5) * 5 + " km"; }
  function byId(list, id) { var i; for (i = 0; i < list.length; i++) if (list[i].id === id) return list[i]; return null; }

  /* travel: road distance along the road network (Dijkstra over doc.roads), straight-line otherwise */
  function roadGraph(doc) {
    var adj = {}, i, r;
    for (i = 0; i < doc.roads.length; i++) { r = doc.roads[i]; adj[r.from] = adj[r.from] || []; adj[r.to] = adj[r.to] || []; adj[r.from].push({ to: r.to, d: r.lengthUnits, road: r.id }); adj[r.to].push({ to: r.from, d: r.lengthUnits, road: r.id }); }
    return adj;
  }
  function roadDistances(doc, fromId, adj) {
    var dist = {}, heap = U.Heap(function (a, b) { return a.d < b.d; }), cur, nbs, i;
    dist[fromId] = 0; heap.push({ id: fromId, d: 0 });
    while (heap.size()) {
      cur = heap.pop(); if (cur.d > dist[cur.id]) continue;
      nbs = adj[cur.id] || [];
      for (i = 0; i < nbs.length; i++) { var nd = cur.d + nbs[i].d; if (dist[nbs[i].to] === undefined || nd < dist[nbs[i].to]) { dist[nbs[i].to] = nd; heap.push({ id: nbs[i].to, d: nd }); } }
    }
    return dist;
  }

  /* terrain between two points: sample the biome field along the straight line */
  function terrainBetween(doc, a, b) {
    if (!doc.fields || !doc.fields.biome) return null;
    var bytes = doc.fields.biome, decoded = NS.fieldBytes(bytes), cols = doc.frame.cols, rows = doc.frame.rows;
    var dx = doc.frame.width / (cols - 1), dy = doc.frame.height / (rows - 1), n = 24, counts = {}, i, t, x, y, c, r, name;
    for (i = 1; i < n; i++) {
      t = i / n; x = a.x + (b.x - a.x) * t; y = a.y + (b.y - a.y) * t;
      c = U.clamp(Math.round(x / dx), 0, cols - 1); r = U.clamp(Math.round(y / dy), 0, rows - 1);
      name = NS.terrain.BIOME_NAME[decoded[r * cols + c]]; counts[name] = (counts[name] || 0) + 1;
    }
    var order = Object.keys(counts).sort(function (p, q) { return counts[q] - counts[p]; });
    return order.filter(function (k) { return counts[k] >= 3; });
  }

  function caveWhere(c) { return NS.region.caveWhere(c); }
  function buildRegion(doc) {
    var facts = [], lines = [], adj = roadGraph(doc), places = doc.places, i, j, p, q;
    var cities = places.filter(function (x) { return x.kind === "city"; }), capital = places.filter(function (x) { return x.capital; })[0] || null;
    var spanKm = km(doc, doc.frame.width);
    lines.push(doc.title.name + " — a region about " + fmtKm(spanKm) + " across (" + fmtDays(days(doc, spanKm)) + " of travel east to west)." +
      (doc.sea.present ? " It has a coastline." : " It is landlocked."));
    facts.push({ kind: "region", name: doc.title.name, widthKm: Math.round(spanKm), heightKm: Math.round(km(doc, doc.frame.height)), coastal: doc.sea.present });
    if (capital) lines.push("The capital is " + capital.name + ".");
    if (cities.length) lines.push("Cities: " + cities.map(function (c) { return c.name; }).join(", ") + ".");
    var named = doc.features.filter(function (f) { return f.name; });
    ["sea", "range", "forest", "lake", "marsh"].forEach(function (kind) {
      var fs = named.filter(function (f) { return f.kind === kind; });
      if (fs.length) lines.push({ sea: "Seas", range: "Mountain ranges", forest: "Forests", lake: "Lakes", marsh: "Marshes" }[kind] + ": " + fs.map(function (f) { return f.name; }).join(", ") + ".");
    });
    var namedRivers = doc.rivers.filter(function (r) { return r.name; });
    if (namedRivers.length) lines.push("Rivers: " + namedRivers.map(function (r) { return r.name; }).join(", ") + ".");
    /* the caves: a mouth in the hills or the cliffs, where it lies from the nearest place (TnDMaps.dungeon.fromRegion opens it) */
    var caves = doc.caves || [];
    if (caves.length) lines.push("Caves: " + caves.map(function (c) { return c.name + " (" + caveWhere(c) + ")"; }).join("; ") + ".");
    caves.forEach(function (c) { facts.push({ kind: "cave", id: c.id, name: c.name, near: c.near ? c.near.id : null, nearName: c.near ? c.near.name : null, km: c.near ? c.near.km : null, bearing: c.near ? c.near.bearing : null, facing: c.site.facing, seaCave: !!c.site.coastal, hill: !!c.site.hill, extent: c.site.extent, biome: c.site.biome }); });
    lines.push("");
    /* one paragraph per settlement: site, surroundings, and the way to its neighbours */
    for (i = 0; i < places.length; i++) {
      p = places[i];
      var s = p.site, bits = [];
      bits.push(p.name + " is a " + p.kind + (p.capital ? " and the capital" : "") + ".");
      var where = [];
      if (s.coastal) where.push("on the coast" + (s.coastBearing ? " (the sea lies to the " + s.coastBearing + ")" : ""));
      if (s.riverId) { var rv = byId(doc.rivers, s.riverId); where.push(s.mouth ? "at the mouth of " + (rv && rv.name ? rv.name : "a river") : "on " + (rv && rv.name ? rv.name : "a river")); }
      if (s.lake) { var lk = s.lakeId ? byId(doc.features, s.lakeId) : null; where.push("beside " + (lk && lk.name ? lk.name : "a lake")); }
      if (s.hill) where.push("in hill country");
      if (s.forest) where.push("among woods");
      if (s.marsh) where.push("in marshland");
      if (!where.length) where.push("in open " + (s.biome === "scrub" ? "scrubland" : "farmland"));
      bits.push("It lies " + where.join(", ") + ".");
      var dist = roadDistances(doc, p.id, adj), nbs = [];
      for (j = 0; j < places.length; j++) {
        if (j === i) continue; q = places[j];
        var straight = G.dist([p.x, p.y], [q.x, q.y]), byRoad = dist[q.id];
        nbs.push({ q: q, straight: straight, road: byRoad === undefined ? null : byRoad });
      }
      nbs.sort(function (a, b) { return a.straight - b.straight; });
      var near = nbs.slice(0, 3).map(function (nb) {
        var bear = G.bearing([p.x, p.y], [nb.q.x, nb.q.y]).name, kmv = km(doc, nb.road !== null ? nb.road : nb.straight), between = terrainBetween(doc, p, nb.q);
        var txt = nb.q.name + " lies " + fmtKm(kmv) + " to the " + bear + (nb.road !== null ? " by road" : " as the crow flies") + " (" + fmtDays(days(doc, kmv)) + ")";
        if (between && between.length && nb.road === null) txt += ", across " + between.join(" and ");
        else if (between && between.indexOf("mountain") >= 0) txt += ", over the mountains";
        else if (between && between.indexOf("forest") >= 0) txt += ", through forest";
        facts.push({ kind: "route", from: p.id, to: nb.q.id, bearing: bear, km: Math.round(kmv), days: U.round(days(doc, kmv), 1), byRoad: nb.road !== null, terrain: between || [] });
        return txt;
      });
      if (near.length) bits.push(near.join("; ") + ".");
      var bridges = doc.roads.filter(function (r) { return (r.from === p.id || r.to === p.id) && r.bridges.length; });
      if (bridges.length) bits.push("A bridge crosses the river on the road to " + byId(places, bridges[0].from === p.id ? bridges[0].to : bridges[0].from).name + ".");
      facts.push({ kind: "place", id: p.id, name: p.name, placeKind: p.kind, capital: !!p.capital, coastal: !!s.coastal, coastBearing: s.coastBearing, river: s.riverId, mouth: !!s.mouth, lake: !!s.lake, biome: s.biome, roads: s.roads.map(function (r) { return { to: r.to, bearing: r.bearing }; }) });
      lines.push(bits.join(" "));
    }
    if (doc.seaLinks && doc.seaLinks.length) lines.push("", "Separated by water (no road): " + doc.seaLinks.map(function (l) { return byId(places, l.from).name + " and " + byId(places, l.to).name; }).join("; ") + ".");
    return { text: lines.join("\n"), facts: facts };
  }

  var DIGESTS = { region: buildRegion };
  function build(doc) {
    NS.assert(doc && doc.format === NS.DOC_FORMAT, "digest needs a tndmap document", { format: doc && doc.format });
    var name = doc.generator && doc.generator.name, writer = NS.own(DIGESTS, name);
    NS.assert(writer, "no digest for this document kind", { generator: doc.generator, known: Object.keys(DIGESTS) });
    return writer(doc);
  }
  NS.digest = build; NS.digest.DIGESTS = DIGESTS; NS.digest.fmtKm = fmtKm; NS.digest.fmtDays = fmtDays;
})(typeof self !== "undefined" ? self : typeof global !== "undefined" ? global : this);

/* ───── 51-digest-town.js ───── */
/* 51-digest-town.js — the GM digest for a TOWN document (registered in digest.DIGESTS): what kind of place it is, where
   the water and the walls are, what stands where relative to the market, which roads leave and for where. */
(function (root) {
  "use strict";
  var NS = root.TnDMaps, U = NS.util, G = NS.geom;

  function metres(doc, units) { return Math.round(units * doc.frame.mPerUnit / 10) * 10; }
  function list(items) { if (items.length <= 1) return items.join(""); return items.slice(0, -1).join(", ") + " and " + items[items.length - 1]; }
  function byKind(doc, kind) { return doc.landmarks.filter(function (l) { return l.kind === kind; }); }

  function buildTown(doc) {
    var facts = [], lines = [], centre = doc.centre, bits = [], s = doc.site || {}, i;
    var market = byKind(doc, "market")[0] || byKind(doc, "green")[0] || null, temple = byKind(doc, "temple")[0] || null, keep = byKind(doc, "keep")[0] || null, harbour = byKind(doc, "harbour")[0] || null, outfall = byKind(doc, "outfall")[0] || null;
    function rel(l) { var b = G.bearing(centre, [l.x, l.y]), m = metres(doc, G.dist(centre, [l.x, l.y])); return { bearing: b.name, metres: m }; }
    function districtOf(l) { var w = null, d = null; for (i = 0; i < doc.wards.length; i++) if (doc.wards[i].id === l.ward) w = doc.wards[i]; if (w && w.district !== null && w.district !== undefined) d = doc.districts[w.district] || null; return d; }

    bits.push(doc.title.name + " is a" + (doc.walled ? " walled" : "") + " " + doc.size + " of about " + doc.houses + " houses (some " + doc.population + " souls)" + (s.regionName ? " in " + s.regionName : "") + ".");
    var where = [];
    if (s.coast) where.push("on the coast, the sea lying to the " + s.coast);
    if (doc.water.river) where.push((doc.water.river.name || "a river") + " runs through it from the " + s.river.from + " to the " + s.river.to);
    if (s.lake) where.push((doc.water.lakeName || "a lake") + " lies to the " + s.lake);
    if (s.hill) where.push("it sits in hill country"); if (s.forest) where.push("woods press close around it"); if (s.marsh) where.push("marsh lies about it");
    if (where.length) bits.push(where.map(function (w, idx) { return idx === 0 ? w.charAt(0).toUpperCase() + w.slice(1) : w; }).join("; ") + ".");
    lines.push(bits.join(" "));
    facts.push({ kind: "town", name: doc.title.name, size: doc.size, walled: doc.walled, houses: doc.houses, population: doc.population, coast: s.coast || null, river: doc.water.river ? { name: doc.water.river.name, from: s.river.from, to: s.river.to } : null, lake: s.lake || null, region: s.regionName || null });

    bits = [];
    if (market) bits.push(market.name + " lies at the heart of the " + doc.size + ".");
    if (temple) { var tr = rel(temple); bits.push(temple.name + " stands " + (tr.metres < 60 ? "beside the market" : tr.metres + " m " + tr.bearing + " of the market") + "."); }
    if (keep) { var kr = rel(keep); bits.push(keep.name + " overlooks the " + doc.size + " from the " + kr.bearing + "."); }
    if (harbour) { var hr = rel(harbour); bits.push(harbour.name + " lies on the " + hr.bearing + " shore, " + hr.metres + " m from the market."); }
    if (outfall) { var orr = rel(outfall), grates = doc.establishments.filter(function (e) { return doc.portals.some(function (p) { return p.id === e.id && p.to.generator === "dungeon"; }); }); bits.push("The sewers come out at " + outfall.name + ", " + orr.metres + " m " + orr.bearing + " of the market, beyond the wall" + (grates.length ? "; the way down is " + list(grates.map(function (e) { return e.name; })) : "") + "."); }
    byKind(doc, "park").forEach(function (pk) { var pr = rel(pk); bits.push(pk.name + " is a park, an open green with trees, " + pr.metres + " m " + pr.bearing + " of the market."); });
    if (bits.length) lines.push(bits.join(" "));
    doc.landmarks.forEach(function (l) { var r = rel(l), d = districtOf(l); facts.push({ kind: "landmark", id: l.id, name: l.name, landmarkKind: l.kind, bearing: r.bearing, metres: r.metres, district: d ? d.name : null }); });

    bits = [];
    if (doc.walled && doc.walls) {
      var gates = byKind(doc, "gate").map(function (g) { var rd = null; doc.roads.forEach(function (r) { if (r.id === g.road) rd = r; }); return g.name + (rd && rd.to.length ? " (the road to " + list(rd.to) + ")" : ""); });
      bits.push("A wall with " + doc.walls.towers.length + " towers rings it" + (gates.length ? "; its gates are " + list(gates) : "") + ".");
    } else bits.push("It has no wall.");
    if (doc.roads.length) bits.push("Roads leave to the " + list(doc.roads.map(function (r) { return r.bearing + (r.to.length ? " (to " + list(r.to) + ")" : ""); })) + ".");
    var nb = doc.bridges.length + doc.roads.reduce(function (n, r) { return n + r.bridges.length; }, 0);
    if (doc.water.river) bits.push(nb === 0 ? "No bridge crosses the river here." : nb === 1 ? "One bridge crosses the river." : nb + " bridges cross the river.");
    lines.push(bits.join(" "));
    doc.roads.forEach(function (r) { facts.push({ kind: "road", id: r.id, bearing: r.bearing, to: r.to, gate: r.gate }); });

    if (doc.districts.length) {
      lines.push("Districts: " + doc.districts.map(function (d) { var b = G.bearing(centre, [d.x, d.y]).name; facts.push({ kind: "district", id: d.id, name: d.name, bearing: b, houses: d.houses }); return d.name + " (" + b + " of the market, " + d.houses + " houses)"; }).join("; ") + ".");
    }
    /* the trades and houses, grouped by district, each with its kind and its bearing from the market */
    if (doc.establishments.length) {
      var groups = {}, orderD = [];
      doc.establishments.forEach(function (e) {
        var d = null; for (i = 0; i < doc.districts.length; i++) if (doc.districts[i].id === e.district) d = doc.districts[i];
        var key = d ? d.name : "", r = rel(e);
        if (!groups[key]) { groups[key] = []; orderD.push(key); }
        groups[key].push(e.name + " (" + e.word + ")" + (e.note ? " — " + e.note : ""));
        facts.push({ kind: "establishment", id: e.id, name: e.name, type: e.kind, word: e.word, district: d ? d.name : null, bearing: r.bearing, metres: r.metres, authored: !!e.authored, note: e.note || null });
      });
      lines.push("Trades and houses: " + orderD.map(function (key) { return (key ? "in " + key + ": " : "outside the districts: ") + list(groups[key]); }).join("; ") + ".");
    }
    if (doc.warnings.length) lines.push("", "Notes: " + doc.warnings.join("; ") + ".");
    return { text: lines.join("\n"), facts: facts };
  }

  NS.digest.DIGESTS.town = buildTown;
  void U;
})(typeof self !== "undefined" ? self : typeof global !== "undefined" ? global : this);

/* ───── 52-digest-dungeon.js ───── */
/* 52-digest-dungeon.js — the GM digest for a DUNGEON document (registered in digest.DIGESTS): what it is and what it
   lies under, every way in and out with where it stands relative to the market above, the passages, and every chamber
   with its kind, bearing and distance from the hub, and the GM's note on it; the stairs that lead further down.
   Facts: dungeon, portal (with its `way`), room (with `note`, `shape`, `size` in metres and `door`). */
(function (root) {
  "use strict";
  var NS = root.TnDMaps, G = NS.geom;

  function list(items) { if (items.length <= 1) return items.join(""); return items.slice(0, -1).join(", ") + " and " + items[items.length - 1]; }

  function buildDungeon(doc) {
    var facts = [], lines = [], ref = NS.dungeon.reference(doc), centre = [ref.x, ref.y], SITE = NS.dungeon.SITES[doc.kind], town = doc.site.town.name, bits = [], WD = SITE.words || { main: "main tunnel", side: "side passage" };
    function metres(units) { return Math.round(units * doc.frame.mPerUnit / 10) * 10; }
    function rel(p) { var b = G.bearing(centre, [p.x, p.y]), m = metres(G.dist(centre, [p.x, p.y])); return { bearing: b.name, metres: m }; }
    function where(p) { var r = rel(p); return r.metres < 20 ? ref.at : r.metres + " m " + r.bearing + " of " + ref.word; }
    function isRef(p) { return Math.abs(p.x - ref.x) < 0.05 && Math.abs(p.y - ref.y) < 0.05; }
    var mains = doc.passages.filter(function (p) { return p.kind === "main" || p.kind === "drain"; }), chambers = doc.rooms.filter(function (r) { return !r.portal; }).sort(function (a, b) { return (a.no || 0) - (b.no || 0); });   /* a numbered site (a crypt) lists them by their number on the plan */
    /* a side passage is counted where it leaves a main one (its root), not per segment: a branch of three bends is one passage */
    var sides = doc.passages.filter(function (p) { return p.kind === "side" && p.pts.some(function (q) { return mains.some(function (m) { return G.pointSegDist(q, m.pts[0], m.pts[1]) <= m.width / 2 + 0.3; }); }); });
    var ups = doc.portals.filter(function (p) { return p.way === "up" && p.kind !== "outfall"; }), outfalls = doc.portals.filter(function (p) { return p.kind === "outfall"; }), downs = doc.portals.filter(function (p) { return p.way === "down"; });
    var above = doc.site.above || { generator: "town", name: town }, IN_WORD = { grate: "a grate", stairs: "stairs from above", cave: "the mouth of the cave", shaft: "a shaft from above" };

    var mainM = Math.round(mains.reduce(function (n, p) { return n + G.dist(p.pts[0], p.pts[1]); }, 0) * doc.frame.mPerUnit / 10) * 10;
    bits.push(doc.title.name + " " + NS.dungeon.intro(doc) + " (level −" + doc.depth + "): some " + mainM + " m of " + WD.main + ", " + sides.length + " " + WD.side + (sides.length === 1 ? "" : "s") + " and " + chambers.length + " chamber" + (chambers.length === 1 ? "" : "s") + ", " + doc.stats.lengthM + " m of passage in all.");
    lines.push(bits.join(" "));
    facts.push({ kind: "dungeon", name: doc.title.name, site: doc.kind, depth: doc.depth, town: town, above: above, portals: doc.portals.length, rooms: doc.rooms.length, lengthM: doc.stats.lengthM });

    bits = [];
    if (ups.length) bits.push((ups.length === 1 ? "The way in is " : "The ways in are ") + list(ups.map(function (p) { return p.name + " (" + (IN_WORD[p.kind] || p.kind) + (isRef(p) ? "" : " " + where(p)) + ")"; })) + ".");
    outfalls.forEach(function (p) { bits.push(p.name + " is the outfall, " + where(p) + " — beyond the wall, a way out of the town that passes no gate."); });
    if (downs.length) bits.push((downs.length === 1 ? "The way further down, into the " : "The ways further down, into the ") + NS.dungeon.SITES[downs[0].to.site].word + ", " + (downs.length === 1 ? "is " : "are ") + list(downs.map(function (p) { return p.name + " (" + (SITE.rooms[p.kind] ? SITE.rooms[p.kind].word : p.kind) + ", " + where(p) + ")"; })) + ".");
    lines.push(bits.join(" "));
    doc.portals.forEach(function (p) { var r = rel(p); facts.push({ kind: "portal", id: p.id, name: p.name, portalKind: p.kind, way: p.way, bearing: r.bearing, metres: r.metres, to: p.to }); });

    if (chambers.length) {
      var nameOf = function (id) { var k; for (k = 0; k < doc.rooms.length; k++) if (doc.rooms[k].id === id) return doc.rooms[k].name; return id; };
      lines.push("Chambers: " + chambers.map(function (r) { var w = rel(r); return (r.no ? r.no + ". " : "") + r.name + " (" + r.word + ", " + NS.dungeon.dimensions(r, doc.frame.mPerUnit).text + ", " + (r.annex ? "off " + nameOf(r.annex) + ", " : "") + (r.water ? NS.dungeon.POOL_FED[r.water.fed].word + ", " : "") + (w.metres < 20 ? ref.at : w.metres + " m " + w.bearing) + (r.door && r.door !== "arch" ? ", " + NS.dungeon.DOOR_STATES[r.door] : "") + ")" + (r.note ? " — " + r.note : ""); }).join("; ") + ".");
    }
    doc.rooms.forEach(function (r) { var w = rel(r); facts.push({ kind: "room", no: r.no, id: r.id, name: r.name, roomKind: r.kind, word: r.word, shape: r.shape, size: NS.dungeon.dimensions(r, doc.frame.mPerUnit), annex: r.annex || null, door: r.door, bearing: w.bearing, metres: w.metres, portal: r.portal, authored: !!r.authored, water: r.water ? { kind: r.water.kind, fed: r.water.fed } : null, note: r.note || null }); });
    if (doc.water.channels.length) {
      var srcRoom = null, sinkRoom = null; doc.rooms.forEach(function (r) { if (r.id === doc.water.source) srcRoom = r; if (r.id === doc.water.sink) sinkRoom = r; });
      lines.push(srcRoom ? "A stream runs from " + srcRoom.name + (sinkRoom ? " over into " + sinkRoom.name + "." : " out of the mouth.") : SITE.waterLine || "Water runs down the main tunnels toward the outfall.");
    } else if (doc.rooms.some(function (r) { return r.water && r.water.fed === "spring"; })) lines.push("The springs' water drains away through the floor; no stream runs.");
    if (doc.warnings.length) lines.push("", "Notes: " + doc.warnings.join("; ") + ".");
    return { text: lines.join("\n"), facts: facts };
  }

  NS.digest.DIGESTS.dungeon = buildDungeon;
})(typeof self !== "undefined" ? self : typeof global !== "undefined" ? global : this);

/* ───── 53-digest-interior.js ───── */
/* 53-digest-interior.js — the GM digest for an INTERIOR document (registered in digest.DIGESTS): what the building is
   and where, its floors, and floor by floor every room with what furnishes it, what it opens onto and what stands in
   each doorway, where the front door and the back door are and which way they face, the stairs, the GM's notes.
   Facts: interior, floor, room (with `furniture`, `doors`, `note`), portal. */
(function (root) {
  "use strict";
  var NS = root.TnDMaps, G = NS.geom, I = NS.interior;

  function list(items) { if (items.length <= 1) return items.join(""); return items.slice(0, -1).join(", ") + " and " + items[items.length - 1]; }
  function lower(s) { return s.charAt(0).toLowerCase() + s.slice(1); }

  function buildInterior(doc) {
    var facts = [], lines = [], S = doc.site, town = S.town && S.town.name, byId = {}, bits = [];
    doc.rooms.forEach(function (r) { byId[r.id] = r; });
    var ups = doc.levels.filter(function (l) { return l > 0; }).length, cellar = doc.levels.indexOf(-1) >= 0;
    var storeys = (ups === 0 ? "a single storey" : ups === 1 ? "two storeys" : (ups + 1) + " storeys") + (cellar ? " and a cellar" : "");
    bits.push(doc.title.name + " is " + (/^[aeiou]/i.test(doc.word) ? "an " : "a ") + doc.word + (town ? " in " + town : "") + (S.district ? " (" + S.district + ")" : "") + ": " + storeys + ", some " + doc.areaM2 + " m² of floor, " + doc.rooms.length + " rooms. The front door opens to the " + doc.facing + (doc.portals.length > 1 ? "; a back door leads out behind" : "") + ".");
    lines.push(bits.join(" "));
    facts.push({ kind: "interior", name: doc.title.name, building: doc.kind, word: doc.word, town: town || null, district: S.district || null, floors: doc.levels.slice(), areaM2: doc.areaM2, facing: doc.facing, rooms: doc.rooms.length, above: S.above || null });
    doc.portals.forEach(function (p) { var d = doc.doors.filter(function (q) { return Math.abs(q.x - p.x) < 0.05 && Math.abs(q.y - p.y) < 0.05; })[0], room = d ? byId[d.rooms[0]] : null; facts.push({ kind: "portal", id: p.id, name: p.name, portalKind: p.kind, way: p.way, room: room ? room.id : null, to: p.to }); });

    doc.floors.forEach(function (f) {
      var rooms = f.rooms.map(function (id) { return byId[id]; }).filter(Boolean), parts = [];
      rooms.forEach(function (r) {
        var ds = doc.doors.filter(function (d) { return d.rooms.indexOf(r.id) >= 0; }), opens = [], outs = [], furn = I.furnitureText(r.furniture), dim = I.dimensions(r, doc.frame.mPerUnit);
        ds.forEach(function (d) {
          var other = d.rooms[0] === r.id ? d.rooms[1] : d.rooms[0];
          if (other === null) { outs.push(d.kind === "entrance" ? "the front door" : "the back door"); return; }
          var o = byId[other]; if (!o) return;
          opens.push(lower(o.name) + (d.state !== "door" && d.state !== "arch" ? " (" + I.DOOR_STATES[d.state] + ")" : d.state === "arch" ? " (open doorway)" : ""));
        });
        var st = doc.stairs.filter(function (s) { return s.rooms.indexOf(r.id) >= 0; }).map(function (s) { return s.rooms[0] === r.id ? "up to the " + lower(I.floorName(s.to)) : "down to the " + lower(I.floorName(s.from)); });
        parts.push(r.name + " (" + dim.text + (r.open ? r.floor > 0 ? ", open over the court" : ", open to the sky" : "") + (r.portal ? ", a stair down into the " + r.portal : "") + (furn ? "; " + furn : "") + ")" + (outs.length ? " has " + list(outs) : "") + (opens.length ? (outs.length ? " and" : "") + " opens onto " + list(opens) : "") + (st.length ? "; the stair leads " + list(st) : "") + (r.note ? " — " + r.note : ""));
        facts.push({ kind: "room", id: r.id, name: r.name, roomKind: r.kind, word: r.word, floor: r.floor, floorName: f.name, areaM2: r.areaM2, size: dim, furniture: r.furniture.map(function (it) { return it.kind; }), doors: ds.map(function (d) { return { to: d.rooms[0] === r.id ? d.rooms[1] : d.rooms[0], state: d.state, kind: d.kind }; }), stairs: st, open: !!r.open, portal: r.portal || null, authored: !!r.authored, note: r.note || null });
      });
      lines.push(f.name + ": " + parts.join("; ") + ".");
      facts.push({ kind: "floor", level: f.level, name: f.name, rooms: f.rooms.slice() });
    });
    void G;
    if (doc.warnings.length) lines.push("", "Notes: " + doc.warnings.join("; ") + ".");
    return { text: lines.join("\n"), facts: facts };
  }

  NS.digest.DIGESTS.interior = buildInterior;
})(typeof self !== "undefined" ? self : typeof global !== "undefined" ? global : this);

/* ───── 54-digest-wild.js ───── */
/* 54-digest-wild.js — the WILD digest (registered in digest.DIGESTS): what the zone is and where, the lie of the land,
   its water and its track, how much of it the cover takes, every point of interest with its bearing and distance from
   the reference point (the ford, the track's middle, or the middle of the zone), the GM's notes, the ways on. */
(function (root) {
  "use strict";
  var NS = root.TnDMaps, G = NS.geom, U = NS.util, M = NS.mesh;
  var WORD = { N: "north", NE: "northeast", E: "east", SE: "southeast", S: "south", SW: "southwest", W: "west", NW: "northwest" };
  function metres(doc, u) { var m = u * doc.frame.mPerUnit; return m < 100 ? Math.round(m / 5) * 5 : Math.round(m / 10) * 10; }
  function where(doc, ref, x, y) { var d = G.dist([ref.x, ref.y], [x, y]); if (d * doc.frame.mPerUnit < 25) return ref.at; return metres(doc, d) + " m " + G.bearing([ref.x, ref.y], [x, y]).name + " of " + ref.word; }
  var COVER_WORD = { wood: "wood", thicket: "thicket", crag: "crags", rock: "bare rock", bog: "bog", snow: "snow", reeds: "reeds", scree: "scree", dunes: "dunes" };

  function buildWild(doc) {
    var lines = [], facts = [], ref = NS.wild.reference(doc), S = doc.site, T = NS.wild.TERRAINS[doc.kind], WT = doc.water, A = doc.frame.width * doc.frame.height;
    lines.push(NS.wild.intro(doc));
    facts.push({ kind: "wild", name: doc.title.name, terrain: doc.kind, within: S.within, region: S.regionName, zone: S.zone ? S.zone.id : null, near: S.near, reference: ref.word });
    var rise = Math.round((doc.relief.high - doc.relief.low) * doc.relief.height * doc.frame.mPerUnit / 5) * 5;
    lines.push("The ground is " + T.word + (rise >= 10 ? ", rising some " + rise + " m from its lowest to its highest" : ", nearly flat") + ".");
    /* the water */
    var w = [];
    if (S.coast) w.push("the sea" + (S.seaName ? " (" + S.seaName + ")" : "") + " lies to the " + WORD[S.coast.bearing]);
    if (S.lake) w.push("a lake" + (S.lake.name ? " (" + S.lake.name + ")" : "") + " lies to the " + WORD[S.lake.bearing]);
    /* a river: where it comes from and where it goes — an edge, or what it ends in here (the sea, a lake, another river, a pool) */
    var ENDS = { sea: "into the sea", lake: "into the lake", river: "into the river", pool: "into a pool, where it sinks" };
    NS.wild.rivers(doc).forEach(function (v, vi) {
      var wide = Math.round(v.widthM || S.river.width), name = v.name || (vi ? "another river" : "a river");
      if (v.from && v.to) w.push(name + ", " + wide + " m wide, runs through from the " + WORD[v.from] + " to the " + WORD[v.to]);
      else w.push(name + ", " + wide + " m wide, " + (v.from ? "comes in from the " + WORD[v.from] : "rises here") + " and runs " + (v.to ? "off to the " + WORD[v.to] : ENDS[v.endsIn] || "out"));
    });
    WT.streams.forEach(function (s) { var head = doc.features.filter(function (f) { return f.kind === "spring" && G.dist([f.x, f.y], s.head) < 3; })[0], pool = s.to ? WT.pools.filter(function (p) { return p.id === s.to; })[0] : null, pf = pool ? doc.features.filter(function (f) { return f.pool === pool.id; })[0] : null; w.push("a brook rises " + (head ? "at " + head.name : where(doc, ref, s.head[0], s.head[1])) + " and runs " + (s.endsIn === "pool" ? "into " + (pf ? pf.name : "a pool " + where(doc, ref, pool.x, pool.y)) : s.endsIn === "river" ? "into the river" : s.endsIn === "sea" ? "down to the sea" : "off the " + WORD[G.bearing([doc.frame.width / 2, doc.frame.height / 2], s.pts[s.pts.length - 1]).name] + " edge")); });
    var plainPools = WT.pools.filter(function (p) { return !doc.features.some(function (f) { return f.pool === p.id; }); });
    if (plainPools.length) w.push(plainPools.length === 1 ? "a pool lies " + where(doc, ref, plainPools[0].x, plainPools[0].y) : plainPools.length + " pools of standing water lie about");
    if (w.length) lines.push(U.titleCase(w[0].charAt(0)) + w[0].slice(1) + (w.length > 1 ? "; " + w.slice(1).join("; ") : "") + ".");
    else lines.push("There is no water here.");
    facts.push({ kind: "water", coast: S.coast ? S.coast.bearing : null, lake: S.lake ? S.lake.bearing : null, river: WT.river ? { name: WT.river.name, from: WT.river.from, to: WT.river.to, widthM: WT.river.widthM || S.river.width } : null, rivers: NS.wild.rivers(doc).length, streams: WT.streams.length, pools: WT.pools.length });
    /* the track */
    doc.paths.forEach(function (p) {
      var word = p.kind === "causeway" ? "a causeway" : p.kind === "road" ? "a road" : p.kind === "track" ? "a track" : "a trail", txt = U.titleCase(word.charAt(0)) + word.slice(1);
      /* a way from edge to edge crosses; one that begins or ends inside runs between what stands there: the settlement, another way, a spot of its own */
      function endAt(q) {
        var pl = S.place && G.dist(q, [S.place.x, S.place.y]) < 12 ? S.place.name : null, other = doc.paths.filter(function (o) { return o !== p && M.distToPolyline(q, o.pts) < 3; })[0], by = null, bd = 45, mid = [doc.frame.width / 2, doc.frame.height / 2];
        doc.features.forEach(function (ft) { var dd = G.dist(q, [ft.x, ft.y]); if (dd < bd) { bd = dd; by = ft; } });
        return pl || (other ? "the " + other.kind : by ? by.name : G.dist(q, mid) < 90 ? "the middle of the zone" : "the " + WORD[G.bearing(mid, q).name] + " of the zone");
      }
      var a = p.pts[0], b = p.pts[p.pts.length - 1], ea = p.from ? null : endAt(a), eb = p.to ? null : endAt(b);
      if (p.from && p.to) txt += " crosses from the " + WORD[p.from] + (p.towards.from ? " (from " + p.towards.from + ")" : "") + " to the " + WORD[p.to] + (p.towards.to ? " (to " + p.towards.to + ")" : "");
      else if (p.from || p.to) { var edge = p.from || p.to, far = p.from ? p.towards.from : p.towards.to, inner = p.from ? eb : ea; txt += " comes in from the " + WORD[edge] + (far ? " (from " + far + ")" : "") + " to " + inner; }
      else txt += " runs from " + ea + " to " + eb;
      if (p.crossings.length) txt += ", crossing the river by " + (p.crossings[0].kind === "bridge" ? "a bridge" : p.crossings[0].kind === "plank" ? "a plank bridge" : "a ford") + (p.crossings.length > 1 ? " and again further on" : "");
      lines.push(txt + ".");
      facts.push({ kind: "path", id: p.id, pathKind: p.kind, from: p.from, to: p.to, towards: p.towards, crossings: p.crossings.map(function (c) { return c.kind; }) });
    });
    /* the cover: the share of the ground each kind takes (a clearing is a hole: its polygon turns the other way) */
    var share = {}, sign = {};
    doc.cover.forEach(function (c) { var a = G.signedArea(c.poly); if (sign[c.kind] === undefined) sign[c.kind] = a < 0 ? -1 : 1; share[c.kind] = (share[c.kind] || 0) + a * sign[c.kind]; });
    var cv = Object.keys(share).filter(function (k) { return share[k] / A >= 0.03; }).sort(function (a, b) { return share[b] - share[a]; }).map(function (k) { return (COVER_WORD[k] || k) + " over about " + Math.round(share[k] / A * 20) * 5 + "%"; });
    if (cv.length) lines.push("Cover: " + cv.join(", ") + " of the ground.");
    var stamps = {}; doc.glyphs.forEach(function (g) { stamps[g.k] = (stamps[g.k] || 0) + 1; });
    facts.push({ kind: "cover", shares: Object.keys(share).map(function (k) { return { cover: k, share: U.round(share[k] / A, 2) }; }), stamps: stamps });
    /* the points of interest */
    if (doc.features.length) {
      lines.push("");
      doc.features.forEach(function (f) {
        var K = NS.wild.CATALOGUE[f.kind] || NS.wild.CATALOGUE.custom, wd = f.custom ? f.word : K.word;
        lines.push(f.name + " (" + wd + ") " + (K.makes && K.makes.pool ? "lies " : "stands ") + where(doc, ref, f.x, f.y) + "." + (f.note ? " Note: " + f.note : ""));
        facts.push({ kind: "feature", id: f.id, featureKind: f.kind, word: wd, name: f.name, bearing: G.bearing([ref.x, ref.y], [f.x, f.y]).name, metres: metres(doc, G.dist([ref.x, ref.y], [f.x, f.y])), authored: !!f.authored, renamed: !!f.renamed, note: f.note || null });
      });
    }
    /* the ways on */
    var ways = [];
    doc.portals.forEach(function (p) {
      if (p.kind === "edge") { var via = p.via ? doc.paths.filter(function (q) { return q.id === p.via; })[0] : null; ways.push(WORD[p.bearing] + (via ? " by the " + via.kind : "") + (p.towards ? " toward " + p.towards : "") + (p.to.id ? "" : " (the edge of the map)")); }
      else if (p.kind === "cave") lines.push("A cave mouth, " + p.name + ", opens " + where(doc, ref, p.x, p.y) + "; the caves behind it are their own map.");
      else if (p.kind === "place") lines.push(p.name + " stands " + (ref.word === p.name ? "here" : where(doc, ref, p.x, p.y)) + "; the town has its own plan.");
      facts.push({ kind: "portal", id: p.id, portalKind: p.kind, way: p.way, bearing: p.bearing || G.bearing([ref.x, ref.y], [p.x, p.y]).name, metres: metres(doc, G.dist([ref.x, ref.y], [p.x, p.y])), to: p.to });
    });
    lines.push("Ways on: " + ways.join("; ") + ".");
    return { text: lines.join("\n"), facts: facts };
  }
  NS.digest.DIGESTS.wild = buildWild;
})(typeof self !== "undefined" ? self : typeof global !== "undefined" ? global : this);

/* ───── 60-style.js ───── */
/* 60-style.js — the STYLE TABLE. A style is one entry: paper and ink, a path style per drawing key, a text style per
   label key. Renderers never hold a colour or a width; they look keys up here. Adding a palette is adding an entry. */
(function (root) {
  "use strict";
  var NS = root.TnDMaps;
  var SERIF = "Georgia, 'Palatino Linotype', 'Book Antiqua', 'Times New Roman', serif";

  function inkStyle() {
    var ink = "#2a2219", paper = "#f2e8d3", sea = "#e8dcc0", land = "#f6efdc", soft = "#5a4a38", ward = "#e4d8bc", house = "#d3c4a4", stone = "#bfae8c", pond = "#d9cba8", red = "#8a2e1e";
    return {
      name: "ink", paper: paper, ink: ink,
      paths: {
        sea: { fill: sea },
        ripple0: { stroke: ink, width: 0.75, alpha: 0.5 },
        ripple1: { stroke: ink, width: 0.6, alpha: 0.34 },
        ripple2: { stroke: ink, width: 0.5, alpha: 0.2 },
        land: { fill: land, stroke: ink, width: 1.7, fillRule: "evenodd", join: "round" },
        lake: { fill: sea, stroke: ink, width: 1.1, join: "round" },
        river: { fill: ink },
        road: { stroke: ink, width: 1.0, dash: [4, 3], cap: "round" },
        track: { stroke: ink, width: 0.75, dash: [1.5, 3], cap: "round" },
        bridge: { stroke: ink, width: 1.3, cap: "round" },
        glyph: { fill: land, stroke: ink, width: 0.9, join: "round" },
        glyphLine: { stroke: ink, width: 0.65, cap: "round" },
        glyphThin: { stroke: ink, width: 0.5, cap: "round" },
        placeDot: { fill: ink },
        placeRing: { fill: land, stroke: ink, width: 1.4 },
        placeRingThin: { stroke: ink, width: 0.8 },
        caveMouth: { fill: ink, stroke: ink, width: 0.8, join: "round" },
        caveMouthLine: { stroke: ink, width: 0.9, cap: "round" },
        frame: { stroke: ink, width: 2.2 },
        frameInner: { stroke: ink, width: 0.7 },
        rule: { stroke: ink, width: 0.9 },
        scaleBox: { fill: ink, stroke: ink, width: 0.8 },
        scaleBoxEmpty: { fill: land, stroke: ink, width: 0.8 },
        compass: { fill: land, stroke: ink, width: 0.9 },
        compassDark: { fill: ink, stroke: ink, width: 0.9 },
        /* town scale */
        water: { fill: pond, stroke: ink, width: 1.3, join: "round" },
        riverBand: { fill: pond, stroke: ink, width: 0.9, join: "round" },
        hatch: { stroke: ink, width: 0.45, alpha: 0.5 },
        hedge: { stroke: ink, width: 0.6, alpha: 0.75, join: "round" },
        hedgeSoft: { stroke: ink, width: 0.5, alpha: 0.45, dash: [2, 2.5], join: "round" },
        parkEdge: { stroke: ink, width: 0.55, alpha: 0.7, dash: [1.6, 2.2], join: "round" },
        parkFill: { fill: land, join: "round" },
        roadBand: { fill: paper, stroke: ink, width: 0.7, join: "round" },
        ward: { fill: ward, stroke: ward, width: 0.6, join: "round" },
        streetMain: { stroke: paper, width: 8, cap: "round", join: "round" },
        street: { stroke: paper, width: 5, cap: "round", join: "round" },
        lane: { stroke: paper, width: 3.4, cap: "round", join: "round" },
        building: { fill: house, stroke: ink, width: 0.75, join: "round" },
        buildingInn: { fill: stone, stroke: ink, width: 0.9, join: "round" },
        landmarkBuilding: { fill: stone, stroke: ink, width: 1.1, join: "round" },
        keepWall: { fill: ward, stroke: ink, width: 2.4, join: "round" },
        wall: { stroke: ink, width: 3.2, cap: "butt", join: "round" },
        tower: { fill: paper, stroke: ink, width: 1.2 },
        gateMark: { fill: ink, stroke: ink, width: 0.8 },
        quay: { stroke: ink, width: 2.2, cap: "butt", join: "round" },
        pier: { fill: paper, stroke: ink, width: 0.8, join: "round" },
        well: { fill: paper, stroke: ink, width: 1.0 },
        mark: { stroke: ink, width: 1.0, cap: "round" },
        /* dungeon scale: the wall is the ink left between an ink copy of every floor shape and the paper floor over it */
        dgWall: { fill: ink, stroke: ink, width: 3.0, join: "round" },
        dgFloor: { fill: paper, join: "round" },
        dgHatch: { stroke: ink, width: 0.55, alpha: 0.6, cap: "round" },
        dgChannel: { fill: pond, stroke: ink, width: 0.45, alpha: 0.9, join: "round" },
        dgPool: { fill: pond, stroke: ink, width: 0.6, join: "round" },
        dgWaterInk: { fill: ink, stroke: ink, width: 1.2, join: "round" },
        dgWaterFill: { fill: pond, join: "round" },
        dgMark: { stroke: ink, width: 1.0, cap: "round", join: "round" },
        dgDoor: { fill: ink, stroke: ink, width: 0.5, join: "round" },
        dgGrid: { stroke: ink, width: 0.22, alpha: 0.32, cap: "butt" },
        above: { stroke: ink, width: 1.2, alpha: 0.22, dash: [6, 4], join: "round" },
        /* interior scale: the footprint in ink, the floors in paper over it (the walls are the ink between), the openings
           in paper through the walls, leaves and swings, the furniture in paper with ink lines */
        inWall: { fill: ink, stroke: ink, width: 0.5, join: "round" },
        inFloor: { fill: paper, join: "round" },
        inCourt: { fill: land, join: "round" },
        inVoid: { fill: paper, join: "round" },
        inHatch: { stroke: ink, width: 0.3, alpha: 0.45, cap: "round" },
        inOpen: { fill: paper },
        inLine: { stroke: ink, width: 0.5, cap: "round", join: "round" },
        inLeaf: { stroke: ink, width: 0.9, cap: "round" },
        inArc: { stroke: ink, width: 0.35, dash: [1, 1], cap: "round" },
        inBar: { stroke: ink, width: 1.0, cap: "round" },
        inFix: { fill: paper, stroke: ink, width: 0.55, join: "round" },
        inFixInk: { fill: ink, stroke: ink, width: 0.4, join: "round" },
        aboveWater: { stroke: ink, width: 0.8, alpha: 0.2, dash: [2, 3], join: "round" },
        /* the wild: form lines, the cover (a wood's tint under its dotted edge, stone for crags and outcrops, bog dashes,
           snow), the brooks, a track's dashes and a trail's dots, a causeway's cross ticks, the marks of its features */
        formLine: { stroke: ink, width: 0.45, alpha: 0.3, join: "round" },
        woodFill: { fill: "#e8ddc0", fillRule: "evenodd" },
        thicketFill: { fill: "#dccfae", fillRule: "evenodd" },
        woodEdge: { stroke: ink, width: 0.55, alpha: 0.6, dash: [1.4, 2.2], join: "round" },
        crag: { fill: stone, stroke: ink, width: 0.9, fillRule: "evenodd", join: "round" },
        rockFill: { fill: "#cdbf9e", stroke: ink, width: 0.7, fillRule: "evenodd", join: "round" },
        wildHachure: { stroke: ink, width: 0.5, alpha: 0.7, cap: "round" },
        bogEdge: { stroke: ink, width: 0.45, alpha: 0.4, dash: [1, 2.6], fillRule: "evenodd", join: "round" },
        bogHatch: { stroke: ink, width: 0.45, alpha: 0.45, dash: [3.5, 6] },
        snow: { fill: "#fbf7ee", stroke: ink, width: 0.5, alpha: 0.9, dash: [1, 2.4], fillRule: "evenodd", join: "round" },
        streamBand: { fill: pond, stroke: ink, width: 0.55, join: "round" },
        pool: { fill: pond, stroke: ink, width: 0.7, fillRule: "evenodd", join: "round" },
        wildTrack: { stroke: ink, width: 1.0, dash: [4.5, 3], cap: "round", join: "round" },
        wildTrail: { stroke: ink, width: 0.7, dash: [1.5, 3.2], cap: "round", join: "round" },
        wildCauseway: { stroke: ink, width: 0.6, cap: "round" },
        wildMark: { stroke: ink, width: 0.9, cap: "round", join: "round" },
        wildMarkFill: { fill: house, stroke: ink, width: 0.8, join: "round" },
        wildMarkInk: { fill: ink, stroke: ink, width: 0.5, join: "round" },
        wildWall: { stroke: ink, width: 1.5, cap: "round", join: "round" },
        wildPoolMark: { fill: pond, stroke: ink, width: 0.7 },
        /* label slips: the parchment under a name — a nailed plaque, a ribbon banner or a plain slip (70-scene SLIPS) */
        slip: { fill: land, stroke: ink, width: 0.7, join: "round" },
        slipSea: { fill: sea, stroke: ink, width: 0.7, join: "round" },
        slipNail: { fill: ink },
        slipFold: { fill: soft, stroke: ink, width: 0.5, join: "round" },
        /* icons beside a name (61-icons) */
        icon: { fill: land, stroke: ink, width: 0.65, join: "round" },
        iconInk: { fill: ink, stroke: ink, width: 0.4, join: "round" },
        iconLine: { stroke: ink, width: 0.7, cap: "round", join: "round" },
        /* markers: the party, its members, new places, notes — drawn over the finished map */
        markerInk: { fill: ink, stroke: ink, width: 0.8, join: "round" },
        markerRed: { fill: red, stroke: ink, width: 0.9, join: "round" },
        markerPaper: { fill: paper, stroke: ink, width: 0.9, join: "round" },
        markerLine: { stroke: ink, width: 1.1, cap: "round" },
        markerFoot: { fill: red, stroke: paper, width: 0.8 }
      },
      text: {
        title: { font: SERIF, size: 30, weight: "bold", letterSpacing: 5, transform: "uppercase", fill: ink, halo: paper, haloWidth: 5 },
        subtitle: { font: SERIF, size: 11, style: "italic", letterSpacing: 2, fill: soft, halo: paper, haloWidth: 3 },
        /* back: { shape: banner | plaque | plain, s: the slip's path key } — the parchment drawn under the name */
        labelCity: { font: SERIF, size: 15, weight: "bold", letterSpacing: 1.6, transform: "uppercase", fill: ink, halo: land, haloWidth: 3.5, back: { shape: "banner", s: "slip" } },
        labelTown: { font: SERIF, size: 12.5, letterSpacing: 1, fill: ink, halo: land, haloWidth: 3, back: { shape: "plaque", s: "slip" } },
        labelVillage: { font: SERIF, size: 10.5, fill: ink, halo: land, haloWidth: 3, back: { shape: "plaque", s: "slip" } },
        labelCave: { font: SERIF, size: 9.5, style: "italic", letterSpacing: 0.4, fill: soft, halo: land, haloWidth: 2.6, back: { shape: "plaque", s: "slip" } },
        labelSea: { font: SERIF, size: 17, style: "italic", letterSpacing: 5, fill: soft, halo: sea, haloWidth: 3, back: { shape: "plain", s: "slipSea" } },
        labelFeature: { font: SERIF, size: 12, style: "italic", letterSpacing: 2.5, fill: soft, halo: land, haloWidth: 3, back: { shape: "plaque", s: "slip" } },
        labelLake: { font: SERIF, size: 10, style: "italic", letterSpacing: 1, fill: soft, halo: sea, haloWidth: 2.5, back: { shape: "plain", s: "slipSea" } },
        labelRiver: { font: SERIF, size: 9.5, style: "italic", letterSpacing: 1, fill: soft, halo: land, haloWidth: 2.5, back: { shape: "plain", s: "slip" } },
        small: { font: SERIF, size: 9.5, letterSpacing: 0.5, fill: ink, halo: paper, haloWidth: 2.5 },
        labelLandmark: { font: SERIF, size: 10.5, letterSpacing: 0.6, fill: ink, halo: paper, haloWidth: 2.6, back: { shape: "banner", s: "slip" } },
        labelGate: { font: SERIF, size: 9.5, style: "italic", letterSpacing: 0.5, fill: soft, halo: paper, haloWidth: 2.4, back: { shape: "plain", s: "slip" } },
        labelShop: { font: SERIF, size: 8.5, style: "italic", fill: soft, halo: paper, haloWidth: 2.2, back: { shape: "plaque", s: "slip" } },
        labelRoom: { font: SERIF, size: 9.5, style: "italic", letterSpacing: 0.3, fill: ink, halo: paper, haloWidth: 2.4, back: { shape: "plaque", s: "slip" } },
        /* a built place (a crypt, the dungeons) is a tenth the size of the sewers under a town and its chambers stand wall to wall: its chambers are NUMBERED on the plan (the plaque shows on a hover or a press), its way up on a banner at three quarters */
        labelNumber: { font: SERIF, size: 4.6, weight: "bold", fill: ink, halo: paper, haloWidth: 1.6 },
        labelPortalSmall: { font: SERIF, size: 8, letterSpacing: 0.5, fill: ink, halo: paper, haloWidth: 2, back: { shape: "banner", s: "slip" } },
        labelFloor: { font: SERIF, size: 11, style: "italic", letterSpacing: 2.5, fill: soft, halo: paper, haloWidth: 2.6 },
        labelDistrict: { font: SERIF, size: 13, style: "italic", letterSpacing: 3, fill: soft, halo: paper, haloWidth: 2.6, back: { shape: "plaque", s: "slip" } },
        /* the town's own label sizes: its sheet is 800 × 550 at 1.25 m a unit, half the region's, so its labels are three quarters the size */
        townLandmark: { font: SERIF, size: 8, letterSpacing: 0.5, fill: ink, halo: paper, haloWidth: 2.1, back: { shape: "banner", s: "slip" } },
        townGate: { font: SERIF, size: 7.2, style: "italic", letterSpacing: 0.4, fill: soft, halo: paper, haloWidth: 1.9, back: { shape: "plain", s: "slip" } },
        townShop: { font: SERIF, size: 6.5, style: "italic", fill: soft, halo: paper, haloWidth: 1.8, back: { shape: "plaque", s: "slip" } },
        townDistrict: { font: SERIF, size: 10, style: "italic", letterSpacing: 2.3, fill: soft, halo: paper, haloWidth: 2.1, back: { shape: "plaque", s: "slip" } },
        townRoad: { font: SERIF, size: 7.2, style: "italic", letterSpacing: 0.4, fill: soft, halo: paper, haloWidth: 1.9, back: { shape: "plain", s: "slip" } },
        townRiver: { font: SERIF, size: 7.2, style: "italic", letterSpacing: 0.8, fill: soft, halo: land, haloWidth: 2, back: { shape: "plain", s: "slip" } },
        townSea: { font: SERIF, size: 12.5, style: "italic", letterSpacing: 3.8, fill: soft, halo: sea, haloWidth: 2.4, back: { shape: "plain", s: "slipSea" } },
        townLake: { font: SERIF, size: 8, style: "italic", letterSpacing: 0.8, fill: soft, halo: sea, haloWidth: 2, back: { shape: "plain", s: "slipSea" } },
        labelRoad: { font: SERIF, size: 9.5, style: "italic", letterSpacing: 0.5, fill: soft, halo: paper, haloWidth: 2.4, back: { shape: "plain", s: "slip" } },
        wildFeature: { font: SERIF, size: 7.5, style: "italic", letterSpacing: 0.3, fill: ink, halo: paper, haloWidth: 2, back: { shape: "plaque", s: "slip" } },
        labelMarker: { font: SERIF, size: 11, weight: "bold", letterSpacing: 0.4, fill: red, halo: paper, haloWidth: 2.6, back: { shape: "plaque", s: "slip" } },
        labelMarkerNote: { font: SERIF, size: 9.5, style: "italic", fill: ink, halo: paper, haloWidth: 2.4, back: { shape: "plain", s: "slip" } },
        compass: { font: SERIF, size: 11, weight: "bold", fill: ink, halo: land, haloWidth: 2.5 }
      }
    };
  }

  /* ADVANCES: the advance width of every Latin-1 character (codes 32–126, then 160–255) in 1/1000 em, measured once
     in Chrome with dev/measure-font.js for Georgia regular (r), bold (b), italic (i) and bold italic (bi). Label layout
     uses this table, never a live measurement, so it is identical in every backend and on every machine; the
     renderers force the drawn text to the width it predicts. */
  var ADVANCES = {
    r: "241,331,412,643,610,817,710,215,375,375,472,643,270,374,270,469,614,430,559,552,565,528,566,502,596,566,313,313,643,643,643,479,929,671,654,642,749,653,599,725,815,390,518,694,604,927,767,744,610,744,702,561,619,756,667,976,710,615,602,375,469,375,643,643,500,504,560,454,574,483,325,509,582,293,292,536,286,881,591,539,571,560,410,432,345,575,497,737,505,492,444,430,375,430,643,241,331,555,622,571,615,375,500,500,942,500,581,643,0,942,643,419,643,500,500,500,566,500,279,500,500,500,581,1050,1050,1050,479,671,671,671,671,671,671,971,642,653,653,653,653,390,390,390,390,749,767,744,744,744,744,744,643,744,756,756,756,756,615,614,548,504,504,504,504,504,504,737,454,483,483,483,483,293,293,293,293,532,591,539,539,539,539,539,643,539,575,575,575,575,492,559,492",
    b: "254,376,510,703,641,879,799,269,447,447,482,703,328,379,328,472,701,490,626,625,649,599,648,554,676,648,367,367,703,703,703,548,967,758,757,715,834,721,671,807,913,446,595,817,686,1023,839,820,701,820,797,649,684,833,762,1126,809,732,689,447,472,447,703,703,500,596,646,531,663,572,393,577,680,354,346,632,344,1016,690,636,658,648,520,513,397,677,567,863,588,562,525,500,388,500,703,254,376,605,690,703,732,388,563,500,942,552,610,703,0,942,703,420,703,552,552,500,668,549,338,500,552,552,610,1071,1071,1071,548,758,758,758,758,758,758,1070,715,721,721,721,721,446,446,446,446,834,839,820,820,820,820,820,703,820,833,833,833,833,732,708,658,596,596,596,596,596,596,857,531,572,572,572,572,354,354,354,354,638,690,636,636,636,636,636,703,636,677,677,677,677,562,645,562",
    i: "241,331,412,643,610,817,710,215,375,375,472,643,270,374,270,469,614,430,559,552,565,528,566,497,596,566,384,384,643,643,643,479,929,671,654,642,749,653,599,725,815,390,518,694,604,927,767,730,610,730,702,561,619,756,667,976,710,615,602,375,469,375,643,643,500,573,554,454,575,472,329,573,563,297,291,528,285,879,590,537,578,555,461,431,347,575,538,822,501,560,444,430,375,430,643,241,331,555,622,571,615,375,500,500,942,500,581,643,0,942,596,419,643,500,500,500,567,500,279,500,500,500,581,1050,1050,1050,479,671,671,671,671,671,671,971,642,653,653,653,653,390,390,390,390,749,767,730,744,730,730,744,643,744,756,756,756,756,615,614,542,573,573,573,573,573,573,764,454,472,472,472,472,297,297,297,297,546,590,537,537,537,537,537,643,537,575,575,575,575,560,553,560",
    bi: "254,376,510,703,641,879,799,269,447,447,482,703,328,379,328,472,701,490,626,625,649,599,648,566,676,648,367,367,703,703,703,548,967,758,759,715,834,721,671,807,913,451,595,817,686,1033,830,820,706,820,797,653,684,833,762,1126,802,732,689,447,472,447,703,703,500,660,649,536,663,557,381,649,675,366,365,641,354,1002,690,636,663,650,534,517,417,685,612,934,583,669,517,500,388,500,703,254,376,605,690,703,732,388,563,500,942,552,610,703,0,942,703,420,703,552,552,500,677,622,338,500,552,552,610,1071,1071,1071,548,758,758,758,758,758,758,1075,715,721,721,721,721,446,446,446,451,834,830,820,820,820,820,820,703,820,833,833,833,833,732,708,656,660,660,660,660,660,660,856,536,557,557,557,557,366,366,366,366,637,690,636,636,636,636,636,703,636,685,685,685,685,669,647,669"
  };
  var ADV = {}; Object.keys(ADVANCES).forEach(function (k) { ADV[k] = ADVANCES[k].split(",").map(Number); });

  var STYLES = { ink: inkStyle() };

  function get(name) {
    var s = NS.own(STYLES, name || "ink");
    NS.assert(s, "unknown style", { style: name, known: Object.keys(STYLES) });
    return s;
  }
  /* the advance width of a string in px at the text style's size: the ADVANCES table for the face the style names,
     a serif-shaped guess for a character outside Latin-1 */
  function advance(code, row) {
    if (code >= 32 && code <= 126) return row[code - 32];
    if (code >= 160 && code <= 255) return row[code - 65];
    return code < 32 ? 0 : 560;
  }
  function textWidth(text, ts) {
    var t = ts.transform === "uppercase" ? String(text).toUpperCase() : String(text), row = ADV[(ts.weight === "bold" ? "b" : "") + (ts.style === "italic" ? "i" : "")] || ADV.r, w = 0, i;
    for (i = 0; i < t.length; i++) w += advance(t.charCodeAt(i), row);
    return w * ts.size / 1000 + Math.max(0, t.length - 1) * (ts.letterSpacing || 0);
  }

  NS.style = { STYLES: STYLES, ADVANCES: ADVANCES, get: get, textWidth: textWidth, names: function () { return Object.keys(STYLES); } };
})(typeof self !== "undefined" ? self : typeof global !== "undefined" ? global : this);

/* ───── 61-icons.js ───── */
/* 61-icons.js — the ICON TABLE: tiny ink pictograms that sit beside a name on its slip (a flask for the apothecary,
   an anvil for the smith, a tankard for the inn) so a crowded town plan still reads at a glance. Each icon draws into
   a box of height s centred on (cx, cy), y down, with the style keys icon (paper fill, ink line), iconInk, iconLine.
   Adding an icon is adding an entry; a label without an icon is the normal case. */
(function (root) {
  "use strict";
  var NS = root.TnDMaps;

  function P(pts, s) { return { t: "path", pts: pts, closed: true, s: s || "icon" }; }
  function L(pts, s) { return { t: "path", pts: pts, closed: false, s: s || "iconLine" }; }
  function C(x, y, r, s) { return { t: "circle", x: x, y: y, r: r, s: s || "icon" }; }
  function arc(cx, cy, r, a0, a1, n) { var out = [], k, a; for (k = 0; k <= n; k++) { a = a0 + (a1 - a0) * k / n; out.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); } return out; }
  function star(cx, cy, ro, ri, n) { var out = [], k, a, r; for (k = 0; k < n * 2; k++) { a = -Math.PI / 2 + k * Math.PI / n; r = k % 2 ? ri : ro; out.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); } return out; }

  /* every drawer works in a 10×10 box: u = s / 10, origin at the centre, y down */
  var ICONS = {
    flask: { word: "apothecary, alchemist", draw: function (o) { o.push(P([[-1.5, -5], [1.5, -5], [1.5, -2], [4.6, 4], [4.6, 5], [-4.6, 5], [-4.6, 4], [-1.5, -2]])); o.push(L([[-3.7, 2.2], [3.7, 2.2]])); } },
    anvil: { word: "blacksmith", draw: function (o) { o.push(P([[-5, -2.5], [5, -2.5], [5, -1], [2, 0.3], [2, 3], [4, 4.3], [4, 5], [-4, 5], [-4, 4.3], [-2, 3], [-2, 0.3], [-4, -0.6], [-5, -1.4]], "iconInk")); } },
    hammer: { word: "carpenter, mason", draw: function (o) { o.push(P([[-1.2, -1.5], [1.2, -1.5], [2.2, 5], [-0.2, 5]])); o.push(P([[-4.5, -4.5], [2, -4.5], [2, -1.5], [-4.5, -1.5]], "iconInk")); } },
    dagger: { word: "thieves' guild", draw: function (o) { o.push(P([[0, 5], [-1.2, 2.6], [-1, -1.4], [1, -1.4], [1.2, 2.6]])); o.push(P([[-3, -1.4], [3, -1.4], [3, -2.6], [-3, -2.6]], "iconInk")); o.push(P([[-0.8, -2.6], [0.8, -2.6], [0.8, -4.4], [-0.8, -4.4]], "iconInk")); o.push(C(0, -4.5, 0.8, "iconInk")); } },
    sword: { word: "weaponsmith, barracks", draw: function (o) { o.push(P([[0, -5], [1, -3.5], [0.9, 1.5], [-0.9, 1.5], [-1, -3.5]])); o.push(P([[-3.2, 1.5], [3.2, 1.5], [3.2, 2.5], [-3.2, 2.5]], "iconInk")); o.push(P([[-0.7, 2.5], [0.7, 2.5], [0.7, 4.2], [-0.7, 4.2]], "iconInk")); o.push(C(0, 4.4, 0.8, "iconInk")); } },
    shield: { word: "guard, arms", draw: function (o) { o.push(P([[-4.5, -4.5], [4.5, -4.5], [4.5, 0.2], [0, 5], [-4.5, 0.2]])); o.push(L([[0, -4.5], [0, 5]])); o.push(L([[-4.5, -1], [4.5, -1]])); } },
    tankard: { word: "tavern, inn", draw: function (o) { o.push(P([[-3.6, -3.2], [2, -3.2], [2, 5], [-3.6, 5]])); o.push(L([[2, -1.6], [4.2, -1.6], [4.2, 3], [2, 3]])); o.push(L([[-3.6, 0.2], [2, 0.2]])); } },
    bread: { word: "baker", draw: function (o) { var pts = arc(0, 1, 4.6, Math.PI, Math.PI * 2, 10); pts.push([4.6, 3.2], [-4.6, 3.2]); o.push(P(pts)); o.push(L([[-2.6, -1.5], [-1.6, 0.4]])); o.push(L([[-0.5, -2.2], [0.5, -0.3]])); o.push(L([[1.6, -1.5], [2.6, 0.4]])); } },
    fish: { word: "fishmonger, docks", draw: function (o) { o.push(P([[-5, 0], [-3, -2.2], [0, -2.7], [2.5, -1.6], [3.2, 0], [2.5, 1.6], [0, 2.7], [-3, 2.2]])); o.push(P([[3, 0], [5, -2.6], [5, 2.6]])); o.push(C(-2.6, -0.6, 0.5, "iconInk")); } },
    scales: { word: "market, merchant", draw: function (o) { o.push(L([[0, -5], [0, 5]])); o.push(L([[-2.5, 5], [2.5, 5]])); o.push(L([[-4, -3], [4, -3]])); o.push(L([[-4, -3], [-4.9, 0.6]])); o.push(L([[-4, -3], [-3.1, 0.6]])); o.push(L([[4, -3], [4.9, 0.6]])); o.push(L([[4, -3], [3.1, 0.6]])); o.push(P(arc(-4, 0.6, 1, 0, Math.PI, 5))); o.push(P(arc(4, 0.6, 1, 0, Math.PI, 5))); } },
    coin: { word: "bank, moneylender", draw: function (o) { o.push(C(0, 0, 4.6)); o.push(C(0, 0, 3, "iconLine")); } },
    key: { word: "locksmith, vault", draw: function (o) { o.push(C(-2.8, 0, 2, "iconLine")); o.push(L([[-0.8, 0], [5, 0]])); o.push(L([[3.2, 0], [3.2, 2.2]])); o.push(L([[4.7, 0], [4.7, 2.2]])); } },
    padlock: { word: "prison, vault", draw: function (o) { o.push(L(arc(0, 0, 2.6, Math.PI, Math.PI * 2, 8))); o.push(P([[-3.8, 0], [3.8, 0], [3.8, 5], [-3.8, 5]])); o.push(C(0, 2.4, 0.7, "iconInk")); } },
    book: { word: "library, scribe", draw: function (o) { o.push(P([[-5, -3], [0, -2], [0, 4], [-5, 3]])); o.push(P([[0, -2], [5, -3], [5, 3], [0, 4]])); o.push(L([[-3.5, -0.8], [-1.3, -0.4]])); o.push(L([[1.3, -0.4], [3.5, -0.8]])); } },
    star: { word: "mage, oracle, shrine", draw: function (o) { o.push(P(star(0, 0, 5, 2.1, 5))); } },
    eye: { word: "seer, watch", draw: function (o) { o.push(P([[-5, 0], [-2.5, -2.6], [2.5, -2.6], [5, 0], [2.5, 2.6], [-2.5, 2.6]])); o.push(C(0, 0, 1.4, "iconInk")); } },
    tree: { word: "grove, green", draw: function (o) { o.push(C(0, -1.2, 3.7)); o.push(P([[-0.8, 2.2], [0.8, 2.2], [0.8, 5], [-0.8, 5]], "iconInk")); } },
    temple: { word: "temple, church", draw: function (o) { o.push(P([[-4.5, 5], [-4.5, 0], [0, -3.4], [4.5, 0], [4.5, 5]])); o.push(L([[0, -5], [0, -2.4]])); o.push(L([[-1, -4.2], [1, -4.2]])); } },
    bell: { word: "town hall, bell tower", draw: function (o) { o.push(P([[-3.6, 3], [-3.6, 0], [-2, -4], [2, -4], [3.6, 0], [3.6, 3]])); o.push(L([[-4.6, 3], [4.6, 3]])); o.push(C(0, 4.2, 0.8, "iconInk")); } },
    tower: { word: "keep, tower", draw: function (o) { o.push(P([[-3.5, 5], [-3.5, -3], [-2, -3], [-2, -4.6], [-0.8, -4.6], [-0.8, -3], [0.8, -3], [0.8, -4.6], [2, -4.6], [2, -3], [3.5, -3], [3.5, 5]])); o.push(P([[-1, 5], [1, 5], [1, 2.4], [-1, 2.4]], "iconInk")); } },
    crown: { word: "palace, lord", draw: function (o) { o.push(P([[-4.6, 4], [-4.6, -2], [-2.3, 0.6], [0, -4.6], [2.3, 0.6], [4.6, -2], [4.6, 4]])); o.push(L([[-4.6, 2.2], [4.6, 2.2]])); } },
    gate: { word: "gate", draw: function (o) { var pts = [[-4.5, 5], [-4.5, -1]].concat(arc(0, -1, 4.5, Math.PI, Math.PI * 2, 8)); pts.push([4.5, 5]); o.push(P(pts)); o.push(L([[-2, -3.5], [-2, 5]])); o.push(L([[0, -5], [0, 5]])); o.push(L([[2, -3.5], [2, 5]])); } },
    anchor: { word: "harbour, docks", draw: function (o) { o.push(C(0, -3.8, 1, "iconLine")); o.push(L([[0, -2.8], [0, 4.6]])); o.push(L([[-3, -1.6], [3, -1.6]])); o.push(L(arc(0, 0.6, 4.4, Math.PI * 0.12, Math.PI * 0.88, 8))); } },
    horseshoe: { word: "stable, farrier", draw: function (o) { o.push(L(arc(0, 0.2, 4.4, Math.PI * 0.78, Math.PI * 2.22, 12))); o.push(C(-4, 3.6, 0.5, "iconInk")); o.push(C(4, 3.6, 0.5, "iconInk")); } },
    mill: { word: "mill", draw: function (o) { o.push(P([[-1.8, 5], [1.8, 5], [1.2, 0.4], [-1.2, 0.4]])); o.push(L([[-4.2, -4.6], [4.2, 2.6]])); o.push(L([[4.2, -4.6], [-4.2, 2.6]])); } },
    grate: { word: "sewer, drain", draw: function (o) { o.push(C(0, 0, 4.6, "iconLine")); o.push(L([[-4.2, -1.9], [4.2, -1.9]])); o.push(L([[-4.6, 0], [4.6, 0]])); o.push(L([[-4.2, 1.9], [4.2, 1.9]])); o.push(L([[0, -4.6], [0, 4.6]])); } },
    stairs: { word: "stairs", draw: function (o) { o.push(L([[-4.6, 4.4], [-4.6, 1.6], [-2.3, 1.6], [-2.3, -0.8], [0, -0.8], [0, -3.2], [2.3, -3.2], [2.3, -4.6], [4.6, -4.6]])); o.push(L([[-4.6, 4.4], [4.6, 4.4], [4.6, -4.6]])); } },
    /* the direction a way out leads: up to the surface or the level above, down into the level below */
    arrowUp: { word: "up", draw: function (o) { o.push(L([[0, 4.6], [0, -2.2]])); o.push(P([[-3, -1.2], [3, -1.2], [0, -4.8]], "iconInk")); } },
    arrowDown: { word: "down", draw: function (o) { o.push(L([[0, -4.6], [0, 2.2]])); o.push(P([[-3, 1.2], [3, 1.2], [0, 4.8]], "iconInk")); } },
    well: { word: "well, spring", draw: function (o) { o.push(C(0, 2, 3.2, "iconLine")); o.push(C(0, 2, 1.9, "iconLine")); o.push(L([[-4.6, -1], [0, -5], [4.6, -1]])); o.push(L([[-3.4, -1.6], [-3.4, 2.4]])); o.push(L([[3.4, -1.6], [3.4, 2.4]])); } },
    tent: { word: "camp", draw: function (o) { o.push(P([[0, -5], [5, 5], [-5, 5]])); o.push(P([[0, -0.6], [1.9, 5], [-1.9, 5]], "iconInk")); } },
    skull: { word: "danger, lair", draw: function (o) { o.push(C(0, -1, 3.9)); o.push(P([[-2.3, 2.2], [2.3, 2.2], [2.3, 4.6], [-2.3, 4.6]])); o.push(C(-1.5, -1.3, 0.95, "iconInk")); o.push(C(1.5, -1.3, 0.95, "iconInk")); } },
    cave: { word: "cave", draw: function (o) { var pts = [[-5, 5], [-5, 0.4]].concat(arc(0, 0.4, 5, Math.PI, Math.PI * 2, 9)); pts.push([5, 5]); o.push(P(pts)); var inner = [[-2.6, 5], [-2.6, 1]].concat(arc(0, 1, 2.6, Math.PI, Math.PI * 2, 7)); inner.push([2.6, 5]); o.push(P(inner, "iconInk")); } },
    hole: { word: "shaft, pit", draw: function (o) { o.push(C(0, 0.4, 4.6, "iconLine")); o.push(C(0, 0.4, 2.3, "iconInk")); o.push(L([[-4.6, 0.4], [-2.3, 0.4]])); o.push(L([[2.3, 0.4], [4.6, 0.4]])); o.push(L([[0, -4.2], [0, -1.9]])); } },
    door: { word: "door, a way in or out", draw: function (o) { o.push(P([[-3.6, -5], [3.6, -5], [3.6, 5], [-3.6, 5]])); o.push(P([[-2.4, -3.8], [2.4, -3.8], [2.4, 5], [-2.4, 5]], "iconInk")); o.push(C(1.3, 0.6, 0.6)); } },
    tombstone: { word: "graveyard", draw: function (o) { var pts = [[-3.6, 5], [-3.6, -1.4]].concat(arc(0, -1.4, 3.6, Math.PI, Math.PI * 2, 8)); pts.push([3.6, 5]); o.push(P(pts)); o.push(L([[0, -2.6], [0, 1.4]])); o.push(L([[-1.3, -1.2], [1.3, -1.2]])); } }
  };

  /* draw(name, cx, cy, s, out) — appends the icon's commands, scaled to a box of height s centred on (cx, cy) */
  function draw(name, cx, cy, s, out) {
    var icon = NS.own(ICONS, name); NS.assert(icon, "unknown icon", { icon: name, known: Object.keys(ICONS) });
    var items = [], u = s / 10;
    icon.draw(items);
    items.forEach(function (c) {
      if (c.t === "circle") out.push({ t: "circle", x: cx + c.x * u, y: cy + c.y * u, r: c.r * u, s: c.s });
      else out.push({ t: "path", pts: c.pts.map(function (p) { return [cx + p[0] * u, cy + p[1] * u]; }), closed: c.closed, s: c.s });
    });
    return out;
  }

  NS.icons = { ICONS: ICONS, draw: draw, names: function () { return Object.keys(ICONS); } };
})(typeof self !== "undefined" ? self : typeof global !== "undefined" ? global : this);

/* ───── 70-scene.js ───── */
/* 70-scene.js — document → SCENE: an ordered list of layers of draw commands (path / circle / text) with style keys.
   Glyphs are expanded into paths here, labels are laid out here, so every backend draws the identical picture.
   Commands: { t:"path", pts|subpaths, closed, s }  { t:"circle", x, y, r, s }  { t:"text", x, y, text, s, rot, anchor }
   plus { t:"hit", kind, id, x, y, r } for the interactive view's hit testing (renderers skip it).
   One builder per generator in the BUILDERS table (this file: region; 71-scene-town.js: town); the furniture every map
   shares — label layout, compass, scale bar, frame and title — is scene.common. */
(function (root) {
  "use strict";
  var NS = root.TnDMaps, U = NS.util, G = NS.geom;

  function jitter(x, y, salt) { return (NS.hash32(x + "," + y, salt) % 1000) / 1000 - 0.5; } /* deterministic −0.5..0.5 */

  /* ── glyph expansion ── u is the glyph unit (about half a grid step); every glyph is a few paths */
  /* u is one grid step; glyphs overlap their neighbours on purpose and are drawn back to front with a paper fill */
  function mountainGlyph(gl, u, out) {
    var s = gl.s * u, x = gl.x, y = gl.y, j1 = jitter(x, y, 1), j2 = jitter(x, y, 2), j3 = jitter(x, y, 3), j4 = jitter(x, y, 4);
    var px = x + j1 * 0.5 * s, py = y - (1.25 + j2 * 0.35) * s, lx = x - (1.15 + j3 * 0.35) * s, rx = x + (1.15 - j3 * 0.25) * s;
    var kinkL = [lx + (px - lx) * (0.5 + j4 * 0.2), y + (py - y) * (0.42 + j2 * 0.1)];
    var kinkR = [px + (rx - px) * (0.55 + j1 * 0.15), y + (py - y) * (0.38 + j3 * 0.1)];
    out.push({ t: "path", pts: [[lx, y], kinkL, [px, py], kinkR, [rx, y]], closed: false, s: "glyph", fillClose: true });
    /* ridge from the peak down the lit side, and three hatches on the shaded (right) face */
    var rbx = px + (rx - px) * 0.28, k, f;
    out.push({ t: "path", pts: [[px, py], [rbx, y]], closed: false, s: "glyphLine" });
    for (k = 0; k < 3; k++) {
      f = 0.3 + k * 0.22;
      out.push({ t: "path", pts: [[px + (rbx - px) * f, py + (y - py) * f], [px + (rx - px) * (f + 0.3), y]], closed: false, s: "glyphThin" });
    }
  }
  function hillGlyph(gl, u, out) {
    var s = gl.s * u, x = gl.x, y = gl.y, w = 1.0 * s, h = 0.42 * s, pts = [], k, a;
    for (k = 0; k <= 8; k++) { a = Math.PI * (1 - k / 8); pts.push([x + Math.cos(a) * w * (1 + jitter(x, y, k) * 0.08), y - Math.sin(a) * h * (1 + jitter(x, y, k + 9) * 0.1)]); }
    out.push({ t: "path", pts: pts, closed: false, s: "glyph", fillClose: true });
    out.push({ t: "path", pts: [[x + w * 0.3, y - h * 0.8], [x + w * 0.6, y - h * 0.25]], closed: false, s: "glyphThin" });
    out.push({ t: "path", pts: [[x + w * 0.55, y - h * 0.6], [x + w * 0.8, y - h * 0.15]], closed: false, s: "glyphThin" });
  }
  function treeGlyph(gl, u, out) {
    var s = gl.s * u, x = gl.x, r = 0.3 * s, y = gl.y - r * 1.1, pts = [], k, a, rr;
    for (k = 0; k < 10; k++) { a = Math.PI * 2 * k / 10; rr = r * (1 + jitter(x, y, k) * 0.4); pts.push([x + Math.cos(a) * rr, y + Math.sin(a) * rr * 0.92]); }
    out.push({ t: "path", pts: pts, closed: true, s: "glyph" });
    out.push({ t: "path", pts: [[x, y + r * 0.8], [x, gl.y + 0.1 * s]], closed: false, s: "glyphLine" });
    out.push({ t: "path", pts: [[x + r * 0.25, y + r * 0.1], [x + r * 0.55, y + r * 0.55]], closed: false, s: "glyphThin" });
  }
  function reedGlyph(gl, u, out) {
    var s = gl.s * u * 0.6, x = gl.x, y = gl.y;
    out.push({ t: "path", pts: [[x - 0.55 * s, y], [x + 0.55 * s, y]], closed: false, s: "glyphThin" });
    out.push({ t: "path", pts: [[x - 0.25 * s, y], [x - 0.3 * s, y - 0.45 * s]], closed: false, s: "glyphThin" });
    out.push({ t: "path", pts: [[x, y], [x, y - 0.6 * s]], closed: false, s: "glyphThin" });
    out.push({ t: "path", pts: [[x + 0.25 * s, y], [x + 0.32 * s, y - 0.4 * s]], closed: false, s: "glyphThin" });
  }
  /* the wild's stamps: a dune's crest (a crescent turned with the wind, gl.a), a boulder, a low bush, a dead tree, a palm */
  function duneGlyph(gl, u, out) {
    var s = gl.s * u * 0.9, a = gl.a || 0, c = Math.cos(a), sn = Math.sin(a), pts = [], k, t, x, y;
    for (k = 0; k <= 8; k++) { t = (k / 8 - 0.5) * Math.PI * 0.9; x = Math.sin(t) * s * 0.75; y = -Math.cos(t) * s * 0.28 + s * 0.2; pts.push([gl.x + x * c - y * sn, gl.y + x * sn + y * c]); }
    out.push({ t: "path", pts: pts, closed: false, s: "glyphLine" });
    out.push({ t: "path", pts: [pts[2], [gl.x + (pts[2][0] - gl.x) * 0.55 + sn * s * 0.12, gl.y + (pts[2][1] - gl.y) * 0.55 - c * s * 0.12]], closed: false, s: "glyphThin" });
  }
  function rockGlyph(gl, u, out) {
    var s = gl.s * u * 0.42, x = gl.x, y = gl.y, pts = [], k, a, r;
    for (k = 0; k < 6; k++) { a = Math.PI * 2 * k / 6 + jitter(x, y, k) * 0.5; r = s * (0.75 + jitter(x, y, k + 7) * 0.5); pts.push([x + Math.cos(a) * r, y + Math.sin(a) * r * 0.72]); }
    out.push({ t: "path", pts: pts, closed: true, s: "glyph" });
    out.push({ t: "path", pts: [[x + s * 0.1, y - s * 0.3], [x + s * 0.5, y + s * 0.2]], closed: false, s: "glyphThin" });
  }
  function scrubGlyph(gl, u, out) {
    var s = gl.s * u, x = gl.x, y = gl.y - 0.1 * s, pts = [], k, a, rr;
    for (k = 0; k < 9; k++) { a = Math.PI * 2 * k / 9; rr = 0.26 * s * (1 + jitter(x, y, k) * 0.45); pts.push([x + Math.cos(a) * rr, y + Math.sin(a) * rr * 0.55]); }
    out.push({ t: "path", pts: pts, closed: true, s: "glyph" });
    out.push({ t: "path", pts: [[x - s * 0.08, y + s * 0.02], [x + s * 0.02, y - s * 0.1]], closed: false, s: "glyphThin" });
  }
  function snagGlyph(gl, u, out) {
    var s = gl.s * u, x = gl.x, y = gl.y, j = jitter(x, y, 1);
    out.push({ t: "path", pts: [[x, y], [x + j * 0.1 * s, y - 0.55 * s]], closed: false, s: "glyphLine" });
    out.push({ t: "path", pts: [[x + j * 0.04 * s, y - 0.3 * s], [x - 0.22 * s, y - 0.5 * s]], closed: false, s: "glyphThin" });
    out.push({ t: "path", pts: [[x + j * 0.07 * s, y - 0.42 * s], [x + 0.2 * s, y - 0.62 * s]], closed: false, s: "glyphThin" });
  }
  function palmGlyph(gl, u, out) {
    var s = gl.s * u, x = gl.x, y = gl.y, j = jitter(x, y, 2), tx = x + j * 0.2 * s, ty = y - 0.7 * s, k, a;
    out.push({ t: "path", pts: [[x, y], [x + j * 0.1 * s, y - 0.35 * s], [tx, ty]], closed: false, s: "glyphLine" });
    for (k = 0; k < 5; k++) { a = -Math.PI * 0.9 + Math.PI * 0.8 * k / 4 + jitter(x, y, k + 3) * 0.2; out.push({ t: "path", pts: [[tx, ty], [tx + Math.cos(a) * 0.22 * s, ty + Math.sin(a) * 0.22 * s - 0.05 * s], [tx + Math.cos(a) * 0.36 * s, ty + Math.sin(a) * 0.36 * s + 0.08 * s]], closed: false, s: "glyphThin" }); }
  }
  var GLYPHS = { mtn: mountainGlyph, hill: hillGlyph, tree: treeGlyph, reed: reedGlyph, dune: duneGlyph, rock: rockGlyph, scrub: scrubGlyph, snag: snagGlyph, palm: palmGlyph };

  /* ── river ribbon: a tapered polygon from the [x, y, w] polyline ── */
  function ribbon(pts) {
    var left = [], right = [], i, n = pts.length, p, prev, next, dx, dy, len, w;
    for (i = 0; i < n; i++) {
      p = pts[i]; prev = pts[Math.max(0, i - 1)]; next = pts[Math.min(n - 1, i + 1)];
      dx = next[0] - prev[0]; dy = next[1] - prev[1]; len = Math.sqrt(dx * dx + dy * dy) || 1; w = (p[2] || 1) / 2;
      left.push([p[0] + (dy / len) * w, p[1] - (dx / len) * w]); right.push([p[0] - (dy / len) * w, p[1] + (dx / len) * w]);
    }
    return left.concat(right.reverse());
  }

  /* ── place markers ── */
  function placeMarker(p, out, hits) {
    var r = p.kind === "city" ? 5.2 : p.kind === "town" ? 3.6 : 2.3;
    if (p.kind === "village") out.push({ t: "circle", x: p.x, y: p.y, r: r, s: "placeDot" });
    else {
      out.push({ t: "circle", x: p.x, y: p.y, r: r, s: "placeRing" });
      out.push({ t: "circle", x: p.x, y: p.y, r: p.kind === "city" ? 1.9 : 1.3, s: "placeDot" });
      if (p.kind === "city") out.push({ t: "circle", x: p.x, y: p.y, r: r + 2.4, s: "placeRingThin" });
      if (p.capital) { /* four ticks: a fortified seat */
        var k, a, R1 = r + 2.4, R2 = r + 5.2;
        for (k = 0; k < 4; k++) { a = Math.PI / 4 + k * Math.PI / 2; out.push({ t: "path", pts: [[p.x + Math.cos(a) * R1, p.y + Math.sin(a) * R1], [p.x + Math.cos(a) * R2, p.y + Math.sin(a) * R2]], closed: false, s: "placeRingThin" }); }
      }
    }
    hits.push({ t: "hit", kind: "place", id: p.id, x: p.x, y: p.y, r: Math.max(9, r + 5) });
    return r;
  }

  /* ── a cave mouth: a dark arch opening in the ground, a line of ground under it ── */
  function caveMarker(c, out, hits) {
    var r = 4.4, pts = [[c.x - r, c.y + 1.2]], k, a;
    for (k = 0; k <= 10; k++) { a = Math.PI + Math.PI * k / 10; pts.push([c.x + Math.cos(a) * r * (1 + jitter(c.x, c.y, k) * 0.12), c.y + 1.2 + Math.sin(a) * r * 0.95 * (1 + jitter(c.x, c.y, k + 11) * 0.1)]); }
    out.push({ t: "path", pts: pts, closed: true, s: "caveMouth" });
    out.push({ t: "path", pts: [[c.x - r - 2.4, c.y + 1.4], [c.x + r + 2.4, c.y + 1.4]], closed: false, s: "caveMouthLine" });
    hits.push({ t: "hit", kind: "cave", id: c.id, x: c.x, y: c.y, r: 10 });
    return r;
  }

  /* ── labels on slips ── a label is a text command; its text style may name a `back` (the parchment drawn under
     the name: a nailed plaque, a ribbon banner, a plain slip) and the caller may give it an icon (61-icons). The
     geometry is computed ONCE here, in the label's own coordinates (origin at the anchor point, x along the text), and
     shared by the layout (collision box) and the command (slip polygons, icon, shifted text), so what is reserved is
     exactly what is drawn. All sizes are fractions of the font size. */
  var SLIP = { padX: 0.5, top: 0.92, bot: 0.34, iconW: 1.0, iconGap: 0.3, tail: 0.75, tailDrop: 0.2, notch: 0.3, nail: 0.07, nailInset: 0.24, wobble: 0.045 };
  function labelGeometry(text, ts, anchor, icon) {
    /* `icon`: one icon name, or a list drawn side by side before the text (a grate and the arrow of its direction) */
    var icons = icon ? [].concat(icon) : [], n = icons.length, size = ts.size, w = NS.style.textWidth(text, ts), one = size * SLIP.iconW, step = one + size * SLIP.iconGap * 0.5;
    var iw = n ? one + (n - 1) * step : 0, gap = n ? size * SLIP.iconGap : 0, uw = iw + gap + w;
    var L0 = anchor === "start" ? 0 : anchor === "end" ? -uw : -uw / 2, pad = size * SLIP.padX, banner = ts.back && ts.back.shape === "banner", tail = banner ? size * SLIP.tail : 0;
    return { size: size, w: w, iw: iw, gap: gap, L0: L0, R0: L0 + uw, pad: pad, tail: tail, top: -size * SLIP.top, bot: size * SLIP.bot, boxBot: size * SLIP.bot + (banner ? size * SLIP.tailDrop : 0),
      L: L0 - pad - tail, R: L0 + uw + pad + tail, textX: L0 + iw + gap + (anchor === "start" ? 0 : anchor === "end" ? w : w / 2), iconX: L0 + one / 2, iconStep: step, iconW: one, icons: icons, iconY: -size * 0.33 };
  }
  /* hand-drawn edges: each edge sampled, every inner point nudged across the edge by a seeded amount */
  function wobbly(poly, amp, rng) {
    var out = [], i, a, b, dx, dy, len, n, k, t, j;
    for (i = 0; i < poly.length; i++) {
      a = poly[i]; b = poly[(i + 1) % poly.length]; dx = b[0] - a[0]; dy = b[1] - a[1]; len = Math.sqrt(dx * dx + dy * dy) || 1; n = Math.max(1, Math.round(len / Math.max(3, amp * 20)));
      for (k = 0; k < n; k++) { t = k / n; j = k === 0 ? 0 : rng.range(-amp, amp); out.push([a[0] + dx * t - dy / len * j, a[1] + dy * t + dx / len * j]); }
    }
    return out;
  }
  function poly(pts, key) { return { t: "path", pts: pts, closed: true, s: key }; }
  var SLIPS = {
    plain: function (g, key, rng, amp) { return [poly(wobbly([[g.L, g.top], [g.R, g.top], [g.R, g.bot], [g.L, g.bot]], amp, rng), key)]; },
    plaque: function (g, key, rng, amp) {
      var items = SLIPS.plain(g, key, rng, amp), ins = g.size * SLIP.nailInset, r = g.size * SLIP.nail;
      [[g.L + ins, g.top + ins], [g.R - ins, g.top + ins], [g.R - ins, g.bot - ins], [g.L + ins, g.bot - ins]].forEach(function (p) { items.push({ t: "circle", x: p[0], y: p[1], r: r, s: "slipNail" }); });
      return items;
    },
    banner: function (g, key, rng, amp) {
      /* a ribbon: the band, two swallow-tailed ends hanging behind it a little lower, and the folds where it turns */
      var d = g.size * SLIP.tailDrop, tl = g.tail, notch = g.size * SLIP.notch, L = g.L + tl, R = g.R - tl, T = g.top, B = g.bot, mid = (T + B) / 2 + d, items = [];
      items.push(poly(wobbly([[L + d, T + d], [L - tl + d, T + d], [L - tl + notch + d, mid], [L - tl + d, B + d], [L + d, B + d]], amp, rng), key));
      items.push(poly(wobbly([[R - d, T + d], [R + tl - d, T + d], [R + tl - notch - d, mid], [R + tl - d, B + d], [R - d, B + d]], amp, rng), key));
      items.push(poly(wobbly([[L, T], [R, T], [R, B], [L, B]], amp, rng), key));
      items.push(poly([[L, B], [L + d, B + d], [L + d * 1.7, B]], "slipFold"));
      items.push(poly([[R, B], [R - d, B + d], [R - d * 1.7, B]], "slipFold"));
      return items;
    }
  };
  function textCommand(text, styleKey, x, y, anchor, rot, style, meta, icon) {
    var ts = style.text[styleKey]; NS.assert(ts, "style has no text key", { key: styleKey });
    anchor = anchor || "middle"; rot = rot || 0;
    var g = labelGeometry(text, ts, anchor, icon), c = Math.cos(rot), s = Math.sin(rot), items = [];
    var cmd = { t: "text", x: x + g.textX * c, y: y + g.textX * s, text: text, s: styleKey, rot: rot, anchor: anchor, width: g.w, meta: meta || null };
    if (ts.back) {
      var shape = SLIPS[ts.back.shape]; NS.assert(shape, "unknown slip shape", { shape: ts.back.shape, known: Object.keys(SLIPS) });
      items = shape(g, ts.back.s, NS.Rng("slip:" + styleKey + ":" + text), g.size * SLIP.wobble);
    }
    g.icons.forEach(function (ic, k) { NS.icons.draw(ic, g.iconX + k * g.iconStep, g.iconY, g.iconW, items); });
    if (items.length) cmd.back = items.map(function (it) {
      if (it.t === "circle") return { t: "circle", x: x + it.x * c - it.y * s, y: y + it.x * s + it.y * c, r: it.r, s: it.s };
      return { t: "path", pts: it.pts.map(function (p) { return [x + p[0] * c - p[1] * s, y + p[0] * s + p[1] * c]; }), closed: it.closed, s: it.s };
    });
    return cmd;
  }

  /* ── label layout ── greedy, collision-free against earlier labels and markers; a label that will not fit is dropped
     (and listed in scene.dropped) rather than drawn over another */
  function Layout(W, H, style, x0, y0) {
    var boxes = [], dropped = []; x0 = x0 || 0; y0 = y0 || 0;
    function box(x, y, w, h, rot) {
      /* axis-aligned bounds of a rotated w×h rectangle centred at (x, y) */
      var c = Math.abs(Math.cos(rot || 0)), s = Math.abs(Math.sin(rot || 0)), bw = w * c + h * s, bh = w * s + h * c;
      return [x - bw / 2, y - bh / 2, x + bw / 2, y + bh / 2];
    }
    function overlaps(b) { var i, o; for (i = 0; i < boxes.length; i++) { o = boxes[i]; if (b[0] < o[2] && b[2] > o[0] && b[1] < o[3] && b[3] > o[1]) return true; } return false; }
    function inside(b, pad) { pad = pad || 6; return b[0] >= x0 + pad && b[1] >= y0 + pad && b[2] <= x0 + W - pad && b[3] <= y0 + H - pad; }
    /* the slip's rectangle (label coordinates) rotated about the anchor point, as an axis-aligned box with a margin */
    function labelBox(g, x, y, rot) {
      var mx = (g.L + g.R) / 2, my = (g.top + g.boxBot) / 2, c = Math.cos(rot), s = Math.sin(rot);
      return box(x + mx * c - my * s, y + mx * s + my * c, g.R - g.L + 2, g.boxBot - g.top + 2, rot);
    }
    return {
      block: function (x, y, w, h) { boxes.push([x - w / 2, y - h / 2, x + w / 2, y + h / 2]); },
      /* try candidates [{x, y, anchor, rot}] in order; returns the placed text command or null. opts.icon names an
         icon (61-icons) drawn before the text on the same slip */
      place: function (text, styleKey, candidates, meta, opts) {
        var ts = style.text[styleKey], icon = (opts && opts.icon) || null, i, c, g, b;
        NS.assert(ts, "style has no text key", { key: styleKey });
        for (i = 0; i < candidates.length; i++) {
          c = candidates[i]; g = labelGeometry(text, ts, c.anchor || "middle", icon);
          /* a start (end) candidate names where the slip begins (ends): the anchor moves in by the padding and the tail */
          var rot = c.rot || 0, shift = c.anchor === "start" ? g.pad + g.tail : c.anchor === "end" ? -(g.pad + g.tail) : 0, ax = c.x + shift * Math.cos(rot), ay = c.y + shift * Math.sin(rot);
          b = labelBox(g, ax, ay, rot);
          if (!inside(b) || overlaps(b)) continue;
          boxes.push(b);
          var cmd = textCommand(text, styleKey, ax, ay, c.anchor, rot, style, meta, icon); cmd.box = b;   /* the slip's bounds, map coordinates */
          return cmd;
        }
        dropped.push({ text: text, style: styleKey, meta: meta || null });
        return null;
      },
      dropped: dropped
    };
  }

  /* the hit for (kind, id) also answers to clicks on the label's slip — a name is easier to aim at than a dot */
  function hitBox(hits, kind, id, box) { var i; for (i = 0; i < hits.length; i++) if (hits[i].kind === kind && hits[i].id === id) { hits[i].box = box; return; } }
  function plainText(text, key, x, y, style) { return { t: "text", x: x, y: y, text: text, s: key, rot: 0, anchor: "middle", width: NS.style.textWidth(text, style.text[key]), meta: null }; }
  function compassRose(cx, cy, r, out, style) {
    var k, a, pts;
    out.push({ t: "circle", x: cx, y: cy, r: r, s: "compass" });
    out.push({ t: "circle", x: cx, y: cy, r: r * 0.08, s: "compassDark" });
    for (k = 0; k < 4; k++) {
      a = -Math.PI / 2 + k * Math.PI / 2;
      pts = [[cx + Math.cos(a) * r * 0.95, cy + Math.sin(a) * r * 0.95], [cx + Math.cos(a + 0.35) * r * 0.22, cy + Math.sin(a + 0.35) * r * 0.22], [cx, cy], [cx + Math.cos(a - 0.35) * r * 0.22, cy + Math.sin(a - 0.35) * r * 0.22]];
      out.push({ t: "path", pts: pts, closed: true, s: k === 0 ? "compassDark" : "compass" });
    }
    for (k = 0; k < 4; k++) {
      a = -Math.PI / 4 + k * Math.PI / 2;
      out.push({ t: "path", pts: [[cx + Math.cos(a) * r * 0.55, cy + Math.sin(a) * r * 0.55], [cx + Math.cos(a + 0.5) * r * 0.14, cy + Math.sin(a + 0.5) * r * 0.14], [cx, cy], [cx + Math.cos(a - 0.5) * r * 0.14, cy + Math.sin(a - 0.5) * r * 0.14]], closed: true, s: "compass" });
    }
    out.push(plainText("N", "compass", cx, cy - r - 4, style));
  }
  /* a scale bar about a fifth of the frame wide, in km or metres; the third line is travel days (region) or minutes
     on foot at 5 km/h (town) */
  function scaleBar(frame, x, y, out, lay, style) {
    var kmPerUnit = frame.kmPerUnit, targetUnits = frame.width * 0.18, candidates = [0.002, 0.005, 0.01, 0.025, 0.05, 0.1, 0.2, 0.25, 0.5, 1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000], best = candidates[0], i;
    for (i = 0; i < candidates.length; i++) if (Math.abs(candidates[i] / kmPerUnit - targetUnits) < Math.abs(best / kmPerUnit - targetUnits)) best = candidates[i];
    var w = best / kmPerUnit, seg = w / 4, k, label = best < 1 ? Math.round(best * 1000) + " m" : best + " km";
    for (k = 0; k < 4; k++) out.push({ t: "path", pts: [[x + seg * k, y], [x + seg * (k + 1), y], [x + seg * (k + 1), y + 5], [x + seg * k, y + 5]], closed: true, s: k % 2 ? "scaleBoxEmpty" : "scaleBox" });
    out.push(plainText("0", "small", x, y - 4, style));
    out.push(plainText(label, "small", x + w, y - 4, style));
    var third = frame.travelKmPerDay ? Math.round(best / frame.travelKmPerDay * 10) / 10 + " days on foot" : best < 0.05 ? Math.round(best * 1000 / 0.75) + " paces" : Math.max(1, Math.round(best / 5 * 60)) + " min on foot";   /* a building: paces, not minutes */
    out.push(plainText(third, "small", x + w / 2, y + 16, style));
    lay.block(x + w / 2, y + 4, w + 40, 34);
  }
  /* frame, title with its rule and subtitle, compass, scale bar — in the box the scene draws (frame.x0/y0 when it is
     a window of the document, as a dungeon's is) */
  function furniture(frame, title, subtitle, style, out, lay) {
    var W = frame.width, H = frame.height, X = frame.x0 || 0, Y = frame.y0 || 0, tw = NS.style.textWidth(title, style.text.title);
    out.push({ t: "path", pts: [[X, Y], [X + W, Y], [X + W, Y + H], [X, Y + H]], closed: true, s: "frame" });
    out.push({ t: "path", pts: [[X + 7, Y + 7], [X + W - 7, Y + 7], [X + W - 7, Y + H - 7], [X + 7, Y + H - 7]], closed: true, s: "frameInner" });
    out.push(plainText(title, "title", X + W / 2, Y + 46, style));
    out.push({ t: "path", pts: [[X + W / 2 - tw / 2 - 16, Y + 56], [X + W / 2 + tw / 2 + 16, Y + 56]], closed: false, s: "rule" });
    out.push(plainText(subtitle, "subtitle", X + W / 2, Y + 72, style));
    lay.block(X + W / 2, Y + 48, tw + 60, 70);
    compassRose(X + W - 62, Y + 68, 34, out, style); lay.block(X + W - 62, Y + 66, 90, 100);
    scaleBar(frame, X + 34, Y + H - 42, out, lay, style);
  }

  /* ── the region scene ── */
  function buildRegion(doc, style) {
    var W = doc.frame.width, H = doc.frame.height, dx = W / (doc.frame.cols - 1), u = dx;
    var layers = [], hits = [], lay = Layout(W, H, style), i;
    function layer(name) { var L = { name: name, items: [] }; layers.push(L); return L.items; }

    var sea = layer("sea");
    sea.push({ t: "path", pts: [[0, 0], [W, 0], [W, H], [0, H]], closed: true, s: "sea" });
    var rip = layer("ripples");
    [2, 1, 0].forEach(function (lvl) { doc.ripples.forEach(function (r) { if (r.level === lvl) rip.push({ t: "path", pts: r.pts, closed: r.closed, s: "ripple" + lvl }); }); });
    var land = layer("land");
    if (doc.coast.length) land.push({ t: "path", subpaths: doc.coast, closed: true, s: "land" });
    var lakes = layer("lakes");
    doc.lakes.forEach(function (lk) { lakes.push({ t: "path", pts: lk, closed: true, s: "lake" }); });
    var rivers = layer("rivers");
    doc.rivers.forEach(function (r) { if (r.pts.length >= 2) rivers.push({ t: "path", pts: ribbon(r.pts), closed: true, s: "river", meta: { id: r.id } }); });
    /* glyphs back to front so a nearer stamp occludes a farther one */
    var gly = layer("glyphs"), sorted = doc.glyphs.slice().sort(function (a, b) { return a.y - b.y || a.x - b.x; });
    sorted.forEach(function (gl) { var fn = GLYPHS[gl.k]; NS.assert(fn, "unknown glyph kind", { k: gl.k }); fn(gl, u, gly); });
    var roads = layer("roads");
    doc.roads.forEach(function (r) {
      roads.push({ t: "path", pts: r.pts, closed: false, s: r.kind, meta: { id: r.id } });
      r.bridges.forEach(function (b) {
        /* two short strokes across the road direction */
        var j, best = null, bd = 1e9, pts = r.pts, d;
        for (j = 1; j < pts.length; j++) { d = G.pointSegDist(b, pts[j - 1], pts[j]); if (d < bd) { bd = d; best = j; } }
        if (best === null) return;
        var ax = pts[best][0] - pts[best - 1][0], ay = pts[best][1] - pts[best - 1][1], al = Math.sqrt(ax * ax + ay * ay) || 1, nx = -ay / al * 3.2, ny = ax / al * 3.2, tx = ax / al * 2.2, ty = ay / al * 2.2;
        roads.push({ t: "path", pts: [[b[0] - tx + nx, b[1] - ty + ny], [b[0] - tx - nx, b[1] - ty - ny]], closed: false, s: "bridge" });
        roads.push({ t: "path", pts: [[b[0] + tx + nx, b[1] + ty + ny], [b[0] + tx - nx, b[1] + ty - ny]], closed: false, s: "bridge" });
      });
    });
    var places = layer("places"), radii = {};
    doc.places.forEach(function (pl) { radii[pl.id] = placeMarker(pl, places, hits); lay.block(pl.x, pl.y, radii[pl.id] * 2 + 6, radii[pl.id] * 2 + 6); });
    (doc.caves || []).forEach(function (cv) { var r = caveMarker(cv, places, hits); lay.block(cv.x, cv.y, r * 2 + 6, r * 2 + 6); });

    /* labels: title and furniture first (fixed), then places by importance, then seas, features, lakes, rivers.
       Two layers so a viewer can switch feature names off and keep the place names (or the other way round). */
    var furn = layer("furniture"), labels = layer("labels"), featureLabels = layer("featureLabels");
    furniture(doc.frame, doc.title.name, "a map of the region", style, furn, lay);

    var order = { city: 0, town: 1, village: 2 };
    doc.places.slice().sort(function (a, b) { return order[a.kind] - order[b.kind] || b.score - a.score; }).forEach(function (pl) {
      var r = radii[pl.id] + 3, key = pl.kind === "city" ? "labelCity" : pl.kind === "town" ? "labelTown" : "labelVillage", sz = style.text[key].size;
      var cands = [
        { x: pl.x + r + 2, y: pl.y + sz * 0.36, anchor: "start" }, { x: pl.x - r - 2, y: pl.y + sz * 0.36, anchor: "end" },
        { x: pl.x, y: pl.y - r - 4 - sz * 0.4, anchor: "middle" }, { x: pl.x, y: pl.y + r + 4 + sz * 0.95, anchor: "middle" },
        { x: pl.x + r, y: pl.y - r - 2 - sz * 0.4, anchor: "start" }, { x: pl.x - r, y: pl.y + r + 4 + sz * 0.95, anchor: "end" },
        { x: pl.x + r + 2, y: pl.y + r + sz * 1.3, anchor: "start" }, { x: pl.x - r - 2, y: pl.y - r - sz * 0.5, anchor: "end" }
      ];
      var cmd = lay.place(pl.name, key, cands, { kind: "place", id: pl.id }); if (cmd) { labels.push(cmd); hitBox(hits, "place", pl.id, cmd.box); }
    });
    /* the caves after the places: a mouth's name on a small plaque with the cave icon, a click target like a place's */
    (doc.caves || []).forEach(function (cv) {
      var r = 7, sz = style.text.labelCave.size;
      var cands = [{ x: cv.x + r, y: cv.y + sz * 0.36, anchor: "start" }, { x: cv.x - r, y: cv.y + sz * 0.36, anchor: "end" }, { x: cv.x, y: cv.y + r + sz * 0.95 }, { x: cv.x, y: cv.y - r - sz * 0.3 }, { x: cv.x + r, y: cv.y + r + sz * 1.2, anchor: "start" }, { x: cv.x - r, y: cv.y - r - sz * 0.4, anchor: "end" }];
      var cmd = lay.place(cv.name, "labelCave", cands, { kind: "cave", id: cv.id }, { icon: "cave" }); if (cmd) { labels.push(cmd); hitBox(hits, "cave", cv.id, cmd.box); }
    });
    doc.features.filter(function (f) { return f.kind === "sea" && f.name; }).forEach(function (f) {
      var cmd = lay.place(f.name, "labelSea", [{ x: f.x, y: f.y }, { x: f.x, y: f.y - 30 }, { x: f.x, y: f.y + 30 }, { x: f.x - 60, y: f.y }, { x: f.x + 60, y: f.y }], { kind: "feature", id: f.id }); if (cmd) featureLabels.push(cmd);
    });
    doc.features.filter(function (f) { return (f.kind === "range" || f.kind === "forest" || f.kind === "marsh") && f.name; }).forEach(function (f) {
      var rot = f.angle || 0, nx = -Math.sin(rot) * 22, ny = Math.cos(rot) * 22;
      var cmd = lay.place(f.name, "labelFeature", [{ x: f.x, y: f.y, rot: rot }, { x: f.x + nx, y: f.y + ny, rot: rot }, { x: f.x - nx, y: f.y - ny, rot: rot }, { x: f.x, y: f.y + 44, rot: 0 }], { kind: "feature", id: f.id });
      if (cmd) featureLabels.push(cmd);
    });
    doc.features.filter(function (f) { return f.kind === "lake" && f.name; }).forEach(function (f) {
      var cmd = lay.place(f.name, "labelLake", [{ x: f.x, y: f.y + 4 }, { x: f.x, y: f.y + 22 }, { x: f.x, y: f.y - 14 }], { kind: "feature", id: f.id }); if (cmd) featureLabels.push(cmd);
    });
    doc.rivers.filter(function (r) { return r.name && r.pts.length > 6; }).forEach(function (r) {
      var pts = r.pts, mid = Math.floor(pts.length * 0.45), a = pts[Math.max(0, mid - 2)], b = pts[Math.min(pts.length - 1, mid + 2)];
      var rot = Math.atan2(b[1] - a[1], b[0] - a[0]); if (rot > Math.PI / 2) rot -= Math.PI; if (rot < -Math.PI / 2) rot += Math.PI;
      var nx = Math.sin(rot) * 8, ny = -Math.cos(rot) * 8, m = pts[mid];
      var cmd = lay.place(r.name, "labelRiver", [{ x: m[0] + nx, y: m[1] + ny, rot: rot }, { x: m[0] - nx, y: m[1] - ny, rot: rot }], { kind: "river", id: r.id }); if (cmd) featureLabels.push(cmd);
    });

    var hitLayer = layer("hits"); for (i = 0; i < hits.length; i++) hitLayer.push(hits[i]);
    return { width: W, height: H, style: style.name, layers: layers, dropped: lay.dropped, unit: u };
  }

  /* ── build: dispatch on the generator ── */
  var BUILDERS = { region: buildRegion };
  /* opts go to the builder: `reveal` (a dungeon's fog of war: the room and passage ids to draw; null = everything) */
  function build(doc, styleName, opts) {
    NS.assert(doc && doc.format === NS.DOC_FORMAT, "scene needs a tndmap document", { format: doc && doc.format });
    var name = doc.generator && doc.generator.name, builder = NS.own(BUILDERS, name);
    NS.assert(builder, "no scene builder for this document kind", { generator: doc.generator, known: Object.keys(BUILDERS) });
    NS.assert(!opts || opts.reveal === undefined || opts.reveal === null || (Array.isArray(opts.reveal) && opts.reveal.every(function (id) { return typeof id === "string"; })), "reveal must be a list of ids, or null", { reveal: opts && opts.reveal });
    return builder(doc, NS.style.get(styleName), opts || {});
  }
  /* the element a hit refers to: HIT_SOURCES maps a hit kind to the list that holds it — a document list, or one the
     caller supplies in `extra` (markers live beside the document, not in it) */
  var HIT_SOURCES = { place: "places", cave: "caves", landmark: "landmarks", establishment: "establishments", room: "rooms", portal: "portals", marker: "markers" };
  function hitTarget(doc, hit, extra) {
    var src = hit && NS.own(HIT_SOURCES, hit.kind), list = src && ((extra && extra[src]) || doc[src]), i;
    if (!list) return null;
    for (i = 0; i < list.length; i++) if (list[i].id === hit.id) return list[i];
    return null;
  }

  NS.scene = { build: build, BUILDERS: BUILDERS, HIT_SOURCES: HIT_SOURCES, hitTarget: hitTarget, GLYPHS: GLYPHS, ribbon: ribbon,
    common: { jitter: jitter, Layout: Layout, textCommand: textCommand, hitBox: hitBox, labelGeometry: labelGeometry, SLIP: SLIP, SLIPS: SLIPS, compassRose: compassRose, scaleBar: scaleBar, furniture: furniture, plainText: plainText } };
})(typeof self !== "undefined" ? self : typeof global !== "undefined" ? global : this);

/* ───── 71-scene-town.js ───── */
/* 71-scene-town.js — the TOWN scene builder (registered in scene.BUILDERS): fields and hedges, water, roads as paper
   bands, ward tints with paper streets cut through them, buildings, the temple and the keep, walls with towers and gates,
   quays and piers, trees, bridges, labels and the shared furniture. Same command vocabulary as the region scene. */
(function (root) {
  "use strict";
  var NS = root.TnDMaps, G = NS.geom, M = NS.mesh, C = NS.scene.common, GLYPHS = NS.scene.GLYPHS, ribbon = NS.scene.ribbon;
  var TREE_UNIT = 12;

  /* a wall chain broken where the river runs through it: the pieces end `gap` short of the water on each side */
  function cutByRiver(pts, riverXY, gap) {
    var pieces = [], cur = [pts[0]], i, hit, a, b, len, ux, uy;
    for (i = 1; i < pts.length; i++) {
      a = pts[i - 1]; b = pts[i]; hit = M.crossPolyline(a, b, riverXY);
      if (!hit) { cur.push(b); continue; }
      len = G.dist(a, b) || 1; ux = (b[0] - a[0]) / len; uy = (b[1] - a[1]) / len;
      if (G.dist(a, [hit.x, hit.y]) > gap) cur.push([hit.x - ux * gap, hit.y - uy * gap]);
      if (cur.length >= 2) pieces.push(cur);
      cur = G.dist(b, [hit.x, hit.y]) > gap ? [[hit.x + ux * gap, hit.y + uy * gap], b] : [b];
    }
    if (cur.length >= 2) pieces.push(cur);
    return pieces;
  }
  function bridgeBars(b, pts, out) {
    var j, best = null, bd = 1e9, d;
    for (j = 1; j < pts.length; j++) { d = G.pointSegDist(b, pts[j - 1], pts[j]); if (d < bd) { bd = d; best = j; } }
    if (best === null) return;
    var ax = pts[best][0] - pts[best - 1][0], ay = pts[best][1] - pts[best - 1][1], al = Math.sqrt(ax * ax + ay * ay) || 1, nx = -ay / al * 5, ny = ax / al * 5, tx = ax / al * 3.2, ty = ay / al * 3.2;
    out.push({ t: "path", pts: [[b[0] - tx + nx, b[1] - ty + ny], [b[0] - tx - nx, b[1] - ty - ny]], closed: false, s: "bridge" });
    out.push({ t: "path", pts: [[b[0] + tx + nx, b[1] + ty + ny], [b[0] + tx - nx, b[1] + ty - ny]], closed: false, s: "bridge" });
  }

  function buildTown(doc, style) {
    var W = doc.frame.width, H = doc.frame.height, layers = [], hits = [], lay = C.Layout(W, H, style), i, k;
    function layer(name) { var L = { name: name, items: [] }; layers.push(L); return L.items; }
    var byId = {}; doc.wards.forEach(function (w) { byId[w.id] = w; });
    var riverXY = doc.water.river ? doc.water.river.pts.map(function (p) { return [p[0], p[1]]; }) : null;

    /* fields: hatched crops, hedged orchards and woods */
    var fields = layer("fields");
    var parkPolys = [];   /* a park's pieces (its cells) are drawn edge-first, then filled, so they merge into one green with no line between */
    doc.fields.forEach(function (f, idx) {
      if (f.kind === "field") {
        fields.push({ t: "path", pts: f.poly, closed: true, s: "hedge" });
        M.hatch(f.poly, f.angle, 4.6, (idx % 5) / 5).forEach(function (seg) { fields.push({ t: "path", pts: seg, closed: false, s: "hatch" }); });
      } else if (f.kind === "orchard") fields.push({ t: "path", pts: f.poly, closed: true, s: "hedge" });
      else if (f.kind === "park") parkPolys.push(f.poly);
      else fields.push({ t: "path", pts: f.poly, closed: true, s: "hedgeSoft" });
    });

    parkPolys.forEach(function (p) { fields.push({ t: "path", pts: p, closed: true, s: "parkEdge" }); });
    parkPolys.forEach(function (p) { fields.push({ t: "path", pts: p, closed: true, s: "parkFill" }); });
    /* roads out of town: paper bands with a thin outline */
    var roads = layer("roads");
    doc.roads.forEach(function (r) {
      var w = NS.town.WIDTH.road, pts = r.pts.map(function (p) { return [p[0], p[1], w]; });
      roads.push({ t: "path", pts: ribbon(pts), closed: true, s: "roadBand", meta: { id: r.id } });
    });

    /* wards: a tint under the built blocks; streets are paper cut through it */
    var wards = layer("wards");
    doc.wards.forEach(function (w) { if (w.kind === "built" || w.kind === "keep" || w.kind === "suburb") wards.push({ t: "path", pts: w.poly, closed: true, s: "ward", meta: { id: w.id } }); });
    var streets = layer("streets");
    ["lane", "street", "main"].forEach(function (kind) {
      doc.streets.forEach(function (s) { if (s.kind === kind) streets.push({ t: "path", pts: s.pts, closed: false, s: kind === "main" ? "streetMain" : kind, meta: { id: s.id } }); });
    });

    /* water: painted over the tints and streets, so a ward that straddles the shore shows sea beyond it */
    var water = layer("water");
    if (doc.water.river) water.push({ t: "path", pts: ribbon(doc.water.river.pts), closed: true, s: "riverBand", meta: { kind: "river" } });
    doc.water.polys.forEach(function (poly) { water.push({ t: "path", pts: poly, closed: true, s: "water" }); });
    [1, 0].forEach(function (lvl) { doc.water.ripples.forEach(function (r) { if (r.level === lvl) water.push({ t: "path", pts: r.pts, closed: r.closed, s: "ripple" + lvl }); }); });

    /* buildings, back to front */
    var bld = layer("buildings"), sorted = doc.buildings.slice().sort(function (a, b) { return a.pts[0][1] - b.pts[0][1]; });
    sorted.forEach(function (b) { bld.push({ t: "path", pts: b.pts, closed: true, s: b.est ? "buildingInn" : "building" }); });

    /* landmarks */
    var lm = layer("landmarks"), pts2;
    doc.landmarks.forEach(function (l) {
      if (l.kind === "temple" && l.poly) lm.push({ t: "path", pts: l.poly, closed: true, s: "landmarkBuilding" });
      if (l.kind === "keep") {
        if (l.curtain) {
          lm.push({ t: "path", pts: l.curtain, closed: true, s: "keepWall" });
          l.curtain.forEach(function (p) { lm.push({ t: "circle", x: p[0], y: p[1], r: 3.4, s: "tower" }); });
        }
        if (l.poly) lm.push({ t: "path", pts: l.poly, closed: true, s: "landmarkBuilding" });
      }
      if (l.kind === "outfall") {   /* an arch in the bank with the drain's mouth */
        var oa = l.x, ob = l.y, kk, ang;
        for (kk = 0, pts2 = []; kk <= 8; kk++) { ang = Math.PI + Math.PI * kk / 8; pts2.push([oa + Math.cos(ang) * 4.2, ob + Math.sin(ang) * 4.2 + 1.6]); }
        lm.push({ t: "path", pts: pts2, closed: true, s: "well" });
        lm.push({ t: "path", pts: [[oa - 2.2, ob + 1.6], [oa + 2.2, ob + 1.6]], closed: false, s: "mark" });
        lm.push({ t: "path", pts: [[oa - 1.4, ob - 0.4], [oa + 1.4, ob - 0.4]], closed: false, s: "mark" });
      }
      if (l.kind === "market" || l.kind === "green") {
        lm.push({ t: "circle", x: l.x, y: l.y, r: 2.4, s: "well" });
        if (l.kind === "market") for (k = 0; k < 4; k++) { var a = k * Math.PI / 2 + Math.PI / 4; lm.push({ t: "path", pts: [[l.x + Math.cos(a) * 3.6, l.y + Math.sin(a) * 3.6], [l.x + Math.cos(a) * 6.5, l.y + Math.sin(a) * 6.5]], closed: false, s: "mark" }); }
      }
      hits.push({ t: "hit", kind: "landmark", id: l.id, x: l.x, y: l.y, r: 11 });
    });
    /* establishments: the trade's icon stamped on its house (when the house is big enough to carry one) */
    doc.establishments.forEach(function (e) {
      var b = e.building === null ? null : doc.buildings[e.building], bb = b ? G.bbox(b.pts) : null, sz = bb ? Math.min(8, Math.min(bb[2] - bb[0], bb[3] - bb[1]) * 0.7) : 7;
      if (!b) lm.push({ t: "circle", x: e.x, y: e.y, r: 5.4, s: "well" });   /* in the street: a disc under the icon */
      if (e.icon && sz >= 3.4) NS.icons.draw(e.icon, e.x, e.y, sz, lm);
      hits.push({ t: "hit", kind: "establishment", id: e.id, x: e.x, y: e.y, r: 9 });
    });
    doc.piers.forEach(function (p) { lm.push({ t: "path", pts: p, closed: true, s: "pier" }); });

    /* walls, towers, gates; quays */
    var walls = layer("walls");
    doc.quays.forEach(function (q) { walls.push({ t: "path", pts: q, closed: false, s: "quay" }); });
    if (doc.walls) {
      doc.walls.chains.forEach(function (ch) {
        var pts = ch.closed ? ch.pts.concat([ch.pts[0]]) : ch.pts, pieces = riverXY ? cutByRiver(pts, riverXY, (doc.water.river.pts[0][2] || 10) * 0.5 + 3) : [pts];
        pieces.forEach(function (pc) { walls.push({ t: "path", pts: pc, closed: false, s: "wall" }); });
      });
      doc.walls.towers.forEach(function (p) { if (!riverXY || M.distToPolyline(p, riverXY) > 6) walls.push({ t: "circle", x: p[0], y: p[1], r: 4.6, s: "tower" }); });
      doc.walls.gates.forEach(function (g) { walls.push({ t: "circle", x: g.x, y: g.y, r: 6.2, s: "tower" }); walls.push({ t: "path", pts: [[g.x - 3.2, g.y - 3.2], [g.x + 3.2, g.y - 3.2], [g.x + 3.2, g.y + 3.2], [g.x - 3.2, g.y + 3.2]], closed: true, s: "gateMark" }); });
    }

    /* bridges: on streets and on roads */
    var bridges = layer("bridges");
    doc.streets.forEach(function (s) { if (s.bridge) { bridges.push({ t: "path", pts: s.pts, closed: false, s: s.kind === "main" ? "streetMain" : "street" }); bridgeBars(s.bridge, s.pts, bridges); } });
    doc.roads.forEach(function (r) { r.bridges.forEach(function (b) { bridgeBars(b, r.pts, bridges); }); });

    /* trees and reeds */
    var gly = layer("glyphs"), trees = doc.trees.slice().sort(function (a, b) { return a[1] - b[1] || a[0] - b[0]; });
    trees.forEach(function (t) { (t[3] === 1 ? GLYPHS.reed : GLYPHS.tree)({ x: t[0], y: t[1], s: t[2] }, TREE_UNIT, gly); });

    /* furniture and labels */
    var furn = layer("furniture"), labels = layer("labels"), featureLabels = layer("featureLabels");
    var sizeWord = doc.size === "city" ? "city" : doc.size, subtitle = "a plan of the " + sizeWord + (doc.site && doc.site.regionName ? " · " + doc.site.regionName : "");
    C.furniture(doc.frame, doc.title.name, subtitle, style, furn, lay);
    doc.landmarks.forEach(function (l) { if (l.kind === "temple" || l.kind === "keep") lay.block(l.x, l.y, 16, 16); else if (l.kind === "outfall") lay.block(l.x, l.y, 12, 12); });
    doc.establishments.forEach(function (e) { if (e.building === null) lay.block(e.x, e.y, 13, 13); });   /* a grate in the street must stay visible under the labels */
    var order = { market: 0, green: 0, keep: 1, temple: 2, harbour: 3, gate: 4, outfall: 5 }, downIds = {};
    (doc.portals || []).forEach(function (p) { if (p.to && p.to.generator === "dungeon") downIds[p.id] = true; });   /* a way down wears the arrow of its direction */
    doc.landmarks.slice().sort(function (a, b) { return order[a.kind] - order[b.kind]; }).forEach(function (l) {
      var icon = downIds[l.id] ? [LANDMARK_ICONS[l.kind] || "grate", "arrowDown"] : LANDMARK_ICONS[l.kind] || null;
      var key = l.kind === "gate" ? "townGate" : "townLandmark", sz = style.text[key].size, off = l.kind === "keep" || l.kind === "temple" ? 14 : 9;
      var cands = [{ x: l.x, y: l.y + off + sz * 0.8, anchor: "middle" }, { x: l.x, y: l.y - off - sz * 0.4, anchor: "middle" }, { x: l.x + off, y: l.y + sz * 0.36, anchor: "start" }, { x: l.x - off, y: l.y + sz * 0.36, anchor: "end" },
        { x: l.x, y: l.y + off + sz * 2, anchor: "middle" }, { x: l.x, y: l.y - off - sz * 1.6, anchor: "middle" }, { x: l.x + off, y: l.y + off + sz * 1.2, anchor: "start" }, { x: l.x - off, y: l.y - off - sz * 0.2, anchor: "end" }];
      var cmd = lay.place(l.name, key, cands, { kind: "landmark", id: l.id }, { icon: icon }); if (cmd) { labels.push(cmd); C.hitBox(hits, "landmark", l.id, cmd.box); }
    });
    doc.districts.forEach(function (d) {
      var cmd = lay.place(d.name, "townDistrict", [{ x: d.x, y: d.y }, { x: d.x, y: d.y - 18 }, { x: d.x, y: d.y + 18 }, { x: d.x - 30, y: d.y }, { x: d.x + 30, y: d.y }], { kind: "district", id: d.id }); if (cmd) featureLabels.push(cmd);
    });
    /* establishments: a small sign beside the house; one that will not fit is dropped and the stamped icon stands for it */
    var shopSz = style.text.townShop.size;
    doc.establishments.forEach(function (e) {
      var b = e.building === null ? null : doc.buildings[e.building], bb = b ? G.bbox(b.pts) : null, hw = bb ? (bb[2] - bb[0]) / 2 : 6, hh = bb ? (bb[3] - bb[1]) / 2 : 5.5;
      var cands = [{ x: e.x, y: e.y + hh + shopSz * 0.95 }, { x: e.x, y: e.y - hh - shopSz * 0.35 }, { x: e.x + hw + 1.5, y: e.y + shopSz * 0.36, anchor: "start" }, { x: e.x - hw - 1.5, y: e.y + shopSz * 0.36, anchor: "end" }];
      var cmd = lay.place(e.name, "townShop", cands, { kind: "establishment", id: e.id }, downIds[e.id] ? { icon: "arrowDown" } : null); if (cmd) { labels.push(cmd); C.hitBox(hits, "establishment", e.id, cmd.box); }
    });
    if (doc.water.river && doc.water.river.name && riverXY.length > 6) {
      var pts = riverXY, mid = Math.floor(pts.length * 0.3), a = pts[Math.max(0, mid - 3)], b = pts[Math.min(pts.length - 1, mid + 3)];
      var rot = Math.atan2(b[1] - a[1], b[0] - a[0]); if (rot > Math.PI / 2) rot -= Math.PI; if (rot < -Math.PI / 2) rot += Math.PI;
      var nx = Math.sin(rot) * 12, ny = -Math.cos(rot) * 12, m = pts[mid];
      var cmd = lay.place(doc.water.river.name, "townRiver", [{ x: m[0] + nx, y: m[1] + ny, rot: rot }, { x: m[0] - nx, y: m[1] - ny, rot: rot }], { kind: "river" }); if (cmd) featureLabels.push(cmd);
    }
    if (doc.water.coast && doc.water.seaName && doc.water.polys.length) {
      /* the sea label sits well out in the water, toward the coast bearing */
      var dir = [Math.sin(NS.town.BEARINGS.indexOf(doc.water.coast) * Math.PI / 4), -Math.cos(NS.town.BEARINGS.indexOf(doc.water.coast) * Math.PI / 4)], far = Math.min(W, H) * 0.42;
      var sx = W / 2 + dir[0] * far, sy = H / 2 + dir[1] * far, cmdS = lay.place(doc.water.seaName, "townSea", [{ x: sx, y: sy }, { x: sx - dir[0] * 40, y: sy - dir[1] * 40 }, { x: sx + dir[0] * 40, y: sy + dir[1] * 40 }], { kind: "sea" }); if (cmdS) featureLabels.push(cmdS);
    }
    if (doc.water.lake && doc.water.lakeName && doc.water.polys.length) {
      var ld = [Math.sin(NS.town.BEARINGS.indexOf(doc.water.lake) * Math.PI / 4), -Math.cos(NS.town.BEARINGS.indexOf(doc.water.lake) * Math.PI / 4)], lx = W / 2 + ld[0] * doc.radius * 1.45, ly = H / 2 + ld[1] * doc.radius * 1.45;
      var cmdL = lay.place(doc.water.lakeName, "townLake", [{ x: lx, y: ly + 4 }, { x: lx, y: ly + 22 }], { kind: "lake" }); if (cmdL) featureLabels.push(cmdL);
    }
    doc.roads.forEach(function (r) {
      if (!r.to.length) return;
      var end = r.pts[r.pts.length - 1], prev = r.pts[Math.max(0, r.pts.length - 2)], dx = end[0] - prev[0], dy = end[1] - prev[1], l = Math.sqrt(dx * dx + dy * dy) || 1;
      var x = end[0] - dx / l * 26, y = end[1] - dy / l * 26, text = "to " + r.to.join(" and ");
      var cmdR = lay.place(text, "townRoad", [{ x: x, y: y + 12 }, { x: x, y: y - 8 }, { x: x + 14, y: y + 4, anchor: "start" }, { x: x - 14, y: y + 4, anchor: "end" }], { kind: "road", id: r.id }); if (cmdR) featureLabels.push(cmdR);
    });

    var hitLayer = layer("hits"); for (i = 0; i < hits.length; i++) hitLayer.push(hits[i]);
    return { width: W, height: H, style: style.name, layers: layers, dropped: lay.dropped, unit: TREE_UNIT };
  }

  /* the icon beside a landmark's name (61-icons); gates have their mark on the wall already */
  var LANDMARK_ICONS = { market: "scales", green: "tree", park: "tree", temple: "temple", keep: "tower", harbour: "anchor", outfall: "grate" };

  NS.scene.BUILDERS.town = buildTown; NS.scene.LANDMARK_ICONS = LANDMARK_ICONS;
})(typeof self !== "undefined" ? self : typeof global !== "undefined" ? global : this);

/* ───── 72-markers.js ───── */
/* 72-markers.js — MARKERS: what the players put on a finished map — the party (a dagger), a member apart from it (a
   pennant), a new place (a pin: the goblin camp, the apothecary — with an optional icon from 61-icons on its label), a
   note (a tag: "dragon here"). They are NOT part of
   the document — a document is a pure function of seed and params — they live beside it and are drawn over it:
   `apply(scene, markers)` returns a new scene with a `markers` layer and marker hits; `describe(doc, markers)` says where
   each one is relative to the map (for the GM digest). One table of kinds; adding a kind is adding an entry. */
(function (root) {
  "use strict";
  var NS = root.TnDMaps, G = NS.geom;

  var MAX_LABEL = 40, MAX_NOTE = 400, NOTE_ON_MAP = 44;

  function arc(cx, cy, r, a0, a1, n, out) { var k, a; for (k = 0; k <= n; k++) { a = a0 + (a1 - a0) * k / n; out.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); } return out; }
  /* the party: a dagger, blade tip on the spot */
  function drawDagger(x, y, out) {
    out.push({ t: "path", pts: [[x, y], [x - 2.2, y - 4], [x - 1.7, y - 13], [x + 1.7, y - 13], [x + 2.2, y - 4]], closed: true, s: "markerPaper" });
    out.push({ t: "path", pts: [[x, y - 1.5], [x, y - 12.5]], closed: false, s: "markerLine" });
    out.push({ t: "path", pts: [[x - 5.2, y - 13], [x + 5.2, y - 13], [x + 5.2, y - 14.8], [x - 5.2, y - 14.8]], closed: true, s: "markerRed" });
    out.push({ t: "path", pts: [[x - 1.3, y - 14.8], [x + 1.3, y - 14.8], [x + 1.3, y - 20], [x - 1.3, y - 20]], closed: true, s: "markerInk" });
    out.push({ t: "circle", x: x, y: y - 21.6, r: 1.9, s: "markerRed" });
  }
  /* a member apart from the party: a pennant on a staff, foot on the spot */
  function drawPennant(x, y, out) {
    out.push({ t: "circle", x: x, y: y, r: 1.8, s: "markerFoot" });
    out.push({ t: "path", pts: [[x, y], [x, y - 17]], closed: false, s: "markerLine" });
    out.push({ t: "path", pts: [[x, y - 17], [x + 10.5, y - 13.8], [x, y - 10.5]], closed: true, s: "markerRed" });
  }
  /* a new place: a map pin, point on the spot */
  function drawPin(x, y, out) {
    var cy = y - 10, r = 5.2, t = Math.acos(r / 10), pts = [[x, y]];
    arc(x, cy, r, Math.PI / 2 + t, Math.PI / 2 + 2 * Math.PI - t, 14, pts);
    out.push({ t: "path", pts: pts, closed: true, s: "markerRed" });
    out.push({ t: "circle", x: x, y: cy, r: 2, s: "markerPaper" });
  }
  /* a note: a paper tag, its tied corner on the spot */
  function drawTag(x, y, out) {
    out.push({ t: "path", pts: [[x, y], [x + 4, y - 5.5], [x + 15, y - 5.5], [x + 15, y - 13], [x + 4, y - 13], [x + 1, y - 9.3]], closed: true, s: "markerPaper" });
    out.push({ t: "circle", x: x + 4.3, y: y - 9.3, r: 0.9, s: "markerInk" });
    out.push({ t: "path", pts: [[x + 7.5, y - 10.6], [x + 12.5, y - 10.6]], closed: false, s: "markerLine" });
    out.push({ t: "path", pts: [[x + 7.5, y - 8], [x + 13, y - 8]], closed: false, s: "markerLine" });
  }

  /* kind → how it reads (word), whether only one may exist (single), its default label, its icon, where its label sits
     (lx, ly from the spot) and how big a target it is (hitR, map units) */
  var KINDS = {
    party: { word: "the party", single: true, label: "The party", draw: drawDagger, lx: 7, ly: -4, hitR: 12 },
    member: { word: "a party member", single: false, label: "", draw: drawPennant, lx: 4.5, ly: 0, hitR: 11 },
    location: { word: "a place", single: false, label: "", draw: drawPin, lx: 8, ly: -6.5, hitR: 11 },
    note: { word: "a note", single: false, label: "", draw: drawTag, lx: 17.5, ly: -7.5, hitR: 12 }
  };

  /* loud on anything a renderer or the game could not act on; `frame` is { width, height } */
  function validate(markers, frame) {
    NS.assert(Array.isArray(markers), "markers must be an array", { got: typeof markers });
    var seen = {}, singles = {}, i, m;
    for (i = 0; i < markers.length; i++) {
      m = markers[i];
      NS.assert(m && typeof m === "object", "marker " + i + " must be an object", { got: m });
      NS.assert(NS.own(KINDS, m.kind), "marker kind must be one of " + Object.keys(KINDS).join(", "), { kind: m.kind, index: i });
      NS.assert(typeof m.id === "string" && m.id.length > 0 && !seen[m.id], "marker needs a unique string id", { id: m.id, index: i });
      seen[m.id] = true;
      NS.assert(isFinite(m.x) && isFinite(m.y), "marker needs numeric x and y", { id: m.id, x: m.x, y: m.y });
      if (frame) NS.assert(m.x >= 0 && m.y >= 0 && m.x <= frame.width && m.y <= frame.height, "marker lies outside the map frame", { id: m.id, x: m.x, y: m.y, frame: [frame.width, frame.height] });
      NS.assert(m.label === undefined || m.label === null || (typeof m.label === "string" && m.label.length <= MAX_LABEL), "marker label must be a string of at most " + MAX_LABEL + " characters", { id: m.id, label: m.label });
      NS.assert(m.note === undefined || m.note === null || (typeof m.note === "string" && m.note.length <= MAX_NOTE), "marker note must be a string of at most " + MAX_NOTE + " characters", { id: m.id });
      NS.assert(m.icon === undefined || m.icon === null || m.icon === "" || NS.own(NS.icons.ICONS, m.icon), "marker icon must be one of " + NS.icons.names().join(", "), { id: m.id, icon: m.icon });
      if (KINDS[m.kind].single) { NS.assert(!singles[m.kind], "only one marker of kind " + m.kind + " may be on a map", { ids: [singles[m.kind], m.id] }); singles[m.kind] = m.id; }
    }
    return markers;
  }

  function shortNote(note) { note = String(note).replace(/\s+/g, " "); return note.length > NOTE_ON_MAP ? note.slice(0, NOTE_ON_MAP - 1).replace(/\s+\S*$/, "") + "…" : note; }

  /* a new scene: the given one plus a `markers` layer (icons, labels on slips, a shortened note) before the hits, and
     the marker hits first in the hits layer so a marker dropped on a place wins the click */
  function apply(scene, markers, styleName) {
    NS.assert(scene && scene.layers, "apply needs a scene", { got: scene });
    validate(markers, { width: (scene.x0 || 0) + scene.width, height: (scene.y0 || 0) + scene.height });
    var style = NS.style.get(styleName || scene.style), C = NS.scene.common, items = [], hits = [];
    markers.forEach(function (m) {
      var K = KINDS[m.kind], label = m.label || K.label, meta = { kind: "marker", id: m.id };
      K.draw(m.x, m.y, items);
      if (label) items.push(C.textCommand(label, "labelMarker", m.x + K.lx, m.y + K.ly, "start", 0, style, meta, m.icon || null));
      if (m.note) items.push(C.textCommand(shortNote(m.note), "labelMarkerNote", m.x + K.lx, m.y + K.ly + (label ? 10.5 : 0), "start", 0, style, meta));
      hits.push({ t: "hit", kind: "marker", id: m.id, x: m.x, y: m.y, r: K.hitR });
    });
    var layers = [], hadHits = false;
    scene.layers.forEach(function (L) {
      if (L.name === "hits") { layers.push({ name: "markers", items: items }); layers.push({ name: "hits", items: hits.concat(L.items) }); hadHits = true; }
      else layers.push(L);
    });
    if (!hadHits) { layers.push({ name: "markers", items: items }); layers.push({ name: "hits", items: hits }); }
    var out = {}, k;
    for (k in scene) if (Object.prototype.hasOwnProperty.call(scene, k)) out[k] = scene[k];
    out.layers = layers; out.markers = markers.length;
    return out;
  }

  /* what a marker is near, per generator: the reference points and how a distance reads at that scale */
  function fmtKm(k) { return k < 1 ? Math.max(50, Math.round(k * 20) * 50) + " m" : NS.digest.fmtKm(k); }
  var REFERENCES = {
    region: function (doc) {
      return { points: doc.places.map(function (p) { return { name: p.name, x: p.x, y: p.y, at: "at" }; }).concat((doc.caves || []).map(function (c) { return { name: c.name, x: c.x, y: c.y, at: "at the mouth of" }; })), closeUnits: 1 / doc.frame.kmPerUnit,
        dist: function (u) { var k = u * doc.frame.kmPerUnit; return { value: Math.round(k * 10) / 10, unit: "km", text: fmtKm(k) + (doc.frame.travelKmPerDay ? " (" + NS.digest.fmtDays(k / doc.frame.travelKmPerDay) + " on foot)" : "") }; } };
    },
    town: function (doc) {
      return { points: doc.landmarks.map(function (l) { return { name: l.name, x: l.x, y: l.y, at: "at" }; }), closeUnits: 40 / doc.frame.mPerUnit,
        dist: function (u) { var m = Math.round(u * doc.frame.mPerUnit / 10) * 10; return { value: m, unit: "m", text: m + " m" }; } };
    },
    dungeon: function (doc) {
      return { points: doc.rooms.map(function (r) { return { name: r.name, x: r.x, y: r.y, at: "in" }; }), closeUnits: 12 / doc.frame.mPerUnit,
        dist: function (u) { var m = Math.round(u * doc.frame.mPerUnit / 5) * 5; return { value: m, unit: "m", text: m + " m" }; } };
    },
    /* a wild zone: from the nearest point of interest or way on, in metres */
    wild: function (doc) {
      return { points: doc.features.map(function (f) { return { name: f.name, x: f.x, y: f.y, at: "at" }; }).concat(doc.portals.filter(function (p) { return p.kind !== "edge"; }).map(function (p) { return { name: p.name, x: p.x, y: p.y, at: "at" }; })).concat([{ name: NS.wild.reference(doc).word, x: NS.wild.reference(doc).x, y: NS.wild.reference(doc).y, at: "at" }]), closeUnits: 16 / doc.frame.mPerUnit,
        dist: function (u) { var m = Math.round(u * doc.frame.mPerUnit / 10) * 10; return { value: m, unit: "m", text: m + " m" }; } };
    },
    /* an interior: a pin is in a room (the floors lie side by side on the sheet, so the nearest room centre is its room) */
    interior: function (doc) {
      return { points: doc.rooms.map(function (r) { return { name: r.name + " (" + NS.interior.floorName(r.floor).toLowerCase() + ")", x: r.x, y: r.y, at: "in" }; }), closeUnits: 4 / doc.frame.mPerUnit,
        dist: function (u) { var m = Math.round(u * doc.frame.mPerUnit); return { value: m, unit: "m", text: m + " m" }; } };
    }
  };
  function describe(doc, markers) {
    NS.assert(doc && doc.generator && NS.own(REFERENCES, doc.generator.name), "describe needs a document of a known kind (" + Object.keys(REFERENCES).join(", ") + ")", { generator: doc && doc.generator });
    validate(markers, doc.frame);
    var ref = REFERENCES[doc.generator.name](doc), lines = [], facts = [];
    markers.forEach(function (m) {
      var K = KINDS[m.kind], label = m.label || K.label || K.word, best = null, bd = 1e9, i, d, where, fact = { kind: "marker", id: m.id, markerKind: m.kind, label: label, note: m.note || null, x: m.x, y: m.y, near: null };
      for (i = 0; i < ref.points.length; i++) { d = G.dist([ref.points[i].x, ref.points[i].y], [m.x, m.y]); if (d < bd) { bd = d; best = ref.points[i]; } }
      if (best) {
        var b = G.bearing([best.x, best.y], [m.x, m.y]), dd = ref.dist(bd);
        where = bd < ref.closeUnits ? best.at + " " + best.name : dd.text + " " + b.name + " of " + best.name;
        fact.near = best.name; fact.bearing = b.name; fact.distance = dd.value; fact.unit = dd.unit;
      } else where = "on the map";
      lines.push(label + (m.kind === "party" || m.kind === "member" ? " is " : " (" + K.word + "): ") + where + "." + (m.note ? " Note: " + m.note : ""));
      facts.push(fact);
    });
    return { text: lines.length ? "Pins:\n" + lines.join("\n") : "", facts: facts };
  }

  NS.markers = { KINDS: KINDS, kinds: function () { return Object.keys(KINDS); }, validate: validate, apply: apply, describe: describe, MAX_LABEL: MAX_LABEL, MAX_NOTE: MAX_NOTE };
})(typeof self !== "undefined" ? self : typeof global !== "undefined" ? global : this);

/* ───── 73-scene-dungeon.js ───── */
/* 73-scene-dungeon.js — the DUNGEON scene builder (registered in scene.BUILDERS). Classic ink: the rock is paper with
   short hatch ticks along every wall, the walls are the ink left between an ink-filled, ink-stroked copy of every
   floor shape and the paper-filled floor drawn over it — so passages and rooms that overlap merge into one outline with
   no seam —, water runs down the main passages, a ladder marks every grate up, a flight of steps every stair (up or
   down) and an arch the outfall, and what lies above shows faintly (the town's wall and river, or the level above's
   tunnels) so the plan reads against it; a `grid` layer of 1 m squares lies on the floors only (off by default in
   the UI); every doorway shows what stands in it. Same command vocabulary as the other scenes. */
(function (root) {
  "use strict";
  var NS = root.TnDMaps, G = NS.geom, M = NS.mesh, C = NS.scene.common, ribbon = NS.scene.ribbon;

  /* a passage as a rectangle of width w, run `ext` past both ends so joints overlap */
  function band(a, b, w, ext) {
    var dx = b[0] - a[0], dy = b[1] - a[1], l = Math.sqrt(dx * dx + dy * dy) || 1, ux = dx / l, uy = dy / l, nx = -uy * w / 2, ny = ux * w / 2;
    var ax = a[0] - ux * ext, ay = a[1] - uy * ext, bx = b[0] + ux * ext, by = b[1] + uy * ext;
    return [[ax + nx, ay + ny], [bx + nx, by + ny], [bx - nx, by - ny], [ax - nx, ay - ny]];
  }
  /* hatch ticks outward along a polygon's edges, jittered from the position so every backend draws the same; natural
     rock (a cave) gets longer, more uneven ticks, every third one crossed */
  function ticks(poly, out, natural) {
    var ccw = G.signedArea(poly) > 0, n = poly.length, i, a, b, dx, dy, l, nx, ny, steps, k, t, p, len, ang, j1, j2, c, s, tx, ty;
    for (i = 0; i < n; i++) {
      a = poly[i]; b = poly[(i + 1) % n]; dx = b[0] - a[0]; dy = b[1] - a[1]; l = Math.sqrt(dx * dx + dy * dy) || 1;
      nx = (ccw ? 1 : -1) * dy / l; ny = (ccw ? -1 : 1) * dx / l;   /* outward: screen y is down */
      steps = Math.max(1, Math.round(l / (natural ? 2.8 : 3.2)));
      for (k = 0; k < steps; k++) {
        t = (k + 0.5) / steps; p = [a[0] + dx * t, a[1] + dy * t]; j1 = C.jitter(p[0], p[1], 21); j2 = C.jitter(p[0], p[1], 22);
        len = natural ? 4 + j1 * 4 : 2.3 + j1 * 1.4; ang = j2 * (natural ? 1.1 : 0.5); c = Math.cos(ang); s = Math.sin(ang); tx = nx * c - ny * s; ty = nx * s + ny * c;
        out.push({ t: "path", pts: [[p[0] + tx * 0.6, p[1] + ty * 0.6], [p[0] + tx * len, p[1] + ty * len]], closed: false, s: "dgHatch" });
        if (natural && k % 3 === 1) { var mx = p[0] + tx * len * 0.55, my = p[1] + ty * len * 0.55, cx = -ty, cy = tx; out.push({ t: "path", pts: [[mx - cx * 1.1, my - cy * 1.1], [mx + cx * 1.1, my + cy * 1.1]], closed: false, s: "dgHatch" }); }
      }
    }
  }
  /* a natural floor: the polygon's edges resampled every few units and each point pushed across the edge by two slow
     waves along the outline (lobes and bulges, phased from the seed by the shape's first point) and a little grain, so
     a straight-cut band reads as a rock passage and a convex blob as a cavern; the document's convex shapes are
     untouched (the grid and the hits use them) */
  function rough(poly, amp) {
    var out = [], n = poly.length, i, a, b, dx, dy, l, k, m, t, j, s = 0, p0 = poly[0], ph1 = C.jitter(p0[0], p0[1], 44) * 6.28, ph2 = C.jitter(p0[0], p0[1], 45) * 6.28, f1 = 2 * Math.PI / 23, f2 = 2 * Math.PI / 9;
    for (i = 0; i < n; i++) {
      a = poly[i]; b = poly[(i + 1) % n]; dx = b[0] - a[0]; dy = b[1] - a[1]; l = Math.sqrt(dx * dx + dy * dy) || 1; m = Math.max(1, Math.round(l / 4));
      for (k = 0; k < m; k++) { t = k / m; j = amp * (0.65 * Math.sin((s + t * l) * f1 + ph1) + 0.35 * Math.sin((s + t * l) * f2 + ph2)) + C.jitter(a[0] + dx * t, a[1] + dy * t, 41) * 0.6 * amp; out.push([a[0] + dx * t - dy / l * j, a[1] + dy * t + dx / l * j]); }
      s += l;
    }
    return out;
  }
  /* a sewer channel's strokes of flow, down the middle of a straight reach */
  function flowMarks(ch, out) {
    var a = ch[0], b = ch[1], dx = b[0] - a[0], dy = b[1] - a[1], l = Math.sqrt(dx * dx + dy * dy) || 1, ux = dx / l, uy = dy / l, n = Math.floor(l / 9), k, t, m, off;
    for (k = 0; k < n; k++) { t = (k + 0.5) / n; off = (k % 2 ? 1 : -1) * ch[0][2] * 0.22; m = [a[0] + dx * t - uy * off, a[1] + dy * t + ux * off]; out.push({ t: "path", pts: [[m[0] - ux * 1.6, m[1] - uy * 1.6], [m[0] + ux * 1.6, m[1] + uy * 1.6]], closed: false, s: "ripple1" }); }
  }
  /* a pool's stroke or two of ripple */
  function poolRipples(poly, out) {
    var bb = G.bbox(poly), cx = (bb[0] + bb[2]) / 2, cy = (bb[1] + bb[3]) / 2, k, ox, oy;
    for (k = 0; k < 3; k++) { ox = (k - 1) * (bb[2] - bb[0]) * 0.18; oy = (k % 2 ? -1 : 1) * (bb[3] - bb[1]) * 0.12; out.push({ t: "path", pts: [[cx + ox - 2.2, cy + oy], [cx + ox + 2.2, cy + oy]], closed: false, s: "ripple1" }); }
  }
  /* a stream's reaches, chained end to start into runs of [x, y, w] points (the fog may hide a reach in the middle) */
  function streamRuns(channels) {
    var runs = [], cur = null, last = null;
    channels.forEach(function (ch) {
      if (!(last && Math.abs(last[0] - ch[0][0]) < 0.2 && Math.abs(last[1] - ch[0][1]) < 0.2)) { cur = [ch[0]]; runs.push(cur); }
      cur.push(ch[1]); last = ch[1];
    });
    return runs;
  }
  /* the band of a stream: the run's corners cut twice, the line resampled every 3 units, a slow wander across it
     (held still at the ends, which the document places: inside a pool, at the mouth) and a width that breathes, the
     two banks closed into one polygon and grained like the walls; a few short strokes of flow down the middle */
  function streamBand(run) {
    var pts = run.map(function (q) { return [q[0], q[1], q[2]]; }), k, i, a, b, d, t, out, line, pos, S0, end, ph1, ph2, ph3, left = [], right = [], marks = [], p, tx, ty, nx, ny, s, off, w, m, hold;
    for (k = 0; k < 2; k++) {
      out = [pts[0]];
      for (i = 0; i < pts.length - 1; i++) { a = pts[i]; b = pts[i + 1]; out.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25, a[2] * 0.75 + b[2] * 0.25]); out.push([a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75, a[2] * 0.25 + b[2] * 0.75]); }
      out.push(pts[pts.length - 1]); pts = out;
    }
    line = [[pts[0][0], pts[0][1], pts[0][2], 0]]; pos = 3; S0 = 0;
    for (i = 0; i < pts.length - 1; i++) {
      a = pts[i]; b = pts[i + 1]; d = Math.sqrt((b[0] - a[0]) * (b[0] - a[0]) + (b[1] - a[1]) * (b[1] - a[1])); if (d < 1e-6) continue;
      while (pos <= S0 + d) { t = (pos - S0) / d; line.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t, pos]); pos += 3; }
      S0 += d;
    }
    end = pts[pts.length - 1]; if (S0 - line[line.length - 1][3] > 0.8) line.push([end[0], end[1], end[2], S0]);
    if (line.length < 2) return { poly: [], marks: [] };
    ph1 = C.jitter(line[0][0], line[0][1], 46) * 6.28; ph2 = C.jitter(line[0][0], line[0][1], 47) * 6.28; ph3 = C.jitter(line[0][0], line[0][1], 48) * 6.28;
    for (i = 0; i < line.length; i++) {
      p = line[i]; a = line[Math.max(0, i - 1)]; b = line[Math.min(line.length - 1, i + 1)];
      tx = b[0] - a[0]; ty = b[1] - a[1]; d = Math.sqrt(tx * tx + ty * ty) || 1; tx /= d; ty /= d; nx = -ty; ny = tx; s = p[3];
      hold = Math.min(1, Math.min(s, S0 - s) / 12);
      off = hold * (1.4 * Math.sin(s * 2 * Math.PI / 37 + ph1) + 0.6 * Math.sin(s * 2 * Math.PI / 13 + ph2));
      w = p[2] * (1 + 0.22 * Math.sin(s * 2 * Math.PI / 29 + ph3) + C.jitter(p[0], p[1], 49) * 0.12) / 2;
      m = [p[0] + nx * off, p[1] + ny * off];
      left.push([m[0] + nx * w, m[1] + ny * w]); right.push([m[0] - nx * w, m[1] - ny * w]);
      if (i % 4 === 2 && i < line.length - 2) { off = (i % 8 === 2 ? 0.5 : -0.5) * w; marks.push({ t: "path", pts: [[m[0] - tx * 1.5 + nx * off, m[1] - ty * 1.5 + ny * off], [m[0] + tx * 1.5 + nx * off, m[1] + ty * 1.5 + ny * off]], closed: false, s: "ripple1" }); }
    }
    right.reverse();
    return { poly: rough(left.concat(right), 0.45), marks: marks };
  }
  function ladder(x, y, ang, out) {
    var c = Math.cos(ang), s = Math.sin(ang), k, t;
    function P(u, v) { return [x + u * c - v * s, y + u * s + v * c]; }
    out.push({ t: "path", pts: [P(-3.2, -1.6), P(3.2, -1.6)], closed: false, s: "dgMark" });
    out.push({ t: "path", pts: [P(-3.2, 1.6), P(3.2, 1.6)], closed: false, s: "dgMark" });
    for (k = 0; k < 4; k++) { t = -2.4 + k * 1.6; out.push({ t: "path", pts: [P(t, -1.6), P(t, 1.6)], closed: false, s: "dgMark" }); }
  }
  /* a flight of steps: five treads across the direction, narrowing toward the far end */
  function steps(x, y, ang, out) {
    var c = Math.cos(ang), s = Math.sin(ang), k, u, hw;
    function P(a, b) { return [x + a * c - b * s, y + a * s + b * c]; }
    for (k = 0; k < 5; k++) { u = -3.2 + k * 1.6; hw = 2.4 - k * 0.3; out.push({ t: "path", pts: [P(u, -hw), P(u, hw)], closed: false, s: "dgMark" }); }
    out.push({ t: "path", pts: [P(-3.2, -2.4), P(3.2, -1.2)], closed: false, s: "dgMark" });
    out.push({ t: "path", pts: [P(-3.2, 2.4), P(3.2, 1.2)], closed: false, s: "dgMark" });
  }
  /* what stands in a doorway, drawn across the door passage at its middle: a leaf (a filled slab), a keyhole for a
     lock, a bar across for barred, an S for a secret door; an open arch is nothing */
  /* the furniture of a built place, by a room's `mark` (one, or a list): two rows of pillars down a hall, a sarcophagus
     in a tomb, loculi — the niches for the dead — in the walls of a hall or an ossuary */
  function pillars(r, out, passages, marks) {
    var e = M.extents(r.poly), ca = Math.cos(e.angle), sa = Math.sin(e.angle), ins = marks.indexOf("loculi") >= 0 ? LOCULUS_D + 3 : 3, n = Math.max(2, Math.floor((e.along - 6) / 6)), k, s, u, v;   /* the rows stand clear of the niches when a hall has both */
    for (k = 0; k < n; k++) for (s = -1; s <= 1; s += 2) { u = -e.along / 2 + 3 + k * (e.along - 6) / (n - 1 || 1); v = s * (e.across / 2 - ins); out.push({ t: "circle", x: e.centre[0] + u * ca - v * sa, y: e.centre[1] + u * sa + v * ca, r: 1.1, s: "dgMark" }); }
  }
  function sarcophagus(r, out) {
    var e = M.extents(r.poly), ca = Math.cos(e.angle), sa = Math.sin(e.angle), c = e.centre, hw = 2.3, hh = 0.95;
    function P(u, v) { return [c[0] + u * ca - v * sa, c[1] + u * sa + v * ca]; }
    out.push({ t: "path", pts: [P(-hw, -hh), P(hw, -hh), P(hw, hh), P(-hw, hh)], closed: true, s: "dgMark" });
    out.push({ t: "path", pts: [P(-hw + 0.7, -hh + 0.4), P(hw - 0.7, -hh + 0.4), P(hw - 0.7, hh - 0.4), P(-hw + 0.7, hh - 0.4)], closed: true, s: "dgMark" });
  }
  /* loculi: on every wall of a rectangular chamber long enough, a bay LOCULUS_W wide and LOCULUS_D deep every LOCULUS_STEP
     units with a coffin lying in it, none where a passage or a door comes through the wall */
  var LOCULUS_W = 4.4, LOCULUS_D = 3.2, LOCULUS_STEP = 6;
  function loculi(r, out, passages) {
    var poly = r.poly, n = poly.length, i, a, b, wl, ux, uy, nx, ny, cx = 0, cy = 0, k, bays, sp, u, open;
    if (n !== 4) return;
    for (i = 0; i < n; i++) { cx += poly[i][0] / n; cy += poly[i][1] / n; }
    for (i = 0; i < n; i++) {
      a = poly[i]; b = poly[(i + 1) % n]; wl = G.dist(a, b); if (wl < LOCULUS_STEP + 4) continue;
      ux = (b[0] - a[0]) / wl; uy = (b[1] - a[1]) / wl; nx = -uy; ny = ux; if ((cx - a[0]) * nx + (cy - a[1]) * ny < 0) { nx = -nx; ny = -ny; }   /* inward */
      open = []; passages.forEach(function (p) { var hit = M.segIntersect(a, b, p.pts[0], p.pts[1]); if (hit) open.push([hit[2] * wl, p.width / 2]); });   /* where something comes through this wall: t along it, and how wide */
      bays = Math.floor((wl - 4) / LOCULUS_STEP); sp = (wl - 4) / bays;
      for (k = 0; k < bays; k++) {
        u = 2 + sp * (k + 0.5);
        if (open.some(function (o) { return Math.abs(o[0] - u) < o[1] + LOCULUS_W / 2 + 1; })) continue;
        out.push({ t: "path", pts: [W(u - LOCULUS_W / 2, 0), W(u - LOCULUS_W / 2, LOCULUS_D), W(u + LOCULUS_W / 2, LOCULUS_D), W(u + LOCULUS_W / 2, 0)], closed: false, s: "dgMark" });
        out.push({ t: "path", pts: [W(u - 0.65, 0.5), W(u + 0.65, 0.5), W(u + 0.65, LOCULUS_D - 0.4), W(u - 0.65, LOCULUS_D - 0.4)], closed: true, s: "dgMark" });
      }
    }
    function W(t, inward) { return [a[0] + ux * t + nx * inward, a[1] + uy * t + ny * inward]; }
  }
  var ROOM_MARKS = { pillars: pillars, sarcophagus: sarcophagus, loculi: loculi };
  function doorMark(p, out) {
    var a = p.pts[0], b = p.pts[1], dx = b[0] - a[0], dy = b[1] - a[1], l = Math.sqrt(dx * dx + dy * dy) || 1, ux = dx / l, uy = dy / l, nx = -uy, ny = ux;
    var m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], hw = Math.max(0.9, p.width / 2 - 0.35), k, t;
    function P(u, v) { return [m[0] + ux * u + nx * v, m[1] + uy * u + ny * v]; }
    if (p.state === "arch") return;
    if (p.state === "secret") { var pts = []; for (k = 0; k <= 12; k++) { t = k / 12; pts.push(P(Math.sin(t * Math.PI * 2) * 0.7, (t - 0.5) * Math.min(2.6, hw * 2))); } out.push({ t: "path", pts: pts, closed: false, s: "dgMark" }); return; }
    out.push({ t: "path", pts: [P(-0.45, -hw), P(0.45, -hw), P(0.45, hw), P(-0.45, hw)], closed: true, s: "dgDoor" });
    if (p.state === "locked") out.push({ t: "circle", x: P(1.4, 0)[0], y: P(1.4, 0)[1], r: 0.5, s: "dgMark" });
    if (p.state === "barred") out.push({ t: "path", pts: [P(1.3, -hw - 0.9), P(1.3, hw + 0.9)], closed: false, s: "dgMark" });
  }
  /* the grid of 1.5 m squares, clipped to the floors: every grid line cut against each convex floor shape, the pieces
     merged, all of them one path command per direction (a layer the viewer switches on) */
  var GRID_M = 1;   /* the squares, in metres: whole metres are what a player counts */
  function gridLines(floors, X, Y, W, H, GRID) {
    var boxes = floors.map(function (f) { return G.bbox(f); }), subs = [], vertical, k, lo, hi, v, i, f, b, j, a, c, t, s, iv, cur, out;
    function cut(f, vert, at) {   /* the span of a convex polygon along the line x = at (or y = at) */
      var L = Infinity, Hh = -Infinity, n = f.length, q, r, p1, p2, u;
      for (q = 0; q < n; q++) {
        p1 = f[q]; p2 = f[(q + 1) % n]; r = vert ? [p1[0], p2[0]] : [p1[1], p2[1]];
        if ((r[0] - at) * (r[1] - at) > 0 || r[0] === r[1]) continue;
        u = (at - r[0]) / (r[1] - r[0]); v = vert ? p1[1] + u * (p2[1] - p1[1]) : p1[0] + u * (p2[0] - p1[0]);
        if (v < L) L = v; if (v > Hh) Hh = v;
      }
      return L < Hh ? [L, Hh] : null;
    }
    for (vertical = 0; vertical < 2; vertical++) {
      lo = vertical ? X : Y; hi = vertical ? X + W : Y + H;
      for (k = Math.ceil(lo / GRID); k * GRID <= hi; k++) {
        a = k * GRID; iv = [];
        for (i = 0; i < floors.length; i++) {
          b = boxes[i]; if (vertical ? (a < b[0] || a > b[2]) : (a < b[1] || a > b[3])) continue;
          c = cut(floors[i], !!vertical, a); if (c) iv.push(c);
        }
        if (!iv.length) continue;
        iv.sort(function (p, q) { return p[0] - q[0]; }); out = []; cur = iv[0];
        for (j = 1; j < iv.length; j++) { if (iv[j][0] <= cur[1]) { if (iv[j][1] > cur[1]) cur[1] = iv[j][1]; } else { out.push(cur); cur = iv[j]; } }
        out.push(cur);
        for (j = 0; j < out.length; j++) { s = out[j]; t = vertical ? [[a, s[0]], [a, s[1]]] : [[s[0], a], [s[1], a]]; subs.push(t); }
      }
    }
    return subs;
  }
  /* a cave mouth: two arcs of the opening and the ground under it, across the passage's direction */
  function mouth(x, y, ang, out) {
    var k, a, c = Math.cos(ang), s = Math.sin(ang), u, v, pts;
    [5.2, 3.3].forEach(function (r) { pts = []; for (k = 0; k <= 12; k++) { a = Math.PI / 2 + Math.PI * k / 12; u = Math.cos(a) * r; v = Math.sin(a) * r - 0.4; pts.push([x + u * c - v * s, y + u * s + v * c]); } out.push({ t: "path", pts: pts, closed: false, s: "dgMark" }); });
    out.push({ t: "path", pts: [[x - 6.4 * c + 4.6 * s, y - 6.4 * s - 4.6 * c], [x + 6.4 * c + 4.6 * s, y + 6.4 * s - 4.6 * c]], closed: false, s: "dgMark" });
  }
  /* a shaft, up or down: a dark hole with a rough rim and four ticks */
  function hole(x, y, ang, out) {
    var pts = [], k, a, r;
    for (k = 0; k < 14; k++) { a = k * Math.PI * 2 / 14; r = 3.3 * (1 + C.jitter(x + k, y, 43) * 0.18); pts.push([x + Math.cos(a) * r, y + Math.sin(a) * r]); }
    out.push({ t: "path", pts: pts, closed: true, s: "dgMark" });
    out.push({ t: "circle", x: x, y: y, r: 1.7, s: "dgDoor" });
    for (k = 0; k < 4; k++) { a = ang + Math.PI / 4 + k * Math.PI / 2; out.push({ t: "path", pts: [[x + Math.cos(a) * 3.6, y + Math.sin(a) * 3.6], [x + Math.cos(a) * 5, y + Math.sin(a) * 5]], closed: false, s: "dgMark" }); }
  }
  /* the mark at a portal, by its kind; the icon on its banner (or on the plaque of a room that is a way down) */
  var MARKS = { grate: ladder, stairs: steps, outfall: arch, cave: mouth, shaft: hole }, PORTAL_ICONS = { grate: "grate", stairs: "stairs", outfall: "grate", cave: "cave", shaft: "hole" };
  function arch(x, y, ang, out) {
    var pts = [], k, a, c = Math.cos(ang), s = Math.sin(ang), u, v;
    for (k = 0; k <= 10; k++) { a = Math.PI / 2 + Math.PI * k / 10; u = Math.cos(a) * 3.4; v = Math.sin(a) * 3.4 - 0.6; pts.push([x + u * c - v * s, y + u * s + v * c]); }
    out.push({ t: "path", pts: pts, closed: false, s: "dgMark" });
    out.push({ t: "path", pts: [[x - 3.4 * c + 2.8 * s, y - 3.4 * s - 2.8 * c], [x + 3.4 * c + 2.8 * s, y + 3.4 * s - 2.8 * c]], closed: false, s: "dgMark" });
  }

  function buildDungeon(doc, style, opts) {
    /* the scene draws the document's extent — a window of the town's coordinates — not the whole frame */
    var X = doc.extent[0], Y = doc.extent[1], W = doc.extent[2] - X, H = doc.extent[3] - Y, SITE = NS.dungeon.SITES[doc.kind], i;
    var needW = NS.style.textWidth(doc.title.name, style.text.title) + 320;   /* the title between the compass and its mirror */
    if (W < needW) { X = Math.max(0, Math.min(doc.frame.width - needW, X - (needW - W) / 2)); W = Math.min(needW, doc.frame.width); }
    var layers = [], hits = [], lay = C.Layout(W, H, style, X, Y);
    function layer(name) { var L = { name: name, items: [] }; layers.push(L); return L.items; }
    var byPortal = {}; doc.rooms.forEach(function (r) { if (r.portal) byPortal[r.portal] = r; });
    /* fog of war: with opts.reveal (a list of room and passage ids) only those are drawn — a door with its room, a
       way up with its landing, a way down with its room, a channel with its passage; what lies above stays */
    var seen = null; if (opts && opts.reveal) { seen = {}; opts.reveal.forEach(function (id) { seen[id] = true; }); }
    var vis = { rooms: doc.rooms.filter(function (r) { return !seen || seen[r.id]; }), passages: doc.passages.filter(function (p) { return !seen || seen[p.id] || (p.kind === "door" && seen[p.room]); }) };
    var shownRoom = {}; vis.rooms.forEach(function (r) { shownRoom[r.id] = true; });
    vis.portals = doc.portals.filter(function (p) { return !seen || (p.way === "down" ? shownRoom[p.id] : byPortal[p.id] && shownRoom[byPortal[p.id].id]); });
    function segKey(a, b) { return Math.round(a[0] * 10) + "," + Math.round(a[1] * 10) + "/" + Math.round(b[0] * 10) + "," + Math.round(b[1] * 10); }
    var pk = {}; vis.passages.forEach(function (p) { pk[segKey(p.pts[0], p.pts[1])] = true; });
    var allPk = {}; doc.passages.forEach(function (p) { allPk[segKey(p.pts[0], p.pts[1])] = true; allPk[segKey(p.pts[1], p.pts[0])] = true; });
    /* a reach that is no passage (a stream's first, from the middle of its pool; its last, into the sink's) shows with the room it lies in */
    vis.channels = doc.water.channels.filter(function (ch) { var k = segKey(ch[0], ch[1]), kr = segKey(ch[1], ch[0]); return !seen || pk[k] || pk[kr] || (!allPk[k] && vis.rooms.some(function (r) { return G.pointInPolygon([(ch[0][0] + ch[1][0]) / 2, (ch[0][1] + ch[1][1]) / 2], r.poly); })); });
    var downRoom = {}; doc.portals.forEach(function (p) { if (p.way === "down") downRoom[p.id] = p.kind; });
    var dirAt = {}; doc.passages.forEach(function (p) { if (p.kind === "door") return; var ang = Math.atan2(p.pts[1][1] - p.pts[0][1], p.pts[1][0] - p.pts[0][0]); [p.pts[0], p.pts[1]].forEach(function (q) { dirAt[Math.round(q[0] * 10) + "," + Math.round(q[1] * 10)] = ang; }); });
    function dirOf(x, y) { var a = dirAt[Math.round(x * 10) + "," + Math.round(y * 10)]; return a === undefined ? 0 : a; }

    /* the surface, faintly: the wall and the river of the town above */
    var above = layer("above");
    (doc.site.walls || []).forEach(function (ch) { above.push({ t: "path", pts: ch, closed: false, s: "above" }); });
    if (doc.site.river) above.push({ t: "path", pts: ribbon(doc.site.river), closed: true, s: "aboveWater" });

    /* floors: every passage band and room polygon; rock ticks under, ink copies, then paper — roughened for natural rock */
    var floors = vis.passages.map(function (p) { return band(p.pts[0], p.pts[1], p.width, p.kind === "door" ? 0.4 : p.width / 2); }).concat(vis.rooms.map(function (r) { return r.poly; }));
    var natural = !!SITE.natural, drawn = natural ? floors.map(function (f, i) { return i < vis.passages.length ? (vis.passages[i].kind === "door" ? f : rough(f, Math.min(2.2, vis.passages[i].width * 0.16))) : rough(f, 2.6); }) : floors;
    var rock = layer("rock"); drawn.forEach(function (f) { ticks(f, rock, natural); });
    var walls = layer("walls"); drawn.forEach(function (f) { walls.push({ t: "path", pts: f, closed: true, s: "dgWall" }); });
    var floor = layer("floor"); drawn.forEach(function (f) { floor.push({ t: "path", pts: f, closed: true, s: "dgFloor" }); });
    /* the grid, on the floors only; one command, so it costs the scene almost nothing */
    var grid = layer("grid"), gsubs = gridLines(floors, X, Y, W, H, GRID_M / doc.frame.mPerUnit);
    if (gsubs.length) grid.push({ t: "path", subpaths: gsubs, closed: false, s: "dgGrid" });

    /* the water. A sewer's channels run straight down its tunnels. A natural site's stream is ONE course: its reaches
       chained into a line, the corners cut, a slow wander and a breathing width, grained like the walls — and every
       water shape is drawn twice, ink then pond, so a stream runs into its pool through one merged outline */
    var water = layer("water"), marks = [], shapes = [];
    if (!natural) {
      vis.channels.forEach(function (ch) { water.push({ t: "path", pts: ribbon(ch), closed: true, s: "dgChannel" }); flowMarks(ch, water); });
      vis.rooms.forEach(function (r) { if (r.water) { water.push({ t: "path", pts: r.water.poly, closed: true, s: "dgPool" }); poolRipples(r.water.poly, water); } });
    } else {
      streamRuns(vis.channels).forEach(function (run) { var sb = streamBand(run); if (sb.poly.length >= 3) { shapes.push(sb.poly); marks = marks.concat(sb.marks); } });
      vis.rooms.forEach(function (r) { if (r.water) { shapes.push(rough(r.water.poly, 1.1)); poolRipples(r.water.poly, marks); } });
      shapes.forEach(function (s) { water.push({ t: "path", pts: s, closed: true, s: "dgWaterInk" }); });
      shapes.forEach(function (s) { water.push({ t: "path", pts: s, closed: true, s: "dgWaterFill" }); });
      marks.forEach(function (m) { water.push(m); });
    }
    /* features: a ladder at every grate up, steps at every stair (up or down), an arch at the outfall; hits for the
       ways up (first, so a click on a landing is the way up) and rooms — a way down is a room, with its own card */
    var feat = layer("features"), ups = vis.portals.filter(function (p) { return p.way !== "down"; });
    vis.passages.forEach(function (p) { if (p.kind === "door") doorMark(p, feat); });
    vis.rooms.forEach(function (r) { var marks = [].concat(r.mark || []); marks.forEach(function (m) { if (ROOM_MARKS[m]) ROOM_MARKS[m](r, feat, doc.passages, marks); }); });
    vis.portals.forEach(function (p) {
      (MARKS[p.kind] || arch)(p.x, p.y, dirOf(p.x, p.y) + (p.kind === "stairs" && p.way === "down" ? Math.PI / 2 : 0), feat);
      if (p.way !== "down") hits.push({ t: "hit", kind: "portal", id: p.id, x: p.x, y: p.y, r: 10 });
    });
    vis.rooms.forEach(function (r) {
      if (r.portal && !downRoom[r.id]) return;   /* a landing is clicked as its way up; a pinned stair down is a room */
      var bb = G.bbox(r.poly);
      hits.push({ t: "hit", kind: "room", id: r.id, x: r.x, y: r.y, r: Math.max(7, Math.min(bb[2] - bb[0], bb[3] - bb[1]) * 0.45) });
    });

    /* furniture and labels: the ways in and out first, then the rooms by size */
    var furn = layer("furniture"), labels = layer("labels"), featureLabels = layer("featureLabels");
    C.furniture({ x0: X, y0: Y, width: W, height: H, kmPerUnit: doc.frame.kmPerUnit }, doc.title.name, NS.dungeon.caption(doc), style, furn, lay);
    ups.forEach(function (p) {
      var sz = style.text.labelLandmark.size, off = p.kind === "cave" ? 10 : 8, text = p.name || (p.kind === "outfall" ? "the outfall" : "a way up");
      var cands = [{ x: p.x, y: p.y + off + sz * 0.8 }, { x: p.x, y: p.y - off - sz * 0.4 }, { x: p.x + off, y: p.y + sz * 0.36, anchor: "start" }, { x: p.x - off, y: p.y + sz * 0.36, anchor: "end" }, { x: p.x, y: p.y + off + sz * 2 }, { x: p.x, y: p.y - off - sz * 1.6 }];
      var cmd = lay.place(text, SITE.labels === "numbers" ? "labelPortalSmall" : "labelLandmark", cands, { kind: "portal", id: p.id }, { icon: [PORTAL_ICONS[p.kind] || "grate", "arrowUp"] }); if (cmd) { labels.push(cmd); C.hitBox(hits, "portal", p.id, cmd.box); }
    });
    var sz2 = style.text.labelRoom.size, numbered = SITE.labels === "numbers", tips = numbered ? layer("tips") : null;
    var rank = { vault: 2, alcove: 1 };
    /* where a chamber's number sits: its middle — or, when something is drawn in the middle, a corner, and between the
       rows of a pillared hall by its end wall */
    function numberSpot(r) {
      var marks = [].concat(r.mark || []), e, ca, sa, u, v;
      if (!marks.length || r.poly.length !== 4) return [r.x, r.y];
      e = M.extents(r.poly); ca = Math.cos(e.angle); sa = Math.sin(e.angle);
      if (marks.indexOf("pillars") >= 0) { u = -e.along / 2 + 3; v = 0; } else { u = -e.along / 2 + 2.6; v = -e.across / 2 + 2.4; }
      return [e.centre[0] + u * ca - v * sa, e.centre[1] + u * sa + v * ca];
    }
    /* a natural site's plain chambers (the cluster's unnamed nodes, kind vault) carry no plaque: the plan stays rock and
       floor, their names are on their cards and in the digest */
    vis.rooms.filter(function (r) { return (!r.portal || downRoom[r.id]) && !(natural && r.kind === "vault"); }).sort(function (a, b) { return (rank[a.kind] || 0) - (rank[b.kind] || 0) || Math.abs(G.signedArea(b.poly)) - Math.abs(G.signedArea(a.poly)); }).forEach(function (r) {
      var bb = G.bbox(r.poly), hw = (bb[2] - bb[0]) / 2, hh = (bb[3] - bb[1]) / 2, icon = downRoom[r.id] ? [PORTAL_ICONS[downRoom[r.id]] || "stairs", "arrowDown"] : null;
      if (numbered) {   /* the number on the plan; the plaque in the tips layer, above the room, for the view to draw on a hover or a press */
        var at = numberSpot(r), num = C.plainText(String(r.no), "labelNumber", at[0], at[1] + 1.6, style); num.meta = { kind: "room", id: r.id }; labels.push(num);
        tips.push(C.textCommand(r.name, "labelRoom", r.x, r.y - hh - sz2 * 0.35, "middle", 0, style, { kind: "room", id: r.id }, icon));
        return;
      }
      var cands = [{ x: r.x, y: r.y + hh + sz2 * 0.95 }, { x: r.x, y: r.y - hh - sz2 * 0.35 }, { x: r.x + hw + 1.5, y: r.y + sz2 * 0.36, anchor: "start" }, { x: r.x - hw - 1.5, y: r.y + sz2 * 0.36, anchor: "end" }, { x: r.x, y: r.y + hh + sz2 * 2.1 }, { x: r.x, y: r.y - hh - sz2 * 1.5 }];
      var cmd = lay.place(r.name, "labelRoom", cands, { kind: "room", id: r.id }, icon ? { icon: icon } : null); if (cmd) { labels.push(cmd); C.hitBox(hits, "room", r.id, cmd.box); }
    });
    void featureLabels;

    var hitLayer = layer("hits"); for (i = 0; i < hits.length; i++) hitLayer.push(hits[i]);
    return { width: W, height: H, x0: X, y0: Y, style: style.name, layers: layers, dropped: lay.dropped, unit: 12 };
  }

  NS.scene.BUILDERS.dungeon = buildDungeon; NS.scene.gridLines = gridLines;   /* the interior's grid is the same grid */
})(typeof self !== "undefined" ? self : typeof global !== "undefined" ? global : this);

/* ───── 74-scene-interior.js ───── */
/* 74-scene-interior.js — the INTERIOR scene builder (registered in scene.BUILDERS): an architect's ink plan. Every
   floor is drawn in its slot on the sheet: the footprint filled with ink, each room's floor laid over it in paper so
   the walls are the ink left between them (the outer wall thicker), the doors as paper gaps with a leaf and its swing,
   the windows as gaps in the outer walls with a line of glazing, the stair as treads, the furniture in tiny ink (a
   hearth, tables with their stools, beds, barrels, an altar and its pews) and the room names on plaques; under each
   floor its caption. The `grid` layer (1 m squares on the floors) is off by default in the UI. With `opts.reveal` (the
   fog of war) only the listed rooms are drawn, with their doors and windows; the outlines stay. The sheet is widened
   when the title needs it (x0 goes negative), as a dungeon's extent is. */
(function (root) {
  "use strict";
  var NS = root.TnDMaps, G = NS.geom, M = NS.mesh, C = NS.scene.common, I = NS.interior;
  var K = I.K;   /* units to the metre; every size below is metres × K */

  function P(x, y, ang) { var c = Math.cos(ang), s = Math.sin(ang); return function (u, v) { return [x + u * c - v * s, y + u * s + v * c]; }; }
  function rect(p, hw, hh, key) { return { t: "path", pts: [p(-hw, -hh), p(hw, -hh), p(hw, hh), p(-hw, hh)], closed: true, s: key }; }
  function line(a, b, key) { return { t: "path", pts: [a, b], closed: false, s: key }; }
  function arc(p, cx, cy, r, a0, a1, n, key) { var pts = [], k, a; for (k = 0; k <= n; k++) { a = a0 + (a1 - a0) * k / n; pts.push(p(cx + Math.cos(a) * r, cy + Math.sin(a) * r)); } return { t: "path", pts: pts, closed: false, s: key }; }
  function circle(p, u, v, r, key) { var c = p(u, v); return { t: "circle", x: c[0], y: c[1], r: r, s: key }; }
  /* a door: the gap through the wall in paper, the jambs, then what stands in it — a leaf hinged at one jamb swung
     into the room it opens into, with the arc of its swing; a keyhole for a lock, a bar across for barred, an S for
     secret, nothing for an open doorway */
  function door(d, rooms, out, marks) {
    var p = P(d.x, d.y, d.a), hw = d.width / 2, outer = d.kind !== "door", th = (outer ? I.OUTER : I.WALL) + 0.25 * K, into = rooms[d.into], side = 1;
    out.push(rect(p, hw, th / 2 + (outer ? 0.2 * K : 0), "inOpen"));
    if (into) { var n = [-Math.sin(d.a), Math.cos(d.a)]; side = (into.x - d.x) * n[0] + (into.y - d.y) * n[1] >= 0 ? 1 : -1; }
    marks.push(line(p(-hw, -th / 2), p(-hw, th / 2), "inLine")); marks.push(line(p(hw, -th / 2), p(hw, th / 2), "inLine"));
    if (d.state === "arch") return;
    if (d.state === "secret") { var pts = [], k, t; for (k = 0; k <= 12; k++) { t = k / 12; pts.push(p((t - 0.5) * Math.min(1.2 * K, hw * 1.6), Math.sin(t * Math.PI * 2) * 0.25 * K)); } marks.push({ t: "path", pts: pts, closed: false, s: "inLine" }); return; }
    var leaf = Math.min(d.width, 1.6 * K), hinge = -hw;
    marks.push(line(p(hinge, 0), p(hinge, leaf * side), "inLeaf"));
    marks.push(arc(p, hinge, 0, leaf, side > 0 ? Math.PI / 2 : -Math.PI / 2, 0, 8, "inArc"));
    if (d.state === "locked") marks.push(circle(p, hw * 0.3, 0, 0.12 * K, "inFixInk"));
    if (d.state === "barred") marks.push(line(p(-hw - 0.3 * K, 0.3 * K * side), p(hw + 0.3 * K, 0.3 * K * side), "inBar"));
  }
  function window_(w, out, marks) {
    var p = P(w.x, w.y, w.a), hw = w.width / 2, th = I.OUTER + 0.25 * K;
    out.push(rect(p, hw, th / 2, "inOpen"));
    marks.push(line(p(-hw, 0), p(hw, 0), "inLine")); marks.push(line(p(-hw, -th / 2), p(-hw, th / 2), "inLine")); marks.push(line(p(hw, -th / 2), p(hw, th / 2), "inLine"));
  }
  /* a flight of steps the length of the stair room: treads across its long axis, an arrow up the middle */
  function stair(room, out) {
    var ext = M.extents(room.floorPoly), p = P(ext.centre[0], ext.centre[1], ext.angle), half = ext.along / 2 - 0.3 * K, hw = ext.across / 2 - 0.25 * K, t, n = Math.max(2, Math.floor((half * 2) / (0.3 * K))), k;
    if (hw < 0.3 * K || half < 0.5 * K) return;
    for (k = 0; k <= n; k++) { t = -half + k * (half * 2) / n; out.push(line(p(t, -hw), p(t, hw), "inLine")); }
    out.push(line(p(-half + 0.2 * K, 0), p(half - 0.6 * K, 0), "inArc")); out.push({ t: "path", pts: [p(half - 0.9 * K, -0.35 * K), p(half - 0.3 * K, 0), p(half - 0.9 * K, 0.35 * K)], closed: false, s: "inLine" });
  }
  /* the furniture table: each drawer takes the piece, its frame p(u, v) and the fixture's size in units */
  var FIX = {
    hearth: function (it, p, F, out) { out.push(arc(p, 0, -F.h / 2, F.w / 2, 0, Math.PI, 9, "inFix")); out.push(line(p(-F.w / 2, -F.h / 2), p(F.w / 2, -F.h / 2), "inLine")); [[-0.3, 0.15], [0, 0.3], [0.3, 0.15]].forEach(function (q) { out.push(line(p(q[0] * K, -0.1 * K), p(q[0] * 0.4 * K, (-0.1 - q[1]) * K), "inFixInk")); }); },
    forge: function (it, p, F, out) { out.push(rect(p, F.w / 2, F.h / 2, "inFix")); out.push(rect(p, F.w / 2 - 0.25 * K, F.h / 2 - 0.2 * K, "inLine")); out.push(circle(p, 0, 0, 0.22 * K, "inFixInk")); },
    oven: function (it, p, F, out) { out.push(arc(p, 0, -F.h / 2, F.w / 2, 0, Math.PI, 10, "inFix")); out.push(line(p(-F.w / 2, -F.h / 2), p(F.w / 2, -F.h / 2), "inLine")); out.push(arc(p, 0, -F.h / 2 + 0.15 * K, F.w / 4, 0, Math.PI, 6, "inLine")); },
    table: function (it, p, F, out) {
      if (it.round) { out.push(circle(p, 0, 0, 0.55 * K, "inFix")); [[0.85, 0], [-0.85, 0], [0, 0.85], [0, -0.85]].forEach(function (q) { out.push(circle(p, q[0] * K, q[1] * K, 0.17 * K, "inFix")); }); return; }
      out.push(rect(p, F.w / 2, F.h / 2, "inFix")); [[-0.45, -0.7], [0.45, -0.7], [-0.45, 0.7], [0.45, 0.7]].forEach(function (q) { out.push(circle(p, q[0] * K, q[1] * K, 0.17 * K, "inFix")); });
    },
    bench: function (it, p, F, out) { out.push(rect(p, F.w / 2, F.h / 2, "inFix")); },
    counter: function (it, p, F, out) { out.push(rect(p, F.w / 2, F.h / 2, "inFix")); out.push(line(p(-F.w / 2 + 0.15 * K, -F.h / 2 + 0.2 * K), p(F.w / 2 - 0.15 * K, -F.h / 2 + 0.2 * K), "inLine")); },
    bed: function (it, p, F, out) { out.push(rect(p, F.w / 2, F.h / 2, "inFix")); var q = p(-F.w / 2 + 0.35 * K, 0); out.push(rect(P(q[0], q[1], it.a), 0.22 * K, F.h / 2 - 0.2 * K, "inFix")); out.push(line(p(-F.w / 2 + 0.7 * K, -F.h / 2), p(-F.w / 2 + 0.7 * K, F.h / 2), "inLine")); },
    cot: function (it, p, F, out) { out.push(rect(p, F.w / 2, F.h / 2, "inFix")); out.push(line(p(-F.w / 2 + 0.5 * K, -F.h / 2), p(-F.w / 2 + 0.5 * K, F.h / 2), "inLine")); },
    chest: function (it, p, F, out) { out.push(rect(p, F.w / 2, F.h / 2, "inFix")); out.push(line(p(-F.w / 2, 0), p(F.w / 2, 0), "inLine")); },
    shelf: function (it, p, F, out) { out.push(rect(p, F.w / 2, F.h / 2, "inFix")); [-F.w / 4, 0, F.w / 4].forEach(function (u) { out.push(line(p(u, -F.h / 2), p(u, F.h / 2), "inLine")); }); },
    barrel: function (it, p, F, out) { out.push(circle(p, 0, 0, F.w / 2, "inFix")); out.push(circle(p, 0, 0, F.w / 2 - 0.17 * K, "inLine")); },
    cauldron: function (it, p, F, out) { out.push(circle(p, 0, 0, F.w / 2, "inFixInk")); out.push(circle(p, 0, 0, F.w / 2 - 0.2 * K, "inFix")); },
    altar: function (it, p, F, out) { out.push(rect(p, F.w / 2, F.h / 2, "inFix")); out.push(line(p(0, -0.25 * K), p(0, 0.25 * K), "inLine")); out.push(line(p(-0.2 * K, -0.08 * K), p(0.2 * K, -0.08 * K), "inLine")); },
    pew: function (it, p, F, out) { out.push(rect(p, F.w / 2, F.h / 2, "inFix")); },
    anvil: function (it, p, F, out) { out.push({ t: "path", pts: [p(-0.45 * K, -0.25 * K), p(0.45 * K, -0.25 * K), p(0.45 * K, -0.1 * K), p(0.17 * K, 0.05 * K), p(0.17 * K, 0.15 * K), p(0.35 * K, 0.25 * K), p(-0.35 * K, 0.25 * K), p(-0.17 * K, 0.15 * K), p(-0.17 * K, 0.05 * K), p(-0.35 * K, -0.05 * K)], closed: true, s: "inFixInk" }); },
    workbench: function (it, p, F, out) { out.push(rect(p, F.w / 2, F.h / 2, "inFix")); out.push(line(p(-F.w / 2 + 0.3 * K, -F.h / 2), p(-F.w / 2 + 0.3 * K, F.h / 2), "inLine")); out.push(line(p(F.w / 2 - 0.3 * K, -F.h / 2), p(F.w / 2 - 0.3 * K, F.h / 2), "inLine")); },
    desk: function (it, p, F, out) { out.push(rect(p, F.w / 2, F.h / 2, "inFix")); out.push(circle(p, 0, F.h / 2 + 0.3 * K, 0.17 * K, "inFix")); },
    tub: function (it, p, F, out) { var pts = [], k, a; for (k = 0; k < 20; k++) { a = k * Math.PI * 2 / 20; pts.push(p(Math.cos(a) * F.w / 2, Math.sin(a) * F.h / 2)); } out.push({ t: "path", pts: pts, closed: true, s: "inFix" }); pts = []; for (k = 0; k < 20; k++) { a = k * Math.PI * 2 / 20; pts.push(p(Math.cos(a) * (F.w / 2 - 0.2 * K), Math.sin(a) * (F.h / 2 - 0.2 * K))); } out.push({ t: "path", pts: pts, closed: true, s: "inLine" }); },
    stall: function (it, p, F, out) { out.push(line(p(-F.w / 2, -F.h / 2), p(-F.w / 2, F.h / 2), "inLine")); out.push(line(p(F.w / 2, -F.h / 2), p(F.w / 2, F.h / 2), "inLine")); out.push(line(p(-F.w / 2, F.h / 2 - 0.15 * K), p(-F.w / 2 + 0.6 * K, F.h / 2 - 0.15 * K), "inLine")); var q = p(0, -F.h / 2 + 0.3 * K); out.push(rect(P(q[0], q[1], it.a), F.w / 2 - 0.2 * K, 0.2 * K, "inFix")); },
    rack: function (it, p, F, out) { out.push(rect(p, F.w / 2, F.h / 2, "inFix")); [-0.6, -0.2, 0.2, 0.6].forEach(function (u) { out.push(line(p(u * K, -F.h / 2 - 0.2 * K), p(u * K, F.h / 2), "inLine")); }); }
  };

  function buildInterior(doc, style, opts) {
    var W = doc.frame.width, H = doc.frame.height, X = 0, Y = 0, layers = [], hits = [], i;
    var needW = NS.style.textWidth(doc.title.name, style.text.title) + 320;   /* the title between the compass and its mirror */
    if (W < needW) { X = -(needW - W) / 2; W = needW; }
    var lay = C.Layout(W, H, style, X, Y);
    function layer(name) { var L = { name: name, items: [] }; layers.push(L); return L.items; }
    var seen = null; if (opts && opts.reveal) { seen = {}; opts.reveal.forEach(function (id) { seen[id] = true; }); }
    var rooms = doc.rooms.filter(function (r) { return !seen || seen[r.id]; }), byId = {}; doc.rooms.forEach(function (r) { byId[r.id] = r; });
    var shown = {}; rooms.forEach(function (r) { shown[r.id] = true; });
    var doors = doc.doors.filter(function (d) { return !seen || shown[d.rooms[0]] || (d.rooms[1] && shown[d.rooms[1]]); }), windows = doc.windows.filter(function (w) { return !seen || shown[w.room]; });
    function doorAt(p) { return doors.filter(function (q) { return Math.abs(q.x - p.x) < 0.05 && Math.abs(q.y - p.y) < 0.05; })[0] || null; }
    var portals = doc.portals.filter(function (p) { return !seen || doorAt(p); });

    /* the walls: the footprint in ink, the floors in paper over it */
    var walls = layer("walls"), floor = layer("floor");
    doc.floors.forEach(function (f) { walls.push({ t: "path", pts: f.outline, closed: true, s: "inWall" }); });
    /* a courtyard is open ground, not floor; on an upper floor it is the void over the court, hatched */
    rooms.forEach(function (r) {
      if (r.kind !== "court") { floor.push({ t: "path", pts: r.floorPoly, closed: true, s: "inFloor" }); return; }
      floor.push({ t: "path", pts: r.floorPoly, closed: true, s: r.floor > 0 ? "inVoid" : "inCourt" });
      if (r.floor > 0) M.hatch(r.floorPoly, Math.PI / 4, 0.5 * K, 0).forEach(function (seg) { floor.push({ t: "path", pts: seg, closed: false, s: "inHatch" }); });
    });
    /* the grid, on the floors only (never on a court) */
    var grid = layer("grid"), gsubs = NS.scene.gridLines(rooms.filter(function (r) { return r.kind !== "court"; }).map(function (r) { return r.floorPoly; }), 0, 0, doc.frame.width, H, 1 / doc.frame.mPerUnit);
    if (gsubs.length) grid.push({ t: "path", subpaths: gsubs, closed: false, s: "dgGrid" });
    /* openings: the gaps first (paper over the ink), then the jambs, leaves, bars and glazing */
    var open = layer("openings"), marks = layer("marks");
    doors.forEach(function (d) { door(d, byId, open, marks); });
    windows.forEach(function (w) { window_(w, open, marks); });
    rooms.forEach(function (r) { if (r.kind === "stair" || r.portal) stair(r, marks); });   /* a stair down into a crypt or the dungeons is a flight too */
    /* the furniture */
    var fixtures = layer("fixtures");
    rooms.forEach(function (r) { r.furniture.forEach(function (it) { var draw = FIX[it.kind]; NS.assert(draw && I.FIXTURES[it.kind], "no drawer for this fixture", { kind: it.kind }); draw(it, P(it.x, it.y, it.a), I.fixtureSize(it.kind), fixtures); }); });
    /* hits: the doors out first (a click on the threshold is the way out), then the rooms */
    portals.forEach(function (p) { hits.push({ t: "hit", kind: "portal", id: p.id, x: p.x, y: p.y, r: 0.9 * K }); });
    rooms.forEach(function (r) { var bb = G.bbox(r.floorPoly); hits.push({ t: "hit", kind: "room", id: r.id, x: r.x, y: r.y, r: Math.max(0.6 * K, Math.min(bb[2] - bb[0], bb[3] - bb[1]) * 0.45) }); });

    /* furniture of the sheet, the floor captions, the labels */
    var furn = layer("furniture"), labels = layer("labels"), featureLabels = layer("featureLabels");
    C.furniture({ x0: X, y0: Y, width: W, height: H, kmPerUnit: doc.frame.kmPerUnit }, doc.title.name, I.caption(doc), style, furn, lay);
    doc.floors.forEach(function (f) {
      var bb = G.bbox(f.outline), cx = (bb[0] + bb[2]) / 2, y = bb[3] + 18, cmd = C.plainText(f.name, "labelFloor", cx, y, style);
      furn.push(cmd); lay.block(cx, y - 4, cmd.width + 12, 14);
    });
    var sz = style.text.labelLandmark.size;
    portals.forEach(function (p) {
      var d = doorAt(p), n = d ? [-Math.sin(d.a), Math.cos(d.a)] : [0, 1], into = d && byId[d.into], outw = 1;
      if (into) outw = ((into.x - p.x) * n[0] + (into.y - p.y) * n[1]) >= 0 ? -1 : 1;   /* the label hangs outside the building */
      var ox = n[0] * outw, oy = n[1] * outw, off = 0.9 * K;
      var anchor = Math.abs(ox) > 0.5 ? (ox > 0 ? "start" : "end") : "middle", ax = -oy, ay = ox, cands = [];
      [1, 2.2, 3.6].forEach(function (k) { cands.push({ x: p.x + ox * off * k, y: p.y + oy * off * k + sz * 0.36, anchor: anchor }); });
      [1, -1].forEach(function (s) { cands.push({ x: p.x + ox * off + ax * s * sz * 2.2, y: p.y + oy * off + ay * s * sz * 2.2 + sz * 0.36, anchor: anchor }); });
      cands.push({ x: p.x, y: p.y + off + sz * 0.8 }, { x: p.x, y: p.y - off - sz * 0.4 });
      [2.6, 4.2].forEach(function (k) { cands.push({ x: p.x - ox * off * k, y: p.y - oy * off * k + sz * 0.36 }); });   /* last: inside, over the room the door opens into */
      var cmd = lay.place(p.name, "labelLandmark", cands, { kind: "portal", id: p.id }, { icon: ["door", "arrowUp"] }); if (cmd) { labels.push(cmd); C.hitBox(hits, "portal", p.id, cmd.box); }
    });
    var sz2 = style.text.labelRoom.size;
    rooms.slice().sort(function (a, b) { return (b.hub ? 1 : 0) - (a.hub ? 1 : 0) || b.areaM2 - a.areaM2; }).forEach(function (r) {
      var bb = G.bbox(r.floorPoly), hw = (bb[2] - bb[0]) / 2, hh = (bb[3] - bb[1]) / 2, c = G.centroid(r.floorPoly);
      var cands = [{ x: c[0], y: c[1] + sz2 * 0.36 }, { x: c[0], y: c[1] - hh * 0.5 }, { x: c[0], y: c[1] + hh * 0.5 + sz2 * 0.36 }, { x: c[0] - hw * 0.4, y: c[1] + sz2 * 0.36 }, { x: c[0] + hw * 0.4, y: c[1] + sz2 * 0.36 }];
      var cmd = lay.place(r.name, "labelRoom", cands, { kind: "room", id: r.id }, r.kind === "stair" ? { icon: "stairs" } : r.portal ? { icon: ["stairs", "arrowDown"] } : null); if (cmd) { labels.push(cmd); C.hitBox(hits, "room", r.id, cmd.box); }
    });
    void featureLabels;
    var hitLayer = layer("hits"); for (i = 0; i < hits.length; i++) hitLayer.push(hits[i]);
    return { width: W, height: H, x0: X, y0: Y, style: style.name, layers: layers, dropped: lay.dropped, unit: 8 };
  }

  NS.scene.BUILDERS.interior = buildInterior;
})(typeof self !== "undefined" ? self : typeof global !== "undefined" ? global : this);

/* ───── 75-scene-wild.js ───── */
/* 75-scene-wild.js — the WILD scene builder (registered in scene.BUILDERS): the form lines, the cover (woods as a tint
   with a dotted edge, crags and outcrops in stone with hachures, bog dashes, snow), the water (the sea and its ripples,
   the river's band, the brooks running into their pools), the track (a paper band for a road or a causeway, dashes for
   a track, dots for a trail; bars at a bridge, stones at a ford), the glyph stamps back to front, the marks of the
   points of interest (the MARKS table), the ways on at the edges, labels and the shared furniture. */
(function (root) {
  "use strict";
  var NS = root.TnDMaps, G = NS.geom, M = NS.mesh, C = NS.scene.common, GLYPHS = NS.scene.GLYPHS, ribbon = NS.scene.ribbon, U = NS.util;
  var TREE_UNIT = 12;
  function J(x, y, salt) { return C.jitter(x, y, salt); }

  /* hachures: short ticks INTO a stone polygon along its outline, jittered from the position, every third one longer */
  function hachure(poly, out) {
    var ccw = G.signedArea(poly) > 0, n = poly.length, i, a, b, dx, dy, l, nx, ny, steps, k, t, p, len, j1;
    for (i = 0; i < n; i++) {
      a = poly[i]; b = poly[(i + 1) % n]; dx = b[0] - a[0]; dy = b[1] - a[1]; l = Math.sqrt(dx * dx + dy * dy) || 1;
      nx = (ccw ? -1 : 1) * dy / l; ny = (ccw ? 1 : -1) * dx / l;   /* inward */
      steps = Math.max(1, Math.round(l / 4.2));
      for (k = 0; k < steps; k++) { t = (k + 0.5) / steps; p = [a[0] + dx * t, a[1] + dy * t]; j1 = J(p[0], p[1], 61); len = 2.6 + j1 * 2.4 + (k % 3 === 1 ? 2 : 0); out.push({ t: "path", pts: [[p[0] + nx * 0.5, p[1] + ny * 0.5], [p[0] + nx * len + (dx / l) * j1 * 1.2, p[1] + ny * len + (dy / l) * j1 * 1.2]], closed: false, s: "wildHachure" }); }
    }
  }
  /* the styles of the cover kinds: the key of the polygon's fill and edge, whether hachured, the hatch inside a bog */
  var COVER = {
    wood: { s: "woodFill", edge: "woodEdge" }, thicket: { s: "thicketFill", edge: "woodEdge" },
    crag: { s: "crag", hachure: true }, rock: { s: "rockFill", hachure: true },
    bog: { s: "bogEdge", hatch: { angle: 0, spacing: 7, s: "bogHatch" } }, snow: { s: "snow" }
  };
  /* the marks of the points of interest, in map units (a unit is 1.25 m): hand-drawn ink things the GM can point at */
  function rect(x, y, w, h, out, s) { out.push({ t: "path", pts: [[x - w / 2, y - h / 2], [x + w / 2, y - h / 2], [x + w / 2, y + h / 2], [x - w / 2, y + h / 2]], closed: true, s: s || "wildMarkFill" }); }
  function ring(x, y, r, n, out, s, salt) { var pts = [], k, a; for (k = 0; k < n; k++) { a = Math.PI * 2 * k / n; pts.push([x + Math.cos(a) * r * (1 + J(x, y, (salt || 0) + k) * 0.12), y + Math.sin(a) * r * 0.9 * (1 + J(x, y, (salt || 0) + k + 20) * 0.12)]); } out.push({ t: "path", pts: pts, closed: true, s: s || "wildMark" }); return pts; }
  var MARKS = {
    greatTree: function (f, out) { GLYPHS.tree({ x: f.x, y: f.y + 6, s: 2.4 }, TREE_UNIT, out); },
    hut: function (f, out) { rect(f.x, f.y, 7, 5.2, out); out.push({ t: "path", pts: [[f.x - 3.5, f.y - 0.4], [f.x + 3.5, f.y - 0.4]], closed: false, s: "wildMark" }); },
    barn: function (f, out) { rect(f.x, f.y, 11, 6, out); out.push({ t: "path", pts: [[f.x - 5.5, f.y], [f.x + 5.5, f.y]], closed: false, s: "wildMark" }); },
    stones: function (f, out) { var k, n = 7 + (J(f.x, f.y, 3) > 0 ? 2 : 0), a, r = 8.5; for (k = 0; k < n; k++) { a = Math.PI * 2 * k / n + J(f.x, f.y, k) * 0.2; out.push({ t: "path", pts: [[f.x + Math.cos(a) * r - 0.9, f.y + Math.sin(a) * r * 0.8 - 1.6], [f.x + Math.cos(a) * r + 0.9, f.y + Math.sin(a) * r * 0.8 - 1.6], [f.x + Math.cos(a) * r + 0.9, f.y + Math.sin(a) * r * 0.8 + 1.4], [f.x + Math.cos(a) * r - 0.9, f.y + Math.sin(a) * r * 0.8 + 1.4]], closed: true, s: "wildMarkInk" }); } },
    stone: function (f, out) { out.push({ t: "path", pts: [[f.x - 1.1, f.y - 3.4], [f.x + 1.2, f.y - 3.8], [f.x + 1.3, f.y + 1.6], [f.x - 1.2, f.y + 1.6]], closed: true, s: "wildMarkInk" }); out.push({ t: "path", pts: [[f.x - 2.6, f.y + 1.8], [f.x + 2.8, f.y + 1.8]], closed: false, s: "wildMark" }); },
    milestone: function (f, out) { out.push({ t: "path", pts: [[f.x - 0.9, f.y - 2.4], [f.x + 0.9, f.y - 2.4], [f.x + 0.9, f.y + 1.4], [f.x - 0.9, f.y + 1.4]], closed: true, s: "wildMarkInk" }); },
    ruin: function (f, out) { var x = f.x, y = f.y; out.push({ t: "path", pts: [[x - 5, y + 4], [x - 5, y - 2.5], [x - 2, y - 2.5]], closed: false, s: "wildWall" }); out.push({ t: "path", pts: [[x + 0.5, y - 2.5], [x + 5, y - 2.5], [x + 5, y + 0.5]], closed: false, s: "wildWall" }); out.push({ t: "path", pts: [[x + 5, y + 2.2], [x + 5, y + 4], [x + 1, y + 4]], closed: false, s: "wildWall" }); [[x - 1, y + 1], [x + 2, y + 2], [x - 2.5, y + 6], [x + 6.5, y + 1.5]].forEach(function (p) { out.push({ t: "circle", x: p[0], y: p[1], r: 0.55, s: "wildMarkInk" }); }); },
    fort: function (f, out) { var pts = ring(f.x, f.y, 15, 16, out, "wildWall", 7); ring(f.x, f.y, 12.5, 16, out, "wildMark", 7); var k; for (k = 0; k < pts.length; k += 2) { var q = pts[k], dx = q[0] - f.x, dy = q[1] - f.y, l = Math.sqrt(dx * dx + dy * dy) || 1; out.push({ t: "path", pts: [[q[0] + dx / l * 0.6, q[1] + dy / l * 0.6], [q[0] + dx / l * 3.2, q[1] + dy / l * 3.2]], closed: false, s: "wildHachure" }); } },
    fold: function (f, out) { var pts = ring(f.x, f.y, 6.5, 10, [], null, 9); out.push({ t: "path", pts: pts.slice(1), closed: false, s: "wildWall" }); },
    barrow: function (f, out) { var pts = [], k, a; for (k = 0; k < 14; k++) { a = Math.PI * 2 * k / 14; pts.push([f.x + Math.cos(a) * 8 * (1 + J(f.x, f.y, k) * 0.08), f.y + Math.sin(a) * 4.6 * (1 + J(f.x, f.y, k + 30) * 0.1)]); } out.push({ t: "path", pts: pts, closed: true, s: "wildMarkFill" }); M.hatch(pts, 0.5, 2.2, 0.3).forEach(function (sg) { out.push({ t: "path", pts: [sg[0], [sg[0][0] + (sg[1][0] - sg[0][0]) * 0.45, sg[0][1] + (sg[1][1] - sg[0][1]) * 0.45]], closed: false, s: "wildHachure" }); }); },
    spring: function (f, out) { out.push({ t: "circle", x: f.x, y: f.y, r: 2.2, s: "wildPoolMark" }); out.push({ t: "path", pts: [[f.x - 4, f.y + 3.6], [f.x - 2, f.y + 2.8], [f.x, f.y + 3.6], [f.x + 2, f.y + 2.8], [f.x + 4, f.y + 3.6]], closed: false, s: "wildMark" }); },
    well: function (f, out) { out.push({ t: "circle", x: f.x, y: f.y, r: 2.6, s: "wildMarkFill" }); out.push({ t: "path", pts: [[f.x - 3.2, f.y - 3.4], [f.x - 3.2, f.y + 0.6]], closed: false, s: "wildMark" }); out.push({ t: "path", pts: [[f.x + 3.2, f.y - 3.4], [f.x + 3.2, f.y + 0.6]], closed: false, s: "wildMark" }); out.push({ t: "path", pts: [[f.x - 3.8, f.y - 3.4], [f.x + 3.8, f.y - 3.4]], closed: false, s: "wildMark" }); },
    camp: function (f, out) { out.push({ t: "path", pts: [[f.x - 4, f.y + 2.6], [f.x, f.y - 3.6], [f.x + 4, f.y + 2.6]], closed: true, s: "wildMarkFill" }); out.push({ t: "path", pts: [[f.x, f.y - 3.6], [f.x, f.y + 2.6]], closed: false, s: "wildMark" }); out.push({ t: "circle", x: f.x + 7, y: f.y + 1.8, r: 1.1, s: "wildMarkInk" }); },
    den: function (f, out) { var pts = [[f.x - 4, f.y + 1.5]], k, a; for (k = 0; k <= 8; k++) { a = Math.PI + Math.PI * k / 8; pts.push([f.x + Math.cos(a) * 4 * (1 + J(f.x, f.y, k) * 0.15), f.y + 1.5 + Math.sin(a) * 3.2]); } out.push({ t: "path", pts: pts, closed: true, s: "wildMarkInk" }); out.push({ t: "path", pts: [[f.x - 6, f.y + 1.8], [f.x + 6, f.y + 1.8]], closed: false, s: "wildMark" }); },
    snag: function (f, out) { GLYPHS.snag({ x: f.x, y: f.y + 5, s: 1.9 }, TREE_UNIT, out); },
    bones: function (f, out) { out.push({ t: "circle", x: f.x - 1.6, y: f.y - 1.2, r: 1.8, s: "wildMarkFill" }); out.push({ t: "path", pts: [[f.x - 1, f.y + 1.2], [f.x + 5, f.y + 3.4]], closed: false, s: "wildMark" }); out.push({ t: "path", pts: [[f.x + 0.6, f.y + 3.4], [f.x + 4.6, f.y + 0.6]], closed: false, s: "wildMark" }); },
    cairn: function (f, out) { [[0, -2.6], [-1.4, -0.4], [1.4, -0.4], [-2.6, 1.8], [0, 1.8], [2.6, 1.8]].forEach(function (p) { out.push({ t: "circle", x: f.x + p[0], y: f.y + p[1], r: 1.15, s: "wildMarkFill" }); }); },
    arch: function (f, out) { var pts = [[f.x - 6, f.y + 4], [f.x - 6, f.y - 1]], k, a; for (k = 0; k <= 8; k++) { a = Math.PI + Math.PI * k / 8; pts.push([f.x + Math.cos(a) * 6, f.y - 1 + Math.sin(a) * 5]); } pts.push([f.x + 6, f.y + 4]); out.push({ t: "path", pts: pts, closed: false, s: "wildWall" }); },
    shrine: function (f, out) { rect(f.x, f.y + 1, 3.6, 3, out); out.push({ t: "path", pts: [[f.x, f.y - 0.5], [f.x, f.y - 4.5]], closed: false, s: "wildMark" }); out.push({ t: "path", pts: [[f.x - 1.6, f.y - 3.2], [f.x + 1.6, f.y - 3.2]], closed: false, s: "wildMark" }); },
    gallows: function (f, out) { out.push({ t: "path", pts: [[f.x - 2, f.y + 3.6], [f.x - 2, f.y - 4.4], [f.x + 3.2, f.y - 4.4], [f.x + 3.2, f.y - 1.6]], closed: false, s: "wildWall" }); out.push({ t: "path", pts: [[f.x - 4.2, f.y + 3.6], [f.x + 0.6, f.y + 3.6]], closed: false, s: "wildMark" }); },
    fall: function (f, out) { var k; for (k = -1; k <= 1; k++) out.push({ t: "path", pts: [[f.x + k * 2.2, f.y - 3], [f.x + k * 2.2 + 0.6, f.y + 3]], closed: false, s: "wildMark" }); }
  };
  /* a cave mouth in the hillside: the region's dark arch, twice the size at this scale */
  function caveMark(p, out) { var r = 7, pts = [[p.x - r, p.y + 2]], k, a; for (k = 0; k <= 10; k++) { a = Math.PI + Math.PI * k / 10; pts.push([p.x + Math.cos(a) * r * (1 + J(p.x, p.y, k) * 0.12), p.y + 2 + Math.sin(a) * r * 0.95 * (1 + J(p.x, p.y, k + 11) * 0.1)]); } out.push({ t: "path", pts: pts, closed: true, s: "caveMouth" }); out.push({ t: "path", pts: [[p.x - r - 4, p.y + 2.3], [p.x + r + 4, p.y + 2.3]], closed: false, s: "caveMouthLine" }); }
  function crossingMark(c, pathPts, out) {
    var j, best = null, bd = 1e9, d, pts = pathPts;
    for (j = 1; j < pts.length; j++) { d = G.pointSegDist([c.x, c.y], pts[j - 1], pts[j]); if (d < bd) { bd = d; best = j; } }
    if (best === null) return;
    var ax = pts[best][0] - pts[best - 1][0], ay = pts[best][1] - pts[best - 1][1], al = Math.sqrt(ax * ax + ay * ay) || 1, ux = ax / al, uy = ay / al, nx = -uy, ny = ux, k;
    if (c.kind === "bridge") { [-3.2, 3.2].forEach(function (o) { out.push({ t: "path", pts: [[c.x + ux * o + nx * 4.5, c.y + uy * o + ny * 4.5], [c.x + ux * o - nx * 4.5, c.y + uy * o - ny * 4.5]], closed: false, s: "bridge" }); }); }
    else if (c.kind === "plank") out.push({ t: "path", pts: [[c.x - ux * 5, c.y - uy * 5], [c.x + ux * 5, c.y + uy * 5]], closed: false, s: "bridge" });
    else for (k = -2; k <= 2; k++) out.push({ t: "circle", x: c.x + ux * k * 2.4 + nx * J(c.x, c.y, k) * 2, y: c.y + uy * k * 2.4 + ny * J(c.x, c.y, k) * 2, r: 0.8, s: "wildMarkInk" });
  }

  function buildWild(doc, style) {
    var W = doc.frame.width, H = doc.frame.height, layers = [], hits = [], lay = C.Layout(W, H, style), i, k;
    function layer(name) { var L = { name: name, items: [] }; layers.push(L); return L.items; }
    /* the cover: every kind's polygons as ONE even-odd path (a clearing is a hole in its wood), then the edges, the hachures */
    var cover = layer("cover"), byKind = {};
    doc.cover.forEach(function (c) { (byKind[c.kind] = byKind[c.kind] || []).push(c); });
    Object.keys(COVER).forEach(function (kind) {
      var list = byKind[kind]; if (!list) return;
      var spec = COVER[kind];
      cover.push({ t: "path", subpaths: list.map(function (c) { return c.poly; }), closed: true, s: spec.s });
      if (spec.edge) list.forEach(function (c) { cover.push({ t: "path", pts: c.poly, closed: true, s: spec.edge }); });
      if (spec.hachure) list.forEach(function (c) { hachure(c.poly, cover); });
      if (spec.hatch) list.forEach(function (c, idx) { M.hatch(c.poly, spec.hatch.angle, spec.hatch.spacing, (idx % 4) / 4).forEach(function (sg) { cover.push({ t: "path", pts: sg, closed: false, s: spec.hatch.s }); }); });
    });
    /* the form lines over the cover's tints */
    var relief = layer("relief");
    doc.relief.contours.forEach(function (c) { relief.push({ t: "path", pts: c.pts, closed: c.closed, s: "formLine" }); });
    /* the water: the river's band, the brooks, then the pools over them (a brook runs into its pool), the sea last */
    var water = layer("water"), WT = doc.water;
    NS.wild.rivers(doc).forEach(function (v) { water.push({ t: "path", pts: ribbon(v.pts), closed: true, s: "riverBand", meta: { kind: "river" } }); });
    WT.streams.forEach(function (s) { water.push({ t: "path", pts: ribbon(s.pts), closed: true, s: "streamBand", meta: { id: s.id } }); });
    WT.pools.forEach(function (p) { water.push(p.holes && p.holes.length ? { t: "path", subpaths: [p.poly].concat(p.holes), closed: true, s: "pool", meta: { id: p.id } } : { t: "path", pts: p.poly, closed: true, s: "pool", meta: { id: p.id } }); var bb = G.bbox(p.poly); if (bb[2] - bb[0] > 18) water.push({ t: "path", pts: [[p.x - 4, p.y + 1], [p.x - 1.5, p.y + 0.2], [p.x + 1.5, p.y + 1], [p.x + 4, p.y + 0.2]], closed: false, s: "ripple1" }); });
    WT.polys.forEach(function (poly) { water.push({ t: "path", pts: poly, closed: true, s: "water" }); });
    [1, 0].forEach(function (lvl) { WT.ripples.forEach(function (r) { if (r.level === lvl) water.push({ t: "path", pts: r.pts, closed: r.closed, s: "ripple" + lvl }); }); });
    /* the track */
    var paths = layer("paths");
    doc.paths.forEach(function (p) {
      if (p.kind === "road" || p.kind === "causeway") { paths.push({ t: "path", pts: ribbon(p.pts.map(function (q) { return [q[0], q[1], p.kind === "road" ? 5 : 4]; })), closed: true, s: "roadBand", meta: { id: p.id } }); }
      else paths.push({ t: "path", pts: p.pts, closed: false, s: p.kind === "track" ? "wildTrack" : "wildTrail", meta: { id: p.id } });
      if (p.kind === "causeway") { var rs = G.resample(p.pts, 9, false), j; for (j = 1; j < rs.length - 1; j++) { var a = rs[j - 1], b = rs[j + 1], dx = b[0] - a[0], dy = b[1] - a[1], l = Math.sqrt(dx * dx + dy * dy) || 1; paths.push({ t: "path", pts: [[rs[j][0] - dy / l * 3.2, rs[j][1] + dx / l * 3.2], [rs[j][0] + dy / l * 3.2, rs[j][1] - dx / l * 3.2]], closed: false, s: "wildCauseway" }); } }
      p.crossings.forEach(function (c) { crossingMark(c, p.pts, paths); });
    });
    /* the glyphs, back to front */
    var gly = layer("glyphs"), sorted = doc.glyphs.slice().sort(function (a, b) { return a.y - b.y || a.x - b.x; });
    sorted.forEach(function (gl) { var fn = GLYPHS[gl.k]; NS.assert(fn, "unknown glyph kind", { k: gl.k }); fn(gl, TREE_UNIT, gly); });
    /* the points of interest and the portals: marks and hits (a portal's hit first, so a click on a mouth is the way in) */
    var marks = layer("features");
    doc.portals.forEach(function (p) {
      if (p.kind === "cave") { caveMark(p, marks); hits.push({ t: "hit", kind: "portal", id: p.id, x: p.x, y: p.y, r: 12 }); lay.block(p.x, p.y, 20, 16); }
      else if (p.kind === "place") { marks.push({ t: "circle", x: p.x, y: p.y, r: 5, s: "placeRing" }); marks.push({ t: "circle", x: p.x, y: p.y, r: 1.8, s: "placeDot" }); hits.push({ t: "hit", kind: "portal", id: p.id, x: p.x, y: p.y, r: 12 }); lay.block(p.x, p.y, 14, 14); }
      else hits.push({ t: "hit", kind: "portal", id: p.id, x: p.x, y: p.y, r: 14 });
    });
    doc.features.forEach(function (f) {
      var K = NS.wild.CATALOGUE[f.kind] || NS.wild.CATALOGUE.custom, mk = f.custom ? "stone" : K.mark;
      if (mk && MARKS[mk]) { MARKS[mk](f, marks); lay.block(f.x, f.y, 14, 12); }
      hits.push({ t: "hit", kind: "feature", id: f.id, x: f.x, y: f.y, r: 11 });
    });
    /* furniture and labels */
    var furn = layer("furniture"), labels = layer("labels"), featureLabels = layer("featureLabels");
    C.furniture(doc.frame, doc.title.name, NS.wild.caption(doc), style, furn, lay);
    doc.portals.forEach(function (p) {
      if (p.kind === "edge") return;
      var sz = style.text.labelCave.size, r = 9, icon = p.kind === "cave" ? ["cave", "arrowDown"] : null, key = p.kind === "cave" ? "labelCave" : "labelVillage";
      var cands = [{ x: p.x + r, y: p.y + sz * 0.36, anchor: "start" }, { x: p.x - r, y: p.y + sz * 0.36, anchor: "end" }, { x: p.x, y: p.y + r + sz * 0.95 }, { x: p.x, y: p.y - r - sz * 0.3 }];
      var cmd = lay.place(p.name, key, cands, { kind: "portal", id: p.id }, icon ? { icon: icon } : null); if (cmd) { labels.push(cmd); C.hitBox(hits, "portal", p.id, cmd.box); }
    });
    var fsz = style.text.wildFeature.size;
    doc.features.forEach(function (f) {
      var K = NS.wild.CATALOGUE[f.kind] || NS.wild.CATALOGUE.custom, off = K.makes && K.makes.pool ? K.makes.pool * 0.6 : K.mark ? 8 : 4, icon = f.icon || null;
      var cands = [{ x: f.x, y: f.y + off + fsz * 0.95 }, { x: f.x, y: f.y - off - fsz * 0.3 }, { x: f.x + off, y: f.y + fsz * 0.36, anchor: "start" }, { x: f.x - off, y: f.y + fsz * 0.36, anchor: "end" }, { x: f.x, y: f.y + off + fsz * 2.1 }, { x: f.x + off, y: f.y + off + fsz * 1.2, anchor: "start" }];
      var cmd = lay.place(f.name, "wildFeature", cands, { kind: "feature", id: f.id }, icon ? { icon: icon } : null); if (cmd) { labels.push(cmd); C.hitBox(hits, "feature", f.id, cmd.box); }
    });
    var named = NS.wild.rivers(doc).filter(function (v) { return v.name && v.pts.length > 6; })[0];
    if (named) {
      var pts = named.pts, mid = Math.floor(pts.length * 0.3), a = pts[Math.max(0, mid - 3)], b = pts[Math.min(pts.length - 1, mid + 3)];
      var rot = Math.atan2(b[1] - a[1], b[0] - a[0]); if (rot > Math.PI / 2) rot -= Math.PI; if (rot < -Math.PI / 2) rot += Math.PI;
      var nx = Math.sin(rot) * 12, ny = -Math.cos(rot) * 12, m = pts[mid];
      var cmdR = lay.place(named.name, "townRiver", [{ x: m[0] + nx, y: m[1] + ny, rot: rot }, { x: m[0] - nx, y: m[1] - ny, rot: rot }], { kind: "river" }); if (cmdR) featureLabels.push(cmdR);
    }
    if (doc.site.coast && doc.site.seaName && WT.polys.length) {
      var dir = NS.wild.BEARINGS.indexOf(doc.site.coast.bearing) * Math.PI / 4, sx = W / 2 + Math.sin(dir) * Math.min(W, H) * 0.42, sy = H / 2 - Math.cos(dir) * Math.min(W, H) * 0.42;
      var cmdS = lay.place(doc.site.seaName, "townSea", [{ x: sx, y: sy }, { x: sx - Math.sin(dir) * 40, y: sy + Math.cos(dir) * 40 }], { kind: "sea" }); if (cmdS) featureLabels.push(cmdS);
    }
    if (doc.site.lake && doc.site.lake.name && WT.polys.length) {
      var ld = NS.wild.BEARINGS.indexOf(doc.site.lake.bearing) * Math.PI / 4, lx = W / 2 + Math.sin(ld) * H * 0.45, ly = H / 2 - Math.cos(ld) * H * 0.45;
      var cmdL = lay.place(doc.site.lake.name, "townLake", [{ x: lx, y: ly + 4 }, { x: lx, y: ly + 22 }], { kind: "lake" }); if (cmdL) featureLabels.push(cmdL);
    }
    /* the ways on: at every edge, "to Ashford" where the track leads somewhere named, else the bearing */
    doc.portals.forEach(function (p) {
      if (p.kind !== "edge") return;
      var text = p.towards ? "to " + p.towards : p.name.split(" ")[0];
      var inx = p.bearing === "W" ? 22 : p.bearing === "E" ? -22 : 0, iny = p.bearing === "N" ? 16 : p.bearing === "S" ? -12 : 0;
      var anc = p.bearing === "W" ? "start" : p.bearing === "E" ? "end" : "middle", sx2 = inx ? 0 : 1, sy2 = iny ? 0 : 1;   /* slid along the edge when the spot is taken (the title block at the top's middle) */
      var cmdE = lay.place(text, "townRoad", [{ x: p.x + inx, y: p.y + iny + 4, anchor: anc }, { x: p.x + inx * 1.6, y: p.y + iny * 1.6 + 4, anchor: anc }, { x: p.x + inx + 40 * sx2, y: p.y + iny + 4 + 30 * sy2, anchor: anc }, { x: p.x + inx - 40 * sx2, y: p.y + iny + 4 - 30 * sy2, anchor: anc }, { x: p.x + inx * 1.6 + 70 * sx2, y: p.y + iny * 1.6 + 4, anchor: anc }], { kind: "portal", id: p.id }); if (cmdE) { featureLabels.push(cmdE); C.hitBox(hits, "portal", p.id, cmdE.box); }
    });
    var hitLayer = layer("hits"); for (i = 0; i < hits.length; i++) hitLayer.push(hits[i]);
    return { width: W, height: H, style: style.name, layers: layers, dropped: lay.dropped, unit: TREE_UNIT };
  }

  NS.scene.BUILDERS.wild = buildWild; NS.scene.WILD_MARKS = MARKS; NS.scene.HIT_SOURCES.feature = "features";
})(typeof self !== "undefined" ? self : typeof global !== "undefined" ? global : this);

/* ───── 80-render-svg.js ───── */
/* 80-render-svg.js — scene → SVG string. One <g> per layer; every colour and width comes from the style table. A text
   command is drawn at the width the layout gave it (textLength), so the letters always sit inside their slip even
   where the installed font is not the one the ADVANCES table was measured from. */
(function (root) {
  "use strict";
  var NS = root.TnDMaps;

  function n(v) { return Math.round(v * 100) / 100; }
  function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
  function pathD(cmd) {
    var subs = cmd.subpaths || [cmd.pts], d = "", i, j, pts;
    for (i = 0; i < subs.length; i++) {
      pts = subs[i]; if (!pts || !pts.length) continue;
      d += "M" + n(pts[0][0]) + " " + n(pts[0][1]);
      for (j = 1; j < pts.length; j++) d += "L" + n(pts[j][0]) + " " + n(pts[j][1]);
      if (cmd.closed || cmd.fillClose) d += "Z";
    }
    return d;
  }
  function pathAttrs(ps, strokeOnly, fillOnly) {
    var a = "";
    a += " fill=\"" + (ps.fill && !strokeOnly ? ps.fill : "none") + "\"";
    if (ps.fillRule && !strokeOnly) a += " fill-rule=\"" + ps.fillRule + "\"";
    if (ps.stroke && !fillOnly) {
      a += " stroke=\"" + ps.stroke + "\" stroke-width=\"" + n(ps.width || 1) + "\"";
      if (ps.dash) a += " stroke-dasharray=\"" + ps.dash.join(" ") + "\"";
      if (ps.cap) a += " stroke-linecap=\"" + ps.cap + "\"";
      a += " stroke-linejoin=\"" + (ps.join || "round") + "\"";
    }
    if (ps.alpha !== undefined && ps.alpha < 1) a += " opacity=\"" + ps.alpha + "\"";
    return a;
  }
  /* one path or circle command → its element(s) */
  function shapeEl(cmd, style) {
    var ps = style.paths[cmd.s]; NS.assert(ps, "style has no path key", { key: cmd.s });
    if (cmd.t === "circle") return "<circle cx=\"" + n(cmd.x) + "\" cy=\"" + n(cmd.y) + "\" r=\"" + n(cmd.r) + "\"" + pathAttrs(ps) + "/>";
    if (cmd.fillClose) { /* filled closed, stroked open: two elements */
      return "<path d=\"" + pathD({ pts: cmd.pts, closed: true }) + "\"" + pathAttrs(ps, false, true) + "/>\n" +
        "<path d=\"" + pathD({ pts: cmd.pts, closed: false }) + "\"" + pathAttrs(ps, true, false) + "/>";
    }
    return "<path d=\"" + pathD(cmd) + "\"" + pathAttrs(ps) + "/>";
  }
  function textEl(cmd, ts, halo) {
    var t = ts.transform === "uppercase" ? String(cmd.text).toUpperCase() : String(cmd.text);
    var a = " x=\"" + n(cmd.x) + "\" y=\"" + n(cmd.y) + "\" font-family=\"" + esc(ts.font) + "\" font-size=\"" + ts.size + "\"";
    if (ts.weight) a += " font-weight=\"" + ts.weight + "\"";
    if (ts.style) a += " font-style=\"" + ts.style + "\"";
    if (ts.letterSpacing) a += " letter-spacing=\"" + ts.letterSpacing + "\"";
    a += " text-anchor=\"" + (cmd.anchor || "middle") + "\"";
    if (cmd.width > 0 && t.length > 1) a += " textLength=\"" + n(cmd.width) + "\" lengthAdjust=\"spacingAndGlyphs\"";
    if (cmd.rot) a += " transform=\"rotate(" + n(cmd.rot * 180 / Math.PI) + " " + n(cmd.x) + " " + n(cmd.y) + ")\"";
    if (halo) a += " fill=\"" + ts.halo + "\" stroke=\"" + ts.halo + "\" stroke-width=\"" + ts.haloWidth + "\" stroke-linejoin=\"round\"";
    else a += " fill=\"" + ts.fill + "\"";
    return "<text" + a + ">" + esc(t) + "</text>";
  }

  /* renderSVG(scene, opts) — opts.width: the rendered pixel width (viewBox keeps map units); opts.layers: optional
     {name: false} to hide a layer */
  function renderSVG(scene, opts) {
    opts = opts || {};
    var style = NS.style.get(scene.style), W = scene.width, H = scene.height, X = scene.x0 || 0, Y = scene.y0 || 0, outW = opts.width || W, outH = Math.round(outW * H / W);
    var out = ["<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"" + X + " " + Y + " " + W + " " + H + "\" width=\"" + outW + "\" height=\"" + outH + "\" data-generator=\"TnDMaps " + NS.VERSION + "\">"];
    out.push("<rect x=\"" + X + "\" y=\"" + Y + "\" width=\"" + W + "\" height=\"" + H + "\" fill=\"" + style.paper + "\"/>");
    scene.layers.forEach(function (L) {
      if (L.name === "hits" || L.name === "tips" || (opts.layers && opts.layers[L.name] === false)) return;
      out.push("<g data-layer=\"" + esc(L.name) + "\">");
      L.items.forEach(function (cmd) {
        var ts;
        if (cmd.t === "path" || cmd.t === "circle") out.push(shapeEl(cmd, style));
        else if (cmd.t === "text") {
          ts = style.text[cmd.s]; NS.assert(ts, "style has no text key", { key: cmd.s });
          if (cmd.back) cmd.back.forEach(function (b) { out.push(shapeEl(b, style)); });
          if (ts.halo) out.push(textEl(cmd, ts, true));
          out.push(textEl(cmd, ts, false));
        } else if (cmd.t !== "hit") NS.fail("unknown scene command", { t: cmd.t });
      });
      out.push("</g>");
    });
    out.push("</svg>");
    return out.join("\n");
  }

  NS.renderSVG = renderSVG;
})(typeof self !== "undefined" ? self : typeof global !== "undefined" ? global : this);

/* ───── 81-render-canvas.js ───── */
/* 81-render-canvas.js — scene → Canvas2D. The caller sets the transform (map units → device pixels); this draws every
   layer in map units with the style table's colours and widths. Text is scaled horizontally to the width the layout
   gave it, so the letters sit inside their slip whatever font the browser resolved. */
(function (root) {
  "use strict";
  var NS = root.TnDMaps;

  function trace(ctx, cmd, forceClose) {
    var subs = cmd.subpaths || [cmd.pts], i, j, pts;
    ctx.beginPath();
    for (i = 0; i < subs.length; i++) {
      pts = subs[i]; if (!pts || !pts.length) continue;
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (j = 1; j < pts.length; j++) ctx.lineTo(pts[j][0], pts[j][1]);
      if (cmd.closed || forceClose) ctx.closePath();
    }
  }
  function applyStroke(ctx, ps) {
    ctx.strokeStyle = ps.stroke; ctx.lineWidth = ps.width || 1;
    ctx.lineCap = ps.cap || "butt"; ctx.lineJoin = ps.join || "round";
    if (ctx.setLineDash) ctx.setLineDash(ps.dash || []);
  }
  /* one path or circle command */
  function drawShape(ctx, cmd, style) {
    var ps = style.paths[cmd.s]; NS.assert(ps, "style has no path key", { key: cmd.s });
    ctx.globalAlpha = ps.alpha === undefined ? 1 : ps.alpha;
    if (cmd.t === "circle") {
      ctx.beginPath(); ctx.arc(cmd.x, cmd.y, cmd.r, 0, Math.PI * 2);
      if (ps.fill) { ctx.fillStyle = ps.fill; ctx.fill(); }
      if (ps.stroke) { applyStroke(ctx, ps); ctx.stroke(); }
    } else if (cmd.fillClose) {
      trace(ctx, cmd, true); if (ps.fill) { ctx.fillStyle = ps.fill; ctx.fill(); }
      trace(ctx, cmd, false); if (ps.stroke) { applyStroke(ctx, ps); ctx.stroke(); }
    } else {
      trace(ctx, cmd, false);
      if (ps.fill) { ctx.fillStyle = ps.fill; if (ps.fillRule) ctx.fill(ps.fillRule); else ctx.fill(); }
      if (ps.stroke) { applyStroke(ctx, ps); ctx.stroke(); }
    }
  }
  function fontOf(ts) { return (ts.style || "normal") + " " + (ts.weight || "normal") + " " + ts.size + "px " + ts.font; }
  function drawText(ctx, cmd, ts) {
    var t = ts.transform === "uppercase" ? String(cmd.text).toUpperCase() : String(cmd.text), ls = ts.letterSpacing || 0, hasLS = "letterSpacing" in ctx;
    ctx.save();
    ctx.translate(cmd.x, cmd.y); if (cmd.rot) ctx.rotate(cmd.rot);
    ctx.font = fontOf(ts); ctx.textBaseline = "alphabetic";
    if (hasLS) { ctx.letterSpacing = ls + "px"; ctx.textAlign = cmd.anchor === "start" ? "left" : cmd.anchor === "end" ? "right" : "center"; }
    else ctx.textAlign = "left";
    var x0 = 0, i, w = 0, chars = null;
    if (hasLS) w = ctx.measureText(t).width;
    else {
      /* emulate letter spacing: measure once, then advance per glyph */
      chars = t.split("");
      for (i = 0; i < chars.length; i++) w += ctx.measureText(chars[i]).width;
      w += ls * (chars.length - 1);
      x0 = cmd.anchor === "start" ? 0 : cmd.anchor === "end" ? -w : -w / 2;
    }
    /* fit the glyphs to the layout width (about the anchor point, which is the origin here) */
    if (cmd.width > 0 && w > 0 && t.length > 1) { var f = cmd.width / w; if (Math.abs(f - 1) > 0.003) ctx.scale(f, 1); }
    function paint(fill, halo) {
      if (halo) { ctx.strokeStyle = ts.halo; ctx.lineWidth = ts.haloWidth; ctx.lineJoin = "round"; if (ctx.setLineDash) ctx.setLineDash([]); }
      ctx.fillStyle = fill;
      if (hasLS || !ls) { if (halo) ctx.strokeText(t, x0, 0); ctx.fillText(t, x0, 0); return; }
      var x = x0, k;
      for (k = 0; k < chars.length; k++) { if (halo) ctx.strokeText(chars[k], x, 0); ctx.fillText(chars[k], x, 0); x += ctx.measureText(chars[k]).width + ls; }
    }
    if (ts.halo) paint(ts.halo, true);
    paint(ts.fill, false);
    ctx.restore();
  }

  /* renderCanvas(ctx, scene, opts) — opts.layers: optional {name: false} to hide a layer; opts.paper: fill the frame */
  function renderCanvas(ctx, scene, opts) {
    opts = opts || {};
    var style = NS.style.get(scene.style);
    if (opts.paper !== false) { ctx.fillStyle = style.paper; ctx.fillRect(scene.x0 || 0, scene.y0 || 0, scene.width, scene.height); }
    scene.layers.forEach(function (L) {
      if (L.name === "hits" || L.name === "tips" || (opts.layers && opts.layers[L.name] === false)) return;   /* tips: the plaques the view draws one at a time, on a hover or a press */
      var items = L.items, i, cmd, ts, k;
      for (i = 0; i < items.length; i++) {
        cmd = items[i];
        if (cmd.t === "path" || cmd.t === "circle") drawShape(ctx, cmd, style);
        else if (cmd.t === "text") {
          ts = style.text[cmd.s]; NS.assert(ts, "style has no text key", { key: cmd.s });
          if (cmd.back) for (k = 0; k < cmd.back.length; k++) drawShape(ctx, cmd.back[k], style);
          ctx.globalAlpha = 1; drawText(ctx, cmd, ts);
        } else if (cmd.t !== "hit") NS.fail("unknown scene command", { t: cmd.t });
      }
    });
    ctx.globalAlpha = 1;
    if (ctx.setLineDash) ctx.setLineDash([]);
  }

  NS.renderCanvas = renderCanvas;
})(typeof self !== "undefined" ? self : typeof global !== "undefined" ? global : this);

/* ───── 90-view.js ───── */
/* 90-view.js — the interactive map component: pan, zoom (wheel, pinch), hover and click on markers, layer toggles,
   pins (markers composed over the document scene), PNG export. Draws a crisp render at rest and pans/zooms a bitmap of
   it during gestures. DOM lives only here. */
(function (root) {
  "use strict";
  var NS = root.TnDMaps, U = NS.util;

  function view(canvas, doc, opts) {
    NS.assert(canvas && canvas.getContext, "view needs a <canvas> element", { canvas: String(canvas) });
    opts = opts || {};
    var styleName = opts.style || "ink", scene = null, baseScene = null, markers = [], layers = {}, listeners = {}, hits = [];
    var T = { x: 0, y: 0, k: 1 };                 /* map → CSS px: screen = map * k + (x, y) */
    var base = document.createElement("canvas"), baseT = null, baseDirty = true, raf = 0, idleTimer = 0;
    var hover = null, selected = null, dpr = 1, destroyed = false, pointer = null, pinch = null, suppressClick = false, userMoved = false;
    var DBL_MS = 700, pairAt = 0, pairHit = null;   /* the hit of the FIRST click of a double-click: a click listener may move the map under the pointer (a card that centres on its place), so the second click lands on paper */
    var grab = null, drag = null, overlay = null, tipOf = {}, pressed = null, pressTimer = 0, PRESS_MS = 450;   /* tipOf: the scene's `tips` layer by kind/id — a plaque drawn only over the hovered thing, or the one a pointer is held still on (a touch has no hover) */   /* grab: the hit under a pressed pointer, offered to "dragstart" once the pointer moves; drag: the one a listener claimed (the gesture moves IT, not the map); overlay: outlines drawn above everything — a drag's ghost */
    var ctx = canvas.getContext("2d");

    function emit(ev, data, extra) { (listeners[ev] || []).forEach(function (fn) { fn(data, extra); }); }
    function ask(ev, data, extra) { var yes = false; (listeners[ev] || []).forEach(function (fn) { if (fn(data, extra) === true) yes = true; }); return yes; }   /* a listener that answers true claims the gesture */
    function cssSize() { return { w: canvas.clientWidth || canvas.width, h: canvas.clientHeight || canvas.height }; }
    function resize() {
      dpr = Math.min(3, (root.devicePixelRatio || 1));
      var s = cssSize(), w = Math.max(1, Math.round(s.w * dpr)), h = Math.max(1, Math.round(s.h * dpr));
      if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; base.width = w; base.height = h; baseDirty = true; }
    }
    var reveal = null;   /* a dungeon's fog of war: the ids drawn, or null for all (setReveal) */
    function rebuildScene() { baseScene = NS.scene.build(doc, styleName, { reveal: reveal }); compose(); }
    /* the drawn scene is the document scene plus the markers; changing the markers never rebuilds the document scene */
    function compose() {
      scene = markers.length ? NS.markers.apply(baseScene, markers, styleName) : baseScene; hits = [];
      tipOf = {};
      scene.layers.forEach(function (L) { if (L.name === "hits") hits = L.items; if (L.name === "tips") L.items.forEach(function (c) { if (c.meta) tipOf[c.meta.kind + "/" + c.meta.id] = c; }); });
      baseDirty = true;
    }
    /* the crisp render of the whole visible canvas at transform T, into the base bitmap */
    function renderBase() {
      resize();
      var bctx = base.getContext("2d");
      bctx.setTransform(1, 0, 0, 1, 0, 0);
      bctx.fillStyle = opts.background || "#d9d0bd"; bctx.fillRect(0, 0, base.width, base.height);
      bctx.setTransform(T.k * dpr, 0, 0, T.k * dpr, T.x * dpr, T.y * dpr);
      NS.renderCanvas(bctx, scene, { layers: layers });
      baseT = { x: T.x, y: T.y, k: T.k }; baseDirty = false;
    }
    /* present: the base bitmap, re-projected if the transform moved since it was drawn, then the hover overlay */
    function present() {
      raf = 0; if (destroyed) return;
      if (!scene) rebuildScene();
      if (baseDirty) renderBase();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = opts.background || "#d9d0bd"; ctx.fillRect(0, 0, canvas.width, canvas.height);
      var s = T.k / baseT.k, ox = (T.x - baseT.x * s) * dpr, oy = (T.y - baseT.y * s) * dpr;
      ctx.setTransform(s, 0, 0, s, ox, oy);
      ctx.drawImage(base, 0, 0);
      /* the rings: the selected thing (while its card is open) and the hovered one — its dot and, if it has a label, its slip */
      var sel = selected ? findHit(selected.kind, selected.id) : null;
      if (sel) ring(sel, true);
      if (hover && !(sel && hover.kind === sel.kind && hover.id === sel.id)) ring(hover, false);
      if (overlay) drawOverlay();
      var th = pressed || hover, tc = th ? tipOf[th.kind + "/" + th.id] : null;
      if (tc) drawTip(tc);
    }
    /* the tip: one of the scene's plaques, drawn through the renderer above everything */
    function drawTip(cmd) {
      ctx.setTransform(T.k * dpr, 0, 0, T.k * dpr, T.x * dpr, T.y * dpr);
      NS.renderCanvas(ctx, { style: scene.style, x0: 0, y0: 0, width: 0, height: 0, layers: [{ name: "tip", items: [cmd] }] }, { paper: false });
    }
    /* a press held still for PRESS_MS on a thing shows its tip until the pointer lifts or moves (and swallows the click) */
    function clearPress() {
      if (pressTimer) { clearTimeout(pressTimer); pressTimer = 0; }
      if (pressed) { var ph = pressed; pressed = null; schedule(); emit("pressend", placeOf(ph), ph); }
    }
    /* the overlay: outlines in map units above everything — a closed one lightly filled, a dashed one a ghost */
    function drawOverlay() {
      ctx.setTransform(T.k * dpr, 0, 0, T.k * dpr, T.x * dpr, T.y * dpr);
      overlay.forEach(function (o) {
        var i; ctx.beginPath(); for (i = 0; i < o.pts.length; i++) { if (i) ctx.lineTo(o.pts[i][0], o.pts[i][1]); else ctx.moveTo(o.pts[i][0], o.pts[i][1]); } if (o.closed) ctx.closePath();
        ctx.setLineDash(o.dash ? [6 / T.k, 4 / T.k] : []); ctx.strokeStyle = "rgba(160, 60, 30, 0.95)"; ctx.lineWidth = 2.2 / T.k;
        if (o.closed) { ctx.fillStyle = "rgba(160, 60, 30, 0.12)"; ctx.fill(); }
        ctx.stroke();
      });
      ctx.setLineDash([]);
    }
    function ring(h, strong) {
      ctx.setTransform(T.k * dpr, 0, 0, T.k * dpr, T.x * dpr, T.y * dpr);
      ctx.strokeStyle = strong ? "rgba(160, 60, 30, 1)" : "rgba(160, 60, 30, 0.9)"; ctx.lineWidth = (strong ? 2.6 : 2) / T.k;
      ctx.beginPath(); ctx.arc(h.x, h.y, h.r + 2, 0, Math.PI * 2); ctx.stroke();   /* the dot only; a box around the name is too busy */
    }
    function findHit(kind, id) { var i; for (i = 0; i < hits.length; i++) if (hits[i].kind === kind && hits[i].id === id) return hits[i]; return null; }
    function schedule() { if (!raf) raf = (root.requestAnimationFrame || function (f) { return setTimeout(f, 16); })(present); }
    /* a gesture re-projects the bitmap; the crisp render follows once the gesture has been quiet for a moment */
    function moved() { userMoved = true; schedule(); clearTimeout(idleTimer); idleTimer = setTimeout(function () { baseDirty = true; schedule(); }, 140); emit("view", { x: T.x, y: T.y, k: T.k }); }

    /* fit the box the scene draws (a dungeon draws a window of its town's coordinates) */
    function fit(pad) {
      pad = pad === undefined ? 16 : pad;
      if (!scene) rebuildScene();
      var s = cssSize(), W = scene.width, H = scene.height, X = scene.x0 || 0, Y = scene.y0 || 0, k = Math.min((s.w - 2 * pad) / W, (s.h - 2 * pad) / H);
      T = { k: k, x: (s.w - W * k) / 2 - X * k, y: (s.h - H * k) / 2 - Y * k };
      userMoved = false; baseDirty = true; schedule(); emit("view", { x: T.x, y: T.y, k: T.k });
    }
    function zoomAt(factor, sx, sy) {
      var nk = U.clamp(T.k * factor, 0.1, 12), f = nk / T.k;
      T = { k: nk, x: sx - (sx - T.x) * f, y: sy - (sy - T.y) * f };
      moved();
    }
    function toMap(sx, sy) { return [(sx - T.x) / T.k, (sy - T.y) / T.k]; }
    function hitTest(sx, sy) {
      var m = toMap(sx, sy), best = null, bd = 1e9, i, h, d;
      var slack = 2 / T.k, inBox;
      for (i = 0; i < hits.length; i++) {
        h = hits[i]; d = Math.sqrt(Math.pow(h.x - m[0], 2) + Math.pow(h.y - m[1], 2));
        inBox = !!h.box && m[0] >= h.box[0] - slack && m[0] <= h.box[2] + slack && m[1] >= h.box[1] - slack && m[1] <= h.box[3] + slack;
        if ((d <= h.r / Math.min(1, T.k) + slack || inBox) && d < bd) { bd = d; best = h; }
      }
      return best;
    }
    function placeOf(h) { return h ? NS.scene.hitTarget(doc, h, { markers: markers }) : null; }
    function localXY(e) { var r = canvas.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; }

    /* ── input ── */
    function onDown(e) {
      if (e.button !== undefined && e.button !== 0) return;
      var p = localXY(e); pointer = { x: p[0], y: p[1], sx: p[0], sy: p[1] }; suppressClick = false; grab = hitTest(p[0], p[1]); clearPress();
      pressTimer = setTimeout(function () { pressTimer = 0; if (!pointer) return; var h = hitTest(pointer.sx, pointer.sy); if (h) { pressed = h; suppressClick = true; schedule(); emit("press", placeOf(h), h); } }, PRESS_MS);
    }
    function onMove(e) {
      var p = localXY(e), m, g;
      if (drag) { m = toMap(p[0], p[1]); emit("drag", { x: m[0], y: m[1] }, drag.hit); return; }
      if (pointer && grab && Math.abs(p[0] - pointer.sx) + Math.abs(p[1] - pointer.sy) > 4) {   /* a press on a thing that moves: offered once; a listener that takes it drags it, else the map pans as ever */
        g = grab; grab = null;
        if (ask("dragstart", placeOf(g), g)) { drag = { hit: g }; pointer = null; m = toMap(p[0], p[1]); emit("drag", { x: m[0], y: m[1] }, g); return; }
      }
      if (pointer) {
        T.x += p[0] - pointer.x; T.y += p[1] - pointer.y; pointer.x = p[0]; pointer.y = p[1];
        if (Math.abs(p[0] - pointer.sx) + Math.abs(p[1] - pointer.sy) > 4) { suppressClick = true; clearPress(); }
        moved(); return;
      }
      var h = hitTest(p[0], p[1]);
      if ((h && h.id) !== (hover && hover.id)) { hover = h; canvas.style.cursor = h ? "pointer" : "grab"; schedule(); emit("hover", placeOf(h), h); }
    }
    function onUp(e) {
      grab = null; clearPress();
      if (drag) { var q = localXY(e), mm = toMap(q[0], q[1]), dr = drag; drag = null; emit("dragend", { x: mm[0], y: mm[1] }, dr.hit); return; }
      if (!pointer) return; pointer = null;
      if (!suppressClick) { var p = localXY(e), h = hitTest(p[0], p[1]), m = toMap(p[0], p[1]), now = Date.now(); if (now - pairAt > DBL_MS) pairHit = h; pairAt = now; if (h) emit("click", placeOf(h), h); emit("mapclick", { x: m[0], y: m[1] }, h); }
    }
    function onDbl(e) { e.preventDefault(); var p = localXY(e), h = Date.now() - pairAt < DBL_MS && pairHit ? pairHit : hitTest(p[0], p[1]); pairHit = null; if (h) emit("dblclick", placeOf(h), h); }   /* a double-click is on what the first click hit, wherever the map has gone since */
    function onWheel(e) { e.preventDefault(); var p = localXY(e); zoomAt(Math.pow(1.0015, -e.deltaY), p[0], p[1]); }
    function onTouchStart(e) {
      if (e.touches.length === 1) { onDown(e.touches[0]); }
      else if (e.touches.length === 2) { pointer = null; var a = localXY(e.touches[0]), b = localXY(e.touches[1]); pinch = { d: Math.sqrt(Math.pow(a[0] - b[0], 2) + Math.pow(a[1] - b[1], 2)), cx: (a[0] + b[0]) / 2, cy: (a[1] + b[1]) / 2 }; }
      if (e.cancelable) e.preventDefault();
    }
    function onTouchMove(e) {
      if (e.touches.length === 2 && pinch) {
        var a = localXY(e.touches[0]), b = localXY(e.touches[1]), d = Math.sqrt(Math.pow(a[0] - b[0], 2) + Math.pow(a[1] - b[1], 2)), cx = (a[0] + b[0]) / 2, cy = (a[1] + b[1]) / 2;
        zoomAt(d / pinch.d, pinch.cx, pinch.cy); T.x += cx - pinch.cx; T.y += cy - pinch.cy; pinch = { d: d, cx: cx, cy: cy }; moved();
      } else if (e.touches.length === 1 && (pointer || drag)) onMove(e.touches[0]);
      if (e.cancelable) e.preventDefault();
    }
    function onTouchEnd(e) { if (e.touches.length === 0) { if (pointer || drag) onUp(e.changedTouches[0]); pinch = null; } }
    /* a resize keeps a view the user has moved, and re-fits one they have not touched */
    function onResize() { resize(); if (!userMoved) fit(); else { baseDirty = true; schedule(); } }

    canvas.addEventListener("mousedown", onDown); root.addEventListener("mousemove", onMove); root.addEventListener("mouseup", onUp);
    canvas.addEventListener("dblclick", onDbl);
    canvas.addEventListener("wheel", onWheel, { passive: false });
    canvas.addEventListener("touchstart", onTouchStart, { passive: false }); canvas.addEventListener("touchmove", onTouchMove, { passive: false }); canvas.addEventListener("touchend", onTouchEnd);
    root.addEventListener("resize", onResize);
    canvas.style.cursor = "grab"; canvas.style.touchAction = "none";

    var api = {
      on: function (ev, fn) { (listeners[ev] = listeners[ev] || []).push(fn); return api; },
      off: function (ev, fn) { listeners[ev] = (listeners[ev] || []).filter(function (f) { return f !== fn; }); return api; },
      /* setDoc(doc, keepView) — a new document; keepView holds the current pan and zoom (the same map, regenerated) */
      /* select(kind, id) keeps a ring on that thing until select(null); it survives setDoc and setMarkers */
      select: function (kind, id) { selected = kind ? { kind: kind, id: id } : null; schedule(); return api; },
      selected: function () { return selected; },
      setDoc: function (d, keepView) { doc = d; hover = null; clearPress(); markers = []; reveal = null; rebuildScene(); if (keepView) { baseDirty = true; schedule(); } else fit(); return api; },
      /* setMarkers(list) — the pins drawn over this document (see TnDMaps.markers); a bad list is refused here, loudly */
      setMarkers: function (list) { list = (list || []).slice(); NS.markers.validate(list, doc.frame); markers = list; hover = null; if (baseScene) compose(); schedule(); return api; },
      markers: function () { return markers; },
      setStyle: function (name) { NS.style.get(name); styleName = name; rebuildScene(); schedule(); return api; },
      setLayerVisible: function (name, visible) { layers[name] = visible !== false; baseDirty = true; schedule(); return api; },
      /* fog of war: draw only these room and passage ids (a dungeon); null lifts it. Markers stay; setDoc clears it */
      setReveal: function (list) { reveal = Array.isArray(list) ? list.slice() : null; rebuildScene(); schedule(); return api; },
      reveal: function () { return reveal ? reveal.slice() : null; },
      fit: function () { fit(); return api; },
      zoom: function (factor) { var s = cssSize(); zoomAt(factor, s.w / 2, s.h / 2); return api; },
      center: function (x, y, k) { var s = cssSize(); if (k) T.k = U.clamp(k, 0.1, 12); T.x = s.w / 2 - x * T.k; T.y = s.h / 2 - y * T.k; baseDirty = true; schedule(); return api; },
      redraw: function () { baseDirty = true; schedule(); return api; },
      transform: function () { return { x: T.x, y: T.y, k: T.k }; },
      /* setOverlay([{pts, closed, dash}]) — outlines drawn above the map (a drag's ghost); null clears them */
      setOverlay: function (items) { overlay = items && items.length ? items : null; schedule(); return api; },
      overlay: function () { return overlay; },
      scene: function () { if (!scene) rebuildScene(); return scene; },
      doc: function () { return doc; },
      /* toPNG(widthPx, cb) — the whole map at the given pixel width; cb(blob) */
      toPNG: function (widthPx, cb) {
        if (!scene) rebuildScene();
        var k = widthPx / scene.width, off = document.createElement("canvas"), c;
        off.width = Math.round(widthPx); off.height = Math.round(scene.height * k);
        c = off.getContext("2d"); c.setTransform(k, 0, 0, k, -(scene.x0 || 0) * k, -(scene.y0 || 0) * k); NS.renderCanvas(c, scene, { layers: layers });
        if (off.toBlob) off.toBlob(cb, "image/png"); else { var url = off.toDataURL("image/png"); cb(url); }
        return api;
      },
      toSVG: function (o) { if (!scene) rebuildScene(); return NS.renderSVG(scene, U.extend({ layers: layers }, o || {})); },
      destroy: function () { clearPress();
        destroyed = true;
        canvas.removeEventListener("mousedown", onDown); root.removeEventListener("mousemove", onMove); root.removeEventListener("mouseup", onUp);
        canvas.removeEventListener("dblclick", onDbl); canvas.removeEventListener("wheel", onWheel); canvas.removeEventListener("touchstart", onTouchStart); canvas.removeEventListener("touchmove", onTouchMove); canvas.removeEventListener("touchend", onTouchEnd);
        root.removeEventListener("resize", onResize);
      }
    };
    rebuildScene(); fit();
    return api;
  }

  NS.view = view;
})(typeof self !== "undefined" ? self : typeof global !== "undefined" ? global : this);

/* ───── 99-api.js ───── */
/* 99-api.js — the public surface. Generators are a TABLE: adding a scale (town, building, dungeon) is adding an entry.
     TnDMaps.generate(kind, params) → document        TnDMaps.digest(doc) → { text, facts }
     TnDMaps.scene(doc, style) → scene                 TnDMaps.renderSVG(scene, opts) → string
     TnDMaps.renderCanvas(ctx, scene, opts)            TnDMaps.view(canvas, doc, opts) → controller
     TnDMaps.validate(doc) → doc (throws on a malformed document)   TnDMaps.migrate(doc) → doc at DOC_VER */
(function (root) {
  "use strict";
  var NS = root.TnDMaps;

  NS.GENERATORS = {
    region: { generate: NS.region.generate, defaults: NS.region.DEFAULTS, validate: NS.region.validate, describe: "Region or continent: coast, rivers, relief, settlements, roads, names." },
    town: { generate: NS.town.generate, defaults: NS.town.DEFAULTS, validate: NS.town.validate, describe: "Town plan for one settlement: wards, streets, walls, landmarks, buildings, fields; nests in a region place via TnDMaps.town.fromRegion." },
    dungeon: { generate: NS.dungeon.generate, defaults: NS.dungeon.DEFAULTS, validate: NS.dungeon.validate, describe: "What lies beneath or beyond: the sewers under a town's streets (TnDMaps.dungeon.fromTown), the catacombs beneath them and the caves behind a region's cave mouth (TnDMaps.dungeon.fromRegion), each level with its chambers and its portals up and down (TnDMaps.dungeon.fromDungeon)." },
    interior: { generate: NS.interior.generate, defaults: NS.interior.DEFAULTS, validate: NS.interior.validate, describe: "The floor plan of one building — an inn, a smithy, a temple, a keep, a house —, every floor on one sheet with its rooms, doors, windows and furniture (TnDMaps.interior.fromTown: a town's trade, temple or keep by its portal)." },
    wild: { generate: NS.wild.generate, defaults: NS.wild.DEFAULTS, validate: NS.wild.validate, describe: "A zone of open country between the places — a wood, a marsh, a waste, a mountain pass, the downs, a heath — at the town's scale, with its water, its track, its cover and the points of interest the GM needs (TnDMaps.wild.fromRegion: the ground at a point on the region)." }
  };
  /* portals: the ways into another zone, the same list on every document — {id, kind, name, x, y, to: {generator, site?,
     id}}; the id on the far side matches, so the game can put the party where it came out */
  NS.validatePortals = function (doc) {
    NS.assert(Array.isArray(doc.portals), "document.portals must be an array", { portals: doc.portals });
    var ids = {};
    doc.portals.forEach(function (p, i) {
      NS.assert(p && p.id && !ids[p.id] && typeof p.kind === "string" && isFinite(p.x) && isFinite(p.y) && p.to && typeof p.to.generator === "string", "portal " + i + " is malformed or its id is not unique", { portal: p });
      ids[p.id] = true;
    });
    return doc;
  };
  NS.generate = function (kind, params) {
    var gen = NS.own(NS.GENERATORS, kind);
    NS.assert(gen, "unknown generator kind", { kind: kind, known: Object.keys(NS.GENERATORS) });
    return gen.generate(params);
  };
  NS.scene = NS.scene || {};
  NS.sceneOf = function (doc, style) { return NS.scene.build(NS.validate(doc), style); };

  /* validate: the shape every consumer relies on — the common envelope here, the generator-specific shape through the
     table entry; loud on anything missing */
  function validate(doc) {
    NS.assert(doc && typeof doc === "object", "document must be an object", { got: typeof doc });
    NS.assert(doc.format === NS.DOC_FORMAT, "document format must be " + NS.DOC_FORMAT, { format: doc.format });
    NS.assert(doc.ver === NS.DOC_VER, "document ver " + doc.ver + " is not " + NS.DOC_VER + " — run TnDMaps.migrate first", { ver: doc.ver });
    NS.assert(doc.frame && doc.frame.width > 0 && doc.frame.height > 0 && doc.frame.kmPerUnit > 0, "document frame is malformed", { frame: doc.frame });
    NS.assert(doc.title && typeof doc.title.name === "string", "document.title.name must be a string", { title: doc.title });
    var gen = doc.generator && NS.own(NS.GENERATORS, doc.generator.name);
    NS.assert(gen, "document.generator.name must be a known generator", { generator: doc.generator, known: Object.keys(NS.GENERATORS) });
    NS.assert(Array.isArray(doc.warnings), "document.warnings must be an array", { warnings: doc.warnings });
    return gen.validate(doc);
  }
  /* migrations: a table from version → the function that lifts a document to version + 1 */
  var MIGRATIONS = {
    /* 1 → 2: a town's inns were landmarks of kind "inn" with building.inn; they are now establishments with stable ids */
    1: function (doc) {
      if (doc.generator && doc.generator.name === "town") {
        var n = 0, est = [];
        (doc.landmarks || []).forEach(function (l) {
          if (l.kind !== "inn") return;
          var idx = -1, bd = Infinity; (doc.buildings || []).forEach(function (b, i) { if (!b.inn) return; var c = NS.geom.centroid(b.pts), d = NS.geom.dist(c, [l.x, l.y]); if (d < bd) { bd = d; idx = i; } });
          n++; est.push({ id: "inn-" + n, kind: "inn", word: "inn", icon: "tankard", name: l.name, x: l.x, y: l.y, building: idx, ward: l.ward === undefined ? null : l.ward, district: null, authored: false });
          if (idx >= 0) { doc.buildings[idx].est = "inn-" + n; delete doc.buildings[idx].inn; }
        });
        doc.landmarks = (doc.landmarks || []).filter(function (l) { return l.kind !== "inn"; });
        doc.establishments = est;
        doc.params = doc.params || {}; if (!doc.params.establishments) doc.params.establishments = {}; if (!doc.params.edits) doc.params.edits = [];
      }
      doc.ver = 2; return doc;
    },
    /* 2 → 3: the mill left the catalogue — a mill stands on a waterway or out in the fields, not among the town's
       trades (a landscape feature to come). A town's establishments of a kind the catalogue no longer has are dropped,
       their houses freed, with a warning; the params lose them too so the document still reproduces. */
    2: function (doc) {
      if (doc.generator && doc.generator.name === "town" && Array.isArray(doc.establishments)) {
        var C = NS.establishments.CATALOGUE, gone = doc.establishments.filter(function (e) { return !C[e.kind]; });
        gone.forEach(function (e) { var b = doc.buildings && doc.buildings[e.building]; if (b && b.est === e.id) delete b.est; });
        doc.establishments = doc.establishments.filter(function (e) { return !!C[e.kind]; });
        if (gone.length) { doc.warnings = doc.warnings || []; doc.warnings.push("migration 2 → 3 dropped " + gone.length + " establishment(s) of a retired kind: " + gone.map(function (e) { return e.name + " (" + e.word + ")"; }).join(", ")); }
        if (doc.params && doc.params.establishments) Object.keys(doc.params.establishments).forEach(function (k) { if (!C[k]) delete doc.params.establishments[k]; });
        if (doc.params && Array.isArray(doc.params.edits)) doc.params.edits = doc.params.edits.filter(function (e) { return !(e && e.op === "add" && !C[e.kind]); });
      }
      doc.ver = 3; return doc;
    },
    /* 3 → 4: every document carries `portals` (the ways into another zone). A region's are its places; a town's are its
       roads (back to the region) and its sewer entrances (down into the sewer). The outfall needs geometry a migration
       cannot make: a town with grates is told to regenerate for it. */
    3: function (doc) {
      var name = doc.generator && doc.generator.name, C = NS.establishments.CATALOGUE;
      if (name === "region") doc.portals = (doc.places || []).map(function (p) { return { id: p.id, kind: "place", name: p.name, x: p.x, y: p.y, to: { generator: "town", id: null } }; });
      else if (name === "town") {
        doc.portals = (doc.roads || []).map(function (r) { var end = r.pts[r.pts.length - 1]; return { id: r.id, kind: "road", name: r.to && r.to.length ? "the road to " + r.to.join(" and ") : "the " + r.bearing + " road", x: end[0], y: end[1], to: { generator: "region", id: (doc.site && doc.site.placeId) || null } }; });
        var downs = (doc.establishments || []).filter(function (e) { return C[e.kind] && C[e.kind].portal; });
        downs.forEach(function (e) { var pt = C[e.kind].portal; doc.portals.push({ id: e.id, kind: pt.kind, name: e.name, x: e.x, y: e.y, to: { generator: pt.generator, site: pt.site, id: e.id } }); });
        if (downs.length) { doc.warnings = doc.warnings || []; doc.warnings.push("migration 3 → 4: this town's sewers have no outfall until it is regenerated (TnDMaps.generate(\"town\", doc.params))"); }
      } else doc.portals = doc.portals || [];
      doc.ver = 4; return doc;
    },
    /* 4 → 5: a region carries its `caves` (the mouths on the hillsides, portals into the caves behind them). A migration
       cannot place them: the region is told to regenerate for its caves. */
    4: function (doc) {
      if (doc.generator && doc.generator.name === "region" && !Array.isArray(doc.caves)) { doc.caves = []; doc.warnings = doc.warnings || []; doc.warnings.push("migration 4 → 5: this region has no caves until it is regenerated (TnDMaps.generate(\"region\", doc.params))"); }
      doc.ver = 5; return doc;
    },
    /* 5 → 6: a town's portals include the doors INTO its buildings — every trade that stands in a house, the temple and
       the keep (an interior, 45); the migration derives them, nothing else changed shape */
    5: function (doc) {
      if (doc.generator && doc.generator.name === "town") {
        doc.portals = (doc.portals || []).filter(function (p) { return !(p.to && p.to.generator === "interior"); });
        (doc.establishments || []).forEach(function (e) { if (e.building === null || e.building === undefined) return; doc.portals.push({ id: e.id, kind: "door", name: e.name, x: e.x, y: e.y, to: { generator: "interior", site: NS.interior.programOf(e.kind), id: e.id } }); });
        (doc.landmarks || []).forEach(function (l) { if ((l.kind === "temple" || l.kind === "keep") && l.poly) doc.portals.push({ id: l.id, kind: "door", name: l.name, x: l.x, y: l.y, to: { generator: "interior", site: l.kind, id: l.id } }); });
      }
      doc.ver = 6; return doc;
    }
  };
  function migrate(doc) {
    NS.assert(doc && doc.format === NS.DOC_FORMAT, "not a tndmap document", { format: doc && doc.format });
    var v = doc.ver | 0;
    while (v < NS.DOC_VER) { NS.assert(NS.own(MIGRATIONS, v), "no migration from document ver " + v, { ver: v }); doc = MIGRATIONS[v](doc); v = doc.ver; }
    NS.assert(v === NS.DOC_VER, "document ver " + v + " is newer than this library (" + NS.DOC_VER + ")", { ver: v });
    return doc;
  }
  NS.validate = validate; NS.migrate = migrate; NS.MIGRATIONS = MIGRATIONS;
})(typeof self !== "undefined" ? self : typeof global !== "undefined" ? global : this);

/* ───── module footer ───── */
(function (root) {
  if (typeof module !== "undefined" && module.exports) module.exports = root.TnDMaps;
})(typeof self !== "undefined" ? self : typeof global !== "undefined" ? global : this);
