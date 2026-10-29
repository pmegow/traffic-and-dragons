// render/exits.js — how a die leaves the table (owner 2026-10-25): the effect that plays each entry of
// THE exit registry, render/exit-table.js. EXITS[name] = { label, seconds, start }; DiceView.removeDie
// and clear() take an exit by name and call start({ view, entry }) on the die leaving, then step(u, dt)
// every frame (u 0 … 1 over the exit's seconds) and dispose() at the end. Adding an exit is an entry in
// the table and a start function here.
//
//   burn   Burn out: the die heats evenly from red to yellow (the die shader: render/exit-shader.js),
//          holds a moment and fades off, throwing slow wandering cinders and the Smoke puff's smoke and a
//          warm light on the floor, and leaves a charred stain that fades last; a sizzle rises as it heats
//          and it cracks as it starts to fade (sound('sizzle'), sound('crack'))
//   smoke  Smoke puff: the die swells a little and blinks out inside a puff of smoke, with faerie
//          fire — bright, many-coloured sparks — swirling up out of it, with a puff of air (sound('puff'))
//   none   None: the die goes at once
//   fade   Fade: the die fades out, its shadow with it, on a gentle breeze (sound('breeze'))
//   scurry Scurry off: eight spider legs grow out of it — coxa, femur, knee, tibia, metatarsus and a
//          tapering tarsus, in its own material, the knuckles in its numerals' — it stands up on them
//          and runs out of frame, each foot heard as it touches the floor (sound('step', …))
//   pit    Going down: a faint glow grows on the floor, heralding it, then a hole opens under the die onto an
//          orange glow far down the pit, which lights the
//          die from beneath and sends cinders up, crackling (sound('crackle'), from the start, rising as it opens); the die has risen and hovers,
//          bobbing gently and turning slowly, before it opens and for a while after, then is sucked down through it, stretching as it goes (cut at the floor),
//          the hole's sharp red ring round it, and the hole snaps shut behind it with a crack and a soft puff of
//          dark smoke (sound('crack'), burn out's; sound('softPuff'))
//   shatter Shatter: cracks run over the die from its top along the very lines it will break on, with a crack
//          (sound('crack')); then it breaks into 8 ± 2 Voronoi pieces (render/fracture.js), sharply
//          (sound('shatter')), which burst away spinning, fall and tumble to rest on the floor
//          (render/shards.js), each strike a small click (sound('shard', …)), and fade
//   melt   Melt: the die goes soft and trembles, cracking along the lines it will part on; it comes apart into soft
//          lumps that fall away, goo stretching between them (render/goo.js), and each jiggles as it lands and melts
//          into a glossy blob; the blobs run together into a puddle, which holes eat away until it has gone
//          (render/holes.js), a low sizzle under it all (sound('melt'))
//   random Random: one of the others, picked for each die as it leaves (chooseExit)
//
// Effects only draw: nothing here touches the physics, and the timings are the table's. A sound an effect
// makes it reports through start's `sound(kind, position, strength)`; the host plays it (DiceView ▸
// removeDie's onSound).

import * as THREE from 'three';
import { EXIT_TABLE, SCURRY, BURN, PIT, SHATTER, MELT, meltTimeline, meltPiece, meltJiggle, burnTimeline, smokeTimeline, pitTimeline, fadeTimeline, shatterTimeline, scurryTimeline, sproutSchedule, legGrown, scurryWander } from './exit-table.js';
import { fractureSeeds, fracturePieces, pieceCount } from './fracture.js';
import { burstShards, stepShards, rotate } from './shards.js';
import { meltRel, fallApart, strandsBetween, strandTubes, writeTube, tubeIndices, TUBE_VERTICES } from './goo.js';
import { holePlan, holesAt } from './holes.js';
import { subdividePasses } from './subdivide.js';
import { blankUV } from './die-mesh.js';
import { EXIT_CLIP_OFF, EXIT_VERTEX_PARS, EXIT_VERTEX, EXIT_DEPTH_PARS, EXIT_DEPTH } from './exit-shader.js';
import { PATTERN_GLSL, PATTERN_SCALE } from './patterns.js';
import { dieMaterial, FINISHES } from './finishes.js';
import { createParticles } from './particles.js';

const STARTS = { none: startNone, burn: startBurn, smoke: startSmoke, pit: startPit, fade: startFade, scurry: startScurry, shatter: startShatter, melt: startMelt };

// Random (round 12) plays nothing itself: the view asks chooseExit for one of the others as each die leaves.
export const EXITS = Object.fromEntries(Object.entries(EXIT_TABLE).map(([key, entry]) => {
  if (entry.random) return [key, entry];
  if (!STARTS[key]) throw new Error('render/exits.js: the exit "' + key + '" has no effect to play it');
  return [key, { ...entry, start: STARTS[key] }];
}));

// ---------------------------------------------------------------- burn out
const EMBER = { rate: 70, colour: [[3.0, 1.4, 0.35], [0.8, 0.08, 0.0]] };   // half the first pass's 140 (art direction 2026-10-25)
const BURN_SMOKE = { rate: 16 };
// Round 10: unstable as it reaches yellow — it shakes up to BURN_SHAKE of its radius and its opacity
// flickers down by up to BURN_FLICKER, every frame, as it dematerializes.
const BURN_SHAKE = 0.035, BURN_FLICKER = 0.3;   // puffs a second as it burns: the Smoke puff's smoke, where the ash was (round 4)

