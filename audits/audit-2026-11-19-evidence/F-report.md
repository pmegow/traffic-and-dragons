# Lane F report — identity.js, inventory.js, admission.js, item-kinds.js (HEAD d7ed4ea6, v1.1451)

## 1. Coverage

| File | Read | Notes |
|---|---|---|
| item-kinds.js (132 lines) | whole | plus its callers game.js:3044 / 3835, migrateWorldState state.js:568 |
| admission.js (82 lines) | whole | plus state.js inventoryAdmitWorld (530–551), worldVersionIssue callers |
| inventory.js (535 lines) | whole | plus helpers.js keyedDict/ownValue/keyedStores (1–17), itemBaseName (2009), itemLookup (2490), INVENTORY_CATEGORY_REGISTRY |
| identity.js (2248 lines) | whole, in nine chunks | the NPC resolver itself (resolveNpcName / npcConsolidation / npcExactKey / npcFormerKey) lives in memory.js and was NOT read beyond resolveNpcName's first lines and memoryNpcIsPlayer; tag_table.js NPC_MERGE handler not read |
| Contracts | DOC/contracts/identity.md whole; items.md and DESIGN_599 §5 not read in full (time) — invariants I1–I5 taken from inventory.js's own header |

Probes: `audits/audit-2026-11-19-evidence/F\probe1.js` and `...\F\probe2.js` (real engine via dev/load-engine.js; each runs in under a second).

## 2. Findings

### F1 (medium) — An item whose name is longer than 80 characters is filed under the wrong key, so it is never sorted and the pack is re-sorted with a paid model call on every turn, forever.
- File/function: item-kinds.js `itemKindsOwed` line 58 and `itemKindsSettle` line 124.
- Code: owed rows carry `name:String(es[j].name).slice(0,ITEM_KIND_NAME_MAX)` while the key is `itemBaseName(es[j].name)` (the full name); the settle then files with `itemKindFile(ws,owed[i].name,…)`, which computes its own key from the TRUNCATED name.
- Input: a carried item named "Ornate ceremonial dagger of the Seventh Dynasty with a jade hilt and silver filigree inlay worked by hand" (105 characters) with no canon.
- Observed (REPRODUCED, probe1.js): the record is stored under `"…silver fili"`; `itemKindsOwed` still lists the full key after filing; `groupInventory` keeps the dagger under Unclassified; three consecutive `itemKindsSettle` runs made 3 `callGM` calls, each toasting "Inventory sorted: Ornate … fili → Weapons" though it filed nothing (`settle2 []`, `settle3 []`). The settle is awaited inside the turn (game.js:3044), so each turn also gets an extra model round trip and a "Sorting the pack..." marker. Because owed items are taken in pack order and capped at `ITEM_KIND_ASK_MAX` (40), 40 or more such names ahead of the others would block every later item from ever being asked.
- Secondary: the toast is built from what was ASKED (`itemKindsSaid(owed,read.kinds)`), not from what `itemKindFile` accepted, so a refused filing (this case, or an item that gained canon during the wait) is still announced as sorted.
- Remedy: file by the owed row's key (pass `owed[i].key`, or keep the full name beside the truncated one and pass that); build the toast from `filed`.

### F2 (low) — A row field named `__proto__` is lost, and the destination row's prototype replaced, when the row's fields move to another pack.
- File/function: inventory.js `invAdd` line 128 (`for(k in ex)row[k]=JSON.parse(JSON.stringify(ex[k]))`) and `invCarryFields` line 164 (same assignment onto a plain row).
- Input: a saved or imported row with an own `"__proto__":{…}` field (what JSON.parse produces from a file carrying that key), moved through `invRemove` → `addInventoryItem(dest,name,fragment)` (the I5 transfer path).
- Observed (REPRODUCED, probe1.js): `invRows` and `invRemove` keep the own field (`prepared row own __proto__ true`, `fragment own __proto__ true`); after `addInventoryItem` the destination row has no own `__proto__`, its prototype is no longer `Object.prototype`, `dest[0].lit` reads `true` through the prototype, and `JSON.stringify` drops the field. `invCarryFields` drops it the same way. This contradicts I5 ("unknown own fields ride every … copy verbatim") and the stated intent at `invExtras` ("an own `__proto__` field is a field, never the prototype (review (b) 12)"): the bag is safe, the write out of it is not. The pollution is scoped to that one row object, not global.
- Remedy: write extras with `ownAssign` (helpers.js line 5, `Object.defineProperty`) instead of `row[k]=`.

