// tests-233-tts-body-deadlines.js — full-operation TTS deadlines.
// A response that delivers headers and then stalls its body must still abort and settle.
var engine = require("./load-engine.js");
engine.loadEngine();

var pass = 0, fails = [];
function tAsync(name, fn) {
  return Promise.resolve().then(fn).then(function (why) {
    if (!why) { pass++; console.log("PASS " + name); }
    else { fails.push(name + " — " + why); console.error("FAIL " + name + " — " + why); }
  }, function (e) {
    fails.push(name + " — threw: " + (e && e.message));
    console.error("FAIL " + name + " — threw: " + (e && e.stack || e));
  });
}

var realFetch = global.fetch;
var realSetTimeout = global.setTimeout;
var realClearTimeout = global.clearTimeout;

function abortError() { var e = new Error("aborted"); e.name = "AbortError"; return e; }
function stalledBodyResponse(opts, method) {
  var signal = opts && opts.signal;
  var response = { ok: true, status: 200 };
  response[method] = function () {
    return new Promise(function (resolve, reject) {
      if (signal && signal.aborted) { reject(abortError()); return; }
      if (signal) signal.addEventListener("abort", function () { reject(abortError()); }, { once: true });
    });
  };
  return Promise.resolve(response);
}
function acceleratedTimers() {
  global.setTimeout = function (fn, ms) { return realSetTimeout(fn, Math.min(ms, 15)); };
  global.clearTimeout = realClearTimeout;
}
function settleOrTimeout(p) {
  return Promise.race([p, new Promise(function (resolve) { realSetTimeout(function () { resolve({ probeTimedOut: true }); }, 250); })]);
}
function restore() { global.fetch = realFetch; global.setTimeout = realSetTimeout; global.clearTimeout = realClearTimeout; }

var chain = tAsync("Gemini deadline covers a stalled json() body", function () {
  acceleratedTimers();
  var aborts = 0;
  global.fetch = function (url, opts) {
    if (opts && opts.signal) opts.signal.addEventListener("abort", function () { aborts++; }, { once: true });
    return stalledBodyResponse(opts, "json");
  };
  TTS._gemini.modelReset();
  return settleOrTimeout(TTS._gemini.fetchGroup({ text: "Hold the road.", voice: "Charon" }, false, "key", "Read plainly.", null))
    .then(function (r) {
      restore();
      if (r && r.probeTimedOut) return "fetchGroup stayed pending after its accelerated deadline";
      if (!r || !/timeout/.test(String(r.fail || ""))) return "timeout cause not returned: " + JSON.stringify(r);
      if (!aborts) return "deadline settled without aborting the request";
      return "";
    });
}).then(function () {
  return tAsync("server deadline covers a stalled arrayBuffer() body", function () {
    if (!TTS._serverTest || typeof TTS._serverTest.fetchUnit !== "function") return "server fetch test seam is missing";
    acceleratedTimers();
    var aborts = 0;
    global.fetch = function (url, opts) {
      if (opts && opts.signal) opts.signal.addEventListener("abort", function () { aborts++; }, { once: true });
      return stalledBodyResponse(opts, "arrayBuffer");
    };
    return settleOrTimeout(TTS._serverTest.fetchUnit("Hold the road.", "amy", 1000)).then(function (r) {
      restore();
      if (r && r.probeTimedOut) return "server fetch stayed pending after its accelerated deadline";
      if (!r || !/timeout/.test(String(r.fail || ""))) return "timeout cause not returned: " + JSON.stringify(r);
      if (!aborts) return "deadline settled without aborting the request";
      return "";
    });
  });
}).then(function () {
  return tAsync("timeout handoffs preserve the unread remainder and resume the queue", function () {
    if (!TTS._speakerTest || typeof TTS._speakerTest.speakGeminiSrc !== "function") return "speaker queue-policy test seam is missing";
    var serverSrc = TTS._speakerTest.speakServerSrc();
    var geminiSrc = TTS._speakerTest.speakGeminiSrc();
    if (serverSrc.indexOf("_queue.unshift({ text: _remText, piper: true") < 0) return "server timeout policy does not preserve the unread remainder at the front of the queue";
    if (serverSrc.indexOf("if (handedOff) _drain()") < 0) return "server timeout handoff can leave playing state wedged instead of resuming the queue";
    if (geminiSrc.indexOf("_queue.unshift({ text: rem, piper: true") < 0) return "Gemini timeout policy does not preserve the unread remainder at the front of the queue";
    if (geminiSrc.indexOf("if (handedOff) { _auditionPhase(\"idle\"); _drain(); }") < 0) return "Gemini timeout handoff does not release busy state and resume the queue";
    return "";
  });
}).then(function () {
  restore();
  if (fails.length) { console.error("TTS BODY DEADLINE TESTS FAILED — " + fails.length + " failure(s)"); process.exit(1); }
  console.log("ALL GREEN — " + pass + " assertions passed (TTS body deadlines)");
});
