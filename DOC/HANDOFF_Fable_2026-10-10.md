# Handoff — Fable session 2026-10-09 (evening) → the session that FINISHES #599 release (c) and starts (d)

**Read this when** continuing #599 after the shape flip was built. Ephemeral per the trackers rule: open items live in TODO.md;
this file archives as DOC/HANDOFF_v<ver>.md when superseded. The previous handoff is DOC/HANDOFF_v1.1200.md.

## State

- **origin/master = `1438e811` (v1.1201):** the gemini-3.8-flash hotfix (Google deprecated 3.7-flash on 2026-10-09; the 3.6-flash
  storm rung stays — the owner confirmed 3.6 is still live). Cloudflare serves it.
- **Local master, NOT pushed:** `45f0d189` release (c) of #599 at v1.1202 (`sw.js` CACHE `tnd-v3-20261009g`), then `18252a90` the
  sabotage pool's default cap back to 8 (16 was tried for a day; the numbers are in dev/battery-pool.js). A safety branch
  `backup-c-local` holds the pre-rebuild commits (0dcb1aba, 1cd2460b, e44418a6) — delete it once (c) is pushed.
- **Server v1.7.4 deployed** (36bafaf + the deploy note 2a97c25, pushed): the explicit-cache floor for 3.8. Its one open measurement:
  the 3.8 floor (4096) is an assumption until the first 3.8 row in `gemini_prompt_caches` shows a token count.
