// stt.js — Speech-to-text input via the Web Speech API (zero-dependency).
// Foundation for Car Mode (#5/#19): dictate an action into the input field hands-light.
// Depends on: showToast, eachMenuEl (ui-shell.js). No API key, no network — browser-native recognition.
//
// Support: Chrome/Edge desktop + Android Chrome (webkitSpeechRecognition). NOT Firefox.
// iOS Safari has NO SpeechRecognition at all — for that case (todo_carplay rank 7, EXPERIMENTAL)
// this file falls back to a cloud recording path (MediaRecorder → OpenAI Whisper) when an OpenAI
// key is on file. The cloud path is a fully separate code section below the native one so native
// behavior stays byte-identical when native recognition exists. isSupported() gates the UI so the
// mic button only appears where SOME path (native or cloud) actually works.
//
// Car Mode integration (todo_carplay): STT notifies the car overlay via the global carNotify(kind,text)
// defined in ui-carmode.js, always behind a typeof guard since ui-carmode.js may not have run yet
// (or this file may load somewhere carMode doesn't exist at all).

var STT = (function() {

  var LANG_K       = "tnd_stt_lang_v1";
  var AUTO_K       = "tnd_stt_autosend_v1";
  var AUTOLISTEN_K = "tnd_car_autolisten_v1";

  var _Rec       = window.SpeechRecognition || window.webkitSpeechRecognition || null;
  var _rec       = null;   // live recognition instance (one at a time)
  var _listening = false;
  var _baseText  = "";     // input value captured when listening started (dictation appends)
  var _gotFinal  = false;  // did this session yield a final transcript? (gates auto-send)
  var _onState   = null;   // external listen-state subscriber (Car Mode) — the TTS.setOnDone pattern
  var _cancelled = false;  // set by cancel() — tells the finish handler to discard, never send
  var _lastErrorWasNoSpeech = false; // stamped by onerror, read by onend for the single auto-retry
  var _noSpeechRetried      = false; // has this car-mode listen cycle already used its one retry?

  function isSupported()  { return !!_Rec || _cloudAvailable(); }
  function getLang()      { return store.get(LANG_K) || "en-US"; }
  function isAutoSend()   { return store.get(AUTO_K) === "1"; }
  function setAutoSend(on){ store.set(AUTO_K, on ? "1" : ""); _syncAutoCbs(); }

  // Car Mode "auto-listen after narration" pref (todo_carplay rank 6/21) — default ON when unset,
  // so every existing device reads ON with zero migration; only an explicit OFF write turns it off.
  function isAutoListen()  { return store.get(AUTOLISTEN_K) !== "0"; }
  function setAutoListen(on) { store.set(AUTOLISTEN_K, on ? "1" : "0"); }

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
    if (!_Rec) {
      if (_cloudAvailable()) _cloudStart();
      return;
    }
    var inp = document.getElementById("action-input");
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
    _cancelled = false;
    _lastErrorWasNoSpeech = false;

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
      _lastErrorWasNoSpeech = (msg === "no-speech");
      if (msg === "not-allowed" || msg === "service-not-allowed") {
        if (typeof showToast === "function") showToast("Microphone permission denied.");
        if (typeof carNotify === "function") carNotify("warn", "Microphone permission denied"); /* final-pass #32 */
      } else if (msg === "no-speech") {
        if (typeof showToast === "function") showToast("Didn't catch that — try again.");
        if (typeof carNotify === "function") carNotify("info", "Didn't catch that");
      } else if (msg === "network") {
        if (typeof showToast === "function") showToast("Voice input error: network");
        if (typeof carNotify === "function") carNotify("warn", "No signal — voice input needs a connection"); /* final-pass #32 */
      } else if (msg && msg !== "aborted") {
        if (typeof showToast === "function") showToast("Voice input error: " + msg);
        if (typeof carNotify === "function") carNotify("warn", "Voice input failed: " + msg); /* final-pass #32 */
      }
      // "aborted" (our own cancel()/abort()) stays silent on purpose — that's an intentional
      // tap-to-cancel, not a failure.
    };

    _rec.onend = function() {
      _listening = false;
      _rec = null;
      _syncBtn();

      var wasCancelled = _cancelled;
      var noSpeechEnd  = _lastErrorWasNoSpeech;
      _lastErrorWasNoSpeech = false;

      // Rank 4: tap-to-cancel must never auto-send, regardless of what got captured.
      if (wasCancelled) {
        _cancelled = false;
        _noSpeechRetried = false;
        var elc = document.getElementById("action-input");
        if (elc) elc.focus();
        return;
      }

      if (_gotFinal) {
        _noSpeechRetried = false; // a successful capture resets the single-retry budget
      } else if (noSpeechEnd && typeof carMode !== "undefined" && carMode && isAutoListen() &&
                 typeof busy !== "undefined" && !busy) {
        // Rank 21: single-shot listening — a thinking driver gets exactly ONE silent
        // auto-retry before falling back to "tap to speak". Second consecutive no-speech
        // gives up and resets the flag so the NEXT narration's auto-mic starts fresh.
        if (!_noSpeechRetried) {
          _noSpeechRetried = true;
          setTimeout(function() {
            if (typeof carMode !== "undefined" && carMode && !_listening &&
                typeof busy !== "undefined" && !busy) {
              start();
            }
          }, 400);
          var el2 = document.getElementById("action-input");
          if (el2) el2.focus();
          return;
        }
        _noSpeechRetried = false;
      }

      _applySendPolicy();
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
    if (_cloudRec) { _cloudStopRecording(false); return; }
    if (_rec) { try { _rec.stop(); } catch(e) {} }
    // onend will flip _listening / resync; guard in case it doesn't fire
    _listening = false;
    _syncBtn();
  }

  // Rank 4 — cancel discards whatever was captured: no finalize, no auto-send, ever.
  // Native: abort() drops pending results outright (falls back to stop() if unavailable —
  // onend still fires either way and resyncs _listening/_syncBtn/_onState).
  // Cloud: stops the recorder/tracks and skips the upload entirely.
  function cancel() {
    _cancelled = true;
    if (_cloudRec) { _cloudStopRecording(true); return; }
    if (_rec) {
      try {
        if (typeof _rec.abort === "function") _rec.abort();
        else _rec.stop();
      } catch(e) {}
    }
  }

  // Shared finish policy — decides whether a captured utterance auto-sends, gets gated, or
  // just sits in the field for review. Called from native onend (after the cancel/retry
  // branches above) and from the cloud path's finalize step, so both surfaces share one
  // set of rules (rank 5 busy-park notice, rank 8 short-transcript gate).
  function _applySendPolicy() {
    var el = document.getElementById("action-input");
    var carModeOn = (typeof carMode !== "undefined" && carMode);
    var autoOn = isAutoSend() || carModeOn;
    var text = el ? el.value.trim() : "";

    // #78 — Car Mode voice commands ("two" / "repeat" / "repeat everything") get first refusal on
    // every final transcript. MUST sit above BOTH gates below: the busy branch would park a
    // command as if it were an action, and the rank-8 short-transcript gate (<3 chars) would eat
    // a spoken "1"/"2" outright AND clear the field. carVoiceCommand returns true only when it
    // fully handled the utterance; anything it declines falls through as a normal action.
    if (carModeOn && _gotFinal && text && typeof carVoiceCommand === "function") {
      var _consumed = false;
      try { _consumed = carVoiceCommand(text); }
      catch (e) { console.warn("[stt] car voice command failed — treating as a normal action:", e && e.message); }
      if (_consumed) { if (el) el.blur(); return; }
    }

    var canSend = autoOn && _gotFinal && el && text && typeof sendAction === "function";

    if (!canSend) {
      if (el) el.focus();
      return;
    }

    var isBusy = typeof busy !== "undefined" && busy;

    // Rank 19 (stt half): busy stole the send window — the utterance is parked in the
    // field, not lost. Only car mode gets the spoken/visual nudge; desktop behavior
    // (silently leaving the text for the player to send) is untouched.
    if (isBusy) {
      if (carModeOn && typeof carNotify === "function") carNotify("info", "Heard you — tap to send");
      if (el) el.focus();
      return;
    }

    // Rank 8 — auto-send quality gate. Applies ONLY when car mode is what would trigger
    // the send; the desktop auto-send pref keeps today's behavior (short text still sends).
    if (carModeOn && text.length < 3) {
      console.info("[stt] auto-send suppressed (too short): " + JSON.stringify(text));
      if (typeof carNotify === "function") carNotify("info", "Heard '" + text + "' — tap mic to retry");
      // round-2 #27: clear the field too, not just skip the send — otherwise the
      // suppressed junk stays parked in #action-input and Car Mode's next tap (the
      // parked-utterance branch) sends it anyway, only delaying the garbage by one tap.
      if (el) el.value = "";
      if (el) el.focus();
      return;
    }

    // round-2 #29b: ack earcon + "Heard you…" status right before the actual send.
    // carNotify is a global from ui-carmode.js; guarded + no-ops outside car mode, so
    // desktop auto-send is unaffected.
    if (typeof carNotify === "function") carNotify("sent");
    sendAction(null);
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

  // Mirror the auto-send state across all three file menus' checkboxes (#15⑤: via
  // eachMenuEl, ui-shell.js — loads before stt.js in the app shell; only called at runtime).
  function _syncAutoCbs() {
    var on = isAutoSend();
    eachMenuEl("autosend", function(cb) { cb.checked = on; });
  }

  function loadSettings() {
    var el = document.getElementById("mic-btn");
    // Hide the mic entirely where recognition isn't available, rather than dim+fail.
    if (el) el.style.display = isSupported() ? "" : "none";
    _syncBtn();
    _syncAutoCbs();
  }

  // ── Cloud fallback (todo_carplay rank 7, EXPERIMENTAL) ──────────────────────────
  //
  // iOS Safari ships no SpeechRecognition at all. When native isn't available AND an
  // OpenAI key is on file (globals.js providerKeys.openai), this section records audio
  // with MediaRecorder and transcribes it via OpenAI Whisper. Kept fully separate from
  // the native block above: start()/stop()/cancel() dispatch into here only when _Rec is
  // null, so native behavior is byte-identical when native recognition exists.

  var _cloudRec    = null;  // live MediaRecorder instance
  var _cloudStream = null;  // its MediaStream, so we can stop every track on finish
  var _cloudChunks = [];
  var _cloudMime   = "";
  var _cloudTimer  = null;  // 15s auto-stop

  function _cloudAvailable() {
    return !!(typeof navigator !== "undefined" && navigator.mediaDevices && navigator.mediaDevices.getUserMedia &&
      typeof MediaRecorder !== "undefined" &&
      typeof providerKeys !== "undefined" && providerKeys && providerKeys.openai);
  }

  // Integration seam (orchestrator, post-lane review): Car Mode's tap must FINISH a cloud
  // recording ("tap when done" — there's no auto-endpoint like native) but CANCEL a native
  // listen (rank 4). This tells the overlay which semantics the active/next listen uses.
  function isCloudActive() { return !_Rec && _cloudAvailable(); }

  function _cloudStart() {
    if (_listening) return;
    var inp = document.getElementById("action-input");
    if (!inp) return;

    _baseText  = inp.value ? (inp.value.replace(/\s+$/, "") + " ") : "";
    _gotFinal  = false;
    _cancelled = false;
    _cloudChunks = [];
    _cloudMime   = "";

    navigator.mediaDevices.getUserMedia({ audio: true }).then(function(stream) {
      _cloudStream = stream;
      var mime = "";
      if (typeof MediaRecorder.isTypeSupported === "function") {
        if (MediaRecorder.isTypeSupported("audio/mp4")) mime = "audio/mp4";
        else if (MediaRecorder.isTypeSupported("audio/webm;codecs=opus")) mime = "audio/webm;codecs=opus";
      }
      try {
        _cloudRec = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      } catch(e) {
        _cloudTeardownStream();
        if (typeof showToast === "function") showToast("Couldn't start voice input.");
        if (typeof carNotify === "function") carNotify("warn", "Voice input failed: " + (e && e.message)); /* final-pass #32 */
        console.warn("[stt] MediaRecorder init failed:", e);
        return;
      }
      _cloudMime = _cloudRec.mimeType || mime;
      _cloudRec.ondataavailable = function(ev) { if (ev.data && ev.data.size) _cloudChunks.push(ev.data); };
      _cloudRec.onstop = _cloudFinish;

      try {
        _cloudRec.start();
      } catch(e) {
        _cloudTeardownStream();
        _cloudRec = null;
        if (typeof showToast === "function") showToast("Couldn't start voice input.");
        if (typeof carNotify === "function") carNotify("warn", "Voice input failed: " + (e && e.message)); /* final-pass #32 */
        console.warn("[stt] MediaRecorder start failed:", e);
        return;
      }

      _listening = true;
      _syncBtn();
      if (typeof carNotify === "function") carNotify("info", "Recording — tap when done");
      _cloudTimer = setTimeout(function() {
        if (_listening && _cloudRec) stop();
      }, 15000);
    }).catch(function(e) {
      if (typeof showToast === "function") showToast("Microphone permission denied.");
      if (typeof carNotify === "function") carNotify("warn", "Microphone permission denied"); /* final-pass #32 */
      console.warn("[stt] getUserMedia failed:", e);
    });
  }

  function _cloudStopRecording(cancelled) {
    _cancelled = cancelled;
    if (_cloudRec && _cloudRec.state !== "inactive") {
      try { _cloudRec.stop(); } catch(e) { _cloudFinish(); }
    } else {
      _cloudFinish();
    }
  }

  function _cloudTeardownStream() {
    if (_cloudTimer) { clearTimeout(_cloudTimer); _cloudTimer = null; }
    if (_cloudStream) {
      try {
        var tracks = _cloudStream.getTracks ? _cloudStream.getTracks() : [];
        for (var i = 0; i < tracks.length; i++) { try { tracks[i].stop(); } catch(e) {} }
      } catch(e) {}
      _cloudStream = null;
    }
  }

  // MediaRecorder's onstop — fires once recording actually halts (tap-stop or the 15s cap).
  // Flips _listening false right here (mirrors native onend's timing) BEFORE the upload,
  // so Car Mode's mic indicator turns off the moment recording stops, not after transcription.
  function _cloudFinish() {
    var wasCancelled = _cancelled;
    _cancelled = false;
    _cloudTeardownStream();
    _listening = false;
    _syncBtn();

    var chunks = _cloudChunks; _cloudChunks = [];
    var mime = _cloudMime; _cloudMime = "";
    _cloudRec = null;

    if (wasCancelled) return;   // rank 7: cancel = discard, no upload, no send
    if (!chunks.length) return; // nothing captured

    var blob = new Blob(chunks, { type: mime || "audio/webm" });
    _cloudUpload(blob, mime);
  }

  function _cloudUpload(blob, mime) {
    var key = (typeof providerKeys !== "undefined" && providerKeys) ? providerKeys.openai : null;
    if (!key) {
      if (typeof showToast === "function") showToast("Voice input needs an OpenAI API key.");
      if (typeof carNotify === "function") carNotify("warn", "Voice input needs an OpenAI API key"); /* final-pass #32 */
      console.warn("[stt] cloud upload skipped: no OpenAI key");
      return;
    }
    if (typeof carNotify === "function") carNotify("info", "Transcribing…");

    var ext = (mime && mime.indexOf("mp4") >= 0) ? "mp4" : "webm";
    var form = new FormData();
    form.append("file", blob, "speech." + ext);
    form.append("model", "whisper-1");

    fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { "Authorization": "Bearer " + key },
      body: form
    }).then(function(resp) {
      if (!resp.ok) throw new Error("HTTP " + resp.status);
      return resp.json();
    }).then(function(json) {
      _cloudFinalize(json && json.text ? String(json.text) : "");
    }).catch(function(e) {
      if (typeof showToast === "function") showToast("Voice transcription failed.");
      if (typeof carNotify === "function") carNotify("warn", "Voice input failed: " + (e && e.message)); /* final-pass #32 */
      console.warn("[stt] cloud transcription failed:", e);
      var el = document.getElementById("action-input");
      if (el) el.focus();
    });
  }

  // Same finalization contract as native onresult/onend: name-correction, write into the
  // field, mark _gotFinal, then the shared send policy (rank 5 busy-park + rank 8 gate).
  function _cloudFinalize(rawText) {
    var el = document.getElementById("action-input");
    var text = rawText || "";
    if (text) {
      var roster = (typeof sttNameRoster === "function" && typeof worldState !== "undefined")
        ? sttNameRoster(worldState, (typeof memory !== "undefined") ? memory : null) : [];
      if (roster.length && typeof sttCorrectNames === "function") text = sttCorrectNames(text, roster);
      _gotFinal = true;
    }
    if (el) el.value = (_baseText + text).replace(/^\s+/, "");
    _applySendPolicy();
  }

  // ── Public API ───────────────────────────────────────────────────────────────

  return {
    isSupported:   isSupported,
    isListening:   function() { return _listening; },
    toggle:        toggle,
    start:         start,
    stop:          stop,
    cancel:        cancel,
    isCloudActive: isCloudActive,
    setOnState:    setOnState,
    isAutoSend:    isAutoSend,
    setAutoSend:   setAutoSend,
    isAutoListen:  isAutoListen,
    setAutoListen: setAutoListen,
    loadSettings:  loadSettings
  };

})();
