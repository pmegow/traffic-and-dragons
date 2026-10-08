# Entry 39 — evidence brief C

Evidence only, on `8715997f6ce1837c032867d4de8477d718dc5b64` (tree `3aa32e6c4cb53220ca3efb46eee03d3400829474`). No adjudication or implementation. The ten owner rulings in design §9 govern: WORN remains readable indefinitely, only EQUIPPED is documented, equipped output may move into pack order, and the version gate precedes rows. #517/#518/#531/#527(28) implementation remains outside this work.

The census starts with the requested rg query (1,424 matching lines), then adds helper names, local array operations and opaque sheet boundaries. `inventory-sites-expanded.json/csv` contains 2,077 sites across 147 files, with file:line, access, representation, boundary and coverage. Classification is mechanical and conservative; it includes comments, metadata and false-positive name matches. `inventory-function-bodies.json` retains 107 relevant function bodies. This is exhaustive for the recorded search/expansion rules, not a claim that every dynamic alias was proved or every site executed. Individually traced surfaces follow. Overall dynamic-alias completeness: UNDETERMINED.

| Boundary / representation | Source citations at baseline | Design-map evidence |
|---|---|---|
| Hero/companion/legacy prompt joins; money-note bases; item-canon names | api.js:664,2394,2495,2607,2718,3005 | Covered; actual lines moved since draft |
| Table Talk joins and item inspection | table-talk.js:119,170,208 | Mentioned in narrative, absent as a §4 table row |
| Stack/count/rename/equip helpers and item-name/pair aliases | api.js:3177–3388 | Covered; current pairs use #545 keyedDict |
| Tag gain/loss/rename/equip/stash writers | tag_table.js:533,535,567,636,1676,1692,1705 | Covered; alias parsing remains future work |
| Toast snapshot, ghost loop, recurring-name loop | game.js:2145,2316; memory.js:2404 | Three silent string-only readers confirmed |
| Catalog grouping, sorting, drop marks, delete indexing | helpers.js:2464,2488,2500,2507,2520,3401,3465; ui-sheets.js:57,65 | Covered; generic aliases captured separately |
| Transaction preflight and before/after snapshots | game.js:380,4394; tag_table.js:540 | `.slice()` copies rows shallowly; safe object mutation semantics unspecified |
| Define whole-string lookup, Sync tallies/free-text writer | game.js:4291,4373; ui-modals.js:208,243 | Covered |
| Image prompt and library preview joins | ui-portrait.js:149; ui-browsers.js:497 | Covered |
| Library/portable copies and pendingLegacy | helpers.js:2229,2235; game.js:1130,1556–1630; identity.js:709 | Covered broadly; #542 admission and #545 own-field contracts now apply |
| Generic editor list indexing/add/delete/draft | character_editor.html:238,287,289,290,345,357 | Covered; test seam already exists at :365 |
| Wizard/model faucets; starting-kit strings | char-creation.js:324; game.js:1433,1480; ui-sheets.js:476,491; class_bible.js gear fields | Covered; shipped string fixtures remain admitted input by proposal |
| Merge archive and transferred charSheet | tag_table.js:385,738,752 | Opaque inventory-bearing preimages not expressly inventoried in §4 |
| Fallen-PC sheet copy/rejoin | game.js:4156,4165 | Additional opaque admission boundary not expressly inventoried in §4 |
| Checkpoint/world copies and restore | state.js:783,801,822 | Covered; current restore only heals memory, not migrateWorldState |
| Dictionary admission and unknown-field copy | helpers.js:1–17; state.js:265,512,822 | Post-#545 contracts: null-prototype dictionaries, ownAssign, unknown records preserved |
| Repair tools vs active tools | dev/repair-t1782-blackout.js; dev/repair-t1788-bundle.js; dev/item-bible-coverage.js; dev/playtest-harness.js | Repairs explicitly obsolete; other readers covered |
| Tests and tool count drift | design-count-comparison.json | 76 literal `.inventory` lines/12 root JS files; 267 engine-test lines. 296 of 2,808 static t() blocks mention inventory/worn, versus draft 271/2,713. Different lexical measures are not interchangeable |

