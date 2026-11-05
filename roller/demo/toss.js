// Screen movement decides whether a gesture is a fling; the held plane supplies its world direction.
export const TOSS = { window: 90, slop: 6, minPixelsPerSecond: 100, minSpeed: 0.5, boost: 2, max: 6.4 };

/** Retain coalesced motion and the event's final point, including pointerup, in one bounded history. */
export function samplePointer(samples, event, project) {
  const coalesced = typeof event.getCoalescedEvents === 'function' ? event.getCoalescedEvents() : [];
  for (const e of [...coalesced, event]) {
    const p = project(e.clientX, e.clientY);
    if (!p) continue;
    const sample = { t: e.timeStamp, p, screen: { x: e.clientX, y: e.clientY } };
    const last = samples[samples.length - 1];
    if (last && sample.t < last.t) continue;
    if (last && sample.t === last.t) samples[samples.length - 1] = sample;
    else samples.push(sample);
  }
  if (samples.length > 40) samples.splice(0, samples.length - 40);
}

export function tossOf(samples, now, o = TOSS) {
  if (samples.length < 2) return null;
  const cutoff = now - o.window;
  const first = samples.findIndex(s => s.t >= cutoff);
  if (first < 0) return null;
  // The preceding point anchors sparse input after a hold; its old timestamp must not dilute the flick.
  const a = samples[Math.max(0, first - 1)], b = samples[samples.length - 1];
  const dt = (b.t - Math.max(a.t, cutoff)) / 1000;
  if (!(dt > 0)) return null;
  const pixels = Math.hypot(b.screen.x - a.screen.x, b.screen.y - a.screen.y);
  if (pixels <= o.slop || pixels / dt < o.minPixelsPerSecond) return null;
  const vx = (b.p.x - a.p.x) / dt, vz = (b.p.z - a.p.z) / dt, speed = Math.hypot(vx, vz);
  if (!(speed > 0)) return null;
  const k = Math.min(o.max, Math.max(o.minSpeed, speed * o.boost)) / speed;
  return { x: vx * k, z: vz * k };
}
