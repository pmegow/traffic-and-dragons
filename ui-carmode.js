// ui-carmode.js — the Car Mode overlay: show/hide, status/party render, tap/next/prev
// controls, mic auto-start, media session hooks.
// Split from ui.js at v1.324 per UI_SEAM_MAP.md (TODO #54 / UA17).
// ── Car Mode ──────────────────────────────────────────────────────────────────
var _carKbHandler = null;

function showCarMode() {
  if (!worldState || !worldState.character) { showToast("Start a game first."); return; }
  var ov = document.getElementById("car-overlay");
  if (!ov) return;
  carMode = true;
  ov.style.display = "flex";
  closeAllMenus();
  if (typeof TTS !== "undefined") TTS.primeAudioSession();
  _carUpdate();
  _carMediaSession();
  if (typeof TTS !== "undefined") TTS.setOnDone(function() { if (carMode) _carAutoMic(); });
  // #2 pre-flight fix (v1.309): follow the REAL listen state instead of guessing it once
  // before STT.start() resolved — the overlay used to freeze on "Listening…" forever after
  // any recognition end/error/timeout (stt.js only knew #mic-btn). Status writes here are
  // edge-scoped: entering listening, and a listen ending while the status still claims
  // "Listening…" — other statuses (Paused, Narrator speaking…) belong to their own writers.
  if (typeof STT !== "undefined" && STT.setOnState) STT.setOnState(function(listening) {
    if (!carMode) return;
    _carSyncBtn();
    if (listening) { _carSetStatus("Listening…"); return; }
    var st = document.getElementById("car-status");
    if (st && st.textContent === "Listening…") {
      var inp = document.getElementById("userinput");
      _carSetStatus(inp && inp.value.trim() ? "Heard you…" : "Tap to speak");
    }
  });
  _carKbHandler = function(e) {
    if (e.key === " ")           { e.preventDefault(); _carTap(); }
    else if (e.key === "ArrowRight") { e.preventDefault(); _carNext(); }
    else if (e.key === "ArrowLeft")  { e.preventDefault(); _carPrev(); }
    else if (e.key === "Escape")     { e.preventDefault(); hideCarMode(); }
  };
  document.addEventListener("keydown", _carKbHandler);
  _carSetStatus("Ready");
  _carSyncBtn();
}

function hideCarMode() {
  carMode = false;
  var ov = document.getElementById("car-overlay");
  if (ov) ov.style.display = "none";
  if (_carKbHandler) { document.removeEventListener("keydown", _carKbHandler); _carKbHandler = null; }
  if (typeof TTS !== "undefined") { TTS.setOnDone(null); TTS.stopAudioSessionPrimer(); }
  if (typeof STT !== "undefined") { if (STT.setOnState) STT.setOnState(null); STT.stop(); }
  if ("mediaSession" in navigator) {
    try {
      navigator.mediaSession.setActionHandler("play", null);
      navigator.mediaSession.setActionHandler("pause", null);
      navigator.mediaSession.setActionHandler("nexttrack", null);
      navigator.mediaSession.setActionHandler("previoustrack", null);
    } catch(e) {}
  }
}

function _carUpdate() {
  var c = worldState && worldState.character;
  if (!c) return;
  var nameEl = document.getElementById("car-name");
  if (nameEl) nameEl.textContent = c.name || "";
  var img = document.getElementById("car-portrait-img");
  var init = document.getElementById("car-portrait-init");
  if (img && init) {
    if (c.portrait) { img.src = c.portrait; img.style.display = ""; init.style.display = "none"; }
    else { img.style.display = "none"; init.style.display = ""; }
  }
  _carUpdateParty();
  _carMediaSession();
}

function _carUpdateParty() {
  var el = document.getElementById("car-party");
  if (!el || !worldState) return;
  var members = (worldState.npcs || []).filter(function(n) { return n.partyMember && n.charSheet; });
  if (!members.length) { el.innerHTML = ""; return; }
  var html = "", i, n, pv, ratio, col;
  for (i = 0; i < members.length; i++) {
    n = members[i]; pv = partyMemberVitals(n); /* UA21③ (ui-panels.js) — members are filtered to charSheet holders, so pv.ratio is never null */
    ratio = pv.ratio;
    col = ratio > 0.5 ? "var(--grn)" : ratio > 0.25 ? "var(--warn)" : "var(--dng)"; /* Car mapping — raw ratio + warn/dng palette; HUD's differs, kept separate (UA21③) */
    html += "<div style='width:36px;height:36px;border-radius:50%;background:"+col+";display:flex;align-items:center;justify-content:center;font-size:11px;color:#fff;font-family:var(--font);font-weight:bold;border:2px solid var(--bg0);' title='"
      +escHtml(n.name)+" ("+pv.hp+"/"+pv.maxHp+" HP)'>"+escHtml((n.name||"?").slice(0,2))+"</div>";
  }
  el.innerHTML = html;
}

function _carSetStatus(text) {
  var el = document.getElementById("car-status");
  if (el) el.textContent = text;
}

