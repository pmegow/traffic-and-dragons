/* dice-sound.js — #659: THE SOUND OF A DIE ROLL — a recording, chosen and placed by what the die did (owner 2026-10-22:
   "audio for the dice rolls, preferably that match what the dice do"; a synthesized sound shipped first and was ruled
   "pretty bad" on 2026-10-23 — "take the aunrea ones": aunrea's CC0 "Dice Rolls" recordings on Freesound, chosen by ear).
   Two data files load before this one: dice/manifest.js (DICE_MANIFEST — the render scene read each clip's motion off its
   bake: every HIT as [time, approach speed] and every ROLLING stretch as [from, to, spin, spin]) and dice/sfx/manifest.js
   (DICE_SFX — the receipt of ONE sprite, dice/sfx/dice-rolls-vN.mp3, cut by dev/dice-sfx.js: nineteen one-shot takes,
   three or four per die, each with its CUT on the decoded timeline, its LANDING seconds into the cut and its LENGTH from
   the landing to the last impact). The plan is pure: the clip's MOTION is its first hit to its last hit or rolling
   stretch; the take whose recorded length is nearest wins; it starts so the recorded landing falls on the clip's landing
   (plus the tile's offset), and a clip that lands sooner than the take's landing starts the take partway in. The recipe is
   one sound.js `sample` note, so the sound setting, the #657 master mute and the per-play bus apply as to every earcon.
   The sprite is fetched and decoded ONCE on Sound's context (preload at game start and on the review page) and adopted
   only if every cut fits the decoded buffer. Node-safe: the plan and the fit check are pure; the loader and the player
   are guarded. A die with no record, no take or no sprite makes no sound and says so once — never a wrong sound. */
var DICE_SFX_FIT_SLACK = 0.01;   /* seconds a decoded sprite may fall short of the last cut (the decoder's rounding) */
var _diceSfx = { buffer: null, loading: null, failed: "", said: {} };
/* The record for one clip, or null: the manifest's clip entry carries hits and roll once the measure pass has run. */
function diceCue(sides, face) {
  var man = (typeof DICE_MANIFEST !== "undefined") ? DICE_MANIFEST : null, set = man && man.dice && man.dice["d" + sides];
  var ff = (face < 10 ? "0" : "") + face, clip = set && set.clips && set.clips[ff];
  if (!clip || !Array.isArray(clip.hits) || !clip.hits.length) return null;
  return { hits: clip.hits, roll: Array.isArray(clip.roll) ? clip.roll : [], frames: set.frames, fps: set.fps };
}
/* The clip's motion from its record: it lands at its first hit; it is still moving until its last hit or rolling stretch. */
function diceMotion(cue) {
  var landing = cue.hits[0][0], last = landing, i;
  for (i = 0; i < cue.hits.length; i++) if (cue.hits[i][0] > last) last = cue.hits[i][0];
  for (i = 0; i < cue.roll.length; i++) if (cue.roll[i][1] > last) last = cue.roll[i][1];
  return { landing: landing, length: last - landing };
}
/* The take of d<sides> whose recorded length is nearest `length` (the earlier on a tie), or null without takes. */
function diceSoundTake(sides, length, sfx) {
  var set = sfx && sfx.dice && sfx.dice["d" + sides], takes = set && set.takes, best = 0, i;
  if (!Array.isArray(takes) || !takes.length) return null;
  for (i = 1; i < takes.length; i++) if (Math.abs(takes[i].length - length) < Math.abs(takes[best].length - length)) best = i;
  return { index: best, take: takes[best] };
}
/* The plan (pure): which take, when it starts (clip seconds + offset), from where in the sprite, for how long. Null when
   the clip has no record or the die no take. `sfx` defaults to the loaded receipt. */
