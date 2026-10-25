// render/view-defaults.js — DiceView's defaults as data (no three.js, so node tests them and the
// toy reads its opening controls from them: one source of truth for how a view starts).

export const VIEW_DEFAULTS = {
  transparent: false,
  // A partial TRAY_DEFAULTS (src/roll.js), merged over by a host's own tray option. The view opens on
  // stone at half size (owner 2026-10-24: "make these the defaults"); the core's own roll() default
  // stays felt at 0.6, so a headless roll's physics are unchanged.
  tray: { surface: 'stone', walls: 'stone', scale: 0.5 },
  // finish: a FINISHES key; font: a NUMERAL_FONTS key. Owner 2026-10-24: violet glass, white sans numerals.
  dieStyle: { body: '#8a49a2', ink: '#ffffff', finish: 'glass', font: 'sans' },
  dimOthers: 0.82,                           // by the end, the faces not showing the result have darkened to this (1 = off)
  speed: 1,                                  // playback speed, a multiplier of pace
  pace: 0.3,                                 // 1× plays at 0.3 of real time: 2 cm dice at full speed are too quick to follow
                                             // (owner 2026-10-24: first half speed, then 0.6 of that made the new 1×)
  environment: 0.36,                         // the room reflection's strength (the lights carry the scene)
  tilt: 55,                                  // camera elevation in degrees (90 = straight down)
  // How low and how high view.orbit() may take the camera (degrees; straight down, 90, would leave it
  // no 'up'), and how near and far view.zoom() may take it, as a multiple of the distance that fits the tray.
  // minHeight (m): the camera never comes lower than this above the floor, so zooming in at a low
  // angle cannot put it level with the dice (about 2 cm tall).
  orbit: { minPitch: 15, maxPitch: 88, minZoom: 0.35, maxZoom: 2.5, minHeight: 0.04 },
  resetSeconds: 0.35,                        // how long view.resetCamera() takes to ease the camera home
  pixelRatio: Math.min(globalThis.devicePixelRatio || 1, 2),
  // Soft shadows (owner 2026-10-25: "a little intense ... blur them" if it costs little). three.js's PCF
  // takes 5 filtered samples whatever the radius, so the blur is free; a 1024 map at radius 12 is
  // twice 2048-at-6's softness in texels and four times wider on the floor, with a quarter of the
  // shadow pixels to draw — cheaper on a phone, not dearer. No grain at 3× magnification.
  shadowMapSize: 1024,
  shadowRadius: 12,   // texels of PCF blur
};

/**
 * A view's options: the defaults with a host's options over them. A default that is an object (the
 * tray, the die style, the orbit limits) is merged key by key, so a host that sets one key keeps
 * the rest — a host's tray { width, depth } still rolls on the default stone.
 */
export function viewOptions(options = {}) {
  const o = { ...VIEW_DEFAULTS, ...options };
  for (const [k, d] of Object.entries(VIEW_DEFAULTS)) {
    if (d && typeof d === 'object') o[k] = { ...d, ...(options[k] || {}) };
  }
  return o;
}
