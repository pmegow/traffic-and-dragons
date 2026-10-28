// render/goo.js — Melt's goo (owner 2026-10-28: "break apart the die, let the pieces fall, and try to have some goo
// stretch between the pieces"): the slump a piece melts by, and the strands of goo that stretch between the pieces as
// they part. Plain arrays and no three.js, so node tests it.
//
//   meltRel(rel, { melt, wobble, w, foot, seed })   // a point `rel` from a piece's centre on the floor, slumped: the very
//                                             // sums render/exit-shader.js ▸ exitMeltRel does on the GPU, so a strand
//                                             // stays stuck to a melting piece and the holes know where the puddle lies
//   fallApart(states, R)                      // the pieces' starting states (render/shards.js), the higher the faster
//   const strands = strandsBetween(pieces, R, random)    // where the goo joins them: their shared broken faces
//   const tubes = strandTubes(strand, a, b, since, melt) // a strand's shape this frame: none, one tube, or two halves
//   writeTube(tube, position, normal, at)                // a tube into the goo's buffers (TUBE_VERTICES of them)
//   tubeIndices(tubes)                                   // the triangles of that many tubes, fixed for the exit
//
// A strand joins two pieces at a point on the face they broke apart along. As they part it stretches — thinning as it
// does, its volume kept — sags, and past a length of its own snaps, each half springing back into its piece; as its
// pieces melt it sinks into the puddle and flattens with it. A tube is its rings' centres and radii (across and up),
// closed at each end: an anchored end flat against its piece, a snapped end by a rounded tip.

import { MELT } from './exit-table.js';

// ---------------------------------------------------------------- the slump
/**
 * How far a point `rel` from a piece's centre on the floor is squashed (its height's share) and spread (its width's):
 * w is the piece's size (half its height), foot how far it reaches across the floor, seed turns its uneven rim. The
 * GLSL twin is exitMeltScale.
 */
export function meltScale(rel, { melt, wobble = 0, w, seed = 0 }) {
  const h = clamp01(rel[1] / (2 * w));
  const a = Math.atan2(rel[2], rel[0]);
  const rim = rimOf(a, seed);
  const squash = (1 + wobble) * (1 + (MELT.flat - 1) * melt);
  const spread = 1 / Math.sqrt(1 + wobble) + melt * (MELT.spread * (1 - h) * (1 - h) * rim - MELT.top * h);
  return [squash, spread];
}

/** Where the point goes: squashed and spread, its foot pulled toward a round, lumpy outline (corners in, sides out), its sides bulging. */
export function meltRel(rel, o) {
  const [squash, spread] = meltScale(rel, o);
  const { melt, w, seed = 0 } = o, foot = Math.max(o.foot, 1e-6);
  const h = clamp01(rel[1] / (2 * w));
  const r = Math.hypot(rel[0], rel[2]);
  const dx = r > 1e-6 ? rel[0] / r : 0, dz = r > 1e-6 ? rel[2] / r : 0;
  const rim = rimOf(Math.atan2(rel[2], rel[0]), seed);
  let reach = r * spread;
  const puddle = foot * (1 + MELT.spread) * rim * (1 - h);   // the round outline, for its foot
  reach += (puddle * Math.min(r / (0.6 * foot), 1) - reach) * melt * MELT.round * (1 - h) * (1 - h);
  reach += melt * MELT.bulge * w * Math.sin(Math.PI * h);
  return [dx * reach, Math.max(rel[1], 0) * squash, dz * reach];
}

function rimOf(a, seed) {
  return 1 + MELT.lump * (0.6 * Math.sin(3 * a + seed) + 0.4 * Math.sin(5 * a + 2.3 * seed));
}

// ---------------------------------------------------------------- falling apart
/**
 * The soft lumps fall away from the die's centre: a piece higher up is thrown faster (1 + byHeight × its centroid's
 * height over the die's), so the top slides off the sides while the foot hardly moves. In place on render/shards.js's
 * states.
 */
export function fallApart(states, R) {
  for (const s of states) {
    const k = 1 + MELT.byHeight * clamp01(s.x[1] / (2 * R));
    s.v[0] *= k;
    s.v[2] *= k;
  }
  return states;
}

