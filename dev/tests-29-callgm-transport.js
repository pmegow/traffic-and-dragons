// tests-29-callgm-transport.js — TODO #29: callGM transport resilience (deadline + bounded
// transient auto-retry), tested as BEHAVIOR over the real callGM with a scripted global.fetch.
//
// Standalone battery (run-standalone-suites.js child process — its fetch stub must never
// contaminate the main engine suite). Run directly:
//   node dev/tests-29-callgm-transport.js
//
// The #29 field evidence: mid-sweep, one request neither resolved nor rejected during a 503
// storm — busy stayed true and the page sat on "The world turns…" forever (reload was the only
// recovery). And every transient 503/429 blip reached the player as a scary failed turn even
// though the harness driver proved they self-heal on one retry. Both halves land at the ONE
// callGM boundary; these tests pin the contract:
//   ① transient statuses (CALLGM_TRANSIENT_STATUS) auto-retry, bounded by CALLGM_RETRY_MAX,
//     and the retried request body is BYTE-IDENTICAL (provider prompt caches see one prefix);
//   ② a B15 credit refusal is NEVER retried — OpenAI bills refusals as HTTP 429, so the credit
//     check must run BEFORE the retry decision or the billing toast arrives 6s and 2 burned
//     calls late;
//   ③ a hung request aborts at CALLGM_TIMEOUT_MS: loud, terminal, NO auto-retry (the request
//     may still complete and bill server-side — an auto-retry could double-generate), and the
//     message must never look auth-shaped (_attachGMErrorUI would offer a paste-a-key box);
//   ④ network rejects stay loud and unretried (request state ambiguous — same double-bill risk);
//   ⑤ retries-exhausted falls through to the byte-identical "HTTP <status>[: <message>]" shape;
//   ⑥ absorbed retries stamp `rt` into the #17 healthLog ring (a degrading provider must be
//     visible, not hidden) and toast ONCE per call, gameplay turns only.

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

// ── Reporter (mirrors run-tests.js; async chain like tests-c13-adapter.js) ───
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
var script = [];  // responders consumed in order; empty → default 200
function respond(status, okFlag, body) {
  return function () { return Promise.resolve({ ok: okFlag, status: status, text: function () { return Promise.resolve(body); } }); };
}
function anthropicOk(text) {
  return respond(200, true, JSON.stringify({ content: [{ type: "text", text: text || "Hello" }], stop_reason: "end_turn", usage: { input_tokens: 100, output_tokens: 10 } }));
}
function httpErr(status, body) { return respond(status, false, body); }
function rejectWith(msg) { return function () { return Promise.reject(new Error(msg)); }; }
function hang() { // resolves NEVER; rejects AbortError only when the caller's deadline fires
  return function (url, opts) {
    return new Promise(function (resolve, reject) {
      if (opts && opts.signal) opts.signal.addEventListener("abort", function () {
        var e = new Error("This operation was aborted"); e.name = "AbortError"; reject(e);
      });
    });
  };
}
global.fetch = function (url, opts) {
  calls.push({ url: url, opts: opts || {} });
  var r = script.length ? script.shift() : anthropicOk();
  return r(url, opts);
};

// ── Environment: real engine globals, minimal world ──────────────────────────
var toasts = [];
showToast = function (m) { toasts.push(String(m)); };
function reset(provId) {
  calls.length = 0; script.length = 0; toasts.length = 0;
  activeProvider = provId || "anthropic";
  providerKeys = { anthropic: "sk-ant-TEST", openai: "sk-TEST", gemini: "AIzaTEST" };
  sessionLog = [];
  worldState = { turn: 42, usage: null, healthLog: [], transcript: [] };
  _creditToasted = false;
}
// Shrink the knobs so the battery runs in ms — they are vars BY CONTRACT (this seam).
// Jitter is proportional to the base (CALLGM_RETRY_BASE_MS/5), so a 1ms base retries near-instantly.
function fastKnobs() { CALLGM_RETRY_BASE_MS = 1; CALLGM_TIMEOUT_MS = 40; }
// A callGM that cannot settle would hang the battery exactly like the field bug hangs busy —
// race a sentinel so the PRE-fix failure mode is a red assertion, not a stuck CI.
function raceCall(args, ms) {
  return Promise.race([
    callGM.apply(null, args).then(function (v) { return { ok: true, v: v }; }, function (e) { return { ok: false, e: e }; }),
    new Promise(function (res) { setTimeout(function () { res({ sentinel: true }); }, ms || 1500); })
  ]);
}