### F3 (low) — `locMerge` accepts merging a place into one of its own children, which leaves a node that is its own parent and moves the party to a place that does not exist.
- File/function: identity.js `locMerge` lines 471–504 (no ancestor check; `locReparent` at 511–512 has one).
- Input: `locMerge("Town|Inn","Town",R)` with the party at Town / Market.
- Observed (REPRODUCED, probe2.js): returns true; `Town|Inn`'s parent "Town" now resolves to `Town|Inn` itself; every walk up from `Town|Inn|Cellar` repeats `Town|Inn`; Market's parent resolves to the Inn; `_locHealLivePointers` rewrote the world pointer to `location:"Town|Inn"` with `sublocation:"Market"` still set, so the effective key `Town|Inn|Market` names no node.
- Reachability: the GM tag cannot name a pipe-bearing canonical (`[MERGE:location|Town|Inn|Town]` is refused as 4 segments, confirmed), so the GM path needs a pipe-free key that has a parent (a node reparented by map_cleanup) or an alias resolving into a child. The repair surfaces (map_cleanup.html, dev/loc-repair-core.js line ~87) can reach it with a human mistake. GM reachability is SUSPECTED, not shown.
- Remedy: in `locMerge`, refuse when `canonical` has `duplicate` among its resolved ancestors (reuse the `locReparent` walk), loudly.

