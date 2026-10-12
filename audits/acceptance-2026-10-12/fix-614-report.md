# Fix report: TODO #614, "A merge drops the resident mark, and a waiting standing proposal is not re-keyed"

Worktree base: `ec0cd67f`. Nothing is committed or pushed. TODO.md, APP_VERSION, CACHE and identity.md are untouched.
Patch: `C:\Users\hannu\AppData\Local\Temp\claude\C--Projects-traffic-and-dragons\97fd7790-74cc-480c-82d3-71fee5adeb06\scratchpad\fix-614.patch`

Four files change: `tag_table.js`, `helpers.js`, `dev/engine-tests.js` and `dev/sabotage-593-resident-rel.js`. I stayed out of `npcTitleQuestion`/`npcKeyTitle`, and out of memory.js and identity.js entirely, because the #616 lane is working there.

## Root cause

Both merge vocabularies, `[NPC_MERGE:canonical|duplicate]` and `[MERGE:npc|new|old]`, run one handler: the NPC_MERGE entry in tag_table.js. `_identityActionTag` routes the second into it with `R.viaTag="MERGE"`. That handler's roster fold copies these fields from the duplicate's record:
- partyMember
- charSheet
- portrait, portraitOffset, pronouns
- the voice pins
- dead, status, rel, met

It never copied `resident`. A rename builds a fresh canonical record that has no `resident` field.

`residentRelWrite` (helpers.js) asks `npc.resident` before it stages anything. So a survivor without the mark took a colder word at once.

The proposal queue `worldState.residentRelChanges` is keyed by `name`, and nothing outside helpers.js touched it. The merge deletes the duplicate's name, so a waiting proposal sat under a dead key until it expired 12 turns later.

## Per mechanism

### 1. The resident mark is carried by the record fold (OR of both records)
- **Change:** `tag_table.js:773-776`. When the duplicate's record is a resident and the canonical's is not, the survivor is marked `resident:true`. The merge summary gets the line `Resident carried: <dup> -> <canonical>`.
- **Same rule as the guestbook:** this matches `guestbookFoldRecords` (memory.js:1225), which ORs residency the same way.
- **When nothing is printed:** if the canonical was already a resident, nothing changes and nothing is said.
- **Both vocabularies:** one site covers both, because both run this handler.

### 2. The library stamp `libraryAt` rides with the sheet it stamps
- **Change:** `tag_table.js:772`.
- **Rule:** when the survivor ADOPTS the duplicate's sheet, it takes the duplicate's `libraryAt` too. "Adopts" means the survivor now holds the very same sheet object.
- **When the stamp stays behind:** a survivor that keeps its own sheet keeps its own stamp, and a missing stamp stays missing.
- **Why sheet-bound and not "fill a blank":** the engine reads the stamp as "the library copy this sheet came from":
  - `partyUploadAhead` (helpers.js) uses it to decide whether a library copy is ahead of the live sheet.
  - The hero swap reads it, under the comment "#427: the stamp travels with the sheet" (game.js:1868-1871).
  - So a visitor's own sheet carrying a resident's stamp would claim a library origin it does not have.
- **charSheet itself:** the existing fold already carried it. The test pins that it is carried and renamed.
- **Why it is a separate line:** the stamp is not written inside the `else if` adoption branch. The W7 battery anchors a clause on that exact line (`dev/sabotage-w7.js:116`), and keeping that line byte-identical leaves that battery's anchor valid.

### 3. A waiting proposal follows the person
- **Change:** a new `residentRelRekey(canonical,duplicate,R)` at `helpers.js:3626-3639`, called once in the NPC_MERGE tail (`tag_table.js:790`, beside `relationshipRekeyEntity`).
- **What it changes:** it renames the duplicate's proposal to the survivor's name and says `Resident relation proposal re-keyed: <dup> -> <canonical> ("prev" → "next", staged tN)`.
- **What it keeps:**
  - The preimage `prev` stays. If the survivor's standing is not the preimage (the canonical's standing won the fold), the existing moved-preimage rule drops the proposal at the repeat, and says so. That is the rule the #593 out-of-band test already names "a merge" for. Nothing ever commits onto a standing nobody reviewed.
  - The staging `turn` stays. So a repeat on the staging turn is still a same-response duplicate, and a repeat on any later response confirms it.
