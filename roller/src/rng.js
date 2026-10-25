// src/rng.js — the seeded random stream every throw is drawn from.
//
// mulberry32: 32-bit state, integer arithmetic only, so one seed gives the same stream on every
// engine. The samplers below use rejection instead of trigonometry for the same reason (see
// math.js ▸ DETERMINISM CONTRACT).

import { v3, scale } from './math.js';

/** Mixes a seed and a counter into a new 32-bit seed (the retry seeds of one roll). */
export function mixSeed(seed, n) {
  let h = (seed ^ Math.imul(n + 0x9e3779b9, 0x85ebca6b)) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x7feb352d) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x846ca68b) >>> 0;
  return (h ^ (h >>> 16)) >>> 0;
}

export function createRng(seed) {
  if (!Number.isInteger(seed)) throw new Error('createRng: the seed must be an integer, got ' + seed);
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const range = (lo, hi) => lo + (hi - lo) * next();

  /** A uniformly distributed unit vector (rejection from the cube onto the ball). */
  function unitVector() {
    for (;;) {
      const x = range(-1, 1), y = range(-1, 1), z = range(-1, 1);
      const l2 = x * x + y * y + z * z;
      if (l2 > 1e-6 && l2 <= 1) return scale(v3(x, y, z), 1 / Math.sqrt(l2));
    }
  }

  /** A uniformly distributed rotation (rejection in the 4-ball, then normalized). */
  function quaternion() {
    for (;;) {
      const x = range(-1, 1), y = range(-1, 1), z = range(-1, 1), w = range(-1, 1);
      const l2 = x * x + y * y + z * z + w * w;
      if (l2 > 1e-6 && l2 <= 1) {
        const s = 1 / Math.sqrt(l2);
        return { x: x * s, y: y * s, z: z * s, w: w * s };
      }
    }
  }

  return { next, range, unitVector, quaternion };
}
