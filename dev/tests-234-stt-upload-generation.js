// tests-234-stt-upload-generation.js — STT full upload deadline + stale-generation refusal.
var fs = require("fs");
var path = require("path");
var root = path.join(__dirname, "..");

var input = { value: "", style: {}, title: "", focus: function () {}, blur: function () {}, classList: { add: function () {}, remove: function () {} } };
global.window = { SpeechRecognition: null, webkitSpeechRecognition: null };
global.document = { getElementById: function (id) { return id === "action-input" ? input : null; } };
global.navigator = { mediaDevices: { getUserMedia: function () { return Promise.reject(new Error("not used")); } } };
global.MediaRecorder = function () {};
global.providerKeys = { openai: "test-key" };
global.store = {
  get: function (k) { return k === "tnd_stt_autosend_v1" ? "1" : ""; },
  set: function () {}
};
global.eachMenuEl = function () {};
global.carMode = false;
global.busy = false;
var sends = [];
global.sendAction = function (v) { sends.push(v); };
global.showToast = function () {};
global.carNotify = function () {};

var geval = eval;
geval(fs.readFileSync(path.join(root, "stt.js"), "utf8"));

var pass = 0, fails = [];
function test(name, fn) {
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
function deferred() { var d = {}; d.promise = new Promise(function (resolve, reject) { d.resolve = resolve; d.reject = reject; }); return d; }
function restore() { global.fetch = realFetch; global.setTimeout = realSetTimeout; global.clearTimeout = realClearTimeout; }

var chain = test("STT deadline covers a stalled response json() body", function () {
  if (!STT._cloudTest || typeof STT._cloudTest.transcribeOnce !== "function") return "cloud upload test seam is missing";
  global.setTimeout = function (fn, ms) { return realSetTimeout(fn, Math.min(ms, 15)); };
  global.clearTimeout = realClearTimeout;
  var aborted = false;
  global.fetch = function (url, opts) {
    if (opts.signal) opts.signal.addEventListener("abort", function () { aborted = true; }, { once: true });
    return Promise.resolve({ ok: true, status: 200, json: function () {
      return new Promise(function (resolve, reject) {
        if (opts.signal && opts.signal.aborted) { reject(abortError()); return; }
        if (opts.signal) opts.signal.addEventListener("abort", function () { reject(abortError()); }, { once: true });
      });
    } });
  };
  return Promise.race([
    STT._cloudTest.transcribeOnce(new Blob(["x"], { type: "audio/webm" }), "webm", "key", "gpt-4o-mini-transcribe")
      .then(function () { return "request unexpectedly resolved"; }, function (e) { return /timeout/.test(String(e && e.message)) ? "" : "wrong failure: " + (e && e.message); }),
    new Promise(function (resolve) { realSetTimeout(function () { resolve("request stayed pending after its accelerated deadline"); }, 250); })
  ]).then(function (why) { restore(); return why || (aborted ? "" : "deadline rejected without aborting the request"); });
}).then(function () {
  return test("an older recording completion cannot overwrite or auto-send a newer generation", function () {
    if (!STT._cloudTest || typeof STT._cloudTest.begin !== "function" || typeof STT._cloudTest.upload !== "function") return "cloud generation test seam is missing";
    sends = []; input.value = "";
    var firstBody = deferred(), secondBody = deferred(), bodies = [firstBody, secondBody];
    global.fetch = function () {
      var body = bodies.shift();
      return Promise.resolve({ ok: true, status: 200, json: function () { return body.promise; } });
    };
    var first = STT._cloudTest.begin("first ");
    var p1 = STT._cloudTest.upload(new Blob(["one"]), "audio/webm", first.generation, first.baseText);
    var second = STT._cloudTest.begin("second ");
    var p2 = STT._cloudTest.upload(new Blob(["two"]), "audio/webm", second.generation, second.baseText);
    secondBody.resolve({ text: "new" });
    return p2.then(function () {
      if (input.value !== "second new" || sends.length !== 1) return "newer result did not own the field/send: value=" + input.value + " sends=" + sends.length;
      firstBody.resolve({ text: "old" });
      return p1.then(function () {
        restore();
        if (input.value !== "second new") return "stale completion overwrote the newer field: " + input.value;
        if (sends.length !== 1) return "stale completion auto-sent: sends=" + sends.length;
        return "";
      });
    });
  });
}).then(function () {
  restore();
  if (fails.length) { console.error("STT UPLOAD/GENERATION TESTS FAILED — " + fails.length + " failure(s)"); process.exit(1); }
  console.log("ALL GREEN — " + pass + " assertions passed (STT upload deadline/generation)");
});
