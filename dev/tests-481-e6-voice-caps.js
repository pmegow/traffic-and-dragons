// tests-481-e6-voice-caps.js — #481 E6 (audit 2026-09-29, Fable-approved): per-character voice controls were shown, and sent,
// for providers that ignore or misuse them. The sheet's Speed did nothing on Piper, the voice server, device voices or Gemini;
// a character's Inworld delivery direction went to Gemini AS the whole instruction ("gruff and unhurried\n\n<line>", the
// narrator's direction lost); and a mood split Speechify and Gemini requests although only Inworld reads moods.
// The fix: per-model unit capability flags on VOICE_MODELS (unitRate, unitDirection; markups already existed), consulted at ONE
// boundary — the cloud reader's grouper splits and stamps only on what its reader declares, and the sheet shows only the rows
// the primary honours, a hidden row leaving a one-line hint. Real tts.js in a vm; the sheet's renderer sliced from ui-sheets.js.
//   node dev/tests-481-e6-voice-caps.js
const assert = require('assert/strict'), fs = require('fs'), path = require('path'), vm = require('vm');
const root = path.join(__dirname, '..'), source = f => fs.readFileSync(path.join(root, f), 'utf8');
const VOICE = 'en_US-libritts_r-medium#12';   /* a Piper id, as speakerVoiceMap delivers it */
function fixture(primary) {
  const calls = [];
  const synth = { paused: false, speak() {}, cancel() {}, getVoices: () => [], pause() {}, resume() {} };
  function Utterance(text) { this.text = text; }
  function node() { return { connect() {}, disconnect() {} }; }
  function Context() { this.state = 'running'; this.sampleRate = 24000; this.currentTime = 0; this.destination = node(); }
  Context.prototype.createGain = function () { return Object.assign(node(), { gain: { value: 0, setValueAtTime() {}, cancelScheduledValues() {}, setTargetAtTime() {}, linearRampToValueAtTime() {} } }); };
  Context.prototype.createBuffer = function () { return { duration: 1, getChannelData: () => new Float32Array(8) }; };
  Context.prototype.createBufferSource = function () { return Object.assign(node(), { start() {}, stop() {} }); };
  Context.prototype.createOscillator = function () { return Object.assign(node(), { frequency: { value: 0 }, start() {}, stop() {} }); };
  Context.prototype.resume = function () { return Promise.resolve(); };
  const memory = { tnd_tts_gemini_v1: '1', tnd_voice_settings_v1: JSON.stringify({ primary }) };
  const c = {
    console: { warn() {}, info() {}, debug() {}, log() {}, error() {} },
    window: { AudioContext: Context, speechSynthesis: synth, addEventListener() {}, removeEventListener() {} },
    speechSynthesis: synth, SpeechSynthesisUtterance: Utterance,
    document: { addEventListener() {}, removeEventListener() {}, getElementById: () => null, hidden: false },
    navigator: { onLine: true },
    store: { get: k => (memory[k] === undefined ? '' : memory[k]), set: (k, v) => { memory[k] = v; }, del: k => { delete memory[k]; } },
    localStorage: { getItem: () => null, setItem() {} }, providerKeys: { gemini: 'test-key' }, eachMenuEl() {}, showToast() {},
    setTimeout: () => 1, clearTimeout() {}, setInterval: () => 1, clearInterval() {},
    Promise, Date, Math, JSON, Object, Array, String, Number, isNaN, parseFloat, parseInt, AbortController, Float32Array, Int16Array, Uint8Array, atob: s => Buffer.from(s, 'base64').toString('binary'),
    WebAssembly: { __tndProbe: null },
    fetch: (url, opts) => { calls.push({ url, opts: opts || {} }); return new Promise(() => {}); },   /* capture; never answer */
    carMode: true, worldState: { campId: 'A', character: { name: 'Hero' } },
    escHtml: s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
  };
  c.globalThis = c;
  vm.createContext(c);
  ['audio-events.js', 'tts.js'].forEach(f => vm.runInContext(source(f), c, { filename: f }));
  /* the sheet's voice renderer, sliced from ui-sheets.js (every csVoice* helper it calls) */
  const ui = source('ui-sheets.js');
  ['csVoiceDirectionHtml', 'csVoiceCapHint', 'csVoiceRateValue', 'csVoiceRateLabel'].forEach(name => {
    const a = ui.indexOf('function ' + name + '(');
    if (a < 0) return;
    vm.runInContext(ui.slice(a, ui.indexOf('\nfunction ', a + 10)), c, { filename: 'ui-sheets.js#' + name });
  });
  return { c, TTS: c.TTS, calls };
}
const tick = () => new Promise(r => setImmediate(r));
async function settle() { for (let i = 0; i < 40; i++) await tick(); }
let passed = 0;
const tests = [];
function test(name, fn) { tests.push([name, fn]); }

