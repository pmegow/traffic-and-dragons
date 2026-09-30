// TODO #19 second pass (2026-09-22): Car Mode's Media Session transport handlers are IDEMPOTENT.
// "play" and "pause" used to route into _carTap(), a TOGGLE — so a head unit that re-sends PLAY on
// its own (many do after a call-profile switch or on reconnect) paused the narration it meant to
// keep playing, and an idle PLAY replayed the last narration even while a turn was in flight or the
// mic was open. Real ui-carmode.js against stub TTS/STT/mediaSession; no DOM.
const assert = require('assert/strict'), fs = require('fs'), path = require('path'), vm = require('vm');
const root = path.join(__dirname, '..');
function fixture() {
  const handlers = {}, calls = [], crumbs = [], els = {};
  let clock = 1000, brief = 'You are at the gate. The guard waits.', warmResult = true;
  const world = { character: { name: 'A' } };   // activePlayer must return THIS object: a different one reads as a spotlit companion
  const el = () => ({ classList: { add() {}, remove() {} }, style: {}, textContent: '', innerHTML: '', disabled: false, value: '', offsetWidth: 0,
    getAttribute() { return null; }, setAttribute() {}, querySelectorAll() { return []; }, focus() {}, blur() {} });
  const tts = { _playing: false, _paused: false,
    isPlaying() { return this._playing && !this._paused; }, isPaused() { return this._paused; },
    pause() { calls.push('pause'); if (this._playing) this._paused = !this._paused; },
    replayLast() { calls.push('replay'); return true; }, getLastText() { return 'x'; },
    stop() { calls.push('stop'); }, speak() { calls.push('speak'); }, skip() { calls.push('skip'); },
    earcon() {}, setOnDone(fn) { this._onDone = fn; }, primeAudioSession() {}, stopAudioSessionPrimer() {}, isOn() { return true; } };
  tts.speak = function(text) { calls.push('speak:' + text); };
  const stt = { _listening: false, isListening() { return this._listening; },
    cancel() { calls.push('stt-cancel'); }, stop() { calls.push('stt-stop'); }, start() { calls.push('stt-start'); },
    isCloudActive() { return false; }, isSupported() { return true; }, setOnState() {}, clearConfirm() {},
    isConfirmPending() { return false; }, isAutoListen() { return true; },
    warmMic() { calls.push('warm'); return Promise.resolve(warmResult); } };
  const c = {
    console: { warn() {}, info() {}, debug() {}, log() {} },
    document: { addEventListener() {}, removeEventListener() {}, dispatchEvent() { return true; },
      getElementById(id) { return els[id] || (els[id] = el()); }, visibilityState: 'visible', hidden: false },
    navigator: { mediaSession: { playbackState: 'none', metadata: null, setActionHandler(kind, fn) { handlers[kind] = fn; } } },
    CustomEvent: function(type, init) { this.type = type; this.detail = init && init.detail; },
    Date: Object.assign(function() {}, { now: () => clock }),
    setTimeout: () => 1, clearTimeout() {},
    TTS: tts, STT: stt, carMode: true, busy: false, worldState: world,
    store: { get: () => '', set() {}, del() {} }, showToast() {}, closeAllMenus() {},
    erCrumb: (evt, data) => crumbs.push(evt + ' ' + data),
    activePlayer: () => world.character, escHtml: s => s, PREVIOUSLY_AFTER_MS: 7200000, carRecapText: () => 'FULL RECAP', sendAction() {}, retryLast() {},
    carSceneBrief: () => brief
  };
  vm.createContext(c);
  vm.runInContext(fs.readFileSync(path.join(root, 'ui-carmode.js'), 'utf8'), c, { filename: 'ui-carmode.js' });
  /* the spoken-command path (#410): parseCarCommand and carHoldDispatch, sliced from helpers.js with their constants */
  const hp = fs.readFileSync(path.join(root, 'helpers.js'), 'utf8'), ha = hp.indexOf('var CAR_CMD_FILLER'), hd = hp.indexOf('function carHoldDispatch(');
  vm.runInContext(hp.slice(ha, hp.indexOf('\n}\n', hd) + 3), c, { filename: 'helpers.js#car-commands' });
  c._carMediaHandlers();
  return { c, tts, stt, handlers, calls, crumbs, els, tick: ms => { clock += ms; }, setBrief: b => { brief = b; }, setWarm: v => { warmResult = v; } };
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
// ── #481 E8 (audit 2026-09-29; owner ruling: "a car's own PLAY is ignored during a spoken pause"; Fable: ALL four commands are
// no-ops while held, each landing a "media-action <kind> held" crumb; only spoken resume, the tap or hideCarMode releases).
// A head unit re-sends PLAY by itself after a call or a reconnect: it used to replay the last narration while the hold kept
// ambience silent.
test('the repro: after a spoken "pause", the car\'s own PLAY replays nothing and the hold stays', () => {
  const f = fixture();
  assert.equal(f.c.carVoiceCommand('pause'), true, 'fixture: the spoken pause is a command');
  assert.equal(f.c._carHeld, true, 'fixture: the session is held');
  f.calls.length = 0;
  f.handlers.play();
  assert.deepEqual(f.calls, [], 'a PLAY while held must not replay (or open anything): ' + JSON.stringify(f.calls));
  assert.equal(f.c._carHeld, true, 'the hold stays');
});
test('while held, all four commands are no-ops, each crumbed "held" — even right after a crumb of the same command; a paused narration stays paused', () => {
  const f = fixture(); f.tts._playing = true;
  f.handlers.play();                                             /* a redundant PLAY while reading: crumbed "playing" */
  f.c.carVoiceCommand('pause');                                  /* narration playing: the spoken pause pauses it AND holds */
  assert.equal(f.tts.isPaused(), true, 'fixture: the read is paused');
  f.calls.length = 0;
  f.handlers.play(); f.handlers.pause(); f.handlers.nexttrack(); f.handlers.previoustrack();
  assert.deepEqual(f.calls, [], 'nothing resumes, skips or replays while held: ' + JSON.stringify(f.calls));
  assert.equal(f.tts.isPaused(), true, 'the read stays paused');
  assert.deepEqual(f.crumbs, ['media-action play playing #1', 'media-action play held #2', 'media-action pause held #1', 'media-action next held #1', 'media-action prev held #1'],
    'the rate window coalesces a repeat, never a state change');
  f.handlers.play();
  assert.equal(f.crumbs.length, 5, 'a repeated held PLAY inside the window is coalesced');
});
test('the hold clears only via spoken resume, the tap, or leaving Car Mode — then PLAY works again', () => {
  const said = fixture(); said.c.carVoiceCommand('pause'); said.c.carVoiceCommand('resume');
  assert.equal(said.c._carHeld, false, 'spoken resume releases');
  said.stt._listening = false; said.calls.length = 0; said.handlers.play();
  assert.ok(said.calls.includes('replay'), 'after release an idle PLAY replays as before: ' + JSON.stringify(said.calls));
  const tap = fixture(); tap.c.carVoiceCommand('pause'); tap.c._carTap();
  assert.equal(tap.c._carHeld, false, 'the tap releases');
  const gone = fixture(); gone.c.carVoiceCommand('pause'); gone.c.hideCarMode();
  assert.equal(gone.c._carHeld, false, 'leaving Car Mode releases');
});
// ── #19 fourth pass (owner, 2026-09-23): "When car-mode starts, just read the current scene, and jump to options."
const flush = () => new Promise(r => setImmediate(r));
async function atest(name, fn) {
  try { await fn(); passed++; console.log('PASS #19b ' + name); }
  catch (e) { process.exitCode = 1; console.error('FAIL #19b ' + name + ' — ' + e.stack); }
}
(async () => {
  await atest('a stale entry warms the mic FIRST, then reads the scene brief, never the full recap', async () => {
    const f = fixture(); f.c.worldState.lastTurnAt = 1000 - 3 * 3600 * 1000;
    f.c.showCarMode(); await flush();
    assert.deepEqual(f.calls.filter(s => s === 'warm' || s.startsWith('speak:')), ['warm', 'speak:You are at the gate. The guard waits.']);
    assert.equal(f.els['car-status'].textContent, 'Narrator speaking…');
    assert(!f.calls.includes('stt-start'), 'the mic opens after the brief and the options, not at entry');
  });
  await atest('a fresh entry skips the brief and goes straight to the options step', async () => {
    const f = fixture(); f.c.worldState.lastTurnAt = 1000 - 60 * 1000;
    f.c.showCarMode(); await flush();
    assert.deepEqual(f.calls.filter(s => s.startsWith('speak:')), []);
    assert(f.calls.includes('warm'));
    assert.equal(f.els['car-status'].textContent, 'Getting your options…', 'the post-narration loop must be running');
  });
  await atest('a refused warm-up still proceeds to the brief; an empty brief falls through to the options', async () => {
    const f = fixture(); f.setWarm(false); f.c.worldState.lastTurnAt = 0;
    f.c.showCarMode(); await flush();
    assert.deepEqual(f.calls.filter(s => s.startsWith('speak:')), ['speak:You are at the gate. The guard waits.']);
    const g = fixture(); g.setBrief(''); g.c.worldState.lastTurnAt = 0;
    g.c.showCarMode(); await flush();
    assert.deepEqual(g.calls.filter(s => s.startsWith('speak:')), []);
    assert.equal(g.els['car-status'].textContent, 'Getting your options…');
  });
  await atest('the spoken "previously" command still reads the full recap', async () => {
    const f = fixture(); f.c.showCarMode(); await flush();
    f.c._carPreviously(true);
    assert(f.calls.includes('speak:FULL RECAP'));
  });
  console.log((process.exitCode ? 'FAILED' : 'ALL GREEN') + ' — ' + passed + ' Car Mode transport groups');
})();
