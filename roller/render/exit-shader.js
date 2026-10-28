// render/exit-shader.js — the GLSL every die carries for its exit (render/exit-table.js): heat and
// charring, burning away along a noise with a glowing edge, and the cut where a pit's rim swallows it.
// Plain strings (no three.js): render/finishes.js puts them in the die's material, render/exits.js in
// the shadow's depth material, so a die burning away throws a shadow burning away with it.
//
// At rest every input is off (heat 0, dissolve 0, the clip far below the floor), and the work is
// behind a uniform branch, so a die that is not leaving costs nothing — and since the code is in
// every die's shader from the start, a die leaving never compiles a shader mid-game.

import { SHATTER, MELT } from './exit-table.js';

/** The clip height that clips nothing: far below any floor. */
export const EXIT_CLIP_OFF = -10;

/** Where on the die the burn's noise is read: its own pattern space, a little finer than its grain. */
const EXIT_NOISE = 'pFbm( ( vPatternPos * uScale + uSeed ) * 1.6 )';

// Melt's slump (2026-10-28), in the world: the die's height falls to EXIT_MELT_FLAT of itself while its foot spreads,
// the lower the further, over an uneven rim, about its centre on the floor (uExitMeltAt.xyz, its radius .w); then back to
// its own space (uExitMeltInverse: the world to its own space, as it lay). Its normals follow the squash, so the puddle's
// top looks up and its rim out. uExitWobble trembles it as it goes soft. Off at rest: behind a uniform branch.
export const EXIT_VERTEX_PARS = /* glsl */ `
varying float vExitWorldY;
varying vec2 vExitWorldXZ;
uniform float uExitMelt;
uniform float uExitWobble;
uniform vec4 uExitMeltAt;
uniform mat4 uExitMeltInverse;
uniform float uExitMeltSeed;
const float EXIT_MELT_FLAT = ${glslFloat(MELT.flat)};
const float EXIT_MELT_SPREAD = ${glslFloat(MELT.spread)};
const float EXIT_MELT_LUMP = ${glslFloat(MELT.lump)};
const float EXIT_MELT_TOP = ${glslFloat(MELT.top)};
const float EXIT_MELT_ROUND = ${glslFloat(MELT.round)};
const float EXIT_MELT_BULGE = ${glslFloat(MELT.bulge)};
const float EXIT_MELT_BLOB = ${glslFloat(MELT.blob)};
// How far it is squashed (its height's share) and spread (its width's) at a point rel from its centre on the floor.
vec2 exitMeltScale( vec3 rel ) {
  float h = clamp( rel.y / ( 2.0 * uExitMeltAt.w ), 0.0, 1.0 );   // 0 at the floor, 1 at its top
  float a = atan( rel.z, rel.x );
  float rim = 1.0 + EXIT_MELT_LUMP * ( 0.6 * sin( 3.0 * a + uExitMeltSeed ) + 0.4 * sin( 5.0 * a + 2.3 * uExitMeltSeed ) );
  float squash = ( 1.0 + uExitWobble ) * mix( 1.0, EXIT_MELT_FLAT, uExitMelt );
  float spread = inversesqrt( 1.0 + uExitWobble ) + uExitMelt * ( EXIT_MELT_SPREAD * ( 1.0 - h ) * ( 1.0 - h ) * rim - EXIT_MELT_TOP * h );
  return vec2( squash, spread );
}
// Where a point rel from its centre on the floor goes: squashed and spread, its foot pulled toward a round, lumpy
// puddle's outline and its sides bulging — melted rather than squashed.
vec3 exitMeltRel( vec3 rel ) {
  vec2 s = exitMeltScale( rel );
  float h = clamp( rel.y / ( 2.0 * uExitMeltAt.w ), 0.0, 1.0 );
  float r = length( rel.xz );
  vec2 dir = r > 1e-6 ? rel.xz / r : vec2( 0.0 );
  float a = atan( rel.z, rel.x );
  float rim = 1.0 + EXIT_MELT_LUMP * ( 0.6 * sin( 3.0 * a + uExitMeltSeed ) + 0.4 * sin( 5.0 * a + 2.3 * uExitMeltSeed ) );
  float reach = r * s.y;
  float puddle = uExitMeltAt.w * ( 1.0 + EXIT_MELT_SPREAD ) * rim * ( 1.0 - h );   // the round outline, for its foot
  reach = mix( reach, max( reach, puddle * min( r / ( 0.6 * uExitMeltAt.w ), 1.0 ) ), uExitMelt * EXIT_MELT_ROUND * ( 1.0 - h ) * ( 1.0 - h ) );
  reach += uExitMelt * EXIT_MELT_BULGE * uExitMeltAt.w * sin( 3.14159265 * h );
  return vec3( dir.x * reach, max( rel.y, 0.0 ) * s.x, dir.y * reach );
}
vec3 exitMelt( vec3 p ) {
  vec3 rel = exitMeltRel( ( modelMatrix * vec4( p, 1.0 ) ).xyz - uExitMeltAt.xyz );
  return ( uExitMeltInverse * vec4( uExitMeltAt.xyz + rel, 1.0 ) ).xyz;
}
vec3 exitMeltNormal( vec3 p, vec3 n ) {
  vec3 rel = ( modelMatrix * vec4( p, 1.0 ) ).xyz - uExitMeltAt.xyz;
  vec2 s = exitMeltScale( rel );
  mat3 turn = mat3( modelMatrix );   // a die is never scaled: its turn alone, whose transpose turns it back
  vec3 w = turn * n;
  w = normalize( vec3( w.x / s.y, w.y / s.x, w.z / s.y ) );
  // Blended toward a smooth blob's: the normal of a low dome over the puddle, at where the point has gone.
  vec3 q = exitMeltRel( rel );
  float wide = uExitMeltAt.w * ( 1.0 + 0.6 * EXIT_MELT_SPREAD ), high = max( 2.0 * uExitMeltAt.w * s.x, 1e-4 );
  vec3 blob = normalize( vec3( q.x / ( wide * wide ), q.y / ( high * high ), q.z / ( wide * wide ) ) );
  w = normalize( mix( w, blob, uExitMelt * EXIT_MELT_BLOB ) );
  return transpose( turn ) * w;
}
`;
export const EXIT_VERTEX = 'if ( uExitMelt > 0.0 || uExitWobble != 0.0 ) transformed = exitMelt( transformed );\n' +
  'vExitWorldY = ( modelMatrix * vec4( transformed, 1.0 ) ).y;\n' +
  'vExitWorldXZ = ( modelMatrix * vec4( transformed, 1.0 ) ).xz;';
