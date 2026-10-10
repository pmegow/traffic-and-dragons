# #528 — the remaining proof gaps, closed line by line (2026-10-10)

Row #528 listed behaviour the week's commit messages (2026-10-01) stated that no test pinned: each line found by a reviewer mutating the shipped code in memory while the whole suite stayed green. The portrait lines closed 2026-10-07 and the #487 lines 2026-10-08. This record closes the rest: one test per line in the engine-tests section `#528 proof` (20 tests), one battery clause per line in `dev/sabotage-528-proof-gaps.js` (27 clauses, every one caught and attributed to the section).

## Method

Every clause was first run against the full suite WITHOUT the new section (a scratch clone of the working set with the new battery removed, so the applicability scan could not mask the result), to learn what already stood on 2026-10-10. Three outcomes:

- **Caught by an older engine test** — the gap had closed since the review (the #527 batches of 2026-10-08, #510, #481 C5, #519). The new test still stands as the line's own named pin; the battery attributes to it.
- **Caught only by the applicability contract** — a retained battery's anchor sits on the mutated span, so the suite went red on "find target is stale", but no engine test exercised the behaviour. A live gap in every sense that matters; closed by the new test.
- **Green** — nothing guarded the behaviour. Closed by the new test.

Then the battery ran with the section in place: 27/27 caught, source restored byte-identical, applicability 3056/3056 across 328 batteries, full suite 2927 green.

## The lines

| Commit / line | Mutation named | Before the new test | Now pinned by |
|---|---|---|---|
| c51d052 A4 | drop `e.world` from the final `fileSubLocation` | caught, incidentally — #527(17) and #527(19) (a thrown `hours` read) | `#528 proof c51d052 A4` (arrive-then-sub in one tag block files under the NEW world; the pointer moves only after the walker) |
| c51d052 A4, the census | "every test writes inline tags; the 1,323-reply census has no script" | — | `dev/census-tag-layout.js` (312 raw replies in the owner's saves, 95% in tag blocks; shipped with #518) and the block-form test above |
| 313b621 B4 | a frame at another node counts as here | **green** | `#528 proof 313b621 B4` |
| 313b621 B4, the #392 battery | the re-targeted clause carries no `mustFail` | — | `dev/sabotage-392-local-scene.js` runs the full suite with no attribution word on that clause; left as is — adding one is a separate re-anchor (noted, not a behaviour gap) |
| d42fd63 D2 | delete the `healStashRows` load hook | **green** (the old test called the healer directly) | `#528 proof d42fd63 D2` through `healMemory` |
| d42fd63 D2 | `_lpn=1` | **green** | `#528 proof d42fd63 D2` (a counted refused placement puts back every unit) |
| f1265cd C5 | the `attireRenderText` gate | **green** | `#528 proof f1265cd C5` (render) |
| f1265cd C5 | the `sceneFieldsCross` call (now the admission registry's scene step; `startGame` admits through `sheetAdmit`) | caught — `#481 C5` ×2 | `#528 proof f1265cd C5` (admission, cross vs same mode) |
| d3d4f86 C4 | the title note forced to ARC_COMPLETE | caught — `#527 continuation title advice` | `#528 proof d3d4f86 C4` |
| 172a202 #459 | drop the dnaHint scan | caught — `#527 skeleton prose register` | `#528 proof 172a202 #459` |
| 970a2bf B2 | the ask's "none means" sentence | **green** (the doc line was pinned, the delivered ask was not) | `#528 proof 970a2bf B2` |
| 2db7ac6 D3 | receipts printing the asked count | **green** | `#528 proof 2db7ac6 D3` (9998 torches + x3: `+Torch`, two refused) |
| 86698a8 D9/D1 | the companion move record | **green** | `#528 proof 86698a8 D9/D1` |
| 86698a8 D9/D1 | `units` fixed at 1 | **green** | same test (two potions, two units) |
| 86698a8 D1 | the actor filter | caught — `#519` (the hero swap) | same test (the mover leaves the party) |
| 86698a8 D1 | the pack check | **green** | same test (the pack half gone) |
| 86698a8 D1 | the "no longer where" refusal | applicability only (`sabotage-481-d1-d9-move-record.js`) | same test (from another place) |
| 594cf54 | `tradeRefusedPing` in the withheld-sale branch | caught — `#510 the repro` | `#528 proof 594cf54` (the ping and the nudge) |
| 6ef870e | the bad-coin branch | gone — #598 lands any unit; no branch to pin | — |
| 6ef870e | "an empty purse writes no spend receipt" | applicability only (`sabotage-481-d5-coin.js`); the old `#481 D5` pin tested `-0 gp` and the mutation prints the signless `0 gp` | `#528 proof 6ef870e` (no coin line at all; only the overspend) |
| 91e50ea B4 | the party-member refusal | caught — `#527(19)` | `#528 proof 91e50ea B4` |
| 91e50ea B4 | roster-name storage | applicability only (`sabotage-481-b4-keeper.js`) | same test (`[SHOP_KEEPER:frizwick]` files "Frizwick") |
| 1bbf9f6 D8 | the queue-overflow line | **green** | `#528 proof 1bbf9f6 D8` |
| 5e9a116 #437 | the want toast | caught — `#347` | `#528 proof 5e9a116 #437` |
| 5e9a116 #437 | the settled-purpose toast | **green** | same test |
| a2ddcec #490 | the re-route receipt | **green** | `#528 proof a2ddcec #490` |
| 605b557 B6 | `!wh.home` | **green** | `#528 proof 605b557 B6` |
| 605b557 B6 | the presence clause | **green** | same test |
| 36f6139 C11 | the companion-sheet sentence cutter | **green** | `#528 proof 36f6139 C11` |
| 71a6e3d #469 | the game.js gate | source pin only (`#469 sendAction arms motifPing…` reads the source) | `#528 proof 71a6e3d #469` (a live `commitGmTurn` arms the ping) |
| 1fe790d | "8/8" of a nine-clause battery | a commit-message error; nothing to build | — |

Two fixture lessons: a test placed before the section that assigns a shared `var` (the keeper section's `B4K_POST`) reads `undefined` — name the node; and a scope's toast ring is fed by whichever stub was installed last, so a test that asserts a toast installs its own stub and restores it.

## Resources and scope

Tests and tooling only; no runtime file changed in this commit. The scratch scan clones once and runs the suite per clause (27 full runs); nothing wrote to the repository. The battery restores its scratch files byte-identically.