function diceSoundPlan(sides, face, offset, sfx) {
  var cue = diceCue(sides, face), man = (sfx !== undefined) ? sfx : ((typeof DICE_SFX !== "undefined") ? DICE_SFX : null);
  if (!cue) return null;
  var motion = diceMotion(cue), pick = diceSoundTake(sides, motion.length, man);
  if (!pick) return null;
  var take = pick.take, off = offset > 0 ? offset : 0, start = off + motion.landing - take.landing, into = 0;
  if (start < 0) { into = -start; start = 0; }                      /* the clip lands sooner than the take: begin partway in */
  var d = take.cut[1] - take.cut[0] - into;
  if (!(d > 0)) return null;
  return { label: "d" + sides + " rolls a " + face + " (take " + (pick.index + 1) + ")", sides: sides, face: face, take: pick.index, at: start, from: take.cut[0] + into, d: d, landing: off + motion.landing };
}
/* The recipe for sound.js: the plan as one sample note on `buffer`. */
function diceSoundRecipe(sides, face, offset, buffer, sfx) {
  var p = diceSoundPlan(sides, face, offset, sfx);
  if (!p) return null;
  return { label: p.label, wet: 0, notes: [{ type: "sample", t: p.at, d: p.d, from: p.from, buffer: buffer, g: 1, role: "take" }] };
}
/* "" when every take's cut lies inside the decoded buffer, else the reason (the first take that runs past it). */
function diceSoundFit(buffer, sfx) {
  if (!buffer || !(buffer.duration > 0)) return "no decoded sprite";
  if (!sfx || !sfx.dice) return "no sprite receipt (dice/sfx/manifest.js)";
  var keys = Object.keys(sfx.dice), k, i;
  for (k = 0; k < keys.length; k++) {
    var takes = sfx.dice[keys[k]].takes || [];
    for (i = 0; i < takes.length; i++) if (!(takes[i].cut && takes[i].cut[1] <= buffer.duration + DICE_SFX_FIT_SLACK)) return keys[k] + " take " + (i + 1) + " ends at " + takes[i].cut[1] + " s but the decoded sprite is " + buffer.duration + " s — the cut list does not fit (re-cut with dev/dice-sfx.js)";
  }
  return "";
}
function diceSoundSay(key, msg) {
  if (_diceSfx.said[key]) return;
  _diceSfx.said[key] = true;
  if (typeof console !== "undefined") console.warn("[dice-sound] " + msg);
}
/* Installs a decoded sprite — only one the cut list fits; a misfit is refused, said once and reported. Null uninstalls. */
function diceSoundAdopt(buffer) {
  if (buffer === null) { _diceSfx.buffer = null; _diceSfx.failed = ""; _diceSfx.said = {}; return false; }
  var bad = diceSoundFit(buffer, (typeof DICE_SFX !== "undefined") ? DICE_SFX : null);
  if (bad) {
    _diceSfx.failed = bad; diceSoundSay("fit", bad);
    if (typeof reportError === "function") reportError("dice-sfx", bad, { duration: buffer && buffer.duration });
    return false;
  }
  _diceSfx.buffer = buffer; _diceSfx.failed = "";
  return true;
}
/* Fetches and decodes the sprite once on Sound's context; resolves true when adopted. `opts.base` prefixes the receipt's
   path for a page outside the root (the review page passes "../"). A failure is said once and reported, never thrown. */
function diceSoundPreload(opts) {
  if (_diceSfx.buffer) return Promise.resolve(true);
  if (_diceSfx.loading) return _diceSfx.loading;
  var man = (typeof DICE_SFX !== "undefined") ? DICE_SFX : null;
  if (!man || !man.file) { _diceSfx.failed = "no sprite receipt"; diceSoundSay("receipt", "no sprite receipt (dice/sfx/manifest.js) — the rolls play silent"); return Promise.resolve(false); }
  if (typeof fetch !== "function" || typeof Sound === "undefined" || typeof Sound.context !== "function") { _diceSfx.failed = "no fetch or no Sound"; return Promise.resolve(false); }
  var ctx = Sound.context();
  if (!ctx || typeof ctx.decodeAudioData !== "function") { _diceSfx.failed = "no AudioContext"; diceSoundSay("ctx", "no AudioContext — the rolls play silent"); return Promise.resolve(false); }
  var url = ((opts && opts.base) || "") + man.file;
  _diceSfx.loading = fetch(url).then(function (r) {
    if (!r.ok) throw new Error("HTTP " + r.status);
    return r.arrayBuffer();
  }).then(function (bytes) {
    return new Promise(function (resolve, reject) { ctx.decodeAudioData(bytes, resolve, reject); });
  }).then(function (buffer) {
    _diceSfx.loading = null;
    return diceSoundAdopt(buffer);
  }, function (e) {
    _diceSfx.loading = null;
    _diceSfx.failed = "could not load " + url + ": " + (e && e.message || e);
    diceSoundSay("load-" + url, _diceSfx.failed + " — the rolls play silent");
    if (typeof reportError === "function") reportError("dice-sfx", _diceSfx.failed, { url: url });
    return false;
  });
  return _diceSfx.loading;
}
/* Plays the clip's sound now (sound.js schedules from this moment; offset delays the start). False when it cannot.
   `force` plays even with UI sounds off — an AUDITION (dev/dice-review.html), the same licence Sound.preview has: a
   click that asks to hear a roll must not read as broken. The game never passes it. */
function diceSoundPlay(sides, face, offset, force) {
  if (typeof Sound === "undefined" || typeof Sound.play !== "function") return false;
  var plan = diceSoundPlan(sides, face, offset), key = "d" + sides + "_" + face;
  if (!plan) { diceSoundSay(key, "no record or no take for " + key + " — the roll plays silent (run dev/blender/dice-clips.js --measure, then dev/dice-sfx.js)"); return false; }
  if (!_diceSfx.buffer) {
    diceSoundPreload();
    diceSoundSay("not-loaded", "the dice sprite is not loaded (" + (_diceSfx.failed || "still loading") + ") — this roll plays silent");
    return false;
  }
  return Sound.play(diceSoundRecipe(sides, face, offset, _diceSfx.buffer), !!force);
}
function diceSoundState() { return _diceSfx.buffer ? "loaded" : _diceSfx.loading ? "loading" : _diceSfx.failed ? "failed: " + _diceSfx.failed : "idle"; }
var DiceSound = { cue: diceCue, motion: diceMotion, take: diceSoundTake, plan: diceSoundPlan, recipe: diceSoundRecipe, fit: diceSoundFit, adopt: diceSoundAdopt, preload: diceSoundPreload, play: diceSoundPlay, state: diceSoundState };
