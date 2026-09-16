// TODO #19: real TTS/STT code against a session that retains the microphone route.
// This models the reported Safari failure; hardware routing still needs an iPhone/car test.
const assert = require('assert/strict'), fs = require('fs'), path = require('path'), vm = require('vm');
const root = path.join(__dirname, '..');
function fixture(kind, options = {}) {
  const calls = [], warnings = [], toasts = [], recorders = [], recognizers = [];
  let liveMic = 0, route = 'car', type = 'auto', sources = 0;
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
  function Context() { this.state = 'running'; this.sampleRate = 22050; this.destination = {}; }
  Context.prototype.createBuffer = function() { return {}; };
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
    carMode: false, busy: false, setTimeout: () => 1, clearTimeout() {}, setInterval: () => 1, clearInterval() {}
  };
  vm.createContext(c);
  ['audio-events.js', 'tts.js', 'stt.js'].forEach(f => vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), c, { filename: f }));
  return { c, calls, warnings, toasts, recognizers, recorders, session,
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
  console.log((process.exitCode ? 'FAILED' : 'ALL GREEN') + ' — ' + passed + ' Bluetooth session groups');
})();
