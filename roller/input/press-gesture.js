// input/press-gesture.js — what a press on the tray means: a tap, a throw, a hold that turns the
// view (owner 2026-10-24: "click, hold and drag to orbit the camera"), or a right-button drag that
// zooms ("right click and hold to zoom in and out").
//
// A pure state machine — no DOM, no timers — so node tests it and any host drives it from its own
// pointer events (times in ms, positions in px):
//
//   const g = createPressGesture();
//   pointerdown    g.down(t, x, y, button)   button 'primary' (default) or 'secondary'; for a
//                                       primary press, arm a timer for g.holdMs that calls g.hold(now)
//   pointermove    g.move(t, x, y)    → { kind: 'throw' } while a throw is drawn,
//                                       { kind: 'orbit', dx, dy } while the view turns,
//                                       { kind: 'zoom', dx, dy } while a secondary press zooms, else null
//   the timer      g.hold(t)          → true when the press has just become an orbit (show it)
//   pointerup      g.up()             → what the press was: 'tap' | 'throw' | 'orbit' | 'zoom' (null if none)
//   pointercancel  g.cancel()
//
// A press that moves more than `slop` before `holdMs` is a throw; one held still that long turns
// the view from then on, until it is let go; one let go sooner, unmoved, is a tap. A secondary
// (right-button) press zooms from the start: it has nothing to be confused with, so it needs no hold.

export const PRESS_DEFAULTS = {
  holdMs: 350,   // how long a press must stay still before it turns the view
  slop: 6,       // px a still press may wander (a hand is never perfectly still)
};

export function createPressGesture(options = {}) {
  const o = { ...PRESS_DEFAULTS, ...options };
  let state = 'idle', start = null, last = null;
  const reset = () => { state = 'idle'; start = last = null; };
  return {
    holdMs: o.holdMs,
    get state() { return state; },
    down(t, x, y, button = 'primary') {
      if (button !== 'primary' && button !== 'secondary') throw new Error('press gesture: button must be primary or secondary, got ' + button);
      state = button === 'secondary' ? 'zoom' : 'pending';
      start = { t, x, y };
      last = { x, y };
    },
    move(t, x, y) {
      if (state === 'pending') {
        last = { x, y };
        if (Math.hypot(x - start.x, y - start.y) <= o.slop) return null;
        state = 'throw';
      }
      if (state === 'throw') { last = { x, y }; return { kind: 'throw' }; }
      if (state === 'orbit' || state === 'zoom') {
        const dx = x - last.x, dy = y - last.y;
        last = { x, y };
        return { kind: state, dx, dy };
      }
      return null;
    },
    // A timer left over from an earlier press finds this one too young and does nothing.
    hold(t) {
      if (state !== 'pending' || t - start.t < o.holdMs - 5) return false;
      state = 'orbit';
      return true;
    },
    up() {
      const was = state === 'pending' ? 'tap' : state === 'idle' ? null : state;
      reset();
      return was;
    },
    cancel: reset,
  };
}
