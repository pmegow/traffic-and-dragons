// tests-195-server-probe.js — TODO #195②: the server-TTS health probe must tolerate the cold
// boot it exists to trigger.
//
// Standalone battery (run-standalone-suites.js child process — its fetch/Date stubs must never
// contaminate the main engine suite). Run directly:
//   node dev/tests-195-server-probe.js
//
// The field evidence (2026-08-17): "availability re-check failed" skipped the server tier live
// while the Fly app was healthy. Mechanism: prewarmServer's single 8s deadline aborted while the
// auto-stopped machine it had JUST WOKEN was still booting, and the abort degraded the tier —
// the probe defeated its own purpose on exactly the machine it exists for. The contract now:
//   ① an ABORT (deadline) gets ONE patient retry on a cold-boot budget; the retry's success
//     leaves the tier available (no degrade);
//   ② the retry's failure degrades (deferral is not immortality);
//   ③ a NON-abort failure (HTTP status, refused) degrades immediately — no retry, it is a real
//     answer from a live machine;
//   ④ a degraded tier short-circuits the next prewarm (no fetch) until the retry window passes.

var fs = require("fs");
var path = require("path");
var root = path.join(__dirname, "..");
var files = require("./engine-manifest.js").map(function (entry) { return entry.file; });
var geval = eval;
for (var i = 0; i < files.length; i++) {
  try { geval(fs.readFileSync(path.join(root, files[i]), "utf8")); }
  catch (e) { console.error("ENGINE LOAD FAILED in " + files[i] + ": " + e.message); process.exit(1); }
}

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

// ── the server tier's gates: storageAdapter says "connected", clock is controllable ──────────
storageAdapter = {
  isServerMode: function () { return true; },
  hasToken: function () { return true; },
  authHeader: function () { return {}; }
};
var fakeNow = 1000000;
Date.now = function () { return fakeNow; };

// ── fetch stub: scripted responders; every call recorded ─────────────────────────────────────
var calls = [];
var script = [];   // each: function(url, opts) -> Promise
global.fetch = function (url, opts) {
  calls.push({ url: url, opts: opts });
  var responder = script.shift();
  if (!responder) return Promise.reject(new Error("unscripted fetch: " + url));
  return responder(url, opts);
};
function okResponse() { return Promise.resolve({ ok: true, status: 200 }); }
function hangUntilAborted(url, opts) {
  // never resolves on its own; rejects with AbortError when the probe's deadline fires
  return new Promise(function (resolve, reject) {
    if (opts && opts.signal) opts.signal.addEventListener("abort", function () {
      var e = new Error("This operation was aborted"); e.name = "AbortError"; reject(e);
    });
  });
}
function settle(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

section("#195② cold-boot-tolerant probe");
tAsync("① abort → one patient retry; retry success leaves the tier available", function () {
  calls.length = 0; script.length = 0;
  script.push(hangUntilAborted);                     // probe 1: deadline abort (machine booting)
  script.push(okResponse);                            // probe 2 (cold budget): machine is up
  TTS.prewarmServer({ probeMs: 20, coldMs: 40 });
  return settle(120).then(function () {
    if (calls.length !== 2) return "expected 2 probes (abort + retry), saw " + calls.length;
    // tier must still be available: a fresh prewarm fetches again
    script.push(okResponse);
    TTS.prewarmServer({ probeMs: 20, coldMs: 40 });
    return settle(30).then(function () {
      return calls.length === 3 ? true : "tier degraded despite the retry succeeding (" + calls.length + " calls)";
    });
  });
});
tAsync("② abort → retry also fails → degrade; the next prewarm short-circuits without fetching", function () {
  fakeNow += 120000;   // clear any residue window
  calls.length = 0; script.length = 0;
  script.push(hangUntilAborted);
  script.push(function () { return Promise.reject(new Error("connect ECONNREFUSED")); });
  TTS.prewarmServer({ probeMs: 20, coldMs: 40 });
  return settle(120).then(function () {
    if (calls.length !== 2) return "expected 2 probes, saw " + calls.length;
    TTS.prewarmServer({ probeMs: 20, coldMs: 40 });
    return settle(30).then(function () {
      return calls.length === 2 ? true : "degraded tier still probed — the memo is dead";
    });
  });
});
tAsync("③ a non-abort failure degrades immediately — no cold-boot retry for a real answer", function () {
  fakeNow += 120000;
  calls.length = 0; script.length = 0;
  script.push(function () { return Promise.resolve({ ok: false, status: 503 }); });
  TTS.prewarmServer({ probeMs: 20, coldMs: 40 });
  return settle(80).then(function () {
    if (calls.length !== 1) return "HTTP 503 got a retry it must not have (" + calls.length + " calls)";
    TTS.prewarmServer({ probeMs: 20, coldMs: 40 });
    return settle(30).then(function () {
      return calls.length === 1 ? true : "503 did not degrade the tier";
    });
  });
});
tAsync("④ the degrade window expires and the tier probes again", function () {
  fakeNow += 120000;   // beyond SERVER_TTS_RETRY_MS
  calls.length = 0; script.length = 0;
  script.push(okResponse);
  TTS.prewarmServer({ probeMs: 20, coldMs: 40 });
  return settle(30).then(function () {
    return calls.length === 1 ? true : "expired window did not re-enable the probe";
  });
});

chain.then(function () {
  if (fails.length) {
    console.error("FAILED (" + fails.length + " of " + (pass + fails.length) + "):");
    for (var i = 0; i < fails.length; i++) console.error("  ✗ " + fails[i]);
    process.exit(1);
  }
  console.log("ALL GREEN — " + pass + " assertions passed (#195② server probe)");
  process.exit(0);
});
