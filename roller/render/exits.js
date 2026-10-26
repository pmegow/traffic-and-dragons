// render/exits.js — how a die leaves the table (owner 2026-10-25): the effect that plays each entry of
// THE exit registry, render/exit-table.js. EXITS[name] = { label, seconds, start }; DiceView.removeDie
// and clear() take an exit by name and call start({ view, entry }) on the die leaving, then step(u, dt)
// every frame (u 0 … 1 over the exit's seconds) and dispose() at the end. Adding an exit is an entry in
// the table and a start function here.
//
//   burn   Burn out: the die chars and heats, its glow spreading from the cracks until it is yellow
//          all over, then burns away along a noise with a glowing edge (the die shader:
//          render/exit-shader.js), throwing wandering cinders and ash and a warm light on the floor,
//          and leaves a charred stain that fades last
//   smoke  Smoke puff: the die swells a little and blinks out inside a puff of smoke, with faerie
//          fire — bright, many-coloured sparks — swirling up out of it
//   pit    Going down: a hole opens under the die, which tips and falls through it at once (cut at
//          the floor, darkening at the rim), and the hole closes the moment it is through
//
// Effects only draw: nothing here touches the physics, and the timings are the table's.

import * as THREE from 'three';
import { EXIT_TABLE, burnTimeline, smokeTimeline, pitTimeline } from './exit-table.js';
import { EXIT_CLIP_OFF, EXIT_VERTEX_PARS, EXIT_VERTEX, EXIT_DEPTH_PARS, EXIT_DEPTH } from './exit-shader.js';
import { PATTERN_GLSL } from './patterns.js';
import { createParticles } from './particles.js';

const STARTS = { burn: startBurn, smoke: startSmoke, pit: startPit };

export const EXITS = Object.fromEntries(Object.entries(EXIT_TABLE).map(([key, entry]) => {
  if (!STARTS[key]) throw new Error('render/exits.js: the exit "' + key + '" has no effect to play it');
  return [key, { ...entry, start: STARTS[key] }];
}));

// ---------------------------------------------------------------- burn out
const EMBER = { rate: 70, colour: [[3.0, 1.4, 0.35], [0.8, 0.08, 0.0]] };   // half the first pass's 140 (art direction 2026-10-25)
const ASH = { rate: 60, colour: [[0.32, 0.31, 0.3], [0.22, 0.22, 0.22]] };   // pale grey flakes

function startBurn({ view, entry }) {
  const uniforms = entry.mesh.material.userData.dice.uniforms;
  const R = entry.die.boundingRadius, centre = entry.mesh.position.clone();
  entry.mesh.customDepthMaterial = exitDepthMaterial(uniforms);   // its shadow burns away with it
  const embers = createParticles({ max: 220, look: 'glow' });
  const ash = createParticles({ max: 140, look: 'soft' });
  const stain = floorDisc(view, centre, R * 1.5, STAIN_FRAGMENT, { blending: THREE.NormalBlending, order: 1 });
  const glow = floorDisc(view, centre, R * 3.2, GLOW_FRAGMENT, { blending: THREE.AdditiveBlending, order: 2 });
  view.scene.add(embers.points, ash.points);
  let emberDue = 0, ashDue = 0;
  return {
    step(u, dt) {
      const t = burnTimeline(u);
      uniforms.uExitHeat.value = t.heat;
      uniforms.uExitDissolve.value = t.dissolve;
      glow.set(t.glow);
      stain.set(t.stain);
      for (emberDue += t.embers * EMBER.rate * dt; emberDue >= 1; emberDue--) {
        const s = onSphere();
        embers.emit({
          position: along(centre, s, R * 0.7),
          velocity: { x: s.x * 0.025 + rand(-0.02, 0.02), y: rand(0.03, 0.08), z: s.z * 0.025 + rand(-0.02, 0.02) },
          life: rand(0.4, 0.9), size: [rand(0.0012, 0.0024), 0.0006], colour: EMBER.colour, alpha: [1, 0],
          drag: 1.2, lift: 0.04, wander: rand(0.25, 0.45), twinkle: 0.4,   // never straight up (art direction 2026-10-25)
        });
      }
      for (ashDue += t.ash * ASH.rate * dt; ashDue >= 1; ashDue--) {
        ash.emit({
          position: along(centre, onSphere(), R * 0.6),
          velocity: { x: rand(-0.015, 0.015), y: rand(0.015, 0.045), z: rand(-0.015, 0.015) },
          life: rand(0.6, 1.1), size: [rand(0.0006, 0.0012), rand(0.0004, 0.0008)], colour: ASH.colour, alpha: [0.95, 0],
          drag: 1.5, lift: -0.01, swirl: rand(-2, 2), centre,
        });
      }
      const ppm = pixelsPerMetre(view);
      embers.update(dt, ppm);
      ash.update(dt, ppm);
    },
    dispose() {
      embers.dispose();
      ash.dispose();
      glow.dispose();
      stain.dispose();
      entry.mesh.customDepthMaterial.dispose();
    },
  };
}

