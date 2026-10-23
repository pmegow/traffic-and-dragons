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
/* THE CLACK (second cut, 2026-10-23 — the owner's reference recording, Audio/Inspiration/dice.mp3, measured: a landing
   peaks near -21 dBFS with its energy at 2 kHz over a 600-1000 Hz body and a 100 Hz thump, decays in ~30 ms, and is
   followed within 300 ms by five to seven smaller bounces 25-55 ms apart whose tails ring 170-300 ms; the first cut was a
   15 ms band-passed tick 17 dB quieter — "just a tick"). One contact = a short noise burst in the die's band + four
   decaying body partials (an inharmonic stack: no beep) + for a hard landing a thump and a SETTLE cascade of smaller
   clacks with the surface ringing under the last ones. Every note carries a `role` so the audition page and the tests
   can see what is what; sound.js ignores it. All of it is data: tune here, never in the synthesis. */
/* THE THIRD CUT (2026-10-23, owner ruling: dice2.mp3's WOODEN KNOCK leads — Audio/Inspiration/dice2.mp3 from 7 s, measured:
   a landing at -12 to -17 dBFS with its energy at 1.4 kHz over a 1 kHz and 600 Hz body and a 100-200 Hz thump that is the
   strongest band of all, 45-115 ms decays, bounces 50-150 ms apart whose tails ring 400-600 ms — dice on a table that
   answers. dice.mp3's drier clack (2-2.8 kHz, 30 ms) steps back to the second cut's record in TODO #659.) */
var DICE_SOUND = {/* per die: the contact band (Hz, Q), the angle a face tips through (radians — the clatter's spacing) and the body's pitch factor */
  4: { f: 1900, q: 0.9, tip: 1.911, body: 1.3 },   /* a tetrahedron tips 109.5° a face; small and bright */
  6: { f: 1600, q: 0.8, tip: 1.571, body: 1.12 },  /* a cube, 90° */
  8: { f: 1550, q: 0.8, tip: 1.231, body: 1.06 },  /* an octahedron, 70.5° */
  10: { f: 1500, q: 0.8, tip: 1.2, body: 1.0 },    /* the kites, about 69° */
  12: { f: 1450, q: 0.8, tip: 1.107, body: 0.95 }, /* a dodecahedron, 63.4° */
  20: { f: 1400, q: 0.8, tip: 0.729, body: 0.9 }   /* an icosahedron, 41.8°; the biggest body */
};
var DICE_SOUND_HIT_MIN = 1.0;     /* a landing slower than this (units/s) is a brush, not a clack */
var DICE_SOUND_HIT_FULL = 8.0;    /* the approach speed at which a clack is as loud as it gets */
var DICE_SOUND_THUD_MIN = 3.0;    /* a landing this hard also thumps the table and settles in a cascade */
var DICE_SOUND_SPIN_FULL = 10.0;  /* the turning speed (rad/s) at which the clatter is as loud as it gets */
var DICE_SOUND_GAIN = { hit: 0.25, thud: 0.14, tap: 0.12, rumble: 0.008 };   /* peaks per note — the house ceiling is 0.25; a clack's notes stack */
/* the clack's body: [Hz, seconds, share of the clack's gain, in a tap] — the 1.4 kHz wooden knock leads and rings longest,
   the 1 kHz and 600 Hz body under it, the 2 kHz click just behind, a little 2.8 kHz, a 300 Hz floor; a tap keeps the marked four */
var DICE_SOUND_BODY = [[1400, 0.12, 0.8, true], [2000, 0.06, 0.5, true], [1000, 0.14, 0.45, true], [600, 0.16, 0.4, false], [2800, 0.03, 0.2, true], [300, 0.12, 0.3, false]];
var DICE_SOUND_NOISE_D = 0.04;    /* the contact burst's length, seconds */
var DICE_SOUND_THUD = [[100, 0.16, 1.0], [150, 0.12, 0.6], [200, 0.09, 0.4]];   /* the table under a hard landing — the reference's strongest band */
/* the settle after a hard landing: smaller clacks at these gaps (seconds, cumulative) and shares, the surface ringing under the last two */
var DICE_SOUND_SETTLE = { gaps: [0.05, 0.07, 0.09, 0.12, 0.15], shares: [0.7, 0.5, 0.35, 0.25, 0.18], rings: [[1000, 0.55, 0.16], [600, 0.45, 0.12]] };
var DICE_SOUND_TAPS_MAX = 24;     /* taps per rolling stretch, at most — a long slow roll never floods the graph */
var DICE_SOUND_NOTES_MAX = 180;   /* notes a recipe may carry — a phone's graph stays small */
var _diceSoundSaid = {};
/* The record for one clip, or null: the manifest's clip entry carries hits and roll once the measure pass has run. */
function diceCue(sides, face) {
  var man = (typeof DICE_MANIFEST !== "undefined") ? DICE_MANIFEST : null, set = man && man.dice && man.dice["d" + sides];
  var ff = (face < 10 ? "0" : "") + face, clip = set && set.clips && set.clips[ff];
  if (!clip || !Array.isArray(clip.hits) || !clip.hits.length) return null;
  return { hits: clip.hits, roll: Array.isArray(clip.roll) ? clip.roll : [], frames: set.frames, fps: set.fps };
}
/* A deterministic 0..1 per (die, index): the taps' small differences, the same every time a clip plays. */
function diceSoundHash(sides, i) { var h = Math.sin(i * 12.9898 + sides * 78.233) * 43758.5453; return h - Math.floor(h); }
/* One contact: the burst in the die's band and the four body partials, scaled by `g` (the clack's gain), `len` (1 = a
   landing; a tap's shorter decays) and `pitch` (a tap's jitter). `role` names the note for the audition and the tests. */
