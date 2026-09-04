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
- **Supporting docs:** DOC/Research/DOC_speaker_casting.html (spec S1–S5); the four agent reports in this
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
  [DOC/Research/DOC_clock.html](DOC/Research/DOC_clock.html) for the full spec and the decision log C1–C6). TODO #73 row
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
  table-talk.js, index.html, sw.js, dev/load-engine.js, dev/engine-tests.js, TODO.md, DOC/Research/DOC_clock.html.
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
- **Supporting docs:** [DOC/Research/DOC_clock.html](DOC/Research/DOC_clock.html); TODO.md #73 + #79 rows.

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
   2026-07-23 external deep dive ([DOC/Research/piper_deepdive.html](DOC/Research/piper_deepdive.html)): the realm
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
- **③ 1-based day labels: PASS — second opinion on the mid-campaign +1 shift: harmless.** Brief C swept every producer: all three runtime "Day N" builders route through `clockDayNumber()`; no half-renumbered surface exists. The GM receives a day number through exactly two channels, both `buildClockBlock`, both recomputed every turn; the instructions forbid restating; old-prose day references persist verbatim in sessionLog/RAG but those channels are explicitly subordinated to current-state blocks, and empirical incidence across every available save is one in-fiction diary entry. No better alternative exists (migrating the scalar would corrupt `.ck`). The commit's 4 sabotage clauses were not persisted (harness runs are ad-hoc) — independently re-derived and re-proven 4/4, including both half-renumbered states. Stale 0-based artifacts fixed v1.501: state.js migration comment, DOC/Research/DOC_clock.html worked examples.
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


---

## Entry 13 — Sol W1–W7 drift-hardening handoff verification → six-brief delegated-evidence review (reviewed 2026-08-12, fixes v1.602)

**Disposition.** Filed as an Opus verification pass over DOC/workdone_sol.html (v1.601, c8c37f1). The user switched the session to Fable mid-review and asked to "hit entry 13", so the /fable-review workflow ran END-TO-END in one session: 6 parallel Opus evidence briefs (all runtime-probed against the real engine, read-only), Fable spot-checked every load-bearing quote against the tree before acting, and adjudicated failing-test-first.

**Verdict.** The W1–W7 set is sound at its core — every headline number reproduced, and the deep boundaries (clone-apply rollback, side-effect buffering, evidence caps, portable isolation, W1 guard disposition) held under hostile probes. Eight boundary defects were confirmed and fixed as v1.602; the two sharpest each RESURRECTED the exact incident their workstream shipped to close:

