// Does Sound.play work on the context minted after a B39 rebuild? The reverb ConvolverNode is a singleton built on
// the FIRST context; WebAudio throws InvalidAccessError when a node is connected to a node of another context.
var engine = require("C:/Projects/traffic-and-dragons/dev/load-engine.js");
engine.loadEngine();
erCrumb = function () {};
var debugs = []; console.debug = function () { debugs.push(Array.prototype.join.call(arguments, " ")); };
var _w = console.warn; console.warn = function () {};
function node(ctx, extra) {
  var n = { ctx: ctx, gain: { value: 1, setValueAtTime: function () {}, exponentialRampToValueAtTime: function () {} }, frequency: { value: 0 }, Q: { value: 0 },
    connect: function (d) { if (d.ctx !== ctx) { var e = new Error("InvalidAccessError: cannot connect to a node belonging to a different audio context"); throw e; } },
    disconnect: function () {}, start: function () {}, stop: function () {} };
  return Object.assign(n, extra || {});
}
var made = [];
function FakeCtx() {
  var c = this; made.push(c); c.id = made.length; c.state = "running"; c.currentTime = 0; c.sampleRate = 8000;
  c.destination = node(c);
  c.resume = function () { return c.refuse ? Promise.reject(new Error("Failed to start the audio device")) : Promise.resolve(); };
  c.close = function () { c.closed = true; return Promise.resolve(); };
  c.createGain = function () { return node(c); }; c.createOscillator = function () { return node(c); };
  c.createBiquadFilter = function () { return node(c); }; c.createBufferSource = function () { return node(c); };
  c.createConvolver = function () { return node(c); };
  c.createBuffer = function (ch, len) { return { getChannelData: function () { return new Float32Array(len); } }; };
}
global.window = { AudioContext: FakeCtx, dispatchEvent: function () { return true; } };
global.CustomEvent = function (t, i) { this.type = t; this.detail = i && i.detail; };
var r1 = Sound.play("chime", true);
console.log("ctx1 play:", r1);
made[0].state = "suspended"; made[0].refuse = true;
Sound.play("chime", true);
setTimeout(function () {
  console.log("state after refusal:", Sound.state());
  var r2 = Sound.play("chime", true);
  console.log("ctx" + made.length + " (rebuilt) play:", r2, "| state:", Sound.state());
  console.log("debug lines:", JSON.stringify(debugs.filter(function (d) { return /play failed/.test(d); })));
}, 20);
