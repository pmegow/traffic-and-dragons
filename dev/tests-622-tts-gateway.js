// tests-622-tts-gateway.js — #622 (owner rulings 2026-10-12): a keyless, signed-in, entitled player's
// Speechify narration rides the T&D server; an own key still goes straight to the vendor; the
// Voice Settings picker lists a non-admin only the reachable readers. Tested as BEHAVIOUR over the
// real tts.js route predicate, synthesis fetch, catalog loader and validator with a scripted fetch.
//
// Standalone battery (run-standalone-suites.js child process). Run directly:
//   node dev/tests-622-tts-gateway.js
//
// The field report (the first outside beta tester, 2026-10-12): Voice Settings was hidden from a
// non-admin and the cloud readers called the vendor on a device-stored key, so the tester heard
// only Piper. These pin the contract:
//   ① THE route: an own key wins; a keyless reader is always reachable; a signed-in ENTITLED player on
//     a reader flagged `server` rides the gateway; byok routing, no sign-in, no entitlement or an
//     unflagged reader (Inworld, Gemini TTS) → no route;
//   ② the picker: a non-admin sees Speechify, Piper and the device; an admin sees every entry;
//   ③ synthesis on the server route: POST <server>/api/tts/speechify with the session header, Accept
//     and the SAME vendor body — never a vendor Authorization; the PCM comes back as audio;
//   ④ an own key: the vendor endpoint with "Bearer <key>" and no session header;
//   ⑤ the server's refusals (weekly allowance 429, daily cap 429) reach the read as the server's own
//     sentence, so the degrade toast says why; a 402 names the account;
//   ⑥ the catalog on the server route: GET <server>/api/tts/speechify/voices, raw vendor voices mapped
//     by the client's one mapper (an actor without simba-3.2 is dropped); no route → the key sentence;
//   ⑦ the validator passes a keyless draft on the server route and refuses it with no route;
//     available() follows the route, not the key.

var engine = require("./load-engine.js");
engine.loadEngine();
var assert = require("assert/strict");

var realFetch = global.fetch;
global.document = { getElementById: function() { return null; }, addEventListener: function() {}, removeEventListener: function() {} };
var toasts = [];
global.showToast = function(m) { toasts.push(String(m)); };

var S = TTS.settings;
var SERVER = "https://unit.test";
var calls = [];
var script = [];
function pcmReply() { return { ok: true, status: 200, headers: { get: function() { return null; } }, arrayBuffer: function() { return Promise.resolve(new Uint8Array([0, 0, 255, 127]).buffer); }, json: function() { return Promise.resolve({}); } }; }
function jsonReply(status, body) { return { ok: status < 400, status: status, headers: { get: function() { return null; } }, json: function() { return Promise.resolve(body); }, text: function() { return Promise.resolve(JSON.stringify(body)); }, arrayBuffer: function() { return Promise.resolve(new ArrayBuffer(0)); } }; }
global.fetch = function(url, opts) {
  calls.push({ url: String(url), opts: opts || {} });
  var r = script.length ? script.shift() : pcmReply();
  return Promise.resolve(r);
};

function reset(mode) {
  calls.length = 0; script.length = 0; toasts.length = 0;
  gmRouting = "auto";
  providerKeys = {};
  store.set(S._keys.credentials, "{}");   // no stored vendor keys
  if (mode === "server") { storageAdapter.setServer(SERVER, "TOK_622"); serverAccount = { entitled: true, narration: { used: 1000, cap: 250000, remaining: 249000, resetsAt: null, exempt: false } }; }
  else if (mode === "unentitled") { storageAdapter.setServer(SERVER, "TOK_622"); serverAccount = { entitled: false, reason: "none" }; }
  else { storageAdapter.setServer(null, null); serverAccount = null; }
}
function group(text) { return { text: text, voice: "geffen", last: null }; }
function config() { var c = S.draft().models.speechify; c.voices = [{ id: "geffen", label: "Geffen", g: "M" }]; c.narrator = "geffen"; return c; }

var passed = 0, failed = 0;
async function test(name, fn) {
  try { await fn(); passed++; console.log("PASS #622 " + name); }
  catch (e) { failed++; console.error("FAIL #622 " + name + " — " + (e && e.message)); }
}

