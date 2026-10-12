# Fix 2026-10-12: #577 and #591, the seven red acceptance probes

Worktree `agent-ab6772d76627fc925`. Nothing committed, no TODO.md edit, no APP_VERSION/CACHE bump.

**Patches:**
- **`scratchpad\fix-577-591.patch`** is against **origin/master 3bbed367** (v1.1227). It carries the acceptance section and applies to origin/master on its own.
- `scratchpad\fix-577-591-on-390cc0bf.patch` is the same change against the lane's starting HEAD 390cc0bf.

**Why there are two:** origin/master moved during the lane (#593 v1.1227, #615). Its #593 acceptance section sits at the same insertion point as ours (after the #593 tests, before `section("#518 block`), so the 390cc0bf patch's engine-tests.js hunk no longer applied there. I fast-forwarded this worktree to origin/master and re-applied with `--3way`. Every file but engine-tests.js applied cleanly. The one conflict was two pure insertions, resolved by keeping both: #593's section first, then ours. memory.js, inventory.js, tag_table.js and the battery files are byte-identical to the 390cc0bf build; helpers.js and engine-tests.js differ only by origin's own changes. Every gate below was re-run on the origin/master base.

**Result: all 7 red probes are green; 32/32 acceptance tests pass; full suite ALL GREEN** (3017 assertions on origin/master, which adds #593's 21; it was 2996 on 390cc0bf). Nothing is left red.

> Drift surface: this touches `applyMuts` write paths (ITEM_LOST, the gift and stow put-backs, the post-handler seam) and the want match. It was built by an Opus lane. Per the 2026-07-09 decree it needs Fable/Astra review before landing, and a todo_checkWithFable.md line if it lands off-Fable.

## Per defect

### 30: a voided loss retired the want (gift to nobody, refused placement)
- **Mechanism:** `wantedSaleSettle` ran at the end of ITEM_LOST. COMPANION_ITEM_GAINED and LOCATION_ITEM run later in table order and put the unit back after the want was already retired and "Want met" printed.
- **Decision: settle provisionally, land at the seam, resettle only on a void.**
  - The settle still runs inside ITEM_LOST, and its retirements land there, so nothing changes in a reply with no void. That covers a same-reply `[WANTED:]` refresh, its cap eviction and `[TIME_ADVANCE:]` expiry.
  - Each loss's place, node and live wants are snapshot at that first settle (`L.at`, `L.node`, `L.live`).
  - Every put-back calls `wantedLossVoid(R, blk, sheetName)`, which adds to `L.void`.
  - At applyMutsTable's post-handler seam, `wantedSaleLand` checks for a void. If there is one, it restores every row the provisional settle retired (`restoreWantedRow`, at its old index) and settles again from the same snapshot, counting only the units that left. Then it inserts the lines at their loss positions.
  - With coin in, a voided loss gets "⚠ Want kept — X (keeper): the loss was voided (it went back in the pack) — not read as its sale".
- **Why not a plain deferred settle:** a deferred settle would let a same-reply `[WANTED:]` at the cap evict an innocent want, because the met row would still hold its slot when WANTED files. It would also let `[TIME_ADVANCE:]` expire the want before the sale is judged.
  - Measured with `scratchpad\probe577\cap-check.cjs`, HEAD against the fix: a met sale plus a new `[WANTED:]` at cap 4 is identical; a met sale plus a re-statement is identical; only the voided gift differs, as intended.
- **Change:**
  - tag_table.js:559: `R.wantSettle=wantedSaleSettle(...)`.
  - tag_table.js:1853 `wantedLossVoid`, tag_table.js:1858 `wantedSaleLand`.
  - tag_table.js:1987: the seam call, in try/catch with R.errors.
  - Put-back calls:
    - tag_table.js:641 (placement carrying fields);
    - tag_table.js:645 (refused placement);
    - tag_table.js:1686 (gift to nobody);
    - tag_table.js:1695 (the companion's pack refused, the first unit and the while loop).
  - memory.js:860 `retireWantedRow`, memory.js:861 `restoreWantedRow`.
- **Flipped:** `#591 acceptance a voided loss is no sale`.
- **Clauses (D4 battery):**
  - "the land never resettles" (`if(S.voided){`→`if(false){`), mustFail `#591 acceptance a voided loss is no sale`;
  - "a resettle restores no want", "the voided ⚠ line no longer says the unit went back" and "a restored want goes to the end of the list", each mustFail `#591 a voided loss says why` (a new D4 test).

### 28: two sales in two blocks of one reply retired only the first
- **Mechanism:** every loss was matched to a want in one pass before any retirement. Block 2's silver ring was priced at the silver offer that block 1 retired, and the keep line was then skipped because that want was no longer live.
- **Change:** `wantedSaleSettle` (tag_table.js:1829) groups losses by block in text order. Each block matches against `L.live` minus the rows earlier blocks retired (`wantedSaleAvail`, tag_table.js:1828), then decides, retires and writes its lines. The dead "an earlier block met it" skip is gone: a block can no longer be matched to a retired want.
- **Flipped:** `#591 acceptance two sales in two blocks of ONE reply`.
- **Clause:** "the blocks are matched in one pass again" (`wantedFor(wantedSaleAvail(L.live,gone),…)`→`wantedFor(L.live,…)`), mustFail `#591 acceptance two sales in two blocks of ONE reply`.

### 29: the GM writes the plain name while the pack holds only the silver ring
- **Mechanism:** the loss was recorded under the tag's words (`ilq.base`). `removeInventoryItem` actually took the sheet's "Warded ring (silver)", and ONE-WAY keeps the plain words from meeting the silver want, so the keep was silent.
- **Change:**
  - tag_table.js:550: ITEM_LOST collects `removeInventoryItem.last` per unit (`_ilSheet`).
  - `wantedLossRecords` (tag_table.js:1824) writes one loss record per sheet name.
  - The silver ring now meets the silver want (exact) or the plain want (ONE-WAY intact).
- **Flipped:** `#591 acceptance the GM names the base`.
- **Clause:** "the loss is recorded under the tag's words again" (`_ilSheet.push(removeInventoryItem.last)`→`(ilq.base)`), mustFail `#591 acceptance the GM names the base`.

### 6 and 31: rounding ("1 gp per 3" paid 9 sp 9 cp at the counter; three loss tags priced at 3 × 33 cp)
- **Mechanism:**
  - The counter priced a wanted line as the stored unit copper times q (`w.cp`, already `Math.round(100/3)`=33).
  - The settle priced each loss tag alone, so three tags were rounded three times.
- **One payment rule: `wantedPayCp`** (memory.js:841, logic unchanged, now documented as THE rule): the offer's bundle copper × n ÷ bundle, rounded once.
  - **Counter sale line:** helpers.js:3449 `cp:r.want?wantedPayCp(r.want,q):r.sellCp*q`, and the total sums `sl.cp`.
  - **Counter row amount:** helpers.js:3473. A wanted row carries the whole bundle's price and per, so `ledgerRowAmount` equals the plan's line.
  - **Catalog:** helpers.js:3434. `r.want` carries `offer` and `cp`.
  - **Settle:** sums the block's units per want and prices each want once (tag_table.js:1829).
  - **Partial bundle (un-ruled):** pays its share of the offer, rounded to the copper, and still retires the want, on both paths. Two of "1 gp per 3" pay 67 cp; three of "1 gp per 5" pay 6 sp. This keeps the GM path's rule, which matches the buy side since #598. The counter's only change is for a non-dividing partial (66 cp → 67 cp). Pinned by the new D4 test `#577 one payment rule`.
- **Flipped:** `#577 acceptance a bundle that does not divide evenly` (6) and `#591 acceptance a bundle sold in separate loss tags` (31).
- **Clauses:**
  - "the counter prices a wanted line by the stored unit again", mustFail `#577 acceptance a bundle that does not divide evenly`;
  - "each loss tag is priced alone again" (`wi=ws.indexOf(L.w)`→`wi=-1`), mustFail `#591 acceptance a bundle sold in separate loss tags`;
  - "a wanted row's amount is the stored unit times the count again", mustFail `#577 one payment rule`.

### 8: "Warded ring (silver) — taken from the crypt" never met the silver want
- **Mechanism:** `wantedFor` had two ranks. The exact key carries the dash clause. `itemBaseKey` drops the qualifier along with the provenance, because `itemProvenanceFree` strips every parenthesis.
- **Change:**
  - New `itemClauseFree` (inventory.js:32) strips only the ONE trailing provenance clause. That is the spaced-dash tail (the same first spaced dash `itemProvenanceFree` cuts at) or, failing that, a final "(from …)". Every other parenthesis is a qualifier and stays.
  - `wantedFor` (memory.js:827) ranks: 4 the item as written, 3 clause-free, 2 the plain want.
  - ONE-WAY holds: both new readings keep the item's own qualifier.
- **Flipped:** `#577 acceptance a qualified item with a provenance clause`.
- **Clause:** "the clause-free rank is gone" (`wm===cm?3:`→`false?3:`), mustFail `#577 acceptance a qualified item with a provenance clause`.

### 9: "Wolf pelts (prime)" against the want "Wolf pelt (prime)"
- **Mechanism:** `itemKey` drops only a trailing "s", and the qualifier hides it.
- **Change:** `wantedMatchKey` (memory.js:826) applies the pack rule to the stem before the first parenthesis. Both item readings and the want are compared through it. It is the want match only:
  - `itemKey`, row identity and want identity (`wantedKey`, used by the filer's refresh, the allowance and retirement) are untouched. So the key contract is not loosened.
  - dev/sabotage-599b3-one-key.js stays green (12/12) after a re-anchor with the same mutation.
  - Two pack rows "Wolf pelts (prime)" and "Wolf pelt (prime)" stay two rows (I2), as before.
- **Flipped:** `#577 acceptance plural with a qualifier`.
- **Clause:** "the pack rule stops at the qualifier again" (`p=k.indexOf("(")`→`p=-1`), mustFail `#577 acceptance plural with a qualifier`.

## Tests added (D4 section, beside the acceptance section)
- `#577 one payment rule: …` pins the counter's row amount equal to the plan line (1 gp for three of "1 gp per 3"), the partial bundle (67 cp; 6 sp) at the counter and on the GM path, and the ⚠ line for 66 cp against the 67 cp share.
- `#591 a voided loss says why, and its want keeps its place: …` pins:
  - the voided ⚠ line right after the loss;
  - the wants' order after the restore;
  - a cascade: block 1's silver ring is given to nobody, block 2 sells the other silver ring for 40 gp. Block 2 is judged against the standing silver want (kept, ⚠ 40 gp vs 60 gp). Without the resettle, it met the plain want.

## Battery re-anchors (same mutations, the edits moved their anchors)
- dev/sabotage-481-d4-want-met.js, 6 re-anchored:
  - a met want is never retired;
  - discard retires (`if(true)`);
  - any coin (`R.goldIn>0`);
  - another block's payment;
  - the silent keep (now `S.out.push`→`void(`, so it is a silent drop again rather than a throw);
  - ONE-WAY (ranks 4/3/2).
- dev/sabotage-481-d7-sale-floor.js: `sellCp+=sl.cp` → rounded to whole gold.
- dev/sabotage-517-counter-tail.js: `per:Math.max(1,w.per|0),offer:` → `per:1,offer:`.
- dev/sabotage-599b3-one-key.js: the lower-cased compare now lower-cases the two new readings too.
- dev/sabotage-599b5-review.js: the last-wins same-base mutation on the new rank line.
- New clauses in dev/sabotage-481-d4-want-met.js: 11 (7 run `node dev/run-tests.js "acceptance 2026-10-12"` through a new `proveAcc`, 4 run the D4 section). The battery holds 29 clauses (was 18).

## Gates
Sabotage batteries, run serially from the final tree, once on 390cc0bf and again on origin/master 3bbed367 with identical counts. Every one exited 0, every file was restored byte-identical, and none had a MISSED or MISATTRIBUTED clause. On origin/master I also ran dev/sabotage-593-resident-rel.js, the battery for the helpers.js change origin brought in: 9/9.

| Battery | Caught |
|---|---|
| dev/sabotage-481-d4-want-met.js | 29/29 (11 new) |
| dev/sabotage-597-ledger-direct.js | 11/11 |
| dev/sabotage-599b3-one-key.js | 12/12 |
| dev/sabotage-599b5-review.js | 20/20 |
| dev/sabotage-481-d5-coin.js | 16/16 |
| dev/sabotage-598-copper.js | 14/14 |
| dev/sabotage-517-counter-tail.js | 10/10 |
| dev/sabotage-481-d7-sale-floor.js (re-anchored) | 3/3 |
| dev/sabotage-407-shop.js (anchors beside the edits) | 13/13 |
| dev/sabotage-481-a2-item-pairs.js (the gift put-back anchor) | 10/10 |
| dev/sabotage-599c2-review.js (the companion-refusal anchor) | 29/29 |
| dev/sabotage-518-pair-block.js | 10/10 |
| dev/sabotage-481-d3-quantities.js | 5/5 |

- `node dev/run-tests.js` (full): **exit 0, "ALL GREEN — 3017 assertions passed (engine tests)"** on origin/master + fix. On 390cc0bf + fix it was "ALL GREEN — 2996" (2994 + the 2 new D4 tests). Every source contract and the standalone verifier gate passed.
- `node dev/run-tests.js "acceptance 2026-10-12"`: FILTERED GREEN, 53 assertions. On origin/master the filter also matches #593's acceptance section (21); ours is 32/32. `"#481 D4"`: FILTERED GREEN, 13 assertions.
- `node dev/check-es5.js`: OK, 52 files; `node dev/check-es5.js dev/engine-tests.js`: OK.
- `node dev/check-sabotage-applicability.js`: ALL GREEN, 3136/3136 clauses across 334 batteries on origin/master (3130/333 on 390cc0bf, where the count was 3119 before; +11).
- CI-only replays: `node dev/diff-replay.js dev/corpus_playtest_v{1238,1258,1271,1276}.json --check`. All four, on both bases: "end state matches committed baseline", 0 handler errors.
- **Behaviour check against HEAD** (`scratchpad\probe577\cap-check.cjs`; output identical on both bases):

  | Case | HEAD vs fix |
  |---|---|
  | A met sale plus a new `[WANTED:]` at cap 4 | identical; no innocent eviction |
  | A met sale plus a same-reply re-statement | identical |
  | The voided gift | the only difference: want kept with the ⚠ voided line |

## audits/verification-577-2026-10-08/probe.cjs, run from a scratch copy
- **Before** (HEAD 390cc0bf exported to `scratchpad\probe577\head`): 22 pass / 2 fail.
- **After** (this tree, on both bases): 22 pass / 2 fail, the same two.
- Both failures are the known stale expectations:
  - `only selected variant leaves` compares the pack as legacy strings (rows since #599 (c));
  - `same paid offer cannot pay twice false`: the second silver ring meets the plain want and pays 40 gp, which is ruled behaviour.
- The probe exercises none of the seven mechanisms, so it is unchanged.

## Left red
Nothing.

## Residuals (by design, said so they are not found later)
- **A void plus a same-reply `[WANTED:]` on the same node:**
  - If a re-statement re-filed the voided want's key, the restore is skipped and the re-statement stands.
  - If a new want filled the slot the provisional retirement freed, the restore can leave the node one over `WANTED_CAP`. The next filing trims it, loudly. This needs a gift-to-nobody or refused placement, plus a new want, in one reply.
- **A gift to a real companion with exact coin beside it still retires the want.** That meets the literal #591 rule and is un-ruled (acceptance observation). The void rule covers only units that went back in the pack.
- **A failed put-back still counts as a void.** If the pack refuses the unit back, it is still recorded as a void (intent: the loss was cancelled). The failure keeps its own loud line.

## Contract sentences to change (suggested wording)

**DOC/contracts/tags.md, WANTED row.** Replace "on the GM's path `wantedSaleSettle` (tag_table.js) retires a want only when the coin a `[GOLD:]` paid in the loss's OWN tag block (`R.goldInAt`) equals the offers of the wanted losses in that block, with the receipt "Want met: X (keeper)"; any other loss keeps the want, and if coin came in a ⚠ line says why (the amount, another block, an offer in words)." with:

> on the GM's path `wantedSaleSettle` (tag_table.js) retires a want only when the coin a `[GOLD:]` paid in the loss's OWN tag block (`R.goldInAt`) equals the price of the units that LEFT the pack — each want priced once per block by `wantedPayCp` — with the receipt "Want met: X (keeper)". A loss is the SHEET's item (`removeInventoryItem.last`), and the blocks settle in TEXT order, so a later block meets only the wants the earlier blocks left standing. A unit a later handler puts back (a gift to nobody, a gift or placement the receiver refused, a placement carrying fields the chest cannot hold) voids its loss: `wantedLossVoid` records it, and `wantedSaleLand` at applyMutsTable's post-handler seam undoes the settle that saw it (`restoreWantedRow`) and settles again from the same snapshot (acceptance 2026-10-12). Any other loss keeps the want, and if coin came in a ⚠ line says why (the amount, another block, an offer in words, a voided loss).

And replace "`wantedFor` (memory.js) is the ONE matcher pricing and retirement share: exact key, then the plain want — ONE-WAY …" with:

> `wantedFor` (memory.js) is the ONE matcher pricing and retirement share: the item as written, then the item without its trailing provenance clause (`itemClauseFree`: a spaced-dash tail or a final "(from …)"), then the plain want — each compared through `wantedMatchKey` (the pack rule applied to the stem before a qualifier, so "Wolf pelts (prime)" meets "Wolf pelt (prime)"); ONE-WAY (owner ruling 2026-10-11, v1.1225): a plain item never meets a want with its own qualifier.

**DOC/contracts/items.md, #481 D4.** Replace "for ONE unit (the row's max is 1)" with "for one unit or one bundle ("1 gp per 5" buys five, #517 (c))". Add after the offer sentence:

> ONE payment rule prices a want everywhere — `wantedPayCp`: the offer's bundle copper × units ÷ bundle, rounded once — the counter's sale line and row amount and the GM's settle alike, so a whole bundle pays the offer exactly and a partial bundle its share rounded to the copper (two of "1 gp per 3" pay 67 cp) and retires the want (acceptance 2026-10-12).

Update the proof count to "dev/sabotage-481-d4-want-met.js (29 clauses since the acceptance of 2026-10-12; 7 of them run the acceptance section)".