- **The merge never re-keys when it does not land:** a refused, proposed, deferred, self or keep merge exits the handler before the fold.

### 4. Collision: both records have a waiting proposal
- **Change:** in `residentRelRekey` (helpers.js:3634-3636).
- **Rule:** the survivor's own proposal waits on. The duplicate's proposal is dropped and said with the glyph: `⚠ Resident relation proposal DROPPED (merged into <canonical>, whose own proposal waits): <dup> (…)`. The console gets a warning too.
- **Why it is needed:** without this branch, a merge of two residents would leave two proposals under one name.

## Tests: section `#614 a merge keeps the resident (owner ruling 2026-10-12)`

The section is in `dev/engine-tests.js`, starting at line 28207, right after `acceptance 2026-10-12 — #593 resident standing`. It holds 10 tests.

Test-first: at the base commit, 9 of the 10 failed (output below). (b) passed, because it pins behaviour that already held.

| Case | Test | Baseline | After |
|---|---|---|---|
| (a) | A resident merged as the DUPLICATE into a visitor (no sheet). The survivor gets the mark, the sheet renamed to the survivor, and `libraryAt`, and the summary says `Resident carried:`. | FAIL | PASS |
| (a) | A visitor holding its own sheet absorbs the resident. The mark is carried, the survivor's sheet stays, and the duplicate's stamp is NOT taken. | FAIL | PASS |
| (b) | The resident as the CANONICAL with a visitor duplicate (which has its own sheet). The mark, its own sheet and its own stamp stay, and no residency line is printed. | pass (regression pin) | PASS |
| (c) | `[MERGE:npc\|Nyla Stormwater\|Nyla Brightwater]` (a rename). The new record has the mark, the sheet, the stamp and the standing, and the summary says so. | FAIL | PASS |
| (d) | The re-key on BOTH paths (NPC_MERGE into a visitor, and a MERGE rename): the name moves; `prev`, `next` and `turn` are kept; nothing waits under the dead name; the re-key is said; the repeat under the new name on a later response commits. Also: the merge and the repeat in one LATER response commit, because the staging turn rides the re-key. | FAIL | PASS |
| (d) | Same-response duplicates. The stage, the merge and the repeat in ONE response leave one proposal under the survivor and say "NOT confirmed (same-response duplicate)". A repeat on the re-keyed proposal's own staging turn is a duplicate too. | FAIL | PASS |
| (d) | The merge moved the preimage: the visitor's "acquaintance" won the fold. The repeat drops the proposal, said ("resident" is now "acquaintance"), with no commit. The next write restages from "acquaintance". | FAIL | PASS |
| (e) | After four merge shapes a colder word on the survivor STAGES and the canon is unchanged. The shapes: a resident into a visitor; a visitor into the resident; a rename; MERGE into a visitor. | FAIL | PASS |
| (f) | Two residents merged. One record is on the roster, with the survivor's mark, its own sheet and its own stamp. No residency line. The survivor's own proposal waits on alone, and the duplicate's is dropped with the ⚠ glyph and said. The survivor's repeat commits. | FAIL | PASS |
| (g) | Save round trip (`serializeWorldState → parseWorldState → migrateWorldState`). The carried mark, the stamp and the re-keyed proposal (name, prev, next, turn) survive it, and the repeat under the new name after the load commits. | FAIL | PASS |

Baseline red line (worktree at `ec0cd67f` plus only the new section): `ENGINE TESTS FAILED (9 of 10)`. Every failure message carried "#614" and the mechanism, for example `the survivor carries the resident mark (#614)` and `the proposal follows the person, its preimage and staging turn kept (#614)`.

