// src/geometry.js — the solids, their convex hulls, adjacency and mass properties.
//
// A die starts life as a point set (SOLIDS). hullFromPoints finds every supporting plane of the
// points by brute force — exact for the handful of vertices a die has — and buildPolyhedron
// derives the faces, edges and per-vertex face rings everything downstream uses. Coordinates
// come from algebraic constants (√5, never cos 72°), so they are bit-identical on every engine.

import {
  v3, add, sub, scale, dot, cross, length, normalize, pseudoAngle,
  mouter, madd, mscale, mtrace, MAT3_IDENTITY,
} from './math.js';

const SQRT5 = Math.sqrt(5);
const PHI = (1 + SQRT5) / 2;

// cos/sin of the pentagon angles, exactly: cos 36° = φ/2, cos 72° = (√5 − 1)/4.
const C36 = (1 + SQRT5) / 4, S36 = Math.sqrt(10 - 2 * SQRT5) / 4;
const C72 = (SQRT5 - 1) / 4, S72 = Math.sqrt(10 + 2 * SQRT5) / 4;
const RING_0 = [[1, 0], [C72, S72], [-C36, S36], [-C36, -S36], [C72, -S72]];       // 0°, 72°, 144°, 216°, 288°
const RING_36 = [[C36, S36], [-C72, S72], [-1, 0], [-C72, -S72], [C36, -S36]];     // 36°, 108°, 180°, 252°, 324°

/**
 * The pentagonal trapezohedron (the d10). The apexes sit at ±apex; the two zigzag rings at ±h,
 * with h fixed by apex so that every kite is exactly planar: h = apex (1 − cos 36°)/(1 + cos 36°).
 */
function trapezohedron5(apex = 1.05) {
  const h = apex * (1 - C36) / (1 + C36);
  const pts = [v3(0, apex, 0), v3(0, -apex, 0)];
  RING_0.forEach(([c, s]) => pts.push(v3(c, h, s)));
  RING_36.forEach(([c, s]) => pts.push(v3(c, -h, s)));
  return pts;
}

function signs3(f) {
  const out = [];
  for (const a of [-1, 1]) for (const b of [-1, 1]) for (const c of [-1, 1]) out.push(f(a, b, c));
  return out;
}

/** The point sets. Scale is arbitrary here; buildPolyhedron rescales to the die's size. */
export const SOLIDS = {
  tetrahedron: () => [v3(1, 1, 1), v3(1, -1, -1), v3(-1, 1, -1), v3(-1, -1, 1)],
  cube: () => signs3((a, b, c) => v3(a, b, c)),
  octahedron: () => [v3(1, 0, 0), v3(-1, 0, 0), v3(0, 1, 0), v3(0, -1, 0), v3(0, 0, 1), v3(0, 0, -1)],
  trapezohedron5: () => trapezohedron5(),
  dodecahedron: () => {
    const p = [...signs3((a, b, c) => v3(a, b, c))];
    for (const a of [-1, 1]) for (const b of [-1, 1]) {
      p.push(v3(0, a / PHI, b * PHI), v3(a / PHI, b * PHI, 0), v3(a * PHI, 0, b / PHI));
    }
    return p;
  },
  icosahedron: () => {
    const p = [];
    for (const a of [-1, 1]) for (const b of [-1, 1]) {
      p.push(v3(0, a, b * PHI), v3(a, b * PHI, 0), v3(a * PHI, 0, b));
    }
    return p;
  },
};

/**
 * Every supporting plane of a point set: faces as vertex-index lists, counter-clockwise seen
 * from outside, with outward unit normals and plane offsets (n·x = offset on the face).
 */
export function hullFromPoints(points, eps = 1e-9) {
  const n = points.length;
  const seen = new Set();
  const faces = [];
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) for (let k = j + 1; k < n; k++) {
    const c = cross(sub(points[j], points[i]), sub(points[k], points[i]));
    const l = length(c);
    if (l < eps) continue;
    let normal = scale(c, 1 / l);
    let offset = dot(normal, points[i]);
    let above = 0, below = 0;
    for (const p of points) {
      const s = dot(normal, p) - offset;
      if (s > eps) above++;
      else if (s < -eps) below++;
    }
    if (above && below) continue;
    if (above) { normal = scale(normal, -1); offset = -offset; }
    const on = [];
    points.forEach((p, idx) => { if (Math.abs(dot(normal, p) - offset) <= eps) on.push(idx); });
    const key = on.join(',');
    if (seen.has(key)) continue;
    seen.add(key);
    faces.push({ verts: orderAround(points, on, normal), normal, offset });
  }
  return faces;
}

