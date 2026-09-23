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
var _carHeld = false;         // #410 — a spoken "pause" holds the session: _carAutoMic will not reopen the mic until "resume" or a tap
// #410 — the additive intent seam: a DOM CustomEvent any listener (Astra's ambience pilot) may subscribe to
// without touching Car Mode's single TTS/STT callbacks. kind: "pause" | "resume". Fired ONLY by player-facing
// controls, never by internal TTS.stop() cleanup (Astra reply 4, blacksmith_audio_proposal_review.html §5).
function _carIntent(kind) {
  try { document.dispatchEvent(new CustomEvent("tnd:car-intent", { detail: { kind: kind } })); } catch (e) {}
}
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
  pausedHold: "Paused — say resume, or tap", // #410 — the spoken hold: mic closed, auto-mic off until resume/tap
  nothingPaused: "Nothing is paused",         // #410 — "resume" with nothing held or paused
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
// audit F13 — the deferred mic open. Held in a variable for exactly one reason: hideCarMode must be
// able to REVOKE it. An un-revoked timer fires after the overlay is gone and opens the microphone
// on a page that is no longer in Car Mode (the callback's own carMode check catches that one), and
// more importantly it fires inside a window in which the driver may have said "pause" or the next
// narration may have started — both re-checked at the callback and in _carStartMic itself.
var _carMicTimer    = null;

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
  if (_carMicTimer) { clearTimeout(_carMicTimer); _carMicTimer = null; }   // audit F13 — same lifecycle: a new turn (or the exit) revokes the pending mic open
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
  /* #410: spoken pause / resume — the decision is the pure carHoldDispatch table; this executes it */
  if (cmd.kind === "pause" || cmd.kind === "resume") {
    var _hd = (typeof carHoldDispatch === "function") ? carHoldDispatch(cmd.kind, {
      ttsPlaying: typeof TTS !== "undefined" && TTS.isPlaying(),
      ttsPaused:  typeof TTS !== "undefined" && TTS.isPaused(),
      held: _carHeld }) : { op: "noop", held: _carHeld, status: null };
    _carHeld = _hd.held;
    if (_hd.op === "hold") { if (typeof STT !== "undefined") { if (typeof STT.cancel === "function") STT.cancel(); else STT.stop(); } }
    else if (_hd.op === "ttsPause" || _hd.op === "ttsResume") { if (typeof TTS !== "undefined") TTS.pause(); /* the toggle, as _carTap uses it */ }
    if (_hd.op === "hold" || _hd.op === "ttsPause") { if (typeof TTS !== "undefined" && typeof TTS.earcon === "function") TTS.earcon("ack"); _carIntent("pause"); }
    if (_hd.op === "ttsResume" || _hd.op === "release") _carIntent("resume");
    if (_hd.status) _carSetStatus(CAR_STR[_hd.status] || _hd.status);
    _carSyncBtn();
    if (_hd.op === "release") _carStartMic();
    return true;
  }
  /* #308 bookends */
  if (cmd.kind === "wrapUp") { if (worldState) worldState.wrapUpPing = { turn: worldState.turn }; carNotify("info", "Wrapping up — the story will find a stopping point."); if (typeof TTS !== "undefined" && typeof TTS.speak === "function") TTS.speak("Wrapping up. Say your next action and the story will find a stopping point."); return true; }
  if (cmd.kind === "recap") { _carPreviously(true); return true; }
  /* #6 E9: "never mind" — undo the last item move, say what happened either way */
  if (cmd.kind === "undoItem") { var _u = (typeof undoLastItemMove === "function") ? undoLastItemMove() : { ok: false, reason: "not available" }; if (_u.ok) { if (typeof saveAll === "function") saveAll(); if (typeof syncUI === "function") syncUI(); } carNotify(_u.ok ? "info" : "warn", _u.ok ? "Never mind — " + _u.name + (_u.action === "placed" ? " is back with you." : " stays where it was.") : "Nothing to undo — " + _u.reason + "."); if (typeof TTS !== "undefined" && typeof TTS.speak === "function") TTS.speak(_u.ok ? "Never mind. " + _u.name + (_u.action === "placed" ? " is back with you." : " stays where it was.") : "Nothing to undo."); return true; }
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
// ── #19 fourth pass (owner ruling 2026-09-23): "When car-mode starts, just read the current scene, and jump to
// options." The entry used to speak carRecapText after a 2 h absence — in the Village that is every stash item and
// three residents — and the microphone permission prompt (the first mic open of the session) arrived only after all
// of it and the options, by which time the driver was driving. Now: ① the mic permission is WARMED first
// (STT.warmMic, inside the gesture that opened Car Mode, so the prompt lands while the car is parked), ② the entry
// read is the scene brief (carSceneBrief, helpers.js: where you are + the tail of the last narration), ③ its onDone
// runs the normal post-narration loop — options, then the mic. An entry within PREVIOUSLY_AFTER_MS of the last turn
// skips the brief (the driver just heard that scene) and goes straight to the options. The full recap stays on the
// spoken "previously" / "catch me up" (_carPreviously(true)). Pinned by dev/tests-19b-carmode-transport.js.
function _carOpen() {
  var warm = (typeof STT !== "undefined" && typeof STT.warmMic === "function") ? STT.warmMic() : null;
  var go = function() {
    if (!carMode) return;
    var stale = !worldState || !worldState.lastTurnAt || (Date.now() - worldState.lastTurnAt) >= PREVIOUSLY_AFTER_MS;
    var brief = (stale && typeof carSceneBrief === "function") ? carSceneBrief() : "";
    if (brief && typeof TTS !== "undefined" && typeof TTS.speak === "function") { TTS.speak(brief); _carSetStatus(CAR_STR.narratorSpeaking); return; }
    _carAutoMic();   // nothing to brief — the options step and the mic follow exactly as after a narration
  };
  if (warm && typeof warm.then === "function") warm.then(go, go); else go();
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
  _carOpen();   // #19 fourth pass: warm the mic permission, read the scene brief, jump to the options
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
  _carHeld = false; // #410 — a hold never outlives the overlay
  // audit F1 — clearing OUR flag was never enough: the hold also lives in every subscriber that
  // heard the pause intent (ambience latches it and clears only on a resume intent), so leaving the
  // overlay without saying "resume" wedged their side OFF until a page reload. Closing the overlay
  // IS a player-facing release, so it announces one — unconditionally, because a subscriber may
  // have latched on an intent whose _carHeld was already cleared by another path.
  _carIntent("resume");
  _carOptReset();   // audit F13 — revoke the deferred mic open and the options poll; neither may outlive the overlay
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
    // audit F3 — the #77 confirmation is Car-Mode-only state ("I heard: … — send it?" has no
    // desktop loop). An unanswered one used to survive the overlay and then OWN the next
    // dictation hours later, blanking the field and finally parking the abandoned car text as
    // the player's action. It dies with the overlay that asked the question.
    if (typeof STT.clearConfirm === "function") STT.clearConfirm("car mode exit");
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
    col = pv.split ? "var(--t2)" : hpReadout(pv.hp, pv.maxHp).color; /* audit E10: ONE HP ramp (#352 vitalReadout, helpers.js) — the UA21③ "kept separate" note predates it and this was the last third palette */
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
  if (_carHeld) { _carHeld = false; _carIntent("resume"); } // #410 — a tap is the explicit gesture that releases a spoken hold
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
  // audit F13 — the two conditions under which a mic must NEVER open, checked at the last
  // possible moment because every caller reaches here through a timer or an async callback:
  //   • held   — the driver said "pause"; the auto-mic loop is closed until resume or a tap
  //   • narration playing — the mic would hear our own read (CAR_MODE.md's listen-vs-speak rule)
  // Both are refusals, not failures, so they only repaint the status the state already implies.
  if (_carHeld) { _carSetStatus(CAR_STR.pausedHold); return; }
  if (typeof TTS !== "undefined" && TTS.isPlaying()) { _carSetStatus(CAR_STR.narratorSpeaking); return; }
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
    if (_carMicTimer) clearTimeout(_carMicTimer);
    _carMicTimer = setTimeout(function() {
      _carMicTimer = null;
      if (!carMode || (typeof busy !== "undefined" && busy) || (typeof STT !== "undefined" && STT.isListening())) return;
      if (!STT.isConfirmPending()) return;   // resolved while we waited (e.g. a tap answered)
      _carStartMic();                        // audit F13: refuses on its own if a pause or a read landed in the gap
    }, 500);
    return;
  }
  // final-pass #33 — a busy-parked utterance (rank 19) sits in #action-input, already advertised
  // via carNotify("info","Heard you — tap to send") at the game.js rank-19 site. _carStartMic
  // below clears #action-input unconditionally, so starting the mic here would silently destroy
  // it. Bail before touching the mic — the existing tap branch (e) in _carTap sends it.
  var _parked = document.getElementById("action-input");
  if (_parked && _parked.value.trim()) { _carSetStatus(CAR_STR.heardTapToSend); return; }
  // #410 — a spoken "pause" holds the session: the auto-mic loop stays closed until "resume" or a tap
  if (_carHeld) { _carSetStatus(CAR_STR.pausedHold); return; }
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
  // audit F13 — 800ms is long enough for the driver to say "pause" or for the next turn's
  // narration to start, and neither was re-checked: the timer landed a hot mic on top of a paused
  // session (which then transcribed road noise) or on top of the narrator (which heard our own
  // read). The two live conditions are re-read at fire time, and the handle is revocable.
  if (_carMicTimer) clearTimeout(_carMicTimer);
  _carMicTimer = setTimeout(function() {
    _carMicTimer = null;
    if (!carMode || (typeof busy !== "undefined" && busy) || (typeof STT !== "undefined" && STT.isListening())) return;
    if (_carHeld) { _carSetStatus(CAR_STR.pausedHold); return; }
    if (typeof TTS !== "undefined" && TTS.isPlaying()) return;   // a new read started in the gap — its own onDone re-enters here
    _carStartMic();
  }, 800);
}

