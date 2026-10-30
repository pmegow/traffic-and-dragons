// demo/demo.js — the standalone dice toy: a thin shell over DiceView, DiceAudio and the core's roll().
import { DiceView, VIEW_DEFAULTS, FINISHES, SURFACE_LOOKS, NUMERAL_FONTS } from '../render/index.js';
import { DiceAudio } from '../audio/index.js';
import { createPressGesture } from '../input/press-gesture.js';
import { createPinch } from '../input/pinch.js';
import { createPresetStore } from './preset-store.js';
import { createDrawer, DRAWER } from './drawer.js';
import { sameLook } from '../render/presets.js';
import { VERSION, dieTypes, samplePose, MAX_DICE } from '../src/index.js';
import { createDicePicker, tableChanges, groupDice } from './dice-picker.js';
import { rollParts } from './roll-line.js';
import { exitMenu, exitDelays, chooseExit } from '../render/exit-table.js';
import { TOY_DEFAULTS } from './toy-defaults.js';
import { attachColorPicker } from './color-picker.js';

const $ = (id) => document.getElementById(id);
const status = (msg) => { $('status').textContent = msg || ''; };

let view;
try {
  view = new DiceView({ container: $('view') });
} catch (e) {
  status('Could not start the 3D view: ' + e.message);
  throw e;
}

// ---------------------------------------------------------------- sound
const audio = new DiceAudio();
let audioState = 'loading';   // loading → ready (waiting for a tap) ⇄ on | failed (the banks did not load)
// Why sound is not on, said in the sound line until it is — never on the status line, which the next roll clears
// (2026-10-27: a refused start was said there and wiped by the very roll its tap threw).
let soundWhy = '';
const soundLine = () => {
  const words = { loading: 'Loading sound…', ready: soundWhy || 'Tap Roll or the tray to start sound.', on: '', failed: soundWhy };
  $('sound-state').textContent = $('sound').checked ? words[audioState] : '';
  $('sound-state').classList.toggle('why', !!($('sound').checked && soundWhy));   // a refusal reads in the accent, not grey
};
audio.load().then(() => { audioState = 'ready'; soundLine(); }).catch((e) => {
  audioState = 'failed';
  soundWhy = 'Sound is off: ' + e.message;
  console.error(e);
  soundLine();
});
soundLine();
/**
 * Starts sound from inside a gesture — a click, or a finger lifting (an iPhone refuses one coming down) — and
 * resolves once it is settled either way. Never rejects. A refused start is not the end of sound: the sound line
 * says why and the next tap tries again, as it does for a clock the phone paused while the page was away.
 */
