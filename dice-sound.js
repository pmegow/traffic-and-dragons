/* dice-sound.js — #659: THE SOUND OF A DIE ROLL, synthesized from what the die did (owner 2026-10-22: "audio for the dice
   rolls, preferably that match what the dice do"; ruling the same day: synthesized from the physics, no files).
   The render scene reads each clip's motion off its bake and the batch records it on the manifest (dice/manifest.js,
   loaded before this file): every HIT as [time, approach speed] — the landing, a bounce — and every ROLLING stretch as
   [from, to, turning speed at the start, at the end]. This file turns that record into a sound.js recipe: a bone-on-felt
   tick per hit, louder the harder it landed (and a low thud under a hard one); across each rolling stretch a train of
   small taps spaced by how fast the die tips over its faces (a cube tips a quarter turn a face, an icosahedron a sixth
   of that — so a d20 clatters faster at the same spin) over a soft felt rumble that fades as the roll slows; the small
   dice click brighter, the d20 knocks lower. ui-dice.js plays it the moment the clip's playback starts, with the tile's
   stagger as the offset, so the ticks land where the die lands. sound.js does the synthesis, under the sound setting
   and the #657 master mute; no file, no fetch, nothing new to cache. Node-safe: the recipe is pure; the player is
   guarded. A die with no record on the manifest makes no sound and says so once on the console (never a wrong sound). */
var DICE_SOUND = {/* per die: the contact band (Hz, Q) and the angle a face tips through (radians) — the clatter's spacing */
  4: { f: 3400, q: 1.6, tip: 1.911 },   /* a tetrahedron tips 109.5° a face */
  6: { f: 2800, q: 1.5, tip: 1.571 },   /* a cube, 90° */
  8: { f: 2600, q: 1.4, tip: 1.231 },   /* an octahedron, 70.5° */
  10: { f: 2400, q: 1.3, tip: 1.2 },    /* the kites, about 69° */
  12: { f: 2200, q: 1.2, tip: 1.107 },  /* a dodecahedron, 63.4° */
  20: { f: 1900, q: 1.1, tip: 0.729 }   /* an icosahedron, 41.8° */
};
var DICE_SOUND_HIT_MIN = 1.0;     /* a landing slower than this (units/s) is a brush, not a tick */
var DICE_SOUND_HIT_FULL = 8.0;    /* the approach speed at which a tick is as loud as it gets */
var DICE_SOUND_THUD_MIN = 3.0;    /* a landing this hard also thuds through the felt */
var DICE_SOUND_SPIN_FULL = 10.0;  /* the turning speed (rad/s) at which the clatter is as loud as it gets */
var DICE_SOUND_GAIN = { hit: 0.12, thud: 0.06, tap: 0.04, rumble: 0.014 };   /* peaks — quiet by the sound.js house style */
var DICE_SOUND_TAPS_MAX = 48;     /* taps per rolling stretch, at most — a long slow roll never floods the graph */
var _diceSoundSaid = {};
/* The record for one clip, or null: the manifest's clip entry carries hits and roll once the measure pass has run. */
function diceCue(sides, face) {
  var man = (typeof DICE_MANIFEST !== "undefined") ? DICE_MANIFEST : null, set = man && man.dice && man.dice["d" + sides];
  var ff = (face < 10 ? "0" : "") + face, clip = set && set.clips && set.clips[ff];
  if (!clip || !Array.isArray(clip.hits) || !clip.hits.length) return null;
  return { hits: clip.hits, roll: Array.isArray(clip.roll) ? clip.roll : [], frames: set.frames, fps: set.fps };
}
/* The recipe (pure): sound.js notes at clip seconds + offset. Null when the die has no record or no timbre. */
function diceSoundRecipe(sides, face, offset) {
  var tone = DICE_SOUND[sides], cue = diceCue(sides, face), notes = [], i, off = offset > 0 ? offset : 0;
  if (!tone || !cue) return null;
  for (i = 0; i < cue.hits.length; i++) {
    var t = cue.hits[i][0], v = cue.hits[i][1];
    if (!(v >= DICE_SOUND_HIT_MIN)) continue;
    var s = Math.min(1, v / DICE_SOUND_HIT_FULL), loud = Math.pow(s, 0.8);   /* loudness follows the energy's root, not the speed */
    notes.push({ type: "noise", t: off + t, d: 0.028 + 0.012 * s, g: DICE_SOUND_GAIN.hit * loud, bp: { f: tone.f, q: tone.q } });
    if (v >= DICE_SOUND_THUD_MIN) notes.push({ type: "noise", t: off + t, d: 0.06, g: DICE_SOUND_GAIN.thud * loud, bp: { f: 260, q: 0.8 } });
  }
  for (i = 0; i < cue.roll.length; i++) {
    var r = cue.roll[i], t0 = r[0], t1 = r[1], w0 = r[2] > 0 ? r[2] : 0, w1 = r[3] > 0 ? r[3] : 0, span = t1 - t0;
    if (!(span > 0)) continue;
    notes.push({ type: "noise", t: off + t0, d: span, g: DICE_SOUND_GAIN.rumble * Math.min(1, w0 / DICE_SOUND_SPIN_FULL), bp: { f: 180, q: 0.7 } });
    /* the taps: one per face the die tips over — the rate is the turning speed over the tip angle, read along the
       stretch as the spin falls from w0 to w1 */
    var tt = t0, n = 0;
    while (tt < t1 && n < DICE_SOUND_TAPS_MAX) {
      var w = w0 + (w1 - w0) * ((tt - t0) / span), rate = w / tone.tip;
      if (!(rate > 0.5)) break;                                  /* slower than a tap every two seconds is not a roll */
      notes.push({ type: "noise", t: off + tt, d: 0.016, g: DICE_SOUND_GAIN.tap * Math.min(1, w / DICE_SOUND_SPIN_FULL), bp: { f: tone.f * 0.85, q: tone.q } });
      tt += 1 / rate; n++;
    }
  }
  notes.sort(function (a, b) { return a.t - b.t; });
  return { label: "d" + sides + " rolls a " + face, wet: 0.06, notes: notes };
}
/* Plays the clip's sound now (sound.js schedules from this moment; offset delays every note). False when it cannot.
   `force` plays even with UI sounds off — an AUDITION (dev/dice-review.html), the same licence Sound.preview has: a
   click that asks to hear a roll must not read as broken. The game never passes it. */
function diceSoundPlay(sides, face, offset, force) {
  if (typeof Sound === "undefined" || typeof Sound.play !== "function") return false;
  var recipe = diceSoundRecipe(sides, face, offset);
  if (!recipe) {
    var key = "d" + sides + "_" + face;
    if (!_diceSoundSaid[key] && typeof console !== "undefined") { _diceSoundSaid[key] = true; console.warn("[dice-sound] no record for " + key + " on the manifest — the roll plays silent (run dev/blender/dice-clips.js --measure)"); }
    return false;
  }
  return Sound.play(recipe, !!force);
}
var DiceSound = { recipe: diceSoundRecipe, play: diceSoundPlay, cue: diceCue };
