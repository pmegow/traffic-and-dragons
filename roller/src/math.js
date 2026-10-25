// src/math.js — the small vector, quaternion and 3×3 matrix kit the solver runs on.
//
// Vectors are plain {x, y, z}; quaternions {x, y, z, w}; matrices 9-element arrays, row-major.
// Every function returns a new value — nothing is mutated behind the caller's back.
//
// DETERMINISM CONTRACT: the simulation path uses only + − × ÷ and Math.sqrt, which IEEE 754
// makes bit-identical on every engine. Trigonometry (sin, cos, atan2, acos) is NOT used here —
// engines may differ in the last bit, and a die is chaotic enough to amplify that into a
// different face. Rendering code may use trig freely; it never feeds back into the physics.

export const v3 = (x = 0, y = 0, z = 0) => ({ x, y, z });
export const ZERO = Object.freeze(v3(0, 0, 0));
export const UP = Object.freeze(v3(0, 1, 0));

export const add = (a, b) => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
export const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
export const scale = (a, s) => ({ x: a.x * s, y: a.y * s, z: a.z * s });
export const addScaled = (a, b, s) => ({ x: a.x + b.x * s, y: a.y + b.y * s, z: a.z + b.z * s });
export const neg = (a) => ({ x: -a.x, y: -a.y, z: -a.z });
export const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
export const cross = (a, b) => ({
  x: a.y * b.z - a.z * b.y,
  y: a.z * b.x - a.x * b.z,
  z: a.x * b.y - a.y * b.x,
});
export const lengthSq = (a) => a.x * a.x + a.y * a.y + a.z * a.z;
export const length = (a) => Math.sqrt(lengthSq(a));
export const lerp = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t });

/** Unit vector along a. A zero vector has no direction: that is the caller's bug, so it throws. */
export function normalize(a) {
  const l = length(a);
  if (!(l > 0)) throw new Error('normalize: zero-length vector ' + JSON.stringify(a));
  return scale(a, 1 / l);
}

/** Any unit vector perpendicular to unit n — a fixed choice, so the same n always gives the same answer. */
export function perpendicular(n) {
  const axis = Math.abs(n.x) < 0.57 ? v3(1, 0, 0) : v3(0, 1, 0);
  return normalize(cross(n, axis));
}

// ---------------------------------------------------------------- quaternions
export const quat = (x = 0, y = 0, z = 0, w = 1) => ({ x, y, z, w });
export const QUAT_IDENTITY = Object.freeze(quat());

export const qmul = (a, b) => ({
  x: a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y,
  y: a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x,
  z: a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w,
  w: a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z,
});
export const qconj = (q) => ({ x: -q.x, y: -q.y, z: -q.z, w: q.w });
export const qdot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z + a.w * b.w;

export function qnormalize(q) {
  const l = Math.sqrt(q.x * q.x + q.y * q.y + q.z * q.z + q.w * q.w);
  if (!(l > 0)) throw new Error('qnormalize: zero quaternion');
  return { x: q.x / l, y: q.y / l, z: q.z / l, w: q.w / l };
}

/** v rotated by unit quaternion q. */
export function qrotate(q, v) {
  // t = 2 (q.xyz × v);  v' = v + w t + q.xyz × t
  const tx = 2 * (q.y * v.z - q.z * v.y);
  const ty = 2 * (q.z * v.x - q.x * v.z);
  const tz = 2 * (q.x * v.y - q.y * v.x);
  return {
    x: v.x + q.w * tx + (q.y * tz - q.z * ty),
    y: v.y + q.w * ty + (q.z * tx - q.x * tz),
    z: v.z + q.w * tz + (q.x * ty - q.y * tx),
  };
}

/** One explicit step of dq/dt = ½ (ω, 0) ⊗ q, renormalized. */
export function qintegrate(q, w, dt) {
  const h = 0.5 * dt;
  return qnormalize({
    x: q.x + h * (w.x * q.w + w.y * q.z - w.z * q.y),
    y: q.y + h * (w.y * q.w + w.z * q.x - w.x * q.z),
    z: q.z + h * (w.z * q.w + w.x * q.y - w.y * q.x),
    w: q.w - h * (w.x * q.x + w.y * q.y + w.z * q.z),
  });
}

/** True when a and b are the same rotation (q and −q both count). */
export const qsameRotation = (a, b, eps = 1e-6) => Math.abs(Math.abs(qdot(a, b)) - 1) < eps;