test('the repro: a directed character line on Gemini keeps the narrator\'s instruction — the sheet text never becomes the whole prompt', async () => {
  const f = fixture('gemini');
  f.TTS.speakResponse('Daeris growls at the gate. The rain keeps falling.', { 0: VOICE, directions: { 0: 'gruff and unhurried' } });
  await settle();
  const bodies = f.calls.filter(x => /generativelanguage/.test(x.url)).map(x => JSON.parse(x.opts.body).contents[0].parts[0].text);
  assert.ok(bodies.length >= 1, 'fixture: no Gemini request was made (' + JSON.stringify(f.calls.map(x => x.url)) + ')');
  const narr = f.TTS._gemini.direction();
  assert.ok(narr && narr.length > 20, 'fixture: the narrator direction');
  bodies.forEach(b => {
    assert.ok(!/^gruff and unhurried\n\n/.test(b), 'the bare sheet direction was sent as the whole instruction: ' + JSON.stringify(b.slice(0, 80)));
    assert.ok(b.indexOf(narr + '\n\n') === 0, 'every Gemini request opens with the narrator\'s direction: ' + JSON.stringify(b.slice(0, 80)));
  });
});

test('the readers split only on what they declare: Gemini on nothing, Speechify on speed, Inworld on direction, speed and mood', () => {
  const f = fixture('gemini');
  assert.equal(typeof f.TTS._voiceReaderGroup, 'function', 'the reader-grouping seam is missing');
  const units = [{ text: 'One.' }, { text: 'Two.' }, { text: 'Three.' }, { text: 'Four.' }];
  const voices = { 0: VOICE, 1: VOICE, 2: VOICE, 3: VOICE, directions: { 1: 'gruff', 2: 'gruff' }, rates: { 1: 1.2, 2: 1.2 }, moods: { 2: 'weary' },
    providers: { inworld: { 0: 'iw', 1: 'iw', 2: 'iw', 3: 'iw' }, speechify: { 0: 'sp', 1: 'sp', 2: 'sp', 3: 'sp' } } };
  const shape = id => f.TTS._voiceReaderGroup(id, units, voices).map(g => (g.direction || '') + '|' + (g.rate || '') + '|' + (g.mood || '') + '|' + g.text).join(' ~ ');
  assert.equal(shape('gemini'), '|||One. Two. Three. Four.', 'Gemini reads no unit direction, speed or mood — one request, nothing stamped');
  assert.equal(shape('speechify'), '|||One. ~ |1.2||Two. Three. ~ |||Four.', 'Speechify honours speed only — no split on the mood or the direction');
  assert.equal(shape('inworld'), '|||One. ~ gruff|1.2||Two. ~ gruff|1.2|weary|Three. ~ |||Four.', 'Inworld reads all three');
});

test('the sheet shows a row only where the primary honours it; a hidden row leaves a one-line hint and keeps the saved value', () => {
  const char = { name: 'Daeris', voiceDirection: 'gruff and unhurried', voiceRate: 1.2 };
  const rows = primary => fixture(primary).c.csVoiceDirectionHtml(char);
  const inworld = rows('inworld');
  assert.ok(/id='cs-voice-direction'/.test(inworld) && /id='cs-voice-rate'/.test(inworld), 'Inworld reads both: both rows show');
  assert.ok(!/cs-voice-hint/.test(inworld), 'no hint where nothing is hidden');
  const sp = rows('speechify');
  assert.ok(/id='cs-voice-rate'/.test(sp), 'Speechify honours speed: the Speed row shows');
  assert.ok(!/id='cs-voice-direction'/.test(sp), 'Speechify ignores the direction: the row is hidden');
  const spHints = sp.match(/class='cs-voice-hint'[^>]*>[^<]*/g) || [];
  assert.equal(spHints.length, 1, 'one hint for the one hidden row: ' + JSON.stringify(spHints));
  assert.ok(/Delivery direction/.test(spHints[0]) && /Inworld/.test(spHints[0]) && /kept/.test(spHints[0]), 'the hint names the row, who reads it, and that the saved one is kept: ' + spHints[0]);
  ['gemini', 'local', 'native'].forEach(p => {
    const h = rows(p), hints = h.match(/class='cs-voice-hint'[^>]*>[^<]*/g) || [];
    assert.ok(!/id='cs-voice-direction'/.test(h) && !/id='cs-voice-rate'/.test(h), p + ' honours neither: both rows hidden');
    assert.equal(hints.length, 2, p + ': one hint per hidden row: ' + JSON.stringify(hints));
    assert.ok(/Speed/.test(hints[1]) && /Speechify/.test(hints[1]) && /Inworld/.test(hints[1]), p + ': the Speed hint names who honours it: ' + hints[1]);
  });
  const bare = fixture('gemini').c.csVoiceDirectionHtml({ name: 'Nobody' });
  assert.ok(!/kept/.test(bare), 'nothing saved, nothing "kept": ' + bare);
});

(async () => {
  for (const [name, fn] of tests) {
    try { await fn(); passed++; console.log('PASS #481 E6 ' + name); }
    catch (e) { process.exitCode = 1; console.error('FAIL #481 E6 ' + name + ' — ' + (e && e.message || e)); }
  }
  console.log(process.exitCode ? 'FAILED — #481 E6' : 'ALL GREEN — ' + passed + ' #481 E6 groups');
})();
