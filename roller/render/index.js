// render/index.js — the three.js renderer's public face. Needs the import map entries
// "three" and "three/addons/" (see index.html); the physics core (src/) needs neither.
export { DiceView, VIEW_DEFAULTS } from './view.js';
export { SURFACE_LOOKS, RIM_LOOK } from './surface-looks.js';
export { PATTERNS, PATTERN_SCALE } from './patterns.js';
export { buildDieGeometry, paintGlyphMask, loadNumeralFont, setDim, facesShowing, atlasLayout } from './die-mesh.js';
export { FINISHES, dieMaterial, recolour, setGlyph } from './finishes.js';
export { NUMERAL_FONTS } from './numeral-fonts.js';
export { DIE_PRESETS, presetProblem, presetStyle, sameLook } from './presets.js';
export { SPECULAR } from './finish-table.js';
