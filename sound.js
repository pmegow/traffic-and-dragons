// sound.js — TODO #7: a small UI sound library. Short, pleasant, WebAudio-SYNTHESIZED earcons
// for game events (level up, a defining moment, combat starting, etc). No audio files, no
// dependencies, no network — every note is a plain oscillator+gain pair scheduled on ONE lazy
// singleton AudioContext (monotonic-resources rule: created once on first play, reused forever;
// each note's own nodes are disconnected onended so nothing accumulates across plays/sessions).
//
// House style mirrors TTS.earcon (tts.js ~1350-1380): try/catch everywhere, console.debug for a
// benign/expected skip (disabled pref, no AudioContext, ctx not running), console.warn only for
// a genuine caller mistake (unknown sound id) — never throws.
//
// Node-safe: this file is eval'd by the headless test runner (dev/run-tests.js /
// dev/load-engine.js) with no window/document/localStorage present. Every browser-only
// reference is guarded; SOUND_LIB and the enabled()/setEnabled() pref logic work with a plain
// in-memory fallback when localStorage is unavailable.
//
// SOUND_LIB — THE registry (id -> recipe). Adding a sound means adding an entry here, never
// per-sound code. Recipe shape: {label, notes:[{f,t,d,w,g}, ...]} where f=frequency (Hz),
// t=start offset from the play() call (seconds), d=note duration (seconds), w=waveform
// ("sine"/"triangle"/"square"), g=peak gain (0..1). Every motif is short (<=0.6s) and quiet
// (peak gain <=0.25) by design — soft video-game UI sounds, not alarms.
var SOUND_LIB = {
  chime: {
    label: "Cheerful two-note ascending notification",
    notes: [
      { f: 660,  t: 0,    d: 0.12, w: "sine", g: 0.18 },  // E5
      { f: 880,  t: 0.12, d: 0.16, w: "sine", g: 0.20 }   // A5 — the "cheers" resolve
    ]
  },
  quest: {
    label: "Three-note bright ascending 'opportunity' motif (distinct from chime/levelup)",
    notes: [
      { f: 523.25, t: 0,    d: 0.10, w: "triangle", g: 0.16 },  // C5
      { f: 659.25, t: 0.10, d: 0.10, w: "triangle", g: 0.18 },  // E5
      { f: 783.99, t: 0.20, d: 0.18, w: "triangle", g: 0.20 }   // G5, longer resolve
    ]
  },
  levelup: {
    label: "Three-note ascending arpeggio, slightly celebratory",
    notes: [
      { f: 523.25, t: 0,    d: 0.10, w: "triangle", g: 0.18 },  // C5
      { f: 659.25, t: 0.10, d: 0.10, w: "triangle", g: 0.20 },  // E5
      { f: 783.99, t: 0.20, d: 0.22, w: "triangle", g: 0.22 }   // G5, held resolve
    ]
  },
  moment: {
    label: "Soft bell-like tone (fundamental + one quiet harmonic overtone), for a defining moment",
    notes: [
      { f: 880,  t: 0, d: 0.50, w: "sine", g: 0.16 },  // fundamental (A5), long soft decay
      { f: 1760, t: 0, d: 0.25, w: "sine", g: 0.08 }   // octave overtone, quieter + shorter — gives the bell its shimmer
    ]
  },
  combat: {
    label: "Low, brief, dramatic two-note descent (small interval) for combat starting",
    notes: [
      { f: 110, t: 0,    d: 0.16, w: "triangle", g: 0.22 },  // A2
      { f: 98,  t: 0.16, d: 0.20, w: "triangle", g: 0.24 }   // G2 — a low, close-interval drop
    ]
  },
  coin: {
    label: "Tiny bright metallic blip",
    notes: [
      { f: 1200, t: 0,    d: 0.05, w: "square", g: 0.12 },
      { f: 1800, t: 0.05, d: 0.07, w: "square", g: 0.14 }
    ]
  },
  error: {
    label: "Muted low two-note descending",
    notes: [
      { f: 220,    t: 0,    d: 0.14, w: "sine", g: 0.15 },  // A3
      { f: 174.61, t: 0.14, d: 0.18, w: "sine", g: 0.14 }   // F3
    ]
  }
};

