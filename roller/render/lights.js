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
// Owner 2026-10-24: "double the saturation of those lights' colors". Each colour's HSV saturation is
// doubled at the same hue (warm #ffc58a → #ff8b15, cool #a9c7ff → #538fff), and each intensity raised
// so the light is as bright as before (a more saturated colour carries less luminance): the light
// colour changes, not the scene's brightness.

export const LIGHTS = [
  { name: 'warm', color: '#ff8b15', intensity: 2.14, side: -1, up: 1.35, toward: 0.25 },
  { name: 'cool', color: '#538fff', intensity: 1.38, side: 1, up: 1.2, toward: -0.15 },
];
