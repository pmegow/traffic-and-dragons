# Evidence brief B — review 41, admission doors (b)/(c)

Facts and implementation-contract gaps only; no design verdict or repository edits. Sources read at C:\Projects\traffic-and-dragons, game code unchanged across the parent-reported 5360ba39 → 4b9d40a4 documentation checkpoint. The proposed registry does not exist yet. Current behavior below is therefore a baseline and evidence about required work, not a claim that an implemented #599 gate regressed.

## (b) Coverage and ordering

§5.3 line 207 explicitly lists wizard companions, library adopters, .char import, quick start, imported companion, village residents, checkpoint, fallen rejoin, Sync, pendingLegacy and migration hero/companions. §5.4 line 224 separately includes world-load doors and envelope transport; §11 line 346 retains the broader entry-39 list. Thus manual pull/editor/cleanup are present elsewhere in the record, but absent from the registry's enumerated list. New installation seams below also need an explicit registry/context mapping, or an explicit reason their already-admitted input is sufficient.

| Actual door/source | Actual write order / gap relative to literal list |
|---|---|
| ui-campaigns.js:326 `_applyPulledCampaign` | Changes input campId at 329; active branch writes three live stores at 332 before loadState at 333. Inactive branch writes campaign slot at 340 before switch. Both then clear dirty, seed ACK, write metadata and return true. Manual pull's wrapper is outside the literal §5.3 list. |
| storage-adapter.js:921–971 automatic reconcile | Existing transcript-form and campaign-identity guards precede adoption. Inflation, ACK seeding and conflict rearming precede assigning worldState; migration is after installation. World/sheet incompatibility must precede those effects too. |
| state.js:1045 `.tnd` import | Portrait sanitation and array replacement mutate input before validation completes; snapshot/flush outgoing at 1062, install world at 1063, active-ID change 1066, migrate 1103, save 1106. Later sheet healing cannot protect the earlier effects. |
| ui-browsers.js:704 `.char`; :621 imported Play | File envelope is discarded at 711; sheet heals before preview. Play snapshots, deletes three live keys, changes active ID and clears globals at 627–630 before startGame. Gating only startGame is too late. |
| game.js:10 startGame | Mutates hero gender/voice/arrays, changes ID, installs world before companion admission. §5.3 names wizard companions but not the hero's earlier writes. Whole-operation refusal versus rejecting one companion needs an explicit unit. |
| state.js:760/800 checkpoints | Outer `v` gate never reads nested `ws.ver`. Restore parses all stores, then assigns globals at 823 and heals with rollback; later transcript marks commit at 832. A nested version check must precede preparation effects and installation. |
| game.js:4162 fallen rejoin | Removes archive entry with shift, clears death, mirrors pins, installs original archived sheet and refills HP. Admission must precede shift and preserve the archived preimage on refusal. |
| character_editor.html:313/356 | loadObject unwraps envelope, clones then heals; draft restoration directly heals `d.ch`. Neither checks version. Editor file/library/draft need explicit version transport; source disk file is not itself overwritten by reading. |
| map_cleanup.html:91/106 | File loading assigns caller-owned world/memory before migrate; live button ignores loadState's boolean. Tool merge applies via loc-repair-core's executors. World/nested-sheet admission must precede assigning globals and eventual Apply/export. |
| game.js:1888; ui-sheets.js:511 | attachCompanionSheet and generateNpcSheet install generated sheets, outside literal registry list. Preserve existing pin inheritance and regeneration semantics. |
| game.js:1860; tag_table.js:738/752 | Hero swap mutates roster before relationship healing; NPC merge archives preimage then transfers/merges sheet. These internal transfers are outside literal list. Opaque nested sheets include mpFallen[].sheet and identityMerges[].records.ws.charSheet; archives should remain verbatim until reactivation, not receive live heals indiscriminately. |

No gap found in the record's *recognition* of envelope loss, checkpoint/world separation or pre-effect refusal: those are explicit at §5.3–5.4. Gap: a finite list plus “every door” does not specify closure, transaction unit or publication lock after rejection. No real-device or later-autosave/remote-push trial ran here.

