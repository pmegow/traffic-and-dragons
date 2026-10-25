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
import { roll, samplePose, rollDuration, buildDie, trayFor } from '../src/index.js';
import { buildDieGeometry, setDim, paintGlyphMask, loadNumeralFont, facesShowing } from './die-mesh.js';
import { VIEW_DEFAULTS, viewOptions } from './view-defaults.js';
import { orbitPose, standCamera, blendOrbit } from './framing.js';
import { dieMaterial, recolour, setGlyph, setOnTray, FINISHES } from './finishes.js';
import { NUMERAL_FONTS } from './numeral-fonts.js';
import { SURFACE_LOOKS, RIM_LOOK } from './surface-looks.js';
import { SPECULAR } from './finish-table.js';
import { patternUniforms, injectPattern } from './patterns.js';
import { LIGHTS } from './lights.js';

export { SURFACE_LOOKS };

export { LIGHTS };   // render/lights.js

export { VIEW_DEFAULTS };

const RIM_HEIGHT = 0.014;   // m: the tray's rim, low enough that a die resting against the near wall stays in view

export class DiceView {
  constructor(options = {}) {
    const o = viewOptions(options);
    if (!o.container) throw new Error('DiceView: options.container (an element to draw into) is required');
    this.o = o;
    this.orbitPose = { yaw: 0, pitch: o.tilt, zoom: 1 };   // where the camera stands round the tray (view.orbit, view.zoom)
    this.orbitTween = null;
    this.trayOptions = { ...o.tray };          // what the host fixed; the rest follows each roll's dice count
    this.tray = trayFor(1, this.trayOptions);
    this.lookName = SURFACE_LOOKS[this.tray.surface] ? this.tray.surface : 'felt';   // how the tray is drawn (SURFACE_LOOKS)
    this.container = o.container;
    this.dice = [];
    this.atlases = new Map();
    this.playing = null;

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
      light.shadow.radius = 6;
      this.scene.add(light);
      this.scene.add(light.target);
      return { spec, light };
    });
  }

  /** Puts each light on its side of the camera's view and sizes its shadow to cover the tray. */
  placeLights() {
    const cam = this.camera.position;
    const toCam = new THREE.Vector3(cam.x, 0, cam.z).normalize();
    const right = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), toCam).normalize();   // screen right on the floor
    const reach = Math.hypot(this.tray.width, this.tray.depth) / 2 + 0.05;
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
    const floorGeo = new THREE.PlaneGeometry(W, D);
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
    cam.position.set(p.x, p.y, p.z);
    cam.lookAt(0, 0, 0);
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

  /** The opening pose: `tilt` degrees up, no turn, no zoom. */
  get homePose() { return { yaw: 0, pitch: this.o.tilt, zoom: 1 }; }

  /** True once the camera has been turned or zoomed away from where the view opened. */
  get orbitMoved() {
    const p = this.orbitPose, h = this.homePose;
    return Math.abs(p.yaw - h.yaw) > 1e-6 || Math.abs(p.pitch - h.pitch) > 1e-6 || Math.abs(p.zoom - h.zoom) > 1e-6;
  }

  /**
   * Back to where the view opened, eased over `seconds` (default resetSeconds) so the camera glides
   * home rather than jumping; 0 jumps. A turn or zoom by the player while it eases takes over.
   * Resolves when the camera is home (or the player took over).
   */
  resetOrbit({ seconds = this.o.resetSeconds } = {}) {
    const from = { ...this.orbitPose }, to = this.homePose;
    if (!(seconds > 0)) { this.setOrbit(to); return Promise.resolve(); }
    const token = {};
    this.orbitTween = token;
    return new Promise((resolve) => {
      let start = null;
      const step = (now) => {
        if (this.orbitTween !== token) { resolve(); return; }
        if (start === null) start = now;
        const u = Math.min(1, (now - start) / 1000 / seconds), e = u * u * (3 - 2 * u);
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

  /** The point on the tray floor under a client (page) position, or null when off the floor. */
  floorPoint(clientX, clientY) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    const ray = new THREE.Raycaster();
    ray.setFromCamera(ndc, this.camera);
    const p = new THREE.Vector3();
    if (!ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), p)) return null;
    if (Math.abs(p.x) > this.tray.width / 2 || Math.abs(p.z) > this.tray.depth / 2) return null;
    return { x: p.x, z: p.z };
  }

  /** The floor direction that reads as "up" on screen: away from the camera. */
  get readUp() {
    const d = new THREE.Vector3().subVectors(new THREE.Vector3(0, 0, 0), this.camera.position);
    d.y = 0;
    d.normalize();
    return { x: d.x, y: 0, z: d.z };
  }

  render() { this.renderer.render(this.scene, this.camera); }

  // ---------------------------------------------------------------- dice
  /**
   * A die type's rounded geometry (built once) and its numeral mask in the current font (built once
   * per font). Colours and finish are the material's.
   */
  atlasFor(type) {
    if (!this.atlases.has(type)) {
      const die = buildDie(type);
      this.atlases.set(type, { die, geometry: buildDieGeometry(die), glyphs: new Map() });
    }
    const a = this.atlases.get(type);
    const font = this.o.dieStyle.font;
    if (!a.glyphs.has(font)) a.glyphs.set(font, paintGlyphMask(a.die, a.geometry.userData.layout, NUMERAL_FONTS[font]));
    return { die: a.die, geometry: a.geometry, glyph: a.glyphs.get(font) };
  }

  /**
   * Changes the dice's look — {body, ink} colours, the finish (FINISHES) and the numeral font
   * (NUMERAL_FONTS) — for the dice on the tray now and every roll after. Colours change in place; a
   * new finish rebuilds the materials; a new font is loaded first (it may be a file) and repaints
   * the numerals. Resolves when the change is on screen.
   */
  async setDieStyle(style) {
    const next = { ...this.o.dieStyle, ...style };
    if (!FINISHES[next.finish]) throw new Error('DiceView: no finish "' + next.finish + '" (known: ' + Object.keys(FINISHES).join(', ') + ')');
    if (!NUMERAL_FONTS[next.font]) throw new Error('DiceView: no numeral font "' + next.font + '" (known: ' + Object.keys(NUMERAL_FONTS).join(', ') + ')');
    if (next.font !== this.o.dieStyle.font) await loadNumeralFont(NUMERAL_FONTS[next.font]);
    const refinish = next.finish !== this.o.dieStyle.finish;
    this.o.dieStyle = next;
    for (const d of this.dice) {
      const { glyph } = this.atlasFor(d.die.type);
      if (refinish) {
        const old = d.mesh.material;
        d.mesh.material = dieMaterial(next.finish, next, glyph, old.userData.dice.seed, { radius: d.die.boundingRadius, onTray: this.trayDrawn });
        old.dispose();
      } else {
        recolour(d.mesh.material, next);
        setGlyph(d.mesh.material, glyph);
      }
    }
    this.render();
  }

  clear() {
    for (const d of this.dice) { this.scene.remove(d.mesh); d.mesh.geometry.dispose(); d.mesh.material.dispose(); }
    this.dice = [];
    this.render();
  }

  /** Bakes a roll (core roll()) on this view's tray, with the camera's reading direction filled in. */
  bake(request) {
    return roll({ readUp: this.readUp, ...request, tray: { ...this.trayOptions, ...(request.tray || {}) } });
  }

  /** Bakes a roll and plays it. */
  async roll(request, playOptions = {}) {
    const result = this.bake(request);
    await this.play(result, playOptions);
    return result;
  }

  /**
   * Plays a RollResult. Resolves when the dice have settled. onStart({ timeScale }) fires on the
   * first frame — timeScale is roll seconds per real second, so a sound layer can schedule every
   * hit ahead on its own clock; onHit(dieIndex, speed, surface, other) fires as each recorded impact
   * is reached on screen. A new play() cancels the one in progress.
   */
  play(result, { speed = this.o.speed, onHit = null, onStart = null } = {}) {
    const timeScale = this.o.pace * speed;
    if (this.playing) this.playing.cancel();
    this.clear();
    if (result.tray.width !== this.tray.width || result.tray.depth !== this.tray.depth) this.setTray(result.tray);
    this.dice = result.dice.map((d, i) => {
      const { die, geometry, glyph } = this.atlasFor(d.type);
      const g = geometry.clone();
      g.userData = geometry.userData;
      // Each die its own material: its own place in the marble or granite (seed from the roll).
      const seed = (Math.imul((result.seedUsed >>> 0) ^ 0x9e3779b9, i + 1) >>> 0) / 4294967296;
      const material = dieMaterial(this.o.dieStyle.finish, this.o.dieStyle, glyph, seed, { radius: die.boundingRadius, onTray: this.trayDrawn });
      const mesh = new THREE.Mesh(g, material);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.scene.add(mesh);
      const meshFeature = die.featureOfValue.get(d.value);
      return { mesh, die, meshFeature, keep: facesShowing(die, meshFeature), hitIndex: 0, index: i };
    });
    const duration = rollDuration(result);
    return new Promise((resolve) => {
      let cancelled = false, start = null;
      this.playing = { cancel: () => { cancelled = true; resolve(result); } };
      const frame = (now) => {
        if (cancelled) return;
        if (start === null) {
          start = now;
          if (onStart) { try { onStart({ timeScale }); } catch (e) { console.error('DiceView onStart threw:', e); } }
        }
        const t = Math.min(duration, ((now - start) / 1000) * timeScale);
        // The result's highlight eases in over the whole roll (smoothstep), so nothing changes when
        // the dice stop. Darkening the other faces on the last frame read as a lighting pop (owner
        // 2026-10-24).
        const u = duration > 0 ? t / duration : 1, ease = u * u * (3 - 2 * u);
        const dim = 1 - (1 - this.o.dimOthers) * ease;
        this.dice.forEach((d) => {
          if (this.o.dimOthers < 1) setDim(d.mesh.geometry, d.keep, dim);
          const p = samplePose(result, d.index, t);
          d.mesh.position.set(p.position.x, p.position.y, p.position.z);
          d.mesh.quaternion.set(p.orientation.x, p.orientation.y, p.orientation.z, p.orientation.w);
          const hits = result.dice[d.index].hits;
          while (onHit && d.hitIndex < hits.length && hits[d.hitIndex][0] <= t) {
            const [, s, surface, other] = hits[d.hitIndex++];
            try { onHit(d.index, s, surface, other); } catch (e) { console.error('DiceView onHit threw:', e); }
          }
        });
        if (t >= duration) {
          this.render();
          this.playing = null;
          resolve(result);
          return;
        }
        this.render();
        requestAnimationFrame(frame);
      };
      requestAnimationFrame(frame);
    });
  }

  dispose() {
    if (this.playing) this.playing.cancel();
    this.clear();
    this.resizeObserver.disconnect();
    for (const a of this.atlases.values()) { a.geometry.dispose(); for (const g of a.glyphs.values()) g.dispose(); }
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
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
