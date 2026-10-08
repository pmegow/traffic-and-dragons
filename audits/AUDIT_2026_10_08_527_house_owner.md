# #527(6): personal-name evidence for house ownership

Baseline c6c27652 / v1.1184. Scope is the house-owner inference lead only. Root owns marker/TODO updates, mandatory full gate and shipping.

## Root cause and correction

villageHouseOwnerFor treated every whitespace word in a resident's name as a possible owner after "of" or in a possessive. In "the house of the old miller", old therefore selected Old Maud. Through the shared place canonicaliser, an actual SUBLOCATION followed by LOCATION_DESC moved into and described Maud's existing house.

The fallback now rejects tokens in the existing null-prototype _NPC_STOP vocabulary alongside its original length guard. This reuses the identity definition of generic age, title, article and role words. Whole-name matches retain priority; personal words retain the same possessive/of requirement. Whitespace tokenization remains unchanged to avoid adding new partial matches inside hyphenated or apostrophe-bearing names. No aliases or identity merges are introduced.

Independent Astra critical pre-review approved this exact guard. Post-review APPROVE: 14 independent boundary assertions passed, including age/title and bare-position negatives, full/personal positives, hyphenated-name non-broadening and adventure exclusion.

## Failure-first and proof

Before runtime edits, 2/2 new engine tests failed: the old miller house actually filed as Old Maud's house, and the generic-owner matrix accepted it. Final focused tests: 2/2 green. The actual arrival test checks the miller's own description, exactly one new node, no inferred owner and byte-identical Maud house. Controls preserve full Old Maud/The Entity, Maud curly possessive/of forms, Venn's house, Captain Venn full name, hero house and adventure behavior; old/young/captain generic fragments are refused as owners.

Named mutations: 3/3 caught (remove generic guard; special-case only old; remove every partial match). Retained house-owner #482 battery: 5/5. Retained shared place-resolver battery: 6/6. Village section: 57 assertions green. Retained applicability: 2674/2674 clauses across 303 batteries. No retained source anchor changed. The existing bare-word mutation test gained "the Maud garden house" so it still proves that a meaningful personal word outside an owner position cannot claim a house after old becomes ineligible.

Read-only census: 31 parseable top-level testRuns .tnd files, zero instances of the reported phrase. This corpus does not reproduce the lead; actual engine failure-first fixtures are its evidence. No saves changed and no live/paid calls used. Full prompt capture and mandatory commit gate belong to root.

## Prompt and resources

No prompt wording changes. Corrected arrivals can alter volatile location and house context because they retain the place the GM named. Existing mapped-location aliases still take precedence under the place resolver contract; this is not a migration of previously misfiled history.

Per-call: one existing vocabulary lookup for each existing whitespace token. Per-turn: no new state. Per-session: no new caches or retained objects. Per-campaign: no new fields; existing map nodes file through the same writer, avoiding false owner assignment. Per-device: no storage, network, workers or listeners. Existing maps/guestbooks retain their established ownership and bounds.

Root integration: the Necrotic Dungeon, Village and Long Walk fixture prompts retain byte-identical stable and volatile halves against baseline 5751f292. Source saves remain unchanged.
