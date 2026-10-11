# #517 / #518 verification evidence — 2026-10-10

Target: frozen checkout `08faa2c45b09d00f92d767ee8c78ddea2cc7d3fb`, APP_VERSION `v1.1220` (globals.js:421). The #517 fixes originally shipped as v1.1212; that is not the tested checkout's version. Scope: objective engine verification; no runtime edits, tracker decisions, live account calls, model calls, or main-checkout writes. This is evidence for the eligible senior review, not a closure verdict.

Read: AGENTS.md, CLAUDE.md, complete TODO #517/#518 histories, items/tags contracts, and the inventory design §7 owner's October 10 ruling. The current contract keeps two tags and scopes their pair notes to one contiguous tag block. The prior transfer-record proposal is superseded. Neither row states a taste hold; “ready to test in play” is their current status.

## Method and reproducibility

`node audits/acceptance-2026-10-10/ledger/run.js probes` loads the actual canonical engine and runs the independent `probes.js` through real `applyMuts`, WARES/WANTED filing, shop catalog, plan, counter apply, and ledger apply. It stubs only persistence and UI painting; `showToast` is captured. State uses synthetic row inventories and fresh test worlds. Assertions compare exact copper, quantities, retirement, visible warnings, and refusal state snapshots. Output is UTF-8 with command, exit status, elapsed time, and complete receipts/stack traces in `probes-utf8.log`.

Result: **47 passed; 2 failed; exit 1**. Historical exact shapes pass; two additional failure-condition controls expose count loss. Failing assertions remain in the script, unmodified.

## Coverage and observed outcomes

| Row/group | Check | Observation |
|---|---|---|
| 517 mixed transaction | Two whistles sell for 6 sp while rope costs 1 gp, actual counter commit | Net 40 cp, whistles removed, one rope gained |
| 517 plural/wrong-unit adventure coin | `3 coppers`, `2 silvers`, `4 copper pieces`, `5 gold coins`, `5 sp` | Exact unit amounts debited; no old whole-gold interpretation |
| 517 formerly unsupported prices | `20 for 1 gp`, `5 gp per dozen`, `1 gp 5 sp`, actual WARES → counter | 20/12/1 units for 100/500/150 cp |
| 517 counted ware | `[WARES:Arrow x20|1 gp]`, buy 1/7/20 | Canonical Arrow name, per 20, 5/35/100 cp, exact 1/7/20 counts |
| 517 per-N want | Iron ore per five, sixth mark, then five | Sixth refused atomically; five paid 100 cp and want retired |
| 517 repeated wanted offer | Three decorated ring rows matching one 40 gp want | Whole over-allowance transaction refused unchanged; one decorated ring paid 4000 cp; only ring want retired, knife want retained |
| 517 refusal controls | Insufficient purse; stale ledger plan after inventory shrinks | No pack/purse/shelf/want mutation |
| 517 empty paid take | 3-unit take from empty companion, hero already holds 2, GOLD at each of 3 offsets | No minted or lost stock; exact 200 cp returned; receipt names refund |
| 517 payment boundaries | Same block includes legitimate Rope purchase; payment separated by prose; partial take | Payment retained in all three; partial take transfers only one held unit |
| 518 count boundaries | Give/take, donor holds 0/1/2/3/4, request 3, both textual orders, whitespace between tags | All 20 conserve count and land min(held,3), with short/empty receipts |
| 518 home gift | Potion in pack and chest, both tag orders | One leaves pack, one reaches companion, chest potion retained |
| 518 loot/throw collision | Dagger gain and empty companion loss separated by prose, both orders | Hero retains independently looted dagger |
| 518 unpaired gain | Standalone companion gain x3 | Three gained as its own event |
| 518 absent receiver boundary | Gift x3 to unavailable companion | **FAIL:** three leave hero, only one restored |
| 518 repeated same-block boundary | Two give pairs with one torch held | **FAIL:** hero and companion end empty; one torch destroyed |

## Failure details

1. `518 counted gift to unavailable companion restores all three units`: hero starts `{name:"Torch",qty:3,equipped:false}`. Apply `[ITEM_LOST:Torch x3][COMPANION_ITEM_GAINED:Absent|Torch x3]`. Actual hero ends quantity 1. Receipts: `-Torch x3`, then `⚠ 'Torch' stays in the pack — no party member 'Absent' to give it to`. Mechanism visible at tag_table.js:1682: the missing-recipient branch pops and restores one `ilHits` entry, without iterating the counted loss. Existing A2 tests cover the single-bottle refusal but do not catch this counted variant.

2. `518 two short same-block gift pairs do not reuse one loss unit`: hero starts quantity 1, Bram empty. Apply `[ITEM_LOST:Torch][COMPANION_ITEM_GAINED:Bram|Torch][ITEM_LOST:Torch][COMPANION_ITEM_GAINED:Bram|Torch]`. Actual both inventories end empty. Receipts: `-Torch`, followed by two `Nothing given` warnings. Mechanism: ITEM_LOST handlers run before companion gains; the second loss writes an item+block `ilMiss` (tag_table.js:551), and the companion handler's `itemPairMissed` check (1681) refuses both gains although the block also has a successful loss. Conservation assertion permits either partial completion or atomic refusal; zero total fails either behavior. No new transfer protocol is required by this assertion.

## Existing checks

`node audits/acceptance-2026-10-10/ledger/run.js existing`: all seven filtered sections exit 0: ledger quartet 10 assertions; #518 block 4; #481 D4 6; #481 D5 7; #598 purse 5; #481 A2 7; #481 D2 4. **43 assertions total.** Logs `section-0-utf8.log` through `section-6-utf8.log`. These are explicitly filtered results, not a full-suite claim.

Named scratch batteries were run by `run.js batteries` with a six-minute bound per battery. All six exited 0; all 68 clauses proved with named test attribution and byte-identical restoration: 517-counter-tail 10; 518-pair-block 5; quartet-ledger 16; 481-d4-want-met 8; 481-d5-coin 15; 598-copper 14. Their complete `sabotage-*-utf8.log` files retain each mutation label, attribution, and restoration result. Passing existing mutation coverage does not negate the two new behavioral failures.

## Harness history and limits

The first probe launch lacked the standard headless `syncUI` stub and all cases threw after engine application. Original `probes.log` preserves that setup failure. Adding only the UI stub then produced 45 passes and two receipt-assertion failures: the checker accepted `Nothing moved` but omitted the actual valid `Nothing given` wording. Preserved in `probes-harness-receipt-failure-utf8.log`. Adding the exact alternate wording left all state assertions unchanged; the two genuine count-loss probes were subsequently added and remain red.

Initial sandboxed battery invocations could not write scratch `.git/config` and ran no mutation clauses; the blocked log is preserved as `blocked-clone-logs`. The same commands were retried with approved elevated execution, using the batteries' own disposable clones, without changing the engine or assertions.

Monotonic-resource review: these probes are finite, fresh-world synthetic runs. Pair notes/spans and spend notes are response-local; ledger tag log is capped by TAG_LOG_CAP=40; stash move history has STASH_MOVES_CAP=200 with visible eviction. No persistent browser session/wasm allocation is exercised or introduced here. No soak result is claimed.

Not run in this evidence package: live model turns, browser visual acceptance, production-account operations, or full-engine suite (the coordinating review owns broader gates). No visual/layout change belongs to these two objective arithmetic/count rows. This evidence cannot by itself waive any broader acceptance gate.
