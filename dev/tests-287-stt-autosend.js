// tests-287-stt-autosend.js — TODO #287: the STT auto-send BEHAVIORAL battery.
//
// What this pins that no existing test does: the REAL route from a recognized final chunk to
// sendAction — sttCorrectNames → _applySendPolicy → (suspicion verdict) → sendAction — driven
// through BOTH surfaces that reach it:
//   • native  — a fake webkitSpeechRecognition instance whose onresult/onend we fire (stt.js
//               captures _Rec at module load, so the recognizer must exist BEFORE the eval)
//   • cloud   — STT._cloudTest.begin/upload, i.e. the real _cloudUpload → _cloudFinalize path
//               (the iPhone-Safari / Car Mode surface)
//
// Standalone battery — not loaded by run-tests.js or test.html. Run directly:
//   node dev/tests-287-stt-autosend.js
//
// ── POLICY FACTS THIS FILE PINS (measured, not assumed) ──────────────────────────────────────
// P1  The auto-send handoff is sendAction(null) — the CORRECTED text rides in #action-input,
//     never as an argument. Only the confirm-gate "yes" branch passes the string explicitly
//     (sendAction(pend.text)). Both shapes are asserted below; the effective text is resolved
//     the way game.js does it (override!==null ? override : inp.value.trim()), and that mirror
//     is pinned against game.js's own source so it cannot drift silently.
// P2  "a mica" → Ameiko (a bigram merge, score 2, halves that are not common words) is NOT
//     suspicious: it AUTO-SENDS. The confirm gate is not on this path — the corrected proper
//     noun goes straight to the GM turn.
// P3  A null confidence NEVER flags on its own: one low-score (<STT_FAR_EDIT_SC) unigram
//     correction with conf===null auto-sends. Raising the same utterance's confidence signal
//     to 0.2 DOES flag it — the signal is consulted, it simply cannot fire from absence.
// P4  STT is read-only over campaign state: a correction naming a split/remote party member
//     writes NOTHING to worldState/memory (no registration, no presence, no guestbook stamp).
// P5  The #77 confirm interceptor sits ABOVE both the busy-park and the rank-8 <3-char gate:
//     a spoken "no" (2 chars) while busy resolves the pending confirmation, discards it,
//     clears the field, sends nothing — and never reaches carVoiceCommand.
// ─────────────────────────────────────────────────────────────────────────────────────────────

var fs = require("fs");
var path = require("path");
var root = path.join(__dirname, "..");
var geval = eval;

// ── DOM / host stubs (the tests-234 set, extended for the confirm gate) ──────────────────────
var input = {
  value: "", style: {}, title: "", oninput: null,
  focus: function () {}, blur: function () {},
  classList: { add: function () {}, remove: function () {} }
};
global.window = { SpeechRecognition: null, webkitSpeechRecognition: null };
global.document = { getElementById: function (id) { return id === "action-input" ? input : null; } };
global.navigator = { mediaDevices: { getUserMedia: function () { return Promise.reject(new Error("not used")); } } };
global.MediaRecorder = function () {};

// Engine files stt.js + the battery genuinely depend on: sttCorrectNames / sttSuspicion /
// sttNameRoster / parseConfirmCommand / sttConfidence (helpers.js), STT_COMMON tables (helpers),
// and the globals.js declarations (busy, providerKeys, …). data.js rides between them the way
// index.html loads it. state.js and up are deliberately NOT loaded: worldState/memory are
// hand-built fixtures here so the P4 no-write snapshot has an exact, small subject.
["globals.js", "data.js", "helpers.js"].forEach(function (f) {
  try { geval(fs.readFileSync(path.join(root, f), "utf8")); }
  catch (e) { console.error("ENGINE LOAD FAILED in " + f + ": " + e.message); process.exit(1); }
});

global.providerKeys = { openai: "test-key" };
global.store = {
  get: function (k) { return k === "tnd_stt_autosend_v1" ? "1" : ""; },   // auto-send ON, confirm gate ON (unset !== "0")
  set: function () {}
};
global.eachMenuEl = function () {};
global.carMode = false;
global.busy = false;
global.showToast = function () {};
var carNotes = [];
global.carNotify = function (kind, text) { carNotes.push(kind + (text ? ":" + text : "")); };
var carCmdCalls = [];
global.carVoiceCommand = function (t) { carCmdCalls.push(t); return false; };

