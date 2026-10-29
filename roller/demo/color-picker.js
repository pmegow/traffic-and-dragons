// demo/color-picker.js — the toy's colour control: a plain swatch in the Body and Numbers fields that opens a panel
// of sliders — Hue · Saturation · Value, or Red · Green · Blue by a toggle (HSV by default, the choice kept on this
// browser), each track painted in the colours it runs through — with a hex field and the browser's own picker
// behind a button (its eyedropper, on a desktop). Owner 2026-10-29: "the color picker sliders now are RGB only, add
// HSV sliders" — the system picker's sliders are the system's (RGB on an iPhone); these are ours — then "No need to
// draw them both at the same time. Put a toggle on there. Default to HSV. No hex values in the color swatches."
//
// The <input type="color"> stays the value's home: the picker writes it and fires its 'input' event, so everything
// that read the input before reads it still (the look, the presets, the saved look). sync() takes the input's value
// back into the swatch and the sliders after the look was set from elsewhere (a preset, the system picker).
// The picker keeps its own hue and saturation while open, so a slide through grey or black does not lose them
// (bytes cannot hold a hue at s = 0 or v = 0). One panel is open at a time; Escape, the ×, the swatch again or a
// tap outside closes it.
//
//   const picker = attachColorPicker(input);   // input: an <input type="color">, inside its <label>
//   picker.sync()                              // after input.value was written by code
//   picker.open() / picker.close() / picker.isOpen / picker.hex
//   attachColorPicker.closeAll()
//   attachColorPicker.mode                     // 'hsv' | 'rgb': the sliders showing, for every picker

import { hexToRgb, rgbToHex, rgbToHsv, hsvToRgb, hsvToHex } from './color.js';

export const COLOR_MODE_KEY = 'dice-sim:colour-sliders';
export const COLOR_MODES = [{ key: 'hsv', label: 'HSV' }, { key: 'rgb', label: 'RGB' }];
const DEFAULT_MODE = 'hsv';
let mode = DEFAULT_MODE;
try {
  const saved = localStorage.getItem(COLOR_MODE_KEY);
  if (COLOR_MODES.some((m) => m.key === saved)) mode = saved;
} catch { /* storage blocked: HSV it is */ }

const CHANNELS = [
  { key: 'h', group: 'hsv', label: 'Hue', min: 0, max: 360, step: 1, unit: '°' },
  { key: 's', group: 'hsv', label: 'Saturation', min: 0, max: 100, step: 1, unit: '%' },
  { key: 'v', group: 'hsv', label: 'Value', min: 0, max: 100, step: 1, unit: '%' },
  { key: 'r', group: 'rgb', label: 'Red', min: 0, max: 255, step: 1, unit: '' },
  { key: 'g', group: 'rgb', label: 'Green', min: 0, max: 255, step: 1, unit: '' },
  { key: 'b', group: 'rgb', label: 'Blue', min: 0, max: 255, step: 1, unit: '' },
];
const HUE_STOPS = [0, 60, 120, 180, 240, 300, 360].map((h) => hsvToHex({ h, s: 100, v: 100 }));

let open = null;   // the picker whose panel is showing
const pickers = new Set();

