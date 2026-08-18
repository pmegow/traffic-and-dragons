// tests-41f-gemini-model-ladder.js — TODO #41f: the in-family Gemini TTS model ladder,
// tested as BEHAVIOR over the real _geminiFetchGroup with a scripted global.fetch.
//
// Standalone battery (run-standalone-suites.js child process — its fetch stub must never
// contaminate the main engine suite). Run directly:
//   node dev/tests-41f-gemini-model-ladder.js
//
// The field evidence behind the rung (#41d, owner's second capture): Google's RetryInfo quoted
// 1986s — a 33-MINUTE closed quota — and the only exit was degrading the whole tier to local
// Piper, losing the Gemini cast mid-campaign. But Gemini free-tier quota buckets are PER-MODEL,
// and gemini-2.5-flash-preview-tts speaks the same 30 prebuilt voices; these tests pin the
// contract:
//   ① a closed-quota 429 on the primary (hint over the cap) falls the SAME group to the 2.5
//     rung mid-read — same voice, same request shape — instead of handing the read to Piper;
//   ② later fetches go STRAIGHT to the open rung: a bucket Google said is closed is never
//     burned as a probe request;
//   ③ when EVERY rung is closed, the group fails with degradeMs sized to the EARLIEST bucket
//     reopen (the engine-level window inherits an honest number, not the flat 60s);
//   ④ the fall is announced ONCE per session (toast latch) and only on a SUCCESS — a rung that
//     also failed must not toast "continuing" over a read that is about to degrade anyway.

var fs = require("fs");
var path = require("path");
var root = path.join(__dirname, "..");
// The manifest is the load-order authority (the #18 census lesson — a copied list rots).
var files = require("./engine-manifest.js").map(function (entry) { return entry.file; });
var geval = eval;
for (var i = 0; i < files.length; i++) {
  try { geval(fs.readFileSync(path.join(root, files[i]), "utf8")); }
  catch (e) { console.error("ENGINE LOAD FAILED in " + files[i] + ": " + e.message); process.exit(1); }
}

var GEM = TTS._gemini;

// ── Reporter (mirrors tests-29-callgm-transport.js) ──────────────────────────
var pass = 0, fails = [], curSection = "";
function section(name) { curSection = name; }
function t(name, fn) {
  var label = curSection + " › " + name;
  try {
    var r = fn();
    if (r === true || r === undefined) pass++;
    else fails.push(label + " — " + r);
  } catch (e) { fails.push(label + " — threw: " + e.message); }
}
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
var calls = [];   // [{url, opts}]
var script = [];  // responders consumed in order
// A successful synthesis: JSON carrying base64 headerless PCM (the real response shape).
function gemOk() {
  return function () {
    return Promise.resolve({ ok: true, status: 200, json: function () {
      return Promise.resolve({ candidates: [ { content: { parts: [ { inlineData: {
        data: "QUFBQUFBQUE=", mimeType: "audio/L16;codec=pcm;rate=24000" } } ] } } ] });
    } });
  };
}
// A 429 whose body carries google.rpc.RetryInfo — hintS seconds (the #41d shape).
function gem429(hintS) {
  return function () {
    return Promise.resolve({ ok: false, status: 429, json: function () {
      return Promise.resolve({ error: { status: "RESOURCE_EXHAUSTED", details: [
        { "@type": "type.googleapis.com/google.rpc.RetryInfo", retryDelay: hintS + "s" } ] } });
    } });
  };
}
global.fetch = function (url, opts) {
  calls.push({ url: String(url), opts: opts || {} });
  var r = script.shift();
  if (!r) return Promise.reject(new Error("fetch called with an empty script"));
  return r(url, opts);
};
// The fall toast is latched once per session; count what the player would actually see.
var toasts = [];
global.showToast = function (msg) { toasts.push(String(msg)); };

function reset() { calls = []; script = []; GEM.modelReset(); GEM.resetDegrade(); }
var MODELS = GEM.models();
function grp(text) { return { text: text, voice: "Charon" }; }

