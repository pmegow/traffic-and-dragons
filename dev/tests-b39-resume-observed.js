// tests-b39-resume-observed.js — B39 (DOC/BUGS.md): every AudioContext.resume() in the app is OBSERVED. The B10 fix
// observed only tts.js's context; sound.js's earcon context (a second context, reached from every toast, gesture or
// not) kept a bare try/catch around the async promise, so WebKit's "Failed to start the audio device" rejection
// surfaced as an unhandledrejection again. Drives the real helper and the real Sound module against a fake context.
//   • resumeObserved: a rejected resume() is handled (no unhandledrejection), warned with the tag, crumbed, and the
//     owner's onRefused runs; the SAME promise is returned; a resolving resume runs no refusal; a throwing resume()
//     and a null ctx return null without throwing
//   • Sound.play on a refused context: the context is marked doomed, `tnd:audio-refused` fires, Sound.state() says
//     so, and the NEXT context request closes the doomed one and mints a fresh one (once)
//   node dev/tests-b39-resume-observed.js
var engine = require("./load-engine.js");
engine.loadEngine();

var unhandled = 0; process.on("unhandledRejection", function () { unhandled++; });
var warns = [], crumbs = [];
var _warn = console.warn; console.warn = function (m) { warns.push(String(m)); };
erCrumb = function (evt, data) { crumbs.push(evt + " " + data); };
function refusingCtx() { return { state: "suspended", resume: function () { return Promise.reject(new Error("Failed to start the audio device")); }, close: function () { this.closed = true; return Promise.resolve(); } }; }
function tick() { return new Promise(function (r) { setTimeout(r, 10); }); }

var pass = 0, fails = [], chain = Promise.resolve();
function tAsync(name, fn) { chain = chain.then(function () { return Promise.resolve().then(fn).then(function (r) { if (r === true || r === undefined) { pass++; console.log("PASS " + name); } else fails.push(name + " — " + r); }, function (e) { fails.push(name + " — threw: " + (e && e.stack || e)); }); }); }

tAsync("resumeObserved handles a refused resume: no unhandled rejection, a tagged warn, a ctx-refused crumb, onRefused with the reason, and the SAME promise returned", async function () {
  warns.length = 0; crumbs.length = 0; var got = null, ctx = refusingCtx();
  var pr = resumeObserved(ctx, "sound:click", function (e, why) { got = why; });
  if (!pr || typeof pr.then !== "function") return "the promise must be returned";
  var same = false; pr.then(null, function () { same = true; });
  await tick();
  if (unhandled) return "the rejection escaped as unhandled";
  if (!same) return "the returned promise is not the resume() promise";
  if (!got || got.indexOf("Failed to start the audio device") < 0) return "onRefused did not get the reason: " + got;
  if (!warns.some(function (w) { return /REFUSED \(sound:click, state suspended\)/.test(w); })) return "no tagged warn: " + JSON.stringify(warns);
  if (!crumbs.some(function (c) { return /^ctx-refused sound:click suspended/.test(c); })) return "no ctx-refused crumb: " + JSON.stringify(crumbs);
  return true;
});
tAsync("resumeObserved on a resolving resume runs no refusal; a throwing resume() and a null ctx return null without throwing", async function () {
  var called = false, ok = { state: "suspended", resume: function () { return Promise.resolve(); } };
  var pr = resumeObserved(ok, "x", function () { called = true; }); await tick();
  if (!pr || called) return "a resolving resume must not refuse";
  if (resumeObserved({ state: "suspended", resume: function () { throw new Error("sync"); } }, "y") !== null) return "a throwing resume() must return null";
  if (resumeObserved(null, "z") !== null || resumeObserved({}, "z") !== null) return "no ctx / no resume must return null";
  return true;
});
tAsync("Sound.play on a refused context: doomed, tnd:audio-refused dispatched, state() says so; the next context request closes the doomed one and mints a fresh one, once", async function () {
  var made = [], events = [];
  global.window = { dispatchEvent: function (e) { events.push(e); return true; } };
  global.CustomEvent = function (type, init) { this.type = type; this.detail = init && init.detail; };
  global.AudioContext = function () { var c = refusingCtx(); made.push(c); return c; };
  var ids = Object.keys(Sound.SOUND_LIB); if (!ids.length) return "no sounds in the library";
  if (Sound.state() !== "none") return "state() must not create a context: " + Sound.state();
  var r = Sound.play(ids[0], true);
  if (r !== false) return "a suspended context must skip the play";
  if (made.length !== 1) return "one context expected, got " + made.length;
  await tick();
  if (unhandled) return "the earcon resume escaped as unhandled";
  if (!/doomed/.test(Sound.state())) return "the refused context is not marked doomed: " + Sound.state();
  if (!events.some(function (e) { return e.type === "tnd:audio-refused" && e.detail && e.detail.context === "sound"; })) return "tnd:audio-refused was not dispatched: " + JSON.stringify(events);
  var c2 = Sound.context();
  if (made.length !== 2 || c2 !== made[1]) return "the doomed context was not replaced (" + made.length + " made)";
  if (!made[0].closed) return "the doomed context was not closed (monotonic-resources rule)";
  if (!/rebuilt/.test(Sound.state()) || /doomed/.test(Sound.state())) return "state after rebuild: " + Sound.state();
  if (Sound.context() !== c2 || made.length !== 2) return "a healthy context must not be rebuilt again";
  return true;
});

chain.then(function () {
  console.warn = _warn;
  console.log("B39 RESUME OBSERVED: " + fails.length + " failed, " + pass + " passed");
  fails.forEach(function (f) { console.error("FAIL " + f); });
  process.exit(fails.length ? 1 : 0);
});
