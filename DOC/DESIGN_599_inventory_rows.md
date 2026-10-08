# #599 — Inventory rows and "equipped" (design, 2026-10-08)

**Status: Opus 5.5 draft, written at engine v1.1173. No code exists.** #599 is Fable-tier: it rewrites every write path for carried items, the STATE TAGS doc and a save shape. By the drift decree a Fable or Astra session reviews this record before any code. **The owner ruled on all ten decisions on 2026-10-08 (§9).**

**TLDR.** Every inventory becomes a list of rows `{name, qty, equipped}`, and the separate `worn` list folds into the row's `equipped` flag. One module owns the row, one function decides when two names are the same item, and the GM's tag grammar does not change. A dry run over all 77 of the owner's saves converts 11,490 items with no unit lost and prints every row back as exactly the text the GM reads today. The real risk is not the conversion. It is a second device still running an old build pulling a converted save, and nothing in the game checks a save's version today. The recommendation is to ship a small version gate one release ahead of #599.

## 1. What is wrong today

An inventory is an array of strings: `["Torch x3", "Rope", "Signet ring (from Sheriff Hemlock)"]`. A count is a suffix on the string. Every reader re-parses the suffix, and every writer rebuilds it.

Worse, "is this the same item?" has a different answer in each place that asks:

| Where | Rule | Folds plurals? | Keeps "(from …)"? |
|---|---|---|---|
| The pack: stacking, removing, renaming (`_invNorm`, api.js) | case, spaces, dash variants, trailing "s" | yes | yes |
| The chest (`stashKey`, api.js) | the pack's rule after the count | yes | yes |
| Gift and take pairing (`itemPairKey`, api.js) | the pack's rule on the provenance-free base | yes | no |
| A want met by a sale (`retireWantedAt`, memory.js) | `itemBaseName`: lower case, no count, no provenance | no | no |
| The counter's rows and want match (`shopTradeCatalog`, helpers.js) | the stored text, lower-cased | no | yes |
| A purchase's ware (game.js:427), a chest fold on a place merge (identity.js:275) | lower case | no | yes |
| Worn items (`_wornIdx`, api.js) | the pack's rule | yes | yes |

Concretely, the pack stacks "Wolf pelts" onto "Wolf pelt x3" as one item, but selling a "Wolf pelt" does not meet a want filed as "Wolf pelts". That was probed through the engine at v1.1173. The counter's want match compares the same lower-cased names, so it misses the same pair. The count grammar is split three ways as well. `_qtyParse` reads ` x1`–` x999` with no leading zero, `_invCount` reads any digits, and `itemBaseName` strips any digits.

The owner's ruling (2026-10-03): "we should have been handling inventory like this all along."

## 2. The design

### 2.1 The row

```
{ name: "Torch", qty: 3, equipped: false }
```

| Invariant | Rule |
|---|---|
| I1 | `qty` is a whole number of at least 1. A row that reaches 0 is removed. |
| I2 | Within one sheet, no two rows share an item key (§2.2). |
| I3 | `name` never carries a count. It keeps provenance: "Signet ring (from Sheriff Hemlock)". |
| I4 | `equipped` is a boolean on the whole row (§3.4). |
| I5 | Fields this build does not know are carried through every write, never dropped. That leaves room for `slot` and a bible key later. |

### 2.2 One item key

`itemKey(name)` is today's pack rule: case, spaces, dash variants, trailing plural "s". It no longer strips a count, because a stored name never has one. The pack, the chest, the counter, the want match, the pair key and the consumable latches all key through it. Where a provenance-free match is wanted (wants, pairing, bible lookups), the caller applies `itemBaseName` first and then `itemKey`. That turns the rules in §1 into one key and one stated variant.

### 2.3 One count grammar

`_qtyParse` stays the only reader of " xN", and it runs only at the tag boundary on what the GM writes. The GM-facing grammar is unchanged. `[ITEM_GAINED:Torch]` adds one, the doc still says never to bake a count into a name, and the parser still accepts "Arrow x20".

### 2.4 One module

A new engine file, `inventory.js`, owns the row and every read and write: "one job per file". It loads after helpers.js, which it needs for `itemBaseName`, and before state.js, whose migration calls it. The functions:

