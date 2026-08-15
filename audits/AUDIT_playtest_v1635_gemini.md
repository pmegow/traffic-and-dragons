# AUDIT — 50-turn Gemini playtest (v1.635)

## Run

| | |
|---|---|
| **Commissioned** | Owner, 2026-08-14 — "run a test campaign with the harness 50 turns in with gemini". Doubles as the **#22 Gemini tag-fidelity money turn** (parked since the provider bring-up; this is the first live multi-turn Gemini run). |
| **Provider / model** | gemini / **gemini-3.5-flash** (the PROVIDERS default) |
| **Campaign** | `modelTestCampaign_gemini` — Korrag, Northlander Human Warrior L1, Sword & Sorcery tone, **Robert E. Howard** prose voice, fresh skeleton (one review pass, "7 fixes") |
| **Turns** | 50/50 completed, 0 harness errors, batch fired once (no re-fire), driven by a Sonnet runner agent (~11 min drive time) |
| **Save** | `testRuns/modelTestCampaign_gemini.tnd` (turn 50; gitignored by convention) — end state: HP 3/14, 49 gold, 290 XP (L1), 101 transcript entries, 6 chapters, 8 NPCs |
| **Corpus** | [`dev/corpus_playtest_v1635_gemini.json`](../dev/corpus_playtest_v1635_gemini.json) — 50 log entries + 50 raw GM responses + 0 errors |
| **Tokens / cost** | 110 calls: 1,632,102 in / 20,631 out / 815,712 cacheRead (Gemini implicit caching reported through `parseUsage`). In-app cost shows **$0 — gemini-3.5-flash is unpriced in MODEL_PRICING** (110/110 calls counted as unpriced). Flash-tier estimate ≈ **$0.40–0.55** for the whole run. |

## Verdict (revised 2026-08-15 after the owner read the full narrative)

**Split verdict: Gemini 3.5 Flash has excellent tag SYNTAX and prose, but FAILED narrative coherence — it is not currently viable as a GM tier despite passing every mechanical check.** The mechanical half is real: across 50 turns, not a single zero-tag response (the gpt-4o desync class never appeared), `[TIME_ADVANCE:]` on all 50 turns, complete combat lifecycles, `[SAY:]` attribution, balanced `CANON_TXN_BEGIN/END` pairs, and 6 clean summarize extractions through Gemini's own JSON. The Howard voice held sentence-to-sentence from t2 to t50 — the owner judged it clearer than Sonnet's. But reading the compiled narrative end-to-end exposed what the per-turn checks masked: **the model writes state tags faithfully while contradicting injected state in its prose** — dead NPCs resurrected in narration (three times over), the opening premise dropped cold, scenes teleporting on action whiplash. The engine's guards kept the LEDGERS true (durable-dead refused every re-write; the sheet never lied); they could not make the storyteller read them. That obedience gap — not tag emission — is what separates Claude from Flash on this stack, and this run is the first hard evidence that the two capabilities are separable.

