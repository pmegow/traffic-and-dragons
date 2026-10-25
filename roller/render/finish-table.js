// render/finish-table.js — THE finish registry as data (no three.js, so node tests it).
// One entry per finish, all the same shape; render/finishes.js turns an entry into a material.
//
//   label         what the menu shows
//   pattern       a render/patterns.js PATTERNS key (plain, marble, granite) — computed in the shader
//   roughness, clearcoat, clearcoatRoughness: the surface (0 polished … 1 matte). Both shiny layers
//                 (the base reflection and the clear coat) are scaled by SPECULAR when the material
//                 is made.
//   transmission  0 opaque … 1 glass; a see-through finish also gives thickness (m), ior and
//                 attenuationDistance (m: how far light travels before the body colour has tinted it)
//   doubleSided   render the far faces too, so they show through
//   envMapIntensity  how strongly the room reflects in it (glass reads as glass by its reflections)
//   mica          mica flakes in a granite: share (of the crystals, picked at random) and boost (how much
//                 more specular they have than the rest: 2 = +200 %)
//   scatter       a faked subsurface scatter (render/finishes.js): light that enters the die and comes
//                 out again, tinted by the body — glow (light from behind, unshadowed), distortion and
//                 power (how the glow spreads round the die), ambient (a little everywhere), bleed
//                 (the scene's average colour, scattered out) and trayBleed (the same on a drawn tray)

/** Owner 2026-10-24: the specular was too intense on every material — cut by 75 %. */
export const SPECULAR = 0.25;

/**
 * The depth pull every see-through die is drawn with (glPolygonOffset: factor, units). A die at rest
 * lies with its bottom face exactly on the tray floor (within 0.004 mm), and three.js draws a
 * see-through die's far faces into its transmission buffer AFTER the floor — so the floor's depth
 * hid the bottom face and its numeral the moment the die settled, and the numbers seen through the
 * glass popped off (owner 2026-10-24). A constant pull of a few depth units wins that tie and
 * nothing else; a slope factor also pulled one die through another where they touch, so it is 0.
 * Measured 2026-10-24: units -8 renders the settled tray exactly as with the floor's depth off.
 */
export const SEE_THROUGH_DEPTH_OFFSET = { factor: 0, units: -8 };

export const FINISHES = {
  none: { label: 'None', pattern: 'plain', roughness: 0.34, clearcoat: 0.55, clearcoatRoughness: 0.22, transmission: 0 },
  marble: { label: 'Marble', pattern: 'marble', roughness: 0.16, clearcoat: 0.85, clearcoatRoughness: 0.08, transmission: 0 },
  // Mica flakes (owner 2026-10-24: "the look I'm going for is mica flakes in the granite"). First a
  // quarter of the specks at +50 %, which barely showed; +500 % was too much in motion; tuned to 10 %
  // of the specks at +200 %.
  granite: { label: 'Granite', pattern: 'granite', roughness: 0.42, clearcoat: 0.5, clearcoatRoughness: 0.2, transmission: 0, mica: { share: 0.1, boost: 2 } },
  // Glass: the body colour tints the light through the die once (the surface colour), absorption
  // only lightly on top — tinting twice turned a red die nearly black (2026-10-24).
  glass: { label: 'Glass', pattern: 'plain', roughness: 0.02, clearcoat: 0.6, clearcoatRoughness: 0.02, transmission: 1, thickness: 0.016, ior: 1.52, attenuationDistance: 0.12, doubleSided: true, envMapIntensity: 2.4 },
  // Quartz (named by the owner 2026-10-24; first called 'translucent'): most light passes through,
  // a little blurred, so the far side's numerals show faintly through the die — the tell of real
  // translucent dice (milkier settings looked plain).
  quartz: { label: 'Quartz', pattern: 'plain', roughness: 0.3, clearcoat: 0.5, clearcoatRoughness: 0.15, transmission: 0.78, thickness: 0.02, ior: 1.5, attenuationDistance: 0.05, doubleSided: true, envMapIntensity: 1.8,
    // trayBleed: the scene average takes in the dark room round a tray as well as its floor, so once
    // the bleed read a true average (v0.16.1) quartz on a tray came out darker than it had looked;
    // 1.5× brings stone, felt and wood back within 4 % of their earlier typical roll (owner
    // 2026-10-24: "go ahead and brighten it"). With no tray the average is as before.
    scatter: { glow: 1.0, distortion: 0.3, power: 2.5, ambient: 0.04, bleed: 1.5, trayBleed: 2.25 } },
};
