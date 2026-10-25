// demo/demo.js — the standalone dice toy: a thin shell over DiceView, DiceAudio and the core's roll().
import { DiceView, VIEW_DEFAULTS, FINISHES, SURFACE_LOOKS, NUMERAL_FONTS } from '../render/index.js';
import { DiceAudio } from '../audio/index.js';
import { createPressGesture } from '../input/press-gesture.js';
import { createPinch } from '../input/pinch.js';
import { createPresetStore } from './preset-store.js';
import { sameLook } from '../render/presets.js';
import { VERSION, parseNotation, dieTypes, samplePose } from '../src/index.js';

const $ = (id) => document.getElementById(id);
const status = (msg) => { $('status').textContent = msg || ''; };

let view;
try {
  view = new DiceView({ container: $('stage') });
} catch (e) {
  status('Could not start the 3D view: ' + e.message);
  throw e;
}
$('version').textContent = 'v' + VERSION;

// ---------------------------------------------------------------- sound
const audio = new DiceAudio();
let audioState = 'loading';   // loading → ready (waiting for a tap) → on | failed
const soundLine = () => {
  const words = { loading: 'Loading sound…', ready: 'Tap Roll or the tray to start sound.', on: '', failed: '' };
  $('sound-state').textContent = $('sound').checked ? words[audioState] : '';
};
audio.load().then(() => { audioState = 'ready'; soundLine(); }).catch((e) => {
  audioState = 'failed';
  status('Sound is off: ' + e.message);
  console.error(e);
  soundLine();
});
soundLine();
/**
 * Starts sound from inside a gesture; resolves once it is settled either way. Never rejects: a
 * failure is shown and the roll goes on silently.
 */
function unlockSound() {
  if (audioState !== 'ready' && audioState !== 'on') return Promise.resolve();
  return audio.unlock().then((ok) => { if (ok) { audioState = 'on'; soundLine(); } }).catch((e) => { audioState = 'failed'; status('Sound is off: ' + e.message); });
}
const soundOn = () => $('sound').checked && audioState === 'on';
$('sound').addEventListener('change', () => { audio.setMuted(!$('sound').checked); if ($('sound').checked) unlockSound(); soundLine(); });

window.__dice = { view, audio };   // the test seam: drive the page from a script

// ---------------------------------------------------------------- panel
for (const t of dieTypes()) {
  const b = document.createElement('button');
  b.className = 'add';
  b.type = 'button';
  b.textContent = t;
  b.title = 'Add a ' + t;
  b.addEventListener('click', () => {
    const cur = $('notation').value.trim();
    $('notation').value = cur ? cur + ' + ' + t : t;
  });
  $('adders').appendChild(b);
}

for (const [key, look] of Object.entries(SURFACE_LOOKS)) {
  const o = document.createElement('option');
  o.value = key;
  o.textContent = look.label;
  $('surface').appendChild(o);
}
const applySurface = () => {
  view.setSurface($('surface').value);
  $('stage').dataset.surface = $('surface').value;
};

