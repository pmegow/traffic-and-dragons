// src/body.js — a rigid die in the world, and the static planes of the tray.
//
// A Body carries its state (position, orientation, velocities), the die definition it was made
// from, and the per-step derived data the collision code reads: the rotation matrix, the
// world-space inverse inertia, the core's world vertices and face planes.

import { v3, add, dot, mvec, mmul, mtranspose, mat3FromQuat, qnormalize, QUAT_IDENTITY, ZERO, normalize } from './math.js';

export class Body {
  constructor(die, state = {}) {
    this.die = die;
    this.shape = die.core;
    this.margin = die.margin;
    this.material = die.material;
    this.invMass = 1 / die.mass;
    this.invInertiaLocal = die.invInertia;
    this.position = state.position || v3();
    this.orientation = qnormalize(state.orientation || QUAT_IDENTITY);
    this.velocity = state.velocity || v3();
    this.angularVelocity = state.angularVelocity || v3();
    this.pseudoVelocity = ZERO;
    this.pseudoAngular = ZERO;
    this.asleep = false;
    this.sleepTimer = 0;
    this.updateDerived();
  }

  /** Recomputes everything that follows from position and orientation. */
  updateDerived() {
    const R = mat3FromQuat(this.orientation);
    this.rotation = R;
    this.invInertiaWorld = mmul(mmul(R, this.invInertiaLocal), mtranspose(R));
    const x = this.position;
    this.worldVertices = this.shape.vertices.map((p) => add(mvec(R, p), x));
    this.worldNormals = this.shape.faces.map((f) => mvec(R, f.normal));
    this.faceOffsets = this.shape.faces.map((f, i) => dot(this.worldNormals[i], this.worldVertices[f.verts[0]]));
  }

  /** The velocity of the body's material point at offset r from its centre. */
  velocityAt(r) {
    const w = this.angularVelocity;
    return add(this.velocity, { x: w.y * r.z - w.z * r.y, y: w.z * r.x - w.x * r.z, z: w.x * r.y - w.y * r.x });
  }
}

/**
 * A static half-space boundary: points with normal·x ≥ offset are inside the tray.
 * kind names it for the hit record ('floor', 'wall', 'ceiling').
 */
export function plane(normal, offset, surface, kind) {
  return { normal: normalize(normal), offset, material: surface, kind };
}
