// tests-audit-voice.js — the 2026-09-18 Fable audit, section F (Voice and audio).
//
// One standalone battery per finding. Each assertion below FAILED before its fix; the mechanism
// each one exercises is named in the test title so a red line says what broke, not just where.
//
//   F1  exiting Car Mode after a spoken "pause" left ambience wedged OFF until a page reload:
//       hideCarMode cleared _carHeld but dispatched no intent, so ui-ambient's `held` latch
//       (cleared only by a resume intent or the unlock button) stayed true forever.
//   F2  STT.cancel()/stop() were no-ops while getUserMedia was still pending — the recorder
//       opened AFTER the cancel and held the mic (and the #19 audio session) until the 45s cap.
//   F3  _confirmPending outlived the Car Mode overlay and ate the next desktop utterance.
//   F5  ui-ambient collected unsubscribe handles in `offs` and never called them, so a disposed
//       controller kept receiving every TTS/STT edge.
//   F8  the "state" event said playing:true while paused — the opposite of TTS.isPlaying() —
//       and _drain fired it twice per read start.
//   F11 earcon()/primeAudioSession() were the only WebAudio paths that never disconnected.
//   F13 the deferred 800ms mic open re-checked neither the hold nor the narrator, and its timer
//       (plus the 300ms options poll) could not be revoked by hideCarMode.
//
// Standalone battery — run directly:  node dev/tests-audit-voice.js
const assert = require('assert/strict'), fs = require('fs'), path = require('path'), vm = require('vm');
const root = path.join(__dirname, '..');
const source = f => fs.readFileSync(path.join(root, f), 'utf8');
const flush = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };
let passed = 0;
async function test(name, fn) {
  try { await fn(); passed++; console.log('PASS audit-F ' + name); }
  catch (e) { process.exitCode = 1; console.error('FAIL audit-F ' + name + ' — ' + e.stack); }
}

// ── shared fakes ──────────────────────────────────────────────────────────────────────────────
// One document both ui-carmode.js and ui-ambient.js are wired to, so the tnd:car-intent seam is
// exercised end to end (the F1 wedge only exists across that boundary).
function fakeDoc() {
  const handlers = {}, els = {};
  return {
    hidden: false,
    addEventListener(name, fn) { (handlers[name] || (handlers[name] = [])).push(fn); },
    removeEventListener(name, fn) { const l = handlers[name] || [], i = l.indexOf(fn); if (i >= 0) l.splice(i, 1); },
    dispatchEvent(ev) { (handlers[ev.type] || []).slice().forEach(fn => fn(ev)); return true; },
    fire(name, ev) { (handlers[name] || []).slice().forEach(fn => fn(ev || { type: name })); },
    count(name) { return (handlers[name] || []).length; },
    getElementById(id) {
      return els[id] || (els[id] = {
        id, style: {}, textContent: '', value: '', innerHTML: '', disabled: false, title: '',
        classList: { add() {}, remove() {} }, querySelectorAll: () => [],
        focus() {}, blur() {}, addEventListener() {}, removeEventListener() {}
      });
    }
  };
}
function fakeTimers() {
  const list = []; let next = 1;
  return {
    list,
    set(fn, ms) { const id = next++; list.push({ id, fn, ms }); return id; },
    clear(id) { const i = list.findIndex(t => t.id === id); if (i >= 0) list.splice(i, 1); },
    pending(ms) { return list.filter(t => ms === undefined || t.ms === ms); },
    fire(ms) {
      const due = list.filter(t => t.ms === ms);
      due.forEach(t => { const i = list.indexOf(t); if (i >= 0) list.splice(i, 1); });
      due.forEach(t => t.fn());
      return due.length;
    }
  };
}
// helpers.js holds the two pure deciders Car Mode routes spoken commands through.
const helperScope = { console, Math, Date, JSON, Object, Array, String, Number, RegExp, isNaN, parseFloat, parseInt, setTimeout, clearTimeout, window: {}, document: fakeDoc(), localStorage: { getItem: () => null, setItem() {} } };
vm.createContext(helperScope);
['globals.js', 'data.js', 'helpers.js'].forEach(f => vm.runInContext(source(f), helperScope, { filename: f }));

