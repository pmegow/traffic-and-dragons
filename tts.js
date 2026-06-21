// tts.js — Cartesia streaming TTS (SSE + Web Audio API)
// Depends on: store (state.js), showToast (ui.js)

var TTS = (function() {

  var KEY_K    = "tnd_cartesia_key_v1";
  var ON_K     = "tnd_tts_on_v1";
  var VOICE_K  = "tnd_tts_voice_gm_v1";
  var BANK_K   = "tnd_voice_bank_v1";
  var NATIVE_K = "tnd_tts_native_v1";   // use the browser's built-in speechSynthesis instead of Cartesia
  var NVOICE_K = "tnd_tts_nvoice_v1";   // chosen native (browser) voice, stored BY NAME (voice list differs per device)

  // ── Voice bank ─────────────────────────────────────────────────────────────

  function getBank() {
    try { var r = store.get(BANK_K); return r ? JSON.parse(r) : []; } catch(e) { return []; }
  }
  function setBank(arr) { store.set(BANK_K, JSON.stringify(arr)); }

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
  var _cartesiaError = "";  // last Cartesia failure reason; once set, speech falls back to native
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
  // Cartesia is usable only with a key and no recorded failure. Otherwise speech routes to native.
  function _cartesiaOk() { return !!getKey() && !_cartesiaError; }
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

  function loadSettings() { _syncBtn(); }

  function _syncBtn() {
    var on = isOn();
    var el = document.getElementById("tts-btn");
    if (el) { el.textContent = on ? "🔊" : "🔇"; el.style.opacity = on ? "1" : "0.5"; }
  }

  // ── Public speak entry points ───────────────────────────────────────────────

  function speak(text, voiceId) {
    if (!text || !text.trim()) return;
    if (_useNative()) { _queue.push({ text: text.trim(), native: true }); if (!_playing) _drain(); return; }
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
      _curNative = false;
      _showBar(false);
      return;
    }
    _playing = true;
    _paused  = false;
    _showBar(true);
    _updatePauseBtn(false);
    var item = _queue.shift();
    _curNative = !!item.native;
    if (item.native) _speakNative(item.text);
    else _stream(item.text, item.voiceId);
  }

  // ── Native (browser speechSynthesis) path ────────────────────────────────────
  // The browser's speechSynthesis swallows em/en-dashes (no pause). Ellipses get a real
  // beat, so convert dashes — and spaced ASCII "--" — to "..." for native narration only.
  // On-screen prose and Cartesia (which handles dashes) are untouched.
  function _dashToPause(text) {
    return (text || "").replace(/\s*--\s*/g, "... ").replace(/\s*[—–]\s*/g, "... ");
  }

  function _speakNative(text) {
    if (!window.speechSynthesis || typeof SpeechSynthesisUtterance === "undefined") { _drain(); return; }
    try {
      window.speechSynthesis.cancel();            // clear any stuck/previous utterance
      var u = new SpeechSynthesisUtterance(_dashToPause(text));
      u.rate = 1.0; u.pitch = 1.0;
      var nv = _findNativeVoice(getNativeVoice());   // saved voice if present on this device; else system default
      if (nv) u.voice = nv;
      _nativeUtter = u;
      u.onend   = function() { _nativeUtter = null; _drain(); };
      u.onerror = function() { _nativeUtter = null; _drain(); };
      window.speechSynthesis.speak(u);
    } catch (e) { _nativeUtter = null; _drain(); }
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
              _cartesiaError = evt.message || "Cartesia error"; _updateCartErr();
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
      _cartesiaError = e.message || "Cartesia unavailable";  // future lines auto-route to native
      _updateCartErr();
      _curNative = true;
      _speakNative(text);                                    // still speak THIS line via native
    });
  }

  // ── Controls ────────────────────────────────────────────────────────────────

  function pause() {
    if (_curNative && window.speechSynthesis) {
      if (window.speechSynthesis.paused) { window.speechSynthesis.resume(); _paused = false; }
      else { window.speechSynthesis.pause(); _paused = true; }
      _updatePauseBtn(_paused); return;
    }
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
    var vs = _voiceList(), cur = getNativeVoice(), html = "", i;
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
        + "<span style='font-size:10px;color:var(--t2);font-family:monospace;'>" + _escVal(bank[i].id.slice(0,8)) + "…</span>"
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
      +   "<span>Use native (browser) voice <span style='color:var(--t2);'>— no key needed, lower quality. Used automatically if Cartesia is unavailable.</span></span>"
      + "</label>"
      + "<div style='margin-bottom:20px;'>"
      +   "<label style='font-size:12px;color:var(--t2);display:block;margin-bottom:6px;'>Browser (native) voice</label>"
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
      +     "<input id='tts-add-id' type='text' placeholder='Cartesia voice UUID' style='" + smInpStyle + "font-family:monospace;'/>"
      +     "<div style='display:flex;gap:6px;'>"
      +       "<button id='tts-add-save' style='flex:1;padding:6px;background:var(--acc);border:none;border-radius:4px;color:#000;font-size:12px;cursor:pointer;font-family:Georgia,serif;'>Save</button>"
      +       "<button id='tts-add-cancel' style='padding:6px 10px;background:none;border:1px solid var(--brd2);border-radius:4px;color:var(--t2);font-size:12px;cursor:pointer;'>Cancel</button>"
      +     "</div>"
      +   "</div>"
      +   "<div id='tts-bank-rows'>" + _buildBankRows() + "</div>"
      + "</div>"
      + "<button id='tts-save-btn' style='width:100%;padding:10px;background:var(--acc);border:none;border-radius:6px;color:#000;font-family:Georgia,serif;font-size:14px;font-weight:bold;cursor:pointer;'>Save</button>"
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
