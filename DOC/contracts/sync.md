# State, storage, cloud sync, checkpoints and the character library

**Read this when** you touch state.js, save/load, the sync adapter, the CAS guard, checkpoints or the library endpoints.

Split out of CLAUDE.md on 2026-09-03 (#310); the map there links here. Version stamps and history links inside are the record as written — the contract lines are current unless a newer commit says otherwise.

## 3. State management (in `state.js`)

Three live objects, all persisted to `localStorage` via the `store` wrapper:

| Object | Storage key | Contents |
|---|---|---|
| `worldState` | `tnd_core_v10` | `character`, `world` (location/region/time/weather/threat), `npcs[]`, `questLog[]`, `eventHistory[]`, `combat`, `turn`, W2 `sceneRefs` / `canonTxns` / `identityConflicts` |
| `sessionLog` | `tnd_sess_v10` | Current-session messages sent to the API (`[{role, content}]`); cleared on summarization |
| `memory` | `tnd_mem_v10` | Long-term narrative memory: `npcs{}`, `locations{}`, `quests{}`, `lore[]`, `keyDecisions[]`, `futureEvents[]`, `chapters[]` |

`store` wraps `localStorage` with an in-memory fallback `_m`. Storage key constants (`WSK`, `SLK`, `MEM_KEY`, `AKK`, `RLK`) are defined in `state.js`.

**Transcript compression:** the append-only `worldState.transcript` is the dominant part of a mature save (it caused localStorage quota death on mobile; [history](DOC/CLAUDE_HISTORY.md#3-transcript-compression--the-t308-evidence-v1227)). `saveCore` writes via **`serializeWorldState()`**, which LZ-compresses ONLY the transcript inline (`transcript` → `{__lz:"…"}`); `loadState` reads via **`parseWorldState()`**, tolerant of plain-array transcripts (server blob, `.tnd` import, legacy save). **In-memory `worldState.transcript` is ALWAYS the plain array**; only the localStorage boundary carries the compressed form. Degrades safely to plain JSON if `LZ` is absent. Round-trip engine-tested against real save data — a compressor bug here would CAUSE data loss.

Campaign list metadata stored in `tnd_camps_v1` — array of lightweight campaign entries used by the campaign picker.

**Archive-key registry (JP0-5, v1.720):** `memory.archive` categories live in ONE list — **`MEMORY_ARCHIVE_KEYS`** (state.js) — with three derived helpers: `blankArchive()` (birth shape), `archiveHeal(arc)` (fill-only lazy init/heal, never drops or reshapes) and `archiveRebuild(src)` (untrusted-blob rebuild for the `.tnd` import). All four consumers derive from it: `blankMemory`, `healMemory`, `memArchive` (memory.js) and `importSave` (ui-files.js) — the hand-copied allowlists they used to carry had drifted apart and the import one destroyed a category on every round-trip FOUR times (attitudeSpec, eras, the #144A trio, `npcDeathCorrections`+`relDowngrades`). **The registry is not what closes the class — `archiveRebuild` carrying UNKNOWN categories through VERBATIM is**: a future category, or a dev repair tool's own (`retconRepairs`, `repairBundles`), round-trips with zero edits. Registering a category buys only the blank-shape default and an array type-guard (junk never becomes archive canon). The #144A ARCHIVE CARRY CONTRACT (run-tests.js) now derives from the registry and bans any `mm.archive.<key>` hand-enumeration in ui-files.js — the duplicated allowlist inside that contract is why each loss shipped green.

**Corrupt-store rescue (JP0-4, v1.719):** `loadState` parses each side key in its own try/catch (E73 — a corrupt session/memory key must NEVER discard a good worldState), and each catch now routes through **`rescueCorruptStore(tier,raw,err)`** before degrading: the unreadable bytes are preserved VERBATIM under `STORE_RESCUE_K + tier + "_" + campId` (one slot per store per campaign; a newer corruption OVERWRITES — the opposite of UA3, where the rescue is *prepended* to survivors so the oldest blob holds the longest record, whereas these stores are replaced wholesale), the degrade shouts on both channels naming the tier ("session log" / "long-term memory"), and only then does the store fall back to `[]`/`blankMemory()` so the campaign still loads. **No recovery UI ships in this pass by design** — nothing in the app deletes a rescue key (pinned by the JP0-4 CORRUPT-STORE RESCUE CONTRACT in run-tests.js), so the preserved bytes stay the only copy until a recovery flow is designed.

## 16. Campaign management

`showCampaignPicker()` reads `tnd_camps_v1` from localStorage. `saveAll()` calls `storageAdapter.syncToServer()` on every save — **debounced**: schedules a trailing 1.5s timer so a turn's multiple saveAll bursts coalesce into ONE `POST /api/state` built from the latest state. `storageAdapter.syncNow()` flushes immediately; wired to `beforeunload` and `visibilitychange(hidden)`. The payload no longer carries the story DOM (`narrativeHtml` is sent as `""`) — replay rebuilds from `worldState.transcript`.

**The page-hide flush is SIZE-BOUNDED (JP0-11, Fable f68 — the guarantee this line used to overstate).** The flush rides `fetch(keepalive:true)` (a plain fetch is abandoned on unload, audit E34), and the Fetch spec caps total in-flight keepalive request **bodies** at 64 KiB — over that the browser rejects the request outright, and that rejection landed in a swallowing `.catch`: no console line, no badge, no toast. It is not a mature-campaign edge case — the PC's base64 portrait rides **inline** by design (`_stripNpcPortraits` strips only NPC avatars), so a portrait-bearing character clears the cap from roughly turn 1. So: **under `FLUSH_KEEPALIVE_MAX` (56 KB, the margin under the cap, measured in BYTES via `TextEncoder` — `payload.length` is a character count and under-reports the multi-byte `{__lz}` transcript) the keepalive flush is unchanged; over it the doomed request is NOT attempted.** Instead the flush marks the campaign dirty in `tnd_sync_dirty_v1` (`{campId: turn}` through the `store` wrapper — the turn number, never the payload; the state is already saved locally; bounded at `SYNC_DIRTY_CAP`=8 campaigns) and says so in the console. The next `load()` for that campaign **pushes before `_reconcileFromServer` may adopt anything** — adopting a newer server copy over turns the server never saw is the silent cross-device loss — and the reconcile is only DEFERRED, never blocked, by a failed push. The **CAS turn guard is untouched**: a genuine two-device conflict still pauses loudly. The marker clears ONLY on a confirmed 2xx of our own payload at a turn ≥ the marked one (a 409 self-heal acks the *server's* turn, so its retry does the clearing), and a landed under-cap beacon clears it too. One toast per page load says the final turns synced. Tests: `dev/tests-jp011-flush-dirty.js` + the synchronous half in the suite; mutation proof `dev/sabotage-jp011-flush-dirty.js` (10 clauses).

After connecting to server, `syncCampaignList()` fetches the server campaign list and merges it into `tnd_camps_v1`, then the campaign picker opens automatically.

## 17. Sync modal

Direct editing of HP, max HP, gold, XP, level, location, time, weather, inventory without going through the GM.

## 22. Cloud sync (`storage-adapter.js`)

**Server:** `https://traffic-and-dragons-server.fly.dev`
**Auth:** GitHub OAuth popup → server postMessages `{type:"tnd-auth", sessionId, username}` back to opener → token stored in `tnd_server_tok_v1`.
**CORS:** Server uses `origin: function() { return "*"; }` to handle `null` origin from `file://` pages.
**Endpoints:** ~20 routes — full enumeration in [SERVER_ARCHITECTURE.md](DOC/SERVER_ARCHITECTURE.md) §1.2 (auth, state with the CAS turn guard on POST, campaigns, character/blueprint libraries, allowlisted `/api/prefs/:key` blobs, health). Auth flow is TICKET-based: the popup postMessages a one-shot ticket (or the opener polls it on file://), and the sessionId comes from the claim endpoint.
**Hygiene (#313, v1.770):** schema versioned via `PRAGMA user_version` (`MIGRATIONS` in db.js — roll forward only; a newer-stamped store refuses to boot); per-user quota (256 MB / 40 campaigns, env-tunable) refused as a 413 the client toasts verbatim; sessions slide 30 days but die 90 days after login; nightly off-Fly backup + quarterly restore drill are GitHub Actions in the server repo gated on `BACKUP_TOKEN`.
**Deploy:** `cd C:\Users\hannu\Projects\traffic-and-dragons-server && flyctl deploy --ha=false` — the server repo lives OUTSIDE the OneDrive-synced tree (DOC/todos_completed/PROJECT_ONE_DRIVE_EXODUS.html Phase 4); it is NOT a sibling of the game repo.
**TTS app (#90, M1):** `https://tnd-tts.fly.dev` — a SECOND Fly app in the same server repo (`tts/` subdir; deploy `cd tts && flyctl deploy --ha=false`). `POST /api/tts` {text, voiceId, rate} → audio/wav (warm piper daemons, LRU 3, 10min idle kill; voices HF→3GB volume on first use); auth = the game server's session token proxy-validated via `/auth/me` (10min memo); `/health` unauthenticated (the client's prewarm probe — wakes the auto-stopped machine). Design: DOC/Research/DOC_server_tts.html; Kokoro M2 is TODO #91 (benchmark-gated).

## 23. Reload behavior

On `init()`, if a saved game is found, `rebuildNarrativeFromTranscript()` (ui-boot.js) repaints the last 20 `worldState.transcript` entries into `#story-narrative` (with an "earlier entries omitted" note when trimmed); the last response's suggested action buttons (`worldState.lastActions`) are live and clickable. The same rebuild serves campaign loads and the server reconcile (`clearFirst=true` there). Fallbacks for pre-transcript saves: last sessionLog exchange, else a "Previously:" chapter recap, else legacy `narrativeHtml` from old server blobs. Dice blocks and system messages are not replayed (the transcript stores story prose only, by design).

---

## 24. Character library (`storage-adapter.js` + server)

Server-side character storage separate from campaigns. Characters are portable snapshots — exporting Ammut at Lv3 stores a Lv3 version; campaigns have no dependency on this store.

**Server table:** `characters (user_id, slug, name, char_data, level, cls, ancestry, updated_at)` — composite PK `(user_id, slug)`. One slot per character name per user.

**Server endpoints:**
- `GET /api/characters` — list all characters for user (includes full char_data with portrait)
- `POST /api/characters` — upsert by name slug; body: `{character}`
- `DELETE /api/characters/:slug` — remove from library

**Client methods on `storageAdapter`:** `listCharacterLibrary(cb)`, `saveCharacterToLibrary(char, cb)`, `deleteCharacterFromLibrary(slug, cb)`

**Export flow:** "Export Character" button (char sheet + companion sheets) opens `_showCharExportOptions(char)` — offers "☁ Save to library" (grayed if not connected) and "⬇ Download .char file". If saving and character already exists in library at a different level, `_showCharOverwriteConfirm` asks before overwriting.

**Import flow:** `showCharacterLibrary()` browser modal — lists saved characters with portrait, Import (→ `showCharImportPreview`) and × delete buttons. Accessible via the "☁ Character Library" button in the Import Character browser.

**Update from library (#161):** "⟳ Update from library" on player + companion sheet headers pulls the library copy's IDENTITY fields into the live sheet behind a per-field old→new preview — `LIB_UPDATE_FIELDS` registry + pure `libUpdateDiff`/`libUpdateApply` (helpers.js, engine-tested; apply recomputes the diff so preview and apply can never drift). Whitelist-only; **progression and play-earned state NEVER flow**; `name` is excluded (identity KEY — renames are #156 territory). Skip rules: lib-undefined skips, explicit `""` applies (deliberate clear), null/"" portrait skips. Modal: `showLibraryUpdateModal` (ui-browsers.js); companion apply mirrors `portraitOffset` onto `wsNpc`. The pull half of the future character-editor loop.

**"Play as X" flow:** all three import paths (file, campaign browser, library) route through `_startImportedCampaign(char)` — a campaign-setup modal asking campaign name, world tone, and starting location (options cloned from the wizard's Review-step select) before resetting state and calling `startGame()`. The character is played as-is; companions are added in-game via Import Character → Add as companion (intro instruction sent via `sendAction(intro,{silent:true})` so it never renders as a player message).

**Mid-game character swap:** `_switchPlayerCharacter(name)` (NPC sheet → "Play as this character") demotes the current PC to a companion NPC and promotes the chosen companion's `charSheet` to `worldState.character`. The POV-handoff fix is two-part: (1) a forceful out-of-character control directive sent `{silent:true}`; (2) `worldState.recentSwitch` makes `buildSysPrompt` re-inject a "CONTROL RECENTLY SWITCHED" block, auto-cleared after 2 turns — the re-injection is the load-bearing part (a single handoff line can't overpower many turns of old-POV history). **Portrait atomicity:** `syncToServer` must never null `character.portrait` — the current PC's portrait rides **inline in the main state blob**, atomic with the state turn. Only sheet-less NPC `n.portrait` is stripped to the separate `/portrait` store. (Desync history: [history](DOC/CLAUDE_HISTORY.md#19-portraits--the-sync-sagas).)

---

- **Rescue keys.** `STORE_RESCUE_K` (JP0-4: an unparseable session/memory store, per tier, per campaign, newest wins) and `CLOCK_RESCUE_K` (#274: a corrupt clock object) preserve the unreadable original before the degrade; nothing in the app deletes a rescue key (source-contract pinned). The rescue toast distinguishes a durable backup from one held in the in-memory store fallback (`rescueKeptText`, queue entry 25).

- **The campaigns ROOT persists; the campaign folder is derived (#336, owner ruling 2026-09-04).** The owner picks the Campaigns folder ONCE (File ▸ Set campaigns folder, or the first-campaign banner); `_campRootHandle` is the persisted handle (IndexedDB key `campRoot`). Every write derives the active campaign's subfolder beneath it — `campaignFolder()` = root / `_slugFolderName(worldState.campName)`, cached per slug — so switching campaigns retargets by itself and a new campaign never re-opens the picker (`initCampaignFolderForGame` only names where it will save). The label everywhere is the pure `campaignFolderLabel(rootName, campName)` = `Campaigns/The_Iron_Meridian__Gazz_Quickfuse_` (menu, save modal, toasts). A legacy install that persisted the SUBFOLDER (`campFolder`) is retired loudly at boot — its parent is unreachable through the File System Access API — and the root is picked once. Existing folders on disk are never moved by the app. Pinned by `dev/tests-336-campaign-root.js`.