The #518 mechanism is reply-wide matching: ITEM_GAINED records igHits under itemPairKey; a missing COMPANION_ITEM_LOST consumes that key and removes the earlier gain (api.js:3343–3350; tag_table.js:1692–1699). Prose does not supply event identity. The exact documented failure and controls used the real loader with isolated globals and no-op persistence/UI stubs; no exception occurred. Full input, clean prose, R including errors, warnings, before/after units and chest records are in `518-controls.json`.

| Case | Before hero / Bram / chest | After | Observed mutation receipt / factual status |
|---|---|---|---|
| `You loot a dagger. [ITEM_GAINED:Dagger] Bram throws his dagger. [COMPANION_ITEM_LOST:Bram\|Dagger]` | 0 / 0 / 0 | 0 / 0 / 0 | `+Dagger`; `⚠ Nothing moved — 'Dagger' is not on Bram's sheet`. Documented gap reproduced |
| Same loot, untracked Spear throw | 0 / 0 / 0 | Dagger1 / 0 / 0 | `+Dagger`; unrelated-name negative separates keys |
| Genuine missing Dagger take | 0 / 0 / 0 | 0 / 0 / 0 | Same receipts as independent loot; same tags cannot distinguish events |
| Gift Torch x3, one held | Torch1 / 0 / 0 | 0 / Torch1 / 0 | Cut to one; control no gap |
| Gift Torch x3, three held | Torch3 / 0 / 0 | 0 / Torch3 / 0 | Full count; control no gap |
| Unpaired companion gain x2 | 0 / 0 / 0 | 0 / Torch2 / 0 | Full gain; control no gap |
| Take Torch x3, Bram holds one | 0 / Torch1 / 0 | Torch1 / 0 / 0 | Cut to one; control no gap |
| Take Torch x3, Bram empty | 0 / 0 / 0 | 0 / 0 / 0 | Nothing moved; control no gap |
| Potion gift at own house | Potion1 / 0 / Potion1 | 0 / Potion1 / Potion1 | No chest double-take; control no gap |
| Proposed `{name,qty,equipped}` | Same Dagger row representation under either narrative | No source/destination/event field | Row identity is not transfer identity; no future transfer implementation tested |

| Gate/sensitivity | Expected discrimination | Actual evidence / status |
|---|---|---|
| Erase equipped only | Equipped comparison fails; inventory text/units unchanged | Actual census scratch mutant exits **0**, CENSUS OK; same counters as baseline. Gap in present census, not proof future gate passes |
| Reverse inventory | Byte-order assertion fails | Actual census scratch mutant exits **1**, two text mismatches; zero unit mismatches |
| Only equipped output uses pack order | Accept owner-approved order | Baseline worn Shield,Axe projects Axe,Shield; census exits0 with one order change. Scratch exact projection checker accepts |
| Drop unknown slot/future | I5 preservation fails | Existing reference already drops both; deep idempotence still passes. A scratch preservation assertion fails |
| Plant typeof-string reader | Named boundary guard fails | Current inventorySnapshot on three row objects returns `{}`. Proposed static guard absent; no shipped guard failure claimed |
| Skip admission heal | Row admission and prompt-order checks fail | invHealSheet absent; current relationship adapter retains strings. Proposed sabotage/assertions UNDETERMINED |
| Exact prompt projection | Only authorized label/content/order change accepted | Scratch checker rejects erased equipped, changed inventory order and one unrelated space; checker is not shipped |
| Frozen diagnostics | Both exact titles attach diffs | Extracted `_frozenFailureDetail` matches originals; renamed titles return empty diagnostics. Hash failures themselves remain failures (run-tests.js:2351–2357) |
| Golden/strip/doc today | Existing frozen bytes agree | `node dev/tests-frozen-golden.js`: ALL GREEN — 5 assertions. No rebaseline; EQUIPPED alias/doc gates unimplemented |
| Replay startup | Four fixtures heal before tags; projection proves only inventory changed | Current four baselines each have one string inventory and no worn. diff-replay.js:41–66 seeds without migration; proposed healer/checker absent |
| Prompt capture bypass | Heal precedes inventory render | capture-prompt.js:20 inflates then builds, without migrateWorldState. Sentinel instrumentation observed four sheet-adapter calls and `Inventory: HEAL_SENTINEL`; current ordering confirmed, future heal not tested |
| Module/editor loading | All state consumers load inventory module | inventory.js absent; character_editor loads helpers/state, map_cleanup loads state without api. Existing __ceTest / __cleanupTest seams confirmed |
| Sabotage attribution | Named section AND mustFail required | sabotage.js:243–253 checks mustFail; design names battery but no clause/test names exist yet. No #599 mutation gate declared passed |
| §8.2 remaining gates | Future module/identity/handler/gate/roundtrip/skew/live/independent proof | UNDETERMINED as implementation gates; no broad suite, cloud roundtrips, live calls or rebaselines run |

