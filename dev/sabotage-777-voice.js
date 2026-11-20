// sabotage-777-voice.js — retained proof for audit 2026-11-19 (TODO #777), section V (the rows judged without a phone):
//   car-commands.js   V8 a bare "I" is no filler · game.js, tag_table.js   V9 every Car Mode kind sent is handled
//   tts.js   V6 the earcon goes through the master gain · sound.js   V3 the reverb is rebuilt with its context; a failed play
// Batch 2 (2026-11-20): stt.js V2 V7 V12 · tts.js V4 V5 V10 V11 · wasm-probe.js, audio-accents.js, car-session.js V12 ·
//   ui-panels.js, companion-talk.js V13 — over fake platforms.
// Each clause runs ONE named case of dev/tests-777-voice.js (the suite's own --only).
var sabotage = require("./sabotage.js");
var CMD = ["node", ["dev/tests-777-voice.js"]], ONLY = "FAIL #777 ";
var failed = 0;
function prove(file, cases) { failed += sabotage.prove({ file: file, command: CMD, only: ONLY, cases: cases }); }
var T = {
  "V8": "V8: a short first-person line is the player's action",
  "V9": "V9: every kind the game sends to Car Mode is one the loop handles",
  "V3A": "V3: after the audio context is rebuilt, a sound with reverb still plays",
  "V3B": "V3: a play that fails is said at warn level and leaves no node connected",
  "V6": "V6: the narrator's beep goes out through the master gain",
  "V1": "V1: a failure the game hands the car to SAY is read aloud"
};

prove("car-commands.js", [
  { label: "V8: a bare I is filler again",
    find: "i(?:ll| will| want to| wanna)(?: take| do| pick| choose| go with)?|i(?: take| do| pick| choose| go with)|give me", replace: "i(?:ll| will| want to| wanna)?(?: take| do| pick| choose| go with)?|give me", mustFail: ONLY + T.V8 },
  { label: "V8: I before a picking verb is no longer filler (\"I pick three\" is lost)",
    find: "|i(?: take| do| pick| choose| go with)|give me", replace: "|give me", mustFail: ONLY + T.V8 }
]);
prove("game.js", [
  { label: "V9: the final death is sent as a kind the loop drops",
    find: "carNotify(\"info\",\"You have died for the last time. This story is complete.\");", replace: "carNotify(\"ended\",\"You have died for the last time. This story is complete.\");", mustFail: ONLY + T.V9 },
  { label: "V9: a respawn is sent as a kind the loop drops",
    find: "carNotify(\"info\",\"You wake again at \"+r.camp+", replace: "carNotify(\"respawn\",\"You wake again at \"+r.camp+", mustFail: ONLY + T.V9 }
]);
prove("tag_table.js", [
  { label: "V9: a downed hero is sent as a kind the loop drops",
    find: "carNotify(\"info\",\"You are down. Struggle, or yield?\");", replace: "carNotify(\"downed\",\"You are down. Struggle, or yield?\");", mustFail: ONLY + T.V9 }
]);
prove("tts.js", [
  { label: "V6: the beep is wired straight to the speakers",
    find: "gain.connect(_masterNode(ctx));   /* audit 2026-11-19, V6", replace: "gain.connect(ctx.destination);   /* audit 2026-11-19, V6", mustFail: ONLY + T.V6 }
]);
prove("sound.js", [
  { label: "V3: the reverb of the old context is kept across a rebuild",
    find: "_ctxRebuilds++; _verb = null;   /* audit 2026-11-19, V3", replace: "_ctxRebuilds++;   /* audit 2026-11-19, V3", mustFail: ONLY + T.V3A },
  { label: "V3: a failed play is said at debug level",
    find: "console.warn(\"[sound] '\" + id + \"' play failed: \" + (e && e.message));", replace: "console.debug(\"[sound] '\" + id + \"' play failed: \" + (e && e.message));", mustFail: ONLY + T.V3B },
  { label: "V3: a failed play leaves its bus connected",
    find: "      if (bus) { try { bus.disconnect(); } catch (e2) {} }", replace: "      if (false) { try { bus.disconnect(); } catch (e2) {} }", mustFail: ONLY + T.V3B }
]);
prove("car-session.js", [
  { label: "V1: a committed failure is not read aloud",
    find: "    if (V && typeof V.speak === \"function\") V.speak(text);\n    _carSyncBtn();\n  } else if (kind === \"info\"", replace: "    _carSyncBtn();\n  } else if (kind === \"info\"", mustFail: ONLY + T.V1 },
  { label: "V1: a spoken failure arms the tap-to-retry",
    find: "    _carSetStatus(CAR_STR.errorPrefix + text);\n    if (V && typeof V.speak === \"function\") V.speak(text);", replace: "    _carSetStatus(CAR_STR.errorPrefix + text); _carRetryArmed = true;\n    if (V && typeof V.speak === \"function\") V.speak(text);", mustFail: ONLY + T.V1 },
  { label: "V1 review: a spoken committed failure leaves an older retry armed",
    find: "an arm left by an earlier failure would send it again.\n    _carRetryArmed = false;\n", replace: "an arm left by an earlier failure would send it again.\n", mustFail: ONLY + T.V1 },
  { label: "V1: the car has no way to say a failure (the kind falls through in silence)",
    find: "  } else if (kind === \"say\") {", replace: "  } else if (kind === \"said\") {", mustFail: ONLY + T.V1 }
]);
prove("game.js", [
  { label: "V1: a committed turn that could not be shown is silent in the car",
    find: "carNotify(\"say\",\"The turn was applied, but it could not be shown.\");", replace: "carNotify(\"warn\",\"The turn was applied, but it could not be shown.\");", mustFail: ONLY + T.V1 },
  { label: "V1: a committed opening that could not be shown is silent in the car",
    find: "carNotify(\"say\",\"The opening could not be shown. Reload to continue.\");", replace: "carNotify(\"warn\",\"The opening could not be shown. Reload to continue.\");", mustFail: ONLY + T.V1 }
]);

