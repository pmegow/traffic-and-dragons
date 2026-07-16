// tts.js — Cartesia streaming TTS (SSE + Web Audio API) + local Piper TTS (WASM, offline, $0)
// Depends on: store (state.js), showToast (ui.js)
//
// ES5 convention (var, function declarations, no arrows/template literals, no const/let) applies
// throughout this file. SANCTIONED EXCEPTION (TODO #41 Phase 3, todo_TTS_piper.md §5 Q7):
// async/await is permitted in the Piper adapter functions ONLY — _piperInit, _piperEnsureVoice,
// _speakPiper, prewarmPiper — because Piper's dynamic import() + WASM predict() calls are a
// genuine I/O boundary, the same justification that already sanctions async in the three
// API-facing functions elsewhere in the codebase (callGM/summarize and kin). No other surface in
// this file should introduce async — the queue/scheduler/controls stay plain ES5 callbacks.

var TTS = (function() {

  var KEY_K    = "tnd_cartesia_key_v1";
  var ON_K     = "tnd_tts_on_v1";
  var VOICE_K  = "tnd_tts_voice_gm_v1";
  var BANK_K   = "tnd_voice_bank_v1";
  var NATIVE_K = "tnd_tts_native_v1";   // use the browser's built-in speechSynthesis instead of Cartesia
  var NVOICE_K = "tnd_tts_nvoice_v1";   // chosen native voice, stored BY NAME (voice list differs per device)
  var NVOICE_DEFAULT = "Google US English"; // preferred voice when the user hasn't picked one (falls back to OS default if absent)

  // ── Voice bank ─────────────────────────────────────────────────────────────

  function getBank() {
    try { var r = store.get(BANK_K); return r ? JSON.parse(r) : []; } catch(e) { return []; }
  }
  function setBank(arr) { store.set(BANK_K, JSON.stringify(arr)); }

  var CARTESIA_SSE_URL  = "https://api.cartesia.ai/tts/sse";
  var CARTESIA_VERSION  = "2026-03-01";
  var CARTESIA_MODEL    = "sonic-2";
  var SAMPLE_RATE       = 22050;

  // ── Shared text-prep (TODO #41 Phase 1 — harvested from piper_test.html spike) ──────────────
  // Provider-agnostic normalization + sentence-splitting. Cartesia (_stream, below) deliberately
  // does NOT use splitSentences — it's a streaming API that handles a whole paragraph in one
  // request; splitting it multiplies POSTs and breaks cross-sentence prosody (Fable review finding
  // 2, todo_TTS_piper.md Phase 1). Native DOES use it: Chrome flakes on very long single utterances
  // and per-sentence units give skip() finer granularity. A future engine (Piper) uses both.

  // Dash handling is per-caller via dashRepl: browser speechSynthesis SWALLOWS em/en-dashes (no
  // audible pause) but DOES honor an ellipsis pause, so the native path (below) passes "... " —
  // this is the exact validated behavior of the old _dashToPause (retired into this function).
  // Do NOT change native's dashRepl to a comma. Other callers may pass ", " (a comma "breath").
  // Order matters: the literal-"..."→ellipsis collapse runs BEFORE the dash substitution, so a
  // dashRepl of "... " (three literal dots) is not immediately re-collapsed into a single "…" —
  // that would silently change the exact validated native-speech output.
  function normalizeForTTS(text, dashRepl) {
    if (dashRepl == null) dashRepl = ", ";
    return (text || "")
      .replace(/\s*\.\.\.+\s*/g, "… ")     // literal "..." already in the source → single ellipsis char
      .replace(/\s*--\s*/g, dashRepl)      // spaced ASCII double-hyphen
      .replace(/\s*[—–]\s*/g, dashRepl)    // em / en dash
      .replace(/\n/g, " ")                 // intra-paragraph newline → space (paragraphs are split before this runs)
      .replace(/[ \t]+/g, " ")
      .trim();
  }

  // Max characters per speakable unit. A ~500-char run-on sentence (commas, no period) synthesized
  // as one utterance can hang/stall single-threaded engines and reads as frozen, so no unit exceeds
  // this — long sentences sub-split on clause boundaries, then hard-wrap on words if needed.
  var MAX_UNIT = 220;

  // Pack a too-long sentence into <=MAX_UNIT pieces: greedily on clause boundaries (, ; :), falling
  // back to word-wrap for a single clause that's still too long.
  function packLongUnit(s) {
    if (s.length <= MAX_UNIT) return [s];
    var clauses = s.match(/[^,;:]+[,;:]+\s*|[^,;:]+$/g) || [s];
    var out = [], buf = "";
    function flush() { if (buf.trim()) { out.push(buf.trim()); buf = ""; } }
    for (var i = 0; i < clauses.length; i++) {
      var c = clauses[i].trim();
      if (!c) continue;
      if (c.length > MAX_UNIT) {
        flush();
        var words = c.split(/\s+/), wb = "";
        for (var w = 0; w < words.length; w++) {
          if (wb && (wb + " " + words[w]).length > MAX_UNIT) { out.push(wb); wb = words[w]; }
          else wb = wb ? wb + " " + words[w] : words[w];
        }
        if (wb) buf = wb;   // carry remainder to pack with the next clause
      } else if (buf && (buf + " " + c).length > MAX_UNIT) {
        flush(); buf = c;
      } else {
        buf = buf ? buf + " " + c : c;
      }
    }
    flush();
    return out;
  }

  // Split prose into speakable units: paragraphs (blank-line separated) → sentences → MAX_UNIT-capped
  // pieces. paraEnd (wider gap) marks only the final piece of the final sentence of a paragraph.
  // The boundary regex tolerates closing quotes/brackets after terminal punctuation (`"Run!" she
  // said.` → two units) — without that, match()/g silently SKIPS the unmatchable span and the
  // quoted line is dropped from the spoken output entirely (audible content loss, caught in the
  // Phase 1 build). Known remaining limit: punctuation with no following space ("file.name",
  // "3.5 gold", abbreviations) still defeats the regex — the no-loss net below catches every such
  // case by comparing non-whitespace content and falling back to the whole paragraph as one
  // (MAX_UNIT-capped) run, with a console.warn so it's never silent.
  function splitSentences(text, dashRepl) {
    var paras = (text || "").split(/\n\s*\n/);
    var out = [];
    for (var p = 0; p < paras.length; p++) {
      var norm = normalizeForTTS(paras[p], dashRepl);
      if (!norm) continue;
      var parts = norm.match(/[^.!?…]+[.!?…]+["'”’»)\]]*(?=\s|$)|[^.!?…]+$/g) || [norm];
      if (parts.join("").replace(/\s+/g, "") !== norm.replace(/\s+/g, "")) {
        console.warn("[tts] sentence split would lose text — speaking paragraph unsplit (len " + norm.length + ")");
        parts = [norm];
      }
      for (var i = 0; i < parts.length; i++) {
        var sent = parts[i].trim();
        if (!sent) continue;
        var lastSentence = (i === parts.length - 1);
        var subs = packLongUnit(sent);
        for (var j = 0; j < subs.length; j++) {
          out.push({ text: subs[j], paraEnd: (lastSentence && j === subs.length - 1) });
        }
      }
    }
    return out;
  }

  var _queue      = [];
  var _playing    = false;
  var _paused     = false;
  var _lastSpokenText  = "";
  var _onDoneCallback  = null;
  var _audioCtx   = null;   // single persistent context, created on first toggle-on
  var _nextStart  = 0;      // scheduled playback cursor (AudioContext time)
  var _sources    = [];     // scheduled AudioBufferSourceNodes
  var _abortCtrl  = null;   // AbortController for live fetch
  var _cartesiaError = "";  // last Cartesia failure reason; once set, speech falls back to native
  var _cartesiaErrorAt = 0; // when it was recorded — auto-retried after 5 min so one transient blip doesn't downgrade the whole session (audit #27)
  var _nativeUtter   = null;// current SpeechSynthesisUtterance (native path)
  var _curNative     = false;// is the currently-playing queue item using native TTS

  // ── State ──────────────────────────────────────────────────────────────────

  function isOn()     { return store.get(ON_K) === "1"; }
  function getKey()   { return store.get(KEY_K)   || ""; }
  function getVoice() { return store.get(VOICE_K) || ""; }
  function isNative() { return store.get(NATIVE_K) === "1"; }
  function getNativeVoice() { return store.get(NVOICE_K) || ""; }
  // System voices available to speechSynthesis. May be empty on first call (esp. iOS) until voiceschanged fires.
  function _voiceList() { try { return (window.speechSynthesis && speechSynthesis.getVoices()) || []; } catch(e) { return []; } }
  function _findNativeVoice(name) { if (!name) return null; var vs = _voiceList(), i; for (i = 0; i < vs.length; i++) { if (vs[i].name === name) return vs[i]; } return null; }
  // The voice to actually speak with: the user's saved pick if present, else the preferred default, else OS default (null).
  function _resolveNativeVoice() { return _findNativeVoice(getNativeVoice()) || _findNativeVoice(NVOICE_DEFAULT) || null; }
  // Cartesia is usable only with a key and no recorded failure. Otherwise speech routes to native.
  // A recorded failure expires after 5 minutes so Cartesia gets retried automatically.
  function _cartesiaOk() {
    if (_cartesiaError && Date.now() - _cartesiaErrorAt > 300000) { _cartesiaError = ""; _updateCartErr(); }
    return !!getKey() && !_cartesiaError;
  }
  function _useNative()  { return isNative() || !_cartesiaOk(); }

  // ── Toggle ─────────────────────────────────────────────────────────────────

  function toggle() {
    var on = !isOn();
    store.set(ON_K, on ? "1" : "");
    if (on) {
      _ensureCtx();  // create AudioContext NOW, inside the user gesture
    } else {
      stop();
      _closeCtx();
    }
    _syncBtn();
    if (typeof showToast === "function") showToast(on ? "🔊 Voice on" : "🔇 Voice off");
  }

  function _ensureCtx() {
    if (_audioCtx && _audioCtx.state !== "closed") return _audioCtx;
    try {
      _audioCtx  = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: SAMPLE_RATE });
      _nextStart = 0;
    } catch(e) { console.warn("[tts] AudioContext unavailable:", e.message); }
    return _audioCtx;
  }

  function _closeCtx() {
    if (_audioCtx) { try { _audioCtx.close(); } catch(e) {} _audioCtx = null; }
  }

  // iOS Safari quirk: speechSynthesis alone doesn't claim the "playback" audio
  // session category, so native TTS can route nowhere (or be silenced by the
  // mute switch) over Bluetooth. A silent looping AudioContext buffer, started
  // inside a user gesture, keeps the page in an active playback session so
  // native speech inherits correct Bluetooth routing. Used by Car Mode.
  var _primerSrc = null;

  function primeAudioSession() {
    var ctx = _ensureCtx();
    if (!ctx) return;
    if (ctx.state === "suspended") ctx.resume();
    if (_primerSrc) return;
    try {
      var buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      var src = ctx.createBufferSource();
      src.buffer = buf;
      src.loop = true;
      var gain = ctx.createGain();
      gain.gain.value = 0.0001;
      src.connect(gain);
      gain.connect(ctx.destination);
      src.start(0);
      _primerSrc = src;
    } catch(e) { console.warn("[tts] primer failed:", e.message); }
  }

  function stopAudioSessionPrimer() {
    if (_primerSrc) { try { _primerSrc.stop(); } catch(e) {} _primerSrc = null; }
  }

  function loadSettings() { _syncBtn(); }

  function _syncBtn() {
    var on = isOn();
    var el = document.getElementById("tts-btn");
    if (el) { el.textContent = on ? "🔊" : "🔇"; el.style.opacity = on ? "1" : "0.5"; }
  }

  // ── Public speak entry points ───────────────────────────────────────────────

  function speak(text, voiceId) {
    if (!text || !text.trim()) return;
    _lastSpokenText = text.trim();
    if (_useNative()) { _queue.push({ text: text.trim(), native: true }); if (!_playing) _drain(); return; }
    voiceId = voiceId || getVoice();
    if (!voiceId || !getKey()) {
      // No Cartesia voice configured — in car mode fall back to native so audio still plays
      if (typeof carMode !== "undefined" && carMode) { _queue.push({ text: text.trim(), native: true }); if (!_playing) _drain(); }
      return;
    }
    _queue.push({ text: text.trim(), voiceId: voiceId });
    if (!_playing) _drain();
  }

  function speakResponse(cleanText) {
    if (!isOn() && !(typeof carMode !== "undefined" && carMode)) return;
    speak(cleanText.trim());
  }

  // ── Queue management ────────────────────────────────────────────────────────

  function _drain() {
    if (!_queue.length) {
      _playing = false;
      _paused  = false;
      _curNative = false;
      _showBar(false);
      if (_onDoneCallback) _onDoneCallback();
      return;
    }
    _playing = true;
    _paused  = false;
    _showBar(true);
    _updatePauseBtn(false);
    var item = _queue.shift();
    _curNative = !!item.native;
    if (item.native) _speakNative(item.text);
    else if (item.piper) _speakPiper(item.text, item.voiceId);
    else _stream(item.text, item.voiceId);
  }

  // ── Native (browser speechSynthesis) path ────────────────────────────────────
  // Splits into units (dashRepl "... " — see the normalizeForTTS comment for why) and speaks
  // them as CHAINED utterances: unit i's onend triggers unit i+1, and the final unit's onend
  // hands off to _drain(). A single long paragraph as one utterance is what used to flake on
  // Chrome; chaining also gives skip() per-sentence granularity instead of per-paragraph.
  function _speakNative(text) {
    if (!window.speechSynthesis || typeof SpeechSynthesisUtterance === "undefined") { _drain(); return; }
    var units = splitSentences(text, "... ");
    if (!units.length) { _drain(); return; }
    try { window.speechSynthesis.cancel(); } catch(e) {}   // clear any stuck/previous utterance before starting the chain
    _speakNativeUnit(units, 0);
  }

  function _speakNativeUnit(units, i) {
    if (i >= units.length) { _nativeUtter = null; _drain(); return; }
    try {
      var u = new SpeechSynthesisUtterance(units[i].text);
      u.rate = 1.0; u.pitch = 1.0;
      var nv = _resolveNativeVoice();   // saved pick → preferred default → OS default
      if (nv) u.voice = nv;
      _nativeUtter = u;
      u.onend   = function() { _speakNativeUnit(units, i + 1); };
      u.onerror = function(e) {
        // Do not let one bad unit silently kill the rest of the chain — warn and continue.
        console.warn("[tts] native unit " + (i + 1) + "/" + units.length + " failed, skipping:", e && e.error);
        _speakNativeUnit(units, i + 1);
      };
      window.speechSynthesis.speak(u);
    } catch (e) {
      console.warn("[tts] native speak failed:", e.message);
      _nativeUtter = null; _drain();
    }
  }

  // ── Streaming core ──────────────────────────────────────────────────────────

  function _stream(text, voiceId) {
    var key = getKey();
    if (!key) { _drain(); return; }

    var ctx = _ensureCtx();
    if (!ctx) { _drain(); return; }
    if (ctx.state === "suspended") ctx.resume();

    _sources = [];

    // Schedule from wherever we left off, but never in the past
    var nextStart  = Math.max(_nextStart, ctx.currentTime + 0.05);
    var streamDone = false;
    var activeSrcs = 0;

    function onAllDone() {
      _sources   = [];
      _nextStart = 0;
      _drain();
    }

    function scheduleChunk(b64) {
      // base64 → raw bytes → Int16 → Float32
      var binary  = atob(b64);
      var nSamples = binary.length >> 1;  // 2 bytes per s16le sample
      var f32 = new Float32Array(nSamples);
      for (var i = 0; i < nSamples; i++) {
        var lo  = binary.charCodeAt(i * 2)     & 0xFF;
        var hi  = binary.charCodeAt(i * 2 + 1) & 0xFF;
        var s16 = (hi << 8) | lo;
        f32[i]  = (s16 > 32767 ? s16 - 65536 : s16) / 32768.0;
      }

      var buf = ctx.createBuffer(1, nSamples, SAMPLE_RATE);
      buf.getChannelData(0).set(f32);

      var src = ctx.createBufferSource();
      src.buffer = buf;
      src.connect(ctx.destination);

      var startAt = Math.max(nextStart, ctx.currentTime + 0.005);
      src.start(startAt);
      nextStart  = startAt + buf.duration;
      _nextStart = nextStart;

      activeSrcs++;
      _sources.push(src);
      src.onended = function() {
        activeSrcs--;
        if (streamDone && activeSrcs === 0) onAllDone();
      };
    }

    _abortCtrl = typeof AbortController !== "undefined" ? new AbortController() : null;

    var fetchOpts = {
      method: "POST",
      headers: {
        "X-API-Key":        key,
        "Cartesia-Version": CARTESIA_VERSION,
        "Content-Type":     "application/json"
      },
      body: JSON.stringify({
        model_id:      CARTESIA_MODEL,
        transcript:    text,
        voice:         { mode: "id", id: voiceId },
        output_format: { container: "raw", encoding: "pcm_s16le", sample_rate: SAMPLE_RATE }
      })
    };
    if (_abortCtrl) fetchOpts.signal = _abortCtrl.signal;

    fetch(CARTESIA_SSE_URL, fetchOpts)
    .then(function(r) {
      if (!r.ok) throw new Error("Cartesia " + r.status);
      var reader  = r.body.getReader();
      var decoder = new TextDecoder();
      var lineBuf = "";

      function read() {
        reader.read().then(function(result) {
          if (result.done) {
            streamDone = true;
            if (activeSrcs === 0) onAllDone();
            return;
          }

          lineBuf += decoder.decode(result.value, { stream: true });
          var lines = lineBuf.split("\n");
          lineBuf = lines.pop();  // keep any incomplete line

          for (var i = 0; i < lines.length; i++) {
            var line = lines[i].trim();
            if (!line || line.slice(0, 5) !== "data:") continue;
            var json = line.slice(5).trim();
            if (!json) continue;
            var evt;
            try { evt = JSON.parse(json); } catch(e) { continue; }

            if (evt.type === "chunk" && evt.data) {
              scheduleChunk(evt.data);
            } else if (evt.type === "done") {
              streamDone = true;
              if (activeSrcs === 0) onAllDone();
            } else if (evt.type === "error") {
              console.warn("[tts] Cartesia error:", evt.message);
              _cartesiaError = evt.message || "Cartesia error"; _cartesiaErrorAt = Date.now(); _updateCartErr();
              streamDone = true;
              if (activeSrcs === 0) onAllDone();
            }
          }

          read();
        }).catch(function(e) {
          if (e.name !== "AbortError") console.warn("[tts stream]", e.message);
          streamDone = true;
          if (activeSrcs === 0) onAllDone();
        });
      }

      read();
    })
    .catch(function(e) {
      if (e.name === "AbortError") { _drain(); return; }
      console.warn("[tts]", e.message);
      _cartesiaError = e.message || "Cartesia unavailable";  // future lines auto-route to native (retried after 5 min)
      _cartesiaErrorAt = Date.now();
      _updateCartErr();
      _curNative = true;
      _speakNative(text);                                    // still speak THIS line via native
    });
  }

  // ── Piper (local WASM) engine — TODO #41 Phase 3 ────────────────────────────
  // Vendored, same-origin ORT + vits-web (Phase 2: vendor/piper/, import map in index.html).
  // ENGINE ONLY here — nothing in _drain()/speak() routes to it by default yet (Phase 4 owns the
  // provider table + dispatch). Mirrors the shape of _stream() above: a synth-then-schedule loop
  // feeding the same AudioContext/_sources/_nextStart scheduler, so pause()/skip()/stop() work
  // unchanged. Unlike Cartesia's fetch (which AbortController can cancel), an in-flight WASM
  // predict() call cannot be aborted — so every await below is followed by an epoch check that
  // silently discards stale work. That silent bail is the ONE sanctioned silent path in this
  // engine: it is not a failure, it is "this result is for a narration turn the user already
  // skipped past," and scheduling it would audibly overlap the next item (review finding 3).

  var _piperMod      = null;  // vits-web module ref, kept warm across turns/synths
  var _piperReady     = false; // true once _piperInit has completed successfully at least once
  var _piperError     = "";    // last Piper failure reason; mirrors _cartesiaError's shape/semantics
  var _piperErrorAt   = 0;     // when it was recorded — auto-retried after 5 min, same as Cartesia
  var _piperEpoch     = 0;     // generation counter — bumped by _speakPiper (new synth) and
                                // _stopCurrent() (skip/stop); a stale await checks this and bails

  var PIPER_ORT_PATH = "/vendor/piper/ort/";
  var PIPER_LIB_PATH = "/vendor/piper/vits/vits-web.js";

  // Piper failure auto-retries after 5 min — same shape as _cartesiaOk() above. No caller routes
  // speak() through Piper yet (Phase 4 owns dispatch); prewarmPiper uses this so a known-broken
  // engine isn't re-attempted on every TTS toggle-on inside the retry window.
  function _piperOk() {
    if (_piperError && Date.now() - _piperErrorAt > 300000) { _piperError = ""; _piperErrorAt = 0; }
    return !_piperError;
  }

  // Idempotent lazy engine init. Order is load-bearing (todo_TTS_piper.md §1 finding 4): the ORT
  // env locks MUST be in place before vits-web's own predict() call, because vits-web
  // unconditionally reassigns wasmPaths/numThreads on every call (vendor/piper/vits/vits-web.js) —
  // Object.defineProperty getters with no-op setters make that clobber a no-op instead of a break.
  async function _piperInit() {
    if (_piperMod) return _piperMod;   // warm — already initialized
    try {
      var ort = await import("onnxruntime-web");   // bare specifier → import map → PIPER_ORT_PATH, same-origin
      Object.defineProperty(ort.env.wasm, "wasmPaths", {
        get: function() { return PIPER_ORT_PATH; },
        set: function(_v) { /* ignore vits-web's per-predict() clobber */ },
        configurable: true
      });
      Object.defineProperty(ort.env.wasm, "numThreads", {
        get: function() { return 1; },
        set: function(_v) { /* ignore navigator.hardwareConcurrency clobber — force single-thread, no Worker/SAB/COI */ },
        configurable: true
      });
      _piperMod = await import(PIPER_LIB_PATH);
      _piperReady = true;
      return _piperMod;
    } catch(e) {
      _piperError = (e && e.message) || "Piper engine failed to load";
      _piperErrorAt = Date.now();
      console.warn("[tts piper] init failed:", _piperError);
      throw e;
    }
  }

  // Ensure a voice model is cached (vits-web caches in OPFS); download with progress on first use.
  // Loud per the no-silent-failures rule: toast at start/end, coarse console.info during, toast +
  // console.warn + rethrow on failure. Richer download UI (a real progress bar) is Phase 4 — this
  // is the loud-not-silent floor.
  async function _piperEnsureVoice(voiceId) {
    var mod = await _piperInit();
    var stored = [];
    try { stored = await mod.stored(); } catch(e) { stored = []; }
    if (stored.indexOf(voiceId) !== -1) return;
    if (typeof showToast === "function") showToast("⬇ Downloading narrator voice — one-time, cached after");
    var lastPct = -1;
    try {
      await mod.download(voiceId, function(p) {
        if (!p || !p.total) return;
        var pct = Math.floor((p.loaded / p.total) * 100 / 10) * 10;
        if (pct > 0 && pct !== lastPct) { lastPct = pct; console.info("[tts piper] " + voiceId + " download " + pct + "%"); }
      });
    } catch(e) {
      _piperError = (e && e.message) || "voice download failed";
      _piperErrorAt = Date.now();
      console.warn("[tts piper] voice download failed:", _piperError);
      if (typeof showToast === "function") showToast("⚠ Narrator voice download failed — using fallback voice");
      throw e;
    }
    if (typeof showToast === "function") showToast("✓ Narrator voice ready");
  }

  // Synthesize + schedule one narration item through Piper. Sequential per-unit loop (mirrors
  // piper_test.html speakAll()): predict → decode → schedule on the shared AudioContext timeline.
  // The epoch guard runs after EVERY await (see section comment above) — this is what makes a
  // stopped/skipped narration safe against an unabortable WASM call resolving late.
  async function _speakPiper(text, voiceId) {
    var myEpoch = ++_piperEpoch;

    var ctx = _ensureCtx();
    if (!ctx) { _drain(); return; }
    if (ctx.state === "suspended") { try { await ctx.resume(); } catch(e) {} }
    if (_piperEpoch !== myEpoch) return;   // stale — a skip()/stop() ran while we awaited resume()

    var mod;
    try {
      mod = await _piperInit();
      if (_piperEpoch !== myEpoch) return;                 // stale after init
      await _piperEnsureVoice(voiceId);
      if (_piperEpoch !== myEpoch) return;                 // stale after voice download
    } catch(e) {
      if (_piperEpoch !== myEpoch) return;                 // stale — don't resurrect a skipped item
      console.warn("[tts piper] engine/voice unavailable, falling back to native for this line:", e && e.message);
      _curNative = true;
      _speakNative(text);                                  // mirror of _stream's catch — still speak THIS line
      return;
    }

    // default dashRepl ", " — commas ARE the right dash style for Piper (spike finding, §2)
    var units = splitSentences(text);
    if (!units.length) { _drain(); return; }

    _sources = [];
    var nextStart  = Math.max(_nextStart, ctx.currentTime + 0.05);
    var loopDone   = false;
    var activeSrcs = 0;
    var anyOk      = false;

    function onAllDone() {
      _sources   = [];
      _nextStart = 0;
      _drain();
    }

    for (var i = 0; i < units.length; i++) {
      if (_piperEpoch !== myEpoch) return;   // stale — stop()/skip() invalidated this loop mid-flight
      var u = units[i];

      var blob;
      try {
        blob = await mod.predict({ text: u.text + " ", voiceId: voiceId });   // trailing space: documented static-tail guard
      } catch(e) {
        console.warn("[tts piper] synth failed on unit " + (i + 1) + "/" + units.length + ", skipping:", e && e.message);
        continue;
      }
      if (_piperEpoch !== myEpoch) return;   // stale — discard a predict() that resolved after invalidation

      var buf;
      try {
        var arrBuf = await blob.arrayBuffer();
        if (_piperEpoch !== myEpoch) return;   // stale — discard mid-decode
        buf = await ctx.decodeAudioData(arrBuf);
        if (_piperEpoch !== myEpoch) return;   // stale — the guard that matters most: never schedule over the next item
      } catch(e) {
        console.warn("[tts piper] decode failed on unit " + (i + 1) + "/" + units.length + ", skipping:", e && e.message);
        continue;
      }

      anyOk = true;
      var src = ctx.createBufferSource();
      src.buffer = buf;
      src.connect(ctx.destination);
      var startAt = Math.max(nextStart, ctx.currentTime + 0.03);   // never schedule in the past
      src.start(startAt);
      nextStart  = startAt + buf.duration + (u.paraEnd ? 0.44 : 0.22);   // 0.22s gap, 0.44s at paragraph end
      _nextStart = nextStart;

      activeSrcs++;
      _sources.push(src);
      src.onended = function() {
        activeSrcs--;
        if (loopDone && activeSrcs === 0 && _piperEpoch === myEpoch) onAllDone();
      };
    }

    loopDone = true;
    if (_piperEpoch !== myEpoch) return;   // stale — a skip() during the final unit must not reach the
                                           // fallback below (it would speak a skipped item via native)
                                           // or the activeSrcs===0 drain (double-_drain, overlapping items)
    if (!anyOk) {
      // every unit failed to synthesize — loud, then fall back to native for THIS item (mirror of _stream's catch)
      _piperError = "all units failed to synthesize";
      _piperErrorAt = Date.now();
      console.warn("[tts piper] " + _piperError);
      _curNative = true;
      _speakNative(text);
      return;
    }
    if (activeSrcs === 0) onAllDone();
  }

  // Fire-and-forget pre-warm: loads the engine + ensures the given voice + runs a throwaway
  // 1-word predict (result discarded, NEVER scheduled) so the one-time ~9s WASM compile happens
  // off the critical path of the user's first real narration. Snapshots (does not bump) the epoch
  // — a prewarm must never invalidate a real in-flight _speakPiper loop; it only needs to know
  // whether IT has been superseded, so its own discarded result isn't worth chasing further.
  // Exported on the public API. Nothing calls this yet — Phase 4 wires it to TTS-enable.
  function prewarmPiper(voiceId) {
    if (!_piperOk()) return;   // known-broken within the retry window — don't hammer it every toggle-on
    var myEpoch = _piperEpoch;
    (async function() {
      try {
        var mod = await _piperInit();
        if (_piperEpoch !== myEpoch) return;
        await _piperEnsureVoice(voiceId);
        if (_piperEpoch !== myEpoch) return;
        await mod.predict({ text: "warm up", voiceId: voiceId });   // discarded — just forces the WASM compile
      } catch(e) {
        console.warn("[tts piper] prewarm failed (non-fatal):", e && e.message);
      }
    })();
  }

  // ── Controls ────────────────────────────────────────────────────────────────

  function pause() {
    if (_curNative && window.speechSynthesis) {
      if (window.speechSynthesis.paused) { window.speechSynthesis.resume(); _paused = false; }
      else { window.speechSynthesis.pause(); _paused = true; }
      _updatePauseBtn(_paused); return;
    }
    // Piper items never set _curNative (see _drain()), so they fall through to here and pause via
    // AudioContext suspend/resume — the same branch Cartesia uses. No Piper-specific code needed.
    if (!_audioCtx) return;
    if (_audioCtx.state === "suspended") {
      _audioCtx.resume();
      _paused = false;
    } else {
      _audioCtx.suspend();
      _paused = true;
    }
    _updatePauseBtn(_paused);
  }

  function skip() {
    _stopCurrent();
    _playing = false;
    _drain();
  }

  function stop() {
    _stopCurrent();
    _queue   = [];
    _playing = false;
    _paused  = false;
    _showBar(false);
  }

  function _stopCurrent() {
    _piperEpoch++;   // invalidate any in-flight Piper synth loop — unabortable WASM predict() must not schedule stale audio
    if (_abortCtrl) { try { _abortCtrl.abort(); } catch(e) {} _abortCtrl = null; }
    if (_nativeUtter) { _nativeUtter.onend = null; _nativeUtter.onerror = null; _nativeUtter = null; }
    if (window.speechSynthesis) { try { window.speechSynthesis.cancel(); } catch(e) {} }
    for (var i = 0; i < _sources.length; i++) {
      try { _sources[i].onended = null; _sources[i].stop(); } catch(e) {}
    }
    _sources   = [];
    _nextStart = 0;
    // Do NOT close _audioCtx — it is persistent and was created during a user gesture
  }

  // ── UI helpers ──────────────────────────────────────────────────────────────

  function _showBar(show) {
    var bar = document.getElementById("tts-bar");
    if (bar) bar.style.display = show ? "flex" : "none";
  }

  function _updatePauseBtn(paused) {
    var btn = document.getElementById("tts-pause-btn");
    if (btn) btn.textContent = paused ? "▶" : "⏸";
  }

  // ── Settings modal ──────────────────────────────────────────────────────────

  function _escVal(s) { return (s || "").replace(/&/g,"&amp;").replace(/"/g,"&quot;").replace(/</g,"&lt;"); }

  // Red indicator beside the Cartesia API Key label when Cartesia can't be used.
  function _updateCartErr() {
    var el = document.getElementById("tts-cart-err");
    if (!el) return;
    var msg = "";
    if (!getKey())            msg = "⚠ no key — using native voice";
    else if (_cartesiaError)  msg = "⚠ " + _cartesiaError + " — using native voice";
    el.textContent = msg;
    el.title = msg;
    el.style.display = msg ? "inline" : "none";
  }

  function _buildVoiceOptions() {
    var bank = getBank(), cur = getVoice(), html = "", found = false;
    if (!bank.length) return "<option value='' disabled selected>— no voices saved yet —</option>";
    html += "<option value=''>" + (cur ? "— select —" : "— select a voice —") + "</option>";
    for (var i = 0; i < bank.length; i++) {
      var sel = (bank[i].id === cur) ? " selected" : "";
      if (bank[i].id === cur) found = true;
      html += "<option value='" + _escVal(bank[i].id) + "'" + sel + ">" + _escVal(bank[i].name) + "</option>";
    }
    if (cur && !found) {
      html += "<option value='" + _escVal(cur) + "' selected>(current) " + _escVal(cur.slice(0,8)) + "…</option>";
    }
    return html;
  }

  function _buildNativeVoiceOptions() {
    var vs = _voiceList(), html = "", i;
    // show the effective voice as selected: saved pick if any, else the resolved default
    var cur = getNativeVoice(); if (!cur) { var rv = _resolveNativeVoice(); if (rv) cur = rv.name; }
    if (!vs.length) return "<option value='' selected>— system default (loading…) —</option>";
    html += "<option value=''>— system default —</option>";
    for (i = 0; i < vs.length; i++) {
      var sel = (vs[i].name === cur) ? " selected" : "";
      var lang = vs[i].lang ? " (" + vs[i].lang + ")" : "";
      html += "<option value='" + _escVal(vs[i].name) + "'" + sel + ">" + _escVal(vs[i].name) + lang + "</option>";
    }
    return html;
  }

  // Audition a native voice by NAME (reads the live dropdown choice, not the saved one).
  function _testNativeVoice(name) {
    if (!window.speechSynthesis || typeof SpeechSynthesisUtterance === "undefined") {
      if (typeof showToast === "function") showToast("No browser speech support."); return;
    }
    try {
      speechSynthesis.cancel();
      var u = new SpeechSynthesisUtterance("The lightless mass rotates, and the weapon-notation locks into place.");
      var v = _findNativeVoice(name); if (v) u.voice = v;
      speechSynthesis.speak(u);
    } catch (e) {}
  }

  function _buildBankRows() {
    var bank = getBank();
    if (!bank.length) return "";
    var html = "<div style='margin-top:8px;border-top:1px solid var(--brd2);padding-top:8px;'>";
    for (var i = 0; i < bank.length; i++) {
      html += "<div style='display:flex;align-items:center;gap:6px;padding:4px 0;'>"
        + "<span style='flex:1;font-size:12px;color:var(--t0);'>" + _escVal(bank[i].name) + "</span>"
        + "<span style='font-size:10px;color:var(--t2);font-family:var(--font-mono);'>" + _escVal(bank[i].id.slice(0,8)) + "…</span>"
        + "<button data-bank-del='" + i + "' style='background:none;border:none;color:var(--t2);cursor:pointer;font-size:14px;padding:0 2px;line-height:1;' title='Remove'>&#215;</button>"
        + "</div>";
    }
    return html + "</div>";
  }

  function _refreshVoiceUI() {
    var sel = document.getElementById("tts-voice-sel");
    if (sel) sel.innerHTML = _buildVoiceOptions();
    var rows = document.getElementById("tts-bank-rows");
    if (rows) {
      rows.innerHTML = _buildBankRows();
      _wireBankDelBtns();
    }
  }

  function _wireBankDelBtns() {
    var rows = document.getElementById("tts-bank-rows");
    if (!rows) return;
    var btns = rows.querySelectorAll("[data-bank-del]");
    for (var i = 0; i < btns.length; i++) {
      btns[i].addEventListener("click", (function(idx) {
        return function() {
          var bank = getBank();
          var removed = bank.splice(idx, 1);
          setBank(bank);
          // Clear active voice if the deleted entry was selected
          if (removed.length && removed[0].id === getVoice()) store.del(VOICE_K);
          _refreshVoiceUI();
        };
      })(parseInt(btns[i].getAttribute("data-bank-del"), 10)));
    }
  }

  function showSettingsModal() {
    var ex = document.getElementById("tts-modal"); if (ex) ex.remove();
    var modal = document.createElement("div");
    modal.id = "tts-modal";
    modal.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,.88);z-index:300;display:flex;align-items:flex-start;justify-content:center;padding:20px;overflow-y:auto;";
    var inpStyle = "width:100%;padding:8px 10px;background:var(--bg3);border:1px solid var(--brd);border-radius:6px;color:var(--t0);font-size:13px;box-sizing:border-box;";
    var smInpStyle = "width:100%;padding:6px 8px;background:var(--bg2);border:1px solid var(--brd);border-radius:4px;color:var(--t0);font-size:12px;box-sizing:border-box;margin-bottom:6px;";
    modal.innerHTML = "<div style='background:#181818;border:1px solid var(--acc);border-radius:12px;padding:24px;max-width:480px;width:100%;margin-top:60px;'>"
      + "<div style='display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;'>"
      +   "<span style='font-size:16px;color:var(--t0);font-weight:bold;'>&#128266; Voice Settings</span>"
      +   "<button id='tts-modal-x' style='background:none;border:none;color:var(--t2);font-size:20px;cursor:pointer;'>&#215;</button>"
      + "</div>"
      + "<div style='margin-bottom:10px;'>"
      +   "<div style='display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:6px;'>"
      +     "<label style='font-size:12px;color:var(--t2);'>Cartesia API Key</label>"
      +     "<span id='tts-cart-err' style='font-size:11px;color:#e06060;display:none;'></span>"
      +   "</div>"
      +   "<input id='tts-key-inp' type='password' placeholder='sk_car_...' value='" + _escVal(getKey()) + "' style='" + inpStyle + "'/>"
      + "</div>"
      + "<label style='display:flex;align-items:center;gap:8px;margin-bottom:18px;font-size:12px;color:var(--t1);cursor:pointer;'>"
      +   "<input type='checkbox' id='tts-native-cb' style='accent-color:var(--acc);width:14px;height:14px;cursor:pointer;flex-shrink:0;'" + (isNative() ? " checked" : "") + "/>"
      +   "<span>Use native voice <span style='color:var(--t2);'>— no key needed, lower quality. Used automatically if Cartesia is unavailable.</span></span>"
      + "</label>"
      + "<div style='margin-bottom:20px;'>"
      +   "<label style='font-size:12px;color:var(--t2);display:block;margin-bottom:6px;'>Native voice</label>"
      +   "<div style='display:flex;gap:6px;'>"
      +     "<select id='tts-nvoice-sel' style='" + inpStyle + "flex:1;'>" + _buildNativeVoiceOptions() + "</select>"
      +     "<button id='tts-nvoice-test' style='flex-shrink:0;padding:0 12px;background:none;border:1px solid var(--brd2);border-radius:6px;color:var(--t1);font-size:12px;cursor:pointer;white-space:nowrap;'>&#9654; Test</button>"
      +   "</div>"
      +   "<div style='font-size:11px;color:var(--t2);margin-top:4px;'>Used for the native voice and the Cartesia fallback. Windows 11 has neural voices (Aria, Guy); on iOS, download Enhanced voices in Settings &#8250; Accessibility &#8250; Spoken Content &#8250; Voices.</div>"
      + "</div>"
      + "<div style='margin-bottom:20px;'>"
      +   "<div style='display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;'>"
      +     "<label style='font-size:12px;color:var(--t2);'>Narrator Voice <span style='color:var(--t2);font-weight:normal;'>(Cartesia)</span></label>"
      +     "<button id='tts-add-btn' style='font-size:11px;background:none;border:1px solid var(--brd2);border-radius:4px;color:var(--t2);cursor:pointer;padding:2px 8px;'>+ Add</button>"
      +   "</div>"
      +   "<select id='tts-voice-sel' style='" + inpStyle + "'>" + _buildVoiceOptions() + "</select>"
      +   "<div id='tts-add-form' style='display:none;margin-top:10px;background:var(--bg3);border:1px solid var(--brd2);border-radius:6px;padding:10px;'>"
      +     "<input id='tts-add-name' type='text' placeholder='Voice name (e.g. Gravely Narrator)' style='" + smInpStyle + "'/>"
      +     "<input id='tts-add-id' type='text' placeholder='Cartesia voice UUID' style='" + smInpStyle + "font-family:var(--font-mono);'/>"
      +     "<div style='display:flex;gap:6px;'>"
      +       "<button id='tts-add-save' style='flex:1;padding:6px;background:var(--acc);border:none;border-radius:4px;color:#000;font-size:12px;cursor:pointer;font-family:var(--font);'>Save</button>"
      +       "<button id='tts-add-cancel' style='padding:6px 10px;background:none;border:1px solid var(--brd2);border-radius:4px;color:var(--t2);font-size:12px;cursor:pointer;'>Cancel</button>"
      +     "</div>"
      +   "</div>"
      +   "<div id='tts-bank-rows'>" + _buildBankRows() + "</div>"
      + "</div>"
      + "<button id='tts-save-btn' style='width:100%;padding:10px;background:var(--acc);border:none;border-radius:6px;color:#000;font-family:var(--font);font-size:14px;font-weight:bold;cursor:pointer;'>Save</button>"
      + "</div>";
    document.body.appendChild(modal);

    document.getElementById("tts-modal-x").addEventListener("click", function() { modal.remove(); });
    modal.addEventListener("click", function(e) { if (e.target === modal) modal.remove(); });

    _updateCartErr();
    document.getElementById("tts-native-cb").addEventListener("change", function() {
      store.set(NATIVE_K, this.checked ? "1" : "");
      _updateCartErr();
    });

    // Native voices may not be ready on modal open (esp. iOS) — repopulate when they load.
    if (window.speechSynthesis) {
      _voiceList(); // nudge some browsers to start loading the list
      speechSynthesis.onvoiceschanged = function() {
        var s = document.getElementById("tts-nvoice-sel");
        if (s) s.innerHTML = _buildNativeVoiceOptions();
      };
    }
    document.getElementById("tts-nvoice-test").addEventListener("click", function() {
      var s = document.getElementById("tts-nvoice-sel");
      _testNativeVoice(s ? s.value : "");
    });

    document.getElementById("tts-add-btn").addEventListener("click", function() {
      var form = document.getElementById("tts-add-form");
      form.style.display = form.style.display === "none" ? "block" : "none";
      if (form.style.display === "block") document.getElementById("tts-add-name").focus();
    });

    document.getElementById("tts-add-cancel").addEventListener("click", function() {
      document.getElementById("tts-add-form").style.display = "none";
    });

    document.getElementById("tts-add-save").addEventListener("click", function() {
      var name = document.getElementById("tts-add-name").value.trim();
      var id   = document.getElementById("tts-add-id").value.trim();
      if (!name || !id) { if (typeof showToast === "function") showToast("Name and voice ID are required."); return; }
      var bank = getBank();
      // Replace if same ID already exists
      var found = false;
      for (var i = 0; i < bank.length; i++) { if (bank[i].id === id) { bank[i].name = name; found = true; break; } }
      if (!found) bank.push({ id: id, name: name });
      bank.sort(function(a, b) { return a.name.localeCompare(b.name); });
      setBank(bank);
      // Auto-select the new voice
      store.set(VOICE_K, id);
      document.getElementById("tts-add-form").style.display = "none";
      document.getElementById("tts-add-name").value = "";
      document.getElementById("tts-add-id").value = "";
      _refreshVoiceUI();
    });

    _wireBankDelBtns();

    document.getElementById("tts-save-btn").addEventListener("click", function() {
      var key   = document.getElementById("tts-key-inp").value.trim();
      var voice = document.getElementById("tts-voice-sel").value;
      if (key) { store.set(KEY_K, key); _cartesiaError = ""; } else store.del(KEY_K);  // a fresh key gets Cartesia retried
      if (voice) store.set(VOICE_K, voice); else store.del(VOICE_K);
      var ncb = document.getElementById("tts-native-cb"); if (ncb) store.set(NATIVE_K, ncb.checked ? "1" : "");
      var nvs = document.getElementById("tts-nvoice-sel"); if (nvs) { if (nvs.value) store.set(NVOICE_K, nvs.value); else store.del(NVOICE_K); }
      modal.remove();
      if (typeof showToast === "function") showToast("Voice settings saved.");
    });
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  return {
    isOn:              isOn,
    isPlaying:         function() { return _playing && !_paused; },
    isPaused:          function() { return _paused; },
    getLastText:       function() { return _lastSpokenText; },
    setOnDone:         function(fn) { _onDoneCallback = fn; },
    toggle:            toggle,
    loadSettings:      loadSettings,
    speak:             speak,
    speakResponse:     speakResponse,
    pause:             pause,
    skip:              skip,
    stop:              stop,
    showSettingsModal: showSettingsModal,
    primeAudioSession:     primeAudioSession,
    stopAudioSessionPrimer: stopAudioSessionPrimer,
    // Piper (TODO #41 Phase 3) — fire-and-forget pre-warm. Nothing calls this yet; Phase 4 wires
    // it to TTS-enable so the ~9s one-time WASM compile happens off the critical path.
    prewarmPiper:      prewarmPiper,
    // Internal — exported ONLY for the headless engine tests (dev/engine-tests.js) and for the
    // later Piper provider phases (TODO #41) to reuse. Not a supported external call surface.
    _textPrep: { normalizeForTTS: normalizeForTTS, splitSentences: splitSentences, packLongUnit: packLongUnit }
  };

})();
