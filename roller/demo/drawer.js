// demo/drawer.js — the options drawer (owner 2026-10-24: "a drawer handle for raising and lowering the
// options, similar to the right side panel in TnD"; 2026-10-29: the grip on the wide layout too, where
// it drags the panel's width).
//
// A pure state machine (sizes in px, times in ms), so node tests it and the toy drives it from the
// handle's pointer and key events, the way Traffic and Dragons' side-panel grip works: drag to raise
// or lower, double tap to close or reopen, arrow keys step it, Home closes, End opens fully. Travel is
// measured over the whole gesture, so dragging out and back is never taken for a tap. The size is
// `height` whichever way the drawer lies: for a panel beside the tray it is the width, the pointer
// coordinate is x, and with `axis: 'x'` the arrow keys are Left (wider) and Right (narrower) — a smaller
// coordinate is a bigger drawer either way (the drawer opens up, the panel opens leftward).
//
//   const d = createDrawer({ height: 350, max: 700 });            // axis 'y' (the default): a drawer under the tray
//   const s = createDrawer({ height: 324, max: 900, axis: 'x' }); // a panel beside it
//   pointerdown  d.down(y, t)     pointermove  d.move(y) → height     pointerup  d.up(y, t) → height
//   keydown      d.key(key) → height (or null for a key it does not use)
//   window resize  d.setMax(max) → height

export const DRAWER = {
  min: 24,          // closed: only the handle shows
  step: 24,         // an arrow key's step
  slop: 6,          // px a tap may wander before it is a drag
  doubleTapMs: 350, // two taps this close together …
  doubleTapPx: 24,  // … and this close in place are a double tap
};

export function createDrawer({ height, max, open = height, axis = 'y' } = {}) {
  if (!(max > DRAWER.min)) throw new Error('createDrawer: max must be above ' + DRAWER.min + ', got ' + max);
  if (axis !== 'y' && axis !== 'x') throw new Error("createDrawer: axis must be 'y' or 'x', got " + axis);
  const grow = axis === 'y' ? 'ArrowUp' : 'ArrowLeft', shrink = axis === 'y' ? 'ArrowDown' : 'ArrowRight';
  const clamp = (h) => Math.round(Math.max(DRAWER.min, Math.min(max, h)));
  let h = clamp(height), reopen = clamp(open > DRAWER.min ? open : max / 2), drag = null, lastTap = null;
  const settle = () => { if (h > DRAWER.min) reopen = h; return h; };
  const toggle = () => {
    if (h > DRAWER.min) { reopen = h; h = DRAWER.min; } else h = clamp(reopen);
    return h;
  };
  return {
    get height() { return h; },
    get reopen() { return reopen; },
    get closed() { return h <= DRAWER.min; },
    get axis() { return axis; },
    setMax(m) { max = m; h = clamp(h); reopen = clamp(reopen); return h; },
    down(y, t) { drag = { y, h, moved: false, t }; },
    move(y) {
      if (!drag) return h;
      if (Math.abs(y - drag.y) > DRAWER.slop) { drag.moved = true; lastTap = null; }
      if (drag.moved) h = clamp(drag.h + (drag.y - y));   // up raises it
      return h;
    },
    up(y, t) {
      if (!drag) return h;
      this.move(y);
      const moved = drag.moved;
      drag = null;
      if (moved) return settle();
      if (lastTap && t - lastTap.t <= DRAWER.doubleTapMs && Math.abs(y - lastTap.y) <= DRAWER.doubleTapPx) { lastTap = null; return toggle(); }
      lastTap = { t, y };
      return h;
    },
    cancel() { drag = null; lastTap = null; },
    key(key) {
      lastTap = null;
      if (key === grow) h = clamp(h + DRAWER.step);
      else if (key === shrink) h = clamp(h - DRAWER.step);
      else if (key === 'Home') { if (h > DRAWER.min) reopen = h; h = DRAWER.min; return h; }
      else if (key === 'End') h = clamp(max);
      else return null;
      return settle();
    },
  };
}
