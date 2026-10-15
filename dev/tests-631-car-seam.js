// dev/tests-631-car-seam.js — #631: the Car Mode SEAM. Three files are portable — car-commands.js (the spoken grammar),
// car-session.js (the loop: turn-taking, transport, the overlay's controls) and audio-session.js (the #19 microphone↔narration
// handoff) — and the promise is that each names only what it declares and what the platform provides. The game reaches them
// through ONE adapter, CAR_HOST (ui-carmode.js), whose rows car-session.js declares in CAR_HOST_ROWS. Derived, never a list:
//   • dev/seam-scan.js reads every identifier a portable file uses and subtracts its own declarations and the platform;
//   • CAR_HOST_ROWS (the loop's requirement) must equal the keys of the game's CAR_HOST literal, and every `_carHost.x`
//     the loop reads must be a declared row — a row nobody reads is dead, a read nobody declares is a hidden requirement;
//   • the vocabulary is a TABLE handed to parseCarCommand: the base table hears only the generic car words, the game's
//     CAR_COMMANDS hears its own kinds in the recorded order, a custom table hears custom kinds, a missing table is loud;
//   • AudioSession stands alone: the handoff and its crumbs work with nothing but a fake navigator.
// Proven by dev/sabotage-631-car-seam.js.
//   node dev/tests-631-car-seam.js
var assert = require("assert/strict"), fs = require("fs"), path = require("path"), vm = require("vm");
var seam = require("./seam-scan.js");
var ROOT = path.join(__dirname, "..");
function src(f) { return fs.readFileSync(path.join(ROOT, f), "utf8"); }
var passed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log("PASS #631 " + name); }
  catch (e) { process.exitCode = 1; console.error("FAIL #631 " + name + " — " + e.stack); }
}

/* The platform a portable file may name: the DOM, timers, the ECMAScript builtins and the two Web APIs the loop drives.
   A GAME name (worldState, busy, TTS, STT, store, erCrumb, showToast, sendAction, helpers…) is never on this list. */
var PLATFORM = ("document navigator window console setTimeout clearTimeout setInterval clearInterval Date Math String Number Boolean " +
  "Object Array JSON RegExp Promise Error TypeError CustomEvent MediaMetadata AudioContext Float32Array isFinite isNaN parseInt " +
  "parseFloat encodeURIComponent decodeURIComponent arguments").split(" ");
var PORTABLE = ["car-commands.js", "car-session.js", "audio-session.js"];
/* A portable file may also name what an EARLIER portable file declares (the loop reads the grammar). Derived from the source. */
var SIBLINGS = { "car-commands.js": [], "car-session.js": ["car-commands.js"], "audio-session.js": [] };
var loose = require("assert");   /* vm objects have another realm's prototypes — compare by structure */

test("the scanner tells a use from a declaration, a property, an object key, a string, a regex and a comment", function () {
  var fx = "var a = 1, b = a + c; function f(d, e) { var g; return d.h + e[i] + worldState.x + { key: 1, k2: j }.key + \"str s\" + " +
    "/re x/.test(l) + typeof m + (n ? o : p); } // comment zz\n/* yy */ try {} catch (q) { q; } for (var k in r) {}";
  var out = seam.outsideNames(fx, ["worldState"]).map(function (u) { return u.name; });
  assert.deepEqual(out, ["c", "i", "j", "l", "m", "n", "o", "p", "r"], "outside names: " + JSON.stringify(out));
  var leak = seam.outsideNames(fx, []).map(function (u) { return u.name; });
  assert(leak.indexOf("worldState") >= 0, "an unlisted game name is a leak");
  assert.equal(seam.outsideNames("var x = a.b.c; x.d(); function go(y) { return y + 1; } go(2);", []).length, 1, "a.b.c leaks only a");
});

PORTABLE.forEach(function (f) {
  test(f + " names nothing outside itself and the platform", function () {
    var allowed = PLATFORM.slice();
    SIBLINGS[f].forEach(function (sib) { allowed = allowed.concat(Object.keys(seam.scan(src(sib)).declared)); });
    var out = seam.outsideNames(src(f), allowed);
    assert.deepEqual(out, [], f + " reaches outside the seam: " + out.map(function (u) { return u.name + " (line " + u.line + ")"; }).join(", "));
  });
});

