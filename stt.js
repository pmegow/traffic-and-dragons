// stt.js — Speech-to-text input via the Web Speech API (zero-dependency).
// Foundation for Car Mode (#5/#19): dictate an action into the input field hands-light.
// Depends on: showToast (ui.js). No API key, no network — browser-native recognition.
//
// Support: Chrome/Edge desktop + Android Chrome (webkitSpeechRecognition). NOT Firefox.
// iOS Safari support is partial/flaky. isSupported() gates the UI so the mic button
// only appears where recognition actually works.

var STT = (function() {

  var LANG_K = "tnd_stt_lang_v1";
  var AUTO_K = "tnd_stt_autosend_v1";

  var _Rec       = window.SpeechRecognition || window.webkitSpeechRecognition || null;
  var _rec       = null;   // live recognition instance (one at a time)
  var _listening = false;
  var _baseText  = "";     // input value captured when listening started (dictation appends)
  var _gotFinal  = false;  // did this session yield a final transcript? (gates auto-send)
  var _onState   = null;   // external listen-state subscriber (Car Mode) — the TTS.setOnDone pattern

  function isSupported()  { return !!_Rec; }
  function getLang()      { return store.get(LANG_K) || "en-US"; }
  function isAutoSend()   { return store.get(AUTO_K) === "1"; }
  function setAutoSend(on){ store.set(AUTO_K, on ? "1" : ""); _syncAutoCbs(); }

  // ── Toggle ───────────────────────────────────────────────────────────────────

  function toggle() {
    if (!isSupported()) {
      if (typeof showToast === "function") showToast("Voice input isn't supported in this browser. Try Chrome or Edge.");
      return;
    }
    if (_listening) { stop(); } else { start(); }
  }

  function start() {
    if (_listening) return;
    var inp = document.getElementById("userinput");
    if (!inp) return;

    try {
      _rec = new _Rec();
    } catch(e) {
      if (typeof showToast === "function") showToast("Couldn't start voice input.");
      return;
    }

    _rec.lang           = getLang();
    _rec.continuous     = false;   // single utterance; ends on natural pause
    _rec.interimResults = true;    // stream partial transcript into the field live
    _rec.maxAlternatives = 1;

    // Append dictation to whatever is already typed (preserve a trailing space)
    _baseText = inp.value ? (inp.value.replace(/\s+$/, "") + " ") : "";
    _gotFinal = false;

    // Name correction (v1.330 — "Frizwick becomes Physics"): the recognizer snaps fantasy names
    // to its own vocabulary; we hold the campaign's canonical roster and phonetically restore
    // them (sttCorrectNames, helpers.js — battery-tested). Roster snapshotted once per
    // dictation session; applied to FINAL chunks only (interims stay raw/live). The corrected
    // text lands in the input box, so a wrong substitution is visible and editable before send.
    var _roster = (typeof sttNameRoster === "function" && typeof worldState !== "undefined")
      ? sttNameRoster(worldState, (typeof memory !== "undefined") ? memory : null) : [];

    _rec.onresult = function(ev) {
      var finalTxt = "", interimTxt = "";
      for (var i = ev.resultIndex; i < ev.results.length; i++) {
        var r = ev.results[i];
        if (r.isFinal) finalTxt += r[0].transcript;
        else           interimTxt += r[0].transcript;
      }
      // Persist finals into the base so they survive the next result event
      if (finalTxt) {
        if (_roster.length && typeof sttCorrectNames === "function") finalTxt = sttCorrectNames(finalTxt, _roster);
        _baseText = _baseText + finalTxt; _gotFinal = true;
      }
      inp.value = (_baseText + interimTxt).replace(/^\s+/, "");
    };

    _rec.onerror = function(ev) {
      var msg = ev && ev.error;
      if (msg === "not-allowed" || msg === "service-not-allowed") {
        if (typeof showToast === "function") showToast("Microphone permission denied.");
      } else if (msg === "no-speech") {
        if (typeof showToast === "function") showToast("Didn't catch that — try again.");
      } else if (msg && msg !== "aborted") {
        if (typeof showToast === "function") showToast("Voice input error: " + msg);
      }
    };

    _rec.onend = function() {
      _listening = false;
      _rec = null;
      _syncBtn();
      var el = document.getElementById("userinput");
      // Auto-send: only when enabled, we actually captured speech, the field has
      // text, and the engine isn't mid-turn. Otherwise just leave it for review.
      if ((isAutoSend() || (typeof carMode !== "undefined" && carMode)) && _gotFinal && el && el.value.trim() && typeof busy !== "undefined" && !busy && typeof sendAction === "function") {
        sendAction(null);
      } else if (el) {
        el.focus();
      }
    };

    try {
      _rec.start();
      _listening = true;
      _syncBtn();
    } catch(e) {
      _listening = false;
      _rec = null;
      _syncBtn();
    }
  }

  function stop() {
    if (_rec) { try { _rec.stop(); } catch(e) {} }
    // onend will flip _listening / resync; guard in case it doesn't fire
    _listening = false;
    _syncBtn();
  }

  // ── UI ─────────────────────────────────────────────────────────────────────

  function _syncBtn() {
    var el = document.getElementById("mic-btn");
    if (el) {
      if (_listening) el.classList.add("listening"); else el.classList.remove("listening");
      el.title = _listening ? "Listening… tap to stop" : "Dictate your action";
    }
    // Notify the subscriber AFTER the internal sync — _syncBtn is the single choke point
    // every listen-state transition routes through (start OK/fail, stop, onend), so a
    // subscriber sees every edge #mic-btn does. Car Mode (#2) uses this to keep
    // #car-tap-btn/#car-status honest; without it the overlay froze on "Listening…"
    // after any recognition end/error/timeout (the 2026-07-16 pre-flight defect: stt.js
    // knew nothing outside #mic-btn, and Car Mode only guessed once before start()).
    if (_onState) try { _onState(_listening); } catch (e) {}
  }

  // Subscribe to listen-state edges (pass null to unsubscribe). Mirrors TTS.setOnDone.
  function setOnState(cb) { _onState = (typeof cb === "function") ? cb : null; }

  // Mirror the auto-send state across all three file menus' checkboxes.
  function _syncAutoCbs() {
    var on = isAutoSend(), ids = ["fm-autosend", "cs-fm-autosend", "api-fm-autosend"];
    for (var i = 0; i < ids.length; i++) {
      var cb = document.getElementById(ids[i]);
      if (cb) cb.checked = on;
    }
  }

  function loadSettings() {
    var el = document.getElementById("mic-btn");
    // Hide the mic entirely where recognition isn't available, rather than dim+fail.
    if (el) el.style.display = isSupported() ? "" : "none";
    _syncBtn();
    _syncAutoCbs();
  }

  // ── Public API ───────────────────────────────────────────────────────────────

  return {
    isSupported:  isSupported,
    isListening:  function() { return _listening; },
    toggle:       toggle,
    start:        start,
    stop:         stop,
    setOnState:   setOnState,
    isAutoSend:   isAutoSend,
    setAutoSend:  setAutoSend,
    loadSettings: loadSettings
  };

})();
