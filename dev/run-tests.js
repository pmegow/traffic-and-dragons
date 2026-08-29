// run-tests.js — headless runner for the test.html suites (DEV TOOL, not loaded by index.html).
// Evals the REAL engine files in load order (via dev/load-engine.js — the canonical list,
// AUDIT_FABLE_07_16_2026 #18), then dev/engine-tests.js, and reports to the console.
// T&D vendor-patch tripwire (v1.322): the session-cache patch in vendor/piper/vits/vits-web.js
// is what keeps iOS Safari from being killed by per-sentence InferenceSession creation. A
// re-vendor that drops it resurrects the crash SILENTLY — fail the suite instead.
try {
  var _enforcement = require("./check-enforcement.js");
  var _enforcementProblems = _enforcement.realProblems(require("path").join(__dirname, ".."));
  if (_enforcementProblems.length) {
    console.error("VERIFICATION ENFORCEMENT CONTRACT FAILED:\n  - " + _enforcementProblems.join("\n  - "));
    process.exit(1);
  }
} catch (e) {
  console.error("VERIFICATION ENFORCEMENT CONTRACT FAILED: " + e.message);
  process.exit(1);
}
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

// ── NARRATION-PERSON RETIREMENT CONTRACT (#172, v1.605) ──────────────────────────────────
// Field report 2026-08-12: "the current campaign seems stuck in 3rd person." The multiplayer-exit
// correction (worldState.mpEnded) was retired by a TURN COUNTER in commitGmTurn — three turns after
// the demote, whether or not the GM had ever switched back. Miss that window and the correction was
// gone permanently, and single-player has no other end-of-prompt person instruction at all, so
// nothing could ever ask again. Retirement must be COMPLIANCE-boxed (personDriftDetect clears it
// when a response actually narrates in second person), never time-boxed.
// A SOURCE CONTRACT because the regression lives in commitGmTurn, which needs the DOM and cannot be
// driven headless — the behavioural half is the #172 engine tests.
try {
  var _fsN = require("fs"), _pathN = require("path");
  var _gameN = _fsN.readFileSync(_pathN.join(__dirname, "..", "game.js"), "utf8")
    .replace(/\/\/[^\n]*/g, "").replace(/\/\*[\s\S]*?\*\//g, "");   // strip comments: the fix DOCUMENTS the old counter
  if (/mpEnded\s*&&\s*\([^)]*turn[^)]*\)\s*>=/.test(_gameN) || /mpEnded\.turn\s*\)\s*>=\s*\d/.test(_gameN)) {
    console.error("NARRATION PERSON CONTRACT: game.js retires worldState.mpEnded on a TURN COUNT again. That is the #172 bug — a GM that has not switched back to second person loses the correction forever, and single-player carries no other person instruction. Retire it in personDriftDetect on observed compliance instead.");
    process.exit(1);
  }
  if (_gameN.indexOf("personDriftDetect(") < 0) {
    console.error("NARRATION PERSON CONTRACT: nothing calls personDriftDetect — the narration-person watcher is unwired, so third-person drift is undetectable again (#172).");
    process.exit(1);
  }
} catch (e) {
  console.error("NARRATION PERSON CONTRACT: could not verify game.js — " + (e && e.message));
  process.exit(1);
}

// ── #264 REVIEW-CALL WHITELIST CONTRACT (owner ruling 2026-08-28) ────────────────────────
// The two review-call sites MUST pass the whitelist and syncCharSheet MUST NOT — a future edit
// that drops the opts (or "helpfully" adds them to sheet sync) silently reopens the full
// 57-handler blast radius (or breaks sheet correction). Source contract because the failure is
// a one-argument deletion nothing behavioural exercises without a live model hallucinating.
try {
  var _rwFs = require("fs"), _rwPath = require("path");
  var _rwGame = _rwFs.readFileSync(_rwPath.join(__dirname, "..", "game.js"), "utf8");
  var _rwFail = [];
  var _rwDefine = _rwGame.slice(_rwGame.indexOf("async function defineItemFromStory"), _rwGame.indexOf("async function suggestQuestCompletion"));
  var _rwSuggest = _rwGame.slice(_rwGame.indexOf("async function suggestQuestCompletion"), _rwGame.indexOf("function invDiffLines"));
  var _rwSync = _rwGame.slice(_rwGame.indexOf("async function syncCharSheet"));
  if (_rwDefine.indexOf("applyMuts(resp,{allow:REVIEW_CALL_TAGS})") < 0) _rwFail.push("defineItemFromStory no longer passes {allow:REVIEW_CALL_TAGS} — a Define hallucination can mutate anything again");
  if (_rwSuggest.indexOf("applyMuts(resp,{allow:REVIEW_CALL_TAGS})") < 0) _rwFail.push("suggestQuestCompletion no longer passes {allow:REVIEW_CALL_TAGS} — a review click can fire the arc-wall sweep again");
  if (_rwSync.indexOf("allow:REVIEW_CALL_TAGS") >= 0) _rwFail.push("syncCharSheet gained the whitelist — broad correction is its explicit job (owner ruling 2026-08-28)");
  if (_rwFail.length) {
    console.error("REVIEW-CALL WHITELIST CONTRACT BROKEN (#264):");
    _rwFail.forEach(function (m) { console.error("  - " + m); });
    process.exitCode = 1;
  } else console.log("[#264] review-call whitelist contract OK — both review sites gated, sheet sync ungated");
} catch (_rwE) { console.error("REVIEW-CALL WHITELIST CONTRACT could not run: " + (_rwE && _rwE.message)); process.exitCode = 1; }

// ── REFUSAL COPY CONTRACT (#213, v1.698) ────────────────────────────
// The two W2 withhold toasts ship to PLAYERS (owner ruling 2026-08-22) and must say why in
// language a player owns. A SOURCE CONTRACT because the failure is silent: add a refusal reason
// in identity.js, forget its player sentence, and the toast quietly degrades to the generic
// fallback with nothing red anywhere. This asserts the registry and the code still agree.
try {
  var _rcFs = require("fs"), _rcPath = require("path");
  var _rcSrc = _rcFs.readFileSync(_rcPath.join(__dirname, "..", "identity.js"), "utf8");
  var _rcApi = _rcFs.readFileSync(_rcPath.join(__dirname, "..", "api.js"), "utf8");
  var _rcCensus = require("./refusal-copy-census.js");
  global.__refusalCopyCensusForTests = _rcCensus;
  var _rcReport = _rcCensus.census(_rcSrc, _rcApi);
  if (!_rcReport.registry.length) {
    console.error("REFUSAL COPY CONTRACT: W2_REFUSAL_REASONS is gone from identity.js \u2014 the shipped-reason registry the coverage guard reads no longer exists (#213).");
    process.exitCode = 1;
  } else {
    if (_rcReport.registry.length < 20) {
      console.error("REFUSAL COPY CONTRACT: the shipped-reason registry shrank to " + _rcReport.registry.length + " entries \u2014 reasons deleted from the registry rather than from the code is how coverage goes quietly missing (#213).");
      process.exitCode = 1;
    }
    /* #275 merge (Lane E's clause exposed this): the census COMPUTES the unmapped-reason list and
       this contract never read it \u2014 a brand-new refusal reason with no player copy sailed through,
       the exact silent degrade #213 exists to catch. */
    if (_rcReport.missing && _rcReport.missing.length) {
      console.error("REFUSAL COPY CONTRACT: identity.js refuses with reason(s) the shipped registry does not carry \u2014 " + _rcReport.missing.join(" | ") + " (#213: add the reason to W2_REFUSAL_REASONS and its player sentence to W2_REFUSAL_COPY).");
      process.exitCode = 1;
    }
    if (!process.exitCode) console.log("[#213] refusal-copy census OK \u2014 " + _rcReport.registry.length + " registry rows, " + _rcReport.reasons.length + " shipped reasons, 0 unmapped");
  }
} catch (e) {
  console.error("REFUSAL COPY CONTRACT: could not verify identity.js/api.js \u2014 " + (e && e.message));
  process.exitCode = 1;
}