section("#29 transport — transient auto-retry");

tAsync("a 503 blip self-heals: retry succeeds, the player never sees a failed turn", function () {
  reset(); fastKnobs();
  script.push(httpErr(503, '{"error":{"message":"The model is overloaded. Please try again later."}}'));
  script.push(anthropicOk("After the storm"));
  return raceCall(["hi", "SYS", 60, null, { noHistory: true, kind: "turn" }]).then(function (r) {
    if (r.sentinel) return "callGM never settled";
    if (!r.ok) return "turn still failed: " + r.e.message;
    if (r.v !== "After the storm") return "wrong response: " + r.v;
    if (calls.length !== 2) return "expected 2 fetches (1 + 1 retry), got " + calls.length;
    return calls[0].opts.body === calls[1].opts.body ? true : "retried body is not byte-identical — provider prompt caches would see a new prefix";
  });
});
tAsync("an absorbed retry is stamped rt into the #17 healthLog ring, and usage records ONCE", function () {
  reset(); fastKnobs();
  script.push(httpErr(503, "{}"));
  script.push(anthropicOk());
  return raceCall(["hi", "SYS", 60, null, { noHistory: true, kind: "turn" }]).then(function (r) {
    if (r.sentinel || !r.ok) return "call did not succeed";
    var hl = worldState.healthLog;
    if (!hl.length) return "no healthLog entry written";
    if (hl[hl.length - 1].rt !== 1) return "rt not stamped (got " + JSON.stringify(hl[hl.length - 1].rt) + ") — absorbed retries are invisible to #17";
    return worldState.usage.calls === 1 ? true : "usage recorded " + worldState.usage.calls + " calls for one turn";
  });
});
tAsync("a clean first-try success carries NO rt key (the ring stays lean)", function () {
  reset(); fastKnobs();
  script.push(anthropicOk());
  return raceCall(["hi", "SYS", 60, null, { noHistory: true, kind: "turn" }]).then(function (r) {
    if (r.sentinel || !r.ok) return "call did not succeed";
    var e = worldState.healthLog[worldState.healthLog.length - 1];
    return ("rt" in e) ? "rt key present on an unretried call" : true;
  });
});
tAsync("retries exhaust at CALLGM_RETRY_MAX and fall through BYTE-IDENTICAL to the old error shape", function () {
  reset(); fastKnobs();
  var body = '{"error":{"message":"The model is overloaded. Please try again later."}}';
  script.push(httpErr(503, body)); script.push(httpErr(503, body)); script.push(httpErr(503, body));
  return raceCall(["hi", "SYS", 60, null, { noHistory: true, kind: "turn" }]).then(function (r) {
    if (r.sentinel) return "callGM never settled";
    if (r.ok) return "should have failed after exhausting retries";
    if (calls.length !== 1 + CALLGM_RETRY_MAX) return "expected " + (1 + CALLGM_RETRY_MAX) + " fetches, got " + calls.length;
    return r.e.message === "HTTP 503: The model is overloaded. Please try again later." ? true : "error shape drifted: " + r.e.message;
  });
});
tAsync("the retry toast fires ONCE per call, gameplay turns only (background kinds stay silent)", function () {
  reset(); fastKnobs();
  script.push(httpErr(503, "{}")); script.push(httpErr(529, "{}")); script.push(anthropicOk());
  return raceCall(["hi", "SYS", 60, null, { noHistory: true, kind: "turn" }]).then(function (r) {
    if (r.sentinel || !r.ok) return "turn call did not succeed";
    if (toasts.length !== 1) return "expected exactly 1 toast across 2 retries, got " + toasts.length + ": " + JSON.stringify(toasts);
    toasts.length = 0; calls.length = 0;
    script.push(httpErr(503, "{}")); script.push(anthropicOk());
    return raceCall(["hi", "SYS", 60, null, { noHistory: true, kind: "actions" }]).then(function (r2) {
      if (r2.sentinel || !r2.ok) return "actions call did not succeed";
      return toasts.length === 0 ? true : "a background (actions) retry toasted at the player: " + JSON.stringify(toasts);
    });
  });
});

