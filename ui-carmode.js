// ui-carmode.js — the Car Mode overlay: show/hide, status/party render, tap/next/prev
// controls, mic auto-start, media session hooks.
// Split from ui.js at v1.324 per UI_SEAM_MAP.md (TODO #54 / UA17).
// Car-overlay findings implemented per DOC/todo_carplay.html (2026-07-17 audit) — ranks
// noted inline. carNotify() below is a CROSS-LANE CONTRACT: stt.js/tts.js/game.js call it
// with typeof guards, so its signature/semantics must not drift without updating all callers.
// ── Car Mode ──────────────────────────────────────────────────────────────────
var _carKbHandler = null;
var _carRetryArmed = false;   // rank 2 — armed by carNotify("error",…), consumed by _carTap
var _carWakeLock = null;      // rank 5 — Screen Wake Lock sentinel, held only while carMode is on

// Centralized car-status strings (rank 24) — one table so every writer in this file (and
// carNotify, called cross-lane) says the same thing the same way; also the future i18n seam.
var CAR_STR = {
  ready: "Ready",
  listening: "Listening…",
  heardYou: "Heard you…",
  tapToSpeak: "Tap to speak",
  paused: "Paused",
  narratorSpeaking: "Narrator speaking…",
  voiceUnavailable: "Voice input not available in this browser",
  retrying: "Retrying…",
  sending: "Sending…",
  errorPrefix: "⚠ "
};

// rank 5 — re-acquire the wake lock when the tab regains visibility while carMode is still on
// (the lock auto-releases whenever the document is hidden, per spec). Single persistent
// listener (not re-added per showCarMode call) since it's a no-op outside car mode.
document.addEventListener("visibilitychange", function() {
  if (carMode && document.visibilityState === "visible") _carAcquireWakeLock();
});

// Cross-lane contract (see header): kinds are "error"/"info"/"progress"/"sent"/"response".
// No-op outside car mode. Guards every TTS/STT access — callers may land in any load order.
function carNotify(kind, text) {
  if (!carMode) return;
  if (kind === "error") {
    _carSetStatus(CAR_STR.errorPrefix + text);
    _carRetryArmed = true;
  } else if (kind === "info" || kind === "progress") {
    _carSetStatus(text);
  } else if (kind === "sent") {
    if (typeof TTS !== "undefined" && typeof TTS.earcon === "function") TTS.earcon("ack");
    _carSetStatus(CAR_STR.heardYou);
  } else if (kind === "response") {
    if (typeof TTS !== "undefined" && typeof TTS.earcon === "function") TTS.earcon("ready");
    _carRetryArmed = false;
  }
}

function _carAcquireWakeLock() {
  if (!(navigator.wakeLock && navigator.wakeLock.request)) return; // not supported — no-op, feature-detected
  try {
    navigator.wakeLock.request("screen").then(function(sentinel) {
      _carWakeLock = sentinel;
    }).catch(function(e) {
      console.warn("[carmode] wake lock request rejected:", e);
    });
  } catch (e) {
    console.warn("[carmode] wake lock request threw:", e);
  }
}
function _carReleaseWakeLock() {
  if (_carWakeLock) {
    try { _carWakeLock.release(); } catch (e) {}
    _carWakeLock = null;
  }
}

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
  _carAcquireWakeLock(); // rank 5
  try { store.set("tnd_carmode_v1", JSON.stringify({on:1,t:Date.now()})); } catch (e) {} // rank 13 — reload survival, expired by ui-boot.js's restore check
  if (typeof TTS !== "undefined") TTS.setOnDone(function() { if (carMode) _carAutoMic(); });
  // #2 pre-flight fix (v1.309): follow the REAL listen state instead of guessing it once
  // before STT.start() resolved — the overlay used to freeze on "Listening…" forever after
  // any recognition end/error/timeout (stt.js only knew #mic-btn). Status writes here are
  // edge-scoped: entering listening, and a listen ending while the status still claims
  // "Listening…" — other statuses (Paused, Narrator speaking…) belong to their own writers.
  if (typeof STT !== "undefined" && STT.setOnState) STT.setOnState(function(listening) {
    if (!carMode) return;
    _carSyncBtn();
    if (listening) { _carSetStatus(CAR_STR.listening); return; }
    var st = document.getElementById("car-status");
    if (st && st.textContent === CAR_STR.listening) {
      var inp = document.getElementById("userinput");
      _carSetStatus(inp && inp.value.trim() ? CAR_STR.heardYou : CAR_STR.tapToSpeak);
    }
  });
  _carKbHandler = function(e) {
    if (e.key === " ")           { e.preventDefault(); _carTap(); }
    else if (e.key === "ArrowRight") { e.preventDefault(); _carNext(); }
    else if (e.key === "ArrowLeft")  { e.preventDefault(); _carPrev(); }
    else if (e.key === "Escape")     { e.preventDefault(); hideCarMode(); }
  };
  document.addEventListener("keydown", _carKbHandler);
  _carSetStatus(CAR_STR.ready);
  _carSyncBtn();
}