// The campaign fixture. Frizwick is a SPLIT party member (charSheet.splitLoc) — the P4 subject.
function freshState() {
  global.worldState = {
    turn: 42,
    character: { name: "Korrag" },
    npcs: [
      { name: "Ameiko Kaijitsu", partyMember: false },
      { name: "Frizwick", partyMember: true, charSheet: { name: "Frizwick", splitLoc: "Magnimar" } }
    ],
    world: { location: "Sandpoint", sublocation: null },
    questLog: []
  };
  global.memory = { npcs: {}, locations: {}, map: { nodes: {}, edges: [] } };
}
freshState();

// sendAction collector. The effective text is resolved EXACTLY the way game.js does it
// (contract-pinned below), so "what the GM turn would actually receive" is what we assert.
var sends = [];
global.sendAction = function (override) {
  sends.push({ arg: override, text: (override !== null && override !== undefined) ? override : input.value.trim() });
};

// ── Two STT instances: native (recognizer present) and cloud (recognizer absent) ─────────────
// stt.js captures _Rec once at module load, so each surface needs its own evaluation.
var lastRec = null;
function FakeRec() { lastRec = this; this.onresult = null; this.onerror = null; this.onend = null; }
FakeRec.prototype.start = function () {};
FakeRec.prototype.stop = function () {};
FakeRec.prototype.abort = function () {};

var sttSrc = fs.readFileSync(path.join(root, "stt.js"), "utf8");
global.window.webkitSpeechRecognition = FakeRec;
geval(sttSrc);
var STT_N = STT;                                   // native surface
global.window.webkitSpeechRecognition = null;
global.window.SpeechRecognition = null;
geval(sttSrc);
var STT_C = STT;                                   // cloud surface

// Drive ONE native utterance end to end: start → a single final result → onend → send policy.
function nativeUtter(text, confidence) {
  STT_N.start();
  var inst = lastRec;
  if (!inst || typeof inst.onresult !== "function" || typeof inst.onend !== "function") {
    throw new Error("native recognizer was never wired (onresult/onend missing)");
  }
  inst.onresult({
    resultIndex: 0,
    results: { length: 1, 0: { isFinal: true, length: 1, 0: { transcript: text, confidence: confidence } } }
  });
  inst.onend();
}

// Drive ONE cloud utterance end to end: begin a generation → real _cloudUpload → _cloudFinalize.
var realFetch = global.fetch;
function cloudUtter(text, logprobs, baseText) {
  var tok = STT_C._cloudTest.begin(baseText || "");
  global.fetch = function () {
    return Promise.resolve({
      ok: true, status: 200,
      json: function () { return Promise.resolve(logprobs ? { text: text, logprobs: logprobs } : { text: text }); }
    });
  };
  return STT_C._cloudTest.upload(new Blob(["audio"], { type: "audio/webm" }), "audio/webm", tok.generation, tok.baseText)
    .then(function (r) { global.fetch = realFetch; return r; },
          function (e) { global.fetch = realFetch; throw e; });
}

function resetRun() {
  sends = []; carNotes = []; carCmdCalls = [];
  input.value = ""; input.title = ""; input.oninput = null; input.style = {};
  global.carMode = false; global.busy = false;
  freshState();
}

// ── Reporter (tests-234 shape) ───────────────────────────────────────────────────────────────
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

var CORRECTED_A = "i ask Ameiko about the ledger";

var chain = Promise.resolve()

// ── (a) the g7 near-homophone: "a mica" → Ameiko, on the NATIVE path ────────────────────────
.then(function () {
  return test("native: 'a mica' is corrected to Ameiko and the corrected text is what reaches sendAction", function () {
    resetRun();
    nativeUtter("i ask a mica about the ledger", 0.9);
    if (sends.length !== 1) return "expected exactly one send, got " + sends.length + " (carNotes=" + carNotes.join("|") + ")";
    // POLICY (P1): the auto-send handoff is sendAction(null) — the text rides in the field.
    if (sends[0].arg !== null) return "auto-send should hand sendAction null (text rides in #action-input), got " + JSON.stringify(sends[0].arg);
    if (sends[0].text !== CORRECTED_A) return "effective text mismatch: " + JSON.stringify(sends[0].text);
    return "";
  });
})
.then(function () {
  return test("native: the corrected utterance is NOT held by the confirm gate (P2 — it auto-sends)", function () {
    // Same utterance, gate explicitly consulted: a bigram merge at score 2 whose halves are not
    // common words raises no reason, so the shipped policy sends without a read-back.
    var corr = [];
    var out = sttCorrectNames("i ask a mica about the ledger", sttNameRoster(worldState, memory), corr);
    if (out !== CORRECTED_A) return "correction drifted: " + JSON.stringify(out);
    if (corr.length !== 1 || !corr[0].bigram || corr[0].to !== "Ameiko") return "unexpected correction record: " + JSON.stringify(corr);
    var v = sttSuspicion(out, corr, 0.9, sttNameRoster(worldState, memory));
    if (v.suspicious) return "shipped policy changed — this utterance now flags: " + v.reasons.join(",");
    if (STT_N.isConfirmPending()) return "a confirmation was left pending after a clean auto-send";
    return "";
  });
})

