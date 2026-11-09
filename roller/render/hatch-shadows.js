// Pattern the real floor shadow visibility, never a painted proxy beneath each die.
// Uniform off preserves the ordinary shadow path; both transparent and patterned floors use it.
import { ShaderChunk } from 'three';
const PARS = /* glsl */ `
uniform float uHatchShadow;
varying vec3 vHatchFloor;
float floorStroke(float phase) {
  float aa = max(fwidth(phase), 0.01);
  float line = 1.0 - smoothstep(0.12, 0.12 + aa, abs(fract(phase + 0.5) - 0.5));
  return mix(line, 0.24, smoothstep(0.35, 1.0, aa));
}
float hatchedShadow(float visibility) {
  if (uHatchShadow < 0.5) return visibility;
  vec2 p = vHatchFloor.xz * 1000.0;
  float a = floorStroke(p.x + p.y * 0.61);
  float b = floorStroke(p.x * 0.67 - p.y + 0.4);
  float shade = 1.0 - visibility;
  float lines = a + 0.20 * b * smoothstep(0.75, 1.0, shade);
  return 1.0 - clamp(shade * (0.10 + 2.5 * lines), 0.0, 1.0);
}
`;
export function installHatchShadows(material) {
  const uniform = { value: 0 }, previous = material.onBeforeCompile, previousKey = material.customProgramCacheKey();
  material.onBeforeCompile = (shader, renderer) => {
    previous.call(material, shader, renderer);
    shader.uniforms.uHatchShadow = uniform;
    if (!shader.vertexShader.includes('#include <begin_vertex>')) throw new Error('Hatched shadows: missing floor position hook');
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vHatchFloor;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvHatchFloor = (modelMatrix * vec4(position, 1.0)).xyz;');
    shader.fragmentShader = shader.fragmentShader.replace('void main() {', PARS + '\nvoid main() {');
    if (material.isShadowMaterial) {
      const original = 'opacity * ( 1.0 - getShadowMask() )';
      if (!shader.fragmentShader.includes(original)) throw new Error('Hatched shadows: missing transparent receiver hook');
      shader.fragmentShader = shader.fragmentShader.replace(original, 'mix(opacity, 0.62, uHatchShadow) * (1.0 - hatchedShadow(getShadowMask()))');
    } else {
      const lighting = ShaderChunk.lights_fragment_begin.replace(/getShadow\( ([^)]*) \)/g, 'hatchedShadow( getShadow( $1 ) )');
      if (!lighting.includes('hatchedShadow( getShadow(') || !shader.fragmentShader.includes('#include <lights_fragment_begin>')) throw new Error('Hatched shadows: missing lit receiver hook');
      shader.fragmentShader = shader.fragmentShader.replace('#include <lights_fragment_begin>', lighting);
    }
    if (!shader.fragmentShader.includes(PARS)) throw new Error('Hatched shadows: shader helpers did not attach');
  };
  material.customProgramCacheKey = () => previousKey + '-hatch-shadows';
  return uniform;
}
