// car-session.js — THE Car Mode loop (#631, the Car Mode seam): turn-taking between a speaker and a microphone, the tap /
// next / prev controls, the spoken-command executor, the idempotent Media Session transport, the wake lock and the status
// line. PORTABLE: this file names nothing outside itself and the platform (dev/tests-631-car-seam.js derives that from the
// source). Everything it needs from the application arrives through ONE adapter, the HOST — a plain object whose rows are
// declared in CAR_HOST_ROWS below and installed at load by carSessionHost(host); the game's is CAR_HOST (ui-carmode.js), which
// fills them from TTS, STT, sendAction, worldState and the helpers. Adding a thing the loop needs = adding a row here and
// filling it there; the seam suite fails when the two disagree. The loop never names worldState.
//
// Split out of ui-carmode.js by #631 (2026-10-14) byte-for-byte in behaviour; the rank/audit notes inside are the record as
// written (DOC/todos_completed/todo_carplay.html, the #19 passes, #410, #481 E8/E9/G5). carNotify() is a CROSS-LANE CONTRACT:
// stt.js/tts.js/game.js/ui-shell.js call it (and _carSetStatus/_carSyncBtn) with typeof guards, so its signature/semantics
// must not drift without updating all callers. final-pass #32 — kinds are "error" (turn failures ONLY — arms tap-to-retry;
// game.js is the sole legitimate caller) / "warn" (non-turn failures, e.g. mic denied / no signal / voice download failed —
// status only, never arms retry) / "info" / "progress" / "sent" / "response".
// ── The host ──────────────────────────────────────────────────────────────────
var CAR_HOST_ROWS = [
  { name: "voice",         why: "() → the speaker (TTS-shaped: isOn isPlaying isPaused pause skip stop speak replayLast getLastText earcon setOnDone primeAudioSession stopAudioSessionPrimer) or null" },
  { name: "mic",           why: "() → the microphone (STT-shaped: isSupported isListening start stop cancel isCloudActive setOnState clearConfirm isConfirmPending isAutoListen warmMic) or null" },
  { name: "busy",          why: "() → true while a turn is in flight (the tap, the transport and the auto-mic all yield)" },
  { name: "opened",        why: "() the host's own bookkeeping when the overlay opens (menus, the reload-survival flag)" },
  { name: "closed",        why: "() the host's own bookkeeping when the overlay closes" },
  { name: "paint",         why: "() the host paints its own fields of the overlay (portrait, name, vitals, party); it calls this itself on every state change too" },
  { name: "nowPlaying",    why: "() → {title, artist, album, artwork} for the lock screen / head unit" },
  { name: "parked",        why: "() → the pending utterance text (the host's input field), '' when none" },
  { name: "park",          why: "(text) store an utterance for the next tap to send" },
  { name: "clearParked",   why: "() empty the pending utterance" },
  { name: "act",           why: "(text) send a spoken pick as the player's action" },
  { name: "sendParked",    why: "() send whatever is parked" },
  { name: "retry",         why: "() retry the failed turn (after carNotify('error', …) armed the tap)" },
  { name: "options",       why: "() → the current numbered options as strings ([] while they are not ready yet)" },
  { name: "optionsSpeech", why: "(list) → the spoken menu for those options" },
  { name: "entryBrief",    why: "() → what to read when the overlay opens ('' when there is nothing to say, or the player just heard it)" },
  { name: "recap",         why: "() → the spoken 'previously' recap ('' when none)" },
  { name: "commands",      why: "() → the spoken vocabulary table parseCarCommand reads (car-commands.js entries plus the host's own kinds)" },
  { name: "onCommand",     why: "(cmd) execute a host-owned kind; → true when handled" },
  { name: "crumb",         why: "(evt, data) the host's crumb ring (every Media Session command lands one)" },
  { name: "ticker",        why: "(el, base, opts) → the elapsed-seconds status ticker for a waiting status, or null to paint plain text" }
];
var _carHost = null;
function carSessionHost(host) {
  var missing = [], i;
  for (i = 0; i < CAR_HOST_ROWS.length; i++) if (!host || typeof host[CAR_HOST_ROWS[i].name] !== "function") missing.push(CAR_HOST_ROWS[i].name);
  if (missing.length) throw new Error("car-session: the host lacks " + missing.join(", ") + " — every row of CAR_HOST_ROWS is a function");
  _carHost = host;
}
function _carVoice() { return _carHost ? _carHost.voice() : null; }
function _carMic()   { return _carHost ? _carHost.mic() : null; }
function _carBusy()  { return !!(_carHost && _carHost.busy()); }