// ---------------------------------------------------------------- the strands
/**
 * Where the goo joins the pieces: across the faces they broke apart along (render/fracture.js ▸ faces), the widest
 * first, at most MELT.strands, two across a face wider than MELT.wideFace R². Each starts at a point of its face (in
 * the die's own space), as thick as MELT.strandWidth of the face's own radius within MELT.strandRadius, and snaps
 * somewhere in MELT.snap (R) of stretch, at a point along it of its own; it bows sideways by MELT.bow of its length, a way
 * of its own (round 2's last strip: a strand hanging straight down between two lumps read as a table leg).
 */
export function strandsBetween(pieces, R, random = Math.random) {
  const shared = [];
  pieces.forEach((p, i) => {
    for (const f of p.faces) if (f.j > i && pieces[f.j] && pieces[f.j].faces.some((g) => g.j === i)) shared.push({ i, j: f.j, face: f });
  });
  shared.sort((a, b) => b.face.area - a.face.area);
  const strands = [];
  for (const { i, j, face } of shared) {
    const two = face.area > MELT.wideFace * R * R;
    for (let k = 0; k < (two ? 2 : 1) && strands.length < MELT.strands; k++) {
      const corner = face.points[Math.floor(random() * face.points.length)];
      const pull = two ? 0.35 + 0.3 * random() : 0.3 * random();   // two apart on a wide face; one near the middle
      const at = face.centre.map((c, n) => c + pull * (corner[n] - c));
      const r = clamp(MELT.strandWidth * Math.sqrt(face.area / Math.PI), MELT.strandRadius[0] * R, MELT.strandRadius[1] * R);
      const snapAt = range(MELT.snap, random) * R, breakAt = 0.3 + 0.4 * random(), way = 2 * Math.PI * random(), bow = range(MELT.bow, random);
      strands.push({ i, j, at, r, snapAt, breakAt, bow: [bow * Math.cos(way), bow * Math.sin(way)], snapped: -1 });
    }
  }
  return strands;
}

/**
 * A strand's shape this frame, from its two ends (a on piece i, b on piece j: world positions, slumped with their
 * pieces), `since` seconds after the die came apart, its pieces `melt` melted (0 … 1): one tube, or once it has
 * snapped two halves springing back into their pieces, or none once they have. Snapping is remembered on the strand.
 */
export function strandTubes(s, a, b, since, melt) {
  const L = dist(a, b), L0 = 2 * s.r;
  const r = s.r * Math.sqrt(L0 / Math.max(L, L0));   // thinner as it stretches: its volume kept
  if (s.snapped < 0 && L > s.snapAt) s.snapped = since;
  const sag = (MELT.sag + 0.5 * melt) * L * smooth(since / MELT.sagIn);
  const mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2 - sag, (a[2] + b[2]) / 2];
  if (L > 1e-9) {   // bowed sideways, across the strand
    const d = scale(sub(b, a), 1 / L), w = [s.bow[0], 0, s.bow[1]], across = sub(w, scale(d, dot(w, d)));
    for (let k = 0; k < 3; k++) mid[k] += across[k] * L * smooth(since / MELT.sagIn);
  }
  const along = (t) => bezier(a, mid, b, t);
  if (s.snapped < 0) return [tube(along, 0, 1, r, melt, false)];
  const left = 1 - smooth((since - s.snapped) / MELT.recoil);   // how much of each half is still out of its piece
  if (left <= 0) return [];
  return [tube(along, 0, s.breakAt * left, r, melt, true), tube(along, 1, 1 - (1 - s.breakAt) * left, r, melt, true)];
}

/**
 * A tube along the curve from t0 to t1: MELT.rings rings, widest at an anchored end (by MELT.flare), a snapped end
 * (tip) rounding to a point with a little bulb behind it; flattened and widened as its pieces melt; never through the
 * floor. Closed by a point at each end, its end ring drawn in: flat across an anchored end (a point behind it, along the
 * strand, pointed every way on a strand of no length yet: spikes, in the first strip), the tip itself at a tip.
 */
