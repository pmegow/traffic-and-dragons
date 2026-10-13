// tests-625-stt-gateway.js — #625 (owner 2026-10-13): a keyless, signed-in, entitled player's
// dictation rides the T&D server's transcription proxy; an own OpenAI key still goes straight to
// the vendor; an account refusal from the server ends the attempt (no fallback model); a vendor
// failure through the server still gets the one fallback retry. Tested as BEHAVIOUR over the real
// stt.js route predicate and upload path with a scripted fetch (the tests-287 loader).
//
// Standalone battery (run-standalone-suites.js child process). Run directly:
//   node dev/tests-625-stt-gateway.js

var fs = require("fs");
var path = require("path");
var assert = require("assert/strict");
var root = path.join(__dirname, "..");
var geval = eval;

var input = { value: "", style: {}, title: "", oninput: null, focus: function() {}, blur: function() {}, classList: { add: function() {}, remove: function() {} } };
global.window = { SpeechRecognition: null, webkitSpeechRecognition: null };
global.document = { getElementById: function(id) { return id === "action-input" ? input : null; } };
global.navigator = { mediaDevices: { getUserMedia: function() { return Promise.reject(new Error("not used")); } } };
global.MediaRecorder = function() {};
["globals.js", "data.js", "helpers.js", "audio-events.js", "stt.js"].forEach(function(f) {
  try { geval(fs.readFileSync(path.join(root, f), "utf8")); }
  catch (e) { console.error("ENGINE LOAD FAILED in " + f + ": " + e.message); process.exit(1); }
});
global.store = { get: function() { return ""; }, set: function() {} };   // auto-send OFF: the text lands in the action box
// Node 22 defines its own `navigator` as an accessor on the global — a plain assignment is silently ignored, so
// _cloudAvailable would read no mediaDevices and the route test would fail for the wrong reason. Define it.
Object.defineProperty(global, "navigator", { value: { mediaDevices: { getUserMedia: function() { return Promise.reject(new Error("not used")); } }, onLine: true }, configurable: true, writable: true });
global.eachMenuEl = function() {};
global.carMode = false; global.busy = false;
var toasts = [], carNotes = [];
global.showToast = function(m) { toasts.push(String(m)); };
global.carNotify = function(kind, text) { carNotes.push(kind + ":" + (text || "")); };
global.carVoiceCommand = function() { return false; };
global.worldState = { turn: 1, character: { name: "Korrag" }, npcs: [], world: { location: "Sandpoint" }, questLog: [] };
global.memory = { npcs: {}, locations: {}, map: { nodes: {}, edges: [] } };

var SERVER = "https://unit.test";
var realFetch = global.fetch;
var calls = [], script = [];
function jsonReply(status, body) { return { ok: status < 400, status: status, json: function() { return Promise.resolve(body); }, text: function() { return Promise.resolve(JSON.stringify(body)); } }; }
global.fetch = function(url, opts) {
  calls.push({ url: String(url), opts: opts || {} });
  var r = script.length ? script.shift() : jsonReply(200, { text: "hold the road" });
  return Promise.resolve(r);
};
function reset(mode) {
  calls.length = 0; script.length = 0; toasts.length = 0; carNotes.length = 0; input.value = "";
  gmRouting = "auto"; providerKeys = {};
  var signed = mode === "server" || mode === "unentitled" || mode === "unavailable";
  global.storageAdapter = { isServerMode: function() { return signed; }, hasToken: function() { return signed; }, getServerUrl: function() { return SERVER; }, authHeader: function() { return { Authorization: "Bearer TOK_625" }; } };
  if (mode === "server") serverAccount = { entitled: true, transcription: { available: true, used: 0, cap: 3600000, remaining: 3600000, exempt: false } };
  else if (mode === "unentitled") serverAccount = { entitled: false, reason: "none", transcription: { available: true } };
  else if (mode === "unavailable") serverAccount = { entitled: true, transcription: { available: false } };
  else serverAccount = null;
}
var C = STT._cloudTest;
function utter(audioMs) {
  var tok = C.begin("");
  return C.upload(new Blob(["audio"], { type: "audio/webm" }), "audio/webm", tok.generation, tok.baseText, audioMs);
}

var passed = 0, failed = 0;
async function test(name, fn) {
  try { await fn(); passed++; console.log("PASS #625 " + name); }
  catch (e) { failed++; console.error("FAIL #625 " + name + " — " + (e && e.message)); }
}