function hideCarMode() {
  carMode = false;
  var ov = document.getElementById("car-overlay");
  if (ov) ov.style.display = "none";
  if (_carKbHandler) { document.removeEventListener("keydown", _carKbHandler); _carKbHandler = null; }
  _carRetryArmed = false;
  _carReleaseWakeLock(); // rank 5 — normal play must never hold the lock
  try { store.del("tnd_carmode_v1"); } catch (e) {} // rank 13 — × is always the escape hatch; clearing the flag is what makes it stick
  if (typeof TTS !== "undefined") {
    TTS.setOnDone(null); TTS.stopAudioSessionPrimer();
    if (!TTS.isOn()) TTS.stop(); // rank 16 — car-only narration must not outlive the overlay; voice-ON users keep theirs
  }
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
    if (c.portrait) {
      // rank 10 — syncUI now tail-calls this every state change; only touch img.src when the
      // value actually changed, or every turn re-decodes the same base64 portrait (flicker/churn).
      if (img.getAttribute("src") !== c.portrait) img.src = c.portrait;
      img.style.display = ""; init.style.display = "none";
    } else {
      img.style.display = "none"; init.style.display = "";
    }
  }
  var vit = document.getElementById("car-vitals"); // rank 22 — glanceable HP/gold under the party dots
  if (vit) vit.textContent = "HP " + c.hp + "/" + c.maxHp + " · " + c.gold + " gp";
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

// rank 2 — dispatch order is the contract: busy gate, then cancel a live listen, then pause/
// resume narration, then a tap-armed retry, then a parked utterance (rank 19), then start the
// mic. Each branch returns immediately so only one thing happens per tap.
function _carTap() {
  if (typeof busy !== "undefined" && busy) return; // (a)
  _carPulse("car-tap-btn");
  var sttOn = typeof STT !== "undefined" && STT.isListening();
  if (sttOn) { // (b) — cancel, never finalize-and-send (rank 4's send-on-cancel bug)
    // Cloud recording has no auto-endpoint — tap means "done, transcribe" (rank 7); native
    // tap means cancel (rank 4). Integration seam: STT.isCloudActive() picks the semantics.
    if (typeof STT !== "undefined") {
      if (typeof STT.isCloudActive === "function" && STT.isCloudActive()) STT.stop();
      else if (typeof STT.cancel === "function") STT.cancel();
      else STT.stop();
    }
    _carSetStatus(CAR_STR.ready);
    _carSyncBtn();
    return;
  }
  var ttsPlaying = typeof TTS !== "undefined" && TTS.isPlaying();
  var ttsPaused  = typeof TTS !== "undefined" && TTS.isPaused();
  if (ttsPlaying || ttsPaused) { // (c)
    if (typeof TTS !== "undefined") TTS.pause();
    _carSetStatus(ttsPlaying ? CAR_STR.paused : CAR_STR.narratorSpeaking);
    _carSyncBtn();
    return;
  }
  if (_carRetryArmed) { // (d) — armed by carNotify("error",…) on a failed turn
    _carRetryArmed = false;
    if (typeof retryLast === "function") retryLast();
    _carSetStatus(CAR_STR.retrying);
    return;
  }
  var inp = document.getElementById("userinput");
  if (inp && inp.value.trim()) { // (e) — a parked utterance (rank 19) waiting from a busy window
    if (typeof sendAction === "function") sendAction(null);
    _carSetStatus(CAR_STR.sending);
    return;
  }
  _carStartMic(); // (f)
}