function diceSoundClack(notes, t, g, tone, len, pitch, role) {
  var i, tap = role === "tap";
  notes.push({ type: "noise", t: t, d: DICE_SOUND_NOISE_D * len, g: g, bp: { f: tone.f * pitch, q: tone.q }, role: role });
  for (i = 0; i < DICE_SOUND_BODY.length; i++) {
    var p = DICE_SOUND_BODY[i];
    if (tap && !p[3]) continue;                                   /* a tap keeps the partials marked for it — a lighter graph */
    notes.push({ type: "sine", t: t, d: p[1] * len, f: p[0] * tone.body * pitch, w: "sine", g: g * p[2], atk: 0.002, role: role + "-body" });
  }
}
/* The recipe (pure): sound.js notes at clip seconds + offset. Null when the die has no record or no timbre. */
function diceSoundRecipe(sides, face, offset) {
  var tone = DICE_SOUND[sides], cue = diceCue(sides, face), notes = [], i, k, off = offset > 0 ? offset : 0;
  if (!tone || !cue) return null;
  for (i = 0; i < cue.hits.length; i++) {
    var t = off + cue.hits[i][0], v = cue.hits[i][1];
    if (!(v >= DICE_SOUND_HIT_MIN)) continue;
    var s = Math.min(1, v / DICE_SOUND_HIT_FULL), loud = Math.pow(s, 0.8);   /* loudness follows the energy's root, not the speed */
    diceSoundClack(notes, t, DICE_SOUND_GAIN.hit * loud, tone, 1, 1, "hit");
    if (v >= DICE_SOUND_THUD_MIN) {
      for (k = 0; k < DICE_SOUND_THUD.length; k++) notes.push({ type: "sine", t: t, d: DICE_SOUND_THUD[k][1], f: DICE_SOUND_THUD[k][0], w: "sine", g: DICE_SOUND_GAIN.thud * loud * DICE_SOUND_THUD[k][2], atk: 0.003, role: "thud" });
      /* the settle: the die's smaller bounces after a hard landing, closer than any roll tap, the surface ringing under the last two */
      var n = Math.min(DICE_SOUND_SETTLE.gaps.length, 2 + Math.round(3 * s)), ts = t;
      for (k = 0; k < n; k++) {
        ts += DICE_SOUND_SETTLE.gaps[k];
        diceSoundClack(notes, ts, DICE_SOUND_GAIN.hit * loud * DICE_SOUND_SETTLE.shares[k], tone, 1 + 0.6 * (k / n), 1 + 0.03 * k, "settle");   /* the later bounces ring longer, as the reference's do */
        if (k >= n - 2) for (var q = 0; q < DICE_SOUND_SETTLE.rings.length; q++) { var rg = DICE_SOUND_SETTLE.rings[q]; notes.push({ type: "sine", t: ts, d: rg[1], f: rg[0] * tone.body, w: "sine", g: DICE_SOUND_GAIN.hit * loud * rg[2], atk: 0.004, role: "ring" }); }
      }
    }
  }
  for (i = 0; i < cue.roll.length; i++) {
    var r = cue.roll[i], t0 = r[0], t1 = r[1], w0 = r[2] > 0 ? r[2] : 0, w1 = r[3] > 0 ? r[3] : 0, span = t1 - t0;
    if (!(span > 0)) continue;
    notes.push({ type: "noise", t: off + t0, d: span, g: DICE_SOUND_GAIN.rumble * Math.min(1, w0 / DICE_SOUND_SPIN_FULL), bp: { f: 240, q: 0.7 }, role: "rumble" });
    /* the taps: one per face the die tips over — the rate is the turning speed over the tip angle, read along the
       stretch as the spin falls from w0 to w1; each a shorter clack with its own small jitter */
    var tt = t0, nt = 0;
    while (tt < t1 && nt < DICE_SOUND_TAPS_MAX) {
      var w = w0 + (w1 - w0) * ((tt - t0) / span), rate = w / tone.tip;
      if (!(rate > 0.5)) break;                                  /* slower than a tap every two seconds is not a roll */
      var h1 = diceSoundHash(sides, nt + i * 100), h2 = diceSoundHash(sides, nt + 50 + i * 100);
      diceSoundClack(notes, off + tt, DICE_SOUND_GAIN.tap * Math.min(1, w / DICE_SOUND_SPIN_FULL) * (0.75 + 0.5 * h1), tone, 0.6, 0.94 + 0.12 * h2, "tap");
      tt += 1 / rate; nt++;
    }
  }
  notes.sort(function (a, b) { return a.t - b.t; });
  if (notes.length > DICE_SOUND_NOTES_MAX) notes.length = DICE_SOUND_NOTES_MAX;   /* sorted by time, so the late tail is what goes */
  return { label: "d" + sides + " rolls a " + face, wet: 0.05, notes: notes };
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
