// embed/global.js — dice-sim for a classic-script host: loading this module sets globalThis.DiceSim and
// fires a 'dicesim-ready' event on window. Traffic and Dragons' scripts are ES5 and cannot import a
// module; they load this one with a <script type="module"> tag and wait for the event. The host's page
// needs an import map with "three" and "three/addons/" pointing at vendor/three/ (see README).
//
//   DiceSim.createDiceOverlay({ container })   embed/overlay.js
//   DiceSim.presets()                          the built-in presets and the ones saved on this site
//   DiceSim.presetStyle(preset)                a preset's die style, for overlay.setLook
//   DiceSim.VERSION

import { createDiceOverlay, OVERLAY_DEFAULTS } from './overlay.js';
import { DIE_PRESETS, presetStyle } from '../render/presets.js';
import { createPresetStore } from '../demo/preset-store.js';
import { VERSION } from '../src/version.js';

/** The built-ins first, then the looks saved in the toy on this site (the same storage, one origin). */
function presets() {
  try { return createPresetStore(globalThis.localStorage).list(); } catch (e) {
    console.warn('dice-sim: saved presets could not be read, so only the built-ins are listed', e);
    return DIE_PRESETS.map((p) => ({ ...p, builtIn: true }));
  }
}

globalThis.DiceSim = Object.freeze({ VERSION, createDiceOverlay, OVERLAY_DEFAULTS, presets, presetStyle });
if (typeof globalThis.dispatchEvent === 'function') globalThis.dispatchEvent(new Event('dicesim-ready'));
