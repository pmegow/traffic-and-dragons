// src/roll.js — THE roll: throw the dice, simulate until they settle, read them, return the record.
//
// roll(request) is the library's front door. It bakes the WHOLE roll before anything is shown:
// the dice are thrown from a seed, the world steps until every die sleeps, each die is read, and
// the roll is judged. A roll that fails a gate (a die still moving, a die cocked on a wall or
// the floor, a lazy roll that barely turned) is thrown again from the next seed — the way a
// player re-rolls a die leaning on the tray wall. A die leaning on another die is read as it
// lies, by its most-up face, as a pile is read. The result carries a track (position + orientation per frame) that
// any renderer plays back, the hits a sound layer can follow, and every die's value.
//
// FORCED RESULTS. A die may be asked to show a value. The physics is never touched: the roll is
// simulated honestly and the die's printing is turned by one of its rotation symmetries so the
// requested value is on the face (or corner) that came up. The die's shape is unchanged by a
// symmetry, so every frame of the roll is a real roll of a real, correctly numbered die.

import { buildDie } from './dice.js';
import { Body, plane } from './body.js';
import { World, WORLD_DEFAULTS } from './world.js';
import { collideHulls } from './collide.js';
import { SURFACES, lookup, boundary } from './materials.js';
import { createRng, mixSeed } from './rng.js';
import { v3, add, scale, dot, cross, normalize, qrotate, qmul, qnormalize, mvec, UP } from './math.js';
import { VERSION } from './version.js';

export const TRAY_DEFAULTS = {
  width: 0.26,        // m along x (a small dice tray: dice reach the walls and show up on screen)
  depth: 0.17,        // m along z
  height: 0.3,        // m: the ceiling that keeps dice in the tray
  surface: 'felt',    // the floor (SURFACES)
  walls: 'felt',      // the four walls (SURFACES)
  scale: 0.6,         // multiplies the default width and depth (owner 2026-10-24: the full-size tray was much too large on screen)
  // bounds (optional): side planes [{ normal: {x, y, z}, offset }] in place of the four walls — the normal is a
  //   direction (it is normalised) and a point p is inside when n̂·p ≥ offset, metres along it. The renderer passes
  //   the screen's edges here when no tray is drawn (render/framing.js ▸ screenBounds; owner 2026-10-24). The floor
  //   and the ceiling stay.
  // area (optional, with bounds): { center: {x, z}, width, depth } — where in the bounds a throw starts.
};

/** The most side planes a tray may have. */
const MAX_BOUNDS = 8;

export const ROLL_DEFAULTS = {
  fps: 60,                 // frames per second of the recorded track
  maxSeconds: 12,          // a roll still moving after this is rejected
  maxAttempts: 40,         // seeds tried before the roll fails loudly
  minTurns: 0.25,          // the dice must average at least this many turns after reaching the floor — a roll
                           // that only slid looks staged (a lone die: its own turns; a game's big d20 might ask 1.5).
                           // An average, not a per-die floor: in a crowd one die knocked flat is a natural roll.
                           // A small felt tray tumbles little (mean 0.35–0.7 turns in the 0.6 tray, measured
                           // 2026-10-24, whatever the strength or spin), so the default only rejects a slide.
  cockedAlignment: 0.985,  // the up feature's alignment with vertical below this = cocked (≈ 10°)
  tips: 3,                 // times a die coming to rest cocked may be eased flat before the roll is thrown again (0 = re-throw at once)
  hitMerge: 0.012,         // s: hits of one die closer than this are one hit
  strength: 0.8,           // throw strength multiplier: 0.8 lands the median die just past the tray's middle
                           // (1 sent a third of all dice to the far wall, measured 2026-10-24)
  direction: { x: 1, z: 0 }, // the direction the dice are thrown along the floor
  readUp: { x: 0, y: 0, z: -1 }, // the floor direction that reads as "up" to the viewer (for upright numerals)
};

/** The most dice one roll may hold. */
export const MAX_DICE = 24;
const CROWD = 6;
const TOSS_REACH = 0.13;   // m: the half-width the toss speeds were tuned in (the 26 cm tray)   // dice that fit the default tray; a bigger roll gets a tray with proportionally more floor

