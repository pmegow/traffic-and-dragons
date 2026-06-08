# Traffic and Dragons — Session Handoff

---

## Current version: v1.14

---

## What was done this session

### Cloud sync — fully working
- Fixed GitHub OAuth (deleted app credentials, swapped client ID/secret)
- Fixed `ashen_camp_` stale key (rebrand leftover) greying out push button
- Fixed `campCloudPush` and `campCloudPushSilent` both existing with fix only in wrong one
- Fixed manual push reading stale snapshot instead of live WSK
- Added portrait sync (player + NPC/companion) via separate PUT endpoint
- Added narrative HTML + suggested actions to sync payload
- Added `_pendingSync` flag — sync always fires after GM narrative renders

### TTS — Cartesia streaming, working
- Provider: Cartesia, model `sonic-2`, SSE endpoint, `pcm_s16le` 22050Hz
- Near-instant audio via SSE streaming (PCM chunks → Web Audio API)
- Persistent AudioContext created on toggle gesture — autoplay works without prompting
- 🔊/🔇 toggle in topbar; pause/skip bar above input area; per-message replay button
- Settings: Admin → Voice Settings (Cartesia API key + GM voice ID)
- `tts.js` is a new 10th JS file, loaded last

---

## Priority order for next session

1. Per-character TTS voices (#12) — voice IDs on character/NPC objects
2. Companions at campaign start (#2)
3. Legacy characters (#5)
4. Swappable LLM support (#16 — Gemini, OpenAI)
5. Multiplayer (#1)

---

## Architecture reminders

- **ES5 throughout** — `var`, no arrow functions, no template literals. `async/await` only in API-facing functions.
- **Script load order:** `globals.js → data.js → helpers.js → state.js → storage-adapter.js → memory.js → api.js → char-creation.js → game.js → ui.js → tts.js`
- **Storage keys:** all `tnd_*` — do NOT revert to `ashen_*`
- **Model string:** `claude-sonnet-4-6` — verify before API work
- **Server deploy:** `cd traffic-and-dragons-server && flyctl deploy --ha=false`
- **Netlify:** auto-deploys from `pmegow/traffic-and-dragons` GitHub repo on push to master
- **Version:** bump minor in `updateMemStatus()` in `ui.js` on every code-changing commit. Format: `v1.X`
- **Three file menus** must stay in sync: `fm-`, `cs-fm-`, `api-fm-` prefixed IDs

---

## Known issues

- Portrait drag — implemented, needs browser verification
- iOS notch — deployed, needs phone verification
- `index.html` redirect stale — points to old filename
- Local folder rename pending — `dnd_rpg` → `traffic-and-dragons`
