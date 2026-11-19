# Audit_2026_11_19_Fable — full project code review

> **Scope.** The whole tracked codebase at HEAD `d7ed4ea6` (v1.1451): the engine, the UI shells, the voice and audio
> files, the atlas, the satellite pages and the test gates. Not reviewed: the vendored libraries (`tndmaps.js`,
> `vendor/`, `roller/`), the bible DATA tables, and the server repository (read only where a finding depended on it).
>
> **Method.** Thirteen parallel read-only lanes (Opus) each read one subsystem and wrote evidence; this session (Fable)
> adjudicated. Every finding below says how it was established, in italics after its first sentence:
> **reproduced** = a headless probe against the real engine reproduced it, and I re-ran that probe myself;
> **read and re-checked** = established by reading, and I re-read the cited lines myself;
> **lane-read only** = established by the lane's reading only (I did not re-check it).
> No finding rests on a guess; anything not settled is in section Z. Probes and the lane reports are kept in
> [audit-2026-11-19-evidence/](audit-2026-11-19-evidence/).
>
> **What was not run.** No browser. No live model call. No sabotage battery except #423. Findings that are not marked
> reproduced in the audio, Car Mode and satellite sections have not been seen on a device.
>
> **Row format.** The tables use the TODO columns (`# | Task | Effort | Tier | Status`), so this file opens in
> `todo-viewer.html` like TODO.md. Each row opens with one plain sentence in bold, then its severity and evidence in
> italics, then the mechanism, then the remedy. Severity: High = lost or wrong campaign data, or script running in the
> game's origin · Medium = wrong behaviour a player can reach · Low = latent, rare or cosmetic. ⛨ = touches the drift
> surface. Tier: Fable = Fable or Astra only · Any = legal off-Fable under the safe-changes map. Status glyphs are the
> TODO's: ○ not started · ◐ partially complete · ◉ ready to test · ✅ complete. The row ids (G1, S1, …) are this
> audit's own, not TODO row numbers; the audit as a whole is TODO row #777.
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

## Build plan and rulings (owner 2026-11-19)

The owner asked for a plan to build as much of this audit as possible, with the rulings taken up front. This section is
the plan of record; a session that picks the build up reads it first. Each row's Status says where that row stands.

**Rulings taken.**

| Row | Ruling |
|---|---|
| Review | One independent reviewer agent reads every batch that holds a ⛨ row, before that batch is pushed. Its findings are fixed first. |
| G10 | Accepted, not built. CI tests the committed bytes after the push. |
| U6 | A notice raised while a modal is open pops up, and is also kept in the Console. |
| U11 | In Car Mode a notice fades by itself after 8 seconds and is kept in the Console. |
| A1 | Make notes on ways and inside places work: keyed by sheet, shown on the card. |
| S12 | A campaign deleted in the cloud is removed from this device automatically, and the device says so. A copy holding turns that never reached the cloud is removed too (asked again, confirmed). |
| T9 | `[COMPANION_XP:]` gets the hero's clamp: ten times the companion's level per award. |
| H3 | Fix the injection and also scope a blueprint's rules to its own campaign, in this build. |
| U3 | A refusal's replacement goes through the normal commit, so its tags are applied once. |
| Unattended | The owner is away: no question between batches. A row that needs a ruling nobody gave is skipped, its Status says why, and the build goes on. |
| CI red | If a pushed commit turns CI red and cannot be fixed forward with reasonable effort, revert that commit, leave its row open with the reason, and continue. |

**Decisions I made without asking (say so if any is wrong).**

- **One writer.** This build runs in one Fable-tier session at a time, batch after batch. No parallel lanes and no lighter model, the Any-tier rows included.
- **Sync fixes are in the game only.** S1 and S2 are fixed in `storage-adapter.js`. The server is not changed and not deployed.
- **Schedule bounds (T7).** A label is cut at 200 characters; a 65th pending entry is refused; an entry due more than 100 years out is refused. Each refusal is said.
- **Car Mode grammar (V8).** A short line that opens with "I" is an action, never a command. The car-talk project's copies are re-synced when `car-commands.js` or `car-session.js` change.
- **One frozen hash is re-baselined (P4).** The strip regex changes on purpose, in batch 3, with the reason in the commit.
- **Unguarded clauses get tests.** If re-proving the eight exposed batteries (G1) shows a clause that nothing guards, the missing test is written in batch 0.
- **Not in this build.** The three suspected items in section Z (they become rows if the build confirms them) and the unread legacy map code.

**How each row is built.** A failing test first. Then the fix. Then a sabotage clause that proves the test guards it.
The row's Status here changes in the same commit. One concern per commit; a game-code commit bumps `APP_VERSION`,
`CACHE` and `release-next.json`; a designer-only commit bumps `BP_DESIGNER_VERSION`. Two class guards are added in
`dev/class-guards.js`: a write to the campaign after an awaited model call with no same-campaign check (section X), and
an unescaped field in an HTML-building function (section H).

**The batches, in order.** A batch is pushed when its gates are green and, for a ⛨ batch, when the reviewer's findings are fixed.

| Batch | Rows | Count | Why here | Reviewer |
|---|---|:---:|---|:---:|
| 0. The test gates | G1–G4 first, then G2's target list, then G5–G9, G11, G12 | 11 | Every later proof rests on the sabotage harness telling the truth. Ends with the eight exposed batteries re-proven. | no |
| 1. Cloud sync and saves | S1, S2 first; then S3–S13 | 13 | The two rows that lose play from another device. | yes |
| 2. Wrong-campaign writes | X1–X5, X8, the class helper and guard; then X6, X7 (designer) | 8 | One class; X1 corrupts the always-injected era. | yes |
| 3. Tags, clock and the tag boundary | T1–T11, P1–P5 | 16 | One parser; T1–T3 are high. | yes |
| 4. Prompt, privacy and campaign start | P6–P12, K1, K2, C1, C2, C13–C15, the H3 rule scope | 14 | Canon injection and what the player is told. | yes |
| 5. Memory | M1–M7 | 7 | M1 folds facts away silently. | yes |
| 6. Unescaped HTML | H1–H13, U4 | 14 | One admission row, the sinks, the inline handlers, the class guard. | no |
| 7. The turn loop | U1–U3, U5–U13, C3, C4, C10, V1 | 16 | U1, the #772 and #776 defects, the duplicated Car Mode turn. | yes |
| 8. Voice and Car Mode | V2–V13 | 12 | Tested against fake platform objects; a device check is owed after. | no |
| 9. The atlas | A1–A8 | 8 | Public map mode only. | no |
| 10. The smalls | C5–C9, C11, C12, C16, D1–D5 | 13 | Low rows and the satellites. | no |

132 rows are built; G10 is closed by ruling.

**What the owner owes when the build is done.** A phone and car check of batches 7 and 8 (V2–V7, V13, U5, U6, U11),
a look at the Blueprint Designer's Generate guard (X6), and ordinary live play as the read of everything else.
TODO row #777 closes when every high and medium row here is ✅ or carries a ruling.

---

## G. The test gates

