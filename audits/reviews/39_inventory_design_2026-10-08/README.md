# Entry 39 evidence

Review baseline: 8715997f (tree 3aa32e6c). A/B/C reports retain the independent evidence and explicit limits. These are evidence, not implementation or verdicts. The adjudication is [the review audit](../../AUDIT_FABLE_2026_10_08_39_inventory_design.md).

Only synthetic observations, public-source indexes and aggregate field counts are retained here. Personal save files, selected-path/mtime manifests and per-save hashes remain in TEMP and are not included. B's metrics retains only per-source equality, not its hash list. A's original negative wall-clock value is preserved; aggregate-receipt.json records the UTC-derived correction.

To rerun a probe, COPY it and any referenced synthetic fixtures into a fresh TEMP directory first; scripts may write JSON beside themselves and some retain their original TEMP/root paths. Run against the cited baseline checkout, with real network disabled. Do not run evidence writers in this tracked folder. Agent reports name original commands and skipped doors. Read-only server observations are local-source evidence, not deployed-server verification.

The expanded 2,077-site census is a mechanical superset across 147 files (107 function bodies), including comments/false positives. It is not execution coverage or proof of every dynamic alias. Proposed APIs, scratch models and current production behavior remain distinguished in the reports.

The census-correction folder contains failure-first and final synthetic proof logs plus aggregate-only field results. The corrected development checker is explicitly legacy-string-only; its passing result does not validate general row migration.
