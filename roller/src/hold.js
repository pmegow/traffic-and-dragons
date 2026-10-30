// src/hold.js — THE HAND: the dice picked up, held, shaken and let go (owner 2026-10-29, TODO row 8: "A kinematic hand
// that holds the dice, shakes them and lets go" — "see what you can do").
//
// A hold is a live world, not a baked roll: the dice sit inside a cup — six planes round the hand — that moves as the
// hand moves, and the solver runs as the host asks (createHold → step(seconds, target), every frame). The cup's planes
// are KINEMATIC: they carry the hand's velocity into every contact (world.js ▸ movingGround), so the floor of the cup
// drags the dice along by friction, a wall coming at a die knocks it, and a quick shake rattles them for real — every
// knock a recorded hit, for the host's clicks. Nothing here is a trajectory the host could not have chosen: the hand is
// the player's, read from the pointer. When the hand lets go, states() hands the dice — where they are, as they move —
// to roll({ throw: { states } }), and the baked roll starts exactly there.
//
// Determinism as the rest of the core: given the same targets at the same seconds, the same hold.

import { Body, plane } from './body.js';
import { World } from './world.js';
import { SURFACES, lookup, boundary } from './materials.js';
import { v3, add, sub, scale, dot, length } from './math.js';

export const HOLD_DEFAULTS = {
  surface: 'felt',    // what the hand feels like to the dice (SURFACES): soft
  height: 0.05,       // m: the cup's inside height
  maxSpeed: 4,        // m/s: the hand never moves faster (a pointer that jumps is not a throw)
  wakeSpeed: 0.02,    // m/s: a hand moving this fast wakes every die, so none sleeps through a wall
};

/** The cup's inside width (= depth) for n dice: room for a loose layer of them. */
export function cupSize(n) {
  if (!(Number.isInteger(n) && n > 0)) throw new Error('cupSize: n must be a positive whole number, got ' + n);
  let side = 1;
  while (side * side < n) side++;   // the smallest square grid that holds them
  return 0.03 + 0.024 * side;
}

/**
 * Where n dice sit in a cup of inside width `size`, at rest on its floor: a grid with a little jitter from `rng`
 * (createRng), each slot {x, z} relative to the hand, a die's own `up` (its rest height above the floor) is the host's.
 */
export function cupSlots(n, size, rng) {
  if (!(Number.isInteger(n) && n > 0)) throw new Error('cupSlots: n must be a positive whole number, got ' + n);
  let side = 1;
  while (side * side < n) side++;
  const pitch = size / side, slots = [];
  for (let i = 0; i < n; i++) {
    const row = (i - (i % side)) / side, col = i % side;
    const jitter = pitch * 0.12;
    slots.push({
      x: (col + 0.5) * pitch - size / 2 + (rng ? rng.range(-jitter, jitter) : 0),
      z: (row + 0.5) * pitch - size / 2 + (rng ? rng.range(-jitter, jitter) : 0),
    });
  }
  return slots;
}

/**
 * Picks the dice up: `dice` = [{ die, position, orientation, velocity?, angularVelocity? }] (a built die each, and
 * where it is in the world), `hand` {x, y, z} the cup's centre. Options: surface (SURFACES key), size (m, the cup's
 * inside width and depth: cupSize(n) unless given), height, maxSpeed, world (World options).
 *
 *   hold.step(seconds, target)   moves the hand toward `target` over `seconds` (its speed capped) and runs the world
 *                                that long; returns the hits recorded meanwhile [{ t, body, speed, surface, other }]
 *   hold.states()                [{ position, orientation, velocity, angularVelocity }] per die, for a throw
 *   hold.hand, hold.velocity     where the hand is, and how it moved over the last step (m/s)
 *   hold.inside(point)           true when a point is inside the cup (the tests ask)
 */