// ui-carmode.js is a DOM-wiring file with no module wrapper: evaluate it inside a function whose
// parameters ARE its globals, then hand back the seams this battery drives.
function loadCarMode(deps) {
  const epilogue = `
    ;return {
      hideCarMode: hideCarMode, carVoiceCommand: carVoiceCommand,
      autoMic: _carAutoMic, startMic: _carStartMic, tap: _carTap, optReset: _carOptReset,
      held: function() { return _carHeld; },
      setCarMode: function(v) { carMode = v; },
      setOptRead: function(v) { _carOptRead = v; },
      optTimer: function() { return _carOptTimer; }
    };`;
  const names = Object.keys(deps);
  return new Function(...names, source('ui-carmode.js') + epilogue)(...names.map(k => deps[k]));
}
function carDeps(doc, timers, over) {
  const stt = Object.assign({
    starts: 0, cancels: 0, stops: 0, listening: false,
    isSupported: () => true, isListening() { return stt.listening; }, start() { stt.starts++; },
    cancel() { stt.cancels++; }, stop() { stt.stops++; }, setOnState() {},
    isCloudActive: () => false, isAutoListen: () => true, isConfirmPending: () => false,
    clearConfirm() { stt.cleared = (stt.cleared || 0) + 1; }
  }, (over && over.stt) || {});
  const tts = Object.assign({
    playing: false, paused: false, spoken: [],
    isPlaying() { return tts.playing; }, isPaused() { return tts.paused; }, isOn: () => false,
    speak(t) { tts.spoken.push(t); }, earcon() {}, pause() {}, stop() {},
    setOnDone() {}, primeAudioSession() {}, stopAudioSessionPrimer() {}
  }, (over && over.tts) || {});
  return {
    document: doc, window: { addEventListener() {} }, navigator: {}, console,
    store: { set() {}, get: () => '', del() {} },
    worldState: { turn: 3, character: { name: 'Korrag' }, lastTurnAt: 0 },
    showToast() {}, closeAllMenus() {}, sendAction() {}, saveAll() {}, syncUI() {},
    carRecapText: () => 'previously', undoLastItemMove: () => ({ ok: false, reason: 'nothing' }),
    parseCarCommand: helperScope.parseCarCommand, carHoldDispatch: helperScope.carHoldDispatch,
    buildOptionsSpeech: helperScope.buildOptionsSpeech, toFirstPerson: helperScope.toFirstPerson,
    CustomEvent, Date, Math, JSON,
    setTimeout: timers.set, clearTimeout: timers.clear,
    busy: false, carMode: false, TTS: tts, STT: stt,
    _tts: tts, _stt: stt
  };
}
// ui-ambient.js, same treatment (the engine-tests "L7 ambience reload" harness pattern).
function loadAmbient(doc, over) {
  const paints = { status: 0 }, controllers = [];
  const events = helperScope.createAudioEvents ? null : null;   // ui-ambient owns no emitter itself
  const ttsListeners = [], sttListeners = [];
  const tts = Object.assign({
    playing: false, paused: false,
    isPlaying() { return tts.playing; }, isPaused() { return tts.paused; },
    on(name, fn) { ttsListeners.push(fn); return function() { const i = ttsListeners.indexOf(fn); if (i >= 0) ttsListeners.splice(i, 1); }; },
    emit(v) { ttsListeners.slice().forEach(fn => fn(v)); }
  }, (over && over.tts) || {});
  const stt = {
    on(name, fn) { sttListeners.push(fn); return function() { const i = sttListeners.indexOf(fn); if (i >= 0) sttListeners.splice(i, 1); }; },
    emit(v) { sttListeners.slice().forEach(fn => fn(v)); }
  };
  const ctx = { state: 'running', currentTime: 0, resume() { ctx.state = 'running'; return {}; } };
  const deps = {
    window: doc, document: doc, location: { protocol: 'http:' },
    localStorage: { getItem: k => (k === 'tnd_ambient_enabled_v1' ? '1' : '0.45'), setItem() {} },
    eachMenuEl(key, fn) { if (key === 'ambient-status') { paints.status++; fn({ style: {}, textContent: '' }); } },
    Sound: { context: () => ctx },
    Promise, TTS: tts, STT: stt, console, Object, Math, Number, String, JSON, AbortController,
    navigator: {}, setTimeout, clearTimeout,
    audioPublishedScene: { campaignId: 'one', nodeKey: null },
    audioScenePublish() {}, ambientPlan: () => ({ scene: null, gain: 0 }),
    AUDIO_SCENES: [], AUDIO_CATALOG: { assets: [] },
    createAudioLoader: () => ({ load() { return Promise.resolve({}); }, release() {}, inspect: () => ({ pending: 0 }) }),
    createAmbientController(driver) {
      const c = { updates: 0, disposed: false, update() { c.updates++; }, retry() {}, dispose() { c.disposed = true; }, inspect: () => ({ pending: 0, sources: 0, buffers: 0 }) };
      controllers.push(c); return c;
    },
    /* the accent layer (§21) is created beside the bed controller; a recording stub keeps this fixture about voice gating */
    createAccentController() { return { update() {}, shed() {}, dispose() {}, inspect: () => ({}) }; }
  };
  const names = Object.keys(deps);
  const app = new Function(...names, source('ui-ambient.js') + '\n;return Ambient;')(...names.map(k => deps[k]));
  return { app, tts, stt, paints, controllers, ttsListeners, sttListeners };
}