### F4 (low, contract drift) — The name-path death gate compares a stored scene negative by raw string, not through `_sceneRefEntitySame`, which the contract says every comparison of a stored entity uses.
- File/function: identity.js `w2NamedPresenceEvidence` gate 2, line 1487: `if(ng[k].entity===canon&&ng[k].mode==="explicit"&&!ng[k].resolved)return null;`
- Contract: identity.md #530 — "every comparison of a handle's stored entity reads it through `_sceneRefEntitySame` … so a handle a merge stranded before the re-key heals on read." `_sceneRefExplicitNegative` (line 1093) does this; gate 2 does not.
- Failing sequence: a save from before #530 (v1.1232) whose explicit `[SCENE_NOT:]` negative is still keyed under a merged-away name; a bare `[NPC:Survivor|dead]` then passes gate 2 (the "not X" disidentification no longer blocks) — a fail-open on the death gate for that legacy shape. Saves made since #530 have their negatives re-keyed by `sceneRefsRekeyEntity`, so current play is unaffected.
- Status: READ (not run; building a pre-#530 stranded negative fixture was out of time).
- Remedy: `_sceneRefEntitySame(ng[k].entity,canon)` in gate 2.

### F5 (low, exposure) — An item-section reply of the right length with its answers in the wrong order is filed permanently and cannot be detected.
- File/function: item-kinds.js `itemKindsRead` (line 76 checks only the count) / `itemKindFile` (never replaced, line 89).
- Input: asked `["Hide armor","Healing potion"]`, the model answers `{"kinds":["consumable","armor"]}`. Both words are valid, the count matches, both are filed, and neither is ever asked again. Only canon (an accepted [ITEM_DEF:] or a bible entry) overrides it; there is no re-ask path.
- Status: READ (follows directly from the code; the reply format carries no per-name echo).
- Remedy (if wanted): ask for `{"kinds":[{"name":…, "kind":…}]}` and check each echoed name against the asked one, or accept the exposure explicitly in the contract.

### F6 (low, monotonic) — `worldState.itemKinds` is never pruned.
- item-kinds.js: one `{kind, turn}` record per distinct item base name ever owed, per campaign, including names later dropped, sold or renamed, and the `unclear` ones. No cap, no eviction; `itemKindsHeal` drops only unreadable records. Small records, but unbounded over a long campaign with a GM that invents many item names. READ.
- Remedy: a cap with oldest-turn eviction (the item is simply asked again), or prune names no sheet carries at the load door.

## 3. Monotonic resources

| Store | File | Scope | Bound | Enforced? |
|---|---|---|---|---|
| `worldState.itemKinds` | item-kinds.js | per campaign, forever | none (one per distinct item name ever asked) | **No (F6)** |
| `worldState.identityConflicts` (stale records) | identity.js `_w2Conflict`, api.js:1795 | per campaign | `IDENTITY_CONFLICT_CAP` counts NON-stale records only; stale ones stay until resolved (kept on purpose for the #17 panel) | **No.** Each new (subject, handle) pair that shelves adds a permanent record, and every turn walks the whole list (`_w2DisputedQuests`, the `_dSubs` loop in `w2PrepareResponse`). Deliberate retention, but no bound. |
| `worldState.canonTxns` | identity.js | per campaign | `CANON_TXN_CAP`; committed receipts retire after `CANON_TXN_RETIRE_TURNS`, quarantined after 2× (to the archive) | Yes |
| `memory.archive.identityMerges` / `.quarantinedReceipts` / `.locationStates` | identity.js | per campaign | relies on archiveHeal / MEMORY_ARCHIVE_KEYS (memory.js, not read) | Undetermined |
| `worldState.sceneRefs` sealed frames / overflow.frames | identity.js | per campaign | `SCENE_REF_SEALED_CAP`, and the same cap for the overflow buffer (then frames drop, loudly) | Yes |
| frame `observed[]` | identity.js `presenceObserve` | per frame | `PRESENCE_OBSERVED_CAP` LRU | Yes |
| frame `actors[]` / `negatives[]` | identity.js | per frame | `SCENE_REF_ACTOR_CAP` / `SCENE_REF_NEGATIVE_CAP` (overflow latches) | Yes |
| `worldState.relAxisChoices` / `relBondChanges` | identity.js | per campaign | 8 each | Yes |
| `worldState.relBondReceipts`, `relAxisReviewFired` | identity.js | per campaign | one per relationship edge | Bounded by edges, not by a cap |
| `worldState.provisionalNudged` | identity.js `buildProvisionalNudge` | per campaign | one per provisional key ever minted; not deleted when the provisional resolves | Bounded by provisionals ever made (small); not enforced |
| `worldState.plotArmor` | identity.js | per campaign | one per armored NPC that escaped | Bounded by the roster |
| `_locResMemo` | identity.js | per session | reset on generation / entries object / key count change; one entry per distinct queried name per generation | Yes (by reset) |
| `_spFactsMemo` | identity.js | per session | one map, rebuilt per turn / transcript length | Yes |
| `invEntries._said` | inventory.js | per page session | one key per distinct (junk count, first position, list length) | Not enforced; small in practice |
| `sheet.inventoryJunk` | inventory.js `invHealSheet` | per sheet, forever | deduplicated by reason + content; no count cap | Partly (dedupe only) |
| `_invCatWarned` | helpers.js | per session | per entry | Small |

## 4. Affirmed (tried to break, held)

1. `invStoredParse` count grammar: "3 torches", "Potion (x2)", "x", "x5" and "Arrows x0" are literal one-unit names; "Torch x10000" is refused, not clamped (probe1.js).
2. `invAdd` / `invRemove` with qty 0, −3, 2.5 and NaN fall to one unit (`invUnits`). Every caller passes a decoded count ≥ 1 or 1, so this cannot be reached outside inventory.js (grep).
3. Removing more than is held takes what is there and drops the row, as pinned at engine-tests.js:35108.
4. `invRename` onto an existing key ("Coil of rope" → "ropes" beside "Rope") refuses.
5. The `.slice()` sharing hazard is real (a removal from the slice decremented the live row: `live qty 1`). `invSnapshot` / `invDetach` deep-copy correctly. Not a finding, because the module documents it and the boundary contract polices `.slice()`.
6. A `__proto__` or `constructor` ITEM NAME in item-kinds: `seen` and the store are null-prototype dictionaries, `ownValue` reads safely, the record lands and survives a JSON round trip (probe1.js). On a plain `{}` store the record would be lost, but every load runs `keyedStores(…,"world")` first (state.js:270 / 563 / 872) and `itemKindFile` creates a keyedDict when the store is missing, so the plain store is not reached.
7. All-or-nothing at the load door (`inventoryAdmitWorld`): the only gates that run in same mode are version and inventoryCheck. Every sheet's pack is checked before any heal, and `worldVersionIssue` walks every sheet's version before the door at every caller (state.js:269 / 813 / 1134, ui-campaigns.js:337, storage-adapter.js:957). So no sheet is converted before a later sheet's refusal. The remaining gap: a THROW inside a prepare entry would leave earlier sheets healed; see Undetermined.
8. Self-merge, pipe-bearing and unknown-domain `[MERGE:]` / `[ALIAS:]` refuse loudly with no mutation (`_identityActionTag`; the 4-segment refusal is confirmed in probe2.js).

## 5. Undetermined

- `sheetAdmit` promises "Never throws on a bad source", but a prepare entry that throws (for example `JSON.parse(JSON.stringify(source))` on a cyclic in-memory sheet, or a `relationshipMigrateSheet` / `ensureV10Arrays` failure on malformed data) propagates out of `sheetAdmit` and out of `inventoryAdmitWorld`. With `detach:false` (the load), the earlier sheets would already be healed in place. No realistic input was found that throws; not probed.
- Whether a misordered item-kinds reply (F5) is observed in practice; it needs live model output.
- Whether the memory archive categories that identity.js pushes into (`identityMerges`, `quarantinedReceipts`, `locationStates`) are capped by archiveHeal (memory.js, outside this lane).
- The NPC consolidation rules (`npcConsolidation`, `npcKeptApart`, the title question) live in memory.js and were not read. The lens items "case / leading 'the' / titles fold two people" for NPCs were not exercised beyond what identity.js calls; the contract says a 16,000-sequence fuzzer covers them.
- `w2ValidateSummary` line 2213 reads `memory.npcs[cn].dead` with `cn=resolveNpcName(names[j])` and no guard. It would throw if a memory key resolved to a non-key. `resolveNpcName` tries the exact key first and returns the input for hero names, so no such input was found; not probed exhaustively.
