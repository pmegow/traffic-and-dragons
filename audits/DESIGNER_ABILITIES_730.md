# Authored creature and NPC abilities (#730)

Designer v0.70; engine v1.1395; cache tnd-v3-20261111b.

## Contract and review

The Designer had no dedicated abilities field. A creature generator would discard an unrecognized ability description, the assistant rejected the field, and replacement review patches could drop it. Blueprint NPC prose was not a character sheet: reusing the structured class-ability array contract would have made a text editor invalid.

`abilities` is optional prose on blueprint NPC and creature entries. It describes spells, special attacks, resistances and their authored limits. Custom-class and character-sheet ability arrays keep their existing shape. No new capability-bible definitions or deterministic combat rules are created by this field.

Independent pre-review selected typed entries in the existing protected NPC authored tier: `{source:"blueprint",field:"abilities",text}`. Fieldless entries remain notes. Dedupe and identity merge retain field identity; export separates notes from abilities, including an abilities-only NPC. This avoids stale duplicate NPC mechanics in the bestiary after an identity merge.

Independent post-review found that ordinary NPC detail is mention-triggered: a first encounter or unnamed combat could still omit abilities. A failing opening/combat test reproduced it. The final implementation serves a dedicated volatile NPC abilities block from the opening, with an explicit disclaimer of presence or encounter intent. Hot detail suppresses duplicate mechanics. The hero is excluded. Review also identified the old blanket ban on numbers; the authoring contract now preserves ability ranges, uses, durations, damage and resistance limits. Companion-sheet requests retain this authored guidance over generic class suggestions.

Final independent review approved the revised implementation and independently passed the nine engine and nine authoring test groups. No reviewer edits were made.

## Behavior

- Both editors have an Abilities textarea and expanded editor. The generic field router, portable export and IndexedDB autosave retain it.
- Generation, the assistant and review use the field; omitted replacement fields preserve existing abilities, while an explicit empty string clears them.
- Creature abilities live in the same stable bestiary entry and follow the whole-entry act gate. Ordinary turn, location and combat changes do not change that block.
- NPC abilities remain separate from learned facts and authored notes. Summary/knowledge churn cannot retire them; merge preserves identical prose stored under different fields.
- Enemy cards, portrait prompts, and the new subsection of player-facing Companion Talk exclude the private text. Appearance and creature-name rules are unchanged.
- Manual and imported Designer drafts keep their full text. The shared 800-character runtime prose cap and explicit Designer shortening workflow include abilities. Each NPC projection has its own 2,000-character budget with visible truncation. Total prompt cost scales with the authored roster; no per-turn or per-session data accumulates.
- Older blueprints and campaigns gain no field or prompt bytes. Existing campaigns retain their starting blueprint snapshot; editing a blueprint does not rewrite an existing campaign. Newly started campaigns use the authored abilities.

## Verification

Failure first: seven of the initial eight engine assertions failed; three of the initial five authoring groups failed; Chrome failed on the missing textareas. The review's additional opening/combat test and numeric-limit contract test also failed before correction. One browser fixture initially lacked an act, so validation stopped before its long-text assertion; the fixture was completed, retaining the assertion.

Final targeted proof: nine engine assertions, nine authoring groups, and real Chrome editing, expanded editing, autosave/reload, portable reload, phone layout and full overlong-draft retention. Desktop and phone screenshots were inspected under `testRuns/abilities-730/screenshots/`. No paid model calls were needed.

`dev/sabotage-730-abilities.js`: all 20 deliberate regressions were caught by their named assertions; each source was restored byte-identically. The test covers schema rejection, prose limits, seed/export, typed merge, first-encounter delivery, duplicate projection, long dossiers, private conversation/portrait exclusion, generation, review preservation, class-array typing and both UI fields.

The old #332 and #508 mutation anchors were adapted to the extended merge/dedupe signature and shared entity-preservation helper. Their original guarding assertions were retained and all 6 + 10 clauses were re-proven. No frozen hash was changed and no existing assertion was weakened.

Full `node dev/run-tests.js`: **3,237 engine assertions and 140 standalone verifier suites passed**. The new Chrome suite is registered in CI and participates in the mandatory pre-push browser gate.

## Prompt receipts

Read-only capture of the original `Campaigns/The_Silence_Between_Leaves__Kaelon_Sky-Breaker_/saves/*_t7.tnd`, before and after:

| Half | Characters | SHA-256 |
|---|---:|---|
| Stable | 58,963 | `4eaa1d72b0ae28721555b4dbd0d42552cd7e27a376430eef4ceace49f374d3b9` |
| Volatile | 26,659 | `4a3212fda7c2bf9833eea731e491224206bf91c2fc143ae27875ada7779db9e1` |

Both halves are byte-identical: no changed hunks. Captures are in ignored `testRuns/abilities-730/before/` and `after/`.

A detached copy of that save, `with-abilities.tnd`, adds one example creature ability and one typed NPC ability. Its two changed hunks are fully attributable:

1. Stable: +128 characters appended to the existing Mire-Gilded Stalker entry, labeled private ability guidance. No entry moved and no unrelated text changed.
2. Volatile: +293 characters in the new private NPC block for Prince Auden, including the no-presence/no-introduction instruction. Existing active NPC detail stays unchanged; the ability appears once.

Probe captures and unified diffs remain in `testRuns/abilities-730/`. The original save was never written. Browser behavior and exact published assets are checked after pushing; cloud CI and deployment are independent.