// ── tts.js headless fixture (F8, F11) ─────────────────────────────────────────────────────────
function ttsFixture(options = {}) {
  const nodes = { connects: 0, disconnects: 0, live: 0, oscillators: [], gains: [], sources: [] };
  const spoken = [], warnings = [];
  function node(kind, extra) {
    const n = Object.assign({
      kind, connected: false, disconnected: false,
      connect() { this.connected = true; nodes.connects++; nodes.live++; },
      disconnect() { this.disconnected = true; nodes.disconnects++; nodes.live--; }
    }, extra || {});
    return n;
  }
  function Context() {
    this.state = 'running'; this.sampleRate = 22050; this.currentTime = 0; this.destination = node('destination');
  }
  Context.prototype.createBuffer = function () { return { duration: 2 }; };
  Context.prototype.createBufferSource = function () { const n = node('source', { buffer: null, loop: false, start() {}, stop() {} }); nodes.sources.push(n); return n; };
  Context.prototype.createOscillator = function () { const n = node('oscillator', { type: '', frequency: { value: 0 }, start() {}, stop() { if (typeof n.onended === 'function') n.onended(); }, onended: null }); nodes.oscillators.push(n); return n; };
  Context.prototype.createGain = function () { const n = node('gain', { gain: { value: 0, setValueAtTime() {}, cancelScheduledValues() {}, setTargetAtTime() {}, linearRampToValueAtTime() {} } }); nodes.gains.push(n); return n; };
  Context.prototype.resume = function () { this.state = 'running'; return Promise.resolve(); };
  Context.prototype.suspend = function () { this.state = 'suspended'; return Promise.resolve(); };
  Context.prototype.close = function () { this.state = 'closed'; return Promise.resolve(); };
  const synth = {
    paused: false, spoken,
    speak(u) { spoken.push(u); }, cancel() {}, getVoices: () => [],
    pause() { synth.paused = true; }, resume() { synth.paused = false; }
  };
  function Utterance(text) { this.text = text; this.onend = null; this.onerror = null; }
  const timers = fakeTimers();
  const settings = JSON.stringify({ primary: options.primary || 'native' });
  const memory = {};
  const c = {
    console: Object.assign({}, console, { warn: (...v) => warnings.push(v.join(' ')) }),
    window: { AudioContext: Context, speechSynthesis: options.noSynth ? null : synth, addEventListener() {}, removeEventListener() {} },
    speechSynthesis: options.noSynth ? null : synth,
    SpeechSynthesisUtterance: Utterance,
    document: { addEventListener() {}, removeEventListener() {}, getElementById: () => null, hidden: false },
    navigator: { onLine: true },
    store: {
      get: k => (k === 'tnd_voice_settings_v1' ? settings : (memory[k] === undefined ? '' : memory[k])),
      set: (k, v) => { memory[k] = v; }, del: k => { delete memory[k]; }
    },
    localStorage: { getItem: () => null, setItem() {} },
    providerKeys: {}, eachMenuEl() {}, showToast() {},
    setTimeout: timers.set, clearTimeout: timers.clear, setInterval: () => 1, clearInterval() {},
    Promise, Date, Math, JSON, Object, Array, String, Number, isNaN, parseFloat, parseInt, AbortController,
    WebAssembly: { __tndProbe: null }, fetch: () => Promise.reject(new Error('no network'))
  };
  c.globalThis = c;
  vm.createContext(c);
  ['audio-events.js', 'tts.js'].forEach(f => vm.runInContext(source(f), c, { filename: f }));
  return { c, TTS: c.TTS, nodes, synth, spoken, warnings, timers, Context };
}

