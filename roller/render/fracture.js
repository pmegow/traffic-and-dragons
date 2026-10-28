// render/fracture.js — THE SHATTER's pieces (owner 2026-10-27: "Yes start the shatter ... Let's start with 10 pieces
// +-3"): a die's mesh cut into convex pieces, a Voronoi cell each — the die clipped by the plane halfway between its
// seed and every other. The die is convex, so every cell is the die cut by a few flat planes and every cut face is
// one convex polygon: no CSG. Plain arrays and no three.js, so node tests it.
//
//   const seeds = fractureSeeds(die.core, pieceCount(random), random)   // well-spread points inside the die
//   const pieces = fractureMesh(mesh, seeds, { innerUV, innerColor })
//   for (const piece of fracturePieces(mesh, seeds, …)) …   // the same, a piece at a time (spread over frames)
//
// mesh is a triangle soup in the die's own space ({ position, normal, uv, color }, flat arrays, as
// render/die-mesh.js builds it). Each piece is the same, plus its centroid, its volume and `support`: a few of its
// points (the furthest along 26 directions) that stand in for it on the floor. A piece keeps the die's own
// attributes where it keeps its surface, so its numerals stay printed; a cut face takes `innerUV` (the atlas's
// blank cell: no numeral) and `innerColor`, and its flat normal. The die's patterns are solid (render/patterns.js
// reads the die's own space), so a piece kept in the die's space shows the veins running on through the break.

import { SHATTER } from './exit-table.js';

/** How many pieces a die breaks into: SHATTER.pieces ± SHATTER.spread, evenly. */
export function pieceCount(random = Math.random) {
  const { pieces, spread } = SHATTER;
  return pieces - spread + Math.floor(random() * (2 * spread + 1));
}

/**
 * `count` seeds inside the die's core (render/die-mesh.js sweeps the core by its edge radius), spread out: each
 * the best of a few random candidates, the one furthest from the seeds already placed (Mitchell's best candidate),
 * so no two pieces are slivers of one another.
 */
export function fractureSeeds(core, count, random = Math.random, candidates = 12) {
  const R = Math.max(...core.vertices.map((v) => Math.hypot(v.x, v.y, v.z)));
  const inside = (p) => core.faces.every((f) => f.normal.x * p[0] + f.normal.y * p[1] + f.normal.z * p[2] <= 0.85 * f.offset);
  const sample = () => {
    for (;;) {
      const p = [(2 * random() - 1) * R, (2 * random() - 1) * R, (2 * random() - 1) * R];
      if (inside(p)) return p;
    }
  };
  const seeds = [];
  while (seeds.length < count) {
    let best = null, far = -1;
    for (let k = 0; k < (seeds.length ? candidates : 1); k++) {
      const p = sample();
      const d = seeds.length ? Math.min(...seeds.map((s) => dist(p, s))) : 0;
      if (d > far) { far = d; best = p; }
    }
    seeds.push(best);
  }
  return seeds;
}

/**
 * The die's mesh cut into one convex piece per seed. Refuses a seed outside the mesh or a piece that comes out
 * empty, by name: a shatter that silently lost a piece would leave a hole in the die.
 *
 * A triangle is kept whole where it lies inside a cell, dropped where it lies outside one of its planes, and clipped
 * only by the planes it straddles; a piece's broken face on a plane is the die's cross-section there (found once
 * for the two seeds the plane parts) clipped by the piece's other planes. (Clipping the whole die by every plane
 * for every piece took 200 ms for a d20 in 13 pieces on a desktop, measured 2026-10-27; this takes ~20 ms.)
 */
export function fractureMesh(mesh, seeds, options) {
  return [...fracturePieces(mesh, seeds, options)];
}

