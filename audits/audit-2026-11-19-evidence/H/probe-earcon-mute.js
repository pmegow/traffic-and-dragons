// Probe: does TTS.earcon() honour the #657 master mute? Fixture copied from dev/tests-484-earcon-pause.js.
const fs = require('fs'), path = require('path'), vm = require('vm');
const root = 'C:/Projects/traffic-and-dragons', source = f => fs.readFileSync(path.join(root, f), 'utf8');
const contexts = [], gains = [], links = [];
function node(name) { const n = { name, connect(to) { links.push([n, to]); }, disconnect() {} }; return n; }
function Context() { this.state = 'running'; this.sampleRate = 24000; this.currentTime = 0; this.destination = node('destination'); contexts.push(this); }
Context.prototype.createGain = function () { const g = Object.assign(node('gain'), { gain: { value: 1 } }); gains.push(g); return g; };
Context.prototype.createBuffer = function () { return { duration: 1, getChannelData: () => new Float32Array(8) }; };
Context.prototype.createBufferSource = function () { return Object.assign(node('src'), { start() {}, stop() {} }); };
Context.prototype.createOscillator = function () { return Object.assign(node('osc'), { frequency: { value: 0 }, start() {}, stop() {} }); };
Context.prototype.resume = function () { this.state = 'running'; return Promise.resolve(); };
Context.prototype.suspend = function () { this.state = 'suspended'; return Promise.resolve(); };
const synth = { paused: false, speak() {}, cancel() {}, getVoices: () => [], pause() {}, resume() {} };
const memory = {};
const c = {
  console: { warn() {}, info() {}, debug() {}, log() {}, error() {} },
  window: { AudioContext: Context, speechSynthesis: synth, addEventListener() {}, removeEventListener() {} },
  speechSynthesis: synth, SpeechSynthesisUtterance: function (t) { this.text = t; },
  document: { addEventListener() {}, removeEventListener() {}, getElementById: () => null, hidden: false },
  navigator: { onLine: true },
  store: { get: k => (memory[k] === undefined ? '' : memory[k]), set: (k, v) => { memory[k] = v; }, del: k => { delete memory[k]; } },
  localStorage: { getItem: () => null, setItem() {} }, providerKeys: {}, eachMenuEl() {}, showToast() {},
  setTimeout: () => 1, clearTimeout() {}, setInterval: () => 1, clearInterval() {},
  Promise, Date, Math, JSON, Object, Array, String, Number, isNaN, parseFloat, parseInt, AbortController, Float32Array, Int16Array, Uint8Array,
  WebAssembly: { __tndProbe: null }, fetch: () => new Promise(() => {})
};
c.globalThis = c;
vm.createContext(c);
const hp = source('helpers.js'), ra = hp.indexOf('function resumeObserved(');
vm.runInContext(hp.slice(ra, hp.indexOf('\nfunction ', ra + 10)), c);
['audio-master.js', 'audio-events.js', 'audio-session.js', 'tts.js'].forEach(f => vm.runInContext(source(f), c, { filename: f }));
c.AudioMaster.setMuted(true);
console.log('AudioMaster.muted() =', c.AudioMaster.muted(), ' gain() =', c.AudioMaster.gain());
links.length = 0; gains.length = 0;
c.TTS.earcon('ready');
const ctx = contexts[contexts.length - 1];
links.forEach(([a, b]) => {
  const bName = b === ctx.destination ? 'ctx.destination' : b.name;
  console.log('link', a.name + (a.gain ? '(gain=' + a.gain.value + ')' : ''), '->', bName);
});
const audible = links.filter(([a, b]) => b === ctx.destination && a.gain && a.gain.value > 0);
console.log(audible.length ? 'RESULT: earcon reaches the destination at gain ' + audible[0][0].gain.value + ' while muted' : 'RESULT: earcon silent while muted');
