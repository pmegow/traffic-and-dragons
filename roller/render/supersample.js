// render/supersample.js — THE SUPERSAMPLE: on a desktop the view draws every frame at a higher pixel ratio and the
// browser draws it down (owner 2026-10-29, row 60: "See this aliasing here?" — a dotted line along a glossy die's edge;
// then, of the still frame that drew only the resting frame supersampled: "the pop is noticeable and jarring"; "Yes,
// desktop only").
//
// The dots are specular aliasing: the bevel's highlight is a line thinner than a pixel, and a pixel catches it or misses
// it. MSAA smooths triangle edges, not shading; three.js already widens the roughness where the normal turns fast across
// a pixel (its geometryRoughness), and the line still beads. More samples are the cure: at 2×, four a pixel (measured
// against a 4× reference, a close d20's aliasing error fell 38–45%: dev/sparkle-probe.js). Drawing only the resting
// frame that way made the switch itself visible, so every frame is drawn so — on a desktop, where a frame is cheap
// (2.4 ms at 1×, 6.2 ms at 2× on the owner's laptop, all of it GPU fill; the physics is baked before the first frame
// and sound runs off the main thread) and the pixels are coarse enough to show the beads. A touch device draws at 1×:
// its frame is already nearly twice the pixels, its GPU an order slower at filling them, and at 460 pixels an inch the
// beads are a fraction of the size.
//
// The ratio comes from a pixel budget, because the drawing buffer multiplies with it (with MSAA, some 36 bytes a
// pixel): the largest rung whose buffer fits, 2 then 1.5 (bilinear at 1.5 still averages; measured at about half of
// 2×'s gain), else 1. Pure; node-tested (test/supersample.test.js).

export const SUPERSAMPLE = {
  rungs: [2, 1.5],   // pixel-ratio multipliers tried, best first
  budget: 9e6,       // pixels the drawing buffer may hold: a 1920 × 1080 window at ratio 1 draws at 2×, 1440p at 1.5×
  // THE GOVERNOR: a GPU that cannot keep up steps down a rung for the view's life (an integrated laptop GPU is an order
  // slower than the one measured; a 2× frame there could take 40 ms). Frames while animating over maxFrameMs,
  // slowFrames in a row, step the rung down; a frame over 200 ms is a hidden tab or a stall, not a slow frame.
  maxFrameMs: 22,    // under 45 frames a second
  slowFrames: 30,    // in a row: about a second of them, never a single hitch (a shader compile, a buffer allocation)
};

/** The rung below `rung`: the next in the list, or 1. */
export function stepDown(rung, rungs = SUPERSAMPLE.rungs) {
  const i = rungs.indexOf(rung);
  return i >= 0 && i + 1 < rungs.length ? rungs[i + 1] : 1;
}

/**
 * The pixel-ratio multiplier for a `width` × `height` (CSS px) view at `pixelRatio`: 1 on a touch device (`touch`),
 * else the first rung whose buffer stays within `budget` pixels, or 1 when none does.
 */
export function supersampleRatio({ width, height, pixelRatio, touch = false, budget = SUPERSAMPLE.budget, rungs = SUPERSAMPLE.rungs } = {}) {
  if (touch || !(width > 0 && height > 0 && pixelRatio > 0 && budget > 0)) return 1;
  for (const r of rungs) {
    if (width * height * (pixelRatio * r) ** 2 <= budget) return r;
  }
  return 1;
}
