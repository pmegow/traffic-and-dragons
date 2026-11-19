# Lane G report — persistence and cloud sync (HEAD d7ed4ea6, v1.1451)

Probes: `audits/audit-2026-11-19-evidence/G\` (probe1-ack-race.js, probe1b-real-switch.js, probe2-load.js, probe3-busy-reconcile.js, probe4-roundtrip.js). All run headless through dev/load-engine.js with a stubbed `fetch`; no repo file touched.

## 1. Coverage

| File | Read | Notes |
|---|---|---|
| DOC/contracts/sync.md | whole | read first |
| state.js (1,450 lines) | whole | migrateWorldState's per-feature heals (lines 562–760) and healMemory's guestbook/knowledge heals read for shape and throw-paths, not re-derived feature by feature |
| storage-adapter.js (1,412 lines) | whole | |
| globals.js (583 lines) | whole | mostly constants / provider adapters; nothing persistence-relevant beyond key names |
| error-report.js (461 lines) | whole | |
| sw.js (269 lines) | whole | plus a scripted check of every tracked root page / root .js against APP_SHELL and the network-first regex |
| compress.js (112 lines) | whole | |
| _headers | whole | |
| Outside the lane, read only to settle a question | ui-boot.js initState (446–507), ui-files.js importSave catch (675), ui-campaigns.js `_pulledMemory` (258–264), DOC/SERVER_ARCHITECTURE.md CAS row (line 58), dev/class-guards.js network-first check | |

Not run: the suites, sabotage batteries, browser suites (per brief). The server side of the CAS guard was not run; its rule is taken from DOC/SERVER_ARCHITECTURE.md line 58 ("stored turn > baseTurn → 409").

## 2. Findings

### F1 — A campaign switch hands the old campaign's turn to the new campaign as its sync base, so the new campaign's overwrite guard is off for the rest of the session (HIGH)
- **File/function:** storage-adapter.js `_syncNow`, response handler, line 717–719: `else { _syncOk(turnAt); _flushAcked(turnAt); …` (and the same unguarded handlers for 409 line 683–694 and 403 line 696–713). `_syncOk` (line 396): `if (turnAt > _lastAckTurn) _lastAckTurn = turnAt;`
- **Mechanism:** `switchToCampaign` → `snapshotActiveCamp` → `storageAdapter.syncNow()` fires campaign A's POST (line 1243 state.js), then synchronously `loadState` → `resetSyncState()` sets `_lastAckTurn=-1` for campaign B. A's 200 arrives afterwards and `_syncOk(A's turn)` raises B's base to A's turn. Nothing in the handler checks that the campaign that was posted is still the active one (the reconcile has exactly that check, line 932; `_syncNow` does not). B's next POST carries `baseTurn = A's turn`; the server refuses only when its stored turn > baseTurn, so any B row whose turn is below A's turn accepts an older B payload. The badge reads 0 unsynced. The same stale handler can also put B into a 409 pause (A's 409), light B's failure badge (A's 413), or — 403 `foreign_campaign` for A — call `rehomeCampaign`, which re-homes the ACTIVE campaign (B), not A.
- **Input:** server mode; campaign A at turn 2000 active; switch to campaign B (local turn 10) through the picker.
- **Outcome:** REPRODUCED through the real `switchToCampaign` — `probe1b-real-switch.js`:
  ```
  switch ok: true | active: campB | live turn: 10 | A POST fired: 2 campA | ack now: -1
  after A's 200: B ack base = 2000 | unsynced badge = 0
  B's next POST: campaignId campB turn 10 baseTurn 2000
  ```
  (`probe1-ack-race.js` shows the same with an already-in-flight POST.) Server-side acceptance is READ from the documented CAS rule. Effect: a phone that plays B ahead later is overwritten by this device's older B with no 409.
- **Remedy:** capture `campId` in `_syncNow` and, in every response branch, do nothing to the ack/conflict/fail state (and never re-home) when `getActiveCampId() !== campId`; or bump a generation counter in `resetSyncState` and drop responses from an older generation.

### F2 — If the player sends a turn while the boot reconcile is in flight and the cloud is ahead, this device silently keeps its older copy but takes the cloud's turn as its sync base, and the next save overwrites the newer cloud copy (HIGH)
- **File/function:** storage-adapter.js `_reconcileFromServer`, line 995 `if (serverTurn > _lastAckTurn) _lastAckTurn = serverTurn;` runs before line 1011 `if (serverTurn > localTurn && !(typeof busy !== "undefined" && busy)) {` — the adopt is skipped with no log, toast or retry.
- **Input:** server mode; local turn 10, server row turn 50 (played on another device); the player presses Send before the reconcile GET returns (Fly wake can take seconds).
- **Outcome:** REPRODUCED client side — `probe3-busy-reconcile.js`:
  ```
  after reconcile: local turn 10 | lastAckTurn 50 | unsynced 0
  POST after the turn: turn 11 baseTurn 50 (server held 50)
  messages: []
  ```
  With the server rule (stored 50 > base 50 is false) the POST is accepted and turns 12–50 from the other device are replaced by turn 11. No message on any channel.
