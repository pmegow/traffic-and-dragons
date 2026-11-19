# Lane D: tag_table.js and clock.js (HEAD d7ed4ea6)

Probe scripts are in `audits/audit-2026-11-19-evidence/D\` (`h.js` is the shared harness: the real engine via `dev/load-engine.js`, `makeTestWorld` + `migrateWorldState`, the UI stubbed, and the real boundary `applyMuts(text,{})` plus `cleanTxt(text)`).

## 1. Coverage

- **tag_table.js** (2,334 lines, 343 KB): read in full, lines 1–2334. The four lines over 2,000 characters (72, 618, 846, 884) were read whole with `sed`. Nothing skipped.
- **clock.js** (718 lines, 54 KB): read in full.
- **Contracts read first:** DOC/contracts/tags.md and DOC/contracts/clock.md.
- **Neighbours read only where a finding needed them:** api.js 3499–3583 (the applyMuts tail and R.errors), game.js 4238–4266 (resolvePlayerDeath), helpers.js 1645–1674 (the mana helpers), memory.js fileNpcEvent / npcLinkUpsert / factionUpsert, state.js archive registry, and identity.js:339 (the placeTimeline regex).
- **Not run:** the engine suite and every sabotage or browser suite, as the brief requires.

## 2. Findings

### F1 (high): `[DOWNED_RESOLVED:dead|…]` kills a hero who is not downed

**Summary.** The dead branch arms the true-death path without checking `worldState.downed`. A hale hero dies: the escort walk starts and a respawn is spent, and on the fourth death the campaign ends. The rescued/captured branch also files a false "left for dead … and lived" Defining Moment on a hero who was never down.

- **Where:** tag_table.js, the `DOWNED_RESOLVED` entry, lines 588–593.
  - `if(_out==="dead"||…){worldState.deathPending={turn:R.turn,cause:_why||"slain"};…return;}`
  - The rescued branch: `fileCoreMemory("downed",…" was left for dead…and lived")`
- **Downstream:** game.js:2716 calls `resolvePlayerDeath()` whenever `deathPending` is set. resolvePlayerDeath (game.js:4239) never consults `downed` either.
- **Failing input:** a world with hp 14/14, no downed state, and the reply `The bandit captain falls. [DOWNED_RESOLVED:dead|the captain bled out]`. A GM can easily misuse the standing doc line (tag_table.js:127) for a downed companion or foe.
- **Observed:**
  - The dead form gives muts `["☠ DEATH: the captain bled out"]` and `deathPending={turn:5,cause:"the captain bled out"}` with hp still 14.
  - `[DOWNED_RESOLVED:rescued|the militia arrived]` on the same hale hero files the coreMemory `"Tess was left for dead at Ashfen and lived — the militia arrived."`
- **Pax (READ, not run):** the handler does not call `__villageHarmRefused`, so the village's no-harm rule does not cover this death route either.
- **Tests:** the only test, engine-tests.js:3040, covers the downed case only.
- **Status:** REPRODUCED. Script `p3.js`, sections "DOWNED dead hale" and "DOWNED rescued hale".
- **Remedy:**
  - Refuse every outcome unless `worldState.downed` is set, with a ⚠ mut line and a console line.
  - Run the Pax gate first.

### F2 (high): middle and first fields written `([^|]+)` run past `]` and swallow the next tag

**Summary.** Several handlers capture a field with `[^|]+` (no `\]` in the class). If such a tag is short one field, the capture runs on through the prose and the next tag until it finds a pipe. Garbage then lands in canon (and sometimes a wrong link to a real NPC). The near-miss line meanwhile tells the player the tag was "dropped".

- **Where (tag_table.js):**
  - FUTURE_EVENT, line 1553: `/\[FUTURE_EVENT:([^|]+)\|([^\]]+)\]/` (the first field).
  - LOCATION_SIZE, line 708: `([^|]+)`.
  - COMBAT_START dmg field, line 1188: `\|([^|]+)\|([^\]]+)\]`.
  - NPC_SUPERSEDE, line 1562; NPC_LINK, line 1571; NPC_FACTION, line 1573; FACTION_REL, line 1574; SAVE_MOD, line 1615; COMPANION_ABILITY, line 1924: the middle `([^|]+)`.
- **Inputs and observed results:**
  - **FUTURE_EVENT.** Input: `[FUTURE_EVENT:The cult returns] Bram nods. [NPC:Bram|calm|ally]`. A futureEvent is filed with `what:"The cult returns] Bram nods. [NPC:Bram"` and `when:"calm|ally"`. The muts in the same reply also say `⚠ [FUTURE_EVENT:] malformed — dropped`.
  - **LOCATION_SIZE.** Input: `[LOCATION_SIZE:large] The hall is vast. [NPC:Bram|calm|ally]`. Node `Ashfen.size = "large] The hall is vast. [NPC:Bram"`. No warning of any kind.
  - **COMBAT_START.** Input: `[COMBAT_START:Goblin|7|15|+4|1d6] It snarls. [NPC:Bram|wary|ally]`. A foe is filed with `dmg:"1d6] It snarls. [NPC:Bram"` and `morale:"wary|ally"`. Its near-miss line says "malformed — dropped, nothing mutated".
  - **NPC_SUPERSEDE.** Input: `[NPC_SUPERSEDE:Bram|was a smith] later [QUEST:Find the smith|active]`. Bram's knowledge becomes `["active"]`. The receipt reads "Bram: superseded — active".
  - **NPC_LINK.** Input: `[NPC_LINK:Zarith|Guard Captain] later [NPC:Bob|calm|ally]`. A real edge is filed, Zarith ↔ **Bob** with rel `"calm|ally"`: the swallowed text was resolved to an existing NPC.
  - **NPC_FACTION.** Input: `[NPC_FACTION:Zarith|The Black Hand] and [NPC:Bob|calm|ally]`. A faction named `"The Black Hand] and [NPC:Bob"` is registered.
- **cleanTxt:** it strips each tag correctly (`[^\]]*`), so the prose looks right while the state is wrong.
- **Status:** REPRODUCED. Scripts `p1.js` and `p2.js`. SAVE_MOD, FACTION_REL and COMPANION_ABILITY are READ: same regex shape, not run.
- **Remedy:** use `[^|\]]+` in every one of these groups. That is a one-character change per regex, and it brings the strict outer regex in line with the near-miss shape.

### F3 (high): `[SPELL_DEF:…|tier=N]` takes any integer, and the tier becomes the caster's mana pool for good

**Summary.** The tier is stored unclamped in the write-once `capabilityBible` overlay. `manaSpellCost` returns that tier, and `manaMax` sums the costs of the spells on the sheet. So a model-authored tier sets the pool size permanently.

- **Where:** tag_table.js, the SPELL_DEF entry, line 1501: `sdEntry.tier=isNaN(_sdT)?0:_sdT`. The arithmetic is in helpers.js:1650–1669.
- **Input:** a sheet holding a homebrew spell "Doom Bolt" and the tag `[SPELL_DEF:Doom Bolt|tier=999999|effect=ruin|range=60 ft]`. The second case is `tier=-50` for "Mana Spring".
- **Observed:**
  - **tier 999999:** the receipt reads `cast: Doom Bolt (−999999 mana, 1/1000000)`, so the pool is now 1,000,000.
  - **tier -50:** `manaMax=-49`, and casting gives `cast: Mana Spring (−-50 mana, 1/-49)`. The mana ends above its max.
- **Persistence:** the definition is write-once, so it is never corrected.
- **Status:** REPRODUCED. Script `p7.js`.
- **Remedy:** clamp the tier to the bible's legal range (0..9, or the CAPABILITY_BIBLE maximum) and refuse the definition loudly if the tier is outside it.

### F4 (medium): `parseDuration` misreads decimals and weeks, and disagrees with the parser beside it

**Summary.**

- **Decimals:** `(\d+)\s*([dhm])` reads only the digits right before the unit. "1.5h" becomes 300 min (5h), "0.5h" becomes 300, and "2.5d" becomes 7,200.
- **Weeks and other unknown units:** they parse to 0, which is then floored to 1 minute without any warning. "2 weeks" becomes 1 minute, and "10 months" becomes 10 minutes.
- **The disagreement:** `parseStrictFutureDuration`, the other duration parser in the same file (clock.js:179–187), understands weeks ("3 weeks" = 30,240). So the same phrase means 3 weeks through `[FUTURE_EVENT:]` and 1 minute through `[SCHEDULE:]`.

- **Where:** clock.js:155–167 `parseDuration`; consumed by the TIME_ADVANCE handler (tag_table.js:691), `scheduleAdd` (clock.js:322) and `clockAtOffset` (clock.js:173).
- **Observed:**
  - `[TIME_ADVANCE:1.5h]` gives `Time +300m`.
  - `[TIME_ADVANCE:2 weeks]` gives `Time +1m`, with no warning.
  - `[SCHEDULE:Winter solstice|3 weeks]` gives `Scheduled: Winter solstice (in 1 minute)`. The clock block then tells the GM the solstice is "near: let the fiction feel it now". The event comes due the next turn and expires two days later.
- **Status:** REPRODUCED. Script `p4.js`, first line plus "TA 1.5h", "TA 2 weeks" and "SCHED 3 weeks".
- **Remedy:**
  - Accept `\d+(?:\.\d+)?` and add `w`.
  - When a non-empty string parses to 0, push ⚠ in TIME_ADVANCE/SCHEDULE instead of silently charging 1 minute.

### F5 (medium): the TIME handler reads the FIRST `[TIME:]`, but the rest's named wake reads the LAST

**Summary.**

- **The rule:** the REST doc line tells the GM to "also emit [TIME:dawn]" with `[REST:long]`.
- **What goes wrong:** if the reply also opened with a scene `[TIME:]`, the rest wakes at dawn (from the last tag). The post-handler reconcile then judges the first tag, sees a 13-hour gap, arms `reconcileSkip` with a ⚠ line, and leaves `world.time` stale.
- **Next turn:** the heal note demands a `[REST:long]` or `[TIME_ADVANCE:]` the party just did.

- **Where:**
  - tag_table.js:672: `text.match(/\[TIME:([^\]]+)\]/)` (first match only; sets `R.timeText`).
  - clock.js:462–467 `clockNamedWake`: `all[all.length-1]` (the last match).
  - tag_table.js:2171 reconciles against `R.timeText`.
- **Input:** clock at dusk (780), reply `[TIME_CHECK:dusk][TIME:dusk] You make camp… [REST:long] [TIME:dawn] You wake to grey light.`
- **Observed:**
  - The muts read `"Time: dusk"`, `"Rest: … slept until dawn (named) (+660m …)"`, `"⚠ Clock reconcile SKIPPED — 'dusk' is 13h ahead on the same day…"`.
  - `reconcileSkip={label:"dusk",delta:780,sameDay:true}` and `world.time="dusk"`, while the clock is at dawn.
- **Status:** REPRODUCED. Script `p4.js`, "two TIME + rest".
- **Remedy:** have the TIME handler take the last `[TIME:]`, the same reading clockNamedWake and the #389 contract use.

### F6 (medium): common malformed forms are stripped from the prose, apply nothing and say nothing

**Summary.** Each of the following leaves no mut line, no console line and no unknown-tag warning: the name is known, and the cleanTxt catch-all hides the tag.

- `[COMBAT_END]` with a fight open: the fight stays open.
- `[REST]` and `[REST:full]`: no rest, and the clock does not move.
- `[QUEST:Title]`, and `[NPC:Name]` or a four-field `[NPC:Bram|the smith|calm|ally]`: nothing is registered.
- `[GOLD:a few coppers]`: GOLD's outer regex requires a digit, so the D5 "carries no amount" refusal at tag_table.js:604 can never run. It is dead code.
- `[XP:-50]`.
- `[SUBLOCATION_LEAVE:The Rusty Tankard]`: the party stays inside. placeTimeline's regex at identity.js:339 is `\[SUBLOCATION_LEAVE\]` only.

**A related misread:** `[HP:-2d6]` parses the leading number, so the receipt is "Took 2 damage".

- **Contrast:** the #266 / audit A6 near-miss tripwire covers SCENE_NOT, COMBAT_START, ALIGNMENT, SAVE_MOD, SCHEDULE, FUTURE_EVENT, NPC_NOTE, NPC_SUPERSEDE, LOCATION_ITEM, EQUIPPED and COMPANION_ABILITY_USED. It does not cover NPC, QUEST, GOLD, XP, REST or COMBAT_END, the most frequent tags.
- **Status:** REPRODUCED. Scripts `p5.js` ("GOLD words", "NPC 4 fields", "XP neg") and `p9.js` (bare COMBAT_END, bare REST, REST:full, QUEST and NPC with one field, HP dice expression). `p8.js` covers "leave with colon".
- **Remedy:**
  - Call `__tagNearMiss` at the head of NPC, QUEST, GOLD, XP, REST and COMBAT_END.
  - Make the `[SUBLOCATION_LEAVE:…]` colon form either a leave or a ⚠ line.

### F7 (medium): `worldState.clock.schedule` has no bound on count, label length or due horizon, and every pending entry is in the prompt every turn

**Summary.**

- `scheduleAdd` does not cap the label length, the number of entries, or the due time.
- `parseDuration` has no ceiling. The 30-day cap applies only to TIME_ADVANCE, not to SCHEDULE.
- The sweep retires only entries more than 2 days overdue, so a far-future entry never expires.
- `buildClockBlock` writes every pending label into the volatile prompt half each turn.

- **Where:** clock.js:318–360 `scheduleAdd`, 407–426 `scheduleSweepExpired`, 696–718 `buildClockBlock`.
- **Observed:**
  - A 5,000-character label with `|99999d` is filed with `dueMin=143,998,560` (about 274 years away) and adds a 5,279-character clock block.
  - 300 distinct labels (each of the form `[SCHEDULE:Errand number i alpha i…|100+i d]`) give 301 entries and a 23,439-character clock block on every turn.
- **Compare:** WHISPER caps at 240 characters × 12, LORE at 30, and CONDITION via the sheet.
- **Status:** REPRODUCED. Script `p4.js`, "SCHED big" and "SCHED count".
- **Remedy:**
  - Clamp the label (for example to 120 characters) and the horizon (for example `CLOCK_MAX_RESPONSE_ADVANCE` or a stated maximum).
  - Cap the entry count with a loud refusal.

### F8 (low-medium): the companion condition and ability twins compare names case-sensitively; the hero's handlers do not

**Summary.** The copies disagree:

- **Hero, CONDITION and CONDITION_REMOVED** (lines 1596, 1607): `.toLowerCase()`.
- **Companion, COMPANION_CONDITION and _REMOVED** (lines 1910, 1916): `===`.
- **Hero, ABILITY_GAINED:** dedupes through `abilityHeldAs` (case, spacing, LvN).
- **Companion, COMPANION_ABILITY** (line 1924): dedupes with `===`.

- **Observed:**
  - `[COMPANION_CONDITION:Bram|Poisoned|…]` then `[COMPANION_CONDITION:Bram|poisoned|…]` leaves two conditions on Bram.
  - `[COMPANION_CONDITION_REMOVED:Bram|POISONED]` cures nothing and produces only the console line "not on Bram". The same three tags on the hero leave one condition, which is then cured.
  - `[COMPANION_ABILITY:Bram|Second Wind|…]` then `…|second wind|…` leaves two abilities; the hero keeps one.
- **Status:** REPRODUCED. Script `p3.js`, "comp cond case", "hero cond case", "comp ability dup" and "hero ability dup".
- **Remedy:** use the hero's comparator in the companion twins: lower-case compare, and `abilityHeldAs`.

### F9 (low-medium): `[COMPANION_XP:]` has no cap, while the GM's `[XP:]` is clamped by #302

**Summary.** `[XP:5000]` at level 1 is clamped to +10. `[COMPANION_XP:Bram|5000]` adds 5,000 to Bram's sheet. The doc says COMPANION_XP is for "a bonus one companion earns alone", but no clamp enforces the #302 economy on that route.

- **Where:** tag_table.js:1900–1907.
- **Observed:** hero XP 10 versus Bram XP 5,010.
- **Status:** REPRODUCED. Script `p3.js`, "xp caps".
- **Caveat:** I found no comment marking the companion route as deliberately uncapped, but I did not search the history. SUSPECTED unintended.
- **Remedy:** apply the same `GM_XP_CAP_PER_LEVEL × level` clamp, with a loud line.

### F10 (low): handler failures and many refusals never reach the player's channel

**Summary.**

- **Handler throws:** a throw inside any table handler in the ordinary (non-envelope) stream is caught. It goes to `R.errors` and `console.warn` only (tag_table.js:2159).
  - Outside the W2 envelope path, R.errors is read only by game.js:2798, as an audio gate. Nothing puts it into the muts, the provenance ring (api.js:3566), `reportError` or a toast.
  - Any state the handler wrote before throwing stays.
- **Console-only refusals:** LOCATION_HOURS malformed (576); DOWNED_RESOLVED unknown outcome (590); DEATH_ANSWER outside the scene (520); WARES/WANTED wrong form (781, 786); COMBAT_START duplicate or the foe cap of 8 (1206–1207); ENEMY_HP/ENEMY_SLAIN/ENEMY_SURRENDERS named target not found (1269, 1293, 1307); SPELL_USED not on the sheet (1432); MANA and COMPANION_MANA with no pool or no member (1468, 1475); COMPANION_SPELL_USED (1451); COMPANION_AGENDA (529); COMPANION_INITIATIVE (564); OUTFIT (1897); COMPANION_HP/CONDITION/ABILITY/ALIGNMENT/SKILL_SUCCESS unknown member; LOCATION_RESIDENT (974/976); COMBAT_START cap.
  - These contradict the #481 A7 "refusal marked where it is written" style that other handlers follow.
- **Status:** READ for the throw path. A 130-handler × 17-body fuzz (`p6.js`: empty, a pipe, 5,000 characters, an emoji, newlines, NaN, ±huge) produced no throws, no R.errors and no non-finite hp/coin/xp/mana/clock. So I could not trigger it. REPRODUCED for the refusals (several shown in `p7.js`: an ENEMY_HP heal returned an empty mut list).
- **Remedy:**
  - Push `"⚠ "+t+" failed: "+msg` into R.muts and the tagLog, and call reportError.
  - Add a ⚠ mut to each console-only refusal.

### F11 (low): extreme or odd operands corrupt quietly

**Summary.**

- **A GOLD figure of about 307 digits or more** makes `coin=Infinity`. The receipt reads "+Infinity gp", and JSON saves it as `null`, which reads back as 0.
- **`[ENEMY_HP:Goblin|+50]`** raises a foe above its maxHp (57/7) with an empty mut list (line 1277 has no upper clamp).
- **`[LORE:The [old] king sleeps]`** files "The [old", and the prose shows " king sleeps]". A nested `[` splits parse and strip.
- **`[COMBAT_START:Ghost|0|…]`** opens a fight and auto-closes it as "victory" in the same reply.

- **Status:** REPRODUCED. Scripts `p5.js` and `p7.js`.
- **Remedy:**
  - Cap the GOLD digits or check isFinite, with a refusal.
  - Clamp foe hp to maxHp.
  - Refuse hp < 1 at COMBAT_START.

### F12 (low): the near-miss tripwire calls a tag "dropped" when a looser regex then files it

**Summary.** This is the receipt half of F2, kept separate because the fix is different. `__tagNearMiss` (line 484) tests the strict shape, and then the handler's own looser regex applies the same tag anyway. That happens for COMBAT_START, FUTURE_EVENT and NPC_SUPERSEDE. The provenance ring therefore records "malformed — dropped (nothing mutated)" for a tag that mutated state. Each case has a quoted receipt in F2.

- **Status:** REPRODUCED. Scripts `p1.js` and `p2.js`.
- **Remedy:** make every handler's apply regex the near-miss strict shape, so the two predicates cannot disagree.

## 3. Monotonic resources

| Store (writer in lane) | Scope | Bound | Enforced? |
|---|---|---|---|
| `worldState.clock.schedule` (scheduleAdd) | campaign | none on count, label length or horizon | **No (F7)** |
| `worldState.clock.repairs` (clockRepair, scheduleDedupSweep) | campaign | one per repair id or sweep | By use only (rare operator path) |
| `memory.archive.expiredSchedules` (scheduleSweepExpired) | campaign forever | none | No: archive, storage-only by design (state.js:37) |
| `memory.archive.identityMerges` (NPC_MERGE: full pre-images, portraits stubbed) | campaign forever | none | No: by design, reversible merges |
| `memory.archive.npcForgotten` / `superseded` / `npcKnowledge` / `npcEvents` / `futureEvents` / `npcDeathCorrections` | campaign forever | none | No: by design (storage-only) |
| `worldState.character.storyBeats` (STORY_BEAT) | character forever (rides imports) | none | **No**: nothing trims it; rendered whole on the sheet (ui-sheets.js:133) |
| `character.conditions` / `saveModifiers` / `languages` / `abilities` / `aliases` | character | distinct names only | No count cap (GM-driven) |
| `memory.npcs[*].events` | campaign | 8 per NPC, archived overflow (memory.js:504, converges after a merge) | Yes |
| `memory.npcs[*].knowledge` | campaign | 12 per NPC, archived overflow | Yes |
| `memory.npcGraph.edges` / `factions` / `npcFactions` / `factionEdges` | campaign | none seen in lane | Not checked beyond memory.js entry points |
| `worldState.whispers` | campaign | `WHISPERS_CAP` (12), each 240 chars | Yes |
| `worldState.combatSlain` | campaign | `COMBAT_SLAIN_CAP` (12) | Yes |
| `worldState.combat.foes` | encounter | 8 | Yes (console-only refusal) |
| `worldState.pendingItemDefs` | campaign | 5 | Yes (loud) |
| `worldState.deadStatusConflicts` | campaign | dedup by name; drained by buildDeadStatusNudge (api.js:2095) | Yes |
| `worldState.locationTwinConflicts` | campaign | 4 (later twins still refused, just not recorded) | Yes |
| `worldState.recentWallSweep` | ~2 turns | filtered in game.js:2763 | Yes |
| `worldState.placeDecls` | turn | reset per reply | Yes |
| `worldState.diceLog` | campaign | `DICE_LOG_MAX` 500 (helpers) | Yes |
| `worldState.tagLog` (api.js, fed by R.muts) | campaign | `TAG_LOG_CAP` | Yes |
| `worldState.capabilityBible` overlay (SPELL_DEF) | campaign forever | one per distinct name (write-once) | No count cap |
| Quest objectives (QUEST_STEP) / `worldState.questLog` | campaign | none in lane | No count cap |
| `memory.map.nodes` (LOCATION / SUBLOCATION / PARTY_SPLIT) | campaign | none (it is the geography) | By design |
| `R.*` scratch (muts, _blocks, goldInAt, pendingShopKeepers, …) | per call | the reply's text | Yes |
| `__tagNoCombatWarns` counter | session | none (a number) | Harmless |
| `__TAG_KNOWN` cache, `TIME_PHASES_PROSE` regexes | page | fixed | Yes |

## 4. Affirmed (tried to break, could not)

1. **Reserved names (#545).** `__proto__`, `constructor`, `toString` and `hasOwnProperty` were used as the NPC, NPC_NOTE, QUEST, QUEST_STEP, LOCATION, SUBLOCATION, FACTION, NPC_FACTION, SCHEDULE and ARC_COMPLETE operand. Each filed as an own key. Object.prototype was unchanged and nothing threw (`p5.js`).
2. **Fuzzing every TAG_TABLE handler.** All 130 handlers got 17 bodies each: empty, one or two pipes, 5,000 characters, an emoji, a newline, NaN, ±99999999999, 1.5, and zeros. There were no throws, no R.errors, and no non-finite hero/companion hp, coin, xp or mana, foe hp or clock (`p6.js`).
3. **The three derived surfaces agree.** TAG_TABLE has exactly 130 entries, as the contract says. Every handler name is in the strip registry, and every stripped name either has a handler or is in TAG_NO_HANDLER (`p10.js`).
4. **The HP clamp.** `[HP:-<400 nines>]` floors at 0 and arms `downed` correctly (the receipt "Took Infinity damage" is cosmetic). The UA8 non-finite heal is present (`p5.js`).
5. **Quantity clamp.** `[ITEM_GAINED:Torch x99999]` is clamped to 999 with a ⚠ in the receipt (`p9.js`).
6. **The clock never goes backwards on the GM path.** `clockAdvance` coerces n < 1 and NaN to 1. Only `clockRepair` (an operator path with an expected-before check, idempotent ids, and a delta that must be finite and whole) can subtract. Read; the TIME_ADVANCE probes confirm the forward-only behaviour.
7. **The NPC_MERGE event overfill converges.** A concatenation beyond 8 is shrunk to 8 at the next fileNpcEvent, and the overflow is archived (memory.js:504; audit E50).
8. **The TIME_ADVANCE cap and the rest absorb hold.** Over 30 days is clamped with ⚠. A same-reply `[REST:long]` absorbs the advances loudly (tag_table.js:690–698, read).

## 5. Undetermined

- **The F1 kill path end to end.** Is there a game.js gate before line 2716 that drops `deathPending` when no downed state was ever armed? I read resolvePlayerDeath and found none, but I did not drive `commitGmTurn`. A headless commitGmTurn run with the F1 reply would settle it.
- **F9 intent.** Is the uncapped COMPANION_XP deliberate (for example an owner ruling alongside #178 or #302)? A search of DOC/CLAUDE_HISTORY.md and TODO for "COMPANION_XP cap" would settle it.
- **Downstream readers of F2's garbage.** Does the geo block or the map viewer render a garbage `node.size` and faction name verbatim into the prompt or HTML? I did not trace those readers (out of lane). An escaping check there would settle the injection side.
- **The F7 prompt cost.** Does the 23 KB clock block land in the cached half or the volatile half? The contract says volatile, so it would be billed every turn, but I did not measure it with capture-prompt.
