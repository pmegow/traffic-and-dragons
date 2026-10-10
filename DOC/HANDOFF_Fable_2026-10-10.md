# Handoff — Fable session 2026-10-09 (late evening) → the session that PUSHES #599 release (c) and starts (d)

**Read this when** continuing #599 after release (c) was built, reviewed and closed. Ephemeral per the trackers rule: open items
live in TODO.md; this file archives as DOC/HANDOFF_v<ver>.md when superseded. The previous handoff is DOC/HANDOFF_v1.1200.md.

## State

- **origin/master = `1438e811` (v1.1201):** the gemini-3.8-flash hotfix. Cloudflare serves it.
- **Local master, NOT pushed, four commits ahead:** `45f0d189` release (c) at v1.1202 (the shape flip); `18252a90` the sabotage
  pool's cap back to 8; `7352024f` the previous handoff; and **c2 at v1.1203** (`sw.js` CACHE `tnd-v3-20261009h`) — the review
  of (c) closed. A safety branch `backup-c-local` holds the pre-rebuild commits (0dcb1aba, 1cd2460b, e44418a6) — delete it once
  (c) is pushed.
- **Server v1.7.4 deployed.** Its one open measurement: the 3.8 explicit-cache floor (4096) is an assumption until the first 3.8
  row in `gemini_prompt_caches` shows a token count.
- **Tree:** clean except `website/art/trafficAndDragons_close.png` (another session's; never stage it).
- **Suite at c2:** 2875 engine assertions, 112 standalone suites, every contract green; `dev/sabotage-599c2-review.js` 29/29;
  every battery anchor applicable (2962 clauses across 320 batteries); gate 7 census 77 owner saves / 507 sheets / 11,490 items
  with 0 loss; the four replay baselines unchanged.

## What (c) measured on 2026-10-09 evening (the full record: the "Release (c)" entry of
[DOC/todos_completed/todo_599_status_history.md](todos_completed/todo_599_status_history.md))

- **Gate 10 green** — the owner's `The_Village__Ammut__Ammut_t279.tnd` (v10) through the import path on the signed-out preview:
  15 sheets rows at `sheetVer` 11, units/text/equipped identical, the panel and the sheet paint counts and "· worn", the export
  re-imports byte-identical twice, a camp taken and restored keeps every pack. NOT done (an account is needed): the library
  `.char` round trip through the server and a cloud push/pull between two profiles — the owner's.
- **Gate 11 green** — the (b) build (c0fe505d) on a second port refuses the (c) `.tnd` before any effect and refuses the v11 local
  keys at boot with the undismissable screen; the pre-gate build (v1.1191) accepts a copy and garbles it (`[object Object]` in the
  prompt and the panel, an empty Wearing line, a gain landing as a string beside the rows, a loss and a WORN no-op) — its export
  re-enters the (c) build losslessly. The harm of a pre-(a) runtime is the garbled prompt, not data loss.
- **Gate 12 NOT RUN** — no Gemini key in the session's shell and the playtest rule forbids pasting one. Owed to the owner: a key
  pasted into the signed-out preview (`http://localhost:8123` via `.claude/launch.json` "static"), or the owner's own first turns
  after the push — a gain and a loss with counts, a `[WORN:]` landing on the row, the counter's "Worn — take it off first", a
  `.tnd` export showing rows.
- **Gate 13 closed** — [audits/REVIEW_599_release_c_2026_10_09.md](../audits/REVIEW_599_release_c_2026_10_09.md): ten findings,
  no live defect on real data, every one closed test-first in c2. The c2 sweep also found a false proof since (c) in the 597
  battery (a no-op `wornPrune` mutation) and re-anchored it.

## Before the PUSH (§5.5, decision 1) — in this order

1. The owner exports every live campaign from the desktop File menu (a .tnd each) and takes a server volume snapshot
   (`flyctl volumes snapshots create <vol> -a traffic-and-dragons-server`).
2. `node dev/census-inventory-rows.js <folder of the exports> --all` must say CENSUS OK.
3. `node dev/run-sabotage-diff.js origin/master..HEAD` (the range holds the whole (c) commit — expect most of the tree's
   batteries, ~20–30 min at 8 wide; a flaky Chrome-driven battery passes alone) and the four
   `node dev/diff-replay.js dev/corpus_playtest_v12xx.json --check` (1238, 1258, 1271, 1276).
4. Push. Then the owner opens the game on every device (a stale tab refuses the newer save until it reloads — designed) and plays
   the gate-12 turns.
5. `git branch -D backup-c-local`.

## Then release (d) — EQUIPPED (§12 row d, §3.2–3.5)

`[EQUIPPED:Name|item|on/off]` joins the WORN handler (one handler, `[WORN:]` parsed forever); the on/off word lists gain
equipped/equip and unequipped/unequip; the STATE TAGS doc line teaches only `[EQUIPPED:]` and ends "as Equipped:"; the prompt
label `Wearing:` → `Equipped:`; receipts "equips" / "takes off" (no shared stem); the counter's "Equipped — unequip it first"
(decision 7); the ◆ mark in `--acc` before an equipped name with the name in `--t0` (§3.5); the two golden files re-baselined
(Fable-tier; the stable half changes once, so every campaign's cache resets — pair with #420 and #22b as separate commits in one
deploy if they are ready). Gate 8 then allows exactly the `Equipped:` label and the STATE TAGS line.

## Cleanup commit (after (d), its own commit)

The handlers' per-unit loops → counted `invAdd`/`invRemove` (the pair notes keep their per-unit meaning; c2's fragment carry
(`ilFrags`, `invCarryFields`) folds into one `invTransfer` that stages removal and destination acceptance together, §2.4);
retire the legacy delegate names (`wornPrune`, `wornRename`, `_wornIdx`, `foldDuplicateInventory`, the string half of
`sanitizeModelInventory`, `_invBase`, `_invCount`, `_invNorm` → `itemKey`) once every caller, test and sabotage anchor has moved;
the source pins on `wornPrune(` in tests-429 and tests-audit-ui go with them; the ledger's `wornPrune(c)` line is a no-op on rows.

## Discipline that bit this evening

- A test that reads a pack must use the both-shape readers (`inventoryCountOf`, `invEntries`): `invCount` is rows-only, and a
  companion pack that was never written is still the legacy strings — the first draft of the c2 take-pair test passed vacuously
  for that reason before it was caught.
- The harness stubs `saveCore`/`saveAll`/`showToast`; a test of a write boundary pins the source and checks the live object, and
  a test that counts toasts installs its OWN `showToast` ring (an earlier test can leave another stub on the global).
- A sabotage clause whose mutation is a no-op on the new shape proves nothing even though it changes bytes — the applicability
  scan cannot see it; only a real run says MISSED. Run every battery touching a changed file, not only the new one.
- The pre-commit hook runs the full gate (~3 min). `git add` explicit paths, never `-A`.

## Estimate

The owner's steps and the push: 30 min of the owner's time plus the sweep. (d): 3–4 h. The cleanup commit: 1–2 h.
