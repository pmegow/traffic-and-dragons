// demo/color.js — colour maths for the toy's pickers (owner 2026-10-29: "the color picker sliders now are RGB only,
// add HSV sliders"). Pure, node-tested. Hex is the toy's stored form (#rrggbb, as <input type="color"> gives it);
// the sliders work in RGB bytes and in HSV — hue in degrees, saturation and value in percent.
//
//   hexToRgb('#8a49a2')      → { r: 138, g: 73, b: 162 }      null for anything that is not #rrggbb
//   rgbToHex({ r, g, b })    → '#8a49a2'                      each channel rounded and held to 0–255
//   rgbToHsv({ r, g, b })    → { h: 282.5…, s: 54.9…, v: 63.5… }   unrounded; grey has s = 0 and h = 0
//   hsvToRgb({ h, s, v })    → { r, g, b }                    unrounded; h wraps (390 is 30, -60 is 300)
//
// A colour through hex → hsv → hex comes back the same: the bytes round-trip (test/color.test.js walks a grid).

const byte = (x) => Math.min(255, Math.max(0, Math.round(Number(x) || 0)));
const unit = (x) => Math.min(1, Math.max(0, (Number(x) || 0) / 100));

export function hexToRgb(hex) {
  const m = /^#([0-9a-f]{6})$/i.exec(String(hex || '').trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

export function rgbToHex({ r, g, b }) {
  return '#' + [r, g, b].map((c) => byte(c).toString(16).padStart(2, '0')).join('');
}

export function rgbToHsv({ r, g, b }) {
  const R = byte(r) / 255, G = byte(g) / 255, B = byte(b) / 255;
  const max = Math.max(R, G, B), min = Math.min(R, G, B), d = max - min;
  let h = 0;
  if (d > 0) {
    if (max === R) h = ((G - B) / d) % 6;
    else if (max === G) h = (B - R) / d + 2;
    else h = (R - G) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return { h, s: max > 0 ? (d / max) * 100 : 0, v: max * 100 };
}

export function hsvToRgb({ h, s, v }) {
  const H = (((Number(h) || 0) % 360) + 360) % 360, S = unit(s), V = unit(v);
  const c = V * S, x = c * (1 - Math.abs(((H / 60) % 2) - 1)), m = V - c;
  const [R, G, B] = H < 60 ? [c, x, 0] : H < 120 ? [x, c, 0] : H < 180 ? [0, c, x] : H < 240 ? [0, x, c] : H < 300 ? [x, 0, c] : [c, 0, x];
  return { r: (R + m) * 255, g: (G + m) * 255, b: (B + m) * 255 };
}

/** The hex of an HSV colour, by way of its bytes. */
export const hsvToHex = (hsv) => rgbToHex(hsvToRgb(hsv));

/** Black or white, whichever reads on this colour (for the hex printed on a swatch). */
export function inkOn({ r, g, b }) {
  const lum = 0.2126 * byte(r) + 0.7152 * byte(g) + 0.0722 * byte(b);
  return lum > 140 ? '#000000' : '#ffffff';
}
