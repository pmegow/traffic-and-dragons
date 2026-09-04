// ui-carmode.js — the Car Mode overlay: show/hide, status/party render, tap/next/prev
// controls, mic auto-start, media session hooks.
// Split from ui.js at v1.324 per UI_SEAM_MAP.md (TODO #54 / UA17).
// Car-overlay findings implemented per DOC/todos_completed/todo_carplay.html (2026-07-17 audit) — ranks
// noted inline. carNotify() below is a CROSS-LANE CONTRACT: stt.js/tts.js/game.js call it
// with typeof guards, so its signature/semantics must not drift without updating all callers.
// final-pass #32 — kinds are "error" (turn failures ONLY — arms tap-to-retry; game.js is the
// sole legitimate caller) / "warn" (non-turn failures, e.g. mic denied / no signal / voice
// download failed — status only, never arms retry) / "info" / "progress" / "sent" / "response".
// ── Car Mode ──────────────────────────────────────────────────────────────────
var _carKbHandler = null;
var _carRetryArmed = false;   // rank 2 — armed by carNotify("error",…), consumed by _carTap
var _carWakeLock = null;      // rank 5 — Screen Wake Lock sentinel, held only while carMode is on
// round-2 #30 — last {name, campName, portrait} triple the MediaMetadata was built from, so
// _carMediaSession can skip the rebuild (incl. re-decoding the base64 portrait artwork) when
// nothing it depends on changed since the previous syncUI tick.
var _carMediaLast = null;

// Centralized car-status strings (rank 24) — one table so every writer in this file (and
// carNotify, called cross-lane) says the same thing the same way; also the future i18n seam.
var CAR_STR = {
  ready: "Ready",
  listening: "Listening…",
  heardYou: "Heard you…",
  heardTapToSend: "Heard you — tap to send", // final-pass #33 — must match the string game.js/stt.js send via carNotify
  tapToSpeak: "Tap to speak",
  paused: "Paused",
  narratorSpeaking: "Narrator speaking…",
  voiceUnavailable: "Voice input not available in this browser",
  retrying: "Retrying…",
  sending: "Sending…",
  errorPrefix: "⚠ ",
  // #77 — confirm gate (DOC/Research/DOC_nonsense_filter.html §4 Layer 2)
  confirmTap: "Yes or no? Tap to answer",
  // #78 — numbered options (CAR_MODE.md Phase 2)
  readingOptions: "Your options…",
  gettingOptions: "Getting your options…",
  noOptions: "No suggestions — just say what you do",
  noOptionsYet: "No options to repeat yet"
};
// #78 — how long the mic is HELD after narration while the suggestions (a SECOND, async LLM call
// — see generateActions) are still in flight. The doc's Phase 2 predates #14/v1.110, which moved
// the options out of GM prose entirely, so on a short turn the read would otherwise be asked for
// before the options exist. User ruling 2026-07-27: hold, then fall back loudly.
var CAR_OPT_WAIT_MS = 3000;
var CAR_OPT_POLL_MS = 300;
var _carOptRead     = false;   // options already spoken for the CURRENT turn
var _carOptDeadline = 0;       // 0 = not yet waiting; else the give-up timestamp
var _carOptTimer    = null;

// rank 5 — re-acquire the wake lock when the tab regains visibility while carMode is still on
// (the lock auto-releases whenever the document is hidden, per spec). Single persistent
// listener (not re-added per showCarMode call) since it's a no-op outside car mode.
document.addEventListener("visibilitychange", function() {
  if (carMode && document.visibilityState === "visible") _carAcquireWakeLock();
});

