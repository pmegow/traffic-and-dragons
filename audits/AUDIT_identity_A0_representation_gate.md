# AUDIT — Identity Hardening Phase A0: the representation gate (TODO #156)

**TLDR: measured on the real t1593 save, name-re-keying costs 172 reference rewrites and 2 forced destructive folds for four location merges (and re-pays that on every future operation, forever), while additive domain IDs cost a one-time 1728-instance migration and then 3–4 writes per merge with collisions kept as distinct flagged records — additive IDs win the location domain on both §7.2 criteria (smaller and safer forever).**

- **Date:** 2026-08-09 · **Tier:** Fable (drift surface — critical review recorded below, before code)
- **Mandate:** [DOC/identity_hardening_fable.html](../DOC/identity_hardening_fable.html) §7.2 — implement the location `merge` twice against a cloned t1593 state; deliver the complete structural-reference inventory, the measured touch-count and failure surface of each approach, and a written ruling. No shipping code.
- **Harness:** [dev/identity-a0-gate.js](../dev/identity-a0-gate.js) (dev-only, not loaded by index.html; loads `globals.js` for `LOC_STATE_CAP` only)
- **State:** `testRuns/Rise_of_the_Runelords__Ammut__Ammut_t1593.tnd` (gitignored; copy of the 2026-08-09 field export), deep-cloned in memory — the file is never written
- **Machine-readable results:** `testRuns/identity_a0_results_t1593.json` (regenerate any time with `node dev/identity-a0-gate.js`)

---

## 0. Critical review (before code — drift-surface policy)

1. **Touches nothing shipping.** One dev harness; the engine, tag_table, and prompts are byte-untouched. The only mutation target is an in-memory clone.
2. **Named silent-failure risk: a short inventory poisons Phase B**, whose migration-test battery derives from this inventory. Countermeasure: a **deep-scan honesty check** — after each re-key merge the entire serialized state is walked for the dead keys as exact string values outside whitelisted prose paths; any hit is a reference class the inventory missed. (Sabotage-proven: a planted dead key at a structural path is found.)
3. **Named bias risk: unequal rigor between arms.** Countermeasure: ONE battery of resolution-level predicates with thin per-arm adapters; the field-merge rules are one shared function used by both arms.
4. **Failing-first honored:** all 17 merge-outcome assertions demonstrated failable against a no-op merge; the 4 invariant-shaped assertions (self-loop/parallel/ghost edges, dangling nudge keys, dangling archive provenance, prose integrity) plus the deep scan were **sabotage-proven** (7/7 fired on planted damage).
5. **Real-state mandate:** fixtures are the real census pairs. Classes empty in the save got documented synthetic overlays *on top of* the clone (listed in §2) — never synthetic-only.

## 1. The complete structural-reference inventory (the Phase B seed)

Every place a location identity is **stored** in the save blob. Sol §4's list was the seed; every class verified against code (writer sites cited); the deep scan guards against omissions. Display readers (geo block, map viewer, affordance gate…) consume these stores live and are enumerated in §5 as the ids-arm read seam.

