// render/lights.js — THE lights, as data (no three.js, so node tests them).
//
// Placed relative to the CAMERA (side −1 = the screen's left), so a phone held upright keeps warm on
// the left and cool on the right. Owner 2026-10-24: the first rig was much too bright; a gentle warm
// light from the left and a gentle cool light from the right instead. Both cast soft shadows, so on a
// drawn tray each die's shadow on one side is filled by the other light's colour (the no-tray shadow
// catcher can only darken, so its shadows carry no colour). They stand high (about 55–60°): lower,
// the tray's rim shadowed all but a strip of the floor.
//   up / toward: height and pull toward the camera, relative to the light's sideways distance
//
// Owner 2026-10-24: "double the saturation of those lights' colors". Each colour's HSV saturation was
// doubled at the same hue (warm #ffc58a → #ff8b15, cool #a9c7ff → #538fff), and each intensity raised
// so the light is as bright as before (a more saturated colour carries less luminance): the light
// colour changes, not the scene's brightness.
//
// Owner 2026-10-29: "Increase the saturation of the other two lights so their color still reads" —
// the colours went up once more at the same hue: warm to full saturation (#ff8000, the only room it
// had), cool by a third to 90 % (#1a6aff), each intensity again raised to hold its brightness. A
// white light straight down on the tray (v0.64.0, to light the top face on purpose) came and went
// the same day: a straight-down light does nothing for a flat metal face seen from the camera (only
// a light at the camera's mirror position across the tray does), and once the metal finish carried a
// little diffuse the top face read without it — "We don't need the straight down light anymore".
// The two `intensity` numbers are the owner's to tweak by eye.

export const LIGHTS = [
  { name: 'warm', color: '#ff8000', intensity: 2.32, side: -1, up: 1.35, toward: 0.25 },
  { name: 'cool', color: '#1a6aff', intensity: 2.23, side: 1, up: 1.2, toward: -0.15 },
];
