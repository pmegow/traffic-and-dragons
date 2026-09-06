# State tags — the parser, the strip, and the GM-facing doc

**Read this when** you touch tag_table.js, applyMuts, cleanTxt, a tag's parse/strip/doc, or a refusal path.

Split out of CLAUDE.md on 2026-09-03 (#310); the map there links here. Version stamps and history links inside are the record as written — the contract lines are current unless a newer commit says otherwise.


**The dice record (#350, v1.831 — owner 2026-09-05: "more often than not the player gets 14+; I wanted a record to verify").** `[DICE:label|total|outcome]` now has a handler that FILES and never applies: it is still stripped from the prose, and `TAG_NO_HANDLER` no longer lists it. `diceLogFile` (helpers.js) keeps a bounded ring `worldState.diceLog` (`DICE_LOG_MAX` 500; rides the save and the sync blob): the player's own click files face/mod/DC/total/outcome from `rollPendingCheck` (authoritative), a GM tag files label/total/outcome with the face and DC only when the tag states them (`d20 = 14`, `DC 12`), and a GM tag that repeats the player's roll this turn (same label and total) is skipped. `diceStats()` / `diceStatsLine()` report rolls by source, the recorded d20 faces, their mean, the 14+ share against a fair die's 35%, the judged checks' success rate and the mean DC; Table Talk's state block carries the line so "are my rolls fair?" is answered from data. Nothing before this kept a roll: [DICE:] was strip-only and the player's roll rode a silent send with no transcript line.
## Files

### tag_table.js

Status: ✅ Active (UA1)

⛨ **THE tag registry** — one ordered table (`TAG_TABLE`, ~57 handlers) from which three formerly hand-synced surfaces DERIVE: `applyMutsTable()` (THE parser), `buildCtTags()`/`buildCtBare()` (cleanTxt's strip regexes), and `buildStateTagsDoc()` (the STATE TAGS prompt block, frozen by engine tests). **SOLE PARSER** — the legacy parser is DELETED after a zero-diff validation arc ([history](DOC/CLAUDE_HISTORY.md#tag_tablejs--the-ua1-validation-arc)); rollback is `git revert`, not a flag. Retained tripwires: `__tagUnknownScan` (unknown tags warn), `__tagNoCombatWarns` (UA27), coverage guards + frozen strip/doc hashes in the suite. Adding a tag = one table entry (parse+strip+docs land together, phantom class impossible). `TAG_NO_HANDLER` documents the deliberate parse-less names. Smoke-replay tool: `dev/diff-replay.js <corpus.json>`

## 7. State tag system (`applyMuts`)

The GM embeds hidden tags in every response. `applyMuts(text)` parses them and mutates `worldState` and `memory`. Tags are stripped from displayed text by `cleanTxt()`.

**#197 (v1.665): an in-band model refusal is NON-CANON — refused narration is not tag-accessible (owner ruling 2026-08-20).** `detectModelRefusal` (api.js — anchored meta-voice opener + meta-object gate + `REFUSAL_MAX_CHARS` whole-response cap, deliberately narrow) is judged at `commitGmTurn`/`rerollLast` on the CLEAN text. A detected refusal still commits (the player saw it; re-roll needs the pair) but: `applyMuts` never runs (embedded tags withheld, named in a `tagLogRefusal` provenance-ring entry), the transcript entry is `rf`-marked (RAG never serves it — §8b guard ③), the narration observers (person/phase/drift-axes/stay-behind/ghost-consumable) skip it, delivered engine-note latches are restored (the #151 principle — the GM never acted), and a toast says re-roll or rephrase. Field origin: t1985, the Magnimar bathhouse (gemini-3.7-flash). Mutation proof: `dev/sabotage-refusal.js` (6 clauses; its `also:` option rides co-changed working files into the scratch clone — the multi-file sibling of the #196 fix).

**The authoritative registry is `tag_table.js`** — ~57 handlers; parse, strip, and the GM-facing STATE TAGS doc all derive from one entry each, and tags not indexed below (the W2 `SCENE_REF`/`CANON_TXN` family, clock tags, party split) live there and in their own sections. This index is the quick human reference:

| Tag | Effect |
|---|---|
| `[HP:+/-X]` | Adjust `character.hp`, clamped to [0, maxHp] |
| `[GOLD:+/-X]` | Adjust gold (parse tolerates `[GOLD:-5 gp]`) |
| `[ITEM_GAINED:name]` / `[ITEM_LOST:name]` | Push/filter `character.inventory`; GAINED auto-marks a matching location item taken |
| `[LOCATION:name]` | World move — files to memory+map, clears sublocation AND combat; a child-of-current name refuses loudly, asking for `[SUBLOCATION:]` |
| `[LOCATION_DESC:text]` | Canonical location description — written once, never overwritten |
| `[SUBLOCATION:name]` / `[SUBLOCATION_LEAVE]` | Enter/exit a named area inside the current world location |
| `[TIME_CHECK:phase]` | #216 — the READ-BEFORE-WRITE declaration: first tag of every response, the GM declares the phase the scene opens at (the #141 forced-checking-space shape). Read-only by contract — never moves the clock; off-band ≥`PHASE_MISMATCH_MIN` arms the #158 `phaseMismatch` nudge deterministically (band comparison, no prose recognition). Judged against the pre-advance clock (table position before the TIME family) |
| `[TIME:value]` | Phase assertion reconciled into the campaign clock (#131; #142 skip-and-demand across dawn); time renders from `clock.min`, never this stored twin |
| `[WEATHER:value]` | Set `world.weather` |
| `[LOCATION_ITEM:name\|placed]` / `[LOCATION_ITEM:name\|taken]` | Record an item left at / taken from the current node |
| `[LOCATION_STATE:what changed]` | #105 — append a durable state-change note to the current node (cap 3); served in the geo block + the always-present remote roll-up |
| `[DEATH_ANSWER:text]` / `[DEATH_ANSWER:none]` | #301 (v1.775) — engine-only vocabulary (the DEATH QUESTION note teaches it): Death's one answer on the escort walk, stored on `worldState.deathScene`; on the walk BACK it becomes mandatory canon on the restored world (lore + a `death-gift` Defining Moment + the waking note); `none` = the kind refusal. `buildDeathSceneBlock` (volatile, before STYLE) carries `DEATH_VOICE` and the answer rules while the scene lives; onward or the fourth death → `campaignDenouement` (`buildDenouementPrompt` + `DENOUEMENT_SYS`) → `fileDenouement` (last GM entry `den`, final chapter, `worldState.ended`) |
| `[DOWNED_RESOLVED:captured\|rescued\|intervened\|dead\|why]` | #300 (v1.774) — the GM's resolution of a DOWNED hero (0 HP arms `worldState.downed` in the `[HP:]` handler; `buildDownedNote` takes the wheel every turn; the post-handler seam `downedObserve` rules a death after `DOWNED_MAX_TURNS`=3 unresolved turns). captured/rescued/intervened end it (stabilised at 1 HP, the scar filed as a Defining Moment); dead arms `deathPending` → `resolvePlayerDeath` at commit: `checkpointRestore` to the last camp (`checkpointCapture` at Rest / `[REST:long]` / an act close / the campaign start — server slot + IndexedDB, never localStorage; the turn never rewinds; dead-branch transcript entries marked `db`, RAG-excluded), `RESPAWNS_PER_CAMPAIGN`=3 then `worldState.ended` |
| `[WARES:item\|price\|note]` / `[WARES:none]` / `[WANTED:item\|offer\|by]` | #303 (v1.772) — wants & economy on the WORLD node: wares capped by the node's LOCATION_SIZE tier (`WARES_CAP_BY_SIZE`), expiring after `WARES_RESTOCK_DAYS`=7 of game time; `none` records an honest empty market; a price outside `WARES_PRICE_BAND`=3× of the bible value warns and receipts the canon beside it, never rewrites. `buildMarketNote` asks once per node per window (latch `marketAsk`); the geo block serves FOR SALE HERE / WANTED HERE |
| `[LOCATION_RESIDENT:name]` / `[LOCATION_RESIDENT:name\|false]` | #173 — mark/clear the named character as "routinely based at" the current node (`guestbook[name].resident`); association ONLY, never presence; a resident-only record carries NO fabricated visit turn |
| `[NPC:name\|status\|relation]` | Upsert both NPC stores. Death status (`npcDeadStatus()`) stamps durable `npc.dead` — non-death writes then refuse (revival = explicit resurrected status); slain registered foes propagate at encounter close; the extractor's `npcDeaths[]` backstops prose deaths |
| `[XP:N]` | Add XP + `checkLevelUp()`; auto-MIRRORED to every living companion (#178 — a same-response `[COMPANION_XP:]` bonus lands ON TOP, never replaces) |
| `[QUEST:title\|status]` / `[QUEST:title\|status\|desc]` | Upsert quest log (offered/active/completed/failed/declined); completed/failed archive to `memory.quests` |
| `[QUEST_STEP:title\|objective\|done]` | Add or complete an objective (matched by text) |
| `[COMBAT_START:name\|hp\|ac\|atkbonus\|dmgdie\|morale]` | Start combat, or APPEND a foe to the encounter (cap 8; duplicate living name warns) |
| `[COMBAT_STATS:…]` / `[COMBAT_IMMUNE:…]` / `[COMBAT_RESIST:…]` / `[COMBAT_VULN:…]` | Set foe attributes; bind by positional adjacency to the closest preceding COMBAT_START (`COMBAT_ATTR_FALLBACK` otherwise) |
| `[ENEMY_HP:Name\|-X]` / `[ENEMY_HP:-X]` | Damage a foe — named routes exact-then-contains; bare routes single-living → engaged → first-living + warn. hp ≤ 0 → slain |
| `[ENEMY_SLAIN:Name]` | Outcome assertion — narrated kill, the engine zeroes the foe. Named only; unknown name warns, no mutation |
| `[ENEMY_SURRENDERS:Name]` / bare | Mark foe(s) surrendered (bare = all living); a surrendered foe stays in `foes[]` |
| `[COMBAT_ROUND:N]` | Set encounter round |
| `[COMBAT_END:outcome]` | Close the whole encounter (all-foes-down auto-closes even without it) |
| `[ABILITY_GAINED:Name\|Desc]` | Append to `character.abilities` (deduplicated) |
| `[ALIGNMENT:law+1]` / `[ALIGNMENT:good-1]` | Shift the axes (−3..3), recompute the label (#139 seed-from-label; #140 label flips file defining moments + deity-drift nudges) |
| `[ITEM_DEF:name\|…]` | #81 PROPOSAL — queues a player confirm (cap 5, dedupe); Accept = write-once `worldState.itemBible`. **#298 (v1.769): both grammars parse — `key=value` parts AND the positional `category\|effect\|uses\|value` order** (the engine note used to teach positional while the parser read only key=value, so empty definitions reached the confirm modal) |
| `[SPELL_USED:name]` | #110 mana spend via `manaPayCast`; racial 1/day keeps the hard `used` gate; a Necromancer overdraws as blood-HP, engine-deducted |
| `[MANA:±N\|cause]` / `[COMPANION_MANA:Name\|±N\|cause]` | #138 EXTERNAL mana effects only — never cast costs (pairing with a cast double-charges); loud no-op on a manaless target |
| `[LORE:fact]` / `[DECISION:desc]` | Append to `memory.lore` / `memory.keyDecisions` (cap 30 each) |
| `[FUTURE_EVENT:what\|when]` / `[FUTURE_EVENT_RESOLVED:what]` | File / resolve a pending event (#29 hygiene: dedupe, scalar `when` → clock schedule, expiry sweep) |
| `[NPC_NOTE:name\|note]` | Append an event note to the NPC record |
| `[NPC_FORGET:name\|person or event]` | Scrub matching knowledge/events so the fact stops re-injecting (the Oubliate teeth) |
| `[NPC_SUPERSEDE:name\|outdated\|truth]` | #57 reveal commitment — retire the stale knowledge line to the archive, record the truth |
| `[RETCON:what was corrected]` | Not a mutation — `rc`-marks the correcting + preceding transcript entries so RAG never serves them (#187: turn-addressed form + the receipted repair tool) |
| `[NPC_DEATH_REPORTED:name\|source]` | #194 — an off-screen death commits honestly AS REPORTED (no eyewitness claim; `npc.deathReported` stamped; creates a never-registered victim; resolves the subject's standing conflict). The valve's exit — deliberately exempt from scene-evidence gating |
| `[SCENE_CAST:Name, Name]` / `[SCENE_CAST:none]` | #194 — engine-ASKED whole-scene cast (node change / `CAST_REFRESH_TURNS`); rostered names record cast-sourced presence at the settled node; `none` makes non-answer measurable. Parse-less on purpose (consumed at the post-handler seam); ruling ④ (v1.811) promotes strictly earlier observed-frame cast evidence for death-gate authorization. Same-turn cast and cast-sourced guestbook/lastSeen limbs remain excluded |
| `[NPC_PRONOUN:name\|pronouns]` / `[NPC_ALIAS:canonical\|alias]` | Set pronouns / register an alias (every NPC-keyed tag resolves aliases) |
| `[NPC_MERGE:canonical\|duplicate]` | Absorb a duplicate NPC — complete pre-image archived to `memory.archive.identityMerges` FIRST (reversible by construction) |
| `[ALIAS:domain\|canonical\|alias]` / `[MERGE:domain\|canonical\|duplicate]` | #156 generalized identity pair (npc + location); pipe-bearing/unknown-domain operands refuse loudly; `[MERGE:npc\|New Name\|<provisional>]` is the provisional rename flow |
| `[PARTY_MEMBER:name\|true/false]` | Toggle party membership (cap enforced; over-cap NPC kept as a non-party ally) |
| `[DICE:label\|result\|outcome]` | Rendered as a dice block (no mutation) |
| `[SKILL_SUCCESS:skillId]` | Increment the skill counter; toast on level-up |
| `[CONDITION:name\|duration]` / `[CONDITION_REMOVED:name]` | Push/filter `character.conditions` |
| `[RELATIONSHIP_BOND:entity\|text]` / `[RELATIONSHIP_DYNAMIC:entity\|text]` | #168 W7 — write durable bond / current dynamic independently; replacing an existing bond stages a preimage + needs the exact tag re-emitted on a later response; >240 chars refuses |
| `[RELATIONSHIP_BOND_REMOVED:]` / `[RELATIONSHIP_DYNAMIC_REMOVED:]` / `[RELATIONSHIP_PAIR_REMOVED:]` | Axis/pair removal under the same confirmation/preimage contract |
| `[RELATIONSHIP:entity\|descriptor]` / `[RELATIONSHIP_REMOVED:entity]` | Compatibility-only — never guess an axis; queue a bounded explicit W7 choice |
| `[SAVE_MOD:source\|type\|amount]` / `[SAVE_MOD_REMOVED:source]` | Upsert/filter `character.saveModifiers` |
| `[LANGUAGE:name\|fluent/broken]` | Push or update a language |
| `[STORY_BEAT:text]` | Push a story beat + `fileDecision` |
| `[CORE_MEMORY:subject\|text]` | #40 GM-authored defining moment through `fileCoreMemory` — same write path as engine triggers (witnessed-by-all, cap 25, ~200-char clamp) |
| `[COMPANION_HP:]`, `[COMPANION_CONDITION:]`(+`_REMOVED`), `[COMPANION_RELATIONSHIP_BOND/DYNAMIC:]`(+removals, + legacy compat), `[COMPANION_ITEM_GAINED/LOST:]`, `[COMPANION_XP:]` (individual bonuses ONLY — shared awards arrive via the `[XP:]` mirror), `[COMPANION_ABILITY:]`, `[COMPANION_ALIGNMENT:]` | The player-tag twins for a named party member's `charSheet`, all routed via `findCompanionChar(name)` (api.js); the GM is instructed to use the `COMPANION_` prefix when an event affects a party member |
| `[ARC_COMPLETE:title]` / `[ACT_COMPLETE:title]` / `[ARC_CONTINUE:title\|reason]` | Skeleton lifecycle (#127 teeth: drift checks escalate to a forced complete-or-continue fork after two unanswered checks; `buildArcStagingNudge` surfaces never-introduced active arcs). The skeleton block carries the GM-EYES-ONLY knowledge boundary |