## Sabotage clauses (dev/sabotage-593-resident-rel.js, +9 clauses, `mustFail: "#614"`, command `run-tests.js "#614"`)

The new clauses run under their own filter (`CMD614`/`prove614`). The battery's existing `"#593"` filter does not select the `#614` section. Every `find` matches once and every `replace` changes bytes (`check-sabotage-applicability` is green).

I applied each clause by hand to find which tests catch it.

| File | Clause | Caught by |
|---|---|---|
| tag_table.js | the record fold drops the resident mark | (a)×2, (c), (d)×3, (e), (g) |
| tag_table.js | the residency moves in silence (the receipt removed) | (a)×2, (c) |
| tag_table.js | the adopted sheet arrives without its library stamp | (a), (c), (g) |
| tag_table.js | the duplicate's stamp is taken even when the survivor keeps its own sheet | (a) visitor-with-sheet, (f) |
| tag_table.js | the merge leaves a waiting proposal under the dead name (the re-key call removed) | (d)×3, (f), (g) |
| helpers.js | the re-key restamps the staging turn | (d), (g) |
| helpers.js | the re-key is silent | (d) |
| helpers.js | the duplicate's proposal joins the survivor's (two proposals under one name) | (f) |
| helpers.js | the dropped proposal's receipt loses the glyph | (f) |

## Gates and batteries

