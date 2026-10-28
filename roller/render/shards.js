// render/shards.js — how THE SHATTER's pieces move (render/fracture.js cuts them): each bursts away from the die's
// centre, spinning, falls, and tumbles to rest on the floor. Plain arrays and no three.js, so node tests it.
//
//   const states = burstShards(pieces, { position, quaternion }, random)   // the die's world pose as it breaks
//   stepShards(states, dt, onHit)                                           // every frame; onHit(state, point, speed)
//   shardPose(state) → { position, quaternion }                             // where a piece's centroid is, and its turn
//
// A piece is a rigid body against the floor (y = 0) only — the pieces fly apart, so they do not meet one another
// (owner 2026-10-27: a phone must not be brought to its knees). It touches the floor at its deepest support point
// (fracture.js: its furthest points along 26 directions); its inertia is a solid ball's of its own size, enough for it
// to tumble and settle flat. Sub-stepped at SHATTER.substep, so a long frame never lets a piece through the floor.

import { SHATTER } from './exit-table.js';

/** The pieces' starting states: at the die's pose, each thrown away from its centre and up, spinning. */
export function burstShards(pieces, { position, quaternion }, random = Math.random) {
  const range = ([a, b]) => a + (b - a) * random();
  return pieces.map((p) => {
    const offset = rotate(quaternion, p.centroid);   // the die's own space is centred on its centre of mass
    const out = normalize(offset[0] || offset[1] || offset[2] ? offset : [0, 1, 0]);
    const speed = range(SHATTER.burst), up = range(SHATTER.pop);
    const axis = normalize([2 * random() - 1, 2 * random() - 1, 2 * random() - 1]), spin = range(SHATTER.spin);
    const arms = p.support.map((s) => sub(s, p.centroid));
    const radius = arms.reduce((t, a) => t + Math.hypot(...a), 0) / arms.length;
    return {
      x: add(position, offset),
      v: [out[0] * speed, out[1] * speed + up, out[2] * speed],
      q: [...quaternion],
      w: scale(axis, spin),
      arms,                                   // the support points from the centroid, in the die's own space
      invI: 1 / (0.4 * radius * radius),      // a solid ball's, per unit mass
      hits: 0,
      resting: false,
    };
  });
}

/** Moves every piece on by dt seconds, in sub-steps; onHit(state, point, speed) as one strikes the floor. */
export function stepShards(states, dt, onHit = () => {}) {
  for (let left = dt; left > 1e-9; left -= SHATTER.substep) {
    const h = Math.min(SHATTER.substep, left);
    for (const s of states) if (!s.resting) stepOne(s, h, onHit);
  }
}

/** A piece's pose: its centroid's world position and its rotation (the die's own space to the world). */
export function shardPose(s) {
  return { position: s.x, quaternion: s.q };
}

function stepOne(s, h, onHit) {
  s.v[1] -= SHATTER.gravity * h;
  s.x = add(s.x, scale(s.v, h));
  s.q = normalizeQ(addQ(s.q, scale4(mulQ([s.w[0], s.w[1], s.w[2], 0], s.q), 0.5 * h)));
  // The deepest point: if it is under the floor, the piece is lifted out and the floor pushes back there.
  let r = null, low = Infinity;
  for (const a of s.arms) {
    const ra = rotate(s.q, a), y = s.x[1] + ra[1];
    if (y < low) { low = y; r = ra; }
  }
  if (low >= 0) return;
  s.x[1] -= low;
  const n = [0, 1, 0];
  const vc = add(s.v, cross(s.w, r));   // the contact point's velocity
  if (vc[1] < 0) {
    const speed = -vc[1];
    if (speed > SHATTER.hitSpeed && s.hits < SHATTER.hitsHeard) { s.hits++; onHit(s, add(s.x, r), speed); }
    const e = speed > SHATTER.bounceSpeed ? SHATTER.bounce : 0;
    const rn = cross(r, n);
    const j = (1 + e) * speed / (1 + s.invI * dot(rn, rn));
    s.v = add(s.v, scale(n, j));
    s.w = add(s.w, scale(rn, s.invI * j));
    // Friction against the slide, at most the floor's grip times the push.
    const vc2 = add(s.v, cross(s.w, r)), vt = [vc2[0], 0, vc2[2]], slide = Math.hypot(vt[0], vt[2]);
    if (slide > 1e-9) {
      const t = scale(vt, 1 / slide), rt = cross(r, t);
      const jt = Math.min(slide / (1 + s.invI * dot(rt, rt)), SHATTER.friction * j);
      s.v = sub(s.v, scale(t, jt));
      s.w = sub(s.w, scale(rt, s.invI * jt));
    }
  }
  // On the floor it settles: its turning dies away, and once it is all but still, it rests.
  s.w = scale(s.w, Math.max(0, 1 - SHATTER.settle * h));
  if (Math.hypot(...s.v) < SHATTER.restSpeed && Math.hypot(...s.w) < SHATTER.restSpin) { s.v = [0, 0, 0]; s.w = [0, 0, 0]; s.resting = true; }
}

// ---------------------------------------------------------------- vectors and quaternions ([x, y, z, w])
function add(a, b) { return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; }
function sub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
function scale(a, s) { return [a[0] * s, a[1] * s, a[2] * s]; }
function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
function normalize(a) { const l = Math.hypot(a[0], a[1], a[2]); return [a[0] / l, a[1] / l, a[2] / l]; }
function mulQ(a, b) {
  return [
    a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
    a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
    a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
    a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2],
  ];
}
function addQ(a, b) { return [a[0] + b[0], a[1] + b[1], a[2] + b[2], a[3] + b[3]]; }
function scale4(a, s) { return [a[0] * s, a[1] * s, a[2] * s, a[3] * s]; }
function normalizeQ(a) { const l = Math.hypot(a[0], a[1], a[2], a[3]); return [a[0] / l, a[1] / l, a[2] / l, a[3] / l]; }
/** v turned by quaternion q. */
export function rotate(q, v) {
  const t = scale(cross(q, v), 2);   // cross with q's vector part
  return add(add(v, scale(t, q[3])), cross(q, t));
}
