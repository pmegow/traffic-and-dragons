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
  _vCase("magical + martial AND arcane passes (a spellblade is both)", "power strike", { isMagical: true, category: ["martial", "arcane"] }, false);
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
  // ...and the page must actually render the grips and route drops through moveFeat
  if (_bePage.indexOf("data-frow") < 0 || _bePage.indexOf("class='grip'") < 0)
    _failBE("the feature rows no longer carry the ⋮⋮ grip / data-frow — nothing is draggable");
  if (!/moveFeat\(/.test(_bePage.slice(_bePage.indexOf("function wireClass"))))
    _failBE("wireClass never routes a drop through moveFeat — the grips are decoration");

  // The mtime-based staleness pre-check was REMOVED at v1.486 (user call): re-reading the file
  // does not clear a dead FSA handle — measured, reload-from-disk then an immediate save still
  // refused — so the check added a prompt and no cure. Kept from that work: the unsaved-edits
  // guard on openBible, which fixed a real silent-data-loss path (opening replaced the tab's
  // contents wordlessly) and is unrelated to the save failure.
  // Pinned by BEHAVIOUR, not by prose: the guard must live inside openBible and be conditional on
  // CUR.dirty. (An earlier version pinned the exact sentence and failed the build the moment the
  // wording was improved — a contract should catch a missing guard, not a reworded one.)

  // ── DEAD HANDLE PURGE (v1.487) ───────────────────────────────────────────────────────
  // Root cause of "I have not once been able to save": the FSA handle is persisted in
  // IndexedDB and restored on every boot, so once it went dead, relaunching the page brought
  // the SAME unusable handle back — forever. There was no delete path at all. A save failure
  // must now purge it from IndexedDB and from memory, or the loop returns.
  // NOT indexOf("function _idbDel") — that substring survives a rename to _idbDelUNUSED, so the
  // clause read as coverage while catching nothing (caught by sabotage, 2026-07-28). Pin the exact
  // signature AND that the body actually deletes from the store.
  if (!/function _idbDel\(k\)/.test(_bePage) || !/objectStore\(FS_STORE\)\["delete"\]\(k\)/.test(_bePage))
    _failBE("_idbDel is gone or no longer deletes — without it a dead file handle is cached in IndexedDB and restored on every launch");
  var _saveFn = _bePage.slice(_bePage.indexOf("function saveBible"), _bePage.indexOf("function downloadCopy"));
  if (_saveFn.indexOf("_idbDel(FS_KEY)") < 0)
    _failBE("saveBible no longer purges the persisted handle on failure — the dead handle will resurrect on the next launch");
  if (_saveFn.indexOf("CUR.handle = null") < 0)
    _failBE("saveBible no longer drops the dead in-memory handle — the UI would keep claiming 'saves in place'");

  // ── USER-ACTIVATION ORDERING (v1.488) ────────────────────────────────────────────────
  // showOpenFilePicker() and requestPermission() need transient user activation, and
  // alert/confirm/prompt CONSUME it. A confirm() placed ahead of the picker at v1.485 meant the
  // picker never opened — and since the picker is the ONLY route to a fresh handle, the editor
  // deadlocked: every Save fell through to a download and nothing could restore it. Pin the order.
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
  var _sb = _slice("function saveBible", "function writeInPlace");
  if (!_sb) _failBE("could not isolate saveBible (writeInPlace split gone?)");
  // NOT /requestPermission/ — that substring survives in the `_pendingHandle.requestPermission`
  // existence guard, so deleting the actual CALL still passed (caught by sabotage). Require an
  // invocation with its options object.
  var _sbPerm = _at(_sb, /requestPermission\(\{/), _sbAsk = _at(_sb, /(confirm|alert|prompt)\(/);
  if (_sbPerm < 0) _failBE("saveBible no longer re-grants write permission — a fresh browser launch always lands in Downloads instead");
  if (_sbAsk >= 0 && _sbAsk < _sbPerm)
    _failBE("saveBible asks a modal question BEFORE requestPermission — that consumes user activation and the permission prompt will fail");
  // and the no-handle path must never dump a download without saying why
  if (/if \(!CUR\.handle\) \{ downloadCopy\(\); return; \}/.test(_bePage))
    _failBE("saveBible silently downloads when there is no handle — it must explain and point at 📂 Open bible…");
  // A successful save must CANCEL the pending debounced draft write before clearing the draft key.
  // Otherwise the timer fires ~600ms later and writes the draft straight back, so the next launch
  // restores a phantom "unsaved" draft for work that was saved — measured through the test hook.
  var _wp = _slice("function writeInPlace", "function downloadCopy");
  if (!_wp) _failBE("could not isolate writeInPlace");
  var _clr = _at(_wp, /clearTimeout\(_saveT\)/), _rm = _at(_wp, /removeItem\(DRAFT_K\)/);
  if (_clr < 0) _failBE("writeInPlace no longer cancels the pending draft debounce — a saved file will reopen as a phantom dirty draft");
  if (_rm >= 0 && _clr > _rm) _failBE("writeInPlace cancels the draft debounce AFTER clearing the draft key — the timer still resurrects it");
  // Save as... clears the draft too, so it needs the SAME cancel — a gap found by dev/sabotage.js
  // when a mutation aimed at writeInPlace landed on this copy instead and nothing caught it.
  var _sa = _slice("function saveAsBible", "function writeInPlace");
  if (!_sa) _failBE("could not isolate saveAsBible");
  var _saClr = _at(_sa, /clearTimeout\(_saveT\)/), _saRm = _at(_sa, /removeItem\(DRAFT_K\)/);
  if (_saRm >= 0 && _saClr < 0) _failBE("saveAsBible clears the draft but never cancels the pending debounce — the draft resurrects after a Save as...");
  if (_saRm >= 0 && _saClr > _saRm) _failBE("saveAsBible cancels the draft debounce AFTER clearing the key — the timer still resurrects it");

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
} catch (e) { console.error("BIBLE EDITOR CONTRACT CHECK FAILED: " + (e && e.message)); process.exit(1); }

// ── VOICE LAB CONTRACT (v1.492, author de-branding experiment) ───────────────────────────
// author_voice_lab.html tests whether 12 shared attribute dials re-create each author's voice
// with NO author name in the prompt (DOC/DOC_author_voice.md). The page's pure core (attrs,
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
  if (_labVL.attrs.length !== 12) _failVL("expected 12 attributes, found " + _labVL.attrs.length + " — update DOC/DOC_author_voice.md and this contract together if the space changes.");
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
  var _cwsCount = (_saN.match(/worldState:\s*compressWorldStateSnapshot\(/g) || []).length;
  if (_cwsCount < 2) {
    console.error("SYNC COMPRESSION CONTRACT: only " + _cwsCount + " of the 2 POST paths (_syncNow payload + pushCampaignState) route worldState through compressWorldStateSnapshot — the 2MB plain-payload class returns (#92).");
    process.exit(1);
  }
} catch (e) { console.error("SYNC COMPRESSION CONTRACT CHECK FAILED: " + (e && e.message)); process.exit(1); }

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
