// tests-419-vad-context.js — #419 (audit F4): stt.js's silence-endpointing analyser no longer mints
// the page's THIRD AudioContext. It rides sound.js's one shared context when sound.js is on the
// page; a page without it (or a context sound.js cannot mint) keeps ONE lazy fallback for the page.
// Neither is ever closed by stt.js. Tested as BEHAVIOUR over the real _vadStart/_vadStop through
// the STT._vadTest seam, with a counting AudioContext constructor.
//
// Standalone battery (run-standalone-suites.js child process). Run directly:
//   node dev/tests-419-vad-context.js
//
// The iOS budget claim (one fewer concurrent context on the platform that caps them) holds by
// construction once this passes; it is not a device measurement.

var fs = require("fs");
var path = require("path");
var assert = require("assert/strict");
var root = path.join(__dirname, "..");
var geval = eval;

var constructed = 0, closed = 0;
function FakeContext(label) {
  constructed++;
  var ctx = this;
  this.label = label || "own"; this.state = "running";
  this.sources = []; this.analysers = [];
  this.createMediaStreamSource = function(stream) { var s = { stream: stream, connectedTo: null, disconnects: 0, connect: function(to) { s.connectedTo = to; }, disconnect: function() { s.disconnects++; } }; ctx.sources.push(s); return s; };
  this.createAnalyser = function() { var a = { fftSize: 0, getByteTimeDomainData: function(buf) { var i; for (i = 0; i < buf.length; i++) buf[i] = 128; } }; ctx.analysers.push(a); return a; };
  this.resume = function() { return Promise.resolve(); };
  this.close = function() { closed++; return Promise.resolve(); };
}
global.window = { SpeechRecognition: null, webkitSpeechRecognition: null, AudioContext: FakeContext };
global.document = { getElementById: function() { return null; } };
global.navigator = { mediaDevices: { getUserMedia: function() { return Promise.reject(new Error("not used")); } } };
global.MediaRecorder = function() {};
["globals.js", "data.js", "helpers.js", "audio-events.js", "stt.js"].forEach(function(f) {
  try { geval(fs.readFileSync(path.join(root, f), "utf8")); }
  catch (e) { console.error("ENGINE LOAD FAILED in " + f + ": " + e.message); process.exit(1); }
});
global.store = { get: function() { return ""; }, set: function() {} };
global.showToast = function() {};
global.carNotify = function() {};

var V = STT._vadTest;
var stream = { id: "mic" };
var passed = 0, failed = 0;
function test(name, fn) {
  try { V.stop(); constructed = 0; closed = 0; fn(); passed++; console.log("PASS #419 " + name); }
  catch (e) { failed++; console.error("FAIL #419 " + name + " — " + (e && e.message)); }
}

test("with sound.js on the page the analyser rides Sound.context(): no AudioContext is constructed, the mic source and a 512-point analyser are built on the SHARED context, and stop disconnects the source", function() {
  var shared = new FakeContext("shared"); constructed = 0; var asked = 0;
  global.Sound = { context: function() { asked++; return shared; } };
  V.start(stream);
  assert.equal(asked, 1, "Sound.context() was asked once");
  assert.equal(constructed, 0, "stt.js constructed no AudioContext of its own");
  assert.equal(V.ctx(), shared, "the shared context is the one in use");
  assert.equal(shared.sources.length, 1, "one mic source on the shared context");
  assert.equal(shared.sources[0].stream, stream, "built from the mic stream");
  assert.equal(shared.analysers.length, 1, "one analyser");
  assert.equal(shared.analysers[0].fftSize, 512, "the 512-point analyser");
  assert.equal(shared.sources[0].connectedTo, shared.analysers[0], "source → analyser");
  V.stop();
  assert.equal(shared.sources[0].disconnects, 1, "stop disconnects the mic source");
  assert.equal(closed, 0, "stt.js never closes the shared context");
  delete global.Sound;
});
test("a second take reuses the shared context again — still nothing constructed, nothing closed", function() {
  var shared = new FakeContext("shared"); constructed = 0;
  global.Sound = { context: function() { return shared; } };
  V.start(stream); V.stop(); V.start(stream); V.stop();
  assert.equal(constructed, 0); assert.equal(closed, 0); assert.equal(shared.sources.length, 2, "two takes, two sources, one context");
  delete global.Sound;
});
test("sound.js rebuilt its context between takes (a doomed one on iOS): the next take rides the NEW shared context", function() {
  var first = new FakeContext("shared1"), second = new FakeContext("shared2"), n = 0; constructed = 0;
  global.Sound = { context: function() { return (n++ === 0) ? first : second; } };
  V.start(stream); V.stop(); V.start(stream);
  assert.equal(V.ctx(), second, "the rebuilt context is the one in use"); assert.equal(second.sources.length, 1);
  V.stop(); delete global.Sound;
});
test("without sound.js (a satellite page) ONE lazy fallback context serves every take — constructed once across three takes, never closed", function() {
  delete global.Sound;
  V.start(stream); var own = V.ctx(); V.stop(); V.start(stream); V.stop(); V.start(stream); V.stop();
  assert.equal(constructed, 1, "one context constructed across three takes");
  assert.equal(V.own(), own, "the fallback is the page's singleton");
  assert.equal(own.sources.length, 3, "three sources on the one fallback context");
  assert.equal(closed, 0, "never closed");
});
test("Sound.context() returning null (no AudioContext for sound.js either) falls back to the singleton — and when sound.js comes back, its context wins again", function() {
  var own = V.own();
  global.Sound = { context: function() { return null; } }; constructed = 0;
  V.start(stream); assert.equal(V.ctx(), own, "the existing fallback is reused"); assert.equal(constructed, 0, "no new context for a null answer"); V.stop();
  var shared = new FakeContext("shared");
  global.Sound = { context: function() { return shared; } };
  V.start(stream); assert.equal(V.ctx(), shared, "the shared context wins when it exists"); V.stop();
  delete global.Sound;
});
test("no AudioContext at all: start degrades to cap-only endpointing without throwing", function() {
  delete global.Sound; var AC = global.window.AudioContext; global.window.AudioContext = null;
  var own = V.own(); V.own = V.own;
  try { V.start(stream); } finally { global.window.AudioContext = AC; }
  V.stop();
  assert.ok(true);
});
test("source pin: _vadStart asks Sound.context() before it would ever construct a context, and keeps its own in _vadOwnCtx", function() {
  var src = fs.readFileSync(path.join(root, "stt.js"), "utf8");
  var start = src.indexOf("function _vadStart("), body = src.slice(start, src.indexOf("function _vadStop(", start));
  assert.ok(body.indexOf("Sound.context()") >= 0, "the shared context is asked for");
  assert.ok(body.indexOf("Sound.context()") < body.indexOf("new AC()"), "asked BEFORE any construction");
  assert.ok(body.indexOf("if (!_vadOwnCtx) _vadOwnCtx = new AC();") >= 0, "the fallback is the lazy singleton");
  assert.ok(body.indexOf(".close(") < 0 && src.slice(src.indexOf("function _vadStop("), src.indexOf("function _cloudTeardownStream")).indexOf(".close(") < 0, "stt.js never closes a context");
});

if (failed) { console.error("#419 VAD CONTEXT TESTS FAILED (" + failed + " of " + (passed + failed) + ")"); process.exit(1); }
console.log("ALL GREEN — " + passed + " assertions passed (#419 VAD context)");
