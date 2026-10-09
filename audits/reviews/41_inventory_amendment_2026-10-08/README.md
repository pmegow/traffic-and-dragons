# Entry 41 evidence — amended inventory design

Review date: 2026-10-08, America/Los_Angeles. Initial HEAD 5360ba393ee8b09b50d6252c6bfce6fd0da60a4e; unrelated #404 documentation archival advanced the shared checkout to 4b9d40a4 during evidence gathering. Runtime sources remained unchanged, APP_VERSION v1.1193.

- A: release boundaries, compatibility and test/anchor workload (`report.md`, `probe.cjs`, `probe-output.json`).
- B: admission doors, write ordering and context (`evidence-b.md`, `probe.cjs`, `probe-output.txt`).
- C: row preservation, duplicate selections and retained resources (`evidence-C.md`, `probes.cjs`, `probes-output.txt`).

Reports are evidence-only inputs, not verdicts. Astra adjudicates in [the review](../../AUDIT_FABLE_2026_10_08_41_inventory_amendment.md). Proposed row APIs and guards do not exist at this baseline. C's duplicate catalogs are explicit synthetic projections passed to existing planners; they are not claims that production inventories already contain the new rows. B's failed-load pull uses a false-returning loadState spy to expose the caller's real write order.

Probes load the current repository at C:/Projects/traffic-and-dragons and use synthetic engine state; they do not read personal saves or call live providers. Adjust their root before running elsewhere. Recorded output is baseline evidence, not a promise about later revisions. B's report records its earlier 57.3385 ms run; the adjacent output is its later 54.5338 ms run. Agent-wide elapsed/token metrics were unavailable; subsecond probe runtimes are not review duration.

Parent baseline verification: `node dev/run-tests.js`, exit 0, `ALL GREEN — 2809 assertions passed (engine tests)`. Full output stayed in the local temporary file fable-review-41-baseline-tests.log. This confirms the unmodified baseline, not future migration, gate, device-skew, preservation or live-GM behavior.
