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
  var CONFIRM_K    = "tnd_stt_confirm_v1";   // #77 Layer-2 gate pref — default ON when unset

  var _Rec       = window.SpeechRecognition || window.webkitSpeechRecognition || null;
  var _rec       = null;   // live recognition instance (one at a time)
  var _listening = false;
  var _baseText  = "";     // input value captured when listening started (dictation appends)
  var _gotFinal  = false;  // did this session yield a final transcript? (gates auto-send)
  var _onState   = null;   // external listen-state subscriber (Car Mode) — the TTS.setOnDone pattern
  var _cancelled = false;  // set by cancel() — tells the finish handler to discard, never send
  var _lastErrorWasNoSpeech = false; // stamped by onerror, read by onend for the single auto-retry
  var _noSpeechRetried      = false; // has this car-mode listen cycle already used its one retry?

  // ── #77 confirm gate state (design record: DOC/DOC_nonsense_filter.html §4) ──────────────
  var _confirmPending = null;  // {text, tries} — the utterance awaiting a spoken yes/no/redo
  var _utterCorr = [];         // Layer-0 record: sttCorrectNames substitutions this utterance
  var _utterConf = null;       // Layer-0 record: transcript confidence 0..1, null = no signal
  var _confSum = 0, _confN = 0; // native path per-chunk confidence accumulator

  function isConfirmGate()   { return store.get(CONFIRM_K) !== "0"; }
  function setConfirmGate(on){ store.set(CONFIRM_K, on ? "1" : "0"); }
  function isConfirmPending(){ return !!_confirmPending; }
  function _resetUtterance() { _utterCorr = []; _utterConf = null; _confSum = 0; _confN = 0; }
  function _rosterNow() {
    return (typeof sttNameRoster === "function" && typeof worldState !== "undefined")
      ? sttNameRoster(worldState, (typeof memory !== "undefined") ? memory : null) : [];
  }
  function _confSpeak(s) { if (typeof TTS !== "undefined" && typeof TTS.speak === "function") TTS.speak(s); }
  // Layer-0 measurement channel: compact outcome record per auto-send-path utterance
  // (counts + reasons, never the transcript itself). Read back via sttLogAll() in the console.
  function _logUtter(outcome, reasons, text) {
    if (typeof sttLogEvent !== "function") return;
    sttLogEvent({
      t: Date.now(), path: _Rec ? "n" : "c",
      conf: (_utterConf == null) ? null : Math.round(_utterConf * 100) / 100,
      corr: _utterCorr.length, len: String(text || "").length,
      why: (reasons && reasons.length) ? reasons : undefined, out: outcome
    });
  }

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
    _resetUtterance();   // #77 Layer 0 — each listen is its own confidence/correction record

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
        if (r.isFinal) {
          finalTxt += r[0].transcript;
          // #77 Layer 0 — the recognizer's own per-chunk confidence (0..1). Some engines
          // report 0 for everything (the Edge Canary class); a zero is treated as no-signal
          // rather than certainty-of-garbage, so it can never flag every utterance.
          if (typeof r[0].confidence === "number" && r[0].confidence > 0) { _confSum += r[0].confidence; _confN++; }
        }
        else interimTxt += r[0].transcript;
      }
      // Persist finals into the base so they survive the next result event
      if (finalTxt) {
        if (_roster.length && typeof sttCorrectNames === "function") finalTxt = sttCorrectNames(finalTxt, _roster, _utterCorr);
        _baseText = _baseText + finalTxt; _gotFinal = true;
        _utterConf = _confN ? (_confSum / _confN) : null;
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

    // #77 — a pending confirmation OWNS the next final transcript. Above EVERYTHING below:
    // above carVoiceCommand (a spoken "two" while confirming is an answer attempt, never a
    // menu pick), above the busy-park (the answer is not an action to park), and above the
    // rank-8 <3-char gate (a spoken "no" is 2 chars — the gate would eat it AND clear the
    // field; the #78 ordering lesson, one rung higher).
    if (_confirmPending && _gotFinal && text) { _resolveConfirm(text, el); return; }

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

    // #77 Layer 1-gate + Layer 2 — the suspicion verdict decides whether this auto-send
    // proceeds. BELOW the rank-8 gate on purpose (junk shorter than 3 chars still dies
    // there) and only on the auto-send path: a manual send was human-reviewed by definition.
    if (isConfirmGate() && typeof sttSuspicion === "function") {
      var _susp = sttSuspicion(text, _utterCorr, _utterConf, _rosterNow());
      if (_susp.suspicious) { _enterConfirm(text, _susp, el, carModeOn); return; }
    }
    _logUtter("sent", null, text);

    // round-2 #29b: ack earcon + "Heard you…" status right before the actual send.
    // carNotify is a global from ui-carmode.js; guarded + no-ops outside car mode, so
    // desktop auto-send is unaffected.
    if (typeof carNotify === "function") carNotify("sent");
    sendAction(null);
  }

  // ── #77 Layer 2 — the confirm flow (DOC/DOC_nonsense_filter.html §4; three-band design) ──
  // Car Mode: speak "I heard: … — send it?" and take a spoken yes/no/redo (the mic reopen is
  // Car Mode's _carAutoMic confirm branch; cloud stays push-to-talk — the driver taps to
  // answer). Outside Car Mode there is no spoken loop: the HOLD is the gate — the text stays
  // parked in the field, visibly flagged, and the player sends by hand.
  // CONTRACT (doc §5 build note): nothing here may touch sessionLog/worldState/transcript —
  // the pending text lives only in _confirmPending until the player confirms.
  function _enterConfirm(text, susp, el, carModeOn) {
    _logUtter("held", susp.reasons, text);
    if (!carModeOn) {
      if (el) {
        el.value = text;
        el.style.outline = "2px solid var(--acc)";
        el.title = "Voice input looked unclear (" + susp.reasons.join(", ") + ") — review before sending";
        el.oninput = function() { el.style.outline = ""; el.title = ""; el.oninput = null; };
        el.focus();
      }
      if (typeof showToast === "function") showToast("⚠ Voice input looked unclear — review before sending.");
      return;
    }
    _confirmPending = { text: text, tries: 0 };
    if (el) el.value = "";   // the pending text lives here, not in the field (no stray tap-send)
    if (typeof carNotify === "function") carNotify("info", "Confirm: yes / no / redo");
    _confSpeak("I heard: " + text + " — send it?");
  }

  function _resolveConfirm(answer, el) {
    if (el) el.value = "";
    var pend = _confirmPending;
    var cmd = (typeof parseConfirmCommand === "function") ? parseConfirmCommand(answer) : null;
    if (cmd === "yes") {
      _confirmPending = null;
      _logUtter("confirmed", null, pend.text);
      if (typeof busy !== "undefined" && busy) {
        if (el) el.value = pend.text;
        if (typeof carNotify === "function") carNotify("info", "Heard you — tap to send");
        return;
      }
      if (typeof carNotify === "function") carNotify("sent");
      if (typeof sendAction === "function") sendAction(pend.text);
      return;
    }
    if (cmd === "no")   { _confirmPending = null; _logUtter("discarded", null, pend.text); _confSpeak("Discarded."); return; }
    if (cmd === "redo") { _confirmPending = null; _logUtter("redo", null, pend.text); _confSpeak("Go ahead."); return; }
    if (cmd === "repeat") { _confSpeak("I heard: " + pend.text + " — send it?"); return; }
    pend.tries++;
    if (pend.tries < 2) { _confSpeak("Say yes, no, or redo."); return; }
    // Two unrecognized answers — fail safe to manual, never lose the utterance.
    _confirmPending = null;
    _logUtter("parked", null, pend.text);
    if (el) el.value = pend.text;
    if (typeof carNotify === "function") carNotify("info", "Heard you — tap to send");
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

  // ── #113 §4 upgrades (DOC/DOC_whisper_stt.html, user go 2026-08-03) ──────────────
  var STT_CLOUD_MODEL    = "gpt-4o-mini-transcribe"; // §4b: better noisy-audio WER, half whisper-1's price — verify the id stays current (the PROVIDERS model-string discipline)
  var STT_CLOUD_FALLBACK = "whisper-1";              // §4b: one retry on any primary-model failure — never a silent dead mic
  var STT_MAX_RECORD_MS  = 45000; // §4c: hard cap (was 15000) — endpointing below usually stops long before this
  var STT_SILENCE_MS     = 1500;  // §4c: sustained quiet that ends a take, once speech has been heard
  var STT_MIN_RECORD_MS  = 1200;  // §4c: never endpoint before this — a slow starter is not silence

  var _cloudRec    = null;  // live MediaRecorder instance
  var _cloudStream = null;  // its MediaStream, so we can stop every track on finish
  var _cloudChunks = [];
  var _cloudMime   = "";
  var _cloudTimer  = null;  // STT_MAX_RECORD_MS auto-stop (the endpointing backstop)
  var _nbToasted   = false; // §4d: narrowband-mic warning shown at most once per page load

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
      // §4d mic-path telemetry: the findings doc's suspected dominant car factor is the
      // Bluetooth hands-free route (telephone-band capture) — make it VISIBLE in the #16
      // channel instead of inferring it from garbled transcripts. getSettings() is sync+cheap.
      try {
        var _tr = stream.getAudioTracks && stream.getAudioTracks()[0];
        var _ms = (_tr && _tr.getSettings) ? _tr.getSettings() : {};
        console.info("[stt] mic: sampleRate=" + (_ms.sampleRate || "?") + " ec=" + _ms.echoCancellation + " ns=" + _ms.noiseSuppression + " agc=" + _ms.autoGainControl);
        if (typeof erCrumb === "function") erCrumb("stt-mic", { sr: _ms.sampleRate || 0, ec: _ms.echoCancellation ? 1 : 0, ns: _ms.noiseSuppression ? 1 : 0, agc: _ms.autoGainControl ? 1 : 0 });
        if (_ms.sampleRate && _ms.sampleRate <= 16000 && !_nbToasted && typeof carMode !== "undefined" && carMode) {
          _nbToasted = true;
          if (typeof showToast === "function") showToast("🎙 The car's hands-free mic is telephone-quality — the phone's own mic hears dictation better.", 6000);
        }
      } catch(e) {}
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
      if (typeof carNotify === "function") carNotify("info", "Recording — pause to finish, or tap");
      _vadStart(stream); // §4c: silence endpointing — no WebAudio → cap-only, exactly the old world
      _cloudTimer = setTimeout(function() {
        if (_listening && _cloudRec) stop();
      }, STT_MAX_RECORD_MS);
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

  // ── §4c silence endpointing (VAD-lite) ─────────────────────────────────────────
  // WebAudio RMS gate: once speech has been heard, STT_SILENCE_MS of quiet ends the take —
  // the driver stops talking, the app stops listening. The 15s wall was the car's worst UX:
  // short utterances waited it out, long directives got truncated. ONE lazy AudioContext
  // singleton (monotonic-resources rule — the Sound.js pattern); the per-recording source/
  // analyser are disconnected in _vadStop, which every teardown path runs. Degrades safely:
  // a noisy cabin whose floor never drops below the threshold simply rides to the hard cap —
  // the pre-§4c behavior with a longer window, never a cut-off.
  var _vadCtx = null, _vadSrc = null, _vadAnalyser = null, _vadPoll = null, _vadBuf = null;
  function _vadStart(stream) {
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      if (!_vadCtx) _vadCtx = new AC();
      if (_vadCtx.state === "suspended") { try { _vadCtx.resume(); } catch(e) {} }
      _vadSrc = _vadCtx.createMediaStreamSource(stream);
      _vadAnalyser = _vadCtx.createAnalyser();
      _vadAnalyser.fftSize = 512;
      _vadSrc.connect(_vadAnalyser);
      _vadBuf = new Uint8Array(_vadAnalyser.fftSize);
      var started = Date.now(), spoke = false, quietAt = 0;
      _vadPoll = setInterval(function() {
        if (!_listening || !_vadAnalyser) { _vadStop(); return; }
        _vadAnalyser.getByteTimeDomainData(_vadBuf);
        var i, sum = 0, d;
        for (i = 0; i < _vadBuf.length; i++) { d = (_vadBuf[i] - 128) / 128; sum += d * d; }
        var rms = Math.sqrt(sum / _vadBuf.length), now = Date.now();
        if (rms > 0.02) { spoke = true; quietAt = 0; }
        else if (spoke) {
          if (!quietAt) quietAt = now;
          if (now - quietAt >= STT_SILENCE_MS && now - started >= STT_MIN_RECORD_MS) {
            console.info("[stt] endpoint: " + STT_SILENCE_MS + "ms of silence after speech — stopping at " + ((now - started) / 1000).toFixed(1) + "s");
            _vadStop();
            if (_listening && _cloudRec) stop();
          }
        }
      }, 100);
    } catch(e) { console.warn("[stt] VAD unavailable — cap-only endpointing:", e && e.message); }
  }
  function _vadStop() {
    if (_vadPoll) { clearInterval(_vadPoll); _vadPoll = null; }
    if (_vadSrc) { try { _vadSrc.disconnect(); } catch(e) {} _vadSrc = null; }
    _vadAnalyser = null; _vadBuf = null;
  }

  function _cloudTeardownStream() {
    _vadStop(); // §4c: every stop path kills the monitor — nothing accumulates across takes
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
    // §4b: primary model with ONE loud fallback retry — a model-id rot or a 4xx on the newer
    // endpoint must degrade to yesterday's behavior, never to a silently dead mic.
    _transcribeOnce(blob, ext, key, STT_CLOUD_MODEL)
      ["catch"](function(e) {
        console.warn("[stt] " + STT_CLOUD_MODEL + " failed (" + (e && e.message) + ") — retrying with " + STT_CLOUD_FALLBACK);
        if (typeof erCrumb === "function") erCrumb("stt-fallback", { m: STT_CLOUD_MODEL, err: String((e && e.message) || "?").slice(0, 40) });
        return _transcribeOnce(blob, ext, key, STT_CLOUD_FALLBACK);
      })
      .then(function(json) {
        _cloudFinalize(json && json.text ? String(json.text) : "", json && json.logprobs);
      }).catch(function(e) {
        if (typeof showToast === "function") showToast("Voice transcription failed.");
        if (typeof carNotify === "function") carNotify("warn", "Voice input failed: " + (e && e.message)); /* final-pass #32 */
        console.warn("[stt] cloud transcription failed:", e);
        var el = document.getElementById("action-input");
        if (el) el.focus();
      });
  }

  // One transcription request. §4a: the prompt-bias field is the report's cheapest accuracy
  // win — Whisper decodes toward vocabulary it has been told to expect, so the campaign's
  // proper nouns (party, roster, places, quests) finally count as words. sttCorrectNames
  // stays downstream as the second net.
  function _transcribeOnce(blob, ext, key, model) {
    var form = new FormData();
    form.append("file", blob, "speech." + ext);
    form.append("model", model);
    var bias = (typeof sttBiasPrompt === "function") ? sttBiasPrompt() : "";
    if (bias) form.append("prompt", bias);
    // #77 Layer 0 — token logprobs are FREE on the gpt-4o transcribe models (same call, no
    // extra cost) and are the confirm gate's primary signal. gpt-4o models ONLY: whisper-1
    // rejects include[] (its confidence lives in verbose_json, which we don't need — the
    // fallback path simply runs ungated-by-confidence, corrections still count).
    if (model.indexOf("gpt-4o") === 0) {
      form.append("response_format", "json");
      form.append("include[]", "logprobs");
    }
    return fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { "Authorization": "Bearer " + key },
      body: form
    }).then(function(resp) {
      if (!resp.ok) throw new Error("HTTP " + resp.status + " (" + model + ")");
      return resp.json();
    });
  }

  // Same finalization contract as native onresult/onend: name-correction, write into the
  // field, mark _gotFinal, then the shared send policy (rank 5 busy-park + rank 8 gate).
  function _cloudFinalize(rawText, logprobs) {
    var el = document.getElementById("action-input");
    var text = rawText || "";
    _resetUtterance();   // #77 Layer 0 — this upload is its own confidence/correction record
    _utterConf = (typeof sttConfidence === "function") ? sttConfidence(logprobs) : null;
    if (text) {
      var roster = _rosterNow();
      if (roster.length && typeof sttCorrectNames === "function") text = sttCorrectNames(text, roster, _utterCorr);
      _gotFinal = true;
    }
    if (el) el.value = (_baseText + text).replace(/^\s+/, "");
    _applySendPolicy();
  }

  // ── Public API ───────────────────────────────────────────────────────────────

  return {
    isSupported:   isSupported,
    isListening:   function() { return _listening; },
    isConfirmPending: isConfirmPending,   // #77 — Car Mode's auto-mic confirm branch reads this
    isConfirmGate:    isConfirmGate,
    setConfirmGate:   setConfirmGate,
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