function unlockSound() {
  if (audioState !== 'ready' && audioState !== 'on') return Promise.resolve();
  return audio.unlock().then((ok) => {
    audioState = ok ? 'on' : 'ready';
    soundWhy = ok ? '' : 'Sound did not start (the browser keeps it ' + audio.ctx.state + '). Tap Roll to try again.';
    soundLine();
  }).catch((e) => {
    audioState = 'ready';
    soundWhy = 'Sound did not start: ' + e.message + ' Tap Roll to try again.';
    console.warn('dice-sim: ' + soundWhy);
    soundLine();
  });
}
// Only on a running clock: sound scheduled on a paused one would all come out at once when it wakes.
const soundOn = () => $('sound').checked && audioState === 'on' && audio.ctx && audio.ctx.state === 'running';
// Sound never holds a roll or a drop back: a start that does not come (no gesture, a browser that
// keeps the audio asleep) is waited for this long at most, and the dice go on silent.
const SOUND_WAIT_MS = 250;
const soon = (p, ms = SOUND_WAIT_MS) => Promise.race([p, new Promise((r) => setTimeout(r, ms))]);
// The first drop or roll after a look waits this long at most for the dice's pipeline (view.warmTable), readied as the
// page opens and after each look: a die drawn before it is built stalled 0.6 s in the air after a reload (2026-10-28).
const WARM_WAIT_MS = 1500;
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
// How a die leaves the table (owner 2026-10-25): the exits on the menu (render/exit-table.js ▸ exitMenu: a shelved one
// is not), kept on this browser.
const EXIT_KEY = 'dice-sim:exit';
const EXIT_MENU = exitMenu();
for (const e of EXIT_MENU) {
  const o = document.createElement('option');
  o.value = e.name;
  o.textContent = e.label;
  $('exit').appendChild(o);
}
$('exit').value = TOY_DEFAULTS.exit;   // Random (owner 2026-10-27), unless this browser kept another still on the menu
try { const saved = localStorage.getItem(EXIT_KEY); if (EXIT_MENU.some((e) => e.name === saved)) $('exit').value = saved; } catch { /* storage blocked: the default */ }
$('exit').addEventListener('change', () => { try { localStorage.setItem(EXIT_KEY, $('exit').value); } catch { /* storage blocked */ } });
$('table-hint').textContent = 'Drag a die to toss it · ' + (window.matchMedia('(pointer: coarse)').matches ? 'double-tap' : 'double-click') + ' one to roll it again';
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
// The controls open on the view's own defaults (render/view-defaults.js), never a second copy in the HTML — but for
// the surface, which is the roller's own (demo/toy-defaults.js: no tray, owner 2026-10-27).
$('body-color').value = VIEW_DEFAULTS.dieStyle.body;
$('ink-color').value = VIEW_DEFAULTS.dieStyle.ink;
$('finish').value = VIEW_DEFAULTS.dieStyle.finish;
$('font').value = VIEW_DEFAULTS.dieStyle.font;
$('surface').value = TOY_DEFAULTS.surface;
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
// The colour pickers (demo/color-picker.js, owner 2026-10-29: HSV sliders as well as RGB): a swatch over each native
// input, which stays the value's home — a slide writes it and fires 'input', the listener below applies the look.
const colorPickers = ['body-color', 'ink-color'].map((id) => attachColorPicker($(id)));
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
  // The name field follows the choice: a saved preset's own name (Save then overwrites it), nothing for a built-in
  // one (owner 2026-10-29: a name typed earlier stayed under the new choice — "clear the preset name when a new
  // preset is selected").
  $('preset-name').value = p.builtIn ? '' : p.name;
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
  view.setDieStyle({ body, ink, finish, font }).then(() => view.warmUp()).catch((e) => { status('Could not change the look: ' + e.message); console.error(e); });
  try { localStorage.setItem(LOOK_KEY, JSON.stringify(look())); } catch { /* storage blocked */ }
  for (const p of colorPickers) p.sync();
  syncPreset();
};
fillPresets();
applyLook();
applySurface();
$('surface').addEventListener('change', () => { applySurface(); applyLook(); });
for (const id of ['body-color', 'ink-color']) $(id).addEventListener('input', applyLook);
$('finish').addEventListener('change', applyLook);
$('font').addEventListener('change', applyLook);
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
function request(extra = {}, types = picker.list()) {
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
  const exit = chooseExit($('exit').value);   // Random picks once for them all (round 13)
  const onSound = (s) => { if (soundOn()) audio.playExitSound(s.kind, { ...s, pan: 0.7 * s.pan }); };
  const leavingNow = remove.map((i, k) => view.removeDie(i, { exit, delay: delays[k], onSound }));
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
  await soon(view.warmTable(), WARM_WAIT_MS);   // the dice's pipeline, built ahead: at once, but for the first drop after a look
  if (mine !== current) return;
  audio.stop();   // dice still moving carry on in this drop, their clicks rescheduled with it
  await playWithSound(result, { fromTable });
  if (mine !== current) return;
  showTable(types.length ? 'dropped in ' + groupDice(types) : 'the dice settled');
}

/** The roll line for the table as it lies (each die, the total at the end), and what just happened. */
function showTable(note) {
  paintRoll(view.table());
  $('meta').textContent = note;
}

/** The roll line along the bottom of the view: each die, then the total in bold (owner 2026-10-26). */
function paintRoll(dice) {
  const p = rollParts(dice), el = $('roll-line');
  if (!p) { el.replaceChildren(); return; }
  const total = document.createElement('b');
  total.textContent = p.total;
  el.replaceChildren(p.lead, total, p.tail);
}

