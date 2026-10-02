# Audit: #504 "ask the GM about a titled relative" was built, reviewed twice, and held (2026-10-02)

**Verdict.** The build is not on master. Two independent reviews each found real defects in successive versions, the second in the fixes for the first. By the standing rule (a fix that fails twice is a stop), the work is held on branch `claude/504-titled-relative` for a redesign. What the reviews found that also exists on master was fixed or filed on master the same night (rows #530 to #538).

**Session.** Fable 5.1, 2026-10-01 evening to 2026-10-02 night. Builder and reviewers were separate agents; each reviewer got the code and the intent, never the builder's conclusions, and reproduced every finding through the real engine.

## 1. What #504 is

The owner's ruling (2026-10-01): a kin or rank title plus a surname only ("Queen Underbough"), landing on the one record that has a given name and does not carry that title ("Wilhelmina Underbough"), is filed provisionally, and the name-collision note (#156) asks the GM: the same person, or another?

Before this work the two merged in silence: consolidation drops titles, and one shared word with exactly one candidate is a match.

## 2. What was built (branch `claude/504-titled-relative`, eleven commits on `7ccaca65`)

| Commit | Row | What |
|---|---|---|
| `5cb5fe66` | #530 | The "different person" answer to a name-collision note passes the merge gate |
| `074adafb` | #504 | The question itself: `npcTitleQuestion`, a provisional keyed by the called name plus a ° suffix, the note's own wording |
| `9df0d386` | #532 | A merge carries the voice a character was pinned with |
| `b3cf2507` | #533 | Word tables in the name code are null-prototype |
| `8d31679e` | #534 | Fixes for the first review: provisional keys out of name resolution, one reading of a merge's operands |
| `84dda630` | #535 | The merge gate reads `[MERGE:NPC\|…]` like the parser |

Every commit passed the full suite, the standalone suites, the four replays and its own sabotage battery. The branch tip passed the range-wide battery sweep. None of that caught what the reviews caught.

## 3. First review (of #530 and #504)

| Finding | Where it comes from | Status |
|---|---|---|
| After an answer, the provisional's old ° key resolved to the established person or to a new record; the new person's note, mood or reported death landed on the wrong record | New with #530 | Fixed on the branch (#534); see review 2 |
| The same-person answer written with a short form ("Wilhelmina") landed as a twin record | New with #530 and #504 | Fixed on the branch (#534), which then over-corrected; see review 2, first finding |
| While a question was open, the bare surname and other spellings of the called name forked into new records | New with #504 | Fixed on the branch (#534), which then over-corrected; see review 2, second finding |
| After a hero swap, the note's own tag made an NPC roster row under the hero's name | New reach with #504 | Partly fixed on the branch; see review 2, third finding |
| `[MERGE:NPC\|a\|b]` skipped the merge gate and fused two established people | Old | **Fixed on master (#535)** |
| Proposals queued under the name as written were discarded, so they could never be confirmed | Old | Fixed on the branch only |
| Names the question misses: family names of several words, apostrophes, hyphens, suffixes ("the Younger"), "Queen-Mother" | #504's predicate | Open; for the redesign |
| False questions: "Sir Voss" beside "Ser Aldric Voss"; a spouse whose partner's pronouns arrive later in the same reply | #504's predicate | Open; for the redesign |
| A scene handle bound while a question was open cannot vouch after the answer (refused loudly) | Old class | Open; for the redesign |
| An NPC name containing the word "constructor" threw inside the name reader | Live since #503 | **Fixed on master (#533)** |

## 4. Second review (of #533, #534, #535)

| Finding | Where it comes from | Status |
|---|---|---|
| The "different person" answer fused the two people whenever the new name still held the shared name ("Savah Dunmere" beside "Savah") | New with #534 | **The reason for the hold.** The fix read any name that resolves to the established person as "the same person"; consolidation matches in both directions |
| While a question is open, names the two new matchers miss land on the established person: `Queen_Underbough`, "Old Queen Underbough" in a death tag, a near-miss of the ° key | New with #534 | Open. Before #534 these forked; now they fuse, which is worse |
| The hero is still a merge target through any form of her name but the exact one | New with #534 | Open |
| The fuzz proof quoted in #534's commit ran on 288 distinct sequences, not 30,000: the generator's arithmetic overflowed into a short cycle | The first reviewer's fuzzer | The claim "none now" is withdrawn. With a sound generator the fix does remove the stale-key and orphan classes, and other flags appear |
| "A repeated answer prints one receipt" holds only for the ° key | Old; claimed fixed | Open |
| A mistyped ° key in an answer vanished with no line anywhere (no scene refs) | New with #534 | Open |
| `dev/npc-merge-core.js` reads the new refusal line as a mutation | New with #534 | Open |
| Natural "different" names are refused ("Old Queen Underbough", "Lady Underbough") and the note repeats unchanged | #534, declared | Open; a live model is needed to judge the loop |
| Other word tables of the "constructor" class: retrieval stop words, the button filter | Old | **Fixed on master with #533** |
| A self-merge (`[NPC_MERGE:Bram\|Bram]`) without scene refs grows the record's events until the engine throws "Invalid array length" | Old | **Fixed on master (#537)** |
| `[NPC_NOTE:<hero>\|…]` and `[NPC_PRONOUN:<hero>\|…]` make an NPC record and roster row for the hero | Old | Filed (#538) |

Checked and clean in the second review: #535 over 86,800 spellings; #533 through thirteen tags; 19,000 fuzzed sequences with a sound generator (no throw, no established record merged away without a confirmed pair); the resolver on odd input; whole turns with a question open and answered.

## 5. Why patching stopped

Each round moved the leak instead of closing it:

1. #504 asked only at the `[NPC:]` tag and gave the provisional a made-up key. That key then took part in name resolution (forks, stale keys).
2. #534 took the key out of resolution. The established person became the only candidate for every spelling the exact matchers missed, so forks turned into fusions, and "resolves to the established person" was read as "is the same person", which fused the natural different-person answer.

The mechanism under both: **identity is being inferred from name shape at many seams** (the `[NPC:]` handler, the merge gate, the merge handler, the resolver that every other tag uses), and each seam's inference can disagree with the others. A name-shape rule that is safe in one direction (fork) is unsafe in the other (fuse), and the two directions trade against each other.

## 6. Direction for the redesign (row #534)

Not built; these are the conclusions the two reviews support.

1. **One boundary for every write that names a person**, not only `[NPC:]`. A name that raises the question files the provisional wherever it first appears: a reported death, a scene handle, a note. This also closes #531.
2. **The provisional keeps the name it was called by as its key.** No derived key, so nothing goes stale and the GM reads and writes a natural name. The pending question is a stamp on the record.
3. **The answer is explicit, never inferred from the canonical's shape.** "The same person" requires the established record's exact name or a registered alias. "Another person" is its own statement and may keep the name or give a new one. A loose form is refused, and the note says so in words (the second review's tenth finding).
4. **Fusion needs exactness; forks stay recoverable.** Where the engine cannot tell, it must fork or ask, never fold.
5. **A live model must answer the note before it ships.** No owner save has ever held a provisional record, so a real GM's answer to any name-collision note is still unseen. The preview was signed out on the night.
6. **Proof must include an independent review and a fuzzer with a sound generator.** The batteries and the suite were green at every step.

## 7. What went to master instead (2026-10-02)

| Row | What | State |
|---|---|---|
| #525, #514, #506 | The three other rulings of 2026-10-01 | Built; an independent review of the three ran the same night (see their rows) |
| #533 | The "constructor" crash and its class in the word tables | Fixed |
| #535 | The merge gate's spelling hole | Fixed |
| #537 | The self-merge blow-up | Fixed |
| #530 | The different-person answer never lands with scene refs active | Filed (latent: no save holds a provisional) |
| #531 | A death tag naming a never-introduced titled relative lands on the relative | Filed |
| #532 | A merge drops the voice a character was pinned with | Filed (a fix with a 6/6 battery is on the branch) |
| #534 | The redesign above | Filed |
| #536 | A tag operand that is a built-in object key | Filed |
| #538 | Tags that file the hero as an NPC | Filed |

## 8. Evidence

- The branch `claude/504-titled-relative` carries the build, its tests and batteries, and both reviewers' probes and fuzzers under `audits/reviews/504_titled_relative/` (paths inside them point at the review session's scratch folder and need adjusting to run).
- Field: of 208 names across the owner's eight campaigns, none raises the #504 question today; none of 850 NPC names holds the word "constructor"; no save has ever held a provisional record.
