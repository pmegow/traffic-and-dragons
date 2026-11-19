# Lane B report — game.js (HEAD d7ed4ea6)

## 1. Coverage

- Contracts read in full: DOC/contracts/quests.md, DOC/contracts/combat.md, and the CLAUDE.md Conventions section.
- game.js is 4,716 lines and 423 KB. I read about 2,100 lines in full, chosen by the lens:
  - 1–110: startNodeStamp, startGame, atlasClassifyStart, upgradeModelFor.
  - 800–893: applySuggestionGate, generateActions.
  - 1153–1488: legacy draw, the level-up block (checkLevelUp, landOwedLevels, relevelOnLoad, resurfaceLevelUpOwed, spell unlock modal, companion auto-pick, healAbilitySheets, checkCompanionLevelUp).
  - 1571–1602: spellDefTag, canonizeCompanionSpellDefs.
  - 1828–2112: closeCampaign, the stash undo, swapPlayerCharacter (head), attach/generate/process companion sheets, the record seat, the archetype and stat-bump modals.
  - 2112–2291: sendSuggestedAction, core memory, inventory toast, condition snapshot.
  - 2648–3218: isBookkeepingResponse, commitGmTurn, the pending-action helpers, sendAction, preRollReveal, rollPendingCheck, reconsiderPendingCheck, retryLast, rerollLast, _attachGMErrorUI.
  - 3739–3880: draftStake, generateSkeleton, buildOpeningIntro, beginAdventure, _promptCampaignFolder.
  - 4028–4716: doRender, restSpells, checkpoints, the death and denouement flows, mpFall/rejoin, initAbilities/initSpells, sheet sync, quest review, Define item, synopsis, invDiffLines, syncCharSheet, newGame.
- NOT read: 110–800 (the suggestion prompt and scene-manifest helpers), 893–1153 (the [SAY:] speaker attribution), 1488–1571, 1602–1828 (the village and library adopters), 2291–2648 (the prose drift detectors), 3219–3739 (blueprint validation and application, the skeleton prompts) and 3880–4028 (the render request builders).
- Cross-file reads, done only to settle lens questions: api.js applyMuts head and the W2 clone swap (3400–3537); tag_table.js applyMutsTable (2116–2240); the four settles (atlas-directions.js, atlas-ground.js, item-kinds.js, atlas-public-region.js); ui-modals.js showStakeModal; ui-shell.js modalShell's Escape rule; ui-campaigns.js _applyLoadedCampaign; state.js checkpointHold/Capture; ui-panels.js (the Rest button).

## 2. Findings

### F1. The story-so-far recap is written into whatever campaign is loaded when its call returns (medium)

- **Where:** game.js `refreshSynopsis`, lines 4622–4631. It is fired by `maybeRefreshSynopsis` from sendAction's tail at line 3046.
- **Code:** `var resp=await callGM(synopsisPrompt(basis),…); worldState.synopsis=applySynopsisResp(resp,basis,reason); if(typeof saveCore==="function")saveCore();`
- **Why it can happen:** the call never sets `busy` (by design, line 4618). The campaign-switch doors refuse only while `busy` is set, so the player can load campaign B while A's recap is being written.
- **Failing sequence:** an arc completes in campaign A, the recap call starts, `busy` goes false at line 3062, the player loads campaign B, and the call resolves.
- **Wrong outcome:**
  - A's recap lands on `B.synopsis` and is saved through `saveCore()`.
  - `basis.spine` is stamped from B's own count (`synopsisSpineCount(worldState)` inside applySynopsisResp), so `synopsisDue(B)` reads false. B's journal keeps showing A's story until B's spine moves again.
  - A never gets its recap.
- **Status:** REPRODUCED. Script: audits/audit-2026-11-19-evidence/B\probe-switch.js. Output:
  ```
  busy during synopsis call: false
  A.synopsis: undefined
  B.synopsis: A's story: the hero of A slew the A-dragon. | B===worldState true
  ```
- **Remedy:** capture `var ws=worldState` (or its campId) before the await. After it, refuse when `worldState!==ws`, the way itemKindsSettle does at item-kinds.js:122 and `_renderJobLive` does for renders, and say so.

### F2. Death's arrival, and the final denouement, are silently dropped when a post-commit ask is still in flight (medium)

- **Where:**
  - game.js `deathSceneBegin`, line 4265: `setTimeout(function(){sendAction(deathArrivalDirective(),{silent:true});},0);`
  - `resolvePlayerDeath`, line 4248: `setTimeout(campaignDenouement,0)`.
  - The guards that drop them: `sendAction` line 2873 `if(busy||!worldState)return;` and `campaignDenouement` line 4330 `if(...||busy)return;`.
