# AUDIT — 50-turn gpt-4o arm, standard campaign (v1.636)

## Run

| | |
|---|---|
| **Commissioned** | Owner, 2026-08-15 — "run the gpt-4o arm"; third arm of the model sweep on the standard campaign. |
| **Provider / model** | openai / **gpt-4o** (`openai.reinforce` MANDATORY-TAG-DISCIPLINE block active as always for this provider) |
| **Campaign** | `modelTestCampaign_gpt4o` — pinned Korrag, started from `samples/modeltestcampaign.blueprint` |
| **Turns** | 50 committed. **Run integrity note:** turns 1–15 ran at full speed under heavy OpenAI rate-limiting (44× HTTP 429; the runner's log recorded failed attempts as entries until reconciled against `worldState.turn`); turns 16–50 ran under a paced driver (60s gap, counts only committed turns) with **zero** further rate-limit backoffs. Failed calls never reached the GM, so the story stream itself is 50 clean responses. |
| **Save / memento** | `testRuns/modelTestCampaign_gpt4o.tnd`, `testRuns/modelTestCampaign_gpt4o_memento.html` |
| **Corpus** | [`dev/corpus_playtest_v1636_gpt4o.json`](../dev/corpus_playtest_v1636_gpt4o.json) — 50 log (deduped to one per committed turn) + 50 raw + 0 harness errors |
| **Tokens / cost** | 79 billed calls: 300,985 in / 12,802 out. In-app $0 — **MODEL_PRICING covers only Anthropic models** (now a confirmed two-provider gap: gemini + gpt-4o). Computed ≈ **$0.90** at gpt-4o sticker. |

## Verdict

**gpt-4o FAILS the money turn on tag discipline — the historical desync class at full scale, with the reinforce block active.** The first fifteen responses of the campaign carried **zero state tags apiece** (the #17 health readout's red threshold is a five-turn streak; this was fifteen). Tags then partially recovered in the paced window, but "recovery" means TIME_ADVANCE-and-dialogue only: across all 50 turns the GM emitted **no combat tag of any kind, never registered a quest, and never touched HP, gold, XP, or inventory** — Korrag ends the run byte-identical to his creation sheet (14/14 HP, 40 gold, 0 XP) through narrated ambush investigations, interrogations, and a mansion infiltration. The blueprint premise fared worse than Gemini's dropout: the caravan appears in **zero** narrations — gpt-4o ignored the control's opening scene from turn 0 and invented its own solitary-wanderer start. Prose voice is the weakest of the three arms: ornate generic fantasy ("each step a declaration", "a calculated dance with silence") with none of Howard's concrete physicality. The engine held exactly as designed — clean summarize extractions (5/5), no invariant breaks (trivially: nothing ever changed), and in live play the drift-health dot would have flared red by turn 5.

## Checks

| Check | Result |
|---|---|
| Turns / integrity | ✅ 50 committed; ⚠ t1–15 window ran under 429 interference (see Run note) — a confound for the zero-tag window, though the tag classes that failed stayed failed in the calm paced window too |
| Zero-tag responses | ❌ **15 of 50** — every response t1–t15; the gpt-4o desync class, with `openai.reinforce` active |
| Tag breadth (all 50 turns) | ❌ TIME_ADVANCE 31 · SAY 12 · SKILL_SUCCESS 10 · RELATIONSHIP_DYNAMIC 6 · NPC 4 · DICE 3 — **and nothing else**: no COMBAT_*, no QUEST, no HP/GOLD/XP/ITEM in 50 turns |
| Sheet drift | ❌ Character sheet FROZEN at creation values through 50 turns of narrated peril — the exact silent-desync failure the tag system exists to prevent |
| Invariants | ✅ 0 breaks (vacuously — no state ever moved) |
| Summarize | ✅ 5 cycles, clean JSON extraction |
| Unknown/invented tags | ✅ 0 (census derived from `tag_table.js` per the corrected protocol) |
| **Coherence ② thread-dropout** | ❌ caravan premise in **0 of 50** narrations — the control's opening scene was never used at all (worse than dropout: non-adoption) |
| **Coherence ① dead-actor / ③ story read** | ~ no deaths to test; the story meanders but stays locally consistent in the paced window; clock sluggish (entire run inside Day 1; ~7 narrative hours in 50 turns vs Sonnet reaching Day 2 noon) |
| Prose voice (Howard) | ❌ generic ornate fantasy; weakest of the three arms |
| Rate limiting | ⚠ Default-tier OpenAI cannot sustain the app's ~31k tokens/turn cadence — 44× 429 until paced to ~1 turn/min. Live-play implication: gpt-4o players on low-tier keys will see failed turns at normal play speed |

## Sweep scoreboard (3 of 5 arms)

| Axis | gemini-3.5-flash | claude-sonnet-4-6 | gpt-4o |
|---|---|---|---|
| Tag discipline | ✅ excellent | ✅ excellent | ❌ collapsed (15 zero-tag; no combat/quest/economy ever) |
| JSON extraction | ✅ 6/6 | ✅ 8/8 | ✅ 5/5 |
| Story coherence | ❌ failed | ✅ excellent | ⚠ premise never adopted; meanders |
| Author voice (Howard) | ✅ strong | ⚠ partial | ❌ generic |
| Ops | — | — | ❌ needs pacing at default rate tier |
| Cost (50 turns) | ~$0.50 est | $3.22 actual | ~$0.90 est |

## Graduates / follow-ups

1. **MODEL_PRICING gap is now two providers wide** (gemini-3.5-flash, gpt-4o) — registry-entry follow-up with verified prices; the meter's token counts are honest, its dollars are not.
2. **Harness turn-integrity fix graduates from field improvisation to the repo**: the paced driver's "count only committed turns + backoff on no-advance" logic should replace the log-length counter in `dev/playtest-harness.js` — it is what made this run's numbers honest. (Dev-only file; distinct from the PARKED no-repeat picker remedy, which stays parked per the owner's ruling.)
3. The zero-tag-window trigger (why t1–15 exactly, and whether 429-era load shedding contributes) is **unresolved** — recorded honestly; a re-run at a higher rate tier would isolate it, only worth doing if gpt-4o ever becomes a candidate tier.
4. Remedy decisions remain PARKED until the sweep completes (grok, ollama pending as keys allow).
