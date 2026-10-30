// src/materials.js — what the dice are made of and what they land on.
//
// Two registries, one shape each. A contact between two materials combines their coefficients
// through combine() — the only place a rule for mixing them lives.
//
//   friction     Coulomb coefficient (dimensionless)
//   restitution  bounce: the fraction of approach speed returned (0 = dead, 1 = perfect)
//   rolling      rolling resistance, as a lever arm in metres: the torque opposing a roll is at
//                most rolling × normal force (soft surfaces like felt are high, hard ones low)
//   spinning     the same for spin about the contact normal

/** Die materials. Density in kg/m³. */
export const DIE_MATERIALS = {
  resin: { density: 1200, friction: 0.45, restitution: 0.6, rolling: 0.00005, spinning: 0.00005 },
  metal: { density: 7800, friction: 0.35, restitution: 0.4, rolling: 0.00002, spinning: 0.00002 },
  wood: { density: 700, friction: 0.55, restitution: 0.45, rolling: 0.00005, spinning: 0.00005 },
};

/** Tray surfaces: the floor as it is, the walls and the ceiling as boundary(surface). */
export const SURFACES = {
  felt: { friction: 0.9, restitution: 0.35, rolling: 0.0004, spinning: 0.0003 },
  wood: { friction: 0.5, restitution: 0.65, rolling: 0.00008, spinning: 0.00008 },
  stone: { friction: 0.6, restitution: 0.75, rolling: 0.00003, spinning: 0.00003 },
};

/** The coefficients of one contact between materials a and b. */
export function combine(a, b) {
  return {
    friction: Math.sqrt(a.friction * b.friction),
    restitution: a.restitution * b.restitution,
    rolling: Math.max(a.rolling, b.rolling),
    spinning: Math.max(a.spinning, b.spinning),
  };
}

/**
 * A boundary made of `surface` — a tray's walls, the screen's edges, the ceiling, the hand's cup sides — with NO GRIP
 * (owner 2026-10-30: "If there's any friction values for the boundaries, set it to 0 so dice just slip off it"): it
 * bounces as its surface does, but a die meeting it is pushed only along its normal, so a die leaning on a wall slides
 * down it and a spinning die is not turned into a push along it. Its own rolling and spin resistance are none too (a
 * contact keeps the die's own, combine()). The floors keep their grip: it stops a die, and the hand drags with it.
 */
export function boundary(surface) {
  return { ...surface, friction: 0, rolling: 0, spinning: 0 };
}

/** A registry lookup that names the registry and its keys when the key is missing. */
export function lookup(registry, name, what) {
  const entry = registry[name];
  if (!entry) throw new Error('unknown ' + what + ' "' + name + '" (known: ' + Object.keys(registry).join(', ') + ')');
  return entry;
}
