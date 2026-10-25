// render/numeral-fonts.js — THE numeral fonts as data (no DOM, so node tests it).
//
// One entry per font the dice can print their numbers in, all the same shape. A font with a `file`
// is vendored under fonts/ and loaded before a die is painted in it (render/die-mesh.js ▸
// loadNumeralFont); the others are system font stacks. Numerals are sized from the measured height
// of the digit 8, so every font prints at the same visual size; `size` fine-tunes that.
//
// "A gothic" (owner 2026-10-24) reads two ways — blackletter, or gothic sans-serif — so both are here.

export const NUMERAL_FONTS = {
  classic: { label: 'Classic', family: 'Georgia, "Times New Roman", serif', weight: '700', size: 1 },
  gothic: {
    label: 'Gothic (blackletter)', family: '"Grenze Gotisch", Georgia, serif', weight: '800', size: 1.05,
    face: 'Grenze Gotisch', file: 'fonts/grenze-gotisch/GrenzeGotisch-wght.ttf', weights: '100 900',
  },
  sans: { label: 'Gothic sans', family: '"Segoe UI", "Helvetica Neue", Arial, sans-serif', weight: '700', size: 1 },
};
