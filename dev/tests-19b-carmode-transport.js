// TODO #19 second pass (2026-09-22): Car Mode's Media Session transport handlers are IDEMPOTENT.
// "play" and "pause" used to route into _carTap(), a TOGGLE — so a head unit that re-sends PLAY on
// its own (many do after a call-profile switch or on reconnect) paused the narration it meant to
// keep playing, and an idle PLAY replayed the last narration even while a turn was in flight or the
// mic was open. Real ui-carmode.js against stub TTS/STT/mediaSession; no DOM.
const assert = require('assert/strict'), fs = require('fs'), path = require('path'), vm = require('vm');
const root = path.join(__dirname, '..');
function fixture() {
  const handlers = {}, calls = [], crumbs = [], els = {};
  let clock = 1000;
  const el = () => ({ classList: { add() {}, remove() {} }, style: {}, textContent: '', innerHTML: '', disabled: false, value: '', offsetWidth: 0,
    getAttribute() { return null; }, setAttribute() {}, querySelectorAll() { return []; }, focus() {}, blur() {} });
  const tts = { _playing: false, _paused: false,
    isPlaying() { return this._playing && !this._paused; }, isPaused() { return this._paused; },
    pause() { calls.push('pause'); if (this._playing) this._paused = !this._paused; },
    replayLast() { calls.push('replay'); return true; }, getLastText() { return 'x'; },
    stop() { calls.push('stop'); }, speak() { calls.push('speak'); }, skip() { calls.push('skip'); },
    earcon() {}, setOnDone() {}, primeAudioSession() {}, stopAudioSessionPrimer() {}, isOn() { return true; } };
  const stt = { _listening: false, isListening() { return this._listening; },
    cancel() { calls.push('stt-cancel'); }, stop() { calls.push('stt-stop'); }, start() { calls.push('stt-start'); },
    isCloudActive() { return false; }, isSupported() { return true; }, setOnState() {}, clearConfirm() {},
    isConfirmPending() { return false; }, isAutoListen() { return true; } };
  const c = {
    console: { warn() {}, info() {}, debug() {}, log() {} },
    document: { addEventListener() {}, removeEventListener() {}, dispatchEvent() { return true; },
      getElementById(id) { return els[id] || (els[id] = el()); }, visibilityState: 'visible', hidden: false },
    navigator: { mediaSession: { playbackState: 'none', metadata: null, setActionHandler(kind, fn) { handlers[kind] = fn; } } },
    CustomEvent: function(type, init) { this.type = type; this.detail = init && init.detail; },
    Date: Object.assign(function() {}, { now: () => clock }),
    setTimeout: () => 1, clearTimeout() {},
    TTS: tts, STT: stt, carMode: true, busy: false, worldState: { character: { name: 'A' } },
    store: { get: () => '', set() {}, del() {} }, showToast() {}, closeAllMenus() {},
    erCrumb: (evt, data) => crumbs.push(evt + ' ' + data),
    activePlayer: () => ({ name: 'A' }), escHtml: s => s, PREVIOUSLY_AFTER_MS: 1, carRecapText: () => '', sendAction() {}, retryLast() {}
  };
  vm.createContext(c);
  vm.runInContext(fs.readFileSync(path.join(root, 'ui-carmode.js'), 'utf8'), c, { filename: 'ui-carmode.js' });
  c._carMediaHandlers();
  return { c, tts, stt, handlers, calls, crumbs, tick: ms => { clock += ms; } };
}
let passed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log('PASS #19b ' + name); }
  catch (e) { process.exitCode = 1; console.error('FAIL #19b ' + name + ' — ' + e.stack); }
}
test('all four transport handlers are registered', () => {
  const f = fixture();
  assert.deepEqual(Object.keys(f.handlers).sort(), ['nexttrack', 'pause', 'play', 'previoustrack']);
});
test('play while playing is a no-op (a redundant PLAY used to pause the read)', () => {
  const f = fixture(); f.tts._playing = true;
  f.handlers.play();
  assert.deepEqual(f.calls, []); assert.equal(f.tts.isPlaying(), true);
});
test('play while paused resumes exactly once', () => {
  const f = fixture(); f.tts._playing = true; f.tts._paused = true;
  f.handlers.play();
  assert.deepEqual(f.calls, ['pause']); assert.equal(f.tts.isPlaying(), true);
  assert.equal(f.c.navigator.mediaSession.playbackState, 'playing');
});
test('pause while playing pauses exactly once', () => {
  const f = fixture(); f.tts._playing = true;
  f.handlers.pause();
  assert.deepEqual(f.calls, ['pause']); assert.equal(f.tts.isPaused(), true);
  assert.equal(f.c.navigator.mediaSession.playbackState, 'paused');
});
test('pause while paused or idle is a no-op (a redundant PAUSE used to resume the read)', () => {
  const f = fixture(); f.tts._playing = true; f.tts._paused = true;
  f.handlers.pause();
  assert.deepEqual(f.calls, []); assert.equal(f.tts.isPaused(), true);
  const g = fixture(); g.handlers.pause();
  assert.deepEqual(g.calls, []);
});
test('idle play replays the last narration only when nothing else owns the moment', () => {
  const free = fixture(); free.handlers.play();
  assert.deepEqual(free.calls, ['stt-cancel', 'replay']);
  const busy = fixture(); busy.c.busy = true; busy.handlers.play();
  assert.deepEqual(busy.calls, [], 'a PLAY while a turn is in flight must not replay the read the GM is about to replace');
  const mic = fixture(); mic.stt._listening = true; mic.handlers.play();
  assert.deepEqual(mic.calls, [], 'a PLAY while the mic is open must not kill the dictation');
});
test('handlers do nothing once Car Mode is off', () => {
  const f = fixture(); f.c.carMode = false; f.tts._playing = true;
  f.handlers.play(); f.handlers.pause(); f.handlers.nexttrack(); f.handlers.previoustrack();
  assert.deepEqual(f.calls, []);
});
test('every command is crumbed with the state it arrived in, rate-limited per kind', () => {
  const f = fixture(); f.tts._playing = true;
  for (let i = 0; i < 5; i++) f.handlers.play();
  assert.deepEqual(f.crumbs, ['media-action play playing #1'], 'a spamming head unit must not flood the 24-entry ring');
  f.tick(2100); f.handlers.play();
  assert.deepEqual(f.crumbs, ['media-action play playing #1', 'media-action play playing #6'], 'the count keeps rising across the window');
  f.handlers.pause();
  assert.equal(f.crumbs[2], 'media-action pause playing #1', 'kinds are limited independently');
  const g = fixture(); g.c.busy = true; g.handlers.play(); g.stt._listening = true; g.c.busy = false; g.handlers.nexttrack();
  assert.deepEqual(g.crumbs, ['media-action play busy #1', 'media-action next listening #1']);
});
console.log((process.exitCode ? 'FAILED' : 'ALL GREEN') + ' — ' + passed + ' Car Mode transport groups');
