// src/world.js — the rigid-body world: contact detection, the impulse solver, integration, sleep.
//
// One step (fixed dt) runs:
//   1. forces       gravity and damping into the velocities
//   2. detection    die–die pairs (waking a sleeper that is touched), then die–plane contacts;
//                   a contact is kept from `speculative` metres plus one step's travel away
//   3. prepare      effective masses, the bounce target, warm-starting from last step's impulses
//   4. velocity     sequential impulses: friction (an isotropic Coulomb cone), rolling and spin
//                   resistance, then the non-penetration impulse
//   5. position     split impulses on pseudo-velocities push penetration out without adding energy
//   6. integrate    semi-implicit Euler; the pseudo-velocities are applied once and discarded
//   7. sleep        a die slow enough for long enough stops and is skipped until touched
//
// The normal of a manifold points from A to B. A plane is always A (static), a die always B.

import { collidePlane, collideHulls } from './collide.js';
import { combine } from './materials.js';
import {
  v3, add, sub, scale, addScaled, dot, cross, length, lengthSq,
  mvec, mtranspose, perpendicular, qintegrate, ZERO,
} from './math.js';

export const WORLD_DEFAULTS = {
  gravity: -9.81,              // m/s² along y
  dt: 1 / 600,                 // s per step
  iterations: 12,              // velocity iterations per step
  positionIterations: 4,       // split-impulse iterations per step
  slop: 0.0001,                // m of penetration left alone (keeps resting contacts steady)
  baumgarte: 0.2,              // fraction of the remaining penetration removed per step
  speculative: 0.0005,         // m: contacts are kept this far before touching (plus a step's travel)
  restitutionThreshold: 0.1,   // m/s: slower impacts do not bounce
  hitThreshold: 0.05,          // m/s: slower impacts are not recorded as hits
  linearDamping: 0.05,         // 1/s (air)
  angularDamping: 0.1,         // 1/s (air)
  sleepLinear: 0.01,           // m/s
  sleepAngular: 0.15,          // rad/s
  sleepTime: 0.2,              // s below both thresholds before a die sleeps
  matchDistance: 0.002,        // m: a contact this close to last step's (in the die's frame) inherits its impulses
  // THE CAPS (owner 2026-10-29, row 61: sixteen dice flung into a corner "force each other into the corner, causing them
  // to burst out"). The contact solver, pushing penetrating dice apart, can hand one a speed no throw gave it: measured
  // in that pile, up at 3.7 m/s and a 28 cm leap on a 21 cm tray (dev/corner-probe.js). A die never rises faster than
  // maxRise — a hop of v²/2g, 8 cm — nor moves faster than maxSpeed, whatever the solver asked; ordinary play stays under
  // both (its fastest rise 1.25 m/s, a hard fling's bounce; its fastest die 4.3 m/s, knocked in the hand). The owner's
  // rule was a quarter of the burst (1.08 m/s); the cap sits where ordinary play ends, so no honest roll changes. 0 = off.
  // maxSpeed is the world's own ceiling (the hand's cup, a world with no throw); a roll lowers it to its throw's energy
  // (roll.js, throwCap; owner 2026-10-30: "cap their velocity at the initial throw speed").
  maxRise: 1.25,               // m/s: the fastest a die may rise
  maxSpeed: 5,                 // m/s: the fastest a die may move
};

const TWO_PI = 2 * Math.PI;

export class World {
  constructor(options = {}) {
    for (const k of Object.keys(options)) {
      if (!(k in WORLD_DEFAULTS)) throw new Error('World: unknown option "' + k + '" (known: ' + Object.keys(WORLD_DEFAULTS).join(', ') + ')');
    }
    this.o = { ...WORLD_DEFAULTS, ...options };
    this.bodies = [];
    this.planes = [];
    this.manifolds = new Map();
    this.time = 0;
    this.steps = 0;
    this.hits = [];
  }

  addBody(body) {
    body.index = this.bodies.length;
    body.turns = 0;          // turns made after first touching the floor
    body.touched = false;    // has it touched the floor yet?
    this.bodies.push(body);
    return body;
  }

  addPlane(pl) {
    pl.index = this.planes.length;
    this.planes.push(pl);
    return pl;
  }

  get settled() { return this.bodies.every((b) => b.asleep); }