| Gate | Result |
|---|---|
| `node dev/run-tests.js` (full suite) | **`ALL GREEN — 3074 assertions passed (engine tests)`** and `ALL GREEN — 114 standalone verifier suites`, exit 0 |
| `node dev/run-tests.js "#614"` | `FILTERED GREEN — "#614": 1 section(s) matched, 10 assertions passed` (baseline: `ENGINE TESTS FAILED (9 of 10)`) |
| `node dev/run-tests.js "#593"` | `FILTERED GREEN — "#593": 2 section(s) matched, 32 assertions passed` |
| `node dev/check-es5.js` | `[#481 G10] ES5 check OK — 52 file(s), no const/let, arrow, template or class` |
| `node dev/check-sabotage-applicability.js` | `ALL GREEN — 3171/3171 retained sabotage clauses applicable across 334 batteries` |
| `dev/sabotage-593-resident-rel.js` | exit 0, **18/18** (the 9 original #593 clauses plus the 9 new #614 clauses), every file restored byte-identical |
| `dev/sabotage-504-title-question.js` | exit 0, 76/76 |
| `dev/sabotage-identity.js` | exit 0, 22/22 |
| `dev/sabotage-w2.js` | exit 0, 96/96 |
| `dev/sabotage-537-self-merge.js` | exit 0, 2/2 |
| `dev/sabotage-532-merge-voice.js`, `dev/sabotage-544-alias-reveal.js`, `dev/sabotage-w7.js` (extra: these anchor clauses in the same merge fold) | exit 0: 10/10, 23/23, 26/26 |
| `node dev/fuzz-npc-identity.js 2000 61412` (default count, fresh seed) | `2000 sequences, 8932 replies; 0 distinct violation(s)`; with `swap`: 8942 replies, 0 violations |
| The four CI diff-replay baselines (`corpus_playtest_v1238/v1258/v1271/v1276 --check`) | all `end state matches committed baseline` |

The standard fuzzer runs an adventure world with no residents, so it is a regression check only. To exercise the new paths I wrote a scratch village probe (`scratchpad\probe614.js`, not in the patch).
- **What it does:** it runs random sequences of colder and warmer writes, NPC_MERGE and MERGE renames over three residents and two visitors.
- **What it checks after every reply:**
  - every waiting proposal names a living roster resident;
  - no two proposals share a name;
  - a merge whose either side was a resident leaves a resident survivor;
  - the queue is never an empty array;
  - nothing throws.
- **Results:**
  - Seed 7171: 3000 sequences, 19,446 replies, 6,007 merges, 700 re-keys, 107 collision drops, 0 violations.
  - Seed 90210: 5000 sequences, 1,096 re-keys, 166 drops, 0 violations.
- **The probe can fail:** with the re-key stubbed out, it reports `PROPOSAL UNDER A DEAD NAME` with a two-step shortest sequence.

## Effects of the change (each said where it lands)

1. A merge carries residency only when the duplicate was a resident and the canonical was not. It is said once in the summary: `Resident carried: <dup> -> <canonical>`.
2. From then on the survivor gets the treatment the resident had under its old name, through the existing readers of the mark. Nothing new is invented:
   - the #593 staging;
   - RESIDENTS ABOUT, the roster's ELSEWHERE lead and the resident exchange note (prompt, volatile half);
   - house-owner name matching;
   - the Hall's wall;
   - the library refresh gate (which matches by exact name);
   - the swap's demote shape.

   No stable-half text changes. The diff-replay baselines are byte-identical because none of their worlds hold residents.
3. The stamp `libraryAt` is set only when the survivor adopted the duplicate's sheet object. This is silent because it is metadata of the adopted sheet; the sheet transfer was already silent before #614.
4. A re-key is said: `Resident relation proposal re-keyed: …`. A collision drop is said with ⚠ and a console warning.
5. No new storage key and no save-shape change. `residentRelChanges` entries keep `{name,prev,next,turn}`, and `resident`/`libraryAt` are existing roster fields.

## Left, and why

- **Name-keyed village state that a merge still does not follow.** These predate #614 and the row does not cover them:
  - The resident's house node (`"<village>|<Old Name>'s house"`, `owner:"<Old Name>"`) keeps the old name. Node keys are immutable name-born identifiers, and its stash lives on that node. So after a rename, "Nyla's cottage" can mint a second house for the survivor.
  - `worldState.hallLines[<Old Name>]` (the player's own Hall line) is not re-keyed either.

  Both sit in the location and village domains, not the record fold, and would need an owner ruling: re-point the owner, or merge the houses. Suggested as a separate row if the owner wants it. Village saves are disposable, and a resident merge happens only through the engine-taught merge tags.
- **`statusTurn` is not carried when a rename creates the canonical** (the status is copied, its stamp is not). This is a general fold gap, not specific to residents. I left it alone on purpose: `statusTurn` is W2 death evidence (identity.js:1478), and carrying it is a decision for the drift surface, not part of this row.
- **A hero swap onto a resident who has a waiting proposal** leaves that proposal under what is now the hero's name. It can never confirm (NPC writes on the hero are refused) and it expires after 12 turns, said. This is not a merge, so it is outside #614. Noted only.
- **identity.md, TODO.md, APP_VERSION and CACHE are untouched**, per the brief.

## identity.md, suggested sentence (append to the "#593 resident standing" section)

> **A merge keeps the resident (#614, owner ruling 2026-10-12).** The NPC_MERGE record fold (both merge vocabularies) carries the `resident` mark as the OR of both records, said in the summary as `Resident carried: <duplicate> -> <canonical>`. The library stamp `libraryAt` rides with the sheet the survivor adopts; a survivor that keeps its own sheet keeps its own stamp, because the stamp names the copy a sheet came from. A proposal waiting under the duplicate's name is handed to the survivor by `residentRelRekey` (helpers.js), and the handoff is said. Its preimage and staging turn stay, so a same-response repeat still cannot confirm, and a survivor whose standing is not the preimage drops it at the repeat (the moved-preimage rule). When the survivor has a proposal of its own, the duplicate's is dropped with the ⚠ glyph. Tests `#614` (10); battery `dev/sabotage-593-resident-rel.js` (+9 clauses under the `#614` filter).

TODO row #614 (the tracker is yours to edit): the remedy as filed is done. One difference: the tests live in their own `#614` section rather than in the `#593` section, as the brief asked.
