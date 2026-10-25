// src/collide.js — contact generation for rounded convex dice.
//
// Every die is a core polyhedron swept by a sphere of radius `margin`. Contacts are found
// between the cores and then pushed out by the margins, so a separation is always the gap
// between the ROUNDED surfaces (negative = penetration).
//
//   die vs plane  every core vertex closer than the threshold is a contact point
//   die vs die    the separating-axis test over face normals and Minkowski-face edge pairs
//                 (Gregorius, "Robust Contact Creation for Physics Simulations", GDC 2015),
//                 then reference/incident face clipping or the closest points of two edges
//
// A manifold is {normal (from A to B), contacts: [{point, separation}]}, at most four points.

import { add, sub, scale, dot, cross, lengthSq, normalize, lerp } from './math.js';

const MAX_POINTS = 4;
const EDGE_TOLERANCE = 1e-4;   // m: an edge axis must beat the best face axis by this much to win
const FACE_TOLERANCE = 1e-5;   // m: prefer A's face over B's unless B's is clearly better

/** Contacts between a body and a static plane; the normal is the plane's (pointing at the body). */
export function collidePlane(body, pl, threshold) {
  const n = pl.normal, r = body.margin;
  const contacts = [];
  body.worldVertices.forEach((v, i) => {
    const separation = dot(n, v) - pl.offset - r;
    if (separation < threshold) {
      contacts.push({ point: sub(v, scale(n, r + separation / 2)), separation, feature: i });
    }
  });
  if (!contacts.length) return null;
  return { normal: n, contacts: reduce(contacts, n) };
}

/** Contacts between two bodies, or null when they are farther apart than the threshold. */
export function collideHulls(A, B, threshold) {
  const rSum = A.margin + B.margin;
  const limit = threshold + rSum;
  const fa = faceQuery(A, B);
  if (fa.separation > limit) return null;
  const fb = faceQuery(B, A);
  if (fb.separation > limit) return null;
  const eq = edgeQuery(A, B);
  if (eq.separation > limit) return null;

  const faceBest = Math.max(fa.separation, fb.separation);
  let m;
  if (eq.separation > faceBest + EDGE_TOLERANCE) m = edgeContact(A, B, eq, threshold);
  else if (fa.separation + FACE_TOLERANCE >= fb.separation) m = faceContact(A, B, fa.face, false, threshold);
  else m = faceContact(B, A, fb.face, true, threshold);
  return m && m.contacts.length ? m : null;
}

/** The face of P whose plane best separates Q: max over P's faces of (min over Q's vertices of n·v) − offset. */
function faceQuery(P, Q) {
  let separation = -Infinity, face = -1;
  for (let i = 0; i < P.worldNormals.length; i++) {
    const n = P.worldNormals[i];
    let min = Infinity;
    for (const v of Q.worldVertices) { const s = dot(n, v); if (s < min) min = s; }
    const s = min - P.faceOffsets[i];
    if (s > separation) { separation = s; face = i; }
  }
  return { separation, face };
}

/** Do the Gauss-map arcs a→b and c→d cross? (They do when the edge pair builds a Minkowski face.) */
function isMinkowskiFace(a, b, c, d) {
  const bxa = cross(b, a), dxc = cross(d, c);
  const cba = dot(c, bxa), dba = dot(d, bxa), adc = dot(a, dxc), bdc = dot(b, dxc);
  return cba * dba < 0 && adc * bdc < 0 && cba * bdc > 0;
}

/** The best separating axis among edge pairs whose cross product is a face of the Minkowski difference. */
function edgeQuery(A, B) {
  let best = { separation: -Infinity };
  const cA = A.position;
  for (const ea of A.shape.edges) {
    const a = A.worldNormals[ea.faces[0]], b = A.worldNormals[ea.faces[1]];
    const P1 = A.worldVertices[ea.a], Q1 = A.worldVertices[ea.b];
    const E1 = sub(Q1, P1);
    for (const eb of B.shape.edges) {
      const c = B.worldNormals[eb.faces[0]], d = B.worldNormals[eb.faces[1]];
      if (!isMinkowskiFace(a, b, scale(c, -1), scale(d, -1))) continue;
      const P2 = B.worldVertices[eb.a], Q2 = B.worldVertices[eb.b];
      const E2 = sub(Q2, P2);
      const x = cross(E1, E2);
      const l2 = lengthSq(x);
      if (l2 < 1e-6 * lengthSq(E1) * lengthSq(E2)) continue;   // parallel edges: a face axis covers them
      let axis = scale(x, 1 / Math.sqrt(l2));
      if (dot(axis, sub(P1, cA)) < 0) axis = scale(axis, -1);
      const separation = dot(axis, sub(P2, P1));
      if (separation > best.separation) best = { separation, axis, P1, Q1, P2, Q2 };
    }
  }
  return best;
}

