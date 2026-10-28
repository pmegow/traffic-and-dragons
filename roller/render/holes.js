// render/holes.js — Melt's end (owner 2026-10-28: "To get rid of the puddle, grow circles of transparency so it feels
// like the puddle is evaporating in an interesting way. Imagine swiss cheese where the holes just expand until it's
// gone"): where the holes open in the puddle, when, and how fast they grow — fast enough that the last scrap of it is
// gone in time. Plain arrays and no three.js, so node tests it.
//
//   const plan = holePlan(points, middles, random)   // points: [x, z] all over the puddle, its rims too; middles:
//                                                    // where a hole may open (away from the rims)
//   holesAt(plan, t) → [[x, z, radius], …]           // the holes open t seconds into the eating
//
// MELT.holes holes, each where the puddle is furthest from the holes already placed (the best of a few of its middles:
// Mitchell's best candidate), so each new one opens in what is left of it; a few at first, then more, over the first
// MELT.holeOpen of the eating; each grows as the time it has been open to the MELT.holeGrow, at a pace of its own
// (MELT.holeVary either way). The speed is the least that has every one of `points` inside a hole MELT.holeDone of the
// way through the eating — worked out from them, so no scrap is left over.

import { MELT } from './exit-table.js';

export function holePlan(points, middles, random = Math.random, o = MELT) {
  if (!points.length || !middles.length) throw new Error('holePlan: no puddle to eat (' + points.length + ' points, ' + middles.length + ' middles)');
  const holes = [];
  for (let k = 0; k < o.holes; k++) {
    let best = null, far = -1;
    for (let c = 0; c < (holes.length ? 8 : 1); c++) {
      const p = middles[Math.floor(random() * middles.length)];
      const d = holes.length ? Math.min(...holes.map((h) => Math.hypot(h.x - p[0], h.z - p[1]))) : 0;
      if (d > far) { far = d; best = p; }
    }
    const share = o.holes > 1 ? k / (o.holes - 1) : 0;
    holes.push({ x: best[0], z: best[1], t: o.eat * o.holeOpen * Math.pow(share, 1.3), pace: 1 + o.holeVary * (2 * random() - 1) });
  }
  // A point is gone by `done` once some hole's radius there, speed × pace × (done − t)^grow, reaches it: the speed it
  // needs is its distance over the rest, least over the holes; the plan's is the most any point needs. (Squared, and
  // the rest worked out once a hole: a pow per point and hole cost 4–12 ms a die on a desktop, measured 2026-10-28.)
  const done = o.eat * o.holeDone, rest = holes.map((h) => { const d = h.pace * Math.pow(done - h.t, o.holeGrow); return d * d; });
  let need2 = 0;
  for (const p of points) {
    let least = Infinity;
    for (let k = 0; k < holes.length; k++) {
      const dx = holes[k].x - p[0], dz = holes[k].z - p[1], n = (dx * dx + dz * dz) / rest[k];
      if (n < least) least = n;
    }
    if (least > need2) need2 = least;
  }
  return { holes, speed: Math.sqrt(need2), grow: o.holeGrow };
}

/** A hole's radius t seconds into the eating: none before it opens. */
export function holeRadius(plan, h, t) {
  return t <= h.t ? 0 : plan.speed * h.pace * Math.pow(t - h.t, plan.grow);
}

/** The holes open t seconds into the eating, as [x, z, radius]. */
export function holesAt(plan, t) {
  const out = [];
  for (const h of plan.holes) {
    const r = holeRadius(plan, h, t);
    if (r > 0) out.push([h.x, h.z, r]);
  }
  return out;
}
