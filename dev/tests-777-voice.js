// dev/tests-777-voice.js — audit 2026-11-19 (TODO #777), section V (the rows that can be judged without a phone):
// V3 UI sounds after the audio context is rebuilt · V6 the narrator's beeps obey the master mute · V8 a short first-person
// line is an action, not a command · V9 every kind Car Mode is sent is one it handles.
//   node dev/tests-777-voice.js             every case
//   node dev/tests-777-voice.js --only V8   the cases whose name contains the text
var assert = require("assert"), fs = require("fs"), path = require("path"), vm = require("vm");
var ROOT = path.join(__dirname, "..");
function src(f) { return fs.readFileSync(path.join(ROOT, f), "utf8"); }
var realLog = console.log, realErr = console.error;
var CASES = [];
function kase(name, fn) { CASES.push({ name: name, fn: fn }); }
function tick(ms) { return new Promise(function (r) { setTimeout(r, ms || 15); }); }

// ── V8, V9: the grammar and the kinds (the real engine) ────────────────────────────────────────────────────────────
var LE = require("./load-engine.js");
var quiet = { warn: console.warn, info: console.info, log: console.log, debug: console.debug };
console.warn = console.info = console.log = console.debug = function () {};
LE.loadEngine();
kase("V8: a short first-person line is the player's action — never a command", function () {
  var actions = ["I pause", "I repeat", "I resume", "I stop here", "I put it back", "I pause at the door", "i repeat the ritual", "I take the sword"];
  actions.forEach(function (a) { assert.strictEqual(parseCarCommand(a, 3, CAR_COMMANDS), null, JSON.stringify(a) + " was taken as the command " + JSON.stringify(parseCarCommand(a, 3, CAR_COMMANDS))); });
  var commands = [["pause", "pause"], ["uh pause", "pause"], ["okay repeat", "repeat"], ["I'll take two", "pick"], ["I want to pick the second", "pick"], ["I will go with one", "pick"], ["I pick three", "pick"], ["I take the first", "pick"], ["take one", "pick"], ["I'll repeat", "repeat"]];
  commands.forEach(function (c) { var r = parseCarCommand(c[0], 3, CAR_COMMANDS); assert.ok(r && r.kind === c[1], JSON.stringify(c[0]) + " is no longer the command " + c[1] + ": " + JSON.stringify(r)); });
});
kase("V9: every kind the game sends to Car Mode is one the loop handles — none is dropped without a status", function () {
  var loop = src("car-session.js"), at = loop.indexOf("function carNotify("), body = loop.slice(at, loop.indexOf("\n}\n", at)), handled = {}, m, re = /kind === "([a-z]+)"/g;
  while ((m = re.exec(body))) handled[m[1]] = 1;
  assert.ok(handled.error && handled.info && handled.warn, "fixture: carNotify's kinds were not read: " + Object.keys(handled));
  var bad = [];
  fs.readdirSync(ROOT).filter(function (f) { return /\.js$/.test(f); }).forEach(function (f) {
    var s = src(f), r2 = /carNotify\(\s*"([a-zA-Z]+)"/g, k;
    while ((k = r2.exec(s))) if (!handled[k[1]]) bad.push(f + ": carNotify(\"" + k[1] + "\")");
  });
  assert.deepStrictEqual(bad, [], "a kind is sent that carNotify has no branch for");
});

// ── V3: sound.js after a rebuilt context ───────────────────────────────────────────────────────────────────────────
function soundFixture() {
  var contexts = [], warns = [];
  function Ctx() { this.state = "running"; this.sampleRate = 8000; this.currentTime = 0; this.n = contexts.length; this.failGain = 0; this.live = 0; var self = this; this.destination = node(this); contexts.push(this); }
  function node(ctx) { return { ctx: ctx, gain: { value: 1, setValueAtTime: function () {}, exponentialRampToValueAtTime: function () {}, linearRampToValueAtTime: function () {} }, frequency: { value: 0, setValueAtTime: function () {}, exponentialRampToValueAtTime: function () {} }, Q: { value: 0 },
    connect: function (t) { if (t && t.ctx && t.ctx !== this.ctx) throw new Error("cannot connect to an AudioNode belonging to a different audio context"); this.out = (this.out || 0) + 1; this.ctx.live++; return t; }, disconnect: function () { this.ctx.live -= (this.out || 0); this.out = 0; }, start: function () {}, stop: function () {} }; }
  Ctx.prototype.createGain = function () { if (this.failGain > 0) { this.failGain--; throw new Error("createGain refused"); } return node(this); };
  Ctx.prototype.createOscillator = function () { return node(this); }; Ctx.prototype.createBiquadFilter = function () { return node(this); };
  Ctx.prototype.createBufferSource = function () { return node(this); }; Ctx.prototype.createConvolver = function () { return node(this); };
  Ctx.prototype.createBuffer = function (ch, len) { return { getChannelData: function () { return new Float32Array(len); } }; };
  Ctx.prototype.resume = function () { return this.refuse ? Promise.reject(new Error("Failed to start the audio device")) : Promise.resolve(); };
  Ctx.prototype.close = function () { this.closed = true; return Promise.resolve(); };
  var c = { console: { warn: function (m) { warns.push([].join.call(arguments, " ")); }, debug: function () {}, info: function () {}, log: function () {}, error: function () {} },
    window: { AudioContext: Ctx, addEventListener: function () {}, dispatchEvent: function () {} }, CustomEvent: function () {}, erCrumb: function () {},
    store: { get: function () { return ""; }, set: function () {}, del: function () {} }, localStorage: { getItem: function () { return null; }, setItem: function () {} },
    setTimeout: function () { return 1; }, clearTimeout: function () {}, performance: { now: function () { return Date.now(); } }, Promise: Promise, Math: Math, Date: Date, JSON: JSON, Object: Object, Array: Array, String: String, Float32Array: Float32Array, document: { addEventListener: function () {} } };
  c.globalThis = c; vm.createContext(c);
  var hp = src("helpers.js"), ra = hp.indexOf("function resumeObserved(");
  vm.runInContext(hp.slice(ra, hp.indexOf("\nfunction ", ra + 10)), c);
  ["audio-master.js", "sound.js"].forEach(function (f) { vm.runInContext(src(f), c, { filename: f }); });
  return { c: c, Sound: c.Sound, contexts: contexts, warns: warns };
}
var WET = { label: "wet test", wet: 0.4, notes: [{ f: 440, d: 0.05 }] };
kase("V3: after the audio context is rebuilt, a sound with reverb still plays — nothing is connected across contexts", function () {
  var f = soundFixture();
  assert.strictEqual(f.Sound.play(WET, true), true, "fixture: the first play failed");
  f.contexts[0].state = "suspended"; f.contexts[0].refuse = true;          // the iOS interruption: resume is refused
  f.Sound.play(WET, true);
  return tick().then(function () {
    assert.strictEqual(f.Sound.play(WET, true), true, "every sound fails once the context was rebuilt (the reverb belongs to the old one): " + JSON.stringify(f.warns));
    assert.strictEqual(f.contexts.length, 2, "fixture: no second context was built");
    assert.strictEqual(f.Sound.play("click_bone", true), true);
  });
});
kase("V3: a play that fails is said at warn level and leaves no node connected", function () {
  var f = soundFixture();
  f.Sound.play(WET, true);
  var ctx = f.contexts[0], before = ctx.live; f.warns.length = 0;
  ctx.failGain = 0; var real = ctx.createOscillator; ctx.createOscillator = function () { throw new Error("oscillator refused"); };
  assert.strictEqual(f.Sound.play(WET, true), false);
  ctx.createOscillator = real;
  assert.ok(f.warns.some(function (w) { return /play failed/.test(w) && /oscillator refused/.test(w); }), "a failed play is said at debug level only: " + JSON.stringify(f.warns));
  assert.strictEqual(ctx.live, before, "a failed play left " + (ctx.live - before) + " node connection(s) behind");
});

// ── V6: the narrator's beeps and the master mute ───────────────────────────────────────────────────────────────────
function ttsFixture() {
  var contexts = [], links = [];
  function node(tag) { var n = { tag: tag, connect: function (t) { links.push([n, t]); return t; }, disconnect: function () {} }; return n; }
  function Context() { this.state = "running"; this.sampleRate = 24000; this.currentTime = 0; this.destination = node("destination"); contexts.push(this); }
  Context.prototype.createGain = function () { return Object.assign(node("gain"), { gain: { value: 0, setValueAtTime: function () {}, cancelScheduledValues: function () {}, setTargetAtTime: function () {}, linearRampToValueAtTime: function () {}, exponentialRampToValueAtTime: function () {} } }); };
  Context.prototype.createBuffer = function () { return { duration: 1, getChannelData: function () { return new Float32Array(8); } }; };
  Context.prototype.createBufferSource = function () { return Object.assign(node("source"), { start: function () {}, stop: function () {} }); };
  Context.prototype.createOscillator = function () { return Object.assign(node("osc"), { frequency: { value: 0 }, start: function () {}, stop: function () {} }); };
  Context.prototype.resume = function () { this.state = "running"; return Promise.resolve(); };
  Context.prototype.suspend = function () { this.state = "suspended"; return Promise.resolve(); };
  var synth = { paused: false, speak: function () {}, cancel: function () {}, getVoices: function () { return []; }, pause: function () {}, resume: function () {} };
  var memory = { tnd_tts_gemini_v1: "1", tnd_voice_settings_v1: JSON.stringify({ primary: "gemini" }) };
  var c = { console: { warn: function () {}, info: function () {}, debug: function () {}, log: function () {}, error: function () {} },
    window: { AudioContext: Context, speechSynthesis: synth, addEventListener: function () {}, removeEventListener: function () {} },
    speechSynthesis: synth, SpeechSynthesisUtterance: function (t) { this.text = t; },
    document: { addEventListener: function () {}, removeEventListener: function () {}, getElementById: function () { return null; }, hidden: false }, navigator: { onLine: true },
    store: { get: function (k) { return memory[k] === undefined ? "" : memory[k]; }, set: function (k, v) { memory[k] = v; }, del: function (k) { delete memory[k]; } },
    localStorage: { getItem: function () { return null; }, setItem: function () {} }, providerKeys: { gemini: "test-key" }, eachMenuEl: function () {}, showToast: function () {},
    setTimeout: function () { return 1; }, clearTimeout: function () {}, setInterval: function () { return 1; }, clearInterval: function () {},
    Promise: Promise, Date: Date, Math: Math, JSON: JSON, Object: Object, Array: Array, String: String, Number: Number, isNaN: isNaN, parseFloat: parseFloat, parseInt: parseInt, AbortController: AbortController, Float32Array: Float32Array, Int16Array: Int16Array, Uint8Array: Uint8Array,
    WebAssembly: { __tndProbe: null }, fetch: function () { return new Promise(function () {}); }, carMode: true, worldState: { campId: "A", character: { name: "Hero" } } };
  c.globalThis = c; vm.createContext(c);
  var hp = src("helpers.js"), ra = hp.indexOf("function resumeObserved(");
  vm.runInContext(hp.slice(ra, hp.indexOf("\nfunction ", ra + 10)), c);
  ["audio-master.js", "audio-events.js", "audio-session.js", "tts.js"].forEach(function (f) { vm.runInContext(src(f), c, { filename: f }); });
  return { c: c, TTS: c.TTS, contexts: contexts, links: links };
}
kase("V6: the narrator's beep goes out through the master gain — with the phone muted it is silent", function () {
  var f = ttsFixture();
  f.c.AudioMaster.setMuted(true);
  f.TTS.earcon("ack");
  var ctx = f.contexts[0];
  assert.ok(ctx, "fixture: no audio context was built");
  var toDest = f.links.filter(function (l) { return l[1] === ctx.destination; }).map(function (l) { return l[0]; });
  var fromOsc = f.links.filter(function (l) { return l[0].tag === "osc"; }).map(function (l) { return l[1]; });
  assert.ok(fromOsc.length >= 1, "fixture: no beep was built");
  fromOsc.forEach(function (g) {
    var next = f.links.filter(function (l) { return l[0] === g; }).map(function (l) { return l[1]; });
    assert.ok(next.length === 1 && next[0] !== ctx.destination, "a beep is wired straight to the speakers — the master mute cannot silence it");
    assert.strictEqual(next[0].gain.value, 0, "the node a beep goes through is not the muted master gain (gain " + next[0].gain.value + ")");
    assert.ok(toDest.indexOf(next[0]) >= 0, "the node a beep goes through does not reach the speakers at all");
  });
});

// ── runner ─────────────────────────────────────────────────────────────────────────────────────────────────────────
var argv = process.argv.slice(2), only = argv.indexOf("--only") >= 0 ? argv[argv.indexOf("--only") + 1] : "", passed = 0, failed = 0;
// ── V1 (second ruling): a committed failure is spoken in the car, and arms no retry ────────────────────────────────
function carFixture() {
  var calls = [], els = {}, tts = { earcon: function (k) { calls.push("earcon:" + k); }, speak: function (t) { calls.push("speak:" + t); }, isOn: function () { return true; }, isPlaying: function () { return false; }, isPaused: function () { return false; } };
  var c = { console: { warn: function () {}, info: function () {}, debug: function () {}, log: function () {}, error: function () {} }, navigator: {}, setTimeout: function () { return 1; }, clearTimeout: function () {},
    document: { addEventListener: function () {}, removeEventListener: function () {}, getElementById: function (id) { return els[id] || (els[id] = { textContent: "", innerHTML: "", style: {}, classList: { add: function () {}, remove: function () {}, toggle: function () {} }, setAttribute: function () {} }); } } };
  vm.createContext(c);
  vm.runInContext(src("car-commands.js"), c, { filename: "car-commands.js" });
  vm.runInContext(src("car-session.js"), c, { filename: "car-session.js" });
  var host = {}; c.CAR_HOST_ROWS.forEach(function (r) { host[r.name] = function () { return null; }; });
  host.voice = function () { return tts; }; host.busy = function () { return false; }; host.parked = function () { return ""; };
  c.carSessionHost(host); c.carMode = true;
  return { c: c, calls: calls, els: els };
}
kase("V1: a failure the game hands the car to SAY is read aloud with the failure sound, and arms no tap-to-retry", function () {
  var f = carFixture();
  f.c.carNotify("say", "The turn was applied, but it could not be shown.");
  assert.deepStrictEqual(f.calls, ["earcon:fail", "speak:The turn was applied, but it could not be shown."], "the line was not spoken: " + JSON.stringify(f.calls));
  assert.ok(/could not be shown/.test(f.els["car-status"].textContent), "the status line does not carry it");
  assert.strictEqual(f.c._carRetryArmed, false, "a spoken failure armed the tap that sends the last action again");
  f.c.carNotify("error", "Turn failed"); assert.strictEqual(f.c._carRetryArmed, true, "fixture: a real turn failure no longer arms the retry");
  f.c.carNotify("say", "x"); assert.strictEqual(f.c._carRetryArmed, false, "a spoken committed failure left an older retry armed — its tap would send the turn that just landed again");
  var g = src("game.js");
  assert.ok(g.indexOf('carNotify("say","The turn was applied, but it could not be shown.")') >= 0 && g.indexOf('carNotify("say","The opening could not be shown. Reload to continue.")') >= 0, "the game does not hand the car its committed failures to say");
});
var todo = CASES.filter(function (c) { return !only || c.name.indexOf(only) >= 0; });
if (!todo.length) { realErr.call(console, "--only \"" + only + "\" matched 0 tests — NOTHING ran"); process.exit(1); }
function next(i) {
  if (i >= todo.length) {
    if (failed) { realErr.call(console, "#777 voice: " + failed + " FAILED, " + passed + " passed"); process.exit(1); }
    realLog.call(console, "ALL GREEN — " + passed + " #777 voice cases"); process.exit(0);
  }
  var c = todo[i];
  function ok() { passed++; realLog.call(console, "PASS #777 " + c.name); next(i + 1); }
  function bad(e) { failed++; realErr.call(console, "FAIL #777 " + c.name + " — " + String((e && e.stack) || e).split("\n").slice(0, 4).join("\n    ")); next(i + 1); }
  try { var r = c.fn(); if (r && typeof r.then === "function") r.then(ok, bad); else ok(); } catch (e) { bad(e); }
}
next(0);
