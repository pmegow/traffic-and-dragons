# #599 — Inventory rows and "equipped" (design, 2026-10-08)

**Status: entries 39 and 41 reviewed by Astra, 2026-10-08; implementation not started.** The original survey was written at engine v1.1173. Entry 41 corrects the amendment’s admission, preservation and release contracts in this record (§11); the completed reviews are not approval to deploy rows. #599 is Fable-tier: it rewrites every write path for carried items, the STATE TAGS doc and a save shape. By the drift decree a Fable or Astra session reviews this record before any code. **The owner ruled on all ten decisions on 2026-10-08 (§9).** **Amended the same evening on the owner's go after Fable's evaluation ([review receipt §8](Review_fable_2026_10_08.html#design599)): the work ships as FOUR releases, each green on master (§12), and sheet admission is ONE registry run at every door, not an eighth hand-run step (§5.3).**

**TLDR.** Every inventory becomes a list of rows `{name, qty, equipped}`, and the separate `worn` list folds into the row's `equipped` flag. One module owns the row, one function decides when two names are the same item, and the GM's tag grammar does not change. A legacy-string dry run over all 77 owner saves covers 11,490 entries, with no observed unit or text change. This is field evidence for those inputs, not verification of arbitrary object rows, mixed arrays, unknown fields or a shipped migration. The real risk is not the conversion. It is a second device still running an old build pulling a converted save, and nothing in the game checks a save's version today. The recommendation is to ship a small version gate one release ahead of #599.

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
| I1 | `qty` is an integer in 1…9999 (`INV_QTY_MAX`). A write/fold that would overflow refuses atomically; a row that reaches 0 through removal is removed. The existing tag limit remains 999. |
| I2 | Within one sheet, no two rows share an item key (§2.2). |
| I3 | `qty` carries quantity. An object row’s `name` is literal, even when it ends in ` x2`; only legacy string input parses a stored count. Provenance remains in the name. Display text is not a lossless serialization. |
| I4 | `equipped` is a boolean on the whole row (§3.4). |
| I5 | Fields this build does not know are carried through every write, never dropped. That leaves room for `slot` and a bible key later. |

### 2.2 One item key

`itemKey(name)` is today's pack rule: case, spaces, dash variants, trailing plural "s". It never strips a count from an object-row name, which is literal under I3. Legacy strings parse their stored quantity before keying. The pack, the chest, the counter, the want match, the pair key and the consumable latches all key through it. Where a provenance-free match is wanted (wants, pairing, bible lookups), the module applies a provenance-only projection to the already-decoded name, then `itemKey`. That projection must not strip or parse a count suffix: today’s `itemBaseName` also strips counts and cannot be reused unchanged for a literal row name such as `Torch x2`. Tag/legacy string operands decode their count once at their own boundary before using this projection. That turns the rules in §1 into one key and one stated variant. This deliberately changes some current matches: plural/dash/space variants converge in wants, catalogs and place folds where they did not before. Existing natural-s behavior (for example, Chaos/Chao) is inherited from the pack rule, not a new linguistic guarantee. Count-like literal names such as Modelx3 and Model x01 expose a separate compatibility question because the current `_invNorm` strips suffixes that the proposed stored-count parser does not accept. The key table must distinguish literal names, parsed quantities and provenance-free callers before code (§11); do not assert universal match parity.

### 2.3 One count grammar

`_qtyParse` remains the only tag-count reader and runs at the tag boundary on what the GM writes; its limit stays 999. Legacy stored strings use the explicit stored decoder in §5.2, with the separate row bound; already-decoded row names never pass through either decoder. The GM-facing grammar is unchanged. `[ITEM_GAINED:Torch]` adds one, the doc still says never to bake a count into a name, and the parser still accepts "Arrow x20".

### 2.4 One module

A new engine file, `inventory.js`, owns the row and every read and write: "one job per file". It loads after helpers.js and before state.js, whose migration calls it. The module owns the provenance-only row-name projection (§2.2), rather than re-parsing row names with the legacy `itemBaseName`. The functions:

| Function | Contract |
|---|---|
| `invRows(list, worn)` | Pure preparation returning `{ok, rows, diagnostics, reason}`; success is idempotent, refusal preserves the complete source. `invHealSheet` owns applying rows and diagnostic evidence (§5.2). |
| `invFind(inv, name)` | Exact key first, then a unique provenance-free base. An ambiguous name refuses with the candidates, as `resolveInventoryName` does today. |
| `invAdd(inv, name, n)` | Stacks by key, else appends a row. Returns the row. |
| `invRemove(inv, name, n)` | Removes up to n units and returns the removed row fragment (including unknown fields), units and remainder. A row reaching 0 is removed. Transfers stage removal and destination acceptance together. |
| `invRename(inv, from, to)` | Keeps qty, position and `equipped`. A collision refuses, as today. |
| `invCount(inv, name)` | Units held under a key. |
| `invEquip(inv, name, on)` | Sets `equipped`. An uncarried item refuses loudly, as `wornSet` does today. |
| `invText(row)` | `name + (qty > 1 ? " x" + qty : "")`, a display/prompt projection. Two distinct rows can print alike; never use it as the row serialization or selection identity. |
| `invTextList(inv)` | Every row's text, for the prompt and every display that showed the old strings. |

**Writers prepare before mutation.** From release (c), each writer prepares mixed/legacy input through `invRows`, then commits the normalized list and its requested change only if both succeed. Refusal leaves the original list and all transaction resources intact. Release (b) instead uses the module’s legacy representation adapter: live and persisted inventories remain strings, `worn` and its order remain intact, and untouched spellings such as `Torch x1` are not canonicalized. `invRows` exists and is tested in (b), but its row output is not installed. Already-row/malformed input that cannot be represented losslessly by that adapter refuses rather than being stringified. This dispatch belongs in the module, not at every caller.

