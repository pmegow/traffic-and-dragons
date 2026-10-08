# #542 — character epithet admission

Baseline: 5ec5ed91 (runtime v1.1188). Root owns release markers, tracker, full gate, commit and push. No personal saves, provider calls or live library writes were made by these tests.

## Mechanism and policy

Hero aliases previously bypassed identity admission at sheet imports/replacements and swaps. The alias tag handler ran before NPC introductions, so a new title could consume another character's planned name, and competing awards depended on response order. Readers also missed hero aliases in recurring-name detection and demoted hero sheet aliases in NPC resolution.

The shared exact, case-folded owner-claim scan compares hero, roster, sheet and memory spellings without invoking a resolver. Sheet doors validate before actor-specific writes; rejected blueprint entries also stay out of later authored-note and secret passes. The response plan protects forthcoming NPC primary names from hero awards and rejects competing title awards while preserving ordinary NPC alias-plus-introduction syntax. Graph canonicalization retains #538's shared endpoint boundary.

Critical pre-review by astra_nine_review approved atomic incoming-sheet rejection, preservation of loaded records, inactive ambiguous hero aliases, primary-hero protection, same-person copy deduplication, prospective swap claims, and response-wide preflight. Loaded malformed aliases use a typed read view, retain raw values and report a deduplicated diagnostic. Exact memory-only attachment is the same owner; case-variant new keys remain refused. Existing canonical NPC refresh can ignore only an inactive hero alias on its primary, never an additional incoming alias or the hero primary.

## Failure-first and focused evidence

- Immutable-baseline scratch probes: nine failing paths, one graph-alias positive already supplied by #538.
- Six original engine groups failed before runtime changes, then passed. Two later groups pin exact memory reattachment and the approved canonical-NPC-over-inactive-hero-alias relationship policy: nine engine groups now pass.
- Five actual startup/UI/replacement/load door groups pass; all five also fail when loaded against immutable baseline runtime bytes (supplemental baseline check, not a claim that these five were written before the runtime patch).
- Reviewer found object/string/mixed-element alias fields could crash or produce character claims. Two additional groups were written red first and turned green: twelve stored role-by-shape combinations plus malformed incoming refusal.
- Reviewer/root found the existing canonical NPC refresh still refused an inactive hero epithet. The eighth standalone group failed first, then passed with primary-only exception and conflicting extra-alias / hero-primary negatives.
- Final focused counts so far: #542 engine 9, standalone admission doors 8; retained #538 5, Village 57, blueprint 77, library update 6.

## Retained contracts and proof work

The #428 shared-adopter mutation anchor was updated equivalently for the new explicit success/failure return. All 17 clauses caught. Retained #427 14, W7 26, #504 55 and #538 11 also caught (123 retained clauses at that checkpoint; final #527 hero-cast battery adds four, for 127 total).

The old #538 shadow fixture's exact/case/player refusals remain. Its alias-equals-real-NPC case is superseded by the reviewed #542 rule: the loaded hero alias remains raw but inactive, the canonical NPC may own its relationship, and hero bytes remain unchanged. A new explicit #542 group tests that consequence. This is a documented policy refinement, not removal of the primary-hero guard.

The first new mutation run missed existing saved title competition; a companion sheet-only title fixture was added and the named mutation now fails. An initially ambiguous mutation anchor was made unique. Initial retained #504 checks exposed former-key canonicalization and refusal-order receipt differences; both were corrected while retaining the old proof. Village E13 exposed mistaken rejection of exact memory-only reattachment; it now passes without changing its assertions.

New named proof: 25/25 clauses caught, every source restored byte-identically. ES5 checker: 8 passed. Independent reviewer approved eight actual door groups and 24 repair/order assertions, then re-approved the final primary-only deactivation correction with six independent actual cast/identity assertions. Last applicability check: 2734/2734 clauses across 308 batteries; dry applicability is separate from executed mutations.

## Real data and prompt scope

Root's read-only raw JSON census: 77 Campaigns saves, zero hero alias entries, zero exact/case-folded alias/name collisions after grouping actor copies. Supplemental traversal: 4,141 alias fields, zero malformed non-array or mixed-type arrays. These are raw-data censuses, not runtime migration tests; artificial exact-failure fixtures supply the missing collision coverage. Root reports saved source hashes unchanged. Prompt capture is root-owned; stable prompt instructions were not edited here.

## Monotonic resources

Per call: claim lists and response plans are temporary, bounded by current actors/aliases and one response. Per turn: no growing history or latch added. Per session: no new cache, listener, timer or retained request. Per campaign: one persisted diagnostic fingerprint reflects current conflicts and is removed when clear; its size follows retained identities, not visits. Per device: no new store or library writes. Imports copy only admitted UI sheets; rejected source objects remain untouched. No WASM or media resource path changed.

## Final retained cast correction

The root full hook exposed the retained #527(4) Bone-boy fixture: both hero and master claimed the word as an alias, but the new blanket conflict predicate deactivated the hero alias and authorized the master. This differs from an NPC PRIMARY colliding with a hero epithet. A new actual cast/SAY group failed first. The shared hero reader now deactivates an epithet only for another owner's primary claim, preserving the explicit old hero-before-NPC-alias contract. Loaded raw conflicts still diagnose, and every new alias collision still refuses. Hero swaps release the old alias as before. Retained three hero-cast groups and new nine #542 groups pass; a named mutation restores the exact bad predicate. Reviewer independently re-approved six actual assertions. No general resolver widening was needed.

Root's final read-only prompt capture: all three standard campaigns' stable and volatile halves byte-identical to baseline5751f292, source hashes unchanged (TEMP tnd-next-ten-prompts-after542). Full release gate remains root-owned.

Final proof rerun: 25/25 new named clauses caught, including the exact Bone-boy predicate regression; all sources restored byte-identically. Retained hero-cast battery: 4/4 caught. Total retained clauses executed: 127. Runtime and review work paused for root shipping.

## Retained blueprint-secret proof repaired after remote CI

The b154db6b remote CI range sweep reported one missed mutation in sabotage-333-secrets: secret-only seed lost. Its test had already imported the NPC with ordinary notes and the secret, then cleared the notes and imported the same NPC again. Identity admission correctly refuses that duplicate, so the original secret survived and falsely vouched for the sabotaged seeding path.

The test now resets the world before its secret-only import. Independent Astra reproduced all four combinations: production passes both old and corrected fixtures; the exact secret-and-notes mutant passes the old fixture but fails the corrected one. The assertion and named mutation are unchanged. This is a strengthened verification fixture, not a runtime repair or a rebaseline.
