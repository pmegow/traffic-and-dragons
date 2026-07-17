// tts.js — Cartesia streaming TTS (SSE + Web Audio API) + local Piper TTS (WASM, offline, $0)
// Depends on: store (state.js), showToast (ui.js)
//
// ES5 convention (var, function declarations, no arrows/template literals, no const/let) applies
// throughout this file. SANCTIONED EXCEPTION (TODO #41 Phase 3, todo_TTS_piper.md §5 Q7):
// async/await is permitted in the Piper adapter functions ONLY — _piperInit, _piperEnsureVoice
// (+ its _piperEnsureVoiceNow body and the _piperVoiceComplete OPFS check, v1.339),
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
  var TTS_TEST_LINE = "The lightless mass rotates, and the weapon-notation locks into place.";

  // ── Speech rate (Car Mode audit rank 20, todo_carplay.html) ─────────────────────────────────
  // Applies to native (utterance.rate) and Piper (length_scale / rate, vendored patch r7). Cartesia
  // is served as-is — no rate knob exists on that path, noted in the settings-modal hint.
  var RATE_K = "tnd_tts_rate_v1";
  function getRate() {
    var v = parseFloat(store.get(RATE_K));
    if (isNaN(v) || v < 0.8 || v > 1.3) return 1.0;
    return v;
  }

  // ── Engine selection (TODO #41 Phase 4) ─────────────────────────────────────
  // Explicit engine choice, layered over the implicit native-vs-Cartesia branch that existed
  // before Piper. ENGINE_K unset (every pre-Phase-4 save/device) MUST reproduce today's behavior
  // exactly — see getEngine() below. Selection (getEngine) is INTENT; runtime availability
  // (_cartesiaOk/_piperOk) is a separate ladder that can still downgrade a selected engine to
  // native for one item — see speak().
  var ENGINE_K = "tnd_tts_engine_v1";

  // ── Piper voice stable (TODO #41 Phase 4, §5 Q6 — mirrors AUTHORS/proseAuthor) ──────────────
  // The 8 voices validated in the piper_test.html spike. "medium" models run ~60MB, "high" larger;
  // vits-web caches the .onnx in OPFS after the first download, so the cost is paid once per voice
  // per device/origin.
  // size: real model download size (HEAD-checked against HF 2026-07-17, audit #16) — this is the
  // number a user on cellular consents to, so it must be per-voice truth, not a shared "~60MB".
  var PIPER_VOICES = [
    { id:"en_US-lessac-medium", label:"Lessac — warm US narrator (default)", size:"60MB",
      blurb:"Balanced, warm American voice — the house default. First use downloads once (60MB), then cached." },
    { id:"en_US-ryan-high", label:"Ryan — US male, high quality", size:"115MB",
      blurb:"Higher-fidelity US male voice (larger model than the mediums). First use downloads once (115MB), then cached." },
    { id:"en_GB-alan-medium", label:"Alan — British male", size:"60MB",
      blurb:"UK male voice. First use downloads once (60MB), then cached." },
    { id:"en_GB-northern_english_male-medium", label:"Northern English male", size:"60MB",
      blurb:"UK male voice, Northern English accent. First use downloads once (60MB), then cached." },
    { id:"en_US-hfc_male-medium", label:"HFC male — US", size:"60MB",
      blurb:"US male voice. First use downloads once (60MB), then cached." },
    { id:"en_US-amy-medium", label:"Amy — US female", size:"60MB",
      blurb:"US female voice. First use downloads once (60MB), then cached." },
    { id:"en_US-hfc_female-medium", label:"HFC female — US", size:"60MB",
      blurb:"US female voice. First use downloads once (60MB), then cached." },
    { id:"en_US-libritts_r-medium", label:"LibriTTS R — US, expressive multi-speaker", size:"75MB",
      blurb:"US voice, more expressive/varied prosody. First use downloads once (75MB), then cached." }
  ];
  function piperVoiceSize(id) {
    for (var i = 0; i < PIPER_VOICES.length; i++) { if (PIPER_VOICES[i].id === id) return PIPER_VOICES[i].size; }
    return "60–115MB";
  }
  var PVOICE_K = "tnd_piper_voice_v1"; // device-default Piper voice id

  // Two-tier voice scope — EXACTLY the worldState.proseAuthor pattern (ui.js showProseModal /
  // PROSE_K): a per-campaign pick rides the sync blob (worldState.piperVoice) and wins when set;
  // an unset/pre-game campaign falls back to the device default (PVOICE_K); an unset device falls
  // back to the house default voice. Guard every worldState access — tts.js can run pre-game,
  // and worldState itself is `null` until a campaign is loaded (state.js).
  function resolvePiperVoice() {
    return (typeof worldState !== "undefined" && worldState && worldState.piperVoice) || store.get(PVOICE_K) || "en_US-lessac-medium";
  }

  // Save semantics mirror showProseModal's Save handler exactly (ui.js, PROSE_K precedent):
  // always write the device default so future/unset campaigns inherit the pick; ADDITIONALLY pin
  // it to the live campaign (rides the sync blob) only when a campaign actually exists to pin it
  // to. Pre-game, there is no worldState.character yet, so only the device default is written.
  function savePiperVoice(id) {
    store.set(PVOICE_K, id);
    if (typeof worldState !== "undefined" && worldState && worldState.character) {
      worldState.piperVoice = id;
      if (typeof saveAll === "function") saveAll();
    }
  }

  // getEngine() — explicit ENGINE_K wins. When unset (every save/device that predates Phase 4),
  // LEGACY INFERENCE reproduces today's behavior byte-for-byte so an existing user's TTS doesn't
  // silently change out from under them: isNative() checked → "native"; else a saved Cartesia key
  // → "cartesia" (matches _cartesiaOk()'s key requirement); else "native" (today's ultimate
  // fallback when nothing is configured).
  function getEngine() {
    var explicit = store.get(ENGINE_K);
    if (explicit === "native" || explicit === "cartesia" || explicit === "piper") return explicit;
    if (isNative()) return "native";
    if (getKey()) return "cartesia";
    return "native";
  }

  // ── TTS_PROVIDERS — the provider table (mirrors the LLM PROVIDERS shape in globals.js) ───────
  // One entry per engine. speak() resolves getEngine() → this table → availability → enqueue(),
  // instead of if(engine===...) branches. Provider-specific quirks (Cartesia's voice-bank
  // requirement, Piper's voiceId resolution) live in that entry's own functions, never in speak().
  // available()      — runtime usability check (separate from selection; see the ENGINE_K comment).
  // enqueue(text,vId) — builds the _queue item, or returns null/undefined when the provider can't
  //                     produce one right now (e.g. Cartesia with no voice configured) — speak()
  //                     preserves the old car-mode-only fallback for that specific case.
  // fallbackReason()  — human-readable reason shown by the settings-modal indicator when this
  //                     engine downgrades to native for an item.
  var TTS_PROVIDERS = {
    native: {
      id: "native", label: "Native (device voice)",
      hint: "Your browser/OS built-in voice. No key needed, works everywhere, lower quality. Always the fallback target for the other engines.",
      available: function() { return true; },
      enqueue: function(text) { return { text: text, native: true }; },
      fallbackReason: function() { return ""; }
    },
    cartesia: {
      id: "cartesia", label: "Cartesia (cloud, high quality)",
      hint: "Studio-quality cloud voices. Requires an API key and a saved voice.",
      available: function() { return _cartesiaOk(); },
      enqueue: function(text, voiceIdArg) {
        var voiceId = voiceIdArg || getVoice();
        if (!voiceId || !getKey()) return null;   // "no Cartesia voice configured" — speak() keeps the car-mode-only fallback
        return { text: text, voiceId: voiceId };
      },
      fallbackReason: function() { return _cartesiaError || (!getKey() ? "no Cartesia key" : "Cartesia unavailable"); }
    },
    piper: {
      id: "piper", label: "Piper (local, offline, $0)",
      hint: "Synthesizes on-device — free, works offline. First use per voice downloads once (60–115MB by voice), then cached.",
      available: function() { return _piperOk(); },
      enqueue: function(text) { return { text: text, piper: true, voiceId: resolvePiperVoice() }; },
      fallbackReason: function() { return _piperError || "Piper engine unavailable"; }
    }
  };

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

  // ── Piper pause tiers (user-tuned 2026-07-16 after the first phone listen) ─────────────────
  // Piper renders essentially NO pause for punctuation inside a unit (spike finding, #41), so the
  // ONLY rhythm control we have is the scheduled gap between units. Piper therefore splits on
  // EVERY comma (splitSentences commaSplit mode) and each unit carries an `end` type mapped to an
  // independently tunable gap below. Full-stop was doubled from the shipped 0.22 by user call
  // ("the way it just runs over a comma is nasty"); comma is a breath, not a stop. Native does
  // NOT comma-split (its OS voice renders commas itself — validated behavior, don't change);
  // Cartesia never splits at all (prosody).
  var PAUSE_COMMA        = 0.15;  // gap after a unit ending in ","  (a breath)
  var PAUSE_COMMA_CLAUSE = 0.22;  // gap after ";" / ":" and mid-sentence wrap pieces (heavier than a breath)
  var PAUSE_FULLSTOP     = 0.44;  // gap after ". ! ? …" (sentence end)
  var PAUSE_PARAGRAPH    = 0.88;  // gap at a paragraph break (2× full stop — keeps the hierarchy)
  var PIPER_MAX_AHEAD_SEC = 25;   // v1.320: max seconds of synthesized-but-unplayed audio held at once
                                  // (backpressure — the iOS long-passage tab-kill fix; see _speakPiper)
  function unitGap(u) {
    if (u) {
      if (u.end === "para")     return PAUSE_PARAGRAPH;
      if (u.end === "sentence") return PAUSE_FULLSTOP;
      if (u.end === "clause")   return PAUSE_COMMA_CLAUSE;
      if (u.end === "comma")    return PAUSE_COMMA;
      if (u.paraEnd)            return PAUSE_PARAGRAPH;   // legacy unit shape (no `end` field)
    }
    return PAUSE_COMMA_CLAUSE;
  }

  // A [,;:] wedged between digits is thousands/time notation ("1,000 gold", "3:30"), not a clause
  // boundary — the raw clause split would hand Piper "1," + "000 gold." and it speaks "one … zero
  // zero zero gold" (audit #7, v1.338). Merge such splits back together. Works on the RAW
  // (untrimmed) match pieces: a real clause break always carries whitespace after the separator,
  // so a piece ending digit-tight on [,;:] with the next piece starting on a digit is unambiguous.
  function mergeDigitClauses(cl) {
    var out = [];
    for (var i = 0; i < cl.length; i++) {
      var prev = out.length ? out[out.length - 1] : "";
      if (prev && /\d[,;:]$/.test(prev) && /^\d/.test(cl[i])) out[out.length - 1] = prev + cl[i];
      else out.push(cl[i]);
    }
    return out;
  }

  // Pack a too-long sentence into <=MAX_UNIT pieces: greedily on clause boundaries (, ; :), falling
  // back to word-wrap for a single clause that's still too long.
  function packLongUnit(s) {
    if (s.length <= MAX_UNIT) return [s];
    var clauses = mergeDigitClauses(s.match(/[^,;:]+[,;:]+\s*|[^,;:]+$/g) || [s]);
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
  //
  // commaSplit (Piper only): additionally break every sentence at , ; : boundaries and tag each
  // unit's `end` type ("comma"/"clause"/"sentence"/"para") so scheduling can give each its own
  // gap (unitGap above) — Piper renders no punctuation pause itself, so the gaps ARE the rhythm.
  // The clause regex covers every character (same shape packLongUnit uses), so comma mode cannot
  // lose content. Default (native) path: NO comma splits, unchanged unit boundaries — the `end`
  // field is added but paraEnd semantics are byte-identical to Phase 1.
  function splitSentences(text, dashRepl, commaSplit) {
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
        var units = [], j, s2;
        if (commaSplit) {
          var clauses = mergeDigitClauses(sent.match(/[^,;:]+[,;:]+\s*|[^,;:]+$/g) || [sent]);
          for (var c = 0; c < clauses.length; c++) {
            var cl = clauses[c].trim();
            if (!cl) continue;
            var tail = cl.charAt(cl.length - 1);
            var endType = (tail === ",") ? "comma" : (tail === ";" || tail === ":") ? "clause" : "sentence";
            var subs = packLongUnit(cl);
            for (s2 = 0; s2 < subs.length; s2++)
              units.push({ text: subs[s2], end: (s2 === subs.length - 1) ? endType : "clause" });
          }
        } else {
          var whole = packLongUnit(sent);
          for (j = 0; j < whole.length; j++)
            units.push({ text: whole[j], end: (j === whole.length - 1) ? "sentence" : "clause" });
        }
        if (units.length && lastSentence) units[units.length - 1].end = "para";
        for (j = 0; j < units.length; j++) {
          units[j].paraEnd = (units[j].end === "para");
          out.push(units[j]);
        }
      }
    }
    return out;
  }

  var _queue      = [];
  var _playing    = false;
  var _paused     = false;
  var _lastSpokenText  = "";
  var _lastNarration   = "";   // set ONLY by speakResponse (rank 17/18, todo_carplay.html) — narration-
                                // sourced, unlike _lastSpokenText which every speak() caller (incl. the
                                // settings-modal Test buttons) overwrites. Backs TTS.replayLast().
  var _onDoneCallback  = null;
  var _audioCtx   = null;   // single persistent context, created on first toggle-on
  var _nextStart  = 0;      // scheduled playback cursor (AudioContext time)
  var _sources    = [];     // scheduled AudioBufferSourceNodes
  var _abortCtrl  = null;   // AbortController for live fetch
  var _cartesiaError = "";  // last Cartesia failure reason; once set, speech falls back to native
  var _cartesiaErrorAt = 0; // when it was recorded — auto-retried after 5 min so one transient blip doesn't downgrade the whole session (audit #27)
  var _nativeUtter   = null;// current SpeechSynthesisUtterance (native path)
  var _nativeStallT  = null;// pending native stall-watchdog timer — cleared by _stopCurrent so a
                            // skipped chain can't be resurrected by a stale watchdog (v1.334, audit #4)
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
  // (the old _useNative() = isNative()||!_cartesiaOk() helper is retired — speak() now dispatches
  // through TTS_PROVIDERS[getEngine()].available(), which reproduces the same check for "cartesia"
  // and adds "piper"; see the speak() comment for the exact behavior-preservation argument.)

  // ── Toggle ─────────────────────────────────────────────────────────────────

  function toggle() {
    var on = !isOn();
    store.set(ON_K, on ? "1" : "");
    if (on) {
      _resumeCtx(_ensureCtx());  // create/resume NOW, inside the user gesture (v1.327: also revives an iOS-interrupted ctx)
      // v1.328: escalate to a real PLAYBACK audio session for ALL WebAudio narration, not just Car
      // Mode — iOS plays bare WebAudio in the "ambient" category, which the physical ringer/silent
      // switch mutes (while speechSynthesis ignores the switch: the exact native-works/Piper-silent
      // split reported from the phone with ctx state=running). The primer's silent loop, started
      // in-gesture, claims playback category: mute-switch-immune + consistent BT routing.
      primeAudioSession();
      if (getEngine() === "piper") prewarmPiper(resolvePiperVoice());  // §5 Q4 — off the critical path of the first real line
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

  // ── iOS context-state discipline (v1.327 — the phone-silence diagnosis) ────────────────────
  // Two iOS-only facts broke Piper AND Cartesia (both schedule on the shared ctx) while native
  // (speechSynthesis, no ctx) kept working, and desktop stayed fine:
  //   1. With the voice-ON flag persisted, a fresh page load never runs toggle() — the ctx is
  //      then created when the GM RESPONSE arrives, seconds after the tap, OUTSIDE any gesture.
  //      iOS births it "suspended" and denies resume() outside a gesture → scheduled audio is
  //      pure silence, no error, no fallback.
  //   2. iOS has a THIRD state, "interrupted" (tab-kill storms, route change, backgrounding);
  //      every old check read state==="suspended" only, so even a real Test-button tap skipped
  //      resume on an interrupted ctx and scheduled onto a stopped clock.
  // Discipline: _resumeCtx handles BOTH states; a one-time document-level tap unlock re-arms the
  // ctx in-gesture whenever it isn't running (the canonical iOS unlock); visibility-return also
  // retries; and synth entry points VERIFY state==="running" before scheduling — refusing
  // LOUDLY (toast + native fallback) instead of playing silence (no-silent-failures).
  function _resumeCtx(ctx) {
    if (!ctx) return;
    if (ctx.state === "suspended" || ctx.state === "interrupted") { try { return ctx.resume(); } catch(e) {} }
  }
  function _armCtxUnlock() {
    // One-shot capture-phase listeners: ANY user tap/keypress re-creates/resumes the ctx
    // in-gesture, then detaches. Re-armed whenever a synth finds the ctx not running.
    if (_armCtxUnlock._armed) return;
    _armCtxUnlock._armed = true;
    var fire = function() {
      document.removeEventListener("pointerdown", fire, true);
      document.removeEventListener("touchend",   fire, true);
      document.removeEventListener("keydown",    fire, true);
      _armCtxUnlock._armed = false;
      // v1.334 (audit #4): a USER-paused ctx (pause() suspended it deliberately) must stay
      // suspended until they press ▶ — the unlock is for iOS-blocked contexts only. Without
      // this guard any tap resumed paused narration while the bar still showed "paused".
      if (!_paused) _resumeCtx(_ensureCtx());
    };
    document.addEventListener("pointerdown", fire, true);
    document.addEventListener("touchend",   fire, true);
    document.addEventListener("keydown",    fire, true);
  }
  // Audit #14 (v1.340): a deliberate tab close / navigation mid-read is not a crash — mark the
  // crumb done so the boot forensics (loadSettings) don't false-alarm "narration died". Real
  // crashes and iOS memory-kills fire NEITHER event, so genuine deaths still surface. pagehide
  // covers iOS (where beforeunload is unreliable); beforeunload covers desktop.
  if (typeof window !== "undefined") {
    window.addEventListener("pagehide",     function() { _crumbDone(); });
    window.addEventListener("beforeunload", function() { _crumbDone(); });
  }
  // Interrupted → visible again (unlocked phone, returned to tab): try to resume; if iOS still
  // refuses, the next tap unlocks via the armed listener. (typeof guard: the headless test
  // runner loads tts.js with no DOM.)
  if (typeof document !== "undefined") document.addEventListener("visibilitychange", function() {
    // !_paused (v1.334, audit #4): a user pause suspends the same ctx — returning to the tab must
    // not auto-resume it (audio restarted by itself while the button showed ▶, state desync).
    if (!document.hidden && !_paused && _audioCtx && _audioCtx.state !== "running" && _audioCtx.state !== "closed") { _resumeCtx(_audioCtx); _armCtxUnlock(); }
  });
  // Wait briefly for the ctx to actually reach "running" (resume can settle async); resolves
  // true/false, never throws — callers refuse loudly on false.
  function _ctxRunning(ctx, waitMs) {
    return new Promise(function(res) {
      if (!ctx) return res(false);
      if (ctx.state === "running") return res(true);
      _resumeCtx(ctx);
      var t0 = Date.now();
      var iv = setInterval(function() {
        if (ctx.state === "running") { clearInterval(iv); res(true); }
        else if (Date.now() - t0 > (waitMs || 1500)) { clearInterval(iv); res(false); }
      }, 100);
    });
  }
  function _ctxBlockedLoud(engineLabel) {
    _armCtxUnlock();
    console.warn("[tts] AudioContext not running (state=" + (_audioCtx ? _audioCtx.state : "none") + ") — " + engineLabel + " line falls back to native; next tap unlocks");
    if (typeof showToast === "function") showToast("🔇 iOS paused game audio — speaking this line in the native voice; tap anywhere, then it recovers", 6000);
  }

  // WebAudio stall watchdog (audit #10, v1.339 — the v1.329 native watchdog's missing twin): iOS
  // can flip the shared ctx to "interrupted" MID-READ with no hide/show cycle and no event we act
  // on (e.g. a BT route change with the screen on). Scheduled audio freezes, onended never fires,
  // and _playing stays latched — the wedged-pipeline class, silently. While a WebAudio item plays,
  // poll: a non-running ctx the user did NOT pause gets a resume attempt, ONE loud toast, and the
  // tap unlock armed. No force-advance — scheduled sources survive suspend/interrupted and resume
  // seamlessly once the ctx runs again.
  var _ctxWatchT = null;
  function _armCtxWatch(engineLabel) {
    if (_ctxWatchT) return;
    var warned = false;
    _ctxWatchT = setInterval(function() {
      if (!_playing || _curNative) { _clearCtxWatch(); return; }
      if (_paused) return;   // a user pause suspends the same ctx deliberately (audit #4)
      if (_audioCtx && _audioCtx.state !== "running" && _audioCtx.state !== "closed") {
        _resumeCtx(_audioCtx);
        if (!warned) {
          warned = true;
          _armCtxUnlock();
          console.warn("[tts] AudioContext " + _audioCtx.state + " mid-" + engineLabel + " read — narration frozen; tap unlock armed");
          if (typeof showToast === "function") showToast("🔇 iOS paused game audio mid-narration — tap anywhere to resume", 6000);
        }
      } else warned = false;
    }, 2000);
  }
  function _clearCtxWatch() { if (_ctxWatchT) { clearInterval(_ctxWatchT); _ctxWatchT = null; } }

  // ── mediaSession positionState (Car Mode audit rank 23, todo_carplay.html) ─────────────────
  // Cosmetic, best-effort: without it, lock screens / head units show an inert 0:00 scrubber.
  // Piggybacks the _armCtxWatch/_clearCtxWatch lifecycle (same "a WebAudio item is playing" window)
  // rather than owning its own state — armed alongside the watchdog in _stream/_speakPiper, cleared
  // everywhere the watchdog is cleared (_drain's empty-queue branch, _stopCurrent). A light 2s poll,
  // never touches _nextStart/_sources, wrapped in try/catch so a missing/odd mediaSession API can
  // never throw into the scheduler.
  var _posStateT = null;
  function _armPosState(ctx) {
    if (_posStateT) return;
    if (!ctx || !("mediaSession" in navigator) || typeof navigator.mediaSession.setPositionState !== "function") return;
    var startedAt = ctx.currentTime;
    _posStateT = setInterval(function() {
      try {
        if (!_playing || _paused || !_audioCtx) return;
        // Coarse estimate: the scheduled span grown so far as "duration", now vs. start as "position".
        var dur = Math.max(0.1, _nextStart - startedAt);
        var pos = Math.max(0, Math.min(dur, ctx.currentTime - startedAt));
        navigator.mediaSession.setPositionState({ duration: dur, playbackRate: 1, position: pos });
      } catch(e) {}
    }, 2000);
  }
  function _clearPosState() {
    if (_posStateT) { clearInterval(_posStateT); _posStateT = null; }
    try {
      if ("mediaSession" in navigator && typeof navigator.mediaSession.setPositionState === "function")
        navigator.mediaSession.setPositionState({ duration: 0, playbackRate: 1, position: 0 });
    } catch(e) {}
  }

  function _closeCtx() {
    // v1.334 (audit #3): the primer node belongs to THIS ctx — clearing it here keeps
    // primeAudioSession()'s _primerSrc guard from short-circuiting on a dead node after a
    // voice off/on cycle (which silently lost the iOS playback-category session, v1.328).
    stopAudioSessionPrimer();
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
    _resumeCtx(ctx);   // v1.327: covers iOS "interrupted" too
    // v1.334 (audit #3): the guard must check the primer is on the CURRENT ctx — a primer left
    // over from a closed/replaced ctx is a dead node, and returning on it would leave the new
    // ctx with no playback-category claim (iOS mute-switch silence back again).
    if (_primerSrc && _primerSrc.context === ctx) return;
    stopAudioSessionPrimer();
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

  function loadSettings() {
    _syncBtn();
    // v1.327: voice-on persisted across a reload means toggle() never runs this session — the ctx
    // would otherwise be born OUTSIDE a gesture at first narration (iOS: suspended forever). Arm
    // the one-tap unlock so the user's first interaction creates/resumes it in-gesture.
    if (isOn()) {
      _armCtxUnlock();
      // Audit #8 (v1.339): the same reload path also skipped prewarm, so the ~9s WASM compile
      // landed inside the FIRST narration of every returning session — exactly what prewarm
      // (§5 Q4) exists to prevent. Boot prewarm is download-gated (see prewarmPiper): it warms
      // engine+voice only when the voice is already on disk; never a surprise 60MB download.
      if (getEngine() === "piper") prewarmPiper(resolvePiperVoice(), true);
    }
    // Crash forensics (v1.324): if the last Piper read never finished and was never user-stopped,
    // the tab died mid-read (the iOS kill class). Surface it LOUDLY — the phone has no console.
    try {
      var c = store.get(PIPER_CRUMB_K);
      if (c) {
        c = JSON.parse(c);
        store.del(PIPER_CRUMB_K);   // one-shot
        if (!c.done && typeof c.i === "number") {
          var msg = "⚠ Last narration died at sentence " + c.i + "/" + c.n + " (piper " + (c.rev || "?") + ", " + (c.app || "?") + ")";
          console.warn("[tts piper] " + msg);
          if (typeof showToast === "function") showToast(msg, 8000);
        }
      }
    } catch(e) {}
  }

  function _syncBtn() {
    var on = isOn();
    var el = document.getElementById("tts-btn");
    if (el) { el.textContent = on ? "🔊" : "🔇"; el.style.opacity = on ? "1" : "0.5"; }
  }

  // ── Public speak entry points ───────────────────────────────────────────────

  function speak(text, voiceId) {
    if (!text || !text.trim()) return;
    var trimmed = text.trim();
    _lastSpokenText = trimmed;

    var engine = getEngine();
    var prov = TTS_PROVIDERS[engine] || TTS_PROVIDERS.native;

    // Runtime degradation ladder — separate from selection (ENGINE_K/getEngine above). A selected
    // engine that isn't usable RIGHT NOW falls back to native for this item, unconditionally
    // (matches pre-Phase-4 _useNative() behavior: isNative() OR !_cartesiaOk() went straight to
    // native, no car-mode gating). Loud per no-silent-failures: warn + surface the reason in the
    // settings modal indicator so the user can see WHY they're hearing the fallback voice.
    if (engine !== "native" && !prov.available()) {
      console.warn("[tts] " + engine + " unavailable (" + prov.fallbackReason() + ") — falling back to native for this line");
      if (engine === "piper") _updatePiperErr();
      _queue.push({ text: trimmed, native: true });
      if (!_playing) _drain();
      return;
    }

    var item = prov.enqueue(trimmed, voiceId);
    if (!item) {
      // Provider is "available" but couldn't build an item this turn (Cartesia: no voice
      // configured). Preserves the exact old semantics: car mode still wants audio via native;
      // outside car mode this is a silent no-op (the pre-existing "no Cartesia voice configured"
      // early return).
      if (typeof carMode !== "undefined" && carMode) { _queue.push({ text: trimmed, native: true }); if (!_playing) _drain(); }
      return;
    }
    _queue.push(item);
    if (!_playing) _drain();
  }

  function speakResponse(cleanText) {
    if (!isOn() && !(typeof carMode !== "undefined" && carMode)) return;
    var trimmed = cleanText.trim();
    // Rank 17/18: record ONLY here (narration, not Test/other speak() callers), and persist onto
    // worldState so ⏮ survives a reload — it rides the existing saveAll cycles (no save call here).
    _lastNarration = trimmed;
    if (typeof worldState !== "undefined" && worldState && worldState.character) worldState.lastNarration = trimmed;
    speak(trimmed);
  }

  // Reload-tolerant read: in-memory copy first, else the persisted worldState fallback (rank 18).
  function _getLastNarration() {
    if (_lastNarration) return _lastNarration;
    if (typeof worldState !== "undefined" && worldState && worldState.lastNarration) return worldState.lastNarration;
    return "";
  }

  // ── Queue management ────────────────────────────────────────────────────────

  function _drain() {
    if (!_queue.length) {
      _playing = false;
      _paused  = false;
      _curNative = false;
      _clearCtxWatch();   // audit #10 — nothing left to guard
      _clearPosState();   // rank 23 — same lifecycle as the ctx watch above
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
      // v1.329: iOS speechSynthesis can sit PAUSED after an interruption — utterances then queue
      // forever with no onend/onerror, stranding _playing=true (the wedged-pipeline class: every
      // later speak/Test silently queues behind the phantom). Kick resume() (harmless elsewhere)…
      try { if (window.speechSynthesis.paused) window.speechSynthesis.resume(); } catch(e0) {}
      var u = new SpeechSynthesisUtterance(units[i].text);
      u.rate = getRate(); u.pitch = 1.0;
      var nv = _resolveNativeVoice();   // saved pick → preferred default → OS default
      if (nv) u.voice = nv;
      _nativeUtter = u;
      // …and arm a per-unit stall watchdog: if NEITHER event fires within a generous budget
      // (10s + 90ms/char — far beyond real speech onset+duration), force-advance LOUDLY so the
      // chain (and _playing) can never strand silently again.
      var advanced = false;
      var stallMs = 10000 + units[i].text.length * 90;
      var stallCheck = function() {
        if (advanced) return;
        // v1.334 (audit #4): a USER pause legitimately stops onend from firing — re-arm and wait
        // instead of force-advancing (the old path cancel()ed the paused utterance and the next
        // unit's resume-kick un-paused the engine: a >10s pause resumed all by itself). Keyed on
        // _paused (user intent) ONLY — speechSynthesis.paused without _paused is the iOS wedge
        // this watchdog exists to break, so that case still advances.
        if (_paused) { _nativeStallT = setTimeout(stallCheck, stallMs); return; }
        advanced = true;
        console.warn("[tts] native unit " + (i + 1) + "/" + units.length + " STALLED (" + stallMs + "ms, no onend/onerror — iOS wedge) — forcing the chain forward");
        try { window.speechSynthesis.cancel(); } catch(e1) {}
        _speakNativeUnit(units, i + 1);
      };
      _nativeStallT = setTimeout(stallCheck, stallMs);
      u.onend   = function() { if (advanced) return; advanced = true; clearTimeout(_nativeStallT); _speakNativeUnit(units, i + 1); };
      u.onerror = function(e) {
        if (advanced) return; advanced = true; clearTimeout(_nativeStallT);
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
    // Audit #17 (v1.341): a device where AudioContext can't be created at all used to DROP the
    // line silently (skip to _drain, no speech, no warning — every narration lost while the
    // voice toggle showed ON). Fall back to native like every other failure on this path.
    if (!ctx) { console.warn("[tts] AudioContext unavailable — Cartesia line falls back to native"); _curNative = true; _speakNative(text); return; }
    // v1.327: gate on the ctx actually RUNNING (handles iOS "interrupted" too — the old
    // suspended-only check scheduled Cartesia chunks onto a stopped clock = silence).
    _ctxRunning(ctx).then(function(ok) {
      if (!ok) { _ctxBlockedLoud("Cartesia"); _curNative = true; _speakNative(text); return; }
      primeAudioSession();   // v1.328: playback-category session — see toggle(); idempotent
      _armCtxWatch("Cartesia");   // audit #10 — catch a mid-read ctx interruption loudly
      _armPosState(ctx);   // rank 23 — same lifecycle as the ctx watch above
      _streamGo(text, voiceId, ctx);
    });
  }
  function _streamGo(text, voiceId, ctx) {
    var key = getKey();

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

  // ── Piper (local WASM) engine — TODO #41 Phase 3/4 ──────────────────────────
  // Vendored, same-origin ORT + vits-web (Phase 2: vendor/piper/, import map in index.html).
  // Dispatched from speak() via TTS_PROVIDERS.piper (Phase 4, above) and from _drain()'s
  // item.piper branch. Mirrors the shape of _stream() above: a synth-then-schedule loop
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
  var _piperPersistAsked = false;  // one persistent-storage request per session (audit #12) — see _piperEnsureVoiceNow
  var _piperDownloaded = {};   // voiceId -> true, session-local cache-hit memory for the settings
                                // modal's "not downloaded yet" indicator (_updatePiperErr, below).
                                // Populated by _piperEnsureVoice; deliberately NOT persisted and
                                // NOT authoritative — OPFS is the real cache, this is UI-only best-
                                // effort so opening the modal never forces an engine init/OPFS read.

  // Patch delivery for the ORT half (v1.336, audit #5): ort.wasm.min.js is revved by the ?tnd=
  // query on the import map entry (index.html); the .wasm binaries below this prefix CANNOT carry
  // a query (ORT builds URLs as prefix+filename), so a patched binary must be delivered by RENAME
  // (new filename = new URL = both permanent caches miss). Same trap class as PIPER_RUNTIME_REV.
  var PIPER_ORT_PATH = "/vendor/piper/ort/";
  // ⚠ DELIVERY (v1.324, the wasted-tries lesson): /vendor/piper/* is served cache-first from the
  // PERMANENT tnd-piper-v1 SW cache + an immutable HTTP header — an installed phone NEVER refetches
  // it on deploy, so a patched vits-web.js silently doesn't arrive (v1.322/v1.323 likely never ran
  // on the reporting phone). The ?tnd= query is the delivery mechanism: bump PIPER_RUNTIME_REV with
  // every vendored-file patch → new URL → both caches miss → fresh fetch. The vendored file exports
  // TND_VITS_PATCH with the same rev; _piperInit stores it and the Voice Settings Piper panel shows
  // it, so a phone can PROVE which runtime it runs before a test.
  // r7 (2026-07-17, Car Mode audit rank 20 — todo_carplay.html): predict() gained an optional
  // `rate` param (length_scale / rate) — see the T&D PATCH r7 comment in vits-web.js.
  var PIPER_RUNTIME_REV = "r7";
  var PIPER_LIB_PATH = "/vendor/piper/vits/vits-web.js?tnd=" + PIPER_RUNTIME_REV;
  var PIPER_CRUMB_K  = "tnd_piper_crumb_v1";  // last-read breadcrumb — survives a tab kill, read at boot
  var _piperPatchRev  = "";                   // TND_VITS_PATCH actually loaded (set by _piperInit)

  // Piper failure auto-retries after 5 min — same shape as _cartesiaOk() above. Backs both
  // TTS_PROVIDERS.piper.available() (speak()'s dispatch) and prewarmPiper (so a known-broken
  // engine isn't re-attempted on every TTS toggle-on inside the retry window).
  function _piperOk() {
    if (_piperError && Date.now() - _piperErrorAt > 300000) { _piperError = ""; _piperErrorAt = 0; _updatePiperErr(); }
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
      _piperPatchRev = _piperMod.TND_VITS_PATCH || "r0-unpatched";
      if (_piperPatchRev !== PIPER_RUNTIME_REV) console.warn("[tts piper] runtime rev mismatch: loaded " + _piperPatchRev + ", expected " + PIPER_RUNTIME_REV + " — a cache served a stale vendored file");
      _updatePiperErr();   // repaint the modal's runtime line if it's open
      return _piperMod;
    } catch(e) {
      _piperError = (e && e.message) || "Piper engine failed to load";
      _piperErrorAt = Date.now();
      console.warn("[tts piper] init failed:", _piperError);
      throw e;
    }
  }

  // Serialization gate (audit #9, v1.339): ONE Piper engine operation (voice ensure/download,
  // predict) at a time. prewarm's throwaway predict can overlap a real narration's (the epoch
  // guard discards stale RESULTS — it doesn't prevent overlap), and two concurrent ensures for a
  // missing voice each start their own ~60MB download (two OPFS writers on the same files).
  // Underneath sits ONE single-threaded wasm session — unserialized concurrent run() is undefined
  // behavior. The chain itself never rejects (failures propagate to the caller; the chain keeps
  // going), so one failed op can't wedge every later one.
  var _piperChain = Promise.resolve();
  function _piperSerial(fn) {
    var run = _piperChain.then(fn);
    _piperChain = run.then(function() {}, function() {});
    return run;
  }

  // stored() only proves an .onnx FILE exists — not that it has bytes (a tab killed during the
  // very first download leaves the 0-byte file OPFS pre-created, committed and listed forever),
  // nor that the .onnx.json config landed beside it (predict() would then silently fetch it from
  // HF at narration time — a network dependency while the modal says "downloaded"; offline, the
  // first unit fails). Audit #11 (v1.339): verify both files exist and are non-empty; any gap
  // re-runs the full download, which overwrites both.
  async function _piperVoiceComplete(voiceId) {
    try {
      var rel = ((_piperMod && _piperMod.PATH_MAP) || {})[voiceId];
      if (!rel) return true;   // id unknown to the map — defer to stored()'s verdict
      var base = rel.split("/").pop();
      var dir = await (await navigator.storage.getDirectory()).getDirectoryHandle("piper");
      var onnx = await (await dir.getFileHandle(base)).getFile();
      var json = await (await dir.getFileHandle(base + ".json")).getFile();
      return onnx.size > 0 && json.size > 0;
    } catch (e) { return false; }
  }

  // Ensure a voice model is cached (vits-web caches in OPFS); download with progress on first use.
  // Loud per the no-silent-failures rule: toast at start/end, coarse console.info during, toast +
  // console.warn + rethrow on failure. Richer download UI (a real progress bar) is Phase 4 — this
  // is the loud-not-silent floor. The check+download runs under _piperSerial (audit #9) so two
  // callers racing on a missing voice can't both download it.
  async function _piperEnsureVoice(voiceId) {
    var mod = await _piperInit();
    return _piperSerial(function() { return _piperEnsureVoiceNow(mod, voiceId); });
  }
  async function _piperEnsureVoiceNow(mod, voiceId) {
    // Audit #12 (v1.340): OPFS is best-effort storage — without a persistence grant the browser
    // may evict the 60–115MB voice models under pressure (witnessed live 2026-07-17: a desktop
    // profile dropped a 78MB voice between sessions), turning "downloaded once" into surprise
    // re-downloads. Ask once per session, on BOTH branches (already-downloaded voices need the
    // grant too). Chrome/Safari decide silently (no prompt); denial is non-fatal but logged —
    // eviction risk simply remains.
    if (!_piperPersistAsked && navigator.storage && navigator.storage.persist) {
      _piperPersistAsked = true;
      navigator.storage.persisted().then(function(already) {
        return already || navigator.storage.persist();
      }).then(function(granted) {
        if (!granted) console.warn("[tts piper] persistent-storage request DENIED — downloaded voices remain evictable");
      }).catch(function() {});
    }
    var stored = [];
    try { stored = await mod.stored(); } catch(e) { stored = []; }
    if (stored.indexOf(voiceId) !== -1 && await _piperVoiceComplete(voiceId)) { _piperDownloaded[voiceId] = true; _updatePiperErr(); return; }
    if (typeof showToast === "function") showToast("⬇ Downloading narrator voice (" + piperVoiceSize(voiceId) + ") — one-time, cached after");
    // Rank 9 (todo_carplay.html): mirror the download lifecycle into #car-status — the toast above
    // is invisible under #car-overlay (rank 1; also now fixed, but this is IN ADDITION, not instead).
    if (typeof carNotify === "function") carNotify("progress", "Downloading narrator voice (" + piperVoiceSize(voiceId) + ")…");
    var lastPct = -1;
    try {
      await mod.download(voiceId, function(p) {
        if (!p || !p.total) return;
        var pct = Math.floor((p.loaded / p.total) * 100 / 10) * 10;
        if (pct > 0 && pct !== lastPct) {
          lastPct = pct;
          console.info("[tts piper] " + voiceId + " download " + pct + "%");
          if (typeof carNotify === "function") carNotify("progress", "Voice download " + pct + "%");
        }
      });
    } catch(e) {
      _piperError = (e && e.message) || "voice download failed";
      _piperErrorAt = Date.now();
      console.warn("[tts piper] voice download failed:", _piperError);
      if (typeof showToast === "function") showToast("⚠ Narrator voice download failed — using fallback voice");
      if (typeof carNotify === "function") carNotify("error", "Voice download failed");
      throw e;
    }
    _piperDownloaded[voiceId] = true;
    _updatePiperErr();   // repaint the modal's "not downloaded yet" info line if it's open (found stale in Phase 5 preview)
    if (typeof showToast === "function") showToast("✓ Narrator voice ready");
    if (typeof carNotify === "function") carNotify("info", "Voice ready");
  }

  // Manual WAV→AudioBuffer decode (v1.321 — the iOS same-spot crash, part 2). WebKit's
  // decodeAudioData holds each call's decoded audio in the media daemon beyond JS reach, so the
  // v1.320 free-on-end couldn't return it — memory grew per UNIT DECODED and Safari killed the
  // tab at the same unit count every time (Chrome, which releases properly, played the whole
  // passage). Piper emits plain RIFF/PCM16, so we parse it ourselves into a ctx.createBuffer —
  // ordinary JS-heap memory that the free-on-end actually frees. Returns null on any unexpected
  // shape → caller falls back to decodeAudioData LOUDLY (never silent).
  function _wavToAudioBuffer(ab, ctx) {
    try {
      var dv = new DataView(ab);
      if (dv.byteLength < 44 || dv.getUint32(0, false) !== 0x52494646 || dv.getUint32(8, false) !== 0x57415645) return null; // "RIFF"…"WAVE"
      var pos = 12, fmt = null, dataOff = -1, dataLen = 0;
      while (pos + 8 <= dv.byteLength) {
        var id = dv.getUint32(pos, false), sz = dv.getUint32(pos + 4, true);
        if (id === 0x666d7420) fmt = { audioFormat: dv.getUint16(pos + 8, true), channels: dv.getUint16(pos + 10, true), sampleRate: dv.getUint32(pos + 12, true), bits: dv.getUint16(pos + 22, true) }; // "fmt "
        else if (id === 0x64617461) { dataOff = pos + 8; dataLen = Math.min(sz, dv.byteLength - dataOff); break; } // "data"
        pos += 8 + sz + (sz & 1);
      }
      if (!fmt || dataOff < 0 || fmt.audioFormat !== 1 || fmt.bits !== 16 || fmt.channels < 1) return null;
      var frames = Math.floor(dataLen / 2 / fmt.channels);
      if (frames <= 0) return null;
      var buf = ctx.createBuffer(fmt.channels, frames, fmt.sampleRate);
      for (var ch = 0; ch < fmt.channels; ch++) {
        var out = buf.getChannelData(ch);
        for (var f = 0; f < frames; f++) out[f] = dv.getInt16(dataOff + (f * fmt.channels + ch) * 2, true) / 32768;
      }
      return buf;
    } catch (e) { return null; }
  }

  // Synthesize + schedule one narration item through Piper. Sequential per-unit loop (mirrors
  // piper_test.html speakAll()): predict → decode → schedule on the shared AudioContext timeline.
  // The epoch guard runs after EVERY await (see section comment above) — this is what makes a
  // stopped/skipped narration safe against an unabortable WASM call resolving late.
  async function _speakPiper(text, voiceId) {
    var myEpoch = ++_piperEpoch;

    var ctx = _ensureCtx();
    // Audit #17 (v1.341): no ctx at all → native fallback, never a silent drop (see _stream).
    if (!ctx) { console.warn("[tts piper] AudioContext unavailable — line falls back to native"); _curNative = true; _speakNative(text); return; }
    // v1.327: require RUNNING (suspended AND iOS "interrupted" both resume-attempted; a ctx that
    // won't run refuses LOUDLY + native fallback instead of scheduling silence).
    var ctxOk = await _ctxRunning(ctx);
    if (_piperEpoch !== myEpoch) return;   // stale — a skip()/stop() ran while we awaited
    if (!ctxOk) { _ctxBlockedLoud("Piper"); _curNative = true; _speakNative(text); return; }
    primeAudioSession();   // v1.328: playback-category session — see toggle(); idempotent (_primerSrc guard)
    _armCtxWatch("Piper");   // audit #10 — catch a mid-read ctx interruption loudly
    _armPosState(ctx);   // rank 23 — same lifecycle as the ctx watch above

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

    // default dashRepl ", " — commas ARE the right dash style for Piper (spike finding, §2);
    // commaSplit=true: Piper gets its rhythm from scheduled gaps (see the pause tiers above)
    var units = splitSentences(text, null, true);
    if (!units.length) { _drain(); return; }

    // Per-unit crash journal (v1.324) — see _crumbDone/loadSettings. Written BEFORE each unit's
    // synth, so if the tab dies mid-predict the crumb names the killing unit.
    var _crumbBase = { n: units.length, rev: _piperPatchRev, app: (typeof APP_VERSION !== "undefined" ? APP_VERSION : "?") };
    function _crumb(iDone, done) {
      try { store.set(PIPER_CRUMB_K, JSON.stringify({ i: iDone, n: _crumbBase.n, rev: _crumbBase.rev, app: _crumbBase.app, done: !!done })); } catch(e) {}
    }
    _crumb(0, false);

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
      _crumb(i, false);   // about to synth unit i+1 — a tab kill here names it at next boot

      // Backpressure (v1.320 — the iOS long-passage crash): never synthesize more than
      // PIPER_MAX_AHEAD_SEC of audio past the playhead. The old synth-everything-ahead loop held
      // the WHOLE passage's decoded PCM in memory at once; on a long read, iOS's tab-memory
      // ceiling killed the page at the same spot every time ("A problem repeatedly occurred").
      // Synth runs 2-4× realtime, so a bounded lead never starves playback. ctx.currentTime
      // freezes while pause() suspends the context, which correctly pauses synthesis too.
      while (_piperEpoch === myEpoch && (nextStart - ctx.currentTime) > PIPER_MAX_AHEAD_SEC) {
        await new Promise(function(res) { setTimeout(res, 250); });
      }
      if (_piperEpoch !== myEpoch) return;   // stale — invalidated while waiting on the playhead

      var blob;
      try {
        // trailing space: documented static-tail guard; _piperSerial: audit #9 (never concurrent
        // with a prewarm predict or another flow's ensure/download on the shared wasm session)
        blob = await _piperSerial(function() { return mod.predict({ text: u.text + " ", voiceId: voiceId, rate: getRate() }); });
      } catch(e) {
        console.warn("[tts piper] synth failed on unit " + (i + 1) + "/" + units.length + ", skipping:", e && e.message);
        continue;
      }
      if (_piperEpoch !== myEpoch) return;   // stale — discard a predict() that resolved after invalidation

      var buf;
      try {
        var arrBuf = await blob.arrayBuffer();
        if (_piperEpoch !== myEpoch) return;   // stale — discard mid-decode
        buf = _wavToAudioBuffer(arrBuf, ctx);  // v1.321: manual PCM16 parse — bypasses WebKit's decodeAudioData daemon-side retention
        if (!buf) {
          console.warn("[tts piper] manual WAV parse failed on unit " + (i + 1) + "/" + units.length + " — falling back to decodeAudioData (iOS memory risk)");
          buf = await ctx.decodeAudioData(arrBuf);
        }
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
      nextStart  = startAt + buf.duration + unitGap(u);   // tiered: comma/clause/fullstop/paragraph (see PAUSE_* above)
      _nextStart = nextStart;

      activeSrcs++;
      _sources.push(src);
      src.onended = (function(mySrc) { return function() {
        activeSrcs--;
        // Free the played buffer (v1.320): disconnect + drop our reference so the decoded PCM can
        // GC as playback progresses — with the backpressure above, memory stays ~constant however
        // long the passage is. stop()/skip() only need the still-pending sources.
        try { mySrc.disconnect(); } catch(e) {}
        var ix = _sources.indexOf(mySrc); if (ix >= 0) _sources.splice(ix, 1);
        if (loopDone && activeSrcs === 0 && _piperEpoch === myEpoch) onAllDone();
      }; })(src);
    }

    loopDone = true;
    _crumb(units.length, true);   // synth loop completed — playback tail can't be "killed mid-synth"
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
  // Exported on the public API. Wired to TTS-enable by toggle() and to the settings modal's Save
  // handler (both: only when the selected engine is Piper) — see §5 Q4.
  function prewarmPiper(voiceId, onlyIfDownloaded) {
    if (!_piperOk()) return;   // known-broken within the retry window — don't hammer it every toggle-on
    var myEpoch = _piperEpoch;
    (async function() {
      try {
        var mod = await _piperInit();
        if (_piperEpoch !== myEpoch) return;
        if (onlyIfDownloaded) {
          // Boot-time prewarm (loadSettings, audit #8): warm the engine, but NEVER start a ~60MB
          // voice download the user didn't ask for this session — the first real narration
          // handles that (with its toast) exactly as before.
          var have = [];
          try { have = await mod.stored(); } catch (e0) { have = []; }
          if (have.indexOf(voiceId) === -1) return;
        }
        await _piperEnsureVoice(voiceId);
        if (_piperEpoch !== myEpoch) return;
        // discarded — just forces the WASM compile; serialized per audit #9
        await _piperSerial(function() { return mod.predict({ text: "warm up", voiceId: voiceId, rate: getRate() }); });
      } catch(e) {
        console.warn("[tts piper] prewarm failed (non-fatal):", e && e.message);
      }
    })();
  }

  // ── Car Mode support: earcons + replay (todo_carplay.html ranks 14, 17/18) ─────────────────
  // Both are exported for ui-carmode.js (typeof-guarded there — this file loads before it).

  // Two tiny WebAudio blips, deliberately OFF the narration scheduler: separate oscillator/gain
  // nodes wired straight to ctx.destination, never touching _nextStart/_sources, so they can never
  // shift a scheduled narration start or get swept by stop()/skip(). Quiet (gain ~0.08), <200ms.
  // No-op (console.debug only) if the ctx doesn't exist or isn't running — never throws, never
  // creates/resumes the ctx itself (that's a user-gesture concern owned by toggle()/primeAudioSession).
  function earcon(kind) {
    try {
      var ctx = _ensureCtx();   // reuse the shared ctx — creates it only if genuinely absent
      if (!ctx) { console.debug("[tts] earcon '" + kind + "' skipped — no AudioContext"); return; }
      _resumeCtx(ctx);          // best-effort; does not block — see the state check right below
      if (ctx.state !== "running") { console.debug("[tts] earcon '" + kind + "' skipped — ctx " + ctx.state); return; }
      var t0 = ctx.currentTime;
      function blip(offset, freq, dur) {
        var osc = ctx.createOscillator(), gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.value = freq;
        gain.gain.value = 0.08;
        osc.connect(gain);
        gain.connect(ctx.destination);
        var st = t0 + offset;
        osc.start(st);
        osc.stop(st + dur);
      }
      if (kind === "ready") { blip(0, 660, 0.08); blip(0.1, 880, 0.08); }   // two quick ascending blips
      else { blip(0, 740, 0.09); }                                          // "ack" — one short blip
    } catch(e) { console.debug("[tts] earcon failed:", e && e.message); }
  }

  // Rank 17/18: replay the last NARRATION (not whatever speak() last happened to say) without
  // discarding a second queued item. Reuses the public stop()/speak() path (not a bespoke synth
  // call) so the epoch guard, watchdogs, and engine ladder all apply exactly as they do to real
  // narration — no parallel machinery to keep in sync with the audited scheduler.
  function replayLast() {
    var text = _getLastNarration();
    if (!text) return false;
    var pending = _queue.slice();   // snapshot pending items BEFORE stop() clears the queue
    stop();                         // internal stop path: kills current audio/timers, clears queue
    speak(text);                    // normal dispatch — engine ladder applies; since !_playing this
                                     // also starts it immediately via _drain() (shifts this one item)
    for (var i = 0; i < pending.length; i++) _queue.push(pending[i]);   // requeue behind the replay
    if (!_playing) _drain();        // defensive, mirrors speak()'s own convention (normally a no-op —
                                     // speak() above already started draining in the common case)
    return true;
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
    if (_audioCtx.state !== "running") {   // v1.327: "suspended" OR iOS "interrupted" → resume; only a running ctx pauses
      _resumeCtx(_audioCtx);
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

  // Breadcrumb (v1.324): a crash-killed tab can't log, so _speakPiper journals per-unit progress to
  // localStorage; loadSettings() reads it at next boot. A record with done:false = the read DIED
  // there (crash) — user-initiated skip/stop marks done via _crumbDone below, so it never false-alarms.
  function _crumbDone() {
    try { var c = store.get(PIPER_CRUMB_K); if (c) { c = JSON.parse(c); c.done = true; store.set(PIPER_CRUMB_K, JSON.stringify(c)); } } catch(e) {}
  }
  function _stopCurrent() {
    _piperEpoch++;   // invalidate any in-flight Piper synth loop — unabortable WASM predict() must not schedule stale audio
    _crumbDone();    // a user skip/stop is not a crash — don't let the boot check report it as one
    _clearCtxWatch();   // audit #10 — the item the watchdog guarded is gone
    _clearPosState();   // rank 23 — same lifecycle as the ctx watch above
    if (_abortCtrl) { try { _abortCtrl.abort(); } catch(e) {} _abortCtrl = null; }
    if (_nativeStallT) { clearTimeout(_nativeStallT); _nativeStallT = null; }   // v1.334: a live watchdog would resurrect the cancelled chain
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

  // Red indicator beside the Piper voice label — mirrors _updateCartErr's shape exactly (one
  // span, error takes priority over the informational "not downloaded yet" note). Deliberately
  // synchronous (no await/init here — this file's async surface is confined to the four Piper
  // adapter functions, see the header comment): _piperDownloaded is session-local best-effort
  // memory populated by _piperEnsureVoice/_piperRefreshDownloaded, not a live OPFS query, so
  // opening the settings modal never forces an engine load just to paint this indicator.
  function _updatePiperErr() {
    var el = document.getElementById("tts-piper-err");
    if (!el) return;
    var msg = "", isErr = false;
    if (_piperError) {
      msg = "⚠ " + _piperError + " — using native voice";
      isErr = true;
    } else {
      var sel = document.getElementById("tts-piper-sel");
      var voiceId = sel ? sel.value : resolvePiperVoice();
      if (voiceId && !_piperDownloaded[voiceId]) msg = "voice not downloaded yet — downloads on first use (" + piperVoiceSize(voiceId) + ", cached)";
    }
    el.textContent = msg;
    el.title = msg;
    // red is reserved for real failures; the not-downloaded-yet line is info, not an error
    el.style.color = isErr ? "#e06060" : "var(--t2)";
    el.style.display = msg ? "inline" : "none";
    // Runtime provenance line (v1.324): lets a phone PROVE which vendored build it runs before a
    // test — "expected rN" until the engine loads, the loaded TND_VITS_PATCH after; a mismatch
    // means a cache served a stale vendored file (the v1.322/v1.323 delivery trap).
    var rt = document.getElementById("tts-piper-runtime");
    if (rt) rt.textContent = "Piper runtime: " + (_piperPatchRev ? _piperPatchRev + " (loaded)" : PIPER_RUNTIME_REV + " expected — engine loads on first use") + " · app " + (typeof APP_VERSION !== "undefined" ? APP_VERSION : "?");
  }

  // Non-blocking refresh of _piperDownloaded from the REAL on-disk store. v1.331: reads OPFS
  // directly (same 'piper' directory vits-web's stored() lists) so the modal's "not downloaded
  // yet" line is TRUTHFUL without engine init — the old engine-warm-only refresh left the line
  // pessimistic on fresh sessions, and that mis-read cost two rounds of on-phone diagnosis
  // (the model was on the device the whole time). Falls back to the engine listing when OPFS
  // isn't available. Plain .then() callbacks per the file's async-surface convention.
  function _piperRefreshDownloaded() {
    if (navigator.storage && navigator.storage.getDirectory) {
      navigator.storage.getDirectory().then(function(rootDir) {
        return rootDir.getDirectoryHandle("piper");
      }).then(function(dir) {
        var it = dir.keys(), found = [];
        function step() {
          return it.next().then(function(r) {
            if (r.done) return found;
            if (String(r.value).slice(-5) === ".onnx") found.push(String(r.value).split(".")[0]);   // same id rule as vits-web stored()
            return step();
          });
        }
        return step();
      }).then(function(ids) {
        for (var i = 0; i < ids.length; i++) _piperDownloaded[ids[i]] = true;
        _updatePiperErr();
      }).catch(function() {});   // no OPFS dir yet = genuinely not downloaded — the line stays honest
    }
    if (!_piperMod || typeof _piperMod.stored !== "function") return;
    _piperMod.stored().then(function(stored) {
      for (var i = 0; i < stored.length; i++) _piperDownloaded[stored[i]] = true;
      _updatePiperErr();
    }).catch(function() {});
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
      try { if (speechSynthesis.paused) speechSynthesis.resume(); } catch(e0) {}   // v1.329: unstick an iOS-paused engine
      var u = new SpeechSynthesisUtterance(TTS_TEST_LINE);
      var v = _findNativeVoice(name); if (v) u.voice = v;
      u.rate = getRate();
      speechSynthesis.speak(u);
    } catch (e) {}
  }

  function _buildPiperVoiceOptions() {
    var cur = resolvePiperVoice(), html = "";
    for (var i = 0; i < PIPER_VOICES.length; i++) {
      var v = PIPER_VOICES[i];
      html += "<option value='" + v.id + "'" + (v.id === cur ? " selected" : "") + ">" + _escVal(v.label) + "</option>";
    }
    return html;
  }

  function _piperVoiceBlurb(id) {
    for (var i = 0; i < PIPER_VOICES.length; i++) { if (PIPER_VOICES[i].id === id) return PIPER_VOICES[i].blurb; }
    return "";
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
    var inpStyle = "width:100%;padding:8px 10px;background:var(--bg3);border:1px solid var(--brd);border-radius:6px;color:var(--t0);font-size:13px;box-sizing:border-box;";
    var smInpStyle = "width:100%;padding:6px 8px;background:var(--bg2);border:1px solid var(--brd);border-radius:4px;color:var(--t0);font-size:12px;box-sizing:border-box;margin-bottom:6px;";
    // One engine panel at a time (user call 2026-07-16, from the phone screenshot: every option on
    // screen at once was a mess). A radio picks the engine; only that engine's options render.
    // All pre-existing element IDs survive inside the panels, so the Save handler and every
    // _update*/_refresh* helper work unchanged; a hidden panel's controls still carry state.
    var eng0 = getEngine();
    function radioRow(id, label) {
      var checked = (eng0 === id) ? " checked" : "";
      return "<label style='display:flex;align-items:center;gap:8px;padding:7px 10px;border:1px solid " + (eng0 === id ? "var(--acc)" : "var(--brd)") + ";border-radius:6px;cursor:pointer;margin-bottom:6px;' data-eng-row='" + id + "'>"
        + "<input type='radio' name='tts-engine' value='" + id + "'" + checked + " style='accent-color:var(--acc);margin:0;'/>"
        + "<span style='font-size:13px;color:var(--t0);'>" + label + "</span>"
        + "</label>";
    }
    /* #14: modalShell (global, ui-shell.js) — callable from this IIFE at run time */
    var modal = modalShell("tts-modal",
      "<div style='display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;'>"
      +   "<span style='font-size:16px;color:var(--t0);font-weight:bold;'>&#128266; Voice Settings</span>"
      +   "<button id='tts-modal-x' style='background:none;border:none;color:var(--t2);font-size:20px;cursor:pointer;'>&#215;</button>"
      + "</div>"
      // Rank 20 (todo_carplay.html): speech rate — applies to Native + Piper; Cartesia is served
      // as-is (no rate knob on that path). Placed ABOVE the engine block since it isn't engine-specific.
      + "<div style='margin-bottom:16px;'>"
      +   "<div style='display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;'>"
      +     "<label style='font-size:12px;color:var(--t2);'>Speech rate</label>"
      +     "<span id='tts-rate-val' style='font-size:11px;color:var(--t2);'>" + getRate().toFixed(2) + "&times;</span>"
      +   "</div>"
      +   "<input id='tts-rate-sel' type='range' min='0.8' max='1.3' step='0.05' value='" + getRate() + "' style='width:100%;accent-color:var(--acc);'/>"
      +   "<div style='font-size:11px;color:var(--t2);margin-top:2px;'>Native + Piper only. (Cartesia unaffected)</div>"
      + "</div>"
      + "<div style='margin-bottom:16px;'>"
      +   "<label style='font-size:12px;color:var(--t2);display:block;margin-bottom:6px;'>Voice engine</label>"
      +   radioRow("cartesia", "Cartesia <span style='color:var(--t2);'>(cloud, high quality)</span>")
      +   radioRow("piper",    "Piper <span style='color:var(--t2);'>(local, offline, free)</span>")
      +   radioRow("native",   "Native <span style='color:var(--t2);'>(this device's built-in voices)</span>")
      +   "<div id='tts-engine-hint' style='font-size:11px;color:var(--t2);margin-top:2px;'>" + _escVal(TTS_PROVIDERS[eng0].hint) + "</div>"
      +   "<div id='tts-audio-diag' style='font-size:11px;color:var(--t2);margin-top:4px;font-family:var(--font-mono,monospace);'></div>"
      + "</div>"
      // ── Cartesia panel ──
      + "<div id='tts-panel-cartesia' style='display:" + (eng0 === "cartesia" ? "block" : "none") + ";'>"
      +   "<div style='margin-bottom:10px;'>"
      +     "<div style='display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:6px;'>"
      +       "<label style='font-size:12px;color:var(--t2);'>Cartesia API Key</label>"
      +       "<span id='tts-cart-err' style='font-size:11px;color:#e06060;display:none;'></span>"
      +     "</div>"
      +     "<input id='tts-key-inp' type='password' placeholder='sk_car_...' value='" + _escVal(getKey()) + "' style='" + inpStyle + "'/>"
      +   "</div>"
      +   "<div style='margin-bottom:20px;'>"
      +     "<div style='display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;'>"
      +       "<label style='font-size:12px;color:var(--t2);'>Narrator Voice</label>"
      +       "<button id='tts-add-btn' style='font-size:11px;background:none;border:1px solid var(--brd2);border-radius:4px;color:var(--t2);cursor:pointer;padding:2px 8px;'>+ Add</button>"
      +     "</div>"
      +     "<select id='tts-voice-sel' style='" + inpStyle + "'>" + _buildVoiceOptions() + "</select>"
      +     "<div id='tts-add-form' style='display:none;margin-top:10px;background:var(--bg3);border:1px solid var(--brd2);border-radius:6px;padding:10px;'>"
      +       "<input id='tts-add-name' type='text' placeholder='Voice name (e.g. Gravely Narrator)' style='" + smInpStyle + "'/>"
      +       "<input id='tts-add-id' type='text' placeholder='Cartesia voice UUID' style='" + smInpStyle + "font-family:var(--font-mono);'/>"
      +       "<div style='display:flex;gap:6px;'>"
      +         "<button id='tts-add-save' style='flex:1;padding:6px;background:var(--acc);border:none;border-radius:4px;color:#000;font-size:12px;cursor:pointer;font-family:var(--font);'>Save</button>"
      +         "<button id='tts-add-cancel' style='padding:6px 10px;background:none;border:1px solid var(--brd2);border-radius:4px;color:var(--t2);font-size:12px;cursor:pointer;'>Cancel</button>"
      +       "</div>"
      +     "</div>"
      +     "<div id='tts-bank-rows'>" + _buildBankRows() + "</div>"
      +     "<div style='font-size:11px;color:var(--t2);margin-top:6px;'>If Cartesia is unavailable, narration falls back to your Native voice (set it under Native).</div>"
      +   "</div>"
      + "</div>"
      // ── Piper panel ──
      + "<div id='tts-panel-piper' style='display:" + (eng0 === "piper" ? "block" : "none") + ";'>"
      +   "<div style='margin-bottom:20px;'>"
      +     "<div style='display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:6px;'>"
      +       "<label style='font-size:12px;color:var(--t2);'>Piper voice</label>"
      +       "<span id='tts-piper-err' style='font-size:11px;color:#e06060;display:none;'></span>"
      +     "</div>"
      +     "<div style='display:flex;gap:6px;'>"
      +       "<select id='tts-piper-sel' style='" + inpStyle + "flex:1;'>" + _buildPiperVoiceOptions() + "</select>"
      +       "<button id='tts-piper-test' style='flex-shrink:0;padding:0 12px;background:none;border:1px solid var(--brd2);border-radius:6px;color:var(--t1);font-size:12px;cursor:pointer;white-space:nowrap;'>&#9654; Test</button>"
      +     "</div>"
      +     "<div id='tts-piper-blurb' style='font-size:11px;color:var(--t2);margin-top:4px;'>" + _escVal(_piperVoiceBlurb(resolvePiperVoice())) + "</div>"
      +     "<div id='tts-piper-runtime' style='font-size:11px;color:var(--t2);margin-top:4px;font-family:var(--font-mono,monospace);'></div>"
      +     "<div style='font-size:11px;color:var(--t2);margin-top:6px;'>If Piper is unavailable, narration falls back to your Native voice (set it under Native).</div>"
      +   "</div>"
      + "</div>"
      // ── Native panel ──
      + "<div id='tts-panel-native' style='display:" + (eng0 === "native" ? "block" : "none") + ";'>"
      +   "<div style='margin-bottom:20px;'>"
      +     "<label style='font-size:12px;color:var(--t2);display:block;margin-bottom:6px;'>Native voice</label>"
      +     "<div style='display:flex;gap:6px;'>"
      +       "<select id='tts-nvoice-sel' style='" + inpStyle + "flex:1;'>" + _buildNativeVoiceOptions() + "</select>"
      +       "<button id='tts-nvoice-test' style='flex-shrink:0;padding:0 12px;background:none;border:1px solid var(--brd2);border-radius:6px;color:var(--t1);font-size:12px;cursor:pointer;white-space:nowrap;'>&#9654; Test</button>"
      +     "</div>"
      +     "<div style='font-size:11px;color:var(--t2);margin-top:4px;'>Also the shared FALLBACK whenever Cartesia or Piper is unavailable — worth setting even if you use another engine. Windows 11 has neural voices (Aria, Guy); on iOS, download Enhanced voices in Settings &#8250; Accessibility &#8250; Spoken Content &#8250; Voices.</div>"
      +   "</div>"
      + "</div>"
      + "<button id='tts-save-btn' style='width:100%;padding:10px;background:var(--acc);border:none;border-radius:6px;color:#000;font-family:var(--font);font-size:14px;font-weight:bold;cursor:pointer;'>Save</button>",
      { align: "flex-start", overlayExtra: "overflow-y:auto;", boxBg: "#181818", maxWidth: 480, boxExtra: "margin-top:60px;", closeId: "tts-modal-x", outside: true });

    _updateCartErr();
    _updatePiperErr();
    _piperRefreshDownloaded();   // best-effort — only does anything if the engine is already warm

    // v1.327 on-device audio diagnostics: the phone has no console, so the modal SHOWS the shared
    // AudioContext's state — "running" is the only state that produces sound on the Piper/Cartesia
    // paths; "suspended"/"interrupted" here IS the silence diagnosis, live-updating on statechange.
    function _updateAudioDiag() {
      var d = document.getElementById("tts-audio-diag");
      if (!d) return;
      var st = _audioCtx ? _audioCtx.state : "not created yet";
      // v1.329: pipeline state too — a wedged _playing latch ("speaking" with nothing audible and
      // items queued) is exactly the phone-visible signature of the stranded-fallback class.
      var pipe = (_playing ? "speaking" : "idle") + (_queue.length ? " +" + _queue.length + " queued" : "");
      d.textContent = "Audio: " + st + " · voice " + (isOn() ? "ON" : "off") + " · " + pipe + (st === "running" ? "" : st === "not created yet" ? " (created on first use/tap)" : " ⚠ no sound until running — tap 🔊 off/on");
      d.style.color = (st === "running" || st === "not created yet") ? "var(--t2)" : "#e0a060";
    }
    _updateAudioDiag();
    if (_audioCtx) _audioCtx.onstatechange = _updateAudioDiag;
    // The ctx may be CREATED (or replaced) while the modal is open — a 1s self-clearing poll keeps
    // the line honest; it stops itself as soon as the modal is gone.
    var _diagPoll = setInterval(function() {
      if (!document.getElementById("tts-modal")) { clearInterval(_diagPoll); return; }
      _updateAudioDiag();
      if (_audioCtx && _audioCtx.onstatechange !== _updateAudioDiag) _audioCtx.onstatechange = _updateAudioDiag;
    }, 1000);

    function _setEnginePanels(engine) {
      var panels = { cartesia: "tts-panel-cartesia", piper: "tts-panel-piper", native: "tts-panel-native" }, k;
      for (k in panels) { var el = document.getElementById(panels[k]); if (el) el.style.display = (k === engine) ? "block" : "none"; }
      var rows = modal.querySelectorAll("[data-eng-row]");
      for (var r = 0; r < rows.length; r++) rows[r].style.borderColor = (rows[r].getAttribute("data-eng-row") === engine) ? "var(--acc)" : "var(--brd)";
      var hintEl = document.getElementById("tts-engine-hint");
      if (hintEl) hintEl.textContent = TTS_PROVIDERS[engine].hint;
    }
    // Rank 20: live-write on drag — takes effect on the NEXT synth call (getRate() reads store live).
    var rateSel = document.getElementById("tts-rate-sel");
    if (rateSel) {
      rateSel.addEventListener("input", function() {
        store.set(RATE_K, this.value);
        var rv = document.getElementById("tts-rate-val");
        if (rv) rv.textContent = parseFloat(this.value).toFixed(2) + "×";
      });
    }
    var radios = modal.querySelectorAll("input[name='tts-engine']");
    for (var ri = 0; ri < radios.length; ri++) {
      radios[ri].addEventListener("change", function() {
        // Live-writes on change (same pattern the old engine select used) so the choice takes
        // effect immediately, not just after Save. NATIVE_K stays in lockstep for back-compat —
        // getEngine() reads ENGINE_K first and only falls through to NATIVE_K when ENGINE_K is unset.
        store.set(ENGINE_K, this.value);
        store.set(NATIVE_K, this.value === "native" ? "1" : "");
        _setEnginePanels(this.value);
        _updateCartErr();
        _updatePiperErr();
      });
    }

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

    document.getElementById("tts-piper-sel").addEventListener("change", function() {
      var blurb = document.getElementById("tts-piper-blurb");
      if (blurb) blurb.textContent = _piperVoiceBlurb(this.value);
      _updatePiperErr();
    });
    document.getElementById("tts-piper-test").addEventListener("click", function() {
      var s = document.getElementById("tts-piper-sel");
      var voiceId = s ? s.value : resolvePiperVoice();
      // v1.329: PRE-EMPT — a Test tap should interrupt whatever is (or claims to be) speaking.
      // stop() also resets a wedged _playing latch (the phone incident: a stranded native
      // fallback left _playing=true, so Test taps queued silently forever — "does nothing").
      stop();
      // Reuses the normal queue/dispatch path (not a bespoke call) so pause/skip/stop and the
      // epoch guard all apply to the audition exactly as they would to real narration.
      _queue.push({ text: TTS_TEST_LINE, piper: true, voiceId: voiceId });
      _drain();
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
      var echk = modal.querySelector("input[name='tts-engine']:checked");
      var engine = echk ? echk.value : getEngine();
      store.set(ENGINE_K, engine);
      store.set(NATIVE_K, engine === "native" ? "1" : "");   // back-compat (see the engine-sel change listener)
      var nvs = document.getElementById("tts-nvoice-sel"); if (nvs) { if (nvs.value) store.set(NVOICE_K, nvs.value); else store.del(NVOICE_K); }
      var psel = document.getElementById("tts-piper-sel");
      if (psel && psel.value) savePiperVoice(psel.value);   // proseAuthor two-tier save — see savePiperVoice() above
      if (engine === "piper" && isOn()) prewarmPiper(resolvePiperVoice());   // §5 Q4 — also pre-warm right after enabling Piper from here
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
    // Car Mode support (todo_carplay.html) — Lane A (ui-carmode.js) calls both with typeof guards.
    earcon:            earcon,       // kind: "ack" | "ready" — oscillator blips, off the narration scheduler
    replayLast:        replayLast,   // replays the last NARRATION (not Test/other speak() calls), queue-preserving
    showSettingsModal: showSettingsModal,
    primeAudioSession:     primeAudioSession,
    stopAudioSessionPrimer: stopAudioSessionPrimer,
    // Piper (TODO #41 Phase 3) — fire-and-forget pre-warm. Wired to TTS-enable (toggle()) and to
    // the settings-modal Save handler, both gated on Piper being the selected engine, so the ~9s
    // one-time WASM compile happens off the critical path of the user's first real narration.
    prewarmPiper:      prewarmPiper,
    // Engine selection (TODO #41 Phase 4) — public because other surfaces (File menu labels, Car
    // Mode) may reasonably want to know/resolve the active choice, not just the settings modal.
    getEngine:         getEngine,
    resolvePiperVoice: resolvePiperVoice,
    // Internal — exported ONLY for the headless engine tests (dev/engine-tests.js) and for the
    // later Piper provider phases (TODO #41) to reuse. Not a supported external call surface.
    _textPrep: { normalizeForTTS: normalizeForTTS, splitSentences: splitSentences, packLongUnit: packLongUnit, unitGap: unitGap,
                 pauses: function() { return { comma: PAUSE_COMMA, clause: PAUSE_COMMA_CLAUSE, fullstop: PAUSE_FULLSTOP, paragraph: PAUSE_PARAGRAPH }; } }
  };

})();