// ── Car Mode ──────────────────────────────────────────────────────────────────
var carMode = false;          // read by the host (game.js, ui-shell.js, stt.js, tts.js — each behind a typeof guard)
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
// round-2 #30 — last {title, album, artwork} triple the MediaMetadata was built from, so
// _carMediaSession can skip the rebuild (incl. re-decoding the base64 portrait artwork) when
// nothing it depends on changed since the previous paint.
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
  thinking: "Thinking…",                      // #481 G5 follow-up — a GM turn in flight (ui-shell.js addMsg paints it)
  transcribing: "Transcribing…",              // must match the literal stt.js sends via carNotify — the cloud speech model's wait
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
// #481 G5 follow-up (owner ruling 2026-09-30, "yes. count the seconds."): the statuses that wait on a model count seconds
// like every other wait (#356) — "Thinking… 7s". _carSetStatus ticks exactly these; any other status stops the count first.
var CAR_WAIT_STR = [CAR_STR.thinking, CAR_STR.retrying, CAR_STR.gettingOptions, CAR_STR.transcribing];
var _carStatusTick = null;   // the running count on a waiting status — at most one
// #78 — how long the mic is HELD after narration while the suggestions (a SECOND, async LLM call
// — see generateActions) are still in flight. The doc's Phase 2 predates #14/v1.110, which moved
// the options out of GM prose entirely, so on a short turn the read would otherwise be asked for
// before the options exist. User ruling 2026-07-27: hold, then fall back loudly.
var CAR_OPT_WAIT_MS = 3000;
var CAR_OPT_POLL_MS = 300;
var _carOptRead     = false;   // options already spoken for the CURRENT turn
var _carOptDeadline = 0;       // 0 = not yet waiting; else the give-up timestamp
var _carOptTimer    = null;
// audit F13 — the deferred mic open. Held in a variable for exactly one reason: carSessionStop must be
// able to REVOKE it. An un-revoked timer fires after the overlay is gone and opens the microphone
// on a page that is no longer in Car Mode (the callback's own carMode check catches that one), and
// more importantly it fires inside a window in which the driver may have said "pause" or the next
// narration may have started — both re-checked at the callback and in _carStartMic itself.
var _carMicTimer    = null;

// rank 5 — re-acquire the wake lock when the tab regains visibility while carMode is still on
// (the lock auto-releases whenever the document is hidden, per spec). Single persistent
// listener (not re-added per carSessionStart call) since it's a no-op outside car mode.
document.addEventListener("visibilitychange", function() {
  if (carMode && document.visibilityState === "visible") _carAcquireWakeLock();
});