- **Refutation tried:** `resolveCas409` heal does not apply (no 409 is raised). No re-run of the reconcile after `busy` clears.
- **Remedy:** when the adopt is skipped for `busy`, do not seed `_lastAckTurn` from the server (or set `_conflict` so sync pauses), say so, and re-run the reconcile after the turn commits.

### F3 — A local save that fails to parse or to migrate is dropped with no message and no rescue copy, and the boot shows the character wizard (MEDIUM–HIGH)
- **File/function:** state.js `loadState`, line 907 catch: `}catch(e){worldState=null; … if(e&&e.incompatible){…} return false;}` — only the newer-build case says anything; line 916 `try{if(worldState&&migrateWorldState())saveCore();}catch(e){worldState=null;return false;}` — silent. JP0-4's `rescueCorruptStore` covers the session and memory keys only; the core key (`tnd_core_v10`) has no rescue.
- **Input:** (b) a truncated/invalid `tnd_core_v10`; (c) a valid save whose `character.spells` holds a `null` (migrate line 603 reads `c.spells[si].lvl`; similar bare reads: `questLog[_ql].objectives` line 604).
- **Outcome:** REPRODUCED — `probe2-load.js`:
  ```
  (b) truncated core: loadState = false | worldState=null | toasts=[] | console=[] | rescue keys=[] | versionRefusedLoad=null
  (c) null spell: loadState = false | worldState=null | toasts=[] | console=[]
  ```
  `initState` (ui-boot.js 497–501) then shows the wizard because `versionRefusedLoad()` is null; a new game's first `saveAll` writes over the unreadable bytes. In server mode the fresh-device reconcile may recover it from the cloud; in local mode nothing does.
- **Remedy:** route both catches through a rescue of the raw core bytes plus a console.error and a toast naming the error, and treat it like the version refusal (no wizard over an unreadable save).

### F4 — A `.tnd` import that throws inside migration leaves the app half-switched: the screen says "Import failed" while the live globals and active id belong to the half-imported campaign (MEDIUM)
- **File/function:** state.js `importSaveData`, line 1140 `worldState=ws;`, line 1143 `setActiveCampId(plan.id)`, memory rebuilt 1167–1179, then line 1180 `migrateWorldState();` with no rollback. ui-files.js line 675 only toasts `"Import failed: "+err.message`.
- **Input:** an import file whose hero has `spells:[null]`.
- **Outcome:** REPRODUCED — `probe2-load.js`:
  ```
  (d) import threw: Cannot read properties of null (reading 'lvl')
  (d) after the throw: active id=camp_1795095937162_8781 worldState.campName=Imported memory.lore=["IMPORTED-LORE"] memory.campId=undefined
  ```
  The live keys still hold the old campaign while the active id is the new one; the next `saveAll` (any action) writes the half-migrated import into the live keys under the new id. The outgoing campaign survives in its slot (snapshotted at line 1139).
- **Remedy:** run the migrate/heal on the detached `ws`/`memory` before installing them (or restore the previous globals, active id and live keys in a catch).

### F5 — A pulled or restored memory of `{}` is accepted as healthy, though it has no NPC/location/quest stores and the first reader throws (MEDIUM; contract drift, audit D5)
- **Files/functions:** ui-campaigns.js `_pulledMemory` line 260 `if(m&&typeof m==="object"&&!Array.isArray(m))return m;`; storage-adapter.js `_reconcileFromServer` adopt line 1020 `memory = data.memory || blankMemory();` (does not use `_pulledMemory` at all and accepts any truthy value); state.js `checkpointRestore` line 859 `mem=JSON.parse(snap.mem||"{}")` then an object check that `{}` passes. `healMemory` never creates `npcs`, `locations`, `quests`, `lore`, `keyDecisions`, `chapters`, `eras`.
- **Contract:** sync.md §16 D5 says `{}` "is not an empty memory but a BROKEN one … Both sites route through `_pulledMemory(data,id)` → `blankMemory()` plus a loud line." `_pulledMemory` only catches absent/null/array/non-object.
- **Outcome:** REPRODUCED for the heal — `probe2-load.js`:
  ```
  (a) after heal of {}: typeof memory.npcs = undefined, locations=undefined, quests=undefined, lore=undefined
  (a) Object.keys(memory.npcs) THREW: Cannot convert undefined or null to object
  (a) _pulledMemory-shaped check accepts {}: true
  ```
  READ for the three call paths (not driven end to end). Pre-D5 clients pushed `memory:{}` with a real turn, so such rows can exist on the server. The reconcile adopt also calls `saveAll()` right after, persisting it.