/**
 * The tray a roll of `count` dice uses: the default tray times `scale`, grown so its floor area per
 * die stays that of six dice in it, then whatever the caller fixed (an explicit width or depth wins
 * and is not scaled).
 */
export function trayFor(count, partial = {}) {
  // A key set to undefined is unset (a host spreading an option it never had), never undefined over a default.
  const given = Object.fromEntries(Object.entries(partial).filter(([, v]) => v !== undefined));
  const s = given.scale ?? TRAY_DEFAULTS.scale;
  if (!(s > 0)) throw new Error('trayFor: tray.scale must be positive, got ' + s);
  const k = s * Math.max(1, Math.sqrt(count / CROWD));
  return { ...TRAY_DEFAULTS, width: TRAY_DEFAULTS.width * k, depth: TRAY_DEFAULTS.depth * k, ...given, scale: s };
}

/** What a die in the request may carry besides its type and value: overrides of its registry entry (src/dice.js). */
const DIE_OPTIONS = ['material', 'circumradius', 'edgeRadius', 'materialOverrides'];

/**
 * Roll dice. request = {
 *   dice:   [{ type: 'd20', value?: 17, material?, edgeRadius? }, …]   (1..24 dice)
 *   seed?:  integer (default: drawn from Math.random and reported)
 *   tray?:  partial TRAY_DEFAULTS (unset width and depth grow with the dice count: trayFor)
 *   throw?: { strength?, direction?: {x, z},                 the default toss
 *             fling?: { from: {x, z}, velocity: {x, z} },     a player's drag across the floor (m, m/s)
 *             states?: [{position, orientation, velocity, angularVelocity}],   full control, one per die
 *             drop?: { resting: [{position, orientation, velocity?, angularVelocity?}, …] } }   the first dice
 *                                    are on the table (at rest, or still moving as given), the others fall onto open floor
 *   world?: partial WORLD_DEFAULTS (dt, iterations, …)
 *   gates?: { minTurns?, maxSeconds?, maxAttempts?, cockedAlignment?, tips? }
 *   readUp?: {x, y, z}, fps?
 * }
 * Returns the RollResult documented in README.md ▸ The roll result.
 */
export function roll(request) {
  const req = validate(request);
  const rejected = [];
  for (let attempt = 0; attempt < req.maxAttempts; attempt++) {
    const seed = attempt === 0 ? req.seed : mixSeed(req.seed, attempt);
    const sim = simulate(req, seed, attempt);
    const reason = judge(req, sim);
    if (!reason) return finish(req, sim, seed, attempt + 1, rejected);
    rejected.push({ seed, reason });
  }
  const summary = rejected.slice(0, 5).map((r) => r.seed + ': ' + r.reason).join('; ');
  throw new Error('roll: no acceptable roll in ' + req.maxAttempts + ' attempts (' + summary + (rejected.length > 5 ? '; …' : '') + ')');
}

