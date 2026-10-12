# Acceptance 2026-10-12: #577 and #591 (a keeper's want is retired by the right event)

Base: HEAD 5e36f598 (APP_VERSION v1.1226), worktree `agent-a121d62b9e206b896`. No engine file changed. The patch adds one section to `dev/engine-tests.js`: `acceptance 2026-10-12 — #577 #591 wants`, at line 28023, right before `#518 block`. It holds 32 tests.

**Result: 25 PASS, 7 FAIL. On this evidence neither row is ready to close.** Two of the failures (rows 30 and 29 below) are realistic GM tag patterns that break #591's rule directly. The other five are edge cases or rounding.

## Verdict table

| # | Case (test name prefix) | Verdict | One line |
|---|---|---|---|
| 1 | #577 both filing orders through the counter | PASS | Each offer keeps its own allowance (40+60). The paid offer retires and the other survives. Plain filed first: the second silver ring pays the plain 40 gp and retires the plain want. Silver filed first: the second plain ring is unwanted and refused, and the silver want waits. |
| 2 | #577 three wants of one base (plain 40, silver 60, cracked 25) | PASS | Each ring sold alone pays its own offer and retires only its own want. All three in one trade pay 125 gp and retire all three. |
| 3 | #577 ONE-WAY: plain ring with only qualified wants on file | PASS | Unwanted. Sells at half its 200 gp canon (100 gp). Both qualified wants survive. |
| 4 | #577 pack rule: "Wolf pelts" vs want "Wolf pelt", and the reverse | PASS | Matches at the counter and on the GM path. |
| 5 | #577 bundle want "1 gp per 5", filed by `[WANTED:]` | PASS | Stored as cp 20, per 5. The counter max is 5, and 6 is refused with the reason. Five pay 1 gp and retire the want. The sixth arrow is unwanted. The GM's `[GOLD:+1 gp][ITEM_LOST:Arrow x5]` also meets it. |
| 6 | #577 bundle that does not divide evenly: "1 gp per 3" | **FAIL** | The counter pays 9 sp 9 cp for the three, not the stated 1 gp. The GM path (counted tag) uses 1 gp. |
| 7 | #577 offer in words at the counter | PASS | The row is off with the reason "Wanted, but the offer is in words (“…”) — ask Frizwick". Nothing sells and the want stays. |
| 8 | #577 qualified item with a provenance clause: "Warded ring (silver) — taken from the crypt" | **FAIL** | Never meets its own (silver) want. At the counter it is unwanted and unpriced. On the GM path a 60 gp sale keeps the want with no line. |
| 9 | #577 plural with a qualifier: "Wolf pelts (prime)" vs want "Wolf pelt (prime)" | **FAIL** | No match at the counter or on the GM path. |
| 10 | #577 counter receipt order | PASS | `-Warded ring`, `Want met: Warded ring (Frizwick)`, `-Warded ring (silver)`, `Want met: Warded ring (silver) (Frizwick)`, `+100 gp`. |
| 11 | #577 the place decides | PASS | A sale in another shop (Daeris's smithy) meets nothing and says nothing. Pay in the trading post, then `[SUBLOCATION:the smithy]` in the same reply: the want is met. |
| 12 | #577 7-day expiry | PASS | At 7 days minus 1 minute: live, served to the GM, paid at the counter. At 7 days: not served, no counter offer, and the GM's exact payment meets nothing and prints nothing. |
| 13 | #577 save round trip (memory JSON, then `healMemory`, which is the `loadState` path) | PASS | Wants come back byte-identical: bundle cp 20/per 5, plain cp 4000/per 1, words cp null/per 1. The counter prices them and retires them the same after the reload. |
| 14 | #577 counter sale, then the GM's sale of the same item (and the reverse) | PASS | No second `Want met`. The plain want is not retired in the silver want's place; a ⚠ line says 60 gp ≠ 40 gp. With the GM's sale first, the counter pays no premium. |
| 15 | #577 probe.cjs port: three decorated rings, one want | PASS | All three rows carry one key. Marking all three, or 2 units from one stack, is refused with the named reason, and world plus memory stay byte-identical. |
| 16 | #577 probe.cjs port: each decorated ring alone; next ring unpriced; half canon | PASS | Each pays 40 gp once and leaves only itself (pack read through `invTextList`). The next ring is refused with nothing changed. With 200 gp canon the next unit pays 100 gp. |
| 17 | #577 probe.cjs port: stale ledger plan | PASS | Item gone before landing: refused, state byte-identical, want standing. |
| 18 | #591 exact offer in the loss's own block (coin before or after the item tag) | PASS | Retires. `Want met` sits right after `-Warded ring`, with no ⚠ line. |
| 19 | #591 exact offer + 1 cp in the same block (`[GOLD:+40 gp][GOLD:+1 cp]`) | PASS | Kept. One line, right after the loss: "⚠ Want kept — Warded ring (Frizwick): 40 gp 1 cp came in beside it, the offer is 40 gp — not read as its sale". |
| 20 | #591 exact offer in ANOTHER block (coin block before or after the item block) | PASS | Kept, with "…no coin was paid in the same tag block as the item…". |
| 21 | #591 haggled price (35 gp for 40 gp) | PASS | Kept, with the line naming 35 gp and 40 gp. |
| 22 | #591 two wanted losses, one coin tag equal to the sum (43 gp) | PASS | Both retire, each receipt after its own loss. |
| 23 | #591 one wanted + one unwanted loss, one combined coin (45 gp) | PASS | Kept, with the line naming 45 gp and 40 gp. |
| 24 | #591 loss with no coin; loss beside coin paid OUT (`[GOLD:-5 gp]`) | PASS | Nothing extra: of the lines naming the ring or a want, only `-Warded ring`. The want stands. |
| 25 | #591 offer in words, GM sale | PASS | Kept, with the line quoting the words. |
| 26 | #591 receipt order across two blocks | PASS | `-Warded ring`, `Want met: …`, `-Bone-handled knife`, then the knife's ⚠ line (2 gp vs 3 gp). |
| 27 | #591 adventure kind (want on the world node) | PASS | 1 cp of change beside the loss: kept with ⚠. Exact 40 gp: met. |
| 28 | #591 two sales in two blocks of ONE reply (silver at 60 gp, then silver at 40 gp) | **FAIL** | The second sale should meet the plain want, as it does across two replies. Instead the plain want stays, and nothing is said. |
| 29 | #591 GM names the base while the pack holds only the silver ring (`[GOLD:+60 gp][ITEM_LOST:Warded ring]`) | **FAIL** | The silver ring leaves at exactly its 60 gp offer, but the silver want stays. No `Want met` and no ⚠ line. |
| 30 | #591 voided loss: gift to nobody (`[COMPANION_ITEM_GAINED:Frizwick|Warded ring]`) or a refused placement | **FAIL** | The ring is put back in the pack, yet the want retires with `Want met`. |
| 31 | #591 bundle split over separate loss tags in one block | **FAIL** | The per-5 control (x2 + x3 for 1 gp) passes. Per 3 (three `[ITEM_LOST:Arrow]` for 1 gp) is kept, with "the offers come to 9 sp 9 cp". |
| 32 | #591 probe.cjs port: no-coin discard; 1 cp of change beside a discard | PASS | The want stays in both. |

