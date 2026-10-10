# Handoff — Fable session 2026-10-09 (night) → the session that reviews and PUSHES the (d) deploy, then does the cleanup commit

**Read this when** continuing #599 after release (d), #607 and #608 were built. Ephemeral per the trackers rule: open items live
in TODO.md; this file archives as DOC/HANDOFF_v<ver>.md when superseded. The previous handoff is DOC/HANDOFF_v1.1203.md.

## State

- **origin/master = `82a53b63`** (release (c) at v1.1203 plus the #607/#608 filings). Cloudflare serves it.
- **Local master, NOT pushed, five commits ahead** — one deploy, four concerns:
  - `a59b9ab4` **#599 release (d) EQUIPPED, v1.1204** — `[EQUIPPED:]` the taught tag, `[WORN:]` its permanent alias (ONE handler
    registered as EQUIPPED, WORN in `TAG_NO_HANDLER`); equip/unequip words; "equips" / "takes off" receipts; the `Equipped:` prompt
    line; "Equipped — unequip it first" at the counter and the chest; the ◆ mark (`invEquippedMarkHtml`, helpers.js) in the panel
    and on the sheet; both goldens re-baselined (the stable half moves once at this deploy).
  - `c3e17db8` **#607 Jewelry, v1.1205** — one registry entry; `invCategoryIds()` is the one derivation for the ITEM_DEF parse and
    doc line, the define prompt, the editor's lists and header, the run-tests bible contract; seven bible entries re-filed (jewelry
    first, the old category kept as a secondary membership); the doc golden moved again in the same deploy.
  - `ce0e2a4e` docs: gate 12 of (d) green (two live gemini-3.8-flash turns; the model wrote `[EQUIPPED:]` in its own spelling).
  - `e1ede5bc` **#608, v1.1206**: `invDisplayOrder` — equipped first in pack order, then alphabetical by
    decoded key, ties by stored index; applied by `groupInventory` for both shells; the prompt capture byte-identical.