/** The die's own normals bent with the slump (the shadow pass has none). */
export const EXIT_NORMAL = 'if ( uExitMelt > 0.0 || uExitWobble != 0.0 ) objectNormal = exitMeltNormal( position, objectNormal );';

/**
 * A number as a GLSL float literal: a whole number gets its decimal point, since GLSL ES refuses an int for a const
 * float — and a die whose shader fails to compile is not drawn at all (a groove depth of 0, tried 2026-10-27).
 */
export function glslFloat(x) {
  if (!Number.isFinite(x)) throw new Error('glslFloat: ' + x + ' is not a finite number');
  return Number.isInteger(x) ? x.toFixed(1) : String(x);
}

/** The most seeds a die's cracks are drawn from: the most pieces it breaks into. */
const SHATTER_SEEDS = SHATTER.pieces + SHATTER.spread;

export const EXIT_FRAGMENT_PARS = /* glsl */ `
uniform float uExitHeat;
uniform float uExitDissolve;
uniform float uExitClipY;
uniform float uExitUnder;
// Melt's puddle drying up from its rim inward (uExitDry 0 … 1), round its centre on the floor (uExitMeltAt).
uniform float uExitDry;
uniform vec4 uExitMeltAt;
uniform float uExitMeltSeed;
varying vec2 vExitWorldXZ;
const float EXIT_MELT_REACH = ${glslFloat(1 + MELT.spread + MELT.lump)};   // its rim's furthest, in radii
// Shatter's cracks (owner 2026-10-27): uExitCrack is how far they have spread (m) from uExitCrackFrom, along the
// boundaries between the cells of uExitSeeds (the die's own space, as render/fracture.js cuts it).
uniform float uExitCrack;
uniform vec3 uExitCrackFrom;
uniform vec3 uExitSeeds[ ${SHATTER_SEEDS} ];
uniform int uExitSeedCount;
varying float vExitWorldY;
float exitCrack = 0.0;
float exitCrackHeight = 0.0;   // the crack's groove, in metres below the surface (render/finishes.js bends the normals by it)
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
const float EXIT_CRACK_WIDTH = ${glslFloat(SHATTER.width)};
// A crack is the die's own colour at a shade of its value (owner 2026-10-27: "tint them, but to 90% of the die's
// value. That part should be subtle"; they were near-black at first).
const float EXIT_CRACK_SHADE = ${glslFloat(SHATTER.crackShade)};
// And carved (owner 2026-10-27: "they wont show up on a dark die... is it possible to apply it as a normal map in
// addition to the color mult?"): a groove, so its walls catch the light a dark die shows only in its highlights.
const float EXIT_CRACK_GROOVE = ${glslFloat(SHATTER.groove)};
const float EXIT_CRACK_DEPTH = ${glslFloat(SHATTER.grooveDepth)};
`;