section("#29 transport — what must NEVER retry");

tAsync("a B15 credit-exhaustion 429 (the OpenAI shape) is LOUD on the FIRST failure — zero retries", function () {
  reset("openai"); fastKnobs();
  script.push(httpErr(429, '{"error":{"message":"You exceeded your current quota, please check your plan and billing details."}}'));
  script.push(anthropicOk()); // must never be consumed
  return raceCall(["hi", "SYS", 60, null, { noHistory: true, kind: "turn" }]).then(function (r) {
    if (r.sentinel) return "callGM never settled";
    if (r.ok) return "a billing refusal was retried into a fake success";
    if (calls.length !== 1) return "a credit refusal was retried " + (calls.length - 1) + " time(s) — burned calls and a delayed billing toast";
    return r.e.message.indexOf("API credit exhausted — ") === 0 ? true : "credit contract lost: " + r.e.message;
  });
});
tAsync("a non-transient 400 is never retried and keeps its exact old shape", function () {
  reset(); fastKnobs();
  script.push(httpErr(400, '{"error":{"message":"messages.0.content: field required"}}'));
  return raceCall(["hi", "SYS", 60, null, { noHistory: true, kind: "turn" }]).then(function (r) {
    if (r.sentinel) return "callGM never settled";
    if (r.ok) return "a 400 should fail";
    if (calls.length !== 1) return "a 400 was retried — deterministic errors must stay loud on try one";
    return r.e.message === "HTTP 400: messages.0.content: field required" ? true : "shape drifted: " + r.e.message;
  });
});
tAsync("a network reject is never auto-retried (request state ambiguous — a retry could double-generate)", function () {
  reset(); fastKnobs();
  script.push(rejectWith("boom"));
  return raceCall(["hi", "SYS", 60, null, { noHistory: true, kind: "turn" }]).then(function (r) {
    if (r.sentinel) return "callGM never settled";
    if (r.ok) return "should have failed";
    if (calls.length !== 1) return "network reject was retried";
    return r.e.message === "Network: boom" ? true : "network shape drifted: " + r.e.message;
  });
});

section("#29 transport — the deadline (the t25 busy-freeze class)");

tAsync("a hung request aborts at CALLGM_TIMEOUT_MS: loud, terminal, NO auto-retry", function () {
  reset(); fastKnobs(); // CALLGM_TIMEOUT_MS=40 — the stub only rejects when OUR deadline aborts it
  script.push(hang());
  script.push(anthropicOk()); // must never be consumed
  return raceCall(["hi", "SYS", 60, null, { noHistory: true, kind: "turn" }]).then(function (r) {
    if (r.sentinel) return "callGM never settled — the #29 freeze is still shippable";
    if (r.ok) return "a hung request cannot succeed";
    if (calls.length !== 1) return "a timeout was auto-retried — the abandoned request may still complete and bill server-side";
    if (!/no response/i.test(r.e.message)) return "timeout message unrecognisable: " + r.e.message;
    // _attachGMErrorUI branches on the MESSAGE: auth-shaped → paste-a-key box (wrong remedy).
    return /invalid.{0,10}key|api.{0,6}key|authentication_error|401|permission_denied/i.test(r.e.message)
      ? "timeout message looks auth-shaped — the player would be told to paste a new key" : true;
  });
});
tAsync("a request that answers WITHIN the deadline is untouched by it", function () {
  reset(); CALLGM_RETRY_BASE_MS = 1; CALLGM_TIMEOUT_MS = 60000;
  script.push(anthropicOk("prompt reply"));
  return raceCall(["hi", "SYS", 60, null, { noHistory: true, kind: "turn" }]).then(function (r) {
    if (r.sentinel || !r.ok) return "an ordinary fast call failed under the deadline machinery";
    return r.v === "prompt reply" ? true : "wrong response: " + r.v;
  });
});

// ── report ───────────────────────────────────────────────────────────────────
chain.then(function () {
  if (fails.length) {
    console.error("#29 TRANSPORT TESTS FAILED (" + fails.length + " of " + (pass + fails.length) + "):");
    for (var f = 0; f < fails.length; f++) console.error("  ✗ " + fails[f]);
    process.exit(1);
  }
  console.log("ALL GREEN — " + pass + " assertions passed (#29 callGM transport)");
  process.exit(0);
});
