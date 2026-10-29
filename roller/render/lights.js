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
// Owner 2026-10-29: "Add a white light shining directly down on the board. The reason is to more
// intentionally light the top face. Increase the saturation of the other two lights so their color
// still reads. New light can be the same intensity as the warm light." The top light stands straight
// over the tray's centre (side 0, toward 0: no sideways or forward pull, so every top face takes it
// full on and the colours come from the sides alone). Its brightness is the warm light's: a white's
// luminance is 1, the warm colour's about 0.37, so the NUMBER is the warm intensity × that — the
// same number on a white light would be two and a half times as bright. The colours went up once
// more at the same hue: warm to full saturation (#ff8000, the only room it had), cool by a third to
// 90 % (#1a6aff), each intensity again raised to hold its brightness. The three numbers are the
// owner's to tweak by eye: `intensity` here, nothing else.

export const LIGHTS = [
  { name: 'warm', color: '#ff8000', intensity: 2.32, side: -1, up: 1.35, toward: 0.25 },
  { name: 'cool', color: '#1a6aff', intensity: 2.23, side: 1, up: 1.2, toward: -0.15 },
  { name: 'top', color: '#ffffff', intensity: 0.85, side: 0, up: 1.5, toward: 0 },
];
