# AUDIT — Playtest 4 (v1.275, 2026-07-11 night): live obedience run for the v1.274/v1.275 night batch

**Run:** 8 GM turns + 1 sheet-sync audit, Sonnet, harness-driven, every turn targeted at a
just-shipped rule. **Character:** Brannoc Vail — fresh level-2 Human Warrior with two loot items,
gritty tone, Abercrombie voice, emergent campaign "PT_v1275_NightBatch" in Dunmarrow. **Cost:**
$0.32 (22 calls). **Corpus:** [dev/corpus_playtest_v1275.json](../dev/corpus_playtest_v1275.json)
(8 turn log + raw responses + toasts + labeled synthetic notes; durable in `tnd_pt_corpus_v1`).
Synthetic interventions (2, labeled): the `[PARTY_MEMBER:]` trigger for the #48③ pipeline test
(the GM kept the recruitment conditional in-fiction) and the removed-Longsword discrepancy for
the #50a sync test.

## Verdict

**The night batch obeys live. 4 of 5 shipped rules validated on their first natural trigger;
the #50a sync repair declined its (weakly-evidenced) manufactured discrepancy — inconclusive,
not failed — and exposed one real instruction collision (P4-F1).**

## The checks

| Check | Result |
|---|---|
| **#51 ① spend-side (GOLD IS PHYSICS TOO)** | ✅ PASS, twice. t1: inn room + meal → `[GOLD:-2]` (the exact leak that survived Playtests 2 AND 3). t8: market provisions → `[GOLD:-2]` + `[ITEM_GAINED:]` ×2. |
| **#51 ③ loot→sell (LOOT SELLS)** | ✅ PASS, end to end. t2: pawnbroker states a concrete itemized price unprompted ("Eight for the ring. Six for the blade. Fourteen total."); t3: acceptance closes with `[GOLD:+14]` + both `[ITEM_LOST:]` by exact name. The faucet exists now. |
| **#51 ② quest gold (scaled guideline)** | ✅ PASS. "The Welcome Tax" closed with **+100 gp at level 2** — precisely the ~50×level "major contract" guideline — via the completion toast ("✓ … +50 XP, +100 gp"). Caveat: the close arrived through the SYNC audit, not a turn → P4-F1. |
| **P3-F3 travel (TRAVEL MOVES THE MAP + geo-header teeth)** | ✅ PASS. t8: half-day ride to Harrow's Ford → `[LOCATION:Harrow's Ford]` + first-visit `[LOCATION_DESC:]` (with exits) + `[LOCATION_SIZE:tiny\|5]` in one response. The Playtest-3 class (two days of travel, tracker never moved) did not recur. |
| **#48③ SPELL_DEF faucet** | ✅ PASS on the real pipeline. Liryn Xandrel generated as a Cleric (Sacred Flame, Cure Wounds, **Bane**); the on-catalog picks resolved against the base bible untouched, and off-catalog Bane self-defined into `worldState.capabilityBible` (tier 1, 30ft, category **divine** from the class map, full effect line) with the loud canonize warn. Trigger was synthetic (labeled — the GM kept her conditional in-fiction), but the generation call, model, parse, and overlay write were the production path end to end. |
| **#50a sync item corrections** | ◐ INCONCLUSIVE. Manufactured discrepancy (Longsword removed; the story references his sword only in player-action text) was NOT repaired — the audit made no item emission at all. Defensible model caution given thin story evidence, and exactly what the anti-double-spend instruction pushes toward, but it means the repair path and the correction-toast trail have no live PASS yet. Engine side is tested (`invDiffLines`, prompt content). Retry next playtest with a strongly narrated item. |

## Findings

| # | Finding | Sev | Notes |
|---|---|:---:|---|
| P4-F1 | **Instruction collision: the sync audit closed a quest and the close brought rewards.** The sync prompt forbids XP/GOLD, but it allows `[QUEST:title\|status]` — and the (older, stable-half) quest-close rules + the new QUEST GOLD guideline instruct that completions carry their rewards. The model resolved the conflict by obeying the quest rules: `[QUEST:The Welcome Tax\|completed][XP:50][GOLD:+100]` inside a sync response. The bookkeeping was *correct in-fiction* (the quest WAS finished, the amount on-guideline), so this is a boundary question, not a corruption: should sync-audit quest closes carry rewards (they do today), or should the sync prompt tell the GM to close WITHOUT rewards and let the reopen guard's paid-record stand empty? Note the interaction: a reward-less sync close writes NO `paid` record, so a later reward re-emission would evade the P3-F2 backstop. Leaving as-is is defensible; decide deliberately. **✅ RESOLVED (v1.276, user ruling 2026-07-12: KEEP)** — sync closes pay like any close (paid record intact for the P3-F2 backstop); the hallucinated-close edge is guarded by a new sync-prompt line ("close a quest ONLY if this session's events unambiguously show it finished — never on inference"). | Low-Med | Resolved: keep |
| P4-O1 | Observation: rations bought as "Travel rations" stacked separately from the creation item "Travel rations (2 days)" — the known name-variance stacking behavior (#50d adjacent), not new. | — | — |
| P4-O2 | Observation: the GM held companion recruitment behind a quest precondition two playtests running — good fiction, but harness runs needing a sheeted companion should budget turns for it or use the labeled synthetic trigger. | — | Harness note |

## What this run cannot claim

Short run (8 turns, no combat, no rest, no summarize cycle); Sonnet only; #50a repair unproven
live; #46 `cause` still without an organic trigger (no condition inflicted — two playtests
running); the P3-F1 stats fix had no organic multi-foe fight this run (engine-tested + verified
on the staged panel earlier tonight).

## Status updates driven by this audit

- **#51: VALIDATED LIVE** — all three ratified rules obeyed on first trigger; the 100-turn
  zero-gold era is over. Row can close pending long-run confirmation.
- **P3-F3: VALIDATED LIVE** — travel emission fixed on first trigger.
- **#48③: VALIDATED LIVE** (production pipeline, synthetic trigger).
- **#50a: engine shipped, live repair still unproven** — carry the strongly-narrated-item retry
  on the play checklist. New: **P4-F1** sync-close reward boundary needs a user call.
