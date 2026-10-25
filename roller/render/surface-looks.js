// render/surface-looks.js — THE tray looks as data (no three.js, so node tests it).
//
// A look is how a tray surface is drawn; `physics` names the src/materials.js SURFACES entry the
// dice actually roll on (and the click timbre they make). 'none' draws no tray at all — only the
// dice and their shadows over whatever is behind the canvas — and rolls like a hard table.
//
//   pattern   a render/patterns.js PATTERNS key, or null for no floor (a shadow catcher only)

export const SURFACE_LOOKS = {
  felt: { label: 'Felt', physics: 'felt', color: '#1d4a3a', roughness: 0.95, pattern: 'felt' },
  wood: { label: 'Wood', physics: 'wood', color: '#8a5a34', roughness: 0.55, pattern: 'wood' },
  stone: { label: 'Stone', physics: 'stone', color: '#6c6f74', roughness: 0.55, pattern: 'granite' },
  none: { label: 'None (no tray)', physics: 'wood', pattern: null },
};

/** The rim of every drawn tray: dark wood. */
export const RIM_LOOK = { color: '#4a2f1c', roughness: 0.6, pattern: 'wood' };