- **Remedy:** one shared "is this a memory" test (the blankMemory key set present and typed) used by `_pulledMemory`, the reconcile adopt and `checkpointRestore`; otherwise `blankMemory()` with the loud line (or refuse, for the restore).

### F6 — Four Blueprint Designer scripts are served cache-first by the service worker, and designer-only commits do not bump CACHE, so designers run stale code (LOW–MEDIUM)
- **File:** sw.js line 203 network-first regex; the scripts `designer-acts.js`, `designer-assistant.js`, `designer-prose.js`, `designer-assistant-ui.js` (loaded by blueprint-designer.html lines 192, 194, 195, 1803 with no query string) match no branch and fall to the cache-first path (line 255) into `CACHE`. The CLAUDE.md carve-out says designer-only commits bump `BP_DESIGNER_VERSION` and NOT `CACHE`. The admin and invitation scripts dodge this with `?admin_console`; `designer-portrait-batch.js`, `designer-menu.js` and `designer-creatures.js` carry `?v=`.
- **Evidence:** READ plus git: `designer-assistant.js` changed in 2a9a109f and 969ad177 and `designer-assistant-ui.js` in 56b6f036 and 969ad177 with no sw.js change in the same commit. dev/class-guards.js `networkFirstProblems` checks root PAGES only, not the scripts they load (the audit D14 class, for /dev/).
- **Outcome:** a browser that cached the old file keeps running it against the newer designer page until the next engine deploy.
- **Remedy:** add `designer-` to the network-first regex (or give each a `?v=` tied to `BP_DESIGNER_VERSION`), and extend the class guard to scripts referenced by network-first pages.

### F7 — A failed portrait upload (HTTP 4xx/5xx) is treated as success, never reported and never retried (LOW)
- **File/function:** storage-adapter.js `syncPortrait`, lines 532–540: `_portraitDirty = false; _tFetch(…PUT…).catch(function(e) { _portraitDirty = true; console.warn(…) });` — no `.then` checks `r.ok`.
- **Input:** the server answers the PUT with 401/413/500.
- **Outcome:** READ (not driven). `_portraitDirty` stays false, nothing is logged, and sheet-less NPC portraits (which travel only through this store) do not reach the other device. Policy breach: silent failure.
- **Remedy:** `.then(function(r){ if(!r.ok){ _portraitDirty=true; console.warn(…status…); } })`.