function startBurn({ view, entry, sound = () => {} }) {
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
  let emberDue = 0, smokeDue = 0, cracked = false;
  sound('sizzle', centre);   // it rises by its own envelope, timed to the heat (audio/plan.js ▸ EXIT_SOUNDS)
  return {
    step(u, dt) {
      const t = burnTimeline(u);
      if (t.fading && !cracked) { cracked = true; sound('crack', centre); }
      uniforms.uExitHeat.value = t.heat;
      m.opacity = t.opacity * (1 - BURN_FLICKER * t.unstable * Math.random());
      const shake = t.unstable * BURN_SHAKE * R;
      entry.mesh.position.set(centre.x + shake * rand(-1, 1), centre.y + shake * rand(-1, 1), centre.z + shake * rand(-1, 1));
      // Once it fades it must stop writing depth, or the smoke and cinders behind it are cut out by an
      // invisible die: on glass and quartz a die-shaped ghost, and with no tray a hole in the canvas
      // (owner 2026-10-25: "burn out doesn't seem to be working with translucent or transparent").
      m.depthWrite = t.opacity >= 1 && !t.unstable;
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

function startSmoke({ view, entry, sound = () => {} }) {
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
        sound('puff', centre);
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
// Round 16 (owner 2026-10-27: "Lose the flames. Add gentle cinders coming up from the hole. They can match the
// ones from burn out, but have a slightly more upward motion. Add a flickering orange glow coming from down in
// the pit where the cinders are coming from"): an orange glow far down the hole (HOLE_FRAGMENT), its light on
// the die from beneath (the die shader's uExitUnder) and on the floor round the rim, all flickering together,
// and burn out's cinders rising out of it, straighter up. Round 14's tongues of flame are gone.
const HELL = {
  cinders: 45,     // a second with the pit wide open (burn out throws 70)
  // Round 17 (owner 2026-10-27: "shift the glow in the pit forward, right now it's centered, it should make the
  // pit feel deeper"): seen at a slant, the floor of a deep shaft shows toward the near rim, so the glow sits
  // toward the camera by `deep` times the slant (horizontal over height), at most `shiftMax` of the hole's radius.
  deep: 0.55,
  shiftMax: 0.45,
  flicker: 0.35,   // how far the light dips, at most
  under: 1,        // the die's light from below at full glow
  floor: 0.6,      // the floor's glow round the rim at full glow
  // Round 24: the herald's pool on the floor, as a multiple of its light on the die, so the pool reaches the open
  // pit's own just as the hole opens (at the herald's half it could hardly be seen).
  heraldPool: 2,
};
// The pit's last breath: a few puffs of dark smoke, the Smoke puff's look in soot.
const PIT_SMOKE = { puffs: 10, colour: [[0.1, 0.09, 0.09], [0.04, 0.04, 0.04]] };
const UP = new THREE.Vector3(0, 1, 0);

function startPit({ view, entry, sound = () => {} }) {
  const uniforms = entry.mesh.material.userData.dice.uniforms;
  const R = entry.die.boundingRadius, mesh = entry.mesh, centre = mesh.position.clone(), turn0 = mesh.quaternion.clone();
  uniforms.uExitClipY.value = 0;   // nothing of it below the floor shows: it is in the hole
  mesh.customDepthMaterial = exitDepthMaterial(uniforms);
  const glow = floorDisc(view, centre, R * 3.5, HELL_GLOW_FRAGMENT, { blending: THREE.AdditiveBlending, order: 1 });
  const hole = floorDisc(view, centre, R * 1.4, HOLE_FRAGMENT, { blending: THREE.NormalBlending, scales: true, order: 2 });
  const cinders = createParticles({ max: 120, look: 'glow' });
  const smoke = createParticles({ max: PIT_SMOKE.puffs, look: 'smoke' });
  view.scene.add(cinders.points, smoke.points);
  // Its real highest point at rest, not its bounding sphere's: it stretches from there, and pitTimeline's rise
  // is the height that makes rise + R this top.
  mesh.updateMatrixWorld();
  const top = new THREE.Box3().setFromObject(mesh, true).max.y;
  // The stretch is along the world's vertical, not the die's own axes, so the effect writes the die's matrix.
  mesh.matrixAutoUpdate = false;
  const spin = new THREE.Quaternion(), hang = new THREE.Matrix4(), scale = new THREE.Matrix4(), back = new THREE.Matrix4();
  const phase = [rand(0, 2 * Math.PI), rand(0, 2 * Math.PI)];
  const look = new THREE.Vector3();
  sound('crackle', centre);   // round 21: from the start, silent, full once the portal is open (audio/plan.js ▸ EXIT_SOUNDS)
  let clock = 0, cinderDue = 0, puffed = false;
  return {
    step(u, dt) {
      clock += dt;
      const t = pitTimeline(u, R, top - R);
      // Firelight: two quick waves and a little noise, never below 1 - HELL.flicker.
      const flicker = 1 - HELL.flicker * (0.35 * (1 + Math.sin(clock * 29 + phase[0])) + 0.15 * (1 + Math.sin(clock * 47 + phase[1])) + 0.3 * Math.random()) / 1.3;
      hole.set(t.hole);
      hole.uniforms.uFire.value = t.fire * flicker;
      // The glow sits toward the camera, as the floor of a deep shaft does (its uv's y runs along the world's −z).
      look.copy(view.camera.position).sub(centre);
      const across = Math.hypot(look.x, look.z), slant = Math.min(HELL.shiftMax, HELL.deep * across / Math.max(look.y, 1e-6));
      hole.uniforms.uShift.value.set(across > 1e-9 ? look.x / across * slant : 0, across > 1e-9 ? -look.z / across * slant : 0);
      // Round 24: heralded, before it opens, by a faint glow (t.herald) on the floor and on the die from below.
      const light = Math.max(t.herald, t.fire), pool = Math.max(t.herald * HELL.heraldPool, t.fire);
      glow.set(pool * HELL.floor * flicker);
      uniforms.uExitUnder.value = light * HELL.under * flicker;
      // It rises, hovers turning slowly, then is pulled down, stretched along the pull from its top, its girth
      // narrowing to keep its volume.
      mesh.position.set(centre.x, centre.y + t.lift + t.bob - t.drop, centre.z);
      mesh.quaternion.copy(spin.setFromAxisAngle(UP, t.twist)).multiply(turn0);
      mesh.updateMatrix();
      const k = 1 + t.stretch, girth = 1 / Math.sqrt(k), from = top + t.lift + t.bob - t.drop;
      mesh.matrix.premultiply(hang.makeTranslation(centre.x, from, centre.z).multiply(scale.makeScale(girth, k, girth)).multiply(back.makeTranslation(-centre.x, -from, -centre.z)));
      mesh.matrixWorldNeedsUpdate = true;
      // Cinders rise from the glow far down, out of the open hole: round the die while it sits, from all of it
      // once it has gone; fewer and fewer as the hole shuts.
      for (cinderDue += t.fire * t.fire * HELL.cinders * dt; cinderDue >= 1; cinderDue--) {
        const a = rand(0, 2 * Math.PI), r = R * 1.2 * t.hole * Math.sqrt(Math.random());
        cinders.emit({
          position: { x: centre.x + r * Math.cos(a), y: 0.001, z: centre.z + r * Math.sin(a) },
          velocity: { x: rand(-0.006, 0.006), y: rand(0.025, 0.055), z: rand(-0.006, 0.006) },
          life: rand(0.7, 1.225), size: [rand(0.0012, 0.0024), 0.0006], colour: EMBER.colour, alpha: [1, 0],
          drag: 1.2, lift: 0.03, wander: rand(0.08, 0.15), twinkle: 0.4,   // burn out's embers, straighter up: less sideways, more rise; round 18: living 75% longer (was 0.4 … 0.7 s)
        });
      }
      // As it shuts, it breathes out a soft puff of dark smoke (round 17: "add a puff of dark smoke at the end with a
      // soft puff sound"), and cracks (round 20: "add a crack sound at the end (same one as burn out is great)").
      if (t.closed && !puffed) {
        puffed = true;
        sound('softPuff', centre);
        sound('crack', centre);   // burn out's crack, the same sound (audio/plan.js ▸ EXIT_SOUNDS.crack)
        for (let k = 0; k < PIT_SMOKE.puffs; k++) {
          const a = rand(0, 2 * Math.PI), r = R * rand(0, 0.5);
          smoke.emit({
            position: { x: centre.x + r * Math.cos(a), y: 0.002, z: centre.z + r * Math.sin(a) },
            velocity: { x: Math.cos(a) * rand(0.01, 0.03), y: rand(0.02, 0.04), z: Math.sin(a) * rand(0.01, 0.03) },
            life: rand(0.6, 0.9), size: [R * rand(0.7, 1.0), R * rand(1.6, 2.2)], colour: PIT_SMOKE.colour, alpha: [0.6, 0],
            drag: 3, lift: 0.02,
          });
        }
      }
      const ppm = pixelsPerMetre(view);
      cinders.update(dt, ppm);
      smoke.update(dt, ppm);
    },
    dispose() {
      hole.dispose();
      glow.dispose();
      cinders.dispose();
      smoke.dispose();
      mesh.matrixAutoUpdate = true;
      uniforms.uExitClipY.value = EXIT_CLIP_OFF;
      uniforms.uExitUnder.value = 0;
      mesh.customDepthMaterial.dispose();
    },
  };
}

// ---------------------------------------------------------------- none
function startNone() {
  return { step() {}, dispose() {} };
}

// ---------------------------------------------------------------- fade
function startFade({ entry, sound = () => {} }) {
  const m = entry.mesh.material, uniforms = m.userData.dice.uniforms;
  sound('breeze', entry.mesh.position.clone());   // round 16: it goes on a gentle breeze (audio/plan.js ▸ EXIT_SOUNDS)
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
// Eight legs, four a side, fanned from the heading (degrees): two forward, two back. Lengths in die radii;
// thicknesses in units of `thick` die radii.
/**
 * The scurry's gait, watched (a seam for the page and the tests): per leg, how many frames of its run its foot lay
 * beyond its leg's reach — the leg then drawn short of the foot, sliding after the body (owner 2026-10-29: "Every so
 * often, the back legs seem to drag") — and the farthest any foot got, as a share of the leg's length; `frames` is
 * every running frame, `steps` every step begun. Reset by hand.
 */
export const SCURRY_WATCH = { frames: 0, steps: 0, dragged: [0, 0, 0, 0, 0, 0, 0, 0], farthest: 0 };

const LEG = {
  angles: [40, 75, 105, 140, -40, -75, -105, -140],
  group: [0, 1, 0, 1, 1, 0, 1, 0],   // the alternating tetrapod gait: one group steps while the other stands
  // Round 5: every length half again as long. The two bones the knee is found from: the femur (hip to
  // knee) and the lower leg (knee to foot: tibia, metatarsus and tarsus).
  femur: 1.875, lower: 2.175,
  thick: 0.06, base: 0.25, hip: 0.6, reach: 2.85, step: 1.2, lift: 0.75,
  bow: 0.06,   // how far the lower leg bows out, a share of its length (the drawing's curve)
  front: [0, 4],   // the two front legs, which tap while it wonders (round 8)
  // A foot this share of the leg's length from the hip steps at once, whatever the gait says (owner 2026-10-29:
  // "Every so often, the back legs seem to drag"). The alternating gait waits for the other group's swing to end,
  // and a frame per flip besides; as it runs faster (the far end of a long path, x^1.3), turns, or a slow frame
  // (several spiders at once), a back foot left planted through that wait went past the leg's reach — the leg was
  // then drawn straight and short of its foot, sliding after the body: measured 7–59 frames of a run, a foot up
  // to twice the leg's length away. A run's stance never passes 0.83 of the reach (traced); the guard sits above it.
  guard: 0.85,
};

// A spider's leg, after the drawing the owner sent (round 7, 2026-10-25): a short thick coxa from the
// body, a long femur up to the knee, then the tibia, the metatarsus and a long tarsus tapering to a
// point at the floor. Each part's thickness where it starts (near) and where it ends (far).
const LEG_PARTS = [
  { name: 'coxa', near: 1.6, far: 1.35 },
  { name: 'femur', near: 1.3, far: 1.0 },
  { name: 'tibia', near: 0.95, far: 0.75 },
  { name: 'metatarsus', near: 0.7, far: 0.5 },
  { name: 'tarsus', near: 0.45, far: 0.08 },
];
const LOWER_JOINTS = [0.45, 0.78];   // where along the lower leg the tibia, metatarsus and tarsus meet
// The knobs at the joints (hip, knee, and the two lower joints), in thickness units; the knee's is the
// knuckle, in the die's numeral material (round 7: "make the knuckle material match the number material").
const JOINTS = [{ size: 1.45 }, { size: 1.9, knuckle: true }, { size: 0.85 }, { size: 0.6 }];

function startScurry({ view, entry, sound }) {
  const R = entry.die.boundingRadius, mesh = entry.mesh, centre = mesh.position.clone();
  const turn0 = mesh.quaternion.clone();
  const toward = towardNearestEdge(view, centre), heading0 = Math.atan2(toward.z, toward.x);
  const path = wanderingPath(view, centre, heading0, R);   // round 8: it wanders a little on its way out
  // A leg's way out from a body facing `heading` (radians, on the floor): fanned from it.
  const outward = (heading, i, out) => { const a = heading - LEG.angles[i] * Math.PI / 180; return out.set(Math.cos(a), 0, Math.sin(a)); };
  // The legs are the die's own material (round 7: "make sure the material of the leg matches the die's
  // material"): its finish, colour and pattern, with no numerals — the pattern at the die's grain round
  // the leg; the knuckles are all numeral. The same shader as the dice, so nothing compiles.
  const dice = mesh.material.userData.dice, finish = dice.finish;
  const style = { body: '#' + mesh.material.color.getHexString(), ink: '#' + dice.uniforms.uInk.value.getHexString() };
  const legMaterial = dieMaterial(finish, style, glyphOf(0), dice.seed, { radius: R, onTray: view.trayDrawn });
  legMaterial.userData.dice.uniforms.uScale.value = PATTERN_SCALE * LEG.thick * R;
  if (legMaterial.transmission > 0) legMaterial.thickness = 2 * LEG.thick * R * 1.4;   // glass as thin as the leg, or it tints black
  const knuckleMaterial = dieMaterial(finish, style, glyphOf(255), dice.seed, { radius: R, onTray: view.trayDrawn });
  const partGeometry = LEG_PARTS.map((p) => paintWhite(new THREE.CylinderGeometry(p.far, p.near, 1, 8, 1)));
  const ball = paintWhite(new THREE.SphereGeometry(1, 12, 8));
  const add = (geometry, material) => { const m = new THREE.Mesh(geometry, material); m.castShadow = true; view.scene.add(m); return m; };
  const schedule = sproutSchedule(LEG.angles.length);   // each leg grows on its own (rounds 8, 11)
  const legs = LEG.angles.map((deg, i) => ({
    index: i, o: new THREE.Vector3(), sprout: schedule[i], group: LEG.group[i], foot: null, swing: null,
    parts: partGeometry.map((g) => add(g, legMaterial)),
    knobs: JOINTS.map((j) => add(ball, j.knuckle ? knuckleMaterial : legMaterial)),
  }));
  let active = 0, last = 0, bob = 0;
  const body = new THREE.Vector3(), base = new THREE.Vector3(), hip = new THREE.Vector3(), rest = new THREE.Vector3();
  const home = new THREE.Vector3(), way = new THREE.Vector3(), sideways = new THREE.Vector3(), yaw = new THREE.Quaternion(), tilt = new THREE.Quaternion();
  return {
    step(u, dt) {
      const t = scurryTimeline(u, R);
      const along = t.travel * path.length, speed = dt > 0 ? (along - last) / dt : 0;
      last = along;
      bob += dt * 22;
      const at = path.at(along), heading = at.heading;
      body.set(at.x, centre.y + t.ride + (speed > 0.001 ? Math.sin(bob) * 0.06 * R : 0), at.z);
      mesh.position.copy(body);
      // The body turns with its heading as it runs, and as it looks about while it wonders (the hips turn
      // with it; the feet stay where they stand).
      const facing = heading + t.look;
      way.set(Math.cos(heading), 0, Math.sin(heading));
      // Round 9: as it takes off it leans into its run — the body tips forward along its heading (round 10:
      // turning about up × heading, so its top goes the way it runs; it tipped back).
      mesh.quaternion.copy(tilt.setFromAxisAngle(sideways.set(way.z, 0, -way.x), t.lean)).multiply(yaw.setFromAxisAngle(Y, heading0 - facing)).multiply(turn0);
      const stride = Math.max(LEG.step * R, speed * 0.1), swingTime = Math.min(0.1, Math.max(0.035, stride / Math.max(speed, 1e-6) / 2));
      const reach = (LEG.femur + LEG.lower) * R;   // the leg's full length, hip to foot (LEG.guard)
      // Which group steps: the other once every foot of this one is down and none needs to step.
      const moving = (g) => legs.some((l) => l.group === g && l.swing);
      for (const [i, l] of legs.entries()) {
        outward(facing, i, l.o);
        base.copy(body).addScaledVector(l.o, LEG.base * R);
        base.y = body.y + 0.05 * R;
        hip.copy(body).addScaledVector(l.o, LEG.hip * R);
        hip.y = body.y + 0.15 * R;
        if (!t.travel) {
          // Growing, then lifting: each foot has its spot on the floor from the start, and the leg grows
          // out of the die toward it along the pose it will stand in; the feet stay as the body lifts.
          if (!l.foot) { l.foot = centre.clone().addScaledVector(outward(heading0, i, home), LEG.reach * R); l.foot.y = 0; }
          const front = LEG.front.indexOf(i);   // while it wonders, a front foot taps
          l.foot.y = front < 0 ? 0 : t.tap[front] * SCURRY.tap * LEG.lift * R;
          // A foot touching the floor is heard (owner 2026-10-26): as its leg finishes growing, and as a
          // front foot comes down from a tap.
          if (l.tapping && l.foot.y === 0) sound('step', l.foot, 0.5);
          l.tapping = l.foot.y > 0;
          const grown = legGrown(t.legs, l.sprout);
          if (grown === 1 && !l.planted) { l.planted = true; sound('step', l.foot, 0.6); }
          placeLeg(l, base, hip, l.foot, R, grown);
          continue;
        }
        rest.copy(body).addScaledVector(outward(heading, i, home), LEG.reach * R).addScaledVector(way, stride * 0.5);
        rest.y = 0;
        if (l.swing) {
          l.swing.s = Math.min(1, l.swing.s + dt / l.swing.time);
          l.foot.lerpVectors(l.swing.from, l.swing.to, l.swing.s);
          l.foot.y = Math.sin(Math.PI * l.swing.s) * LEG.lift * R;
          if (l.swing.s >= 1) { l.foot.y = 0; l.swing = null; sound('step', l.foot, 1); }
        } else if ((l.group === active && l.foot.distanceTo(rest) > stride * 0.5) || l.foot.distanceTo(hip) > LEG.guard * reach) {
          l.swing = { from: l.foot.clone(), to: rest.clone().addScaledVector(way, speed * swingTime), s: 0, time: swingTime };
          SCURRY_WATCH.steps++;
        }
        placeLeg(l, base, hip, l.foot, R, 1);
      }
      if (t.travel) SCURRY_WATCH.frames++;
      if (!moving(active)) active = 1 - active;
    },
    dispose() {
      for (const l of legs) for (const m of [...l.parts, ...l.knobs]) m.removeFromParent();
      for (const g of partGeometry) g.dispose();
      ball.dispose();
      legMaterial.dispose();
      knuckleMaterial.dispose();
    },
  };
}

/**
 * One leg: the knee from the hip, the foot and the two bones (it bends up and out); the lower leg bowing
 * out a little through its two joints; then each part drawn in turn — the coxa from the body, the femur,
 * the tibia, the metatarsus, the tarsus — as far as the leg has grown (grown < 1 while it grows), each
 * joint's knob swelling as the leg reaches it.
 */
const part = new THREE.Vector3(), knee = new THREE.Vector3(), end = new THREE.Vector3(), bowOut = new THREE.Vector3();
const lowerPoints = LOWER_JOINTS.map(() => new THREE.Vector3());
function placeLeg(l, base, hip, foot, R, grown) {
  const L1 = LEG.femur * R, L2 = LEG.lower * R;
  const d = foot.clone().sub(hip);
  const len = Math.min(Math.max(d.length(), Math.abs(L1 - L2) + 1e-6), (L1 + L2) * 0.999);
  if (grown === 1) {   // running: a foot beyond the leg's reach is a dragged leg (SCURRY_WATCH)
    const share = d.length() / (L1 + L2);
    if (share > SCURRY_WATCH.farthest) SCURRY_WATCH.farthest = share;
    if (share > 0.999) SCURRY_WATCH.dragged[l.index]++;
  }
  d.normalize();
  const cosA = (L1 * L1 + len * len - L2 * L2) / (2 * L1 * len), sinA = Math.sqrt(Math.max(0, 1 - cosA * cosA));
  const pole = new THREE.Vector3(0, 1, 0).addScaledVector(d, -d.y).normalize();
  knee.copy(hip).addScaledVector(d, L1 * cosA).addScaledVector(pole, L1 * sinA);
  end.copy(hip).addScaledVector(d, len);
  const down = end.clone().sub(knee).normalize();
  bowOut.set(0, 1, 0).addScaledVector(down, -down.y).normalize();
  LOWER_JOINTS.forEach((s, k) => lowerPoints[k].lerpVectors(knee, end, s).addScaledVector(bowOut, LEG.bow * L2 * Math.sin(Math.PI * s)));
  const points = [base, hip, knee, ...lowerPoints, end];
  const lengths = points.slice(1).map((p, k) => p.distanceTo(points[k]));
  let left = grown * lengths.reduce((a, b) => a + b, 0), reached = 0;
  l.parts.forEach((m, k) => {
    const a = points[k], b = points[k + 1], len = lengths[k];
    m.visible = left > 1e-9;
    if (m.visible) {
      const drawnTo = part.lerpVectors(a, b, Math.min(1, left / len));
      placeSegment(m, a, drawnTo, LEG.thick * R);
    }
    left -= len;
    reached += len;
    const knob = l.knobs[k];
    if (knob) {   // the joint at the end of this part, swelling as the leg reaches it
      const swell = Math.min(1, Math.max(0, (left + 0.04 * L2) / (0.12 * L2)));
      knob.visible = swell > 0;
      knob.position.copy(b);
      knob.scale.setScalar(JOINTS[k].size * LEG.thick * R * swell);
    }
  });
}

const Y = new THREE.Vector3(0, 1, 0);
function placeSegment(s, a, b, r) {
  const v = b.clone().sub(a), len = v.length();
  s.position.copy(a).addScaledVector(v, 0.5);
  s.quaternion.setFromUnitVectors(Y, v.multiplyScalar(1 / Math.max(len, 1e-9)));
  s.scale.set(r, Math.max(len, 1e-6), r);
}

/** The die material colours by vertex (its dimming); a leg's geometry is all white, so it draws its own colour. */
function paintWhite(g) {
  g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 3).fill(1), 3));
  return g;
}

/** A one-texel numeral mask: 0, no numeral anywhere (the body); 255, numeral everywhere (the ink). */
const GLYPHS = new Map();
function glyphOf(v) {
  if (!GLYPHS.has(v)) {
    const t = new THREE.DataTexture(new Uint8Array([v, v, v, 255]), 1, 1);
    t.needsUpdate = true;
    GLYPHS.set(v, t);   // two tiny textures, kept for the page's life
  }
  return GLYPHS.get(v);
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

/** True when no part of a thing of radius `r` at `q` is on screen. */
const probe = new THREE.Vector3();
function offScreen(view, q, r) {
  return [[r, 0, 0], [-r, 0, 0], [0, 0, r], [0, 0, -r], [0, r, 0]].every(([x, y, z]) => {
    probe.set(q.x + x, q.y + y, q.z + z).project(view.camera);
    return Math.abs(probe.x) > 1 || Math.abs(probe.y) > 1 || probe.z > 1;
  });
}

/**
 * The way out (round 8: "noise in their path so they change directions slightly as they go"): from
 * `centre`, heading first for the nearest edge (heading0: radians on the floor) and wandering off it a
 * little as it goes (scurryWander), in steps of a quarter radius, until no part of the spider is on
 * screen. at(s): the point and the heading `s` metres along it.
 */
function wanderingPath(view, centre, heading0, R) {
  const phase = [Math.random() * 2 * Math.PI, Math.random() * 2 * Math.PI];
  const ds = R * 0.25, r = R * (LEG.reach + 1.2), q = new THREE.Vector3();
  const points = [{ x: centre.x, z: centre.z, heading: heading0 }];
  while (points.length < 4000) {
    const p = points[points.length - 1], heading = heading0 + scurryWander((points.length - 1) * ds, R, phase);
    const next = { x: p.x + Math.cos(heading) * ds, z: p.z + Math.sin(heading) * ds, heading };
    points.push(next);
    if (offScreen(view, q.set(next.x, centre.y, next.z), r)) break;
  }
  return {
    length: (points.length - 1) * ds,
    at(s) {
      const f = Math.min(Math.max(s / ds, 0), points.length - 1), k = Math.min(Math.floor(f), points.length - 2), w = f - k;
      const a = points[k], b = points[k + 1];
      return { x: a.x + (b.x - a.x) * w, z: a.z + (b.z - a.z) * w, heading: b.heading };
    },
  };
}

// ---------------------------------------------------------------- shatter
// Owner 2026-10-27: "Yes start the shatter ... Let's start with 10 pieces +-3. Take the idea all the way to a play
// test." Its seeds are drawn as it starts, so its cracks run along the lines it will break on; it is cut into its
// pieces (render/fracture.js) a few a frame while they run, so no frame stalls; the pieces share its material, kept
// in its own space, so its veins run on through every break.
function startShatter({ view, entry, sound = () => {} }) {
  const mesh = entry.mesh, m = mesh.material, uniforms = m.userData.dice.uniforms, R = entry.die.boundingRadius;
  m.transparent = true;   // the pieces fade at the end: one compile per finish (warmed ahead), now rather than then
  m.needsUpdate = true;
  const g = mesh.geometry, at = g.attributes, colours = at.color.array;
  let dim = 1;
  for (let i = 0; i < colours.length; i++) dim = Math.min(dim, colours[i]);   // a broken face is as dim as the die's
  const seeds = fractureSeeds(entry.die.core, pieceCount());
  const cutting = fracturePieces({ position: at.position.array, normal: at.normal.array, uv: at.uv.array, color: colours }, seeds,
    { innerUV: blankUV(g.userData.layout), innerColor: dim });
  // The cracks run from its highest point, along the boundaries between the cells.
  mesh.updateMatrixWorld();
  const top = highestPoint(mesh), topWorld = top.clone().applyMatrix4(mesh.matrixWorld);
  uniforms.uExitCrackFrom.value.copy(top);
  seeds.forEach((s, k) => uniforms.uExitSeeds.value[k].set(s[0], s[1], s[2]));
  uniforms.uExitSeedCount.value = seeds.length;
  const depth = exitDepthMaterial(uniforms);   // their shadows fade with them
  const cut = [], shards = [];
  const addShard = (c) => {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(c.position, 3));
    geometry.setAttribute('normal', new THREE.BufferAttribute(c.normal, 3));
    geometry.setAttribute('uv', new THREE.BufferAttribute(c.uv, 2));
    geometry.setAttribute('color', new THREE.BufferAttribute(c.color, 3));
    geometry.computeBoundingSphere();
    const s = new THREE.Mesh(geometry, m);
    s.castShadow = mesh.castShadow;
    s.receiveShadow = mesh.receiveShadow;
    s.renderOrder = mesh.renderOrder;
    s.customDepthMaterial = depth;
    s.matrixAutoUpdate = false;   // its pose is the motion's (render/shards.js), turned about its own centroid
    s.visible = false;
    view.scene.add(s);
    cut.push(c);
    shards.push(s);
  };
  // Cuts pieces until `ms` have gone (at least one); true once every piece is cut.
  let whole = true;
  const cutFor = (ms) => {
    const t0 = performance.now();
    while (whole) {
      const next = cutting.next();
      if (next.done) whole = false;
      else addShard(next.value);
      if (performance.now() - t0 >= ms) break;
    }
    return !whole;
  };
  const at3 = new THREE.Vector3(), turn = new THREE.Quaternion(), back = new THREE.Matrix4(), ONE = new THREE.Vector3(1, 1, 1);
  let states = null, cracking = false;
  return {
    step(u, dt) {
      const t = shatterTimeline(u);
      if (!cracking) { cracking = true; sound('crack', topWorld); }
      if (!t.broken) { uniforms.uExitCrack.value = t.crack * SHATTER.reach * R; cutFor(SHATTER.cutBudget); return; }
      if (!states) {
        cutFor(Infinity);   // whatever the cracks left uncut (a frame that ran long)
        uniforms.uExitCrack.value = 0;
        mesh.visible = false;
        states = burstShards(cut, { position: mesh.position.toArray(), quaternion: mesh.quaternion.toArray() });
        for (const s of shards) s.visible = true;
        sound('shatter', mesh.position.clone());
      }
      stepShards(states, dt, (s, point, speed) => sound('shard', new THREE.Vector3(point[0], point[1], point[2]), Math.min(1, speed / SHATTER.loudHit)));
      states.forEach((s, k) => {
        const c = cut[k].centroid;
        shards[k].matrix.compose(at3.set(s.x[0], s.x[1], s.x[2]), turn.set(s.q[0], s.q[1], s.q[2], s.q[3]), ONE).multiply(back.makeTranslation(-c[0], -c[1], -c[2]));
        shards[k].matrixWorldNeedsUpdate = true;
      });
      m.opacity = t.opacity;
      uniforms.uExitFade.value = t.opacity;
    },
    dispose() {
      for (const s of shards) { view.scene.remove(s); s.geometry.dispose(); }
      depth.dispose();
      uniforms.uExitCrack.value = 0;
      uniforms.uExitSeedCount.value = 0;
    },
  };
}

// ---------------------------------------------------------------- melt
// Round 2 (owner 2026-10-28: "break into gooey parts that form a puddle, then the puddle is eaten away by expanding
// holes"; round 1 slumped the whole die, and "reads as just the die scaling flat"). The die trembles and cracks along
// the lines it will part on (Shatter's cracks) while it is cut (render/fracture.js) and split finer (render/subdivide.js),
// a few milliseconds a frame; then it comes apart into soft lumps that fall away (render/shards.js with Melt's motion;
// render/goo.js ▸ fallApart). Each lump is its own copy of the die's material — the same shader, so nothing compiles —
// and so melts on its own clock as it lands, in its vertex shader (render/exit-shader.js ▸ exitMelt), its shadow with
// it. The goo between them (render/goo.js) is one mesh whose shape is written each frame, stuck to the melting lumps by
// the same slump in JS (meltRel). The blobs run together into the puddle, which holes eat (render/holes.js) in every one
// of their shaders and shadows.
function startMelt({ view, entry, sound = () => {} }) {
  const mesh = entry.mesh, m = mesh.material, dice = m.userData.dice, uniforms = dice.uniforms, R = entry.die.boundingRadius;
  const centre = mesh.position.clone(), g = mesh.geometry, at = g.attributes, colours = at.color.array;
  let dim = 1;
  for (let i = 0; i < colours.length; i++) dim = Math.min(dim, colours[i]);   // a broken face is as dim as the die's
  const seeds = fractureSeeds(entry.die.core, pieceCount(Math.random, { pieces: MELT.pieces, spread: MELT.vary }));
  // It trembles about its centre on the floor, and cracks from its highest point along the lines it will part on.
  mesh.updateMatrixWorld();
  uniforms.uExitMeltAt.value.set(centre.x, 0, centre.z, R);
  uniforms.uExitMeltInverse.value.copy(mesh.matrixWorld).invert();
  uniforms.uExitCrackFrom.value.copy(highestPoint(mesh));
  seeds.forEach((s, k) => uniforms.uExitSeeds.value[k].set(s[0], s[1], s[2]));
  uniforms.uExitSeedCount.value = seeds.length;
  mesh.customDepthMaterial = exitDepthMaterial(uniforms);   // its shadow trembles with it
  // Every lump its own copy of the die's material, so each melts on its own; the goo the die's colour, unprinted. All
  // of them share one set of holes.
  const style = { body: '#' + m.color.getHexString(), ink: '#' + uniforms.uInk.value.getHexString() };
  const holes = Array.from({ length: MELT.holes }, () => new THREE.Vector3());
  const materials = [];
  const copy = (glyph) => {
    const c = dieMaterial(dice.finish, style, glyph, dice.seed, { radius: R, onTray: view.trayDrawn });
    c.userData.dice.uniforms.uExitHoles.value = holes;
    materials.push(c);
    return c;
  };
  const rough = m.roughness, bump = m.bumpScale;
  const lumps = [];
  const addLump = (piece) => {
    const material = copy(uniforms.uGlyph.value), u = material.userData.dice.uniforms;
    u.uExitMeltSeed.value = rand(0, 2 * Math.PI);   // each blob's rim its own
    const lump = new THREE.Mesh(geometryOf(piece), material);
    lump.castShadow = mesh.castShadow;
    lump.receiveShadow = mesh.receiveShadow;
    lump.renderOrder = mesh.renderOrder;
    lump.customDepthMaterial = exitDepthMaterial(u);
    lump.matrixAutoUpdate = false;   // its pose is the motion's, turned about its own centroid
    lump.visible = false;
    view.scene.add(lump);
    lumps.push({ piece, mesh: lump, material, uniforms: u, landed: -1, melting: -1, w: R, foot: R, melt: 0, wobble: 0 });
  };
  // The work, a little a frame while it trembles: cut every lump, then split each finer for its slump.
  const work = (function* () {
    const cutting = fracturePieces({ position: at.position.array, normal: at.normal.array, uv: at.uv.array, color: colours }, seeds,
      { innerUV: blankUV(g.userData.layout), innerColor: dim });
    for (const piece of cutting) { addLump(piece); yield; }
    for (const l of lumps) {
      let soup = null;
      for (soup of subdividePasses(l.piece, MELT.maxEdge * R)) yield;
      if (soup) { const coarse = l.mesh.geometry; l.mesh.geometry = geometryOf(soup); coarse.dispose(); }
    }
  })();
  let working = true;
  const workFor = (ms, until = () => false) => {
    const t0 = performance.now();
    while (working && !until()) {
      if (work.next().done) working = false;
      if (performance.now() - t0 >= ms) break;
    }
  };
  sound('melt', centre);   // a low sizzle under it all (audio/plan.js ▸ EXIT_SOUNDS)
  let states = null, strands = null, goo = null, plan = null;
  // A strand's end on its lump, in the world: carried with the lump, then slumped with it (the shader's sums in JS).
  const anchor = (l, s, a) => {
    const c = l.piece.centroid, r = rotate(s.q, [a[0] - c[0], a[1] - c[1], a[2] - c[2]]);
    const rel = [r[0], s.x[1] + r[1], r[2]];   // from the lump's centre on the floor
    if (!l.melt && !l.wobble) return [s.x[0] + rel[0], rel[1], s.x[2] + rel[2]];
    const q = meltRel(rel, { melt: l.melt, wobble: l.wobble, w: l.w, foot: l.foot, seed: l.uniforms.uExitMeltSeed.value });
    return [s.x[0] + q[0], q[1], s.x[2] + q[2]];
  };
  const breakApart = () => {
    workFor(Infinity, () => lumps.length === seeds.length);   // every lump cut by now (a frame that ran long)
    uniforms.uExitWobble.value = 0;
    uniforms.uExitCrack.value = 0;
    mesh.visible = false;
    states = fallApart(burstShards(lumps.map((l) => l.piece), { position: mesh.position.toArray(), quaternion: mesh.quaternion.toArray() }, Math.random, MELT), R);
    for (const l of lumps) l.mesh.visible = true;
    strands = strandsBetween(lumps.map((l) => l.piece), R);
    const n = 2 * strands.length * TUBE_VERTICES, geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(3 * n), 3).setUsage(THREE.DynamicDrawUsage));
    geometry.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(3 * n), 3).setUsage(THREE.DynamicDrawUsage));
    geometry.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(2 * n), 2));
    geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(3 * n).fill(dim), 3));
    geometry.setIndex(tubeIndices(2 * strands.length));
    const material = copy(glyphOf(0));
    if (material.transmission > 0) material.thickness = 4 * MELT.strandRadius[1] * R;   // glass as thin as the goo, or it tints black
    goo = new THREE.Mesh(geometry, material);
    goo.castShadow = mesh.castShadow;
    goo.receiveShadow = mesh.receiveShadow;
    goo.frustumCulled = false;   // its shape is written every frame, never bounded
    goo.customDepthMaterial = exitDepthMaterial(material.userData.dice.uniforms);
    view.scene.add(goo);
  };
  // The puddle, for the holes: its lumps' points slumped (one in PUDDLE_SAMPLE), and its strands' rings; middles away
  // from the rims.
  const puddle = () => {
    const points = [], middles = [], v = new THREE.Vector3();
    lumps.forEach((l, k) => {
      const s = states[k], pos = l.mesh.geometry.attributes.position, mine = [];
      for (let i = 0; i < pos.count; i += PUDDLE_SAMPLE) {
        v.fromBufferAttribute(pos, i).applyMatrix4(l.mesh.matrix);
        const q = meltRel([v.x - s.x[0], v.y, v.z - s.x[2]], { melt: l.melt, wobble: 0, w: l.w, foot: l.foot, seed: l.uniforms.uExitMeltSeed.value });
        mine.push([s.x[0] + q[0], s.x[2] + q[2], Math.hypot(q[0], q[2])]);
      }
      const reach = Math.max(...mine.map((p) => p[2]));
      for (const p of mine) { points.push([p[0], p[1]]); if (p[2] < 0.6 * reach) middles.push([p[0], p[1]]); }
    });
    for (const st of strands) for (const tube of st.tubes) for (const q of tube.points) { points.push([q[0], q[2]]); middles.push([q[0], q[2]]); }
    return { points, middles };
  };
  const p = new THREE.Vector3(), turn = new THREE.Quaternion(), back = new THREE.Matrix4(), ONE = new THREE.Vector3(1, 1, 1);
  return {
    step(u, dt) {
      const t = meltTimeline(u);
      if (!t.broken) {
        uniforms.uExitWobble.value = t.wobble;
        uniforms.uExitCrack.value = t.crack * SHATTER.reach * R;
        workFor(MELT.workBudget);
        return;
      }
      if (!states) breakApart();
      workFor(MELT.workBudget);
      stepShards(states, dt, undefined, MELT);
      for (const [k, s] of states.entries()) if (lumps[k].melting >= 0 && s.touched) s.w = [0, 0, 0];   // a melting lump slides on, no longer turning
      states.forEach((s, k) => {
        const l = lumps[k];
        if (s.touched && l.landed < 0) { l.landed = t.since; l.w = Math.max(0.25 * R, topOf(s) / 2); }
        if (l.melting < 0 && ((l.landed >= 0 && t.since >= l.landed + MELT.land) || t.since >= MELT.slumpBy)) {
          // It melts where it lies — once down, no more tumbling (it may slide on); split finer first, if the frames have
          // not done it yet.
          l.melting = t.since;
          l.w = Math.max(0.25 * R, topOf(s) / 2);
          l.foot = footOf(s);
          workFor(Infinity);
        }
        const c = l.piece.centroid;
        l.mesh.matrix.compose(p.set(s.x[0], s.x[1], s.x[2]), turn.set(s.q[0], s.q[1], s.q[2], s.q[3]), ONE).multiply(back.makeTranslation(-c[0], -c[1], -c[2]));
        l.mesh.matrixWorldNeedsUpdate = true;
        l.melt = meltPiece(l.melting < 0 ? 0 : t.since - l.melting);
        l.wobble = l.landed < 0 ? 0 : meltJiggle(t.since - l.landed);
        l.uniforms.uExitMelt.value = l.melt;
        l.uniforms.uExitWobble.value = l.wobble;
        l.uniforms.uExitMeltAt.value.set(s.x[0], 0, s.x[2], l.w);   // its centre on the floor, and its size
        l.uniforms.uExitMeltInverse.value.copy(l.mesh.matrix).invert();
        l.uniforms.uExitMeltFoot.value = l.foot;
        l.material.roughness = rough + (MELT.gloss - rough) * l.melt;   // wet as it melts
        // Its numerals fade as it melts, their engraving with them (owner: "preserving the numbers isn't important").
        const ink = 1 - smoothstep01((l.melt - MELT.inkFrom) / (MELT.inkTo - MELT.inkFrom));
        l.uniforms.uExitInk.value = ink;
        l.material.bumpScale = bump * ink;
      });
      const P = goo.geometry.attributes.position, N = goo.geometry.attributes.normal;
      goo.material.roughness = rough + (MELT.gloss - rough) * lumps.reduce((t, l) => t + l.melt, 0) / lumps.length;   // the die's own, wet as it melts
      strands.forEach((st, k) => {
        const a = anchor(lumps[st.i], states[st.i], st.at), b = anchor(lumps[st.j], states[st.j], st.at);
        st.tubes = strandTubes(st, a, b, t.since, (lumps[st.i].melt + lumps[st.j].melt) / 2);
        writeTube(st.tubes[0] || null, P.array, N.array, 2 * k * TUBE_VERTICES);
        writeTube(st.tubes[1] || null, P.array, N.array, (2 * k + 1) * TUBE_VERTICES);
      });
      P.needsUpdate = true;
      N.needsUpdate = true;
      if (t.eaten >= 0) {
        if (!plan) { const { points, middles } = puddle(); plan = holePlan(points, middles); }
        const open = holesAt(plan, t.eaten);
        open.forEach((h, k) => holes[k].set(h[0], h[1], h[2]));
        for (const c of materials) c.userData.dice.uniforms.uExitHoleCount.value = open.length;
      }
    },
    dispose() {
      for (const l of lumps) { view.scene.remove(l.mesh); l.mesh.geometry.dispose(); l.mesh.customDepthMaterial.dispose(); }
      if (goo) { view.scene.remove(goo); goo.geometry.dispose(); goo.customDepthMaterial.dispose(); }
      for (const c of materials) c.dispose();
      mesh.customDepthMaterial.dispose();
      uniforms.uExitCrack.value = 0;
      uniforms.uExitSeedCount.value = 0;
      uniforms.uExitWobble.value = 0;
    },
  };
}

