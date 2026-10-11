# Inventory acceptance — #599

Frozen runtime: `08faa2c45b09d00f92d767ee8c78ddea2cc7d3fb`, v1.1220. This acceptance run changes no runtime code. The server was the real local checkout at `65f996ee68f3667bfa62417e713faa6bc19045f5`, with a disposable SQLite database and synthetic dev-local authentication. No production account, credentials, or provider was accessed.

**Do not complete: senior review found an unknown-field loss on a refused gift.** See [senior adjudication](senior.md) and its executable regression. Existing green guards and transport tests do not override this new failing condition.

## Tests executed

- Full frozen suite: **2,939 assertions, ALL GREEN** (`full-baseline.log`).
- `node audits/acceptance-2026-10-10/inventory/browser-roundtrip.cjs`: **10 checks pass**, zero page errors. Two separate browser processes have disposable profiles. Actual legacy .tnd import, checkpoint restore, File Save payload, two reimports and 100 fixed-input heals preserve rows, equipment, literal count-like names and nested unknown fields. The file-save sink is intercepted only to capture the actual Blob bytes.
- Actual browser storage adapters and local HTTP server: library POST in profile A → GET in profile B → new-campaign resident/companion adoption; campaign push → independent-profile GET → actual manual cloud-pull installation. Both hero and companion rows survive. Library transport also preserves synthetic voiceLines/manner. This validates data preservation, not a subjective persona likeness.
- Named negative control: `TND599_LOST_EQUIPMENT=1` changes only the served inventory.js buffer so legacy worn membership becomes false. The browser run exits 1 at **legacy import preserves equipped membership**, showing the Longsword flag difference (`browser-negative.log`). No source file is mutated. Positive rerun passes.
- Render: [post-pull screenshot](rows-after-cloud-pull.png) inspected; Arrow (20), Torch (12), Longsword (equipped), Literal x3 (2) visible. The harness now asserts actual `#inv-list` visibility and names. An earlier attempt selected the wrong element and fell back to body HTML while the sign-in overlay remained visible; that was insufficient proof (`browser-attempt1.log`). Corrected fixture explicitly reveals the game after synthetic state admission; this is not a login-flow test.
- Read-only census of **79 owner saves, 527 legacy sheets, 11,911 items**: zero unit/equipment/text/grammar/idempotence/refusal/coverage errors; source hashes unchanged. Aggregate only retained (`census-aggregate.log`); no private save payload copied into evidence. Thirty equipped-line order changes are reported, with zero equipped-membership mismatches.
- Existing named scratch batteries: c shape flip **28/28**, c2 review **29/29**, d equipped **28/28**, legacy census **4/4**; **89 clauses**, all attributable and restored. Logs and `mutations.json` retained. The orchestration wrapper initially exited 1 because it compared the pool's success label `ok` to `pass`; independent receipt validation confirmed every actual battery exited 0 with verdict `ok` and no skips. No product test failure was converted to a pass.

## Scope and prior evidence

The current task record already documents actual Gemini turns, independent release reviews, the old-client refusal drill, owner device reload/play, and the server snapshot. Those are prior evidence, not newly executed calls in this run. The owner withdrew cleanup 2 and retained paired tags; this review does not reopen that decision. A generic play-awhile wait could be replaced by objective acceptance under today's instruction, but the actual refused-gift preservation defect blocks closure.

The fixed-input repetition checks idempotence and lack of persistent growth for the admission/heal operation only; it does not claim an unbounded gameplay or browser-memory soak. Browsers/server are closed and disposable server state removed in finally. Synthetic library and cloud records are explicitly deleted through the actual adapters before shutdown.
