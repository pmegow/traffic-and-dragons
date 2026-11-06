// render/numeral-fonts.js — THE numeral fonts as data (no DOM, so node tests it).
//
// One entry per font the dice can print their numbers in, all the same shape. A font with a `file`
// is vendored under fonts/ and loaded before a die is painted in it (font-library.js); the others are system font stacks. Numerals are sized from the measured height
// of the digit 8, so every font prints at the same visual size; `size` fine-tunes that.
//
// "A gothic" (owner 2026-10-24) reads two ways — blackletter, or gothic sans-serif — so both are here.

export const NUMERAL_FONTS = {
  classic: { label: 'Classic', family: 'Georgia, "Times New Roman", serif', weight: '700', size: 1 },
  gothic: {
    label: 'Gothic (blackletter)', family: '"Grenze Gotisch", Georgia, serif', weight: '800', size: 1.05,
    face: 'Grenze Gotisch', file: 'fonts/grenze-gotisch/GrenzeGotisch-wght.ttf', weights: '100 900',
  },
  system: { label: 'System font', family: 'system-ui, sans-serif', weight: '700', size: 1 },
  sans: { label: 'Gothic sans', family: '"Segoe UI", "Helvetica Neue", Arial, sans-serif', weight: '700', size: 1 },
};

// Personal font references stay in presets even when that device cannot supply the font.
// Font bytes never go into presets; imported files are private to the local font store.
const personal = new Map();
const own = (key) => Object.prototype.hasOwnProperty.call(NUMERAL_FONTS, key);
const nameOK = name => typeof name === 'string' && name.trim().length > 0 && name.length <= 200 && !/[\x00-\x1f\x7f]/.test(name);
export const cssFontString = value => '"' + value.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
export function localFontKey(name) {
  if (!nameOK(name)) throw new Error('Choose a font with a valid name.');
  return 'local:' + encodeURIComponent(name);
}
export function validFontKey(key) {
  if (typeof key !== 'string') return false;
  if (own(key) || /^file:[a-f0-9]{64}$/.test(key)) return true;
  try { return key.startsWith('local:') && nameOK(decodeURIComponent(key.slice(6))); } catch { return false; }
}
export function numeralFont(key) {
  if (own(key)) return NUMERAL_FONTS[key];
  if (!validFontKey(key)) return NUMERAL_FONTS.system;
  if (!personal.has(key)) {
    const local = key.startsWith('local:');
    const name = local ? decodeURIComponent(key.slice(6)) : 'Imported font (' + key.slice(5, 13) + ')';
    const face = 'Dice ' + key;
    personal.set(key, { key, label: name, face, family: cssFontString(face) + ', system-ui, sans-serif', weight: '700', size: 1,
      source: { kind: local ? 'local' : 'file', value: local ? name : key } });
  }
  return personal.get(key);
}
export function nameImportedFont(key, label) {
  if (!/^file:[a-f0-9]{64}$/.test(key) || !nameOK(label)) throw new Error('Invalid saved font.');
  numeralFont(key).label = label;
}
