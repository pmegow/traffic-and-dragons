# #528 — level-up integration proof and double-funded mana

The selected scope is the three #487 proof gaps in row #528: the hero level-up caller, archetype-only spell catch-up and mana growth at that caller. Other #528 gaps remain open.

## Cause and correction

A failure-first integration probe found an actual defect: a level-10 Rogue with Detect Magic, maximum mana 1 and current mana 0 gained Arcane Trickster spells and finished at 11/11 instead of 10/11. archetypeSpellGrant already funds its base spell additions through grantSpellsFromList. healAbilitySheets then used a maximum captured before that grant to fund the same growth again together with the later tier picks. The corrected caller captures its baseline after the base grant and before companionAutoPickSpells. Each grant funds its own spells once; spent mana stays spent.

Astra implemented the protected game.js correction after independent critical pre-review. The initial unused pre-grant read was removed. No helper rules, spell selections, class data or other level-up behavior changed.

## Verification

- Five standalone integration cases drive real production callers: hero level 4 to 6 preserves one canonical class ability and its gained timestamp while granting the new archetype row; Cleric archetype catch-up does not grant class spell unlocks; new archetype spells preserve spent mana; already-known base spells still fund newly selected tiers; an implicit-full absent mana field remains absent. Healed sheets remain byte-identical through eight repeat calls.
- The registered suite initially passed four cases and failed the exact double-growth case. All five pass after the correction. An initial hero fixture incorrectly expected model wording to survive; the existing abilityGrant contract intentionally installs canonical level-row wording, and the assertion was corrected before the registered failure-first run.
- Five named mutations caught: bypass the hero grant, remove the archetype filter, omit tier funding, restore the exact old pre-grant baseline timing, and use the post-pick maximum as baseline. An initial unsupported mutation callback was NOT APPLIED and not counted; its supported regex replacement restores the actual defect and is caught. Source restored byte-identically.
- Retained #487 mutations: 15/15. Retained `mana pool (#110)` section: 16 assertions. Applicability: 2671/2671 across 302 batteries. An unmatched #110b filter was rejected by the typo guard; the actual named section was then run successfully.
- Independent Astra post-review: APPROVE, 18 additional assertions across INT 10/18, absent/spent/full mana, legitimate tier grants and repeated healing. The hero/filter fixture oracles were separately inspected.
- Direct captures of the three standard campaign fixtures preserve both prompt halves. A broader comparison actually heals detached copies of all 77 campaign saves with old and corrected code: 64 resulting worlds are identical; 13 differ only in one companion's current mana. All 77 stable halves are identical. Those 13 volatile halves differ only in the numeric Mana value (the old implementation refilled to 29; corrected values retain the already spent amount). Every source save remains byte-identical. [Census](verification-next-ten-2026-10-08/528-save-census.json).

## Resources and scope

The fix moves one derived-number read and introduces no retained allocation, storage, timer, listener, loop or collection. Tests operate on fixtures and detached save copies; no personal save, library or provider request is written. The mandatory hook owns the full suite. Version, integrated gate and deployed checks are recorded in the [batch receipt](VERIFY_next_ten_known_issues_2026-10-08.html).