// ── TRANSCRIPT MUTATION SEAM CONTRACT (#177, v1.615) ─────────────────────────────────────
// Entry-4 ★: the compression memo keys on (array ref, length, last-entry ref, last-entry .x),
// so an in-place field edit on an OLD transcript entry is invisible to it — a mutation site
// that forgets to invalidate silently persists AND syncs a stale compressed blob. The fix is
// structural: state.js owns mutateTranscriptEntry(tr,i,fn), and every other shipped file is
// FORBIDDEN from writing transcript-entry fields directly. Known limit, stated honestly: an
// ALIASED write (var e=tr[i]; e.x=…) is invisible to this scan — the behavioural #177 engine
// tests are the deeper guard; this contract kills the greppable class.
try {
  var _fsT = require("fs"), _pathT = require("path");
  var _trRe = /transcript\[[^\]]*\]\s*\.\s*[A-Za-z_$][\w$]*\s*=[^=]/;
  // self-sabotage check: the clause must be ABLE to fail (a green guard that can't is worse than none)
  if (!_trRe.test('worldState.transcript[i].x = "boom";') || _trRe.test('if(a===transcript[i].x)b();')) {
    console.error("TRANSCRIPT SEAM CONTRACT: the scan regex no longer catches its own violation fixture — the clause is vacuous.");
    process.exit(1);
  }
  var _rootT = _pathT.join(__dirname, "..");
  _fsT.readdirSync(_rootT).forEach(function (f) {
    if (!/\.js$/.test(f) || f === "state.js") return;
    var body = _fsT.readFileSync(_pathT.join(_rootT, f), "utf8")
      .replace(/\/\/[^\n]*/g, "").replace(/\/\*[\s\S]*?\*\//g, "");
    var m = body.match(_trRe);
    if (m) {
      console.error("TRANSCRIPT SEAM CONTRACT: " + f + " writes a transcript-entry field directly (“" + m[0].trim() + "”). Route it through mutateTranscriptEntry (state.js) so memo invalidation is owned by the seam — a bypassed write persists a stale compressed blob at BOTH the save and sync exits (#177).");
      process.exit(1);
    }
  });
  var _memT = _fsT.readFileSync(_pathT.join(_rootT, "memory.js"), "utf8");
  if (_memT.indexOf("#177 SANCTIONED SEAM BYPASS") < 0) {
    console.error("TRANSCRIPT SEAM CONTRACT: memory.js lost the '#177 SANCTIONED SEAM BYPASS' marker documenting the one sanctioned aliased write (the RAG lazy .e backfill). If the backfill moved or was rewired, update the seam docs and this contract together.");
    process.exit(1);
  }
} catch (e) {
  console.error("TRANSCRIPT SEAM CONTRACT: could not verify — " + (e && e.message));
  process.exit(1);
}

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
  //    creeps back into a single call site nobody re-audits. v1.462 (Fable review entry 7): the
  //    net also catches indexOf and single-quoted variants — the old regex only saw the exact
  //    double-quoted split/lastIndexOf spellings, so a dodge-by-spelling passed silently.
  var _splits = (_nc(_tts).match(/\.split\(["']#["']\)|lastIndexOf\(["']#["']\)|(?:[^t]|^)indexOf\(["']#["']\)/g) || []).length;
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

// ── #144A ARCHIVE CARRY CONTRACT (drift pass order 1, 2026-08-08) ────────────────────────
// NPC knowledge was the ONE memory tier evicting canon to the void (83 facts destroyed
// t1265→t1549, longitudinally proven). The engine tests pin the archive behavior; these
// clauses pin the surfaces the DOM-free harness cannot execute: the .tnd import whitelist
// (ui-files.js) and the no-bare-shift discipline at the write sites.
try {
  var _fsAC = require("fs"), _pathAC = require("path");
  var _failAC = function (msg) { console.error("#144A ARCHIVE CARRY CONTRACT: " + msg); process.exit(1); };
  var _ufAC = _fsAC.readFileSync(_pathAC.join(__dirname, "..", "ui-files.js"), "utf8");
  // ① the import carries the FULL archive — and does so BY REGISTRY, never by hand-copied key
  //   list. This clause used to repeat the whitelist verbatim, which is exactly why the loss
  //   shipped green four times (the test and the code drifted together). JP0-5: the import must
  //   route through archiveRebuild, ui-files.js must hold NO archive key list of its own, and the
  //   registry in state.js must still cover every category (round-trip behavior, unknown-key
  //   carry and per-consumer agreement are proven by the engine suite's "memory.archive key
  //   registry (JP0-5)" section).
  if (!/archive:archiveRebuild\(mm\.archive\)/.test(_ufAC))
    _failAC("the .tnd import no longer rebuilds its archive through archiveRebuild — a hand-rolled rebuild is how this key list dropped a category four separate times");
  if (/mm\.archive\.[A-Za-z_$]/.test(_ufAC))
    _failAC("ui-files.js enumerates archive categories by hand again (mm.archive.<key>) — the registry in state.js is the only list");
  var _stAC = _fsAC.readFileSync(_pathAC.join(__dirname, "..", "state.js"), "utf8");
  var _regAC = (_stAC.match(/var MEMORY_ARCHIVE_KEYS=(\[[^\]]*\]);/) || [])[1];
  if (!_regAC) _failAC("MEMORY_ARCHIVE_KEYS is gone from state.js — there is no registry to derive from");
  var _keysAC = JSON.parse(_regAC);
  var _needAC = ["lore", "decisions", "chapters", "superseded", "coreMemories", "expiredSchedules", "npcKnowledge", "npcEvents", "retconPins", "locationStates", "futureEvents", "npcForgotten", "identityMerges", "identityQuarantines", "relDowngrades", "npcDeathCorrections"];/* every category a shipped writer produces; #168 W6 receipts + merge pre-images + the #169 death-retraction pre-images all live in here */
  for (var _kAC = 0; _kAC < _needAC.length; _kAC++) {
    if (_keysAC.indexOf(_needAC[_kAC]) < 0)
      _failAC("MEMORY_ARCHIVE_KEYS dropped archive." + _needAC[_kAC] + " — it loses its blank-shape default and its array guard (carry-unknown still saves the DATA, which is the point of the carry)");
  }
  // ② every consumer derives from the registry — a site that re-grows its own list is the class.
  if (!/archive:blankArchive\(\)/.test(_stAC)) _failAC("blankMemory no longer builds its archive from the registry");
  if (!/memory\.archive=archiveHeal\(memory\.archive\)/.test(_stAC)) _failAC("healMemory no longer heals its archive through the registry");
  var _mmAC = _fsAC.readFileSync(_pathAC.join(__dirname, "..", "memory.js"), "utf8");
  if (!/function memArchive\(\)\{memory\.archive=archiveHeal\(memory\.archive\);/.test(_mmAC))
    _failAC("memArchive no longer lazy-inits through the registry — it had its own drifted list before JP0-5");
  // ③ the carry is the actual class-closer: archiveRebuild must pass unregistered categories
  //   through rather than filtering to the known set.
  var _arAC = (_stAC.match(/function archiveRebuild\([\s\S]*?\n\}/) || [""])[0];
  if (!_arAC) _failAC("archiveRebuild is gone from state.js");
  if (_arAC.indexOf("else out[k]=src[k];") < 0)
    _failAC("archiveRebuild no longer carries UNKNOWN archive categories through — that carry, not the key list, is what closes this defect class");
  // ② no bare knowledge.shift() — every shrink must feed memArchive().npcKnowledge. #269 widened
  //   the scan to tag_table.js: the NPC_SUPERSEDE handler's cap shift was the one knowledge write
  //   still shedding to the void (it predated #144A and the scan never looked there).
  var _memAC = _fsAC.readFileSync(_pathAC.join(__dirname, "..", "memory.js"), "utf8");
  var _ttAC = _fsAC.readFileSync(_pathAC.join(__dirname, "..", "tag_table.js"), "utf8");
  var _srcsAC = [["memory.js", _memAC], ["tag_table.js", _ttAC]], _siAC;
  for (_siAC = 0; _siAC < _srcsAC.length; _siAC++) {
    var _shAC = /knowledge\.shift\(\)/g, _mAC, _bareAC = 0, _bodyAC = _srcsAC[_siAC][1];
    while ((_mAC = _shAC.exec(_bodyAC))) {
      if (_bodyAC.slice(Math.max(0, _mAC.index - 80), _mAC.index).indexOf("npcKnowledge.push") < 0) _bareAC++;
    }
    if (_bareAC) _failAC(_bareAC + " bare knowledge.shift() in " + _srcsAC[_siAC][0] + " — an eviction path shed to the void again");
  }
  // #269①: ALL knowledge filing routes through fileNpcKnowledge — the three exact-indexOf sites
  //   (summary extract, summary supersede, the NPC_SUPERSEDE tag) each grew their own dedupe and
  //   drifted; the helper owns exact-dup, the near-dup fold (loser ARCHIVED with foldedInto),
  //   and the #144A cap eviction. Supersession sites must pass preferNew=true — richer-wins
  //   there would let a verbose stale claim beat the reveal that retires it.
  if (!/function fileNpcKnowledge\(/.test(_memAC))
    _failAC("fileNpcKnowledge is gone from memory.js — the one knowledge-filing path (#269)");
  var _fnkAC = (_memAC.match(/function fileNpcKnowledge\([\s\S]*?\n\}/) || [""])[0];
  if (_fnkAC.indexOf("foldedInto:") < 0)
    _failAC("fileNpcKnowledge's fold no longer archives the losing fact with its winner named (#269) — a wrong fold on distinct facts becomes unrecoverable");
  if (_memAC.indexOf("fileNpcKnowledge(sfName,newFact,worldState.turn,true)") < 0)
    _failAC("summary supersession no longer files through fileNpcKnowledge in preferNew mode (#269/#144A)");
  if (_memAC.indexOf("fileNpcKnowledge(nuName,_kgFact,worldState.turn,false)") < 0)
    _failAC("summary knowledge filing no longer routes through fileNpcKnowledge (#269/#144A)");
  if (_ttAC.indexOf("fileNpcKnowledge(spName,spNew,R.turn,true)") < 0)
    _failAC("the NPC_SUPERSEDE handler no longer files through fileNpcKnowledge in preferNew mode (#269) — its old cap shift went to the VOID");
  if (_memAC.indexOf("memArchive().npcEvents.push({npc:name,note:_evD[_evi].note,turn:_evD[_evi].turn})") < 0)
    _failAC("fileNpcEvent no longer archives evicted events");
  if (_ttAC.indexOf("memArchive().npcKnowledge.push({npc:mgCanon,fact:mgOv[mgOvi],turn:worldState.turn})") < 0)
    _failAC("the NPC_MERGE truncation no longer archives its overflow");
  // #144B: the extractor schema must keep teaching the durable/scene kind — losing it reverts
  // every new fact to the untyped stale-posture class.
  if (_memAC.indexOf("scene facts are filed as dated history") < 0) _failAC("the extraction schema no longer teaches the durable/scene kind (#144B)");
  // ③ #235: the quest archive rides WHOLESALE. by/wasOffered are additive provenance fields on
  //   memory.quests records; a field-by-field rebuild here would drop them on every .tnd import —
  //   the exact class this contract exists for (attitudeSpec, eras, the #144A trio, the death
  //   corrections). The engine half of the round-trip is engine-tested; this pins the DOM surface.
  if (_ufAC.indexOf("quests:mm.quests||{}") < 0)
    _failAC("the .tnd import no longer carries memory.quests wholesale — #235 by/wasOffered provenance would be dropped on every round-trip");
  // ④ #235: the Quest Journal's History label routes through the one pure renderer, so a
  //   wall-swept thread can never render as the player's own drop.
  var _umAC = _fsAC.readFileSync(_pathAC.join(__dirname, "..", "ui-modals.js"), "utf8");
  if (_umAC.indexOf("questArchiveWording(aq).label") < 0)
    _failAC("the Quest Journal History line no longer renders abandoned records through questArchiveWording (#235) — all three authors read as one lie again");
} catch (eAC) { console.error("#144A ARCHIVE CARRY CONTRACT: " + (eAC && eAC.message)); process.exit(1); }

// ── JP0-4 CORRUPT-STORE RESCUE CONTRACT (joint review 2026-08-27, Sol P0-02) ─────────────
// A corrupt sessionLog/memory key used to become []/blankMemory() SILENTLY, and the next save
// persisted the blank over the only recoverable bytes. The engine suite proves the rescue
// behavior; these clauses pin the two things it structurally cannot see — that both degrade
// paths still route through the rescue, and that no shipped file ever deletes a rescue key
// (the recovery flow that legitimately clears one does not exist yet: when it lands, this
// clause is the deliberate speed bump that makes the deletion a decision, not a drive-by).
try {
  var _fsSR = require("fs"), _pathSR = require("path");
  var _failSR = function (msg) { console.error("JP0-4 CORRUPT-STORE RESCUE CONTRACT: " + msg); process.exit(1); };
  var _ROOTSR = _pathSR.join(__dirname, "..");
  var _stSR = _fsSR.readFileSync(_pathSR.join(_ROOTSR, "state.js"), "utf8");
  // ① both loadState catch arms preserve before they degrade — a bare `sessionLog=[]` /
  //    `memory=blankMemory()` catch is exactly the defect this row closed.
  if (!/catch\(e\)\{rescueCorruptStore\("sess",sl,e\);sessionLog=\[\];\}/.test(_stSR))
    _failSR("the sessionLog catch arm no longer rescues before degrading — a corrupt session log is silently blanked again");
  if (!/catch\(e\)\{rescueCorruptStore\("mem",mm,e\);memory=blankMemory\(\);\}/.test(_stSR))
    _failSR("the memory catch arm no longer rescues before degrading — a corrupt long-term memory is silently blanked again");
  // ② the degrade is LOUD on both channels, and the toast names the tier (a generic "load
  //    failed" leaves the player unable to tell which half of their recall went missing).
  var _rcSR = (_stSR.match(/function rescueCorruptStore\([\s\S]*?\n\}/) || [""])[0];
  if (!_rcSR) _failSR("rescueCorruptStore is gone from state.js");
  if (!/if\(typeof console!=="undefined"\)console\.error\(/.test(_rcSR))
    _failSR("rescueCorruptStore no longer console.errors behind the node guard — the degrade went silent on the developer channel");
  if (!/if\(typeof showToast==="function"\)showToast\(/.test(_rcSR))
    _failSR("rescueCorruptStore no longer raises a typeof-guarded toast — the degrade went silent on the player channel");
  if (_rcSR.indexOf("session log") < 0 || _rcSR.indexOf("long-term memory") < 0)
    _failSR("rescueCorruptStore no longer names the degraded tier — the player cannot tell which recall layer was lost");
  // ③ nothing in the shipped app deletes a rescue key.
  var _shipSR = _fsSR.readdirSync(_ROOTSR).filter(function (f) { return /\.js$/.test(f); });
  if (_shipSR.indexOf("state.js") < 0) _failSR("the shipped-file scan found no state.js — the scan is broken, not the code");
  for (var _iSR = 0; _iSR < _shipSR.length; _iSR++) {
    var _srcSR = _fsSR.readFileSync(_pathSR.join(_ROOTSR, _shipSR[_iSR]), "utf8");
    if (/store\.del\(\s*STORE_RESCUE_K/.test(_srcSR))
      _failSR(_shipSR[_iSR] + " deletes a store-rescue key — the preserved bytes are the ONLY copy until a recovery flow ships");
  }
} catch (eSR) { console.error("JP0-4 CORRUPT-STORE RESCUE CONTRACT: " + (eSR && eSR.message)); process.exit(1); }

// ── #151 LATCH REGISTRY CONTRACT (drift pass order 7, 2026-08-08) ────────────────────────
// Every worldState key the NOTE_BUILDERS region writes must be declared in NOTE_LATCH_FIELDS,
// or a failed turn silently burns that builder's latch (the class this pass closed). The census
// re-runs the same write-scan on every build — a NEW builder stamping an undeclared key fails
// here, so the registry cannot rot. Also pins the sendAction wiring the DOM-free harness
// exercises only piecewise.
try {
  var _fsLR = require("fs"), _pathLR = require("path");
  var _failLR = function (msg) { console.error("#151 LATCH REGISTRY CONTRACT: " + msg); process.exit(1); };
  var _apiLR = _fsLR.readFileSync(_pathLR.join(__dirname, "..", "api.js"), "utf8");
  // TWO builder regions: the #147/#149/#150 builders live before buildCoreMemoryBlock, the
  // original registry cluster before NOTE_BUILDERS. The first sabotage run proved a one-region
  // census misses the new cluster entirely (the write landed, nothing tripped) — census both.
  var _b0 = _apiLR.indexOf("function buildQuestEscalation"), _b1 = _apiLR.indexOf("var NOTE_BUILDERS=");
  var _c0 = _apiLR.indexOf("function buildExpiredThreadNudge"), _c1 = _apiLR.indexOf("function buildCoreMemoryBlock");
  if (_b0 < 0 || _b1 < 0 || _b1 <= _b0 || _c0 < 0 || _c1 < 0 || _c1 <= _c0) _failLR("builder-region anchors moved — re-point the census");
  var _segLR = _apiLR.slice(_b0, _b1) + "\n" + _apiLR.slice(_c0, _c1);
  var _declM = _segLR.match(/var NOTE_LATCH_FIELDS=\[([^\]]*)\]/);
  if (!_declM) _failLR("NOTE_LATCH_FIELDS is gone from the builder region");
  var _decl = {}; _declM[1].split(",").forEach(function (k) { k = k.replace(/["'\s]/g, ""); if (k) _decl[k] = 1; });
  var _wLR = {}, _mLR, _reLR = /worldState\.([A-Za-z_$][A-Za-z0-9_$]*)\s*=[^=]/g;
  while ((_mLR = _reLR.exec(_segLR))) _wLR[_mLR[1]] = 1;
  var _rdLR = /delete worldState\.([A-Za-z_$][A-Za-z0-9_$]*)/g;
  while ((_mLR = _rdLR.exec(_segLR))) _wLR[_mLR[1]] = 1;
  var _undecl = Object.keys(_wLR).filter(function (k) { return !_decl[k]; });
  if (_undecl.length) _failLR("builder region writes UNDECLARED worldState key(s): " + _undecl.join(", ") + " — add them to NOTE_LATCH_FIELDS or a failed turn burns that latch");
  var _gmLR = _fsLR.readFileSync(_pathLR.join(__dirname, "..", "game.js"), "utf8");
  var _snapAt = _gmLR.indexOf("snapshotNoteLatches()"), _notesAt = _gmLR.indexOf("buildEngineNotes()");
  if (_snapAt < 0 || _notesAt < 0 || _snapAt > _notesAt) _failLR("sendAction no longer snapshots BEFORE buildEngineNotes");
  if (!/if\(!_committed&&typeof _latchSnap!=="undefined"&&_latchSnap[^\n]*restoreNoteLatches\(_latchSnap\)/.test(_gmLR)) _failLR("the pre-commit failure path no longer restores the latches");
} catch (eLR) { console.error("#151 LATCH REGISTRY CONTRACT: " + (eLR && eLR.message)); process.exit(1); }

// ── STARS PORTABILITY CONTRACT (#95.5/#95.8 — cloud-backed since v1.450) ─────────────────
// The star store is per-origin localStorage (the #95.4 star-origin field bug), so the CLOUD
// mirror is the only bridge across origins and devices. The file Export/Import pure slice
// (parseStarsImport/mergeStars, v1.443) was retired 2026-07-26 with the user's move to
// server-backed Push/Pull — the cloud protocol is whole-list LWW, nothing left to merge.
// These pin the wiring the DOM-free harness cannot execute.
try {
  var _fsSP = require("fs"), _pathSP = require("path");
  var _sbSP = _fsSP.readFileSync(_pathSP.join(__dirname, "..", "speaker_browser.html"), "utf8");
  var _failSP = function (msg) { console.error("STARS PORTABILITY CONTRACT: " + msg); process.exit(1); };
  // the manual buttons must exist and route through the shared cloud helpers
  if (_sbSP.indexOf('id="star-push"') < 0 || _sbSP.indexOf('id="star-pull"') < 0)
    _failSP("the Push/Pull cloud buttons are gone from the page (#95.8)");
  if (!/\$\("star-push"\)\.onclick = pushToCloud/.test(_sbSP) || !/\$\("star-pull"\)\.onclick = pullFromCloud/.test(_sbSP))
    _failSP("the Push/Pull buttons are no longer wired to pushToCloud/pullFromCloud (#95.8)");
  // #95.5 cloud-sync wiring: every edit mirrors, every boot pulls
  if (!/function saveStars\(\)[\s\S]{0,400}schedulePushStars\(\)/.test(_sbSP))
    _failSP("saveStars no longer schedules a cloud push — local edits silently stop mirroring (#95.5)");
  if (!/function saveGOv\(\)[\s\S]{0,400}schedulePushGOv\(\)/.test(_sbSP))
    _failSP("saveGOv no longer schedules a cloud push — gender fixes silently stop mirroring (#95.8)");
  var _bootSP = _sbSP.slice(_sbSP.indexOf("// ── Boot"));
  if (!/pullStarsOnBoot\(\)/.test(_bootSP) || !/pullGOvOnBoot\(\)/.test(_bootSP) || !/loadGOv\(\)/.test(_bootSP))
    _failSP("boot no longer loads/pulls the bench and gender fixes — other devices' edits never arrive (#95.5/#95.8)");
  var _saSP = _fsSP.readFileSync(_pathSP.join(__dirname, "..", "storage-adapter.js"), "utf8");
  if ((_saSP.match(/syncSpeakerStars\(null\)/g) || []).length < 2)
    _failSP("storage-adapter no longer syncs the star bench on BOTH boot (autoConnect) and fresh connect (onAuth) (#95.5)");
  // #95.7 adopt-path fix: EVERY cloud adopt must derive gender exactly like loadStars, or a pull
  // lands a g-less bench and the ⚥ selects read "?" until the next reload (the 2026-07-26
  // screenshot bug). There is ONE adopt path by design — pin the derivation inside it, and pin
  // both consumers (boot pull + manual pull) onto it.
  var _adoptSP = (_sbSP.match(/function adoptCloudStars\([\s\S]*?\n  \}\n/) || [""])[0];
  if (!/stars\.push\(\{ id: it\.id, label: lbl, g: starG\(/.test(_adoptSP))
    _failSP("adoptCloudStars no longer derives g via starG — a cloud pull lands a g-less bench (#95.7)");
  if (!/function pullStarsOnBoot\(\)[\s\S]{0,600}adoptCloudStars\(/.test(_sbSP))
    _failSP("the boot pull no longer routes through adoptCloudStars (#95.7)");
  if (!/function pullFromCloud\(\)[\s\S]{0,900}adoptCloudStars\(/.test(_sbSP))
    _failSP("the manual Pull no longer routes through adoptCloudStars (#95.7)");
  // #95.8 gender overrides: corrections sit ON TOP of published metadata at the ONE seam, and
  // the main-table control writes the override store (not the metadata)
  if (!/applyGenderOverrides\(st\);\s*\/\/ #95\.8/.test(_sbSP))
    _failSP("applyMetaInto no longer applies gender overrides — corrections vanish on every metadata load (#95.8)");
  if (!/_gOverrides\[key\] = gsel\.value/.test(_sbSP))
    _failSP("the main-table gender select no longer writes the override store (#95.8)");
  // v1.462 (Fable review entry 7, brief B): ① a cloud adopt must cancel any pending debounced
  // push — a queued pre-adopt edit re-PUTting after the adopt is one leg of the boot race that
  // can overwrite an established cloud bench; ② scheduled pushes must DEFER while a boot pull is
  // in flight (the other leg: an edit in the defaults-visible window lands its PUT before the
  // GET resolves and replaces a rev>0 cloud bench with the defaults); ③ a main-table gender
  // correction must reach an already-starred voice's OWN g field — the star's g is the only
  // channel to the game's auto-cast, so without propagation the fix shows in the tally while
  // casting keeps the stale gender.
  if (!/function adoptCloudStars\([\s\S]{0,260}_pushTimer/.test(_sbSP))
    _failSP("adoptCloudStars no longer cancels a pending debounced push — a queued pre-adopt edit would re-PUT over the adopted bench (v1.462)");
  if (!/function adoptCloudGOv\([\s\S]{0,260}_govTimer/.test(_sbSP))
    _failSP("adoptCloudGOv no longer cancels a pending debounced push (v1.462)");
  if (!/_bootPull/.test(_sbSP) || !/function schedulePushStars\(\)[\s\S]{0,200}_bootPull/.test(_sbSP))
    _failSP("the boot-pull push deferral is gone — an edit in the defaults-visible window can PUT over a live cloud bench before the boot pull resolves (v1.462)");
  if (!/_gOverrides\[key\] = gsel\.value[\s\S]{0,700}stars\[[A-Za-z0-9_]+\]\.g/.test(_sbSP))
    _failSP("the main-table gender select no longer propagates to a starred row's g — auto-casting keeps the stale gender (v1.462)");
  // ── DEFAULT BENCH CONTRACT (#95.6) ── the starter cast is duplicated in tts.js and
  // speaker_browser.html (the satellite is self-contained — no shared file possible), so the two
  // copies MUST stay byte-identical or new players see different benches in the game vs the browser.
  var _ttsSP = _fsSP.readFileSync(_pathSP.join(__dirname, "..", "tts.js"), "utf8");
  var _benchRe = /\/\/ >>> DEFAULT STAR BENCH[\s\S]*?\/\/ <<< DEFAULT STAR BENCH/;
  var _bTts = _ttsSP.match(_benchRe), _bSb = _sbSP.match(_benchRe);
  if (!_bTts || !_bSb) _failSP("DEFAULT STAR BENCH markers missing (tts.js: " + !!_bTts + ", speaker_browser: " + !!_bSb + ")");
  var _benchOf = function (slice) {
    return new Function(slice + "\nreturn (typeof DEFAULT_SPEAKER_STARS !== 'undefined') ? DEFAULT_SPEAKER_STARS : DEFAULT_STARS;")();
  };
  var _dTts = _benchOf(_bTts[0]), _dSb = _benchOf(_bSb[0]);
  if (JSON.stringify(_dTts) !== JSON.stringify(_dSb))
    _failSP("the two DEFAULT STAR BENCH copies have drifted apart (tts.js: " + _dTts.length + " entries, speaker_browser.html: " + _dSb.length + ") — edit both or new players see different benches");
  if (_dTts.length < 10) _failSP("the default bench shrank to " + _dTts.length + " entries — suspicious, confirm intentional");
  for (var _bi = 0; _bi < _dTts.length; _bi++) {
    if (!/^[A-Za-z0-9_-]+#\d+$/.test(_dTts[_bi].id) || typeof _dTts[_bi].label !== "string" || !_dTts[_bi].label)
      _failSP("default bench entry " + _bi + " malformed: " + JSON.stringify(_dTts[_bi]));
    // #95.7: every curated default is gendered — auto-casting can draw from the whole starter set
    if (_dTts[_bi].g !== "M" && _dTts[_bi].g !== "F")
      _failSP("default bench entry " + _bi + " has no gender — it would be dead weight for auto-casting: " + JSON.stringify(_dTts[_bi]));
  }
} catch (e) { console.error("STARS PORTABILITY CONTRACT CHECK FAILED: " + (e && e.message)); process.exit(1); }

// ── BIBLE EDITOR CONTRACT (#72, v1.464) ─────────────────────────────────────────────────
// class_bible.js is machine-REGENERATED by bible_editor.html's exporter; the serializer slice in
// that page is THE canonical writer of the file. Byte-compare its output for the on-disk data
// against the on-disk file (header included), so the page and the file can never silently
// disagree about the format — a hand edit that breaks canonical form fails the build here
// instead of being clobbered by the editor's next export. Line endings are normalized before
// the compare (the CRLF git-checkout class must not masquerade as format drift).
try {
  var _fsBE = require("fs"), _pathBE = require("path");
  var _failBE = function (msg) { console.error("BIBLE EDITOR CONTRACT: " + msg); process.exit(1); };
  var _bePage = _fsBE.readFileSync(_pathBE.join(__dirname, "..", "bible_editor.html"), "utf8");
  var _beFile = _fsBE.readFileSync(_pathBE.join(__dirname, "..", "class_bible.js"), "utf8").replace(/\r\n/g, "\n");
  var _serM = _bePage.match(/\/\/ >>> BIBLE SERIALIZER[\s\S]*?\/\/ <<< BIBLE SERIALIZER/);
  if (!_serM) _failBE("the serializer markers are gone from bible_editor.html");
  var _serialize = new Function(_serM[0] + "\nreturn serializeClassBible;")();
  var _beVals = new Function(_beFile + "\nreturn { b: CLASS_BIBLE, x: CLASS_XP_LEVELS };")();
  var _beOut = _serialize(_beVals.b, _beVals.x).replace(/\r\n/g, "\n");
  if (_beOut !== _beFile) {
    var _di = 0; while (_di < _beOut.length && _beOut[_di] === _beFile[_di]) _di++;
    _failBE("serialize(on-disk data) !== on-disk class_bible.js — first divergence at char " + _di +
      " (…" + JSON.stringify(_beFile.slice(Math.max(0, _di - 30), _di + 30)) + " vs …" +
      JSON.stringify(_beOut.slice(Math.max(0, _di - 30), _di + 30)) + "). Re-export from the editor, or align the serializer.");
  }
  // the editor is a satellite: it must never be reachable from the game's own UI surface
  if (_bePage.indexOf("id=\"bible-editor-link\"") >= 0) _failBE("unexpected in-game link marker");

  // The server-first authoring loop has one primary action: Save. These three legacy toolbar
  // controls exposed obsolete export/draft-management branches and made the normal path look
  // conditional. Pin both the visible controls and their DOM lookups so removing the markup
  // cannot leave a boot-time null dereference behind.
  if (_bePage.indexOf('id="download"') >= 0 || _bePage.indexOf('$("download")') >= 0)
    _failBE("toolbar still exposes the retired Download copy control");
  if (_bePage.indexOf('id="exp-adds"') >= 0 || _bePage.indexOf('$("exp-adds")') >= 0)
    _failBE("toolbar still exposes the retired Capability additions control");
  if (_bePage.indexOf('id="addn"') >= 0 || _bePage.indexOf('$("addn")') >= 0)
    _failBE("retired Capability additions counter is still wired");
  if (_bePage.indexOf('id="discard"') >= 0 || _bePage.indexOf('$("discard")') >= 0)
    _failBE("toolbar still exposes the retired Discard draft control");
  if (_bePage.indexOf('id="saveas"') >= 0 || _bePage.indexOf('$("saveas")') >= 0)
    _failBE("toolbar still exposes Save as — Bible Editor has one local project-file save path");

  // ── ITEM BIBLE half (#81, same discipline): item_bible.js is machine-regenerated wholesale ──
  var _biFile = _fsBE.readFileSync(_pathBE.join(__dirname, "..", "item_bible.js"), "utf8").replace(/\r\n/g, "\n");
  var _serItems = new Function(_serM[0] + "\nreturn serializeItemBible;")();
  var _biData = new Function(_biFile + "\nreturn ITEM_BIBLE;")();
  var _biOut = _serItems(_biData).replace(/\r\n/g, "\n");
  if (_biOut !== _biFile) {
    var _dj = 0; while (_dj < _biOut.length && _biOut[_dj] === _biFile[_dj]) _dj++;
    _failBE("serialize(on-disk data) !== on-disk item_bible.js — first divergence at char " + _dj +
      " (…" + JSON.stringify(_biFile.slice(Math.max(0, _dj - 30), _dj + 30)) + " vs …" +
      JSON.stringify(_biOut.slice(Math.max(0, _dj - 30), _dj + 30)) + "). Re-export from the editor, or align the serializer.");
  }
  // TYPE vs INSTANCE is a schema contract, not advice: an entry carrying instance fields
  // (charges/owner/provenance/count) or missing a fixed attribute fails the build here.
  // #157: the fixed set grew two DISPLAY fields — inventoryCategories (non-empty, unique valid
  // ids, includes category, serialized in registry order) and aliases (itemBaseName-normalized,
  // sorted, collision-free across keys and other entries). The scalar category contract is
  // untouched; unclassified is a UI safety state and may never be authored into the bible.
  var _biCats = { weapon: 1, armor: 1, consumable: 1, tool: 1, quest: 1, treasure: 1, mundane: 1 };
  var _biOrder = ["weapon", "armor", "quest", "consumable", "tool", "treasure", "mundane"];
  var _biAliasOwner = {};
  for (var _bk in _biData) {
    var _be2 = _biData[_bk], _bfs = Object.keys(_be2).sort().join(",");
    if (_bfs !== "aliases,category,effect,inventoryCategories,uses,value") _failBE("item '" + _bk + "' breaks the fixed attribute set (has: " + _bfs + ") — instance state never enters a TYPE definition, and #157's full shape is mandatory in the static bible");
    if (!_biCats[_be2.category]) _failBE("item '" + _bk + "' has unknown category '" + _be2.category + "'");
    var _bic = _be2.inventoryCategories;
    if (!(_bic instanceof Array) || !_bic.length) _failBE("item '" + _bk + "' inventoryCategories must be a non-empty array");
    if (_bic.indexOf(_be2.category) < 0) _failBE("item '" + _bk + "' inventoryCategories must include its primary category");
    var _bSeen = {}, _bLast = -1, _bi2;
    for (_bi2 = 0; _bi2 < _bic.length; _bi2++) {
      if (!_biCats[_bic[_bi2]]) _failBE("item '" + _bk + "' inventoryCategories carries unknown id '" + _bic[_bi2] + "'");
      if (_bSeen[_bic[_bi2]]) _failBE("item '" + _bk + "' inventoryCategories has a duplicate '" + _bic[_bi2] + "'");
      _bSeen[_bic[_bi2]] = 1;
      var _bPos = _biOrder.indexOf(_bic[_bi2]);
      if (_bPos < _bLast) _failBE("item '" + _bk + "' inventoryCategories is not in registry order — the editor serializes canonically, so this is a hand edit fighting it");
      _bLast = _bPos;
    }
    if (!(_be2.aliases instanceof Array)) _failBE("item '" + _bk + "' aliases must be an array");
    for (_bi2 = 0; _bi2 < _be2.aliases.length; _bi2++) {
      var _bal = _be2.aliases[_bi2];
      if (typeof _bal !== "string" || !_bal) _failBE("item '" + _bk + "' has an empty alias");
      if (_biData[_bal]) _failBE("item '" + _bk + "' alias '" + _bal + "' shadows a LIVE bible key — exact keys always win; merge instead");
      if (_biAliasOwner[_bal]) _failBE("alias '" + _bal + "' claimed by BOTH '" + _biAliasOwner[_bal] + "' and '" + _bk + "' — one alias, one owner");
      _biAliasOwner[_bal] = _bk;
    }
    for (var _bf in _be2) { if (_bf !== "inventoryCategories" && _bf !== "aliases" && typeof _be2[_bf] !== "string") _failBE("item '" + _bk + "." + _bf + "' is not a string"); }
    if (_bk !== _bk.toLowerCase()) _failBE("item key '" + _bk + "' is not lowercase — itemLookup can never resolve it");
  }
  // alias normalization needs the live itemBaseName — checked in the engine half via the #157
  // grouping battery; here the shape rules above are the load-bearing static contract.

  // ── #158 PHASE-DETECTOR WIRING CONTRACT ────────────────────────────────────────────────
  // The detector's engine half is battery-tested; what the DOM-free harness cannot execute is
  // the two GAME seams: commitGmTurn (the story-commit boundary — post-applyMuts, clean text)
  // and rerollLast (replacement narration applies NO tags, so the nudge is the only heal).
  // Losing either call silently re-opens the t1605 class on that path.
  var _gmSrc = _fsAC.readFileSync(_pathAC.join(__dirname, "..", "game.js"), "utf8");
  var _cgtBody = (_gmSrc.match(/function commitGmTurn[\s\S]*?\nfunction /) || [""])[0];
  var _rrlBody = (_gmSrc.match(/function rerollLast[\s\S]*?\nfunction /) || [""])[0];
  if (_cgtBody.indexOf("clockPhaseDetect(clean)") < 0) _failAC("#158: commitGmTurn no longer runs clockPhaseDetect on the committed clean prose — untagged phase narration goes unnoticed again");
  if (_rrlBody.indexOf("clockPhaseDetect(clean)") < 0) _failAC("#158: rerollLast no longer runs clockPhaseDetect — a re-rolled scene can assert a phase with no tag heal AND no detection");
  var _clkSrc = _fsAC.readFileSync(_pathAC.join(__dirname, "..", "clock.js"), "utf8");
  if (_clkSrc.indexOf("TIME_PHASES[i].re.source") < 0) _failAC("#158: the prose forms are no longer DERIVED from TIME_PHASES — two vocabularies will drift (the one-vocabulary rule)");

  // ── CAP VALIDATOR CONTRACT (v1.480) ──────────────────────────────────────────────────
  // The define form accepted anything until four real draft entries showed the cost: three were
  // category:["martial"] with isMagical:true (contradictory), and two were keyed with capitals,
  // which capabilityLookup can never find. Pin every clause, and sabotage-prove it: a validator
  // that never rejects reads as coverage while catching nothing.
  var _valM = _bePage.match(/\/\/ >>> CAP VALIDATOR[\s\S]*?\/\/ <<< CAP VALIDATOR/);
  if (!_valM) _failBE("the CAP VALIDATOR markers are gone from bible_editor.html");
  var _capIssues = new Function(_valM[0] + "\nreturn capIssues;")();
  var _okEntry = function (o) {
    var b = { kind: "ability", tier: 1, cost: "at-will", isMagical: false, category: ["martial"],
      range: "melee", targets: "1 creature", duration: "instantaneous", save: "N/A", dice: "N/A",
      effect: "A clean strike that lands where it hurts." };
    for (var k in (o || {})) b[k] = o[k];
    return b;
  };
  var _vCase = function (label, nm, patch, wantErr, wantWarn) {
    var r = _capIssues(nm, _okEntry(patch));
    if (!!r.errors.length !== wantErr) _failBE("cap validator: " + label + " — errors " + JSON.stringify(r.errors));
    if (wantWarn !== undefined && !!r.warns.length !== wantWarn) _failBE("cap validator: " + label + " — warns " + JSON.stringify(r.warns));
  };
  _vCase("a clean entry passes", "power strike", {}, false, false);
  _vCase("no category is rejected", "power strike", { category: [] }, true);
  _vCase("magical + martial-only is rejected", "power strike", { isMagical: true }, true);
  _vCase("magical + a real tradition passes", "power strike", { isMagical: true, category: ["arcane"] }, false);
  _vCase("martial + a magic tradition is rejected", "power strike", { isMagical: true, category: ["martial", "arcane"] }, true);
  _vCase("empty effect is rejected", "power strike", { effect: "   " }, true);
  _vCase("a capitalized key warns", "Power Strike", {}, false, true);
  _vCase("cost N/A warns", "power strike", { cost: "N/A" }, false, true);
  _vCase("dice in the prose but N/A in the field warns", "power strike", { effect: "Deals 2d6 fire." }, false, true);
  _vCase("dice in the prose WITH a dice field passes clean", "power strike", { effect: "Deals 2d6 fire.", dice: "2d6 fire" }, false, false);
  // the four real draft entries that filed this: every one must be caught
  if (!_capIssues("Fog Bank", _okEntry({ isMagical: true, category: ["martial"], cost: "N/A", effect: "Fills an area with thick fog obscuring vision." })).errors.length)
    _failBE("cap validator: the real 'Fog Bank' draft entry (magical+martial) was not caught");
  if (!_capIssues("Poisoner", _okEntry({ cost: "N/A", effect: "Creates potent poisons from common ingredients." })).warns.length)
    _failBE("cap validator: the real 'Poisoner' draft entry (capital key, cost N/A) raised nothing");

  // The category form has two mutually-exclusive groups: martial versus the four caster
  // traditions. Pin the pure selection rule in both directions, including the neutral racial
  // category and multi-tradition spells, then separately pin that capForm actually wires it.
  var _catM = _bePage.match(/\/\/ >>> CAP CATEGORY EXCLUSION[\s\S]*?\/\/ <<< CAP CATEGORY EXCLUSION/);
  if (!_catM) _failBE("the CAP CATEGORY EXCLUSION markers are gone from bible_editor.html");
  var _capCategorySelection = new Function(_catM[0] + "\nreturn capCategorySelection;")();
  var _catCase = function (label, current, changed, checked, want) {
    var got = _capCategorySelection(current, changed, checked);
    if (JSON.stringify(got) !== JSON.stringify(want))
      _failBE("cap category exclusion: " + label + " — got " + JSON.stringify(got) + ", want " + JSON.stringify(want));
  };
  _catCase("checking arcane clears martial", ["martial"], "arcane", true, ["arcane"]);
  _catCase("checking martial clears every magic tradition but preserves racial", ["arcane", "divine", "primal", "necromantic", "racial"], "martial", true, ["martial", "racial"]);
  _catCase("magic traditions may coexist", ["arcane"], "divine", true, ["arcane", "divine"]);
  _catCase("racial may coexist with martial", ["martial"], "racial", true, ["martial", "racial"]);
  _catCase("unchecking a category does not disturb the others", ["arcane", "divine"], "arcane", false, ["divine"]);
  var _capFormSrc = _bePage.slice(_bePage.indexOf("function capForm"), _bePage.indexOf("function closeModal"));
  if (_capFormSrc.indexOf('querySelectorAll(".capcat")') < 0 || _capFormSrc.indexOf("capCategorySelection(") < 0 || _capFormSrc.indexOf(".onchange = function") < 0)
    _failBE("capForm no longer wires category checkbox changes through capCategorySelection");

  // ── BIB PICKER CONTRACT (v1.507) ─────────────────────────────────────────────────────
  // The "+ from bible" tier picker (user request 2026-07-31): its candidate builder is a
  // pure marker-extracted function so a filter bug can't hide behind the modal UI. Clauses:
  // spells only, exact tier only (cantrips = 0), already-listed names excluded the way
  // capBaseName compares (case + display parenthetical), pending ADD entries included,
  // bib/ADD dupes not doubled — and the page must actually WIRE the button.
  var _bpM = _bePage.match(/\/\/ >>> BIB PICKER[\s\S]*?\/\/ <<< BIB PICKER/);
  if (!_bpM) _failBE("the BIB PICKER markers are gone from bible_editor.html");
  var _bpCands = new Function(_bpM[0] + "\nreturn bibPickCandidates;")();
  var _bpBib = {
    "fire bolt": { kind: "spell", tier: 0, category: ["arcane"], effect: "d8 fire" },
    "bless": { kind: "spell", tier: 1, category: ["divine"], effect: "allies add d4" },
    "command": { kind: "spell", tier: 1, category: ["divine"], effect: "one-word command" },
    "hold person": { kind: "spell", tier: 2, category: ["arcane", "divine"], effect: "paralyze" },
    "power strike": { kind: "ability", tier: 1, category: ["martial"], effect: "+d6 damage" }
  };
  var _bpKeys = function (r) { return r.map(function (c) { return c.key; }).join(","); };
  if (_bpKeys(_bpCands("1", [], _bpBib, {})) !== "bless,command")
    _failBE("bib picker: tier-1 candidates wrong (spell-only + exact-tier both matter): " + _bpKeys(_bpCands("1", [], _bpBib, {})));
  if (_bpKeys(_bpCands("cantrips", [], _bpBib, {})) !== "fire bolt")
    _failBE("bib picker: cantrips must map to tier 0");
  if (_bpKeys(_bpCands("1", ["Bless"], _bpBib, {})) !== "command")
    _failBE("bib picker: an already-listed name (display case) was not excluded");
  if (_bpKeys(_bpCands("1", ["Bless (allies add d4)"], _bpBib, {})) !== "command")
    _failBE("bib picker: a legacy parenthetical label failed to exclude its bible key");
  if (_bpKeys(_bpCands("1", [], _bpBib, { "smite": { kind: "spell", tier: 1, effect: "radiant" }, "bless": { kind: "spell", tier: 1, effect: "dupe of the bib entry" } })) !== "bless,command,smite")
    _failBE("bib picker: pending ADD spells must join the list once, never double a bib key");
  if (_bePage.indexOf("button[data-bibpick]") < 0 || _bpM[0] === null)
    _failBE("the + from bible button is rendered but never wired (or the wiring selector changed)");
  if (!/data-bibpick/.test(_bePage.slice(_bePage.indexOf("function chipList"), _bePage.indexOf("function renderClass"))))
    _failBE("chipList no longer renders the + from bible button");

  // Category filtering is separate from the free-text name/effect search. With no category
  // selected every candidate stays visible; multiple selected categories use inclusive OR.
  var _bpfM = _bePage.match(/\/\/ >>> BIB FILTER[\s\S]*?\/\/ <<< BIB FILTER/);
  if (!_bpfM) _failBE("the BIB FILTER markers are gone from bible_editor.html");
  var _bpVisible = new Function(_bpfM[0] + "\nreturn bibPickVisible;")();
  var _bpfCase = function (label, blob, cats, query, selected, want) {
    var got = _bpVisible(blob, cats, query, selected);
    if (got !== want) _failBE("bib filter: " + label + " — got " + got + ", want " + want);
  };
  _bpfCase("no filters shows every candidate", "fire bolt d8 fire", ["arcane"], "", [], true);
  _bpfCase("name search matches", "fire bolt d8 fire", ["arcane"], "FIRE BOLT", [], true);
  _bpfCase("effect search matches", "fire bolt d8 fire", ["arcane"], "d8 fire", [], true);
  _bpfCase("tradition is not part of free text anymore", "fire bolt d8 fire", ["arcane"], "arcane", [], false);
  _bpfCase("matching category shows the spell", "fire bolt d8 fire", ["arcane"], "", ["arcane"], true);
  _bpfCase("nonmatching category hides the spell", "fire bolt d8 fire", ["arcane"], "", ["divine"], false);
  _bpfCase("multiple category filters are inclusive OR", "fire bolt d8 fire", ["arcane"], "", ["divine", "arcane"], true);
  _bpfCase("multi-category spell matches either category", "light steady illumination", ["arcane", "divine"], "", ["divine"], true);
  var _bibPickerSrc = _bePage.slice(_bePage.indexOf("function bibPicker"), _bePage.indexOf("function showCard"));
  if (_bibPickerSrc.indexOf("placeholder='filter by name / effect'") < 0 || _bibPickerSrc.indexOf("filter by name / effect / tradition") >= 0)
    _failBE("bib filter: text placeholder still advertises tradition instead of name / effect only");
  if (_bibPickerSrc.indexOf("CAP_CATEGORIES.map") < 0 || _bibPickerSrc.indexOf("class='bp-cat'") < 0 || _bibPickerSrc.indexOf("bibPickVisible(") < 0)
    _failBE("bib filter: category checkboxes are not rendered and wired through bibPickVisible");
  if (_bibPickerSrc.indexOf('(c.key + " " + (c.entry.effect || "")).toLowerCase()') < 0)
    _failBE("bib filter: free-text row blob includes category/tradition again");
  if (_bibPickerSrc.indexOf("bpCats[bci].onchange = refreshBibFilters") < 0)
    _failBE("bib filter: category checkbox changes no longer refresh the candidate rows");

  // The capability editor and class spell browser hold two in-memory representations of
  // capability_bible.js. Opening/reloading/saving the capability document must replace the
  // page snapshot, and every spell-browser open must refresh that dependency from disk first.
  var _capsM = _bePage.match(/\/\/ >>> CAP SNAPSHOT[\s\S]*?\/\/ <<< CAP SNAPSHOT/);
  if (!_capsM) _failBE("the CAP SNAPSHOT markers are gone from bible_editor.html");
  var _syncCaps = new Function(_capsM[0] + "\nreturn capSnapshotSync;")();
  var _staleCaps = {
    "obsolete": { kind: "ability", tier: 0 },
    "speak with animals": { kind: "ability", tier: 0 }
  };
  var _freshSpeak = { kind: "spell", tier: 2, category: ["primal"] };
  var _sameCaps = _syncCaps(_staleCaps, [
    { key: "speak with animals", obj: _freshSpeak },
    { key: "moonbeam", obj: { kind: "spell", tier: 2 } }
  ]);
  if (_sameCaps !== _staleCaps || _staleCaps.obsolete || _staleCaps["speak with animals"] !== _freshSpeak || !_staleCaps.moonbeam)
    _failBE("cap snapshot: replacement did not remove stale keys and install the fresh parsed entries in place");
  var _loadTextSrc = _bePage.slice(_bePage.indexOf("function loadFromText"), _bePage.indexOf("function openBible"));
  if (_loadTextSrc.indexOf("capSnapshotSync(CAPABILITY_BIBLE, data.entries)") < 0)
    _failBE("cap snapshot: opening or reloading capability_bible.js no longer refreshes the page snapshot");
  var _saveBibleSrc = _bePage.slice(_bePage.indexOf("function serverSaveBible"), _bePage.indexOf("function note"));
  if (_saveBibleSrc.indexOf("capSnapshotSync(CAPABILITY_BIBLE, CUR.data.entries)") < 0)
    _failBE("cap snapshot: a successful capability-bible save no longer refreshes the page snapshot");
  var _depSrc = _bePage.slice(_bePage.indexOf("function refreshCapabilityDependency"), _bePage.indexOf("function showBibPicker"));
  if (_depSrc.indexOf('fetch(BIBLE_SRV + "/bible")') < 0 || _depSrc.indexOf("capSnapshotSync(CAPABILITY_BIBLE, st.entries)") < 0 || _depSrc.indexOf("console.warn") < 0)
    _failBE("cap snapshot: the spell browser no longer refreshes its dependency loudly from the helper");
  if (_bibPickerSrc.indexOf("refreshCapabilityDependency(function ()") < 0 || _bibPickerSrc.indexOf("showBibPicker(path, tier)") < 0)
    _failBE("cap snapshot: the spell browser can build candidates before its dependency refresh completes");
  if (_bePage.indexOf("↻ Reload current file") < 0)
    _failBE("cap snapshot: Reload from disk still obscures that it reloads only the current file");

  // ── FEAT MOVE CONTRACT (v1.511) ──────────────────────────────────────────────────────
  // Drag-to-reorder feature rows (user request 2026-08-01): the array mutation under the ⋮⋮
  // grips is a pure marker-extracted function. The same-array move is the classic off-by-one —
  // removing the source first shifts every later index left — so both directions are pinned,
  // along with the no-op contract (false → the draft is never marked dirty for a non-move).
  var _fmM = _bePage.match(/\/\/ >>> FEAT MOVE[\s\S]*?\/\/ <<< FEAT MOVE/);
  if (!_fmM) _failBE("the FEAT MOVE markers are gone from bible_editor.html");
  var _fmMove = new Function(_fmM[0] + "\nreturn moveFeatItem;")();
  var _fmN = function (a) { return a.map(function (f) { return f.nm; }).join(","); };
  var _fmA = [{ nm: "A" }, { nm: "B" }, { nm: "C" }], _fmB = [{ nm: "X" }];
  if (_fmMove(_fmA, 0, _fmB, 1) !== true || _fmN(_fmA) !== "B,C" || _fmN(_fmB) !== "X,A")
    _failBE("feat move: cross-list move broken (src " + _fmN(_fmA) + " · dst " + _fmN(_fmB) + ")");
  _fmA = [{ nm: "A" }, { nm: "B" }, { nm: "C" }];
  if (_fmMove(_fmA, 0, _fmA, 3) !== true || _fmN(_fmA) !== "B,C,A")
    _failBE("feat move: same-list DOWNWARD move must adjust for the removed source (got " + _fmN(_fmA) + ")");
  _fmA = [{ nm: "A" }, { nm: "B" }, { nm: "C" }, { nm: "D" }];
  if (_fmMove(_fmA, 1, _fmA, 3) !== true || _fmN(_fmA) !== "A,C,B,D")
    _failBE("feat move: same-list DOWNWARD move must preserve the requested middle drop boundary (got " + _fmN(_fmA) + ")");
  _fmA = [{ nm: "A" }, { nm: "B" }, { nm: "C" }];
  if (_fmMove(_fmA, 2, _fmA, 0) !== true || _fmN(_fmA) !== "C,A,B")
    _failBE("feat move: same-list UPWARD move broken (got " + _fmN(_fmA) + ")");
  _fmA = [{ nm: "A" }, { nm: "B" }];
  if (_fmMove(_fmA, 0, _fmA, 1) !== false || _fmN(_fmA) !== "A,B")
    _failBE("feat move: dropping a row back onto its own position must be a no-op reporting false");
  if (_fmMove(_fmA, 5, _fmA, 0) !== false || _fmN(_fmA) !== "A,B")
    _failBE("feat move: an out-of-range source index must be refused");
  _fmA = [{ nm: "A" }]; _fmB = [];
  if (_fmMove(_fmA, 0, _fmB, 99) !== true || _fmN(_fmB) !== "A" || _fmA.length !== 0)
    _failBE("feat move: an over-long destination index must clamp to append (empty-slot drop)");
  _fmA = [{ nm: "A" }]; _fmB = [{ nm: "X" }, { nm: "Y" }];
  if (_fmMove(_fmA, 0, _fmB, -9) !== true || _fmN(_fmB) !== "A,X,Y")
    _failBE("feat move: a negative destination index must clamp to the beginning");
  _fmA = [{ nm: "A" }]; _fmB = [{ nm: "X" }, { nm: "Y" }];
  if (_fmMove(_fmA, 0, _fmB, 99) !== true || _fmN(_fmB) !== "X,Y,A")
    _failBE("feat move: an over-long destination index must clamp to append");
  // ...and the page must actually render the grips and route drops through moveFeat
  if (_bePage.indexOf("class='feat' data-frow='") < 0 || _bePage.indexOf("class='grip'") < 0)
    _failBE("the feature rows no longer carry the ⋮⋮ grip / data-frow — nothing is draggable");
  if (!/moveFeat\(/.test(_bePage.slice(_bePage.indexOf("function wireClass"))))
    _failBE("wireClass never routes a drop through moveFeat — the grips are decoration");

  // Open remains a read-only convenience for switching bible types. It must keep the unsaved-edit
  // guard, but Save itself has no browser file-handle, permission, Save-as, or download branches.
  function _slice(from, to) { var i = _bePage.indexOf(from); var j = _bePage.indexOf(to, i + 1); return (i < 0 || j < 0) ? "" : _bePage.slice(i, j); }
  function _at(hay, re) { var m = hay.match(re); return m ? hay.indexOf(m[0]) : -1; }
  var _ob = _slice("function openBible", "function saveBible");
  if (!_ob) _failBE("could not isolate openBible");
  var _obPick = _at(_ob, /showOpenFilePicker/), _obAsk = _at(_ob, /(confirm|alert|prompt)\(/);
  if (_obPick < 0) _failBE("openBible no longer calls showOpenFilePicker");
  if (_obAsk >= 0 && _obAsk < _obPick)
    _failBE("openBible asks a modal question BEFORE showOpenFilePicker — that consumes user activation and the picker will never open (the v1.485 deadlock)");
  if (!/CUR\.dirty[\s\S]{0,120}confirm\(/.test(_ob) || !/UNSAVED EDITS/i.test(_ob))
    _failBE("openBible lost its unsaved-edits guard — loading a file would silently discard the tab's edits");
  var _sb = _slice("function saveBible", "function reloadFromDisk");
  if (!_sb || _sb.indexOf("serverSaveBible();") < 0)
    _failBE("Save is no longer wired directly to the local project writer");
  if (/legacySaveBible|downloadCopy|saveAsBible|writeInPlace|showSaveFilePicker|createWritable/.test(_sb))
    _failBE("Save regained an alternate browser-file or download workflow");
  if (/function (legacySaveBible|downloadCopy|saveAsBible|writeInPlace)\b|showSaveFilePicker|createWritable|URL\.createObjectURL|a\.download\s*=/.test(_bePage))
    _failBE("Bible Editor still contains an alternate Save-as/download write path — project-file save must be the only workflow");
  var _localSave = _slice("function serverSaveBible", "function note");
  if (!_localSave || _localSave.indexOf("srvInstall(ser)") < 0)
    _failBE("local project Save no longer routes through the validated install boundary");
  if (_localSave.indexOf("local project writer is unavailable") < 0 || _localSave.indexOf("your draft is still here") < 0)
    _failBE("local project Save failure is not loud or does not promise the preserved draft");
  var _clr = _at(_localSave, /clearTimeout\(_saveT\)/), _rm = _at(_localSave, /removeItem\(DRAFT_K\)/);
  if (_clr < 0 || (_rm >= 0 && _clr > _rm))
    _failBE("local project Save does not cancel the draft debounce before clearing the saved draft");

  // ── CAP EDIT CONTRACT (v1.512) ───────────────────────────────────────────────────────
  // The card's ✎ Update Bible flow (user request 2026-08-01, the balance pass): edit a SHIPPED
  // capability from the class view and write capability_bible.js surgically through its own
  // handle. The entry mutation is pure and marker-extracted; the FSA plumbing is pinned by
  // source checks (same approach as the activation-ordering pins — the picker is an OS dialog
  // no harness can drive).
  var _cedM = _bePage.match(/\/\/ >>> CAP EDIT[\s\S]*?\/\/ <<< CAP EDIT/);
  if (!_cedM) _failBE("the CAP EDIT markers are gone from bible_editor.html");
  var _cedApply = new Function(_cedM[0] + "\nreturn capApplyEdit;")();
  var _cedEs = [{ key: "a", obj: { effect: "old" }, dirty: false }, { key: "b", obj: { effect: "keep" }, dirty: false }];
  if (_cedApply(_cedEs, "a", { effect: "new" }) !== true || _cedEs[0].obj.effect !== "new" || _cedEs[0].dirty !== true)
    _failBE("cap edit: a hit must replace the entry object and stamp dirty (emit() only runs for dirty entries — an undirtied edit writes the OLD line back)");
  if (_cedEs[1].dirty !== false || _cedEs[1].obj.effect !== "keep")
    _failBE("cap edit: a hit must not touch other entries");
  if (_cedApply(_cedEs, "zzz", { effect: "x" }) !== false || _cedEs.length !== 2 || _cedEs[0].obj.effect !== "new")
    _failBE("cap edit: an unknown key must be refused untouched, never invented");
  // The class-view Add to Bible action is intentionally an UPSERT, not the strict card-edit
  // operation above: a missing definition is appended, while an entry that appeared between
  // opening the form and pressing the button is replaced in place (never duplicated).
  var _cedAdd = [], _cedDraft = { effect: "conjure 12 magic arrows" };
  if (_cedApply(_cedAdd, "fletch", _cedDraft, true) !== true || _cedAdd.length !== 1 ||
      _cedAdd[0].key !== "fletch" || _cedAdd[0].obj !== _cedDraft || _cedAdd[0].dirty !== true)
    _failBE("Add to Bible upsert: a missing spell must append one dirty capability entry");
  var _cedReplacement = { effect: "revised arrows" };
  if (_cedApply(_cedAdd, "fletch", _cedReplacement, true) !== true || _cedAdd.length !== 1 ||
      _cedAdd[0].obj !== _cedReplacement || _cedAdd[0].dirty !== true)
    _failBE("Add to Bible upsert: an existing spell must be replaced in place, never duplicated");
  var _cedClassAdd = _slice("var badges = m.querySelectorAll", "// \"+ from bible\" picker");
  if (!_cedClassAdd || _cedClassAdd.indexOf("upsertShippedCapability(ak, o") < 0)
    _failBE("Add to Bible button is not wired to the named capability upsert path");
  if (_cedClassAdd.indexOf("function () { closeModal(); delete ADD[ak]; render(); }") < 0)
    _failBE("successful Add to Bible does not close its form — a completed local write still looks unfinished");
  var _cedUpsertPath = _slice("function upsertShippedCapability", "function updateShippedCapability");
  if (!_cedUpsertPath || !/updateShippedCapability\(key, obj, onDone, true\)/.test(_cedUpsertPath))
    _failBE("named capability upsert path no longer enables creation in the fresh-file writer");
  var _cedCard = _slice("function showCard", "// >>> CAP EDIT");
  if (!_cedCard) _failBE("could not isolate showCard ahead of the CAP EDIT markers");
  if (_cedCard.indexOf("id='m-edit'") < 0 || _cedCard.indexOf("capForm(") < 0 || _cedCard.indexOf("Update Bible") < 0)
    _failBE("showCard no longer offers ✎ Update Bible through capForm — the card went back to read-only");
  var _usc = _slice("function updateShippedCapability", "// ── toolbar");
  if (!_usc) _failBE("could not isolate updateShippedCapability");
  if (_at(_usc, /\.detect\(/) < 0 || _at(_usc, /\.detect\(/) > _at(_usc, /\.parse\(/))
    _failBE("updateShippedCapability no longer verifies the local project file IS the capability bible before parsing");
  if (_usc.indexOf('fetch(BSRV + "/bible")') < 0)
    _failBE("updateShippedCapability no longer reads capability_bible.js fresh from the local project writer");
  /* Re-baselined 2026-08-15 by owner ruling: there is no online/offline save mode. The helper
     writes the LOCAL project checkout; deployment/upload is a separate later action. Add/Update
     must either complete that validated local write or fail loudly with the form intact. */
  var _uscApplies = (_usc.match(/CAPABILITY_BIBLE\[key\]\s*=\s*obj/g) || []).length;
  if (_uscApplies !== 1)
    _failBE("updateShippedCapability no longer refreshes the in-page CAPABILITY_BIBLE on the server success path — badges and cards would show stale values after a real write");
  if (/legacyDownloadFlow|showOpenFilePicker|URL\.createObjectURL|a\.download\s*=/.test(_usc))
    _failBE("Add/Update Bible still has a download or file-picker fallback — it must write the local project bible or fail with the form intact");
  if (_usc.indexOf("local project writer is unavailable") < 0 ||
      _usc.indexOf("nothing was written; your values are still in the form") < 0)
    _failBE("Add/Update Bible does not loudly preserve the edit when the local project writer is unavailable");
  var _beLauncher = _pathBE.join(__dirname, "..", "Bible Editor.cmd");
  if (!_fsBE.existsSync(_beLauncher))
    _failBE("the one-click Bible Editor launcher is missing from the project root");
  var _beLauncherSrc = _fsBE.readFileSync(_beLauncher, "utf8");
  if (_beLauncherSrc.indexOf("dev\\launch-bible-editor.js") < 0)
    _failBE("Bible Editor.cmd no longer starts the validated local editor launcher");
  if (!/if \(onSave\(draft\) !== false\) closeModal\(\)/.test(_bePage))
    _failBE("capForm closes unconditionally after onSave again — a failed async Update Bible write would eat the user's edited values");

  // v2 (2026-07-28): the editor can now OPEN and OVERWRITE capability_bible.js, which is
  // HAND-COMMENTED. The load-bearing property is that an UNEDITED open→save is a no-op: untouched
  // entries re-emit as their original source lines and every comment survives in place. Without
  // this pin, a serializer change could silently reformat 175 entries and bury the real diff.
  var _capSerialize = new Function(_serM[0] + "\nreturn serializeCapabilityBible;")();
  var _capSrc = _fsBE.readFileSync(_pathBE.join(__dirname, "..", "capability_bible.js"), "utf8").replace(/\r\n/g, "\n");
  var _capLines = _capSrc.split("\n"), _cs = -1, _ce = -1, _ci;
  for (_ci = 0; _ci < _capLines.length; _ci++) if (/^var\s+CAPABILITY_BIBLE\s*=\s*\{/.test(_capLines[_ci])) { _cs = _ci; break; }
  for (_ci = _cs + 1; _ci < _capLines.length; _ci++) if (/^\};/.test(_capLines[_ci])) { _ce = _ci; break; }
  if (_cs < 0 || _ce < 0) _failBE("capability_bible.js data block not found — the editor's parser keys on `var CAPABILITY_BIBLE={` and a column-0 `};`");
  var _capVals = new Function(_capSrc + "\nreturn CAPABILITY_BIBLE;")();
  var _capEntries = [], _lead = [];
  for (_ci = _cs + 1; _ci < _ce; _ci++) {
    var _cl = _capLines[_ci], _cm = _cl.match(/^\s*"([^"]+)"\s*:\s*\{/);
    if (_cm) { _capEntries.push({ key: _cm[1], line: _cl, obj: _capVals[_cm[1]], lead: _lead, dirty: false }); _lead = []; }
    else _lead.push(_cl);
  }
  var _capOut = _capSerialize({ prefix: _capLines.slice(0, _cs + 1).join("\n") + "\n", suffix: "\n" + _capLines.slice(_ce).join("\n"), entries: _capEntries });
  if (_capOut !== _capSrc) {
    var _cd = 0; while (_cd < _capOut.length && _capOut[_cd] === _capSrc[_cd]) _cd++;
    _failBE("an UNEDITED capability_bible open→save is not a no-op — first divergence at char " + _cd +
      " (…" + JSON.stringify(_capSrc.slice(Math.max(0, _cd - 40), _cd + 40)) + "). Saving would reformat entries the user never touched.");
  }
  if (!_capEntries.length) _failBE("the capability parser found ZERO entries — the format assumption (one entry per line) has broken");
  // ...and the same again with EVERY entry marked dirty, which is what forces emit() to run. The
  // no-op check above only exercises the raw-line path, so on its own it leaves the emitter — the
  // code that actually writes your edits — completely untested (found by sabotage, 2026-07-28).
  // emit() is byte-faithful to the hand-written style for all 175 entries today; pinning that
  // means an editor save can never silently reformat the file around the line you changed.
  var _capDirty = _capEntries.map(function (e) { return { key: e.key, line: e.line, obj: e.obj, lead: e.lead, dirty: true }; });
  var _capOut2 = _capSerialize({ prefix: _capLines.slice(0, _cs + 1).join("\n") + "\n", suffix: "\n" + _capLines.slice(_ce).join("\n"), entries: _capDirty });
  if (_capOut2 !== _capSrc) {
    var _cd2 = 0; while (_cd2 < _capOut2.length && _capOut2[_cd2] === _capSrc[_cd2]) _cd2++;
    _failBE("serializeCapabilityBible's emit() no longer reproduces the file's own entry format — an edited save would reformat every entry it touches. First divergence at char " + _cd2 +
      " (…" + JSON.stringify(_capSrc.slice(Math.max(0, _cd2 - 40), _cd2 + 40)) + "\n     vs …" + JSON.stringify(_capOut2.slice(Math.max(0, _cd2 - 40), _cd2 + 40)) + ")");
  }
  var _capEdited = _capEntries.map(function (e) { return { key: e.key, line: e.line, obj: e.obj, lead: e.lead, dirty: false }; });
  _capEdited[0].obj = JSON.parse(JSON.stringify(_capEdited[0].obj));
  _capEdited[0].obj.effect = String(_capEdited[0].obj.effect || "") + " [dirty-path fixture]";
  _capEdited[0].dirty = true;
  var _capOut3 = _capSerialize({ prefix: _capLines.slice(0, _cs + 1).join("\n") + "\n", suffix: "\n" + _capLines.slice(_ce).join("\n"), entries: _capEdited });
  if (_capOut3 === _capSrc || _capOut3.indexOf("[dirty-path fixture]") < 0)
    _failBE("serializeCapabilityBible's dirty edit path ignored the changed object — raw source lines are masking a dead emitter");
} catch (e) { console.error("BIBLE EDITOR CONTRACT CHECK FAILED: " + (e && e.message)); process.exit(1); }

// ── VOICE LAB CONTRACT (v1.492, author de-branding experiment) ───────────────────────────
// author_voice_lab.html tests whether 12 shared attribute dials re-create each author's voice
// with NO author name in the prompt (DOC/Research/DOC_author_voice.md). The page's pure core (attrs,
// baselines, prompt builders) is marker-delimited and evaluated here; the clauses below keep the
// lab in lockstep with data.js AUTHORS and keep the dial prompt genuinely name-free.
try {
  var _fsVL = require("fs"), _pathVL = require("path");
  var _failVL = function (msg) { console.error("VOICE LAB CONTRACT: " + msg); process.exit(1); };
  var _pageVL = _fsVL.readFileSync(_pathVL.join(__dirname, "..", "author_voice_lab.html"), "utf8");
  // ① The pure core is extractable and DOM/fetch-free (the testability seam).
  var _mVL = _pageVL.match(/\/\* >>> VOICE LAB CORE[\s\S]*?\*\/([\s\S]*?)\/\* <<< VOICE LAB CORE \*\//);
  if (!_mVL || _mVL[1].length < 1000) _failVL("core markers missing — the pure logic block is the node-test seam; do not remove or rename the markers.");
  var _coreVL = _mVL[1];
  if (/document\.|window\.|fetch\(|localStorage/.test(_coreVL)) _failVL("core block touches DOM/fetch/localStorage — it must stay pure so this contract can execute it.");
  var _labVL = (new Function(_coreVL +
    "; return {attrs: VOICE_ATTRS, base: VOICE_BASELINES, dev: VOICE_DEVICES, flavor: VOICE_FLAVOR, dist: VOICE_DISTILLED, passage: TEST_PASSAGE, band: voiceBand, directive: buildStyleDirective, rewrite: buildRewritePrompt, control: buildControlPrompt, distPrompt: buildDistilledPrompt};"))();
  // ② 12 attributes, 5 non-empty bands each; band mapping covers 1..10.
  if (_labVL.attrs.length !== 12) _failVL("expected 12 attributes, found " + _labVL.attrs.length + " — update DOC/Research/DOC_author_voice.md and this contract together if the space changes.");
  _labVL.attrs.forEach(function (a) {
    if (!a.bands || a.bands.length !== 5 || a.bands.some(function (b) { return !b || b.length < 10; })) _failVL("attribute '" + a.id + "' does not have 5 real band texts.");
    if (_labVL.band(a, 1) !== a.bands[0] || _labVL.band(a, 5) !== a.bands[2] || _labVL.band(a, 10) !== a.bands[4]) _failVL("band mapping broken for '" + a.id + "' (1/5/10 must hit bands 0/2/4).");
  });
  // ③ Two-way lockstep with data.js AUTHORS: every author has baseline+flavor; no orphan baselines.
  var _dataVL = _fsVL.readFileSync(_pathVL.join(__dirname, "..", "data.js"), "utf8");
  var _segVL = _dataVL.slice(_dataVL.indexOf("var AUTHORS"), _dataVL.indexOf("];", _dataVL.indexOf("var AUTHORS")));
  var _idsVL = [], _namesVL = [], _reVL = /\{id:"(\w+)",nm:"([^"]+)"/g, _mmVL;
  while ((_mmVL = _reVL.exec(_segVL))) { _idsVL.push(_mmVL[1]); _namesVL.push(_mmVL[2]); }
  if (_idsVL.length < 10) _failVL("could not parse AUTHORS from data.js (found " + _idsVL.length + " ids) — the parse regex needs updating.");
  _idsVL.forEach(function (id) {
    var b = _labVL.base[id];
    if (!b) _failVL("author '" + id + "' (data.js) has NO baseline — a new author needs ratings in the same commit.");
    _labVL.attrs.forEach(function (a) {
      var v = b[a.id];
      if (typeof v !== "number" || v < 1 || v > 10 || v % 1 !== 0) _failVL("baseline " + id + "." + a.id + " = " + v + " — must be an integer 1..10.");
    });
    if (Object.keys(b).length !== 12) _failVL("baseline '" + id + "' has stray keys beyond the 12 attributes.");
    if (!_labVL.flavor[id] || _labVL.flavor[id].length < 80) _failVL("author '" + id + "' has no flavor reference passage.");
    if (!_labVL.dist[id] || _labVL.dist[id].length < 100) _failVL("author '" + id + "' has no DISTILLED directive — the third arm needs one per author (same-commit rule).");
  });
  Object.keys(_labVL.base).forEach(function (id) { if (_idsVL.indexOf(id) < 0) _failVL("baseline '" + id + "' has no matching author in data.js — remove it or fix the id."); });
  // ④ The dial prompt is genuinely name-free for EVERY author at baseline (the whole point).
  var _tokensVL = [];
  _namesVL.forEach(function (nm) { nm.split(/[^A-Za-z]+/).forEach(function (t) { if (t.length >= 3) _tokensVL.push(t.toLowerCase()); }); });
  _idsVL.forEach(function (id) {
    var _arms = [
      { kind: "dial", p: _labVL.rewrite(_labVL.directive(_labVL.base[id]), _labVL.passage, _labVL.dev[id] || []) },
      { kind: "distilled", p: _labVL.distPrompt(_labVL.dist[id], _labVL.passage) }
    ];
    _arms.forEach(function (arm) {
      var low = (arm.p.system + "\n" + arm.p.user).toLowerCase();
      _tokensVL.forEach(function (t) {
        if (new RegExp("\\b" + t + "\\b").test(low)) _failVL(arm.kind + " prompt for '" + id + "' contains author-name token '" + t + "' — the no-name guarantee is broken.");
      });
      if (low.indexOf("never name, reference, or imitate-by-name") < 0) _failVL(arm.kind + " prompt lost the never-name guard clause.");
      if (arm.p.user.indexOf(_labVL.passage) < 0) _failVL(arm.kind + " prompt does not embed the passage verbatim.");
    });
  });
  // ⑤ The control prompt embeds the real vc (the control arm works).
  var _ctlVL = _labVL.control("VOICE DIRECTIVE SENTINEL", _labVL.passage);
  if (_ctlVL.user.indexOf("VOICE DIRECTIVE SENTINEL") < 0 || _ctlVL.user.indexOf(_labVL.passage) < 0) _failVL("control prompt does not embed the vc directive + passage.");
  // ⑥ The v1.360 class: the satellite must be in sw.js's network-first allowlist or the SW pins it
  //    stale. Check the REGEX LITERAL itself, not the whole file — a comment mention must not
  //    satisfy this (sabotage S3 proved indexOf-on-the-file was vacuous exactly that way).
  var _swVL = _fsVL.readFileSync(_pathVL.join(__dirname, "..", "sw.js"), "utf8");
  var _swReVL = _swVL.match(/if\(\/([^\n]+?)\/\.test\(e\.request\.url\)\)/);
  if (!_swReVL) _failVL("could not locate sw.js's network-first regex — the fetch-handler shape changed; update this contract.");
  if (_swReVL[1].indexOf("author_voice_lab") < 0) _failVL("author_voice_lab is missing from sw.js's network-first REGEX — the SW will pin the page stale (the v1.360 bug_tracker lesson).");
  // ⑦ The browser seam + stub mode exist (satellite testability rule, 2026-07-29).
  if (_pageVL.indexOf("__voiceLabTest") < 0) _failVL("the window.__voiceLabTest seam is gone — satellites with logic must stay drivable.");
  if (_pageVL.indexOf("stub=1") < 0) _failVL("stub mode (?stub=1) is gone — UI verification without a key depends on it.");
  console.log("[voice-lab] contract OK — " + _idsVL.length + " authors × 12 dials, prompts name-free");
} catch (e) { console.error("VOICE LAB CONTRACT CHECK FAILED: " + (e && e.message)); process.exit(1); }

// ── BLUEPRINT DESIGNER CONTRACT (#192, class roster — v1.637) ────────────────────────────
// blueprint-designer.html gained Custom Classes + Available Classes (customClasses /
// availableClasses in the .blueprint schema; the pure halves — normalize/validate/roster —
// live in game.js and are engine-tested). These source pins keep the page's half honest,
// and pay the designer's outstanding seam debt (satellite testability rule 2026-07-29).
try {
  var _fsBD = require("fs"), _pathBD = require("path");
  var _failBD = function (msg) { console.error("BLUEPRINT DESIGNER CONTRACT: " + msg); process.exit(1); };
  var _pageBD = _fsBD.readFileSync(_pathBD.join(__dirname, "..", "blueprint-designer.html"), "utf8");
  // ① The browser test seam exists (the designer owed one since 2026-07-29).
  if (_pageBD.indexOf("window.__bpdTest") < 0) _failBD("the designer's window test seam is gone — satellites with logic must stay drivable.");
  // ② class_bible.js is loaded — the Available Classes roster's base half reads classDefs(),
  //    which throws without CLASS_BIBLE (the page shipped without it before #192).
  if (!/<script src=["']class_bible\.js["']><\/script>/.test(_pageBD)) _failBD("class_bible.js script tag missing — classDefs() has no data and the class sections crash at render.");
  // ③ The checkable roster is BUILT from the shared blueprintClassList (game.js) — a hand-rolled
  //    base list here would silently diverge from what the creation wizard will later offer.
  if (_pageBD.indexOf("blueprintClassList(") < 0) _failBD("the Available Classes section no longer reads blueprintClassList() — designer and engine rosters can now diverge.");
  // ④ Field routing goes through FIELD_ROOTS for all three new sections (the bestiary-notes
  //    split-brain lesson: private routing breaks the breakout editor invisibly).
  ["cclass:", "cabil:", "cfeat:"].forEach(function (kk) { if (_pageBD.indexOf(kk) < 0) _failBD("FIELD_ROOTS lost the '" + kk + "' route — field edits/breakout for that section are silently dead."); });
  // ⑤ The section wiring exists (add-class control + availability checkboxes).
  if (_pageBD.indexOf("addcclass") < 0) _failBD("the + Add custom class control is gone.");
  if (_pageBD.indexOf("data-avcls") < 0) _failBD("the availability checkboxes are gone.");
  // ⑥ (v0.37) The engine chain is load-complete for api.js: its top-level NOTE_BUILDERS array
  //    evaluates clock.js/identity.js/tag_table.js builder functions at load, so a missing tag
  //    aborts api.js BEFORE callGM exists — every designer LLM feature died this way from
  //    v1.581 to v0.37 (the #17 hand-copied-list rot class). Each tag must exist AND precede api.js.
  var _apiAtBD = _pageBD.indexOf("<script src=\"api.js\">");
  if (_apiAtBD < 0) _failBD("api.js script tag not found — the tag-shape changed; update this contract.");
  ["clock.js", "identity.js", "tag_table.js"].forEach(function (dep) {
    var at = _pageBD.indexOf("<script src=\"" + dep + "\">");
    if (at < 0) _failBD(dep + " script tag missing — api.js will abort at NOTE_BUILDERS and callGM never exists (dead LLM features).");
    if (at > _apiAtBD) _failBD(dep + " loads AFTER api.js — NOTE_BUILDERS still evaluates into a ReferenceError.");
  });
  // ⑦ (#227, v0.38) The World Ages ladder. Field routing MUST go through FIELD_ROOTS (clause ④'s
  //    lesson) or the breakout editor silently edits nothing, and the add control must exist or
  //    an author can only get a ladder by hand-editing JSON. The empty-husk delete matters too:
  //    normalizeBlueprint reads ABSENT as "no ceiling", so a stranded [] would be written into
  //    every saved blueprint and mean something the author never chose.
  if (_pageBD.indexOf("dt:") < 0) _failBD("FIELD_ROOTS lost the 'dt:' route — World Ages edits are silently dead.");
  if (_pageBD.indexOf("adddt") < 0) _failBD("the + Add age control is gone — a ladder could only be authored by hand-editing JSON.");
  if (_pageBD.indexOf("delete bp.deepTime") < 0) _failBD("removing the last rung no longer drops the field — an empty husk would ship in every saved blueprint.");
  console.log("[blueprint-designer] contract OK — class roster + World Ages sections wired, seam present");
} catch (e) { console.error("BLUEPRINT DESIGNER CONTRACT CHECK FAILED: " + (e && e.message)); process.exit(1); }

// ── #92 SYNC COMPRESSION CONTRACT (v1.504) ───────────────────────────────────────────────
// The wire format is the disk format ({__lz} transcript), and the reconcile ADOPT used to
// consume the pulled blob RAW (worldState = data.worldState — never parseWorldState): shipping
// a compressed wire without the inflate poisons live state ({__lz}.push throws mid-turn).
// Source contracts because the reconcile is async and private to the adapter IIFE — the
// headless harness cannot await it; the pure halves are engine-tested.
try {
  var _fsSC = require("fs"), _pathSC = require("path");
  var _saSC = _fsSC.readFileSync(_pathSC.join(__dirname, "..", "storage-adapter.js"), "utf8");
  var _ncSC = function (t) { return String(t).replace(/\/\/[^\n]*/g, "").replace(/\/\*[\s\S]*?\*\//g, ""); };
  var _saN = _ncSC(_saSC);
  if (!/data\.worldState\s*=\s*inflateWorldStateSnapshot\(\s*data\.worldState\s*\)/.test(_saN)) {
    console.error("SYNC COMPRESSION CONTRACT: the reconcile adopt no longer inflates the pulled blob — a compressed wire poisons live state (#92, the adopt-hop lesson).");
    process.exit(1);
  }
  // #272 D3: both POST paths route through wireWorldStateSnapshot (the ONE wire-form seam —
  // the B9 one-map rule), which itself derives from compressWorldStateSnapshot in state.js, so
  // the #92 compressed-wire guarantee is unchanged and the Phase-C form flip has one producer.
  var _cwsCount = (_saN.match(/worldState:\s*wireWorldStateSnapshot\(/g) || []).length;
  if (_cwsCount < 2) {
    console.error("SYNC COMPRESSION CONTRACT: only " + _cwsCount + " of the 2 POST paths (_syncNow payload + pushCampaignState) route worldState through wireWorldStateSnapshot — the 2MB plain-payload class returns (#92/#272).");
    process.exit(1);
  }
  var _stSC = _ncSC(_fsSC.readFileSync(_pathSC.join(__dirname, "..", "state.js"), "utf8"));
  // #280: the shipped wire form routes through the CHUNKED producer (sharing the disk segment
  // cache — the POST build pays zero LZ passes), and the chunked producer itself falls back to
  // compressWorldStateSnapshot below one segment — so the #92 compressed-wire guarantee holds at
  // every transcript size through one derivation chain, never a second producer.
  if (!/function wireWorldStateSnapshot\(ws\)\{\s*if\(WIRE_TRANSCRIPT_FORM==="lzc"\)return compressWorldStateSnapshotChunked\(ws\);/.test(_stSC)) {
    console.error("SYNC COMPRESSION CONTRACT: the shipped wire form no longer routes through compressWorldStateSnapshotChunked (#280) — the POST build pays the O(campaign) LZ pass again (or the wire grew a second producer).");
    process.exit(1);
  }
  if (!/return compressWorldStateSnapshot\(ws\);\s*var tr=ws\.transcript/.test(_stSC)) {
    console.error("SYNC COMPRESSION CONTRACT: compressWorldStateSnapshotChunked no longer falls back to compressWorldStateSnapshot — a young/LZ-less save loses the #92 compressed wire.");
    process.exit(1);
  }
  // #272 D3 / #280: every wire-form flip is a DELIBERATE contract edit under the inflater-first
  // rule — the flag changes only when every deployed client has carried the target form's
  // inflater for a full release cycle (a stale device pulling an unreadable form rescue-and-
  // empties its story view). "lzc" shipped at #280 (owner confirmed both devices on v1.744);
  // the NEXT legal value is the v2/enc:"b64" packed-segment form, whose inflater shipped with
  // the #280 flip — flag change and this clause land in the same commit, by design.
  if (!/var WIRE_TRANSCRIPT_FORM="lzc";/.test(_stSC)) {
    console.error("SYNC COMPRESSION CONTRACT: WIRE_TRANSCRIPT_FORM is not \"lzc\" — a wire-form change outside a deliberate #280-style flip commit skips the inflater-first release gate.");
    process.exit(1);
  }
  // #272 D3: the reconcile must REFUSE an unreadable transcript form before the destructive
  // inflate — the rescue-and-empty adopt could push an empty story record over the server copy.
  if (!/inflateTranscriptField\(_srvTr\)\s*===\s*null/.test(_saN)) {
    console.error("SYNC COMPRESSION CONTRACT: the reconcile no longer refuses an unreadable transcript form before adopting (#272 D3) — a stale client can empty the story and race it upward.");
    process.exit(1);
  }
  // #272 D3: the payload sentinel measures REAL UTF-8 bytes — the char count under-reported the
  // {__lz} portion ~3x, so the 2MB warning fired at ~5.9MB actual wire bytes (f69).
  if (_saN.indexOf("var _syncPayloadBytes = _payloadBytes(payload);") < 0) {
    console.error("SYNC COMPRESSION CONTRACT: the payload sentinel no longer measures real bytes (#272 D3) — the 2MB warning under-fires ~3x on {__lz}-heavy payloads again.");
    process.exit(1);
  }
} catch (e) { console.error("SYNC COMPRESSION CONTRACT CHECK FAILED: " + (e && e.message)); process.exit(1); }

// ── #272 D1 / #280b ONE-POST CONTRACT (R4 2026-08-28, amended by the 2026-08-29 field report) ──
// One full-state POST per dialogue turn — and it is the SUGGESTION-COMPLETION one, because
// generateActions nulls lastActions at its start (E26) and the commit-time POST fired inside
// that async window: the server carried null buttons and the JP0-11 size cap skips the
// mature-save flush, so the second device rendered the newest narration buttonless. The
// completion sync (a finally — EVERY exit) converges the server to the truth; the narration
// commit persists locally only. The #280b standalone proves the behavior; these pin the two
// source seams the engine suite cannot both reach in one place.
try {
  var _fsOP = require("fs"), _pathOP = require("path");
  var _gmOP = _fsOP.readFileSync(_pathOP.join(__dirname, "..", "game.js"), "utf8");
  if (_gmOP.indexOf("finally{saveAll();}/* #280b") < 0) {
    console.error("#272/#280b ONE-POST CONTRACT: generateActions lost its completion sync — the server strands on the E26 null and the second device renders no buttons again.");
    process.exit(1);
  }
  if (_gmOP.indexOf("saveLocal();\n  var narEl=addMsg(\"narrator\"") < 0) {
    console.error("#272/#280b ONE-POST CONTRACT: the narration commit no longer persists local-only before display — either UA6 ordering broke or the second full-state POST per turn returned.");
    process.exit(1);
  }
} catch (eOP) { console.error("#272 ONE-POST CONTRACT CHECK FAILED: " + (eOP && eOP.message)); process.exit(1); }

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

// ── APPEARANCE WRITE CONTRACT (v1.460) ────────────────────────────────────────────────────
// "Replace appearance doesn't replace" (bug report 2026-07-27). Two defects behind one symptom:
// ① showNpcSheet builds `npcSubject` as a THROWAWAY object literal when the NPC has no
//    charSheet, and the modal wrote `c.appear = desc` straight onto it — so for a sheet-less
//    party member the description went into an object that was discarded on close. Silent,
//    total loss, with a success toast on top.
// ② Nothing repainted the sheet under the modal, so even the CORRECT player write looked like a
//    no-op until the sheet was closed and reopened.
// The fix is a caller-supplied `setAppearance` seam (same shape as get/setPortrait). These pin it:
// a raw `c.appear=` write returning would silently restore defect ①.
try {
  var _fsAW = require("fs"), _pathAW = require("path");
  var _failAW = function (m) { console.error("APPEARANCE WRITE CONTRACT: " + m); process.exit(1); };
  var _pmAW = _fsAW.readFileSync(_pathAW.join(__dirname, "..", "ui-portrait.js"), "utf8");
  var _shAW = _fsAW.readFileSync(_pathAW.join(__dirname, "..", "ui-sheets.js"), "utf8");
  if (/\bc\.appear\s*=/.test(_pmAW))
    _failAW("ui-portrait.js writes c.appear directly again — for a sheet-less NPC `c` is a throwaway literal, so the description is lost silently (the original bug).");
  if (_pmAW.indexOf("opts.setAppearance") < 0)
    _failAW("the setAppearance seam is gone from showPortraitModal — callers can no longer route the write to a durable home.");
  if (!/setAppear\(desc\)\s*===\s*false/.test(_pmAW))
    _failAW("the Replace handler no longer honours a refusal — a rejected write would clear the panel and discard a description that cost a vision call.");
  if (!/setAppear\(\(c\.appear\?c\.appear\+\" \"\:\"\"\)\+desc\)\s*===\s*false/.test(_pmAW))
    _failAW("the Append handler no longer honours a refusal — a sheet-less NPC would report success for a description that was never stored.");
  if (_shAW.indexOf("setAppearance:") < 0)
    _failAW("showNpcSheet no longer supplies setAppearance — the NPC path falls back to the default writer, which targets the PLAYER (the v1.43 cross-subject class).");
  if (!/wsNpc\.charSheet\.appear\s*=\s*text/.test(_shAW))
    _failAW("the NPC writer no longer targets wsNpc.charSheet.appear — that is the only durable home for a companion's appearance.");
  if (_shAW.indexOf("No character sheet for") < 0)
    _failAW("the sheet-less refusal message is gone — writing would silently no-op instead of telling the user to generate a sheet (no-silent-failures).");
  // v1.461: the sheet under the modal is a STATIC render (its Appearance row paints once, at
  // open), so an edit here is invisible until it is rebuilt. Repaint on CLOSE — the modal sits at
  // z-index 400 over the sheet's 300, so a per-write repaint is both invisible and wasteful, and
  // one exit covers appearance + portrait + framing alike. These pin the whole mechanism.
  if (!/function pmClose\(\)\{modal\.remove\(\);if\(_pmDirty\)refreshSheet\(\);\}/.test(_pmAW))
    _failAW("pmClose no longer repaints the sheet — every edit made in the portrait modal goes invisible until the sheet is closed and reopened (the original report).");
  if (!/onClose:function\(\)\{pmClose\(\);\}/.test(_pmAW))
    _failAW("the modal's onClose no longer routes through pmClose — the x button and outside-click would skip the repaint, so only the three internal close paths would refresh.");
  if ((_pmAW.match(/_pmDirty=true/g) || []).length < 6)
    _failAW("a write path in the portrait modal stopped marking the sheet stale — that edit will not repaint on close. Expected 6 (appearance replace/append, portrait remove/url/file, framing drag).");
} catch (e) { console.error("APPEARANCE WRITE CONTRACT CHECK FAILED: " + (e && e.message)); process.exit(1); }

// ── UNLOAD STAMP CONTRACT (v1.432; re-homed from the BYPASS EVIDENCE CONTRACT at v1.455) ──
// The pagehide/beforeunload hooks append a final "unload" crumb, which is the ONLY thing that
// lets erPrevDirty tell a jetsam kill from a clean close. Lose it and every recovered ring is
// labeled "ended without unload" again — the overstated-evidence bug v1.432 fixed.
// (The contract's second half — the bypass-run boot report in tts.js — was removed with the
// B9 experiment itself in #97/v1.455. This half guards a LIVE consumer: the diag label in
// erDiagBlock, error-report.js.)
try {
  var _fsB = require("fs"), _pathB = require("path");
  var _ncB = function (t) { return String(t).replace(/\/\/[^\n]*/g, "").replace(/\/\*[\s\S]*?\*\//g, ""); };
  var _erB = _ncB(_fsB.readFileSync(_pathB.join(__dirname, "..", "error-report.js"), "utf8"));
  if (_erB.indexOf('erCrumb("unload")') < 0) {
    console.error("UNLOAD STAMP CONTRACT: the pagehide/beforeunload unload stamp is gone from error-report.js — erPrevDirty can no longer distinguish a kill from a clean close, so every recovered ring would again be labeled 'ended without unload' in the crash diag (v1.432).");
    process.exit(1);
  }
} catch (e) { console.error("UNLOAD STAMP CONTRACT CHECK FAILED: " + e.message); process.exit(1); }

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
  // Ladder order. Amended at #41 (v1.646) to admit the Gemini tier ABOVE server. The clause is
  // stated as invariants rather than one literal string so a future tier doesn't force a rewrite,
  // and it is STRICTER than the old literal: it now also pins that the paid tier cannot sink below
  // the free ones, which is what makes a degrade actually degrade.
  var _ladM = _ttsS.match(/var TTS_LADDER = \[([^\]]*)\]/);
  if (!_ladM) {
    console.error("SERVER TTS CONTRACT: TTS_LADDER not found — the runtime degradation ladder is the #90 design's spine.");
    process.exit(1);
  }
  var _lad = _ladM[1].replace(/["'\s]/g, "").split(",");
  if (_lad[_lad.length - 1] !== "native") {
    console.error("SERVER TTS CONTRACT: native is no longer the LAST rung of TTS_LADDER — native's available() is the only unconditional true, so the ladder walk would run off the end. Got: " + _lad.join(" → "));
    process.exit(1);
  }
  if (_lad.indexOf("server") < 0 || _lad.indexOf("piper") < 0) {
    console.error("SERVER TTS CONTRACT: TTS_LADDER lost the server or piper tier — the ratified #90 design keeps server for connected players and local Piper as the offline floor. Got: " + _lad.join(" → "));
    process.exit(1);
  }
  if (_lad.indexOf("server") >= _lad.indexOf("piper")) {
    console.error("SERVER TTS CONTRACT: server must sit ABOVE piper (server first for connected players — the B9 close). Got: " + _lad.join(" → "));
    process.exit(1);
  }
  if (_lad.indexOf("gemini") >= 0 && _lad.indexOf("gemini") >= _lad.indexOf("server")) {
    console.error("SERVER TTS CONTRACT: the paid Gemini tier must sit ABOVE the free tiers, so a failure degrades toward free rather than toward spend. Got: " + _lad.join(" → "));
    process.exit(1);
  }
  // #41 (v1.648): the ▶ Test pulse. Two clauses no headless test can reach, because the audition
  // path runs through the queue and a real AudioContext.
  //   ⓐ ORDER: testGeminiVoice must arm its phase callback AFTER its own stop() call. stop() signals
  //     "idle" to cancel a previous audition, so arming first has stop() immediately clear the brand
  //     new callback and the button never pulses at all — a silent, plausible-looking failure.
  //   ⓑ stop() must signal idle, or a modal closed mid-fetch leaves the button pulsing forever.
  var _tgS = _ncS((_ttsS.match(/function testGeminiVoice\([\s\S]*?\n  \}\n/) || [""])[0]);
  if (_tgS) {
    var _iStop = _tgS.indexOf("stop()"), _iArm = _tgS.indexOf("_auditionCb =");
    if (_iStop < 0 || _iArm < 0) {
      console.error("GEMINI TTS CONTRACT: testGeminiVoice no longer both stops the previous read and arms the audition callback — the ▶ Test pulse depends on both.");
      process.exit(1);
    }
    if (_iArm < _iStop) {
      console.error("GEMINI TTS CONTRACT: testGeminiVoice arms its phase callback BEFORE stop() — stop() signals idle, so it will clear the callback that was just set and the ▶ Test button will never pulse (v1.648).");
      process.exit(1);
    }
  }
  var _stopS = _ncS((_ttsS.match(/function stop\(\)[\s\S]*?\n  \}\n/) || [""])[0]);
  if (_stopS && _stopS.indexOf("_auditionPhase") < 0) {
    console.error("GEMINI TTS CONTRACT: stop() no longer clears the audition phase — a settings modal closed mid-fetch leaves the ▶ Test button pulsing forever (v1.648).");
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
  var _sendStartS = _gameS.indexOf("async function sendAction");
  var _sendEndS = _gameS.indexOf("function retryLast", _sendStartS);
  var _sendS = (_sendStartS >= 0 && _sendEndS > _sendStartS) ? _gameS.slice(_sendStartS, _sendEndS) : "";
  if (!/if\(typeof TTS!=="undefined"&&typeof TTS\.prewarmServer==="function"\)TTS\.prewarmServer\(\);/.test(_sendS)) {
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
  /* #28 (v1.670): the player transcript write moved INTO commitGmTurn (commit-time logging — no
     pre-call write can orphan). The isolation got STRONGER — TT structurally never reaches
     commitGmTurn — but the flag that authorizes the write still travels from sendAction and MUST
     keep its !isTT guard, and the write itself must stay inside commitGmTurn behind that flag. */
  _ttReq("transcript logPlayer flag guarded by !isTT (commit-time write, #28)", /logPlayer:\(!isTT&&!\(opts&&opts\.silent\)\)/.test(_game));
  _ttReq("the player transcript write lives inside commitGmTurn behind o.logPlayer (#28)", /if\(o\.logPlayer&&o\.playerTxt!=null&&!o\.isOpening\)logTranscript\("player"/.test(_game));
  _ttReq("summarize guarded by !isTT", /if\(!isTT&&sessionTokens\(\)>=SUMMARIZE_AT\)/.test(_game));
  _ttReq("engine notes guarded by !isTT", /if\(!isTT&&!\(opts&&opts\.silent\)\)\{var _latchSnap=snapshotNoteLatches\(\);[^\n]*var _en=buildEngineNotes/.test(_game));/* #151 widened the pinned line: the latch snapshot sits INSIDE the same !isTT gate (TT/silent paths neither build notes nor snapshot), so the isolation intent is unchanged */
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

// ── INJECTION SINK CONTRACT (v1.520, ChatGPT review 2026-08-01) ──────────────────────────
// Normal narration is escaped everywhere (escHtml/escProse, audit E11), but the review found
// two sinks that still rendered UNTRUSTED text via innerHTML: the legacy server-blob
// narrativeHtml fallback (storage-adapter) and raw err.message error lines (char-creation /
// ui-portrait). With provider keys in localStorage, any such sink is a credential-theft
// vector, not a cosmetic bug. Source contracts because the sinks are DOM paths the headless
// harness can't execute; comments are stripped before matching (the VOICE DELETE precedent —
// the fix's own comments name the bad pattern).
try {
  var _fsX = require("fs"), _pathX = require("path");
  var _rootX = _pathX.join(__dirname, "..");
  var _ncX = function (t) { return String(t).replace(/\/\/[^\n]*/g, "").replace(/\/\*[\s\S]*?\*\//g, ""); };
  // ① The narrativeHtml innerHTML sink stays dead. The transcript is the canonical record;
  //    pre-transcript blobs degrade to initReplaySession's escaped fallbacks.
  var _sadX = _ncX(_fsX.readFileSync(_pathX.join(_rootX, "storage-adapter.js"), "utf8"));
  if (/innerHTML\s*=\s*[^;\n]*narrativeHtml/.test(_sadX)) {
    console.error("INJECTION SINK CONTRACT: storage-adapter.js renders narrativeHtml via innerHTML again — server-blob HTML is untrusted; rebuild from the transcript (rebuildNarrativeFromTranscript / initReplaySession) instead.");
    process.exit(1);
  }
  if (_sadX.indexOf("initReplaySession") < 0) {
    console.error("INJECTION SINK CONTRACT: storage-adapter.js lost the initReplaySession fallback after server adopt — pre-transcript blobs would show an empty story pane silently.");
    process.exit(1);
  }
  // ② No file may concatenate an error's .message into innerHTML unescaped. err.message can
  //    carry provider/network response text — attacker-influenced on a hostile endpoint.
  var _uiFilesX = _fsX.readdirSync(_rootX).filter(function (f) { return /\.js$/.test(f) && f !== "sw.js"; });
  var _sinkHitsX = [];
  _uiFilesX.forEach(function (f) {
    _ncX(_fsX.readFileSync(_pathX.join(_rootX, f), "utf8")).split("\n").forEach(function (line, i) {
      // Inspect the ASSIGNED EXPRESSION only, not the whole physical line — game.js packs an
      // innerHTML assignment and a legit showToast err.message read into one dense line (first
      // run's false positive). The statement ends at the first ';' OUTSIDE quotes: a naive
      // [^;]* stops inside "color:var(--red);" and truncates the expression before
      // err.message — sabotage caught that as a MISSED clause on the first proof run.
      var mX, reX = /\.innerHTML\s*=\s*/g;
      while ((mX = reX.exec(line))) {
        var exprX = "", qX = "", jX, chX;
        for (jX = mX.index + mX[0].length; jX < line.length; jX++) {
          chX = line.charAt(jX);
          if (qX) { if (chX === "\\") { exprX += chX + line.charAt(jX + 1); jX++; continue; } if (chX === qX) qX = ""; }
          else if (chX === "'" || chX === '"') qX = chX;
          else if (chX === ";") break;
          exprX += chX;
        }
        if (/\.message\b/.test(exprX) && exprX.indexOf("escHtml(") < 0) {
          _sinkHitsX.push(f + ":" + (i + 1) + "  " + line.trim().slice(0, 120));
        }
      }
    });
  });
  if (_sinkHitsX.length) {
    console.error("INJECTION SINK CONTRACT: .message rendered via innerHTML without escHtml() — wrap it (error text is untrusted):");
    _sinkHitsX.forEach(function (h) { console.error("  - " + h); });
    process.exit(1);
  }
} catch (e) { console.error("INJECTION SINK CHECK FAILED: " + e.message); process.exit(1); }

// ── BUG TRACKER SATELLITE CONTRACT (Fable f75, 2026-08-27) ─────────────────────────────
// The webhook feed and DOC/BUGS.md bodies are attacker-controlled text rendered on the same
// origin that holds provider keys. This satellite is HTML, so the .js-only generic scan above
// cannot see it; its own contract bans executable-HTML sinks altogether and pins the textContent
// funnel that every report field uses. Deliberately NOT a .message-specific pattern: this page's
// untrusted surface includes report/detail/meta/findings/actions and future feed fields.
try {
  var _fsBT = require("fs"), _pathBT = require("path");
  var _pageBT = _fsBT.readFileSync(_pathBT.join(__dirname, "..", "bug_tracker.html"), "utf8");
  var _scriptMatchBT = _pageBT.match(/<script>([\s\S]*?)<\/script>/);
  if (!_scriptMatchBT) throw new Error("script block not found — update the satellite contract for the new shape");
  var _codeBT = _scriptMatchBT[1].replace(/\/\/[^\n]*/g, "").replace(/\/\*[\s\S]*?\*\//g, "");
  var _htmlSinkBT = /\.(?:innerHTML|outerHTML)\s*=|insertAdjacentHTML\s*\(|document\.write(?:ln)?\s*\(/;
  if (_htmlSinkBT.test(_codeBT)) {
    console.error("BUG TRACKER INJECTION CONTRACT: executable-HTML sink found — report-derived text must stay in textContent/createTextNode on this satellite.");
    process.exit(1);
  }
  var _elBT = _codeBT.slice(_codeBT.indexOf("function el("), _codeBT.indexOf("function copyText("));
  if (!_elBT || !/e\.textContent\s*=\s*text/.test(_elBT)) {
    console.error("BUG TRACKER INJECTION CONTRACT: el() lost its textContent assignment — every report-derived field routes through this inert-text boundary.");
    process.exit(1);
  }
  [
    'el("pre","report",b.report)',
    'el("pre","report",body)',
    'el("div","sectext",text)'
  ].forEach(function(sink) {
    if (_codeBT.indexOf(sink) < 0) {
      console.error("BUG TRACKER INJECTION CONTRACT: report-derived text no longer reaches the pinned inert sink: " + sink);
      process.exit(1);
    }
  });
  if (_codeBT.indexOf("window.__bugTrackerTest") < 0 ||
      !/window\.__bugTrackerTest\s*=\s*\{[\s\S]*?parseBugs\s*:\s*parseBugs[\s\S]*?renderBug\s*:\s*renderBug[\s\S]*?renderFeedReport\s*:\s*renderFeedReport/.test(_codeBT)) {
    console.error("BUG TRACKER CONTRACT: window.__bugTrackerTest must expose parseBugs, renderBug, and renderFeedReport so the untrusted render paths stay browser-drivable.");
    process.exit(1);
  }
  console.log("[bug-tracker] contract OK — report fields stay inert and browser seam is present");
} catch (e) { console.error("BUG TRACKER CONTRACT CHECK FAILED: " + e.message); process.exit(1); }

// ── #17 / P2-03 GROWTH TELEMETRY CONTRACT ──────────────────────────────────────────────
// Byte measurement is deliberately modal-only: putting it on updateHealthDot's hot path would
// JSON-stringify the mature transcript/memory repeatedly just to paint a tiny status marker.
try {
  var _fsGT = require("fs"), _pathGT = require("path");
  var _hmGT = _fsGT.readFileSync(_pathGT.join(__dirname, "..", "ui-modals.js"), "utf8");
  if (_hmGT.indexOf('healthIndicators(worldState,(typeof memory!=="undefined"?memory:null),true)') < 0) {
    console.error("GROWTH TELEMETRY CONTRACT: the #17 modal no longer opts into pure world+memory byte measurement.");
    process.exit(1);
  }
  if (_hmGT.indexOf("growth=h.growth||[]") < 0 || _hmGT.indexOf("UTF-8 JSON bytes") < 0 ||
      _hmGT.indexOf("gr.count.toLocaleString()") < 0 || _hmGT.indexOf("growthSize(gr.bytes)") < 0) {
    console.error("GROWTH TELEMETRY CONTRACT: the #17 modal no longer renders the measured per-store bytes/counts truthfully.");
    process.exit(1);
  }
} catch (eGT) { console.error("GROWTH TELEMETRY CONTRACT CHECK FAILED: " + (eGT && eGT.message)); process.exit(1); }

// ── BIBLE-SERVER WRITE-AUTH CONTRACT (v1.521, ChatGPT review 2026-08-01) ─────────────────
// dev/bible-server.js binds loopback, but ANY webpage open while it runs can POST to
// localhost, and install-bible validates shape, not author intent — so /install requires a
// per-run random token printed at server startup. The supported Bible Editor is instead served
// from localhost: its browser-set Origin is the authority, so it must never ask the user for a
// token. These clauses pin both routes: local-origin/token auth is checked before the body, the
// editor is prompt-free, and the legacy necro tool still carries the fallback token.
try {
  var _fsB = require("fs"), _pathB = require("path");
  var _rootB = _pathB.join(__dirname, "..");
  var _ncB = function (t) { return String(t).replace(/\/\/[^\n]*/g, "").replace(/\/\*[\s\S]*?\*\//g, ""); };
  var _srvB = _ncB(_fsB.readFileSync(_pathB.join(_rootB, "dev", "bible-server.js"), "utf8"));
  // ① The token must be RANDOM PER RUN — a constant would be shared by every drive-by page.
  if (!/TOKEN\s*=\s*crypto\.randomBytes\(/.test(_srvB)) {
    console.error("BIBLE-SERVER WRITE-AUTH: TOKEN is no longer crypto.randomBytes per run — a static/absent token lets any local webpage write the bible while the server runs.");
    process.exit(1);
  }
  // ② The guard itself, refusing with 403, BEFORE the body is accepted.
  if (!/req\.headers\[["']x-bible-token["']\]\s*!==\s*TOKEN/.test(_srvB) || !/send\(403/.test(_srvB)) {
    console.error("BIBLE-SERVER WRITE-AUTH: /install lost the x-bible-token !== TOKEN → 403 guard — writes are open to any local webpage again.");
    process.exit(1);
  }
  if (_srvB.indexOf("x-bible-token") > _srvB.indexOf('var body = ""')) {
    console.error("BIBLE-SERVER WRITE-AUTH: the token check moved AFTER the body read — refuse before accepting an unauthenticated upload.");
    process.exit(1);
  }
  // ③ CORS must allow the header or the browser preflight silently kills authorized saves.
  if (!/Access-Control-Allow-Headers[^\n]*X-Bible-Token/.test(_srvB)) {
    console.error("BIBLE-SERVER WRITE-AUTH: Access-Control-Allow-Headers lost X-Bible-Token — the browser preflight would strip auth and every save 403s.");
    process.exit(1);
  }
  // ④ Both clients keep one POST boundary. The supported editor has NO credential UI; the
  //    legacy file:// necro tool retains the token fallback until it gains its own launcher.
  var _editorAuth = _ncB(_fsB.readFileSync(_pathB.join(_rootB, "bible_editor.html"), "utf8"));
  if ((_editorAuth.match(/\/install"/g) || []).length !== 1 ||
      _editorAuth.indexOf("X-Bible-Token") >= 0 || _editorAuth.indexOf("srvToken") >= 0 ||
      _editorAuth.indexOf("bible-server write token") >= 0) {
    console.error("BIBLE-SERVER WRITE-AUTH: bible_editor.html must have one /install boundary and ZERO write-token headers/prompts — Bible Editor.cmd supplies localhost authority.");
    process.exit(1);
  }
  var _necroAuth = _ncB(_fsB.readFileSync(_pathB.join(_rootB, "necro_spells_TMP.html"), "utf8"));
  if ((_necroAuth.match(/\/install"/g) || []).length !== 1 || _necroAuth.indexOf("X-Bible-Token") < 0) {
    console.error("BIBLE-SERVER WRITE-AUTH: necro_spells_TMP.html lost its single authenticated /install boundary.");
    process.exit(1);
  }
} catch (e) { console.error("BIBLE-SERVER WRITE-AUTH CHECK FAILED: " + e.message); process.exit(1); }

// ── ENGINE MANIFEST CONTRACT (ChatGPT review 2026-08-01, finding 5 — the #17 rot class) ──
// dev/engine-manifest.js is THE ordered engine list; node (load-engine.js) and the browser
// test page (test.html) both derive from it. These clauses pin the two relationships that
// used to rot silently: manifest ↔ index.html (an engine file added to the shell but not the
// manifest = tests quietly stop covering it) and test.html ↔ manifest (a static tag creeping
// back = the manual-copy class returns).
try {
  var _fsM = require("fs"), _pathM = require("path");
  var _rootM = _pathM.join(__dirname, "..");
  var _manifest = require("./engine-manifest.js");
  var _manFiles = _manifest.map(function (e) { return e.file; });
  // ① Derive the expectation FROM index.html: its <script src> order, minus the DOM-wiring
  //    files (wasm-probe, char-creation, ui-*, stt). class_bible.js needs no special insert
  //    since C6-② (2026-08-03) put it in the real shell load order.
  var _idxM = _fsM.readFileSync(_pathM.join(_rootM, "index.html"), "utf8");
  var _idxScripts = [], _mIdx, _reIdx = /<script src="([^"]+\.js)"/g;
  while ((_mIdx = _reIdx.exec(_idxM))) if (_mIdx[1].indexOf("/") < 0) _idxScripts.push(_mIdx[1]);
  var _expected = _idxScripts.filter(function (f) {
    return !(f === "wasm-probe.js" || f === "char-creation.js" || f === "stt.js" || /^ui-/.test(f));
  });
  if (_expected.join("|") !== _manFiles.join("|")) {
    console.error("ENGINE MANIFEST CONTRACT: dev/engine-manifest.js no longer matches index.html's engine load order.");
    console.error("  expected (from index.html): " + _expected.join(", "));
    console.error("  manifest:                   " + _manFiles.join(", "));
    console.error("  An engine file added to index.html must land in the manifest in the same commit — otherwise the tests silently stop loading it.");
    process.exit(1);
  }
  // ② Every manifest entry carries a load-guard symbol (test.html names missing files by it).
  var _badSym = _manifest.filter(function (e) { return !e.sym; });
  if (_badSym.length) {
    console.error("ENGINE MANIFEST CONTRACT: manifest entries missing a sym (test.html's load guard goes blind): " + _badSym.map(function (e) { return e.file; }).join(", "));
    process.exit(1);
  }
  // ③ test.html generates its tags from the manifest — no static engine tag may creep back.
  var _thM = _fsM.readFileSync(_pathM.join(_rootM, "test.html"), "utf8");
  if (_thM.indexOf('src="dev/engine-manifest.js"') < 0 || _thM.indexOf("ENGINE_MANIFEST") < 0) {
    console.error("ENGINE MANIFEST CONTRACT: test.html no longer loads dev/engine-manifest.js / generates its tags from ENGINE_MANIFEST — the manual-copy rot class (#17) is back.");
    process.exit(1);
  }
  var _staticTags = _manFiles.filter(function (f) { return _thM.indexOf('<script src="' + f + '"') >= 0; });
  if (_staticTags.length) {
    console.error("ENGINE MANIFEST CONTRACT: test.html has static engine <script> tags again (" + _staticTags.join(", ") + ") — they shadow the generated list and will rot; remove them (the manifest loop writes every tag).");
    process.exit(1);
  }
} catch (e) { console.error("ENGINE MANIFEST CHECK FAILED: " + e.message); process.exit(1); }

// ── PERFORMANCE BENCH LOADER CONTRACT (Sol review P2-02, 2026-08-28) ─────────
// A benchmark that hand-copies engine order can fail before measuring anything while the real
// suite stays green. Both committed benches must take the complete order from load-engine.js,
// and their comparison labels must describe the controls they actually execute today.
try {
  var _benchSpecsM = [
    { file: "dev/bench-lz-memo.js", control: "CONTROL (memo reset every call)", current: "CURRENT (memo live)" },
    { file: "dev/bench-rag-memo.js", control: "CONTROL (wrapper memos reset every call)", current: "CURRENT (wrapper memos live)" }
  ];
  for (var _biM = 0; _biM < _benchSpecsM.length; _biM++) {
    var _bsM = _benchSpecsM[_biM];
    var _benchM = _fsM.readFileSync(_pathM.join(_rootM, _bsM.file), "utf8");
    var _benchCodeM = _benchM.replace(/\/\/[^\n]*/g, "").replace(/\/\*[\s\S]*?\*\//g, "");
    if (!/require\(["']\.\/load-engine\.js["']\)/.test(_benchCodeM) ||
        !/\.loadEngine\(\)/.test(_benchCodeM) || !/\.FILES/.test(_benchCodeM) ||
        /var\s+files\s*=\s*\[/.test(_benchCodeM)) {
      console.error("BENCH LOADER CONTRACT: " + _bsM.file + " must derive the COMPLETE engine order from dev/load-engine.js; copied or partial file lists silently rot.");
      process.exit(1);
    }
    if (_benchCodeM.indexOf(_bsM.control) < 0 || _benchCodeM.indexOf(_bsM.current) < 0 ||
        /git show HEAD:memory\.js|BEFORE \(|AFTER\s+\(/.test(_benchCodeM)) {
      console.error("BENCH LABEL CONTRACT: " + _bsM.file + " must name the current control and memo-live paths honestly; HEAD is not a pre-memo baseline.");
      process.exit(1);
    }
  }
} catch (e) { console.error("PERFORMANCE BENCH CONTRACT FAILED: " + e.message); process.exit(1); }

// ── #14 PENDING ACTION CONTRACT (v1.530, B16 residual) ───────────────────────────────────
// The helpers are engine-tested; these pin the WIRING the DOM path owns — each clause is a
// coupling the B16 record explicitly warned about, so a drop is a regression by name.
try {
  var _fsP = require("fs"), _pathP = require("path");
  var _rootP = _pathP.join(__dirname, "..");
  var _ncP = function (t) { return String(t).replace(/\/\/[^\n]*/g, "").replace(/\/\*[\s\S]*?\*\//g, ""); };
  var _gameP = _ncP(_fsP.readFileSync(_pathP.join(_rootP, "game.js"), "utf8"));
  var _bootP = _ncP(_fsP.readFileSync(_pathP.join(_rootP, "ui-boot.js"), "utf8"));
  // ① The story-failure path persists the action (TT excluded — cross-channel restore).
  if (!/if\(!isTT\)savePendingAction\(txt\)/.test(_gameP)) {
    console.error("PENDING ACTION CONTRACT: the sendAction failure path no longer persists the story action — a page kill before the retry tap erases the player's words again (B16).");
    process.exit(1);
  }
  // ② A committed turn clears it — without this, a stale draft haunts every reload. The pin is
  //    the guarded CALL inside commitGmTurn's own span (ending at restoreFailedInput, the next
  //    function): the first sabotage run matched the helper DEFINITION through an over-wide
  //    slice and reported the clause green while the call was gone (MISSED, 2026-08-03).
  var _cgtP = _gameP.slice(_gameP.indexOf("function commitGmTurn"), _gameP.indexOf("function restoreFailedInput"));
  if (!/if\(typeof clearPendingAction==="function"\)clearPendingAction\(\);/.test(_cgtP)) {
    console.error("PENDING ACTION CONTRACT: commitGmTurn no longer clears the pending action — a successful turn must supersede the persisted draft.");
    process.exit(1);
  }
  // ③ Boot restores THROUGH restoreFailedInput (its refuse-to-clobber rule is load-bearing:
  //    an STT draft typed before the restore outranks the failed action).
  if (_bootP.indexOf("restorePendingAction()") < 0 || !/restoreFailedInput\(\s*_pi\s*,\s*_pa\s*\)/.test(_bootP)) {
    console.error("PENDING ACTION CONTRACT: ui-boot no longer restores via restoreFailedInput — a direct .value= write would clobber a fresh draft (the B16 refuse-to-clobber rule).");
    process.exit(1);
  }
  // ④ The persist helper writes its OWN key and never saveAll (a failure-path flush would also
  //    persist the orphan player transcript entry — the row's second warning).
  var _spaP = _gameP.slice(_gameP.indexOf("function savePendingAction"), _gameP.indexOf("function clearPendingAction"));
  if (_spaP.indexOf("store.set(PENDING_ACT_K") < 0 || _spaP.indexOf("saveAll") >= 0) {
    console.error("PENDING ACTION CONTRACT: savePendingAction must write ONLY its own key (store.set(PENDING_ACT_K,...)), never saveAll — a failure-path flush persists the orphan transcript entry.");
    process.exit(1);
  }
} catch (e) { console.error("PENDING ACTION CHECK FAILED: " + e.message); process.exit(1); }

// ── #113 STT UPGRADES CONTRACT (v1.536 — DOC/Research/DOC_whisper_stt.html §4, user go 2026-08-03) ──
// stt.js is a DOM-wiring file the headless harness never loads, so the four car-fix wirings
// are pinned as source contracts (sttBiasPrompt itself is engine-tested in helpers).
try {
  var _fsS = require("fs"), _pathS = require("path");
  var _ncS = function (t) { return String(t).replace(/\/\/[^\n]*/g, "").replace(/\/\*[\s\S]*?\*\//g, ""); };
  var _stt = _ncS(_fsS.readFileSync(_pathS.join(__dirname, "..", "stt.js"), "utf8"));
  // §4a — the bias rides every transcription request (a silent drop resurrects Frizwick→Physics).
  if (!/form\.append\("prompt",\s*bias\)/.test(_stt) || _stt.indexOf("sttBiasPrompt") < 0) {
    console.error("STT UPGRADES: the Whisper prompt-bias append is gone from _transcribeOnce — fantasy nouns decode as homophones again (#113 §4a).");
    process.exit(1);
  }
  // §4b — primary model constant + the loud one-retry fallback path.
  if (!/STT_CLOUD_MODEL\s*=/.test(_stt) || !/STT_CLOUD_FALLBACK\s*=/.test(_stt) || !/_transcribeOnce\(blob,\s*ext,\s*key,\s*STT_CLOUD_FALLBACK\)/.test(_stt)) {
    console.error("STT UPGRADES: the model constants / fallback retry are gone — a primary-model failure now means a silently dead mic (#113 §4b).");
    process.exit(1);
  }
  if (/form\.append\("model",\s*"whisper-1"\)/.test(_stt)) {
    console.error("STT UPGRADES: a hardcoded whisper-1 model append crept back — route through STT_CLOUD_MODEL/STT_CLOUD_FALLBACK.");
    process.exit(1);
  }
  // §4c — the cap runs on the constant (no literal 15000 wall) and every teardown kills the VAD.
  if (!/},\s*STT_MAX_RECORD_MS\)/.test(_stt) || /,\s*15000\)/.test(_stt)) {
    console.error("STT UPGRADES: the recording cap no longer runs on STT_MAX_RECORD_MS — the 15s wall is back (#113 §4c).");
    process.exit(1);
  }
  var _tdS = _stt.slice(_stt.indexOf("function _cloudTeardownStream"), _stt.indexOf("function _cloudFinish"));
  if (_tdS.indexOf("_vadStop()") < 0) {
    console.error("STT UPGRADES: _cloudTeardownStream no longer stops the VAD monitor — the poll/source leak across takes (monotonic-resources rule).");
    process.exit(1);
  }
  // §4d — the mic-path telemetry that makes the narrowband-BT car case visible in reports.
  if (_stt.indexOf("getSettings") < 0 || !/erCrumb\("stt-mic"/.test(_stt)) {
    console.error("STT UPGRADES: the mic getSettings → #16 crumb telemetry is gone — the suspected dominant car factor becomes invisible again (#113 §4d).");
    process.exit(1);
  }
} catch (e) { console.error("STT UPGRADES CHECK FAILED: " + e.message); process.exit(1); }

// ── #77 CONFIRM GATE CONTRACT (v1.548 — DOC/Research/DOC_nonsense_filter.html §4) ─────────────────
// The pure half (sttConfidence/sttSuspicion/parseConfirmCommand/sttLogEvent) is engine-tested
// in helpers; the stt.js wiring is pinned here because the harness never loads DOM files.
try {
  var _fsC = require("fs"), _pathC = require("path");
  var _ncC = function (t) { return String(t).replace(/\/\/[^\n]*/g, "").replace(/\/\*[\s\S]*?\*\//g, ""); };
  var _sttC = _ncC(_fsC.readFileSync(_pathC.join(__dirname, "..", "stt.js"), "utf8"));
  // ① Interceptor ORDER: the pending-confirmation branch must precede the carVoiceCommand
  //    block inside _applySendPolicy — otherwise a spoken "no" (2 chars) is eaten by the
  //    rank-8 gate, a "two" answers the #78 menu instead of the confirmation, and busy parks
  //    the answer as an action (the #78 ordering lesson, one rung higher).
  var _aspC = _sttC.slice(_sttC.indexOf("function _applySendPolicy"), _sttC.indexOf("function _enterConfirm"));
  var _iConf = _aspC.indexOf("_confirmPending"), _iCar = _aspC.indexOf("carVoiceCommand");
  if (_iConf < 0 || (_iCar >= 0 && _iConf > _iCar)) {
    console.error("CONFIRM GATE: the _confirmPending interceptor no longer sits ABOVE carVoiceCommand in _applySendPolicy — a spoken 'no'/'two' answer gets eaten by the #78 grammar or the short-transcript gate (#77).");
    process.exit(1);
  }
  // ② Layer 0's signal is actually requested: logprobs ride the gpt-4o transcription request.
  if (!/form\.append\("include\[\]",\s*"logprobs"\)/.test(_sttC)) {
    console.error("CONFIRM GATE: the include[]=logprobs request field is gone from _transcribeOnce — the confirm gate's primary confidence signal is silently absent and every cloud utterance reads as no-signal (#77 Layer 0).");
    process.exit(1);
  }
  // ③ A confirmed send uses the PENDING text, never a re-read of the field (the field is
  //    cleared on entry; re-reading it would send the ANSWER word as the action).
  if (!/sendAction\(pend\.text\)/.test(_sttC)) {
    console.error("CONFIRM GATE: _resolveConfirm no longer sends the stored pending text — a confirmed turn would send the wrong string (#77 Layer 2).");
    process.exit(1);
  }
} catch (e) { console.error("CONFIRM GATE CHECK FAILED: " + e.message); process.exit(1); }

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
// INJECTION SINK CONTRACT ③ (behavioral half): escHtml is the one escape everything above
// leans on — prove it neutralizes a script payload, don't assume it.
if (escHtml('<img src=x onerror="alert(1)">&\'"') !== "&lt;img src=x onerror=&quot;alert(1)&quot;&gt;&amp;&#39;&quot;") {
  console.error("INJECTION SINK CONTRACT: escHtml() no longer neutralizes markup — every escaped render in the app just became a sink.");
  process.exit(1);
}
var geval=eval; // indirect eval → global scope (same loader convention as load-engine.js)
/* #199: `require` is module-scoped and invisible to indirect-eval'd tests, so a fixture-reading
   test gets fs through this handle instead. test.html never defines it — browser runs of such
   tests must guard on typeof and skip, keeping node CI the gate for fixture pins. */
global.__fsForTests=fs;global.__rootForTests=path.join(__dirname,"..");
geval(fs.readFileSync(path.join(__dirname,"loc-repair-core.js"),"utf8"));/* #156B: the location repair census/apply core — engine-visible for the identity battery (drives the SHIPPING executors) */
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
// The three audit fragments need isolated fetch/storage globals, so the full gate runs them as
// child processes only after the shared engine suite is green. Filtered sabotage runs skip this
// layer: their named section must remain the only possible attribution source.
if(!filter){
  var _cpStandalone=require("child_process");
  var _standalone=_cpStandalone.spawnSync(process.execPath,[path.join(__dirname,"run-standalone-suites.js")],{cwd:path.join(__dirname,".."),encoding:"utf8"});
  process.stdout.write(String(_standalone.stdout||""));
  process.stderr.write(String(_standalone.stderr||""));
  if(_standalone.status!==0){
    console.error("STANDALONE VERIFIER GATE FAILED — the isolated transport/dedup suites did not all pass.");
    process.exit(1);
  }
}
if(filter){
  console.log("FILTERED GREEN — \""+filterRaw+"\": "+matchedSections+" section(s) matched, "+pass+" assertions passed — NOT the full suite");
}else{
  console.log("ALL GREEN — "+pass+" assertions passed (engine tests)");
}
process.exit(process.exitCode||0);/* #264 class fix: the hard exit(0) WIPED process.exitCode, so every contract that failed via exitCode=1 (the #213 refusal-copy guard, the #279 census, this file's own catch arms) was vacuous on the green-suite path — red output, green exit. All five setters are now effective. */
