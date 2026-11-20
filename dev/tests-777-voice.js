// dev/tests-777-voice.js — audit 2026-11-19 (TODO #777), section V. Batch 1: the rows that can be judged without a phone.
// Batch 2 (2026-11-20): V2, V4, V5, V7, V10-V13 over fake platforms — what the code does, never device timing.
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
  function node(tag) { var n = { tag: tag, connect: function (t) { links.push([n, t]); return t; }, disconnect: function () { n.disconnects = (n.disconnects || 0) + 1; } }; return n; }
  function Context() { this.state = "running"; this.sampleRate = 24000; this.currentTime = 0; this.destination = node("destination"); contexts.push(this); }
  Context.prototype.createGain = function () { return Object.assign(node("gain"), { gain: { value: 0, setValueAtTime: function () {}, cancelScheduledValues: function () {}, setTargetAtTime: function () {}, linearRampToValueAtTime: function () {}, exponentialRampToValueAtTime: function () {} } }); };
  Context.prototype.createBuffer = function () { return { duration: 1, getChannelData: function () { return new Float32Array(8); } }; };
  Context.prototype.createBufferSource = function () { return Object.assign(node("source"), { start: function () {}, stop: function () { this.stopped = (this.stopped || 0) + 1; } }); };
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
// ── batch 2 (2026-11-20): the rows first left for a device — V2, V4, V5, V7, V10–V13 ───────────────────────────────
function settle(n) { var p = Promise.resolve(), i; for (i = 0; i < (n || 30); i++) p = p.then(function () { return new Promise(function (r) { setImmediate(r); }); }); return p; }
function sttFixture(o) {
  o = o || {};
  var input = { value: "", style: {}, title: "", oninput: null, focus: function () {}, blur: function () {}, classList: { add: function () {}, remove: function () {} } };
  var st = { input: input, recorders: [], recs: [], sent: [], notes: [], toasts: [], warns: [], infos: [], capture: [], tracksStopped: 0, fetchResolve: null };
  function Recorder() { this.state = "inactive"; this.mimeType = "audio/webm"; st.recorders.push(this); }
  Recorder.prototype.start = function () { this.state = "recording"; };
  Recorder.prototype.stop = function () { this.state = "inactive"; if (this.ondataavailable) this.ondataavailable({ data: { size: 10 } }); if (this.onstop) this.onstop(); };
  Recorder.isTypeSupported = function () { return false; };
  function Rec() { st.recs.push(this); this.stopped = false; this.aborted = false; }
  Rec.prototype.start = function () { if (o.startThrows) throw new Error("recognition already started"); };
  Rec.prototype.stop = function () { this.stopped = true; };      // the end event comes later, as in a browser
  Rec.prototype.abort = function () { this.stopped = true; this.aborted = true; };
  var stream = { getTracks: function () { return [{ stop: function () { st.tracksStopped++; } }]; }, getAudioTracks: function () { return [{ getSettings: function () { return { sampleRate: 48000 }; } }]; } };
  var memory = {};
  var c = { console: { warn: function () { st.warns.push([].join.call(arguments, " ")); }, info: function () { st.infos.push([].join.call(arguments, " ")); }, debug: function () {}, log: function () {}, error: function () {} },
    MediaRecorder: Recorder, window: o.native ? { webkitSpeechRecognition: Rec } : {},
    document: { getElementById: function (id) { return id === "action-input" ? input : null; }, addEventListener: function () {} },
    navigator: { mediaDevices: { getUserMedia: function () { return o.gum ? o.gum() : Promise.resolve(stream); } } },
    store: { get: function (k) { return memory[k] === undefined ? "" : memory[k]; }, set: function (k, v) { memory[k] = v; } }, localStorage: { getItem: function () { return null; }, setItem: function () {} },
    eachMenuEl: function () {}, showToast: function (m) { st.toasts.push(m); }, carMode: o.carMode !== false, busy: false,
    carNotify: function (kind, text) { if (o.notifyThrows && text && text.indexOf(o.notifyThrows) === 0) throw new Error("the overlay is gone"); st.notes.push(kind + (text ? ":" + text : "")); },
    carVoiceCommand: function () { return false; }, TTS: { speak: function () {} },
    setTimeout: function () { return 1; }, clearTimeout: function () {}, setInterval: function () { return 1; }, clearInterval: function () {},
    Promise: Promise, Date: Date, Math: Math, JSON: JSON, Object: Object, Array: Array, String: String, Number: Number, RegExp: RegExp, isNaN: isNaN, parseFloat: parseFloat, parseInt: parseInt,
    Blob: function () {}, FormData: function () { this.append = function () {}; },
    sendAction: function (t) { st.sent.push(t === null ? input.value : t); },
    fetch: function () { return new Promise(function (res) { st.fetchResolve = function () { res({ ok: true, json: function () { return Promise.resolve({ text: "I draw my sword and charge the guard" }); } }); }; }); } };
  vm.createContext(c);
  ["globals.js", "data.js", "car-commands.js", "helpers.js", "audio-events.js", "stt.js"].forEach(function (f) { vm.runInContext(src(f), c, { filename: f }); });
  c.providerKeys.openai = "fixture";
  c.STT.setConfirmGate(false);
  c.STT.on("capture", function (v) { st.capture.push(v); });
  st.c = c; st.STT = c.STT; st.stream = stream;
  return st;
}
kase("V2: a cloud take cancelled while it is being transcribed is discarded — nothing is written, nothing is sent", function () {
  var f = sttFixture();
  f.STT.start();
  return settle().then(function () {
    assert.strictEqual(f.STT.isListening(), true, "fixture: the recording did not start");
    f.STT.stop(); return settle();
  }).then(function () {
    assert.ok(f.fetchResolve, "fixture: no upload is in flight");
    f.STT.cancel(); return settle();
  }).then(function () { f.fetchResolve(); return settle(); }).then(function () {
    assert.deepStrictEqual(f.sent, [], "a take the player cancelled while it was transcribing was sent as a turn");
    assert.strictEqual(f.input.value, "", "a cancelled take's words were written into the field: " + JSON.stringify(f.input.value));
    f.fetchResolve = null; f.STT.start(); return settle();       // the next take is its own: it is heard and sent
  }).then(function () { f.STT.stop(); return settle(); }).then(function () { f.fetchResolve(); return settle(); }).then(function () {
    assert.deepStrictEqual(f.sent, ["I draw my sword and charge the guard"], "the take after a cancelled one was lost too");
    f.infos.length = 0; f.STT.cancel();                         // nothing pending: a cancel here discards nothing, and says nothing
    assert.ok(!f.infos.some(function (m) { return /discarded/.test(m); }), "a cancel with no take in flight reports that it discarded one: " + JSON.stringify(f.infos));
    f.fetchResolve = null; f.STT.start(); return settle();
  }).then(function () { f.STT.stop(); return settle(); }).then(function () { f.fetchResolve(); return settle(); }).then(function () {
    assert.strictEqual(f.sent.length, 2, "a cancel with nothing in flight discarded the take that followed it");
  });
});
kase("V7: the end of a stopped recognizer does not touch the listen that replaced it", function () {
  var f = sttFixture({ native: true, carMode: false });
  f.STT.start(); f.STT.stop(); f.STT.start();
  assert.strictEqual(f.recs.length, 2, "fixture: the second listen made no recognizer");
  assert.strictEqual(f.recs[0].aborted, true, "the recognizer still ending was not let go when the next listen began");
  f.recs[0].onend();
  assert.strictEqual(f.STT.isListening(), true, "a stale end event marked the live listen as over");
  assert.deepStrictEqual(f.capture.filter(function (v) { return v === false; }), [], "a stale end event released the microphone session while a recognizer is live: " + JSON.stringify(f.capture));
  f.recs[0].onresult({ resultIndex: 0, results: [Object.assign([{ transcript: "stale words", confidence: 0.9 }], { isFinal: true })] });
  assert.strictEqual(f.input.value, "", "a stopped recognizer's late result was written into the new listen's field");
  f.recs[0].onerror({ error: "network" });
  assert.deepStrictEqual(f.toasts, [], "a stopped recognizer's late error was reported against the new listen");
  f.STT.stop();
  assert.strictEqual(f.recs[1].stopped, true, "the live recognizer can no longer be stopped by the tap");
  f.recs[1].onend();
  assert.strictEqual(f.STT.isListening(), false);
  assert.strictEqual(f.capture[f.capture.length - 1], false, "the real end no longer releases the microphone session");
});
kase("V12: a recognizer that fails to start says so", function () {
  var f = sttFixture({ native: true, startThrows: true });
  f.STT.start();
  assert.strictEqual(f.STT.isListening(), false);
  assert.ok(f.toasts.some(function (t) { return /start voice input/.test(t); }), "nothing was shown: " + JSON.stringify(f.toasts));
  assert.ok(f.notes.some(function (n) { return /^warn:Voice input failed: recognition already started/.test(n); }), "the car was not told why: " + JSON.stringify(f.notes));
  assert.ok(f.warns.some(function (w) { return /recognition already started/.test(w); }), "the console holds no reason");
});
kase("V12: a microphone failure is named for what it is — only a refusal is called permission denied", function () {
  function one(name) { var e = new Error("the platform's words"); e.name = name; var f = sttFixture({ gum: function () { return Promise.reject(e); } }); f.STT.start(); return settle().then(function () { return f; }); }
  return one("NotAllowedError").then(function (f) {
    assert.ok(/permission denied/i.test(f.toasts.join("|")) && /permission denied/i.test(f.notes.join("|")), "a refusal is no longer called permission denied: " + JSON.stringify(f.toasts));
    return one("NotFoundError");
  }).then(function (f) {
    assert.ok(!/permission/i.test(f.toasts.join("|") + f.notes.join("|")), "a missing microphone is called a permission denial: " + JSON.stringify(f.toasts));
    assert.ok(/No microphone/.test(f.toasts.join("|")) && /No microphone/.test(f.notes.join("|")), "a missing microphone is not named: " + JSON.stringify(f.toasts));
    return one("NotReadableError");
  }).then(function (f) {
    assert.ok(!/permission/i.test(f.toasts.join("|") + f.notes.join("|")) && /in use/.test(f.toasts.join("|")), "a busy microphone is not named: " + JSON.stringify(f.toasts));
    assert.strictEqual(f.capture[f.capture.length - 1], false, "a failed open keeps the capture session");
    return one("WeirdError");
  }).then(function (f) {
    assert.ok(/could not be opened: the platform's words/.test(f.toasts.join("|")), "an unknown failure does not carry the platform's reason: " + JSON.stringify(f.toasts));
  });
});
kase("V12: a recording that fails to set up after the microphone opened lets the microphone go, and is not called a permission denial", function () {
  var f = sttFixture({ notifyThrows: "Recording" });
  f.STT.start();
  return settle().then(function () {
    assert.ok(!/permission/i.test(f.toasts.join("|")), "a failure after the microphone opened is called a permission denial: " + JSON.stringify(f.toasts));
    assert.ok(f.tracksStopped >= 1, "the microphone stays open: no track was stopped");
    assert.strictEqual(f.STT.isListening(), false, "the page still reads as listening");
    assert.ok(/Voice input failed/.test(f.toasts.join("|")), "nothing was shown: " + JSON.stringify(f.toasts));
    assert.strictEqual(f.recorders[0].state, "inactive", "the recorder was left running");
    assert.strictEqual(f.fetchResolve, null, "the abandoned take was uploaded");
  });
});

kase("V5: stop retires every scheduled source — disconnected, and the buffer detached", function () {
  var f = ttsFixture(), S = f.TTS._speakerTest, ctx = new f.c.window.AudioContext(), ended = 0;
  S.scheduleDecoded(ctx, { duration: 2 }, 0, 0.1, function () { ended++; });
  S.scheduleDecoded(ctx, { duration: 3 }, 2, 0.1, function () { ended++; });
  var srcs = S.sources();
  assert.strictEqual(srcs.length, 2, "fixture: the sources were not tracked");
  f.TTS.stop();
  srcs.forEach(function (s, i) {
    assert.strictEqual(s.stopped, 1, "source " + i + " was not stopped");
    assert.ok(s.disconnects >= 1, "source " + i + " stays connected to the master gain after a stop");
    assert.strictEqual(s.buffer, null, "source " + i + " keeps its decoded audio after a stop (Safari retains it until the buffer is detached)");
    assert.strictEqual(s.onended, null, "source " + i + " would still run its lane's bookkeeping");
  });
  assert.strictEqual(S.sources().length, 0); assert.strictEqual(ended, 0, "a stop ran the lane's end bookkeeping");
});
function piperFixture(reply) {
  var f = ttsFixture(), handlers = [], frames = [], timers = [];
  f.c.location = { origin: "https://fixture" };
  f.c.window.addEventListener = function (t, h) { if (t === "message") handlers.push(h); };
  f.c.window.removeEventListener = function (t, h) { var i = handlers.indexOf(h); if (i >= 0) handlers.splice(i, 1); };
  f.c.setTimeout = function (fn, ms) { timers.push({ fn: fn, ms: ms, cleared: false }); return timers.length; };
  f.c.clearTimeout = function (id) { if (timers[id - 1]) timers[id - 1].cleared = true; };
  function post(frame, data) { Promise.resolve().then(function () { handlers.slice().forEach(function (h) { h({ source: frame.contentWindow, origin: "https://fixture", data: data }); }); }); }
  f.c.document.createElement = function () {
    var frame = { style: {}, ops: [], removed: false, setAttribute: function () {}, remove: function () { frame.removed = true; } };
    frame.contentWindow = { postMessage: function (m) { frame.ops.push(m.op); var r = reply(m.op, m.args); if (r) post(frame, Object.assign({ tnd: "rpc", id: m.id }, r)); } };
    frames.push(frame); return frame;
  };
  f.c.document.body = { appendChild: function (frame) { post(frame, { tnd: "ready" }); } };
  f.handlers = handlers; f.frames = frames; f.timers = timers; f.P = f.TTS._piperTest;
  return f;
}
kase("V4: a Piper frame whose start-up fails is destroyed — no orphan iframe, no listener left", function () {
  function run(reply) {
    var f = piperFixture(reply);
    return f.P.init().then(function () { return f; }, function () { return f; }).then(function (g) {
      assert.strictEqual(g.frames.length, 1, "fixture: no frame was spawned");
      assert.ok(g.frames[0].ops.indexOf("init") >= 0, "fixture: the frame was never asked to start");
      assert.strictEqual(g.frames[0].removed, true, "the frame whose start-up failed is still in the page");
      assert.strictEqual(g.handlers.length, 0, "its message listener is still on the window");
      assert.strictEqual(g.P.frame(), null, "the failed frame is still the engine");
    });
  }
  return run(function (op) { return op === "init" ? { ok: false, err: "the runtime import failed" } : { ok: true, result: {} }; })
    .then(function () { return run(function (op) { return op === "mem" ? { ok: false, err: "mem refused" } : { ok: true, result: { patch: "r9", pathMap: {} } }; }); });
});
kase("V10: a Piper call that never answers is given up at its deadline, and the frame that hung is destroyed", function () {
  var hang = { predict: 1, download: 1 }, toasts = [];
  var f = piperFixture(function (op) { if (op === "diag") throw new Error("the frame is gone"); return hang[op] ? null : { ok: true, result: { patch: "r9", pathMap: {} } }; }), adapter, outcome = null, other = null;
  f.c.showToast = function (m) { toasts.push(m); };
  function armed() { return f.timers.filter(function (t) { return t.ms === f.P.deadlineMs && !t.cleared && !t.fired; }); }
  assert.ok(f.P.deadlineMs >= 60000, "fixture: no deadline is declared");
  return f.P.init().then(function (a) {
    adapter = f.P.frame();
    assert.ok(adapter && adapter === a, "fixture: the frame is not the live engine");
    return adapter.stored();
  }).then(function () {
    return adapter.diag().then(function () { throw new Error("fixture: the call that could not be posted answered"); }, function () {});
  }).then(function () {
    assert.strictEqual(armed().length, 0, "a call that could not be posted left its deadline timer armed");

    var live = f.timers.filter(function (t) { return t.ms === f.P.deadlineMs && !t.cleared; });
    assert.strictEqual(live.length, 0, "a call that answered left its deadline timer armed (one per call, for the page's life)");
    adapter.download("voice", function () {}).then(null, function () {});   // rejected when the frame is destroyed below
    assert.strictEqual(f.timers.filter(function (t) { return t.ms === f.P.deadlineMs && !t.cleared; }).length, 0, "a download is cut off by the call deadline (a model is 60-115 MB)");
    hang.stored = 1; adapter.stored().then(function () { other = "answered"; }, function (e) { other = String(e && e.message); });   // a second call, waiting behind the hung one
    adapter.predict({ text: "x", voiceId: "v", rate: 1 }).then(function () { outcome = "answered"; }, function (e) { outcome = String(e && e.message); });
    return settle(5);
  }).then(function () {
    assert.strictEqual(outcome, null, "fixture: the hung call settled by itself");
    var live = f.timers.filter(function (t) { return t.ms === f.P.deadlineMs && !t.cleared; });
    assert.strictEqual(live.length, 2, "a call that can wedge the engine has no deadline");
    live[1].fired = true; live[1].fn();
    return settle(5);
  }).then(function () {
    assert.ok(/did not answer/.test(outcome || ""), "the hung call was never given up: " + outcome);
    assert.strictEqual(f.frames[0].removed, true, "the frame that hung is still in the page");
    assert.strictEqual(f.handlers.length, 0, "its listener is still on the window");
    assert.ok(/destroyed/.test(other || ""), "the call waiting behind the hung one was left waiting: " + other);
    assert.strictEqual(armed().length, 0, "the frame was destroyed with a deadline timer still armed");
    assert.strictEqual(f.P.frame(), null, "the dead frame is still the engine — the next read would call into it");
    assert.strictEqual(toasts.length, 1, "the player was not told the local voice stopped: " + JSON.stringify(toasts));
    return adapter.stored().then(function () { throw new Error("a destroyed frame answered"); }, function (e) { assert.ok(/destroyed/.test(e.message), "a later call waits on the dead frame: " + e.message); });
  });
});
kase("V11: when the voice server fails mid-read, the rest keeps its cast voices — as a cloud failure does", function () {
  var f = ttsFixture(), S = f.TTS._speakerTest, units = [{ text: "One." }, { text: "Two." }, { text: "Three." }];
  assert.strictEqual(JSON.stringify(S.unitVoicesFrom(units, 1, { 0: "m#1", 1: "m#3", 2: "n#8" })), JSON.stringify({ 0: "m#3", 1: "n#8" }), "the voices of the unread units are not carried over by their new positions");
  assert.strictEqual(S.unitVoicesFrom(units, 2, { 0: "m#1" }), null, "a remainder with no cast line carries a map");
  assert.strictEqual(S.unitVoicesFrom(units, 0, null), null);
  var srv = S.speakServerSrc(), at = srv.indexOf("if (failReason)"), hand = srv.slice(at, srv.indexOf("handedOff = true", at));
  assert.ok(at >= 0 && /piper: true, voiceId: voiceBaseId\(voiceId\), voices: _unitVoicesFrom\(units, i, voices\)/.test(hand), "the server's mid-read handoff hands the remainder on without its cast voices");
  var item = f.TTS._gemini.fallbackItem(units, [{ last: units[0] }, { last: units[2] }], 1, "m", { 1: "m#3", 2: "n#8" });
  assert.strictEqual(JSON.stringify(item.voices), JSON.stringify({ 0: "m#3", 1: "n#8" }), "the cloud handoff no longer maps the same way");
});
kase("V12: the memory probe keeps ONE record for every unnamed instantiation — never one each", function () {
  function Memory() { this.buffer = { byteLength: 65536 }; }
  function Instance() { this.exports = { memory: new Memory() }; }
  var W = { Memory: Memory, Instance: Instance, instantiate: function () { return Promise.resolve({ instance: new Instance() }); } }, c = { WebAssembly: W, Object: Object, String: String, Function: Function, Promise: Promise };
  vm.createContext(c); vm.runInContext(src("wasm-probe.js"), c, { filename: "wasm-probe.js" });
  var i; for (i = 0; i < 5; i++) new c.WebAssembly.Instance({});
  var P = c.WebAssembly.__tndProbe, kinds = P.list().map(function (x) { return x.kind || x.k || x.name; });
  assert.ok(P.caught() <= 2, "five unnamed instantiations left " + P.caught() + " records, each holding a memory for the realm's life: " + JSON.stringify(kinds));
  assert.strictEqual(P.count("anon"), 5, "the unnamed instantiations are not counted under one kind");
  assert.ok(/return "anon";/.test(src("piper_test.html")) && !/"wasm" \+ \(\+\+anon\)/.test(src("piper_test.html")), "the soak page's copy of the probe still keeps one memory per unnamed instantiation");
});
kase("V12: while the sound is muted the accent layer schedules nothing — it does not play at gain 0", function () {
  var scope = { console: console, Promise: Promise, Uint8Array: Uint8Array, AbortController: AbortController, setTimeout: setTimeout, clearTimeout: clearTimeout, Object: Object, JSON: JSON, Math: Math, Number: Number, String: String, Array: Array, Error: Error, isFinite: isFinite, parseInt: parseInt };
  vm.createContext(scope);
  ["audio-catalog.js", "audio-profile.js", "audio-scenes.js", "ambient.js", "audio-accents.js"].forEach(function (f) { vm.runInContext(src(f), scope, { filename: f }); });
  var cat = JSON.parse(JSON.stringify(scope.AUDIO_CATALOG)); cat.assets.forEach(function (a) { if (a.role === "accent") a.approval.mix = true; });
  var now = 0, timers = [], loads = [], plays = [], stops = [];
  var driver = { now: function () { return now; }, later: function (fn, ms) { var h = { at: now + ms, fn: fn }; timers.push(h); return h; }, cancel: function (h) { h.cancelled = true; }, abort: function () { return new AbortController(); }, idle: function () { return true; }, bedPending: function () { return false; },
    load: function (set) { var j = { set: set }; j.p = new Promise(function (ok) { j.ok = ok; }); loads.push(j); return j.p; }, release: function () {}, rng: function () { return 0; }, error: function (e) { throw e; }, warn: function () {},
    play: function (buffer, set, steps, gain) { var v = { gain: gain, done: false }; plays.push(v); return v; }, stop: function (v, sec) { stops.push(sec); v.done = true; } };
  function advance(ms) { var end = now + ms, due; for (;;) { due = timers.filter(function (h) { return !h.cancelled && !h.fired && h.at <= end; }).sort(function (a, b) { return a.at - b.at; })[0]; if (!due) break; now = due.at; due.fired = true; due.fn(); } now = end; }
  var c = scope.createAccentController(driver, cat, scope.AUDIO_SCENES);
  var tavern = { enabled: true, unlocked: true, visible: true, volume: 0.8, campaignKind: "village", campaignId: "one", generation: 1, nodeKey: "The Village|the tavern", common: "the tavern", open: true, minuteOfDay: 1200 };
  var muted = Object.assign({}, tavern, { volume: 0 });       // what ui-ambient.js hands over while the master mute is on: slider × 0
  c.update(tavern);
  return settle(3).then(function () {
    assert.strictEqual(loads.length, 1, "fixture: the accent set never loaded");
    loads[0].ok({ id: "sprite" }); return settle(3);
  }).then(function () {
    assert.ok(c.inspect().scheduled, "fixture: nothing is scheduled with the sound on");
    c.update(muted);
    assert.ok(!c.inspect().scheduled, "muted, the accent layer keeps its schedule");
    advance(15 * 60000);
    assert.strictEqual(plays.length, 0, "muted, the layer played " + plays.length + " accent(s) at gain " + JSON.stringify(plays.map(function (p) { return p.gain; })));
    c.update(tavern); advance(10 * 60000);
    assert.ok(plays.length >= 1 && plays[0].gain > 0, "accents do not come back when the sound does");
  });
});
function carLoopFixture(menu) {
  var f = carFixture(), host = {}, log = f.calls;
  f.c.CAR_HOST_ROWS.forEach(function (r) { host[r.name] = function () { return null; }; });
  var tts = { earcon: function (k) { log.push("earcon:" + k); }, speak: function (t) { log.push("speak:" + t); }, isOn: function () { return true; }, isPlaying: function () { return false; }, isPaused: function () { return false; }, replayLast: function () { log.push("replay"); return true; }, stop: function () {}, getLastText: function () { return "the last line"; } };
  host.voice = function () { return tts; }; host.busy = function () { return false; }; host.parked = function () { return ""; };
  host.options = function () { return menu; }; host.commands = function () { return f.c.CAR_COMMANDS_BASE; }; host.onCommand = function () { return false; };
  host.clearParked = function () { log.push("clearParked"); }; host.hear = function (t) { log.push("hear:" + t); return false; }; host.paint = function () { log.push("paint"); };
  host.act = function (t) { log.push("act:" + t); }; host.optionsSpeech = function (a) { return a.join(", "); };
  f.c.carSessionHost(host); f.c.carMode = true; f.host = host;
  return f;
}
kase("V12: in a conversation with no menu, \"repeat\" replays the last line — it is not answered with a menu warning", function () {
  var f = carLoopFixture(null);
  assert.strictEqual(f.c.carVoiceCommand("say that again"), true, "the command was not taken");
  assert.ok(f.calls.indexOf("replay") >= 0 || f.calls.some(function (x) { return x === "speak:the last line"; }), "the last line was not replayed: " + JSON.stringify(f.calls));
  assert.ok(!/No options/.test(f.els["car-status"].textContent), "a host with no menu answered \"repeat\" with: " + f.els["car-status"].textContent);
  var g = carLoopFixture([]);
  g.c.carVoiceCommand("repeat");
  assert.ok(/No options/.test(g.els["car-status"].textContent), "with a menu that is not ready, \"repeat\" no longer says so");
});
kase("V12: a number that names no option is the player's words — never swallowed with a warning", function () {
  var f = carLoopFixture([]);
  assert.strictEqual(f.c.carVoiceCommand("Two"), false, "a number spoken with no options was taken as a command and lost");
  assert.ok(f.calls.indexOf("clearParked") < 0, "the field was cleared before the words could be sent: " + JSON.stringify(f.calls));
  assert.ok(f.calls.indexOf("hear:Two") >= 0, "the host was not handed the words");
  assert.ok(!(f.els["car-status"] && /No options/.test(f.els["car-status"].textContent)), "a warning was shown for the player's own words");
  var g = carLoopFixture(["Open the door", "Wait"]);
  assert.strictEqual(g.c.carVoiceCommand("two"), true, "a number that names an option is no longer a pick");
  assert.ok(g.calls.indexOf("act:Wait") >= 0, "the pick did not act: " + JSON.stringify(g.calls));
});
kase("V13: a state change repaints the host that is installed, and a talk does not open while a turn is in flight", function () {
  var f = carLoopFixture(null);
  f.calls.length = 0; f.c.carPaint();
  assert.deepStrictEqual(f.calls, ["paint"], "the installed host was not asked to paint");
  f.c.carMode = false; f.calls.length = 0; f.c.carPaint();
  assert.deepStrictEqual(f.calls, [], "the overlay is painted while it is closed");
  var panels = src("ui-panels.js"), at = panels.indexOf("function syncUI()"), body = panels.slice(at, panels.indexOf("\nfunction ", at + 10));
  assert.ok(/carPaint\(\)/.test(body) && !/_carUpdate\(\)/.test(body), "syncUI paints the hero's overlay fields whatever host is installed — over an open talk");
  var toasts = [], t = carFixture();
  t.c.showToast = function (m) { toasts.push(m); }; t.c.worldState = { character: { name: "Hero" } }; t.c.busy = true;
  t.c.closeAllMenus = function () {}; t.c.CAR_HOST = {};
  vm.runInContext(src("companion-talk.js"), t.c, { filename: "companion-talk.js" });
  t.c.talkPartner = function () { throw new Error("a talk was being opened while a turn is in flight"); };
  t.c.carMode = false; t.c.showTalk("Mira");
  assert.ok(toasts.some(function (m) { return /turn/i.test(m); }), "nothing told the player why the talk did not open: " + JSON.stringify(toasts));
  assert.strictEqual(t.c.carMode, false);
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
