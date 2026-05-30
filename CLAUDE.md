# Ashen Crown — CLAUDE.md

## Project overview

**Ashen Crown** is a browser-based sword & sorcery RPG. The player creates a character through a multi-step wizard, then plays a text adventure narrated by Claude (via the Anthropic API) acting as the Game Master. The GM responds in vivid second-person prose, tracks the world state through hidden tags embedded in its responses, and maintains a rolling memory of NPCs, locations, lore, and decisions across sessions.

There is no server, no build step, and no dependencies.

---

## Current architecture — PARTIALLY SPLIT

The monolith split is **in progress**. Four files have been extracted from the original `dnd_game_20_4.html`. The rest of the logic remains in the HTML's main `<script>` block.

### Files on disk

| File | Status | Contents |
|---|---|---|
| `dnd_game_20_4.html` | **Active host** | CSS, HTML scaffolding, 4 `<script src>` tags, then remaining JS (api, char-creation, game, ui, globals — not yet extracted) |
| `data.js` | ✅ Extracted | All 18 game data constants |
| `helpers.js` | ✅ Extracted | 12 utility functions |
| `state.js` | ✅ Extracted | `store`, `worldState`, `sessionLog`, `memory`, save/load functions, storage key constants |
| `memory.js` | ✅ Extracted | `sessionTokens`, `fileNpcEvent`, `fileLocation`, `fileLore`, `fileDecision`, `fileFutureEvent`, `resolveFutureEvent`, `memoryTOC`, `memoryNpcDetail`, `summarize` |
| `api.js` | ⏳ Pending | `callGM`, `buildSysPrompt`, `getRulesBlock`, `applyMuts`, `cleanTxt`, `diceTxt`, `parseActions` |
| `char-creation.js` | ⏳ Pending | All wizard step logic, `cs`, `confirmChar`, archetype/spell/stat-bump pickers |
| `game.js` | ⏳ Pending | `sendAction`, `sendSuggestedAction`, `beginAdventure`, `retryLast`, `checkLevelUp`, `showArchetypeModal`, `pickArchetype`, `showStatBumpModal`, `restSpells`, `doRender`, `newGame` |
| `ui.js` | ⏳ Pending | `syncUI`, `updateHUD`, `updateInvPanel`, `updateAbPanel`, `updateSpPanel`, `updateCombat`, `updateMemStatus`, `showGame`, `showChar`, `addMsg`, `switchTab`, `showToast`, `showSyncModal`, `showRulesModal`, `exportNarrative`, `exportSave`, `importSave`, `wireButtons` |
| `globals.js` | ⏳ Pending | `apiKey`, `busy`, `lastAction`, `panelCol`, `secCol`, `activeChatTab`, `pendingChar`, `pendingSpellPool`, `pendingBumps`, `currentBump`, `rvGold`, `customRules` |

### Script load order (current `<script>` tags in HTML)

```
data.js → helpers.js → state.js → memory.js → [main script block]
```

Final load order when split is complete:

```
globals.js → data.js → helpers.js → state.js → memory.js → api.js → char-creation.js → game.js → ui.js
```

Each file depends only on symbols defined by files earlier in this list.

---

## HTML screens

| Element | Purpose |
|---|---|
| `#api-screen` | API key entry (shown on first load) |
| `#char-screen` | 7-step character creation wizard |
| `#game-screen` | Main game interface |
| `#lineage-popup` | Sub-popup for Half-Blood lineage selection |
| Dynamic modals | `#creation-arch`, `#creation-bump`, `#creation-spells`, `#arch-modal`, `#sb-modal`, `#rules-modal`, `#sync-modal` — all appended to `<body>` at runtime |

## Game screen layout

```
#topbar              — HUD: name, HP, gold, alignment, location + action buttons
#sidebar             — Slide-out world state panel (fixed, off-screen by default)
#membar              — Memory status bar (~tokens / chapters / NPCs / turn number)
#cpanel              — Combat tracker (HP bars, rounds) — hidden when not in combat
#story-area
  #story-narrative   — Scrolling narrative message log (Story tab)
  #story-tabletalk   — Scrolling table talk log (Table Talk tab, display:none by default)
  .rpanel            — Collapsible right panel: Inventory / Abilities / Spells sections
#inputarea
  #inrow             — Text input + Send button
  #chat-tabs         — Two pill tabs: Story | Table Talk (replaces old checkbox)
```

---

## Key systems

### 1. Character creation wizard (7 steps)

