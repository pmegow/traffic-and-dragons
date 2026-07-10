# Multi-enemy combat — design (UA26)

**Status: DESIGN RATIFIED (2026-07-10) — all four decisions made by the user (§7).** Build is
gated on the tag-table cutover (UA1) — every change below lands as `tag_table.js` entries/edits,
not `applyMuts` surgery. ⛨ Drift surface (combat tags in the stable-half docs, combat block in
the volatile half, `migrateWorldState`); the standing policy applies: this doc is the pre-review's
design half, the implementation commit gets its own guard checklist.

---

## 1. Evidence & problem

The engine holds exactly ONE combat object (`worldState.combat`). From the 150-turn Haiku window
(AUDIT_HAIKU, H2):

- **18 turns** emitted a second `[COMBAT_START:]` during an active fight — silently LOST (the
  handler overwrites, so the second foe never existed to the tracker; the v1.216 F2 guard only
  handles the location-change case).
- **12 turns** emitted the named form `[ENEMY_HP:Kresh|-6]` — parser expects `[ENEMY_HP:-6]`,
  so the named form was DROPPED (the regex requires the sign right after the colon).

Models — even Haiku — naturally reach for multi-foe semantics. The design below follows what
they already emit rather than teaching them a new dialect.

## 2. State shape

```
worldState.combat = {
  round: N,
  engaged: "name"|null,   // engagement pointer: the foe the player last damaged (any ENEMY_HP form)
  foes: [ { name, hp, maxHp, ac, atk, dmg, morale,
            stats?, cr?, immune?, resist?, vuln?,
            down?: "slain"|"fled"|"surrendered" } ]
}
```