// ---------------------------------------------------------------- request
function validate(request) {
  if (!request || !Array.isArray(request.dice) || !request.dice.length) throw new Error('roll: request.dice must be a non-empty array');
  if (request.dice.length > MAX_DICE) throw new Error('roll: at most ' + MAX_DICE + ' dice per roll, got ' + request.dice.length);
  const dice = request.dice.map((d, i) => {
    const spec = typeof d === 'string' ? { type: d } : d;
    const { type, value, ...options } = spec;
    for (const k of Object.keys(options)) {
      if (!DIE_OPTIONS.includes(k)) throw new Error('roll: die ' + i + ' (' + type + '): unknown option "' + k + '" (known: ' + DIE_OPTIONS.join(', ') + ')');
    }
    const die = buildDie(type, options);
    if (value !== undefined && value !== null) {
      if (!die.featureOfValue.has(value)) throw new Error('roll: die ' + i + ' (' + type + ') cannot show ' + value + ' (values 1..' + die.sides + ')');
    }
    return { die, type, value: value ?? null };
  });
  const gates = request.gates || {};
  const thr = request.throw || {};
  const seed = request.seed ?? Math.floor(Math.random() * 4294967296);
  if (!Number.isInteger(seed)) throw new Error('roll: seed must be an integer, got ' + request.seed);
  const tray = trayFor(dice.length, request.tray || {});
  for (const k of ['width', 'depth', 'height']) {
    if (!(Number.isFinite(tray[k]) && tray[k] > 0)) throw new Error('roll: tray.' + k + ' must be a positive number, got ' + tray[k]);
  }
  lookup(SURFACES, tray.surface, 'surface');
  lookup(SURFACES, tray.walls, 'surface');
  if (tray.bounds !== undefined) {
    const b = tray.bounds, finite = (...xs) => xs.every(Number.isFinite);
    if (!Array.isArray(b) || b.length < 3 || b.length > MAX_BOUNDS) throw new Error('roll: tray.bounds must be 3 to ' + MAX_BOUNDS + ' planes, got ' + (Array.isArray(b) ? b.length : typeof b));
    b.forEach((p, i) => {
      const n = p && p.normal;
      if (!n || !finite(n.x, n.y, n.z, p.offset) || !(n.x * n.x + n.y * n.y + n.z * n.z > 1e-12)) throw new Error('roll: tray.bounds[' + i + '] needs a non-zero normal {x, y, z} and a finite offset');
    });
    const a = tray.area;
    if (a !== undefined && !(a && a.center && finite(a.center.x, a.center.z) && a.width > 0 && a.depth > 0)) throw new Error('roll: tray.area needs a center {x, z} and a positive width and depth');
  }
  const world = { ...(request.world || {}) };
  const dt = world.dt ?? WORLD_DEFAULTS.dt;
  const fps = request.fps ?? ROLL_DEFAULTS.fps;
  const stepsPerFrame = Math.round(1 / (fps * dt));
  if (Math.abs(stepsPerFrame * fps * dt - 1) > 1e-9) throw new Error('roll: fps ' + fps + ' does not divide the step rate ' + (1 / dt));
  if (thr.states && thr.states.length !== dice.length) throw new Error('roll: throw.states has ' + thr.states.length + ' entries for ' + dice.length + ' dice');
  if (thr.states) thr.states.forEach((s, i) => {   // a resting state: a die left on the table while the hand held another
    if (s && s.resting !== undefined && typeof s.resting !== 'boolean') throw new Error('roll: throw.states[' + i + '].resting must be true or false, got ' + JSON.stringify(s.resting));
    if (s && s.resting && !s.orientation) throw new Error('roll: throw.states[' + i + '] rests and needs the orientation it lies in');
  });
  if (thr.fling) {
    const f = thr.fling, ok = (p) => p && Number.isFinite(p.x) && Number.isFinite(p.z);
    if (!ok(f.from) || !ok(f.velocity)) throw new Error('roll: throw.fling needs from {x, z} and velocity {x, z}');
    const s = Math.sqrt(f.velocity.x * f.velocity.x + f.velocity.z * f.velocity.z);
    if (!(s > 0.05)) throw new Error('roll: throw.fling velocity is too slow to throw (' + s.toFixed(3) + ' m/s)');
  }
  if (thr.drop !== undefined) {
    if (thr.states || thr.fling) throw new Error('roll: throw takes one of states, fling or drop');
    const rest = thr.drop && thr.drop.resting, finite = (...xs) => xs.every(Number.isFinite);
    if (!Array.isArray(rest)) throw new Error('roll: throw.drop.resting must be a list of the poses of the dice already on the table');
    if (rest.length > dice.length) throw new Error('roll: throw.drop.resting has ' + rest.length + ' dice for ' + dice.length + ' in the roll');
    rest.forEach((s, i) => {
      const p = s && s.position, q = s && s.orientation;
      if (!p || !finite(p.x, p.y, p.z)) throw new Error('roll: throw.drop.resting[' + i + '] needs a finite position {x, y, z}');
      if (!q || !finite(q.x, q.y, q.z, q.w) || !(q.x * q.x + q.y * q.y + q.z * q.z + q.w * q.w > 1e-12)) throw new Error('roll: throw.drop.resting[' + i + '] needs a finite, non-zero orientation {x, y, z, w}');
      for (const k of ['velocity', 'angularVelocity']) {   // a die still moving carries on as it was going
        const w = s[k];
        if (w !== undefined && !(w && finite(w.x, w.y, w.z))) throw new Error('roll: throw.drop.resting[' + i + '].' + k + ' must be a finite {x, y, z}');
      }
    });
  }
  const pick = (k) => gates[k] ?? ROLL_DEFAULTS[k];
  return {
    dice, seed: seed >>> 0, tray, world, fps, stepsPerFrame,
    // A drop's table does not turn, and a die falling a few centimetres turns little: no turn gate unless asked.
    maxSeconds: pick('maxSeconds'), maxAttempts: pick('maxAttempts'), minTurns: gates.minTurns ?? (thr.drop ? 0 : ROLL_DEFAULTS.minTurns), tips: pick('tips'),
    cockedAlignment: pick('cockedAlignment'), hitMerge: ROLL_DEFAULTS.hitMerge,
    strength: thr.strength ?? ROLL_DEFAULTS.strength,
    direction: normalize(v3((thr.direction || ROLL_DEFAULTS.direction).x, 0, (thr.direction || ROLL_DEFAULTS.direction).z)),
    states: thr.states || null,
    // The dice on the table as they lie (a drop's first resting.length, or a state marked resting): each starts as
    // given on every attempt, never nudged, and keeps the printing the player saw (finish).
    resting: dice.map((d, i) => (thr.drop ? i < thr.drop.resting.length : !!(thr.states && thr.states[i] && thr.states[i].resting))),
    fling: thr.fling || null,
    drop: thr.drop ? { resting: thr.drop.resting.map((s) => ({
      position: v3(s.position.x, s.position.y, s.position.z), orientation: qnormalize(s.orientation),
      velocity: s.velocity ? v3(s.velocity.x, s.velocity.y, s.velocity.z) : v3(),
      angularVelocity: s.angularVelocity ? v3(s.angularVelocity.x, s.angularVelocity.y, s.angularVelocity.z) : v3(),
    })) } : null,
    readUp: normalize(request.readUp || ROLL_DEFAULTS.readUp),
  };
}

