# Character creation, game data and the v10 schema

**Read this when** you touch the wizard, data.js constants, the character schema or a blueprint.

Split out of CLAUDE.md on 2026-09-03 (#310); the map there links here. Version stamps and history links inside are the record as written — the contract lines are current unless a newer commit says otherwise.

## Files

### data.js

Status: ✅ Extracted

Game data constants (TONES, ANCS, SPELLS, ARCH_SPELLS, STAT_BUMP_LEVELS, DEITY_MAP, DEITY_CENTRIC, DEFAULT_RULES, SPELL_PICK_LIMITS, SKILLS, SKILL_LEVELS, SKILL_THRESHOLDS). **C6-③ (2026-08-03): the class tables (CLSS/ABILS/ARCHETYPES/CLASS_FEATURES/XP_LEVELS/STAT_PRIORITY) are DELETED — class_bible.js is the store, read via classDef()/classDefs()/classFeaturesAt()/archFeaturesAt()/classXpLevels() (helpers.js)**

### campaign_generator.js

Status: ✅ Active (#59)

⛨ Shared campaign-skeleton generator + one-pass review serving TWO consumers: `game.js generateSkeleton()` (freeform campaign start gets ONE review pass + auto-correction; failure falls back LOUDLY to the valid first draft — never blocks start) and the designer's "✨ Generate…" draft blueprint. Contents: verbatim-extracted skeleton prompt fragments (the assembled game prompt is byte-identical to pre-extraction), `validateSkeletonStructure`/`stampSkeletonStatus` (pure, engine-tested), `reviewCampaignSkeleton` (ONE fix per finding, cap 8), `correctCampaignSkeleton`, `generateBlueprintDraft`. No DOM, no state writes, no toasts — callers own failure surfacing. `worldState.skeleton` shape and `buildSkeletonBlock` untouched

## 1. Character creation wizard (6 steps)

| Step | Content |
|---|---|
| 1 – Tone | Choose world tone: High Fantasy, Gritty, Sword and Sorcery, Dark Horror, Political Intrigue, or Custom, plus prose-voice pick. Bottom of step has "⚙ Load blueprint" (the redundant ↩ Import-existing-save input was removed at #23① — File ▸ Import covers it). |
| 2 – Identity | **Merged with Ancestry (TODO #25).** Gender (M/F/NB), age, then an Ancestry picker inline below: 7 ancestries (Human, Elf, Dwarf, Gnome, Half-Blood, Hollow-Born, Tiefling), each with 2–3 subraces; Half-Blood has nested lineage selection via `#lineage-popup`. Picking an ancestry swaps the grid (`#anc-grid-wrap`) for a detail view (`#anc-detail`) in place — "← All ancestries" (`anc-back-detail`/`hideAncDetail()`) returns to the grid without leaving the step. Single Back/Next pair (`id-back`/`anc-next`) for the whole step; `anc-next` validates ancestry + subrace + lineage (if applicable) + flex stat picks before advancing. |
| 3 – Class | 9 classes (Warrior, Rogue, Sorcerer, Ranger, Primal, Paladin, Cleric, Druid, Necromancer) |
| 4 – Attributes | Roll 4d6 drop-lowest (auto-assigned by the class's bible `statPriority`) or Point Buy (27 pts, using `PBC` cost table); stated alignment; auto-suggested deity for Cleric/Paladin/Druid |
| 5 – Finishing Touches | Physical description, backstory, portrait (upload / render from sheet / derive appearance from portrait) |
| 6 – Review | Full character preview + campaign name + starting location + starting level (1–10) + companion selection — **party cap is `PARTY_MAX`=4 total** (player + companions): the creation picker, the mid-game import, and the `[PARTY_MEMBER:\|true]` handler all enforce `partyCompanionCap()` (multiplayer #1 makes playerCount dynamic). `buildSysPrompt` injects a live "PARTY SIZE: N of 3 … FULL" note so the GM doesn't narrate a join it can't make; the `applyMuts` cap is the backstop (over-cap NPC kept as a non-party ally). **Manual departure:** the NPC sheet's "Part ways" button → `partWaysWithCompanion()` flips `partyMember` off (NPC kept, slot freed) and sets transient `worldState.recentlyLeft` → a "PARTY DEPARTURE" note (auto-cleared after ~2 turns, the `recentSwitch` pattern). |

After step 6, if level ≥ 3: archetype picker → stat bump(s) → spell picker → `startGame()`.

**Step 2 uses `<select id="char-gender">` with options M/F/NB** — pronouns have been removed from the character schema entirely.

**Starting languages** are derived automatically in `confirmChar()` from ancestry/subrace and stored in `char.languages[]`:
- All characters start with Common
- `ancLangMap`: elf→Elvish, dwarf→Dwarvish, gnome→Gnomish, tiefling→Infernal, hollow→Umbral
- `subLangMap` (halfblood subraces): half_elven→Elvish, half_orcish→Orcish, half_draconic→Draconic, half_infernal→Infernal, half_fey→Sylvan, half_gnomish→Gnomish

## 2. Game data constants (all in `data.js`)

- `TONES` — 6 tone presets, each with a `vc` (voice directive sent in the system prompt)
- `AUTHORS` — Prose-inspiration voices (#23), each `{id, nm, blurb, vc, profane?}`. `vc` is a style directive injected by `buildSysPrompt` (`proseBlock`); `profane:true` voices swear only when `adultMode` is on. Selected via **Dev Mode ▸ ✍ Prose inspiration…**, read live. **Per-campaign:** stored on `worldState.proseAuthor` (rides the sync blob); `buildSysPrompt` uses it when set, else the device default (`PROSE_K`/`tnd_prose_v1`). Saving in-game pins the campaign AND updates the device default. ⚠ **Never re-add a hard sentence/length cap to STYLE** — capping count makes the model cram everything into one dense sentence ([history](DOC/CLAUDE_HISTORY.md#2-authors--the-sentence-cap-removal)); the STYLE rule forbids cramming and hands length/rhythm to the selected prose voice.
- `ANCS` — Ancestry definitions with `stats`, `traits`, `subraces`, optional nested `lineages`, and `racial_caps` (see below)
- ~~`CLSS` / `ABILS` / `ARCHETYPES` / `CLASS_FEATURES` / `XP_LEVELS` / `STAT_PRIORITY`~~ — **deleted at C6-③ (2026-08-03)**: class chassis, starting abilities, archetypes, level features, XP thresholds and rolled-stat priority all live in `class_bible.js`, served by `classDef()`-family accessors (helpers.js). XP curve is `CLASS_XP_LEVELS` (1–20; L1–10 = the old shipped thresholds verbatim, L11 gate 85000, L20 = 355000)
- `SPELLS` — Spell lists for Sorcerer, Cleric, Druid, Ranger, Paladin, Necromancer (cantrips + levels 1–3). **Necromancer also has a tier 4** (Rigor Mortis, Possess Thrall, Sleep of the Dead) — tiers are intentionally open-ended; creation only ever offers up to tier 3 (`buildPendingSpellPool` caps `maxSlot` at 3), so higher tiers are GM-grantable / high-level content only.
- `ARCH_SPELLS` — Extra spell lists for Eldritch Knight and Arcane Trickster archetypes
- `STAT_BUMP_LEVELS` — `[4, 8]` (levels where +2 stat improvement is awarded)
- `DEITY_MAP` + `DEITY_CENTRIC` — Alignment-based deity suggestions for Cleric/Paladin/Druid
- `DEFAULT_RULES` — 25 hard GM rules always injected into the system prompt (incl. character sheet upkeep, engine-controlled XP/leveling, mandatory NPC registration, quest lifecycle, active-crises-are-quests, player-actions-are-intent, canon-is-not-conversation). The AUDIT_FABLE #19 editorial merge SHIPPED at v1.148 (28→20, zero coverage loss, harness-validated); rules added since are distinct purpose-built additions — see data.js for truth. Reviewed rule-by-rule 2026-08-14 (#16①): no genuine duplicates remain.
- `SPELL_PICK_LIMITS` — Max spells selectable per tier during creation: `{cantrips:2, "1":2, "2":2, "3":1}`
- `SPELL_UNLOCK_PICKS` — **#72 C2 (2026-08-03):** picks granted when a spell tier UNLOCKS in play: `{"1":2,"2":2,"3":1,"4":1,"5":1,"6":1}` (per-class counts are template-iteration material)
- `SKILLS` — Array of 37 skill objects `{id, label, cat}` across 8 categories (Physical, Endurance, Wilderness, Knowledge, Craft, Social, Roguish, Perception). Wilderness includes **Tracking** (WIS/INT), which doubles as urban tailing. **What a level DOES is skills_bible.js (#52)** — the ladder + per-skill canon live there, not here (stats/categories stay in this table; the bible never duplicates them).
- `SKILL_LEVELS` — `["Unskilled","Familiar","Trained","Proficient","Expert","Master"]`
- `SKILL_THRESHOLDS` — `[1, 5, 12, 25, 50]` (cumulative successes to reach levels 1–5)

**`skillLevel(successes)`** returns 0–5 based on `SKILL_THRESHOLDS`.
**`initSkills()`** builds a zeroed skill map `{skillId: 0}` for all 37 skills (derived from `SKILLS`, so adding one needs no change here).

**Racial capabilities (`racial_caps`, single-sourced in the bible):** Ancestries, subraces, and lineages in `ANCS` carry a `racial_caps:[]` list that **references `capability_bible.js` by base name** — the mechanics live ONLY in the bible. Each entry is a bare string (passive/at-will) or `{cap:"Name", use:"1/day"}`. `confirmChar` gathers + dedupes the caps, resolves each via `capabilityLookup`, and pushes bible spells → `char.spells` (`racial:true`) and abilities → `char.abilities`; canonical names mean `buildSpellBibleBlock`/`buildAbilityBibleBlock` auto-inject their canon every turn. `traits[]`/`desc` remain human-readable wizard-preview summaries, NOT the authoritative def. Category `"racial"` = innate heritage traits — drawn by no caster tradition, never in a rolled enemy caster's menu. A coverage-guard test blocks a `racial_caps` key with no bible entry. The old `racial_spells` field is removed.

## 4. v10 Character schema

```javascript
{
  name, gender,           // gender: "M" | "F" | "NB"  (replaces pronouns)
  age, appear, mark, backstory,
  ancestry, subrace, subraceNm, heritageVariant,
  cls, stats, hp, maxHp, gold,
  inventory[],            // plain strings
  level, xp,
  abilities[],            // {nm, ds}
  spells[],               // {nm, lvl, used, racial?} — used = "cast since rest" (hard gate ONLY for racial 1/day; #110)
  mana,                   // #110 spend-by-tier pool — current points; max is DERIVED (manaMax), never stored; absent = full
  archetype, archetypeNm,
  statedAlignment, actualAlignment, alignLaw, alignGood,
  deity,
  trait, flaw, motivation,
  languages[],            // {name, broken}
  skills,                 // {skillId: successCount} — all 37 keys, zeroed at creation
  conditions[],           // {name, duration}
  relationships[],        // #168 W7: {entity,bond,bondTurn,dynamic,dynamicTurn}; one directed edge per resolved entity
  saveModifiers[],        // {source, type, amount}
  portrait,               // null | base64 data URL (compressed to max 400×600px JPEG 0.8)
  storyBeats[],           // {text, turn}
  coreMemories[],         // {text, turn, kind, who, camp} — #63: defining moments, witnessed-by-all, portable across campaigns (see §8c)
  partyMember             // bool — always true for the player character
}
```

`worldState` also carries `campId` (string matching `tnd_active_v1`) so the campaign ID survives exports and reimports without creating duplicate campaign slots, `proseAuthor` (per-campaign prose-inspiration voice id — see AUTHORS above), and `tagLog` (#137 — the provenance ring: the last `TAG_LOG_CAP`=40 responses' tag names + mutation labels, riding the save/sync so field forensics can decide emitted-then-purged vs never-emitted).

- **Blueprint NPC `armor` field (#319).** Optional on every seeded NPC: blank/`auto` = derived plot armor from the acts; `none` = never armored; an act number = cannot die until that act opens. `normalizeBlueprint` passes it through untouched; `seedArmor` (helpers.js) normalizes it onto the roster record at campaign start; the designer exposes it as "Plot armor".

- **Companion agendas (#330, owner sketch 2026-09-04).** A companion sheet carries `agenda` (the ACTIVE want: `{want, kind:violent|peaceful, source:blueprint|gm|moment, since, lastBeat}`), `agendaQueue` (SILENT wants, oldest first) and `agendaHistory`. Readable on the sheet (the Wants section), never editable — personality is not the player's to tailor. Sources: the blueprint NPC fields `agenda`/`agendaKind` (designer) ride the roster and adopt onto the sheet at the next commit (`agendaAdoptSeeds`); the GM files one at recruitment when asked (`buildAgendaAskNote`); a defining moment births one for a present companion with probability `AGENDA_BIRTH_CHANCE` (one per moment, `agendaBirthMaybe` at `fileCoreMemory`). Placement is the engine's: the first want is active, later ones silent. Tags: `[COMPANION_AGENDA:]`, `[COMPANION_AGENDA_DONE:]` (no fragment = the active want, promoting the oldest silent one and arming the announce note; a fragment = a silent want resolved early), `[COMPANION_AGENDA_BEAT:]` (resets the `AGENDA_PUSH_DAYS` push clock). The stable-half rule COMPANION AGENDAS fixes the behaviour: refusal is the ceiling, never leaving; a violent want surfaces in a fight only when the foe touches it; silent wants stay silent. Nested latches `charSheet.agendaAsked` and `charSheet.agenda.lastBeat` are snapshot-restored (#151).
