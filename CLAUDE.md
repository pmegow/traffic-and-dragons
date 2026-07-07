# Traffic and Dragons — CLAUDE.md

## Project overview

**Traffic and Dragons** is a browser-based sword & sorcery RPG. The player creates a character through a multi-step wizard, then plays a text adventure narrated by Claude (via the Anthropic API) acting as the Game Master. The GM responds in vivid second-person prose, tracks the world state through hidden tags embedded in its responses, and maintains a rolling memory of NPCs, locations, lore, and decisions across sessions.

There is no build step and no npm dependencies. There is a cloud sync server on Fly.dev (`https://traffic-and-dragons-server.fly.dev`) — optional, used for cross-device campaign persistence.

---

## Current architecture — SPLIT COMPLETE

All logic has been extracted from the HTML into separate JS files.

### Files on disk

| File | Status | Contents |
|---|---|---|
| `index.html` | **Active host** | CSS, HTML scaffolding, 10 `<script src>` tags, no inline JS |
| `globals.js` | ✅ Extracted | `apiKey`, `busy`, `lastAction`, `panelCol`, `secCol`, `activeChatTab`, `pendingChar`, `pendingSpellPool`, `pendingBumps`, `currentBump`, `rvGold`, `customRules`, `RENDER_MODELS`, `pendingCompanions` |
| `data.js` | ✅ Extracted | All game data constants (TONES, ANCS, CLSS, ABILS, ARCHETYPES, CLASS_FEATURES, SPELLS, ARCH_SPELLS, XP_LEVELS, STAT_BUMP_LEVELS, STAT_PRIORITY, DEITY_MAP, DEITY_CENTRIC, DEFAULT_RULES, SPELL_PICK_LIMITS, SKILLS, SKILL_LEVELS, SKILL_THRESHOLDS) |
| `helpers.js` | ✅ Extracted | Utility functions: `smod`, `skillLevel`, `initSkills`, `alignLabel`, `pval`, etc. |
| `state.js` | ✅ Extracted | `store`, `worldState`, `sessionLog`, `memory`, save/load functions, storage key constants |
| `storage-adapter.js` | ✅ Extracted | Cloud sync: `loginWithServer`, `syncToServer`, `syncCampaignList`, `loadFromServer`, `logoutFromServer`, `listCharLibrary`, `saveCharToLibrary`, `deleteCharFromLibrary` |
| `memory.js` | ✅ Extracted | `sessionTokens`, `fileNpcEvent`, `fileLocation`, `fileLore`, `fileDecision`, `fileFutureEvent`, `resolveFutureEvent`, `memoryTOC`, `memoryNpcDetail`, `summarize` |
| `api.js` | ✅ Extracted | `callGM`, `buildSysPrompt`, `getRulesBlock`, `applyMuts`, `findCompanionChar`, `cleanTxt`, `diceTxt`, `parseActions`, `buildGeoBlock` |
| `char-creation.js` | ✅ Extracted | All wizard step logic, `cs`, `confirmChar`, archetype/spell/stat-bump pickers |
| `game.js` | ✅ Extracted | `sendAction`, `sendSuggestedAction`, `beginAdventure`, `retryLast`, `checkLevelUp`, `showArchetypeModal`, `pickArchetype`, `showStatBumpModal`, `restSpells`, `doRender`, `newGame`, `syncCharSheet`, `checkLegacyCharacter`, `checkCompanionLevelUp` |
| `ui.js` | ✅ Extracted | `syncUI`, `updateHUD`, `updateInvPanel`, `updateAbPanel`, `updateSpPanel`, `updateCombat`, `updateMemStatus`, `showGame`, `showChar`, `addMsg`, `switchTab`, `showToast`, `showSyncModal`, `showRulesModal`, `exportSave`, `importSave`, `showCharSheet`, `showNpcSheet`, `showCampaignPicker`, `buildFilename`, `wireButtons`, `showCharLibrary`, `_showCharExportOptions`, `showCompanionBrowser`, `_renderCompanionSlots` |

### Script load order

```
globals.js → data.js → helpers.js → state.js → storage-adapter.js → memory.js → api.js → char-creation.js → game.js → ui.js → tts.js
```

Each file depends only on symbols defined by files earlier in this list.

---

## HTML screens

| Element | Purpose |
|---|---|
| `#api-screen` | API key entry (shown on first load) |
| `#char-screen` | 6-step character creation wizard — has its own File ▾ menu at top |
| `#game-screen` | Main game interface |
| `#lineage-popup` | Sub-popup for Half-Blood lineage selection |
| Dynamic modals | `#creation-arch`, `#creation-bump`, `#creation-spells`, `#arch-modal`, `#sb-modal`, `#rules-modal`, `#sync-modal`, `#cs-modal`, `#camp-modal` — all appended to `<body>` at runtime |

## Game screen layout

```
#topbar              — HUD: name, HP, gold, alignment, location + action buttons
                       Buttons: Sheet | Sync | Render | Rest | Retry | File ▾
#sidebar             — Slide-out world state panel (fixed, off-screen by default)
#membar              — Memory status bar (~tokens / chapters / NPCs / turn number)
#cpanel              — Combat tracker (HP bars, rounds) — hidden when not in combat
#story-area
  #story-narrative   — Scrolling narrative message log (Story tab)
  #story-tabletalk   — Scrolling table talk log (Table Talk tab, display:none by default)
  .rpanel            — Collapsible right panel: Inventory / Abilities / Spells sections
#inputarea
  #inrow             — Text input + Send button
  #chat-tabs         — Two pill tabs: Story | Table Talk
```

---

## Key systems

### 1. Character creation wizard (6 steps)

