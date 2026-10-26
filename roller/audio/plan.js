// audio/plan.js — WHAT the dice sound plays and WHEN: the pure half (no Web Audio; node tests it).
//
// Every sound is a recorded click from the bank (dev/cut-clicks.js: a plastic die on a wooden
// table, cut from aunrea's CC0 recordings). Nothing is synthesized: another surface is the same
// recording through a different filter.
//
//   rollEvents(result, …)   one event per impact the physics recorded — the click's loudness from
//                           the impact speed, its choice from the recorded clicks of that strength
//   exitSoundEvent(kind, …) a sound an exit makes (EXIT_SOUNDS): a spider's step
//
// (A cup rattle before the throw, built from these clicks, was tried on 2026-10-24 and removed the
// same day: too uniform — owner.)
//
// An event: { time (s from the start), die, type, click {start, length, strength}, gain, rate,
// timbre (a TIMBRES key), t (the roll's own time, for panning) }.

import { createRng, mixSeed } from '../src/rng.js';

/** m/s: an impact this fast plays its click at full strength (≈ the 90th percentile of a roll's hits). */
export const REF_SPEED = 1.0;

/**
 * What the click hit. The recordings ARE a die on wood; felt muffles them (the cloth eats the high
 * frequencies and much of the energy), stone brightens them, a die-to-die knock is thinner and
 * higher.
 */
export const TIMBRES = {
  wood: { gain: 1.0, lowpass: 18000, highpass: 80, rate: 1.0 },
  felt: { gain: 0.5, lowpass: 2300, highpass: 70, rate: 0.94 },
  stone: { gain: 1.1, lowpass: 20000, highpass: 350, rate: 1.06 },
  die: { gain: 0.75, lowpass: 18000, highpass: 900, rate: 1.18 },
};

/** Click amplitude for an impact speed: sound pressure follows the impact velocity (gently compressed). */
export function loudness(speed) {
  return Math.min(1.3, Math.max(0.02, Math.pow(speed / REF_SPEED, 0.9)));
}

/** The bank's clicks for a die type (a type the bank lacks borrows the d6's, and says so once). */
const warned = new Set();
function clicksFor(bank, type) {
  const list = bank.clicks[type];
  if (list && list.length) return list;
  if (!warned.has(type)) { warned.add(type); console.warn('dice audio: the click bank has no ' + type + ' recordings; using the d6\'s'); }
  return bank.clicks.d6;
}

/** A recorded click whose own strength is near `strength` (one of the nearest three, by r ∈ [0, 1)). */
export function pickClick(bank, type, strength, r) {
  const target = Math.log(Math.max(0.01, Math.min(1, strength)));
  const near = clicksFor(bank, type)
    .map((c) => ({ c, d: Math.abs(Math.log(c.strength) - target) }))
    .sort((a, b) => a.d - b.d)
    .slice(0, 3);
  return near[Math.min(near.length - 1, Math.floor(r * near.length))].c;
}

/** The tray surface a hit landed on ('floor' and 'ceiling' are the floor's, 'wall' the walls'). */
const SURFACE_OF = { floor: (tray) => tray.surface, ceiling: (tray) => tray.surface, wall: (tray) => tray.walls, die: () => 'die' };

/**
 * One event per recorded impact of a roll result, in time order. timeScale is roll seconds per
 * real second (DiceView's onStart gives it). A knock between two dice is recorded on both; it
 * plays once. At most `voices` clicks start in any 10 ms (the quietest are dropped).
 */
export function rollEvents(result, { bank, timeScale = 1, voices = 6 } = {}) {
  if (!bank) throw new Error('rollEvents: a click bank is required');
  if (!(timeScale > 0)) throw new Error('rollEvents: timeScale must be positive, got ' + timeScale);
  const rng = createRng(mixSeed(result.seedUsed, 0x50f7));
  const events = [];
  result.dice.forEach((d, i) => {
    for (const [t, speed, surface, other] of d.hits) {
      // A knock is filed on both dice; the lower-numbered die plays it. Each die's hits are merged
      // (12 ms, the loudest kept), so the other copy may be folded into that die's own click: the
      // higher-numbered die skips its copy whenever the other die already sounds in that window.
      if (surface === 'die' && other >= 0 && other < i && result.dice[other].hits.some((h) => h[0] <= t + 0.003 && t - h[0] < 0.015)) continue;
      const timbre = SURFACE_OF[surface](result.tray);
      const spec = TIMBRES[timbre];
      if (!spec) throw new Error('rollEvents: no timbre for "' + timbre + '"');
      const g = loudness(speed);
      events.push({
        time: t / timeScale, t, die: i, type: d.type, timbre,
        click: pickClick(bank, d.type, Math.min(1, g), rng.next()),
        gain: g * spec.gain,
        rate: spec.rate * (1 + rng.range(-0.03, 0.03)),
      });
    }
  });
  events.sort((a, b) => a.time - b.time || a.die - b.die);
  return limitVoices(events, voices);
}

/**
 * Sounds an exit makes, by kind. A step (Scurry off, owner 2026-10-26: "a sound for the spider legs
 * hitting the ground. The die click, but slightly quicker, slightly quieter, slightly higher pitch"): one
 * of the die's own softly recorded clicks (`strength`) on the table's surface, played `rate` × as fast
 * (higher and shorter) at `gain` × the surface's level. Each step varies by up to `vary` (pitch, level)
 * and sounds up to `spread` s late, so the feet of a stride patter rather than land as one.
 */
export const EXIT_SOUNDS = {
  step: { rate: 1.22, gain: 0.35, strength: 0.3, spread: 0.012, vary: { rate: 0.04, gain: 0.2 } },
};

/**
 * One exit sound as an event the engine plays (DiceAudio.playExitSound): `kind` an EXIT_SOUNDS key, `type`
 * the die's, `surface` the table's (a TIMBRES key), `strength` 0 … 1 how hard it lands.
 */
export function exitSoundEvent(kind, { bank, type, surface, strength = 1, random = Math.random }) {
  const sound = EXIT_SOUNDS[kind];
  if (!sound) throw new Error('exitSoundEvent: no exit sound "' + kind + '" (known: ' + Object.keys(EXIT_SOUNDS).join(', ') + ')');
  const spec = TIMBRES[surface];
  if (!spec) throw new Error('exitSoundEvent: no timbre for "' + surface + '"');
  return {
    kind, type, timbre: surface,
    click: pickClick(bank, type, sound.strength, random()),
    rate: spec.rate * sound.rate * (1 + sound.vary.rate * (2 * random() - 1)),
    gain: spec.gain * sound.gain * strength * (1 + sound.vary.gain * (2 * random() - 1)),
    after: sound.spread * random(),
  };
}

function limitVoices(events, voices) {
  const kept = [];
  for (const e of events) {
    const crowd = kept.filter((k) => e.time - k.time < 0.01);
    if (crowd.length < voices) { kept.push(e); continue; }
    const quietest = crowd.reduce((a, b) => (a.gain <= b.gain ? a : b));
    if (quietest.gain < e.gain) { kept.splice(kept.indexOf(quietest), 1); kept.push(e); }
  }
  return kept;
}