export function createHold(dice, hand, options = {}) {
  if (!Array.isArray(dice) || !dice.length) throw new Error('createHold: dice must be a non-empty array');
  for (const k of Object.keys(options)) {
    if (!(k in HOLD_DEFAULTS) && k !== 'size' && k !== 'world') throw new Error('createHold: unknown option "' + k + '" (known: ' + Object.keys(HOLD_DEFAULTS).join(', ') + ', size, world)');
  }
  const o = { ...HOLD_DEFAULTS, ...options };
  const size = o.size ?? cupSize(dice.length);
  if (!(size > 0 && o.height > 0)) throw new Error('createHold: the cup needs a positive size and height, got ' + size + ' × ' + o.height);
  const surface = lookup(SURFACES, o.surface, 'hand surface');
  // No rise cap in the hand: the cup's floor may lift the dice as fast as the hand moves (a cap would leave them in the
  // floor), and its ceiling bounds any leap; the speed cap stays (the hand's walls move at most maxSpeed).
  const world = new World({ maxRise: 0, ...(o.world || {}) });
  const half = { x: size / 2, y: o.height / 2, z: size / 2 };
  // The cup: inward normals; offsets follow the hand (placeCup).
  const walls = [
    { normal: v3(0, 1, 0), kind: 'floor' }, { normal: v3(0, -1, 0), kind: 'ceiling' },
    { normal: v3(1, 0, 0), kind: 'wall' }, { normal: v3(-1, 0, 0), kind: 'wall' },
    { normal: v3(0, 0, 1), kind: 'wall' }, { normal: v3(0, 0, -1), kind: 'wall' },
  ].map((w) => world.addPlane(plane(w.normal, 0, w.kind === 'floor' ? surface : boundary(surface), w.kind)));   // the floor drags, the sides slip
  let at = v3(hand.x, hand.y, hand.z), velocity = v3();
  const placeCup = (v) => {
    for (const pl of walls) {
      const n = pl.normal;
      pl.offset = dot(n, at) - (half.x * (n.x < 0 ? -n.x : n.x) + half.y * (n.y < 0 ? -n.y : n.y) + half.z * (n.z < 0 ? -n.z : n.z));
      pl.velocity = v;
    }
  };
  placeCup(velocity);
  const bodies = dice.map((d) => world.addBody(new Body(d.die, { position: d.position, orientation: d.orientation, velocity: d.velocity, angularVelocity: d.angularVelocity })));
  const dt = world.o.dt;

  return {
    get hand() { return at; },
    get velocity() { return velocity; },
    get world() { return world; },
    inside(p) {
      return p.x >= at.x - half.x && p.x <= at.x + half.x && p.y >= at.y - half.y && p.y <= at.y + half.y && p.z >= at.z - half.z && p.z <= at.z + half.z;
    },
    step(seconds, target) {
      if (!(seconds > 0)) throw new Error('hold.step: seconds must be positive, got ' + seconds);
      const steps = Math.max(1, Math.round(seconds / dt));
      const want = sub(target, at);
      const dist = length(want), span = steps * dt;
      const speed = dist / span;
      const v = speed > o.maxSpeed ? scale(want, o.maxSpeed / dist) : scale(want, 1 / span);   // m/s: the way there, at the cap or in time
      velocity = v;
      const moving = length(v) > o.wakeSpeed;
      const from = world.hits.length;
      for (let i = 0; i < steps; i++) {
        at = add(at, scale(v, dt));
        placeCup(v);
        if (moving) for (const b of bodies) { if (b.asleep) { b.asleep = false; b.sleepTimer = 0; } }
        world.step();
      }
      const hits = world.hits.slice(from);
      world.hits.length = 0;
      return hits;
    },
    states() {
      return bodies.map((b) => ({
        position: { ...b.position },
        orientation: { ...b.orientation },
        velocity: b.asleep ? v3() : { ...b.velocity },
        angularVelocity: b.asleep ? v3() : { ...b.angularVelocity },
      }));
    },
  };
}
