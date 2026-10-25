// render/patterns.js — THE surface patterns, shared by the dice and the tray.
//
// One GLSL library computes a surface colour from a base colour and a position: plain, marble,
// granite, wood or felt. Every pattern is a gentle shift of the base colour's VALUE (owner
// 2026-10-24: marble veins within ±15%, granite ±5%), applied in sRGB terms, so a picked colour stays the
// colour you see. Positions are in metres — the die's own space for a die (so the pattern travels
// with it), the world for the tray — times PATTERN_SCALE, so a granite die and a granite tray share
// one grain.
//
//   granite  crystals: a cellular (Worley) field whose every cell takes one of five value steps,
//            −5 −2.5 0 +2.5 +5 % (±10 % read too noisy — owner 2026-10-24), at three sizes from the
//            base grain to double it; a share of the crystals (uMicaShare, 0 unless a finish asks)
//            are marked as mica in pMica for the material to make shinier
//   marble   veins along warped planes, jagged, swelling and breaking up, with soft washes feathering
//            off them and fine hairline cracks branching near them, all up to 15 % toward the
//            contrasting side; faint streaks along the veins (±1.5 %) and a little clouding (±3 %)
//   wood     long wavy grain lines along x and fine fibres, within ±7 %
//   felt     soft mottling and fine fibre noise, within ±6 %

export const PATTERNS = { plain: 0, marble: 1, granite: 2, wood: 3, felt: 4 };

/** Metres to pattern space. */
export const PATTERN_SCALE = 140;

/**
 * Marble's value shifts: the veins (their cores, washes and hairlines, toward the contrasting side),
 * the soft clouding, and the faint streaks of the grain. The veins were 10 %; owner 2026-10-24:
 * "adjust the value change on the veins by 50% towards whatever direction they're heading" —
 * darker veins darker still, lighter ones lighter still.
 */
export const MARBLE = { vein: 0.15, cloud: 0.03, streak: 0.015 };

/** The granite grain: cells per pattern unit at the finest size — half v0.5.0's 26, so twice the flake size (owner 2026-10-24). */
const GRANITE_FINE = 13.0;

