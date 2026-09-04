# Quests, XP, levels and alignment

**Read this when** you touch the quest lifecycle, milestones, level-up, spell unlocks or alignment drift.

Split out of CLAUDE.md on 2026-09-03 (#310); the map there links here. Version stamps and history links inside are the record as written — the contract lines are current unless a newer commit says otherwise.

## 10b. Quest system

Quests are GM-emergent and **player-gated**. Live quests live in `worldState.questLog[]` as `{title, status, desc, objectives:[{text,done}], started}`; finished ones archive to `memory.quests{}`.

**Lifecycle:** `offered → active → completed/failed`, plus `declined`. The GM creates quests via `[QUEST:title|offered|desc]` (toasts "⚑ Quest opportunity"). An offered quest is NOT a goal — the GM may not steer toward or advance it. The player accepts via the **Quest Journal** (Accept button → `acceptQuest(idx)` sets `active`) or by agreeing in-story (GM emits `[QUEST:title|active]`). Decline → `declineQuest(idx)` archives as `declined`. On `completed`/`failed`, `archiveQuest()` moves the quest to `memory.quests` and removes it from the live log; rewards come via the GM emitting `[XP:]`/`[GOLD:]`/`[ITEM_GAINED:]` in the same response.

**Anti-drift:** `buildQuestBlock()` re-injects the authoritative ACTIVE (with objective checklists) + OFFERED blocks into every system prompt — the GM reads quest state from data each turn, same pattern as the character sheet. A DEFAULT_RULES entry forbids inventing/renaming/dropping quests and auto-accepting. **Lifecycle teeth (#20)** ([history](DOC/CLAUDE_HISTORY.md#10b-quest-lifecycle-teeth--the-t198-silence-20-v1172)): `buildQuestBlock` adds ① an "ALL OBJECTIVES COMPLETE — emit `[QUEST:title|completed]` with rewards, or add the next objective" instruction when every objective is done, and ② a standing "active crises ARE quests — register unlisted goals now" reminder. Both volatile. `openai.reinforce` includes the quest tags for non-Claude providers. **#191 (v1.630): objectives are OUTCOMES, not rituals** — the ACTIVE block carries the doctrine line (an objective achieved or mooted by ANY means gets `[QUEST_STEP:|true]` in that response), and `buildQuestStaleNudge` (NOTE_BUILDERS) fires a combat-silent one-per-turn review note for an ACTIVE quest with no QUEST/QUEST_STEP tag activity in `QUEST_STALE_TURNS`=30 (`q.lastTouch` stamped by both handlers, any touch clears the `staleNudged` latch; legacy rows read infinitely old — the deliberate post-upgrade review wave; the zero-vocabulary ack is re-emitting `[QUEST:title|active]`). The same staleness feeds the #17 quest indicator as a stalled/overtaken WATCH.

**UI:** world-state sidebar shows quest titles + a `⚑ N opportunities` indicator; clicking opens `showQuestModal()` — Opportunities (Accept/Decline) · Active (☑/☐ objective lists) · History (completed/failed/declined from `memory.quests` — collapsible entries carrying desc + the objective checklist, so a late completion explains itself).

## 11. Level-up system

`checkLevelUp()` called inside `applyMuts()` whenever XP changes:
- HP gain per level: `ceil(hd/2) + 1 + CON_mod` (minimum 1)
- Level rows granted from the class bible as NAMED abilities: class rows (2/5/7/9/11/13/15/17) + the committed archetype's rows (3/6/10/14/18 + capstone 20) via classFeaturesAt()/archFeaturesAt()
- **Spell growth (#72 C2, 2026-08-03):** each tier-unlock level crossed (`spellTiers` — full casters T2@5/T3@7/T4@9/T5@11/T6@15, half casters T2@7/T3@9/T4@13, third casters AT/EK on their archetype schedule T1@3/T2@10/T3@14/T4@18) queues a forced-choice picker (`showSpellUnlockModal`, `SPELL_UNLOCK_PICKS` counts, bench-only pool, base-name dedupe) after the archetype/stat-bump modals; owed picks re-surface before the next turn like owed bumps. Companions AUTO-pick silently (first N unknown bench spells). Fill-phase blank benches skip loudly. No retroactive grants — only unlocks crossed by the level change fire
- Level 3: `showArchetypeModal()`
- Levels 4, 8: `showStatBumpModal()` (+2 to one stat or +1 to two, max 20)

`checkCompanionLevelUp(cs)` called from the `[COMPANION_XP:]` handler — companions auto-level silently (HP gain + class features, same formula) with a toast and system message, but no archetype or stat-bump modals.

**First-encounter memory:** the first time an NPC enters `memory.npcs`, a `firstEncounter` snippet is stored (cleaned response prose, ~280 chars, sentence boundary). Written once, never overwritten; preserved across `[NPC_MERGE:]`. Injected as "First met:" in `memoryNpcDetail()`.

## 12. Alignment drift

`character.alignLaw` and `character.alignGood` are integers clamped to [-3, 3]. `alignLabel(law, good)` maps to 9-point grid. GM shifts via `[ALIGNMENT:]` tags. **#139 (v1.557): the axes SEED FROM the label** (`alignSeedAxes`, ±2 = the threshold coordinate) at creation, and `migrateWorldState` heals any sheet whose axes' own label disagrees with the displayed one (the True-Neutral-snap defect; churn guards for consistent/earned/off-grid states). **#140③ (v1.562):** a LABEL flip files a ★ defining moment for player and companions (snapshot-diff machinery), and `buildDeityDriftNudge` gives a divine-class character whose actual alignment left their `DEITY_MAP` grid one neutral GM note per `DEITY_DRIFT_COOLDOWN`=25 turns (custom deities never judged; no silent mechanical revocation).

- **The measured award is per token (#215 → #273).** `rewardClaimAccept` measures each reward token against the ONE target it must move (`rewardAwardTargets`: XP, gold, an inventory COUNT that sums the `xN` suffix); a group lands only on an exact match, a partial names the missing tokens on both channels, an unmeasurable token is reported UNVERIFIED rather than assumed landed. A claim still CLOSES on failure — re-queue is the recorded #276 ③ residue.
