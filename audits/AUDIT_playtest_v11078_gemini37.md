# AUDIT — playtest v1.1078, gemini-3.7-flash via the gateway — the first signed-in harness run

**Run.** 10 real GM turns after the opening, all committed (0 failed turns, 0 back-offs, about 3 s a turn), driven by a Sonnet runner through `__ptRunToTurn`.
- **Campaign:** the standard campaign (`samples/modeltestcampaign.blueprint`, tone `swords`, Howard voice, the Korrag template), as `camp_1790829718981_5756` (`modelTestCampaign_gemini37flash_v11078`).
- **Account:** the owner's account, signed in in the preview on the deployed site (server route, entitled admin).
- **Model:** gemini-3.7-flash through `/api/llm/gemini/…`.
- **Cost:** **$0.173**. 11 turn calls including the opening came to $0.169, and one summarize call to $0.004. The run used 210,191 input tokens, 3,970 output tokens and 0 cache reads.
- **Files:** corpus [`dev/corpus_playtest_v11078_gemini37.json`](../dev/corpus_playtest_v11078_gemini37.json); save `testRuns/modelTestCampaign_gemini37flash_v11078.tnd` (local, gitignored).
- **Commissioned by** the overdue scheduled playtest (`dev/schedule.json`, due 2026-09-15), and by the first run of the signed-in harness (owner: "sign in", 2026-09-30).
- **Judged by** Opus 5.5, which is on Fable-tier probation.
- **Cleanup:** `__ptDeleteRun()` deleted exactly the run's campaign. This device's copy went first, then the cloud copy, checked absent on the first attempt. The owner's other 6 campaigns are untouched (7 → 6 on the list).