## Failing probes

### 6 — "1 gp per 3": the counter pays 99 cp (#577 "the counter pays the keeper's stated offer"; also #517 (c))
- **Input:** want `Arrow | 1 gp per 3` (via `fileWanted`), pack `Arrow x7`, mark 3 arrows at the counter.
- **Observed:** plan `sellCp` 99. Paid 9 sp 9 cp. Receipts `["-Arrow x3","Want met: Arrow (Frizwick)","+9 sp 9 cp"]`. Control: the GM's `[GOLD:+1 gp][ITEM_LOST:Arrow x3]` retires the want (due 100).
- **Expected:** 1 gp (100 cp) for the bundle of three, the offer as stated. The ledger hint itself reads "the keeper's offer (1 gp per 3)".
- **Mechanism:** `fileWanted` stores the per-unit copper already rounded: memory.js:843 `cp:_oc.unitCp`, from helpers.js:2207 `unitCp:Math.round(cp/per)`, so 100/3 is stored as 33. The catalog sells at that figure (helpers.js:3437 `r.sellCp=w.cp`). The sale line multiplies it (helpers.js:3449 `cp:r.sellCp*q` = 99). The GM path computes from the offer words instead (memory.js:825 `Math.round(oc.cp*n/per)` = 100). The buy side of the counter computes a bundle share from the bundle price (helpers.js:3450). The sell side has no equivalent.

