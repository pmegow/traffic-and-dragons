# #738 — Blueprint portraits throughout play

Date: 2026-11-13. Implementation: v1.1413. Reviewed against `83abff0b`.

## Cause and change

Blueprint NPC images already entered the roster, but selected library companions existed before blueprint admission and could miss their authored image. Manual sheet generation removed the roster image before its candidate passed admission. Accepted identity merges copied only raw roster images, stranding them outside an existing sheet or dropping a duplicate sheet's image. Blueprint export omitted NPC portraits entirely.

The campaign keeps the existing canonical portrait ownership: `charSheet.portrait` when a sheet exists, otherwise the NPC row. `npcPortraitWrite` validates an image before changing that owner and marks portrait transport dirty. Existing images win; explicit removal stays removed. There is no ongoing catalog lookup or extra model call.

At blueprint application, filling an existing NPC requires one unique source name, one exact roster primary name, and no competing identity claims. Case variants, aliases alone, provisional identities, differently named sheets, and source identity conflicts withhold the image. NPCs absent from the blueprint receive no image assignment.

Manual generation releases the roster image only after successful admission and always releases its busy latch. Accepted merges select the survivor's image before adopting another sheet, carry that image's framing, and normalize the result onto the surviving owner. Blueprint export preserves the canonical image.

## Surfaces and scope

Verified existing image surfaces: World State's NPC sheet, companion sheet and portrait editor, Companion Talk and Car Mode/media artwork, eligible scene reference images, character download, individual/party library upload, and saved campaign reload. Existing text-only rows keep their layout. Scene models retain their existing reference-image capability limits.

A campaign stores its admitted images and blueprint edition metadata, not the full source blueprint. An old save that never stored an image still needs its original blueprint for recovery; this change does not guess by fetching a newer catalog edition.

## Independent review and evidence

Critical pre-review approved strict matching and canonical ownership. Final independent review reproduced a face/crop mismatch in the first merge implementation; two failing tests defined it, and the corrected implementation passed review.

- Full `node dev/run-tests.js`: ALL GREEN, 3,337 engine assertions plus every standalone suite and source contract. ES5 and whitespace checks passed.
- Engine section `#738 blueprint portraits throughout play`: 24 assertions. Nine original failures and two framing failures reproduced before their fixes.
- `dev/tests-734-blueprint-portraits-browser.js`: eight additional groups, four failures against the baseline, all passing after the change with both a self-contained image and the actual authored Willow portrait. Screenshots were inspected; image visibility checks include the on-screen hit target, decoded pixels, and painted frames.
- `dev/sabotage-738-portraits.js`: 23 named mutation proofs across assignment, identity safeguards, merges, framing, and manual admission. Existing #734 portrait, #539 voice handoff, and #599 admission batteries also passed.
- Baseline/current stable AND volatile prompts were byte-identical for Kaelon turn 7 and original/repaired Maren turn 50. Twelve saved assistant responses independently replayed from identical saved terminal states produced identical mutations and full world/memory, with zero handler errors. This is not a reconstruction of historical intermediate turns.
- Four sequential corpus replays matched their committed oracles. Original saved campaigns remained byte-identical.
- Eight mocked cloud checks passed using real `syncNow`/`load`: a warm-synced sheetless merge schedules a portrait PUT under the canonical name, same-campaign reload restores its exact bytes, and sheet portraits roundtrip inline. No authenticated or live model calls.

Local evidence is under `C:/Users/hannu/.codex/visualizations/2026/11/12/01a1d096-0998-7b81-a3b3-3543ea7c5dca/`: `738-browser-final`, `738-browser-before-final`, and `portrait-738-independent/prompt-replay-receipt.json`.

## Resource behavior

No persistent portrait dictionary, background lookup, or model request was added. Image ownership remains one stored image per NPC. Blueprint matching scans only during application; merge work retains one image and bounded framing fields. No per-turn, per-session, or per-device accumulating collection was introduced.