- **Tree:** clean except `website/art/trafficAndDragons_close.png` (another session's; never stage it).
- **Gates at the last commit:** 2887 engine assertions, every contract green; `check-sabotage-applicability` 2995/2995 across 323
  batteries; the new batteries `sabotage-599d-equipped.js` 20/20, `sabotage-607-jewelry.js` 8/8, `sabotage-608-display-order.js`
  5/5; `run-sabotage-diff HEAD` green before each commit (the three editor batteries read MISATTRIBUTED only on the uncommitted
  two-file #607 change — TODO #609 — and 15/15 once committed). Gate 8: before→(d) only the STATE TAGS line and
  `Wearing:`→`Equipped:`; (d)→#607 only the ITEM_DEF doc line and the category word on the ITEM CANON line of the two re-filed
  entries that carry an effect; #607→#608 byte-identical.
- **The owner's preview origins:** `localhost:8123` (the other chat's static server) still holds the owner's Gemini key and a
  throwaway import of the Village t291 save at t293 (signed out — nothing synced); `localhost:3000` (this session's) holds a
  throwaway import too. Neither touched an owner campaign.

## Gate 13 — DONE (2026-10-09 night): nine findings, closed as d2 v1.1207

The receipt is [audits/REVIEW_599_release_d_2026_10_09.md](../audits/REVIEW_599_release_d_2026_10_09.md). The one live
behaviour change (#607 had cost the plain rings treasure's Define exemption) is closed by ONE predicate, `itemDefCategoryExempt`
(helpers.js) — the owner flips it there if rings should be defined after all. The sweep's due-selection missed every battery
that names its target through `prove("file", …)` (78 for this range); `dev/battery-targets.js` is the one reader now and the
whole-deploy sweep was re-run with it. Note for every later range sweep: a battery clause caught by an EARLIER gate (a contract)
must name that gate in `mustFail`, and MISATTRIBUTED exits 0 — read the verdict lines.

## Before the PUSH (§12 row (d): gate 13 with the owner's go) — the steps as they stood

1. **Gate 13 — ONE independent review of the whole deploy** (release (d) + #607 + #608), read-only on the five commits, with the
   owner's go (the review-before-push rule: one per batch, ~0.5–1M tokens). Findings close test-first as a `d2` commit, as (c)'s did.
2. `node dev/run-sabotage-diff.js origin/master..HEAD` and the four replay `--check` baselines (unchanged by (d) — prove, do not
   assume), then push. Every campaign's prompt cache resets once (the stable half moved twice in one deploy, on purpose).
3. The owner RELOADS the game on every device BEFORE playing a turn there (review finding 8: a stale build in the service-worker
   window drops a `[EQUIPPED:]` the GM copies from a cloud-synced newer reply with one console line, and files `category=jewelry`
   as tool — no version gate fires for a vocabulary change; the window is the first navigation after the deploy and any unreloaded tab).

## The cleanup commits (§12 notes) — part 1 SHIPPED v1.1209; part 2 WITHDRAWN by the owner's ruling of 2026-10-10 (a move stays two tags; no `invTransfer`)

**Part 1 (v1.1209):** the delegate names retired (`wornPrune` had SIX callers, not four — the two item-loss handlers too; the four
writers heal through `invHealSheet` where it stood because the 429 sheet suite proved the hidden heal load-bearing on an unhealed
fixture), `_wornIdx` folded into `isWorn`, `foldDuplicateInventory` retired, `_invNorm`/`_invBase`/`_invCount` renamed to
`invStoredKey`/`invStoredName`/`invStoredCount` (a rename, not the convergence to `itemKey` — the callers hand it stored strings
with counts), the ledger rows' `worn` → `equipped`. `sanitizeModelInventory` stays: it is the model faucet, not a delegate.

## The census as it stood before part 1 (2026-10-09)

Two single-concern commits are honest here, both Fable-tier (the handlers are the drift surface):

- **The legacy delegate names retire.** Callers today: `wornPrune` — game.js, tag_table.js, ui-modals.js, ui-sheets.js, 5 test
  pins (engine-tests ×2, tests-429 ×1, tests-audit-ui ×2), anchors in `sabotage-429-inventory-drop` and `sabotage-597-ledger-direct`;
  `wornRename` — tag_table.js ×2, 1 test; `_wornIdx` — inventory.js only (fold into `isWorn`'s legacy branch); `foldDuplicateInventory`
  — inventory.js, 12 test refs; the string half of `sanitizeModelInventory` — game.js, ui-sheets.js, 13 test refs; `_invBase` /
  `_invCount` / `_invNorm` → `itemKey` — inventory.js, api.js, game.js, 33 test refs, anchors in the 599b, 599b3, 599b4 and 599b5
  batteries. Plus the ledger rows' internal `worn` field → `equipped` (helpers.js `shopTradeCatalog`/`shopLedgerRows`/
  `stashTradeCatalog`/`stashLedgerRows`/the two plans, ui-modals.js reads `r.worn`; the (d) tests pin the wording, not the field).
- **The handlers' per-unit loops → counted `invAdd`/`invRemove`, and c2's fragment carry (`ilFrags`, `invCarryFields`) → one
  `invTransfer`.** A semantic change on the pair notes (#518 reads them per unit) — write the failing test first for a partial
  landing (3 of 5 land, the rest refused on their own ⚠ line) and for a give whose fragment carries fields.

## Also open

- **#609 SHIPPED** (38a41743) and **#420 SHIPPED** (v1.1210) on 2026-10-10 after the owner's go — the bullets below are as they stood.
- **#609** (filed this session): `dev/scratch-contract-sabotage.js` mirrors only the mutated file — bring it to sabotage.js's
  `mirrorWorkingSet`. Opus-safe dev tooling.
- **#420 / #22b** were not paired with this deploy (not ready); the stable half will move again when #420 lands.
- The owner's saves hold six emergent jewelry-named canon entries filed as tool/quest (listed in TODO #607) — a save's overlay wins,
  so they stay unless re-filed by hand in the campaign.

## Discipline that bit tonight

- The Bash tool halves backslashes: `grep -c $'\r'` counted the letter r and "proved" CRLF files that are LF. Line-ending facts
  come from `git ls-files --eol`, and edit scripts go through the Write tool.
- A battery clause caught by an EARLIER gate (the BIBLE EDITOR CONTRACT before any engine test) must name that gate in `mustFail`;
  the harness exits 0 on MISATTRIBUTED, so read the verdict lines, not the exit code.
- `run-sabotage-diff HEAD` (one revision, not a range) sweeps the uncommitted working tree.