export function attachColorPicker(input) {
  if (!input || input.type !== 'color') throw new Error('attachColorPicker: an <input type="color"> is needed');
  const label = input.closest('label');
  const name = (label ? label.textContent : input.id).trim() || 'Colour';
  const state = { h: 0, s: 0, v: 0 };
  const fromHex = (hex) => {
    const rgb = hexToRgb(hex);
    if (!rgb) return false;
    const hsv = rgbToHsv(rgb);
    // A grey keeps the hue it had, black the saturation too: the bytes cannot say, the picker can.
    if (hsv.s > 0) state.h = hsv.h;
    if (hsv.v > 0) state.s = hsv.s;
    state.v = hsv.v;
    return true;
  };
  fromHex(input.value);

  input.classList.add('has-picker');
  input.tabIndex = -1;
  input.setAttribute('aria-hidden', 'true');
  const swatch = document.createElement('button');
  swatch.type = 'button';
  swatch.className = 'swatch';
  swatch.setAttribute('aria-haspopup', 'dialog');
  swatch.setAttribute('aria-expanded', 'false');
  swatch.setAttribute('aria-label', name + ' colour');
  input.insertAdjacentElement('afterend', swatch);

  let panel = null, controls = null, hexField = null, big = null, modeButtons = null, boxes = null;
  /** Shows one kind of slider and remembers the choice; every picker follows, since the choice is the module's. */
  const showMode = () => {
    if (!panel) return;
    for (const m of COLOR_MODES) {
      boxes[m.key].hidden = m.key !== mode;
      modeButtons[m.key].setAttribute('aria-pressed', String(m.key === mode));
    }
  };
  const setMode = (key) => {
    if (!COLOR_MODES.some((m) => m.key === key)) throw new Error('colour sliders: no mode "' + key + '"');
    mode = key;
    try { localStorage.setItem(COLOR_MODE_KEY, mode); } catch { /* storage blocked: this page remembers */ }
    showMode();
  };
  const build = () => {
    panel = document.createElement('div');
    panel.className = 'color-panel';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', name + ' colour');
    const head = document.createElement('div');
    head.className = 'color-head';
    big = document.createElement('div');
    big.className = 'color-big';
    hexField = document.createElement('input');
    hexField.className = 'color-hex';
    hexField.maxLength = 7;
    hexField.spellcheck = false;
    hexField.autocomplete = 'off';
    hexField.setAttribute('aria-label', name + ' colour as hex');
    const system = document.createElement('button');
    system.type = 'button';
    system.className = 'ghost color-system';
    system.textContent = 'System picker';
    system.title = 'The browser\'s own colour picker';
    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'clear color-close';
    close.setAttribute('aria-label', 'Close the colour sliders');
    close.textContent = '×';
    head.append(big, hexField, system, close);
    panel.appendChild(head);
    // The toggle: one kind of slider showing at a time, HSV unless this browser chose RGB.
    const modes = document.createElement('div');
    modes.className = 'color-mode';
    modes.setAttribute('role', 'group');
    modes.setAttribute('aria-label', 'Which sliders');
    modeButtons = {};
    for (const m of COLOR_MODES) {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = m.label;
      b.addEventListener('click', () => setMode(m.key));
      modes.appendChild(b);
      modeButtons[m.key] = b;
    }
    panel.appendChild(modes);
    controls = {};
    boxes = {};
    for (const group of ['hsv', 'rgb']) {
      const box = document.createElement('div');
      box.className = 'color-sliders ' + group;
      boxes[group] = box;
      for (const ch of CHANNELS.filter((c) => c.group === group)) {
        const row = document.createElement('label');
        row.className = 'chan';
        const text = document.createElement('span');
        text.textContent = ch.label;
        const out = document.createElement('output');
        const range = document.createElement('input');
        range.type = 'range';
        range.className = 'chan-range';
        range.min = ch.min; range.max = ch.max; range.step = ch.step;
        range.setAttribute('aria-label', name + ' ' + ch.label.toLowerCase());
        row.append(text, out, range);
        box.appendChild(row);
        controls[ch.key] = { range, out, ch };
        range.addEventListener('input', () => slide(ch.key, Number(range.value)));
      }
      panel.appendChild(box);
    }
    hexField.addEventListener('input', () => { if (fromHex(hexField.value)) commit({ keepHex: true }); });
    hexField.addEventListener('blur', () => paint());
    hexField.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); hexField.blur(); } });
    system.addEventListener('click', () => {
      try { if (typeof input.showPicker === 'function') input.showPicker(); else input.click(); } catch (e) { console.warn('colour: the system picker would not open', e); }
    });
    close.addEventListener('click', () => api.close());
    panel.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.stopPropagation(); api.close(); swatch.focus(); } });
  };

  const rgbNow = () => hsvToRgb(state);
  const slide = (key, value) => {
    if (key === 'h' || key === 's' || key === 'v') state[key] = value;
    else {
      const rgb = rgbNow();
      rgb[key] = value;
      const hsv = rgbToHsv(rgb);
      if (hsv.s > 0) state.h = hsv.h;
      if (hsv.v > 0) state.s = hsv.s;
      state.v = hsv.v;
    }
    commit({ moving: key });
  };
  /** Writes the colour home (the input) and repaints; the input's 'input' event carries it to the look. */
  const commit = ({ keepHex = false, moving = null } = {}) => {
    const hex = hsvToHex(state);
    if (input.value !== hex) {
      input.value = hex;
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }
    paint({ keepHex, moving });
  };
  const track = (stops) => 'linear-gradient(to right, ' + stops.join(', ') + ')';
  /** The swatch, the panel's big swatch, the hex field and every slider — its position and its track. */
  const paint = ({ keepHex = false, moving = null } = {}) => {
    const rgb = rgbNow(), hex = rgbToHex(rgb);
    swatch.style.background = hex;   // the colour alone: no hex on a swatch (owner 2026-10-29)
    if (!panel) return;
    big.style.background = hex;
    if (!keepHex) hexField.value = hex;
    const { h, s, v } = state;
    const tracks = {
      h: HUE_STOPS,
      s: [hsvToHex({ h, s: 0, v }), hsvToHex({ h, s: 100, v })],
      v: [hsvToHex({ h, s, v: 0 }), hsvToHex({ h, s, v: 100 })],
      r: [rgbToHex({ ...rgb, r: 0 }), rgbToHex({ ...rgb, r: 255 })],
      g: [rgbToHex({ ...rgb, g: 0 }), rgbToHex({ ...rgb, g: 255 })],
      b: [rgbToHex({ ...rgb, b: 0 }), rgbToHex({ ...rgb, b: 255 })],
    };
    const values = { h, s, v, r: rgb.r, g: rgb.g, b: rgb.b };
    for (const key of Object.keys(controls)) {
      const { range, out, ch } = controls[key];
      const value = Math.round(values[key]);
      if (key !== moving) range.value = value;   // the slider under the finger keeps its own position
      out.textContent = value + ch.unit;
      range.style.background = track(tracks[key]);
    }
  };

  const onOutside = (e) => { if (panel && !panel.contains(e.target) && e.target !== swatch) api.close(); };
  const api = {
    get isOpen() { return open === api; },
    get hex() { return hsvToHex(state); },
    get input() { return input; },
    sync() { fromHex(input.value); paint(); },
    open() {
      if (open && open !== api) open.close();
      if (!panel) build();
      fromHex(input.value);
      const row = label && label.parentElement && label.parentElement !== panel.parentElement ? label.parentElement : label;
      (row || input.parentElement).insertAdjacentElement('afterend', panel);
      open = api;
      swatch.setAttribute('aria-expanded', 'true');
      showMode();
      paint();
      document.addEventListener('pointerdown', onOutside, true);
      controls[mode === 'hsv' ? 'h' : 'r'].range.focus({ preventScroll: true });
    },
    close() {
      if (open !== api) return;
      open = null;
      swatch.setAttribute('aria-expanded', 'false');
      document.removeEventListener('pointerdown', onOutside, true);
      if (panel && panel.parentElement) panel.remove();
    },
  };
  swatch.addEventListener('click', () => (api.isOpen ? api.close() : api.open()));
  input.addEventListener('input', () => { if (!api.isOpen || document.activeElement === input) api.sync(); });   // the system picker
  pickers.add(api);
  paint();
  return api;
}

attachColorPicker.closeAll = () => { if (open) open.close(); };
Object.defineProperty(attachColorPicker, 'mode', { get: () => mode });
