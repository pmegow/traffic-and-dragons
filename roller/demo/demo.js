// demo/demo.js — the standalone dice toy: a thin shell over DiceView, DiceAudio and the core's roll().
import { DiceView, VIEW_DEFAULTS, FINISHES, SURFACE_LOOKS, NUMERAL_FONTS } from '../render/index.js';
import { DiceAudio } from '../audio/index.js';
import { createPressGesture } from '../input/press-gesture.js';
import { createPinch } from '../input/pinch.js';
import { createPresetStore } from './preset-store.js';
import { createDrawer } from './drawer.js';
import { sameLook } from '../render/presets.js';
import { VERSION, dieTypes, samplePose, MAX_DICE } from '../src/index.js';
import { createDicePicker, tableChanges, groupDice } from './dice-picker.js';
import { EXIT_TABLE, exitDelays } from '../render/exit-table.js';

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
// Sound never holds a roll or a drop back: a start that does not come (no gesture, a browser that
// keeps the audio asleep) is waited for this long at most, and the dice go on silent.
const SOUND_WAIT_MS = 250;
const soon = (p) => Promise.race([p, new Promise((r) => setTimeout(r, SOUND_WAIT_MS))]);
$('sound').addEventListener('change', () => { audio.setMuted(!$('sound').checked); if ($('sound').checked) unlockSound(); soundLine(); });

window.__dice = { view, audio };   // the test seam: drive the page from a script

// ---------------------------------------------------------------- panel
// The dice: chosen only with these buttons (demo/dice-picker.js), kept on this browser; one of each to start.
const DICE_KEY = 'dice-sim:dice';
const HOLD_TO_REMOVE_MS = 1000;   // a press held this long on a die button takes one off (touch screens)
let savedDice = null;
try { savedDice = JSON.parse(localStorage.getItem(DICE_KEY) || 'null'); } catch { /* storage blocked: one of each */ }
const picker = createDicePicker({ types: dieTypes(), max: MAX_DICE, counts: savedDice || Object.fromEntries(dieTypes().map((t) => [t, 1])) });
const adders = {};
const paintDice = () => {
  for (const t of dieTypes()) {
    const c = picker.count(t), a = adders[t];
    a.count.textContent = String(c);
    a.count.hidden = c === 0;
    // Full: dimmed but never disabled, because a disabled button would also refuse the right-click and
    // the hold that take a die off.
    a.add.classList.toggle('full', picker.full);
    a.add.setAttribute('aria-disabled', String(picker.full));
    a.add.title = (picker.full ? 'The roll is full (' + picker.max + ' dice)' : 'Add a ' + t) + '; right-click, or press and hold, to take one off';
    a.add.setAttribute('aria-label', 'Add a ' + t + ' (' + c + ' in the roll)');
  }
  $('clear-all').disabled = picker.total === 0;
  $('dice-shown').textContent = picker.notation();
  $('roll').disabled = picker.total === 0;
  try { localStorage.setItem(DICE_KEY, JSON.stringify(picker.counts())); } catch { /* storage blocked */ }
};
for (const t of dieTypes()) {
  const add = document.createElement('button');
  add.className = 'add';
  add.type = 'button';
  add.textContent = t;
  const count = document.createElement('span');
  count.className = 'count';
  count.setAttribute('aria-hidden', 'true');
  add.appendChild(count);
  // Taking one off (owner 2026-10-25): a right-click with a mouse, one per click; on a touch screen,
  // pressing and holding for HOLD_TO_REMOVE_MS, and the release that ends the hold adds nothing. A
  // long press's own context menu (Android) is not a second removal.
  let removeTimer = 0, held = false, touchPress = false;
  add.addEventListener('pointerdown', (e) => {
    touchPress = e.pointerType !== 'mouse';
    held = false;
    clearTimeout(removeTimer);
    if (touchPress) removeTimer = setTimeout(() => { held = true; if (picker.remove(t)) diceChanged(); }, HOLD_TO_REMOVE_MS);
  });
  for (const type of ['pointerup', 'pointercancel', 'pointerleave']) add.addEventListener(type, () => clearTimeout(removeTimer));
  add.addEventListener('click', () => {
    if (held) { held = false; return; }
    soundFromTap = unlockSound();
    if (picker.add(t)) diceChanged();
  });
  add.addEventListener('contextmenu', (e) => { e.preventDefault(); if (!touchPress && picker.remove(t)) diceChanged(); });
  $('adders').appendChild(add);
  adders[t] = { add, count };
}
const clearAll = document.createElement('button');
clearAll.className = 'add';
clearAll.id = 'clear-all';
clearAll.type = 'button';
clearAll.textContent = 'Clear';
clearAll.title = 'Take every die out';
clearAll.addEventListener('click', clearDice);
$('adders').appendChild(clearAll);
// How a die leaves the table (owner 2026-10-25): the exits in render/exit-table.js, kept on this browser.
const EXIT_KEY = 'dice-sim:exit';
for (const [key, e] of Object.entries(EXIT_TABLE)) {
  const o = document.createElement('option');
  o.value = key;
  o.textContent = e.label;
  $('exit').appendChild(o);
}
try { const saved = localStorage.getItem(EXIT_KEY); if (EXIT_TABLE[saved]) $('exit').value = saved; } catch { /* storage blocked: the first */ }
$('exit').addEventListener('change', () => { try { localStorage.setItem(EXIT_KEY, $('exit').value); } catch { /* storage blocked */ } });
$('table-hint').textContent = (window.matchMedia('(pointer: coarse)').matches ? 'Tap' : 'Click') + ' the table to roll';
// The row floats over the tray: a press on it is not a press on the tray (no roll, throw, turn or pinch).
for (const type of ['pointerdown', 'pointerup', 'pointercancel']) $('adders').addEventListener(type, (e) => e.stopPropagation());

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
  view.setDieStyle({ body, ink, finish, font }).then(() => view.warmExits()).catch((e) => { status('Could not change the look: ' + e.message); console.error(e); });
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
$('clear-dice').addEventListener('click', clearDice);
$('clear-forced').addEventListener('click', () => { $('forced').value = ''; $('forced').focus(); });
const speed = () => Number($('speed').value);
$('speed').addEventListener('input', () => { $('speed-out').textContent = speed().toFixed(2) + '×'; });
$('tray').addEventListener('input', () => {
  $('tray-out').textContent = Number($('tray').value).toFixed(2) + '×';
  ++current;
  last = null;
  view.setTrayScale(Number($('tray').value));   // a new tray starts empty …
  showTable('');
});
$('tray').addEventListener('change', syncTable);   // … and the dice drop into it when the slider is let go