(async function() {
  await test("the route: no key and no sign-in is null; an own key wins; a signed-in entitled player rides the server only when the readout says the server holds the key; byok routing, no entitlement or available:false → null; _cloudAvailable follows", async function() {
    reset("none"); assert.equal(C.route(), null, "unsigned keyless"); assert.equal(C.available(), false, "not available unsigned");
    providerKeys = { openai: "sk-own" }; assert.deepEqual(C.route(), { own: true, key: "sk-own" }, "an own key"); assert.equal(C.available(), true, "available with an own key: " + JSON.stringify([typeof MediaRecorder, !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia), !!C.route()]));
    reset("server"); assert.deepEqual(C.route(), { server: true }, "the server route"); assert.equal(C.available(), true, "available on the server route");
    providerKeys = { openai: "sk-own" }; assert.deepEqual(C.route(), { own: true, key: "sk-own" }, "an own key still wins while signed in");
    providerKeys = {}; gmRouting = "byok"; assert.equal(C.route(), null, "byok routing never rides the gateway"); gmRouting = "auto";
    reset("unentitled"); assert.equal(C.route(), null, "unentitled");
    reset("unavailable"); assert.equal(C.route(), null, "the server holds no key → no route"); assert.equal(C.available(), false);
  });
  await test("the upload on the server route: POST <server>/api/stt/transcribe with the session header and the take's duration, never a vendor key; the multipart carries the file, the model and the logprobs ask; the text lands in the action box", async function() {
    reset("server");
    var r = await utter(4200);
    assert.equal(calls.length, 1, "one request");
    assert.equal(calls[0].url, SERVER + "/api/stt/transcribe", "the gateway url");
    var h = calls[0].opts.headers;
    assert.equal(h.Authorization, "Bearer TOK_625", "the session header"); assert.equal(h["X-TND-Audio-Ms"], "4200", "the take's duration");
    assert.ok(!h["Content-Type"], "no hand-set Content-Type — the browser sets the multipart boundary");
    var form = calls[0].opts.body;
    assert.ok(form && typeof form.get === "function", "a FormData body");
    assert.equal(form.get("model"), "gpt-4o-mini-transcribe"); assert.equal(form.get("response_format"), "json"); assert.equal(form.get("include[]"), "logprobs");
    assert.ok(form.get("file"), "the audio file rides");
    assert.ok(/hold the road/.test(input.value), "the transcript landed: " + JSON.stringify(input.value) + " (r=" + r + ")");
  });
  await test("an own key goes straight to the vendor with Bearer <key> and no session header or duration", async function() {
    reset("none"); providerKeys = { openai: "sk-own" };
    await utter(1000);
    assert.equal(calls.length, 1); assert.equal(calls[0].url, "https://api.openai.com/v1/audio/transcriptions");
    var h = calls[0].opts.headers; assert.equal(h.Authorization, "Bearer sk-own"); assert.ok(!h["X-TND-Audio-Ms"], "no duration header to the vendor");
  });
  await test("a server 429 (the daily cap) ends the attempt with the server's sentence — ONE request, no fallback model, no second refusal", async function() {
    reset("server");
    script.push(jsonReply(429, { error: "Daily dictation limit reached (60 minutes of audio) — more tomorrow; you can still type", used: 3600000, cap: 3600000 }));
    var r = await utter(2000);
    assert.equal(r, false, "resolves false"); assert.equal(calls.length, 1, "no fallback retry after an account refusal: " + calls.length);
    assert.ok(carNotes.some(function(n) { return /warn:.*Daily dictation limit reached/.test(n); }), "the car hears the server's sentence: " + JSON.stringify(carNotes));
    assert.ok(toasts.some(function(t) { return /failed/i.test(t); }), "the toast says it failed");
    assert.equal(input.value, "", "nothing landed");
  });
  await test("a server 402 ends the attempt naming the subscription; a 401 likewise — one request each", async function() {
    reset("server"); script.push(jsonReply(402, { error: "subscription", reason: "lapsed" }));
    await utter(2000); assert.equal(calls.length, 1); assert.ok(carNotes.some(function(n) { return /subscription.*lapsed/.test(n); }), JSON.stringify(carNotes));
    reset("server"); script.push(jsonReply(401, { error: "Not logged in" }));
    await utter(2000); assert.equal(calls.length, 1); assert.ok(carNotes.some(function(n) { return /Not logged in/.test(n); }), JSON.stringify(carNotes));
  });
  await test("a vendor failure through the server (503) still gets the one fallback retry on whisper-1 — and it rides the gateway too", async function() {
    reset("server"); script.push(jsonReply(503, { error: { message: "overloaded" } })); script.push(jsonReply(200, { text: "second try" }));
    await utter(2000);
    assert.equal(calls.length, 2, "primary then the fallback");
    assert.equal(calls[1].url, SERVER + "/api/stt/transcribe"); assert.equal(calls[1].opts.body.get("model"), "whisper-1"); assert.equal(calls[1].opts.headers["X-TND-Audio-Ms"], "2000");
    assert.ok(/second try/.test(input.value), "the fallback's transcript landed");
  });
  await test("no key and no sign-in: the upload never leaves, and the sentence names both remedies", async function() {
    reset("none");
    var r = await utter(1000);
    assert.equal(r, false); assert.equal(calls.length, 0, "nothing sent");
    assert.ok(toasts.some(function(t) { return /OpenAI API key, or a signed-in account/.test(t); }), JSON.stringify(toasts));
  });

  global.fetch = realFetch;
  if (failed) { console.error("#625 STT GATEWAY TESTS FAILED (" + failed + " of " + (passed + failed) + ")"); process.exit(1); }
  console.log("ALL GREEN — " + passed + " assertions passed (#625 stt gateway)");
  process.exit(0);
})();
