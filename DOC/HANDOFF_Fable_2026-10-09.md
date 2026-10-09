# Handoff — Fable session 2026-10-09 → the session that builds #599 release (c)

**Read this when** starting release (c) of TODO #599 (the inventory shape flip). Ephemeral per the trackers rule: open items
live in TODO.md; this file archives as DOC/HANDOFF_v<ver>.md when superseded.

## State

- **Live:** v1.1200 (`APP_VERSION`; `sw.js` CACHE `tnd-v3-20261009e`), origin/master at 09eb16eb, tree clean except
  `website/art/trafficAndDragons_close.png` (another session's; never stage it). Server v1.7.3.
- **Release (b) is complete and pushed:** b1 `inventory.js` 89b94935 · b2 `admission.js` e51e2dff · b3 one key 2ed71094 ·
  b4 the read/write boundary 71fe9b81 · b5 the review's closures 319e84b6 + 8c7c87a3. The running record of every release is
  [DOC/todos_completed/todo_599_status_history.md](todos_completed/todo_599_status_history.md); the TODO row keeps title + TLDR +
  verdict + link (the 6144-byte row cap).
- **Suite:** 2851 engine assertions green; the ADMISSION CONTRACT (7 install doors + 2 previews, 5 internal transfers,
  12 step-level exemptions) and the INVENTORY BOUNDARY CONTRACT (49 engine files, 6 rules, 0 exemptions, 22 hosts paired) green;
  applicability 2905/2905 across 318 batteries; the four replay baselines unchanged; the census 0 grammar splits over 77 owner
  saves; gate 8 byte-identical over the 9 owner campaigns. The sabotage pool runs 16 wide by default (09eb16eb).
- **The independent review of (b)** ran (Opus, read-only) and is closed: [audits/REVIEW_599_release_b_2026_10_09.md](../audits/REVIEW_599_release_b_2026_10_09.md).
  Its items that belong to (c) are listed below under "Owed to (c) by the review".

## Read first, in this order

1. [DOC/DESIGN_599_inventory_rows.md](DESIGN_599_inventory_rows.md) — §2.1 the row, §2.4 the module's functions and their
   contracts, §3 "worn" becomes "equipped" (the data fold is (c); the `[EQUIPPED:]` tag and the label are (d)), §4 every place
   that changes (the (c) column), §5.1–5.4 the migration (invRows exactly, where it runs, the skew risk), §8.2 the gates
   (1–14), §9 the owner's ten decisions, §12 the (c) row.
2. The b1–b5 entries of the status record (above) — what is already built and tested but NOT installed: `invRows` with the
   §5.2 contracts, `invFind/Add/Remove/Rename/Equip/Text/Detach/Count`, and the readers `invEntries/invTextList/invEntryText/
   invTally/invFromLines/invHolds` that every outside site already uses (so (c) changes what THEY return; nothing outside
   inventory.js moves for the readers — that was b4's point).
3. The review receipt (above) — the "Checked and sound" list says where not to look again.
4. CLAUDE.md: the drift decree (Fable only; critical review BEFORE code; the review's test plan examined from alternate angles),
   the sabotage rules (unique anchors; a mutation that changes nothing is a failure; attribution words), the version rule
   (bump `APP_VERSION` and `CACHE` on every engine commit), the TODO rules (update the row in the same commit; the cap).

## What (c) does (the §12 row, in file terms)

- **globals.js:** `SAVE_VER` and `SHEET_VER` become 11. Every (a)-gated door on an old build then refuses a (c) save or sheet —
  that is the protection (§5.4); decision 1's device step is done (every owner device opened once, 2026-10-09).
- **inventory.js:** the admission registry's `inventory` entry runs `invHealSheet` (installs `invRows` rows, folds `worn` into
  `equipped`, keeps unknown fields — I5; a refusal leaves the source intact). The legacy string writers (`addInventoryItem`,
  `removeInventoryItem`, `renameInventoryItem`, `wornSet`, `wornPrune`, `wornRename`, `isWorn`, `foldDuplicateInventory`,
  `sanitizeModelInventory`, `inventoryCountOf`) become delegates over the row functions or retire (§2.4: "never keep duplicate
  implementations"; retire names only in a later explicit cleanup commit once callers, tests and anchors have moved). The
  readers (`invEntries`, `invTextList`, `invEntryText`, `invTally`, `invHolds`, `groupInventory`'s `text`) already handle rows.
- **admission.js / state.js:** the LOAD becomes a same-mode admission for this campaign's own sheets (hero, roster, archives,
  `mpFallen`, merge archives) — `migrateWorldState` routes through the registry's same mode so `invHealSheet` runs at load, at
  `.tnd` import, at the cloud pull and at `checkpointRestore` (which runs no migration today — §5.3). Checkpoints: check `v`,
  the nested world `ver` and sheet versions separately before assigning. Preserve archive preimages verbatim; heal a detached
  copy on reactivation.
- **tag_table.js:** the 13 item handlers (`ITEM_GAINED/LOST/RENAMED/KEPT`, `LOCATION_ITEM` and its put-backs,
  `COMPANION_ITEM_GAINED/LOST/RENAMED/KEPT`, `WORN`) move from per-unit loops to `invAdd`/`invRemove` with a count; the pair
  notes keep their per-unit meaning (#518 ② tests re-pointed); `WORN` reads and writes `row.equipped`. The GM grammar does
  NOT change in (c) (`[EQUIPPED:]` is (d)).
- **helpers.js / api.js:** `portableSheet` stamps `sheetVer: 11`; `attireLine`/`attireRenderText` read equipped rows — the
  `Wearing:` line keeps its name and may change only its ORDER to pack order (gate 8's one allowed diff); the catalogs already
  read `invEntries`. `clampImportedCharacter` already clamps row names.
- **The interface:** ui-panels/ui-sheets render `row.text`/`qty`/`equipped` (the `.eq` CSS class means weapon-or-armor, not
  equipped — rename it `.gear`, §4.3); the delete marks key on `itemKey`; the Sync modal is the ONE free-text writer: keep a
  detached original snapshot, apply only edits that map uniquely to source rows, refuse ambiguous edits visibly, never rebuild
  existing rows from `invTextList` alone (§4.3). ui-portrait's prompt join stays byte-identical (tests-160 pins it).
- **Satellites (§4.4):** character_editor.html gets a row editor (name, count, equipped tick); its .char export, library save
  and draft write rows and `ver: 11`; an old draft heals on restore; extend `__ceTest`. map_cleanup.html's migration call is
  never typeof-guarded. home.html's three samples stay strings (the heal converts them on adoption). The bible notes that say
  "counts live on the inventory string" are reworded.
- **The server:** nothing (opaque text) — but §5.5's owner steps come BEFORE the deploy (below).
- **dev/:** `diff-replay` fixtures prepared NARROWLY at fixture start and the four baselines regenerated under gate 9's exact
  whitelist (`ws.character.inventory`, `ws.ver` 10→11, new `ws.character.sheetVer` 11; prove `invTextList` equals the old
  array and every other field is byte-equivalent) — frozen re-baselining is Fable-tier. `dev/census-inventory-rows.js` reads the
  engine's grammar now; (c) extends it to row inputs and an independent equipment oracle (gate 7: erasing every `equipped`
  flag must FAIL even when text and units are identical; unreadable input fails coverage, never CENSUS OK after a skip).
  `dev/capture-prompt-all.js` (new, this handoff) runs gate 8 in one command.
- **Tests and batteries (§4.8):** 276 `.inventory` sites in dev/engine-tests.js and 33 batteries that anchor on inventory,
  stash, worn, attire or ledger code — expect most of the string fixtures to need rows or `invTextList` reads, and expect
  stale anchors by the dozen: `node dev/check-sabotage-applicability.js` lists them; re-anchor each to the row-era line and
  re-prove (b2 re-anchored 28 in ~40 minutes). Keep the attribution words. The b1 section's "not installed" assertions flip.

## The gates for (c) (§8.2) — in order

1–7 regression (the module, identity, the handlers over rows, the boundary, the version gate, the batteries, the owner's
saves through the census and the equipment oracle) · 8 the prompt (`node dev/capture-prompt-all.js <before>` on the committed
build, `<after>` on the tree, `diff -r`: only the `Wearing:` order may differ) · 9 the replays (the whitelist above; all four
change once) · 10 round trips on a save from BEFORE the change (a .tnd export and import; a library .char save, load and
companion import through the server; a checkpoint taken and restored; a cloud push from one preview profile and a pull on
another — the preview browser may be SIGNED IN: check the token first, sign out, never mutate owner state there) · 11 the skew
drill (the (b) build on a second port refuses a (c) save before effects and cannot publish over it; a throwaway pre-gate
build measures the residual class on a COPY) · 12 a live GM (a few turns on gemini-3.7-flash in a throwaway campaign: counts
on gain and loss, the counter refusing an equipped row, `[WORN:]` still landing) · 13 ONE independent review with the owner's
go (say so and stop; the (b) review ran 24 minutes and its closures took ~90) · 14 copy ownership (scratch rows never change
the live pack; refused trades leave all resources unchanged; repeated heal/prompt/load loops grow nothing).

## Before (c) is PUSHED — the owner's steps (§5.5, decision 1)

- The owner exports every live campaign from the desktop File menu (a .tnd per campaign) and a server volume snapshot is taken.
- `node dev/census-inventory-rows.js <folder of the exports> --all` reports zero unit loss and zero equipped mismatches.
- Only then the push; then the owner opens the game on every device (the (a) gate refuses the newer save on a stale tab until
  the reload, which is the designed behaviour).

## Owed to (c) by the review (not done in (b))

- Finding 14: the counter's mark key is the row's lowercase label (the ledger modal, the plan and the mark fixtures share it);
  with one key per row, key the marks by `itemKey`.
- The world-install doors (`worldState=` at load, import, pull, checkpoint restore) enter the registry in same mode (above).
- `pendingLegacy.inventory` (`checkLegacyCharacter`) goes through `invRows`.
- Rule 2 of the boundary contract (a hand-rolled count regex) is bypassable by `[xX]`, a literal space, `[0-9]` or
  `new RegExp` — a proof obligation, not a property of the table; a reviewer should look for it.
- Flaky under load at 16 wide, unrelated to #599: `sabotage-221-capability-names.js`, `sabotage-501-shop-button.js`,
  `sabotage-blueprint-publish.js` each failed beside others and passed alone. Look into it if it recurs.
- TODO #606 (a refused rename still moves the worn mark) is a separate small row on the tag path.

## Discipline that bit today (so it does not bite twice)

- The pre-commit hook runs the full gate (~3 min); `run-sabotage-diff origin/master..HEAD` (~6 min at 16 wide) BEFORE every
  push; several commits in a range re-run the same batteries, so land (c) as few commits as the §12 rule allows (one concern
  per commit, each green on master).
- A new contract that catches a mutation EARLIER than an old battery's test re-attributes that clause (four happened in b2,
  one in b5) — read the sweep's MISATTRIBUTED lines, fix the clause's `mustFail`, re-prove.
- The comment stripper is the ONE scanner `_stripComments` in run-tests.js (self-tested every run); never add a regex pair.
- Stage explicit files; commit `--only`; never `git add -A` (a parallel session shares the tree).
- The TODO row for #599 is at the cap: write to the status record, keep the row's verdict line short.

## Estimate

7–10 hours of wall clock in two sessions: the flip and the handlers 2.5–3.5 h; re-anchoring 1.5–2.5 h; replays, census,
round trips and the skew drill 1–1.5 h; live turns 20–30 min; the review and its closures 1–1.5 h; three or four sweeps.
Owner time: the §5.5 exports and snapshot, the device round trips, a look at the live turns, the go on the review.
