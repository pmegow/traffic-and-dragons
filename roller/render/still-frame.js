// render/still-frame.js — THE STILL FRAME: when nothing moves, the view draws one supersampled frame (owner
// 2026-10-29, row 60: "See this aliasing here? Is there anything we can do to fix that? Is there a DLSS equivalent we
// could leverage?" — a dotted line along a glossy die's edge).
//
// The dots are specular aliasing: the bevel's highlight is a line thinner than a pixel, and a pixel either catches it
// or misses it. MSAA smooths triangle edges, not shading; three.js already widens the roughness where the normal
// turns fast across a pixel (its geometryRoughness), and the line still beads. More samples are the cure. In motion
// the eye forgives it; at rest it is what the player looks at — and at rest the view draws nothing anyway. So the
// last frame of a sequence is drawn again at a higher pixel ratio, once, a moment after the view goes quiet, and the
// browser draws the canvas down to its size: at 2×, four samples a pixel (measured against a 4× reference, the
// aliasing error of a close d20 fell 38–45%: dev/sparkle-probe.js, 2026-10-29). The next live frame draws at the
// live ratio again. DLSS itself is NVIDIA's driver and tensor-core work, out of a browser's reach; this is its
// honest stand-in.
//
// The ratio comes from a pixel budget, because a supersampled frame multiplies the drawing buffer (with MSAA, some
// 36 bytes a pixel): the largest rung whose buffer fits, 2 then 1.5 (bilinear at 1.5 still averages; measured at
// about half of 2×'s gain), else 1 and no still frame. Pure; node-tested (test/still-frame.test.js).

export const STILL_FRAME = {
  after: 150,                // ms of quiet before the still frame is drawn
  rungs: [2, 1.5],           // pixel-ratio multipliers tried, best first
  budget: 9e6,               // pixels the still frame's buffer may hold: a 1920 × 1080 window at ratio 1 draws at 2×
  budgetTouch: 4e6,          // on a phone or tablet: an iPhone (786 × 1704 live) draws at 1.5×, an iPad on its side at 1
};

/**
 * The pixel-ratio multiplier for a still frame of a `width` × `height` (CSS px) view at `pixelRatio`: the first rung
 * whose buffer stays within `budget` pixels, or 1 when none does.
 */
export function stillRatio({ width, height, pixelRatio, budget = STILL_FRAME.budget, rungs = STILL_FRAME.rungs } = {}) {
  if (!(width > 0 && height > 0 && pixelRatio > 0 && budget > 0)) return 1;
  for (const r of rungs) {
    if (width * height * (pixelRatio * r) ** 2 <= budget) return r;
  }
  return 1;
}
