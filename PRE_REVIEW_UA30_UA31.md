# Pre-review — UA30 + UA31, the quest-teeth pass (⛨ drift policy item ②)

**Status: AWAITING GO/NO-GO.** Drafted 2026-07-12 (autonomous window) so the review is ready the
moment you're back; **no code has been written.** Per the standing policy: what it touches, what
silent failure it could cause, the test plan.

---

## Finding first: UA30 is already HALF shipped

The UberAudit row (filed 2026-07-09 against v1.233) says a 0-objective quest reads "all complete"
vacuously. **That hole no longer exists**: both `buildQuestBlock` (api.js:94 — `allDone` is only
set inside `if(aq.objectives && aq.objectives.length)`) and `stampQuestCompletion` (api.js:109 —
`all = active && !!(objectives && objectives.length)`) require ≥1 objective before any close
instruction or escalation stamp fires. The guards evidently rode in with the P3 escalation work
(v1.255-era). **Remaining UA30 scope is only the second half of the row:** a nudge to FILE
objectives on objective-less active quests, so they stop being invisible to the close teeth
entirely (today an objective-less active can never complete via the teeth — the inverse failure).

## Proposed changes (both are one-surface, additive)

### UA30-b — objective-less-active nudge (volatile half, `buildQuestBlock`)
In the ACTIVE loop, when `!aq.objectives || !aq.objectives.length`, append one line under the quest:

> `    ⚑ NO OBJECTIVES FILED — break this quest into 1–3 concrete objectives now via [QUEST_STEP:<title>|<objective>] so progress can be tracked and the quest can complete.`

- Deterministic detection, prompt-only intervention, exactly the #20 pattern already validated.
- Volatile half only (buildQuestBlock is already fully volatile) — zero cache impact.

### UA31 — arc↔quest coupling nudge (4th `NOTE_BUILDERS` entry, `buildArcQuestNudge`)
The AUDIT_PLAYTHRU class: `[ARC_COMPLETE:]` fires while the twin quest stays open forever.
- **Detection:** on skeleton arcs with `status:"complete"`, look for a live `questLog` entry
  (active or offered) whose title matches the arc title (exact or one-contains-the-other,
  case-insensitive — same conservatism as `findCompanionNpc`; no fuzzy scoring).
- **Delivery:** one engine note via the registry (the v1.255 mechanism built for exactly this):
  "Arc '<X>' is complete but quest '<Y>' is still open — if the story finished it, emit
  [QUEST:<Y>|completed] with rewards now; if not, add the objective that remains."
- **Latch:** once per (arc, quest) pair per session (the UA41 latch pattern), silent in combat,
  consumed-at-build accepted — all three conventions already established by the registry entries.
- **NUDGE, never auto-close** (the row's ⚠ guard verbatim): engine-closing a quest the GM hasn't
  narrated closed creates narrative-vs-log desync. The GM stays the only writer.

## Drift surface touched, and the silent failures each could cause

| Change | Surface | Silent-failure mode | Mitigation |
|---|---|---|---|
| UA30-b line | `buildQuestBlock` (quest lifecycle teeth, volatile) | A malformed line could push the GM to emit `[QUEST_STEP:]` spam or misparse; a regression in the surrounding loop could break the PROVEN close-instruction text (#20's validated teeth) | Golden-style assertion that the existing ⚑ ALL OBJECTIVES COMPLETE text is byte-unchanged for the with-objectives case; new line fires ONLY on the objective-less case |
| UA31 note | `NOTE_BUILDERS` registry (outgoing user message only) | A wrong title match nags about the wrong quest every turn (prompt noise → rule collapse); a latch bug re-fires forever | Conservative matcher + per-pair latch + combat silence, each pinned by its own test (the buildReciprocityNudge test suite is the template) |
| NOT touched | `applyMuts`/tag_table, STATE TAGS docs, stable half, summarize/RAG | — | stable-half byte-identity test must stay green (it will — neither change reads into the stable builder) |

## Test plan (test-first, all engine-level)

1. **UA30-b:** objective-less active → nudge line present; same quest with 1 objective → nudge
   absent AND close-teeth text byte-identical to today's (pin the current string first).
   Offered quests never get the line.
2. **UA31:** complete arc + open quest with matching title → note fires once, names both;
   second build → latched silent; no-match titles → silent; combat → silent without consuming
   the latch (the buildConditionAudit convention); quest already archived → silent.
3. Full suite + all four corpora replays byte-identical (no parser contact expected — this
   proves it).
4. Stable-half golden unchanged.
5. **Live validation rides the next playtest** (the "playtest IS the policy's checked-thoroughly"
   rule): an objective-less quest steered into existence + an arc completion with its twin quest
   left open.

## Effort

S — both changes together are ~30 lines + ~8 tests, one commit each (single-concern), one
version bump each.

**Decision needed from you:** go/no-go on both (or either) half. If go, I'd execute UA30-b first
(smaller blast radius), playtest-gate per the spine cadence.