/** The roll request the panel describes (throws a readable error for a bad field). */
function request(extra = {}) {
  const types = picker.list();
  if (!types.length) throw new Error('Add a die first: tap one of the die buttons.');
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
let current = 0;   // the newest roll or drop; an older one still playing is abandoned
let playing = null;   // the play under way (a roll, a replay or a drop); null while the table is still

/** Plays a baked roll (or drop) with its clicks scheduled on the audio clock. */
function playWithSound(result, options = {}) {
  const p = view.play(result, {
    speed: speed(),
    onStart: ({ timeScale }) => {
      if (!soundOn()) return;
      audio.scheduleRoll(result, { timeScale, pan: (i, t) => 0.7 * view.panFor(samplePose(result, i, t).position) });
    },
    ...options,
  });
  playing = p;
  p.then(() => { if (playing === p) playing = null; });
  return p;
}

// ---------------------------------------------------------------- the table follows the buttons
// The die buttons are the truth, and the dice on the table follow them (owner 2026-10-25): a die
// added drops in, one taken away (right-click its button) leaves, Clear empties the table. Dice taken
// away leave at once, even mid-roll; drops wait until the table is still and then fall together, and
// the dice left settle (a die resting on one taken away falls). Real physics: a landing die may knock
// the others (owner ruling), and the total counts the table as it lies.
let soundFromTap = Promise.resolve();   // the tap that changed the dice starts sound for the drop
let leaving = Promise.resolve();        // dice taken off, still playing their exit
let unsettled = false;
const onTable = () => view.table().map((d) => d.type);

/** The dice changed on the buttons: the last roll no longer describes them, and the table follows. */
function diceChanged() {
  last = null;
  paintDice();
  syncTable();
}

function clearDice() {
  picker.clear();
  ++current;
  audio.stop();
  view.stop();
  diceChanged();
}

/**
 * The table follows the buttons: dice taken off leave now; dice added drop now, onto the table as it is
 * this moment, still moving or not (art direction 2026-10-25: four quick clicks, four dice, each on its
 * click — they used to queue behind the first and fall together); the rest settle once the table is
 * still and the leaving dice have gone.
 */
function syncTable() {
  takeAway();
  const { drop } = tableChanges(picker.list(), onTable());
  if (drop.length) dropIn(drop);
  else if (unsettled) settleWhenStill();
}

let settling = 0;
async function settleWhenStill() {
  const mine = ++settling;
  await leaving;   // the table settles once the dice taken off have gone
  while (playing) await playing;
  if (mine !== settling || !unsettled) return;
  if (!view.dice.length) { unsettled = false; showTable(''); return; }
  await dropIn([]);
}

/** Dice taken off the buttons leave the table now. */
function takeAway() {
  const { remove } = tableChanges(picker.list(), onTable());
  if (!remove.length) return;
  const gone = remove.map((i) => onTable()[i]);
  // Each leaves through the Exit animation, several one after another (Clear): 0.2 s apart, give or take.
  const delays = exitDelays(remove.length);
  const leavingNow = remove.map((i, k) => view.removeDie(i, { exit: $('exit').value, delay: delays[k] }));
  leaving = Promise.all([leaving, ...leavingNow]);
  unsettled = true;
  ++current;   // a roll under way no longer describes the table: the settle after it reports instead
  if (!playing) showTable('took off ' + groupDice(gone));
}

async function dropIn(types) {
  const mine = ++current;
  status('');
  unsettled = false;
  const fromTable = view.dice.length;
  let result;
  try {
    result = view.bakeDrop(types);
  } catch (e) {
    // The drop could not be made: the buttons go back to what is on the table, and say why.
    for (const t of types) picker.remove(t);
    paintDice();
    status('Could not drop ' + groupDice(types) + ': ' + e.message);
    console.error(e);
    return;
  }
  if (types.length) show(null);
  await soon(soundFromTap);
  if (mine !== current) return;
  audio.stop();   // dice still moving carry on in this drop, their clicks rescheduled with it
  await playWithSound(result, { fromTable });
  if (mine !== current) return;
  showTable(types.length ? 'dropped in ' + groupDice(types) : 'the dice settled');
}

/** The result line for the table as it lies: its total, each die, and what just happened. */
function showTable(note) {
  const t = view.table();
  $('total').textContent = t.length ? String(t.reduce((s, d) => s + d.value, 0)) : '';
  $('faces').textContent = t.length > 1 ? t.map((d) => d.type + ': ' + d.value).join('   ') : t.length ? t[0].type : '';
  $('meta').textContent = note;
}

async function go(req, { unlocking = Promise.resolve() } = {}) {
  const mine = ++current;
  unsettled = false;   // the roll replaces the table
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
  await soon(unlocking);   // the first tap starts sound; the roll waits a moment for it so its clicks play
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
  if (!last) { status('Roll first: there is no roll of these dice to replay.'); return; }
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
const ring = $('pan-ring');
const resetButton = $('reset-view');
const ZOOM_PER_PX = 0.006;   // a right-drag of 100 px up brings the camera to 0.55 of its distance
// The wheel (owner 2026-10-25: "add mouse wheel to zoom on desktop"): a notch (100 px) moves the camera
// about 10%; a trackpad pinch, which Chrome and Edge send as a wheel with ctrlKey, takes bigger steps.
const WHEEL_ZOOM_PER_PX = { scroll: 0.001, pinch: 0.01 };
const syncReset = () => { resetButton.hidden = !view.cameraMoved; };
resetButton.addEventListener('pointerdown', (e) => e.stopPropagation());   // a press on the button is not a press on the tray
resetButton.addEventListener('click', () => {
  resetButton.hidden = true;
  view.resetCamera().then(syncReset);
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
  stage.classList.remove('panning', 'zooming');
  const d = press;
  press = null;
  return d;
};
stage.addEventListener('pointerdown', (e) => {
  const secondary = e.pointerType === 'mouse' && e.button === 2;
  if (e.pointerType === 'mouse' && e.button !== 0 && !secondary) return;   // the middle button does nothing
  try { stage.setPointerCapture(e.pointerId); } catch { /* capture is a nicety: without it a drag that leaves the tray still ends on pointerup here */ }
  if (e.pointerType === 'touch' && pinch.down(e.pointerId, e.clientX, e.clientY, e.isPrimary)) {
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
    press.grab = view.floorHit(press.at.x, press.at.y);   // the floor point the hand holds
    stage.classList.add('panning');
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
  if (m && m.kind === 'pan') {
    placeRing(e.clientX, e.clientY);
    const under = view.floorHit(e.clientX, e.clientY);
    if (!press.grab) press.grab = under;   // a hold that began above the horizon takes hold of the floor here
    else if (under) view.panCamera(press.grab.x - under.x, press.grab.z - under.z);   // the floor held stays under the hand
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
  if (kind === 'pan' || kind === 'zoom' || !d.start) return;   // a pan or zoom of the view, or a press that began off the floor
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
// The wheel zooms: down to stand back, up to come nearer. The page itself never scrolls under the tray.
stage.addEventListener('wheel', (e) => {
  e.preventDefault();
  const px = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? stage.clientHeight : 1);   // lines and pages to pixels
  view.zoom(Math.exp(px * (e.ctrlKey ? WHEEL_ZOOM_PER_PX.pinch : WHEEL_ZOOM_PER_PX.scroll)));
  syncReset();
}, { passive: false });
// The platform's own count of fingers is the truth: when the last one lifts, the pinch holds nothing,
// whatever pointer events went missing (input/pinch.js ▸ THE PLATFORM IS THE TRUTH).
for (const type of ['touchend', 'touchcancel']) stage.addEventListener(type, (e) => { if (e.touches.length === 0) pinch.reset(); }, { passive: true });
stage.addEventListener('gesturestart', (e) => e.preventDefault());   // Safari's own pinch would zoom the page
stage.addEventListener('contextmenu', (e) => e.preventDefault());   // a long press turns the view and a right-drag zooms: no menu

// ---------------------------------------------------------------- the options drawer (phone layout)
// On a narrow screen the options sit in a drawer under the tray; its handle raises and lowers it
// (demo/drawer.js). Its height is remembered on this browser. The wide layout ignores it.
const narrow = window.matchMedia('(max-width: 760px)');
const panel = $('panel'), grab = $('drawer-grab');
const DRAWER_KEY = 'dice-sim:drawer';
const drawerMax = () => Math.round(window.innerHeight * 0.85);
let drawerSaved = null;
try { drawerSaved = JSON.parse(localStorage.getItem(DRAWER_KEY) || 'null'); } catch { /* storage blocked: the default height */ }
const drawerStart = Math.round(window.innerHeight * 0.46);   // the layout's old fixed share
const drawer = createDrawer({ height: drawerSaved?.height ?? drawerStart, open: drawerSaved?.reopen ?? drawerStart, max: drawerMax() });
const paintDrawer = () => {
  if (!narrow.matches) { panel.style.removeProperty('height'); panel.style.removeProperty('max-height'); panel.classList.remove('drawer-closed'); return; }
  panel.style.height = drawer.height + 'px';
  panel.style.maxHeight = 'none';
  panel.classList.toggle('drawer-closed', drawer.closed);
  grab.setAttribute('aria-valuenow', String(drawer.height));
  grab.setAttribute('aria-valuemax', String(drawerMax()));
};
const keepDrawer = () => { try { localStorage.setItem(DRAWER_KEY, JSON.stringify({ height: drawer.height, reopen: drawer.reopen })); } catch { /* storage blocked */ } };
let drawerPointer = null;
grab.addEventListener('pointerdown', (e) => {
  if (e.isPrimary === false || (e.pointerType === 'mouse' && e.button !== 0)) return;
  drawerPointer = e.pointerId;
  try { grab.setPointerCapture(e.pointerId); } catch { /* the drag still ends on pointerup */ }
  drawer.down(e.clientY, e.timeStamp);
  e.preventDefault();
});
grab.addEventListener('pointermove', (e) => { if (e.pointerId === drawerPointer) { drawer.move(e.clientY); paintDrawer(); } });
grab.addEventListener('pointerup', (e) => {
  if (e.pointerId !== drawerPointer) return;
  drawerPointer = null;
  drawer.up(e.clientY, e.timeStamp);
  paintDrawer();
  keepDrawer();
});
grab.addEventListener('pointercancel', () => { drawerPointer = null; drawer.cancel(); });
grab.addEventListener('keydown', (e) => { if (drawer.key(e.key) !== null) { e.preventDefault(); paintDrawer(); keepDrawer(); } });
narrow.addEventListener('change', paintDrawer);
window.addEventListener('resize', () => { drawer.setMax(drawerMax()); paintDrawer(); });
paintDrawer();

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

paintDice();
if (picker.total) rollFromPanel();