// ---------------------------------------------------------------- the tray and the throw
function trayPlanes(tray) {
  const floor = SURFACES[tray.surface], wall = boundary(SURFACES[tray.walls]);   // the sides and the ceiling slip (owner 2026-10-30)
  if (tray.bounds) {
    return [
      plane(v3(0, 1, 0), 0, floor, 'floor'),
      ...tray.bounds.map((b) => plane(v3(b.normal.x, b.normal.y, b.normal.z), b.offset, wall, 'wall')),
      plane(v3(0, -1, 0), -tray.height, wall, 'ceiling'),
    ];
  }
  const hw = tray.width / 2, hd = tray.depth / 2;
  return [
    plane(v3(0, 1, 0), 0, floor, 'floor'),
    plane(v3(1, 0, 0), -hw, wall, 'wall'),
    plane(v3(-1, 0, 0), -hw, wall, 'wall'),
    plane(v3(0, 0, 1), -hd, wall, 'wall'),
    plane(v3(0, 0, -1), -hd, wall, 'wall'),
    plane(v3(0, -1, 0), -tray.height, wall, 'ceiling'),
  ];
}

/**
 * The seeded throw: the dice start in a loose cluster above the floor — on the far side from
 * `direction` for a toss, at the drag's start for a fling — tumbling, and are thrown along it.
 * Explicit states are used as given on the first attempt and nudged a little by the seed on a
 * re-roll — but for a resting one, a die left lying on the table, which starts as given every time.
 */
