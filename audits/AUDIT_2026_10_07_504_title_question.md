# Audit: #504 "a titled relative is asked about, not merged" — the redesign (2026-10-07)

**Verdict.** Built on master as the #534 redesign, not on the held branch. Rows #504, #530, #531 and #534 close together; #538's three legs (a note, a pronoun and a merge naming the hero) landed here as well because the fuzzer kept finding them. The held branch `claude/504-titled-relative` is superseded and can be deleted.

**Session.** Fable 5.1, 2026-10-07. Owner's ruling 2026-10-01: (b), ask the GM.

## 1. What changed, and why the earlier build was held

The 2026-10-02 build inferred identity from a name's shape at several seams (the `[NPC:]` handler, the merge gate, the merge handler, the resolver), and the two reviews showed each rule that closed a fork opened a fusion. The record is [AUDIT_2026_10_02_504_titled_relative.md](AUDIT_2026_10_02_504_titled_relative.md). This build follows that audit's six directions:

1. **One boundary for every write that names a person — the resolver.** `resolveNpcName` answers "its own person" for a kin or rank title on a family name that has exactly one candidate (`npcConsolidation(name).ask`, memory.js). Every tag and the summary extractor then file the name under itself. A reported death, a scene handle, a note, a link, a combat foe: none reaches the relative (#531's three seams are tests).
2. **The provisional keeps the name it was called by as its key.** A post-handler seam, `npcStampTitleQuestions` (identity.js), runs once per `applyMuts` and once per `applySummaryExtract` over the keys the reply created and stamps the ones that raise the question: `provisional:{of,turn,called,title}`. No derived key; nothing goes stale. The #156 introduction case keeps its ° key and its predicate.
3. **The answer is explicit.** ONE reader, `npcMergeAnswer(tag,canonical,duplicate)` (identity.js), serves the W2 gate and the `NPC_MERGE` handler. Operands are read exactly (key, registered alias, case and separators, a folded ° key's destination) and never by consolidation. The same person is `[NPC_MERGE:<established exact name>|<called name>]`; another person is `[MERGE:npc|<their name>|<called name>]`, or the called name again to keep it. A short form, a title, a ° filing key, the hero, two open questions against each other: refused, said in the summary and the console, and the note re-asks next turn with the reason (`worldState.provisionalRefused`, on `NOTE_LATCH_FIELDS`).
4. **Fusion needs exactness; forks stay recoverable.** A second title on the family name while a question is open is ambiguous and forks into its own record. A merge the gate judged on older state (an earlier tag of the same reply folded the provisional, or registered an alias) is re-judged by the handler on the state it acts on and proposed, never folded.
5. **A live model answers the note before it ships.** See §5.
6. **Proof includes an independent review and a fuzzer with a sound generator.** See §4 and §6.

## 2. Files

| File | Change |
|---|---|
| memory.js | `npcNameWords` (one tokenizer; separators are spaces), `_NPC_ASK_TITLES` (kin and rank, null-prototype; sir/ser folded), `npcRecordWords`, `npcTitleQuestion`, `npcKeyTitle`, `npcTitledRecord`, `npcConsolidation.ask`, `npcTitleAsk`, `npcExactKey(name,fold)`, `npcFormerKey`; `resolveNpcName` gains the exact-up-to-case key step, the folded-key step, the titled-record step and the question; `fileNpcEvent` refuses the hero; the extraction seam |
| identity.js | `npcKeySet`, `npcStampTitleQuestions`, `_npcMergeOperand`, `npcMergeAnswer`, `npcMergeRefuse`; `w2MergeAllowed`/`w2MergePropose` take the tag and read through the one reader; `buildProvisionalNudge` words the title case, says a refusal back once, never offers the hero; `npcUpsertTarget` never splits a provisional; `_identityRouteLegacy` carries `R.viaTag` so the handler knows the generic form |
| tag_table.js | `NPC_MERGE`: the one reader, refusals, keep, the handler-side re-judgement under scene refs, a duplicate on no record refused instead of receipted, the called name kept as the survivor's alias, the canonical's own name never carried in, the renamed record settled; `NPC_ALIAS`: the canonical read exactly (and through a folded key), a ° key never an alias, an alias that is another record's name refused with the merge tag, the hero's name never an alias, a self-alias ignored; `NPC_PRONOUN` refuses the hero |
| api.js | the key snapshot and the seam in `applyMuts`; `provisionalRefused` on `NOTE_LATCH_FIELDS` and the builder's latch list |
| dev/engine-tests.js | section "#504" (15 tests); two #503 lines changed by the ruling (a same-sex title and a father's title are questions now) |
| dev/sabotage-504-title-question.js | the battery (memory 18, identity 20, tag_table 15, api 1 clauses) |
| dev/fuzz-npc-identity.js | the sequence fuzzer (the second reviewer's generator and invariants, ported) |
| dev/sabotage-identity.js, -w2.js, -272-…, -503-… | four anchors re-aimed at the moved lines |

## 3. What the fuzzer found and this build closed

Each was reproduced through the real engine before the fix, and has a test and a battery clause.

| Class | Mechanism | Fix |
|---|---|---|
| STALE | `MERGE` runs before `NPC_NOTE`; a note to a ° key in the answering reply landed on the person it was split from | a folded ° key resolves to where its merge went (`npcFormerKey`, the merge archive) |
| ZOMBIE | a ° key in another case, or a spelling of it, made a second ° record | the resolver's exact step folds case and separators on keys; a spelling of a live or folded ° key names it |
| ALIAS-SHADOW, ALIAS-ON-TWO, OWN-ALIAS | the alias handler created a record under an existing alias, put one alias on two records, aliased a record to itself | the alias handler reads its canonical exactly and refuses an alias that is another record's name |
| UNCONFIRMED | the gate judged a merge before the table; an earlier tag of the reply changed what its operands name, and the handler folded an established person | the handler re-judges plain and other-record merges under scene refs |
| the reversed repeated answer | the second copy named the folded key first and folded the established person into a new ° record | operands read through the folded-key step; a ° key is never a name |
| HERO-MEM, HERO-ROW | a note, a pronoun or a merge naming the hero (or her old alias after a swap) filed her as an NPC (#538) | refused at `fileNpcEvent`, `NPC_PRONOUN`, and in the one merge reader as either operand |
| a provisional of a provisional | an introduction-shaped tag split an open question again | never |

Final runs: seeds 4242 (4000), 7 with hero swaps (2000), 99 with hero swaps (6000), 31337 with hero swaps (4000): 0 violations. The fuzzer's two bookkeeping limits are recorded in its header comments: a note that travels through a chain of GM-confirmed merges, and a canonical created by an alias in the same reply.

## 4. Proof

- `node dev/run-tests.js`: ALL GREEN (engine) and every standalone suite.
- `node dev/sabotage-504-title-question.js`: every clause proven (see §2 for counts).
- The four replay baselines (`dev/diff-replay.js … --check` v1238, v1258, v1271, v1276): end states match.
- `node dev/fuzz-npc-identity.js`: 16,000 sequences over four seeds, 0 violations.
- Field census (the owner's eight latest saves, 176 memory keys): no provisional on file; every key resolves to itself under the new resolver; no name on file would raise the question if it arrived fresh beside the rest; four keys of the title-plus-surname shape exist (Father Vane, Lord Sildaris, Mother Vane, Brother Osric) and are now reachable by their spelling variants.

## 5. The live model

**Not run on 2026-10-07.** The preview at `localhost:8123` was signed out with no provider key, and signing in is the owner's. No save has ever held a provisional record, so a real GM's answer to the name-collision note (either wording) is still unseen. The procedure, once the owner signs the preview in: install `dev/playtest-harness.js`, `__ptPreflight()`, `__ptUseModel("gemini","gemini-3.7-flash")`, `__ptStart` a throwaway campaign whose blueprint seeds a "Wilhelmina Underbough", steer two scripted turns to bring "Queen Underbough" on stage, read `memory.npcs` for the stamp and `sessionLog` for the delivered note, then read the GM's answering tag from the next reply's `tagLog` entry; `__ptDeleteRun()` afterwards. Budget: a few turns under the standing allowance.

## 6. Independent review

**Owed.** One reviewer was launched after commit `a3a61edf`, given the code and the intent but never this record's conclusions. It stopped before reporting any finding when the Fable credits ran out on 2026-10-07. It counts as no review. The build is committed and **not pushed**: the independent-review gate for drift-surface work is unmet. Queued as todo_checkWithFable.md ▸ Pending Fable review, entry 38, with the probe list a reviewer should start from.

## 6a. The range sweep after the commit, and the test-only follow-up (Opus 5.5, 2026-10-07)

`node dev/run-sabotage-diff.js origin/master..HEAD` ran 82 batteries after the commit. 80 passed and two failed. The cause was the same in both: the new behaviour answers before the older guard speaks, so the older tests no longer reach the guard their battery mutates.

| Battery | Clauses that stopped attributing | Why the old test went blind |
|---|---|---|
| `sabotage-503-npc-kept-apart.js` | the veto removed; a ruled-out candidate stops counting; the record's own pronouns; pronouns that state no sex; the crown clause; the record's aliases | Every fixture used a record with a given name, so the #504 title question asks before the #503 veto or the count speaks. The field-case test also read "filed separately" in the #504 receipt as proof of the veto. |
| `sabotage-identity.js` | the pipe refusal disabled | The mis-split probe named a duplicate that is on no record. The #504 handler now refuses that loudly, so the probe stayed clean even without the pipe rule. |

The follow-up adds cases the question cannot mask, and loosens nothing. The new cases use a record with no given name, the son arriving beside the king, a crown or an age stated by a record's alias, and a mis-split merge of two real records. The field-case test now also requires that a contradiction is never a provisional question. After the follow-up, `sabotage-503-npc-kept-apart.js` proves 19/19 + 2/2 + 2/2 and `sabotage-identity.js` proves every group. No engine file changed. The Fable session's own proof set (§4) already covered the #504 battery, which was 55/55 before the sweep and is untouched by this change.

## 7. Left open

- ~~The mirror case (a given name arriving beside a bare-title record, "Wilhelmina Underbough" beside "Queen Underbough") still consolidates; the owner's call.~~ **Ruled 2026-10-10: ask, as the forward case does — built at v1.1214** (`npcTitleQuestion`'s mirror branch; the note's direction; a question of an open question is never stamped — the fuzzer found that one on the first run). Tests `#504 mirror` (4), battery +5 clauses (61/61), fuzzer 0 violations over 16,000 sequences.
- Family names of several words, apostrophes and suffixes ("the Younger") do not raise the question (one distinctive word is the shape); a false question costs one note.
- #538's `NPC_LINK`, `NPC_FACTION` and relationship legs are not covered here; the branch `claude/532-538-voice-hero` still carries #532 (voice carry on merge).
