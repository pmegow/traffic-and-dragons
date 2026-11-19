# Audit_2026_11_19_Fable — full project code review

> **Scope.** The whole tracked codebase at HEAD `d7ed4ea6` (v1.1451): the engine, the UI shells, the voice and audio
> files, the atlas, the satellite pages and the test gates. Not reviewed: the vendored libraries (`tndmaps.js`,
> `vendor/`, `roller/`), the bible DATA tables, and the server repository (read only where a finding depended on it).
>
> **Method.** Thirteen parallel read-only lanes (Opus) each read one subsystem and wrote evidence; this session (Fable)
> adjudicated. Every finding below carries one evidence mark:
> **R** = a headless probe against the real engine reproduced it, and I re-ran that probe myself;
> **C** = established by reading, and I re-read the cited lines myself;
> **L** = established by the lane's reading only (I did not re-check it).
> No finding rests on a guess; anything not settled is in section Z. Probes and the lane reports are kept in
> [audit-2026-11-19-evidence/](audit-2026-11-19-evidence/).
>
> **What was not run.** No browser. No live model call. No sabotage battery except #423. Findings marked C or L in the
> audio, Car Mode and satellite sections have not been seen on a device.
>
> **Row format.** Each row opens with one plain sentence, then the mechanism, then the remedy. Sev: H = lost or wrong
> campaign data, or script running in the game's origin · M = wrong behaviour a player can reach · L = latent, rare or
> cosmetic. ⛨ = touches the drift surface (Fable or Astra only). Status is living: ○ not started.
>
> **Read this first — the eight that matter most.**
> **G1** (the sabotage harness can score a mutation "caught" with nothing guarding it; CI is red on it now) ·
> **S1 + S2** (two paths switch the cloud overwrite guard off, so an older copy replaces newer play from another device) ·
> **X1–X4** (model calls that outlive the turn write into whichever campaign is loaded when they answer; one of them is the always-injected era spine) ·
> **M1** (distinct facts about any two-word-named person or place are folded into one and the rest archived unread) ·
> **T1 + T2** (a death tag kills a hero who is not down; six tags swallow the tag after them into canon) ·
> **H1–H6** (more than 40 places paint unescaped text as HTML; five rows are reachable from a shared `.tnd`, `.char` or `.blueprint` file, in the origin that holds the API keys) ·
> **C1** (the skeleton review silently drops the campaign's age ladder whenever it finds anything) ·
> **U1** (Death's arrival and the final denouement are dropped without a word when a post-turn request is still running).
>
> **Totals.** 133 rows (a few bundle several small items): 16 high, 59 medium, 58 low. 84 reproduced, 10 read and
> re-checked by me, 39 lane-read only. Four come from work I shipped on 2026-11-18: **C4** and **C10** (#776),
> **U6** (#772) and **G7** (the `TODO_Atlas.md` split). Nothing here has been fixed; this file is findings only.
> Tracked as TODO row #777.

---

## G. The test gates

| # | Sev | Finding & remedy | Ev | Effort | Tier | Status |
|---|:---:|---|:---:|:---:|:---:|---|
| G1 | H | **A sabotage battery that runs the whole suite can report a mutation as "caught" when no test guards it, and since 2026-11-18 it also reports real guards as MISATTRIBUTED in CI.** `dev/tests-252-retained-proof-wiring.js` is part of `run-tests.js` and scans every battery's `find` anchor. Inside a mutated scratch clone the clause being proven no longer matches, so the scan fails and prints `FAIL <battery> :: <label> find target is stale in <file>`. `sabotage.js` judges a clause by exit status plus `out.indexOf(mustFail)`. So: (a) a clause with **no `mustFail`** can never be MISSED; (b) a clause whose `mustFail` is a substring of **its own label** is attributed by the scan's line; (c) since `fd445313` the standalone runner starts no new suite after a failure and the scan is in `START_FIRST`, so on CI's two jobs the real guarding suite often never runs. **Census:** 435 clauses in 36 batteries run the full suite; 15 clauses in 5 batteries have no `mustFail`; 4 clauses in 3 batteries match their own label (`sabotage-231-arc-wall` "chain-close", `sabotage-423-import-ownership` "unsynced marker" and "held checkpoint", `sabotage-jp011-flush-dirty` "multi-byte"). **Reproduced:** in a scratch clone I applied the #423 memory-stamp mutation AND deleted the assertion that guards it; `tests-423` passed alone, `run-tests.js` still exited 1 on the scan only. CI run 44489988053 shows the same battery with two clauses MISATTRIBUTED and two "caught" by label. The #272 E26 fix I pushed on 2026-11-18 was a point-fix of this class. (a) and (b) have existed since the scan joined the suite (`64a3f613`, 2026-08-28). **Remedy:** `sabotage.js` sets an environment flag on the guarded command; the scan's test in `tests-252` skips under it and says so. Then re-prove the 8 batteries named above — some clauses may turn out truly unguarded. | R | S | Fable | ○ |
| G2 | M | **The per-push sabotage sweep never schedules 94 clauses, because it finds a battery's target file by looking for a call spelled exactly `prove(`.** Batteries that wrap it (`proveV`, `proveU`, `proveE`, `proveF`) or hold the target in a variable are invisible to `dev/battery-targets.js` `targetsOf`, which `run-sabotage-diff.js` and `prove-before-push.js` both use. 18 battery/target pairs, including 19 clauses on `memory.js` (`sabotage-b38-extractor-refusal`) and 31 on `bible_editor.html`. Since the 2026-11-18 ruling this sweep is the only proof a push gets. **Remedy:** derive targets from the stub collector `check-sabotage-applicability.js` already has. | R | S | Fable | ○ |
| G3 | M | **A clause's attribution word is searched for in the whole output, so it matches when the named test PASSED.** 155 of the 215 suites print `PASS <name>`; a `mustFail` that is a bare test name is always present, and any unrelated red is scored "caught". A census found 671 of 3,353 attribution strings verbatim in a pass-printing suite the same battery names (an upper bound). **Remedy:** match only on failure lines. | R | S | Fable | ○ |
| G4 | M | **The harness never runs the guarded command on the unmutated file, so a command that is red anyway proves every clause that has no attribution word.** 27 batteries hold about 150 such clauses. A test that reads a gitignored input is red in the scratch clone for this reason alone. **Remedy:** one clean run per group first; a red baseline makes the group UNOBSERVED. This also closes G1(a). | R | S | Fable | ○ |
| G5 | M | **`dev/static-server.js`, the documented way to serve the game locally, answers the whole network, serves sibling folders outside the repo, and dies on a malformed URL.** `listen(8123)` binds every interface; the containment test is a string prefix, so `/..%2ftraffic-and-dragons-server%2f…` returns 200; `decodeURIComponent('/%')` is uncaught. The repo it serves includes `.git` and the gitignored saves. **Remedy:** bind `127.0.0.1`; use `path.relative`; answer 400 on a bad URL. | R | S | Light | ○ |
| G6 | M | **`install-bible.js` crashes on an item bible, so every item save from the bible editor is refused.** The item type falls into the capability branch and reaches `Object.keys(undefined)` (line 123). Nothing is lost: it fails before any write. `tests-install-bible.js` has no item case. | R | S | Light | ○ |
| G7 | L | **`TODO_Atlas.md` is outside every tracker gate in CI.** The per-commit lint runs with `--file`, which never loads the atlas file, so a `TODO.md` row that reuses an atlas row's number passes CI; only the local hook's id pass reads it, and no shape, column, size or move check reads it anywhere. `todo-viewer.html` does not read it either. This gap came with the 2026-11-18 split. **Remedy:** pass the atlas file to the lint in CI and run the other passes over it. | R | S | Light | ○ |
| G8 | L | **`ci-status.js` says GREEN when the newest runs timed out or failed to start**, because it keeps only `success` and `failure`; and the engine job sets no `timeout-minutes`. This is the blind gate #646 was written to end. | R | S | Light | ○ |
| G9 | L | **`run-sabotage-diff.js` exits green when it cannot read its range** ("nothing to run"); its sibling tools refuse the same condition. | L | S | Light | ○ |
| G10 | L | **The pre-commit hook tests the working tree, not the staged commit.** With sessions sharing one tree and `git commit --only`, the bytes tested can differ from the bytes committed; CI catches it after the push. | L | M | Light | ○ |
| G11 | L | **`dev/bible-server.js` answers reads from any website** (CORS `*`; `/health` carries the repo path), dies on a malformed URL, and stages every upload at one fixed temp path. Writes are guarded. | L | S | Light | ○ |
| G12 | L | **The storage-key census misses ten keys that exist only in satellite pages**, while CLAUDE.md calls its output "the full list". | R | S | Light | ○ |

---

## S. Cloud sync and persistence

| # | Sev | Finding & remedy | Ev | Effort | Tier | Status |
|---|:---:|---|:---:|:---:|:---:|---|
| S1 | H | ⛨ **Switching campaigns hands the old campaign's turn number to the new one as its sync base, which switches the new campaign's overwrite guard off for the session.** `switchToCampaign` fires campaign A's POST, then `resetSyncState()` for B. A's 200 lands afterwards and `_syncOk(turnAt)` raises B's base (`storage-adapter.js` `_syncNow`, lines 683–719; no check that the posted campaign is still active — the reconcile has that check at line 932). Probe: A at turn 2000, B at turn 10 → B's next POST carries `baseTurn 2000`. The server refuses only when its stored turn is above `baseTurn` (server `index.js:715`), so an older B replaces newer B play from another device with no 409. The same stale handler can pause B on A's 409 or re-home B on A's 403. **Remedy:** capture the campaign id in `_syncNow` and ignore every response branch when it is no longer active, or drop responses from before the last `resetSyncState`. | R | S | Fable | ○ |
| S2 | H | ⛨ **If the player sends a turn while the boot reconcile is in flight and the cloud is ahead, this device keeps its older copy, takes the cloud's turn as its base, and its next save overwrites the newer cloud copy.** `_reconcileFromServer` seeds `_lastAckTurn = serverTurn` (line 995) before it tests `busy` (line 1011) and skips the adopt without a log, toast or retry. Probe: local 10, server 50, busy → next POST `turn 11 baseTurn 50`, accepted. Turns 12–50 from the other device are gone. **Remedy:** when the adopt is skipped for `busy`, do not seed the base; say so; run the reconcile again after the turn commits. | R | S | Fable | ○ |
| S3 | M | **A local save that fails to parse or to migrate is dropped with no message and no rescue copy, and the boot shows the character wizard.** `state.js` `loadState` (lines 907, 916) returns false silently unless the save is from a newer build. The core key has no rescue (only the session and memory keys do). A new game then writes over the unreadable bytes. Reproduced with a truncated core and with `character.spells:[null]`. **Remedy:** rescue the raw core bytes, say why, and refuse the wizard over an unreadable save as the version refusal does. | R | S | Fable | ○ |
| S4 | M | **A `.tnd` import that throws inside migration leaves the app half-switched while the screen says "Import failed".** `importSaveData` installs `worldState`, the active id and memory, then calls `migrateWorldState()` with no rollback (lines 1140–1180). The next save writes the half-migrated import under the new id. **Remedy:** migrate and heal the detached objects before installing them. | R | S | Fable | ○ |
| S5 | M | **A pulled or restored memory of `{}` is accepted as healthy; the first reader throws because it has no stores.** `_pulledMemory` (ui-campaigns.js:260), the reconcile adopt (storage-adapter.js:1020, which does not use `_pulledMemory` at all) and `checkpointRestore` (state.js:859) all accept it. `sync.md` §16 D5 says `{}` is broken and must become `blankMemory()` with a loud line. **Remedy:** one shared "is this a memory" test at all three sites. | R | S | Fable | ○ |
| S6 | M | **Loading a `.tnd` file is not blocked while a turn is in flight, so the old campaign's reply lands in the imported one.** `importSave` and `importSaveData` never check `busy`; the other campaign doors do (audit E3). **Remedy:** refuse while `busy`. | C | S | Light | ○ |
| S7 | M | **Load on a campaign this device holds waits for the cloud probe and then switches without re-checking `busy`.** `campLoad` checks once (line 266); the `keep-local` branch and the rewind modal's cancel (lines 282, 287) call `_campLoadLocal` after an await of up to 20 s. **Remedy:** re-check in `_campLoadLocal`. | C | S | Light | ○ |
| S8 | L | **Four Blueprint Designer scripts are served cache-first, and designer-only commits do not bump `CACHE`, so authors run stale code.** `designer-acts.js`, `designer-assistant.js`, `designer-prose.js`, `designer-assistant-ui.js` match no network-first branch in `sw.js:203`. Two past commits changed them with no `sw.js` change. The class guard checks pages, not the scripts they load. **Remedy:** add `designer-` to the regex; extend the guard to scripts of network-first pages. | L | S | Light | ○ |
| S9 | L | **A failed portrait upload (HTTP 4xx or 5xx) is treated as success and never retried.** `syncPortrait` (storage-adapter.js:532) has no `r.ok` check. | L | S | Light | ○ |
| S10 | L | **A re-homed campaign loses its preserved transcript backup.** `rehomeCampaign` does not move `tnd_transcript_rescue_v1_<id>` (or the store and clock rescue keys); the promised auto-recovery then looks under the new id. | L | S | Fable | ○ |
| S11 | L | **A deleted or re-homed campaign's camp checkpoint stays in IndexedDB forever.** Nothing deletes a key in the `checkpoints` store; each holds a full world. | L | S | Light | ○ |
| S12 | L | **A campaign deleted on another device leaves its local slot behind with no way to remove it.** `mergeCampaignLists` prunes the row; every removal path is row-driven. Hundreds of KB per mature save on a quota-limited phone. | L | S | Light | ○ |
| S13 | L | **`campCloudPushSilent` gives no reason when the stored world cannot be parsed**, and the rename path that calls it with no callback is fully silent. | L | S | Light | ○ |

---

## X. A model call that outlives the turn writes into whichever campaign is loaded

One class, eight instances. Each call is started inside a turn but is not awaited by it, or awaits past a campaign door
that only tests `busy`. None captures the world before the `await` and compares after. The item-kind and atlas settles
and the render job already do this correctly (`worldState!==ws`, `_renderJobLive`); these do not.
**Class remedy:** one helper that captures `{worldState, memory, campId}` and refuses loudly on a mismatch, used by
every post-await writer; and a class guard in `dev/class-guards.js` that finds an `await callGM` followed by a write to
`worldState` or `memory` with no such check.

| # | Sev | Finding & remedy | Ev | Effort | Tier | Status |
|---|:---:|---|:---:|:---:|:---:|---|
| X1 | H | ⛨ **An era compiled for one campaign is written into another.** `memory.js` `compileEraIfDue` (2614–2635), fired un-awaited from `summarize`. Probe: campaign B (turn 7) ends with campaign A's era for turns 1–200, saved. The era block is injected every turn; `eraCoveredEnd()` then stops B's own chapters up to turn 200 from ever compiling, and the Quest Journal hides them behind A's text. The merge branch has the same hole. | R | S | Fable | ○ |
| X2 | M | **The "story so far" recap is written into another campaign.** `game.js` `refreshSynopsis` (4622–4631). B's journal shows A's story and B's own recap is marked not due. | R | S | Fable | ○ |
| X3 | M | ⛨ **A companion sheet generated for campaign A is attached to a same-named companion in campaign B, and its spell definitions land in B even when no such companion exists.** `generateCompanionSheet` (game.js:1966–1976); it is also restarted on every campaign load. | R | S | Fable | ○ |
| X4 | L | **Suggested-action buttons from campaign A are saved into campaign B when their turn numbers match.** `generateActions` compares `worldState.turn` only (game.js:830, 847). | L | S | Light | ○ |
| X5 | L | **The last action survives a campaign load.** `lastAction` is reset only in `startGame`; Car Mode's retry would send A's action into B, and the first prompt built in B uses A's text as its retrieval query. | L | S | Light | ○ |
| X6 | M | **Blueprint Designer: Generate replaces the working copy after the author closed the modal and kept editing.** `openGenerate` awaits about a minute, then `bp=normalizeBlueprint(draft…)` with no staleness guard; the IndexedDB draft is overwritten too. Every sibling model path in the page has the guard. | C | S | Light | ○ |
| X7 | M | **Blueprint Designer: Review findings and Apply patches land on whichever blueprint is open when the model answers.** Lines 1355 and 1483–1489. | L | S | Light | ○ |
| X8 | M | **Pressing Begin while the review page's portrait render is running clears `busy` in the middle of skeleton generation, and the portrait is lost.** `ftRenderPortrait` sets `busy=false` unconditionally (char-creation.js:157); `confirmChar` never checks `busy`. | L | S | Light | ○ |

---

## T. State tags and the clock

| # | Sev | Finding & remedy | Ev | Effort | Tier | Status |
|---|:---:|---|:---:|:---:|:---:|---|
| T1 | H | ⛨ **`[DOWNED_RESOLVED:dead]` kills a hero who is not down, and the rescued form files a false Defining Moment.** `tag_table.js:588–593` never tests `worldState.downed`. A GM who uses the tag for a fallen foe or companion spends one of the hero's respawns; on the fourth death the campaign ends. The village no-harm gate is not called on this route. **Remedy:** refuse every outcome unless the hero is downed, loudly. | R | S | Fable | ○ |
| T2 | H | ⛨ **Six tags swallow the tag after them when they are one field short, and the swallowed text lands in canon.** Fields written `([^|]+)` have no `\]` in the class: `FUTURE_EVENT` (1553), `LOCATION_SIZE` (708), `COMBAT_START` damage (1188), `NPC_SUPERSEDE` (1562), `NPC_LINK` (1571), `NPC_FACTION` (1573); `FACTION_REL`, `SAVE_MOD` and `COMPANION_ABILITY` have the same shape (not run). Observed: `[NPC_LINK:Zarith|Guard Captain] later [NPC:Bob|calm|ally]` files a real edge Zarith ↔ Bob; `NPC_SUPERSEDE` replaced Bram's knowledge with `"active"`. The player sees clean prose, and for two of them a line saying the tag was dropped. **Remedy:** `[^|\]]+` in each group. | R | S | Fable | ○ |
| T3 | H | ⛨ **A spell definition's tier is never clamped, and it sets the caster's mana pool for good.** `[SPELL_DEF:…|tier=999999]` gives a pool of 1,000,000; `tier=-50` gives a negative maximum (tag_table.js:1501; the overlay is write-once). **Remedy:** clamp to the bible's range and refuse outside it. | R | S | Fable | ○ |
| T4 | M | ⛨ **`[TIME_ADVANCE:1.5h]` advances five hours, and `[SCHEDULE:…|3 weeks]` is filed as one minute.** `clock.js` `parseDuration` (155–167) reads only the digits before the unit and knows no weeks; `parseStrictFutureDuration` in the same file reads "3 weeks" correctly, so the same phrase means two things. **Remedy:** accept decimals and `w`; warn when a non-empty string parses to zero. | R | S | Fable | ○ |
| T5 | M | ⛨ **After a rest that names dawn, the engine reports a clock mismatch and leaves the stale time of day.** The TIME handler reads the first `[TIME:]` in a reply (tag_table.js:672); `clockNamedWake` reads the last. The next turn's note then demands a rest the party just took. **Remedy:** read the last, as the #389 contract does. | R | S | Fable | ○ |
| T6 | M | ⛨ **Common malformed tags are stripped from the prose, change nothing, and are reported nowhere.** `[COMBAT_END]` with a fight open, `[REST]`, `[REST:full]`, `[QUEST:Title]`, `[NPC:Name]` or four fields, `[XP:-50]`, `[SUBLOCATION_LEAVE:x]`, and `[GOLD:a few coppers]` (its "carries no amount" refusal at line 604 can never run). The near-miss tripwire covers eleven rarer tags and none of these. **Remedy:** call `__tagNearMiss` at the head of NPC, QUEST, GOLD, XP, REST and COMBAT_END. | R | M | Fable | ○ |
| T7 | M | ⛨ **The schedule has no bound on count, label length or horizon, and every pending entry rides the prompt every turn.** A 5,000-character label due in 274 years is accepted; 301 entries make a 23 KB clock block (clock.js:318–360, 696–718). **Remedy:** clamp the label and the horizon; cap the count with a loud refusal. | R | S | Fable | ○ |
| T8 | L | ⛨ **Companion conditions and abilities compare names case-sensitively; the hero's do not.** Duplicates pile up and removal fails (tag_table.js:1910, 1916, 1924 against 1596, 1607). | R | S | Fable | ○ |
| T9 | L | ⛨ **`[COMPANION_XP:]` is uncapped while `[XP:]` is clamped to ten times the level.** Whether that is deliberate is not known. | R | S | Fable | ○ |
| T10 | L | ⛨ **Extreme operands:** a GOLD figure of about 307 digits sets the purse to Infinity, which saves as null; an `ENEMY_HP` heal exceeds the maximum; `COMBAT_START` with hp 0 opens and closes the fight at once. | R | S | Fable | ○ |
| T11 | L | ⛨ **The near-miss tripwire says "malformed — dropped" for tags the looser regex then applies** (the T2 cases). | R | S | Fable | ○ |

---

## P. The tag-application boundary and the prompt

| # | Sev | Finding & remedy | Ev | Effort | Tier | Status |
|---|:---:|---|:---:|:---:|:---:|---|
| P1 | M | ⛨ **An unclosed allowed tag in a review call carries a forbidden tag past the #264 whitelist, and the party is moved.** The whitelist regex body `[^\]]*` crosses a `[` (api.js:3481). `[QUEST:Find the cat|completed … [LOCATION:Magnimar]` is kept whole as one QUEST tag, then the LOCATION handler finds the inner tag. **Remedy:** `[^\]\[]*`. | R | S | Fable | ○ |
| P2 | M | ⛨ **A model-written companion spell definition can run any tag through the full parser.** `spellDefTag` strips `]` but not `[` (game.js:1583), and `canonizeCompanionSpellDefs` calls `applyMuts` with no whitelist (1593). A `[LOCATION:` in an effect text moved the party. **Remedy:** `applyMuts(…,{allow:["SPELL_DEF"]})` and strip `[`. | R | S | Fable | ○ |
| P3 | M | ⛨ **Three tags are applied when written in lower case, but every safety net is upper-case only.** `[rest:long]`, `[alignment:good+2]` and `COMPANION_ALIGNMENT` handlers carry `/i`; the review whitelist, the strip, the unknown-tag scan and the provenance ring do not. A whitelisted review call performed a full long rest; the tags stay visible in the story and are spoken. **Remedy:** one rule for case, pinned. | R | S | Fable | ○ |
| P4 | M | ⛨ **An unclosed tag silently removes all prose up to the next tag's `]` from the display and the narrator, while both tags apply.** `buildCtTags` body `[^\]]*` (tag_table.js:97). The transcript keeps the raw text. **Remedy:** `[^\]\[]*` plus a loud strip of an opener with no close; the frozen strip hash needs a deliberate re-baseline. | R | S | Fable | ○ |
| P5 | M | ⛨ **A tag handler that throws leaves its partial write and tells nobody but the console.** `applyMutsTable` pushes to `R.errors`; `applyMuts` uses that only for envelope bodies (api.js:3499). No mutation line, no toast, no ring entry, no bug report. **Remedy:** push a ⚠ line and record `errors` in the ring entry. | R | S | Fable | ○ |
| P6 | M | ⛨ **A failed turn can pay a withheld reward twice.** `buildIdentityConflictNudge` (api.js:1794–1813) queues the claim and opens its modal while the notes are built, before the request. A failed request restores the conflict but not the claim; if the player accepted during the wait, the next turn queues and pays it again (+50 XP became +100). **Remedy:** stage the shelve until commit. | R | M | Fable | ○ |
| P7 | M | ⛨ **The geography block lists every living NPC ever sighted elsewhere, with no cap.** 300 NPCs add 17,000 characters to the uncached half of every turn, though the roster line folds the same NPCs (api.js:123–137). **Remedy:** apply the roster rule and a "+N more on record" count. | R | S | Fable | ○ |
| P8 | L | ⛨ **One null entry in a sheet's conditions list makes every turn fail, and the load does not repair it.** `condInjectFmt` and `buildConditionAudit` read it unguarded. No engine writer produces a null; the doors are a hand-edited file or the character editor. **Remedy:** filter at admission, loudly. | R | S | Fable | ○ |
| P9 | L | ⛨ **The legacy-character block puts the character's age into the gameplay prompt**, against the ruling that age reaches no gameplay prompt (api.js:2733). | R | S | Fable | ○ |
| P10 | L | ⛨ **When the public-map path withholds a reply's tags, no provenance entry is written for that turn** (api.js:3491–3495). | L | S | Fable | ○ |
| P11 | L | **A legacy `[ACTIONS:]` line followed by a tag puts the tag into the third button** (pre-v1.110 saves only). | L | S | Light | ○ |
| P12 | M | ⛨ **The engine tells the GM to file phrase fragments as places.** `detectLocationFilingCue`'s fallback regex carries `/i`, so its `[A-Z]` matches any letter (game.js). "You step through the doorway into the great hall" yields the place "into the great hall"; after eight turns the note asks for `[LOCATION:into the great hall]`. **Remedy:** drop the flag on the name half. | R | S | Fable | ○ |

---

## M. Memory

| # | Sev | Finding & remedy | Ev | Effort | Tier | Status |
|---|:---:|---|:---:|:---:|:---:|---|
| M1 | H | ⛨ **Distinct short facts about a person or place with a two-word name are folded into one, and the others go to the archive, which no prompt reads.** `feNearDup` (memory.js:1489) counts shared tokens, and nearly every fact restates the name, which supplies two. Observed: three lore lines about "The Glass Spire" kept one; "Mara Voss lost her left eye in the war" was folded into "Mara Voss is the harbor master". The same facts under a one-word name all survive. Console only. **Remedy:** drop the entity's own name tokens before counting. | R | S | Fable | ○ |
| M2 | M | ⛨ **When anything fails after an extraction has been applied, the same window is filed again on the retry.** A failed save (storage full) or a throw in `retainSessionTail` leaves the chapter, decisions and scene events in memory; the retry files them a second time (memory.js:3152–3216). **Remedy:** apply to detached copies and swap in after the save succeeds. | R | M | Fable | ○ |
| M3 | M | ⛨ **A superseded-fact needle of a single space retires an unrelated live fact.** `applySummaryExtract` (2792–2796) matches `old` by substring with no trim or minimum. **Remedy:** trim; require an exact or word-bounded match of a minimum length. | R | S | Fable | ○ |
| M4 | L | ⛨ **A scene-only fact deferred past the re-ask cap comes back as permanent knowledge** (the deferred row drops `kind:"scene"`; memory.js:2999–3011). | R | S | Fable | ○ |
| M5 | L | ⛨ **A failing era compile is console-only and re-bills a call at every summarize, indefinitely**; it never reaches drift health (2631–2633). | L | S | Fable | ○ |
| M6 | L | ⛨ **Map edges are compared as raw strings, so a pointer holding an alias records a second edge for the same pair** (`fileLocation` 655–661). | R | S | Fable | ○ |
| M7 | L | ⛨ **A repeated companion want is queued every time with no cap, the whole queue rides the prompt, and a completed want's duplicate is promoted again.** `agendaFile` (helpers.js:572); the queue travels on the portable sheet. | R | S | Fable | ○ |

---

## H. Unescaped text painted as HTML

One class, 13 rows, more than 40 sinks. The pattern is the same everywhere: a renderer concatenates a field it assumes is a number or
a short label, and nothing at the import door types that field (`clampImportedCharacter` only cuts lengths;
`ensureV10Arrays` only fills arrays). The game's origin holds the model API keys and the session token in
localStorage. The first five rows are reachable from a file another person made.
**Class remedy, in this order:** (1) one admission row that coerces every numeric sheet field (`level`, `hp`, `maxHp`,
`xp`, `stats.*`, turn stamps, spell `lvl`) to a number and types the label fields; (2) escape at the sinks listed;
(3) replace every `onclick='fn("…")'` built from a name with `data-*` plus a listener; (4) a class guard that finds a
`"+x.field+"` inside an HTML-building function where the field is not escaped or coerced.

| # | Sev | Finding & remedy | Ev | Effort | Tier | Status |
|---|:---:|---|:---:|:---:|:---:|---|
| H1 | H | **A `.tnd` save runs script at the next reload: the hero's name and the location are written raw into the boot and campaign-load lines.** `addMsg` assigns `innerHTML` (ui-shell.js:323); callers at ui-boot.js:451–452 and ui-campaigns.js:245–246. The location is also model-written through `[LOCATION:]`. | R | S | Light | ○ |
| H2 | H | **A `.char` file runs script when previewed.** Stats, level, HP, XP, class and subrace go raw into the preview modal (ui-browsers.js:502, 516, 521) and the wizard's review card (char-creation.js:191–193); also ui-browsers.js 614, 739, 922, 442, 991. | R | S | Light | ○ |
| H3 | H | **A `.blueprint`'s rules become stored HTML that runs every time Narrative Rules is opened, on every campaign, on that device.** `showRulesModal` paints `customRules[i]` raw (ui-modals.js:119); the import pushes blueprint rules into the device-wide store (game.js:3624–3629). | R | S | Light | ○ |
| H4 | H | **`character_editor.html` lets a loaded `.char` break out of its attributes.** Its own `esc()` does not escape `'`, every input is single-quoted, and skill values go in raw (lines 112, 208–212, 250, 256). A harmless "O'Brien" is also cut to "O". **Remedy:** use `escHtml`, as the designer does. | R | S | Fable | ○ |
| H5 | H | **The read-only preview of a library or other-campaign character paints age, deity, alignment and stats raw, before the player accepts the import.** `showReadOnlyCharSheet` (ui-sheets.js:738, 744) and `csSheetSections` (110); the live sheet escapes the same fields at line 292. | R | S | Light | ○ |
| H6 | H | **A model-written companion sheet's alignment and spell level are painted raw** on the NPC sheet (ui-sheets.js:513), the sheet sections (157), the spell panel (ui-panels.js:453, 459) and the hero sheet (309). `generateNpcSheet` passes them through verbatim; story text can steer the model. | R | S | Light | ○ |
| H7 | M | **A character name containing `");` runs as code from the library list.** The delete handler is an inline JS string; the HTML parser decodes `&quot;` before the handler is compiled (ui-browsers.js:444; same pattern on ids at ui-campaigns.js 215–238). | R | S | Light | ○ |
| H8 | M | **A sheet's agenda paints `since` and `done` raw**, and the agenda travels on portable sheets with no admission rule (helpers.js:605–607). | R | S | Fable | ○ |
| H9 | M | **The NPC sheet's "Bond from <hero name>" label is raw** (ui-sheets.js:540–541; `csKv` does not escape its key). | R | S | Light | ○ |
| H10 | M | **The usage modal paints an imported save's usage kinds and counters raw** (ui-modals.js:413–420). | R | S | Light | ○ |
| H11 | M | **`map_viewer.html` paints an imported save's `visits` value raw** (lines 348, 374). | L | S | Light | ○ |
| H12 | L | **Numeric sheet fields are concatenated raw across the sheets, the party panel and the Sync modal** (ui-panels.js:22, 181; ui-sheets.js 118, 126, 138, 144, 200, 520, 550; ui-modals.js 211–219 inside single-quoted attributes). Whether any import path coerces them was not settled. | L | M | Light | ○ |
| H13 | L | **Four pure renderers print one field raw each:** `elapsedTicker` its base text (helpers.js:419; today's callers pass literals), `bibleCardHTML` the tier (2871), `synopsisBlockHtml` its turn numbers (4389, against its own "every text is escaped" note), `accountDoorsHtml` server-sent provider names (2522). | R | S | Fable | ○ |

---

## U. The turn loop and the in-game UI

| # | Sev | Finding & remedy | Ev | Effort | Tier | Status |
|---|:---:|---|:---:|:---:|:---:|---|
| U1 | M | ⛨ **Death's arrival, and the campaign's final denouement, are dropped without a word when a post-turn request is still running.** Both are scheduled with `setTimeout(…,0)` from inside the commit (game.js:4265, 4248) while `busy` is true. `sendAction` then awaits the map and item requests (3041–3044); the timer fires during a network wait and returns at `if(busy…)return` (2873, 4330). The death stage has already advanced, so the player's next line is taken as their question to a Death who never appeared. After the fourth death every turn is refused and no ending shows until a reload. More likely since #766, #771 and #776 added awaited requests. Probe on the real `sendAction`: with a settle that takes 100 ms, only the downed note is sent; the arrival never is. **Remedy:** run them from `sendAction`'s tail after `busy` clears; never drop silently. | R | S | Fable | ○ |
| U2 | M | **The Rest button works mid-turn, so a rest can land twice and lose a day.** `restSpells` has no `busy` check (game.js:4187; button at ui-panels.js:466). The button path heals, rolls the clock and takes a checkpoint of a half-turn; the reply's `[REST:long]` then rolls to the next dawn. **Remedy:** gate the button path only. | C | S | Fable | ○ |
| U3 | M | ⛨ **Re-rolling a refused turn installs real narration whose tags are never applied.** `rerollLast` applies no tags by design (the original's landed); for a refusal nothing ever landed, yet `sessionLog` keeps the tagged reply as if it had (game.js:3138–3168). **Remedy:** commit a refusal's replacement through the commit path, or say its changes did not land. | C | M | Fable | ○ |
| U4 | M | **In the read-only character preview, the item ×, the ✎ and the epithet × act on the live hero.** The preview passes `invOwner=null`; the code tests `!== undefined` (ui-sheets.js:751, 166, 195). Clicking × marked the hero's Longsword; the epithet × removed the hero's alias. The test passes `undefined`, so it misses this. **Remedy:** pass `undefined`, or test `== null`. | R | S | Light | ○ |
| U5 | M | **Four modals are not dialogs to the focus contract, so Enter can send a turn behind them.** Respawn, Onward, Campaign ended and Health build their own `div` with no `aria-modal` (ui-modals.js:1104, 1115, 1142, 1153); `focusStoryBox` therefore focuses the hidden input. **Remedy:** move them onto `modalShell`. | L | S | Light | ○ |
| U6 | M | **Since #772, a notice raised while a modal is open is only collected, so a modal's own refusals are invisible.** `consoleDoorOpen` is true under a modal's backdrop (ui-shell.js:64–68). Affected: the roll modal's "the turn is still landing" (which `render.md` says the modal says), the dice test's failure reason, the health report failure, "Wait for the turn to finish", and the sync badge's explanation. I named this cost when #772 shipped; it is a contract drift and should be closed. **Remedy:** treat the door as closed while `modalTopOpen()` is true. | C | S | Light | ○ |
| U7 | L | **A roll whose send fails is lost on reload.** The check is deleted and saved before the silent send; silent sends are never kept as a pending action (game.js:3082–3094, 3059). A limited ability it spent is gone too. | L | S | Fable | ○ |
| U8 | L | **Sending with a check pending lapses the check even when no turn is sent** (an empty Send, a Table Talk question, an owed level-up); `checkLapseToAction` runs before `txt` is read (game.js:2884). Reachable mainly in Car Mode. | L | S | Fable | ○ |
| U9 | L | **A throw in the tag pass after the player's line is written offers a Retry that logs the line and bumps the turn again** (game.js:2676–2708). No throwing input was found. | L | S | Fable | ○ |
| U10 | L | **The sheet's ✎ Define and ⟳ Sync do nothing while a turn is in flight, and say nothing**; the item card's Define says "Wait for the turn to finish" for the same action. | L | S | Light | ○ |
| U11 | L | **In Car Mode every notice pops and stays until tapped**, stacking over the car screen for the length of a drive (ui-shell.js:92–104). | L | S | Light | ○ |
| U12 | L | **The campaign-folder banner can be added twice with the same ids; the second copy's buttons are dead** (game.js:3853–3864). | L | S | Light | ○ |
| U13 | L | **The World State panel throws on a null faction entry** (`worldStateNpcRows`, helpers.js:3916). Whether real state can hold one is not known. | R | S | Fable | ○ |

---

## V. Voice, Car Mode and ambience

Browser audio cannot be driven headless. R rows here were reproduced against fake platform objects, not a device.

| # | Sev | Finding & remedy | Ev | Effort | Tier | Status |
|---|:---:|---|:---:|:---:|:---:|---|
| V1 | H | **In Car Mode, a tap after a turn that committed but failed to display sends the same action again.** `sendAction`'s catch calls `carNotify("error",…)` for the committed case (game.js:3058), whose own comment says "no Retry"; "error" arms tap-to-retry (car-session.js:133, 486). The same arm fires for a failed Table Talk question, where the tap re-sends the previous story action. Rare trigger; canon is written twice when it happens. **Remedy:** `carNotify("warn",…)` at 3058, and for Table Talk. | C | S | Fable | ○ |
| V2 | M | **Cancelling the mic while a cloud take is transcribing does not discard it.** `cancel()` covers acquisition and recording only (stt.js:275–286); the upload's result still lands and, inside Car Mode, is sent as a turn. Exiting Car Mode, replay and "read options" all call it. **Remedy:** bump the generation when an upload is pending. | R | S | Light | ○ |
| V3 | M | **After the audio context is rebuilt (the iOS interruption path), every UI sound fails for the rest of the page's life, at debug level only.** `sound.js` keeps its reverb node from the first context (line 225); connecting across contexts throws. Each failed play also leaves a gain node connected. **Remedy:** reset `_verb` and `_noiseBuf` on rebuild; warn on a failed play. | R | S | Light | ○ |
| V4 | M | **Piper's synthesis iframe is leaked when its start-up fails.** `_piperInit` (tts.js:2556–2580) never calls `fr.destroy()` in its catch; the two sibling paths do. The page then also loads the in-page engine — two engines, the case v1.424 exists to prevent — and each five-minute retry can leak another. | C | S | Fable | ○ |
| V5 | M | **Skip and stop bypass the #418 retire for every scheduled source.** `_stopCurrent` nulls `onended` and stops (tts.js:3809–3812) without `disconnect()` or `buffer = null`, the two steps the contract says defeat Safari's retention of decoded audio. Up to 25 s of PCM per skip. The retention itself needs a soak to confirm. **Remedy:** run the same retire steps. | C | S | Fable | ○ |
| V6 | M | **The narrator's own beeps ignore the master mute.** `TTS.earcon` connects straight to the destination (tts.js:3713). With the phone muted, every Car Mode turn still beeps. | R | S | Light | ○ |
| V7 | M | **A stale end event from a stopped recognizer clobbers the next listen.** Tap the mic off and on quickly: the first recognizer's `onend` releases capture, clears `_rec` and leaves a live recognizer that cannot be stopped (stt.js:185–269). Device timing not verified. **Remedy:** capture the instance and ignore events from another. | R | S | Light | ○ |
| V8 | M | **Short first-person lines are taken as commands in Car Mode.** "I pause", "I repeat", "I resume", "I stop here" (wraps the session up) and "I put it back" (undoes the last item move), because the filler strips a bare "I" (car-commands.js:19). The five longer sentences in the contract's own examples are correctly left as actions. | R | S | Fable | ○ |
| V9 | L | **Car Mode silently drops three kinds its callers send** — "downed", "ended" and "respawn" (game.js:4250, 4314; tag_table.js:516); `carNotify` has no final branch. The driver gets no status for a downed hero or a final death. | L | S | Light | ○ |
| V10 | L | **A hung Piper synthesis has no deadline and wedges every later Piper operation** behind `_piperSerial` (tts.js:2429–2438). Needs a call that never returns; not reproduced. | L | S | Fable | ○ |
| V11 | L | **When the voice server fails mid-read, the rest is read in the narrator's voice; a cloud failure at the same point keeps the cast** (tts.js:2952 against 3097–3104). | L | S | Fable | ○ |
| V12 | L | **Small voice items:** a recognizer that fails to start says nothing (stt.js:249–259); every microphone failure is reported as "permission denied" (642–652); `wasm-probe.js` keeps one memory per unnamed instantiation (latent with the shipped builds); accents keep being scheduled at gain 0 while muted, against the contract; in a talk, "repeat" answers "No options to repeat yet"; a number word is swallowed while options are loading. | L/R | S | Light | ○ |
| V13 | L | **An open talk is painted over by the hero when anything calls `syncUI`, and a talk can open while a turn is in flight** (ui-panels.js:83; companion-talk.js:300). | L | S | Light | ○ |

---

## K. What the player is told that only the GM should know

| # | Sev | Finding & remedy | Ev | Effort | Tier | Status |
|---|:---:|---|:---:|:---:|:---:|---|
| K1 | M | ⛨ **A talk with a companion carries that companion's GM-only authored secret and the blueprint's guidance.** `talkContext` calls `memoryNpcDetail(…,{omitAbilities:true})` (companion-talk.js:153), which appends the secret and the authored note; the trim keeps them. The persona tells the character to speak from what it was given. **Remedy:** an option that also omits both. | R | S | Fable | ○ |
| K2 | M | ⛨ **Table Talk's prompt names characters the player has not discovered, and the GM's pending events.** `ttRecallBlock` calls `memoryTOC()` with no filter (table-talk.js:225). The World State panel hides the same characters by the 2026-11-13 ruling. **Remedy:** pass the discovered filter and leave pending events out. | R | S | Fable | ○ |

---

## A. The atlas (public map mode)

| # | Sev | Finding & remedy | Ev | Effort | Tier | Status |
|---|:---:|---|:---:|:---:|:---:|---|
| A1 | M | **A note on a way out, or on a place inside, is saved, never shown again, and shared by every sheet.** Public note keys carry no zone (atlas.js:1376) and way ids are positional (`way-1` on every sheet; atlas-public-sheet.js:181); the way card always returns `note:null`. **Remedy:** hide "Add note" on those cards, or key public notes by sheet and return them. | R | S | Fable | ○ |
| A2 | M | **After a place merge leaves two features with one name, that place's map accepts nothing more, every turn, for good.** `atlasKnowledgeCollision` (atlas-knowledge.js:107–117) scans all features of the scope, not the ones this turn touches. The toast tells the GM to use a handle, which cannot help. **Remedy:** report a collision only for a feature this turn created or changed. | R | S | Fable | ○ |
| A3 | M | **An exit with no stated direction jumps to the opposite edge when a later way is stated in its direction**, against "an exit added later moves nothing drawn" (atlas-public-sheet.js:209–214). The stability test adds an unstated way, so it cannot catch this. | R | S | Fable | ○ |
| A4 | M | **The public geography store grows about 465 bytes per disclosure, uncompressed, and every projection re-validates all of it.** 931 KB at 2,000 disclosures in the memory key; at the 8,192-receipt cap every later disclosure is refused for the rest of the campaign, with a toast each turn. **Remedy:** bound the provenance bytes; validate once per revision. | R | M | Fable | ○ |
| A5 | L | **The directions request repeats a paid call every turn while the model declines to place a feature**; there is no attempt cap (atlas-directions.js:37–110). | L | S | Fable | ○ |
| A6 | L | **The region can set two places on one point** when an earlier place is set down afresh while a later one already has a kept spot (atlas-public-region.js:81–95). Mechanism reproduced; whether play reaches it is not known. | R | S | Fable | ○ |
| A7 | L | **Ways past the sixteenth are dropped from a place sheet without a word, and the unplaced list is cut silently at 64** (atlas-public-sheet.js:180). | L | S | Fable | ○ |
| A8 | L | **At the 1,024-place cap, every follow raises a toast and an error report.** | L | S | Fable | ○ |

---

## C. Campaign creation, checks and sheets

| # | Sev | Finding & remedy | Ev | Effort | Tier | Status |
|---|:---:|---|:---:|:---:|:---:|---|
| C1 | H | ⛨ **The skeleton review silently drops the campaign's age ladder whenever the review finds anything.** `correctCampaignSkeleton` sends and returns `{premise, acts}` only (campaign_generator.js:161–168); `generateSkeleton` then reads `deepTime` from the corrected object. The campaign plays with no age ceiling and the console blames the model. The register gate feeds the correction, so this is the common path. **Remedy:** carry `skel.deepTime` across. | R | S | Fable | ○ |
| C2 | M | ⛨ **The corrected skeleton is checked for shape only.** An arc with no title or objective is accepted; a `null` arc throws outside the review's catch, the valid first draft is thrown away, and the campaign starts freeform (game.js:3794). **Remedy:** validate each arc inside `validateSkeletonStructure`. | R | S | Fable | ○ |
| C3 | M | ⛨ **Text in a check's modifier field has all its digits glued into one number.** `[CHECK:Attack|+5 vs DC 15]` rolls d20+515; `[CHECK:Stealth|DC 14]` gives modifier 14, so a natural 1 succeeds (`parseCheckTag`, helpers.js:234). No occurrence was found in the local play corpora (about 60 tags, all canonical). **Remedy:** read the leading signed integer only; clamp; refuse a field with more than one number. | R | S | Fable | ○ |
| C4 | M | **Since #776, an item whose name is longer than 80 characters is never sorted, costs a model call every turn, and is announced as sorted each time.** `itemKindsOwed` keeps the full-name key but sends a cut name; `itemKindsSettle` files under the key of the cut name (item-kinds.js:58, 124). Forty such names ahead of the rest would block every other item. The toast is built from what was asked, not from what was filed. **This is my code from 2026-11-18. Remedy:** file by `owed[i].key`; build the toast from `filed`. | R | S | Fable | ○ |
| C5 | L | **Importing a character in the wizard, pressing Back and then Next starts a fresh hero whose identity, class and attribute steps were never checked** (ancestry "Unknown", all stats 8). | L | S | Light | ○ |
| C6 | L | **An image the browser cannot decode is stored as the portrait anyway**, raw and uncompressed, and nothing tells the player why it never shows (ui-portrait.js:81; the two fal fetches do not check `r.ok`). | L | S | Light | ○ |
| C7 | L | **A row field named `__proto__` is lost when a row moves between packs**, and that row's prototype is replaced (inventory.js:128, 164), against invariant I5. | R | S | Fable | ○ |
| C8 | L | **A place can be merged into its own child**, leaving a node that is its own parent and a party pointer to a place that does not exist (`locMerge`, identity.js:471–504; `locReparent` has the check). Reproduced through the repair tool's path; the GM tag path was not shown. | R | S | Fable | ○ |
| C9 | L | **The name-path death gate compares a stored scene negative by raw string**, where the contract says every such comparison goes through `_sceneRefEntitySame` (identity.js:1487). Fails open only on saves from before #530. | L | S | Fable | ○ |
| C10 | L | **#776 exposures:** an item-section reply of the right length with its answers in the wrong order is filed for good and cannot be detected; `worldState.itemKinds` is never pruned. | C | S | Fable | ○ |
| C11 | L | **Three lookup tables are plain objects, so prototype names match them:** `sayMoodSteer("constructor")` passes its allow-list; `voiceAgeLabel("constructor")` returns the `Object` function. | R | S | Fable | ○ |
| C12 | L | **`coinNarrationAmounts` takes quadratic time on long runs of number words** (3.7 s on 64 KB); it runs on every reply. Needs pathological output. | R | S | Fable | ○ |
| C13 | M | ⛨ **A blueprint's NPC names are never checked.** `validateBlueprint` admits a nameless NPC, a blank one, and one whose name holds a `|` (for example `Bram|Kitchen`), which the tag grammar cannot address. **Remedy:** validate each name. | R | S | Fable | ○ |
| C14 | M | ⛨ **A null entry in a blueprint's locations or NPCs throws inside `applyBlueprint`, in the middle of starting the game and before any save; a null act or arc makes `validateBlueprint` throw where it should return a reason.** **Remedy:** refuse non-object entries in the validator. | R | S | Fable | ○ |
| C15 | L | ⛨ **Two blueprint NPCs with one name pass validation; the second dossier is dropped at play time** with only a generic identity toast. | R | S | Fable | ○ |
| C16 | L | **Small items in the start and render paths:** the suggestion gate's unintroduced-name rule checks NPC names only, so skeleton-only places and items can appear on buttons; `buildSceneRenderRequest` describes a hero with no age or appearance as "undefined"; `applyBlueprint` installs the blueprint's acts and creatures by reference and stamps statuses into them; the "Death has just arrived" prompt line can never be sent, because the stage leaves "arrive" in the commit that sets it. | L | S | Fable | ○ |

---

## D. The Blueprint Designer and the satellites

| # | Sev | Finding & remedy | Ev | Effort | Tier | Status |
|---|:---:|---|:---:|:---:|:---:|---|
| D1 | M | **A `.blueprint` with a null entry half-loads: the status says "Failed to read file", but the working copy is already replaced and is saved on the next keystroke.** `loadBlueprintObject` assigns `bp` before it validates (blueprint-designer.html:801–808). After a reload the draft no longer opens. **Remedy:** build and validate into a local first. | R | S | Light | ○ |
| D2 | L | **Story Compiler: loading a save during a compile leaves it stuck until reload**, with nothing shown (lines 213, 606–635). | L | S | Light | ○ |
| D3 | L | **Character editor: a draft save that fails says nothing, and a draft from a newer build leaves the page with no sheet behind working buttons** (lines 360, 372–374). | L | S | Fable | ○ |
| D4 | L | **The designer's review merge resolves section names through inherited properties**; a patch with section `constructor` writes a `constructor` array into the exported blueprint. The assistant's merge uses own properties, so the two disagree. | R | S | Light | ○ |
| D5 | L | **Small satellite items:** `author_voice_lab.html`'s model wait does not count seconds and the class guard misses raw `fetch`; `character_editor.html` calls `relationshipMigrateSheet`, which is never loaded there; `home.html` says "Signed in." when the account check fails; `bug_tracker.html` sends the feed secret in the URL; `map_cleanup.html` never revokes its export's object URL. | L | S | Light | ○ |

---

## R. Monotonic resources

The standing pass. Everything the lanes found that accumulates is in their reports with scope and bound; the table
below lists only what has **no enforced bound**. Deliberately unbounded stores (the memory archives by the 2026-09-16
ruling, rescue keys, `memory.npcs`, map nodes) are not listed.

| Resource | Scope | Why it grows | Row |
|---|---|---|---|
| `worldState.clock.schedule` | campaign, in every prompt | no cap on count, label or horizon | T7 |
| Geography "Elsewhere" lines | every prompt | one line per living NPC ever sighted | P7 |
| Public geography store | campaign, in the memory key | about 465 bytes per disclosure, never trimmed | A4 |
| `cs.agendaQueue` | portable sheet, forever | every repeated want is queued | M7 |
| `worldState.itemKinds` | campaign | one record per item name ever asked | C10 |
| `worldState.identityConflicts` (stale) | campaign | the cap counts live records only; every turn walks the list | — |
| Once-ever latch dictionaries (14 of them, e.g. `consumableNudged`, `mergeHintNudged`) | campaign | one key per name, pair or arc ever seen; snapshotted about 95 times per turn | — |
| `customRules` | device, across campaigns | every rule of every blueprint ever started | H3 |
| Checkpoints in IndexedDB | device, forever | never deleted | S11 |
| Slots of campaigns deleted elsewhere | device, forever | no removal path | S12 |
| Sticky toast nodes in Car Mode | session | removed only by a tap | U11 |
| Decoded audio of skipped sources | session (Safari) | the retire is bypassed on skip and stop | V5 |
| Piper iframes after a failed start | session | never destroyed | V4 |
| Gain nodes after a failed UI sound | session | connected before the throw | V3 |
| `_npcTokMemo`, `_npcPossMemo` | session | no eviction; bounded by vocabulary in practice | — |

---

## Y. Affirmed — what the lanes tried to break and could not

- **Prompt cache.** Every term of the stable half was read; none reads turn, clock, HP, location or the session log. STYLE is last; the MAP block follows GEOGRAPHY.
- **Envelope rollback.** A staged failure restores `worldState` and `memory` to the pre-envelope objects; no live write from an envelope body survives.
- **Secrets.** No API key, session token or Authorization header reaches a URL, a log, a breadcrumb, a campaign payload, an export or an error report (lanes A, G, H, L). One exception outside the game: D5's feed secret.
- **Save round trip.** A 600-entry chunked transcript, unknown fields and an own `__proto__` key survive `serializeWorldState`/`parseWorldState` byte-equal, with no prototype pollution.
- **Storage full.** `saveCore` under a quota error leaves the previous save intact and tells the player.
- **Keyed stores.** `__proto__`, `constructor` and `toString` as NPC, place, item or lore names are stored as plain keys everywhere the lanes tried.
- **Memory cost.** On a synthetic 150-NPC, 1,500-entry, 410-chapter world: `ragRetrieve` 53 ms on a memo miss, `memoryTOC` 8 ms; no quadratic blow-up. Budgets are enforced in code.
- **Name resolution.** "Mara the Elder" and "Mara the Younger" stay apart; "The Scarred Woman" is not "The Scarred Man"; "Tam's mother" is not "Tam".
- **Inventory rows.** The count grammar, removing more than held, renaming onto an existing row and the all-or-nothing load door all held.
- **Operator pages.** `admin_console.html` and `bug_tracker.html` put every server-sent and reporter-sent string through `textContent`; mementos are shown in a sandboxed frame behind a CSP the stored page cannot relax; the auth `postMessage` handler checks its origin.
- **Model retries.** `callGM`'s retry is byte-identical and bounded; usage is recorded against the world captured before the await.
- **Car Mode grammar.** "I repeat my offer", "pause at the door", "roll the barrel aside", "one of them" and "never mind the guard" are all left as actions.
- **Talk.** Nothing in `companion-talk.js` writes the campaign; a failed call never fabricates a line; the persona's rules survive the trim.
- **Service worker.** Install fails whole on a missing shell file; every root page outside the shell is network-first.

---

## Z. Coverage gaps and open questions

- **Not read:** `atlas.js` lines 320–660 and 690–1240 (the legacy recipe mode; new campaigns never run it). The CSS in `index.html`. `blueprint-edition.js` and `library-slug.js` (hash-pinned in both repositories). `speaker_browser.html`, `bible_editor.html`, `piper_test.html` and four small viewers were swept for sinks, not read line by line.
- **Not settled:** whether a null can reach a conditions list or a faction list in play (P8, U13); whether the generation-word rule should keep "Hemlock the Younger" apart from a bare "Hemlock" (an owner ruling); whether `COMPANION_XP` is uncapped on purpose (T9); whether the Table Talk pane caps its nodes; whether the server would also refuse a payload turn below its stored turn (its source says it does not — S1 and S2 rest on that reading).
- **Suspected, not established (no row):** after a force-push to master the CI range may shrink to `HEAD~1`, and merge commits are skipped by the per-commit gates (`dev/ci-range.js`); the live render's prompt writer may receive the raw session log, engine notes and hidden tag operands included, and its output is shown in the render's prompt panel and sent to the image provider; a thrown error inside one of the three un-caught async narration lanes would leave the narrator stuck on "Speaking…".
- **Needs a device or a browser:** V2–V7, V13, X6, U5, U6.
- **Needs a live model:** how often a model puts a DC in a check's modifier field (C3) or misorders an item-section reply (C10).