**Coherence evidence (owner-reported, corpus-confirmed):**
- **The slaver resurrection loop.** t19: Korrag executes the three captured slavers — `[NPC:Theron Wyndfall|dead]`, `[NPC:Cavin Tharwick|dead]`, `[NPC:Nolan Grimtide|dead]` all emitted. t20: the prose binds "the three **groaning** slavers" to a thornbush — alive again. t21: Theron, dead two turns, **shrieks "No, wait, Korrag!"** — and all three are killed a second time (same three dead-tags re-emitted). t22: killed a third time. The engine's durable-dead guard absorbed every duplicate write, so `worldState` stayed true throughout — the incoherence lived entirely in the narration layer, exactly where the canon-injection blocks are supposed to govern and where Claude models comply.
- **Harness amplification (confound, recorded honestly):** t19/t21/t22 all sent the identical suggested action "Execute the defeated slavers where they lie" — the random picker has no memory, and the affordance gate's dead-npc rule is blind to nameless references ("the slavers" names nobody). A human player would not re-tap a completed execution; the model still should not have accepted it against injected dead-state.
- **Caravan dropout.** The opening scene (slaver ambush on Korrag's merchant caravan) is referenced at t5 and t7 and then **never again in 43 turns** — no quest row anchored it, and the model's own long-context coherence did not carry it.
- **Scene whiplash.** t18 strides toward Ashenveil's gates; t19 is back at the crossroads with the slavers with no travel acknowledgment beyond "you turn your back".

The blemishes previously called minor stay recorded: two invented tags (stripped harmlessly, deaths dual-filed), an unattributed late-run 503 with no measured effect, and the unpriced-model $0 cost display.

## Checks

| Check | Result |
|---|---|
| Turns completed / harness errors | ✅ 50/50, `__pt.errors` = 0, no stall, no re-fire |
| HP within [0, maxHp] every turn | ✅ 0 breaks (ends 3/14 — dramatic but legal) |
| Gold ≥ 0, XP monotonic | ✅ 0 breaks (ends 49g / 290 XP) |
| Combat: UA26 `foes[]` shape, lifecycle closes | ✅ 15 combat-window turns, 6 `[COMBAT_START:]`, 9 `[ENEMY_HP:]`, 7 `[COMBAT_END:]` (one bare/auto-close overlap — tolerated by design), slain foes marked `down:"slain"`, panel state cleared after each encounter |
| Summarize fired and recovered | ✅ `sessionTokensApprox` peaked 2,813 and dropped ≥6× past `SUMMARIZE_AT` 2400; 6 chapters filed; **Gemini's JSON extraction produced zero parse failures** (the B11/B19 classes did not appear) |
| Zero-tag responses (gpt-4o desync class) | ✅ **0 of 50** — the `TAG_REINFORCE` block appears to be doing its job on Gemini |
| Tag vocabulary breadth | ✅ TIME_ADVANCE 50 · SAY 37 · NPC 36 · DICE 31 · QUEST_STEP 13 · COMBAT_ROUND 13 · CANON_TXN 12+12 · SKILL_SUCCESS 12 · QUEST 10 · NPC_PRONOUN 9 · XP 6 · LOCATION 6 |
| Invented tags | ~~⚠ Two: `SCENE_DEATH` ×10, `LOCATION_SIZE` ×4~~ **RETRACTED 2026-08-15: this finding was WRONG — both are legitimate registry tags** (`SCENE_DEATH` = the W2 death-evidence channel; `LOCATION_SIZE` = the documented first-visit size tag, which Sonnet also emitted). The census had used a hand-built list instead of `tag_table.js`; corrected in [AUDIT_playtest_v1636_sonnet.md](AUDIT_playtest_v1636_sonnet.md) ▸ Corrections. Net: Gemini's tag grade RISES — it evidenced every kill through the proper channel. Repeat dead-writes across turns (19/21/22, 34/35/39) were absorbed by the durable `npc.dead` guard. |
| Prose voice (Howard) early → late | ✅ Holding. t2: "Your blade leaps from its sheath with a harsh scream of steel… burst from the grey thorns like a wounded boar." t26: "The heavy iron warhammer smashes into your shoulder with a bone-jarring crunch." t50: "a sharp stench like scorched hair and sulfur." Concrete verbs, one image per sentence, relentlessly physical — no flattening detected. |
| Content-DNA (Howard) | ✅ Slaver ambush → corrupt city gate → pit enforcers → sorcerous branded beast: civilization-is-treacherous and malevolent-sorcery shapes both present; arcs resolving with tangible stakes |
| Suggestion pipeline | ✅ 0 fallback actions in 50 turns — the actions call returned valid buttons every turn on the active Gemini model |
| Console 503s (turns ~39–50) | ⚠ Recurring "Failed to load resource: 503", never in `__pt.errors`, turns never stalled, 0 suggestion fallbacks — so no measured player-visible effect. Source unattributed (network ring buffer had rolled over by audit time; most plausible: transient Gemini endpoint 503s on a call that succeeded on the page's next natural attempt). Recorded as a watch, not a defect. |

## Owner field verdict (2026-08-15)

Reading the live campaign, the owner judged the Howard voice **clearer on gemini-3.5-flash than on Sonnet**: "the author's voice is really coming through in the gemini version. It's actually a lot clearer than sonnet." That is a comparative claim this run wasn't designed to test (no same-seed Sonnet arm), but it is the first cross-provider prose-voice signal on record and it points the same way as the audit's own sampling. Candidate explanation: Sonnet's stronger house style may flatten author pastiche where Flash follows the style directive more literally. Follow-up shape if pursued: a same-tone/same-author A/B (the author_voice_lab #104 machinery generalizes to a provider axis).

## Honest negatives

- **Level-up path unexercised** — Korrag ended at 290 XP, 10 short of the L2 gate, so `checkLevelUp`/HP-gain/feature-grant never fired this run.
- **One voice, one tone, one class** — this validates Gemini's tag fidelity, not campaign-rotation coverage (#22's rotation half stays parked as ruled).
- **`MODEL_PRICING` has no gemini-3.5-flash entry** → Usage modal reports $0 for a run that cost real money. Registry-entry fix, safe-changes-map legal, but needs a verified price, not a guess.
- **503 source unattributed** — see checks table; if it recurs on a future run, capture `read_network_requests` *during* the run window.

## Graduates / follow-ups

1. **TODO #22 row updated in this commit** — the Gemini money turn is DONE (this audit is the record); gpt-4o / grok / ollama money turns remain parked until re-raised.
2. **MODEL_PRICING entry for gemini-3.5-flash** — small follow-up once a verified price is at hand (until then the unpriced-tokens display is honest about counting, silent about dollars).
3. ~~Watch: Gemini's invented-tag habit~~ **RETIRED 2026-08-15** — the "inventions" were legitimate registry vocabulary all along (see the retraction in the checks table); there is no invented-tag habit to watch.
4. **From the coherence revision — RULED 2026-08-15: both remedies PARKED until the full model sweep completes** (owner: "I want to run all the models first, then we can decide with more information"). The sweep = the remaining provider arms on the standard campaign (sonnet baseline, gpt-4o, grok, ollama as keys allow); decision revisits with all corpora on the table:
   - **Canon-obedience reinforcement for non-Claude providers** — a `reinforce`-style block ("injected state blocks OVERRIDE your own recent prose; a dead NPC never speaks or acts") in the gemini adapter, the same per-provider tuning channel that fixed gpt-4o's tag desync. ⛨ Drift surface → Fable design first; the prompt-channel-beats-position lesson says a NEW channel, not a louder sentence, is what changes model behavior.
   - **Harness realism: no-repeat picker** — the random action picker should refuse to re-send the previous turn's exact action (t19/21/22 sent the same execution three times). Small dev-only change; makes future corpora cleaner without hiding the model's obedience gap (t20's "groaning slavers" needed no repeat to be wrong).
   - **Affordance-gate honest limit recorded**: dead-npc-interaction cannot catch nameless references ("the slavers") — known boundary, not a defect to chase.