function tube(along, t0, t1, r, melt, tip) {
  const n = MELT.rings, points = [], rh = [], rv = [];
  for (let k = 0; k < n; k++) {
    const u = k / (n - 1), p = along(t0 + (t1 - t0) * u);
    let rr;
    if (tip) {
      const round = u > 0.75 ? Math.sqrt(Math.max(0, 1 - ((u - 0.75) / 0.25) ** 2)) : 1;
      rr = r * (1 + MELT.flare * (1 - Math.sin(Math.PI * u / 2)) ** 2) * (1 + 0.4 * smooth((u - 0.5) / 0.4)) * round;
    } else {
      rr = r * (1 + MELT.flare * (1 - Math.sin(Math.PI * u)) ** 2);
    }
    const up = rr * (1 + (MELT.flat - 1) * melt), across = rr * (1 + MELT.strandSpread * melt);
    // It sinks into the puddle as its pieces melt, lying on the floor by the end (round 2's second strip: strands left
    // up on the blobs stuck out of the puddle as fins); never through the floor.
    p[1] = Math.max(up + (p[1] - up) * (1 - melt), up);
    points.push(p); rh.push(across); rv.push(up);
  }
  const first = [...points[0]], last = [...points[n - 1]];
  return { points: [first, ...points, last], rh: [0, ...rh, 0], rv: [0, ...rv, 0] };
}

/** The vertices a tube writes: its rings and its two end points, each ring of MELT.sides. */
export const TUBE_VERTICES = (MELT.rings + 2) * MELT.sides;

/**
 * Writes a tube's vertices (positions and normals, TUBE_VERTICES of each) into the goo's buffers from vertex `at`. Each
 * ring is an ellipse across the strand — its width across and its height up, in a frame turned with the strand — and
 * each normal the ellipse's. No tube (null) collapses its vertices to a point, which draws nothing.
 */
export function writeTube(t, position, normal, at) {
  const S = MELT.sides, rings = MELT.rings + 2;
  if (!t) {
    for (let i = 3 * at; i < 3 * (at + TUBE_VERTICES); i++) { position[i] = 0; normal[i] = 0; }
    for (let i = at; i < at + TUBE_VERTICES; i++) normal[3 * i + 1] = 1;
    return;
  }
  for (let k = 0; k < rings; k++) {
    const p = t.points[k], prev = t.points[Math.max(0, k - 1)], next = t.points[Math.min(rings - 1, k + 1)];
    let T = normalize(sub(next, prev));
    if (!Number.isFinite(T[0])) T = [1, 0, 0];
    let side = cross(T, [0, 1, 0]);
    if (Math.hypot(...side) < 1e-6) side = cross(T, [1, 0, 0]);
    side = normalize(side);
    const upish = cross(side, T);
    const a = t.rh[k], b = t.rv[k];
    for (let j = 0; j < S; j++) {
      const th = 2 * Math.PI * j / S, c = Math.cos(th), s = Math.sin(th), o = 3 * (at + k * S + j);
      for (let q = 0; q < 3; q++) position[o + q] = p[q] + side[q] * c * a + upish[q] * s * b;
      const nx = side[0] * c / Math.max(a, 1e-9) + upish[0] * s / Math.max(b, 1e-9);
      const ny = side[1] * c / Math.max(a, 1e-9) + upish[1] * s / Math.max(b, 1e-9);
      const nz = side[2] * c / Math.max(a, 1e-9) + upish[2] * s / Math.max(b, 1e-9);
      const l = Math.hypot(nx, ny, nz) || 1;
      normal[o] = nx / l; normal[o + 1] = ny / l; normal[o + 2] = nz / l;
    }
  }
}

/** The triangles of `count` tubes, laid out one after another as writeTube writes them, each facing out. */
export function tubeIndices(count) {
  const S = MELT.sides, rings = MELT.rings + 2, out = [];
  for (let t = 0; t < count; t++) {
    const base = t * TUBE_VERTICES;
    for (let k = 0; k + 1 < rings; k++) {
      for (let j = 0; j < S; j++) {
        const a = base + k * S + j, b = base + (k + 1) * S + j, c = base + k * S + (j + 1) % S, d = base + (k + 1) * S + (j + 1) % S;
        out.push(a, b, c, b, d, c);
      }
    }
  }
  return out;
}

// ---------------------------------------------------------------- numbers
function bezier(a, m, b, t) {
  const u = 1 - t;
  return [0, 1, 2].map((k) => u * u * a[k] + 2 * u * t * m[k] + t * t * b[k]);
}
const clamp01 = (x) => Math.min(1, Math.max(0, x));
const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
const smooth = (x) => { const t = clamp01(x); return t * t * (3 - 2 * t); };
const range = ([lo, hi], random) => lo + (hi - lo) * random();
function add(a, b) { return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; }
function sub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
function scale(a, s) { return [a[0] * s, a[1] * s, a[2] * s]; }
function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
function dist(a, b) { return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]); }
function normalize(a) { const l = Math.hypot(a[0], a[1], a[2]); return [a[0] / l, a[1] / l, a[2] / l]; }
