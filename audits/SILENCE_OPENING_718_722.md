# Silence opening disclosure boundaries — #718–722

Owner request, 2026-11-10. Baseline engine b8123445 / v1.1387; diagnosis anchors verified against that checkout. No paid model calls. TnD_Maps was not touched. The pre-existing untracked website illustration is outside this work.

## Diagnosis and critical pre-review

The original `ui-mobile.js` card copied notes verbatim. `api.js` injected every bestiary entry into its cached half and urged the GM to use them. `memory.js` already gated NPC secrets by exact act status; creatures had no equivalent. Rule 26 expressly blessed narrating true nature, and the skeleton fence omitted narration. `memoryTOC` treated every unvisited blueprint node as known. The blueprint offered no honest opening patrol combatant and exposed its disguised Raider from the start.

Independent Astra review examined cache ownership, canonical combat identity, schema producer/consumer paths, aliases, node provenance and transcript branches before implementation. No new retained collections are needed. A creature gate reads only its target act status; a public combat label never renames parser identity or implies an unmasking. Existing fields settle the schema: `desc`, `displayName`, `revealAct`, with existing `notes` remaining private.

Owner ruling: fix 4 applies **only to new campaigns**. No legacy location migration is authorized. Public labels remain the label throughout an encounter, even after the fiction exposes its nature; there is no new automatic rename/reveal lifecycle.

## Verification record

- #718 / v1.1388: the real renderer test and actual browser card failed first on GM notes. Removing the row passed both. Restoring it in the sabotage scratch clone failed the named test; original bytes restored. Full gate: 3,201 engine assertions plus 134 standalone suites. Browser gate: 27 suites passed. The first push encountered only a release-ledger commit; it was integrated without overwriting it.
- #719 / v1.1389, Designer v0.63: engine tests failed first on the withheld gate, numeric normalization, public labels, core-memory leakage and alias collisions; card and designer tests failed first too. Independent review added explicit victory/unknown-outcome closure, armored refusal and generated out-of-range gate tests; the browser found a raw name in the multi-foe statistics header. These failures were corrected at their presentation/admission boundaries. Canonical tag operands, armor state and slain identity remain intact. Fifteen named sabotage mutations cover the gate, completion, ordinary-turn cache stability, invalid gates, appearance, identity routing, ambiguity, close/refusal text, private card classification and generator admission.

No frozen hash was re-baselined. No existing assertion was loosened. Existing sabotage anchors in #508, #612, #718 and W2 were retargeted to equivalent refactored code; their failures and test names remain intact.

## Real-save captures

Local evidence is in `testRuns/silence-opening/` (ignored personal artifacts). `original-t7.tnd` is an untouched backup. `dev/capture-prompt.js` captured the real supplied save before code changes and after #719:

| Half | Before chars / SHA-256 prefix | After #719 | Explanation |
|---|---|---|---|
| Stable | 58,894 / `9cbd041167fa` | Identical | Legacy bestiary has none of the optional fields. |
| Volatile | 26,648 / `0dec5be9a74a` | Identical | No historical save rewrite. |

The original opening was reconstructed separately from the same hero and authored v1.0 blueprint with a fresh world/memory, turn 0 and start-place stamp. It is not a claim to recover lost initial hero statistics. Captures omit device-local customRules, as the stock capture tool does; the actual-blueprint engine test must separately apply the blueprint to include all nineteen rules.

Comparison captures also exist for Runelords t2477, Iron Meridian t207, Princess t89 and Village t291. All changed prompt hunks will be accounted for below when the remaining prompt changes are applied.