/** fractureMesh's pieces one at a time, in seed order: the shatter cuts a few each frame while its cracks run. */
export function* fracturePieces(mesh, seeds, { innerUV = [0, 0], innerColor = 1 } = {}) {
  const tris = trianglesOf(mesh), X = flatPositions(tris);
  const sections = new Map();
  for (let i = 0; i < seeds.length; i++) {
    const si = seeds[i];
    const planes = [];
    seeds.forEach((sj, j) => {
      if (j === i) return;
      const n = normalize(sub(sj, si));
      planes.push({ j, n, d: dot(n, scale(add(si, sj), 0.5)) });
    });
    const polys = [];
    for (let t = 0; t < tris.length; t++) {
      const tri = tris[t], o = 9 * t;
      let out = false;
      const straddled = [];
      for (const pl of planes) {
        const [nx, ny, nz] = pl.n;
        const a = nx * X[o] + ny * X[o + 1] + nz * X[o + 2] - pl.d, b = nx * X[o + 3] + ny * X[o + 4] + nz * X[o + 5] - pl.d, c = nx * X[o + 6] + ny * X[o + 7] + nz * X[o + 8] - pl.d;
        if (a > EPS && b > EPS && c > EPS) { out = true; break; }
        if (a > EPS || b > EPS || c > EPS) straddled.push(pl);
      }
      if (out) continue;
      let kept = [tri];
      for (const pl of straddled) kept = clip(kept, pl.n, pl.d);
      polys.push(...kept);
    }
    for (const pl of planes) {
      const key = Math.min(i, pl.j) + ':' + Math.max(i, pl.j);
      if (!sections.has(key)) sections.set(key, sectionOf(tris, X, pl.n, pl.d));   // facing +n, from the lower seed's side
      let face = sections.get(key);
      if (!face) continue;
      if (i > pl.j) face = [...face].reverse();   // the same face, seen from the other side
      for (const other of planes) if (other !== pl && face.length >= 3) face = clipPoints(face, other.n, other.d);
      if (face.length >= 3) polys.push({ v: face.map((p) => vtx(p, pl.n, innerUV, innerColor)), inner: true });
    }
    if (!polys.length) throw new Error('fractureMesh: piece ' + i + ' came out empty (its seed is outside the die?)');
    yield soupOf(polys);
  }
}

// ---------------------------------------------------------------- the cut

const EPS = 1e-12;

/** A vertex: position, normal, uv, colour. */
const vtx = (p, n, t, c) => ({ p, n, t, c });

function trianglesOf(mesh) {
  const { position: P, normal: N, uv: T, color: C } = mesh;
  const polys = [];
  for (let i = 0; i < P.length / 3; i += 3) {
    const v = [0, 1, 2].map((k) => {
      const a = i + k;
      return vtx([P[3 * a], P[3 * a + 1], P[3 * a + 2]], [N[3 * a], N[3 * a + 1], N[3 * a + 2]], [T[2 * a], T[2 * a + 1]], C ? C[3 * a] : 1);
    });
    polys.push({ v, inner: false });
  }
  return polys;
}

/** Every triangle's three positions, one after another, for the hot loops. */
function flatPositions(tris) {
  const X = new Float64Array(9 * tris.length);
  tris.forEach((t, i) => t.v.forEach((v, k) => X.set(v.p, 9 * i + 3 * k)));
  return X;
}

/**
 * Keeps the part of each polygon where n·p ≤ d. A point where an edge crosses the plane is found from the edge's two
 * ends in one fixed order, so the two faces sharing the edge — and the cross-section — get the very same point and
 * the piece stays closed.
 */
function clip(polys, n, d) {
  const out = [];
  for (const poly of polys) {
    const s = poly.v.map((v) => dot(n, v.p) - d);
    if (s.every((x) => x <= EPS)) { out.push(poly); continue; }
    if (s.every((x) => x >= -EPS)) continue;
    const kept = [];
    for (let k = 0; k < poly.v.length; k++) {
      const a = poly.v[k], b = poly.v[(k + 1) % poly.v.length], sa = s[k], sb = s[(k + 1) % poly.v.length];
      if (sa <= EPS) kept.push(a);
      if ((sa < -EPS && sb > EPS) || (sa > EPS && sb < -EPS)) kept.push(crossing(a, b, sa, sb));
    }
    if (kept.length >= 3) out.push({ v: kept, inner: poly.inner });
  }
  return out;
}

/** Where edge a–b crosses the plane (signed distances sa, sb), every attribute carried along the edge. */
function crossing(a, b, sa, sb) {
  // The same order for both faces of the edge: by position, so the shared edge gives the same bits either way.
  if (less(b.p, a.p)) { [a, b] = [b, a]; [sa, sb] = [sb, sa]; }
  const t = sa / (sa - sb);
  const lerp = (x, y) => x.map((xi, i) => xi + t * (y[i] - xi));
  return vtx(lerp(a.p, b.p), normalize(lerp(a.n, b.n)), lerp(a.t, b.t), a.c + t * (b.c - a.c));
}

const less = (a, b) => a[0] !== b[0] ? a[0] < b[0] : a[1] !== b[1] ? a[1] < b[1] : a[2] < b[2];

/**
 * The die's cross-section on the plane n·p = d: where its mesh's edges cross it (each found once), a convex
 * polygon in order round its middle, facing +n; null where the plane misses the die.
 */
