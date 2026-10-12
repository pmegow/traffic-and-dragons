# Acceptance 2026-10-12: identity rows #504, #530, #531, #534 (engine half)

Tester: Opus 5.5, worktree `agent-a7f3941d51f240fb4` at `5e36f598` (engine v1.1226). Test-only: no engine file changed. Probes are 22 engine tests in the new section `acceptance 2026-10-12 — identity (#504 #530 #531 #534)` in `dev/engine-tests.js`, placed right before the `#518 block` section. The live-GM answer (#534 direction 5) is out of scope and was not attempted.

## Verdict table

| Row | Verdict | One line |
|---|---|---|
| #504 | **FAIL** | The forward and mirror cases pass in the exact shapes the build covers. But a rank title written after the family name ("the Underbough Queen") silently fuses onto the princess, the original #504 defect in another word order. A given name with anything after the family name, or with the family name first, silently fuses onto the bare "Queen Underbough" (6 of 6 shapes). A refused hero answer is not said back, although the contract says it is. |
| #530 | **FAIL** | The ANOTHER answer itself lands with live scene evidence, so the row's original bug is fixed. But the scene handle the GM bound under the called name is stranded afterwards: binding it again to the answered person creates an identity conflict on her. |
| #531 | **FAIL** | Title deaths in the covered shapes land correctly, with or without a stated rank and after every answer. These do not: "[NPC_DEATH_REPORTED:the Underbough Queen]" kills the princess; the mirror shapes kill the bare queen; a death through the bound handle after an answer is quarantined; a death report by title followed by SAME kills a princess who has plot armor. |
| #534 (engine) | **FAIL** | The resolver boundary holds across 23 tags. The gate re-judge holds, and a save round trip keeps every identity field byte-identical. But SAME after a link between the queen and the princess leaves a self-link that the NPC GRAPH prompt block renders. `titleSettled` does not survive a later plain merge (fuzzer STALE at seed 60606). Direction 4 ("forks or asks, never folds") is broken by the #504 shapes above. |

Section result: 13 passed, 9 failed, all 9 expected from the traced mechanisms. All 11 scratch-clone mutations aimed at the passing tests were caught by the named test (see Gates).

## Per failing probe

### 1. `#504 acceptance the mirror case in the shapes GM prose writes …`
- **Input:** only a bare "Queen Underbough" on file (she/her, status "holding court"), then `[NPC:<name>|composed|neutral]` for six names:
  - "Wilhelmina Underbough, the queen's daughter"
  - "Wilhelmina Underbough the Younger"
  - "Wilhelmina Underbough of Elderwood"
  - "Wilhelmina Underbough II"
  - "Wilhelmina Underbough-Vane"
  - "Underbough Wilhelmina"
- **Observed:** all 6 land on the Queen. Her status becomes "composed", no second record is created, and nothing is said.
- **Expected:** each one is asked about (the mirror ruling) or kept apart. #534 direction 4 says the engine never folds when it cannot tell.
- **Mechanism:**
  - The mirror branch in `npcTitleQuestion` (memory.js:154) fires only when the family word closes the arrival (`inCore[inCore.length-1]===kCore[0]`).
  - The forward branch (memory.js:155) needs exactly one distinctive word, so these names get no question.
  - `npcConsolidation` (memory.js:197–207) then admits the bare record, because its one token `[underbough]` is a subset of any name that contains it. With one candidate, `resolveNpcName` (memory.js:268–270) returns the Queen.
  - The audit's "left open" note (suffixes and multi-word names do not raise the question; "a false question costs one note") only holds in the forward direction, where not asking means a fork. In the mirror direction, not asking means a silent fusion.
- **Controls:**
  - Shapes that drop to two core words still ask: "the Elder", "Young …", "(the queen's daughter)", "Wilhelmina 'Mina' Underbough", "Wilhelmina of House Underbough".
  - The plain shape passes in every writer and spelling (probe "#504 acceptance the mirror case: …", PASS).

### 2. `#504 acceptance a rank title AFTER the family name …`
- **Input:** "Wilhelmina Underbough" on file (she/her, no rank, status "bored, captive"), then `[NPC:the Underbough Queen|furious|hostile] [NPC_NOTE:…|wants the wedding called off] [NPC_PRONOUN:…|she/her]`. The same for "Underbough Queen" and "the Underbough Queen-Mother".
- **Observed:** for all three names, the princess's status becomes "furious", the note is filed on her, and no other record exists.
- **Expected:** the same title question that "Queen Underbough" raises, with nothing landing on her.
- **Mechanism:**
  - `npcTitleQuestion` reads only titles that stand before the family word (memory.js:156–157, `for(i=0;i<at;i++)`).
  - "queen" is a stop word, so the core is `[underbough]`.
  - Consolidation (memory.js:197–207) then resolves to the one Underbough.
  - Separately, `npcNameSays` reads a title closing a name after a plain word as a surname (memory.js:77, the "Marla King" rule), so the #503 contradiction cannot fire for a male title written this way either.

### 3. `#504 acceptance the hero as an answer operand is said back …`
- **Input:** Queen Underbough is open and the note is delivered at t85. At t86 the GM writes `[NPC_MERGE:Tess|Queen Underbough]` (and in a second run `[NPC_MERGE:Queen Underbough|Tess]`; Tess is the hero).
- **Observed:**
  - The refusal is in the summary (PASS in the answer-forms probe).
  - At t87 `buildProvisionalNudge()` returns "".
  - `provisionalRefused` is null and `provisionalNudged` is still `{"Queen Underbough":85}`, so the cooldown is not cleared.
- **Expected:** identity.md (#504 bullet) lists "the hero as either operand" among refusals where "the note says the reason back once (`worldState.provisionalRefused`) with the cooldown cleared".
- **Mechanism:** `npcMergeAnswer` returns `dupe:null` for both hero refusals (identity.js:993–994). `npcMergeRefuse` latches the reason only when `ans.dupe` is set (identity.js:1016).
- **Severity:** low. The refusal is loud, and the note re-asks after the 5-turn cooldown without the reason.

### 4. `#530 acceptance after the ANOTHER answer under live scene refs the handle … still binds the person`
- **Input:**
  - Scene refs on. At t84 `[SAY:Wilhelmina Underbough|…]`.
  - At t85 `[NPC:Queen Underbough|furious|hostile] [SAY:Queen Underbough|…] [SCENE_CAST:Wilhelmina Underbough|Queen Underbough] [SCENE_REF:queen|Queen Underbough]`.
  - At t86 `[MERGE:npc|Isolde Underbough|Queen Underbough]`, which lands.
  - At t87 `[SCENE_REF:queen|Isolde Underbough] [SCENE_REF:queen|Queen Underbough]`.
- **Observed:** one unresolved identity conflict, `Isolde Underbough/queen: scene handle already binds to Queen Underbough`. The handle's entity is still the raw string "Queen Underbough". A rebind in the answering reply itself is refused the same way.
- **Expected:** the handle is the answered person's (the called name is now her alias), and a rebind to her is not a conflict.
- **Mechanism:**
  - `sceneRefBind` stores the name resolved at bind time (identity.js:1318).
  - A rebind compares the stored raw string with the newly resolved name (identity.js:1316).
  - The NPC_MERGE tail re-keys graph edges, factions, relationships and the guestbook, but not `worldState.sceneRefs` actors (tag_table.js:768).
- **Consequence (documented, not exercised here):** an unresolved conflict on a subject makes `w2PrepareResponse` withhold completion tags whose payload names that subject.

### 5. `#531 acceptance a death naming the relative by a title AFTER the family name …`
- **Observed:**
  - `[NPC_DEATH_REPORTED:the Underbough Queen|fever|Elderwood]` kills Wilhelmina Underbough: "Wilhelmina Underbough: dead AS REPORTED".
  - `[SCENE_REF:queen|the Underbough Queen]` binds "Wilhelmina Underbough". The envelope `[CANON_TXN_BEGIN:a12p|npc-death|-|queen|-][SCENE_DEATH:queen][CANON_TXN_END:a12p]` one turn later kills her.
  - In the mirror world, `[NPC_DEATH_REPORTED:<name>]` kills the bare "Queen Underbough" for "Wilhelmina Underbough, the queen's daughter", "Wilhelmina Underbough the Younger" and "Underbough Wilhelmina".
- **Expected:** never the person who only shares the surname. This is the row's own definition of the defect.
- **Mechanism:** the same as probes 1 and 2. `NPC_DEATH_REPORTED` (tag_table.js:875) and `sceneRefBind` (identity.js:1315) both resolve through `resolveNpcName`.

### 6. `#531 acceptance after either answer under live scene refs, a witnessed death through the handle …`
- **Input:** the live scene from probe 4. At t86 the answer is either SAME (`[NPC_MERGE:Wilhelmina Underbough|Queen Underbough]`) or ANOTHER (`[MERGE:npc|Isolde Underbough|Queen Underbough]`). At t87 an envelope arrives with subject = the answered person and evidence `queen`, carrying `[SCENE_DEATH:queen]`.
- **Observed:** both are quarantined with "scene evidence does not bind the claimed victim". The handle's entity is still "Queen Underbough".
  - Subject "Queen Underbough" (her alias) is quarantined the same way.
  - Subject `-` with the handle commits, and so does the named subject with evidence `-` (named presence). A working route therefore exists.
- **Expected:** the death lands on the answered person.
- **Mechanism:** raw string comparisons of the stored entity, which nothing re-keys after the merge:
  - `w2DeathAuthorized`: `if(hit.actor.entity!==canon)return false;` (inside identity.js:1407).
  - `sceneRefDeath`: `if(subj&&hit.actor.entity!==subj)` (identity.js:1374).
  - Merge tail: identity.js:1318 and tag_table.js:768, as in probe 4.
- This applies to any merge, but the #504 answer is solicited mid-scene, so it is the routine case here.

### 7. `#531 acceptance a reported death by title followed by the SAME answer respects the princess's plot armor`
- **Input:**
  - The princess's roster row has `armor:2`, and Act 2 is pending, so `plotArmor(W)` returns `{act:2}`.
  - Control: `[NPC_DEATH_REPORTED:Wilhelmina Underbough|…]` is refused by armor.
  - Then `[NPC_DEATH_REPORTED:Queen Underbough|fever|Elderwood]` (lands on the unarmored provisional queen), and at t86 `[NPC_MERGE:Wilhelmina Underbough|Queen Underbough]`.
- **Observed:** after the SAME answer the princess is dead (row dead=85, memory dead=85) while her armor still reads `{"act":2,…}`. The only receipt is "Merged: Queen Underbough -> Wilhelmina Underbough".
- **Expected:** #319 says every death path consults plot armor. Before #504, the same report resolved to her and was refused.
- **Mechanism:** the merge's death carry (memory at tag_table.js:740, "B3"; roster row at tag_table.js:762) copies `dead` without calling `plotArmor`. The report itself only checked the queen (tag_table.js:879).

### 8. `#534 acceptance the SAME answer never leaves a person linked to herself …`
- **Input:** `[NPC:Queen Underbough|…] [NPC_LINK:Queen Underbough|Wilhelmina Underbough|mother] [NPC_LINK:Bram|Wilhelmina Underbough|guard]`, then SAME at t86.
- **Observed:**
  - Edge `{"a":"Wilhelmina Underbough","b":"Wilhelmina Underbough","rel":"mother"}`.
  - `buildNpcGraph()` renders `Wilhelmina Underbough: ↔ Wilhelmina Underbough(mother) [T85]  ↔ Wilhelmina Underbough(mother) [T85]  ↔ Bram(guard) [T85]`. This is the NPC GRAPH block that `buildSysPrompt` includes (api.js:2737).
- **Expected:** no self-edge (#538: a character cannot link to themself).
- **Mechanism:** the NPC_MERGE tail rewrites `a`/`b` from the duplicate to the canonical without dropping a resulting self-edge (tag_table.js:768). `npcLinkUpsert` refuses self-links only at write time (memory.js:2129).

### 9. `#534 acceptance a settled identity stays settled through a later merge (the fuzzer's STALE at seed 60606)`
- **Input:** without scene refs: t85 `[NPC:Queen Underbough|…]`; t86 `[MERGE:npc|Mother Underbough|Queen Underbough]` (settled); t87 `[NPC_MERGE:Queen Mother Underbough|Mother Underbough]`.
- **Observed:** the new key "Queen Mother Underbough" is stamped `provisional:{of:"Wilhelmina Underbough",title:"queen"}`, and at t88 the NAME COLLISION note asks about her again.
- **Expected:** `titleSettled` stops the seam re-asking a record the GM already answered.
- **Mechanism:** `titleSettled` is set only for `_mgAns.kind==="new"` (tag_table.js:768) and is not carried from a duplicate into a plain-merge canonical. `npcStampTitleQuestions` (identity.js:947–985) stamps any new unsettled key.
- **The fuzzer trace** (`fuzz-npc-identity.js 50000 60606`, 1 of 50,000 sequences):
  - t86 renames the queen to "Mother Underbough", then a plain merge in the same reply folds that record into a new "Princess Underbough". Scene refs are off, so plain merges land.
  - The seam asks about "Princess Underbough" as a new question of Wilhelmina.
  - At t88 the exact SAME answer folds the queen's record, which the GM had called another person, into Wilhelmina. A note to "Queen Underbough" then lands on her.
  - Every fold is a GM tag with a receipt. Two of the three links are inside the fuzzer's documented bookkeeping limit (a note travelling through GM-stated merges). The engine's own re-ask is the third link.
- **Severity:** low.

## Observations (not counted as failures)
- **Questions between same-reply newcomers.** With two newcomers in one reply ("Hilda Underbough" and "Queen Underbough", in either order, with the princess on file), Hilda is stamped as a question "of" the Queen, a record created in the same reply. The Queen-vs-princess question is never asked, because Hilda makes it ambiguous. Nothing fuses, and no question is ever about an open question.
- **A redundant mirror question.** "Wilhelmina Underbough" is still asked about when the bare Queen's record carries the alias "Wilhelmina". This is safe from forks, but the question is redundant.
- **Titles outside `_NPC_STOP`.** "Duchess", "Empress", "Dowager Queen", "Her Majesty Queen", "Aunt", "Widow" and similar on the family name fork silently: a new record with no question. This was already the behaviour before the ruling, which does not cover these words.
- **A gate drop with no summary line.** Under scene refs, a plain merge the W2 gate drops (for example `[NPC_MERGE:Isolde Marsh|Isolde Underbough]` in the same reply as the rename that creates Isolde Underbough) goes to the console only. Nothing is folded, and no proposal is queued.
- **A death carried by SAME is not said.** When a SAME answer folds a dead provisional into the established person, the receipt says only "Merged: …" and does not mention the death.
- **Roster-only aliases.** A roster-only alias ("Mina" on the princess's row but not in memory) is resolved by `resolveNpcName`, but the answer reader refuses it ("not an exact name on file"). The refusal is loud and nothing changes.

## Passing probes (13)
- **#504, the plain mirror case:** 5 spellings × 4 first writers ([NPC:], note, reported death, alias). Each is a provisional question of the Queen, keyed as called; the Queen stays byte-identical.
- **#504, stated rank:**
  - With princess as a memory alias, or as a roster alias only, the Queen is its own person, unasked, and the contradiction is said.
  - Known as queen: lands on her.
  - Known only as lady: still asked.
  - Male line: a prince on file keeps the King apart; with no rank, the King is asked.
- **#504, keyed as called:** "the Queen Underbough", "queen underbough" and "Queen Underbough (her mother)" are each keyed and called exactly as written. The note's tags carry the key, four later spellings gather on the one record, and SAME by that key lands with her notes.
- **#504, a second title while the question is open forks:** [NPC:], note, reported death and scene handle each fork. Neither the princess nor the open question is written.
- **#504, the stamp never makes a question of an open question:** two newcomers in either order, with and without the princess on file. A newcomer first named by a death beside the open question is her own person.
- **#504, answer forms:**
  - SAME: exact name; alias, also in other case; separators; reversed operands; the generic form.
  - ANOTHER: settled.
  - Five loose forms are refused, the records stand, and the reason is said back once.
  - Five hero forms are refused and the records stand.
- **#530, ANOTHER with live scene evidence (SAY, SCENE_CAST, SCENE_REF):** renamed; the alias carried; presence evidence carried; the princess untouched; no proposal; the note silent past the cooldown. The mirror keep-the-name answer lands the same way.
- **#531, title deaths in the covered shapes:**
  - No rank: the provisional dies and is asked about.
  - Rank princess: a separate queen dies.
  - Rank queen: the death is hers.
  - `[NPC:…|dead]` without scene refs: the provisional. With scene refs: refused, and the princess is untouched.
  - A handle bound by title alone binds the title, and its death never reaches the princess.
  - Male line: the provisional king dies and the son lives.
- **#531, after each answer:**
  - SAME: the princess.
  - ANOTHER: the renamed relative dies and the princess lives.
  - Keep: the queen.
  - Mirror SAME: the queen.
  - Mirror keep: the daughter dies and the queen lives.
- **#531, summary extractor:**
  - With no queen on file, W2 validation refuses the death loudly and the princess is untouched.
  - With the question open, the death and the notes (also "Old Queen Underbough") land on the queen, with and without scene refs.
- **#534, resolver boundary:** 23 tags, each alone and all at once, naming "Queen Underbough" beside a companion princess with a sheet. Her memory, roster row, sheet, faction membership and graph edges stay byte-identical. The only new record is the provisional queen, nothing merges, and every write is said in the summary or the console.
  - The tags: NPC_NOTE, NPC_PRONOUN, NPC_SUPERSEDE, NPC_FORGET, RELATIONSHIP_BOND, RELATIONSHIP_DYNAMIC, COMPANION_HP, COMPANION_CONDITION, COMPANION_ITEM_GAINED, COMPANION_ABILITY, COMPANION_XP, COMPANION_RELATIONSHIP_BOND, PARTY_MEMBER, PARTY_SPLIT, LOCATION_RESIDENT, NPC_ALIAS, NPC_LINK, NPC_FACTION, SAY, SCENE_CAST, SCENE_REF, NPC_DEATH_REPORTED and [NPC:|dead].
  - Companion tags by title are dropped with a console line naming the tag.
- **#534, gate re-judge:**
  - An alias registered earlier in the reply, followed by OTHER: proposed, not folded.
  - A rename, then a plain merge into Isolde Marsh: not folded.
  - SAME, then OTHER: not folded.
  - The stale gate proposal does not confirm itself the next turn.
- **#534, save round trip:** `parseWorldState(serializeWorldState())` and the real `loadState` door keep `memory.npcs` and the world-side fields byte-identical: `provisionalNudged`, `provisionalRefused`, `pendingMergeHints` and `sceneRefs`. After the load, the note says the latched reason back, and SAME lands.

## Fuzzer (`node dev/fuzz-npc-identity.js [N] [seed] [swap]`, default N=2000)

| Seeds | Sequences | Replies | Distinct violations |
|---|---|---|---|
| 2027 | 2000 | 9,135 | 0 |
| 8675309 | 2000 | 8,985 | 0 |
| 5150 swap | 2000 | 9,011 | 0 |
| 123457 swap | 2000 | 9,034 | 0 |
| 918273 swap (long pass) | 50,000 | 225,412 | 0 |
| 60606 (long pass) | 50,000 | 224,226 | **1: STALE** (1 of 50,000; traced in probe 9) |

## Gates

| Gate | Result |
|---|---|
| `node dev/run-tests.js "acceptance 2026-10-12"` | ENGINE TESTS FAILED (9 of 22). The 9 are the probes above; the other 13 pass. |
| `node dev/run-tests.js` (full) | Exit 1, ENGINE TESTS FAILED (9 of 2984). All 9 failures are this section's; the other 2975 assertions and every contract check before them pass. A red engine suite makes run-tests skip the standalone layer, so I ran `node dev/run-standalone-suites.js` separately: ALL GREEN, 113 standalone verifier suites. |
| `node dev/check-es5.js` | `ES5 check OK — 52 file(s)`. It polices root `.js` files only and does not read `dev/`. I scanned the new section separately: no const/let, arrow functions, template literals or classes. |
| `node dev/check-sabotage-applicability.js` | ALL GREEN, 3119/3119 retained clauses applicable across 333 batteries. The new code introduces no ambiguous anchor. |
| `dev/sabotage-504-title-question.js` | 61/61 proven (18+20+16+1+1+3+2), scratch files restored byte-identical. |
| `dev/sabotage-503-npc-kept-apart.js` | 23/23 proven. |
| `dev/sabotage-identity.js` | 22/22 proven. |
| `dev/sabotage-535-merge-gate-spelling.js` | 3/3 proven. |
| `dev/sabotage-537-self-merge.js` | 2/2 proven. |
| `dev/sabotage-w2.js` | 96/96 proven. |
| Scratch self-proof of the 13 passing probes (not shipped; `scratchpad/prove-acceptance.js`) | 11/11 mutations caught by the named acceptance test. They cover: the title question removed (3 probes), the #503 crown clause removed, the titled-record lookup removed, the single-candidate rule loosened, the answer reader's case-folded alias removed, the question-of-a-question guard removed, a new-name ANOTHER forced to need confirmation again (#530's original bug), the renamed record not settled, and the handler re-judge removed. |

Notes on the gates:
- **Batteries ran with the 9 red tests in the tree.** The 504 battery's `#504` filter matches this section, and the W2 and identity batteries run the full suite. Every clause in these batteries carries `mustFail`, so a clause counts only when its own named test fails.
- **Attribution check.** I scanned 2,731 `mustFail` references across 334 batteries against the acceptance failure text. Only `sabotage-410-car-pause.js` (`"action"`) overlaps, and its `helpers` filter never runs this section.
- **The standalone layer is blocked while the 9 stay red.** Until the defects are fixed, any battery clause that only a standalone suite could catch cannot be proven, because the full suite stops before that layer.
- **Harness correction, reported faithfully.** The first section run had a 10th red: the 23-tag boundary probe, at `[NPC_ALIAS:Queen Underbough|Her Majesty]`. The diff was only `"coin":0` added to the companion fixture's sheet by the #598 purse heal (`coinHeal`, helpers.js:2234–2238). Every loaded sheet carries that field, so I gave the fixture the healed shape (`coin:0`). No assertion was loosened.
- **Not done:** the live-GM answer (#534 direction 5); no provider was used. No engine file, TODO.md, APP_VERSION or CACHE was touched. Nothing was committed.

## Files
- Patch: `C:\Users\hannu\AppData\Local\Temp\claude\C--Projects-traffic-and-dragons\97fd7790-74cc-480c-82d3-71fee5adeb06\scratchpad\acc-identity.patch` (one file, `dev/engine-tests.js`, 22 tests).
- Worktree: `C:\Projects\traffic-and-dragons\.claude\worktrees\agent-a7f3941d51f240fb4\dev\engine-tests.js` (section before `#518 block`), left unstaged.
- Logs (scratchpad):
  - `full-suite.log`, `standalone.log`, `applicability.log`
  - `fuzz\fuzz-*.log`
  - `batteries\*-full.log`
  - repro scripts `repro-60606.js` and `explore1.js`–`explore7.js`