- **Why it can happen:** both are scheduled from inside `commitGmTurn` (line 2716), which runs inside sendAction while `busy` is still true. After the commit, sendAction awaits `atlasDirectionsSettle`, `atlasGroundSettle` and `itemKindsSettle` (lines 3041–3044). Each of these does a real model call when anything is owed. A zero-delay timer fires while those calls are pending.
- **Failing sequence:** a death turn whose reply also leaves a feature without a bearing, a place without a ground, or an item without canon. Any of these is common in a public-atlas campaign.
- **Wrong outcome:**
  - The arrival send returns at the busy guard with no message.
  - `commitGmTurn` line 2717 has already moved the stage from "arrive" to "question" in the same commit. So no "Death arrives" narration is ever written, and the player's next line is taken as their one question to a Death who never appeared.
  - On the fourth death, `campaignDenouement` returns silently. `sendAction` then refuses every turn ("This campaign has ended") and no denouement appears until a reload (ui-boot.js:466 retries it).
- **Status:** READ. I did not drive it in a browser. The ordering facts are certain: setTimeout(0) is a macrotask, the settles await network calls, and the busy guards return without a message. Nothing in dev/ pins the arrival send (only deathArrivalDirective's text is tested, at engine-tests.js:2923).
- **Remedy:** queue the arrival or the denouement on a flag that sendAction's tail runs after `busy=false`, or have each of them retry or wait while `busy` is set. Never drop them silently.

### F3. A companion's sheet started in campaign A is attached to, and its spell canon applied to, campaign B (medium)

- **Where:** game.js `generateCompanionSheet`, lines 1966–1976. It is fire-and-forget: started by processPendingCompanionSheets at commit, and by migratePendingCompanionSheets on every campaign load.
- **Code:** after `await callGM(...)` it calls `canonizeCompanionSpellDefs(resp,…)`, then `attachCompanionSheet(npcName,sheet)`, which looks the name up with `wsNpcByName` in the CURRENT world, then `saveAll()`. There is no campaign check.
- **Failing sequence:**
  - A's party member "Bram" is pending a sheet when the player switches to B.
  - If B has a sheetless party member named Bram, A's model sheet, written from A's memory, is attached to B's Bram and saved.
  - Even when B has no Bram, `canonizeCompanionSpellDefs` has already run `applyMuts([SPELL_DEF:…])` against B, so A's invented spell canon lands in B.
- **Status:** REPRODUCED (same script as F1, part 2). Output:
  ```
  C Bram sheet: false
  D Bram sheet: true | D===worldState true
  toasts: [..., "Bram's sheet drawn up."]
  ```
- **Remedy:** capture the world before the await and drop the result loudly when it changed. A's flag survives, so A regenerates on its next load. Run the canonize step only after that check.

### F4. A companion-sheet reply can run any game tag through the full parser (medium)

- **Where:**
  - game.js `spellDefTag`, line 1583: `return parts.join("|").replace(/\]/g,"")+"]";` — this strips only `]`, never `[`.
  - `canonizeCompanionSpellDefs`, line 1593: `applyMuts(tags.join(""))` — no `allow` list.
- **Failing input:** a model-written spell def with `effect:"a spark [GOLD:+500 [LOCATION:The Moon"`. It builds `[SPELL_DEF:…|effect=a spark [GOLD:+500 [LOCATION:The Moon]`. The LOCATION handler's regex then finds `[LOCATION:The Moon]` inside it.
- **Wrong outcome:** the party is moved by a utility call. This is the same hallucination class #264 closed for Suggest-completion and Define-item (globals.js:92); the companion-sheet path never got the whitelist.
- **Status:** REPRODUCED. Script: audits/audit-2026-11-19-evidence/B\probe-spelldef.js. Output:
  ```
  built tag: [SPELL_DEF:Zorblax Flicker|tier=1|effect=a spark [GOLD:+500 [LOCATION:The Moon]
  location Ashfen -> The Moon
  ```
- **Remedy:** `applyMuts(tags.join(""),{allow:["SPELL_DEF"]})`, and strip `[` as well as `]` in spellDefTag.

### F5. The Rest button is not busy-gated, so a rest can land mid-turn and the clock can roll twice (medium)

- **Where:**
  - ui-panels.js:466: `<button onclick='restSpells()'>Rest (restore mana)`.
  - game.js `restSpells`, lines 4187–4214: no `busy` check.
- **Contrast:** `undoLastItemMove` (line 1885) and every campaign door check `busy`.
- **Failing sequence:** the player sends "We make camp" and clicks Rest while the reply is in flight.
  - The button path lands owed levels (the milestone modals open mid-turn), heals, rolls the clock to dawn (`clockSleepRoll`), saves and takes a checkpoint of a half-turn.
  - The reply's `[REST:long]` handler (tag_table.js:1549) then calls restSpells again and rolls the clock to the NEXT dawn, a lost day. clock.js:192–193 claims the two rest paths "can never double-roll". That holds only when they cannot interleave.
- **Status:** READ. Not run.
- **Remedy:** `if(busy){showToast("Finish the current turn first.");return 0;}` for the button path. The tag path (fromTag) runs inside the turn and must stay unblocked.

### F6. Re-rolling a refused turn installs real narration whose tags are never applied (medium)

- **Where:**
  - game.js `rerollLast`, lines 3138–3168: no applyMuts, by design ("no muts").
  - `commitGmTurn`, lines 2687–2699: a refusal commits with every tag withheld. Its toast tells the player to "re-roll or rephrase".
- **Failing sequence:** the model refuses, the player presses re-roll, and the re-roll narrates the beat with `[ITEM_GAINED:]`, `[LOCATION:]` and so on.
- **Wrong outcome:**
  - The transcript entry loses its `rf` mark (line 3157) and becomes canon prose.
  - `sessionLog` stores the raw, tagged reply (line 3141), so the GM reads its own tags as applied. None ever were: nothing was applied for the refusal, and nothing is applied for the re-roll.
  - For an ordinary turn, the "no muts on re-roll" trade-off is deliberate: the original tags did land. For a refusal it means the canonical scene and the state disagree, with no message.
- **Status:** READ.
- **Remedy:** when the entry being replaced is a refusal (`rf`), commit the replacement through the commit path, or at least warn that its state changes did not land.

### F7. A roll whose send fails is lost on reload; the check is already deleted and nothing tells the GM (low)

- **Where:**
  - game.js `rollPendingCheck`, line 3082: `delete worldState.pendingCheck`. Line 3092: `saveAll()`. Line 3094: `sendAction(r.note,{silent:true,…})`.
  - sendAction's catch, line 3059: `if(!_mpResolve&&!(opts&&opts.silent)){…savePendingAction(txt);}` — silent sends are never persisted.
- **Failing sequence:** roll, the network fails, reload before pressing the error bubble's Retry.
- **Wrong outcome:** the saved world has no pending check, no `checkAnsweredPing`, and no pending action. `lastAction` is page memory only. The die's result, and any limited ability it spent (line 3084), never reach the GM, and no message says the roll was lost.
- **Status:** READ.
- **Remedy:** persist the roll note and its `[DICE:]` tag as the pending action for silent roll sends. Or restore `pendingCheck` when the send fails before commit.

### F8. Sending with a pending check lapses the check even when no turn is sent (low)

- **Where:** game.js `sendAction`, line 2884: `if(worldState.pendingCheck&&!(opts&&opts.silent))checkLapseToAction(txt);`
- **Why:**
  - The call runs before `var txt=…` at line 2888, so `txt` is undefined there by hoisting and the console line logs an empty action.
  - It also runs before the empty-input return (2888), before the Table Talk branch (`isTT`, 2911) and before the level-up early return (2908).
- **Wrong outcome:** an empty Send, a Table Talk question, or an owed milestone modal deletes `pendingCheck` and arms the "check answered" note with no story action behind it.
- **Reach:** the roll modal blocks the composer, so this is reachable mainly in Car Mode, where the modal is skipped.
- **Status:** READ.
- **Remedy:** move the lapse after `txt` is set and non-empty, and after `isTT` is known (story turns only).

### F9. generateActions' stale-result guard compares turn numbers across campaigns (low)

- **Where:** game.js `generateActions`, line 830 `var turnAt=worldState.turn;` and line 847 `if(worldState.turn!==turnAt)throw new Error("stale");`.
- **Why it can happen:** the suggestion call is often still in flight after sendAction clears `busy`, so a campaign switch is allowed meanwhile.
- **Wrong outcome:**
  - If B's turn number equals A's, A's suggestion buttons are written into `B.lastActions`, and the `finally{saveAll()}` saves them. B's reload then attaches A's buttons to B's newest narration.
  - A was snapshotted with the E26 null, so A reopens without buttons.
- **Status:** READ.
- **Remedy:** compare `worldState.campId` (or the world object) as well.

### F10. lastAction and lastActionOpts survive a campaign load (low)

- **Where:** reset only in game.js `startGame` (line 26, audit E83). ui-campaigns.js `_applyLoadedCampaign` (242–251) and state.js do not reset them.
- **Wrong outcome:**
  - After loading B, Car Mode's retry row (ui-carmode.js:93 → retryLast) would send A's last action into B. If it was a roll, it would be sent silently with A's `[DICE:]` record.
  - Any prompt built in B before B's first action uses A's text as its retrieval query (api.js:2710, 2716, 2721 — for example a Render or a suggestion rebuild).
- **Status:** READ. The exposure is small: the topbar Retry button no longer appears in index.html.
- **Remedy:** reset both wherever the world is replaced, not only in startGame.

### F11. The player's line and the turn bump are written before the "mutated" latch (low)

- **Where:** game.js `commitGmTurn`, lines 2676–2678 (`logTranscript("player",…)`, `worldState.turn++`), then applyMuts (2700), then `o.onMutated()` (2708).
- **Failing sequence:** applyMuts throws outside its per-handler try blocks — in the post-handler tail of applyMutsTable (stampQuestCompletion, clock reconcile, split fold, deferred combat clear) or in the W2 code in api.js. `_committed` is then false, and sendAction offers Retry and saves the pending action.
- **Wrong outcome:** a Retry logs the player line a second time and increments the turn again. Handlers that already ran are applied twice.
- **Status:** SUSPECTED. I found no concrete throwing input. A probe that makes stampQuestCompletion throw would settle it.
- **Remedy:** latch `_committed` before the transcript write (it is the first permanent write), or roll back the player line and the turn in the catch.

### F12. The campaign-folder banner can be added twice, and the second copy's buttons are dead (low)

- **Where:** game.js `_promptCampaignFolder`, lines 3853–3864. It runs on every successful beginAdventure and appends a banner with fixed ids `folder-yes` and `folder-no`. There is no check for a banner already present.
- **Failing sequence:** start a campaign, ignore the banner, then New Game → start another.
- **Wrong outcome:**
  - `getElementById` wires the FIRST banner's buttons again, so the second banner's buttons do nothing.
  - "Set folder" on the first banner calls `setCampaignFolder()` twice.
- **Status:** READ.
- **Remedy:** return early when a banner already exists; give it an id.

## 3. Monotonic resources

| Resource | Scope | Bound | Enforced in code? |
|---|---|---|---|
| `_sheetGenInFlight` (keyed by NPC name) | session | the party members in flight; deleted after each call | yes |
| `worldState.levelUpOwed[<hero name>]` (`_luOwed` creates an empty `{bumps:0,spells:[]}` on every read) | campaign | one entry per hero name ever played; entries never pruned | no, but small |
| `character.coreMemories` / `charSheet.coreMemories` | campaign / portable | `CORE_MEMORY_CAP` (25) | yes |
| `memory.archive.coreMemories` (receives every eviction) | campaign, forever | none | no — deliberate "cold storage" (comment at 2165), but unbounded |
| `worldState.legacyCharsUsed` | campaign | library size | effectively |
| `worldState.mpFallen` | until the next camp | party size; drained by mpRejoinFallen | yes |
| `rollPendingCheck` guard timer (setTimeout, 20 s) | per roll | one; cleared by `end()` | yes |
| `deathSceneBegin` / `resolvePlayerDeath` / `closeCampaign` / `endingDecide` setTimeout(0) | per event | one-shot | yes (but see F2) |
| doRender toolbar listeners (mouseover/out/click on per-render buttons) | per render | die with the render's DOM node | yes, by DOM removal |
| `_promptCampaignFolder` banner (DOM) | session | one per campaign start while neither button is clicked | no (F12) |
| generateActions button rows (DOM) | per turn | the story log's own pruning (outside this lane) | not determined |
| Checkpoint snapshot (`_checkpointMem`, IndexedDB slot, server slot) | campaign | one slot, overwritten per camp | yes |
| `worldState.synopsis` | campaign | one record, overwritten | yes |
| `worldState.checkWithdrawnPing` / `checkAnsweredPing` / `presencePing` and the other pings | campaign | one each, overwritten | yes |
| `sessionLog` | campaign | summarize at `SUMMARIZE_AT` | yes (outside this lane) |

## 4. Affirmed (tried to break, could not)

1. The `startGame` stake modal cannot strand `busy=true`: it opens with `wireClose:false`, and modalShell disables Escape for that (ui-shell.js:164). Every exit is Begin or Skip, and both call `_forge`.
2. The post-commit settles all write guards. atlasDirectionsSettle and atlasGroundSettle check `atlasDiscoveryCurrent(context)`; itemKindsSettle checks `worldState!==ws`; all are wrapped in try. One failing ask does not stop the next, and they cannot write into another world. They also run under `busy`, which the campaign doors respect.
3. `rollPendingCheck` cannot double-roll: `pendingCheck` is deleted synchronously before any await, and the function returns when it is gone or `busy` is set.
4. `rerollLast` restores both popped sessionLog entries on failure (line 3183) and clears `busy` on both paths.
5. `beginAdventure`'s E82 latch: after `_openingCommitted` is set, no Retry is offered, so a retry cannot double-apply starting gold or NPCs.
6. `checkLevelUp` and `checkCompanionLevelUp` are idempotent on reload: `relevelOnLoad` runs them before every turn, and with no new XP `newLvl<=level` returns at once. Owed picks are durable on worldState, keyed by hero.
7. `doRender` cannot leave `_rendering` raised: it is cleared in `finally`. Every await is checked with `_renderJobLive`, and the portrait write checks both the campaign and the character.
8. `deathSceneChoose("back")` on a refused restore leaves the death scene intact and says why (lines 4297–4301).

## 5. Undetermined

- `pickArchetype` (2069–2074) pushes ability rows with exact-name dedupe instead of `abilityGrant`'s family rule (#507). quests.md calls abilityGrant "THE level-row grant". `healAbilitySheets` removes any double on the next turn, so I could not tie this to a lasting wrong outcome.
- Whether applyMutsTable's unisolated tail or the W2 code can throw on a real reply (decides F11).
- Whether the story log prunes old narration nodes, which decides the bound on per-turn button DOM.
- Whether the W2 clone swap in applyMuts (api.js:3508, which replaces the global `worldState` with a clone on commit) can strand a reference held across applyMuts elsewhere. Nothing in the game.js functions I read holds one, but I did not audit the other files.


---

# Addendum — remaining ranges

## A0. Coverage (addendum)

- Now read in full: game.js 110–800, 893–1153, 1485–1571, 1602–1828, 2291–2648, 3219–3739 and 3879–4028.
- With the first pass, game.js is read in full except 2047–2049 (the archetype card markup, which comes from the class bible).
- Cross-file reads to settle questions:
  - api.js 1055–1072 (the DEATH SCENE block and the death note) and 1842–1846 (the location-filing note text).
  - tag_table.js 585–590 (DOWNED_RESOLVED).
  - identity.js 47–58 (identitySheetIssue/Admit).
  - The engine-tests case for detectLocationFilingCue (engine-tests.js 15188–15202).

## A0b. F2 settled by a headless probe — REPRODUCED

- **Script:** audits/audit-2026-11-19-evidence/B\probe-f2-death.js
- **What it runs:** the real `sendAction` → `commitGmTurn` → `resolvePlayerDeath` → `deathSceneBegin`, with a camp taken first.
- **Stubs:**
  - `callGM` returns `[DOWNED_RESOLVED:dead|a blade]` on the first call and the arrival prose on the second.
  - `atlasDirectionsSettle` awaits a real `setTimeout` of `settleMs` milliseconds, standing in for a model call.
  - The other two settles are no-ops.
- **Output:**
  ```
  RESULT {"settleMs":0,"modelCalls":["[ENGINE NOTE — PLAYER DOWNED (not a play","[ENGINE — DEATH ARRIVES (not a player ac"],"stage":"question","deathPending":false,"busy":false}
  RESULT {"settleMs":100,"modelCalls":["[ENGINE NOTE — PLAYER DOWNED (not a play"],"stage":"question","deathPending":false,"busy":false}
  ```
- **Verdict:** confirmed. When a post-commit settle awaits anything that resolves on a macrotask (every real model call), the deferred DEATH ARRIVES send hits `if(busy||!worldState)return;` at game.js:2873 and is dropped with no message. `worldState.deathScene.stage` is left at `"question"`. The player's next free-text line then becomes the one question, put to a Death who never arrived.
- **Where the stage moves:**
  - `deathSceneAdvance` (game.js:4279–4283) sets `"arrive"→"question"` and `"answer"→"choose"`.
  - Its only caller is `commitGmTurn` at game.js:2717, which runs right after `resolvePlayerDeath` (2716) in the same commit. So the death turn's own commit moves `"arrive"` to `"question"` before the arrival send is even scheduled.
  - `"question"→"answer"` is set by `buildDeathSceneNote` (api.js:1071) while the next non-silent prompt is built.
- **Side effect, A9 below:** the stage is never `"arrive"` when any prompt is built.

## A-Findings

### A1. The location-filing watcher captures phrase fragments as place names, and the engine note then asks the GM to file them (medium)

- **Where:** game.js `detectLocationFilingCue`, line 2516: `sent.match(/\b(?:enter…|through)\b[^.!?]{0,45}?\b((?:[A-Z][A-Za-z'’.-]*\s+){0,3}(?:chamber|hall|tunnel|vault|fortress|citadel|keep))\b/i)`.
- **Why:** the trailing `/i` flag makes `[A-Z]` match any letter, so the "Title-Cased name" clause accepts any three words before the noun.
- **Failing inputs and captured "places":**
  - "You step through the doorway into the great hall." → "into the great hall"
  - "You walk through the old keep and into the long hall beyond." → "old keep"
  - "We pass through the narrow tunnel…" → "narrow tunnel"
  - "Inside the chamber…" → "chamber"
- **Wrong outcome:**
  - observeDriftAxes arms `locationFilingWatch` with that string and counts every untagged turn after it (line 2621).
  - After `LOCATION_FILING_TURNS` (8) it sets `locationFilingPing.place`. buildLocationFilingNudge (api.js:1844) then tells the GM to "emit [LOCATION:into the great hall]" or [SUBLOCATION:…].
  - A compliant GM files a junk map node. This is drift-surface data, the map.
- **Status:** REPRODUCED. Script: audits/audit-2026-11-19-evidence/B\probe-cue.js. Output:
  ```
  "You step through the doorway into the great hall."  ->  "into the great hall"
  ping: {"place":"into the great hall","firstTurn":6,"turn":13}
  ```
- **Existing test:** the engine test (engine-tests.js:15188) pins only the Jorgenfist world-node path and its negatives, never this generic fallback.
- **Remedy:** drop the `/i` for the name group (match the verbs case-insensitively in a separate step). Or require a real capitalised word, never the article or a preposition. Or have the fallback name no place and ask the GM to name it.

### A2. A blueprint whose NPC is nameless, blank, or named with "|" is admitted to the roster (medium)

- **Where:** game.js `validateBlueprint` (3219–3301) never checks `npcs[i].name`. `applyBlueprint` (3562–3575) then admits through `identitySheetAdmit`, which finds no claim for an empty name.
- **Wrong outcome:**
  - Roster rows `{name:undefined}` and `{name:""}`, with `memory.npcs["undefined"]` and `memory.npcs[""]`.
  - A row named `Bram|Kitchen`. "|" is both the tag field separator and the location-key separator, so no `[NPC:]` tag can ever address that NPC, and every regex built from the name splits it.
  - Custom classes refuse "|" (line 3267); NPCs do not.
  - `__proto__` is harmless here: memory.npcs is null-prototype.
- **Status:** REPRODUCED. Script: audits/audit-2026-11-19-evidence/B\probe-bp.js. Output:
  ```
  CASE npc with no name | validate: null | applied; roster +2 [null,""]
  CASE npc name with pipe | validate: null | applied; roster +1 ["Bram|Kitchen"]
  ```
- **Remedy:** in validateBlueprint, refuse a missing or blank NPC name and a name containing "|" or "]", with the reason.

### A3. A null entry in a blueprint's lists throws instead of being refused with a reason (medium)

- **Where:**
  - `"locations":[null]` and `"npcs":[null]`: applyBlueprint dereferences `loc.name` (3586) and `n.name` (3564/3514).
  - `"acts":[null]` and `"arcs":[null]`: validateBlueprint dereferences `a.title` (3228) and `a.arcs[j].title` (3230).
  - normalizeBlueprint keeps null entries; it only guards `bp.acts[_ai]&&`.
- **Wrong outcome:**
  - applyBlueprint runs inside startGame (line 39), before `saveAll()` and `showGame()`. A throw there aborts startGame halfway: `worldState` is replaced, the companions are pushed, nothing is saved and no game is shown. The message is a raw TypeError.
  - The normalizer comment (3335) says the cloud-library path skips validateBlueprint, so that path reaches applyBlueprint directly.
- **Status:** REPRODUCED (same probe as A2). Output:
  ```
  CASE null location | validate: null | APPLY THREW: Cannot read properties of null (reading 'name')
  CASE null npc | validate: null | APPLY THREW: Cannot read properties of null (reading 'name')
  CASE null act | validate: "VALIDATE THREW: Cannot read properties of null (reading 'title')"
  ```
- **Not determined:** what the wizard caller shows when startGame throws.
- **Remedy:** drop or refuse non-object entries in normalizeBlueprint, and make validateBlueprint return the reason.

### A4. The live render's prompt writer is sent the whole raw game history, and its output is shown to the player (low)

- **Where:** game.js `doRender`, line 4048: `callGM(rp,_wsys)` on the live path. The history option is not suppressed, so callGM sends the gameplay sessionLog.
- **What that history holds:** every user half carries the engine notes (sendAction line 2973, `apiTxt`), and every assistant half is the raw reply with its hidden tags. Some of that is GM-only: NPC notes, secrets in tag operands, quest-escalation and audit notes.
- **Where the output goes:** the writer's output is the image prompt. It is shown verbatim in the render's "¶ Prompt" panel (4059) and sent to fal.ai.
- **Contrast:** the past-frame path passes `noHistory:true` plus the frame's own clean prose (4048, #206).
- **Status:** SUSPECTED. Nothing forbids the writer from paraphrasing a GM-only fact. Settle it by capturing one live render request and checking the history window callGM attaches for a `[...]` tag operand or an ENGINE NOTE.
- **Remedy:** give the live path the same shape as the history path — noHistory plus the latest clean narration.

### A5. The suggestion gate holds back unintroduced NPC names only; unrevealed places and items reach the buttons (low)

- **Where:** game.js `validateSuggestion` rule ⑥ (715–737) scans only `worldState.npcs` names. `buildSuggestionSys` (178–208) sends the full gameplay prompt, including the skeleton's unrevealed acts, arcs and locations. The only fence for places and items is the prose line in SUGGESTION_MODE_BLOCK (142).
- **Failing case:** a button such as "Seek the Drowned Archive" naming a skeleton-only location passes every rule (⑤ checks travel only while sublocated, and only to known map nodes).
- **Status:** READ. Not run. Rule ⑥'s own comment calls the prompt channel exhausted for the NPC case, which is why ⑥ exists. The same reasoning applies to places.
- **Remedy:** extend ⑥ to skeleton and blueprint place names (map nodes with `blueprintSeeded` and no visits, act and arc text) using the same introduced-in-transcript test.

### A6. The render prompt can describe the hero as "undefined" (low)

- **Where:** game.js `buildSceneRenderRequest`, line 3897: `c.name+", a "+gw+" "+c.age+" "+c.ancestry+" "+c.cls+", "+c.appear`. The hero's fields are concatenated without the guards the companion line has (3902: `pcs.age?…`, `pcs.appear?…`).
- **Failing input:** a hero sheet without `age` or `appear` (for example a library or .char import that lacks them). The writer receives "Kael, a male undefined Human Rogue, undefined".
- **Status:** READ.
- **Remedy:** use the companion line's guards for the hero.

### A7. A blueprint's acts and bestiary are installed by reference, while its class roster is copied (low)

- **Where:**
  - applyBlueprint line 3551: `skel={premise:…,acts:bp.acts}`, then status writes into those same objects.
  - Line 3594: `worldState.bestiary=bp.creatures`.
  - Contrast line 3547: `JSON.parse(JSON.stringify(bp.customClasses))`, with the comment "a reused bp object must never be able to mutate canon later".
- **Wrong outcome:** the caller's blueprint object is mutated (statuses and startTurn stamped). Any later reuse of that object — a second Begin from the same loaded blueprint in one session, or the designer's own copy — starts with act 1 stamped and shares arrays with a live campaign's skeleton.
- **Status:** READ. I did not find a caller that reuses it; pendingBlueprint is nulled after one apply (line 40).
- **Remedy:** copy as the class roster does.

### A8. validateBlueprint does not detect duplicate NPC names; the second dossier is dropped with only a generic identity toast (low)

- **Where:** game.js `applyBlueprint`, line 3566.
- **Failing input:** two blueprint NPCs named "Bram". The first is admitted. The second is refused by `identitySheetAdmit` with "'Bram' already identifies Bram", and its notes, secret and abilities are lost.
- **Status:** REPRODUCED (same probe as A2). Output:
  ```
  TOAST ⚠ Character identity refused: 'Bram' already identifies Bram
  CASE duplicate npc | validate: null | applied; roster +1 ["Bram"]
  ```
- The refusal is loud, so this is not silent. The defect is that validation accepts the file and the author's second dossier vanishes at play time instead of at load.
- **Remedy:** refuse duplicate NPC names in validateBlueprint.

### A9. The "Death has just arrived" line in the DEATH SCENE block can never reach a prompt (low)

- **Where:** api.js:1062: `(ds.stage==="arrive"?"Death has just arrived…":"")`.
- **Why:** `"arrive"` lives only between `deathSceneBegin` and the next line of the same `commitGmTurn` (game.js:2716–2717), and no prompt is built in that window.
- **Effect:** the arrival send's prompt carries the block without its arrival line. The DEATH ARRIVES directive itself still carries the instruction, so this is dead code that misleads more than it harms.
- **Status:** REPRODUCED in effect: the A0b probe shows the stage is `"question"` before the arrival send in both runs.
- **Remedy:** advance `"arrive"` only in the commit of the arrival send, for example by checking `opts.silent` together with the arrival directive, or by having the arrival commit set a flag.

## A-Monotonic resources

| Resource | Scope | Bound | Enforced? |
|---|---|---|---|
| `validateSuggestion` rule ⑥ transcript scan (one indexOf pass over the whole transcript for each unintroduced name a suggestion mentions) | per suggestion, per turn | the transcript size; a hit stamps `introduced` and stops it, but a never-found name is rescanned on every button set | no (cost grows with the campaign) |
| `worldState.relDowngrades` | campaign | 8 | yes (2358) |
| `worldState.consumableChecks` | campaign | 6 | yes (2453) |
| `worldState.consumableKept` / `consumablePending` | campaign | pruned to the live inventory keys every turn | yes (2463–2468) |
| `worldState.tagLog` (the ledger entries) | campaign | `TAG_LOG_CAP` | yes (422) |
| `worldState.locationFilingWatch` / `subLeaveWatch` / `travelPriceWatch` / `commitmentPing` | campaign | one each, aged out | yes |
| `customRules` gains a wrapped line per new blueprint rule | device (the rules key) | deduped by the wrapped string; grows by one line per distinct rule across every blueprint ever applied | not bounded across blueprints |
| `memory.map.nodes` village houses / commons / Hall | campaign | residents plus commons | yes, idempotent |
| Speaker-map derivation per reply | per turn | about 25 ms on 50 KB of prose, 84 ms on 50 KB of bare quote glyphs (probe-timing.js) | linear in practice |

## A-Affirmed

1. Every drift detector is bounded on 50 KB of input (audits/audit-2026-11-19-evidence/B\probe-timing.js). Worst cases, across four adversarial texts (prose, no punctuation, capitalised words, bare quote glyphs) and a 70-node map:
   - detectLocationFilingCue 12 ms, detectKnownInteriorArrival 33 ms, observeDriftAxes 31 ms.
   - deriveSpeakerMapFromTags 84 ms, sayTagCoverage 155 ms (on the quote-glyph text).
   - No quadratic blow-up.
2. Speaker attribution never builds a regex from a speaker name. SAY_TAG_RE is fixed, and names are matched by equality in `_speakerVoiceSubject`. A name with regex characters cannot break it.
3. Every regex built from an NPC, location or item name in the suggestion gate and the drift detectors is escaped first: `suggestionNameAlt`, `suggestionInvokesCap`, `_driftEsc`, `consumableUseEvidence`, and the tvk/tk2 escapes.
4. `ledgerApply` is all-or-nothing. Every line is simulated on a detached `invSnapshot` copy and against the chest row before anything lands, and the shop and stash doors are busy-gated (452, 469).
5. Both library adopters (`adoptLibraryHero`, `adoptLibraryCompanion`) and `importVillageResidents` admit through `sheetAdmit`. No raw library sheet is installed.
6. `_seatRecordPeopleFromLibrary`'s async callback re-checks `busy` and derives its candidates from the CURRENT hero at callback time, so a switch during the library fetch seats the new campaign's own people, never the old one's.
7. `parseSuggestionArray` with junk: an object without `actions` and an unparseable array both throw into generateActions' quiet-removal path, which reports through `reportError("actions",…)`. Nothing is rendered unvalidated: every button passes `applySuggestionGate`, and `buildActionButtons` escapes.

## A-Undetermined

- What the creation wizard shows the player when `startGame` throws from applyBlueprint (A3). I did not read char-creation.js.
- Whether `customRules` growth across many blueprints (one wrapped line per distinct rule, device-wide) is ever pruned. That is outside game.js.
