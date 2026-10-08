# #545 verification receipts

These files contain synthetic fixtures, hashes and aggregate read-only checks. No personal save contents or credentials are copied here.

- `pass3.json`: the unchanged p02 oracle's complete 650 flagged rows from 66,564 pairs, before the final latest-main merge.
- `baseline-c6c27652.json`: root's immutable original baseline census.
- `extra/`: all nine extra Object.prototype names, one original p10 run per name so its historical 600-row output cap cannot hide cases.
- `original-suite/`: unchanged held p03–p22 probe outputs.
- `retained/`: 381 named mutation clauses across 19 affected retained batteries.
- `mutations-final.log`: 13 new mutation clauses.
- `oracle/`: the original scripts copied byte-for-byte from `claude/536-reserved-words`, with the declared adapter for the historical untracked harness. `oracle-source-hashes.json` pins p02, p10 and lib to their original branch bytes.

The adapter uses the canonical engine loader and actual `applyMuts`, with detached synthetic world fixtures and display/persistence stubs. The absent historical harness is not represented as original source.

From the repository root, replay complete states, receipts and prompts for every original flag:

```powershell
node dev/adjudicate-545-census.js audits/verification-next-ten-2026-10-08/stores-545/pass3.json audits/verification-next-ten-2026-10-08/stores-545/oracle/audits/reviews/536_reserved_words/lib.js
```

Replay the extra-name cases directly from the preserved results and original library:

```powershell
node dev/adjudicate-545-extra.js audits/verification-next-ten-2026-10-08/stores-545/extra audits/verification-next-ten-2026-10-08/stores-545/oracle/audits/reviews/536_reserved_words/lib.js
```

`adjudication.log` compares all 650 full facets; `extra-adjudication.log` compares all 2,041 extra full facets. The old oracle's truncated difference snippets alone are insufficient evidence, so both adjudicators rerun the exact original/control cases. Only the expected transaction fingerprint spelling and the existing 20-character dice-outcome / 24-character sound-warning truncations are normalized, at those exact fields. Everything else must compare equal.

`corpus.log` records 77 actual load/save/reload checks against 65fbf748 using memory-only storage, with identical state and prompt output and unchanged owner-file hashes. `replay-baseline.log` and the p19 output match byte-for-byte for 1,236 corpus replies, including the same one preexisting handler error.

The original p02 census took 73 seconds. Extra nine-name census took 230 seconds for 199,692 pairs; separate per-name runs retain every detail. Workloads overlapped other verification, so timings are observations, not benchmarks.

## Integrated runtime on 90c53126

`integrated/` preserves the final unchanged 66,564-pair census (81 seconds), full-facet adjudication of all 650 flagged cases, replay of all 2,041 extra-name cases, the 77-save load/save/reload and prompt comparison, actual browser and persistence checks, and runtime SHA-256 hashes. The p19 baseline and revised logs compare byte-for-byte across 1,236 replies, including the same one preexisting handler error. These final comparisons use 90c53126; earlier evidence remains above.

For the final original-case replay, substitute `integrated/census.json` for `pass3.json` in the first command.
