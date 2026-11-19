// Probe: STT.cancel() (hideCarMode / _carDoReplay / _carReadOptions all call it) while a cloud take is
// UPLOADING. Does the transcript still land in the field and get sent? Fixture modelled on dev/tests-audit-voice.js sttFixture.
const fs = require('fs'), path = require('path'), vm = require('vm');
const root = 'C:/Projects/traffic-and-dragons', source = f => fs.readFileSync(path.join(root, f), 'utf8');
const input = { value: '', style: {}, title: '', oninput: null, focus() {}, blur() {}, classList: { add() {}, remove() {} } };
const state = { recorders: [], sent: [], notes: [], fetchResolve: null };
function Recorder(stream) { this.state = 'inactive'; this.mimeType = 'audio/webm'; state.recorders.push(this); }
Recorder.prototype.start = function () { this.state = 'recording'; };
Recorder.prototype.stop = function () { this.state = 'inactive'; if (this.ondataavailable) this.ondataavailable({ data: { size: 10 } }); if (this.onstop) this.onstop(); };
Recorder.isTypeSupported = () => false;
const stream = { getTracks: () => [{ stop() {} }], getAudioTracks: () => [{ getSettings: () => ({ sampleRate: 48000 }) }] };
const memory = {};
const c = {
  console: { warn() {}, info() {}, debug() {}, log() {}, error() {} }, MediaRecorder: Recorder,
  window: {},
  document: { getElementById: id => (id === 'action-input' ? input : null), addEventListener() {} },
  navigator: { mediaDevices: { getUserMedia() { return Promise.resolve(stream); } } },
  store: { get: k => (memory[k] === undefined ? '' : memory[k]), set: (k, v) => { memory[k] = v; } },
  localStorage: { getItem: () => null, setItem() {} },
  eachMenuEl() {}, showToast() {}, carMode: true, busy: false,
  carNotify: (kind, text) => state.notes.push(kind + (text ? ':' + text : '')),
  carVoiceCommand: () => false,
  TTS: { speak() {} },
  setTimeout: () => 1, clearTimeout() {}, setInterval: () => 1, clearInterval() {},
  Promise, Date, Math, JSON, Object, Array, String, Number, RegExp, isNaN, parseFloat, parseInt,
  Blob: function () {}, FormData: function () { this.append = function () {}; },
  sendAction: t => state.sent.push(t === null ? input.value : t),
  fetch: () => new Promise(res => { state.fetchResolve = () => res({ ok: true, json: () => Promise.resolve({ text: 'I draw my sword and charge the guard' }) }); })
};
vm.createContext(c);
['globals.js', 'data.js', 'car-commands.js', 'helpers.js', 'audio-events.js', 'stt.js'].forEach(f => vm.runInContext(source(f), c, { filename: f }));
c.providerKeys.openai = 'fixture';
c.STT.setConfirmGate(false);   // isolate the cancel question from the #77 suspicion gate
const settle = async () => { for (let i = 0; i < 30; i++) await new Promise(r => setImmediate(r)); };
(async () => {
  c.STT.start();                 // cloud path: getUserMedia → recorder
  await settle();
  console.log('recording:', c.STT.isListening());
  c.STT.stop();                  // the take ends (tap / VAD endpoint) → upload begins
  await settle();
  console.log('upload in flight:', !!state.fetchResolve, ' notes:', state.notes.join(' | '));
  // Car Mode closes (hideCarMode → M.cancel()) while "Transcribing…"
  c.carMode = false;
  c.STT.cancel();
  await settle();
  state.fetchResolve();          // the vendor answers
  await settle();
  console.log('field after cancel:', JSON.stringify(input.value));
  console.log('sent after cancel:', JSON.stringify(state.sent));
  // Second variant: cancel inside Car Mode (e.g. _carDoReplay) while the upload is in flight.
  input.value = ''; state.sent = []; state.fetchResolve = null; c.carMode = true;
  c.STT.start(); await settle(); c.STT.stop(); await settle();
  c.STT.cancel(); await settle();
  state.fetchResolve(); await settle();
  console.log('car-mode variant — sent after cancel:', JSON.stringify(state.sent));
})();
