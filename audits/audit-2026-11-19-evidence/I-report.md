# Lane I report — the atlas, public map mode (HEAD d7ed4ea6)

Probes are under `audits/audit-2026-11-19-evidence/I\`. Each one loads the real engine through `dev/load-engine.js` and uses the same public-mode setup as `dev/tests-771-place-sheet.js`.

## 1. Coverage

| File | Read | Skipped |
|---|---|---|
| map-knowledge.js | all 156 lines | — |
| atlas-knowledge.js | all 255 | — |
| atlas-knowledge-migrate.js | all 29 | — |
| atlas-knowledge-source.js | all 54 | — |
| atlas-knowledge-exits.js | all 66 | — |
| atlas-knowledge-extract.js | all 135 | — |
| atlas-discovery.js | all 53 | — |
| atlas-directions.js | all 110 | — |
| atlas-public-places.js | all 74 | — |
| atlas-public-journey.js | all 47 | — |
| atlas-public-landscape.js | all 48 | — |
| atlas-public-sheet.js | all 306 | — |
| atlas-ground.js | all 88 | — |
| atlas-public-region.js | all 166 | — |
| atlas-public.js | all 135 | — |
| ui-atlas.js | all 388 | — |
| atlas.js (1768 lines) | lines 1–320, 660–690 and 1240–1768 in full: the store header, the doc cache, things, the pointer, the first part of the follow, the public dispatch of `atlasPlaceCanon`, create/place, the pane and prompt reads, the fog, notes, the MAP block, shape check, `atlasHeal` | **Lines 320–660 and 690–1240 were not read.** That is the legacy follow, adoption, `atlasPosition`, the walk and growth code. It runs only when `atlas.knowledge !== 1`, and new campaigns are always public (#735), so it is outside this lane's lens. |

Context read: the atlas rows of CLAUDE.md; the game.js call sites 3025–3062 and 3830–3835; `showToast`, which renders through textContent; `keyedDict` and `KEYED_STORE_PATHS`, which include atlas.grounds, atlas.spots, atlas.seen and atlas.names; `locResolve`.

**Not read:** DOC/DESIGN_771_story_led_maps.md and DOC/DESIGN_684_atlas.md. I relied on the CLAUDE.md contract text and the design comments inside the code. tndmaps.js was not reviewed; I grepped it only for the signature of `region.place` and its `taken` rule.

## 2. Findings

### F1 — A note on a way out or a place inside is saved, then never shown, and it is shared by every sheet (medium)
In plain terms: the pane offers "Add note" on a way card. The save says "Note saved." The card never shows the note again. The note is also stored under a bare id like `way-1`, and every place sheet has its own `way-1`.

- **Where**
  - atlas.js `atlasNoteKey`, line 1376: `return atlasNoteBucket()==="publicNotes"?String(id):zoneId+"|"+id;`. In public mode the key has no zone.
  - atlas-public-sheet.js `atlasSheetWays`, line 181: `out[i].id="way-"+(i+1);`. The ids are positional and repeat on every sheet. `atlasSheetInside`, line 190, does the same with `"in-"+(out.length+1)`.
  - atlas-public.js `atlasPublicCard`, lines 56 and 59: the way card and the inside card both return `note:null`.
  - ui-atlas.js `atlasPaneCard`, line 353: `if(card.id!=null)h+="...Add note..."`. It offers the button because the way card's id is `way-1`.
  - atlas.js `atlasNoteSet`, line 1382, accepts the save because `way-1` is a portal on the drawn sheet.
- **Input:** Two visited places joined by a travelled way, both drawn. Tap the way and save a note.
- **Observed:** REPRODUCED by `p1-way-note.js`.
  ```
  noteSet on mire way-1: {"ok":true,...}
  way card after save: note= null
  publicNotes store: {"way-1":"Back to the crossroads, watch for bandits."}
  atlasNote(cross, way-1) — the OTHER sheet: "Back to the crossroads, watch for bandits."
  ```
- **What goes wrong:**
  - The player's words are kept but can never be seen. The button never turns into "Edit note".
  - The note also belongs to every other sheet's `way-1`.
  - When a feature later names the place the way leads to, the way's id becomes that feature's id. When an inside place gets named by a feature, the `in-N` ids shift.
- **Refuted?** The test at dev/tests-771-place-sheet.js:100 covers only a way that IS a feature, where the id is `fN` and globally unique. I found nothing that covers a plain way or an inside place.
- **Remedy:** Either hide "Add note" when the card has no note field (ways, inside places), or key public notes by `zone|id` like the legacy bucket does, and have those cards return `atlasNote(zoneId,w.id)`.

### F2 — After a place merge leaves two features with the same name, the map of that place stops accepting anything (medium)
In plain terms: say two places each had a "stone well". The identity layer later folds one place into the other. From then on, every new disclosure in the merged place is refused, every turn, for good. Distinct labels and the existing handles are refused too.

- **Where:** atlas-knowledge.js `atlasKnowledgeCollision`, lines 107–117. It is called at line 190: `problem=atlasKnowledgeCollision(s,groups);if(problem)return refuse("state",...)`. It scans ALL features in each touched resolved scope, including the old pair, and does not limit itself to the labels this turn introduces.
- **Input:** "Mirefen" and "Mire Fen" each disclose `stone well`. Then `identity.entries["Mire Fen"]={mergedInto:"Mirefen"}`. Then at Mirefen: `[MAP_REVEAL:new|broken cart|E|observed]`.
- **Observed:** REPRODUCED by `p5-merge-collision.js`.
  ```
  features shown at Mirefen: [["f1","stone well"],["f2","stone well"]]
  t5 new distinct feature -> {"kind":"state","reason":"public label already identifies f1 in this resolved place; ..."}
  t6 another -> same refusal
  ```
- **What goes wrong:**
  - That place's map is frozen permanently, and each turn shows a toast telling the GM to "use its handle", which cannot help.
  - The player also sees two pins with the same name.
- **Refuted?** sabotage-733-map-protocol.js covers a collision among the SAME turn's groups ("canonical collisions across scoped groups refuse the whole turn"). Nothing covers a duplicate pair that already existed before the turn.
- **Remedy:** Report a collision only when it involves a feature this turn created or changed. That means comparing against the pre-turn pairs, or limiting the check to the labels in `groups`.

### F3 — An exit with no stated direction jumps to the opposite edge when a later way is stated in its direction (medium-low; contract drift)
In plain terms: the way the party came in is drawn dotted at the north edge. When the party leaves by a way the story says is north, the earlier dotted way moves to the south edge.

CLAUDE.md says: "An exit added later moves nothing drawn."

- **Where:** atlas-public-sheet.js `atlasSheetRecipe`, lines 209–214.
  - First, `for(i=0;i<ways.length;i++)if(ways[i].bearing)used[ways[i].bearing]=true;` marks every stated bearing, including ways added later.
  - Then an unstated way takes `w.lean` only `if(!used[w.lean])`.
- **Input:** One way in, unstated, with lean N (the party came from Alpha). Later a second way to Beta, stated N.
- **Observed:** REPRODUCED by `p3-exit-moves.js`.
  ```
  turn 1: [["way-1","Alpha Keep","N",false]]
  turn 2: [["way-1","Alpha Keep","S",false],["way-2","Beta Ford","N",true]]
  way-1 drawn at [350,0] -> [350,700]
  ```
- **Refuted?** The stability test (dev/tests-771-place-sheet.js:125) adds a way with no stated bearing, so it cannot catch this.
- **Remedy:** Give each unstated way its edge from the ways ordered before it only. Alternatively, keep the assigned edge, the way region spots are kept. A stated way that lands on an edge an earlier dotted way already took then needs its own rule.

### F4 — The public geography store grows by roughly 465 bytes per disclosure, uncompressed, until its count caps (low-medium; monotonic)
In plain terms: every receipt keeps its full source quote (up to 600 characters) forever. The count caps are 4096 features and 8192 receipts. The byte size reaches about 1 MB by around 2000 disclosures, and it lives in the memory key in localStorage.

At the cap, `prepare` refuses every new disclosure for the rest of the campaign. That refusal is said, but it is permanent. Its toast then fires on every turn, from the GM commit and the landmark reader. The directions ask also calls the model each turn and fails each time.

- **Where:** map-knowledge.js line 6 (`MAX_FEATURES=4096,MAX_RECEIPTS=8192`) and line 139 (each receipt stores `events:normalized`, quotes included). `MapKnowledge.project` re-validates the whole store on every call (`problem(s)`, line 145). `atlasDiscoveryPin` stringifies the whole store at each check.
- **Observed:** REPRODUCED by `p4-geo-growth.js 2000`.
  ```
  receipts 2000 bytes 931187 build ms 6026
  one projection ms ~ 5.2
  one stringify (atlasDiscoveryPin) ms ~ 2.3
  ```
  A region read calls `atlasJourneyBearing`, which does 2 projections per leg. The pane does several reads per show. So the CPU cost grows with legs × store size.
- **Remedy:** Bound the provenance bytes (truncate or drop the quotes of superseded receipts), validate once per revision rather than per projection, and pin the pin to `revision` rather than the whole JSON.

### F5 — The directions ask repeats every turn, forever, while the model declines to place a feature (low; cost)
In plain terms: there is no attempt counter.

- **Where:** atlas-directions.js.
  - `atlasDirectionsRead` (lines 37–58) accepts `{"directions":[]}` as a success. The comment says: "An owed id left out is not an error — it stays owed".
  - `atlasDirectionsSettle` (lines 88–110) asks again on every turn the party stands in the place.
  - `atlasDirectionsFile` failures, such as the receipt cap in F4, also repeat a paid call and a toast every turn.
- **Status:** READ. I did not drive a live model.
- **Remedy:** Keep a per-feature asked count, or the turn of the last ask, and stop after N tries.

### F6 — The region can set two places on the same point (low)
In plain terms: when an earlier-ordered place is set down fresh while a later-ordered place already has a kept spot, the kept spot is not among the points to avoid.

- **Where:** atlas-public-region.js `atlasRegionSpots`, lines 81–95. `taken` collects only the places already handled in visit order (`taken.push(s)` at line 94). A kept spot of a place later in the order is not in `taken` when the earlier place is placed.
- **Observed:** REPRODUCED by `p2-region-taken.js`, but only given the precondition.
  ```
  spots with C1 kept at A1's point: {"Petrified Mire":[805,545],"The Ashen Fields":[694.3,625.7],"Gloomwood Forest":[805,545]}
  distinct points 2 of 3
  ```
- **Precondition:** SUSPECTED. These code paths reach it:
  - an earlier place's spot record cannot be read, so it is "set down afresh" (line 72);
  - a key's resolution changes after a reparent;
  - places recovered later with an earlier first-visit turn.
- **Remedy:** Seed `taken` with every kept spot before the loop.

### F7 — Ways past the 16th are dropped from a place sheet without a word (low)
- **Where:** atlas-public-sheet.js `atlasSheetWays`, line 180: `out=out.slice(0,ATLAS_SHEET_EXIT_CAP);`.
  - The cut ways are neither drawn nor listed.
  - Elsewhere in the same file, over-cap things are routed to the list (`ATLAS_SHEET_LIST_CAP`). That list is itself silently capped at 64 (lines 221, 227, 242, 246, 249).
- **Input:** A hub town with more than 16 travelled ways.
- **Status:** READ.
- **Remedy:** List the overflow ways, and say when the list itself is cut.

### F8 — Reaching the 1024-place cap reports an error every turn (low)
- **Where:** atlas-public-places.js `atlasPublicPlacesAdd`, line 26, throws at the cap. atlas-public.js `atlasPublicFollow` catches it through `atlasProblem` (line 33). That shows a toast and calls `reportError`, because it is not a `TnDMaps:` refusal. This happens on every follow, so on every turn and every time the pane opens, for every new place after the 1024th.
- **Status:** READ.
- **Remedy:** Treat the cap as a refusal: say it once per campaign and do not mail it.

## 3. Monotonic resources

| Thing | Scope | Bound | Enforced |
|---|---|---|---|
| `memory.map.geography.receipts` (quotes up to 600 characters) | per campaign, forever | 8192 receipts × 16 events | yes, by count; bytes unbounded in practice (F4) |
| `memory.map.geography.features` | per campaign | 4096 | yes |
| `worldState.atlas.publicPlaces.places` | per campaign | 1024 | yes, by throwing (F8) |
| `atlas.grounds` | per campaign | about one per place; a stale key is deleted on re-answer (atlas-ground.js:54) | implicit, through the places cap |
| `atlas.spots` | per campaign | one per world place; merged-away keys are never deleted (orphans) | implicit, through the places cap; orphans grow with merges |
| `atlas.publicNotes` | per campaign | keys must be a thing on a sheet (`atlasNoteSet`); 600 characters each; never pruned when a thing goes | partly |
| `atlas.legacyAtlas`, `atlas.legacyKnowledge` | per campaign | one backup each | yes |
| `_atlasDocs`/`_atlasDrawn` (legacy) | per session | `ATLAS_DOC_CAP`=12, LRU, both maps evicted together (atlas.js:159) | yes |
| `_atlasPeeks` | per session | `ATLAS_PEEK_CAP`=6 | yes |
| `_atlasPublicMemo`, `_atlasRegionMemo`, `_atlasRegionBase` | per session | one entry each; the base region is replaced on a different id | yes |
| `drawn.ways` route cache (legacy fog) | per drawn sheet | dies with the doc entry | yes |
| `_atlasWarned` latches | per session | grows per campaign seed × message kind; `atlasForget` clears it, but no campaign switch calls `atlasForget` (only atlasCreate/atlasPublicEnable and tests do) | small; not cleared on switch |
| `_atlasSheetSaid`, `_atlasRegionSaid` | per session | single string | yes |
| Pane: `TnDMaps.view`, `ResizeObserver`, canvas/card/button listeners | per open | `atlasPaneClose` destroys the view and disconnects the observer; the element listeners die with the replaced DOM; the document-level listeners are added once (`atlasDoorWire`) | yes, on the paths I read |
| `P.keys` list cache, `P.warning` | per pane | one each | yes |
| "thinking" DOM markers (discovery, directions, ground) | per ask | removed in `finally` | yes |
| `<option>` nodes in `#atlas-zones` | per show | the select is emptied first (`sel.innerHTML=""`) | yes |

