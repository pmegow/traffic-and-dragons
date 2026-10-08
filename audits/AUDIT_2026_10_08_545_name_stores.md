# #545 — name-keyed stores

Status: integrated on released 90c53126 and independently source-reviewed for the v1.1191 checkpoint; mandatory commit hook remains the final shipping gate. Covers the store redesign requested by #536, #540 and #541. No reserved-word filter is added.

## Mechanism and scope

Plain objects previously let model-written names resolve through `Object.prototype`. The same bug affected persistent dictionaries, temporary indexes, static registry reads, and dictionaries restored by JSON parsing. An `__proto__` NPC could mutate shared object machinery, while `constructor` could become an inherited function instead of a record.

The implementation uses one dictionary factory and an explicit schema in helpers.js. The schema names memory dictionaries (NPCs, places, quests, map nodes, location identity, guestbooks and source maps, faction maps and the archive), world overlays and keyed latches, and portable sheet dictionaries. It follows only own schema segments. Arrays, histories, fixed records and unknown own fields keep their existing shape and serialized values. Static registries use own-entry reads. Safe shallow copies preserve unknown own fields without invoking a prototype setter.

Admission includes blank memory, parsed world and memory, legacy missing fields, imports and server reconciliation, checkpoint restore, detached canon transactions, library sheets, generated attachments and the character editor. Temporary name/word indexes use the same dictionary shape. The capability bible remains callable by itself using the native own-property predicate; no earlier loader gains a helpers dependency. One isolated storage-adapter test now loads its real helpers dependency, matching all production hosts.

## Failure-first and verification

The `#545 name-keyed stores and prototype isolation` engine section contains 17 assertions. The original six failed before implementation. Further exact failures were captured for item-pair buckets, inherited category lookup, held ware lookup, checkpoint restoration, legacy missing map/graph creation, the character editor, and generated sheet attachment. Current focused section passes.

The unchanged historical p02 oracle ran 66,564 word/control pairs (270 templates, 43 decorations). Its first redesigned pass removed prototype poisoning; later passes resolved the remaining temporary-index failures. The third pass took 73 seconds and reports no poisoning, handler errors, prompt errors, serialization errors or throws. Its 650 flags are fully adjudicated by `dev/adjudicate-545-census.js`, which reruns every exact case and compares complete state, receipt and prompt facets rather than trusting truncated oracle snippets: 564 legitimate own reserved-name keys with no behavioral differences, and 86 identical quarantined transactions differing only in the expected normalized fingerprint spelling (`proto` versus `proqo`, including decorated forms). The oracle replaces whole raw names, so it does not equate those normalized spellings. No unexplained differences remain in that census.

The original held p03–p22 scripts also ran unchanged, with the documented replacement for their missing historical harness. The 1,236-reply p19 replay has byte-identical summary and final-state fingerprints against 65fbf748 across every corpus. Both runs report the same one preexisting handler error. Summary-death probes still reject absent matching scene evidence, including the ordinary Bram control; that existing safety rule is not weakened. The extra nine Object.prototype names cover another 199,692 pairs. Per-name runs avoid the old p10 output cap; all 2,041 flags were replayed against their ordinary-name twins with entire state, receipt and prompt comparisons. They comprise 1,607 legitimate own keys, 74 existing dice-outcome truncations, 16 existing sound-warning truncations and 344 normalized transaction fingerprints. No unexplained differences, poisoning, handler errors or throws remain.

`dev/verify-545-corpus.js` reads all 77 owner saves without writing them. Actual load, save and reload use detached in-memory storage. Against 65fbf748, all state hashes and both prompt halves are identical; source hashes remain unchanged.

`dev/tests-545-boundaries.js` exercises standalone capability lookup, real load/save/reload, import, checkpoint restore, chunked compression, detached world/memory copies and repeated normalization. One thousand repeated normalizations preserve the exact dictionary references and serialized bytes; the small synthetic fixture took 6–7 ms. No history array is cloned by normalization.

