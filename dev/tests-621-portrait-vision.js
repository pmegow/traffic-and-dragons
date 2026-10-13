// tests-621-portrait-vision.js — #621: "Describe appearance from image" rides the GM transport,
// Gemini first, tested as BEHAVIOR over the real describePortraitImage with a scripted global.fetch.
//
// Standalone battery (run-standalone-suites.js child process — its fetch stub must never
// contaminate the main engine suite). Run directly:
//   node dev/tests-621-portrait-vision.js
//
// The field report (owner, 2026-10-12, the first outside beta tester): a signed-in, keyless player
// pressed the button and read "Needs a Claude (Anthropic) key." — the describer went straight to
// Anthropic on providerKeys.anthropic, never through the gateway every GM turn and render ride.
// These pin the contract:
//   ① a signed-in player's request lands on POST /api/llm/gemini/<model> with the session header,
//     kind `portrait`, NO vendor key, and the Gemini vision body (PORTRAIT_DESC_SYS as
//     systemInstruction, the text, the image as inlineData); the reply parses through the Gemini
//     adapter; usage records under `portrait` with the gateway flag and never touches the turn ring;
//   ② a gateway 402/401 is the ACCOUNT message (gmServerRefusalMessage) — never auth-shaped, never a
//     vendor error — and the cached account is refreshed;
//   ③ a vendor failure through the gateway keeps the callGM error shape (providerHttpError);
//   ④ BYOK: an own Gemini key goes straight to Google; a Claude-only player goes straight to Anthropic
//     with the Claude vision body; neither carries a session header;
//   ⑤ no sign-in and no key is one honest sentence naming the remedy, with no request sent;
//   ⑥ an empty Gemini candidate throws the adapter's loud reason; a non-data-URL portrait never leaves.

var fs = require("fs");
var path = require("path");
var root = path.join(__dirname, "..");
var files = require("./engine-manifest.js").map(function (entry) { return entry.file; });
var geval = eval;
for (var i = 0; i < files.length; i++) {
  try { geval(fs.readFileSync(path.join(root, files[i]), "utf8")); }
  catch (e) { console.error("ENGINE LOAD FAILED in " + files[i] + ": " + e.message); process.exit(1); }
}

// ── Reporter (mirrors tests-29-callgm-transport.js) ─────────────────────────
var pass = 0, fails = [], curSection = "";
function section(name) { curSection = name; }
var chain = Promise.resolve();
function tAsync(name, fn) {
  var label = curSection + " › " + name;
  chain = chain.then(function () {
    return Promise.resolve().then(fn).then(
      function (r) { if (r === true || r === undefined) pass++; else fails.push(label + " — " + r); },
      function (e) { fails.push(label + " — threw: " + e.message); }
    );
  });
}

// ── fetch stub: scripted responders, every call recorded ─────────────────────
var calls = [];
var script = [];
function respond(status, okFlag, body) {
  return function () { return Promise.resolve({ ok: okFlag, status: status, text: function () { return Promise.resolve(body); }, json: function () { return Promise.resolve(JSON.parse(body)); } }); };
}
function geminiOk(text) {
  return respond(200, true, JSON.stringify({ candidates: [{ content: { parts: [{ text: text }] }, finishReason: "STOP" }], usageMetadata: { promptTokenCount: 900, candidatesTokenCount: 60 } }));
}
function anthropicOk(text) {
  return respond(200, true, JSON.stringify({ content: [{ type: "text", text: text }], stop_reason: "end_turn", usage: { input_tokens: 900, output_tokens: 60 } }));
}
function httpErr(status, body) { return respond(status, false, body); }
global.fetch = function (url, opts) {
  calls.push({ url: String(url), opts: opts || {} });
  if (/\/api\/account$/.test(String(url))) return respond(200, true, JSON.stringify({ entitled: true }))();/* the refusal path refreshes the cached account */
  var r = script.length ? script.shift() : geminiOk("default");
  return r(url, opts);
};
var toasts = [];
showToast = function (m) { toasts.push(String(m)); };

var SERVER = "https://unit.test";
var PORTRAIT = "data:image/jpeg;base64,QUJD";
function reset(mode) {
  calls.length = 0; script.length = 0; toasts.length = 0;
  worldState = { turn: 7, usage: null, healthLog: [], transcript: [] };
  providerModels = {}; gmRouting = "auto"; _creditToasted = false;
  if (mode === "server") { storageAdapter.setServer(SERVER, "TOK_621"); serverAccount = { entitled: true }; providerKeys = {}; apiKey = ""; activeProvider = "anthropic"; }
  else { storageAdapter.setServer(null, null); serverAccount = null; providerKeys = {}; apiKey = ""; activeProvider = "anthropic"; }
}
function body(call) { return JSON.parse(call.opts.body); }
function describe(name) { return describePortraitImage(PORTRAIT, name).then(function (v) { return { ok: true, v: v }; }, function (e) { return { ok: false, e: e }; }); }

