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
function geminiOk(text) {
  return respond(200, true, JSON.stringify({ candidates: [{ content: { parts: [{ text: text || "Hello" }] }, finishReason: "STOP" }], usageMetadata: { promptTokenCount: 100, candidatesTokenCount: 10 } }));
}
function openaiOk(text) {
  return respond(200, true, JSON.stringify({ choices: [{ message: { content: text || "Hello" }, finish_reason: "stop" }], usage: { prompt_tokens: 100, completion_tokens: 10 } }));
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

section("#29b transport — the in-family fallback rung (the gemini 503-storm class)");

var GEMINI_503 = '{"error":{"message":"The model is overloaded. Please try again later."}}';

tAsync("a storm that exhausts the primary falls ONCE to prov.fallbackModel and the turn SUCCEEDS", function () {
  reset("gemini"); fastKnobs();
  script.push(httpErr(503, GEMINI_503)); script.push(httpErr(503, GEMINI_503)); script.push(httpErr(503, GEMINI_503));
  script.push(geminiOk("Through the storm"));
  return raceCall(["hi", "SYS", 60, null, { noHistory: true, kind: "turn" }]).then(function (r) {
    if (r.sentinel) return "callGM never settled";
    if (!r.ok) return "turn still failed: " + r.e.message;
    if (r.v !== "Through the storm") return "wrong response: " + r.v;
    if (calls.length !== 4) return "expected 4 fetches (1 + " + CALLGM_RETRY_MAX + " retries on primary, 1 rung), got " + calls.length;
    if (calls[2].url.indexOf("gemini-3.7-flash") < 0) return "primary attempts left gemini-3.7-flash: " + calls[2].url;
    if (calls[3].url.indexOf("gemini-3.6-flash") < 0) return "rung attempt did not target gemini-3.6-flash: " + calls[3].url;
    // Gemini's model rides ONLY in the URL — the rebuilt payload must stay byte-identical.
    return calls[0].opts.body === calls[3].opts.body ? true : "rung payload drifted from the primary's body";
  });
});
tAsync("the rung is PER-CALL — the very next call probes the primary again (voice continuity, never sticky)", function () {
  reset("gemini"); fastKnobs();
  script.push(httpErr(503, GEMINI_503)); script.push(httpErr(503, GEMINI_503)); script.push(httpErr(503, GEMINI_503));
  script.push(geminiOk("fell"));
  return raceCall(["hi", "SYS", 60, null, { noHistory: true, kind: "turn" }]).then(function (r) {
    if (r.sentinel || !r.ok) return "the falling call did not succeed";
    calls.length = 0; script.push(geminiOk("back on the primary"));
    return raceCall(["hi again", "SYS", 60, null, { noHistory: true, kind: "turn" }]).then(function (r2) {
      if (r2.sentinel || !r2.ok) return "the follow-up call failed";
      if (calls.length !== 1) return "follow-up took " + calls.length + " fetches";
      return calls[0].url.indexOf("gemini-3.7-flash") >= 0 ? true : "a memo stuck — the next call started on " + calls[0].url;
    });
  });
});
tAsync("a rung that ALSO fails stays bounded — exactly one rung attempt, then the loud old error shape", function () {
  reset("gemini"); fastKnobs();
  script.push(httpErr(503, GEMINI_503)); script.push(httpErr(503, GEMINI_503)); script.push(httpErr(503, GEMINI_503));
  script.push(httpErr(503, GEMINI_503)); script.push(geminiOk()); // the Ok must never be consumed
  return raceCall(["hi", "SYS", 60, null, { noHistory: true, kind: "turn" }]).then(function (r) {
    if (r.sentinel) return "callGM never settled";
    if (r.ok) return "should have failed after the rung failed too";
    if (calls.length !== 4) return "expected 4 fetches (rung tried once, never retried), got " + calls.length;
    return r.e.message === "HTTP 503: The model is overloaded. Please try again later." ? true : "error shape drifted: " + r.e.message;
  });
});
tAsync("no self-fall: a call already ON the fallback model never re-enters the rung", function () {
  reset("gemini"); fastKnobs();
  script.push(httpErr(503, GEMINI_503)); script.push(httpErr(503, GEMINI_503)); script.push(httpErr(503, GEMINI_503));
  script.push(geminiOk()); // must never be consumed
  return raceCall(["hi", "SYS", 60, "gemini-3.6-flash", { noHistory: true, kind: "turn" }]).then(function (r) {
    if (r.sentinel) return "callGM never settled";
    if (r.ok) return "should have failed — the rung has nowhere to fall";
    return calls.length === 3 ? true : "expected 3 fetches (no self-fall), got " + calls.length;
  });
});
tAsync("#45 attribution: a gameplay-turn fall re-stamps _lastTurnModel to the model that actually wrote the turn", function () {
  reset("gemini"); fastKnobs();
  // A real gameplay turn (no sysOverride) — buildSysPrompt stubbed like showToast is, so the
  // battery's minimal worldState never has to satisfy the full prompt builder.
  var _origBSP = buildSysPrompt; buildSysPrompt = function () { return { stable: "S", volatile: "V" }; };
  script.push(httpErr(503, GEMINI_503)); script.push(httpErr(503, GEMINI_503)); script.push(httpErr(503, GEMINI_503));
  script.push(geminiOk());
  return raceCall(["hi", null, 60, null, { noHistory: true, kind: "turn" }]).then(function (r) {
    buildSysPrompt = _origBSP;
    if (r.sentinel || !r.ok) return "gameplay call did not succeed" + (r.e ? ": " + r.e.message : "");
    return _lastTurnModel === "gemini-3.6-flash" ? true : "_lastTurnModel=" + _lastTurnModel + " — the transcript would credit the primary for a turn the fallback wrote";
  });
});
tAsync("a sysOverride (utility) fall never touches _lastTurnModel — attribution is gameplay-only", function () {
  reset("gemini"); fastKnobs();
  _lastTurnModel = "SENTINEL";
  script.push(httpErr(503, GEMINI_503)); script.push(httpErr(503, GEMINI_503)); script.push(httpErr(503, GEMINI_503));
  script.push(geminiOk());
  return raceCall(["hi", "SYS", 60, null, { noHistory: true, kind: "actions" }]).then(function (r) {
    if (r.sentinel || !r.ok) return "utility call did not succeed";
    return _lastTurnModel === "SENTINEL" ? true : "a utility call clobbered _lastTurnModel: " + _lastTurnModel;
  });
});
tAsync("the fall is LOUD on gameplay turns (second toast names the fallback) and silent for background kinds", function () {
  reset("gemini"); fastKnobs();
  script.push(httpErr(503, GEMINI_503)); script.push(httpErr(503, GEMINI_503)); script.push(httpErr(503, GEMINI_503));
  script.push(geminiOk());
  return raceCall(["hi", "SYS", 60, null, { noHistory: true, kind: "turn" }]).then(function (r) {
    if (r.sentinel || !r.ok) return "turn call did not succeed";
    if (toasts.length !== 2) return "expected retry toast + fall toast, got " + toasts.length + ": " + JSON.stringify(toasts);
    if (toasts[1].indexOf("gemini-3.6-flash") < 0) return "the fall toast does not name the fallback model: " + toasts[1];
    toasts.length = 0; calls.length = 0;
    script.push(httpErr(503, GEMINI_503)); script.push(httpErr(503, GEMINI_503)); script.push(httpErr(503, GEMINI_503));
    script.push(geminiOk());
    return raceCall(["hi", "SYS", 60, null, { noHistory: true, kind: "actions" }]).then(function (r2) {
      if (r2.sentinel || !r2.ok) return "actions call did not succeed";
      return toasts.length === 0 ? true : "a background (actions) fall toasted at the player: " + JSON.stringify(toasts);
    });
  });
});
tAsync("a credit-shaped 429 on the rung's provider is terminal BEFORE any retry or fall (B15 outranks #29b)", function () {
  reset("gemini"); fastKnobs();
  script.push(httpErr(429, '{"error":{"message":"You exceeded your current quota, please check your plan and billing details."}}'));
  script.push(geminiOk()); // must never be consumed
  return raceCall(["hi", "SYS", 60, null, { noHistory: true, kind: "turn" }]).then(function (r) {
    if (r.sentinel) return "callGM never settled";
    if (r.ok) return "a billing refusal fell to a second model — that would bill a second refusal";
    if (calls.length !== 1) return "a credit refusal was retried/fallen " + (calls.length - 1) + " time(s)";
    return r.e.message.indexOf("API credit exhausted — ") === 0 ? true : "credit contract lost: " + r.e.message;
  });
});
tAsync("the OpenAI rung REBUILDS the body for the fallback model — sol falls to luna with the model field and gpt-5* token param intact", function () {
  reset("openai"); fastKnobs();
  var b = '{"error":{"message":"The server is overloaded."}}';
  script.push(httpErr(503, b)); script.push(httpErr(503, b)); script.push(httpErr(503, b));
  script.push(openaiOk("Luna answers"));
  return raceCall(["hi", "SYS", 60, null, { noHistory: true, kind: "turn" }]).then(function (r) {
    if (r.sentinel) return "callGM never settled";
    if (!r.ok) return "turn still failed: " + r.e.message;
    if (r.v !== "Luna answers") return "wrong response: " + r.v;
    if (calls.length !== 4) return "expected 4 fetches, got " + calls.length;
    var first = JSON.parse(calls[0].opts.body), last = JSON.parse(calls[3].opts.body);
    if (first.model !== "gpt-5.6-sol") return "primary body model drifted: " + first.model;
    if (last.model !== "gpt-5.6-luna") return "rung body still carries the primary — for OpenAI the model rides IN THE BODY and must be rebuilt: " + last.model;
    if (!("max_completion_tokens" in last)) return "rebuilt body lost max_completion_tokens — gpt-5* rejects max_tokens and the rung would 400";
    return true;
  });
});
tAsync("a deadline abort NEVER reaches the rung (the abandoned request may still bill server-side)", function () {
  reset("gemini"); fastKnobs();
  script.push(hang());
  script.push(geminiOk()); // must never be consumed
  return raceCall(["hi", "SYS", 60, null, { noHistory: true, kind: "turn" }]).then(function (r) {
    if (r.sentinel) return "callGM never settled";
    if (r.ok) return "a hung request cannot succeed";
    return calls.length === 1 ? true : "a timeout was retried or fallen — double-generation hazard";
  });
});

// ── §3 gateway: the account-mode transport seam (v1.753) ─────────────────────
// gmTransport swaps ONLY url + auth headers; the vendor-shaped body must be byte-identical
// either way (the prompt-cache guarantee the whole gateway design rests on), and gateway
// account refusals (402/401) must be terminal, unretried, and never auth-shaped.
section("§3 server routing seam");

var AUTH_SHAPE_RE = /invalid.{0,10}key|api.{0,6}key|authentication_error|401|permission_denied/i; // _attachGMErrorUI's exact gate
function serverOn(acct) {
  storageAdapter.setServer("https://tnd.test", "tok-SESSION");
  serverAccount = (acct === undefined) ? { entitled: true, tier: "beta" } : acct;
  gmRouting = "auto";
}
function serverOff() {
  storageAdapter.setServer(null, null);
  serverAccount = null;
  gmRouting = "auto";
}

tAsync("entitled account routes to the gateway: URL, Bearer + kind headers, NO vendor key", function () {
  reset(); fastKnobs(); serverOn();
  script.push(anthropicOk("Via the gateway"));
  return raceCall(["hi", "SYS", 60, null, { noHistory: true, kind: "turn" }]).then(function (r) {
    serverOff();
    if (r.sentinel || !r.ok) return "call did not succeed: " + (r.e && r.e.message);
    var c = calls[0];
    if (c.url !== "https://tnd.test/api/llm/anthropic/claude-sonnet-5") return "wrong gateway URL: " + c.url;
    var h = c.opts.headers || {};
    if (h["Authorization"] !== "Bearer tok-SESSION") return "session Bearer header missing";
    if (h["X-TND-Kind"] !== "turn") return "X-TND-Kind header missing";
    return ("x-api-key" in h) ? "vendor key leaked into a gateway request" : true;
  });
});
tAsync("the request BODY is byte-identical between BYOK and gateway routing (prompt-cache safety)", function () {
  reset(); fastKnobs();
  script.push(anthropicOk());
  return raceCall(["hi", "SYS", 60, null, { noHistory: true, kind: "turn" }]).then(function (r1) {
    if (r1.sentinel || !r1.ok) return "BYOK call failed";
    var byokBody = calls[0].opts.body;
    calls.length = 0; script.push(anthropicOk()); serverOn();
    return raceCall(["hi", "SYS", 60, null, { noHistory: true, kind: "turn" }]).then(function (r2) {
      serverOff();
      if (r2.sentinel || !r2.ok) return "gateway call failed";
      return calls[0].opts.body === byokBody ? true : "body differs between routes — the gateway would re-key every provider prompt cache";
    });
  });
});
tAsync("gmRouting 'byok' forces the vendor path even while entitled", function () {
  reset(); fastKnobs(); serverOn(); gmRouting = "byok";
  script.push(anthropicOk());
  return raceCall(["hi", "SYS", 60, null, { noHistory: true, kind: "turn" }]).then(function (r) {
    serverOff();
    if (r.sentinel || !r.ok) return "call did not succeed";
    return calls[0].url.indexOf("api.anthropic.com") >= 0 ? true : "byok opt-out ignored: " + calls[0].url;
  });
});
tAsync("known-unentitled account falls back to the vendor path (a sync-only BYOK player keeps their keys)", function () {
  reset(); fastKnobs(); serverOn({ entitled: false, reason: "none" });
  script.push(anthropicOk());
  return raceCall(["hi", "SYS", 60, null, { noHistory: true, kind: "turn" }]).then(function (r) {
    serverOff();
    if (r.sentinel || !r.ok) return "call did not succeed";
    return calls[0].url.indexOf("api.anthropic.com") >= 0 ? true : "unentitled account was routed to the gateway: " + calls[0].url;
  });
});
tAsync("account unknown yet: own key wins; keyless rides the gateway", function () {
  reset(); fastKnobs(); serverOn(null); // connected, account not fetched
  script.push(anthropicOk());
  return raceCall(["hi", "SYS", 60, null, { noHistory: true, kind: "turn" }]).then(function (r) {
    if (r.sentinel || !r.ok) return "keyed call did not succeed";
    if (calls[0].url.indexOf("api.anthropic.com") < 0) return "own-key player pre-fetch was routed to the gateway";
    calls.length = 0; providerKeys = {}; apiKey = ""; script.push(anthropicOk());
    return raceCall(["hi", "SYS", 60, null, { noHistory: true, kind: "turn" }]).then(function (r2) {
      serverOff();
      if (r2.sentinel || !r2.ok) return "keyless call did not succeed";
      return calls[0].url.indexOf("https://tnd.test/api/llm/") === 0 ? true : "keyless connected player did not ride the gateway: " + calls[0].url;
    });
  });
});
tAsync("gateway 402 is terminal, unretried, toasted, and NEVER auth-shaped", function () {
  reset(); fastKnobs(); serverOn();
  script.push(httpErr(402, '{"error":"subscription","reason":"out_of_turns","used":250,"cap":250}'));
  script.push(anthropicOk()); // must never be consumed
  return raceCall(["hi", "SYS", 60, null, { noHistory: true, kind: "turn" }]).then(function (r) {
    serverOff();
    if (r.sentinel) return "callGM never settled";
    if (r.ok) return "a 402 cannot succeed";
    // The refusal path fires a fetchAccount refresh (also recorded by the stub) — count LLM calls only.
    var llm = calls.filter(function (c) { return c.url.indexOf("/api/llm/") >= 0; });
    if (llm.length !== 1) return "a 402 was retried (" + llm.length + " LLM fetches) — account states are not storms";
    if (r.e.message.indexOf("250") < 0) return "out-of-turns message lost the cap: " + r.e.message;
    if (AUTH_SHAPE_RE.test(r.e.message)) return "402 message is auth-shaped — _attachGMErrorUI would offer the paste-a-key box: " + r.e.message;
    return toasts.length >= 1 ? true : "no toast for the subscription refusal (silent failure)";
  });
});
tAsync("gateway 402 lapsed/none get their own honest messages", function () {
  reset(); fastKnobs(); serverOn();
  script.push(httpErr(402, '{"error":"subscription","reason":"lapsed"}'));
  return raceCall(["hi", "SYS", 60, null, { noHistory: true, kind: "turn" }]).then(function (r) {
    if (r.ok || r.sentinel) return "lapsed call must fail";
    if (!/lapsed/i.test(r.e.message) || !/story is safe/i.test(r.e.message)) return "lapsed message drifted: " + r.e.message;
    calls.length = 0; script.push(httpErr(402, '{"error":"subscription","reason":"none"}'));
    return raceCall(["hi", "SYS", 60, null, { noHistory: true, kind: "turn" }]).then(function (r2) {
      serverOff();
      if (r2.ok || r2.sentinel) return "no-subscription call must fail";
      if (!/no active subscription/i.test(r2.e.message)) return "none message drifted: " + r2.e.message;
      return AUTH_SHAPE_RE.test(r2.e.message) ? "none message is auth-shaped: " + r2.e.message : true;
    });
  });
});
tAsync("gateway 401 (expired session) is terminal and never auth-shaped (no paste-a-key box)", function () {
  reset(); fastKnobs(); serverOn();
  script.push(httpErr(401, '{"error":"Not logged in"}'));
  return raceCall(["hi", "SYS", 60, null, { noHistory: true, kind: "turn" }]).then(function (r) {
    serverOff();
    if (r.sentinel) return "callGM never settled";
    if (r.ok) return "a 401 cannot succeed";
    if (calls.filter(function (c) { return c.url.indexOf("/api/llm/") >= 0; }).length !== 1) return "a 401 was retried";
    if (AUTH_SHAPE_RE.test(r.e.message)) return "401 message is auth-shaped — the paste-a-key box is the wrong remedy in account mode: " + r.e.message;
    return /sign-in|connect/i.test(r.e.message) ? true : "message does not point at re-connecting: " + r.e.message;
  });
});
tAsync("vendor 401 in BYOK mode still reaches the auth-shaped path (the paste-a-key box is CORRECT there)", function () {
  reset(); fastKnobs(); serverOff();
  script.push(httpErr(401, '{"error":{"type":"authentication_error","message":"invalid x-api-key"}}'));
  return raceCall(["hi", "SYS", 60, null, { noHistory: true, kind: "turn" }]).then(function (r) {
    if (r.sentinel) return "callGM never settled";
    if (r.ok) return "a 401 cannot succeed";
    return AUTH_SHAPE_RE.test(r.e.message) ? true : "BYOK vendor 401 lost its auth shape — the paste-a-key remedy disappears: " + r.e.message;
  });
});
tAsync("the #29b rung rides the gateway too: fallback URL is /api/llm/openai/gpt-5.6-luna", function () {
  reset("openai"); fastKnobs(); serverOn();
  script.push(httpErr(503, "{}")); script.push(httpErr(503, "{}")); script.push(httpErr(503, "{}"));
  script.push(openaiOk("Luna answers"));
  return raceCall(["hi", "SYS", 60, null, { noHistory: true, kind: "turn" }]).then(function (r) {
    serverOff();
    if (r.sentinel) return "callGM never settled";
    if (!r.ok) return "rung call failed: " + r.e.message;
    var last = calls[calls.length - 1];
    if (last.url !== "https://tnd.test/api/llm/openai/gpt-5.6-luna") return "rung left the gateway: " + last.url;
    return JSON.parse(last.opts.body).model === "gpt-5.6-luna" ? true : "rebuilt body model did not follow the rung";
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