// ---------------------------------------------------------------- the dice's look (all dice at once)
const LOOK_KEY = 'dice-sim:look';
const PRESETS_PROBE = 'dice-sim:presets';
for (const [key, f] of Object.entries(FINISHES)) {
  const o = document.createElement('option');
  o.value = key;
  o.textContent = f.label;
  $('finish').appendChild(o);
}
for (const [key, f] of Object.entries(NUMERAL_FONTS)) {
  const o = document.createElement('option');
  o.value = key;
  o.textContent = f.label;
  $('font').appendChild(o);
}
// The controls open on the view's own defaults (render/view-defaults.js), never a second copy in the HTML.
$('body-color').value = VIEW_DEFAULTS.dieStyle.body;
$('ink-color').value = VIEW_DEFAULTS.dieStyle.ink;
$('finish').value = VIEW_DEFAULTS.dieStyle.finish;
$('font').value = VIEW_DEFAULTS.dieStyle.font;
$('surface').value = VIEW_DEFAULTS.tray.surface;
$('speed').value = VIEW_DEFAULTS.speed;
$('tray').value = VIEW_DEFAULTS.tray.scale;
$('speed-out').textContent = Number($('speed').value).toFixed(2) + '×';
$('tray-out').textContent = Number($('tray').value).toFixed(2) + '×';
const look = () => ({ body: $('body-color').value, ink: $('ink-color').value, finish: $('finish').value, font: $('font').value, surface: $('surface').value });
try {
  // A per-viewer convenience: the last look chosen on this browser (fine to lose).
  const saved = JSON.parse(localStorage.getItem(LOOK_KEY) || 'null');
  if (saved && FINISHES[saved.finish]) { $('body-color').value = saved.body; $('ink-color').value = saved.ink; $('finish').value = saved.finish; }
  if (saved && SURFACE_LOOKS[saved.surface]) $('surface').value = saved.surface;
  if (saved && NUMERAL_FONTS[saved.font]) $('font').value = saved.font;
} catch { /* storage blocked: the defaults stand */ }
// ---------------------------------------------------------------- presets (owner 2026-10-24)
// A preset is the dice's look — body and number colours, finish, font — under a name: the built-ins
// (render/presets.js) and the ones saved on this browser (demo/preset-store.js).
const currentStyle = () => { const { body, ink, finish, font } = look(); return { body, ink, finish, font }; };
const presetStorage = (() => {
  try { const s = window.localStorage; s.getItem(PRESETS_PROBE); return s; } catch (e) {
    console.warn('presets: this browser\'s storage is blocked, so saved presets last only this page', e);
    const items = new Map();   // the page's own memory, so saving still works until it closes
    return { blocked: true, getItem: (k) => (items.has(k) ? items.get(k) : null), setItem: (k, v) => { items.set(k, String(v)); } };
  }
})();
const presetStore = createPresetStore(presetStorage);
{
  const problems = [];
  if (presetStorage.blocked) problems.push('This browser blocks storage: saved presets will last only until the page closes.');
  if (presetStore.loadProblem) problems.push(presetStore.loadProblem);
  if (presetStore.dropped.length) problems.push('Some saved presets were left out: ' + presetStore.dropped.join('; ') + '.');
  for (const { from, to } of presetStore.renamed) problems.push('A built-in preset is now called "' + from + '", so your own saved "' + from + '" is now "' + to + '".');
  if (problems.length) { console.warn('presets:', problems.join(' ')); status(problems.join(' ')); }
}
/** The picker shows the preset the dice are wearing, or "Custom look"; Delete only for a saved one. */
const syncPreset = () => {
  const style = currentStyle();
  const chosen = presetStore.find($('preset').value);
  const showing = chosen && sameLook(chosen, style) ? chosen : presetStore.match(style);
  $('preset').value = showing ? showing.name : '';
  $('preset-delete').disabled = !showing || showing.builtIn;
};
const fillPresets = (select = null) => {
  const picker = $('preset');
  picker.textContent = '';
  const custom = new Option('Custom look', '');
  custom.disabled = true;
  picker.add(custom);
  for (const [label, builtIn] of [['Built in', true], ['Saved', false]]) {
    const items = presetStore.list().filter((p) => p.builtIn === builtIn);
    if (!items.length) continue;
    const group = document.createElement('optgroup');
    group.label = label;
    for (const p of items) group.appendChild(new Option(p.name, p.name));
    picker.appendChild(group);
  }
  if (select) picker.value = select;
  syncPreset();
};
const savePreset = () => {
  const name = $('preset-name').value.trim();
  if (!name) { status('Name the look first, then save it.'); $('preset-name').focus(); return; }
  try {
    presetStore.save(name, currentStyle());
    status('');
    fillPresets(presetStore.find(name).name);
  } catch (e) { status(e.message); console.error('presets:', e); }
};
$('preset').addEventListener('change', () => {
  const p = presetStore.find($('preset').value);
  if (!p) return;
  $('body-color').value = p.body;
  $('ink-color').value = p.ink;
  $('finish').value = p.finish;
  $('font').value = p.font;
  if (!p.builtIn) $('preset-name').value = p.name;
  applyLook();
});
$('preset-save').addEventListener('click', savePreset);
$('preset-name').addEventListener('keydown', (e) => {
  if (e.key !== 'Enter') return;
  e.preventDefault();
  e.stopPropagation();   // Enter here saves the preset; it is not a roll
  savePreset();
});
$('preset-delete').addEventListener('click', () => {
  const name = $('preset').value;
  try {
    presetStore.remove(name);
    $('preset-name').value = name;   // the look is still on the dice: Save brings the preset straight back
    status('');
    fillPresets();
  } catch (e) { status(e.message); console.error('presets:', e); }
});

