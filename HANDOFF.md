# Traffic and Dragons — Session Handoff

## Folder situation
Local game folder is still named `dnd_rpg` — rename to `traffic-and-dragons` in Explorer before next Claude Code session.

---

## ⚠️ Server migration in progress — COMPLETE THIS FIRST

The Fly.dev server is being migrated from `ashen-crown-server` to `traffic-and-dragons-server`. The new app and volume have been created, GitHub OAuth settings have been updated, but the secrets still need to be set and the new app deployed.

**Steps remaining:**

1. Set secrets on the new app (user has the values):
```
cd traffic-and-dragons-server
flyctl secrets set GITHUB_CLIENT_ID=0v23liPtPcBGLZntn24g GITHUB_CLIENT_SECRET=<secret> SESSION_SECRET=<any-random-string> --app traffic-and-dragons-server
```

2. Deploy to new app:
```
flyctl deploy --ha=false
```

3. Update `TND_SERVER_URL` in `ui.js` (line ~368):
```javascript
var TND_SERVER_URL = "https://traffic-and-dragons-server.fly.dev";
```

4. Bump version to v1.4, commit and push client

5. Verify: open campaign picker → ☁ Connect → should OAuth successfully

6. Delete old client secret (`*****34de1371`) from GitHub OAuth app (now unused)

7. Optionally delete old Fly app: `flyctl apps destroy ashen-crown-server`

---

## What was done this session

### Branding — "ashen" → "tnd" everywhere
- All localStorage keys renamed: `ashen_*` → `tnd_*` (WSK, SLK, MEM_KEY, AKK, RLK, ADK, FAL_KEY_K, RENDER_MDL_K, CAMP_META_K, ACTIVE_CAMP_K, tnd_camp_* pattern)
- Auth message type: `ashen-auth` → `tnd-auth` (client + server index.js)
- Constant: `ASHEN_SERVER_URL` → `TND_SERVER_URL`
- Campaign name placeholder no longer references old game name
- `ashen.db` nuked; server now uses `traffic.db`
- GitHub OAuth app renamed to "Traffic and Dragons" with new URLs
- **NOTE:** Fly app URL (`ashen-crown-server.fly.dev`) is legacy — migration above completes this

### Accent colour rebrand
- `#c8922a` (vibrant amber) → `#b8935a` (aged parchment gold) everywhere
- Hardcoded `rgba(200,146,42,...)` tints updated to `rgba(184,147,90,...)`
- `todo-viewer.html` updated to match

### Cloud sync improvements
- Server token moved from `sessionStorage` → `localStorage` (persists across browser restarts)
- Token reads in `ui.js` were inconsistently split between sessionStorage/localStorage — all now use localStorage
- Sync timeout raised from 10s → 30s → 60s (Fly.dev cold starts take 15-30s)
- "☁ Waking server up, hang tight…" message appears after 8s of waiting
- ☁ Connect / Disconnect button added directly to Campaigns modal header
- On connect: all local campaigns pushed to server automatically (`campCloudPushSilent`)
- Cloud-only rows (server campaigns with no local data): blue tint, "Cloud only — click Load" label

### Server — duplicate campaign rows bug identified
- `syncToServer()` was creating a new DB row on every turn when campaign ID was null
- Server DB had 230 rows but only ~8 unique campaigns
- All data wiped (fresh start) when migrating to new app/DB

### Version
- v1.3 (next commit after migration complete should be v1.4)

---

## Known issues / follow-ups

- **Server migration** — see top section, must complete before anything else works
- **Tasks 24 & 26** — marked "Ready to test"; need device verification once server is working
- **Portrait drag** — implemented, needs browser verification
- **iOS notch** — deployed, needs phone verification
- **Duplicate campaign rows** — root cause identified (null campaign ID → server generates new ID per save). Need to verify this is fixed now that tnd_* keys are clean. `getActiveCampId()` reads `tnd_active_v1`; if properly set, the server should upsert the same row. Monitor after migration.

---

## Architecture reminders

- **ES5 throughout** — `var`, no arrow functions, no template literals. `async/await` only in API-facing functions.
- **Script load order:** `globals.js → data.js → helpers.js → state.js → storage-adapter.js → memory.js → api.js → char-creation.js → game.js → ui.js`
- **Model string:** `claude-sonnet-4-6` — verify before API work
- **Storage keys:** all `tnd_*` now — do not revert to `ashen_*`
- **Server deploy:** `cd traffic-and-dragons-server && flyctl deploy --ha=false`
- **Netlify:** auto-deploys from `pmegow/traffic-and-dragons` GitHub repo on push to master
- **Testing:** always test on Netlify after push — local `file://` and Netlify can have different cached code
- **Version:** `v1.3` (bump to v1.4 after server migration commit) — string at end of `updateMemStatus()` in `ui.js`

---

## Todo priority order

1. **Complete server migration** (see top of this file)
2. Verify campaign sync across devices end-to-end
3. Verify task #26 (API key re-entry)
4. Verify task #24 (party HUD with actual companion)
5. Companions at campaign start (#8)
6. Text to speech (#13)
7. Legacy characters (#12)
8. Multiplayer (#2)