function throwStates(req, seed, attempt) {
  const rng = createRng(seed);
  if (req.states) {
    const nudge = attempt === 0 ? 0 : 0.04;
    return req.states.map((s, i) => (req.resting[i] ? {
      position: s.position, orientation: s.orientation, velocity: s.velocity || v3(), angularVelocity: s.angularVelocity || v3(),
    } : {
      position: s.position,
      orientation: s.orientation || rng.quaternion(),
      velocity: scale(s.velocity || v3(), 1 + nudge * rng.range(-1, 1)),
      angularVelocity: add(s.angularVelocity || v3(), scale(rng.unitVector(), nudge * 20)),
    }));
  }
  if (req.drop) return dropStates(req, rng);
  const plan = req.fling ? flingPlan(req) : tossPlan(req);
  const dir = plan.dir, side = cross(UP, dir);   // side ⟂ dir along the floor
  const span = req.tray.area || req.tray;
  const across = 0.5 * (span.width * Math.abs(side.x) + span.depth * Math.abs(side.z));
  const n = req.dice.length;
  const spacing = 0.036;
  const perRow = Math.max(1, Math.min(n, Math.floor((2 * across - 0.04) / spacing)));
  const inside = keepInside(req.tray, 0.022);   // every start inside the walls (a fling can begin near one)
  return req.dice.map((d, i) => {
    const row = Math.floor(i / perRow), col = i % perRow, inRow = Math.min(perRow, n - row * perRow);
    const lateral = (col - (inRow - 1) / 2) * spacing + rng.range(-0.003, 0.003);
    const back = row * spacing + rng.range(-0.003, 0.003);   // later rows start further along the throw
    const y = 0.05 + rng.range(0, 0.035) + row * 0.01;
    const speed = plan.speed(rng);
    const sideways = rng.range(-0.22, 0.22) * plan.spread;
    return {
      position: inside(add(add(add(plan.origin, scale(dir, back)), scale(side, lateral)), v3(0, y, 0))),
      orientation: rng.quaternion(),
      velocity: add(add(scale(dir, speed), scale(side, sideways)), v3(0, rng.range(-0.5, 0), 0)),
      angularVelocity: scale(rng.unitVector(), plan.spin * rng.range(15, 35)),
    };
  });
}

/** Moves a point along the floor until it is `margin` inside the tray's walls, or its side planes. */
function keepInside(tray, margin) {
  if (tray.bounds) return (p) => insideBounds(p, tray.bounds, margin);
  const hx = tray.width / 2 - margin, hz = tray.depth / 2 - margin;
  return (p) => v3(Math.max(-hx, Math.min(hx, p.x)), p.y, Math.max(-hz, Math.min(hz, p.z)));
}

const DROP_CANDIDATES = 24;   // floor spots tried for each dropped die; the most open one wins
const DROP_HEIGHT = 0.07;     // m: where the first dropped die starts above the floor; each further one starts higher

/**
 * A drop (owner 2026-10-25: "as dice are added, drop them into the play area"): the dice already on
 * the table (the first resting.length) start where they lie — at rest, or still moving with the
 * velocity and spin given, when a die is dropped onto a table not yet still; each new die falls from above
 * onto the most open spot of the floor among a few seeded candidates — the farthest from both the dice
 * already there and the walls, so the first die lands mid-table, not under an edge — tumbling a little. A re-throw
 * draws new spots and spins for the new dice only: the table is where it was before every attempt.
 */
function dropStates(req, rng) {
  const rest = req.drop.resting;
  const span = req.tray.area || req.tray, mid = (req.tray.area && req.tray.area.center) || { x: 0, z: 0 };
  const inside = keepInside(req.tray, 0.022), clearance = wallClearance(req.tray);
  const taken = rest.map((s) => s.position);
  return req.dice.map((d, i) => {
    if (i < rest.length) return { position: rest[i].position, orientation: rest[i].orientation, velocity: rest[i].velocity, angularVelocity: rest[i].angularVelocity };
    let spot = null, open = -1;
    for (let c = 0; c < DROP_CANDIDATES; c++) {
      const p = inside(v3(mid.x + rng.range(-0.5, 0.5) * span.width, 0, mid.z + rng.range(-0.5, 0.5) * span.depth));
      let room = 2 * Math.max(0, clearance(p));   // a wall counts half as near as a die: a die needs only a little room from one
      room *= room;   // squared, like the gaps to the dice
      for (const q of taken) room = Math.min(room, (p.x - q.x) * (p.x - q.x) + (p.z - q.z) * (p.z - q.z));
      if (room > open) { open = room; spot = p; }
    }
    taken.push(spot);
    const k = i - rest.length;   // dice dropped together start one above another
    const y = Math.min(req.tray.height - 0.03, DROP_HEIGHT + k * 0.03 + rng.range(0, 0.01));
    return {
      position: v3(spot.x, y, spot.z),
      orientation: rng.quaternion(),
      velocity: v3(rng.range(-0.15, 0.15), -0.3, rng.range(-0.15, 0.15)),
      angularVelocity: scale(rng.unitVector(), rng.range(8, 16)),
    };
  });
}