  step() {
    const o = this.o, dt = o.dt;
    const lin = 1 / (1 + dt * o.linearDamping), ang = 1 / (1 + dt * o.angularDamping);
    for (const b of this.bodies) {
      if (b.asleep) continue;
      b.velocity = scale({ x: b.velocity.x, y: b.velocity.y + o.gravity * dt, z: b.velocity.z }, lin);
      b.angularVelocity = scale(b.angularVelocity, ang);
    }

    const manifolds = this.detect();
    for (const m of manifolds) this.prepare(m);
    for (let i = 0; i < o.iterations; i++) for (const m of manifolds) this.solveVelocity(m);
    // The caps (WORLD_DEFAULTS ▸ maxRise, maxSpeed): the positions still separate — the split impulses below are
    // untouched — so a squeezed pile unpacks at a hop's pace instead of bursting.
    if (o.maxRise > 0 || o.maxSpeed > 0) {
      for (const b of this.bodies) {
        if (b.asleep) continue;
        let v = b.velocity;
        if (o.maxRise > 0 && v.y > o.maxRise) v = { x: v.x, y: o.maxRise, z: v.z };
        const s2 = lengthSq(v);
        if (o.maxSpeed > 0 && s2 > o.maxSpeed * o.maxSpeed) v = scale(v, o.maxSpeed / Math.sqrt(s2));
        b.velocity = v;
      }
    }
    for (let i = 0; i < o.positionIterations; i++) for (const m of manifolds) this.solvePosition(m);

    for (const b of this.bodies) {
      if (b.asleep) continue;
      b.position = addScaled(b.position, add(b.velocity, b.pseudoVelocity), dt);
      b.orientation = qintegrate(b.orientation, add(b.angularVelocity, b.pseudoAngular), dt);
      b.pseudoVelocity = ZERO;
      b.pseudoAngular = ZERO;
      b.updateDerived();
      if (b.touched) b.turns += length(b.angularVelocity) * dt / TWO_PI;
      if (lengthSq(b.velocity) < o.sleepLinear * o.sleepLinear && lengthSq(b.angularVelocity) < o.sleepAngular * o.sleepAngular) {
        b.sleepTimer += dt;
        if (b.sleepTimer >= o.sleepTime) { b.asleep = true; b.velocity = v3(); b.angularVelocity = v3(); }
      } else {
        b.sleepTimer = 0;
      }
    }

    for (const m of manifolds) {
      for (const c of m.contacts) c.Pt = add(scale(m.t1, c.Pt1), scale(m.t2, c.Pt2));
      m.Pr = add(scale(m.t1, m.Pr1), scale(m.t2, m.Pr2));
    }
    this.manifolds = new Map(manifolds.map((m) => [m.key, m]));
    this.time += dt;
    this.steps++;
  }

  // ---------------------------------------------------------------- detection
  detect() {
    const o = this.o, out = [];
    const travel = (b) => (b.asleep ? 0 : (length(b.velocity) + length(b.angularVelocity) * b.die.boundingRadius) * o.dt);
    const bodies = this.bodies;
    for (let i = 0; i < bodies.length; i++) for (let j = i + 1; j < bodies.length; j++) {
      const A = bodies[i], B = bodies[j];
      if (A.asleep && B.asleep) continue;
      const th = o.speculative + travel(A) + travel(B);
      const reach = A.die.boundingRadius + B.die.boundingRadius + th;
      if (lengthSq(sub(A.position, B.position)) > reach * reach) continue;
      const m = collideHulls(A, B, th);
      if (!m) continue;
      const mat = combine(A.material, B.material);
      const sleeper = A.asleep ? A : B.asleep ? B : null;
      const other = sleeper === A ? B : A;
      if (sleeper && other.sleepTimer > 0) {
        // The awake die is itself coming to rest: the sleeper stays asleep and acts as static
        // ground (it has no velocity). Waking it here let two dice resting a hair apart wake
        // each other forever, their sleep timers never lining up.
        const normal = sleeper === A ? m.normal : scale(m.normal, -1);
        out.push(this.manifold('b' + i + ':' + j, null, other, { normal, contacts: m.contacts }, mat, 'die', sleeper.index));
        continue;
      }
      if (sleeper) { sleeper.asleep = false; sleeper.sleepTimer = 0; }
      out.push(this.manifold('b' + i + ':' + j, A, B, m, mat, 'die'));
    }
    for (const b of bodies) {
      if (b.asleep) continue;
      const th = o.speculative + travel(b);
      for (const pl of this.planes) {
        if (dot(pl.normal, b.position) - pl.offset - b.die.boundingRadius > th) continue;
        const m = collidePlane(b, pl, th);
        // A plane that carries a velocity (a held cup's wall, src/hold.js) meets the die as moving ground: its velocity
        // enters every contact and no impulse moves it. A static plane is A = null, exactly as before.
        if (m) out.push(this.manifold('p' + pl.index + ':' + b.index, pl.velocity ? movingGround(pl) : null, b, m, combine(b.material, pl.material), pl.kind));
      }
    }
    return out;
  }

