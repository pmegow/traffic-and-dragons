# Traffic and Dragons — Session Handoff

---

## Current version: v1.17

---

## What was done this session

### Duplicate campaign bug — fixed
- Root cause: `worldState` had no `campId`, so every import/migration created a fresh campaign slot
- Fix: `campId` now set at `startGame`, `migrateToCampaigns`, and `loadState` migration
- `importSave` reuses the file's `campId`; `campCloudPull` injects the correct ID before storing

### Companions at campaign start — complete
- Step 7 (Review) now has a "Companions (optional, max 3)" section
- `showCompanionBrowser()` — browses saved campaigns, disables already-added/player-char/full slots
- `startGame` injects companions into `worldState.npcs` as full party members with `charSheet`
- `beginAdventure` mentions companions in the opening narrative prompt
- `pendingCompanions` global cleared in `startGame` and `newGame`

### Portrait stale-snapshot bug — fixed
- `getCharFromCampaign` now reads from live `WSK` when the requested ID is the active campaign
- `saveAll` now calls `snapshotActiveCamp` so campaign snapshots stay current

### Character library — new feature
- Server: `characters` table `(user_id, slug)` composite PK, `GET/POST/DELETE /api/characters`
- Client: `listCharLibrary`, `saveCharToLibrary`, `deleteCharFromLibrary` on `storageAdapter`
- "Export Character" button on player char sheet and companion sheets → `_showCharExportOptions`
- Options: ☁ Save to library (with overwrite confirmation if character exists at different level) or ⬇ Download .char file
- `showCharLibrary()` browser: list, import (→ `showCharImportPreview`), delete
- "☁ Library" button in Import Character browser modal
- CORS updated to include DELETE on server

### UI polish
- Save/Load Game renamed to Save/Load Game (local)
- iOS notch: `max(8px, calc(env(safe-area-inset-top, 0px) + 13px))` on topbar
- Export Character button added to player char sheet (top-left, same row as ×)
- Export Character button added to companion/party member NPC sheets

---

## Priority order for next session

1. Per-character TTS voices (#9) — voice IDs on character/NPC objects, stored on charSheet
2. Legacy characters (#5) — design done, not implemented; scan other campaign slots for past PCs
3. Swappable LLM — ChatGPT adapter first (#14)
4. Test companions end-to-end — step 7 browser, party intro, charSheet in HUD, companion export
5. Multiplayer (#1)

---

## Architecture reminders

- **ES5 throughout** — `var`, no arrow functions, no template literals. `async/await` only in API-facing functions.
- **Script load order:** `globals.js → data.js → helpers.js → state.js → storage-adapter.js → memory.js → api.js → char-creation.js → game.js → ui.js → tts.js`
- **Storage keys:** all `tnd_*`
- **Model string:** `claude-sonnet-4-6` — verify before API work
- **Server deploy:** `cd traffic-and-dragons-server && flyctl deploy --ha=false`
- **Netlify:** auto-deploys from `pmegow/traffic-and-dragons` GitHub repo on push to master
- **Version:** bump minor in `updateMemStatus()` in `ui.js` on every code-changing commit. Format: `v1.X`
- **Three file menus** must stay in sync: `fm-`, `cs-fm-`, `api-fm-` prefixed IDs

---

## Known issues

- Companion system needs live testing — not yet tested end-to-end
- Character library needs live testing — server deployed, client deployed, not yet tested
- Portrait drag — implemented, needs browser verification
- iOS notch — deployed, needs phone verification
- `index.html` redirect stale — points to old filename
- Local folder rename pending — `dnd_rpg` → `traffic-and-dragons`
