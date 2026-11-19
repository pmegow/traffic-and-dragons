# Lane K report — import, campaign CRUD, export, the wizard, portraits, the skeleton generator

HEAD d7ed4ea6 (v1.1451). Probe scripts are in
`audits/audit-2026-11-19-evidence/K\`.

## 1. Coverage

| File | Read | Notes |
|---|---|---|
| ui-browsers.js (1035 lines) | all of it | |
| char-creation.js (687) | all of it | |
| ui-boot.js (513) | all of it | |
| ui-files.js (677) | all of it | |
| ui-campaigns.js (570) | all of it | |
| ui-portrait.js (401) | all of it | |
| campaign_generator.js (219) | all of it | |
| DOC/contracts/character.md | all of it | |
| DOC/contracts/sync.md | §3 (lines 7–46), §16–§24 (lines 116–223) | I skipped the generated storage-key table after `tnd_folder_declined_v1` |
| Outside the lane, read only to settle a finding | state.js `importSaveData`/`resolveImportedCampaignId`/`rehomeCampaign`/`updateCampMeta`/`switchToCampaign` (head)/`removeCampaignLocalCopy`/`deleteCampaign`/`planCloudAdopt`; game.js `startGame` (lines 10–60), `generateSkeleton` (3744–3805), `takeCheckpoint`/`restoreCheckpointHolder`; ui-shell.js `showToast`, `modalShell`, `addMsg`; helpers.js `escHtml`/`safeImgSrc`/`portraitAdmit`, `clampImportedCharacter`, `elapsedTicker`; admission.js `clamp` row; inventory.js `invRows`; storage-adapter.js `loginWithServer` (head) | |

## 2. Findings (strongest first)

### F1. A .tnd save can run script in the game page: the hero's name and the world location are written unescaped into the boot and campaign-load system lines.
- **Where:** ui-boot.js `initState` lines 451–452: `addMsg("system","Welcome back, "+worldState.character.name+".")` and `addMsg("system",worldState.world.location+" | Turn "+…)`. ui-campaigns.js `_applyLoadedCampaign` lines 245–246: `"Campaign loaded: "+worldState.character.name+"."` and the same location line. `addMsg` assigns `div.innerHTML=html` (ui-shell.js line 323).
- **Input:** a `.tnd` file (for example a friend's export) with `character.name = "Kit <img src=x onerror=alert(1)>"` or `world.location = "Harbor <img src=x onerror=…>"`. Import it with File ▸ Load Game. The import's own line escapes the name (ui-files.js line 675). The next reload (`initState`) or a picker Load (`_applyLoadedCampaign`) renders both strings as HTML.
- **Outcome:** script runs in the origin that holds the API keys in localStorage (`tnd_ak_v1`, the fal key) and the server session token. `world.location` is also written by the model through `[LOCATION:]`, so the same sink is reachable from model text.
- **Evidence:** REPRODUCED for the data half. `probe-boot-msg.js` runs the real `importSaveData` (migrate, heals and admission). Output:
  `name after import : "Kit <img src=x onerror=alert(1)>"` / `location after import: "Harbor <img src=x onerror=alert(1)>"` / `initState line 1 html: Welcome back, Kit <img src=x onerror=alert(1)>.`
  The innerHTML sink was established by reading; no browser was run.
- **Severity:** high (security).
- **Remedy:** wrap `escHtml()` around the name and location in these four `addMsg` calls.

### F2. A .char file can run script when it is previewed: stats, level, HP, XP, class and subrace go into innerHTML raw, and the import admission does not type them.
- **Where:**
  - ui-browsers.js `showCharImportPreview`: line 502 `(stats[s]||"—")`, line 516 `"Lv"+(char.level||1)`, line 521 `"HP "+char.hp+"/"+char.maxHp`.
  - char-creation.js `buildReview`, the import branch (the #762 wizard road skips the preview modal): line 191 `(ch.subraceNm||ch.subrace||ch.ancestry||"")+" "+(ch.cls||"")` unescaped; lines 192–193 `fs2[s]`, `ch.maxHp`, `ch.level`, `ch.xp`.
  - Also raw: ui-browsers.js line 614 `char.level` (`_startImportedCampaign`), line 739 (`_showCharExportOptions`), line 922 `comp.level` (`_renderCompanionSlots`), and the library rows at lines 442/991 `entry.level`.
- **Input:** a `.char` file with `stats.STR`, `level`, `hp`, `maxHp`, `xp`, `cls` or `subraceNm` set to `<img src=x onerror=alert(1)>`. Open it with Import Character ▸ Import from file, either in a running game (the preview modal) or in the wizard (the review card).
- **Evidence:** REPRODUCED for the data half. `probe-char-preview.js` and `probe-review-card.js` run the exact `sheetAdmit` context the preview uses. `charFileVersionIssue -> ""` and `admit ok= true`, and every hostile value survives. The rebuilt fragment is `<div class="rv-sub"><img src=x onerror=alert(1)> <img src=x onerror=alert(1)></div>`. `clampImportedCharacter` only cuts lengths (helpers.js line 3507).
- **Refuted for .tnd:** a hostile `level` in a .tnd is coerced to `1` by the load heals (`probe-level.js`: `live level after import: 1`). So the picker's `"Lv"+cm.level` is safe on that road, but not on the .char road.
- **Severity:** high (security).
- **Remedy:** escape every concatenated field in these renderers. Better: coerce the numeric fields (`level`, `hp`, `maxHp`, `xp`, `stats.*`) to numbers in an admission prepare row, so every sink gets numbers.

### F3. The skeleton review's correction pass silently drops the campaign's deepTime age ladder (#227) whenever the review finds anything.
- **Where:** campaign_generator.js `correctCampaignSkeleton` lines 161–168. It sends only `JSON.stringify({premise:skel.premise,acts:skel.acts})`, asks for `{"premise":"...","acts":[...]}` back, and returns that object. game.js `generateSkeleton` line 3777 does `skel=await correctCampaignSkeleton(...)`, then line 3800 reads `normalizeDeepTime(skel.deepTime)` from the corrected object.
- **Input:** any freeform start where the register gate or the model review returns at least one finding. That is the common case, because the #459 gate feeds the correction.
- **Outcome:** `worldState.deepTime` is never set, so the campaign plays with no age ceiling. The console blames the model: "no usable deepTime age ladder generated".
- **Evidence:** REPRODUCED. `probe-deeptime.js` drives the real `generateSkeleton` with a stubbed `callGM`: a draft carrying deepTime, one review finding, and a correction that returns exactly the schema it was sent. Output: `keys sent to the correction: premise,acts` / `worldState.deepTime after start: undefined`. The control `probe-deeptime-control.js` (no findings) keeps all three rungs.
- **Severity:** high (lost world canon on the drift surface, with a misleading log line).
- **Remedy:** in `correctCampaignSkeleton` (or at the game.js call site), carry `skel.deepTime` over to the corrected object.

### F4. The corrected skeleton is checked only for shape: an arc with no title or objective is accepted, and a null arc throws past the "fall back to the first draft" catch.
- **Where:** `validateSkeletonStructure` (campaign_generator.js line 62) checks the premise, three acts and non-empty arc arrays. It never checks arc entries. In game.js, `stampSkeletonStatus(skel)` (line 3794) runs outside the review `try` (3772–3783).
- **Input:** the correction returns act 2 with `arcs:[{}]`, or with `arcs:[null]`.
- **Outcome:**
  - `[{}]`: the skeleton lands with an arc that has no title or objective (`skeleton act2 arcs: [{"status":"pending"}]`).
  - `[null]`: `generateSkeleton THREW Cannot set properties of null (setting 'status')` and the campaign has no skeleton (`skeleton present: false`). The valid first draft is thrown away and Begin plays freeform. character.md says a failure "falls back LOUDLY to the valid first draft".
- **Evidence:** REPRODUCED with `probe-correct-shape.js` (`MODE=null` for the second case).
- **Severity:** medium (contract drift; a spineless or holed campaign).
- **Remedy:** validate each arc in `validateSkeletonStructure` (an object with a string title and objective) so a bad correction throws inside the review catch and the first draft is kept.

### F5. Loading a .tnd file is not blocked while a turn is in flight, so the GM reply for the old campaign lands in the imported one.
- **Where:** ui-files.js `importSave` lines 667–677 and state.js `importSaveData` lines 1119–1188. Neither checks `busy`. sync.md ("Transport surfaces are busy-gated (audit E3)") gates `campLoad`, `campNew`, `campCloudPull` and `campRemoveLocal` for exactly this reason: a pull replaces `worldState`/`memory` while an in-flight turn's closure still writes through those globals.
- **Input:** send a turn, then pick a file from File ▸ Save / Load ▸ Load Game (local) before the reply arrives. The menu is not disabled while busy.
- **Outcome:** `worldState`, `memory` and the active id are replaced mid-turn. The reply's `applyMuts`/`saveAll` then write the old campaign's turn into the imported campaign.
- **Evidence:** READ. I found no campaign-id guard on the turn path (grep of game.js for a turn-campaign check found nothing) and no exemption in dev/ or the seam map. I did not run a browser race.
- **Severity:** medium (corrupted campaign data).
- **Remedy:** refuse in `reader.onload` when `busy` ("Finish the current turn first."), the same as the other doors.

### F6. Load on a campaign this device holds waits for a cloud probe and then switches without re-checking busy.
- **Where:** ui-campaigns.js `campLoad`.
  - The busy check at line 266 runs once.
  - The picker is removed at line 267. Then `storageAdapter.getServerStateTurn` is awaited; the adapter times out after 20 s, and the Fly host is often asleep.
  - The `keep-local` branch (line 282) and the rewind modal's `onCancel` (line 287) both call `_campLoadLocal` → `switchToCampaign`. Neither checks busy (state.js line 1285). Only the adopt path re-checks, in `_applyPulledCampaign` line 333.
- **Input:** while signed in, press Load. During the "☁ Checking the cloud copy…" wait, the story input is reachable, so send a turn. The probe then answers level or unknown.
- **Outcome:** the campaign switches under an in-flight turn, the same hybrid write class as F5.
- **Evidence:** READ.
- **Severity:** medium.
- **Remedy:** re-check `busy` in `_campLoadLocal`, or at the top of the probe callback, before `switchToCampaign`.

### F7. Starting the game while the review page's portrait render is running clears the startup busy gate in the middle of skeleton generation.
- **Where:**
  - char-creation.js `ftRenderPortrait` sets `busy=true` (line 135) and unconditionally `busy=false` when it ends (line 157). The review card's quill (#380, line 208) calls it on step 6, next to "Begin your journey".
  - `confirmChar` (line 316) never checks `busy`. game.js `startGame` sets `busy=true` for the whole skeleton and opening (audit E22) but does not check it on entry.
- **Input:** on Review, press the quill (a 10–30 s render), then press Begin.
- **Outcome:** the portrait call finishes and sets `busy=false` while `generateSkeleton`/`beginAdventure` are still awaiting. Turns, campaign switches and imports reopen in the middle of the startup. The portrait is also lost: the hero was built with `portrait:cs.portrait||null` before it landed. `ftDeriveAppearance` (lines 162–178) has the same shape.
- **Evidence:** READ.
- **Severity:** medium.
- **Remedy:** refuse `confirmChar` while `busy`, and/or only clear `busy` in `ftRenderPortrait` if this call set it.

### F8. Escaping names with `escHtml` does not protect inline `onclick` handlers: a character name containing `");` runs as code from the library list.
- **Where:** ui-browsers.js `showCharacterBrowser` → `renderLibrary` line 444: `onclick='event.stopPropagation();_cbDelLib(\""+escHtml(entry.slug)+"\",\""+escHtml(entry.name).replace(/"/g,"&quot;")+"\")'`. The HTML parser decodes `&quot;` back to `"` before the handler is compiled. The same pattern on ids is at ui-campaigns.js 215/216/227/234/236/238 and ui-browsers.js 419/445; ids are not attacker-controlled today, see Affirmed.
- **Input:** a character named `Mal");alert(document.domain);//`. It reaches the user's library through an imported `.char` → Play as → Export ▸ Save to library, or through Upload party members for a model-named companion. Then open Import Character ▸ Library.
- **Evidence:** REPRODUCED for the handler. `probe-name-handler.js` shows the name survives admission (`admit ok= true | name after admission = "Mal\");alert(document.domain);//"`). After entity decoding, the handler is `_cbDelLib("mal_alert_document_domain","Mal");alert(document.domain);//")`; compiled and run with stubs it gives `executed: _cbDelLib then alert(game.origin)`.
- **Severity:** medium (security; needs the name to reach the user's own library first).
- **Remedy:** pass an index or `data-*` attribute and wire the handlers with `addEventListener`, as the blueprint library rows already do (`data-bpdel`, lines 271/282).

### F9. A deleted (or re-homed) campaign's camp checkpoint, a full world snapshot, stays in IndexedDB forever.
- **Where:** ui-files.js `idbPutCheckpoint` (line 92) writes `snap` (which carries `ws`) keyed by campaign id. Nothing in the tree deletes a key in the `checkpoints` store: a grep for `.delete(` and the store name found only the put/get pair.
  - state.js `deleteCampaign` (1438) and `removeActiveCampaignLocally` (1428) clear the slots and sync markers, not the checkpoint.
  - `rehomeCampaign` (1090) moves the in-memory holder to the new id and leaves the old IndexedDB key orphaned.
  - Every import re-mint creates a new id.
- **Input:** create, rest in and delete campaigns.
- **Outcome:** per-device-forever growth of one full world per campaign id ever rested in.
- **Evidence:** READ.
- **Severity:** low–medium (monotonic resource).
- **Remedy:** delete the checkpoint key in `deleteCampaign`/`removeActiveCampaignLocally`, and move it in `rehomeCampaign`.

### F10. An image the browser cannot decode is stored as the portrait anyway, raw and uncompressed, and no player-facing message says why it never shows.
- **Where:** ui-portrait.js `compressPortrait` line 81: `img.onerror=function(){cb(dataUrl);}; // fallback: store as-is`. The paths:
  - The wizard upload (ui-boot.js line 179) puts it in `cs.portrait`.
  - The modal's upload → Apply (ui-portrait.js line 287) calls `setPort(imgUrl)` directly, with no admission.
  - The modal's fal Apply (line 288) and `ftRenderPortrait` (char-creation.js line 143) `fetch(imgUrl)` without checking `r.ok`. An expired or erroring URL's HTML body becomes a `data:text/html` "portrait" the same way.
- **Input:** upload a HEIC photo on desktop Chrome, or any non-image file through the modal's picker.
- **Outcome:** a multi-MB `data:image/heic…` string is saved on the hero and synced. Every render sink then refuses it through `safeImgSrc`, which logs a console line only. The player sees a broken or empty portrait and is told nothing.
- **Evidence:** READ. The `SAFE_IMG_DATA_RE` allow-list is png/jpeg/jpg/gif/webp (helpers.js line 24).
- **Severity:** low.
- **Remedy:** on `onerror`, refuse with a status line ("That file could not be read as an image") instead of storing it, and check `r.ok` before reading the blob.

### F11. Importing a character in the wizard and then pressing Back lets the fresh-hero path start with the Identity, Class and Attribute steps never checked.
- **Where:** ui-browsers.js `_importCharToReview` (586–600) jumps straight to `goStep(6)`, which sets `cs.reached=6`. It also sets `cs.ancestry=char.ancestry`, a display name such as "Elf", not an ANCS id. `rv-back` (ui-boot.js line 182) clears `pendingImportChar` and goes to step 5. Step 5's Next runs only `WIZARD_STEP_COMMIT[5]`.
- **Input:** fresh wizard at step 1 → Import character → pick one → Back → Next → Begin.
- **Outcome:** `confirmChar` builds a fresh hero with `ancestry:"Unknown"` (`anc` lookup by id fails), `subrace:null`, no racial caps, and stats all 8 (never rolled, `cs.rolled` false). Steps 2 and 4 would have refused this.
- **Evidence:** READ. The `blankWizardState` defaults are `bs` all 8 and `rolled:false` (globals.js line 561).
- **Severity:** low–medium (an invalid sheet the player can reach).
- **Remedy:** in `confirmChar`'s fresh branch, run `wizardCommit(1..5)` before building, or have `rv-back` from an import reset the cs fields the import wrote.

### F12. A manual cloud push of a campaign whose stored world cannot be parsed fails with no reason given.
- **Where:** ui-campaigns.js `campCloudPushSilent` line 112: `try{wsObj=parseWorldState(ws);}catch(e){if(cb)cb(false);return;}`. There is no console line and no toast, while its sibling refusals two lines above go through the loud `_refuse` (audit D5). The callers:
  - `campCloudPush` shows only "Push failed."
  - `campSaveRename` passes `null`, so a non-active rename's push is fully silent, and the rename then reverts on the next list merge (the E80 comment).
  - `connectToServer`'s bulk push is silent.
  - The non-409 error branch (line 139) is console-only for the null-callback rename too.
- **Evidence:** READ.
- **Severity:** low (silent failure).
- **Remedy:** route it through `_refuse("its saved world could not be read", e.message)`.

## 3. Monotonic resources

| Thing | Scope | Bound | Enforced? |
|---|---|---|---|
| IndexedDB `tnd_fs_v1/checkpoints` (one full-world snapshot per campaign id) | per device forever | none: never deleted on delete, rehome or re-mint | **NO — F9** |
| IndexedDB `tnd_fs_v1/handles` (`campRoot`, legacy `campFolder` set to null) | per device | 2 keys | yes |
| localStorage `tnd_saved_files_v1` (exportSave's filename list) | per device | 100 entries (`saved.slice(-100)`) | yes |
| `tnd_camp_<id>_{ws,sl,mem}` slots | per campaign | removed by `deleteCampaign`/`removeCampaignLocalCopy` | yes |
| Campaign meta rows (`folderSlug` field) | per campaign | removed with the row | yes |
| Campaign folder marker files `tnd-campaign.json` on disk | per campaign folder | never removed (by design: "files never move") | n/a |
| `_campFolderCache` (directory handles keyed by campaign id) | per session | number of campaigns touched; not pruned on delete | effectively bounded |
| `worldState.renders` pointers | per campaign | `RENDER_PTR_CAP` (60) via `renderPointerAdd` | yes |
| Object URLs, `_attachRestoredRender` | per restored image | revoked on load and on error | yes |
| Object URLs, `_downloadBlob` | per download | revoked right after `click()` | yes |
| Document mousemove/mouseup for portrait drag | per page | wired once (`_pdDocWired`, E61) | yes |
| Per-image drag/wheel/touch listeners | per portrait `<img>` | die with the node | yes |
| `wireButtons` listeners (document click, beforeunload, visibilitychange, story pointer handlers) | per page | `wireButtons` runs once from the load listener | yes |
| Elapsed tickers (ftRenderPortrait, portrait modal, the wizard waits) | per wait | stopped on every exit; the interval self-stops when its element disconnects | yes |
| `_wakeTimer` in `showCampaignPicker` | per open | cleared in the list callback (the adapter times out) | yes |
| `pendingCompanions`, `pendingImportChar`, `cs` | per wizard | reset by `showChar` and `startGame` | yes |
| `window._charExportList`, `window._cbPick*`, `window._cbPicks`, `window._selectedArchIdx` | per modal | overwritten | yes |
| Toasts / console ring | per session | `CONSOLE_CAP` (outside the lane) | yes |

## 4. Affirmed (tried to break, could not)

1. **`_addImportedCompanion` / `startGame` with names `__proto__`, `constructor`, `toString`** (`probe-proto-companion.js`): `memory.npcs` is null-prototype, the key is filed as an own property, and `Object.prototype` stays clean.
2. **Prototype pollution in the lane:** the only `Object.assign` calls are on wizard state (`cs`, `char.stats`); there is no for-in merge of parsed file data in any lane file.
3. **A hostile `character.level` in a `.tnd`:** the load heals coerce it to 1 before the campaign meta row (`probe-level.js`), so `_renderCampList`'s raw `"Lv"+cm.level` is safe on that road.
4. **Hostile campaign ids in the picker's inline handlers** (`campLoad("…")` unescaped): `resolveImportedCampaignId` reuses a file's id only when this device already owns it, otherwise it re-mints. A file cannot plant an id; only the user's own server list can.
5. **`buildFilename` / `exportToFolder` with path separators:** the slug keeps `[A-Za-z0-9_-]`, and the user-editable save name with `/` makes `getFileHandle` throw. That lands in the loud catch (toast plus a download fallback).
6. **Sign-in popup double-click** (`signInFromApiScreen` → `init()` twice): `loginWithServer` refuses a second popup while one is open.
7. **Wizard spell picks over the limit:** `toggleSpellPick` refuses past `lim`, and `confirmCreationSpells` requires exactly `min(lim, pool)`. Stat bumps: `cbConfirm` requires exactly +2 with the cap-20 and no-mixing rules. Archetype re-pick and Back restore from `pendingPerkBase` (no double abilities).
8. **Double-clicking Begin** (`confirmChar` twice): `startGame` calls `showGame()` synchronously, so the button is hidden before the second click is dispatched. Every perk-flow overlay removes itself before `startGame`.

## 5. Undetermined

- **Library blueprints skip validation.** `showBlueprintBrowser` → `renderLibrary` (ui-browsers.js line 279) previews with `normalizeBlueprint` only. The file road (240), the catalog (322) and the Home handoff (26) all call `validateBlueprint`, and `exportBlueprint` (ui-files.js 660) saves `buildBlueprintFromGame()` to the library without validating it. Whether an invalid library blueprint can break `applyBlueprint` (a bad `customClasses` entry, for example) was not settled. It would take running an old or invalid saved blueprint through `applyBlueprint`.
- **Party-cap contract drift (latent).** character.md says the creation picker enforces `partyCompanionCap()`. `_addPendingCompanion`, `_renderCompanionSlots` and `showCompanionBrowser` hard-code `3`, and `startGame` adds every pending companion without a cap check. Today `partyCompanionCap()` returns 3, so there is no visible effect until multiplayer changes the player count.
- **`_cloudRewindModal` dismissal.** The modal is dismissible (Escape), so for a Load it closes with neither choice applied. Pressing Escape while "Exporting…" is pending lets the export finish and then `onAdopt()` applies the rewind after the dialog is gone. The export did succeed, so no turns are lost without a file. Whether that is acceptable UX is a judgement call.
- **A Windows reserved campaign name** ("CON", "AUX") makes `_slugFolderName` produce a reserved folder name. I did not run it; I expect each export to fail loudly into the download fallback.
- **No file-size limit on `importSave`, `importCharacterFile` or the blueprint file reader.** I did not measure the freeze or quota behaviour for a very large file or portrait.
- **`campaignFolderFor(…, create=false)`** (the restore path) still writes a marker file into an unmarked folder (line 142). That is a write on a read path; it is harmless as far as I can tell.
