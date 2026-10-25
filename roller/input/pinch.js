// input/pinch.js — two fingers on the tray zoom the view (owner 2026-10-24: "add pinch-to-zoom for
// touch screens").
//
// A pure tracker — no DOM, no timers — so node tests it and any host drives it from its own touch
// pointer events (positions in px):
//
//   const p = createPinch();
//   pointerdown    p.down(id, x, y, e.isPrimary)   → true when this finger turns the touch into a pinch (the second)
//   pointermove    p.move(id, x, y)   → { kind: 'pinch', factor } while two fingers move, else null
//   pointerup      p.up(id)           → 'pinch' while (or as) a pinch ends, null for a touch that never was one
//   pointercancel  p.up(id)
//   no finger left p.reset()          (touchend / touchcancel with e.touches.length 0)
//
// factor is the camera's distance change for view.zoom(): fingers spreading apart bring it nearer
// (below 1), drawing together send it back (above 1). Once two fingers have touched, the touch stays
// a pinch until every finger has lifted, so the last finger off never taps, throws or turns the view.
// A third finger is ignored; when it lifts, the two left carry on from where they are.
//
// THE PLATFORM IS THE TRUTH (owner 2026-10-25, on the iPhone: "table tap on mobile seems broken ...
// swiping zooms"). One touch whose lift never reached the page — iOS can swallow a pointerup — stayed
// held here forever, so every later lone finger made a pinch with it: taps never rolled and one finger
// zoomed. So a primary touch (the first finger down with no other on the screen, by the Pointer Events
// rules) forgets whatever is still held, and the host calls reset() when the touch events say no finger
// is left. A lost lift then costs nothing: the next touch starts clean.

export function createPinch() {
  const points = new Map();   // pointer id → { x, y }
  let active = false;         // a pinch is under way, until every finger lifts
  let span = 0;               // the two fingers' distance at the last step
  const distance = () => {
    const [a, b] = [...points.values()];
    return Math.hypot(a.x - b.x, a.y - b.y);
  };
  return {
    get count() { return points.size; },
    get active() { return active; },
    down(id, x, y, primary = false) {
      if (primary) this.reset();   // the only finger on the screen: anything held is a lift that was never reported
      points.set(id, { x, y });
      if (points.size !== 2) return false;
      const began = !active;
      active = true;
      span = distance();
      return began;
    },
    move(id, x, y) {
      if (!points.has(id)) return null;
      points.set(id, { x, y });
      if (!active || points.size !== 2) return null;
      const d = distance(), factor = span / d;
      span = d;
      // Two fingers on one spot have no span to compare: no step, rather than a jump to a zoom limit.
      return factor > 0 && Number.isFinite(factor) ? { kind: 'pinch', factor } : null;
    },
    reset() {
      points.clear();
      active = false;
      span = 0;
    },
    up(id) {
      points.delete(id);
      if (points.size === 2 && active) span = distance();   // a third finger lifted: carry on from here
      if (points.size > 0) return active ? 'pinch' : null;
      const was = active;
      active = false;
      span = 0;
      return was ? 'pinch' : null;
    },
  };
}
