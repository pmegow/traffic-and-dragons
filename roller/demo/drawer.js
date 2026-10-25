// demo/drawer.js — the phone layout's options drawer (owner 2026-10-24: "a drawer handle for raising
// and lowering the options, similar to the right side panel in TnD").
//
// A pure state machine (heights in px, times in ms), so node tests it and the toy drives it from the
// handle's pointer and key events, the way Traffic and Dragons' side-panel grip works: drag to raise
// or lower, double tap to close or reopen, arrow keys step it, Home closes, End opens fully. Travel is
// measured over the whole gesture, so dragging out and back is never taken for a tap.
//
//   const d = createDrawer({ height: 350, max: 700 });
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

export function createDrawer({ height, max, open = height } = {}) {
  if (!(max > DRAWER.min)) throw new Error('createDrawer: max must be above ' + DRAWER.min + ', got ' + max);
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
      if (key === 'ArrowUp') h = clamp(h + DRAWER.step);
      else if (key === 'ArrowDown') h = clamp(h - DRAWER.step);
      else if (key === 'Home') { if (h > DRAWER.min) reopen = h; h = DRAWER.min; return h; }
      else if (key === 'End') h = clamp(max);
      else return null;
      return settle();
    },
  };
}