var Sound = (function() {

  var PREF_K = "tnd_sound_v1";
  var _memPref = null;   // in-memory fallback for the pref — only load-bearing when localStorage
                          // is unavailable (node/tests, or a throwing private-mode browser)

  function _lsGet() {
    try {
      if (typeof localStorage === "undefined" || localStorage === null) return null;
      return localStorage.getItem(PREF_K);
    } catch (e) { return null; }
  }
  function _lsSet(v) {
    try {
      if (typeof localStorage === "undefined" || localStorage === null) return false;
      localStorage.setItem(PREF_K, v);
      return true;
    } catch (e) { return false; }
  }

  // Default ON when the key is absent (fresh install / no localStorage) — "0" is the only OFF.
  function enabled() {
    var v = _lsGet();
    if (v === null) v = _memPref;
    return v !== "0";
  }
  function setEnabled(on) {
    var v = on ? "1" : "0";
    if (_lsSet(v)) _memPref = null;   // localStorage is authoritative now
    else _memPref = v;                // localStorage unavailable this session — remember in memory
  }

  // ── ONE lazy singleton AudioContext, created on first play(), reused forever ────────────────
  var _ctx = null;
  function _ensureCtx() {
    if (_ctx) return _ctx;
    try {
      var AC = (typeof window !== "undefined" && (window.AudioContext || window.webkitAudioContext))
        || (typeof AudioContext !== "undefined" ? AudioContext : null);
      if (!AC) return null;
      _ctx = new AC();
    } catch (e) { return null; }
    return _ctx;
  }

  // Schedule one note: its own oscillator+gain, short attack, decay to (near-)silence by the
  // note's end, cleaned up onended (disconnect both nodes — nothing accumulates across plays).
  function _playNote(ctx, t0, note) {
    var osc = ctx.createOscillator(), gain = ctx.createGain();
    osc.type = note.w || "sine";
    osc.frequency.value = note.f;
    var st = t0 + (note.t || 0);
    var end = st + note.d;
    var peak = note.g > 0 ? note.g : 0.0001;
    var attack = Math.min(0.005, note.d / 4);   // ~5ms attack, never more than a quarter of the note
    gain.gain.setValueAtTime(0.0001, st);
    gain.gain.exponentialRampToValueAtTime(peak, st + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, end);   // exponential decay to the note's end
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.onended = function() {
      try { osc.disconnect(); } catch (e) {}
      try { gain.disconnect(); } catch (e) {}
    };
    osc.start(st);
    osc.stop(end);
  }

  // play(id) — no-op (console.debug) when sound is disabled or the AudioContext is
  // unavailable/not running; console.warn (no throw) for an unknown id — matches the
  // no-silent-failures convention (a caller typo should be loud, a benign runtime skip shouldn't).
  function play(id, force) {
    var recipe = SOUND_LIB[id];
    if (!recipe) { console.warn("[sound] unknown sound id '" + id + "'"); return false; }
    if (!force && !enabled()) { console.debug("[sound] '" + id + "' skipped — disabled"); return false; }
    var ctx = _ensureCtx();
    if (!ctx) { console.debug("[sound] '" + id + "' skipped — no AudioContext"); return false; }
    try { if (ctx.state === "suspended" && typeof ctx.resume === "function") ctx.resume(); } catch (e) {}
    if (ctx.state !== "running") { console.debug("[sound] '" + id + "' skipped — ctx " + ctx.state); return false; }
    try {
      var t0 = ctx.currentTime, notes = recipe.notes, i;
      for (i = 0; i < notes.length; i++) _playNote(ctx, t0, notes[i]);
    } catch (e) { console.debug("[sound] '" + id + "' play failed:", e && e.message); return false; }
    return true;
  }
  // preview(id) — audition path for the Sound Library modal: plays even when UI sounds are OFF,
  // because clicking a ▶ IS an explicit request to hear it (a silent audition button would read
  // as broken). Returns true only when notes were actually scheduled, so the caller can show an
  // honest "couldn't play" state instead of a dead button.
  function preview(id) { return play(id, true); }

  return {
    play: play,
    preview: preview,
    enabled: enabled,
    setEnabled: setEnabled,
    SOUND_LIB: SOUND_LIB
  };
})();
