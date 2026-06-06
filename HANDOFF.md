# Traffic and Dragons — Session Handoff

## Folder situation
Local game folder is still named `dnd_rpg` — rename to `traffic-and-dragons` in Explorer before next Claude Code session.

---

## What was done this session

### Cloud sync — root-cause fixes
- **`onServer` flag stripped on every save** — `updateCampMeta` was doing `meta[i]=entry`, replacing the entire object. Fixed to `Object.assign({},meta[i],entry)` so `onServer` survives.
- **Campaign picker no longer blocks on sync** — modal shows instantly from local data; server sync runs in background and refreshes `#camp-list` in place when done.
- **10s timeout on `syncCampaignList`** — `done()` wrapper fires exactly once; timeout prevents infinite hang on cold Fly.dev starts.
- **Removed double-sync on connect** — `connectToServer` was calling `syncCampaignList` then `showCampaignPicker` (which also syncs). Now just calls `showCampaignPicker`.

### Campaign picker improvements
- **☁ Connect / Disconnect button** in modal header (amber when connected, grey when not)
- **Push-all on connect** — on successful auth, `snapshotActiveCamp()` runs, then all local campaigns are silently pushed to server via `campCloudPushSilent`. Picker opens after all pushes complete.
- **`campCloudPushSilent(id, cb)`** — new helper for background pushes without reopening picker
- **Cloud-only rows** — campaigns that exist on server but not locally show with blue tint, "☁ Cloud only — click Load to download" label, rename and push buttons disabled
- **Pulse animation** — "☁ Refreshing from server…" text pulses with `pulse-opacity` keyframe while sync is in flight; animation stops on completion. `@keyframes pulse-opacity` added to `dnd_game_1_0.html`.

### Task #26 — API key re-entry on auth failure
- `_attachGMErrorUI(em, retryFn, msg)` in `game.js` detects auth errors (`/invalid.{0,10}key|api.{0,6}key|authentication_error|401|permission_denied/i`)
- Auth errors: shows inline `<input type=password>` + "Update & Retry" button; returns `true` so caller does `return` early, keeping `busy=true` until user submits
- On submit: saves new key to `localStorage[AKK]`, sets `busy=false`, re-enables sendbtn, fires retry
- Both `sendAction` and `beginAdventure` catch blocks use this helper
- **Important:** was not working because Netlify served old code. All testing must be done on Netlify or after `git push`.

### Task #24 — Party HUD
- `<div id="hud-party">` added to `#topbar` with `flex-basis:100%` (second row)
- `updateHUD()` populates it: compact cards for each `partyMember` NPC — name + mini HP bar (green/amber/red) + hp/maxHp numbers
- Clickable — opens NPC sheet
- Hidden on mobile (`display:none !important` in `@media (max-width: 768px)`)

### Todo-viewer (`todo-viewer.html`)
- **Auto-load** — `FileSystemFileHandle` persisted in IndexedDB; on load: if permission already granted → silent auto-load; if needs re-grant → shows "↺ Reopen TODO.md" button
- **Export overwrites file** — uses `createWritable()` on stored handle, shows "Saved to TODO.md" toast; falls back to download if no handle
- **+ Add task** button — inline bar below table, Enter to add, Escape to cancel, clears input after add
- **Inline edit** — pencil button on row hover (right side of task cell); opens `<textarea>` sized to content; blur/Escape saves
- **Delete** — × button on row hover, far right
- **3-state done toggle**: ○ (undone) → ● amber (Ready to test) → ✓ green (Done) → ○ (undone)
- **Ready to test rows** get amber background tint
- **Status convention**: Claude marks completed features as "Ready to test" in TODO.md; user clicks checkbox to confirm testing → Done

### Version bump
- Bumped to `v1.1` in `updateMemStatus()` in `ui.js`
- **Convention going forward:** bump minor version on every commit that changes game code. String is at the end of `updateMemStatus()` in `ui.js`.

---

## Known issues / follow-ups

- **Campaign sync across devices** — connect-and-push-all is new, not yet tested end-to-end on phone. Monitor.
- **Tasks 24 & 26** — marked "Ready to test" in TODO. Need real device verification.
- **Portrait drag** — implemented, needs browser verification
- **iOS notch** — deployed, needs phone verification after cache clear

---

## Architecture reminders

- **ES5 throughout** — `var`, no arrow functions, no template literals. `async/await` only in API-facing functions.
- **Script load order:** `globals.js → data.js → helpers.js → state.js → storage-adapter.js → memory.js → api.js → char-creation.js → game.js → ui.js`
- **Model string:** `claude-sonnet-4-6` — verify before API work
- **Storage keys:** all `ashen_*_v10` — do not change without migration
- **Server deploy:** `cd traffic-and-dragons-server && flyctl deploy --ha=false`
- **Netlify:** auto-deploys from `pmegow/traffic-and-dragons` GitHub repo on push to master
- **Testing:** always test on Netlify after push — local `file://` and Netlify can have different cached code
- **Version:** `v1.1` — bump minor in `updateMemStatus()` (end of function, `ui.js`) on every code-changing commit

---

## Todo priority order (see TODO.md for full descriptions)

1. Verify campaign sync across devices (connect on phone, check all campaigns appear)
2. Verify task #26 (API key re-entry) on Netlify
3. Verify task #24 (party HUD) with actual companion
4. Companions at campaign start (#8 — partial, needs start-of-game selection UI)
5. Text to speech (#13)
6. Legacy characters (#12 — design done, not implemented)
7. Multiplayer (#2 — unblocked now that HUD exists)
8. Multiple campaigns review (#11)
9. API key migration to server-side / subscription model (architecture decision already made)