// Cross-lane contract (see header): kinds are "error"/"warn"/"info"/"progress"/"sent"/"response".
// No-op outside car mode. Guards every voice/mic access — callers may land in any load order.
function carNotify(kind, text) {
  if (!carMode) return;
  var V = _carVoice();
  if (kind === "error") {
    // B16 — a failed turn used to be AUDIBLY identical to the app still thinking: the ack blip on
    // send, then permanent silence. In Car Mode the status string reaches nobody (eyes on the road),
    // so the failure earcon is what tells the driver the turn is over and a tap will retry it.
    // "fail" is the descending pair (tts.js earcon) — deliberately not readable as a completion.
    if (V && typeof V.earcon === "function") V.earcon("fail");
    _carSetStatus(CAR_STR.errorPrefix + text);
    _carRetryArmed = true;
  } else if (kind === "warn") { // final-pass #32 — non-turn failure: same status text, never arms tap-to-retry
    _carSetStatus(CAR_STR.errorPrefix + text);
  } else if (kind === "info" || kind === "progress") {
    _carSetStatus(text);
  } else if (kind === "sent") {
    if (V && typeof V.earcon === "function") V.earcon("ack");
    _carSetStatus(CAR_STR.heardYou);
  } else if (kind === "response") {
    if (V && typeof V.earcon === "function") V.earcon("ready");
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
// Speak the menu now. Cancels any live listen first — the mic must never hear our own read
// (CAR_MODE.md's listen-vs-speak rule). Returns false when there is nothing to say.
function _carReadOptions() {
  var acts = _carHost.options(), V = _carVoice(), M = _carMic();
  if (!acts.length) return false;
  if (!V || typeof V.speak !== "function") return false;
  if (M) { if (typeof M.cancel === "function") M.cancel(); else if (M.stop) M.stop(); }
  V.speak(_carHost.optionsSpeech(acts));
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
  var V = _carVoice();
  if (V && typeof V.speak === "function") { V.speak(CAR_STR.noOptions); return true; }
  return false;
}
// CROSS-LANE HOOK (same contract style as carNotify): stt.js hands every final transcript here
// FIRST. Returns true when Car Mode consumed it as a command — the caller must then NOT send it
// as a turn. Parsing lives here, not in stt.js, so Car Mode semantics stay in the Car Mode lane.
function carVoiceCommand(text) {
  if (!carMode || typeof parseCarCommand !== "function") return false;
  var acts = _carHost.options(), V = _carVoice(), M = _carMic();
  var cmd = parseCarCommand(text, acts.length, _carHost.commands());
  if (!cmd) return false;
  // Consumed: clear the field or _carTap's parked-utterance branch re-sends the command word
  // later as a free-form action.
  _carHost.clearParked();
  if (cmd.kind === "repeatAll") { _carDoReplay(); return true; }
  /* #410: spoken pause / resume — the decision is the pure carHoldDispatch table; this executes it */
  if (cmd.kind === "pause" || cmd.kind === "resume") {
    var _hd = (typeof carHoldDispatch === "function") ? carHoldDispatch(cmd.kind, {
      ttsPlaying: !!(V && V.isPlaying()),
      ttsPaused:  !!(V && V.isPaused()),
      held: _carHeld }) : { op: "noop", held: _carHeld, status: null };
    _carHeld = _hd.held;
    if (_hd.op === "hold") { if (M) { if (typeof M.cancel === "function") M.cancel(); else M.stop(); } }
    else if (_hd.op === "ttsPause" || _hd.op === "ttsResume") { if (V) V.pause(); /* the toggle, as _carTap uses it */ }
    if (_hd.op === "hold" || _hd.op === "ttsPause") { if (V && typeof V.earcon === "function") V.earcon("ack"); _carIntent("pause"); }
    if (_hd.op === "ttsResume" || _hd.op === "release") _carIntent("resume");
    if (_hd.status) _carSetStatus(CAR_STR[_hd.status] || _hd.status);
    _carSyncBtn();
    if (_hd.op === "release") _carStartMic();
    return true;
  }
  /* "previously" — the recap is generic car vocabulary; the TEXT is the host's */
  if (cmd.kind === "recap") { _carPreviously(true); return true; }
  /* the host's own kinds (the game: wrap up, never mind, roll) */
  if (_carHost.onCommand(cmd)) return true;
  if (cmd.kind === "repeat") {
    if (!_carReadOptions()) { carNotify("warn", CAR_STR.noOptionsYet); }
    return true;
  }
  var pick = acts[cmd.n - 1];
  if (!pick) { carNotify("warn", CAR_STR.noOptionsYet); return true; }
  if (_carBusy()) { carNotify("info", CAR_STR.heardTapToSend); _carHost.park(pick); return true; }
  carNotify("sent");
  _carHost.act(pick);
  return true;
}

function _carAcquireWakeLock() {
  if (!(navigator.wakeLock && navigator.wakeLock.request)) return; // not supported — no-op, feature-detected
  try {
    navigator.wakeLock.request("screen").then(function(sentinel) {
      // round-2 #28 — the request can resolve AFTER carSessionStop already ran (async race); a
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

// #308 ②: "previously on" — spoken on demand ("previously", "catch me up"). The text is the host's (the game:
// carRecapText, helpers.js — the last chapter + the place). Nothing to say → nothing spoken.
function _carPreviously(force) {
  var text = _carHost.recap(), V = _carVoice();
  if (!text) return;
  if (V && typeof V.speak === "function") V.speak(text);
  _carSetStatus("Previously…");
}
// ── #19 fourth pass (owner ruling 2026-09-23): "When car-mode starts, just read the current scene, and jump to
// options." The entry used to speak the full recap after a 2 h absence — in the Village that is every stash item and
// three residents — and the microphone permission prompt (the first mic open of the session) arrived only after all
// of it and the options, by which time the driver was driving. Now: ① the mic permission is WARMED first
// (mic.warmMic, inside the gesture that opened Car Mode, so the prompt lands while the car is parked), ② the entry
// read is the host's brief (the game: carSceneBrief, helpers.js — where you are + the tail of the last narration;
// '' within PREVIOUSLY_AFTER_MS of the last turn, so the driver who just heard that scene goes straight to the
// options), ③ its onDone runs the normal post-narration loop — options, then the mic. The full recap stays on the
// spoken "previously" / "catch me up" (_carPreviously(true)). Pinned by dev/tests-19b-carmode-transport.js.
function _carOpen() {
  /* #481 E9 (Fable: skip, never defer — a deferred warm-up would fall outside the gesture): the warm-up opens a recognizer,
     which switches the phone's audio route mid-sentence, so it is SKIPPED while the narrator speaks, as every other Car Mode
     mic path refuses then. The first listen asks for the permission instead. A paused read is not speaking. */
  var V = _carVoice(), M = _carMic();
  var reading = !!(V && V.isPlaying());
  if (reading) console.info("[car] mic warm-up skipped — the narrator is speaking (it would switch the audio route mid-read); the first listen asks instead");
  var warm = (!reading && M && typeof M.warmMic === "function") ? M.warmMic() : null;
  var go = function() {
    if (!carMode) return;
    var brief = _carHost.entryBrief();
    if (brief && V && typeof V.speak === "function") { V.speak(brief); _carSetStatus(CAR_STR.narratorSpeaking); return; }
    _carAutoMic();   // nothing to brief — the options step and the mic follow exactly as after a narration
  };
  if (warm && typeof warm.then === "function") warm.then(go, go); else go();
}
// The overlay opens. The host's door (the game: showCarMode, ui-carmode.js) checks it has something to show first.
function carSessionStart() {
  if (!_carHost) throw new Error("car-session: no host installed — call carSessionHost(host) first");
  var ov = document.getElementById("car-overlay");
  if (!ov) return;
  var V = _carVoice(), M = _carMic();
  carMode = true;
  _carOptReset();   // #78: entering mid-campaign, the on-screen options have not been READ aloud yet
  ov.style.display = "flex";
  _carHost.opened();
  if (V) V.primeAudioSession();
  _carMediaHandlers(); // round-2 #30 — action handlers registered once per overlay open, not per paint
  _carHost.paint();
  _carMediaSession();
  _carAcquireWakeLock(); // rank 5
  if (V) V.setOnDone(function() { if (carMode) _carAutoMic(); });
  _carOpen();   // #19 fourth pass: warm the mic permission, read the scene brief, jump to the options
  // #2 pre-flight fix (v1.309): follow the REAL listen state instead of guessing it once
  // before mic.start() resolved — the overlay used to freeze on "Listening…" forever after
  // any recognition end/error/timeout (stt.js only knew #mic-btn). Status writes here are
  // edge-scoped: entering listening, and a listen ending while the status still claims
  // "Listening…" — other statuses (Paused, Narrator speaking…) belong to their own writers.
  if (M && M.setOnState) M.setOnState(function(listening) {
    if (!carMode) return;
    _carSyncBtn();
    if (listening) { _carSetStatus(CAR_STR.listening); return; }
    var st = document.getElementById("car-status");
    if (st && st.textContent === CAR_STR.listening) {
      _carSetStatus(_carHost.parked().trim() ? CAR_STR.heardYou : CAR_STR.tapToSpeak);
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
    else if (e.key === "Escape")     { e.preventDefault(); carSessionStop(); }
  };
  document.addEventListener("keydown", _carKbHandler);
  _carSetStatus(CAR_STR.ready);
  _carSyncBtn();
}

function carSessionStop() {
  var V = _carVoice(), M = _carMic();
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
  _carSetStatus("");   // #481 G5 follow-up — nor may a running count (the overlay is hidden, not removed)
  _carReleaseWakeLock(); // rank 5 — normal play must never hold the lock
  if (_carHost) _carHost.closed(); // rank 13 — × is always the escape hatch; clearing the host's flag is what makes it stick
  if (V) {
    V.setOnDone(null); V.stopAudioSessionPrimer();
    if (!V.isOn()) V.stop(); // rank 16 — car-only narration must not outlive the overlay; voice-ON users keep theirs
  }
  if (M) {
    if (M.setOnState) M.setOnState(null);
    // round-2 #31 — exiting car mode mid-cloud-recording used to still upload + transcribe
    // (mic.stop() finalizes). Exit should discard instead: prefer cancel() when available.
    if (typeof M.cancel === "function") M.cancel(); else M.stop();
    // audit F3 — the #77 confirmation is Car-Mode-only state ("I heard: … — send it?" has no
    // desktop loop). An unanswered one used to survive the overlay and then OWN the next
    // dictation hours later, blanking the field and finally parking the abandoned car text as
    // the player's action. It dies with the overlay that asked the question.
    if (typeof M.clearConfirm === "function") M.clearConfirm("car mode exit");
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

function _carSetStatus(text) {
  var waits = CAR_WAIT_STR.indexOf(text) >= 0;
  if (_carStatusTick) {
    if (waits && _carStatusTick.base() === text) return;   // the same wait painted again (the options poll) — keep counting
    _carStatusTick.stop(); _carStatusTick = null;           // stop BEFORE the next text lands, or the next tick overwrites it (#356)
  }
  var el = document.getElementById("car-status");
  if (!el) return;
  var tick = (waits && _carHost) ? _carHost.ticker(el, text, { text: true }) : null;
  if (tick) _carStatusTick = tick;
  else el.textContent = text;
}

function _carSyncBtn() {
  var btn = document.getElementById("car-tap-btn");
  if (!btn) return;
  if (_carBusy()) {
    btn.innerHTML = "&#8943;"; btn.disabled = true;
    if ("mediaSession" in navigator) try { navigator.mediaSession.playbackState = "paused"; } catch(e) {}
    return;
  }
  btn.disabled = false;
  var V = _carVoice(), M = _carMic();
  var ttsPlaying = !!(V && V.isPlaying());
  var ttsPaused  = !!(V && V.isPaused());
  var sttOn      = !!(M && M.isListening());
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
  if (_carBusy()) return; // (a)
  _carPulse("car-tap-btn");
  if (_carHeld) { _carHeld = false; _carIntent("resume"); } // #410 — a tap is the explicit gesture that releases a spoken hold
  var V = _carVoice(), M = _carMic();
  var sttOn = !!(M && M.isListening());
  if (sttOn) { // (b) — cancel, never finalize-and-send (rank 4's send-on-cancel bug)
    // Cloud recording has no auto-endpoint — tap means "done, transcribe" (rank 7); native
    // tap means cancel (rank 4). Integration seam: mic.isCloudActive() picks the semantics.
    if (M) {
      if (typeof M.isCloudActive === "function" && M.isCloudActive()) M.stop();
      else if (typeof M.cancel === "function") M.cancel();
      else M.stop();
    }
    _carSetStatus(CAR_STR.ready);
    _carSyncBtn();
    return;
  }
  var ttsPlaying = !!(V && V.isPlaying());
  var ttsPaused  = !!(V && V.isPaused());
  if (ttsPlaying || ttsPaused) { // (c)
    if (V) V.pause();
    _carSetStatus(ttsPlaying ? CAR_STR.paused : CAR_STR.narratorSpeaking);
    _carSyncBtn();
    return;
  }
  if (_carRetryArmed) { // (d) — armed by carNotify("error",…) on a failed turn
    _carRetryArmed = false;
    _carHost.retry();
    _carSetStatus(CAR_STR.retrying);
    return;
  }
  if (_carHost.parked().trim()) { // (e) — a parked utterance (rank 19) waiting from a busy window
    // round-2 #29a — carNotify("sent") already plays the ack earcon AND sets "Heard you…";
    // calling _carSetStatus(CAR_STR.sending) here duplicated/shadowed that with a silent,
    // earcon-less status. Use the shared ack path so tap-to-send matches voice-to-send.
    carNotify("sent");
    _carHost.sendParked();
    return;
  }
  _carStartMic(); // (f)
}

function _carNext() {
  if (_carBusy()) return;
  _carPulse("car-next-btn");
  var V = _carVoice();
  var ttsPlaying = !!(V && V.isPlaying());
  var ttsPaused  = !!(V && V.isPaused());
  if (ttsPlaying || ttsPaused) { // rank 12 — paused is skippable too; skip() already resets _paused downstream
    if (V) V.skip();
    // onDone fires → _carAutoMic() handles the rest
  } else {
    _carStartMic();
  }
}

// rank 11/18 — shared replay path: prefers voice.replayLast() (preserves any queued items),
// falls back to the old stop()+speak(getLastText()) path when the newer API isn't loaded yet.
// Cancels (not finalizes) any live listen first so a replay can't be misread as a send.
function _carDoReplay() {
  var V = _carVoice(), M = _carMic();
  if (M) { if (typeof M.cancel === "function") M.cancel(); else M.stop(); }
  if (!V) return;
  if (typeof V.replayLast === "function") {
    V.replayLast();
  } else {
    var last = V.getLastText();
    if (!last) return;
    V.stop();
    V.speak(last);
  }
  _carSetStatus(CAR_STR.narratorSpeaking);
  setTimeout(function() { if (carMode) _carSyncBtn(); }, 100);
}

function _carPrev() {
  if (_carBusy()) return;
  _carPulse("car-prev-btn");
  _carDoReplay();
}

function _carStartMic() {
  var V = _carVoice(), M = _carMic();
  if (!M || !M.isSupported()) { _carSetStatus(CAR_STR.voiceUnavailable); return; }
  // audit F13 — the two conditions under which a mic must NEVER open, checked at the last
  // possible moment because every caller reaches here through a timer or an async callback:
  //   • held   — the driver said "pause"; the auto-mic loop is closed until resume or a tap
  //   • narration playing — the mic would hear our own read (CAR_MODE.md's listen-vs-speak rule)
  // Both are refusals, not failures, so they only repaint the status the state already implies.
  if (_carHeld) { _carSetStatus(CAR_STR.pausedHold); return; }
  if (V && V.isPlaying()) { _carSetStatus(CAR_STR.narratorSpeaking); return; }
  _carHost.clearParked();
  // Start FIRST, then reflect the state the mic actually reached — the old order set
  // "Listening…" before mic.start() resolved, so a synchronous start failure (or the
  // sandbox's denied mic) left the overlay lying from the first instant (#2 pre-flight).
  // The setOnState hook (carSessionStart) does the ongoing sync; this is the belt for the
  // early-return paths inside mic.start() that never reach the hook.
  M.start();
  _carSetStatus(M.isListening() ? CAR_STR.listening : CAR_STR.ready);
  _carSyncBtn();
}

function _carAutoMic() {
  if (!carMode) return;
  _carSetStatus(CAR_STR.tapToSpeak);
  _carSyncBtn();
  var V = _carVoice(), M = _carMic();
  // #77 — a pending confirmation reopens the mic for the ANSWER, bypassing the options step
  // (already read this cycle) and the parked-utterance bail below (the pending text lives in
  // the mic's _confirmPending, NOT in the field — the field is deliberately empty). Cloud stays
  // push-to-talk exactly like actions (round-2 #25's hallucination rule): the driver taps,
  // and a hallucinated non-answer can't send anyway — parseConfirmCommand refuses it.
  if (M && typeof M.isConfirmPending === "function" && M.isConfirmPending()) {
    if (typeof M.isCloudActive === "function" && M.isCloudActive()) { _carSetStatus(CAR_STR.confirmTap); return; }
    if (_carMicTimer) clearTimeout(_carMicTimer);
    _carMicTimer = setTimeout(function() {
      _carMicTimer = null;
      var M2 = _carMic();
      if (!carMode || _carBusy() || (M2 && M2.isListening())) return;
      if (!M2 || !M2.isConfirmPending()) return;   // resolved while we waited (e.g. a tap answered)
      _carStartMic();                        // audit F13: refuses on its own if a pause or a read landed in the gap
    }, 500);
    return;
  }
  // final-pass #33 — a busy-parked utterance (rank 19) sits in the host's field, already advertised
  // via carNotify("info","Heard you — tap to send") at the game.js rank-19 site. _carStartMic
  // below clears the field unconditionally, so starting the mic here would silently destroy
  // it. Bail before touching the mic — the existing tap branch (e) in _carTap sends it.
  if (_carHost.parked().trim()) { _carSetStatus(CAR_STR.heardTapToSend); return; }
  // #410 — a spoken "pause" holds the session: the auto-mic loop stays closed until "resume" or a tap
  if (_carHeld) { _carSetStatus(CAR_STR.pausedHold); return; }
  // round-2 #25 — cloud STT (Whisper) must be push-to-talk only, checked BEFORE the auto-listen
  // pref below. Auto-starting the cloud recorder after every narration uploads ~15s of road
  // noise on every turn (cost), and Whisper hallucinates text on silence — that can auto-send
  // a garbage GM turn. Native STT is a local free-running recognizer and is unaffected.
  if (M && typeof M.isCloudActive === "function" && M.isCloudActive()) return;
  // rank 6 — "Auto-listen after narration" pref (Lane B, stt.js). Default ON (today's
  // behavior) whenever the pref isn't wired up yet or hasn't been set, per the contract.
  var autoOn = (!M || typeof M.isAutoListen !== "function" || M.isAutoListen());
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
    var V2 = _carVoice(), M2 = _carMic();
    if (!carMode || _carBusy() || (M2 && M2.isListening())) return;
    if (_carHeld) { _carSetStatus(CAR_STR.pausedHold); return; }
    if (V2 && V2.isPlaying()) return;   // a new read started in the gap — its own onDone re-enters here
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
  if (_carHeld) return "held";   /* #481 E8: a spoken pause outranks every other state — see _carTransport */
  var V = _carVoice(), M = _carMic();
  if (V && V.isPlaying()) return "playing";
  if (V && V.isPaused()) return "paused";
  if (M && typeof M.isListening === "function" && M.isListening()) return "listening";
  if (_carBusy()) return "busy";
  return "idle";
}
function _carMediaCrumb(kind, state) {
  var n = (_carMediaCount[kind] || 0) + 1;
  _carMediaCount[kind] = n;
  if (!_carHost) return;
  /* #481 E8: the window coalesces a REPEAT (same command in the same state), never a state change — a held PLAY right after
     a playing one still lands its "held" crumb. The count stays per command, so it keeps rising across states. */
  var now = Date.now(), key = kind + " " + state;
  if (_carMediaCrumbAt[key] && now - _carMediaCrumbAt[key] < CAR_MEDIA_CRUMB_WINDOW_MS) return;
  _carMediaCrumbAt[key] = now;
  _carHost.crumb("media-action", kind + " " + state + " #" + n);
}
function _carTransport(kind) {
  if (!carMode) return "off";
  var state = _carTransportState(), V = _carVoice();
  _carMediaCrumb(kind, state);
  /* #481 E8 (owner ruling 2026-09-29: a car's own PLAY is ignored during a spoken pause): a head unit re-sends PLAY by itself
     after a call or a reconnect, and it used to replay the last narration while the hold kept ambience silent. While held, ALL
     four commands are no-ops (crumbed "held" above); only spoken resume, the tap or carSessionStop releases the hold (#410). */
  if (state === "held") return "held";
  if (kind === "play") {
    if (state === "paused") { V.pause(); _carSetStatus(CAR_STR.narratorSpeaking); _carSyncBtn(); return "resume"; }
    if (state === "idle")   { _carDoReplay(); return "replay"; }
    return "noop";   // already playing, a turn in flight, or the mic open
  }
  if (kind === "pause") {
    if (state !== "playing") return "noop";
    V.pause(); _carSetStatus(CAR_STR.paused); _carSyncBtn(); return "pause";
  }
  if (kind === "next") { _carNext(); return "next"; }
  if (kind === "prev") { _carPrev(); return "prev"; }
  return "noop";
}

// round-2 #30 — action handlers, registered ONCE from carSessionStart. They were previously
// re-registered on every paint/_carMediaSession() call (every syncUI tick, i.e. every
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

// The lock-screen / head-unit metadata, from the host's nowPlaying(). The host's paint() calls this after its own fields.
function _carMediaSession() {
  if (!("mediaSession" in navigator)) return;
  var np = (_carHost && _carHost.nowPlaying()) || {};
  var title = np.title || "", artist = np.artist || "", album = np.album || "", artwork = np.artwork || "";
  // round-2 #30 — skip rebuilding MediaMetadata (incl. re-decoding the base64 portrait into
  // artwork) when nothing it depends on changed since the last build. The host's paint calls this
  // on every syncUI tick, i.e. every game-state change, most of which touch none of these three.
  if (_carMediaLast && _carMediaLast.title === title && _carMediaLast.album === album && _carMediaLast.artwork === artwork) return;
  _carMediaLast = { title: title, album: album, artwork: artwork };
  var art = artwork ? [{ src: artwork, sizes: "512x512", type: "image/jpeg" }] : [];
  try {
    navigator.mediaSession.metadata = new MediaMetadata({
      title:  title,
      artist: artist,
      album:  album,
      artwork: art
    });
  } catch(e) {}
}