function sectionOf(tris, X, n, d) {
  const found = new Map(), s = [0, 0, 0];
  for (let t = 0; t < tris.length; t++) {
    const tri = tris[t], o = 9 * t;
    for (let k = 0; k < 3; k++) s[k] = n[0] * X[o + 3 * k] + n[1] * X[o + 3 * k + 1] + n[2] * X[o + 3 * k + 2] - d;
    if ((s[0] > EPS && s[1] > EPS && s[2] > EPS) || (s[0] < -EPS && s[1] < -EPS && s[2] < -EPS)) continue;
    for (let k = 0; k < 3; k++) {
      const sa = s[k], sb = s[(k + 1) % 3];
      if ((sa < -EPS && sb > EPS) || (sa > EPS && sb < -EPS)) {
        const p = crossing(tri.v[k], tri.v[(k + 1) % 3], sa, sb).p;
        found.set(p.join(','), p);
      }
    }
  }
  const points = [...found.values()];
  if (points.length < 3) return null;
  const mid = scale(points.reduce(add, [0, 0, 0]), 1 / points.length);
  const u = normalize(sub(points[0], mid)), w = cross(n, u);
  const angle = (p) => Math.atan2(dot(sub(p, mid), w), dot(sub(p, mid), u));
  return points.sort((a, b) => angle(a) - angle(b));
}

/** A convex polygon of points, kept where n·p ≤ d. */
function clipPoints(points, n, d) {
  const s = points.map((p) => dot(n, p) - d);
  if (s.every((x) => x <= EPS)) return points;
  if (s.every((x) => x >= -EPS)) return [];
  const kept = [];
  for (let k = 0; k < points.length; k++) {
    let a = points[k], b = points[(k + 1) % points.length], sa = s[k], sb = s[(k + 1) % points.length];
    if (sa <= EPS) kept.push(a);
    if ((sa < -EPS && sb > EPS) || (sa > EPS && sb < -EPS)) {
      if (less(b, a)) { [a, b] = [b, a]; [sa, sb] = [sb, sa]; }
      const t = sa / (sa - sb);
      kept.push([a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1]), a[2] + t * (b[2] - a[2])]);
    }
  }
  return kept;
}

// ---------------------------------------------------------------- a piece as a mesh

/** 26 directions: the faces, edges and corners of a cube. A piece's furthest point along each stands in for it. */
const DIRECTIONS = [];
for (const x of [-1, 0, 1]) for (const y of [-1, 0, 1]) for (const z of [-1, 0, 1]) if (x || y || z) DIRECTIONS.push(normalize([x, y, z]));

function soupOf(polys) {
  const position = [], normal = [], uv = [], color = [];
  let inner = 0;
  for (const poly of polys) {
    for (let k = 1; k + 1 < poly.v.length; k++) {
      for (const v of [poly.v[0], poly.v[k], poly.v[k + 1]]) {
        position.push(...v.p); normal.push(...v.n); uv.push(...v.t); color.push(v.c, v.c, v.c);
      }
      if (poly.inner) inner++;
    }
  }
  const { volume, centroid } = solid(position);
  const points = [];
  for (let i = 0; i < position.length; i += 3) points.push([position[i], position[i + 1], position[i + 2]]);
  const support = [];
  for (const dir of DIRECTIONS) {
    let best = points[0], far = -Infinity;
    for (const p of points) { const x = dot(p, dir); if (x > far) { far = x; best = p; } }
    if (!support.some((q) => dist(q, best) < 1e-9)) support.push(best);
  }
  return {
    position: Float32Array.from(position), normal: Float32Array.from(normal), uv: Float32Array.from(uv), color: Float32Array.from(color),
    volume, centroid, support, inner,
  };
}

/** The volume and centroid of a closed triangle soup, by the divergence theorem (about `origin`). */
export function solid(position, origin = [0, 0, 0]) {
  let volume = 0;
  const c = [0, 0, 0];
  for (let i = 0; i < position.length; i += 9) {
    const a = sub([position[i], position[i + 1], position[i + 2]], origin);
    const b = sub([position[i + 3], position[i + 4], position[i + 5]], origin);
    const e = sub([position[i + 6], position[i + 7], position[i + 8]], origin);
    const v = dot(a, cross(b, e)) / 6;
    volume += v;
    for (let k = 0; k < 3; k++) c[k] += v * (a[k] + b[k] + e[k]) / 4;
  }
  return { volume, centroid: add(scale(c, 1 / volume), origin) };
}

// ---------------------------------------------------------------- vectors
function add(a, b) { return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; }
function sub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
function scale(a, s) { return [a[0] * s, a[1] * s, a[2] * s]; }
function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
function dist(a, b) { return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]); }
function normalize(a) { const l = Math.hypot(a[0], a[1], a[2]); return [a[0] / l, a[1] / l, a[2] / l]; }