// ── batch 2 (2026-11-20): V2, V4, V5, V7, V10–V13 ──────────────────────────────────────────────────────────────────
var T2 = {
  V2: "V2: a cloud take cancelled while it is being transcribed is discarded",
  V7: "V7: the end of a stopped recognizer does not touch the listen that replaced it",
  START: "V12: a recognizer that fails to start says so",
  MIC: "V12: a microphone failure is named for what it is",
  SETUP: "V12: a recording that fails to set up after the microphone opened lets the microphone go",
  V5: "V5: stop retires every scheduled source",
  V4: "V4: a Piper frame whose start-up fails is destroyed",
  V10: "V10: a Piper call that never answers is given up at its deadline",
  V11: "V11: when the voice server fails mid-read, the rest keeps its cast voices",
  PROBE: "V12: the memory probe keeps ONE record for every unnamed instantiation",
  MUTE: "V12: while the sound is muted the accent layer schedules nothing",
  REPEAT: "V12: in a conversation with no menu, \"repeat\" replays the last line",
  NUMBER: "V12: a number that names no option is the player's words",
  V13: "V13: a state change repaints the host that is installed"
};
prove("stt.js", [
  { label: "V2: cancel ignores a take that is being transcribed",
    find: "    if (_cloudDiscardUpload(\"cancel\")) return;", replace: "    if (false) return;", mustFail: ONLY + T2.V2 },
  { label: "V2: the discarded take's generation is not retired (its result still lands)",
    find: "    _cloudGeneration++;   // the pending result, failure and finalize all read stale and write nothing\n", replace: "", mustFail: ONLY + T2.V2 },
  { label: "V2: an upload is never recorded as pending",
    find: "    _cloudUploading = generation;   /* V2: cancel() can discard from here on */\n", replace: "", mustFail: ONLY + T2.V2 },
  { label: "V2: a settled upload stays recorded as pending (an idle cancel reports a discard)",
    find: "    _up.then(function() { _cloudUploadSettled(generation); }, function() { _cloudUploadSettled(generation); });", replace: "", mustFail: ONLY + T2.V2 },
  { label: "V7: a stale end event is handled as the live listen's",
    find: "      if (_rec !== rec) { console.debug(\"[stt] a stopped recognizer ended after the next listen began — ignored (V7)\"); return; }\n", replace: "", mustFail: ONLY + T2.V7 },
  { label: "V7: a stale result is written into the new listen's field",
    find: "      if (_rec !== rec) return;   /* V7: a recognizer that was replaced writes nothing */\n", replace: "", mustFail: ONLY + T2.V7 },
  { label: "V7: a stale error is reported against the new listen",
    find: "      if (_rec !== rec) return;   /* V7 */\n", replace: "", mustFail: ONLY + T2.V7 },
  { label: "V7: the recognizer still ending is not let go when the next listen begins",
    find: "    if (_rec) { try { if (typeof _rec.abort === \"function\") _rec.abort(); else _rec.stop(); } catch (e0) {} _rec = null; }\n", replace: "", mustFail: ONLY + T2.V7 },
  { label: "V12: a recognizer that fails to start shows nothing",
    find: "      if (typeof showToast === \"function\") showToast(\"Couldn't start voice input.\");\n      if (typeof carNotify === \"function\") carNotify(\"warn\", \"Voice input failed: \" + ((e && e.message) || \"the recognizer did not start\"));", replace: "      if (typeof carNotify === \"function\") carNotify(\"warn\", \"Voice input failed: \" + ((e && e.message) || \"the recognizer did not start\"));", mustFail: ONLY + T2.START },
  { label: "V12: a recognizer that fails to start does not tell the car",
    find: "      if (typeof carNotify === \"function\") carNotify(\"warn\", \"Voice input failed: \" + ((e && e.message) || \"the recognizer did not start\"));\n", replace: "", mustFail: ONLY + T2.START },
  { label: "V12: a recognizer that fails to start leaves no reason in the console",
    find: "      console.warn(\"[stt] the recognizer did not start:\", e && e.message);\n", replace: "", mustFail: ONLY + T2.START },
  { label: "V12: a missing microphone has no row (it reads as an unknown failure)",
    find: "    { names: [\"NotFoundError\", \"DevicesNotFoundError\", \"OverconstrainedError\"], say: \"No microphone was found\" },\n", replace: "", mustFail: ONLY + T2.MIC },
  { label: "V12: a busy microphone has no row",
    find: "    { names: [\"NotReadableError\", \"TrackStartError\", \"AbortError\"], say: \"The microphone is in use or could not be opened\" }\n", replace: "    { names: [], say: \"\" }\n", mustFail: ONLY + T2.MIC },
  { label: "V12: every microphone failure is shown as permission denied again",
    find: "      if (typeof showToast === \"function\") showToast(_mf + \".\");", replace: "      if (typeof showToast === \"function\") showToast(\"Microphone permission denied.\");", mustFail: ONLY + T2.MIC },
  { label: "V12: the car is told permission denied for every microphone failure",
    find: "      if (typeof carNotify === \"function\") carNotify(\"warn\", _mf); /* final-pass #32 */", replace: "      if (typeof carNotify === \"function\") carNotify(\"warn\", \"Microphone permission denied\"); /* final-pass #32 */", mustFail: ONLY + T2.MIC },
  { label: "V12: an unknown microphone failure drops the platform's reason",
    find: "    return \"The microphone could not be opened: \" + ((e && (e.message || e.name)) || \"unknown error\");", replace: "    return \"The microphone could not be opened\";", mustFail: ONLY + T2.MIC },
  { label: "V12: a throw after the microphone opened lands in the refusal branch again",
    find: "    }, function(e) {   /* V12: the REFUSAL only", replace: "    })[\"catch\"](function(e) {   /* V12: the REFUSAL only", mustFail: ONLY + T2.SETUP },
  { label: "V12: an abandoned take keeps its tracks open",
    find: "      _cloudTeardownStream();\n      _listening = false;\n      _syncBtn();\n      if (typeof showToast === \"function\") showToast(\"Voice input failed: \"", replace: "      _listening = false;\n      _syncBtn();\n      if (typeof showToast === \"function\") showToast(\"Voice input failed: \"", mustFail: ONLY + T2.SETUP },
  { label: "V12: an abandoned take still reads as listening",
    find: "      _cloudTeardownStream();\n      _listening = false;\n      _syncBtn();\n      if (typeof showToast === \"function\") showToast(\"Voice input failed: \"", replace: "      _cloudTeardownStream();\n      _syncBtn();\n      if (typeof showToast === \"function\") showToast(\"Voice input failed: \"", mustFail: ONLY + T2.SETUP },
  { label: "V12: an abandoned take's recorder is left running",
    find: "try { if (_dead.state !== \"inactive\") _dead.stop(); } catch (e2) {} }   /* onstop is what uploads", replace: "}   /* onstop is what uploads", mustFail: ONLY + T2.SETUP },
  { label: "V12: an abandoned take is uploaded when its recorder stops",
    find: "      if (_dead) { _dead.onstop = null; try {", replace: "      if (_dead) { try {", mustFail: ONLY + T2.SETUP },
  { label: "V12: an abandoned take shows nothing",
    find: "      if (typeof showToast === \"function\") showToast(\"Voice input failed: \" + ((e && e.message) || \"the recording could not be set up\"));\n", replace: "", mustFail: ONLY + T2.SETUP }
]);
prove("tts.js", [
  { label: "V5: a stopped source is not retired",
    find: "      _retireStopped(_sources[i]);   /* audit 2026-11-19, V5 */\n", replace: "", mustFail: ONLY + T2.V5 },
  { label: "V5: a stopped source stays connected",
    find: "    try { s.disconnect(); } catch (e) {}\n", replace: "", mustFail: ONLY + T2.V5 },
  { label: "V5: a stopped source keeps its decoded audio",
    find: "    try { s.buffer = null; } catch (e) {}\n", replace: "", mustFail: ONLY + T2.V5 },
  { label: "V4: the frame whose start-up failed is left in the page",
    find: "      if (fr) { try { fr.destroy(); } catch (e2) {", replace: "      if (false) { try { fr.destroy(); } catch (e2) {", mustFail: ONLY + T2.V4 },
  { label: "V10: no call has a deadline",
    find: "          var timer = PIPER_CALL_NO_DEADLINE[op] ? null : setTimeout(function () {   /* V10 */", replace: "          var timer = true ? null : setTimeout(function () {   /* V10 */", mustFail: ONLY + T2.V10 },
  { label: "V10: a download is cut off by the call deadline",
    find: "PIPER_CALL_NO_DEADLINE = { download: true }", replace: "PIPER_CALL_NO_DEADLINE = {}", mustFail: ONLY + T2.V10 },
  { label: "V10: an answered call leaves its timer armed",
    find: "          if (p.timer) clearTimeout(p.timer);   /* V10: an answered call leaves no timer behind */\n", replace: "", mustFail: ONLY + T2.V10 },
  { label: "V10: a call that could not be posted leaves its timer armed",
    find: "          catch (e) { if (timer) clearTimeout(timer); delete pending[id];", replace: "          catch (e) { delete pending[id];", mustFail: ONLY + T2.V10 },
  { label: "V10: the hung call is never rejected",
    find: "            rej(new Error(\"piper host did not answer \" + op + \" within \" + (PIPER_CALL_DEADLINE_MS / 1000) + \"s\"));\n", replace: "", mustFail: ONLY + T2.V10 },
  { label: "V10: the frame that hung is left in the page",
    find: "            try { adapter.destroy(); } catch (e) {}\n            if (_piperFrame === adapter)", replace: "            if (_piperFrame === adapter)", mustFail: ONLY + T2.V10 },
  { label: "V10: the dead frame stays the engine",
    find: "            if (_piperFrame === adapter) { _piperFrame = null; _piperMod = null; }\n", replace: "", mustFail: ONLY + T2.V10 },
  { label: "V10: the player is not told the local voice stopped",
    find: "            if (!_piperHungToasted && typeof showToast === \"function\") {", replace: "            if (false) {", mustFail: ONLY + T2.V10 },
  { label: "V10: a destroyed frame leaves the other calls' timers armed",
    find: "            if (pending[k].timer) clearTimeout(pending[k].timer);   /* V10 */\n", replace: "", mustFail: ONLY + T2.V10 },
  { label: "V11: the server's handoff drops the cast voices",
    find: "voiceId: voiceBaseId(voiceId), voices: _unitVoicesFrom(units, i, voices) });", replace: "voiceId: voiceBaseId(voiceId) });", mustFail: ONLY + T2.V11 },
  { label: "V11: the carried voices keep their old positions",
    find: "      if (voices && voices[i]) { mapped[i - from] = voices[i]; hasVoices = true; }", replace: "      if (voices && voices[i]) { mapped[i] = voices[i]; hasVoices = true; }", mustFail: ONLY + T2.V11 },
  { label: "V11: a remainder with no cast line carries an empty map",
    find: "    return hasVoices ? mapped : null;", replace: "    return mapped;", mustFail: ONLY + T2.V11 }
]);
prove("wasm-probe.js", [
  { label: "V12: each unnamed instantiation gets a kind of its own",
    find: "    return \"anon\";   /* audit 2026-11-19, V12: ONE kind", replace: "    return \"wasm\" + Math.random();   /* audit 2026-11-19, V12: ONE kind", mustFail: ONLY + T2.PROBE }
]);
prove("piper_test.html", [
  { label: "V12: the soak page's probe keeps a memory per unnamed instantiation",
    find: "    return \"anon\";   /* audit 2026-11-19, V12: as wasm-probe.js", replace: "    return \"wasm\" + (++anon);   /* audit 2026-11-19, V12: as wasm-probe.js", mustFail: ONLY + T2.PROBE }
]);
prove("audio-accents.js", [
  { label: "V12: a muted accent layer keeps scheduling",
    find: " || s.capturing || s.hidden || s.volume === 0; }", replace: " || s.capturing || s.hidden; }", mustFail: ONLY + T2.MUTE }
]);
prove("car-session.js", [
  { label: "V12: \"repeat\" in a host with no menu answers with the menu warning",
    find: "    if (menu === null) { _carDoReplay(); return true; }\n", replace: "", mustFail: ONLY + T2.REPEAT },
  { label: "V12: a number that names no option is taken as a command (the field is cleared first)",
    find: "  if (cmd.kind === \"pick\" && !acts[cmd.n - 1]) return _carSpeech(text);\n", replace: "", mustFail: ONLY + T2.NUMBER },
  { label: "V13: the overlay is painted while it is closed",
    find: "function carPaint() { if (carMode && _carHost) _carHost.paint(); }", replace: "function carPaint() { if (_carHost) _carHost.paint(); }", mustFail: ONLY + T2.V13 },
  { label: "V13: the repaint door paints nothing",
    find: "function carPaint() { if (carMode && _carHost) _carHost.paint(); }", replace: "function carPaint() { }", mustFail: ONLY + T2.V13 }
]);
prove("ui-panels.js", [
  { label: "V13: a state change paints the hero over whatever host is installed",
    find: "typeof carPaint===\"function\")carPaint();", replace: "typeof _carUpdate===\"function\")_carUpdate();", mustFail: ONLY + T2.V13 }
]);
prove("companion-talk.js", [
  { label: "V13: a talk opens while a turn is in flight",
    find: "  if (typeof busy !== \"undefined\" && busy) { showToast(\"Wait for the turn to finish, then talk.\"); return; }", replace: "  if (false) { showToast(\"Wait for the turn to finish, then talk.\"); return; }", mustFail: ONLY + T2.V13 }
]);

process.exit(failed ? 1 : 0);