## 4. Affirmed (tried to break, could not)

1. `atlasDirectionsRead` refuses each of these: an id that was not asked, the same id twice, a bearing outside the eight, `unknown`, an extra field, more records than were asked, a reply over 4000 characters, and a cut finish (read, lines 40–55).
2. `atlasGroundSettle` and `atlasDirectionsSettle` check `atlasDiscoveryCurrent(context)` after the await. The context pin covers campId, turn, world and the whole geography, so a campaign switch or a map change mid-ask writes nothing (read). Both are wrapped in try/catch and never throw into the turn (game.js:3041–3043).
3. The public/private wall in the projection: `MapKnowledge.project` copies only id, label, bearing, mode and source {commit, turn}. `proposalKind`, the private kind, and the quotes never reach a card, the pane or the GM brief. The extraction payload's `known` list is the same four public fields (atlas-knowledge-extract.js:47).
4. Model-chosen keys: every public-mode dictionary built in these files is `Object.create(null)` or `keyedDict()`. That covers the journey `by`, `keys` and `seen`, region `spots`, sheet `byName` and `isWay`, the directions `asked` and `seen`, and the grounds and spots stores. Tables are read through `hasOwnProperty` or `ownValue` (`ATLAS_SHEET_DRAWS`, `ATLAS_REGION_GROUNDS`, `ATLAS_KNOWLEDGE_DIRECTIONS`). atlas.grounds and atlas.spots are in `KEYED_STORE_PATHS`, so loads re-key them.
5. HTML injection in the pane: the card title, word, note and `data-zone` go through `escHtml` (ui-atlas.js:343–353). The select uses `new Option` (text). Toasts render through textContent. Region and sheet names go to a canvas only.
6. Fail-closed fog: `atlasPaneShow` reads the doc, the reveal and the markers before touching the view. A `setReveal` throw re-applies `atlasRevealNone`, which for the region is all fog. Public place sheets are deliberately whole (`atlasPublicReveal` returns null for them).
7. "Reads never write": `atlasPublicPlacesRead` builds a fresh, unsaved store when none exists. `atlasRegionSpots`, `atlasGroundOwed`, `atlasDirectionsOwed`, `atlasPublicDoc`/`Card`/`Party`/`Trail` and `atlasSheetRecipe` assign nothing on `worldState` or `memory`. Their only writes are session memos.
8. `MapKnowledge.prepare` refuses to replace an established bearing, to downgrade observed to reported, and to take a quote absent from the narration. A model answer therefore cannot rewrite a settled direction.

## 5. Undetermined

- When the party enters a new world place straight into a sub-location (`[LOCATION:X][SUBLOCATION:Y]`), the world place X is set on the region at once. Its ground comes only from its name: `atlasRegionGround`'s owed test compares the context `X|Y` with `X`, and the ground ask goes to `X|Y`. So X can be set on arbitrary land for good. Is this acceptable under "a place whose ground is still being asked waits a turn"? Places passed through within one turn behave the same way.
- `atlasPublicCanon` (called from the parser through `resolvePlaceName`) has a try/catch only around the projection. Its contract comment says "the parser is never broken". I did not establish whether `memory.map.nodes` can be absent at that point.
- atlas.js lines 320–660 and 690–1240 (the legacy follow, adoption and position code) were not read. Any legacy-mode defects there are unreviewed.
