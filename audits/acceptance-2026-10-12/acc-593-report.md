# Acceptance 2026-10-12: TODO #593, resident standing ("confirm to commit")

Worktree base: `5e36f598`. No engine code was changed. The only edit is a new section in `dev/engine-tests.js`, `acceptance 2026-10-12 — #593 resident standing`, at lines 28014-28201, placed just before `#518 block`. It holds 21 tests, and every test name starts with `#593 acceptance`.
Patch: `C:\Users\hannu\AppData\Local\Temp\claude\C--Projects-traffic-and-dragons\97fd7790-74cc-480c-82d3-71fee5adeb06\scratchpad\acc-593.patch` (188 insertions, `dev/engine-tests.js` only).

**Result: 17 PASS, 4 FAIL.** All four failures are in how a relation word is classified or matched. The staging machinery itself held under every probe.

## Verdict table

| # | Case | Verdict | One line |
|---|---|---|---|
| 1 | Two residents, interleaved proposals | PASS | Each proposal is keyed by its own name. Nyla's repeat commits only Nyla. Bram's "hostile" is refused against Bram's own "wary" and does not touch Nyla. Both repeats in one later reply commit each their own. |
| 2 | Cap of 8 | PASS | 8 proposals wait. The 9th gets `⚠ … REFUSED (8 proposals already waiting): Nyla stays "resident"` and is not queued. A confirmation frees a slot that the next resident takes. At t17 the 7 proposals from t5 expire before the write is judged. |
| 3 | Expiry boundary (11 and 12 turns), said once | PASS | A repeat 11 turns later confirms. At 12 the proposal expires first (one receipt), and the matching repeat restages instead of committing. Two writes in the expiring reply say it once, and a later reply says nothing. |
| 4 | Save round trip, then commit | PASS | The proposal survives `serializeWorldState → parseWorldState → migrateWorldState`, and also store → `loadState()`. The repeat after either load commits. |
| 5 | Tag forms | PASS | Full form: the status lands and stamps `statusTurn`, the relation waits, and the full-form repeat commits it. The relation-only form stages and commits the same way. The two-slot `[NPC:Nyla\|hostile]` writes the mood only and stages nothing. |
| 6 | 15 colder words stage | PASS | Every word stages: hostile, enemy, wary, bitter rival, cold, distrustful, resentful, estranged, wants you dead, sworn against, afraid of you, contemptuous, betrayed, grudging, shunned. |
| 7 | 10 warmer or neutral words land at once | PASS | Every word lands at once: old friend, ally, trusted, fond, neighbour, business partner, mentor, in love, grateful, amused. |
| 8 | Fence words | PASS (pinned as observed) | guarded stages; cool, formal and nervous land at once. My opinion on each is below; I think "cool" is misclassified. |
| 9 | The hero's own name | PASS | `⚠ NPC write refused (player): Tess` for both forms. Nothing is staged and no record is created. |
| 10 | Visitor with no resident mark, in the village | PASS | Orrin's "hostile" lands at once. A stranger first registered by the same tag ("enemy") lands at once. |
| 11 | Adventure kind, resident-marked NPC | PASS | Lands at once, both with no kind and with an explicit `adventure`. `kindDef().residentRelConfirm === false`. |
| 12 | Standing already cold, another cold word | PASS | wary → sworn against, cold → hostile, hostile → wants you dead: all land at once, nothing staged. |
| 13 | Provisional or collision names | PASS | "Brightwater", the alias "the Weaver", "nyla brightwater" and "Nyla" all stage on the canonical name "Nyla Brightwater", and the full name then confirms. A titled surname, a surname two residents share, or an introduction-shaped write is filed as a separate record and never touches the resident. |
| 14 | ⚠ on refusal receipts (the A7 rule) | PASS | Duplicate, moved preimage, different change, full queue and hero lines all lead with ⚠. Staged, confirmed and withdrawn lines are plain. |
| 15 | Village rule in the GM-facing STATE TAGS doc | PASS | The village sentence is in `buildStateTagsDoc()` and in `buildSysPrompt().stable`, and not in the volatile half. An adventure has it nowhere. |
| 16 | `residentRelChanges` deleted (not `[]`) when the last proposal resolves | PASS | The key is gone after confirm, warmer withdraw, moved preimage, expiry, and an already-cold landing. |
| 17 | No leak across `makeWorld()` | PASS | The reset world has no key and `residentRelPending` returns null. The same write in the new world stages afresh and does not confirm. |
| 18 | Colder words outside the word list | **FAIL** | 14 of 14 plainly colder words land at once on a resident. |
| 19 | Warm phrases containing a cold substring | **FAIL** | "fearless ally" and "unafraid friend" stage, with a ⚠ toast calling them a colder standing. |
| 20 | Warming phrase that names the old cold word | **FAIL** | "warming, no longer wary" is refused as a different colder change, and the stale "wary" proposal keeps waiting. |
| 21 | Case-only variant of the staged relation | **FAIL** | "Hostile" after "hostile" is refused as a different change, so nothing commits. |

