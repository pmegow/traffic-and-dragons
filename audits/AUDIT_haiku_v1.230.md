# Haiku Viability Audit — Runelords, 150 guided turns (v1.230)

**Purpose:** the exercise's main question is **cost** — can Claude Haiku 4.5 run the game well enough to be the subscription free tier? Secondary: **drift & hallucination** under a weaker model. **Apples-to-apples** with the v1.224 Sonnet run: same **Rise of the Runelords** blueprint, same party (**Vyrindra Emberveil** Sorcerer + **Victor Marlow** + **Peet**). Only the GM model changed. RAG **on** (v1.230 default). **Guided**, not random — I steered a directive-goal queue through the AP arcs (Festival → Glassworks → Thistletop → Skinsaw → Jorgenfist → Xin-Shalast/Karzoug → home), refilling at check-ins.

**Result:** ✅ **150 turns, 0 turn errors, 0 console errors.** Vyrindra leveled **7→8**, 5 quests opened & closed, the campaign ran the full arc under steering. Corpus: 150 raw GM responses + turn log (durable harness).

**Narrative export:** [haiku_narrative.html](haiku_narrative.html) — the full readable story export of this 150-turn window (the prose the numbers below were judged against).

---

## 💰 COST — the headline

**$2.82 total for 150 turns = ~$0.0188 / turn**, priced from `MODEL_PRICING` (Haiku 4.5: **$1.00 in / $5.00 out per MTok**, cache write 1.25× / read 0.10×; prefix-matched on `claude-haiku-4-5-20251001`, verified the lookup hits — no #30 $0 trap).

| Bucket | Calls | In (tok) | Out (tok) | Cost | Share |
|---|---:|---:|---:|---:|---:|
| **turn** (GM narration) | 151 | 1,496,062 | 131,082 | **$2.28** | 81% |
| **summarize** | 40 | 151,580 | 40,483 | $0.35 | 13% |
| **actions** (suggestion buttons) | 151 | 131,082 | 9,822 | $0.18 | 6% |
| **TOTAL** | 342 | — | — | **$2.82** | — |

**Prompt caching carried it:** 1,207,950 cache-read tokens vs 8,053 cache-write — the stable prompt half is written ~once and re-read every turn at 0.10×. Without caching the turn bucket would be several times higher.

**vs Sonnet (the v1.224 run):** Sonnet was **$0.0364/turn** ($1.82 / 50 turns); Haiku is **$0.0188/turn** — **~52%, about half.** *Note the gap is only ~2× despite Haiku's tokens being ⅓ Sonnet's price — because Haiku writes long (below), so it spends more output tokens per turn, eating into the per-token savings.*

**Cost read for the free tier:** a **complete 150-turn campaign costs ~$2.82** on Haiku. A heavy player at ~500 turns/month ≈ **~$9–10/mo** of API. That's the number to price a free/entry tier against. **Two cheap levers would cut it materially:** (1) a **brevity directive** (#12) — Haiku's ~2,700-char responses are ~2× Sonnet's, so trimming output ~40% drops the dominant `turn` bucket a lot; (2) **summarize fired 40× in 150 turns** (~every 3.75) — Haiku's long responses trip `SUMMARIZE_AT` fast; raising the threshold or tightening tail-retention reclaims most of the 13% summarize cost.

---

## Drift & hallucination — the model held the CONTRACT; the drift is in STATE-SYNC

**Tag discipline is strong — the load-bearing risk did NOT materialize.** Haiku emitted a rich, disciplined tag set across 150 responses (128 DICE, 61 COMBAT_START, 44 ENEMY_HP, 21 HP, 17 SPELL_USED, 24 QUEST_STEP, 11 QUEST, 11 XP, 20 NPC, and even the *advanced* ARC_COMPLETE ×5, ACT_COMPLETE ×1, FUTURE_EVENT_RESOLVED ×5, RETCON ×3). This is the gpt-4o failure mode's opposite — Haiku is a Claude and honors the state-tag contract without a `reinforce` block.

**Hallucination is LOW.** Accurate Runelords canon throughout (real AP NPCs — Tsuto, Aldern Foxglove, Lonjiku, Mokmurian, Karzoug — not fabricated names); **zero** prose self-correction/flailing phrases; 3 clean `[RETCON:]` corrections. Continuity actually held under pressure: at t150, when my epilogue steering pushed toward already-completed content, Haiku *refused to re-invent it* — "Mokmurian is already dead. We killed him weeks ago. Jorgenfist is cleared. The arc is finished" — correct long-range memory (if a touch meta). The Victor/Vyrindra romance was honored **and deepened** ("Beloved — deepening trust through vulnerability"); party stayed consistent (Victor + Peet) the whole run.

**The real cost of the smaller model is STATE-SYNC drift, not narrative quality:**

| # | Finding | Severity |
|---|---|:---:|
| **H1** | **HP recovery under-tracked — the sheet sat at HP:0 for 46/150 turns (31%).** Haiku reliably emits combat *damage* (`[HP:-X]`) but under-emits *recovery*: only 21 `[HP:]` + 3 `[REST:]` across a combat-heavy 150-turn run. So HP swings to 0 and only resyncs on an explicit rest — the sheet lies (HP:0 while the character reads in a library) for ~a third of the run. (Companion HP fared better — 29 `[COMPANION_HP:]`.) | **High** |
| **H2** | **Combat multi-enemy overflow.** 18/150 turns emitted **>1 `[COMBAT_START:]`** in one response (the engine holds ONE combat object → all but the last are lost) + **12 malformed named `[ENEMY_HP:Name\|-X]`** the parser (`[ENEMY_HP:-X]`) silently drops. So enemy-HP tracking / the combat panel desyncs in the frequent multi-enemy fights. Haiku *wants* to run swarms; the single-combat engine can't represent them. | **Med–High** |
| **H3** | **Location under-emitted — 21 `[LOCATION:]` over 150 turns** despite constant travel across the AP. Tracked `world.location` lagged the narration badly (stuck "Thistletop" for ~30 turns while the party was in Sandpoint), self-healing only on the next emission. GEOGRAPHY block goes stale. | **Med** |
| **H4** | **Verbosity.** ~2,700 chars/response avg (grew to ~2,976 mid-run, settled ~2,700) — roughly **2× Sonnet's ~1,300**. Not drift per se, but it inflates output cost and summarize cadence (H → the 40-summarize cost driver above). | **Med (cost)** |
| **H5** | **`[COMPANION_SPELL_USED:]` ×9 — a tag the engine does not parse.** Haiku diligently tracked companion spell casts with a tag `applyMuts` has no handler for (no-op). Harmless, and *ironically the exact tag the t308-era S1 finding said should exist* — Haiku emitting it unprompted is a signal to actually implement it. | Low |
| **H6** | **One large treasure award.** A single `[GOLD:+4500]` endgame haul (gold 47→5,347). Plausible for looting a runelord, but a big single number — mild economy inflation to watch. | Low |

---

## What this says about Haiku as the free tier

- **Narrative & rules-contract quality: green.** Haiku honors the tag grammar, keeps canon, maintains quests/arcs/relationships, and doesn't fabricate or flail. For a *free* experience this is clearly good enough — arguably indistinguishable to a casual player except in prose polish.
- **The gap vs Sonnet is mechanical sync, and most of it is fixable engine-side, not model-side:**
  - **H2** (multi-enemy / named ENEMY_HP) is an **engine tolerance** fix — loosen the `[ENEMY_HP:]` parser to accept a named/optional target, and/or let `worldState.combat` hold multiple foes. That would help Sonnet too.
  - **H1/H3** (HP-recovery + location under-emission) are **prompt-nudge** fixes — a Haiku-tuned reinforcement line ("emit `[HP:+]` on any healing/rest; emit `[LOCATION:]` on every move") — the per-provider `reinforce` slot exists for exactly this.
  - **H4** (verbosity) is the **brevity dial** (#12) — which *also* cuts cost.
- **Cost: viable.** ~$0.019/turn, ~half Sonnet, and two known levers (brevity + summarize cadence) cut it further. A turn-metered free tier on Haiku pencils out.

## Confidence — what this can and can't claim

- **Guided, not random** — the 150-turn full-AP traversal is a product of my steering; it says nothing about whether the engine self-drives. What it *does* show is Haiku's fidelity across a broad, combat-heavy, multi-arc campaign — a wide drift surface.
- **Single run, single party, fresh campaign.** The mature-memory recall property (the t308 win) wasn't tested here — 150 fresh turns barely exercise deep RAG recall. H1/H2/H3 are the carry-forward Haiku-specific defects; the tag-discipline and canon wins are the reassuring headline.
- **Cost is real, measured (not estimated)** from `worldState.usage` at Haiku's `MODEL_PRICING` rates, with caching accounted. Pricing basis stated above so it can be re-verified.
