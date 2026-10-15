// audio-session.js — the microphone ↔ narration audio-session handoff (#19; #631, the Car Mode seam).
// PORTABLE: this file names nothing outside itself and the platform (navigator.audioSession, AudioContext nodes, the
// console) — dev/tests-631-car-seam.js derives that from the source. The host wires its crumb ring and its toast through
// AudioSession.hooks({crumb, notify}) (tts.js does, at load); without hooks the module still works and says its failures
// on the console. tts.js owns the narration AudioContext and hands it in (prime, routeCrumb, watchCtx); stt.js reports the
// microphone through setCapture. Moved out of tts.js by #631 (2026-10-14) byte-for-byte in behaviour.
//
// A WebAudio loop keeps the context active; it does not select the OS playback category.
// Safari can retain the phone route after microphone capture (WebKit bug 282939).
// Release playback before capture, then reclaim it only after the mic has ended.
var AudioSession = (function() {
  var _capture = false, _playback = false;
  var _hooks = { crumb: function() {}, notify: function() {} };
  function hooks(h) {
    if (h && typeof h.crumb === "function") _hooks.crumb = h.crumb;
    if (h && typeof h.notify === "function") _hooks.notify = h.notify;
  }
  function _crumb(evt, data) { _hooks.crumb(evt, data); }
  function setType(type) {
    try {
      if (typeof navigator === "undefined" || !navigator.audioSession) return;
      var prev = navigator.audioSession.type;
      if (prev !== type) { navigator.audioSession.type = type; _crumb("audio-session", prev + ">" + type); }   // #19 second pass: a same-value set is silent
    } catch(e) {
      var reason = e && e.message ? e.message : String(e);
      console.warn("[audio-session] " + type + " failed: " + reason);
      _hooks.notify("Audio routing could not switch to " + type + ": " + reason);
    }
  }
  function requestPlayback() {
    _playback = true;
    if (!_capture) setType("playback");
  }
  function releasePlayback() {
    _playback = false;
    setType("auto");
  }
  function setCapture(active) {
    _capture = !!active;
    if (!_capture) { _captureEndedAt = Date.now(); _routeForce = true; }   // #19 second pass: the first read after a capture is always fingerprinted
    setType(_capture || !_playback ? "auto" : "playback");
  }
  // ── #19 second pass (2026-09-22): the handoff is INSTRUMENTED ─────────────────────────────
  // The car verification of v1.943 came back "narration reaches the stereo but drops in and out
  // rapid fire" — with no console to read. Nothing in this block changes behavior: every audio-
  // session type transition, every state change of the narration context, and one route
  // fingerprint per read start ride the #16 crumb ring (24 entries; File ▸ Report bug mails it), so
  // the next drive is self-interpreting. A wedged play-and-record shows as reads that start with
  // the hands-free latency profile (as=playback but a short ol=); a car that flips profiles shows
  // as ctx-state churn; the commands a head unit sends on its own show as car-session.js's
  // media-action crumbs. Every site is coalesced or rate-limited because a storm of any one of
  // them would evict the rest of the ring. DOC/todos_completed/todo_19_bluetooth_audio.md.
  var _captureEndedAt = 0;      // Date.now() of the last capture end
  var _routeForce = false;      // set by a capture end, consumed by the next routeCrumb
  var _routeSigLast = "";       // identical consecutive fingerprints coalesce
  var _ctxStateLast = "", _ctxStateAt = 0;
  var CTX_STATE_CRUMB_WINDOW_MS = 2000;
  function _ms(sec) { return (typeof sec === "number" && isFinite(sec)) ? String(Math.round(sec * 200) * 5) : "?"; }   // seconds → ms in 5 ms buckets: latency jitters, the route does not
  function typeNow() { try { return (typeof navigator !== "undefined" && navigator.audioSession) ? String(navigator.audioSession.type) : "-"; } catch (e) { return "-"; } }
  function routeCrumb(why, ctx) {
    var sig = "ol=" + _ms(ctx && ctx.outputLatency) + " bl=" + _ms(ctx && ctx.baseLatency) + " st=" + (ctx ? ctx.state : "none") + " as=" + typeNow() + " cap=" + (_capture ? 1 : 0);
    if (sig === _routeSigLast && !_routeForce) return;
    _routeSigLast = sig; _routeForce = false;
    _crumb("read-route", (why || "read") + " " + sig);
  }
  function watchCtx(ctx) {
    if (!ctx || typeof ctx.addEventListener !== "function") return;
    ctx.addEventListener("statechange", function() {
      var now = Date.now(), st = String(ctx.state);
      if (st === _ctxStateLast && now - _ctxStateAt < CTX_STATE_CRUMB_WINDOW_MS) return;
      _ctxStateLast = st; _ctxStateAt = now;
      _crumb("ctx-state", st);
    });
  }
  var _primerSrc = null;
  var _primerGain = null;   // audit F11 — retained so the primer's gain is torn down with its source

  // The silent loop that claims the playback category on the host's narration context. The host resumes the context
  // in-gesture before calling this (tts.js primeAudioSession); the guard checks the primer is on the CURRENT ctx — a
  // primer left over from a closed/replaced ctx is a dead node (v1.334, audit #3), and returning on it would leave the
  // new ctx with no playback-category claim (iOS mute-switch silence back again).
  function prime(ctx) {
    if (!ctx) return;
    if (_primerSrc && _primerSrc.context === ctx) return;
    stopPrimer();
    try {
      var buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      // #19 second pass: NEVER digital silence. Some head units mute their amplifier on a run of
      // exact zeros and take up to a second to unmute, clipping the start of every unit after a
      // gap. Full-scale noise under the 1e-4 gain below is -80 dBFS — three LSBs at 16 bits,
      // inaudible in a moving car, but never a zero run. A stub buffer without channel data stays.
      if (typeof buf.getChannelData === "function") { var _pd = buf.getChannelData(0), _pi; for (_pi = 0; _pi < _pd.length; _pi++) _pd[_pi] = Math.random() * 2 - 1; }
      var src = ctx.createBufferSource();
      src.buffer = buf;
      src.loop = true;
      var gain = ctx.createGain();
      gain.gain.value = 0.0001;
      src.connect(gain);
      gain.connect(ctx.destination);
      src.start(0);
      _primerSrc = src;
      _primerGain = gain;
    } catch(e) { console.warn("[audio-session] primer failed:", e.message); }
  }

  // audit F11 — stopping the source left the source AND its gain wired to the destination, so
  // every ctx rebuild (recoverAudio, the recycle) stranded another two-node chain on the old
  // graph. Stop first, then disconnect both; a throw here is benign (already-stopped nodes) but
  // never silent.
  function stopPrimer() {
    if (_primerSrc) {
      try { _primerSrc.stop(); } catch(e) {}
      try { _primerSrc.disconnect(); } catch(e) { console.debug("[audio-session] primer source teardown:", e && e.message); }
      _primerSrc = null;
    }
    if (_primerGain) {
      try { _primerGain.disconnect(); } catch(e) { console.debug("[audio-session] primer gain teardown:", e && e.message); }
      _primerGain = null;
    }
  }

  return {
    hooks:           hooks,            // {crumb(evt,data), notify(message)} — the host's crumb ring and toast
    requestPlayback: requestPlayback,  // narration wants the playback category (held back while the mic is live)
    releasePlayback: releasePlayback,  // the narration context closed — back to auto
    setCapture:      setCapture,       // the microphone opened (true) / released (false) — THE handoff
    isCapturing:     function() { return _capture; },
    captureEndedAt:  function() { return _captureEndedAt; },
    typeNow:         typeNow,
    routeCrumb:      routeCrumb,       // (why, ctx) one fingerprint per read start, coalesced; forced after a capture end
    watchCtx:        watchCtx,         // (ctx) every state change of the narration context rides the crumb ring
    prime:           prime,            // (ctx) the silent dither loop that claims playback on THIS context
    stopPrimer:      stopPrimer
  };
})();
