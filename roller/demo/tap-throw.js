// demo/tap-throw.js — a tap on the table throws from the near edge toward the tap (owner 2026-10-29: "when there are
// dice on the table and the user clicks on the board, the dice are thrown... unless there's a swipe they're thrown left to
// right. Sometimes even WITH a swipe they're thrown left to right. Let's set it so the dice are thrown from the middle of
// the bottom edge along a vector towards the click"). Before this a tap was the default toss, from the left wall to the
// right whatever the tap, and a drag too slow to be a fling (under 0.25 m/s) was a tap.
//
// Pure: the toy hands it floor points from the view (floorHit under the tap — or where a slow drag lifted — under the
// bottom middle of the view, and under its centre) and the drawn tray, and gets the core's fling: from the near edge
// (the bottom middle, kept inside a drawn tray's walls by the core's own margin), along the vector to the tap, at a speed
// that lands the dice about there — the toss's own rule (a die slides v²/2μg, so speed grows with the root of the
// distance; the default toss lands dice 13 cm along at 0.96 m/s). A tap too near the edge to point anywhere is thrown
// straight ahead, at the gentlest speed a fling may have. Node-tested (test/tap-throw.test.js).

export const TAP_THROW = {
  reach: 0.13,          // m: the distance the speed below lands dice at (src/roll.js TOSS_REACH, the 26 cm tray's half)
  speed: 0.96,          // m/s: the default toss's median (strength 0.8 at the middle of its 0.9–1.5 spread)
  min: 0.6, max: 3.2,   // m/s: the toy's fling clamp (demo.js), so a tap by the edge is still a throw and a far one no cannon
  near: 0.02,           // m: a tap this close to the edge has no direction of its own
  margin: 0.022,        // m: the core keeps a throw's start this far inside the walls (src/roll.js keepInside)
};

/**
 * The fling for a tap: `{ from, velocity }` for the roll's `throw.fling`, or null when the points do not make one (then
 * the default toss). `at` is the tap on the floor, `edge` the floor under the bottom middle of the view, `ahead` the floor
 * under its centre (the way "ahead" lies when the tap is at the edge); `tray` is `{ width, depth }` when one is drawn
 * (centred on the origin), null when the screen's edges are the walls.
 */
export function tapThrow({ at, edge, ahead, tray } = {}) {
  if (!at || !edge) return null;
  const from = { x: edge.x, z: edge.z };
  if (tray) {   // the bottom of the screen may lie outside a drawn tray: the throw starts at its near wall, as the core would place it
    const hx = tray.width / 2 - TAP_THROW.margin, hz = tray.depth / 2 - TAP_THROW.margin;
    from.x = Math.max(-hx, Math.min(hx, from.x));
    from.z = Math.max(-hz, Math.min(hz, from.z));
  }
  let dx = at.x - from.x, dz = at.z - from.z, len = Math.hypot(dx, dz);
  let speed;
  if (len >= TAP_THROW.near) {
    speed = TAP_THROW.speed * Math.sqrt(len / TAP_THROW.reach);
  } else {   // at the edge: straight ahead, gently
    if (!ahead) return null;
    dx = ahead.x - from.x; dz = ahead.z - from.z; len = Math.hypot(dx, dz);
    if (len < TAP_THROW.near) return null;
    speed = 0;
  }
  speed = Math.max(TAP_THROW.min, Math.min(TAP_THROW.max, speed));
  return { from, velocity: { x: dx / len * speed, z: dz / len * speed } };
}
