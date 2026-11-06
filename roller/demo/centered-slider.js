// A native range's two halves meet at the default, preserving each control's real limits and stops.
import { VIEW_DEFAULTS } from '../render/view-defaults.js';
import { TOY_DEFAULTS } from './toy-defaults.js';

export const SLIDER_RANGES = {
  speed: { min: 0.25, home: TOY_DEFAULTS.speed, max: 2, step: 0.05 },
  tray: { min: 0.7, home: VIEW_DEFAULTS.tray.scale, max: 3, step: 0.1 },
};

export function sliderPosition(range, value) {
  const v = Math.max(range.min, Math.min(range.max, value));
  return (v - range.home) / (v < range.home ? range.home - range.min : range.max - range.home);
}

export function sliderValue(range, position) {
  const p = Math.max(-1, Math.min(1, position));
  const raw = range.home + p * (p < 0 ? range.home - range.min : range.max - range.home);
  return Math.max(range.min, Math.min(range.max, Number((Math.round(raw / range.step) * range.step).toFixed(10))));
}

/** Bind a -1..1 native input to a real multiplier. Returns the current multiplier, never the track coordinate. */
export function bindCenteredSlider(input, output, range) {
  const read = () => sliderValue(range, Number(input.value));
  const update = () => {
    const value = read();
    input.value = sliderPosition(range, value);
    output.textContent = value.toFixed(2) + '×';
    input.setAttribute('aria-valuetext', output.textContent);
  };
  input.value = 0;
  input.addEventListener('input', update);
  // Native arrow increments are in track coordinates; each key must instead advance one real stop.
  const keys = { ArrowLeft: -1, ArrowDown: -1, ArrowRight: 1, ArrowUp: 1, PageDown: -10, PageUp: 10 };
  input.addEventListener('keydown', e => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    if (!(e.key in keys) && e.key !== 'Home' && e.key !== 'End') return;
    e.preventDefault();
    const before = read();
    const next = e.key === 'Home' ? range.min : e.key === 'End' ? range.max : before + keys[e.key] * range.step;
    input.value = sliderPosition(range, next);
    if (read() === before) return;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });
  update();
  return read;
}