// ── (b) null confidence + exactly one low-score correction → the AUTO-SEND route (cloud) ────
.then(function () {
  return test("cloud: null confidence + one low-score correction auto-sends (P3 — absence never flags)", function () {
    resetRun();
    return cloudUtter("i talk to korag", null, "").then(function () {
      if (sends.length !== 1) return "expected exactly one send, got " + sends.length + " (carNotes=" + carNotes.join("|") + ")";
      if (sends[0].arg !== null) return "auto-send should hand sendAction null, got " + JSON.stringify(sends[0].arg);
      if (sends[0].text !== "i talk to Korrag") return "effective text mismatch: " + JSON.stringify(sends[0].text);
      if (STT_C.isConfirmPending()) return "the confirm gate held a null-confidence utterance";
      return "";
    });
  });
})
.then(function () {
  return test("sttSuspicion: conf===null abstains, but the SAME correction at conf 0.2 flags low-confidence", function () {
    var corr = [{ from: "korag", to: "Korrag", sc: 1, bigram: false }];
    var roster = sttNameRoster(worldState, memory);
    var quiet = sttSuspicion("i talk to Korrag", corr, null, roster);
    if (quiet.suspicious) return "null confidence flagged on its own: " + quiet.reasons.join(",");
    var loud = sttSuspicion("i talk to Korrag", corr, 0.2, roster);
    if (!loud.suspicious || loud.reasons.indexOf("low-confidence") < 0) return "a real 0.2 confidence did not flag: " + JSON.stringify(loud);
    return "";
  });
})

// ── (c) a correction naming a SPLIT/REMOTE party member writes nothing to campaign state ────
.then(function () {
  return test("native: correcting to a split/remote party member auto-sends and writes NOTHING to worldState/memory (P4)", function () {
    resetRun();
    var wsBefore = JSON.stringify(worldState), memBefore = JSON.stringify(memory);
    nativeUtter("i wave at frizz wick", 0.9);
    if (sends.length !== 1) return "expected exactly one send, got " + sends.length;
    if (sends[0].arg !== null) return "auto-send should hand sendAction null, got " + JSON.stringify(sends[0].arg);
    if (sends[0].text !== "i wave at Frizwick") return "effective text mismatch: " + JSON.stringify(sends[0].text);
    if (JSON.stringify(worldState) !== wsBefore) return "STT mutated worldState — a name correction is not a presence/registration write";
    if (JSON.stringify(memory) !== memBefore) return "STT mutated memory — a name correction is not a presence/registration write";
    var fr = worldState.npcs[1];
    if (!fr.charSheet || fr.charSheet.splitLoc !== "Magnimar") return "the split marker was disturbed: " + JSON.stringify(fr.charSheet);
    if (memory.map.nodes.Sandpoint) return "a guestbook/node stamp appeared from a dictation correction";
    return "";
  });
})

// ── (d) a spoken "no" while Car Mode is BUSY — the interceptor outranks both gates (P5) ─────
.then(function () {
  return test("car mode: a suspicious utterance enters the confirm gate instead of sending", function () {
    resetRun();
    global.carMode = true;
    nativeUtter("i look for physics", 0.2);   // far-correction (physics→Frizwick) + low confidence
    if (sends.length !== 0) return "a suspicious utterance auto-sent: " + JSON.stringify(sends);
    if (!STT_N.isConfirmPending()) return "no confirmation was armed";
    if (input.value !== "") return "the pending text was left in the field (a stray tap would send it): " + JSON.stringify(input.value);
    return "";
  });
})
.then(function () {
  return test("car mode + busy: a spoken 'no' resolves the pending confirm ABOVE the busy-park and the <3-char gate", function () {
    if (!STT_N.isConfirmPending()) return "precondition lost — nothing was pending";
    global.busy = true;                        // the busy-park would swallow this if it ran first
    sends = []; carCmdCalls = []; carNotes = [];
    nativeUtter("no", 0.95);                   // 2 chars — the rank-8 gate would eat it if it ran first
    if (STT_N.isConfirmPending()) return "the confirmation is STILL pending — the interceptor ran below the busy-park or the short-transcript gate";
    if (sends.length !== 0) return "a discarded confirmation sent anyway: " + JSON.stringify(sends);
    if (input.value !== "") return "the field was not cleared after the discard: " + JSON.stringify(input.value);
    if (carCmdCalls.length !== 0) return "carVoiceCommand saw the confirm answer — the interceptor ran below it: " + carCmdCalls.join("|");
    return "";
  });
})
.then(function () {
  return test("parseConfirmCommand: 'no' discards, 'yes' confirms — the vocabulary the interceptor routes on", function () {
    if (parseConfirmCommand("no") !== "no") return "'no' no longer parses as a discard";
    if (parseConfirmCommand("yes") !== "yes") return "'yes' no longer parses as a confirm";
    if (parseConfirmCommand("no time to lose") !== null) return "an ACTION was claimed by the confirm vocabulary";
    return "";
  });
})
.then(function () {
  return test("car mode: a confirmed 'yes' hands the pending text to sendAction EXPLICITLY (the one non-null shape)", function () {
    resetRun();
    global.carMode = true;
    nativeUtter("i look for physics", 0.2);
    if (!STT_N.isConfirmPending()) return "no confirmation was armed";
    global.busy = false;
    sends = [];
    nativeUtter("yes", 0.95);
    if (sends.length !== 1) return "the confirmed utterance did not send: " + JSON.stringify(sends);
    if (sends[0].arg !== "i look for Frizwick") return "the confirmed send must carry the pending text as its argument, got " + JSON.stringify(sends[0].arg);
    if (STT_N.isConfirmPending()) return "the confirmation stayed pending after a yes";
    return "";
  });
})

