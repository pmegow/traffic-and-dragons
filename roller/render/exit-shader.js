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
uniform float uExitUnder;
varying float vExitWorldY;
vec3 exitGlow = vec3( 0.0 );
vec3 exitUnderGlow = vec3( 0.0 );
float exitChar = 0.0;
float exitShade = 1.0;
// The heat's glow: red to yellow, straight across (art direction 2026-10-25, round 3), at a brightness that
// glows without washing out — a deep yellow, since the tone mapping whitens a pale one.
const vec3 EXIT_RED = vec3( 0.55, 0.02, 0.0 );
const vec3 EXIT_YELLOW = vec3( 1.0, 0.7, 0.08 );
const float EXIT_GLOW = 1.1;
// Going down's glow from the pit (rounds 14, 16): its light on the die from below, orange, strongest at the rim
// and gone EXIT_UNDER_REACH (m) above it, more on the faces turned down to it.
const vec3 EXIT_HELL = vec3( 2.0, 0.8, 0.1 );
const float EXIT_UNDER_REACH = 0.025;
`;

/** After the die's colour (and its ink): the pit's cut and shade, then the burn. */
export const EXIT_SURFACE = /* glsl */ `
if ( vExitWorldY < uExitClipY ) discard;
exitShade = smoothstep( uExitClipY, uExitClipY + 0.01, vExitWorldY );   // dark just above a pit's rim
if ( uExitUnder > 0.0 ) {
  float exitLow = 1.0 - smoothstep( uExitClipY, uExitClipY + EXIT_UNDER_REACH, vExitWorldY );
  exitUnderGlow = EXIT_HELL * uExitUnder * exitLow;
}
if ( uExitHeat > 0.0 || uExitDissolve > 0.0 ) {
  float exitN = ${EXIT_NOISE};
  float exitEdge = exitN - uExitDissolve;
  if ( uExitDissolve > 0.0 && exitEdge < 0.0 ) discard;
  // It chars as it heats, so its own colour does not tint the glow, and glows evenly all over, red to
  // yellow (round 3: the glow first rose in the noise's cracks). The noise is for burning through.
  exitChar = smoothstep( 0.1, 0.55, uExitHeat );
  diffuseColor.rgb = mix( diffuseColor.rgb, vec3( 0.012, 0.010, 0.009 ), exitChar );
  exitGlow = mix( EXIT_RED, EXIT_YELLOW, uExitHeat ) * uExitHeat * EXIT_GLOW;
  if ( uExitDissolve > 0.0 ) exitGlow += vec3( 1.0, 0.5, 0.05 ) * ( 1.0 - smoothstep( 0.0, 0.04, exitEdge ) ) * 3.0;
}
`;

export const EXIT_EMISSIVE = 'totalEmissiveRadiance += exitGlow;';
// The pit's light is added after the shade: the rim side goes dark in its own colour and glows orange.
export const EXIT_OUTGOING = 'outgoingLight *= exitShade;\n' +
  'if ( uExitUnder > 0.0 ) outgoingLight += exitUnderGlow * ( 0.35 + 0.65 * max( 0.0, -inverseTransformDirection( normal, viewMatrix ).y ) );';

/** The shadow's depth pass: the same cut, the same burn-through and the same fade, nothing else. */
export const EXIT_DEPTH_PARS = /* glsl */ `
uniform float uExitDissolve;
uniform float uExitClipY;
uniform float uExitFade;
varying float vExitWorldY;
float exitHash( vec2 p ) { return fract( sin( dot( p, vec2( 12.9898, 78.233 ) ) ) * 43758.5453 ); }
`;
export const EXIT_DEPTH = /* glsl */ `
if ( vExitWorldY < uExitClipY ) discard;
if ( exitHash( gl_FragCoord.xy ) > uExitFade ) discard;   // a fading die's shadow: a fine dither the blur smooths
if ( uExitDissolve > 0.0 && ${EXIT_NOISE} < uExitDissolve ) discard;
`;
