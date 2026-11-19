// Probe: native STT — stop() then start() before the first recognizer's onend arrives (real recognizers end async).
// Does the stale onend clobber the second listen's state?
const fs = require('fs'), path = require('path'), vm = require('vm');
const root = 'C:/Projects/traffic-and-dragons', source = f => fs.readFileSync(path.join(root, f), 'utf8');
const input = { value: '', style: {}, title: '', oninput: null, focus() {}, blur() {}, classList: { add() {}, remove() {} } };
const recs = [], capture = [];
function Rec() { recs.push(this); this.stopped = false; }
Rec.prototype.start = function () {};
Rec.prototype.stop = function () { this.stopped = true; };   // async end: onend fires later, as in a browser
Rec.prototype.abort = function () { this.stopped = true; };
const memory = {};
const c = {
  console: { warn() {}, info() {}, debug() {}, log() {}, error() {} },
  window: { webkitSpeechRecognition: Rec },
  document: { getElementById: id => (id === 'action-input' ? input : null), addEventListener() {} },
  navigator: {},
  store: { get: k => (memory[k] === undefined ? '' : memory[k]), set: (k, v) => { memory[k] = v; } },
  localStorage: { getItem: () => null, setItem() {} },
  eachMenuEl() {}, showToast() {}, carMode: false, busy: false, carNotify() {}, carVoiceCommand: () => false,
  TTS: { speak() {} }, sendAction() {},
  setTimeout: () => 1, clearTimeout() {}, setInterval: () => 1, clearInterval() {},
  Promise, Date, Math, JSON, Object, Array, String, Number, RegExp, isNaN, parseFloat, parseInt,
  Blob: function () {}, FormData: function () { this.append = function () {}; }, fetch: () => Promise.reject(new Error('x'))
};
vm.createContext(c);
['globals.js', 'data.js', 'car-commands.js', 'helpers.js', 'audio-events.js', 'stt.js'].forEach(f => vm.runInContext(source(f), c, { filename: f }));
c.STT.on('capture', v => capture.push(v));
c.STT.start();                       // listen 1
c.STT.stop();                        // tap to stop — _listening flips false at once; onend is still pending
c.STT.start();                       // tap again — listen 2 starts
console.log('after 2nd start: listening =', c.STT.isListening(), ' recognizers =', recs.length);
recs[0].onend();                     // listen 1's onend finally arrives
console.log('after stale onend: listening =', c.STT.isListening(), ' capture edges =', JSON.stringify(capture));
c.STT.stop();                        // the player taps to stop listen 2
console.log('listen 2 recognizer stopped by the tap?', recs[1].stopped);