/** The vertex indices sorted counter-clockwise around normal (seen from outside). */
function orderAround(points, idx, normal) {
  const c = scale(idx.reduce((s, i) => add(s, points[i]), v3()), 1 / idx.length);
  const u = normalize(sub(points[idx[0]], c));
  const w = cross(normal, u);
  return idx
    .map((i) => { const d = sub(points[i], c); return { i, a: pseudoAngle(dot(d, u), dot(d, w)) }; })
    .sort((p, q) => p.a - q.a)
    .map((p) => p.i);
}

/**
 * The polyhedron of a point set, scaled so its circumradius is `circumradius` and centred on
 * its centre of mass. Returns {vertices, faces, edges, vertexFaces}; refuses a point set whose
 * hull is not a closed convex polyhedron (Euler's V − E + F = 2, two faces per edge).
 */
export function buildPolyhedron(points, circumradius = 1) {
  const hull0 = hullFromPoints(points);
  const com = massProperties({ vertices: points, faces: hull0 }, 1).com;
  const centred = points.map((p) => sub(p, com));
  const R = Math.max(...centred.map(length));
  const vertices = centred.map((p) => scale(p, circumradius / R));
  const faces = hullFromPoints(vertices, 1e-9 * circumradius).map((f) => ({
    ...f,
    centroid: scale(f.verts.reduce((s, i) => add(s, vertices[i]), v3()), 1 / f.verts.length),
  }));

  const edgeMap = new Map();
  faces.forEach((f, fi) => {
    f.verts.forEach((a, k) => {
      const b = f.verts[(k + 1) % f.verts.length];
      const key = a < b ? a + '-' + b : b + '-' + a;
      if (!edgeMap.has(key)) edgeMap.set(key, { a: Math.min(a, b), b: Math.max(a, b), faces: [] });
      edgeMap.get(key).faces.push(fi);
    });
  });
  const edges = [...edgeMap.values()];
  for (const e of edges) {
    if (e.faces.length !== 2) throw new Error('buildPolyhedron: edge ' + e.a + '-' + e.b + ' has ' + e.faces.length + ' faces');
  }
  if (vertices.length - edges.length + faces.length !== 2) {
    throw new Error('buildPolyhedron: Euler characteristic is not 2 (V ' + vertices.length + ', E ' + edges.length + ', F ' + faces.length + ')');
  }

  // The faces around each vertex, counter-clockwise seen from outside (the rounded mesh walks them).
  const vertexFaces = vertices.map((_, vi) => {
    const ring = faces.map((f, fi) => (f.verts.includes(vi) ? fi : -1)).filter((fi) => fi >= 0);
    const axis = normalize(ring.reduce((s, fi) => add(s, faces[fi].normal), v3()));
    const u = normalize(sub(faces[ring[0]].normal, scale(axis, dot(faces[ring[0]].normal, axis))));
    const w = cross(axis, u);
    return ring
      .map((fi) => ({ fi, a: pseudoAngle(dot(faces[fi].normal, u), dot(faces[fi].normal, w)) }))
      .sort((p, q) => p.a - q.a)
      .map((p) => p.fi);
  });

  return { vertices, faces, edges, vertexFaces };
}

/**
 * Volume, mass, centre of mass and the inertia tensor about the centre of mass of a closed
 * polyhedron of uniform density. Exact: the solid is cut into tetrahedra from the origin and each
 * contributes its second-moment (covariance) matrix  det/120 · (Σ vvᵀ + (Σv)(Σv)ᵀ).
 */
export function massProperties(poly, density) {
  let volume = 0;
  let first = v3();
  let C = [0, 0, 0, 0, 0, 0, 0, 0, 0];
  for (const f of poly.faces) {
    const a = poly.vertices[f.verts[0]];
    for (let k = 1; k + 1 < f.verts.length; k++) {
      const b = poly.vertices[f.verts[k]], c = poly.vertices[f.verts[k + 1]];
      const det = dot(a, cross(b, c));
      volume += det / 6;
      const s = add(add(a, b), c);
      first = add(first, scale(s, det / 24));
      C = madd(C, mscale(madd(madd(madd(mouter(a, a), mouter(b, b)), mouter(c, c)), mouter(s, s)), det / 120));
    }
  }
  if (!(volume > 0)) throw new Error('massProperties: non-positive volume ' + volume + ' (faces wound inward?)');
  const com = scale(first, 1 / volume);
  const Ccom = madd(C, mscale(mouter(com, com), -volume));
  const inertia = mscale(madd(mscale(MAT3_IDENTITY, mtrace(Ccom)), mscale(Ccom, -1)), density);
  return { volume, mass: density * volume, com, inertia };
}

/** The inradius: the smallest distance from the centre to a face plane. */
export const inradius = (poly) => Math.min(...poly.faces.map((f) => f.offset));