| Step | Content |
|---|---|
| 1 – Tone | Choose world tone: High Fantasy, Gritty, Sword and Sorcery, Dark Horror, Political Intrigue, or Custom |
| 2 – Identity | Name, pronouns, age, physical description, distinguishing mark |
| 3 – Ancestry | 7 ancestries (Human, Elf, Dwarf, Gnome, Half-Blood, Hollow-Born, Tiefling), each with 2–3 subraces; Half-Blood has nested lineage selection |
| 4 – Class | 8 classes (Warrior, Rogue, Sorcerer, Ranger, Berserker, Paladin, Cleric, Druid) |
| 5 – Stats | Roll 4d6 drop-lowest (auto-assigned by `STAT_PRIORITY`) or Point Buy (27 pts, using `PBC` cost table) |
| 6 – Personality | Trait, flaw, motivation (dropdowns with custom override); alignment; auto-suggested deity for Cleric/Paladin/Druid |
| 7 – Review | Full character preview + starting location + starting level (1–10) |

After step 7, if level ≥ 3: archetype picker → stat bump(s) → spell picker → `startGame()`.

### 2. Game data constants (all in `data.js`)

- `TONES` — 6 tone presets, each with a `vc` (voice directive sent in the system prompt)
- `ANCS` — Ancestry definitions with `stats`, `traits`, `subraces`, optional nested `lineages`, and optional `racial_spells:[{nm,lvl}]` on subraces/lineages
- `CLSS` — Class definitions: `hd` (hit die), `prime` stat, starting `gear`
- `ABILS` — Starting class abilities (name + description)
- `ARCHETYPES` — 3 archetypes per class (24 total)
- `CLASS_FEATURES` — Level 2/5/7/9 feature unlocks per class
- `SPELLS` — Spell lists for Sorcerer, Cleric, Druid, Ranger, Paladin (cantrips + levels 1–3)
- `ARCH_SPELLS` — Extra spell lists for Eldritch Knight and Arcane Trickster archetypes
- `XP_LEVELS` — XP thresholds for levels 1–10: `[0, 300, 900, 2700, 6500, 14000, 23000, 34000, 48000, 64000]`
- `STAT_BUMP_LEVELS` — `[4, 8]` (levels where +2 stat improvement is awarded)
- `STAT_PRIORITY` — Per-class stat assignment order for rolled stats
- `DEITY_MAP` + `DEITY_CENTRIC` — Alignment-based deity suggestions for Cleric/Paladin/Druid
- `DEFAULT_RULES` — 9 hard GM rules always injected into the system prompt
- `SPELL_PICK_LIMITS` — Max spells selectable per tier during creation: `{cantrips:2, "1":2, "2":2, "3":1}`

**Racial spells:** Subrace and lineage entries in `ANCS` may have a `racial_spells:[{nm, lvl}]` array. `confirmChar` reads this and pushes entries into `char.spells` as `{nm, lvl, used:false, racial:true}`. Currently wired for: Elf Drow (Dancing Lights cantrip, Faerie Fire 1/day, Darkness 1/day) and Half-Blood Drow lineage (Faerie Fire 1/day).

### 3. State management (in `state.js`)

Three live objects, all persisted to `localStorage` via the `store` wrapper:

| Object | Storage key | Contents |
|---|---|---|
| `worldState` | `ashen_core_v9` | `character`, `world` (location/region/time/weather/threat), `npcs[]`, `questLog[]`, `eventHistory[]`, `combat`, `turn` |
| `sessionLog` | `ashen_sess_v9` | Current-session messages sent to the API (`[{role, content}]`); cleared on summarization |
| `memory` | `ashen_mem_v9` | Long-term narrative memory: `npcs{}`, `locations{}`, `quests{}`, `lore[]`, `keyDecisions[]`, `futureEvents[]`, `chapters[]` |

`store` wraps `localStorage` with an in-memory fallback `_m`. Storage key constants (`WSK`, `SLK`, `MEM_KEY`, `AKK`, `RLK`) are defined in `state.js`.

### 4. API usage

**Endpoint:** `https://api.anthropic.com/v1/messages`
**Model:** `claude-sonnet-4-6` — **verify this string is current before starting work each session**; model identifiers are periodically updated and an outdated string causes API errors.
**Auth header:** `x-api-key` + `anthropic-dangerous-direct-browser-access: true` (required for direct browser calls)

`callGM(msg, sysOverride, maxTok)` is the single API entry point.
- `maxTok` is optional; defaults to `1000`. `summarize()` passes `2000`.
- Appends `msg` to `sessionLog` for the request body but does not push to `sessionLog` itself.

Three callers:
- `sendAction()` — normal gameplay turns (1000 tokens)
- `beginAdventure()` — opening narrative on game start (1000 tokens)
- `summarize()` — memory extraction, JSON-only output (2000 tokens)