### 8 — a qualified item with a provenance clause never meets its own want (#577 ONE-WAY: "a qualified item meets its own want")
- **Input:** want `Warded ring (silver)` at 60 gp, pack `Warded ring (silver) — taken from the crypt`.
- **Observed:** counter row `{"wanted":false,"want":null,"sellCp":null}`, and `wantedFor` returns null. GM `[GOLD:+60 gp][ITEM_LOST:Warded ring (silver) — taken from the crypt]` gives receipts `["+60 gp","-Warded ring (silver) — taken from the crypt"]`. The want stays, with no line.
- **Expected:** the silver crypt ring meets the (silver) want at 60 gp, on both paths.
- **Mechanism:** memory.js:818 `wantedFor` has exactly two ranks:
  - the exact `itemKey`: `"warded ring (silver)-taken from the crypt"`;
  - the fully provenance-free `itemBaseKey`: `"warded ring"`.
  
  inventory.js:25 `itemProvenanceFree` cuts the spaced-dash clause and also every parenthesis, so the qualifier "(silver)" is removed together with the provenance. Nothing compares the item's qualified name with its provenance cut. Reached at helpers.js:3433 (counter) and tag_table.js:1814 (GM path). Reading the code (not run): with the plain want also on file, the crypt ring would meet the plain want at rank 2 and be paid the plain offer.

### 9 — plural with a qualifier (#577 pack rule; edge)
- **Input:** want `Wolf pelt (prime)` at 5 gp, pack `Wolf pelts (prime)`.
- **Observed:** counter row unwanted and unpriced. GM `[GOLD:+5 gp][ITEM_LOST:Wolf pelts (prime)]` gives receipts `["+5 gp","-Wolf pelts (prime)"]`. The want stays.
- **Expected:** a match, as "Wolf pelts" matches "Wolf pelt".
- **Mechanism:** inventory.js:23 `itemKey` drops only a TRAILING "s". `"wolf pelts (prime)"` ≠ `"wolf pelt (prime)"` at rank 3. At rank 2, the base `"wolf pelt"` ≠ the want's full key `"wolf pelt (prime)"`. The same key would also keep the two spellings as two counter rows, so this is the pack rule's scope, not the want code alone.

### 28 — two sales in two blocks of one reply (#591 with ONE-WAY; edge, silent)
- **Input:** wants plain 40 gp and silver 60 gp, pack `Warded ring (silver) x2`. One reply: `[GOLD:+60 gp][ITEM_LOST:Warded ring (silver)]`, then prose, then `[GOLD:+40 gp][ITEM_LOST:Warded ring (silver)]`.
- **Observed:** receipts `["+60 gp","+40 gp","-Warded ring (silver)","Want met: Warded ring (silver) (Frizwick)","-Warded ring (silver)"]`. The plain want stays and the second sale gets no line.
- **Control (passes):** the same two sales in two replies retire both wants. The second silver ring meets the plain want at 40 gp.
- **Expected:** the same result as the two-reply control.
- **Mechanism:**
  - tag_table.js:1814 matches every loss of the reply to a want (`L.w`) in one pass, before any retirement. So block 2's silver ring is matched to the silver want that block 1 retires.
  - tag_table.js:1815 sets block 2's due to the silver offer (60 gp), which is not the 40 gp paid.
  - tag_table.js:1818: no retirement.
  - tag_table.js:1819 skips the keep line because `L.w` is no longer live. The outcome is silent.

