# AUDIT — Arc-nudge live compliance (v1.296 per-arc pacing budget + v1.297 inverse arc-drift detector)

**Date:** 2026-07-16 · **Auditor:** Fable (orchestrator + evaluator; Sonnet runner agents)
**Scope:** the Fable-tier review deferred in `todo_checkWithFable.md` entry #1 — the v1.296/v1.297
work built by Opus 4.8 on 2026-07-15. Engine mechanics were already deterministic and
engine-tested; this audit answers the two open questions: **does the live GM model obey the
nudges**, and **does the budget nudge ever railroad a premature close** (the user's one stated
worry). Method, fixtures, and all raw evidence: `testRuns/arc_nudge_loop/` (PROTOCOL.md,
injector.js, EVAL_NOTES.md, trial_*.json corpora — durable per the test-runs-always-audit rule).

---

## Method

- **Base fixture:** the real `Rise_of_the_Runelords_t343.tnd` save (turn 343, level-8 party of 4
  inside Thistletop) — naturally in the early t727 drift shape (Glassworks arc active, its quest
  completed+archived). Per-scenario skeleton mutations injected under throwaway `ARCTEST` campaign
  ids, sync token stripped (no cloud contact possible), app at v1.305 on localhost.
- **Trials:** 7 run of 11 planned (B3/C3/A3/D2 trimmed once signal was unanimous — recorded in
  EVAL_NOTES). 10 real Sonnet GM turns each (B2 early-stopped at 5). **72 paid turns, $6.20 of
  the $25 cap. Zero harness errors across all trials.**

| Trial | Scenario | Stimulus | Result |
|---|---|---|---|
| A1 | budget nudge, 60 turns over | nudge every turn | converged; no close (climax legitimately not reached); zero sprawl |
| A2 | budget nudge, 60 turns over | nudge every turn | earned close t349 via ORGANIC drift-nudge handoff (see below) |
| B1 | drift nudge (arc alive, quest archived) | engine note, turn 1 | `[ARC_COMPLETE:The Glassworks]` on the FIRST nudged turn; zero scene disruption |
| B2 | drift nudge, replication | engine note, turn 1 | identical: close on first nudged turn; verbatim note captured as sent |
| C1 | premature-close probe, 200 over | nudge every turn + live negotiation | earned climactic close t353 — GM added an informed-consent beat UNDER pressure |
| C2 | premature-close probe, 200 over + player deliberately stalling | nudge every turn | NO close in 10 turns; player pace fully honored; pressure expressed diegetically ("The ending is waiting") |
| D1 | control (fresh clock, no nudges) | none | no close, arc state frozen, latch empty, sent-capture clean |

## Verdicts

**1. Obedience — PASS.** The drift nudge is decisive: 2/2 one-nudge-one-close, both closes pure
bookkeeping with the narration never leaving the live scene. The budget nudge converges reliably
(4/4 nudged trials drove straight at the arc objective) and closes when the fiction's climax is
actually reached (A2, C1) rather than on a timer — which is the correct reading of its wording.

**2. Convergence / anti-metastasis — PASS.** Across every nudged trial: zero open-ended new
threads. The t727 signature (self-replicating numbered conspirators) never appeared; the only
emergent quest (A2's "Dissolution of Thistletop") was closed inside the same window. One new
named NPC per ~10 turns = normal texture.

**3. Premature-close safety — PASS (the user's one worry, retired).** C1: under 200-turn
pressure the GM *slowed the player down* at the climax ("Not readiness. Understanding.") before
an earned close. C2: same pressure against a player explicitly refusing to rush — no close in
10 turns, every stalling beat honored, the nudge surfacing only as in-fiction invitations to
conclude. "Steer, don't teleport" is observably what the model does with this wording.
**Consequence: the wording-asymmetry concern from the static review (budget nudge lacks the
drift note's explicit escape valve) is resolved empirically — no change needed.** A wording edit
now would be unforced churn on the drift surface.

**4. Value over baseline — PASS.** D1 control: same state, no nudge, no close, no spontaneous
arc bookkeeping. B's temporal coupling is the strongest attribution: an arc stale for the save's
entire recorded history closed on the first nudged turn, twice. A2 additionally showed the
intended v1.296+v1.297 **composition** occurring organically: budget pressure → quest completes
t348 → drift detector notices the arc/quest desync in the wild → arc closed t349, next arc
auto-activated with a fresh startTurn stamp.

## Static-review findings (from the same Fable review, pre-loop)

- **Stable/volatile split integrity — verified clean.** `buildSkeletonBlock()` concatenates into
  the volatile half (api.js:491); `buildArcDriftNudge` rides NOTE_BUILDERS into the outgoing
  message (game.js:672) and cannot touch the prompt cache. Confirmed live: cache reads healthy in
  every trial's usage telemetry.
- **Backfill-at-current-turn — signed off.** Failing late-not-early aligns with the
  premature-close priority; the act nudge covers the interim. Observed working in scenario B
  (undefined → 343 at load).
- **Parallel-act survivor clock — documented limitation, no change.** In a parallel act, all arcs
  are stamped at act start; when siblings close, the survivor's age includes time the player
  spent elsewhere, so the budget nudge can call it "dragging" early. Low severity: the nudge is
  soft, and C-scenario evidence shows the model does not over-obey it. Revisit only if a real
  parallel-act campaign surfaces the nag.

## Side-findings (bonus evidence, all healthy)

- Quest-escalation note (P3) and condition-audit note obeyed exactly in every trial where present.
- C1's scripted false premise (goblins already dead in fiction) was flatly refused — the
  player-actions-are-intent rule holding against player-injected canon violations.
- Duplicate `[QUEST_STEP:]` re-emissions (D1) are idempotent by design — the handler dedupes by
  objective text (tag_table.js:275). Non-issue.
- v1.288 suggestion-call cache-riding confirmed in the wild (actions-bucket cache reads in usage
  telemetry) — relevant to the standing user watch flag.
- Repeated suggested actions (harness randomness) get "Already done." replies without
  re-narration or state corruption.

## Standing-policy record

Drift-protection policy satisfied: Fable-tier review performed (static pass + live-compliance
loop), no code changed by this audit, corpora persisted, tracker rows updated in the same commit.
Rollback: n/a (documentation + dev tooling only).
