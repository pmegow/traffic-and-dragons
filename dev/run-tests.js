// run-tests.js — headless runner for the test.html suites (DEV TOOL, not loaded by index.html).
// Evals the REAL engine files in load order (via dev/load-engine.js — the canonical list,
// AUDIT_FABLE_07_16_2026 #18), then dev/engine-tests.js, and reports to the console.
// T&D vendor-patch tripwire (v1.322): the session-cache patch in vendor/piper/vits/vits-web.js
// is what keeps iOS Safari from being killed by per-sentence InferenceSession creation. A
// re-vendor that drops it resurrects the crash SILENTLY — fail the suite instead.
try {
  var _fsV = require("fs"), _pathV = require("path");
  var _vits = _fsV.readFileSync(_pathV.join(__dirname, "..", "vendor/piper/vits/vits-web.js"), "utf8");
  if (_vits.indexOf("T&D PATCH") < 0 || _vits.indexOf("tndGetSession") < 0 || _vits.indexOf("tndPhonemize") < 0) {
    console.error("VENDOR PATCH MISSING: vendor/piper/vits/vits-web.js lost the T&D session-cache patch (re-vendored?) — reapply it (see the patch header it should carry).");
    process.exit(1);
  }
  // v1.335 additions (piper-audit): the r3 patch set must survive a re-vendor too.
  // ① download integrity — S() must reject non-OK responses (an HF error page cached to OPFS as
  //    the model is permanent, silent breakage);
  // ② same-origin phonemizer — tndLocate must resolve to the vendored TND_PHON_BASE, and the two
  //    phonemize assets must exist on disk (the CDN path silently breaks offline).
  if (_vits.indexOf("voice download failed: HTTP") < 0) {
    console.error("VENDOR PATCH MISSING: vits-web.js S() lost the non-OK download guard (T&D r3) — an HF error page would be cached to OPFS as a voice model, permanently.");
    process.exit(1);
  }
  if (_vits.indexOf("TND_PHON_BASE") < 0 || !_fsV.existsSync(_pathV.join(__dirname, "..", "vendor/piper/phonemize/piper_phonemize.wasm")) || !_fsV.existsSync(_pathV.join(__dirname, "..", "vendor/piper/phonemize/piper_phonemize.data"))) {
    console.error("VENDOR PATCH MISSING: same-origin phonemizer (T&D r3) — tndLocate must use TND_PHON_BASE and vendor/piper/phonemize/piper_phonemize.{wasm,data} must exist, or Piper silently depends on a CDN again.");
    process.exit(1);
  }
  // ③ rev parity — the ?tnd= query in tts.js is the ONLY delivery mechanism for a vits-web patch
  //    (permanent SW cache + immutable header, the v1.322/323 wasted-tries trap). A patched file
  //    whose TND_VITS_PATCH ran ahead of PIPER_RUNTIME_REV would never reach installed phones.
  // ④ dependency delivery (v1.336): the relative piper-DeOu3H9E import and the phonemize assets
  //    must carry the TND_DEP_REV query, and the import map must carry the ort ?tnd= rev — those
  //    URLs are the ONLY way a patch to a permanently-cached dependency reaches installed phones.
  if (_vits.indexOf("piper-DeOu3H9E.js?tnd=") < 0 || _vits.indexOf("TND_DEP_REV") < 0) {
    console.error("VENDOR PATCH MISSING: vits-web.js lost the TND_DEP_REV query on its dependency URLs (T&D r4) — a patched piper-DeOu3H9E.js/phonemize asset would never reach installed phones.");
    process.exit(1);
  }
  var _idx = _fsV.readFileSync(_pathV.join(__dirname, "..", "index.html"), "utf8");
  if (_idx.indexOf("ort.wasm.min.js?tnd=") < 0) {
    console.error("VENDOR PATCH MISSING: index.html import map lost the ?tnd= rev on ort.wasm.min.js — a patched ORT loader would never reach installed phones.");
    process.exit(1);
  }
  var _tts = _fsV.readFileSync(_pathV.join(__dirname, "..", "tts.js"), "utf8");
  var _revT = (_tts.match(/PIPER_RUNTIME_REV\s*=\s*"(r\d+)"/) || [])[1];
  var _revV = (_vits.match(/TND_VITS_PATCH\s*=\s*"(r\d+)"/) || [])[1];
  if (!_revT || !_revV || _revT !== _revV) {
    console.error("VENDOR REV MISMATCH: tts.js PIPER_RUNTIME_REV=" + _revT + " vs vits-web.js TND_VITS_PATCH=" + _revV + " — bump PIPER_RUNTIME_REV with every vendored vits-web change or the patch never reaches installed phones.");
    process.exit(1);
  }
  // ⑤ session recycle (T&D r8): the cross-turn wasm memory-ratchet guard — the vendored export
  //    AND the tts.js caller must both exist, or the iOS "9/50" tab-kill class quietly returns.
  if (_vits.indexOf("tndRecycleSession") < 0 || _tts.indexOf("tndRecycleSession") < 0) {
    console.error("VENDOR PATCH MISSING: session recycle (T&D r8) — vits-web.js must export tndRecycleSession and tts.js must call it between narrations, or cross-turn ORT memory growth resumes killing iOS tabs.");
    process.exit(1);
  }
  // ⑤b soak-harness rev lockstep (piper_test.html v0.2): the soak page imports vits-web with its
  //    own hardcoded ?tnd= rev. If it lags PIPER_RUNTIME_REV, the permanent SW piper-cache serves
  //    the soak a STALE runtime and the harness measures a build that no longer ships.
  var _spike = _fsV.readFileSync(_pathV.join(__dirname, "..", "piper_test.html"), "utf8");
  var _revS = (_spike.match(/vits-web\.js\?tnd=(r\d+)/) || [])[1];
  if (_revS && _revS !== _revT) {
    console.error("SOAK REV LAG: piper_test.html imports vits-web ?tnd=" + _revS + " but tts.js PIPER_RUNTIME_REV=" + _revT + " — bump the soak page's import rev so the harness measures the shipped runtime.");
    process.exit(1);
  }
} catch (e) { console.error("VENDOR PATCH CHECK FAILED: " + e.message); process.exit(1); }

