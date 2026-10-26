// render/exit-table.js — THE exit registry as data, and each exit's timeline (no three.js, so node
// tests it). render/exits.js turns an entry into the effect that plays it.
//
// An exit is how a die leaves the table when it is taken off (owner 2026-10-25: "exit animations/
// effects for the dice when they disappear ... a puff of smoke with faerie fire, or heating up and
// turning to ash, or a hole opening up in the ground and then falling into it"; the menu names are
// the owner's). One entry per exit, all the same shape:
//
//   label     what the menu shows
//   seconds   how long the effect plays, in real time (not the roll's slowed pace)
//
// A timeline maps the effect's progress u (0 … 1) to the numbers that drive it, so the shape of an
// effect is tested here and only drawn in exits.js. Every number is plain data: art direction
// changes these, not the drawing code.

/**
 * Burn out, in seconds (round 5): the heat rises red to yellow over `heat`, then the die fades off over
 * `fade` ("fade off the yellow instead of eroding it away"); the stain it leaves holds 0.3 s and fades over
 * `stainFade`, last of all. The fade starts `hold` after full heat less `early`, and the cinders and
 * smoke `early` before full heat — round 10: "start the fade out and particles 4 frames sooner. It should
 * feel that as soon as it hits the yellow color, it's too much, it gets unstable and dematerializes"; from
 * the particles' start until it has gone it is unstable.
 */
export const BURN = { heat: 1.2, hold: 0.1, early: 4 / 24, fade: 0.5, stainFade: 0.7 };

/**
 * Scurry off, in seconds: legs grow, the body lifts, a beat while it wonders (round 8), it runs; it
 * stands `ride` radii up. During the beat it looks `look` radians one way and the other — pausing at
 * each, then holding at centre (round 9; the beat 1.0 s, was 0.6) — taps a front foot up `tap` of a
 * step's lift in each pause, and crouches `crouch` of its height before it bolts, leaning `lean` into
 * its run.
 */
export const SCURRY = {
  // Round 10: the look is off for now ("skip the look left and look right. We may revisit later": 0.3 brings
  // it back, with the beat at 1.0 s) and the beat is short again.
  // Round 11: the legs grow one after another over `grow` (was 0.225 s, all eight at once to the eye).
  grow: 0.7, lift: 0.25, wonder: 0.5, run: 1.65 / 1.5, ride: 0.9, look: 0, tap: 0.8, crouch: 0.3,
  // Round 9: where in the beat (shares of it) it holds its look — left, right, then at centre — and how
  // far it leans into its run (radians, the body tipping forward along its heading).
  pauses: [[0.1, 0.26], [0.38, 0.54], [0.66, 0.84]],
  lean: 0.26,
};

export const EXIT_TABLE = {
  none: { label: 'None', seconds: 0 },          // at once (round 4: "put none at the top of the list")
  burn: { label: 'Burn out', seconds: BURN.heat + BURN.hold - BURN.early + BURN.fade + 0.3 + BURN.stainFade },   // 2.6 s
  smoke: { label: 'Smoke puff', seconds: 1.8 },
  pit: { label: 'Going down', seconds: 0.75 },   // ends as the hole shuts behind the die (art direction 2026-10-25)
  fade: { label: 'Fade', seconds: 1.2 },          // round 5: "slow it down 100%" (was 0.6)
  scurry: { label: 'Scurry off', seconds: SCURRY.grow + SCURRY.lift + SCURRY.wonder + SCURRY.run },   // 2.55 s
};

/** Seconds between dice leaving together (Clear), so they go one after another, not as one. */
export const EXIT_STAGGER = 0.06;

const clamp01 = (x) => Math.min(1, Math.max(0, x));
const smooth = (x) => { const t = clamp01(x); return t * t * (3 - 2 * t); };

/** Where in a burn (a share of it) the heat-up ends: full heat, yellow all over. */
export const BURN_HEATED = BURN.heat / EXIT_TABLE.burn.seconds;

/**
 * Burn out: the die chars and heats, its glow spreading from the cracks until, at the last frame of the
 * heat-up (BURN_HEATED), it is yellow all over (heat, 0 … 1, never levelling off before then — art
 * direction 2026-10-25); then it burns away along a noise with a glowing edge (dissolve: 0 whole … past
 * 1 gone). Cinders fly while it is hot, smoke rises as it goes; both stop before the end so the last fade in
 * time. glow is the light it throws on the floor; stain the char it leaves there, the last thing to fade.
 * Round 3 (2026-10-25): the heat-up is even and linear, red to yellow (no noise), and the embers wait
 * for yellow. Round 5: yellow holds a moment, then the die fades off (opacity) instead of burning away
 * along the noise; the timing is BURN's, in seconds.
 */
