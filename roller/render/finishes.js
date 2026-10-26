// render/finishes.js — the material of a die, from its finish (render/finish-table.js).
//
// dieMaterial(finish, style, glyph, seed) builds a MeshPhysicalMaterial whose body colour comes
// from the shared pattern library (render/patterns.js) in the die's own space, offset by `seed` so
// two dice never share a pattern. The numerals are never part of the finish: a glyph mask (white
// numerals on black, in the die's atlas UVs) mixes in the solid ink colour, zeroes the
// transmission under the ink and engraves it through the bump map — so on every finish the
// numbers are opaque and the colour picked for them. A granite's mica flakes (FINISHES.granite.mica)
// get a higher specular intensity than the rest of the stone. Every die also carries its exit
// (render/exit-shader.js): heat, burning away and a pit's cut, all off until it leaves the table.

import * as THREE from 'three';
import { FINISHES, SPECULAR, SEE_THROUGH_DEPTH_OFFSET } from './finish-table.js';
import { patternUniforms, injectPattern } from './patterns.js';
import { EXIT_CLIP_OFF, EXIT_VERTEX_PARS, EXIT_VERTEX, EXIT_FRAGMENT_PARS, EXIT_SURFACE, EXIT_EMISSIVE, EXIT_OUTGOING } from './exit-shader.js';

export { FINISHES };

/**
 * The material of one die. style = {body, ink} (CSS colours); glyph is the die type's numeral
 * mask texture; seed (0..1) places this die's pattern; radius (m) is the die's circumradius, for
 * where a scattering finish is thin; onTray, whether a tray is drawn under it (a scattering finish
 * bleeds more there: setOnTray). Dimming rides the vertex colours.
 */
export function dieMaterial(finishName, style, glyph, seed = 0, { radius = 0.012, onTray = false } = {}) {
  const f = FINISHES[finishName];
  if (!f) throw new Error('dieMaterial: unknown finish "' + finishName + '" (known: ' + Object.keys(FINISHES).join(', ') + ')');
  const uniforms = {
    ...patternUniforms(THREE, { pattern: f.pattern, base: style.body, seed, micaShare: f.mica ? f.mica.share : 0 }),
    uMicaBoost: { value: f.mica ? f.mica.boost : 0 },
    uInk: { value: new THREE.Color(style.ink) },
    uGlyph: { value: glyph },
    ...(f.scatter ? scatterUniforms(f.scatter, radius, onTray) : {}),
    // The exit (render/exits.js drives them): off at rest.
    uExitHeat: { value: 0 },
    uExitDissolve: { value: 0 },
    uExitClipY: { value: EXIT_CLIP_OFF },
  };
  const m = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(style.body),
    roughness: f.roughness,
    metalness: 0,
    specularIntensity: SPECULAR,
    clearcoat: f.clearcoat * SPECULAR,
    clearcoatRoughness: f.clearcoatRoughness,
    bumpMap: glyph,
    bumpScale: -1.2,            // the numerals are recessed: the mask is white where they are
    vertexColors: true,
    transmission: f.transmission,
    side: f.doubleSided ? THREE.DoubleSide : THREE.FrontSide,
    envMapIntensity: f.envMapIntensity ?? 1,
  });
  if (f.transmission > 0) {
    m.thickness = f.thickness;
    m.ior = f.ior;
    m.attenuationColor = new THREE.Color(style.body);
    m.attenuationDistance = f.attenuationDistance;
    // The far faces must win their tie with the floor they rest on (SEE_THROUGH_DEPTH_OFFSET).
    m.polygonOffset = true;
    m.polygonOffsetFactor = SEE_THROUGH_DEPTH_OFFSET.factor;
    m.polygonOffsetUnits = SEE_THROUGH_DEPTH_OFFSET.units;
  }
  m.defines = { ...(m.defines || {}), USE_UV: '' };
  m.userData.dice = { finish: finishName, uniforms, seed };
  m.onBeforeCompile = (shader) => {
    injectPattern(shader, uniforms, 'object',
      'float diceGlyph = texture2D( uGlyph, vUv ).r;\n' +
      'diffuseColor.rgb = mix( diffuseColor.rgb, uInk, diceGlyph );\n' +
      // dev/mica-probe.js: paint the mica flakes magenta, to see which specks they are.
      '#ifdef MICA_DEBUG\n diffuseColor.rgb = mix( diffuseColor.rgb, vec3( 1.0, 0.0, 1.0 ), pMica * ( 1.0 - diceGlyph ) );\n#endif\n' +
      EXIT_SURFACE);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\n' + EXIT_VERTEX_PARS)
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n' + EXIT_VERTEX);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 uInk;\nuniform sampler2D uGlyph;\nuniform float uMicaBoost;' + EXIT_FRAGMENT_PARS)
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n' + EXIT_EMISSIVE)
      .replace('#include <opaque_fragment>', EXIT_OUTGOING + '\n#include <opaque_fragment>')
      // Mica flakes reflect more: their specular intensity is raised by uMicaBoost (never under the ink).
      .replace('#include <lights_physical_fragment>', THREE.ShaderChunk.lights_physical_fragment
        .replace('float specularIntensityFactor = specularIntensity;', MICA_SPECULAR))
      .replace('#include <transmission_fragment>', THREE.ShaderChunk.transmission_fragment
        .replace('material.transmission = transmission;', 'material.transmission = transmission * ( 1.0 - diceGlyph ) * ( 1.0 - exitChar );'));
    if (f.mica && !shader.fragmentShader.includes(MICA_SPECULAR)) {
      console.error('dieMaterial: the mica hook did not apply (a three.js chunk changed?)');
    }
    if (f.transmission > 0 && !shader.fragmentShader.includes('transmission * ( 1.0 - diceGlyph )')) {
      console.error('dieMaterial: the opaque-ink hook did not apply (a three.js chunk changed?)');
    }
    if (![EXIT_VERTEX, EXIT_EMISSIVE, EXIT_OUTGOING].every((line) => shader.vertexShader.includes(line) || shader.fragmentShader.includes(line))) {
      console.error('dieMaterial: the exit hook did not apply (a three.js chunk changed?)');
    }
    if (f.scatter) injectScatter(shader);
  };
  m.customProgramCacheKey = () => 'dice-' + finishName;
  return m;
}