/** Clips a polygon to the half-space n·x ≤ offset (Sutherland–Hodgman). */
function clip(poly, n, offset) {
  const out = [];
  for (let k = 0; k < poly.length; k++) {
    const a = poly[k], b = poly[(k + 1) % poly.length];
    const da = dot(n, a) - offset, db = dot(n, b) - offset;
    if (da <= 0) out.push(a);
    if ((da <= 0) !== (db <= 0)) out.push(lerp(a, b, da / (da - db)));
  }
  return out;
}

/**
 * Face contact: R's face `face` is the reference; the most anti-parallel face of I is clipped
 * to the reference face's side planes and every clipped point near the plane is a contact.
 * flip says R is body B, so the A→B normal is the reference normal reversed.
 */
function faceContact(R, I, face, flip, threshold) {
  const nR = R.worldNormals[face], dR = R.faceOffsets[face];
  let inc = 0, minDot = Infinity;
  I.worldNormals.forEach((n, k) => { const d = dot(n, nR); if (d < minDot) { minDot = d; inc = k; } });
  let poly = I.shape.faces[inc].verts.map((vi) => I.worldVertices[vi]);
  const ref = R.shape.faces[face].verts.map((vi) => R.worldVertices[vi]);
  for (let k = 0; k < ref.length && poly.length; k++) {
    const p = ref[k], q = ref[(k + 1) % ref.length];
    const side = normalize(cross(sub(q, p), nR));
    poly = clip(poly, side, dot(side, p));
  }
  const rR = R.margin, rI = I.margin;
  const contacts = [];
  poly.forEach((x, i) => {
    const h = dot(nR, x) - dR;                 // core-to-core height above the reference plane
    const separation = h - rR - rI;
    if (separation < threshold) {
      const onInc = sub(x, scale(nR, rI));
      const onRef = add(sub(x, scale(nR, h)), scale(nR, rR));
      contacts.push({ point: lerp(onInc, onRef, 0.5), separation, feature: i });
    }
  });
  if (!contacts.length) {
    // The incident face missed the reference face's footprint (a corner grazing near an edge):
    // the incident hull's lowest vertex stands in, so a touching pair is never contact-free.
    let x = null, h = Infinity;
    for (const v of I.worldVertices) { const s = dot(nR, v) - dR; if (s < h) { h = s; x = v; } }
    const separation = h - rR - rI;
    if (separation < threshold) {
      contacts.push({ point: lerp(sub(x, scale(nR, rI)), add(sub(x, scale(nR, h)), scale(nR, rR)), 0.5), separation, feature: 99 });
    }
  }
  const normal = flip ? scale(nR, -1) : nR;
  return { normal, contacts: reduce(contacts, normal) };
}

/** Edge contact: one point between the closest points of the two edges. */
function edgeContact(A, B, eq) {
  const [c1, c2] = closestOnSegments(eq.P1, eq.Q1, eq.P2, eq.Q2);
  const n = eq.axis;
  const separation = dot(n, sub(c2, c1)) - A.margin - B.margin;
  const point = lerp(add(c1, scale(n, A.margin)), sub(c2, scale(n, B.margin)), 0.5);
  return { normal: n, contacts: [{ point, separation, feature: 0 }] };
}

/** The closest points of segments p1q1 and p2q2 (Ericson, Real-Time Collision Detection 5.1.9). */
export function closestOnSegments(p1, q1, p2, q2) {
  const d1 = sub(q1, p1), d2 = sub(q2, p2), r = sub(p1, p2);
  const a = dot(d1, d1), e = dot(d2, d2), f = dot(d2, r);
  let s, t;
  const c = dot(d1, r), b = dot(d1, d2), denom = a * e - b * b;
  s = denom > 1e-18 ? clamp01((b * f - c * e) / denom) : 0;
  t = (b * s + f) / e;
  if (t < 0) { t = 0; s = clamp01(-c / a); }
  else if (t > 1) { t = 1; s = clamp01((b - c) / a); }
  return [add(p1, scale(d1, s)), add(p2, scale(d2, t))];
}

const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);

/**
 * At most four points: the deepest, the one farthest from it, the one spanning the largest
 * triangle with those two, and the one farthest outside that triangle.
 */
function reduce(contacts, n) {
  if (contacts.length <= MAX_POINTS) return contacts;
  const pts = contacts.slice();
  const take = (i) => pts.splice(i, 1)[0];
  const argmax = (f) => { let bi = 0, bv = -Infinity; pts.forEach((p, i) => { const v = f(p); if (v > bv) { bv = v; bi = i; } }); return bi; };
  const a = take(argmax((p) => -p.separation));
  const b = take(argmax((p) => lengthSq(sub(p.point, a.point))));
  const area = (p, q, r) => dot(cross(sub(q.point, p.point), sub(r.point, p.point)), n);
  const c = take(argmax((p) => Math.abs(area(a, b, p))));
  const s = Math.sign(area(a, b, c)) || 1;
  const d = take(argmax((p) => -Math.min(s * area(a, b, p), s * area(b, c, p), s * area(c, a, p))));
  return [a, b, c, d];
}