export function burnTimeline(u) {
  const secs = EXIT_TABLE.burn.seconds, t = u * secs;
  const heat = clamp01(t / BURN.heat);   // linear: red to yellow at an even pace (round 3)
  const fadeFrom = BURN.heat + BURN.hold - BURN.early, gone = fadeFrom + BURN.fade, flying = BURN.heat - BURN.early;
  const opacity = 1 - smooth((t - fadeFrom) / BURN.fade);   // round 5: it fades off, no longer erodes
  const burning = t > flying && t < gone;
  return {
    heat,
    opacity,
    embers: burning ? 1 : 0,   // only as it reaches yellow (rounds 3, 10), until it has gone
    smoke: burning ? 1 : 0,    // the Smoke puff's smoke, where the ash was (round 4)
    unstable: burning ? smooth((t - flying) / 0.1) : 0,   // round 10: too much — it shakes and flickers as it goes
    glow: heat * opacity,
    stain: smooth((t - fadeFrom) / BURN.fade) * (1 - smooth((t - (secs - BURN.stainFade)) / BURN.stainFade)),
  };
}

/**
 * Smoke puff: the die swells a little and blinks out (scale) inside a puff that bursts on the first
 * frame (burst), rising a little as it goes (lift, in die radii); faerie fire trickles out for the
 * first part (sparks: an emission rate, 0 … 1) and drifts up after.
 */
export function smokeTimeline(u) {
  const scale = u < 0.04 ? 1 + 0.08 * (u / 0.04) : 1.08 * (1 - smooth((u - 0.04) / 0.18));
  return {
    scale: u >= 0.22 ? 0 : scale,
    lift: 0.5 * clamp01(u / 0.22),
    burst: u < 0.05,
    sparks: u < 0.4 ? 1 - u / 0.4 : 0,
  };
}

/**
 * Going down, in seconds: the hole opens in `open` and closes in `close` (80% of the opening's speed),
 * starting `early` before the die's top is through (two frames at 24 fps — round 4); the die falls 3.75
 * radii in `fall`.
 */
export const PIT = { open: 0.18, close: 0.18 / 0.8, early: 2 / 24, fall: 0.78 };

/**
 * Going down: a hole opens under the die (hole: its radius as a share of the full), the die drops
 * through it from the first moment (drop: metres below where it lay, for a die of radius R whose centre
 * lay `rise` above the floor) tipping as it falls (tilt, radians), and the hole closes behind it the
 * moment its highest point passes the floor (clear, seconds), the opening run backwards. Art direction
 * 2026-10-25: round 1, the hole opens quicker (0.18 s, was 0.3), the die no longer waits for it and
 * falls a quarter faster; round 2, no overshoot as it opens (it eased out past full and back), and it
 * closes as soon as the die is through, as fast as it opened (it stood open, empty, for 0.6 s); round 4,
 * it starts closing two frames (at 24 fps) before the die's top is through, and closes 20% slower.
 */
export function pitTimeline(u, R, rise = R) {
  const t = u * EXIT_TABLE.pit.seconds;
  const clear = PIT.fall * Math.sqrt((rise + R) / (3.75 * R));   // drop = rise + R: its top is through the floor
  const opening = easeOutCubic(t / PIT.open);
  const shut = clear - PIT.early;
  const closing = t <= shut ? 1 : easeOutCubic(1 - (t - shut) / PIT.close);
  const fall = t / PIT.fall;
  return {
    hole: Math.min(opening, closing),
    drop: 3.75 * R * fall * fall,
    tilt: 0.5 * smooth(fall),
    clear,
  };
}

/** Fast at first, settling into place, never past it. */
function easeOutCubic(x) {
  const t = 1 - clamp01(x);
  return 1 - t * t * t;
}

/** Fade: the die fades out (opacity 1 … 0), its shadow with it. */
export function fadeTimeline(u) {
  return { opacity: 1 - smooth(u) };
}

/**
 * Scurry off (round 4: "make the dice grow spider legs and scurry out of frame"), in seconds: eight legs
 * grow out of the die over `grow` while it stays where it lay (legs: 0 … 1); then, the feet planted, it
 * lifts `ride` radii over `lift` (ride: metres); then it runs for the nearest edge of the screen over
 * `run`, gathering speed (travel: the share of the way out of frame, 0 … 1, reached at the end). Round 6:
 * "grow out of the body, with the die in place. then once the legs are grown, lift the body up and scurry
 * off" (it rose as they grew). Round 5 made the run half again as fast (1.1 s, was 1.65) and the stance
 * taller (0.9 radii, was 0.6).
 */