// ── stt.js headless fixture (F2, F3, F7) ──────────────────────────────────────────────────────
// `native:false` = the iPhone-Safari cloud surface, with a getUserMedia whose promise this battery
// resolves by hand (the acquisition window is the whole point of F2). `native:true` = a fake
// webkitSpeechRecognition, which is the only surface that can drive a real #77 confirmation:
// helpers.js rides along so sttSuspicion/parseConfirmCommand are the SHIPPED deciders, not stubs.
function sttFixture(options = {}) {
  const input = { value: '', style: {}, title: '', oninput: null, focus() {}, blur() {}, classList: { add() {}, remove() {} } };
  const state = { gumCalls: 0, recorders: [], tracksStopped: 0, capture: [], settle: null, spoken: [], notes: [], sent: [] };
  function Recorder(stream) { this.state = 'inactive'; this.mimeType = 'audio/webm'; state.recorders.push(this); }
  Recorder.prototype.start = function () { this.state = 'recording'; };
  Recorder.prototype.stop = function () { this.state = 'inactive'; if (this.onstop) this.onstop(); };
  Recorder.isTypeSupported = () => false;
  const stream = { getTracks: () => [{ stop() { state.tracksStopped++; } }], getAudioTracks: () => [{ getSettings: () => ({ sampleRate: 48000 }) }] };
  function Rec() { state.rec = this; this.onresult = null; this.onerror = null; this.onend = null; }
  Rec.prototype.start = function () {};
  Rec.prototype.stop = function () { if (this.onend) this.onend(); };
  Rec.prototype.abort = function () { if (this.onend) this.onend(); };
  const memory = {};
  const c = {
    console, MediaRecorder: Recorder,
    window: options.native ? { webkitSpeechRecognition: Rec } : {},
    document: { getElementById: id => (id === 'action-input' ? input : null), addEventListener() {} },
    navigator: { mediaDevices: { getUserMedia() { state.gumCalls++; return new Promise(res => { state.settle = () => res(stream); }); } } },
    store: { get: k => (memory[k] === undefined ? '' : memory[k]), set: (k, v) => { memory[k] = v; } },
    localStorage: { getItem: () => null, setItem() {} },
    providerKeys: { openai: 'fixture' },
    eachMenuEl() {}, showToast() {}, carMode: false, busy: false,
    carNotify: (kind, text) => state.notes.push(kind + (text ? ':' + text : '')),
    carVoiceCommand: () => false,
    TTS: { speak: t => state.spoken.push(t), setAudioCapture() {} },
    setTimeout: () => 1, clearTimeout() {}, setInterval: () => 1, clearInterval() {},
    Promise, Date, Math, JSON, Object, Array, String, Number, RegExp, isNaN, parseFloat, parseInt,
    Blob: function () {}, FormData: function () { this.append = function () {}; },
    sendAction: t => state.sent.push(t), fetch: () => Promise.reject(new Error('no network'))
  };
  vm.createContext(c);
  // globals.js resets providerKeys to {}; the cloud path is gated on a key being on file, so the
  // fixture key goes in AFTER the load (the same order index.html reaches at runtime).
  ['globals.js', 'data.js', 'helpers.js', 'audio-events.js', 'stt.js'].forEach(f => vm.runInContext(source(f), c, { filename: f }));
  c.providerKeys.openai = 'fixture';
  c.STT.on('capture', v => state.capture.push(v));
  // One native utterance, end to end: start → a single FINAL result → onend → _applySendPolicy.
  state.utter = function (text) {
    c.STT.start();
    state.rec.onresult({ resultIndex: 0, results: [{ isFinal: true, 0: { transcript: text, confidence: 0.95 } }] });
    state.rec.onend();
  };
  return { c, STT: c.STT, state, input, stream };
}

