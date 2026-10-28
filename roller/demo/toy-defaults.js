// demo/toy-defaults.js — how the roller opens where it differs from a DiceView's own defaults
// (render/view-defaults.js). Data only, so node tests it.
//
// Owner 2026-10-27: "Set the surface to none by default and the exit animation to random." The roller's own
// opening choices, not a view's: a host such as Traffic and Dragons passes its own tray and inherits the view's
// surface, and with it the clicks' timbre, so VIEW_DEFAULTS stays on stone. A choice kept on this browser still
// wins over these.

export const TOY_DEFAULTS = {
  surface: 'none',    // a SURFACE_LOOKS key: no tray, the dice kept inside the screen's edges
  exit: 'random',     // an EXIT_TABLE key: Random picks one of the others as the dice leave
};