| # | Task | Effort | Tier | Status |
|---|---|:---:|:---:|---|
| G1 | **A sabotage battery that runs the whole suite can report a mutation as "caught" when no test guards it, and since 2026-11-18 it also reports real guards as MISATTRIBUTED in CI.** *High · reproduced.* `dev/tests-252-retained-proof-wiring.js` is part of `run-tests.js` and scans every battery's `find` anchor. Inside a mutated scratch clone the clause being proven no longer matches, so the scan fails and prints `FAIL <battery> :: <label> find target is stale in <file>`. `sabotage.js` judges a clause by exit status plus `out.indexOf(mustFail)`. So: (a) a clause with **no `mustFail`** can never be MISSED; (b) a clause whose `mustFail` is a substring of **its own label** is attributed by the scan's line; (c) since `fd445313` the standalone runner starts no new suite after a failure and the scan is in `START_FIRST`, so on CI's two jobs the real guarding suite often never runs. **Census:** 435 clauses in 36 batteries run the full suite; 15 clauses in 5 batteries have no `mustFail`; 4 clauses in 3 batteries match their own label (`sabotage-231-arc-wall` "chain-close", `sabotage-423-import-ownership` "unsynced marker" and "held checkpoint", `sabotage-jp011-flush-dirty` "multi-byte"). **Reproduced:** in a scratch clone I applied the #423 memory-stamp mutation AND deleted the assertion that guards it; `tests-423` passed alone, `run-tests.js` still exited 1 on the scan only. CI run 44489988053 shows the same battery with two clauses MISATTRIBUTED and two "caught" by label. The #272 E26 fix I pushed on 2026-11-18 was a point-fix of this class. (a) and (b) have existed since the scan joined the suite (`64a3f613`, 2026-08-28). **Remedy:** `sabotage.js` sets an environment flag on the guarded command; the scan's test in `tests-252` skips under it and says so. Then re-prove the 8 batteries named above — some clauses may turn out truly unguarded. | S | Fable | ◐ **Harness fixed 2026-11-19; the re-proof of the exposed batteries is still running.** `sabotage.js` and `scratch-contract-sabotage.js` tell the guarded command which file is under mutation (`TND_SABOTAGE_PROVING_FILE`); the anchor scan leaves that one file out and says so. Tests in `tests-sabotage-meta.js`, `tests-252-retained-proof-wiring.js`, `tests-609-contract-harness.js`; battery `sabotage-777-harness-truth.js` (14 clauses). |
| G2 | **The per-push sabotage sweep never schedules 94 clauses, because it finds a battery's target file by looking for a call spelled exactly `prove(`.** *Medium · reproduced.* Batteries that wrap it (`proveV`, `proveU`, `proveE`, `proveF`) or hold the target in a variable are invisible to `dev/battery-targets.js` `targetsOf`, which `run-sabotage-diff.js` and `prove-before-push.js` both use. 18 battery/target pairs, including 19 clauses on `memory.js` (`sabotage-b38-extractor-refusal`) and 31 on `bible_editor.html`. Since the 2026-11-18 ruling this sweep is the only proof a push gets. **Remedy:** derive targets from the stub collector `check-sabotage-applicability.js` already has. | S | Fable | ✅ **Fixed 2026-11-19.** `battery-targets.js` also reads what each battery hands the harness (`collected`, through the anchor scan's own collector) and holds the one scheduling rule (`due`) both runners use; all 18 invisible pairs are now scheduled. A foreign tree is read from its text only. Test in `tests-252-retained-proof-wiring.js`; 4 clauses in `sabotage-777-harness-truth.js`. |
| G3 | **A clause's attribution word is searched for in the whole output, so it matches when the named test PASSED.** *Medium · reproduced.* 155 of the 215 suites print `PASS <name>`; a `mustFail` that is a bare test name is always present, and any unrelated red is scored "caught". A census found 671 of 3,353 attribution strings verbatim in a pass-printing suite the same battery names (an upper bound). **Remedy:** match only on failure lines. | S | Fable | ◐ **Fixed in both harnesses 2026-11-19; the full sweep that shows which clauses were leaning on a PASS line is still running.** A catcher counts only on a line that does not report a PASS, ok, SKIP or ✓ (`attributedOn`). |
| G4 | **The harness never runs the guarded command on the unmutated file, so a command that is red anyway proves every clause that has no attribution word.** *Medium · reproduced.* 27 batteries hold about 150 such clauses. A test that reads a gitignored input is red in the scratch clone for this reason alone. **Remedy:** one clean run per group first; a red baseline makes the group UNOBSERVED. This also closes G1(a). | S | Fable | ◐ **Fixed in both harnesses 2026-11-19; the full sweep is still running.** The guarded command runs once on the unmutated file per clone, target and command; a red clean run makes its clauses UNOBSERVED. Its first catch was the meta suite's own scratch-isolation case, which had been red before any mutation. |
| G5 | **`dev/static-server.js`, the documented way to serve the game locally, answers the whole network, serves sibling folders outside the repo, and dies on a malformed URL.** *Medium · reproduced.* `listen(8123)` binds every interface; the containment test is a string prefix, so `/..%2ftraffic-and-dragons-server%2f…` returns 200; `decodeURIComponent('/%')` is uncaught. The repo it serves includes `.git` and the gitignored saves. **Remedy:** bind `127.0.0.1`; use `path.relative`; answer 400 on a bad URL. | S | Any | ✅ **Fixed 2026-11-19.** The server binds the loopback addresses only, judges containment by `path.relative`, and answers a malformed URL with 400. Tests in `tests-777-gates.js`; 3 clauses in `sabotage-777-gates.js`. |
| G6 | **`install-bible.js` crashes on an item bible, so every item save from the bible editor is refused.** *Medium · reproduced.* The item type falls into the capability branch and reaches `Object.keys(undefined)` (line 123). Nothing is lost: it fails before any write. `tests-install-bible.js` has no item case. | S | Any | ✅ **Fixed 2026-11-19.** `install-bible.js` has an item branch: entry count, lowercase keys, a category on every entry, and a refusal when the file would drop below half the current entries. Six item cases in `tests-install-bible.js`; 3 clauses in `sabotage-777-gates.js`. |
| G7 | **`TODO_Atlas.md` is outside every tracker gate in CI.** *Low · reproduced.* The per-commit lint runs with `--file`, which never loads the atlas file, so a `TODO.md` row that reuses an atlas row's number passes CI; only the local hook's id pass reads it, and no shape, column, size or move check reads it anywhere. `todo-viewer.html` does not read it either. This gap came with the 2026-11-18 split. **Remedy:** pass the atlas file to the lint in CI and run the other passes over it. | S | Any | ✅ **Fixed 2026-11-19.** CI's id pass is handed the atlas file (`--atlas-file`); `lint-todo.js --tracker TODO_Atlas.md` and `check-todo-columns.js --tracker` run the shape, size, moved-row, archive-move and column passes over it, in the hook and per commit in CI. Not done: `todo-viewer.html` opens whichever file it is given, so it needed no change; a row moved between the two trackers is not byte-checked. Tests in `tests-777-gates.js`; 8 clauses in `sabotage-777-gates.js`. |
| G8 | **`ci-status.js` says GREEN when the newest runs timed out or failed to start** *Low · reproduced.*, because it keeps only `success` and `failure`; and the engine job sets no `timeout-minutes`. This is the blind gate #646 was written to end. | S | Any | ✅ **Fixed 2026-11-19.** `timed_out`, `startup_failure` and `action_required` are red; the engine job has `timeout-minutes: 240` (longest honest run seen: 137). Tests in `tests-646-ci-status.js`; 2 clauses in `sabotage-777-gates.js`. |
| G9 | **`run-sabotage-diff.js` exits green when it cannot read its range** *Low · lane-read only.* ("nothing to run"); its sibling tools refuse the same condition. | S | Any | ✅ **Fixed 2026-11-19.** An unreadable range exits 2 and says that nothing was proven. Test in `tests-252-retained-proof-wiring.js`; 2 clauses in `sabotage-777-harness-truth.js`. |
| G10 | **The pre-commit hook tests the working tree, not the staged commit.** *Low · lane-read only.* With sessions sharing one tree and `git commit --only`, the bytes tested can differ from the bytes committed; CI catches it after the push. | M | Any | ✅ **Accepted, not built (owner 2026-11-19).** CI tests the committed bytes after the push; the hook stays as it is. |
| G11 | **`dev/bible-server.js` answers reads from any website** *Low · lane-read only.* (CORS `*`; `/health` carries the repo path), dies on a malformed URL, and stages every upload at one fixed temp path. Writes are guarded. | S | Any | ✅ **Fixed 2026-11-19.** A reply names the asking origin only when it is local or `null`; `/health` gives the folder and the process id to a local asker only; a malformed URL is an unknown route; each upload has its own stage folder. Left as it was: a `null` origin (a file:// page, but also any sandboxed frame) can still read the bible text and the worksheets, which hold nothing private. Tests in `tests-777-gates.js`; 4 clauses in `sabotage-777-gates.js`. |
| G12 | **The storage-key census misses ten keys that exist only in satellite pages** *Low · reproduced.*, while CLAUDE.md calls its output "the full list". | S | Any | ✅ **Fixed 2026-11-19.** The census reads the root and website pages too; the table in `DOC/contracts/sync.md` now holds 80 keys, the ten page-only ones among them. Test in `tests-777-gates.js`; 1 clause in `sabotage-777-gates.js`. |

---

## S. Cloud sync and persistence

| # | Task | Effort | Tier | Status |
|---|---|:---:|:---:|---|
| S1 | ⛨ **Switching campaigns hands the old campaign's turn number to the new one as its sync base, which switches the new campaign's overwrite guard off for the session.** *High · reproduced.* `switchToCampaign` fires campaign A's POST, then `resetSyncState()` for B. A's 200 lands afterwards and `_syncOk(turnAt)` raises B's base (`storage-adapter.js` `_syncNow`, lines 683–719; no check that the posted campaign is still active — the reconcile has that check at line 932). Probe: A at turn 2000, B at turn 10 → B's next POST carries `baseTurn 2000`. The server refuses only when its stored turn is above `baseTurn` (server `index.js:715`), so an older B replaces newer B play from another device with no 409. The same stale handler can pause B on A's 409 or re-home B on A's 403. **Remedy:** capture the campaign id in `_syncNow` and ignore every response branch when it is no longer active, or drop responses from before the last `resetSyncState`. | S | Fable | ✅ **Fixed v1.1452, review fix v1.1454.** `_syncNow` captures the posted campaign and drops every answer once that campaign is no longer open, checked when the headers arrive and again when a 409, 403 or 413 body has been read (the independent review reproduced a switch in that gap); the answer clears only that campaign's unsynced marker and is logged. Fourteen cases in `dev/tests-777-sync.js`; clauses in `dev/sabotage-777-sync.js`. The server is unchanged. |
| S2 | ⛨ **If the player sends a turn while the boot reconcile is in flight and the cloud is ahead, this device keeps its older copy, takes the cloud's turn as its base, and its next save overwrites the newer cloud copy.** *High · reproduced.* `_reconcileFromServer` seeds `_lastAckTurn = serverTurn` (line 995) before it tests `busy` (line 1011) and skips the adopt without a log, toast or retry. Probe: local 10, server 50, busy → next POST `turn 11 baseTurn 50`, accepted. Turns 12–50 from the other device are gone. **Remedy:** when the adopt is skipped for `busy`, do not seed the base; say so; run the reconcile again after the turn commits. | S | Fable | ✅ **Fixed v1.1452.** When the cloud is ahead and a turn is in flight the reconcile takes no sync base and enters the conflict pause. Two limits, both recorded in `sync.md`: the reconcile is not re-run when the turn commits (it would discard the turn just played without asking); and the pause lasts for the page, so a player who plays past the cloud's turn and then reloads is the device that is ahead, and the standing local-wins rule pushes its copy, as after any 409 pause (review finding 2). |
| S3 | **A local save that fails to parse or to migrate is dropped with no message and no rescue copy, and the boot shows the character wizard.** *Medium · reproduced.* `state.js` `loadState` (lines 907, 916) returns false silently unless the save is from a newer build. The core key has no rescue (only the session and memory keys do). A new game then writes over the unreadable bytes. Reproduced with a truncated core and with `character.spells:[null]`. **Remedy:** rescue the raw core bytes, say why, and refuse the wizard over an unreadable save as the version refusal does. | S | Fable | ✅ **Fixed v1.1453, review fixes v1.1454.** A save that fails to parse or to be prepared is kept a second time, the reason is logged, and the boot shows a refusal screen in place of the wizard (download, campaign list, or a new game on purpose); the boot adopts nothing from the cloud over it. Seen in headless Chrome on desktop and a 375 px phone (`dev/tests-777-sync-browser.js`, a CI step): the first screenshot showed the reason toasted over the screen's buttons on the phone, so the boot no longer toasts it; the Campaign list button opens the list without the wizard's home-page handoffs (review finding 3). |
| S4 | **A `.tnd` import that throws inside migration leaves the app half-switched while the screen says "Import failed".** *Medium · reproduced.* `importSaveData` installs `worldState`, the active id and memory, then calls `migrateWorldState()` with no rollback (lines 1140–1180). The next save writes the half-migrated import under the new id. **Remedy:** migrate and heal the detached objects before installing them. | S | Fable | ✅ **Fixed v1.1453.** The installing half of the import writes nothing to storage; when it throws, the globals, the active id and the held camp are put back. The reviewer checked the rollback against everything done before the throw and found it sound. |
| S5 | **A pulled or restored memory of `{}` is accepted as healthy; the first reader throws because it has no stores.** *Medium · reproduced.* `_pulledMemory` (ui-campaigns.js:260), the reconcile adopt (storage-adapter.js:1020, which does not use `_pulledMemory` at all) and `checkpointRestore` (state.js:859) all accept it. `sync.md` §16 D5 says `{}` is broken and must become `blankMemory()` with a loud line. **Remedy:** one shared "is this a memory" test at all three sites. | S | Fable | ✅ **Fixed v1.1453.** `memoryShapeIssue` / `memoryAdmit` are the one test (six core stores). `healMemory` throws on an empty shell, so the load rescues it and a camp restore rolls back; the reconcile adopt, the manual pull and the manual push use the same test. The reviewer traced every `healMemory` caller and found no legitimate memory that hits the throw. |
| S6 | **Loading a `.tnd` file is not blocked while a turn is in flight, so the old campaign's reply lands in the imported one.** *Medium · read and re-checked.* `importSave` and `importSaveData` never check `busy`; the other campaign doors do (audit E3). **Remedy:** refuse while `busy`. | S | Any | ✅ **Fixed v1.1453.** `importSaveData` refuses while a turn is in flight. |
| S7 | **Load on a campaign this device holds waits for the cloud probe and then switches without re-checking `busy`.** *Medium · read and re-checked.* `campLoad` checks once (line 266); the `keep-local` branch and the rewind modal's cancel (lines 282, 287) call `_campLoadLocal` after an await of up to 20 s. **Remedy:** re-check in `_campLoadLocal`. | S | Any | ✅ **Fixed v1.1453.** `_campLoadLocal` checks `busy` again at the switch. |
| S8 | **Four Blueprint Designer scripts are served cache-first, and designer-only commits do not bump `CACHE`, so authors run stale code.** *Low · lane-read only.* `designer-acts.js`, `designer-assistant.js`, `designer-prose.js`, `designer-assistant-ui.js` match no network-first branch in `sw.js:203`. Two past commits changed them with no `sw.js` change. The class guard checks pages, not the scripts they load. **Remedy:** add `designer-` to the regex; extend the guard to scripts of network-first pages. | S | Any | ✅ **Fixed v1.1453.** `/designer-` is in the service worker's network-first route, and the class guards derive the rule for every script or stylesheet a network-first page loads. |
| S9 | **A failed portrait upload (HTTP 4xx or 5xx) is treated as success and never retried.** *Low · lane-read only.* `syncPortrait` (storage-adapter.js:532) has no `r.ok` check. | S | Any | ✅ **Fixed v1.1453, review fix v1.1454.** A server fault or a rate limit on a portrait upload is logged and retried with the next save; a refusal that can never succeed (a 413, a 400) is said once and waits for a portrait to change, so the portraits are not re-sent with every save (review finding 4). |
| S10 | **A re-homed campaign loses its preserved transcript backup.** *Low · lane-read only.* `rehomeCampaign` does not move `tnd_transcript_rescue_v1_<id>` (or the store and clock rescue keys); the promised auto-recovery then looks under the new id. | S | Fable | ✅ **Fixed v1.1453.** `rehomeCampaign` moves every preserved copy (`campRescueKeys`). |
| S11 | **A deleted or re-homed campaign's camp checkpoint stays in IndexedDB forever.** *Low · lane-read only.* Nothing deletes a key in the `checkpoints` store; each holds a full world. | S | Any | ✅ **Fixed v1.1453.** A deleted or torn-down campaign's IndexedDB camp leaves with it; a re-homed campaign's camp moves to the new id. Tested against stubbed IndexedDB calls only. |
| S12 | **A campaign deleted on another device leaves its local slot behind with no way to remove it.** *Low · lane-read only.* `mergeCampaignLists` prunes the row; every removal path is row-driven. Hundreds of KB per mature save on a quota-limited phone. | S | Any | ○ **Ruled (remove automatically, a copy with unsent turns included) but NOT built: it needs one more ruling.** The only signal this device has is that the campaign is absent from the server's list. That is also what the device sees after a server data loss or a restore from an older backup, and auto-removal would then delete every device's surviving copy of every campaign, with no undo. Today the list row is pruned and the local copy stays (the deliberate UA20 rule). Safe ways to build the ruling: (a) the server keeps a deletion record per campaign and the device removes its copy only on that record; (b) accept the data-loss risk as it stands. Needs the owner's choice; (a) also needs a server change, which this build does not make. |
| S13 | **`campCloudPushSilent` gives no reason when the stored world cannot be parsed** *Low · lane-read only.*, and the rename path that calls it with no callback is fully silent. | S | Any | ✅ **Fixed v1.1453.** The manual push names the reason for an unreadable world and refuses a memory with no stores. |

---

## X. A model call that outlives the turn writes into whichever campaign is loaded

One class, eight instances. Each call is started inside a turn but is not awaited by it, or awaits past a campaign door
that only tests `busy`. None captures the world before the `await` and compares after. The item-kind and atlas settles
and the render job already do this correctly (`worldState!==ws`, `_renderJobLive`); these do not.
**Class remedy:** one helper that captures `{worldState, memory, campId}` and refuses loudly on a mismatch, used by
every post-await writer; and a class guard in `dev/class-guards.js` that finds an `await callGM` followed by a write to
`worldState` or `memory` with no such check.

| # | Task | Effort | Tier | Status |
|---|---|:---:|:---:|---|
| X1 | ⛨ **An era compiled for one campaign is written into another.** *High · reproduced.* `memory.js` `compileEraIfDue` (2614–2635), fired un-awaited from `summarize`. Probe: campaign B (turn 7) ends with campaign A's era for turns 1–200, saved. The era block is injected every turn; `eraCoveredEnd()` then stops B's own chapters up to turn 200 from ever compiling, and the Quest Journal hides them behind A's text. The merge branch has the same hole. | S | Fable | ◉ **Fixed v1.1455; awaiting the batch's independent review.** `compileEraIfDue` takes a campaign mark before the call and writes nothing when the state that is open is no longer the one it started in (the compile and the merge); a dropped era releases its lock and compiles in its own campaign later. Reproduced through the real `switchToCampaign` before the fix. Cases in `dev/tests-777-campaign.js`; clauses in `dev/sabotage-777-campaign.js`. |
| X2 | **The "story so far" recap is written into another campaign.** *Medium · reproduced.* `game.js` `refreshSynopsis` (4622–4631). B's journal shows A's story and B's own recap is marked not due. | S | Fable | ◉ **Fixed v1.1455; awaiting review.** `refreshSynopsis` checks its mark before writing; a dropped recap releases its lock. |
| X3 | ⛨ **A companion sheet generated for campaign A is attached to a same-named companion in campaign B, and its spell definitions land in B even when no such companion exists.** *Medium · reproduced.* `generateCompanionSheet` (game.js:1966–1976); it is also restarted on every campaign load. | S | Fable | ◉ **Fixed v1.1455; awaiting review.** `generateCompanionSheet` checks its mark before the spell definitions are filed and before the attach; a failed request for another campaign attaches no stub either. |
| X4 | **Suggested-action buttons from campaign A are saved into campaign B when their turn numbers match.** *Low · lane-read only.* `generateActions` compares `worldState.turn` only (game.js:830, 847). | S | Any | ◉ **Fixed v1.1455; awaiting review.** The suggestion call is judged by its campaign mark as well as the turn number. |
| X5 | **The last action survives a campaign load.** *Low · lane-read only.* `lastAction` is reset only in `startGame`; Car Mode's retry would send A's action into B, and the first prompt built in B uses A's text as its retrieval query. | S | Any | ◉ **Fixed v1.1455; awaiting review.** Every door that installs another state clears `lastAction` (in `campaignEpochBump`). |
| X6 | **Blueprint Designer: Generate replaces the working copy after the author closed the modal and kept editing.** *Medium · read and re-checked.* `openGenerate` awaits about a minute, then `bp=normalizeBlueprint(draft…)` with no staleness guard; the IndexedDB draft is overwritten too. Every sibling model path in the page has the guard. | S | Any | ◉ **Fixed, designer v0.79; awaiting review.** Generate replaces nothing once its window is closed or another blueprint is open. Run in headless Chrome (`dev/tests-777-designer-browser.js`, a CI step). |
| X7 | **Blueprint Designer: Review findings and Apply patches land on whichever blueprint is open when the model answers.** *Medium · lane-read only.* Lines 1355 and 1483–1489. | S | Any | ◉ **Fixed, designer v0.79; awaiting review.** A review's findings and a fix's patches are written only to the blueprint they were made for (`bpDoc`, a document counter: a failed fix's rollback replaces the object, so object identity would have made the other fixes of an Apply-all refuse). |
| X8 | **Pressing Begin while the review page's portrait render is running clears `busy` in the middle of skeleton generation, and the portrait is lost.** *Medium · lane-read only.* `ftRenderPortrait` sets `busy=false` unconditionally (char-creation.js:157); `confirmChar` never checks `busy`. | S | Any | ◉ **Fixed v1.1455; awaiting review.** Begin refuses while a generation holds `busy`, and says so. `ftRenderPortrait` still clears `busy` unconditionally; with Begin refused nothing else can take it during the render. |

---

## T. State tags and the clock

| # | Task | Effort | Tier | Status |
|---|---|:---:|:---:|---|
| T1 | ⛨ **`[DOWNED_RESOLVED:dead]` kills a hero who is not down, and the rescued form files a false Defining Moment.** *High · reproduced.* `tag_table.js:588–593` never tests `worldState.downed`. A GM who uses the tag for a fallen foe or companion spends one of the hero's respawns; on the fourth death the campaign ends. The village no-harm gate is not called on this route. **Remedy:** refuse every outcome unless the hero is downed, loudly. | S | Fable | ◉ **Fixed v1.1456; awaiting the batch's independent review.** `[DOWNED_RESOLVED:]` on a hero who is not down is refused and said; a death in the same reply that drops the hero still counts. |
| T2 | ⛨ **Six tags swallow the tag after them when they are one field short, and the swallowed text lands in canon.** *High · reproduced.* Fields written `([^|]+)` have no `\]` in the class: `FUTURE_EVENT` (1553), `LOCATION_SIZE` (708), `COMBAT_START` damage (1188), `NPC_SUPERSEDE` (1562), `NPC_LINK` (1571), `NPC_FACTION` (1573); `FACTION_REL`, `SAVE_MOD` and `COMPANION_ABILITY` have the same shape (not run). Observed: `[NPC_LINK:Zarith|Guard Captain] later [NPC:Bob|calm|ally]` files a real edge Zarith ↔ Bob; `NPC_SUPERSEDE` replaced Bram's knowledge with `"active"`. The player sees clean prose, and for two of them a line saying the tag was dropped. **Remedy:** `[^|\]]+` in each group. | S | Fable | ◉ **Fixed v1.1456; awaiting review.** Every `|`-separated field in a handler pattern is `[^|\]]+` (18 handler groups); the suite derives the rule from the source. |
| T3 | ⛨ **A spell definition's tier is never clamped, and it sets the caster's mana pool for good.** *High · reproduced.* `[SPELL_DEF:…|tier=999999]` gives a pool of 1,000,000; `tier=-50` gives a negative maximum (tag_table.js:1501; the overlay is write-once). **Remedy:** clamp to the bible's range and refuse outside it. | S | Fable | ◉ **Fixed v1.1456; awaiting review.** A `[SPELL_DEF:]` tier outside the capability bible's own range (`capTierMax()`) is refused and said; a tier already on a save is read inside the range. |
| T4 | ⛨ **`[TIME_ADVANCE:1.5h]` advances five hours, and `[SCHEDULE:…|3 weeks]` is filed as one minute.** *Medium · reproduced.* `clock.js` `parseDuration` (155–167) reads only the digits before the unit and knows no weeks; `parseStrictFutureDuration` in the same file reads "3 weeks" correctly, so the same phrase means two things. **Remedy:** accept decimals and `w`; warn when a non-empty string parses to zero. | S | Fable | ◉ **Fixed v1.1456; awaiting review.** `parseDuration` reads decimals, weeks and unit words, and a unit must end; an unreadable `[TIME_ADVANCE:]` passes one minute and says so; an unreadable `[SCHEDULE:]` is kept as a pending event and said. |
| T5 | ⛨ **After a rest that names dawn, the engine reports a clock mismatch and leaves the stale time of day.** *Medium · reproduced.* The TIME handler reads the first `[TIME:]` in a reply (tag_table.js:672); `clockNamedWake` reads the last. The next turn's note then demands a rest the party just took. **Remedy:** read the last, as the #389 contract does. | S | Fable | ◉ **Fixed v1.1456; awaiting review.** `[TIME:]` reads the last one of a reply. |
| T6 | ⛨ **Common malformed tags are stripped from the prose, change nothing, and are reported nowhere.** *Medium · reproduced.* `[COMBAT_END]` with a fight open, `[REST]`, `[REST:full]`, `[QUEST:Title]`, `[NPC:Name]` or four fields, `[XP:-50]`, `[SUBLOCATION_LEAVE:x]`, and `[GOLD:a few coppers]` (its "carries no amount" refusal at line 604 can never run). The near-miss tripwire covers eleven rarer tags and none of these. **Remedy:** call `__tagNearMiss` at the head of NPC, QUEST, GOLD, XP, REST and COMBAT_END. | M | Fable | ◉ **Fixed v1.1456; awaiting review.** The near-miss tripwire covers NPC, QUEST, GOLD, XP, REST and COMBAT_END (bare forms too) and SUBLOCATION_LEAVE with an operand. |
| T7 | ⛨ **The schedule has no bound on count, label length or horizon, and every pending entry rides the prompt every turn.** *Medium · reproduced.* A 5,000-character label due in 274 years is accepted; 301 entries make a 23 KB clock block (clock.js:318–360, 696–718). **Remedy:** clamp the label and the horizon; cap the count with a loud refusal. | S | Fable | ◉ **Fixed v1.1456; awaiting review.** Bounds as stated in the build plan (label 200, 64 pending, 100 years); each refusal or cut is said; a future event the schedule refuses is kept as pending. |
| T8 | ⛨ **Companion conditions and abilities compare names case-sensitively; the hero's do not.** *Low · reproduced.* Duplicates pile up and removal fails (tag_table.js:1910, 1916, 1924 against 1596, 1607). | S | Fable | ◉ **Fixed v1.1456; awaiting review.** Companion condition, cure and ability names compare without case. |
| T9 | ⛨ **`[COMPANION_XP:]` is uncapped while `[XP:]` is clamped to ten times the level.** *Low · reproduced.* Whether that is deliberate is not known. | S | Fable | ◉ **Fixed v1.1456 (owner ruling: the hero's clamp); awaiting review.** `[COMPANION_XP:]` is cut to `GM_XP_CAP_PER_LEVEL` × the companion's level and the cut is said. Four older engine fixtures were brought inside the clamp. |
| T10 | ⛨ **Extreme operands:** *Low · reproduced.* a GOLD figure of about 307 digits sets the purse to Infinity, which saves as null; an `ENEMY_HP` heal exceeds the maximum; `COMBAT_START` with hp 0 opens and closes the fight at once. | S | Fable | ◉ **Fixed v1.1456; awaiting review.** A `[GOLD:]` beyond `GOLD_TAG_MAX_CP` is refused; an enemy heal stops at the foe's maximum; `[COMBAT_START:]` below 1 HP is refused and said. |
| T11 | ⛨ **The near-miss tripwire says "malformed — dropped" for tags the looser regex then applies** *Low · reproduced.* (the T2 cases). | S | Fable | ◉ **Fixed v1.1456 with T2; awaiting review.** A tag the tripwire calls dropped can no longer be applied by a looser pattern beside it. |

---

## P. The tag-application boundary and the prompt

| # | Task | Effort | Tier | Status |
|---|---|:---:|:---:|---|
| P1 | ⛨ **An unclosed allowed tag in a review call carries a forbidden tag past the #264 whitelist, and the party is moved.** *Medium · reproduced.* The whitelist regex body `[^\]]*` crosses a `[` (api.js:3481). `[QUEST:Find the cat|completed … [LOCATION:Magnimar]` is kept whole as one QUEST tag, then the LOCATION handler finds the inner tag. **Remedy:** `[^\]\[]*`. | S | Fable | ◉ **Fixed v1.1456 by P4's rule; awaiting review.** The unclosed-opener pass runs before the whitelist, so no allowed tag's body can reach a forbidden tag. The whitelist pattern itself is unchanged (a change there would be unreachable). |
| P2 | ⛨ **A model-written companion spell definition can run any tag through the full parser.** *Medium · reproduced.* `spellDefTag` strips `]` but not `[` (game.js:1583), and `canonizeCompanionSpellDefs` calls `applyMuts` with no whitelist (1593). A `[LOCATION:` in an effect text moved the party. **Remedy:** `applyMuts(…,{allow:["SPELL_DEF"]})` and strip `[`. | S | Fable | ◉ **Fixed v1.1456; awaiting review.** A model-written spell definition carries no bracket, and the text runs under `{allow:["SPELL_DEF"]}`. |
| P3 | ⛨ **Three tags are applied when written in lower case, but every safety net is upper-case only.** *Medium · reproduced.* `[rest:long]`, `[alignment:good+2]` and `COMPANION_ALIGNMENT` handlers carry `/i`; the review whitelist, the strip, the unknown-tag scan and the provenance ring do not. A whitelisted review call performed a full long rest; the tags stay visible in the story and are spoken. **Remedy:** one rule for case, pinned. | S | Fable | ◉ **Fixed v1.1456; awaiting review.** REST, ALIGNMENT and COMPANION_ALIGNMENT match an upper-case name only; the operand may be in any case. The suite scans tag_table.js for a case-blind tag name. |
| P4 | ⛨ **An unclosed tag silently removes all prose up to the next tag's `]` from the display and the narrator, while both tags apply.** *Medium · reproduced.* `buildCtTags` body `[^\]]*` (tag_table.js:97). The transcript keeps the raw text. **Remedy:** `[^\]\[]*` plus a loud strip of an opener with no close; the frozen strip hash needs a deliberate re-baseline. | S | Fable | ◉ **Fixed v1.1456; awaiting review.** `tagDropUnclosed`: an opener that is never closed loses its token before the whitelist, the table and the strip; the prose stays, the next tag is read on its own, and the player is told. |
| P5 | ⛨ **A tag handler that throws leaves its partial write and tells nobody but the console.** *Medium · reproduced.* `applyMutsTable` pushes to `R.errors`; `applyMuts` uses that only for envelope bodies (api.js:3499). No mutation line, no toast, no ring entry, no bug report. **Remedy:** push a ⚠ line and record `errors` in the ring entry. | S | Fable | ◉ **Fixed v1.1456; awaiting review.** A handler that throws is a line for the player, an error report and a ring entry. |
| P6 | ⛨ **A failed turn can pay a withheld reward twice.** *Medium · reproduced.* `buildIdentityConflictNudge` (api.js:1794–1813) queues the claim and opens its modal while the notes are built, before the request. A failed request restores the conflict but not the claim; if the player accepted during the wait, the next turn queues and pays it again (+50 XP became +100). **Remedy:** stage the shelve until commit. | M | Fable | ○ |
| P7 | ⛨ **The geography block lists every living NPC ever sighted elsewhere, with no cap.** *Medium · reproduced.* 300 NPCs add 17,000 characters to the uncached half of every turn, though the roster line folds the same NPCs (api.js:123–137). **Remedy:** apply the roster rule and a "+N more on record" count. | S | Fable | ○ |
| P8 | ⛨ **One null entry in a sheet's conditions list makes every turn fail, and the load does not repair it.** *Low · reproduced.* `condInjectFmt` and `buildConditionAudit` read it unguarded. No engine writer produces a null; the doors are a hand-edited file or the character editor. **Remedy:** filter at admission, loudly. | S | Fable | ○ |
| P9 | ⛨ **The legacy-character block puts the character's age into the gameplay prompt** *Low · reproduced.*, against the ruling that age reaches no gameplay prompt (api.js:2733). | S | Fable | ○ |
| P10 | ⛨ **When the public-map path withholds a reply's tags, no provenance entry is written for that turn** *Low · lane-read only.* (api.js:3491–3495). | S | Fable | ○ |
| P11 | **A legacy `[ACTIONS:]` line followed by a tag puts the tag into the third button** *Low · lane-read only.* (pre-v1.110 saves only). | S | Any | ○ |
| P12 | ⛨ **The engine tells the GM to file phrase fragments as places.** *Medium · reproduced.* `detectLocationFilingCue`'s fallback regex carries `/i`, so its `[A-Z]` matches any letter (game.js). "You step through the doorway into the great hall" yields the place "into the great hall"; after eight turns the note asks for `[LOCATION:into the great hall]`. **Remedy:** drop the flag on the name half. | S | Fable | ○ |

---

## M. Memory

| # | Task | Effort | Tier | Status |
|---|---|:---:|:---:|---|
| M1 | ⛨ **Distinct short facts about a person or place with a two-word name are folded into one, and the others go to the archive, which no prompt reads.** *High · reproduced.* `feNearDup` (memory.js:1489) counts shared tokens, and nearly every fact restates the name, which supplies two. Observed: three lore lines about "The Glass Spire" kept one; "Mara Voss lost her left eye in the war" was folded into "Mara Voss is the harbor master". The same facts under a one-word name all survive. Console only. **Remedy:** drop the entity's own name tokens before counting. | S | Fable | ○ |
| M2 | ⛨ **When anything fails after an extraction has been applied, the same window is filed again on the retry.** *Medium · reproduced.* A failed save (storage full) or a throw in `retainSessionTail` leaves the chapter, decisions and scene events in memory; the retry files them a second time (memory.js:3152–3216). **Remedy:** apply to detached copies and swap in after the save succeeds. | M | Fable | ○ |
| M3 | ⛨ **A superseded-fact needle of a single space retires an unrelated live fact.** *Medium · reproduced.* `applySummaryExtract` (2792–2796) matches `old` by substring with no trim or minimum. **Remedy:** trim; require an exact or word-bounded match of a minimum length. | S | Fable | ○ |
| M4 | ⛨ **A scene-only fact deferred past the re-ask cap comes back as permanent knowledge** *Low · reproduced.* (the deferred row drops `kind:"scene"`; memory.js:2999–3011). | S | Fable | ○ |
| M5 | ⛨ **A failing era compile is console-only and re-bills a call at every summarize, indefinitely** *Low · lane-read only.*; it never reaches drift health (2631–2633). | S | Fable | ○ |
| M6 | ⛨ **Map edges are compared as raw strings, so a pointer holding an alias records a second edge for the same pair** *Low · reproduced.* (`fileLocation` 655–661). | S | Fable | ○ |
| M7 | ⛨ **A repeated companion want is queued every time with no cap, the whole queue rides the prompt, and a completed want's duplicate is promoted again.** *Low · reproduced.* `agendaFile` (helpers.js:572); the queue travels on the portable sheet. | S | Fable | ○ |

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

| # | Task | Effort | Tier | Status |
|---|---|:---:|:---:|---|
| H1 | **A `.tnd` save runs script at the next reload: the hero's name and the location are written raw into the boot and campaign-load lines.** *High · reproduced.* `addMsg` assigns `innerHTML` (ui-shell.js:323); callers at ui-boot.js:451–452 and ui-campaigns.js:245–246. The location is also model-written through `[LOCATION:]`. | S | Any | ○ |
| H2 | **A `.char` file runs script when previewed.** *High · reproduced.* Stats, level, HP, XP, class and subrace go raw into the preview modal (ui-browsers.js:502, 516, 521) and the wizard's review card (char-creation.js:191–193); also ui-browsers.js 614, 739, 922, 442, 991. | S | Any | ○ |
| H3 | **A `.blueprint`'s rules become stored HTML that runs every time Narrative Rules is opened, on every campaign, on that device.** *High · reproduced.* `showRulesModal` paints `customRules[i]` raw (ui-modals.js:119); the import pushes blueprint rules into the device-wide store (game.js:3624–3629). | S | Any | ○ Ruled (owner 2026-11-19): fix the injection AND scope a blueprint's rules to its own campaign in this build (batch 4); rules already copied to the device stay where they are. |
| H4 | **`character_editor.html` lets a loaded `.char` break out of its attributes.** *High · reproduced.* Its own `esc()` does not escape `'`, every input is single-quoted, and skill values go in raw (lines 112, 208–212, 250, 256). A harmless "O'Brien" is also cut to "O". **Remedy:** use `escHtml`, as the designer does. | S | Fable | ○ |
| H5 | **The read-only preview of a library or other-campaign character paints age, deity, alignment and stats raw, before the player accepts the import.** *High · reproduced.* `showReadOnlyCharSheet` (ui-sheets.js:738, 744) and `csSheetSections` (110); the live sheet escapes the same fields at line 292. | S | Any | ○ |
| H6 | **A model-written companion sheet's alignment and spell level are painted raw** *High · reproduced.* on the NPC sheet (ui-sheets.js:513), the sheet sections (157), the spell panel (ui-panels.js:453, 459) and the hero sheet (309). `generateNpcSheet` passes them through verbatim; story text can steer the model. | S | Any | ○ |
| H7 | **A character name containing `");` runs as code from the library list.** *Medium · reproduced.* The delete handler is an inline JS string; the HTML parser decodes `&quot;` before the handler is compiled (ui-browsers.js:444; same pattern on ids at ui-campaigns.js 215–238). | S | Any | ○ |
| H8 | **A sheet's agenda paints `since` and `done` raw** *Medium · reproduced.*, and the agenda travels on portable sheets with no admission rule (helpers.js:605–607). | S | Fable | ○ |
| H9 | **The NPC sheet's "Bond from <hero name>" label is raw** *Medium · reproduced.* (ui-sheets.js:540–541; `csKv` does not escape its key). | S | Any | ○ |
| H10 | **The usage modal paints an imported save's usage kinds and counters raw** *Medium · reproduced.* (ui-modals.js:413–420). | S | Any | ○ |
| H11 | **`map_viewer.html` paints an imported save's `visits` value raw** *Medium · lane-read only.* (lines 348, 374). | S | Any | ○ |
| H12 | **Numeric sheet fields are concatenated raw across the sheets, the party panel and the Sync modal** *Low · lane-read only.* (ui-panels.js:22, 181; ui-sheets.js 118, 126, 138, 144, 200, 520, 550; ui-modals.js 211–219 inside single-quoted attributes). Whether any import path coerces them was not settled. | M | Any | ○ |
| H13 | **Four pure renderers print one field raw each:** *Low · reproduced.* `elapsedTicker` its base text (helpers.js:419; today's callers pass literals), `bibleCardHTML` the tier (2871), `synopsisBlockHtml` its turn numbers (4389, against its own "every text is escaped" note), `accountDoorsHtml` server-sent provider names (2522). | S | Fable | ○ |

---

## U. The turn loop and the in-game UI

| # | Task | Effort | Tier | Status |
|---|---|:---:|:---:|---|
| U1 | ⛨ **Death's arrival, and the campaign's final denouement, are dropped without a word when a post-turn request is still running.** *Medium · reproduced.* Both are scheduled with `setTimeout(…,0)` from inside the commit (game.js:4265, 4248) while `busy` is true. `sendAction` then awaits the map and item requests (3041–3044); the timer fires during a network wait and returns at `if(busy…)return` (2873, 4330). The death stage has already advanced, so the player's next line is taken as their question to a Death who never appeared. After the fourth death every turn is refused and no ending shows until a reload. More likely since #766, #771 and #776 added awaited requests. Probe on the real `sendAction`: with a settle that takes 100 ms, only the downed note is sent; the arrival never is. **Remedy:** run them from `sendAction`'s tail after `busy` clears; never drop silently. | S | Fable | ○ |
| U2 | **The Rest button works mid-turn, so a rest can land twice and lose a day.** *Medium · read and re-checked.* `restSpells` has no `busy` check (game.js:4187; button at ui-panels.js:466). The button path heals, rolls the clock and takes a checkpoint of a half-turn; the reply's `[REST:long]` then rolls to the next dawn. **Remedy:** gate the button path only. | S | Fable | ○ |
| U3 | ⛨ **Re-rolling a refused turn installs real narration whose tags are never applied.** *Medium · read and re-checked.* `rerollLast` applies no tags by design (the original's landed); for a refusal nothing ever landed, yet `sessionLog` keeps the tagged reply as if it had (game.js:3138–3168). **Remedy:** commit a refusal's replacement through the commit path, or say its changes did not land. | M | Fable | ○ Ruled (owner 2026-11-19): a refusal's replacement goes through the normal commit, so its tags are applied once. |
| U4 | **In the read-only character preview, the item ×, the ✎ and the epithet × act on the live hero.** *Medium · reproduced.* The preview passes `invOwner=null`; the code tests `!== undefined` (ui-sheets.js:751, 166, 195). Clicking × marked the hero's Longsword; the epithet × removed the hero's alias. The test passes `undefined`, so it misses this. **Remedy:** pass `undefined`, or test `== null`. | S | Any | ○ |
| U5 | **Four modals are not dialogs to the focus contract, so Enter can send a turn behind them.** *Medium · lane-read only.* Respawn, Onward, Campaign ended and Health build their own `div` with no `aria-modal` (ui-modals.js:1104, 1115, 1142, 1153); `focusStoryBox` therefore focuses the hidden input. **Remedy:** move them onto `modalShell`. | S | Any | ○ |
| U6 | **Since #772, a notice raised while a modal is open is only collected, so a modal's own refusals are invisible.** *Medium · read and re-checked.* `consoleDoorOpen` is true under a modal's backdrop (ui-shell.js:64–68). Affected: the roll modal's "the turn is still landing" (which `render.md` says the modal says), the dice test's failure reason, the health report failure, "Wait for the turn to finish", and the sync badge's explanation. I named this cost when #772 shipped; it is a contract drift and should be closed. **Remedy:** treat the door as closed while `modalTopOpen()` is true. | S | Any | ○ Ruled (owner 2026-11-19): a notice raised while a modal is open pops up, and is also kept in the Console. |
| U7 | **A roll whose send fails is lost on reload.** *Low · lane-read only.* The check is deleted and saved before the silent send; silent sends are never kept as a pending action (game.js:3082–3094, 3059). A limited ability it spent is gone too. | S | Fable | ○ |
| U8 | **Sending with a check pending lapses the check even when no turn is sent** *Low · lane-read only.* (an empty Send, a Table Talk question, an owed level-up); `checkLapseToAction` runs before `txt` is read (game.js:2884). Reachable mainly in Car Mode. | S | Fable | ○ |
| U9 | **A throw in the tag pass after the player's line is written offers a Retry that logs the line and bumps the turn again** *Low · lane-read only.* (game.js:2676–2708). No throwing input was found. | S | Fable | ○ |
| U10 | **The sheet's ✎ Define and ⟳ Sync do nothing while a turn is in flight, and say nothing** *Low · lane-read only.*; the item card's Define says "Wait for the turn to finish" for the same action. | S | Any | ○ |
| U11 | **In Car Mode every notice pops and stays until tapped** *Low · lane-read only.*, stacking over the car screen for the length of a drive (ui-shell.js:92–104). | S | Any | ○ Ruled (owner 2026-11-19): in Car Mode a notice fades by itself after 8 seconds and is kept in the Console. |
| U12 | **The campaign-folder banner can be added twice with the same ids; the second copy's buttons are dead** *Low · lane-read only.* (game.js:3853–3864). | S | Any | ○ |
| U13 | **The World State panel throws on a null faction entry** *Low · reproduced.* (`worldStateNpcRows`, helpers.js:3916). Whether real state can hold one is not known. | S | Fable | ○ |

---

## V. Voice, Car Mode and ambience

Browser audio cannot be driven headless. R rows here were reproduced against fake platform objects, not a device.

| # | Task | Effort | Tier | Status |
|---|---|:---:|:---:|---|
| V1 | **In Car Mode, a tap after a turn that committed but failed to display sends the same action again.** *High · read and re-checked.* `sendAction`'s catch calls `carNotify("error",…)` for the committed case (game.js:3058), whose own comment says "no Retry"; "error" arms tap-to-retry (car-session.js:133, 486). The same arm fires for a failed Table Talk question, where the tap re-sends the previous story action. Rare trigger; canon is written twice when it happens. **Remedy:** `carNotify("warn",…)` at 3058, and for Table Talk. | S | Fable | ○ |
| V2 | **Cancelling the mic while a cloud take is transcribing does not discard it.** *Medium · reproduced.* `cancel()` covers acquisition and recording only (stt.js:275–286); the upload's result still lands and, inside Car Mode, is sent as a turn. Exiting Car Mode, replay and "read options" all call it. **Remedy:** bump the generation when an upload is pending. | S | Any | ○ |
| V3 | **After the audio context is rebuilt (the iOS interruption path), every UI sound fails for the rest of the page's life, at debug level only.** *Medium · reproduced.* `sound.js` keeps its reverb node from the first context (line 225); connecting across contexts throws. Each failed play also leaves a gain node connected. **Remedy:** reset `_verb` and `_noiseBuf` on rebuild; warn on a failed play. | S | Any | ○ |
| V4 | **Piper's synthesis iframe is leaked when its start-up fails.** *Medium · read and re-checked.* `_piperInit` (tts.js:2556–2580) never calls `fr.destroy()` in its catch; the two sibling paths do. The page then also loads the in-page engine — two engines, the case v1.424 exists to prevent — and each five-minute retry can leak another. | S | Fable | ○ |
| V5 | **Skip and stop bypass the #418 retire for every scheduled source.** *Medium · read and re-checked.* `_stopCurrent` nulls `onended` and stops (tts.js:3809–3812) without `disconnect()` or `buffer = null`, the two steps the contract says defeat Safari's retention of decoded audio. Up to 25 s of PCM per skip. The retention itself needs a soak to confirm. **Remedy:** run the same retire steps. | S | Fable | ○ |
| V6 | **The narrator's own beeps ignore the master mute.** *Medium · reproduced.* `TTS.earcon` connects straight to the destination (tts.js:3713). With the phone muted, every Car Mode turn still beeps. | S | Any | ○ |
| V7 | **A stale end event from a stopped recognizer clobbers the next listen.** *Medium · reproduced.* Tap the mic off and on quickly: the first recognizer's `onend` releases capture, clears `_rec` and leaves a live recognizer that cannot be stopped (stt.js:185–269). Device timing not verified. **Remedy:** capture the instance and ignore events from another. | S | Any | ○ |
| V8 | **Short first-person lines are taken as commands in Car Mode.** *Medium · reproduced.* "I pause", "I repeat", "I resume", "I stop here" (wraps the session up) and "I put it back" (undoes the last item move), because the filler strips a bare "I" (car-commands.js:19). The five longer sentences in the contract's own examples are correctly left as actions. | S | Fable | ○ |
| V9 | **Car Mode silently drops three kinds its callers send** *Low · lane-read only.* — "downed", "ended" and "respawn" (game.js:4250, 4314; tag_table.js:516); `carNotify` has no final branch. The driver gets no status for a downed hero or a final death. | S | Any | ○ |
| V10 | **A hung Piper synthesis has no deadline and wedges every later Piper operation** *Low · lane-read only.* behind `_piperSerial` (tts.js:2429–2438). Needs a call that never returns; not reproduced. | S | Fable | ○ |
| V11 | **When the voice server fails mid-read, the rest is read in the narrator's voice; a cloud failure at the same point keeps the cast** *Low · lane-read only.* (tts.js:2952 against 3097–3104). | S | Fable | ○ |
| V12 | **Small voice items:** *Low · part reproduced, part lane-read.* a recognizer that fails to start says nothing (stt.js:249–259); every microphone failure is reported as "permission denied" (642–652); `wasm-probe.js` keeps one memory per unnamed instantiation (latent with the shipped builds); accents keep being scheduled at gain 0 while muted, against the contract; in a talk, "repeat" answers "No options to repeat yet"; a number word is swallowed while options are loading. | S | Any | ○ |
| V13 | **An open talk is painted over by the hero when anything calls `syncUI`, and a talk can open while a turn is in flight** *Low · lane-read only.* (ui-panels.js:83; companion-talk.js:300). | S | Any | ○ |

---

## K. What the player is told that only the GM should know

| # | Task | Effort | Tier | Status |
|---|---|:---:|:---:|---|
| K1 | ⛨ **A talk with a companion carries that companion's GM-only authored secret and the blueprint's guidance.** *Medium · reproduced.* `talkContext` calls `memoryNpcDetail(…,{omitAbilities:true})` (companion-talk.js:153), which appends the secret and the authored note; the trim keeps them. The persona tells the character to speak from what it was given. **Remedy:** an option that also omits both. | S | Fable | ○ |
| K2 | ⛨ **Table Talk's prompt names characters the player has not discovered, and the GM's pending events.** *Medium · reproduced.* `ttRecallBlock` calls `memoryTOC()` with no filter (table-talk.js:225). The World State panel hides the same characters by the 2026-11-13 ruling. **Remedy:** pass the discovered filter and leave pending events out. | S | Fable | ○ |

---

## A. The atlas (public map mode)

| # | Task | Effort | Tier | Status |
|---|---|:---:|:---:|---|
| A1 | **A note on a way out, or on a place inside, is saved, never shown again, and shared by every sheet.** *Medium · reproduced.* Public note keys carry no zone (atlas.js:1376) and way ids are positional (`way-1` on every sheet; atlas-public-sheet.js:181); the way card always returns `note:null`. **Remedy:** hide "Add note" on those cards, or key public notes by sheet and return them. | S | Fable | ○ Ruled (owner 2026-11-19): make them work — key each public note by its sheet and show it on the card; a way note saved before the fix cannot be told apart by sheet and is dropped with a line in the Console. |
| A2 | **After a place merge leaves two features with one name, that place's map accepts nothing more, every turn, for good.** *Medium · reproduced.* `atlasKnowledgeCollision` (atlas-knowledge.js:107–117) scans all features of the scope, not the ones this turn touches. The toast tells the GM to use a handle, which cannot help. **Remedy:** report a collision only for a feature this turn created or changed. | S | Fable | ○ |
| A3 | **An exit with no stated direction jumps to the opposite edge when a later way is stated in its direction** *Medium · reproduced.*, against "an exit added later moves nothing drawn" (atlas-public-sheet.js:209–214). The stability test adds an unstated way, so it cannot catch this. | S | Fable | ○ |
| A4 | **The public geography store grows about 465 bytes per disclosure, uncompressed, and every projection re-validates all of it.** *Medium · reproduced.* 931 KB at 2,000 disclosures in the memory key; at the 8,192-receipt cap every later disclosure is refused for the rest of the campaign, with a toast each turn. **Remedy:** bound the provenance bytes; validate once per revision. | M | Fable | ○ |
| A5 | **The directions request repeats a paid call every turn while the model declines to place a feature** *Low · lane-read only.*; there is no attempt cap (atlas-directions.js:37–110). | S | Fable | ○ |
| A6 | **The region can set two places on one point** *Low · reproduced.* when an earlier place is set down afresh while a later one already has a kept spot (atlas-public-region.js:81–95). Mechanism reproduced; whether play reaches it is not known. | S | Fable | ○ |
| A7 | **Ways past the sixteenth are dropped from a place sheet without a word, and the unplaced list is cut silently at 64** *Low · lane-read only.* (atlas-public-sheet.js:180). | S | Fable | ○ |
| A8 | **At the 1,024-place cap, every follow raises a toast and an error report.** *Low · lane-read only.* | S | Fable | ○ |

---

## C. Campaign creation, checks and sheets

| # | Task | Effort | Tier | Status |
|---|---|:---:|:---:|---|
| C1 | ⛨ **The skeleton review silently drops the campaign's age ladder whenever the review finds anything.** *High · reproduced.* `correctCampaignSkeleton` sends and returns `{premise, acts}` only (campaign_generator.js:161–168); `generateSkeleton` then reads `deepTime` from the corrected object. The campaign plays with no age ceiling and the console blames the model. The register gate feeds the correction, so this is the common path. **Remedy:** carry `skel.deepTime` across. | S | Fable | ○ |
| C2 | ⛨ **The corrected skeleton is checked for shape only.** *Medium · reproduced.* An arc with no title or objective is accepted; a `null` arc throws outside the review's catch, the valid first draft is thrown away, and the campaign starts freeform (game.js:3794). **Remedy:** validate each arc inside `validateSkeletonStructure`. | S | Fable | ○ |
| C3 | ⛨ **Text in a check's modifier field has all its digits glued into one number.** *Medium · reproduced.* `[CHECK:Attack|+5 vs DC 15]` rolls d20+515; `[CHECK:Stealth|DC 14]` gives modifier 14, so a natural 1 succeeds (`parseCheckTag`, helpers.js:234). No occurrence was found in the local play corpora (about 60 tags, all canonical). **Remedy:** read the leading signed integer only; clamp; refuse a field with more than one number. | S | Fable | ○ |
| C4 | **Since #776, an item whose name is longer than 80 characters is never sorted, costs a model call every turn, and is announced as sorted each time.** *Medium · reproduced.* `itemKindsOwed` keeps the full-name key but sends a cut name; `itemKindsSettle` files under the key of the cut name (item-kinds.js:58, 124). Forty such names ahead of the rest would block every other item. The toast is built from what was asked, not from what was filed. **This is my code from 2026-11-18. Remedy:** file by `owed[i].key`; build the toast from `filed`. | S | Fable | ○ |
| C5 | **Importing a character in the wizard, pressing Back and then Next starts a fresh hero whose identity, class and attribute steps were never checked** *Low · lane-read only.* (ancestry "Unknown", all stats 8). | S | Any | ○ |
| C6 | **An image the browser cannot decode is stored as the portrait anyway** *Low · lane-read only.*, raw and uncompressed, and nothing tells the player why it never shows (ui-portrait.js:81; the two fal fetches do not check `r.ok`). | S | Any | ○ |
| C7 | **A row field named `__proto__` is lost when a row moves between packs** *Low · reproduced.*, and that row's prototype is replaced (inventory.js:128, 164), against invariant I5. | S | Fable | ○ |
| C8 | **A place can be merged into its own child** *Low · reproduced.*, leaving a node that is its own parent and a party pointer to a place that does not exist (`locMerge`, identity.js:471–504; `locReparent` has the check). Reproduced through the repair tool's path; the GM tag path was not shown. | S | Fable | ○ |
| C9 | **The name-path death gate compares a stored scene negative by raw string** *Low · lane-read only.*, where the contract says every such comparison goes through `_sceneRefEntitySame` (identity.js:1487). Fails open only on saves from before #530. | S | Fable | ○ |
| C10 | **#776 exposures:** *Low · read and re-checked.* an item-section reply of the right length with its answers in the wrong order is filed for good and cannot be detected; `worldState.itemKinds` is never pruned. | S | Fable | ○ |
| C11 | **Three lookup tables are plain objects, so prototype names match them:** *Low · reproduced.* `sayMoodSteer("constructor")` passes its allow-list; `voiceAgeLabel("constructor")` returns the `Object` function. | S | Fable | ○ |
| C12 | **`coinNarrationAmounts` takes quadratic time on long runs of number words** *Low · reproduced.* (3.7 s on 64 KB); it runs on every reply. Needs pathological output. | S | Fable | ○ |
| C13 | ⛨ **A blueprint's NPC names are never checked.** *Medium · reproduced.* `validateBlueprint` admits a nameless NPC, a blank one, and one whose name holds a `|` (for example `Bram|Kitchen`), which the tag grammar cannot address. **Remedy:** validate each name. | S | Fable | ○ |
| C14 | ⛨ **A null entry in a blueprint's locations or NPCs throws inside `applyBlueprint`, in the middle of starting the game and before any save; a null act or arc makes `validateBlueprint` throw where it should return a reason.** *Medium · reproduced.* **Remedy:** refuse non-object entries in the validator. | S | Fable | ○ |
| C15 | ⛨ **Two blueprint NPCs with one name pass validation; the second dossier is dropped at play time** *Low · reproduced.* with only a generic identity toast. | S | Fable | ○ |
| C16 | **Small items in the start and render paths:** *Low · lane-read only.* the suggestion gate's unintroduced-name rule checks NPC names only, so skeleton-only places and items can appear on buttons; `buildSceneRenderRequest` describes a hero with no age or appearance as "undefined"; `applyBlueprint` installs the blueprint's acts and creatures by reference and stamps statuses into them; the "Death has just arrived" prompt line can never be sent, because the stage leaves "arrive" in the commit that sets it. | S | Fable | ○ |

---

## D. The Blueprint Designer and the satellites

| # | Task | Effort | Tier | Status |
|---|---|:---:|:---:|---|
| D1 | **A `.blueprint` with a null entry half-loads: the status says "Failed to read file", but the working copy is already replaced and is saved on the next keystroke.** *Medium · reproduced.* `loadBlueprintObject` assigns `bp` before it validates (blueprint-designer.html:801–808). After a reload the draft no longer opens. **Remedy:** build and validate into a local first. | S | Any | ○ |
| D2 | **Story Compiler: loading a save during a compile leaves it stuck until reload** *Low · lane-read only.*, with nothing shown (lines 213, 606–635). | S | Any | ○ |
| D3 | **Character editor: a draft save that fails says nothing, and a draft from a newer build leaves the page with no sheet behind working buttons** *Low · lane-read only.* (lines 360, 372–374). | S | Fable | ○ |
| D4 | **The designer's review merge resolves section names through inherited properties** *Low · reproduced.*; a patch with section `constructor` writes a `constructor` array into the exported blueprint. The assistant's merge uses own properties, so the two disagree. | S | Any | ○ |
| D5 | **Small satellite items:** *Low · lane-read only.* `author_voice_lab.html`'s model wait does not count seconds and the class guard misses raw `fetch`; `character_editor.html` calls `relationshipMigrateSheet`, which is never loaded there; `home.html` says "Signed in." when the account check fails; `bug_tracker.html` sends the feed secret in the URL; `map_cleanup.html` never revokes its export's object URL. | S | Any | ○ |

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
