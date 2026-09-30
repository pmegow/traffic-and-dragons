// tests-481-e4-campaign-switch.js — #481 E4 (audit 2026-09-29, Fable-approved with changes): loading another campaign
// mid-read did not stop the narration (a cloud voice kept fetching and billing), and until the new campaign narrated once,
// "repeat", ⏮ or a steering-wheel PLAY read the PREVIOUS campaign's story. (1) The boundary is setActiveCampId(id)'s
// id-change branch. (2) The replay is keyed by campaign id. (3) The repro, plus "a new campaign stops the read".
// Real tts.js and the real setActiveCampId (sliced from state.js) in one vm context, with a fake native voice.
//   node dev/tests-481-e4-campaign-switch.js
const assert = require('assert/strict'), fs = require('fs'), path = require('path'), vm = require('vm');
const root = path.join(__dirname, '..'), source = f => fs.readFileSync(path.join(root, f), 'utf8');
function fixture() {
  const spoken = [], cancels = [];
  const synth = { paused: false, speak(u) { spoken.push(u.text); }, cancel() { cancels.push(1); }, getVoices: () => [], pause() {}, resume() {} };
  function Utterance(text) { this.text = text; this.onend = null; this.onerror = null; }
  function node() { return { connect() {}, disconnect() {} }; }
  function Context() { this.state = 'running'; this.sampleRate = 22050; this.currentTime = 0; this.destination = node(); }
  Context.prototype.createGain = function () { return Object.assign(node(), { gain: { value: 0, setValueAtTime() {}, cancelScheduledValues() {}, setTargetAtTime() {}, linearRampToValueAtTime() {} } }); };
  Context.prototype.createBuffer = function () { return { duration: 1 }; };
  Context.prototype.createBufferSource = function () { return Object.assign(node(), { start() {}, stop() {} }); };
  Context.prototype.createOscillator = function () { return Object.assign(node(), { frequency: { value: 0 }, start() {}, stop() {} }); };
  Context.prototype.resume = function () { return Promise.resolve(); };
  const memory = {}, settings = JSON.stringify({ primary: 'native' });
  const c = {
    console: { warn() {}, info() {}, debug() {}, log() {}, error() {} },
    window: { AudioContext: Context, speechSynthesis: synth, addEventListener() {}, removeEventListener() {} },
    speechSynthesis: synth, SpeechSynthesisUtterance: Utterance,
    document: { addEventListener() {}, removeEventListener() {}, getElementById: () => null, hidden: false },
    navigator: { onLine: true },
    store: { get: k => (k === 'tnd_voice_settings_v1' ? settings : (memory[k] === undefined ? '' : memory[k])), set: (k, v) => { memory[k] = v; }, del: k => { delete memory[k]; } },
    localStorage: { getItem: () => null, setItem() {} }, providerKeys: {}, eachMenuEl() {}, showToast() {},
    setTimeout: () => 1, clearTimeout() {}, setInterval: () => 1, clearInterval() {},
    Promise, Date, Math, JSON, Object, Array, String, Number, isNaN, parseFloat, parseInt, AbortController,
    WebAssembly: { __tndProbe: null }, fetch: () => Promise.reject(new Error('no network')),
    carMode: true,   /* speakResponse narrates in Car Mode even with the toggle off */
    ACTIVE_CAMP_K: 'tnd_active_camp_v1', checkpointClear() {},
    worldState: { campId: 'A', character: { name: 'Hero' } }
  };
  c.globalThis = c;
  vm.createContext(c);
  ['audio-events.js', 'tts.js'].forEach(f => vm.runInContext(source(f), c, { filename: f }));
  const st = source('state.js'), a = st.indexOf('function setActiveCampId('), b = st.indexOf('\nfunction ', a + 10);
  vm.runInContext(st.slice(a, b), c, { filename: 'state.js#setActiveCampId' });
  c.setActiveCampId('A');
  return { c, TTS: c.TTS, spoken, cancels };
}
let passed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log('PASS #481 E4 ' + name); }
  catch (e) { process.exitCode = 1; console.error('FAIL #481 E4 ' + name + ' — ' + (e && e.stack || e)); }
}
test('the repro: after a switch to campaign B, "repeat" reads nothing of campaign A', () => {
  const f = fixture();
  f.TTS.speakResponse('CAMPAIGN A: the dungeon door grinds shut behind you.');
  assert.ok(f.spoken.some(t => /CAMPAIGN A/.test(t)), 'fixture: campaign A narrated');
  f.TTS.stop();
  f.c.worldState = { campId: 'B', character: { name: 'Hero' } };   /* campaign B loads; it has not narrated yet */
  f.c.setActiveCampId('B');
  const n = f.spoken.length, r = f.TTS.replayLast();
  assert.equal(r, false, 'nothing of B to replay');
  assert.ok(!f.spoken.slice(n).some(t => /CAMPAIGN A/.test(t)), 'campaign A was read after the switch: ' + JSON.stringify(f.spoken.slice(n)));
});
test('B\'s own persisted narration still replays after a reload into B', () => {
  const f = fixture();
  f.c.worldState = { campId: 'B', character: { name: 'Hero' }, lastNarration: 'CAMPAIGN B: rain on the gatehouse.' };
  f.c.setActiveCampId('B');
  const n = f.spoken.length;
  assert.equal(f.TTS.replayLast(), true);
  assert.ok(f.spoken.slice(n).some(t => /CAMPAIGN B/.test(t)), 'this campaign\'s narration replays: ' + JSON.stringify(f.spoken.slice(n)));
});
test('a new campaign stops the read; re-activating the same campaign does not', () => {
  const f = fixture();
  f.TTS.speakResponse('CAMPAIGN A: a long description of the vaulted hall and its guttering torches.');
  const c0 = f.cancels.length;
  f.c.setActiveCampId('A');
  assert.equal(f.cancels.length, c0, 'the same campaign re-activated: the read goes on');
  f.c.worldState = { campId: 'B', character: { name: 'Hero' } };
  f.c.setActiveCampId('B');
  assert.ok(f.cancels.length > c0, 'the switch stops the voice');
  assert.equal(f.TTS.isPlaying(), false, 'nothing plays after the switch');
});
console.log(process.exitCode ? 'FAILED — #481 E4' : 'ALL GREEN — ' + passed + ' #481 E4 groups');
