# #577 / queue entry 37 — objective verification evidence

Read-only runtime verification on fa065e87f3e773fda88569109b114f4be0389eca, v1.1194. No runtime, guard, tracker or existing test edits. Repo status before testing contained only unrelated website/art/trafficAndDragons_close.png. This is evidence for eligible Astra adjudication, not a tier/closure verdict.

## Executed results

- Existing command: node dev/run-tests.js "#481 D4". Exit0, FILTERED GREEN, one section/six assertions. Full suite was not run by this agent.
- New failure-condition probe: node audits/verification-577-2026-10-08/probe.cjs. Exit1: **19 passed, 5 failed**. Four failures are queue37(a)'s exact-offer retirement/repeated-payment issue in two wanted insertion orders; the fifth is the separate known #591 coin-attribution issue.
- Uses real load-engine, importVillageResidents, fileWanted, shopTradeCatalog, shopTradePlan, shopTradeApply, ledgerApply and applyMuts. Only external-effect UI/save functions are no-ops. No provider calls, credentials, live campaign mutations or browser clicks.

## Original #577 failure condition and controls

Three carried variants (plain Warded ring x2, crypt provenance, cracked) match the same40gp want. Marking all three computes sellCp12000 but **ok:false**, with the named one-offer refusal. shopTradeApply refuses and the JSON representation of complete worldState+memory stays identical. A direct quantity2 mark on the plain stack also refuses identically. Each of the three single marks independently removes only its selected variant and pays4000cp once. A subsequent unpriced copy refuses; with explicit200gp type canon, first unit pays4000cp and second pays the ordinary10000cp. These assert the existing implemented behavior without deciding the taste question of whole-trade refusal versus ordinary-price overflow.

A stale accepted plan whose item disappeared is rejected by actual ledgerApply before changing any world/memory bytes. Selling both distinct wants together pays10000cp and retires both, a positive control that shows why the single-sale failure can be missed.

## Objective failure: wrong distinct offer retired

Fixture wants are created through fileWanted, not injected into the planner. Both share itemBaseName but have distinct exact names/prices. The catalog explicitly identifies separate r.want.key values and the planner correctly gives each its own allowance.

| Order in wanted list / sale | Actual first result | Expected invariant | Actual next sale |
|---|---|---|---|
| Plain40gp first; silver60gp second. Sell silver only. | Pays60gp; receipt says Want met: Warded ring; plain removed, silver remains. Purse2500→8500cp. | Retire the offer actually priced/paid (silver); preserve unsold plain want. | Silver pays60gp again; purse→14500cp. Plain offer vanished without its sale. |
| Silver60gp first; plain40gp second. Sell plain only. | Pays40gp; receipt says Want met: Warded ring (silver); silver removed, plain remains. Purse2500→6500cp. | Retire paid plain offer; preserve unsold silver want. | Plain pays40gp again; purse→10500cp. |

Failed assertions retain their genuine expected values and the probe exits1. They are not inverted into expected-failure passes.

Mechanism: shopTradeCatalog records exact selected offer identity (helpers.js:3429), shopTradePlan uses it for per-offer allowance (helpers.js:3443) but creates sale lines containing only name/qty/price (helpers.js:3444). ledgerApply retires by sale item name (game.js:391), and retireWantedAt normalizes every wanted item to itemBaseName and removes the FIRST matching live row (memory.js:797–801). Thus pricing identity is lost before retirement. The failure depends on wanted insertion order. Queue37(a) named exactly this concern; it is independent of refusing excess units and independent of #591's narrated-sale evidence.

## Separate #591 boundary, not reassigned

No-coin discard passes: want remains. Actual applyMuts with prose describing unrelated change plus [GOLD:+1 cp][ITEM_LOST:Warded ring] adds1cp, removes the ring and retires its40gp offer, emitting Want met. The fifth failing assertion requires the wanted offer to remain. This is already recorded by TODO591; it is not evidence that the #577 per-plan allowance calculation itself failed.

## Coverage limits / resources

No taste evaluation, no interface rendering, no live GM, no device testing and no mutation battery run. Existing section's six assertions include ordinary payment, expiration and word-price cases but omit the distinct same-base want scenario. New observations demonstrate runtime behavior; source inspection explains it.

Monotonic scope: per-call catalogs/plans and wantLeft are ephemeral; per-turn tradePing replaces one record; per-session UI marks were not created; per-campaign wants are capped4 (fileWanted), wares capped and provenance ring bounded, coin/inventory change on accepted transactions. The wrong-offer failure can repeat once per colliding retained offer, not infinitely for a fixed capped wanted list; refiling offers can recur by later events. No new per-device storage or wasm was created. Heap/GC duration behavior was not measured.

New probe started2026-10-09T05:21:20.281Z, elapsed73ms (process-internal measurements, not total review duration). Ten exec calls through report correction; first source glob was invalid on Windows, corrected by exact filename; default-sandbox git status failed worktree access, corrected with read-only escalation. Tokens and agent elapsed unavailable. Files: probe.cjs, probe-output.txt, results.json, existing-section.txt, report.md. Console log records NodeExit=1 for custom probe despite PowerShell Tee-Object finishing successfully.


## Final disposition

Eligible Astra independently repeated the failing probe and adjudicated **FAIL objective acceptance**. Keep #577 open until exact paid-offer identity survives through accepted retirement. [Senior verdict and independent output](../verification-530-531-2026-10-08/README.md#senior-adjudication-of-delegated-577-evidence). The owner asked to skip matters of taste; the choice between refusing excess quantity and pricing overflow normally was not judged. The four #577 failures are retained as failures; #591 remains separate. No runtime fix is included.

Persistence diagnostic: the first portable copy accidentally re-encoded the UTF-8 em dash using the Windows default text encoding. That produced two additional harness failures (17 pass/7 fail; probe-portable.log). Restoring the original UTF-8 fixture bytes and changing only the ASCII default path restores the independently observed 19 pass/5 fail result. No assertion changed.
