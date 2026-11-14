# Public maps: terrain, accumulated exploration and discovery recovery

Owner request, 2026-11-14: fix all three map defects, keep undisclosed features hidden, exercise rendered travel and publish. Implementation based on Fable's fully pushed `56b6f036`; FORM remains at 128 handlers. No tag-table or GM prompt-builder changes.

## Causes and behavior

The public adapter discarded landscape entirely, sent only neutral landmark pins to the library, and exposed one mutable sheet under the campaign seed. Movement changed that sheet's contents instead of retaining explored places. A separate admission bug passed *proposed* map declarations to the extraction deduplicator even when their entire transaction was refused, suppressing valid discoveries from public narration.

`atlas-public-places.js` stores up to 1,024 visited public sheets separately from procedural recipes. IDs remain stable across returns; identity merges coalesce the selector without moving feature handles or notes. Recovery reads only the current public place, positive visits and public receipt containers. Unvisited seeded nodes and private descriptions never qualify. A damaged registry is preserved and refused, not reconstructed silently. Foreign campaign memory is refused. Atlas v3 and world save v14 keep the preceding client from writing away the registry.

`atlas-public-landscape.js` supplies only explicit landscape enums derived conservatively from whole public place names and observed public labels. Forest Road supports woods and a road; River King's Inn and Forest Gate Tavern do not. Reported landscapes do not paint terrain. Unplaced route features remain in the readable list. The library draws illustrative woods, clearings, marsh, water, hills, grass and short route samples. It neither chooses names nor invents buildings or route connections. Geography remains schematic and unmeasured.

The pane follows actual travel and retains the selected historical sheet through stationary updates. Each historical document, card and note uses its own scope. The party marker is shown only where the party currently stands. The location breadcrumb continues to describe the party's current location, as before. Capacity refusal leaves existing sheets intact and does not claim the party is still in its previous place.

`atlasKnowledgeCommitResult` exposes the atomically accepted declarations and a classified refusal. Only accepted declarations suppress narration extraction. A refused foreign-place handle therefore cannot hide an independently quoted bridge; malformed, nested, changed or tampered source material still fails closed. Accepted explicit declarations and renames keep precedence. The extraction request now also retains a literal broad landscape phrase when narration establishes one; no new call or output schema is added.

## Evidence

Failure-first engine assertions reproduced both the replaced-only-sheet and absent-forest failures. A real browser served the original `56b6f036` files and reproduced the owner's empty Forest Road, unplaced entries and Mapped places (1). The mobile browser gate exercises actual LOCATION/SUBLOCATION turn commits, three locations, selecting an older map, editing its note, stationary discovery while browsing, a return trip and save/reload. Independent rendered review caught a small-label case that the library's differently identified fixture missed; its exact feature IDs are part of the acceptance case.

The original Maren turn-37 save and turn-38 response replay recovered the Gatehouse and three birch stakes (27 to 29 features), while the rejected original handle and saved input files remained byte-identical. Both stable and volatile GM prompt halves are byte-identical against `56b6f036` on all 14 real campaigns after the actual load migration. No paid model requests or original campaign edits were needed.

## Independent review and release gates

Independent implementation review approved the final admission, registry, host and library changes. All nine actual-game browser groups pass, including visible non-overlapping labels at least 14px on the exact 390px phone fixture. The camera return failure and original empty-map failure were captured before their corrections. `dev/tests-744-map-browser.js` also has an optional read-only production mode: every fetched static asset is SHA-256 compared with the local release, then the same isolated travel sequence runs against those deployed bytes.

The new public-data suite has 12 groups; its 19 named mutation controls pass. Admission has 36 named mutation proofs; the prior public adapter's 15 and migration boundary's 22 remain proven. All 14 campaign prompt comparisons remain byte-identical. The four frozen replay oracles were independently compared with Git before replacement: each changes only byte 14, ASCII 51 to 52 (`ws.ver` 13 to 14); every other byte, length and gameplay value is unchanged. The existing assertion names and failure mechanisms remain intact when save-version and sheet-guard mutation anchors are updated.

Game release gates: `node dev/run-tests.js` (3,344 engine assertions and 151 isolated standalone suites), the tracked commit hook, and all 37 registered browser suites before pushing. The deployment verifier checks the exact production commit; the production browser run verifies served bytes and the complete travel flow. Local logs and before/after screenshots are retained under `testRuns/map-744`.

Library v0.22.0 is committed and pushed as `a1930af1460a7d9ae44210f34d1bac2034c84b6f`; vendored SHA-256 `ba14a5c5a2e931e3071ebbea239a519cc7e71f2da55d7d22cf2af846442f33d8`. Full library gate passed: 19 added logic groups, 20 preserved legacy output comparisons, 10 added browser groups and four mutation controls. Two pre-existing cave-annex tests reported inapplicable geometry skips; all map-transition cases ran.

The broader #733 transition remains separately tracked. This release does not infer a geographically measured world layout from exploration order.
