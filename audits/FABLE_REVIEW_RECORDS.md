# Fable review records — full archive

Complete records of Fable-tier post-hoc reviews of non-Fable (Opus/Sonnet) work, moved here
2026-07-29 from todo_checkWithFable.md (which now holds only the pending queue + a verdict
index). Entries are verbatim as filed; doc pointers inside them reflect the repo at review
time (e.g. references to a root HANDOFF.md mean the session handoff of that era, now archived
under DOC/).

---

### 7. TODO #95 speaker casting — four-agent Opus 5 build (v1.440)

**Reviewed by Fable 2026-07-27 — scope WIDENED on the user's call to the full arc v1.440→v1.461
(#95.4 export/import → superseded by #95.8 · #95.5 prefs/LWW cloud sync · #95.6 default bench ·
#95.7 gendered auto-cast · #95.8 overrides + Push/Pull · #96 [SAY:] + its three field fixes).
VERDICT: all five filed items adjudicated (①②③ PASS, ④ token-half PASS, ⑤ CONFIRMED);
6 CONFIRMED defects fixed v1.462 + 6 cheap hardens; 1 NEW unsafe deriver class filed into #93;
residues accepted with rationale below.** Evidence: five parallel Opus briefs A–E (voice identity /
sync protocol / bench+casting / SAY drift surface / deriver runtime probes); verdicts and fixes by
Fable, failing-test-first — 861 assertions green (858 → 861), 7 new source-contract clauses, every
new guard sabotage-proven (scratch-mutation, never git-checkout), the F2 fix additionally
live-verified through the real page (flip → starred row's `g` updated; unstarred row correctly
untouched).

**The five filed items:**

1. **① `voiceBaseId` sweep — PASS.** Measured exactly 2 raw `#`-splits in tts.js, both inside the
   sanctioned helpers (`voiceBaseId`/`voiceSpeaker`); all 26 protection/eviction/download/display/
   routing sites normalize; ui-sheets delegates through `TTS.voiceBaseId`; no other game file
   touches `#` on a voice id. Harden shipped: contract ⑦'s regex only saw the exact double-quoted
   `split`/`lastIndexOf` spellings — now also catches `indexOf` and single-quoted variants
   (dodge-by-spelling closed, sabotage-proven both ways).
2. **② S2 strip boundary — PASS.** The composite reaches the server fetch body intact (pinned by
   the existing source test); exactly ONE server→local-Piper edge exists (the unit-failure
   handoff) and it strips via `voiceBaseId`; all five `predict()`/`download()` sites take a
   normalized id. **Accepted residue:** the handoff drops the per-unit voices map, so a
   multi-speaker passage's remainder reads mono-voice locally after a server failure — the
   remainder is re-joined and re-split, so stored indices could not survive anyway; safe direction.
3. **③ server-only range validation — PASS with a recorded residue.** The server range-checks
   against the model's own `num_speakers` with proper 400s; the client's failure chain is loud
   ONCE (toast + amber status + console + crumbs). Residue: a PERSISTENT stale composite (only
   reachable via a future catalog re-curation) re-trips the 60s retry loop for the whole session,
   console-only after the first toast, and each occurrence downgrades the rest of that passage.
   Accepted while the catalogs are pinned; revisit if a re-curation ever happens.
4. **④ satellite token + star-store contract — token half PASS, store half FIXED/HARDENED.** The
   token never reaches a URL, the DOM, or a log; it is hand-rolled because the satellite cannot
   load storage-adapter.js (structural, fine). The store's cross-surface shape was held by
   discipline with real gaps — see F2/F4/F5 and the residues.
5. **⑤ display-as-base — the filed fear was RIGHT (F1, fixed).** A non-starred composite narrator
   voice rendered with its BASE model row selected, so an untouched Voice Settings **Save
   silently rewrote composite→base** — persisted to `worldState.piperVoice` AND synced, under a
   "saved" toast. Both dropdown hosts now render the composite as its OWN selected option
   (honest `_voiceLabelOf` label); the sheet's Test button now auditions the real voice instead
   of the base. The old pinned rendering test was re-baselined deliberately to assert the
   composite VALUE is what's selected.

**Confirmed defects fixed (v1.462, each red-first):**

- **F1** — ⑤ above (tts.js `_buildPiperVoiceOptions` + ui-sheets `csVoiceControlHtml`).
- **F2** — a main-table ⚥ gender correction on an **already-starred** voice wrote the override
  store but never the star's own `g` — and the star's `g` is the ONLY channel the game's
  auto-cast reads (the #95.8 row's "starred panel reads the corrected value" claim was false for
  this case). The correction now propagates to the matching star row (`"?"` reverts to the
  published `gMeta`), rides `saveStars` → cloud. Contract-pinned; live-verified in the real page.
- **F3** — `_sayNorm` did not mirror `normalizeForTTS`, but the deriver's UNITS come out of
  `splitSentences` post-normalized: an em-dash, `*emphasis*`, or `...` inside a quoted line made
  its 48-char key unfindable — the line narrated flat (markdown: whole map null) or half-voiced
  (em-dash: only the post-dash unit bound). Segment text now runs through the same
  `normalizeForTTS` before `_sayNorm`. Safe-direction loss, but the audible partial-voicing class
  was common GM prose.
- **F4** — the satellite boot race (brief B, task 4): on a fresh device the DEFAULTS are on
  screen while the boot GET is in flight, and an edit inside that window could land its debounced
  PUT **before** the GET resolved — replacing an established rev>0 cloud bench with the defaults
  (the stale GET then re-adopted the old bench with a lagging marker). Scheduled pushes now DEFER
  until both boot pulls settle, and a successful adopt cancels any pending push timer (the other
  leg: a queued pre-adopt edit re-PUTting over what was just adopted). Both contract-pinned.
- **F5** — `speakerStarsPlan` read any non-`number` server rev as "never written" and SEEDED,
  overwriting a live cloud row (a string `"5"` from a proxy/serializer drift was enough).
  Numeric strings now coerce; a present-but-unreadable rev is an UNKNOWN server state → `none`.
  The deliberately-pinned `{}`→seed semantics (absent rev = missing row) were kept.
- **F6** — `buildSayComplianceNudge`'s all-or-nothing check: ONE `[SAY:` anywhere silenced it, so
  a response tagging 3 of 5 speeches shipped two mis-voiced lines with no correction. Now fires
  while ≥2 untagged quote-pairs of slack remain (`quoteChars >= 2*sayCount+4`), which keeps a
  compliant response with a scare quote / inch marks silent. Note text distinguishes partial from
  total non-compliance.

**Hardens shipped alongside:** manual Pull's corrupt-cloud case now says "cloud bench unreadable
(rev N) — kept this device's stars" instead of the inviting-a-Push "no bench yet"; the gender half
of a manual Pull fails loudly (starioNote, was console-only on a clicked button); pending debounced
pushes flush on `visibilitychange(hidden)`/`beforeunload` (an edit inside the 1.5s window used to
strand on-device forever — marker already matched, so no later boot re-pushed it); **logout clears
the two account-scoped prefs rev markers** (left behind, a different account's login could collide
markers and push the old bench into the new account's row — engine-tested, red-proven; the bench
itself stays, it's device data); contract-⑦ regex extension (①); the dangling `SPEAKER_SYS`
comment removed (api.js).

**Filed into #93 (not ride-along fixed — cross-assignment classes need their own test-first
session):** the NEW W1/Z1 segment-collision class (quote-blind segment matching lets narration in
speaker A's segment capture speaker B's identically-worded later line — well-formed quotes, no
parity fault needed); the sharpened ① evidence (a `[SAY:]` tag CONVERTS a parity fault from
silent-flat into audible wrong-voice; a following tag bounds the over-reach but mis-hands the
remainder; paragraph breaks confine it; a stray CLOSING quote is equally unsafe); the curly-quote
parity edge (the counter counts `["”]` but never `“` — **zero** curly quotes in 13,505 GM quote
chars across every corpus, so theoretical; recorded, not fixed); and the untested-shapes list.

**Affirmed clean (no change):** the stamp-ordering/memo-invalidation class — the pre-stamp
`saveAll` window is exactly what `invalidateTranscriptMemo` closes, verified with a negative
control (the entry-4/entry-6 class holds for the #96 writer); SAY registry discipline (parse-less
row, strip everywhere it should strip and nowhere it shouldn't, doc line campaign-constant in the
stable half, both frozen hashes re-baselined in ONE deliberate commit `a636fc3`, stable half
byte-identical whether the nudge fires or not — the nudge rides the engine-note channel and never
touches `buildSysPrompt`); the `sp.n` fuse and stale-name replay (whole-map drop on count drift,
per-index drop on unresolvable names, no path to a wrong voice); zero dangling references to the
five deleted post-pass functions; `pinAutoCastVoices` ordering (pin → `saveAll` on both turn
paths, no overwrite of a human assignment, NB/sheet-less skip); auto-cast determinism across
process reloads; the #95.6 default/cleared/corrupt truth table as claimed.

**Accepted residues (rationale):** RAG's entity index now harvests speaker names from `[SAY:]`
tags in the raw — affirmed as enrichment (speakers ARE present-scene entities; cap 12 unchanged);
muted players still derive+stamp+pin+save (no model call, no synthesis — the write is cheap,
deterministic, and stabilizes the eventual unmute; extends the documented muted-stamp rationale);
the pin also writes the PLAYER's own `voiceId` (correct — sheet-editable, rides the blob; recorded
here since the #96b note only mentions NPCs); companions joining via `[PARTY_MEMBER:]` get no
creation-time voice stamp (first-speech pin covers them); nameless-but-gendered characters hash to
`pool[0]` (sheet characters have names); an unknown-BASE pinned voiceId silently re-deals through
auto-cast rather than narrator (reachable only by catalog removal; bounded, deterministic);
case-variant `[SAY:]` names degrade silently to narrator (GM uses registered names — 18/18 in the
field fixture; resolveNpcName is case-sensitive engine-wide, not worth a local fold); the
satellite's `loadStars` accepts bare-string entries and defaults labels to `""` where the game
uses the id (no writer produces those shapes; both CLOUD readers drop them; noted, not unified);
an empty-string star store aliases to never-written (no writer can produce it — `saveStars`
minimum is `"[]"`); Pull-replaces-without-confirm (user-ratified #95.8 semantics); engine-note
text riding the suggestion call's `Player:` history lines (pre-existing for all 13 builders — a
future nit, not a SAY defect); lowercase `[say:]` neither strips nor warns (pre-existing
class-wide: `__tagUnknownScan` is uppercase-only — queued for the next tag_table pass, SAY at 3
chars sits exactly on the scan's `{2,}` boundary); the satellite reads its token once per load
(documented in-page); UNDETERMINED and left so: post-v1.449 field emission rate (no post-#96
corpus in the repo — the server `session_log` evidence stands), non-Claude `[SAY:]` behavior
(SAY is deliberately not in TAG_REINFORCE until a money-test says otherwise).

**Receipts (delegated-evidence workflow, run 2):**

| Brief | Theme | Tokens | Tool calls | Wall | Fed |
|---|---|---|---|---|---|
| A | voice identity | 183,539 | 43 | 466s | ①②③⑤ verdicts, F1, H-regex |
| B | sync protocol | 157,251 | 35 | 412s | ④, F2, F4, F5, all Pull/logout hardens |
| C | bench + casting | 149,891 | 28 | 359s | pin/persistence/bench affirmations + 6 residues |
| D | SAY drift surface | 171,130 | 46 | 565s | drift-surface PASS block, F6, the quote census |
| E | deriver probes | 151,932 | 30 | 449s | F3, the #93 fold, stamp verification |

~814k subagent tokens / 182 tool calls total, all five briefs fully parallel (wall = the slowest,
~9.4 min). Delegate quality: all five held the no-verdict contract, labeled UNDETERMINED honestly
(A: field frequency of the ⑤ precondition; B: race likelihood; D: post-cutover emission rate),
and declared scope growth explicitly; brief E's independent discovery of W1 — it was asked only to
classify failure *directions* and went hunting for shapes beyond its list — was the run's best
single find. Next-run note: brief B carried one task too many (7); split per-prefs-key next time.
Also worth keeping: the F2 live flip-with-restore verification pattern (sandboxed preview origin,
snapshot → exercise → restore) for satellite DOM logic the headless suite can't execute.

**Original entry (as filed 2026-07-24):**

- **Tier:** off the drift surface (output rendering), logged per the #9 precedent + the row's own
  "→ /fable-review" annotation. Built 2026-07-24 by four parallel Opus 5 agents (server pass-through /
  metadata / speaker_browser.html satellite / tts.js+ui-sheets client core), integrated by Fable
  (suite re-run 825 green, sw.js allowlist, versions).
- **What Fable should verify (run via /fable-review):** ① the `voiceBaseId` normalization sweep —
  D claims every protection/eviction/ensure/display site routes through it (contract ⑦ pins "at
  most two #-splits in the file"; confirm the two are the right two); ② the S2 strip boundary —
  `_speakServer` per-unit voices deliberately NOT stripped vs the handoff/local paths stripped
  (the composite-reaches-predict() failure would be silent wrong-audio); ③ D's deliberate
  omission of client-side speaker RANGE validation (server-only validation — is a stale star
  against a re-curated catalog handled loudly enough?); ④ the satellite's token handling +
  the star-store shape as a cross-surface contract (three writers/readers agree today by
  discipline, nothing pins it); ⑤ the unstarred-composite display-as-base behavior in the
  dropdowns (correct, or a silent rewrite risk on the next save?).
- **Supporting docs:** DOC/DOC_speaker_casting.html (spec S1–S5); the four agent reports in this
  session's task files; TODO #95 row.

### 5. #16c diagnostics — one touch inside `summarize()` (drift surface)

**Reviewed by Fable 2026-07-24 — VERDICT: the v1.407 enrichment itself PASSES all three asks;
2 CONFIRMED adjacent findings + 2 pre-existing defects, all fixed v1.439.** Evidence gathered by a
delegated Opus pass (brief A: 9 live probes against the real engine via a stubbed `callGM` +
captured `_erSend`); verdicts and fixes by Fable. Method note: this was the first run of the
delegated-evidence workflow — see FABLE_REVIEW_ACTION.html for the performance review.

1. **(a) Masking — CONFIRMED, fixed (F8).** The enrichment block (inner try, memory.js) is
   correctly contained and survives poisoned state (probes B/D/I). But the `reportError` call's own
   ARGUMENT evaluation (`e.message`/`e.stack` inline) sat outside every try: a hostile thrown value
   produced ZERO reports and full masking (probes G/H), and the escaped throw's second report died
   in the 30s debounce. Fixed: defensive `String()` extraction under try; the same `_eMsg` now
   serves the retry toast (which had the same hazard). Also fixed the pre-existing unguarded
   `.slice` in the degraded-chapter loop (probes C/E — threw OUT of the catch, aborting the
   archive) and the pre-try `sessionTokens()` throw on a malformed entry (probe F — no catch, no
   report, engine-tested now).
2. **(b) Half-mutated state — CONFIRMED as a diagnostics-accuracy limit, partially fixed.** Three
   catch-time states exist (pre-extraction / partial-apply / post-trim-save-failed). Under quota
   failure the window count reports the POST-trim log ("0 msgs" for a 4-msg window) — accepted:
   the diagnostics describe live state honestly, and labeling it otherwise would require a
   snapshot the failure path shouldn't pay for. The REAL defect found alongside: `_sumFails=0` ran
   BEFORE the saves, so a repeating quota failure reset the 3-strike counter every pass — the
   breaker was unreachable for that class. Fixed (reset moved after the saves).
3. **(c) Content policy — AFFIRMED.** Full enumeration: `memory.js` summarize is the ONLY
   content-bearing `reportError` detail in the repo (9 production sites; everything else
   mechanical; the universal `erDiagBlock` is mechanical throughout). The user-ratified policy
   stands; no other caller gained content-shipping.

**Original entry (as filed 2026-07-22):**

- **Tier:** the change itself is telemetry-only, but it sits INSIDE `summarize()`'s catch, and
  summarize is named drift surface in CLAUDE.md — so it is logged here rather than assumed safe.
- **Built by:** Opus 4.8 — 2026-07-22 (v1.407), under a user policy call that crash `detail` MAY
  carry app-generated content.
- **What changed:** the existing `reportError("summarize", ...)` call in the catch now composes a
  richer detail string: the response HEAD (200 chars, whitespace-collapsed) and a count of how many
  archived user halves in the extraction window begin with `[ENGINE NOTE`. **No change to the
  extraction prompt, the window composition, `repairModelJson`, the parse, the 3-strike breaker, or
  any success path.** The gather is wrapped in its own try/catch so a failure inside it degrades the
  detail string rather than replacing the original error.
- **Why it exists:** B11 was undiagnosable because the only evidence of what the extractor returned
  was 11 characters inside a V8 message. The engine-note count tests the replay hypothesis WITHOUT
  shipping narrative — structure, not story.
- **Fable: confirm (a) the catch cannot now throw a SECOND error that masks the first, (b) reading
  `sessionLog`/`sessKeptStart()` inside the catch cannot observe a half-mutated state given every
  writer sits inside the try, and (c) that shipping a 200-char response head is acceptable given
  crash bodies were previously content-free — the user approved the policy, but the blast radius
  (which callers could now leak content) is worth a second look.**

### 4. Voice / TTS rework — curated Piper set, per-character voice on the sheet (TODO #9)

**Reviewed by Fable 2026-07-24 — VERDICT: 3 CONFIRMED FINDINGS (all fixed v1.439), the ★ memo
question ANSWERED (convention held; enforcement bundled into #92), splitter edges FILED (#93),
everything else affirmed-and-closed.** Evidence: delegated Opus briefs E (memo mutator matrix) and
F (4 checks incl. live splitter adversarials); much of the 2026-07-20 surface was superseded by
the Fable-built v1.435–438 server-TTS/recovery rework before this review ran.

1. **★ Transcript-memo class — ANSWERED.** Complete mutator sweep: the invalidation convention
   holds at every site except the RAG lazy `.e` backfill — which is the exception ALREADY ruled
   accepted (state.js design note), is self-healing, and whose concrete no-append drop windows
   (Table Talk turns, the suggestion-call save) lose nothing the next retrieval doesn't rebuild.
   Two structural fragilities recorded for the #92 session (same boundary, one test bed): the
   retcon `rc` mark is safe only by ADJACENCY to its own append, and `stampTranscriptSpeakers`
   invalidates a hardcoded `worldState.transcript` rather than the entry's owning array.
   Enforcement options mapped (generalized stamp accessor vs. revision counter à la
   `portraitVer`); decision deferred INTO #92 deliberately, not dropped.
2. **Narrator protection defeatable pre-game — CONFIRMED, fixed (F10).** `_voiceAssignedTo`'s
   worldState early-return sat ABOVE the narrator check, and Voice Settings lives on the API-key/
   creation menus where worldState is null — automatic eviction could take the narrator's voice.
   The narrator check now runs first (needs no world).
3. **v1.419 silent-delete class regressed in ONE site — CONFIRMED, fixed (F11).**
   `releaseVoiceIfUnused` still called the vendored swallowing `mod.remove()` and unconditionally
   deleted the LRU stamp — the exact phantom-ratchet recipe, in the one deletion site the VOICE
   DELETE CONTRACT didn't cover. Now uses `_piperRemoveVoiceFiles`; contract ① extended to pin it.
4. **Stale key in the crash reporter — CONFIRMED, fixed (F12).** `ER_REPORT_HINTS` still read the
   retired `tnd_tts_engine_v1`; every report said "(legacy-inferred)" while the real tier
   (server/piper) went unrecorded. Now reports `TTS.getEngine()`.
5. **B14 splitter — evidence gathered, edges FILED as TODO #93.** Live adversarials: NO text loss
   in any case (8/8), spans deterministic across callers. Three edge behaviors recorded: an
   unbalanced quote INVERTS parity for the paragraph remainder (the entry's assumed
   "degrades to narration" is factually wrong — narration gets tagged as dialogue); two speakers
   in adjacent paragraphs with a closed-then-reopened quote merge into ONE span (one voice for
   two speakers); a lone `"` fragment can reach synthesis as a unit. All low-frequency, none
   loses text; they need their own careful test-first session, not a ride-along fix.
6. **Serialization audit — no gap.** Every OPFS writer (download/remove/evict) rides
   `_piperSerial`; a same-id remove/download interleave is impossible on the chain. Noted without
   action: the release path's sync check-then-act window (stale decision, not an interleave).
7. **Affirmed and closed without changes:** legacy keys clean on every non-JS surface + both
   repos (the one live JS read was finding 4); the mike/norman drop, snap-to-default, narrator
   fallback, E20 narrator semantics, LRU-proxy confirm cosmetics, the muted-skip judgment call,
   and the 4s fuse (live-verified at build; no half-state exists).

**Original entry (as filed 2026-07-20):**

- **Tier:** Sonnet (TTS is OUTPUT rendering, NOT the drift surface — no applyMuts/memory/prompt-
  injection contact). **Logged here at the USER's explicit request** ("everything we're doing here
  needs to be annotated so Fable can double-check us", 2026-07-20), not because policy requires it.
- **Built by:** Opus 4.8 — 2026-07-20. Design converged with the user across several turns; the
  full ratified design + build order lives in the **TODO #9 row** (read it first).
- **Versions / commits:**
  - v1.395 — curated voice set: `PIPER_VOICES` replaced with the user's 19 picks (from
    `voice_picker.html`). 2 of 21 picks (`en_US-mike-medium`, `en_US-norman-medium`) DROPPED — in
    the picker's rhasspy manifest but NOT in the vendored vits-web runtime catalog, so they'd show
    in the dropdown yet fail to download. Default moved lessac-medium → `en_US-libritts_r-medium`
    (old default was dropped); `resolvePiperVoice` now snaps any stored pref no longer in the set to
    the default. 3 existing tests updated + 1 guard test.
  - v1.396 — per-character voice FOUNDATION: `TTS.voices()`/`voiceLabel()`/`voiceKnown()`/
    `voiceDefault()` + `TTS.characterVoiceId(char)` — resolves a character's own `voiceId` (in the
    curated set) else falls back to the NARRATOR voice (unassigned = single-voice behavior, today's
    default). 5 new tests.
  - v1.397 — **sheet voice CONTROL:** `csVoiceControlHtml`/`csWireVoice` (ui-sheets.js) — a Voice
    dropdown under the hero card on BOTH the player sheet (`showCharSheet`) and companion/NPC sheet
    (`showNpcSheet`, gated on a charSheet existing — sheetless NPC = no control = narrator tier).
    Writes `char.voiceId`/`charSheet.voiceId`; "" deletes it (narrator default). Live-verified both
    hosts + the sheetless-NPC case. UI only.
  - v1.399 — **sheet voice Test button:** new public `TTS.testVoice(voiceId)` (falsy → narrator) —
    the shared audition mechanism (the Voice Settings Test button was refactored to call it too). A
    `▶ Test` button next to the sheet voice dropdown auditions the currently-selected voice (first
    test of an undownloaded voice triggers its one-time Piper download, same as the settings Test).
    Live-verified: button passes the selected voiceId (and "" for narrator).
  - v1.402 — **free a voice's OPFS slot on reassignment (+ Regenerate-Sheet button dropped):** new
    public `TTS.releaseVoiceIfUnused(voiceId)` — when a character's sheet voice CHANGES, `csWireVoice`
    (ui-sheets.js) captures the old id, updates `char.voiceId`, then calls release. Release deletes the
    old voice from OPFS **only if `_voiceAssignedTo(old).length === 0`** — that scan covers every
    character sheet AND the narrator (`resolvePiperVoice()`), so a voice still used by another party
    member OR the narrator is protected automatically (the user's stated requirement: "this check
    protects the narrator from losing its voice"). Guards: falsy id → no-op; not in the LRU keys →
    no-op WITHOUT wasm init (an un-downloaded voice costs nothing). Removal reuses the exact
    `_piperInit → _piperSerial → mod.remove` + LRU/`_piperDownloaded` cleanup path as the shipped
    `_piperDeleteVoice`. Non-fatal (catch keeps the voice), console-attributed. Rationale: with voices
    bound to characters, resident downloads self-track to ~narrator + party (≤5), so the cap-10 ceiling
    is rarely approached. UI change (non-TTS): the **Regenerate Sheet** button was removed (footgun,
    re-rolled a good sheet); **Generate** stays (only in-game path to a joiner's charSheet). No new
    tests (UI-gated + reuses tested LRU/OPFS machinery); 750 green; live: v1.402 loads clean,
    release exposed, empty/non-resident calls safe no-ops, no console errors. **Fable: confirm the
    narrator-protection (`_voiceAssignedTo` including `resolvePiperVoice()`) can't be defeated by a
    stale/empty worldState at call time, and that reusing `mod.remove` off the audition path can't race
    a concurrent download of the SAME id (both ride `_piperSerial` — verify that serialization holds).**
  - v1.401 — **downloaded-voice cap 4 → 10 + eviction warning:** `PIPER_VOICE_CAP` raised (per-
    character voices need more resident room). Before a USER-initiated audition (`testVoice`, the
    single path behind both Test buttons) would evict a resident voice, a confirm modal names the
    voice to be deleted AND who it's assigned to — player / each companion with that `charSheet.voiceId`
    / the narrator (`_voiceAssignedTo`) — with a Cancel. Residency is proxied by the LRU keys
    (`_piperLruLoad`) for a synchronous heads-up; the actual eviction still runs off the async OPFS
    list inside the download path, unchanged. Under cap or already-resident → no confirm.
    Narration-triggered downloads (a turn speaking) deliberately do NOT gate — they can't block a turn
    and are rare at cap 10 (silent LRU as before). Slot-note grammar fixed ("a 11th voice" → "past 10").
    Live-verified: 10 resident → auditioning an 11th shows the confirm naming new/evictee/assignee;
    Cancel aborts; slot UI reads "of 10 slots". No new tests (UI-gated confirm; the LRU/OPFS logic is
    unchanged); 750 green. **Fable: confirm the LRU-key proxy can't disagree with the OPFS eviction in a
    way that names the WRONG evictee, and that a narration download silently evicting an assigned voice
    at cap 10 is acceptable (no confirm on that path by design).**
  - v1.408/v1.409 — **B14: speaker voicing re-keyed from pause-units to DIALOGUE SPANS.** First field
    report against the post-pass: `"That leaves her," Frizwick says.` was read entirely in Frizwick's
    voice. Root cause was NOT the model — the comma split cuts between the comma and the closing
    quote, so the attribution unit literally began with a quote mark and read as continued speech.
    v1.408 reattached the closing quote (parity-guarded, so `He said, "Get back."` is untouched).
    v1.409 fixed the architecture on the user's call: commas segment for PAUSES, quotes segment for
    VOICE, and the two no longer share a boundary set. `splitSentences` tags each unit with its
    dialogue span; the model is asked one question per span and never sees narration at all.
    **Fable: confirm (a) the quote-parity span tagging cannot desync from the units _speakPiper
    actually synthesizes — they come from the same call, but check the paragraph-level state reset,
    (b) unbalanced quotes in GM prose degrade to narration rather than swallowing the rest of the
    passage, and (c) keeping the UNIT-indexed storage format (rather than span-indexed) is the right
    call for backward compatibility.**
  - v1.406 — **LLM SPEAKER POST-PASS (#9 ⑤, the last piece of the rework):** after a committed turn,
    a cheap call maps sentences to speakers so dialogue narrates in each character's own voice.
    Output post-processing only — no applyMuts, no memory tier, no system-prompt contact (guarded by
    the v1.404 byte-identity test). Sonnet tier per the ratified design.
    **Three measurements reshaped the plan before any code:** (a) `speakResponse` fires BEFORE
    `generateActions`, so the original "run it concurrently to hide the latency" premise was false —
    narration waits for nothing today, so any dependency ADDS a wait; (b) 5,920ms from `speak()` to
    first audible sample, warm; (c) `_speakPiper` already predicts PER UNIT under 25s backpressure,
    so per-unit voice was one line rather than a rearchitecture. User chose to block narration on the
    map; I added a 4s fuse, because an unbounded wait turns one hung request into a silent turn.
    **Contract changed from the ratified sketch:** the model returns `{unitIndex: name}`, NOT
    `{speaker,text}` spans — matching model-returned TEXT back to synthesis units fails silently into
    wrong-voice output on any paraphrase or whitespace drift, whereas a bad index is structurally
    detectable. Out-of-range indices and non-cast names are dropped at parse; nothing usable → null,
    because no map is strictly better than a wrong one (a wrong one is audible).
    **Persistence:** `sp:{n,s}` stamped on the GM transcript entry — additive, same shape as RAG's
    `e:{n,l,q}`. `n` is a fuse against a future splitter change silently re-indexing every stored map.
    Names (not voice ids) are stored and resolved at speak time, so rebinding a character's voice
    re-voices every past turn they speak in — live-verified.
    **⚠ THE BUG THIS ALMOST SHIPPED WITH — worth Fable's attention as a CLASS, not just an instance:**
    `serializeWorldState` memoizes the compressed transcript on (length, last-entry ref, last-entry
    `.x`). The post-pass stamps `sp` onto an already-written entry 1-4s later, changing NONE of those
    keys — so the next saveCore would re-serve the stale blob and every speaker map would vanish at the
    localStorage boundary, with no error, no console line, and correct-looking in-memory state. Found by
    reading the reroll path's existing `invalidateTranscriptMemo` call and asking why it was there.
    `stampTranscriptSpeakers` (state.js) owns the invalidation; its test primes the memo before stamping
    so the guard can genuinely fail. **Fable: are there OTHER deferred/async writers that mutate an
    existing transcript entry without invalidating? That memo turns any late field-add into silent
    data loss, and the invalidation is currently a convention rather than something the memo enforces.**
    **Judgement call to sanity-check:** the pass is skipped entirely while audio is muted, so turns
    narrated muted keep no map and replay flat later. Rationale: a muted player is a non-user and
    shouldn't pay per turn. The alternative (always compute, so history is complete) costs every muted
    player a call per turn for audio they may never play.
    **Fable: also confirm the 4s fuse can't leave a queued item half-voiced, and that skipping the pass
    on turns without a `"` can't miss dialogue the model wrote with other quotation conventions.**
  - v1.405 — **legacy engine keys retired (the tail of the #9 cleanup):** removed `ENGINE_K`
    (`tnd_tts_engine_v1`), `NATIVE_K` (`tnd_tts_native_v1`) and `isNative()`. These are TWO
    superseded generations of engine selection — the v1.61 native-vs-cloud boolean, then the v1.301
    Phase-4 engine id whose legacy-inference branch was `isNative()`'s only caller — both orphaned
    the moment v1.398 made `getEngine()` a constant. Nothing read them since; the Save handler was
    write-only into them. Deliberately NOT purged from localStorage: the stale values are inert, and
    `tnd_cartesia_key_v1` is a stored third-party credential whose deletion should be the user's
    decision rather than a silent side effect. The three `getEngine()` tests keep SETTING all three
    keys — that is now their whole point (a device carrying them must not resurrect a dead engine),
    and the test-block comment was rewritten to say so. 755 green; live-verified with the legacy keys
    seeded: getEngine()===piper, Voice Settings opens clean, Save pins a new narrator voice.
    **Fable: confirm leaving the orphaned keys (esp. the Cartesia credential) is the right call, and
    that no non-JS surface (SW, sync blob, server) ever carried these keys.**
  - v1.404 — **blueprint-authored NARRATOR VOICE (+ the per-campaign move, found already built):**
    the "device→campaign move" in the build order was ALREADY DONE — `savePiperVoice` pins
    `worldState.piperVoice` whenever a campaign exists and `resolvePiperVoice` reads the pin ahead of
    the device default (both engine-tested since the proseAuthor mirror). What shipped here is the
    BLUEPRINT half: `narratorVoice` added to the blueprint schema (`normalizeBlueprint` coerces a
    non-string to ""), `buildBlueprintFromGame` exports the campaign pin, and `applyBlueprint` applies
    it under the SAME E20 rule as `proseAuthor` — **only a non-empty authored voice pins**, so a
    blueprint with no narration opinion cannot clobber a pin the player already made; an id outside
    this build's catalog is toasted (`TTS.voiceKnown`) and still resolves to the shipped default.
    Authoring surfaces: the in-game Export-as-Blueprint modal and the Blueprint Designer (v0.35 —
    meta field, `BP_SECTIONS`/`_PATCH_TOP` registration, ✨-draft preserves an existing pick; it now
    loads tts.js and reads the catalog through the public `TTS.voices()` rather than duplicating it).
    **5 new tests (755 green), one of which is the drift guard:** `buildSysPrompt()` must be
    byte-identical in BOTH halves with and without `worldState.piperVoice` set — narrator voice is
    output config and a leak into the stable half would kill every prompt-cache hit. Live-verified the
    whole round trip (designer → fileOut → normalize → applyBlueprint → resolvePiperVoice) and the
    silent-blueprint no-clobber case. **Fable: confirm the E20 mirror is the right semantics for an
    AUDIO setting (a blueprint author arguably has weaker claim to the narrator than to prose voice),
    and that pinning an unknown-but-recorded id — rather than refusing it — can't strand a campaign
    if the catalog changes again.**
  - v1.398 — **Voice Settings SIMPLIFIED (Cartesia + engine picker removed):** `getEngine()` is now a
    constant `"piper"` (Native survives only as the runtime fallback target, called directly). The
    modal lost the engine radios + the whole Cartesia panel (key/voice-bank) + their wiring; it's now
    speech rate + Piper voice + a device "Fallback voice". ⚠ **Cartesia CODE left dormant** (the
    provider object + ~60 refs + the SSE/WebAudio streaming) — unreachable (getEngine never returns
    it) but not yet ripped; a dead-code sweep is a separate follow-up. 4 old Phase-4 engine-selection
    tests replaced with 3 asserting the constant. **Fable: check that nothing still routes through
    `TTS_PROVIDERS.cartesia` or a stale ENGINE_K, and that the dormant Cartesia code can't be reached.**
  - v1.403 — **Cartesia DEAD-CODE SWEEP (the dormant provider is gone):** deleted 12 exclusive
    functions (`getKey`/`getVoice`/`getBank`/`setBank`/`_cartesiaOk`/`_stream`/`_streamGo`/
    `_updateCartErr`/`_buildVoiceOptions`/`_buildBankRows`/`_wireBankDelBtns`/`_refreshVoiceUI`), its
    constants (`KEY_K`/`VOICE_K`/`BANK_K`/`CARTESIA_SSE_URL`/`_VERSION`/`_MODEL`/`_cartesiaError`/
    `_cartesiaErrorAt`/`_abortCtrl`), the `cartesia:` entry in `TTS_PROVIDERS`, and the entire SSE/
    WebAudio streaming core. **315 lines deleted / 51 added; 71 case-insensitive grep hits → 0.**
    TWO edits inside SHARED functions, both deliberate: (a) `_drain()` — the `else _stream(...)`
    third branch became `else { warn; _drain(); }` rather than being dropped outright, because a
    silent fall-through would leave `_playing` latched with nothing scheduled to call back (a wedged
    queue = permanent silence, the exact no-silent-failures class); (b) `_stopCurrent()` lost only the
    `_abortCtrl` abort line. **PROTECTED and verified untouched:** the shared scheduler
    (`_audioCtx`/`_ensureCtx`/`_sources`/`_nextStart`/`_queue`/`_drain`/`_stopCurrent`/`speak`), the
    iOS ctx-discipline subsystem, `primeAudioSession`, **`SAMPLE_RATE`** (configures the shared ctx
    Piper rides), `getRate`, `TTS_TEST_LINE`, all text-prep, and the #66 helpers. Public API
    unchanged (27 exports, verified in-browser). Left ALONE as one unit for a later legacy-engine-key
    cleanup: `ENGINE_K` + its Save-handler write + `NATIVE_K` + the now-callerless `isNative()`
    (annotated VESTIGIAL in place). **Verification:** `node --check` clean; 750 assertions green;
    Voice Settings opens with zero throws and exactly the 15 expected element ids (the removed-panel
    null-ref class); and a REAL browser narration — 75MB voice downloaded, 2 buffers scheduled at
    22050Hz mono totalling 3.1s with the 0.15s comma gap between units, then stop/pause/resume
    exercised — all with zero console warnings. **Fable: confirm the `_drain()` third-branch change is
    the right call vs deleting the branch (I chose loud-drain over silent fall-through), and that no
    protected shared piece lost a caller it silently depended on.**
- **Ratified design (user, 2026-07-20) — what Fable should sanity-check:**
  1. **Cartesia REMOVED, engine picker REMOVED, Piper the only engine; Native kept as a SILENT
     fallback** (load-window + iOS-audio-suspend). *(Not built yet — see pending.)*
  2. **Voice binds to the NAMED character, stored ON THE SHEET (`charSheet.voiceId`)** — portable
     like portrait / core-memories (#63); the interchangeability contract. **No migration needed:**
     absent voiceId = narrator fallback (verified by test). An imported voiceId not in the curated
     set snaps to the narrator (portability guard, tested).
  3. **Voice Settings menu → narrator + global TTS only; per-character voice → a control on the
     character sheet, next to the portrait** (its sensory twin). NPCs tier naturally: sheeted NPC
     carries a voice, incidental NPC → narrator. *(Sheet control + menu simplification NOT built
     yet.)*
  4. **Narrator voice = per-CAMPAIGN** (rides the sync blob like `proseAuthor`) **and authorable in
     the blueprint editor.** *(Not built yet — resolvePiperVoice already reads `worldState.piperVoice`
     per-campaign; the blueprint field + the device→campaign move are pending.)*
  5. **Speaker hook = cheap LLM POST-PASS** run concurrently with the action-suggestion call,
     mapping `{speaker,text}` spans → each speaker's `charSheet.voiceId`, unassigned → narrator.
     *(Not built yet — the big remaining piece.)*
- **Files touched so far:** tts.js, globals.js, sw.js, dev/engine-tests.js, voice_picker.html (new
  satellite), TODO.md, todo_checkWithFable.md.
- **What to review (Fable):** the mike/norman drop (is pinning the picker to the vits-web catalog the
  right fix, vs re-vendoring a fuller mirror?); the snap-to-default guard (could it ever wrongly
  discard a legitimately-pinned voice?); `characterVoiceId` falling to the NARRATOR (vs a distinct
  default) for unassigned characters; and whether the per-campaign narrator + blueprint-authored
  narrator interact cleanly with the existing `proseAuthor` per-campaign pattern.
- **Verification done (Opus):** 751 engine assertions green (+9 across the two versions: catalog
  membership, default, snap-to-default, per-character resolution incl. portability + narrator-track).
  Live: Voice Settings dropdown renders exactly 19, default libritts_r, no console errors.
- **Supporting docs:** TODO.md #9 (full design + build order); voice_picker.html.

### 2. NPC mood / relation separation — schema repair of the character-state tier

**Reviewed by Fable 2026-07-24 — VERDICT: the separation design and core semantics PASS under
live fire; 5 CONFIRMED finding groups, all fixed v1.439; 3 residues accepted with rationale.**
Evidence: delegated Opus briefs B (complete consumer sweep — 25 status readers vs the entry's 9),
C (adversarial parses + B3 composition, run through the real engine), D (heal-marker sync
lifecycle). Verdicts and fixes by Fable, failing-test-first (8 new engine tests, section "Fable
review fixes (v1.439)").

1. **Core semantics — PASS, runtime-proven.** Sparse tags leave fields unchanged (incl. the
   v1.381 no-refresh-on-relation-only contract); the tag never touches attitude under any
   adversarial form; empty status composes cleanly with the B3 dead guard (falsy short-circuit —
   nothing written, nothing refused); the DECEASED roster keys on the flag, so an empty-status
   corpse cannot hide. The "empty is honest" judgment and Option-B split are AFFIRMED.
2. **The heal marker re-fires on marker-less memory — CONFIRMED, fixed (F7).** Two live paths
   produced exactly that: `blankMemory()` never carried `attitudeSpec` (every post-v1.383 NEW
   campaign wiped its first correct dispositions on first reload) and the `.tnd` import whitelist
   dropped the marker (every import re-fired the clear). Fixed: the marker is born on the blank
   shape and carried through import. **Accepted residue (scenario a, brief D):** a pre-v1.383
   device round-tripping the blob writes old-spec values UNDER the surviving marker — permanent
   mislabels no heal can reach. Single-dev fleet on current code; recorded, not engineered around.
3. **The raw `/\bdead\b/i` class — CONFIRMED, fixed (F1), and bigger than the entry knew.**
   Eleven raw string checks (4 in game.js + 7 in helpers.js — the entry's map said four), and the
   regex never matched `"slain"/"deceased"/"perished"` (what the combat kill path writes) nor read
   the B3 flag. Runtime-confirmed damage: a slain companion fired no death defining-moment, kept
   receiving witnessed core memories, stayed sheet-pending, and occupied a party-cap slot forever
   (plus multiplayer round-order/playerCount). All eleven now route through `npcIsDead()`.
4. **Blueprint round trip re-contaminated the schema — CONFIRMED, fixed (F2).** Export wrote a
   MOOD into `role` (known); the import side (missed by the entry) fanned one relation-shaped
   `role` into status + rel + attitude simultaneously. Export now maps `rel`; import seeds
   relation only, mood/disposition empty.
5. **Render/seed hygiene — CONFIRMED, fixed (F3/F4/F5).** Party-card `"ally"` mood default (both
   sites), the unguarded sidebar `status+" / "+rel` concat ("undefined / …"), the four
   `PARTY_MEMBER` branches still minting literal `"unknown"` into mood/attitude, and the
   `[NPC:X|||]` third-slot pipe leak (`rel:"|"` — slot now pipe-excluded like the others).
6. **Accepted without change:** the name slot's silent drop on `[NPC:|…]` (pre-existing,
   requires a malformed emission the GM has never produced; noted for the next tag_table pass);
   relation/pronoun writes landing on dead NPCs (defensible — bonds to the dead legitimately
   change; the guard protects STATUS, the death canon); `"neutral"` staying in NPC_REL_VOCAB.

**Original entry (as filed 2026-07-19):**

- **Tier:** Fable (drift surface — the `[NPC:]` tag write path in tag_table.js, the roster + NPC-detail
  blocks of `buildSysPrompt`, the summarize extractor's write path, and a migration over live save data)
- **Built by:** Opus 4.8 (NOT Fable) — 2026-07-19. **User ran out of Fable access mid-session and
  explicitly authorized continuing**, with this review to follow when access is restored.
- **Versions / commits:**
  - v1.379 — `ddbaa7d` "fix(npc): mood and relation stop contaminating each other" _(stop the corruption)_
  - v1.380 — `aea21f5` "fix(npc): repair moods already corrupted by relation vocabulary" _(clean the data)_
  - v1.381 — `0c5be2d` "feat(npc): mood staleness audit — moods heal instead of latching" _(fix the symptom)_
  - v1.382 — `d24256f` "fix(prompt): label the two mood tiers so they stop reading as rivals" _(remove the ambiguity)_
  - v1.383 — `<this commit>` "fix(memory): attitude becomes disposition toward the player" _(make the label true)_
  - **The stamped-LIST schema the user approved is deliberately NOT shipped — see "Deferred" below.**
- **⚠ A mistake worth reviewing, caught by the user mid-session:** v1.382 labelled `memory.npcs[].attitude`
  as `"toward you:"` based on the FIELD NAME, while the extractor spec said `"2-4 word mood"`. The label
  therefore asserted a meaning the data did not have — Morwen's stored `"cataloguing, wary"` (which
  echoes her sheet trait nearly verbatim, i.e. her nature) rendered as her opinion of the player. The
  user spotted it immediately: *"To me this reads that she's wary of me... is that correct?"* v1.383
  corrects the extractor spec so the field genuinely becomes disposition, and clears the pre-existing
  values (48 on the live save) under a `memory.attitudeSpec` marker so nothing lies in the interim.
  **This is the same failure mode as the original bug, committed by me: a field whose name and whose
  contents disagree.** Fable should sanity-check that disposition-vs-mood is the right split at all,
  and that the marker guard cannot re-fire and wipe correct values.
- **Trigger:** user reported a party member (Frizwick) "acting off and moody, a shift from how she
  acted previously" in the live Runelords campaign (t867). Diagnosed against the real save.
- **Root cause (measured, not inferred):** `memory.npcs[].attitude` had **two authors writing two
  different categories of data**, last-write-wins:
  - the summarize extractor is spec'd (memory.js:858) to write a `"2-4 word mood"` into it;
  - **every `[NPC:]` tag carrying a relation overwrote it with the RELATION** (`if(npRel)
    memory.npcs[npName].attitude=npRel;`), and seeded it from `npRel` on creation.
  Reproduced live: summarizer wrote `"weary, grieving"`; the next tag restating an *unchanged*
  relation reset it to `"ally"`. Because the GM must tag anyone it interacts with, extractor moods
  were routinely destroyed within a turn or two. Characters still holding a real mood kept it only
  because nobody had re-tagged them in ~50 turns — the same neglect that let Frizwick's `status`
  latch on a stale `"watchful, tense"`.
  Second, independent leg: the parse regex required 1+ chars per slot, so a sparse tag
  (`[NPC:X||ally]`) **failed to match and was dropped silently, losing both fields with no warn**.
  The format therefore rewarded fabricating a value for every slot — which is how relation
  vocabulary ended up in mood fields. Measured on the live save: **6 of 28 NPCs (21%)** carry a
  relation word in `status`; for 4 of them (Karzoug/Tsuto/Mokmurian `"enemy"`, Morwen `"ally"`) the
  leak IS the entire mood field.
- **What changed (commit 1):** `attitude` is now summarizer-owned (tag writes mood→`npc.status`,
  relation→`npc.rel`, never touches attitude; seeds `""`); empty slots parse and mean "leave
  unchanged" (the write path already had those semantics — `if(npStatus)` — only the regex couldn't
  express it); new NPCs seed an empty mood rather than the non-mood string `"unknown"`; roster
  parenthetical and NPC-detail line are built from present parts only (an empty mood previously
  rendered as a stray leading comma, `"Morwen Zethran (, Wife — beloved family…)"`).
- **Files touched (commit 1):** tag_table.js, api.js, memory.js, dev/engine-tests.js, globals.js, sw.js
- **Design forks the user decided (2026-07-19):**
  - **Option B over Option A** — keep mood and disposition as *two distinct fields*, properly
    specified and **labeled at render**, rather than collapsing to one. Rationale accepted: Frizwick's
    own data (`"watchful, tense"` + `"easy, approving"`) is a coherent character — on edge about the
    job, warm toward her spouse — that only reads as contradiction because nothing labels which is which.
  - **Co-locate** both on the NPC record; principled tier line: `worldState.npcs` = who they are now,
    `memory.npcs` = what has happened with them.
  - **Stamped lists** with per-element turn stamps (so mood decays per element instead of latching),
    capped ~3–4 elements, with **the parser doing all structuring — the wire format stays dumb**
    (the GM keeps emitting `[NPC:Name|watchful, tense|ally]`; no new emission burden).
  - **Mood audit at 12 turns / 12-turn cooldown** (user rejected 40 as far too long for a volatile
    field; 40 was tuned for bonds, which move on a ~100-turn scale). Empty mood on a party member is
    eligible immediately, no age wait. Scope: party members + NPCs present in the scene — empty is
    *correct* for off-screen characters and must not be nagged.
  - **Migrate** existing corrupted records rather than waiting for self-heal.
- **Verification done (Opus, commit 1):** 8 new failure-condition tests (702 total, all green) —
  contamination repro, both partial-update directions, the silent-drop, both render guards, and a
  byte-identity pin on the full-field roster render. Frozen strip/doc hashes unchanged. The live
  t867 save re-renders identically for existing data.
- **⚠ What Fable should verify:**
  1. **Consumer audit of `attitude`** — I checked the three prompt render sites (roster, NPC detail,
     NPC graph) but did NOT sweep the UI (sidebar, NPC sheet) or any other reader for code that
     depended on attitude being relation-shaped. This is the likeliest place for a missed consumer.
  2. **The regex loosening `+`→`*` on slots 2 and 3.** Frozen strip/doc hashes were unchanged and the
     strip regexes derive from tag NAMES rather than the parse regex — but confirm that reasoning, and
     that no previously-unmatched malformed shape now matches and writes something unintended.
  3. **Empty status × the B3 death path.** `npcIsDead`/`npcDeadStatus` logic is untouched, but empty
     status is now far more reachable; confirm no interaction with the dead-guard or resurrection branch.
  4. **The "empty is honest" design judgment** — whether a blank mood for an off-screen NPC is the
     right end state, versus some explicit "unrecorded" marker. My argument for empty is empirical:
     Morwen has effectively had no mood in the roster for a long time and reads fine in play, while
     Frizwick's *wrong* pinned mood produced the user-visible drift. Wrong appears worse than absent.
  5. Whatever commits 2–4 add (repair migration over live save data; stamped-list schema + labeled
     renders; the audit note builder + its NOTE_BUILDERS entry and interval tuning).
- **What changed (commits 2–3):**
  - **v1.380 repair:** `stripRelWordsFromMood` + `NPC_REL_VOCAB` (memory.js, beside `clampNpcMood`).
    Typed strip, never positional — the user's first instinct was "drop the 3rd comma element", which
    tested against the live save repairs 2 of 6 and misses the 4 worst (their whole mood IS the leak).
    Conservative vocabulary: `prisoner`/`captive` excluded on purpose (the slot is spec'd
    "mood/condition"); anchored per element so `friendly`/`rivalrous`/`companionable` survive. Applied
    to `worldState.npcs[].status` in `migrateWorldState` and `memory.npcs[].attitude` in `healMemory`
    (memory parses later), also clearing the legacy `"unknown"` placeholder.
  - **v1.381 audit:** `statusTurn` stamp on every mood write (a relation-only update deliberately does
    NOT refresh it); backfilled at the CURRENT turn per the #23 arc-clock precedent. `buildMoodAudit`
    in `NOTE_BUILDERS` — relationship-audit shape, condition-audit per-item trigger,
    `MOOD_AUDIT_TURNS`/`COOLDOWN` = 12/12, party-members-only scope, empty mood due immediately.
- **⚠ DEFERRED — the stamped-list schema (user-approved, NOT built):** a consumer sweep found **9
  readers of `npc.status`**, four of which are raw `/\bdead\b/i.test(n.status)` checks inside the B3
  death-detection path shipped the same day. Converting the field to a list means rewriting all nine
  un-reviewed, a week before Fable returns, to buy a *refinement* (per-element mood decay) when the
  reported symptom is already fixed by a stamp. Judged a bad trade; recorded here so the sweep isn't
  repeated. **The map:**
  - `api.js:439` roster render _(already list-safe — builds from present parts)_
  - `game.js:307` NPC-sheet generation prompt — `npc.status||mem.attitude||"unknown"`, crosses tiers
  - `game.js:344` `guessCompanionClass` — concatenates status as free text
  - `game.js:461, 544, 575, 600` — **four raw `/\bdead\b/i.test(n.status||"")` checks** (B3 territory;
    CLAUDE.md says party-scan dead checks moved to the flag, but these four still read the string)
  - `game.js:1041` blueprint export — maps `status` into a `role` field
  - `ui-panels.js:65` party card — `n.status||"ally"`
  - `attitude` readers: `ui-sheets.js:242` (sheet-gen context), `ui-sheets.js:403` (sheet display)
- **Two further instances of the same category error, found and NOT fixed** (scope discipline;
  worth folding into the schema work): `ui-panels.js:65` defaults a party card's *mood* to the
  relation word `"ally"`; `game.js:1041` writes a *mood* into an exported blueprint's `role`.
- **Additional judgment calls for review:**
  - `"neutral"` is in `NPC_REL_VOCAB`. It read as a relation/alignment label in the one live instance
    (`"Neutral, professionally closed"` → `"professionally closed"`) but could arguably be a real mood.
    False positives are cheap here — the audit refills.
  - Mood-stamp backfill at the current turn means a genuinely stale mood waits one 12-turn window
    after upgrade rather than firing immediately. Chose the #23 "fail late, not early" precedent over
    flagging every party member at once on the upgrade turn.
  - Audit scope is party-only. Scene-present NPCs need `lastSeenAt`-vs-current-node logic; empty mood
    on an off-screen character is CORRECT and must never be nagged.
- **Test bed:** the live campaign was pulled read-only from the Fly volume for diagnosis
  (`camp_1782799175437_7288`, t867, 1.76 MB). It lives in a session scratchpad and will not persist —
  re-pull with a readonly better-sqlite3 read of `/data/ashen.db` via `flyctl ssh console` if needed.
- **Supporting docs:** commit messages on the commits above (each carries the measured root cause);
  the diagnostic transcript in this session.

---

### 3. Campaign clock — new time subsystem, new tags, buildSysPrompt injection, migration (TODO #73)

**Reviewed by Fable 2026-07-23 — VERDICT: PASS on 4 of 5 items, 1 CONFIRMED FINDING (fixed
v1.433). Review performed as the critical-before-code pass for building #89 on this surface;
clock.js, both tag handlers, buildClockBlock, the doc lines and the C3 jump-safety machinery
were read in full.**

1. **C4/C5 deferral soundness — PASS, and #89 improved it.** Elapsed-only v1 is genuinely clean:
   free-text `[TIME:]` stays the GM-owned scene dressing, the clock stays the arithmetic organ,
   and no two-time-systems confusion has surfaced in ~70 field turns of the live campaign. The
   #89 ratification (Day boundary ≡ dawn, `clock%1440==0`) gives the boundary an interpretation
   WITHOUT shipping C4, and fixes C4's eventual mapping to one line: `(clock%1440)/60 + 6`.
2. **`[TIME:]` coexistence — ACCEPTABLE for v1.** A stray `[TIME:]` writes free text and nothing
   else; the v1.433 REST doc line now explicitly glues the two (`[TIME:dawn]` alongside the
   engine's dawn roll), which was the one place they could visibly disagree.
3. **Jump-safety under multiple simultaneous crossings — VERIFIED CORRECT.** `scheduleDue()` is a
   pure threshold filter + oldest-due sort; the existing all-crossed-in-one-jump test covers it,
   and v1.433 adds the composition case (a dawn roll jumping a deadline fires it, elapsed
   correct).
4. **`parseDuration` sanity cap — CONFIRMED FINDING, fixed v1.433.** A `[TIME_ADVANCE:9999d]`
   (27 years) applied silently — the flagged no-silent-failures class. Now capped at 30
   days per response with a console.warn + a ⚠ muts line; a legitimate `21d` skip is untouched
   (both sides engine-tested).
5. **`scheduleRemove` substring edge — reviewed, risk ACCEPTED with note.** A short label
   substring can over-remove ("duke" drops every matching event). GM-authored labels plus the
   muts trail bound the damage; a stricter matcher would trade it for RESOLVED tags silently
   failing to match paraphrased labels — the worse failure. No change.

**Also built on this surface in the same pass: TODO #89** (sleep rolls to dawn; `[REST:long]`
reused as the overnight marker instead of a new tag; same-response TIME_ADVANCE absorption;
the spell-less-character Rest fix). Golden doc hash re-baselined deliberately (+369 chars);
805 assertions green.

**Original entry (as filed 2026-07-20):**
- **Tier:** Fable (drift surface — a new tag family + `applyMuts`/tag_table write paths, a
  `buildSysPrompt` volatile-half injection block, the stable/volatile cache split, and a migration
  over live save data). **User explicitly directed a non-Fable build now** with this review to follow
  ("add a note to todo_checkWithFable, THEN go ahead with the implementation", 2026-07-20).
- **Built by:** Opus 4.8 (NOT Fable) — 2026-07-20.
- **Design:** converged with the user (both designed independently, then compared — see
  [DOC/DOC_clock.html](DOC/DOC_clock.html) for the full spec and the decision log C1–C6). TODO #73 row
  carries the ratified shape.
- **Version / commit:** v1.389 — `<this commit>` "feat(clock): campaign clock — the engine finally
  tracks time (#73)".
- **Trigger / root cause:** #73 — the engine had no concept of a DAY, so in-fiction deadlines
  hallucinated. Live evidence (2026-07-19 Table Talk): asked "days to the solstice" the GM answered
  11, then 8, then 94, and emitted invented `[CALENDAR:]`/`[DAYS_TO_SOLSTICE:]` tags for a system that
  did not exist. Root cause: the GM was asked to REMEMBER and re-state a number.
- **What changed:**
  - New `clock.js` (loads after memory.js, before tag_table.js): `worldState.clock={min, schedule}` —
    ONE scalar (total minutes since epoch), day/hour/min DERIVED, never stored (no carry-desync). The
    GM does ZERO arithmetic; it emits duration estimates and the engine computes everything.
  - Tags (tag_table.js, +4 handlers + strip entries + 2 doc lines): `[TIME_ADVANCE:N]` (unit-suffixed,
    monotonic, clamp ≥1, sums per response), `[SCHEDULE:label|when]` (stores ABSOLUTE dueMin; countdown
    COMPUTED every turn), `[SCHEDULE_RESOLVED:]`, `[SCHEDULE_CANCEL:]`.
  - `buildClockBlock()` — one shared pure builder injected VOLATILE-half only (api.js) AND called by
    Table Talk's `ttStateBlock` (table-talk.js), so #73 makes the solstice answerable in TT (#76) with
    near-zero change — the promised #76↔#73 coupling.
  - **Jump-safety (C3, the load-bearing detail):** firing is THRESHOLD (`now ≥ due`), never
    exact-minute — a 1h deadline slept past by a 6h rest fires on waking. Surfaces DUE events to the GM
    (C2 surface-don't-mutate); the GM narrates and emits the consequent tag.
  - Migration (state.js) + fresh-world init (game.js) add the clock. Frozen strip/doc hashes
    re-baselined (+56 strip chars, +1241 doc chars).
- **v1 boundary to review:** the user ratified "clock authoritative for time-of-day" (C4) and a named
  in-world calendar (C5). Both are DEFERRED to a fast-follow (the display / date-projection layer). v1
  ships the clock as an ELAPSED-time counter and does NOT touch free-text `[TIME:]`/`world.time`. Fable
  should sanity-check that this split is sound (does it leave a confusing two-time-systems state, or is
  elapsed-only genuinely clean for the #73 fix?).
- **Files touched:** clock.js (new), globals.js (version), state.js, game.js, tag_table.js, api.js,
  table-talk.js, index.html, sw.js, dev/load-engine.js, dev/engine-tests.js, TODO.md, DOC/DOC_clock.html.
- **Verification done (Opus):** 745 engine assertions green (+14 new clock tests). Failure-cases
  exercised: JUMP-SAFETY (schedule +60min, advance +360min in one tag → fires, elapsed=300); all-events-
  crossed-in-one-jump; monotonic clamp; countdown recomputes on advance; STABLE-HALF PURITY (clock data
  never in the cached stable half + advancing the clock never perturbs stable — the UA5 cache-killer
  guard); TT surfaces the computed countdown; migration additive; tag round-trips through applyMuts.
  Frozen doc/strip hashes updated deliberately. Live browser spot-check (v1.389, localhost): the full
  pipeline confirmed — `[TIME_ADVANCE:6h]` → Day 0 06h00m; `[SCHEDULE:Winter solstice|11d]` → "in 11
  days"; and the JUMP-SAFETY case live — a watch-change scheduled at +1h, slept past by a 6h rest,
  fired in HAPPENING NOW narrated as "5 hours ago" (elapsed 300m); Table Talk answered the solstice
  "in 11 days" from data. Zero console errors.
- **What to review (Fable):** the C4/C5 deferral soundness; the `[TIME:]` non-change (a stray `[TIME:]`
  still writes free-text `world.time` — is the coexistence acceptable for v1?); jump-safety threshold
  correctness under multiple simultaneous crossings; that `parseDuration` can't be fed something that
  advances the clock wildly (no per-turn sanity cap yet — a `[TIME_ADVANCE:9999d]` would apply; is a
  loud-warn cap wanted?); scheduler dedup/substring-removal edge cases.
- **Display consumer added (v1.390, TODO #79):** `updateMemStatus` (ui-panels.js) now shows
  `... | Turn N | Day N | ...` on the membar — the campaign's in-game day. Reads
  `clockParts(clockNow()).d` (display-only, no writes) and uses the SAME day number the clock block
  feeds the GM, so player and GM can never see contradictory days. This is NOT drift surface (a pure
  read), but it is logged here so Fable sees the full footprint of the clock subsystem in one place.
  Nothing to review beyond confirming the read is display-only and the day number matches
  `buildClockBlock`. Live-verified: an advanced clock renders "Turn 308 | Day 4", zero console errors.
- **Supporting docs:** [DOC/DOC_clock.html](DOC/DOC_clock.html); TODO.md #73 + #79 rows.

### 6. B9/B10 voice-stack campaign — 9 versions in one session, all by Opus (v1.416 → v1.424)

**Reviewed by Fable 2026-07-23 — VERDICT: 3 PASS, 1 CONFIRMED FINDING (fixed v1.429). The fresh
pair of eyes item 3 asked for found exactly what it feared.**

1. **v1.423 emphasis strip — PASS, judgment affirmed.** The regex pair cannot lose text (marker
   pairs capture $1; the sweep removes only bare `*`) and cannot leak a spoken asterisk; drift vs
   `escProse` is inaudible by construction since speech strips ALL markers regardless of pairing.
   The pre-v1.423 speaker-map degradation is the `sp.n` fuse working as designed: mono-voice replay
   is strictly better than wrong-voice replay, and no migration is feasible without re-running the
   model against the OLD splitter's unit boundaries. Accept.
2. **The three `sendAction` edits — PASS.** `recoverAudio` at game.js:1079 is throw-guarded on every
   path, a no-op for voice-off players (`!_audioCtx` early return) and for healthy contexts, and
   touches only audio state — it cannot abort or reorder the turn. The crumbs are read-only. 
   `restoreFailedInput` refuses a non-empty box (STT protection), and is gated on
   `!_committed && !_mpResolve && !silent` — no path re-invites a double-apply. The load-bearing
   turn invariants (non-mutating `sessionLog.concat`, push + turn++ post-await inside
   `commitGmTurn`) were independently re-verified in the B16 investigation and re-checked here.
3. **`_piperInitP` — CONFIRMED FINDING, fixed v1.429.** The guard closes the double-`_piperInit`
   race but NOT the read-during-respawn race its own comment claims to close: `_frameRespawnNow`
   spawns directly and never holds `_piperInitP`, so during the destroy-then-build window (up to
   the 30s ready timeout under pressure — the field-observed case) both `_piperMod` and
   `_piperInitP` read cold+idle and a mid-respawn read spawned a SECOND concurrent realm; the
   pointer-race loser leaked as an orphaned iframe holding a booted ORT engine, and the respawn's
   unconditional failure-path null could clobber a live realm's pointers on top. Fix (v1.429,
   tts.js): the respawn publishes its swap as `_frameRespawnP`, `_piperInit` awaits it before the
   warm check (deadlock-free — verified no `_piperInit` call site runs inside a `_piperSerial` op),
   and the failure-path null is identity-guarded. Two new sabotage-proven tripwires in the RESPAWN
   ORDERING CONTRACT. 796 assertions green.
4. **Destroy-then-build — sound, but do not build on it.** The ordering flip is correctly
   evidence-backed (every prior failure at stage `spawn`). Superseded in importance by the
   2026-07-23 external deep dive ([DOC/piper_deepdive.html](DOC/piper_deepdive.html)): the realm
   axis is orthogonal to the B9 kill, and the entry's own open question — *what accumulates once
   per predict()?* — now has a ranked answer-path (H1: main-page Web-Audio native accumulation;
   the realm can never touch the playback layer) and a discriminating experiment (playback bypass
   at tts.js:1613). The B9 arc continues there, not here.

**Original entry (as filed 2026-07-22):**

- **Tier:** mixed. Most of it is `tts.js`/`piper-host.html`/`ui-carmode.js`, which CLAUDE.md places OFF the drift surface (downstream of `cleanTxt`). **Two items touch it and are the ones to audit first:** the `game.js` `sendAction` edits (B16 — input restore, turn crumbs, `TTS.recoverAudio` call) sit in the turn path beside `logTranscript`/`buildEngineNotes`, and the v1.423 emphasis strip changes what `splitSentences` segments, which invalidates speaker maps stored before it.
- **Built by:** Opus 4.8 — 2026-07-22, across a long interactive session with the user in the loop for every design fork.
- **Supporting docs:** `DOC/BUGS.md` ▸ **B9** (the full arc — 18 crumbs, five falsified hypotheses), **B10** (root-caused + field-confirmed), **B16**, **B14** (closed); `HANDOFF.md`; TODO **#87**.

**What shipped, in order:**

| Ver | Change |
|---|---|
| v1.416 | wasm-memory probe — made ORT's linear memory observable at all (hooks all 5 instantiation entry points; names modules by binary URL because both builds ship minified exports) |
| v1.418 | synthesis moved into a disposable iframe realm (`piper-host.html`), respawn on measured memory; `wasm-probe.js` extracted so page and frame share one probe |
| v1.419 | B16 — failed turn returns the player's typed action; turn-start/turn-fail crumbs; Car Mode failure earcon |
| v1.420 | per-unit ORT peak sampling; **voice deletion fixed** (Chrome-only `handle.remove()` → standard `removeEntry()`, and it now THROWS); assigned-voice guard on automatic eviction |
| v1.421 | **B10 root-caused** — an iOS-interrupted AudioContext can never be resumed, only replaced; `recoverAudio` + wiring to the tap-unlock and the send gesture |
| v1.422 | respawn failure made reportable (stage marker + reason + `rf` count) |
| v1.423 | markdown emphasis was being SPOKEN aloud — display stripped it, speech never did |
| v1.424 | **destroy-then-build** respawn ordering + `_piperInitP` in-flight init guard |

**⚠ What I would most want a Fable pass to challenge:**

1. **The v1.423 emphasis strip is the one with a data consequence.** `normalizeForTTS` now removes `*` markers, which changes `splitSentences` output — measured 4 vs 5 units on a representative line. Speaker maps stored BEFORE v1.423 for passages containing emphasis now fail their `sp.n` fuse and replay mono-voiced. I judged that acceptable (the fuse is doing its job, new turns unaffected), but it is a silent, permanent degradation of stored data and deserves a second opinion.
2. **`sendAction` was edited three times** (input restore, crumbs, `recoverAudio`). None touches `applyMuts`, `sessionLog`, the transcript write or engine-note ordering — I verified `sessionLog` is built non-mutatingly via `concat` and only pushed post-await — but it is the turn path, and three separate edits in one session is exactly where an ordering assumption gets broken quietly.
3. **`_piperInitP` is new concurrency.** Destroy-then-build leaves `_piperMod` null for a real interval, and `_piperInit` sits outside the op mutex. I believe the shared-promise guard closes the double-spawn race, but concurrency added late in a long session is worth a fresh pair of eyes.
4. **The B9 fix still does not work, and that is not hidden.** As of v1.424 it has never once completed in the field. The ordering flip is evidence-backed (every failure was stage `spawn`) but UNVERIFIED — no field data exists for it yet.

**Things Fable should NOT re-derive (falsified by measurement, not argument):** the phonemizer as the ratchet (flat at 16MB in lab AND field), the r8 session recycle (identical curves to the byte), ORT session options incl. `enableMemPattern` (no effect), input-shape bucketing (still climbed), and **ORT memory magnitude itself** — 18 crumbs show death at `pc` 90-125 while memory at death ranges 301-624MB.

**The open question worth Fable's actual intelligence:** *what accumulates once per `predict()` that is NOT ORT linear memory?* Nothing else is currently measured. `vs:0` on two deaths also undercuts voice-model churn. Candidates never instrumented: total page memory rather than ORT's wasm alone, decoded-audio/AudioBuffer lifetime, OPFS handles — and whether the kill is memory-driven at all rather than CPU/energy.

**Verification done (Opus):** 796 engine assertions green. Every new guard sabotage-proven to fire (voice-delete ×4, audio-recovery ×3, respawn-ordering ×2, emphasis ×2) — with the tree restored and re-verified after each. **Honest gap:** most of this subsystem needs OPFS/WebAudio/a real iOS interrupt, so several contracts are SOURCE tripwires rather than behavioural tests, and they are labelled as such where they live.

**Two process failures worth Fable knowing about, because both produced false confidence:** the dev server served a stale in-memory `tts.js` for ~an hour (133,848 bytes vs 139,815 on disk), so several "the fix didn't work" readings tested old code; and a shell-escaping slip made a sabotage test silently vacuous — it "passed" while changing nothing. Both are why the sabotage scripts now assert their own target exists before mutating.

### 1. TODO #23 — per-arc pacing budget + inverse arc-drift detector

**Reviewed by Fable 2026-07-16 — VERDICT: PASS on all four verify items; no code changes needed.**
Full record: [AUDIT_ARC_NUDGES.md](audits/AUDIT_ARC_NUDGES.md); evidence: `testRuns/arc_nudge_loop/`.

- Stable/volatile split: verified clean (skeleton block volatile-half, drift note rides the
  message; cache health confirmed live in usage telemetry).
- Backfill-at-current-turn: signed off (fails late-not-early, aligned with the premature-close
  priority; observed working live).
- Premature-close guard wording: resolved EMPIRICALLY — 2/2 adversarial probes (200-turn
  pressure, incl. a deliberately-stalling player) produced zero railroading; the model steers
  diegetically and never cuts a scene. The wording asymmetry flagged in static review needs no fix.
- Live compliance: 7-trial playtest loop (72 Sonnet GM turns, $6.20), unanimous PASS — drift
  nudge 2/2 one-nudge-one-close; budget nudge converges 4/4 and closes when the fiction's climax
  is reached; A2 captured the v1.296+v1.297 composition firing organically.
- One documented limitation (no change): parallel-act survivor clock can overstate a surviving
  arc's age; soft nudge + demonstrated model restraint make it low-severity.

**Original entry (as filed 2026-07-15):**

- **Tier:** Fable (drift surface — `buildSkeletonBlock` / skeleton lifecycle + the NOTE_BUILDERS engine-notes registry)
- **Built by:** Opus 4.8 (NOT Fable) — 2026-07-15
- **Versions / commits:**
  - v1.296 — `74b2c3d` "feat: per-arc pacing budget — break the single-arc metastasis that stalled Runelords in Act 1"
  - v1.297 — `d3a1a8e` "feat: inverse arc-drift detector — re-nudge an arc whose quest already closed but stays open"
- **Trigger / root cause:** the t727 `Rise of the Runelords` save was stuck in Act 1 (727 turns). Root cause: a single arc ("The Skinsaw Man") metastasized — it reached its authored destination (Foxglove Manor, t508), then spawned an emergent self-replicating "Skinsaw Network" of numbered conspirators that never converged; the authored villain Ironbriar never appeared. The arc's own quest completed+archived yet the arc stayed `active`. TODO #23's act-level pacing budget fired but only repeated "the act is long" with no per-arc pressure to close the offending arc.
- **What changed:**
  - `ARC_TURN_BUDGET=50` (globals.js) + a per-arc `arc.startTurn` clock (stamped at both init sites `stampSkeletonStatus`/`applyBlueprint`, both transition handlers `[ARC_COMPLETE:]`/`[ACT_COMPLETE:]`, and lazily backfilled at load in `migrateWorldState` — at the CURRENT turn, since a long arc's true origin is unknowable). `buildSkeletonBlock` fires a targeted "close THIS arc" nudge that supersedes the generic act-turn line; skipped for parallel/multi-active acts and unstamped arcs. Export strips `startTurn`.
  - `ARC_DRIFT_RECHECK=50` (globals.js) + `buildArcDriftNudge` (api.js, added to `NOTE_BUILDERS`): the inverse of `buildArcQuestNudge` — active arc whose same-name quest already completed+archived, no live matching quest. SOFT only, never auto-closes ("do NOT force it closed"), re-fires every 50 turns per pair via `worldState.arcDriftNudged`. Silent in combat without consuming the timer.
- **Files touched:** globals.js, api.js, campaign_generator.js, game.js, state.js, tag_table.js, dev/engine-tests.js, sw.js, TODO.md
- **Design forks the user decided:** soft-nudge-only (declined a harder auto-advance); the inverse detector was first declined, then requested with a 50-turn recheck cadence; the ONE stated worry is a **premature arc/quest close** — the nudge wording must never force a close.
- **Verification done (Opus):** volatile-half only, stable prompt cache untouched; 16 new engine tests (465 total, all green); spot-checked on the real t727 save (act nudge at load, per-arc nudge at t778; inverse detector fires with correct note, immediate re-call silent, re-fires at +50).
- **What was verified (Fable, 2026-07-16):** all four items above — see the verdict block and audits/AUDIT_ARC_NUDGES.md.
- **Supporting docs:** TODO.md #23 row (full detail); audits/AUDIT_ARC_NUDGES.md; testRuns/arc_nudge_loop/ (protocol, injector, EVAL_NOTES, 7 trial corpora).

---

### 8 — Campaign-clock work: instrumentation, player-facing time, 1-based days, and the TIME_ADVANCE scene rewrite (v1.496→v1.499, all Opus 5, 2026-07-30)

**Reviewed 2026-07-30 (Fable, /fable-review delegated-evidence workflow — 5 parallel Opus briefs A–E shared with entries 9/10). Original filing:** see todo_checkWithFable.md git history at 40bd8f9 (entry text preserved verbatim there); TLDR: a field report ("game time feels WAY too slow") became a measurement (timeline_day1.html — 216 turns, clock 1043 min vs ~2332 narrated, 2.24×), then `.ta` instrumentation (v1.496), a player-facing clock (v1.497), 1-based day labels (v1.498), and the drift-surface TIME_ADVANCE scene-pricing rewrite (v1.499).

**VERDICT — all four ship items PASS; four suite hardens + two doc fixes shipped v1.501; measurement follow-up filed.**

- **④ TIME_ADVANCE scene rewrite (the drift-surface item): PASS.** Brief A runtime-proved the cache contract: stable half byte-identical (len 30550, djb2 2087269905) across **17 mutation classes** including `[TIME_ADVANCE:]`+`[SCHEDULE:]`; the rewritten doc line is a pure string literal (no state contact); clause guard + re-baselined frozen hash (−1271027224/17350) both green at HEAD. Two test-level gaps found and FIXED v1.501: the cache-invariant test never mutated `worldState.clock` (added), and the clock-face test was gated on `indexOf("pm")` so an AM-only face (`Day 1, 6:00 am`) passed undetected (regex-only now). Both sabotage-proven (S4/S5, scratch copy).
- **① `.ta` receipt: PASS, memo reasoning AIRTIGHT at runtime.** Brief B's probes: warm memo + push → recompression (`.ta`/`.ck` cross the localStorage boundary intact); post-stamp without invalidate → stale blob (the `.sp` trap reproduced); `[REST:long]` dawn roll genuinely captured in the delta (100→1440, absorbed `[TIME_ADVANCE:8h]` counted once). Coverage gap FIXED v1.501: none of the four #105b tests drove the real `commitGmTurn` (one test's TITLE claimed it; its body called `applyMuts`) — a real-turn-path wiring test (TIME_ADVANCE + dawn roll) and a warm-memo round-trip test added, sabotage-proven (S1/S6). **Accepted residue:** a tags-only GM response (prose empty after stripping) writes no transcript entry at all, so a clock move can go unreceipted — pathological input; synthesizing transcript text would violate transcript sanctity.
- **② player-facing clock: PASS.** Display-only confirmed — `clockStamp` has zero callers in api.js; the volatile CAMPAIGN CLOCK line is `clockFmt`'s elapsed decomposition, not a clock face; `.ck`-less entries render the bare turn number (the `!=null` guard is the sole protection against `clockStamp`'s null→now fallback, and no caller can bypass it).
- **③ 1-based day labels: PASS — second opinion on the mid-campaign +1 shift: harmless.** Brief C swept every producer: all three runtime "Day N" builders route through `clockDayNumber()`; no half-renumbered surface exists. The GM receives a day number through exactly two channels, both `buildClockBlock`, both recomputed every turn; the instructions forbid restating; old-prose day references persist verbatim in sessionLog/RAG but those channels are explicitly subordinated to current-state blocks, and empirical incidence across every available save is one in-fiction diary entry. No better alternative exists (migrating the scalar would corrupt `.ck`). The commit's 4 sabotage clauses were not persisted (harness runs are ad-hoc) — independently re-derived and re-proven 4/4, including both half-renumbered states. Stale 0-based artifacts fixed v1.501: state.js migration comment, DOC/DOC_clock.html worked examples.
- **Probe 1 (does the GM now over-charge?): UNDETERMINED — no post-v1.496 `.ta` data exists anywhere on disk** (Brief B parsed 25 saves/corpora, zero `.ta`; the newest export predates the feature by 12 minutes). ACTION (user): play a few dozen turns on ≥v1.496, export, re-run the timeline off `.ta` — then decide cause ②'s warn/floor. Cause ② (tagless turn advances zero, silently) stays open in #106 by design.

**Receipts (delegated-evidence economics):** Brief A 130.7k tok / 28 calls / 254s · B 138.9k / 31 / 296s · C 145.3k / 39 / 314s · D 145.4k / 37 / 330s · E 148.4k / 32 / 324s — ~709k subagent tokens total, ~5.5 min wall clock (parallel), across all three entries. Delegate quality: excellent — every brief ran real-engine probes, reported actual outputs, self-declared scope growth, and labeled UNDETERMINED honestly (B's save-scan re-ran greps as JSON parses after spotting the pretty-print miss; C flagged its own DOM-path limits). Findings-fed: A→2 hardens, B→1 accepted residue + 2 test fixes + the measurement blocker, C→2 doc fixes + re-proven sabotage, D→1 confirmed defect, E→1 confirmed wording defect + 1 TODO row. For next run: briefs should state expected field names in JSON-parse form up front (the grep-miss cost B one retry).

---

### 9 — Inventory acquisition toast (#107, v1.500, Opus 5, 2026-07-30)

**Reviewed 2026-07-30 (Fable, Brief D). Filing TLDR:** snapshot-diff toast at the turn site (`🎒 Collected: Rope x2`), zero parser contact, silence-is-signal.

**VERDICT — one CONFIRMED defect fixed v1.501; everything else affirmed with observed outputs.**

- **CONFIRMED (fixed v1.501): a non-string inventory entry killed the whole turn.** `inventorySnapshot()` sits at the top of `commitGmTurn`, one line before `applyMuts`, and `_invNorm` threw `(s || "").replace is not a function` — state, transcript, and narration all lost; Retry re-entered the same snapshot and threw again. The class is real: load-time migration deliberately PRESERVES non-string entries, and the other two inventory readers both skip them. The same latent throw sat inside `addInventoryItem`/`removeInventoryItem`/`_stampItemKept` loops (the failing test's first fix attempt exposed `addInventoryItem` throwing inside the handler — caught by applyMuts, gain silently dropped), so the fix landed at the ONE shared boundary: `_invStr` coercion in the `_inv*` primitives (api.js), plus the snapshot's semantic skip. Failing-test-first (red with the evidence's exact message), sabotage-proven (S2, scratch copy).
- **Affirmed by runtime probes:** delta not total (`Rope x2` for 5→7); silence on loss-only, net-zero, and no-change turns; cap 6 + "+N more" at exactly 7; wiring proven by the two real-`commitGmTurn` tests (the 3/4 sabotage story in the filing is accurate — the recovered harness re-ran 4/4); quantity-in-name keys agree with the sheet's storage form.
- **(a) player-only scope: ACCEPTED for now.** Companion gains stay visible in the muts line; extending the toast is demand-driven, not principled — the noise-restraint precedent holds.
- **(b) losses stay silent: ACCEPTED.** The diagnostic is "did the gain land"; a loss toast is noise.
- **(c) `rerollLast`: AFFIRMED at code level** — no path into `applyMuts`/`commitGmTurn`/`toastInventoryGains` exists (its header contract says so and the call-graph confirms); no test added (async DOM pipeline; code-affirmed).
- **Accepted residues:** empty-payload `[ITEM_GAINED:  ]` pushes `""` and toasts `🎒 Collected: ` (pre-existing parser faucet — the toast faithfully mirrors the sheet, which is its contract); >x9 quantity divergence (P14 deliberate); the opening turn toasts (desirable — an opening that grants items should say so). The filing's open question (did the reported t1266+ turn actually emit `[ITEM_GAINED:]`?) remains unanswerable from disk — the toast's absence is now the diagnostic for exactly that.

---

### 10 — Parallel-act hook delivery (v1.495, Opus 5, 2026-07-30)

**Reviewed 2026-07-30 (Fable, Brief E). Filing TLDR:** campaign spine leaked into party banter (t1244 Turtleback Ferry/Jorgenfist, t1263 Mokmurian); v1.495 added a HOOK DELIVERY constraint to the skeleton block's PARALLEL line.

**VERDICT — placement affirmed; one CONFIRMED wording defect fixed v1.501; the untouched channels filed as TODO #108.**

- **Placement AFFIRMED:** single appended sentence, volatile half only (stable byte-identical with a skeleton present), adjacent to the parallel-act line it constrains, zero hash contact.
- **CONFIRMED (fixed v1.501): the constraint's referent did not exist on the page.** It said "foreshadow inactive arcs" — but BOTH parallel-act activation paths (game.js `_ba` logic, tag_table.js ACT_COMPLETE handler) mark EVERY arc of a parallel act `active`, so the block renders all four RotR Act-2 arcs `[CURRENT]` and labels nothing inactive. Reworded to "the arcs the party is NOT currently pursuing". Also CONFIRMED: no test pinned the sentence — deleting all 356 bytes of it changed zero assertions. A pin test (presence + the SAYS clause + the referent) now guards it, sabotage-proven (S3, scratch copy).
- **The contributing channels the filing left untouched are now measured and filed as TODO #108:** with the RotR sample blueprint, the BESTIARY block (STABLE half, unconditional) names Jorgenfist/Mokmurian every turn and Karzoug 6×; `memoryTOC` KNOWN NPCs and KNOWN OF serve seeded spine names ungated; ACTIVE NPC DETAILS serves spine-heavy seeded bios whenever the NPC is named in the last 6 messages — including party companion Shalelu, whose seeded bio carries Jorgenfist/Mokmurian/Karzoug/Xin-Shalast. That is a design-scale containment problem (one meta-knowledge rule, not five channel edits) and goes to its own Fable session, not a ride-along. Whether the reporting campaign carries a bestiary is UNDETERMINED (no save at t1244 on disk); whether the v1.495 sentence changed field behaviour rests on field observation only — the same weakest-evidence caveat the filing itself made.

---

### Appendix — entries 8-10 original filings (verbatim, as removed from the queue 2026-07-30)

### 8 — Campaign-clock work: instrumentation, player-facing time, 1-based days, and the TIME_ADVANCE scene rewrite (v1.496→v1.499, all Opus 5, 2026-07-30)

**TLDR:** a field report ("game time feels WAY too slow") turned into a measurement, then three shipped changes and one prompt rewrite. The prompt rewrite is the drift-surface item and is where a reviewer should start; the rest is additive or display-only.

**Origin (the measurement, not a guess).** The user asked for a per-turn breakdown of Day 1. It could not be produced: `[TIME_ADVANCE:]` is stripped before `logTranscript` writes, and the `"Time +Xm"` line the handler builds into `R.muts` is discarded (`applyMuts` returns `R`; `commitGmTurn` never captured it). Only the running total `worldState.clock.min` survived. So Day 1 was reconstructed from prose by 8 parallel Sonnet agents pricing each turn under the GM's own reference scale, deliberately unaware of the real total. Result, from the live save `Ammut_t1265.tnd`:

- Day 1 = **turns 1050–1265** (anchored on the t1049 `[REST:long]`, which rolls the clock to the 1440 dawn boundary; corroborated by t1003, where the GM states "20 hours 2 minutes elapsed since epoch")
- clock actually advanced **1043 min** (4.8/turn) · narration describes **~2332 min** (10.8/turn) → **2.24×**
- conversation was **100 of 216 turns** (46%), priced by the old scale at 1–5 min
- ⚠ the clock started **mid-campaign** (v1.389 ≈ t917; `migrateWorldState` starts an old save at Day 0 on load), so this is NOT the campaign's first day
- evidence artifact: **[timeline_day1.html](timeline_day1.html)** (216 line items, banner notes the later renumbering)

**What shipped, in order:**

| ver | commit | change | risk |
|---|---|---|---|
| v1.496 | `a7709d1` | `.ta` — minutes the clock moved, stamped per GM transcript entry | additive field, turn path |
| v1.497 | `088134f` | player-facing `Turn N \| Day D, h:mm am`; `.ck` absolute clock stamp | display only |
| v1.498 | `1e13293` | day labels 1-based (first day = Day 1) — **changes GM prompt text** | label layer |
| v1.499 | `a62a6bf` | `[TIME_ADVANCE:]` reference rewritten to price SCENES, not actions | ⚠ **drift surface** |

**① v1.496 — `.ta` (the receipt).** `logTranscript(role,text,raw,taMin)` stamps minutes the clock ACTUALLY moved, measured as a clock delta around `applyMuts` in `commitGmTurn` rather than parsed from the tag — so a `[REST:long]` dawn roll is captured too. Stamped **even when zero**, because a tagless turn is the silent-failure class the field exists to expose and a missing key is indistinguishable from a pre-feature entry. Lands at push time, so `transcript.length` changes and the compression memo misses on its own — **the `.sp` post-stamp trap (needing `invalidateTranscriptMemo`) does not apply**; a reviewer should confirm that reasoning. 4 tests red-first, 3 sabotage clauses proven.

**② v1.497 — player-facing clock.** `clockTimeOfDay` implements the projection already fixed by #89 and written in clock.js's own header: `(clock%1440)+6h`, dawn=6am. Computed every render, never stored. `clockStamp` is the single formatter feeding BOTH the turn caption and the session bar. `.ck` (absolute clock at narration time) is stamped so a rebuilt transcript captions past turns correctly; entries predating it render the bare turn number rather than a guess (verified against that failure condition). An engine test asserts **no clock face reaches either half of the system prompt**.

**③ v1.498 — 1-based day labels (user call).** `clockDayNumber()` is the only 1-based producer; both `clockFmt` (GM clock block) and `clockStamp` (player) route through it, so the surfaces cannot end up a day apart. `clockParts().d` stays a pure 0-based elapsed decomposition on purpose. Pure relabel over the same scalar — no migration, and `.ck` written under the old label still renders right. **This DOES change GM-visible prompt text** (the clock block reads Day N+1 now); mid-campaign that shifts the GM's day number by one against any day reference in older prose. Judged low-impact because the GM is instructed never to restate or compute these numbers, and the block is recomputed every turn — **worth a second opinion.** 4 sabotage clauses, including both half-renumbered states.

**④ v1.499 — the TIME_ADVANCE scene rewrite. ⚠ THE DRIFT-SURFACE ITEM — START HERE.**
Touches `tag_table.js` TAG_DOCS → `buildStateTagsDoc()` → the STATE TAGS block in the **STABLE (cached)** half of `buildSysPrompt` (api.js:673). New "CHARGE THE WHOLE SCENE" rule plus scene-inclusive values (word in passing 5–10m · real conversation/interrogation/negotiation 20–45m · searching a room 30–60m · errand or asking around town 1–2h · combat round unchanged at ~1m) and an instruction to charge the gap when the prose implies one.
Pre-code review recorded in the commit: one-time prompt-cache invalidation on deploy, re-warming next turn (**verified the stable half is still byte-identical across a turn + clock move**); `scheduleDue()` is threshold-based (`now >= due`) and already jump-safe, so larger advances cannot skip a deadline; `CLOCK_MAX_RESPONSE_ADVANCE` (30 days) is far from scene-scale.
Frozen doc hash **deliberately re-baselined** (−1634278882/16673 → −1271027224/17350, +677 chars) with the reason logged inline.
Values were anchored to the measured 10.8 min/turn rather than chosen — **the real risk of this change is overshoot (days flying past), not undershoot.**

**Testing note a reviewer should weigh.** The frozen doc hash catches ANY byte change, so a normal one-file sabotage would have "caught" every mutation while proving nothing about the new clause guard — the exact fake-coverage the harness refuses. So the sabotage is **two-file**: it mutates the prompt text AND re-baselines the hash the way a careless commit would, then asserts the clause guard still fires. 4/4 caught (scene framing, "EVERY turn", the `[REST:long]` carve-out, the no-arithmetic line), both files restored byte-identical. Harness: scratchpad `sab_scene.js` (not committed — reproduce or ask).

**What a reviewer should probe first:**
1. **④'s prompt text against a real transcript** — does the GM now over-charge? Measure off `.ta` (that is what ① exists for) before trusting the reconstruction's 2.24×.
2. **④'s stable-half placement** — confirm the cache contract genuinely holds and no volatile state leaked in with the rewrite.
3. **③'s mid-campaign day shift** — is the one-day jump in GM-visible text actually harmless in a mature save?
4. **①'s memo reasoning** — is "push-time stamping needs no `invalidateTranscriptMemo`" airtight, given the `.sp` incident?
5. **Cause ② is UNSHIPPED and still open** (TODO #106): a turn with no `[TIME_ADVANCE:]` advances zero, silently — `if(!ts.length)return;`, no warn, no floor, one caller. It is the larger error and a no-silent-failures violation; the remedy was deliberately deferred until ④ can be measured.

**Supporting material:** TODO **#106** (full root cause + both causes + every remedy note), TODO **#105** (unrelated, promoted from B17 the same session), **timeline_day1.html**, engine suite 895 → 905 assertions across these commits.

---

### 9 — Inventory acquisition toast (#107, v1.500, Opus 5, 2026-07-30)

**TLDR:** the sheet changed in silence, so the player could not tell a recorded pickup from a narrated-but-untagged one. A turn that grants items now says what landed. Not drift surface — zero parser contact — but it sits on the turn path and its absence is now load-bearing signal.

**Field report.** The GM narrated the garrison quartermaster *"handing over what's left of the blasting supplies, a few coils of rope, nothing fancy"* and the user had no way to know whether any of it reached inventory. Narration and sheet are separate channels: the prose can describe an acquisition the tags never made.

**As built.** `inventorySnapshot()` / `toastInventoryGains(pre)` (game.js) — a snapshot-diff at the TURN call site, the same idiom as core memories / conditions / relationships, **zero parser contact**. Toasts `🎒 Collected: Rope x3, Blasting charge`.
- Reports the **delta, not the stack total** — a rope stack going 5→7 says `x2`, because "did that land?" is answered by what you just got. Counts compare per `_invNorm` key.
- **Silent when nothing was gained, on purpose:** a narrated pickup with NO toast now means the tag never fired. That is the diagnostic the user was missing, so it must never toast speculatively.
- Capped at `INV_TOAST_MAX`=6 named items + "+N more" — never silently truncates.
- **Deliberately NOT a `showToast` inside the `ITEM_GAINED` handler:** `syncCharSheet` applies a batch of those tags during its audit and already owns a louder per-correction trail (#50a), so a handler toast would double-report there. Wiring at the turn site excludes the sync path for free (the #40 precedent).

**⚠ Testing note worth a reviewer's attention.** The first sabotage pass came back **3/4** — deleting the call from `commitGmTurn` entirely left every test green, because they all invoked `toastInventoryGains` directly and none proved it was **wired**. That is textbook fake coverage and the harness caught it. Two tests were added that drive the real `commitGmTurn` (grants → toast; grants nothing → silent); now 4/4, the other clauses being "reports the total instead of the delta" and "treats a loss as a gain (>= for >)". Harness: scratchpad `sab_inv.js`. Verified live in the browser (toast text + inventory panel agree).

**What a reviewer should probe:** (a) is player-only the right scope — companions gain items via `COMPANION_ITEM_GAINED` and are currently silent; (b) should losses get the same treatment, or is that toast noise (the #1 misroute-toast noise watch is precedent for restraint); (c) does the toast fire anywhere unintended — `rerollLast` re-narrates the same turn but never re-runs `applyMuts`, so it should not, and that is untested.

**Still open:** whether the reported turn (t1266+, past the exported save) actually emitted `[ITEM_GAINED:]` is UNKNOWN — it could not be checked. If the emission side is the real defect, this change only makes it visible, it does not fix it. Related unshipped work: #60 ghost-consumable detection already covers the narrated-but-untagged class for consumables.

---

### 10 — Parallel-act hook delivery (v1.495, Opus 5, 2026-07-30)

Filed under the standing budget-exhausted rule (ALL Opus work documented), not because it is drift surface — though it touches the skeleton lifecycle, which is.

**Field report:** the campaign spine leaked into party banter — t1244 named Turtleback Ferry and Jorgenfist unprompted, t1263 dropped "Mokmurian". **Root cause:** `buildSkeletonBlock`'s PARALLEL-act line said "weave hooks for the others into scenes naturally" with **no delivery guidance**, so the GM took the cheapest route and had party members simply know things. Reinforced by the bestiary block, which names Jorgenfist/Mokmurian every turn in the STABLE half, and by seeded `memory.npcs` knowledge.

**Change:** a HOOK DELIVERY constraint — foreshadowing for inactive arcs must arrive through a named NPC with a reason to know (a sheriff reporting trouble, a scholar with rumors, a merchant with road news), never narrator asides or party chatter; the hook must be something someone SAYS.

⚠ Prompt text in the **volatile** half (skeleton block), so no cache impact. **No new test** — a prompt-wording change with no engine behavior to assert; suite green but this one rests on field observation only, which is the weakest evidence in this batch. A reviewer may reasonably want the bestiary/seeded-knowledge channels examined too, since they were contributing causes left untouched.

