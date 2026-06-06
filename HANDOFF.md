# Traffic and Dragons — Session Handoff

## Folder situation
Local game folder is still named `dnd_rpg` — rename to `traffic-and-dragons` in Explorer before next Claude Code session.

---

## What was done this session

### Cloud sync — major overhaul
- **OAuth ticket polling** replaces postMessage — Chrome blocks postMessage from `https://` to `file://` origin. New flow: server creates a short-lived auth ticket after OAuth, client polls `/auth/ticket/:ticket` to claim it. Works from both `file://` and Netlify.
- **Belt-and-suspenders CORS** — added manual `Access-Control-Allow-Origin: *` header on every server response in addition to Hono's CORS middleware.
- **Campaign picker syncs from server on every open** when connected — was only syncing at connect time, so campaigns were missing if session token was auto-restored.
- **Per-campaign cloud icons** — ☁↑ pushes local → server, ☁↓ pulls server → local. Icons only visible when connected. ☁↑ pulses while uploading. ☁↓ greyed out if campaign doesn't exist on server. `onServer` flag stored in `ashen_camps_v1`.
- **`campLoad` fetches from server** if local data missing for that campaign ID — enables cross-device loading.
- **Server stores `campName`** not just char name — `POST /api/state` and `GET /api/campaigns` both use `worldState.campName`.

### File menu
- Added File ▾ button to `#char-screen` and `#api-screen` with full menu (greyed items where no active game)
- **⟳ Clear cache & reload** added to top-level File menu on all three screens (not just Admin). Unregisters service worker then reloads — localStorage untouched.

### Campaign name (#7)
- "Campaign name" field added to Review step (step 7), pre-fills with character name
- Passed through `char._campName` → `startGame()` → `worldState.campName`

### Campaign folder prompt (#7a)
- After `beginAdventure()`, shows a non-blocking banner: "📁 Set a campaign folder…" with Set/Not now buttons
- Only shown if `showDirectoryPicker` is supported and folder not already set
- "Not now" stored in `ashen_folder_declined_v1` so it doesn't repeat

### Racial benefits wiring (#21)
- `pendingRacialBonus` global tracks racial spell count per tier
- `buildPendingSpellPool` counts `c.spells` where `racial:true` and populates the bonus
- Spell picker header shows "pick 2+1 racial bonus" and enforces the higher limit
- `toggleSpellPick` and `confirmCreationSpells` both use the adjusted limit

### Map node dimensions
- `[LOCATION_SIZE:scale|travelMins]` tag — scale=tiny/small/medium/large/vast, travelMins=int
- Stored on `memory.map.nodes[key].size` and `.travelMins`
- Shown in `buildGeoBlock()` as "Location size: large (~45min to cross)"
- Emit once alongside `[LOCATION_DESC:]` on first visit

### Names list overhaul (#23)
- Doubled all name lists to ~240 total, all in unsorted order
- Added 50 surnames — `NAMES.surnames[]`
- `getNameSuggestions` now pairs first+last names using a rotating index (`memory.nameIdx`)
- No more `usedNames` tracking — pure rotating queue, wraps automatically
- Removed USED NAMES from system prompt

### Char creation AI assist (#27)
- `✦` sparkle buttons on: character name, physical appearance, distinguishing mark, backstory, trait (custom), flaw (custom), motivation (custom)
- `aiSuggestField(id, label, btn)` — calls Claude with current wizard context, fills field, pulses button while loading
- `✦ Randomise` button on Review step — single Claude call generates name + appear + mark + backstory + trait + flaw + motivation as JSON, fills all fields
- `injectSparkleButtons()` called from `wireButtons()`

### Narrative knowledge graph — factions (#16 extension)
- Three new tags: `[FACTION:name|desc]`, `[NPC_FACTION:name|faction|role]`, `[FACTION_REL:faction1|faction2|rel]`
- Storage: `memory.npcGraph.factions{}`, `.factionEdges[]`, `.npcFactions{}`
- `buildNpcGraph()` now includes FACTIONS section
- World state sidebar shows Factions section
- NPC sheet shows faction membership and NPC↔NPC graph links