| Step | Content |
|---|---|
| 1 – Tone | Choose world tone: High Fantasy, Gritty, Sword and Sorcery, Dark Horror, Political Intrigue, or Custom, plus prose-voice pick. Bottom of step has "↩ Import existing save" file input and "⚙ Load blueprint". |
| 2 – Identity | **Merged with Ancestry (v1.141, TODO #25).** Gender (M/F/NB), age, then an Ancestry picker inline below: 7 ancestries (Human, Elf, Dwarf, Gnome, Half-Blood, Hollow-Born, Tiefling), each with 2–3 subraces; Half-Blood has nested lineage selection via `#lineage-popup`. Picking an ancestry swaps the grid (`#anc-grid-wrap`) for a detail view (`#anc-detail`) in place — "← All ancestries" (`anc-back-detail`/`hideAncDetail()`) returns to the grid without leaving the step. Single Back/Next pair (`id-back`/`anc-next`) for the whole step; `anc-next` validates ancestry + subrace + lineage (if applicable) + flex stat picks before advancing. |
| 3 – Class | 9 classes (Warrior, Rogue, Sorcerer, Ranger, Berserker, Paladin, Cleric, Druid, Necromancer) |
| 4 – Attributes | Roll 4d6 drop-lowest (auto-assigned by `STAT_PRIORITY`) or Point Buy (27 pts, using `PBC` cost table); stated alignment; auto-suggested deity for Cleric/Paladin/Druid |
| 5 – Finishing Touches | Physical description, backstory, portrait (upload / render from sheet / derive appearance from portrait) |
| 6 – Review | Full character preview + campaign name + starting location + starting level (1–10) + companion selection (up to 3) — **party cap is `PARTY_MAX`=4 total** (player + companions): the creation picker, the mid-game import, and the `[PARTY_MEMBER:\|true]` handler all enforce `partyCompanionCap()` (= `PARTY_MAX - playerCount`, 3 today; multiplayer #1 makes playerCount dynamic). `buildSysPrompt` injects a live "PARTY SIZE: N of 3 … FULL" note so the GM doesn't narrate a join it can't make; the `applyMuts` cap is the backstop (keeps the over-cap NPC as a non-party ally). **Manual departure (v1.96):** the NPC sheet has a "Part ways" button → `partWaysWithCompanion()` flips `partyMember` off (NPC kept, slot freed) and sets transient `worldState.recentlyLeft`, which `buildSysPrompt` surfaces as a "PARTY DEPARTURE" note (auto-cleared in `sendAction` after ~2 turns, same pattern as `recentSwitch`) so the GM stops narrating them as present. |

After step 6, if level ≥ 3: archetype picker → stat bump(s) → spell picker → `startGame()`.

**Step 2 uses `<select id="char-gender">` with options M/F/NB** — pronouns have been removed from the character schema entirely.

**Starting languages** are derived automatically in `confirmChar()` from ancestry/subrace and stored in `char.languages[]`:
- All characters start with Common
- `ancLangMap`: elf→Elvish, dwarf→Dwarvish, gnome→Gnomish, tiefling→Infernal, hollow→Umbral
- `subLangMap` (halfblood subraces): half_elven→Elvish, half_orcish→Orcish, half_draconic→Draconic, half_infernal→Infernal, half_fey→Sylvan, half_gnomish→Gnomish

### 2. Game data constants (all in `data.js`)

- `TONES` — 6 tone presets, each with a `vc` (voice directive sent in the system prompt)
- `AUTHORS` — Prose-inspiration voices (TODO #23), each `{id, nm, blurb, vc, profane?}`. `vc` is a style directive injected into the system prompt by `buildSysPrompt` (`proseBlock`); `profane:true` voices (Abercrombie, Dinniman, Muir) swear only when `adultMode` is on, otherwise keep the rhythm but stay clean. Selected via **Dev Mode ▸ ✍ Prose inspiration…** (`showProseModal()`), read live so it takes effect next turn. **Per-campaign (v1.87):** the choice is stored on `worldState.proseAuthor`, so it rides the sync blob and follows the campaign across devices; `buildSysPrompt` uses `worldState.proseAuthor` when set, else the device default (global `proseAuthor`, loaded from `PROSE_K`/`tnd_prose_v1`). Saving in-game pins the campaign AND updates the device default; pre-game selection sets only the default, which new/unset campaigns inherit via the fallback. The old hard `2-3 sentences maximum` STYLE cap was **removed entirely** (it was the run-on root cause — capping count made the model cram everything into one dense sentence). The STYLE rule now forbids clause/em-dash/simile cramming and hands length/rhythm to the selected prose voice.
- `ANCS` — Ancestry definitions with `stats`, `traits`, `subraces`, optional nested `lineages`, and optional `racial_spells:[{nm,lvl}]` on subraces/lineages
- `CLSS` — Class definitions: `hd` (hit die), `prime` stat, starting `gear`
- `ABILS` — Starting class abilities (name + description)
- `ARCHETYPES` — 3 archetypes per class (24 total)
- `CLASS_FEATURES` — Level 2/5/7/9 feature unlocks per class
- `SPELLS` — Spell lists for Sorcerer, Cleric, Druid, Ranger, Paladin, Necromancer (cantrips + levels 1–3). **Necromancer also has a tier 4** (Rigor Mortis, Possess Thrall, Sleep of the Dead) — tiers are intentionally open-ended; creation only ever offers up to tier 3 (`buildPendingSpellPool` caps `maxSlot` at 3), so higher tiers are GM-grantable / high-level content only.
- `ARCH_SPELLS` — Extra spell lists for Eldritch Knight and Arcane Trickster archetypes
- `XP_LEVELS` — XP thresholds for levels 1–10: `[0, 300, 900, 2700, 6500, 14000, 23000, 34000, 48000, 64000]`
- `STAT_BUMP_LEVELS` — `[4, 8]` (levels where +2 stat improvement is awarded)
- `STAT_PRIORITY` — Per-class stat assignment order for rolled stats
- `DEITY_MAP` + `DEITY_CENTRIC` — Alignment-based deity suggestions for Cleric/Paladin/Druid
- `DEFAULT_RULES` — ~28 hard GM rules always injected into the system prompt (incl. character sheet upkeep, engine-controlled XP/leveling, mandatory NPC registration on direct interaction, quest lifecycle, active-crises-are-quests, player-actions-are-intent). Count grows over time — see data.js for truth; an editorial merge pass is queued as AUDIT_FABLE #19.
- `SPELL_PICK_LIMITS` — Max spells selectable per tier during creation: `{cantrips:2, "1":2, "2":2, "3":1}`
- `SKILLS` — Array of 36 skill objects `{id, label, cat}` across 8 categories (Physical, Endurance, Wilderness, Knowledge, Craft, Social, Roguish, Perception). Wilderness includes **Tracking** (WIS/INT), which doubles as urban tailing.
- `SKILL_LEVELS` — `["Unskilled","Familiar","Trained","Proficient","Expert","Master"]`
- `SKILL_THRESHOLDS` — `[1, 5, 12, 25, 50]` (cumulative successes to reach levels 1–5)

**`skillLevel(successes)`** returns 0–5 based on `SKILL_THRESHOLDS`.
**`initSkills()`** builds a zeroed skill map `{skillId: 0}` for all 36 skills.

**Racial spells:** Subrace and lineage entries in `ANCS` may have a `racial_spells:[{nm, lvl}]` array. `confirmChar` reads this and pushes entries into `char.spells` as `{nm, lvl, used:false, racial:true}`. Currently wired for: Elf Drow (Dancing Lights cantrip, Faerie Fire 1/day, Darkness 1/day) and Half-Blood Drow lineage (Faerie Fire 1/day).

### 3. State management (in `state.js`)

Three live objects, all persisted to `localStorage` via the `store` wrapper:

| Object | Storage key | Contents |
|---|---|---|
| `worldState` | `tnd_core_v10` | `character`, `world` (location/region/time/weather/threat), `npcs[]`, `questLog[]`, `eventHistory[]`, `combat`, `turn` |
| `sessionLog` | `tnd_sess_v10` | Current-session messages sent to the API (`[{role, content}]`); cleared on summarization |
| `memory` | `tnd_mem_v10` | Long-term narrative memory: `npcs{}`, `locations{}`, `quests{}`, `lore[]`, `keyDecisions[]`, `futureEvents[]`, `chapters[]` |

`store` wraps `localStorage` with an in-memory fallback `_m`. Storage key constants (`WSK`, `SLK`, `MEM_KEY`, `AKK`, `RLK`) are defined in `state.js`.

Campaign list metadata stored in `tnd_camps_v1` — array of lightweight campaign entries used by the campaign picker.

### 4. v10 Character schema

```javascript
{
  name, gender,           // gender: "M" | "F" | "NB"  (replaces pronouns)
  age, appear, mark, backstory,
  ancestry, subrace, subraceNm, heritageVariant,
  cls, stats, hp, maxHp, gold,
  inventory[],            // plain strings
  level, xp,
  abilities[],            // {nm, ds}
  spells[],               // {nm, lvl, used, racial?}
  archetype, archetypeNm,
  statedAlignment, actualAlignment, alignLaw, alignGood,
  deity,
  trait, flaw, motivation,
  languages[],            // {name, broken}
  skills,                 // {skillId: successCount} — all 36 keys, zeroed at creation
  conditions[],           // {name, duration}
  relationships[],        // {entity, descriptor}
  saveModifiers[],        // {source, type, amount}
  portrait,               // null | base64 data URL (compressed to max 400×600px JPEG 0.8)
  storyBeats[],           // {text, turn}
  partyMember             // bool — always true for the player character
}
```

`worldState` also carries `campId` (string matching `tnd_active_v1`) so the campaign ID survives exports and reimports without creating duplicate campaign slots, and `proseAuthor` (per-campaign prose-inspiration voice id, v1.87 — see AUTHORS above).

### 5. API usage

**Provider-agnostic since v1.30.** `callGM()` routes through the active provider in the `PROVIDERS` table (`globals.js`). Each provider is a self-contained object — `{id, label, keyHint, endpoint, defaultModel, models[], headers(key), buildBody(msgs,sys,maxTok,model), parseResponse(json), parseUsage(json)}` — and `callGM()` picks `PROVIDERS[activeProvider]` and calls its methods. **No `if(provider===...)` branches anywhere else.** This same shape is the intended server-side routing table under the subscription model.

- **anthropic** — `https://api.anthropic.com/v1/messages`; `x-api-key` + `anthropic-dangerous-direct-browser-access: true`; system as a top-level `system` field — **a two-block array for gameplay turns since v1.151**: `[{stable + cache_control:ephemeral}, {volatile}]` (prompt caching, TODO #11; see §6), plain string for sysOverride calls; response at `content[0].text`. Default model `claude-sonnet-4-6` — **verify this string is current before starting work each session.**
- **openai** — `https://api.openai.com/v1/chat/completions`; `Authorization: Bearer`; system carried as a leading `{role:"system"}` message; response at `choices[0].message.content`. Default model `gpt-4o`. (CORS: OpenAI allows direct browser calls, no special header.)
- **grok** — `https://api.x.ai/v1/chat/completions`; OpenAI-compatible (same body/response), `Authorization: Bearer`. Default `grok-4.3` (see `PROVIDERS` in globals.js for the current list — old grok-2-*/grok-beta IDs are retired).
- **gemini** — `endpoint` is a **function(model)** (`.../v1beta/models/{model}:generateContent`) since Google embeds the model in the URL; `x-goog-api-key` header; system in `systemInstruction.parts[]`, messages in `contents[]` with role `model` (not `assistant`); response at `candidates[0].content.parts[0].text`. Default `gemini-3.5-flash` (retired 1.5/2.0 IDs 404 — see `PROVIDERS` in globals.js for the current list). `callGM()` resolves `typeof prov.endpoint==="function"?prov.endpoint(model):prov.endpoint`.
- **ollama** — `http://localhost:11434/v1/chat/completions`; OpenAI-compatible. **Mixed-content blocked** from an https origin / unreachable from `file://` — only works when the game is served from localhost. Exploration tier.

Shared `TAG_REINFORCE` constant (globals.js) is assigned to every non-Claude provider's `reinforce` (Claude needs none). Model names in each provider's `models[]` should be verified current; the modal's dropdown is fixed to that list. **All four non-Claude adapters are shape-verified but each still needs a live tag-fidelity test (a money turn) once a key is available — same process that surfaced the gpt-4o gotcha.**

**Provider state** (`globals.js`): `activeProvider` (id), `providerKeys` ({id:key}), `providerModels` ({id:modelOverride}). Persisted via `PROV_K`/`PKEYS_K`/`PMDL_K` in `state.js`; `loadProviderSettings()` migrates the legacy `AKK` Anthropic key into the map. Switch providers / set keys / pick model via **File ▸ Dev Mode ▸ 🧠 Language Model…** (`showProviderModal()` in `ui.js`). Keys for all providers are retained, so switching back and forth needs no re-entry.

**Per-provider prompt reinforcement:** a provider may carry an optional `reinforce` string. `callGM()` appends it to the system prompt for gameplay turns only (`if(!sysOverride&&prov.reinforce)`), never to `summarize()`. **Finding from the v1.32 GPT bring-up:** gpt-4o parses responses and produces valid `summarize()` JSON fine, but treats the state tags as optional — it narrates "you pay 5 gold" without emitting `[GOLD:-5]`, silently desyncing the sheet. `openai.reinforce` is a forceful MANDATORY-TAG-DISCIPLINE block with exact formats + the gold-for-a-room example. Claude needs no reinforcement (its `reinforce` is unset). This is the per-provider tuning the abstraction exists for. Additionally, the `[GOLD:]` and `[HP:]` parsers were loosened to `/\[(GOLD|HP):\s*([+-]?\d+)[^\]]*\]/` shape so a model writing `[GOLD:-5 gp]` (which the prompt's own format hint invites) still parses.

`callGM(msg, sysOverride, maxTok, modelOverride, opts)` is the single API entry point. `opts.noHistory` sends only the given message instead of the full `sessionLog` (used by the action-suggestion call, v1.144). `opts.kind` tags the call for usage telemetry (defaults: `"turn"` when no sysOverride, `"other"` for utility calls).
- `maxTok` is optional; defaults to `1000`. `summarize()` passes `2000`.
- Appends `msg` to `sessionLog` for the request body but does not push to `sessionLog` itself.

**Usage/cost telemetry (TODO #21, v1.150):** every provider carries `parseUsage(json)` returning `{in, out, cacheRead, cacheWrite}` (Anthropic: `usage.*` incl. both cache counters — note its `input_tokens` EXCLUDES cached tokens; openai/grok/ollama share `OPENAI_USAGE`, whose `prompt_tokens` INCLUDES cached; Gemini reads `usageMetadata`). `callGM` passes the result to `recordUsage(u, kind, model)` (api.js), which accumulates onto `worldState.usage` — totals + per-kind buckets (`turn`/`actions`/`summarize`/`skeleton`/`sync`/`other`) + `costUSD` priced at record time from `MODEL_PRICING` (globals.js, $/MTok; unknown/non-Anthropic models count tokens but contribute $0). `blankUsage()` lives in state.js; `migrateWorldState` adds the accumulator to old saves. UI: **Dev Mode ▸ 📊 Usage & cost…** (`showUsageModal` in ui.js, all three File menus) — per-kind table with input-per-call averages, estimated cost, and a Reset button for starting a fresh measurement window. The `turn` bucket's In/call average is the before/after metric for prompt caching (#11).

Three callers:
- `sendAction()` — normal gameplay turns (1000 tokens)
- `beginAdventure()` — opening narrative on game start (1000 tokens)
- `summarize()` — memory extraction, JSON-only output (2000 tokens)

### 6. System prompt construction (`buildSysPrompt`)

Assembled fresh on every request from live state. **Since v1.151 (TODO #11, prompt caching) it returns `{stable, volatile}` instead of one string** — the STABLE half is campaign-constant text (byte-identical turn to turn; an engine test enforces this), the VOLATILE half is all per-turn state. The Anthropic adapter sends them as a two-block `system` array with `cache_control:{type:"ephemeral"}` on the stable block (re-reads at 0.1× input price, 5-min TTL); other providers flatten via `sysJoin()` (globals.js). `sysOverride` callers (summarize/actions/skeleton) still pass plain strings — those stay single uncached blocks. **Anything reading worldState/memory/sessionLog must never leak into the stable half** — one stray turn counter kills every cache hit.

**STABLE half (cached), in order:**

1. `getRulesBlock()` — default + custom narrative rules
2. Adult-content block (when enabled)
3. GM role declaration + tone directive + tone-subordination note + narrative-design DNA
4. MECHANICS/dice format + full STATE TAGS instructions + companion-tag instructions

**VOLATILE half (uncached), in order:**

5. Player identity header + transient switch/departure blocks
6. Character sheet (stats, HP, gold, alignment, abilities, spells, inventory)
5. **Conditions, relationships, save modifiers, languages, skills** (v10 additions)
5b. **PARTY MEMBER SHEETS** (`partyBlock`, v1.75) — for each `npc.partyMember && npc.charSheet` (alive), a rich per-companion block: class/archetype/level, HP, stats, abilities, **spells available** (unused only), inventory. Without this the GM only saw the one-line NPC roster entry and never knew a companion could cast — so companions (even a sorcerer) defaulted to swinging a weapon. The block header instructs the GM to have each companion act in character with their own kit and track resources via `COMPANION_*` tags.
7. World state (location, time, weather, NPCs, active quests) + party sheets + party-size note
8. `memoryTOC()` — compact summary of known NPCs, visited locations, pending events, recent decisions, chapter summaries
9. `memoryNpcDetail()` — full detail on NPCs mentioned in the last 6 session messages
10. Combat state block (if `worldState.combat` is set) + event history (last 8 compressed chapter summaries)
11. Identity REMINDER + style directive — **STYLE stays at the very END on purpose** (uncached tail): end-of-prompt position is load-bearing for prose-voice fidelity (audit #2). The GM writes pure prose — no `[ACTIONS:]` tag (decoupled, see §13).

**Gender in image prompts:** `doRender()` uses `c.gender==="F"?"female":c.gender==="NB"?"androgynous":"male"` — never uses pronouns.

### 7. State tag system (`applyMuts`)

The GM embeds hidden tags in every response. `applyMuts(text)` parses them and mutates `worldState` and `memory`. Tags are stripped from displayed text by `cleanTxt()`.

| Tag | Effect |
|---|---|
| `[HP:+/-X]` | Adjust `character.hp`, clamped to `[0, maxHp]` |
| `[GOLD:+/-X]` | Adjust `character.gold` |
| `[ITEM_GAINED:name]` / `[ITEM_LOST:name]` | Push/filter `character.inventory` |
| `[LOCATION:name]` | Update `world.location`, clear `sublocation`, file to `memory.locations` and `memory.map` |
| `[LOCATION_DESC:text]` | Store canonical description for current location (written once on first visit, never overwritten) |
| `[SUBLOCATION:name]` | Enter a named area within the current world location; sets `world.sublocation` |
| `[SUBLOCATION_LEAVE]` | Exit sub-location; clears `world.sublocation` |
| `[TIME:value]` | Set `world.time` (free text, e.g. "dawn", "late night"). The world clock has no engine advancement — this tag and the Sync modal are the only writers (audit R2) |
| `[WEATHER:value]` | Set `world.weather` (free text, e.g. "heavy rain") |
| `[LOCATION_ITEM:name\|placed]` | Record item left/hidden at current location node; pairs with `[ITEM_LOST:]` |
| `[LOCATION_ITEM:name\|taken]` | Mark item as taken by NPC/event; player pickup auto-handled by `[ITEM_GAINED:]` |
| `[NPC:name|status|relation]` | Upsert `worldState.npcs[]` and `memory.npcs{}` |
| `[XP:N]` | Add XP, trigger `checkLevelUp()`. **XP parity (v1.172):** automatically mirrored to every party companion's `charSheet` (+ `checkCompanionLevelUp`), EXCEPT companions named in a `[COMPANION_XP:]` tag in the same response (individual award supersedes the mirror — no double count) |
| `[QUEST:title\|status]` or `[QUEST:title\|status\|desc]` | Upsert `worldState.questLog[]`. status: `offered`/`active`/`completed`/`failed`. `offered` toasts "⚑ Quest opportunity"; `completed`/`failed` archive to `memory.quests` and remove from the live log |
| `[QUEST_STEP:title\|objective\|done]` | Add an objective to a quest (`done` omitted/false), or mark an existing one complete (`done=true`); matched by objective text |
| `[COMBAT_START:name|hp|ac|atkbonus|dmgdie|morale]` | Set `worldState.combat` |
| `[COMBAT_STATS:STR:N|DEX:N|CON:N|INT:N|WIS:N|CHA:N|CR:N]` | Set enemy ability scores and CR (always emit alongside COMBAT_START) |
| `[COMBAT_IMMUNE:type,type]` / `[COMBAT_RESIST:...]` / `[COMBAT_VULN:...]` | Set damage immunities/resistances/vulnerabilities; displayed in combat panel |
| `[ENEMY_HP:-X]` / `[COMBAT_ROUND:N]` / `[COMBAT_END:outcome]` | Update or clear combat state |
| `[ABILITY_GAINED:Name|Desc]` | Append to `character.abilities` (deduplicated) |
| `[ALIGNMENT:law+1]` / `[ALIGNMENT:good-1]` | Shift `alignLaw`/`alignGood` (-3 to +3), recompute `actualAlignment` |
| `[SPELL_USED:name]` | Mark matching spell as `used: true` |
| `[LORE:fact]` | Append to `memory.lore` (capped at 30) |
| `[DECISION:desc]` | Append to `memory.keyDecisions` (capped at 30) |
| `[FUTURE_EVENT:what|when]` | Append to `memory.futureEvents` |
| `[FUTURE_EVENT_RESOLVED:what]` | Mark matching future event resolved |
| `[NPC_NOTE:name|note]` | Append event note to `memory.npcs[name].events` |
| `[NPC_FORGET:name\|person or event]` | Scrub a specific memory from `memory.npcs[name]` — substring-filters `.knowledge[]` and `.events[]` so the fact stops re-injecting. The engine teeth behind the Arcane Trickster **Oubliate** spell (tier 4). Its lesser sibling **Lethe's Kiss** (tier 3) is narrative-only |
| `[RETCON:what was corrected]` | GM emits when it corrects/rewinds/retracts previously narrated events. Not a mutation — `logTranscript` (state.js) marks the correcting transcript entry AND the immediately preceding GM entry with `rc:1`, and `ragRetrieve` never serves `rc`-marked entries (RAG de-index; see §8b) |
| `[NPC_PRONOUN:name|pronouns]` | Set pronouns on NPC in both stores |
| `[NPC_ALIAS:canonical|alias]` | Register alias for an NPC; all future tags using the alias silently resolve to canonical; shown in NPC list as `Name [aka: alias]` |
| `[NPC_MERGE:canonical|duplicate]` | Absorb duplicate NPC entry into canonical (merges events, knowledge, aliases); cleans up matching relationships; removes duplicate from both stores |
| `[PARTY_MEMBER:name|true/false]` | Set `partyMember` bool on NPC in `worldState.npcs` and `memory.npcs`; creates NPC entry if missing; flagged in system prompt NPC list |
| `[DICE:label|result|outcome]` | Rendered visually as a dice block (not a mutation) |
| `[SKILL_SUCCESS:skillId]` | Increment `character.skills[id]`; toast on level-up |
| `[CONDITION:name|duration]` | Push `{name, duration}` to `character.conditions` |
| `[CONDITION_REMOVED:name]` | Filter matching condition from `character.conditions` |
| `[RELATIONSHIP:entity|descriptor]` | Upsert `{entity, descriptor}` in `character.relationships` |
| `[RELATIONSHIP_REMOVED:entity]` | Filter matching relationship |
| `[SAVE_MOD:source|type|amount]` | Upsert `{source, type, amount}` in `character.saveModifiers` |
| `[SAVE_MOD_REMOVED:source]` | Filter matching save modifier |
| `[LANGUAGE:name|fluent/broken]` | Push or update language in `character.languages` |
| `[STORY_BEAT:text]` | Push `{text, turn}` to `character.storyBeats`; also calls `fileDecision` |
| `[COMPANION_HP:Name\|+/-N]` | Adjust HP on named party member's `charSheet` (clamped to its maxHp) |
| `[COMPANION_CONDITION:Name\|cond\|dur]` / `[COMPANION_CONDITION_REMOVED:Name\|cond]` | Add/remove condition on companion `charSheet` |
| `[COMPANION_RELATIONSHIP:Name\|entity\|descriptor]` / `[COMPANION_RELATIONSHIP_REMOVED:Name\|entity]` | Upsert/remove relationship on companion `charSheet` |
| `[COMPANION_ITEM_GAINED:Name\|item]` / `[COMPANION_ITEM_LOST:Name\|item]` | Push/filter companion `charSheet.inventory` |
| `[COMPANION_XP:Name\|N]` | Add XP to companion `charSheet`. Since v1.172 this is for INDIVIDUAL bonuses only — shared party XP arrives automatically via the `[XP:]` mirror (the GM is told never to re-emit a shared award) |
| `[COMPANION_ABILITY:Name\|nm\|desc]` | Append ability to companion `charSheet.abilities` (deduplicated) |
| `[COMPANION_ALIGNMENT:Name\|law+1]` | Shift companion `alignLaw`/`alignGood`, recompute `actualAlignment` |

**Companion tags** all route through `findCompanionChar(name)` in `api.js`, which matches a party member by name (`npc.partyMember && npc.charSheet`). They mutate the companion's `charSheet` object rather than `worldState.character`. The GM is instructed (via `buildSysPrompt` COMPANION SHEET TAGS block + DEFAULT_RULES upkeep rule) to use the `COMPANION_` prefix when an event affects a party member instead of the player.

### 8. Memory / summarization system (in `memory.js`)

`sessionTokens()` estimates the token count of the **unextracted** part of `sessionLog` (sum of `content.length` / 4, counting only messages past the `worldState.sessKept` marker — see tail retention below). When it hits `SUMMARIZE_AT` (globals.js, 2400 — raised from 1200 with #28; 1200 was tuned in the sentence-cap era and fired every ~2 exchanges under prose-voice response lengths), `summarize()` fires before the next player action. On failure the log is KEPT and retried next turn; after 3 consecutive failures a raw excerpt is archived as a degraded chapter and the log is trimmed to the retained tail (v1.144/v1.165).

`summarize()`:
1. Sends the unextracted session log (from `sessKeptStart()`) to the API with a JSON-extraction system prompt (2000 token limit), plus the current pending-events list under an "ANTICIPATED EVENTS" header (#29)
2. Parses response as `{chapterSummary, npcUpdates[], loreDiscovered[], decisionsMade[], futureEvents[], resolvedEvents[]}`
3. Files everything via `applySummaryExtract(extracted)` (sync, engine-testable): chapter summary → `memory.chapters` + `worldState.eventHistory`; NPC attitudes/knowledge; lore; decisions; then futureEvents in the #29 order — expire → file new → resolve
4. Retains a tail of the just-summarized exchanges and saves memory + core

**futureEvents hygiene (#29, v1.166):** the GM rarely emits `[FUTURE_EVENT_RESOLVED:]` on its own, so pending events used to accumulate finished business (t198: 7 "find Shalelu" variants pending while Shalelu sat at the party's campfire). Three teeth, all in memory.js: ① `fileFutureEvent` near-duplicate dedupe — a new event sharing ≥2 significant stemmed tokens (`feTokens`) AND ≥half the smaller fingerprint with an existing pending event refreshes that event's `setTurn` instead of filing a twin; ② `expireFutureEvents()` sweeps unresolved events older than `FUTURE_EXPIRE_TURNS` (globals.js, 40) every summarize — deterministic, no model judgment; unstamped pre-v10 entries are grandfathered (stamped now, age from there); ③ the extractor is handed the pending list and echoes the EXACT text of items the session shows finished into `resolvedEvents[]`, which `resolveFutureEvent` then removes. Resolve runs LAST in `applySummaryExtract` so an event set and finished inside one window nets out removed.

**Summarize-tail retention (#28, v1.165):** `summarize()` used to clear `sessionLog` to zero — in mature campaigns the GM's verbatim window dropped to ~2 turns and it confabulated recalls (the t160 pin-grab incident). Now `retainSessionTail()` keeps the newest exchanges (up to `SUMMARY_KEEP_EX`=3 pairs within `SUMMARY_KEEP_TOK`=1600 tokens; the newest pair always survives) as live context, and `worldState.sessKept` marks how many leading messages were already extracted. `sessionTokens()` counts only past the marker (retained tail can't re-trip the threshold — no thrash) and the extraction prompt slices from the same marker (no exchange is ever filed to memory twice). Stale markers (import/clear) fail safe to zero via `sessKeptStart()`. Retrieval side effect: the RAG dynamic skip window (`skipN`, §8b) keys off `sessionLog.length`, so it automatically covers the deeper live window.

Memory status shown in `#membar` as `~NNNtk`: green dot below 80% of `SUMMARIZE_AT`, amber at 80%+, red at/above `SUMMARIZE_AT`.

### 8b. RAG episodic memory (v1.154, TODO #27 Phase 1 — see [RAG_MEMORY.md](RAG_MEMORY.md))

Entity-keyed retrieval over the verbatim transcript — no vectors, no extra API calls, **read-side only** (summarize/chapters/caps untouched). **Default OFF**; per-campaign flag `worldState.ragMemory` (rides the sync blob), toggled via **Dev Mode ▸ 🗂 Episodic memory…** (`showRagModal()`, all 3 menus).

- **Index:** `logTranscript(role,text,raw)` stamps every GM transcript entry with `e:{n:[npcs],l:location,q:[quest titles]}` parsed from the RAW response tags + a known-NPC name scan (`ragEntitiesFromRaw`, memory.js). Written regardless of the flag so the index is ready when the flag flips. Pre-Phase-1 entries are lazily backfilled (name-scan only) during retrieval. Additive fields — no schema bump.
- **Retrieval:** `ragRetrieve(input)` (memory.js) scores GM entries by overlap with the current scene (party + NPCs last seen here + location + active quests) ∪ NPCs named in the player's input (weighted highest); skips the last 10 turns (already in sessionLog); picks ≤3 excerpts ≥3 turns apart within a ~600-token budget; renders oldest-first as turn-pair excerpts under a "PAST SCENE EXCERPTS … the CURRENT state blocks above override anything here" header (the stale-chunk drift guard — excerpts are episodic texture, never current truth).
- **Pollution guards (v1.167):** three exclusions keep false/meta content out of the served set. ① `rc`-marked entries — the `[RETCON:]` tag (see §7) marks the correcting entry + its predecessor at `logTranscript` time; ② **meta exchanges** — GM entries whose player half opens with `"GM:"` (the OOC-question convention) are recall chatter, often confabulated, and were outranking the origin scenes they quote (t164 broadsheet displacement) and preserving false corrections (t160 pin-grab); ③ both exclusions also drop the entries from the IDF document set. Plus the **merge-orphan bridge**: write-time `e.n` names deleted by a later `[NPC_MERGE:]` (e.g. entries stamped `"Hemlock"` after the key collapsed into `"Sheriff Belor Hemlock"`) are re-resolved through `resolveNpcName` (memoized) at scoring time — without it the origin scenes went invisible after the t198 merges. Untagged prose corrections from before the tag existed (e.g. the t35 debt correction) remain indexed — known residual.
- **Injection:** `buildSysPrompt` VOLATILE half only, after ACTIVE NPC DETAILS. Never touches the cached stable block (engine-tested).
- **TOC diet (same flag):** `memoryTOC` filters LORE to scene-relevant + most-recent-8 (cap 12) and drops the CHAPTER SUMMARIES section (duplicates the STORY SO FAR block). **Flag off must reproduce today's TOC byte-for-byte** — engine-tested; don't restructure the off-path strings.
- Measured on the Runelords t54 save: the diet more than paid for the excerpts (volatile net −480 chars with a 1,360-char excerpt block included); flag-off volatile byte-identical to the pre-feature prompt.

### 9. Map data layer (`memory.map`)

Two-tier location graph stored in `memory.map`: `{nodes:{}, edges:[], lastArrivalFrom:null}`.

**Node keys:** world locations use the plain name (`"Ashfen"`); sub-locations use `"Location|SubLocation"` (e.g. `"Ashfen|The Rusty Flagon"`).

**Node structure:** `{firstVisit:turn, visits:0, description:null, parent:null, npcs:[], items:[]}`. `parent` is `null` for world nodes, or the world location name for sub-location nodes.

**Edges:** `{from, to, turn}` — undirected connection recorded once on first travel between two world locations.

**`worldState.world.sublocation`** — new field (`null` or string) tracking the current sub-location.

**Location items:** `{name, placed:turn, taken:false}`. `taken` is a boolean toggle — `placed` resets it to `false` even if previously taken (item returned). `autoTakeLocationItem()` is called on `[ITEM_GAINED:]` to auto-mark the matching location item as taken.

**NPC last-seen:** `mapNpcLocation(name)` stamps the NPC into the current node's `npcs[]` array and sets `memory.npcs[name].lastSeenAt` to the current node key.

**`buildGeoBlock()`** (in `api.js`) generates a `GEOGRAPHY` block injected into every system prompt turn:
- Current world + sub-location header
- Canonical location/sub-location descriptions
- Items present vs. items previously taken
- Known sub-locations of the current world location
- Arrival direction (`lastArrivalFrom`)
- Connected world locations (from edges)
- NPCs last seen elsewhere (prevents phantom-NPC issues)

`[LOCATION_DESC:]` is stored once (never overwritten) and always re-injected, preventing GM description drift.

### 10. Combat system

Combat state lives in `worldState.combat`: `{name, hp, maxHp, ac, atk, dmg, morale, round}`. All mechanics handled by GM through state tags. `#cpanel` shown/hidden by `syncUI()`.

### 10b. Quest system (v1.34)

Quests are GM-emergent and **player-gated**. Live quests live in `worldState.questLog[]` as `{title, status, desc, objectives:[{text,done}], started}`; finished ones archive to `memory.quests{}`.

**Lifecycle:** `offered → active → completed/failed`, plus `declined`. The GM creates quests via `[QUEST:title|offered|desc]` (toasts "⚑ Quest opportunity"). An offered quest is NOT a goal — the GM may not steer toward or advance it. The player accepts via the **Quest Journal** (Accept button → `acceptQuest(idx)` sets `active`) or by agreeing in-story (GM emits `[QUEST:title|active]`). Decline → `declineQuest(idx)` archives as `declined`. On `completed`/`failed`, `archiveQuest()` moves the quest to `memory.quests` and removes it from the live log; rewards come via the GM emitting `[XP:]`/`[GOLD:]`/`[ITEM_GAINED:]` in the same response.

**Anti-drift:** `buildQuestBlock()` re-injects the authoritative ACTIVE (with objective checklists) + OFFERED blocks into every system prompt — the GM reads quest state from data each turn rather than from its own compressible memory, same pattern as the character sheet. A DEFAULT_RULES entry forbids inventing/renaming/dropping quests and auto-accepting. **Lifecycle teeth (#20, v1.172):** the t198 corpus check showed the lifecycle going silent in mature campaigns (0 `[QUEST:]` emissions; quests at 4/4 objectives never closed). `buildQuestBlock` now adds ① a quest-specific "⚑ ALL OBJECTIVES COMPLETE — emit `[QUEST:title|completed]` with rewards, or add the next objective" instruction when every objective is done (deterministically detected), and ② a standing one-line "active crises ARE quests — register unlisted goals now" reminder (present even when the log is empty). Both in the volatile half. `openai.reinforce` includes the quest tags for non-Claude providers.

**UI:** world-state sidebar shows quest titles + a `⚑ N opportunities` indicator; clicking opens `showQuestModal()` — Opportunities (Accept/Decline) · Active (☑/☐ objective lists) · History (completed/failed/declined from `memory.quests`).

### 11. Level-up system

`checkLevelUp()` called inside `applyMuts()` whenever XP changes:
- HP gain per level: `ceil(hd/2) + 1 + CON_mod` (minimum 1)
- Class feature at new level added from `CLASS_FEATURES`
- Level 3: `showArchetypeModal()`
- Levels 4, 8: `showStatBumpModal()` (+2 to one stat or +1 to two, max 20)

`checkCompanionLevelUp(cs)` called from the `[COMPANION_XP:]` handler — companions auto-level silently (HP gain + class features, same formula) with a toast and system message, but no archetype or stat-bump modals.

**First-encounter memory:** the first time an NPC enters `memory.npcs` via `[NPC:]` or `[PARTY_MEMBER:|true]`, a `firstEncounter` snippet is stored — the cleaned response prose with the trailing suggestion line stripped, cut at a sentence boundary (~280 chars max), computed once per response (lazy). Written once, never overwritten; preserved across `[NPC_MERGE:]`. Injected as "First met:" in `memoryNpcDetail()`.

### 12. Alignment drift

`character.alignLaw` and `character.alignGood` are integers clamped to [-3, 3]. `alignLabel(law, good)` maps to 9-point grid. GM shifts via `[ALIGNMENT:]` tags.

### 13. Rendered action suggestions (decoupled — #14, v1.110)

Action suggestions are **fully decoupled from GM prose** (v1.110). The GM writes pure narrative — no `[ACTIONS:]` tag, no `*You could…*` line. The STYLE block explicitly tells the GM NOT to emit action suggestions.

**Flow:** after the GM response renders, `generateActions(msgEl)` in `game.js`:
1. Creates 3 placeholder `"…"` buttons (disabled) appended to the narrator message element
2. Fires a lightweight follow-up `callGM` call (200 token budget, `sysOverride` so no full system prompt rebuild) asking for 3 short action options as a JSON array
3. Parses the response, populates each button's text and `data-action`, enables them
4. Stores the options in `worldState.lastActions` via `saveCore()` for reload persistence
5. On failure, silently removes the placeholder buttons

**Reload:** `init()` and `campLoad()` check `worldState.lastActions` first and build buttons via `buildActionButtons(acts)` (returns HTML string). Falls back to `parseActions(clean, raw)` for pre-v1.110 saves that still have the `[ACTIONS:]` tag embedded.

**`parseActions`** (api.js) is retained only for legacy save replay — reads `[ACTIONS:]` tag primary, then `[a|b|c]` without prefix, then the old `*You could…*` prose-parsing. No new responses use it.

- Buttons rendered as `<button class="qa" onclick="sendSuggestedAction(this,event)" data-action="…">`. Tap fills the input (converted to 1st person via `toFirstPerson`, #14a/v1.83); long-press / Ctrl-click sends (#14a/v1.56).
- Side benefit: removing `[ACTIONS:]` from the STYLE block freed model attention, noticeably improving prose-voice fidelity.

### 14. Table Talk mode

Implemented as a **tab** (not a checkbox). `activeChatTab` global is `"narrative"` or `"tabletalk"`. `switchTab(tab)` toggles visibility of `#story-narrative` / `#story-tabletalk` and updates tab button styles. `addMsg` routes by message type. A blue badge dot appears on the inactive tab when a message arrives there. `isTT` in `sendAction` is derived from `activeChatTab === "tabletalk"`.

### 15. File menu

Present on both `#game-screen` (in `#topbar`) and `#char-screen` (top-right above step dots).

**Submenu presentation (v1.160/v1.161):** drawers open as **side flyout panels on desktop** — the toggle measures the parent item's rect BEFORE opening and flies toward whichever side of the screen has more room (away from the closest edge; leftward is the CSS default, rightward the inline override). At ≤768px they fall back to the **inline accordion** — positioning lives on the `.fm-subwrap`/`.fm-sub` CSS classes (index.html), open/closed state is the inline `display` the JS toggle flips. Flyouts reset closed whenever a File menu opens (`resetFileSubmenus`).

**Game screen items (reorganized v1.158 — cascading drawers):** Sync state (mobile), World state (mobile), Render prompt (mobile) | Campaigns… | Car Mode | **💾 Save / Load ▶** (Save Game, Load Game, Export Character, Import Character, Export as Blueprint) | ☁ Blueprint Library… | **⚙ Admin ▶** (Voice Settings…, **📖 Narrative options ▶** (Narrative rules, ✍ Prose inspiration…, 18+ Adult content), Language Model…, 📊 Usage & cost…, 🗂 Episodic memory…, Render Options…, Large text, Auto-send voice, Legacy characters, campaign folder, Connect/Disconnect server, Clear cache) | Clear cache & reload | New Game. Cascading toggles share one wiring loop in `wireButtons` (`devmode/devmenu`, `saveload/saveloadmenu`, `narropts/narroptsmenu` — narropts nests inside Admin). **The Blueprint Designer has NO menu entry by user preference** — open `blueprint-designer.html` directly.

**Char screen items:** Same full list, but Sync state, World state, Render prompt, Save Game, Export Character, and New Game are greyed out (`opacity:0.4; pointer-events:none`) — no active game yet.

Both menus share the same underlying functions. `updateServerUI()`, `loadAdultMode()`, and `toggleAdultMode()` sync state across both menus simultaneously.

**File naming:** `buildFilename(type)` in `ui.js` — format `[campName]_[charName]_t[turn].[ext]`. `worldState.campName` is set once at campaign creation and never changes.

Auto-export narrative fires every 10 turns as a background download (no manual export button).

### 16. Campaign management

`showCampaignPicker()` reads `tnd_camps_v1` from localStorage. `saveAll()` calls `storageAdapter.syncToServer()` on every save — **debounced (v1.146)**: schedules a trailing 1.5s timer so a turn's multiple saveAll bursts coalesce into ONE `POST /api/state` built from the latest state. `storageAdapter.syncNow()` flushes immediately; wired to `beforeunload` and `visibilitychange(hidden)` so closing/backgrounding can't drop the final turn. The payload no longer carries the story DOM (`narrativeHtml` is sent as `""`) — replay rebuilds from `worldState.transcript`.

After connecting to server, `syncCampaignList()` fetches the server campaign list and merges it into `tnd_camps_v1`, then the campaign picker opens automatically.

### 17. Sync modal

Direct editing of HP, max HP, gold, XP, level, location, time, weather, inventory without going through the GM.

### 18. Render feature

`doRender()` calls the **fal.ai** API. Three models selectable via Render Options modal (in Dev Mode):
- **Flux Dev** — `fal-ai/flux/dev` (text-to-image) / `fal-ai/flux/dev/image-to-image` (img2img, strength 0.6)
- **Nano Banana 2** — `fal-ai/nano-banana-2` / `fal-ai/nano-banana-2/edit` (img2img via `image_urls`)
- **Qwen Image 2512** — `fal-ai/qwen-image-2512` / `fal-ai/qwen-image-edit/image-to-image` (img2img, strength 0.9 — edit-style model returns near-copies at 0.6)

When `character.portrait` exists, img2img is used automatically (status line shows "Generating scene (portrait-seeded)…"). Falls back to text-to-image if no portrait.

Parameters: `aspect_ratio:"4:3"`, `resolution:"1K"`. `genderWord` derived from `c.gender` (male/female/androgynous).

### 19. Portrait system

`character.portrait` — null or base64 data URL. Compressed via `compressPortrait()` (Canvas resize to max 400×600px, JPEG 0.8) before storage to avoid localStorage quota overflow.

Set from three paths:
1. Scene render → portrait button on render output
2. Portrait modal → "Use as Portrait" button
3. Portrait modal → file upload

**Pan + zoom (v1.39):** `character.portraitOffset = {x, y, zoom}` — x,y are 0..1 (fraction of pannable overflow), zoom ≥ 1. Rendered by `applyPortraitTransform(img, off)` (transform: translate+scale, applied post-load since it needs natural dims), NOT `object-position` (which is intra-element and can only pan the single cover-overflow axis — a landscape image in the portrait oval overflows horizontally only, so vertical pan needs zoom to create slack). `wirePortraitDrag()` does drag-pan + wheel/pinch zoom + exposes `img._zoomBy(factor)` for the modal's +/− buttons. `normPortraitOff()` upconverts legacy `{x:0..100}` object-position saves. The player char-sheet avatar, **companion (party-member) char-sheet avatars**, and the portrait modal all use the offset; small NPC/list/party-HUD avatars stay center-cropped. **Companion portrait single-source (v1.169, Known issue #3):** an NPC's portrait lives in ONE place — `charSheet.portrait` when a sheet exists (rides inline in the sync blob), `npc.portrait` only for sheet-less NPCs (separate `/portrait` store). All display reads go through `npcPortrait()` (helpers.js, charSheet-first with `npc.portrait` fallback for unmigrated saves); `migrateWorldState` drops the old duplicate. This also fixed the Daeris cross-device desync (Known issue #6): display used to read only `npc.portrait`, which travels via the PV-gated separate store, while the blob-borne `charSheet.portrait` was ignored. **Transport (v1.170):** the `/portrait` store collectors read via `npcPortrait()` (single-home images still upload for PV-path edits), and `fillPortraitsFromBlob()` (storage-adapter) runs on every server reconcile regardless of the turn/PV gates — fill-only, landing blob-borne charSheet portraits on devices already at the current turn (without it, equal-turn devices had NO portrait transport at all — the v1.169 Frizwick/Morwen mobile gap). **Companion offset (v1.43):** stored per-companion on `wsNpc.portraitOffset` and mirrored onto `wsNpc.charSheet.portraitOffset` (so it survives promotion-to-PC). `showNpcSheet` wires `wirePortraitDrag` on `#npc-portrait-img` via `wireNpcAvatarDrag()` and passes `getOffset`/`setOffset` into `showPortraitModal` — without those the modal's defaults fall back to `worldState.character`, silently rewriting the PLAYER's framing while editing a companion (the v1.43 bug). Portraits now generate at **3:4 portrait aspect** via `portraitRenderBody()` (overrides the render model's landscape default; scene renders untouched).

### 20. Character sheet modal (`#cs-modal`)

Opened via **Sheet** button in topbar (desktop) or File menu (mobile). Built by `showCharSheet()` in `ui.js`.

**Visual style:** `rgba(0,0,0,.88)` overlay, inner `#181818` box with `1px solid var(--acc)` amber border, `border-radius:12px`, `max-width:560px`. Click outside or × to close.

**No pill/chip borders anywhere** — all data rendered as plain text. Commas separate list items. Used spells get `text-decoration:line-through` + dim color. Broken languages shown in amber with `(broken)` suffix.

**Sections:** Hero card · Attributes · Character (trait/flaw/motivation/backstory) · Conditions · Relationships · Languages · Save Modifiers · Skills (earned only) · Story Beats · Abilities · Spells · Inventory

**⟳ Sync button** (header, beside Export Character) calls `syncCharSheet()` in `game.js`. It sends an internal GM audit prompt (not a player turn) asking the GM to emit ONLY state tags for anything missing or changed on the player AND every party member — using `COMPANION_*` tags for companions. The prompt enumerates each party member by name. Response passes through `applyMuts()`; the sheet then closes and reopens. Gated by `busy`; uses a 500-token budget. Provides a manual fallback for older sessions where the GM didn't emit upkeep tags inline.

### 21. NPC alias system

`resolveNpcName(name)` in `memory.js` resolves aliases to canonical name before any storage op. All NPC-keyed tags resolve aliases: `NPC`, `NPC_PRONOUN`, `NPC_NOTE`, `PARTY_MEMBER`, `RELATIONSHIP`, `RELATIONSHIP_REMOVED`. NPC list in system prompt shows `Name [aka: alias1, alias2]`.

### 22. Cloud sync (`storage-adapter.js`)

**Server:** `https://traffic-and-dragons-server.fly.dev`
**Auth:** GitHub OAuth popup → server postMessages `{type:"tnd-auth", sessionId, username}` back to opener → token stored in `tnd_server_tok_v1`.
**CORS:** Server uses `origin: function() { return "*"; }` to handle `null` origin from `file://` pages.
**Endpoints:** `GET /auth/github`, `GET /auth/github/callback`, `GET /auth/me`, `POST /auth/logout`, `GET /api/campaigns`, `GET /api/campaigns/:id`, `POST /api/state`, `GET /api/state`, `GET /api/messages`
**Deploy:** `cd traffic-and-dragons-server && flyctl deploy --ha=false`

### 23. Reload behavior

On `init()`, if a saved game is found, `rebuildNarrativeFromTranscript()` (ui.js, v1.146) repaints the last 20 `worldState.transcript` entries into `#story-narrative` (with an "earlier entries omitted" note when trimmed); the last response's suggested action buttons (`worldState.lastActions`) are live and clickable. The same rebuild serves campaign loads and the server reconcile (`clearFirst=true` there). Fallbacks for pre-transcript saves: last sessionLog exchange, else a "Previously:" chapter recap, else legacy `narrativeHtml` from old server blobs. Dice blocks and system messages are not replayed (the transcript stores story prose only, by design).

---

## Conventions

- **ES5.1+ JavaScript** — `var`, no arrow functions, no template literals, no `const`/`let`. `async/await` only in the three API-facing functions. ES5.1 builtins (`.forEach`, `.map`, `.filter`, `Object.keys`) and `Object.assign` (ES6, universally supported) are permitted.
- **Single-character variables** common in dense utility functions.
- **HTML built by string concatenation** — no templating engine.
- **State versioning via key suffix** — all storage keys end in `_v10` (campaigns in `_v1`).
- **No front-end dependencies** — CSS and JS entirely self-contained.
- **CSS variables** for theming — palette in `:root`, amber accent `--acc` (#b8935a) is the visual identity color.
- **Modals always created fresh** — remove prior instance by ID before creating new one.
- **`busy` flag** — global boolean gates all API calls. Always set `busy=false` in both success and error paths.
- **Scrollbars** — custom styled via `::-webkit-scrollbar` rules: 6px wide, near-black track, dark grey thumb, amber on hover.
- **No pill/chip borders on non-interactive elements** — use plain text, comma-separation, or `cs-list-row` rows instead. Borders imply clickability.
- **File menus are GENERATED, not hand-written (v1.159)** — `buildFileMenus()` (ui.js, called first in `wireButtons`) renders all three File menus (`#file-menu`/`#cs-file-menu`/`#api-file-menu`) from ONE spec. To add/move/remove a menu item, edit the spec in `buildFileMenus` — never touch index.html (the mount divs there are empty). Ids keep the `fm-`/`cs-fm-`/`api-fm-` prefixes (import inputs: `""`/`cs-`/`api-`), so all existing id-based wiring works unchanged. Per-surface differences (disabled items on char/API screens, mobile-only quick actions on the game screen) are flags in the spec.

---

### 23. Character library (`storage-adapter.js` + server)

Server-side character storage separate from campaigns. Characters are portable snapshots — exporting Ammut at Lv3 stores a Lv3 version; campaigns have no dependency on this store.

**Server table:** `characters (user_id, slug, name, char_data, level, cls, ancestry, updated_at)` — composite PK `(user_id, slug)`. One slot per character name per user.

**Server endpoints:**
- `GET /api/characters` — list all characters for user (includes full char_data with portrait)
- `POST /api/characters` — upsert by name slug; body: `{character}`
- `DELETE /api/characters/:slug` — remove from library

**Client methods on `storageAdapter`:** `listCharLibrary(cb)`, `saveCharToLibrary(char, cb)`, `deleteCharFromLibrary(slug, cb)`

**Export flow:** "Export Character" button (char sheet + companion sheets) opens `_showCharExportOptions(char)` — offers "☁ Save to library" (grayed if not connected) and "⬇ Download .char file". If saving and character already exists in library at a different level, `_showCharOverwriteConfirm` asks before overwriting.

**Import flow:** `showCharLibrary()` browser modal — lists saved characters with portrait, Import (→ `showCharImportPreview`) and × delete buttons. Accessible via the "☁ Library" button in the Import Character browser.

**"Play as X" flow:** all three import paths (file, campaign browser, library) route through `_startImportedCampaign(char)` in `ui.js` — a campaign-setup modal asking campaign name, world tone, and starting location (options cloned from the wizard's Review-step select) before resetting state and calling `startGame()`. The character is played as-is; companions are added in-game via Import Character → Add as companion (intro instruction sent via `sendAction(intro,{silent:true})` so it never renders as a player message).

**Mid-game character swap (v1.38):** `_switchPlayerCharacter(name)` (NPC sheet → "Play as this character") demotes the current PC to a companion NPC and promotes the chosen companion's `charSheet` to `worldState.character`. The POV-handoff problem (GM kept narrating the old PC as "you") is fixed two ways: (1) the handoff message is a forceful out-of-character control directive ("the player now controls X; second-person = X; old PC is now third-person"), sent `{silent:true}`; (2) `worldState.recentSwitch = {to, from, turn}` makes `buildSysPrompt` re-inject a "CONTROL RECENTLY SWITCHED" block that explicitly discounts the sessionLog momentum, auto-cleared in `sendAction` after 2 turns (same transient-marker pattern as `pendingLegacy`). The system-prompt re-injection is the load-bearing part — a single handoff line can't overpower many turns of old-POV conversation history. **Portrait-sync gotcha (root fix v1.45):** the swap re-homes portraits PC↔companion. v1.41 added `markPortraitDirty()` in the swap so the *separate* `/portrait` endpoint re-uploads — necessary but NOT sufficient, because that endpoint is a fire-and-forget request distinct from the main state blob, so the PC's portrait could still lag/desync from the state (new PC loaded the old PC's image on a second device). **v1.45 root fix:** `syncToServer` no longer nulls `character.portrait` — the current PC's portrait now rides **inline in the main state blob**, atomic with the state turn, so it can never be the former PC's. Only NPC avatar `n.portrait` is still stripped to the separate store (campaigns can have many NPCs; companion `charSheet.portrait` already rode in the blob unstripped — that asymmetry was the bug). `markPortraitDirty()` is retained for NPC portraits + the now-redundant PC upload; the load-side `data.portrait` fallback is kept for migrating older blobs that still have a null PC portrait.

---

## Known issues

- **Relationships not populating on NPC sheets** — noticed, not investigated
- **Local folder rename pending** — `dnd_rpg` → `traffic-and-dragons` (do in Explorer before opening Claude Code; then update hardcoded paths in `.claude/settings.local.json` and `.claude/hooks/stop-check.js`)
- **"↩ Import existing campaign" on tone step** — redundant with File menu; consider removing

---

## Feature backlog & decisions

See [TODO.md](TODO.md) for the full task list, known issues, and architecture decision log.

---

## Dev workflow

**Running locally:**
1. Open `index.html` directly in any modern browser (Chrome, Firefox, Edge).
2. Enter your Anthropic API key (`sk-ant-...`) on the opening screen.
3. The key is stored in `localStorage` under `tnd_ak_v1` and auto-loaded on subsequent visits.
4. No build step, no `npm install`.

**Testing changes:**
- Hard-refresh (`Ctrl+Shift+R`) after editing any `.js` file — Chrome caches aggressively.
- **Service worker (`sw.js`)**: **cache-first with network fallback as of v1.79.** History: cache-first → network-first (v1.28, to fix "wrong version deployed" staleness) → **back to cache-first (v1.79)** because network-first re-downloaded the whole app shell on every load and blew past Netlify's 100 GB/mo bandwidth cap, pausing the site. Cache-first is safe NOW because the `CACHE` constant is bumped on every deploy (hard rule) and browsers fetch the SW script fresh per navigation by default — so a bump is always detected: `install` precaches the new shell, `activate` deletes the old cache, `skipWaiting`/`clients.claim` flip it on the next load. Net: ≈zero asset bandwidth between deploys, one shell download per device per deploy, ~1-navigation lag before a new version shows. If a browser seems stuck, File → Clear cache & reload is the manual escape hatch. When testing locally on `localhost`, the SW also intercepts — unregister via DevTools → Application → Service Workers (or hard-refresh) if files look stale.
- Always test on **Cloudflare Pages** after `git push` — `file://` and the deployed site can have different cached files. (Hosting migrated Netlify → Cloudflare Pages at v1.79: pure static, no build command, output dir = repo root; `_headers` controls cache. Unlimited bandwidth, vs Netlify's 100 GB/mo cap that paused the site.)
- Use the **Sync** button in-game to manually patch world state.
- Use **Table Talk** tab to query the GM out-of-character while debugging.
- Wipe state: DevTools → Application → Local Storage → delete all `tnd_*` keys, or use **New Game**.
- **Export save** before testing risky changes.
- **Automated playtest harness** (`dev/playtest-harness.js`, not loaded by `index.html`) — drives N real GM turns against a throwaway character via `preview_eval`, for (1) smoke-testing invariants (combat panel clears, summarization fires on schedule, no console errors) and (2) collecting a narration corpus to judge prose-voice/content-DNA drift over a long run against a chosen author. Usage instructions are in the file header.

**Diagnosis & verification discipline** (learned the hard way — the v0.27→v0.28 textarea saga, three passes to find one CSS root cause):
- **Verify the FAILURE condition, not a benign case.** A check that can't fail proves nothing. For "3 lines, no partial" the test input is a field that *overflows*; for a parser, the malformed input; for a cap, the over-limit case. Pick the input that would break it — long/empty/boundary/the exact thing reported — and exercise that.
- **For visual/layout work, the screenshot is ground truth; measurements (`getComputedStyle`, `clientHeight`) are a proxy.** When the number and the render disagree, believe the render and go find *why the number lied* (v0.28: the box the spec measures ≠ the box the scroll paints). Don't let a passing metric override the eye.
- **"Measures fixed but reported still broken" → reproduce before you explain.** Treat that gap as the clue, not noise. Never let "cache/environment" be the first explanation for a divergence you haven't reproduced under the user's exact conditions (it was a real recurring gremlin here, which is exactly what made the wrong answer feel right). A user's "confirm it visually" is usually correct — honor it.
- This is the same lesson as **test-first on engine changes**: writing the failing assertion first forces you to define and exercise the break before shipping. Caveat: headless `dev/run-tests.js` can't see CSS layout, so for **visual** bugs the "test-first" equivalent is a scripted `preview_eval` that sets up the edge/overflow case AND screenshots it — not just reads a computed style.

**Version number:**
- Current: see `APP_VERSION` in `globals.js` — the hardcoded value here kept rotting (it said v1.114 at v1.143).
- Constant `APP_VERSION` in `globals.js` — consumed by `updateMemStatus()` (session bar) and injected into all three File ▾ menu version labels via `_menus` loop in `wireButtons()`.
- **Bump `APP_VERSION` on every commit that changes game code** — no exceptions. Also bump `CACHE` in `sw.js` on the same commit. This is how you confirm the right version is deployed.
- **ONE carve-out: the Blueprint Designer versions separately** (user call 2026-07-05). `BP_DESIGNER_VERSION` in blueprint-designer.html (started v0.4) — bump IT on designer-only commits, and do NOT bump `APP_VERSION`/`CACHE` for them (the designer isn't in the SW app shell). A commit touching BOTH designer and engine files bumps both. The designer header shows `v0.x · engine v1.y` because blueprint schema compatibility tracks the engine.
