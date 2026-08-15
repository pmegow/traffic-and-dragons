# AUDIT — 50-turn Sonnet arm, standard campaign (v1.636)

## Run

| | |
|---|---|
| **Commissioned** | Owner, 2026-08-15 — "run the sonnet arm"; second arm of the model sweep on the standard campaign (apples-to-apples ruling, /playtest skill ▸ Model-comparison runs). |
| **Provider / model** | anthropic / **claude-sonnet-4-6** (the production gameplay default) |
| **Campaign** | `modelTestCampaign_sonnet` — the pinned Korrag template, started from `samples/modeltestcampaign.blueprint` (skeleton generation SKIPPED; 3 acts / 8 NPCs loaded from the control) |
| **Turns** | 50/50, 0 harness errors, batch fired once, ~12 min drive |
| **Save / memento** | `testRuns/modelTestCampaign_sonnet.tnd`, `testRuns/modelTestCampaign_sonnet_memento.html` (turn 50: HP 5/14, 38 gold, 150 XP L1; 8 chapters; 11 NPCs) |
| **Corpus** | [`dev/corpus_playtest_v1636_sonnet.json`](../dev/corpus_playtest_v1636_sonnet.json) — 50 log + 50 raw + 0 errors |
| **Tokens / cost** | 110 calls: 790,138 in / 32,196 out / **1,097,365 cacheRead** / 10,865 cacheWrite — prompt caching healthy. **Actual cost $3.22** (priced via MODEL_PRICING). |
| **Baseline** | Judged against the gemini arm: `dev/corpus_playtest_v1635_gemini.json` + [AUDIT_playtest_v1635_gemini.md](AUDIT_playtest_v1635_gemini.md) |

## Verdict

**The inverse of the Gemini arm: Sonnet's story COHERENCE is excellent — the axis Gemini failed — while its Howard voice fidelity is audibly weaker than Gemini's.** The opening premise (the caravan) stays alive across the whole run — referenced in 18 of 50 turns spanning t1→t49, where Gemini dropped it after t7. The dead-actor scan found nothing to flag (this arm's story path produced no NPC deaths — the resurrection class therefore goes untested, not passed). Most tellingly, Sonnet actively *pushed back* on an impossible harness action: told to "signal Morwen before knocking" after the knock had already happened, it answered "You have already knocked. The moment for signaling has passed" — the canon-obedience behavior whose absence broke the Gemini narrative. Mechanically both arms are clean (0 zero-tag turns, 0 invariant breaks, 8 summarize cycles here vs 6). On voice: Sonnet's prose is high quality but drifts toward its own lean, psychological house style ("Big men who have broken other big men never do"; "a handler's proprietary touch") rather than Howard's grandiose physicality — consistent with the owner's live judgment on the Gemini arm that Flash renders the author voice more clearly. One genuine blemish: at t48 GM meta-reasoning leaked into displayed prose ("That was a reference to the delivery schedule, not the current hour. No time tag needed.---") — free-prose meta-commentary is invisible to cleanTxt's tag strippers.

## Checks

| Check | Result |
|---|---|
| Turns / harness errors | ✅ 50/50, 0 errors, no re-fire |
| Invariants (HP bounds, gold ≥ 0, XP monotonic) | ✅ 0 breaks (ends 5/14 HP, 38 gold, 150 XP) |
| Zero-tag responses | ✅ 0 of 50 |
| Summarize cycles | ✅ 8 (peak 2,693 tokens); extraction clean |
| Unknown tags | ✅ **0** — after correcting the census to use `tag_table.js` as the authority (see Corrections below) |
| Tag profile | SAY 128 (vs gemini 37 — far denser dialogue attribution) · TIME_ADVANCE 49/50 · DICE 21 · NPC 19 · QUEST_STEP 13 · SKILL_SUCCESS 9 · combat lighter (ENEMY_HP 4, no deaths) |
| **Coherence ① dead-actor scan** | ✅ no deaths occurred → no candidates; zero contradictions found |
| **Coherence ② thread-dropout** | ✅ caravan/merchant referenced t1,3,5,6,7,9,10,11,14,17,18,19,20,22,23,31,33,49 — the premise is load-bearing all run |
| **Coherence ③ story read** | ✅ compiled memento reads as one connected intrigue (caravan → Ashenveil underworld → Ratchwick/Valerius chain) with cause-and-effect intact; includes active pushback on an impossible player action (t25) |
| Prose voice (Howard) | ⚠ **Partial.** Strong concrete prose, but the register is Sonnet's own lean/noir style more than Howard's driving grandiosity; pastiche fidelity below the Gemini arm's by this audit's sampling AND the owner's earlier live comparison |
| Meta-commentary leak | ❌ t48: internal tag-reasoning printed in the narration ("No time tag needed.---"). One instance in 50 turns. Known class: free-prose meta is invisible to the tag strippers. Watch — second instance graduates it to a row |
| Console 503 | ⚠ Same unattributed, harmless 503 as the Gemini arm — now proven **provider-independent** (weakens the earlier "Gemini endpoint" guess; likely a local/Fly resource). Still no URL captured; still zero measured effect |

## Corrections to the Gemini audit (2026-08-15)

The Gemini audit flagged `SCENE_DEATH` and `LOCATION_SIZE` as **invented tags. That finding was WRONG** — both are legitimate registry vocabulary (`tag_table.js`: `SCENE_DEATH` is the W2 scene-referent death-evidence channel; `LOCATION_SIZE` is the documented first-visit size/travel tag, and Sonnet emitted it too). The census had been built from a hand-assembled list instead of the authoritative table. Consequences: Gemini's tag-fidelity grade *rises* (it used the death-evidence channel correctly at every kill), the "invented-tag habit" watch item is retired, and the audit protocol now derives the known-tag list from `TAG_TABLE` mechanically. The Gemini **coherence** verdict is unchanged — narrating dead men alive is wrong in any vocabulary.

## Sweep scoreboard (2 of 5 arms)

| Axis | gemini-3.5-flash | claude-sonnet-4-6 |
|---|---|---|
| Tag discipline | ✅ excellent | ✅ excellent |
| JSON extraction (summarize) | ✅ 6/6 clean | ✅ 8/8 clean |
| Story coherence | ❌ failed (resurrections, premise dropped t7) | ✅ excellent (premise alive t1→t49; pushes back on impossible actions) |
| Author-voice fidelity (Howard) | ✅ strong (owner: "clearer than sonnet") | ⚠ partial (house-style drift) |
| Blemishes | — | t48 meta-commentary leak |
| Cost (50 turns) | ~$0.50 est (unpriced in-app) | $3.22 actual |

## Graduates / follow-ups

1. TODO #22 sweep state updated (gemini ✅, sonnet ✅; gpt-4o / grok / ollama pending). Remedy decisions stay PARKED per the owner's ruling until the sweep completes.
2. Gemini-audit corrections applied in the same commit (invented-tag finding retracted there with a pointer here).
3. /playtest audit protocol: known-tag census now derives from `tag_table.js`, never from a hand list or the docs index.
4. Watch: the t48 meta-commentary leak — one instance; a second anywhere graduates it to a Known-issues row.