### 5. System prompt construction (`buildSysPrompt`)

Assembled fresh on every request from live state:

1. Player identity header (repeated at top and bottom)
2. `getRulesBlock()` — default + custom narrative rules
3. GM role declaration + tone directive
4. Character sheet (stats, HP, gold, alignment, abilities, spells, inventory)
5. World state (location, time, weather, NPCs, active quests)
6. `memoryTOC()` — compact summary of known NPCs, visited locations, pending events, recent decisions, chapter summaries
7. `memoryNpcDetail()` — full detail on NPCs mentioned in the last 6 session messages
8. Combat state block (if `worldState.combat` is set)
9. Event history (last 8 compressed chapter summaries)
10. State tag instructions + dice format instructions
11. Style directive: "3-5 sentences vivid second-person. End EVERY response with `*You could [action]; [action]; or [action].*` — **semicolons** separate options, never commas."

### 6. State tag system (`applyMuts`)

The GM embeds hidden tags in every response. `applyMuts(text)` parses them and mutates `worldState` and `memory`. Tags are stripped from displayed text by `cleanTxt()`.

| Tag | Effect |
|---|---|
| `[HP:+/-X]` | Adjust `character.hp`, clamped to `[0, maxHp]` |
| `[GOLD:+/-X]` | Adjust `character.gold` |
| `[ITEM_GAINED:name]` / `[ITEM_LOST:name]` | Push/filter `character.inventory` |
| `[LOCATION:name]` | Update `world.location`, file to `memory.locations` |
| `[NPC:name|status|relation]` | Upsert `worldState.npcs[]` and `memory.npcs{}` |
| `[XP:N]` | Add XP, trigger `checkLevelUp()` |
| `[QUEST:title|status]` | Upsert `worldState.questLog[]` |
| `[COMBAT_START:name|hp|ac|atkbonus|dmgdie|morale]` | Set `worldState.combat` |
| `[ENEMY_HP:-X]` / `[COMBAT_ROUND:N]` / `[COMBAT_END:outcome]` | Update or clear combat state |
| `[ABILITY_GAINED:Name|Desc]` | Append to `character.abilities` (deduplicated) |
| `[ALIGNMENT:law+1]` / `[ALIGNMENT:good-1]` | Shift `alignLaw`/`alignGood` (-3 to +3), recompute `actualAlignment` |
| `[SPELL_USED:name]` | Mark matching spell as `used: true` |
| `[LORE:fact]` | Append to `memory.lore` (capped at 30) |
| `[DECISION:desc]` | Append to `memory.keyDecisions` (capped at 30) |
| `[FUTURE_EVENT:what|when]` | Append to `memory.futureEvents` |
| `[FUTURE_EVENT_RESOLVED:what]` | Mark matching future event resolved |
| `[NPC_NOTE:name|note]` | Append event note to `memory.npcs[name].events` |
| `[NPC_PRONOUN:name|pronouns]` | Set pronouns on NPC in both stores |
| `[DICE:label|result|outcome]` | Rendered visually as a dice block (not a mutation) |

### 7. Memory / summarization system (in `memory.js`)

`sessionTokens()` estimates the token count of `sessionLog` (sum of `content.length` / 4). When it hits 1000, `summarize()` fires before the next player action.

`summarize()`:
1. Sends the full session log to the API with a JSON-extraction system prompt (2000 token limit)
2. Parses response as `{chapterSummary, npcUpdates[], loreDiscovered[], decisionsMade[], futureEvents[]}`
3. Pushes chapter summary into `memory.chapters` and `worldState.eventHistory`
4. Updates NPC attitudes and knowledge in `memory.npcs`
5. Files lore, decisions, and future events
6. Clears `sessionLog` and saves memory

Memory status shown in `#membar` as `~NNNtk`: green dot (< 800 tokens), amber (800–999), red (≥ 1000).

### 8. Combat system

Combat state lives in `worldState.combat`: `{name, hp, maxHp, ac, atk, dmg, morale, round}`. All mechanics handled by GM through state tags. `#cpanel` shown/hidden by `syncUI()`.

### 9. Level-up system

`checkLevelUp()` called inside `applyMuts()` whenever XP changes:
- HP gain per level: `ceil(hd/2) + 1 + CON_mod` (minimum 1)
- Class feature at new level added from `CLASS_FEATURES`
- Level 3: `showArchetypeModal()`
- Levels 4, 8: `showStatBumpModal()` (+2 to one stat or +1 to two, max 20)

### 10. Alignment drift

`character.alignLaw` and `character.alignGood` are integers clamped to [-3, 3]. `alignLabel(law, good)` maps to 9-point grid. GM shifts via `[ALIGNMENT:]` tags.

