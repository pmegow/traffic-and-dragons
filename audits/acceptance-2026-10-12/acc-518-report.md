# Acceptance 2026-10-12 — TODO #518 (item moves with a count, gifts at home, per-block pair notes)

Target: worktree `agent-afc9447d84e61efa9` at `5e36f598` (APP_VERSION v1.1226, the commit after the 2026-10-11 ruling build). Engine code unchanged. All probes are engine tests in `dev/engine-tests.js`, section `acceptance 2026-10-12 — #518 item pairs` (placed right before `#518 block`), driven through the real `applyMuts`. Patch: `acc-518.patch` in this folder.

**Result: 13 PASS, 6 FAIL that count against #518 or its class, 1 known #613 (red, not counted).** The give pair — the core of #518 — passed everything, including a 300-reply randomized sweep. The failures are the stow twins of the gift rules (⑮ ⑯, and the sweep ⑳ that shows only that shape), the take mirror of the gift-at-home rule (⑰), a short take of a row with fields (⑭), and the `-es` plural (⑫, which is the item-key rule rather than the pair notes).

## Verdict table

| # | Case | Verdict | One line |
|---|---|---|---|
| ① | Thursday gift cut to what the pack held (held 0–4, x3, both orders) | PASS | Bram gets min(held,3), units conserve, empty/short gift said |
| ② | Thursday reverse take bounded by what Bram held (Bram 0–4, hero 0/2, both orders) | PASS | hero gains min(Bram's,3), never from nowhere, empty/short take said |
| ③ | Thursday gift at home, pack AND chest (both orders; counted x2 with pack 1, chest 2) | PASS | one from the pack, chest keeps its potion, no stash take claimed |
| ④ | Thursday loot/throw collision across prose (both orders, x2 loot, Bram holding one) | PASS | the loot stays; with Bram holding one, two separate events |
| ⑤ | 2026-10-10 case 1: counted gift x3 to a missing recipient | PASS | all three back, receipt says x3 |
| ⑥ | 2026-10-10 case 2: two same-block gift pairs, one torch held | PASS | Bram 1, hero 0, second refusal said |
| ⑦ | 2026-10-11 ruling: gift to NOBODY voids its block's loss (x1/x2/x3/x5; short loss; split loss; after a gift; after a stow; written first) | PASS | every standing unit returns, said as xN |
| ⑧ | Counts N∈{1,2,3,5,12} from H∈{1,2,3}, give and take | PASS | min(N,H) moves, the rest stays put |
| ⑨ | Gifts to two companions from one loss (4 shapes) | PASS | never more than the loss took; cuts and refusals said |
| ⑩ | A gift and a stow from one loss (village and adventure; 2 and 1 lost) | PASS | the unit reaches exactly one partner; the other's refusal said |
| ⑪ | Casing (`torch`/`TORCH`) and plural `s` (`Arrows`/`arrow`), give, void and take | PASS | one item, cut and void work across spellings |
| ⑫ | Plural written `-es` (`Torches` against `Torch`) | **FAIL** | the halves never pair: gift mints 1, void destroys 3, take mints 2 |
| ⑬ | Fragments ride the GIVE (I5): fresh row, onto a plain row, to nobody, stow | PASS | fields travel or every unit returns with them |
| ⑭ | Fragments ride the TAKE (I5): fresh row, onto a plain stack, SHORT take of a blessed row | **FAIL** | short take restores Bram but leaves the hero 2 (or 1) plain torches from nowhere, receipt "Nothing moved" |
| ⑮ | Stow pairs a loss unit ONCE: one loss, two placements (village) | **FAIL** | floor gets 2 from 1 lost; no refusal (the gift twin passes) |
| ⑯ | Counted stow cut to what its loss took (village) | **FAIL** | x3 placed from 1 lost → floor 3; loss 2 + stows 1,2 → floor 3 |
| ⑰ | A TAKE beside the same item on the floor/chest (village chest, adventure floor) | **FAIL** | the chest/floor unit is auto-taken too: 2 in, 1 out |
| — | KNOWN #613: two take pairs in one block, Bram holds one | FAIL (known #613, not counted) | still exactly as filed: hero 0, Bram 0 |
| ⑲ | Randomized sweep, gifts only (adventure), seed 20261012, 300 replies | PASS | 300/300 keep H0 − C ≤ T ≤ H0 |
| ⑳ | Randomized sweep, gifts AND stows (village chest), seed 20261012, 300 replies | **FAIL** | 93/300 break; all 93 hold a placement overdraw (the ⑮/⑯ shape), 0 do not |

Filtered run: `node dev/run-tests.js "acceptance 2026-10-12"` → `ENGINE TESTS FAILED (7 of 20)` (the 6 above plus the known #613 probe).

## Failing probes

### ⑫ A plural written `-es` does not pair (item-key rule)

- Inputs and observed (units counted over both spellings):
  - Hero `Torch x1`. `[ITEM_LOST:Torch x2][COMPANION_ITEM_GAINED:Bram|Torches x2]` → hero 0, Bram `Torches x2`. 1 in, 2 out. Receipts `["-Torch","Bram: +Torches x2"]` (no cut said).
  - Hero `Torch x3`. `[ITEM_LOST:Torch x3][COMPANION_ITEM_GAINED:Absent|Torches x3]` → hero 0. 3 in, 0 out. Receipts `["-Torch x3"]` only — nothing says the gift went nowhere.
  - Bram `Torch x1`. `[COMPANION_ITEM_LOST:Bram|Torch x3][ITEM_GAINED:Torches x3]` → hero `Torches x3`, Bram 0. 1 in, 3 out. Receipts `["+Torches x3","Bram: -Torch"]`.
- Expected: Bram 1 / hero 3 / hero 1.
- Mechanism: `itemKey` (inventory.js:23) lowercases and strips ONE trailing `s`, so `Torches` keys as `torche` and `Torch` as `torch`. `itemPairKey`/`_itemPairK` (inventory.js:357, :363) inherit it. The gift finds no loss note in its block (`itemPairCount(R,"ilHits",…)` is null, tag_table.js:1690) and lands as an unpaired, found item at full count. The missing-recipient put-back (`itemPairTake(R,"ilHits",…)`, tag_table.js:1686) finds nothing. The take's shortfall take-back (`itemPairTake(R,"igHits",…)`, tag_table.js:1707) finds no `torch` gain note.
- Scope note: this is the shared item key (#599 §2.2), not the per-block pair logic. The pair notes behave correctly for every pair of spellings `itemKey` treats as one item (⑪). Also, with only `Torch` held, `[ITEM_LOST:Torches x2]` misses outright ("Nothing given — not on the hero's sheet"). That conserves, but no move happens.

### ⑭ A short take of a row with fields mints plain units (I5 restore skips the shortfall)

- Inputs: hero empty. Bram holds `{name:"Torch",qty:1,blessed:"by Pelor"}` (then qty 2). `[COMPANION_ITEM_LOST:Bram|Torch x3][ITEM_GAINED:Torch x3]`.
- Observed: Bram 1 blessed → hero `[{"name":"Torch","qty":2,"equipped":false}]`, Bram keeps his blessed torch. 1 in, 3 out. With Bram 2 blessed → hero plain `Torch x1`, Bram keeps 2. 2 in, 3 out. Receipts: `["+Torch x3","⚠ Nothing moved — 'Torch x3' carries fields Tess's pack cannot take ('Torch' is a stack of 3 without those fields)"]`. The receipt says nothing moved, yet the hero keeps plain torches.
- Expected: either the held units move with the field and the shortfall is taken back (hero 1 or 2 blessed), or the whole move is restored (hero 0). Never a plain torch from nowhere.
- Mechanism: ITEM_GAINED runs first (tag_table.js:533–534) and lands 3 plain units on a fresh row, noting 3 `igHits`. COMPANION_ITEM_LOST (tag_table.js:1702) removes the 1 (or 2) blessed units Bram holds. `invCarryFields` then refuses, because the hero's row is a stack of 3 without the field (inventory.js:148–154, `row.qty!==units`). The I5 restore branch (`if(!_tlC.ok)`, tag_table.js:1702) takes back only `Math.min(_tlG,cIlHit)` gain units, returns Bram's fragments, and `continue`s. That skips the #518 ② shortfall take-back (tag_table.js:1707), which would remove the other `cIlq.n − cIlHit` gain units. The unblessed full-count case (②) and the full blessed take pass. Only short + fields fails.

### ⑮ One loss, two placements in one block: the stow does not pair a unit once

- Inputs: village, hero at home, `Torch x1`. `[ITEM_LOST:Torch][LOCATION_ITEM:Torch|placed][LOCATION_ITEM:Torch|placed]`.
- Observed: pack 0, chest row `{"name":"Torch","qty":2,…}`. 1 in, 2 out. Receipts `["-Torch","Left: Torch","Left: Torch ×2"]`, no refusal. The gift twin in the same test (`[ITEM_LOST:Torch][COMPANION_ITEM_GAINED:Bram|Torch]` followed by a second Bram gift) passes: one given, "⚠ Nothing given".
- Expected: chest 1, and "⚠ Nothing placed — 'Torch'…" for the second placement.
- Mechanism: LOCATION_ITEM refuses a placement only through `itemPairMissed(R,_lnm,_liB)` (tag_table.js:640). That predicate (inventory.js:410) is true only when the block's loss MISSED (`ilMiss`) and no hit stands. One loss that hit sets no `ilMiss`. So after the first placement consumes the only `ilHits` note (tag_table.js:651), the second placement is not refused, and `fileLocationItem` (tag_table.js:642 → memory.js:909, the stash-quantity branch) adds the tag's count again. The gift handler has the twin refusal (`_gHits===0`, tag_table.js:1694). The stow has none. The built status says "the stow shares the rule", but the `#518 block` stow test covers only the two-LOSS shape, where the second loss misses and sets `ilMiss`.

### ⑯ A counted stow is not cut to what its loss took

- Inputs and observed (village chest):
  - `Torch x1`. `[ITEM_LOST:Torch x3][LOCATION_ITEM:Torch x3|placed]` → pack 0, chest qty 3. 1 in, 3 out. Receipts `["-Torch","Left: Torch x3 ×3"]`.
  - `Torch x2`. `[ITEM_LOST:Torch x2][LOCATION_ITEM:Torch|placed][LOCATION_ITEM:Torch x2|placed]` → chest qty 3. 2 in, 3 out.
- Expected: chest 1 / chest 2, with the cut said (the gift's "⚠ Gift of … cut to …" twin).
- Mechanism: same handler. The placement files `_qtyParse(_lnm).n` units (memory.js `_sq`, then :909–911) and never reads the standing `ilHits` count. The gift's cut (`_gHits<cIq.n`, tag_table.js:1695) has no stow equivalent. This is the original Thursday gift-cut case on the stow partner. Adventure: the toggle row is named literally `Torch x3` after one torch left (rows carry no qty by design). Listed as an observation, not a test.

### ⑰ A take beside the same item on the floor or in the chest destroys that unit (mirror of the gift at home)

- Inputs and observed:
  - Village, hero at home, chest `Healing potion` qty 1, Bram `Healing potion x1`, hero none. `[COMPANION_ITEM_LOST:Bram|Healing potion][ITEM_GAINED:Healing potion]` → hero 1, Bram 0, chest `{"qty":0,"taken":true}`. 2 in, 1 out. Receipts `["+Healing potion","From the stash: Healing potion","Bram: -Healing potion"]`. Same result in the reverse tag order, and with x2 (chest 2, Bram 2 → hero 2, chest 0).
  - Adventure, a `Torch` toggle row lying here, Bram `Torch x1`. `[COMPANION_ITEM_LOST:Bram|Torch][ITEM_GAINED:Torch]` → hero 1, Bram 0, floor row `taken:true`. 2 in, 1 out. Receipts `["+Torch","Bram: -Torch"]`: the floor take is silent.
- Expected: the chest or floor keeps its unit. The hero's gain came from Bram.
- Mechanism: ITEM_GAINED calls `autoTakeLocationItem(igq.base,null,_igL,…)` for every gain, unconditionally (tag_table.js:534). The table runs ITEM_GAINED (entry at :533) before COMPANION_ITEM_LOST (:1702), so the gain cannot see that a take pair covers it. The 2026-10-03 fix guards only the gift direction (`var _cAt=(_gHits!==null)?null:autoTakeLocationItem(…)`, tag_table.js:1700). The #518 row's remedy names this case: "skip the chest auto-take for units a same-reply pair already covers."

### KNOWN #613 (not counted against #518)

- Bram `Torch x1`, hero none. `[COMPANION_ITEM_LOST:Bram|Torch][ITEM_GAINED:Torch]` written twice in one block → hero 0, Bram 0. Receipts `["+Torch","+Torch","Bram: -Torch","⚠ Nothing moved — 'Torch' is not on Bram's sheet"]`. **Still exactly as filed.**
- The same mechanism (a successful take never consumes `igHits`) also hits a two-companion variant: `[COMPANION_ITEM_LOST:Bram|Torch][COMPANION_ITEM_LOST:Cara|Torch][ITEM_GAINED:Torch x2]` with Bram 1, Cara 0 ends hero 0, Bram 0, Cara 0. This was probed by hand, not added as a test. It belongs with #613.
- The probe asserts the conserving outcome, so it turns green by itself when #613 lands. Its message says whether the shape is still as filed.

### ⑳ Randomized sweep with stows

- 93 of 300 replies break conservation. All 93 contain a block whose placements name more units than its loss took (the ⑮/⑯ shape). **0 failures without that shape.**
- First failing, #2: start hero 3, Cara 1. Text `[ITEM_LOST:Torch x2][COMPANION_ITEM_GAINED:Absent|TORCH][LOCATION_ITEM:torch|placed]` / prose / `[ITEM_LOST:TORCH x3][LOCATION_ITEM:Torch x2|placed]`. End hero 1, Cara 1, floor 3 = 5. Bounds H0 = 4, C = 0. Receipts `["-Torch x2","-TORCH","Left: torch","Left: Torch x2 ×3","⚠ 'Torch' stays in the pack — no party member 'Absent' to give it to"]`. Block 2's loss took 1 (the pack held 1 after block 1), and its x2 placement filed 2.

## The sweep (⑲, ⑳)

- Generator: Park–Miller PRNG (reproducible in node and the browser). **Seed 20261012, 300 replies per sweep.**
- Each reply has 1–2 tag blocks separated by prose. Each block holds 1–2 `[ITEM_LOST:]` tags and 1–3 partners: a gift to Bram, to Cara, to the absent `Absent`, and in ⑳ a `[LOCATION_ITEM:…|placed]`. Counts are 1–3, casing varies (`Torch`/`torch`/`TORCH`), and tags are shuffled inside each block.
- Starting units: the hero holds 1–3. Bram and Cara each hold 1 with p = 0.25. In ⑳ the chest holds 1 with p = 0.25.
- No take pair is generated, so the #613 shape is excluded by construction.
- **Invariant (stated in the test):** H0 = every unit of the item before the reply (pack + Bram + Cara + floor). The table runs every ITEM_LOST before any partner, in text order across the reply, so block b's loss took R_b = Σ min(asked, what the pack still held). D_b = the units block b's partners name (gifts to Bram or Cara, placements). Units leave the world only as a loss's unpaired remainder max(0, R_b − D_b). A block holding a gift to NOBODY spends none of its loss (the 2026-10-11 ruling). With C = Σ of that remainder over the other blocks, the units T after the reply must satisfy **H0 − C ≤ T ≤ H0**. The upper bound means no unit is minted: every partner shares a block with a loss of the item, so none is an outside source. The lower bound means no unit is destroyed.
- Shape census of the seed:
  - ⑲: 158 two-block replies, 233 void blocks, 176 cut blocks, 137 all-missed-loss blocks, 99 miss-beside-hit blocks, 17 blocks with an unpaired remainder, 185 multi-gift blocks. Held 1/2/3 = 108/98/94.
  - ⑳: 155 two-block replies, 288 blocks with a placement, 163 void blocks, 213 cut blocks.
- **⑲ gifts only (adventure): 300/300 conserve.**
- **⑳ gifts and stows (village chest): 93/300 fail, all with the placement overdraw.**

## The green probes can fail (scratch battery, not in the patch)

`scratchpad/sabotage-acc518.js` re-introduces each historical #518 / #481 A2 regression in a disposable clone through `dev/sabotage.js`. Each clause has a `mustFail` naming the green acceptance probe that has to go red. Result: **exit 0, 19/19 caught with attribution, every file restored byte-identical** (`acc518-bat-scratch.log`).

- tag_table.js, 15 clauses:
  - the missing-recipient loop cut to one unit → ⑤, ⑦, ⑲
  - the gift no longer consumes its loss unit → ⑥, ⑨, ⑲
  - the gift cut removed → ①, ⑧, ⑲
  - the take shortfall removed → ②
  - the empty take takes back one unit, not all → ②
  - the chest auto-take restored on the gift at home → ③
  - the silent all-paired gift → ⑨
  - the gift drops its fragment → ⑬
  - the stow no longer consumes its loss units → ⑩
- inventory.js, 3 clauses:
  - `itemPairMissed` reverted → ⑥, ⑲
  - the pair key drops the block → ④
- helpers.js, 1 clause:
  - prose no longer splits blocks → ④

The gift-only sweep (⑲) catches all four conservation regressions it was aimed at.

## Observations (not counted as failures)

- **A lone comma splits a pair.** The block rule treats any non-whitespace character as prose (helpers.js `tagBlockSpans`, `!/\S/`). Two cases:
  - `[ITEM_LOST:Torch x3], [COMPANION_ITEM_GAINED:Bram|Torch x3]` with one held gives Bram 3 (1 in, 3 out).
  - `[ITEM_LOST:Torch x3], [COMPANION_ITEM_GAINED:Absent|Torch x3]` destroys all three, and nothing in the mutation log says so.

  By the letter of the 2026-10-10 ruling this is designed. It is flagged because a comma is not narrative prose.
- **A gift to a missing recipient with no loss in its block is console-only.** It writes only a `console.warn` (tag_table.js:1686), with no mutation-log line.
- **Receipt wording.**
  - After a void, a later gift says "every unit this block's [ITEM_LOST:] took is already given or placed", though the units went back to the pack.
  - Village stows print `Left: Torch x3 ×3`: the name keeps the count and the qty is appended.
  - The stow-with-fields refusal prints `'Torch x2' x2 stays in the pack`.
- **Provenance is dropped on a gift.** Giving `Signet ring` from the sheet row `Signet ring (from Hemlock)` lands on Bram as `Signet ring`, because the gift adds the tag's name, not the sheet row's. The count is conserved.
- **A plain unit gains fields on a gift.** A plain unit given beside a fielded unit of the same base stacks into the fielded row on Bram, so the field is smeared onto the plain unit (invAdd's plain-add rule). Units are conserved.
- **Handler order, not text order, decides a short loss's partner.** The stow wins over a gift written before it (⑩), because LOCATION_ITEM runs before COMPANION_ITEM_GAINED.
- **A take from a non-member keeps the hero's gain.** By design, an NPC handing over an item is a legitimate gain. This is the asymmetric twin of the gift void.

## Gates

| Command | Result |
|---|---|
| `node dev/run-tests.js "acceptance 2026-10-12"` | exit 1 — `ENGINE TESTS FAILED (7 of 20)`: ⑫ ⑭ ⑮ ⑯ ⑰ ⑳ + KNOWN #613 |
| `node dev/check-es5.js` | exit 0 — `ES5 check OK — 52 file(s)`; `node dev/check-es5.js dev/engine-tests.js` exit 0 |
| `node dev/run-tests.js` (full) | exit 1 — `ENGINE TESTS FAILED (7 of 2982)`; the 7 are exactly the new red probes; all 2975 other assertions pass. Because the engine suite was red, the runner skipped its standalone layer, so it was run on its own: `node dev/run-standalone-suites.js` → exit 0, `ALL GREEN — 113 standalone verifier suites` |
| `node dev/check-sabotage-applicability.js` | exit 0 — `ALL GREEN — 3119/3119 retained sabotage clauses applicable across 333 batteries` |
| `node dev/sabotage-518-pair-block.js` | exit 0 — 10/10 clauses caught (helpers 1, inventory 3, tag_table 6), files restored byte-identical |
| `node dev/sabotage-481-a2-item-pairs.js` | exit 0 — 10/10 clauses caught (inventory 1, tag_table 9), files restored byte-identical |

Not run: live model turns, browser checks, the sabotage-diff over a range. The patch touches only `dev/engine-tests.js`. No version bump, no TODO edit, no commit.
