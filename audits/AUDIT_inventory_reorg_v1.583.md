# AUDIT — Item-bible-driven inventory organization (TODO #157, v1.583)

**TLDR: Sol's spec implemented as specified — both inventory surfaces group through one bible-driven classifier with honest Unclassified containment, aliases resolve canonically (never UI-only), and the curation pass took the real save from 17% to 88% classified with every remaining miss recorded; drop-correctness and both-width legibility were live-fired on the actual 112-row inventory.**

- **Date:** 2026-08-09 · **Version:** v1.583 · **Spec:** [DOC/DOC_inventory_reorganization.html](../DOC/DOC_inventory_reorganization.html) (Sol, reviewed and adopted)
- **Order of work:** spec review → failing tests (9, all red) → schema → canonical alias resolution → shared view model → renderers → editor + modal → coverage tool → curation → visual ground truth.

---

## 1. Spec review — adopted with two recorded adjudications

The spec is sound end to end: registry-order precedence, the additive `inventoryCategories` array that leaves the scalar `category` contract untouched (keeping api.js/tag_table.js unedited, per its own danger boundary — honored: **neither file was touched**), Unclassified as a safety state distinct from Mundane, no fuzzy matching, one shared pure view model, sourceIndex-carried Drops, classification-only entries, and coverage-before-enablement.

**Adjudication 1 — aliases ship canonically now.** The spec flagged alias resolution as drift-surface-adjacent and demanded it never be a UI-only resolver. Implemented inside `itemLookup` itself (exact-after-`itemBaseName` hop, only after both exact-key probes miss), so grouping, tooltips, and the GM item-canon injection provably agree — engine-tested including the injection probe. Collisions (alias shadowing a live key; two owners claiming one alias) warn loudly once and EXCLUDE the alias: ambiguity resolves to nothing, and the item stays honestly Unclassified. Contract + editor validation + 3/3 sabotage.

**Adjudication 2 — curation respects the player-confirmed overlay ruling (2026-08-08).** The static bible gained *generic types* and *distinctively-named plot artifacts* only; nothing was bulk-written into the campaign overlay (`[ITEM_DEF:]` confirms remain the only overlay writer, now with the seven-checkbox modal). The spec's "ask-first" note on index.html styles is covered by the user's "implement it" green light; the CSS added is two heading classes.

## 2. What shipped

- **helpers.js:** `INVENTORY_CATEGORY_REGISTRY` (position = priority), `itemInvCategories` (legacy `[category]` fallback; invalid → null, never repaired silently), `_itemAliasIndex` (collision-checked, memoized on store sizes), the `itemLookup` alias hop, pure `groupInventory()` (exactly-once, sourceIndex, stable relative order, empty → `[]`).
- **Side panel (ui-panels.js):** grouped sections with independently collapsible headings (ephemeral page state, default open), badge stays the stored-row count, gold placement unchanged, multi-category tooltip line ("Categories: … · Filed under: …"), **the hard-coded weapon/armor substring guess is retired** — `.eq` emphasis now derives from the selected canonical section.
- **Sheets (ui-sheets.js):** the same groups inside the existing Inventory section (no nested collapse per spec §6.3); Drop buttons carry `sourceIndex`.
- **`[ITEM_DEF:]` confirm modal (ui-modals.js):** seven checkboxes seeded from the proposal, primary locked on; the checked set persists as `inventoryCategories` on acceptance in registry order. Tag grammar untouched.
- **bible_editor.html:** checkbox row + alias editor with pre-save collision errors; classification-only saves warn-then-confirm instead of hard-rejecting (spec §7.2); the serializer canonicalizes every entry to the fixed field order and normalizes legacy shapes structurally.
- **item_bible.js:** regenerated through the page's own serializer to the full six-field shape; **86 new entries** (weapons incl. two SRD-standard stat lines, tools, consumables, distinctively-named quest artifacts, treasure, mundane clothing/papers) + aliases for the save's prose-y surface forms ("two throwing knives, utilitarian, unworn" → `throwing knives`; the spec's own "small corked vial, violet residue" → the existing `corked vial`).
- **dev/item-bible-coverage.js:** read-only per-save audit (rows, unique names, direct/alias/invalid/miss, sections, per-owner misses). **dev/static-server.js + .claude/launch.json:** the zero-dependency preview server used for the visual gate.
- **Contract (dev/run-tests.js):** full-shape field set, `inventoryCategories` rules (non-empty, unique, valid, includes primary, registry order), alias rules (no key shadowing, one owner) — **sabotage-proven 3/3** (duplicate alias / out-of-order array / dropped field each fail the build).

## 3. Verification

| Check | Result |
|---|---|
| Failing-first | 9 engine assertions red before implementation (registry, precedence, legacy fallback, Unclassified containment, exactly-once + sourceIndex, alias canon + injection agreement, collision refusal, classification-only non-injection, ITEM_DEF array persistence) |
| Suite | **ALL GREEN — 1189 assertions** |
| Coverage (repaired t1593) | **17% → 88%** of 149 rows (120 direct + 11 alias; 0 invalid); evidence: [testRuns/item_coverage_t1593.json](../testRuns/item_coverage_t1593.json) |
| Deliberately LEFT Unclassified (18 rows, recorded) | ambiguous discs/scraps (stone/tarnished/carved disc, burned scrap, route/tally scrap, tidal/city sketch, ledger fragment, intake list, oilcloth bundle, compact-sealed letter, scholar's broadsheet, black iridescent feather, child's grey glove), `recovered goods` (placeholder blob), `confirmed loft position clear` (the #75a not-an-item sheet rot — cleanup is out of scope per spec non-goals) — upgrades ride in-game `[ITEM_DEF:]` confirms |
| Visual ground truth (real 112-row save over http, v1.583) | desktop: all 8 sections legible, weapon emphasis canonical, zero console errors; collapse: Weapons/Tools/Mundane fold 112 → 59 visible rows; mobile 375px: no horizontal overflow, headings + ellipsized names correct, alias-resolved "Wedding rings" filed under Treasure |
| Drop-correctness (the spec's named risk, live-fired) | visual row "Bone-handled knife" = stored row 15; confirm-gated (the first attempt proved the confirm gate works — `window.confirm` auto-false in automation); with confirm stubbed: exactly row 15 removed, neighbors intact, badge 112→111, both surfaces rebuilt |
| Unchanged by construction | stored inventory arrays/order/strings, exports, sync, tag mutation paths, api.js, tag_table.js — the spec's danger boundary held |

## 4. Carried forward

- Panel search/filter if 100+ rows still feel heavy after field use (spec §12's stated next step; more categories and fuzzy guessing stay rejected).
- Alphabetic in-section sort — deliberately unbundled from this change.
- The 18 recorded Unclassified rows upgrade one at a time through the (now multi-category) `[ITEM_DEF:]` player-confirm flow; `confirmed loft position clear` wants an inventory-cleanup pass someday (out of scope here).