| Function | Contract |
|---|---|
| `invRows(list, worn)` | Any stored shape becomes rows: strings, rows, a mix, leftover `worn` names. Idempotent. Junk goes to `inventoryJunk`, loudly (§5.2). |
| `invFind(inv, name)` | Exact key first, then a unique provenance-free base. An ambiguous name refuses with the candidates, as `resolveInventoryName` does today. |
| `invAdd(inv, name, n)` | Stacks by key, else appends a row. Returns the row. |
| `invRemove(inv, name, n)` | Removes up to n units and reports how many left and under what name. A row reaching 0 is removed. |
| `invRename(inv, from, to)` | Keeps qty, position and `equipped`. A collision refuses, as today. |
| `invCount(inv, name)` | Units held under a key. |
| `invEquip(inv, name, on)` | Sets `equipped`. An uncarried item refuses loudly, as `wornSet` does today. |
| `invText(row)` | `name + (qty > 1 ? " x" + qty : "")`, exactly today's stored string. |
| `invTextList(inv)` | Every row's text, for the prompt and every display that showed the old strings. |

**Writers heal on entry.** Every writer first normalises its list in place if it finds anything that is not a row, the same `invRows` step. A sheet that missed every heal (§5.3) therefore still ends as rows after its first write, never as a mix. Old string fixtures in the tests, the replays and the shipped sample characters stay legal input for the same reason.

The old helpers either become one-line delegates for the life of the change or are deleted. This record recommends deleting them in the same series, so the game never has two inventory APIs. Retired: `_invNorm` (becomes `itemKey`), `_invBase`, `_invCount`, `_wornIdx`, `wornSet`, `wornPrune`, `wornRename`, `foldDuplicateInventory` and the string half of `sanitizeModelInventory`. `stashKey` and `itemPairKey` stay as names, defined through `itemKey`.

A contract in run-tests makes the boundary hold: no engine file outside inventory.js may index into or string-test an inventory entry. That catches `typeof inv[i] === "string"` guards that would skip rows in silence. Three exist today (§4). Exemptions carry a reason, in the `dev/class-guards.js` style.

## 3. "Worn" becomes "equipped"

### 3.1 Data

`worn[]` folds into `row.equipped = true` on the matching row, and the `worn` field is deleted. `outfit {text, turn}` is untouched; it is clothing prose, not a carried item.

### 3.2 The tag

The GM writes `[EQUIPPED:Name|item|on]` and `[EQUIPPED:Name|item|off]`. The STATE TAGS doc teaches only that spelling. Its line keeps today's sense and widens it to weapons: "a carried item is equipped or set aside (a blade drawn and held ready, armor buckled, a shield slung, a ring slipped on; armor stripped for the night)". `[WORN:…]` stays registered with the same handler indefinitely (decision 4), stripped from display and known to the unknown-tag scan. On-words and off-words keep their exact-match lists, plus `equipped`/`equip` and `unequipped`/`unequip`.

Receipts must not share a stem: "Tess equips Chainmail" and "Tess takes off Chainmail". That follows the owner's rule on opposing values, because tests and the provenance ring read these lines.

### 3.3 The prompt line

`Wearing: Chainmail, Shield | Outfit (t12): road clothes` becomes `Equipped: Chainmail, Shield | Outfit (t12): road clothes`. Rows give pack order where `worn` gave donning order. Over all 77 saves that changes the order on 29 of the 56 sheets with an equipped line. Spelling never changes, and the order means nothing to the GM.

### 3.4 Whole-row semantics, and the limit

`equipped` marks the stack: "Dagger x2" equipped is both daggers. The counter and the chest refuse an equipped row, as they refuse a worn one today. The limit: a spare in an equipped stack cannot be sold until the GM sets the stack aside. A per-unit count can come later without a migration, under I5.

### 3.5 Words the player sees

The counter's "Worn — take it off first" becomes "Equipped — unequip it first" (decision 7). Ledger rows' `worn` field becomes `equipped`, and the sheet shows the same mark under the new word.

## 4. Every place that changes

From a code survey of v1.1173 on 2026-10-08. Line numbers are from that version. Three findings shape the plan more than the rest:

- **Sheets enter the game by routes the load migration never sees.** Checkpoint restore, library adoption, quick start, .char import, wizard companions and the new-game path never call `migrateWorldState`. The one function every sheet passes is `relationshipMigrateSheet` (identity.js:568), which runs on every prompt build and already carries the coin heal (#598). §5.3 uses it.
- **Several readers would fail in silence.** Three loops skip any entry that is not a string: the "Collected" toast, the ghost-consumable check, and the named-item recurrence check. Others would turn a row into "[object Object]": the Table Talk state block, the portrait prompt, the import preview, and the Sync modal. Others would stop matching: the Define button's lookup, the Sync diff, and the sheet's delete marks. None of these throws. Each gets a failing test (§8.2), and the boundary contract keeps new ones out.
- **" xN" is also a transport format.** The counter and the stash undo hand `name + " x" + n` to `fileLocationItem`, which re-parses it only in the village. Rows end that: the place functions take a unit count as an argument, and only the tag boundary parses a count.

### 4.1 The engine core

| File | Sites | What changes |
|---|---|---|
| api.js 3146–3380 | the item helpers, attire, `sanitizeModelInventory`, `foldDuplicateInventory`, `inventoryCountOf`, `duplicateItemGrantWarning`, `renameInventoryItem`, `_stampItemKept`, the pair-key helpers | Move to inventory.js as the §2.4 functions; the string helpers are retired. |
| api.js prompt | 664 money note, 2483 companion sheets, 2595 legacy character, 2706 hero sheet, 2993–3011 item canon, 3191 `attireLine`, 3192 `attireRenderText` | Read through `invTextList` and `row.name`. The output stays byte-identical except the `Equipped:` line. |
| tag_table.js | `ITEM_GAINED` 542, `ITEM_LOST` 544, `ITEM_RENAMED` 576, `ITEM_KEPT` 577, `LOCATION_ITEM` 645 (put-backs 652, 657), `COMPANION_ITEM_GAINED` 1673, `COMPANION_ITEM_LOST` 1689, `COMPANION_ITEM_RENAMED` 1699, `WORN` 1702, `COMPANION_ITEM_KEPT` 1710 | Unit loops become `invAdd`/`invRemove` with a count. Pair notes keep their per-unit meaning. `EQUIPPED` joins `WORN` on one handler. The doc line changes (§3.2). |
| helpers.js | `recordCanonNames` 266, `sheetRegisterReport` 313, `detectItemMisattribution` 830, `firstWareNotHeld` 1948, `sheetItemDefs` 2175, `portableSheet` 2187, `groupInventory` 2416, the delete marks 2433–2471, reward measurement 2529, `clampImportedCharacter` 3252, `shopTradeCatalog` 3343, `shopLedgerRows` 3391, `stashTradeCatalog` 3403, `stashLedgerRows` 3416 | Read rows. The catalogs map rows directly, because rows are already unique by key. The delete marks key on the item key, not the whole string. |
| memory.js | `retireWantedAt` 788 (the want key), `fileLocationItem` 838 (takes a unit count), `_recurringKnownName` 2353 (a string-only skip), the summary extractor's attire belt 2528–2532 | Through the module. |
| state.js | `migrateWorldState` 509 (the duplicate fold at 635–643 retires), `importSaveData` 1041, `checkpointRestore` 794 (runs no migration today) | §5.3. |
| identity.js | `relationshipMigrateSheet` 568, the chest fold on a place merge 272–278, 446, 459 | The per-sheet heal; the chest fold adopts `itemKey`. The `ITEM_GAINED` fingerprint at 1508 reads tag text and is unaffected. |

### 4.2 The turn path and the trades (game.js)

| Sites | What changes |
|---|---|
| `engineFourthAction` 196–209 | Its pick and `firstWareNotHeld` read `row.name`. |
| `ledgerApply` 376–399, `shopTradeApply` 419–437 | `invAdd`/`invRemove` with counts instead of per-unit loops. The place calls take a count. `tradePing` keeps display text. |
| `checkLegacyCharacter` 1130 | `pendingLegacy.inventory` goes through `invRows`. |
| `normalizeCompanionSheet` 1478 (and `generateNpcSheet`, ui-sheets.js:491) | The model faucets: the model still returns names; `invRows` converts on arrival. |
| The whole-sheet adopters at 1556–1613, 1865 and 1878 | Covered by the per-sheet heal (§5.3). |
| `libReplaceSummary` 1620 | "Items" counts rows today. That stays a row count, now said as such. |
| `villageHallSeed` 1735 | Reads `row.name`. |
| The stash undo 1787–1812, `stashMovesReplay` 1828–1844 | Counts as arguments; `invAdd`/`invRemove`. |
| `inventorySnapshot` and `toastInventoryGains` 2128–2157 | **A string-only skip today.** They read rows, keyed by `itemKey`. |
| `detectGhostConsumables` 2294–2349 | **A string-only skip today.** The latches keep their stored keys, because `itemKey` of the name equals today's key of the string. They compare `row.qty`. |
| `buildItemDefinePrompt` 4269–4271 | **Looks the item up with `indexOf` on the whole string**, so Define would go dead. It finds the row by key. |
| `invDiffLines` 4351, `syncCharSheet` 4372–4380 | **Tallies by the whole string**, so every row would fall into one tally. It tallies by key. |

### 4.3 The interface

| File | Sites | What changes |
|---|---|---|
| ui-panels.js | `invItemHtml` 264–279 parses " xN" with its own pattern for the "(N)" badge; `updateInvPanel` 311–341 badges `inv.length` and marks " · worn"; `itemTip` 381 | Render from the row: the badge from `qty`, " · equipped" from the flag. The CSS class `.eq` means a weapon or armor category, not equipped; it is renamed `.gear` so the two cannot be confused. |
| ui-sheets.js | the delete marks 57–76 and 254 key on the whole string; `csSheetSections` 239–269; `showItemCard` 295–311; the Define button 261 | Marks key on `itemKey`; the DOM carries the key, not the text. |
| ui-modals.js | the Sync modal 208 and 243 is **the only free-text writer**: one item per line | Lines become rows through `invRows`. Equipped flags survive by key. The text box shows `invTextList`. |
| ui-modals.js | the ledger modal 39–111 | Reads `equipped` where it read `worn`. |
| ui-portrait.js | `buildPortraitPromptRequest` 149 joins the whole pack into the image prompt | `invTextList`, byte-identical; pinned by dev/tests-160-portrait-builder.js. Using only equipped items is a better prompt, and a later change. |
| ui-browsers.js | `loadCampaignCharacter` 148 and the read-only viewer; `showCharImportPreview` 482–535; the .char export 537–544; the library saves 746, 768, 806; `_addImportedCompanion` 675–701; quick start 34–60; `_startImportedCampaign` 592–635; `_addPendingCompanion` 922–929 | Display reads tolerate both shapes. Every adopting road runs the per-sheet heal. The .char file writes `ver: 11`. |
| ui-files.js | the .tnd export 571 and 604; `importSave` 659 | Verbatim writers: no change. Import runs `migrateWorldState` as today. |
| ui-carmode.js | "never mind" 190 calls the stash undo | Covered by game.js. |

### 4.4 The satellite pages

| Page | What changes |
|---|---|
| character_editor.html | It loads no api.js and keeps its own one-text-box-per-item editor (183, 238–241, 288–291). It gets a row editor with name, count and an equipped tick, and loads inventory.js. Its .char export (317), library save (329) and draft (`tnd_ce_draft_v1`) write rows. An old draft heals on restore. It needs a test seam if it has none: the rule that no surface is untestable. |
| map_cleanup.html | It runs `migrateWorldState` without api.js, so a typeof-guarded migration step is skipped there **in silence** today. It loads inventory.js, and the migration's call is never typeof-guarded (§5.3). |
| home.html | Quick start hands a shipped sample .char to the game. The three samples keep their string arrays, and the heal converts them on adoption. |
| bible_editor.html, bible_study.html | Item type canon only. Their notes that say "counts live on the inventory string" (bible_editor 189–190 and 807, bible_study 78, character_editor 183) are reworded. |
| blueprint-designer.html | No inventory. A custom class's `gear` is comma text, as in class_bible.js. |

### 4.5 Data that names items outside a character

The chest rows (`node.items`), the move ring (`stashMoves`), wares, wants, mementos, `tradePing`, the provenance ring's text, the consumable latches and the item-canon overlay all hold item names, never counts in a name. They keep their shapes and key through `itemKey`. The chest fold on a place merge (identity.js:275) changes from lower case to `itemKey`.

### 4.6 Starting kits

A class's starting kit is one comma-separated string in class_bible.js. char-creation.js:324 splits it into the hero's inventory and adds "First aid kit". The kit goes through `invRows` at creation. That fixes three things in passing: a Sorcerer's "first aid kit" and "First aid kit" become one row of two; a Rogue's "short blades x2" becomes two short blades; and the Warrior's "first aide kit." stays a bible-entry typo for its own row.

### 4.7 The server

No change. It stores a character as opaque text and a campaign as an opaque blob, and parses neither.

### 4.8 Tests and tools

| Area | Size | What changes |
|---|---|---|
| dev/engine-tests.js | 271 of 2,713 tests mention inventory or worn. About 300 lines seed string lists, which stay legal input. Roughly 100 lines assert a stored entry as a string: by index, by `join`, by `indexOf`, by length, or by quoting an "xN" text. Nine lines assert the sheet's `worn`. | Assertions read `invTextList` or the row. Seeds stay as they are. Two existing tests already push non-strings, a row-shaped object at 25985 among them; their expectations become the row rules. |
| Direct helper tests | `_invNorm` 13 lines, `foldDuplicateInventory` 10, `groupInventory` 11, `sanitizeModelInventory` 7, `stashKey` 5, `addInventoryItem` 4, `_invCount` 4, `inventorySnapshot` 4, `removeInventoryItem` 3, `wornPrune` 1 | Re-pointed at the §2.4 functions, or deleted with the helper they test. |
| Source-text pins | engine-tests 24533, 26528 (no `.inventory =` in shells), 26531–26532; tests-429-inventory-drop.js:264 and tests-audit-ui.js:140, 205 require the text `wornPrune(` | Updated with the retirement. Changing a pin is a contract change. |
| Other suites | tests-429-inventory-drop.js (35 lines), tests-audit-ui.js, tests-160-portrait-builder.js (the portrait prompt string), tests-501-shop-button-browser.js (a CI browser step), tests-481-f11-start-refused.js (the shipped samples), server-payload fixtures with empty inventories, and run-tests.js:1396 (the character editor's list) | Moved to rows where they assert shape. |
| Sabotage batteries | 90 clauses in 29 batteries anchor on inventory, stash, attire or ledger code. CI's applicability scan fails any stale or ambiguous anchor. | Re-anchored and re-proven. Re-anchoring is a contract change, so a Fable or Astra session does it. |
| The golden files | `golden/tag-table-doc.golden` line 7 is the `[WORN:]` and `[OUTFIT:]` line, and it ends "serves both back on the sheet as Wearing:", so the doc line and the prompt label change together. `golden/tag-table-strip.golden` ends `…\|WORN\|OUTFIT\|SOUNDSCAPE`. Both are pinned by a hash and a length in engine-tests (8290, 8369) and by tests-frozen-golden.js. | Re-baselined, which is Fable-tier. One trap: run-tests.js:2352 and 2354 key each golden diff by its test's title, so renaming either test silently drops that diff. |
| The replays | CI checks four end states: v1238, v1258, v1271 and v1276. Each holds only the hero's inventory, as strings, and no worn field. diff-replay.js never runs a load migration; it seeds a fixed hero, Vex, and applies the GM text. | Writers healing on entry turn an inventory into rows on its first item write. To change all four once and consistently, diff-replay heals its Vex fixture at the start. The four baselines are then re-generated, and a checker proves that only the inventory differs and `invTextList` of the new one equals the old strings. Fable-tier. |
| capture-prompt.js | It renders a save's prompt without the load migration. | Unaffected: the per-sheet heal runs inside the prompt build (`relationshipMigrateWorld`, api.js:2382), before the inventory lines. Gate 8 relies on that order, so it gets a test. |
| Other tools | item-bible-coverage.js and playtest-harness.js read inventory names; repair-t1782-blackout.js and repair-t1788-bundle.js are one-shot string repairs for two old saves | The first two read `row.name`. The two repair scripts are retired with a note. |
| A new engine file | engine-manifest.js and its index.html check, the SW app shell, the CLAUDE.md file table and load order (checked by check-doc-facts.js) | Updated in the commit that adds inventory.js. |

The server needs nothing (§4.7). It reads no save version and no client version, so it cannot refuse an old client either. That is why the gate lives in the game.

## 5. The migration

### 5.1 Shape: one-way in storage, tolerant in reading

The stored shape changes once. Every reader goes through `invRows`, which accepts every shape ever written: strings, rows, a mix of the two, and a leftover `worn` list. A stale device may write a mix back (§5.4), and the next current load repairs it. This is the house practice for in-blob shape changes. #272's transcript inflater reads "every transcript form ever shipped" rather than bumping a storage key.

### 5.2 `invRows`, exactly

1. A string becomes `{name, qty}` by the stored count grammar: a trailing " xN" with N ≥ 1 and no leading zero. Otherwise `qty: 1`.
2. A row is normalised: qty to a whole number of at least 1, `equipped` to a boolean, unknown fields kept.
3. Entries sharing a key fold into the first. Quantities add, the first name and position win, and `equipped` is kept if either was.
4. Each `worn` name sets `equipped` on the row with its key. A worn name with no carried row is dropped and said in the console. The census found none.
5. Anything else (a number, null, an object with no name) moves to `sheet.inventoryJunk`, loudly. Carry, never guess, never drop.

### 5.3 Where it runs

Four places, so every road in is covered:

1. **The per-sheet heal.** `invHealSheet(sheet)` runs inside `relationshipMigrateSheet` (identity.js:568). That is the adapter every sheet passes: startGame, every prompt build, and every adopt and import road in §4.2 and §4.3, including `pendingLegacy`. The coin heal (#598) already lives there. The function's name says relationships, so the clean form is a short list of per-sheet heals that the adapter runs, with coin and inventory as its first two entries. The next per-sheet heal is then an entry, not a third clause.
2. **`migrateWorldState`**, which reaches the hero and every companion on the three load paths: local load (state.js:847), .tnd import (state.js:1092) and the server pull (storage-adapter.js:971).
3. **`checkpointRestore`** (state.js:794), which runs no migration today. It gains the `migrateWorldState` call that the other load paths make. That gap exists independently of #599.
4. **The faucets**, which convert on arrival so no new string list is stored: the wizard's starting kit, `normalizeCompanionSheet` and `generateNpcSheet`, the Sync modal, and the character editor.

Display-only readers tolerate both shapes and convert nothing: `loadCampaignCharacter`, the read-only viewer and the import preview.

The migration's calls are never typeof-guarded into silence. map_cleanup.html shows the hazard: it runs `migrateWorldState` without api.js, so any step guarded by `typeof … === "function"` is skipped there with no word. inventory.js loads wherever state.js does, and a missing module throws loudly.

Blueprints need nothing: none of the 13 samples carries an inventory, and the format has no place for one.

### 5.4 The real risk: a second device on an old build

`worldState.ver` is written as 10 everywhere and read nowhere. Today an old build loads a converted save without complaint. Its pack then shows "[object Object]" in the GM's prompt, its writes push strings beside rows, and it syncs that back. The tolerant reader repairs the mix on the next current load, but one or more turns of a garbled prompt are not acceptable.

The server cannot help. It stores every campaign and character as opaque text and parses neither.

**Recommendation: a version gate, shipped one release before #599.** Two refusals of newer data already exist: `checkpointAcceptable` refuses a newer checkpoint version, and the server pull refuses a transcript form it cannot read (storage-adapter.js:915–927). The gate makes the same refusal for the world. Every load path refuses a world whose `ver` is above what the build knows. That covers local load, .tnd import, the server pull, checkpoint restore, and .char import with the file's own `ver`. The library stores a bare character with no envelope, so `portableSheet` also stamps `sheetVer` inside the character, and every adopting road checks it. A stale device then cannot adopt a companion that a current one saved with rows. A refusal leaves the source untouched and says why: "This save was written by a newer version of the game. Reload to update." The owner opens the game once on every device, then #599 ships with `ver: 11`. The gate is small and engine-testable, and it protects every later shape change as well.

The storage key keeps its name, `tnd_core_v10`. CLAUDE.md says a key's suffix is bumped when its shape changes. A local key bump protects nothing across devices, though, because the damage arrives through the server's copy, not the device's key. The gate does protect. This departs from the letter of that rule, by the owner's ruling of 2026-10-08 (§9, decision 2).

### 5.5 Before the switch

- The owner exports every live campaign from the File menu on the desktop: a .tnd per campaign.
- A server volume snapshot is taken before the deploy.
- The census tool (§8.1) runs over the exports and must report zero unit loss before the build is pushed.

## 6. The prompt

| Block | Change |
|---|---|
| Volatile, `Inventory:` line | Byte-identical. All 11,490 entries round-trip exactly (§8.1). |
| Volatile, companion and legacy sheets | Byte-identical, by the same `invTextList`. |
| Volatile, the money note's six carried items, the item-canon block | Byte-identical. They read `row.name`, which is today's base. |
| Volatile, `Wearing:` | Becomes `Equipped:`, in pack order (§3.3). |
| **Stable**, STATE TAGS doc | One line: `[WORN:…]` becomes `[EQUIPPED:…]`, and its ending "serves both back on the sheet as Wearing:" becomes "as Equipped:". The golden file is re-baselined, a Fable-tier contract change. The stable half changes, so every campaign's prompt cache resets once. The Opus schedule pairs this with #420 and #22b, as separate commits in one deploy. |
| cleanTxt strip set | Gains `EQUIPPED`. The frozen `_CT_TAGS` hash test is re-baselined with it. |

## 7. What #599 does not do

- **It does not close #518's remainder.** The #599 row says it does. A hero looting "Dagger" in the same reply that a companion throws an untracked "Dagger" is two events under one name. Rows do not say which loss feeds which gain; only an explicit transfer does. That is the {from, to, item, qty} record the #518 row already proposes, and the Astra schedule's trade phase. #599 keeps the pairing code, re-pointed at rows with the same behaviour, and gives #518 one key to build on. The #599 row is corrected (decision 8).
- No slots, no per-unit equipped (§3.4), no weight.
- The chest keeps its own rows. `node.items` already holds `{name, qty, taken, …}` in the stash kinds; it only adopts `itemKey`.
- Not #597 (counter writes state directly) or #598 (money in copper).

## 8. Proof

### 8.1 Field census (done, 2026-10-08)

A dry run of §5.2 over the owner's saves under `Campaigns/`, at every depth, and the test-run saves under `testRuns/`:

| | Latest save per campaign | Every owner save | Test-run saves |
|---|---|---|---|
| Saves | 10 | 77 | 43 |
| Sheets with an inventory | 45 | 507 | 125 |
| Items | 1,102 | 11,490 | 3,638 |
| Items with a count of 2 or more | 176 | 1,887 | 873 |
| Largest count | 30 | 34 | 14 |
| Sheets with an equipped line | 13 | 56 | 1 |
| Equipped lines whose order changes (§3.3) | 4 | 29 | 0 |
| Equipped names with no carried item | 0 | 0 | 0 |
| Entries that would fold together | 0 | 0 | 0 |
| Rows that print back differently | 0 | 0 | 0 |
| Units lost or gained | 0 | 0 | 0 |
| Non-string entries | 0 | 0 | 0 |
| Entries where the count grammars disagree | 0 | 0 | 0 |

The tool is committed with this record: `node dev/census-inventory-rows.js` reads the latest save per campaign, and `--all` reads every save. Given a folder of .tnd exports, it is the pre-switch check of §5.5. It carries the §5.2 reference semantics; the #599 build re-points it at the real `invRows`, and the two must agree on every save.

### 8.2 Gates, failing first

Every gate below is written red before the code that turns it green.

1. **The module.** `invRows` over strings, rows, a mix, leftover `worn`, junk, duplicate keys, counts with leading zeros, and a count above `QTY_MAX`. It must be idempotent: `invRows(invRows(x))` deep-equals `invRows(x)`. Each other function gets its contract from §2.4, including the ambiguous-name refusal and a rename collision.
2. **Identity.** One table of name pairs that must and must not share a key, used by the pack, the chest, the counter, the want match and the pair key alike. "Wolf pelts" meets "Wolf pelt"; "Rope (spare)" and "Rope" stay two rows in the pack.
3. **The handlers.** Every item tag over rows, with counts. The give, take and stow pairs keep today's behaviour, with the existing #518 ② tests re-pointed. `[EQUIPPED:]` on and off, `[WORN:]` as an alias, an uncarried item refused, a lost item no longer equipped, a rename keeping `equipped`.
4. **The boundary contract** of §2.4, proven by sabotage: a planted `typeof inv[i]==="string"` in an engine file must fail the suite.
5. **The gate** of §5.4: each load path refuses `ver: 11` on a build that knows 10, each adopting road refuses a sheet stamped `sheetVer: 11`, and every refusal leaves its source untouched.
6. **A battery**, `dev/sabotage-599-inventory-rows.js`, with a clause for each invariant (I1 to I5), each `invRows` step, healing on entry, the gate, and the alias. The 90 existing clauses on inventory, stash, attire and ledger code (§4.8) are re-anchored and re-proven, and the range sweep runs before the push. Re-anchoring is a contract change, so a Fable or Astra session does it.
7. **The owner's saves**, through the census tool: zero units lost, every row printing back as its old string, equipped equal to the old worn names that were carried, idempotent on a second pass, and save, reload and compare identical.
8. **The prompt.** `dev/capture-prompt.js` on every owner save, at HEAD against the build. The only allowed differences are the `Wearing:` to `Equipped:` line and the one STATE TAGS line. Any other byte is a bug. A test pins the order this gate relies on: the per-sheet heal runs before the prompt's inventory lines, because capture-prompt.js skips the load migration.
9. **The replays.** diff-replay heals its fixture at the start, so all four CI end states change once. A checker proves that only the hero's inventory differs, and that `invTextList` of each new inventory equals the old array. That re-baselines a frozen artifact, so it is Fable-tier.
10. **Round trips on a save from before the change:** a .tnd export and import; a library .char save, load and companion import through the server; a checkpoint taken and restored; a cloud push from one preview profile and a pull on another.
11. **The skew drill.** The release-N build runs in a worktree on a second port and loads a #599 save: refused, source untouched. A build from before the gate loads the same save and writes a turn back; the #599 build then loads it and repairs it with nothing lost.
12. **A live GM**, a few turns on gemini-3.7-flash in a throwaway campaign. Check counts on gain and loss, `[EQUIPPED:]` on and off, the counter refusing an equipped row, and `[WORN:]` still landing from a reply that uses it.
13. **One independent review** before the push, with the owner's go.

## 9. Decisions — ruled by the owner, 2026-10-08

All ten were put to the owner one at a time. Nine followed the recommendation; decision 7 chose other wording.

| # | Decision | Ruling | Why |
|---|---|---|---|
| 1 | When the version gate ships | **Its own release, before #599.** The owner opens the game once on each device, then #599 ships. | It is the only thing that stops a stale device writing a converted save back damaged (§5.4), and it protects every later shape change. |
| 2 | The storage key | **Keep `tnd_core_v10`; gate on `worldState.ver`.** | A key bump does not protect across devices; the gate does. This is a deliberate departure from the letter of CLAUDE.md's key-suffix rule. |
| 3 | Library .char files | **Rows, with `ver: 11` in the file. Readers accept both shapes forever.** | Old .char files in the library and on disk must always import. Writers write one shape. |
| 4 | How long `[WORN:]` is parsed | **Indefinitely. The doc teaches only `[EQUIPPED:]`.** | The GM reads its own recent replies. A refused `[WORN:]` would lose an equip in silence, and parsing an alias costs nothing. This replaces the row's "one release". |
| 5 | The prompt line | **`Equipped:`, in pack order.** | It matches the ruling's word. The reorder is one-time and means nothing to the GM. |
| 6 | What `equipped` covers | **One flag for the whole row.** | Slots and per-unit counts can follow without a migration (I5). |
| 7 | The counter's wording | **"Equipped — unequip it first"** (the recommendation was "set it aside first"). | The owner's choice of game-mechanical wording. It is display text only: the stored value is a boolean, and receipts keep "equips" and "takes off" (§3.2). |
| 8 | #518's same-name transfer case | **Not part of #599; the #599 row is corrected.** | Rows do not identify a transfer (§7). #518's transfer record follows #599. |
| 9 | Where the code lives | **A new engine file, inventory.js.** | One job per file, and the character editor and map cleanup need it without api.js. |
| 10 | The schedule | **#599 takes the weeks it needs, with the gate released at the start.** | §10: 41–64 hours, about three calendar weeks. The question also asked whether #597 and #598 should wait. That rested on stale schedule text: both had already shipped and been archived (commits 0878a8e6 and 0e5b323d). What does wait is the counter work that names #599's row shape as its remedy, as the 2026-10-03 ruling already says. |

## 10. Size

Focused hours, on the same scale as the Astra schedule, which counts the owner's time to supervise and accept the work:

| Package | Hours |
|---|---|
| The version gate, released first (§5.4) | 2–3 |
| inventory.js, the item key, and their tests (§2) | 4–6 |
| The migration: `invRows`, the per-sheet heal, the checkpoint gap, the faucets (§5) | 4–6 |
| The tag handlers, the pairs, `EQUIPPED`, the doc line and the strip set (§3, §4.1) | 4–6 |
| The engine readers: the prompt, the turn path, Table Talk, the catalogs, the silent skips (§4.1, §4.2) | 5–8 |
| The interface (§4.3) | 4–6 |
| The satellite pages, mainly the character editor (§4.4) | 3–5 |
| The existing tests (about 100 assertion lines) and the 90 battery clauses moved to rows (§4.8) | 8–12 |
| Verification: census, prompt diff, replays, round trips, skew drill, live GM (§8.2) | 4–6 |
| The independent review and its fixes | 3–6 |
| **Total** | **41–64** |

That is closer to the Astra schedule (34 hours, range 26–50, plus a 4-hour baseline) than to the Opus schedule's single 22-hour week. It sits at the top of Astra's range, because the survey found more tests and batteries resting on the string shape than either schedule assumed. At the owner's planned 18–22 hours a week it is about three calendar weeks, with the gate released at the start (decision 10). #597 and #598 shipped before this record; the counter rows that name #599's row shape as their remedy wait for it.