/** One of every this many of a melted lump's vertices stands for it in the holes' plan (every third took 4–12 ms a die). */
const PUDDLE_SAMPLE = 7;

/** A mesh's highest point at rest, in its own space: where cracks start from (Shatter, Melt). */
function highestPoint(mesh) {
  const pos = mesh.geometry.attributes.position, p = new THREE.Vector3(), top = new THREE.Vector3();
  for (let i = 0, high = -Infinity; i < pos.count; i++) {
    p.fromBufferAttribute(pos, i);
    const y = p.clone().applyMatrix4(mesh.matrixWorld).y;
    if (y > high) { high = y; top.copy(p); }
  }
  return top;
}

/** A piece's highest point above the floor, as it lies (render/shards.js's state). */
function topOf(s) {
  return Math.max(...s.arms.map((a) => s.x[1] + rotate(s.q, a)[1]));
}

/** How far a piece reaches across the floor from its centroid, as it lies: its foot, which it melts out from. */
function footOf(s) {
  return Math.max(...s.arms.map((a) => { const r = rotate(s.q, a); return Math.hypot(r[0], r[2]); }));
}

const smoothstep01 = (x) => { const t = Math.min(1, Math.max(0, x)); return t * t * (3 - 2 * t); };

/** A triangle soup (render/fracture.js, render/subdivide.js) as a geometry. */
function geometryOf(soup) {
  const geometry = new THREE.BufferGeometry();
  for (const [name, size] of [['position', 3], ['normal', 3], ['uv', 2], ['color', 3]]) geometry.setAttribute(name, new THREE.BufferAttribute(soup[name], size));
  geometry.computeBoundingSphere();
  return geometry;
}