const applyLook = () => {
  const { body, ink, finish, font } = look();
  view.setDieStyle({ body, ink, finish, font }).catch((e) => { status('Could not change the look: ' + e.message); console.error(e); });
  try { localStorage.setItem(LOOK_KEY, JSON.stringify(look())); } catch { /* storage blocked */ }
  syncPreset();
};
fillPresets();
applyLook();
applySurface();
$('surface').addEventListener('change', () => { applySurface(); applyLook(); });
for (const id of ['body-color', 'ink-color']) $(id).addEventListener('input', applyLook);
$('finish').addEventListener('change', applyLook);
$('font').addEventListener('change', applyLook);
$('clear-dice').addEventListener('click', () => { $('notation').value = ''; $('notation').focus(); });
const speed = () => Number($('speed').value);
$('speed').addEventListener('input', () => { $('speed-out').textContent = speed().toFixed(2) + '×'; });
$('tray').addEventListener('input', () => {
  $('tray-out').textContent = Number($('tray').value).toFixed(2) + '×';
  view.setTrayScale(Number($('tray').value));
});

/** The roll request the panel describes (throws a readable error for a bad field). */
function request(extra = {}) {
  const types = parseNotation($('notation').value);
  const forcedText = $('forced').value.trim();
  const forced = forcedText ? forcedText.split(/[\s,]+/).map((x) => {
    const v = Number(x);
    if (!Number.isInteger(v)) throw new Error('Force results: "' + x + '" is not a whole number');
    return v;
  }) : [];
  if (forced.length > types.length) throw new Error('Force results: ' + forced.length + ' values for ' + types.length + ' dice');
  const seedText = $('seed').value.trim();
  const seed = seedText ? Number(seedText) : undefined;
  if (seedText && !Number.isInteger(seed)) throw new Error('Seed: "' + seedText + '" is not a whole number');
  return {
    dice: types.map((type, i) => (forced[i] !== undefined ? { type, value: forced[i] } : type)),
    seed,
    ...extra,
  };
}

let last = null;
let current = 0;   // the newest roll; an older one still playing is abandoned

/** Plays a baked roll with its clicks scheduled on the audio clock. */
function playWithSound(result) {
  return view.play(result, {
    speed: speed(),
    onStart: ({ timeScale }) => {
      if (!soundOn()) return;
      audio.scheduleRoll(result, { timeScale, pan: (i, t) => 0.7 * view.panFor(samplePose(result, i, t).position) });
    },
  });
}

async function go(req, { unlocking = Promise.resolve() } = {}) {
  const mine = ++current;
  status('');
  audio.stop();
  let result, bakeMs;
  try {
    const t0 = performance.now();
    result = view.bake(req);
    bakeMs = performance.now() - t0;
  } catch (e) {
    status(e.message);
    console.error(e);
    return;
  }
  show(null);
  await unlocking;   // the first tap starts sound; the roll waits for it so its clicks play
  if (mine !== current) return;
  await playWithSound(result);
  if (mine !== current) return;   // a newer roll took over the tray
  last = { result, bakeMs };
  show(result, bakeMs);
}

