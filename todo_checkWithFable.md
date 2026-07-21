# todo_checkWithFable.md

**Purpose:** the drift-protection policy (CLAUDE.md ▸ Dev workflow) marks any task touching the
drift surface as **Fable-tier** — meant to be built by a Fable session. When such a task is instead
completed by a **non-Fable model** (Opus, Sonnet, Haiku, etc.), the work ships but still deserves a
Fable-eyed review after the fact. Every such task lands here with its supporting documentation so a
Fable session can audit it in one pass.

**How to use:** when Fable reviews an entry and is satisfied (or files follow-ups), move it to
**Reviewed** with the date and verdict. Leave open items in **Pending Fable review**.

---

## Pending Fable review

### 3. Campaign clock — new time subsystem, new tags, buildSysPrompt injection, migration (TODO #73)

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
- **Supporting docs:** [DOC/DOC_clock.html](DOC/DOC_clock.html); TODO.md #73 row.

### 2. NPC mood / relation separation — schema repair of the character-state tier

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

## Reviewed

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