/** How far a floor point is inside the tray's nearest wall, or nearest side plane (negative outside). */
function wallClearance(tray) {
  if (tray.bounds) {
    return (p) => {
      let least = Infinity;
      for (const b of tray.bounds) {
        const n = b.normal, l = Math.sqrt(n.x * n.x + n.y * n.y + n.z * n.z);
        least = Math.min(least, (n.x * p.x + n.y * p.y + n.z * p.z) / l - b.offset);
      }
      return least;
    };
  }
  return (p) => Math.min(tray.width / 2 - Math.abs(p.x), tray.depth / 2 - Math.abs(p.z));
}

/**
 * A point moved, along the floor, until it is at least `margin` inside every side plane: each plane
 * it is short of pushes it straight in. A few sweeps settle it in any convex region the size of a
 * throw. Only + − × ÷ (the determinism contract).
 */
function insideBounds(p, bounds, margin) {
  let x = p.x, z = p.z;
  for (let sweep = 0; sweep < 4; sweep++) {
    for (const b of bounds) {
      const n = b.normal, nn = n.x * n.x + n.y * n.y + n.z * n.z;
      const h = n.x * n.x + n.z * n.z;   // how much of the (unnormalised) normal lies along the floor
      if (h < 1e-9 * nn) continue;        // a floor- or ceiling-like plane: nothing to push along
      const short = b.offset * Math.sqrt(nn) + margin * Math.sqrt(nn) - (n.x * x + n.y * p.y + n.z * z);
      if (short > 0) { x += n.x * short / h; z += n.z * short / h; }
    }
  }
  return v3(x, p.y, z);
}

/** The default toss: from the far side of the tray (or of tray.area), along `direction`, at `strength`. */
function tossPlan(req) {
  const dir = req.direction;
  const span = req.tray.area || req.tray, mid = (req.tray.area && req.tray.area.center) || { x: 0, z: 0 };
  const reach = 0.5 * (span.width * Math.abs(dir.x) + span.depth * Math.abs(dir.z));
  // A die slides v²/2μg before it stops, so a tray of a different size is matched by √(size):
  // dice come to rest the same fraction of the way across any tray. Exactly 1 for the 26 cm tray.
  const fit = Math.sqrt(reach / TOSS_REACH);
  return {
    dir, origin: add(v3(mid.x, 0, mid.z), scale(dir, -(reach - 0.045))),
    speed: (rng) => fit * req.strength * rng.range(0.9, 1.5), spread: req.strength, spin: req.strength,
  };
}

/** A player's fling: from a floor point, along a floor velocity (m/s), its speed kept within ±8%. */
function flingPlan(req) {
  const v = v3(req.fling.velocity.x, 0, req.fling.velocity.z);
  const s = Math.sqrt(dot(v, v));
  const k = Math.min(2, Math.max(0.5, s / 1.2));   // spin and scatter grow with the fling
  return {
    dir: scale(v, 1 / s), origin: v3(req.fling.from.x, 0, req.fling.from.z),
    speed: (rng) => s * rng.range(0.92, 1.08), spread: 0.5 * k, spin: k,
  };
}

/**
 * THE THROW'S ENERGY, as a speed (owner 2026-10-30: cap their velocity at the initial throw speed; they should not be
 * increasing in speed). Nothing a throw does not put in may come out: a die is as fast as its start speed, and the fall from
 * where it starts adds what gravity gives it by the table, sqrt(v^2 + 2gh). The fastest die caps every die: a contact may
 * hand speed from one die to another, never make it from nothing. No throw at all (a speed of zero, a height of zero)
 * keeps the world's own ceiling.
 */
export function throwCap(states) {
  let cap = 0;
  for (const s of states) {
    const v = s.velocity, h = Math.max(0, s.position.y);
    cap = Math.max(cap, Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z - 2 * WORLD_DEFAULTS.gravity * h));
  }
  return cap > 0 ? cap : WORLD_DEFAULTS.maxSpeed;
}

