// render/exits.js — how a die leaves the table (owner 2026-10-25): the effect that plays each entry of
// THE exit registry, render/exit-table.js. EXITS[name] = { label, seconds, start }; DiceView.removeDie
// and clear() take an exit by name and call start({ view, entry }) on the die leaving, then step(u, dt)
// every frame (u 0 … 1 over the exit's seconds) and dispose() at the end. Adding an exit is an entry in
// the table and a start function here.
//
//   burn   Burn out: the die heats evenly from red to yellow (the die shader: render/exit-shader.js),
//          holds a moment and fades off, throwing slow wandering cinders and the Smoke puff's smoke and a
//          warm light on the floor, and leaves a charred stain that fades last
//   smoke  Smoke puff: the die swells a little and blinks out inside a puff of smoke, with faerie
//          fire — bright, many-coloured sparks — swirling up out of it
//   none   None: the die goes at once
//   fade   Fade: the die fades out, its shadow with it
//   scurry Scurry off: it grows eight spider legs in its own colour, knobbed at the knees, stands up on
//          them and runs out of frame
//   pit    Going down: a hole opens under the die, which tips and falls through it at once (cut at
//          the floor, darkening at the rim), and the hole closes the moment it is through
//
// Effects only draw: nothing here touches the physics, and the timings are the table's.

import * as THREE from 'three';
import { EXIT_TABLE, burnTimeline, smokeTimeline, pitTimeline, fadeTimeline, scurryTimeline } from './exit-table.js';
import { EXIT_CLIP_OFF, EXIT_VERTEX_PARS, EXIT_VERTEX, EXIT_DEPTH_PARS, EXIT_DEPTH } from './exit-shader.js';
import { PATTERN_GLSL } from './patterns.js';
import { createParticles } from './particles.js';

const STARTS = { none: startNone, burn: startBurn, smoke: startSmoke, pit: startPit, fade: startFade, scurry: startScurry };

export const EXITS = Object.fromEntries(Object.entries(EXIT_TABLE).map(([key, entry]) => {
  if (!STARTS[key]) throw new Error('render/exits.js: the exit "' + key + '" has no effect to play it');
  return [key, { ...entry, start: STARTS[key] }];
}));

// ---------------------------------------------------------------- burn out
const EMBER = { rate: 70, colour: [[3.0, 1.4, 0.35], [0.8, 0.08, 0.0]] };   // half the first pass's 140 (art direction 2026-10-25)
const BURN_SMOKE = { rate: 16 };   // puffs a second as it burns: the Smoke puff's smoke, where the ash was (round 4)

