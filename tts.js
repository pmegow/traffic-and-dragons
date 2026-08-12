// tts.js — local Piper TTS (WASM, offline, $0) over a shared Web Audio scheduler, with the
// browser's speechSynthesis as the silent fallback voice
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

  var ON_K     = "tnd_tts_on_v1";
  var NVOICE_K = "tnd_tts_nvoice_v1";   // chosen native voice, stored BY NAME (voice list differs per device)
  var NVOICE_DEFAULT = "Google US English"; // preferred voice when the user hasn't picked one (falls back to OS default if absent)
  var TTS_TEST_LINE = "The lightless mass rotates, and the weapon-notation locks into place.";

  // ── Speech rate (Car Mode audit rank 20, todo_carplay.html) ─────────────────────────────────
  // Applies to native (utterance.rate) and Piper (length_scale / rate, vendored patch r7).
  var RATE_K = "tnd_tts_rate_v1";
  function getRate() {
    var v = parseFloat(store.get(RATE_K));
    if (isNaN(v) || v < 0.8 || v > 1.3) return 1.0;
    return v;
  }

  // ── Engine selection ────────────────────────────────────────────────────────
  // Selection (getEngine) is INTENT; runtime availability (_piperOk) is a separate ladder that can
  // still downgrade the engine to native for one item — see speak().

  // ── Piper voice stable (TODO #41 Phase 4, §5 Q6 — mirrors AUTHORS/proseAuthor) ──────────────
  // The 8 voices validated in the piper_test.html spike. "medium" models run ~60MB, "high" larger;
  // vits-web caches the .onnx in OPFS after the first download, so the cost is paid once per voice
  // per device/origin.
  // size: real model download size (HEAD-checked against HF 2026-07-17, audit #16) — this is the
  // number a user on cellular consents to, so it must be per-voice truth, not a shared "~60MB".
  // #9 rework (v1.395): the user-curated English voice set (via voice_picker.html). Every id here
  // is confirmed present in the vendored vits-web runtime catalog — a voice in the picker's rhasspy
  // manifest but NOT in vits-web (mike, norman) would show in the dropdown yet fail to download, so
  // those two were dropped. `speakers` > 1 marks the multi-speaker models (one download, many voices
  // — the #9 ⑦ goldmine; per-speaker selection is a later step). Default is libritts_r (see
  // resolvePiperVoice) — the old lessac-medium default was dropped from the set.
  var PIPER_VOICES = [
    { id:"en_GB-alba-medium", label:"Alba — UK female", size:"60MB", speakers:1,
      blurb:"First use downloads once (60MB), then cached." },
    { id:"en_GB-aru-medium", label:"Aru — UK, 12-speaker", size:"73MB", speakers:12,
      blurb:"Multi-speaker model: 12 distinct voices in one download. First use downloads once (73MB), then cached." },
    { id:"en_GB-cori-high", label:"Cori — UK, high quality", size:"109MB", speakers:1,
      blurb:"First use downloads once (109MB), then cached." },
    { id:"en_GB-jenny_dioco-medium", label:"Jenny — UK female", size:"60MB", speakers:1,
      blurb:"First use downloads once (60MB), then cached." },
    { id:"en_GB-northern_english_male-medium", label:"Northern English male — UK", size:"60MB", speakers:1,
      blurb:"First use downloads once (60MB), then cached." },
    { id:"en_GB-semaine-medium", label:"Semaine — UK, 4-speaker", size:"73MB", speakers:4,
      blurb:"Multi-speaker model: 4 distinct voices in one download. First use downloads once (73MB), then cached." },
    { id:"en_GB-southern_english_female-low", label:"Southern English female — UK", size:"60MB", speakers:1,
      blurb:"First use downloads once (60MB), then cached." },
    { id:"en_GB-vctk-medium", label:"VCTK — UK, 109-speaker", size:"73MB", speakers:109,
      blurb:"Multi-speaker model: 109 distinct voices in one download. First use downloads once (73MB), then cached." },
    { id:"en_US-arctic-medium", label:"Arctic — US, 18-speaker", size:"73MB", speakers:18,
      blurb:"Multi-speaker model: 18 distinct voices in one download. First use downloads once (73MB), then cached." },
    { id:"en_US-danny-low", label:"Danny — US male", size:"60MB", speakers:1,
      blurb:"First use downloads once (60MB), then cached." },
    { id:"en_US-hfc_female-medium", label:"HFC female — US", size:"60MB", speakers:1,
      blurb:"First use downloads once (60MB), then cached." },
    { id:"en_US-hfc_male-medium", label:"HFC male — US", size:"60MB", speakers:1,
      blurb:"First use downloads once (60MB), then cached." },
    { id:"en_US-joe-medium", label:"Joe — US male", size:"60MB", speakers:1,
      blurb:"First use downloads once (60MB), then cached." },
    { id:"en_US-kathleen-low", label:"Kathleen — US female", size:"60MB", speakers:1,
      blurb:"First use downloads once (60MB), then cached." },
    { id:"en_US-kristin-medium", label:"Kristin — US female", size:"61MB", speakers:1,
      blurb:"First use downloads once (61MB), then cached." },
    { id:"en_US-lessac-high", label:"Lessac — US, high quality", size:"109MB", speakers:1,
      blurb:"First use downloads once (109MB), then cached." },
    { id:"en_US-libritts-high", label:"LibriTTS — US, 904-speaker", size:"130MB", speakers:904,
      blurb:"Multi-speaker model: 904 distinct voices in one download. First use downloads once (130MB), then cached." },
    { id:"en_US-libritts_r-medium", label:"LibriTTS R — US, 904-speaker (default)", size:"75MB", speakers:904,
      blurb:"Multi-speaker model: 904 distinct voices in one download. First use downloads once (75MB), then cached." },
    { id:"en_US-ryan-high", label:"Ryan — US male, high quality", size:"115MB", speakers:1,
      blurb:"First use downloads once (115MB), then cached." }
  ];
  var PIPER_VOICE_DEFAULT = "en_US-libritts_r-medium";

  // ── #95 speaker casting (S1) — the composite voice id ────────────────────────────────────────
  // A voiceId may carry a SPEAKER suffix: "<modelId>#<speaker>", e.g. "en_US-libritts_r-medium#204".
  // The multi-speaker models already on disk carry hundreds of voices in ONE file (libritts_r: 904),
  // so a cast voice costs no extra download. It rides everywhere a voiceId rides today — strings,
  // no schema change.
  //
  // ⛨ These two are THE ONE place a composite id is taken apart. Every known-ness / protection /
  // LRU / download / eviction decision normalizes through voiceBaseId FIRST, because the OPFS store
  // and the LRU know only base model ids: five characters cast on …#204/#611/#88 each look
  // "unassigned" against the base the LRU holds, and releasing one would delete the ONE model file
  // they all depend on (the F11 class — spec R1 ▸ "Required correctness piece"). No scattered
  // split("#") anywhere else; the run-tests VOICE DELETE CONTRACT pins that.
  //
  // Split on the LAST "#". A NON-NUMERIC suffix (including an empty one, "id#") is not a speaker —
  // the WHOLE string is then treated as a base id, so a malformed id can never be silently
  // truncated into a different, valid model; it simply fails the catalog check and snaps to the
  // default like any other unknown voice.
  function voiceBaseId(id) {
    var s = (id == null) ? "" : String(id);
    var i = s.lastIndexOf("#");
    if (i < 0) return s;
    return /^\d+$/.test(s.slice(i + 1)) ? s.slice(0, i) : s;
  }
  function voiceSpeaker(id) {
    var s = (id == null) ? "" : String(id);
    var i = s.lastIndexOf("#");
    if (i < 0) return null;
    var spk = s.slice(i + 1);
    return /^\d+$/.test(spk) ? parseInt(spk, 10) : null;   // "#0" is a real speaker — never truthiness-tested
  }

  // S2 (ratified, spec R1): NO vendored-runtime patch. Local Piper (vits-web) cannot select a
  // speaker unpatched, and patching it means a PIPER_RUNTIME_REV bump into the permanent-cache
  // delivery trap that ate v1.322/v1.323 — plus wasm surface the whole B9 arc argues against
  // touching. So the LOCAL path speaks the BASE model (its default speaker): same voice family,
  // and a composite id reaching predict()/download() would be an unknown PATH_MAP key — i.e. a
  // failed 60–130MB download inside a live read. The SERVER tier gets the real speaker.
  // Loud once per session (not per unit — a 40-unit read would spam the console it belongs in).
  var _speakerLocalNoted = false;
  function _localVoiceId(id) {
    var base = voiceBaseId(id);
    if (base !== id && !_speakerLocalNoted) {
      _speakerLocalNoted = true;
      console.info("[tts piper] speaker voices play server-side; local read uses the base voice (" + base + ")");
    }
    return base;
  }

  // #95: known-ness is a property of the BASE. "en_US-libritts_r-medium#204" is a valid pin the
  // snap guard must NOT eat (it would silently evaporate every cast voice on load); an unknown
  // base snaps to the default exactly as before, speaker suffix or not.
  function _piperVoiceKnown(id){ var b=voiceBaseId(id); for(var i=0;i<PIPER_VOICES.length;i++){ if(PIPER_VOICES[i].id===b) return true; } return false; }
  function piperVoiceSize(id) {
    var b = voiceBaseId(id);   // #95: the download is the MODEL — a speaker suffix costs no bytes
    for (var i = 0; i < PIPER_VOICES.length; i++) { if (PIPER_VOICES[i].id === b) return PIPER_VOICES[i].size; }
    return "60–115MB";
  }
  var PVOICE_K = "tnd_piper_voice_v1"; // device-default Piper voice id

  // Two-tier voice scope — EXACTLY the worldState.proseAuthor pattern (ui.js showProseModal /
  // PROSE_K): a per-campaign pick rides the sync blob (worldState.piperVoice) and wins when set;
  // an unset/pre-game campaign falls back to the device default (PVOICE_K); an unset device falls
  // back to the house default voice. Guard every worldState access — tts.js can run pre-game,
  // and worldState itself is `null` until a campaign is loaded (state.js).
  function resolvePiperVoice() {
    // #9 rework: snap a stored preference that is no longer in the curated set (e.g. a dropped
    // voice from a pre-rework save) to the default, so piperVoiceSize/blurb/dropdown never resolve
    // an unknown id (which would show "Downloading (undefined)" and no selection).
    var want = (typeof worldState !== "undefined" && worldState && worldState.piperVoice) || store.get(PVOICE_K) || "";
    return (want && _piperVoiceKnown(want)) ? want : PIPER_VOICE_DEFAULT;
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

  // getEngine() — #9 rework (v1.398): the engine PICKER is gone; selection is RESOLVED, never
  // stored. #90 (v1.435) adds the server tier on top: a connected, healthy TTS server wins,
  // otherwise Piper is THE local engine exactly as before — so on any offline/unconnected device
  // this still resolves to the same constant "piper" it has been since the rework. The retired
  // storage keys (tnd_tts_engine_v1, tnd_tts_native_v1) still cannot resurrect anything —
  // engine-tested. Native survives ONLY as the automatic fallback target (the runtime ladder in
  // speak() + the iOS-audio-suspend path call TTS_PROVIDERS.native directly, NOT via getEngine),
  // so a device where neither the server nor Piper can run still speaks.
  function getEngine() { return _serverTtsOk() ? "server" : "piper"; }

  // ── Server TTS tier (#90 M1, v1.435 — the B9 architectural close) ────────────────────────────
  // Synthesis moved OFF the phone: POST /api/tts on the tnd-tts Fly app (server repo, tts/) runs
  // the SAME curated Piper voices server-side and returns one WAV per speakable unit — zero
  // client wasm work, so the iOS energy assassin (DOC/BUGS.md ▸ B9) has nothing to kill. Local
  // Piper + the v1.434 governor remain the offline tier forever; the governor never meters this
  // tier (there is no client work to budget).
  var TTS_SERVER_URL = "https://tnd-tts.fly.dev";
  var TTS_URL_K = "tnd_tts_url_v1";   // dev override — point a local build at a local tts server
  function _ttsServerUrl() { return store.get(TTS_URL_K) || TTS_SERVER_URL; }
  var SERVER_TTS_TIMEOUT_MS = 10000;  // worst real unit ≈ 15s audio at ~2× realtime ≈ 7.5s synth + RTT
  var SERVER_TTS_TIMEOUT_FIRST_MS = 15000;  // unit 0 only (v1.436, the field lesson): the measured
                                      // worst cold chain — machine resume + auth proxy (possibly
                                      // cold-starting the GAME server too) + daemon spawn + model
                                      // load + synth — hit 10.17s and timed out at 10s, degrading
                                      // nearly every post-idle read. Suspend-mode + the send-tap
                                      // prewarm make that chain rare; this absorbs the residue
  var SERVER_TTS_RETRY_MS   = 60000;  // after a degrade, reads use the local ladder this long, then
                                      // the next read tries the server again (retries are silent —
                                      // D3 toasts the DEGRADE once per session, not the recovery)
  var _serverTtsErr     = "";
  var _serverTtsErrAt   = 0;
  var _serverTtsToasted = false;

  // D1 (ratified 2026-07-24): the server tier exists only for connected players — server mode +
  // token, both via storageAdapter (typeof-guarded: the headless test loader may stub it with a
  // shape that has neither method). Offline/unconnected play is unchanged by design, so a false
  // here is SILENT — the loud path is _serverTtsDegrade, which only fires when a configured
  // server actually fails.
  function _serverTtsOk() {
    if (typeof storageAdapter === "undefined" || typeof storageAdapter.isServerMode !== "function" ||
        typeof storageAdapter.hasToken !== "function") return false;
    if (!storageAdapter.isServerMode() || !storageAdapter.hasToken()) return false;
    if (typeof navigator !== "undefined" && navigator.onLine === false) return false;
    if (_serverTtsErr) {
      if (Date.now() - _serverTtsErrAt < SERVER_TTS_RETRY_MS) return false;
      _serverTtsErr = ""; _serverTtsErrAt = 0;   // retry window over — the next read tries the server again
    }
    return true;
  }

  function _serverTtsDegrade(reason) {
    _serverTtsErr = String(reason || "server TTS failed");
    _serverTtsErrAt = Date.now();
    console.warn("[tts server] degraded to the local ladder for " + Math.round(SERVER_TTS_RETRY_MS / 1000) + "s: " + _serverTtsErr);
    if (typeof erCrumb === "function") erCrumb("tts-server-degrade", _serverTtsErr.slice(0, 80));
    _updateServerLine();
    if (!_serverTtsToasted) {   // D3 (ratified): once per session — the governor/B10 toast pattern
      _serverTtsToasted = true;
      if (typeof showToast === "function") showToast("☁ Server narration unavailable (" + _serverTtsErr + ") — continuing with the on-device voice. It retries automatically.", 8000);
    }
  }

  function _serverTtsHeaders() {
    var h = { "Content-Type": "application/json" };
    try {
      if (typeof storageAdapter !== "undefined" && typeof storageAdapter.authHeader === "function") {
        var a = storageAdapter.authHeader();
        for (var k in a) h[k] = a[k];
      }
    } catch (e) {}
    return h;
  }

  // Fire-and-forget health probe: wakes the auto-stopped Fly machine so the first read's unit 0
  // doesn't pay the cold boot, and refreshes the availability memo LOUDLY if the server is gone.
  // Wired where prewarmPiper is wired (toggle-on + boot), whenever the server tier is selected.
  function prewarmServer() {
    if (!_serverTtsOk()) return;
    try {
      var ctrl = (typeof AbortController !== "undefined") ? new AbortController() : null;
      var tid = ctrl ? setTimeout(function() { ctrl.abort(); }, 8000) : null;
      fetch(_ttsServerUrl() + "/health", ctrl ? { signal: ctrl.signal } : {})
        .then(function(r) { if (tid) clearTimeout(tid); if (!r.ok) _serverTtsDegrade("health check HTTP " + r.status); })
        .catch(function(e) { if (tid) clearTimeout(tid); _serverTtsDegrade("health check failed: " + ((e && e.message) || e)); });
    } catch (e) {}
  }

  // ── TTS_PROVIDERS — the provider table (mirrors the LLM PROVIDERS shape in globals.js) ───────
  // One entry per engine. speak() resolves getEngine() → this table → availability → enqueue(),
  // instead of if(engine===...) branches. Provider-specific quirks (Piper's voiceId resolution)
  // live in that entry's own functions, never in speak().
  // available()      — runtime usability check (separate from selection; see getEngine above).
  // enqueue(text,vId) — builds the _queue item, or returns null/undefined when the provider can't
  //                     produce one right now — speak() keeps a car-mode-only native fallback for
  //                     that case (no current provider returns null; the guard is for future ones).
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
    piper: {
      id: "piper", label: "Piper (local, offline, $0)",
      hint: "Synthesizes on-device — free, works offline. First use per voice downloads once (60–115MB by voice), then cached.",
      available: function() { return _piperOk(); },
      enqueue: function(text) { return { text: text, piper: true, voiceId: resolvePiperVoice() }; },
      fallbackReason: function() { return _piperError || "Piper engine unavailable"; }
    },
    server: {
      id: "server", label: "Server (cloud Piper — #90)",
      hint: "Synthesizes on the Traffic and Dragons server with the same Piper voices — zero work on this device (the B9 close). Requires the server connection; degrades to local Piper, then native.",
      available: function() { return _serverTtsOk(); },
      enqueue: function(text) { return { text: text, server: true, voiceId: resolvePiperVoice() }; },
      fallbackReason: function() { return _serverTtsErr || "server tier unavailable (not connected)"; }
    }
  };

  // #90: the runtime ladder, top tier first. speak() walks DOWN from getEngine()'s resolution to
  // the first available tier; _speakServer hands a failed read's remainder one rung down the same
  // ladder mid-read. Native is the floor (its available() is always true, so the walk terminates).
  var TTS_LADDER = ["server", "piper", "native"];

  // ── Piper voice LRU (#66) — cap resident voice models, evict oldest-stamped on overflow ────────
  function _piperLruLoad() {
    try { var r = store.get(PIPER_VOICE_LRU_K); return r ? JSON.parse(r) : {}; } catch(e) { return {}; }
  }
  function _piperLruStamp(voiceId) {
    var lru = _piperLruLoad();
    lru[voiceBaseId(voiceId)] = Date.now();   // #95: the LRU tracks MODEL FILES — never a speaker id
    try { store.set(PIPER_VOICE_LRU_K, JSON.stringify(lru)); } catch(e) { console.warn("[tts piper] LRU stamp write failed:", e && e.message); }
  }

  // Configures the ONE shared AudioContext (_ensureCtx) every WebAudio path schedules onto — Piper
  // synthesizes at this rate, so changing it detunes narration.
  var SAMPLE_RATE       = 22050;

  // ── Shared text-prep (TODO #41 Phase 1 — harvested from piper_test.html spike) ──────────────
  // Provider-agnostic normalization + sentence-splitting, used by BOTH engines. Native needs it:
  // Chrome flakes on very long single utterances, and per-sentence units give skip() finer
  // granularity. Piper needs it for the same reason plus rhythm (see the pause tiers below).

  // Dash handling is per-caller via dashRepl: browser speechSynthesis SWALLOWS em/en-dashes (no
  // audible pause) but DOES honor an ellipsis pause, so the native path (below) passes "... " —
  // this is the exact validated behavior of the old _dashToPause (retired into this function).
  // Do NOT change native's dashRepl to a comma. Other callers may pass ", " (a comma "breath").
  // Order matters: the literal-"..."→ellipsis collapse runs BEFORE the dash substitution, so a
  // dashRepl of "... " (three literal dots) is not immediately re-collapsed into a single "…" —
  // that would silently change the exact validated native-speech output.
  // INTERWORD single hyphens are DELETED (→ space), never routed through dashRepl (#159):
  // "half-buried" must read as two adjacent words, but Piper's espeak-ng phonemizer renders a
  // compound's hyphen as an audible pause INSIDE the synthesized wav — the one place the
  // scheduled inter-unit gaps can't reach — so it read "half … buried" (field report
  // 2026-08-10; 1011 such compounds in the t1593 campaign's GM prose). The lookahead leaves
  // the trailing letter unconsumed so chained compounds ("three-and-a-half") strip every link.
  // Letters only, on purpose: digit ranges ("3-4"), spaced breaks (" - "), and the --/em-dash
  // rules stay untouched. Unconditional across engines — OS voices speak "half buried" and
  // "half-buried" identically, so native is neutral and the two paths cannot drift.
  function normalizeForTTS(text, dashRepl) {
    if (dashRepl == null) dashRepl = ", ";
    return (text || "")
      // v1.423 — markdown emphasis. The DISPLAY path has always stripped these (escProse,
      // helpers.js: `*text*` → `<em>text</em>`), but the SPEECH path never did, so Piper read the
      // markers aloud: "asterisk, the text is italic, asterisk". Two consumers of the same GM
      // prose, one of which stripped and one of which did not. Mirrors escProse's regex exactly so
      // the two cannot drift apart; the trailing sweep then removes any UNPAIRED marker, because
      // display may legitimately show a lone "*" but there is no reading of it that should ever be
      // spoken. Runs first so the dash/ellipsis rules below see clean text.
      .replace(/\*(.*?)\*/g, "$1")
      .replace(/\*/g, "")
      .replace(/\s*\.\.\.+\s*/g, "… ")     // literal "..." already in the source → single ellipsis char
      .replace(/\s*--\s*/g, dashRepl)      // spaced ASCII double-hyphen
      .replace(/\s*[—–]\s*/g, dashRepl)    // em / en dash
      .replace(/([A-Za-z])-(?=[A-Za-z])/g, "$1 ")  // interword hyphen → space (#159, see block comment)
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
  // NOT comma-split (its OS voice renders commas itself — validated behavior, don't change).
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
  // B14c: cut a sentence at every quote transition, so a piece is WHOLLY spoken or WHOLLY narration.
  // This is the invariant the voice layer depends on: PAUSE boundaries must be a SUPERSET of VOICE
  // boundaries. The comma/sentence split only breaks at , ; : . ! ? — so when a quote closes
  // mid-sentence ("Wrong voice" said Ammut.) the unit carried BOTH the speech and the attribution
  // and the whole thing took one voice. A closing mark ends its piece; an opening mark starts one.
  function splitQuotePieces(sent, inQ, gOrd, curGi) {
    // gOrd/curGi (#93 \u2460) carry the paragraph's running QUOTE-GLYPH ORDINAL and the ordinal of the
    // glyph that opened the current run, so each piece records `gi` = which quoted run it belongs
    // to. That is what lets the fault rule below demote exactly the runs at and after a fault
    // instead of the whole paragraph.
    var pieces = [], buf = "", cur = !!inQ, k, ch;
    var g = gOrd || 0, cg = (curGi === undefined || curGi === null) ? -1 : curGi;
    for (k = 0; k < sent.length; k++) {
      ch = sent.charAt(k);
      if (ch === '"' || ch === "\u201c" || ch === "\u201d") {
        if (cur) { buf += ch; pieces.push({ text: buf, inQ: true, gi: cg }); buf = ""; cur = false; cg = -1; g++; }
        else { if (buf.trim()) pieces.push({ text: buf, inQ: false, gi: -1 }); buf = ch; cur = true; cg = g; g++; }
        continue;
      }
      buf += ch;
    }
    if (buf.trim()) pieces.push({ text: buf, inQ: cur, gi: cur ? cg : -1 });
    // Fold a punctuation-only fragment (the "." left over after a closing quote) into the piece
    // before it — on its own it would become a unit consisting of one full stop. #93 ③: never fold
    // across a VOICE boundary. The fragment is inaudible either way, but merging a quoted fragment
    // into narration (or vice versa) builds a unit holding both, which is exactly the straddle the
    // B14c invariant forbids — measured at 0 such units before this rule and 2 after, without it.
    for (k = pieces.length - 1; k > 0; k--) {
      if (/[A-Za-z0-9]/.test(pieces[k].text)) continue;
      if (pieces[k - 1].inQ === pieces[k].inQ) { pieces[k - 1].text += pieces[k].text; pieces.splice(k, 1); }
      else if (k + 1 < pieces.length && pieces[k + 1].inQ === pieces[k].inQ) { pieces[k + 1].text = pieces[k].text + pieces[k + 1].text; pieces.splice(k, 1); }
      // neither neighbour shares its voice: leave it a piece, the paragraph layer absorbs it
    }
    return { pieces: pieces, inQ: cur, g: g, cg: cg };
  }
  // #93 ①: locate the FIRST unmatched quote glyph in a paragraph, by typographic ROLE rather than
  // by parity. Parity alone cannot tell an opener from a closer, so one stray glyph inverts every
  // label after it; role reads the neighbouring characters — a glyph hugging the text on its left
  // and followed by space closes, one preceded by space and hugging text on its right opens.
  // The ambiguous case (space on both sides, or text on both sides) falls back to parity, and that
  // fallback is load-bearing: normalizeForTTS rewrites "..." to an ellipsis PLUS A SPACE, so a real
  // closer in `And you..."` becomes `And you… "` with whitespace on both sides. Without the
  // fallback those misread as faults and demoted 41 units across 22 corpus documents; with it, 4.
  // Returns {at: ordinal of the offending glyph (-1 = balanced), trailing: the fault is an opener
  // still hanging at the paragraph's end}.
  function quoteFault(norm) {
    var open = -1, g = 0, i, ch, prev, next, closer, lA, rA;
    for (i = 0; i < norm.length; i++) {
      ch = norm.charAt(i);
      if (!QUOTE_GLYPH.test(ch)) continue;
      prev = i > 0 ? norm.charAt(i - 1) : "";
      next = i + 1 < norm.length ? norm.charAt(i + 1) : "";
      lA = !!prev && !/\s/.test(prev);
      rA = !!next && !/\s/.test(next);
      closer = (lA && !rA) ? 1 : (!lA && rA) ? 0 : -1;
      if (closer === -1) closer = (open >= 0) ? 1 : 0;
      if (closer) { if (open < 0) return { at: g, trailing: false }; open = -1; }
      else        { if (open >= 0) return { at: open, trailing: false }; open = g; }
      g++;
    }
    return open >= 0 ? { at: open, trailing: true } : { at: -1, trailing: false };
  }

  // #93 ①/③ helpers. QUOTE_GLYPH is the single definition of "a quote character" for the parity
  // rules below — splitQuotePieces toggles on exactly these three, so the balance test and the
  // toggle can never drift apart.
  var QUOTE_GLYPH   = /["“”]/;
  var QUOTE_GLYPH_G = /["“”]/g;
  var HAS_WORD      = /[A-Za-z0-9]/;
  // Sentence-terminal punctuation, tolerating trailing closers — the same tail the sentence-split
  // regex accepts. Its ABSENCE at the end of a response is the output-cap truncation signature.
  var TERMINAL_END  = /[.!?…]["'”’»)\]]*$/;

  function _voiceSame(a, b) { return (a.spk === null || a.spk === undefined) === (b.spk === null || b.spk === undefined); }

  function splitSentences(text, dashRepl, commaSplit) {
    // Paragraphs are normalized UP FRONT (#93 ①) so a paragraph can see the next one: the standard
    // typography for speech continued across a break is that each paragraph re-opens the quote and
    // only the last one closes it, and that look-ahead is what separates the convention from a fault.
    var _raw = (text || "").split(/\n\s*\n/), norms = [], _np;
    for (_np = 0; _np < _raw.length; _np++) {
      var _n = normalizeForTTS(_raw[_np], dashRepl);
      if (_n) norms.push(_n);
    }
    var paras = norms;
    var out = [];
    // #B14b (2026-07-22, user architecture call). Two jobs were being done by ONE segmentation:
    // the comma split serves PAUSES (rhythm — Piper renders no pause for punctuation inside a
    // unit, so the scheduled inter-unit gap is the only control we have), and voice assignment
    // was simply inheriting whatever boundaries prosody happened to produce. When a pause boundary
    // landed inside a quotation, the narrator's attribution ended up in a character's voice (B14).
    // So each unit now also carries the DIALOGUE SPAN it belongs to: `spk` = span index while
    // inside quotation marks, null for narration. Voices key off spans (who speaks), commas keep
    // keying off rhythm, and the two can no longer corrupt each other.
    // Span membership is decided by the quote state at a unit's FIRST REAL CHARACTER — which is
    // why a unit that OPENS a quotation counts as dialogue, while the attribution clause after the
    // closing quote does not. Only DOUBLE quotes toggle: an apostrophe is not a delimiter, so
    // "she's a door" stays one span.
    var _inDlg = false, _spanId = -1;
    for (var p = 0; p < paras.length; p++) {
      var norm = paras[p];
      var _inQ = false;   // B14c: per-PARAGRAPH, never carried across a break
      // #93 ①: quote state is a PARITY TOGGLE, so one stray glyph inverts every label after it for
      // the rest of the paragraph. Before #96 that only mislabeled; since the v1.451 deterministic
      // deriver it is audible — an inverted NARRATION unit takes the [SAY:] segment's CHARACTER
      // voice, so the narrator's own prose is read aloud in an NPC's voice (the reported harm).
      // The engine cannot know WHICH glyph is stray, so an unbalanced paragraph resolves in the
      // SAFE direction: every unit in it narrates. Dialogue read flat costs a voice; narration read
      // in a character's voice costs the scene. Two shapes are exempt because they are legitimate
      // open-ended speech rather than a fault — a lone opener that STARTS the paragraph (the speech
      // opened here and runs past the break), and any unbalanced paragraph whose successor opens on
      // a quote (the standard continued-speech typography, B14c-pinned). Flattening rewrites LABELS
      // ONLY: unit count and unit text are untouched, so no persisted speaker map trips the sp.n fuse.
      //
      // The SECOND exemption comes from measurement, not theory. A census of 23,858 real GM
      // paragraphs (13 campaign exports + 6 harness corpora) found a quote fault 27 times — 0.11%,
      // and 3 times in 18,704 paragraphs of current-model prose. In ALL 27 the unmatched glyph was
      // an opener whose run is a character still SPEAKING when the response hit its output-token
      // cap: 23 of them end with no terminal punctuation, several mid-word. The
      // narration-after-a-stray-opener shape this rule exists for occurred ZERO times. So a
      // trailing run in the LAST paragraph of a response that simply stops — no closing
      // punctuation — is read as truncation, not as a fault, and keeps its voice: the player can
      // already hear the line was cut off, and flattening it would be pure loss.
      // (A third exemption was tried and DELETED: "the next paragraph opens on a quote". It is a
      // coin flip between two shapes the census measured at zero field occurrences each, and it
      // disarmed the rule at 27% of all paragraph positions — one ordinary quoted paragraph
      // appended after a faulty one was enough to restore the wrong-voice bug. The B14c-pinned
      // continued-speech fixture is protected by _opensPara, verified by ablation.)
      var _fault = quoteFault(norm), _flatFrom = -1;
      if (_fault.at >= 0) {
        // _opensPara requires a TRAILING fault: a paragraph that opens on a quote but also carries
        // a second, earlier opener is a genuine defect, not an open-ended speech.
        var _opensPara = (_fault.trailing && _fault.at === 0 && QUOTE_GLYPH.test(norm.charAt(0)));
        var _cutOff    = (p === paras.length - 1) && _fault.trailing && !TERMINAL_END.test(norm);
        if (!(_opensPara || _cutOff)) _flatFrom = _fault.at;
      }
      var _gOrd = 0, _curGi = -1;
      var _pStart = out.length;
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
        var _qp = splitQuotePieces(sent, _inQ, _gOrd, _curGi), _pieces = _qp.pieces, _pi;
        _inQ = _qp.inQ; _gOrd = _qp.g; _curGi = _qp.cg;
        for (_pi = 0; _pi < _pieces.length; _pi++) {
        var _piece = _pieces[_pi], _uStart = units.length;
        sent = _piece.text.trim();
        if (!sent) continue;
        if (commaSplit) {
          var clauses = mergeDigitClauses(sent.match(/[^,;:]+[,;:]+\s*|[^,;:]+$/g) || [sent]);
          // B14: dialogue punctuated INSIDE the quotation ("That leaves her," Frizwick says.) splits
          // between the comma and the closing quote, orphaning that quote onto the ATTRIBUTION —
          // which then begins with a quote mark and reads as continued speech. That is what made the
          // #9 speaker post-pass hand the narrator's "Frizwick says" to the character's voice.
          // Move a CLOSING quote back onto the dialogue it closes. Parity is what distinguishes a
          // closer from an opener: an ODD number of quote marks so far means we are inside a
          // quotation, so a leading quote closes it; EVEN means it opens one and must stay put
          // (`He said, "Get back."` must not become `He said,"` / `Get back."`). Both cases are
          // engine-tested, as is the invariant that this never changes the UNIT COUNT — persisted
          // speaker maps key on it, so a count change would silently flatten every past turn.
          var _qSeen = 0, _qc, _qm;
          for (_qc = 0; _qc < clauses.length; _qc++) {
            if (_qc > 0 && (_qSeen % 2) === 1) {
              _qm = clauses[_qc].match(/^\s*(["\u201d])/);
              if (_qm) {
                clauses[_qc - 1] = clauses[_qc - 1].replace(/\s+$/, "") + _qm[1];
                clauses[_qc]     = clauses[_qc].replace(/^\s*["\u201d]/, "");
                _qSeen++;   // the moved mark now belongs to the previous clause
              }
            }
            _qSeen += (clauses[_qc].match(/["\u201d]/g) || []).length;
          }
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
        for (j = _uStart; j < units.length; j++) { units[j].spk = _piece.inQ ? 0 : null; units[j].qi = _piece.gi; }   // piece-level truth
        // a piece that is not the sentence's last gets a clause-length gap, not a full stop
        if (units.length > _uStart && _pi < _pieces.length - 1) units[units.length - 1].end = "clause";
        }
        if (units.length && lastSentence) units[units.length - 1].end = "para";
        for (j = 0; j < units.length; j++) {
          units[j].paraEnd = (units[j].end === "para");
          // #93 ①: demote only the runs AT OR AFTER the fault. `flat` marks a unit the deriver must
          // still consume (it holds real quoted text in the raw) while granting it no voice.
          var _wasDlg = (units[j].spk === 0);
          var _dlg = _wasDlg && !(_flatFrom >= 0 && units[j].qi >= _flatFrom);
          units[j].flat = _wasDlg && !_dlg;
          if (_dlg && !_inDlg) _spanId++;    // a new run of dialogue begins
          _inDlg = _dlg;
          units[j].spk = _dlg ? _spanId : null;
          out.push(units[j]);
        }
      }
      // #93 ③: a unit with no alphanumeric content — a lone `"` orphaned by a quote transition, the
      // `,"` left when a comma opens a piece — carries no speech but is still handed to synthesis as
      // its own utterance (an audible blip, plus its own scheduled pause). splitQuotePieces already
      // folds such a fragment BACKWARD, but only within one sentence's pieces and only above index 0.
      // Fold across the whole paragraph instead: backward into the preceding unit (which inherits the
      // fragment's end/paraEnd, so the paragraph's final pause survives), and the paragraph's FIRST
      // unit forward into its successor, which has nothing before it to absorb it. Text is moved,
      // never dropped — a paragraph that is punctuation-only end to end has no neighbour and is left
      // exactly as it was. This is the one #93 change that alters unit COUNT, so persisted speaker
      // maps for passages containing such a fragment degrade to mono-voice replay via the sp.n fuse
      // (the designed behavior — see speakerVoiceMap).
      // Voice-aware by PREFERENCE, not by hard gate: prefer a same-voice neighbour, but never let a
      // punctuation-only unit survive just because neither neighbour matches (a hard gate here
      // resurrects the lone-quote blip on `"...," she said.`). The fragment is inaudible; the
      // straddle only matters where a same-voice home exists, and this takes it whenever it does.
      for (j = out.length - 1; j > _pStart; j--) {
        if (HAS_WORD.test(out[j].text)) continue;
        if (!_voiceSame(out[j - 1], out[j]) && j + 1 < out.length && _voiceSame(out[j + 1], out[j])) {
          out[j + 1].text = out[j].text + " " + out[j + 1].text;
          out.splice(j, 1);
        } else {
          out[j - 1].text   += out[j].text;
          out[j - 1].end     = out[j].end;
          out[j - 1].paraEnd = out[j].paraEnd;
          out.splice(j, 1);
        }
      }
      if (out.length > _pStart + 1 && !HAS_WORD.test(out[_pStart].text)) {
        out[_pStart + 1].text = out[_pStart].text + " " + out[_pStart + 1].text;
        out.splice(_pStart, 1);
      }
    }
    return out;
  }

  var _queue      = [];
  var _playing    = false;
  var _paused     = false;
  var _curItem    = null;   // the item _drain last dispatched (v1.438) — a doomed-ctx rebuild
                            // requeues it so "tap anywhere to resume" re-reads instead of discarding
  var _lastSpokenText  = "";
  var _lastNarration   = "";   // set ONLY by speakResponse (rank 17/18, todo_carplay.html) — narration-
                                // sourced, unlike _lastSpokenText which every speak() caller (incl. the
                                // settings-modal Test buttons) overwrites. Backs TTS.replayLast().
  var _onDoneCallback  = null;
  var _audioCtx   = null;   // single persistent context, created on first toggle-on
  var _nextStart  = 0;      // scheduled playback cursor (AudioContext time)
  var _sources    = [];     // scheduled AudioBufferSourceNodes

  // ── B9 H1 (v1.430): the playback layer is the new prime suspect ─────────────────────────────
  // 25 crumbs: the tab dies at pc≈90-132 cumulative synths under TWO different synthesis
  // architectures, at wildly varying ORT memory. The two things those architectures share are
  // the process and THIS layer — the one AudioContext that lives as long as the page, fed one
  // AudioBuffer + one AudioBufferSourceNode per synth, ~90-132 times before every death. WebKit
  // has shipped exactly this fingerprint (count-gated kills at trivial measured memory: WebKit
  // #198964, #224279). See DOC/piper_deepdive.html H1 and the BUGS.md decision table.
  // The counters ride the crash crumb so the NEXT death is self-interpreting:
  //   cs — sources started on the CURRENT context. Death with cs<40 (fresh ctx) → ctx-scoped
  //        accumulation FALSIFIED, run the bypass experiment. Survival past pc≈150 with cr>0
  //        → confirmed and fixed.
  //   cr — deliberate healthy-context recycles this page load.
  //   da — decodeAudioData fallback firings (deepdive G5): the manual WAV parse exists to avoid
  //        WebKit's daemon-side decode retention, and its failure path was console-only. da>0
  //        means the KNOWN leak class has been active and invisible all along.
  var AUDIO_CTX_RECYCLE_SYNTHS = 40;  // recycle the ctx between reads once ≥N units played on it
                                      // (deaths start ~90; 40 + a worst-case ~45-unit read stays under)
  var _ctxSynths       = 0;   // crumb: cs — reset by _ensureCtx whenever a NEW context is built
  var _ctxRecycles     = 0;   // crumb: cr
  var _decodeFallbacks = 0;   // crumb: da
  var _nativeUtter   = null;// current SpeechSynthesisUtterance (native path)
  var _nativeStallT  = null;// pending native stall-watchdog timer — cleared by _stopCurrent so a
                            // skipped chain can't be resurrected by a stale watchdog (v1.334, audit #4)
  var _curNative     = false;// is the currently-playing queue item using native TTS

  // ── State ──────────────────────────────────────────────────────────────────

  function isOn()     { return store.get(ON_K) === "1"; }
  function getNativeVoice() { return store.get(NVOICE_K) || ""; }
  // System voices available to speechSynthesis. May be empty on first call (esp. iOS) until voiceschanged fires.
  function _voiceList() { try { return (window.speechSynthesis && speechSynthesis.getVoices()) || []; } catch(e) { return []; } }
  function _findNativeVoice(name) { if (!name) return null; var vs = _voiceList(), i; for (i = 0; i < vs.length; i++) { if (vs[i].name === name) return vs[i]; } return null; }
  // The voice to actually speak with: the user's saved pick if present, else the preferred default, else OS default (null).
  function _resolveNativeVoice() { return _findNativeVoice(getNativeVoice()) || _findNativeVoice(NVOICE_DEFAULT) || null; }
  // ── Toggle ─────────────────────────────────────────────────────────────────

  function toggle() {
    var on = !isOn();
    store.set(ON_K, on ? "1" : "");
    if (on) {
      _resumeCtx(_ensureCtx(), "toggle-on");  // create/resume NOW, inside the user gesture (v1.327: also revives an iOS-interrupted ctx)
      // v1.328: escalate to a real PLAYBACK audio session for ALL WebAudio narration, not just Car
      // Mode — iOS plays bare WebAudio in the "ambient" category, which the physical ringer/silent
      // switch mutes (while speechSynthesis ignores the switch: the exact native-works/Piper-silent
      // split reported from the phone with ctx state=running). The primer's silent loop, started
      // in-gesture, claims playback category: mute-switch-immune + consistent BT routing.
      primeAudioSession();
      var _eng = getEngine();
      if (_eng === "server") prewarmServer();   // #90: wake the auto-stopped Fly machine off the critical path
      else if (_eng === "piper") prewarmPiper(resolvePiperVoice());  // §5 Q4 — off the critical path of the first real line
    } else {
      stop();
      _closeCtx();
    }
    _syncBtn();
    if (typeof erCrumb === "function") erCrumb("voice-toggle", on ? "on" : "off");
    if (typeof showToast === "function") showToast(on ? "🔊 Voice on" : "🔇 Voice off");
  }

  function _ensureCtx() {
    if (_audioCtx && _audioCtx.state !== "closed") return _audioCtx;
    try {
      _audioCtx  = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: SAMPLE_RATE });
      _nextStart = 0;
      _ctxSynths = 0;   // B9 H1 (v1.430): cs counts sources on the CURRENT context — every rebuild
                        // path (toggle, recoverAudio, recycle) funnels through here, so the reset
                        // cannot be forgotten by a future rebuild site
    } catch(e) { console.warn("[tts] AudioContext unavailable:", e.message); }
    return _audioCtx;
  }

  // ── iOS context-state discipline (v1.327 — the phone-silence diagnosis) ────────────────────
  // Two iOS-only facts broke every WebAudio path (all schedule on the shared ctx) while native
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
  // #16c: every caller used to DROP this promise, so a rejection became a contextless
  // "unhandledrejection" email naming neither the call site nor the context (B10 cost four
  // arrivals and two wrong inferences to that gap). Observe it — deliberately NOT a bare
  // .catch(){}, which would silence the only signal this class has ever produced: the promise
  // is still returned to callers unchanged, we just attach a reporter alongside.
  var _ctxRefusals = 0;
  function _resumeCtx(ctx, tag) {
    if (!ctx) return;
    if (ctx.state === "suspended" || ctx.state === "interrupted") {
      try {
        var pr = ctx.resume();
        if (pr && pr.then) pr.then(null, function(e) {
          _ctxRefusals++;
          var why = (e && (e.name + ": " + e.message)) || String(e);
          // v1.421 — a REFUSED resume means this context object is finished, not busy. iOS does
          // not hand an interrupted AudioContext back; resume() rejects on it forever. Mark it so
          // recoverAudio() replaces it instead of asking again (which is all this app did, from
          // four separate call sites, for as long as the bug existed).
          if (ctx === _audioCtx) _ctxDoomed = true;
          console.warn("[tts] AudioContext.resume() REFUSED (" + (tag || "?") + ", state " + ctx.state + "): " + why + " — context marked unrecoverable; next user gesture rebuilds it");
          if (typeof erCrumb === "function") erCrumb("ctx-refused", (tag || "?") + " " + ctx.state + " " + why.slice(0, 40));
        });
        return pr;
      } catch(e) {}
    }
  }

  // ⛨ THE audio recovery path (v1.421). Field-diagnosed 2026-07-22 from two user observations
  // that together named the mechanism: the downgrade toast fires BEFORE the first word of a read
  // (so the context died BETWEEN turns, unwatched — `_armCtxWatch` disarms itself whenever
  // `_playing` is false), and tapping does NOT restore it — only a voice toggle off/on does.
  //
  // Why tapping never worked: `_ensureCtx` replaces the context only when it is `"closed"`, and an
  // iOS-interrupted context is not closed. So it handed the same dead object back to every
  // recovery path — the tap-unlock, the 2s `_armCtxWatch` poll, `visibilitychange`, and the
  // `_ctxRunning` gate — each of which called `resume()` on it and was refused. That refusal loop
  // IS B10 (`ctx-refused ctx-watch interrupted InvalidStateError: Failed to start the audio
  // device`), arriving every 2 seconds. The toast's "tap anywhere, then it recovers" was a promise
  // the code could not keep.
  //
  // The voice toggle worked because OFF closes the context outright and ON builds a NEW one inside
  // the gesture. This automates exactly that sequence — deliberately mirroring the one recovery
  // path with field evidence behind it rather than inventing a cleverer one.
  //
  // Safe to call from anywhere. It rebuilds ONLY when the context is proven unrecoverable, so the
  // common case costs one state check. And a rebuild outside a gesture is still a strict
  // improvement: a fresh context born suspended CAN be resumed by the next tap, which is precisely
  // what the doomed one could not. The primer is re-established after the swap, so the v1.334
  // audit #3 dead-primer trap (a primer node orphaned on a replaced ctx) cannot reopen.
  var _ctxDoomed = false;
  function recoverAudio(tag) {
    // A deliberate user pause suspends this same context; resurrecting it here would restart
    // audio while the bar still reads paused (the v1.334 audit #4 desync).
    if (_paused || !_audioCtx) return false;
    if (!_ctxDoomed && _audioCtx.state !== "interrupted") {
      if (_audioCtx.state === "running") {
        recoverAudio._stuckCtx = null;   // healthy — clear any pending escalation strike
        // B9 H1 (v1.430): recycle a HEALTHY but well-used context. This runs in the same gesture
        // slot as the B10 repair (sendAction calls recoverAudio on every send), reusing the exact
        // close→rebuild→re-prime sequence the field already proved (the voice toggle, then B10).
        // Idle-gated HARD: never while anything is playing, queued, or paused — recycling then
        // would cut live audio; between reads it is inaudible. If per-source native state is what
        // jetsam counts (deepdive H1), this caps it below the 90-132 death band forever; if the
        // next death arrives with cs<40 anyway, the theory is falsified by that one crumb.
        if (!_playing && !_queue.length && _ctxSynths >= AUDIO_CTX_RECYCLE_SYNTHS) {
          var used = _ctxSynths;
          _closeCtx();                     // close() + null + drop the old primer
          var fresh = _ensureCtx();        // new context, in-gesture; resets _ctxSynths
          if (!fresh) return false;
          _ctxRecycles++;
          _resumeCtx(fresh, (tag || "recover") + "-ctxrecycle");
          primeAudioSession();             // re-claim the iOS playback category on the NEW context
          console.info("[tts] playback context recycled after " + used + " units (B9 H1) — recycle #" + _ctxRecycles);
          if (typeof erCrumb === "function") erCrumb("ctx-recycle", "#" + _ctxRecycles + " after " + used + "u");
          return true;
        }
        return false;
      }
      // Not running, not interrupted — "suspended" and whatever else iOS invents. v1.437
      // escalation (field: "no amount of clicking got it going — only the toggle did"): a stuck
      // ctx that already refused one recovery resume is as dead as an interrupted one, iOS just
      // labels it differently — and the old path resume()d forever, exactly the refusal loop
      // B10 documented. First recovery attempt tries resume (cheap, usually enough after an app
      // switch) and RE-ARMS the unlock so the next tap reaches here; a second attempt on the
      // SAME still-stuck ctx within 30s falls through to the rebuild below (what the 🔊 toggle
      // does by hand).
      if (recoverAudio._stuckCtx === _audioCtx && Date.now() - recoverAudio._stuckAt < 30000) {
        _ctxDoomed = true;
        console.warn("[tts] ctx still " + _audioCtx.state + " after a recovery resume — escalating to rebuild (v1.437)");
      } else {
        recoverAudio._stuckCtx = _audioCtx;
        recoverAudio._stuckAt = Date.now();
        _resumeCtx(_audioCtx, tag || "recover");
        _armCtxUnlock();   // the one-shot was just consumed — without this, later taps do nothing
        return false;
      }
    }
    var was = _audioCtx.state;
    // Mirror the toggle: tear down the doomed read first. Anything scheduled on the old context
    // is inaudible by definition, and `_speakPiper` captured that context in a local — letting a
    // live read keep scheduling onto a closed ctx would throw on every remaining unit.
    // v1.438 (field: the tap rebuilt the ctx but left silence + a bar stuck on "Speaking…"): the
    // interrupted item is RE-QUEUED on the fresh context below, so the tap actually delivers the
    // resume the toast promises — a re-read of the item from its top, not a discard. The rest of
    // the queue is KEPT (v1.421 cleared it, but queued items hold only text — they never touched
    // the dead ctx; each dispatch captures the CURRENT ctx). And when there is nothing to replay,
    // the bar is told the truth (_showBar(false)) instead of lying "Speaking…" forever.
    var replayItem = _playing ? _curItem : null;
    var wasPlaying = _playing;
    if (_playing) { try { _stopCurrent(); } catch (e) {} _playing = false; }
    _closeCtx();                       // close() + null + drop the old primer
    var ctx = _ensureCtx();            // now genuinely builds a new one
    if (!ctx) { if (wasPlaying) _showBar(false); return false; }
    _ctxDoomed = false;
    _resumeCtx(ctx, (tag || "recover") + "-rebuilt");
    primeAudioSession();               // re-claim the iOS playback category on the NEW context
    console.warn("[tts] audio context was unrecoverable (" + was + ") — rebuilt in-gesture (" + (tag || "?") + "). This is what a voice off/on did by hand.");
    if (typeof erCrumb === "function") erCrumb("ctx-rebuilt", (tag || "?") + " from " + was);
    if (replayItem) {
      console.info("[tts] re-reading the interrupted item on the fresh context");
      _queue.unshift(replayItem);
      _drain();
    } else if (wasPlaying) {
      _showBar(false);
    }
    return true;
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
      // v1.421: recoverAudio, not _resumeCtx — this handler is the "tap anywhere and it recovers"
      // the toast promises, and for an INTERRUPTED context resume() can never deliver it. The
      // tap is a genuine user gesture, which is exactly where a rebuild is allowed to happen.
      if (!_paused) recoverAudio("tap-unlock");
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
    if (!document.hidden && !_paused && _audioCtx && _audioCtx.state !== "running" && _audioCtx.state !== "closed") { _resumeCtx(_audioCtx, "visibility"); _armCtxUnlock(); }
  });
  // Wait briefly for the ctx to actually reach "running" (resume can settle async); resolves
  // true/false, never throws — callers refuse loudly on false.
  function _ctxRunning(ctx, waitMs) {
    return new Promise(function(res) {
      if (!ctx) return res(false);
      if (ctx.state === "running") return res(true);
      _resumeCtx(ctx, "ctx-running-gate");
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
    // v1.421: the old wording promised "tap anywhere, then it recovers", which was false for an
    // interrupted context — every tap called resume() and was refused. recoverAudio now rebuilds
    // on that tap, so the promise is real; the wording says what actually happens.
    if (typeof showToast === "function") showToast("🔇 iOS paused game audio — this line reads in the native voice. Tap anywhere to restore the narrator voice.", 6000);
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
        _resumeCtx(_audioCtx, "ctx-watch");
        _armCtxUnlock();   // v1.437: EVERY poll, not once per freeze — the one-shot handler was
                           // consumed by the user's first tap and never re-armed while `warned`
                           // stayed latched, so every later click did nothing (the field report)
        if (!warned) {
          warned = true;
          console.warn("[tts] AudioContext " + _audioCtx.state + " mid-" + engineLabel + " read — narration frozen; tap unlock armed");
          if (typeof showToast === "function") showToast("🔇 iOS paused game audio mid-narration — tap anywhere to resume", 6000);
        }
      } else {
        warned = false;
        // v1.437 zombie detector: iOS can hand back a ctx that reports "running" while its render
        // clock is frozen — no state change, no event, playback silently parked, and every
        // recovery path trusts state==="running" so taps can never fix it. The audio clock NEVER
        // stalls on a healthy running ctx, so two consecutive frozen samples (4s) = proven
        // zombie: mark doomed + arm the unlock — the NEXT tap rebuilds in-gesture (recoverAudio's
        // _ctxDoomed path). Never an autonomous teardown mid-read.
        if (_audioCtx && _audioCtx.state === "running") {
          if (_armCtxWatch._zt === _audioCtx.currentTime) {
            _armCtxWatch._zn = (_armCtxWatch._zn || 0) + 1;
            if (_armCtxWatch._zn === 2) {
              _ctxDoomed = true;
              _armCtxUnlock();
              console.warn("[tts] ctx reports running but the audio clock is frozen at " + _audioCtx.currentTime.toFixed(2) + "s — zombie context (v1.437); next tap rebuilds");
              if (typeof erCrumb === "function") erCrumb("ctx-zombie", "t=" + _audioCtx.currentTime.toFixed(1));
              if (typeof showToast === "function") showToast("🔇 iOS silenced game audio — tap anywhere to restore the narrator voice.", 6000);
            }
          } else _armCtxWatch._zn = 0;
          _armCtxWatch._zt = _audioCtx.currentTime;
        }
      }
    }, 2000);
  }
  function _clearCtxWatch() { if (_ctxWatchT) { clearInterval(_ctxWatchT); _ctxWatchT = null; } }

  // ── mediaSession positionState (Car Mode audit rank 23, todo_carplay.html) ─────────────────
  // Cosmetic, best-effort: without it, lock screens / head units show an inert 0:00 scrubber.
  // Piggybacks the _armCtxWatch/_clearCtxWatch lifecycle (same "a WebAudio item is playing" window)
  // rather than owning its own state — armed alongside the watchdog in _speakPiper, cleared
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
    _resumeCtx(ctx, "primer");   // v1.327: covers iOS "interrupted" too
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
      var _engB = getEngine();
      if (_engB === "server") prewarmServer();   // #90: warm the server instead — no wasm compile to pay at all
      else if (_engB === "piper") prewarmPiper(resolvePiperVoice(), true);
    }
    // Crash forensics (v1.324): if the last Piper read never finished and was never user-stopped,
    // the tab died mid-read (the iOS kill class). Surface it LOUDLY — the phone has no console.
    try {
      var c = store.get(PIPER_CRUMB_K);
      if (c) {
        c = JSON.parse(c);
        store.del(PIPER_CRUMB_K);   // one-shot
        if (!c.done && typeof c.i === "number") {
          var msg = "⚠ Last narration died at sentence " + c.i + "/" + c.n + " (piper " + (c.rev || "?") + ", " + (c.app || "?") +
                    (typeof c.pc === "number" ? ", " + c.pc + " synths / " + c.up + " min into the session" : "") +
                    // v1.416: the wasm memory at death. This is the B9 number — on a phone the toast
                    // is the only console there is, so it goes where the user can read it out loud.
                    (typeof c.om === "number" ? ", ORT " + c.om + "MB" : "") + ")";
          console.warn("[tts piper] " + msg);
          if (typeof showToast === "function") showToast(msg, 8000);
          // #16: the narration-death crumb is the exact "invisible mobile console" class this
          // reporting exists for — mail the same forensics the toast shows, plus the raw crumb.
          if (typeof reportError === "function") reportError("narration-death", msg, JSON.stringify(c));
        }
      }
    } catch(e) {}
  }

  // #16c: how many distinct voices this page load has loaded into the wasm side — a monotonic
  // resource the standing audit dimension says to enumerate, and untestable on iOS any other way
  // (Safari exposes no performance.memory, so counters are the ONLY proxy available).
  function _voiceCount() { try { return Object.keys(_piperDownloaded).length; } catch(e) { return -1; } }


  // ORT's wasm linear memory in MB, or null when it cannot be read. null and 0 mean different
  // things and must stay distinguishable: null = "not measured", 0 = "measured, engine not
  // loaded". Same rule as _phonMem above.
  //
  // v1.418: synthesis normally runs in the piper-host iframe, whose wasm lives in ITS realm — the
  // page's own probe cannot see it (hooks are per-realm), so the frame reports its memory back and
  // we cache it here (`_frameMem`, refreshed after every read). The page probe is still consulted
  // as the fallback, because the in-page engine path survives for when the frame cannot start.
  function _ortMem() {
    try {
      if (_piperFrame && _frameMem && typeof _frameMem.ortMB === "number") return _frameMem.ortMB;
      if (!WebAssembly.__tndProbe || !WebAssembly.__tndProbe.caught()) return null;
      return Math.round(WebAssembly.__tndProbe.mb("ort"));
    } catch (e) { return null; }
  }

  // How many phonemizer MODULES this page load has instantiated. By design this is 1: v1.323
  // caches one and re-drives it via callMain. It rises only when tndPhonemize's reuse path has
  // thrown and latched `tndPhon.broken` — after which every synth builds a fresh 16MB Emscripten
  // module, which IS the v1.323 leak class, silently restored for the rest of the page's life
  // (the latch has no reset, and its only complaint is a console.warn no phone can show).
  // Reproduced in piper_test.html 2026-07-22 on long synthetic input: "memory access out of
  // bounds", then 10 modules in the next ~10 synths. Whether it fires on real narration is
  // unknown — which is exactly why the count rides the crumb.
  function _phonInstances() {
    try {
      if (_piperFrame && _frameMem && typeof _frameMem.phonMods === "number") return _frameMem.phonMods;
      if (!WebAssembly.__tndProbe || !WebAssembly.__tndProbe.caught()) return null;
      return WebAssembly.__tndProbe.count("phon");
    } catch (e) { return null; }
  }

  // Compact audio snapshot for the crash-report diag block (error-report.js erDiagBlock).
  // r9/B9: the phonemizer's wasm linear memory, read straight from the vendored runtime. This is
  // the ONLY view we have of the ratchet — iOS Safari exposes no performance.memory — so it rides
  // every crash report from here on.
  // Returns {mb, calls} for the live phonemizer module, or null when it cannot be read (no module
  // yet, or a runtime older than r9 with no tndDiag). Both the crash crumb and TTS.diag go through
  // here so the two can never disagree about the same number.
  function _phonMem() {
    try {
      if (!_piperMod || typeof _piperMod.tndDiag !== "function") return null;
      var d = _piperMod.tndDiag();
      if (!d || !d.phonBytes) return null;
      return { mb: +(d.phonBytes / 1048576).toFixed(1), calls: d.phonCalls };
    } catch (e) { return null; }
  }
  function _piperMemNote() {
    var m = _phonMem(), o = _ortMem(), pn = _phonInstances();
    return (m ? (" phonMB=" + m.mb + "/" + m.calls) : "")
         + (o === null ? "" : " ortMB=" + o)
         + (pn === null || pn <= 1 ? "" : " phonMods=" + pn);   // >1 means the reuse latch broke
  }
  function diag() {
    var st = _audioCtx ? _audioCtx.state : "none";
    return "ctx=" + st + " refusals=" + _ctxRefusals + " playing=" + (_playing ? 1 : 0) + " paused=" + (_paused ? 1 : 0)
         + " q=" + _queue.length + " synths=" + _piperSynthsTotal + "/" + _piperSynthsSession + " recycles=" + _piperRecycles
         + " voices=" + _voiceCount() + " on=" + (isOn() ? 1 : 0)
         // v1.418: WHICH engine is live. "frame" = the disposable realm, i.e. the B9 fix is
         // actually in play; "inpage" = the fallback, which still narrates but keeps ratcheting.
         // Without this the difference is invisible on a phone, and a silent fallback would look
         // exactly like a working fix right up until the tab dies.
         + " eng=" + (_piperFrame ? "frame" : (_piperFrameFailed ? "inpage-fallback" : "inpage"))
         + (_frameMemPeak ? " ortPeak=" + _frameMemPeak : "")
         + (_frameRespawnFails ? " respawnFails=" + _frameRespawnFails : "")   // v1.419: the high-water mark, which is what a jetsam kill responds to
         // v1.430 (B9 H1): the playback-layer counters — ctx age in units / recycles / decode fallbacks
         + " ctxSyn=" + _ctxSynths + "/" + AUDIO_CTX_RECYCLE_SYNTHS + " cr=" + _ctxRecycles + " da=" + _decodeFallbacks
         // v1.434 (B9 root cause): the work budget — cumulative synth CPU + whether the governor latched
         + " synthCPU=" + Math.round(_piperCpuMs / 1000) + "s" + (_piperGoverned ? " GOVERNED" : "")
         + _piperMemNote();
  }

  function _syncBtn() {
    var on = isOn();
    var el = document.getElementById("tts-btn");
    if (el) { el.textContent = on ? "🔊" : "🔇"; el.style.opacity = on ? "1" : "0.5"; }
  }

  // ── Public speak entry points ───────────────────────────────────────────────

  // voices (#9): optional {unitIndex: voiceId} for per-unit speaker voices. Piper synthesizes
  // unit by unit anyway (see _speakPiper), so this rides that loop; every other path ignores it.
  function speak(text, voiceId, voices) {
    if (!text || !text.trim()) return;
    var trimmed = text.trim();
    _lastSpokenText = trimmed;

    // Runtime degradation ladder (#90): server → piper → native, walked DOWN from getEngine()'s
    // resolution to the first available tier. getEngine() already folds server availability in,
    // so the walk mostly covers the race where a tier degrades between resolution and enqueue —
    // and it keeps every step loud per no-silent-failures (warn + the settings-modal indicators).
    var engine = getEngine();
    var li = TTS_LADDER.indexOf(engine); if (li < 0) li = TTS_LADDER.length - 1;
    while (li < TTS_LADDER.length - 1 && !TTS_PROVIDERS[TTS_LADDER[li]].available()) {
      console.warn("[tts] " + TTS_LADDER[li] + " unavailable (" + TTS_PROVIDERS[TTS_LADDER[li]].fallbackReason() + ") — falling back to " + TTS_LADDER[li + 1] + " for this line");
      if (TTS_LADDER[li] === "piper") _updatePiperErr();
      li++;
    }
    engine = TTS_LADDER[li];
    var prov = TTS_PROVIDERS[engine];

    // #90 (v1.436): a CONNECTED page reading below the server tier must be ATTRIBUTABLE — the
    // field lesson: silently-local reads (offline blip, degrade memo) climbed the governor budget
    // to the 🔋 latch with no signal anywhere. info + crumb, never a toast (D3 owns the toast).
    if (engine !== "server" && typeof storageAdapter !== "undefined" &&
        typeof storageAdapter.isServerMode === "function" && storageAdapter.isServerMode() &&
        typeof storageAdapter.hasToken === "function" && storageAdapter.hasToken()) {
      var _skipWhy = _serverTtsErr || ((typeof navigator !== "undefined" && navigator.onLine === false) ? "navigator.onLine=false" : "availability re-check failed");
      console.info("[tts] connected page reading on '" + engine + "' (server tier skipped: " + _skipWhy + ")");
      if (typeof erCrumb === "function") erCrumb("tts-server-skip", engine + " " + String(_skipWhy).slice(0, 60));
    }

    var item = prov.enqueue(trimmed, voiceId);
    if (!item) {
      // Provider is "available" but couldn't build an item this turn. No shipped provider does
      // this today (native and piper always return an item) — the branch is kept as the defined
      // contract for a future provider: car mode still wants audio, so it degrades to native;
      // outside car mode it is a no-op.
      if (typeof carMode !== "undefined" && carMode) { _queue.push({ text: trimmed, native: true }); if (!_playing) _drain(); }
      return;
    }
    if (voices) item.voices = voices;
    _queue.push(item);
    if (!_playing) _drain();
  }

  function speakResponse(cleanText, voices) {
    if (!isOn() && !(typeof carMode !== "undefined" && carMode)) return;
    var trimmed = cleanText.trim();
    // Rank 17/18: record ONLY here (narration, not Test/other speak() callers), and persist onto
    // worldState so ⏮ survives a reload — it rides the existing saveAll cycles (no save call here).
    _lastNarration = trimmed;
    if (typeof worldState !== "undefined" && worldState && worldState.character) worldState.lastNarration = trimmed;
    speak(trimmed, null, voices);
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
      _curItem = null;    // v1.438: nothing in flight — nothing for a ctx rebuild to replay
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
    _curItem = item;   // v1.438: retained so a doomed-ctx rebuild can requeue the interrupted item
    _curNative = !!item.native;
    if (item.native) _speakNative(item.text);
    else if (item.server) _speakServer(item.text, item.voiceId, item.voices);
    else if (item.piper) _speakPiper(item.text, item.voiceId, item.voices);
    // #9 sweep: the third branch (the removed cloud provider) is gone. Every item a
    // provider enqueues carries .native or .piper, so this is unreachable — but a malformed item
    // must never wedge the queue by leaving _playing latched with nothing scheduled to call back.
    else { console.warn("[tts] queue item with no engine flag — dropped:", item && item.text); _drain(); }
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

  // ── Piper (local WASM) engine — TODO #41 Phase 3/4 ──────────────────────────
  // Vendored, same-origin ORT + vits-web (Phase 2: vendor/piper/, import map in index.html).
  // Dispatched from speak() via TTS_PROVIDERS.piper (Phase 4, above) and from _drain()'s
  // item.piper branch. A synth-then-schedule loop feeding the shared AudioContext/_sources/
  // _nextStart scheduler, so pause()/skip()/stop() work unchanged. An in-flight WASM
  // predict() call cannot be aborted — so every await below is followed by an epoch check that
  // silently discards stale work. That silent bail is the ONE sanctioned silent path in this
  // engine: it is not a failure, it is "this result is for a narration turn the user already
  // skipped past," and scheduling it would audibly overlap the next item (review finding 3).

  var _piperMod      = null;  // vits-web module ref, kept warm across turns/synths
  var _piperReady     = false; // true once _piperInit has completed successfully at least once
  var _piperError     = "";    // last Piper failure reason; once set, speech falls back to native
  var _piperErrorAt   = 0;     // when it was recorded — auto-retried after 5 min so one transient blip doesn't downgrade the whole session (audit #27)
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
  // r8 (2026-07-17, the 9/50 field crash): tndRecycleSession() export — between narrations, once
  // PIPER_RECYCLE_AFTER synths have accumulated, the ORT session is released + rebuilt in the
  // background (_piperMaybeRecycle). Targets the CROSS-TURN accumulator left after v1.320–323:
  // the cached session's wasm arena + per-shape plan cache grow with every distinct sentence
  // length, wasm memory never shrinks, and iOS killed the tab early in turn 4 of a live drive.
  var PIPER_RUNTIME_REV = "r9";
  var PIPER_LIB_PATH = "/vendor/piper/vits/vits-web.js?tnd=" + PIPER_RUNTIME_REV;
  var PIPER_CRUMB_K  = "tnd_piper_crumb_v1";  // last-read breadcrumb — survives a tab kill, read at boot
  // TODO #66 (v1.347): voice models run 60-115MB each in OPFS — unbounded downloads across a
  // campaign's provider-hopping eventually repeat the eviction risk audit #12 already flags for a
  // SINGLE voice, just at OS-storage scale instead of browser-eviction scale. Cap resident voices;
  // evict least-recently-used on overflow. Re-download on demand is cheap (progress UI already exists).
  var PIPER_VOICE_CAP = 10;   // user call 2026-07-21 (was 4) — per-character voices need more resident room
  var PIPER_VOICE_LRU_K = "tnd_piper_voice_lru_v1";  // {voiceId: epoch-ms last ensured} — LRU stamps for the cap above
  var _piperPatchRev  = "";                   // TND_VITS_PATCH actually loaded (set by _piperInit)
  // r8 crash-forensics counters. The crumb carries them so the NEXT tab kill (if any) can
  // discriminate on-phone between the two remaining hypotheses: death at a similar CUMULATIVE
  // synth count regardless of read position = cross-session memory ratchet (recycle threshold too
  // high / wrong accumulator); death tied to one giant read at a LOW cumulative count = per-read
  // peak (next lever: mid-read recycle or worker isolation). No console on a phone — the crumb
  // toast is the only instrument we have in a moving car.
  var _piperBootAt        = Date.now();  // page-load timestamp — crumb "min into the session"
  var _piperSynthsTotal   = 0;           // successful predicts since page load (crumb forensics)

  // ⛨ B9 ROOT-CAUSE FIX (v1.434): the WORK-BUDGET GOVERNOR.
  // Three weeks of instrumentation ended at a mechanism no memory work can touch: iOS kills the
  // WebContent process after a CUMULATIVE budget of heavy synthesis work PER PAGE LOAD — the
  // energy assassin. Proven by: 7 harness deaths at EXACTLY the same synth index; idle at the
  // fatal memory level SURVIVING twice (235s+ at 354MB); resume-after-idle dying at synth 10
  // with ZERO new memory growth (no refund — cumulative); game deaths at pc 90-132 whether the
  // work was sprinted (75s) or paced (20min); memory at death spanning 248-624MB (a slice,
  // never the trigger). Full record: DOC/BUGS.md ▸ B9.
  // The governor spends LESS than the budget. Two thresholds against the observed floor
  // (90 synths / ~90-145s synth CPU):
  //   START gate — a new read will not BEGIN on Piper once the page has done 40 synths or 60s
  //   of synthesis (a worst-case ~46-unit read from there stays under the floor);
  //   HARD gate  — a read in progress stops synthesizing at 75 synths / 100s and hands its
  //   REMAINDER to the native voice via the queue (scheduled Piper audio plays out first).
  // Once tripped, the page is GOVERNED (latched): narration continues in the NATIVE system
  // voice — zero wasm work; the OS's own synthesizer is not the assassin's target — and the
  // player is told LOUDLY. A reload resets the budget (per-page-load accounting), so the next
  // session starts on Piper again. Quality degrades late-session; the tab stops dying.
  var PIPER_GOV_START_SYNTHS = 40;
  var PIPER_GOV_START_CPU_MS = 60000;
  var PIPER_GOV_HARD_SYNTHS  = 75;
  var PIPER_GOV_HARD_CPU_MS  = 100000;
  var _piperCpuMs    = 0;      // cumulative wall-ms inside predict() this page (single-threaded wasm: wall≈CPU)
  var _piperGoverned = false;  // latched — a spent budget cannot un-spend
  function _piperGovernLatch(where) {
    if (_piperGoverned) return;
    _piperGoverned = true;
    var msg = "🔋 Piper is resting for this session (iOS energy limit: " + _piperSynthsTotal + " synths / "
            + Math.round(_piperCpuMs / 1000) + "s of synthesis). Narration continues in the system voice — reloading the page brings Piper back.";
    console.warn("[tts piper] governor engaged (" + where + "): " + msg);
    if (typeof showToast === "function") showToast(msg, 8000);
    if (typeof erCrumb === "function") erCrumb("piper-governor", where + " " + _piperSynthsTotal + "syn " + Math.round(_piperCpuMs / 1000) + "s");
  }
  function _piperGovernStart() {
    if (_piperGoverned) return true;
    if (_piperSynthsTotal >= PIPER_GOV_START_SYNTHS || _piperCpuMs >= PIPER_GOV_START_CPU_MS) { _piperGovernLatch("read-start"); return true; }
    return false;
  }
  function _piperGovernHard() {
    if (_piperGoverned) return true;
    if (_piperSynthsTotal >= PIPER_GOV_HARD_SYNTHS || _piperCpuMs >= PIPER_GOV_HARD_CPU_MS) { _piperGovernLatch("mid-read"); return true; }
    return false;
  }
  var _piperSynthsSession = 0;           // predicts since the ORT session was (re)built — recycle trigger
  var _piperRecycles      = 0;           // #16c: ORT-session recycles this page load — with ps below, breaks the
                                         // PIPER_RECYCLE_AFTER=30 confound that made "late in the read" and
                                         // "high session age" the same observation in the first three B9 crumbs
  var PIPER_RECYCLE_AFTER = 30;          // recycle between narrations once ≥30 synths on the session
                                         // (~one long turn — keeps the session younger than the
                                         // observed-safe single-read envelope; rebuild cost hides
                                         // off the critical path between turns)

  // Piper failure auto-retries after 5 min, so one transient blip does not downgrade the whole
  // session (audit #27). Backs TTS_PROVIDERS.piper.available() (speak()'s dispatch) and
  // prewarmPiper (so a known-broken engine isn't re-attempted on every toggle-on in that window).
  function _piperOk() {
    if (_piperError && Date.now() - _piperErrorAt > 300000) { _piperError = ""; _piperErrorAt = 0; _updatePiperErr(); }
    return !_piperError;
  }

  // Idempotent lazy engine init. Order is load-bearing (todo_TTS_piper.md §1 finding 4): the ORT
  // env locks MUST be in place before vits-web's own predict() call, because vits-web
  // unconditionally reassigns wasmPaths/numThreads on every call (vendor/piper/vits/vits-web.js) —
  // Object.defineProperty getters with no-op setters make that clobber a no-op instead of a break.
  // ── The disposable synthesis realm (v1.418, B9) ────────────────────────────────────────────
  // Synthesis runs inside a hidden same-origin iframe (piper-host.html) whose whole wasm world —
  // ORT, the vits-web module, the phonemizer — belongs to ITS realm. Removing the iframe destroys
  // that realm and returns its linear memory, which is the only thing measured to work: the r8
  // session recycle, ORT session options and input-shape bucketing were each measured and each
  // reclaimed nothing (DOC/BUGS.md ▸ B9). Nothing inside a realm can shrink wasm memory that has
  // already grown.
  //
  // The adapter below exposes the SAME method names as the in-page vits-web module, so every
  // existing call site (predict/stored/download/remove/tndRecycleSession/tndDiag/PATH_MAP) is
  // untouched and the engine becomes a swappable transport rather than a rewrite. If the frame
  // cannot start, _piperInit falls back to importing the module in-page — the pre-v1.418 path,
  // which still works and simply keeps ratcheting; that is strictly no worse than before, and it
  // says so loudly rather than failing silently.
  var _piperFrame     = null;   // the live adapter (null = in-page fallback in use)
  var _frameMem       = null;
                                // last {ortMB, phonMB, phonMods, phonCalls} reported by the live frame
  var _frameMemPeak   = 0;      // v1.419: highest ORT MB this PAGE has ever reached — see _frameRefreshMem
  var _frameSeq       = 0;      // rpc correlation id
  var PIPER_HOST_PATH = "/piper-host.html";
  var PIPER_HOST_READY_MS = 30000;   // see the timeout below — sized for a throttled/frozen tab
  var _piperFrameFailed = false;     // fell back to the in-page engine; retried between reads
  var PIPER_RESPAWN_MB = 400;   // respawn once the frame's ORT memory crosses this. Deaths land at
                                // ~1GB; a fresh realm is ~170MB, so 400 leaves generous headroom
                                // even with a prewarmed replacement briefly alive alongside it.
                                // MEASURED memory, not a synth count — the count was only ever a
                                // proxy for this, and a bad one (read length varies wildly).

  // One iframe + its RPC channel. Resolves to an adapter object, or rejects — callers own failure.
  function _piperSpawnFrame() {
    return new Promise(function (resolve, reject) {
      var frame = document.createElement("iframe");
      frame.setAttribute("aria-hidden", "true");
      frame.setAttribute("title", "Piper synthesis host");
      frame.style.cssText = "position:absolute;width:0;height:0;border:0;visibility:hidden;";
      var pending = {}, progress = {}, settled = false, dead = false;

      function onMessage(ev) {
        if (ev.source !== frame.contentWindow || ev.origin !== location.origin) return;
        var d = ev.data;
        if (!d || !d.tnd) return;
        if (d.tnd === "ready") { if (!settled) { settled = true; resolve(adapter); } return; }
        if (d.tnd === "progress") { var f = progress[d.id]; if (f) { try { f(d.p); } catch (e) {} } return; }
        if (d.tnd === "rpc") {
          var p = pending[d.id];
          if (!p) return;
          delete pending[d.id]; delete progress[d.id];
          if (d.ok) p.resolve(d.result); else p.reject(new Error(d.err || "piper host error"));
        }
      }
      window.addEventListener("message", onMessage);

      function call(op, args, onProgress) {
        if (dead) return Promise.reject(new Error("piper host was destroyed"));
        var id = ++_frameSeq;
        return new Promise(function (res, rej) {
          pending[id] = { resolve: res, reject: rej };
          if (onProgress) progress[id] = onProgress;
          try { frame.contentWindow.postMessage({ tnd: "rpc", id: id, op: op, args: args || {} }, location.origin); }
          catch (e) { delete pending[id]; delete progress[id]; rej(e); }
        });
      }

      var adapter = {
        _isFrame: true,
        PATH_MAP: {},
        TND_VITS_PATCH: "",
        predict: function (a) {
          return call("predict", { text: a.text, voiceId: a.voiceId, rate: a.rate })
            .then(function (r) { return new Blob([r.buf], { type: r.type || "audio/x-wav" }); });
        },
        stored:   function ()   { return call("stored"); },
        download: function (id, cb) { return call("download", { voiceId: id }, cb); },
        remove:   function (id) { return call("remove", { voiceId: id }); },
        tndRecycleSession: function () { return call("recycle"); },
        // Synchronous by contract at the call sites (_phonMem reads it inline), so it serves the
        // LAST reported values rather than awaiting a round trip. Refreshed by _frameRefreshMem.
        tndDiag: function () {
          return { phonBytes: (_frameMem && _frameMem.phonMB != null) ? _frameMem.phonMB * 1048576 : 0,
                   phonCalls: (_frameMem && _frameMem.phonCalls) || 0,
                   sessKey: null, patch: adapter.TND_VITS_PATCH };
        },
        mem: function () { return call("mem"); },
        diag: function () { return call("diag"); },
        // Boots the engine in the frame and copies across the two pieces of static metadata the
        // page still needs locally: the patch rev (shown in Voice Settings so a phone can prove
        // which runtime it runs) and PATH_MAP (used by _piperVoiceComplete's direct OPFS check).
        init: function () {
          return call("init").then(function (r) {
            adapter.TND_VITS_PATCH = (r && r.patch) || "r0-unpatched";
            adapter.PATH_MAP = (r && r.pathMap) || {};
            return r;
          });
        },
        destroy: function () {
          dead = true;
          window.removeEventListener("message", onMessage);
          // Reject anything still in flight — a destroyed realm will never answer, and a promise
          // that never settles would wedge the op mutex (_piperSerial) forever.
          Object.keys(pending).forEach(function (k) {
            try { pending[k].reject(new Error("piper host destroyed mid-call")); } catch (e) {}
            delete pending[k];
          });
          try { frame.remove(); } catch (e) {}
        }
      };

      frame.src = PIPER_HOST_PATH;
      document.body.appendChild(frame);
      // Generous on purpose. The frame only has to parse and post "ready" — normally instant —
      // but a BACKGROUNDED tab is throttled or frozen outright, and Car Mode with the screen off
      // is exactly that. A tight timeout there would drop us onto the ratcheting engine for the
      // whole session, which is the failure this feature exists to prevent. Observed live: 15s
      // was not enough under a frozen tab.
      setTimeout(function () {
        if (settled) return;
        settled = true;
        try { adapter.destroy(); } catch (e) {}
        reject(new Error("piper host did not signal ready within " + (PIPER_HOST_READY_MS / 1000) + "s"));
      }, PIPER_HOST_READY_MS);
    });
  }

  // Pull the frame's memory report across and cache it. Everything that reads memory (the crumb,
  // TTS.diag, the respawn trigger) goes through the cache so one poll serves them all and none of
  // them can accidentally boot the engine.
  function _frameRefreshMem() {
    if (!_piperFrame) return Promise.resolve(null);
    return _piperFrame.mem().then(function (m) {
      if (m) {
        if (_frameMem && m.phonCalls == null) m.phonCalls = _frameMem.phonCalls;
        _frameMem = m;
        // v1.419 — HIGH-WATER MARK. iOS jetsam kills on PEAK, not on steady state, and the first
        // post-fix death (2026-07-22, eng:frame, pc=120) reported only 308MB precisely because the
        // figure was sampled between reads. Whatever spike killed that page was invisible to the
        // one number we had. This mark survives across respawns on purpose: it is a property of
        // the PAGE's memory history, not of the current realm, and the question it answers is "how
        // high did this page ever get" — which is the question the kill asks.
        if (typeof m.ortMB === "number" && m.ortMB > _frameMemPeak) _frameMemPeak = m.ortMB;
      }
      return m;
    }, function () { return null; });
  }

  // Fire-and-forget mid-read memory sample (v1.419, B9). Deliberately NOT awaited: the read must
  // not wait on a postMessage round trip. It costs nothing to be late — the frame's JS is blocked
  // while its wasm synthesizes, so this answers just after the current unit finishes, which is
  // exactly the post-synth sample we want. Errors are already swallowed by _frameRefreshMem.
  function _frameSampleMem() {
    if (!_piperFrame) return;
    try { _frameRefreshMem(); } catch (e) {}
  }

  var _piperInitP = null;   // v1.424: in-flight init, so concurrent callers share ONE spawn
  async function _piperInit() {
    // v1.429 (Fable review of v1.424, todo_checkWithFable #6.3): a read starting DURING a realm
    // respawn must WAIT for the swap, not build its own realm. _piperInitP below only shares the
    // spawn between _piperInit callers — the respawn spawns directly (_frameRespawnNow →
    // _piperSpawnFrame), so it never holds _piperInitP, and the destroy stage nulls _piperMod for
    // the whole swap (up to the 30s ready timeout under pressure). In that window the old guard
    // pair read as cold+idle and a mid-respawn read raced the respawn with a SECOND concurrent
    // realm — the exact two-realms-at-once condition v1.424 exists to prevent — and the loser of
    // the pointer race became an orphaned iframe holding a booted ORT engine. Waiting is safe:
    // no _piperInit call site runs inside a _piperSerial op (they all init BEFORE entering the
    // chain — audit #9), so awaiting the serial-op-resident respawn cannot deadlock.
    if (_frameRespawnP) {
      try { await _frameRespawnP; } catch (e) { /* respawn failed — pointers are null, build below */ }
    }
    if (_piperMod) return _piperMod;   // warm — already initialized (or the respawn just delivered)
    // v1.424 — destroy-then-build leaves `_piperMod` null for a real interval, and `_piperInit`
    // is NOT inside the op mutex (_piperEnsureVoice calls it before entering the chain). Without
    // this guard two concurrent _piperInit callers would each spawn a realm. (The respawn race is
    // the _frameRespawnP wait above — this promise never covers it.)
    // Cleared on both settle paths so a failed init never wedges the engine permanently.
    if (_piperInitP) return _piperInitP;
    _piperInitP = (async function () {
    // Preferred path: the disposable realm.
    try {
      var fr = await _piperSpawnFrame();
      await fr.init();            // boots ORT+vits inside the frame; brings back patch rev + PATH_MAP
      _frameMem = await fr.mem();
      _piperFrame = fr;
      _piperMod   = fr;
      _piperReady = true;
      _piperPatchRev = fr.TND_VITS_PATCH;
      if (_piperPatchRev !== PIPER_RUNTIME_REV) console.warn("[tts piper] runtime rev mismatch: loaded " + _piperPatchRev + ", expected " + PIPER_RUNTIME_REV + " — a cache served a stale vendored file");
      // ORT reports null here by design: importing the module does not instantiate its wasm — the
      // first InferenceSession does. The number appears from the first synth onward.
      console.info("[tts piper] synthesis running in a disposable iframe realm (B9), respawn at " + PIPER_RESPAWN_MB + "MB");
      _updatePiperErr();
      return _piperMod;
    } catch (e) {
      // Loud, never silent: the fallback works but keeps ratcheting, so this line is the only
      // warning a diagnosis will get that B9's fix is not actually in play on this device.
      // The fallback must never be PERMANENT. A backgrounded/throttled tab can miss the ready
      // handshake once, and without this flag that single stall would pin the whole session onto
      // the ratcheting engine — silently undoing the fix for exactly the hands-free Car Mode case
      // that motivated it. _piperMaybeRecycle retries between reads, where failure costs nothing.
      _piperFrameFailed = true;
      console.warn("[tts piper] synthesis iframe unavailable — falling back to the in-page engine (memory will ratchet, B9; will retry between reads):", e && e.message);
      if (typeof erCrumb === "function") erCrumb("piper-frame-fail", (e && e.message) || "?");
    }
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
    })();
    // Clear on BOTH settle paths — a failed init must not leave a rejected promise cached as the
    // permanent answer for every later caller.
    _piperInitP.then(function () { _piperInitP = null; }, function () { _piperInitP = null; });
    return _piperInitP;
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
    // #95: the download unit is the MODEL. Callers already strip (_localVoiceId), but this is the
    // download boundary — a composite arriving here would be an unknown PATH_MAP key.
    var base = voiceBaseId(voiceId);
    return _piperSerial(function() { return _piperEnsureVoiceNow(mod, base); });
  }
  async function _piperEnsureVoiceNow(mod, voiceId) {
    voiceId = voiceBaseId(voiceId);   // #95 — belt and braces at the one place that writes OPFS
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
    if (stored.indexOf(voiceId) !== -1 && await _piperVoiceComplete(voiceId)) { _piperDownloaded[voiceId] = true; _piperLruStamp(voiceId); _updatePiperErr(); return; }
    if (typeof showToast === "function") showToast("⬇ Downloading narrator voice (" + piperVoiceSize(voiceId) + ") — one-time, cached after", 6000);   // timed (#68): lifecycle info, not a cheer
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
      if (typeof carNotify === "function") carNotify("warn", "Voice download failed");   // final-pass #32: "warn" = status only — a download failure must not arm tap-to-retry (that re-fires the last GM turn)
      throw e;
    }
    _piperDownloaded[voiceId] = true;
    _piperLruStamp(voiceId);
    _updatePiperErr();   // repaint the modal's "not downloaded yet" info line if it's open (found stale in Phase 5 preview)
    if (typeof showToast === "function") showToast("✓ Narrator voice ready", 4000);   // timed (#68)
    if (typeof carNotify === "function") carNotify("info", "Voice ready");
    await _piperEvictExcess(mod, voiceId);   // #66: keep resident voice models bounded — never the one just ensured
    _renderPiperSlots();   // residency changed — repaint the slot array if Voice Settings is open (no-op otherwise)
  }

  // #66: called only after a fresh download (the already-downloaded branch above returns before
  // this point) — the cap is enforced at the moment residency actually grows, not on every ensure.
  // Failures are non-fatal per voice (a locked/in-use OPFS handle shouldn't block narration); the
  // loop advances to the next-oldest candidate instead of retrying the same id forever.
  // ⛨ THE deletion primitive (v1.419). Do NOT route voice deletion through the vendored
  // `remove()` — field-confirmed 2026-07-22 on iOS 18.7: the user pressed ✕, got a "🗑 Deleted"
  // toast, and the voice stayed in the list with the count unchanged. Mechanism: the vendored R()
  // deletes with `(await dir.getFileHandle(name)).remove()` — a CHROME-ONLY File System Access
  // extension Safari does not implement — inside a `try { } catch { console.error }` that swallows
  // the failure and resolves clean. So every delete this app has ever performed on an iPhone was a
  // no-op that reported success.
  //
  // Worse than a dead button: it permanently disabled the cap. `_piperEvictExcess` believed the
  // removal, dropped the voice's LRU stamp, and decremented its budget — and an unstamped id sorts
  // as OLDEST, so the next eviction picked the same phantom first and spent its whole budget
  // re-"removing" files that were never gone. After the first failure the cap could never be
  // enforced again, which is how 13 voices (~1GB) accumulated against a cap of 10.
  //
  // This deletes with `removeEntry()` — the STANDARD FileSystemDirectoryHandle primitive Safari
  // does implement — and THROWS on failure, so the callers' existing catch blocks finally mean
  // something. Deliberately local rather than a vendored patch: `vendor/piper/*` is served from a
  // permanent SW cache and needs a PIPER_RUNTIME_REV bump to deliver, which is the trap that ate
  // v1.322/v1.323. tts.js already reads OPFS directly (see _piperVoiceComplete), so nothing is lost.
  async function _piperRemoveVoiceFiles(voiceId) {
    var rel = ((_piperMod && _piperMod.PATH_MAP) || {})[voiceBaseId(voiceId)];   // #95: files are per MODEL
    if (!rel) throw new Error("unknown voice id (not in PATH_MAP): " + voiceId);
    var base = rel.split("/").pop();
    var dir = await (await navigator.storage.getDirectory()).getDirectoryHandle("piper");
    // The .onnx is the one that must go — it is the 60-130MB half and the one `stored()` counts.
    // A missing file is success, not failure: NotFoundError means the goal state already holds.
    try { await dir.removeEntry(base); }
    catch (e) { if (!e || e.name !== "NotFoundError") throw e; }
    // The sibling config is small and its absence is what _piperVoiceComplete uses to force a
    // re-download, so a failure here is worth surfacing but must not strand the freed .onnx.
    try { await dir.removeEntry(base + ".json"); }
    catch (e2) { if (e2 && e2.name !== "NotFoundError") console.warn("[tts piper] removed " + base + " but its .json remains:", e2 && e2.message); }
  }

  async function _piperEvictExcess(mod, keepId) {
    keepId = voiceBaseId(keepId);   // #95: stored() lists MODEL ids — a composite keepId would protect nothing
    var stored;
    // v1.419: was a silent `return` — a rejecting stored() disabled the cap with no trace at all.
    try { stored = await mod.stored(); } catch(e) { console.warn("[tts piper] eviction skipped — could not list stored voices:", e && e.message); return; }
    var over = stored.length - PIPER_VOICE_CAP;
    if (over <= 0) return;
    var lru = _piperLruLoad();
    var candidates = [], protectedIds = [];
    for (var i = 0; i < stored.length; i++) {
      if (stored[i] === keepId) continue;
      // ⛨ v1.419 — NEVER auto-delete a voice someone is actually using. Until this release
      // deletion was a no-op, which masked the hazard; the moment it started working, LRU age
      // alone could silently take the narrator's voice, or the one assigned to a companion, in the
      // middle of a drive. Recovery is worse than the loss: the next predict() re-fetches
      // 60-130MB from HuggingFace INSIDE the read, with no toast and no progress, on cellular.
      // Manual ✕ is unrestricted — that is the user choosing. This guard governs only the
      // automatic path. (User call 2026-07-22.)
      if (_voiceAssignedTo(stored[i]).length) { protectedIds.push(stored[i]); continue; }
      candidates.push(stored[i]);
    }
    candidates.sort(function(a, b) {
      var at = lru.hasOwnProperty(a) ? lru[a] : 0, bt = lru.hasOwnProperty(b) ? lru[b] : 0;   // unstamped voices count as oldest
      return at - bt;
    });
    for (var j = 0; j < candidates.length && over > 0; j++) {
      var id = candidates[j];
      try {
        await _piperRemoveVoiceFiles(id);   // throws on a real failure — see the primitive above
        var lru2 = _piperLruLoad();
        delete lru2[id];
        try { store.set(PIPER_VOICE_LRU_K, JSON.stringify(lru2)); } catch(e2) {}
        delete _piperDownloaded[id];
        over--;
        console.info("[tts piper] evicted narrator voice (LRU cap " + PIPER_VOICE_CAP + "): " + id);
        // Timed toast (#68) — the field test showed sticky lifecycle toasts stacking into spam
        if (typeof showToast === "function") showToast("🗑 Removed narrator voice " + id + " — keeping your " + PIPER_VOICE_CAP + " most recent", 8000);
      } catch(e) {
        // The LRU stamp is deliberately LEFT IN PLACE on failure. Deleting it was the other half
        // of the phantom ratchet: an unstamped id sorts oldest and gets re-picked forever.
        console.warn("[tts piper] failed to evict narrator voice " + id + ", keeping it:", e && e.message);
      }
    }
    // Over cap with nothing left to take means every remaining voice is in use. Staying over cap
    // is the correct outcome — but silently doing so is how this bug hid for weeks, so say it.
    if (over > 0) {
      console.warn("[tts piper] still " + over + " over the " + PIPER_VOICE_CAP + "-voice cap — the rest are assigned (" + protectedIds.join(", ") + "). Free space by deleting one in Voice Settings.");
      if (typeof showToast === "function") showToast("⚠ " + (PIPER_VOICE_CAP + over) + " voices downloaded, over the " + PIPER_VOICE_CAP + " cap — the extras are assigned to characters. Delete one in Voice Settings to free space.", 9000);
    }
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

  // ── Server tier read loop (#90 M1) ───────────────────────────────────────────────────────────
  // The _speakPiper unit loop with predict() replaced by fetch(/api/tts): same splitter, same
  // per-unit speaker map, same manual WAV decode, same scheduler/backpressure/pause tiers, same
  // shared epoch (one skip/stop invalidates whichever engine is mid-read). ZERO wasm work — the
  // governor never meters this tier. On ANY unit failure the read hands its REMAINDER (failed
  // unit included) one rung down the ladder via the queue — the governor's own mid-read handoff
  // pattern — and _serverTtsDegrade steers the next SERVER_TTS_RETRY_MS of reads local, so a
  // dead server costs ONE timeout, never a per-unit stall crawl.
  async function _speakServer(text, voiceId, voices) {
    var myEpoch = ++_piperEpoch;

    var ctx = _ensureCtx();
    if (!ctx) { console.warn("[tts server] AudioContext unavailable — line falls back to native"); _curNative = true; _speakNative(text); return; }
    var ctxOk = await _ctxRunning(ctx);
    if (_piperEpoch !== myEpoch) return;   // stale — a skip()/stop() ran while we awaited
    if (!ctxOk) { _ctxBlockedLoud("Server TTS"); _curNative = true; _speakNative(text); return; }
    primeAudioSession();
    _armCtxWatch("Server TTS");
    _armPosState(ctx);

    var units = splitSentences(text, null, true);   // identical prep to local Piper — the audio IS Piper audio
    if (!units.length) { _drain(); return; }

    _sources = [];
    var nextStart  = Math.max(_nextStart, ctx.currentTime + 0.05);
    var loopDone   = false;
    var activeSrcs = 0;
    var anyOk      = false;
    var handedOff  = false;

    function onAllDone() {
      _sources   = [];
      _nextStart = 0;
      _drain();
    }

    for (var i = 0; i < units.length; i++) {
      if (_piperEpoch !== myEpoch) return;
      // Same backpressure as _speakPiper — here it bounds decoded-PCM memory only (no synth to
      // pace), and it keeps pause() semantics identical: a suspended ctx freezes the playhead,
      // which parks this loop too.
      while (_piperEpoch === myEpoch && (nextStart - ctx.currentTime) > PIPER_MAX_AHEAD_SEC) {
        await new Promise(function(res) { setTimeout(res, 250); });
      }
      if (_piperEpoch !== myEpoch) return;

      var u = units[i];
      var uVoice = (voices && voices[i]) || voiceId;   // per-unit speaker map, same ids as local Piper
      var uTimeoutMs = (i === 0) ? SERVER_TTS_TIMEOUT_FIRST_MS : SERVER_TTS_TIMEOUT_MS;
      var ab = null, failReason = "", tid = null;
      try {
        var ctrl = (typeof AbortController !== "undefined") ? new AbortController() : null;
        if (ctrl) tid = setTimeout(function() { ctrl.abort(); }, uTimeoutMs);
        var opts = { method: "POST", headers: _serverTtsHeaders(),
                     body: JSON.stringify({ text: u.text, voiceId: uVoice, rate: getRate() }) };
        if (ctrl) opts.signal = ctrl.signal;
        var res = await fetch(_ttsServerUrl() + "/api/tts", opts);
        if (tid) clearTimeout(tid);
        if (_piperEpoch !== myEpoch) return;
        if (!res.ok) {
          failReason = "HTTP " + res.status;
          try { var j = await res.json(); if (j && j.error) failReason += " — " + j.error; } catch (e0) {}
          if (_piperEpoch !== myEpoch) return;
        } else {
          ab = await res.arrayBuffer();
          if (_piperEpoch !== myEpoch) return;
        }
      } catch (e) {
        if (tid) clearTimeout(tid);
        if (_piperEpoch !== myEpoch) return;
        failReason = (e && e.name === "AbortError") ? ("timeout after " + uTimeoutMs + "ms")
                                                    : ((e && e.message) || "network error");
      }

      if (failReason) {
        // Hand the WHOLE remainder (this unit included) down the ladder — already-scheduled
        // server audio plays out first, then _drain picks the remainder up on local Piper
        // (which itself degrades to native if it can't run). Mirrors the governor's handoff.
        var _remText = units.slice(i).map(function(ru) { return ru.text; }).join(" ");
        // #95 (S2): the remainder runs LOCALLY, where speaker ids don't exist — strip to the base
        // model here rather than handing the local loop something it would have to fix anyway.
        if (_remText) _queue.unshift({ text: _remText, piper: true, voiceId: voiceBaseId(voiceId) });
        handedOff = true;
        _serverTtsDegrade("unit " + (i + 1) + "/" + units.length + ": " + failReason);
        break;
      }

      var buf;
      try {
        buf = _wavToAudioBuffer(ab, ctx);   // v1.321 manual PCM16 parse — same daemon-retention bypass
        if (!buf) {
          _decodeFallbacks++;
          console.warn("[tts server] manual WAV parse failed on unit " + (i + 1) + "/" + units.length + " — falling back to decodeAudioData (da=" + _decodeFallbacks + ")");
          buf = await ctx.decodeAudioData(ab);
        }
        if (_piperEpoch !== myEpoch) return;
      } catch (e1) {
        console.warn("[tts server] decode failed on unit " + (i + 1) + "/" + units.length + ", skipping:", e1 && e1.message);
        continue;
      }

      anyOk = true;
      var src = ctx.createBufferSource();
      src.buffer = buf;
      src.connect(ctx.destination);
      var startAt = Math.max(nextStart, ctx.currentTime + 0.03);
      src.start(startAt);
      _ctxSynths++;   // B9 H1: playback sources on the current ctx — same accounting as local Piper
      nextStart  = startAt + buf.duration + unitGap(u);
      _nextStart = nextStart;

      activeSrcs++;
      _sources.push(src);
      src.onended = (function(mySrc) { return function() {
        activeSrcs--;
        try { mySrc.disconnect(); } catch (e) {}
        try { mySrc.buffer = null; } catch (e) {}   // Safari #718 — detach or the decoded PCM is retained
        var ix = _sources.indexOf(mySrc); if (ix >= 0) _sources.splice(ix, 1);
        if (loopDone && activeSrcs === 0 && _piperEpoch === myEpoch) onAllDone();
      }; })(src);
    }

    loopDone = true;
    if (_piperEpoch !== myEpoch) return;
    if (!anyOk && !handedOff) {
      // can't normally happen (the first failure hands off) — defined behavior anyway: loud + native
      console.warn("[tts server] no unit produced audio and nothing was handed off — falling back to native for this line");
      _curNative = true;
      _speakNative(text);
      return;
    }
    if (activeSrcs === 0) {
      if (handedOff) _drain();   // nothing scheduled by us — go straight to the remainder item
      else onAllDone();
    }
  }

  // Synthesize + schedule one narration item through Piper. Sequential per-unit loop (mirrors
  // piper_test.html speakAll()): predict → decode → schedule on the shared AudioContext timeline.
  // The epoch guard runs after EVERY await (see section comment above) — this is what makes a
  // stopped/skipped narration safe against an unabortable WASM call resolving late.
  async function _speakPiper(text, voiceId, voices) {
    var myEpoch = ++_piperEpoch;
    // #95 (S2): local Piper speaks the BASE model — strip the passage voice at the door, so every
    // downstream consumer (ensure/download, predict, the recycle warm-up, _voiceReady, the crumb's
    // voice-switch count) sees only ids the engine can actually resolve.
    voiceId = _localVoiceId(voiceId);

    // B9 governor START gate (v1.434): the page's synthesis budget is near spent — this read
    // never touches the wasm engine. The tab stops dying because the work stops happening.
    if (_piperGovernStart()) { _curNative = true; _speakNative(text); return; }

    var ctx = _ensureCtx();
    // Audit #17 (v1.341): no ctx at all → native fallback, never a silent drop.
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
      _speakNative(text);                                  // still speak THIS line via native
      return;
    }

    // default dashRepl ", " — commas ARE the right dash style for Piper (spike finding, §2);
    // commaSplit=true: Piper gets its rhythm from scheduled gaps (see the pause tiers above)
    var units = splitSentences(text, null, true);
    if (!units.length) { _drain(); return; }
    if (typeof erCrumb === "function") erCrumb("read-start", units.length + "u pc" + _piperSynthsTotal + " ps" + _piperSynthsSession + (voices ? " map" + Object.keys(voices).length : ""));

    // Per-unit crash journal (v1.324) — see _crumbDone/loadSettings. Written BEFORE each unit's
    // synth, so if the tab dies mid-predict the crumb names the killing unit.
    // #16c: ps/rc break the PIPER_RECYCLE_AFTER confound (session age is now recorded directly
    // instead of being inferred from the read index); vs/nv test whether the v1.406 sparse
    // speaker map — which alternates voices and therefore reloads the single-slot ORT session —
    // is what pushed the second B9 death to a LOWER cumulative synth count than the first.
    var _crumbBase = { n: units.length, rev: _piperPatchRev, app: (typeof APP_VERSION !== "undefined" ? APP_VERSION : "?") };
    var _vSwitches = 0;   // voice changes between consecutive units in THIS read
    function _crumb(iDone, done) {
      // pc/up (r8): cumulative synths + minutes since page load — see the counter block above.
      try {
        var _pm = _phonMem();   // sampled LIVE — the boot that reports this crumb has no engine loaded
        store.set(PIPER_CRUMB_K, JSON.stringify({
          i: iDone, n: _crumbBase.n, rev: _crumbBase.rev, app: _crumbBase.app,
          pc: _piperSynthsTotal, ps: _piperSynthsSession, rc: _piperRecycles,
          vs: _vSwitches, nv: _voiceCount(),
          pm: _pm ? _pm.mb : null, pmc: _pm ? _pm.calls : null,
          // v1.416: ORT wasm MB + phonemizer module count. v1.419 adds `omp`, the PAGE HIGH-WATER
          // mark: `om` is whatever the last sample said, but iOS kills on PEAK, and the first
          // post-fix death reported a placid 308MB precisely because nothing sampled mid-read.
          om: _ortMem(), omp: (_frameMemPeak || null), pn: _phonInstances(), rf: (_frameRespawnFails || null),
          eng: _piperFrame ? "frame" : "inpage", // v1.418: was the B9 fix actually active at death?
          // v1.430 (B9 H1): cs = sources on the CURRENT AudioContext (death with cs<40 falsifies
          // ctx-scoped playback accumulation in one crumb); cr = healthy-ctx recycles; da =
          // decodeAudioData fallbacks (G5 — 0 is the evidence, so it always rides).
          cs: _ctxSynths, cr: _ctxRecycles, da: _decodeFallbacks,
          // v1.434 (B9 root cause): cpu = cumulative synth work (the budget the kill tracks);
          // gv = the governor latched. A death crumb with gv:1 would mean the budget constants
          // are too high for this device — lower them, don't re-diagnose.
          cpu: Math.round(_piperCpuMs / 1000), gv: _piperGoverned ? 1 : undefined,

          up: Math.round((Date.now() - _piperBootAt) / 60000), done: !!done
        }));
      } catch(e) {}
    }
    _crumb(0, false);

    _sources = [];
    var _lastUnitVoice = null;
    var _voiceReady = {};      // #9: per-item memo of which speaker voices are loadable (true) or not (false)
    _voiceReady[voiceId] = true;   // the passage voice was ensured above
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
      // B9 governor HARD gate (v1.434): a long read crossing the absolute floor mid-flight stops
      // synthesizing and hands its REMAINDER to the native voice — queued, so the already-
      // scheduled Piper audio plays out first (onAllDone → _drain picks it up). i>0 always: the
      // START gate owns the fresh case, and unit 0 completing keeps anyOk semantics intact.
      if (i > 0 && _piperGovernHard()) {
        var _remText = units.slice(i).map(function(ru){ return ru.text; }).join(" ");
        if (_remText) _queue.unshift({ text: _remText, native: true });
        console.warn("[tts piper] governor: read stopped at unit " + i + "/" + units.length + " — remainder queued on the native voice");
        break;
      }
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

      // #9 per-unit speaker voice. Only a voice already resident is used inline; a NEW voice is
      // downloaded on first encounter (60-115MB), which would stall an already-playing read, so it
      // is fetched once here and every later unit reuses it. A voice that will not load degrades
      // THIS passage to the narrator rather than failing the read — and is remembered so the next
      // unit does not retry the same broken download.
      var uVoice = _localVoiceId((voices && voices[i]) || voiceId);   // #95 (S2): speaker → base model, locally
      if (i > 0 && uVoice !== _lastUnitVoice) _vSwitches++;   // #16c: each switch reloads the single-slot ORT session
      _lastUnitVoice = uVoice;
      if (uVoice !== voiceId && _voiceReady[uVoice] !== true) {
        if (_voiceReady[uVoice] === false) { uVoice = voiceId; }
        else {
          try {
            await _piperEnsureVoice(uVoice);
            if (_piperEpoch !== myEpoch) return;   // stale — a skip/stop ran during the download
            _voiceReady[uVoice] = true;
          } catch(e) {
            if (_piperEpoch !== myEpoch) return;
            console.warn("[tts piper] speaker voice " + uVoice + " unavailable — this passage uses the narrator voice:", e && e.message);
            _voiceReady[uVoice] = false; uVoice = voiceId;
          }
        }
      }

      var blob, _pt0 = performance.now();
      try {
        // trailing space: documented static-tail guard; _piperSerial: audit #9 (never concurrent
        // with a prewarm predict or another flow's ensure/download on the shared wasm session)
        blob = await _piperSerial(function() { return mod.predict({ text: u.text + " ", voiceId: uVoice, rate: getRate() }); });
      } catch(e) {
        _piperCpuMs += performance.now() - _pt0;   // v1.434: the work was spent either way (governor budget)
        console.warn("[tts piper] synth failed on unit " + (i + 1) + "/" + units.length + ", skipping:", e && e.message);
        continue;
      }
      _piperCpuMs += performance.now() - _pt0;      // v1.434: governor budget — cumulative synthesis work
      _piperSynthsTotal++; _piperSynthsSession++;   // r8: count BEFORE the stale check — the wasm memory was spent either way
      _frameSampleMem();   // v1.419 (B9): per-unit high-water sampling — the peak is what kills, and it lives INSIDE the read
      if (_piperEpoch !== myEpoch) return;   // stale — discard a predict() that resolved after invalidation

      var buf;
      try {
        var arrBuf = await blob.arrayBuffer();
        if (_piperEpoch !== myEpoch) return;   // stale — discard mid-decode
        buf = _wavToAudioBuffer(arrBuf, ctx);  // v1.321: manual PCM16 parse — bypasses WebKit's decodeAudioData daemon-side retention
        if (!buf) {
          _decodeFallbacks++;   // v1.430 (deepdive G5): this is the KNOWN daemon-side retention
                                // path (v1.321) and its only signal was a console no phone has —
                                // `da` on the crumb finally says whether it fires in the field
          console.warn("[tts piper] manual WAV parse failed on unit " + (i + 1) + "/" + units.length + " — falling back to decodeAudioData (iOS memory risk, da=" + _decodeFallbacks + ")");
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
      _ctxSynths++;   // B9 H1 (v1.430): one more source started on the current context (crumb: cs)
      nextStart  = startAt + buf.duration + unitGap(u);   // tiered: comma/clause/fullstop/paragraph (see PAUSE_* above)
      _nextStart = nextStart;

      activeSrcs++;
      _sources.push(src);
      src.onended = (function(mySrc) { return function() {
        activeSrcs--;
        // Free the played buffer (v1.320): disconnect + drop our reference so the decoded PCM can
        // GC as playback progresses — with the backpressure above, memory stays ~constant however
        // long the passage is. stop()/skip() only need the still-pending sources.
        // v1.430 (B9 H1): ALSO null the node's buffer ref — Safari is documented to retain a
        // source's decoded PCM after disconnect unless the buffer is explicitly detached
        // (standardized-audio-context #718); disconnect+deref alone was the one release step
        // this path skipped.
        try { mySrc.disconnect(); } catch(e) {}
        try { mySrc.buffer = null; } catch(e) {}
        var ix = _sources.indexOf(mySrc); if (ix >= 0) _sources.splice(ix, 1);
        if (loopDone && activeSrcs === 0 && _piperEpoch === myEpoch) onAllDone();
      }; })(src);
    }

    loopDone = true;
    if (typeof erCrumb === "function") erCrumb("read-done", units.length + "u vs" + _vSwitches);
    _crumb(units.length, true);   // synth loop completed — playback tail can't be "killed mid-synth"
    if (_piperEpoch !== myEpoch) return;   // stale — a skip() during the final unit must not reach the
                                           // fallback below (it would speak a skipped item via native)
                                           // or the activeSrcs===0 drain (double-_drain, overlapping items)
    _piperMaybeRecycle(voiceId);   // r8: between-narrations ORT session recycle (cross-turn ratchet guard);
                                   // deliberately BEFORE the !anyOk fallback — an all-units-failed session
                                   // is exactly one worth recycling
    if (!anyOk) {
      // every unit failed to synthesize — loud, then fall back to native for THIS item
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
    voiceId = _localVoiceId(voiceId);   // #95 (S2): callers pass resolvePiperVoice(), which may now carry a speaker
    if (_piperGoverned) return;   // v1.434: a governed page speaks native — don't spend budget warming an engine that won't run
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
        _piperSynthsTotal++; _piperSynthsSession++;   // r8: prewarm exercises the session like any predict
      } catch(e) {
        console.warn("[tts piper] prewarm failed (non-fatal):", e && e.message);
      }
    })();
  }

  // r8 (the 9/50 field crash) — between-narrations ORT session recycle. Fires from _speakPiper
  // after a synth loop completes, only once ≥PIPER_RECYCLE_AFTER synths have accumulated on the
  // current session. release() frees the session's wasm-side arena/plan-cache allocations back to
  // ORT's malloc so the heap stops ratcheting across turns; the background warm predict rebuilds
  // the session from OPFS off the critical path (epoch-snapshotted like prewarm — if a real read
  // races in, ITS first predict does the rebuild instead and the warm call is skipped). Loud on
  // both success and failure; failure is non-fatal (next predict rebuilds lazily).
  function _piperMaybeRecycle(voiceId) {
    // v1.418: when synthesis runs in the disposable realm, memory — not a synth count — decides.
    // The count was only ever a proxy for memory, and a poor one: read length varies by 5x, so the
    // same count means wildly different amounts of allocation. This runs BETWEEN reads (same call
    // site as the r8 recycle), so a respawn never interrupts narration.
    if (_piperFrame) { _frameMaybeRespawn(voiceId); return; }
    if (_piperFrameFailed) { _frameRetryUpgrade(); }   // self-heal; falls through to the r8 recycle below
    if (_piperSynthsSession < PIPER_RECYCLE_AFTER) return;
    if (!_piperMod || typeof _piperMod.tndRecycleSession !== "function") return;   // stale pre-r8 runtime — rev-mismatch warn already fired in _piperInit
    var myEpoch = _piperEpoch;
    var n = _piperSynthsSession;
    _piperSynthsSession = 0;
    _piperRecycles++;
    if (typeof erCrumb === "function") erCrumb("recycle", "#" + _piperRecycles + " after " + n);
    _piperSerial(function() { return _piperMod.tndRecycleSession(); })
      .then(function() {
        console.info("[tts piper] ORT session recycled after " + n + " synths (iOS memory-ratchet guard) — rebuilding in background");
        if (_piperEpoch !== myEpoch) return;   // a new read/stop raced in — its own predict rebuilds
        return _piperSerial(function() { return _piperMod.predict({ text: "ready", voiceId: voiceId, rate: getRate() }); })
          .then(function() { _piperSynthsTotal++; _piperSynthsSession++; });
      })
      .catch(function(e) { console.warn("[tts piper] session recycle failed (non-fatal — next predict rebuilds):", e && e.message); });
  }

  // Respawn the synthesis realm once its ORT memory crosses PIPER_RESPAWN_MB. Sequential by
  // design — build the replacement, then destroy the old one only after the new one is ready, so
  // a failure leaves the working engine in place rather than no engine at all. Both are briefly
  // alive (~170MB for the newcomer), which is why the threshold sits far below the ~1GB kill line.
  //
  // Runs off the critical path (between reads) and through _piperSerial, so it cannot overlap a
  // predict. Every exit is loud; every failure keeps the CURRENT frame.
  // Self-heal after a fallback. Runs between reads, so a failure costs nothing and simply leaves
  // the in-page engine in place to try again next time. The page's already-grown ORT memory
  // cannot be reclaimed (its realm is the page), but every synth from here on happens in a
  // disposable one — so the ratchet stops climbing even though it does not reset.
  var _frameUpgrading = false;
  function _frameRetryUpgrade() {
    if (_frameUpgrading || _piperFrame) return;
    _frameUpgrading = true;
    _piperSpawnFrame()
      .then(function (fresh) {
        return fresh.init().then(function () {
          _piperFrame = fresh; _piperMod = fresh; _piperFrameFailed = false;
          console.info("[tts piper] synthesis realm recovered — future synths run in a disposable iframe again (B9)");
          if (typeof erCrumb === "function") erCrumb("piper-frame-recovered", "");
          return _frameRefreshMem();
        }).catch(function (e) { try { fresh.destroy(); } catch (e2) {} throw e; });
      })
      .catch(function (e) {
        console.warn("[tts piper] synthesis realm retry failed — staying on the in-page engine:", e && e.message);
        // B9: crumb the FAILURE too. The success path crumbs `piper-frame-recovered`; without this
        // the failure was console-only, so a phone showed neither — leaving "never fired" and "fired
        // and failed silently every time" indistinguishable across a whole session (the exact blind
        // spot that hid the respawn failure for six versions). Carry the reason for triage.
        if (typeof erCrumb === "function") erCrumb("piper-frame-retry-fail", (e && e.message) || "?");
      })
      .then(function () { _frameUpgrading = false; }, function () { _frameUpgrading = false; });
  }

  var _frameRespawning  = false;
  var _frameRespawnFails = 0;   // v1.422: respawn attempts that FAILED this page load — rides the crumb as rf

  // The swap itself. Sequential ON PURPOSE — the replacement is built and warmed BEFORE the old
  // one is destroyed, so any failure leaves the working engine in place rather than no engine.
  // Resolves {before, after} in MB.
  // v1.422 — WHICH STAGE failed. Twelve field crumbs showed the respawn triggering repeatedly
  // (`realm-respawn 527MB after 44/75/100`) while `rc` stayed 0 and the memory never moved: the
  // swap was failing every time and saying so only to a console no phone has. A fix that silently
  // never runs is worse than no fix. This stage marker rides the failure crumb so the next report
  // distinguishes "the new frame never signalled ready" (the 30s timeout, i.e. the phone could not
  // afford a second realm — which would indict the build-then-destroy ordering) from "the engine
  // failed to boot in it" from "the swap itself threw".
  var _respawnStage = "";
  var _frameRespawnP = null;   // v1.429: the live swap's promise — _piperInit awaits it instead of double-spawning
  function _frameRespawnNow(voiceId) {
    var before = null;
    _respawnStage = "mem";
    // Sample BEFORE the swap, from the live frame — _frameMem may be stale (it is only refreshed
    // between reads), and reporting a null "before" makes the one number that proves this feature
    // works unreadable.
    var p = _frameRefreshMem().then(function (m0) {
      before = m0 && m0.ortMB;
      return _piperSerial(function () {
        var old = _piperFrame;
        if (!old) throw new Error("no synthesis realm to respawn");
        // ⛨ DESTROY FIRST (v1.424). This was build-then-destroy until the field said otherwise:
        // eighteen crumbs, and EVERY respawn failed at stage `spawn` with "piper host did not
        // signal ready within 30s". The replacement realm never started while the old one was
        // alive — it never even reached its own `ready` post, which happens before any ORT import.
        // Build-then-destroy was chosen so a failure would leave the working engine in place, but
        // that safety is worthless when the build can never succeed: at 429-624MB resident the
        // phone simply would not start a second realm, so the fix had never once completed.
        //
        // So: free the old realm, THEN construct into the space it vacated. The cost is a window
        // with no engine at all, which is affordable because this runs BETWEEN reads (nothing is
        // playing) and `_piperInit` rebuilds lazily on the next predict anyway — that lazy path is
        // the same one used at boot and is known to work. If the rebuild below fails, the pointers
        // stay null and the next read simply re-inits, which is strictly better than the old
        // behaviour of keeping a bloated realm forever.
        _respawnStage = "destroy";
        try { old.destroy(); } catch (e) {}
        _piperFrame = null; _piperMod = null; _frameMem = null;
        _respawnStage = "spawn";
        return _piperSpawnFrame().then(function (fresh) {
        _respawnStage = "init";
        return fresh.init()
          .then(function () {
            _respawnStage = "warm";
            // Warm the replacement so the next read does not pay the session build. ONLY for a
            // voice already on disk: resolvePiperVoice() can name a narrator voice that has never
            // been downloaded, and warming that would kick off a surprise 60-115MB download from a
            // background maintenance path. Skipping is free — the next real predict builds the
            // session anyway. Failure is survivable too, so it never aborts the swap.
            var warmId = voiceBaseId(voiceId || resolvePiperVoice());   // #95: _piperDownloaded is keyed by MODEL — a composite would always read "not resident"
            if (!warmId || !_piperDownloaded[warmId]) {
              console.info("[tts piper] respawn: skipping warm predict — " + warmId + " is not resident (no surprise download)");
              return null;
            }
            return fresh.predict({ text: "ready", voiceId: warmId, rate: getRate() })
              .catch(function (e) { console.warn("[tts piper] respawn warm predict failed (non-fatal):", e && e.message); });
          })
          .then(function () {
            _respawnStage = "swap";
            _piperFrame = fresh; _piperMod = fresh;
            _piperSynthsSession = 0; _piperRecycles++;
            // (the old realm is already gone — it was destroyed before this one was built)
            return _frameRefreshMem().then(function (m2) {
              var after = m2 && m2.ortMB;
              console.info("[tts piper] realm respawned — ORT " + before + "MB → " + after + "MB");
              return { before: before, after: after };
            });
          })
          .catch(function (e) {
            // There is no old frame to fall back to any more, and that is deliberate. Leave the
            // pointers null: the next read calls _piperInit, which builds a realm the same way
            // boot does — a path that works, and now works against FREED memory rather than
            // against the 429-624MB that made every previous attempt time out.
            try { fresh.destroy(); } catch (e2) {}
            // v1.429: null ONLY if the pointers are ours (or already null). The _piperInit wait
            // makes a third-party claim unreachable, but an unconditional null here would turn
            // any future regression of that wait into "leak a live realm AND report no engine".
            if (_piperFrame === null || _piperFrame === fresh) { _piperFrame = null; _piperMod = null; }
            throw e;
          });
        });
      });
    });
    // v1.429 (Fable review, todo_checkWithFable #6.3): publish the swap as _frameRespawnP so a
    // read's _piperInit WAITS for it instead of racing it with a second concurrent realm (see the
    // head of _piperInit — the respawn spawns directly and never holds _piperInitP, so that guard
    // alone left the two-realms window open). Identity-checked on clear so a future overlapping
    // caller can never null someone else's live handle.
    _frameRespawnP = p;
    var _clearRespawnP = function () { if (_frameRespawnP === p) _frameRespawnP = null; };
    p.then(_clearRespawnP, _clearRespawnP);
    return p;
  }

  function _frameMaybeRespawn(voiceId) {
    if (_frameRespawning || !_piperFrame) return;
    _frameRespawning = true;
    _frameRefreshMem()
      .then(function (m) {
        var mb = m && m.ortMB;
        if (typeof mb !== "number" || mb < PIPER_RESPAWN_MB) return null;
        console.info("[tts piper] ORT at " + mb + "MB (≥" + PIPER_RESPAWN_MB + ") — respawning the synthesis realm (B9)");
        if (typeof erCrumb === "function") erCrumb("realm-respawn", mb + "MB after " + _piperSynthsTotal);
        return _frameRespawnNow(voiceId);
      })
      .catch(function (e) {
        // v1.422: CRUMB IT. This path fired on every field death since v1.418 — three and four
        // times per session — and left no trace anywhere the phone could report, so the fix
        // looked like it was working when it had never once completed. `rc` staying 0 was the
        // only hint, and it took twelve crumbs to notice.
        _frameRespawnFails++;
        var why = (e && e.message) || String(e);
        console.warn("[tts piper] realm respawn FAILED at stage '" + _respawnStage + "' (#" + _frameRespawnFails + ") — keeping the current engine, memory keeps climbing:", why);
        if (typeof erCrumb === "function") erCrumb("respawn-fail", _respawnStage + " #" + _frameRespawnFails + " " + ((_frameMem && _frameMem.ortMB) || "?") + "MB " + why.slice(0, 40));
      })
      .then(function () { _frameRespawning = false; }, function () { _frameRespawning = false; });
  }

  // Manual engine reset. Two jobs, both wanted independently of the automatic policy: it is the
  // user-facing mitigation if narration ever starts feeling heavy mid-drive, and it is the
  // deterministic way to VERIFY realm teardown actually returns memory (the automatic path only
  // fires above a threshold that takes ~30 varied synths to reach). Rejects loudly on the in-page
  // fallback path, where there is no realm to throw away.
  function respawnEngine() {
    if (!_piperFrame) return Promise.reject(new Error("synthesis realm not in use (in-page fallback) — nothing to respawn"));
    return _frameRespawnNow(null);
  }

  // ── Car Mode support: earcons + replay (todo_carplay.html ranks 14, 17/18) ─────────────────
  // Both are exported for ui-carmode.js (typeof-guarded there — this file loads before it).

  // Three tiny WebAudio blips, deliberately OFF the narration scheduler: separate oscillator/gain
  // nodes wired straight to ctx.destination, never touching _nextStart/_sources, so they can never
  // shift a scheduled narration start or get swept by stop()/skip(). Quiet (gain ~0.08), <200ms.
  // No-op (console.debug only) if the ctx doesn't exist or isn't running — never throws, never
  // creates/resumes the ctx itself (that's a user-gesture concern owned by toggle()/primeAudioSession).
  function earcon(kind) {
    try {
      var ctx = _ensureCtx();   // reuse the shared ctx — creates it only if genuinely absent
      if (!ctx) { console.debug("[tts] earcon '" + kind + "' skipped — no AudioContext"); return; }
      _resumeCtx(ctx, "piper-entry");          // best-effort; does not block — see the state check right below
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
      // B16 — failure. DESCENDING and below both success tones on purpose: in Car Mode the driver
      // is not looking at the screen, so this blip is the only thing that says "the turn is over
      // and it failed" rather than "still thinking". An ascending or same-register pair would be
      // heard as a completion, which is the exact confusion the earcon exists to remove.
      else if (kind === "fail") { blip(0, 400, 0.11); blip(0.13, 300, 0.16); }
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
    // AudioContext suspend/resume — the shared WebAudio branch. No Piper-specific code needed.
    if (!_audioCtx) return;
    if (_audioCtx.state !== "running") {   // v1.327: "suspended" OR iOS "interrupted" → resume; only a running ctx pauses
      _resumeCtx(_audioCtx, "pause-resume");
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

  // Red indicator beside the Piper voice label — one span; a real error takes priority over the
  // informational "not downloaded yet" note. Deliberately
  // synchronous (no await/init here — this file's async surface is confined to the four Piper
  // adapter functions, see the header comment): _piperDownloaded is session-local best-effort
  // memory populated by _piperEnsureVoice/_piperRefreshDownloaded, not a live OPFS query, so
  // opening the settings modal never forces an engine load just to paint this indicator.
  // #90: the server-tier line in Voice Settings — off (not connected) / active / degraded-with-
  // reason. Self-no-ops when the modal isn't open (same contract as _updatePiperErr).
  function _updateServerLine() {
    if (typeof document === "undefined") return;   // headless engine tests exercise the degrade path
    var el = document.getElementById("tts-server-line");
    if (!el) return;
    var msg, col = "var(--t2)";
    if (typeof storageAdapter === "undefined" || typeof storageAdapter.isServerMode !== "function" ||
        !storageAdapter.isServerMode() || !storageAdapter.hasToken()) {
      msg = "☁ Server narration: off — connect to the server to synthesize in the cloud instead of on this device.";
    } else if (_serverTtsErr) {
      msg = "☁ Server narration: unavailable (" + _serverTtsErr + ") — using the on-device engine; retries automatically.";
      col = "#e0a060";
    } else {
      msg = "☁ Server narration: active — voices synthesize on the server (no on-device load).";
    }
    el.textContent = msg;
    el.style.color = col;
  }

  function _updatePiperErr() {
    var el = document.getElementById("tts-piper-err");
    if (!el) return;
    var msg = "", isErr = false;
    if (_piperError) {
      msg = "⚠ " + _piperError + " — using native voice";
      isErr = true;
    } else {
      var sel = document.getElementById("tts-piper-sel");
      var voiceId = voiceBaseId(sel ? sel.value : resolvePiperVoice());   // #95: _piperDownloaded is keyed by MODEL
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
    if (rt) rt.textContent = "Piper runtime: " + (_piperPatchRev ? _piperPatchRev + " (loaded)" : PIPER_RUNTIME_REV + " expected — engine loads on first use") + " · app " + (typeof APP_VERSION !== "undefined" ? APP_VERSION : "?") +
                             (_piperSynthsTotal ? " · " + _piperSynthsTotal + " synths (" + _piperSynthsSession + " on session)" : "") +   // r8: on-phone memory-ratchet forensics
                             // v1.418 (B9): the ONE line that says whether the memory fix is live
                             // on this device. "disposable realm" = synthesis runs in a throwaway
                             // iframe that gets replaced before memory climbs; "IN-PAGE (memory
                             // ratchets)" = the fallback, which narrates fine and then dies at
                             // ~1GB exactly as before. Nothing else on a phone can tell them apart.
                             (_piperReady ? " · " + (_piperFrame ? "disposable realm" : "IN-PAGE (memory ratchets)") +
                               (_ortMem() === null ? "" : ", ORT " + _ortMem() + "MB") : "");
  }

  // Non-blocking refresh of _piperDownloaded from the REAL on-disk store. v1.331: reads OPFS
  // directly (same 'piper' directory vits-web's stored() lists) so the modal's "not downloaded
  // yet" line is TRUTHFUL without engine init — the old engine-warm-only refresh left the line
  // pessimistic on fresh sessions, and that mis-read cost two rounds of on-phone diagnosis
  // (the model was on the device the whole time). Falls back to the engine listing when OPFS
  // isn't available. Plain .then() callbacks per the file's async-surface convention.
  function _piperRefreshDownloaded() {
    _piperOpfsIds().then(function(ids) {
      for (var i = 0; i < ids.length; i++) _piperDownloaded[ids[i]] = true;
      _updatePiperErr();
    });
    if (!_piperMod || typeof _piperMod.stored !== "function") return;
    _piperMod.stored().then(function(stored) {
      for (var i = 0; i < stored.length; i++) _piperDownloaded[stored[i]] = true;
      _updatePiperErr();
    }).catch(function() {});
  }

  // Shared OPFS voice listing (factored from _piperRefreshDownloaded for the #66 slot UI): resolves
  // the resident voice ids WITHOUT engine init, [] on any failure (no OPFS dir yet = none resident).
  function _piperOpfsIds() {
    if (!(navigator.storage && navigator.storage.getDirectory)) return Promise.resolve([]);
    return navigator.storage.getDirectory().then(function(rootDir) {
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
    }).catch(function() { return []; });
  }

  // ── #66 slot UI (user call 2026-07-17): the resident-voice array in the Piper panel ────────────
  // Shows exactly PIPER_VOICE_CAP slots (the cap made VISIBLE — the field test's eviction toast was
  // the user's first hint a cap existed), most-recently-used first, so the BOTTOM filled slot is
  // the next eviction candidate. Radio = pick that voice (mirrors the dropdown: sets the select +
  // blurb; Save persists, same as a dropdown pick). ✕ = delete from OPFS on the spot.
  function _renderPiperSlots() {
    var host = document.getElementById("tts-piper-slots");
    if (!host) return;   // Voice Settings not open — callers fire this unconditionally on residency changes
    _piperOpfsIds().then(function(ids) {
      var lru = _piperLruLoad(), sel = document.getElementById("tts-piper-sel");
      var cur = voiceBaseId(sel ? sel.value : resolvePiperVoice());   // #95: rows are MODEL files — a cast voice highlights its model
      ids.sort(function(a, b) {
        var at = lru.hasOwnProperty(a) ? lru[a] : 0, bt = lru.hasOwnProperty(b) ? lru[b] : 0;
        return bt - at;   // most recent first — bottom of the list is next to evict
      });
      // v1.419: render EVERY resident voice, not just the first PIPER_VOICE_CAP. The loop used to
      // stop at the cap, so when the cap broke and 13 voices accumulated, the header honestly said
      // "13 of 10 slots" while three of them had no row — counted, but with no ✕ to press. And
      // because the sort is most-recent-first, the hidden three were exactly the stale ones the
      // user most wanted gone. A number you cannot act on is worse than no number.
      var rows = Math.max(PIPER_VOICE_CAP, ids.length);
      var html = "<label style='font-size:12px;color:var(--t2);display:block;margin:10px 0 4px;'>Downloaded voices (" + ids.length + " of " + PIPER_VOICE_CAP + " slots" + (ids.length > PIPER_VOICE_CAP ? " — over cap, delete some" : "") + ")</label>", i;
      var rowData = [];   // v1.427: raw {label, assigned} per voice row, indexed by the .pv-row NodeList
                          // order below — captured here so the long-press dialog uses clean JS values
                          // and never round-trips names through attribute escaping.
      for (i = 0; i < rows; i++) {
        if (i < ids.length) {
          var id = ids[i], nm = id, bi;
          for (bi = 0; bi < PIPER_VOICES.length; bi++) { if (PIPER_VOICES[bi].id === id) { nm = PIPER_VOICES[bi].label; break; } }
          // v1.425-v1.427 (user requests) — make it OBVIOUS what is safe to delete. A voice no
          // character or the narrator uses drops its name to 50% grey; one in use is full-strength
          // and BOLD. Long-press (or desktop hover) opens a proper dialog with the exact assignee(s)
          // or UNASSIGNED. The callout-suppression CSS is inline (NOT the `.has-tip` class): has-tip
          // is claimed by _ensureLongPressTips' document-level handler, which would ALSO fire on a
          // long-press and pop its own centred tooltip — double UI. Inline gives the same
          // copy-callout fix (#83) while leaving this row's long-press entirely ours.
          // `_voiceAssignedTo` returns the player/companions/narrator that speak in this voice.
          var assigned = (typeof _voiceAssignedTo === "function") ? _voiceAssignedTo(id) : [];
          var inUse = assigned.length > 0;
          var nameStyle = inUse ? "color:var(--t0);font-weight:700;" : "color:#808080;";
          rowData.push({ label: nm, assigned: assigned });
          var title = (_escVal(nm) + (inUse ? " — used by " + _escVal(assigned.join(", ")) : " — UNASSIGNED")).replace(/'/g, "&#39;");
          html += "<div class='pv-row' title='" + title + "' style='display:flex;align-items:center;gap:8px;padding:6px 10px;border:1px solid " + (id === cur ? "var(--acc)" : "var(--brd)") + ";border-radius:6px;margin-bottom:4px;-webkit-touch-callout:none;-webkit-user-select:none;user-select:none;'>"
            + "<input type='radio' name='tts-piper-resident' value='" + _escVal(id) + "'" + (id === cur ? " checked" : "") + " style='accent-color:var(--acc);margin:0;flex-shrink:0;'/>"
            + "<span style='flex:1;font-size:12px;" + nameStyle + "'>" + _escVal(nm) + "</span>"
            + "<span style='font-size:10px;color:var(--t2);'>" + _escVal(piperVoiceSize(id)) + "</span>"
            + "<button data-pvoice-del='" + _escVal(id) + "' style='background:none;border:none;color:var(--t2);cursor:pointer;font-size:14px;padding:0 2px;line-height:1;' title='Delete this voice from the device'>&#215;</button>"
            + "</div>";
        } else {
          html += "<div style='padding:6px 10px;border:1px dashed var(--brd);border-radius:6px;margin-bottom:4px;font-size:11px;color:var(--t2);opacity:.6;'>— empty slot —</div>";
        }
      }
      html += "<div style='font-size:11px;color:var(--t2);margin-top:2px;'>Downloading past " + PIPER_VOICE_CAP + " replaces the least-recently-used one — you're warned first, with who it's assigned to.</div>";
      host.innerHTML = html;
      var radios = host.querySelectorAll("input[name='tts-piper-resident']"), r;
      for (r = 0; r < radios.length; r++) {
        radios[r].addEventListener("change", function() {
          // Mirror a dropdown pick exactly — set the select and let Save persist, no second write path
          var s = document.getElementById("tts-piper-sel");
          if (s) s.value = this.value;
          var blurb = document.getElementById("tts-piper-blurb");
          if (blurb) blurb.textContent = _piperVoiceBlurb(this.value);
          _updatePiperErr();
          _renderPiperSlots();   // repaint the border highlight
        });
      }
      var dels = host.querySelectorAll("[data-pvoice-del]"), d;
      for (d = 0; d < dels.length; d++) {
        dels[d].addEventListener("click", function() { _piperDeleteVoice(this.getAttribute("data-pvoice-del")); });
      }
      // v1.426/v1.427 — long-press a voice row to OPEN A DIALOG naming its assignee(s) or
      // UNASSIGNED. Mirrors the suggested-action long-press (ui-boot.js): 500ms hold, cancelled by
      // a >10px drag; the radio / ✕ keep their own tap behaviour so a hold starting on them is
      // ignored. `rowData[pr]` aligns with this NodeList because voice rows are emitted before the
      // empty-slot placeholders and only voice rows carry `.pv-row`. Rows are rebuilt each render,
      // so listeners never stack.
      var prows = host.querySelectorAll(".pv-row"), pr;
      for (pr = 0; pr < prows.length; pr++) {
        (function(row, data) {
          var t = null, sx = 0, sy = 0;
          function clr() { if (t) { clearTimeout(t); t = null; } }
          row.addEventListener("pointerdown", function(e) {
            if (e.target && e.target.closest && e.target.closest("input,button")) return;
            sx = e.clientX; sy = e.clientY;
            t = setTimeout(function() { t = null; if (data) _pvShowAssignDialog(data.label, data.assigned); }, 500);
          });
          row.addEventListener("pointermove", function(e) { if (t && (Math.abs(e.clientX - sx) > 10 || Math.abs(e.clientY - sy) > 10)) clr(); });
          row.addEventListener("pointerup", clr);
          row.addEventListener("pointercancel", clr);
          row.addEventListener("pointerleave", clr);
          row.addEventListener("contextmenu", function(e) { e.preventDefault(); });
        })(prows[pr], rowData[pr]);
      }
    });
  }

  // The long-press dialog (v1.427). A proper modal, not a toast — clearer, dismissible, and stacks
  // above the Voice Settings modal (z 400 > 300). Content is escHtml'd for its innerHTML context;
  // label/assignee are campaign-authored NPC names, so this is the same trust boundary the sheet
  // UI already lives at, closed the same way (escHtml + click-outside/✕).
  function _pvShowAssignDialog(label, assigned) {
    if (typeof modalShell !== "function") return;   // ui-shell.js is loaded before this file
    var esc = (typeof escHtml === "function") ? escHtml : function(s){ return String(s || ""); };
    var body = (assigned && assigned.length)
      ? "<div style='font-size:13px;color:var(--t1);line-height:1.6;'>Used by:<br><b style='color:var(--t0);'>" + esc(assigned.join(", ")) + "</b></div>"
      : "<div style='font-size:13px;color:var(--t1);line-height:1.6;'><b style='color:#808080;'>UNASSIGNED</b><br>No character or the narrator uses this voice — safe to delete.</div>";
    modalShell("pv-assign-dlg",
      "<div style='display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;gap:12px;'>"
      + "<span style='font-size:15px;color:var(--t0);font-weight:bold;'>&#128266; " + esc(label) + "</span>"
      + "<button id='pv-dlg-x' style='background:none;border:none;color:var(--t2);font-size:20px;cursor:pointer;line-height:1;'>&#215;</button>"
      + "</div>" + body,
      { maxWidth: 340, closeId: "pv-dlg-x", outside: true, z: 400 });
  }

  // ✕ handler — engine-load is acceptable here (remove() only touches OPFS, no wasm compile), and
  // the op rides _piperSerial so it can never interleave a download/predict on the shared session.
  function _piperDeleteVoice(id) {
    _piperInit().then(function(mod) {
      // v1.419: was mod.remove(id) — the vendored path that swallows every failure and resolves
      // clean, so this button reported "🗑 Deleted" while the file stayed put (field-confirmed on
      // iOS). _piperRemoveVoiceFiles throws, so the catch below finally has something to catch.
      return _piperSerial(function() { return _piperRemoveVoiceFiles(id); });
    }).then(function() {
      var lru = _piperLruLoad();
      delete lru[id];
      try { store.set(PIPER_VOICE_LRU_K, JSON.stringify(lru)); } catch(e) {}
      delete _piperDownloaded[id];
      var stillSelected = (voiceBaseId(resolvePiperVoice()) === voiceBaseId(id));   // #95: a narrator cast on …#204 still needs this MODEL
      if (typeof showToast === "function") showToast("🗑 Deleted narrator voice " + id + (stillSelected ? " — still selected, re-downloads on next use" : ""), 6000);
      _updatePiperErr();
      _renderPiperSlots();
    }).catch(function(e) {
      console.warn("[tts piper] voice delete failed:", e && e.message);
      if (typeof showToast === "function") showToast("⚠ Could not delete voice " + id + ": " + ((e && e.message) || "unknown error"), 8000);
    });
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

  // ── #95 S5: the starred cast ─────────────────────────────────────────────────────────────────
  // Device-level store written by speaker_browser.html (the audition satellite): [{id,label}] with
  // user-editable labels ("Gravelly innkeeper"). Device-level ON PURPOSE — stars are picker
  // convenience; the actual binding (charSheet.voiceId) already rides sheets and sync.
  //
  // A NEVER-WRITTEN store serves the DEFAULT BENCH below (#95.6) — new players start with a
  // curated cast instead of an empty dropdown. A stored "[]" is different: the user deliberately
  // cleared their bench, and it stays empty. Corrupt/foreign-shaped stores still yield [] with no
  // warn and no toast (not a swallowed failure: nothing was supposed to work yet), and malformed
  // ENTRIES inside a valid array are skipped individually, so one bad row can't cost the user the
  // rest of their cast.
  //
  // >>> DEFAULT STAR BENCH (#95.6) — the 52-voice starter cast (curated by the dev, 2026-07-26).
  // An IDENTICAL copy lives in speaker_browser.html (self-contained satellite, no shared file
  // possible) — the DEFAULT BENCH CONTRACT in dev/run-tests.js asserts the two arrays are
  // byte-identical, so edit BOTH copies or the build fails.
  var DEFAULT_SPEAKER_STARS = [
    { id: "en_US-libritts_r-medium#1", label: "Speaker 1 · reader 8699 (F)", g: "F" },
    { id: "en_US-libritts_r-medium#3", label: "Speaker 3 · reader 6701 (M)", g: "M" },
    { id: "en_US-libritts_r-medium#7", label: "Speaker 7 · reader 1638 (M)", g: "M" },
    { id: "en_US-libritts_r-medium#9", label: "Speaker 9 · reader 6544 (F)", g: "F" },
    { id: "en_US-libritts_r-medium#10", label: "Speaker 10 · reader 3615 (F)", g: "F" },
    { id: "en_US-libritts_r-medium#50", label: "Speaker 50 · reader 7874 (M)", g: "M" },
    { id: "en_US-libritts_r-medium#52", label: "Speaker 52 · reader 2053 (F)", g: "F" },
    { id: "en_US-libritts_r-medium#54", label: "Speaker 54 · reader 16 (F)", g: "F" },
    { id: "en_US-libritts_r-medium#56", label: "Speaker 56 · reader 1923 (F)", g: "F" },
    { id: "en_US-libritts_r-medium#64", label: "Speaker 64 · reader 3003 (F)", g: "F" },
    { id: "en_US-libritts_r-medium#65", label: "Speaker 65 · reader 7739 (F)", g: "F" },
    { id: "en_US-libritts_r-medium#71", label: "Speaker 71 · reader 2299 (M)", g: "M" },
    { id: "en_US-libritts_r-medium#72", label: "Speaker 72 · reader 7188 (M)", g: "M" },
    { id: "en_US-libritts_r-medium#75", label: "Speaker 75 · reader 8684 (F)", g: "F" },
    { id: "en_US-libritts_r-medium#116", label: "Speaker 116 · reader 2156 (M)", g: "M" },
    { id: "en_US-libritts_r-medium#114", label: "Speaker 114 · reader 5802 (M)", g: "M" },
    { id: "en_US-libritts_r-medium#107", label: "Speaker 107 · reader 6696 (F)", g: "F" },
    { id: "en_US-libritts_r-medium#98", label: "Speaker 98 · reader 192 (F)", g: "F" },
    { id: "en_US-libritts_r-medium#93", label: "Speaker 93 · reader 7434 (F)", g: "F" },
    { id: "en_US-libritts_r-medium#90", label: "Speaker 90 · reader 6694 (M)", g: "M" },
    { id: "en_US-libritts_r-medium#89", label: "Speaker 89 · reader 6575 (M)", g: "M" },
    { id: "en_US-libritts_r-medium#26", label: "Speaker 26 · reader 28 (F)", g: "F" },
    { id: "en_US-libritts_r-medium#25", label: "Speaker 25 · reader 339 (F)", g: "F" },
    { id: "en_US-libritts_r-medium#120", label: "Speaker 120 · reader 1093 (F)", g: "F" },
    { id: "en_US-libritts_r-medium#123", label: "Speaker 123 · reader 6877 (M)", g: "M" },
    { id: "en_US-libritts_r-medium#174", label: "Speaker 174 · reader 6981 (M)", g: "M" },
    { id: "en_US-libritts_r-medium#153", label: "Speaker 153 · reader 126 (F)", g: "F" },
    { id: "en_US-libritts_r-medium#129", label: "Speaker 129 · reader 688 (F)", g: "F" },
    { id: "en_US-libritts_r-medium#126", label: "Speaker 126 · reader 288 (F)", g: "F" },
    { id: "en_US-libritts_r-medium#111", label: "Speaker 111 · reader 2010 (F)", g: "F" },
    { id: "en_US-libritts_r-medium#805", label: "Speaker 805 · reader 17 (M)", g: "M" },
    { id: "en_GB-vctk-medium#1", label: "Speaker 1 · reader p236 · English (F)", g: "F" },
    { id: "en_GB-vctk-medium#2", label: "Speaker 2 · reader p264 · Scottish (F)", g: "F" },
    { id: "en_GB-vctk-medium#8", label: "Speaker 8 · reader p283 · Irish (F)", g: "F" },
    { id: "en_GB-vctk-medium#9", label: "Speaker 9 · reader p286 · English (M)", g: "M" },
    { id: "en_GB-vctk-medium#11", label: "Speaker 11 · reader p276 · English (F)", g: "F" },
    { id: "en_GB-vctk-medium#13", label: "Speaker 13 · reader p281 · Scottish (M)", g: "M" },
    { id: "en_GB-vctk-medium#20", label: "Speaker 20 · reader p284 · Scottish (M)", g: "M" },
    { id: "en_GB-vctk-medium#73", label: "Speaker 73 · reader s5 · British (F)", g: "F" },
    { id: "en_GB-vctk-medium#17", label: "Speaker 17 · reader p238 · NorthernIrish (F)", g: "F" },
    { id: "en_GB-vctk-medium#61", label: "Speaker 61 · reader p292 · NorthernIrish (M)", g: "M" },
    { id: "en_GB-vctk-medium#78", label: "Speaker 78 · reader p293 · NorthernIrish (F)", g: "F" },
    { id: "en_GB-vctk-medium#63", label: "Speaker 63 · reader p280 · Unknown (F)", g: "F" },
    { id: "en_GB-vctk-medium#87", label: "Speaker 87 · reader p248 · Indian (F)", g: "F" },
    { id: "en_GB-vctk-medium#46", label: "Speaker 46 · reader p313 · Irish (F)", g: "F" },
    { id: "en_GB-vctk-medium#67", label: "Speaker 67 · reader p298 · Irish (M)", g: "M" },
    { id: "en_GB-vctk-medium#5", label: "Speaker 5 · reader p247 · Scottish (M)", g: "M" },
    { id: "en_GB-vctk-medium#55", label: "Speaker 55 · reader p275 · Scottish (M)", g: "M" },
    { id: "en_GB-vctk-medium#79", label: "Speaker 79 · reader p252 · Scottish (M)", g: "M" },
    { id: "en_GB-vctk-medium#29", label: "Speaker 29 · reader p334 · American (M)", g: "M" },
    { id: "en_GB-vctk-medium#4", label: "Speaker 4 · reader p259 · English (M)", g: "M" },
    { id: "en_GB-vctk-medium#76", label: "Speaker 76 · reader p254 · English (M)", g: "M" }
  ];
  // <<< DEFAULT STAR BENCH
  var SPEAKER_STARS_K = "tnd_speaker_stars_v1";
  function starsList() {
    var raw;
    try { raw = store.get(SPEAKER_STARS_K); } catch (e) { return []; }
    if (!raw) {
      // never written on this origin → the default bench (fresh copies — callers may mutate)
      return DEFAULT_SPEAKER_STARS.map(function (s) { return { id: s.id, label: s.label, g: s.g }; });
    }
    var arr;
    try { arr = JSON.parse(raw); } catch (e) { return []; }
    if (Object.prototype.toString.call(arr) !== "[object Array]") return [];
    var out = [], i, e2, lbl;
    for (i = 0; i < arr.length; i++) {
      e2 = arr[i];
      if (!e2 || typeof e2.id !== "string" || !e2.id) continue;
      lbl = (typeof e2.label === "string" && e2.label) ? e2.label : e2.id;
      out.push({ id: e2.id, label: lbl, g: _starGender(e2.g, lbl) });
    }
    return out;
  }
  // #95.7: a star's gender — the STRUCTURED field when valid (mutable in the speaker browser,
  // because published voice metadata is sometimes wrong), else derived from the trailing "(F)"/
  // "(M)" the auto-generated labels carry (covers benches written before the field existed).
  // "" = unknown: such a star is pickable by hand but never auto-cast.
  function _starGender(g, label) {
    if (g === "M" || g === "F") return g;
    var m = /\((F|M)\)\s*$/.exec(String(label || ""));
    return m ? m[1] : "";
  }
  // #95.7: gender-matched auto-cast — an unassigned character speaks a bench voice of their own
  // gender instead of the narrator (the "grizzled sheriff reads as a young woman" fix). The pick
  // is a DETERMINISTIC name-hash over the gender-filtered bench: stable across turns and reloads
  // with no state write. Editing the bench may re-deal unassigned characters (documented — pin a
  // voice on the sheet to make it permanent); explicit assignments always win and never move.
  // NB/unknown gender or an empty matching pool returns null — the caller keeps today's narrator
  // fallback, because guessing is exactly the failure this feature removes.
  function autoCastVoiceId(char) {
    var g = char && char.gender;
    if (g !== "M" && g !== "F") return null;
    var pool = [], st = starsList(), i;
    for (i = 0; i < st.length; i++) { if (st[i].g === g) pool.push(st[i].id); }
    if (!pool.length) return null;
    var nm = String(char.name || ""), h = 0;
    for (i = 0; i < nm.length; i++) h = (h * 31 + nm.charCodeAt(i)) >>> 0;
    return pool[h % pool.length];
  }
  function _isStarred(id) {
    var st = starsList();
    for (var i = 0; i < st.length; i++) { if (st[i].id === id) return true; }
    return false;
  }
  // ONE renderer, TWO hosts (Voice Settings here + the character sheet's csVoiceControlHtml in
  // ui-sheets.js) — the bibleCardHTML precedent. Returns "" when nothing is starred: no optgroup,
  // no empty header. Values are plain voiceId strings, so every existing save path is unchanged.
  // Ids and labels come from a user-editable store, so they are escaped for a single-quoted
  // attribute (_escVal alone leaves ' alone, which would break out of value='…').
  function _escOpt(s) { return _escVal(s).replace(/'/g, "&#39;"); }
  function starOptionsHtml(cur) {
    var st = starsList(), i, html;
    if (!st.length) return "";
    html = "<optgroup label='&#9733; Cast voices'>";
    for (i = 0; i < st.length; i++) {
      html += "<option value='" + _escOpt(st[i].id) + "'" + (st[i].id === cur ? " selected" : "") + ">" + _escVal(st[i].label) + "</option>";
    }
    return html + "</optgroup>";
  }

  function _buildPiperVoiceOptions() {
    var cur = resolvePiperVoice(), html = starOptionsHtml(cur);
    // #95 (v1.462, Fable review entry 7): a composite pick that is NOT starred (star deleted, or an
    // id imported from another device) renders as its OWN selected option, full composite value.
    // Selecting only its base model — the pre-v1.462 behavior — meant an untouched Save silently
    // rewrote composite -> base (speaker discarded, persisted AND synced) under a "saved" toast.
    var comp = (!_isStarred(cur) && voiceSpeaker(cur) !== null) ? cur : null;
    if (comp) html += "<option value='" + _escOpt(comp) + "' selected>" + _escVal(_voiceLabelOf(comp)) + "</option>";
    var curBase = (comp || _isStarred(cur)) ? null : voiceBaseId(cur);
    for (var i = 0; i < PIPER_VOICES.length; i++) {
      var v = PIPER_VOICES[i];
      html += "<option value='" + v.id + "'" + (v.id === curBase ? " selected" : "") + ">" + _escVal(v.label) + "</option>";
    }
    return html;
  }

  function _piperVoiceBlurb(id) {
    var b = voiceBaseId(id);   // #95: the blurb describes the MODEL download, which a speaker shares
    for (var i = 0; i < PIPER_VOICES.length; i++) { if (PIPER_VOICES[i].id === b) return PIPER_VOICES[i].blurb; }
    return "";
  }

  // #9: audition a specific Piper voice — the shared mechanism behind the Voice Settings Test
  // button AND the character-sheet Test button. Reuses the normal queue/dispatch (stop() pre-empts
  // a wedged _playing latch; _drain runs the epoch guard) so an audition behaves exactly like real
  // narration. A falsy voiceId → the narrator voice (used when a character has no voice assigned).
  // #66 (user 2026-07-21): before a user-initiated download evicts a resident voice, name the voice
  // to be deleted AND who it's assigned to, and let them cancel. Residency is proxied by the LRU
  // keys (stamped on every ensure, deleted on evict) — sync, good enough for a heads-up; the actual
  // eviction still uses the real OPFS list. Narration-triggered downloads can't block a turn, so
  // this gates only the audition path (both Test buttons run through testVoice).
  function _voiceLabelOf(id) {
    var b = voiceBaseId(id), spk = voiceSpeaker(id);
    for (var i = 0; i < PIPER_VOICES.length; i++) {
      // #95: name a cast voice by its star label when it has one, else the model + speaker number —
      // never a bare composite id in a confirmation dialog the user has to reason about.
      if (PIPER_VOICES[i].id === b) return PIPER_VOICES[i].label + (spk === null ? "" : " · speaker " + spk);
    }
    return id;
  }
  // ⛨ #95 (the F11 class): every comparison here is BY BASE MODEL. A character cast on
  // "…-medium#204" depends on exactly the same file as one on "…-medium" — so the model is in use
  // and neither automatic eviction nor a release-on-reassign may delete it. Compared EXACTLY (as
  // this did before speaker ids existed), five characters spread across #204/#611/#88 would each
  // read as "unassigned" against the base id the LRU holds, and swapping any ONE of their voices
  // would silently delete the model all five speak through — mid-drive, recovered only by a silent
  // 60–130MB refetch inside a read.
  function _voiceAssignedTo(voiceId) {
    var who = [], want = voiceBaseId(voiceId);
    if (!want) return who;   // the narrator default owns no slot — and must never match every unassigned sheet
    // v1.439 (F10, brief F): the narrator check runs FIRST, before the worldState guard —
    // resolvePiperVoice() needs no world (device-default fallback), and the old order sat it
    // BELOW the early return, so on a pre-game page (Voice Settings lives on the API-key and
    // creation menus too) the narrator's voice counted as unassigned and automatic eviction
    // could take it. The protection this function exists for was defeatable by page choice.
    if (voiceBaseId(resolvePiperVoice()) === want) who.push("the narrator");
    if (typeof worldState === "undefined" || !worldState) return who;
    var c = worldState.character;
    if (c && c.voiceId && voiceBaseId(c.voiceId) === want) who.push((c.name || "the player") + " (you)");
    var ns = worldState.npcs || [], i;
    for (i = 0; i < ns.length; i++) { if (ns[i] && ns[i].charSheet && ns[i].charSheet.voiceId && voiceBaseId(ns[i].charSheet.voiceId) === want) who.push(ns[i].name); }
    return who;
  }
  // Promise<boolean> — true = proceed with the download, false = user cancelled. Only prompts when
  // downloading newVoiceId would push resident voices past the cap.
  function _confirmVoiceEviction(newVoiceId) {
    newVoiceId = voiceBaseId(newVoiceId);   // #95: residency is per MODEL — auditioning …#204 of a
                                            // model already on disk downloads nothing and must not prompt
    var resident = Object.keys(_piperLruLoad());
    if (!newVoiceId || resident.indexOf(newVoiceId) >= 0 || resident.length < PIPER_VOICE_CAP) return Promise.resolve(true);
    var lru = _piperLruLoad();
    var evictee = resident.filter(function(id) { return id !== newVoiceId; })
      .sort(function(a, b) { return (lru[a] || 0) - (lru[b] || 0); })[0];
    if (!evictee) return Promise.resolve(true);
    if (typeof modalShell !== "function") return Promise.resolve(true);   // no UI to ask with — don't block
    var assigned = _voiceAssignedTo(evictee);
    var assignLine = assigned.length
      ? "It is assigned to <b>" + assigned.map(function(n){return _escVal(n);}).join(", ") + "</b>."
      : "It is not assigned to any character.";
    return new Promise(function(resolve) {
      var cf = modalShell("voice-evict-confirm",
        "<div style='font-size:16px;color:var(--t0);margin-bottom:8px;font-weight:bold;'>Free a voice slot?</div>"
        + "<div style='font-size:13px;color:var(--t2);margin-bottom:24px;line-height:1.5;'>You have " + PIPER_VOICE_CAP + " voices downloaded (the maximum). Getting <b>" + _escVal(_voiceLabelOf(newVoiceId)) + "</b> will delete the least-recently-used one, <b>" + _escVal(_voiceLabelOf(evictee)) + "</b>. " + assignLine + " It re-downloads automatically the next time it's needed.</div>"
        + "<div style='display:flex;gap:10px;justify-content:center;'>"
        + "<button id='evict-ok' style='padding:10px 20px;font-size:13px;font-family:var(--font);background:var(--acc);color:var(--on-acc);border:none;border-radius:6px;cursor:pointer;font-weight:bold;'>Delete &amp; get it</button>"
        + "<button id='evict-cancel' style='padding:10px 20px;font-size:13px;font-family:var(--font);background:none;border:1px solid var(--brd2);color:var(--t2);border-radius:6px;cursor:pointer;'>Cancel</button>"
        + "</div>",
        { z: 600, maxWidth: 400, boxPad: "28px 24px", boxExtra: "text-align:center;", wireClose: false });
      document.getElementById("evict-ok").addEventListener("click", function() { cf.remove(); resolve(true); });
      document.getElementById("evict-cancel").addEventListener("click", function() { cf.remove(); resolve(false); });
    });
  }
  function testVoice(voiceId) {
    var v = voiceId || resolvePiperVoice();
    // #90 (v1.436): audition through the ladder. A server-tier page must not boot the local wasm
    // engine (60-115MB download + governor budget) just to test a voice — the audio is identical
    // Piper either way, and no local download happens, so the eviction question doesn't apply.
    // A mid-test server failure hands the line down the ladder with v preserved (_speakServer).
    if (_serverTtsOk()) {
      stop();
      _queue.push({ text: TTS_TEST_LINE, server: true, voiceId: v });
      _drain();
      return;
    }
    _confirmVoiceEviction(v).then(function(ok) {
      if (!ok) return;
      stop();
      _queue.push({ text: TTS_TEST_LINE, piper: true, voiceId: v });
      _drain();
    });
  }
  // #9 (user 2026-07-21): when a character's assigned voice CHANGES, free the old one's OPFS slot —
  // but ONLY if nothing else still uses it. `_voiceAssignedTo` scans every character sheet AND the
  // narrator, so a voice shared by another party member (or the narrator) is protected automatically;
  // this is what keeps a voice-swap from ever silently deleting the narrator's voice. Caller updates
  // char.voiceId FIRST, so the old id no longer counts itself. Resident-gate on the LRU keys avoids
  // spinning up the wasm engine for a voice that was never downloaded. Housekeeping only — non-fatal.
  function releaseVoiceIfUnused(voiceId) {
    if (!voiceId) return;                             // narrator default — owns no per-character slot
    // ⛨ #95: the caller hands us the character's OLD voiceId, which may be a composite. What can be
    // freed is the MODEL FILE, and only if nothing (any speaker of it, or the narrator) still uses
    // it — see _voiceAssignedTo. Comparing composites here is the F11-class data-loss bug.
    voiceId = voiceBaseId(voiceId);
    if (_voiceAssignedTo(voiceId).length) return;     // still used by a character or the narrator
    if (!_piperLruLoad()[voiceId]) return;            // not resident — nothing to free (no engine init)
    _piperInit().then(function() {
      // v1.439 (F11, brief F): _piperRemoveVoiceFiles, NOT the vendored mod.remove() — remove()
      // swallows every failure and resolves clean (the Chrome-only handle.remove(), the exact
      // v1.419 silent-no-op class that permanently disabled the cap), and this was the ONE
      // deletion site still calling it. removeEntry() throws honestly, so the catch below keeps
      // the LRU stamp on a real failure instead of minting a phantom.
      return _piperSerial(function() { return _piperRemoveVoiceFiles(voiceId); });
    }).then(function() {
      var lru = _piperLruLoad();
      delete lru[voiceId];
      try { store.set(PIPER_VOICE_LRU_K, JSON.stringify(lru)); } catch(e) {}
      delete _piperDownloaded[voiceId];
      console.info("[tts piper] released voice " + voiceId + " — no character or narrator uses it anymore");
      if (typeof _renderPiperSlots === "function") _renderPiperSlots();
    }).catch(function(e) {
      console.warn("[tts piper] release of unused voice " + voiceId + " failed (kept):", e && e.message);
    });
  }
  function showSettingsModal() {
    var inpStyle = "width:100%;padding:8px 10px;background:var(--bg3);border:1px solid var(--brd);border-radius:6px;color:var(--t0);font-size:13px;box-sizing:border-box;";
    var smInpStyle = "width:100%;padding:6px 8px;background:var(--bg2);border:1px solid var(--brd);border-radius:4px;color:var(--t0);font-size:12px;box-sizing:border-box;margin-bottom:6px;";
    // #9 rework: Piper is the only engine — no engine picker. The modal is just: speech rate,
    // audio diagnostics, the Piper voice panel, and the device fallback voice.
    /* #14: modalShell (global, ui-shell.js) — callable from this IIFE at run time */
    var modal = modalShell("tts-modal",
      "<div style='display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;'>"
      +   "<span style='font-size:16px;color:var(--t0);font-weight:bold;'>&#128266; Voice Settings</span>"
      +   "<button id='tts-modal-x' style='background:none;border:none;color:var(--t2);font-size:20px;cursor:pointer;'>&#215;</button>"
      + "</div>"
      // Rank 20 (todo_carplay.html): speech rate — applies to Native + Piper. Placed ABOVE the
      // voice block since it isn't engine-specific.
      + "<div style='margin-bottom:16px;'>"
      +   "<div style='display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;'>"
      +     "<label style='font-size:12px;color:var(--t2);'>Speech rate</label>"
      +     "<span id='tts-rate-val' style='font-size:11px;color:var(--t2);'>" + getRate().toFixed(2) + "&times;</span>"
      +   "</div>"
      +   "<input id='tts-rate-sel' type='range' min='0.8' max='1.3' step='0.05' value='" + getRate() + "' style='width:100%;accent-color:var(--acc);'/>"
      +   "<div style='font-size:11px;color:var(--t2);margin-top:2px;'>Applies to the Piper voice.</div>"
      + "</div>"
      // #9: engine picker REMOVED — Piper is the only engine (Native survives as the silent
      // fallback below). Keep only the phone-visible audio diagnostics.
      + "<div style='margin-bottom:14px;'>"
      +   "<div id='tts-audio-diag' style='font-size:11px;color:var(--t2);font-family:var(--font-mono,monospace);'></div>"
      +   "<div id='tts-server-line' style='font-size:11px;color:var(--t2);margin-top:4px;'></div>"   /* #90: server-tier status */
      + "</div>"
      // ── Piper panel ──
      + "<div id='tts-panel-piper' style='display:block;'>"
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
      +     "<div id='tts-piper-slots'></div>"   /* #66 slot UI — rendered async by _renderPiperSlots (OPFS read) */
      +     "<div style='font-size:11px;color:var(--t2);margin-top:6px;'>If Piper can't load (first download, or an unsupported device), narration falls back to the device voice below.</div>"
      +   "</div>"
      + "</div>"
      // ── Fallback (device native) voice — #9: always shown, no longer an engine choice; it is the
      //    SILENT fallback whenever Piper can't load. ──
      + "<div id='tts-panel-native' style='display:block;'>"
      +   "<div style='margin-bottom:20px;'>"
      +     "<label style='font-size:12px;color:var(--t2);display:block;margin-bottom:6px;'>Fallback voice <span style='color:var(--t2);'>(device — used only if Piper is unavailable)</span></label>"
      +     "<div style='display:flex;gap:6px;'>"
      +       "<select id='tts-nvoice-sel' style='" + inpStyle + "flex:1;'>" + _buildNativeVoiceOptions() + "</select>"
      +       "<button id='tts-nvoice-test' style='flex-shrink:0;padding:0 12px;background:none;border:1px solid var(--brd2);border-radius:6px;color:var(--t1);font-size:12px;cursor:pointer;white-space:nowrap;'>&#9654; Test</button>"
      +     "</div>"
      +     "<div style='font-size:11px;color:var(--t2);margin-top:4px;'>Worth setting for the rare case Piper can't run. Windows 11 has neural voices (Aria, Guy); on iOS, download Enhanced voices in Settings &#8250; Accessibility &#8250; Spoken Content &#8250; Voices.</div>"
      +   "</div>"
      + "</div>"
      + "<button id='tts-save-btn' style='width:100%;padding:10px;background:var(--acc);border:none;border-radius:6px;color:#000;font-family:var(--font);font-size:14px;font-weight:bold;cursor:pointer;'>Save</button>",
      { align: "flex-start", overlayExtra: "overflow-y:auto;", boxBg: "#181818", maxWidth: 480, boxExtra: "margin-top:60px;", closeId: "tts-modal-x", outside: true });

    _updatePiperErr();
    _updateServerLine();   // #90: server-tier status (off / active / degraded-with-reason)
    // B9 (v1.419): the "ORT NNNMB" half of the runtime line reads `_frameMem`, which is only
    // refreshed BETWEEN narration reads — so opening this panel after a prewarm, or any time before
    // a read has completed, showed no figure at all, and after one it could be stale. That figure is
    // the only way a phone can tell whether the disposable-realm fix is actually holding memory
    // down, so ask the live frame for a fresh reading on open and repaint when it lands. `mem` is
    // the deliberately engine-free poll (piper-host.html) — it reads the wasm probe and never boots
    // Piper, so opening Voice Settings can't trigger a 60-115MB model load. _frameRefreshMem
    // resolves null with no side effects when synthesis is on the in-page fallback (no frame to
    // ask) or the round trip fails, so the line simply keeps whatever it already showed. Async on
    // purpose: the modal is up long before the postMessage answers, and never waits on it.
    _frameRefreshMem().then(function (m) { if (m) _updatePiperErr(); });   // _updatePiperErr self-no-ops if the modal was closed meanwhile
    _piperRefreshDownloaded();   // best-effort — only does anything if the engine is already warm
    _renderPiperSlots();         // #66 slot UI — direct OPFS read, no engine init needed

    // v1.327 on-device audio diagnostics: the phone has no console, so the modal SHOWS the shared
    // AudioContext's state — "running" is the only state that produces sound on the Piper path;
    // "suspended"/"interrupted" here IS the silence diagnosis, live-updating on statechange.
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

    // #9: _setEnginePanels removed — no engine picker; only the Piper panel + the fallback voice.
    // Rank 20: live-write on drag — takes effect on the NEXT synth call (getRate() reads store live).
    var rateSel = document.getElementById("tts-rate-sel");
    if (rateSel) {
      rateSel.addEventListener("input", function() {
        store.set(RATE_K, this.value);
        var rv = document.getElementById("tts-rate-val");
        if (rv) rv.textContent = parseFloat(this.value).toFixed(2) + "×";
      });
    }
    // #9: engine-radio wiring removed (no radios). Piper is the engine; the fallback voice is below.

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
      _renderPiperSlots();   // #66: keep the resident radio/highlight in step with the dropdown
    });
    document.getElementById("tts-piper-test").addEventListener("click", function() {
      var s = document.getElementById("tts-piper-sel");
      testVoice(s ? s.value : resolvePiperVoice());
    });

    document.getElementById("tts-save-btn").addEventListener("click", function() {
      var nvs = document.getElementById("tts-nvoice-sel"); if (nvs) { if (nvs.value) store.set(NVOICE_K, nvs.value); else store.del(NVOICE_K); }   // the fallback voice
      var psel = document.getElementById("tts-piper-sel");
      if (psel && psel.value) savePiperVoice(psel.value);   // proseAuthor two-tier save — see savePiperVoice() above
      if (isOn()) prewarmPiper(resolvePiperVoice());   // §5 Q4 — pre-warm the chosen Piper voice
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
    earcon:            earcon,       // kind: "ack" | "ready" | "fail" — oscillator blips, off the narration scheduler
    replayLast:        replayLast,   // replays the last NARRATION (not Test/other speak() calls), queue-preserving
    showSettingsModal: showSettingsModal,
    testVoice:         testVoice,   // #9: audition a voiceId (or the narrator voice) — used by the character-sheet Test button
    releaseVoiceIfUnused: releaseVoiceIfUnused,   // #9: free a voice's OPFS slot on reassignment when nothing (incl. narrator) still uses it
    primeAudioSession:     primeAudioSession,
    // v1.421 (B10): repair an iOS-interrupted context. Call from a USER GESTURE — the send tap is
    // the valuable one, because it lands seconds before narration and so fixes the context BEFORE
    // the read that would otherwise lose its first line to the native voice.
    recoverAudio:          recoverAudio,
    stopAudioSessionPrimer: stopAudioSessionPrimer,
    // Piper (TODO #41 Phase 3) — fire-and-forget pre-warm. Wired to TTS-enable (toggle()) and to
    // the settings-modal Save handler, both gated on Piper being the selected engine, so the ~9s
    // one-time WASM compile happens off the critical path of the user's first real narration.
    prewarmPiper:      prewarmPiper,
    // #90: server-tier health probe — wakes the auto-stopped Fly machine off the critical path.
    prewarmServer:     prewarmServer,
    // B9 (v1.418): tear down the synthesis realm and build a fresh one. User-facing mitigation
    // AND the deterministic proof that realm teardown returns the wasm memory.
    respawnEngine:     respawnEngine,
    // (v1.455: setBypassPlayback/isBypassPlayback — the B9 playback-bypass EXPERIMENT — removed
    // with #97. It answered its question and #90's server tier closed B9 architecturally.)
    // Engine selection (TODO #41 Phase 4) — public because other surfaces (File menu labels, Car
    // Mode) may reasonably want to know/resolve the active choice, not just the settings modal.
    getEngine:         getEngine,
    diag:              diag,   // #16c: compact audio/piper state for crash-report diagnostics
    resolvePiperVoice: resolvePiperVoice,
    // #9 rework: the curated voice catalog + per-character voice resolution. voices() feeds any
    // picker UI (character sheet, Voice Settings). characterVoiceId(char) is the per-speaker
    // resolver — a character's own voiceId (stored on the SHEET, so it rides .char exports /
    // library imports like portrait/#63) when set AND still in the curated set, else it falls
    // back to the NARRATOR voice (resolvePiperVoice). An unassigned character simply speaks in
    // the narrator voice — today's single-voice behavior, preserved until voices are assigned.
    voices:            function() { return PIPER_VOICES.slice(); },
    // #95: a starred cast voice is named by its user label; an unstarred composite falls back to
    // "<model> · speaker N" (see _voiceLabelOf) rather than a raw id in a toast.
    voiceLabel:        function(id) {
      if (!id) return "";
      var st = starsList(), i;
      for (i = 0; i < st.length; i++) { if (st[i].id === id) return st[i].label; }
      return _voiceLabelOf(id);
    },
    voiceKnown:        _piperVoiceKnown,
    voiceDefault:      function() { return PIPER_VOICE_DEFAULT; },
    // #95 (S1) — THE composite-id helpers. Everything that touches OPFS/LRU/download/eviction
    // normalizes through voiceBaseId; nothing else may split on "#".
    voiceBaseId:       voiceBaseId,
    voiceSpeaker:      voiceSpeaker,
    // #95 (S5) — the starred cast: the store reader and the shared optgroup renderer, used by BOTH
    // voice pickers (Voice Settings here, csVoiceControlHtml in ui-sheets.js).
    starsList:         starsList,
    starOptionsHtml:   starOptionsHtml,
    characterVoiceId:  function(char) {
      var v = char && char.voiceId;
      if (v && _piperVoiceKnown(v)) return v;
      // #95.7: no assigned voice → gender-matched auto-cast from the star bench, else narrator
      return autoCastVoiceId(char) || resolvePiperVoice();
    },
    // #95.7: the gender-matched fallback characterVoiceId uses; exported for the engine tests
    // (the #96 [SAY:] map resolves through characterVoiceId at speak time, so this is where an
    // unassigned speaker's voice comes from)
    autoCastVoiceId:   autoCastVoiceId,
    // Internal — exported ONLY for the headless engine tests (dev/engine-tests.js) and for the
    // later Piper provider phases (TODO #41) to reuse. Not a supported external call surface.
    _textPrep: { normalizeForTTS: normalizeForTTS, splitSentences: splitSentences, packLongUnit: packLongUnit, unitGap: unitGap,
                 pauses: function() { return { comma: PAUSE_COMMA, clause: PAUSE_COMMA_CLAUSE, fullstop: PAUSE_FULLSTOP, paragraph: PAUSE_PARAGRAPH }; } },
    // #90: server-tier internals, exported ONLY for the headless engine tests (same contract as
    // _textPrep). backdate() exists because the retry-window test can't wait a real 60s.
    _serverTest: {
      ok:       function() { return _serverTtsOk(); },
      degrade:  function(reason) { _serverTtsDegrade(reason); },
      backdate: function(ms) { _serverTtsErrAt -= ms; },
      reset:    function() { _serverTtsErr = ""; _serverTtsErrAt = 0; _serverTtsToasted = false; },
      provider: function() { return TTS_PROVIDERS.server; }
    },
    // #95: internals exported ONLY for the headless engine tests (same contract as _textPrep).
    // The two *Src() readers exist because the strip/pass-through rules live INSIDE async read
    // loops that need OPFS, a wasm engine and a live AudioContext — none of which the DOM-free
    // harness can provide — so the property is asserted against the function source instead.
    _speakerTest: {
      assignedTo:      function(id) { return _voiceAssignedTo(id); },
      localVoice:      function(id) { return _localVoiceId(id); },
      piperOptions:    function() { return _buildPiperVoiceOptions(); },
      piperOptionsSrc: function() { return String(_buildPiperVoiceOptions); },
      speakPiperSrc:   function() { return String(_speakPiper); },
      speakServerSrc:  function() { return String(_speakServer); }
    }
  };

})();