async function go(req, { unlocking = Promise.resolve(), fromTable = 0 } = {}) {
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
  await soon(view.warmTable(), WARM_WAIT_MS);   // and for the dice's pipeline, built ahead (at once, but for the first roll after a look)
  if (mine !== current) return;
  await playWithSound(result, fromTable ? { fromTable } : {});
  if (mine !== current) return;   // a newer roll took over the tray
  last = { result, bakeMs };
  show(result, bakeMs);
}

function show(result, bakeMs) {
  if (!result) { paintRoll([]); $('meta').textContent = ''; return; }
  paintRoll(result.dice);
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
// Pick up and toss (owner 2026-10-29, 2026-10-30): a press ON A DIE picks that die up into the hand at once, and only
// it ("just pick up the die with the click and drop it with release (goal here is to allow the user to toss the
// die)"); the hand follows the pointer, a quick back and forth rattles the die for real (src/hold.js), and letting go
// throws it from the hand as it moves, onto the table the others still lie on. A double-click on a die rolls it again
// where it lies (DOUBLE_MS; its second press picks nothing up). A press on the empty table does nothing but pan, once
// held still (input/press-gesture.js), or fling every die when dragged fast. The hand feels like felt to the dice; at
// most HAND_VOICES of a frame's knocks sound, the hardest first.
const HAND_TIMBRE = 'felt', HAND_VOICES = 4;
const DOUBLE_MS = 400, CLICK_SLOP = 6;   // ms between a click's release and the next press on the same die; px a click may wander
let lastClick = null;   // the last click on a die: { die, t, x, y }
let handKnocks = [];
const onHandHit = (i, speed, surface) => {
  if (!soundOn()) return;
  handKnocks.push({ i, speed, surface });
  if (handKnocks.length > 1) return;   // the frame's knocks play together once the frame's hits are all in
  requestAnimationFrame(() => {
    const knocks = handKnocks.sort((a, b) => b.speed - a.speed).slice(0, HAND_VOICES);
    handKnocks = [];
    for (const k of knocks) {
      const d = view.dice[k.i];
      if (d) audio.playHit({ type: d.die.type, surface: k.surface === 'die' ? 'die' : HAND_TIMBRE, speed: k.speed, pan: 0.7 * view.panFor(d.mesh.position) });
    }
  });
};
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
  stage.classList.remove('panning', 'zooming', 'holding');
  const d = press;
  press = null;
  return d;
};
stage.addEventListener('pointerdown', (e) => {
  const secondary = e.pointerType === 'mouse' && e.button === 2;
  if (e.pointerType === 'mouse' && e.button !== 0 && !secondary) return;   // the middle button does nothing
  try { stage.setPointerCapture(e.pointerId); } catch { /* capture is a nicety: without it a drag that leaves the tray still ends on pointerup here */ }
  if (e.pointerType === 'touch' && pinch.down(e.pointerId, e.clientX, e.clientY, e.isPrimary)) {
    // A second finger: the first finger's press becomes a pinch, and never taps, throws or turns; a die it held is let go.
    gesture.cancel();
    const d = endPress();
    if (d && d.holding) letGo(Promise.resolve());
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
  const under = view.floorHit(e.clientX, e.clientY);
  // The second press of a double-click rolls the die the click was on again where it lies — the die the click held,
  // not the one under the pointer now: the click dropped it, and it may have rolled from under the pointer since.
  const again = lastClick && !view.held && lastClick.die < view.dice.length && e.timeStamp - lastClick.t <= DOUBLE_MS && Math.hypot(e.clientX - lastClick.x, e.clientY - lastClick.y) <= 4 * CLICK_SLOP;
  const clicked = lastClick && lastClick.die;
  lastClick = null;
  if (again) {
    press = { id: e.pointerId, reroll: true };
    rerollDie(clicked);
    return;
  }
  const k = under ? view.dieAt(e.clientX, e.clientY) : -1;
  if (view.dice.length && !view.held && k >= 0) {
    // A press on a die: the hand picks it up at once (never while a die leaves: the table is settling). It rises
    // toward the camera, so it stays under the pointer, and the hand keeps it there as the pointer moves.
    press = { id: e.pointerId, holding: true, die: k, t: e.timeStamp, at: { x: e.clientX, y: e.clientY }, from: { x: e.clientX, y: e.clientY }, wander: 0, samples: [] };
    ++current;
    audio.stop();
    view.pickUp({ clientX: e.clientX, clientY: e.clientY }, { onHit: onHandHit, surface: HAND_TIMBRE, dice: [k] });
    const hp = view.handPoint(e.clientX, e.clientY);
    if (hp) press.samples.push({ t: e.timeStamp, p: hp });   // its path at the die's height, for the toss
    stage.classList.add('holding');
    showTable('picked up ' + groupDice([onTable()[k]]) + ' — toss it, or let go');
    return;
  }
  press = { id: e.pointerId, start: p, samples: p ? [{ t: e.timeStamp, p }] : [], at: { x: e.clientX, y: e.clientY } };
  gesture.down(e.timeStamp, e.clientX, e.clientY);
  clearTimeout(holdTimer);
  holdTimer = setTimeout(() => {   // held still on the table: the view pans
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
  if (!press || e.pointerId !== press.id || press.reroll) return;
  press.at = { x: e.clientX, y: e.clientY };
  if (press.holding) {   // the hand carries the die as the pointer moves, keeping it under the pointer
    press.wander = Math.max(press.wander, Math.hypot(e.clientX - press.from.x, e.clientY - press.from.y));
    view.moveHand({ clientX: e.clientX, clientY: e.clientY });
    const hp = view.handPoint(e.clientX, e.clientY);
    if (hp) { press.samples.push({ t: e.timeStamp, p: hp }); if (press.samples.length > 40) press.samples.shift(); }   // its path, for the toss
    return;
  }
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
  // Sound starts as the finger lifts: an iPhone refuses it as one comes down (2026-10-27, the silent visits).
  const unlocking = unlockSound();
  if (press.reroll) { endPress(); return; }   // the second press of a double-click: its die is already rolling again
  const kind = press.holding ? null : gesture.up();
  const d = endPress();
  if (d.holding) {   // the hand opens: the die is thrown from it as it moves, tossed at the pointer's own speed
    letGo(unlocking, tossOf(d.samples, e.timeStamp));
    // A click (quick, unmoved) arms a double-click: the next press on this die soon after rolls it again.
    if (e.timeStamp - d.t <= DOUBLE_MS && d.wander <= CLICK_SLOP) lastClick = { die: d.die, t: e.timeStamp, x: e.clientX, y: e.clientY };
    return;
  }
  if (kind === 'pan' || kind === 'zoom' || !d.start) return;   // a pan or zoom of the view, or a press that began off the floor
  const end = d.samples[d.samples.length - 1];
  const from = d.samples.find((s) => end.t - s.t <= 90) || d.samples[0];
  const dt = (end.t - from.t) / 1000;
  const vx = dt > 0 ? (end.p.x - from.p.x) / dt : 0, vz = dt > 0 ? (end.p.z - from.p.z) / dt : 0;
  const v = Math.hypot(vx, vz);
  // A click on the empty table, or a drag too slow to be a fling, throws nothing (owner 2026-10-30; it threw toward the
  // click from 2026-10-29, demo/tap-throw.js): the dice are rolled by the Roll button, a toss from the hand, or a double-click.
  if (v < 0.25) return;
  const k = Math.min(3.2, Math.max(0.6, v)) / v;
  rollFromPanel({ throw: { fling: { from: d.start, velocity: { x: vx * k, z: vz * k } } } }, { unlocking });
});
stage.addEventListener('pointercancel', (e) => {
  if (e.pointerType === 'touch') pinch.up(e.pointerId);
  if (press && e.pointerId === press.id) { const d = press; gesture.cancel(); endPress(); if (d.holding) letGo(Promise.resolve()); }
});
/**
 * The toss as the hand opens (owner 2026-10-30: "the goal here is to allow the user to toss the die"): the pointer's
 * speed across the floor over its last TOSS.window ms before `now` (m/s), held to TOSS.max, the fling's own ceiling;
 * null for a hand that was still (under TOSS.min), which drops the die. The cup alone gave a die next to nothing: the
 * hand stops each frame where the pointer is, so it had always caught up, and stood still, by the time it opened.
 */
const TOSS = { window: 90, min: 0.25, max: 3.2 };
function tossOf(samples, now) {
  const recent = samples.filter((s) => now - s.t <= TOSS.window);
  if (recent.length < 2) return null;
  const a = recent[0], b = recent[recent.length - 1], dt = (b.t - a.t) / 1000;
  if (!(dt > 0)) return null;
  const vx = (b.p.x - a.p.x) / dt, vz = (b.p.z - a.p.z) / dt, s = Math.hypot(vx, vz);
  if (s < TOSS.min) return null;
  const k = Math.min(TOSS.max, s) / s;
  return { x: vx * k, z: vz * k };
}
/** The hand lets go: the dice it held are thrown from where they are, as they move — tossed at `toss` (m/s) when given. */
function letGo(unlocking, toss = null) {
  const let_ = view.release(toss ? { velocity: toss } : {});
  if (!let_) return;   // the hand had already opened (the table changed under it)
  let req;
  // From a hand the dice may just fall: a short drop that hardly turns is a fair throw of its own (no minimum turns).
  try { req = request({ throw: { states: let_.states }, gates: { minTurns: 0 } }, onTable()); } catch (e) { status(e.message); return; }
  go(req, { unlocking, fromTable: view.dice.length });
}
/** A double-click on a die (owner 2026-10-30): that die is tossed again from where it lies, the others lying as they are. */
async function rerollDie(k) {
  const mine = ++current;
  status('');
  unsettled = false;
  audio.stop();
  const type = onTable()[k], fromTable = view.dice.length;
  let result;
  try {
    result = view.bakeReroll([k]);
  } catch (e) {
    status('Could not roll ' + groupDice([type]) + ' again: ' + e.message);
    console.error(e);
    return;
  }
  await soon(unlockSound());
  await soon(view.warmTable(), WARM_WAIT_MS);
  if (mine !== current) return;
  await playWithSound(result, { fromTable });
  if (mine !== current) return;
  showTable('rolled ' + groupDice([type]) + ' again');
}
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
// touchend is the end of a touch WebKit itself counts as the gesture that may start sound; the pointerup before it
// should be too, and if it was refused this starts it.
stage.addEventListener('touchend', () => unlockSound(), { passive: true });
// Safari's own pinch would zoom the page, wherever it begins (owner 2026-10-27: the page must never zoom; Safari
// ignores the viewport's user-scalable=no): a pinch on the tray is the camera's, anywhere else it is nothing.
for (const type of ['gesturestart', 'gesturechange']) document.addEventListener(type, (e) => e.preventDefault(), { passive: false });
stage.addEventListener('contextmenu', (e) => e.preventDefault());   // a long press turns the view and a right-drag zooms: no menu

// ---------------------------------------------------------------- the options drawer, and the side panel's grip
// On a narrow screen the options sit in a drawer under the tray and the grip raises and lowers it; on a wide one
// they sit in a panel beside the tray and the same grip, a vertical bar between the two, drags its width (owner
// 2026-10-29: "the drawer grip is missing when the drawer is arranged vertically"). One model each (demo/drawer.js),
// the layout choosing which the grip drives; a size counts the grip, so the panel is the size less the grip, and
// closed is the panel hidden with the grip left. Both sizes are remembered on this browser.
const narrow = window.matchMedia('(max-width: 760px), (orientation: portrait) and (max-width: 1100px)');   // the same query as index.html's drawer layout: a phone, or a tablet held upright
const panel = $('panel'), grab = $('drawer-grab');
const DRAWER_KEY = 'dice-sim:drawer', SIDE_KEY = 'dice-sim:side';
// Never below what the drawer accepts: a page opened in a window of no height yet (a hidden tab, a pre-render) refused
// the drawer and died there, before the buttons were painted or the first roll thrown (2026-10-28); a resize sets it right.
const drawerMax = () => Math.max(DRAWER.min + 1, Math.round(window.innerHeight * 0.85));
let drawerSaved = null;
try { drawerSaved = JSON.parse(localStorage.getItem(DRAWER_KEY) || 'null'); } catch { /* storage blocked: the default height */ }
const drawerStart = Math.round(window.innerHeight * 0.46);   // the layout's old fixed share
const drawer = createDrawer({ height: drawerSaved?.height ?? drawerStart, open: drawerSaved?.reopen ?? drawerStart, max: drawerMax() });
// The side panel: 300 px wide by its stylesheet, at most 60% of the window, dragged by the same grip on the wide layout.
const sideMax = () => Math.max(DRAWER.min + 1, Math.round(window.innerWidth * 0.6));
let sideSaved = null;
try { sideSaved = JSON.parse(localStorage.getItem(SIDE_KEY) || 'null'); } catch { /* storage blocked: the default width */ }
const sideStart = 300 + DRAWER.min;
const side = createDrawer({ height: sideSaved?.height ?? sideStart, open: sideSaved?.reopen ?? sideStart, max: sideMax(), axis: 'x' });
const active = () => (narrow.matches ? drawer : side);   // the model the grip drives in this layout
const paintDrawer = () => {
  const d = active();
  if (narrow.matches) {
    panel.style.removeProperty('width');
    panel.style.height = (drawer.height - DRAWER.min) + 'px';   // the size counts the grip, which sits above the drawer
    panel.style.maxHeight = 'none';
  } else {
    panel.style.removeProperty('height'); panel.style.removeProperty('max-height');
    panel.style.width = (side.height - DRAWER.min) + 'px';   // the grip stands beside the panel
  }
  panel.classList.toggle('drawer-closed', d.closed);
  grab.setAttribute('aria-orientation', narrow.matches ? 'horizontal' : 'vertical');
  grab.setAttribute('aria-valuenow', String(d.height));
  grab.setAttribute('aria-valuemax', String(narrow.matches ? drawerMax() : sideMax()));
};
const keepDrawer = () => {
  try {
    localStorage.setItem(DRAWER_KEY, JSON.stringify({ height: drawer.height, reopen: drawer.reopen }));
    localStorage.setItem(SIDE_KEY, JSON.stringify({ height: side.height, reopen: side.reopen }));
  } catch { /* storage blocked */ }
};
const along = (e) => (narrow.matches ? e.clientY : e.clientX);   // the grip's coordinate in this layout
let drawerPointer = null;
grab.addEventListener('pointerdown', (e) => {
  if (e.isPrimary === false || (e.pointerType === 'mouse' && e.button !== 0)) return;
  drawerPointer = e.pointerId;
  try { grab.setPointerCapture(e.pointerId); } catch { /* the drag still ends on pointerup */ }
  active().down(along(e), e.timeStamp);
  e.preventDefault();
});
grab.addEventListener('pointermove', (e) => { if (e.pointerId === drawerPointer) { active().move(along(e)); paintDrawer(); } });
grab.addEventListener('pointerup', (e) => {
  if (e.pointerId !== drawerPointer) return;
  drawerPointer = null;
  active().up(along(e), e.timeStamp);
  paintDrawer();
  keepDrawer();
});
grab.addEventListener('pointercancel', () => { drawerPointer = null; drawer.cancel(); side.cancel(); });
grab.addEventListener('keydown', (e) => { if (active().key(e.key) !== null) { e.preventDefault(); paintDrawer(); keepDrawer(); } });
narrow.addEventListener('change', () => { drawerPointer = null; drawer.cancel(); side.cancel(); paintDrawer(); });   // a drag across the change is over
window.addEventListener('resize', () => { drawer.setMax(drawerMax()); side.setMax(sideMax()); paintDrawer(); });
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
document.documentElement.setAttribute('data-dice-started', '');   // the start check (index.html) is silent from here
