// render/view.js — DiceView: a three.js scene that plays baked rolls.
//
// The view knows nothing about physics: it is handed a RollResult (src/roll.js) and plays its
// track through samplePose, frame-accurate at any display rate. It owns the tray's look, the
// lights, the camera and the dice meshes; a host owns when to roll and what the numbers mean.
//
//   const view = new DiceView({ container });
//   const result = await view.roll({ dice: ['d20', { type: 'd6', value: 4 }] });   // bake + play
//   view.play(result, { onHit(die, speed, surface, other) {…}, onStart({ timeScale }) {…} });   // replay
//   view.orbit(dYaw, dPitch);   // turn the camera round the tray (degrees)
//   view.zoom(0.8);             // 20 % nearer; view.resetOrbit() eases back to the opening view
//
// transparent: true draws no tray — the dice and their shadows over whatever is behind the
// canvas (a game's story text, say).

import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { roll, samplePose, rollDuration, buildDie, trayFor, dieTypes, createHold, cupSize, cupSlots, HOLD_DEFAULTS } from '../src/index.js';
import { createRng } from '../src/rng.js';
import { buildDieGeometry, setDim, paintGlyphMask, loadNumeralFont, numeralFontLoaded, facesShowing } from './die-mesh.js';
import { VIEW_DEFAULTS, viewOptions } from './view-defaults.js';
import { supersampleRatio, stepDown, SUPERSAMPLE } from './supersample.js';
import { orbitPose, standCamera, blendOrbit, screenBounds } from './framing.js';
import { exitDelays, chooseExit } from './exit-table.js';
import { towardEye, tossSpin, restHeight, cupFor, keepInFrame } from './hand.js';
import { bagOf, deal, looksFor, retire, pairsOf } from './die-looks.js';
import { EXITS, exitWarmUp } from './exits.js';

/**
 * The most one frame may advance an exit (s): a frame that stalled (a shader compiling, a busy page)
 * holds the effect rather than skipping it ahead (owner 2026-10-25: on glass and quartz the burn came
 * out of a stall already yellow).
 */
const EXIT_FRAME_MAX = 1 / 30;
import { dieMaterial, recolour, setGlyph, setOnTray, FINISHES } from './finishes.js';
import { DIE_MATERIALS } from '../src/materials.js';
import { NUMERAL_FONTS } from './numeral-fonts.js';
import { SURFACE_LOOKS, RIM_LOOK } from './surface-looks.js';
import { SPECULAR } from './finish-table.js';
import { patternUniforms, injectPattern } from './patterns.js';
import { LIGHTS } from './lights.js';

export { SURFACE_LOOKS };

export { LIGHTS };   // render/lights.js

export { VIEW_DEFAULTS };

const RIM_HEIGHT = 0.014;   // m: the tray's rim, low enough that a die resting against the near wall stays in view
const SCREEN_MARGIN = 0.002;   // m: the screen's edges, moved in a little, so a die never touches the frame
const WARM_DIE = 'd6';   // the die type whose geometry stands in for the dice's pipeline (warmTable)
/** The hand (pickUp): the dice gathering into it over this long; how high it holds them is render/hand.js ▸ HAND_LIFT. */
export const HAND = { gather: 0.12, frameMax: 0.05 };   // gather 0.25 s until a press picked a die up at once; height 0.05 until it rose toward the camera (2026-10-30)
/** A three.js vector or quaternion as the core's plain {x, y, z} or {x, y, z, w}. */
const vec = (v) => ({ x: v.x, y: v.y, z: v.z });
const quat = (q) => ({ x: q.x, y: q.y, z: q.z, w: q.w });

