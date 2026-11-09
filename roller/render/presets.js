// render/presets.js — THE built-in dice looks, and the shape every preset has (no three.js, so node
// tests it).
//
// A preset is a named die style (owner 2026-10-24: "the preset should store body and number colors,
// finish, font"): { name, body, ink, finish, font, classicD6, largeNumbers } — body and ink as #rrggbb, finish a FINISHES key,
// font a built-in key or stable installed/imported font reference; classicD6 selects dots on d6s (missing in old presets means false). view.setDieStyle(presetStyle(p)) puts one on the dice. The tray's surface
// is not part of a preset. largeNumbers defaults true; false restores the original numeral size.
//
// The built-ins: the view's own default first, then looks chosen in the toy on 2026-10-24; Jade and
// Ember were the owner's own saved presets, moved here at the owner's ask the same day. Every one prints its numerals
// in Gothic sans (owner 2026-10-27: "please set all die presets to use the gothic sans font. Legibility wins the day
// this project"; Carrara and Bone were Classic).

import { FINISHES } from './finish-table.js';
import { NUMERAL_FONTS, validFontKey } from './numeral-fonts.js';
import { VIEW_DEFAULTS } from './view-defaults.js';

export const DIE_PRESETS = [
  { name: 'Violet Glass', ...VIEW_DEFAULTS.dieStyle },
  { name: 'Teal Glass', body: '#087b86', ink: '#ffffff', finish: 'glass', font: 'sans' },
  { name: 'Carrara', body: '#ecebe8', ink: '#1b1b1b', finish: 'marble', font: 'sans' },
  { name: 'Teal Granite', body: '#368fa1', ink: '#d5d1aa', finish: 'granite', font: 'sans' },
  { name: 'Rust Granite', body: '#763d1e', ink: '#d5d1aa', finish: 'granite', font: 'sans' },
  { name: 'Ink Sketch', body: '#faf9f6', ink: '#151515', finish: 'inkSketch', font: 'sans', classicD6: false },
  { name: 'Sketch', body: '#eee3c9', ink: '#34312b', finish: 'sketch', font: 'sans', classicD6: true },
  { name: 'Bone', body: '#e8dcc0', ink: '#1b1b1b', finish: 'granite', font: 'sans' },   // granite: owner 2026-10-24
  { name: 'Jade', body: '#1b6515', ink: '#ffffff', finish: 'quartz', font: 'sans' },
  { name: 'Ember', body: '#000000', ink: '#c80404', finish: 'granite', font: 'sans' },
  { name: 'Brass', body: '#bfb584', ink: '#1b1b1b', finish: 'metal', font: 'sans' },   // metal and wood: owner 2026-10-29; brass HSV 50/31/75 (owner 2026-10-30; 50/50/80 the day before, after "#b8893c looks like a pumpkin")
  { name: 'Steel', body: '#9aa0a8', ink: '#15181c', finish: 'metal', font: 'sans' },
  { name: 'Walnut', body: '#5e3a1e', ink: '#eadfc8', finish: 'wood', font: 'sans' },
].map(p => ({ classicD6: false, largeNumbers: true, ...p }));

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
  if (!validFontKey(p.font)) return '"' + name + '": no font "' + p.font + '" (known: ' + Object.keys(NUMERAL_FONTS).join(', ') + ')';
  if (p.classicD6 !== undefined && typeof p.classicD6 !== 'boolean') return '"' + name + '": Classic d6 must be true or false';
  if (p.largeNumbers !== undefined && typeof p.largeNumbers !== 'boolean') return '"' + name + '": Large Numbers must be true or false';
  return null;
}

/** A preset's die style, for view.setDieStyle: { body, ink, finish, font, classicD6, largeNumbers }, colours in lower case. */
export function presetStyle(p) {
  return { body: p.body.toLowerCase(), ink: p.ink.toLowerCase(), finish: p.finish, font: p.font, classicD6: p.classicD6 === true, largeNumbers: p.largeNumbers !== false };
}

/** True when two looks are the same die style (colours compared without regard to case). */
export function sameLook(a, b) {
  const x = presetStyle(a), y = presetStyle(b);
  return x.body === y.body && x.ink === y.ink && x.finish === y.finish && x.font === y.font && x.classicD6 === y.classicD6 && x.largeNumbers === y.largeNumbers;
}
