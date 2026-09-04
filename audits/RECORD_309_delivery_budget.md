# #309 delivery budget — v1.814 (2026-09-04)

Owner ruling: three builders / approximately 2,500 characters; registry order is priority;
deferred notes retry next turn and appear in the ring; consequences never yield.

The orchestrator snapshots delivery latches before each builder. A rejected candidate restores
those latches. Shelf-ping payloads receive a deferral marker, surviving their original shelf
without passing the waiver to a replacement payload. Expiring future events retain an
`_askPending` appointment until the ask is delivered; failure restores it. Legacy relationship
archive cleanup runs before the per-builder snapshot, avoiding duplicate archived preimages.

Both the protocol and separators count toward the character budget. An indivisible first note
can exceed the soft character limit, alone, so it cannot starve forever. Death scene, downed,
respawn and refused-death plot-armor consequences never yield. Every over-cap block has
`overBudget:true`; delivered names remain `n`, actual total length remains `c`, and `d` contains
`{n,reason:"count"|"characters",c}` for each deferred candidate. Ring commit/discard is unchanged.

Verification:

- Seven engine regressions; six demonstrated red against the unbudgeted implementation.
  The archive test then caught the naive rollback interaction before the hygiene split.
- Full suite: 1,998 engine assertions + 27 standalone verifier suites.
- `dev/sabotage-309-budget.js`: 10/10 attributed mutations caught and files restored.
- Existing `dev/sabotage-309-note-shapes.js`: 9/9 caught and restored.
- Read-only local composition on the t2097 Runelords save: 10 ms, 2,265 characters;
  `buildWhispersNote` delivered, `buildMarketNote` deferred for characters (449-character candidate).
  No save files modified. Available local exports have no post-v1.773 notes-ring corpus;
  this is a saved-state diagnostic, not a live playtest or proof of long-run pacing quality.
