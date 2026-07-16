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

_(none)_

---

## Reviewed

### 1. TODO #23 — per-arc pacing budget + inverse arc-drift detector

**Reviewed by Fable 2026-07-16 — VERDICT: PASS on all four verify items; no code changes needed.**
Full record: [AUDIT_ARC_NUDGES.md](AUDIT_ARC_NUDGES.md); evidence: `testRuns/arc_nudge_loop/`.

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
- **What was verified (Fable, 2026-07-16):** all four items above — see the verdict block and AUDIT_ARC_NUDGES.md.
- **Supporting docs:** TODO.md #23 row (full detail); AUDIT_ARC_NUDGES.md; testRuns/arc_nudge_loop/ (protocol, injector, EVAL_NOTES, 7 trial corpora).