1. **W2 stripped-tag reward leak (critical, brief A).** identity.js stripped a refused death tag BEFORE running the conflict scan over the remaining text, destroying the scan's own evidence — an unauthorized death's co-emitted [XP:]/[GOLD:]/[QUEST_STEP:done]/[QUEST:completed] all committed (a quest ARCHIVED off a refused corpse in the probe) whenever the victim was named only inside the tag. Fixed: the in-response refusal now rides into the reward gate as its subject.
2. **W6 array-type bypass (high, brief D).** _w6SummaryTexts validates only strings; an ARRAY-valued chapterSummary skipped identity validation entirely and fileChapter wrote the literal t1644 contradiction into chapters + eventHistory. Fixed: prose tiers normalize to strings before the preflight; unusable shapes drop loudly.
3. **W2 receipt permadeath (high, brief A).** CANON_TXN_CAP=24 with canonTxnOverflow written and cleared nowhere — 24 claim ids permanently killed the envelope mechanism for a campaign. Fixed: committed receipts retire CANON_TXN_RETIRE_TURNS=12 behind a successful structured summary (quarantined receipts NEVER retire); the latch clears when capacity recovers.
4. **W2 same-turn/quarantined-txn summary citations (brief B).** w2ValidateSummary's provided-sourceTurn path had no same-turn guard (a summary could cite evidence armed by the very response being summarized — the tag path refused the identical shape), and canonTxnId was schema-only, never read: a QUARANTINED transaction id was citable as death authority. Both refused now; an unknown id warns and defers to handle evidence.
5. **W2 latched-frame drop (brief B).** s.overflow=s.overflow||{…} kept only the FIRST overflow record, so a transition under an already-latched overflow silently dropped the departing frame's accepted evidence (10 live bindings vanished in the probe) while the warn claimed preservation. Fixed: a bounded buffer (SCENE_REF_SEALED_CAP more frames) preserves them as readable evidence; only past 2× the cap does a frame drop, honestly.
6. **W7 over-length bond orphan (brief C).** Verbatim migration (lossless BY DESIGN) can exceed REL_VALUE_MAX, but the confirmation tag was length-refused BEFORE the same-value check — the row was permanently unconfirmable by the very tag the nudge prints. Fixed: exact re-emission of existing canon bypasses the prospective-value bound.
7. **W7 merge self-edges (brief C).** No filter existed for entity===owner; folding both sheets' rows through a merge minted "Ameiko → Ameiko: Wife", rendered in prompt/audit/UI. Fixed: migration drops self-edges loudly (portable sheets exempt; pre-images already in the merge archive).
8. **Chapter-death shapes + eras import (briefs B/D).** "X's corpse/remains" and "X bled out" now count as death-shaped chapter claims; the .tnd import whitelist carried no eras key, silently dropping compiled eras on every import (the attitudeSpec/#144A class again) — added.

**Test-integrity findings (briefs F + B).** The W2 overflow engine test called sceneRefsSummarySuccess() BEFORE the death it claimed to test fail-closed — reordered so the latch is actually exercised. Three structurally-unable-to-fail clauses repaired (an always-true ternary, a `…&&false` predicate, a self-contradictory gender check). A #156 location-repair test sat inside the W6 section (squash artifact) — relocated; focused counts are now W2 21 · W6 9 · W7 28 (+13 in the new #168R section). The handoff's "22 focused W2" was corrected to the measured 21; CLAUDE.md's "24/24" W7 gate count was stale (25, now 27 with the new clauses).

**Verification.** All 8 fixes landed failing-test-first in section "#168R review hardening" — each failed with the evidence's exact predicted reason before the fix. Suite: 1319 ALL GREEN (was 1306). Sabotage: W2 gate 15/15, W7 gate 27/27, W6 15/15 + identity 22/22 + drift 12/12 unchanged; the 8 new clauses prove against the focused #168R section for attributability (brief F showed exit-status verdicts cannot tell an unrelated red from a real catch). Sources restored byte-identically after every gate.

**Accepted residues (rationale).** Sealed frames remain valid death authority until a summary retires them — sealing governs retention, not authority; blocking would fail-close legitimate cross-scene deaths. Un-enveloped reward tags remain legal — the envelope is the high-impact channel and the 824–826 backstop (now fixed) guards the bare path; forcing envelopes onto every ordinary reward turn would break normal play. The W7 same-turn duplicate-confirm refusal stays silent for now — it doubles as the double-emission dedupe path; a muts line would fire on every model tag repetition (decide in #171). "Ammut killed Mokmurian" abstention in _w2ChapterDeath is deliberate and test-pinned (the subject is the killer, not the corpse).

**Deferred with evidence cited.** TODO #169 (recognizer precision: W4 observer false-positive classes, W6 FN/FP classes incl. the stray-quote whole-field abstention, the self-death classifier's missing subject resolution), #170 (sabotage attribution + the measured unguarded set incl. W6 recognizer internals and CI running no gates), #171 (envelope hygiene tail: unmatched-marker blast radius, header-variance demotion, circular conflict reason, silent refusals, pending.prev re-check).

**Phase-4 receipts (delegate economics).**

| Brief | Lane | Tokens | Tool calls | Wall | Fed into |
|---|---|---|---|---|---|
| A | W2 txn envelope | 246,099 | 59 | 13.9m | fixes 1, 3; #170, #171 |
| B | W2 scene ledger | 239,264 | 57 | 16.1m | fixes 4, 5, 8; test reorder; #170 |
| C | W7 axes | 211,783 | 34 | 9.6m | fixes 6, 7; #171 |
| D | W6 recognizer | 203,468 | 60 | 12.1m | fix 2, eras half of 8; #169, #170 |
| E | W4 + Mokmurian | 186,126 | 37 | 10.6m | #169 (classifier + observer corpora); repair gates affirmed |
| F | coverage/parity | 227,798 | 65 | 15.3m | focused counts, W6 relocation, tautologies, doc corrections, R8 cap guards |

Total ≈ 1.31M delegate tokens / 312 tool calls; wall ≈ 16 min (parallel). Delegate quality: all six stayed read-only and used UNDETERMINED honestly; brief F self-detected and discarded a OneDrive hash-timing artifact; brief E made one false claim (said no t1667 export existed in testRuns/ — it did), caught by reviewer spot-check; briefs A/B ran guard-coverage mutations in-memory/on-mirrors rather than touching the shared tree — exemplary discipline worth repeating in future briefs.

**Original queue entry (verbatim):**

### 13 — Verification of the Sol W1–W7 drift-hardening handoff (Opus, docs only)

**Filed:** 2026-08-11. **Artifact:** `DOC/Research/workdone_sol_doublecheck.html` — restored
2026-08-13 from `2220f88` under its own filename, because `83bd63b` (08-13) overwrote the
original path `DOC/Research/workdone_sol_review.html` with a DIFFERENT document (the Fable review &
action plan); this entry's artifact had existed only in git history since. **Commit:** `2220f88`
(documentation only — the engine is untouched at v1.601 / `c8c37f1`). **Reviews:**
`DOC/workdone_sol.html`, whose own final section requests exactly this Fable pass.

TLDR: every checkable claim in the W1–W7 handoff was re-executed against the tree rather
than read. The engineering holds and no code defect was found; four defects in the *record*
were fixed in the same pass. What remains for Fable is the adversarial design question this
pass deliberately did not attempt.

Reproduced exactly: 1,306 assertions green (twice — once directly, once via the pre-commit
hook); 83 sabotage mutations caught across five gates with zero misses; both exact-incident
replays green; `git diff --check` and TODO lint clean. Probed at the failure condition rather
than trusted: `WEIGHTY_REL_RE` driven with the real t1666 `"Owed a favor collected, warming"`
payload plus a 24-case morphology corpus in both polarities; `NPC_DEATH_RETRACTED` confirmed
absent from the *generated* `buildStateTagsDoc()` block while the new W2/W7 tags are present;
the live t1667 save confirmed byte- and mtime-identical across the replay.

Corrected in the handoff: the W7 sabotage count read 24/24 in three places where the gate
proves 25; the contents page promised an order the body did not deliver (the closing
review-focus section sat ahead of two implementation sections) — reordered and renumbered
1–16 by script under a content-preservation assertion; the cited t1667 export lived in
`Downloads`, so the headline receipt could not be reproduced from a checkout — moved to
`testRuns/`, cited by repo-relative path, replay re-run green from it.

**What a reviewer should probe first — explicitly outside this pass:**

1. **Whether the sabotage clauses are the *right* ones.** This pass proved 25/15/9 mutations
   are caught; it did not adjudicate whether that set is the correct adversarial coverage.
   This is the highest-value remaining question and the handoff's §16 asks for it directly.
2. **The W2/W6/W7 boundaries listed in the handoff's §16** are all still unreviewed:
   same-response authority, envelope subject/quest matching, delayed continuation, cap
   recovery, receipt multiplicity, rollback side effects, migration under saturated queues,
   whole-pair removal, cross-campaign load ordering, identity convergence from both endpoints.
3. **Focused sub-counts were not isolated** — the cited 28 W7 / 10 W6 / 22 W2 focused
   assertions live inside the 1,306 aggregate and were neither confirmed nor disputed.
4. **Traceability (wording since reconciled):** v1.599 and v1.600 were narrated as releases in
   both the handoff and CLAUDE.md but exist in no commit — all three are squashed into
   `c8c37f1`, so W7 cannot be reverted or bisected independently of W6. The prose now names
   `v1.601` everywhere and the handoff carries a standing traceability banner; git history is
   untouched. The *structural* consequence stands and is worth a reviewer's opinion: three
   drift-surface workstreams share one revert unit.

Nothing here was live-tested: the whole pass is headless, with no deployment, no rendered UI,
and no GM turn against a real API.

---

## Entry 11 — Runelords t1467 phantom-presence field analysis (archived 2026-08-17)

**CLOSED — adjudicated outside the queue.** The review this entry asked for happened in its own
session arc, not via /fable-review: the Fable×Sol reconciliation (commit `6bdfe42`, 2026-08-07)
adjudicated the purge-vs-non-emission confidence with the Morwen purge-discriminator, and the
missing-record phantom-presence class shipped the same day as #137's teeth — presence audit,
stay-behind watcher, membership≠presence, provenance ring (commit `94b6c55`, v1.553). The queue
entry was never groomed out afterward. Archived verbatim below by the 2026-08-17 Fable session
(entry-17 review day) with no further adjudication needed.

**Original entry as filed:**

**Filed:** 2026-08-07. **Artifact:** `DOC/Research/OffTheRails_sol.html`. **Tracker:** TODO #137.
The owner requested independent Sol and Fable deep dives into the latest campaign export. Sol's
finding is that fiction/state first diverged again at t1443 (Daeris stays at the inn) and t1457
(Morwen remains outside the sealed Spire door); Daeris' first visible teleport is t1463, and the
t1466 summary then fossilizes it. Both split responses ran on v1.544/v1.546, before #135's v1.550
fresh-split grace, so the strongest mechanism is the already-reproduced dies-at-birth purge, but
the save no longer retains enough raw-tag provenance to distinguish that from GM non-emission.
The remaining unbuilt class is missing-record phantom presence: every audit starts from an existing
`splitLoc`, while party sheets and `buildSceneManifest` equate membership with co-presence.

**Review first:** independently adjudicate the purge-vs-non-emission confidence; verify the t1443,
t1457, and t1463 transcript chain; decide whether #137 should be one presence-invariant task or split
into (a) missing-transition compliance and (b) party-sheet/scene-manifest split awareness. Confirm
the negative Frizwick finding: the export records her inside with HP 52/52 and no split, so her
reported missing HP is not explained by campaign location state. No source or save repair shipped.

---

## Entry 12 — Project-wide drift-risk audit against Runelords t1549 (archived 2026-08-17)

**CLOSED — adjudicated outside the queue.** All four of this audit's new findings shipped as their
own reviewed rows on 2026-08-08: #144A NPC knowledge lifecycle (`7b701ac`, v1.564), #145 engine
notes no longer heat off-scene NPCs (`db3261b`, v1.565), #146 idempotent clock-repair transactions
(`9fca98c`, v1.566), #147 corrections survive their own retcon — the CORRECTION IN FORCE pin
(`8cb5138`, v1.567); rulings were recorded the same day (`9a7bd6d`), and the follow-on #144B typed
NPC facts (`394fcd2`, v1.572) plus the #148 recall-gate instrument run (`2555567`) validated the
remedy arc. The "Review first" forks resolved through the shipped shapes themselves: temporal
knowledge vs selector provenance split into two tasks (#144/#145), the clock discontinuity became
the #146 idempotency contract, and the canonical-correction RAG question became #147's pin.
Archived verbatim below by the 2026-08-17 Fable session; no further adjudication needed.

**Original entry as filed:**

**Filed:** 2026-08-08. **Artifact:** `DOC/Research/Drift_risks_SOL.html`. **Trackers:** TODO
#144–#147; existing TODO #136, #5, and #7 are cross-referenced rather than duplicated.
The owner requested a conservative whole-project search for places canon may drift, with the latest
Downloads save included and every surviving candidate challenged from three angles. The audit used
the real t1549 state, transcript, tag receipts, reconstructed prompt, exact headless probes, and
counter-evidence. It rejected identity fragmentation in this save, GM-output summary truncation,
map-description coverage, archive growth as canon drift, and the current split-HP display as new
defects.

The four new findings are: temporal scene claims stored as standing NPC knowledge (including a live
18-entry cap violation and oldest-first truncation); raw engine notes making off-scene split members
"hot" and injecting their stale details; a non-idempotent manual clock repair applied twice, leaving
future-born schedules; and `[RETCON:]` suppressing the corrected narration from RAG along with the
mistake. The report also independently reproduces TODO #136's parser/forget risks and records the
known audit-latch and sync-revision limitations. No source, save, or runtime state was repaired.

**Review first:** reconstruct the t1549 volatile prompt and confirm that Frizwick/Daeris are selected
only through the split-audit note; adjudicate whether temporal knowledge and selector provenance are
one task or two; verify the t1525→t1526 −2320 clock discontinuity cannot arise from a normal write
path; challenge the proposed canonical-correction RAG shape against the reason the `GM:` meta filter
exists. The ranked remedies are recommendations, not pre-approved designs.

---

## Entry 15 — Per-character location-visit provenance gap #173 (archived 2026-08-17)

**CLOSED — adjudicated outside the queue.** The Fable adjudication this entry gated on was
recorded 2026-08-14 (`6850d99` — "guestbook adjudication recorded, build authorized with seven
pinned amendments", answering the seven adjudication questions the entry posed), and the build
shipped the same day: the location guestbook (`747bdc8`, v1.632), the sabotage battery that also
exposed and repaired two vacuous assertions (`4ddca12`, v1.633), and the map-viewer guestbook
panel (`90c6c5d`). CLAUDE.md §9 carries the shipped contract, including the ratified rulings —
post-handler attendance commit seam, the `[LOCATION_RESIDENT:]` authoring tag, `GB_TURN_CAP`=8
with aggregate fold, explicit `locSplit` allocation via `take.guestbook`, the accepted `[NPC:]`
recorded-evidence boundary, residents-never-presence projection, and `node.npcs` demoted to
display-only. Archived verbatim below by the 2026-08-17 Fable session; no further adjudication
needed.

**Original entry as filed:**

**Filed:** 2026-08-12. **Tracker:** TODO #173. **Artifact:** the owner's live t1728 save,
`Rise_of_the_Runelords__Ammut__Ammut_t1728.tnd`. Investigation only; no game code changed.

Frizwick says at t1728, “Last time we saw it, it looked like a wound in the mountain,” while
looking toward Jorgenfist. Persisted history proves she was not an eyewitness: t1590 sends her to
warn Hemlock in Sandpoint; t1594 identifies Ammut, Morwen, and Daeris as the three continuing into
the mountains; t1661 has Frizwick greet the three survivors; and t1662 is when they tell her what
happened. The same save's injected Era 4 summary explicitly says Frizwick rode ahead while the
other three infiltrated Jorgenfist. This is therefore a provenance failure despite correct prose
memory, not missing or corrupted canon.

**Mechanism.** `memory.js:195-214` files location visits as global camera history only.
`memory.js:280-287` gives each map node an additive, timeless `npcs` name set and gives an NPC one
overwritten `lastSeenAt`; neither can express who attended a particular visit. The split handler
(`tag_table.js:824-857`) stores only current `splitLoc`, then deletes it on rejoin. The GEO prompt
(`api.js:3-70`) injects current geography/current splits/latest elsewhere locations, not historical
attendance or even `node.npcs`; the TOC (`memory.js:931-944`) exposes only global VISITED versus
KNOWN OF. After reunion, the correct era prose had to compete with current four-person scene
momentum, and the model generalized the subgroup's memory into “we.” This is the historical form
of #137's membership-is-not-presence invariant and applies to every split/rejoin.

**Proposed shape for review.** Add one uniform, bounded visit representation per location: exact
recent `{turn, actors}` attendance snapshots derived from effective physical location at filing
time, plus compact `{first,last,count}` per-actor aggregates when exact entries age out. Put only
the relevant current/prior visit evidence in the volatile GEO block. A failing-first replay must
split Frizwick to Sandpoint, file the earlier visit with three actors, rejoin her, and file the
return with four; "previous visit" must exclude Frizwick while "current visit" includes her.
Second-hand knowledge must not imply attendance. Exact entries need a hard cap (suggested starting
point: 8 per node) so the resource is not monotonically growing.

**What a reviewer should probe first.** (1) Define "visit" at split boundaries — camera arrival,
actor arrival, and sublocation transitions are not equivalent. (2) Confirm actor identity uses the
identity adapter and survives rename/merge/import without parallel name-key drift. (3) Decide the
minimum prompt projection that wins the authority fight without bloating the volatile tail.
(4) Keep #168's separate prerequisite visible: this save has Jorgenfist as KNOWN OF because its
57-turn infiltration carried no location tags, so no attendance ledger can repair visits that were
never filed. (5) Determine whether the existing timeless `node.npcs` set should be migrated,
redefined as “ever associated,” or retired rather than silently assigning it new semantics.

**Owner-ratified amendment (2026-08-12).** Use a per-node plain dictionary, not a flat pair list:
`guestbook[canonicalName] = {turns:[...], resident:boolean}`. Include the hero, living unsplit party
members, and NPCs evidenced present by a contemporaneous NPC-location write. Turns dedupe and are
bounded per character. `resident:true` is explicit and reversible: it means “routinely based here”
(an innkeeper/proprietor), never “physically present now.” Resident-only records do not fabricate a
visit turn. The owner rejected the `0` sentinel in favor of this uniform shape.

**Phase 1 triage.** Three independent review/check briefs: A — truthful attendance writers and the
resident authoring seam; B — persistence, identity, location repair, and size; C — prompt
projection, tests, and viewer visibility. All implementation is **harden if Fable confirms**. No
item was ignored or superseded. The requested Opus delegate type was unavailable in the Codex
orchestrator, so three available read-only agents executed the same evidence contracts; no agent
was authorized to edit.

**Phase 2 evidence — brief A, writers/presence.** `[LOCATION:]` → `fileLocation` and
`[SUBLOCATION:]` → `fileSubLocation` are camera-visit writers, but `[LOCATION:]` runs before
`[PARTY_SPLIT:]` in table order regardless of textual order. A truthful party snapshot therefore
needs a post-handler seam after same-response split/rejoin state settles. Campaign-start nodes can
stamp the starting party; blueprint-seeded nodes, location-state writes, identity repairs, and
loads are not visits. `[PARTY_SPLIT:]` can truthfully stamp only the named split member, and its
current sublocation path records `lastSeenAt` without creating the child node. `[NPC:]` calls
`mapNpcLocation` and can provide an ordinary NPC turn, but it is neither exhaustive nor
presence-validated: a present background NPC without `[NPC:]` is invisible, while a remote NPC
quoted in a letter is stamped here. No resident/proprietor/home-location tag exists; the proposed
HQ resident tag is TODO-only. Runtime replay reproduced the defect: Frizwick split to Sandpoint,
the main party visited Jorgenfist, she rejoined, and they returned — the node retained only global
turns `[11,14]`, with no evidence that Frizwick attended only t14.

**Phase 2 evidence — brief B, persistence/identity/bounds.** Whole-memory local save/load, campaign
switching, cloud sync/adopt, and `.tnd` export/import preserve an unknown nested node field; old
saves need defaults/validation/cap enforcement. Blueprint export intentionally strips per-run node
state. Real-helper fixtures prove current `locMerge` deletes the duplicate guestbook instead of
folding it, `locSplit` drops it from every successor, and live/dev NPC merges leave deleted-name
guestbook keys orphaned; reparent preserves it. Location alias and player swaps do not rename keys,
but every guestbook writer must canonicalize. On the t1728 save: 77 nodes, 184 total node visits,
45 unique names in existing node NPC sets. Compact synthetic storage with an 8-turn per-character
cap measured about 19.1 KB for party-only history or 25.0 KB using the intentionally generous
timeless-node-NPC proxy; no present-corpus size problem, but unbounded integers grow forever.

**Phase 2 evidence — brief C, prompt/tests/viewer.** The reconstructed t1728 prompt already carries
the correct Era 4 prose (“Frizwick rode ahead…”), but GEO/TOC/party/NPC graph contain no attendance
or residency field. GEO (`buildGeoBlock`) is the only always-present, current-location-centric,
volatile projection; the minimum useful line is historical and explicit about its limit, e.g.
`RECORDED VISITS HERE: Ammut/Morwen/Daeris — t1593…; Frizwick — t1725 only`, with residents under a
separate `USUAL BASE — not guaranteed present now` label. A name dictionary answers individual
history directly but derives attendees for a visit by scanning the node's character keys; tiny at
this scale. Existing split, cache, location-identity, import, and tag-table tests provide the
failure-first seams. Required cases include the exact split/rejoin replay, old-save default,
same-turn dedupe/cap, stable-half byte identity, volatile GEO change, location merge union, explicit
split allocation, NPC merge re-key, resident-only non-presence, and map-viewer rendering.
`map_viewer.html` currently drops guestbook from its projection; cleanup/viewer/blueprint surfaces
do not expose or author residents.

**Fable adjudication questions.** (1) Choose the post-handler attendance commit seam and whether a
split actor's own arrival writes a world and/or child visit. (2) Name and specify the explicit
resident set/clear tag. (3) Set the per-character turn cap and decide whether a lifetime count is
needed after eviction. (4) Define guestbook allocation in `locSplit` plans; silent primary-copy is
not evidence. (5) Decide whether remote-mention false stamps make `[NPC:]` too weak for automatic
NPC attendance or an acceptable recorded-evidence boundary. (6) Confirm prompt phrasing never
turns residency into current presence. (7) Decide whether blueprint-authored proprietors belong to
this task or remain runtime-only.

**Receipts.** Three parallel read-only briefs, roughly six minutes wall clock. Per-agent token/tool
telemetry is unavailable in this orchestrator; each brief supplied file:line evidence and focused
real-engine or real-helper outputs, labeled the incomplete NPC-roster question INCONCLUSIVE, and
reported no repository modifications. Strong cross-brief agreement: current data cannot answer
actor attendance; identity repair would lose/orphan the proposed dictionary; residency needs a new
explicit channel; GEO is the correct projection; present-NPC completeness is not currently
authoritative.

**Tier gate:** this Codex session stops here. Per the `/fable-review` skill and the repository's
drift-surface decree, only a Fable session may adjudicate these choices or modify
`memory.js`/`api.js`/`tag_table.js`. No implementation verdict has been issued and no game code has
changed.

---

## Entry 17 — #175b structured presence admitted as a positive death binding (reviewed 2026-08-17, fixes v1.650)

**Reviewed by Fable 2026-08-17 (same-day review of the v1.649 ship). VERDICT: the owner-ruled
DESIGN stands — structured presence for named deaths is the right call, and the t1903 repair it
enabled is exactly reproducible — but the IMPLEMENTATION violated the ruling's own
strictly-earlier contract on its strongest evidence limb, and the #175b executor fallback opened
a silent WRONG-VICTIM kill path. 7 confirmed defect groups fixed failing-test-first as v1.650
(13 new tests, each observed red on v1.649 with the evidence's predicted message; 5 new sabotage
clauses); 7 residues accepted with rationale; 1 design residue filed as TODO #193.** Evidence:
six parallel Opus briefs (A writers / B turn-strictness / C gate-executor / D fuzziness /
E residues / F verification-claims); verdicts and fixes by Fable. Suite 1470 green; t1667 replay
still quarantines; the t1903 repair dry-run reproduces the shipped result byte-for-byte under the
fixes.

**Confirmed defects fixed (v1.650, each red-first):**

1. **Executor unpinned from the envelope subject — the wrong-victim class (briefs D + C,
   severity 1).** `sceneRefDeath`'s #175b fallback called `_w2HandleNamesSubject(handle, null)`,
   so on the `_w2SubjectDeadInCanon` bypass (where the gate never runs) the handle's own fuzzy
   resolution chose the corpse: a "Caul" envelope with evidence handle "Vex" COMMITTED and stamped
   Caulder Vex dead — silent, no conflict, no toast (pre-#175b: nobody died). Two same-response
   shapes hit the hit-branch cousin: `[SCENE_REF:caul|Wex]` + envelope killed Wex with rewards;
   `[SCENE_NOT:caul|Caul|explicit]` + envelope committed rewards over no corpse ("anonymous actor
   died"). FIX: `_w2TxnSubjectNow` threaded per-body from `applyMuts`; the executor pins every
   stamp to the resolved subject — an already-dead subject's closing envelope treats its death op
   as ceremonial (never stamps anyone, payout preserved — the t1742 flow), and a bound-actor or
   fallback mismatch fails the handler, rolling the envelope back.
2. **The co-location evidence limb had no turn comparison at all (brief B).** `lastSeenAt` is a
   bare node key; the ruled contract ("each strictly earlier than the claim and than any
   sourceTurn") was unenforceable on the limb listed FIRST. Proven: a `mapNpcLocation` stamp at
   the current turn authorized its own turn's death; summary claims accepted evidence stamped ten
   turns after their cited sourceTurn; gate 1's `firstEncounter||lastSeenAt` disjunct plus gate 3(a)
   collapse onto fields written by ONE `[NPC:]` tag. FIX: `lastSeenTurn` stamped beside every
   `lastSeenAt` write (mapNpcLocation, split rejoin/destination, #133b fold, death retraction);
   the limb requires it strictly earlier than `lim`; unstamped legacy keys fall through to the
   guestbook/statusTurn limbs (fail-closed). This also closes the two-applyMuts-per-turn edge
   (brief A's P2) without touching gate 1.
3. **`mapNpcLocation`'s split-member exclusion guarded only the guestbook (brief A).** The same
   function's two halves disagreed about the same remoteness fact: a remote mention of a split
   party member — "remote by construction" per the #173 comment — still moved `lastSeenAt` to the
   camera node and thereby minted death-authorizing co-location evidence. FIX: the exclusion now
   covers both writes.
4. **The name-path frame scan ignored a summary's cited sourceTurn (brief B, pre-existing #168
   defect fixed in-area).** A scene binding recorded at t99 vouched for a summary death cited at
   t90. FIX: the scan derives the same `lim` as the evidence limbs.
5. **Heal asymmetry — a resolved dispute kept toasting forever (brief E).** The very path #175b
   newly authorizes (bare `[NPC:|dead]`) and combat-close propagation stamped `dead` without
   `_w2ResolveConflicts`, so a GM answering the nudge correctly WITHOUT an envelope kept the
   18-turn shelve loop alive indefinitely. FIX: both direct-write sites resolve the subject's
   standing conflict.
6. **The no-handle nudge was a conflict-record factory (brief E, the t1903 minting class
   reproduced: one refused death → 9 records → silent cap overflow in 24 turns).** The advice
   named a reveal of a handle that does not exist, and every handle the GM invented minted a fresh
   record via `sceneRefReveal`'s refusal. FIX: the no-handle branch teaches `[SCENE_REF:]`
   REGISTRATION (the ceremony brief E proved works — partially delivering TODO #190's ⓒ), and the
   reveal-names-no-handle refusal re-keys to `(subject,"-")` so retries re-arm the ONE standing
   record. Also: refusals under the scene-evidence overflow latch now name the latch — the stored
   reason previously claimed missing evidence while evidence was present (brief E row 6).
7. **Dead code made ws-only roster rows invisible to the handle path (brief C).** `_w2HandleNamesSubject`'s
   both-stores fallback was unreachable, so the same NPC's death authorized via bare name but
   quarantined via self-naming handle. FIX: the wsNpcByName clause is now reachable; both paths
   agree.

**Affirmed (evidence-backed):** gate ②'s explicit `[SCENE_NOT:]` refusal works at every probed
seam; the guestbook limb is strictly turn-compared including the agg fallback; `[LOCATION_RESIDENT:]`
mints no visit turn; a blueprint dossier row cannot authorize a death (the exclusion is one
`[NPC:]` tag deep — noted, accepted); preflight-before-handlers blocks single-response
self-authorization; the #168R6 same-turn handle refusals are intact; the t1667 replay still
quarantines with the exact three-way result; all 7 shipped #175b tests are discriminating (brief
F's four targeted mutations turned each red — though tests 4 and 7 guard pre-existing paths, so 5
of 7 exercise the new gates); sabotage-w2 44/44 and sabotage-identity 22/22 with byte-identical
restoration confirmed by an independent git authority; the t1903 repair tool is
double-application-safe (hard refusal re-run against the repaired save), rides the shipping
executors, and re-emits the committed `_REPAIRED.tnd` byte-identically.

**Accepted residues (rationale recorded, not fixed):**
- **Remote-mention presence feed (t+1).** One `[NPC:]` tag naming a never-on-screen character
  redundantly feeds all three evidence limbs, and the response's own prose asserting remoteness
  becomes the `firstEncounter` introduction evidence; the death authorizes NEXT turn. This is the
  owner-ruled trade (#173 q5 "accepted recorded-evidence boundary" + the entry-17 ruling admitting
  the roster-write limb); v1.650 closes the same-turn edges only. Surfaced to the owner in the
  review report — reopening it is an owner call, not a review defect.
- **Descriptor fuzziness in the handle operand** → TODO #193 (design-first). The envelope path is
  neutralized by the subject pin; the bare-tag upsert authority predates #175b.
- **Gate-stricter-than-executor on the name-null shape** (envelope subject "-" with a self-naming
  handle): the seams evaluate different names, but the only producing caller runs the gate first
  and fail-closes; unreachable end-to-end.
- **A re-emitted COMMITTED claim id re-kills a resurrected subject with no gate** — victim-correct
  after the pin, multiplicity-by-design; file a row if field evidence ever shows it.
- **The 18-turn shelve loop for legitimately fail-closed refusals** stands (the re-arm exists for
  genuinely new incidents; TODO #190 ⓓ holds the design question). The measured period is exactly
  `(IDENTITY_CONFLICT_STALE_ATTEMPTS+1) × 3` with the cooldown a hardcoded literal at api.js —
  left as-is to avoid churn.
- **Evidence-shaped advice on non-evidence refusal reasons** (a quest-name error gets scene
  advice): unhelpful, not harmful; candidate for a reason-tailored nudge if it recurs in the field.
- **Failing-first provenance is unverifiable from a single commit** (brief F): the primary v1.649
  test IS discriminating (proven by mutation), but commit structure cannot prove authoring order.
  Recorded as a process observation, not a defect. The v1.649 repair claim also understated scope:
  the #178 XP mirror moved three companion sheets +1200 alongside the player — engine-correct,
  claim incomplete.

**Receipts (phase 4).** Six briefs, all Opus, launched in one message; wall clock ≈ 13 min
(bounded by brief F), ~1.07M subagent tokens, 204 delegate tool calls:

| Brief | Tokens | Tools | Wall | Findings fed |
|---|---|---|---|---|
| A writers | 213,595 | 29 | 7.6m | fixes 2–3; remote-mention reachability; P1/P2 same-response mechanics |
| B turn-strictness | 163,454 | 33 | 6.7m | fixes 2, 4; the lastSeenAt/gate-1 no-comparison tables |
| C gate/executor | 181,294 | 37 | 9.3m | fix 1 (same-response shapes), fix 7; t1667 re-verify; residues 3–4 |
| D fuzziness | 183,078 | 32 | 7.9m | fix 1 (the Vex counterfactual); TODO #193; pre/post-#175b seam table |
| E residues | 175,107 | 33 | 7.4m | fixes 5–6; the 18-turn derivation; the 9-record factory measurement |
| F verification | 149,754 | 40 | 13.0m | claims audit; M1–M4 test-discrimination proof; repair reproducibility |

Delegate quality: excellent across all six — honest UNDETERMINED labeling, declared scope growth,
runtime probes over code-reading, zero verdict-issuing; briefs C and D converged independently on
the wrong-victim class from opposite ends, which is the redundancy the fan-out pays for. Brief F's
isolation discipline (scratch repo + git-init baseline as an independent restoration authority)
should be the template. One process note for the next run: brief A's early probe scripts were
overwritten by sibling agents in the shared scratchpad — briefs should be told to use per-brief
subdirectories.

**Original entry as filed:**

**Filed:** 2026-08-17. **Tracker:** none (owner declined a TODO row). **Evidence:**
`testRuns/Rise_of_the_Runelords__t1903.tnd` (the incident save) and its `_REPAIRED` sibling;
repro/repair tool `dev/repair-t1903-caul.js`.

**Why this is here.** It LOOSENS a canon gate on the drift surface — the highest-stakes shape of
change in the W2 layer. Owner ruled the design from the field evidence; this is the standing
non-Fable record.

**The field failure.** t1903, 4 unresolved identity conflicts all for "Caul", 2 quarantined
npc-death transactions (`caul-gutterlane-001` XP 1400 + 600g; `caul-death-001` XP 1200 + quest
completion). `worldState.sceneRefs` held ZERO actors and the tagLog showed **0 `[SCENE_REF:]` in
40 responses** against 4 `[SCENE_REVEAL:]` — the GM used the reveal half of the protocol without
ever registering a handle. Three of the four conflict records were minted BY the quarantine
nudge's own advice (`[SCENE_REVEAL:the wreck of Caul|Caul]`), one carrying an improvised
two-descriptions handle. Meanwhile `buildIdentityConflictNudge`'s #175 stale cap toasted its
shelving repeatedly: each record re-arms at identity.js `_w2Conflict` on the next refusal, so a
sustained refusal produces one shelve toast every ~18 turns per record, forever (measured).

**The change.** `w2NamedPresenceEvidence(name,sourceTurn)` (identity.js) admits STRUCTURED,
TURN-STAMPED evidence as a positive binding for the NAME path: gate 1 introduction (#143's axis),
gate 2 an unresolved explicit `[SCENE_NOT:]` naming the entity refuses outright, gate 3 one of —
recorded co-location (`lastSeenAt` = current node), a guestbook visit turn, or a roster write
(`statusTurn`) — each strictly earlier than the claim (and earlier than `sourceTurn` when the
summary path supplies one). `_w2HandleNamesSubject` extends the same ruling to a handle that IS
the victim's name (the shape the GM actually emitted), at BOTH the authorization gate and the
`sceneRefDeath` executor so the two cannot disagree. RAG was considered and rejected: read-side
only, non-deterministic across turns, and unable to distinguish presence from mention.

**Verification.** 1457 engine assertions green (7 new; the primary one written failing first and
confirmed failing). `dev/replay-w2-incident.js` on the real t1667 export still quarantines
(Mokmurian alive, objective open, XP delta 0). `replay-w6-summary.js` green. `sabotage-w2.js` and
`sabotage-identity.js` re-run after the handle extension. The repair rode the shipping executors
end to end on the real save: evidence "roster write at t1878", 4 conflicts → 0, quest archived
completed, XP +1200, gold unchanged.

**What a reviewer should probe first.** (1) The `statusTurn` limb is the weakest evidence — an
`[NPC:]` write can be a REMOTE mention, so a far-off introduced NPC can now be killed by a bare
named tag; the explicit-negative gate is the only thing standing in front of that. Is that the
right trade, or should the limb require co-location too? (2) `resolveNpcName`'s distinctive-token
consolidation makes "the wreck of Caul" self-naming — desirable here, but it is fuzzy matching
inside a canon gate. (3) The re-arm reset (`c.attempts=0` at identity.js `_w2Conflict`) is
UNCHANGED and still makes the #175 shelve non-terminal; it is mostly moot once deaths authorize,
but the loop is still reachable. (4) The nudge still instructs `[SCENE_REVEAL:]` when it holds no
handle — the conflict-minting behaviour above — also UNCHANGED.

---

## Entry 16 — Gemini pinned to thinkingLevel "low" on every call kind (archived 2026-08-29)

**Cleared via joint-review finding f81 (queue-triage, verified confirmed) during the #282
coverage mop-up — batch-cleared with two watches rather than a dedicated review pass.**

**Why it cleared without a dedicated pass (f81's mechanism, verified against the live repo):**
the change is one generationConfig line in `PROVIDERS.gemini.buildBody`, applied uniformly to
every call kind, and its pinned guard (`#22 gemini buildBody pins thinkingLevel 'low'`,
dev/engine-tests.js) is green in the current suite. Probe item 4's "cannot detect silent
reinterpretation" is partially mitigated by `parseUsage` folding `thoughtsTokenCount` into `out`
— a model that resumed thinking would show in the Usage meter's turn bucket. Probe item 2
(summarize under low reasoning) is backstopped deterministically by W6/W2 validation before any
memory write plus the #17 standing-anomalies surfacing of summary-failure strikes — SCOPED per
the verifier: that catches structural/identity contradictions and unparseable extractions, not
semantically thin-but-valid summaries; the silent-quality residue stays watched at TODO #276⑤
(f46). The #29b fallback rung (`gemini-3.6-flash`) receives the identical body (gemini embeds
the model in the URL, not the body), and its certification sweep
(audits/SWEEP_fallback_rung_v1660.html, 2026-08-18) postdates the v1.645 pin — "certified under
the shipped config" rests on the sound code-path inference that v1.660's buildBody could not
have sent anything else.

**Two recorded watches:**
1. Re-measure the thinking-on vs low cost A/B (currently n=5 vs n=2 — a 503 load-shedding storm
   ate samples) only when server-side subscription pricing makes the number load-bearing.
2. Any future gemini model-id change must re-verify "low" is accepted — "minimal" 400s on
   3.7-flash, and the pinned engine test cannot see an HTTP rejection.

**Original filing (verbatim, as removed from the queue 2026-08-29):**

### 16 — Gemini pinned to thinkingLevel "low" on every call kind (#22, v1.645; Opus, owner-ruled)

**Filed:** 2026-08-16. **Tracker:** TODO #22. **Commit:** the v1.645 promotion.
**Evidence:** corpus `dev/corpus_playtest_v1644_gemini37low.json` (50 turns, standard Korrag
campaign), save + memento in `testRuns/modelTests/` (gitignored).

**Why this is here, not in the Off-Fable log.** It is not a safe-changes-map shape. The change is
one line of `PROVIDERS.gemini.buildBody`, but what it alters is how much the GM model *reasons
before answering* — and canon obedience is precisely what the anti-drift stack protects. The
sweep already proved tag syntax and canon obedience are separable capabilities (3.5-flash held
the first and failed the second), so a knob on the reasoning budget is drift-adjacent by
construction. Per the decree, ambiguous defaults to Fable; the owner ruled the adoption, so it
shipped, and this is the standing non-Fable log entry.

**What was measured.** `thinkingLevel:"low"` accepted; `"minimal"` rejected by this model with
HTTP 400 ("Thinking level MINIMAL is not supported"), so low is the floor. 50/50 turns, run-scoped
in-page patch (no repo edit until this promotion). Both contract halves held: 0/50 zero-tag turns,
39 distinct tags (vs 36 thinking-on), 366 total (vs 274), 0 unknown (census derived from
tag_table.js); dead-actor scan clean across 4 deaths, and all 4 death tags landed the same turn as
the prose kill — the thinking-ON sibling is the arm with the premature-tag blemish (t42 tag / t46
prose), not this one. Premise retention >= baseline. Paired A/B on one identical 17,305-token live
gameplay prompt: thinking-ON median 275 thought + 178 visible (~453 billable) @ 4.9s (n=5);
LOW 0 thought + 296 visible (296 billable) @ 2.5s (n=2). Owner read the compiled memento and
judged it good — the prose half of the verdict, consistent with 727 chars/turn vs 647.

**What a reviewer should probe first.** (1) The A/B's thinking-on side is n=5 against n=2 — a 503
load-shedding storm ate samples; re-measure if the cost claim is load-bearing for pricing.
(2) The config now rides EVERY call kind including `summarize()` — the run filed 6 chapters across
5 summarize calls with clean JSON, but extraction quality under low reasoning deserves a harder
look than one campaign. (3) One campaign, one tone, one voice, one seed — the #22 field-validation
width caveat applies to this arm exactly as it does to the others. (4) The guard is a pinned engine
test (`#22 gemini buildBody pins thinkingLevel 'low'`), verified red before the change; it pins the
value but cannot detect the model silently reinterpreting "low".

---

## Entries 34–36 — the Sol tranche-2 evidence briefs, adjudicated (2026-08-30)

Three read-only evidence briefs filed 2026-08-29 from the joint review's completeness gaps
(g7/g1/g2, via TODO #277 item 7), all adjudicated on Fable 2026-08-30:

**36 (level-up path, gap g2) → TODO #284, shipped v1.752.** The confirmed persistence hole is
closed. The adjudication SPLIT the "reconstruct looks strictly better" leaning: bump/spell queues
are NOT deterministically reconstructible (no creation-stat baseline; pre-C2 saves never received
picks, so invented owed records could double-grant) and became durable save fields keyed by
character (worldState.levelUpOwed); the archetype IS deterministic and self-heals via
levelUpArchetypeDue + pickArchetype's existing catch-up grant. One re-surface seam
(resurfaceLevelUpOwed, creation-flow order) rides boot and the sendAction guard. The W2 envelope
rollback's module-var snapshot retired. Residual: the brief's 1→20 live sweep stays open as a
playtest item.

**35 (affordance gate, gap g1) → TODO #283, shipped v1.751.** Both findings confirmed and fixed:
the manifest's polarity-blind prose scan deleted in favor of structured presence (unsplit party +
#194-sourced lastSeenAt + the active frame's observed[] with a frame-node guard), and
SUGGESTION_ASK reconciles the call's user message to the mode block's #141 {present, actions}
object so the checking space survives the format fight.

**34 (STT auto-send, gap g7) → no engine change.** The direct presence/registration concern is
REFUTED by code trace: player text never runs applyMuts, corrected names cannot call
npcRegisterMention/npcRecordPresence, and RAG is read-side only — the honest statement is
"input-side retrieval/prompt steer, no canon write". The null-native-confidence + one-tame-
correction auto-send route is explicit #77 policy and stands until a field wrong-substitution
report (the corrected text is visible in the player's own message bubble; Car Mode owns the spoken
confirm loop for the suspicious class). The genuinely missing behavioral battery — driving
corrected final chunks through _applySendPolicy into sendAction for native and cloud, with the
brief's probe matrix — is filed as TODO #287 (test-only, safe-changes legal).

**Original filings (verbatim, as removed from the queue 2026-08-30):**

### 36 — Level-up path: strong spot coverage, but owed choices are page-lifetime only (read-only evidence brief; Fable gap g2)

**Filed:** 2026-08-29. **Source:** `Fable_Review_2025_08_27.html` completeness gap g2 / TODO
#277 item 7. **Touched:** this evidence entry only — `game.js`, `tag_table.js`, `class_bible.js`,
and the tests below were read, never edited.

**Verified mechanism.** `[XP:]` calls `checkLevelUp()` inside the tag-table handler and then mirrors
the same award to every living party companion; `[COMPANION_XP:]` is a second, additive writer that
calls `checkCompanionLevelUp()` on the named sheet. Both level functions loop one level at a time,
grant HP and the exact class/archetype bible rows crossed, and collect every crossed spell tier.
The player path queues archetype → every owed stat bump → every owed spell pick; companions take the
first unknown bible spells automatically. A single large award therefore has the right implementation
shape for 1→N progression, rather than granting only the destination row.

**Coverage already present — the original gap is review coverage, not zero tests.** The current
engine suite pins the 1→5 single-award HP/feature loop, 4→6 class+archetype rows, 10→11 access above
the old cap, companion row parity, the 1..20 XP curve, full/half/third-caster tier schedules,
multi-unlock collection, player owed-pick counts, loud blank-bench skipping, companion auto-pick
dedupe/mana growth, shared-XP mirroring, same-response mirror+bonus addition, and an object-replacement
adversary proving each award lands once. The v1.709 toast tests also name every granted feature.
What is absent is the requested end-to-end 1→20 sweep and any behavioral execution of
`showSpellUnlockModal` / `spuConfirm`; headless setup stubs the archetype modal and only inspects the
spell queue.

**Confirmed persistence hole for Fable to adjudicate.** `_levelBumpsOwed` and
`_spellUnlocksOwed` are module variables, not save fields. `checkLevelUp()` commits `character.level`
before presenting the forced choices; `sendAction()` re-surfaces queues only while that page is still
alive. Reload after the level/state save but before completing a modal clears both queues, and the
same XP cannot reconstruct them because `newLvl <= c.level` returns immediately. The archetype choice
has the same one-shot shape: only crossing old&lt;3→new≥3 calls `showArchetypeModal`, and no boot or
send guard reopens it for a level≥3 character whose archetype is still null. Thus “owed choices
resurface before the next turn” is true in-page but not across reload/device handoff; earned stat,
archetype, and spell choices can be stranded after the level itself is durable.

**Probe first.** In a disposable saved world, drive player and companion 1→20 through the real XP
tags and compare every granted row/unlock to the bible. Separately reload at each forced modal
(archetype, stat bump, spell pick), then attempt the next turn: the review should decide whether owed
choices become durable records or are deterministically reconstructed from level, abilities, stats,
and known spells. Include one large `[XP:]` crossing multiple stat and spell milestones plus a
same-response `[COMPANION_XP:]` bonus.

### 35 — Affordance gate: rejection rules are tested; two scene-check seams remain suspect (read-only evidence brief; Fable gap g1)

**Filed:** 2026-08-29. **Source:** `Fable_Review_2025_08_27.html` completeness gap g1 / TODO
#277 item 7. **Touched:** this evidence entry only — `game.js`, `memory.js`, and the tests below were
read, never edited.

**Verified mechanism.** `generateActions()` parses the model payload, then every rendered candidate
runs through `applySuggestionGate()`. `buildSceneManifest()` derives living local targets, immediate
exits, and the active sheet's capabilities; `validateSuggestion()` rejects a local capability aimed
off-scene, an unowned spell, direct interaction with a dead NPC, direct address of an absent NPC,
leading remote travel while sublocated, and a roster name never introduced to the story. Every
rejection is loud and receives a manifest-built fallback which is itself revalidated; an axiomatic
generic action is the terminal floor.

**Coverage already present — substantially stronger than g1 implied.** The engine suite exercises
each requested failure input, including the exact cross-town Message and sealed-stairwell field
cases, dead-vs-mention precision, unowned Fireball, split-party absence under #137, the #143
zero-introduction dossier, fallback revalidation/termination, combat exit suppression, remote-range
exemption, and location-alias resolution after #156. The #141 object parser accepts fenced/wrapped
`{present,actions}`, rejects an object without actions, logs the present line, and preserves legacy
array tolerance. The residual risk is therefore in what authorizes `man.npcs`, not an untested list
of rejection arms.

**Finding 1 — a mention still authorizes presence at this seam.** `buildSceneManifest()` scans the
latest GM transcript entry and adds any living roster name it contains, without judging assertion
polarity or using #194's sourced presence facts. “Ameiko remains in Sandpoint, miles away” therefore
puts Ameiko in `man.npcs` and disables both the local-cap-remote-target and absent-direct-address
rules for that button set. That is the exact mention→presence inference #194 made impossible in the
canonical presence writers, reintroduced locally in the UI authorization manifest. Existing tests
cover a genuinely present name in narration, but no negative/remote mention.

**Finding 2 — the forced scene-check instruction contradicts the call's user message.** The
volatile `SUGGESTION_MODE_BLOCK` demands the #141 object, but `generateActions()` simultaneously asks
for “ONLY a JSON array of 3 strings.” The tolerant parser means an obedient array succeeds and the
deterministic gate still runs, but the `present` checking space and its telemetry disappear. Current
tests exercise the parser and system block separately; none pins the assembled call against this
object-vs-array conflict.

**Probe first.** Reproduce the negative-mention sentence above and assert the remote NPC remains
unauthorized; then capture the actual suggestion request/response shape to see which conflicting
format instruction wins. Keep the existing adversarial rejection matrix, but add explicit
#194-sourced presence positives (`SAY`/combat/arrival/cast as ruled) and negative prose mentions.
Fable should decide whether the manifest consumes the structured presence frame rather than doing
another prose scan; any remedy is in the protected runtime surface and is intentionally not attempted
here.

### 34 — STT auto-send: canonical-input steering is real; direct presence mutation is not (read-only evidence brief; Fable gap g7)

**Filed:** 2026-08-29. **Source:** `Fable_Review_2025_08_27.html` completeness gap g7 / TODO
#277 item 7. **Touched:** this evidence entry only — `stt.js`, `helpers.js`, `game.js`, `memory.js`,
and the tests below were read, never edited.

**Verified mechanism.** Native final chunks and cloud transcripts both run through
`sttCorrectNames()` before the corrected text reaches `#action-input`; `_applySendPolicy()` then uses
that corrected value. With desktop auto-send or Car Mode enabled, a non-suspicious utterance calls
`sendAction` without another human glance. The committed player string becomes the turn's player
transcript entry and `lastAction`; RAG gives NPCs named in that input weight 3, above ordinary
scene-presence weight 2, and also scores the input's lexical terms. A false roster correction is
therefore a durable input-side retrieval/prompt steer even though it is not GM-authored canon.

**The original presence/registration concern is narrowed, not confirmed.** Player text never runs
through `applyMuts`; `[NPC:]` registration and #194 presence derive from the GM response's sanctioned
writers. A corrected name in player input cannot directly call `npcRegisterMention` or
`npcRecordPresence`, and RAG is read-side only. It can still influence the next GM response and the
player-input watchers (`detectPlayerStayBehind`, consumable checks), so the safe statement is “no
direct presence/registration write,” not “no downstream state effect.”

**Existing guards and the live hole.** Pure tests cover the known mangle pairs, a common-word safety
set, ambiguity, punctuation, correction collection, low confidence, far corrections, the
`there is`→Daeris bigram, multiple corrections, unknown capitalized names, confirm vocabulary, and
the log ring. The source contract pins pending-confirm ordering above Car commands, cloud logprobs,
and confirmed use of stored pending text. But the suite never behaviorally drives a corrected final
chunk through `_applySendPolicy` into `sendAction`. By explicit policy, null native confidence never
flags and one “tame” correction stays silent; that combination is an allowed auto-send route for a
plausible but wrong roster substitution. Desktop auto-send parks suspicious text visually, whereas
Car Mode owns the spoken yes/no loop; both share the same suspicion thresholds.

**Probe first.** Load `stt.js` with a fake recognizer/input/send boundary and prove the full route for
native and cloud: corrected text, suspicion verdict, confirmation ordering, and the exact string
handed to `sendAction`. Include campaign-specific near-homophones (the g7 “a mica”→Ameiko shape),
null confidence + one low-score correction, a correction naming a split/remote party member, and a
spoken “no” while Car Mode is busy. Assert no direct registration/presence write, then assert the
expected RAG query entity and any player-input watcher that arms.

## Queue drain 2026-09-03 (Fable) — entries 14, 18–33, verbatim as filed, verdict appended

### 33 — Clock corruption rescue (#274, v1.734; Opus lane D, brief-mandated design)

**Filed:** 2026-08-28. **Tracker:** TODO #274 (Fable f63, verified). **Touched:** `clock.js` (new
`clockRescueCorrupt` + the `clockEnsure` guard), `state.js` (the `CLOCK_RESCUE_K` constant and the
`migrateWorldState` clock guard), `dev/engine-tests.js`, `dev/sabotage-274-clock-rescue.js` (new).

**Mechanism.** Both wipe sites — `clockEnsure` and `migrateWorldState` — ran the same test,
`!clock || typeof clock.min!=="number" || isNaN(clock.min)`, and on a hit replaced the WHOLE clock
object with `{min:0,schedule:[]}`. Silently. That discarded the timeline position, every scheduled
deadline, and `clock.repairs`. The receipts are the sharper loss: they ARE #146's double-fire
protection, so after a reset a repeated repair id re-applies on any device — the exact class #146
was built to stop. Per the verifier: `c.min+='19h'` concatenates to the STRING `"882019h"` (the
typeof limb) and a mangled blob carries a numeric NaN (the isNaN limb); both wiped identically.
The trigger stays speculative (JSON round-trips preserve numbers), so the realistic vectors are a
bad console `clockRepair` delta or a hand-mangled blob — but the blast radius is total.

**What shipped.** The JP0-4 rescue shape (`state.js rescueCorruptStore`), applied to the clock:
① preserve the unreadable clock verbatim under `CLOCK_RESCUE_K + campId` — ONE slot per campaign,
newest overwrites (a clock is replaced wholesale, so the newest corrupt object is the most complete
picture; the deliberate opposite of UA3's prepend-survivors rule). ② shout on BOTH channels naming
the poisoned value and its type. ③ only THEN rebuild — CARRYING `schedule[]` and `repairs[]`
whenever they are still arrays, because only the scalar was poisoned and losing every deadline
because `min` became a string is the defect, not the fix. Junk halves rebuild empty and both
messages say WHICH was lost rather than the reassuring default. Nothing heals the scalar (#146's
rule holds: the anchors are adjudication evidence, `clockRepair` is the one sanctioned correction),
and nothing in the app deletes a rescue key.

**Two design points worth a reviewer's eye.** ① **ABSENT is now distinct from CORRUPT.** A save
with no `clock` at all still mints one silently — that is an ordinary legacy load, and routing it
through the rescue would alarm the player and write a junk backup on every pre-#73 save's first
open. Fable f63's own remedy asked for exactly this split. ② **Non-finite scalars are snapshotted
as text** (`__nonfinite:NaN`) via a `JSON.stringify` replacer, because plain JSON turns NaN into
`null` — and NaN is one of the two poisons the rescue exists for, so a lossy snapshot would hide
what the scalar actually was. Both are sabotage-pinned.

**Not shipped, deliberately (brief scope).** Fable f63's second remedy — coerce/validate `delta`
in `clockRepair` (`Number()` + `isFinite`, refuse otherwise) — closes the *entry* vector rather
than the *loss*, and the brief scoped this row to the rescue. It remains open and is cheap; it
belongs beside #146's other refusals.

**Verification.** 7 engine assertions. 5 RED first on v1.731 (string min: nothing preserved;
NaN min: no rescue written; junk halves: the player told deadlines survived when they did not; the
migrate site: wiped without preserving; one-slot-newest-wins: nothing preserved). The other 2 —
healthy clock untouched, absent clock mints silently — were green before and after BY DESIGN: they
pin that the happy paths did not move, and each is proven by its own sabotage clause instead.
`dev/sabotage-274-clock-rescue.js` (new, auto-discovered by the applicability gate): 10 clauses —
preserve dropped, schedule carry dropped, repair-receipt carry dropped, player channel silenced,
developer channel silenced, the loss stops being named, the non-finite snapshot reverts to lossy
JSON, ABSENT collapses into CORRUPT, the corruption test dropped so every load rescues, and the
migrate site reverting to the wholesale wipe — all `caught`, both files restored byte-identical.
Applicability 578/578 across 44 batteries. `dev/sabotage-jp0-4-store-rescue.js` (12/12) and
`dev/sabotage-phase.js` (20/20) re-run clean, since both touch the files I edited. Full suite 1769
assertions green.

**CLAUDE.md follow-up for the merge (covers #273 too).** I did not edit CLAUDE.md — it was not in
either brief's file list, and its contract sections for drift-surface systems are Fable's. Three
lines want adding at merge: the `clock.js` row should note the #274 rescue beside #146; §3's
storage-key paragraph should list `CLOCK_RESCUE_K` beside `STORE_RESCUE_K`; and §7's reward-claim
material should note that #215's measured award is per-token as of #273.

**FABLE VERDICT (2026-09-03):** ADJUDICATED 2026-09-03: rescue design AFFIRMED (absent≠corrupt, non-finite snapshot). f63's second remedy SHIPPED v1.808 — clockRepair refuses a non-finite/non-integer delta. Contract lines added (clock.md, sync.md).

---

### 32 — Measured-award guard counts, not lengths (#273, v1.734; Opus lane D, brief-mandated design)

**Filed:** 2026-08-28. **Tracker:** TODO #273 (Fable f29, verified). **Touched:** `helpers.js`
(`rewardClaimAccept` + a new `_rewardTargetRead`), `api.js` (`inventoryCountOf`,
`rewardAwardTargets`, beside the inventory helpers), `dev/engine-tests.js`, `dev/sabotage-w2.js`.

**Mechanism.** `rewardClaimAccept` measured a payout as `{xp, gold, inventory.LENGTH}` before vs
after. `addInventoryItem` STACKS in place — a claimed item the player already carries is rewritten
to `"Name x2"` and never pushed — so an item-only claim that PAID CORRECTLY read as "nothing
moved": console said AWARDED NOTHING, the modal toasted "that reward could not be awarded", and
the record had already been spliced out by `_rewardClaimTake`, so the claim closed anyway and the
player was invited to re-grant through Sync (a double pay). The verifier's added nuance is the
same defect's other face: a sheet-shape compare can only ever attest that SOMETHING moved, so a
MIXED claim (XP + item) passed on the xp delta alone while its item silently failed.

**What shipped.** Measurement is PER TOKEN. `rewardAwardTargets(tokens)` (api.js — it lives there
because the stacking identity `_invNorm` and the `xN` suffix `_invCount`/`_qtyParse` are api.js's
rules) maps each token to the one target it must move and by how much: `[XP:]` → `character.xp`,
`[GOLD:]` → gold, `[ITEM_GAINED:name]` → `inventoryCountOf(inventory, name)`, the count-aware read
that sums the suffix. Tokens sharing a target form ONE group with a summed expectation, so two
`[ITEM_GAINED:Rope]` must move the count by 2. A group lands only on an EXACT match
(`after − before === expect`); anything else — including a short quantity landing — is a
shortfall. Only an all-groups-land claim reports awarded. A partial names the failing tokens on
BOTH channels (console lists the raw tokens and what did land; the toast says "Only part of that
reward landed. Missing: <player-language phrase>" via `w2WithheldSummary`) and returns false. The
claim still CLOSES on failure — the shipped `_rewardClaimTake`-first semantics are deliberately
unchanged here (re-queue is a separate design question, recorded as #276 ③ residue).

**Deliberate strictness worth a reviewer's eye.** A token this table cannot measure is reported
UNVERIFIED, never assumed landed. That keeps the existing `[NOT_A_REWARD:x]` assertion honest and
means a NEW reward tag added to `W2_REWARD_RES` (identity.js) without a measurement arm here will
be loudly reported as unawarded rather than silently riding another token's delta. The coupling is
stated in the api.js header comment. Second point: exact-match would flag a `[GOLD:-N]` clamped at
zero as a shortfall — correct-by-design (that IS a shortfall the player should hear about), and
unreachable from the rewards ledger, which only ever carries positive grants.

**Verification.** 4 engine assertions, all RED first on v1.730 (stacking claim reported "nothing
changed"; quantity grant onto an existing stack likewise; short-quantity landing reported as full;
mixed claim reported a full award on the xp delta). The two existing #215 regressions — all tokens
land, genuine nothing-moved — stayed green throughout. `dev/sabotage-w2.js` +5 clauses (length
revert; `inventoryCountOf` stops summing the suffix; partial reported as full; the toast stops
naming the missing tokens; exactness loosened to merely-moved), all `caught`, battery 33/33, files
restored byte-identical. The pre-existing `#215 payout-moves-nothing` clause was RE-PINNED (its
find target was the deleted sheet-shape compare) — same label, same `mustFail`, same intent, and
the applicability gate is 568/568 green. Full suite 1762 assertions green.

**Probe first.** Whether the UNVERIFIED-by-default rule is the right call for a future reward tag,
and whether the closed-on-partial semantics should become a re-queue now that a partial is
distinguishable from a total failure (Fable f29's remedy suggested re-queue; the brief pinned
close-on-fail, so this is deliberately unresolved rather than overlooked).

**FABLE VERDICT (2026-09-03):** ADJUDICATED 2026-09-03: UNVERIFIED-by-default AFFIRMED (a new reward tag must earn a measurement arm); close-on-partial stands, re-queue stays the #276 ③ residue. Contract line added (quests.md).

---

### 31 — Retained proofs for the unproven contract tier (#275 / Fable f74; Opus lane E, dev-only, merged as entry 31)

**Filed:** 2026-08-28. **Tracker:** TODO #275. **Touched:** `dev/sabotage-contract-tier.js` (new,
the only file changed — no game source, no version bump; the harness restored every mutated file
byte-identical and `git status` was clean after each run).

**What shipped.** A fresh census of all 34 source contracts in `dev/run-tests.js` against every
retained `dev/sabotage-*.js` clause (43 batteries / 563 clauses, cross-referenced by matching each
clause's `mustFail` back to the run-tests.js line that emits it), committed as the new battery's
header comment so the next audit does not redo it. Result: **13 proven, 21 unproven.** The battery
then closes **20 of the 21 with 79 clauses**, every one caught and attributed by `mustFail` to its
own contract's failure text: the 13 previously unproven `_ttReq` clauses of #76 TABLE TALK
ISOLATION first, then the prompt/parser-adjacent tier (#172 narration person, #177 transcript seam,
#151 latch registry, #158 phase wiring, INJECTION SINK incl. the escHtml behavioural half, ENGINE
MANIFEST, #14 pending action, #113 STT, #77 confirm gate, VOICE LAB, BIBLE-SERVER WRITE-AUTH), and
the pre-rule TTS tier last (VENDOR PATCH preamble, VOICE-DELETION v1.419, AUDIO RECOVERY v1.421,
RESPAWN v1.424, PLAYBACK RECYCLE v1.430, UNLOAD STAMP v1.432, GOVERNOR v1.434, STARS PORTABILITY +
DEFAULT BENCH). The battery is picked up by `dev/check-sabotage-applicability.js` automatically
(it globs `dev/sabotage-*.js`): the scan now reports **644/644 clauses applicable across 44
batteries**, up from 563/43, with no wiring edit needed.

**f74's census is superseded in two places** (both favourable, both re-verified here): #92 SYNC
COMPRESSION and #144A ARCHIVE CARRY have been proven since f74 was written (`sabotage-252-*`), and
the TABLE TALK contract carries 15 `_ttReq` clauses with 2 proven, exactly as f74's own verifier
corrected.

**⚠ THE FINDING — one contract is INERT and I did not repair it.** The **REFUSAL COPY CONTRACT
(#213, run-tests.js:103-139)** reports through `process.exitCode = 1` — its four sites are the
only `process.exitCode` uses in the file — and `run-tests.js:1852` ends with an unconditional
`process.exit(0)`, which discards `process.exitCode`. Measured, not inferred: renaming
`W2_REFUSAL_REASONS` in `identity.js` makes the contract print
`REFUSAL COPY CONTRACT: W2_REFUSAL_REASONS is gone from identity.js …` and `node dev/run-tests.js`
still **exits 0**. So a drift-surface guard — the shipped-refusal vocabulary in `identity.js` must
keep player copy in the registry, or the W2 withhold toast silently degrades to the generic
fallback — cannot fail CI or the pre-commit hook, and has not been able to since #213 shipped at
v1.698. Per the #275 brief a vacuous/inert contract is *recorded for Fable, never repaired in
place*, so the two identity.js clauses sit `skip:true` in the battery with the reason in a comment;
the applicability scan still keeps their find targets fresh, and un-skipping is one line the moment
the four `process.exitCode = 1` become `process.exit(1)`.

**What the reviewer should decide / probe:**

1. **The #213 repair.** Four `process.exitCode = 1` → `process.exit(1)`, then drop `skip:true`.
   It is one character each and it makes a currently-green build red if the registry ever drifts —
   which is a real, if welcome, gate change on a drift-surface contract. Fable's call.
2. **The gate is filtered: `node dev/run-tests.js repairModelJson`.** Source contracts run at the
   top of run-tests.js unconditionally, before and independent of the section filter, so a filtered
   run exercises all 34 of them in 198ms instead of 11s — and it removes the engine suite as a
   rival source of red, which is what makes each `mustFail` an honest attribution. run-tests.js
   sanctions the shape at :1836 and `sabotage-253-growth-telemetry.js` already uses it. If the
   `repairModelJson` section is ever renamed every clause reddens loudly (`FILTER … matched 0
   sections`) rather than passing silently. **Confirm the filtered gate is acceptable for a
   contract-tier battery**, or say the word and I will re-point `GATE` at the full suite (the
   verdicts are identical; it costs ~15 min of CI-free local wall clock).
3. **Residue, deliberately not done in this lane:** `dev/sabotage-blueprint-classes.js` carries 9
   clauses with **no `mustFail` on any of them** — an exit-status-only verdict cannot tell a real
   catch from an unrelated red (the #170 lesson), so BLUEPRINT DESIGNER is "proven" more weakly
   than the census line suggests. Adding pins there is an edit to an existing battery, so it is
   filed here rather than done silently.
4. **Not proven, by design:** TRANSCRIPT SEAM clause ① is an inline self-sabotage fixture
   (run-tests.js:153) that proves its own non-vacuity every build — the pattern f74 asks the other
   absence-pattern clauses to adopt. Mutating it would mean mutating the harness, not a guarded
   source file.
5. **The three clauses that needed a second draft are the finding in miniature** and are annotated
   inline: a rename whose replacement still CONTAINS the scanned literal
   (`tndRecycleSessionGONE`, `_stuckCtxRETIRED`) leaves an `indexOf` guard completely undisturbed,
   and one `_voiceAssignedTo` call site turned out to sit outside the censused function slice.
   Each reported MISSED/MISATTRIBUTED first — which is the harness doing exactly its job.

**FABLE VERDICT (2026-09-03):** ADJUDICATED 2026-09-03: the inert #213 contract was repaired by the #264-class fix (run-tests exits process.exitCode); filtered gate AFFIRMED as the contract-tier shape; residue 3 SHIPPED v1.808 — 8 of 9 blueprint-classes clauses pinned with mustFail (the identity-chain clause keeps its exit-status verdict).

---

### 30 — f31 widening exposes an existing nested quest latch outside the dev-only brief

**Filed:** 2026-08-28. **Source:** joint-review tranche item 3 / Fable f31. **Status:** stopped
before implementation under the brief's `api.js`/`clock.js` ask-first boundary.

**Question.** Should `buildQuestStaleNudge`'s `questLog[].staleNudged` stamp join the #151
failure rollback, and if so should it receive a purpose-built per-quest snapshot (the narrow
shape) or should `questLog` become a top-level `NOTE_LATCH_FIELDS` entry (the broad shape)?

**Why the dev-only census cannot honestly ship first.** A failing-first transitive prototype
walks every function reachable from `NOTE_BUILDERS`, including cross-file helpers and local
aliases. It correctly catches Fable f31's `buildIdentityConflictNudge` → `rewardClaimQueue` →
`worldState.pendingRewardClaims` route and the alias fixture the old regex missed. Against the
shipped tree it also finds:

1. `buildQuestStaleNudge` aliases a row from `worldState.questLog`, then writes
   `pick.staleNudged=worldState.turn` (`api.js`, current `buildQuestStaleNudge`). The snapshot is
   taken before `buildEngineNotes`, but `snapshotNoteLatches` restores only top-level
   `NOTE_LATCH_FIELDS` plus companion `splitLoc.audited`; `questLog` is absent. A provider error
   therefore consumes the quest-review note for `QUEST_STALE_TURNS` without a committed turn.
2. `buildScheduleEscalation` reaches `scheduleDue` → `clockEnsure`, whose only write here is lazy
   missing/malformed-clock repair. That looks like a defensible explicit census exemption:
   restoring corruption after a failed request would undo an invariant repair, not un-burn a
   delivered note.
3. `pendingRewardClaims` also looks defensibly exempt for the reason f31 already adjudicated:
   the player-visible shelve decision precedes the request, and subject+tokens dedupe prevents a
   duplicate claim. The exemption should carry that rationale as checked text.

**Why I stopped.** Declaring `questLog` exempt would make the widened guard green by blessing the
very transport-loss class #151 promises to prevent. Restoring it requires runtime work in
`api.js`, which item 3 explicitly did not authorize and the tranche says to stop and file here
if discovered. No runtime or contract change has been committed for item 3.

**Reviewer decision requested.** Prefer the narrow per-quest snapshot unless review establishes
that another compose-time quest-row mutation must roll back atomically. Then authorize item 3 to
land the runtime restoration and widened dev census together; or explicitly rule the stamp's
non-restoration intentional and supply the rationale the exemption contract should pin.

**FABLE RULING (2026-08-29 — adjudicated, runtime half SHIPPED v1.747).** ① The narrow
per-quest snapshot, title-keyed — `questLog` wholesale in the flat registry would silently
revert any future mid-flight quest write and deep-copy the whole log per turn for three stamps.
Landed in api.js (`snapshotNoteLatches`/`restoreNoteLatches` carry `snap.quests` beside
`snap.split`; the nested-latch comment now names BOTH), 2 red-first engine tests (the #277-3
section), 2 clauses added to the #151 LATCH REGISTRY CONTRACT, 2 proven sabotage clauses
(sabotage-229, with the battery's own working copy riding `also:` per #194L6). ② `clockEnsure`
lazy repair: EXEMPT as invariant-repair — restoring corruption after a failed request would undo
a repair, not un-burn a note; the census exemption should carry exactly that text. ③
`pendingRewardClaims`: EXEMPT per the f31 adjudication (the player-visible shelve decision
precedes the request; subject+tokens dedupe prevents a duplicate claim); carry that rationale as
checked text. **Item 3 is AUTHORIZED** to land the widened dev census on top of the shipped
runtime restoration, encoding exemptions ② and ③ with their rationales.

**FABLE VERDICT (2026-09-03):** CLOSED 2026-09-03: ruled 2026-08-29; runtime half shipped v1.747; item 3 landed (latch-census.js carries the clock invariant-repair and pendingRewardClaims exemptions with their rationales).

---

### 29 — The victory close's positional exemption (#258, v1.724; Opus lane A, brief-mandated design)

**Filed:** 2026-08-28. **Tracker:** TODO #254 (JP0-6 / Fable f26). **Touched:** `tag_table.js`
(the `COMBAT_END` handler only), `dev/engine-tests.js`, `dev/sabotage-w2.js`.

**What shipped.** `COMBAT_END` now computes the closing tag's string index and splits the living
foes in two: those whose `[COMBAT_START:]` sits at a GREATER index arrived after the fight closed
and are not part of it. They are exempt from #214①'s victory resolution, and they carry the
tracker forward as a new encounter (round 1, engaged null, anchored at the current node) instead
of dying with the old fight. The closed fight's own corpses stay with it. The #149 aftermath
anchor still points at the OLD encounter's node — deliberate, that is where the damage happened.

**Verification.** 4 engine assertions, 3 RED first (post-close survivor + carry-over; interleaved
multi-foe; a rostered newcomer never reaching the death gate on a save with an unactivated
`sceneRefs`, which is the strongest shape because there the gate authorizes unconditionally). The
fourth — start-then-close — was green before and after by design: it pins that the legitimate
start-slay-close emission (test 15587's shape) is untouched. Every existing #214 assertion green.
`dev/sabotage-w2.js` +3 clauses in its existing tag_table/COMBAT_END block, all proven, battery
clean.

**What the reviewer should probe:**

1. **I extended the carry-over to NON-victory closes.** The brief mandated the exemption for
   victory resolution; the split itself is outcome-independent (a foe introduced after the close
   is not in the closing encounter regardless of the outcome word), and Fable f26's remedy is
   written about *discarding* ("instead of discarding them with the close, rebuild
   worldState.combat around the surviving fresh foes"). So `[COMBAT_END:fled][COMBAT_START:X]`
   now keeps X in an open encounter where it previously discarded it to the #225 orphan channel.
   That is a real behavior change beyond the literal victory case — **confirm or restrict.**
2. **Known narrow gap, deliberately left.** A duplicate `[COMBAT_START:]` after the close naming
   an ALREADY-living foe exempts that (old) foe, because the split keys on the tag's position and
   the foe's name, not on which foe object this response actually created. I chose the smaller
   diff over threading a per-response newborn map through the COMBAT_START handler; the emission
   is doubly anomalous (the dup guard already warns) and the outcome is the conservative one — no
   invented death. If you want exactness, the fix is a `R.freshFoeIdx` map written at append time.
3. **The f26 honest limit stands.** A newcomer whose `COMBAT_START` textually PRECEDES the close
   is still unprotected — that order is genuinely ambiguous with the legitimate start-slay-close
   shape, so an index check alone cannot separate them. Documented in code and in the test header.
4. **The #225 ghost line is now slightly odder.** With no prior combat, `[COMBAT_END:victory]
   [COMBAT_START:X]` reaches this handler with a tracker that exists (COMBAT_START made it), so
   the `ce&&!worldState.combat` #225 early return does not fire and a `Combat: victory` muts line
   is pushed while a fight is open. Pre-existing (it fired before too, and additionally destroyed
   X); worth deciding whether #225's absorb should also cover "the tracker was null before this
   response".

**FABLE VERDICT (2026-09-03):** ADJUDICATED 2026-09-03: outcome-independent carry-over AFFIRMED; the dup-COMBAT_START gap and the precedes-the-close limit ACCEPTED as documented; probe 4 SHIPPED v1.808 — a close over a fight this response opened is absorbed (no outcome line, no milestone, no aftermath arm), the fresh encounter carries.

---

### 28 — SPELL_DEF may not shadow curated spell canon (#257, v1.724; Opus lane A, owner-ruled)

**Filed:** 2026-08-28. **Tracker:** TODO #253 (JP0-8 / Fable f51). **Touched:**
`capability_bible.js` (`capIsBaseCatalog` — new predicate beside `capabilityLookup`),
`tag_table.js` (the SPELL_DEF handler's new on-catalog refusal), `game.js` (cross-reference
comment at `canonizeCompanionSpellDefs`), `dev/engine-tests.js`,
`dev/sabotage-drift-hardening.js`.

**What shipped.** The handler's write-once check consulted only `worldState.capabilityBible`, so
a `[SPELL_DEF:]` naming a curated base entry filed a permanent shadow that `capabilityLookup`
then preferred everywhere — including `manaSpellCost`/`manaMax`, so a tier=1 redefinition of a
tier-3 spell silently repriced the whole pool. Now an on-catalog name is REFUSED: loud console
warn, a `⚠ Spell canon NOT redefined:` muts line, zero writes. Off-catalog spells keep the
overlay-wins write-once flow byte-for-byte. Per the owner ruling, overlay entries that already
shadow a base entry are left as-is — no migration, historical canon stands (pinned by a test).

**Verification.** 3 engine assertions; the refusal one was RED first, and the other two are
deliberate green regression pins (the emergent path and the no-migration path must NOT change —
a red there would mean I broke something, not that a defect existed). 4 new sabotage clauses in
`dev/sabotage-drift-hardening.js`, all proven, whole battery green.

**What the reviewer should probe:**

1. **Two predicates, deliberately different widths.** `capIsBaseCatalog` is the STATIC half;
   `canonizeCompanionSpellDefs` keeps `capabilityLookup` (base ∪ overlay) because at its call
   site the union is the right question. I documented the asymmetry at both sites rather than
   forcing one shared predicate. Confirm that reading, or collapse them.
2. **The `capability_bible.js` addition sits below the data block.** The BIBLE EDITOR CONTRACT
   round-trip carries `prefix` and `suffix` verbatim, and the suite is green, so an editor save
   is still a no-op — but the file is machine-touched by a satellite and now holds one more
   hand-written function. Worth one look.
3. **`ABILITY`-shaped entries are covered too.** The bible holds abilities under the same keys,
   so `[SPELL_DEF:Power Strike|…]` is now refused as well. That follows the unified-bible design
   (`kind` is cosmetic) and I believe it is right, but it was not explicitly ruled.
4. **No repair path for the shadows already in the field.** The refusal is forward-only. If a
   live save carries a bad shadow, the only exit remains an operator console
   `delete worldState.capabilityBible[key]` (Fable f51's own verifier note). If the owner wants a
   player-facing repair, that is a separate design.

**FABLE VERDICT (2026-09-03):** ADJUDICATED 2026-09-03: the two predicates of different widths AFFIRMED; the hand-written function below the data block ACCEPTED (BIBLE EDITOR CONTRACT round-trips prefix/suffix); ability-shaped refusal AFFIRMED (unified bible); no repair path for existing shadows ACCEPTED.

---

### 27 — WHO abandoned it: the quest archive's `by` field (#256, v1.724; Opus lane A, owner-ruled)

**Filed:** 2026-08-28. **Tracker:** TODO #252 (JP0-3 part A). **Touched:** `helpers.js`
(`questArchiveWording` — new pure renderer), `api.js` (`abandonQuestState` stamps `by:"player"`),
`tag_table.js` (the #231 wall archive write stamps `by:"wall"` + `wasOffered`; the QUEST reopen
guard's warn + muts line now render through the helper), `ui-modals.js` (Quest Journal History
label), `dev/run-tests.js` (#144A contract clauses ③ and ④), `dev/engine-tests.js`,
`dev/sabotage-231-arc-wall.js`.

**What shipped.** Three authors, one status. `abandonQuestState` and the arc wall now sign their
archive records; the wall additionally marks a swept OFFERED hook `wasOffered:true` (owner's
"opportunity lapsed" reading — a hook the player never accepted was the third semantic hiding
under the same label). `questArchiveWording(rec)` is the ONE renderer for every reader, returning
`{origin,label,phrase}`: "abandoned by you" / "closed with the arc" / "opportunity lapsed", and
"abandoned" for a LEGACY record with no `by` — which must never be read as a player drop. The
reopen guard's hardcoded "the player dropped it" (false for every wall sweep, and surfaced in the
console, the provenance ring, the turn's system message and the #229 decisions modal) is gone.

**Verification.** 7 failing-first engine assertions (all confirmed RED before implementation;
1691→1698 green). Sabotage `dev/sabotage-231-arc-wall.js` extended 16→22 clauses, 22/22 proven
byte-identical. The pre-existing clause quoting the wall's archive write was re-pointed in the
same commit (Fable f3's own verifier warning). Every prove block gained `also:["ui-modals.js"]` —
the new History-label source clause reads a ui shard that is NOT in the engine manifest, so
without it the clone's baseline reds and every clause misattributes (this actually happened on
the first run: 0/9 misattributed).

**What the reviewer should probe:**

1. **The History modal is a DOM shell I could not drive.** `ui-modals.js` has no test seam, so the
   three renderings are proven only at the pure helper plus a source clause pinning that the
   modal calls `questArchiveWording(aq).label`. A reviewer should eyeball the live journal once —
   the label sits inside the collapsed `<summary>` beside the turn stamp.
2. **`wasOffered` is written as a boolean on every wall record** (`false` for active threads), so
   a save now carries an explicit `false` where nothing existed. It is falsy everywhere it is
   read, but if a future reader does `"wasOffered" in rec` it will see a difference between wall
   records and player records. Decide whether the field should be omitted when false.
3. **Only "abandoned" got provenance.** `declined`, `completed` and `failed` archives still carry
   no author, and `archiveQuest` (the completed/failed writer) is untouched. If the wider JP0-3
   bundle (status validation, the declined reopen hole, archive-overwrite protection) lands later,
   it should decide whether `by` generalizes to every archive write or stays abandoned-only.
4. **No migration.** Pre-v1.719 abandoned records stay authorless forever and render neutrally.
   That is the deliberate honest choice (the author is genuinely unknowable), but it means the
   #231 field watch cannot count wall sweeps that happened before this commit — Fable f12's
   measurement gate only opens from here forward.

**FABLE VERDICT (2026-09-03):** ADJUDICATED 2026-09-03: wasOffered:false ACCEPTED (falsy everywhere read); provenance stays abandoned-only until JP0-3 widens it; no migration AFFIRMED. History label eyeballed as a DOM shell only via its source pin.

---

### 26 — memory.archive key registry (JP0-5 / TODO #255, v1.723; Opus lane B)

**Filed:** 2026-08-28. **Tracker:** TODO #253. **Source:** Joint_Review_2026_08_27.html ▸ JP0-5
(Sol P0-03, Fable-verified: writer at `tag_table.js:517-518`, key absent from the
`ui-files.js:477` whitelist). **Touched:** `state.js` (`MEMORY_ARCHIVE_KEYS`, `blankArchive`,
`archiveRebuild`, `archiveHeal`, `blankMemory`, `healMemory`), `memory.js` (`memArchive`),
`ui-files.js` (`importSave`), `dev/engine-tests.js` (new section + two shape adaptations),
`dev/run-tests.js` (#144A clause ① rewritten to derive from the registry),
`dev/sabotage-jp0-5-archive-registry.js` (new), CLAUDE.md §3.

**Why this is here.** Memory-tier plumbing on the drift surface, and it changes the birth shape of
`memory.archive` for every new campaign.

**What the reviewer should test hardest, in order:**

1. **Carry-unknown is a policy call, not just a mechanism.** I made `archiveRebuild` pass any
   unregistered key through verbatim, of any type. That is what closes the class (and it is
   already load-bearing: `dev/rc-mark-repair.js` and `dev/repair-t1788-bundle.js` write
   `retconRepairs`/`repairBundles` that the engine never declares). The cost is that a malformed
   or hostile `.tnd` can now plant arbitrary keys under `memory.archive`. Nothing reads the
   archive into a prompt today (storage-only by design), which is why I judged the trade safe —
   a reviewer should confirm that "never injected" invariant still holds everywhere before
   accepting it.
2. **Two existing assertions changed shape.** The `NPC_DEATH_RETRACTED` refusal tests asserted
   `memory.archive.npcDeathCorrections === undefined` to mean "nothing was archived"; the registry
   births every category as `[]`, so they now assert length 0. I believe that is equal-or-stronger
   (a single archived row still fails, and it no longer passes merely because `memArchive` was
   never reached) — but it IS an edit to a shipped assertion and should be eyeballed.
3. **`blankMemory().archive` grew from 5 keys to 16.** Sync blob and `.tnd` grow by ~250 bytes.
   No test pinned the old shape and `dev/diff-replay.js` has no committed endstate fixtures, so
   nothing byte-frozen moved — worth a second look anyway.
4. **`archiveHeal` replaces a non-object archive loudly** rather than attaching keys to it (the
   old `memArchive` would have decorated an array). Loss is inconceivable-shaped rather than
   impossible; the console.warn is the honesty.
5. **Registry completeness is asserted against an explicit list in two places** (the engine
   fixture's `_jp5Cats` and the contract's `_needAC`) on purpose — a guard that reads its
   expectations off the registry cannot notice the registry losing an entry. Adding a category
   means editing those two lists too; a reviewer may prefer a source-scan census instead. I
   considered scanning shipped files for `archive.<key>` writes and rejected it: the real writer
   for `relDowngrades` goes through a local alias (`_ar`) and `npcDeathCorrections` through
   `drArchive`, so the scan would have been silently incomplete — worse than an explicit list.

**Verification.** 6 assertions written first; the RED reproduced the shipped defect exactly
(import destroying `relDowngrades` + `npcDeathCorrections`, unknown keys dropped, `healMemory`
five categories behind, `memArchive` four). The #144A contract's own duplicate allowlist — the
reason each loss shipped green — is replaced by registry derivation plus a ban on any
`mm.archive.<key>` in ui-files.js. Sabotage `dev/sabotage-jp0-5-archive-registry.js` 10/10 caught
across state.js / memory.js / ui-files.js, byte-identical restore. Full suite 1703 green.

**FABLE VERDICT (2026-09-03):** ADJUDICATED 2026-09-03: carry-unknown AFFIRMED — the never-injected invariant holds for unregistered keys (retrieval reads only archive.chapters, a registered key); assertion reshape, birth-shape growth, loud replace and explicit registry lists all ACCEPTED.

---

### 25 — Corrupt recall-store rescue (JP0-4 / TODO #254, v1.723; Opus lane B)

**Filed:** 2026-08-28. **Tracker:** TODO #252. **Source:** Joint_Review_2026_08_27.html ▸ JP0-4
(Sol P0-03's sibling row Sol P0-02, Fable-verified this session at `state.js:476-478`).
**Touched:** `state.js` (`STORE_RESCUE_K`, `rescueCorruptStore`, both `loadState` catch arms),
`dev/engine-tests.js` (new section "corrupt recall-store rescue (JP0-4)"), `dev/run-tests.js`
(JP0-4 CORRUPT-STORE RESCUE CONTRACT), `dev/sabotage-jp0-4-store-rescue.js` (new), CLAUDE.md §3.

**Why this is here.** It is a memory-tier boundary on the drift surface: the two catch arms that
decide what a campaign remembers after a bad parse. The change is deliberately small — it adds a
preserve-and-shout step in front of the existing degrade and touches no parse, prompt, or write
path — but the failure mode it guards is total-tier loss.

**What the reviewer should test hardest, in order:**

1. **The rescue write is inside the failure path.** `store.set` can itself throw (quota) or fall
   back to the in-memory `_m` map (privacy mode). I treat `store.get(rk)===raw` as "kept" and say
   so in the messages, which is honest for THIS session but a `_m`-only rescue does not survive a
   reload. A reviewer may want that distinction surfaced to the player rather than folded into
   "a backup was kept".
2. **Newest-wins vs UA3's oldest-wins.** I ruled these opposite on purpose (UA3 prepends its
   rescue to survivors, so the oldest blob is the longest record; these stores are replaced
   wholesale, so the newest corrupt bytes are the most complete picture). If a corruption is
   *repeating* — the same bad write every load — newest-wins is harmless; if a first corruption is
   followed by a second, smaller one, the larger earlier blob is lost. Worth a second opinion.
3. **The memory catch arm also fires when `healMemory()` throws on VALID json.** I kept that inside
   the rescue (the bytes are still the only copy and the load is still degraded), but it means a
   heal bug now writes a rescue and a scary toast for a save that was not actually corrupt.
4. **Scope held deliberately:** no recovery UI, no auto-restore, no rescue for the `worldState`
   key (that arm returns false and refuses the load — loud already, not silent). The run-tests
   clause banning `store.del(STORE_RESCUE_K…)` in any shipped file is the speed bump for whoever
   builds the recovery flow.

**Verification.** 6 assertions, each confirmed RED before implementation (byte-identity of the
preserved blob, per-tier isolation, per-campaign isolation, newest-wins, tier-naming toast,
survival across a save cycle and later healthy loads). Source contract pins both catch arms, both
loud channels, the tier naming, and the no-sweep rule. Sabotage `dev/sabotage-jp0-4-store-rescue.js`
12/12 caught, byte-identical restore. Full suite 1697 green.

**FABLE VERDICT (2026-09-03):** ADJUDICATED 2026-09-03: probe 1 SHIPPED v1.808 — the rescue toast says 'kept for this session only' when the backup lives in the in-memory fallback (rescueKeptText); newest-wins AFFIRMED; heal-throw inside the rescue ACCEPTED; scope ACCEPTED.

---

### 24 — The size-bounded page-hide flush + unsynced-turn marker (#253 / JP0-11, v1.720; Opus, Fable-delegated)

**Filed:** 2026-08-28. **Tracker:** TODO #252. **Source:** joint review JP0-11 ← Fable f68 (verified ×2,
both corrections honoured: a portrait-bearing character crosses 64 KiB from ~turn 1, and the loss is
silent only when the second device advances PAST the local turn — otherwise it lands in the loud CAS
409 path). **Touched:** `storage-adapter.js` (beacon branch of `_syncNow`, its new optional `done`
completion, `load()` split into `load` + `_reconcileFromServer`, the new marker helpers), `CLAUDE.md`
§16 (the false guarantee line — a sanctioned doc correction), `dev/engine-tests.js`,
`dev/tests-jp011-flush-dirty.js` (new), `dev/run-standalone-suites.js`,
`dev/sabotage-jp011-flush-dirty.js` (new).

**Why this is here.** Transport, not the drift surface — but it decides whether a turn's canon ever
reaches the cloud, and the failure it fixes was invisible. Three things want the hardest look:

1. **`load()` now defers the reconcile behind a push.** The deferral is bounded by the existing 20s
   `_tFetch` deadline and the reconcile runs on every completion path (success, HTTP error, network
   reject, CAS pause, and every early return inside `_syncNow` — each now calls `done`). A missed
   `done` would strand a campaign offline for the session, so that enumeration is the load-bearing
   part; a sabotage clause pins it (`_fin(null)` removed → "the reconcile never ran").
2. **The marker is cleared ONLY by a confirmed 2xx of our own payload at a turn ≥ the marked one.**
   Deliberately NOT by the 409 self-heal's `_syncOk(serverTurn)` — that acks the *server's* turn,
   which is no proof our turns landed; the heal's retry does the clearing on its own 200.
3. **The gate measures BYTES, not characters.** `payload.length` (what the #67 telemetry uses as a
   size proxy) systematically under-reports the compressed `{__lz}` transcript, which is exactly
   where the payload is heaviest — a char-count gate would still let over-cap bodies through.
   `TextEncoder` with a char-count fallback (a lower bound, never an over-report).

**Deliberately NOT done** (per the delegating brief): no chunking, no sync-protocol redesign, no
plain-fetch fallback on `visibilitychange(hidden)` (Fable f68's own first suggestion), and no
server-side "turn N is unsynced" marker. Those remain open design questions if the marker proves
insufficient in the field.

**Verification.** 14 failing-first assertions (RED confirmed before implementation): 5 synchronous in
`dev/engine-tests.js` (byte-vs-char gate, no-request-on-oversize, loudness, small-payload keepalive
regression, bounded marker map) and 9 in the new standalone suite (it drives `load()`, which replaces
the live globals wholesale and cannot share the shared fixture): flush→marker, alt-tab beacon clear,
older-ack-never-clears-newer-marker, push-strictly-before-reconcile, confirmed-clear + one toast,
failed push keeps marker + stays loud + reconcile still runs, CAS conflict stays loud + keeps marker,
and unmarked boot unchanged. Mutation proof `dev/sabotage-jp011-flush-dirty.js` 10/10, byte-identical
restore (its `also:` carries the new standalone suite and the runner list into the scratch clone —
without that every boot-push clause would read MISSED).

**Probe first:** the `done` enumeration in `_syncNow` (any path that can return without calling it),
and whether deferring the reconcile behind a 20s push deadline is acceptable on a cold Fly host.

**FABLE VERDICT (2026-09-03):** ADJUDICATED 2026-09-03: the done enumeration traced — every early return in _syncNow's first branch calls _fin, the two later returns sit inside the keepalive branch that owns its own completion; the 20s deferral ACCEPTED (bounded by _tFetch).

---

### 23 — The arc wall: emergent thread scoping (#231, v1.714; Opus, owner-ruled)

**Filed:** 2026-08-24. **Tracker:** TODO #231. **Touched:** `helpers.js` (`skeletonArcTitles`,
`questIsEmergent`, `currentArcTitle`), `tag_table.js` (QUEST creation stamp, ARC_COMPLETE sweep),
`api.js` (`buildArcWallNudge`, NOTE_BUILDERS + NOTE_LATCH_FIELDS), `globals.js`.

**Why this is here.** Quest lifecycle teeth + an applyMuts write path that DELETES live quests +
a new prompt channel. The destructive half is what wants the hardest look: no prior engine path
archives a quest the player never touched.

**What the reviewer should test hardest, in order:**

1. **The sweep is the first engine path that destroys player-visible state on a schedule.** I made
   it narrow three ways (spine-titled never stamped, unstamped immune, parallel acts stamp
   nothing) and each is sabotage-pinned, but a reviewer should hunt for a fourth hole — especially
   a quest whose title later CHANGES, or an arc whose title is edited by a repair tool: the stamp
   is a title string, so a renamed arc orphans its progeny into permanent immunity (fails safe,
   but silently). Consider whether the stamp should be an arc index or id instead.
2. **`abandoned` now has two authors** (#229's player button and this sweep) and they are
   indistinguishable in the archive. If the History UI or a future Table Talk answer needs to say
   "you dropped this" vs "the story moved on", it cannot. A `by` field may be wanted.
3. **The warning's runway may be wrong.** ARC_WALL_WARN_LEAD=15 fires relative to
   ARC_TURN_BUDGET, but the #23 pacing nudge only fires when the arc is ALREADY over budget — so
   a fast arc completes with no warning at all, and its threads die unannounced. That is arguably
   correct (short arc, short leash) but it was not a deliberate design choice, it fell out of the
   arithmetic. Decide.
4. **Interaction with `[ARC_CONTINUE:]`.** An arc the GM legitimately keeps open never triggers
   the wall, so a thread can still outlive its nominal budget indefinitely as long as the GM keeps
   re-affirming the arc. #127's escalation is the only brake. Whether that is a loophole worth
   closing is a judgement I did not make.

**FABLE VERDICT (2026-09-03):** ADJUDICATED 2026-09-03: title-string stamp ACCEPTED (fails safe); item 2 SHIPPED as entry 27's `by`; the warning runway and the ARC_CONTINUE loophole RECORDED as design residue, no change.

---

### 22 — Define item: player-initiated item canon (#230, v1.710; Opus, owner-requested)

**Filed:** 2026-08-24. **Tracker:** TODO #230. **Touched:** `game.js` (`buildItemDefinePrompt`,
`defineItemFromStory`), `ui-sheets.js` (the 📖 row button), `item_bible.js` (one static entry —
Karzoug's greed-signet ring, owner-worded canon).

**Why this is here.** Shares entry 21's exact review-call shape and therefore its open question:
the response runs the FULL applyMuts, so a hallucinated non-ITEM_DEF tag would land. If entry
21's adjudication decides a tag whitelist for review calls, this caller joins it — one decision,
two sites (syncCharSheet is the third precedent, pre-dating both). Beyond that: the button gates
on `itemLookup` misses, so a classification-only entry (effect N/A) suppresses Define — decide
whether that is right (such an entry organizes but never injects, so the GM can still drift on
the item's nature; arguably Define should offer for effect-N/A non-mundane entries too, but
write-once means the def could then never land without an editor flow).

**FABLE VERDICT (2026-09-03):** CLOSED 2026-09-03: the review-call whitelist shipped as #264 (owner ruling 2026-08-28); the effect-N/A Define gate RECORDED as a design residue.

---

### 21 — Quest journal buttons: Suggest completion + Abandon (#229, v1.708; Opus, owner-requested)

**Filed:** 2026-08-24. **Tracker:** TODO #229. **Touched:** `api.js` (`abandonQuestState`, the
volatile abandonBlock), `tag_table.js` (QUEST reopen guard — one added clause), `game.js`
(`buildQuestSuggestPrompt`, `suggestQuestCompletion`, the 2-turn clear), `ui-modals.js` (buttons,
confirm modal, decisions modal).

**Why this is here.** A new prompt-injection block in buildSysPrompt's volatile half, a reopen-guard
clause in the QUEST handler, and a new GM call whose response mutates quest state through applyMuts.
Owner-requested mid-session; shipped on Opus under the standing budget rule.

**What the reviewer should test hardest, in order:**

1. **The suggest call's blast radius.** Its response goes through the FULL applyMuts — any tag the
   model emits lands, not just QUEST_STEP/QUEST/rewards. syncCharSheet has the same shape and that
   precedent is why I did not build a filtered parser, but a quest-review prompt that hallucinates
   an [NPC:|dead] would be worse than one that hallucinates an inventory line. Decide whether the
   review response should be restricted to a quest-tag whitelist before applyMuts.
2. **"abandoned" is a NEW archive status.** Everything that reads memory.quests statuses should be
   swept: Table Talk answers, the history modal (handled), the #17 quest indicator (counts
   complete-but-uncredited — abandoned quests are archived so they leave that census naturally),
   and the reopen guard's completed/failed clause (untouched). I checked the renderer and guard;
   a reviewer should grep for status equality tests I missed.
3. **The 2-turn abandonBlock vs the reopen guard's permanence.** The block also tells the GM not to
   |offered re-raise immediately; the guard permanently blocks only non-offered. After the block
   expires, an immediate |offered re-raise is legal by design (owner's gate is the player). If the
   field shows the GM re-offering on turn 3 every time, the shelf may need to be longer for this
   marker than for recentlyLeft.
4. **Busy-flag discipline in suggestQuestCompletion** — set true before the await, false in both
   paths, same as syncCharSheet; and the decisions modal falls back to a toast if ui-modals is
   absent (headless). Verify no path leaves busy stuck on a thrown callGM.

**FABLE VERDICT (2026-09-03):** CLOSED 2026-09-03: probe 1 → #264 whitelist; probe 2 → #259 quest state machine swept the statuses; probe 4 verified (busy released on both paths); probe 3 is a field watch.

---

### 20 — The split re-affirm loop (#228, v1.707; Opus, owner-ruled)

**Filed:** 2026-08-24. **Tracker:** TODO #228. **Touched:** `tag_table.js` (the `[PARTY_SPLIT:]`
handler only).

**Why this is here.** An `applyMuts` write path, and it changes what a tag DOES on a re-emit.
Owner-ruled live from a field save; shipped on Opus under the standing budget rule.

**What the reviewer should test hardest, in order:**

1. **The `_freshSplits` grant inside the no-op is load-bearing and easy to "clean up".** It looks
   redundant sitting in a branch that otherwise does nothing. It is not: without it the #133b
   co-location fold dissolves a same-node stay-behind on the very next response, which is exactly
   the case owner ruling ⓑ protects. The sabotage clause pins it, but a reviewer should confirm
   the interaction is right rather than merely tested.
2. **`splitLoc.turn` now freezes at the original split turn for a re-affirmed split.** #133
   documented the re-affirm as "resets the clock", and one existing test asserts exactly that —
   it still passes only because its fixture is the LEGACY unstamped shape, which deliberately
   falls through. That is a genuine near-miss: the old contract line and the new behaviour
   disagree, and the test that should have caught it did not, for an incidental reason. Decide
   whether the #133 comment and the audit note's "re-affirming resets this check" wording should
   be corrected (I left both alone as prompt-surface risk not worth taking mid-fix).
3. **The residue is the actual trigger.** `buildSplitAudit`'s same-world waiver (api.js:514–515)
   fires every turn for ANY split inside the party's own world node. #228 makes that cheap rather
   than harmful. Whether the waiver should itself be age-gated once a sublocation is present is an
   open design question I did not take.
4. **Presence evidence now ages where it used to refresh.** A re-affirmed split no longer re-stamps
   `lastSeenTurn`/`lastSeenSrc`. I believe that is strictly more honest under #194 gate ③ (nobody
   re-witnessed them), but it does mean a long stay-behind's evidence can age out of
   `SPEECH_EVIDENCE_TURNS`-adjacent windows. Worth a second opinion on the death-gate interaction.

**FABLE VERDICT (2026-09-03):** ADJUDICATED 2026-09-03: the _freshSplits grant AFFIRMED as load-bearing (sabotage-pinned); the #133 wording was repaired at f32 (api.js #228 comment); the same-world waiver and evidence ageing RECORDED as accepted residue.

---

### 19 — Combat narration/tracker reconcile + the reward-claim modal (#214/#215, v1.699; Opus, owner-ruled)

**Filed:** 2026-08-22. **Tracker:** TODO #214, #215. **Touched:** `tag_table.js` (COMBAT_END,
post-handler seam), `api.js` (`buildCombatStaleNudge`, NOTE_BUILDERS/latch registry, the shelve
site), `helpers.js` (rewardClaim writers), `ui-modals.js`, `game.js`/`ui-boot.js` (resurface),
`globals.js`.

**Why this is here.** Combat write paths plus a new NOTE_BUILDERS entry plus a new payout path.
Owner-ruled in the moment; shipped on Opus under the standing budget rule.

**What the reviewer should test hardest, in order:**

1. **#214① changes the meaning of an existing tag.** `[COMBAT_END:victory]` over living foes used
   to discard them; it now kills them. Three pre-existing tests already exercised that shape and
   silently changed behaviour without breaking — I added a death-gate test proving a rostered foe
   is still refused, but a reviewer should decide whether the victory-word regex
   (`/^(victor|won|win|slain|kill|rout|triumph)/i`) is the right boundary, and what a GM writing
   an unlisted outcome word should get. Today an unrecognised word silently resolves nothing.
2. **Is `propagateSlainFoes` really gated for every foe shape?** My safety test covers one case
   (rostered, no scene evidence). I did NOT enumerate foe shapes — aliased names, a pooled
   "Goblin pack" entry that matches a roster name, a foe whose name collides with a party member.
3. **#214② fires DURING combat**, unlike every sibling note, all of which are combat-silent by
   deliberate design. That inversion is intentional and argued in the row, but it is exactly the
   kind of "one exception to a house rule" worth a second opinion — mid-fight note volume was
   part of what #211 was about.
4. **#215 pays out through `applyMuts`.** Reusing the one path is right, but it means a claim
   accepted while a NEW dispute is live could be re-stripped. I made the award measured so it
   fails loudly rather than lying — the failure mode is a claim that closes unpaid and toasts.
   A reviewer should decide whether closing it is correct or whether it should re-queue.
5. **Player-gated payout is a canon write the engine previously refused.** The owner ruled it;
   the modal states the doubt. Worth confirming the framing does not read as the engine
   endorsing an unearned reward.

**Verification:** 11 engine tests, each confirmed red first (1615 → 1621 green); 8 sabotage
clauses; #215's award/decline/re-render loop driven in a real browser against a seeded state.
**Not done:** no live playtest — both paths need a model to misbehave to fire; no diff-replay (the
corpora contain no victory-close-over-living-foes response, so byte-identical would prove nothing).

**FABLE VERDICT (2026-09-03):** ADJUDICATED 2026-09-03: probe 1 resolved by #268 (defeat-exclusion first, unrecognised outcome LOUD); probe 3 (mid-fight note) AFFIRMED; probe 4 re-queue → #276 ③; probe 5 framing AFFIRMED; foe-shape enumeration RECORDED.

---

### 18 — W2 withhold toasts now carry the refusal reason and an honest status (#213, v1.698; Opus, owner-ruled)

**Filed:** 2026-08-22. **Tracker:** TODO #213. **Touched:** `identity.js` (`w2PrepareResponse`
withhold sites, new display helpers), `api.js` (`buildIdentityConflictNudge` shelve notice),
`globals.js` (`W2_WITHHELD_CAP`).

**Why this is here.** It sits on the drift surface by location — the two edits are inside
`w2PrepareResponse`, the function that decides which tags survive to `applyMuts` — so the decree
says Fable regardless of how display-shaped the intent was. It shipped on Opus under the standing
"Fable budget exhausted, document it here" rule, after an owner ruling on scope.

**What the reviewer should test hardest, in order:**

1. **Did a display change alter what commits?** The claim is that it did not: the only new writes
   are `c.withheld` (a bounded array on an existing conflict record) and the reason/record locals
   threaded to the toast. But site A now calls `_w2CollectStripped` and `_w2RefuseLog` where it
   previously called neither, and `_w2RefuseLog` feeds `w2RefusedThisResponse()`. **I did not
   fully trace every consumer of `_w2RefusedNow`** — I reasoned that adding the reward tokens
   there makes site A match site B's long-standing behaviour (provenance parity), and the suite
   stayed green, but "green plus a plausible story" is exactly what this queue exists to catch.
2. **`W2_REWARD_RES` is now module-level shared regex objects with the `/g` flag.** `String.match`
   with a global regex ignores `lastIndex`, so reuse is safe as written — but if any future caller
   reaches for `.exec()` or `.test()` on these, the shared `lastIndex` becomes a state bug across
   responses. Worth a judgement on whether the sharing is worth that trap.
3. **The reason→copy table is ordered, and order is load-bearing** (the unmasking clause must be
   tested before the broader no-binding clause). One test pins the discrimination; a reviewer
   should decide whether ordered-regex dispatch is the right shape here at all, versus giving each
   refusal an explicit code at its call site (rejected during the build as ~10 call sites of churn
   plus the transaction-preflight reasons that arrive as variables, not literals).
4. **The honest-status claim itself.** The shelve notice tells the player the reward "will not
   arrive". That is true as far as I traced it — nothing replays a stripped reward — but it is an
   assertion about the *absence* of a mechanism, which is the harder thing to verify. If some path
   does re-pay, the new toast is now confidently wrong at the player.

**Verification done:** 8 engine tests, each confirmed red on v1.697 before the fix (suite 1605 →
1610 green); 10 new `dev/sabotage-w2.js` mutation clauses; a new REFUSAL COPY CONTRACT source
guard in `dev/run-tests.js` which caught two uncovered reasons my own enumeration had missed.
**Not done:** no live-play spot check (these paths need a model to misbehave to fire), and no
diff-replay over the playtest corpora — the corpora do not contain a refused-death-with-reward
response, so a byte-identical result would have proved nothing about the changed lines.

**Known residue, filed in the row, not fixed:** the withheld reward is still never recovered. The
toast is now honest about the loss instead of repairing it; actual payout-on-resolution is a new
canon write path and was deliberately left for its own design pass.

**FABLE VERDICT (2026-09-03):** ADJUDICATED 2026-09-03: probe 1 traced — _w2RefusedNow's only consumer is the provenance ring write (api.js), so the display change altered nothing that commits; probe 2 verified — W2_REWARD_RES is only ever used through _w2CollectStripped (match), no exec/test; ordered dispatch AFFIRMED; the no-replay claim holds (#215 pays only through the claim modal).

---

### 14 — Two residual field watches from #93/#172 (Opus)

**Filed:** 2026-08-12. **Adjudicated:** Fable f80, 2026-08-27. **Shipped roots:** v1.603–v1.604
(#93, `43363ea` / `caa2a92`) and v1.605 (#172, `8a19360`). **Trackers:** TODO #93, TODO #172.

The inherited-voice/parity questions and `paragraphGaps` probe in the former entry are retired:
Fable's P4a/P4b passes (`4faeb09`, v1.610; `d0c510e`, v1.611) replaced those mechanisms and carry
their own evidence. Do not spend a new review on the retired shapes. Two live residuals remain:

1. **TTS splitter internals, `tts.js:913-981` — accepted residue / field trigger.** `quoteFault`, the
   `_cutOff` fork, and flattening are unchanged since v1.604. In particular, truncated speech whose
   cap lands on a period still flattens after its first closed quote. The shipped choice is backed by
   the 23,858-paragraph census and 18-mutation battery; reopen only if voice misattribution returns.
2. **The unconditional single-player person tail, `api.js:1807` — field watch cleared so far.** The
   terse post-STYLE line has stayed quiet through the owner's play from t1723 to past t2175. Reopen
   only if third-person drift recurs or the line is heard degrading the chosen prose voice.

No dedicated code pass is warranted without either field trigger. #197's refusal guards changed the
former `personDrift` latch context; that superseded question is not a third live residual.

---

**FABLE VERDICT (2026-09-03):** RETIRED 2026-09-03: both residuals are field triggers (TTS splitter, the person tail); neither fired through t2175 and the Iron Meridian run; no code pass.

---