// ---------------------------------------------------------------- shared pieces
/** A shadow's depth material for a leaving die: the same cut, burn-through, slump and holes as the die (exit-shader.js). */
function exitDepthMaterial(u) {
  const m = new THREE.MeshDepthMaterial();
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, { uScale: u.uScale, uSeed: u.uSeed, uExitDissolve: u.uExitDissolve, uExitClipY: u.uExitClipY, uExitFade: u.uExitFade,
      uExitMelt: u.uExitMelt, uExitWobble: u.uExitWobble, uExitMeltAt: u.uExitMeltAt, uExitMeltInverse: u.uExitMeltInverse, uExitMeltSeed: u.uExitMeltSeed, uExitMeltFoot: u.uExitMeltFoot,
      uExitHoles: u.uExitHoles, uExitHoleCount: u.uExitHoleCount });
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
// Going down's light on the floor round the rim, from the glow down the pit: orange, falling off outward.
const HELL_GLOW_FRAGMENT = /* glsl */ `
uniform float uAmount;
varying vec2 vUv;
void main() {
  float r = length( vUv - 0.5 ) * 2.0;
  float a = pow( max( 0.0, 1.0 - r ), 1.6 ) * uAmount;
  gl_FragColor = vec4( vec3( 1.0, 0.36, 0.05 ) * a, a );
}
`;
// A hole, solid black, onto an orange glow far down the pit (round 16: "a flickering orange glow coming from
// down in the pit where the cinders are coming from"; round 14 had fire there): brightest where the eye sees
// furthest down — toward the near rim, by uShift (round 17: "shift the glow in the pit forward"), as the floor of
// a deep shaft seen at a slant is — deepening to red toward the dark walls; the effect flickers it (uFire). Its rim is
// a sharp red ring — round 5's soft violet rim back, "red and sharp" (owner 2026-10-26); fwidth keeps its edges
// one pixel soft at any size. The hole is solid black up to it, nothing outside it (its old soft edge left a
// dark halo round the ring).
const HOLE_FRAGMENT = /* glsl */ `
uniform float uAmount;
uniform float uFire;
uniform vec2 uShift;
varying vec2 vUv;
const vec3 PIT_ORANGE = vec3( 1.0, 0.45, 0.06 );
const vec3 PIT_RED = vec3( 0.5, 0.06, 0.0 );
const vec3 RING_RED = vec3( 1.0, 0.04, 0.02 );
void main() {
  vec2 q = vUv - 0.5;
  float r = length( q ) * 2.0;
  if ( r > 1.0 ) discard;
  float aa = fwidth( r );
  float core = 1.0 - smoothstep( 0.9 - aa, 0.9 + aa, r );
  float deep = ( 1.0 - smoothstep( 0.2, 1.0, length( q * 2.0 - uShift ) ) ) * uFire;
  vec3 colour = mix( PIT_RED, PIT_ORANGE, deep ) * deep * 1.3;
  float ring = smoothstep( 0.84 - aa, 0.84 + aa, r ) * ( 1.0 - smoothstep( 0.9 - aa, 0.9 + aa, r ) );
  gl_FragColor = vec4( mix( colour, RING_RED, ring ), max( core, ring ) );
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
  const material = discMaterial(fragment, blending);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(centre.x, 0.0004, centre.z);
  mesh.renderOrder = order;
  view.scene.add(mesh);
  return {
    uniforms: material.uniforms,
    set(x) {
      material.uniforms.uAmount.value = x;
      if (scales) mesh.scale.setScalar(Math.max(1e-4, x));
      mesh.visible = x > 0;
    },
    dispose() { mesh.removeFromParent(); geometry.dispose(); material.dispose(); },
  };
}

function discMaterial(fragment, blending) {
  return new THREE.ShaderMaterial({
    uniforms: { uAmount: { value: 0 }, uFire: { value: 0 }, uShift: { value: new THREE.Vector2() } }, vertexShader: DISC_VERTEX,
    fragmentShader: fragment + '', blending, transparent: true, depthWrite: false,
  });
}

/**
 * Stand-ins carrying every material an exit will ask for with the view's current finish, for
 * view.warmExits to compile ahead and keep: `screen` as they are drawn on screen, `offscreen` as they are
 * drawn into a render target — the shadow pass, and a see-through die's far faces, which three.js draws
 * into its transmission buffer (a burning glass die stalled 0.3 s on that variant alone). The same shaders
 * the exits make, so theirs are found compiled.
 */
export function exitWarmUp(view) {
  const style = view.o.dieStyle;
  const see = dieMaterial(style.finish, style, glyphOf(0), 0, { radius: 0.012, onTray: view.trayDrawn });
  see.transparent = true;   // the die seen through as it burns off or fades
  const depth = exitDepthMaterial(see.userData.dice.uniforms);
  depth.side = FINISHES[style.finish].doubleSided ? THREE.DoubleSide : THREE.BackSide;   // as the shadow pass sets it
  const f = FINISHES[style.finish], far = f.transmission > 0 && f.doubleSided ? dieMaterial(style.finish, style, glyphOf(0), 0, { radius: 0.012, onTray: view.trayDrawn }) : null;
  if (far) { far.transparent = true; far.side = THREE.BackSide; }   // its far faces, into the transmission buffer
  const box = paintWhite(new THREE.BoxGeometry(0.01, 0.01, 0.01)), flat = new THREE.PlaneGeometry(0.01, 0.01);
  const looks = ['glow', 'soft', 'smoke'].map((look) => createParticles({ max: 1, look }));
  const discs = [GLOW_FRAGMENT, STAIN_FRAGMENT, HOLE_FRAGMENT, HELL_GLOW_FRAGMENT].map((f) => discMaterial(f, THREE.NormalBlending));
  return {
    screen: [new THREE.Mesh(box, see), ...looks.map((p) => p.points), ...discs.map((m) => new THREE.Mesh(flat, m))],
    offscreen: [new THREE.Mesh(box, depth), ...(far ? [new THREE.Mesh(box, far)] : [])],
    dispose() {
      see.dispose(); depth.dispose(); box.dispose(); flat.dispose();
      if (far) far.dispose();
      for (const p of looks) p.dispose();
      for (const m of discs) m.dispose();
    },
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