function show(result, bakeMs) {
  if (!result) { $('total').textContent = '…'; $('faces').textContent = ''; $('meta').textContent = ''; return; }
  $('total').textContent = String(result.total);
  $('faces').textContent = result.dice.length > 1 ? result.dice.map((d) => d.type + ': ' + d.value + (d.forced ? '*' : '')).join('   ') : result.dice[0].type + (result.dice[0].forced ? ' (forced)' : '');
  $('meta').textContent = 'seed ' + result.seed + ' · ' + result.attempts + (result.attempts === 1 ? ' throw' : ' throws') +
    ' · settled in ' + result.duration.toFixed(2) + ' s · baked in ' + bakeMs.toFixed(0) + ' ms';
}

function rollFromPanel(extra, options) {
  let req;
  try { req = request(extra); } catch (e) { status(e.message); return; }
  go(req, options);
}

$('roll').addEventListener('click', () => rollFromPanel(undefined, { unlocking: unlockSound() }));
$('replay').addEventListener('click', () => {
  if (!last) { status('Nothing to replay yet.'); return; }
  unlockSound();
  ++current;
  audio.stop();
  playWithSound(last.result);
});
document.addEventListener('keydown', (e) => {
  if (e.code === 'Space' && !/INPUT|SELECT|TEXTAREA|BUTTON/.test(document.activeElement.tagName)) { e.preventDefault(); rollFromPanel(undefined, { unlocking: unlockSound() }); }
  if (e.key === 'Enter' && document.activeElement.tagName === 'INPUT') rollFromPanel(undefined, { unlocking: unlockSound() });
});