// ---------------------------------------------------------------- simulation
function simulate(req, seed, attempt) {
  const states = throwStates(req, seed, attempt);
  const world = new World({ ...req.world, maxSpeed: req.world.maxSpeed ?? throwCap(states) });
  trayPlanes(req.tray).forEach((p) => world.addPlane(p));
  const bodies = req.dice.map((d, i) => world.addBody(new Body(d.die, states[i])));
  const frames = [];
  const record = () => frames.push(bodies.map((b) => [b.position.x, b.position.y, b.position.z, b.orientation.x, b.orientation.y, b.orientation.z, b.orientation.w]));
  record();
  const maxSteps = Math.ceil(req.maxSeconds / world.o.dt);
  // TIPS. A die coming to rest cocked — leaning on a wall or on another die — is eased off its
  // support the moment it goes quiet (TIP_AFTER), while the roll is still moving, so it slumps
  // flat as part of the roll. Waiting until every die slept (the first version) left it standing
  // still for a second or more and then hopping: a die that settles, then pops (owner 2026-10-24).
  const nudge = createRng(mixSeed(seed, 0x6a09e667));
  const tipped = bodies.map(() => 0);
  while (!world.settled && world.steps < maxSteps) {
    world.step();
    for (const b of bodies) {
      if (b.asleep || b.sleepTimer < TIP_AFTER || tipped[b.index] >= req.tips) continue;
      const { feature, alignment } = readDie(b.die, b.orientation);
      if (alignment >= req.cockedAlignment) continue;
      if (tip(world, b, feature, nudge)) tipped[b.index]++;
    }
    if (world.steps % req.stepsPerFrame === 0) record();
  }
  // Finish on a frame boundary so frame k is always at k / fps and the last frame is the settled
  // pose (stepping a settled world moves nothing).
  if (world.steps % req.stepsPerFrame !== 0) {
    while (world.steps % req.stepsPerFrame !== 0) world.step();
    record();
  }
  return { world, bodies, frames, tipped };
}

const TIP_AFTER = 0.05;   // s a cocked die is quiet before it is eased off its support

/**
 * Eases a cocked die off what it leans on: a small push away from its supports (the walls and dice
 * it touches, never the floor), a slight lift, and a slow turn of its most-upward face toward
 * vertical. Returns false (and does nothing) when the die touches nothing — it is in the air.
 */
function tip(world, b, feature, rng) {
  let away = v3(), touching = false;
  for (const m of world.manifolds.values()) {
    if (m.B !== b && m.A !== b) continue;
    if (!m.contacts.some((c) => c.touching)) continue;
    touching = true;
    if (m.surface === 'floor') continue;
    away = m.B === b ? add(away, m.normal) : add(away, scale(m.normal, -1));
  }
  if (!touching) return false;
  const up = qrotate(b.orientation, b.die.features[feature].dir);
  away = v3(away.x, 0, away.z);
  if (dot(away, away) < 1e-12) away = v3(-up.x, 0, -up.z);   // nothing to lean on: balanced on an edge
  away = dot(away, away) > 1e-12 ? normalize(away) : v3();
  const turn = cross(up, UP);
  const axis = dot(turn, turn) > 1e-12 ? normalize(turn) : v3();
  b.asleep = false;
  b.sleepTimer = 0;
  b.velocity = add(b.velocity, add(scale(away, rng.range(0.05, 0.09)), v3(0, rng.range(0.02, 0.04), 0)));
  b.angularVelocity = add(b.angularVelocity, scale(axis, rng.range(2.5, 4)));
  return true;
}

/** The feature most aligned with vertical, and how well aligned it is (1 = exactly up). */
export function readDie(die, orientation) {
  let feature = -1, alignment = -Infinity;
  die.features.forEach((f, k) => {
    const a = dot(qrotate(orientation, f.dir), UP);
    if (a > alignment) { alignment = a; feature = k; }
  });
  return { feature, alignment };
}

/**
 * Whether die b touches another of the bodies: their hulls within `reach` of each other (the world keeps a contact from
 * that far, so a die resting on another is well inside it — measured at rest in sixteen-dice piles, 317 of 322 cocked dice
 * within 0.1 mm of the die they lean on, and the rest of them leaning on a wall, a millimetre or more from any die).
 */
export function leansOnDie(bodies, b, reach = WORLD_DEFAULTS.speculative) {
  return bodies.some((o) => {
    if (o === b) return false;
    const r = b.die.boundingRadius + o.die.boundingRadius + reach;
    const dx = o.position.x - b.position.x, dy = o.position.y - b.position.y, dz = o.position.z - b.position.z;
    return dx * dx + dy * dy + dz * dz <= r * r && collideHulls(b, o, reach) !== null;
  });
}