// ---------------------------------------------------------------- smoke puff
const SMOKE = { puffs: 16, colour: [[0.78, 0.74, 0.86], [0.5, 0.48, 0.56]] };
const FAERIE = {
  burst: 70, rate: 80,
  // magenta, cyan, violet, gold — bright, but not so bright the tone mapping turns them white
  palette: [[1.6, 0.35, 1.3], [0.35, 1.4, 1.6], [1.0, 0.55, 1.8], [1.7, 1.3, 0.4]],
};

function startSmoke({ view, entry }) {
  const R = entry.die.boundingRadius, mesh = entry.mesh, centre = mesh.position.clone();
  const smoke = createParticles({ max: SMOKE.puffs, look: 'smoke' });
  const sparks = createParticles({ max: 180, look: 'glow' });
  view.scene.add(smoke.points, sparks.points);
  let burst = false, sparksDue = 0;
  const spark = (speed) => {
    const s = onSphere(), c = FAERIE.palette[Math.floor(Math.random() * FAERIE.palette.length)];
    sparks.emit({
      position: along(centre, s, R * rand(0.3, 1.1)),
      velocity: { x: s.x * speed, y: Math.abs(s.y) * speed + rand(0.02, 0.06), z: s.z * speed },
      life: rand(0.7, 1.5), size: [rand(0.0015, 0.003), 0.0008], colour: [c, c.map((x) => x * 0.3)], alpha: [1, 0],
      drag: 2, lift: 0.05, swirl: rand(3, 7) * (Math.random() < 0.5 ? -1 : 1), twinkle: 0.6, centre,
    });
  };
  return {
    step(u, dt) {
      const t = smokeTimeline(u);
      mesh.scale.setScalar(t.scale);
      mesh.position.y = centre.y + t.lift * R;
      mesh.visible = t.scale > 0;
      if (t.burst && !burst) {
        burst = true;
        for (let k = 0; k < SMOKE.puffs; k++) {
          const s = onSphere();
          smoke.emit({
            position: along(centre, s, R * rand(0, 0.5)),
            velocity: { x: s.x * rand(0.03, 0.07), y: Math.abs(s.y) * 0.05 + 0.015, z: s.z * rand(0.03, 0.07) },
            life: rand(0.6, 1.0), size: [R * rand(0.8, 1.2), R * rand(1.8, 2.4)], colour: SMOKE.colour, alpha: [0.55, 0],
            drag: 3.2, lift: 0.03,
          });
        }
        for (let k = 0; k < FAERIE.burst; k++) spark(rand(0.04, 0.12));
      }
      for (sparksDue += t.sparks * FAERIE.rate * dt; sparksDue >= 1; sparksDue--) spark(rand(0.01, 0.04));
      const ppm = pixelsPerMetre(view);
      smoke.update(dt, ppm);
      sparks.update(dt, ppm);
    },
    dispose() {
      smoke.dispose();
      sparks.dispose();
    },
  };
}

// ---------------------------------------------------------------- going down
function startPit({ view, entry }) {
  const uniforms = entry.mesh.material.userData.dice.uniforms;
  const R = entry.die.boundingRadius, mesh = entry.mesh, centre = mesh.position.clone(), turn0 = mesh.quaternion.clone();
  uniforms.uExitClipY.value = 0;   // nothing of it below the floor shows: it is in the hole
  mesh.customDepthMaterial = exitDepthMaterial(uniforms);
  const hole = floorDisc(view, centre, R * 1.4, HOLE_FRAGMENT, { blending: THREE.NormalBlending, scales: true });
  // Its real highest point at rest, not its bounding sphere's: the hole closes the moment that point is
  // through the floor (pitTimeline's rise is the height that makes rise + R this top).
  mesh.updateMatrixWorld();
  const top = new THREE.Box3().setFromObject(mesh, true).max.y;
  const a = Math.random() * 2 * Math.PI, axis = new THREE.Vector3(Math.cos(a), 0, Math.sin(a));
  const tip = new THREE.Quaternion();
  return {
    step(u) {
      const t = pitTimeline(u, R, top - R);   // closes once its highest point is through the floor
      hole.set(t.hole);
      mesh.position.y = centre.y - t.drop;
      mesh.quaternion.copy(tip.setFromAxisAngle(axis, t.tilt).multiply(turn0));
    },
    dispose() {
      hole.dispose();
      uniforms.uExitClipY.value = EXIT_CLIP_OFF;
      mesh.customDepthMaterial.dispose();
    },
  };
}

