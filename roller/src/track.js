// src/track.js — reading a baked roll back: the pose of one die at any moment.
//
// Renderer-agnostic on purpose: a three.js view, a 2D canvas or a test reads the same poses.
// Frames are interpolated (positions linearly, orientations by normalized lerp — at 60 frames a
// second the difference from a true slerp is invisible). The pose returned is the VISUAL one:
// the physics orientation followed by the die's printing turn (see roll.js ▸ FORCED RESULTS).

import { qmul, qnormalize } from './math.js';

/** The visual pose {position, orientation} of die i of a roll result at time t (seconds). */
export function samplePose(result, i, t) {
  const d = result.dice[i];
  if (!d) throw new Error('samplePose: the roll has no die ' + i);
  const last = result.frames - 1;
  const f = t * result.fps;
  if (f >= last) return { position: { ...d.rest.position }, orientation: { ...d.rest.visual } };
  const k = f <= 0 ? 0 : Math.floor(f), u = f <= 0 ? 0 : f - k;
  const a = k * 7, b = Math.min(k + 1, last) * 7, tr = d.track;
  const position = {
    x: tr[a] + (tr[b] - tr[a]) * u,
    y: tr[a + 1] + (tr[b + 1] - tr[a + 1]) * u,
    z: tr[a + 2] + (tr[b + 2] - tr[a + 2]) * u,
  };
  const sign = tr[a + 3] * tr[b + 3] + tr[a + 4] * tr[b + 4] + tr[a + 5] * tr[b + 5] + tr[a + 6] * tr[b + 6] < 0 ? -1 : 1;
  const q = qnormalize({
    x: tr[a + 3] + (sign * tr[b + 3] - tr[a + 3]) * u,
    y: tr[a + 4] + (sign * tr[b + 4] - tr[a + 4]) * u,
    z: tr[a + 5] + (sign * tr[b + 5] - tr[a + 5]) * u,
    w: tr[a + 6] + (sign * tr[b + 6] - tr[a + 6]) * u,
  });
  return { position, orientation: qmul(q, d.printing) };
}

/** How long the roll lasts, in seconds (its last frame is the settled pose). */
export const rollDuration = (result) => (result.frames - 1) / result.fps;
