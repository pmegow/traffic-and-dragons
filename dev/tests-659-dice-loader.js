// tests-659-dice-loader.js — #659: the dice sprite LOADER (owner 2026-10-24: "the dice review page has no audio").
// v1.1314's DiceSound.preload() decoded on Sound.context(), which CREATED the live AudioContext at page load, before any
// gesture — the autoplay policy hands such a context back suspended, Sound.play refuses a context that is not running,
// and the review page (which never loads helpers.js's resumeObserved) was silent on every click. The loader now decodes
// on a throwaway OfflineAudioContext; the buffer is context-free; the live context is born in the first play, inside a
// gesture, as it always was. Drives the real dice-sound.js against fake fetch / OfflineAudioContext / reportError:
//   • without a decoder the preload resolves false and says why; the live context is never touched
//   • the receipt's file is fetched under the base and decoded ONCE; the buffer is adopted; a second call in flight
//     shares the first's promise; a loaded sprite is not fetched again; a clean load says nothing; Sound.context is
//     never called
//   • a failed fetch, an undecodable body and a decode the cut list does not fit each resolve false, are said once on
//     the console and reported once through reportError — never thrown, never a wrong sound
//   node dev/tests-659-dice-loader.js
var engine = require("./load-engine.js");
engine.loadEngine();

var warns = [], reports = [], fetched = [], decoded = 0, ctxCalls = 0, unhandled = 0;
process.on("unhandledRejection", function () { unhandled++; });
var _warn = console.warn; console.warn = function (m) { warns.push(String(m)); };
reportError = function (ctx, msg) { reports.push(ctx + ": " + msg); };
var _ctx = Sound.context; Sound.context = function () { ctxCalls++; return _ctx(); };
function receipt() { return { file: "dice/sfx/dice-rolls-v1.mp3", seconds: 3, gap: 0.25, dice: { d6: { takes: [{ cut: [0, 0.8], landing: 0.1, length: 0.4 }, { cut: [1, 2.2], landing: 0.2, length: 0.9 }] } } }; }
function fakes(opts) {
  opts = opts || {};
  global.OfflineAudioContext = function (ch, len, sr) {
    this.sampleRate = sr;
    this.decodeAudioData = function (bytes, res, rej) { decoded++; if (opts.undecodable) rej(new Error("undecodable")); else res({ duration: opts.duration || 3, sampleRate: sr }); };
  };
  global.fetch = function (url) { fetched.push(url); var ok = !/missing/.test(url); return Promise.resolve({ ok: ok, status: ok ? 200 : 404, arrayBuffer: function () { return Promise.resolve({ bytes: 1 }); } }); };
}
function reset() { warns.length = 0; reports.length = 0; fetched.length = 0; decoded = 0; ctxCalls = 0; DiceSound.adopt(null); DICE_SFX = receipt(); }
function tick() { return new Promise(function (r) { setTimeout(r, 5); }); }

var pass = 0, fails = [], chain = Promise.resolve();
function tAsync(name, fn) { chain = chain.then(function () { return Promise.resolve().then(fn).then(function (r) { if (r === true || r === undefined) { pass++; console.log("PASS " + name); } else fails.push(name + " — " + r); }, function (e) { fails.push(name + " — threw: " + (e && e.message || e)); }); }); }

