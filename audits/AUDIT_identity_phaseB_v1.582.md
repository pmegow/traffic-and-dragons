# AUDIT — Identity Hardening Phase B: the location domain + the cleanup tool (TODO #156, v1.582)

**TLDR: locations now have real identity — merges, reparents, and splits are O(1) overlay writes with every historical reference resolving at read; the whole doc-ruled t1593 repair (26 ops including the North Road split) ran clean on the clone with zero dangling references; the prompt is byte-identical on unrepaired saves, so nothing changes until a repair is applied; the live repair is now a user session in map_cleanup.html.**

- **Date:** 2026-08-09 · **Version:** v1.582 · **Tier:** Fable (drift surface)
- **Mandate:** [DOC/Research/identity_hardening_fable.html](../DOC/Research/identity_hardening_fable.html) §7.4, built on the A0 ruling ([AUDIT_identity_A0_representation_gate.md](AUDIT_identity_A0_representation_gate.md)) and Phase A ([AUDIT_identity_phaseA_v1.581.md](AUDIT_identity_phaseA_v1.581.md)).
- **Order of work:** critical review → failing tests (16, all red with diagnostics) → implementation → verification → the t1593 clone repair.

---

## 1. Critical review (recorded before code)

**Call #1 — the representation amendment (the pivotal one).** The A0 ruling ("additive domain IDs") ships as **immutable name-born keys + a sparse identity overlay** (`memory.map.identity.entries` carrying `mergedInto`/`aliases`/`display`), not opaque `loc_N` re-keying. The ruling's decision criteria are preserved and strengthened:
- merge/reparent/split remain O(1) pointer writes; historical references resolve at read; a missed seam site is a display/code bug, never data corruption — the properties A0 selected for;
- the migration shrinks from 1728 rewritten instances to a container init (existing keys ARE the identifiers; `e.l`/`lastSeenAt`/edges stay historically true in data);
- **decisive:** a cross-device client still running the previous app version (the stale-SW window is real and this user plays cross-device) reads name-keyed data perfectly and writes compatible keys back. Under opaque re-keying that client renders garbage AND pushes name-keys into an id-keyed store — silent corruption with no defense, because shipped clients cannot be taught to refuse a new format. The only safe breaking change is the one that never happens.
Surfaced for veto in the Phase B report; recorded here per the amended drift policy.

**Other material calls:**
2. **The heal/resolve split**: live pointers with per-turn cost (world pointer, combat.node, pendingLocState, locDescNudged, lastArrivalFrom, splitLoc) are REWRITTEN at repair time; the O(n) historical mass (1452 transcript `e.l`, 37 lastSeenAt) stays as written and resolves at read. Edge compaction runs in-executor (deterministic, receipted).
3. **World-ness = parent relation, never key shape** (`locIsSub`) — a reparented ex-world node is a sub even without a pipe; legacy pipe-bearing pseudo-worlds read by their record. Key punctuation is history, not authority (Sol §5 answered structurally).
4. **The census classifies nothing.** Typed evidence only (shadow / identical-description / leaf-variant / containment); every group starts `undecided`; classification is human, per pair (Sol §1). Sabotage-proven.
5. **Split is tool-only** with a human allocation spec; the fused key tombstones to the PRIMARY successor so history resolves coarse-but-consistent (the A0 trunk rule). `kind`/`endpoints[]` land on successors here (§7.4 item 2); full topology stays a non-goal.
6. **Deliberate deviation:** the map_viewer "export suspected groups" button was NOT built — the tool computes the census itself from the loaded save with strictly more access, so the button would be redundant machinery on a read-only instrument (single-purpose-tools). Map_viewer remains byte-untouched.
7. **Write-time canonicalization at the boundaries** ([LOCATION:]/[PARTY_SPLIT:] handlers + all `file*` writers resolve) so new writes land canonical and the GM's prompt header re-anchors the canonical name (anti-drift feedback); `memory.js` seam sites are `typeof`-guarded (some dev tools load memory.js without identity.js).
8. **A0 mandates disposition:** ghost-minting is satisfied by construction (references are never rewritten, so nothing can newly dangle; the 3 pre-existing ghosts remain explicit in the results); parent-unreliability is handled by resolution + the reparent op; the `.tnd` import carries the overlay automatically (`map` rides wholesale); the flagged `split("|")[1]` display bug is fixed by `locDisplayLeaf`; the parent-child-edge policy stays visible in receipts (kept, Choke Gully precedent).
9. **Monotonic resources:** the overlay grows only with repairs; the `locResolve` memo is generation-keyed and resets on identity writes; census/apply are repair-time only.

## 2. Failing-first evidence

