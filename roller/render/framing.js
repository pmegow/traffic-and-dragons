// render/framing.js — where the camera stands to frame the tray, at any orbit angle (pure: no
// three.js, so node tests it).
//
// The camera looks at the tray's centre from `tilt` degrees above the floor and `yaw` degrees around
// it, standing just far enough back that the whole tray (half sizes halfW × halfD, rim included, its
// top `top` metres up) is in view. Two fits, and the camera takes the farther:
//   the view's framing since v0.1 — the tray's footprint as the camera sees it (the bounding box of
//            the turned rectangle) sized at the tray's centre. At yaw 0 this is exactly where the
//            camera always stood, so the opening view is unchanged.
//   an exact fit of the eight corners of the tray's box to the frustum — what keeps a low orbit's
//            near corners, much closer to the camera than the centre, on screen.
// A stage taller than wide starts a quarter turn round (the camera at the tray's side), so the
// tray's long edge runs up the screen. orbitPose, standCamera and blendOrbit below keep a view's
// orbit legal, keep the camera above the dice, and ease it home.

const RAD = Math.PI / 180;
const MARGIN = 1.06;   // the tray fills 1/1.06 of the view, a little room round it

/** The camera position {x, y, z} (m) for a stage `aspect` (w / h) and a vertical `fov` (degrees). */
export function frameCamera({ aspect, fov, tilt, yaw = 0, halfW, halfD, top = 0 }) {
  const t = tilt * RAD;
  const tv = Math.tan((fov / 2) * RAD), th = tv * aspect;
  const a = ((aspect < 1 ? 90 : 0) + yaw) * RAD;
  // The direction from the tray's centre to the camera, and the camera's own axes (it looks back
  // along -dir with +y up): right r and up u.
  const dir = { x: Math.sin(a) * Math.cos(t), y: Math.sin(t), z: Math.cos(a) * Math.cos(t) };
  const r = { x: Math.cos(a), y: 0, z: -Math.sin(a) };
  const u = { x: -Math.sin(a) * Math.sin(t), y: Math.cos(t), z: -Math.cos(a) * Math.sin(t) };

  const c = Math.abs(Math.cos(a)), s = Math.abs(Math.sin(a));
  const across = halfW * c + halfD * s, along = halfW * s + halfD * c;
  let dist = MARGIN * Math.max(across / th, (along * Math.sin(t) + 0.02) / tv + along * Math.cos(t));

  // A corner q is in view when |q·r| ≤ (dist − q·dir)·tan(h/2)/MARGIN, and the same for u and the
  // vertical half-angle: q·dir is how much nearer the camera the corner stands than the centre.
  for (const x of [-halfW, halfW]) for (const y of [0, top]) for (const z of [-halfD, halfD]) {
    const qd = x * dir.x + y * dir.y + z * dir.z;
    const qr = x * r.x + z * r.z, qu = x * u.x + y * u.y + z * u.z;
    dist = Math.max(dist, MARGIN * Math.abs(qr) / th + qd, MARGIN * Math.abs(qu) / tv + qd);
  }
  return { x: dir.x * dist, y: dir.y * dist, z: dir.z * dist };
}

/**
 * An orbit pose {yaw, pitch, zoom} made legal: yaw wrapped into −180…180, pitch and zoom held within
 * the limits {minPitch, maxPitch, minZoom, maxZoom}. zoom multiplies the framing distance: 1 is the
 * fit, below 1 nearer, above 1 farther. A non-finite value is refused loudly.
 */
export function orbitPose({ yaw, pitch, zoom }, limits) {
  for (const [k, v] of Object.entries({ yaw, pitch, zoom })) {
    if (!Number.isFinite(v)) throw new Error('orbitPose: ' + k + ' must be a finite number, got ' + v);
  }
  if (!(zoom > 0)) throw new Error('orbitPose: zoom must be positive, got ' + zoom);
  return {
    yaw: ((yaw % 360) + 540) % 360 - 180,
    pitch: Math.min(limits.maxPitch, Math.max(limits.minPitch, pitch)),
    zoom: Math.min(limits.maxZoom, Math.max(limits.minZoom, zoom)),
  };
}

/** The pose a fraction e (0…1) of the way from one pose to another: yaw the short way round, zoom evenly in ratio. */
export function blendOrbit(from, to, e) {
  const dYaw = ((to.yaw - from.yaw) % 360 + 540) % 360 - 180;
  return {
    yaw: from.yaw + dYaw * e,
    pitch: from.pitch + (to.pitch - from.pitch) * e,
    zoom: from.zoom * Math.pow(to.zoom / from.zoom, e),
  };
}

/**
 * Where the camera stands for an orbit pose on a stage {aspect, fov, halfW, halfD, top}: the pose
 * made legal (orbitPose), then its zoom raised, if need be, so the camera stays at least
 * limits.minHeight metres above the floor — fully zoomed in at the lowest angle it would otherwise
 * sit level with the dice (2 cm up, measured 2026-10-24). Returns { pose, position }.
 */
export function standCamera(stage, pose, limits) {
  const p = orbitPose(pose, limits);
  const fit = frameCamera({ ...stage, tilt: p.pitch, yaw: p.yaw });
  const zoom = Math.min(limits.maxZoom, Math.max(p.zoom, limits.minHeight / fit.y));
  return { pose: { ...p, zoom }, position: { x: fit.x * zoom, y: fit.y * zoom, z: fit.z * zoom } };
}