/** The specular line with the mica's boost in it; also what the hook's guard looks for. */
const MICA_SPECULAR = 'float specularIntensityFactor = specularIntensity * ( 1.0 + uMicaBoost * pMica * ( 1.0 - diceGlyph ) );';

// ---------------------------------------------------------------- faked subsurface scatter
// three.js transmission blends the view through a die with its surface colour; it does not let
// light wander inside the material and come out tinted, which is what makes real translucent dice
// glow (owner 2026-10-24: "add a little subsurface scatter, or fake it convincingly"). Two terms,
// added AFTER the transmission blend so the surface share does not mute them:
//   through  each light, unshadowed (self-shadowing would black out exactly the far side light
//            shows through), by the translucency approximation of Barré-Brisebois & Bouchard (GDC
//            2011): strongest where the light is behind the die, strongest of all at edges and
//            corners, where the material is thinnest
//   bleed    the light the tray bounces up into the die, scattered out tinted: the scene's average
//            colour (the last, 1×1 mip of three's transmission buffer — in a tray view, mostly tray),
//            strongest in the die's lower half, nearest the tray. Read with textureLod at that mip,
//            not getTransmissionSample: three blurs that by roughness × clamp(2·ior − 2, 0, 1), so
//            the ior of 1 it was first given meant no blur at all — it read the ONE pixel at the
//            screen's centre, and a die landing there darkened every die in the roll (owner
//            2026-10-24, the Jade preset: half brightness one roll in eight).
// Both are tinted by the die's own colour and kept off the ink.

function scatterUniforms(sc, radius, onTray) {
  return {
    uScatterGlow: { value: sc.glow },
    uScatterDistortion: { value: sc.distortion },
    uScatterPower: { value: sc.power },
    uScatterAmbient: { value: sc.ambient },
    uScatterBleed: { value: onTray ? sc.trayBleed : sc.bleed },
    uRadius: { value: radius },
  };
}

const SCATTER_GLSL = /* glsl */ `
#if defined( USE_TRANSMISSION ) && NUM_DIR_LIGHTS > 0
{
  float diceThin = smoothstep( 0.5, 1.0, length( vPatternPos ) / uRadius );
  vec3 diceScatter = vec3( 0.0 );
  for ( int i = 0; i < NUM_DIR_LIGHTS; i ++ ) {
    vec3 h = normalize( directionalLights[ i ].direction + geometryNormal * uScatterDistortion );
    float through = pow( saturate( dot( geometryViewDir, -h ) ), uScatterPower );
    diceScatter += ( through * uScatterGlow + uScatterAmbient ) * directionalLights[ i ].color;
  }
  diceScatter *= 0.35 + 0.65 * diceThin;
  // The whole scene, averaged: the last mip (textureLod clamps a level past it to it).
  vec3 diceTray = textureLod( transmissionSamplerMap, vec2( 0.5 ), log2( max( transmissionSamplerSize.x, transmissionSamplerSize.y ) ) ).rgb;
  float diceLow = 1.0 - smoothstep( 0.0, 2.0 * uRadius, vWorldPosition.y );    // 1 at the tray, 0 at the die's top
  diceScatter += diceTray * uScatterBleed * ( 0.3 + 0.7 * diceLow );
  totalDiffuse += diceScatter * diffuseColor.rgb * ( 1.0 - diceGlyph );
}
#endif
`;

const SCATTER_UNIFORMS = /* glsl */ `
uniform float uScatterGlow;
uniform float uScatterDistortion;
uniform float uScatterPower;
uniform float uScatterAmbient;
uniform float uScatterBleed;
uniform float uRadius;
`;

function injectScatter(shader) {
  const outgoing = 'vec3 outgoingLight = totalDiffuse + totalSpecular + totalEmissiveRadiance;';
  shader.fragmentShader = shader.fragmentShader
    .replace('#include <common>', '#include <common>' + SCATTER_UNIFORMS)
    .replace(outgoing, SCATTER_GLSL + outgoing);
  // Checked against the block itself, so the guard cannot drift from the GLSL (a hand-copied line
  // did, and cried wolf on every die while the scatter worked — 2026-10-24).
  if (!shader.fragmentShader.includes(SCATTER_GLSL)) console.error('dieMaterial: the scatter hook did not apply (a three.js chunk changed?)');
}

/** Tells a die material whether a tray is drawn under it: a scattering finish bleeds trayBleed there, bleed without. */
export function setOnTray(m, onTray) {
  const f = FINISHES[m.userData.dice.finish];
  if (f.scatter) m.userData.dice.uniforms.uScatterBleed.value = onTray ? f.scatter.trayBleed : f.scatter.bleed;
}

/** Swaps a die material's numeral mask (a new font) in place: the ink, the engraving and the opaque-ink cut all follow it. */
export function setGlyph(m, glyph) {
  m.userData.dice.uniforms.uGlyph.value = glyph;
  m.bumpMap = glyph;
}

/** Recolours a die material in place (no recompile). */
export function recolour(m, style) {
  const u = m.userData.dice.uniforms;
  u.uBase.value.set(style.body);
  u.uInk.value.set(style.ink);
  m.color.set(style.body);
  if (m.transmission > 0) m.attenuationColor.set(style.body);
}
