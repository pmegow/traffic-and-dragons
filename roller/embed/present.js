// embed/present.js — where a host's dice are laid out before the roll, and how they are thrown from there (owner
// 2026-10-30, in Traffic and Dragons' check modal: "it would be cool if the die (dice) that will be rolled appeared at the
// bottom of the screen ready to roll"). Pure, node-tested (test/present.test.js); embed/overlay.js ▸ present and roll apply
// it with the view's own screen edges (render/framing.js ▸ screenBounds) and its reading direction.
//
// The dice are DROPPED (core drop) onto a strip of floor along the bottom edge of the screen — so they lie as a settled
// roll lies, spaced by the drop's own open-floor rule, each on an honest face — and thrown from there the way the app's
// tap throw goes from the bottom edge (demo/tap-throw.js, v0.64.8): up the screen toward the middle of the table, at the
// speed that lands dice about there.

import { tapThrow, TAP_THROW } from '../demo/tap-throw.js';

/**
 * The strip: `margin` m in from the bottom edge of the visible floor (a drop keeps its starts 2.2 cm inside the walls
 * anyway, and a die's hull a little more), `depth` m deep up the screen; `fence` m up from the edge, a wall for the drop
 * only (edgeFence), so a die that bounces on a hard floor stays by the edge (dropped with no fence, four dice on a stone
 * floor came to rest up to 12 cm from it, mid-screen); `lane`: how much of its own offset across the screen a thrown die
 * keeps as it goes (0 would aim every die at the middle; 1 straight up the screen); `slot`: the strip's width across the
 * screen per die presented (a die is about 2.5 cm across), so a lone die lies at the bottom middle.
 */
export const PRESENT = { margin: 0.024, depth: 0.03, fence: 0.07, lane: 0.5, slot: 0.045 };

/**
 * How many presented dice are thrown from where they lie: ONE. A handful thrown together from the strip meets in the air —
 * three dice on a phone's screen touched each other in 57 of 60 throws (4.3 knocks a throw; 41 of 60 on a desktop), with
 * the lanes fanned, the speeds staggered or the dice lifted apart — and a knock re-draws a neighbour's face, so landing
 * every die's value is a search over them all at once (about 6 × 6 × 8 throws for 2d6 + d8, seconds, and a strict
 * search per die spent its budget: 2026-10-31). A handful presented is laid out all the same, and its roll comes in from
 * the edge as every roll did before. Raise this only with a throw that keeps the dice apart (a time stagger, separate
 * landing lanes), measured.
 */
export const THROWN_FROM_REST = 1;

/**
 * The strip of floor along the bottom edge of the screen the presented dice are dropped onto: `edges` the screen as a
 * boundary (screenBounds: its `floor` corners, bottom-left and bottom-right first), `readUp` the floor direction that is
 * up the screen, `count` how many dice — the strip is PRESENT.slot across per die, centred on the bottom middle, never
 * wider than the edge (the drop's open-floor rule is even along a strip, so a lone die dropped on the whole width came
 * to rest at an end of it; a check's die belongs at the bottom middle). An axis-aligned box { center: {x, z}, width,
 * depth } for the roll's tray.area — exact when the camera stands square to the floor's axes (the view's opening pose
 * at any size), a bounding box when it has been turned.
 */
export function edgeStrip(edges, readUp, count = 24, o = PRESENT) {
  const [bl, br] = edges.floor;
  const across = Math.hypot(br.x - bl.x, br.z - bl.z), span = Math.min(across, Math.max(1, count) * o.slot), t = (1 - span / across) / 2;
  const l = { x: bl.x + (br.x - bl.x) * t, z: bl.z + (br.z - bl.z) * t }, r = { x: br.x - (br.x - bl.x) * t, z: br.z - (br.z - bl.z) * t };
  const corners = [];
  for (const p of [l, r]) for (const d of [o.margin, o.margin + o.depth]) corners.push({ x: p.x + readUp.x * d, z: p.z + readUp.z * d });
  const xs = corners.map((c) => c.x), zs = corners.map((c) => c.z);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minZ = Math.min(...zs), maxZ = Math.max(...zs);
  return { center: { x: (minX + maxX) / 2, z: (minZ + maxZ) / 2 }, width: Math.max(maxX - minX, o.depth), depth: Math.max(maxZ - minZ, o.depth) };
}

/**
 * The fence: a side plane for the drop's bounds (core tray.bounds, { normal, offset }: inside where normal · p ≥ offset)
 * standing PRESENT.fence m up the screen from the bottom edge, facing it, so the dropped dice come to rest by the edge
 * whatever the floor. The roll that throws them has no fence: the screen's own edges are its walls.
 */
export function edgeFence(edges, readUp, o = PRESENT) {
  const [bl] = edges.floor;
  const normal = { x: -readUp.x, y: 0, z: -readUp.z };
  return { normal, offset: -(readUp.x * bl.x + readUp.z * bl.z) - o.fence };
}

/**
 * The toss of presented dice toward the table: for each die's position (where it starts, lifted into the hand) the floor
 * velocity {x, z} the app's tap throw would give from there toward `ahead` (the floor point the camera looks at, the
 * middle of the screen), each die aiming PRESENT.lane of its own offset across the screen to the side of it, so a row of
 * dice converges but never on one point. The tap throw's own speed rule: root of the distance, clamped 0.6–3.2 m/s. A die
 * with its aim not up the screen of it (lying level with the middle, or past it) goes straight up the screen at the
 * gentlest throw: never back toward the camera.
 */
export function edgeToss(positions, edges, readUp, ahead, o = PRESENT) {
  const [bl, br] = edges.floor;
  const mid = { x: (bl.x + br.x) / 2, z: (bl.z + br.z) / 2 };
  const side = { x: -readUp.z, z: readUp.x };   // across the screen, along the floor
  const gently = { x: readUp.x * TAP_THROW.min, z: readUp.z * TAP_THROW.min };
  return positions.map((p) => {
    const across = (p.x - mid.x) * side.x + (p.z - mid.z) * side.z;
    const at = { x: ahead.x + side.x * across * o.lane, z: ahead.z + side.z * across * o.lane };
    if ((at.x - p.x) * readUp.x + (at.z - p.z) * readUp.z < TAP_THROW.near) return gently;
    const t = tapThrow({ at, edge: { x: p.x, z: p.z }, ahead, tray: null });
    return t ? t.velocity : gently;
  });
}

/** The dice a host names — strings or { type, value? } — as their types, in order. */
export const typesOf = (dice) => (Array.isArray(dice) ? dice : []).map((d) => (typeof d === 'string' ? d : d && d.type));

/** Whether the dice a host asks to roll are the dice laid out: the same types in the same order. */
export function sameDice(laid, dice) {
  const types = typesOf(dice);
  return !!laid && laid.length > 0 && types.length === laid.length && types.every((t, i) => t === laid[i]);
}
