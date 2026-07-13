# AUDIT — Playtest 2 (v1.258, 2026-07-10): the post-cutover playtest + condition/quest/relationship validation

**Run:** 100 GM turns, Sonnet 4.6, harness-driven with 8 steered pressure beats (quest seek,
companion recruit, 3× timed-condition forcing, sworn oath, long rest, completion push, real-danger
fight). **Character:** Sera Vantel — fresh level-1 Human Cleric (catalog spells: Guidance, Sacred
Flame, Healing Word, Bless), gritty tone, Abercrombie voice, emergent campaign "PT_v1258_PostCutover"
in Duskbridge. **Cost:** $3.92 (218 calls: 101 turns + 101 escalated suggestion calls + 14
summarize + skeleton). **Corpus:** [dev/corpus_playtest_v1258.json](../dev/corpus_playtest_v1258.json)
(100 turn log + 100 raw responses + 22 toasts + engine notes; durable copy in the preview browser's
`tnd_pt_corpus_v1`). Instrumentation: toast capture, engine-note capture, steering, all baked into
the corpus.

## Verdict

**The cutover holds: 101/101 reverse-parity runs, ZERO diffs, zero harness errors, across a run
that deliberately exercised the vocabulary hard.** The legacy parser recomputed every turn and
never once disagreed with the table. All three #40 trigger classes, the complete #46 condition
lifecycle (including the appointment audit and the early-removal no-phantom property), REST, skill
progression, companion sheeting/XP/level-up, and reciprocal relationships validated live. Two real
defects reproduced with raw-tag evidence: **F3 quest-reopen (twice, organically)** and the
**zero-gold economy (#51, now quantified)**.

## The checks the run was commissioned for

| Check | Result |
|---|---|
| **Quest completion toasts/rewards** | ⚠ **No completion toast exists** (confirmed by design + live: two completions, zero quest UI feedback — only `offered` ever toasts, and no quest was formally offered all run). Rewards: completions paid XP (t7 +50, t75 +25) but **no gold ever** — see #51. **Enhancement now cheap post-cutover: completion/failed toast with same-response rewards = one table-entry edit.** |
| **Relationships update** | ✅ Strong. `[RELATIONSHIP:]` at both bond moments (t20 Allied, t48 Oath-bound), and — notably — **the reciprocal `[COMPANION_RELATIONSHIP:]` was emitted unprompted BOTH times.** Sonnet reciprocates at explicit bond-forming scenes; the UA41 nudge remains a backstop for quieter shifts (the Morwen wedding class). NPC_LINK also used organically (2×). |
| **Conditions obeyed** | ✅ **Full lifecycle validated live, every mechanism:** add toasts (player + companion, t33/36/41/94) · engine turn-stamps · `until` parse ("2 rounds"→t38, "4 rounds"→t45) · free-text durations correctly NOT scheduled ("1 minute") · **early organic removal took its appointment with it — no phantom audit** (Winded, removed t37, no fire at t38 — the property the rejected bool-list design would have failed) · **the appointment FIRED at exactly t45** (engine note captured, `lastConditionAudit=45`) · the audited response removed the elapsed condition AND swept both stale Blessed entries — per-condition rulings · lift toasts ×4. |

## Live-validated for the first time (free riders)

- **#40 Core Memory — all three trigger classes:** companion join (t20), weighty bond (t48,
  "Oath-bound" → WEIGHTY_REL_RE), companion near-death (t71, 0/8 HP vs the Council Enforcer,
  location+foe color in the sentence). ★ toasts all fired; `coreMemories` = 3 clean one-liners.
- **v1.249 suggestion escalation at scale:** 101 Sonnet-authored suggestion calls; no invented
  scenery or canon-illegal casts observed in the sampled turns (contrast: 2 incidents in ~40
  turns pre-escalation).
- **Companion pipeline under the table parser:** recruit → PARTY_MEMBER → sheet-less warn →
  async sheet → XP mirror → **level 2 at t87 (toast)** — end to end clean.
- **REST:** an ordinary inn night at t49 → `[REST:long]` → "Spell slots restored."
- **Prose:** Abercrombie register byte-solid at t3 and t98 (same clipped rhythm, same dry bite).
- **Summarize:** 14 cycles across 100 turns, 10 chapters, tail retention healthy (~1.8k tk at end).

## Findings

| # | Finding | Sev | Notes |
|---|---|:---:|---|
| P2-F1 | **F3 quest-reopen reproduced TWICE, organically** — `Chapel in the Mud` completed t7 (+50 XP, archived) → re-emitted `[QUEST:…\|active]` at **t9** (2 turns later, unsteered) and again t60; still live at t100 while ALSO archived as completed. The upsert silently resurrects archived quests; the GM treats "narratively ongoing work" as reopenable. F3's engine guard (skip/warn when the title is already in `memory.quests`) should be **prioritized into the post-cutover batch** — it is not an edge case. | Med | Raw-tag trace in the corpus |
| P2-F2 | **Gold economy is not just thin — it is ZERO.** 100 turns, a paid healer doing commissioned work, **0 `[GOLD:]` tags emitted**, balance 40 gp start to finish. Also only 3 `[ITEM_*]` tags all run (#50a under-emission corroborated). #51 graduates from design note to measured defect. | Med | Quantifies #51 + #50(a) |
| P2-F3 | **Injected metadata round-trips into data** — t99 re-emitted the Guidance condition with the injected age echoed INTO the duration field ("concentration up to 1 min**; since t94**"). Harmless here (free-text field, upsert kept the original t94 stamp — the no-re-stamp test held live) but the pattern is real: canon-block formatting can be parroted back by the model into stored values. Watch; consider a stripped re-emission guard if it recurs. | Low | Also: spell-concentration state expressed as a condition NAME incl. target ("Guidance active on Corvath Denn") — condition-naming quality, adjacent to #50a provenance |
| P2-F4 | **No `offered` stage all run** — both quests entered the log as `active` directly (the party was already inside each crisis, so arguably correct), meaning the ⚑ opportunity toast never had a chance to fire. Not a defect; noted so the toast gap (P2 check #1) isn't misread as offered-toast failure. | — | Noted |

## What this run cannot claim

Single device (no sync/CAS exercise); fresh campaign (mature-save behavior is UA36's matrix);
no multi-enemy fight (UA26 builds post-batch); Sonnet only (the Haiku verdict already stands).

## Status updates driven by this audit

- UA1 post-cutover playtest: **PASSED** — reverse-shadow soak seeded with 101/0 on top of the user's live sessions.
- F3 (AUDIT_playtest_v1238): escalated — schedule the engine guard INTO the post-cutover batch.
- #51: hard data attached. #50(a): corroborated at scale.
- New cheap batch rider: quest completion/failed toast (+ same-response reward summary).
