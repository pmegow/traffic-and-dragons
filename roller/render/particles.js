// render/particles.js — a small particle system for the exit effects (render/exits.js): embers, ash,
// smoke and faerie fire. One THREE.Points per system, moved on the CPU (a few hundred particles at
// most, so nothing to gain from the GPU), drawn as round sprites whose size is in metres.
//
//   const sparks = createParticles({ max: 120, look: 'glow' });   // 'glow' and 'flame' add light; 'smoke' and 'soft' cover
//   view.scene.add(sparks.points);
//   sparks.emit({ position, velocity, life, size: [from, to], colour: [from, to], alpha: [from, to],
//                 drag, lift, swirl, wander, twinkle, centre });
//   sparks.update(dt, pixelsPerMetre)   // each frame: moves, ages and redraws them
//   sparks.dispose()
//
// Each particle eases from its first size, colour and alpha to its last over its life (alpha also
// fades in over its first tenth, so nothing pops); drag slows it (per second), lift pushes it up
// (m/s², negative falls), swirl turns it round the vertical through `centre` (rad/s), wander pushes it
// sideways (m/s²) in a direction that turns over its life, so no two paths are straight, and twinkle
// flickers its size.

import * as THREE from 'three';

const LOOKS = {
  // A soft round light, added to what is behind: embers and sparks.
  glow: { blending: THREE.AdditiveBlending, shape: 'float a = smoothstep( 1.0, 0.0, r ); a *= a; gl_FragColor = vec4( vColour * a * vAlpha, a * vAlpha );' },
  // A tongue of flame, pointing up the screen, adding light: wide and hot at its foot, swaying to a point
  // (Going down's hellfire, round 14).
  flame: {
    blending: THREE.AdditiveBlending,
    shape: 'vec2 p = gl_PointCoord * 2.0 - 1.0;\n' +
      'float up = 0.5 - 0.5 * p.y;\n' +
      'float sway = ( pNoise2( vec2( up * 2.5 - vSeed * 3.0, vSeed * 17.0 ) ) - 0.5 ) * 0.7 * up;\n' +
      'float w = max( 0.6 * pow( 1.0 - up, 0.9 ), 0.001 );\n' +
      'float across = abs( p.x - sway ) / w;\n' +
      'float a = ( 1.0 - smoothstep( 0.25, 1.0, across ) ) * smoothstep( 1.0, 0.6, p.y ) * sqrt( 1.0 - up );\n' +
      'vec3 c = vColour * ( 0.7 + 0.8 * ( 1.0 - smoothstep( 0.0, 0.6, across ) ) * ( 1.0 - up ) );\n' +
      'gl_FragColor = vec4( c * a * vAlpha, a * vAlpha );',
  },
  // A soft disc that covers: ash.
  soft: { blending: THREE.NormalBlending, shape: 'float a = smoothstep( 1.0, 0.55, r ); gl_FragColor = vec4( vColour, a * vAlpha );' },
  // A billow with a ragged, turning edge: smoke.
  smoke: {
    blending: THREE.NormalBlending,
    shape: 'float n = pNoise2( gl_PointCoord * 3.5 + vSeed * 13.0 ) * 0.6 + pNoise2( gl_PointCoord * 7.0 - vSeed * 7.0 ) * 0.4;\n' +
      'float a = smoothstep( 1.0, 0.25, r + ( n - 0.5 ) * 0.7 );\n' +
      'gl_FragColor = vec4( vColour * ( 0.85 + 0.3 * n ), a * vAlpha );',
  },
};

const VERTEX = /* glsl */ `
attribute vec3 aColour;
attribute float aAlpha;
attribute float aSize;
attribute float aSeed;
uniform float uPixelsPerMetre;
varying vec3 vColour;
varying float vAlpha;
varying float vSeed;
void main() {
  vec4 mv = modelViewMatrix * vec4( position, 1.0 );
  gl_Position = projectionMatrix * mv;
  gl_PointSize = aSize * uPixelsPerMetre / -mv.z;
  vColour = aColour;
  vAlpha = aAlpha;
  vSeed = aSeed;
}
`;