| # | Reference class | Key shape | Writers | t1593 instances |
|---|---|---|---|---|
| F1 | `memory.map.nodes` keys | world `"Name"`; sub `"Parent\|Sub"`; **3–4 segment keys exist in the wild** (pipe-bearing `[SUBLOCATION:]` text) | memory.js:183/198/220, tag_table.js:774, game.js:38 | 80 (21 world, 59 sub; 9 keys ≥3 segments) |
| F2 | `node.parent` | world name or null — **unreliable in the wild**: `"Sandpoint\|Varisia"` has parent=null; its children carry the full sub key; 3-segment keys carry `split("\|")[0]` | memory.js:198/220 | 57 non-null |
| F3 | `node.npcs[]` | NPC names on the node (merge: union) | memory.js:258, tag_table.js:776 | — |
| F4 | `node.items[]` | `{name, placed, taken}`; reads are FIRST case-insensitive match | memory.js:236 | 1 node (+2 staged) |
| F5 | `node.stateNotes[]` | `{n,t}` cap `LOC_STATE_CAP`=3; evictions → archive | memory.js:214 | 2 nodes (+4 staged notes) |
| F6 | node scalars | `description` (write-once), `firstVisit`, `lastVisit`, `visits`, `size`, `travelMins` | memory.js:183/199/205, tag_table.js:290 | — |
| F7 | `memory.map.edges[].from/to` | world names BY DESIGN; **full sub keys exist in the wild** (`"Sandpoint\|Varisia"` ×4, Choke Gully); **ghost endpoints exist** | memory.js:191 | 58 endpoints; 1 ghost endpoint |
| F8 | `memory.map.lastArrivalFrom` | world name | memory.js:188 | 1 |
| F9 | `memory.locations` keys | world names BY DESIGN; pipe keys in the wild; `{visited[], notes[] cap5}` | memory.js:175 | 23 |
| F10 | `world.location` | world name | tag_table.js:247, sync modal, game.js:1879 | 1 |
| F11 | `world.sublocation` | **BARE sub name** — `currentNodeKey()` composes `loc+"\|"+sub`; a sub rename must rewrite this bare string | tag_table.js:260/261 | 1 |
| F12 | `charSheet.splitLoc` | `{location: world name, sublocation: BARE name, turn, audited?}` | tag_table.js:765 | 0 (+1 staged) |
| F13 | `memory.npcs[*].lastSeenAt` | FULL node key | memory.js:259, tag_table.js:758/777/870 | 37 (+1 staged) |
| F14 | `worldState.combat.node` | full node key (#149 aftermath anchor) | tag_table.js:452 | 0 (+1 staged) |
| F15 | `worldState.pendingLocState.node` | full node key | tag_table.js:535/542 | 0 (+1 staged) |
| F16 | `worldState.locDescNudged` keys | full node key → turn | api.js:311-313 | 8 (+1 staged) |
| F17 | `transcript[*].e.l` | WORLD name at log time (RAG scene stamp); **pipe values in the wild: 109 × `"Sandpoint\|Varisia"`** | memory.js:496 | **1452** |
| F18 | `memory.archive.locationStates[].node` | full node key (evicted note provenance) | memory.js:233 | 0 (+1 staged) |
| F19 | campaign meta `entry.location` | world-name snapshot in `tnd_camps_v1` | state.js:506 | derived — rewritten from live state on every save; self-heals, no migration |
| F20 | blueprint export `locations[]`/`startingLocation` | world names at export time | game.js:1761-1782 | derived — same |
| F21 | `.tnd` import whitelist | ui-files.js:479 memory allowlist | — | **code gap: `memory.archive.identityMerges` (and Phase B's `map.ids`) must be whitelisted or pre-images/identities die on .tnd round-trip** |
| F22 | narrative prose | transcript `x`, npc knowledge/events/firstEncounter, chapters, lore, decisions, quest text, futureEvents, storyBeats, coreMemories, schedule labels, tagLog, eventHistory, `node.description` text, stateNotes text, `memory.locations[].notes` | everywhere | **history, never rewritten** (Sol §4 ruling) — asserted byte-unchanged by the battery |

**Classes found beyond Sol §4's seed:** the **bare-name semantics** of F11/F12 (a sub rename must rewrite strings that are *not* keys), F3 (`node.npcs[]` union), F9's value-shape union rules, F20, and the wild-data facts (3–4-segment keys, pipe keys in edges/locations/e.l, parent-field variance, ghost endpoints). Verified excluded as location references: clock schedule (labels are prose), skeleton (prose), npcGraph, recentlyLeft/recentSwitch, quest objectives, futureEvents.

**Pre-existing rot found by the gate (not caused by any merge):**
- **68 transcript `e.l` stamps name never-filed nodes**: `"Sandpoint Coast - Abandoned Cottage"` ×61 (which also has an edge — the node existed logically and is absent from the store; mechanism unestablished, out of A0 scope), `"Sandpoint Glassworks - Deep Passage"` ×6, `"Sandpoint Glassworks - Main Floor"` ×1.
- 1 ghost edge endpoint (the same Abandoned Cottage).
- The battery treats these as a baseline that must not GROW; the ids migration makes them explicit **ghost identities** instead of silent danglers.

## 2. Fixtures and staged overlays

Four merges, run sequentially on one clone per arm — all from the census of confirmed duplicates (doc §7.0 row 1 / Sol §1):

| Fixture | Canonical ⇐ duplicate | Why it's in the set |
|---|---|---|
| M1 | `Sandpoint` ⇐ `Sandpoint, Varisia` | world→world; byte-identical descriptions; produces a **self-loop** (the `Sandpoint ↔ Sandpoint, Varisia` edge) that must drop |
| M2 | `Sandpoint` ⇐ `Sandpoint\|Varisia` | the pipe-bearing pseudo-node: 5-descendant subtree incl. **4-segment keys**, **two real child-key collisions** (`…\|Sandpoint - Rusty Dragon` and its `…\|Common Room` exist on both sides), 109 `e.l` stamps, 4 edges → **2 parallel collapses** |
| M3 | `Sandpoint\|Sandpoint - Rusty Dragon` ⇐ `Sandpoint\|Rusty Dragon` | sub→sub variant pair; the live world pointer rides it (bare-name F11) |
| M4 | `Sandpoint\|Sandpoint Northeast Cliffs` ⇐ `Sandpoint Northeast Cliffs` | **cross-level** world→sub; 29 `e.l`; exposes the parent-child-edge and e.l-grain warts |

Synthetic overlays staged identically for both arms (classes the save has empty — real state plus minimal instances, never synthetic-only): combat.node and a companion `splitLoc` at the M1 dup; `pendingLocState.node`, a staged NPC `lastSeenAt`, an archive provenance row, and a `locDescNudged` key on M2 descendants; stateNotes 2+2 on the M1 pair (forces chronological merge + 1 eviction); size/travelMins on M1 (both directions of canonical-wins-unless-null); case-colliding items on M3 (`"Brass Key"`/`"brass key"`); a description on the M4 dup (null-canonical-takes-dup direction); world pointer = `Sandpoint`/`"Rusty Dragon"` bare name.

## 3. Measurement

| | **Arm 1 — name re-key** | **Arm 2 — additive IDs** |
|---|---|---|
| M1 instances rewritten | 7 | 4 |
| M2 instances rewritten | **131** (109 = e.l alone) | 4 |
| M3 instances rewritten | 2 | 3 |
| M4 instances rewritten | 32 | 4 |
| 4-merge total | **172** | **15** |
| One-time migration | — | **1728 instances** (F1 80 · F2 57 · F7 58 · F9 23 · F13 38 · F16 9 · F17 1452 · pointers/anchors 8 · 3 ghost identities minted) |
| Executor size (non-comment LOC) | 92 | 89 |
| Battery | 92/92 | 92/92 |
| Destructive folds forced | **2** (M2 child-key collisions — string keys leave no other option) | **0** (homonym children stay distinct records, flagged for per-pair adjudication) |
| Semantic warts forced | **2** — a re-pointed edge becomes parent-child (`Sandpoint ↔ Sandpoint\|Sandpoint Northeast Cliffs`); 29+109 e.l rewrites jam sub-grain keys into a world-name field | 0 at merge time (grain resolves at read via the node's own placement) |

To finish the *same* repair as arm 1 (actually folding the two Rusty-Dragon child pairs), arm 2 needs 2 follow-up child merges ≈ 6 more writes — **~21 total vs 172**, and each fold happens only after its own explicit confirmation (Sol §1: per-pair, never a batch).

## 4. Failure-surface analysis (the half the numbers don't show)

**Arm 1 — name re-key:**
- **Open enumeration, forever.** Every future feature that stores a location reference must also be added to the merge sweep, or merges silently corrupt that store. This is precisely the failure class that already produced five independent partial guards (doc §1.2) — the sweep re-creates it as a standing liability *in data*.
- **Per-merge cost scales with campaign size.** F17 grows every turn; M2 cost 131 at t1593 and would cost more every session after.
- **Forced fusion.** A child-key collision *must* destructively fold (M2 hit two real ones). Here both were genuinely the same inn — but the operation cannot represent "actually distinct" (the homonym case), which is the exact fusion failure #156 exists to end. Sol §2's collision direction is unrepresentable under name keys.
- **Forced grain violations** (the two warts) — every referencing store must be assigned some rewritten name even when no name of the right grain exists.
- Renames/splits/reparents each re-pay the full sweep; split additionally requires adjudicating which of the (109…) historical references meant which identity — per instance, by hand.

**Arm 2 — additive IDs:**
- **Merge is O(1) in data:** identity-table tombstone + alias + node-record fold; references resolve through the tombstone at read time. Reparent = one `parentId` write (keys don't embed parents). Split = mint a new identity; historical references stay consistent (coarse, pointing at the trunk) rather than wrong. Homonyms coexist; child folds happen only as their own confirmed merges.
- **The migration is the cost, paid once:** 1728 data instances (fully testable — this battery *is* the seed), plus a **read-seam** in code (§5): every read/write site that today compares or composes name keys must route through resolve/display. A missed read site is a display or lookup miss — **the data stays uncorrupted and the fix is code**, versus arm 1 where a missed sweep site is permanent silent data corruption.
- Honest debts: resolved-duplicate edges remain in data until a lazy compaction (the read view collapses them — battery-verified); tombstone chains need bounded resolution (trivial, guard exists in the spike); `.tnd` import must whitelist `map.ids` + `memory.archive.identityMerges` (F21); old saves need a `migrateWorldState` step that is exactly this migration under tests.

## 5. The ids read seam (Phase B's code surface, enumerated)

helpers.js `currentNodeKey`/`splitEffectiveLoc`/`partySplitMembers` · memory.js writers (`fileLocation`/`fileSubLocation`/`fileLocationDesc`/`fileLocationState`/`fileLocationItem`/`autoTakeLocationItem`/`mapNpcLocation`) · memory.js reads (`ragQueryEntities`, RAG memo key, `memoryTOC` locations) · api.js (`buildGeoBlock`, `buildChangedLocationsBlock`, `buildLocationDescNudge`, `buildLocationStateNudge`, `buildSplitAudit`, party away-blocks) · tag_table.js handlers (LOCATION, SUBLOCATION[_LEAVE], LOCATION_SIZE/DESC/ITEM/STATE, PARTY_SPLIT, COMBAT_START/END anchors) · game.js (`buildSceneManifest`, affordance-gate travel rules, blueprint export/import, boot-heal) · state.js (`migrateWorldState`, `updateCampMeta`) · display surfaces (ui-panels sidebar, ui-campaigns picker, error-report crumb, map_viewer.html) · ui-files.js import whitelist. ≈11 file-surfaces / ≈30 functions — one-time, testable, and the identity boundary the GM's name-keyed tags resolve through stays exactly where §1.3 said it must (names remain the wire format).

## 6. THE RULING

**The location domain moves to additive domain IDs.** Per §7.2's criteria — *whichever approach makes merge/split/reparent smaller and safer forever wins; migration is paid once, re-keying is paid on every operation* — the gate's evidence is one-directional:

1. **Smaller:** 15 (or ~21 repair-complete) writes vs 172, on real data, at equal executor size (89 vs 92 LOC) — and arm 1's number grows with every session while arm 2's is constant.
2. **Safer:** arm 1 forces destructive folds and grain violations and keeps an open-ended sweep as a permanent data-corruption liability; arm 2 makes collisions representable (Sol §2), repairs per-pair confirmable (Sol §1), reparent/split expressible (Sol's §7.1 operations), and converts "missed a site" from silent data corruption into fixable code.
3. The **provisional record** (§7.1 create-distinct) needs two identities sharing one display name — structurally impossible under name keys, native under IDs.

**Scope of the ruling:** measured and ruled for `location`. For `npc`, the same evidence class already exists in production — `dev/npc-merge-core.js`'s residue-site sweep *is* arm 1 for NPCs — so §7.2's lean (IDs for both instance domains) stands **corroborated but unmeasured**; Phase A's own critical review makes the final npc call (the #128 byte-parity port can land name-keyed first — the parity contract is unaffected). Type domains (capability, item) keep name-keys: normalization-collapse is their correct semantics (§7.2).

**Phase B mandates carried out of A0** (each becomes a failing test before the executor exists, per §7.4):
1. This battery (22 assertions + deep scan + sabotage set) over the t1593 clone is the seed of the migration battery; the inventory (§1) is its checklist.
2. Migration mints **ghost identities** for the 68+1 pre-existing dangling references — never silently drop, never silently heal.
3. `parentId` derives from **key structure first, parent field second** (F2 is unreliable in the wild).
4. `.tnd` import whitelist gains `map.ids` + `memory.archive.identityMerges` (F21) in the same commit as the migration.
5. Flagged policy questions for Phase B's review (not silently decided here): parent-child edges after cross-level merges (keep/drop), lazy edge compaction timing, and the `buildGeoBlock` `split("|")[1]` display bug on ≥3-segment keys (renders the middle segment, not the leaf — real keys hit it today).

## 7. Reproduce

```bash
node dev/identity-a0-gate.js
```

Prints the failing-first proof, the 7 sabotage proofs, both arms' per-merge measurements and battery verdicts, and the summary table; writes `testRuns/identity_a0_results_t1593.json`. The save file is read-only throughout.
