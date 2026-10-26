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

export const EXIT_TABLE = {
  burn: { label: 'Burn out', seconds: 3.0 },   // 2.2 until the stain that fades last (art direction 2026-10-25)
  smoke: { label: 'Smoke puff', seconds: 1.8 },
  pit: { label: 'Going down', seconds: 0.75 },   // ends as the hole shuts behind the die (art direction 2026-10-25)
};

/** Seconds between dice leaving together (Clear), so they go one after another, not as one. */
export const EXIT_STAGGER = 0.06;

const clamp01 = (x) => Math.min(1, Math.max(0, x));
const smooth = (x) => { const t = clamp01(x); return t * t * (3 - 2 * t); };

/** Where in a burn the heat-up ends: full heat, yellow all over, and the burning away begins. */
export const BURN_HEATED = 0.4;

/**
 * Burn out: the die chars and heats, its glow spreading from the cracks until, at the last frame of the
 * heat-up (BURN_HEATED), it is yellow all over (heat, 0 … 1, never levelling off before then — art
 * direction 2026-10-25); then it burns away along a noise with a glowing edge (dissolve: 0 whole … past
 * 1 gone). Cinders fly while it is hot, ash as it goes; both stop before the end so the last fade in
 * time. glow is the light it throws on the floor; stain the char it leaves there, the last thing to fade.
 * Round 3 (2026-10-25): the heat-up is even and linear, red to yellow (no noise), and the embers wait
 * for yellow.
 */
export function burnTimeline(u) {
  const heat = clamp01(u / BURN_HEATED);   // linear: red to yellow at an even pace (round 3)
  const dissolve = u <= BURN_HEATED ? 0 : 1.08 * smooth((u - BURN_HEATED) / 0.33);
  const flying = u < 0.7;
  return {
    heat,
    dissolve,
    embers: flying && u > BURN_HEATED ? 1 : 0,   // only once it is yellow (round 3)
    ash: flying ? clamp01(dissolve * 1.5) : 0,
    glow: heat * Math.max(0, 1 - dissolve),
    stain: smooth(dissolve) * (1 - smooth((u - 0.75) / 0.25)),
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

/** Going down, in seconds: the hole opens — and closes — in `open`; the die falls 3.75 radii in `fall`. */
export const PIT = { open: 0.18, fall: 0.78 };

/**
 * Going down: a hole opens under the die (hole: its radius as a share of the full), the die drops
 * through it from the first moment (drop: metres below where it lay, for a die of radius R whose centre
 * lay `rise` above the floor) tipping as it falls (tilt, radians), and the hole closes behind it the
 * moment its highest point passes the floor (clear, seconds), the opening run backwards. Art direction
 * 2026-10-25: round 1, the hole opens quicker (0.18 s, was 0.3), the die no longer waits for it and
 * falls a quarter faster; round 2, no overshoot as it opens (it eased out past full and back), and it
 * closes as soon as the die is through, as fast as it opened (it stood open, empty, for 0.6 s).
 */
export function pitTimeline(u, R, rise = R) {
  const t = u * EXIT_TABLE.pit.seconds;
  const clear = PIT.fall * Math.sqrt((rise + R) / (3.75 * R));   // drop = rise + R: its top is through the floor
  const opening = easeOutCubic(t / PIT.open);
  const closing = t <= clear ? 1 : easeOutCubic(1 - (t - clear) / PIT.open);
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
