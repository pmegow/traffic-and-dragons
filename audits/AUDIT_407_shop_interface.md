# #407 — the shop interface (v1.944, 2026-09-16)

**Owner drawing (2026-09-16):** two columns, the hero's inventory left and the keeper's wares right; a click on a left row marks it for sale and turns the row green, a click on a right row marks a purchase and turns it pink; the marked amounts run beside the rows; a signed total at the bottom and one Complete transaction button; the hero's gold in small gold text under their name. Four rulings settled in the same conversation: sell price is half bible canon, full when the keeper WANTS the item, and an item with neither is not sellable at the counter; a click on a stacked row adds one and clicking the count clears it; phones drop the middle strip and put the signed amount at the marked row's edge (one page everywhere); Complete applies atomically, writes one system line naming hero and keeper, and arms one in-character sentence for the GM's next turn.

## What was built

- `shopTradeCatalog()` (helpers.js): pure over the village teeth — `villageTradeContext` (a shop with its keeper present), the shop node's live wares (`nodeWaresLive`) and WANTED list, bible canon (`itemLookup` / `itemValueGp`). Groups the hero's inventory by base name with stack counts, flags worn items, prices each row.
- `shopTradePlan(cat, marks)`: lines, sell and buy sums, the whole-gp net (halves away from zero; a non-zero purchase never rounds to free), the affordability lock with the shortfall named.
- `shopTradeTagText(plan)`: the plan as `[GOLD:±N]` / `[ITEM_LOST:x N]` / `[ITEM_GAINED:x N]`, chunked to the parser's x9.
- `shopTradeApply(marks)` (game.js): runs the tags through `applyMuts`, so the trade gate, the stack helpers, worn pruning and the mutation log apply exactly as for a GM turn; a refusal is loud and nothing else moves. Then the shelf: a bought ware leaves it, a sold item joins it through `fileWare` (pinned to canon; no canon = the price paid), so it can be bought back. One system line, `tradePing` armed, save.
- `buildTradeNote` (api.js): the one-shot; registered in `NOTE_BUILDERS`, `NOTE_LATCH_FIELDS` and `NOTE_SHAPES` (village fires). Tells the GM gold and items are already updated, asks for one in-character sentence, never a re-tally.
- `showShopModal()` (ui-modals.js): the thin shell over the pair; `⇆ Trade with <keeper>` in the inventory panel, shown only where the gate is open. Styles in index.html: green sell rows, pink buy rows, tabular amounts.

## Verification

- Four engine assertions, written first and red before the pair existed: the catalog (pricing, WANTED, unsellable, worn, buy rows, the gate), the plan (stack cap, worn and unpriced skipped, rounding, the lock, tag text and chunking), Complete (gold and inventory moved as tags, the shelf, the ping once, the orchestrator, a stale plan against a closed gate moves nothing) and the registry/thin-shell contract (no stable-half change, adventure never opens the counter, the modal never writes).
- `dev/sabotage-407-shop.js`: 10/10 clauses caught — sell fraction, WANTED price, worn, the lock, half-gp rounding, the shelf on purchase, the ping, the ledger line naming both parties, the orchestrator row, the modal applying tags itself. Two draft clauses were replaced during proving: one guarded an unreachable branch (the gate cannot refuse a plan the catalog just admitted), one had no test biting until the plan test wore an item with canon.
- `dev/qa-407-shop.js` in real Chrome: the panel row, the modal header with the hero's gold, two sales and a purchase marked with the running amounts and a −47 gp total, the count click clearing a stack, Complete moving gold 60 → 13, the potion leaving the shelf and the sold items joining it at canon, one system line, screenshots at 1280 and 390 px.
- Full suite ALL GREEN (2,204), 38 standalone suites.

## Not done

- Haggling stays in prose. No keeper purse. Adventure campaigns do not get the counter in v1 (`waresPerShop` is village-only).
- Owner in-game pass with a real inventory of eighty items: does the list need search or the bible's category grouping inside the modal?
