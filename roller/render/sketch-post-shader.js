// Screen-space strokes: bounded work, constant CSS-pixel spacing, one straight line per neighbor.
export const POST_VERTEX = `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;
export const POST_FRAGMENT = `
uniform sampler2D uBeauty;
uniform sampler2D uData;
uniform sampler2D uInk;
uniform vec2 uCssSize;
uniform float uStrength;
varying vec2 vUv;
float hashLine(float x) { return fract(sin(x * 127.1 + 31.7) * 43758.5453); }
float strokes(vec2 p, float salt) {
  p /= 7.0;
  p.y /= max(uCssSize.y / 7.0, 1.0);
  vec2 gradient = vec2(fwidth(p.x), fwidth(p.y));
  float base = floor(p.x), ink = 0.0;
  for (int i = -1; i <= 1; i++) {
    float id = base + float(i);
    float h = hashLine(id + salt), h2 = hashLine(id + salt + 17.0);
    float center = id + 0.5 + (h - 0.5) * 0.22 + (h2 - 0.5) * 0.4 * p.y;
    float d = abs(p.x - center), width = 0.085 * (0.85 + 0.3 * h2);
    ink = max(ink, 1.0 - smoothstep(width, width + max(gradient.x + 0.2 * gradient.y, 0.015), d));
  }
  return ink;
}
void main() {
  vec4 beauty = texture2D(uBeauty, vUv);
  vec3 data = texture2D(uData, vUv).rgb;
  float mask = clamp(data.b, 0.0, 1.0);
  vec3 color = beauty.rgb;
  if (mask > 0.001) {
    float shade = clamp(data.r / max(data.b, 0.001), 0.0, 1.0);
    float bold = clamp(data.g / max(data.b, 0.001), 0.0, 1.0);
    vec3 ink = texture2D(uInk, vUv).rgb / max(data.b, 0.001);
    vec2 p = vUv * uCssSize;
    float a = strokes(vec2(p.x + p.y * 0.6, p.y), 3.7);
    float b = strokes(vec2(p.x * 0.6 - p.y, p.x), 19.3);
    float hatch = clamp(a * smoothstep(0.06, 0.65, shade) + b * smoothstep(0.42, 0.92, shade), 0.0, 1.0);
    color = mix(color, ink * beauty.a, uStrength * mask * hatch * mix(0.82, 0.97, bold));
  }
  gl_FragColor = vec4(color, beauty.a);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

// Every drawable writes ownership, including zero for ordinary materials. Using the original
// alpha/discard/depth means a glass foreground occludes the hatch mask just as it occludes color.
export function injectPostCapture(shader, uniforms, { die = false } = {}) {
  Object.assign(shader.uniforms, uniforms);
  const header = `
layout(location = 1) out highp vec4 dicePostData;
layout(location = 2) out highp vec4 dicePostInk;
uniform float uPostOwned;
uniform float uPostBold;
uniform vec3 uPostInk;
`;
  if (!shader.fragmentShader.includes('out highp vec4 dicePostData;')) shader.fragmentShader = header + shader.fragmentShader;
  const end = shader.fragmentShader.lastIndexOf('}');
  if (end < 0) throw new Error('Sketch post-process: fragment main is missing');
  // A profile delegates to its parent's compile hook; replace, rather than double-install, its capture.
  shader.fragmentShader = shader.fragmentShader.replace(/\/\/ POST_CAPTURE_BEGIN[\s\S]*?\/\/ POST_CAPTURE_END/g, '');
  const at = shader.fragmentShader.lastIndexOf('}');
  const tone = die ? 'diceSketchShade' : 'clamp(1.0 - dot(gl_FragColor.rgb, vec3(0.2126, 0.7152, 0.0722)), 0.12, 0.95)';
  const mask = die ? 'diceSketchMask * uPostOwned' : 'uPostOwned';
  shader.fragmentShader = shader.fragmentShader.slice(0, at) + `
// POST_CAPTURE_BEGIN
float postMask = ${mask};
dicePostData = vec4(vec3(${tone}, uPostBold, 1.0) * postMask, gl_FragColor.a);
dicePostInk = vec4(uPostInk * postMask, gl_FragColor.a);
// POST_CAPTURE_END
` + shader.fragmentShader.slice(at);
}

// Preserve the pre-wrapper key: Three's default key reads onBeforeCompile dynamically.
// Calling that default after wrapping would merge distinct custom materials into one program.
export function installPostCapture(material, uniforms, onDispose) {
  const before = material.onBeforeCompile, key = material.customProgramCacheKey;
  const programKey = key.call(material);
  let restored = false;
  const restore = () => {
    if (restored) return;
    restored = true;
    material.onBeforeCompile = before;
    material.customProgramCacheKey = key;
    material.removeEventListener('dispose', disposed);
    if (material.userData?.dice?.uniforms.uSketchPost) material.userData.dice.uniforms.uSketchPost.value = 0;
    material.needsUpdate = true;
  };
  const disposed = () => { restore(); onDispose(); };
  material.onBeforeCompile = (shader, renderer) => {
    before.call(material, shader, renderer);
    injectPostCapture(shader, uniforms, { die: shader.fragmentShader.includes('float diceSketchShade =') });
  };
  material.customProgramCacheKey = () => programKey + '-sketch-capture';
  material.addEventListener('dispose', disposed);
  material.needsUpdate = true;
  return restore;
}