function startBurn({ view, entry }) {
  const m = entry.mesh.material, uniforms = m.userData.dice.uniforms;
  const R = entry.die.boundingRadius, centre = entry.mesh.position.clone();
  m.transparent = true;   // it fades off at the end (round 5); one compile per finish, now rather than mid-burn
  m.needsUpdate = true;
  entry.mesh.customDepthMaterial = exitDepthMaterial(uniforms);   // its shadow fades with it
  const embers = createParticles({ max: 220, look: 'glow' });
  const smoke = createParticles({ max: 40, look: 'smoke' });
  const stain = floorDisc(view, centre, R * 1.5, STAIN_FRAGMENT, { blending: THREE.NormalBlending, order: 1 });
  const glow = floorDisc(view, centre, R * 3.2, GLOW_FRAGMENT, { blending: THREE.AdditiveBlending, order: 2 });
  view.scene.add(embers.points, smoke.points);
  let emberDue = 0, smokeDue = 0;
  return {
    step(u, dt) {
      const t = burnTimeline(u);
      uniforms.uExitHeat.value = t.heat;
      m.opacity = t.opacity;
      uniforms.uExitFade.value = t.opacity;
      glow.set(t.glow);
      stain.set(t.stain);
      for (emberDue += t.embers * EMBER.rate * dt; emberDue >= 1; emberDue--) {
        const s = onSphere();
        embers.emit({
          position: along(centre, s, R * 0.7),
          velocity: { x: s.x * 0.0125 + rand(-0.01, 0.01), y: rand(0.015, 0.04), z: s.z * 0.0125 + rand(-0.01, 0.01) },
          life: rand(0.4, 0.9), size: [rand(0.0012, 0.0024), 0.0006], colour: EMBER.colour, alpha: [1, 0],
          drag: 1.2, lift: 0.02, wander: rand(0.125, 0.225), twinkle: 0.4,   // never straight up; half speed (round 3)
        });
      }
      for (smokeDue += t.smoke * BURN_SMOKE.rate * dt; smokeDue >= 1; smokeDue--) {
        smoke.emit({
          position: along(centre, onSphere(), R * 0.5),
          velocity: { x: rand(-0.005, 0.005), y: rand(0.01, 0.02), z: rand(-0.005, 0.005) },
          life: rand(0.8, 1.0), size: [R * rand(0.6, 0.9), R * rand(1.6, 2.2)], colour: SMOKE.colour, alpha: [0.5, 0],
          drag: 1.5, lift: 0.015, wander: rand(0.025, 0.05),   // round 5: "smoke is too fast" — half of round 4's
        });
      }
      const ppm = pixelsPerMetre(view);
      embers.update(dt, ppm);
      smoke.update(dt, ppm);
    },
    dispose() {
      embers.dispose();
      smoke.dispose();
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

// ---------------------------------------------------------------- none
function startNone() {
  return { step() {}, dispose() {} };
}

// ---------------------------------------------------------------- fade
function startFade({ entry }) {
  const m = entry.mesh.material, uniforms = m.userData.dice.uniforms;
  m.transparent = true;    // one compile per finish, on its first fade; the die is freed after
  m.depthWrite = false;
  m.needsUpdate = true;
  entry.mesh.customDepthMaterial = exitDepthMaterial(uniforms);   // its shadow fades with it
  return {
    step(u) {
      const o = fadeTimeline(u).opacity;
      m.opacity = o;
      uniforms.uExitFade.value = o;
    },
    dispose() { entry.mesh.customDepthMaterial.dispose(); },
  };
}

// ---------------------------------------------------------------- scurry off
// Eight legs, four a side, fanned from the heading (degrees): two forward, two back. Lengths in die radii.
const LEG = {
  angles: [40, 75, 105, 140, -40, -75, -105, -140],
  group: [0, 1, 0, 1, 1, 0, 1, 0],   // the alternating tetrapod gait: one group steps while the other stands
  // Round 5: every length half again as long (the femur was 1.25, the tibia 1.45, the reach 1.9, the step
  // 0.8, the lift 0.5); a knob at each knee, `knob` times the leg's thickness.
  thick: 0.06, femur: 1.875, tibia: 2.175, hip: 0.5, reach: 2.85, step: 1.2, lift: 0.75, knob: 1.9,
};

function startScurry({ view, entry }) {
  const R = entry.die.boundingRadius, mesh = entry.mesh, centre = mesh.position.clone();
  const dir = towardNearestEdge(view, centre);
  const distance = distanceOutOfFrame(view, centre, dir, R * (LEG.reach + 1.2));
  const up = new THREE.Vector3(0, 1, 0), side = new THREE.Vector3().crossVectors(up, dir);
  const outward = LEG.angles.map((deg) => {
    const a = deg * Math.PI / 180;
    return dir.clone().multiplyScalar(Math.cos(a)).addScaledVector(side, Math.sin(a));
  });
  const geometry = new THREE.CylinderGeometry(1, 0.6, 1, 6);
  // The legs are the die's own colour (round 5: "match the leg color to the die color").
  const material = new THREE.MeshStandardMaterial({ color: mesh.material.color.clone(), roughness: 0.45, metalness: 0.1 });
  const ball = new THREE.SphereGeometry(1, 12, 8);
  const segment = (r) => { const s = new THREE.Mesh(geometry, material); s.castShadow = true; s.userData.r = r; view.scene.add(s); return s; };
  const knob = () => { const k = new THREE.Mesh(ball, material); k.castShadow = true; k.scale.setScalar(LEG.thick * LEG.knob * R); view.scene.add(k); return k; };
  const legs = outward.map((o, i) => ({ o, group: LEG.group[i], femur: segment(LEG.thick * R), tibia: segment(LEG.thick * R * 0.7), knob: knob(), foot: null, swing: null }));
  let active = 0, last = 0, bob = 0;
  const body = new THREE.Vector3(), hip = new THREE.Vector3(), rest = new THREE.Vector3(), knee = new THREE.Vector3();
  return {
    step(u, dt) {
      const t = scurryTimeline(u, R);
      const along = t.travel * distance, speed = dt > 0 ? (along - last) / dt : 0;
      last = along;
      bob += dt * 22;
      body.copy(centre).addScaledVector(dir, along);
      body.y = centre.y + t.ride + (speed > 0.001 ? Math.sin(bob) * 0.06 * R : 0);
      mesh.position.copy(body);
      const stride = Math.max(LEG.step * R, speed * 0.1), swingTime = Math.min(0.1, Math.max(0.035, stride / Math.max(speed, 1e-6) / 2));
      // Which group steps: the other once every foot of this one is down and none needs to step.
      const moving = (g) => legs.some((l) => l.group === g && l.swing);
      for (const l of legs) {
        hip.copy(body).addScaledVector(l.o, LEG.hip * R * t.legs);
        hip.y = body.y + 0.1 * R;
        rest.copy(body).addScaledVector(l.o, LEG.reach * R * t.legs).addScaledVector(dir, stride * 0.5);
        rest.y = 0;
        if (t.legs < 1 || !l.foot) { l.foot = (l.foot || new THREE.Vector3()).copy(rest); l.foot.y = 0; }
        else if (l.swing) {
          l.swing.s = Math.min(1, l.swing.s + dt / l.swing.time);
          l.foot.lerpVectors(l.swing.from, l.swing.to, l.swing.s);
          l.foot.y = Math.sin(Math.PI * l.swing.s) * LEG.lift * R;
          if (l.swing.s >= 1) { l.foot.y = 0; l.swing = null; }
        } else if (l.group === active && l.foot.distanceTo(rest) > stride * 0.5) {
          l.swing = { from: l.foot.clone(), to: rest.clone().addScaledVector(dir, speed * swingTime), s: 0, time: swingTime };
        }
        placeLeg(l, hip, l.foot, R * t.legs, knee);
      }
      if (!moving(active)) active = 1 - active;
    },
    dispose() {
      for (const l of legs) { l.femur.removeFromParent(); l.tibia.removeFromParent(); l.knob.removeFromParent(); }
      geometry.dispose();
      ball.dispose();
      material.dispose();
    },
  };
}

/** Two-bone legs: the knee bends up and out, found from the hip, the foot and the segment lengths. */
function placeLeg(l, hip, foot, scale, knee) {
  const L1 = LEG.femur * scale, L2 = LEG.tibia * scale;
  if (!(L1 > 1e-6)) { l.femur.visible = l.tibia.visible = l.knob.visible = false; return; }
  l.femur.visible = l.tibia.visible = l.knob.visible = true;
  const d = foot.clone().sub(hip);
  const len = Math.min(Math.max(d.length(), Math.abs(L1 - L2) + 1e-6), (L1 + L2) * 0.999);
  d.normalize();
  const cosA = (L1 * L1 + len * len - L2 * L2) / (2 * L1 * len), sinA = Math.sqrt(Math.max(0, 1 - cosA * cosA));
  const pole = new THREE.Vector3(0, 1, 0).addScaledVector(d, -d.y).normalize();
  knee.copy(hip).addScaledVector(d, L1 * cosA).addScaledVector(pole, L1 * sinA);
  const end = hip.clone().addScaledVector(d, len);
  placeSegment(l.femur, hip, knee);
  placeSegment(l.tibia, knee, end);
  l.knob.position.copy(knee);
  l.knob.scale.setScalar(LEG.thick * LEG.knob * scale);
}

const Y = new THREE.Vector3(0, 1, 0);
function placeSegment(s, a, b) {
  const v = b.clone().sub(a), len = v.length();
  s.position.copy(a).addScaledVector(v, 0.5);
  s.quaternion.setFromUnitVectors(Y, v.multiplyScalar(1 / Math.max(len, 1e-9)));
  s.scale.set(s.userData.r, len, s.userData.r);
}

/** The floor direction that carries a point at `p` toward the screen edge nearest it. */
function towardNearestEdge(view, p) {
  const cam = view.camera, ndc = p.clone().project(cam);
  const ways = [[1 - ndc.x, 1, 0], [1 + ndc.x, -1, 0], [1 - ndc.y, 0, 1], [1 + ndc.y, 0, -1]].sort((a, b) => a[0] - b[0]);
  const [, sx, sy] = ways[0];
  const there = new THREE.Vector3(ndc.x + sx * 0.05, ndc.y + sy * 0.05, ndc.z).unproject(cam);
  const ray = there.sub(cam.position), k = (p.y - cam.position.y) / ray.y;
  const hit = cam.position.clone().addScaledVector(ray, k);
  const dir = new THREE.Vector3(hit.x - p.x, 0, hit.z - p.z);
  return dir.lengthSq() > 1e-12 ? dir.normalize() : new THREE.Vector3(1, 0, 0);
}

/** How far along `dir` a thing of radius `r` at `p` must go before no part of it is on screen. */
function distanceOutOfFrame(view, p, dir, r) {
  const cam = view.camera, q = new THREE.Vector3(), probe = new THREE.Vector3();
  const offsets = [[r, 0, 0], [-r, 0, 0], [0, 0, r], [0, 0, -r], [0, r, 0]];
  for (let d = 0; d < 3; d += r * 0.5) {
    q.copy(p).addScaledVector(dir, d);
    const gone = offsets.every(([x, y, z]) => {
      probe.set(q.x + x, q.y + y, q.z + z).project(cam);
      return Math.abs(probe.x) > 1 || Math.abs(probe.y) > 1 || probe.z > 1;
    });
    if (gone) return d;
  }
  return 3;
}

// ---------------------------------------------------------------- shared pieces
/** A shadow's depth material for a leaving die: the same cut and burn-through as the die (exit-shader.js). */
function exitDepthMaterial(u) {
  const m = new THREE.MeshDepthMaterial();
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, { uScale: u.uScale, uSeed: u.uSeed, uExitDissolve: u.uExitDissolve, uExitClipY: u.uExitClipY, uExitFade: u.uExitFade });
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
// A hole: black, its edge soft. (Round 5 removed its faint violet rim — "we can bring it back if we
// miss it": the rim was exp( -pow( ( r - 0.86 ) / 0.06, 2.0 ) ) * 0.35 of vec3( 0.45, 0.2, 0.75 ).)
const HOLE_FRAGMENT = /* glsl */ `
uniform float uAmount;
varying vec2 vUv;
void main() {
  float r = length( vUv - 0.5 ) * 2.0;
  if ( r > 1.0 ) discard;
  float core = 1.0 - smoothstep( 0.62, 0.95, r );
  gl_FragColor = vec4( 0.0, 0.0, 0.0, core );
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