// ---------------------------------------------------------------- a press: tap, throw, turn or zoom the view
// input/press-gesture.js decides what a press is. A tap rolls, a drag across the tray throws, a
// press held still for a moment turns the camera as it drags, with a ring round the pointer while it
// does, and a right-button drag or a two-finger pinch zooms (owner 2026-10-24). Reset view eases
// the camera home. Each press follows its own pointer: another finger's moves are the pinch's.
const stage = $('stage');
const ring = $('orbit-ring');
const resetButton = $('reset-view');
const ORBIT_DEG_PER_PX = { yaw: 0.4, pitch: 0.3 };
const ZOOM_PER_PX = 0.006;   // a right-drag of 100 px up brings the camera to 0.55 of its distance
const syncReset = () => { resetButton.hidden = !view.orbitMoved; };
resetButton.addEventListener('pointerdown', (e) => e.stopPropagation());   // a press on the button is not a press on the tray
resetButton.addEventListener('click', () => {
  resetButton.hidden = true;
  view.resetOrbit().then(syncReset);
});
const gesture = createPressGesture();
const pinch = createPinch();   // touch pointers only: a mouse has one
let press = null, holdTimer = 0;
const placeRing = (x, y) => {
  const r = stage.getBoundingClientRect();
  ring.style.left = (x - r.left) + 'px';
  ring.style.top = (y - r.top) + 'px';
};
const endPress = () => {
  clearTimeout(holdTimer);
  stage.classList.remove('orbiting', 'zooming');
  const d = press;
  press = null;
  return d;
};
stage.addEventListener('pointerdown', (e) => {
  const secondary = e.pointerType === 'mouse' && e.button === 2;
  if (e.pointerType === 'mouse' && e.button !== 0 && !secondary) return;   // the middle button does nothing
  try { stage.setPointerCapture(e.pointerId); } catch { /* capture is a nicety: without it a drag that leaves the tray still ends on pointerup here */ }
  if (e.pointerType === 'touch' && pinch.down(e.pointerId, e.clientX, e.clientY)) {
    // A second finger: the first finger's press becomes a pinch, and never taps, throws or turns.
    gesture.cancel();
    endPress();
    return;
  }
  if (pinch.active) return;   // a further finger while a pinch is under way
  if (secondary) {   // a right-button drag zooms at once
    press = { id: e.pointerId, start: null, samples: [], at: { x: e.clientX, y: e.clientY } };
    gesture.down(e.timeStamp, e.clientX, e.clientY, 'secondary');
    stage.classList.add('zooming');
    return;
  }
  const p = view.floorPoint(e.clientX, e.clientY);            // null off the floor: no throw, but the view still turns
  press = { id: e.pointerId, start: p, samples: p ? [{ t: e.timeStamp, p }] : [], at: { x: e.clientX, y: e.clientY }, unlocking: unlockSound() };
  gesture.down(e.timeStamp, e.clientX, e.clientY);
  clearTimeout(holdTimer);
  holdTimer = setTimeout(() => {
    if (!press || !gesture.hold(performance.now())) return;
    placeRing(press.at.x, press.at.y);
    stage.classList.add('orbiting');
  }, gesture.holdMs);
});
stage.addEventListener('pointermove', (e) => {
  if (e.pointerType === 'touch') {
    const z = pinch.move(e.pointerId, e.clientX, e.clientY);
    if (z) { view.zoom(z.factor); syncReset(); return; }   // fingers apart to come nearer, together to stand back
    if (pinch.active) return;
  }
  if (!press || e.pointerId !== press.id) return;
  press.at = { x: e.clientX, y: e.clientY };
  const m = gesture.move(e.timeStamp, e.clientX, e.clientY);
  if (m && m.kind === 'orbit') {
    placeRing(e.clientX, e.clientY);
    view.orbit(-m.dx * ORBIT_DEG_PER_PX.yaw, m.dy * ORBIT_DEG_PER_PX.pitch);   // the tray turns with the hand
    syncReset();
    return;
  }
  if (m && m.kind === 'zoom') {
    view.zoom(Math.exp(m.dy * ZOOM_PER_PX));   // drag up to come nearer, down to stand back
    syncReset();
    return;
  }
  if (!press.start) return;
  const p = view.floorPoint(e.clientX, e.clientY);
  if (p) press.samples.push({ t: e.timeStamp, p });
  if (press.samples.length > 40) press.samples.shift();
});
stage.addEventListener('pointerup', (e) => {
  if (e.pointerType === 'touch' && pinch.up(e.pointerId) === 'pinch') return;   // a finger off a pinch: never a roll
  if (!press || e.pointerId !== press.id) return;
  const kind = gesture.up();
  const d = endPress();
  if (kind === 'orbit' || kind === 'zoom' || !d.start) return;   // a turn or zoom of the view, or a press that began off the floor
  const end = d.samples[d.samples.length - 1];
  const from = d.samples.find((s) => end.t - s.t <= 90) || d.samples[0];
  const dt = (end.t - from.t) / 1000;
  const vx = dt > 0 ? (end.p.x - from.p.x) / dt : 0, vz = dt > 0 ? (end.p.z - from.p.z) / dt : 0;
  const v = Math.hypot(vx, vz);
  if (v < 0.25) { rollFromPanel(undefined, { unlocking: d.unlocking }); return; }   // a tap, not a fling: the default toss
  const k = Math.min(3.2, Math.max(0.6, v)) / v;
  rollFromPanel({ throw: { fling: { from: d.start, velocity: { x: vx * k, z: vz * k } } } }, { unlocking: d.unlocking });
});
stage.addEventListener('pointercancel', (e) => {
  if (e.pointerType === 'touch') pinch.up(e.pointerId);
  if (press && e.pointerId === press.id) { gesture.cancel(); endPress(); }
});
stage.addEventListener('gesturestart', (e) => e.preventDefault());   // Safari's own pinch would zoom the page
stage.addEventListener('contextmenu', (e) => e.preventDefault());   // a long press turns the view and a right-drag zooms: no menu

// ---------------------------------------------------------------- offline (the installed web app)
// sw.js keeps the app for offline use and the Home Screen. Not on a development server, where a
// cache-first worker would serve old files while they are being edited — unless ?sw asks for it.
if ('serviceWorker' in navigator) {
  const devServer = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
  if (!devServer || new URLSearchParams(location.search).has('sw')) {
    navigator.serviceWorker.register('./sw.js', { scope: './' })
      .catch((e) => console.warn('offline: the service worker did not register, so the app needs the network', e));
  }
}

rollFromPanel();
