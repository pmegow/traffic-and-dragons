# Fix report: #616, four name shapes ask (owner ruling 2026-10-12; shape 2 per the owner's call on option b)

**Session:** Opus 5.5, worktree `agent-a718c027030d2413e` at `ec0cd67f`. Nothing committed or pushed. `TODO.md`, `APP_VERSION` and `CACHE` are untouched.

**Patch:** `C:\Users\hannu\AppData\Local\Temp\claude\C--Projects-traffic-and-dragons\97fd7790-74cc-480c-82d3-71fee5adeb06\scratchpad\fix-616.patch`. It is one diff against `ec0cd67f` and applies cleanly to an archive of that commit:
- `memory.js`: +101 / −15
- `dev/engine-tests.js`: +127 / −1
- `dev/sabotage-504-title-question.js`: +75 / −7

`identity.js` needed no change. The stamp seam (`npcStampTitleQuestions`) and the answer reader (`npcMergeAnswer`) already do the right thing once `npcConsolidation(...).ask` names the title.

**Drift surface.** This is identity-layer work done by Opus 5.5. The decree makes it Fable/Astra tier, so it needs a `todo_checkWithFable.md` line and one independent review before it is pushed. I did not edit that file.

**Full suite: ALL GREEN.** 3073 engine assertions, plus the 114 standalone suites.

## Verdict per shape

| # | Shape | Result | One line |
|---|---|---|---|
| 1 | Family name of several words, forward and mirror | **asks** | A hyphenated or particle-led family name is one family word. The forward case reads a closing run of the candidate's words. |
| 2 | Family name first, forward ("Queen Underbough" beside "Underbough Wilhelmina"), **with a registered alias** that gives the order ("Wilhelmina Underbough", on either store) | **asks** | The forward question reads the record's words in the order that alias gives (option b). |
| 2 | Family name first, forward, **bare record (no such alias)** | **folds: documented limit** | It has the same shape as the pinned "Princess Wilhelmina is Wilhelmina Underbough", so the pinned fold stands. The test asserts this so any change shows. |
| 2 | Family name first, mirror ("Underbough Wilhelmina" beside the bare "Queen Underbough") | **asks** (already did) | Now pinned under #616 too. |
| 3 | The record's own title plus a generation word, forward and mirror | **asks** | A generation word one name has and the other lacks is asked about before the own-title rule can fold it. |
| 4 | A possessive of the titled record, forward and mirror | **filed as another person; no question** | The possessor phrase is dropped before the name is read. The queen is never a candidate and never asked about. The receipt says why. |

**Measured through the real engine** (`scratchpad/shapes616.js`, run on a `git archive` of HEAD and on the patch): **21 outcomes changed, every one FUSED → ASKED or FUSED → FORKED. None moved toward fusion.** The full lists are in `shapes616-base.txt` and `shapes616-fix.txt`. The probe's family-name-first record has no alias, so it still shows the limit: "Queen Underbough" FUSED.

| Beside | Name | HEAD | Patch |
|---|---|---|---|
| Wilhelmina Underbough-Vane | Queen Underbough-Vane / the Underbough-Vane Queen | FUSED | ASKED (queen) |
| Anneke Van Helsing | Queen Van Helsing | FUSED | ASKED (queen) |
| Wilhelmina Rose Underbough | Queen Rose Underbough | FUSED | ASKED (queen) |
| Queen Underbough-Vane (bare) | Wilhelmina Underbough-Vane | FUSED | ASKED (queen) |
| Queen Van Helsing (bare) | Anneke Van Helsing | FUSED | ASKED (queen) |
| Queen Underbough (bare) | … the Younger / … the Elder / … II / … Junior / Queen Wilhelmina Underbough the Younger | FUSED | ASKED (queen) |
| Queen Underbough the Younger | Queen Underbough / Wilhelmina Underbough the Younger | FUSED | ASKED (queen) |
| Queen Underbough the Elder | Queen Underbough / Old Queen Underbough | FUSED | ASKED (queen) |
| Queen Underbough | Queen Underbough's champion Aldric / Queen Underbough's mother / Aldric, Queen Underbough's champion | FUSED | FORKED (own record, receipt) |
| Queen Underbough's champion Aldric | Underbough | FUSED | FORKED |
| Tam | Tam's mother / Tam's son Bran | FUSED | FORKED |
| Underbough Wilhelmina, alias "Wilhelmina Underbough" | Queen Underbough | FUSED | ASKED (queen); proven by the engine test, not part of the probe |