export const PATTERN_GLSL = /* glsl */ `
uniform vec3 uBase;
uniform float uPattern;
uniform float uScale;
uniform vec3 uSeed;
uniform float uMicaShare;
varying vec3 vPatternPos;
// 1 on a granite crystal picked as a mica flake, else 0 — set by patternColor for the lighting.
float pMica = 0.0;

float pHash(vec3 p) {
  p = fract(p * 0.3183099 + 0.1);
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}
vec3 pHash3(vec3 p) { return vec3(pHash(p), pHash(p + 19.19), pHash(p + 47.47)); }
float pNoise(vec3 x) {
  vec3 i = floor(x), f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(pHash(i), pHash(i + vec3(1, 0, 0)), f.x),
                 mix(pHash(i + vec3(0, 1, 0)), pHash(i + vec3(1, 1, 0)), f.x), f.y),
             mix(mix(pHash(i + vec3(0, 0, 1)), pHash(i + vec3(1, 0, 1)), f.x),
                 mix(pHash(i + vec3(0, 1, 1)), pHash(i + vec3(1, 1, 1)), f.x), f.y), f.z);
}
float pFbm(vec3 p) {
  float a = 0.5, s = 0.0;
  for (int i = 0; i < 5; i++) { s += a * pNoise(p); p = p * 2.03 + 1.7; a *= 0.5; }
  return s;
}
/** Three octaves of pNoise, rescaled to 0..1: the cheaper fbm for the marble's details. */
float pFbm3(vec3 p) {
  float a = 0.5, s = 0.0;
  for (int i = 0; i < 3; i++) { s += a * pNoise(p); p = p * 2.07 + 3.3; a *= 0.5; }
  return s / 0.875;
}
/**
 * A line along the zero crossings of a signed field n, w wide (in n's units), its edge softened by
 * how fast n changes on screen — so a hairline stays a smooth line at any distance instead of
 * breaking into flickering pixels as the die turns.
 */
float pLine(float n, float w) {
  float aa = fwidth(n) * 1.5 + 1e-4;
  return 1.0 - smoothstep(w, w + aa, abs(n));
}
/** The random value (0..1) of the Worley cell p lies in: the nearest jittered feature point's. */
float pCell(vec3 p) {
  vec3 i = floor(p), f = fract(p);
  float best = 9.0, id = 0.0;
  for (int z = -1; z <= 1; z++) for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
    vec3 g = vec3(float(x), float(y), float(z));
    vec3 r = g + pHash3(i + g) - f;
    float d = dot(r, r);
    if (d < best) { best = d; id = pHash(i + g + 3.7); }
  }
  return id;
}
/** The base colour with its sRGB value shifted by k (−0.1 = 10 % darker), in linear light. */
vec3 pShade(vec3 base, float k) { return base * pow(max(0.0, 1.0 + k), 2.2); }
/** Five steps: −0.05, −0.025, 0, +0.025, +0.05 (the granite crystals). */
float pStep5(float h) { return (floor(h * 4.999) - 2.0) * 0.025; }

vec3 patternColor(vec3 p) {
  if (uPattern < 0.5) return uBase;
  if (uPattern < 1.5) {
    // Marble (owner 2026-10-24: "right now there's basically just a wormy vein … add interest").
    // The veins lie along planes (level sets of t) bent by a slow warp; g is the direction across
    // them, a the distance along g, qp the position within a vein's plane.
    float warp = pNoise(p * 0.35) + 0.5 * pNoise(p * 0.7 + 3.1) + 0.25 * pNoise(p * 1.4 + 7.7);
    vec3 q = p + 1.4 * vec3(warp, pNoise(p * 0.3 + 9.0), pNoise(p * 0.3 + 19.0));
    vec3 g = normalize(vec3(0.32, 0.18, 0.1));
    float a = dot(q, g);
    vec3 qp = q - a * g;
    // Main veins: jagged edges (fine fbm on t), swelling and thinning, fading out and breaking.
    float t = a * 0.62 + 0.9 * warp + 0.3 * (pFbm(q * 1.3) - 0.5);
    float n = sin(t * 3.14159);
    float swell = pNoise(qp * 0.45 + 7.0);
    float alive = smoothstep(0.22, 0.62, pNoise(qp * 0.3 + 2.0));
    float core = pLine(n, 0.012 + 0.11 * swell * swell) * (0.3 + 0.7 * alive);
    // A thinner second set between them, fainter and more broken.
    float t2 = t * 2.3 + 1.7 * pNoise(p * 0.9 + 5.0);
    float second = pLine(sin(t2 * 3.14159), 0.02) * smoothstep(0.45, 0.8, pNoise(qp * 0.4 + 31.0));
    // Washes: soft grey drifts feathering off the veins, wider where the vein is alive.
    float feather = pFbm3(qp * 0.8 + g * a * 5.0 + 5.0);
    float wash = (1.0 - smoothstep(0.0, 0.35 + 0.6 * feather, abs(n))) * (0.3 + 0.7 * feather) * (0.4 + 0.6 * alive);
    // Drifts: broad soft grey clouds lying along the veins, away from them too.
    float drift = smoothstep(0.42, 0.85, pFbm3(qp * 0.35 + g * a * 2.2 + 61.0));
    // Hairlines: fine cracks running with the veins, mostly near them.
    float n2 = 2.0 * pFbm3(qp * 0.55 + g * a * 4.2 + 17.0) - 1.0;
    float hair = pLine(n2, 0.012) * (0.4 + 0.6 * (1.0 - smoothstep(0.1, 0.7, abs(n))));
    float n3 = 2.0 * pFbm3(qp * 1.1 + g * a * 7.5 + 73.0) - 1.0;
    hair = max(hair, 0.6 * pLine(n3, 0.01) * (1.0 - smoothstep(0.2, 0.8, abs(n))));
    // Streaks: the faint grain along the veins.
    float streak = 2.0 * pNoise(qp * 0.35 + g * a * 7.0 + 41.0) - 1.0;
    float dir = dot(uBase, vec3(0.2126, 0.7152, 0.0722)) > 0.18 ? -1.0 : 1.0;
    float vein = clamp(core + 0.6 * wash + 0.35 * drift + 0.45 * second + 0.45 * hair, 0.0, 1.0);
    float k = dir * ${MARBLE.vein.toFixed(3)} * vein - dir * ${MARBLE.cloud.toFixed(3)} * (2.0 * pFbm3(p * 0.6) - 1.0)
      + ${MARBLE.streak.toFixed(3)} * streak;
    return pShade(uBase, clamp(k, -${MARBLE.vein.toFixed(3)}, ${MARBLE.vein.toFixed(3)}));
  }
  if (uPattern < 2.5) {
    // Granite: start from the coarse grain (double size); some cells split into the 1.5× grain,
    // some of those into the fine grain — crystals from the base size to double it.
    float h = pCell(p * ${(GRANITE_FINE / 2).toFixed(2)});
    if (fract(h * 7.31) < 0.5) {
      h = pCell(p * ${(GRANITE_FINE / 1.5).toFixed(2)} + 13.1);
      if (fract(h * 5.17) < 0.5) h = pCell(p * ${GRANITE_FINE.toFixed(2)} + 29.3);
    }
    // A mica flake: a test of the crystal's own random value that its colour step does not use, so
    // the flakes fall evenly across all five steps and all three sizes (the share is the finish's:
    // FINISHES.granite.mica).
    pMica = fract(h * 61.73) < uMicaShare ? 1.0 : 0.0;
    return pShade(uBase, pStep5(fract(h * 3.97)));
  }
  if (uPattern < 3.5) {
    // Wood: grain lines along x a few millimetres apart, bent slowly, and fine fibres.
    float g = p.z * 2.4 + 1.6 * pFbm(vec3(p.x * 0.04, p.z * 0.3, 0.5));
    float line = pow(abs(fract(g) - 0.5) * 2.0, 3.0);
    float k = 0.07 * (line - 0.35) + 0.025 * (2.0 * pNoise(vec3(p.x * 0.12, p.z * 9.0, 2.0)) - 1.0);
    return pShade(uBase, clamp(k, -0.07, 0.07));
  }
  // Felt: soft mottling across centimetres and fine fibre noise.
  float k = 0.03 * (2.0 * pFbm(p * 0.12) - 1.0) + 0.04 * (2.0 * pNoise(p * 9.0) - 1.0) + 0.02 * (2.0 * pNoise(p * 23.0 + 4.0) - 1.0);
  return pShade(uBase, clamp(k, -0.06, 0.06));
}
`;

