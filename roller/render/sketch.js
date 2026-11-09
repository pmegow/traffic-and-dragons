// Pencil rendering: paper grain, continuous crosshatching and doubled polygon-edge strokes.
// Only the Sketch finish installs this hook; lighting guides pencil density instead of glossy shading.
const PARS = /* glsl */ `
uniform float uSketchInkStyle;
uniform float uSketchPost;
float diceSketchShade = 0.0;
float diceSketchMask = 0.0;
varying vec3 vSketchPosition;
varying float vSketchEdge;
varying vec3 vSketchNormal;
varying vec3 vSketchLightNormal;
varying vec3 vSketchHatch;
// Continuous lines, with half the previous variation between neighbors. There are no
// segment ends or row boundaries: the surface silhouette alone clips each straight stroke.
float sketchStrokes(vec2 p, float width, float salt) {
  p *= 0.56;
  vec2 dx = dFdx(p), dy = dFdy(p);
  float minified = smoothstep(0.45, 1.2, abs(dx.x) + abs(dy.x));
  if (minified >= 1.0) return 2.0 * width;
  // Include every tilted line crossing this pixel, with a fixed work budget even for
  // auxiliary geometry. Beyond that budget use the same average graphite coverage.
  float reach = abs(p.y) * 0.06 + 0.8;
  float first = floor(p.x - reach), last = ceil(p.x + reach);
  if (last - first >= 16.0) return 2.0 * width;
  float coverage = 0.0;
  for (int sampleIndex = 0; sampleIndex < 16; sampleIndex++) {
    float id = first + float(sampleIndex);
    if (id > last) break;
    vec3 h = pHash3(vec3(id, salt, uSeed.x + uSeed.y));
    float center = id + 0.5 + (h.x - 0.5) * 0.3;
    float slope = (h.z - 0.5) * 0.12;
    float distance = abs(p.x - center - slope * p.y) / sqrt(1.0 + slope * slope);
    float halfWidth = width * (0.875 + 0.25 * h.y);
    float aa = max((abs(dx.x - slope * dx.y) + abs(dy.x - slope * dy.y)) / sqrt(1.0 + slope * slope), 0.01);
    float stroke = 1.0 - smoothstep(halfWidth, halfWidth + aa, distance);
    coverage = max(coverage, stroke);
  }
  // At small display sizes, converge to average graphite coverage rather than shimmer.
  return mix(coverage, 2.0 * width, minified);
}
float sketchHatch(vec2 p, float dark, float region) {
  float a = sketchStrokes(vec2(p.x + p.y * 0.63, p.y - p.x * 0.63), 0.11, 3.7 + region * 17.0);
  float b = sketchStrokes(vec2(p.x * 0.71 - p.y, p.x + p.y * 0.71), 0.10, 19.3 + region * 17.0);
  return (a * smoothstep(0.05, 0.6, dark) + b * smoothstep(0.42, 0.9, dark)) * 0.84;
}
`;
const DRAW = /* glsl */ `
{
  vec3 q = vSketchPosition * 1900.0 + uSeed;
  vec3 weights = pow(abs(normalize(vSketchNormal)), vec3(8.0));
  weights /= max(dot(weights, vec3(1.0)), 0.001);
  // A flat face has one shading value, unaffected by local grain or scene shadows.
  float dark = clamp(0.62 - 0.6 * dot(normalize(vSketchLightNormal), normalize(vec3(-0.6, 0.8, 0.5))), 0.06, 0.95);
  vec3 hatchPos = vSketchPosition * 1900.0;
  float hatch = 0.0;
  if (uSketchPost < 0.5) {
  // Planar regions need only their own projection, not the three discarded body projections.
  if (vSketchHatch.z > 0.5) hatch = sketchHatch(vSketchHatch.xy * 1900.0, dark, vSketchHatch.z);
  else if (uSketchInkStyle > 0.5 && vSketchHatch.z < -0.5) hatch = sketchHatch(vSketchHatch.xy * 1900.0, dark, -vSketchHatch.z + 71.0);
  else hatch = dot(weights, vec3(sketchHatch(hatchPos.yz, dark, 0.0), sketchHatch(hatchPos.zx, dark, 0.0), sketchHatch(hatchPos.xy, dark, 0.0)));
  }
  diceSketchShade = dark;
  diceSketchMask = 1.0 - diceGlyph;
  float grain = pNoise(q * 2.1);
  float edge = vSketchEdge + (pNoise(q * 0.45) - 0.5) * 0.00013;
  float aa = max(fwidth(vSketchEdge), 0.000025);
  float outline = vSketchEdge <= 0.0 ? 0.15 : 1.0 - smoothstep(0.00004, 0.00010 + aa, edge);
  float echo = 1.0 - smoothstep(0.000035, 0.000075 + aa, abs(edge - 0.00048));
  float pencil = clamp(hatch * mix(0.8, 1.45, uSketchInkStyle) + outline * 0.72 + echo * 0.3 + dark * mix(0.15, 0.0, uSketchInkStyle), 0.0, mix(0.76, 0.98, uSketchInkStyle));
  float tooth = mix(0.13, 0.035, uSketchInkStyle);
  vec3 paper = uBase * (1.0 - tooth + tooth * grain);
  if (uSketchPost > 0.5) {
    pencil = clamp(outline * 0.72 + echo * 0.3 + dark * 0.08, 0.0, 0.85);
    diceSketchMask *= 1.0 - clamp(outline + echo * 0.4, 0.0, 1.0);
  }
  vec3 drawn = mix(paper, uInk, pencil);
  // The ink variant outlines the whole bevel/corner in the chosen numeral ink.
  if (vSketchHatch.z > 0.5) { drawn = mix(drawn, uInk, 0.98 * uSketchInkStyle); diceSketchMask *= 1.0 - uSketchInkStyle; }
  // A narrow paper halo separates black numerals from black hatching, like the ink reference.
  if (uSketchInkStyle > 0.5) {
    vec2 px = fwidth(vUv) * 1.15;
    float halo = max(max(texture2D(uGlyph, vUv + vec2(px.x, 0)).r, texture2D(uGlyph, vUv - vec2(px.x, 0)).r),
                     max(texture2D(uGlyph, vUv + vec2(0, px.y)).r, texture2D(uGlyph, vUv - vec2(0, px.y)).r));
    halo = max(halo, max(max(texture2D(uGlyph, vUv + px).r, texture2D(uGlyph, vUv - px).r),
                         max(texture2D(uGlyph, vUv + vec2(px.x, -px.y)).r, texture2D(uGlyph, vUv + vec2(-px.x, px.y)).r)));
    drawn = mix(drawn, paper, halo * uExitInk * (1.0 - diceGlyph));
    diceSketchMask *= 1.0 - halo * uExitInk;
  }
  // The actual face markings remain readable, with just a little paper showing through graphite.
  drawn = mix(drawn, mix(uInk, paper, mix(0.09, 0.02, uSketchInkStyle) * grain), diceGlyph);
  outgoingLight = drawn + totalEmissiveRadiance;
}
`;
export function injectSketch(shader, { inkStyle = 0 } = {}) {
  shader.uniforms = shader.uniforms || {};
  shader.uniforms.uSketchInkStyle = { value: inkStyle };
  // Scurry props are unit cylinders/spheres scaled to meters by the mesh. Keep their
  // hatch/grain coordinates in physical units, as the die's baked geometry already is.
  const vertex = 'vSketchPosition = position * vec3(length(modelMatrix[0].xyz), length(modelMatrix[1].xyz), length(modelMatrix[2].xyz)); vSketchEdge = faceDistance; vSketchNormal = dot(surfaceNormal, surfaceNormal) > 0.5 ? surfaceNormal : normal; vSketchLightNormal = normalMatrix * vSketchNormal; vSketchHatch = surfaceHatch;';
  const outgoing = 'vec3 outgoingLight = totalDiffuse + totalSpecular + totalEmissiveRadiance;';
  if (!shader.vertexShader.includes('#include <begin_vertex>') || !shader.fragmentShader.includes(outgoing)) {
    throw new Error('Sketch finish: shader hook missing after a three.js change');
  }
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', '#include <common>\nattribute float faceDistance; attribute vec3 surfaceNormal; attribute vec3 surfaceHatch; varying vec3 vSketchPosition; varying float vSketchEdge; varying vec3 vSketchNormal; varying vec3 vSketchLightNormal; varying vec3 vSketchHatch;')
    .replace('#include <begin_vertex>', '#include <begin_vertex>\n' + vertex);
  shader.fragmentShader = shader.fragmentShader
    .replace('void main() {', PARS + '\nvoid main() {')
    .replace(outgoing, outgoing + '\n' + DRAW);
  if (!shader.fragmentShader.includes(DRAW) || !shader.fragmentShader.includes(PARS)) throw new Error('Sketch finish: pencil shader did not attach');
}