const fragment = (shape) => /* glsl */ `
varying vec3 vColour;
varying float vAlpha;
varying float vSeed;
float pHash2( vec2 p ) { return fract( sin( dot( p, vec2( 127.1, 311.7 ) ) ) * 43758.5453 ); }
float pNoise2( vec2 p ) {
  vec2 i = floor( p ), f = fract( p );
  f = f * f * ( 3.0 - 2.0 * f );
  return mix( mix( pHash2( i ), pHash2( i + vec2( 1.0, 0.0 ) ), f.x ), mix( pHash2( i + vec2( 0.0, 1.0 ) ), pHash2( i + vec2( 1.0, 1.0 ) ), f.x ), f.y );
}
void main() {
  float r = length( gl_PointCoord - 0.5 ) * 2.0;
  if ( r > 1.0 ) discard;
  ${shape}
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

export function createParticles({ max, look }) {
  const spec = LOOKS[look];
  if (!spec) throw new Error('createParticles: no look "' + look + '" (known: ' + Object.keys(LOOKS).join(', ') + ')');
  if (!(Number.isInteger(max) && max > 0)) throw new Error('createParticles: max must be a positive whole number, got ' + max);
  const geometry = new THREE.BufferGeometry();
  const attr = (name, size) => { const a = new THREE.BufferAttribute(new Float32Array(max * size), size); a.setUsage(THREE.DynamicDrawUsage); geometry.setAttribute(name, a); return a; };
  const position = attr('position', 3), colour = attr('aColour', 3), alpha = attr('aAlpha', 1), size = attr('aSize', 1), seed = attr('aSeed', 1);
  geometry.setDrawRange(0, 0);
  const material = new THREE.ShaderMaterial({
    uniforms: { uPixelsPerMetre: { value: 1000 } },
    vertexShader: VERTEX,
    fragmentShader: fragment(spec.shape),
    blending: spec.blending,
    transparent: true,
    depthWrite: false,
  });
  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;   // the particles move; their bounds are never computed
  points.renderOrder = 2;         // after the dice and the tray
  const live = [];

  const lerp = (a, b, t) => a + (b - a) * t;
  return {
    points,
    get count() { return live.length; },
    emit(p) {
      if (live.length >= max) return false;
      live.push({
        p: { ...p.position }, v: { ...p.velocity }, age: 0, life: p.life,
        size: p.size, colour: p.colour, alpha: p.alpha ?? [1, 0],
        drag: p.drag ?? 0, lift: p.lift ?? 0, swirl: p.swirl ?? 0, twinkle: p.twinkle ?? 0,
        wander: p.wander ?? 0, wanderRate: 5 + Math.random() * 6,
        centre: p.centre || p.position, seed: Math.random(),
      });
      return true;
    },
    update(dt, pixelsPerMetre) {
      material.uniforms.uPixelsPerMetre.value = pixelsPerMetre;
      for (let i = live.length - 1; i >= 0; i--) {
        const q = live[i];
        q.age += dt;
        if (q.age >= q.life) { live.splice(i, 1); continue; }
        const slow = Math.exp(-q.drag * dt);
        q.v.x *= slow; q.v.y = q.v.y * slow + q.lift * dt; q.v.z *= slow;
        if (q.wander) {
          const a = q.seed * 40 + q.age * q.wanderRate;
          q.v.x += q.wander * Math.cos(a) * dt;
          q.v.z += q.wander * Math.sin(a * 1.3) * dt;
        }
        if (q.swirl) {   // turn round the vertical through the centre
          const dx = q.p.x - q.centre.x, dz = q.p.z - q.centre.z, a = q.swirl * dt, c = Math.cos(a), s = Math.sin(a);
          q.p.x = q.centre.x + dx * c - dz * s;
          q.p.z = q.centre.z + dx * s + dz * c;
        }
        q.p.x += q.v.x * dt; q.p.y += q.v.y * dt; q.p.z += q.v.z * dt;
      }
      live.forEach((q, i) => {
        const t = q.age / q.life, fadeIn = Math.min(1, t / 0.1);
        position.setXYZ(i, q.p.x, q.p.y, q.p.z);
        colour.setXYZ(i, lerp(q.colour[0][0], q.colour[1][0], t), lerp(q.colour[0][1], q.colour[1][1], t), lerp(q.colour[0][2], q.colour[1][2], t));
        alpha.setX(i, lerp(q.alpha[0], q.alpha[1], t) * fadeIn);
        const flicker = q.twinkle ? 1 - q.twinkle * (0.5 + 0.5 * Math.sin(q.age * 28 + q.seed * 40)) : 1;
        size.setX(i, lerp(q.size[0], q.size[1], t) * flicker);
        seed.setX(i, q.seed);
      });
      for (const a of [position, colour, alpha, size, seed]) a.needsUpdate = true;
      geometry.setDrawRange(0, live.length);
    },
    dispose() {
      points.removeFromParent();
      geometry.dispose();
      material.dispose();
    },
  };
}