16 assertions red before the location adapter existed — among them the load-bearing proofs that the engine really lacked the behavior: "duplicate node survived the fold" ([MERGE:location|…] refused as unknown domain), "the tombstoned key was re-minted", "the merged-name e.l stamp scored zero — historical scenes go invisible after a merge", "#133b … not auto-rejoined", plus the Phase A registry pin updated to expect the location domain (documented edit).

## 3. Verification

| Check | Result |
|---|---|
| Engine suite | **ALL GREEN — 1180 assertions** |
| Prompt parity (the pass-through proof) | stable `#2954043679`/37628 chars and volatile `#1167606204`/59510 chars **byte-identical** under the Phase A engine (git worktree @ v1.581) and the Phase B engine on the untouched t1593 clone — zero behavior change until a repair is applied; the NAMING-clause literal move cost zero bytes |
| diff-replay | all 5 corpora byte-identical end states |
| Sabotage | **22/22 caught** (Phases A+B). Two catches improved the battery itself: the route-noun-gate case (Phase A, re-proven) and "fileLocation stops resolving" — the [LOCATION:] handler's own resolve masked fileLocation's internal one until a direct-caller assertion was added. |
| Satellite | map_cleanup.html boots on the engine subset; census/dry-run/apply verified through `window.__cleanupTest` in the browser (state untouched on dry-run, receipts correct) |
| The t1593 clone repair | see §4 |

**Two tooling incidents, root-caused and fixed in-commit:**
- A sabotage run piped through `head` was killed mid-mutation when the pipe closed, leaving one seam line deleted on disk — and a subsequent run's verdicts contaminated (red for the wrong reason). Repaired from known content; all affected verdicts re-run clean. Lesson: **never truncate a mutation harness's output stream; capture to a file.**
- OneDrive's filter driver transiently locks files (errno -4094 on open), which aborted a harness write. `dev/sabotage.js` writes now retry (6 attempts, ~200ms) — for a harness whose job is putting files back, a flaky write is a correctness bug.

## 4. The t1593 repair (executed on the clone — the live run is the user's)

Plan: [testRuns/t1593_repair_plan.json](../testRuns/t1593_repair_plan.json) — the doc-ruled set: **14 merges** (Sandpoint ⇐ "Sandpoint, Varisia" + the pipe-key pseudo-node "Sandpoint|Varisia"; the Rusty Dragon cluster incl. both Common Rooms; Docks; Cliffs; Temple/Cathedral incl. the self-shadow; Corven variants; Fogscar Tunnel twins), **8 reparents** (Guest Room + inn rooms under the Rusty Dragon; Corven's shop, Residential Quarter chain, Glassworks, Catacombs entrance, Coast pair under Sandpoint), **1 split** (Varisia - North Road → North Road (Magnimar–Sandpoint) [primary] + North Road (Magnimar–Jorgenfist), per the user's fiction ruling; Fogscar-direction edges to the Jorgenfist successor; Charred Barrel children parked on the primary as LEFT).

Results ([testRuns/identity_phaseB_repair_results_t1593.json](../testRuns/identity_phaseB_repair_results_t1593.json)):
- 80 → **66 nodes**; 24 identity entries; **26 pre-images** archived (one per op — reversible by construction).
- **Zero dangling** references (edges, lastSeenAt, parents) beyond the 3 pre-existing ghosts; **all 1452 transcript `e.l` stamps resolve**.
- Every ruled resolution correct ("Sandpoint, Varisia"→Sandpoint … "Varisia - North Road"→the primary road).
- Census-after lists **only the deliberately-LEFT ambiguous set** (garrison/office hierarchy, bathhouse private-room variants) — the confirmed clusters are gone, the ambiguity is honestly still visible.
- Prompt builders run clean on the repaired state; the road successors carry `kind:"route"` + endpoints. (An empty "Known sub-locations" line was chased and confirmed as the pre-existing E53 20-turn recency filter — newest Sandpoint sub-visit t1367 vs cutoff t1573 on the un-repaired clone too.)

## 5. Carried forward

- **The LIVE repair is a user session**: open `map_cleanup.html`, load the live campaign (double-confirm applies + `saveAll()`) or the latest export, run the census, classify per pair — the ruled plan file is the template; the ambiguous set stays LEFT until new evidence.
- Lazy edge compaction beyond repair-time, and any future topology (segments/junctions), stay evidence-gated non-goals.
- **Post-B decisions**: the npc-ID representation call (Phase A review #1) now has the location pattern as its template; Phase C (quest/faction) remains evidence-gated (§7.5).
- Field-watch signals: `[identity]` console lines on merges/refusals; the census in the tool; `[MERGE:location|…]` usable by the GM for pipe-free world pairs go-forward.