`dev/tests-545-browser.js` drives real browser Catalog, My Library and Import File selections through campaign start, a tag and the next prompt. Home handoff, Quick Start, Designer load/render/validate and character-editor admission also pass. Storage is a disposable profile; remote calls are intercepted. No personal campaign, library, credential or paid provider is used.

At the historical pre-integration checkpoint, thirteen new named mutation clauses passed and nineteen affected retained batteries passed 381 clauses. That isolated source reported applicability of 2,710 of 2,710 clauses across 307 batteries. One retained full-gate mutation exposed an isolated storage-adapter test missing the real helpers dependency; adding that dependency repaired the harness, and its nine assertions plus all 27 serialization-diet mutations then passed. Those historical results precede the final integration described below.

## Resource review

- Per call: only declared dictionary containers are copied when their prototype needs repair. Own-entry reads are constant time. Temporary indexes retain their previous input-bounded size.
- Per turn: detached transactions already pay their JSON clone cost; normalization restores only the declared dictionaries on that clone. It does not copy transcript or historical arrays. Normalized live dictionaries retain their references.
- Per session: no new cache, timer, listener, queue or retained response is introduced.
- Per campaign: dictionary keys and serialized values are unchanged. No migration marker, extra history or accumulating repair record is added.
- Per device forever: no storage key, persisted cache or background work is added.

The schema traversal visits map nodes and their existing guestbook records at admission, so its cost is proportional to those declared structures. It is not a recursive walk of all campaign data. The 73-second census and the 92-second historical baseline are same-machine observations under different concurrent workloads, not a performance-regression claim.

## Integrated checkpoint

Independent isolated approval is complete: the reviewer ran both full-facet adjudicators and separate ownership/schema/persistence probes. The complete synthetic [receipt bundle](verification-next-ten-2026-10-08/stores-545/README.md) preserves original oracle bytes, raw results, full-state adjudication and named proofs. The concurrent #538/#542/#544 fixes are integrated from 90c53126. Pending-companion and resident admission remains before normalization or other side effects; faction writes retain the hero refusal before dictionary creation. The independent reviewer confirmed 31 critical functions and seven identity handlers match the released baseline, plus six reserved-name reveal lifecycles.

The unchanged original census was rerun on the combined runtime: 66,564 pairs in 81 seconds, the same 650 classifications, and zero poisoning, errors or throws. All 650 flagged cases were replayed with complete facets; all 2,041 extra-name cases also passed full-facet replay. The final read-only 77-save comparison is against 90c53126, with identical state and both prompt halves and unchanged source hashes. The unchanged 1,236-reply p19 output is byte-identical to that released baseline, including its one preexisting handler error. Historical results above remain preserved separately. Integrated raw results, logs and runtime hashes are in the receipt bundle’s `integrated/` directory.

The integrated retained #542 proof initially missed removal of the shared saved-alias claim check: #544’s earlier operand classifier independently refused that same parser input. The existing test now additionally calls the shared preflight boundary with a saved sheet-only alias and an unrelated free alias, retaining the actual-parser assertion. Independent review reproduced the masking and approved this test strengthening. No production behavior changed for this proof repair. Integrated source and census/corpus evidence received final independent approval; the checkpoint uses the mandatory commit hook rather than a separate duplicate full-suite run.

Final applicability in this isolated worktree is 2,769 of 2,769 clauses across 310 batteries. Released main reports 2,757 before these 13 new clauses; the one-count difference is the existing #226 private mature-fixture byte-pin clause, which is intentionally skipped when that local-only fixture is absent. Per-battery inventory confirms no retained clause was removed; main with its fixture is expected to report 2,770. Named mutation proof totals are reported separately from this dry applicability scan.

Final integrated named mutation proofs passed 229 clauses across 9 batteries: retained-427-library-upstream (14), retained-533-name-word-tables (12), retained-538-hero-edges (11), retained-581-stash-journal (17), retained-guestbook (18), retained-w2 (96), sabotage-542-repaired (25), sabotage-544-alias-reveal (23), sabotage-545-stores (13). The final dry applicability log and all completed proof logs are retained under `integrated/`.