(async function() {
  await test("the route: no sign-in and no key is null; a staged key wins; a stored key wins; a keyless reader is local", async function() {
    reset("none");
    assert.equal(S.route("speechify"), null, "unsigned keyless speechify");
    assert.deepEqual(S.route("speechify", "sk-staged"), { own: true, key: "sk-staged" }, "a staged key");
    store.set(S._keys.credentials, JSON.stringify({ speechify: "sk-stored" }));
    assert.deepEqual(S.route("speechify"), { own: true, key: "sk-stored" }, "a stored key");
    assert.equal(S.route("speechify", ""), null, "an explicit empty key in hand (a draft that cleared it) never falls back to the stored key");
    assert.deepEqual(S.route("local"), { local: true }, "Piper is always reachable");
    assert.deepEqual(S.route("native"), { local: true }, "the device voice is always reachable");
    assert.equal(S.route("nonesuch"), null, "an unknown reader");
  });
  await test("the route: a signed-in entitled keyless player rides the server for Speechify only; byok routing, no entitlement, no token or an unflagged reader → null", async function() {
    reset("server");
    assert.deepEqual(S.route("speechify"), { server: true }, "speechify rides the server");
    assert.equal(S.route("inworld"), null, "inworld is not flagged yet");
    assert.equal(S.route("gemini"), null, "gemini TTS is BYOK");
    assert.deepEqual(S.route("speechify", "sk-own"), { own: true, key: "sk-own" }, "an own key still wins while signed in");
    gmRouting = "byok"; assert.equal(S.route("speechify"), null, "byok routing never rides the gateway"); gmRouting = "auto";
    reset("unentitled"); assert.equal(S.route("speechify"), null, "unentitled");
    reset("server"); storageAdapter.setServer(SERVER, null); assert.equal(S.route("speechify"), null, "signed out (no token)");
  });
  await test("the picker: a non-admin lists Speechify, Piper and the device; an admin lists every entry; a BYOK Gemini key surfaces Gemini TTS", async function() {
    reset("server");
    assert.deepEqual(S.visibleModels(false), ["speechify", "local", "native"], "non-admin, keyless");
    assert.deepEqual(S.visibleModels(true), Object.keys(S.models), "admin sees all");
    providerKeys = { gemini: "AIza-own" };
    assert.deepEqual(S.visibleModels(false), ["gemini", "speechify", "local", "native"], "an own Gemini key makes Gemini TTS reachable");
    reset("none");
    assert.deepEqual(S.visibleModels(false), ["local", "native"], "unsigned keyless: only the free readers");
  });
  await test("synthesis on the server route: the session header, Accept and the SAME vendor body — never a vendor key; the PCM comes back as audio", async function() {
    reset("server");
    var c = config();
    var r = await S._fetch("speechify", group("The lantern gutters."), c, "", function() {}, "");
    assert.equal(calls.length, 1, "one request");
    assert.equal(calls[0].url, SERVER + "/api/tts/speechify", "the gateway url");
    var h = calls[0].opts.headers;
    assert.equal(h.Authorization, "Bearer TOK_622", "the session header");
    assert.equal(h.Accept, "audio/pcm", "the reader's Accept");
    assert.equal(h["Content-Type"], "application/json");
    var body = JSON.parse(calls[0].opts.body);
    assert.equal(body.model, "simba-3.2"); assert.equal(body.voice_id, "geffen"); assert.ok(body.input.indexOf("The lantern gutters.") >= 0, "the text rides the vendor body");
    assert.ok(r.bytes && r.bytes.length === 4 && r.rate === 24000, "audio returned: " + JSON.stringify(r));
    // byte-identity with the own-key body
    reset("none"); var c2 = config(); await S._fetch("speechify", group("The lantern gutters."), c2, "sk-own", function() {}, "");
    assert.equal(calls[0].opts.body, JSON.stringify(body), "the own-key body is byte-identical to the gateway body");
  });
  await test("an own key goes straight to the vendor with Bearer <key> and no session header; no key and no sign-in never sends", async function() {
    reset("none");
    var r = await S._fetch("speechify", group("Hi"), config(), "sk-own", function() {}, "");
    assert.equal(calls.length, 1); assert.equal(calls[0].url, S.models.speechify.endpoint, "the vendor endpoint");
    assert.equal(calls[0].opts.headers.Authorization, "Bearer sk-own"); assert.ok(r.bytes, "audio");
    reset("none");
    r = await S._fetch("speechify", group("Hi"), config(), "", function() {}, "");
    assert.equal(calls.length, 0, "nothing sent"); assert.equal(r.fail, "No API key");
  });
  await test("the server's refusals reach the read as the server's own sentence: the weekly allowance, the daily cap, a lapsed account", async function() {
    reset("server");
    script.push(jsonReply(429, { error: "tts-allowance", used: 250000, cap: 250000, resetsAt: null, message: "Your included narration for this week is used up (250,000 characters) — the next frees up Monday. The on-device voice continues meanwhile." }));
    var r = await S._fetch("speechify", group("Hi"), config(), "", function() {}, "");
    assert.ok(/HTTP 429 — Your included narration for this week is used up/.test(r.fail), "the weekly sentence: " + r.fail);
    assert.ok(!/\bkey\b/i.test(r.fail), "never a key pitch");
    script.push(jsonReply(429, { error: "Daily narration limit reached (100,000 characters) — more tomorrow; the on-device voice continues" }));
    r = await S._fetch("speechify", group("Hi"), config(), "", function() {}, "");
    assert.ok(/Daily narration limit reached/.test(r.fail), "the daily sentence: " + r.fail);
    script.push(jsonReply(402, { error: "subscription", reason: "lapsed" }));
    r = await S._fetch("speechify", group("Hi"), config(), "", function() {}, "");
    assert.ok(/HTTP 402/.test(r.fail), "a 402 is still loud: " + r.fail);
  });
  await test("the catalog on the server route: GET <server>/api/tts/speechify/voices with the session header; raw vendor voices pass the client's one mapper; no route → the key sentence", async function() {
    reset("server");
    script.push(jsonReply(200, { voices: [
      { id: "geffen", display_name: "Geffen", gender: "male", tags: ["accent:american"], models: [{ name: "simba-3.2" }] },
      { id: "old", display_name: "Old", gender: "male", models: [{ name: "simba-2" }] },
      { id: "lisa", display_name: "Lisa", gender: "female", models: [{ name: "simba-3.2" }] }
    ], fetchedAt: "2026-10-12T00:00:00.000Z", cached: true }));
    var list = await S.loadCatalog("speechify", "", function() {});
    assert.equal(calls.length, 1); assert.equal(calls[0].url, SERVER + "/api/tts/speechify/voices"); assert.equal(calls[0].opts.headers.Authorization, "Bearer TOK_622");
    assert.deepEqual(list.map(function(v) { return v.id; }), ["geffen", "lisa"], "the simba-2-only actor is dropped by the mapper");
    assert.equal(list[0].g, "M"); assert.equal(list[1].label, "Lisa");
    reset("none");
    await assert.rejects(S.loadCatalog("speechify", "", function() {}), /Enter an API key before loading voices/, "no route");
    assert.equal(calls.length, 0);
    reset("none");
    script.push(jsonReply(200, { voices: [{ id: "geffen", display_name: "Geffen", gender: "male", models: [{ name: "simba-3.2" }] }], has_more: false }));
    list = await S.loadCatalog("speechify", "sk-own", function() {});
    assert.ok(/api\.speechify\.ai\/v1\/voices/.test(calls[0].url) && calls[0].opts.headers.Authorization === "Bearer sk-own", "an own key walks the vendor itself");
    assert.equal(list.length, 1);
  });
  await test("the validator passes a keyless draft on the server route and refuses it with no route, naming sign-in; available() follows the route", async function() {
    reset("server");
    var d = S.draft(); d.primary = "speechify"; d.keys.speechify = ""; d.models.speechify.voices = [{ id: "geffen", label: "Geffen", g: "M" }]; d.models.speechify.narrator = "geffen"; d.models.speechify.language = "en-US";
    assert.equal(S._validate(d), "", "valid on the server route");
    reset("none");
    assert.ok(/Enter a Speechify API key, or sign in/.test(S._validate(d)), "no route: " + S._validate(d));
    d.primary = "inworld"; d.keys.inworld = ""; d.models.inworld.voices = [{ id: "a", label: "A" }]; d.models.inworld.narrator = "a";
    reset("server");
    assert.ok(/Enter a Inworld API key\.$/.test(S._validate(d)), "inworld is not on the server: " + S._validate(d));
    // available(): the ladder's speechify tier is reachable on the server route when it is the primary
    reset("server"); d = S.draft(); d.primary = "speechify"; d.keys.speechify = ""; d.models.speechify.voices = [{ id: "geffen", label: "Geffen", g: "M" }]; d.models.speechify.narrator = "geffen"; d.models.speechify.language = "en-US"; S.save(d);
    assert.equal(typeof S._providerAvailable, "function", "the test seam exists");
    assert.equal(S._providerAvailable("speechify"), true, "available on the server route");
    reset("none"); assert.equal(S._providerAvailable("speechify"), false, "unavailable with no route");
  });

  global.fetch = realFetch;
  if (failed) { console.error("#622 TTS GATEWAY TESTS FAILED (" + failed + " of " + (passed + failed) + ")"); process.exit(1); }
  console.log("ALL GREEN — " + passed + " assertions passed (#622 tts gateway)");
  process.exit(0);
})();
