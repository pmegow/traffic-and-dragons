// TODO #19: real TTS/STT code against a session that retains the microphone route.
// This models the reported Safari failure; hardware routing still needs an iPhone/car test.
const assert = require('assert/strict'), fs = require('fs'), path = require('path'), vm = require('vm');
const root = path.join(__dirname, '..');
function fixture(kind, options = {}) {
  const calls = [], warnings = [], toasts = [], recorders = [], recognizers = [], crumbs = [], contexts = [], buffers = [];
  let liveMic = 0, route = 'car', type = 'auto', sources = 0;
  const posCalls = [], intervals = [];
  const input = { value: '', style: {}, focus() {}, blur() {}, classList: { add() {}, remove() {} } };
  const session = {};
  Object.defineProperty(session, 'type', {
    get: () => type,
    set(value) {
      calls.push(value);
      if (options.rejectSession) throw Error('session refused');
      if (value === 'playback') {
        assert.equal(liveMic, 0, 'playback requested while the microphone is still live');
        route = 'car';
      }
      type = value;
    }
  });
  function openMic() {
    assert.notEqual(type, 'playback', 'microphone opened in playback-only session');
    liveMic++; route = 'phone'; type = 'play-and-record';
  }
  function Recognition() { recognizers.push(this); }
  Recognition.prototype.start = function() {
    if (options.startFails) throw Error('recognizer refused');
    openMic();
  };
  Recognition.prototype.stop = function() { calls.push('stop requested'); };
  Recognition.prototype.abort = Recognition.prototype.stop;
  Recognition.prototype.finish = function() { liveMic--; calls.push('mic ended'); this.onend(); };
  function Context() { this.state = 'running'; this.sampleRate = 22050; this.destination = {}; this.listeners = []; contexts.push(this); }
  Context.prototype.addEventListener = function(type, fn) { if (type === 'statechange') this.listeners.push(fn); };
  Context.prototype.setState = function(state) { this.state = state; this.listeners.slice().forEach(fn => fn({ target: this })); };
  Context.prototype.createBuffer = function(channels, length) { const data = new Float32Array(length || 0); buffers.push(data); return { length: length || 0, getChannelData: () => data }; };
  Context.prototype.createBufferSource = function() {
    sources++;
    return { context: this, connect() {}, start() {}, stop() {} };
  };
  Context.prototype.createGain = function() { return { gain: {}, connect() {} }; };
  Context.prototype.createMediaStreamSource = function() { return { connect() {}, disconnect() {} }; };
  Context.prototype.createAnalyser = function() { return {}; };
  const navigator = { mediaDevices: { getUserMedia() {
    if (options.permissionFails) return Promise.reject(Error('permission refused'));
    openMic();
    let stopped = false;
    return Promise.resolve({ getTracks() { return [{ stop() {
      if (!stopped) { liveMic--; stopped = true; calls.push('tracks stopped'); }
    } }]; } });
  } } };
  if (!options.unsupported) navigator.audioSession = session;
  navigator.mediaSession = { setPositionState(state) { posCalls.push(Object.assign({}, state)); } };
  function Recorder() {
    if (options.recorderFails) throw Error('recorder refused');
    this.state = 'inactive'; this.mimeType = 'audio/webm'; recorders.push(this);
  }
  Recorder.prototype.start = function() { this.state = 'recording'; };
  Recorder.prototype.stop = function() { this.state = 'inactive'; this.onstop(); };
  const c = { console: { warn: (...v) => warnings.push(v.join(' ')), info() {}, debug() {}, log() {} },
    navigator, window: { addEventListener() {}, AudioContext: Context, SpeechRecognition: kind === 'native' ? Recognition : null },
    document: { addEventListener() {}, getElementById: id => id === 'action-input' ? input : null },
    store: { get: () => '', set() {} }, providerKeys: { openai: 'fixture' },
    MediaRecorder: Recorder, eachMenuEl() {}, showToast: m => toasts.push(m),
    carMode: false, busy: false, setTimeout: () => 1, clearTimeout() {}, setInterval: (fn, ms) => { intervals.push(ms); return 1; }, clearInterval() {},
    erCrumb: (evt, data) => crumbs.push(evt + (data == null ? '' : ' ' + String(data)))
  };
  vm.createContext(c);
  ['audio-events.js', 'tts.js', 'stt.js'].forEach(f => vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), c, { filename: f }));
  return { c, calls, warnings, toasts, recognizers, recorders, session, crumbs, contexts, buffers, posCalls, intervals,
    route: () => route, liveMic: () => liveMic, sources: () => sources };
}
const flush = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };
let passed = 0;
async function test(name, fn) {
  try { await fn(); passed++; console.log('PASS #19 ' + name); }
  catch (e) { process.exitCode = 1; console.error('FAIL #19 ' + name + ' — ' + e.stack); }
}
(async () => {
  await test('native mic completion restores playback for every narration cycle', async () => {
    const f = fixture('native');
    f.c.TTS.primeAudioSession();
    for (let i = 0; i < 10; i++) {
      f.c.STT.start();
      assert.equal(f.route(), 'phone');
      f.c.TTS.primeAudioSession(); // reentrant playback priming must not kill capture
      f.recognizers[i].finish();
      assert.equal(f.session.type, 'playback', 'mic end left Safari in its recording session');
      assert.equal(f.route(), 'car', 'next narration retained the phone route');
      f.c.TTS.primeAudioSession();
    }
    assert.equal(f.sources(), 1, 'handoffs accumulated silent-loop sources');
    assert.deepEqual(f.warnings, [], 'healthy handoffs attempted an invalid session transition');
  });
  await test('native Stop and Cancel wait for onend before claiming playback', async () => {
    for (const method of ['stop', 'cancel']) {
      const f = fixture('native'); f.c.TTS.primeAudioSession(); f.c.STT.start();
      f.c.STT[method]();
      assert.equal(f.liveMic(), 1);
      assert.notEqual(f.session.type, 'playback');
      f.recognizers[0].finish();
      assert.equal(f.session.type, 'playback');
    }
  });
  await test('cloud Stop and Cancel close tracks before restoring playback and notifying subscribers', async () => {
    for (const method of ['stop', 'cancel']) {
      const f = fixture('cloud'); f.c.TTS.primeAudioSession();
      let ended = 0;
      f.c.STT.on('capture', active => { if (!active) {
        assert.equal(f.liveMic(), 0); assert.equal(f.session.type, 'playback'); ended++;
      } });
      for (let i = 0; i < 3; i++) {
        f.c.STT.start(); await flush();
        f.c.TTS.primeAudioSession();
        f.c.STT[method]();
        assert.equal(f.route(), 'car'); assert.equal(f.session.type, 'playback');
      }
      assert.equal(ended, 3);
      assert.deepEqual(f.warnings, [], 'playback was attempted before capture ended');
    }
  });
  await test('permission, recorder and recognition failures restore playback', async () => {
    for (const [kind, option] of [['cloud', 'permissionFails'], ['cloud', 'recorderFails'], ['native', 'startFails']]) {
      const f = fixture(kind, { [option]: true }); f.c.TTS.primeAudioSession();
      f.c.STT.start(); await flush();
      assert.equal(f.liveMic(), 0); assert.equal(f.session.type, 'playback', option);
    }
  });
  await test('primer claims playback even when its existing source is reused', async () => {
    const f = fixture('native'); f.c.TTS.primeAudioSession();
    assert.equal(f.session.type, 'playback');
    f.session.type = 'auto'; f.c.TTS.primeAudioSession();
    assert.equal(f.session.type, 'playback'); assert.equal(f.sources(), 1);
  });
  await test('unsupported browsers preserve recording and playback without session writes', async () => {
    const f = fixture('cloud', { unsupported: true });
    f.c.TTS.primeAudioSession(); f.c.STT.start(); await flush(); f.c.STT.stop();
    assert.equal(f.liveMic(), 0); assert.equal(f.sources(), 1);
    assert.deepEqual(f.calls, ['tracks stopped']);
  });
  await test('dictation without narration does not claim an exclusive playback session', async () => {
    const f = fixture('cloud'); f.c.STT.start(); await flush(); f.c.STT.stop();
    assert.equal(f.session.type, 'auto'); assert(!f.calls.includes('playback'));
  });
  await test('session rejection is visible, attributable and does not block mic cleanup', async () => {
    const f = fixture('cloud', { rejectSession: true });
    f.c.TTS.primeAudioSession(); f.c.STT.start(); await flush(); f.c.STT.cancel();
    assert.equal(f.liveMic(), 0);
    assert(f.warnings.some(s => /session refused/.test(s)));
    assert(f.toasts.some(s => /session refused/.test(s)));
  });
  // ── #19 second pass (2026-09-22): the car verification failed with a new symptom, so the
  // handoff is INSTRUMENTED (every transition rides the #16 crumb ring) and the primer can no
  // longer emit digital silence. These four groups fail on the v1.943 code.
  await test('audio-session transitions are crumbed as from>to', async () => {
    const f = fixture('native'); f.c.TTS.primeAudioSession();
    f.c.STT.start(); f.recognizers[0].finish();
    // the fixture's mic open models the platform resolving 'auto' to play-and-record, so the
    // restore crumb names THAT as its from-side — exactly what the ring should show on a real phone
    assert.deepEqual(f.crumbs.filter(s => s.startsWith('audio-session ')),
      ['audio-session auto>playback', 'audio-session playback>auto', 'audio-session play-and-record>playback']);
    f.c.TTS.primeAudioSession();
    assert.equal(f.crumbs.filter(s => s.startsWith('audio-session ')).length, 3, 'a same-value set must not crumb');
  });
  await test('the primer floor is dither, never digital silence', async () => {
    const f = fixture('native'); f.c.TTS.primeAudioSession();
    assert.equal(f.buffers.length, 1);
    const d = f.buffers[0]; let nonzero = 0, peak = 0;
    for (const x of d) { if (x !== 0) nonzero++; peak = Math.max(peak, Math.abs(x)); }
    assert(d.length > 0 && nonzero > d.length / 2, 'primer buffer is digital silence — a head unit that mutes on silence mutes every gap');
    assert(peak <= 1, 'primer dither exceeds full scale');
  });
  await test('read-start route fingerprint is coalesced, and forced after a capture ends', async () => {
    const f = fixture('native'); f.c.TTS.primeAudioSession();
    const route = () => f.crumbs.filter(s => s.startsWith('read-route '));
    f.c.TTS._audioSessionTest.routeCrumb('read'); f.c.TTS._audioSessionTest.routeCrumb('read');
    assert.equal(route().length, 1, 'identical fingerprints must coalesce (the ring holds 24 entries)');
    assert.match(route()[0], /as=playback/); assert.match(route()[0], /cap=0/);
    f.c.STT.start(); f.recognizers[0].finish();
    f.c.TTS._audioSessionTest.routeCrumb('read');
    assert.equal(route().length, 2, 'the first read after a capture must always be fingerprinted');
    f.c.TTS._audioSessionTest.routeCrumb('read');
    assert.equal(route().length, 2, 'the force is one-shot');
  });
  await test('narration context state changes are crumbed', async () => {
    const f = fixture('native'); f.c.TTS.primeAudioSession();
    assert.equal(f.contexts.length, 1);
    f.contexts[0].setState('interrupted'); f.contexts[0].setState('interrupted'); f.contexts[0].setState('running');
    assert.deepEqual(f.crumbs.filter(s => s.startsWith('ctx-state ')), ['ctx-state interrupted', 'ctx-state running'], 'a repeated state within the window must not crumb');
  });
  // ── #19 third pass (2026-09-22): plain narration over the car's Bluetooth stutters too, so the one
  // thing every WebAudio read did on a TIMER regardless of mode — a Now Playing metadata push every
  // 2 s — is gone. Some head units glitch their decode on each AVRCP metadata notification.
  await test('position state is ONE push per read, never a timer', async () => {
    const f = fixture('native'); f.c.TTS.primeAudioSession();
    f.c.TTS._audioSessionTest.armPosState(f.contexts[0], 'x'.repeat(280));
    f.c.TTS._audioSessionTest.armPosState(f.contexts[0], 'a later unit of the same read');
    assert.equal(f.posCalls.length, 1, 'a later unit of the same read must not push again');
    assert.equal(f.posCalls[0].position, 0); assert.equal(f.posCalls[0].playbackRate, 1);
    assert(f.posCalls[0].duration >= 15 && f.posCalls[0].duration <= 30, 'duration is estimated from the text at the current rate, got ' + f.posCalls[0].duration);
    assert.deepEqual(f.intervals, [], 'no interval may be armed for position state');
    f.c.TTS._audioSessionTest.clearPosState();
    assert.equal(f.posCalls.length, 2); assert.equal(f.posCalls[1].duration, 0);
    f.c.TTS._audioSessionTest.clearPosState();
    assert.equal(f.posCalls.length, 2, 'a clear with nothing armed must not push (every push reaches the car)');
  });
  // ── #19 fourth pass (owner, 2026-09-23): the mic PERMISSION is warmed at Car Mode entry so the prompt
  // lands while the car is parked. The warm-up rides the real handoff: the session is restored only
  // once the platform has released the mic (native onend / cloud tracks stopped), never on abort.
  await test('native mic warm-up starts a throwaway recognizer, aborts once live, restores playback on end', async () => {
    const f = fixture('native'); f.c.TTS.primeAudioSession();
    const p = f.c.STT.warmMic(); await flush();
    assert.equal(f.recognizers.length, 1); assert.equal(f.liveMic(), 1); assert.notEqual(f.session.type, 'playback');
    f.recognizers[0].onstart();
    assert(f.calls.includes('stop requested'), 'the warm-up must hand the mic back the moment it is live');
    assert.notEqual(f.session.type, 'playback', 'playback must wait for onend, not the abort');
    f.recognizers[0].finish();
    assert.equal(await p, true); assert.equal(f.liveMic(), 0); assert.equal(f.session.type, 'playback');
    assert.deepEqual(f.warnings, []); assert.equal(f.c.STT.isListening(), false);
  });
  await test('cloud mic warm-up opens and closes one stream and restores playback', async () => {
    const f = fixture('cloud'); f.c.TTS.primeAudioSession();
    assert.equal(await f.c.STT.warmMic(), true);
    assert(f.calls.includes('tracks stopped')); assert.equal(f.liveMic(), 0); assert.equal(f.session.type, 'playback');
    assert.deepEqual(f.warnings, []); assert.equal(f.recorders.length, 0, 'a warm-up never records');
  });
  await test('a refused or failed warm-up resolves false and still restores playback', async () => {
    const d = fixture('cloud', { permissionFails: true }); d.c.TTS.primeAudioSession();
    assert.equal(await d.c.STT.warmMic(), false); assert.equal(d.session.type, 'playback');
    const n = fixture('native', { startFails: true }); n.c.TTS.primeAudioSession();
    assert.equal(await n.c.STT.warmMic(), false); assert.equal(n.session.type, 'playback'); assert.equal(n.liveMic(), 0);
    const busy = fixture('native'); busy.c.TTS.primeAudioSession(); busy.c.STT.start();
    assert.equal(await busy.c.STT.warmMic(), false); assert.equal(busy.recognizers.length, 1, 'no warm-up while a listen is live');
  });
  console.log((process.exitCode ? 'FAILED' : 'ALL GREEN') + ' — ' + passed + ' Bluetooth session groups');
})();