(async () => {
  // ── F1 ──────────────────────────────────────────────────────────────────────────────────────
  await test('F1 exiting Car Mode after a spoken "pause" releases the ambience hold (no reload wedge)', () => {
    const doc = fakeDoc(), timers = fakeTimers();
    const amb = loadAmbient(doc);
    amb.app.init();
    const mode = loadCarMode(carDeps(doc, timers));
    mode.setCarMode(true);
    assert.equal(mode.carVoiceCommand('pause'), true, 'a whole-utterance "pause" must be consumed as a command');
    assert.equal(mode.held(), true, 'the spoken pause must hold the session');
    assert.equal(amb.app.snapshot().held, true, 'the pause intent must reach ambience');
    mode.hideCarMode();
    assert.equal(mode.held(), false, 'the hold never outlives the overlay');
    assert.equal(amb.app.snapshot().held, false, 'exiting Car Mode must release the ambience hold');
  });

  // ── F2 ──────────────────────────────────────────────────────────────────────────────────────
  for (const method of ['cancel', 'stop']) {
    await test('F2 STT.' + method + '() during microphone acquisition never lands a hot mic', async () => {
      const f = sttFixture({ native: false });
      f.STT.start();
      assert.equal(f.state.gumCalls, 1, 'the cloud path must have asked for the microphone');
      assert.deepEqual(f.state.capture, [true], 'the audio session is claimed before getUserMedia');
      f.STT[method]();
      assert.equal(f.state.capture[f.state.capture.length - 1], false, method + '() must release the audio session it can no longer use');
      f.state.settle();                       // the permission dialog resolves AFTER the cancel
      await flush();
      assert.equal(f.state.recorders.length, 0, method + '() left the recorder to start behind its back');
      assert.equal(f.STT.isListening(), false, method + '() left the mic listening');
      assert.equal(f.state.tracksStopped, 1, 'the stale stream must have every track stopped');
    });
  }

  // ── F3 ──────────────────────────────────────────────────────────────────────────────────────
  await test('F3 an abandoned Car Mode confirmation dies with the overlay instead of eating the next utterance', () => {
    const doc = fakeDoc(), timers = fakeTimers();
    const f = sttFixture({ native: true });
    assert.equal(typeof f.STT.clearConfirm, 'function', 'STT must export the confirm-clear seam Car Mode exit calls');
    f.c.carMode = true;
    f.state.utter('I follow Zarvex inside');      // an unknown capitalised name = the shipped suspicion verdict
    assert.equal(f.STT.isConfirmPending(), true, 'the #77 gate must have asked "send it?" for this to be the F3 subject');
    assert.equal(f.input.value, '', 'the pending text lives in _confirmPending, not the field');
    // Car Mode's × (the driver parks and closes the overlay without ever answering)
    const deps = carDeps(doc, timers, { stt: {
      isSupported: () => true, isListening: () => false, start() {}, cancel() { f.STT.cancel(); }, stop() {},
      setOnState() {}, isCloudActive: () => false, isAutoListen: () => true, isConfirmPending: () => false,
      clearConfirm(why) { f.STT.clearConfirm(why); }
    } });
    const mode = loadCarMode(deps);
    mode.setCarMode(true);
    mode.hideCarMode();
    assert.equal(f.STT.isConfirmPending(), false, 'hideCarMode must clear the pending confirmation');
    // Hours later, at the desk, with Car Mode long gone:
    f.c.carMode = false;
    f.state.utter('I draw my sword');
    assert.equal(f.input.value, 'I draw my sword', 'the next desktop utterance must be treated as an ordinary action, not a confirm answer');
    assert.deepEqual(f.state.sent, [], 'and nothing is sent behind the player');
  });

  await test('F3 cancel() discards a pending confirmation; stop() (the cloud answer path) keeps it', () => {
    const f = sttFixture({ native: true });
    f.c.carMode = true;
    f.state.utter('I follow Zarvex inside');
    assert.equal(f.STT.isConfirmPending(), true);
    f.STT.cancel();
    assert.equal(f.STT.isConfirmPending(), false, 'cancel() means discard — including a captured-but-unsent confirmation');
    f.state.utter('I follow Zarvex inside');
    assert.equal(f.STT.isConfirmPending(), true);
    f.STT.stop();
    assert.equal(f.STT.isConfirmPending(), true, 'stop() is how the cloud DELIVERS the spoken answer — clearing there breaks the iPhone confirm loop');
    f.state.utter('yes');                          // …and the answer still resolves the way #77 designed
    assert.equal(f.STT.isConfirmPending(), false);
    assert.deepEqual(f.state.sent, ['I follow Zarvex inside'], 'a confirmed turn sends the PENDING text');
  });

  // ── F5 ──────────────────────────────────────────────────────────────────────────────────────
  await test('F5 pagehide disposes the ambience controller AND its voice subscriptions', async () => {
    const doc = fakeDoc();
    const amb = loadAmbient(doc);
    amb.app.init();
    await flush();                       // unlock()'s ctx.resume() lands the controller on a microtask
    assert.equal(amb.ttsListeners.length, 1, 'init subscribes to TTS state');
    assert.equal(amb.sttListeners.length, 1, 'init subscribes to STT capture');
    const before = amb.paints.status;
    amb.tts.emit({ playing: true, paused: false });
    assert(amb.paints.status > before, 'a live controller repaints on a TTS edge');
    doc.fire('pagehide');
    assert.equal(amb.controllers[0].disposed, true, 'the controller is disposed');
    assert.equal(amb.ttsListeners.length, 0, 'the disposed controller must stop receiving TTS edges');
    assert.equal(amb.sttListeners.length, 0, 'the disposed controller must stop receiving mic edges');
    const after = amb.paints.status;
    amb.tts.emit({ playing: false, paused: false });
    assert.equal(amb.paints.status, after, 'a TTS state emit no longer reaches sync');
    assert.equal(typeof amb.app.dispose, 'function', 'dispose() is exported');
    doc.fire('pageshow');
    await flush();
    assert.equal(amb.ttsListeners.length, 1, 'a restored page re-subscribes (bfcache must not deafen ambience forever)');
    assert.equal(amb.controllers.length, 2, 'the restored page rebuilds the disposed controller');
  });

  // ── F8 ──────────────────────────────────────────────────────────────────────────────────────
  await test('F8 the "state" payload agrees with TTS.isPlaying(), and each transition emits once', () => {
    const f = ttsFixture();
    const seen = [];                                   // payloads cross a vm realm — compare fields, not prototypes
    const last = () => JSON.parse(JSON.stringify(seen[seen.length - 1]));
    f.TTS.on('state', p => seen.push(p));
    f.TTS.speak('One sentence.');
    assert.equal(seen.length, 1, 'a read start is ONE transition, not two identical emits: ' + JSON.stringify(seen));
    assert.deepEqual(last(), { playing: true, paused: false });
    assert.equal(last().playing, f.TTS.isPlaying());
    f.TTS.pause();
    assert.equal(f.TTS.isPlaying(), false, 'a paused narrator is not playing');
    assert.equal(seen.length, 2, 'pause is one more transition: ' + JSON.stringify(seen));
    assert.equal(last().playing, f.TTS.isPlaying(), 'the payload contradicted the getter');
    assert.deepEqual(last(), { playing: false, paused: true });
    f.TTS.stop();
    assert.deepEqual(last(), { playing: false, paused: false });
    assert.equal(last().playing, f.TTS.isPlaying());
  });

  // ── F11 ─────────────────────────────────────────────────────────────────────────────────────
  await test('F11 earcon() disconnects its oscillator and gain when the blip ends', () => {
    const f = ttsFixture();
    f.TTS.primeAudioSession();          // creates the ctx the earcon reuses
    const oscBase = f.nodes.oscillators.length, gainBase = f.nodes.gains.length, base = f.nodes.disconnects;
    f.TTS.earcon('ready');              // two blips = two oscillators + two gains
    const made = f.nodes.oscillators.slice(oscBase).concat(f.nodes.gains.slice(gainBase));
    assert.equal(made.length, 4, 'the "ready" earcon is two blips of two nodes each');
    const leaked = made.filter(n => n.connected && !n.disconnected);
    assert.equal(leaked.length, 0, 'earcon nodes stayed connected on a page-lifetime context: ' + leaked.length);
    assert.equal(f.nodes.disconnects - base, 4, 'both blips must disconnect both of their nodes');
  });

  await test('F11 stopAudioSessionPrimer() disconnects the primer source AND its gain', () => {
    const f = ttsFixture();
    f.TTS.primeAudioSession();
    const gains = f.nodes.gains.filter(g => g.connected);
    assert.equal(gains.length, 1, 'the primer wires one gain');
    f.TTS.stopAudioSessionPrimer();
    assert.equal(gains[0].disconnected, true, 'the primer gain outlived the primer');
    assert.equal(f.nodes.sources[0].disconnected, true, 'the primer source outlived the primer');
  });

  // ── F13 ─────────────────────────────────────────────────────────────────────────────────────
  await test('F13 a pause inside the 800ms window cancels the deferred mic open', () => {
    const doc = fakeDoc(), timers = fakeTimers();
    const deps = carDeps(doc, timers);
    const mode = loadCarMode(deps);
    mode.setCarMode(true);
    mode.setOptRead(true);                       // options already spoken this turn
    mode.autoMic();
    assert.equal(timers.pending(800).length, 1, 'the mic open is deferred by 800ms');
    assert.equal(mode.carVoiceCommand('pause'), true);
    timers.fire(800);
    assert.equal(deps._stt.starts, 0, 'a spoken pause inside the window still landed a hot mic');
  });

  await test('F13 narration starting inside the 800ms window cancels the deferred mic open', () => {
    const doc = fakeDoc(), timers = fakeTimers();
    const deps = carDeps(doc, timers);
    const mode = loadCarMode(deps);
    mode.setCarMode(true);
    mode.setOptRead(true);
    mode.autoMic();
    deps._tts.playing = true;                    // the next turn's narration started
    timers.fire(800);
    assert.equal(deps._stt.starts, 0, 'the mic opened on top of the narrator');
  });

  await test('F13 _carStartMic itself refuses under a hold or a live narrator', () => {
    const doc = fakeDoc(), timers = fakeTimers();
    const deps = carDeps(doc, timers);
    const mode = loadCarMode(deps);
    mode.setCarMode(true);
    deps._tts.playing = true;
    mode.startMic();
    assert.equal(deps._stt.starts, 0, 'the mic must never open over the narrator (it would hear our own read)');
    deps._tts.playing = false;
    mode.setCarMode(true);
    mode.carVoiceCommand('pause');               // held
    mode.startMic();
    assert.equal(deps._stt.starts, 0, 'the mic must stay closed while the session is held');
  });

  await test('F13 hideCarMode revokes both deferred timers', () => {
    const doc = fakeDoc(), timers = fakeTimers();
    const deps = carDeps(doc, timers);
    const mode = loadCarMode(deps);
    mode.setCarMode(true);
    mode.autoMic();                               // schedules the 300ms options poll
    assert.equal(timers.pending(300).length, 1, 'the options poll is scheduled');
    mode.setOptRead(true);
    mode.autoMic();                               // schedules the 800ms mic open
    assert.equal(timers.pending(800).length, 1);
    mode.hideCarMode();
    assert.equal(timers.pending(800).length, 0, 'hideCarMode could not revoke the deferred mic open');
    assert.equal(timers.pending(300).length, 0, 'hideCarMode could not revoke the options poll');
  });

  console.log((process.exitCode ? 'FAILED' : 'ALL GREEN') + ' — ' + passed + ' audit section-F voice checks');
})();