export class DiceView {
  constructor(options = {}) {
    const o = viewOptions(options);
    if (!o.container) throw new Error('DiceView: options.container (an element to draw into) is required');
    this.o = o;
    this.orbitPose = { yaw: 0, pitch: o.tilt, zoom: 1 };   // where the camera stands round the tray (view.orbit, view.zoom)
    this.orbitTween = null;
    this.cameraTarget = { x: 0, z: 0 };   // the floor point the camera looks at (view.panCamera), kept over the tray
    this.trayOptions = { ...o.tray };          // what the host fixed; the rest follows each roll's dice count
    this.tray = trayFor(1, this.trayOptions);
    this.lookName = SURFACE_LOOKS[this.tray.surface] ? this.tray.surface : 'felt';   // how the tray is drawn (SURFACE_LOOKS)
    this.container = o.container;
    this.dice = [];
    this.atlases = new Map();
    this.playing = null;
    this.animators = new Set();   // what moves each frame (a roll, a die leaving): one render per frame for all
    this.frameRequested = false;
    this.exiting = new Set();     // dice off the table, still drawn until their exit ends: { die, finish }
    this.fonts = new Map();       // a numeral font's load and repaint under way (readyFont), by NUMERAL_FONTS key
    this.warmed = new Map();      // the dice's pipeline readied, by finish and font (warmTable)
    this.warm = new Map();        // the exits' shaders readied, by finish (warmExits)
    this.bag = [o.dieStyle];      // the look: the styles a die is dealt from (render/die-looks.js); one style, every die alike
    this.wardrobe = new Map();    // the look each die wears, by type and rank, dealt from the bag and kept (render/die-looks.js)
    this.held = null;             // the hand holding the table (pickUp … release): { phase, hold, target, onHit, … }
    this.supersampleRung = 1;     // the pixel-ratio multiplier the canvas draws at (render/supersample.js), set by resize
    this.supersampleCap = Infinity;   // the governor's ceiling: a rung the GPU could not keep up with is not tried again
    this.slowFrames = 0;          // frames over SUPERSAMPLE.maxFrameMs in a row
    this.lastFrameAt = 0;         // the previous animation frame's time, 0 between sequences

    // Always able to show the page through: a transparent view and the 'none' tray draw no background.
    const r = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: false });
    r.setPixelRatio(o.pixelRatio);
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 0.95;
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFShadowMap;   // r186 removed PCFSoftShadowMap; shadow.radius softens PCF
    r.setClearColor(0x000000, 0);
    this.renderer = r;
    this.container.appendChild(r.domElement);
    // Sized by percentages, never pixels: a pixel width would hold the container open, so a
    // narrower window would never shrink it (seen on a phone-width layout, 2026-10-24).
    Object.assign(r.domElement.style, { display: 'block', width: '100%', height: '100%' });

    const scene = new THREE.Scene();
    this.scene = scene;
    const pmrem = new THREE.PMREMGenerator(r);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environmentIntensity = o.environment;
    pmrem.dispose();

    this.camera = new THREE.PerspectiveCamera(30, 1, 0.01, 10);
    this.buildLights();
    this.setTray(this.tray);
    // The opening font (a host's look may name a vendored one): loaded now, so the first roll is painted in it.
    this.readyFont(o.dieStyle.font).catch((e) => console.error('DiceView: the opening numeral font did not load, so its numerals stay in the fallback:', e));

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(this.container);
    this.resize();
  }

  // ---------------------------------------------------------------- scene
  buildLights() {
    this.lights = LIGHTS.map((spec) => {
      const light = new THREE.DirectionalLight(spec.color, spec.intensity);
      light.castShadow = true;
      light.shadow.mapSize.set(this.o.shadowMapSize, this.o.shadowMapSize);
      light.shadow.bias = -0.0002;
      light.shadow.normalBias = 0.0006;
      light.shadow.radius = this.o.shadowRadius;
      this.scene.add(light);
      this.scene.add(light.target);
      return { spec, light };
    });
  }

  /** Puts each light on its side of the camera's view and sizes its shadow to cover the tray. */
  placeLights() {
    const cam = this.camera.position, t = this.cameraTarget;
    const toCam = new THREE.Vector3(cam.x - t.x, 0, cam.z - t.z).normalize();
    const right = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), toCam).normalize();   // screen right on the floor
    // With no tray drawn the dice may roll anywhere on screen, so the shadows cover the visible floor
    // (within reason: a low orbit sees far, and one shadow map spread over metres goes soft).
    const trayReach = Math.hypot(this.tray.width, this.tray.depth) / 2 + 0.05;
    const reach = this.trayDrawn === false ? Math.min(1.5, Math.max(trayReach, this.screenEdges().reach + 0.05)) : trayReach;
    for (const { spec, light } of this.lights) {
      const d = 0.8;
      light.position.copy(right).multiplyScalar(spec.side * d).addScaledVector(toCam, spec.toward * d).setY(spec.up * d);
      Object.assign(light.shadow.camera, { left: -reach, right: reach, top: reach, bottom: -reach, near: 0.05, far: 3 });
      light.shadow.camera.updateProjectionMatrix();
    }
  }

  /**
   * Builds (or rebuilds) the tray for a tray record {width, depth, …} in the current look and
   * reframes the camera. A look with no pattern ('none') — or a transparent view — draws no floor
   * and no rim: a shadow catcher over whatever is behind the canvas.
   */
  setTray(tray) {
    if (this.trayGroup) {
      this.scene.remove(this.trayGroup);
      this.trayGroup.traverse((m) => { if (m.geometry) m.geometry.dispose(); if (m.material) m.material.dispose(); });
    }
    this.tray = { ...tray };
    const look = SURFACE_LOOKS[this.lookName];
    const drawn = !this.o.transparent && look.pattern !== null;
    this.trayDrawn = drawn;   // a scattering finish bleeds more over a drawn tray (finish-table ▸ trayBleed)
    for (const d of this.dice || []) setOnTray(d.mesh.material, drawn);
    this.scene.background = drawn ? new THREE.Color('#0f1115') : null;
    const { width: W, depth: D } = this.tray;
    const group = new THREE.Group();
    // No tray drawn: the shadow catcher spans well past any screen, as the dice roll to its edges.
    const floorGeo = drawn ? new THREE.PlaneGeometry(W, D) : new THREE.PlaneGeometry(8, 8);
    floorGeo.rotateX(-Math.PI / 2);
    const floor = new THREE.Mesh(floorGeo, drawn ? patternedMaterial(look) : new THREE.ShadowMaterial({ opacity: 0.38 }));
    floor.receiveShadow = true;
    this.floor = floor;
    group.add(floor);
    if (drawn) {
      const rimMat = patternedMaterial(RIM_LOOK);
      const t = 0.01, h = RIM_HEIGHT;   // a thin, low rim: a die resting against the near wall stays in view
      for (const [w, d, x, z] of [[W + 2 * t, t, 0, -(D / 2 + t / 2)], [W + 2 * t, t, 0, D / 2 + t / 2], [t, D, -(W / 2 + t / 2), 0], [t, D, W / 2 + t / 2, 0]]) {
        const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), rimMat);
        m.position.set(x, h / 2, z);
        m.castShadow = m.receiveShadow = true;
        group.add(m);
      }
    }
    this.trayGroup = group;
    this.scene.add(group);
    if (this.camera.aspect) this.resize();
  }

  /** Fits the canvas to its container and reframes the camera. */
  resize() {
    const w = Math.max(1, this.container.clientWidth), h = Math.max(1, this.container.clientHeight);
    this.renderer.setPixelRatio(this.o.pixelRatio * this.supersample(w, h));
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.frame();
    this.render();
  }

  /**
   * Frames the tray (render/framing.js): the camera stands at its orbit pose — `tilt` degrees up,
   * no turn and no zoom until view.orbit() or view.zoom() moves it — looking at the tray's centre,
   * just far enough back to fit it, times the zoom. A stage taller than wide starts from the tray's
   * side, so its long edge runs up the screen. The lights stand with the camera, and readUp follows
   * it, so the next roll's numerals read upright from wherever the player now looks.
   */
  frame() {
    const cam = this.camera;
    const rim = this.o.transparent || SURFACE_LOOKS[this.lookName].pattern === null ? 0 : 0.012;
    // The pose is made legal here, every frame, because what is legal follows the stage: a new size
    // or tray changes how close the camera may come before it sits among the dice.
    const { pose, position: p } = standCamera({ aspect: cam.aspect, fov: cam.fov,
      halfW: this.tray.width / 2 + rim, halfD: this.tray.depth / 2 + rim, top: rim ? RIM_HEIGHT : 0 }, this.orbitPose, this.o.orbit);
    this.orbitPose = pose;
    const hw = this.tray.width / 2, hd = this.tray.depth / 2;
    const t = this.cameraTarget = { x: Math.max(-hw, Math.min(hw, this.cameraTarget.x)), z: Math.max(-hd, Math.min(hd, this.cameraTarget.z)) };
    cam.position.set(p.x + t.x, p.y, p.z + t.z);
    cam.lookAt(t.x, 0, t.z);
    cam.updateProjectionMatrix();
    this.placeLights();
  }

  /**
   * Turns the camera round the tray by dYaw degrees (about the vertical) and dPitch degrees
   * (elevation, kept within orbit.minPitch … orbit.maxPitch). Works while a roll plays.
   */
  orbit(dYaw, dPitch = 0) {
    this.setOrbit({ yaw: this.orbitPose.yaw + dYaw, pitch: this.orbitPose.pitch + dPitch });
  }

  /**
   * Moves the camera nearer (factor below 1) or farther (above 1), within orbit.minZoom … orbit.maxZoom
   * and never lower than orbit.minHeight above the floor.
   */
  zoom(factor) {
    if (!(factor > 0)) throw new Error('DiceView: zoom factor must be positive, got ' + factor);
    this.setOrbit({ zoom: this.orbitPose.zoom * factor });
  }

  /**
   * Puts the camera at an absolute orbit pose: yaw and pitch in degrees, zoom a multiple of the fit;
   * any may be left out. Any move (orbit, zoom, setOrbit) takes over from an easing reset.
   */
  setOrbit({ yaw = this.orbitPose.yaw, pitch = this.orbitPose.pitch, zoom = this.orbitPose.zoom } = {}) {
    this.orbitTween = null;
    this.placeOrbit({ yaw, pitch, zoom });
  }

  /** Stands the camera at a pose (frame() makes it legal: render/framing.js ▸ standCamera) and draws. */
  placeOrbit(pose) {
    this.orbitPose = orbitPose(pose, this.o.orbit);   // refuses a non-finite pose before it is kept
    this.frame();
    this.render();
  }

  /**
   * Slides the camera along the floor by (dx, dz) metres, even while a roll plays; what it looks at
   * stays over the tray (frame() keeps it within the tray's half width and depth). The toy's
   * hold-and-drag (owner 2026-10-25: "zoom and pan is a better combo than zoom and orbit"). Any move
   * takes over from an easing reset.
   */
  panCamera(dx, dz) {
    if (!Number.isFinite(dx) || !Number.isFinite(dz)) throw new Error('DiceView.panCamera: dx and dz must be finite metres, got ' + dx + ', ' + dz);
    this.orbitTween = null;
    this.cameraTarget = { x: this.cameraTarget.x + dx, z: this.cameraTarget.z + dz };
    this.frame();
    this.render();
  }

  /** The opening pose: `tilt` degrees up, no turn, no zoom. */
  get homePose() { return { yaw: 0, pitch: this.o.tilt, zoom: 1 }; }

  /** True once the camera has been turned, zoomed or panned away from where the view opened. */
  get cameraMoved() {
    const p = this.orbitPose, h = this.homePose, t = this.cameraTarget;
    return Math.abs(p.yaw - h.yaw) > 1e-6 || Math.abs(p.pitch - h.pitch) > 1e-6 || Math.abs(p.zoom - h.zoom) > 1e-6 ||
      Math.abs(t.x) > 1e-6 || Math.abs(t.z) > 1e-6;
  }

  /**
   * Back to where the view opened (no turn, zoom or pan), eased over `seconds` (default
   * resetSeconds) so the camera glides home rather than jumping; 0 jumps. A move by the player while
   * it eases takes over. Resolves when the camera is home (or the player took over).
   */
  resetCamera({ seconds = this.o.resetSeconds } = {}) {
    const from = { ...this.orbitPose }, to = this.homePose, fromTarget = { ...this.cameraTarget };
    if (!(seconds > 0)) { this.cameraTarget = { x: 0, z: 0 }; this.setOrbit(to); return Promise.resolve(); }
    const token = {};
    this.orbitTween = token;
    return new Promise((resolve) => {
      let start = null;
      const step = (now) => {
        if (this.orbitTween !== token) { resolve(); return; }
        if (start === null) start = now;
        const u = Math.min(1, (now - start) / 1000 / seconds), e = u * u * (3 - 2 * u);
        this.cameraTarget = u < 1 ? { x: fromTarget.x * (1 - e), z: fromTarget.z * (1 - e) } : { x: 0, z: 0 };
        this.placeOrbit(u < 1 ? blendOrbit(from, to, e) : to);
        if (u < 1) { requestAnimationFrame(step); return; }
        this.orbitTween = null;
        resolve();
      };
      requestAnimationFrame(step);
    });
  }

  /** Changes the tray's size multiplier (src/roll.js ▸ trayFor); the tray is rebuilt for the dice now shown. */
  setTrayScale(scale) {
    if (!(scale > 0)) throw new Error('DiceView: tray scale must be positive, got ' + scale);
    this.trayOptions.scale = scale;
    this.setTray(trayFor(Math.max(1, this.dice.length), this.trayOptions));
    this.clear();
  }

  /** Where a world point sits across the screen, −1 (left edge) to 1 (right edge): a sound's pan. */
  panFor(p) {
    const v = new THREE.Vector3(p.x, p.y, p.z).project(this.camera);
    return Math.max(-1, Math.min(1, v.x));
  }

  /**
   * Changes the tray's look (SURFACE_LOOKS). The dice roll on the look's physics surface from the
   * next roll on; the tray is redrawn now.
   */
  setSurface(name) {
    const look = SURFACE_LOOKS[name];
    if (!look) throw new Error('DiceView: no look for surface "' + name + '" (known: ' + Object.keys(SURFACE_LOOKS).join(', ') + ')');
    this.lookName = name;
    this.tray.surface = this.tray.walls = look.physics;
    this.trayOptions.surface = this.trayOptions.walls = look.physics;   // the next roll is on it too
    this.setTray(this.tray);
    this.render();
  }

  /** The point of the floor plane (y = 0, tray or not) under a client (page) position, or null above the horizon. */
  floorHit(clientX, clientY) {
    return this.planeHit(clientX, clientY, 0);
  }

  /** The point of the level plane at height `y` under a client (page) position, or null where the pointer's ray misses it. */
  planeHit(clientX, clientY, y) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    const ray = new THREE.Raycaster();
    ray.setFromCamera(ndc, this.camera);
    const p = new THREE.Vector3();
    return ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -y), p) ? { x: p.x, y, z: p.z } : null;
  }

  /** The point on the tray floor under a client (page) position, or null when off the floor. */
  floorPoint(clientX, clientY) {
    const p = this.floorHit(clientX, clientY);
    if (!p) return null;
    if (this.trayDrawn === false) {
      // No tray: any floor the screen shows (short of a low orbit's horizon) is a place to throw from.
      const inside = this.screenEdges().planes.every((b) => b.normal.x * p.x + b.normal.y * p.y + b.normal.z * p.z >= b.offset - 1e-6);
      return inside ? { x: p.x, z: p.z } : null;
    }
    if (Math.abs(p.x) > this.tray.width / 2 || Math.abs(p.z) > this.tray.depth / 2) return null;
    return { x: p.x, z: p.z };
  }

  /** The floor direction that reads as "up" on screen: away from the camera. */
  get readUp() {
    const d = new THREE.Vector3().subVectors(new THREE.Vector3(this.cameraTarget.x, 0, this.cameraTarget.z), this.camera.position);
    d.y = 0;
    d.normalize();
    return { x: d.x, y: 0, z: d.z };
  }

  render() { this.renderer.render(this.scene, this.camera); }

  /**
   * The supersample's pixel-ratio multiplier for a view of this size (render/supersample.js): on a desktop the best
   * rung the pixel budget allows, 1 on a touch device or when off, never above the governor's cap. Owner 2026-10-29:
   * a still frame drawn supersampled alone made the switch visible ("the pop is noticeable and jarring"), so every
   * frame is drawn so, where a frame is cheap: "Yes, desktop only".
   */
  supersample(width, height) {
    if (!this.o.supersample) return 1;
    this.supersampleRung = Math.min(this.supersampleCap, supersampleRatio({
      width, height, pixelRatio: this.o.pixelRatio,
      touch: !!(globalThis.matchMedia && matchMedia('(pointer: coarse)').matches),
      budget: this.o.supersampleBudget,
    }));
    return this.supersampleRung;
  }

  /** The governor: SUPERSAMPLE.slowFrames frames in a row over SUPERSAMPLE.maxFrameMs while animating step the rung down, for this view's life. */
  governSupersample(now) {
    const dt = this.lastFrameAt ? now - this.lastFrameAt : 0;
    this.lastFrameAt = now;
    if (!(dt > SUPERSAMPLE.maxFrameMs && dt < 200) || this.supersampleRung <= 1) { this.slowFrames = 0; return; }   // a hidden tab's second-long gaps are not slow frames
    if (++this.slowFrames < SUPERSAMPLE.slowFrames) return;
    this.slowFrames = 0;
    this.supersampleCap = stepDown(this.supersampleRung);
    console.info('DiceView: ' + dt.toFixed(0) + ' ms a frame at ' + this.supersampleRung + '×: drawing at ' + this.supersampleCap + '× from here');
    this.resize();
  }

  // ---------------------------------------------------------------- dice
  /**
   * A die type's rounded geometry (built once) and its numeral mask in the current font (built once
   * per font). Colours and finish are the material's.
   */
  atlasFor(type, font = this.o.dieStyle.font) {
    if (!this.atlases.has(type)) {
      const die = buildDie(type);
      this.atlases.set(type, { die, geometry: buildDieGeometry(die), glyphs: new Map() });
    }
    const a = this.atlases.get(type);
    if (!a.glyphs.has(font)) {
      a.glyphs.set(font, paintGlyphMask(a.die, a.geometry.userData.layout, NUMERAL_FONTS[font]));
      // A vendored face not yet loaded paints in its fallback for now: the mask is repainted, and every die wearing
      // it given the new one, the moment the face arrives (readyFont); one that never arrives is said.
      if (!numeralFontLoaded(NUMERAL_FONTS[font])) this.readyFont(font).catch((e) => console.error('DiceView: the numeral font "' + font + '" did not load, so its numerals stay in the fallback:', e));
    }
    return { die: a.die, geometry: a.geometry, glyph: a.glyphs.get(font) };
  }

  /**
   * Readies a numeral font (NUMERAL_FONTS key) to paint in: a vendored face is loaded (render/die-mesh.js ▸
   * loadNumeralFont) and, once it is, any mask already painted in its fallback is repainted and every die wearing it
   * given the new one. Resolves when the font can be painted in (a system stack: at once); rejects, with the reason,
   * when the face cannot be loaded. An unknown font is refused by name.
   */
  readyFont(font) {
    const spec = NUMERAL_FONTS[font];
    if (!spec) throw new Error('DiceView: no numeral font "' + font + '" (known: ' + Object.keys(NUMERAL_FONTS).join(', ') + ')');
    if (numeralFontLoaded(spec)) return Promise.resolve();
    if (!this.fonts.has(font)) this.fonts.set(font, loadNumeralFont(spec).then(() => this.repaintFont(font)));
    return this.fonts.get(font);
  }

  /**
   * Repaints every mask of a font that was painted before its face had loaded, and gives the new mask to every die
   * wearing the old one — on the table or leaving. (A material that still reads the old mask after it is freed, an
   * exit's own copy, has it uploaded again: nothing goes blank.)
   */
  repaintFont(font) {
    const wearing = [...this.dice, ...[...this.exiting].map((r) => r.die)];
    for (const a of this.atlases.values()) {
      const old = a.glyphs.get(font);
      if (!old) continue;
      const mask = paintGlyphMask(a.die, a.geometry.userData.layout, NUMERAL_FONTS[font]);
      a.glyphs.set(font, mask);
      for (const d of wearing) if (d.mesh.material.userData.dice.uniforms.uGlyph.value === old) setGlyph(d.mesh.material, mask);
      old.dispose();
    }
    this.render();
  }

  /**
   * Changes the dice's look — {body, ink} colours, the finish (FINISHES) and the numeral font
   * (NUMERAL_FONTS) — for the dice on the tray now and every roll after. Colours change in place; a
   * new finish rebuilds the materials; a new font is loaded first (it may be a file) and repaints
   * the numerals. Every die wears it (a bag of one, render/die-looks.js). Resolves when the change is on screen.
   */
  async setDieStyle(style) {
    const next = { ...this.o.dieStyle, ...style };
    if (!FINISHES[next.finish]) throw new Error('DiceView: no finish "' + next.finish + '" (known: ' + Object.keys(FINISHES).join(', ') + ')');
    if (!NUMERAL_FONTS[next.font]) throw new Error('DiceView: no numeral font "' + next.font + '" (known: ' + Object.keys(NUMERAL_FONTS).join(', ') + ')');
    await this.readyFont(next.font);
    this.o.dieStyle = next;
    this.bag = [next];
    this.wardrobe = new Map();
    this.dressTable();
    this.render();
  }

  /**
   * Puts a look of many styles on the dice — `look` a bag ({ bag: [styles] }) or one style (render/die-looks.js) — each
   * die on the table dealt one at random, and each die after as it arrives (owner 2026-10-30: "add a 'mixed bag' preset
   * that will randomly assign a preset to each die"; dealt once, then kept). `keep` changes only what is dealt from now
   * on, the dice on the table keeping theirs (a surface changed while the bag is on). The bag deals from the moment it
   * is set — a roll baked meanwhile is dealt from it, and waits for its fonts (roll ▸ readyFonts) — and the dice on the
   * table are dressed once every font in it has loaded. Resolves when the change is on screen.
   */
  async setDieBag(look, { keep = false } = {}) {
    const bag = bagOf(look);
    this.bag = bag;
    if (!keep) this.wardrobe = new Map();   // dealt anew: the old looks go back in the bag
    await Promise.all([...new Set(bag.map((s) => s.font))].map((f) => this.readyFont(f)));
    if (this.bag !== bag) return;   // a newer look took over while the fonts loaded
    if (!keep) this.dressTable();
    this.render();
  }

  /** Dresses every die on the table in the look the wardrobe gives it, dealing from the bag any it has none for. */
  dressTable() {
    const looks = looksFor(this.dice.map((d) => d.die.type), this.wardrobe, this.bag);
    this.dice.forEach((d, i) => this.dress(d, looks[i]));
  }

  /** Dresses a die on the table in a style: colours and numerals in place, or a new material for a new finish. */
  dress(d, style) {
    const { glyph } = this.atlasFor(d.die.type, style.font);
    if (d.style && d.style.finish === style.finish) {
      recolour(d.mesh.material, style);
      setGlyph(d.mesh.material, glyph);
    } else {
      const old = d.mesh.material;
      d.mesh.material = dieMaterial(style.finish, style, glyph, old.userData.dice.seed, { radius: d.die.boundingRadius, onTray: this.trayDrawn });
      old.dispose();
    }
    d.style = style;
  }

  /** The style each die of the table wears now, in play order. */
  dieStyles() {
    return this.dice.map((d) => d.style);
  }

  /** Readies every font the look can deal (a vendored one loads from a file). */
  readyFonts() {
    return Promise.all([...new Set(this.bag.map((s) => s.font))].map((f) => this.readyFont(f)));
  }

  /**
   * Empties the table: at once, or with an exit (EXITS) each die leaving a moment after the last.
   * Resolves when every die has gone.
   */
  clear({ exit = null, onSound = null } = {}) {
    if (exit !== null && !EXITS[exit]) throw new Error('DiceView: no exit "' + exit + '" (known: ' + Object.keys(EXITS).join(', ') + ')');
    this.held = null;   // the hand opens: nothing left to hold
    const gone = this.dice;
    this.dice = [];
    if (exit === null) {
      for (const d of gone) disposeDie(this.scene, d);
      this.render();
      return Promise.resolve();
    }
    const delays = exitDelays(gone.length);
    const name = chooseExit(exit);   // Random picks once for them all (round 13)
    return Promise.all(gone.map((d, k) => this.runExit(d, name, delays[k], onSound)));
  }

  /**
   * Compiles every shader an exit will ask for with the current finish — the die seen through as it
   * fades, its shadow's material, every particle look and floor disc — in the background where the
   * browser can (KHR_parallel_shader_compile), and keeps them, so no exit compiles one. A burn's first
   * frame otherwise stalled for up to 6.9 s on quartz while they compiled (measured 2026-10-25). The
   * shadow material is compiled as the shadow pass draws it: into a render target, so without tone
   * mapping — and so is a see-through die's far faces, as three.js draws them into its transmission
   * buffer. Call it after setDieStyle or setDieBag: every finish the look can deal is readied (a mixed bag, several),
   * and a finish it no longer deals is freed once they are. Resolves when they are ready.
   */
  warmExits() {
    const byFinish = new Map(pairsOf(this.bag).map((p) => [p.finish, p.style]));
    const ready = Promise.all([...byFinish.values()].map((style) => this.warmExitsFor(style)));
    ready.then(() => { for (const [finish, w] of this.warm) if (!byFinish.has(finish)) { w.dispose(); this.warm.delete(finish); } });
    return ready;
  }

  /** warmExits for one finish (a style that wears it), kept by finish. */
  warmExitsFor(style) {
    const finish = style.finish, had = this.warm.get(finish);
    if (had) return had.ready;
    const made = exitWarmUp(this, style);
    const onScreen = new THREE.Scene(), inShadow = new THREE.Scene();
    for (const o of made.screen) onScreen.add(o);
    for (const o of made.offscreen) inShadow.add(o);
    const target = new THREE.WebGLRenderTarget(1, 1), before = this.renderer.getRenderTarget();
    let shadows;
    try {
      this.renderer.setRenderTarget(target);
      shadows = this.renderer.compileAsync(inShadow, this.camera, this.scene);
    } finally {
      this.renderer.setRenderTarget(before);
    }
    const ready = Promise.all([this.renderer.compileAsync(onScreen, this.camera, this.scene), shadows])
      .catch((e) => console.error('DiceView: the exit shaders could not be readied ahead, so an exit may stall to compile them:', e))
      .finally(() => target.dispose());
    this.warm.set(finish, { ready, dispose: made.dispose });
    return ready;
  }

  /**
   * Readies the dice's own pipeline for the current finish and font, so the first die to land never waits for it:
   * every die type's geometry and numeral mask are built and uploaded now, the material a die wears on the table is
   * compiled — in the background where the browser can — and then DRAWN once, as a stand-in of no size in the scene for
   * one frame. A compiled program is not yet something the GPU can run: its first draw builds that (and a see-through
   * finish's transmission buffers, the shadow pass's depth variant), and after a reload the first drop paid 0.6 s for it
   * on a desktop GPU (measured 2026-10-28) — the die hung in the air, then popped onto the floor, because play()'s clock
   * was already running (it now starts once the first frame is drawn). Kept per finish and font, as warmExits keeps
   * the exits'; the stand-in's material stays alive so its program is never freed and built again. Resolves once the
   * pipeline has been drawn. Call it after setDieStyle or setDieBag (warmUp does, with warmExits): every finish and
   * font pair the look can deal is readied (render/die-looks.js ▸ pairsOf), and a pair it no longer deals is freed once
   * they are.
   */
  warmTable() {
    const pairs = pairsOf(this.bag), keys = new Set(pairs.map((p) => p.finish + '/' + p.font));
    const ready = Promise.all(pairs.map((p) => this.warmTableFor(p.style)));
    ready.then(() => { for (const [key, w] of this.warmed) if (!keys.has(key)) { w.dispose(); this.warmed.delete(key); } });
    return ready;
  }

  /** warmTable for one finish and font (a style that wears them), kept by the pair. */
  warmTableFor(style) {
    const { finish, font } = style, key = finish + '/' + font, had = this.warmed.get(key);
    if (had) return had.ready;
    let die = null, geometry = null, glyph = null;
    for (const type of dieTypes()) {
      const a = this.atlasFor(type, font);
      this.renderer.initTexture(a.glyph);   // uploaded now, not as its first die lands
      if (type === WARM_DIE) ({ die, geometry, glyph } = a);
    }
    const material = dieMaterial(finish, style, glyph, 0, { radius: die.boundingRadius, onTray: this.trayDrawn });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = mesh.receiveShadow = true;
    mesh.frustumCulled = false;   // drawn, though it has no size
    mesh.scale.setScalar(0);
    const standIn = new THREE.Scene();
    standIn.add(mesh);
    const ready = this.renderer.compileAsync(standIn, this.camera, this.scene)
      .then(() => {
        if (this.warmed.get(key) !== entry) return;   // freed before it was drawn: the look moved on
        this.scene.add(mesh);
        this.render();
        this.scene.remove(mesh);
      })
      .catch((e) => console.error('DiceView: the dice pipeline could not be readied ahead, so the first die may wait while it is built:', e));
    const entry = { ready, dispose: () => material.dispose() };
    this.warmed.set(key, entry);
    return ready;
  }

  /** Readies everything the current look will draw — the dice's pipeline (warmTable) and the exits' (warmExits). */
  warmUp() {
    return Promise.all([this.warmTable(), this.warmExits()]);
  }

  /** Runs fn(now) every frame until it returns false; the view renders once a frame for everything animating. */
  animate(fn) {
    this.animators.add(fn);
    if (!this.frameRequested) { this.frameRequested = true; requestAnimationFrame((now) => this.frameStep(now)); }
  }

  frameStep(now) {
    this.frameRequested = false;
    this.governSupersample(now);
    for (const fn of [...this.animators]) {
      let more = false;
      try { more = fn(now); } catch (e) { console.error('DiceView: an animation threw, and stops:', e); }
      if (!more) this.animators.delete(fn);
    }
    this.render();
    if (this.animators.size && !this.frameRequested) { this.frameRequested = true; requestAnimationFrame((n) => this.frameStep(n)); }
    else if (!this.animators.size) this.lastFrameAt = 0;   // the governor's clock stops with the loop
  }

  /**
   * Plays an exit on a die already off the table: drawn where it was until the effect has run, then
   * freed. A start or a step that throws is reported, and the die goes at once.
   */
  runExit(d, exit, delay = 0, onSound = null) {
    const name = chooseExit(exit), spec = EXITS[name];   // Random picks here for a die on its own (clear() picks for all)
    // What an exit hears itself make (a spider's step): kind, how hard (0 … 1) and where, handed to the
    // host's onSound with the die's type, the table's surface and the pan.
    const sound = (kind, position, strength = 1) => {
      if (!onSound) return;
      try { onSound({ kind, type: d.die.type, surface: this.tray.surface, strength, pan: this.panFor(position) }); } catch (e) { console.error('DiceView onSound threw:', e); }
    };
    return new Promise((resolve) => {
      let effect = null, start = null, last = 0, elapsed = 0, done = false;
      const record = {
        die: d,
        finish: () => {
          if (done) return;
          done = true;
          this.exiting.delete(record);
          if (effect) { try { effect.dispose(); } catch (e) { console.error('DiceView: the "' + name + '" exit could not clean up:', e); } }
          disposeDie(this.scene, d);
          resolve();
        },
      };
      this.exiting.add(record);
      this.animate((now) => {
        if (done) return false;
        if (start === null) start = now + delay * 1000;
        if (now < start) return true;
        const dt = effect ? Math.min(EXIT_FRAME_MAX, (now - last) / 1000) : 0;
        elapsed += dt;
        let u = spec.seconds > 0 ? Math.min(1, elapsed / spec.seconds) : 1;
        try {
          if (!effect) effect = spec.start({ view: this, entry: d, sound });
          effect.step(u, dt);
        } catch (e) {
          console.error('DiceView: the "' + name + '" exit failed, so the die goes at once:', e);
          u = 1;
        }
        last = now;
        if (u < 1) return true;
        record.finish();
        return false;
      });
    });
  }

  /** The die under a client (page) position: its index in play order, or −1 when none is there. */
  dieAt(clientX, clientY) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    const ray = new THREE.Raycaster();
    ray.setFromCamera(ndc, this.camera);
    const hit = ray.intersectObjects(this.dice.map((d) => d.mesh), false)[0];
    return hit ? this.dice.findIndex((d) => d.mesh === hit.object) : -1;
  }

  /**
   * Picks dice up into a hand under the pointer (`pointer` {clientX, clientY}, the press): `dice` the indices of the
   * dice to take (play order; all of them unless given — the toy takes the one pressed, owner 2026-10-30: "just pick
   * up the one clicked. This should give an option for dice that get stuck"). Each rises STRAIGHT TOWARD THE CAMERA
   * to the cup's floor (render/hand.js ▸ towardEye; owner 2026-10-30: "the die elevates away from the hand... Instead
   * of moving UP, move the die along a vector from its current position towards the camera to meet the hand"), so on
   * screen it never leaves the pointer; the cup is centred where they rose to, over HAND.gather s, then the hold runs
   * LIVE (src/hold.js) frame by frame, the cup following moveHand(), kept under the pointer as it was grabbed, until
   * release() hands the dice to a roll; the dice left on the table lie where they are. onHit(dieIndex, speed, surface,
   * other) hears every knock inside the cup — surface 'wall' | 'floor' | 'ceiling' the cup's, 'die' another die, the
   * dice by their place on the table — for the host's clicks; `surface` is what the hand feels like (SURFACES, felt).
   * A play under way stops where it is. Refused with nothing on the table, or a pick of dice not on it; a second pickUp
   * while one holds is ignored. Owner 2026-10-29: "A kinematic hand that holds the dice, shakes them and lets go".
   */
  pickUp(pointer, { onHit = null, surface = HOLD_DEFAULTS.surface, dice = null } = {}) {
    if (!this.dice.length) throw new Error('DiceView.pickUp: nothing on the table to pick up');
    if (this.held) return;
    const picked = dice ?? this.dice.map((d, i) => i);
    if (!Array.isArray(picked) || !picked.length || new Set(picked).size !== picked.length || picked.some((i) => !(Number.isInteger(i) && i >= 0 && i < this.dice.length))) {
      throw new Error('DiceView.pickUp: dice must list dice on the table by index, each once, got ' + JSON.stringify(dice));
    }
    const live = this.liveTable();   // read before the play stops: a die left on the table carries on, when let go, as it was going
    this.stop();
    const n = picked.length, size = cupFor(picked.map((i) => this.dice[i].die.boundingRadius)), rng = createRng((Date.now() >>> 0) ^ n);
    const slots = cupSlots(n, size, rng);
    const from = picked.map((i) => this.dice[i].mesh.position.clone());
    // Where each die rises to: HAND_LIFT of the way to the camera (render/hand.js); the cup's floor under the dice at
    // that level, each resting on it at its own height (one die: exactly where it rose to); the cup centred so each
    // die's slot is there, then kept in the frame at that level.
    const rest = picked.map((i) => restHeight(this.dice[i].die, quat(this.dice[i].mesh.quaternion)));
    const rise = picked.map((i, j) => towardEye(from[j], this.camera.position));
    const floorY = rise.reduce((s, r, j) => s + (r.y - rest[j]) / n, 0), cupY = floorY + HOLD_DEFAULTS.height / 2;
    const grabY = floorY + rest.reduce((s, h) => s + h / n, 0);   // the level the dice are held at
    const mid = rise.reduce((s, r, j) => ({ x: s.x + (r.x - slots[j].x) / n, z: s.z + (r.z - slots[j].z) / n }), { x: 0, z: 0 });
    const centre = this.handClamp({ x: mid.x, y: cupY, z: mid.z }, size, grabY);
    const to = picked.map((i, j) => new THREE.Vector3(centre.x + slots[j].x, floorY + rest[j], centre.z + slots[j].z));
    // The grab: where the cup's centre sits from the pointer's point on the dice's level — kept as the pointer moves,
    // so the die it pressed stays under it.
    const at = pointer ? this.planeHit(pointer.clientX, pointer.clientY, grabY) : null;
    const grab = at ? { x: centre.x - at.x, z: centre.z - at.z } : { x: 0, z: 0 };
    const held = this.held = { phase: 'gather', hold: null, target: centre, surface, onHit, size, start: null, last: 0, picked, live, grabY, grab };
    this.animate((now) => {
      if (this.held !== held) return false;
      if (held.phase === 'gather') {
        if (held.start === null) held.start = now;
        const u = Math.min(1, (now - held.start) / 1000 / HAND.gather), e = u * u * (3 - 2 * u);
        picked.forEach((i, j) => this.dice[i].mesh.position.lerpVectors(from[j], to[j], e));
        if (u < 1) return true;
        held.hold = createHold(picked.map((i, j) => ({ die: this.dice[i].die, position: { x: to[j].x, y: to[j].y, z: to[j].z }, orientation: quat(this.dice[i].mesh.quaternion) })), centre, { surface, size });
        held.phase = 'hold';
        held.last = now;
        return true;
      }
      // The frame's own length drives the world (never more than frameMax: a tab away for a while is not a leap).
      const dt = Math.min(HAND.frameMax, Math.max(1 / 240, (now - held.last) / 1000));
      held.last = now;
      const hits = held.hold.step(dt, held.target);
      held.hold.states().forEach((s, j) => {
        const m = this.dice[picked[j]].mesh;
        m.position.set(s.position.x, s.position.y, s.position.z);
        m.quaternion.set(s.orientation.x, s.orientation.y, s.orientation.z, s.orientation.w);
      });
      if (onHit) for (const h of hits) { try { onHit(picked[h.body], h.speed, h.surface, h.other >= 0 ? picked[h.other] : h.other); } catch (e) { console.error('DiceView onHit threw:', e); } }
      return true;
    });
  }

  /**
   * Where the hand is going: under the pointer (`pointer` {clientX, clientY}) at the level the dice are held, as it
   * was grabbed — the die pressed stays under it; the cup follows at the hand's own pace, kept over the floor the dice
   * may land on.
   */
  moveHand(pointer) {
    const p = this.handPoint(pointer.clientX, pointer.clientY);
    if (!p) return;
    this.held.target = this.handClamp({ x: p.x + this.held.grab.x, y: this.held.target.y, z: p.z + this.held.grab.z }, this.held.size, this.held.grabY);
  }

  /** The pointer's point on the level the held dice are at (what a toss is measured on), or null: nothing held, or a pointer above the horizon. */
  handPoint(clientX, clientY) {
    return this.held ? this.planeHit(clientX, clientY, this.held.grabY) : null;
  }

  /** Where the hand is going now ({x, z}), as clamped — what a host moves it from; null when nothing is held. */
  handTarget() {
    return this.held ? { x: this.held.target.x, z: this.held.target.z } : null;
  }

  /**
   * The hand's centre kept, by half the cup, inside the screen's edges at `level`, the height the dice are held at
   * (render/hand.js ▸ keepInFrame: the edges lean, so the floor's frame let a held die out at the top and shut off a
   * band at the bottom, owner 2026-10-30), and inside the tray's walls when one is drawn — so a held die stays on screen
   * and the dice let go start inside the walls the roll keeps them in (with no tray those walls are the screen's edges).
   */
  handClamp(p, size, level = 0) {
    const r = size / 2;
    const { x, z } = keepInFrame(p, r, level, this.screenEdges().planes);
    if (this.trayDrawn === false) return { x, y: p.y, z };
    const clamp = (v, h) => (h > r ? Math.max(-h + r, Math.min(h - r, v)) : 0);
    return { x: clamp(x, this.tray.width / 2), y: p.y, z: clamp(z, this.tray.depth / 2) };
  }

  /**
   * Lets go: ends the hold and returns { states, velocity } — every die where it is and as it moves (src/hold.js ▸
   * states), for roll({ throw: { states } }), and the hand's last velocity (m/s); the dice stay drawn where they are,
   * so a play of that roll with fromTable set carries straight on from them. Null when nothing is held. Let go while
   * still gathering, the dice are where they are, still. A die the hand did not take is a RESTING state (src/roll.js:
   * it starts where it lies on every attempt and keeps the printing the player saw), moving as it was when the hand
   * took the others. `velocity` ({x, z} m/s) is a TOSS: the hand opens moving that fast along the floor, and each die it
   * held leaves with it, on top of its own motion within the cup (owner 2026-10-30: "allow the user to toss the die"),
   * spun forward the faster it goes (render/hand.js ▸ tossSpin: a die flung without it slid and kept its face).
   */
  release({ velocity = null } = {}) {
    const held = this.held;
    if (!held) return null;
    this.held = null;
    const still = { x: 0, y: 0, z: 0 };
    const hand = held.hold ? held.hold.velocity : still;
    const toss = velocity ? { x: velocity.x - hand.x, y: 0, z: velocity.z - hand.z } : still;   // the hand's own motion is in the dice already
    const inHand = held.hold ? held.hold.states() : held.picked.map((i) => ({ position: vec(this.dice[i].mesh.position), orientation: quat(this.dice[i].mesh.quaternion), velocity: still, angularVelocity: still }));
    const states = this.dice.map((d, i) => {
      const j = held.picked.indexOf(i);
      if (j >= 0) {
        const s = inHand[j], w = velocity ? tossSpin(velocity, { x: Math.random() * 2 - 1, y: Math.random() * 2 - 1, z: Math.random() * 2 - 1 }) : still;
        return { ...s, velocity: { x: s.velocity.x + toss.x, y: s.velocity.y, z: s.velocity.z + toss.z }, angularVelocity: { x: s.angularVelocity.x + w.x, y: s.angularVelocity.y + w.y, z: s.angularVelocity.z + w.z } };
      }
      const t = held.live[i];
      return { position: t.position, orientation: t.orientation, velocity: t.velocity || still, angularVelocity: t.angularVelocity || still, resting: true };
    });
    return { states, velocity: held.hold ? held.hold.velocity : still };
  }

  /**
   * The dice on the table as they lie now, in play order: [{ type, value, position, orientation }],
   * the orientation the VISUAL one (the printing included), so a die read from it shows what the
   * player sees. What a drop starts from (bakeDrop); read it while no roll plays.
   */
  table() {
    return this.dice.map((d) => ({
      type: d.die.type,
      value: d.value,
      position: { x: d.mesh.position.x, y: d.mesh.position.y, z: d.mesh.position.z },
      orientation: { x: d.mesh.quaternion.x, y: d.mesh.quaternion.y, z: d.mesh.quaternion.z, w: d.mesh.quaternion.w },
    }));
  }

  /**
   * The table this moment, moving or not: table() plus, while a roll or drop plays, each die's velocity
   * (m/s) and spin (rad/s, about the world axes), read off the play over one frame. A drop baked from it
   * (bakeDrop) lets every die still moving carry on as it was going, so an added die drops on its click
   * even mid-fall (art direction 2026-10-25). A die at rest, or with no play, has neither.
   */
  liveTable() {
    const table = this.table(), p = this.playing;
    if (!p || !p.result) return table;
    const r = p.result, t = p.time(), h = 1 / r.fps;
    const qa = new THREE.Quaternion(), qb = new THREE.Quaternion();
    return table.map((entry, i) => {
      const d = this.dice[i];
      if (!r.dice[d.index]) return entry;
      const a = samplePose(r, d.index, t), b = samplePose(r, d.index, t + h);
      qa.set(a.orientation.x, a.orientation.y, a.orientation.z, a.orientation.w);
      qb.set(b.orientation.x, b.orientation.y, b.orientation.z, b.orientation.w);
      const turn = qb.multiply(qa.invert());   // the frame's turn, in world axes
      const s = turn.w < 0 ? -2 / h : 2 / h;  // small angle: ω ≈ 2·(x, y, z) / h, on the short way round
      return {
        ...entry,
        velocity: { x: (b.position.x - a.position.x) / h, y: (b.position.y - a.position.y) / h, z: (b.position.z - a.position.z) / h },
        angularVelocity: { x: turn.x * s, y: turn.y * s, z: turn.z * s },
      };
    });
  }

  /** Stops the play under way where it is (its promise resolves), or opens the hand (the dice hang where they are); the dice stay as they are. */
  stop() {
    if (this.playing) this.playing.cancel();
    this.playing = null;
    this.held = null;
  }

  /**
   * Takes die i (play order) off the table now, even while a roll plays; the others stay where they
   * are. With an exit (EXITS: 'burn', 'smoke', 'pit') it leaves through that effect, `delay` seconds
   * from now: off the table at once (table() no longer lists it, so a drop or a settle may follow) and
   * drawn until the effect ends. onSound({ kind, type, surface, strength, pan }) hears the sounds the exit
   * makes (a spider's steps), for the host to play. Resolves when it has gone.
   */
  removeDie(i, { exit = null, delay = 0, onSound = null } = {}) {
    const d = this.dice[i];
    if (!d) throw new Error('DiceView.removeDie: the table has no die ' + i + ' (' + this.dice.length + ' on it)');
    if (exit !== null && !EXITS[exit]) throw new Error('DiceView: no exit "' + exit + '" (known: ' + Object.keys(EXITS).join(', ') + ')');
    this.held = null;   // the hand opens: the dice it held are no longer the table
    retire(this.wardrobe, this.dice.map((t) => t.die.type), i);   // the dice of its type after it keep their looks
    this.dice.splice(i, 1);
    if (exit === null) {
      disposeDie(this.scene, d);
      this.render();
      return Promise.resolve();
    }
    return this.runExit(d, exit, delay, onSound);
  }

  /**
   * Bakes a drop (core roll() ▸ throw.drop): the table's dice start where they lie and `types` fall
   * onto open floor; an empty list lets the table settle (a die resting on one taken away falls).
   * The tray is the one the table lies in, grown when the dice now need more floor (trayFor), never
   * shrunk under them. `again` lists dice of the table to roll again, tossed from where they lie (core drop.again).
   * Play it with play(result, { fromTable: <the table's length> }).
   */
  bakeDrop(types, request = {}, { again = [] } = {}) {
    const table = this.liveTable();
    const dice = [...table.map((d) => d.type), ...types];
    if (!dice.length) throw new Error('DiceView.bakeDrop: nothing on the table and nothing to drop');
    const grown = trayFor(dice.length, this.trayOptions);
    // With no tray drawn the tray is only the camera's frame (bake): it keeps its size, never grown under the camera.
    const size = this.trayDrawn === false ? { width: this.tray.width, depth: this.tray.depth } : { width: Math.max(this.tray.width, grown.width), depth: Math.max(this.tray.depth, grown.depth) };
    const resting = table.map(({ position, orientation, velocity, angularVelocity }) => ({ position, orientation, ...(velocity ? { velocity, angularVelocity } : {}) }));
    return this.bake({ ...request, dice, throw: { drop: { resting, ...(again.length ? { again } : {}) } }, tray: { ...size, ...(request.tray || {}) } });
  }

  /**
   * Bakes a reroll of dice on the table (owner 2026-10-30: a double-click on a die rerolls it): `indices` tossed
   * again from where they lie, the others lying as they are. Play it like a drop, with fromTable.
   */
  bakeReroll(indices, request = {}) {
    if (!Array.isArray(indices) || !indices.length) throw new Error('DiceView.bakeReroll: indices must list dice on the table, got ' + JSON.stringify(indices));
    return this.bakeDrop([], request, { again: indices });
  }

  /**
   * The screen's edges as a boundary, from where the camera stands now (render/framing.js ▸
   * screenBounds): the planes a roll is kept inside when no tray is drawn, and the visible floor.
   */
  screenEdges() {
    const cam = this.camera;
    const t = this.cameraTarget;
    return screenBounds({ position: cam.position, target: { x: t.x, y: 0, z: t.z }, fov: cam.fov, aspect: cam.aspect, margin: SCREEN_MARGIN });
  }

  /**
   * Bakes a roll (core roll()) on this view's tray, with the camera's reading direction filled in.
   * With no tray drawn (the 'none' look, or a transparent view) the dice are kept inside the screen's
   * edges instead of an invisible box (owner 2026-10-24), taken from the camera as it stands now; the
   * edges sound like walls of the tray's wall surface.
   */
  bake(request) {
    const edges = this.trayDrawn === false ? this.screenEdges() : null;
    const bounds = edges ? { bounds: edges.planes, area: { center: edges.center, width: edges.width, depth: edges.depth } } : {};
    // With no tray drawn the tray is only what the camera frames: its size is pinned to what it frames now, so the
    // roll's tray is this one and the play never reframes the camera away from the edges the dice were kept inside
    // (grown with the dice count, 16 dice stood the camera back 1.6× and bounced off walls well inside the screen).
    const fixed = edges ? { width: this.tray.width, depth: this.tray.depth } : {};
    // Each die wears a look (render/die-looks.js): a die at a place the same die held keeps the one it wears, any other is
    // dealt one from the bag — the result carries them (result.looks) for play to dress the dice in. Each die is made
    // of what its own finish says (FINISHES ▸ material: a metal die is heavy and dead, a wooden one light), unless the
    // request names a material for it.
    const types = (request.dice || []).map((d) => (typeof d === 'string' ? d : d.type));
    const looks = looksFor(types, this.wardrobe, this.bag);
    const dice = (request.dice || []).map((d, i) => {
      const material = FINISHES[looks[i].finish].material;
      if (!DIE_MATERIALS[material]) throw new Error('DiceView: the finish "' + looks[i].finish + '" names no die material (known: ' + Object.keys(DIE_MATERIALS).join(', ') + ')');
      return typeof d === 'string' ? { type: d, material } : { material, ...d };
    });
    const result = roll({ readUp: this.readUp, ...request, dice, tray: { ...this.trayOptions, ...fixed, ...bounds, ...(request.tray || {}) } });
    result.looks = looks;
    return result;
  }

  /** Bakes a roll and plays it, once every font the look can deal is ready to paint in. */
  async roll(request, playOptions = {}) {
    await this.readyFonts();
    const result = this.bake(request);
    await this.play(result, playOptions);
    return result;
  }

  /**
   * Plays a RollResult. Resolves when the dice have settled. onStart({ timeScale }) fires as the
   * roll's clock starts — the frame after the dice were first drawn at their start — timeScale is
   * roll seconds per real second, so a sound layer can schedule every hit ahead on its own clock;
   * onHit(dieIndex, speed, surface, other) fires as each recorded impact is reached on screen. A new
   * play() cancels the one in progress.
   *
   * fromTable: the first fromTable dice of the result are the dice on the table (a drop: bakeDrop),
   * in play order. They keep their meshes, so their look and their place in the marble carry on, and
   * one still showing its face keeps its highlight as it is rather than easing it in again.
   */
  play(result, { speed = this.o.speed, onHit = null, onStart = null, fromTable = 0 } = {}) {
    const timeScale = this.o.pace * speed;
    const most = Math.min(this.dice.length, result.dice.length);
    if (!(Number.isInteger(fromTable) && fromTable >= 0 && fromTable <= most)) throw new Error('DiceView.play: fromTable must be a whole number from 0 to ' + most + ', got ' + fromTable);
    result.dice.slice(0, fromTable).forEach((d, i) => {
      if (this.dice[i].die.type !== d.type) throw new Error('DiceView.play: die ' + i + ' on the table is a ' + this.dice[i].die.type + ', the result has a ' + d.type + ' there');
    });
    if (this.playing) this.playing.cancel();
    this.held = null;   // a play takes the dice from a hand too
    const carried = this.dice.slice(0, fromTable);
    for (const d of this.dice.slice(fromTable)) disposeDie(this.scene, d);
    this.dice = carried;   // a tray rebuilt below tells the carried dice whether it is drawn
    if (result.tray.width !== this.tray.width || result.tray.depth !== this.tray.depth) this.setTray(result.tray);
    this.dice = result.dice.map((d, i) => {
      if (i < fromTable) {
        const c = carried[i], die = c.die, meshFeature = die.featureOfValue.get(d.value);
        return { mesh: c.mesh, die, style: c.style, value: d.value, meshFeature, keep: facesShowing(die, meshFeature), steady: meshFeature === c.meshFeature, hitIndex: 0, index: i };
      }
      // The look its bake dealt it (render/die-looks.js): a die the table held keeps the one it wore.
      const style = (result.looks && result.looks[i]) || deal(this.bag);
      const { die, geometry, glyph } = this.atlasFor(d.type, style.font);
      const meshFeature = die.featureOfValue.get(d.value);
      const g = geometry.clone();
      g.userData = geometry.userData;
      // Each die its own material: its own place in the marble or granite (seed from the roll).
      const seed = (Math.imul((result.seedUsed >>> 0) ^ 0x9e3779b9, i + 1) >>> 0) / 4294967296;
      const material = dieMaterial(style.finish, style, glyph, seed, { radius: die.boundingRadius, onTray: this.trayDrawn });
      const mesh = new THREE.Mesh(g, material);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.scene.add(mesh);
      return { mesh, die, style, value: d.value, meshFeature, keep: facesShowing(die, meshFeature), steady: false, hitIndex: 0, index: i };
    });
    const duration = rollDuration(result);
    // The dice at roll time t (seconds): their poses and the highlight's dim — it eases in over the whole roll
    // (smoothstep), so nothing changes when the dice stop; darkening the other faces on the last frame read as a
    // lighting pop (owner 2026-10-24) — and, once the clock runs, the hits reached.
    const place = (t, hitsToo) => {
      const u = duration > 0 ? t / duration : 1, ease = u * u * (3 - 2 * u);
      const dim = 1 - (1 - this.o.dimOthers) * ease;
      this.dice.forEach((d) => {
        if (this.o.dimOthers < 1) setDim(d.mesh.geometry, d.keep, d.steady ? this.o.dimOthers : dim);
        const p = samplePose(result, d.index, t);
        d.mesh.position.set(p.position.x, p.position.y, p.position.z);
        d.mesh.quaternion.set(p.orientation.x, p.orientation.y, p.orientation.z, p.orientation.w);
        if (!hitsToo) return;
        const hits = result.dice[d.index].hits;
        while (onHit && d.hitIndex < hits.length && hits[d.hitIndex][0] <= t) {
          const [, s, surface, other] = hits[d.hitIndex++];
          try { onHit(d.index, s, surface, other); } catch (e) { console.error('DiceView onHit threw:', e); }
        }
      });
    };
    return new Promise((resolve) => {
      let cancelled = false, start = null, drawn = false;
      let tNow = 0;   // where in the roll the frame just drawn stands (liveTable reads the dice's motion there)
      this.playing = { cancel: () => { cancelled = true; resolve(result); }, result, time: () => tNow };
      this.animate((now) => {
        if (cancelled) return false;
        // The first frame only puts the dice at the roll's start and is drawn; the clock starts from the NEXT frame's
        // time. Whatever the GPU must build to draw them the first time (a pipeline, a buffer: 0.6 s after a reload on
        // a desktop, measured 2026-10-28; warmTable does it ahead) is then spent before the roll, never skipped from
        // it — the die used to pop from the air onto the floor.
        if (!drawn) { drawn = true; if (duration > 0) { place(0, false); return true; } }
        if (start === null) {
          start = now;
          if (onStart) { try { onStart({ timeScale }); } catch (e) { console.error('DiceView onStart threw:', e); } }
        }
        const t = tNow = Math.min(duration, ((now - start) / 1000) * timeScale);
        place(t, true);
        if (t >= duration) {
          this.playing = null;
          resolve(result);
          return false;   // the frame loop renders this last pose
        }
        return true;
      });
    });
  }

  dispose() {
    if (this.playing) this.playing.cancel();
    for (const r of [...this.exiting]) r.finish();
    this.animators.clear();
    for (const w of this.warm.values()) w.dispose();
    for (const w of this.warmed.values()) w.dispose();
    this.clear();
    this.resizeObserver.disconnect();
    for (const a of this.atlases.values()) { a.geometry.dispose(); for (const g of a.glyphs.values()) g.dispose(); }
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}

/** Takes a die's mesh out of the scene and frees its geometry and material. */
function disposeDie(scene, d) {
  scene.remove(d.mesh);
  d.mesh.geometry.dispose();
  d.mesh.material.dispose();
}

/**
 * A tray surface material: the look's base colour through the shared pattern library in WORLD
 * space (felt fibres, wood grain, granite), with the specular cut like the dice's.
 */
function patternedMaterial(look) {
  const uniforms = patternUniforms(THREE, { pattern: look.pattern, base: look.color });
  const m = new THREE.MeshPhysicalMaterial({ color: look.color, roughness: look.roughness, metalness: 0, specularIntensity: SPECULAR });
  m.onBeforeCompile = (shader) => injectPattern(shader, uniforms, 'world');
  m.customProgramCacheKey = () => 'tray-pattern';
  return m;
}
