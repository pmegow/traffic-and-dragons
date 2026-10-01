# AUDIT — playtest v1.1078, gemini-3.7-flash, the explicit cache ON — the #334 restoration check

**Run.** 10 real GM turns after the opening, all committed (0 failed turns, about 3 s a turn), driven by a Sonnet runner through `__ptRunToTurn`.
- **Why:** the owner ruled "Turn it on" (2026-09-30). The cache had been off since 2026-09-10 by mistake; see [the deployment receipt](DEPLOY_server_v1.7.1_2026-09-30.md).
- **Campaign:** the standard campaign (`samples/modeltestcampaign.blueprint`, tone `swords`, Howard voice, the Korrag template), as `camp_1790832568914_3836` (`modelTestCampaign_gemini37flash_v11078_cache`), on the owner's account through the server.
- **Server:** v1.7.1, Fly release v51, `GEMINI_EXPLICIT_CACHE=1`. **Client:** v1.1078, the same as the baseline.
- **Baseline:** [the flag-off run an hour earlier](AUDIT_playtest_v11078_gemini37.md), on the same campaign, character, model and client.
- **Tokens:** 212,995 in and 3,938 out over 13 calls. The 11 turn calls carried 208,026 input tokens, of which **149,754 were read from the cache**.
- **Cost:** the game's estimate is $0.175, the same as the baseline's $0.173. That estimate prices cached Gemini tokens at the full input rate on purpose (an upper bound), so it cannot show the saving. The invoice is the real check.
- **The day’s third run:** the #488 note check (9 turn calls, 170,279 input tokens, 122,526 of them read from the cache) is estimated at $0.139 on the same upper-bound pricing. The three runs of 2026-09-30 total an estimated $0.49, inside the weekly allowance.
- **Files:** corpus [`dev/corpus_playtest_v11078_gemini37_cache.json`](../dev/corpus_playtest_v11078_gemini37_cache.json); save `testRuns/modelTestCampaign_gemini37flash_v11078_cache.tnd` (local, gitignored).
- **Judged by** Fable 5.1.
- **Cleanup:** `__ptDeleteRun()` deleted exactly the run's campaign; the cloud copy was checked absent.

**Verdict.** **The cache works, and the game plays the same with it on.**
- **Cache:** one handle was created on the first call, and every one of the 11 turn calls read 13,614 tokens from it: 72% of the turn input, against 0% in the baseline.
- **Play:** the Howard voice, the buttons, the invariants and the story all held, and no engine state leaked into the prose.
- **One defect, not shown to come from the cache:** at turn 2 the GM wrote a death's two transaction markers without their brackets. The engine withheld the loot the prose described (a key and 8 gold), and the markers printed in the story (#491).

## Checks

| Check | Result | Evidence |
|---|---|---|
| **One handle, reused** | ✅ **11/11** | Every turn call read exactly 13,614 cached tokens (`healthLog`). Server receipts: one `candidate` and one `create` (ok, 13,614 tokens) at the first call; one row in `gemini_prompt_caches` |
| **Cached share of turn input** | ✅ **72%** | 149,754 of 208,026 tokens. Baseline: 0 of 206,741. The September measurement on a mature campaign was 30%: there the live half outweighs the cached half |
| The handle is shared across campaigns | ✅ (new evidence) | A second cache-on campaign ([the #488 note check](../dev/corpus_playtest_v11078_gemini37_488note.json), 9 turn calls) read the same 13,614 on every call and created no second handle. The cached half does not vary by campaign, so one handle-hour serves every campaign of an account |
| Transport | ✅ | 13 Gemini calls, all 200; no `[gemini-cache]` warning in the server log; 0 errors, 0 back-offs |
| In-band buttons (#328/#344) | ✅ **11/11** | `[SUGGEST:]` on every response; no suggestion call |
| Invariants | ✅ | HP 14/14. Gold 40 → 35 (the bribe, `[GOLD:-5]`) → 15 (`[GOLD:-20]`, the buckler and the axe). XP 0 → 100 (the boss milestone, t2) → 150 (the quest milestone, t3). `combat` set at t1 and cleared at t2. Summarize fired twice (t5 and t10). `errors[]` empty |
| Engine-state leak | ✅ | With the cache on, the live state travels in the user message as JSON. No response or narration contains `engineState`, a JSON fragment or an engine note |
| **Tag fidelity** | ❌ **t2** | The prose: "You tear an iron key from his belt… finding a purse of heavy coin". `[ITEM_GAINED:Iron Slaver's Key]` and `[GOLD:+8]` never landed: the final pack has no key, and the gold never rose. Cause: the row below. Everything else landed: NPCs with pronouns, the combat, the arc close, the next quest, three item definitions, the city, wares, hours, a resident, an exit, a whisper, two relationship changes |
| **Canon transaction markers** | ❌ **0/1 bracketed** | The GM wrote `CANON_TXN_BEGIN:txn_aldric_death_001|…` and `CANON_TXN_END:…` as bare lines. The engine's envelope match needs the brackets, so it saw a scene death outside a transaction, refused the claim, and withheld its quest and reward tags (console: "irreversible write QUARANTINED", "quest/reward consequence refused"). The death still landed through the combat close, and the GM re-sent the quest close at t3 (+50 XP), but not the loot. The two bare lines also printed in the story. → **#491** |
| Is the bare marker a cache effect? | ⚠ not shown | 60 of 60 transactions were bracketed across the 17 earlier corpora. That includes 3 of 3 in the September cache-on Gemini arm (v1.847, 2026-09-07). The second cache-on run today wrote its one transaction correctly. So: 1 slip in 5 cache-on transactions, 1 in 62 overall. Too few to blame the cache; watch the next cache-on runs |
| Unknown-tag census | ✅ | none. WORKING 0 · RARE 36 · NEVER 89 on this corpus alone |
| Soundscape | ✅ 2/2 | Both outdoor classifications were accepted. No interior was reached, so #488 was not exercised here; [its own live check](../dev/corpus_playtest_v11078_gemini37_488note.json) covers it |
| Prose voice (Howard) | ✅ holding | **t1:** "longsword clearing its scabbard with a hiss of cold steel". **t7:** "Good steel for a man who knows how to spill guts". **t10:** "pale as curdled tallow". As vivid as the baseline; no flattening from the state moving into the user message |
| Prose length | ✅ same | mean 705 characters a turn, against 735 in the baseline (same measure) |
| Coherence | ✅ | Aldric dies at t2 and never acts again (his corpse is searched at t3). The Valerius thread runs from t1 to the t10 reveal ("He calls himself the Shadow Alchemist now") |
| Wares button | ⚠ **2 of 2 runs** | The buckler was bought at t7; at t8 the engine's fourth button offered "Buy the Iron-Spiked Buckler (15 gp)" again. The baseline did the same with the dagger. The button offers the first ware on the list without checking the pack → **#492** |
| Suggestion gate | ⚠ false positive | "Show Aldric's arena token" was rejected as an interaction with the dead Aldric, and replaced with "Press on toward The Crossroads of Ashenveil." The verb's object is the token, not the man → **#493** |

## What graduates

- **#334:** restored and re-verified. The server's switch is pinned by a server test, and the stale docs that caused the mistake are corrected.
- **TODO #491 (new):** a transaction whose markers lose their brackets loses the player's loot and prints the markers in the story.
- **TODO #492 (new):** the wares button offers an item the hero just bought.
- **TODO #493 (new):** the dead-NPC rule misreads a possessive.
- **Watch:** bare transaction markers on the next cache-on runs; the invoice against the token counts.