function _carNext() {
  if (typeof busy !== "undefined" && busy) return;
  _carPulse("car-next-btn");
  var ttsPlaying = typeof TTS !== "undefined" && TTS.isPlaying();
  var ttsPaused  = typeof TTS !== "undefined" && TTS.isPaused();
  if (ttsPlaying || ttsPaused) { // rank 12 — paused is skippable too; skip() already resets _paused downstream
    if (typeof TTS !== "undefined") TTS.skip();
    // onDone fires → _carAutoMic() handles the rest
  } else {
    _carStartMic();
  }
}

// rank 11/18 — shared replay path: prefers TTS.replayLast() (preserves any queued items),
// falls back to the old stop()+speak(getLastText()) path when the newer API isn't loaded yet.
// Cancels (not finalizes) any live listen first so a replay can't be misread as a send.
function _carDoReplay() {
  if (typeof STT !== "undefined") { if (typeof STT.cancel === "function") STT.cancel(); else STT.stop(); }
  if (typeof TTS === "undefined") return;
  if (typeof TTS.replayLast === "function") {
    TTS.replayLast();
  } else {
    var last = TTS.getLastText();
    if (!last) return;
    TTS.stop();
    TTS.speak(last);
  }
  _carSetStatus(CAR_STR.narratorSpeaking);
  setTimeout(function() { if (carMode) _carSyncBtn(); }, 100);
}

function _carPrev() {
  if (typeof busy !== "undefined" && busy) return;
  _carPulse("car-prev-btn");
  _carDoReplay();
}

function _carStartMic() {
  if (typeof STT === "undefined" || !STT.isSupported()) { _carSetStatus(CAR_STR.voiceUnavailable); return; }
  var inp = document.getElementById("userinput");
  if (inp) inp.value = "";
  // Start FIRST, then reflect the state STT actually reached — the old order set
  // "Listening…" before STT.start() resolved, so a synchronous start failure (or the
  // sandbox's denied mic) left the overlay lying from the first instant (#2 pre-flight).
  // The setOnState hook (showCarMode) does the ongoing sync; this is the belt for the
  // early-return paths inside STT.start() that never reach the hook.
  STT.start();
  _carSetStatus(STT.isListening() ? CAR_STR.listening : CAR_STR.ready);
  _carSyncBtn();
}

function _carAutoMic() {
  if (!carMode) return;
  _carSetStatus(CAR_STR.tapToSpeak);
  _carSyncBtn();
  // rank 6 — "Auto-listen after narration" pref (Lane B, stt.js). Default ON (today's
  // behavior) whenever the pref isn't wired up yet or hasn't been set, per the contract.
  var autoOn = (typeof STT === "undefined" || typeof STT.isAutoListen !== "function" || STT.isAutoListen());
  if (!autoOn) return;
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
    // rank 11 — steering-wheel play/pause must never open a hot mic. While TTS is active
    // both map onto the existing pause toggle (_carTap already routes that correctly); while
    // idle, "play" replays the last narration instead of falling into _carTap's mic-start
    // branch, and "pause" is a no-op (nothing to pause).
    navigator.mediaSession.setActionHandler("play", function() {
      if (!carMode) return;
      var ttsActive = typeof TTS !== "undefined" && (TTS.isPlaying() || TTS.isPaused());
      if (ttsActive) { _carTap(); return; }
      _carDoReplay();
    });
    navigator.mediaSession.setActionHandler("pause", function() {
      if (!carMode) return;
      var ttsActive = typeof TTS !== "undefined" && (TTS.isPlaying() || TTS.isPaused());
      if (ttsActive) _carTap();
      // idle: no-op — the mic must never start from a mediaSession event
    });
    navigator.mediaSession.setActionHandler("nexttrack",     function() { if (carMode) _carNext(); });
    navigator.mediaSession.setActionHandler("previoustrack", function() { if (carMode) _carPrev(); });
  } catch(e) {}
}
