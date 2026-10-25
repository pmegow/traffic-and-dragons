// render/presets.js — THE built-in dice looks, and the shape every preset has (no three.js, so node
// tests it).
//
// A preset is a named die style (owner 2026-10-24: "the preset should store body and number colors,
// finish, font"): { name, body, ink, finish, font } — body and ink as #rrggbb, finish a FINISHES key,
// font a NUMERAL_FONTS key. view.setDieStyle(presetStyle(p)) puts one on the dice. The tray's surface
// is not part of a preset.
//
// The built-ins: the view's own default first, then looks chosen in the toy on 2026-10-24; Jade and
// Ember were the owner's own saved presets, moved here at the owner's ask the same day.

import { FINISHES } from './finish-table.js';
import { NUMERAL_FONTS } from './numeral-fonts.js';
import { VIEW_DEFAULTS } from './view-defaults.js';

export const DIE_PRESETS = [
  { name: 'Violet glass', ...VIEW_DEFAULTS.dieStyle },
  { name: 'Carrara', body: '#ecebe8', ink: '#1b1b1b', finish: 'marble', font: 'classic' },
  { name: 'Teal granite', body: '#368fa1', ink: '#d5d1aa', finish: 'granite', font: 'sans' },
  { name: 'Rust granite', body: '#763d1e', ink: '#d5d1aa', finish: 'granite', font: 'sans' },
  { name: 'Bone', body: '#e8dcc0', ink: '#1b1b1b', finish: 'none', font: 'classic' },
  { name: 'Jade', body: '#1b6515', ink: '#ffffff', finish: 'quartz', font: 'sans' },
  { name: 'Ember', body: '#000000', ink: '#c80404', finish: 'granite', font: 'sans' },
];

/** The longest name a preset may have. */
export const PRESET_NAME_MAX = 40;

const HEX = /^#[0-9a-f]{6}$/i;

/** What is wrong with a preset, in words, or null when it is a good one. */
export function presetProblem(p) {
  if (!p || typeof p !== 'object') return 'a preset must be an object';
  const name = typeof p.name === 'string' ? p.name.trim() : '';
  if (!name) return 'a preset needs a name';
  if (name.length > PRESET_NAME_MAX) return 'the name "' + name.slice(0, 20) + '…" is longer than ' + PRESET_NAME_MAX + ' characters';
  if (!HEX.test(p.body)) return '"' + name + '": the body colour must be #rrggbb, got ' + p.body;
  if (!HEX.test(p.ink)) return '"' + name + '": the number colour must be #rrggbb, got ' + p.ink;
  if (!(p.finish in FINISHES)) return '"' + name + '": no finish "' + p.finish + '" (known: ' + Object.keys(FINISHES).join(', ') + ')';
  if (!(p.font in NUMERAL_FONTS)) return '"' + name + '": no font "' + p.font + '" (known: ' + Object.keys(NUMERAL_FONTS).join(', ') + ')';
  return null;
}

/** A preset's die style, for view.setDieStyle: { body, ink, finish, font }, colours in lower case. */
export function presetStyle(p) {
  return { body: p.body.toLowerCase(), ink: p.ink.toLowerCase(), finish: p.finish, font: p.font };
}

/** True when two looks are the same die style (colours compared without regard to case). */
export function sameLook(a, b) {
  const x = presetStyle(a), y = presetStyle(b);
  return x.body === y.body && x.ink === y.ink && x.finish === y.finish && x.font === y.font;
}