- One encounter, N foes. `round` stays encounter-level (unchanged semantics).
- A foe at `hp<=0` is marked `down:"slain"` (kept in the array for the panel strike-through and
  the GM's context), not spliced.
- **`engaged` (user call 2026-07-10):** set to the foe's name every time ANY `[ENEMY_HP:]` applies
  damage to it — a deterministic proxy for "who the player is currently fighting". Cleared when
  that foe goes down.
- **Auto-clear generalizes (v1.140 net):** combat clears when EVERY foe is down — the single-foe
  behavior is the N=1 case, so existing tests keep their meaning. A close where any foe is
  `surrendered` clears with outcome "surrender" (equivalent to `[COMBAT_END:truce]`).
- The v1.216 F2 stale-combat clear on `[LOCATION:]` change is unchanged (clears the whole
  encounter; skipped when the same response opens a fresh fight).

### Migration (`migrateWorldState`)

An in-flight legacy save has `combat = {name, hp, ...}` (flat). Migration wraps:
`{round: old.round||1, foes:[old]}`. Idempotent (presence of `.foes` short-circuits). Must be
tested against a real exported save with live combat, per the UA10 discipline.

### Read sites to convert (enumerated at design time so the diff is reviewable)

- `api.js` — volatile combat block in `buildSysPrompt` (renders every living foe: name, HP/maxHP,
  AC, immunities; down foes listed once as "defeated: …" so the GM narrates the aftermath).
- `ui.js updateCombat` — panel (see §5).
- `tag_table.js` / `applyMuts` combat handlers (see §3).
- `syncUI` show/hide check (`worldState.combat` truthiness — unchanged).

## 3. Tag semantics (all additive — no format breaks)

| Tag | Today | New semantics |
|---|---|---|
| `[COMBAT_START:name\|hp\|ac\|atk\|dmg\|morale]` | Overwrites | No combat → starts encounter with foe #1. **Combat active → ADDS a foe** (the H2 fix). Duplicate name while that foe is alive → ignored + console.warn (re-emission, not a new foe). |
| `[ENEMY_HP:-X]` (bare) | Sole target | 1 living foe → that foe. **>1 living → the ENGAGED foe** (`combat.engaged`, the foe the player last damaged) **if it's alive; else first living foe + console.warn("ambiguous bare ENEMY_HP — use [ENEMY_HP:Name\|-X]")** — the mutation always lands (narrated damage must not vanish); the warn fires only on the true-ambiguity fallback (user call 2026-07-10). |
| `[ENEMY_HP:Name\|-X]` (named) | DROPPED | Targets by name — exact, then case-insensitive contains (both directions, same spirit as `findCompanionChar`). No match → console.warn, no mutation. Sets `combat.engaged`. |
| `[ENEMY_SURRENDERS]` (bare) / `[ENEMY_SURRENDERS:Name]` | UA2 phantom (stripped, inert) | **IMPLEMENTED (user call 2026-07-10 — surrender is a real beat, especially for communicative NPCs).** Named form marks that foe `down:"surrendered"`; bare form surrenders ALL living foes. All-down → encounter closes with outcome "surrender". A surrendered foe survives the fight — the doc line reminds the GM to register a surrendered speaking NPC with `[NPC:name\|status\|relation]` so it enters the world properly. Resolves UA2 as *implement*, not delete. |
| `[COMBAT_STATS:…]`, `[COMBAT_IMMUNE/RESIST/VULN:…]` | Sets on the one foe | Applies to the **most recently added foe** (docs already say "alongside COMBAT_START", so adjacency is the natural rule). |
| `[COMBAT_END:outcome]` | Clears | Unchanged — closes the WHOLE encounter regardless of foe states. |
| `[COMBAT_ROUND:N]` | Sets round | Unchanged (encounter-level). |

**Doc-line changes (stable half, `TAG_DOC_LINES`):** the `COMBAT_START` line gains
"(emitting it during an active fight adds a SECOND enemy to the same encounter)"; the `ENEMY_HP`
line gains the named form with "use the named form whenever more than one enemy is up"; a new
`ENEMY_SURRENDERS` line documents the (formerly phantom) tag with the register-the-survivor
reminder. The F2 `[SPELL_USED:]` clarification and F4's DICE note (AUDIT_playtest_v1238) ride
the same edit — **one stable-half invalidation for the whole batch**, ideally shared with UA25's
and UA38-①'s doc lines.

## 4. Prompt changes & size guard

- **Stable half:** the two doc-line edits above (+ batch riders). One-time cache invalidation;
  UA5 tripwire fires exactly once, byte-identity must resume next turn (engine-tested golden
  update in the same commit).
- **Volatile half:** the combat block grows ~1 line per extra foe (~15–25 tokens each). Measure
  before/after on a 4-foe encounter; prompt-saturation discipline per the UA25 guard note.
- **Mob guidance (design intent, NOT a doc line):** the GM chooses granularity by naming — three
  distinct goblins = three `COMBAT_START`s; a faceless pack = one pooled entry ("Goblin pack"),
  exactly how single-foe handles groups today. We do not spend stable-half tokens teaching this;
  if weak models fumble it, the guidance becomes a UA28-style weak-model reinforce line instead.

## 5. Panel rendering (`updateCombat`, mobile-first)

- One compact row per foe: name · HP bar · AC. Down foes: struck through, dimmed, no bar.
- Living foes sorted first; display cap 4 rows + "+N more" overflow line (mobile `#cpanel` is
  shallow; 5+ simultaneous foes is already a narrative smell).
- Round indicator unchanged (encounter-level).

## 6. Deliberately out of scope

- **Engine initiative / turn order** — the GM narrates order; the engine tracks state, not
  choreography. Adding initiative rails combat pacing and bloats the tag vocabulary.
  (Ratified by decision 1.)
- **Per-foe XP** — awards stay GM-emitted `[XP:]`/`[COMPANION_XP:]`, unchanged.
- **Foe-vs-foe / ally-NPC combatants** — companions already live in party sheets; neutral
  third parties stay prose.

## 7. ✅ DECISIONS — ratified by the user 2026-07-10

1. **Initiative: NONE.** Order stays with the GM's narration ("potentially more interesting") —
   the engine tracks HP only.
2. **Bare `[ENEMY_HP:-X]` with >1 living foe: the ENGAGED foe first** — whoever the player is
   currently fighting (deterministic proxy: `combat.engaged`, the foe the player last damaged);
   falls back to first living foe + loud warn only when no engagement exists yet.
3. **`[ENEMY_SURRENDERS]`: IMPLEMENT, don't delete** — surrender is a real combat outcome,
   particularly for a communicative NPC. Named + bare forms per §3; the doc line reminds the GM
   to register a surrendered speaker as an NPC. This resolves UA2 as *implement*.
4. **Foe cap: 8** ("two per char slot") — the 9th `COMBAT_START` in one encounter is ignored
   with a loud warn; a runaway-model guard, not a game rule.

## 8. Test & validation plan

- **Engine tests:** add-foe on active-combat `COMBAT_START`; duplicate-name re-emission ignored;
  named `ENEMY_HP` exact + contains + no-match warn + sets `engaged`; bare `ENEMY_HP` single-foe,
  engaged-foe routing with 2+ living, engaged-foe-down fallback to first living (with warn
  assertion); `ENEMY_SURRENDERS` named marks one foe, bare marks all living, all-surrendered
  auto-closes as "surrender"; all-foes-down auto-clear; one-down-one-up does NOT clear;
  `COMBAT_END` clears mid-encounter; F2 location-change clear with 2 foes; 9th foe ignored +
  warn (cap 8); `COMBAT_STATS`/`IMMUNE` bind to the most recent foe; migration wraps a flat
  legacy combat object idempotently; stable-half golden updated + byte-identity test green.
- **Corpus replay (the money evidence):** the Haiku corpus's 18 lost `COMBAT_START`s and 12
  dropped named `ENEMY_HP`s are a ready-made validation set — replay via `dev/diff-replay.js`
  and assert the new handlers now CAPTURE what the old parser lost (expected-diff mode: here the
  table SHOULD diverge from legacy, in exactly those 30 places and nowhere else).
- **Playtest (spine gate):** the post-batch playtest steers a 3-foe encounter — panel, named
  damage addressing, partial-down state, and auto-clear observed live.

## 9. Sequencing & cost

After cutover (hard rule: A before UA25/26/27). Bundle the stable-half doc edits with UA25's
(one cache invalidation). Effort M: handler edits are table entries (~4 touched, ~2 new tests
files' worth of assertions), panel rework S, migration S. The expensive part is verification,
as designed above — the code is deliberately boring.