### 29 — the GM names the base while the pack holds the qualified item (#591; realistic, silent)
- **Input:** want `Warded ring (silver)` at 60 gp, pack `Warded ring (silver)` (one ring). GM `[GOLD:+60 gp][ITEM_LOST:Warded ring]`.
- **Observed:** the silver ring leaves (pack empty) and +60 gp lands. Receipts `["+60 gp","-Warded ring"]`. The silver want stays, with no `Want met` and no ⚠ line.
- **Expected:** the item that left is the silver ring, paid exactly its offer, so the silver want retires. At the very least the keep should not be silent, given #591's "no silent outcome".
- **Mechanism:** tag_table.js:550 records the loss under the TAG's words (`_wLoss.push({…name:ilq.base…})` = "Warded ring"). `removeInventoryItem` actually took the sheet's "Warded ring (silver)", and that exact name is on hand as `removeInventoryItem.last`, which `itemPairNote` records on the same line. tag_table.js:1814 then runs `wantedFor(live,"Warded ring")`, which finds no plain want (ONE-WAY). So `L.w` is null and the loss never reaches a verdict.

### 30 — a voided loss retires the want (#591's core rule; realistic)
- **Input A:** want `Warded ring` at 40 gp, pack `Warded ring`. GM `[GOLD:+40 gp][ITEM_LOST:Warded ring][COMPANION_ITEM_GAINED:Frizwick|Warded ring]`. Frizwick is the keeper, not a party member.
- **Observed A:** receipts `["+40 gp","-Warded ring","Want met: Warded ring (Frizwick)","⚠ 'Warded ring' stays in the pack — no party member 'Frizwick' to give it to"]`. The ring is back in the pack. The want is gone and the +40 gp stays.
- **Input B:** `[GOLD:+40 gp][ITEM_LOST:Warded ring][LOCATION_ITEM:Warded ring|placed|the well house]` (no such place).
- **Observed B:** `["+40 gp","-Warded ring","Want met: Warded ring (Frizwick)","⚠ Stash refused — Warded ring (the well house): no such place on the map","⚠ 'Warded ring' stays in the pack — the placement was refused"]`. The ring is back in the pack and the want is gone.
- **Expected:** no unit left, so there was no sale. The want stays and there is no `Want met`. This is #591's remedy: retire only from an identified completed sale (offer, item, quantity, payment).
- **Mechanism:** the ITEM_LOST row (tag_table.js:535) settles wants at its own end (tag_table.js:559 `wantedSaleSettle(R,text,_wLoss)`). The COMPANION_ITEM_GAINED row (tag_table.js:1678; the missing-recipient put-back at :1686, #518 v1.1226) and the LOCATION_ITEM row (tag_table.js:637; the refused-placement put-back at :645) run later in table order. They restore the ring after the want is already retired and the receipt printed. The kept +40 gp with the ring still in the pack is a coin question for #518/#510 and was not judged here.

### 31 — a bundle split over separate loss tags (#591; edge, same rounding root as 6)
- **Input:** want `Arrow | 1 gp per 3`. GM `[GOLD:+1 gp][ITEM_LOST:Arrow][ITEM_LOST:Arrow][ITEM_LOST:Arrow]`.
- **Observed:** receipts `["+1 gp","-Arrow","⚠ Want kept — Arrow (Frizwick): 1 gp came in beside it, the offers come to 9 sp 9 cp — not read as its sale","-Arrow","-Arrow"]`. The want stays.
- **Control (passes):** per 5, `[ITEM_LOST:Arrow x2][ITEM_LOST:Arrow x3]` for 1 gp retires.
- **Expected:** a match, as one `[ITEM_LOST:Arrow x3]` gets.
- **Mechanism:** tag_table.js:1815 sums `wantedPayCp` per loss, and memory.js:825 rounds each loss separately: round(100×1/3) = 33, ×3 = 99, not 100. One counted tag rounds once.

## Observations (not asserted; no ruling covers them)
- **Partial bundle:** 3 arrows sold at the counter to a "1 gp per 5" want pay 6 sp and retire the whole want. This is a matter of taste and was not judged.
- **One-unit want, multi-unit loss:**
  - `[GOLD:+80 gp][ITEM_LOST:Warded ring x2]` against the one-unit 40 gp want retires it.
  - `[GOLD:+40 gp][ITEM_LOST:Warded ring x2]` keeps it, with "the offer is 80 gp". The line states offer × units lost, not the keeper's 40 gp.
- **Gift to a real companion with coin in the block:** `[GOLD:+40 gp][ITEM_LOST:Warded ring][COMPANION_ITEM_GAINED:Bram|Warded ring]` (Bram a real companion) sends the ring to Bram and retires the want. The literal #591 rule is met (block coin = offer), so I did not assert it. The remedy's "identified completed sale" reading would keep the want.
- **probe.cjs at HEAD:** 22 pass / 2 fail. Both failures are stale expectations:
  - the pack compared as legacy strings (rows since #599 (c));
  - "same paid offer cannot pay twice false", where the second silver ring now meets the plain want and pays 40 gp, which is ruled behaviour.
  
  The 10-11 note named a third stale expectation (the second plain ring meeting the remaining silver want under the b3 base match). It passes since ONE-WAY (v1.1225). Separately, the probe's per-variant `!inventory.includes(name)` check can no longer fail now that the pack holds rows. The port uses `invTextList` instead.

## Gate lines
- `node dev/run-tests.js "acceptance 2026-10-12"`: 25 pass, 7 fail (exit 1). The failures are exactly rows 6, 8, 9, 28, 29, 30, 31.
- `node dev/check-es5.js`: "ES5 check OK — 52 file(s)" (root files only). `node dev/check-es5.js dev/engine-tests.js`: "ES5 check OK — 1 file(s)".
- `node dev/run-tests.js` (full): exit 1, "ENGINE TESTS FAILED (7 of 2994)". The 7 are the acceptance findings above; every source-contract line printed OK.
- `node dev/run-standalone-suites.js`: run-tests skips it when the engine is red, so I ran it directly. "ALL GREEN — 113 standalone verifier suites", exit 0.
- `node dev/check-sabotage-applicability.js`: "ALL GREEN — 3119/3119 retained sabotage clauses applicable across 333 batteries", exit 0.
- `node dev/sabotage-481-d4-want-met.js`: 18/18 caught (memory 2, tag_table 7, api 1, helpers 6, game 1, memory 1), every file restored byte-identical, exit 0. Its filter "#481 D4" does not select the new section.
- **Scratch battery (not in the patch)**, `scratchpad\probe577\acc-sabotage.cjs`: 18 engine mutations, each caught by the named passing acceptance test it targets (memory 5, helpers 5, tag_table 6, game 2), exit 0. So the 25 passing tests can fail.

## Notes for landing
- As instructed, the patch keeps the 7 failing tests. The full suite is therefore red: the pre-commit hook and CI refuse the patch as is.
- While it stays red, any full-suite sabotage battery without a `mustFail` reads a mutation as "caught" whether or not anything guards it.
- The patch is `dev/engine-tests.js` only (+279 lines). There is no engine, TODO, version or CACHE change.
