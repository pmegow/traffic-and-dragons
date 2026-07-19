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
// ── v2 VOICING (2026-07-18) — why v1 read as 8-bit, and what replaced it ─────────────────────
// User verdict on v1: "a little bit 8bit sounding and not really the feel we're going for."
// That was structural, not a tuning problem. Four things make a tone read as chiptune:
//   ① ONE bare oscillator per note — that is literally how NES/SID synths work. Physical objects
//      ring with many partials at once, so a lone sine/triangle can only ever sound synthetic.
//   ② square waves (v1 coin) — the single most chiptune-coded waveform there is.
//   ③ quantized rising arpeggios (C-E-G blips) — that IS the Mario power-up/coin idiom.
//   ④ bone-dry, fast-attack, short-decay tones — no room, no strike transient, no air.
// v2 fixes all four with real synthesis primitives (still zero files, zero deps):
//   • "bell" notes expand into INHARMONIC partial stacks at measured bell ratios — inharmonicity
//     is exactly what the ear reads as struck bronze rather than a beep;
//   • "noise" notes give the physical strike/air transient (band-passed white noise);
//   • a shared synthesized-IR convolution REVERB puts everything in a stone room;
//   • slower attacks, longer tails, lower register, and struck/tolled gestures instead of
//     ascending blips.
// Tuning knobs live in the DATA below; the physics lives once in the engine. Dark fantasy target:
// bronze, stone, leather, distance — never plastic, never arcade.
var SOUND_LIB = {
  chime: {
    label: "Small bronze bell, softly struck — warm, with a room tail",
    wet: 0.34,
    notes: [
      { type: "noise", t: 0, d: 0.035, g: 0.05, bp: { f: 2600, q: 1.1 } },   // mallet contact
      { type: "bell", f: 587.33, t: 0.004, d: 0.85, g: 0.15 }                // D5 bronze, long decay
    ]
  },
  quest: {
    label: "Two bells a fifth apart, beckoning — an opening, not a fanfare",
    wet: 0.40,
    notes: [
      { type: "noise", t: 0, d: 0.03, g: 0.04, bp: { f: 2200, q: 1.1 } },
      { type: "bell", f: 392.00, t: 0.004, d: 0.80, g: 0.14 },               // G4
      { type: "bell", f: 587.33, t: 0.19,  d: 0.78, g: 0.12 }                // D5 — a fifth above, overlapping
    ]
  },
  levelup: {
    label: "Rising bell triad, dignified — earned, not celebratory",
    wet: 0.45,
    notes: [
      { type: "bell", f: 293.66, t: 0,    d: 0.85, g: 0.13 },                // D4
      { type: "bell", f: 440.00, t: 0.16, d: 0.85, g: 0.12 },                // A4
      { type: "bell", f: 587.33, t: 0.32, d: 0.90, g: 0.13 }                 // D5 — octave resolve, all three ringing together
    ]
  },
  moment: {
    label: "Deep bell toll, long tail — the weight of a defining moment",
    wet: 0.55,
    notes: [
      { type: "noise", t: 0, d: 0.05, g: 0.045, bp: { f: 1400, q: 0.9 } },   // heavy clapper
      { type: "bell", f: 174.61, t: 0.006, d: 0.95, g: 0.16 }                // F3 — low, slow, resonant
    ]
  },
  combat: {
    label: "Struck iron and a low drum — a threat, not a jingle",
    wet: 0.30,
    notes: [
      { type: "noise", t: 0,    d: 0.09, g: 0.07, bp: { f: 900, q: 0.7 } },  // impact / scrape
      { f: 61.74, t: 0, d: 0.42, w: "sine", g: 0.24, atk: 0.006, lp: 220 },  // B1 drum body
      { type: "bell", f: 138.59, t: 0.01, d: 0.55, g: 0.10, bright: 0.55 }   // C#3 dull iron, damped highs
    ]
  },
  coin: {
    label: "Soft coin clink — struck metal, close and small",
    wet: 0.22,
    notes: [
      { type: "noise", t: 0, d: 0.02, g: 0.05, bp: { f: 4200, q: 1.4 } },    // the contact tick
      { type: "bell", f: 1046.50, t: 0.003, d: 0.34, g: 0.10, bright: 1.25 } // C6 small metal, quick decay
    ]
  },
  error: {
    label: "Dull low thud — a door closing, not a buzzer",
    wet: 0.26,
    notes: [
      { type: "noise", t: 0, d: 0.07, g: 0.05, bp: { f: 300, q: 0.6 } },
      { f: 87.31, t: 0, d: 0.38, w: "sine", g: 0.20, atk: 0.012, lp: 300 },  // F2 body
      { f: 130.81, t: 0, d: 0.22, w: "triangle", g: 0.07, atk: 0.012, lp: 400 }
    ]
  },

  // ── CLICK PALETTE (2026-07-18) ───────────────────────────────────────────────────────────
  // User call after v2: the musical-motif direction isn't working — "give me 10 different click
  // sounds." So these are deliberately NOT music: no melody, no interval, nothing to recognise as
  // a tune. Each is a single short impact differentiated by MATERIAL, which is the axis you can
  // actually judge by ear ("that one's wood, that one's glass") rather than by melody.
  // Construction: a band-passed noise transient carries the material (its centre frequency and Q
  // ARE the material — tight+high reads as glass, broad+low reads as cloth), optionally over a
  // brief pitched body for objects that ring. All ≤0.15s, low gain, and only a touch of reverb —
  // a click drowned in room tail stops reading as a click.
  click_wood:     { group: "click", label: "Wood — a knuckle on a tavern table", wet: 0.10,
    notes: [ { type: "noise", t: 0, d: 0.018, g: 0.10, bp: { f: 1500, q: 1.5 } },
             { f: 190, t: 0, d: 0.05, w: "sine", g: 0.11, atk: 0.002, lp: 900 } ] },
  click_stone:    { group: "click", label: "Stone — a pebble set down on slate", wet: 0.14,
    notes: [ { type: "noise", t: 0, d: 0.022, g: 0.11, bp: { f: 700, q: 0.9 } },
             { f: 124, t: 0, d: 0.045, w: "sine", g: 0.09, atk: 0.002, lp: 420 } ] },
  click_metal:    { group: "click", label: "Metal — a fingernail on a blade", wet: 0.16,
    notes: [ { type: "noise", t: 0, d: 0.012, g: 0.07, bp: { f: 5500, q: 2.0 } },
             { type: "bell", f: 2400, t: 0.002, d: 0.10, g: 0.05, bright: 1.3 } ] },
  click_leather:  { group: "click", label: "Leather — a glove flexing, no ring at all", wet: 0.08,
    notes: [ { type: "noise", t: 0, d: 0.038, g: 0.10, bp: { f: 900, q: 0.7 } } ] },
  click_glass:    { group: "click", label: "Glass — a vial tapped once, crisp", wet: 0.18,
    notes: [ { type: "noise", t: 0, d: 0.008, g: 0.05, bp: { f: 8000, q: 2.5 } },
             { f: 3100, t: 0.001, d: 0.06, w: "sine", g: 0.05, atk: 0.001 } ] },
  click_bone:     { group: "click", label: "Bone — dry, hollow, a die on a board", wet: 0.12,
    notes: [ { type: "noise", t: 0, d: 0.015, g: 0.09, bp: { f: 2600, q: 1.8 } },
             { f: 780, t: 0, d: 0.045, w: "sine", g: 0.07, atk: 0.001, lp: 2000 } ] },
  click_parchment:{ group: "click", label: "Parchment — a page turned, purely papery", wet: 0.09,
    notes: [ { type: "noise", t: 0, d: 0.032, g: 0.07, bp: { f: 3800, q: 0.6 } } ] },
  click_ceramic:  { group: "click", label: "Ceramic — a cup on a saucer, small ping", wet: 0.16,
    notes: [ { type: "noise", t: 0, d: 0.010, g: 0.06, bp: { f: 3200, q: 2.2 } },
             { type: "bell", f: 1500, t: 0.002, d: 0.13, g: 0.06 } ] },
  click_drip:     { group: "click", label: "Water — a single drop in a cistern", wet: 0.30,
    notes: [ { f: 1500, t: 0, d: 0.018, w: "sine", g: 0.10, atk: 0.001 },
             { f: 700, t: 0.014, d: 0.055, w: "sine", g: 0.09, atk: 0.002, lp: 1600 } ] },
  click_cloth:    { group: "click", label: "Cloth — muffled, the quietest of the ten", wet: 0.07,
    notes: [ { type: "noise", t: 0, d: 0.045, g: 0.09, bp: { f: 380, q: 0.5 } } ] }
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

  // ── v2 primitives ────────────────────────────────────────────────────────────────────────
  // Measured bell partial ratios (hum · prime · tierce · quint · nominal · two upper inharmonics).
  // The NON-integer ratios are the whole point: integer harmonics read as a musical beep, these
  // read as struck bronze. amp falls and decay SHORTENS as you go up — higher partials die first
  // on a real bell, and skipping that is what makes synthetic bells sound like organ tones.
  var BELL_PARTIALS = [
    { r: 0.50, a: 0.30, dk: 1.00 },
    { r: 1.00, a: 1.00, dk: 0.90 },
    { r: 1.19, a: 0.55, dk: 0.62 },
    { r: 1.56, a: 0.32, dk: 0.45 },
    { r: 2.00, a: 0.40, dk: 0.38 },
    { r: 2.51, a: 0.18, dk: 0.24 },
    { r: 3.01, a: 0.12, dk: 0.16 }
  ];
  var _noiseBuf = null;   // one 2s white-noise buffer, sliced by every noise note (singleton)
  function _noise(ctx) {
    if (_noiseBuf) return _noiseBuf;
    var len = Math.floor(ctx.sampleRate * 2), buf = ctx.createBuffer(1, len, ctx.sampleRate);
    var d = buf.getChannelData(0), i;
    for (i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    _noiseBuf = buf;
    return buf;
  }
  // Shared convolution reverb — a small stone room, from a SYNTHESIZED impulse response (noise
  // under an exponential decay), so it costs no files and no network. Built once, wired straight
  // to destination; per-play sends feed it. This is what removes the dry, close, arcade quality.
  var _verb = null;
  var _lastAt = 0;   // timestamp of the last successful play — the playIfQuiet suppression window
  function _reverb(ctx) {
    if (_verb) return _verb;
    try {
      var secs = 1.6, len = Math.floor(ctx.sampleRate * secs);
      var ir = ctx.createBuffer(2, len, ctx.sampleRate), ch, i;
      for (ch = 0; ch < 2; ch++) {
        var d = ir.getChannelData(ch);
        for (i = 0; i < len; i++) {
          var x = i / len;
          d[i] = (Math.random() * 2 - 1) * Math.pow(1 - x, 2.6);   // exponential-ish tail
        }
      }
      var cv = ctx.createConvolver();
      cv.buffer = ir;
      cv.connect(ctx.destination);
      _verb = cv;
    } catch (e) { _verb = null; }
    return _verb;
  }
  // One oscillator voice with optional attack shaping + lowpass (taming brightness is half of
  // sounding acoustic rather than electronic). Connects to the caller's bus, not to destination.
  function _voice(ctx, bus, st, dur, freq, wave, peak, atkMs, lpHz) {
    var osc = ctx.createOscillator(), gain = ctx.createGain(), node = gain;
    osc.type = wave || "sine";
    osc.frequency.value = freq;
    var end = st + dur;
    var attack = Math.min(atkMs || 0.005, dur / 3);
    var p = peak > 0 ? peak : 0.0001;
    gain.gain.setValueAtTime(0.0001, st);
    gain.gain.exponentialRampToValueAtTime(p, st + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, end);
    osc.connect(gain);
    if (lpHz) {
      var lp = ctx.createBiquadFilter();
      lp.type = "lowpass"; lp.frequency.value = lpHz;
      gain.connect(lp); node = lp;
    }
    node.connect(bus);
    osc.onended = function() {
      try { osc.disconnect(); } catch (e) {}
      try { gain.disconnect(); } catch (e) {}
      if (node !== gain) { try { node.disconnect(); } catch (e) {} }
    };
    osc.start(st);
    osc.stop(end);
  }
  // Band-passed noise burst — the physical transient (mallet contact, iron scrape, air).
  function _noiseBurst(ctx, bus, st, dur, peak, bp) {
    var src = ctx.createBufferSource(), gain = ctx.createGain();
    src.buffer = _noise(ctx);
    src.loop = true;
    var filt = ctx.createBiquadFilter();
    filt.type = "bandpass";
    filt.frequency.value = (bp && bp.f) || 2000;
    filt.Q.value = (bp && bp.q) || 1;
    var end = st + dur;
    var p = peak > 0 ? peak : 0.0001;
    gain.gain.setValueAtTime(0.0001, st);
    gain.gain.exponentialRampToValueAtTime(p, st + Math.min(0.004, dur / 3));
    gain.gain.exponentialRampToValueAtTime(0.0001, end);
    src.connect(filt); filt.connect(gain); gain.connect(bus);
    src.onended = function() {
      try { src.disconnect(); } catch (e) {}
      try { filt.disconnect(); } catch (e) {}
      try { gain.disconnect(); } catch (e) {}
    };
    src.start(st);
    src.stop(end);
  }
  // Schedule one note onto the play's bus. Three shapes, dispatched by `type` — adding a shape
  // means adding a branch here and entries in the table, nothing else changes.
  function _playNote(ctx, bus, t0, note) {
    var st = t0 + (note.t || 0);
    if (note.type === "noise") { _noiseBurst(ctx, bus, st, note.d, note.g, note.bp); return; }
    if (note.type === "bell") {
      // Expand into the inharmonic stack. `bright` scales how much the upper partials survive:
      // <1 damps them (dull iron), >1 keeps them (small bright metal).
      var br = typeof note.bright === "number" ? note.bright : 1, i;
      for (i = 0; i < BELL_PARTIALS.length; i++) {
        var p = BELL_PARTIALS[i];
        var amp = note.g * p.a * (p.r > 1.2 ? br : 1);
        if (amp < 0.002) continue;                       // inaudible partial — don't spend a node on it
        _voice(ctx, bus, st, note.d * p.dk, note.f * p.r, "sine", amp, 0.004, null);
      }
      return;
    }
    _voice(ctx, bus, st, note.d, note.f, note.w, note.g, note.atk, note.lp);
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
      // Per-play bus: dry straight out, plus a wet send into the shared reverb. Both bus nodes are
      // disconnected once the tail has run (monotonic-resources rule — nothing accumulates across
      // plays; the convolver and noise buffer are the only long-lived singletons).
      var t0 = ctx.currentTime, notes = recipe.notes, i;
      var bus = ctx.createGain(); bus.gain.value = 1;
      bus.connect(ctx.destination);
      var send = null, cv = _reverb(ctx);
      if (cv && recipe.wet > 0) {
        send = ctx.createGain(); send.gain.value = recipe.wet;
        bus.connect(send); send.connect(cv);
      }
      var last = 0;
      for (i = 0; i < notes.length; i++) {
        var n = notes[i], end = (n.t || 0) + n.d;
        if (end > last) last = end;
        _playNote(ctx, bus, t0, n);
      }
      setTimeout(function() {
        try { bus.disconnect(); } catch (e) {}
        if (send) { try { send.disconnect(); } catch (e) {} }
      }, (last + 2.2) * 1000);   // clear of the longest note AND the ~1.6s reverb tail
      _lastAt = (typeof performance !== "undefined" && performance.now) ? performance.now() : +new Date();
    } catch (e) { console.debug("[sound] '" + id + "' play failed:", e && e.message); return false; }
    return true;
  }
  // preview(id) — audition path for the Sound Library modal: plays even when UI sounds are OFF,
  // because clicking a ▶ IS an explicit request to hear it (a silent audition button would read
  // as broken). Returns true only when notes were actually scheduled, so the caller can show an
  // honest "couldn't play" state instead of a dead button.
  function preview(id) { return play(id, true); }
  // playIfQuiet(id, ms) — play only if nothing has played in the last `ms`. THE mechanism that
  // lets the general "poke" (bone, on every toast) coexist with the specific attention sound
  // (glass, on quests/level-ups/defining moments): those events toast AND play, so without this
  // you would hear both, every time. The alternative — threading a "silent" flag through dozens
  // of showToast call sites — would put audio concerns in every caller; this keeps the rule in
  // one place: a general poke never doubles up on a sound that just fired.
  // Ordering contract: the SPECIFIC sound must be played BEFORE its toast, so it claims the
  // window and the poke steps aside (the call sites are ordered that way deliberately).
  function playIfQuiet(id, ms) {
    var now = (typeof performance !== "undefined" && performance.now) ? performance.now() : +new Date();
    if (_lastAt && (now - _lastAt) < (ms || 300)) { console.debug("[sound] '" + id + "' skipped — a sound just played"); return false; }
    return play(id);
  }

  return {
    play: play,
    preview: preview,
    playIfQuiet: playIfQuiet,
    enabled: enabled,
    setEnabled: setEnabled,
    SOUND_LIB: SOUND_LIB
  };
})();