function hostRows() {
  var s = src("car-session.js"), a = s.indexOf("var CAR_HOST_ROWS = ["), b = s.indexOf("\n];", a);
  assert(a >= 0 && b > a, "car-session.js declares CAR_HOST_ROWS as a multi-line literal");
  var rows = [], re = /\{ name: "([A-Za-z_$][\w$]*)"/g, m;
  while ((m = re.exec(s.slice(a, b)))) rows.push(m[1]);
  return rows;
}
function hostKeys() {
  var s = src("ui-carmode.js"), a = s.indexOf("var CAR_HOST = {"), b = s.indexOf("\n};", a);
  assert(a >= 0 && b > a, "ui-carmode.js declares CAR_HOST as a multi-line literal");
  var keys = [], re = /^  ([A-Za-z_$][\w$]*): /gm, m, body = s.slice(a, b);
  while ((m = re.exec(body))) keys.push(m[1]);
  return keys;
}
test("CAR_HOST_ROWS (the loop's requirement) and the game's CAR_HOST literal name the same rows", function () {
  var rows = hostRows().sort(), keys = hostKeys().sort();
  assert(rows.length >= 15, "the registry has fewer rows than the loop needs: " + rows.length);
  assert.deepEqual(keys, rows, "rows vs keys");
});
test("every _carHost.x the loop reads is a declared row, and every declared row is read", function () {
  var rows = hostRows(), s = src("car-session.js"), re = /_carHost\.([A-Za-z_$][\w$]*)/g, m, reads = {};
  while ((m = re.exec(s))) reads[m[1]] = true;
  var undeclared = Object.keys(reads).filter(function (r) { return rows.indexOf(r) < 0; });
  var unread = rows.filter(function (r) { return !reads[r]; });
  assert.deepEqual(undeclared, [], "the loop reads host rows it never declared: " + undeclared.join(", "));
  assert.deepEqual(unread, [], "declared rows nobody reads: " + unread.join(", "));
});
test("the host validator refuses a host missing a row, loudly and by name, and accepts a complete one", function () {
  var c = { document: { addEventListener: function () {} }, console: console };
  vm.createContext(c);
  vm.runInContext(src("car-session.js"), c, { filename: "car-session.js" });
  assert.throws(function () { c.carSessionHost({}); }, /car-session: the host lacks .*voice/, "an empty host must be refused by row name");
  var host = {}; hostRows().forEach(function (r) { host[r] = function () {}; });
  delete host.retry;
  assert.throws(function () { c.carSessionHost(host); }, /lacks retry\b/, "a host missing one row names that row");
  host.retry = function () {};
  c.carSessionHost(host);
  assert.throws(function () { c.carSessionHost(null); }, /car-session/, "a null host is refused");
});

test("the load order keeps each portable file ahead of its first consumer, and the app shell carries all three", function () {
  var idx = src("index.html"), sw = src("sw.js");
  function at(f) { var i = idx.indexOf("<script src=\"" + f + "\">"); assert(i >= 0, f + " is not loaded by index.html"); return i; }
  assert(at("car-commands.js") < at("helpers.js"), "car-commands.js must load before helpers.js (the engine manifest's place for it: the grammar precedes everything that speaks)");
  assert(at("car-commands.js") < at("game.js"), "car-commands.js must load before game.js (CAR_COMMANDS composes its entries)");
  assert(at("audio-session.js") < at("tts.js"), "audio-session.js must load before tts.js");
  assert(at("car-session.js") < at("ui-carmode.js"), "car-session.js must load before ui-carmode.js (the host installs at load)");
  var shell = sw.slice(sw.indexOf("var APP_SHELL = ["), sw.indexOf("];", sw.indexOf("var APP_SHELL = [")));
  PORTABLE.forEach(function (f) { assert(shell.indexOf("\"/" + f + "\"") >= 0, f + " is missing from sw.js APP_SHELL"); });
});

/* ── the vocabulary table ── */
function grammar() {
  var c = {}; vm.createContext(c);
  vm.runInContext(src("car-commands.js"), c, { filename: "car-commands.js" });
  var hp = src("game.js"), a = hp.indexOf("var CAR_COMMANDS = ["), b = hp.indexOf("\n];", a);
  assert(a >= 0 && b > a, "game.js declares CAR_COMMANDS as a multi-line literal");
  vm.runInContext(hp.slice(a, b + 3), c, { filename: "game.js#CAR_COMMANDS" });
  return c;
}
test("the base table hears the generic car words and NOT the game's kinds; the game's table hears both", function () {
  var c = grammar();
  assert.equal(c.parseCarCommand("let's wrap up", 3, c.CAR_COMMANDS_BASE), null, "a host without wrapUp must hear nothing");
  assert.equal(c.parseCarCommand("roll the dice", 3, c.CAR_COMMANDS_BASE), null);
  loose.deepEqual(c.parseCarCommand("gm pause", 3, c.CAR_COMMANDS_BASE), { kind: "pause" });
  loose.deepEqual(c.parseCarCommand("repeat everything", 3, c.CAR_COMMANDS_BASE), { kind: "repeatAll" });
  loose.deepEqual(c.parseCarCommand("the second one", 3, c.CAR_COMMANDS_BASE), { kind: "pick", n: 2 });
  loose.deepEqual(c.parseCarCommand("let's wrap up", 3, c.CAR_COMMANDS), { kind: "wrapUp" });
  loose.deepEqual(c.parseCarCommand("roll the dice", 3, c.CAR_COMMANDS), { kind: "roll" });
  loose.deepEqual(c.parseCarCommand("never mind", 3, c.CAR_COMMANDS), { kind: "undoItem" });
  loose.deepEqual(c.parseCarCommand("what happened last time", 3, c.CAR_COMMANDS), { kind: "recap" });
});
test("the game's table is the base entries interleaved with its own kinds in the recorded order (first match wins)", function () {
  var c = grammar(), kinds = c.CAR_COMMANDS.map(function (e) { return e.kind; });
  loose.deepEqual(kinds, ["repeatAll", "roll", "undoItem", "pause", "resume", "wrapUp", "recap", "repeat"]);
  loose.deepEqual(c.CAR_COMMANDS_BASE.map(function (e) { return e.kind; }), ["repeatAll", "pause", "resume", "repeat"]);
  c.CAR_COMMANDS_BASE.forEach(function (e) { assert(c.CAR_COMMANDS.indexOf(e) >= 0, "the game's table must reuse the base ENTRY " + e.kind + ", not a copy"); });
  c.CAR_COMMANDS.forEach(function (e) {
    assert(typeof e.kind === "string" && e.say && e.say.length, "every entry is {kind, say:[regex…]}: " + JSON.stringify(e));
    e.say.forEach(function (re) { assert(/^\^/.test(re.source) && /\$$/.test(re.source), e.kind + " must anchor the whole utterance: " + re); });
  });
});
test("a custom table hears custom kinds, and a missing table is refused loudly", function () {
  var c = grammar(), honk = [{ kind: "honk", say: [/^honk$/] }];
  loose.deepEqual(c.parseCarCommand("uh, honk!", 3, honk), { kind: "honk" });
  assert.equal(c.parseCarCommand("pause", 3, honk), null, "a custom table hears only its own words");
  loose.deepEqual(c.parseCarCommand("two", 3, honk), { kind: "pick", n: 2 }, "the pick grammar rides every table");
  assert.throws(function () { c.parseCarCommand("pause", 3); }, /command table is required/);
  assert.throws(function () { c.parseCarCommand("pause", 3, null); }, /command table is required/);
});

/* ── AudioSession stands alone ── */
test("AudioSession: the handoff holds the session at auto while the microphone is live and restores playback after; crumbs and the notify hook fire", function () {
  var calls = [], type = "auto", crumbs = [], notes = [], warns = [];
  var session = {}; Object.defineProperty(session, "type", { configurable: true, get: function () { return type; }, set: function (v) { calls.push(v); type = v; } });
  var c = { navigator: { audioSession: session }, console: { warn: function (m) { warns.push(String(m)); }, debug: function () {}, info: function () {} }, Math: Math, Date: Date, String: String, isFinite: isFinite };
  vm.createContext(c);
  vm.runInContext(src("audio-session.js"), c, { filename: "audio-session.js" });
  var A = c.AudioSession;
  A.hooks({ crumb: function (e, d) { crumbs.push(e + " " + d); }, notify: function (m) { notes.push(m); } });
  A.requestPlayback();
  assert.equal(type, "playback");
  A.setCapture(true);
  assert.equal(type, "auto", "capture releases playback");
  A.requestPlayback();
  assert.equal(type, "auto", "a playback request while the mic is live must wait");
  A.setCapture(false);
  assert.equal(type, "playback", "the handoff restores playback once the mic ended");
  assert(A.captureEndedAt() > 0);
  assert.deepEqual(crumbs, ["audio-session auto>playback", "audio-session playback>auto", "audio-session auto>playback"]);
  A.requestPlayback();
  assert.equal(crumbs.length, 3, "a same-value set never crumbs");
  A.releasePlayback();
  assert.equal(type, "auto");
  /* a refused session is loud: the console and the notify hook, never a throw */
  Object.defineProperty(session, "type", { get: function () { return type; }, set: function () { throw new Error("session refused"); } });
  A.requestPlayback();
  assert(warns.some(function (w) { return /session refused/.test(w); }), "console.warn names the refusal");
  assert(notes.some(function (n) { return /session refused/.test(n); }), "the notify hook names the refusal");
  /* no navigator.audioSession: silent no-op, no crumb */
  var d = { navigator: {}, console: console, Math: Math, Date: Date, String: String, isFinite: isFinite };
  vm.createContext(d); vm.runInContext(src("audio-session.js"), d, { filename: "audio-session.js" });
  d.AudioSession.requestPlayback(); d.AudioSession.setCapture(true); d.AudioSession.setCapture(false);
  assert.equal(d.AudioSession.typeNow(), "-");
});
test("AudioSession: the primer is dither on the context it was given, one source per context, torn down on stop", function () {
  var sources = 0, buffers = [], disconnects = 0;
  function ctx() { return { sampleRate: 22050, destination: {},
    createBuffer: function (ch, len) { var data = new Float32Array(len); buffers.push(data); return { getChannelData: function () { return data; } }; },
    createBufferSource: function () { sources++; var me = this; return { context: me, connect: function () {}, start: function () {}, stop: function () {}, disconnect: function () { disconnects++; } }; },
    createGain: function () { return { gain: {}, connect: function () {}, disconnect: function () { disconnects++; } }; } }; }
  var c = { navigator: {}, console: console, Math: Math, Date: Date, String: String, isFinite: isFinite, Float32Array: Float32Array };
  vm.createContext(c); vm.runInContext(src("audio-session.js"), c, { filename: "audio-session.js" });
  var A = c.AudioSession, x = ctx(), y = ctx();
  A.prime(x); A.prime(x);
  assert.equal(sources, 1, "re-priming the same context reuses its source");
  var nz = 0, i; for (i = 0; i < buffers[0].length; i++) if (buffers[0][i] !== 0) nz++;
  assert(nz > buffers[0].length / 2, "the primer must be dither, never digital silence");
  A.prime(y);
  assert.equal(sources, 2, "a new context gets its own primer");
  assert.equal(disconnects, 2, "the old primer's source and gain were disconnected");
  A.stopPrimer(); A.stopPrimer();
  assert.equal(disconnects, 4, "stop tears down both nodes once");
  A.prime(null);
  assert.equal(sources, 2, "no context, no primer");
});

console.log((process.exitCode ? "FAILED" : "ALL GREEN") + " — " + passed + " car seam groups (#631)");
