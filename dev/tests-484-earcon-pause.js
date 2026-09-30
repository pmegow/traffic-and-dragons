// tests-484-earcon-pause.js — #484 (found by the #481 E8 Car Mode driver, 2026-09-29): a spoken "pause" mid-read acked with an
// earcon that UN-PAUSED the story. Car Mode's spoken pause runs TTS.pause() (suspends the shared narration AudioContext) and
// then TTS.earcon("ack"), whose blip resumed that same context — the read played on under a "Paused" screen, and the next
// tap (TTS.pause() toggles by the context's state) suspended it instead of resuming. An earcon must never resume a context
// TTS paused. Real tts.js in a vm, a Gemini read in flight (its request never answered), a fake AudioContext whose
// suspend/resume change its state.
//   node dev/tests-484-earcon-pause.js
const assert = require('assert/strict'), fs = require('fs'), path = require('path'), vm = require('vm');
const root = path.join(__dirname, '..'), source = f => fs.readFileSync(path.join(root, f), 'utf8');
function fixture() {
  const contexts = [], oscillators = [];
  function node() { return { connect() {}, disconnect() {} }; }
  function Context() { this.state = 'running'; this.sampleRate = 24000; this.currentTime = 0; this.destination = node(); contexts.push(this); }
  Context.prototype.createGain = function () { return Object.assign(node(), { gain: { value: 0, setValueAtTime() {}, cancelScheduledValues() {}, setTargetAtTime() {}, linearRampToValueAtTime() {} } }); };
  Context.prototype.createBuffer = function () { return { duration: 1, getChannelData: () => new Float32Array(8) }; };
  Context.prototype.createBufferSource = function () { return Object.assign(node(), { start() {}, stop() {} }); };
  Context.prototype.createOscillator = function () { const o = Object.assign(node(), { frequency: { value: 0 }, start() {}, stop() {} }); oscillators.push(o); return o; };
  Context.prototype.resume = function () { this.state = 'running'; return Promise.resolve(); };
  Context.prototype.suspend = function () { this.state = 'suspended'; return Promise.resolve(); };
  const synth = { paused: false, speak() {}, cancel() {}, getVoices: () => [], pause() {}, resume() {} };
  const memory = { tnd_tts_gemini_v1: '1', tnd_voice_settings_v1: JSON.stringify({ primary: 'gemini' }) };
  const c = {
    console: { warn() {}, info() {}, debug() {}, log() {}, error() {} },
    window: { AudioContext: Context, speechSynthesis: synth, addEventListener() {}, removeEventListener() {} },
    speechSynthesis: synth, SpeechSynthesisUtterance: function (t) { this.text = t; },
    document: { addEventListener() {}, removeEventListener() {}, getElementById: () => null, hidden: false },
    navigator: { onLine: true },
    store: { get: k => (memory[k] === undefined ? '' : memory[k]), set: (k, v) => { memory[k] = v; }, del: k => { delete memory[k]; } },
    localStorage: { getItem: () => null, setItem() {} }, providerKeys: { gemini: 'test-key' }, eachMenuEl() {}, showToast() {},
    setTimeout: () => 1, clearTimeout() {}, setInterval: () => 1, clearInterval() {},
    Promise, Date, Math, JSON, Object, Array, String, Number, isNaN, parseFloat, parseInt, AbortController, Float32Array, Int16Array, Uint8Array,
    WebAssembly: { __tndProbe: null }, fetch: () => new Promise(() => {}),
    carMode: true, worldState: { campId: 'A', character: { name: 'Hero' } }
  };
  c.globalThis = c;
  vm.createContext(c);
  const hp = source('helpers.js'), ra = hp.indexOf('function resumeObserved(');   /* the real B39 resume observer tts.js calls */
  vm.runInContext(hp.slice(ra, hp.indexOf('\nfunction ', ra + 10)), c, { filename: 'helpers.js#resumeObserved' });
  ['audio-events.js', 'tts.js'].forEach(f => vm.runInContext(source(f), c, { filename: f }));
  return { c, TTS: c.TTS, contexts, oscillators };
}
const settle = async () => { for (let i = 0; i < 40; i++) await new Promise(r => setImmediate(r)); };
let passed = 0;
const tests = [];
function test(name, fn) { tests.push([name, fn]); }

test('the repro: an earcon while the read is paused leaves it paused, and the next toggle resumes', async () => {
  const f = fixture();
  f.TTS.speakResponse('The guard lifts his lantern. Beyond him the road bends into the dark.');
  await settle();
  assert.equal(f.TTS.isPlaying(), true, 'fixture: the read is in flight');
  const ctx = f.contexts[f.contexts.length - 1];
  f.TTS.pause();                                         /* the spoken pause */
  assert.equal(ctx.state, 'suspended', 'fixture: the pause suspended the narration context');
  f.TTS.earcon('ack');                                   /* Car Mode's acknowledgement, right after */
  assert.equal(ctx.state, 'suspended', 'the earcon resumed the context the pause had suspended — the story plays on under "Paused"');
  assert.equal(f.TTS.isPaused(), true, 'still paused');
  f.TTS.pause();                                         /* the tap: meant to resume */
  assert.equal(ctx.state, 'running', 'the tap resumes');
  assert.equal(f.TTS.isPaused(), false, 'and the read is no longer paused');
});

test('an earcon still sounds whenever nothing is paused — idle, and during a playing read', async () => {
  const idle = fixture();
  idle.TTS.earcon('ready');
  assert.equal(idle.oscillators.length, 2, 'the idle "ready" earcon plays its two blips');
  const live = fixture();
  live.TTS.speakResponse('The rain keeps falling.');
  await settle();
  const before = live.oscillators.length;
  live.TTS.earcon('ack');
  assert.ok(live.oscillators.length > before, 'an earcon during a playing read still sounds');
});

(async () => {
  for (const [name, fn] of tests) {
    try { await fn(); passed++; console.log('PASS #484 ' + name); }
    catch (e) { process.exitCode = 1; console.error('FAIL #484 ' + name + ' — ' + (e && e.message || e)); }
  }
  console.log(process.exitCode ? 'FAILED — #484' : 'ALL GREEN — ' + passed + ' #484 groups');
})();