export function scurryTimeline(u, R) {
  const t = u * EXIT_TABLE.scurry.seconds;
  const legs = clamp01(t / SCURRY.grow);   // evenly (round 11): each leg eases on its own (legGrown)
  const lifted = smooth((t - SCURRY.grow) / SCURRY.lift);
  // Round 8, the beat: it has just woken to itself — it looks one way, then the other, taps one front foot
  // then the other, and as it realizes, crouches and bolts.
  const w = (t - SCURRY.grow - SCURRY.lift) / SCURRY.wonder;
  const [left, right, centre] = SCURRY.pauses;
  const look = w <= 0 || w >= 1 ? 0 : SCURRY.look * lookAbout(w);
  const tap = [bump(w, left[0], left[1]), bump(w, right[0], right[1])];   // a front foot taps in each pause
  const crouch = SCURRY.crouch * bump(w, centre[1], 1);
  const runFrom = (SCURRY.grow + SCURRY.lift + SCURRY.wonder) / EXIT_TABLE.scurry.seconds;   // a share, so the end lands on 1 exactly
  const x = clamp01((u - runFrom) / (1 - runFrom));
  return { legs, ride: SCURRY.ride * R * (lifted - crouch), travel: Math.pow(x, 1.3), look, tap, lean: SCURRY.lean * smooth(x / 0.15) };
}

/**
 * A look about, over the beat (0 … 1), in shares of SCURRY.look: it turns to one side and pauses, turns
 * across to the other and pauses, turns back to the front and holds there (round 9: the first look
 * swept without a stop).
 */
function lookAbout(w) {
  const [left, right, centre] = SCURRY.pauses;
  if (w < left[0]) return -smooth(w / left[0]);
  if (w <= left[1]) return -1;
  if (w < right[0]) return -1 + 2 * smooth((w - left[1]) / (right[0] - left[1]));
  if (w <= right[1]) return 1;
  if (w < centre[0]) return 1 - smooth((w - right[1]) / (centre[0] - right[1]));
  return 0;
}

/** 0 outside a … b, rising to 1 and back across it. */
function bump(w, a, b) {
  return w > a && w < b ? Math.sin(Math.PI * (w - a) / (b - a)) : 0;
}

/**
 * When each leg grows (round 8: "vary that up a little. +-20% growth rate"; round 11: "legs still seem to
 * grow simultaneously, need to increase the variation in speed and start time"): a rate 1 ± `rate`, a leg
 * taking `leg` seconds to draw out at rate 1 (less when faster). The legs take shuffled turns, each its own
 * slot of the starts and its own slot of the speeds, jittered within it — so every die's legs come one after
 * another across the growing time, fast and slow, never bunched by chance. start and duration are shares of
 * the growing time; the slowest leg starting last still finishes in it.
 */
export const SPROUT = { leg: 0.6 * 0.45 / 2, rate: 0.4 };

export function sproutSchedule(count, random = Math.random) {
  const shuffled = () => {
    const a = Array.from({ length: count }, (_, i) => i);
    for (let i = count - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  };
  const speedSlot = shuffled(), startSlot = shuffled();
  const longest = SPROUT.leg / SCURRY.grow / (1 - SPROUT.rate);
  return Array.from({ length: count }, (_, i) => {
    const rate = 1 + SPROUT.rate * (2 * (speedSlot[i] + random()) / count - 1);
    return { rate, duration: SPROUT.leg / SCURRY.grow / rate, start: (startSlot[i] + random()) / count * (1 - longest) };
  });
}

/** How far one leg has grown (0 … 1) when the legs as a whole are `legs` of the way grown: easing out of the body. */
export function legGrown(legs, sprout) {
  return smooth((legs - sprout.start) / sprout.duration);
}

/**
 * How far its heading has wandered (radians) after running s metres (round 8: "noise in their path so
 * they change directions slightly as they go"): two slow waves, wavelengths `wave` die radii, set off at
 * `phase`, from 0 at the start — so it sets off straight for the edge and never turns from it far.
 */
export const WANDER = { amp: [0.2, 0.08], wave: [9, 3.5] };

export function scurryWander(s, R, phase) {
  let h = 0;
  for (let k = 0; k < 2; k++) h += WANDER.amp[k] * (Math.sin(2 * Math.PI * s / (WANDER.wave[k] * R) + phase[k]) - Math.sin(phase[k]));
  return h;
}
