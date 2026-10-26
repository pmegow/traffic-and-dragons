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
  burn: { label: 'Burn out', seconds: 2.2 },
  smoke: { label: 'Smoke puff', seconds: 1.8 },
  pit: { label: 'Going down', seconds: 1.5 },
};

/** Seconds between dice leaving together (Clear), so they go one after another, not as one. */
export const EXIT_STAGGER = 0.06;

const clamp01 = (x) => Math.min(1, Math.max(0, x));
const smooth = (x) => { const t = clamp01(x); return t * t * (3 - 2 * t); };

/**
 * Burn out: the die heats from cold through dull red, orange and yellow to near white (heat, 0 … 1),
 * charring as it goes, then burns away along a noise with a glowing edge (dissolve: 0 whole … past 1
 * gone). Embers fly while it is hot, ash as it goes; both stop before the end so the last fade in
 * time. glow is the light it throws on the floor under it.
 */
export function burnTimeline(u) {
  const heat = smooth(u / 0.5);
  const dissolve = u < 0.38 ? 0 : 1.08 * smooth((u - 0.38) / 0.52);
  const flying = u < 0.85;
  return {
    heat,
    dissolve,
    embers: flying ? heat * (dissolve > 0 ? 1 : 0.35) : 0,
    ash: flying ? clamp01(dissolve * 1.5) : 0,
    glow: heat * Math.max(0, 1 - dissolve),
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
 * Going down: a hole opens under the die (hole: its radius as a share of the full, with a little
 * overshoot as it snaps open), the die drops through it (drop: metres below where it lay, for a die
 * of radius R) tipping as it falls (tilt, radians), and the hole closes once it has gone.
 */
export function pitTimeline(u, R) {
  const open = u < 0.2 ? easeOutBack(u / 0.2) : 1;
  const close = u > 0.82 ? 1 - smooth((u - 0.82) / 0.18) : 1;
  const fall = Math.max(0, (u - 0.18) / 0.52);
  return {
    hole: u >= 1 ? 0 : Math.max(0, open) * close,
    drop: 3 * R * fall * fall,
    tilt: 0.5 * smooth(fall),
  };
}

function easeOutBack(x) {
  const c = 1.7, t = clamp01(x) - 1;
  return 1 + (c + 1) * t * t * t + c * t * t;
}