  /** A manifold record, inheriting last step's impulses for contacts that have not moved on the die. */
  manifold(key, A, B, m, mat, surface, partner = A ? A.index : -1) {
    // Only last step's record of this pair WITH THE SAME DIE AS B carries over. A pair keeps its key when one die
    // falls asleep and stands in as ground for the other (A null, B the other): were the other die then B, the
    // old rolling and spin impulses would land on it with their signs turned, and a contact that happened to
    // match in its frame would bring the first die's impulses with it.
    const prev = this.manifolds.get(key);
    const old = prev && prev.B === B ? prev : null;
    const RT = mtranspose(B.rotation);
    const used = new Set();
    const tol2 = this.o.matchDistance * this.o.matchDistance;
    const contacts = m.contacts.map((c) => {
      const local = mvec(RT, sub(c.point, B.position));
      let prev = null;
      if (old) {
        for (const oc of old.contacts) {
          if (!used.has(oc) && lengthSq(sub(oc.local, local)) < tol2) { prev = oc; used.add(oc); break; }
        }
      }
      return {
        point: c.point, separation: c.separation, local,
        Pn: prev ? prev.Pn : 0, Pt: prev ? prev.Pt : ZERO, Pp: 0, wasTouching: prev ? prev.touching : false,
      };
    });
    return { key, A, B, normal: m.normal, contacts, mat, surface, partner, Pr: old ? old.Pr : ZERO, Ps: old ? old.Ps : 0 };
  }

  // ---------------------------------------------------------------- solver
  prepare(m) {
    const o = this.o, dt = o.dt, n = m.normal, A = m.A, B = m.B;
    m.t1 = perpendicular(n);
    m.t2 = cross(n, m.t1);
    for (const c of m.contacts) {
      c.rB = sub(c.point, B.position);
      c.rA = A ? sub(c.point, A.position) : null;
      c.mN = 1 / linearK(A, B, c.rA, c.rB, n);
      c.mT1 = 1 / linearK(A, B, c.rA, c.rB, m.t1);
      c.mT2 = 1 / linearK(A, B, c.rA, c.rB, m.t2);
      const vn = dot(relativeVelocity(A, B, c.rA, c.rB), n);
      const touches = c.separation <= 0 || c.separation + vn * dt < 0;
      let target = c.separation > 0 ? -c.separation / dt : 0;
      if (touches && vn < -o.restitutionThreshold) target = Math.max(target, -m.mat.restitution * vn);
      c.target = target;
      c.posTarget = c.separation < -o.slop ? o.baumgarte * (-c.separation - o.slop) / dt : 0;
      // A hit is the step a contact first touches, not the step it is first seen: a speculative
      // contact is often found a step before the die reaches the surface.
      c.touching = touches;
      if (touches) {
        if (m.surface === 'floor') B.touched = true;
        if (!c.wasTouching && vn < -o.hitThreshold) this.recordHit(m, -vn);
      }
    }
    m.mR1 = 1 / angularK(A, B, m.t1);
    m.mR2 = 1 / angularK(A, B, m.t2);
    m.mS = 1 / angularK(A, B, n);
    for (const c of m.contacts) {
      c.Pt1 = dot(c.Pt, m.t1);
      c.Pt2 = dot(c.Pt, m.t2);
      applyLinear(A, B, c.rA, c.rB, add(scale(n, c.Pn), add(scale(m.t1, c.Pt1), scale(m.t2, c.Pt2))), 'velocity');
    }
    m.Pr1 = dot(m.Pr, m.t1);
    m.Pr2 = dot(m.Pr, m.t2);
    applyAngular(A, B, add(add(scale(m.t1, m.Pr1), scale(m.t2, m.Pr2)), scale(n, m.Ps)));
  }

  solveVelocity(m) {
    const n = m.normal, A = m.A, B = m.B, mu = m.mat.friction;
    for (const c of m.contacts) {
      const vr = relativeVelocity(A, B, c.rA, c.rB);
      let p1 = c.Pt1 - c.mT1 * dot(vr, m.t1);
      let p2 = c.Pt2 - c.mT2 * dot(vr, m.t2);
      const max = mu * c.Pn, l = Math.sqrt(p1 * p1 + p2 * p2);
      if (l > max) { const s = l > 0 ? max / l : 0; p1 *= s; p2 *= s; }
      applyLinear(A, B, c.rA, c.rB, add(scale(m.t1, p1 - c.Pt1), scale(m.t2, p2 - c.Pt2)), 'velocity');
      c.Pt1 = p1;
      c.Pt2 = p2;
    }

    // Rolling and spin resistance, bounded by the manifold's total normal impulse. This runs even
    // when that total is zero: the clamp is what takes back a warm-started impulse once the die
    // has left the surface (skipping it re-applied the impulse every step and spun dice up mid-air).
    let total = 0;
    for (const c of m.contacts) total += c.Pn;
    const w = A ? sub(B.angularVelocity, A.angularVelocity) : B.angularVelocity;
    let r1 = m.Pr1 - m.mR1 * dot(w, m.t1), r2 = m.Pr2 - m.mR2 * dot(w, m.t2);
    const rmax = m.mat.rolling * total, rl = Math.sqrt(r1 * r1 + r2 * r2);
    if (rl > rmax) { const k = rl > 0 ? rmax / rl : 0; r1 *= k; r2 *= k; }
    const smax = m.mat.spinning * total;
    let s = m.Ps - m.mS * dot(w, n);
    s = s > smax ? smax : s < -smax ? -smax : s;
    applyAngular(A, B, add(add(scale(m.t1, r1 - m.Pr1), scale(m.t2, r2 - m.Pr2)), scale(n, s - m.Ps)));
    m.Pr1 = r1; m.Pr2 = r2; m.Ps = s;

    for (const c of m.contacts) {
      const vn = dot(relativeVelocity(A, B, c.rA, c.rB), n);
      const P = Math.max(c.Pn + c.mN * (c.target - vn), 0);
      applyLinear(A, B, c.rA, c.rB, scale(n, P - c.Pn), 'velocity');
      c.Pn = P;
    }
  }