section("#621 gateway — a signed-in keyless player");

tAsync("the request lands on /api/llm/gemini/<model> with the session header, kind portrait, no vendor key, and the Gemini vision body; the reply parses; usage records under portrait as a gateway call and never writes the turn ring", function () {
  reset("server"); script.push(geminiOk("A tall woman with iron-grey eyes."));
  return describe("Tess").then(function (r) {
    if (!r.ok) return "the call failed: " + r.e.message;
    if (r.v !== "A tall woman with iron-grey eyes.") return "wrong description: " + r.v;
    var llm = calls.filter(function (c) { return /\/api\/llm\//.test(c.url); });
    if (llm.length !== 1) return "expected ONE gateway request, got " + llm.length + ": " + calls.map(function (c) { return c.url; }).join(" | ");
    var c = llm[0];
    if (c.url !== SERVER + "/api/llm/gemini/" + PROVIDERS.gemini.defaultModel) return "wrong url: " + c.url;
    var h = c.opts.headers || {};
    if (!/^Bearer /.test(h.Authorization || "")) return "no session header: " + JSON.stringify(h);
    if (h["X-TND-Kind"] !== "portrait") return "kind is not portrait: " + JSON.stringify(h);
    if (h["x-goog-api-key"] || h["x-api-key"]) return "a vendor key rode the gateway request: " + JSON.stringify(h);
    if (h["X-TND-Cache"]) return "the stable-cache header is for turns only: " + JSON.stringify(h);
    var b = body(c);
    if (!b.systemInstruction || b.systemInstruction.parts[0].text !== PORTRAIT_DESC_SYS) return "systemInstruction is not PORTRAIT_DESC_SYS";
    var p = b.contents && b.contents[0] && b.contents[0].parts;
    if (!p || p.length !== 2 || p[0].text.indexOf("Their name is Tess.") < 0 || !p[1].inlineData || p[1].inlineData.mimeType !== "image/jpeg" || p[1].inlineData.data !== "QUJD") return "vision parts: " + JSON.stringify(b.contents);
    if (b.generationConfig.maxOutputTokens !== 400 * PROVIDERS.gemini.tokScale || b.generationConfig.thinkingConfig.thinkingLevel !== "low") return "generationConfig: " + JSON.stringify(b.generationConfig);
    var u = worldState.usage && worldState.usage.byKind && worldState.usage.byKind.portrait;
    if (!u || u.calls !== 1 || u.in !== 900 || u.out !== 60) return "usage under portrait: " + JSON.stringify(worldState.usage && worldState.usage.byKind);
    if (worldState.healthLog.length) return "a portrait call wrote the gameplay health ring";
    return true;
  });
});

tAsync("a gateway 402 reads as the account message — never auth-shaped, never a vendor error — and the cached account is refreshed", function () {
  reset("server"); script.push(httpErr(402, JSON.stringify({ error: "subscription", reason: "none" })));
  return describe("Tess").then(function (r) {
    if (r.ok) return "a 402 produced a description: " + r.v;
    var want = gmServerRefusalMessage(402, { reason: "none" });
    if (r.e.message !== want) return "wrong message: " + r.e.message;
    if (/\bkey\b|401|HTTP/i.test(r.e.message)) return "auth-shaped message would summon the paste-a-key box: " + r.e.message;
    if (!calls.some(function (c) { return /\/api\/account$/.test(c.url); })) return "the cached account was not refreshed";
    return true;
  });
});

tAsync("a gateway 401 reads as the expired-sign-in message", function () {
  reset("server"); script.push(httpErr(401, JSON.stringify({ error: "session" })));
  return describe("").then(function (r) {
    if (r.ok) return "a 401 produced a description";
    return r.e.message === gmServerRefusalMessage(401, null) ? true : "wrong message: " + r.e.message;
  });
});

tAsync("a vendor failure through the gateway keeps the callGM error shape", function () {
  reset("server"); script.push(httpErr(503, JSON.stringify({ error: { message: "The model is overloaded." } })));
  return describe("").then(function (r) {
    if (r.ok) return "a 503 produced a description";
    return /^HTTP 503: The model is overloaded\.$/.test(r.e.message) ? true : "wrong shape: " + r.e.message;
  });
});

tAsync("an empty Gemini candidate throws the adapter's loud reason instead of a blank description", function () {
  reset("server"); script.push(respond(200, true, JSON.stringify({ candidates: [{ content: { parts: [] }, finishReason: "STOP" }], usageMetadata: { promptTokenCount: 9, candidatesTokenCount: 0 } })));
  return describe("").then(function (r) {
    if (r.ok) return "an empty candidate produced: " + JSON.stringify(r.v);
    if (!/Empty response/.test(r.e.message) || !/STOP/.test(r.e.message)) return "the reason is not named: " + r.e.message;
    var u = worldState.usage && worldState.usage.byKind && worldState.usage.byKind.portrait;
    return u && u.calls === 1 ? true : "the billed empty call went uncounted";
  });
});

section("#621 BYOK — own keys, no sign-in");

tAsync("an own Gemini key goes straight to Google with that key and no session header", function () {
  reset("byok"); providerKeys = { gemini: "AIza-own" }; activeProvider = "gemini"; providerModels = { gemini: "gemini-3.7-flash" };
  script.push(geminiOk("Weathered and watchful."));
  return describe("Rook").then(function (r) {
    if (!r.ok) return "the call failed: " + r.e.message;
    if (calls.length !== 1) return "expected ONE request, got " + calls.length;
    var c = calls[0], h = c.opts.headers || {};
    if (c.url !== PROVIDERS.gemini.endpoint("gemini-3.7-flash")) return "wrong url: " + c.url;
    if (h["x-goog-api-key"] !== "AIza-own" || h.Authorization) return "wrong headers: " + JSON.stringify(h);
    return body(c).contents[0].parts[1].inlineData.data === "QUJD" && r.v === "Weathered and watchful." ? true : "body or reply changed";
  });
});

tAsync("a Claude-only player goes straight to Anthropic with the Claude vision body (system, base64 image block, thinking disabled, 400 tokens)", function () {
  reset("byok"); providerKeys = { anthropic: "sk-ant-own" }; activeProvider = "anthropic";
  script.push(anthropicOk("Broad-shouldered, a broken nose."));
  return describe("Bram").then(function (r) {
    if (!r.ok) return "the call failed: " + r.e.message;
    if (calls.length !== 1) return "expected ONE request, got " + calls.length;
    var c = calls[0], h = c.opts.headers || {};
    if (c.url !== PROVIDERS.anthropic.endpoint) return "wrong url: " + c.url;
    if (h["x-api-key"] !== "sk-ant-own" || h.Authorization) return "wrong headers: " + JSON.stringify(h);
    var b = body(c);
    if (b.system !== PORTRAIT_DESC_SYS || b.max_tokens !== 400 || b.model !== PROVIDERS.anthropic.defaultModel) return "envelope: " + JSON.stringify({ max_tokens: b.max_tokens, model: b.model });
    if (!b.thinking || b.thinking.type !== "disabled") return "adaptive thinking left on for a Claude 5 vision call: " + JSON.stringify(b.thinking);
    var ct = b.messages[0].content;
    if (ct[0].text.indexOf("Their name is Bram.") < 0 || ct[1].type !== "image" || ct[1].source.media_type !== "image/jpeg" || ct[1].source.data !== "QUJD") return "content: " + JSON.stringify(ct);
    var u = worldState.usage.byKind.portrait;
    return r.v === "Broad-shouldered, a broken nose." && u && u.calls === 1 && u.in === 900 ? true : "reply or usage changed";
  });
});

tAsync("a signed-in player whose routing is byok uses the own Gemini key, not the gateway", function () {
  reset("server"); gmRouting = "byok"; providerKeys = { gemini: "AIza-own" }; activeProvider = "gemini";
  script.push(geminiOk("ok"));
  return describe("").then(function (r) {
    if (!r.ok) return "the call failed: " + r.e.message;
    return calls.length === 1 && calls[0].url === PROVIDERS.gemini.endpoint(PROVIDERS.gemini.defaultModel) && calls[0].opts.headers["x-goog-api-key"] === "AIza-own" ? true : "wrong route: " + calls[0].url;
  });
});

section("#621 refusals before any request");

tAsync("no sign-in and no key is one honest sentence naming sign-in or a key, and nothing is sent", function () {
  reset("byok");
  return describe("Tess").then(function (r) {
    if (r.ok) return "a keyless unsigned call produced: " + r.v;
    if (calls.length) return "a request was sent with no route: " + calls[0].url;
    return /^Sign in, or add a Gemini or Claude key via File/.test(r.e.message) ? true : "wrong message: " + r.e.message;
  });
});

tAsync("a portrait that is not a base64 data URL never leaves the device", function () {
  reset("server");
  return describePortraitImage("https://example.test/p.jpg", "Tess").then(function () { return "a URL portrait was sent"; }, function (e) {
    return calls.length === 0 && /base64/.test(e.message) ? true : "wrong refusal: " + e.message + " (" + calls.length + " requests)";
  });
});

// ── report ───────────────────────────────────────────────────────────────────
chain.then(function () {
  if (fails.length) {
    console.error("#621 PORTRAIT VISION TESTS FAILED (" + fails.length + " of " + (pass + fails.length) + "):");
    for (var f = 0; f < fails.length; f++) console.error("  ✗ " + fails[f]);
    process.exit(1);
  }
  console.log("ALL GREEN — " + pass + " assertions passed (#621 portrait vision transport)");
  process.exit(0);
});
