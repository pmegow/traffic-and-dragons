# AUDIT — 50-turn grok arm, standard campaign (v1.637)

## Run

| | |
|---|---|
| **Commissioned** | Owner, 2026-08-15 — "run the grok arm"; fourth arm of the model sweep on the standard campaign. |
| **Provider / model** | grok / **grok-4.3** (`TAG_REINFORCE` active as for every non-Claude provider) |
| **Campaign** | `modelTestCampaign_grok` — pinned Korrag, started from `samples/modeltestcampaign.blueprint`; driven start-to-finish by the committed-turn driver (the gpt-4o lesson baked in from turn 1) |
| **Turns** | 50/50, ~9 min, zero errors, zero rate-limit backoffs |
| **Save / memento** | `testRuns/modelTestCampaign_grok.tnd`, `testRuns/modelTestCampaign_grok_memento.html` (turn 50: HP 14/14, 40 gold, 0 XP — frozen sheet) |
| **Corpus** | [`dev/corpus_playtest_v1637_grok.json`](../dev/corpus_playtest_v1637_grok.json) — 50 log + 50 raw + 0 errors |
| **Tokens / cost** | 108 calls: 662,836 in / **6,695 out** (~60 output tokens per call — the tersest arm by far). Unpriced in-app (MODEL_PRICING gap now covers gemini, gpt-4o, AND grok); rough sticker estimate ~$2. |

## Verdict

**grok-4.3 splits the axes a third way: genuinely decent story instincts wrapped around the worst tag discipline of the sweep.** It adopted the blueprint premise immediately (caravan ambush on screen from turn 0, referenced through t15), sustained a single coherent chase arc — the pit-slaver Theron Wyndfall hunting Korrag for forty turns — and passed the dead-actor test outright: told to dodge an attack from the man killed the turn before, it answered *"Theron Wyndfall lies dead at your feet… No attack comes from the corpse."* But **34 of 50 responses carried zero tags (68%)**, and the few that did were thin: ONE combat registration in a wall-to-wall-combat story (that lone "Slaver:12" foe then sat untouched in the combat panel for 48 turns — never damaged, never closed, the tracker faithfully wrong the whole run), no HP tag through six narrated woundings, no GOLD through repeated coin lootings, no XP through five kills. When grok does emit, the syntax is perfect (prose then a clean tag block) — the failure is frequency, not format. The summarize tier half-failed: extraction ran (the session marker advanced) but filed **zero chapters and zero events** — thin JSON that validated to nothing. Prose is short-form Howard pastiche — concrete, violent, momentum-driven ("You rip the longsword from its sheath, the steel hissing free") — closer to the voice than Sonnet, terser than Gemini, at ~371 characters a turn against the STYLE rule's no-cap intent; the story loops noticeably (strike/loot/demand-terms beats recur, partly the random picker's doing).

## Checks

| Check | Result |
|---|---|
| Turns / integrity | ✅ 50/50 committed-turn driver, no divergence, no backoffs |
| Zero-tag responses | ❌ **34 of 50 (68%)** — worst of the sweep; `TAG_REINFORCE` not holding on grok |
| Tag totals (50 turns) | ❌ DICE 8 · TIME_ADVANCE 4 · NPC 4 · QUEST_STEP 3 · ITEM_GAINED 2 · SAY 2 · COMBAT_START 1 — no ENEMY_HP/COMBAT_END/HP/GOLD/XP ever |
| Sheet drift | ❌ frozen at creation values through 6 narrated woundings, 5 kills, 2+ lootings |
| Combat panel | ❌ one foe registered t2, never touched, never closed — stale encounter open for 48 turns at save |
| Summarize | ❌ ran but filed NOTHING (0 chapters, 0 eventHistory; no failure strikes — thin-but-valid extraction that validated to zero durable writes) |
| Unknown/invented tags | ✅ 0 (census from `tag_table.js`) |
| Quest lifecycle | ⚠ one quest registered ("An Unwanted Reunion", active) — minimal but present |
| **Coherence ① dead-actor** | ✅ **passed live**: refused an attack from the corpse of Theron Wyndfall (t44), one turn after his death — the exact class Gemini failed |
| **Coherence ② thread-dropout** | ⚠ caravan t1–t15 then gone (mid-tier: adopted and used, then dropped after the ambush resolved) |
| **Coherence ③ story read** | ⚠ one continuous, causally-connected chase arc — coherent but repetitive (recurring strike/loot/parley beats; "the last slaver" recurs) and the world stays small |
| Prose voice (Howard) | ✅ genuine pastiche, concrete and driving — but clipped (~371 chars/turn, tersest of the sweep) |
| Ops | ✅ fastest arm (~9 min), no rate limiting |

## Sweep scoreboard (4 of 5 arms)

| Axis | gemini-3.5-flash | claude-sonnet-4-6 | gpt-4o | grok-4.3 |
|---|---|---|---|---|
| Tag discipline | ✅ excellent | ✅ excellent | ❌ collapsed (15 zero-tag) | ❌ worst (34 zero-tag) |
| JSON extraction | ✅ 6/6 | ✅ 8/8 | ✅ 5/5 | ❌ ran, filed nothing |
| Story coherence | ❌ failed | ✅ excellent | ⚠ premise never adopted | ⚠ good arc, drops premise t15, loops |
| Dead-actor obedience | ❌ resurrections | ✅ (untested by deaths; pushback shown) | ~ untested | ✅ passed live |
| Author voice (Howard) | ✅ strong | ⚠ partial | ❌ generic | ✅ strong but terse |
| Cost (50 turns) | ~$0.50 | $3.22 | ~$0.90 | ~$2 est |

**The emerging shape with four arms in:** only the Claude arm holds BOTH halves of the contract — tags AND story. Gemini holds tags but not canon-obedience; grok holds canon-obedience but not tags; gpt-4o holds neither. The parked canon-obedience/reinforce decision now has its full evidence base pending the optional ollama arm.

## Graduates / follow-ups

1. **MODEL_PRICING gap now three providers wide** (gemini, gpt-4o, grok) — one registry batch when verified prices are at hand.
2. **grok summarize-files-nothing** is a distinct failure shape (extraction "succeeds" thin, zero durable writes, zero strikes) — if grok ever matters, the extractor needs a minimum-content validation; noted, not filed as a row while grok is not a candidate tier.
3. Remedy decisions remain PARKED per the owner's ruling; the sweep lacks only the optional ollama arm.
