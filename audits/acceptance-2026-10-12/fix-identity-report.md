# Fix report: identity acceptance 2026-10-12 (#504, #530, #531, #534)

**Session:** Opus 5.5, worktree `agent-a68e4279825319532` at `a4e28628` (engine v1.1227). Nothing committed, nothing pushed. `TODO.md`, `APP_VERSION` and `CACHE` are untouched.

**Patch:** `C:\Users\hannu\AppData\Local\Temp\claude\C--Projects-traffic-and-dragons\97fd7790-74cc-480c-82d3-71fee5adeb06\scratchpad\fix-identity.patch`. It is one diff against `a4e28628`. `git apply --check` is clean on an archive of the local origin/master ref, `3bbed367`. That ref is one commit (#615 signup) ahead of the worktree and touches none of these six files. It carries the acceptance section, the fixes, a new 4-test section, 15 new battery clauses and 9 re-aimed anchors.

**Applying the acceptance patch.** `git apply --3way` hit a conflict in `dev/engine-tests.js`. Master's own `acceptance 2026-10-12 — #593 resident standing` section had landed at the same spot (just before `#518 block`). I kept both sections, master's first and the identity section after it, and changed no line of either.

**Result:** all 9 red probes are green, all 22 acceptance probes pass, and the full suite is ALL GREEN.

## Verdict per defect

| # | Defect | Status | Probes flipped |
|---|---|---|---|
| 1 | The title-question shape | **fixed** | `#504 acceptance the mirror case in the shapes GM prose writes`, `#504 acceptance a rank title AFTER the family name`, `#531 acceptance a death naming the relative by a title AFTER the family name` |
| 2 | A scene handle stranded after an answer | **fixed** | `#530 acceptance after the ANOTHER answer under live scene refs`, `#531 acceptance after either answer under live scene refs` |
| 3 | A merge carries a death past plot armor | **fixed** | `#531 acceptance a reported death by title followed by the SAME answer` |
| 4 | A refused hero answer is not said back | **fixed** | `#504 acceptance the hero as an answer operand is said back` |
| 5 | A self-link survives a SAME answer | **fixed** | `#534 acceptance the SAME answer never leaves a person linked to herself` |
| 6 | The settled flag is set for one answer only and lost on a merge | **fixed** | `#534 acceptance a settled identity stays settled` |

None is left red.

---

## 1. The title-question shape (memory.js)

**Mechanism.** `npcTitleQuestion` raised the question in two narrow shapes only:
- **Forward:** it read a title only *before* the one distinctive family word (`for(i=0;i<at;i++)`). "the Underbough Queen" therefore had no title. Consolidation chose the one Underbough on file, and the queen landed on the princess.
- **Mirror:** it fired only when the family word *closed* the arrival's distinctive words (`inCore[inCore.length-1]===kCore[0]`). "Wilhelmina Underbough, the queen's daughter", "… the Younger", "… II", "… of Elderwood", "Wilhelmina Underbough-Vane" and "Underbough Wilhelmina" got no question. The bare record's one token is a subset of any name that holds it, so consolidation folded each of them onto the bare "Queen Underbough". In this direction, not asking IS the fusion.

The same reading lives on the record side. `npcKeyTitle` (a record key's own title) also read only titles before the family word. A bare record keyed "the Underbough Queen" therefore had no title: a given name beside it folded onto her, and a later "Queen Underbough" forked away from her.

**Change.**
- `memory.js:164` (forward): the title is read on **either side** of the family word: `for(i=0;i<ws.length;i++)if(i!==at&&…)`. The audit's rule stays: exactly one distinctive word, and it closes a candidate that has more. Every other word of a one-word core is a stop word, so the family word is the only word that can be a name.
- `memory.js:161` (mirror): the family word may stand **anywhere** among the arrival's distinctive words (`inCore.indexOf(kCore[0])>=0`). The existing guards stay: a name carrying the record's own title is her, and an office title on the record raises nothing.
- `memory.js:174` (`npcKeyTitle`): reads the record's title on either side, the same shape as above.
- Comments at `memory.js:145–150`, `156–160` and `168–170` name the row and the mechanism.

**What each shape does now.** Measured through the real engine (`scratchpad/shapes.js`, before and after on a `git archive` of HEAD). Every change is FUSED → ASKED. No shape moved toward fusion.

| Beside | Name | Before | After |
|---|---|---|---|
| Wilhelmina Underbough | the Underbough Queen / Underbough Queen / the Underbough Queen-Mother | FUSED | **ASKED (queen)** |
| Queen Underbough (bare) | Wilhelmina Underbough, the queen's daughter / … the Younger / … of Elderwood / … II / Wilhelmina Underbough-Vane / Underbough Wilhelmina | FUSED | **ASKED (queen)** |
| Queen Underbough (bare) | Underbough the Cruel | FUSED | **ASKED (queen)** |
| the Underbough Queen (bare) | Wilhelmina Underbough | FUSED | **ASKED (queen)** |
| Marla King | Joss Marla | FUSED | **ASKED (king)**: a side effect of `npcKeyTitle`, since the surname "King" reads as a title on the record side. A false question costs one note; the old outcome folded two people. |

**Unchanged on purpose** (pinned tests stay green): Queen Underbough, Queen Mother Underbough and Queen Underbough the Elder are asked as before. Lady Marla → Marla King, Belor Hemlock ↔ Sheriff Hemlock, Queen Wilhelmina → Wilhelmina Underbough and Queen Wilhelmina Underbough → Queen Underbough fold as before. Duchess, Aunt and Widow Underbough, Queen Underbough II and "… of Elderwood" fork as before.

**Shapes I deliberately still do not ask about.** Each one still FOLDS today. Each needs a ruling or a row, because the caller's instruction was to keep the one-distinctive-word rule.
- **A family name of several words, forward.** "Queen Underbough-Vane" and "the Underbough-Vane Queen" beside "Wilhelmina Underbough-Vane" fold onto her. The core has two words, so the forward branch never runs, and consolidation matches the subset. A fix would read the shape as "the arrival's core is a closing run of the candidate's, plus a kin or rank title".
- **A record written family-name-first, forward.** "Queen Underbough" beside "Underbough Wilhelmina" folds onto her. The engine cannot tell which word is the family name, and the forward branch requires the family word to close the candidate. In the reverse case, "Queen Wilhelmina" beside her is asked about.
- **The titled record's own title with an age or generation suffix, mirror.** "Queen Underbough the Younger" beside the bare "Queen Underbough" folds onto her. The pre-existing rule says a name carrying her title is her, and #503's age veto needs an age on the record too.
- **A possessive of the titled record, mirror.** "Queen Underbough's champion Aldric" folds onto the queen. The own-title guard reads "Queen", and the possessive lands on the family word ("underbough's"), which `npcNameWords` keeps as "underboughs". This is pre-existing and unchanged by this patch.
- **Titles outside `_NPC_STOP` / `_NPC_ASK_TITLES`.** Duchess, Empress, Dowager, Aunt, Widow and Her Majesty fork, as before. A fork is safe, but the report's observation stands.

**Clauses** (`dev/sabotage-504-title-question.js`, new `memory.js` group):

| Label | Attributed test |
|---|---|
| the forward question reads a title BEFORE the family word only again | `#504 acceptance a rank title AFTER the family name` |
| the mirror question needs the family word to close the arrival again | `#504 acceptance the mirror case in the shapes GM prose writes` |
| the record-side title reads before the family word only again | `#504 fix a bare titled record keyed with the title AFTER` (new test) |

**Re-aimed anchors (not loosened):** "the question ignores the title", "a record already known by the title is asked about anyway" and "the mirror branch is gone".

## 2. A scene handle stranded after an answer (identity.js, tag_table.js)

**Mechanism.** `sceneRefBind` stores the KEY the handle resolved to at bind time ("queen" → "Queen Underbough"). The NPC_MERGE tail re-keyed graph edges, factions, relationships and the guestbook, but never `worldState.sceneRefs`. After either answer, the handle named a key nobody holds. Every comparison was a raw string:
- the rebind (`sceneRefBind`), which raised a conflict: "scene handle already binds to Queen Underbough";
- the death gate's handle compare and its frame scan (`w2DeathAuthorized`);
- the executor (`sceneRefDeath`), which quarantined the death: "scene evidence does not bind the claimed victim";
- the reveal and the same-turn fallback.

**Change.**
- **The re-key.** New `sceneRefsRekeyEntity(canonical,duplicate)` (`identity.js:1323`) re-keys every frame's actors AND explicit negatives from the duplicate's key to the survivor's. The NPC_MERGE tail calls it beside `guestbookRekeyName` (`tag_table.js:768`) and says so in the summary: `Scene ref: N binding(s) of <dupe> -> <canon>`. Negatives move too: leaving a negative on the old key while the actors moved would have stopped it guarding the survivor, a fail-open.
- **The comparison.** New `_sceneRefEntitySame(entity,canon)` (`identity.js:1335`). It returns true when the two are equal, or when the stored key read **exactly** names that person: through `npcExactKey`, a live key or a registered alias; or through `npcFormerKey`, where a folded ° key went. It never consolidates, so a death gate cannot reach a person by the shape of a name. It is used at:
  - `sceneRefBind` (1344)
  - `sceneRefReveal` (1367)
  - `sceneRefDeath` (1402)
  - `_w2SameTurnNameFallback` (1420)
  - `w2DeathAuthorized`'s handle compare (1435) and frame scan (1439)
  - `_sceneRefExplicitNegative` (1077)

  This heals a handle that a merge stranded before the re-key existed (a save from before this patch).

**Why both halves, and the new tests that tell them apart.** Either half alone turns the two probes green, so a clause on one half is invisible to the probes. The new section `#504 fixes 2026-10-12` proves each half:
- `#530 fix the merge re-keys the scene handles …`: the stored entity IS the survivor's key, the GM-facing SCENE REFERENTS block names her and never the folded key, the negative follows her, and the re-key is said in the summary.
- `#530 fix a scene handle a merge stranded …`: in the pre-fix shape, a rebind is no conflict, a witnessed death through the handle lands, and a stranded explicit negative still refuses her death. The control: a stranded "Underbough", which consolidation alone would give her, never authorizes her death.

**Clauses** (new `identity.js` and `tag_table.js` groups):

| Label | Attributed test |
|---|---|
| the merge leaves the scene handles on the folded key | `#530 fix the merge re-keys the scene handles` |
| the re-key leaves the explicit negatives on the folded key | `#530 fix the merge re-keys the scene handles` |
| a rebind compares the handle's stored key as a raw string again | `#530 fix a scene handle a merge stranded` |
| the death gate compares the handle's stored key as a raw string again | `#530 fix a scene handle a merge stranded` |
| the death executor compares … as a raw string again | `#530 fix a scene handle a merge stranded` |
| a stranded explicit negative stops guarding the survivor | `#530 fix a scene handle a merge stranded` |
| the stored key is read by consolidation | `#530 fix a scene handle a merge stranded` |

**Re-aimed anchors in `dev/sabotage-w2.js` (not loosened):** "explicit scene exclusion stops blocking", "same-response scene evidence can self-authorize" and "the executor stops pinning".

**Not changed.**
- A rebind that finds a stranded but exactly-equal entity returns true without rewriting the stored entity. The block shows the old called name until the next merge or bind.
- `_observedFact` and the envelope's plot-armor subject already resolve through `resolveNpcName` and are untouched.

## 3. A merge carries a death past plot armor (tag_table.js)

**Mechanism.** The NPC_MERGE fold copies the duplicate's `dead` onto the canonical in both stores (the "B3" carries, `tag_table.js:740` memory and `:762` roster) without consulting `plotArmor`. The sequence: a death report by title killed the unarmored provisional queen. The SAME answer then folded her, death included, into the armored princess. The same report naming the princess would have been refused (#319: every death path consults armor).

**Change** (`tag_table.js:740`, after the canonical's memory record is ensured, so `resolveNpcName(mgCanon)` reads its key exactly). The decision is made ONCE, before either store moves:

`_mgArmorHold = (duplicate dead in either store) && (canonical alive in both) && plotArmor(mgCanon)`

When it holds:
- `plotArmorRefuse(mgCanon,R,"a merge carried a death")` runs, the same refusal every death path uses. It spends an escape, pushes `⚠ <name>: death refused — plot armor until Act N …` to the summary, warns on the console, shows a toast, and arms `plotArmorPing`, so `buildPlotArmorNote` tells the GM next turn to stage the exit.
- Neither carry copies `dead`, and a dead status is not copied onto a blank-status survivor row (`:763`).
- The duplicate's death stays in the merge archive's pre-image.

**Known limit.** A brand-new canonical (a "new" answer, or a plain merge to a name on no record) has no roster row before the fold, so `plotArmor` sees nothing to armor. A skeleton act that names a brand-new name is therefore not consulted at the fold.

**Clause:** "the merge carries a death onto an armored survivor without consulting plot armor" (`_mgArmorHold=false&&…`) → `#531 acceptance a reported death by title followed by the SAME answer`.

## 4. A refused hero answer is not said back (identity.js)

**Mechanism.** `npcMergeAnswer` returned `dupe:null` for both hero refusals (`identity.js:993–994`). `npcMergeRefuse` latches `provisionalRefused` and clears the cooldown only when `ans.dupe` is set (`identity.js:1016`). The note therefore re-asked five turns later without the reason, although identity.md lists "the hero as either operand" among the refusals that are said back once.

**Change** (`identity.js:993–998`). A hero refusal names the open question it answered, when the other operand is one: `dupe:oq(d)` / `dupe:oq(c)`, where `oq` returns the operand only if it is a non-hero provisional record. A plain merge with the hero (no question) keeps `dupe:null`, as before.

**Clause:** "a hero refusal names no open question" (`oq` returns null) → `#504 acceptance the hero as an answer operand is said back`. The two existing hero clauses were re-aimed at the new text.

## 5. A self-link survives a SAME answer (tag_table.js)

**Mechanism.** The NPC_MERGE tail rewrites an edge's `a`/`b` from the duplicate to the canonical (`tag_table.js:768`). A link the GM wrote between the two operands ("Queen Underbough ↔ Wilhelmina Underbough: mother") became a self-edge. The NPC GRAPH block rendered it as "Wilhelmina Underbough ↔ Wilhelmina Underbough(mother)", twice. `npcLinkUpsert` refuses a self-link only at write time.

**Change** (`tag_table.js:768`, right after the re-key loop). Any edge whose ends are now one person is spliced out. Each one is said in the summary (`Link dropped: X ↔ X (mother) — the merge made both ends one person`) and on the console, with the rel and turn. The receipt carries the edge's text. The merge archive is not extended.

**Clause:** "a link between the two operands survives the fold as a self-link" → `#534 acceptance the SAME answer never leaves a person linked to herself`.

## 6. The settled flag is set for one answer only and lost on a merge (tag_table.js)

**Mechanism.** `titleSettled` was set only for `_mgAns.kind==="new"` (`tag_table.js:768`), plus keep, which settles earlier. The fold never carried it from a duplicate into a plain-merge canonical. After ANOTHER ("Mother Underbough"), a plain refinement into a new key ("Queen Mother Underbough") made a fresh, unsettled key, and the seam (`npcStampTitleQuestions`) asked about the princess again. This was the fuzzer's STALE at seed 60606: the obedient SAME then folded the record the GM had called another person.

**Change.**
- **The carry** (`tag_table.js:740`): the memory fold copies the duplicate's `titleSettled` to a canonical that has none.
- **Every answer path** (`tag_table.js:768`): every answer that lands now settles its survivor: `same`, `other` and `new`; `keep` already did. The settled flag is read only by the seam, and only for keys created by the reply, so on an existing survivor it matters only through a later plain merge. Without it, that merge's new key holds the answered history and could be re-asked, and an obedient SAME would fold established history into a second person.

**Clauses:**

| Label | Attributed test |
|---|---|
| a plain merge drops the duplicate's settled flag | `#534 acceptance a settled identity stays settled` |
| only a new-name answer settles its survivor again | `#534 fix a SAME answer settles its survivor` (new test: mirror SAME, then a plain merge to a new key with a second Underbough on file) |

The existing clause "the renamed record is not settled" was re-aimed.

---

## Tests added (no assertion loosened)

- **The acceptance section** (22 tests), as the earlier lane wrote it, unchanged.
- **New section `#504 fixes 2026-10-12 — the halves the acceptance probes cannot tell apart`** (4 tests): `#504 fix a bare titled record keyed with the title AFTER …`, `#530 fix the merge re-keys …`, `#530 fix a scene handle a merge stranded …`, `#534 fix a SAME answer settles its survivor …`.
- **15 new clauses** in `dev/sabotage-504-title-question.js`, all listed above:
  - memory.js: 3
  - identity.js: 7 (the hero latch, then the rebind, gate, executor, negative and consolidation comparisons, and the negative re-key)
  - tag_table.js: 5
- **9 anchors re-aimed** at the moved text: 6 in the 504 battery, 3 in the W2 battery. Each mutation is the same as before.

## Gates

| Gate | Result |
|---|---|
| `node dev/run-tests.js "acceptance 2026-10-12 — identity"` | 22/22 (the 9 red are green) |
| `node dev/run-tests.js "#504"` | FILTERED GREEN, 46 assertions (acceptance 22 + `#504` 20 + fixes 4) |
| `node dev/run-tests.js` (full) | **ALL GREEN — 3009 assertions passed (engine tests)**, exit 0, every standalone suite green |
| `node dev/check-es5.js` | `ES5 check OK — 52 file(s)` |
| `node dev/check-sabotage-applicability.js` | ALL GREEN — 3134/3134 retained clauses applicable across 333 batteries (3119 before plus the 15 new) |
| `dev/sabotage-504-title-question.js` | **76/76** proven (18+20+16+1+1+3+2 existing = 61, plus the new 3+7+5), every file restored byte-identical |
| `dev/sabotage-503-npc-kept-apart.js` | 23/23 (19+2+2) |
| `dev/sabotage-identity.js` | 22/22 |
| `dev/sabotage-535-merge-gate-spelling.js` | 3/3 |
| `dev/sabotage-537-self-merge.js` | 2/2 |
| `dev/sabotage-w2.js` | **96/96** proven (3 anchors re-aimed), every file restored byte-identical |
| Extra related batteries, through the repo's battery pool | all green: presence 18, 538-hero-edges 11, 532-merge-voice 10, 544-alias-reveal 23, guestbook 18, w7 26, 481-c4-title-key 5, 345-slain-ring 4, 505-sheeted-death 3, 527-role-cast 6, 542-epithet-admission 25, 533-name-word-tables 12 |
| `dev/diff-replay.js … --check` v1238 / v1258 / v1271 / v1276 | end states match the committed baselines (all four) |

**Fuzzer** (`node dev/fuzz-npc-identity.js`):

| Seed | Sequences | Replies | Violations |
|---|---|---|---|
| 60606 | 50,000 | 224,468 | **0** (the STALE is gone) |
| 20261012 | 2,000 | 8,859 | 0 |
| 31415 swap | 2,000 | 8,932 | 0 |

## What identity.md must change (suggested wording)

1. **#504 bullet, the forward shape.** Replace "a word of `_NPC_ASK_TITLES` before it" with: "a word of `_NPC_ASK_TITLES` beside it, before or after ("the Underbough Queen" is "Queen Underbough"; every other word of a one-word core is a stop word)".
2. **#504 bullet, the mirror sentence.** After "…when the arrival carries a given name on the record's family name and no title of its own", add: "the family word anywhere among the arrival's distinctive words: a descriptor after a comma, a suffix, a place, a double-barrelled or family-name-first name ask too (acceptance 2026-10-12). `npcKeyTitle` reads the record's title on either side of its family word, so a bare record keyed "the Underbough Queen" is the titled record."
3. **#504 bullet, settled.** Replace "`[MERGE:npc|<their name>|<called>]` renames, the called name again keeps it (`titleSettled` stops the seam re-asking)" with: "… renames, the called name again keeps it. Every answer that lands (same, other, new, keep) settles its survivor (`titleSettled`), and a plain merge carries the flag to its canonical, so the seam never re-asks an answered identity (the fuzzer's STALE, seed 60606)."
4. **#504 bullet, the hero refusal.** After "the hero as either operand", add "(the refusal names the open question it answered, so it too is said back)". The sentence is otherwise true now.
5. **W2 section (after "Direct NPC merges are proposal-first …").** Add: "**A merge carries the scene handles (#530, acceptance 2026-10-12).** The NPC_MERGE tail re-keys every frame's actors and explicit negatives bound to the duplicate's key (`sceneRefsRekeyEntity`) and says so (`Scene ref: N binding(s) of X -> Y`). Every comparison of a handle's stored entity reads it through `_sceneRefEntitySame`: equal, or the stored key read exactly (a live key, a registered alias, a folded ° key's destination; never consolidation). A handle stranded by an earlier merge therefore still binds the survivor and still guards her."
6. **Plot armor bullet.** In "Every death path consults it …", add: "and an NPC merge whose duplicate is dead while its armored survivor lives: the carried death is refused through `plotArmorRefuse` and stays in the merge archive's pre-image (#531, acceptance 2026-10-12)".
7. **#538 or the merge description.** Add: "A merge drops a graph edge the fold turns into a self-link, said in the summary (`Link dropped: X ↔ X (rel)`); `npcLinkUpsert` refuses one at write time."
8. **The recorded limits.** Replace the audit's "multi-word family names and suffixes do not raise the question" with the four FOLD shapes listed under §1, "Shapes I deliberately still do not ask about".

## Owed (not mine to do here)

- **Drift-surface tier.** These are identity-layer (drift-surface) changes, made by Opus 5.5. The project's decree makes such work Fable/Astra tier. Per the owner's rules, this work needs a line in `todo_checkWithFable.md` and an independent review before push. I did not edit that file.
- **TODO.md rows** #504, #530, #531 and #534 should record this fix (the caller's hand).
- **`APP_VERSION` and `CACHE`** must be bumped in the commit (engine files changed).
- **The range sweep:** `node dev/run-sabotage-diff.js origin/master..HEAD` after the commit. It selects 116 batteries for these files; I ran the 6 named and 12 related ones.