// ── #19 second pass (2026-09-22): IDEMPOTENT transport ──────────────────────────────────────
// "play" and "pause" used to route into _carTap(), a TOGGLE — so a head unit that re-sends PLAY on
// its own (many do after a call-profile switch or on reconnect) paused the very narration it meant
// to keep playing, and a redundant PAUSE resumed a paused one. Now "play" resumes only a paused
// read and "pause" pauses only a playing one; anything else is a no-op. An idle "play" still
// replays the last narration (rank 11), but never while a turn is in flight (the GM is about to
// replace that read) or the mic is open (a spontaneous PLAY at a profile switch would kill the
// dictation). The on-screen tap keeps its toggle — a tap is a deliberate gesture, a command is
// not. Every command is crumbed with the state it arrived in, rate-limited per kind so a spamming
// unit reads as a rising count rather than evicting the 24-entry ring. Returns what it did, for
// dev/tests-19b-carmode-transport.js.
var _carMediaCrumbAt = {}, _carMediaCount = {};
var CAR_MEDIA_CRUMB_WINDOW_MS = 2000;
function _carTransportState() {
  if (typeof TTS !== "undefined" && TTS.isPlaying()) return "playing";
  if (typeof TTS !== "undefined" && TTS.isPaused()) return "paused";
  if (typeof STT !== "undefined" && typeof STT.isListening === "function" && STT.isListening()) return "listening";
  if (typeof busy !== "undefined" && busy) return "busy";
  return "idle";
}
function _carMediaCrumb(kind, state) {
  var n = (_carMediaCount[kind] || 0) + 1;
  _carMediaCount[kind] = n;
  if (typeof erCrumb !== "function") return;
  var now = Date.now();
  if (_carMediaCrumbAt[kind] && now - _carMediaCrumbAt[kind] < CAR_MEDIA_CRUMB_WINDOW_MS) return;
  _carMediaCrumbAt[kind] = now;
  erCrumb("media-action", kind + " " + state + " #" + n);
}
function _carTransport(kind) {
  if (!carMode) return "off";
  var state = _carTransportState();
  _carMediaCrumb(kind, state);
  if (kind === "play") {
    if (state === "paused") { TTS.pause(); _carSetStatus(CAR_STR.narratorSpeaking); _carSyncBtn(); return "resume"; }
    if (state === "idle")   { _carDoReplay(); return "replay"; }
    return "noop";   // already playing, a turn in flight, or the mic open
  }
  if (kind === "pause") {
    if (state !== "playing") return "noop";
    TTS.pause(); _carSetStatus(CAR_STR.paused); _carSyncBtn(); return "pause";
  }
  if (kind === "next") { _carNext(); return "next"; }
  if (kind === "prev") { _carPrev(); return "prev"; }
  return "noop";
}

// round-2 #30 — action handlers, registered ONCE from showCarMode. They were previously
// re-registered on every _carUpdate()/_carMediaSession() call (every syncUI tick, i.e. every
// game-state change) for no benefit — the closures don't capture anything per-call, so this
// was pure churn. Split out so _carMediaSession can stay a cheap metadata-only path.
function _carMediaHandlers() {
  if (!("mediaSession" in navigator)) return;
  try {
    // rank 11 — steering-wheel play/pause must never open a hot mic; #19 second pass — and they
    // are IDEMPOTENT (see _carTransport). All four commands go through one dispatcher so each is
    // crumbed with the state it arrived in.
    navigator.mediaSession.setActionHandler("play",          function() { _carTransport("play"); });
    navigator.mediaSession.setActionHandler("pause",         function() { _carTransport("pause"); });
    navigator.mediaSession.setActionHandler("nexttrack",     function() { _carTransport("next"); });
    navigator.mediaSession.setActionHandler("previoustrack", function() { _carTransport("prev"); });
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
