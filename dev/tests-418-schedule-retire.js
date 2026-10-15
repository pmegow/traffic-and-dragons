// tests-418-schedule-retire.js — #418 (audit F9): ONE schedule-and-retire for every decoded buffer.
// The server, cloud and Piper read loops used to carry the same createBufferSource / onended /
// `buffer = null` / _sources-splice block, so the retention-critical code had three landing sites
// and the tests compensated by asserting on function text. Now `_scheduleDecoded` is the one
// implementation; this battery drives it as BEHAVIOUR and pins that every lane uses it.
//
// Standalone battery (run-standalone-suites.js child process). Run directly:
//   node dev/tests-418-schedule-retire.js
//
// What is pinned:
//   ① the helper: schedules at max(nextStart, now + 30 ms) — never in the past — on the context's
//     destination, counts the source on the current context (B9 H1), tracks it in _sources, returns
//     start + duration + gap; on end it disconnects, DETACHES the buffer (Safari #718), drops the
//     source from _sources and calls the lane's onEnded exactly once;
//   ② the cloud lane end to end (a Speechify audition through a scripted fetch and a stub
//     AudioContext): every scheduled source retires through the helper — buffers null, _sources
//     empty, playback reported idle once the last one ends;
//   ③ the three lanes contain NO inline createBufferSource — the helper and the audio-session
//     primer are the only two sites in tts.js — and each lane calls the helper with its own gap.

var engine = require("./load-engine.js");
engine.loadEngine();
var assert = require("assert/strict");
var fs = require("fs"), path = require("path");

var realFetch = global.fetch, realTimer = global.setTimeout;
var sleep = function(ms) { return new Promise(function(r) { realTimer(r, ms); }); };
var sources = [];
global.document = { getElementById: function() { return null; }, addEventListener: function() {}, removeEventListener: function() {} };
global.window = { AudioContext: function() {
  this.state = "running"; this.currentTime = 0; this.sampleRate = 24000; this.destination = { id: "dest" };
  this.createGain = function() { return { gain: {}, connect: function() {} }; };
  this.createBuffer = function(c, n, r) { return { duration: n / r, getChannelData: function() { return new Float32Array(n); } }; };
  var ctx = this;
  this.createBufferSource = function() {
    var src = { context: ctx, buffer: null, loop: false, connected: null, disconnects: 0, startedAt: null,
      connect: function(to) { src.connected = to; }, disconnect: function() { src.disconnects++; }, start: function(at) { src.startedAt = at; if (!src.loop) sources.push(src); }, stop: function() {} };
    return src;
  };
} };
global.showToast = function() {};
var S = TTS._speakerTest, SET = TTS.settings;

var passed = 0, failed = 0;
async function test(name, fn) {
  try { TTS.stop(); sources.length = 0; await fn(); passed++; console.log("PASS #418 " + name); }
  catch (e) { failed++; console.error("FAIL #418 " + name + " — " + (e && e.message)); }
}