### F8 — `rehomeCampaign` does not carry the per-campaign rescue keys, so a preserved story record is orphaned under the old id (LOW)
- **File/function:** state.js `rehomeCampaign` (1090–1114) moves the slot, list row, unsynced marker, size latch, memory stamp, held checkpoint and folder marker; it does not move `tnd_transcript_rescue_v1_<old>` (or the store/clock rescue keys). `restoreTranscriptRescue` (line 319) looks up `TRANSCRIPT_RESCUE_K + worldState.campId`, now the new id.
- **Input:** a campaign holding a UA3 transcript rescue is re-homed (a 403 `foreign_campaign`, or F1's stale 403).
- **Outcome:** READ. The toast promised "a backup was preserved and will auto-recover on a healthy reload"; it never does. The comment calls this "ONE function, so … cannot each forget a key".
- **Remedy:** move the rescue keys (or at least the transcript rescue) with the slot.

## 3. Monotonic resources

| Resource | Scope | Bound | Enforced in code? |
|---|---|---|---|
| `store` fallback `_m` / `_mKeys` (state.js 2–15) | per session | one value per key, overwritten | yes (keyed) |
| `_trLzMemo` / `_trSegMemo` WeakMaps (state.js 121, 154) | per session, per transcript array | one compressed copy of the transcript per live array; GC'd with the array; the transcript is append-only (no splice/pop/length= anywhere, grepped) | yes |
| `tnd_camp_<id>_ws/_sl/_mem` slots | per campaign, device-forever | deleted by deleteCampaign / Remove local / switch dance | **NO for a campaign pruned by `mergeCampaignLists`** (deleted on another device): the row goes, the slot (hundreds of KB on a mature save) stays, and every UI path to remove a slot is row-driven. Unreachable quota on a quota-pinned phone. READ. |
| `tnd_camps_v1` list | device-forever | rows pruned on delete/prune | yes |
| `tnd_sync_dirty_v1` | device | `SYNC_DIRTY_CAP`=8, oldest evicted, cleared on delete | yes |
| `tnd_sync_size_warned_v1` | device | one `|id|` per campaign, pruned on delete | yes |
| `tnd_version_lock_v1` | device | one entry per locked campaign, cleared on reconcile success / delete | yes (not moved by rehome; harmless) |
| `tnd_deleted_elsewhere_v1` | device | one record | yes (a record for a campaign later deleted locally persists and suppresses the list-sync detection for other campaigns until overwritten by the reconcile path — minor) |
| Rescue keys `tnd_store_rescue_v1_*`, `tnd_clock_rescue_v1_*`, `tnd_camps_v1_corrupt`, `tnd_transcript_rescue_v1_*` | per campaign, device-forever | never deleted except transcript-on-restore | deliberately unbounded (sync.md: "nothing in the app deletes a rescue key"); listed, not a finding |
| `tnd_er_crumbs_v1` / `_erCrumbs` | per page / device | `ER_CRUMB_MAX`=24 | yes |
| Error reports | per page | debounce 30 s, `ER_SESSION_CAP`=10, reentry latch | yes |
| Login listeners/intervals (`loginWithServer`) | per login attempt | 5-min give-up timer clears listener + poll; `_ticketPoll` self-clears when `_popup` goes null | yes |
| `worldState.usage.syncBytes/syncPosts` | per campaign | numeric counters | n/a |
| `worldState.deaths` | per campaign | ≤ RESPAWNS_PER_CAMPAIGN+1 | yes |
| SW `CACHE` | per deploy | purged on activate; runtime cache-first adds every distinct same-origin GET URL (query strings included) for the deploy's life | bounded by deploy |
| SW `ROLLER_CACHE` | device-forever (purge-exempt) | one entry per distinct /roller/ URL; no GC of paths a later publish removed | small, unbounded in principle |
| SW `PIPER_CACHE` | device-forever | GC of superseded `?tnd=` revs | yes |
| SW audio cache | per catalog version | old names purged on activate | yes |

## 4. Affirmed

1. `serializeWorldState`/`parseWorldState` round trip — 600-entry chunked transcript, a segment-0 `mutateTranscriptEntry` between saves, emoji/accents, unknown top-level and NPC fields, an own `__proto__` key: byte-equal round trip, invalidation hit the right segment, no prototype pollution (`probe4-roundtrip.js`: `deep equal … true`, `e3.rc: 1`, `Object.prototype polluted: undefined`).
2. `saveCore` under `QuotaExceededError`: the `store` wrapper rethrows after shadowing, the previous on-disk save is untouched, and the player gets a toast (state.js 6–13, 343). Read, consistent with audit E5/E6.
3. `inflateTranscriptField` on a truncated/garbled `{__lz}` / `{__lzc}`: returns null (LZ decompress returns "" → JSON.parse throws → null), and the reconcile refuses before adopting (storage-adapter 967). Read.
4. No API key, session token or Authorization header in any campaign payload (`_syncNow`, `pushCampaignState`), export field, or error report: keys live in headers (`x-goog-api-key`, `x-api-key`, Bearer); the report's sync hint sends a boolean; the storage hint sends key names and sizes only. Grepped `worldState.*Key|token` — none.
5. No session token in a URL: tickets are one-shot path/query values (`/auth/ticket/<t>`, `?link=`); invitation.js keeps its token in the hash and invitation.html does not load error-report.js, so `location.href` in a crash report cannot carry it.
6. The auth `postMessage` handler checks `e.origin` against the server origin before accepting a session (storage-adapter 240).
7. SW install fails whole on any missing shell file (per-URL `!r.ok` throw, sw.js 131–136); every tracked root page outside APP_SHELL matches the network-first regex (scripted check: all NF except index.html / piper-host.html, which are shell).
8. `checkpointRestore` refuses a foreign-campaign or newer-version snapshot before touching live state, and rolls back on a heal throw (read; the `{}` memory gap is F5).

## 5. Undetermined

- **CAS "heal" on a divergent branch:** `resolveCas409` heals whenever serverTurn ≤ localTurn, so a device offline at turn 100 overwrites another device's divergent turns 91–95 (server 95). The comment marks this a deliberate local-wins ruling (2026-07-13); recorded, not reported.
- **Checkpoint across a re-home:** `rehomeCampaign` re-stamps the in-memory camp, but the IndexedDB copy and the server slot are keyed by the old id (game.js, outside the lane); after a reload the re-homed campaign may have no camp. Not checked.
- Whether the Fly server additionally refuses a POST whose payload turn is below its stored turn (would blunt F1/F2). The architecture doc says it checks only stored > baseTurn; not run against the real server.
- F1's 403 branch re-homing the wrong campaign was established by reading, not driven.
