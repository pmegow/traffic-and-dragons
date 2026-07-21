# Traffic and Dragons — Session Handoff (2026-07-21, rev 2)

**Current deployed version:** `v1.402` (APP_VERSION in globals.js; CACHE `tnd-v3-20260721d` in sw.js).
**Branch:** master — everything committed + pushed, working tree clean except this file.

This session ran long. It covered: the Table Talk rebuild (#76), the campaign clock (#73), the
multiplayer close-out (#1/Q5), a batch of issue closures, and a large **TTS / voice rework (#9)** —
the main in-flight thread. **Read TODO #9 and `todo_checkWithFable.md #4` first** — they are the
source of truth; this file is orientation.

---

## ⚠ IN FLIGHT — pick this up first

**Cartesia dead-code sweep (part of #9).** Cartesia was removed as a user choice in v1.398
(`getEngine()` returns the constant `"piper"`; the modal lost the engine picker + Cartesia panel). The
Cartesia CODE is still present but DORMANT/unreachable. A read-only Sonnet already MAPPED it
(2026-07-21) — **the plan below is ready to execute; you do NOT need to re-analyze.** Line numbers are
as of v1.398 tts.js; the file has since grown (now ~2000 lines after the v1.399–v1.402 voice work) —
**re-grep each symbol to confirm its line before deleting.** Baseline was **57 lines / 71 occurrences
of case-insensitive "cartesia"**; a clean sweep should drop that to ~0.

**DELETE (Cartesia-exclusive) — functions:** `getKey()`, `getVoice()`, `getBank()`, `setBank()`,
`_cartesiaOk()`, `_stream()`, `_streamGo()`, `_updateCartErr()` (already dead — its element is gone),
`_buildVoiceOptions()`, `_buildBankRows()`, `_wireBankDelBtns()`, `_refreshVoiceUI()` (already dead).
**Vars/constants:** `KEY_K`, `VOICE_K`, `BANK_K`, `CARTESIA_SSE_URL`, `CARTESIA_VERSION`,
`CARTESIA_MODEL`, `_cartesiaError`, `_cartesiaErrorAt`, `_abortCtrl`, and the `cartesia:` entry inside
`TTS_PROVIDERS` (delete ONLY that key; keep the table + the `native`/`piper` entries).

**TWO one-line edits inside SHARED functions (do NOT delete the functions):**
- `_drain()`: the `else _stream(item.text, item.voiceId);` clause is the only `_stream` caller and is
  unreachable now (no queue item lacks both `.native` and `.piper`). Drop the `else` clause (keep
  `_drain()` — the shared dispatcher).
- `_stopCurrent()`: the `if (_abortCtrl) {...}` line is dead once `_abortCtrl` is gone. Delete just that
  line (keep `_stopCurrent()` — used by skip/stop for every engine).

**⚠ PROTECT — Cartesia touched these but Piper NEEDS them, do NOT remove:** the whole shared scheduler
`_audioCtx`/`_ensureCtx`/`_closeCtx`/`_sources`/`_nextStart`/`_queue`/`_playing`/`_paused`/`_curNative`/
`_onDoneCallback`/`_drain`/`_stopCurrent`/`speak`/`isOn`; the iOS ctx-discipline subsystem
(`_resumeCtx`/`_ctxRunning`/`_armCtxUnlock`/`_armCtxWatch`/`_armPosState`/etc.);
`primeAudioSession`/`stopAudioSessionPrimer`/`_primerSrc`; **`SAMPLE_RATE`** (configures the shared ctx
— Piper rides it); `getRate`/`RATE_K`; `TTS_TEST_LINE`; all text-prep
(`splitSentences`/`normalizeForTTS`/`packLongUnit`/`unitGap`/`PAUSE_*`). Also do NOT touch the new #66
helpers `_voiceAssignedTo`/`_voiceLabelOf`/`_confirmVoiceEviction`/`releaseVoiceIfUnused` (Piper-side).

**LEAVE ALONE (ambiguous, out of scope):** `ENGINE_K` + its Save-handler write
`store.set(ENGINE_K,"piper")` — vestigial engine key, NOT Cartesia code; only touch it in a broader
engine-key cleanup. ~20 comment-only "Cartesia" mentions can optionally be cleaned to zero the grep.

**Verification gate (ALL before commit):** `node --check tts.js` → `node dev/run-tests.js` (ALL GREEN,
750) → `grep -i cartesia tts.js` ≈ 0 → Voice Settings modal opens WITHOUT a throw (removed panels left
null-refs last time — the failure class) → **a real narration test in the browser** (engine tests do
NOT exercise live audio; a mistakenly-removed shared piece only shows here). Then bump version + CACHE,
commit, push, update checkWithFable #4. Do NOT touch `vendor/piper/*`.

---

## #9 — TTS / voice rework (the big thread)

**Ratified design (full detail in TODO #9 + checkWithFable #4). All user-approved:**
1. Cartesia removed; engine picker removed; **Piper is THE engine**; Native kept ONLY as the silent
   runtime fallback (load-window + iOS-audio-suspend), called directly, never via getEngine.
2. **Voice binds to the NAMED character, stored ON THE SHEET** (`charSheet.voiceId`) — portable like
   portrait / core-memories (#63). No migration (absent = narrator). An imported voice not in the
   curated set snaps to narrator (guard, tested).
3. Voice Settings menu = narrator + global TTS only. Per-character voice = a control on the character
   sheet next to the portrait. NPCs tier: sheeted NPC carries a voice, sheetless NPC = narrator.
4. **Narrator voice = per-CAMPAIGN** (rides sync like `proseAuthor`) **+ authorable in the blueprint
   editor.** NOT built yet — `resolvePiperVoice` already reads `worldState.piperVoice`; the device→
   campaign move + the blueprint field are pending.
5. **Speaker hook = cheap LLM POST-PASS** (option C) run CONCURRENTLY with the post-turn action-
   suggestion call, mapping `{speaker,text}` spans → each speaker's `charSheet.voiceId`, unassigned →
   narrator. NOT drift surface (output post-process). **NOT built — the big remaining piece; design it
   with the user before building.**

**BUILT this session:**
- v1.395 — curated 19-voice `PIPER_VOICES` set (from `voice_picker.html`). Dropped `mike`/`norman`
  (in the picker's rhasspy manifest, NOT in the vendored vits-web catalog → would fail to download).
  Default = `en_US-libritts_r-medium`. `resolvePiperVoice` snaps stale prefs to default.
- v1.396 — `TTS.voices()`/`voiceLabel`/`voiceKnown`/`voiceDefault` + `TTS.characterVoiceId(char)`.
- v1.397 — sheet voice control (`csVoiceControlHtml`/`csWireVoice`, ui-sheets.js) on player + companion.
- v1.398 — Voice Settings simplified (Cartesia + engine picker removed). Cartesia code left dormant → the sweep above.
- v1.399 — sheet voice **Test** button (`▶ Test` → `TTS.testVoice(voiceId)`; falsy → narrator; the
  shared audition path, Voice Settings Test refactored onto it too).
- v1.401 — **downloaded-voice cap 4 → 10 + eviction warning.** Before a user-initiated audition would
  push resident voices past the cap, a confirm names the voice to be deleted AND who it's assigned to
  (`_voiceAssignedTo`), with Cancel. Under cap / already-resident → no prompt. Narration downloads keep
  the silent LRU (can't block a turn).
- v1.402 — **free a voice's OPFS slot on reassignment.** `TTS.releaseVoiceIfUnused(voiceId)`: when a
  sheet voice changes, `csWireVoice` releases the OLD one — but only if `_voiceAssignedTo` shows no
  other character AND not the narrator still uses it (that's what protects the narrator's voice).
  Resident-gate on the LRU keys → un-downloaded voice is a no-op with no wasm init. **Also: the
  Regenerate Sheet button was DROPPED** (footgun; Generate stays — the only in-game path to a joiner's
  charSheet).

**PENDING (build order):** dead-code sweep → narrator per-campaign move + blueprint field → LLM
speaker post-pass (design with user first).

**Satellite tool `voice_picker.html`:** auditions all 30 English Piper voices via pre-rendered samples;
exports a `PIPER_VOICES` block. Known minor bug: lists voices the vits-web runtime can't fetch
(mike/norman) — filter to the runtime catalog if revisited. Multi-speaker goldmine (#9 ⑦):
libritts_r = 904 voices from one 75MB download; a per-speaker browser + custom sample text (#9 ⑧ — the
"no more meteorological events" wish) are deferred enhancements.

---

## Other work streams (all shipped/closed this session)

- **#76 Table Talk → help agent (v1.387):** rebuilt as an out-of-character help desk (`table-talk.js`,
  `buildTableTalkPrompt`). App help from the rendered File menu, capability-bible rules lookup, engine-
  stored campaign facts, memoryTOC + RAG, its own rolling history. Never mutates state (no applyMuts/
  logTranscript). Absorbs #74. Fixed a real leak (v1.388): a TT question could replay as a story turn
  via `lastAction`/Retry — now guarded, with a source-level TT-isolation contract in run-tests.js.
- **#73 Campaign clock (v1.389):** `clock.js` — scalar minutes-since-epoch; `[TIME_ADVANCE:]`/
  `[SCHEDULE:]`/`[SCHEDULE_RESOLVED:]`/`[SCHEDULE_CANCEL:]`; `buildClockBlock()` shared by the game
  prompt AND Table Talk. Jump-safe firing (threshold `now≥due`, never `==`). Day# on the membar
  (v1.390). DEFERRED fast-follow: named in-world calendar + clock-authoritative time-of-day + retiring
  `[TIME:]`. Drift surface — logged in checkWithFable #3.
- **#1 Multiplayer:** hot-seat build COMPLETE (user ran the multi-human session, "it works"). Q5 (Car
  Mode) resolved → D13 (visual hand-off suffices, no audio cue; voice-input hazards delegated to
  #77/#78). Only Q7 (networked co-op) remains — a later XL pass.
- **Closures filed:** #74 (closed by #76), #79 (Day# membar), #8 (spell tooltips built then closed),
  #4 (moved to L5/L6), #22 (content sanitization — was already ROW CLOSED). Audio items #7+#13 moved to
  Long-term-goals **L7 "Audio Library"**.
- **New rows:** #77 (TTS input proofreading/nonsense filter — also owns the multiplayer voice-
  misattribution case), #78 (Car Mode numbered-suggestion read-back), #80 (click-a-spell → "Cast X." —
  done), #81 (inventory item bible — design-first), #82 (inventory tooltips — blocked on #81), #83
  (mobile long-press tooltip — done; hold-to-peek, centered popup).
- **Spell side-panel (v1.391–v1.394):** tooltips from the capability bible + click-to-cast + mobile
  long-press tooltip (centered, hold-to-peek). "No description available for: X" fallback.

---

## Conventions / decisions locked this session (IMPORTANT)

- **Claude is the SOLE writer of TODO.md** (user decision 2026-07-20). The user no longer hand-edits it
  — they tell Claude, Claude edits. Fixed a 3× clobber from concurrent edits. Commit TODO edits
  PROMPTLY (shared OneDrive working tree). Memory: `todo-edits-through-claude`.
- **The voice rework is logged in `todo_checkWithFable.md #4`** at the user's explicit request — TTS is
  NOT drift surface, but the user wants Fable to double-check the whole rework. Keep annotating it there
  as pieces land (every voice version has a bullet).
- **TODO row style:** every row opens with a plain-language TLDR; carries Effort + Tier. Drift-surface
  work is Fable-tier (this rework is Sonnet-tier — TTS is output, not the anti-drift stack).

## Standing verification norms (every code change)

- Bump `APP_VERSION` (globals.js) + `CACHE` (sw.js) on every game-code commit. Satellite-only changes
  don't bump APP_VERSION but do bump CACHE if sw.js changed.
- `node dev/run-tests.js` must be ALL GREEN (pre-commit hook enforces it). Currently 750 assertions.
- Browser-verify anything observable via the preview (localhost:3000). The SW is cache-first, so a bump
  alone won't show in the running preview: unregister the SW + `caches.delete` everything except piper,
  then reload (this session did it twice — the version string in `TTS`/`APP_VERSION` is the tell).
- Commit + push at each checkpoint. Stage files EXPLICITLY (never `git add -A` — shared working tree).
- ES5 only (var; no arrow/const/let) — a pre-commit hook blocks violations, even in scratch `.js`.

## Gotchas seen this session
- OneDrive occasionally throws a transient EPERM on file write → just retry the edit.
- CRLF warnings on every `git add` are normal (LF working tree; git converts).
- Emoji render as tofu boxes in the headless preview Chromium — fine on real devices; don't chase them.
- `dev/run-tests.js` prints a wall of `[sound]`/`[migrate]`/`[camps] QuotaExceeded` noise — EXPECTED
  harness output; only the final `ALL GREEN — N assertions` line matters.
- The **Grep tool** mangled `//` comments and `</div>` into `\ ` / `<\div>` in ui-sheets.js output this
  session — a DISPLAY artifact, not the file. Read the raw bytes with the Read tool before believing a
  syntax problem you only saw in a grep result.

## Awaiting the user (open threads)
- **Next #9 step:** the user was choosing between the dead-code sweep (in flight) and lining up the
  narrator-per-campaign + blueprint piece. The LLM speaker post-pass needs a design conversation first.
- The #73 named-calendar / time-of-day fast-follow is planned, not started.
- voice_picker catalog-filter fix (mike/norman-class mismatch) — parked, offered.