/** After the die's colour (and its ink): the pit's cut and shade, then the burn. */
export const EXIT_SURFACE = /* glsl */ `
if ( vExitWorldY < uExitClipY ) discard;
if ( uExitDry > 0.0 ) {
  // The puddle dries from its rim inward, over an uneven edge, and the drying edge is darker.
  float exitFrom = length( vExitWorldXZ - uExitMeltAt.xz );
  float exitRim = uExitMeltAt.w * EXIT_MELT_REACH * ( 1.0 - uExitDry ) * ( 0.8 + 0.4 * pFbm( vec3( vExitWorldXZ * 400.0, uExitMeltSeed ) ) );
  if ( exitFrom > exitRim ) discard;
  diffuseColor.rgb *= mix( 1.0, 0.8, smoothstep( exitRim * 0.8, exitRim, exitFrom ) );
}
if ( uExitCrack > 0.0 ) {
  // The boundary between the two nearest cells: the distance to the plane halfway between their seeds.
  float exitD1 = 1e9, exitD2 = 1e9;
  vec3 exitS1 = vec3( 0.0 ), exitS2 = vec3( 0.0 );
  for ( int i = 0; i < ${SHATTER_SEEDS}; i++ ) {
    if ( i >= uExitSeedCount ) break;
    float d = distance( vPatternPos, uExitSeeds[ i ] );
    if ( d < exitD1 ) { exitD2 = exitD1; exitS2 = exitS1; exitD1 = d; exitS1 = uExitSeeds[ i ]; }
    else if ( d < exitD2 ) { exitD2 = d; exitS2 = uExitSeeds[ i ]; }
  }
  float exitEdge = abs( dot( vPatternPos - 0.5 * ( exitS1 + exitS2 ), normalize( exitS2 - exitS1 ) ) );
  // It runs out from where it began, thinning to nothing at its tip.
  float exitTip = uExitCrack - distance( vPatternPos, uExitCrackFrom );
  float exitTaper = clamp( exitTip / ( 8.0 * EXIT_CRACK_WIDTH ), 0.0, 1.0 );
  float exitW = EXIT_CRACK_WIDTH * exitTaper;
  exitCrack = ( 1.0 - smoothstep( exitW, exitW + fwidth( exitEdge ), exitEdge ) ) * step( 0.0, exitTip );
  diffuseColor.rgb *= mix( 1.0, EXIT_CRACK_SHADE, exitCrack );
  // The groove: deepest on the crack, rising to the surface either side, tapering with it to its tip (the max keeps
  // smoothstep's edges apart past the tip, where the taper is 0).
  exitCrackHeight = - EXIT_CRACK_DEPTH * exitTaper * ( 1.0 - smoothstep( 0.0, max( EXIT_CRACK_GROOVE * exitTaper, 1e-6 ), exitEdge ) );
}
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
uniform float uExitDry;
uniform vec4 uExitMeltAt;
uniform float uExitMeltSeed;
varying float vExitWorldY;
varying vec2 vExitWorldXZ;
float exitHash( vec2 p ) { return fract( sin( dot( p, vec2( 12.9898, 78.233 ) ) ) * 43758.5453 ); }
`;
export const EXIT_DEPTH = /* glsl */ `
if ( vExitWorldY < uExitClipY ) discard;
if ( exitHash( gl_FragCoord.xy ) > uExitFade ) discard;   // a fading die's shadow: a fine dither the blur smooths
if ( uExitDissolve > 0.0 && ${EXIT_NOISE} < uExitDissolve ) discard;
if ( uExitDry > 0.0 && length( vExitWorldXZ - uExitMeltAt.xz ) > uExitMeltAt.w * ${glslFloat(1 + MELT.spread + MELT.lump)} * ( 1.0 - uExitDry ) * ( 0.8 + 0.4 * pFbm( vec3( vExitWorldXZ * 400.0, uExitMeltSeed ) ) ) ) discard;
`;
