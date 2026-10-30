// render/bake-job.js — one bake, as the worker runs it (TODO row 3, owner 2026-10-30: "Build 3": "Bake off the main
// thread. Twenty-four dice bake in about 70 ms on a desktop and more on a phone; a Web Worker keeps a big roll from
// stalling a frame"). Pure and node-tested; render/bake-worker.js is its thin shell. Imports only the core: a worker has
// no import map, so nothing here may ask for 'three'.

import { roll } from '../src/roll.js';

/**
 * Bakes `request` (a full roll() request) for job `id`: { message, transfer } — the message the worker posts back,
 * { id, result } or { id, error } (the refusal's own words), and the buffers it hands over rather than copies (every
 * die's track).
 */
export function bakeJob({ id, request }) {
  try {
    const result = roll(request);
    return { message: { id, result }, transfer: result.dice.map((d) => d.track.buffer) };
  } catch (e) {
    return { message: { id, error: (e && e.message) || String(e) }, transfer: [] };
  }
}