### 11. Rendered action suggestions

Every GM response ends with `*You could [A]; [B]; or [C].*` (semicolons required — instructed in system prompt). `parseActions(clean)`:
- If semicolons present: splits on `;\s*(?:or\s+)?`
- Fallback (no semicolons): splits on `,\s*or\s+|\s+or\s+` only — does NOT split on bare commas
- Buttons rendered as `<button class="qa">` with `onclick="sendSuggestedAction(this)"`

### 12. Table Talk mode

Implemented as a **tab** (not a checkbox). `activeChatTab` global is `"narrative"` or `"tabletalk"`. `switchTab(tab)` toggles visibility of `#story-narrative` / `#story-tabletalk` and updates tab button styles. `addMsg` routes by message type. A blue badge dot appears on the inactive tab when a message arrives there. `isTT` in `sendAction` is derived from `activeChatTab === "tabletalk"`.

### 13. File operations (File menu)

- **Export save (.json)**: Full `{worldState, sessionLog, memory}` snapshot
- **Import save (.json)**: Restore snapshot, re-initialize UI (clears both story divs)
- **Export narrative (.txt)**: Plain-text transcript from `#story-narrative` only
- **Narrative rules**: Modal to view/edit custom rules (persisted under `ashen_rules_v9`)
- **New game**: Clears all storage keys and both story divs, returns to character creation

Auto-export narrative fires every 10 turns as a background download.

### 14. Sync modal

Direct editing of HP, max HP, gold, XP, level, location, time, weather, inventory without going through the GM.

### 15. Render feature

`doRender()` sends a specialized system prompt asking for a photorealistic image-generation prompt for the current scene. Output displayed as `.msg.render-out` with a copy button.

### 16. Reload behavior

On `init()`, if a saved game is found and `sessionLog` has at least 2 entries, the last player action and last GM response are re-rendered in `#story-narrative`. Suggested action buttons from the last response are live and clickable.

---

## Conventions

- **ES5 JavaScript throughout** — `var`, no arrow functions, no template literals, no `const`/`let`. `async/await` only in the three API-facing functions. *(ES6+ migration planned for when split is complete.)*
- **Single-character variables** common in dense utility functions.
- **HTML built by string concatenation** — no templating engine.
- **State versioning via key suffix** — all storage keys end in `_v9`.
- **No external dependencies** — CSS and JS entirely self-contained.
- **CSS variables** for theming — palette in `:root`, amber accent `--acc` (#c8922a) is the visual identity color.
- **Modals always created fresh** — remove prior instance by ID before creating new one.
- **`busy` flag** — global boolean gates all API calls. Always set `busy=false` in both success and error paths.
- **Scrollbars** — custom styled via `::-webkit-scrollbar` rules: 6px wide, near-black track, dark grey thumb, amber on hover.

---

## Remaining split work

Files still to extract from `dnd_game_20_4.html` (in order):

1. **`api.js`** — `callGM`, `buildSysPrompt`, `getRulesBlock`, `applyMuts`, `cleanTxt`, `diceTxt`, `parseActions`
2. **`char-creation.js`** — all wizard step logic and creation-flow functions
3. **`game.js`** — `sendAction`, `sendSuggestedAction`, `beginAdventure`, `retryLast`, `checkLevelUp`, archetype/stat-bump modals, `restSpells`, `doRender`, `newGame`
4. **`ui.js`** — all UI update functions, `addMsg`, `switchTab`, modals, export/import, `wireButtons`
5. **`globals.js`** — `apiKey`, `busy`, `lastAction`, `panelCol`, `secCol`, `activeChatTab`, `pendingChar`, `pendingSpellPool`, `pendingBumps`, `currentBump`, `rvGold`, `customRules`

**ES5 → ES6+ migration** happens during the split: `const`/`let`, arrow functions, template literals, native ES modules (`<script type="module">`).

---

## Dev workflow

**Running locally:**
1. Open `dnd_game_20_4.html` directly in any modern browser (Chrome, Firefox, Edge).
2. Enter your Anthropic API key (`sk-ant-...`) on the opening screen.
3. The key is stored in `localStorage` under `ashen_ak_v1` and auto-loaded on subsequent visits.
4. No server, no build step, no `npm install`.

**Testing changes:**
- Hard-refresh (`Ctrl+Shift+R`) after editing any `.js` file — Chrome caches aggressively.
- Use the **Sync** button in-game to manually patch world state.
- Use **Table Talk** tab to query the GM out-of-character while debugging.
- Wipe state: DevTools → Application → Local Storage → delete all `ashen_*` keys, or use **New Game**.
- **Export save** before testing risky changes.