- **Tree:** clean except `website/art/trafficAndDragons_close.png` (another session's; never stage it).
- **Suite at 45f0d189:** 2863 engine assertions, every contract, every standalone suite green; `dev/sabotage-599c-shape-flip.js`
  28/28; the tree sweep (154 batteries) green; gate 7 census 77 owner saves / 507 sheets / 11,490 items with 0 loss; gate 8 over the
  9 owner campaigns with only three `Wearing:` lines reordered; gate 9's four replay baselines re-generated and proven by
  `dev/check-replay-rebaseline.js`.

## Read first, in this order

1. The "Release (c)" entry of [DOC/todos_completed/todo_599_status_history.md](todos_completed/todo_599_status_history.md) — what
   landed, where, and what each gate measured.
2. The commit message of `45f0d189` (`git show -s 45f0d189`) — the same, with the WHY.
3. [DOC/DESIGN_599_inventory_rows.md](DESIGN_599_inventory_rows.md) §8.2 gates 10–14, §5.5, §12 rows (c) and (d).
4. [DOC/contracts/sync.md](contracts/sync.md) "Save v11 — the row form, and the load as a door" and CLAUDE.md's `inventory.js` and
   `admission.js` rows — the contract as it now stands.
5. CLAUDE.md: the drift decree, the sabotage rules, the version rule, the TODO rules.

## What is owed for (c), in order (§8.2)

**Gate 10 — round trips on a save from BEFORE the change.** Use `Campaigns/<slug>/saves/*.tnd` from before 2026-10-09 (every one
is v10 strings). The preview browser may be SIGNED IN to the owner's account: check the token first (`tnd_server_token`-class keys),
sign out, and never load an owner campaign into a signed-in page — it would sync. In a throwaway campaign on the preview:
a .tnd export and import (File menu) → the pack is rows, `ver` 11, the panel and the sheet paint counts and the "· worn" marks;
a checkpoint taken (Rest) and restored (a death) → rows survive the restore; a library .char save, load and companion import
through the server and a cloud push from one preview profile with a pull on another need an account — those are the OWNER's,
or the reviewer's brief. Record what was done and what was not.

**Gate 11 — the skew drill.** Serve the (b) build (`git worktree add <scratch>/wt_b c0fe505d`, any static server) on a second port
beside the (c) build; export a (c) save; import it on the (b) port: the (a) gate must refuse before any effect ("written by a newer
version of the game"), the refusal screen or toast shows, and no push leaves that device (the publication lock). Then a throwaway
PRE-GATE build (any commit before v1.1194, e.g. `git worktree add <scratch>/wt_old 71fe9b81~20`) loads a COPY of a (c) save to
measure the residual class — read-only on the original, never an owner save.

**Gate 12 — a live GM.** Signed-out preview, a throwaway campaign, provider gemini / `gemini-3.8-flash` (the $25/week allowance
covers it): a gain and a loss with counts (`[ITEM_GAINED:Arrow x12]`, `[ITEM_LOST:Arrow x5]` → one row, qty 7), `[WORN:Name|item|on]`
landing on the row, the counter (a village campaign) refusing an equipped row with "Worn — take it off first", a `.tnd` export at
the end showing rows. Read the result from state, not the prose.

**Gate 13 — ONE independent review, with the owner's go.** Brief one Opus agent, read-only, adversarially, on `45f0d189` and these
spots in particular: `invPrepare`'s junk policy (junk kept verbatim beside rows on a bare list; a repair refuses), the load door's
all-or-nothing and its `ver` stamp, the portrait gate now running at load (`portraitAdmit` drops a non-image portrait on this
campaign's own sheets — measured 0 on the 9 newest owner saves), `invEquippedNames` on a mixed sheet, `invApplyLines` (the Sync
modal) and its ambiguity rule, the marks by `itemKey` of the entry NAME, `worldSheetsOf` covering every sheet a world carries,
the census oracle's independence from the converter, the replay re-baseline whitelist, and the handlers' per-unit loops over
the delegates. The (b) review ran 24 minutes and its closures took ~90; close every CONFIRMED item test-first in a `c2` commit.

**Before the PUSH (§5.5, decision 1):** the owner exports every live campaign from the desktop File menu (a .tnd each) and takes a
server volume snapshot; `node dev/census-inventory-rows.js <folder of the exports> --all` must say CENSUS OK; then
`node dev/run-sabotage-diff.js origin/master..HEAD` and the four `node dev/diff-replay.js dev/corpus_playtest_v12xx.json --check`;
then push; then the owner opens the game on every device (a stale tab refuses the newer save until it reloads — designed).

## Then release (d) — EQUIPPED (§12 row d, §3.2–3.5)

`[EQUIPPED:Name|item|on/off]` joins the WORN handler (one handler, `[WORN:]` parsed forever); the on/off word lists gain
equipped/equip and unequipped/unequip; the STATE TAGS doc line teaches only `[EQUIPPED:]` and ends "as Equipped:"; the prompt
label `Wearing:` → `Equipped:`; receipts "equips" / "takes off" (no shared stem); the counter's "Equipped — unequip it first"
(decision 7); the ◆ mark in `--acc` before an equipped name with the name in `--t0` (§3.5); the two golden files re-baselined
(Fable-tier; the stable half changes once, so every campaign's cache resets — pair with #420 and #22b as separate commits in one
deploy if they are ready). Gate 8 then allows exactly the `Equipped:` label and the STATE TAGS line.

## Cleanup commit (after (d), its own commit)

The handlers' per-unit loops → counted `invAdd`/`invRemove` (the pair notes keep their per-unit meaning); retire the legacy delegate
names (`wornPrune`, `wornRename`, `_wornIdx`, `foldDuplicateInventory`, the string half of `sanitizeModelInventory`, `_invBase`,
`_invCount`, `_invNorm` → `itemKey`) once every caller, test and sabotage anchor has moved; the source pins on `wornPrune(` in
tests-429 and tests-audit-ui go with them. Finding 14 of the (b) review (the counter's mark key) is moot under I2.

## Discipline that bit today

- The pre-commit hook runs the full gate (~3 min); a cherry-pick commit runs it too. `git add` explicit paths, never `-A`.
- `dev/scratch-contract-sabotage.js` clones HEAD and copies only the working `run-tests.js`: an UNCOMMITTED contract rule plus
  uncommitted engine changes reads as MISATTRIBUTED across its batteries until the commit. Not a defect; commit, then re-prove.
- The mechanical re-point of string-shape test reads (`.inventory[N]`, `.join(`, `.indexOf(`) through `invTextList` missed locals
  (`var b=…charSheet.inventory; b.indexOf(…)`) — one such read made the #510 pairing test pass vacuously and its battery MISSED.
  When a sweep says MISSED after a shape change, suspect a vacuous read before suspecting the guard.
- Three batteries flake beside others at 16 wide (272, 547, blueprint-publish — Chrome-driven); the pool is back to 8.
- Gate 8's before-capture needs a worktree at the previous engine (`git worktree add <scratch>/wt_before <commit>`) and the
  Campaigns folder passed as the second argument; remove the worktree after.

## Estimate

Gates 10–12: 1–1.5 h (the browser half). The review and its closures: 1–1.5 h. (d): 3–4 h. The cleanup commit: 1–2 h.
Owner time: the exports and snapshot, the device round trips, the go on the review, a look at the live turns.