// Cross-lane contract (see header): kinds are "error"/"warn"/"info"/"progress"/"sent"/"response".
// No-op outside car mode. Guards every TTS/STT access — callers may land in any load order.
function carNotify(kind, text) {
  if (!carMode) return;
  if (kind === "error") {
    // B16 — a failed turn used to be AUDIBLY identical to the app still thinking: the ack blip on
    // send, then permanent silence. In Car Mode the status string reaches nobody (eyes on the road),
    // so the failure earcon is what tells the driver the turn is over and a tap will retry it.
    // "fail" is the descending pair (tts.js earcon) — deliberately not readable as a completion.
    if (typeof TTS !== "undefined" && typeof TTS.earcon === "function") TTS.earcon("fail");
    _carSetStatus(CAR_STR.errorPrefix + text);
    _carRetryArmed = true;
  } else if (kind === "warn") { // final-pass #32 — non-turn failure: same status text, never arms tap-to-retry
    _carSetStatus(CAR_STR.errorPrefix + text);
  } else if (kind === "info" || kind === "progress") {
    _carSetStatus(text);
  } else if (kind === "sent") {
    if (typeof TTS !== "undefined" && typeof TTS.earcon === "function") TTS.earcon("ack");
    _carSetStatus(CAR_STR.heardYou);
  } else if (kind === "response") {
    if (typeof TTS !== "undefined" && typeof TTS.earcon === "function") TTS.earcon("ready");
    _carRetryArmed = false;
    _carOptReset();   // #78: a new turn's narration is starting — its options have not been read
  }
}

// ── #78: numbered options ────────────────────────────────────────────────────
// Reset per turn. Called on carNotify("response") (a fresh GM turn) and on entering Car Mode.
function _carOptReset() {
  _carOptRead = false;
  _carOptDeadline = 0;
  if (_carOptTimer) { clearTimeout(_carOptTimer); _carOptTimer = null; }
}
// THE single source for what the options are, per CAR_MODE.md: the live .qa buttons on the newest
// narration. Deliberately not worldState.lastActions — the DOM copy is already punctuated (#88)
// and is exactly what the screen shows, so spoken / displayed / submitted can never disagree.
// While generateActions is still in flight its placeholder buttons carry no data-action, so this
// returns [] — which IS the "not ready yet" signal the hold below waits on.
function _carActions() {
  var out = [], story = document.getElementById("story-narrative");
  if (!story) return out;
  var nars = story.querySelectorAll(".msg.narrator");
  if (!nars.length) return out;
  var btns = nars[nars.length - 1].querySelectorAll("button.qa"), i, a;
  for (i = 0; i < btns.length; i++) { a = btns[i].getAttribute("data-action"); if (a) out.push(a); }
  return out;
}
// Speak the menu now. Cancels any live listen first — the mic must never hear our own read
// (CAR_MODE.md's listen-vs-speak rule). Returns false when there is nothing to say.
function _carReadOptions() {
  var acts = _carActions();
  if (!acts.length) return false;
  if (typeof TTS === "undefined" || typeof TTS.speak !== "function") return false;
  if (typeof STT !== "undefined") { if (typeof STT.cancel === "function") STT.cancel(); else if (STT.stop) STT.stop(); }
  TTS.speak(buildOptionsSpeech(acts));
  _carSetStatus(CAR_STR.readingOptions);
  return true;
}
// The options step of the post-narration loop. Returns TRUE when it has taken over this cycle —
// either by speaking (whose own queue-drain re-enters _carAutoMic, and _carOptRead is set by then,
// so the mic follows) or by scheduling another poll. Returns false to let the mic open now.
function _carOptionsStep() {
  if (_carOptRead) return false;
  if (_carReadOptions()) { _carOptRead = true; return true; }
  if (!_carOptDeadline) _carOptDeadline = Date.now() + CAR_OPT_WAIT_MS;
  if (Date.now() < _carOptDeadline) {
    _carSetStatus(CAR_STR.gettingOptions);
    if (_carOptTimer) clearTimeout(_carOptTimer);
    _carOptTimer = setTimeout(function() { _carOptTimer = null; if (carMode) _carAutoMic(); }, CAR_OPT_POLL_MS);
    return true;
  }
  // Gave up — generateActions failed or is pathologically slow. Say so out loud rather than
  // opening the mic in silence (the driver would not know whether to expect a menu).
  _carOptRead = true;
  if (typeof TTS !== "undefined" && typeof TTS.speak === "function") { TTS.speak(CAR_STR.noOptions); return true; }
  return false;
}
// CROSS-LANE HOOK (same contract style as carNotify): stt.js hands every final transcript here
// FIRST. Returns true when Car Mode consumed it as a command — the caller must then NOT send it
// as a turn. Parsing lives here, not in stt.js, so Car Mode semantics stay in the Car Mode lane.
function carVoiceCommand(text) {
  if (!carMode || typeof parseCarCommand !== "function") return false;
  var acts = _carActions();
  var cmd = parseCarCommand(text, acts.length);
  if (!cmd) return false;
  // Consumed: clear the field or _carTap's parked-utterance branch re-sends the command word
  // later as a free-form action.
  var inp = document.getElementById("action-input");
  if (inp) inp.value = "";
  if (cmd.kind === "repeatAll") { _carDoReplay(); return true; }
  /* #308 bookends */
  if (cmd.kind === "wrapUp") { if (worldState) worldState.wrapUpPing = { turn: worldState.turn }; carNotify("info", "Wrapping up — the story will find a stopping point."); if (typeof TTS !== "undefined" && typeof TTS.speak === "function") TTS.speak("Wrapping up. Say your next action and the story will find a stopping point."); return true; }
  if (cmd.kind === "recap") { _carPreviously(true); return true; }
  if (cmd.kind === "roll") { if (worldState && worldState.pendingCheck && typeof rollPendingCheck === "function") { rollPendingCheck(); } else { carNotify("info", "Nothing to roll right now."); } return true; }/* #329 */
  if (cmd.kind === "repeat") {
    if (!_carReadOptions()) { carNotify("warn", CAR_STR.noOptionsYet); }
    return true;
  }
  var pick = acts[cmd.n - 1];
  if (!pick) { carNotify("warn", CAR_STR.noOptionsYet); return true; }
  if (typeof busy !== "undefined" && busy) { carNotify("info", CAR_STR.heardTapToSend); if (inp) inp.value = pick; return true; }
  carNotify("sent");
  if (typeof sendAction === "function") sendAction(typeof toFirstPerson === "function" ? toFirstPerson(pick) : pick);
  return true;
}