**Unchanged on purpose.**
- **Folds:** Old Queen Underbough, the Queen Underbough and Queen Wilhelmina Underbough → the bare queen. Queen Wilhelmina Underbough-Vane → the bare Queen Underbough-Vane. Princess Wilhelmina and Queen Wilhelmina → Wilhelmina Underbough. Queen Underbough → the bare "Underbough Wilhelmina" (the limit). Lady Vane → Mother Vane. Belor Hemlock → Sheriff Hemlock. Lady Marla → Marla King. Aldric → the champion's record.
- **Forks:** Duchess, Aunt and Widow Underbough fork as before.

---

## 1. A family name of several words (memory.js)

**Mechanism.**
- **Forward:** `npcTitleQuestion` asked only when the arrival had exactly ONE distinctive word closing the candidate. "Queen Underbough-Vane" has two core words (`underbough`, `vane`), so the subset match folded it onto Wilhelmina Underbough-Vane.
- **Mirror:** the mirror branch and `npcKeyTitle` required the record's core to be one word. The bare "Queen Underbough-Vane" had no title, so a given name beside her folded onto her.

**Change.**
- **The forward guard** (`memory.js:238`) reads a CLOSING RUN: the arrival's distinctive words (generation words aside) end the candidate's, and the candidate has more. The old one-word shape is the run of one.
- **New `npcFamilyUnit(k,core)`** (`memory.js:184–200`): a record key's family name is one word, one hyphenated word, or a name led by family particles (`_NPC_FAMILY_PARTICLES`: van, von, de, del, della, der, den, di, du, da, dos, das, la, le, ter, ten, mac, mc, ap, zu). It skips the hyphen split for keys with no hyphen, because it runs on every resolve.
- **`npcKeyTitle`** (`memory.js:248`) uses it, on the core with generation words stripped.
- **The mirror condition** (`memory.js:232`) is now "the arrival holds every word of the record's and more".
- **`npcTitledRecord`** (`memory.js:257–264`) compares the WHOLE core and the generation words; it compared the first word only. Once `npcKeyTitle` accepts several words, the old first-word compare would have resolved "Queen Underbough" onto an open "Queen Underbough-Vane". That would be a new fusion path, so it is pinned by a test and a clause.

**Tests** (section `#616 four shapes ask (owner ruling 2026-10-12)`, `dev/engine-tests.js:28839`):
- `#616 shape 1 forward …` covers Queen Underbough-Vane, the Underbough-Vane Queen and Queen Van Helsing. For each it checks:
  - a provisional question of her, keyed by the name as called;
  - a receipt naming both;
  - her record byte-identical;
  - both exact tags in the note, "under a title";
  - SAME folds, and the alias finds her;
  - ANOTHER files a settled new person, with her record untouched.
- `#616 shape 1 mirror …` covers Wilhelmina Underbough-Vane and Anneke Van Helsing with the same checks (the note says "by a given name"). Queen Wilhelmina Underbough-Vane is still her.
- `#616 while a question of the new shapes is open …`: spellings gather on the open question. "Queen Underbough" is neither her nor it.

**Clauses** (`dev/sabotage-504-title-question.js`, `#616` group, command `run-tests.js "#616"`):

| Clause | Caught by |
|---|---|
| shape 1: the forward question reads one family word only again | `#616 shape 1 forward` |
| shape 1: a record's family name is one word again | `#616 shape 1 mirror` |
| shape 1: a particle-led family name is not read as one | `#616 shape 1 mirror` |
| shape 1: a hyphenated family name is not read as one | `#616 shape 1 mirror` |
| a titled record is found by its first family word again | `#616 while a question of the new shapes is open` |

