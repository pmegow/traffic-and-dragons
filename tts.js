// tts.js — Cartesia text-to-speech engine
// Depends on: store (state.js), showToast (ui.js)

var TTS = (function() {

  var KEY_K   = "tnd_cartesia_key_v1";
  var ON_K    = "tnd_tts_on_v1";
  var VOICE_K = "tnd_tts_voice_gm_v1";

  var CARTESIA_URL     = "https://api.cartesia.ai/tts/bytes";
  var CARTESIA_VERSION = "2026-03-01";
  var CARTESIA_MODEL   = "sonic-2";

  var _audio  = null;
  var _queue  = [];
  var _playing = false;
  var _paused  = false;

  // ── State ──────────────────────────────────────────────────────────────────

  function isOn()      { return store.get(ON_K) === "1"; }
  function getKey()    { return store.get(KEY_K)   || ""; }
  function getVoice()  { return store.get(VOICE_K) || ""; }

  // ── Toggle ─────────────────────────────────────────────────────────────────

  function toggle() {
    var on = !isOn();
    store.set(ON_K, on ? "1" : "");
    if (!on) stop();
    _syncBtn();
    if (typeof showToast === "function") showToast(on ? "🔊 Voice on" : "🔇 Voice off");
  }

  function loadSettings() { _syncBtn(); }

  function _syncBtn() {
    var on = isOn();
    ["tts-btn"].forEach(function(id) {
      var el = document.getElementById(id);
      if (el) { el.textContent = on ? "🔊" : "🔇"; el.style.opacity = on ? "1" : "0.5"; }
    });
  }

  // ── Speak ──────────────────────────────────────────────────────────────────

  function speak(text, voiceId) {
    if (!text || !text.trim()) return;
    voiceId = voiceId || getVoice();
    if (!voiceId || !getKey()) return;
    _queue.push({ text: text.trim(), voiceId: voiceId });
    if (!_playing) _drain();
  }

  // Called after every GM response. Splits narration from suggested actions
  // so the options are read after the main prose.
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

  // ── Queue ──────────────────────────────────────────────────────────────────

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
    _fetch(item.text, item.voiceId);
  }

  function _fetch(text, voiceId) {
    var key = getKey();
    if (!key) { _drain(); return; }
    fetch(CARTESIA_URL, {
      method: "POST",
      headers: {
        "X-API-Key":          key,
        "Cartesia-Version":   CARTESIA_VERSION,
        "Content-Type":       "application/json"
      },
      body: JSON.stringify({
        model_id:      CARTESIA_MODEL,
        transcript:    text,
        voice:         { mode: "id", id: voiceId },
        output_format: { container: "mp3", encoding: "mp3", sample_rate: 44100 }
      })
    })
    .then(function(r) {
      if (!r.ok) throw new Error("Cartesia " + r.status);
      return r.blob();
    })
    .then(function(blob) {
      var url = URL.createObjectURL(blob);
      _audio = new Audio(url);
      _audio.onended = function() { URL.revokeObjectURL(url); _audio = null; _drain(); };
      _audio.onerror = function() { URL.revokeObjectURL(url); _audio = null; _drain(); };
      _audio.play().catch(function() { _drain(); });
    })
    .catch(function(e) {
      console.warn("[tts]", e.message);
      _drain();
    });
  }

  // ── Controls ───────────────────────────────────────────────────────────────

  function pause() {
    if (!_audio) return;
    if (_audio.paused) { _audio.play(); _paused = false; }
    else               { _audio.pause(); _paused = true; }
    _updatePauseBtn(_paused);
  }

  function skip() {
    if (_audio) { _audio.pause(); _audio.onended = null; _audio = null; }
    _drain();
  }

  function stop() {
    if (_audio) { _audio.pause(); _audio.onended = null; _audio = null; }
    _queue   = [];
    _playing = false;
    _paused  = false;
    _showBar(false);
  }

  // ── UI helpers ─────────────────────────────────────────────────────────────

  function _showBar(show) {
    var bar = document.getElementById("tts-bar");
    if (bar) bar.style.display = show ? "flex" : "none";
  }

  function _updatePauseBtn(paused) {
    var btn = document.getElementById("tts-pause-btn");
    if (btn) btn.textContent = paused ? "▶" : "⏸";
  }

  // ── Settings modal ─────────────────────────────────────────────────────────

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
      +   "<input id='tts-key-inp' type='password' placeholder='sk_car_...' value='" + escVal(getKey()) + "'"
      +     " style='width:100%;padding:8px 10px;background:var(--bg3);border:1px solid var(--brd);border-radius:6px;color:var(--t0);font-size:13px;box-sizing:border-box;'/>"
      + "</div>"
      + "<div style='margin-bottom:20px;'>"
      +   "<label style='font-size:12px;color:var(--t2);display:block;margin-bottom:6px;'>GM Voice ID <span style='opacity:.6;'>(from cartesia.ai/voices)</span></label>"
      +   "<input id='tts-voice-inp' type='text' placeholder='voice-uuid' value='" + escVal(getVoice()) + "'"
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

  function escVal(s) { return (s||"").replace(/"/g, "&quot;"); }

  // ── Public API ─────────────────────────────────────────────────────────────

  return {
    isOn:             isOn,
    toggle:           toggle,
    loadSettings:     loadSettings,
    speak:            speak,
    speakResponse:    speakResponse,
    pause:            pause,
    skip:             skip,
    stop:             stop,
    showSettingsModal: showSettingsModal
  };

})();