function _carAcquireWakeLock() {
  if (!(navigator.wakeLock && navigator.wakeLock.request)) return; // not supported — no-op, feature-detected
  try {
    navigator.wakeLock.request("screen").then(function(sentinel) {
      // round-2 #28 — the request can resolve AFTER hideCarMode already ran (async race); a
      // sentinel stored at that point is never released, holding the screen awake through
      // normal play. Bail out (and release the late sentinel) if car mode is no longer on.
      if (!carMode) { try { sentinel.release(); } catch (e) {} return; }
      // round-2 #28 — also release any previously-held sentinel before overwriting it (e.g. a
      // visibilitychange re-acquire racing a prior in-flight request) so it isn't orphaned.
      if (_carWakeLock) { try { _carWakeLock.release(); } catch (e) {} }
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

// #308 ②: "previously on" — spoken on resume when the last turn is older than PREVIOUSLY_AFTER_MS, and on
// demand ("previously", "catch me up"). The text is pure (carRecapText, helpers.js): the last chapter + the place.
function _carPreviously(force) {
  if (!worldState || typeof carRecapText !== "function") return;
  var age = Date.now() - (worldState.lastTurnAt || 0);
  if (!force && (!worldState.lastTurnAt || age < PREVIOUSLY_AFTER_MS)) return;
  if (typeof TTS !== "undefined" && typeof TTS.speak === "function") TTS.speak(carRecapText());
  _carSetStatus("Previously…");
}
function showCarMode() {
  if (!worldState || !worldState.character) { showToast("Start a game first."); return; }
  var ov = document.getElementById("car-overlay");
  if (!ov) return;
  carMode = true;
  _carOptReset();   // #78: entering mid-campaign, the on-screen options have not been READ aloud yet
  ov.style.display = "flex";
  closeAllMenus();
  if (typeof TTS !== "undefined") TTS.primeAudioSession();
  _carMediaHandlers(); // round-2 #30 — action handlers registered once per overlay open, not per syncUI tick
  _carUpdate();
  _carMediaSession();
  _carAcquireWakeLock(); // rank 5
  try { store.set("tnd_carmode_v1", JSON.stringify({on:1,t:Date.now()})); } catch (e) {} // rank 13 — reload survival, expired by ui-boot.js's restore check
  if (typeof TTS !== "undefined") TTS.setOnDone(function() { if (carMode) _carAutoMic(); });
  _carPreviously(false);/* #308: a driver resuming after hours hears where the story stands before anything else */
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
      var inp = document.getElementById("action-input");
      _carSetStatus(inp && inp.value.trim() ? CAR_STR.heardYou : CAR_STR.tapToSpeak);
    }
  });
  // #70: a re-entrant open (button tap racing boot's auto-restore, or a double-fired button)
  // would otherwise leak the old listener forever — each stacks another keydown handler that
  // outlives this overlay session.
  if (_carKbHandler) document.removeEventListener("keydown", _carKbHandler);
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
  if (typeof STT !== "undefined") {
    if (STT.setOnState) STT.setOnState(null);
    // round-2 #31 — exiting car mode mid-cloud-recording used to still upload + transcribe
    // (STT.stop() finalizes). Exit should discard instead: prefer cancel() when available.
    if (typeof STT.cancel === "function") STT.cancel(); else STT.stop();
  }
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
  var c = worldState && activePlayer();/* TODO #1 P2: overlay portrait/name follow the spotlight PC */
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
  if (vit) { var _cvMx = (typeof manaMax === "function") ? manaMax(c) : 0; /* #110: MP rides the glance line for casters */
    vit.textContent = "HP " + c.hp + "/" + c.maxHp + (_cvMx > 0 ? " · MP " + manaCur(c) + "/" + _cvMx : "") + " · " + (c.gold != null ? c.gold : 0) + " gp"; }
  _carUpdateParty();
  _carMediaSession();
}

function _carUpdateParty() {
  var el = document.getElementById("car-party");
  if (!el || !worldState) return;
  /* TODO #1 P2: the spotlight PC owns the main portrait, so their dot leaves the row and the
     hero (when not spotlit) joins it — same swap the HUD party cards make. */
  var act = activePlayer(), hero = worldState.character;
  var members = (worldState.npcs || []).filter(function(n) { return n.partyMember && n.charSheet && !(act !== hero && n.name === act.name); });
  if (act !== hero && hero) members.unshift({ name: hero.name, charSheet: hero });
  if (!members.length) { el.innerHTML = ""; return; }
  var html = "", i, n, pv, ratio, col;
  for (i = 0; i < members.length; i++) {
    n = members[i]; pv = partyMemberVitals(n); /* UA21③ (ui-panels.js) — members are filtered to charSheet holders, so pv.ratio is never null */
    ratio = pv.ratio;
    /* #133c: a split member's dot goes neutral grey and the tooltip shows where, not vitals —
       their HP/MP are unknown to the player while they're elsewhere. */
    col = pv.split ? "var(--t2)" : ratio > 0.5 ? "var(--grn)" : ratio > 0.25 ? "var(--warn)" : "var(--dng)"; /* Car mapping — raw ratio + warn/dng palette; HUD's differs, kept separate (UA21③) */
    html += "<div style='width:36px;height:36px;border-radius:50%;background:"+col+";display:flex;align-items:center;justify-content:center;font-size:11px;color:#fff;font-family:var(--font);font-weight:bold;border:2px solid var(--bg0);' title='"
      +escHtml(n.name)+(pv.split?" (split: "+escHtml(pv.split.location)+")":" ("+pv.hp+"/"+pv.maxHp+" HP"+(function(){var _cmMx=(typeof manaMax==="function"&&pv.sheet)?manaMax(pv.sheet):0;return _cmMx>0?", "+manaCur(pv.sheet)+"/"+_cmMx+" MP":"";})()+")")+"'>"+escHtml((n.name||"?").slice(0,2))+"</div>";
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
  var inp = document.getElementById("action-input");
  if (inp && inp.value.trim()) { // (e) — a parked utterance (rank 19) waiting from a busy window
    // round-2 #29a — carNotify("sent") already plays the ack earcon AND sets "Heard you…";
    // calling _carSetStatus(CAR_STR.sending) here duplicated/shadowed that with a silent,
    // earcon-less status. Use the shared ack path so tap-to-send matches voice-to-send.
    carNotify("sent");
    if (typeof sendAction === "function") sendAction(null);
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
  var inp = document.getElementById("action-input");
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
  // #77 — a pending confirmation reopens the mic for the ANSWER, bypassing the options step
  // (already read this cycle) and the parked-utterance bail below (the pending text lives in
  // STT's _confirmPending, NOT in the field — the field is deliberately empty). Cloud stays
  // push-to-talk exactly like actions (round-2 #25's hallucination rule): the driver taps,
  // and a hallucinated non-answer can't send anyway — parseConfirmCommand refuses it.
  if (typeof STT !== "undefined" && typeof STT.isConfirmPending === "function" && STT.isConfirmPending()) {
    if (typeof STT.isCloudActive === "function" && STT.isCloudActive()) { _carSetStatus(CAR_STR.confirmTap); return; }
    setTimeout(function() {
      if (!carMode || (typeof busy !== "undefined" && busy) || (typeof STT !== "undefined" && STT.isListening())) return;
      if (!STT.isConfirmPending()) return;   // resolved while we waited (e.g. a tap answered)
      _carStartMic();
    }, 500);
    return;
  }
  // final-pass #33 — a busy-parked utterance (rank 19) sits in #action-input, already advertised
  // via carNotify("info","Heard you — tap to send") at the game.js rank-19 site. _carStartMic
  // below clears #action-input unconditionally, so starting the mic here would silently destroy
  // it. Bail before touching the mic — the existing tap branch (e) in _carTap sends it.
  var _parked = document.getElementById("action-input");
  if (_parked && _parked.value.trim()) { _carSetStatus(CAR_STR.heardTapToSend); return; }
  // round-2 #25 — cloud STT (Whisper) must be push-to-talk only, checked BEFORE the auto-listen
  // pref below. Auto-starting the cloud recorder after every narration uploads ~15s of road
  // noise on every turn (cost), and Whisper hallucinates text on silence — that can auto-send
  // a garbage GM turn. Native STT is a local free-running recognizer and is unaffected.
  if (typeof STT !== "undefined" && typeof STT.isCloudActive === "function" && STT.isCloudActive()) return;
  // rank 6 — "Auto-listen after narration" pref (Lane B, stt.js). Default ON (today's
  // behavior) whenever the pref isn't wired up yet or hasn't been set, per the contract.
  var autoOn = (typeof STT === "undefined" || typeof STT.isAutoListen !== "function" || STT.isAutoListen());
  if (!autoOn) return;
  // #78 — read the numbered menu BEFORE opening the mic. Returns true when it spoke or is still
  // waiting on the suggestion call; either way this cycle ends here and the next queue-drain
  // re-enters with _carOptRead set, so the mic opens after the driver has heard their choices.
  if (_carOptionsStep()) return;
  setTimeout(function() {
    if (!carMode || (typeof busy !== "undefined" && busy) || (typeof STT !== "undefined" && STT.isListening())) return;
    _carStartMic();
  }, 800);
}

// round-2 #30 — action handlers, registered ONCE from showCarMode. They were previously
// re-registered on every _carUpdate()/_carMediaSession() call (every syncUI tick, i.e. every
// game-state change) for no benefit — the closures don't capture anything per-call, so this
// was pure churn. Split out so _carMediaSession can stay a cheap metadata-only path.
function _carMediaHandlers() {
  if (!("mediaSession" in navigator)) return;
  try {
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

function _carMediaSession() {
  if (!("mediaSession" in navigator)) return;
  var c = worldState && activePlayer();/* TODO #1 P2: lockscreen metadata follows the spotlight PC */
  var name = (c && c.name) || "";
  var camp = (worldState && worldState.campName) || "";
  var portrait = (c && c.portrait) || "";
  // round-2 #30 — skip rebuilding MediaMetadata (incl. re-decoding the base64 portrait into
  // artwork) when nothing it depends on changed since the last build. _carUpdate calls this
  // on every syncUI tick, i.e. every game-state change, most of which touch none of these three.
  if (_carMediaLast && _carMediaLast.name === name && _carMediaLast.camp === camp && _carMediaLast.portrait === portrait) return;
  _carMediaLast = { name: name, camp: camp, portrait: portrait };
  var artwork = portrait ? [{ src: portrait, sizes: "512x512", type: "image/jpeg" }] : [];
  try {
    navigator.mediaSession.metadata = new MediaMetadata({
      title:  name || "Traffic and Dragons",
      artist: "Traffic and Dragons",
      album:  camp,
      artwork: artwork
    });
  } catch(e) {}
}
