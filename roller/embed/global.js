// embed/global.js — dice-sim for a classic-script host: loading this module sets globalThis.DiceSim and
// fires a 'dicesim-ready' event on window. Traffic and Dragons' scripts are ES5 and cannot import a
// module; they load this one with a <script type="module"> tag and wait for the event. The host's page
// needs an import map with "three" and "three/addons/" pointing at vendor/three/ (see README).
//
//   DiceSim.createDiceOverlay({ container })   embed/overlay.js
//   DiceSim.presets()                          the built-in presets, the ones saved on this site, and the mixed bag
//   DiceSim.presetStyle(preset)                a preset's look, for overlay.setLook: its die style, or the mixed bag's styles
//   DiceSim.exits()                            the exits, [{ name, label }], for overlay.setExit
//   DiceSim.VERSION

import { createDiceOverlay, OVERLAY_DEFAULTS } from './overlay.js';
import { exitMenu } from '../render/exit-table.js';
import { DIE_PRESETS, presetStyle } from '../render/presets.js';
import { MIXED_BAG } from '../render/die-looks.js';
import { createPresetStore } from '../demo/preset-store.js';
import { VERSION } from '../src/version.js';

/** The built-ins first, then the looks saved in the toy on this site (the same storage, one origin). */
function presets() {
  try { return createPresetStore(globalThis.localStorage).list(); } catch (e) {
    console.warn('dice-sim: saved presets could not be read, so only the built-ins are listed', e);
    return DIE_PRESETS.map((p) => ({ ...p, builtIn: true }));
  }
}

// The mixed bag (owner 2026-10-30: "add a 'mixed bag' preset that will randomly assign a preset to each die"; "the
// game too"): listed after the presets, its look every other preset's style for each die to be dealt one of. For a
// host's listing it carries what a preset row shows: `body` a CSS background of the bag's colours (a swatch drew blank
// in TnD's Dice appearance without it), `ink` and `finish` ("mixed").
function lookPresets() {
  const list = presets();
  const swatch = 'linear-gradient(135deg, ' + list.slice(0, 6).map((p) => p.body).join(', ') + ')';
  return [...list, { name: MIXED_BAG, mixed: true, builtIn: true, body: swatch, ink: '#ffffff', finish: 'mixed' }];
}
function lookOf(p) {
  return p && p.mixed ? { bag: presets().map(presetStyle) } : presetStyle(p);
}

globalThis.DiceSim = Object.freeze({ VERSION, createDiceOverlay, OVERLAY_DEFAULTS, presets: lookPresets, presetStyle: lookOf, exits: exitMenu });
if (typeof globalThis.dispatchEvent === 'function') globalThis.dispatchEvent(new Event('dicesim-ready'));