The entries are not uniformly pure sheet transforms. `sceneFieldsCross` (helpers.js:423–426) unconditionally erases relationship dynamic/dynamicTurn; running it on same-campaign migration/checkpoint changes live meaning. `adoptSheetItemDefs` (:2340–2344) writes global worldState.itemBible even with a detached sheet. Current adapters also need owner/exclusion and previous-sheet context (game.js:1590,1598,1609,1616). The proposed `(sheet, where)` must supply that context, preserve current ordering, and distinguish cross-campaign preparation from same-campaign repair. Cloning only the sheet cannot provide “door writes nothing”; validate the entire intended batch before commit or prepare all affected stores detached.

## Actual runtime outputs

Real engine loaded through dev/load-engine.js; UI file functions evaluated unchanged. External DOM/storage/ACK/render effects are spies; pull deliberately replaces loadState with false to expose caller ordering. Checkpoint parse/restore, character FileReader callback, fallen rejoin, scene helper and canon helper are real functions. No live providers, browser data or campaign storage touched.

| Probe | Actual output |
|---|---|
| checkpoint outer current, nested world ver11 | accept `{ok:true}`; restore `{ok:true,turn:5,camp:"Ashfen",respawn:1}`; installed `worldVer=11` |
| .char envelope ver999, sheetVer999 | `{preview:true,sheetVer:999,healedSkills:true}`; envelopeVer omitted/undefined |
| pulled world ver11, forced loadState false | `returned:true`; writes `[tnd_core_v10,tnd_sess_v10,tnd_mem_v10,meta]`; ACK actions `[clear:probe,adopt:7]`; input campId changed to probe; liveVer10 |
| fallen sheetVer999 | `returned:1,sheetVer:999,sourceHp:10,remaining:null` |
| same-campaign scene helper | dynamic `just embraced` → empty string; dynamicTurn 5 → null |
| canon helper on detached sheet | `worldHasDefinition:true` |

## (c) What an enforceable guard must demonstrate

Existing guards already derive other invariants: run-tests.js:225 scans root JS/HTML image sinks; :278 explicitly acknowledges alias blind spots in transcript-write scanning; class-guards.js derives timed waits/palette/network-first; refusal-copy-census and latch-census derive their respective domains. Existing #542 admission tests and sabotage clauses exercise named identity doors (tests-542-admission-doors.js:10–17; sabotage-542-epithet-admission.js:87,93,105,146,163), not schema admission or discovery of arbitrary new doors. These protections should be preserved, not treated as missing or as evidence for the new contract.

Concrete required sabotage names (proposed, not executed because the contract is unimplemented):

| Mutation | Named guarding assertion needed |
|---|---|
| Append `function futureImport(s){worldState.character=s;}` in a previously unlisted shipped JS file | `SHEET ADMISSION — new install door is discovered without allowlist edits` |
| Equivalent aliased install `var w=worldState;w.character=s` / computed sheet assignment | `SHEET ADMISSION — alias/computed installations cannot bypass admission` (or conservative unsupported-syntax refusal) |
| Add direct `relationshipMigrateSheet(s)` at a door, outside registry | `SHEET ADMISSION — registry entry cannot be hand-run at a door` |
| Move gate below writeLiveKeys / ACK / fallen shift | `SHEET ADMISSION — rejected pull/rejoin leaves input, stores, globals and publication baseline unchanged` |
| Allowed world + one future companion or archived reactivation | `SHEET ADMISSION — nested incompatible sheet refuses before commit` |

A regex that merely finds sheetAdmit somewhere in a named function does not prove call order or that its result controls installation. An independent derived installation census plus effect-spied negative execution fixtures is required to make the prose claim testable. Arbitrary dynamic JavaScript alias completeness remains unproven; no claim of a fully executed door census.

Probe receipt: 2026-10-09T04:18:08.347Z–04:18:08.404Z, 57.3385 ms measured with process.hrtime.bigint; tokens unavailable. Initial exploratory tool time was not instrumented. Probe emits a harmless no-AudioContext sound message. Full run-tests and repository sabotage were not run; no guard implementation or game code was edited. Probe and complete actual stdout are adjacent to this report.