// ---------------------------------------------------------------- 3×3 matrices (row-major)
export const mat3 = (a, b, c, d, e, f, g, h, i) => [a, b, c, d, e, f, g, h, i];
export const MAT3_IDENTITY = Object.freeze([1, 0, 0, 0, 1, 0, 0, 0, 1]);
export const mdiag = (x, y, z) => [x, 0, 0, 0, y, 0, 0, 0, z];
export const mvec = (m, v) => ({
  x: m[0] * v.x + m[1] * v.y + m[2] * v.z,
  y: m[3] * v.x + m[4] * v.y + m[5] * v.z,
  z: m[6] * v.x + m[7] * v.y + m[8] * v.z,
});
export function mmul(a, b) {
  const r = new Array(9);
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
    r[i * 3 + j] = a[i * 3] * b[j] + a[i * 3 + 1] * b[3 + j] + a[i * 3 + 2] * b[6 + j];
  }
  return r;
}
export const mtranspose = (m) => [m[0], m[3], m[6], m[1], m[4], m[7], m[2], m[5], m[8]];
export const madd = (a, b) => a.map((x, i) => x + b[i]);
export const mscale = (a, s) => a.map((x) => x * s);
export const mtrace = (m) => m[0] + m[4] + m[8];
/** Columns c0, c1, c2 as a matrix. */
export const mcolumns = (c0, c1, c2) => [c0.x, c1.x, c2.x, c0.y, c1.y, c2.y, c0.z, c1.z, c2.z];
/** The outer product a bᵀ. */
export const mouter = (a, b) => [a.x * b.x, a.x * b.y, a.x * b.z, a.y * b.x, a.y * b.y, a.y * b.z, a.z * b.x, a.z * b.y, a.z * b.z];

export function minverse(m) {
  const [a, b, c, d, e, f, g, h, i] = m;
  const A = e * i - f * h, B = -(d * i - f * g), C = d * h - e * g;
  const det = a * A + b * B + c * C;
  if (!(Math.abs(det) > 1e-300)) throw new Error('minverse: singular matrix');
  const s = 1 / det;
  return [
    A * s, -(b * i - c * h) * s, (b * f - c * e) * s,
    B * s, (a * i - c * g) * s, -(a * f - c * d) * s,
    C * s, -(a * h - b * g) * s, (a * e - b * d) * s,
  ];
}

export function mat3FromQuat(q) {
  const { x, y, z, w } = q;
  const xx = x * x, yy = y * y, zz = z * z, xy = x * y, xz = x * z, yz = y * z, wx = w * x, wy = w * y, wz = w * z;
  return [
    1 - 2 * (yy + zz), 2 * (xy - wz), 2 * (xz + wy),
    2 * (xy + wz), 1 - 2 * (xx + zz), 2 * (yz - wx),
    2 * (xz - wy), 2 * (yz + wx), 1 - 2 * (xx + yy),
  ];
}

/** Shepperd's method: the unit quaternion of a rotation matrix (sqrt only, no trig). */
export function quatFromMat3(m) {
  const [m00, m01, m02, m10, m11, m12, m20, m21, m22] = m;
  const tr = m00 + m11 + m22;
  let q;
  if (tr > 0) {
    const s = Math.sqrt(tr + 1) * 2;
    q = { w: 0.25 * s, x: (m21 - m12) / s, y: (m02 - m20) / s, z: (m10 - m01) / s };
  } else if (m00 > m11 && m00 > m22) {
    const s = Math.sqrt(1 + m00 - m11 - m22) * 2;
    q = { w: (m21 - m12) / s, x: 0.25 * s, y: (m01 + m10) / s, z: (m02 + m20) / s };
  } else if (m11 > m22) {
    const s = Math.sqrt(1 + m11 - m00 - m22) * 2;
    q = { w: (m02 - m20) / s, x: (m01 + m10) / s, y: 0.25 * s, z: (m12 + m21) / s };
  } else {
    const s = Math.sqrt(1 + m22 - m00 - m11) * 2;
    q = { w: (m10 - m01) / s, x: (m02 + m20) / s, y: (m12 + m21) / s, z: 0.25 * s };
  }
  return qnormalize(q);
}

/** An orthonormal frame whose first axis is unit a and whose second lies in the (a, b) plane. */
export function frameOf(a, b) {
  const e1 = normalize(a);
  const e2 = normalize(sub(b, scale(e1, dot(b, e1))));
  return mcolumns(e1, e2, cross(e1, e2));
}

/**
 * A pseudo-angle in [0, 4) that orders 2D directions like atan2 does, without trigonometry.
 * Monotone in the true angle, so sorting by it is the same as sorting by angle.
 */
export function pseudoAngle(x, y) {
  const s = Math.abs(x) + Math.abs(y);
  if (!(s > 0)) return 0;
  const p = x / s;
  return y >= 0 ? 1 - p : 3 + p;
}