  solvePosition(m) {
    const n = m.normal, A = m.A, B = m.B;
    for (const c of m.contacts) {
      if (!(c.posTarget > 0)) continue;
      const vn = dot(relativePseudo(A, B, c.rA, c.rB), n);
      const P = Math.max(c.Pp + c.mN * (c.posTarget - vn), 0);
      applyLinear(A, B, c.rA, c.rB, scale(n, P - c.Pp), 'pseudo');
      c.Pp = P;
    }
  }

  /** One impact, filed on each die it involves; `other` names the other die (−1 for the tray). */
  recordHit(m, speed) {
    const surface = m.surface;
    this.hits.push({ t: this.time, body: m.B.index, speed, surface, other: m.partner });
    // The other die is filed too — including a sleeping die standing in as ground (A is null then).
    if (m.partner >= 0) this.hits.push({ t: this.time, body: m.partner, speed, surface, other: m.B.index });
  }
}

// ---------------------------------------------------------------- impulse helpers
const crossR = (r, P) => cross(r, P);

const ZERO_MAT3 = Object.freeze([0, 0, 0, 0, 0, 0, 0, 0, 0]);

/**
 * A moving plane as the A of a manifold: a body of infinite mass (every impulse leaves it as it is) moving at the
 * plane's velocity, never turning, standing at the plane's foot. index −1: the hit record names no partner die.
 */
function movingGround(pl) {
  return {
    index: -1, invMass: 0, invInertiaWorld: ZERO_MAT3,
    position: scale(pl.normal, pl.offset), velocity: pl.velocity, angularVelocity: ZERO, pseudoVelocity: ZERO, pseudoAngular: ZERO,
    velocityAt() { return pl.velocity; },
  };
}

/** The inverse effective mass of a point impulse along unit d. */
function linearK(A, B, rA, rB, d) {
  const rnB = cross(rB, d);
  let k = B.invMass + dot(rnB, mvec(B.invInertiaWorld, rnB));
  if (A) { const rnA = cross(rA, d); k += A.invMass + dot(rnA, mvec(A.invInertiaWorld, rnA)); }
  return k;
}

/** The inverse effective mass of an angular impulse about unit axis u. */
function angularK(A, B, u) {
  let k = dot(u, mvec(B.invInertiaWorld, u));
  if (A) k += dot(u, mvec(A.invInertiaWorld, u));
  return k;
}

function relativeVelocity(A, B, rA, rB) {
  const vB = B.velocityAt(rB);
  return A ? sub(vB, A.velocityAt(rA)) : vB;
}

function relativePseudo(A, B, rA, rB) {
  const at = (b, r) => add(b.pseudoVelocity, cross(b.pseudoAngular, r));
  const vB = at(B, rB);
  return A ? sub(vB, at(A, rA)) : vB;
}

/** Applies impulse P at the contact: +P on B, −P on A. `which` picks the real or the pseudo velocities. */
function applyLinear(A, B, rA, rB, P, which) {
  const lin = which === 'velocity' ? 'velocity' : 'pseudoVelocity';
  const ang = which === 'velocity' ? 'angularVelocity' : 'pseudoAngular';
  B[lin] = addScaled(B[lin], P, B.invMass);
  B[ang] = add(B[ang], mvec(B.invInertiaWorld, crossR(rB, P)));
  if (A) {
    A[lin] = addScaled(A[lin], P, -A.invMass);
    A[ang] = sub(A[ang], mvec(A.invInertiaWorld, crossR(rA, P)));
  }
}

/** Applies angular impulse L: +L on B, −L on A. */
function applyAngular(A, B, L) {
  B.angularVelocity = add(B.angularVelocity, mvec(B.invInertiaWorld, L));
  if (A) A.angularVelocity = sub(A.angularVelocity, mvec(A.invInertiaWorld, L));
}