// ---------------------------------------------------------------- shared pieces
/** A shadow's depth material for a leaving die: the same cut and burn-through as the die (exit-shader.js). */
function exitDepthMaterial(u) {
  const m = new THREE.MeshDepthMaterial();
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, { uScale: u.uScale, uSeed: u.uSeed, uExitDissolve: u.uExitDissolve, uExitClipY: u.uExitClipY });
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vPatternPos;\n' + EXIT_VERTEX_PARS)
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvPatternPos = position;\n' + EXIT_VERTEX);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\n' + PATTERN_GLSL + EXIT_DEPTH_PARS)
      .replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\n' + EXIT_DEPTH);
    if (!shader.fragmentShader.includes(EXIT_DEPTH) || !shader.vertexShader.includes(EXIT_VERTEX)) {
      console.error('exitDepthMaterial: a shadow hook did not apply (a three.js chunk changed?)');
    }
  };
  m.customProgramCacheKey = () => 'dice-exit-depth';
  return m;
}

const DISC_VERTEX = 'varying vec2 vUv;\nvoid main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 ); }';
// A warm light thrown on the floor: brightest under the die, gone at the edge.
const GLOW_FRAGMENT = /* glsl */ `
uniform float uAmount;
varying vec2 vUv;
void main() {
  float r = length( vUv - 0.5 ) * 2.0;
  float a = pow( max( 0.0, 1.0 - r ), 2.0 ) * uAmount;
  gl_FragColor = vec4( vec3( 1.0, 0.42, 0.1 ) * a * 0.9, a );
}
`;
// The char a burnt die leaves on the floor: dark, its edge ragged.
const STAIN_FRAGMENT = /* glsl */ `
uniform float uAmount;
varying vec2 vUv;
float sHash( vec2 p ) { return fract( sin( dot( p, vec2( 127.1, 311.7 ) ) ) * 43758.5453 ); }
float sNoise( vec2 p ) {
  vec2 i = floor( p ), f = fract( p );
  f = f * f * ( 3.0 - 2.0 * f );
  return mix( mix( sHash( i ), sHash( i + vec2( 1.0, 0.0 ) ), f.x ), mix( sHash( i + vec2( 0.0, 1.0 ) ), sHash( i + vec2( 1.0, 1.0 ) ), f.x ), f.y );
}
void main() {
  vec2 q = vUv - 0.5;
  float r = length( q ) * 2.0;
  float n = sNoise( q * 7.0 + 3.1 ) * 0.6 + sNoise( q * 15.0 ) * 0.4;
  float a = ( 1.0 - smoothstep( 0.35, 0.9, r + ( n - 0.5 ) * 0.45 ) ) * uAmount * 0.8;
  gl_FragColor = vec4( vec3( 0.035, 0.028, 0.022 ), a );
}
`;
// A hole: black, its edge soft, a faint violet rim.
const HOLE_FRAGMENT = /* glsl */ `
uniform float uAmount;
varying vec2 vUv;
void main() {
  float r = length( vUv - 0.5 ) * 2.0;
  if ( r > 1.0 ) discard;
  float core = 1.0 - smoothstep( 0.62, 0.95, r );
  float rim = exp( -pow( ( r - 0.86 ) / 0.06, 2.0 ) ) * 0.35;
  gl_FragColor = vec4( vec3( 0.45, 0.2, 0.75 ) * rim, max( core, rim ) );
}
`;

/**
 * A disc on the floor at `centre` (radius in m) drawn by `fragment`, whose uAmount set(x) changes:
 * a light's or a stain's strength, or with `scales` how far a hole is open. `order` stacks discs
 * (a light over a stain).
 */
function floorDisc(view, centre, radius, fragment, { blending, scales = false, order = 1 }) {
  const geometry = new THREE.PlaneGeometry(2 * radius, 2 * radius);
  geometry.rotateX(-Math.PI / 2);
  const material = new THREE.ShaderMaterial({
    uniforms: { uAmount: { value: 0 } }, vertexShader: DISC_VERTEX,
    fragmentShader: fragment + '', blending, transparent: true, depthWrite: false,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(centre.x, 0.0004, centre.z);
  mesh.renderOrder = order;
  view.scene.add(mesh);
  return {
    set(x) {
      material.uniforms.uAmount.value = x;
      if (scales) mesh.scale.setScalar(Math.max(1e-4, x));
      mesh.visible = x > 0;
    },
    dispose() { mesh.removeFromParent(); geometry.dispose(); material.dispose(); },
  };
}

/** Drawing-buffer pixels per metre, one metre in front of the camera: a particle's size in px is this × size ÷ distance. */
function pixelsPerMetre(view) {
  return view.renderer.domElement.height / (2 * Math.tan(view.camera.fov * Math.PI / 360));
}

const rand = (a, b) => a + Math.random() * (b - a);
function onSphere() {
  const z = rand(-1, 1), a = rand(0, 2 * Math.PI), r = Math.sqrt(1 - z * z);
  return { x: r * Math.cos(a), y: z, z: r * Math.sin(a) };
}
const along = (p, d, k) => ({ x: p.x + d.x * k, y: p.y + d.y * k, z: p.z + d.z * k });