function _carSyncBtn() {
  var btn = document.getElementById("car-tap-btn");
  if (!btn) return;
  if (typeof busy !== "undefined" && busy) {
    btn.innerHTML = "&#8943;"; btn.disabled = true;
    if ("mediaSession" in navigator) try { navigator.mediaSession.playbackState = "paused"; } catch(e) {}
    return;
  }
  btn.disabled = false;
  var ttsPlaying = typeof TTS !== "undefined" && TTS.isPlaying();
  var ttsPaused  = typeof TTS !== "undefined" && TTS.isPaused();
  var sttOn      = typeof STT !== "undefined" && STT.isListening();
  if (ttsPlaying)      { btn.innerHTML = "&#9208;"; if ("mediaSession" in navigator) try { navigator.mediaSession.playbackState = "playing"; } catch(e) {} }
  else if (ttsPaused)  { btn.innerHTML = "&#9654;"; if ("mediaSession" in navigator) try { navigator.mediaSession.playbackState = "paused"; } catch(e) {} }
  else if (sttOn)      { btn.innerHTML = "&#9209;"; if ("mediaSession" in navigator) try { navigator.mediaSession.playbackState = "paused"; } catch(e) {} }
  else                 { btn.innerHTML = "&#127908;"; if ("mediaSession" in navigator) try { navigator.mediaSession.playbackState = "paused"; } catch(e) {} }
}

function _carPulse(id) {
  var el = document.getElementById(id);
  if (!el) return;
  el.classList.remove("car-pulse");
  void el.offsetWidth;
  el.classList.add("car-pulse");
}

function _carTap() {
  if (typeof busy !== "undefined" && busy) return;
  _carPulse("car-tap-btn");
  var ttsPlaying = typeof TTS !== "undefined" && TTS.isPlaying();
  var ttsPaused  = typeof TTS !== "undefined" && TTS.isPaused();
  var sttOn      = typeof STT !== "undefined" && STT.isListening();
  if (ttsPlaying || ttsPaused) {
    if (typeof TTS !== "undefined") TTS.pause();
    _carSetStatus(ttsPlaying ? "Paused" : "Narrator speaking…");
    _carSyncBtn();
  } else if (sttOn) {
    if (typeof STT !== "undefined") STT.stop();
    _carSetStatus("Ready");
    _carSyncBtn();
  } else {
    _carStartMic();
  }
}

function _carNext() {
  if (typeof busy !== "undefined" && busy) return;
  _carPulse("car-next-btn");
  var ttsPlaying = typeof TTS !== "undefined" && TTS.isPlaying();
  if (ttsPlaying) {
    if (typeof TTS !== "undefined") TTS.skip();
    // onDone fires → _carAutoMic() handles the rest
  } else {
    _carStartMic();
  }
}

function _carPrev() {
  if (typeof busy !== "undefined" && busy) return;
  _carPulse("car-prev-btn");
  var last = typeof TTS !== "undefined" ? TTS.getLastText() : "";
  if (!last) return;
  if (typeof STT !== "undefined") STT.stop();
  if (typeof TTS !== "undefined") { TTS.stop(); TTS.speak(last); }
  _carSetStatus("Narrator speaking…");
  setTimeout(function() { if (carMode) _carSyncBtn(); }, 100);
}

function _carStartMic() {
  if (typeof STT === "undefined" || !STT.isSupported()) { _carSetStatus("Voice input not available in this browser"); return; }
  var inp = document.getElementById("userinput");
  if (inp) inp.value = "";
  // Start FIRST, then reflect the state STT actually reached — the old order set
  // "Listening…" before STT.start() resolved, so a synchronous start failure (or the
  // sandbox's denied mic) left the overlay lying from the first instant (#2 pre-flight).
  // The setOnState hook (showCarMode) does the ongoing sync; this is the belt for the
  // early-return paths inside STT.start() that never reach the hook.
  STT.start();
  _carSetStatus(STT.isListening() ? "Listening…" : "Ready");
  _carSyncBtn();
}

function _carAutoMic() {
  if (!carMode) return;
  _carSetStatus("Tap to speak");
  _carSyncBtn();
  setTimeout(function() {
    if (!carMode || (typeof busy !== "undefined" && busy) || (typeof STT !== "undefined" && STT.isListening())) return;
    _carStartMic();
  }, 800);
}

function _carMediaSession() {
  if (!("mediaSession" in navigator)) return;
  var c = worldState && worldState.character;
  var artwork = (c && c.portrait) ? [{ src: c.portrait, sizes: "512x512", type: "image/jpeg" }] : [];
  try {
    navigator.mediaSession.metadata = new MediaMetadata({
      title:  (c && c.name)               || "Traffic and Dragons",
      artist: "Traffic and Dragons",
      album:  (worldState && worldState.campName) || "",
      artwork: artwork
    });
    navigator.mediaSession.setActionHandler("play",          function() { if (carMode) _carTap(); });
    navigator.mediaSession.setActionHandler("pause",         function() { if (carMode) _carTap(); });
    navigator.mediaSession.setActionHandler("nexttrack",     function() { if (carMode) _carNext(); });
    navigator.mediaSession.setActionHandler("previoustrack", function() { if (carMode) _carPrev(); });
  } catch(e) {}
}