## Failing probes

### 18. Colder words outside `RESIDENT_REL_ADVERSE_RE` land at once
- **Input:** village, resident Nyla (rel "resident"), one reply `[NPC:Nyla||<word>]` at t5. Words: despises you, nemesis, adversary, antagonist, scornful, vengeful, feuding, on bad terms, dislikes you, icy, frosty, unforgiving, terrified of you, would see you hanged.
- **Observed:** for every word, `rel === <word>` immediately and no queue key exists. The only receipt is `NPC: Nyla`; there is no staging receipt and no toast.
- **Expected:** staged, canon unchanged. Each of these is colder than "resident"; the contract stages "a COLDER word".
- **Mechanism:**
  - `helpers.js:3621`: `RESIDENT_REL_ADVERSE_RE` is a closed list of word stems.
  - `helpers.js:3638`: `if(!residentRelAdverse(next)||residentRelAdverse(prev))` treats any word the list lacks as warmer and returns true.
  - The guard is a denylist, so one synonym it lacks rewrites a neighbour's standing in one reply. That is exactly the case #593 exists to stop.
- **More words my exploration found landing at once:** jealous, annoyed, irritated, disappointed, disgusted, aloof, distant, threatened, intimidated, opponent, fallen out. Some of these are moods rather than standings; aloof and distant are fence words.
- **Remedy direction (owner's call):** either widen the list, or invert the test so that only known-warm words land at once and anything unknown stages. Inverting moves the burden onto the warm side. It would also fix probe 19, but would stage unfamiliar neutral words.

### 19. A warm phrase containing a cold substring stages
- **Input:** `[NPC:Nyla||fearless ally]` and `[NPC:Nyla||unafraid friend]` on rel "resident".
- **Observed:**
  - `rel` stays "resident" and the queue holds `{next:"fearless ally"}` (and likewise for "unafraid friend").
  - Receipt: `Resident relation change staged: …`.
  - Toast: `⚠ Nyla's standing was written "fearless ally" — a resident's relation moves only through sustained play…`
- **Expected:** a warmer word lands at once (contract).
- **Mechanism:**
  - `helpers.js:3621`: the alternatives have no word boundaries (only `\bfoe` does). So `fear` matches "fearless" and `afraid` matches "unafraid".
  - The same flaw matches `cold` in "scolding", `anger` in "danger", `rival` in "arrival", `hate` in "whatever"/"chatelaine", and `wary` in "unwary".
- **Severity:** low. The failure is fail-safe (the warm word is delayed, not lost) and loud. But the toast tells the player something false.

### 20. "warming, no longer wary" is refused while "wary" waits
- **Input:** t5 `[NPC:Nyla||wary]` (staged). t6 `[NPC:Nyla||warming, no longer wary]`.
- **Observed:**
  - `rel` stays "resident" and the queue is still `[{"name":"Nyla","prev":"resident","next":"wary","turn":5}]`.
  - Receipt: `⚠ Resident relation change refused — a different change is already awaiting confirmation: Nyla ("wary" staged t5, "warming, no longer wary" written)`.
- **Expected:** a warmer word lands at once and withdraws the waiting proposal (contract).
- **Mechanism:**
  - `helpers.js:3621` matches "wary" inside the negation, so `helpers.js:3638` classifies the phrase as colder.
  - That takes it into the pending branch (`helpers.js:3642-3647`), where the strict `p.next!==next` check refuses it.
- **Severity:** medium. The outcome is the wrong way round: the warming is refused, the cold proposal survives, and a later plain "wary" would still commit it. The sequence is plausible, because the GM's own prose said she was wary even though the roster never showed it.

### 21. A case-only variant does not confirm
- **Input:** t5 `[NPC:Nyla||hostile]`, then t6 `[NPC:Nyla||Hostile]`.
- **Observed:** `rel` stays "resident" and the queue is unchanged. Receipt: `⚠ Resident relation change refused — a different change is already awaiting confirmation: Nyla ("hostile" staged t5, "Hostile" written)`.
- **Expected:** the same relation commits on a later response. A change of case is the same relation.
- **Mechanism:** `helpers.js:3647` compares with `p.next!==next`, which is case-sensitive. `clampNpcMood` (`memory.js:1254`) only trims.
- **Severity:** low. The refusal is loud, and a later exact repeat still commits. But a GM that alternates capitalisation never commits, and the proposal expires after 12 turns.

## Fence words: classification and opinion

| Word | Classified | Right? |
|---|---|---|
| guarded | stages (`guarded` is in the regex) | Yes. It is a withdrawal of trust and reads colder. |
| cool | lands at once ("cool toward you" lands too) | **No, in my view.** It is the mild form of "cold", which stages. A cooling resident is exactly the drift #593 guards against. |
| formal | lands at once | Defensible. It describes register more than standing. From "old friend" it is colder, but it is ambiguous. |
| nervous | lands at once | Defensible. In the relation slot it is usually a mood leaking in. "afraid of you" stages, and "nervous" is too weak to treat as a standing change. |

The fence test pins these observed classifications, so a change to any of them shows up as a red test.

## Not a #593 probe, but it defeats the guard (not in the patch)
**A merge drops the resident mark.**
- **What I saw:**
  - `[NPC_MERGE:The Weaver|Nyla Brightwater]`, where "The Weaver" is an existing visitor record, leaves a record "The Weaver" that carries Nyla's sheet but no `resident:true`.
  - The next `[NPC:The Weaver||hostile]` lands at once.
  - `[MERGE:npc|Nyla Stormwater|Nyla Brightwater]` (a rename) also drops the mark.
  - After that rename, a proposal staged under "Nyla Brightwater" is never rekeyed. Nothing outside `helpers.js` mentions `residentRelChanges`. The proposal sits under the dead name until it expires.
- **Mechanism:** `tag_table.js:751` builds the new canonical without `resident`, and the field fold at `tag_table.js:753-764` copies partyMember, charSheet, portrait, pronouns, dead, status, rel and met, but never `resident`.
- **Scope:** this predates #593, and it also affects the roster and whereabouts. It is reachable only through the engine-only merge tags, which the GM is taught only by the name-collision note.
- **Suggestion:** a separate TODO row, not a #593 blocker.

## Other observations (no verdict)
- **Two receipts are plain:** the expiry receipt (`Resident relation proposal expired unconfirmed: …`) and the staged receipt. A7's vocabulary does not cover them. The expiry is a designed outcome, and the staged line is paired with a ⚠ toast, so I would leave both.
- **The 12-turn boundary:** a repeat that arrives exactly 12 turns after staging expires the proposal first and restages it, so a third write is needed. This matches `>=` at `helpers.js:3627` and the existing `#593` expiry test.
- **A titled surname loses the cold word silently.** "Mistress Brightwater" is filed as a separate record (#504) and its "hostile" lands there. If the GM then answers by merging it into Nyla, the canonical's "resident" wins (`tag_table.js:764`). So the cold word neither stages nor lands on the resident. That is the protective direction.

## Gate lines
- `node dev/run-tests.js "acceptance 2026-10-12"` reports `ENGINE TESTS FAILED (4 of 21)`: probes 18 to 21. The other 17 pass.
- `node dev/check-es5.js` reports `[#481 G10] ES5 check OK — 52 file(s), no const/let, arrow, template or class`.
- `node dev/run-tests.js` (full suite) reports `ENGINE TESTS FAILED (4 of 2983)`: the same four probes and nothing else.
  - The runner skips its standalone layer when the engine suite is red, so I ran `node dev/run-standalone-suites.js` directly: `ALL GREEN — 113 standalone verifier suites`.
  - The pre-commit hook would block this patch as-is.
- `node dev/check-sabotage-applicability.js` reports `ALL GREEN — 3119/3119 retained sabotage clauses applicable across 333 batteries`.
- `node dev/sabotage-593-resident-rel.js` reports 9/9 caught, exit 0. **That proof is vacuous while probes 18 to 21 are red.**
  - Why: its filter `"#593"` also selects the acceptance section, and its `mustFail: "#593"` matches the red probes' names.
  - Re-run of the shipped battery's clauses against only the original section (filter `"confirm to commit"`; scratch wrapper `scratchpad\sab-593-original-only.js`): 9/9 caught, files restored byte-identical. The battery's own proof stands.
- **My passing probes can fail.** A scratch battery (`scratchpad\sab-acc593.js`, not in the patch) made 11 mutations, each attributed by the exact acceptance test name: expiry `>=`→`>`, cap `>=`→`>`, expiry leaves `[]`, confirmation leaves `[]`, pending ignores the name, expiry never splices, cap receipt loses ⚠, parse drops the key, hero check skipped, status dropped when the relation is staged, adventure flag flipped. Result: 11/11 caught, files restored byte-identical.