### Relationships bug (#open bug) — FIXED
- NPC sheet was only showing relationships from `charSheet.relationships` (requires generated sheet)
- Now pulls from `worldState.character.relationships` (set by `[RELATIONSHIP:]` tags) with fallback to `wsNpc.rel`
- Shows on all NPC sheets regardless of whether charSheet has been generated

### Import character as companion
- `showCharImportPreview` now shows two buttons: "Play as [name]" and "+ Add as companion to current campaign"
- Companion button only shown when a campaign is active
- `_addImportedCompanion(char)` adds to `worldState.npcs` as party member with full `charSheet`, links in knowledge graph, then calls `sendAction` to introduce them into the current scene

### Switch active player character
- `▶` button (no text, no border) on NPC sheet hero card for party members
- Opens a custom styled confirmation modal (not native `confirm()`)
- `_switchPlayerCharacter(name)` swaps player char with the NPC

### iOS notch (#25)
- `#api-screen` and `#char-screen` get safe-area-inset-top padding
- Also patched inside `@media (max-width: 768px)` where the earlier rule was being overridden
- `@media (display-mode: standalone)` rule with fixed 56px fallback for PWA mode
- **Status:** Deployed to Netlify — needs phone verification

### Font size (#22)
- "Large text" checkbox in Admin submenu on all three menus
- `loadFontSize()` / `toggleFontSize()` — stored in `ashen_font_v1`
- Defaults to large on iOS (`/iPhone|iPad|iPod/i.test(navigator.userAgent)`)
- CSS class `body.font-large` bumps narrative text, action buttons, input

### Version number
- `v1.0` appended to membar text in `updateMemStatus()`

### Legacy characters (#13) — design only, not implemented
- Past player characters from other campaigns randomly appear as NPCs
- 5% chance per session load
- Source: scan `ashen_camp_[id]_ws` for other campaigns in localStorage
- Once a legacy character appears in a campaign, flagged so they can't appear again in that campaign
- Inject into system prompt so GM introduces them organically

### Code review fixes applied this session
F-08 (already done), F-10 (session log error path), F-13 (party panel DOM construction), F-16 (token threshold 1200), F-17 (migration guards persist), F-18 (server token → sessionStorage), F-20 (ordering comment), F-21 (SW path relative), F-22 (NPC sheet coercion), F-23 (buildGeoBlock subloc limit), F-24 (closeAllMenus helper), F-26 (campStartRename programmatic)

---

## Known issues / follow-ups

- **Campaign UI issues** — campaign picker sync timing unreliable when server-connected; added 3s timeout fallback but needs proper investigation. Server campaigns not always appearing.
- **iOS notch** — deployed but not confirmed on phone. Check after clearing Safari cache.
- **Portrait drag** — implemented but needs browser verification.
- **OAuth on file://** — ticket polling approach is new. Monitor for edge cases (popup closed before ticket claimed, etc.)
- **Local folder rename pending** — `dnd_rpg` → `traffic-and-dragons`
- **F-11** — `window._sbPicks` namespace pollution, deferred, low risk

---

## Architecture reminders

- **ES5 throughout** — `var`, no arrow functions, no template literals. `async/await` only in API-facing functions.
- **Script load order:** `globals.js → data.js → helpers.js → state.js → storage-adapter.js → memory.js → api.js → char-creation.js → game.js → ui.js`
- **Model string:** `claude-sonnet-4-6` — verify before API work
- **Storage keys:** all `ashen_*_v10` — do not change without migration
- **Server deploy:** `cd traffic-and-dragons-server && flyctl deploy --ha=false`
- **Netlify:** auto-deploys from `pmegow/traffic-and-dragons` GitHub repo on push to master
- **Version:** `v1.0` — bump minor in `updateMemStatus()` each session

---

## Todo priority order (see TODO.md for full descriptions)

1. Campaign UI issues — server sync reliability
2. iOS notch — verify on phone
3. Portrait drag — verify in browser
4. Companions system at campaign start (#9)
5. Multi-player HUD layout (#26)
6. Multiplayer (#2)
7. Multiple campaigns review (#12)
8. Legacy characters implementation (#13)
9. File menu cleanup for release (#11 — mostly done)
10. Text to speech (#14)
11. Game document (#17)
12. Narrative flavor / prose style (#10) — pushed to bottom
13. Tweak img2img weighting (#20)
14. Campaign designer (#18) — large scope, last