// ── (e) the RAG query entity: the corrected proper noun is what the turn's retrieval sees ───
.then(function () {
  return test("the corrected proper noun is the entity that reaches the RAG query (via lastAction)", function () {
    resetRun();
    nativeUtter("i ask a mica about the ledger", 0.9);
    if (sends.length !== 1) return "expected exactly one send, got " + sends.length;
    var txt = sends[0].text;
    if (txt.indexOf("Ameiko") < 0) return "the roster entity is absent from the text handed to sendAction: " + JSON.stringify(txt);
    if (/\ba mica\b/i.test(txt)) return "the raw homophone survived into the turn input: " + JSON.stringify(txt);
    // The chain the assertion above stands on, pinned against the shipped sources so this
    // mirror can never drift silently: sendAction(null) resolves the field → lastAction → ragRetrieve.
    var gameSrc = fs.readFileSync(path.join(root, "game.js"), "utf8");
    var apiSrc = fs.readFileSync(path.join(root, "api.js"), "utf8");
    if (gameSrc.indexOf("var txt=override!==null?override:inp.value.trim();") < 0)
      return "sendAction no longer resolves a null override from #action-input — this battery's text mirror is stale";
    if (gameSrc.indexOf("if(!isTT)lastAction=txt;") < 0)
      return "sendAction no longer stamps lastAction from the sent text — the RAG entity chain moved";
    if (apiSrc.indexOf("ragRetrieve(typeof lastAction===\"string\"&&lastAction?lastAction:\"\")") < 0)
      return "buildSysPrompt no longer feeds lastAction to ragRetrieve — the RAG entity chain moved";
    return "";
  });
})

// ── the shipped ordering, read as source (the clause the behavioral tests above exercise) ───
.then(function () {
  return test("source: the confirm interceptor precedes carVoiceCommand, the busy-park and the <3-char gate in _applySendPolicy", function () {
    var iConfirm = sttSrc.indexOf("if (_confirmPending && _gotFinal && text) { _resolveConfirm(text, el); return; }");
    var iCar = sttSrc.indexOf("carVoiceCommand(text)");
    var iBusy = sttSrc.indexOf("if (isBusy) {");
    var iShort = sttSrc.indexOf("if (carModeOn && text.length < 3)");
    if (iConfirm < 0) return "the #77 confirm interceptor line is gone from _applySendPolicy";
    if (iCar < 0 || iBusy < 0 || iShort < 0) return "an expected gate is missing (car=" + iCar + " busy=" + iBusy + " short=" + iShort + ")";
    if (!(iConfirm < iCar && iConfirm < iBusy && iConfirm < iShort)) return "ordering broken: confirm=" + iConfirm + " car=" + iCar + " busy=" + iBusy + " short=" + iShort;
    return "";
  });
})

.then(function () {
  global.fetch = realFetch;
  if (fails.length) {
    console.error("\nSTT AUTO-SEND BATTERY FAILED — " + fails.length + " failure(s)");
    fails.forEach(function (f) { console.error("  ✗ " + f); });
    process.exit(1);
  }
  console.log("ALL GREEN — " + pass + " assertions passed (#287 STT auto-send battery)");
});

chain["catch"](function (e) {
  console.error("STT AUTO-SEND BATTERY CRASHED — " + (e && e.stack || e));
  process.exit(1);
});