/** The uniforms a patterned material needs. */
export function patternUniforms(THREE, { pattern, base, seed = 0, micaShare = 0 }) {
  if (!(pattern in PATTERNS)) throw new Error('patternUniforms: unknown pattern "' + pattern + '" (known: ' + Object.keys(PATTERNS).join(', ') + ')');
  return {
    uBase: { value: new THREE.Color(base) },
    uPattern: { value: PATTERNS[pattern] },
    uScale: { value: PATTERN_SCALE },
    uSeed: { value: new THREE.Vector3(seed * 97.1, seed * 41.3, seed * 63.7) },
    uMicaShare: { value: micaShare },   // the share of granite crystals that are mica (0: none)
  };
}

/**
 * Rewrites a three.js standard/physical shader to colour the surface with patternColor. space is
 * 'object' (the pattern travels with the mesh — a die) or 'world' (a tray floor). `after` is GLSL
 * run right after the colour is set (the dice mix their ink in there).
 */
export function injectPattern(shader, uniforms, space, after = '') {
  Object.assign(shader.uniforms, uniforms);
  const pos = space === 'object' ? 'vPatternPos = position;' : 'vPatternPos = ( modelMatrix * vec4( position, 1.0 ) ).xyz;';
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', '#include <common>\nvarying vec3 vPatternPos;')
    .replace('#include <begin_vertex>', '#include <begin_vertex>\n' + pos);
  shader.fragmentShader = shader.fragmentShader
    .replace('#include <common>', '#include <common>\n' + PATTERN_GLSL)
    .replace('#include <map_fragment>', '#include <map_fragment>\ndiffuseColor.rgb = patternColor( vPatternPos * uScale + uSeed );\n' + after);
  // A three.js upgrade that renamed a chunk would silently drop the pattern: say so.
  if (!shader.fragmentShader.includes('patternColor( vPatternPos') || !shader.vertexShader.includes('vPatternPos = ')) {
    console.error('injectPattern: a shader hook did not apply (a three.js chunk changed?)');
  }
}
