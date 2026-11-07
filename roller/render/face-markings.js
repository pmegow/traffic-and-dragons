// Face markings share one atlas slot and the material's ink/engraving mask.
// Coordinates are in a three-by-three grid centered on the face.
export const PIP_LAYOUTS = {
  1: [[0, 0]],
  2: [[-1, -1], [1, 1]],
  3: [[-1, -1], [0, 0], [1, 1]],
  4: [[-1, -1], [1, -1], [-1, 1], [1, 1]],
  5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]],
  6: [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]],
};
export const PIP_SPACING = 0.55, PIP_RADIUS = 0.25;
// Preserve each die's glyph size and each font's visual-height adjustment.
export const NUMERAL_SCALE = 1.65;

/** Missing flags retain the enlarged style used before the toggle existed. */
export const numeralScale = style => style.largeNumbers === false ? 1 : NUMERAL_SCALE;
export const numeralKey = style => style.font + (style.largeNumbers === false ? ':regular' : '');

/** The only die-type boundary: every other die retains the selected numeral font. */
export function faceMarking(type, style) {
  return style.classicD6 && type === 'd6'
    ? { key: 'classic-d6', mode: 'pips' }
    : { key: numeralKey(style), mode: 'numerals', font: style.font, scale: numeralScale(style) };
}

const PAINTERS = {
  numerals(ctx, font, scale) {
    ctx.font = font.weight + ' 100px ' + font.family;
    const m8 = ctx.measureText('8');
    const per100 = (m8.actualBoundingBoxAscent + m8.actualBoundingBoxDescent) / 100;
    if (!(per100 > 0)) throw new Error('paintGlyphMask: the font ' + font.family + ' measured no digit height');
    return ({ text, size, ambiguous }) => {
      const h = size * 0.7 * font.size * scale;
      ctx.font = font.weight + ' ' + (h / per100).toFixed(1) + 'px ' + font.family;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'alphabetic';
      const ink = ctx.measureText(text);
      ctx.fillText(text, 0, (ink.actualBoundingBoxAscent - ink.actualBoundingBoxDescent) / 2);
      if (ambiguous) ctx.fillRect(-h * 0.31, h * 0.6, h * 0.62, h * 0.1);
    };
  },
  pips(ctx) {
    return ({ value, size }) => {
      const points = PIP_LAYOUTS[value];
      if (!points) throw new Error('Classic d6: no dot pattern for value ' + value);
      for (const [x, y] of points) {
        ctx.beginPath();
        ctx.arc(x * size * PIP_SPACING, y * size * PIP_SPACING, size * PIP_RADIUS, 0, Math.PI * 2);
        ctx.fill();
      }
    };
  },
};

/** A painter consumes the same value/text/size slot for numerals or dots; no geometry changes. */
export function createFacePainter(ctx, font, mode = 'numerals', scale = NUMERAL_SCALE) {
  const make = PAINTERS[mode];
  if (!make) throw new Error('No face marking painter "' + mode + '"');
  return make(ctx, font, scale);
}