**Verdict.** **The engine is healthy at v1.1078 on gemini-3.7-flash, and the run found one real defect: both interior scenes' soundscapes were refused.**
- **Clean:** every narrated effect landed as its tag, every invariant held, and in-band buttons rode all 11 responses. Memory summarizing fired once, and the story reads straight with the Howard voice intact.
- **The defect:** the GM wrote `enclosure=indoor`, which the vocabulary does not have, so the Iron Cauldron got no ambience (#488).
- **Harness:** the run also found two harness bugs. One was fixed mid-run; the other gave turn 5 a stale action.
- **Cost:** the run paid full price for every input token. The Gemini explicit cache (#334) is built, but its live switch is still off, as designed.

## Checks

| Check | Result | Evidence |
|---|---|---|
| Transport, the signed-in server route | ✅ | 11/11 responses, 0 errors, 0 back-offs; turns 1→10 took 27.5 s |
| In-band buttons (#328/#344) | ✅ **11/11** | `[SUGGEST:]` on every response; the console's `#328 in-band buttons used — no suggestion call` on every turn; no actions bucket in usage |
| Invariants | ✅ | HP 14/14 throughout. Gold 40 → 55 at t5 (`[GOLD:+15 gp]`, the purse) → 53 at t9 (`[GOLD:-2]`, the dagger). XP 0 → 50 at the quest close. `combat` set t1–t4 and cleared at t5 (`[ENEMY_SURRENDERS:]` + `[COMBAT_END:truce]`). sessionTokens 3,142 → 877 at t7 (summarize fired once). `errors[]` empty |
| Tag fidelity | ✅ | **Combat:** two `COMBAT_START` + `COMBAT_STATS`, `ENEMY_HP` ×4, `COMBAT_ROUND` 1–4. **Kadrun's death** was ONE canon transaction (`CANON_TXN_BEGIN/END` npc-death, `SCENE_DEATH`, `[NPC:…|dead]`). **Quests:** a close (`QUEST completed` + `ARC_COMPLETE`), then the next quest (The Gilded Cage). **Items:** `ITEM_GAINED` + `ITEM_DEF` for the token and the dagger. **Trade:** `WARES` ×2 and `WANTED`. **Places:** `LOCATION`, `SUBLOCATION`, `LOCATION_DESC` / `SIZE` / `HOURS`. **Rumor:** `WHISPER` at t8, which Torvan relays in the prose |
| Unknown-tag census (`dev/tag-census.js`) | ✅ | none. WORKING 0 · RARE 35 · NEVER 90 on this corpus alone |
| **SOUNDSCAPE (L7 audio)** | ❌ **6/8** | First live evidence for the tag; the v1.847 corpora predate it. Six `enclosure=open` were accepted. **Both interior scenes wrote `enclosure=indoor`** (t7, t10, the Iron Cauldron), and the console logged `[audio] soundscape refused: invalid enclosure` ×2. The note teaches `open/covered/sealed/unspecified`; "interior" is a *setting* value. → **#488** |
| Prose voice (Howard) | ✅ holding | **Early (t4):** "channeling all the fury of the northern wastes into a single cleaving arc". **Mid (t6):** "black chimneys belch greasy soot into the cold night air". **Late (t9):** "Good steel for a slit throat in the dark… ready for close slaughter." Pulp energy, a ruthless and competent hero, steady from t1 to t10 |
| Coherence: the dead-actor scan | ✅ | Kadrun dies at t4. Every later mention is his corpse ("lies lifeless", t5), loot from his neck (t5) or a rumor (t8); he never acts again |
| Coherence: thread and story | ✅ | The Valerius thread runs t1 → t10: the master, the viper token, the pits, then "If you hold Valerius's iron". The compiled story reads straight: ambush, kill, interrogation, the road south, the tavern, the way into the under-pits |
| Clock | ✅ | 6:12 pm → 9:11 pm; the two-hour road at t6 |
| Prose length | — noted | mean 735 characters a turn (531–1,058); sonnet-5 averaged 1,074 at v1.847. Length is not scored as quality |
| Cost and cache | ⚠ known | **0 cache reads.** The #334 explicit cache is built, but `GEMINI_EXPLICIT_CACHE=0` is pinned in the server's `fly.toml` (2026-09-24) and live enablement is pending (DOC/contracts/prompt.md §12). All 206,741 turn input tokens were billed at full price. Not a regression: turning the cache on is the cost lever |
| Harness: the run record | ❌ fixed | `__ptStart` read `char._campName` after `startGame` deleted it, so it refused to record the run. Refusing was the safe failure (nothing recorded, nothing deletable). The record was made by hand through the same `__ptRunRecord` check. Fixed in `056b989` (the battery now proves 11/11) |
| Harness: the action pool | ❌ fixed (next commit) | `waitForActions` takes the last four `.qa` buttons in the WHOLE story. On a three-button turn, the previous turn's last button joins the pool. At t5 the runner sent "Interrogate the pinned slaver leader." (a t3 button) after Kadrun died at t4. The GM handled it well: "beyond the reach of any question", and it turned to the living reaver. Fixed: the pool is now the newest narration's buttons only (`__ptLiveActions`, the way Car Mode's `_carActions` reads them), pinned by a test and a battery clause that restores the old read (12/12) |
| Wares button | ⚠ watch | After the dagger was bought at t9, the engine's fourth button still offered "Buy the Dagger (2 gp)" at t10, while Leather Armor (10 gp) was also for sale. A repeat purchase is legal; stays on the play checklist |
| Console noise (not run defects) | — | **Google's sign-in pages:** COOP report-only "would block the window.closed call" ×10 (the owner's sign-in popup). **The first checkpoint:** a PUT 404s by design before the server has the campaign; the client keeps the IndexedDB copy and retries. **The folder picker:** a scripted start cannot open it ("must be handling a user gesture"). **Presence:** refuse-and-warn for the unregistered "Slaver Reaver", by design. **#437:** the motivation extractor dropped "Korrag", by design |

## What graduates

- **TODO #488 (new):** the GM's `enclosure=indoor` soundscapes are refused, so interior scenes get no ambience on gemini-3.7-flash (2 of 2 interiors).
- **Harness:** both bugs are fixed. `__ptStart` reads the name before `startGame` (`056b989`), and the action pool reads the newest narration's buttons only (the commit after this audit).
- **`dev/schedule.json`:** the next playtest is due 2026-10-14.
- **Play checklist:** the wares button repeating a just-bought item, and prose length on Gemini, compared on the next Gemini run.