function judge(req, sim) {
  if (!sim.world.settled) return 'still moving after ' + req.maxSeconds + ' s';
  for (const b of sim.bodies) {
    // READ AS IT LIES (owner 2026-10-30, row 62). A die cocked against a wall or on the floor is thrown again; a die
    // leaning on another die is read by its most-up face, as players read a pile. With the solver making no energy, a
    // sixteen-dice pile rests with about five dice leaning on dice, and refusing them all refused up to nine piles in ten.
    const { alignment } = readDie(b.die, b.orientation);
    if (alignment < req.cockedAlignment && !leansOnDie(sim.bodies, b, sim.world.o.speculative)) return 'die ' + b.index + ' cocked (alignment ' + alignment.toFixed(4) + ')';
  }
  const mean = sim.bodies.reduce((s, b) => s + b.turns, 0) / sim.bodies.length;
  if (mean < req.minTurns) return 'the dice turned only ' + mean.toFixed(2) + ' times on average';
  return null;
}

// ---------------------------------------------------------------- the result
/**
 * The printing turn that puts `value` on body feature `feature`: among the symmetries that map
 * the value's feature onto it, the one whose numeral reads most nearly along `readUp` at rest.
 */
export function chooseSymmetry(die, feature, value, restOrientation, readUp) {
  const k = die.featureOfValue.get(value);
  let best = null, bestDot = -Infinity;
  for (const s of die.symmetries) {
    if (s.perm[k] !== feature) continue;
    const d = dot(qrotate(restOrientation, mvec(s.m, die.features[k].up)), readUp);
    if (d > bestDot) { bestDot = d; best = s; }
  }
  if (!best) throw new Error('chooseSymmetry: no symmetry of the ' + die.type + ' maps feature ' + k + ' to ' + feature);
  return best;
}

function mergeHits(hits, window) {
  const out = [];
  for (const h of hits) {
    const last = out[out.length - 1];
    if (last && h.t - last[0] < window) { if (h.speed > last[1]) { last[1] = h.speed; last[2] = h.surface; last[3] = h.other; } }
    else out.push([h.t, h.speed, h.surface, h.other]);
  }
  return out;
}

function finish(req, sim, seed, attempts, rejected) {
  const { world, bodies, frames } = sim;
  const dice = bodies.map((b, i) => {
    const spec = req.dice[i];
    const { feature } = readDie(b.die, b.orientation);
    const physical = b.die.features[feature].value;
    const value = spec.value ?? physical;
    // The printing turn that shows `value` on the face that landed up and reads best from readUp.
    // An honest roll gets one too: a turn about the up face keeps its value and only chooses which
    // way round its numeral sits — square to the die's edges, as on a real die, and as legible as
    // the die allows (a d6 within 45° of upright, a d20 within 60°; a d10 has no such turn).
    // A drop's resting die keeps the identity: its pose IS what the player saw, printing included,
    // so its first frame shows it exactly as it lay. Read afresh, it turned a quarter on the spot
    // whenever the camera had turned since its roll, and a die knocked to a new face would have
    // shown a different number before anything touched it (2026-10-28). So does a die left lying while the hand
    // held another (a resting state, owner 2026-10-30).
    const resting = req.resting[i] && spec.value === null;
    const s = resting ? b.die.identity : chooseSymmetry(b.die, feature, value, b.orientation, req.readUp);
    const track = new Float32Array(frames.length * 7);
    frames.forEach((f, k) => track.set(f[i], k * 7));
    return {
      type: spec.type,
      value,
      forced: spec.value !== null,
      feature,
      printing: { x: s.q.x, y: s.q.y, z: s.q.z, w: s.q.w },
      rest: {
        position: { ...b.position },
        orientation: { ...b.orientation },
        visual: qmul(b.orientation, s.q),
      },
      turns: b.turns,
      tipped: sim.tipped[i],
      hits: mergeHits(world.hits.filter((h) => h.body === i), req.hitMerge),
      track,
    };
  });
  return {
    version: VERSION,
    seed: req.seed,
    seedUsed: seed,
    attempts,
    rejected,
    duration: world.time,
    steps: world.steps,
    fps: req.fps,
    frames: frames.length,
    tray: { ...req.tray },
    readUp: req.readUp,
    total: dice.reduce((s, d) => s + d.value, 0),
    dice,
  };
}
