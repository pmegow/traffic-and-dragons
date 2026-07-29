# Traffic and Dragons — Session Handoff (2026-07-28: the review, the housekeeping, and #72 gets real)

**Deployed:** `v1.471` (globals.js) · CACHE `tnd-v3-20260728e` (sw.js) · Piper runtime **r9** (untouched)
**Tests:** 874 assertions green · **Branch:** master, clean, pushed (16 commits this session)
**Models:** Opus 5 + Fable · 5 parallel Opus agents for the fable-review evidence pass

## Start here

**#72 is the live thread and the fill phase is YOURS.** `class_bible.js` + `bible_editor.html`
exist, the Arcane Trickster is authored end to end as the template, and the editor now opens a
bible from the project folder and saves back over it in place. **46 of 234 level slots filled ·
200 capability entries.** Everything else below is either parked or waiting on a field sighting.

## What shipped (v1.462 → v1.471)

- **`/fable-review 7` — the #95/#96 arc, scope widened on your call.** Five parallel Opus evidence
  briefs; **6 confirmed defects + 6 hardens (v1.462)**. Headline: an untouched Voice Settings
  **Save silently rewrote a composite voice to its base model** (the filed item ⑤ fear, confirmed);
  a main-table gender correction never reached an already-starred voice's `g`, the only channel
  auto-cast reads; the `[SAY:]` deriver dropped bindings on em-dash/markdown inside dialogue. The
  `voiceBaseId` sweep, S2 strip boundary and stamp/memo ordering all PASSED. Queue is now **empty**.
- **#9 → `[ENEMY_SLAIN:Name]` (v1.463).** The trafficker desync: prose said one living, tracker said
  four. Root-caused from the server's `session_log` — the GM's tag discipline was *perfect*, it
  simply had no word for "he dies", so a narrated execution emitted honest dice damage that left
  18-HP foes standing. New outcome tag, named-only.
- **Housekeeping.** Root went **78 → 62 tracked files** (64 today — `class_bible.js` and
  `bible_editor.html` landed after): 13 docs → `DOC/`, blueprints → `samples/`, `.tnd` saves →
  `testRuns/`, `Campaigns/` gitignored. 34 link repairs, all verified by a link checker
  (78 links, 0 broken — it also found 3 pre-existing breaks).
- **#72, the bulk of the session.** Spec R1→R2 (all four forks ruled: picks at tier-unlock, table
  extended to **L20**, creation-only skill seeds) → skeleton + editor (v1.464) → archetype-level
  rubric + third-caster schedule (v1.465) → the *concept* doc (v1.466 prep) → **Arcane Trickster
  authored** (v1.466) → **editor v2: open/save in place** (v1.467) → merged your spell fill + 25
  capability entries (v1.468) → name normalization (v1.469) → **dropdowns for enumerated fields +
  capitalization on save** (v1.470) → picker defaults to the project dir (v1.471).
- **Known issue 6 CLOSED** — companion portrait cross-device sync, field-confirmed by you.

## The two ideas from #72 worth carrying forward

They came out of design conversation and now govern all 162 remaining archetype features:

1. **A feature is a sentence the GM permanently knows.** Features are injected as canon every turn,
   so `+2 to hit` is invisible to an LLM GM while "you can always tell when someone is lying to you
   about money" gets reached for unprompted. **Test: can the GM start a scene with it?**
2. **The enforceability ceiling** — a feature's blast radius must not exceed the engine's vocabulary
   for enforcing it. **Generative is cheap, subtractive is expensive.** You caught this yourself on
   a proposed capstone that erased a past event: the transcript is immutable by decree, `[RETCON:]`
   de-indexes exactly two entries, and the event also lives in ~10 memory tiers — RAG would re-serve
   it non-deterministically and the ability would read as broken. Both rules render *in the editor*
   at the point of authoring.

## Where to pick up

1. **Fill more of the class bible** (the editor is ready; open `capability_bible.js` directly to
   author mechanics). Rogue's Thief/Assassin are the cheapest next archetypes — the *first* Arcane
   Trickster draft (shadow-operative register: Never the Suspect, Memory Thief, Mage Hand
   Legerdemain) was set aside as better Assassin/Thief material and is recoverable from the
   v1.466 commit message.
2. **~30 seeded class features carry prose but no capability entry** (Action Surge, Extra Attack,
   Divine Strike…). Legal by the invariant test, but the GM only sees a one-line summary for them.
   Obvious next fill target after the archetypes.
3. **C6 ① `classDef()` refactor** — collapses ~30 hand-rolled `for(i…) if(CLSS[i].id===c.cls)` loops
   into one helper. Independent of the fill, Sonnet-safe, and it unblocks ②③ (store swap, `CLSS`
   deleted) which are Fable + save-invariant tested.

## Open, waiting on YOU (not code)

*(Corrected 2026-07-28: #94, #9, and #30 are DONE and marked so in TODO.md — the list below
carried them stale. #30 closed field-confirmed with nothing outstanding; #9's tag shipped with
the t1188 fixture; #94's speed half was answered by field logs.)*

- **#78** Car Mode numbered options — code shipped and closed; the one uncovered piece is
  real-device mic accuracy in a moving car (CAR_MODE.md's standing risk).
- **The unmerged `#72` local-server commit** (`6ba16f5`, on `claude/wizardly-mayer-df87c6` and its
  `origin/` twin): genuinely absent from master, its server half already deployed. Cherry-pick,
  keep parked, or abandon. **Not urgent — it is pushed and gc-safe** (I initially reported it at
  risk; that was wrong, I had only checked it against master). **This is the ONLY cleanup item
  left**; the branch was deliberately spared when the worktrees went, because it is the one that
  holds real work.

*(Done 2026-07-28: both stale worktrees removed along with their `.git/worktrees` metadata and the
fully-merged `worktree-agent-…` branch; `CHECKPOINT.md` deleted — housekeeping landed and verified.)*

## Gotchas that cost time this session

- **A contract that never runs the code it guards reads as coverage but is worse than nothing.** My
  first capability-serializer contract missed 2 of 4 sabotages because it only exercised the
  *unedited* path — `emit()`, the code that writes the user's edits, was never called. Sabotage-prove
  every clause, and check the mutation actually changes something (one of mine was vacuous).
- **ES5 `var` hoisting in a shared closure hung the test suite** rather than failing it: a helper
  reused the caller's loop counter and reset it to 0 on every blank level. If `run-tests` hangs,
  suspect a new loop before suspecting the machine.
- **Bash ate a `$`/backtick-bearing commit message** again — write commit bodies and TODO rows from a
  **script file**, never a shell string.
- **`du`/`grep` over the OneDrive tree routinely exceed 120s.** Prefer `node -e` with direct reads.
- **Don't diff-by-eyeball when merging authored data.** The class-bible merge was proven by a
  structural diff run *before and after*, so "nothing was lost" is a measurement, not a hope.

## Where the docs live now

`DOC/DOC_class_bible.html` is the #72 spec (Part I current state · II decisions · **II-a the
concept** · II-b the rubric · III iteration plan). `todo_checkWithFable.md` is empty. Reference docs
moved into `DOC/`; `CLAUDE.md`, `TODO.md`, `HANDOFF.md`, `todo_checkWithFable.md` stay at root.