(async function() {
  await test("the helper schedules at max(nextStart, now + 30 ms) on the destination, counts the source, tracks it, returns start + duration + gap, and on end disconnects, detaches the buffer, drops it from _sources and calls onEnded once", async function() {
    var ctx = new global.window.AudioContext(); ctx.currentTime = 1.0;
    var buf = { duration: 2 }, ended = 0, before = S.ctxSynths();
    var next = S.scheduleDecoded(ctx, buf, 0.5, 0.2, function() { ended++; });
    var src = sources[0];
    assert.ok(src, "a source was started");
    assert.equal(src.startedAt, 1.03, "never in the past: now + 30 ms beats a stale nextStart");
    assert.equal(next, 1.03 + 2 + 0.2, "next start = start + duration + gap");
    assert.equal(src.connected, ctx.destination, "connected to the destination");
    assert.equal(src.buffer, buf, "the decoded buffer rides the source until it ends");
    assert.equal(S.ctxSynths(), before + 1, "counted on the current context (B9 H1)");
    assert.ok(S.sources().indexOf(src) >= 0, "tracked in _sources for stop()/skip()");
    src.onended();
    assert.equal(src.disconnects, 1, "disconnected on end");
    assert.equal(src.buffer, null, "the buffer is DETACHED on end (Safari #718)");
    assert.ok(S.sources().indexOf(src) < 0, "dropped from _sources on end");
    assert.equal(ended, 1, "the lane's onEnded ran once");
    src.onended();
    assert.equal(ended, 2, "a second onended is the lane's problem, never a throw");
    var later = S.scheduleDecoded(ctx, { duration: 1 }, 5, 0.1, null);
    assert.equal(sources[1].startedAt, 5, "a future nextStart is honoured as is");
    assert.equal(later, 6.1); sources[1].onended();
  });
  await test("the cloud lane end to end: a Speechify audition's groups all retire through the helper — buffers null, _sources empty, playback idle after the last end", async function() {
    global.fetch = function() { return Promise.resolve({ ok: true, status: 200, arrayBuffer: function() { return Promise.resolve(new Uint8Array([0, 0, 255, 127, 0, 0, 255, 127]).buffer); } }); };
    var d = SET.draft(); d.primary = "speechify"; d.keys.speechify = "fixture"; d.models.speechify.voices = [{ id: "a", label: "Actor A", g: "F" }]; d.models.speechify.narrator = "a"; d.models.speechify.language = "en-US";
    var phases = [];
    SET.test(d, "The road is long. The night is longer.", "a", function(p) { phases.push(p); });
    for (var i = 0; i < 40 && !sources.length; i++) await sleep(10);
    assert.ok(sources.length >= 1, "at least one group was scheduled: " + sources.length);
    assert.ok(sources.every(function(s) { return s.buffer && s.connected; }), "every scheduled source carries its buffer and is connected");
    assert.ok(sources.every(function(s) { return S.sources().indexOf(s) >= 0; }), "every scheduled source is tracked");
    sources.slice().forEach(function(s) { s.onended(); });
    await sleep(20);
    assert.ok(sources.every(function(s) { return s.buffer === null && s.disconnects >= 1; }), "every finished group released its decoded audio through the helper");
    assert.equal(S.sources().length, 0, "_sources is empty after the last end");
    assert.equal(TTS.isPlaying(), false, "playback reports idle (the lane's onAllDone ran)");
    global.fetch = realFetch;
  });
  await test("the three lanes contain no inline createBufferSource — the helper and the audio-session primer are the only sites — and each lane calls the helper with its own gap", async function() {
    var tts = fs.readFileSync(path.join(__dirname, "..", "tts.js"), "utf8"), aud = fs.readFileSync(path.join(__dirname, "..", "audio-session.js"), "utf8");
    var sites = tts.split("createBufferSource()").length - 1, primer = aud.split("createBufferSource()").length - 1;
    assert.equal(sites, 1, "createBufferSource sites in tts.js (the helper; the primer lives in audio-session.js since #631): " + sites);
    assert.equal(primer, 1, "createBufferSource sites in audio-session.js (the primer): " + primer);
    var srv = S.speakServerSrc(), cloud = S.speakGeminiSrc(), piper = S.speakPiperSrc();
    assert.ok(srv.indexOf("createBufferSource") < 0 && cloud.indexOf("createBufferSource") < 0 && piper.indexOf("createBufferSource") < 0, "a lane re-inlined the block");
    assert.ok(/_scheduleDecoded\(ctx, buf, nextStart, unitGap\(u\),/.test(srv), "the server lane schedules through the helper with its unit gap");
    assert.ok(/_scheduleDecoded\(ctx, buf, nextStart, unitGap\(g\.last\),/.test(cloud), "the cloud lane schedules through the helper with its group gap");
    assert.ok(/_scheduleDecoded\(ctx, buf, nextStart, unitGap\(u\),/.test(piper), "the Piper lane schedules through the helper with its unit gap");
    var helper = S.scheduleDecodedSrc();
    assert.ok(helper.indexOf("src.buffer = null") >= 0 && helper.indexOf("_sources.splice") >= 0 && helper.indexOf("src.disconnect()") >= 0 && helper.indexOf("_ctxSynths++") >= 0, "the helper carries every retire step");
    assert.ok(/\.onended = function\(\) \{[\s\S]*activeSrcs--/.test(srv) && /activeSrcs--/.test(cloud) && /activeSrcs--/.test(piper) ? true : /activeSrcs--/.test(srv) && /activeSrcs--/.test(cloud) && /activeSrcs--/.test(piper), "each lane keeps its own activeSrcs bookkeeping in the onEnded it hands the helper");
  });

  global.fetch = realFetch;
  if (failed) { console.error("#418 SCHEDULE-RETIRE TESTS FAILED (" + failed + " of " + (passed + failed) + ")"); process.exit(1); }
  console.log("ALL GREEN — " + passed + " assertions passed (#418 schedule-and-retire)");
  process.exit(0);
})();