| Resource scope | Observed state / bound | Factual gap or limit |
|---|---|---|
| Per call | Reference normalize+project repeated1,000: 3 rows,124 JSON bytes throughout; 2.4623ms;1,000 new array identities; probe retains zero old refs | Fixed input does not grow output; allocation churn is not retained growth. No heap/GC measurement |
| Per call: copies | Row object shared by `slice`; scratch qty decrement changed live3→2 | Future writer/preflight semantics UNDETERMINED; current strings are immutable |
| Per turn | One real prompt fixture invoked sheet adapter4 times; inventorySnapshot/pair maps transient | Future invHealSheet allocation/warning policy absent |
| Per session | `_itemAliasMemo` one replacement index; `_invCatWarned` and `_coinValueCache` keyed by distinct inputs (helpers.js:1995,2012,2218) | Repeated same input bounded; distinct-input retention grows. No new row-index cache designed |
| Per campaign | tagLog/noteLog caps40; stashMoves cap200; consumable latches persist; checkpoint one/campaign | Rows and portable version scalars add O(items)/O(sheets), not O(turns) |
| Per campaign: junk/history | Proposed inventoryJunk; immutable merge preimages and mpFallen copies hold sheets | Junk repeat/dedup/cap/serialization rules unimplemented; archives grow by events, not repeated normalize |
| Per device | Existing local keys retained by ruling; editor draft one slot; campaign/checkpoint/history copies; version stamps scalar | No proposed per-heal storage key. Growth with campaigns/history distinct from repeat-load growth |
| Dictionary invariant | keyedDict passed own-key roundtrip checks for __proto__, constructor, toString | Current #545 contract must persist in new indexes/copies; reference model is not release code |

Schedule evidence: Astra B currently says one-release WORN and C separates transaction identity; Opus schedules a server-reader deploy and an early fixed window. Those old assumptions are superseded by §9: indefinite alias, no server parser change, gate first, time as needed. Both schedules' shipped-history assumptions precede #525/#528/#542/#544/#545; #597/#598 already shipped. No timetable was redesigned.

Run the retained `.cjs` probes from this TEMP directory with Node. `probes.cjs` writes only synthetic fixtures/results here; `infrastructure.cjs` reads baselines and instruments isolated globals. All tracked-file SHA-256 values were compared before/after in `metrics.json`. The first infrastructure run used the wrong replay suffix and failed ENOENT; correcting to `.json.endstate.json` produced the recorded result. Initial sandbox git-status and unquoted PowerShell tree reads failed; escalated read-only commands and a quoted revision resolved them. No source edits, personal-save access, live calls, commits or rebaselines occurred.
