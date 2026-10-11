# Senior adjudication — #599 inventory rows acceptance

Reviewer: Astra. Date: 2026-10-10 local / 2026-10-11 UTC. Reviewed frozen client `08faa2c45b09d00f92d767ee8c78ddea2cc7d3fb` (v1.1220), local test server `65f996ee68f3667bfa62417e713faa6bc19045f5`, and read-only rechecked the finding on current client `c63e880e` (v1.1221). No runtime, source assertion, tracker or main-checkout edits.

**FAIL — leave #599 open.** The owner's current request authorizes replacing the remaining generic “play on it a while” hold with objective acceptance. The selected display and terminology are already ruled; the withdrawn cleanup 2 is not unfinished work. The new browser/server round trips, prior genuine GM/device checks and current regression evidence would substantiate completion if all row-preservation invariants passed. A new exact failure does not: a refused one-unit gift destroys an unknown row field. This violates #599's explicit I5 and gate 14 independently of the numeric #518 failures.

## Reproduced invariant failure

Start with the hero holding:

```json
{"name":"Torch","qty":1,"equipped":false,"origin":{"batch":"synthetic","marks":[1,2]}}
```

Apply through the real parser:

```text
[ITEM_LOST:Torch][COMPANION_ITEM_GAINED:Absent|Torch]
```

The hero still has one Torch, but `origin` has disappeared. Receipts are `-Torch` and `⚠ 'Torch' stays in the pack — no party member 'Absent' to give it to`; handler errors are empty. The refusal is visible, the metadata loss is not. This is neither intentional consumption nor an unsupported destination taking ownership: the engine says the item stayed with the hero.

**Mechanism:** `tag_table.js:550` records the removed row fragment in `ilFrags`. The missing-companion path at `tag_table.js:1682` reads one `ilHits` name and calls `addInventoryItem(worldState.character.inventory,_gpb)` without the corresponding fragment. The item is rebuilt from its name alone. The same branch accounts for #518's counted rollback loss, but this single-unit case isolates the #599 metadata contract without any count shortage or repeated-pair ambiguity.

The contract is explicit: design §2 I5 says unknown fields survive every write; §4.5 says row fragments carry unknown fields through transfer, rollback and undo, otherwise refuse before either side changes; §5.2 point 7 requires failed operations to preserve affected resources; gate 14 requires lossless retained state. Release (c)'s review finding 4 likewise states that the fragment must ride or the whole transfer refuse. Keeping the two-tag protocol does not waive those invariants.

`senior-regression.cjs` is an executable failing regression, with an optional absolute runtime-root argument. Its positive control first gives the identical row to a valid Bram and verifies that the entire fragment arrives. The missing-recipient assertion then fails with the exact message `#599 I5 refused single-unit gift must restore every unknown row field`. Both frozen and current-main runs exit 1 for that assertion; their complete UTF-8 logs and JSON observations are preserved. `senior-source-hashes.json` confirms `inventory.js` and `tag_table.js` are byte-identical between frozen and current main. The new unrelated mobile File-menu commit does not remove this defect.

## Evidence accepted, with limits

- Reviewed `browser-roundtrip.cjs`, actual `browser-receipt.json`, `browser-negative.log`, the complete task history, design gates, and release (c)/(d) independent-review receipts. The browser receipt records ten passing checks against a real local server/disposable SQLite and two isolated browser profiles: legacy admission, checkpoint, actual File Save handler (download bytes captured at the sink), repeated import/heal, real library POST/GET/adopt, cloud push/GET/install, visible inventory, cleanup, and no browser errors. No mocked server storage is presented as a real round trip.
- The browser mutant sets the restored legacy equipment flag false in the served buffer. The intended `legacy import preserves equipped membership` assertion fails and identifies Longsword's true→false change. This is real negative-control sensitivity; the runtime on disk is unmodified.
- Independently viewed `rows-after-cloud-pull.png`: the inventory is visible, showing Arrow (20), Torch (12), equipped Longsword and literal name `Literal x3` with quantity (2). The old login-overlay screenshot is not used as final rendering evidence. The screenshot is functional row-render evidence, not a new style verdict.
- Inspected `full-baseline.log`: `ALL GREEN — 2939 assertions passed (engine tests)`. A green baseline can coexist with the new failing invariant assertion; it does not override the repro.
- Inspected `census-aggregate.log`: 79 saves, 527 legacy sheets, 11,911 items, zero unit/text/equipment/idempotence/refusal/invalid-diagnostic failures, selected hashes unchanged. These are legacy inputs with no unknown row fields; they cannot detect this refused-row-fragment loss.
- The historical gate 12 record contains actual gemini-3.8-flash gains/losses, WORN off, EQUIPPED on/off and equipped-counter refusal. The owner reloaded every device and played a turn, recorded October 10. No new live-provider result is fabricated or needed to explain this deterministic defect.
- Prior release gates cover module/admission/version skew/prompt diffs, narrow replay migration and independent review; cleanup 2 was withdrawn by owner decision. The new browser evidence fills the explicitly outstanding real library/cloud round-trip coverage. Parent's selected #599 c/c2/d/census sabotage reruns are additional verification, not substitutes for the failed I5 case.

## Scope and required next step

No taste-only requirement prevents objective closure. The concrete blocker is unknown-field loss during refusal. A future fix needs a failing test for this single-unit fragment case plus the related counted/repeated gift conservation failures, followed by attributed mutation proof and the relevant row/transfer gates. This acceptance task requested testing and closure if passing; it does not need an unsolicited runtime fix. Keep #599 open with this finding, and keep #518's two numeric failures explicitly tracked.

Resource review: the new browser run uses disposable profiles/database and cleans synthetic records; its fixed-input 100-heal loop verifies byte-identical character state. The reproduction is a finite fresh-world operation, with no caches, workers, credentials or user-save writes. No long-duration device/wasm soak is claimed. The remaining defect is data preservation, not unbounded growth.

Final coordinating battery receipt: c 28 + c2 29 + d 28 + census 4 = **89 attributed clauses green**, each battery status 0 / verdict `ok`, no skips. Parent independently checked the JSON results and named mutation/restoration logs. Its initial outer wrapper compared the verdict with `pass` instead of `ok` and exited 1; that harness classification mistake is retained in the root report. No costly battery rerun is necessary, and these green existing guards do not override the executable I5 regression above.
