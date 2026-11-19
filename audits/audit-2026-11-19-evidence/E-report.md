# Lane E — memory.js (HEAD d7ed4ea6, v1.1451)

## 1. Coverage
- `memory.js` — read IN FULL, lines 1–3300 (all 3,300 lines, including the two very long lines 2298 `memoryTOC` NPC line and 2355 `memoryNpcDetail`). Nothing skipped.
- `DOC/contracts/memory.md` — read in full.
- Read for context only (to refute or confirm): `game.js` 2935–2965 (sendAction → summarize, `busy`), `game.js` 3120–3150 (`rerollLast`), `ui-campaigns.js` busy guards (grep), `storage-adapter.js` busy guard (grep), `state.js` memory reassignment sites (grep), `tag_table.js` 2120–2160 and the LOCATION writer (grep), `identity.js` 334–357 (`placeTimeline`), `clock.js` `parseStrictFutureDuration`/`scheduleAdd` heads, `helpers.js` `KEYED_STORE_PATHS` and the synopsis reader (4260–4273), `dev/tests-audit-sync.js` 456–511 (D6 tests).
- NOT read: the NPC-merge handler itself (identity.js / tag_table.js — outside this lane); only memory.js's merge-side helpers (`guestbookRekeyName`, `guestbookFoldRecords`, `fileNpcEvent` overfill) were reviewed.
- Probes (all under `audits/audit-2026-11-19-evidence/E\`): probe1-era-race.js, probe2-filing.js, probe3-namefold.js, probe4-perf.js, probe5-resolve.js, probe6-commitfail.js, probe7-deferred-kind.js, probe8-tail-null.js. Each runs in < 2 s.

## 2. Findings

### F1 (HIGH) — An era compiled for one campaign is written into whichever campaign is loaded when the model answers.
- File/function: `memory.js` `compileEraIfDue`, lines 2614–2635; called fire-and-forget from `summarize` line 3217.
- Code: `var resp=await callGM(eraCompilePrompt(due.sources),…);` then `eraApplyCompileResp(resp,due);saveMem();` — no campaign/world identity captured before the await, none checked after. (`summarize` itself is protected because `busy` is true and every campaign door in ui-campaigns.js refuses while busy; the era call outlives `busy` because it is not awaited.)
- Sequence: summarize succeeds → era call in flight → the turn ends (`busy=false`; e.g. the GM call errors fast, or the era model is slower) → player switches campaign (or the storage-adapter adopt at line 1011 swaps in a newer server copy) → era reply lands.
- Observed (REPRODUCED, probe1-era-race.js): campaign B (turn 7, no chapters) ends with `memory.eras=[{"summary":"Alpha era: Korrag fought in Ashfen…","turnRange":[1,200],…}]` and `saveMem` persisted it while `worldState.campId==="B"`.
- Consequences (READ): the ERAS block is the always-injected spine (api.js buildErasBlock) — the wrong campaign's history rides every B prompt; `eraCoveredEnd()` is now 200, so `eraNextSources` (line 2551, `arch[i].turn>end`) never compiles B's own chapters with turn ≤ 200; and the Quest Journal synopsis (helpers.js 4273, "an era replaced the chapters it covers") hides B's chapters ≤ t200 behind Alpha's era text. The merge branch (`eraApplyMergeResp`) has the same hole (merges B's two oldest eras into A's text).
- Remedy: capture `var w=worldState,m=memory` (or campId + a memory reference) before the await; after it, refuse (loudly) if `worldState!==w||memory!==m`.

### F2 (HIGH) — Distinct short facts and lore lines about one named person or place fold into one, because the near-duplicate fingerprint counts the entity's own name.
- File/function: `feNearDup` line 1489–1493 (`shared>=2&&shared*2>=Math.min(at.length,bt.length)`), used by `fileNpcKnowledge` 593–603 and `fileLore` 1450–1458.
- Mechanism: almost every fact about "Mara Voss" or "The Glass Spire" restates the name, which contributes 2 shared tokens. Any pair where the shorter fingerprint has ≤ 4 significant tokens therefore "matches"; the shorter text is spliced out and archived (`memory.archive` has no prompt read path).
- Input / observed (REPRODUCED, probe3-namefold.js):
  - Lore `["The Glass Spire was built by the elves.","The Glass Spire hums at midnight.","The Glass Spire is guarded by golems."]` → `memory.lore` keeps ONE line (`"The Glass Spire was built by the elves."`).
  - Knowledge "Mara Voss lost her left eye in the war." is archived as `foldedInto:"Mara Voss is the harbor master of Ashfen."`; `memoryNpcDetail` no longer mentions the eye.
  - Control: the same facts on a one-word name ("Hemlock") all survive.
- Refutation tried: #269①/⑤ state the fold is deliberate and that "a wrong fold on genuinely-distinct facts is therefore recoverable". That is the trade-off; the defect is that ordinary, non-paraphrase inputs hit it through the name tokens alone, silently (console.info only), on the injected tier.
- Remedy: drop the entity's own name tokens (the NPC key's `npcCoreTokens`; for lore, tokens shared by both lines that are a known NPC/place name) before the `shared` count, or require `shared` to exceed the name's token count.

### F3 (MEDIUM) — When anything fails after the extraction has been applied, the same window is re-filed on the retry (duplicate chapter, decisions, scene events).
- File/function: `summarize` 3215–3216 → `_sumCommit` 3152–3161; `applySummaryExtract` mutates `memory`/`worldState` in RAM before the commit; `fileDecision` (1463), `fileChapter` (2524) and `fileNpcEvent` (504, scene facts) do not dedupe.
- Trigger A — storage full (the D6 path): `saveLocal()` false → "this window is kept and will be filed again next turn"; RAM already holds the extraction. REPRODUCED, probe6-commitfail.js: after attempt 2 → `chapters 2, decisions 2, events 2`, eventHistory `["[T60] Korrag argued…","[T61] Korrag argued…"]`. dev/tests-audit-sync.js D6 tests only check the log is kept, never the retry.
- Trigger B — `retainSessionTail` (2476–2486) reads `u.content.length` unguarded, though `sessionTokens`/`buildExtractWindow` guard null content (the F8 entry guard). With a null-content entry in the newest pair: REPRODUCED, probe8-tail-null.js: `saveLocal calls 1, chapters 1, decisions 1, sessionLog 12, sessKept undefined, strike 1`, "Memory filing failed (Cannot read properties of null…)". The extraction is ON DISK, a strike is counted, the window is kept, and every later attempt re-files it; at strike 3 the catch-path `_sumCommit` calls `retainSessionTail` again and throws out of `summarize`. Reachability of a null entry in a live save: SUSPECTED (the F8 comment says such entries existed).
- Remedy: apply the extraction to detached clones and swap in only after `saveLocal` succeeds (or snapshot memory/worldState tiers and restore on a failed commit); guard `retainSessionTail` like `sessionTokens`.

### F4 (MEDIUM) — A model-supplied `supersededFacts.old` of a single space (or any short fragment) retires an unrelated live fact.
- File/function: `applySummaryExtract` 2792–2796: `if(String(sfNpc.knowledge[ki]).indexOf(oldS)>=0){sfIdx=ki;break;}` — guarded only by `!sf.old` (truthy), no trim, no minimum.
- Input: `{supersededFacts:[{name:"Mara Voss",old:" ",new:"Mara Voss sails at dawn."}]}`.
- Observed (REPRODUCED, probe2-filing.js 2a): knowledge `["Mara Voss commands the harbor watch.","Mara Voss owes the Guild nothing."]` → `["Mara Voss sails at dawn."]` — the first fact retired by the space, the second then folded away by the preferNew near-dup (F2's mechanism). Both archived; console warn only.
- Contrast: `resolveFutureEvent` has the E45 whitespace guard (1565) — supersede has none. resolveFutureEvent's one-letter needle (`"a"` removed "Rescue Ameiko from the Glassworks", probe 2b) is contract-documented (warns on substring), so reported here only as the same class.
- Remedy: trim `old`; require exact match, or a substring of at least N characters / a word-bounded match.

### F5 (LOW) — A scene-only fact deferred past the re-ask cap comes back as permanent "Knows" canon.
- File/function: `recordRegisterGuard` 3010–3011 and `recordDeferPush` 2999–3003: the queued row stores `kind:"knowledge"` and the text only; the job's `{fact,kind:"scene"}` shape is lost; on replay `set` pushes `{name, knowledgeGained:t}` (a string → durable).
- Observed (REPRODUCED, probe7-deferred-kind.js): a `kind:"scene"` line ("…stood by the ledger desk… at the moment") deferred at t80 files at t81 into `knowledge` (`["Mara Voss stood by the counting desk at the moment"]`), `events` empty — the t1549 stale-posture class #144B exists to prevent.
- Remedy: carry `scene:true` in the deferred row and rebuild `{fact,kind:"scene"}` in `set`.

### F6 (LOW) — A failing era compile is console-only and re-bills a call every summarize indefinitely.
- File/function: `compileEraIfDue` 2631–2633: `catch(eErr){console.warn(...)}`. `eraNextSources` returns the same oldest uncovered batch every time, so a batch whose compressed text deterministically fails `w6ValidateSummary` (or returns non-JSON) blocks every later era and costs one 600-token call per summarize, forever. Nothing reaches the player, `reportError`, or `healthIndicators` (helpers.js 3402 reads only `summaryFailure`). READ (not run: needs a real deterministic model failure; mechanism is visible in code).
- Remedy: a bounded strike on the batch, and a line in the drift-health anomalies.

### F7 (LOW) — Map edges dedupe on raw strings, so a pointer holding an alias records a second edge for the same pair.
- File/function: `fileLocation` 655–661: `prev` (the `from` argument or `worldState.world.location`) is never resolved; the dedupe compares raw `e.from/e.to`.
- Observed (REPRODUCED, probe2-filing.js 2e): with "Ashfen Town" registered as an alias of "Ashfen" and the pointer holding the alias, edges become `[{"from":"Ashfen","to":"Brindle"},{"from":"Ashfen Town","to":"Brindle"}]`, and `lastArrivalFrom` stores the alias.
- Refutation: `placeTimeline` (identity.js 342) resolves `[LOCATION:]` names, so the live parser's pointer is normally canonical; the comment at memory.js 666 ("a stale world pointer (older-device blob)") says alias pointers do occur. Readers resolve endpoints (`exitSiblingPlaces`, `resolveExitsAfterMove`), so impact is duplicate rows/growth, not wrong routing. Remedy: `locResolve(prev)` before the compare.

## 3. Monotonic resources (memory.js)
| Thing | Scope | Bound | Enforced? |
|---|---|---|---|
| `_npcTokMemo`, `_npcPossMemo` (name-token memos) | per session (RAM) | distinct strings passed (GM names, aliases, suggestion pool) | No — no eviction (comment calls it bounded by vocabulary) |
| `audioRefusalToastAt` | per session | distinct refusal-reason prefixes | Yes by key design |
| `ragRetrieve._memo`, `ragChapterRetrieve._memo/_entMemo`, `ragCarriedRetrieve._memo/_entMemo`, `ragKnownNames._memo` | per session | one entry each | Yes |
| `_gbPendingArrivals`, `_exitCreated` | per response | cleared at begin/commit | Yes (only if the post-handler seam runs) |
| `memory.npcs` records | per campaign | none (extractor `npcUpdates` and tags mint) | No (by design) |
| `npc.events` | per NPC | 8 (overflow → archive) | Yes |
| `npc.knowledge` | per NPC | 12 (overflow → archive) | Yes |
| `npc.aliases` | per NPC | none | No |
| `memory.lore` / `keyDecisions` / `futureEvents` | per campaign | 30 / 30 / 30 | Yes |
| `memory.chapters` / `worldState.eventHistory` | per campaign | 10 / 8 | Yes |
| `memory.archive.*` (chapters, lore, decisions, npcEvents, npcKnowledge, superseded, futureEvents, locationStates, retconPins…) | per campaign, forever | none | No — owner ruling 2026-09-16 (archives uncapped); `identityQuarantines` capped |
| `memory.eras` | per campaign | ~4,000 chars via merge | Yes (one merge per summarize) |
| `memory.map.nodes` | per campaign | none (every named place) | No (by design) |
| `memory.map.edges` | per campaign | distinct (raw) pairs — see F7 | Partly |
| `node.npcs` (display) | per node | NPC count | No |
| `node.guestbook` names / `turns` / `by` | per node | names unbounded; turns 8/name (`GB_TURN_CAP`, folded to agg) | turns yes, names no |
| `node.mentions` / `stateNotes` / `exits` / `wares` / `wanted` | per node | `NODE_MENTION_CAP` / `LOC_STATE_CAP` / 5 / size cap / `WANTED_CAP` | Yes |
| `memory.locations[k].visited` / `.notes` | per place | 50 / 5 | Yes |
| `memory.npcGraph.edges` / `factions` / `npcFactions` / `factionEdges` | per campaign | pairs / names | No |
| `worldState.stashMoves` | per campaign | 200 | Yes (loud) |
| `worldState.recordDeferred` | per campaign | 24 | Yes (loud) |
| `worldState.mergeHintNudged`, `recurringNameNudged`, `canonContraNudged` | per campaign | one key per pair/name ever | No (slow growth) |
| `worldState.pendingMergeHints` | per campaign | drained one per turn elsewhere | Not enforced here |
| `worldState.futureResolveHints` | per campaign | 3 | Yes |
| `transcript[].e` backfill | per entry | ≤12 names | Yes |
| Prompt growth: `memoryTOC` KNOWN NPCs (Table Talk), VISITED world places, KNOWN OF | per turn | none (world entries "always listed", contract #464/B2) | No — deliberate; 150 NPCs gave a 6,073-char Table Talk TOC in probe4 |

## 4. Affirmed (tried to break, could not)
1. Reserved words as keys: `fileNpcEvent("__proto__")`, `fileNpcEvent("constructor")`, `fileNpcKnowledge("toString")`, `fileLocation("__proto__")`, `fileLocation("hasOwnProperty")`, then `memoryTOC()` — all stored as plain keys, `({}).events` stays undefined, TOC renders (probe2 2c).
2. Campaign switch during `summarize` itself: `busy` is true across its awaits and all six campaign doors in ui-campaigns.js plus the storage-adapter adopt refuse while busy (only the un-awaited era call escapes — F1).
3. Commit ordering (D6): a failed `saveLocal` keeps the whole session log (probe6 attempt 1: sessionLog stays 12).
4. Name resolution: "Mara the Elder" vs on-file "Mara the Younger" and "Old Mara" stay apart; "Ashby" with two Ashbys is ambiguous and stays its own; "The Scarred Woman" is not "The Scarred Man"; "Tam's mother" is not "Tam"; "MARA VOSS"/"Mara  Voss." fold to the key (probe5).
5. Per-turn cost on a synthetic 150-NPC / 1,500-entry / 410-chapter / 300-node world (probe4, node on desktop): `resolveNpcName` 0.08–0.11 ms, `ragKnownNames` rebuild 0.75 ms, `memoryTOC(opts)` 8.2 ms (7.5 ms of it `blueprintKnownPlaces` scanning the transcript with `cleanTxt`), `ragRetrieve` 53 ms on a memo miss, `ragChapterRetrieve` 20 ms, `scanNpcNameVariants` 4 ms. No O(N²) blow-up at this size; budgets (RAG 2,400 excerpt chars, chapters 1,400, recorded facts 2,000, NPC detail 2,000/section) are enforced in code.
6. `resolveFutureEvent` with a whitespace needle does nothing (E45 guard).
7. `fileFutureEvent` / `parseStrictFutureDuration` with non-string `when`/`what` coerce without throwing.
8. Every `memory.npcs[...] = {…}` writer found by grep includes `knowledge` and `events`, so `memoryNpcDetail`'s unguarded `.length` reads do not throw on records the engine mints.

## 5. Undetermined
- "Hemlock the Younger" resolves onto a bare on-file "Hemlock", and "Captain Mara" onto "Mara the Younger" (probe5). This matches #503's stated rule (only a positive contradiction keeps names apart; a one-sided generation word is no contradiction) and #616 shape 3 is scoped to titled records, so not reported as a defect. Whether the owner wants the generation-word principle extended to untitled records is a ruling.
- If anything between `guestbookBeginResponse` and `guestbookCommitArrivals` throws outside the per-handler try (tag_table.js 2126–2263, not this lane), `_gbDeferArrivals` stays true; an out-of-parse `fileLocation` would then queue an arrival that the next `guestbookBeginResponse` silently clears (`_gbPendingArrivals.length=0`). Not run.
- `rerollLast` after a turn whose GM call failed right after a summarize re-rolls an already-extracted retained pair; the marker stays valid, so the replacement narration is never extracted. Product intent unclear (reroll never runs mutations by design).
- Whether `applySummaryExtract` can throw part-way on model input (after decisions are filed) — I could not find a model-controlled throw; non-model throws would duplicate decisions/scene events on the retry (same mechanism as F3).