The old helpers become compatibility delegates into inventory.js in (b), retaining direct test callers and required source contracts. Remove them only in a later explicit cleanup commit once callers, tests and named sabotage anchors have migrated; never keep duplicate implementations. Eventual retired names: `_invNorm` (becomes `itemKey`), `_invBase`, `_invCount`, `_wornIdx`, `wornSet`, `wornPrune`, `wornRename`, `foldDuplicateInventory` and the string half of `sanitizeModelInventory`. `stashKey` and `itemPairKey` stay as names, defined through `itemKey`.

The implementation must add a contract in run-tests to make the boundary hold: no engine file outside inventory.js may index into or string-test an inventory entry. That catches `typeof inv[i] === "string"` guards that would skip rows in silence. Three exist today (§4). Exemptions carry a reason, in the `dev/class-guards.js` style.

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

**The equipped mark (owner's call, 2026-10-09).** In the inventory panel and on the sheet an equipped item reads `◆ Chainmail`: a small glyph in the accent colour (`--acc`) before the name, and the name in the brighter text tone (`--t0`) while unequipped items stay in the dimmer one (`--t1`). Two channels — the mark and the weight — so it survives colour-blindness and both themes; no border, no new colour (the no-pill rule). The word "equipped" leaves the visible row and lives in the tooltip and the screen-reader text. Ships in release (d) with the rename; it is presentation-only and may land earlier on the `worn` list as a thin DOM change. **Amended by the owner on 2026-10-10, after seeing (d) on the sheet:** the small dim word returns AFTER the name — `◆ Chainmail (equipped)` in the 10px `--t2` text the old "· worn" used — and the inventory category headings grow by half (the panel 10 → 15px, the sheet 10.5 → 16px); they were getting lost under the sorted lists (#608). Shipped v1.1208.

## 4. Every place that changes

From a code survey of v1.1173 on 2026-10-08. Line numbers are from that version. Three findings shape the plan more than the rest:

- **Sheets enter the game by routes the load migration never sees.** Checkpoint restore, library adoption, quick start, .char import, wizard companions and the new-game path never call `migrateWorldState`. `relationshipMigrateSheet` runs on prompt builds and already carries the coin heal (#598), so §5.3 proposes a shared per-sheet adapter there. It is not an admission gate for every current path: fallen-PC rejoin installs a saved sheet directly, whole-sheet archives preserve preimages, and multiple callers mutate globals/storage before later healing. Future schema admission must precede those effects; a later prompt heal is a safety net, not proof of safe entry.
- **Several readers would fail in silence.** Three loops skip any entry that is not a string: the "Collected" toast, the ghost-consumable check, and the named-item recurrence check. Others would turn a row into "[object Object]": the Table Talk state block, the portrait prompt, the import preview, and the Sync modal. Others would stop matching: the Define button's lookup, the Sync diff, and the sheet's delete marks. None of these throws. Each gets a failing test (§8.2), and the boundary contract keeps new ones out.
- **" xN" is also a transport format.** The counter and the stash undo hand `name + " x" + n` to `fileLocationItem`, which re-parses it only in the village. Rows end that: the place functions take a unit count as an argument, and only the tag boundary parses a count.

### 4.1 The engine core

| File | Sites | What changes |
|---|---|---|
| api.js 3146–3380 | the item helpers, attire, `sanitizeModelInventory`, `foldDuplicateInventory`, `inventoryCountOf`, `duplicateItemGrantWarning`, `renameInventoryItem`, `_stampItemKept`, the pair-key helpers | Move to inventory.js as the §2.4 functions; the string helpers are retired. |
| table-talk.js | State/context joins and item inspection (review baseline lines 119, 170, 208) | Read through inventory projections; add direct reader tests, not just the gameplay prompt golden. |
| api.js prompt | 664 money note, 2483 companion sheets, 2595 legacy character, 2706 hero sheet, 2993–3011 item canon, 3191 `attireLine`, 3192 `attireRenderText` | Read through `invTextList` and `row.name`. The output stays byte-identical except the `Equipped:` line. |
| tag_table.js | `ITEM_GAINED` 542, `ITEM_LOST` 544, `ITEM_RENAMED` 576, `ITEM_KEPT` 577, `LOCATION_ITEM` 645 (put-backs 652, 657), `COMPANION_ITEM_GAINED` 1673, `COMPANION_ITEM_LOST` 1689, `COMPANION_ITEM_RENAMED` 1699, `WORN` 1702, `COMPANION_ITEM_KEPT` 1710 | Unit loops become `invAdd`/`invRemove` with a count. Pair notes keep their per-unit meaning. `EQUIPPED` joins `WORN` on one handler. The doc line changes (§3.2). |
| helpers.js | `recordCanonNames` 266, `sheetRegisterReport` 313, `detectItemMisattribution` 830, `firstWareNotHeld` 1948, `sheetItemDefs` 2175, `portableSheet` 2187, `groupInventory` 2416, the delete marks 2433–2471, reward measurement 2529, `clampImportedCharacter` 3252, `shopTradeCatalog` 3343, `shopLedgerRows` 3391, `stashTradeCatalog` 3403, `stashLedgerRows` 3416 | Read rows. The catalogs receive only successfully admitted rows, unique by key; an unknown-field conflict refuses rather than producing duplicate catalog keys. The delete marks key on the item key, not the whole string. |
| memory.js | `retireWantedAt` 788 (the want key), `fileLocationItem` 838 (takes a unit count), `_recurringKnownName` 2353 (a string-only skip), the summary extractor's attire belt 2528–2532 | Through the module. |
| state.js | `migrateWorldState` 509 (the duplicate fold at 635–643 retires), `importSaveData` 1041, `checkpointRestore` 794 (runs no migration today) | §5.3. |
| identity.js | `relationshipMigrateSheet` 568, the chest fold on a place merge 272–278, 446, 459 | The contextual admission adapter; the chest fold adopts `itemKey`. The `ITEM_GAINED` fingerprint at 1508 reads tag text and is unaffected. |

### 4.2 The turn path and the trades (game.js)

| Sites | What changes |
|---|---|
| `engineFourthAction` 196–209 | Its pick and `firstWareNotHeld` read `row.name`. |
| `ledgerApply` 376–399, `shopTradeApply` 419–437 | `invAdd`/`invRemove` with counts instead of per-unit loops. The place calls take a count. `tradePing` keeps display text. |
| `checkLegacyCharacter` 1130 | `pendingLegacy.inventory` goes through `invRows`. |
| `normalizeCompanionSheet` 1478 (and `generateNpcSheet`, ui-sheets.js:491) | The model faucets: the model still returns names; `invRows` converts on arrival. |
| The whole-sheet adopters at 1556–1613, 1865 and 1878 | Covered by contextual admission (§5.3). |
| `mpFallen` / `mpRejoinFallen`, merge archives and transferred sheets | Gate/heal a detached sheet before reactivation; preserve archived preimages verbatim. Include these opaque copies in the admission inventory. |
| Transaction preflight and Sync snapshots (`game.js:380,4394`; `tag_table.js:540` at review baseline) | Current `.slice()` copies are safe for strings but share row objects. Define copy ownership for writers and preflights; a failed trade or preview must not decrement a live row through an alias. |
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
| ui-modals.js | the Sync modal 208 and 243 is **the only free-text writer**: one item per line | Keep a detached original row/metadata snapshot and stable edit-session identity. Unchanged text preserves exact rows, including literal count names and extras. Apply only edits that map uniquely to source rows; ambiguous edits refuse visibly and retain the draft/source. Never rebuild existing rows from `invTextList` alone. New lines parse legacy input; an explicit structured edit is required for an ambiguous literal name. |
| ui-modals.js | the ledger modal 39–111 | Reads `equipped` where it read `worn`. |
| ui-portrait.js | `buildPortraitPromptRequest` 149 joins the whole pack into the image prompt | `invTextList`, byte-identical; pinned by dev/tests-160-portrait-builder.js. Using only equipped items is a better prompt, and a later change. |
| ui-browsers.js | `loadCampaignCharacter` 148 and the read-only viewer; `showCharImportPreview` 482–535; the .char export 537–544; the library saves 746, 768, 806; `_addImportedCompanion` 675–701; quick start 34–60; `_startImportedCampaign` 592–635; `_addPendingCompanion` 922–929 | Display reads tolerate both shapes. Every adopting road runs contextual admission. The .char file writes `ver: 11`. |
| ui-files.js | the .tnd export 571 and 604; `importSave` 659 | Verbatim writers: no change. Import runs `migrateWorldState` as today. |
| ui-carmode.js | "never mind" 190 calls the stash undo | Covered by game.js. |

### 4.4 The satellite pages

| Page | What changes |
|---|---|
| character_editor.html | It loads no api.js and keeps its own one-text-box-per-item editor (183, 238–241, 288–291). It gets a row editor with name, count and an equipped tick, and loads inventory.js. Its .char export (317), library save (329) and draft (`tnd_ce_draft_v1`) write rows. An old draft heals on restore. Its `__ceTest` seam already exists (review baseline line 365); extend its coverage. |
| map_cleanup.html | It runs `migrateWorldState` without api.js, so a typeof-guarded migration step is skipped there **in silence** today. It loads inventory.js, and the migration's call is never typeof-guarded (§5.3). |
| home.html | Quick start hands a shipped sample .char to the game. The three samples keep their string arrays, and the heal converts them on adoption. |
| bible_editor.html, bible_study.html | Item type canon only. Their notes that say "counts live on the inventory string" (bible_editor 189–190 and 807, bible_study 78, character_editor 183) are reworded. |
| blueprint-designer.html | No inventory. A custom class's `gear` is comma text, as in class_bible.js. |

### 4.5 Data that names items outside a character

The chest rows (`node.items`), the move ring (`stashMoves`), wares, wants, mementos, `tradePing`, the provenance ring's text, the consumable latches and the item-canon overlay all hold item names, never counts in a name. They keep their shapes and key through `itemKey`. The chest fold on a place merge (identity.js:275) changes from lower case to `itemKey`. I5 also covers transfer and reversal: a row fragment, not name/count alone, carries unknown fields through give/take, stash, rollback and undo. If an unchanged destination or move-ring format cannot carry those fields, the entire transfer refuses before either side changes. No silent downgrade to name/count is allowed; any later transport-format extension needs its own explicit contract. Intentional consumption/deletion removes the selected units, while all surviving units retain their fields.

### 4.6 Starting kits

A class's starting kit is one comma-separated string in class_bible.js. char-creation.js:324 splits it into the hero's inventory and adds "First aid kit". The kit goes through `invRows` at creation. That fixes three things in passing: a Sorcerer's "first aid kit" and "First aid kit" become one row of two; a Rogue's "short blades x2" becomes two short blades; and the Warrior's "first aide kit." stays a bible-entry typo for its own row.

### 4.7 The server

No inventory-schema change is established as necessary. The inspected local server stores JSON text, parses it, and reads identity/turn/quota metadata (including campaign CAS and character summary columns). It does not interpret inventory entries or enforce world/sheet schema versions in the inspected handlers. Inventory-schema opacity is the supported claim; “parses neither” is not. Server revision 025877ac was inspected read-only; deployed parity was not checked.

### 4.8 Tests and tools

| Area | Size | What changes |
|---|---|---|
| dev/engine-tests.js | 271 of 2,713 tests mention inventory or worn. About 300 lines seed string lists, which stay legal input. Roughly 100 lines assert a stored entry as a string: by index, by `join`, by `indexOf`, by length, or by quoting an "xN" text. Nine lines assert the sheet's `worn`. | Assertions read `invTextList` or the row. Seeds stay as they are. Two existing tests already push non-strings, a row-shaped object at 25985 among them; their expectations become the row rules. |
| Direct helper tests | `_invNorm` 13 lines, `foldDuplicateInventory` 10, `groupInventory` 11, `sanitizeModelInventory` 7, `stashKey` 5, `addInventoryItem` 4, `_invCount` 4, `inventorySnapshot` 4, `removeInventoryItem` 3, `wornPrune` 1 | Re-pointed at the §2.4 functions, or deleted with the helper they test. |
| Source-text pins | engine-tests 24533, 26528 (no `.inventory =` in shells), 26531–26532; tests-429-inventory-drop.js:264 and tests-audit-ui.js:140, 205 require the text `wornPrune(` | Updated with the retirement. Changing a pin is a contract change. |
| Other suites | tests-429-inventory-drop.js (35 lines), tests-audit-ui.js, tests-160-portrait-builder.js (the portrait prompt string), tests-501-shop-button-browser.js (a CI browser step), tests-481-f11-start-refused.js (the shipped samples), server-payload fixtures with empty inventories, and run-tests.js:1396 (the character editor's list) | Moved to rows where they assert shape. |
| Sabotage batteries | 90 clauses in 29 batteries anchor on inventory, stash, attire or ledger code. CI's applicability scan fails any stale or ambiguous anchor. | Re-anchored and re-proven. Re-anchoring is a contract change, so a Fable or Astra session does it. |
| The golden files | `golden/tag-table-doc.golden` line 7 is the `[WORN:]` and `[OUTFIT:]` line, and it ends "serves both back on the sheet as Wearing:", so the doc line and the prompt label change together. `golden/tag-table-strip.golden` ends `…\|WORN\|OUTFIT\|SOUNDSCAPE`. Both are pinned by a hash and a length in engine-tests (8290, 8369) and by tests-frozen-golden.js. | Re-baselined, which is Fable-tier. One trap: run-tests.js:2352 and 2354 key each golden diff by its test's title, so renaming either test silently drops that diff. |
| The replays | CI checks four end states: v1238, v1258, v1271 and v1276. Each holds only the hero's inventory, as strings, and no worn field. diff-replay.js never runs a load migration; it seeds a fixed hero, Vex, and applies the GM text. | At (c), narrowly prepare Vex’s inventory and version stamps, without running unrelated full-world migrations. Regenerate all four once; the checker allows only `ws.character.inventory`, `ws.ver: 10→11`, and an absent `ws.character.sheetVer` becoming 11. Inventory projections must equal old strings; all other paths stay exact. Fable-tier. |
| capture-prompt.js | It renders a save's prompt without the load migration. | At (c), explicitly prepare inventory on the detached capture fixture before prompt construction, without publication, scene crossing, or unrelated migration. The admission registry replaces the proposed inventory prompt-heal hook, so `relationshipMigrateWorld` alone is not sufficient. Pin this preparation order and byte diff in gate 8. |
| Other tools | item-bible-coverage.js and playtest-harness.js read inventory names; repair-t1782-blackout.js and repair-t1788-bundle.js are one-shot string repairs for two old saves | The first two read `row.name`. The two repair scripts are retired with a note. |
| A new engine file | engine-manifest.js and its index.html check, the SW app shell, the CLAUDE.md file table and load order (checked by check-doc-facts.js) | Updated in the commit that adds inventory.js. |

No server inventory conversion is planned (§4.7). The inspected handlers do not enforce the proposed save/sheet schema versions. Client-side admission and stale-client publication behavior must be tested at the actual persistence boundaries.

## 5. The migration

### 5.1 Shape: one-way in storage, tolerant in reading

The stored shape changes once. The proposed reader goes through `invRows`, intended to accept strings, rows, a mix of the two, and a leftover `worn` list. These are required future contracts, not behavior proved by the legacy-string census. A stale device may write a mix back (§5.4); the next current load accepts supported, losslessly recoverable input or refuses with the source intact under §5.2. It cannot recover fields the old client already destroyed. This is the house practice for in-blob shape changes. #272's transcript inflater reads "every transcript form ever shipped" rather than bumping a storage key.

### 5.2 `invRows`, exactly

These are the entry-41 engineering contracts; they replace the provisional answers in the historical receipt. They activate for persisted rows in (c); (b)’s legacy adapter preserves current string behavior.

1. Accepted persisted values are plain JSON data. Validate this domain before JSON deep-copying: cycles, accessors, nonfinite numbers, negative zero, undefined/function/symbol values or unsupported object types refuse with the original untouched, never silently disappear in serialization. Unknown own JSON fields are carried verbatim (including safe handling of reserved keys). Deep equality ignores object-key order and preserves array order and value types.
2. Legacy strings parse only a trailing ` xN`, N ≥ 1 with no leading zero; other text remains literal with qty 1. Object-row names are always literal. `INV_QTY_MAX=9999` bounds stored rows; the existing `_qtyParse` tag grammar and `QTY_MAX=999` remain unchanged. A positive integral quantity above 9999, a legacy string count above 9999, or a folding sum above 9999 refuses atomically; never clamp stored units.
3. For a named object row, a missing or JSON-representable invalid qty (null, string, boolean, fraction, zero or negative) normalizes to 1 only with its complete original retained in diagnostics and a visible repair report. This is an explicit repair of invalid data, not a zero-unit-loss claim. `equipped` is true only for boolean true; a supplied nonboolean value is likewise retained as repair evidence. Nonfinite live values are refused by step 1 before cloning.
4. Same-key rows fold into the first only when unknown fields deep-equal and the summed qty fits; first name/position win, equipped is OR. Different extras refuse the entire preparation/write, retaining the original source. A refused admission also locks publication to the affected destination until compatible data is admitted; retained prior state cannot overwrite the rejected source. I2 stays strict. The receipt’s proposed “keep both rows” exception is rejected because key-only lookup, delete and ledger marks cannot distinguish them. Existing duplicates may be displayed read-only for repair, never admitted to active catalogs or writers.
5. Carried legacy `worn` names set equipped by key; unmatched names are retained as diagnostic evidence and reported. An invalid entry, or a non-array inventory container, is kept whole as junk evidence; the successful normalized value contains only valid rows (an invalid container becomes an empty list). A missing inventory is an empty list without fabricated evidence. No source is overwritten until its evidence can also be retained.
6. `invRows(list,worn)` returns `{ok,rows,diagnostics,reason}` without touching its inputs or globals. Each diagnostic has a reason and complete original JSON value. `invHealSheet` stages rows and merges diagnostics into `sheet.inventoryJunk`, then commits together. Existing valid junk is preserved; malformed pre-existing junk refuses instead of being overwritten. Deduplicate persisted evidence by canonical reason+original-content equality (not array index, mutable item name, or load count). Repeated heal/load of fixed input adds no saved bytes. Report each new repair batch once at admission, with one bounded per-sheet console summary; prompt reads do not append evidence or emit repeated warnings. Preserve evidence rather than evicting it to satisfy a size cap; resource/storage failure refuses the operation.
7. Writers mutate live lists only at commit. All preflight, Sync, rollback and transfer snapshots deeply detach the validated JSON rows and nested extras. A failed operation leaves both its source and all affected resources unchanged. Removed fragments carry unknown fields; a destination unable to preserve them refuses (§4.5). Sync’s text projection never substitutes for its retained row identity and metadata (§4.3).

### 5.3 Where it runs

**ONE admission registry, contextual and transactional.** Release (b) lands `SHEET_ADMISSION` and `sheetAdmit(sheet, context)`. Entries share `{name, phase, applies(context), run(candidate, context)}`; the dispatcher owns selection and ordering. Context is a structured value carrying door, same/cross-campaign mode, destination campaign/world/memory, owner identity and exclusions, previous sheet, source envelope/stamps, and representation phase. A diagnostic label alone cannot provide these inputs.

The phases are **gate → prepare → publish**. All version/identity checks for the entire intended operation run before mutation; preparation uses detached sheets AND every affected world/memory/store plan. Only an accepted plan publishes. Refusal returns `{ok:false,reason}` and leaves source, globals, storage, active ID, archive entries, canon, ACK/CAS/dirty state and outgoing publication unchanged except for the explicit incompatibility lock in §5.4. No live-global helper runs during speculative preparation. Batch import/start/restore refuses as one operation if any required sheet refuses; partial adoption is a separate explicitly selected operation, never an accidental loop side effect.

The existing operations become contextual adapters in the registry, preserving each door’s legitimate dependencies rather than copying one adopter’s sequence everywhere:

| Entry family | Applicability and phase |
|---|---|
| Version and `identitySheetAdmit` | Gate first, with destination owner/exclusion and preserved envelope context; existing identity protections remain. |
| `keyedStores`, portrait/array preparation, `invHealSheet` | Detached preparation. In (b), inventory stays in the legacy representation; row conversion activates only in (c). Invalid portrait diagnostics are staged with the result. |
| `sceneFieldsCross` | Cross-campaign admission only. Never run for same-campaign load, Sync, checkpoint, fallen rejoin or internal transfer: it unconditionally clears relationship dynamics today. |
| `relationshipMigrateSheet` | Destination-aware detached preparation, including any relationship proposal queue it affects. Its existing prompt normalization remains a separate safety net; no inventory admission is hidden there. |
| `adoptSheetItemDefs` | Stage against destination canon after gates. Today it writes `worldState.itemBible` even for a detached sheet; that live helper cannot be called as a pure heal. |
| `voicePinsFill`, `stashCopyMark` / stash replay | Require previous-sheet/gender and source/destination context. Capture the original stash marker before transformations; stage replay effects and preserve existing voice precedence before publication. |

**Admission closure.** The door manifest must cover the hero and companions in `startGame`; wizard/model faucets including attach/regenerate; all library hero/companion replacement and village imports; `.char` envelope, imported Play, quick start and pending companions; local load, `.tnd` import, automatic cloud reconcile and manual `_applyPulledCampaign` (active and inactive); checkpoint hold/restore; fallen rejoin; hero swap and NPC merge/transfer; Sync; `pendingLegacy`; character-editor file/library/draft; map-cleanup load/live/merge/Apply/export. Check transported versions in nested sheets and opaque archives; preserve archive preimages verbatim and prepare a detached copy when reactivated. Rejoin must gate before shifting the fallen record; imported Play must gate before deleting keys or clearing globals. Internal transfers either use the registry or carry a tested proof that their exact input was admitted and is unchanged.

`checkpointRestore` checks checkpoint `v`, nested world `ver` and sheet versions separately before assigning anything. Do not call an unrestricted world migration just to prepare inventory: its unrelated repairs and publication effects are not snapshot preparation. Display-only readers (campaign viewer, import preview, read-only catalogs) tolerate both shapes, do not heal, and expose a refusal reason when adoption is unsupported.

**Enforcement is derived plus behavioral.** Derive the install/mutation sink census from all shipped engine/satellite sources, with explicit reviewed exemptions and conservative rejection of unsupported alias/computed-write syntax. A function-name allowlist or “contains sheetAdmit” regex is insufficient. Named sabotage must add a new install in a previously unlisted file, bypass via an alias/computed assignment, hand-run a registry entry at a door, move admission after a storage/ACK/archive effect, and insert one newer nested sheet in an otherwise-current batch. Each must fail its named discovery/order/refusal assertion; preserve existing identity-admission guards. Arbitrary dynamic alias completeness remains a proof obligation, not a property supplied by the table.

The module and registry dependencies must load in every host that invokes them, including character_editor and map_cleanup; no typeof-guard may silently skip a required phase. Missing required modules fail loudly. Blueprints have no inventory schema; shipped legacy samples remain accepted inputs.

### 5.4 The real risk: a second device on an old build

`worldState.ver` is written as 10 everywhere and read nowhere. Today an old build loads a converted save without complaint. Its pack then shows "[object Object]" in the GM's prompt, its writes push strings beside rows, and it syncs that back. The tolerant reader can prepare a supported mix, or refuse intact when its preservation rules fail; it cannot reconstruct destroyed fields. One or more turns of a garbled prompt are not acceptable.

The inspected server does not enforce inventory-schema compatibility. It does parse JSON and inspect metadata (§4.7); an opaque-storage claim alone says nothing about stale-client writes.

**Recommendation: a version gate, shipped one release before #599.** Two refusals of newer data already exist: `checkpointAcceptable` refuses a newer checkpoint version, and the server pull refuses a transcript form it cannot read (storage-adapter.js:915–927). The gate makes the same refusal for the world. Every load path refuses a world whose `ver` is above what the build knows. That covers local load, .tnd import, the server pull, checkpoint restore, and .char import with the file's own `ver`. The library stores a bare character with no envelope, so `portableSheet` also stamps `sheetVer` inside the character, and every adopting road checks it. A stale device then cannot adopt a companion that a current one saved with rows. A refusal leaves the source untouched and says why: "This save was written by a newer version of the game. Reload to update." The owner opens the game once on every device, then #599 ships with `ver: 11`, as ruled. The rollout proof must verify the gate-bearing runtime actually loaded on each device: a controlling service worker update does not replace functions already evaluated in an open tab. The gate is engine-testable, but its scope includes every admission and publication boundary. In particular, `_applyPulledCampaign` writes live keys before `loadState`; a guard only inside `loadState` can reject after replacing stored data. A scratch interception reproduced four writes and a success return despite rejected load. Check versions before storage/global/active-id changes, input sanitation, library/canon adoption, checkpoint installation, acknowledgements or sync. A world-only gate cannot cover newer nested sheets. `.char` envelope `ver` is currently discarded before preview, and bare library sheets have no new stamp unless already supplied: export stamping and envelope consumption must be explicit for every writer/reader. Refusal tests must also attempt subsequent autosave/push to prove an incompatible remote copy is not overwritten by retained old state. Version policy: absent legacy stamps are accepted only with a recognized supported legacy shape; a present stamp must be a positive safe integer. Malformed stamps, any transported future world/sheet stamp, or a sheet stamp newer than its enclosing declared schema refuse. Older supported stamps may coexist and are upgraded only after successful preparation. A checkpoint’s outer version is independent. Gate-only release (a) stamps new exports/library sheets with supported version 10, and (c) changes writers to 11. Incompatibility blocks local autosave and remote publication for the affected campaign/library destination before control returns; retain that block across retries/reload until compatible data is explicitly admitted. Retained old state may not overwrite the refused copy through autosave, manual push, unload or retry. A failed import leaves the file intact and cannot become a partially installed active campaign. This client gate cannot protect a runtime from before (a); the two-device drill must distinguish that residual risk.

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
- **Owner ruling 2026-10-10: the move stays two tags.** No engine-level `invTransfer`; the per-unit pair notes (`ilHits`, `ilFrags`, `igHits`) ARE the protocol and the handlers' per-unit loops are its implementation. **Built 2026-10-10 (v1.1211):** a pair note carries its tag's BLOCK (`tagBlockSpans`/`tagBlockIndex`, helpers.js; `rBlockAt`, tag_table.js) — a pair is two tags in one block, and prose between them makes two events. That rule alone closes the loot/throw collision; the census `dev/census-tag-layout.js` found every real give pair in one block. The §12 cleanup note's second half (counted calls, one transfer) is withdrawn; cleanup 1 (the delegate names, v1.1209) was the whole cleanup.
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

The tool is committed with this record as a **legacy-string pre-switch checker**, not an implementation of the general `invRows` API: `node dev/census-inventory-rows.js` reads the latest save per campaign, and `--all` reads every save. Given a folder of .tnd exports, it is the pre-switch check of §5.5. Its original object-row branch was not an adequate reference for §5.2: unknown fields disappeared, Infinity survived until JSON converted it to null, and the result wrapper differed from the proposed list API. The entry-39 tooling correction scopes its supported inputs explicitly and checks equipment independently. A future implementation must add its own mixed/row/junk/unknown-field contract tests before re-pointing this census at real `invRows`; legacy field parity alone cannot approve that implementation. The three observed field sets contain no non-string inventory entries.

### 8.2 Gates, failing first

Every gate below is written red before the code that turns it green.

1. **The module.** `invRows` over strings, rows, a mix, leftover `worn`, junk, duplicate keys, literal count names, counts with leading zeros, the separate tag/row bounds, and conflicting extras. Successful re-preparation of result.rows produces identical rows and no new diagnostics; refusal preserves input and resources. Each other function gets its contract from §2.4, including the ambiguous-name refusal and a rename collision.
2. **Identity.** A compatibility table records intentional changes and required distinctions; do not make every consumer use the provenance-free variant. One table of name pairs that must and must not share a key, used by the pack, the chest, the counter, the want match and the pair key alike. "Wolf pelts" meets "Wolf pelt"; "Rope (spare)" and "Rope" stay two rows in the pack.
3. **The handlers.** Every item tag over rows, with counts. The give, take and stow pairs keep today's behaviour, with the existing #518 ② tests re-pointed. `[EQUIPPED:]` on and off, `[WORN:]` as an alias, an uncarried item refused, a lost item no longer equipped, a rename keeping `equipped`.
4. **The boundary contract** of §2.4, proven by named sabotage: a planted `typeof inv[i]==="string"` in an engine file must fail the intended assertion. A mechanical grep is a census, not proof of dynamic alias coverage; include indirect readers and opaque sheet copies.
5. **The gate** of §5.4: each load path refuses `ver: 11` on a build that knows 10, each adopting road refuses a sheet stamped `sheetVer: 11`, and every refusal leaves its source untouched.
6. **A battery**, `dev/sabotage-599-inventory-rows.js`, with a clause for each invariant (I1 to I5), each `invRows` step, healing on entry, the gate, and the alias. The 90 existing clauses on inventory, stash, attire and ledger code (§4.8) are re-anchored and re-proven, and the range sweep runs before the push. Re-anchoring is a contract change, so a Fable or Astra session does it.
7. **The owner's saves**, through the census tool and an independent equipment oracle: zero units lost, every row printing back as its old string, equipped equal to the old worn names that were carried, idempotent on a second pass, and save, reload and compare identical. Prove that erasing every equipped flag fails even when inventory text and units remain identical. Unsupported/unreadable inputs must fail coverage, not produce CENSUS OK after being skipped.
8. **The prompt.** `dev/capture-prompt.js` on every owner save, previous release against the build. In (b) both halves are byte-identical; in (c) only carried equipment ordering on the still-named `Wearing:` line may change to pack order; in (d) only its `Equipped:` label and the specified STATE TAGS line may change. Inventory text/order stays exact on accepted legacy fixtures. Capture explicitly prepares inventory on a detached fixture before prompt lines in (c), without relying on an inventory hook in relationship migration. A named test pins that order; every other hunk requires investigation, never an automatic baseline update.
9. **The replays.** At (c), diff-replay narrowly prepares inventory/stamps at fixture start. Whitelist only `ws.character.inventory`, `ws.ver` 10→11 and new `ws.character.sheetVer` 11; prove `invTextList` equals the old array and every other field is byte-equivalent. All four change once. No unrelated modernizing migration is allowed. Frozen re-baselining is Fable-tier.
10. **Round trips on a save from before the change:** a .tnd export and import; a library .char save, load and companion import through the server; a checkpoint taken and restored; a cloud push from one preview profile and a pull on another.
11. **The skew drill.** The release-(a)/(b) build on a second port refuses a (c) save before effects and cannot later publish over it. A throwaway pre-gate build then loads/writes a copy to measure the residual corruption class; preserve the original for comparison. The current build must preserve every recoverable field or refuse with intact evidence. Tolerance cannot reconstruct data the old client destroyed, so “nothing lost” is not a guarantee of that unsupported runtime. No owner save participates in the destructive half.
12. **A live GM**, a few turns on gemini-3.8-flash in a throwaway campaign. Check counts on gain and loss, `[EQUIPPED:]` on and off, the counter refusing an equipped row, and `[WORN:]` still landing from a reply that uses it.
13. **One independent review** before the push, with the owner's go.
14. **Copy ownership and retained state.** Scratch mutations of preflight/snapshot rows must not change the live inventory; refused trades leave all resources unchanged. Unknown fields survive all add/remove/rename/fold/export paths or trigger the explicit lossless-conflict policy. Repeated heal/prompt/load loops must not grow junk, warnings, caches or saved bytes for fixed input.

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
| 10 | The schedule | **#599 takes the weeks it needs, with the gate released at the start.** Amended the same evening (owner's go on Fable's evaluation): **four releases, each green on master (§12)**, 31–44 hours (§10.1). | §10: 41–64 hours, about three calendar weeks. The question also asked whether #597 and #598 should wait. That rested on stale schedule text: both had already shipped and been archived (commits 0878a8e6 and 0e5b323d). What does wait is the counter work that names #599's row shape as its remedy, as the 2026-10-03 ruling already says. |

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

### 10.1 Re-estimated under the four-release shape (§12)

| Release | Hours | Note |
|---|---|---|
| (a) the version gate | 3–4 | Astra's R1 doors add an hour to the 2–3 above. |
| (b) inventory.js, the delegates, the boundary contract, the admission registry | 14–20 | Provisional: includes a lossless legacy adapter, contextual transactions and affected source-contract/sabotage work; no frozen baseline moves. |
| (c) the shape flip, the census, the replays, the round trips, the skew drill | 10–14 | Provisional; changes the four frozen replay artifacts. WORN live checks and independent review occur here. |
| (d) `[EQUIPPED:]`, the doc line, the golden files, the strip set | 4–6 | The stable half changes once; paired with #420 and #22b. |
| **Total** | **31–44** | Historical planning estimate, not a verified reduction. Entry 41 found direct-API/source pins and vanished loop anchors beyond delegate moves; survivor counts and transactional-admission effort must be measured before committing to these hours. |

## 11. Entries 39 and 41 — review disposition

**REVIEW COMPLETE — four-release direction affirmed with corrected engineering contracts.** All ten owner rulings in §9 stand. Entry 41 reviewed only the amendment: release (b)’s string bridge, the admission registry, proposed normalization/preservation answers, release ordering and the estimate. The controlling answers are now in §2.4, §4.3/4.5, §5.2–5.4 and §12, replacing the contradictory proposals in the historical receipt without editing it. Records: [entry 39](../audits/AUDIT_FABLE_2026_10_08_39_inventory_design.md), [entry 41](../audits/AUDIT_FABLE_2026_10_08_41_inventory_amendment.md).

The decisive corrections are: a lossless legacy adapter in (b); contextual gate/prepare/publish admission rather than indiscriminate live heals; strict unique keys with atomic conflict refusal; separate stored/tag quantity limits; explicit diagnostics and bounded repeat behavior; metadata-safe Sync/transfers; exact prompt/replay differences and the EQUIPPED gates deferred to (d). The 31–44-hour estimate stays provisional. These are engineering resolutions under the review, not requests to revisit owner decisions.

Implementation still owes failing-first guards and attributed scratch sabotage for these contracts, the complete derived door/read/write inventory, baseline and field comparisons, skew/roundtrip/live tests, and independent release review. Current green tests validate current code; no row API, registry, gate, rollout or future proof was executed by this review. Before each release, its implementation plan must name its host load dependencies and concrete effect boundaries; unsupported dynamic syntax fails coverage instead of silently escaping it. Prompt safety nets and a legacy census do not establish admission or general row preservation.

#518 remains open and excluded: row identity does not identify a transfer event. Accepted residues include pre-gate clients, malformed-data repair requiring retained evidence, and transfers/ambiguous text edits refusing until lossless representation is available. Immutable archives stay intact. None permits silent dropping, weakened source guards, or an unreviewed baseline change.

## 12. Release plan — four releases, each green on master (owner's go, 2026-10-08)

Why four: the single series of §10 re-anchors 90 sabotage clauses, re-baselines the golden files and all four replay baselines, and flips the stored shape in the same breath as every reader, on a tree that moved 61 commits in the week of 2026-10-06. Each release below lands on master green under the full gate and can be reviewed on its own; the stored shape changes in exactly one of them, and frozen artifacts move in exactly two.

| Release | Contents | What stays unchanged | Gates (§8.2) |
|---|---|---|---|
| **(a) The version gate** | Pure world/envelope/sheet checks at every external admission boundary before effects, including manual/automatic pulls, imported Play, checkpoints, nested/archived sheets, editor and cleanup. New exports stamp supported 10. A campaign/destination incompatibility lock covers later save/push/unload. Ships alone, then verify the gate-bearing runtime on each owner device. **Shipped v1.1194 (Fable, 2026-10-08):** `SAVE_VER`/`SHEET_VER`, `versionNewer` + `worldVersionIssue`/`sheetVersionIssue`/`charFileVersionIssue` (helpers.js), refusals before the first write at every door listed in sync.md §3, the refusal screen in place of the wizard, `portableSheet` stamps `sheetVer`, the stored push lock `tnd_version_lock_v1` cleared by a compatible reconcile. The lock covers the upload only — local saves stay the device's own. Merge-archive preimages are not gated: they re-enter through a gated door or not at all; `mpFallen` sheets are read by the world gate. **Independent review (Opus, 2026-10-08) found four holes, all closed in v1.1195:** the `.tnd` import bypassed inflate (gated in `importSaveData`); the boot reconcile adopted the account's latest cloud world over a refused local save (no reconcile or boot push after a refusal); the manual push, the server camp slot and the library save ignored the lock (all refuse now); the lock held one campaign (a map, one entry per campaign). Also closed: the wizard's pending companions, the companion browser's two roads, the legacy pick, `libUpdateApply`, the editor's draft restore and library save, map cleanup's live load, a camp held through the escort scene, Infinity, `libReplaceApply`'s wrong reason, the orphan lock on delete, the double toast on a switch, the refusal screen's missing clear-cache route. **Residual (review R7), filed as a follow-up:** on a device's first contact after a page-hide overflow, the JP0-11 boot push runs before any reconcile and can land older-build state on a newer cloud copy; the close is server-side (refuse a POST whose world shape is older than the one held). | String inventories, readers, frozen baselines; retained storage key. | 5; refusal/order/transport cases from 14; old-build synthetic future-save refusal half of 11; independent review before release. |
| **(b) The module, delegates, contextual registry** | inventory.js owns both the tested future row API and a lossless legacy representation adapter. All runtime readers/writers route through that boundary; keep compatibility delegates while direct callers/source pins need them. Land contextual gate/prepare/publish admission (§5.3), with no row installation. One-key convergence and unique-base rename refusal are intentional behavior changes in their own tested commit(s), including literal-name/count/provenance distinctions. | Live/persisted inventories remain strings; worn names/order and untouched text remain exact. No replay/golden baseline moves. A row cap must not silently clamp legacy data. Frozen field parity is a stop gate if convergence affects those fixtures. | 1, 2, current WORN/item cases of 3, 4, 5 regression, 14; byte-identical gate 8 and four unchanged replays. Derive/reprove affected anchors; no assumed survivor count. Independent review of the registry and drift changes. |
| **(c) The shape flip** | Activate prepared row installation at every door/faucet; write world/sheet/char version 11. Fold worn into equipped; retain WORN grammar/receipts and the Wearing label. Narrowly prepare replay fixture inventory/stamps and regenerate the four baselines under gate 9’s exact whitelist. Run census, roundtrips, skew, WORN live turns and independent review. | GM grammar and stable STATE TAGS doc; volatile prompt except allowed equipment order on the Wearing line. | Applicable 1–7 regression (EQUIPPED/alias additions remain in d), 8–11, 12 using WORN/current grammar, 13, 14. Only this release moves replay artifacts. |
| **(d) EQUIPPED** | Add EQUIPPED to the shared WORN handler, accepted words, doc and strip set; use Equipped prompt/receipt wording and owner-selected counter text. The equipped mark in the panel and on the sheet: `◆` in `--acc` before the name, the name in `--t0`, unequipped names in `--t1`, the word in the tooltip (§3.5). Re-baseline tag-doc/strip goldens and pins. If paired with #420/#22b in a deploy, use separate commits and attributable prompt diffs. **Built v1.1204 (Fable, 2026-10-09):** the handler is registered as `EQUIPPED` with `WORN` the documented alias in `TAG_NO_HANDLER`; gates 3, 6 and 8 green (the only prompt hunks: the one STATE TAGS line and the `Equipped:` label); the mark confirmed in the preview; gate 12 green live (gemini-3.8-flash wrote `[EQUIPPED:]` in its own spelling); gate 13 closed as d2 v1.1207 ([receipt](../audits/REVIEW_599_release_d_2026_10_09.md): nine findings, one live behaviour change — jewelry had lost treasure's Define exemption — every one closed test-first). Paired in the deploy with #607's doc-line move (its own commit), not #420/#22b (not ready). The ledger rows' internal `worn` field keeps its name until the cleanup commit. | Stored row shape and replay artifacts (prove unchanged, do not assume). | 3’s EQUIPPED on/off, permanent WORN alias, uncarried refusal, strip/unknown-tag and receipt cases; 6 affected sabotage; 8 exact stable/volatile diff; 12 EQUIPPED/WORN live cases; 13 independent review with owner’s go. This is the second release moving frozen artifacts. |

Rules that hold across the four: one concern per commit and tracker updates in that commit; `APP_VERSION` and the SW cache bumped on each; the range sweep before every push; a release half-done at budget's end is reverted, not committed; the counter rows that name the row shape as their remedy (#517, #518) wait for (c).