// ── VOICE-DELETION TRUTHFULNESS CONTRACT (v1.419) ────────────────────────────────────────
// Field-confirmed 2026-07-22 on iOS 18.7: pressing ✕ toasted "🗑 Deleted" and deleted nothing.
// The vendored remove() deletes via `(await dir.getFileHandle(n)).remove()` — a CHROME-ONLY File
// System Access extension — inside `try { } catch { console.error }`, so on Safari it threw,
// was swallowed, and resolved clean. Every delete this app ever performed on an iPhone was a
// no-op that reported success, and eviction inherited it: the loop believed the removal, dropped
// the voice's LRU stamp, and an unstamped id sorts OLDEST — so the next eviction re-picked the
// same phantom forever and the cap was permanently dead (13 voices, ~1GB, against a cap of 10).
//
// These are SOURCE CONTRACTS, not behavioural tests, and deliberately so: the code needs OPFS,
// which the headless harness has no way to provide, and the functions are private to the TTS
// IIFE. They pin the four specific regressions that produced the bug. Each one failing means the
// silent-no-op class is back.
try {
  var _fsD = require("fs"), _pathD = require("path");
  var _tts = _fsD.readFileSync(_pathD.join(__dirname, "..", "tts.js"), "utf8");
  // Comments are stripped before matching. These functions DOCUMENT the bad call they replaced
  // ("was mod.remove(id) — the vendored path that swallows…"), so a naive scan flags the fix
  // itself. Caught by sabotage-testing the guard rather than by trusting it.
  var _nc = function (t) { return String(t).replace(/\/\/[^\n]*/g, "").replace(/\/\*[\s\S]*?\*\//g, ""); };
  var _evict = _nc((_tts.match(/async function _piperEvictExcess[\s\S]*?\n  \}\n/) || [""])[0]);
  var _del   = _nc((_tts.match(/function _piperDeleteVoice[\s\S]*?\n  \}\n/) || [""])[0]);
  var _rel   = _nc((_tts.match(/function releaseVoiceIfUnused[\s\S]*?\n  \}\n/) || [""])[0]);
  // ① NO deletion path may go back through the swallowing vendored remove(). v1.439 extended to
  //    releaseVoiceIfUnused — the one site the original contract didn't cover, and exactly where
  //    the class regressed (found by the entry-4 evidence pass).
  if (/mod\.remove\(/.test(_evict) || /mod\.remove\(/.test(_del) || /mod\.remove\(/.test(_rel)) {
    console.error("VOICE DELETE CONTRACT: a deletion path calls the vendored mod.remove(), which swallows every failure and resolves clean — on Safari that reports success while deleting nothing (v1.419/v1.439). Use _piperRemoveVoiceFiles.");
    process.exit(1);
  }
  // ② The primitive must use the STANDARD removeEntry, not the Chrome-only handle.remove().
  if (_tts.indexOf("removeEntry(") < 0) {
    console.error("VOICE DELETE CONTRACT: _piperRemoveVoiceFiles no longer uses removeEntry() — the Chrome-only FileSystemFileHandle.remove() is unimplemented in Safari and fails silently.");
    process.exit(1);
  }
  // ③ Automatic eviction must never take a voice someone is using. Harmless while deletion was a
  //    no-op; the moment deletion works, LRU age alone can take the narrator's or a companion's
  //    voice mid-drive, and recovery is a silent 60-130MB refetch inside predict().
  if (_evict.indexOf("_voiceAssignedTo") < 0) {
    console.error("VOICE DELETE CONTRACT: _piperEvictExcess no longer consults _voiceAssignedTo — automatic eviction could silently delete an assigned character/narrator voice (user call 2026-07-22).");
    process.exit(1);
  }
  // ④ A failed eviction must KEEP the LRU stamp. Deleting it was the other half of the ratchet.
  if (/catch\s*\([^)]*\)\s*\{[^}]*delete lru/.test(_evict)) {
    console.error("VOICE DELETE CONTRACT: _piperEvictExcess drops the LRU stamp on a FAILED eviction — an unstamped id sorts oldest and gets re-picked forever, which is what permanently disabled the cap.");
    process.exit(1);
  }
  // ⑤ The slot list must render every resident voice. Capping the loop at PIPER_VOICE_CAP is why
  //    3 of 13 voices were counted in the header but had no ✕ to press.
  if (/for \(i = 0; i < PIPER_VOICE_CAP; i\+\+\)/.test(_tts)) {
    console.error("VOICE DELETE CONTRACT: _renderPiperSlots caps its row loop at PIPER_VOICE_CAP — over-cap voices become invisible and undeletable (v1.419).");
    process.exit(1);
  }
  // ⑥ #95 speaker casting: a voiceId may now carry a "#<speaker>" suffix, but OPFS and the LRU
  //    know only BASE model ids. If any deletion decision compared composites, five characters
  //    cast on …#204/#611/#88 would each read as "unassigned" against the base id the LRU holds —
  //    so releasing one voice would delete the ONE model file all five speak through, mid-drive,
  //    recovered only by a silent 60-130MB refetch inside a read. Same class as ③, one level of
  //    indirection deeper, and equally invisible until it costs a user their voices.
  var _assign = _nc((_tts.match(/function _voiceAssignedTo\([\s\S]*?\n  \}\n/) || [""])[0]);
  if (!_assign) {
    console.error("VOICE DELETE CONTRACT: _voiceAssignedTo not found — the protection layer's anchor moved; re-verify clauses ③ and ⑥ by hand.");
    process.exit(1);
  }
  if (_assign.indexOf("voiceBaseId") < 0) {
    console.error("VOICE DELETE CONTRACT: _voiceAssignedTo compares voice ids without voiceBaseId — a character cast on '<model>#204' would not protect <model>, and eviction/release could delete the model file every speaker of it depends on (#95, the F11 class).");
    process.exit(1);
  }
  if (_rel.indexOf("voiceBaseId") < 0) {
    console.error("VOICE DELETE CONTRACT: releaseVoiceIfUnused does not normalize through voiceBaseId — reassigning a character off '<model>#204' would look up a composite the LRU/OPFS never held, or free a model other speakers still use (#95).");
    process.exit(1);
  }
  if (_evict.indexOf("voiceBaseId") < 0) {
    console.error("VOICE DELETE CONTRACT: _piperEvictExcess does not normalize through voiceBaseId — a composite keepId protects nothing, so the cap can evict the voice just downloaded (#95).");
    process.exit(1);
  }
  // ⑦ #95: ONE helper, used everywhere. A scattered split("#") is how a base/composite mismatch
  //    creeps back into a single call site nobody re-audits.
  var _splits = (_nc(_tts).match(/\.split\("#"\)|lastIndexOf\("#"\)/g) || []).length;
  if (_splits > 2) {
    console.error("VOICE DELETE CONTRACT: tts.js takes voice ids apart on '#' in more than the two sanctioned places (voiceBaseId/voiceSpeaker) — every protection/eviction/download decision must normalize through the ONE helper (#95 spec R1).");
    process.exit(1);
  }
  // ⑧ #95 (S2): the LOCAL read path must strip the speaker before the engine sees it. vits-web has
  //    no speaker surface, so a composite reaching predict()/download() is an unknown PATH_MAP key —
  //    a failed 60-130MB fetch inside a live read. (The SERVER path passes it through on purpose.)
  var _spk = (_tts.match(/async function _speakPiper\([\s\S]*?\n  \}\n/) || [""])[0];
  if (!/voiceId = _localVoiceId\(voiceId\)/.test(_spk) || !/uVoice = _localVoiceId\(/.test(_spk)) {
    console.error("VOICE DELETE CONTRACT: _speakPiper no longer strips speaker suffixes (_localVoiceId) from its passage voice AND its per-unit speaker map — local Piper cannot select a speaker, so the composite id reaches predict()/download() as an unknown model (#95 S2).");
    process.exit(1);
  }
  // ⑨ #95 (S5): both voice pickers must offer the starred cast, or an assigned speaker voice is
  //    unreachable without hand-editing localStorage. ui-sheets.js is not loaded by the DOM-free
  //    engine harness, so its half is pinned here.
  var _sheets = _nc(_fsD.readFileSync(_pathD.join(__dirname, "..", "ui-sheets.js"), "utf8"));
  if (_sheets.indexOf("starOptionsHtml") < 0) {
    console.error("VOICE DELETE CONTRACT: csVoiceControlHtml (ui-sheets.js) no longer renders the ★ Cast voices optgroup — a starred speaker voice becomes unassignable from the character sheet (#95 S5).");
    process.exit(1);
  }
} catch (e) { console.error("VOICE DELETE CONTRACT CHECK FAILED: " + e.message); process.exit(1); }

// ── AUDIO RECOVERY CONTRACT (v1.421, B10) ────────────────────────────────────────────────
// iOS does not hand an interrupted AudioContext back: resume() rejects on it forever, and
// _ensureCtx only replaces a context that is "closed" — which an interrupted one is not. So for
// as long as recovery meant "call resume()", it could not work, and the only cure was a manual
// voice toggle off/on (which closes and rebuilds). Field-diagnosed from two user observations:
// the downgrade toast fires BEFORE the first word of a read, and tapping never restores it.
// These pin the three edits that make recovery real. Source contracts — the code needs a live
// WebAudio implementation the headless harness has no way to provide.
try {
  var _fsA = require("fs"), _pathA = require("path");
  var _ttsA = _fsA.readFileSync(_pathA.join(__dirname, "..", "tts.js"), "utf8");
  var _gameA = _fsA.readFileSync(_pathA.join(__dirname, "..", "game.js"), "utf8");
  var _ncA = function (t) { return String(t).replace(/\/\/[^\n]*/g, "").replace(/\/\*[\s\S]*?\*\//g, ""); };
  // ① Recovery must REPLACE the context, not ask it to resume.
  var _rec = _ncA((_ttsA.match(/function recoverAudio\(tag\)[\s\S]*?\n  \}\n/) || [""])[0]);
  if (!_rec || _rec.indexOf("_closeCtx()") < 0 || _rec.indexOf("_ensureCtx()") < 0) {
    console.error("AUDIO RECOVERY CONTRACT: recoverAudio no longer closes and rebuilds the context — resume() alone can NEVER revive an iOS-interrupted ctx (B10, v1.421).");
    process.exit(1);
  }
  // ② The tap-unlock handler is what the downgrade toast promises. It must rebuild, not resume.
  var _unlock = _ncA((_ttsA.match(/function _armCtxUnlock\(\)[\s\S]*?\n  \}\n/) || [""])[0]);
  if (_unlock.indexOf("recoverAudio(") < 0) {
    console.error("AUDIO RECOVERY CONTRACT: _armCtxUnlock no longer calls recoverAudio — 'tap anywhere, then it recovers' becomes a promise the code cannot keep (B10).");
    process.exit(1);
  }
  // ③ The send tap is the only gesture that lands BEFORE the read. Without it the first line of
  //    every post-interrupt narration is still lost to the native voice.
  if (_ncA(_gameA).indexOf("TTS.recoverAudio(") < 0) {
    console.error("AUDIO RECOVERY CONTRACT: sendAction no longer repairs audio on the send gesture — the context stays dead until a read has already failed (B10, v1.421).");
    process.exit(1);
  }
  // ④ v1.437 (field: "no amount of clicking got it going — only the toggle did"): a stuck ctx
  //    that refused one recovery resume must ESCALATE to the rebuild — "suspended" and zombie
  //    states never qualified for it, so taps resume()d forever while only the toggle rebuilt.
  if (_rec.indexOf("_stuckCtx") < 0 || _rec.indexOf("_ctxDoomed = true") < 0) {
    console.error("AUDIO RECOVERY CONTRACT: the second-attempt escalation (_stuckCtx → _ctxDoomed) is gone from recoverAudio — a suspended-but-refusing ctx loops resume() forever and only the manual voice toggle recovers (v1.437).");
    process.exit(1);
  }
  // ⑤ v1.437: the watchdog must re-arm the tap unlock EVERY poll — the one-shot handler was
  //    consumed by the first tap and `warned` stayed latched, so later clicks did nothing.
  var _watchA = _ncA((_ttsA.match(/function _armCtxWatch\(engineLabel\)[\s\S]*?\n  \}\n/) || [""])[0]);
  if (!_watchA || _watchA.indexOf("_armCtxUnlock()") < 0 || _watchA.indexOf("_armCtxUnlock()") > _watchA.indexOf("if (!warned)")) {
    console.error("AUDIO RECOVERY CONTRACT: _armCtxWatch no longer re-arms the tap unlock on every poll (before the warned latch) — one tap per freeze gets a recovery attempt and every later tap is inert (v1.437).");
    process.exit(1);
  }
  // ⑥ v1.437: the zombie detector — a ctx reporting "running" with a frozen audio clock is
  //    invisible to every state-trusting recovery path; only the clock comparison catches it.
  if (_ttsA.indexOf('erCrumb("ctx-zombie"') < 0) {
    console.error("AUDIO RECOVERY CONTRACT: the frozen-clock zombie detector is gone — a 'running' ctx with a stalled render clock plays silence forever and no tap can ever fix it (v1.437).");
    process.exit(1);
  }
  // ⑦ v1.438 (field: tap rebuilt the ctx but left silence + a bar stuck on "Speaking…"): the
  //    rebuild must REQUEUE the interrupted item — "tap anywhere to resume" has to actually
  //    resume, and a teardown that tells no one leaves the play bar lying forever.
  if (_rec.indexOf("_queue.unshift(replayItem)") < 0 || _ncA(_ttsA).indexOf("_curItem = item") < 0) {
    console.error("AUDIO RECOVERY CONTRACT: the doomed-ctx rebuild no longer requeues the in-flight item (_curItem/replayItem) — a recovery tap discards the narration and strands the play bar on 'Speaking…' (v1.438).");
    process.exit(1);
  }
} catch (e) { console.error("AUDIO RECOVERY CONTRACT CHECK FAILED: " + e.message); process.exit(1); }

// ── RESPAWN ORDERING CONTRACT (v1.424, B9) ───────────────────────────────────────────────
// Eighteen field crumbs, and EVERY realm respawn failed at stage `spawn` with "piper host did
// not signal ready within 30s": the replacement realm never started while the old one was alive.
// Build-then-destroy was chosen so a failure would leave the working engine in place — but that
// safety is worthless when the build can never succeed, and it meant the fix had never once
// completed. The old realm must be destroyed FIRST so the replacement is built into freed memory.
// Flipping this back reintroduces a fix that silently never runs, which is the worst of both.
try {
  var _fsR = require("fs"), _pathR = require("path");
  var _ttsR = _fsR.readFileSync(_pathR.join(__dirname, "..", "tts.js"), "utf8");
  var _ncR = function (t) { return String(t).replace(/\/\/[^\n]*/g, "").replace(/\/\*[\s\S]*?\*\//g, ""); };
  var _resp = _ncR((_ttsR.match(/function _frameRespawnNow\(voiceId\)[\s\S]*?\n  \}\n/) || [""])[0]);
  if (!_resp) { console.error("RESPAWN ORDERING CONTRACT: _frameRespawnNow not found."); process.exit(1); }
  var _destroyAt = _resp.indexOf("old.destroy()"), _spawnAt = _resp.indexOf("_piperSpawnFrame()");
  if (_destroyAt < 0 || _spawnAt < 0) {
    console.error("RESPAWN ORDERING CONTRACT: _frameRespawnNow no longer both destroys the old realm and spawns a new one.");
    process.exit(1);
  }
  if (_destroyAt > _spawnAt) {
    console.error("RESPAWN ORDERING CONTRACT: the old realm is destroyed AFTER the new one is spawned — build-then-destroy. The phone cannot start a second realm at 429-624MB resident; every respawn then times out at stage 'spawn' and the fix never runs (18 field crumbs, v1.424).");
    process.exit(1);
  }
  // The brief no-engine window is only safe because concurrent callers share one init.
  if (_ttsR.indexOf("_piperInitP") < 0) {
    console.error("RESPAWN ORDERING CONTRACT: the _piperInit in-flight guard (_piperInitP) is gone — destroy-then-build leaves _piperMod null, so a read starting mid-respawn would spawn a SECOND concurrent realm, recreating the exact condition that made respawns fail.");
    process.exit(1);
  }
  // v1.429 (Fable review, todo_checkWithFable #6.3): _piperInitP alone never covered the respawn
  // itself — _frameRespawnNow spawns directly and does not hold that guard, so for the whole swap
  // (up to the 30s ready timeout) _piperMod and _piperInitP both read cold+idle and a mid-respawn
  // read spawned a SECOND concurrent realm; the pointer-race loser leaked as an orphaned live
  // engine. The respawn must PUBLISH its swap (_frameRespawnP = p) and _piperInit must WAIT on it.
  if (_resp.indexOf("_frameRespawnP = p") < 0) {
    console.error("RESPAWN ORDERING CONTRACT: _frameRespawnNow no longer publishes its swap as _frameRespawnP — _piperInit has nothing to wait on, and a read starting mid-respawn races the swap with a second concurrent realm (v1.429).");
    process.exit(1);
  }
  var _initR = _ncR((_ttsR.match(/async function _piperInit\(\)[\s\S]*?\n  \}\n/) || [""])[0]);
  if (!_initR) { console.error("RESPAWN ORDERING CONTRACT: _piperInit not found."); process.exit(1); }
  if (_initR.indexOf("await _frameRespawnP") < 0) {
    console.error("RESPAWN ORDERING CONTRACT: _piperInit no longer awaits _frameRespawnP — a read starting mid-respawn spawns a second concurrent realm and the loser leaks as an orphaned engine (v1.429).");
    process.exit(1);
  }
} catch (e) { console.error("RESPAWN ORDERING CONTRACT CHECK FAILED: " + e.message); process.exit(1); }

// ── PLAYBACK RECYCLE CONTRACT (v1.430, B9 H1) ─────────────────────────────────────────────
// 25 crumbs: the tab dies at pc≈90-132 under two synthesis architectures whose one shared code
// is the main-page playback layer. The v1.430 response: null the source's buffer on ended (the
// Safari #718 release step this path skipped) and recycle the AudioContext between reads. The
// recycle MUST stay idle-gated — firing while audio is playing/queued would cut live narration,
// and that regression would be inaudible in any headless test.
try {
  var _fsP = require("fs"), _pathP = require("path");
  var _ttsP = _fsP.readFileSync(_pathP.join(__dirname, "..", "tts.js"), "utf8");
  var _ncP = function (t) { return String(t).replace(/\/\/[^\n]*/g, "").replace(/\/\*[\s\S]*?\*\//g, ""); };
  if (_ncP(_ttsP).indexOf("mySrc.buffer = null") < 0) {
    console.error("PLAYBACK RECYCLE CONTRACT: the onended handler no longer nulls the source's buffer — Safari retains a source's decoded PCM after disconnect unless the buffer is explicitly detached (standardized-audio-context #718, v1.430).");
    process.exit(1);
  }
  var _recA = _ncP((_ttsP.match(/function recoverAudio\(tag\)[\s\S]*?\n  \}\n/) || [""])[0]);
  if (!_recA) { console.error("PLAYBACK RECYCLE CONTRACT: recoverAudio not found."); process.exit(1); }
  if (_recA.indexOf("_ctxSynths >= AUDIO_CTX_RECYCLE_SYNTHS") < 0) {
    console.error("PLAYBACK RECYCLE CONTRACT: the healthy-context recycle is gone from recoverAudio — per-source native accumulation on the long-lived AudioContext is B9's prime suspect and nothing else caps it (v1.430).");
    process.exit(1);
  }
  var _recCond = _recA.slice(_recA.indexOf("_ctxSynths >= AUDIO_CTX_RECYCLE_SYNTHS") - 200, _recA.indexOf("_ctxSynths >= AUDIO_CTX_RECYCLE_SYNTHS"));
  if (_recCond.indexOf("!_playing") < 0 || _recCond.indexOf("_queue.length") < 0) {
    console.error("PLAYBACK RECYCLE CONTRACT: the ctx recycle lost its idle gate (!_playing / !_queue.length) — recycling with audio live cuts narration mid-word, and no headless test can hear it (v1.430).");
    process.exit(1);
  }
} catch (e) { console.error("PLAYBACK RECYCLE CONTRACT CHECK FAILED: " + e.message); process.exit(1); }

// ── BYPASS EVIDENCE CONTRACT (v1.432, B9) ─────────────────────────────────────────────────
// A bypass-run kill lands BETWEEN reads (bypass reads finish fast), leaves done:true on the
// Piper crumb, and mails nothing — the experiment's deaths were invisible until the boot
// report closed that (2026-07-23 field lesson). Both halves must survive: the unload stamp
// (without it every clean close reads as a kill → false bypass-death mails) and the boot
// report itself (without it the blind spot silently returns).
try {
  var _fsB = require("fs"), _pathB = require("path");
  var _ncB = function (t) { return String(t).replace(/\/\/[^\n]*/g, "").replace(/\/\*[\s\S]*?\*\//g, ""); };
  var _erB = _ncB(_fsB.readFileSync(_pathB.join(__dirname, "..", "error-report.js"), "utf8"));
  if (_erB.indexOf('erCrumb("unload")') < 0) {
    console.error("BYPASS EVIDENCE CONTRACT: the pagehide/beforeunload unload stamp is gone from error-report.js — erPrevDirty can no longer distinguish a kill from a clean close, so every normal quit while the bypass is armed would mail a false death (v1.432).");
    process.exit(1);
  }
  var _ttsB = _ncB(_fsB.readFileSync(_pathB.join(__dirname, "..", "tts.js"), "utf8"));
  if (_ttsB.indexOf('reportError("bypass-death"') < 0) {
    console.error("BYPASS EVIDENCE CONTRACT: the bypass-run boot report is gone from tts.js loadSettings — between-reads kills during the B9 experiment become invisible again (v1.432).");
    process.exit(1);
  }
} catch (e) { console.error("BYPASS EVIDENCE CONTRACT CHECK FAILED: " + e.message); process.exit(1); }

// ── WORK-BUDGET GOVERNOR CONTRACT (v1.434, B9 root cause) ─────────────────────────────────
// iOS kills the WebContent process after a cumulative budget of synthesis work per page load
// (the energy assassin — DOC/BUGS.md ▸ B9, the three-week diagnosis). The governor is the fix:
// reads stop STARTING on Piper at the start gate and stop MID-READ at the hard gate, handing
// narration to the native voice instead of letting iOS kill the tab. Losing either gate brings
// the deaths back — visible in the field only after real players lose real sessions.
try {
  var _fsG = require("fs"), _pathG = require("path");
  var _ncG = function (t) { return String(t).replace(/\/\/[^\n]*/g, "").replace(/\/\*[\s\S]*?\*\//g, ""); };
  var _ttsG = _ncG(_fsG.readFileSync(_pathG.join(__dirname, "..", "tts.js"), "utf8"));
  var _spB = (_ttsG.match(/async function _speakPiper\([\s\S]*?\n  \}\n/) || [""])[0];
  if (!_spB) { console.error("GOVERNOR CONTRACT: _speakPiper not found."); process.exit(1); }
  var _gStart = _spB.indexOf("_piperGovernStart()"), _gInit = _spB.indexOf("_piperInit()");
  if (_gStart < 0) {
    console.error("GOVERNOR CONTRACT: the START gate (_piperGovernStart) is gone from _speakPiper — pages will spend the full iOS energy budget and the B9 tab deaths return (v1.434).");
    process.exit(1);
  }
  if (_gInit >= 0 && _gStart > _gInit) {
    console.error("GOVERNOR CONTRACT: the START gate runs AFTER engine init — a governed read still boots/spends the wasm engine before falling back (v1.434).");
    process.exit(1);
  }
  if (_spB.indexOf("_piperGovernHard()") < 0) {
    console.error("GOVERNOR CONTRACT: the HARD mid-read gate (_piperGovernHard) is gone — a long read started just under the start gate can cross the death floor mid-flight (v1.434).");
    process.exit(1);
  }
} catch (e) { console.error("GOVERNOR CONTRACT CHECK FAILED: " + e.message); process.exit(1); }

// ── SERVER TTS TIER CONTRACT (v1.435, #90 M1) ────────────────────────────────────────────
// The server tier exists to do ZERO client synthesis work (the B9 close: nothing for the iOS
// energy assassin to kill) and to fail DOWN the ladder, never into a stall. These pin the three
// properties a refactor could quietly lose — each regression would only show up as late-session
// tab deaths or wedged reads on a phone, weeks later.
try {
  var _fsS = require("fs"), _pathS = require("path");
  var _ncS = function (t) { return String(t).replace(/\/\/[^\n]*/g, "").replace(/\/\*[\s\S]*?\*\//g, ""); };
  var _ttsS = _ncS(_fsS.readFileSync(_pathS.join(__dirname, "..", "tts.js"), "utf8"));
  var _spS = (_ttsS.match(/async function _speakServer\([\s\S]*?\n  \}\n/) || [""])[0];
  if (!_spS) { console.error("SERVER TTS CONTRACT: _speakServer not found."); process.exit(1); }
  // ① Zero wasm: the server loop must never touch the local engine — no predict, no init, no
  //    voice download. One such call re-spends the iOS energy budget the tier exists to spare.
  if (/predict\(|_piperInit\(|_piperEnsureVoice\(/.test(_spS)) {
    console.error("SERVER TTS CONTRACT: _speakServer touches the local wasm engine (predict/_piperInit/_piperEnsureVoice) — the server tier must do ZERO client synthesis work or B9 returns (v1.435).");
    process.exit(1);
  }
  // ② The governor meters LOCAL work only. A governor gate here would silence the server tier
  //    exactly when it is most needed (late session, budget spent).
  if (_spS.indexOf("_piperGovern") >= 0) {
    console.error("SERVER TTS CONTRACT: _speakServer consults the governor — the work budget meters local wasm synthesis only; gating the server tier on it disables the B9 fix late-session (v1.435).");
    process.exit(1);
  }
  // ③ Mid-read failure hands the REMAINDER down the ladder via the queue (the governor's
  //    handoff pattern). Losing it turns one dead server into a per-unit timeout crawl.
  if (!/_queue\.unshift\(\{ text: _remText, piper: true/.test(_spS)) {
    console.error("SERVER TTS CONTRACT: the mid-read remainder handoff (_queue.unshift({piper:true…})) is gone from _speakServer — a server failure mid-read must continue the read on local Piper, not stall or drop it (v1.435).");
    process.exit(1);
  }
  // ④ The ladder order itself: server on top, native the floor.
  if (_ttsS.indexOf('var TTS_LADDER = ["server", "piper", "native"]') < 0) {
    console.error("SERVER TTS CONTRACT: TTS_LADDER is no longer server → piper → native — the tier order is the ratified #90 design (server first for connected players, native the always-available floor).");
    process.exit(1);
  }
  // ⑤ v1.436 (field lesson): ▶ Test auditions through the server tier when it's up — a local
  //    Test on a server-tier page boots the wasm engine and spends governor budget for nothing.
  var _tvS = _ncS((_ttsS.match(/function testVoice\([\s\S]*?\n  \}\n/) || [""])[0]);
  if (!/server: true/.test(_tvS)) {
    console.error("SERVER TTS CONTRACT: testVoice no longer auditions via the server tier — every Test press on a connected page boots the local wasm engine and spends the iOS energy budget the tier exists to spare (v1.436).");
    process.exit(1);
  }
  // ⑥ v1.436: the send-tap prewarm — without it the first unit of nearly every post-idle read
  //    pays the Fly cold boot and times out into the local ladder (the 🔋-latch field failure).
  var _gameS = _ncS(_fsS.readFileSync(_pathS.join(__dirname, "..", "game.js"), "utf8"));
  if (_gameS.indexOf("TTS.prewarmServer()") < 0) {
    console.error("SERVER TTS CONTRACT: sendAction no longer prewarms the TTS machine on the send gesture — post-idle reads meet a cold Fly machine and degrade to local Piper every turn (v1.436).");
    process.exit(1);
  }
} catch (e) { console.error("SERVER TTS CONTRACT CHECK FAILED: " + e.message); process.exit(1); }

// ── #76 TABLE TALK ISOLATION CONTRACT ────────────────────────────────────────────────────
// Table Talk must NEVER influence gameplay. That guarantee is structural, not prompt-deep: the
// TT path in sendAction skips applyMuts, the transcript, sessionLog, summarize, engine notes,
// the multi-PC queue, and the turn counter. Every one of those is a `!isTT` guard that a future
// edit could drop, and NONE of them would fail visibly — the campaign would just start quietly
// absorbing out-of-character chatter. So the guards are asserted here as a source contract.
// The `lastAction` one is not hypothetical: it WAS unguarded (ask a TT question, switch to the
// Story tab, press Retry → the question replayed as a real player turn). Fixed v1.388.
try {
  var _fsT = require("fs"), _pathT = require("path");
  var _rootT = _pathT.join(__dirname, "..");
  var _game = _fsT.readFileSync(_pathT.join(_rootT, "game.js"), "utf8");
  var _ttFail = [];
  function _ttReq(name, cond) { if (!cond) _ttFail.push(name); }
  _ttReq("lastAction guarded by !isTT (else Retry replays a TT question as a story turn)", /if\(!isTT\)lastAction=txt;/.test(_game));
  _ttReq("transcript write guarded by !isTT", /if\(!isTT&&!\(opts&&opts\.silent\)&&!_isRetryDup\)logTranscript/.test(_game));
  _ttReq("summarize guarded by !isTT", /if\(!isTT&&sessionTokens\(\)>=SUMMARIZE_AT\)/.test(_game));
  _ttReq("engine notes guarded by !isTT", /if\(!isTT&&!\(opts&&opts\.silent\)\)\{var _en=buildEngineNotes/.test(_game));
  _ttReq("multi-PC queue bypassed for TT", /if\(!isTT&&!\(opts&&opts\.silent\)&&!\(opts&&opts\.mpBypass\)/.test(_game));
  _ttReq("TT sends noHistory (the narrative sessionLog is not sent)", /isTT\?\{noHistory:true,kind:"tabletalk"\}:undefined/.test(_game));
  _ttReq("TT response runs cleanTxt (#74 (1): raw tags used to render verbatim)", /var ttClean=\(typeof cleanTxt==="function"\)\?cleanTxt\(resp\)/.test(_game));
  _ttReq("TT failure retries AS TT, not through retryLast", /isTT\?function\(\)\{sendAction\(txt,\{ttRetry:true\}\);\}:function\(\)\{retryLast\(\);\}/.test(_game));
  _ttReq("opts.ttRetry forces the TT path regardless of the active tab", /var isTT=\(opts&&opts\.ttRetry\)\?true:\(activeChatTab==="tabletalk"\)/.test(_game));
  // commitGmTurn is what runs applyMuts + logs the GM entry + advances the turn.
  var _bodyT = _game.slice(_game.indexOf("async function sendAction"), _game.indexOf("function retryLast"));
  var _iIf = _bodyT.indexOf("if(isTT){"), _iElse = _bodyT.indexOf("else{", _iIf), _iCommit = _bodyT.indexOf("commitGmTurn(resp");
  _ttReq("commitGmTurn sits in the ELSE of if(isTT) — TT can never reach it", _iIf > 0 && _iElse > _iIf && _iCommit > _iElse);
  _ttReq("commitGmTurn called exactly once in sendAction", (_bodyT.match(/commitGmTurn\(/g) || []).length === 1);
  // The TT log is TT's alone — if a prompt builder ever reads it, TT chatter reaches the GM.
  var _apiT = _fsT.readFileSync(_pathT.join(_rootT, "api.js"), "utf8");
  _ttReq("buildSysPrompt/api.js has zero Table Talk references", !/ttLog|buildTableTalkPrompt/.test(_apiT));
  _ttReq("ttLog is written in game.js exactly once and read nowhere else", (_game.match(/ttLog/g) || []).length === 1);
  // #76 (2): the never-infer rule is general. A date/calendar branch would both special-case it
  // and rot the moment TODO #73 lands a real campaign clock.
  var _ttSrc = _fsT.readFileSync(_pathT.join(_rootT, "table-talk.js"), "utf8");
  var _ttCode = _ttSrc.replace(/^\s*\/\/.*$/gm, ""); // strip comments — the rationale MAY say "solstice"
  _ttReq("table-talk.js has NO date/solstice special-case branch (#73 must land with zero changes here)",
    !/if\s*\([^)]*\b(solstice|calendar|days?\s*(to|until))\b/i.test(_ttCode));
  if (_ttFail.length) {
    console.error("TABLE TALK ISOLATION BROKEN (#76) — Table Talk could now influence gameplay:");
    _ttFail.forEach(function (f) { console.error("  - " + f); });
    process.exit(1);
  }
} catch (e) { console.error("TT ISOLATION CHECK FAILED: " + e.message); process.exit(1); }

// Exit 0 = ALL GREEN; exit 1 = failures (blocks the commit via .git/hooks/pre-commit).
//   node dev/run-tests.js                     — full suite
//   node dev/run-tests.js <section-substring> — #20: run only sections whose name contains
//     the substring (case-insensitive), e.g. `node dev/run-tests.js quest`. Reporter-level
//     filter — engine-tests.js is untouched; t() no-ops outside matching sections.
// The suites are DOM-free by design (see engine-tests.js), so no browser or jsdom is needed.
var fs=require("fs");
var path=require("path");
var engine=require("./load-engine.js");
try{engine.loadEngine();}
catch(e){console.error(e.message);process.exit(1);}
var geval=eval; // indirect eval → global scope (same loader convention as load-engine.js)
geval(fs.readFileSync(path.join(__dirname,"engine-tests.js"),"utf8"));

var filterRaw=process.argv[2]||"";
var filter=filterRaw.toLowerCase();
var pass=0,fails=[];
var curSection="",sectionOn=!filter,matchedSections=0;
runEngineTests({
  section:function(name){
    curSection=name;
    sectionOn=!filter||name.toLowerCase().indexOf(filter)!==-1;
    if(filter&&sectionOn)matchedSections++;
  },
  t:function(name,fn){
    if(!sectionOn)return; // #20 section filter — skipped sections never execute
    var label=curSection+" › "+name;
    try{
      var r=fn();
      if(r===true||r===undefined)pass++;
      else fails.push(label+" — "+r);
    }catch(e){fails.push(label+" — threw: "+e.message);}
  }
});
if(filter&&matchedSections===0){
  console.error("FILTER \""+filterRaw+"\" matched 0 sections — NOTHING ran (typo?). Remove the argument for the full suite.");
  process.exit(1);
}
if(fails.length){
  console.error("ENGINE TESTS FAILED ("+fails.length+" of "+(pass+fails.length)+"):");
  for(var f=0;f<fails.length;f++)console.error("  ✗ "+fails[f]);
  console.error("Open test.html in a browser for the full red/green view.");
  process.exit(1);
}
if(filter){
  console.log("FILTERED GREEN — \""+filterRaw+"\": "+matchedSections+" section(s) matched, "+pass+" assertions passed — NOT the full suite");
}else{
  console.log("ALL GREEN — "+pass+" assertions passed (engine tests)");
}
process.exit(0);
