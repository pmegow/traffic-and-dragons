// src/index.js — the public face of the dice simulator's core (no DOM, no three.js, runs in node).
//
//   roll(request)            bake a roll: the result, the track, the hits      (roll.js)
//   samplePose(result, i, t) the visual pose of die i at time t                 (track.js)
//   parseNotation('2d6+d20') a dice list for roll()                             (notation.js)
//   buildDie(type)           a die's full definition (shape, features, glyphs)  (dice.js)
//   World, Body, plane       the solver itself, for hosts that run their own scene
//
// The renderer lives apart in render/ and depends on three.js; this core depends on nothing.

export { VERSION } from './version.js';
export { roll, readDie, chooseSymmetry, trayFor, TRAY_DEFAULTS, ROLL_DEFAULTS, MAX_DICE } from './roll.js';
export { samplePose, rollDuration } from './track.js';
export { parseNotation } from './notation.js';
export { buildDie, dieTypes, DIE_TYPES } from './dice.js';
export { DIE_MATERIALS, SURFACES } from './materials.js';
export { World, WORLD_DEFAULTS } from './world.js';
export { Body, plane } from './body.js';