// ── ① the mid-read fall ──────────────────────────────────────────────────────
section("#41f model ladder");
tAsync("an over-cap quota hint on the primary falls the SAME group to the 2.5 rung — same voice, no Piper hand-off", function () {
  reset(); toasts = [];
  script.push(gem429(60), gemOk());   // 60s hint > the 45s cap → closed bucket, not a wait
  return GEM.fetchGroup(grp("The road bends east toward the ford."), false, "test-key", "Read plainly.", null)
    .then(function (r) {
      if (!r || !r.b64) return "the group failed instead of falling: " + JSON.stringify(r);
      if (calls.length !== 2) return calls.length + " fetch calls — expected the 429 probe + the relief-rung retry";
      if (calls[0].url.indexOf(MODELS[0]) < 0) return "first call went to " + calls[0].url;
      if (calls[1].url.indexOf(MODELS[1]) < 0) return "retry did not land on the relief rung: " + calls[1].url;
      var body = JSON.parse(calls[1].opts.body);
      var v = body.generationConfig.speechConfig.voiceConfig.prebuiltVoiceConfig.voiceName;
      if (v !== "Charon") return "the fall changed the voice to " + v + " — the shared-voice-list continuity is the rung's whole point";
      var until = GEM.modelState()[MODELS[0]] || 0, left = until - Date.now();
      if (!(left > 50000 && left <= 60000)) return "the primary's bucket was not closed for Google's hinted 60s: " + left + "ms";
      return true;
    });
});

// ── ② no probe against a closed bucket ───────────────────────────────────────
tAsync("a later group goes STRAIGHT to the open rung — the closed bucket is never probed", function () {
  calls = []; script = [gemOk()];      // memo still holds from ① — that persistence IS the test
  return GEM.fetchGroup(grp("A crow lifts from the fence post."), false, "test-key", "Read plainly.", null)
    .then(function (r) {
      if (!r || !r.b64) return "the follow-up group failed: " + JSON.stringify(r);
      if (calls.length !== 1) return calls.length + " fetch calls — a probe was burned against a quota Google already said is closed";
      if (calls[0].url.indexOf(MODELS[1]) < 0) return "the call went to " + calls[0].url;
      return true;
    });
});

// ── ④ the toast latch (order matters: ① and ② each succeeded on the backup rung) ─
tAsync("the fall is announced ONCE per session, and only on a backup-rung SUCCESS", function () {
  var fell = toasts.filter(function (m) { return /backup/i.test(m); });
  return fell.length === 1 ? true :
    fell.length + " fall toasts after two backup-rung successes — expected exactly 1 (latched)";
});

// ── ③ the ladder running out ─────────────────────────────────────────────────
tAsync("an all-closed ladder fails the group with degradeMs sized to the EARLIEST reopen — and burns zero requests", function () {
  reset();
  GEM.modelClose(MODELS[0], 300000);
  GEM.modelClose(MODELS[1], 120000);
  return GEM.fetchGroup(grp("Rain again."), false, "test-key", "Read plainly.", null)
    .then(function (r) {
      if (!r || !r.fail) return "an all-closed ladder returned audio from nowhere";
      if (calls.length !== 0) return calls.length + " fetch calls against buckets known to be closed";
      if (!/quota/i.test(r.fail)) return "the failure reason hides the quota cause: " + r.fail;
      if (!(r.degradeMs > 110000 && r.degradeMs <= 120000)) return "degradeMs " + r.degradeMs + " — expected ≈120s (the EARLIEST bucket), not the latest or the flat 60s";
      GEM.modelReset();
      return true;
    });
});

// ── report ───────────────────────────────────────────────────────────────────
chain.then(function () {
  if (fails.length) {
    console.error("#41f MODEL LADDER TESTS FAILED (" + fails.length + " of " + (pass + fails.length) + "):");
    for (var f = 0; f < fails.length; f++) console.error("  ✗ " + fails[f]);
    process.exit(1);
  }
  console.log("ALL GREEN — " + pass + " assertions passed (#41f gemini model ladder)");
  process.exit(0);
});
