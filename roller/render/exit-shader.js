// render/exit-shader.js — the GLSL every die carries for its exit (render/exit-table.js): heat and
// charring, burning away along a noise with a glowing edge, and the cut where a pit's rim swallows it.
// Plain strings (no three.js): render/finishes.js puts them in the die's material, render/exits.js in
// the shadow's depth material, so a die burning away throws a shadow burning away with it.
//
// At rest every input is off (heat 0, dissolve 0, the clip far below the floor), and the work is
// behind a uniform branch, so a die that is not leaving costs nothing — and since the code is in
// every die's shader from the start, a die leaving never compiles a shader mid-game.

/** The clip height that clips nothing: far below any floor. */
export const EXIT_CLIP_OFF = -10;

/** Where on the die the burn's noise is read: its own pattern space, a little finer than its grain. */
const EXIT_NOISE = 'pFbm( ( vPatternPos * uScale + uSeed ) * 1.6 )';

export const EXIT_VERTEX_PARS = 'varying float vExitWorldY;';
export const EXIT_VERTEX = 'vExitWorldY = ( modelMatrix * vec4( transformed, 1.0 ) ).y;';

export const EXIT_FRAGMENT_PARS = /* glsl */ `
uniform float uExitHeat;
uniform float uExitDissolve;
uniform float uExitClipY;
varying float vExitWorldY;
vec3 exitGlow = vec3( 0.0 );
float exitChar = 0.0;
float exitShade = 1.0;
// Black body, roughly: dull red, orange, yellow, near white.
vec3 exitHeatColour( float h ) {
  vec3 c = mix( vec3( 0.0 ), vec3( 0.55, 0.02, 0.0 ), smoothstep( 0.0, 0.3, h ) );
  c = mix( c, vec3( 1.0, 0.32, 0.02 ), smoothstep( 0.3, 0.6, h ) );
  c = mix( c, vec3( 1.0, 0.7, 0.08 ), smoothstep( 0.6, 0.85, h ) );   // a deep yellow: the tone mapping whitens a pale one
  return mix( c, vec3( 1.0, 0.93, 0.75 ), smoothstep( 0.85, 1.0, h ) );
}
`;

/** After the die's colour (and its ink): the pit's cut and shade, then the burn. */
export const EXIT_SURFACE = /* glsl */ `
if ( vExitWorldY < uExitClipY ) discard;
exitShade = smoothstep( uExitClipY, uExitClipY + 0.01, vExitWorldY );   // dark just above a pit's rim
if ( uExitHeat > 0.0 || uExitDissolve > 0.0 ) {
  float exitN = ${EXIT_NOISE};
  float exitEdge = exitN - uExitDissolve;
  if ( uExitDissolve > 0.0 && exitEdge < 0.0 ) discard;
  // It chars black first; the heat glows in its cracks (the noise's low valleys, where it will burn
  // through first), never whiter than yellow, with only a dull ember everywhere else until it spreads.
  exitChar = smoothstep( 0.1, 0.55, uExitHeat );
  diffuseColor.rgb = mix( diffuseColor.rgb, vec3( 0.012, 0.010, 0.009 ), exitChar );
  // The glow starts in the cracks and spreads as it heats (art direction 2026-10-25): at full heat it
  // reaches past every value of the noise, and the die is yellow all over.
  float exitReach = mix( 0.42, 1.1, smoothstep( 0.45, 1.0, uExitHeat ) );
  float exitCracks = 1.0 - smoothstep( exitReach - 0.09, exitReach, exitN );
  exitGlow = exitHeatColour( 0.85 * uExitHeat ) * uExitHeat * ( 0.06 + 1.4 * exitCracks ) * 0.75;   // bright enough to glow, not to wash out
  if ( uExitDissolve > 0.0 ) exitGlow += vec3( 1.0, 0.5, 0.05 ) * ( 1.0 - smoothstep( 0.0, 0.04, exitEdge ) ) * 3.0;
}
`;

export const EXIT_EMISSIVE = 'totalEmissiveRadiance += exitGlow;';
export const EXIT_OUTGOING = 'outgoingLight *= exitShade;';

/** The shadow's depth pass: the same cut and the same burn-through, nothing else. */
export const EXIT_DEPTH_PARS = /* glsl */ `
uniform float uExitDissolve;
uniform float uExitClipY;
varying float vExitWorldY;
`;
export const EXIT_DEPTH = /* glsl */ `
if ( vExitWorldY < uExitClipY ) discard;
if ( uExitDissolve > 0.0 && ${EXIT_NOISE} < uExitDissolve ) discard;
`;