tAsync("without a decoder the preload resolves false, says why once, and never touches the live context", async function () {
  reset(); delete global.OfflineAudioContext;
  var ok = await DiceSound.preload();
  if (ctxCalls) return "preload must NEVER create or touch the live AudioContext (born suspended before a gesture, it silenced every click): Sound.context called " + ctxCalls + " time(s)";
  if (ok !== false || !/no audio decoder/.test(DiceSound.state())) return "resolves false with the reason: " + ok + " " + DiceSound.state();
  if (warns.length !== 1 || !/OfflineAudioContext/.test(warns[0])) return "said once: " + JSON.stringify(warns);
  await DiceSound.preload(); if (warns.length !== 1) return "said once, not every call";
  return ctxCalls === 0 ? true : "the live AudioContext was touched " + ctxCalls + " time(s)";
});
tAsync("the receipt's file is fetched under the base and decoded once on the offline context; the buffer is adopted; the in-flight promise is shared; a loaded sprite is not fetched again; a clean load says nothing; Sound.context is never called", async function () {
  reset(); fakes();
  var p1 = DiceSound.preload({ base: "../" }), p2 = DiceSound.preload({ base: "../" });
  if (p1 !== p2) return "a second preload in flight must share the first's promise";
  var ok = await p1;
  if (ctxCalls !== 0) return "preload must NEVER create or touch the live AudioContext (born suspended before a gesture, it silenced every click): Sound.context called " + ctxCalls + " time(s)";
  if (ok !== true || DiceSound.state() !== "loaded" || decoded !== 1) return "decoded once and adopted: " + ok + " " + DiceSound.state() + " decoded " + decoded;
  if (fetched.length !== 1 || fetched[0] !== "../dice/sfx/dice-rolls-v1.mp3") return "the receipt's file under the base, once: " + JSON.stringify(fetched);
  if (warns.length || reports.length) return "a clean load says nothing: " + JSON.stringify(warns) + " " + JSON.stringify(reports);
  var again = await DiceSound.preload();
  if (again !== true || decoded !== 1 || fetched.length !== 1) return "a loaded sprite is not fetched or decoded again";
  var got = []; var _sp = Sound.play; Sound.play = function (r, f) { got.push(r); return true; };
  try { DICE_MANIFEST = { dice: { d6: { frames: 84, fps: 24, clips: { "03": { hits: [[0.458, 5.79]], roll: [] } } } } }; var played = DiceSound.play(6, 3, 0); } finally { Sound.play = _sp; DICE_MANIFEST = undefined; }
  if (played !== true || got.length !== 1 || got[0].notes[0].type !== "sample" || got[0].notes[0].buffer.duration !== 3) return "a roll after the load plays the adopted buffer: " + JSON.stringify(got);
  return ctxCalls === 0 ? true : "the play path itself must not create the context here either (Sound.play does, inside the gesture)";
});
tAsync("a failed fetch resolves false, is said once and reported once; a second preload says nothing more", async function () {
  reset(); fakes(); DICE_SFX.file = "dice/sfx/missing-v9.mp3";
  var ok = await DiceSound.preload();
  if (ok !== false || !/HTTP 404/.test(DiceSound.state())) return "resolves false with the status: " + ok + " " + DiceSound.state();
  if (warns.length !== 1 || !/could not load .*missing-v9/.test(warns[0]) || reports.length !== 1 || !/^dice-sfx: could not load/.test(reports[0])) return "said once and reported once: " + JSON.stringify(warns) + " " + JSON.stringify(reports);
  await DiceSound.preload(); await tick();
  if (warns.length !== 1 || reports.length !== 1) return "said once, not every call: " + JSON.stringify(warns);
  return unhandled === 0 ? true : "an unhandled rejection escaped";
});
tAsync("an undecodable body resolves false, said once and reported once", async function () {
  reset(); fakes({ undecodable: true });
  var ok = await DiceSound.preload();
  if (ok !== false || !/undecodable/.test(DiceSound.state())) return "resolves false with the decoder's reason: " + ok + " " + DiceSound.state();
  if (warns.length !== 1 || reports.length !== 1) return "said once and reported once: " + JSON.stringify(warns) + " " + JSON.stringify(reports);
  return unhandled === 0 ? true : "an unhandled rejection escaped";
});
tAsync("a decode the cut list does not fit is refused, said once and reported once — never adopted", async function () {
  reset(); fakes({ duration: 2 });
  var ok = await DiceSound.preload();
  if (ok !== false || DiceSound.state() === "loaded" || !/d6 take 2/.test(DiceSound.state())) return "refused naming the take: " + ok + " " + DiceSound.state();
  if (warns.length !== 1 || reports.length !== 1 || !/d6 take 2/.test(reports[0])) return "said once and reported once: " + JSON.stringify(warns) + " " + JSON.stringify(reports);
  return true;
});

chain.then(function () {
  console.warn = _warn; Sound.context = _ctx;
  if (fails.length) { console.error("DICE LOADER FAILED (" + fails.length + "):"); fails.forEach(function (f) { console.error("  ✗ " + f); }); process.exit(1); }
  console.log("DICE LOADER OK — " + pass + " passed (the sprite decodes off the live context; every failure said once and reported)");
});
