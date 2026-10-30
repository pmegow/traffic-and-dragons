// render/hand.js — the hand's geometry (owner 2026-10-30), pure and node-tested: where a die picked up rises to, and
// the spin a toss gives it, the height it rests at and the cup it is held in. DiceView (render/view.js ▸ pickUp,
// release) applies them.
import { qrotate } from '../src/math.js';

/**
 * How far toward the camera a die picked up comes: this share of the way from where it lies (owner 2026-10-30: "change
 * the 12% to 25%" — it had risen to the cup's old floor, 2.5 cm, about 12% of the way).
 */
export const HAND_LIFT = 0.25;

/**
 * The point `t` of the way from `p` to the camera's `eye` (owner 2026-10-30: "Instead of moving UP, move the die along
 * a vector from its current position towards the camera to meet the hand"): a die lifted along it never moves on
 * screen, so the hand that pressed it is still on it.
 */
export function towardEye(p, eye, t = HAND_LIFT) {
  return { x: p.x + (eye.x - p.x) * t, y: p.y + (eye.y - p.y) * t, z: p.z + (eye.z - p.z) * t };
}

/**
 * Where a held die may go: the point (x, z) at height `level` moved inside every plane of `planes` ({ normal, offset }:
 * inside where normal · p ≥ offset — the screen's edges, render/framing.js ▸ screenBounds) by at least `r` across the
 * floor, a few sweeps over them all. The edges lean, each running from the camera through an edge of the frame, so they
 * are tested at the level the dice are held (owner 2026-10-30: tested on the floor, a held die "can move out of frame at
 * the top of the scene, but at the bottom, there's a significant area that's blocked off").
 */
export function keepInFrame(p, r, level, planes) {
  let x = p.x, z = p.z;
  for (let sweep = 0; sweep < 4; sweep++) {
    for (const b of planes) {
      const n = b.normal, h = n.x * n.x + n.z * n.z;
      if (h < 1e-9) continue;
      const short = b.offset + r * Math.sqrt(h) - (n.x * x + n.y * level + n.z * z);
      if (short > 0) { x += (n.x * short) / h; z += (n.z * short) / h; }
    }
  }
  return { x, z };
}

/**
 * The spin a toss gives a die (owner 2026-10-30: "add rotational force to the die on release. Picking up a d6 and
 * flinging it wont change the value --it'll just slide without rolling... the faster the fling, the more imparted
 * rotational force"): rolling it forward along `velocity` ({x, z} m/s) at `perSpeed` rad/s for every m/s, its axis
 * tipped by `wobble` ({x, y, z}, each −1…1, scaled by TOSS_SPIN.wobble) so no two tosses turn alike. Rolling forward is
 * the axis up × velocity: a die thrown toward +x turns about −z, its top going the way it goes.
 */
export const TOSS_SPIN = { perSpeed: 40, wobble: 0.3 };

export function tossSpin(velocity, wobble = { x: 0, y: 0, z: 0 }, o = TOSS_SPIN) {
  const s = Math.hypot(velocity.x, velocity.z);
  if (!(s > 0)) return { x: 0, y: 0, z: 0 };
  const ax = velocity.z / s + wobble.x * o.wobble, ay = wobble.y * o.wobble, az = -velocity.x / s + wobble.z * o.wobble;
  const l = Math.hypot(ax, ay, az), w = (o.perSpeed * s) / l;
  return { x: ax * w, y: ay * w, z: az * w };
}

/**
 * How high a die's centre sits above the floor it rests on, lying as `q` turns it: its lowest corner's depth below the
 * centre, plus its rounding (die.core, die.margin). A die picked up rises to exactly this above the cup's floor, so it
 * settles there without dropping (the bounding radius stood a die lying flat a few millimetres too high, 2026-10-30).
 */
export function restHeight(die, q) {
  let low = 0;
  for (const v of die.core.vertices) low = Math.min(low, qrotate(q, v).y);
  return die.margin - low;
}

/**
 * The cup's inside width for dice of these bounding radii: a square grid of them, each with CUP_ROOM to rattle in.
 * Snug, so a die picked up by the screen's edge needs the cup moved in only a few millimetres to keep it over the
 * table (the core's cupSize, a loose layer, is 5.4 cm for one die and moved such a die a centimetre and a half).
 */
export const CUP_ROOM = 0.004;

export function cupFor(radii) {
  if (!radii.length) throw new Error('cupFor: no dice');
  let side = 1;
  while (side * side < radii.length) side++;
  return side * (2 * Math.max(...radii) + CUP_ROOM) + CUP_ROOM;
}