## 2. A record written family-name-first (memory.js): option (b)

**Mechanism.** The forward question needs the arrival's family word to CLOSE the candidate's words. A record keyed "Underbough Wilhelmina" opens with its family word. So "Queen Underbough" was never asked about and folded onto her.

**What the names cannot say.** That shape is identical to "Princess Wilhelmina" beside "Wilhelmina Underbough": a title plus the record's first word. `#504 who is NOT asked` pins that as her. Any rule that reads only the two names asks on both or on neither. I measured the "either end" alternative: it breaks two pinned tests (`#504 who is NOT asked` for Princess Wilhelmina, and `#503 … King Aldric`).

**Change (the owner's option b).** New `npcFamilyOrder(k,kF,inF)` (`memory.js:194–207`), called just before the forward guard (`memory.js:237`). The guard line itself is byte-identical.
- If the key's own words do not close with the arrival's, the function looks through the record's **registered aliases on both stores**.
- An alias whose distinctive words END with the arrival's and hold more ("Wilhelmina Underbough", "Mina Underbough") is the GM's own word for which word is the family name. The forward question reads that alias's words, then asks as usual: title not known, SAME and ANOTHER as for the plain shape.
- An alias that does not end with the family word says nothing of the order, and the key's words stand. Two examples: "Lady Wilhelmina", and "Underbough Mina", which is itself written family-first.

**Documented limit.** The bare family-name-first record, with no such alias, keeps the pinned fold.

**Tests.**
- `#616 shape 2 forward — a family-name-first record with a registered alias asks; the bare record (no alias) still folds by the pinned 'title + her first word is her' rule (documented limit)` asserts:
  - a memory-store alias "Wilhelmina Underbough" makes it a question, and SAME and ANOTHER land;
  - a roster-store alias "Mina Underbough" does the same;
  - an alias written family-first ("Underbough Mina") listed BEFORE "Wilhelmina Underbough" still asks;
  - the aliases "Lady Wilhelmina" and "Underbough Mina" keep the fold;
  - **the bare record still folds** (one record, her status taken, no note). The failure message says to update identity.md and TODO #616 if this ever starts asking.
- `#616 shape 2 mirror …` pins the mirror question and both answers.

**Clauses:**

| Clause | Caught by |
|---|---|
| shape 2: the record's aliases are not read for the name order | `#616 shape 2 forward` |
| shape 2: the roster-side aliases are not read for the name order | `#616 shape 2 forward` |
| shape 2: the first alias holding the family word sets the order | `#616 shape 2 forward` |
| shape 2: the mirror question skips a family name written first | `#616 shape 2 mirror` |

The alias-order clause first came back MISSED. The forward guard re-checks the closing run itself, so the alias closing check only matters when a non-closing alias that holds the family word comes BEFORE the one that gives the order. I added that ordering case to the test. The clause is now caught, proven alone and in the full battery.

## 3. The record's own title plus a generation word (memory.js)

**Mechanism.** The mirror's own-title guard ("a name that carries her title is her") folded "Queen Underbough the Younger" onto the bare "Queen Underbough". "… the Elder" never reached the guard: "elder" is a stop word, so the core was her exact core, and `npcTitledRecord` resolved it to her. The reverse also folded: "Queen Underbough" beside a record "Queen Underbough the Younger".

**Change.**
- **New `_NPC_GEN_WORDS`** (`memory.js:173–182`): elder, eldest, older, younger, youngest, senior, sr, junior, jr, first…fifth, ii, iii, iv, vi–ix. Single letters are left out, because an initial is not a generation. Helpers alongside it: `npcGenWords`, `_npcNoGen`, `_npcCovers`, `_npcSaysTitle`.
- **A new first clause in `npcTitleQuestion`** (`memory.js:220`) asks when all of these hold:
  - the record is a bare titled family unit;
  - the generation words of the two names differ;
  - the arrival carries the record's own title;
  - the arrival's family words cover the record's.
- **`npcKeyTitle`** strips generation words first. **`npcTitledRecord`** requires the same generation.

**Tests.**
- `#616 shape 3 the record's own title with a generation word …`: the Younger, the Elder, II and "Queen Wilhelmina Underbough the Younger" are asked; SAME and ANOTHER land. "Old Queen Underbough", "the Queen Underbough" and "Queen Wilhelmina Underbough" are still her.
- `#616 shape 3 mirror …`: the bare "Queen Underbough" beside "… the Younger" or "… the Elder" is asked, and both answers land.
- The "while a question is open" test covers the spellings.

**Clauses:**

| Clause | Caught by |
|---|---|
| shape 3: a generation word is not asked about | `#616 shape 3 the record's own title` |
| shape 3: a spelling of another generation finds the titled record | `#616 shape 3 the record's own title` |
| shape 3: a record's generation word is read as a name | `#616 shape 3 mirror` |

**Noted, not changed.**
- "Old Queen Underbough" beside a record "Queen Underbough the Elder" now asks. It is probably her, so this is a likely false question, at the cost of one note.
- The note says "under a title" for a generation question. I did not reword the engine note, which is prompt text.

## 4. A possessive of the titled record (memory.js)

**Mechanism.** `npcCoreTokens` turns "underbough's" into `underbough` plus `s`. So "Queen Underbough's champion Aldric" held the one Underbough on file as a subset. Then `npcKeptApart` and the own-title guard read "Queen" as the champion's own title, and the champion folded onto the queen. The reverse folded too: the queen, or a bare "Underbough", landed in a record keyed "Queen Underbough's champion Aldric". By the same path, "Tam's mother" was Tam.

**Change.**
- **New `npcPossessed(name)` and `npcPossessedCore(name)`** (`memory.js:71–98`, memoized, null-prototype). In each comma clause it drops the possessor phrase. The phrase runs from the clause start (or the nearest article, or just after the nearest preposition) through the last possessive word that has a word after it. Results:
  - "Queen Underbough's champion Aldric" → "champion Aldric"
  - "Aldric, Queen Underbough's champion" → "Aldric, champion"
  - "Aldric the Queen's champion" → "Aldric champion"
  - "Tam's mother" → "mother"

  Quoted nicknames and parentheticals are left alone.
- **Wider than "leading", on purpose.** You asked for a leading possessive. The appositive "Aldric, Queen Underbough's champion" fused onto the queen by the same mechanism, so the reader handles both.
- **`npcConsolidation`** (`memory.js:293–294`, plus `_npcPossReaches` at `memory.js:303`): a candidate counts only when the shared words reach past a possessor on BOTH sides; otherwise it is not counted at all. Two possessives whose owned words are all role words compare as before.
- **The title question** (`memory.js:299`) reads the possessed text.
- **What the name says** (`npcKeptApart`) and **what the record key says** (`npcRecordSays`) are read without the possessor.
- **The receipt.** `out.poss` feeds the receipt (`memory.js:344`): `⚠ Queen Underbough's champion Aldric is not Queen Underbough (a possessive: it names someone of theirs) — filed as a separate person`.

**Tests.**
- `#616 shape 4 a possessive of the titled record names ANOTHER person …`:
  - the champion gets his own record, keyed by the name as called;
  - the queen is byte-identical, and no question is asked;
  - the receipt says why;
  - a later "Aldric" (he/him) is him;
  - with an Aldric on file, the champion lands on Aldric;
  - the queen arriving beside the champion's record is her own person.
- `#616 shape 4 the possessor's words never name the person, wherever the possessive stands …`:
  - the appositive form is not the queen;
  - "Tam's mother" is not Tam;
  - "Tam's old mother" is still "Tam's mother";
  - "Underbough's daughter" is not "Tam's daughter";
  - four forms of the Queen's champion are all Aldric.

**Clauses:**

| Clause | Caught by |
|---|---|
| shape 4: the possessor's words reach a candidate again | `#616 shape 4 a possessive` |
| shape 4: a possessive record is a candidate for its possessor again | `#616 shape 4 a possessive` |
| shape 4: the possessor's title is the name's again | `#616 shape 4 a possessive` |
| shape 4: a possessive record's key speaks for him | `#616 shape 4 a possessive` |
| shape 4: the receipt is silent | `#616 shape 4 a possessive` |
| shape 4: an appositive possessor is read as the name | `#616 shape 4 the possessor's words` |
| shape 4: two role-word possessives are kept apart | `#616 shape 4 the possessor's words` |

---

## Existing tests and clauses touched (none loosened)

- **`#527 resolver protects only current hero names, aliases and player before exact NPC aliases`** (`dev/engine-tests.js:27282`, kept per the owner's call). After the hero swap this test expected "Ammut" to reach "Ammut's old master" through the possessor's word. That is the shape-4 mirror fusion. The fixture now gives the master the exact alias "Ammut". The assertion is unchanged, and the pre-swap loop now also proves the shield outranks that alias.
- **`#503 a title word that is the person's SURNAME says nothing; someone else's title (a possessive) says nothing`.** One assertion added: `npcNameSays("The Queen's Champion Aldric").sex` is null. The resolver now drops the possessor before reading, which left the 503 battery's tokenizer clause MISSED. The tokenizer rule is still read raw (aliases, a trailing possessive), and the clause is caught again.
- **Four 504-battery anchors re-aimed, same mutations:**
  - "a title beside a GIVEN name asks too"
  - "a record with no given name is asked about"
  - "the mirror branch is gone"
  - "the mirror question needs the family word to close the arrival again"

## Gates (final code)

| Gate | Result |
|---|---|
| `node dev/run-tests.js "#616"`, before the change | 7 of 8 red. Only the shape-2 mirror was green; the acceptance lane had already fixed it. |
| `node dev/run-tests.js "#616"` | FILTERED GREEN, 9 assertions |
| `node dev/run-tests.js "#504"` | FILTERED GREEN, 46 assertions |
| `node dev/run-tests.js "#503"` | FILTERED GREEN, 11 assertions |
| `node dev/run-tests.js "#527"` | FILTERED GREEN, 64 assertions |
| `node dev/run-tests.js` (full) | **ALL GREEN — 3073 assertions passed (engine tests)**, plus ALL GREEN for the 114 standalone verifier suites; exit 0 |
| `node dev/check-es5.js` | ES5 check OK, 52 files |
| `node dev/check-sabotage-applicability.js` | ALL GREEN, 3181/3181 clauses applicable across 334 batteries (19 new) |
| `dev/sabotage-504-title-question.js` | **95/95 proven** (76 existing incl. 4 re-aimed + 19 new #616), every file restored byte-identical, 134 s |
| `dev/sabotage-503-npc-kept-apart.js` | **23/23 proven** (19+2+2; the possessive-tokenizer clause re-guarded, see above), restored byte-identical, 42 s |
| `dev/sabotage-identity.js` | **22/22 proven**, restored byte-identical, 94 s |
| `dev/sabotage-w2.js` | **96/96 proven** (full mode, every clause attributed), restored byte-identical, 290 s |
| `dev/diff-replay.js … --check` v1238 / v1258 / v1271 / v1276 | all four end states match the committed baselines |

Every #616 clause runs `run-tests.js "#616"` and names ONE test in `mustFail`, so each catch belongs to exactly the test named.

**Fuzzer** (`node dev/fuzz-npc-identity.js`, final code):

| Seed | Sequences | Replies | Violations |
|---|---|---|---|
| 60606 | 50,000 | 224,478 | **0** |
| 616001 (fresh) | 2,000 | 9,049 | 0 |
| 909616 swap (fresh) | 2,000 | 8,988 | 0 |

The reply counts moved slightly from the run before option (b) (224,468). The fuzzer registers random aliases, so the alias path now turns a few replies into questions.

The repo's fuzzer writes none of the four shapes. I built a scratch variant (`scratchpad/make-fuzz616.js`) that adds 13 names: hyphenated, family-name-first, generation words, possessives and an appositive possessive. The repo file is unchanged. Results:
- seed 61606 × 50,000 (225,063 replies): **0 violations**
- seed 61607 swap × 20,000 (89,733 replies): **0 violations**

## What identity.md must change (suggested wording)

1. **#504 bullet, the forward shape.** Replace "one distinctive word closing a candidate that has more" with: "the arrival's distinctive words (generation words aside) a closing run of a candidate that has more — one family word, or a family name of several words ("Queen Underbough-Vane" beside "Wilhelmina Underbough-Vane", "Queen Van Helsing" beside "Anneke Van Helsing"; #616); a record keyed family-name-first is read in the order its registered aliases give (`npcFamilyOrder`: an alias on either store whose words end with the arrival's, "Wilhelmina Underbough" on "Underbough Wilhelmina"; owner's call 2026-10-12)".
2. **#504 bullet, the mirror sentence.** After "`npcKeyTitle` reads the record's title on either side of its family word", add: "; the family word may be a hyphenated or particle-led family name (`npcFamilyUnit`: "Queen Underbough-Vane", "Queen Van Helsing"), and a generation word is no part of it (#616)".
3. **#504 bullet, new sentence after the mirror.** "**A generation word asks too (#616, owner ruling 2026-10-12):** the record's own title with a generation word one name has and the other lacks ("Queen Underbough the Younger", "… the Elder", "… II" beside the bare "Queen Underbough", or the bare name beside "Queen Underbough the Younger") is asked about before the own-title rule could fold it (`_NPC_GEN_WORDS`; single letters are initials, not generations). `npcTitledRecord` finds a titled record only by its whole family name and the same generation."
4. **#503 bullet.** Replace "a possessive is someone else's title" with: "a possessive names someone else (#616, owner ruling 2026-10-12): `npcPossessed` drops the possessor phrase from each clause ("Queen Underbough's champion Aldric" → "champion Aldric", "Aldric, Queen Underbough's champion" → "Aldric, champion"), and the consolidation scan reaches a candidate only through the words left on both sides. The champion is never the queen, the queen never folds into her champion's record, and "Tam's mother" is not Tam. The `[NPC:]` receipt says so (`X is not Y (a possessive: it names someone of theirs) — filed as a separate person`). Two possessives whose owned words are all role words compare as before."
5. **Recorded limits** (replacing the fix lane's four-shape list): "**A bare family-name-first record still folds a title on its first word (#616, documented limit):** "Queen Underbough" beside a record keyed "Underbough Wilhelmina" with no alias that gives the order is filed on her. It has the shape of "Princess Wilhelmina" beside "Wilhelmina Underbough", pinned as her, and the names cannot tell which word is the family name. A registered alias ending with the family word closes it. Pinned both ways by `#616 shape 2 forward — …`. A family name of several plain words on a bare titled record ("Queen Ash Wood") cannot be told from a given name and family name, so a given name beside it is not asked. Titles outside `_NPC_STOP` / `_NPC_ASK_TITLES` fork, as before."

## Residual limits and observations

- **Bare family-name-first record:** it still folds (the documented limit above).
- **A possessor holding a preposition is dropped only in part.** "the Lord of Elderwood's champion Aldric" becomes "the Lord of champion Aldric". This is harmless here.
- **Role-word possessives of one possessor still fold onto each other** ("Tam's mother" and "Tam's wife"). This is pre-existing.
- **"Sir Aldric" beside the champion's record is a question.** It was before too.
- **The receipt says "may be X under a title" in every direction**, the generation question included. The note itself is direction-aware. The wording is pre-existing.
- **Monotonic resources:** `_npcPossMemo` grows with the distinct name vocabulary. That is the same bound as `_npcTokMemo`, with no eviction.
- **Real saves:** no census was run against the owner's `Campaigns/*/saves`. That folder is outside the worktree, and I was told not to touch the main tree. A census is owed before landing: possessive keys, and family-name-first keys with or without aliases.

## Owed (not mine to do here)

- The `TODO.md` row #616: the four shapes are closed, and shape 2's bare-record limit is recorded.
- `APP_VERSION` and `CACHE` bumps in the commit.
- A `todo_checkWithFable.md` line and one independent review (drift surface, Opus).
- `node dev/run-sabotage-diff.js origin/master..HEAD` after the commit.
