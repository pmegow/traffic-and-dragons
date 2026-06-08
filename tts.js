// tts.js — Cartesia streaming TTS (SSE + Web Audio API)
// Depends on: store (state.js), showToast (ui.js)

var TTS = (function() {

  var KEY_K   = "tnd_cartesia_key_v1";
  var ON_K    = "tnd_tts_on_v1";
  var VOICE_K = "tnd_tts_voice_gm_v1";

  var CARTESIA_SSE_URL  = "https://api.cartesia.ai/tts/sse";
  var CARTESIA_VERSION  = "2026-03-01";
  var CARTESIA_MODEL    = "sonic-2";
  var SAMPLE_RATE       = 22050;

  var _queue      = [];
  var _playing    = false;
  var _paused     = false;
  var _audioCtx   = null;   // single persistent context, created on first toggle-on
  var _nextStart  = 0;      // scheduled playback cursor (AudioContext time)
  var _sources    = [];     // scheduled AudioBufferSourceNodes
  var _abortCtrl  = null;   // AbortController for live fetch

  // ── State ──────────────────────────────────────────────────────────────────

  function isOn()     { return store.get(ON_K) === "1"; }
  function getKey()   { return store.get(KEY_K)   || ""; }
  function getVoice() { return store.get(VOICE_K) || ""; }

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

  function loadSettings() { _syncBtn(); }

  function _syncBtn() {
    var on = isOn();
    var el = document.getElementById("tts-btn");
    if (el) { el.textContent = on ? "🔊" : "🔇"; el.style.opacity = on ? "1" : "0.5"; }
  }

  // ── Public speak entry points ───────────────────────────────────────────────

  function speak(text, voiceId) {
    if (!text || !text.trim()) return;
    voiceId = voiceId || getVoice();
    if (!voiceId || !getKey()) return;
    _queue.push({ text: text.trim(), voiceId: voiceId });
    if (!_playing) _drain();
  }

  function speakResponse(cleanText) {
    if (!isOn()) return;
    var m = cleanText.match(/([\s\S]*?)\s*\*You could([\s\S]*?)\*\s*$/);
    if (m) {
      if (m[1].trim()) speak(m[1].trim());
      speak("You could" + m[2]);
    } else {
      speak(cleanText.trim());
    }
  }

  // ── Queue management ────────────────────────────────────────────────────────

  function _drain() {
    if (!_queue.length) {
      _playing = false;
      _paused  = false;
      _showBar(false);
      return;
    }
    _playing = true;
    _paused  = false;
    _showBar(true);
    _updatePauseBtn(false);
    var item = _queue.shift();
    _stream(item.text, item.voiceId);
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
      if (e.name !== "AbortError") console.warn("[tts]", e.message);
      _drain();
    });
  }

  // ── Controls ────────────────────────────────────────────────────────────────

  function pause() {
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
    if (_abortCtrl) { try { _abortCtrl.abort(); } catch(e) {} _abortCtrl = null; }
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

  function showSettingsModal() {
    var ex = document.getElementById("tts-modal"); if (ex) ex.remove();
    var modal = document.createElement("div");
    modal.id = "tts-modal";
    modal.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,.88);z-index:300;display:flex;align-items:flex-start;justify-content:center;padding:20px;overflow-y:auto;";
    modal.innerHTML = "<div style='background:#181818;border:1px solid var(--acc);border-radius:12px;padding:24px;max-width:480px;width:100%;margin-top:60px;'>"
      + "<div style='display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;'>"
      +   "<span style='font-size:16px;color:var(--t0);font-weight:bold;'>🔊 Voice Settings</span>"
      +   "<button id='tts-modal-x' style='background:none;border:none;color:var(--t2);font-size:20px;cursor:pointer;'>&#215;</button>"
      + "</div>"
      + "<div style='margin-bottom:14px;'>"
      +   "<label style='font-size:12px;color:var(--t2);display:block;margin-bottom:6px;'>Cartesia API Key</label>"
      +   "<input id='tts-key-inp' type='password' placeholder='sk_car_...' value='" + _escVal(getKey()) + "'"
      +     " style='width:100%;padding:8px 10px;background:var(--bg3);border:1px solid var(--brd);border-radius:6px;color:var(--t0);font-size:13px;box-sizing:border-box;'/>"
      + "</div>"
      + "<div style='margin-bottom:20px;'>"
      +   "<label style='font-size:12px;color:var(--t2);display:block;margin-bottom:6px;'>GM Voice ID <span style='opacity:.6;'>(from cartesia.ai/voices)</span></label>"
      +   "<input id='tts-voice-inp' type='text' placeholder='voice-uuid' value='" + _escVal(getVoice()) + "'"
      +     " style='width:100%;padding:8px 10px;background:var(--bg3);border:1px solid var(--brd);border-radius:6px;color:var(--t0);font-size:13px;box-sizing:border-box;'/>"
      + "</div>"
      + "<button id='tts-save-btn' style='width:100%;padding:10px;background:var(--acc);border:none;border-radius:6px;color:#000;font-family:Georgia,serif;font-size:14px;font-weight:bold;cursor:pointer;'>Save</button>"
      + "</div>";
    document.body.appendChild(modal);
    document.getElementById("tts-modal-x").addEventListener("click", function() { modal.remove(); });
    modal.addEventListener("click", function(e) { if (e.target === modal) modal.remove(); });
    document.getElementById("tts-save-btn").addEventListener("click", function() {
      var key   = document.getElementById("tts-key-inp").value.trim();
      var voice = document.getElementById("tts-voice-inp").value.trim();
      if (key)   store.set(KEY_K,   key);   else store.del(KEY_K);
      if (voice) store.set(VOICE_K, voice); else store.del(VOICE_K);
      modal.remove();
      if (typeof showToast === "function") showToast("Voice settings saved.");
    });
  }

  function _escVal(s) { return (s || "").replace(/"/g, "&quot;"); }

  // ── Public API ──────────────────────────────────────────────────────────────

  return {
    isOn:              isOn,
    toggle:            toggle,
    loadSettings:      loadSettings,
    speak:             speak,
    speakResponse:     speakResponse,
    pause:             pause,
    skip:              skip,
    stop:              stop,
    showSettingsModal: showSettingsModal
  };

})();
